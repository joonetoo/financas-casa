// @vitest-environment jsdom
// Testa o "gancho" que guarda Minhas contas / Investimentos / Calculadora na
// nuvem (src/pessoal/nuvem.js), com a nuvem trocada por uma de mentira.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { criarNuvemFalsa } from "./ajuda/nuvemFalsa.js";

vi.mock("../src/supa.js", () => ({
  supabase: { from: (t) => globalThis.__nuvemFalsa.supabase.from(t) },
}));

const { useDocNuvem } = await import("../src/pessoal/nuvem.js");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const CHAVE = "teste-doc";
const T0 = "2026-11-13T12:00:00.000Z";

let nuvem, raiz, caixa, sonda;

// "normalizar" de teste: quebra de propósito se a versão da nuvem vier com `quebra: true`
const normalizarDeTeste = (d) => {
  if (d && d.quebra) throw new Error("formato que quebra o normalizar");
  return d;
};
function Sonda() {
  sonda.nv = useDocNuvem(CHAVE, { vazio: () => ({ v: 1, itens: [] }), normalizar: normalizarDeTeste });
  return null;
}
const semInternet = (sem) => vi.spyOn(navigator, "onLine", "get").mockReturnValue(!sem);
const andar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
async function abrir() {
  caixa = document.createElement("div");
  document.body.appendChild(caixa);
  raiz = createRoot(caixa);
  await act(async () => { raiz.render(React.createElement(Sonda)); });
  await andar(50);
}
const editar = (fn) => act(async () => { sonda.nv.editar(fn); });
const acrescentar = (nome) => editar((d) => ({ ...d, itens: [...d.itens, nome] }));
const conflitos = () => nuvem.ids(`${CHAVE}-conflito-`);

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-13T15:00:00.000Z") });
  localStorage.clear();
  nuvem = criarNuvemFalsa();
  globalThis.__nuvemFalsa = nuvem;
  sonda = {};
});
afterEach(async () => {
  await act(async () => { raiz?.unmount(); });
  caixa?.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("abrir", () => {
  it("linha que existe: carrega, e abrir NÃO grava nada na linha", async () => {
    nuvem.por(CHAVE, { v: 1, itens: ["a"] }, T0);
    await abrir();
    expect(sonda.nv.carregado).toBe(true);
    expect(sonda.nv.doc.itens).toEqual(["a"]);
    expect(nuvem.gravacoes(CHAVE)).toHaveLength(0);
  });

  it("linha que não existe: começa vazio; cria a linha só com INSERIR (nunca por cima de nada)", async () => {
    await abrir();
    expect(sonda.nv.carregado).toBe(true);
    // comportamento de hoje: a linha vazia é criada logo ao abrir, mas sempre
    // com "inserir" — que o banco recusa se a linha já existir
    expect(nuvem.gravacoes(CHAVE).every((p) => p.tipo === "inserir")).toBe(true);
    await acrescentar("a");
    await andar(50);
    expect(nuvem.ler(CHAVE)).toEqual({ v: 1, itens: ["a"] });
  });

  it("falha ao ler (4 tentativas): tela de erro e NUNCA grava", async () => {
    nuvem.por(CHAVE, { v: 1, itens: ["a"] }, T0);
    nuvem.quando((op) => (op.tipo === "ler" ? "falha" : "ok"));
    await abrir();
    await andar(10000);
    expect(sonda.nv.erroCarregar).toBe(true);
    expect(sonda.nv.carregado).toBe(false);
    await editar((d) => ({ v: 1, itens: [] }));
    await andar(10000);
    expect(nuvem.pedidos.filter((p) => p.tipo !== "ler")).toHaveLength(0);
    expect(nuvem.ler(CHAVE)).toEqual({ v: 1, itens: ["a"] });
  });
});

describe("gravar", () => {
  beforeEach(async () => {
    nuvem.por(CHAVE, { v: 1, itens: ["a"] }, T0);
    await abrir();
  });

  it("edição comum chega na nuvem, sem conflito", async () => {
    await acrescentar("b");
    await andar(50);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b"]);
    expect(sonda.nv.erroSalvar).toBe(false);
    expect(sonda.nv.conflito).toBe(null);
    expect(conflitos()).toHaveLength(0);
  });

  it("a gravação chegou mas a resposta se perdeu: NÃO vira conflito", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await acrescentar("b");
    await andar(50);
    expect(sonda.nv.erroSalvar).toBe(true);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b"]); // chegou de verdade
    nuvem.semRegra();
    await andar(5100); // a nova tentativa bate na própria gravação
    expect(sonda.nv.erroSalvar).toBe(false);
    expect(sonda.nv.conflito).toBe(null);
    expect(conflitos()).toHaveLength(0);
    expect(sonda.nv.doc.itens).toEqual(["a", "b"]);
    // e a próxima edição grava normalmente (o carimbo ficou certo)
    await acrescentar("c");
    await andar(50);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b", "c"]);
    expect(conflitos()).toHaveLength(0);
  });

  it("resposta perdida + nova edição antes de tentar de novo: manda a edição nova, sem conflito", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await acrescentar("b");
    await andar(50);
    nuvem.quando((op) => (op.tipo === "atualizar" ? "falha" : "ok"));
    await acrescentar("c"); // essa não chega
    await andar(50);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b"]);
    nuvem.semRegra();
    await andar(5200);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b", "c"]);
    expect(sonda.nv.conflito).toBe(null);
    expect(conflitos()).toHaveLength(0);
    expect(sonda.nv.erroSalvar).toBe(false);
  });

  it("edição feita ENQUANTO o app confere se a gravação era dele: nada se perde, sem conflito", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await acrescentar("b");
    await andar(50);
    nuvem.quando((op) => (op.tipo === "ler" && op.id === CHAVE ? "demora" : "ok"));
    await andar(5100); // nova tentativa → "conflito" → está lendo a linha (demora 3 s)
    await acrescentar("c"); // editou bem no meio
    await andar(1000);
    await acrescentar("d");
    nuvem.semRegra();
    await andar(4000);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b", "c", "d"]);
    expect(sonda.nv.doc.itens).toEqual(["a", "b", "c", "d"]);
    expect(conflitos()).toHaveLength(0);
    expect(sonda.nv.conflito).toBe(null);
    expect(sonda.nv.erroSalvar).toBe(false);
  });

  it("a gravação chegou sem resposta e depois vêm 30 tentativas SEM INTERNET: ainda reconhece a própria gravação", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await acrescentar("b");
    await andar(50);
    semInternet(true);
    nuvem.quando(() => "falha");
    for (let i = 0; i < 30; i++) await andar(5050); // 2 min e meio tentando a cada 5 s
    expect(sonda.nv.erroSalvar).toBe(true);
    expect(nuvem.gravacoes(CHAVE).length).toBeGreaterThan(25);
    semInternet(false);
    nuvem.semRegra();
    await andar(5100);
    expect(sonda.nv.erroSalvar).toBe(false);
    expect(sonda.nv.conflito).toBe(null);
    expect(conflitos()).toHaveLength(0);
    await acrescentar("c");
    await andar(50);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b", "c"]);
    expect(conflitos()).toHaveLength(0);
  });

  it("a gravação chegou sem resposta e depois vêm 30 falhas COM internet (servidor fora): ainda reconhece", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await acrescentar("b");
    await andar(50);
    nuvem.quando(() => "falha");
    for (let i = 0; i < 30; i++) await andar(5050);
    nuvem.semRegra();
    await andar(5100);
    expect(sonda.nv.erroSalvar).toBe(false);
    expect(sonda.nv.conflito).toBe(null);
    expect(conflitos()).toHaveLength(0);
  });

  it("idem com gravações RECUSADAS pelo servidor (4xx) no meio: ainda reconhece a que chegou", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await acrescentar("b");
    await andar(50);
    nuvem.quando((op) => (op.tipo === "atualizar" ? "recusa" : "ok"));
    for (let i = 0; i < 30; i++) await andar(5050);
    expect(sonda.nv.erroSalvar).toBe(true);
    nuvem.semRegra();
    await andar(5100);
    expect(sonda.nv.erroSalvar).toBe(false);
    expect(conflitos()).toHaveLength(0);
  });

  it("rede lenta: o pedido que estourou os 30 s é cancelado e NÃO chega atrasado por cima de nada", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "lenta" : "ok")); // só chegaria aos 40 s
    await acrescentar("b");
    await andar(30100);
    expect(sonda.nv.erroSalvar).toBe(true);
    expect(nuvem.gravacoes(CHAVE)[0].cancelado).toBe(true);
    nuvem.semRegra();
    await andar(5100); // nova tentativa entra normalmente
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b"]);
    await acrescentar("c");
    await andar(60000); // bem depois dos 40 s: a antiga não reaparece
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b", "c"]);
    expect(conflitos()).toHaveLength(0);
    expect(sonda.nv.erroSalvar).toBe(false);
  });

  it("linha nova: o primeiro salvamento chegou e a resposta se perdeu → não vira conflito", async () => {
    await act(async () => { raiz.unmount(); });
    nuvem.linhas.delete(CHAVE);
    nuvem.quando((op) => (op.tipo === "inserir" ? "perde-resposta" : "ok"));
    await abrir(); // cria a linha vazia: chega, mas a resposta se perde
    await acrescentar("x");
    await andar(50);
    expect(sonda.nv.erroSalvar).toBe(true);
    expect(nuvem.pedidos.some((p) => p.tipo === "inserir" && p.modo === "perde-resposta")).toBe(true);
    nuvem.semRegra();
    await andar(5100);
    expect(sonda.nv.conflito).toBe(null);
    expect(conflitos()).toHaveLength(0);
    expect(sonda.nv.erroSalvar).toBe(false);
    await acrescentar("y");
    await andar(50);
    expect(nuvem.ler(CHAVE).itens).toEqual(["x", "y"]);
  });

  it("gravação pendurada: desiste em 30 s, CANCELA o pedido, avisa e tenta de novo (não trava)", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "pendura" : "ok"));
    await acrescentar("b");
    await andar(29000);
    expect(sonda.nv.erroSalvar).toBe(false); // ainda esperando (rede lenta tem 30 s)
    expect(nuvem.gravacoes(CHAVE)[0].cancelado).toBe(false);
    await andar(1100);
    expect(sonda.nv.erroSalvar).toBe(true);
    expect(nuvem.gravacoes(CHAVE)[0].cancelado).toBe(true);
    nuvem.semRegra();
    await andar(5100);
    expect(sonda.nv.erroSalvar).toBe(false);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "b"]);
    expect(conflitos()).toHaveLength(0);
  });

  it("gravação que chegou mas ficou pendurada: depois do limite reconhece a própria gravação", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "grava-e-pendura" : "ok"));
    await acrescentar("b");
    await andar(30100);
    expect(sonda.nv.erroSalvar).toBe(true);
    nuvem.semRegra();
    await andar(5100);
    expect(sonda.nv.erroSalvar).toBe(false);
    expect(sonda.nv.conflito).toBe(null);
    expect(conflitos()).toHaveLength(0);
  });
});

