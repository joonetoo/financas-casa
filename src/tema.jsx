import React, { useEffect, useState, useCallback } from "react";

// Identidade do Oink (aprovada em 2026-09-27):
//  - escuro = paleta "Menta & Chiclete"; claro = paleta "Pistache";
//  - logo em Fredoka 600; o app todo em Nunito;
//  - no Mac: vidro translúcido (estilo Liquid Glass); no celular: estilo One UI.
// As preferências (aparência, ordem, período) ficam só no aparelho.

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
@media (prefers-reduced-motion:reduce){.oink-moeda-cai,.oink-pulo,.oink-focinho span{animation:none!important}}

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
