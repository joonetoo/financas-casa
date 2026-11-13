// @vitest-environment jsdom
// Testa "Restaurar de um arquivo" e "Começar do zero" das Configurações
// (src/Configuracoes.jsx) com a nuvem de mentira: o que acontece quando a
// internet cai no meio da troca.
// (O aviso "Not implemented: navigation" que aparece ao rodar é o navegador de
// mentira dizendo que não sabe recarregar a página — esperado, não é erro.)
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { criarNuvemFalsa } from "./ajuda/nuvemFalsa.js";

vi.mock("../src/supa.js", () => ({
  supabase: {
    from: (t) => globalThis.__nuvemFalsa.supabase.from(t),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }), signOut: () => Promise.resolve({}) },
  },
}));
const { default: Configuracoes, AvisoDesfazerGeral } = await import("../src/Configuracoes.jsx");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const CASA = "t-casa", PESSOAL = "t-pessoal", INVEST = "t-invest";
const T0 = "2026-11-13T12:00:00.000Z";
const velho = {
  [CASA]: { anos: [{ id: "a", label: "2026", months: [] }], marca: "casa de hoje" },
  [PESSOAL]: { v: 1, categorias: [], lancamentos: [{ id: "l1", desc: "de hoje", valor: 5, data: "2026-11-01", tipo: "despesa" }] },
  [INVEST]: { v: 1, investimentos: [], metas: [], marca: "invest de hoje" },
};
const doArquivo = {
  casa: { anos: [{ id: "b", label: "2025", months: [] }], marca: "casa do arquivo" },
  pessoal: { v: 1, categorias: [], lancamentos: [], marca: "pessoal do arquivo" },
  invest: { v: 1, investimentos: [], metas: [], marca: "invest do arquivo" },
};
const arquivo = () => new File([JSON.stringify({
  app: "oink", versao: 1, criadoEm: "2026-11-01T10:00:00.000Z",
  abas: { casa: { dados: doArquivo.casa }, pessoal: { dados: doArquivo.pessoal }, invest: { dados: doArquivo.invest } },
})], "oink-backup-2026-11-01.json", { type: "application/json" });

let nuvem, raiz, caixa;
const andar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const botao = (txt) => [...caixa.querySelectorAll("button")].find((b) => b.textContent.includes(txt));
const clicar = (el) => act(async () => { el.click(); });
const desfazerAnotado = () => JSON.parse(sessionStorage.getItem("oink-desfazer") || "null");
const registros = () => [
  ...nuvem.historico,
  ...JSON.parse(localStorage.getItem(`fc-hist-fila:${PESSOAL}`) || "[]"),
].map((r) => r.acao);
const copias = () => nuvem.ids().filter((k) => k.includes("-antes-"));

async function abrir() {
  caixa = document.createElement("div");
  document.body.appendChild(caixa);
  raiz = createRoot(caixa);
  await act(async () => {
    raiz.render(React.createElement(React.Fragment, null,
      React.createElement(AvisoDesfazerGeral),
      React.createElement(Configuracoes, { chaveCasa: CASA, chavePessoal: PESSOAL, chaveInvest: INVEST, larga: false, onFechar: () => {} })));
  });
  await andar(20);
}
async function restaurar() {
  const campo = caixa.querySelector('input[type="file"]');
  Object.defineProperty(campo, "files", { configurable: true, value: [arquivo()] });
  await act(async () => { campo.dispatchEvent(new Event("change", { bubbles: true })); });
  for (let i = 0; i < 50 && !caixa.querySelector(".cf-modal"); i++) await andar(20);
  if (!caixa.querySelector(".cf-modal")) throw new Error("a confirmação de restaurar não abriu: " + (caixa.querySelector(".cf-msg")?.textContent || "sem mensagem"));
  await clicar(caixa.querySelector(".cf-b-verm")); // o botão vermelho "Restaurar"
  await andar(31000);
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-13T15:00:00.000Z") });
  localStorage.clear();
  sessionStorage.clear();
  nuvem = criarNuvemFalsa();
  globalThis.__nuvemFalsa = nuvem;
  for (const k of [CASA, PESSOAL, INVEST]) nuvem.por(k, velho[k], T0);
});
afterEach(async () => {
  await act(async () => { raiz?.unmount(); });
  caixa?.remove();
  vi.useRealTimers();
});

