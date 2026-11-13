// Pedacinhos de decisão da sincronização com a nuvem, sem React e sem rede —
// ficam aqui separados pra poderem ser testados sozinhos (ver testes/).
// Quem usa: App.jsx (Contas da casa) e pessoal/nuvem.js (as outras abas).

// Tempo máximo de uma GRAVAÇÃO (folgado: em rede fraca um documento de 200 KB
// demora). Passou disso, o pedido é CANCELADO de verdade (não fica pendurado
// nem se empilha com o próximo) e conta como falha comum: o app avisa e tenta
// de novo em 5 s. Atenção: se o servidor já tinha recebido, a gravação pode
// ter entrado mesmo assim — por isso existe `acharMinhaGravacao` aqui embaixo.
export const LIMITE_GRAVACAO_MS = 30000;

// `pedido` é uma função que recebe o "sinal de cancelar" e devolve o pedido
// (ex.: (sinal) => supabase.from(...).upsert(...).abortSignal(sinal)).
// Estourou o tempo → cancela o pedido e lança erro (igual a uma falha de rede).
export function comLimiteOuErro(pedido, ms = LIMITE_GRAVACAO_MS) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  let t;
  const limite = new Promise((_, rej) => {
    t = setTimeout(() => {
      try { if (ctl) ctl.abort(); } catch (e) { /* cancelar é um extra */ }
      rej(new Error("limite de tempo da gravação"));
    }, ms);
  });
  let andamento;
  try {
    andamento = typeof pedido === "function" ? pedido(ctl ? ctl.signal : undefined) : pedido;
  } catch (e) {
    clearTimeout(t);
    return Promise.reject(e);
  }
  return Promise.race([Promise.resolve(andamento), limite]).finally(() => clearTimeout(t));
}

// liga o sinal de cancelar num pedido do Supabase (se ele souber cancelar)
export const comSinal = (pedido, sinal) =>
  sinal && pedido && typeof pedido.abortSignal === "function" ? pedido.abortSignal(sinal) : pedido;

// Erro de gravação que carrega o "status" da resposta do servidor (quando houve).
export function erroDeGravacao(error, status) {
  const e = new Error((error && error.message) || "falha ao gravar");
  e.code = error && error.code;
  e.status = status;
  e.original = error;
  return e;
}

// Depois de um erro ao gravar: a gravação PODE ter entrado na nuvem?
//  - o aparelho já estava sem internet antes de mandar → não (nem saiu daqui);
//  - o servidor respondeu recusando (status 4xx) → não (comprovadamente não entrou);
//  - o resto (rede caiu no meio, tempo estourou, erro 5xx) → pode ter entrado.
export function podeTerChegado(erro, { offlineAntes = false } = {}) {
  if (offlineAntes) return false;
  const st = Number(erro && erro.status);
  if (st >= 400 && st < 500) return false;
  return true;
}

// O carimbo que o app manda ("2026-11-13T12:00:00.123Z") e o que o banco
// devolve ("2026-11-13T12:00:00.123+00:00") são o MESMO momento escrito de
// dois jeitos: compara como instante, nunca como texto.
export function mesmoInstante(a, b) {
  if (!a || !b) return false;
  const x = Date.parse(a);
  const y = Date.parse(b);
  return Number.isFinite(x) && Number.isFinite(y) && x === y;
}

// Dois documentos têm o mesmo conteúdo? A ordem das chaves não importa (o
// banco guarda em `jsonb`, que reordena as chaves); a ordem das listas importa.
export function igualJson(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const la = Array.isArray(a);
  const lb = Array.isArray(b);
  if (la !== lb) return false;
  if (la) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!igualJson(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!igualJson(a[k], b[k])) return false;
  }
  return true;
}

// do jeito que o documento chega na nuvem (sem `undefined`, etc.)
const comoVaiPraNuvem = (doc) => {
  try {
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    return undefined;
  }
};

const carimbosDe = (t) => (Array.isArray(t.carimbos) ? t.carimbos : t.carimbo ? [t.carimbo] : []);

