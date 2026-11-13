// Confere que as gravações funcionam com a biblioteca do Supabase DE VERDADE
// (a mesma que vai pro app), mas com a "internet" trocada por uma de mentira:
// nenhum pedido sai do computador. Serve pra garantir que o cancelamento
// (30 s) e o "status" do erro chegam como o app espera.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const pedidos = [];
let responder = null; // (url, init) => Response | "pendura"

const internetDeMentira = (url, init = {}) => {
  const reg = { url: String(url), metodo: init.method, sinal: init.signal };
  pedidos.push(reg);
  const r = responder(reg);
  if (r !== "pendura") return Promise.resolve(r);
  return new Promise((_, nao) => {
    if (init.signal) init.signal.addEventListener("abort", () => nao(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
};

vi.mock("../src/supa.js", () => ({
  supabase: createClient("http://nuvem-de-mentira.invalid", "chave-de-mentira", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (...a) => internetDeMentira(...a) },
  }),
}));
const { nuvem } = await import("../src/pessoal/nuvem.js");

const json = (corpo, status) => new Response(corpo === null ? null : JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => { pedidos.length = 0; });
afterEach(() => vi.useRealTimers());

describe("gravação com o cliente Supabase de verdade (sem rede)", () => {
  it("gravação condicional que deu certo", async () => {
    responder = () => json([{ updated_at: "2026-11-13T12:00:00+00:00" }], 200);
    await expect(nuvem.setIfUnchanged("k", { a: 1 }, "2026-11-13T11:00:00.000Z", "2026-11-13T12:00:00.000Z")).resolves.toEqual({ ok: true });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].metodo).toBe("PATCH");
    expect(pedidos[0].url).toContain("/rest/v1/app_data");
    expect(pedidos[0].sinal).toBeTruthy(); // o pedido saiu com o "sinal de cancelar" ligado
    expect(pedidos[0].sinal.aborted).toBe(false);
  });

  it("ninguém atualizado (outro aparelho gravou) → conflito", async () => {
    responder = () => json([], 200);
    await expect(nuvem.setIfUnchanged("k", { a: 1 }, "2026-11-13T11:00:00.000Z", "2026-11-13T12:00:00.000Z")).resolves.toEqual({ conflict: true });
  });

  it("linha nova que já existe → conflito", async () => {
    responder = () => json({ code: "23505", message: "duplicate key value" }, 409);
    await expect(nuvem.setIfUnchanged("k", { a: 1 }, null, "2026-11-13T12:00:00.000Z")).resolves.toEqual({ conflict: true });
    expect(pedidos[0].metodo).toBe("POST");
  });

  it("servidor recusa (403): o erro leva o status, pro app saber que NÃO entrou", async () => {
    responder = () => json({ code: "42501", message: "permission denied for table app_data" }, 403);
    const erro = await nuvem.set("k", { a: 1 }).catch((e) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro.status).toBe(403);
    expect(erro.code).toBe("42501");
  });

  it("rede pendurada: aos 30 s o pedido é CANCELADO de verdade e vira erro", async () => {
    vi.useFakeTimers();
    responder = () => "pendura";
    let fim = "esperando";
    nuvem.setIfUnchanged("k", { a: 1 }, "2026-11-13T11:00:00.000Z", "2026-11-13T12:00:00.000Z").then(() => { fim = "ok"; }, () => { fim = "erro"; });
    await vi.advanceTimersByTimeAsync(29000);
    expect(fim).toBe("esperando");
    expect(pedidos[0].sinal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1500);
    expect(fim).toBe("erro");
    expect(pedidos[0].sinal.aborted).toBe(true);
  });

  it("cópias/trocas (upsert) também saem com cancelamento e são canceladas aos 30 s", async () => {
    vi.useFakeTimers();
    responder = () => "pendura";
    let fim = "esperando";
    nuvem.set("k-antes-restaurar-x", { a: 1 }).then(() => { fim = "ok"; }, () => { fim = "erro"; });
    await vi.advanceTimersByTimeAsync(30500);
    expect(fim).toBe("erro");
    expect(pedidos[0].metodo).toBe("POST");
    expect(pedidos[0].sinal.aborted).toBe(true);
  });

  it("leitura continua como era: falha vira 'falhou' (nunca 'vazio')", async () => {
    responder = () => json({ message: "erro" }, 500);
    await expect(nuvem.get("k")).resolves.toEqual({ failed: true });
  });
});
