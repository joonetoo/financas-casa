// As decisões pequenas da sincronização (src/sinc.js), uma por uma.
import { describe, it, expect, vi } from "vitest";
import {
  mesmoInstante, igualJson, acharMinhaGravacao, lembrarTentativa, decidirLinhaLida,
  casaValida, legadoValido, idDaCopiaDeConflito, comLimiteOuErro, comSinal, erroDeGravacao,
  podeTerChegado, valorDoCampoEditavel, LIMITE_GRAVACAO_MS,
} from "../src/sinc.js";

describe("mesmoInstante", () => {
  it("o ISO que o app manda e o formato que o banco devolve são o mesmo momento", () => {
    expect(mesmoInstante("2026-11-13T12:00:00.123Z", "2026-11-13T12:00:00.123+00:00")).toBe(true);
    expect(mesmoInstante("2026-11-13T12:00:00.123Z", "2026-11-13T09:00:00.123-03:00")).toBe(true);
    expect(mesmoInstante("2026-11-13T12:00:00.120Z", "2026-11-13T12:00:00.12+00:00")).toBe(true);
  });
  it("um milésimo de diferença já não é o mesmo", () => {
    expect(mesmoInstante("2026-11-13T12:00:00.123Z", "2026-11-13T12:00:00.124+00:00")).toBe(false);
  });
  it("vazio ou lixo nunca é igual (nem a ele mesmo)", () => {
    expect(mesmoInstante(null, null)).toBe(false);
    expect(mesmoInstante("", "2026-11-13T12:00:00Z")).toBe(false);
    expect(mesmoInstante("lixo", "lixo")).toBe(false);
  });
});