describe("restaurar backup", () => {
  it("tudo certo: troca as três abas, guarda as cópias, anota o Desfazer e registra", async () => {
    await abrir();
    await restaurar();
    expect(nuvem.ler(CASA)).toEqual(doArquivo.casa);
    expect(nuvem.ler(PESSOAL)).toEqual(doArquivo.pessoal);
    expect(nuvem.ler(INVEST)).toEqual(doArquivo.invest);
    expect(copias()).toHaveLength(3);
    const d = desfazerAnotado();
    expect(d.motivo).toBe("restaurar");
    expect(d.parcial).toBeUndefined();
    expect(d.copias.map((c) => c.chave)).toEqual([CASA, PESSOAL, INVEST]);
    expect(registros()).toContain("geral:restaurou");
  });

  it("a rede cai ao guardar as cópias: nada foi mudado, e é isso que a tela diz", async () => {
    await abrir();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id.startsWith(PESSOAL + "-antes-") ? "falha" : "ok"));
    await restaurar();
    for (const k of [CASA, PESSOAL, INVEST]) expect(nuvem.ler(k)).toEqual(velho[k]);
    expect(caixa.textContent).toContain("Nada foi mudado");
    expect(desfazerAnotado()).toBe(null);
    expect(registros()).not.toContain("geral:restaurou");
  });

  it("a rede cai ENTRE uma aba e outra: diz o que trocou e o que não, e o Desfazer aparece", async () => {
    await abrir();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id === PESSOAL ? "falha" : "ok"));
    await restaurar();
    // ficou pela metade
    expect(nuvem.ler(CASA)).toEqual(doArquivo.casa);
    expect(nuvem.ler(PESSOAL)).toEqual(velho[PESSOAL]);
    expect(nuvem.ler(INVEST)).toEqual(velho[INVEST]);
    // a tela conta a verdade
    const txt = caixa.querySelector(".cf-msg").textContent;
    expect(txt).not.toContain("Nada foi mudado");
    expect(txt).toContain("Já trocado: Contas da casa.");
    expect(txt).toContain("Sem confirmação (pode ter trocado ou não): Minhas contas.");
    expect(txt).toContain("Não trocado: Investimentos.");
    // não entra no registro como "restaurou"
    expect(registros()).not.toContain("geral:restaurou");
    // o Desfazer está anotado e na tela, cobrindo o que foi (ou pode ter sido) trocado
    const d = desfazerAnotado();
    expect(d.parcial).toBe(true);
    expect(d.copias.map((c) => c.chave)).toEqual([CASA, PESSOAL]);
    expect(caixa.querySelector(".cf-aviso").textContent).toContain("parou no meio");
    // e funciona: volta tudo como estava
    nuvem.semRegra();
    await clicar(botao("Desfazer"));
    await andar(100);
    for (const k of [CASA, PESSOAL, INVEST]) expect(nuvem.ler(k)).toEqual(velho[k]);
  });

  it("a troca chegou mas ficou sem resposta (pendurada): o Desfazer cobre essa aba também", async () => {
    await abrir();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id === CASA ? "grava-e-pendura" : "ok"));
    await restaurar();
    expect(nuvem.ler(CASA)).toEqual(doArquivo.casa); // chegou, mas o app não soube
    const txt = caixa.querySelector(".cf-msg").textContent;
    expect(txt).toContain("Sem confirmação (pode ter trocado ou não): Contas da casa.");
    expect(txt).toContain("Não trocado: Minhas contas, Investimentos.");
    expect(desfazerAnotado().copias.map((c) => c.chave)).toEqual([CASA]);
    nuvem.semRegra();
    await clicar(botao("Desfazer"));
    await andar(100);
    expect(nuvem.ler(CASA)).toEqual(velho[CASA]);
  });
});

