// NUVEM-FALSA-OINK-PREVIA
//
// Nuvem de MENTIRA, só pro modo de pré-visualização do servidor de desenvolvimento
// (`VITE_NUVEM_FALSA=1 npx vite`). O plugin `nuvemFalsa()` do vite.config.js
// troca `src/supa.js` por este arquivo — só em `vite serve`, nunca no build.
//
// Aqui NÃO existe cliente Supabase: nada sai pra rede, nada é lido nem gravado
// na nuvem de verdade. Tudo mora na memória da página (recarregou, voltou pras
// sementes de `sementes.js`, que são dados INVENTADOS).
//
// Imita só o que o app usa de `supabase` (ver testes/ajuda/nuvemFalsa.js, de
// onde isto saiu, sem as regras de falha).

import { montarSementes } from "./sementes.js";

export const MARCA_NUVEM_FALSA = "NUVEM-FALSA-OINK-PREVIA";

export const EMAIL_DO_DONO = "previa@oink.test";
export const erroDoLinkNaChegada = null;

const copia = (v) => JSON.parse(JSON.stringify(v));
const instante = (t) => Date.parse(t);
const comoPostgres = (iso) => new Date(iso).toISOString().replace("Z", "+00:00");

const linhas = new Map(); // id → { data, updated_at }
const historico = []; // cofre de mentira (app_historico)
let proximoIdHist = 1;

function aplicar(op) {
  if (op.tipo === "ler") {
    const l = linhas.get(op.id);
    if (!l) return { data: null, error: null, status: 200 };
    const data = { updated_at: comoPostgres(l.updated_at) };
    if (op.colunas.includes("data")) data.data = copia(l.data);
    return { data, error: null, status: 200 };
  }
  if (op.tipo === "upsert") {
    linhas.set(op.id, { data: copia(op.data), updated_at: op.updated_at });
    return { data: null, error: null, status: 201 };
  }
  if (op.tipo === "inserir") {
    if (linhas.has(op.id)) return { data: null, error: { code: "23505", message: "duplicate key" }, status: 409 };
    linhas.set(op.id, { data: copia(op.data), updated_at: op.updated_at });
    return { data: null, error: null, status: 201 };
  }
  // "atualizar se o carimbo ainda é o esperado"
  const l = linhas.get(op.id);
  if (!l || instante(l.updated_at) !== instante(op.esperado)) return { data: [], error: null, status: 200 };
  linhas.set(op.id, { data: copia(op.data), updated_at: op.updated_at });
  return { data: [{ updated_at: comoPostgres(op.updated_at) }], error: null, status: 200 };
}

// Pedido "preguiçoso" como no Supabase de verdade: só roda quando alguém
// espera por ele, e aceita .abortSignal(sinal).
function pedir(rodar) {
  let prom = null;
  const pedido = {
    abortSignal() { return pedido; },
    then(sim, nao) { return (prom || (prom = Promise.resolve().then(rodar))).then(sim, nao); },
    catch(nao) { return pedido.then(undefined, nao); },
  };
  return pedido;
}

function tabelaDados() {
  return {
    select(colunas = "*") {
      const f = {};
      const b = {
        eq(c, v) { f[c] = v; return b; },
        maybeSingle() { return pedir(() => aplicar({ tipo: "ler", id: f.id, colunas })); },
      };
      return b;
    },
    upsert(l) { return pedir(() => aplicar({ tipo: "upsert", id: l.id, data: l.data, updated_at: l.updated_at })); },
    insert(l) { return pedir(() => aplicar({ tipo: "inserir", id: l.id, data: l.data, updated_at: l.updated_at })); },
    update(v) {
      const f = {};
      const b = {
        eq(c, val) { f[c] = val; return b; },
        select() {
          return pedir(() => aplicar({ tipo: "atualizar", id: f.id, esperado: f.updated_at, data: v.data, updated_at: v.updated_at }));
        },
      };
      return b;
    },
  };
}

function tabelaHistorico() {
  return {
    insert(itens) {
      const lista = Array.isArray(itens) ? itens : [itens];
      return pedir(() => {
        for (const it of copia(lista)) historico.push({ id: proximoIdHist++, ...it });
        return { data: null, error: null, status: 201 };
      });
    },
    // select(...).eq().neq().order().limit() → { data: [...], error: null }
    select() {
      const filtros = [];
      let ordem = null;
      let limite = Infinity;
      const rodar = () => {
        let r = historico.filter((h) => filtros.every((fn) => fn(h)));
        if (ordem) {
          const { coluna, crescente } = ordem;
          r = r.slice().sort((a, b) => (a[coluna] < b[coluna] ? -1 : a[coluna] > b[coluna] ? 1 : 0) * (crescente ? 1 : -1));
        }
        return { data: copia(r.slice(0, limite)), error: null, status: 200 };
      };
      const p = pedir(rodar);
      const b = {
        eq(c, v) { filtros.push((h) => h[c] === v); return b; },
        neq(c, v) { filtros.push((h) => h[c] !== v); return b; },
        order(coluna, opc = {}) { ordem = { coluna, crescente: opc.ascending !== false }; return b; },
        limit(n) { limite = n; return b; },
        abortSignal() { return b; },
        then: p.then,
        catch: p.catch,
      };
      return b;
    },
  };
}

const sessao = { user: { id: "previa", email: EMAIL_DO_DONO } };

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: sessao }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    // inofensivos: na prévia não existe entrada de verdade
    signOut: async () => ({ error: null }),
    signInWithOtp: async () => ({ data: {}, error: null }),
    verifyOtp: async () => ({ data: { session: sessao }, error: null }),
  },
  from(tabela) {
    if (tabela === "app_data") return tabelaDados();
    if (tabela === "app_historico") return tabelaHistorico();
    throw new Error(`${MARCA_NUVEM_FALSA}: tabela inesperada: ${tabela}`);
  },
};

// Sementes: dados inventados, gravados na memória ao abrir a página.
const carimbo = new Date().toISOString();
for (const [id, data] of Object.entries(montarSementes())) linhas.set(id, { data: copia(data), updated_at: carimbo });

if (typeof window !== "undefined") {
  // pra conferir pelo console/puppeteer (só existe neste modo)
  window.__nuvemFalsa = { marca: MARCA_NUVEM_FALSA, linhas, historico };
  console.info(`[${MARCA_NUVEM_FALSA}] nuvem em memória com dados inventados — nada vai pro Supabase.`);
}
