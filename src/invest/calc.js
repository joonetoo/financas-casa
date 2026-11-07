// Contas da Calculadora de investimentos (aba Investimentos → Calculadora).
//
// É SIMULAÇÃO: nada daqui mexe nos dados do Oink. A calculadora tem a linha
// dela na nuvem (CHAVE_CALC), onde ficam só os números que o Joel mexeu e os
// cenários que ele salvou com nome. Os "Meus números do Oink" leem a carteira e
// a Minhas contas SÓ PRA LER.
//
// Mesma conta da calculadora do Claudio (calculo-aposentadoria.html), em
// dinheiro de hoje (ganho real, já sem inflação):
//   juros do mês i = (1+taxa)^(1/12) − 1
//   cada mês: guardado = guardado × (1+i) + quanto guardo − (casa, se sai do guardado)
//   meta pra parar = (gasto comigo + casa) × 12 ÷ (saque/100)

import { p2 } from "../pessoal/logica.js";

export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const BASE = { taxa: 5.5, saque: 4, anosVer: 10 };
export const PRESETS = {
  premio: { ...BASE, idade: 30, alvo: 50, patr: 1000000, ini: 300000, aps: [{ de: null, v: 5500 }], pess: 2500, casa: 6000, casaPot: true, metaB: 3000000, metaC: 3000000, anosC: 20 },
  hoje: { ...BASE, idade: 30, alvo: 55, patr: 0, ini: 0, aps: [{ de: null, v: 3900 }], pess: 2500, casa: 1600, casaPot: false, metaB: 1000000, metaC: 1000000, anosC: 15 },
};
export const NOMES_PRESETS = { premio: "Com o prêmio de R$ 1 milhão", hoje: "Hoje, sem prêmio", oink: "Meus números do Oink" };

const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------------- documento da nuvem ---------------- */

export function vazioCalc() {
  return { v: 1, atual: { ...clone(PRESETS.premio), preset: "premio" }, cenarios: [] };
}

