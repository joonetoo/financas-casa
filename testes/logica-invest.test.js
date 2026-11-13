// Contas da aba Investimentos (src/invest/logica.js). Tudo aqui é cálculo —
// nenhuma taxa é buscada na internet: os testes inventam as taxas.
import { describe, it, expect } from "vitest";
import {
  vazio, normalizar, diasEntre, fimDoMes, somaMesYm, brData, mesCurto, aliquotaIR, faixaIR,
  precoTesouro, qtdDoMov, simular, primeiraData, calcularCarteira, evolucao, progressoMetas,
  fmt, fmtSinal, fmtPct, fmtQtd, lerNumero,
} from "../src/invest/logica.js";

const perto = (a, b) => expect(a).toBeCloseTo(b, 6);
// 5 dias úteis rendendo 0,1% ao dia
const CDI = [["2026-01-05", 0.1], ["2026-01-06", 0.1], ["2026-01-07", 0.1], ["2026-01-08", 0.1], ["2026-01-09", 0.1]];
const mercado = { cdi: CDI, selic: CDI };
const aporte = (data, valor, extra = {}) => ({ id: "m" + data + valor, tipo: "aporte", data, valor, ...extra });
const cdb = (movs, extra = {}) => ({ id: "i1", tipo: "cdi", nome: "Caixinha", pct: 100, movs, ...extra });

describe("datas", () => {
  it("dias entre duas datas (sem errar com horário de verão/fuso)", () => {
    expect(diasEntre("2026-01-01", "2026-01-01")).toBe(0);
    expect(diasEntre("2026-01-01", "2026-12-31")).toBe(364);
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2);
    expect(diasEntre("2026-03-01", "2026-02-28")).toBe(-1);
  });
  it("fim do mês e soma de meses", () => {
    expect(fimDoMes("2026-02")).toBe("2026-02-28");
    expect(fimDoMes("2028-02")).toBe("2028-02-29");
    expect(fimDoMes("2026-12")).toBe("2026-12-31");
    expect(somaMesYm("2026-12", 1)).toBe("2027-01");
    expect(somaMesYm("2026-01", -1)).toBe("2025-12");
    expect(somaMesYm("2026-05", 20)).toBe("2028-01");
    expect(somaMesYm("2026-05", -17)).toBe("2024-12");
    expect(somaMesYm("2026-05", 0)).toBe("2026-05");
  });
  it("texto de data", () => {
    expect(brData("2026-11-13")).toBe("13/11/2026");
    expect(brData("")).toBe("");
    expect(mesCurto("2026-03")).toBe("mar");
  });
});

describe("Imposto de Renda (tabela regressiva)", () => {
  it("as viradas de faixa caem no dia certo", () => {
    expect(aliquotaIR(0)).toBe(0.225);
    expect(aliquotaIR(180)).toBe(0.225);
    expect(aliquotaIR(181)).toBe(0.2);
    expect(aliquotaIR(360)).toBe(0.2);
    expect(aliquotaIR(361)).toBe(0.175);
    expect(aliquotaIR(720)).toBe(0.175);
    expect(aliquotaIR(721)).toBe(0.15);
    expect(faixaIR(181)).toContain("20%");
  });
});

describe("documento", () => {
  it("normalizar só acrescenta o que falta e guarda o que não conhece", () => {
    expect(normalizar(null)).toEqual(vazio());
    expect(normalizar({ investimentos: [{ id: "a" }], doFuturo: 1 })).toEqual({ v: 1, investimentos: [{ id: "a", movs: [] }], metas: [], doFuturo: 1 });
    expect(normalizar({ investimentos: "x", metas: null })).toEqual(vazio());
  });
});