describe("igualJson", () => {
  it("a ordem das chaves não importa; a ordem das listas importa", () => {
    expect(igualJson({ a: 1, b: { c: [1, 2], d: "x" } }, { b: { d: "x", c: [1, 2] }, a: 1 })).toBe(true);
    expect(igualJson({ l: [1, 2] }, { l: [2, 1] })).toBe(false);
  });
  it("percebe qualquer diferença", () => {
    expect(igualJson({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(igualJson({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(igualJson({ a: 1 }, { a: "1" })).toBe(false);
    expect(igualJson({ a: null }, { a: {} })).toBe(false);
    expect(igualJson([], {})).toBe(false);
    expect(igualJson({ a: [1, 2, 3] }, { a: [1, 2] })).toBe(false);
    expect(igualJson({ a: 0.1 + 0.2 }, { a: 0.3 })).toBe(false);
  });
  it("valores simples", () => {
    expect(igualJson(1, 1)).toBe(true);
    expect(igualJson("a", "a")).toBe(true);
    expect(igualJson(null, null)).toBe(true);
    expect(igualJson(null, 0)).toBe(false);
  });
});

describe("acharMinhaGravacao (é a minha própria gravação?)", () => {
  const doc = { v: 1, itens: [{ id: "a", valor: 12.5, obs: undefined }], nome: "x" };
  const tentativas = [
    { carimbo: "2026-11-13T12:00:00.000Z", doc: { v: 1, itens: [] } },
    { carimbo: "2026-11-13T12:00:05.000Z", doc },
  ];
  // como o banco devolve: outro formato de carimbo, chaves em outra ordem, sem os `undefined`
  const daNuvem = { nome: "x", itens: [{ valor: 12.5, id: "a" }], v: 1 };

  it("mesmo carimbo E mesmo conteúdo → é minha", () => {
    expect(acharMinhaGravacao(tentativas, { updatedAt: "2026-11-13T12:00:05+00:00", value: daNuvem })).toBe(tentativas[1]);
  });
  it("reconhece também uma tentativa mais antiga que chegou atrasada", () => {
    expect(acharMinhaGravacao(tentativas, { updatedAt: "2026-11-13T12:00:00+00:00", value: { itens: [], v: 1 } })).toBe(tentativas[0]);
  });
  it("mesmo carimbo mas conteúdo diferente → NÃO é minha", () => {
    expect(acharMinhaGravacao(tentativas, { updatedAt: "2026-11-13T12:00:05+00:00", value: { ...daNuvem, nome: "y" } })).toBe(null);
  });
  it("mesmo conteúdo mas outro carimbo (outro aparelho gravou) → NÃO é minha", () => {
    expect(acharMinhaGravacao(tentativas, { updatedAt: "2026-11-13T12:00:06+00:00", value: daNuvem })).toBe(null);
  });
  it("sem tentativas, linha vazia ou sem carimbo → nunca é minha", () => {
    expect(acharMinhaGravacao([], { updatedAt: "2026-11-13T12:00:05+00:00", value: daNuvem })).toBe(null);
    expect(acharMinhaGravacao(tentativas, { updatedAt: "2026-11-13T12:00:05+00:00", value: null })).toBe(null);
    expect(acharMinhaGravacao(tentativas, { updatedAt: null, value: daNuvem })).toBe(null);
    expect(acharMinhaGravacao(tentativas, null)).toBe(null);
    expect(acharMinhaGravacao(undefined, { updatedAt: "x", value: {} })).toBe(null);
  });
});

describe("lembrarTentativa (guarda por documento)", () => {
  const iso = (seg) => new Date(Date.UTC(2026, 10, 13, 12, 0, seg)).toISOString();

  it("repetir o MESMO documento não cria entrada nova: só junta o carimbo", () => {
    const doc = { v: 1, itens: ["a"] };
    let l = [];
    for (let i = 0; i < 5; i++) l = lembrarTentativa(l, { carimbo: iso(i), doc });
    expect(l).toHaveLength(1);
    expect(l[0].doc).toBe(doc);
    expect(l[0].carimbos).toEqual([0, 1, 2, 3, 4].map(iso));
  });

  it("mesmo conteúdo em outro objeto também conta como o mesmo documento", () => {
    let l = lembrarTentativa([], { carimbo: iso(0), doc: { a: 1, b: [1, 2] } });
    l = lembrarTentativa(l, { carimbo: iso(5), doc: { b: [1, 2], a: 1 } });
    expect(l).toHaveLength(1);
    expect(l[0].carimbos).toEqual([iso(0), iso(5)]);
  });

  it("T1 chegou sem resposta; 30 repetições que falharam depois NÃO expulsam a T1", () => {
    const doc = { v: 1, itens: ["a", "b"] };
    let l = lembrarTentativa([], { carimbo: iso(0), doc });
    for (let i = 1; i <= 30; i++) l = lembrarTentativa(l, { carimbo: iso(i * 5), doc });
    const linha = { updatedAt: iso(0).replace("Z", "+00:00"), value: { itens: ["a", "b"], v: 1 } };
    expect(acharMinhaGravacao(l, linha)).toBe(l[0]);
    expect(acharMinhaGravacao(l, linha).doc).toBe(doc);
  });

  it("documentos diferentes ficam em entradas separadas; a T1 de um documento antigo continua achável", () => {
    const d1 = { n: 1 }, d2 = { n: 2 };
    let l = lembrarTentativa([], { carimbo: iso(0), doc: d1 });
    for (let i = 1; i <= 30; i++) l = lembrarTentativa(l, { carimbo: iso(i), doc: d2 });
    expect(l).toHaveLength(2);
    expect(acharMinhaGravacao(l, { updatedAt: iso(0), value: { n: 1 } }).doc).toBe(d1);
  });

  it("tem limite folgado (não cresce sem fim) e não mexe na lista antiga", () => {
    let l = [];
    for (let i = 0; i < 10; i++) {
      const antes = l;
      l = lembrarTentativa(l, { carimbo: iso(i), doc: { n: i } });
      expect(antes).not.toBe(l);
    }
    expect(l.map((t) => t.doc.n)).toEqual([4, 5, 6, 7, 8, 9]);
    const doc = { x: 1 };
    let m = [];
    for (let i = 0; i < 300; i++) m = lembrarTentativa(m, { carimbo: String(i), doc });
    expect(m[0].carimbos).toHaveLength(240);
  });
});

describe("podeTerChegado (vale a pena lembrar dessa gravação?)", () => {
  it("rede caiu no meio / tempo estourou / erro do servidor (5xx) → pode ter chegado", () => {
    expect(podeTerChegado(new TypeError("Failed to fetch"))).toBe(true);
    expect(podeTerChegado(new Error("limite de tempo da gravação"))).toBe(true);
    expect(podeTerChegado(erroDeGravacao({ message: "x" }, 503))).toBe(true);
    expect(podeTerChegado(erroDeGravacao({ message: "x" }, 0))).toBe(true);
    expect(podeTerChegado(undefined)).toBe(true);
  });
  it("já estava sem internet antes de mandar → não chegou", () => {
    expect(podeTerChegado(new TypeError("Failed to fetch"), { offlineAntes: true })).toBe(false);
  });
  it("o servidor respondeu recusando (4xx) → comprovadamente não entrou", () => {
    for (const st of [400, 401, 403, 404, 409, 413, 429]) expect(podeTerChegado(erroDeGravacao({ message: "x" }, st))).toBe(false);
  });
  it("erroDeGravacao leva o status e o código", () => {
    const e = erroDeGravacao({ message: "permission denied", code: "42501" }, 403);
    expect([e.message, e.code, e.status]).toEqual(["permission denied", "42501", 403]);
  });
});

describe("valorDoCampoEditavel (campo de valor da Casa)", () => {
  it("número digitado → grava", () => {
    expect(valorDoCampoEditavel("1500.5")).toEqual({ gravar: true, valor: 1500.5 });
    expect(valorDoCampoEditavel("80")).toEqual({ gravar: true, valor: 80 });
    expect(valorDoCampoEditavel("-3")).toEqual({ gravar: true, valor: -3 });
  });
  it("vazio ou zero de propósito → vale 0", () => {
    expect(valorDoCampoEditavel("")).toEqual({ gravar: true, valor: 0 });
    expect(valorDoCampoEditavel("0")).toEqual({ gravar: true, valor: 0 });
    expect(valorDoCampoEditavel(null)).toEqual({ gravar: true, valor: 0 });
  });
  it("texto inválido → NÃO grava (nem como zero)", () => {
    expect(valorDoCampoEditavel("", true)).toEqual({ gravar: false }); // o navegador avisou que o que foi digitado não é número
    for (const t of ["abc", "1e", "1e3", "12,5", "1.2.3", "--1", "0x10"]) expect(valorDoCampoEditavel(t)).toEqual({ gravar: false });
  });
});

describe("decidirLinhaLida (o que fazer com a linha que foi lida)", () => {
  it("linha não existe → pode começar pela semente", () => {
    expect(decidirLinhaLida({ existe: false, valor: null }, casaValida)).toBe("ausente");
  });
  it("linha boa → usar", () => {
    expect(decidirLinhaLida({ existe: true, valor: { anos: [{ id: "a", months: [] }] } }, casaValida)).toBe("usar");
  });
  it("linha existe mas veio estranha → erro (nunca semente)", () => {
    for (const valor of [null, undefined, {}, { anos: [] }, { anos: null }, { anos: "x" }, { anos: [null] }, { anos: [{ id: "a" }] }, [], "texto", 0]) {
      expect(decidirLinhaLida({ existe: true, valor }, casaValida)).toBe("erro");
    }
  });
  it("linha antiga (v2): precisa ter a lista de meses", () => {
    expect(decidirLinhaLida({ existe: true, valor: { months: [] } }, legadoValido)).toBe("usar");
    expect(decidirLinhaLida({ existe: true, valor: {} }, legadoValido)).toBe("erro");
    expect(decidirLinhaLida({ existe: true, valor: null }, legadoValido)).toBe("erro");
    expect(decidirLinhaLida({ existe: false, valor: null }, legadoValido)).toBe("ausente");
  });
});

describe("idDaCopiaDeConflito", () => {
  it("usa a data e a hora LOCAIS", () => {
    expect(idDaCopiaDeConflito("financas-x", new Date(2026, 10, 3, 9, 5, 7))).toBe("financas-x-conflito-2026-11-03-090507");
    expect(idDaCopiaDeConflito("financas-x", new Date(2026, 11, 31, 23, 59, 59))).toBe("financas-x-conflito-2026-12-31-235959");
  });
});

describe("comLimiteOuErro (limite de tempo da gravação)", () => {
  it("respondeu a tempo → devolve a resposta", async () => {
    await expect(comLimiteOuErro(Promise.resolve({ ok: 1 }), 50)).resolves.toEqual({ ok: 1 });
  });
  it("erro da gravação passa adiante", async () => {
    await expect(comLimiteOuErro(Promise.reject(new Error("rede")), 50)).rejects.toThrow("rede");
  });
  it("não respondeu → vira erro depois do limite (30 s por padrão) e CANCELA o pedido", async () => {
    expect(LIMITE_GRAVACAO_MS).toBe(30000);
    vi.useFakeTimers();
    try {
      let fim = "esperando";
      let sinalRecebido = null;
      comLimiteOuErro((sinal) => { sinalRecebido = sinal; return new Promise(() => {}); })
        .then(() => { fim = "ok"; }, () => { fim = "erro"; });
      await vi.advanceTimersByTimeAsync(29900);
      expect(fim).toBe("esperando");
      expect(sinalRecebido.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      expect(fim).toBe("erro");
      expect(sinalRecebido.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it("respondeu a tempo → o pedido NÃO é cancelado depois", async () => {
    vi.useFakeTimers();
    try {
      let sinalRecebido = null;
      await comLimiteOuErro((sinal) => { sinalRecebido = sinal; return Promise.resolve(1); });
      await vi.advanceTimersByTimeAsync(60000);
      expect(sinalRecebido.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it("comSinal liga o cancelamento no pedido (e não quebra se o pedido não souber cancelar)", () => {
    const visto = [];
    const pedido = { abortSignal(s) { visto.push(s); return this; } };
    expect(comSinal(pedido, "sinal")).toBe(pedido);
    expect(visto).toEqual(["sinal"]);
    const simples = Promise.resolve(1);
    expect(comSinal(simples, "sinal")).toBe(simples);
    expect(comSinal(pedido, undefined)).toBe(pedido);
    expect(visto).toHaveLength(1);
  });
  it("se montar o pedido der erro, o erro sai (e não fica relógio pendurado)", async () => {
    await expect(comLimiteOuErro(() => { throw new Error("montagem"); })).rejects.toThrow("montagem");
  });
});
