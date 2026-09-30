// Contas da aba Investimentos. Tudo aqui é CÁLCULO: nada disto é salvo na
// nuvem. Na nuvem ficam só as coisas que o Joel digitou (cada vez que guardou,
// resgatou ou corrigiu o saldo); o rendimento é refeito toda vez que a tela
// abre, com as taxas oficiais do dia. Se as taxas não chegarem, os valores
// ficam no que foi guardado — nunca se inventa número nem se grava por cima.
//
// Tipos de investimento:
//  - "cdi":   caixinha, RDB, CDB (rende X% do CDI)
//  - "selic": Tesouro Selic (Selic + uma taxinha extra por ano)
//  - "ipca":  Tesouro IPCA+, Renda+, Educa+ (preço muda todo dia; vale
//             quantidade × preço oficial do Tesouro)

import { uid, hojeISO, p2 } from "../pessoal/logica.js";

export { uid, hojeISO, p2 };

export const TIPOS = {
  cdi: { nome: "Caixinha / RDB / CDB", curto: "Caixinha, RDB ou CDB", cor: "#5FE3A1" },
  selic: { nome: "Tesouro Selic", curto: "Tesouro Selic", cor: "#FFC94D" },
  ipca: { nome: "IPCA+ / Renda+", curto: "Tesouro IPCA+ ou Renda+", cor: "#FF7EA6" },
};
export const ORDEM_TIPOS = ["cdi", "selic", "ipca"];

/* ---------------- documento ---------------- */

export function vazio() {
  return { v: 1, investimentos: [], metas: [] };
}

export function normalizar(doc) {
  const d = doc && typeof doc === "object" ? doc : {};
  return {
    ...d,
    v: d.v || 1,
    investimentos: Array.isArray(d.investimentos) ? d.investimentos.map((i) => ({ ...i, movs: Array.isArray(i.movs) ? i.movs : [] })) : [],
    metas: Array.isArray(d.metas) ? d.metas : [],
  };
}

/* ---------------- datas ---------------- */

const DIA = 86400000;
const t = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const diasEntre = (a, b) => Math.round((t(b) - t(a)) / DIA);
export function fimDoMes(ym) {
  const [a, m] = ym.split("-").map(Number);
  return `${ym}-${p2(new Date(a, m, 0).getDate())}`;
}
export function somaMesYm(ym, n) {
  let [a, m] = ym.split("-").map(Number);
  m += n;
  while (m > 12) { m -= 12; a++; }
  while (m < 1) { m += 12; a--; }
  return `${a}-${p2(m)}`;
}
export const brData = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesCurto = (ym) => MESES_CURTOS[+ym.slice(5, 7) - 1];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const dataLonga = (iso) => `${+iso.slice(8, 10)} de ${MESES_LONGOS[+iso.slice(5, 7) - 1]}${iso.slice(0, 4) !== hojeISO().slice(0, 4) ? " de " + iso.slice(0, 4) : ""}`;

/* ---------------- impostos ---------------- */

// Imposto de Renda da renda fixa: quanto mais tempo o dinheiro fica, menos paga.
export function aliquotaIR(dias) {
  if (dias <= 180) return 0.225;
  if (dias <= 360) return 0.2;
  if (dias <= 720) return 0.175;
  return 0.15;
}
export const faixaIR = (dias) =>
  dias <= 180 ? "22,5%, até 6 meses" : dias <= 360 ? "20%, até 1 ano" : dias <= 720 ? "17,5%, até 2 anos" : "15%, mais de 2 anos";
// IOF: só nos primeiros 29 dias (tabela da Receita)
const IOF = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3];
const aliquotaIOF = (dias) => (dias < 1 ? IOF[0] / 100 : dias <= 29 ? IOF[dias - 1] / 100 : 0);

// imposto de um pedaço: ganho × IOF, depois IR sobre o que sobra
function impostoDoGanho(ganho, dias) {
  if (ganho <= 0) return { iof: 0, ir: 0 };
  const iof = ganho * aliquotaIOF(dias);
  return { iof, ir: (ganho - iof) * aliquotaIR(dias) };
}

/* ---------------- taxas (Banco Central) ---------------- */

