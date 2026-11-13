// Uma "nuvem de mentira" que imita o pedacinho do Supabase que o app usa
// (tabela app_data + cofre app_historico), toda na memória. Serve pra testar
// a gravação/leitura sem tocar em nenhum dado de verdade.
//
// Imita de propósito duas manias do banco real:
//  - devolve o carimbo no formato do Postgres ("...+00:00"), diferente do
//    ISO que o app manda ("...Z");
//  - devolve o conteúdo com as chaves reordenadas (o `jsonb` faz isso).
//
// `nuvem.quando(fn)` deixa o teste decidir o que acontece com cada pedido:
//   "ok"              funciona
//   "falha"           NÃO grava/lê e devolve erro
//   "perde-resposta"  GRAVA, mas a resposta se perde (erro de rede)
//   "pendura"         NÃO grava e nunca responde
//   "grava-e-pendura" GRAVA e nunca responde
//   "demora"          funciona, mas a resposta leva 3 s
//   "recusa"          o servidor responde recusando (status 403): NÃO grava
//   "lenta"           só chega no servidor depois de 40 s — se não for cancelado antes

const instante = (t) => Date.parse(t);
const comoPostgres = (iso) => new Date(iso).toISOString().replace("Z", "+00:00");
const comoJsonb = (v) => {
  if (Array.isArray(v)) return v.map(comoJsonb);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort().reverse()) o[k] = comoJsonb(v[k]);
    return o;
  }
  return v;
};
const copia = (v) => JSON.parse(JSON.stringify(v));

export function criarNuvemFalsa() {
  const linhas = new Map(); // id → { data, updated_at }
  const historico = [];
  const pedidos = []; // tudo que o app pediu, na ordem
  let regra = () => "ok";

  function aplicar(op) {
    if (op.tipo === "ler") {
      const l = linhas.get(op.id);
      if (!l) return { data: null, error: null };
      const data = { updated_at: comoPostgres(l.updated_at) };
      if (op.colunas.includes("data")) data.data = comoJsonb(l.data);
      return { data, error: null, status: 200 };
    }
    if (op.tipo === "upsert") {
      linhas.set(op.id, { data: copia(op.data), updated_at: op.updated_at });
      return { error: null };
    }
    if (op.tipo === "inserir") {
      if (linhas.has(op.id)) return { error: { code: "23505", message: "duplicate key" }, status: 409 };
      linhas.set(op.id, { data: copia(op.data), updated_at: op.updated_at });
      return { error: null };
    }
    // "atualizar se o carimbo ainda é o esperado"
    const l = linhas.get(op.id);
    if (!l || instante(l.updated_at) !== instante(op.esperado)) return { data: [], error: null };
    linhas.set(op.id, { data: copia(op.data), updated_at: op.updated_at });
    return { data: [{ updated_at: comoPostgres(op.updated_at) }], error: null };
  }

  // Cada pedido é "preguiçoso" como no Supabase de verdade: só sai quando
  // alguém espera por ele, e aceita .abortSignal(sinal) pra ser cancelado.
  function pedir(op) {
    let sinal = null;
    let prom = null;
    const rodar = () => {
      const modo = regra(op) || "ok";
      const reg = { ...op, modo, cancelado: false };
      pedidos.push(reg);
      if (sinal) sinal.addEventListener("abort", () => { reg.cancelado = true; });
      if (modo === "pendura") return new Promise(() => {});
      if (modo === "falha") return Promise.resolve({ data: null, error: { message: "falha de mentira" }, status: 503 });
      if (modo === "recusa") return Promise.resolve({ data: null, error: { message: "permission denied", code: "42501" }, status: 403 });
      // rede lenta: o pedido só chega no servidor depois de 40 s — se não tiver sido cancelado antes
      if (modo === "lenta") {
        return new Promise((ok) => setTimeout(() => { if (!reg.cancelado) ok(aplicar(op)); }, 40000));
      }
      const r = aplicar(op);
      if (modo === "perde-resposta") return Promise.reject(new TypeError("Failed to fetch (de mentira)"));
      if (modo === "grava-e-pendura") return new Promise(() => {});
      if (modo === "demora") return new Promise((ok) => setTimeout(() => ok(r), 3000));
      return Promise.resolve(r);
    };
    const pedido = {
      abortSignal(s) { sinal = s; return pedido; },
      then(sim, nao) { return (prom || (prom = rodar())).then(sim, nao); },
    };
    return pedido;
  }

  const supabase = {
    from(tabela) {
      if (tabela === "app_historico") {
        return {
          insert(itens) {
            historico.push(...copia(itens));
            return Promise.resolve({ error: null });
          },
        };
      }
      if (tabela !== "app_data") throw new Error("tabela inesperada no teste: " + tabela);
      return {
        select(colunas) {
          const f = {};
          const b = {
            eq(c, v) { f[c] = v; return b; },
            maybeSingle() { return pedir({ tipo: "ler", id: f.id, colunas }); },
          };
          return b;
        },
        upsert(l) { return pedir({ tipo: "upsert", id: l.id, data: l.data, updated_at: l.updated_at }); },
        insert(l) { return pedir({ tipo: "inserir", id: l.id, data: l.data, updated_at: l.updated_at }); },
        update(v) {
          const f = {};
          const b = {
            eq(c, val) { f[c] = val; return b; },
            select() { return pedir({ tipo: "atualizar", id: f.id, esperado: f.updated_at, data: v.data, updated_at: v.updated_at }); },
          };
          return b;
        },
      };
    },
  };

  return {
    supabase,
    linhas,
    historico,
    pedidos,
    quando(fn) { regra = fn; },
    semRegra() { regra = () => "ok"; },
    // põe uma linha direto (como se já existisse, ou como se OUTRO aparelho tivesse gravado)
    por(id, data, updated_at = new Date().toISOString()) {
      linhas.set(id, { data: copia(data), updated_at });
    },
    ler(id) { return linhas.get(id)?.data; },
    ids(prefixo = "") { return [...linhas.keys()].filter((k) => k.startsWith(prefixo)); },
    gravacoes(id) { return pedidos.filter((p) => p.id === id && p.tipo !== "ler"); },
  };
}
