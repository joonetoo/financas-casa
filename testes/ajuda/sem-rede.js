// Roda antes de cada arquivo de teste: NENHUM teste pode falar com a internet
// (muito menos com o Supabase de verdade). Se algum código tentar, o teste quebra.
import { vi } from "vitest";

vi.stubGlobal("fetch", () => {
  throw new Error("Teste tentou usar a rede — proibido. Use a nuvem de mentira (testes/ajuda/nuvemFalsa.js).");
});