// serie = [[iso, taxa% do dia], ...] em ordem. Devolve uma função que diz
// quanto R$ 1 aplicado no dia `de` vira até o dia `ate` (a taxa de cada dia
// útil rende "da noite pro dia", então conta os dias de <= d < ate).
function curva(serie, fatorDoDia) {
  const datas = serie.map((x) => x[0]);
  const acum = [1];
  for (let k = 0; k < serie.length; k++) acum.push(acum[k] * fatorDoDia(serie[k][1]));
  const idx = (d) => {
    let lo = 0, hi = datas.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (datas[m] < d) lo = m + 1; else hi = m;
    }
    return lo;
  };
  return {
    fator: (de, ate) => (ate <= de ? 1 : acum[idx(ate)] / acum[idx(de)]),
    ultimaTaxa: serie.length ? serie[serie.length - 1][1] : null,
    ultimaData: serie.length ? serie[serie.length - 1][0] : null,
  };
}

function curvaDoInvestimento(inv, mercado) {
  if (inv.tipo === "cdi") {
    if (!mercado.cdi?.length) return null;
    const m = (Number(inv.pct) || 100) / 100;
    return curva(mercado.cdi, (r) => 1 + (r / 100) * m);
  }
  if (inv.tipo === "selic") {
    if (!mercado.selic?.length) return null;
    const extra = Math.pow(1 + (Number(inv.spread) || 0) / 100, 1 / 252);
    return curva(mercado.selic, (r) => (1 + r / 100) * extra);
  }
  return null;
}

/* ---------------- Tesouro IPCA+ / Renda+ (preço) ---------------- */

// preço (quanto o Tesouro paga por 1 título) no dia `d`:
// hoje → preço mais novo; mês passado → preço do último dia daquele mês
export function precoTesouro(tesouro, chave, d) {
  const tit = tesouro?.titulos?.[chave];
  if (!tit) return null;
  if (d >= tesouro.data) return tit.pu;
  const ym = d.slice(0, 7);
  if (tit.meses?.[ym]) return tit.meses[ym];
  // antes do histórico: o mês mais antigo que temos
  const meses = Object.keys(tit.meses || {}).sort();
  const antes = meses.filter((m) => m <= ym);
  return antes.length ? tit.meses[antes[antes.length - 1]] : null;
}

// quantidade de um aporte: a que o Joel digitou ou, se não souber, uma conta
// aproximada pelo preço daquele mês
export function qtdDoMov(mov, inv, tesouro) {
  if (Number(mov.qtd) > 0) return { qtd: Number(mov.qtd), estimada: false };
  const pu = precoTesouro(tesouro, inv.titulo, mov.data);
  return pu ? { qtd: mov.valor / pu, estimada: true } : { qtd: 0, estimada: true };
}

/* ---------------- o motor: um investimento num dia ---------------- */

const movsOrdenados = (inv) =>
  [...(inv.movs || [])].sort((a, b) => (a.data === b.data ? (a.criado || 0) - (b.criado || 0) : a.data < b.data ? -1 : 1));