describe("restauração que parou no meio + tentar de novo", () => {
  const recarregar = async () => { // o app recarrega a página depois de trocar tudo
    await act(async () => { raiz.unmount(); });
    caixa.remove();
    await abrir();
  };

  it("tentar de novo NÃO copia o estado meio trocado: o Desfazer volta pro estado de ANTES DE TUDO", async () => {
    await abrir();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id === PESSOAL ? "falha" : "ok"));
    await restaurar(); // casa trocada, pessoal falhou, invest nem começou
    const copiasDaPrimeira = copias();
    expect(nuvem.ler(CASA)).toEqual(doArquivo.casa);
    nuvem.semRegra();
    await restaurar(); // tenta de novo, agora dá certo
    for (const [k, v] of [[CASA, doArquivo.casa], [PESSOAL, doArquivo.pessoal], [INVEST, doArquivo.invest]]) expect(nuvem.ler(k)).toEqual(v);
    // nenhuma cópia nova de Contas da casa / Minhas contas (as originais foram reaproveitadas)
    expect(copias().filter((k) => k.startsWith(CASA + "-antes-"))).toHaveLength(1);
    expect(copias().filter((k) => k.startsWith(PESSOAL + "-antes-"))).toHaveLength(1);
    for (const k of copiasDaPrimeira) expect(copias()).toContain(k);
    for (const k of copias()) expect(nuvem.ler(k)).toEqual(velho[k.split("-antes-")[0]]); // toda cópia guarda o estado de antes de tudo
    const d = desfazerAnotado();
    expect(d.parcial).toBeUndefined();
    expect(d.copias.map((c) => c.chave).sort()).toEqual([CASA, INVEST, PESSOAL].sort());
    expect(registros().filter((a) => a === "geral:restaurou")).toHaveLength(1);
    await recarregar();
    await clicar(botao("Desfazer"));
    await andar(100);
    for (const k of [CASA, PESSOAL, INVEST]) expect(nuvem.ler(k)).toEqual(velho[k]);
  });

  it("falha duas vezes seguidas: o Desfazer continua cobrindo o que a primeira trocou", async () => {
    await abrir();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id === PESSOAL ? "falha" : "ok"));
    await restaurar();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id === CASA ? "falha" : "ok"));
    await restaurar(); // agora cai logo na primeira troca
    expect(desfazerAnotado().copias.map((c) => c.chave).sort()).toEqual([CASA, PESSOAL].sort());
    nuvem.semRegra();
    await clicar(botao("Desfazer"));
    await andar(100);
    for (const k of [CASA, PESSOAL, INVEST]) expect(nuvem.ler(k)).toEqual(velho[k]);
  });

  it("na nova tentativa a rede cai antes de trocar: avisa que a anterior continua pela metade e mantém o Desfazer", async () => {
    await abrir();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id === PESSOAL ? "falha" : "ok"));
    await restaurar();
    const anotado = desfazerAnotado();
    nuvem.quando((op) => (op.tipo === "ler" ? "falha" : "ok"));
    await restaurar();
    expect(caixa.querySelector(".cf-msg").textContent).toContain("continua pela metade");
    expect(caixa.querySelector(".cf-msg").textContent).not.toContain("Nada foi mudado");
    expect(desfazerAnotado()).toEqual(anotado);
  });

  it("anotação parcial vencida (mais de 10 min) não é reaproveitada: copia o estado de agora", async () => {
    await abrir();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id === PESSOAL ? "falha" : "ok"));
    await restaurar();
    nuvem.semRegra();
    await andar(11 * 60 * 1000);
    await restaurar();
    expect(copias().filter((k) => k.startsWith(CASA + "-antes-"))).toHaveLength(2);
  });

  it("rede lenta: a troca que estourou os 30 s é cancelada e não chega atrasada depois do Desfazer", async () => {
    await abrir();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id === CASA ? "lenta" : "ok")); // só chegaria aos 40 s
    await restaurar();
    expect(caixa.querySelector(".cf-msg").textContent).toContain("Sem confirmação (pode ter trocado ou não): Contas da casa.");
    expect(nuvem.gravacoes(CASA)[0].cancelado).toBe(true);
    nuvem.semRegra();
    await clicar(botao("Desfazer"));
    await andar(120000); // bem depois dos 40 s
    expect(nuvem.ler(CASA)).toEqual(velho[CASA]);
  });
});

describe("o aviso de Desfazer fora das Configurações", () => {
  it("leva o próprio estilo (aparece arrumado em qualquer aba)", async () => {
    sessionStorage.setItem("oink-desfazer", JSON.stringify({ motivo: "restaurar", quando: Date.now(), copias: [] }));
    caixa = document.createElement("div");
    document.body.appendChild(caixa);
    raiz = createRoot(caixa);
    await act(async () => { raiz.render(React.createElement(AvisoDesfazerGeral)); });
    expect(caixa.querySelector(".cf-aviso").textContent).toContain("Backup restaurado.");
    expect(caixa.querySelector("style").textContent).toContain(".cf-aviso{position:fixed");
  });
  it("sem nada pra desfazer, não põe nada na tela", async () => {
    caixa = document.createElement("div");
    document.body.appendChild(caixa);
    raiz = createRoot(caixa);
    await act(async () => { raiz.render(React.createElement(AvisoDesfazerGeral)); });
    expect(caixa.innerHTML).toBe("");
  });
});

describe("começar do zero (Minhas contas)", () => {
  async function zerar() {
    const apagar = () => [...caixa.querySelectorAll(".cf-bt-perigo")].pop(); // o último botão vermelho da tela
    for (let i = 0; i < 3; i++) await clicar(apagar());
    await andar(31000);
  }
  it("guarda a cópia antes e apaga só os lançamentos", async () => {
    await abrir();
    await zerar();
    expect(nuvem.ler(PESSOAL).lancamentos).toEqual([]);
    expect(copias()).toHaveLength(1);
    expect(nuvem.ler(copias()[0])).toEqual(velho[PESSOAL]);
    expect(desfazerAnotado().motivo).toBe("zerar");
    expect(registros()).toContain("geral:zerou");
  });
  it("a troca falha: os lançamentos continuam lá e a tela não diz que apagou", async () => {
    await abrir();
    nuvem.quando((op) => (op.tipo === "upsert" && op.id === PESSOAL ? "falha" : "ok"));
    await zerar();
    expect(nuvem.ler(PESSOAL)).toEqual(velho[PESSOAL]);
    expect(caixa.querySelector(".cf-msg").textContent).toContain("Sem confirmação");
    expect(desfazerAnotado().parcial).toBe(true);
    expect(registros()).not.toContain("geral:zerou"); // só registra depois que deu certo
  });
});
