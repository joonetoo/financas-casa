// Regras da aba "Minhas contas" (src/pessoal/logica.js).
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  lerValor, totais, criarLancamentos, somaMeses, somaYm, diasNoMes, hojeISO, cent, reais, FIXO_MESES,
  daquiPraFrente, aplicarNasProximas, foraSomaNasProximas, proximasDaSerie, proxMes, normalizar,
  periodoCom, andarPeriodo, somaDias, dentroDo, doPeriodo, doMes, nomeDia, nomeMes, nomePeriodo,
  fmtValor, fmtReais, semAcento,
} from "../src/pessoal/logica.js";

afterEach(() => vi.useRealTimers());

describe("lerValor (dinheiro digitado)", () => {
  const casos = [
    ["1.500", 1500], ["1.234,56", 1234.56], ["12,5", 12.5], ["R$ 12", 12], ["R$ 1.234,56", 1234.56],
    ["1234,56", 1234.56], ["1234.56", 1234.56], ["0,99", 0.99], ["10", 10], ["1.000.000", 1000000],
    ["1.234.567,89", 1234567.89], ["  45,00  ", 45], ["12.5", 12.5], ["1500.5", 1500.5], ["-50", -50], ["0", 0],
    ["-1.500", -1500], ["-1.234,56", -1234.56], ["-R$ 1.500", -1500], ["-12,5", -12.5], ["+7", 7],
    ["0.500", 0.5], ["0,5", 0.5], [",5", 0.5], ["12.", 12], ["6.96", 6.96], ["13,65", 13.65],
  ];
  for (const [txt, n] of casos) it(`"${txt}" → ${n}`, () => expect(lerValor(txt)).toBe(n));

  for (const txt of ["", "   ", "R$", "abc", "12abc", "1,2,3", "1.2.3,4,5", "--5", "1e", ",", "1e3", "1E3", "0x10", "0b11", "Infinity", "-", ".", "1.5.5", "1-2"]) {
    it(`"${txt}" não é valor (NaN)`, () => expect(Number.isNaN(lerValor(txt))).toBe(true));
  }
  it("vazio de verdade (null/undefined) → NaN", () => {
    expect(Number.isNaN(lerValor(null))).toBe(true);
    expect(Number.isNaN(lerValor(undefined))).toBe(true);
  });
  it("aceita número já pronto", () => expect(lerValor(12.5)).toBe(12.5));
  it("nunca devolve infinito", () => expect(Number.isNaN(lerValor("1e999"))).toBe(true));
});

describe("totais", () => {
  const itens = [
    { tipo: "receita", valor: 1000 },
    { tipo: "despesa", valor: 300.1 },
    { tipo: "despesa", valor: 0.2 },
    { tipo: "despesa", valor: 500, foraSoma: true },
    { tipo: "receita", valor: 50, foraSoma: true },
  ];
  it("soma entradas e saídas e pula as contas 'fora da soma'", () => {
    expect(totais(itens)).toEqual({ entradas: 1000, saidas: 300.3, resultado: 699.7 });
  });
  it("lista vazia → tudo zero", () => {
    expect(totais([])).toEqual({ entradas: 0, saidas: 0, resultado: 0 });
  });
  it("não acumula erro de centavos (0,10 + 0,20 = 0,30)", () => {
    expect(totais([{ tipo: "despesa", valor: 0.1 }, { tipo: "despesa", valor: 0.2 }]).saidas).toBe(0.3);
  });
  it("valor estragado conta como zero, sem contaminar o total", () => {
    expect(totais([{ tipo: "despesa", valor: "abc" }, { tipo: "despesa", valor: 10 }]).saidas).toBe(10);
  });
  it("só conta fora da soma → zero", () => {
    expect(totais([{ tipo: "despesa", valor: 99, foraSoma: true }])).toEqual({ entradas: 0, saidas: 0, resultado: 0 });
  });
});