// Refaz a história do investimento até o dia `ate`: cada aporte vira um
// "pedaço" com a data dele (é o que define o imposto); resgates tiram dos
// pedaços mais antigos primeiro (igual ao banco); "ajuste" corrige o total
// pro saldo que o banco mostra.
export function simular(inv, mercado, ate = hojeISO()) {
  const c = curvaDoInvestimento(inv, mercado);
  const preco = inv.tipo === "ipca";
  let semTaxa = !preco && !c;
  const pedacos = [];
  const eventos = [];
  let qtdEstimada = false;

  const valorPedaco = (p, d) => {
    if (preco) {
      const pu = precoTesouro(mercado.tesouro, inv.titulo, d);
      if (pu == null) { semTaxa = true; return p.custo; }
      return p.qtd * pu;
    }
    if (!c) return p.base;
    return p.base * c.fator(p.dataBase, d);
  };
  const total = (d) => pedacos.reduce((s, p) => s + valorPedaco(p, d), 0);

  for (const mv of movsOrdenados(inv)) {
    if (mv.data > ate) break;
    const valor = Number(mv.valor) || 0;
    if (mv.tipo === "aporte") {
      if (preco) {
        const q = qtdDoMov(mv, inv, mercado.tesouro);
        if (q.estimada) qtdEstimada = true;
        pedacos.push({ qtd: q.qtd, custo: valor, data: mv.data });
      } else {
        pedacos.push({ base: valor, dataBase: mv.data, custo: valor, data: mv.data });
      }
      eventos.push({ mov: mv });
    } else if (mv.tipo === "resgate") {
      let falta = valor;
      let irPago = 0;
      if (preco && Number(mv.qtd) > 0) {
        // resgate por quantidade de títulos
        let qFalta = Number(mv.qtd);
        for (const p of pedacos) {
          if (qFalta <= 0) break;
          if (p.qtd <= 0) continue;
          const q = Math.min(p.qtd, qFalta);
          const fr = q / p.qtd;
          const recebido = valor * (q / Number(mv.qtd));
          irPago += impostoDoGanho(recebido - p.custo * fr, diasEntre(p.data, mv.data)).ir;
          p.custo *= 1 - fr;
          p.qtd -= q;
          qFalta -= q;
        }
      } else {
        for (const p of pedacos) {
          if (falta <= 0.005) break;
          const v = valorPedaco(p, mv.data);
          if (v <= 0) continue;
          const tira = Math.min(v, falta);
          const fr = tira / v;
          const imp = impostoDoGanho(tira - p.custo * fr, diasEntre(p.data, mv.data));
          irPago += imp.ir + imp.iof;
          p.custo *= 1 - fr;
          if (preco) p.qtd *= 1 - fr; else p.base *= 1 - fr;
          falta -= tira;
        }
      }
      eventos.push({ mov: mv, irPago });
    } else if (mv.tipo === "ajuste" && !preco) {
      const antes = total(mv.data);
      const saldo = Number(mv.saldo) || 0;
      if (antes > 0) {
        const k = saldo / antes;
        for (const p of pedacos) {
          p.base = valorPedaco(p, mv.data) * k;
          p.dataBase = mv.data;
        }
      } else if (saldo > 0) {
        pedacos.push({ base: saldo, dataBase: mv.data, custo: 0, data: mv.data });
      }
      eventos.push({ mov: mv, diferenca: saldo - antes });
    }
    for (let k = pedacos.length - 1; k >= 0; k--) {
      const p = pedacos[k];
      if ((preco ? p.qtd : p.base) <= 1e-9 && p.custo <= 0.005) pedacos.splice(k, 1);
    }
  }

  let bruto = 0, custo = 0, ir = 0, iof = 0, qtd = 0;
  let maisVelho = null;
  for (const p of pedacos) {
    const v = valorPedaco(p, ate);
    const dias = diasEntre(p.data, ate);
    const imp = impostoDoGanho(v - p.custo, dias);
    bruto += v;
    custo += p.custo;
    ir += imp.ir;
    iof += imp.iof;
    if (preco) qtd += p.qtd;
    if (!maisVelho || p.data < maisVelho) maisVelho = p.data;
  }
  // quanto rende por dia útil agora (só onde dá pra saber: CDI e Selic)
  let porDia = 0;
  if (c && c.ultimaTaxa != null) {
    const r = inv.tipo === "cdi"
      ? (c.ultimaTaxa / 100) * ((Number(inv.pct) || 100) / 100)
      : (1 + c.ultimaTaxa / 100) * Math.pow(1 + (Number(inv.spread) || 0) / 100, 1 / 252) - 1;
    porDia = bruto * r;
  }
  return {
    bruto, custo, ganho: bruto - custo, ir, iof, liquido: bruto - ir - iof, qtd, qtdEstimada,
    porDia, semTaxa, eventos, diasMaisVelho: maisVelho ? diasEntre(maisVelho, ate) : 0,
  };
}

/* ---------------- a carteira toda ---------------- */

const ativos = (doc) => (doc?.investimentos || []).filter((i) => !i.arquivado);

export function primeiraData(doc) {
  let d = null;
  for (const i of ativos(doc)) for (const m of i.movs || []) if (!d || m.data < d) d = m.data;
  return d;
}

