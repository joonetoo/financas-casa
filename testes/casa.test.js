// @vitest-environment jsdom
// Testa a aba "Contas da casa" inteira (src/App.jsx) montada de verdade, com a
// nuvem trocada por uma de mentira: abrir, lançar valor, gravar, conflito, importar.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { criarNuvemFalsa } from "./ajuda/nuvemFalsa.js";

vi.mock("../src/supa.js", () => ({
  supabase: { from: (t) => globalThis.__nuvemFalsa.supabase.from(t) },
}));
const { default: FinancasCasa, STORAGE_KEY: CHAVE } = await import("../src/App.jsx");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
const LEGADO = "financas-casa-data-v2";
const T0 = "2026-11-13T12:00:00.000Z";

let nuvem, raiz, caixa;
const andar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
async function abrir() {
  caixa = document.createElement("div");
  document.body.appendChild(caixa);
  raiz = createRoot(caixa);
  await act(async () => { raiz.render(React.createElement(FinancasCasa)); });
  await andar(50);
}
async function fechar() {
  await act(async () => { raiz?.unmount(); });
  caixa?.remove();
  raiz = null;
}
const botao = (txt) => [...caixa.querySelectorAll("button")].find((b) => (b.textContent + " " + (b.title || "")).includes(txt));
const clicar = (el) => act(async () => { el.click(); });
async function digitar(el, txt) {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, txt);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const naTela = () => !!caixa.querySelector(".fc-header"); // o app abriu (não é tela de erro/carregando)
const conflitos = () => nuvem.ids(`${CHAVE}-conflito-`);
const todosLancamentos = (doc) =>
  doc.anos.flatMap((a) => a.months.flatMap((m) => Object.values(m.lancamentos || {}).flat()));