describe("centavos", () => {
  it("vai e volta sem perder", () => {
    expect(cent(12.34)).toBe(1234);
    expect(cent(0.07)).toBe(7);
    expect(cent(1.005)).toBe(100); // limite do ponto flutuante: fica registrado aqui
    expect(reais(1234)).toBe(12.34);
    expect(cent("lixo")).toBe(0);
  });
});

describe("datas", () => {
  it("hojeISO usa a data LOCAL (às 22h no Brasil ainda é hoje)", () => {
    expect(hojeISO(new Date(2026, 10, 13, 22, 30))).toBe("2026-11-13");
    expect(hojeISO(new Date(2026, 0, 1, 0, 0, 1))).toBe("2026-01-01");
    expect(hojeISO(new Date(2026, 11, 31, 23, 59, 59))).toBe("2026-12-31");
  });
  it("dias no mês, com ano bissexto", () => {
    expect(diasNoMes(2026, 2)).toBe(28);
    expect(diasNoMes(2028, 2)).toBe(29);
    expect(diasNoMes(2026, 4)).toBe(30);
    expect(diasNoMes(2026, 12)).toBe(31);
  });
  it("somaMeses: dia 31 vira o último dia em mês curto e volta a ser 31 depois", () => {
    expect(somaMeses("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(somaMeses("2026-01-31", 2, 31)).toBe("2026-03-31");
    expect(somaMeses("2026-01-31", 3, 31)).toBe("2026-04-30");
    expect(somaMeses("2028-01-31", 1, 31)).toBe("2028-02-29");
  });
  it("somaMeses vira o ano, pra frente e pra trás", () => {
    expect(somaMeses("2026-11-15", 2)).toBe("2027-01-15");
    expect(somaMeses("2026-12-10", 1)).toBe("2027-01-10");
    expect(somaMeses("2026-01-10", -1)).toBe("2025-12-10");
    expect(somaYm("2026-12", 1)).toBe("2027-01");
    expect(somaYm("2026-01", -13)).toBe("2024-12");
  });
  it("somaDias atravessa mês, ano e horário de verão sem pular dia", () => {
    expect(somaDias("2026-01-31", 1)).toBe("2026-02-01");
    expect(somaDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somaDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(somaDias("2028-03-01", -1)).toBe("2028-02-29");
    expect(somaDias("2026-11-13", 365)).toBe("2027-11-13");
  });
  it("proxMes: mesmo dia, ou o último dia do mês seguinte", () => {
    expect(proxMes({ id: "a", data: "2026-01-31" }).data).toBe("2026-02-28");
    expect(proxMes({ id: "a", data: "2026-12-05" }).data).toBe("2027-01-05");
  });
  it("nomes", () => {
    expect(nomeMes("2026-03")).toBe("Março 2026");
    expect(nomeDia("2026-11-13")).toBe("Sex, 13 de novembro");
  });
});

describe("criarLancamentos", () => {
  const base = { tipo: "despesa", desc: "  Internet ", valor: 100, data: "2026-01-31", catId: "c1", obs: "", pago: true };

  it("avulso: um só, com o que foi digitado", () => {
    const r = criarLancamentos({ ...base });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tipo: "despesa", desc: "Internet", valor: 100, data: "2026-01-31", catId: "c1", pago: true });
    expect(r[0].serie).toBeUndefined();
    expect(r[0].id).toBeTruthy();
  });
  it("sem nome vira 'Despesa' / 'Receita'", () => {
    expect(criarLancamentos({ ...base, desc: "" })[0].desc).toBe("Despesa");
    expect(criarLancamentos({ ...base, desc: " ", tipo: "receita" })[0].desc).toBe("Receita");
  });

  it("fixo: 36 meses, mesmo valor, só o primeiro pago, dia 31 respeitando meses curtos", () => {
    const r = criarLancamentos({ ...base, repetir: "fixo" });
    expect(r).toHaveLength(FIXO_MESES);
    expect(r.slice(0, 4).map((l) => l.data)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(r[35].data).toBe("2028-12-31");
    expect(r.every((l) => l.valor === 100)).toBe(true);
    expect(r.map((l) => l.pago)).toEqual([true, ...Array(35).fill(false)]);
    expect(new Set(r.map((l) => l.serie.id)).size).toBe(1);
    expect(new Set(r.map((l) => l.id)).size).toBe(36);
    expect(r[0].serie).toMatchObject({ tipo: "fixo", dia: 31 });
  });

  it("parcelado pelo TOTAL: divide e os centavos que sobram vão na 1ª; a soma bate", () => {
    const r = criarLancamentos({ ...base, valor: 100, repetir: "parcela", parcelas: 3, modoValor: "total" });
    expect(r.map((l) => l.valor)).toEqual([33.34, 33.33, 33.33]);
    expect(totais(r).saidas).toBe(100);
    expect(r.map((l) => [l.serie.n, l.serie.total])).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(r.map((l) => l.pago)).toEqual([true, false, false]);
  });
  it("parcelado POR PARCELA: cada uma com o valor digitado", () => {
    const r = criarLancamentos({ ...base, valor: 49.9, repetir: "parcela", parcelas: 12, modoValor: "parcela" });
    expect(r).toHaveLength(12);
    expect(r.every((l) => l.valor === 49.9)).toBe(true);
    expect(r[11].data).toBe("2026-12-31");
  });
  it("número de parcelas fora do normal é contido (mínimo 2, máximo 120)", () => {
    expect(criarLancamentos({ ...base, repetir: "parcela", parcelas: 1 })).toHaveLength(2);
    expect(criarLancamentos({ ...base, repetir: "parcela", parcelas: "abc" })).toHaveLength(2);
    expect(criarLancamentos({ ...base, repetir: "parcela", parcelas: 999 })).toHaveLength(120);
  });
  it("total com muitas casas: a soma das parcelas continua igual ao total", () => {
    for (const [valor, n] of [[1000, 7], [0.05, 3], [199.99, 12], [1, 3]]) {
      const r = criarLancamentos({ ...base, valor, repetir: "parcela", parcelas: n, modoValor: "total" });
      expect(totais(r).saidas).toBe(valor);
    }
  });
});

describe("séries: 'só este' × 'este e os próximos'", () => {
  const serie = () => criarLancamentos({ tipo: "despesa", desc: "Luz", valor: 100, data: "2026-01-10", catId: "c1", repetir: "fixo" }).slice(0, 5);
  const avulso = { id: "x", tipo: "despesa", desc: "Avulso", valor: 7, data: "2026-02-10" };

  it("proximasDaSerie: só as DEPOIS desta, da mesma série", () => {
    const s = serie();
    const lancs = [...s, avulso];
    expect(proximasDaSerie(lancs, s[2]).map((l) => l.data)).toEqual(["2026-04-10", "2026-05-10"]);
    expect(proximasDaSerie(lancs, s[4])).toEqual([]);
    expect(proximasDaSerie(lancs, avulso)).toEqual([]);
  });
  it("daquiPraFrente: esta e as próximas, em ordem", () => {
    const s = serie();
    expect(daquiPraFrente([...s].reverse(), s[3]).map((l) => l.data)).toEqual(["2026-04-10", "2026-05-10"]);
    expect(daquiPraFrente([avulso], avulso)).toEqual([avulso]);
  });

  it("aplicarNasProximas muda só as de depois; as de antes e as de fora ficam idênticas", () => {
    const s = serie();
    const lancs = [...s, avulso];
    const editado = { ...s[2], desc: "Luz nova", valor: 150, catId: "c2", obs: "subiu" };
    const lancsComEdicao = lancs.map((l) => (l.id === editado.id ? editado : l));
    const r = aplicarNasProximas(lancsComEdicao, editado);
    expect(r[0]).toBe(lancsComEdicao[0]);
    expect(r[1]).toBe(lancsComEdicao[1]);
    expect(r[5]).toBe(avulso);
    expect(r.slice(3, 5).map((l) => [l.desc, l.valor, l.catId, l.obs, l.data])).toEqual([
      ["Luz nova", 150, "c2", "subiu", "2026-04-10"], ["Luz nova", 150, "c2", "subiu", "2026-05-10"],
    ]);
    expect(r).toHaveLength(lancs.length);
  });
  it("aplicarNasProximas não mexe no 'pago' nem no mês das próximas", () => {
    const s = serie();
    s[3] = { ...s[3], pago: true };
    const editado = { ...s[1], valor: 80 };
    const r = aplicarNasProximas(s.map((l) => (l.id === editado.id ? editado : l)), editado);
    expect(r[3].pago).toBe(true);
    expect(r.map((l) => l.data.slice(0, 7))).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]);
  });
  it("mudar o dia pra 31 respeita os meses curtos nas próximas", () => {
    const s = serie();
    const editado = { ...s[0], data: "2026-01-31" };
    const r = aplicarNasProximas(s.map((l) => (l.id === editado.id ? editado : l)), editado);
    expect(r.map((l) => l.data)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });
  it("lançamento sem série: nada muda", () => {
    const lancs = [avulso];
    expect(aplicarNasProximas(lancs, avulso)).toBe(lancs);
    expect(foraSomaNasProximas(lancs, avulso, true)).toBe(lancs);
  });

  it("foraSomaNasProximas muda SÓ esse campo, só nas próximas — e dá pra voltar", () => {
    const s = serie();
    const lancs = [...s, avulso];
    const fora = foraSomaNasProximas(lancs, s[1], true);
    expect(fora.map((l) => !!l.foraSoma)).toEqual([false, false, true, true, true, false]);
    for (let i = 2; i < 5; i++) {
      const { foraSoma, ...resto } = fora[i];
      expect(resto).toEqual(s[i]); // nome, valor, data, série: iguais
    }
    const devolta = foraSomaNasProximas(fora, s[1], false);
    expect(devolta).toEqual(lancs);
    expect(devolta.some((l) => "foraSoma" in l)).toBe(false);
  });
});

describe("períodos (a semana vai de segunda a domingo)", () => {
  it("semana de uma sexta", () => {
    expect(periodoCom("semana", "2026-11-13")).toEqual({ tipo: "semana", de: "2026-11-09", ate: "2026-11-15" });
  });
  it("segunda é o primeiro dia, domingo é o último da MESMA semana", () => {
    expect(periodoCom("semana", "2026-11-09")).toEqual({ tipo: "semana", de: "2026-11-09", ate: "2026-11-15" });
    expect(periodoCom("semana", "2026-11-15")).toEqual({ tipo: "semana", de: "2026-11-09", ate: "2026-11-15" });
    expect(periodoCom("semana", "2026-11-16").de).toBe("2026-11-16");
  });
  it("semana que atravessa o mês e o ano", () => {
    expect(periodoCom("semana", "2026-12-31")).toEqual({ tipo: "semana", de: "2026-12-28", ate: "2027-01-03" });
    expect(periodoCom("semana", "2027-01-01")).toEqual({ tipo: "semana", de: "2026-12-28", ate: "2027-01-03" });
  });
  it("dia e mês", () => {
    expect(periodoCom("dia", "2026-11-13")).toEqual({ tipo: "dia", de: "2026-11-13", ate: "2026-11-13" });
    expect(periodoCom("mes", "2026-02-10")).toEqual({ tipo: "mes", de: "2026-02-01", ate: "2026-02-28" });
    expect(periodoCom("mes", "2028-02-10").ate).toBe("2028-02-29");
  });
  it("andar pra frente e pra trás", () => {
    expect(andarPeriodo(periodoCom("mes", "2026-12-10"), 1)).toEqual({ tipo: "mes", de: "2027-01-01", ate: "2027-01-31" });
    expect(andarPeriodo(periodoCom("mes", "2026-01-10"), -1)).toEqual({ tipo: "mes", de: "2025-12-01", ate: "2025-12-31" });
    expect(andarPeriodo(periodoCom("semana", "2026-11-13"), 1)).toEqual({ tipo: "semana", de: "2026-11-16", ate: "2026-11-22" });
    expect(andarPeriodo(periodoCom("semana", "2026-11-13"), -1)).toEqual({ tipo: "semana", de: "2026-11-02", ate: "2026-11-08" });
    expect(andarPeriodo(periodoCom("dia", "2026-02-28"), 1).de).toBe("2026-03-01");
    expect(andarPeriodo({ tipo: "intervalo", de: "2026-11-01", ate: "2026-11-10" }, 1)).toEqual({ tipo: "intervalo", de: "2026-11-11", ate: "2026-11-20" });
    expect(andarPeriodo({ tipo: "intervalo", de: "2026-11-01", ate: "2026-11-10" }, -1)).toEqual({ tipo: "intervalo", de: "2026-10-22", ate: "2026-10-31" });
  });
  it("dentroDo inclui as duas pontas", () => {
    const p = periodoCom("semana", "2026-11-13");
    expect(dentroDo(p, "2026-11-09")).toBe(true);
    expect(dentroDo(p, "2026-11-15")).toBe(true);
    expect(dentroDo(p, "2026-11-08")).toBe(false);
    expect(dentroDo(p, "2026-11-16")).toBe(false);
  });
  it("nomes dos períodos", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 13, 12) });
    expect(nomePeriodo(periodoCom("mes", "2026-11-13"))).toBe("novembro 2026");
    expect(nomePeriodo(periodoCom("dia", "2026-11-13"))).toBe("sex, 13 nov");
    expect(nomePeriodo(periodoCom("semana", "2026-11-13"))).toBe("9–15 nov");
    expect(nomePeriodo(periodoCom("semana", "2026-12-31"))).toBe("28 dez – 3 jan 2027");
  });
});