// o mesmo dinheiro (mesmas entradas e saídas) se tivesse ficado em 100% do CDI
function noCDI(doc, mercado, ate) {
  if (!mercado.cdi?.length) return null;
  const c = curva(mercado.cdi, (r) => 1 + r / 100);
  const movs = [];
  for (const i of ativos(doc)) for (const m of i.movs || []) if (m.tipo !== "ajuste" && m.data <= ate) movs.push(m);
  movs.sort((a, b) => (a.data < b.data ? -1 : 1));
  let saldo = 0, dataSaldo = null, custo = 0;
  for (const m of movs) {
    if (dataSaldo) saldo *= c.fator(dataSaldo, m.data);
    dataSaldo = m.data;
    const v = Number(m.valor) || 0;
    if (m.tipo === "aporte") { saldo += v; custo += v; } else if (m.tipo === "resgate") {
      const fr = saldo > 0 ? Math.min(1, v / saldo) : 0;
      custo *= 1 - fr;
      saldo -= v;
    }
  }
  if (dataSaldo) saldo *= c.fator(dataSaldo, ate);
  return saldo - custo;
}

export function calcularCarteira(doc, mercado, hoje = hojeISO()) {
  const itens = ativos(doc).map((inv) => ({ inv, r: simular(inv, mercado, hoje) }));
  const soma = (k) => itens.reduce((s, x) => s + x.r[k], 0);
  const bruto = soma("bruto"), custo = soma("custo");
  const liquido = soma("liquido");

  // grupos por tipo, maiores primeiro
  const grupos = ORDEM_TIPOS.map((tipo) => {
    const doTipo = itens.filter((x) => x.inv.tipo === tipo).sort((a, b) => b.r.bruto - a.r.bruto);
    const b = doTipo.reduce((s, x) => s + x.r.bruto, 0);
    const c = doTipo.reduce((s, x) => s + x.r.custo, 0);
    return { tipo, itens: doTipo, bruto: b, ganho: b - c, pct: bruto > 0 ? b / bruto : 0 };
  }).filter((g) => g.itens.length);

  // este mês: quanto o dinheiro cresceu, tirando o que entrou e saiu
  const ymHoje = hoje.slice(0, 7);
  const fimAnterior = fimDoMes(somaMesYm(ymHoje, -1));
  let noMesAnterior = 0, entrouNoMes = 0;
  for (const { inv, r } of itens) {
    noMesAnterior += simular(inv, mercado, fimAnterior).bruto;
    // "ajustar com o banco" corrige o valor; não é rendimento do mês
    for (const e of r.eventos) if (e.mov.tipo === "ajuste" && e.mov.data > fimAnterior && e.diferenca) entrouNoMes += e.diferenca;
    for (const m of inv.movs || []) {
      if (m.data > fimAnterior && m.data <= hoje) {
        if (m.tipo === "aporte") entrouNoMes += Number(m.valor) || 0;
        if (m.tipo === "resgate") entrouNoMes -= Number(m.valor) || 0;
      }
    }
  }
  const esteMes = bruto - noMesAnterior - entrouNoMes;

  const ganhoCDI = noCDI(doc, mercado, hoje);
  const ganho = bruto - custo;
  const vsCDI = ganhoCDI && ganhoCDI > 0.5 ? (ganho / ganhoCDI) * 100 : null;

  return {
    itens, grupos, bruto, custo, ganho, liquido,
    pct: custo > 0 ? ganho / custo : 0,
    porDia: soma("porDia"), esteMes, vsCDI,
    semTaxa: itens.some((x) => x.r.semTaxa),
  };
}

// fim de cada mês (e hoje, no mês atual): quanto estava guardado e quanto valia
export function evolucao(doc, mercado, hoje = hojeISO()) {
  const inicio = primeiraData(doc);
  if (!inicio) return [];
  const pontos = [];
  let ym = inicio.slice(0, 7);
  const ymHoje = hoje.slice(0, 7);
  const lista = ativos(doc);
  while (ym <= ymHoje) {
    const dia = ym === ymHoje ? hoje : fimDoMes(ym);
    let bruto = 0, custo = 0;
    for (const inv of lista) {
      const r = simular(inv, mercado, dia);
      bruto += r.bruto;
      custo += r.custo;
    }
    pontos.push({ ym, mes: mesCurto(ym), ano: ym.slice(0, 4), guardado: custo, rendimento: bruto - custo, total: bruto });
    ym = somaMesYm(ym, 1);
  }
  return pontos;
}