// um documento válido e pequeno, do jeito que o app grava (pega a semente do próprio app)
let BASE;
async function docBase() {
  if (BASE) return JSON.parse(JSON.stringify(BASE));
  nuvem = criarNuvemFalsa();
  globalThis.__nuvemFalsa = nuvem;
  await abrir();
  await fechar();
  BASE = nuvem.ler(CHAVE);
  return JSON.parse(JSON.stringify(BASE));
}
async function abrirComLinha() {
  const doc = await docBase();
  nuvem = criarNuvemFalsa();
  globalThis.__nuvemFalsa = nuvem;
  localStorage.clear();
  nuvem.por(CHAVE, doc, T0);
  await abrir();
  return doc;
}
async function lancar(valor, desc = "teste") {
  if (!caixa.querySelector('input[placeholder="Descrição"]')) await clicar(botao("Lançamentos"));
  await digitar(caixa.querySelector('input[placeholder="Descrição"]'), desc);
  await digitar(caixa.querySelector('input[placeholder="R$ 0,00"]'), valor);
  await clicar(caixa.querySelector(".fc-add-row .fc-icon-btn-solid"));
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-13T15:00:00.000Z") });
  vi.spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  nuvem = criarNuvemFalsa();
  globalThis.__nuvemFalsa = nuvem;
});
afterEach(async () => {
  await fechar();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("servidor de teste sem variável usa a CÓPIA de teste, nunca a linha real", () => {
  expect(CHAVE).toBe("financas-casa-teste");
});

describe("abrir a Casa", () => {
  it("primeiro uso (nenhuma linha existe): entra a semente, criada só com INSERIR", async () => {
    await abrir();
    expect(naTela()).toBe(true);
    expect(nuvem.gravacoes(CHAVE).map((p) => p.tipo)).toEqual(["inserir"]);
    expect(nuvem.ler(CHAVE).anos.length).toBeGreaterThan(0);
  });

  it("linha boa: abre e não grava nada na linha (nem depois de um tempo)", async () => {
    const doc = await abrirComLinha();
    expect(naTela()).toBe(true);
    await andar(40000);
    expect(nuvem.gravacoes(CHAVE)).toHaveLength(0);
    expect(nuvem.ler(CHAVE)).toEqual(doc);
  });

  const estranhas = [
    ["sem a lista de anos", { outraCoisa: 1 }],
    ["lista de anos vazia", { anos: [] }],
    ["anos que não é lista", { anos: "2026" }],
    ["ano sem meses", { anos: [{ id: "x", label: "2026" }] }],
    ["conteúdo nulo", null],
    ["uma lista solta", [1, 2, 3]],
  ];
  for (const [nome, conteudo] of estranhas) {
    it(`linha que existe mas veio estranha (${nome}): tela de erro e NADA é gravado`, async () => {
      nuvem.por(CHAVE, conteudo, T0);
      await abrir();
      await andar(40000);
      expect(naTela()).toBe(false);
      expect(nuvem.pedidos.filter((p) => p.tipo !== "ler")).toHaveLength(0);
      expect(nuvem.ler(CHAVE)).toEqual(conteudo);
      // a tela diz o que é (não finge que é falta de internet)
      expect(caixa.textContent).toContain("Os dados chegaram num formato que o app não reconhece");
      expect(caixa.textContent).toContain("Nada foi mudado. Fale com o Claude antes de mexer.");
      expect(caixa.textContent).not.toContain("internet");
    });
  }

  it("falha ao ler: tela de erro e nada é gravado (a semente NÃO entra)", async () => {
    nuvem.por(CHAVE, await docBase(), T0);
    nuvem.quando((op) => (op.tipo === "ler" ? "falha" : "ok"));
    await abrir();
    await andar(40000);
    expect(naTela()).toBe(false);
    expect(nuvem.pedidos.filter((p) => p.tipo !== "ler")).toHaveLength(0);
    expect(caixa.textContent).toContain("Não deu pra carregar agora"); // aqui sim é a tela de conexão
    expect(caixa.textContent).not.toContain("formato");
  });

  it("falha ao ler só a linha antiga (v2): tela de erro, a semente NÃO entra", async () => {
    nuvem.quando((op) => (op.tipo === "ler" && op.id === LEGADO ? "falha" : "ok"));
    await abrir();
    await andar(40000);
    expect(naTela()).toBe(false);
    expect(nuvem.pedidos.filter((p) => p.tipo !== "ler")).toHaveLength(0);
  });

  it("só a linha antiga (v2) existe: migra os meses dela, sem mexer na antiga", async () => {
    const meses = (await docBase()).anos[0].months;
    nuvem = criarNuvemFalsa();
    globalThis.__nuvemFalsa = nuvem;
    nuvem.por(LEGADO, { months: meses }, T0);
    await abrir();
    expect(naTela()).toBe(true);
    expect(nuvem.ler(CHAVE).anos).toHaveLength(1);
    expect(nuvem.ler(CHAVE).anos[0].months).toEqual(meses);
    expect(nuvem.gravacoes(CHAVE).map((p) => p.tipo)).toEqual(["inserir"]);
    expect(nuvem.gravacoes(LEGADO)).toHaveLength(0);
  });

  it("linha antiga (v2) estranha: tela de erro e nada é gravado", async () => {
    nuvem.por(LEGADO, { nada: true }, T0);
    await abrir();
    await andar(40000);
    expect(naTela()).toBe(false);
    expect(nuvem.pedidos.filter((p) => p.tipo !== "ler")).toHaveLength(0);
  });
});

describe("lançar um valor digitado", () => {
  const casos = [["1.500", 1500], ["1.234,56", 1234.56], ["12,5", 12.5], ["R$ 12", 12], ["1500.5", 1500.5], ["80", 80]];
  for (const [txt, esperado] of casos) {
    it(`"${txt}" entra como ${esperado}`, async () => {
      await abrirComLinha();
      await lancar(txt, "compra");
      await andar(50);
      const novos = todosLancamentos(nuvem.ler(CHAVE)).filter((l) => l.desc === "compra");
      expect(novos.map((l) => l.valor)).toEqual([esperado]);
    });
  }

  it('"0" não lança nada e avisa que está zerado', async () => {
    const doc = await abrirComLinha();
    await lancar("0", "compra");
    await andar(50);
    expect(caixa.querySelector(".fc-toast")?.textContent).toContain("zerado");
    expect(nuvem.ler(CHAVE)).toEqual(doc);
  });

  for (const txt of ["abc", "1.2.3,4,5", "12 reais"]) {
    it(`"${txt}" não lança nada e AVISA na tela`, async () => {
      const doc = await abrirComLinha();
      await lancar(txt, "compra");
      await andar(50);
      expect(caixa.querySelector(".fc-toast")?.textContent).toContain("Não entendi o valor");
      expect(nuvem.gravacoes(CHAVE)).toHaveLength(0);
      expect(nuvem.ler(CHAVE)).toEqual(doc);
      // o que foi digitado continua no campo, pra corrigir
      expect(caixa.querySelector('input[placeholder="R$ 0,00"]').value).toBe(txt);
    });
  }

  it("campo vazio: não faz nada (e não incomoda com aviso)", async () => {
    await abrirComLinha();
    await lancar("", "compra");
    expect(caixa.querySelector(".fc-toast")).toBe(null);
    expect(nuvem.gravacoes(CHAVE)).toHaveLength(0);
  });
});

describe("editar um valor no lugar (Antonio, orçamentos, fixas)", () => {
  async function editarPrimeiroValor(texto, { invalido = false } = {}) {
    await clicar(caixa.querySelector(".fc-amount-btn"));
    const campo = caixa.querySelector("input.fc-input-amount");
    await digitar(campo, texto);
    // é assim que o navegador avisa que o que foi digitado num campo de número não é número
    if (invalido) Object.defineProperty(campo, "validity", { configurable: true, value: { badInput: true } });
    await act(async () => { campo.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    await andar(50);
  }
  const textoDoBotao = () => caixa.querySelector(".fc-amount-btn").textContent;

  it("texto inválido NÃO grava nada (antes virava 0 por cima) e o campo volta ao valor de antes", async () => {
    const doc = await abrirComLinha();
    const antes = textoDoBotao();
    await editarPrimeiroValor("", { invalido: true });
    expect(nuvem.gravacoes(CHAVE)).toHaveLength(0);
    expect(nuvem.ler(CHAVE)).toEqual(doc);
    expect(textoDoBotao()).toBe(antes);
    expect(caixa.querySelector("input.fc-input-amount")).toBe(null);
  });

  it("número válido grava normalmente", async () => {
    await abrirComLinha();
    await editarPrimeiroValor("250.5");
    expect(nuvem.gravacoes(CHAVE)).toHaveLength(1);
    expect(textoDoBotao()).toContain("250,50");
  });

  it("apagar o campo (vazio) ou digitar 0 de propósito continua valendo 0", async () => {
    await abrirComLinha();
    await editarPrimeiroValor("250");
    await editarPrimeiroValor("");
    expect(textoDoBotao()).toContain("0,00");
    await editarPrimeiroValor("99");
    await editarPrimeiroValor("0");
    expect(textoDoBotao()).toContain("0,00");
    expect(nuvem.gravacoes(CHAVE)).toHaveLength(4);
  });
});

describe("gravar a Casa", () => {
  const semInternet = (sem) => vi.spyOn(navigator, "onLine", "get").mockReturnValue(!sem);

  it("a gravação chegou sem resposta e depois vêm 30 tentativas sem internet: ainda reconhece a própria gravação", async () => {
    await abrirComLinha();
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await lancar("10", "um");
    await andar(50);
    semInternet(true);
    nuvem.quando(() => "falha");
    for (let i = 0; i < 30; i++) await andar(5050);
    semInternet(false);
    nuvem.semRegra();
    await andar(5100);
    expect(conflitos()).toHaveLength(0);
    expect(caixa.textContent).not.toContain("versão antiga");
    await lancar("20", "dois");
    await andar(50);
    expect(todosLancamentos(nuvem.ler(CHAVE)).map((l) => l.desc)).toEqual(expect.arrayContaining(["um", "dois"]));
    expect(conflitos()).toHaveLength(0);
  });

  it("a 2ª gravação da cópia de conflito falha: o lançamento feito no meio NÃO some", async () => {
    const doc = await abrirComLinha();
    nuvem.por(CHAVE, { ...doc, marca: "celular" }, "2026-11-13T13:00:00.000Z");
    let copias = 0;
    nuvem.quando((op) => {
      if (op.tipo === "ler" && op.id === CHAVE) return "demora";
      if (op.tipo === "upsert" && op.id.includes("-conflito-")) return ++copias >= 2 ? "falha" : "ok";
      return "ok";
    });
    await lancar("10", "um");
    await andar(1000);
    await lancar("20", "dois");
    await andar(4000);
    expect(caixa.textContent).not.toContain("versão antiga"); // não trocou pela nuvem
    expect(nuvem.ler(CHAVE).marca).toBe("celular");
    nuvem.semRegra();
    await andar(5100);
    expect(conflitos()).toHaveLength(1);
    expect(todosLancamentos(nuvem.ler(conflitos()[0])).map((l) => l.desc)).toEqual(expect.arrayContaining(["um", "dois"]));
    expect(caixa.textContent).toContain("versão antiga");
  });

  it("a gravação chegou mas a resposta se perdeu: NÃO vira conflito", async () => {
    await abrirComLinha();
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await lancar("10", "um");
    await andar(50);
    expect(todosLancamentos(nuvem.ler(CHAVE)).some((l) => l.desc === "um")).toBe(true);
    nuvem.semRegra();
    await andar(5100);
    expect(conflitos()).toHaveLength(0);
    expect(caixa.textContent).not.toContain("versão antiga");
    await lancar("20", "dois");
    await andar(50);
    expect(todosLancamentos(nuvem.ler(CHAVE)).map((l) => l.desc)).toEqual(expect.arrayContaining(["um", "dois"]));
    expect(conflitos()).toHaveLength(0);
  });

  it("resposta perdida + outro lançamento antes da nova tentativa: os dois chegam, sem conflito", async () => {
    await abrirComLinha();
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await lancar("10", "um");
    await andar(50);
    nuvem.quando((op) => (op.tipo === "atualizar" ? "falha" : "ok"));
    await lancar("20", "dois");
    await andar(50);
    nuvem.semRegra();
    await andar(5200);
    expect(todosLancamentos(nuvem.ler(CHAVE)).map((l) => l.desc)).toEqual(expect.arrayContaining(["um", "dois"]));
    expect(conflitos()).toHaveLength(0);
  });

  it("lançamento feito ENQUANTO o app confere se a gravação era dele: nada se perde, sem conflito", async () => {
    await abrirComLinha();
    nuvem.quando((op) => (op.tipo === "atualizar" ? "perde-resposta" : "ok"));
    await lancar("10", "um");
    await andar(50);
    nuvem.quando((op) => (op.tipo === "ler" && op.id === CHAVE ? "demora" : "ok"));
    await andar(5100);
    await lancar("20", "dois");
    await andar(1000);
    await lancar("30", "tres");
    nuvem.semRegra();
    await andar(4000);
    expect(todosLancamentos(nuvem.ler(CHAVE)).map((l) => l.desc)).toEqual(expect.arrayContaining(["um", "dois", "tres"]));
    expect(conflitos()).toHaveLength(0);
    expect(caixa.textContent).not.toContain("versão antiga");
  });

  it("gravação pendurada: desiste em 30 s, cancela o pedido e tenta de novo (não trava)", async () => {
    await abrirComLinha();
    nuvem.quando((op) => (op.tipo === "atualizar" ? "pendura" : "ok"));
    await lancar("10", "um");
    await andar(30100);
    expect(nuvem.gravacoes(CHAVE)[0].cancelado).toBe(true);
    nuvem.semRegra();
    await andar(5100);
    expect(todosLancamentos(nuvem.ler(CHAVE)).some((l) => l.desc === "um")).toBe(true);
    expect(conflitos()).toHaveLength(0);
  });

  it("outro aparelho gravou: nunca grava por cima — guarda a versão daqui à parte e avisa", async () => {
    const doc = await abrirComLinha();
    const doCelular = { ...doc, marca: "celular" };
    nuvem.por(CHAVE, doCelular, "2026-11-13T13:00:00.000Z");
    await lancar("10", "do mac");
    await andar(50);
    expect(nuvem.ler(CHAVE)).toEqual(doCelular);
    expect(conflitos()).toHaveLength(1);
    expect(todosLancamentos(nuvem.ler(conflitos()[0])).some((l) => l.desc === "do mac")).toBe(true);
  });

  it("conflito com a leitura falhando várias vezes: UMA linha de conflito só", async () => {
    const doc = await abrirComLinha();
    nuvem.por(CHAVE, { ...doc, marca: "celular" }, "2026-11-13T13:00:00.000Z");
    nuvem.quando((op) => (op.tipo === "ler" && op.id === CHAVE ? "falha" : "ok"));
    await lancar("10", "do mac");
    await andar(50);
    for (let i = 0; i < 4; i++) await andar(5100);
    expect(conflitos()).toHaveLength(1);
    nuvem.semRegra();
    await andar(5100);
    expect(conflitos()).toHaveLength(1);
    expect(nuvem.ler(CHAVE).marca).toBe("celular");
  });
});

describe("importar dados (troca tudo)", () => {
  async function importar(texto) {
    if (!caixa.querySelector("textarea")) await clicar(botao("Importar dados"));
    await digitar(caixa.querySelector("textarea"), texto);
    await clicar(caixa.querySelector(".fc-data-panel-actions .fc-icon-btn-solid")); // "Importar" (arma)
    await clicar(caixa.querySelector('button[title="Confirmar"]'));
    await andar(50);
  }
  const antes = () => nuvem.ids(`${CHAVE}-antes-importar-`);

  it("guarda uma cópia do que existia ANTES de trocar", async () => {
    const doc = await abrirComLinha();
    const novo = { anos: [{ id: "n", label: "2030", months: [] }] };
    await importar(JSON.stringify(novo));
    expect(antes()).toHaveLength(1);
    expect(nuvem.ler(antes()[0])).toEqual(doc);
    expect(nuvem.ler(CHAVE)).toEqual(novo);
  });

  it("se a cópia não puder ser gravada, NÃO importa nada", async () => {
    const doc = await abrirComLinha();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id.includes("-antes-importar-") ? "falha" : "ok"));
    await importar(JSON.stringify({ anos: [{ id: "n", label: "2030", months: [] }] }));
    expect(antes()).toHaveLength(0);
    expect(nuvem.ler(CHAVE)).toEqual(doc);
    expect(nuvem.gravacoes(CHAVE)).toHaveLength(0);
    expect(caixa.textContent).toContain("Nada foi mudado");
  });

  it("texto que não é um export válido: recusa, sem cópia e sem gravar", async () => {
    const doc = await abrirComLinha();
    await importar(JSON.stringify({ anos: [] }));
    await importar("isso não é json");
    expect(antes()).toHaveLength(0);
    expect(nuvem.ler(CHAVE)).toEqual(doc);
  });
});
