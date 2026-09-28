// Guardar e buscar as abas novas (Minhas contas, Investimentos) no Supabase.
//
// É a MESMA proteção que já roda na aba da casa (App.jsx), só que num
// "gancho" reutilizável — cada aba tem a sua linha, então um problema numa
// nunca estraga a outra. Regras (skill zero-data-loss):
//  1. ler distingue "linha vazia" de "falhou"; falhou 4x → tela de erro e
//     NUNCA grava (sem `carregado`, nada salva);
//  2. uma gravação por vez, sempre com o estado mais novo;
//  3. só grava se houve edição aqui (abrir/esconder não grava);
//  4. grava só se ninguém gravou desde a versão que este aparelho tem
//     (setIfUnchanged); se outro aparelho gravou → guarda a versão daqui numa
//     linha "-conflito-", carrega a da nuvem e avisa;
//  5. erro ao salvar aparece na tela e tenta de novo a cada 5s;
//  6. busca a versão nova ao voltar pra tela, ao clicar na janela e a cada 30s;
//  7. foto diária (backup) depois de uma leitura boa.
// E o novo: cada alteração vai também pro "cofre" (tabela app_historico), onde
// o app só consegue ACRESCENTAR — nem um erro do app consegue apagar o passado.

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://oikbmfdlhvqesbgnmeky.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pa2JtZmRsaHZxZXNiZ25tZWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMjUxMTgsImV4cCI6MjEwNDgwMTExOH0.VRvyNxYyvkjNaBnKAsHqfDTZxSM8pd5W9k5ElqGeeF8";

// sem login: não guarda sessão (e não briga com o cliente da aba da casa)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: "fc-pessoal-auth" },
});

const p2 = (n) => String(n).padStart(2, "0");
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

// Sem internet de verdade, o pedido pode demorar bem mais que uma falha
// normal pra desistir sozinho (às vezes minutos) — trava a tela de
// "carregando" sem nunca chegar no aviso. Limite de tempo: sem resposta em
// 6s, trata como falha (nunca como "vazio").
const comLimite = (prom, ms = 6000) => Promise.race([prom, new Promise((r) => setTimeout(() => r({ limite: true }), ms))]);