// metas: a soma do valor de hoje dos investimentos ligados a cada uma
export function progressoMetas(doc, carteira) {
  const porId = Object.fromEntries(carteira.itens.map((x) => [x.inv.id, x.r.bruto]));
  return (doc.metas || []).map((m) => {
    const ligados = ativos(doc).filter((i) => i.metaId === m.id);
    const valor = ligados.reduce((s, i) => s + (porId[i.id] || 0), 0);
    const alvo = Number(m.alvo) || 0;
    return { meta: m, valor, alvo, pct: alvo > 0 ? Math.min(1, valor / alvo) : 0, qtd: ligados.length };
  });
}

/* ---------------- buscar taxas e preços ---------------- */

const CACHE = "oink-mercado-v1";
const brParaIso = (d) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;
const isoParaBr = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

async function comLimite(url, ms = 9000) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctl && ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl?.signal, cache: "no-store" });
    if (!r.ok) throw new Error("http " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// série diária do Banco Central (12 = CDI, 11 = Selic), no máximo 10 anos por pedido
async function buscarSerie(codigo, de, ate) {
  const partes = [];
  let ini = de;
  while (ini <= ate) {
    const fimJanela = `${+ini.slice(0, 4) + 9}${ini.slice(4)}`;
    const fim = fimJanela < ate ? fimJanela : ate;
    const j = await comLimite(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${isoParaBr(ini)}&dataFinal=${isoParaBr(fim)}`);
    if (!Array.isArray(j)) throw new Error("resposta estranha");
    for (const x of j) partes.push([brParaIso(x.data), Number(x.valor)]);
    const prox = new Date(t(fim) + DIA);
    ini = `${prox.getUTCFullYear()}-${p2(prox.getUTCMonth() + 1)}-${p2(prox.getUTCDate())}`;
  }
  return partes;
}

function juntar(velha, nova) {
  const m = new Map((velha || []).map((x) => [x[0], x[1]]));
  for (const [d, v] of nova) m.set(d, v);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function lerCacheMercado() {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || "null");
  } catch (e) {
    return null;
  }
}

// Busca o que falta desde `desde` (a data mais antiga da carteira). Usa o que
// já está guardado no aparelho e só pede o pedaço novo. Se a internet falhar,
// devolve o que tinha (e avisa).
export async function atualizarMercado(desde) {
  const hoje = hojeISO();
  const velho = lerCacheMercado() || {};
  const novo = { ...velho };
  let falhou = false;
  for (const [nome, codigo] of [["cdi", 12], ["selic", 11]]) {
    const serie = velho[nome] || [];
    const cobreDesde = serie.length && serie[0][0] <= desde;
    const ultima = serie.length ? serie[serie.length - 1][0] : null;
    try {
      if (!cobreDesde) {
        novo[nome] = juntar(serie, await buscarSerie(codigo, desde, hoje));
      } else if (ultima < hoje) {
        const volta = new Date(t(ultima) - 7 * DIA);
        const ini = `${volta.getUTCFullYear()}-${p2(volta.getUTCMonth() + 1)}-${p2(volta.getUTCDate())}`;
        novo[nome] = juntar(serie, await buscarSerie(codigo, ini, hoje));
      }
    } catch (e) {
      falhou = true;
    }
  }
  try {
    const tes = await comLimite("https://raw.githubusercontent.com/joonetoo/financas-casa/main/dados/tesouro.json");
    if (tes && tes.titulos && tes.data) novo.tesouro = tes;
  } catch (e) {
    falhou = true;
  }
  novo.buscadoEm = falhou ? velho.buscadoEm || null : new Date().toISOString();
  try {
    localStorage.setItem(CACHE, JSON.stringify(novo));
  } catch (e) { /* aparelho sem espaço: usa só nesta sessão */ }
  return { mercado: novo, falhou };
}

/* ---------------- números ---------------- */

export const fmt = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtSinal = (v) => (v < -0.004 ? "−" : "+") + fmt(Math.abs(v));
export const fmtPct = (v, casas = 1) => (v < 0 ? "−" : "+") + Math.abs(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%";
export const fmtQtd = (q) => (Number(q) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
export function lerNumero(txt) {
  if (typeof txt === "number") return txt;
  const s = String(txt || "").replace(/[^\d,.-]/g, "");
  if (!s) return NaN;
  // "1.234,56" ou "1234,56" ou "1234.56"
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(norm);
}
