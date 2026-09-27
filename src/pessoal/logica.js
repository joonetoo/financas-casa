// Regras da aba "Minhas contas" — funções puras (sem tela, sem rede), pra
// poder testar tudo sozinho antes de ligar no app.
//
// Formato guardado (linha própria no app_data, separada da casa):
// {
//   v: 1,
//   categorias: [{ id, tipo: "despesa"|"receita", nome, icone, cor, arquivada }],
//   lancamentos: [{
//     id, tipo: "despesa"|"receita", desc, valor (sempre positivo, em reais),
//     data: "AAAA-MM-DD" (data LOCAL), catId, pago: bool, obs: "",
//     serie?: { id, tipo: "fixo"|"parcela", n?, total?, dia }
//   }]
// }
// Campos novos: SEMPRE opcionais e com padrão na leitura (normalizar), nunca
// mudando o formato dos que já existem — backups antigos têm que continuar abrindo.

export const uid = () =>
  Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 10);

export const p2 = (n) => String(n).padStart(2, "0");

// data LOCAL (toISOString é UTC: depois das 21h no Brasil já seria amanhã)
export const hojeISO = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const ymDe = (iso) => iso.slice(0, 7);
export const ymHoje = () => ymDe(hojeISO());

export const diasNoMes = (ano, mes1a12) => new Date(ano, mes1a12, 0).getDate();

// soma meses a uma data guardando o "dia pretendido" (31 vira 30/28 em meses
// curtos, mas volta a ser 31 no mês seguinte que tiver 31)
export function somaMeses(iso, n, diaPretendido) {
  const [a, m, d] = iso.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dia = Math.min(diaPretendido || d, diasNoMes(na, nm));
  return `${na}-${p2(nm)}-${p2(dia)}`;
}

export const somaYm = (ym, n) => somaMeses(`${ym}-01`, n).slice(0, 7);

// dinheiro em centavos inteiros pra não acumular erro de ponto flutuante
export const cent = (v) => Math.round((Number(v) || 0) * 100);
export const reais = (c) => c / 100;

export const FIXO_MESES = 36; // uma conta "todo mês" é lançada 3 anos pra frente

// Monta os lançamentos de um "novo lançamento" (avulso, fixo ou parcelado).
export function criarLancamentos(f) {
  const base = {
    tipo: f.tipo,
    desc: (f.desc || "").trim() || (f.tipo === "receita" ? "Receita" : "Despesa"),
    catId: f.catId || null,
    obs: (f.obs || "").trim(),
  };
  const dia = Number(f.data.slice(8, 10));
  if (f.repetir === "parcela") {
    const n = Math.max(2, Math.min(120, Math.round(Number(f.parcelas) || 2)));
    let valores;
    if (f.modoValor === "parcela") {
      valores = Array(n).fill(cent(f.valor));
    } else {
      // divide o total; os centavos que sobram vão na 1ª parcela (igual ao Organizze)
      const tot = cent(f.valor);
      const cada = Math.floor(tot / n);
      valores = Array(n).fill(cada);
      valores[0] += tot - cada * n;
    }
    const serie = uid();
    return valores.map((c, i) => ({
      ...base,
      id: uid(),
      valor: reais(c),
      data: somaMeses(f.data, i, dia),
      pago: i === 0 ? !!f.pago : false,
      serie: { id: serie, tipo: "parcela", n: i + 1, total: n, dia },
    }));
  }
  if (f.repetir === "fixo") {
    const serie = uid();
    return Array.from({ length: FIXO_MESES }, (_, i) => ({
      ...base,
      id: uid(),
      valor: reais(cent(f.valor)),
      data: somaMeses(f.data, i, dia),
      pago: i === 0 ? !!f.pago : false,
      serie: { id: serie, tipo: "fixo", dia },
    }));
  }
  return [{ ...base, id: uid(), valor: reais(cent(f.valor)), data: f.data, pago: !!f.pago }];
}

// ordem da lista: por data (dia 05 antes do 10); no mesmo dia, receita
// primeiro e depois a ordem em que foi lançado
export function doMes(lancs, ym) {
  return lancs
    .map((l, i) => [l, i])
    .filter(([l]) => l.data.startsWith(ym))
    .sort(([a, ia], [b, ib]) =>
      a.data < b.data ? -1 : a.data > b.data ? 1 :
      a.tipo !== b.tipo ? (a.tipo === "receita" ? -1 : 1) : ia - ib)
    .map(([l]) => l);
}

export function totais(itens) {
  let e = 0, s = 0;
  for (const l of itens) {
    if (l.tipo === "receita") e += cent(l.valor);
    else s += cent(l.valor);
  }
  return { entradas: reais(e), saidas: reais(s), resultado: reais(e - s) };
}

// Os lançamentos da mesma série a partir deste (este incluído), em ordem.
export function daquiPraFrente(lancs, item) {
  if (!item.serie) return [item];
  return lancs
    .filter((l) => l.serie && l.serie.id === item.serie.id && l.data >= item.data)
    .sort((a, b) => (a.data < b.data ? -1 : 1));
}