export const nuvem = {
  async get(key) {
    try {
      const res = await comLimite(supabase.from("app_data").select("data, updated_at").eq("id", key).maybeSingle());
      if (res.limite) return { failed: true };
      const { data, error } = res;
      if (error) return { failed: true };
      if (!data) return { value: null };
      return { value: data.data, updatedAt: data.updated_at };
    } catch (e) {
      return { failed: true };
    }
  },
  async getStamp(key) {
    try {
      const res = await comLimite(supabase.from("app_data").select("updated_at").eq("id", key).maybeSingle());
      if (res.limite) return { failed: true };
      const { data, error } = res;
      if (error) return { failed: true };
      return { updatedAt: data ? data.updated_at : null };
    } catch (e) {
      return { failed: true };
    }
  },
  // cópias (backup/conflito): grava sempre; lança erro se falhar
  async set(key, doc) {
    const { error } = await supabase
      .from("app_data").upsert({ id: key, data: doc, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
  async setIfUnchanged(key, doc, esperado, novoCarimbo) {
    if (!esperado) {
      const { error } = await supabase.from("app_data").insert({ id: key, data: doc, updated_at: novoCarimbo });
      if (error) {
        if (error.code === "23505") return { conflict: true };
        throw error;
      }
      return { ok: true };
    }
    const { data, error } = await supabase
      .from("app_data")
      .update({ data: doc, updated_at: novoCarimbo })
      .eq("id", key).eq("updated_at", esperado)
      .select("updated_at");
    if (error) throw error;
    if (!data || data.length === 0) return { conflict: true };
    return { ok: true };
  },
};

/* ---------------- cofre (registro de atividades) ---------------- */

export const aparelho = () => {
  try {
    return window.matchMedia("(pointer: coarse)").matches ? "celular" : "computador";
  } catch (e) {
    return "";
  }
};

const filaKey = (chave) => `fc-hist-fila:${chave}`;
const lerFila = (chave) => {
  try {
    return JSON.parse(localStorage.getItem(filaKey(chave)) || "[]");
  } catch (e) {
    return [];
  }
};
const gravarFila = (chave, fila) => {
  try {
    localStorage.setItem(filaKey(chave), JSON.stringify(fila));
  } catch (e) { /* aparelho sem espaço: segue só na memória */ }
};

const filaMemoria = {};
let enviando = false;

// Guarda o registro primeiro NO APARELHO e depois manda pro cofre; se estiver
// sem internet (ou o cofre ainda não existir), tenta de novo depois — nada se
// perde no caminho.
export function registrar(chave, entrada) {
  const item = { chave, quando: new Date().toISOString(), aparelho: aparelho(), ...entrada };
  const fila = lerFila(chave).concat(filaMemoria[chave] || [], [item]);
  filaMemoria[chave] = [];
  gravarFila(chave, fila);
  enviarFila(chave);
}

export async function enviarFila(chave) {
  if (enviando) return;
  const fila = lerFila(chave);
  if (!fila.length) return;
  enviando = true;
  try {
    const { error } = await supabase.from("app_historico").insert(fila);
    if (!error) {
      // tira só o que foi enviado (algo pode ter entrado na fila enquanto isso)
      const atual = lerFila(chave);
      gravarFila(chave, atual.slice(fila.length));
    }
  } catch (e) {
    /* sem rede: fica na fila */
  } finally {
    enviando = false;
  }
}

export async function lerHistorico(chave, limite = 300) {
  try {
    const { data, error } = await supabase
      .from("app_historico")
      .select("id, quando, acao, resumo, antes, depois, aparelho")
      .eq("chave", chave).neq("acao", "foto")
      .order("quando", { ascending: false })
      .limit(limite);
    if (error) return { failed: true, error };
    const pendentes = lerFila(chave).filter((e) => e.acao !== "foto").reverse();
    return { itens: pendentes.map((e) => ({ ...e, pendente: true })).concat(data || []) };
  } catch (e) {
    return { failed: true };
  }
}

/* ---------------- o gancho ---------------- */

export function useDocNuvem(chave, { vazio, normalizar = (d) => d }) {
  const [doc, setDoc] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(false);
  const [conflito, setConflito] = useState(null);

  const docRef = useRef(null);
  docRef.current = doc;
  const lastSyncedRef = useRef(null);
  const dirtyRef = useRef(false);
  const fromServerRef = useRef(false);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const retryRef = useRef(null);
  const puxandoRef = useRef(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Sem internet, já se sabe de cara — vai direto pro aviso, sem tentar
      // a rede (senão a tela de "carregando" fica presa até as tentativas
      // abaixo desistirem uma por uma).
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setErroCarregar(true);
        return;
      }
      let res = await nuvem.get(chave);
      for (let t = 0; res.failed && t < 3; t++) {
        await new Promise((r) => setTimeout(r, 800 * (t + 1)));
        res = await nuvem.get(chave);
      }
      if (!vivo) return;
      if (res.failed) {
        setErroCarregar(true);
        return;
      }
      let d;
      if (res.value) {
        d = normalizar(res.value);
        lastSyncedRef.current = res.updatedAt || null;
        fromServerRef.current = true; // carregar não é editar
        fotoDoDia(chave, res.value);
      } else {
        d = normalizar(vazio()); // linha nova: grava na primeira edição
      }
      setDoc(d);
      setCarregado(true);
    })();
    enviarFila(chave);
    return () => {
      vivo = false;
    };
  }, [chave]);

  const flushSave = useCallback(async () => {
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    clearTimeout(retryRef.current);
    retryRef.current = null;
    if (!dirtyRef.current) return;
    savingRef.current = true;
    dirtyRef.current = false;
    const agora = docRef.current;
    const carimbo = new Date().toISOString();
    let ok = false, bateu = false;
    try {
      const r = await nuvem.setIfUnchanged(chave, agora, lastSyncedRef.current, carimbo);
      if (r.conflict) bateu = true;
      else {
        lastSyncedRef.current = carimbo;
        ok = true;
      }
    } catch (e) {
      dirtyRef.current = true;
    } finally {
      savingRef.current = false;
    }
    if (bateu) {
      await resolverRef.current(agora);
      return;
    }
    setErroSalvar(!ok);
    if (pendingRef.current) {
      pendingRef.current = false;
      flushSave();
    } else if (!ok) {
      retryRef.current = setTimeout(flushSave, 5000);
    }
  }, [chave]);

  const resolverRef = useRef(null);
  resolverRef.current = async (docLocal) => {
    const d = new Date();
    const idCopia = `${chave}-conflito-${hoje()}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    const falhou = () => {
      dirtyRef.current = true;
      setErroSalvar(true);
      retryRef.current = setTimeout(flushSave, 5000);
    };
    try {
      await nuvem.set(idCopia, docLocal);
    } catch (e) {
      return falhou();
    }
    const res = await nuvem.get(chave);
    if (res.failed || !res.value) return falhou();
    if (dirtyRef.current) {
      try { await nuvem.set(idCopia, docRef.current); } catch (e) { /* a 1ª cópia já está salva */ }
    }
    lastSyncedRef.current = res.updatedAt || null;
    dirtyRef.current = false;
    pendingRef.current = false;
    fromServerRef.current = true;
    setDoc(normalizar(res.value));
    setErroSalvar(false);
    setConflito({ quando: `${p2(d.getDate())}/${p2(d.getMonth() + 1)} às ${p2(d.getHours())}:${p2(d.getMinutes())}` });
  };

  const puxarSeMudou = useCallback(async () => {
    if (!carregado || dirtyRef.current || savingRef.current || puxandoRef.current) return;
    puxandoRef.current = true;
    try {
      const s = await nuvem.getStamp(chave);
      if (s.failed || !s.updatedAt) return;
      if (lastSyncedRef.current && Date.parse(s.updatedAt) === Date.parse(lastSyncedRef.current)) return;
      const res = await nuvem.get(chave);
      if (res.failed || !res.value) return;
      if (dirtyRef.current || savingRef.current) return;
      lastSyncedRef.current = res.updatedAt || null;
      fromServerRef.current = true;
      setDoc(normalizar(res.value));
    } finally {
      puxandoRef.current = false;
    }
    enviarFila(chave);
  }, [carregado, chave]);

  // toda mudança de `doc` que não veio da nuvem é edição: marca e grava
  useEffect(() => {
    if (!carregado || !doc) return;
    if (fromServerRef.current) {
      fromServerRef.current = false;
      return;
    }
    dirtyRef.current = true;
    flushSave();
  }, [doc, carregado, flushSave]);

  useEffect(() => {
    if (!erroSalvar) return;
    const antes = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [erroSalvar]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (carregado && dirtyRef.current) flushSave();
      } else {
        puxarSeMudou();
      }
    };
    const onPageHide = () => {
      if (carregado && dirtyRef.current) flushSave();
    };
    const onFocus = () => puxarSeMudou();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") puxarSeMudou();
    }, 30000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onFocus);
      clearInterval(iv);
    };
  }, [carregado, flushSave, puxarSeMudou]);

  // editar(fn): fn recebe o documento atual e devolve o novo (sem mexer no antigo)
  const editar = useCallback((fn) => setDoc((atual) => (atual ? fn(atual) : atual)), []);

  return {
    doc, editar, carregado, erroCarregar, erroSalvar, conflito,
    fecharConflito: () => setConflito(null),
  };
}

// Backup do dia: 1x por dia, só de uma leitura que deu certo.
//  - rotativo de 7 dias em app_data (igual à casa);
//  - e uma "foto" no cofre, que ninguém consegue apagar pelo app.
async function fotoDoDia(chave, docBom) {
  const flag = `fc-backup:${chave}`;
  try {
    if (localStorage.getItem(flag) === hoje()) return;
    await nuvem.set(`${chave}-backup-${new Date().getDay()}`, docBom);
    localStorage.setItem(flag, hoje());
    registrar(chave, { acao: "foto", resumo: "Backup do dia", depois: docBom });
  } catch (e) {
    /* tenta de novo no próximo carregamento */
  }
}