describe("conflito de verdade (outro aparelho gravou)", () => {
  beforeEach(async () => {
    nuvem.por(CHAVE, { v: 1, itens: ["a"] }, T0);
    await abrir();
  });

  it("nunca grava por cima: guarda a versão daqui à parte, carrega a da nuvem e avisa", async () => {
    nuvem.por(CHAVE, { v: 1, itens: ["a", "celular"] }, "2026-11-13T13:00:00.000Z");
    await acrescentar("mac");
    await andar(50);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "celular"]); // intacta
    expect(conflitos()).toHaveLength(1);
    expect(nuvem.ler(conflitos()[0]).itens).toEqual(["a", "mac"]);
    expect(sonda.nv.doc.itens).toEqual(["a", "celular"]);
    expect(sonda.nv.conflito).not.toBe(null);
  });

  it("gravação daqui falhou de verdade E outro aparelho gravou: continua sendo conflito", async () => {
    nuvem.quando((op) => (op.tipo === "atualizar" ? "falha" : "ok"));
    await acrescentar("mac");
    await andar(50);
    nuvem.por(CHAVE, { v: 1, itens: ["a", "celular"] }, "2026-11-13T13:00:00.000Z");
    nuvem.semRegra();
    await andar(5100);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "celular"]);
    expect(conflitos()).toHaveLength(1);
    expect(nuvem.ler(conflitos()[0]).itens).toEqual(["a", "mac"]);
    expect(sonda.nv.conflito).not.toBe(null);
  });

  it("mesmo carimbo mas conteúdo diferente NÃO conta como gravação minha", async () => {
    let carimboTentado = null;
    nuvem.quando((op) => {
      if (op.tipo !== "atualizar") return "ok";
      carimboTentado = op.updated_at;
      return "falha";
    });
    await acrescentar("mac");
    await andar(50);
    nuvem.por(CHAVE, { v: 1, itens: ["outra coisa"] }, carimboTentado);
    nuvem.semRegra();
    await andar(5100);
    expect(nuvem.ler(CHAVE).itens).toEqual(["outra coisa"]);
    expect(conflitos()).toHaveLength(1);
    expect(sonda.nv.conflito).not.toBe(null);
  });

  it("a cópia grava mas a leitura seguinte falha várias vezes: UMA linha de conflito só", async () => {
    nuvem.por(CHAVE, { v: 1, itens: ["a", "celular"] }, "2026-11-13T13:00:00.000Z");
    nuvem.quando((op) => (op.tipo === "ler" && op.id === CHAVE ? "falha" : "ok"));
    await acrescentar("mac");
    await andar(50);
    for (let i = 0; i < 4; i++) await andar(5100); // 4 novas tentativas, segundos diferentes
    expect(conflitos()).toHaveLength(1);
    expect(sonda.nv.erroSalvar).toBe(true);
    nuvem.semRegra();
    await andar(5100);
    expect(conflitos()).toHaveLength(1);
    expect(nuvem.ler(conflitos()[0]).itens).toEqual(["a", "mac"]);
    expect(sonda.nv.doc.itens).toEqual(["a", "celular"]);
    expect(sonda.nv.erroSalvar).toBe(false);
    expect(sonda.nv.conflito).not.toBe(null);
  });

  it("edição feita ENQUANTO o conflito é resolvido vai junto na cópia (uma linha só)", async () => {
    nuvem.por(CHAVE, { v: 1, itens: ["a", "celular"] }, "2026-11-13T13:00:00.000Z");
    nuvem.quando((op) => (op.tipo === "ler" && op.id === CHAVE ? "demora" : "ok"));
    await acrescentar("mac");
    await andar(1000); // cópia gravada; lendo a linha da nuvem (demora)
    await acrescentar("mac2");
    nuvem.semRegra();
    await andar(5000);
    expect(conflitos()).toHaveLength(1);
    expect(nuvem.ler(conflitos()[0]).itens).toEqual(["a", "mac", "mac2"]);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "celular"]);
    expect(sonda.nv.doc.itens).toEqual(["a", "celular"]);
  });

  it("a 2ª gravação da cópia (com a edição feita durante a resolução) falha: a edição NÃO some", async () => {
    nuvem.por(CHAVE, { v: 1, itens: ["a", "celular"] }, "2026-11-13T13:00:00.000Z");
    let copias = 0;
    nuvem.quando((op) => {
      if (op.tipo === "ler" && op.id === CHAVE) return "demora";
      if (op.tipo === "upsert" && op.id.includes("-conflito-")) return ++copias >= 2 ? "falha" : "ok";
      return "ok";
    });
    await acrescentar("mac");
    await andar(1000); // 1ª cópia gravada; lendo a nuvem (demora)
    await acrescentar("mac2"); // editou no meio
    await andar(4000); // a 2ª cópia falha
    expect(sonda.nv.doc.itens).toEqual(["a", "mac", "mac2"]); // continua na tela, não foi trocado pela nuvem
    expect(sonda.nv.conflito).toBe(null);
    expect(sonda.nv.erroSalvar).toBe(true);
    expect(nuvem.ler(CHAVE).itens).toEqual(["a", "celular"]); // e nada foi gravado por cima
    nuvem.semRegra();
    await andar(5100); // tenta tudo de novo
    expect(conflitos()).toHaveLength(1);
    expect(nuvem.ler(conflitos()[0]).itens).toEqual(["a", "mac", "mac2"]);
    expect(sonda.nv.doc.itens).toEqual(["a", "celular"]);
    expect(sonda.nv.conflito).not.toBe(null);
  });

  it("a versão da nuvem quebra o 'normalizar' durante o conflito: nada muda aqui e NADA é gravado por cima dela", async () => {
    const doOutro = { v: 1, itens: ["celular"], quebra: true };
    nuvem.por(CHAVE, doOutro, "2026-11-13T13:00:00.000Z");
    await acrescentar("mac");
    for (let i = 0; i < 6; i++) await andar(5100); // várias novas tentativas
    expect(nuvem.ler(CHAVE)).toEqual(doOutro); // a versão do outro aparelho continua intacta
    expect(nuvem.gravacoes(CHAVE).filter((p) => p.modo === "ok" && p.tipo === "upsert")).toHaveLength(0);
    expect(sonda.nv.doc.itens).toEqual(["a", "mac"]);
    expect(sonda.nv.erroSalvar).toBe(true);
    expect(conflitos()).toHaveLength(1); // a versão daqui está guardada
    expect(nuvem.ler(conflitos()[0]).itens).toEqual(["a", "mac"]);
  });

  it("a versão nova da nuvem quebra o 'normalizar' ao atualizar sozinho: fica como estava e a próxima edição NÃO grava por cima", async () => {
    const doOutro = { v: 1, itens: ["celular"], quebra: true };
    nuvem.por(CHAVE, doOutro, "2026-11-13T13:00:00.000Z");
    await andar(31000); // a conferência de 30 s puxa a versão nova (e ela quebra)
    expect(sonda.nv.doc.itens).toEqual(["a"]);
    await acrescentar("mac");
    await andar(6000);
    expect(nuvem.ler(CHAVE)).toEqual(doOutro);
  });

  it("conflito resolvido e, mais tarde, outro conflito: aí sim linha nova", async () => {
    nuvem.por(CHAVE, { v: 1, itens: ["a", "celular"] }, "2026-11-13T13:00:00.000Z");
    await acrescentar("mac");
    await andar(2000);
    nuvem.por(CHAVE, { v: 1, itens: ["de novo"] }, "2026-11-13T14:00:00.000Z");
    await acrescentar("mac2");
    await andar(50);
    expect(conflitos()).toHaveLength(2);
  });
});
