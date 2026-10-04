import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";

// Identidade do Oink (aprovada em 2026-09-27):
//  - escuro = paleta "Menta & Chiclete"; claro = paleta "Pistache";
//  - logo em Fredoka 600; o app todo em Nunito;
//  - no Mac: vidro translúcido (estilo Liquid Glass); no celular: estilo One UI.
// As preferências (aparência, ordem, período) ficam só no aparelho.

// Pílula que desliza até o item ativo (mesmo movimento da aba Casa: começa
// lento, acelera e freia). O item ativo leva data-on="1"; a caixa precisa de
// position:relative. Devolve [ref da caixa, estilo da pílula].
const DESLIZE = "transform .44s cubic-bezier(.66,.01,.24,1.02), width .44s cubic-bezier(.66,.01,.24,1.02), height .44s cubic-bezier(.66,.01,.24,1.02), opacity .2s ease";
export function usePilula(deps) {
  const caixaRef = useRef(null);
  const primeira = useRef(true);
  const [estilo, setEstilo] = useState({ opacity: 0 });
  const ultimo = useRef("");
  const medir = useCallback((animar) => {
    const el = caixaRef.current && caixaRef.current.querySelector('[data-on="1"]');
    if (!el || !el.offsetWidth) { ultimo.current = ""; setEstilo((e) => ({ ...e, opacity: 0 })); return; }
    const transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
    const assinatura = `${el.offsetWidth}|${el.offsetHeight}|${transform}`;
    // já está no lugar certo: não mexe (assim uma medição extra nunca corta um deslize)
    if (assinatura === ultimo.current) return;
    ultimo.current = assinatura;
    setEstilo({
      opacity: 1, width: el.offsetWidth, height: el.offsetHeight, transform,
      transition: animar ? DESLIZE : "none",
    });
  }, []);
  useLayoutEffect(() => {
    medir(!primeira.current);
    primeira.current = false;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // só quando a janela muda de tamanho de verdade: a aba Casa dispara um
    // "resize" de mentira ao aparecer (pra medir as pílulas dela), e isso
    // fazia a pílula da barra lateral pular em vez de deslizar
    const f = (e) => { if (e && e.isTrusted === false) return; medir(false); };
    window.addEventListener("resize", f);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(f);
    // a janela do app no Mac às vezes ainda está se arrumando nos primeiros
    // instantes: confere de novo algumas vezes logo depois de abrir
    const timers = [150, 500, 1200, 2500].map((ms) => setTimeout(() => medir(false), ms));
    window.addEventListener("load", f);
    return () => {
      window.removeEventListener("resize", f);
      window.removeEventListener("load", f);
      timers.forEach(clearTimeout);
    };
  }, [medir]);
  // Se a caixa ou os botões mudarem de tamanho depois (janela do app abrindo,
  // letra chegando atrasada), mede de novo, sem animar. A primeira resposta
  // do observador é só "comecei a olhar" e é ignorada, pra não cortar o deslize.
  useEffect(() => {
    const c = caixaRef.current;
    if (!c || typeof ResizeObserver === "undefined") return undefined;
    let comecou = false;
    const ro = new ResizeObserver(() => {
      if (!comecou) { comecou = true; return; }
      medir(false);
    });
    ro.observe(c);
    // a própria pílula (data-pilula) fica de fora: ela muda de tamanho ao deslizar
    Array.from(c.children).forEach((f) => { if (!f.hasAttribute("data-pilula")) ro.observe(f); });
    return () => ro.disconnect();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return [caixaRef, estilo];
}

const PREFS_KEY = "oink-prefs";
const PADRAO = { aparencia: "escuro", ordem: "crescente", periodo: "mes" };

export function lerPrefs() {
  try {
    return { ...PADRAO, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch (e) {
    return { ...PADRAO };
  }
}

export function usePrefs() {
  const [prefs, setPrefsState] = useState(lerPrefs);
  useEffect(() => {
    const f = () => setPrefsState(lerPrefs());
    window.addEventListener("oink-prefs", f);
    return () => window.removeEventListener("oink-prefs", f);
  }, []);
  const setPref = useCallback((k, v) => {
    const novo = { ...lerPrefs(), [k]: v };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(novo)); } catch (e) { /* só nesta sessão */ }
    setPrefsState(novo);
    window.dispatchEvent(new Event("oink-prefs"));
  }, []);
  return [prefs, setPref];
}

export function plataforma() {
  const ua = navigator.userAgent || "";
  const toque = navigator.maxTouchPoints > 1;
  if (/Macintosh|Mac OS X/.test(ua) && !toque) return "mac";
  if (/Android|iPhone|iPad/.test(ua) || toque) return "celular";
  return "pc";
}

// aplica tema e plataforma no <html> (as cores de TODAS as abas saem daí)
export function useTemaNoDocumento() {
  const [prefs] = usePrefs();
  const [escuroSistema, setEscuroSistema] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => setEscuroSistema(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  const tema = prefs.aparencia === "auto" ? (escuroSistema ? "escuro" : "claro") : prefs.aparencia;
  useEffect(() => {
    const h = document.documentElement;
    h.dataset.tema = tema;
    h.dataset.plat = plataforma();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", tema === "claro" ? "#F3F8F1" : "#0A1511");
  }, [tema]);
  return tema;
}

export function TemaStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&family=Fredoka:wght@500;600&display=swap');

/* ---------------- cores ---------------- */
html[data-tema="escuro"]{
  color-scheme:dark;
  --o-bg:#0A1511; --o-sf:#12211A; --o-sf2:#1A2E24; --o-sf3:#0F1C16; --o-ink:#F2FBF6; --o-soft:#BFD3C7;
  --o-faint:#8FA89A; --o-line:#22382C; --o-line2:#1A2C22; --o-verde:#1E8A5E; --o-entrou:#5FE3A1;
  --o-entrou-deep:#06301E; --o-saiu:#FF5A5F; --o-rosa:#FF7EA6; --o-rosa-deep:#3A0A1D; --o-rosa-sombra:#C94477;
  --o-moeda:#FFC94D; --o-warn:#FFC94D; --o-sombra:rgba(0,0,0,.55);
  --o-hero1:#0E3A28; --o-hero2:#1E8A5E;
}
html[data-tema="claro"]{
  color-scheme:light;
  --o-bg:#F3F8F1; --o-sf:#FFFFFF; --o-sf2:#EAF3EC; --o-sf3:#FFFFFF; --o-ink:#13261D; --o-soft:#3D5446;
  --o-faint:#6B8275; --o-line:#D6E4DA; --o-line2:#E4EEE7; --o-verde:#1E8A5E; --o-entrou:#1FA36A;
  --o-entrou-deep:#FFFFFF; --o-saiu:#E0463F; --o-rosa:#FF7EA6; --o-rosa-deep:#3A0A1D; --o-rosa-sombra:#D95C86;
  --o-moeda:#F2B632; --o-warn:#B7791F; --o-sombra:rgba(19,38,29,.22);
  --o-hero1:#1E8A5E; --o-hero2:#0C5237;
}
html,body{background:var(--o-bg)!important;color:var(--o-ink)}
body{font-family:'Nunito',sans-serif}
/* Android: tira o "vulto" escuro que o Chrome pinta por cima de tudo que é tocado */
*{-webkit-tap-highlight-color:transparent}

/* aba "Minhas contas": as variáveis dela passam a vir do tema */
html[data-tema] .mc-wrap{
  --bg:var(--o-bg); --sf:var(--o-sf); --sf2:var(--o-sf2); --sf3:var(--o-sf3); --ink:var(--o-ink); --soft:var(--o-soft);
  --faint:var(--o-faint); --line:var(--o-line); --line2:var(--o-line2); --ac:var(--o-entrou); --ac-deep:var(--o-entrou-deep);
  --ac-br:var(--o-entrou); --neg:var(--o-saiu); --warn:var(--o-warn);
  color-scheme:inherit; font-family:'Nunito',sans-serif;
}
html[data-tema] .mc-wrap *, html[data-tema] .mc-wrap button, html[data-tema] .mc-wrap input, html[data-tema] .mc-wrap textarea{font-family:'Nunito',sans-serif}

/* aba "Contas da casa": mesmas cores e letra (sem mexer na lógica dela) */
html[data-tema] .fc-wrap{
  --bg:var(--o-bg); --surface:var(--o-sf); --surface-2:var(--o-sf2); --ink:var(--o-ink); --ink-soft:var(--o-soft);
  --ink-faint:var(--o-faint); --line:var(--o-line); --accent:var(--o-entrou); --accent-deep:var(--o-entrou-deep);
  --accent-bright:var(--o-entrou); --pos:var(--o-entrou); --neg:var(--o-saiu); --warn:var(--o-warn);
  --hero-1:var(--o-hero1); --hero-2:var(--o-hero2); --hero-glow:var(--o-entrou);
  color-scheme:inherit; font-family:'Nunito',sans-serif!important; background:transparent;
}
html[data-tema] .fc-wrap *:not(svg):not(path){font-family:'Nunito',sans-serif!important}
/* sub-abas da casa: pílula ativa branca com texto escuro (igual às abas do app) e sempre no topo */
html[data-tema] .fc-slide-pill-tab{background:var(--o-ink)!important;border-radius:14px}
html[data-tema] .fc-tab-active{color:var(--o-bg)!important}
html[data-tema] .fc-tab-active::after{display:none!important}
@media (max-width:820px){
  html[data-tema] .fc-tabs{position:static!important;display:flex!important;margin:0 0 16px!important;padding:4px!important;
    border-radius:18px!important;border:none!important;background:var(--o-sf)!important;backdrop-filter:none!important}
  html[data-tema] .fc-tab{min-height:42px!important;font-size:12.5px!important;border-radius:14px!important}
  html[data-tema] .fc-tab-active{background:var(--o-ink)!important}
  html[data-tema] .fc-main{padding-bottom:110px!important}
}

/* casa: mês no centro, conteúdo dentro de um quadro (igual à Minhas contas), sem o backup antigo (agora em Configurações) */
html[data-tema] .fc-period{justify-content:center}
html[data-tema] .fc-quadro{background:var(--o-sf);border:1px solid var(--o-line);border-radius:28px;padding:18px;margin-bottom:18px;
  animation:oink-sobe .4s cubic-bezier(.22,.9,.32,1)}
@media (max-width:820px){ html[data-tema] .fc-quadro{padding:0;border:none;border-radius:0;background:transparent!important;backdrop-filter:none!important}
  html[data-tema] .fc-budget-item{font-size:15px!important;padding:10px!important} }
html[data-tema] .fc-quadro .fc-tabs{background:var(--o-sf2)!important}
html[data-tema] .fc-data-zone > *:not(.fc-danger-link):not(.fc-confirm-inline){display:none!important}
html[data-tema] .fc-data-zone{border:none!important;padding-top:4px!important;margin-top:0!important}
html[data-tema="claro"][data-plat="mac"] body{background:
    radial-gradient(60% 70% at 12% 15%, rgba(30,138,94,.28) 0%, transparent 60%),
    radial-gradient(50% 60% at 90% 25%, rgba(255,126,166,.22) 0%, transparent 60%),
    radial-gradient(60% 70% at 60% 105%, rgba(106,92,255,.16) 0%, transparent 60%),
    var(--o-bg)!important;background-attachment:fixed!important}

/* cartão "Ainda dá pra gastar" da casa = mesmo cartão do valor da Minhas contas (vidro verde + brilho) */
html[data-tema] .fc-hero{background:linear-gradient(160deg, color-mix(in srgb, #1E8A5E 70%, var(--o-sf)), var(--o-sf))!important;
  border:1px solid var(--o-line);border-radius:26px!important;color:var(--o-ink)!important;box-shadow:none!important}
html[data-tema] .fc-hero *{--hero-ink:var(--o-ink);--hero-sub:var(--o-soft)}
html[data-tema] .fc-hero::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.20) 50%,transparent 62%);
  transform:translateX(-100%);animation:oink-brilho-cartao 5s ease-in-out infinite}
@keyframes oink-brilho-cartao{0%{transform:translateX(-100%)}55%,100%{transform:translateX(100%)}}
html[data-plat="mac"] .fc-hero{backdrop-filter:blur(40px) saturate(160%);-webkit-backdrop-filter:blur(40px) saturate(160%);
  background:linear-gradient(160deg, color-mix(in srgb, #2FA876 75%, var(--o-sf)), color-mix(in srgb, var(--o-sf) 82%, transparent))!important}

/* ===== Casa repaginada na ID do Oink (mockup "Parte 3", aprovado 2026-09-27) ===== */
/* topo: título grande igual ao "Minhas contas" */
html[data-tema] .fc-header{align-items:flex-end}
html[data-tema] .fc-brand-badge{display:none!important}
html[data-tema] .fc-brand-name{font-size:30px!important;font-weight:900!important;letter-spacing:-.01em;line-height:1.1}
html[data-plat="mac"] .fc-brand-name, html[data-plat="pc"] .fc-brand-name{font-size:36px!important}
html[data-tema] .fc-subtitle{font-size:14px!important;font-weight:700!important;color:var(--o-faint)!important;margin-top:4px}
html[data-tema] .fc-hide-btn{width:44px!important;height:44px!important;border-radius:15px!important;background:var(--o-sf)!important;color:var(--o-ink)!important}
/* mês */
html[data-tema] .fc-period-label{flex:0 0 auto!important;min-height:48px!important;padding:0 22px!important;border:none!important;background:var(--o-sf2)!important;
  font-size:19px!important;font-weight:900!important}
html[data-tema] .fc-period-arrow{border-radius:15px!important;color:var(--o-ink)!important}
@media (max-width:820px){ html[data-tema] .fc-period{justify-content:space-between!important} }
/* barra do mês da casa: ‹ mês › + (o + cria o próximo mês) e menu igual ao da Minhas contas */
html[data-tema] .fc-period{position:relative;gap:8px!important}
.fc-mes-curto{display:none}
@media (max-width:820px){ .fc-mes-longo{display:none} .fc-mes-curto{display:inline} html[data-tema] .fc-period-label{padding:0 18px!important} }
html[data-tema] .fc-period-add{border:none!important;background:linear-gradient(180deg,#FF9DBE,#FF6D9B)!important;color:#3A0A1D!important;
  box-shadow:0 3px 0 var(--o-rosa-sombra);opacity:1!important}
html[data-tema] .fc-period-add:active{transform:translateY(2px)!important;box-shadow:0 1px 0 var(--o-rosa-sombra)}
.fc-mes-fundo{position:fixed;inset:0;z-index:44}
.fc-mes-menu{position:absolute;top:58px;left:50%;translate:-50% 0;z-index:45;width:min(320px,calc(100vw - 32px));padding:8px;border-radius:24px;
  background:var(--o-sf2);border:1px solid var(--o-line);box-shadow:0 24px 50px -12px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:2px;
  max-height:min(78vh,680px);overflow-y:auto;font-family:'Nunito',sans-serif;animation:oink-sobe .22s cubic-bezier(.22,.9,.32,1)}
html[data-plat="mac"] .fc-mes-menu.vidro{background:color-mix(in srgb, var(--o-sf2) 96%, transparent)!important}
.fc-mes-ano{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 8px;margin-bottom:4px;border-bottom:1px solid var(--o-line)}
.fc-mes-ano b{font-size:16px!important;font-weight:900!important;color:var(--o-ink)}
.fc-mes-ano button{width:38px;height:38px;border:none;border-radius:12px;background:transparent;color:var(--o-soft);display:flex;align-items:center;justify-content:center;cursor:pointer}
.fc-mes-ano button:hover:not(:disabled){background:color-mix(in srgb, var(--o-ink) 8%, transparent)}
.fc-mes-ano button:disabled{opacity:.25;cursor:default}
.fc-mes-item{display:flex;align-items:center;border-radius:15px;min-height:48px}
.fc-mes-item.on{background:var(--o-ink)}
.fc-mes-abrir{flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:10px;height:48px;padding:0 6px 0 16px;border:none;background:transparent;
  color:var(--o-ink);font-size:16px!important;font-weight:800!important;cursor:pointer;text-align:left;border-radius:15px}
.fc-mes-item:not(.on) .fc-mes-abrir:hover{background:color-mix(in srgb, var(--o-ink) 7%, transparent)}
.fc-mes-abrir small{font-size:12.5px!important;font-weight:700!important;letter-spacing:0;color:var(--o-faint);white-space:nowrap}
.fc-mes-item.on .fc-mes-abrir{color:var(--o-bg);font-weight:900!important}
.fc-mes-item.on .fc-mes-abrir small{color:color-mix(in srgb, var(--o-bg) 65%, transparent)}
.fc-mes-lixo{width:36px;height:36px;margin-right:6px;flex-shrink:0;border:none;border-radius:11px;background:transparent;color:var(--o-faint);display:flex;align-items:center;justify-content:center;cursor:pointer}
.fc-mes-lixo:hover{color:var(--o-saiu);background:color-mix(in srgb, var(--o-saiu) 14%, transparent)}
.fc-mes-item.on .fc-mes-lixo{color:color-mix(in srgb, var(--o-bg) 55%, transparent)}
.fc-mes-confirma{justify-content:space-between;gap:8px;padding:0 6px 0 16px;background:color-mix(in srgb, var(--o-saiu) 14%, transparent);font-size:15px!important;font-weight:800!important;color:var(--o-ink)}
.fc-mes-acoes{display:flex;gap:6px}
.fc-mes-sim{height:36px;padding:0 12px;border:none;border-radius:11px;background:var(--o-saiu);color:#fff;font-size:13px!important;font-weight:900!important;display:flex;align-items:center;gap:4px;cursor:pointer}
.fc-mes-nao{width:36px;height:36px;border:none;border-radius:11px;background:color-mix(in srgb, var(--o-ink) 10%, transparent);color:var(--o-ink);display:flex;align-items:center;justify-content:center;cursor:pointer}
.fc-mes-vazio{padding:12px 16px;font-size:14px;font-weight:700;color:var(--o-faint)}
.fc-mes-add{display:flex;align-items:center;gap:10px;min-height:56px;margin-top:4px;padding:8px 16px;border:none;border-radius:15px;cursor:pointer;text-align:left;
  background:color-mix(in srgb, var(--o-rosa) 13%, transparent);color:var(--o-rosa);font-size:16px!important;font-weight:900!important}
html[data-tema="claro"] .fc-mes-add{color:#C2386B}
.fc-mes-add:hover{background:color-mix(in srgb, var(--o-rosa) 20%, transparent)}
.fc-mes-add small{display:block;font-size:12px!important;font-weight:700!important;letter-spacing:0;color:var(--o-faint);margin-top:1px}
.fc-mes-form{display:flex;gap:6px;padding:6px}
.fc-mes-form .fc-input{flex:1;min-width:0}
/* sub-abas: pílula com fundinho */
html[data-tema] .fc-tabs{border-radius:999px!important;padding:5px!important;background:var(--o-sf2)!important}
html[data-tema] .fc-tab{border-radius:999px!important;font-size:14px!important;font-weight:800!important;color:var(--o-soft)}
html[data-tema] .fc-slide-pill-tab{border-radius:999px!important}
html[data-tema] .fc-tab-active{font-weight:900!important}
@media (max-width:820px){ html[data-tema] .fc-tab{font-size:13px!important} }

/* cartão verde "Ainda dá pra gastar" */
html[data-tema] .fc-hero{gap:0!important;padding:22px!important}
@media (max-width:820px){ html[data-tema] .fc-hero{padding:20px 18px!important} html[data-tema] .fc-hero-chip{padding:10px!important;column-gap:8px!important} }
html[data-tema] .fc-hero-eyebrow{font-size:15px!important;font-weight:700!important;text-transform:none!important;letter-spacing:0!important;
  color:color-mix(in srgb, var(--o-ink) 75%, transparent)!important;opacity:1!important}
html[data-tema] .fc-hero-number{font-size:46px!important;font-weight:900!important;letter-spacing:-.02em;line-height:1.05!important;margin-top:2px}
html[data-plat="mac"] .fc-hero-number, html[data-plat="pc"] .fc-hero-number{font-size:54px!important}
html[data-tema] .fc-hero-number small{font-size:.56em;font-weight:800;color:color-mix(in srgb, var(--o-ink) 60%, transparent)}
.fc-hero-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.fc-hero-pill{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 10px;border-radius:999px;font-size:12.5px;white-space:nowrap;font-weight:800;
  background:color-mix(in srgb, var(--o-ink) 10%, transparent);color:var(--o-ink)}
.fc-hero-uso{display:flex;justify-content:space-between;gap:10px;margin:18px 0 8px;font-size:13px;font-weight:800}
.fc-hero-uso-resto{opacity:.7}
.fc-hero-barra{height:14px;border-radius:999px;background:color-mix(in srgb, var(--o-ink) 12%, transparent);overflow:hidden}
.fc-hero-barra i{display:block;height:100%;border-radius:999px;transition:width .6s cubic-bezier(.22,.9,.32,1)}
html[data-tema] .fc-hero-chips{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px!important;margin-top:16px!important}
html[data-tema] .fc-hero-chip{display:grid!important;grid-template-columns:34px minmax(0,1fr);column-gap:10px;align-items:center;
  padding:10px 12px!important;border-radius:18px!important;border:none!important;background:color-mix(in srgb, var(--o-ink) 8%, transparent)!important;color:var(--o-ink)!important}
html[data-tema] .fc-hero-chip:hover{background:color-mix(in srgb, var(--o-ink) 13%, transparent)!important}
html[data-tema] .fc-hero-avatar{grid-row:1 / 3;width:34px!important;height:34px!important;font-size:14px!important;font-weight:900!important}
html[data-tema] .fc-av-joel{background:#FF7EA6!important;color:#3A0A1D!important}
html[data-tema] .fc-av-antonio{background:#5FE3A1!important;color:#06301E!important}
html[data-tema] .fc-hero-role{font-size:13px!important;font-weight:700!important;color:var(--o-ink)!important;opacity:.75;align-self:end;line-height:1.2}
html[data-tema] .fc-hero-chip-value{font-size:15px!important;font-weight:900!important;color:var(--o-ink)!important;justify-self:start;text-align:left!important;
  align-self:start;line-height:1.3}

/* editar o valor do Antonio no topo: mesma letra grande do valor, sem as setinhas do campo de número */
.fc-input-amount{-moz-appearance:textfield;appearance:textfield}
.fc-input-amount::-webkit-inner-spin-button,.fc-input-amount::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
html[data-tema] .fc-hero-chip .fc-input-amount{grid-column:auto;justify-self:stretch;width:100%;min-width:0;height:40px!important;padding:0 12px!important;
  font-family:'Nunito',sans-serif!important;font-size:18px!important;font-weight:900!important;font-variant-numeric:tabular-nums;text-align:left!important;
  color:var(--o-ink)!important;background:rgba(0,0,0,.28)!important;border:1.5px solid var(--o-verde, #5FE3A1)!important;border-radius:12px!important}

/* categorias do Resumo: ícone redondo colorido, "R$ x de R$ y", etiqueta e barra grossa */
html[data-tema] .fc-env-grid{grid-template-columns:minmax(0,1fr)!important;gap:10px!important}
html[data-tema] .fc-env-card{display:grid!important;grid-template-columns:42px minmax(0,1fr) auto;grid-template-areas:"ic nome tag" "ic num tag" "bar bar bar" "usou usou usou";
  column-gap:12px;row-gap:1px;align-items:center;min-height:0!important;padding:14px 16px!important;background:var(--o-sf)!important;border:1px solid var(--o-line)!important;
  border-radius:24px!important;box-shadow:none!important}
html[data-tema] .fc-env-card:hover{transform:translateY(-3px)!important}
html[data-tema] .fc-env-card .fc-env-top, html[data-tema] .fc-env-card .fc-env-nums{display:contents!important}
html[data-tema] .fc-env-card .fc-env-icon{grid-area:ic;width:42px!important;height:42px!important}
html[data-tema] .fc-env-card .fc-env-name{grid-area:nome;font-size:15px!important;font-weight:800!important;align-self:end;overflow-wrap:normal!important}
@media (max-width:1239px){ html[data-tema] .fc-hero-resumo{grid-template-columns:minmax(0,1fr)!important} }
html[data-tema] .fc-env-card .fc-env-budget{grid-area:num;font-size:13px!important;font-weight:700!important;color:var(--o-faint)!important;align-self:start}
html[data-tema] .fc-env-card .fc-env-gauge{grid-area:bar;height:10px!important;margin-top:12px;background:color-mix(in srgb, var(--o-ink) 12%, transparent)!important}
html[data-tema] .fc-env-left{height:26px;padding:0 10px;border-radius:999px;display:inline-flex!important;align-items:center;font-size:12px!important;font-weight:900!important;
  background:color-mix(in srgb, currentColor 18%, transparent);white-space:nowrap}
html[data-tema] .fc-env-card .fc-env-left{grid-area:tag}
html[data-tema] .fc-env-card .fc-env-usou{grid-area:usou;margin-top:8px;font-size:15px;font-weight:900;color:color-mix(in srgb, var(--o-saiu) 68%, var(--o-ink))}
html[data-tema] .fc-env-card .fc-env-usou small{font-size:12px;font-weight:700;color:var(--o-faint);margin-left:4px}
html[data-tema] .fc-env-empty{border-style:dashed!important;background:transparent!important;border-radius:20px!important;font-weight:700!important;color:var(--o-faint)!important}
html[data-tema] .fc-hero-resumo-total{padding:14px 8px!important}
/* ícone de categoria em todo lugar: bolinha com a cor da categoria */
html[data-tema] .fc-env-icon{width:40px!important;height:40px!important;border-radius:50%!important;background:var(--cat, var(--o-verde))!important;color:#fff!important}
html[data-tema] .fc-env-icon-sm{width:32px!important;height:32px!important}

/* Lançamentos */
html[data-tema] .fc-chip{min-height:40px!important;padding:0 14px 0 6px!important;font-size:14px!important;font-weight:800!important}
html[data-tema] .fc-chip-icon{width:28px!important;height:28px!important;border-radius:50%!important;background:var(--cat, var(--o-verde))!important;color:#fff!important}
html[data-tema] .fc-chip-active{font-weight:900!important}
/* a faixa de categorias rola de lado; sem esse respiro, o chip que sobe 1px no hover era cortado em cima */
html[data-tema] .fc-cat-chips{padding-top:4px!important;padding-bottom:4px!important}
html[data-tema] .fc-chip-quickadd{min-height:38px!important;padding:0 14px 0 10px!important;border:1.5px dashed color-mix(in srgb, var(--o-entrou) 60%, transparent)!important;
  background:color-mix(in srgb, var(--o-entrou) 10%, transparent)!important;color:var(--o-ink)!important;gap:6px!important}
html[data-tema] .fc-chip-quickadd b{color:var(--o-entrou);font-weight:900}
html[data-tema] .fc-quickadd-label{font-size:13px!important;font-weight:700!important;color:var(--o-faint)!important;margin-bottom:8px!important}
html[data-tema] .fc-quickadd .fc-cat-chips{flex-wrap:wrap}
html[data-tema] .fc-budget-panel{border-radius:24px!important;padding:16px!important;background:var(--o-sf)!important}
.fc-budget-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.fc-budget-head .fc-env-icon{width:44px!important;height:44px!important}
.fc-budget-head-txt{flex:1;min-width:0;display:flex;flex-direction:column}
.fc-budget-head-txt b{font-size:16px;font-weight:800;line-height:1.25}
.fc-budget-head-txt small{font-size:13px;font-weight:700;color:var(--o-faint)}
html[data-tema] .fc-budget-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px!important;margin-bottom:12px!important}
html[data-tema] .fc-budget-item{background:var(--o-sf2);border-radius:16px;padding:10px;font-size:15px!important;font-weight:900!important;min-width:0}
html[data-tema] .fc-budget-item > span:last-child{font-size:inherit!important;font-weight:900!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (min-width:900px){ html[data-tema] .fc-lanc-layout{grid-template-columns:360px minmax(0,1fr)!important} html[data-tema] .fc-budget-item{font-size:15px!important;padding:10px!important} }
html[data-tema] .fc-budget-label{font-size:11px!important;font-weight:900!important;letter-spacing:.06em!important}
html[data-tema] .fc-progress-track{height:12px!important;border-radius:999px!important;background:color-mix(in srgb, var(--o-ink) 12%, transparent)!important}
html[data-tema] .fc-add-row{flex-wrap:nowrap!important;gap:8px!important;margin-top:14px!important}
html[data-tema] .fc-add-row .fc-input{height:48px;min-width:0;border-radius:16px!important;background:var(--o-sf2)!important;font-size:15px!important;font-weight:700!important;padding:0 14px!important}
html[data-tema] .fc-add-row .fc-input:not(.fc-input-grow){width:108px!important;flex-shrink:0}
html[data-tema] .fc-add-row .fc-icon-btn-solid{width:48px;height:48px;flex-shrink:0;border-radius:16px!important;border:none!important;
  background:linear-gradient(180deg,#FF9DBE,#FF6D9B)!important;color:#3A0A1D!important;box-shadow:0 4px 0 var(--o-rosa-sombra)!important}
html[data-tema] .fc-add-row .fc-icon-btn-solid:active{transform:translateY(3px)!important;box-shadow:0 1px 0 var(--o-rosa-sombra)!important}
html[data-tema] .fc-lanc-main .fc-ledger{background:var(--o-sf);border:1px solid var(--o-line);border-radius:24px;padding:6px 14px}
/* linhas das listas (Lançamentos e Fixas) */
html[data-tema] .fc-ledger-row{padding:10px 2px!important;border-radius:0!important;border-bottom:1px solid var(--o-line);font-size:15px!important}
html[data-tema] .fc-ledger-row:hover{background:transparent!important}
html[data-tema] .fc-ledger-row .fc-input-plain{min-width:0;font-size:15px!important;font-weight:700!important;color:var(--o-ink)!important}
html[data-tema] .fc-ledger-row .fc-amount-btn{font-size:15px!important;font-weight:900!important}
html[data-tema] .fc-ledger-total{border-top:none!important;border-bottom:none!important;padding:14px 4px 10px!important;margin-top:0!important}
html[data-tema] .fc-ledger-total > span:first-child{font-size:14px;font-weight:700;color:var(--o-faint)}
html[data-tema] .fc-ledger-total > span:last-child{font-size:16px;font-weight:900}
html[data-tema] .fc-icon-btn-trash{border:none!important;background:transparent!important;color:var(--o-faint)!important;border-radius:50%!important;min-width:40px!important;min-height:40px!important}
/* Fixas */
html[data-tema] .fc-fixas-card{border-radius:24px!important;padding:16px 14px 8px!important;box-shadow:none!important}
html[data-tema] .fc-section-title{font-size:16px!important;font-weight:800!important;margin-bottom:6px!important}
html[data-tema] .fc-section-title-with-icon{gap:12px!important}
html[data-tema] .fc-section-title .fc-icon-btn{min-width:40px;min-height:40px;border-radius:14px!important;color:var(--o-ink)!important}
html[data-tema] .fc-hint{font-size:13px!important;font-weight:700!important;line-height:1.4}
html[data-tema] .fc-cat-name{display:flex;align-items:center;gap:12px;font-weight:700}
.fc-ocultas{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:14px 2px 8px}
.fc-ocultas > span{width:100%;font-size:13px;font-weight:700;color:var(--o-faint)}
.fc-ocultas .fc-chip{border-style:dashed!important;padding:0 14px!important;gap:6px!important}
/* no claro, o "no limite" das barras fica dourado (o texto continua no tom mais escuro, pra ler bem) */
html[data-tema="claro"] .fc-env-gauge, html[data-tema="claro"] .fc-hero-barra, html[data-tema="claro"] .fc-progress-track{--warn:#F2B632}
@media (prefers-reduced-motion:reduce){html[data-tema] .fc-hero::after{display:none}}

/* ---------------- logo ---------------- */
.oink-logo{font-family:'Fredoka',sans-serif!important;font-weight:600;letter-spacing:-.02em;line-height:1}
.oink-logo i{font-style:normal;color:var(--o-rosa)}

/* ---------------- animações da marca ---------------- */
@keyframes oink-cai{0%{transform:translateY(-26px);opacity:0}25%{opacity:1}60%{transform:translateY(6px);opacity:1}80%,100%{transform:translateY(6px);opacity:0}}
.oink-moeda-cai{animation:oink-cai 1.1s cubic-bezier(.5,0,.3,1) 1}
@keyframes oink-pulo{0%{transform:scale(1)}40%{transform:scale(1.22)}65%{transform:scale(.92)}100%{transform:scale(1)}}
.oink-pulo{animation:oink-pulo .5s cubic-bezier(.34,1.56,.64,1)}
@keyframes oink-narina{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.35);opacity:1}}
@keyframes oink-sobe{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
@keyframes oink-brilho{0%{transform:translateX(-160%) skewX(-20deg)}60%,100%{transform:translateX(420%) skewX(-20deg)}}
.oink-focinho{display:inline-flex;align-items:center;justify-content:center;gap:12px;width:96px;height:62px;border-radius:34px;background:var(--o-rosa)}
.oink-focinho span{width:14px;height:20px;border-radius:50%;background:#7A1F3C;animation:oink-narina 1.1s ease-in-out infinite}
.oink-focinho span+span{animation-delay:.25s}

/* ---------------- sem internet (Nível 1) ---------------- */
@keyframes oink-shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}
@keyframes oink-pulsa-x{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.oink-sn-fundo{position:absolute;inset:0;overflow:hidden;padding:70px 16px;display:flex;flex-direction:column;gap:8px;opacity:.5;filter:blur(1px)}
.oink-sn-skel{border-radius:14px;background:linear-gradient(90deg,var(--o-sf) 25%,var(--o-sf2) 37%,var(--o-sf) 63%);background-size:400px 100%;animation:oink-shimmer 1.6s linear infinite}
.oink-sn-escurece{position:absolute;inset:0;background:rgba(5,10,8,.35)}
.oink-sn-cartao{position:relative;z-index:1;max-width:340px;margin:auto;border-radius:28px;padding:30px 24px;background:var(--o-sf);border:1px solid var(--o-line);
  box-shadow:0 30px 60px -20px rgba(0,0,0,.5);display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;animation:oink-sobe .4s cubic-bezier(.22,.9,.32,1)}
.oink-sn-focinho{position:relative;width:96px;height:62px}
.oink-sn-focinho .oink-focinho span{opacity:.55;animation:none}
.oink-sn-x{position:absolute;right:-10px;bottom:-10px;animation:oink-pulsa-x 1.8s ease-in-out infinite;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4))}
.oink-sn-tit{font-family:'Fredoka',sans-serif;font-weight:600;font-size:19px;color:var(--o-ink)}
.oink-sn-sub{font-size:14px;color:var(--o-faint);line-height:1.5}
@media (prefers-reduced-motion:reduce){.oink-moeda-cai,.oink-pulo,.oink-focinho span,.oink-sn-skel,.oink-sn-x{animation:none!important}}

/* ---------------- Mac: vidro (Liquid Glass) ---------------- */
html[data-plat="mac"] body{
  background:
    radial-gradient(60% 70% at 12% 15%, color-mix(in srgb, var(--o-verde) 70%, transparent) 0%, transparent 60%),
    radial-gradient(50% 60% at 90% 25%, color-mix(in srgb, var(--o-rosa) 55%, transparent) 0%, transparent 60%),
    radial-gradient(60% 70% at 60% 105%, color-mix(in srgb, #6A5CFF 45%, transparent) 0%, transparent 60%),
    var(--o-bg)!important;
  background-attachment:fixed!important;
}
html[data-plat="mac"] .vidro{
  background:color-mix(in srgb, var(--o-sf) 80%, transparent)!important;
  backdrop-filter:blur(40px) saturate(160%);-webkit-backdrop-filter:blur(40px) saturate(160%);
  border:1px solid color-mix(in srgb, #FFFFFF 22%, transparent)!important;
  box-shadow:inset 0 1px 0 color-mix(in srgb, #FFFFFF 35%, transparent),0 20px 50px -22px var(--o-sombra)!important;
}
html[data-plat="mac"][data-tema="claro"] .vidro{background:color-mix(in srgb, #FFFFFF 80%, transparent)!important;border-color:rgba(255,255,255,.85)!important}
/* menus e calendário por cima de conteúdo: quase sólidos, pra não misturar com o que está atrás */
html[data-plat="mac"] .mc-cal.vidro, html[data-plat="mac"] .mc-menu.vidro{background:color-mix(in srgb, var(--o-sf2) 96%, transparent)!important}
html[data-plat="mac"] .mc-hero-card.vidro{background:linear-gradient(160deg, color-mix(in srgb, #2FA876 75%, var(--o-sf)), color-mix(in srgb, var(--o-sf) 82%, transparent))!important}
html[data-plat="mac"] .fc-wrap .fc-card, html[data-plat="mac"] .fc-wrap .fc-hero{backdrop-filter:blur(24px) saturate(160%)}
    `}</style>
  );
}

// Ícone do porquinho (o mesmo do app), pra usar dentro das telas
export function IconeOink({ size = 34, moedaCaindo = false }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <clipPath id={`k${id}`}><path d="M50 0C88 0 100 12 100 50C100 88 88 100 50 100C12 100 0 88 0 50C0 12 12 0 50 0Z" /></clipPath>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1E8A5E" /><stop offset="1" stopColor="#0C5237" /></linearGradient>
        <linearGradient id={`c${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFB6C6" /><stop offset="1" stopColor="#FF8BA5" /></linearGradient>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD66B" /><stop offset="1" stopColor="#E9A21F" /></linearGradient>
      </defs>
      <g clipPath={`url(#k${id})`}>
        <rect width="100" height="100" fill={`url(#b${id})`} />
        <g transform="translate(7 7) scale(.86)">
          <path d="M27 57c-6-1-8-6-5-9" stroke="#FF8BA5" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <rect x="34" y="66" width="7" height="11" rx="3" fill="#FF8BA5" />
          <rect x="58" y="66" width="7" height="11" rx="3" fill="#FF8BA5" />
          <ellipse cx="49" cy="56" rx="23" ry="17" fill={`url(#c${id})`} />
          <ellipse cx="44" cy="49" rx="12" ry="5" fill="#fff" opacity=".35" />
          <path d="M58 42l5-9 5 11z" fill="#FF8BA5" />
          <ellipse cx="72" cy="57" rx="6" ry="6.5" fill="#FF8BA5" />
          <circle cx="70.6" cy="56" r="1.3" fill="#8C2A45" /><circle cx="73.8" cy="56" r="1.3" fill="#8C2A45" />
          <circle cx="63" cy="51" r="2" fill="#8C2A45" />
          <rect x="41" y="39.5" width="14" height="3.2" rx="1.6" fill="#8C2A45" />
          <g className={moedaCaindo ? "oink-moeda-cai" : ""}>
            <circle cx="48" cy="29" r="9.5" fill="#C98714" />
            <circle cx="48" cy="28" r="8.8" fill={`url(#m${id})`} />
            <circle cx="48" cy="28" r="6.2" fill="none" stroke="#C98714" strokeWidth="1.2" />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function Carregando({ texto = "Carregando…" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "80px 16px", color: "var(--o-faint)", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
      <span className="oink-focinho" aria-hidden="true"><span /><span /></span>
      {texto}
    </div>
  );
}

// Tela de "não deu pra carregar" (Nível 1 do offline): cartão flutuante sobre
// uma lista de esqueleto, com o focinho + um X vermelho no estilo da moeda de
// "pago". Nunca é mostrada por cima de dados — só quando o carregamento falhou
// de verdade (ver zero-data-loss: o gate de "carregado" nunca é ligado aqui).
export function SemInternet({ onTentar }) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const titulo = offline ? "Ops, sem internet" : "Não deu pra carregar agora";
  const sub = offline
    ? "Suas contas aparecem assim que a conexão voltar"
    : "Verifique a internet e tente de novo — por segurança, nada será salvo até carregar direito";
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <div className="oink-sn-fundo" aria-hidden="true">
        {[92, 78, 85, 70, 88, 74].map((w, i) => (
          <div key={i} className="oink-sn-skel" style={{ height: 54, width: `${w}%`, flexShrink: 0 }} />
        ))}
      </div>
      <div className="oink-sn-escurece" aria-hidden="true" />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", padding: 24 }}>
        <div className="oink-sn-cartao">
          <div className="oink-sn-focinho">
            <span className="oink-focinho" aria-hidden="true"><span /><span /></span>
            <svg className="oink-sn-x" viewBox="0 0 40 40" width={42} height={42} aria-hidden="true">
              <circle cx="20" cy="20" r="18" fill="#8F1E22" /><circle cx="20" cy="19" r="17" fill="#FF5A5F" />
              <path d="M14 14l12 12M26 14L14 26" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="oink-sn-tit">{titulo}</div>
            <div className="oink-sn-sub" style={{ marginTop: 4 }}>{sub}</div>
          </div>
          <button className="mc-btn-s" style={{ height: 50, borderRadius: 18, padding: "0 26px", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 15, border: "1px solid var(--o-line)", background: "transparent", color: "var(--o-ink)", display: "inline-flex", alignItems: "center", gap: 8 }} onClick={onTentar || (() => window.location.reload())}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
            Tentar de novo
          </button>
        </div>
      </div>
    </div>
  );
}
