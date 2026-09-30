import React from "react";

// Estilos da aba Investimentos (mockup "Parte 7", aprovado em 30/09/2026).
// Usa as mesmas cores do tema (as variáveis do .mc-wrap vêm do tema.jsx) e os
// mesmos botões/formulários da Minhas contas; aqui só o que é novo, com iv-.
export function IVStyles() {
  return (
    <style>{`
.iv{--iv-cdi:#5FE3A1;--iv-selic:#FFC94D;--iv-ipca:#FF7EA6}
.iv-topo{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:6px 0 14px}
.iv-titulo{font-size:30px;font-weight:900;letter-spacing:-.01em;margin:0;line-height:1.1}
.mc-larga .iv-titulo{font-size:34px}
.iv-topo-bts{display:flex;gap:8px;align-items:center}
.iv-col{display:flex;flex-direction:column;gap:14px;min-width:0}
.iv-mac{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:18px;align-items:start}
.iv-mac-topo{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px}
.iv-lado{position:sticky;top:14px;display:flex;flex-direction:column;gap:18px;min-width:0}
.iv-lista-rola{max-height:calc(100vh - 380px);min-height:260px;overflow-y:auto;scrollbar-width:thin;padding-right:2px}

.iv-card{background:var(--sf);border:1px solid var(--line);border-radius:24px;padding:16px;min-width:0}
.iv-sec{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.iv-sec h2{margin:0;font-size:17px;font-weight:900}
.iv-sec > span{font-size:12.5px;font-weight:800;color:var(--faint)}
.iv-link{border:none;background:none;color:var(--o-rosa,#FF7EA6);font:900 13.5px 'Nunito',sans-serif;cursor:pointer;padding:6px 2px}

/* cartão verde da carteira */
.iv-hero{padding:20px}
.iv-hero .mc-hero-num{font-size:44px}
.mc-larga .iv-hero .mc-hero-num{font-size:48px}
.iv-pill{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;
  background:color-mix(in srgb, var(--ink) 10%, transparent);color:var(--ink);white-space:nowrap}
.iv-pill b{font-weight:900}
.iv-liq{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding:12px 14px;border-radius:18px;
  background:color-mix(in srgb, #000 22%, transparent)}
html[data-tema="claro"] .iv-liq{background:color-mix(in srgb, #fff 45%, transparent)}
.iv-liq span{font-size:13px;font-weight:800;color:color-mix(in srgb, var(--ink) 72%, transparent);line-height:1.3}
.iv-liq b{font-size:20px;font-weight:900;white-space:nowrap}
.iv-vivo{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;color:color-mix(in srgb, var(--ink) 68%, transparent);margin-top:12px;line-height:1.3}
.iv-vivo i{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--ac);box-shadow:0 0 0 4px color-mix(in srgb, var(--ac) 25%, transparent);animation:iv-pulsa 2s ease-in-out infinite}
.iv-vivo.off i{background:var(--warn);box-shadow:0 0 0 4px color-mix(in srgb, var(--warn) 25%, transparent);animation:none}
@keyframes iv-pulsa{50%{box-shadow:0 0 0 7px color-mix(in srgb, var(--ac) 0%, transparent)}}

.iv-tres{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.iv-tres > div{background:var(--sf2);border-radius:16px;padding:10px 12px;min-width:0}
.iv-tres span{display:block;font-size:10.5px;font-weight:900;color:var(--faint);letter-spacing:.06em;text-transform:uppercase}
.iv-tres b{display:block;font-size:16px;font-weight:900;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iv-pos{color:var(--ac)} .iv-neg{color:var(--neg)}

/* gráfico */
.iv-per{display:flex;gap:2px;background:var(--sf2);border-radius:999px;padding:3px}
.iv-per button{height:30px;padding:0 11px;border:none;border-radius:999px;background:transparent;color:var(--soft);font:800 12.5px 'Nunito',sans-serif;cursor:pointer;white-space:nowrap}
.iv-per button.on{background:var(--ink);color:var(--bg);font-weight:900}
.iv-leg{display:flex;gap:14px;font-size:12.5px;font-weight:800;color:var(--soft);margin-top:8px}
.iv-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.iv-tip{background:var(--sf2);border:1px solid var(--line);border-radius:14px;padding:10px 12px;font:700 13px 'Nunito',sans-serif;color:var(--ink);box-shadow:0 16px 30px -12px rgba(0,0,0,.5)}
.iv-tip b{display:block;font-weight:900;margin-bottom:4px;text-transform:capitalize}
.iv-tip div{display:flex;justify-content:space-between;gap:16px}
.iv-tip span{color:var(--faint)}

/* lista agrupada */
.iv-ic{border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:#0A1511}
.iv-grp{border-bottom:1px solid var(--line)}
.iv-grp:last-child{border-bottom:none}
.iv-gcab{width:100%;display:flex;align-items:center;gap:12px;padding:12px 2px;border:none;background:none;color:var(--ink);text-align:left;cursor:pointer}
.iv-nome{font-size:16px;font-weight:800;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iv-sub{font-size:12.5px;font-weight:700;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iv-val{font-size:16px;font-weight:900;white-space:nowrap;text-align:right}
.iv-ganho{font-size:12.5px;font-weight:900;text-align:right;white-space:nowrap;color:var(--ac)}
.iv-ganho.neg{color:var(--neg)}
.iv-chev{color:var(--faint);display:flex;flex-shrink:0;transition:transform .25s cubic-bezier(.22,.9,.32,1)}
.iv-grp.aberto .iv-chev{transform:rotate(180deg)}
.iv-subs{background:var(--sf2);border-radius:18px;padding:0 12px;margin:0 0 12px;animation:oink-sobe .25s cubic-bezier(.22,.9,.32,1)}
.iv-it{width:100%;display:flex;align-items:center;gap:10px;padding:11px 0;border:none;border-bottom:1px solid var(--line);background:none;color:var(--ink);text-align:left;cursor:pointer}
.iv-it:last-child{border-bottom:none}
.iv-it .iv-nome,.iv-it .iv-val{font-size:15px}
.iv-it.on{background:color-mix(in srgb, var(--ink) 6%, transparent);margin:0 -12px;padding:11px 12px;width:calc(100% + 24px)}
.iv-tag{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:999px;font-size:10.5px;font-weight:900;margin-left:6px;vertical-align:1px;
  background:color-mix(in srgb, var(--o-moeda,#FFC94D) 18%, transparent);color:var(--o-warn,#FFC94D)}
.iv-vazio{text-align:center;padding:26px 12px;display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--soft);font-size:14px;line-height:1.5}
.iv-vazio b{font-size:18px;color:var(--ink)}

/* metas e rosca */
.iv-meta{display:flex;flex-direction:column;gap:8px;padding:12px 0;border-bottom:1px solid var(--line);background:none;border-left:none;border-right:none;border-top:none;
  color:var(--ink);text-align:left;width:100%;cursor:pointer}
.iv-meta:last-child{border-bottom:none;padding-bottom:2px}
.iv-meta:first-of-type{padding-top:0}
.iv-meta-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:15px;font-weight:800}
.iv-meta-top small{font-size:12.5px;font-weight:800;color:var(--faint)}
.iv-barra{height:12px;border-radius:999px;background:color-mix(in srgb, var(--ink) 12%, transparent);overflow:hidden}
.iv-barra i{display:block;height:100%;border-radius:999px;transition:width .6s cubic-bezier(.22,.9,.32,1)}
.iv-donut{display:flex;align-items:center;gap:18px}
.iv-dleg{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}
.iv-dleg > div{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:800;min-width:0}
.iv-dleg i{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.iv-dleg span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iv-dleg b{margin-left:auto;font-weight:900}

/* detalhe */
.iv-det{display:flex;flex-direction:column;gap:14px}
.iv-voltar{display:inline-flex;align-items:center;gap:6px;border:none;background:none;color:var(--soft);font:800 14px 'Nunito',sans-serif;cursor:pointer;padding:6px 0;align-self:flex-start}
.iv-det-cab{display:flex;align-items:center;gap:12px;min-width:0}
.iv-det-cab h1{margin:0;font-size:24px;font-weight:900;line-height:1.15}
.iv-2bts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.iv-2bts .mc-btn-rosa{justify-content:center;border-radius:16px;height:50px}
.iv-2bts .mc-btn-s{height:50px;border-radius:16px}
.iv-ext{width:100%;display:flex;align-items:center;gap:12px;padding:12px 2px;border:none;border-bottom:1px solid var(--line);background:none;color:var(--ink);text-align:left;cursor:pointer}
.iv-ext:last-child{border-bottom:none}
.iv-seta{width:34px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.iv-seta.mais{background:color-mix(in srgb, var(--ac) 18%, transparent);color:var(--ac)}
.iv-seta.menos{background:color-mix(in srgb, var(--neg) 18%, transparent);color:var(--neg)}
.iv-seta.ajuste{background:var(--sf2);color:var(--soft)}
.iv-acoes-fim{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.iv-acoes-fim button{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:transparent;
  color:var(--soft);font:800 13.5px 'Nunito',sans-serif;cursor:pointer}

/* formulários */
.iv-tipos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.iv-tipo{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;border-radius:18px;border:1px solid var(--line);background:transparent;
  color:var(--soft);font:800 13px 'Nunito',sans-serif;text-align:left;line-height:1.2;cursor:pointer}
.iv-tipo.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.iv-modo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.iv-modo button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:12px;border-radius:18px;border:1px solid var(--line);background:transparent;
  color:var(--ink);font:900 14px 'Nunito',sans-serif;text-align:left;cursor:pointer}
.iv-modo button small{font-size:12px;font-weight:700;color:var(--faint);line-height:1.3}
.iv-modo button.on{border-color:var(--ac);background:color-mix(in srgb, var(--ac) 12%, transparent)}
.iv-ajuda{font-size:12.5px;font-weight:700;color:var(--faint);line-height:1.45;margin:0}
.iv-linha-mov{display:grid;grid-template-columns:44px minmax(0,1.1fr) minmax(0,1fr) 40px;gap:8px;align-items:center}
.iv-sinal{height:50px;border-radius:14px;border:1px solid var(--line);background:var(--sf2);font:900 20px 'Nunito',sans-serif;cursor:pointer}
.iv-sinal.mais{color:var(--ac)} .iv-sinal.menos{color:var(--neg)}
.iv-tirar{width:40px;height:40px;border-radius:12px;border:none;background:transparent;color:var(--faint);display:flex;align-items:center;justify-content:center;cursor:pointer}
.iv-calc{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-radius:16px;background:color-mix(in srgb, var(--ac) 12%, transparent)}
.iv-calc span{font-size:14px;font-weight:800;line-height:1.3}
.iv-calc small{display:block;font-size:12px;font-weight:700;color:var(--faint)}
.iv-calc b{font-size:18px;font-weight:900;white-space:nowrap}
.iv-sel{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238FA89A' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center;padding-right:38px!important}
.iv-marcar{display:flex;align-items:center;gap:12px;padding:10px 2px;border:none;border-bottom:1px solid var(--line2);background:none;color:var(--ink);font:700 15px 'Nunito',sans-serif;text-align:left;width:100%;cursor:pointer}
.iv-marcar .mc-cat-marca{margin-left:auto}
.iv-marcar.on .mc-cat-marca{background:var(--ac);border-color:var(--ac);color:var(--ac-deep)}
.iv-aviso-taxa{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:16px;background:color-mix(in srgb, var(--warn) 14%, transparent);color:var(--ink);font-size:13.5px;font-weight:700;line-height:1.45}
.iv-aviso-taxa svg{flex-shrink:0;color:var(--warn);margin-top:1px}
@media (prefers-reduced-motion:reduce){.iv-vivo i,.iv-subs{animation:none}}
    `}</style>
  );
}