describe("listas", () => {
  const l = (id, data, tipo = "despesa") => ({ id, data, tipo, valor: 1 });
  const lancs = [l("a", "2026-11-10"), l("b", "2026-11-05"), l("c", "2026-11-10", "receita"), l("d", "2026-12-01"), l("e", "2026-11-10")];
  it("doMes: por data; no mesmo dia receita primeiro, depois a ordem de lançamento", () => {
    expect(doMes(lancs, "2026-11").map((x) => x.id)).toEqual(["b", "c", "a", "e"]);
  });
  it("doPeriodo crescente e decrescente (dentro do dia mantém a ordem)", () => {
    const p = { tipo: "intervalo", de: "2026-11-05", ate: "2026-12-01" };
    expect(doPeriodo(lancs, p).map((x) => x.id)).toEqual(["b", "c", "a", "e", "d"]);
    expect(doPeriodo(lancs, p, "decrescente").map((x) => x.id)).toEqual(["d", "c", "a", "e", "b"]);
  });
  it("não mexe na lista original", () => {
    const copia = JSON.stringify(lancs);
    doMes(lancs, "2026-11");
    doPeriodo(lancs, periodoCom("mes", "2026-11-01"), "decrescente");
    expect(JSON.stringify(lancs)).toBe(copia);
  });
});

describe("normalizar (dados antigos/importados)", () => {
  it("só acrescenta o que falta, sem apagar campos que não conhece", () => {
    expect(normalizar({})).toEqual({ v: 1, categorias: [], lancamentos: [] });
    expect(normalizar(null)).toEqual({ v: 1, categorias: [], lancamentos: [] });
    const doc = { v: 1, categorias: [{ id: "c" }], lancamentos: [{ id: "l" }], campoDoFuturo: { x: 1 } };
    expect(normalizar(doc)).toEqual(doc);
  });
});

describe("texto", () => {
  it("dinheiro no formato brasileiro", () => {
    expect(fmtValor(1234.5)).toBe("1.234,50");
    expect(fmtReais(0)).toBe("R$ 0,00");
  });
  it("lerValor entende o que fmtValor escreve", () => {
    for (const v of [0.01, 12.5, 1500, 1234.56, 1234567.89]) expect(lerValor(fmtReais(v))).toBe(v);
  });
  it("busca sem acento nem maiúscula", () => {
    expect(semAcento("  Açúcar ÓTIMO ")).toBe("acucar otimo");
    expect(semAcento(null)).toBe("");
  });
});
