// Contas da Calculadora de investimentos (src/invest/calc.js).
import { describe, it, expect } from "vitest";
import {
  PRESETS, vazioCalc, limparNumeros, normalizarCalc, mesHoje, kDoMes, mesDoK, mesAno, dur,
  brl, big, curto, juros, tira, p0, meta, degraus, aporteEm, simular, precisa, contas,
  mediasMinhasContas, mediaAportes, presetOink,
} from "../src/invest/calc.js";

const perto = (a, b, casas = 6) => expect(a).toBeCloseTo(b, casas);
const BASE = "2026-11";
const S = (extra = {}) => ({ ...limparNumeros(PRESETS.hoje), ...extra });

describe("meses", () => {
  it("mês de hoje pela data LOCAL", () => {
    expect(mesHoje(new Date(2026, 10, 30, 23, 59))).toBe("2026-11");
    expect(mesHoje(new Date(2026, 0, 1))).toBe("2026-01");
  });
  it("contar meses pra frente e pra trás, virando o ano", () => {
    expect(kDoMes("2026-11", BASE)).toBe(0);
    expect(kDoMes("2027-01", BASE)).toBe(2);
    expect(kDoMes("2025-12", BASE)).toBe(-11);
    expect(mesDoK(0, BASE)).toBe("2026-11");
    expect(mesDoK(2, BASE)).toBe("2027-01");
    expect(mesDoK(-11, BASE)).toBe("2025-12");
    expect(mesDoK(120, BASE)).toBe("2036-11");
    for (const k of [-30, -1, 0, 1, 13, 400]) expect(kDoMes(mesDoK(k, BASE), BASE)).toBe(k);
    expect(mesAno(2, BASE)).toBe("jan/2027");
  });
  it("duração por extenso", () => {
    expect(dur(0)).toBe("agora");
    expect(dur(1)).toBe("1 mês");
    expect(dur(12)).toBe("1 ano");
    expect(dur(13)).toBe("1 ano e 1 mês");
    expect(dur(30)).toBe("2 anos e 6 meses");
  });
});

describe("dinheiro por extenso", () => {
  it("formatos", () => {
    expect(brl(1234.6)).toBe("R$ 1.235");
    expect(big(1500000)).toBe("R$ 1,5 mi");
    expect(big(25000)).toBe("R$ 25 mil");
    expect(big(900)).toBe("R$ 900");
    expect(curto(2500000)).toBe("2,5 mi");
    expect(curto(1500)).toBe("2 mil");
    expect(curto(12)).toBe("12");
  });
});

describe("as peças da conta", () => {
  it("juros do mês: 12 meses compostos dão a taxa do ano", () => {
    perto((1 + juros({ taxa: 5.5 })) ** 12, 1.055, 10);
    expect(juros({ taxa: 0 })).toBe(0);
  });
  it("meta pra parar = gasto do ano ÷ taxa de saque", () => {
    expect(meta({ pess: 2500, casa: 1600, saque: 4 })).toBe(1230000);
  });
  it("ponto de partida nunca é negativo", () => {
    expect(p0({ patr: 1000, ini: 300 })).toBe(700);
    expect(p0({ patr: 100, ini: 300 })).toBe(0);
  });
  it("a casa só sai do guardado se estiver marcado", () => {
    expect(tira({ casaPot: true, casa: 1600 })).toBe(1600);
    expect(tira({ casaPot: false, casa: 1600 })).toBe(0);
  });
  it("degraus do 'quanto guardo': o primeiro vale desde sempre, os outros a partir do mês", () => {
    const s = { aps: [{ de: null, v: 100 }, { de: "2027-01", v: 200 }, { de: "2026-12", v: 150 }] };
    const dg = degraus(s, BASE);
    expect(dg.map((d) => d.v)).toEqual([100, 150, 200]);
    expect([0, 1, 2, 50].map((k) => aporteEm(dg, k))).toEqual([100, 150, 200, 200]);
  });
});