describe("simular: caixinha / CDB", () => {
  it("sem taxas: fica no que foi guardado e avisa (nunca inventa rendimento)", () => {
    const r = simular(cdb([aporte("2026-01-05", 1000)]), {}, "2026-06-01");
    expect(r.bruto).toBe(1000);
    expect(r.custo).toBe(1000);
    expect(r.ganho).toBe(0);
    expect(r.ir).toBe(0);
    expect(r.semTaxa).toBe(true);
  });
  it("rende a taxa de cada dia útil, composta", () => {
    const r = simular(cdb([aporte("2026-01-05", 1000)]), mercado, "2026-01-12");
    perto(r.bruto, 1000 * 1.001 ** 5);
    expect(r.custo).toBe(1000);
    expect(r.semTaxa).toBe(false);
  });
  it("200% do CDI rende o dobro da taxa do dia", () => {
    const r = simular(cdb([aporte("2026-01-05", 1000)], { pct: 200 }), mercado, "2026-01-12");
    perto(r.bruto, 1000 * 1.002 ** 5);
  });
  it("o dia do aporte só rende a partir dele (aporte no meio da série)", () => {
    const r = simular(cdb([aporte("2026-01-08", 1000)]), mercado, "2026-01-12");
    perto(r.bruto, 1000 * 1.001 ** 2);
  });
  it("o que foi lançado depois do dia consultado não entra", () => {
    const r = simular(cdb([aporte("2026-01-05", 1000), aporte("2026-03-01", 5000)]), mercado, "2026-02-01");
    expect(r.custo).toBe(1000);
  });
  it("imposto: IOF nos primeiros 29 dias e IR sobre o que sobra do ganho", () => {
    const r = simular(cdb([aporte("2026-01-05", 1000)]), mercado, "2026-01-12"); // 7 dias
    const ganho = 1000 * 1.001 ** 5 - 1000;
    perto(r.iof, ganho * 0.76);
    perto(r.ir, (ganho - ganho * 0.76) * 0.225);
    perto(r.liquido, r.bruto - r.ir - r.iof);
    expect(r.diasMaisVelho).toBe(7);
  });
  it("depois de 30 dias não tem mais IOF; depois de 2 anos o IR é 15%", () => {
    const r = simular(cdb([aporte("2026-01-05", 1000)]), mercado, "2028-06-01");
    expect(r.iof).toBe(0);
    perto(r.ir, (1000 * 1.001 ** 5 - 1000) * 0.15);
  });
  it("sem ganho não tem imposto", () => {
    const r = simular(cdb([aporte("2026-01-09", 1000)]), { cdi: [["2026-01-09", 0]] }, "2026-01-20");
    expect(r.ir).toBe(0);
    expect(r.iof).toBe(0);
  });

  it("resgate tira do dinheiro guardado", () => {
    const r = simular(cdb([aporte("2026-01-05", 1000), { id: "r", tipo: "resgate", data: "2026-02-01", valor: 400 }]), {}, "2026-03-01");
    perto(r.bruto, 600);
    perto(r.custo, 600);
  });
  it("resgate sai do aporte mais antigo primeiro", () => {
    const inv = cdb([aporte("2026-01-05", 1000), aporte("2026-06-01", 1000), { id: "r", tipo: "resgate", data: "2026-07-01", valor: 1000 }]);
    const r = simular(inv, {}, "2026-08-01");
    perto(r.bruto, 1000);
    expect(r.diasMaisVelho).toBe(diasEntre("2026-06-01", "2026-08-01"));
  });
  it("resgatar tudo zera; resgatar mais do que tem nunca deixa negativo", () => {
    const tudo = simular(cdb([aporte("2026-01-05", 1000), { id: "r", tipo: "resgate", data: "2026-02-01", valor: 1000 }]), {}, "2026-03-01");
    perto(tudo.bruto, 0);
    perto(tudo.custo, 0);
    const demais = simular(cdb([aporte("2026-01-05", 1000), { id: "r", tipo: "resgate", data: "2026-02-01", valor: 5000 }]), {}, "2026-03-01");
    perto(demais.bruto, 0);
    expect(demais.bruto).toBeGreaterThanOrEqual(0);
  });
  it("'ajustar com o banco' corrige o saldo sem mudar o quanto foi guardado", () => {
    const r = simular(cdb([aporte("2026-01-05", 1000), { id: "a", tipo: "ajuste", data: "2026-02-01", saldo: 1100 }]), {}, "2026-03-01");
    perto(r.bruto, 1100);
    perto(r.custo, 1000);
    perto(r.ganho, 100);
    perto(r.eventos[1].diferenca, 100);
  });
  it("ajuste num investimento vazio vira saldo com custo zero", () => {
    const r = simular(cdb([{ id: "a", tipo: "ajuste", data: "2026-02-01", saldo: 500 }]), {}, "2026-03-01");
    perto(r.bruto, 500);
    perto(r.custo, 0);
  });
  it("registros fora de ordem dão o mesmo resultado", () => {
    const movs = [aporte("2026-01-05", 1000), { id: "r", tipo: "resgate", data: "2026-01-07", valor: 300 }, aporte("2026-01-08", 200)];
    const a = simular(cdb(movs), mercado, "2026-01-12");
    const b = simular(cdb([...movs].reverse()), mercado, "2026-01-12");
    perto(a.bruto, b.bruto);
    perto(a.custo, b.custo);
  });
  it("não muda os dados guardados (é só conta)", () => {
    const inv = cdb([aporte("2026-01-05", 1000), { id: "r", tipo: "resgate", data: "2026-01-07", valor: 300 }, { id: "a", tipo: "ajuste", data: "2026-01-08", saldo: 800 }]);
    const copia = JSON.stringify(inv);
    simular(inv, mercado, "2026-01-12");
    expect(JSON.stringify(inv)).toBe(copia);
  });
  it("investimento sem nenhum registro: tudo zero", () => {
    const r = simular(cdb([]), mercado, "2026-01-12");
    expect([r.bruto, r.custo, r.ganho, r.ir, r.iof, r.liquido, r.diasMaisVelho]).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("Tesouro IPCA+ / Renda+ (vale quantidade × preço)", () => {
  const tesouro = { data: "2026-11-10", titulos: { "IPCA|2035-05-15": { pu: 2000, meses: { "2026-01": 1000, "2026-06": 1500 } } } };
  const chave = "IPCA|2035-05-15";
  const ipca = (movs) => ({ id: "t", tipo: "ipca", nome: "IPCA", titulo: chave, movs });

  it("preço: hoje → o mais novo; mês passado → o do mês; antes do histórico → o mais antigo que cobre", () => {
    expect(precoTesouro(tesouro, chave, "2026-11-13")).toBe(2000);
    expect(precoTesouro(tesouro, chave, "2026-06-20")).toBe(1500);
    expect(precoTesouro(tesouro, chave, "2026-03-20")).toBe(1000);
    expect(precoTesouro(tesouro, chave, "2025-12-01")).toBe(null);
    expect(precoTesouro(tesouro, "OUTRO", "2026-11-13")).toBe(null);
    expect(precoTesouro(undefined, chave, "2026-11-13")).toBe(null);
  });
  it("quantidade: a digitada, ou estimada pelo preço do mês", () => {
    expect(qtdDoMov({ data: "2026-01-15", valor: 1000, qtd: 0.5 }, ipca([]), tesouro)).toEqual({ qtd: 0.5, estimada: false });
    expect(qtdDoMov({ data: "2026-01-15", valor: 1000 }, ipca([]), tesouro)).toEqual({ qtd: 1, estimada: true });
    expect(qtdDoMov({ data: "2025-01-15", valor: 1000 }, ipca([]), tesouro)).toEqual({ qtd: 0, estimada: true });
  });
  it("valor de hoje = quantidade × preço de hoje", () => {
    const r = simular(ipca([aporte("2026-01-15", 1000, { qtd: 0.5 })]), { tesouro }, "2026-11-13");
    perto(r.bruto, 1000);
    perto(r.qtd, 0.5);
    expect(r.qtdEstimada).toBe(false);
  });
  it("sem a quantidade, estima e avisa que é estimativa", () => {
    const r = simular(ipca([aporte("2026-01-15", 1000)]), { tesouro }, "2026-11-13");
    perto(r.bruto, 2000);
    expect(r.qtdEstimada).toBe(true);
  });
  it("sem preços: fica no que foi guardado e avisa", () => {
    const r = simular(ipca([aporte("2026-01-15", 1000, { qtd: 0.5 })]), {}, "2026-11-13");
    perto(r.bruto, 1000);
    expect(r.semTaxa).toBe(true);
  });
});

describe("a carteira toda", () => {
  const doc = {
    v: 1,
    metas: [{ id: "meta1", nome: "Reserva", alvo: 4000 }, { id: "meta2", nome: "Sem alvo", alvo: 0 }, { id: "meta3", nome: "Pequena", alvo: 100 }],
    investimentos: [
      { id: "a", tipo: "cdi", nome: "A", pct: 100, metaId: "meta1", movs: [aporte("2026-01-05", 1000)] },
      { id: "b", tipo: "cdi", nome: "B", pct: 100, metaId: "meta1", movs: [aporte("2026-02-10", 2000)] },
      { id: "c", tipo: "selic", nome: "C", metaId: "meta3", movs: [aporte("2026-03-10", 500)] },
      { id: "d", tipo: "cdi", nome: "Arquivado", arquivado: true, movs: [aporte("2025-01-01", 99999)] },
    ],
  };
  it("soma só os ativos (arquivado fica de fora)", () => {
    const c = calcularCarteira(doc, {}, "2026-11-13");
    expect(c.itens.map((x) => x.inv.id)).toEqual(["a", "b", "c"]);
    perto(c.bruto, 3500);
    perto(c.custo, 3500);
    perto(c.ganho, 0);
    expect(c.pct).toBe(0);
    expect(c.semTaxa).toBe(true);
    expect(c.vsCDI).toBe(null);
  });
  it("grupos por tipo, com o maior investimento primeiro e a fatia de cada grupo", () => {
    const c = calcularCarteira(doc, {}, "2026-11-13");
    expect(c.grupos.map((g) => g.tipo)).toEqual(["cdi", "selic"]);
    expect(c.grupos[0].itens.map((x) => x.inv.id)).toEqual(["b", "a"]);
    perto(c.grupos[0].pct, 3000 / 3500);
    perto(c.grupos[0].pct + c.grupos[1].pct, 1);
  });
  it("'este mês' não conta como rendimento o dinheiro que entrou no mês", () => {
    const c = calcularCarteira({ v: 1, metas: [], investimentos: [cdb([aporte("2026-10-05", 1000), aporte("2026-11-03", 500)])] }, {}, "2026-11-13");
    perto(c.esteMes, 0);
  });
  it("carteira vazia: zeros, sem dividir por zero", () => {
    const c = calcularCarteira(vazio(), {}, "2026-11-13");
    expect([c.bruto, c.custo, c.ganho, c.pct, c.liquido, c.esteMes]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(c.grupos).toEqual([]);
    expect(primeiraData(vazio())).toBe(null);
    expect(evolucao(vazio(), {}, "2026-11-13")).toEqual([]);
  });
  it("com taxas: ganho e porcentagem batem com a conta", () => {
    const c = calcularCarteira({ v: 1, metas: [], investimentos: [cdb([aporte("2026-01-05", 1000)])] }, mercado, "2026-01-12");
    perto(c.ganho, 1000 * 1.001 ** 5 - 1000);
    perto(c.pct, 1.001 ** 5 - 1);
    perto(c.vsCDI, 100); // 100% do CDI rende igual ao CDI
  });
  it("metas: soma os investimentos ligados; nunca passa de 100%; alvo zero não divide", () => {
    const c = calcularCarteira(doc, {}, "2026-11-13");
    const [m1, m2, m3] = progressoMetas(doc, c);
    perto(m1.valor, 3000);
    perto(m1.pct, 0.75);
    expect(m1.qtd).toBe(2);
    expect(m2.pct).toBe(0);
    expect(m3.pct).toBe(1);
  });
  it("evolução: um ponto por mês, da primeira data até hoje", () => {
    const pontos = evolucao(doc, {}, "2026-04-15");
    expect(pontos.map((p) => p.ym)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(pontos.map((p) => p.guardado)).toEqual([1000, 3000, 3500, 3500]);
    expect(primeiraData(doc)).toBe("2026-01-05");
  });
});

describe("números na tela", () => {
  it("formatos", () => {
    expect(fmt(1234.5)).toBe("1.234,50");
    expect(fmt("lixo")).toBe("0,00");
    expect(fmtSinal(10)).toBe("+10,00");
    expect(fmtSinal(-10)).toBe("−10,00");
    expect(fmtSinal(-0.001)).toBe("+0,00");
    expect(fmtPct(0.1234)).toBe("+12,3%");
    expect(fmtPct(-0.05, 2)).toBe("−5,00%");
    expect(fmtQtd(1.23456)).toBe("1,2346");
  });
  it("lerNumero entende vírgula e ponto", () => {
    expect(lerNumero("1.234,56")).toBe(1234.56);
    expect(lerNumero("1234,56")).toBe(1234.56);
    expect(lerNumero("1234.56")).toBe(1234.56);
    expect(lerNumero("R$ 50")).toBe(50);
    expect(lerNumero(12.5)).toBe(12.5);
    expect(Number.isNaN(lerNumero(""))).toBe(true);
    expect(Number.isNaN(lerNumero(null))).toBe(true);
  });
  it('"1.500" é mil e quinhentos (antes era lido como 1,5)', () => {
    expect(lerNumero("1.500")).toBe(1500);
    expect(lerNumero("R$ 1.500")).toBe(1500);
    expect(lerNumero("12.345.678")).toBe(12345678);
    expect(lerNumero("-1.500")).toBe(-1500);
  });
  it("continua aceitando o que já aceitava: porcentagens e ponto decimal", () => {
    expect(lerNumero("13,65")).toBe(13.65);
    expect(lerNumero("6.96")).toBe(6.96);
    expect(lerNumero("110%")).toBe(110);
    expect(lerNumero("110 %")).toBe(110);
    expect(lerNumero("0,10")).toBe(0.1);
    expect(lerNumero("0.125")).toBe(0.125);
    expect(lerNumero("100")).toBe(100);
    expect(lerNumero("1,2346")).toBe(1.2346);
  });
  it("entende o que o próprio app escreve nos campos (fmt e fmtQtd)", () => {
    for (const v of [0.01, 12.5, 1500, 1234.56, 1234567.89]) expect(lerNumero(fmt(v))).toBe(v);
    expect(lerNumero(fmtQtd(1234.5678))).toBe(1234.5678);
  });
  it("o que não é número dá NaN (em vez de virar outro número calado)", () => {
    for (const t of ["abc", "12abc", "1e3", "0x10", "1,2,3", "--5"]) expect(Number.isNaN(lerNumero(t))).toBe(true);
  });
});
