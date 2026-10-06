import { createClient } from "@supabase/supabase-js";

// Um cliente Supabase só, pro app inteiro (Casa, Minhas contas, Investimentos).
// Antes eram dois (um na Casa e outro em pessoal/nuvem.js) — com login, os dois
// precisam mandar a MESMA entrada, senão uma aba ficaria "de fora".
const SUPABASE_URL = "https://oikbmfdlhvqesbgnmeky.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pa2JtZmRsaHZxZXNiZ25tZWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMjUxMTgsImV4cCI6MjEwNDgwMTExOH0.VRvyNxYyvkjNaBnKAsHqfDTZxSM8pd5W9k5ElqGeeF8";

// Se o link do e-mail venceu/já foi usado, ele volta com um erro no endereço.
// Lê ANTES de criar o cliente: o Supabase apaga isso do endereço ao iniciar.
export const erroDoLinkNaChegada = (() => {
  try {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const q = new URLSearchParams(window.location.search);
    return h.get("error_code") || q.get("error_code") || h.get("error") || q.get("error") || null;
  } catch (e) {
    return null;
  }
})();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true, // o aparelho fica lembrado
    autoRefreshToken: true,
    detectSessionInUrl: true, // o link do e-mail volta com a entrada no endereço
    // "implicit": o link funciona mesmo se abrir num navegador diferente de onde
    // o e-mail foi pedido (no Android acontece); o código de 6 números cobre o resto
    flowType: "implicit",
    storageKey: "oink-entrada",
  },
});

// Só este e-mail entra (o banco confere de novo quando as regras novas forem ligadas).
export const EMAIL_DO_DONO = "joel.netomga@gmail.com";
