// @vitest-environment jsdom
// Testa o "Desfazer" ao apagar na aba Investimentos (src/invest/Investimentos.jsx),
// com a nuvem de mentira e sem internet (as taxas do Banco Central não são buscadas).
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { criarNuvemFalsa } from "./ajuda/nuvemFalsa.js";

vi.mock("../src/supa.js", () => ({
  supabase: { from: (t) => globalThis.__nuvemFalsa.supabase.from(t) },
}));
const { default: Investimentos } = await import("../src/invest/Investimentos.jsx");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
window.scrollTo = () => {};
// o navegador de mentira dos testes não tem isto (o gráfico usa pra medir a largura)
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const CHAVE = "t-invest";
const T0 = "2026-11-13T12:00:00.000Z";
const mov = (id, data, valor) => ({ id, tipo: "aporte", data, valor, criado: 1 });
const DOC = {
  v: 1,
  metas: [],
  investimentos: [
    { id: "i1", tipo: "cdi", nome: "Caixinha Um", banco: "Banco A", pct: 100, movs: [mov("m1", "2026-01-10", 100)] },
    { id: "i2", tipo: "cdi", nome: "Caixinha Dois", banco: "Banco B", pct: 110, movs: [mov("m2", "2026-02-10", 200), mov("m3", "2026-03-10", 300), mov("m4", "2026-04-10", 400)] },
    { id: "i3", tipo: "cdi", nome: "Caixinha Tres", banco: "Banco C", pct: 120, movs: [mov("m5", "2026-05-10", 500)] },
  ],
};

let nuvem, raiz, caixa;
const andar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const botoes = (txt) => [...caixa.querySelectorAll("button")].filter((b) => b.textContent.includes(txt));
const clicar = (el) => act(async () => { el.click(); });
const aviso = () => caixa.querySelector(".mc-toast");
const acoes = () => [...nuvem.historico, ...JSON.parse(localStorage.getItem(`fc-hist-fila:${CHAVE}`) || "[]")].map((r) => r.acao);

async function abrirInvestimento(nome) {
  await clicar([...caixa.querySelectorAll(".iv-it")].find((b) => b.textContent.includes(nome)));
}
async function apagarInvestimento(nome) {
  await abrirInvestimento(nome);
  await clicar(botoes("Editar").pop());
  await clicar(botoes("Apagar").pop());
  await clicar(botoes("Toque de novo pra apagar").pop());
  await andar(50);
}
async function apagarRegistro(nomeInv, textoDoRegistro) {
  await abrirInvestimento(nomeInv);
  await clicar([...caixa.querySelectorAll(".iv-ext")].find((b) => b.textContent.includes(textoDoRegistro)));
  await clicar(botoes("Apagar").pop());
  await clicar(botoes("Toque de novo pra apagar").pop());
  await andar(50);
}

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date("2026-11-13T15:00:00.000Z") });
  localStorage.clear();
  nuvem = criarNuvemFalsa();
  globalThis.__nuvemFalsa = nuvem;
  nuvem.por(CHAVE, DOC, T0);
  caixa = document.createElement("div");
  document.body.appendChild(caixa);
  raiz = createRoot(caixa);
  await act(async () => {
    raiz.render(React.createElement(Investimentos, { chave: CHAVE, chaveCalc: "t-calc", chavePessoal: "t-pessoal", ativo: true, larga: false }));
  });
  await andar(13000); // carrega; a busca das taxas falha (sem rede) e segue sem elas
});
afterEach(async () => {
  await act(async () => { raiz?.unmount(); });
  caixa?.remove();
  vi.useRealTimers();
});

describe("apagar um investimento inteiro", () => {
  it("apaga, mostra Desfazer, e o Desfazer devolve tudo no MESMO lugar", async () => {
    await apagarInvestimento("Caixinha Dois");
    expect(nuvem.ler(CHAVE).investimentos.map((i) => i.id)).toEqual(["i1", "i3"]);
    expect(aviso().textContent).toContain("Caixinha Dois apagado");
    expect(aviso().textContent).not.toContain("registro de atividades");
    await clicar(aviso().querySelector("button"));
    await andar(50);
    expect(nuvem.ler(CHAVE)).toEqual(DOC); // igualzinho: ordem e todos os registros
    expect(acoes()).toEqual(expect.arrayContaining(["invest:excluiu", "invest:desfez"]));
  });

  it("o Desfazer fica 10 s na tela (não 3,5)", async () => {
    await apagarInvestimento("Caixinha Dois");
    await andar(9000);
    expect(aviso()?.querySelector("button")).toBeTruthy();
    await andar(1200);
    expect(aviso()).toBe(null);
    expect(nuvem.ler(CHAVE).investimentos.map((i) => i.id)).toEqual(["i1", "i3"]);
  });

  it("apagar o primeiro e o último também voltam pro lugar certo", async () => {
    await apagarInvestimento("Caixinha Um");
    await clicar(aviso().querySelector("button"));
    await andar(50);
    await apagarInvestimento("Caixinha Tres");
    await clicar(aviso().querySelector("button"));
    await andar(50);
    expect(nuvem.ler(CHAVE)).toEqual(DOC);
  });
});

describe("valor digitado nos Investimentos", () => {
  async function digitar(el, txt) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, txt);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function guardarMais(valor) {
    await abrirInvestimento("Caixinha Um");
    await clicar(botoes("Guardar mais").pop());
    await digitar(caixa.querySelector("#iv-mvalor"), valor);
    await clicar(botoes("Guardar").pop());
    await andar(50);
  }
  it('"1.500" entra como mil e quinhentos (antes entrava como 1,5)', async () => {
    await guardarMais("1.500");
    expect(nuvem.ler(CHAVE).investimentos[0].movs.map((m) => m.valor)).toEqual([100, 1500]);
  });
  it('"1.234,56" entra certo', async () => {
    await guardarMais("1.234,56");
    expect(nuvem.ler(CHAVE).investimentos[0].movs.map((m) => m.valor)).toEqual([100, 1234.56]);
  });
  it("valor que não é número: avisa na tela e não grava nada", async () => {
    await guardarMais("12abc");
    expect(caixa.querySelector(".mc-erro").textContent).toContain("valor maior que zero");
    expect(nuvem.ler(CHAVE)).toEqual(DOC);
    expect(nuvem.gravacoes(CHAVE)).toHaveLength(0);
  });
});

describe("apagar um registro (guardou / resgatou)", () => {
  it("apaga só aquele registro, e o Desfazer devolve no mesmo lugar", async () => {
    await apagarRegistro("Caixinha Dois", "300,00");
    expect(nuvem.ler(CHAVE).investimentos[1].movs.map((m) => m.id)).toEqual(["m2", "m4"]);
    expect(aviso().textContent).toContain("Registro apagado");
    await clicar(aviso().querySelector("button"));
    await andar(50);
    expect(nuvem.ler(CHAVE)).toEqual(DOC);
    expect(acoes()).toContain("invest:desfez");
  });

  it("sem tocar em Desfazer, o registro continua apagado e o resto intacto", async () => {
    await apagarRegistro("Caixinha Dois", "300,00");
    await andar(11000);
    const d = nuvem.ler(CHAVE);
    expect(d.investimentos[1].movs.map((m) => m.id)).toEqual(["m2", "m4"]);
    expect(d.investimentos[0]).toEqual(DOC.investimentos[0]);
    expect(d.investimentos[2]).toEqual(DOC.investimentos[2]);
  });
});