const num = (v, min, max, padrao) => {
  const n = Number(v);
  if (!isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
};

// Deixa os números sempre válidos (sem nunca apagar campos que não conhece).
export function limparNumeros(s) {
  const p = PRESETS.hoje;
  const o = s && typeof s === "object" ? s : {};
  const aps = Array.isArray(o.aps) && o.aps.length ? o.aps : clone(p.aps);
  const out = {
    ...o,
    idade: Math.round(num(o.idade, 18, 70, p.idade)),
    patr: num(o.patr, 0, 1e10, p.patr),
    ini: num(o.ini, 0, 1e10, 0),
    pess: num(o.pess, 0, 1e8, p.pess),
    casa: num(o.casa, 0, 1e8, p.casa),
    casaPot: !!o.casaPot,
    taxa: num(o.taxa, 2, 8, 5.5),
    saque: num(o.saque, 3, 5, 4),
    anosVer: Math.round(num(o.anosVer, 1, 40, 10)),
    metaB: num(o.metaB, 0, 1e10, 1000000),
    metaC: num(o.metaC, 0, 1e10, 1000000),
    anosC: Math.round(num(o.anosC, 1, 50, 15)),
    aps: aps.map((a, j) => ({
      de: j === 0 ? null : (typeof a?.de === "string" && /^\d{4}-\d{2}$/.test(a.de) ? a.de : null),
      v: num(a?.v, 0, 1e8, 0),
    })).filter((a, j) => j === 0 || a.de),
  };
  out.alvo = Math.round(num(o.alvo, out.idade + 1, 75, Math.min(75, out.idade + 20)));
  if (out.alvo <= out.idade) out.alvo = Math.min(75, out.idade + 1);
  return out;
}

export function normalizarCalc(doc) {
  const d = doc && typeof doc === "object" ? doc : {};
  return {
    ...d,
    v: d.v || 1,
    atual: limparNumeros(d.atual || vazioCalc().atual),
    cenarios: Array.isArray(d.cenarios) ? d.cenarios.filter((c) => c && c.id) : [],
  };
}

/* ---------------- meses ---------------- */

// "mês 0" = o mês de hoje
export function mesHoje(hoje = new Date()) {
  return `${hoje.getFullYear()}-${p2(hoje.getMonth() + 1)}`;
}
export function kDoMes(ym, base) {
  const [a, m] = ym.split("-").map(Number);
  const [a0, m0] = base.split("-").map(Number);
  return (a - a0) * 12 + (m - m0);
}
export function mesDoK(k, base) {
  const [a0, m0] = base.split("-").map(Number);
  const d = new Date(a0, m0 - 1 + k, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
export function mesAno(k, base) {
  const ym = mesDoK(k, base);
  return `${MESES_CURTOS[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;
}
export function dur(k) {
  const a = Math.floor(k / 12), m = k % 12;
  return ((a ? a + (a === 1 ? " ano" : " anos") : "") + (a && m ? " e " : "") + (m ? m + (m === 1 ? " mês" : " meses") : "")) || "agora";
}

/* ---------------- dinheiro ---------------- */

export const brl = (v) => "R$ " + Math.round(v).toLocaleString("pt-BR");
export function big(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: a >= 1e7 ? 1 : 2 }) + " mi";
  if (a >= 1e4) return "R$ " + Math.round(v / 1e3).toLocaleString("pt-BR") + " mil";
  return brl(v);
}
export function curto(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
  if (a >= 1e3) return Math.round(v / 1e3) + " mil";
  return Math.round(v) + "";
}

/* ---------------- a conta ---------------- */

export const juros = (s) => Math.pow(1 + s.taxa / 100, 1 / 12) - 1;
export const tira = (s) => (s.casaPot ? s.casa : 0);
export const p0 = (s) => Math.max(0, s.patr - s.ini);
export const meta = (s) => ((s.pess + s.casa) * 12) / (s.saque / 100);

// as mudanças no "quanto guardo", em meses a partir de hoje (em ordem)
export function degraus(s, base) {
  return s.aps
    .map((a, j) => ({ k: j === 0 ? -Infinity : kDoMes(a.de, base), v: a.v }))
    .sort((x, y) => x.k - y.k);
}
export function aporteEm(dg, k) {
  let v = 0;
  for (const d of dg) if (d.k <= k) v = d.v;
  return v;
}

// mês a mês: p = guardado com rendimento, b = só o que saiu do bolso
export function simular(s, H, base, fixo) {
  const i = juros(s), t = tira(s), dg = degraus(s, base);
  let p = p0(s), b = p;
  const r = [{ p, b }];
  for (let k = 0; k < H; k++) {
    const a = fixo != null ? fixo : aporteEm(dg, k);
    p = p * (1 + i) + a - t;
    if (p < 0) p = 0;
    b = Math.max(0, b + a - t);
    r.push({ p, b });
  }
  return r;
}

// quanto guardar por mês (sempre o mesmo valor) pra ter `alvo` em n meses
export function precisa(s, alvo, n) {
  if (n <= 0) return null;
  const i = juros(s), f = Math.pow(1 + i, n);
  return Math.max(0, ((alvo - p0(s) * f) * i) / (f - 1) + tira(s));
}

export function contas(s, modo, base) {
  if (modo === "parar") {
    const M = meta(s), max = (75 - s.idade) * 12;
    const r = simular(s, max, base);
    let stop = r.findIndex((x) => x.p >= M);
    if (stop < 0) stop = null;
    const n = Math.max(0, (s.alvo - s.idade) * 12);
    const need = n ? precisa(s, M, n) : null;
    const H = Math.min(max, Math.max(stop ?? max, n) + 60);
    return { M, r: r.slice(0, H + 1), stop, n, need, pAlvo: r[Math.min(n, r.length - 1)].p, marca: stop, meta: M };
  }
  if (modo === "ter") {
    const n = s.anosVer * 12;
    const r = simular(s, Math.max(n, 80 * 12), base);
    let quando = r.findIndex((x) => x.p >= s.metaB);
    if (quando < 0 || !s.metaB) quando = s.metaB ? null : 0;
    return { r: r.slice(0, n + 1), n, fim: r[n], quando, marca: n, meta: s.metaB && s.metaB <= r[n].p * 1.6 ? s.metaB : null };
  }
  const n = s.anosC * 12;
  const need = precisa(s, s.metaC, n);
  return { r: simular(s, n, base, need), n, need, marca: n, meta: s.metaC };
}

/* ---------------- "Meus números do Oink" (só leitura) ---------------- */

// Média dos últimos 3 meses fechados da Minhas contas: quanto saiu (gasto
// comigo) e quanto sobrou (entradas − saídas). Lançamentos "fora da soma" não
// entram, igual ao resto do app.
export function mediasMinhasContas(docPessoal, hoje = new Date()) {
  const lancs = Array.isArray(docPessoal?.lancamentos) ? docPessoal.lancamentos : [];
  const base = mesHoje(hoje);
  const meses = [mesDoK(-3, base), mesDoK(-2, base), mesDoK(-1, base)];
  let e = 0, s = 0, usados = 0;
  for (const ym of meses) {
    const doMes = lancs.filter((l) => !l.foraSoma && typeof l.data === "string" && l.data.slice(0, 7) === ym);
    if (!doMes.length) continue;
    usados++;
    for (const l of doMes) {
      const v = Number(l.valor) || 0;
      if (l.tipo === "receita") e += v;
      else s += v;
    }
  }
  if (!usados) return null;
  return { gasto: s / usados, sobra: (e - s) / usados, meses: usados };
}

// aportes − resgates por mês na carteira, nos últimos 6 meses fechados
export function mediaAportes(docInvest, hoje = new Date()) {
  const base = mesHoje(hoje);
  const ini = mesDoK(-6, base), fim = mesDoK(-1, base);
  let tot = 0, achou = false;
  for (const inv of docInvest?.investimentos || []) {
    for (const m of inv.movs || []) {
      const ym = (m.data || "").slice(0, 7);
      if (ym < ini || ym > fim) continue;
      if (m.tipo === "aporte") { tot += Number(m.valor) || 0; achou = true; }
      if (m.tipo === "resgate") { tot -= Number(m.valor) || 0; achou = true; }
    }
  }
  return achou ? tot / 6 : null;
}

export function presetOink(atual, { patrimonio, medias, aportes }) {
  const s = clone(limparNumeros(atual));
  s.patr = Math.max(0, Math.round(patrimonio || 0));
  s.ini = 0;
  if (medias && medias.gasto > 0) s.pess = Math.round(medias.gasto / 10) * 10;
  const guardo = medias && medias.sobra > 0 ? medias.sobra : aportes && aportes > 0 ? aportes : null;
  if (guardo != null) s.aps = [{ de: null, v: Math.round(guardo / 10) * 10 }];
  s.casaPot = false;
  return s;
}