// "Essa linha que está na nuvem é uma gravação MINHA que eu não soube se chegou?"
// `tentativas`: [{ doc, carimbos: [...] }] — gravações deste aparelho que
// ficaram sem resposta (rede caiu no meio, estourou o tempo), uma entrada por
// documento, com todos os carimbos com que ele foi enviado.
// `linha`: { updatedAt, value } lida agora.
// Só diz que sim se o carimbo for o mesmo instante E o conteúdo for igual ao
// enviado. Devolve a tentativa que bateu (tem `.doc`), ou null.
export function acharMinhaGravacao(tentativas, linha) {
  if (!linha || !linha.updatedAt || linha.value === null || linha.value === undefined) return null;
  for (const t of tentativas || []) {
    if (!t || !carimbosDe(t).some((c) => mesmoInstante(c, linha.updatedAt))) continue;
    const enviado = comoVaiPraNuvem(t.doc);
    if (enviado !== undefined && igualJson(enviado, linha.value)) return t;
  }
  return null;
}

// Lembra de uma gravação que ficou sem resposta. Guarda POR DOCUMENTO: repetir
// o mesmo conteúdo só acrescenta o carimbo novo na mesma entrada — assim, uma
// sequência longa de repetições não expulsa a primeira (que pode ter chegado).
// Limites folgados só pra não crescer sem fim.
export function lembrarTentativa(tentativas, nova, { maxDocs = 6, maxCarimbos = 240 } = {}) {
  const lista = (tentativas || []).map((t) => ({ doc: t.doc, carimbos: carimbosDe(t) }));
  let i = lista.findIndex((t) => t.doc === nova.doc);
  if (i < 0) {
    const novo = comoVaiPraNuvem(nova.doc);
    i = lista.findIndex((t) => novo !== undefined && igualJson(comoVaiPraNuvem(t.doc), novo));
  }
  if (i >= 0) {
    const [t] = lista.splice(i, 1);
    lista.push({ doc: t.doc, carimbos: [...t.carimbos, nova.carimbo].slice(-maxCarimbos) });
  } else {
    lista.push({ doc: nova.doc, carimbos: [nova.carimbo] });
  }
  return lista.slice(-maxDocs);
}

// Campo de valor de editar-no-lugar (Contas da casa): o que fazer ao sair do campo.
//  - texto que não é número → NÃO grava (o campo volta pro valor de antes);
//  - vazio ou zero digitado de propósito → grava 0.
export function valorDoCampoEditavel(texto, entradaInvalida = false) {
  if (entradaInvalida) return { gravar: false };
  const s = String(texto ?? "").trim();
  if (s === "") return { gravar: true, valor: 0 };
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return { gravar: false };
  const n = Number(s);
  return Number.isFinite(n) ? { gravar: true, valor: n } : { gravar: false };
}

// O que fazer com a linha que acabou de ser LIDA COM SUCESSO da nuvem:
//  - "ausente": a linha não existe mesmo → pode começar do zero/semente;
//  - "usar":    existe e tem o formato esperado;
//  - "erro":    existe mas veio num formato estranho → tela de erro, NUNCA
//               trocar por semente (o salvamento automático gravaria por cima).
export function decidirLinhaLida({ existe, valor }, valida) {
  if (!existe) return "ausente";
  return valida(valor) ? "usar" : "erro";
}

// Contas da casa: precisa ter pelo menos um ano.
export const casaValida = (v) =>
  !!v && typeof v === "object" && !Array.isArray(v) && Array.isArray(v.anos) && v.anos.length > 0 &&
  v.anos.every((a) => !!a && typeof a === "object" && Array.isArray(a.months));

// Linha antiga (v2) da casa: uma lista de meses.
export const legadoValido = (v) => !!v && typeof v === "object" && Array.isArray(v.months);

// Nome da linha "-conflito-": o mesmo enquanto o mesmo conflito não se resolver
// (senão cada nova tentativa criava mais uma linha).
export function idDaCopiaDeConflito(chave, quando = new Date()) {
  const p2 = (n) => String(n).padStart(2, "0");
  const dia = `${quando.getFullYear()}-${p2(quando.getMonth() + 1)}-${p2(quando.getDate())}`;
  return `${chave}-conflito-${dia}-${p2(quando.getHours())}${p2(quando.getMinutes())}${p2(quando.getSeconds())}`;
}