describe("simular mês a mês", () => {
  it("sem juros: é só somar o que guarda", () => {
    const r = simular(S({ taxa: 0, patr: 1000, ini: 0, casaPot: false, aps: [{ de: null, v: 100 }] }), 12, BASE);
    expect(r).toHaveLength(13);
    perto(r[0].p, 1000);
    perto(r[12].p, 2200);
    perto(r[12].b, 2200);
  });
  it("com juros: bate com a fórmula de juros compostos", () => {
    const s = S({ taxa: 6, patr: 10000, ini: 0, casaPot: false, aps: [{ de: null, v: 0 }] });
    const r = simular(s, 24, BASE);
    perto(r[12].p, 10600, 4);
    perto(r[24].p, 10000 * 1.06 ** 2, 4);
    perto(r[24].b, 10000);
  });
  it("gastando mais do que tem: para no zero, nunca fica negativo", () => {
    const r = simular(S({ taxa: 5, patr: 5000, ini: 0, casa: 2000, casaPot: true, aps: [{ de: null, v: 0 }] }), 12, BASE);
    expect(r.every((x) => x.p >= 0 && x.b >= 0)).toBe(true);
    expect(r[12].p).toBe(0);
  });
  it("aporte muda no mês combinado", () => {
    const s = S({ taxa: 0, patr: 0, ini: 0, casaPot: false, aps: [{ de: null, v: 100 }, { de: "2027-01", v: 500 }] });
    const r = simular(s, 4, BASE);
    expect(r.map((x) => x.p)).toEqual([0, 100, 200, 700, 1200]);
  });
  it("não muda os números de entrada", () => {
    const s = S();
    const copia = JSON.stringify(s);
    simular(s, 50, BASE);
    contas(s, "parar", BASE);
    contas(s, "ter", BASE);
    contas(s, "juntar", BASE);
    expect(JSON.stringify(s)).toBe(copia);
  });
});

describe("precisa (quanto guardar por mês)", () => {
  it("guardando exatamente isso, chega no alvo no prazo", () => {
    for (const s of [S({ patr: 0, ini: 0 }), S({ patr: 50000, ini: 0, taxa: 7 }), S({ patr: 200000, ini: 0, casa: 1500, casaPot: true })]) {
      const n = 120, alvo = 1000000;
      const need = precisa(s, alvo, n);
      const r = simular(s, n, BASE, need);
      perto(r[n].p / alvo, 1, 6);
    }
  });
  it("já tem o suficiente → zero (nunca negativo); sem prazo → não responde", () => {
    expect(precisa(S({ patr: 5000000, ini: 0, casaPot: false }), 1000000, 120)).toBe(0);
    expect(precisa(S(), 1000000, 0)).toBe(null);
    expect(precisa(S(), 1000000, -5)).toBe(null);
  });
});

describe("as três perguntas", () => {
  it("'quando posso parar': o mês em que o guardado alcança a meta", () => {
    const s = S({ taxa: 5.5, idade: 30, alvo: 55, patr: 0, ini: 0, pess: 2500, casa: 1600, casaPot: false, aps: [{ de: null, v: 3900 }] });
    const c = contas(s, "parar", BASE);
    expect(c.M).toBe(meta(s));
    expect(c.stop).toBeGreaterThan(0);
    expect(c.r[c.stop].p).toBeGreaterThanOrEqual(c.M);
    expect(c.r[c.stop - 1].p).toBeLessThan(c.M);
    expect(c.n).toBe(300);
  });
  it("'quando posso parar': já tem a meta → agora; nunca alcança → sem data", () => {
    expect(contas(S({ patr: 50000000, ini: 0 }), "parar", BASE).stop).toBe(0);
    expect(contas(S({ patr: 0, ini: 0, aps: [{ de: null, v: 0 }] }), "parar", BASE).stop).toBe(null);
  });
  it("'quanto vou ter': o valor no fim dos anos escolhidos", () => {
    const s = S({ taxa: 6, patr: 10000, ini: 0, casaPot: false, aps: [{ de: null, v: 0 }], anosVer: 2, metaB: 1000000 });
    const c = contas(s, "ter", BASE);
    expect(c.n).toBe(24);
    perto(c.fim.p, 10000 * 1.06 ** 2, 4);
    expect(c.r).toHaveLength(25);
  });
  it("'quanto guardar pra juntar': o plano chega na meta no prazo", () => {
    const s = S({ metaC: 500000, anosC: 10, patr: 20000, ini: 0 });
    const c = contas(s, "juntar", BASE);
    expect(c.n).toBe(120);
    perto(c.r[120].p / 500000, 1, 6);
  });
});