// Aplica as mudanças feitas num lançamento às PRÓXIMAS da série (este já foi
// salvo antes). Muda nome, valor, categoria, observação e — se o dia mudou —
// o dia do mês. "Pago" e o mês de cada uma ficam como estão.
export function aplicarNasProximas(lancs, editado) {
  if (!editado.serie) return lancs;
  const dia = Number(editado.data.slice(8, 10));
  const ids = new Set(
    lancs.filter((l) => l.serie && l.serie.id === editado.serie.id && l.data > editado.data).map((l) => l.id)
  );
  return lancs.map((l) => {
    if (l.id === editado.id) return { ...l, serie: { ...l.serie, dia } };
    if (!ids.has(l.id)) return l;
    const [a, m] = l.data.split("-").map(Number);
    return {
      ...l,
      desc: editado.desc,
      valor: editado.valor,
      catId: editado.catId,
      obs: editado.obs,
      tipo: editado.tipo,
      data: `${a}-${p2(m)}-${p2(Math.min(dia, diasNoMes(a, m)))}`,
      serie: { ...l.serie, dia },
    };
  });
}

export const proximasDaSerie = (lancs, item) =>
  item.serie ? lancs.filter((l) => l.serie && l.serie.id === item.serie.id && l.data > item.data) : [];

// joga pro mês seguinte (mesmo dia, ou o último dia se o mês for mais curto)
export const proxMes = (item) => ({ ...item, data: somaMeses(item.data, 1) });

// Garante o formato em dados antigos/importados (só acrescenta padrões).
export function normalizar(doc) {
  const out = { v: 1, ...doc };
  out.categorias = Array.isArray(doc?.categorias) ? doc.categorias : [];
  out.lancamentos = Array.isArray(doc?.lancamentos) ? doc.lancamentos : [];
  return out;
}

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
  "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const nomeMes = (ym) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export function nomeDia(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const w = new Date(a, m - 1, d).getDay();
  return `${DIAS_SEMANA[w]}, ${p2(d)} de ${MESES[m - 1].toLowerCase()}`;
}

export const fmtValor = (v) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
export const fmtReais = (v) => "R$ " + fmtValor(v);

// "1.234,56" / "1234,56" / "1234.56" / "R$ 12" → número (ou NaN)
export function lerValor(txt) {
  let s = String(txt ?? "").replace(/[R$\s]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // "1.234" = mil duzentos…
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* ---------------- períodos (Hoje / Semana / Mês / Escolher) ---------------- */
// periodo = { tipo: "dia"|"semana"|"mes"|"intervalo", de: "AAAA-MM-DD", ate: "AAAA-MM-DD" }
// A semana vai de segunda a domingo (igual ao app MEI).

export function somaDias(iso, n) {
  const [a, m, d] = iso.split("-").map(Number);
  return hojeISO(new Date(a, m - 1, d + n));
}
const diaDaSemana = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).getDay(); // 0 = domingo
};
const diasEntre = (de, ate) => {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  return Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 864e5);
};

export function periodoCom(tipo, iso = hojeISO()) {
  if (tipo === "dia") return { tipo, de: iso, ate: iso };
  if (tipo === "semana") {
    const seg = somaDias(iso, -((diaDaSemana(iso) + 6) % 7));
    return { tipo, de: seg, ate: somaDias(seg, 6) };
  }
  const ym = iso.slice(0, 7);
  const [a, m] = ym.split("-").map(Number);
  return { tipo: "mes", de: `${ym}-01`, ate: `${ym}-${p2(diasNoMes(a, m))}` };
}

export function andarPeriodo(p, n) {
  if (p.tipo === "mes") return periodoCom("mes", `${somaYm(p.de.slice(0, 7), n)}-01`);
  if (p.tipo === "semana") return periodoCom("semana", somaDias(p.de, 7 * n));
  if (p.tipo === "dia") return periodoCom("dia", somaDias(p.de, n));
  const tam = diasEntre(p.de, p.ate) + 1;
  return { tipo: "intervalo", de: somaDias(p.de, tam * n), ate: somaDias(p.ate, tam * n) };
}

const mesCurto = (m) => MESES[m - 1].slice(0, 3).toLowerCase();
export function nomePeriodo(p) {
  const [a1, m1, d1] = p.de.split("-").map(Number);
  const [a2, m2, d2] = p.ate.split("-").map(Number);
  if (p.tipo === "mes") return `${MESES[m1 - 1].toLowerCase()} ${a1}`;
  if (p.tipo === "dia") return `${DIAS_SEMANA[diaDaSemana(p.de)].toLowerCase()}, ${d1} ${mesCurto(m1)}`;
  const ano = a1 !== a2 || a1 !== new Date().getFullYear() ? ` ${a2}` : "";
  return m1 === m2 && a1 === a2 ? `${d1}–${d2} ${mesCurto(m1)}${ano}` : `${d1} ${mesCurto(m1)} – ${d2} ${mesCurto(m2)}${ano}`;
}

export const dentroDo = (p, iso) => iso >= p.de && iso <= p.ate;

// lançamentos do período, na ordem escolhida (crescente = dia 05 antes do 10)
export function doPeriodo(lancs, p, ordem = "crescente") {
  const r = lancs
    .map((l, i) => [l, i])
    .filter(([l]) => l.data >= p.de && l.data <= p.ate)
    .sort(([a, ia], [b, ib]) =>
      a.data < b.data ? -1 : a.data > b.data ? 1 :
      a.tipo !== b.tipo ? (a.tipo === "receita" ? -1 : 1) : ia - ib)
    .map(([l]) => l);
  if (ordem !== "decrescente") return r;
  // decrescente: dias de trás pra frente, mas dentro do dia mantém a ordem
  const dias = [];
  for (const l of r) {
    if (!dias.length || dias[dias.length - 1][0].data !== l.data) dias.push([]);
    dias[dias.length - 1].push(l);
  }
  return dias.reverse().flat();
}

// busca sem ligar pra acento nem maiúscula
export const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