describe("limparNumeros (números sempre válidos, sem apagar o que não conhece)", () => {
  it("segura cada número dentro do limite", () => {
    const s = limparNumeros({ idade: 5, alvo: 200, taxa: 99, saque: 0, patr: -10, anosVer: 0, anosC: 999, pess: "abc" });
    expect(s.idade).toBe(18);
    expect(s.alvo).toBe(75);
    expect(s.taxa).toBe(8);
    expect(s.saque).toBe(3);
    expect(s.patr).toBe(0);
    expect(s.anosVer).toBe(1);
    expect(s.anosC).toBe(50);
    expect(s.pess).toBe(PRESETS.hoje.pess);
  });
  it("a idade de parar é sempre depois da idade de hoje", () => {
    expect(limparNumeros({ idade: 40, alvo: 30 }).alvo).toBe(41);
    expect(limparNumeros({ idade: 70, alvo: 70 }).alvo).toBe(71);
  });
  it("guarda os campos que não conhece", () => {
    expect(limparNumeros({ ...PRESETS.hoje, doFuturo: "x", preset: "hoje" })).toMatchObject({ doFuturo: "x", preset: "hoje" });
  });
  it("arruma a lista do 'quanto guardo'", () => {
    expect(limparNumeros({ aps: [] }).aps).toEqual(PRESETS.hoje.aps);
    expect(limparNumeros({ aps: [{ de: "2030-01", v: 100 }, { de: "lixo", v: 5 }, { de: "2027-03", v: -9 }] }).aps)
      .toEqual([{ de: null, v: 100 }, { de: "2027-03", v: 0 }]);
  });
  it("lixo vira os números padrão, sem quebrar", () => {
    for (const lixo of [null, undefined, "x", 5, []]) expect(limparNumeros(lixo).idade).toBe(PRESETS.hoje.idade);
  });
  it("limpar duas vezes dá o mesmo resultado", () => {
    const uma = limparNumeros({ idade: 33, alvo: 60, aps: [{ de: null, v: 10 }, { de: "2028-01", v: 20 }] });
    expect(limparNumeros(uma)).toEqual(uma);
  });
});

describe("documento da calculadora", () => {
  it("vazio começa no cenário do prêmio, sem cenários salvos", () => {
    const v = vazioCalc();
    expect(v.atual.preset).toBe("premio");
    expect(v.cenarios).toEqual([]);
    v.atual.idade = 99;
    expect(PRESETS.premio.idade).toBe(30); // mexer no documento não estraga o modelo
  });
  it("normalizar: aceita lixo, guarda o desconhecido e tira cenário sem id", () => {
    expect(normalizarCalc(null).cenarios).toEqual([]);
    expect(normalizarCalc(null).atual.idade).toBe(30);
    const d = normalizarCalc({ doFuturo: 1, cenarios: [{ id: "a", nome: "A" }, null, { nome: "sem id" }], atual: PRESETS.hoje });
    expect(d.doFuturo).toBe(1);
    expect(d.cenarios).toEqual([{ id: "a", nome: "A" }]);
    expect(normalizarCalc({ cenarios: "x" }).cenarios).toEqual([]);
  });
});

describe("'Meus números do Oink' (só leitura)", () => {
  const hoje = new Date(2026, 10, 13);
  const l = (data, tipo, valor, extra = {}) => ({ id: data + valor, data, tipo, valor, ...extra });

  it("média dos 3 últimos meses FECHADOS (o mês atual não entra)", () => {
    const doc = { lancamentos: [
      l("2026-08-05", "receita", 5000), l("2026-08-10", "despesa", 3000),
      l("2026-09-05", "receita", 5000), l("2026-09-10", "despesa", 2000),
      l("2026-10-05", "receita", 5000), l("2026-10-10", "despesa", 4000),
      l("2026-11-05", "despesa", 99999), l("2026-07-05", "despesa", 99999),
    ] };
    expect(mediasMinhasContas(doc, hoje)).toEqual({ gasto: 3000, sobra: 2000, meses: 3 });
  });
  it("'fora da soma' não entra; mês sem lançamento não puxa a média pra baixo", () => {
    const doc = { lancamentos: [
      l("2026-10-05", "receita", 5000), l("2026-10-10", "despesa", 4000), l("2026-10-11", "despesa", 7000, { foraSoma: true }),
    ] };
    expect(mediasMinhasContas(doc, hoje)).toEqual({ gasto: 4000, sobra: 1000, meses: 1 });
  });
  it("sem dados → não responde (nunca inventa)", () => {
    expect(mediasMinhasContas({ lancamentos: [] }, hoje)).toBe(null);
    expect(mediasMinhasContas(null, hoje)).toBe(null);
    expect(mediasMinhasContas({ lancamentos: [l("2026-11-05", "despesa", 10)] }, hoje)).toBe(null);
  });
  it("virada de ano: em janeiro, olha out/nov/dez do ano anterior", () => {
    const doc = { lancamentos: [l("2026-12-10", "despesa", 900), l("2027-01-02", "despesa", 5)] };
    expect(mediasMinhasContas(doc, new Date(2027, 0, 15))).toEqual({ gasto: 900, sobra: -900, meses: 1 });
  });
  it("aportes − resgates por mês, nos 6 últimos meses fechados", () => {
    const doc = { investimentos: [{ movs: [
      { tipo: "aporte", data: "2026-05-10", valor: 600 }, { tipo: "aporte", data: "2026-10-10", valor: 1200 },
      { tipo: "resgate", data: "2026-08-10", valor: 600 }, { tipo: "ajuste", data: "2026-09-10", saldo: 99999 },
      { tipo: "aporte", data: "2026-11-10", valor: 99999 }, { tipo: "aporte", data: "2026-04-30", valor: 99999 },
    ] }] };
    expect(mediaAportes(doc, hoje)).toBe(200);
    expect(mediaAportes({ investimentos: [] }, hoje)).toBe(null);
    expect(mediaAportes(null, hoje)).toBe(null);
  });
  it("preset Oink: usa a carteira e as médias, arredonda de 10 em 10 e não mexe no original", () => {
    const atual = limparNumeros(PRESETS.premio);
    const copia = JSON.stringify(atual);
    const s = presetOink(atual, { patrimonio: 12345.67, medias: { gasto: 3456, sobra: 1234 }, aportes: 999 });
    expect(s.patr).toBe(12346);
    expect(s.ini).toBe(0);
    expect(s.pess).toBe(3460);
    expect(s.aps).toEqual([{ de: null, v: 1230 }]);
    expect(s.casaPot).toBe(false);
    expect(JSON.stringify(atual)).toBe(copia);
  });
  it("preset Oink: sem sobra usa os aportes; sem nada mantém o que estava", () => {
    const atual = limparNumeros(PRESETS.hoje);
    expect(presetOink(atual, { patrimonio: 0, medias: { gasto: 0, sobra: -50 }, aportes: 505 }).aps).toEqual([{ de: null, v: 510 }]);
    const nada = presetOink(atual, { patrimonio: null, medias: null, aportes: null });
    expect(nada.aps).toEqual(atual.aps);
    expect(nada.pess).toBe(atual.pess);
    expect(nada.patr).toBe(0);
  });
});
