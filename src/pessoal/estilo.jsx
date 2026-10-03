import React from "react";

// Mesma paleta da aba da casa (FcStyles em App.jsx): escuro verde petróleo,
// Sora nos títulos e Manrope no texto. Tudo com prefixo mc- pra não brigar
// com os estilos da casa.
export function MCStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');
.mc-wrap{
  --bg:#0D1512;--sf:#161F1A;--sf2:#1D2921;--sf3:#131C17;--ink:#EAF2EC;--soft:#B3C4BA;--faint:#7E9086;
  --line:#293830;--line2:#1C2721;--ac:#4CC28A;--ac-deep:#092018;--ac-br:#7CE0AC;--neg:#C8413A;--warn:#D9A55D;
  --ease:cubic-bezier(.22,.9,.32,1);
  color-scheme:dark;background:transparent;color:var(--ink);font-family:'Manrope',sans-serif;font-weight:500;
  font-variant-numeric:tabular-nums;max-width:1320px;margin:0 auto;padding:12px 16px 24px;
}
.mc-wrap *{box-sizing:border-box}
.mc-wrap button,.mc-wrap input,.mc-wrap textarea{font-family:'Manrope',sans-serif;color:inherit}
.mc-wrap button{cursor:pointer}
.mc-centro{text-align:center;padding:60px 16px;color:var(--soft);max-width:440px}
.mc-pos{color:var(--ac)} .mc-neg{color:var(--neg)} .mc-fraco{color:var(--faint)} .mc-peq{font-size:12px}
.mc-perigo{color:var(--neg)!important}

.mc-topo{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.mc-marca{display:flex;align-items:center;gap:10px}
.mc-marca-ic{width:38px;height:38px;border-radius:11px;background:linear-gradient(145deg,#125038,#4CC38A);display:flex;align-items:center;justify-content:center;color:#fff}
.mc-marca-nome{font-family:'Sora',sans-serif;font-size:18px;font-weight:700}
.mc-marca-sub{font-size:12px;color:var(--soft)}
.mc-topo-bts{display:flex;gap:8px}
.mc-ib{width:44px;height:44px;border-radius:14px;border:1px solid var(--line);background:var(--sf);display:inline-flex;align-items:center;justify-content:center;color:var(--ink);flex-shrink:0;transition:transform .15s var(--ease)}
.mc-ib:active{transform:scale(.94)}
.mc-ib-plano{background:var(--sf2);border-color:transparent}

.mc-corpo{display:block}
.mc-larga .mc-corpo{display:flex;gap:24px;align-items:flex-start}
.mc-lista-card{min-width:0}
.mc-larga .mc-lista-card{flex-grow:1;background:var(--sf);border:1px solid var(--line);border-radius:22px;padding:18px 18px 12px}
.mc-lado{width:400px;flex-shrink:0;display:flex;flex-direction:column;gap:18px;position:sticky;top:12px}
.mc-lado-dica{color:var(--faint);font-size:13px;text-align:center;padding:18px;border:1px dashed var(--line);border-radius:18px}

.mc-mes{display:flex;align-items:center;justify-content:center;gap:12px;padding:6px 0 10px}
.mc-larga .mc-mes{justify-content:space-between}
.mc-mes-nav{display:flex;align-items:center;gap:10px;flex-grow:1;justify-content:space-between;max-width:420px}
.mc-larga .mc-mes-nav{flex-grow:0;gap:14px}
.mc-mes-nome{background:none;border:none;display:flex;flex-direction:column;align-items:center;padding:4px 8px;min-width:170px}
.mc-mes-nome span{font-family:'Sora',sans-serif;font-size:20px;font-weight:700}
.mc-mes-nome small{font-size:12px;color:var(--faint);margin-top:2px}
.mc-btn-lanc{height:46px;padding:0 18px}

.mc-chips{display:flex;gap:8px;overflow-x:auto;padding:4px 0 6px;scrollbar-width:none}
.mc-chips::-webkit-scrollbar{display:none}
/* barra de filtros com fundinho (igual ao Organizze) + lupa que abre um campo animado */
.mc-fbar{display:flex;gap:10px;align-items:center;margin:4px 0 8px}
.mc-fpill{flex:1 1 0;min-width:0;height:54px;padding:0 7px!important;border-radius:999px;background:var(--sf2);align-items:center;gap:2px!important}
.mc-fpill .mc-chip{height:40px;border:none;background:transparent;font-size:14px;font-weight:800;padding:0 14px}
.mc-fpill .mc-chip.on{background:var(--ink);color:var(--bg);font-weight:900}
.mc-fpill{position:relative}
.mc-fpill > .mc-chip{position:relative;z-index:1}
.mc-fpill .mc-chip.on[data-on]{background:transparent}
.mc-pilula{position:absolute;top:0;left:0;z-index:0;border-radius:999px;background:var(--ink);pointer-events:none;will-change:transform,width}
.mc-fpill .mc-sel-conta{padding:0 10px}
.mc-fbusca{flex:0 0 54px;height:54px;border-radius:999px;background:var(--sf2);display:flex;align-items:center;overflow:hidden;
  transition:flex-basis .45s cubic-bezier(.66,.01,.24,1.02)}
.mc-fbar.aberta .mc-fbusca{flex-basis:min(360px,64%)}
.mc-fbusca input{flex:1;width:0;min-width:0;height:100%;border:none;outline:none;background:transparent;color:var(--ink);font:700 15px 'Nunito',sans-serif;
  padding:0;opacity:0;transition:opacity .25s .15s}
.mc-fbusca input::placeholder{color:var(--faint)}
.mc-fbar.aberta .mc-fbusca input{opacity:1;padding-left:18px}
.mc-fbusca-bt{width:54px;height:54px;flex-shrink:0;border:none;background:transparent;color:var(--ink);display:flex;align-items:center;justify-content:center;border-radius:999px}
.mc-fbusca-bt:focus-visible{outline:2px solid var(--ac);outline-offset:-4px}
@media (prefers-reduced-motion:reduce){.mc-fbusca,.mc-fbusca input{transition:none}}
/* ícones da linha + balãozinho da observação (passar o mouse; no celular, tocar) */
.mc-icones{display:flex;align-items:center;gap:2px;color:var(--faint);flex-shrink:0}
.mc-obs{position:relative;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;cursor:pointer}
.mc-obs:hover,.mc-obs.aberta{color:var(--ink);background:var(--sf2)}
.mc-balao{position:fixed;z-index:1000;width:max-content;min-width:180px;max-width:min(280px,calc(100vw - 24px));padding:12px 14px;border-radius:16px;
  background:#EAF2EC;color:#0D1512;font-size:14px;font-weight:700;line-height:1.4;text-align:left;white-space:normal;overflow-wrap:anywhere;cursor:auto;
  box-shadow:0 18px 40px -12px rgba(0,0,0,.55);visibility:hidden;opacity:0;transform:translateY(6px) scale(.96);
  transition:opacity .18s,transform .22s cubic-bezier(.34,1.56,.64,1)}
.mc-balao.on{visibility:visible;opacity:1;transform:none}
.mc-balao::before{content:"";position:absolute;top:-6px;left:var(--seta,50%);margin-left:-7px;width:14px;height:14px;border-radius:3px;background:inherit;transform:rotate(45deg)}
.mc-balao.em-cima::before{top:auto;bottom:-6px}
.mc-balao small{display:block;font-size:11px;font-weight:900;letter-spacing:.06em;opacity:.6;margin-bottom:3px}
@media (prefers-reduced-motion:reduce){.mc-balao{transition:none}}
.mc-chip{height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--soft);font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0}
.mc-chip.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.mc-chip .mc-ic{border:1.5px solid var(--bg)}
.mc-filtro-tot{font-size:13px;color:var(--soft);padding:6px 2px 0}
.mc-chip-cat{padding:0 6px 0 4px!important;gap:0!important}
.mc-chip-cat button{height:100%;border:none;background:none;color:inherit;font:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:0 6px;white-space:nowrap}
.mc-chip-cat-x{opacity:.75}
.mc-chip-cat-x:hover{opacity:1}
.mc-pilhas{display:inline-flex}
.mc-pilhas .mc-ic + .mc-ic{margin-left:-8px}
.mc-soma-cats{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 2px;padding:14px 16px;border-radius:20px;background:var(--sf);border:1px solid var(--line)}
.mc-soma-cats span{font-size:14px;font-weight:700;color:var(--faint);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-soma-cats b{font-size:22px;font-weight:900;white-space:nowrap}
.mc-cat-lista{flex:1 1 auto;min-height:0}
.mc-cat-grupo{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);padding:12px 2px 4px}
.mc-cat-item.on{background:color-mix(in srgb, var(--ac) 12%, transparent);border-radius:14px}
.mc-cat-marca{width:26px;height:26px;border-radius:50%;border:2.5px solid var(--line);flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;margin-left:auto}
.mc-cat-item.on .mc-cat-marca{background:var(--ac);border-color:var(--ac);color:var(--ac-deep)}
.mc-cat-acoes{display:grid;grid-template-columns:1fr 2fr;gap:10px}
.mc-cat-acoes .mc-btn-rosa{height:52px;justify-content:center;border-radius:16px}
.mc-vazio{color:var(--faint);text-align:center;padding:40px 12px;line-height:1.6;font-size:14px}

.mc-dia{display:flex;justify-content:space-between;align-items:baseline;padding:18px 2px 4px;font-size:12px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:.06em}
.mc-dia span:last-child{color:var(--soft)}
.mc-dia-hoje{color:var(--ac-br)}
.mc-linha{display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line2)}
.mc-larga .mc-linha{border-radius:14px;padding:0 6px}
.mc-linha.sel{background:#18261F;outline:1px solid #2C5A43}
.mc-linha-bt{flex-grow:1;min-width:0;display:flex;align-items:center;gap:12px;background:none;border:none;padding:9px 0;text-align:left}
.mc-ic{border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.mc-ic svg{stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.mc-nm{flex-grow:1;min-width:0;display:flex;flex-direction:column}
.mc-t{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-linha.pago .mc-t{color:var(--soft)}
.mc-pc{font-size:11px;font-weight:800;color:var(--soft);background:var(--sf2);border-radius:6px;padding:1px 6px;margin-left:6px;vertical-align:2px}
.mc-s{font-size:12px;color:var(--faint);display:flex;align-items:center;gap:6px;margin-top:2px;white-space:nowrap;overflow:hidden}
.mc-val{font-size:15px;font-weight:700;white-space:nowrap}
.mc-linha.fora .mc-ic,.mc-linha.fora .mc-t,.mc-linha.fora .mc-s-txt,.mc-linha.fora .mc-val,.mc-linha.fora .mc-icones{opacity:.5}
.mc-s-txt{min-width:0;overflow:hidden;text-overflow:ellipsis}
.mc-linha.fora .mc-val{text-decoration:line-through;text-decoration-thickness:2px}
.mc-fora-tag{display:inline-flex;align-items:center;gap:3px;height:19px;padding:0 7px;border-radius:99px;font-size:10.5px;font-weight:900;flex-shrink:0;
  background:color-mix(in srgb, var(--o-moeda,#FFC94D) 18%, transparent);color:var(--o-warn,#FFC94D)}
.mc-fora-roda{display:flex;align-items:center;gap:10px;margin:14px 0 4px;padding:12px 14px;border-radius:18px;border:1px dashed var(--line);color:var(--faint);font-size:13px;font-weight:800}
.mc-fora-roda b{margin-left:auto;color:var(--soft)}
.mc-chave small{display:block;font-size:12px;font-weight:600;color:var(--faint);margin-top:2px}
.mc-chave-fora{padding:8px 12px;margin:0 -12px;border-radius:14px;background:color-mix(in srgb, var(--o-moeda,#FFC94D) 10%, transparent)}
.mc-th{width:44px;height:44px;border-radius:12px;border:none;display:flex;align-items:center;justify-content:center;background:#18221D;color:#6F8177;flex-shrink:0;transition:background .2s var(--ease),transform .15s var(--ease)}
.mc-th:active{transform:scale(.9)}
.mc-th.on{background:#12402C;color:var(--ac)}
.mc-th.on svg{fill:var(--ac)}

.mc-resumo{background:#111B16;padding:16px 20px 20px}
.mc-rodape{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;justify-content:center;pointer-events:none}
.mc-rodape .mc-resumo{pointer-events:auto;width:100%;max-width:640px;border-top:1px solid var(--line);border-radius:22px 22px 0 0;box-shadow:0 -18px 30px -12px rgba(0,0,0,.6);padding-bottom:calc(20px + env(safe-area-inset-bottom))}
.mc-resumo-card{border:1px solid var(--line);border-radius:22px;background:linear-gradient(160deg,#072118,#125038)}
.mc-res-linha{display:flex;justify-content:space-between;font-size:13px;color:var(--soft);padding:2px 0}
.mc-res-sep{height:1px;background:var(--line);margin:10px 0}
.mc-resumo-card .mc-res-sep{background:rgba(255,255,255,.12)}
.mc-res-fim{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
.mc-res-rot{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.mc-falta{color:var(--warn)} .mc-sobra{color:var(--ac-br)}
.mc-res-num{font-family:'Sora',sans-serif;font-size:30px;font-weight:800;margin-top:2px}
.mc-resumo-card .mc-res-num{font-size:36px}
.mc-fab{width:60px;height:60px;border-radius:20px;border:none;background:var(--ac);color:var(--ac-deep);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px -8px rgba(76,195,138,.6);flex-shrink:0}
.mc-fab:active{transform:scale(.94)}

.mc-btn-p,.mc-btn-s,.mc-btn-perigo,.mc-btn-fraco,.mc-btn-verm{height:52px;border-radius:16px;font-size:15px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px}
.mc-btn-p{border:none;background:var(--ac);color:var(--ac-deep)!important}
.mc-btn-p:disabled{opacity:.5}
.mc-btn-s{border:1px solid var(--line);background:transparent}
.mc-btn-perigo{border:none;background:#5A2A20;color:#FFD9CC!important}
.mc-btn-verm{border:none;background:var(--neg);color:#fff!important}
.mc-btn-fraco{border:none;background:transparent;color:var(--soft)}
.mc-btn-peq{height:40px;border-radius:12px;font-size:13px;padding:0 14px}

.mc-folha-fundo{position:fixed;inset:0;z-index:40;background:rgba(4,8,6,.72);display:flex;align-items:flex-end;justify-content:center;animation:mc-fade .2s ease}
.mc-folha{width:100%;max-width:640px;max-height:94vh;overflow-y:auto;background:var(--sf3);border-radius:26px 26px 0 0;border-top:1px solid var(--line);padding:14px 18px calc(20px + env(safe-area-inset-bottom));animation:mc-sobe .28s var(--ease)}
@keyframes mc-sobe{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
@keyframes mc-fade{from{opacity:0}to{opacity:1}}
.mc-lado .mc-form{background:var(--sf);border:1px solid var(--line);border-radius:22px;padding:18px}

.mc-form{display:flex;flex-direction:column;gap:14px}
.mc-form-topo{display:flex;align-items:center;justify-content:space-between;gap:10px}
.mc-form-tipo{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.mc-form-tit{font-family:'Sora',sans-serif;font-size:20px;font-weight:700}
.mc-parc-nav{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:14px;padding:4px}
.mc-parc-nav button{width:40px;height:40px;border:none;border-radius:10px;background:transparent;display:flex;align-items:center;justify-content:center}
.mc-parc-nav button:disabled{opacity:.25}
.mc-parc-nav span{font-size:14px;font-weight:800}
.mc-seg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;background:var(--sf2);border-radius:14px;padding:4px}
.mc-seg button{height:42px;border:none;border-radius:11px;background:transparent;color:var(--soft);font-size:14px;font-weight:700}
.mc-seg button.on{background:var(--ink);color:var(--bg)}
.mc-seg-tipo button.on.despesa{background:var(--neg);color:#fff}
.mc-seg-tipo button.on.receita{background:var(--ac);color:var(--ac-deep)}
.mc-campo{display:flex;flex-direction:column;gap:6px;min-width:0}
.mc-rot{font-size:12px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:.05em}
.mc-inp{width:100%;min-height:50px;background:var(--sf2);border:1px solid var(--line);border-radius:14px;padding:0 14px;font-size:16px;font-weight:700;color:var(--ink);outline:none}
.mc-inp:focus{border-color:var(--ac)}
.mc-inp[type=date]{color-scheme:dark}
.mc-inp-valor{font-size:18px}
.mc-area{padding:12px 14px;min-height:70px;resize:vertical;font-weight:600;font-size:15px}
.mc-2col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.mc-cat-bt{display:flex;align-items:center;gap:10px;text-align:left;padding:0 12px}
.mc-cat-bt span:not(.mc-ic){flex-grow:1}
.mc-chave{display:flex;align-items:center;justify-content:space-between;font-size:15px;font-weight:700;position:relative;cursor:pointer;min-height:40px}
.mc-chave input{position:absolute;opacity:0;width:1px;height:1px}
.mc-chave-trilho{width:50px;height:30px;border-radius:99px;background:#2A3830;position:relative;transition:background .2s}
.mc-chave-trilho span{position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:var(--faint);transition:transform .2s var(--ease),background .2s}
.mc-chave input:checked + .mc-chave-trilho{background:#12402C}
.mc-chave input:checked + .mc-chave-trilho span{transform:translateX(20px);background:var(--ac)}
.mc-chave input:focus-visible + .mc-chave-trilho{outline:2px solid var(--ac);outline-offset:2px}
.mc-2bts{display:flex;gap:10px}
.mc-bt-op{flex-grow:1;height:46px;border-radius:14px;border:1px solid var(--line);background:var(--sf);color:var(--soft);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px}
.mc-bt-op.on{background:#10271D;border-color:var(--ac);color:var(--ac-br)}
.mc-rep{background:var(--sf);border:1px solid var(--line);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:12px}
.mc-opt{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--sf3);text-align:left}
.mc-opt b{display:block;font-size:15px}
.mc-opt small{display:block;font-size:12px;color:var(--faint);font-weight:500}
.mc-opt.on{border-color:var(--ac);background:#10271D}
.mc-dot{width:20px;height:20px;border-radius:50%;border:2px solid var(--faint);flex-shrink:0}
.mc-opt.on .mc-dot{border:6px solid var(--ac)}
.mc-passo{height:50px;background:var(--sf2);border:1px solid var(--line);border-radius:14px;display:flex;align-items:center;justify-content:space-between;padding:0 4px}
.mc-passo button{width:44px;height:42px;border:none;border-radius:11px;background:#26352C;font-size:20px;font-weight:700}
.mc-passo input{width:70px;text-align:center;background:none;border:none;font-family:'Sora',sans-serif;font-size:18px;font-weight:700;outline:none}
.mc-info{display:flex;gap:10px;align-items:flex-start;background:#0F2A1E;border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.45;color:#C3DFD0}
.mc-info svg{flex-shrink:0;color:var(--ac-br);margin-top:1px}
.mc-erro{background:#3A2620;color:#FFD9CC;border-radius:12px;padding:10px 14px;font-size:14px;font-weight:700}
.mc-acoes{display:flex;justify-content:space-between;padding:4px 0}
.mc-acoes button{display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:none;color:var(--soft);font-size:12px;font-weight:700;min-width:64px}
.mc-acoes button span{width:50px;height:50px;border-radius:50%;background:var(--sf2);display:flex;align-items:center;justify-content:center;color:var(--ink)}
.mc-acoes .mc-perigo span{color:var(--neg)}
.mc-form-bts{display:flex;gap:10px}
.mc-form-bts button{flex-grow:1;flex-basis:0}

.mc-modal-fundo{position:fixed;inset:0;z-index:60;background:rgba(4,8,6,.72);display:flex;align-items:flex-end;justify-content:center;animation:mc-fade .2s ease}
@media (min-width:700px){.mc-modal-fundo{align-items:center}}
.mc-modal{width:100%;max-width:480px;background:var(--sf3);border:1px solid var(--line);border-radius:26px 26px 0 0;padding:16px 18px calc(18px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;max-height:90vh;overflow-y:auto;animation:mc-sobe .25s var(--ease)}
@media (min-width:700px){.mc-modal{border-radius:26px}}
.mc-modal-lista{height:80vh}
.mc-busca{display:flex;align-items:center;gap:8px;background:var(--sf2);border:1px solid var(--line);border-radius:14px;padding:0 12px;color:var(--faint)}
.mc-busca input{flex-grow:1;height:46px;background:none;border:none;outline:none;font-size:16px;font-weight:600;color:var(--ink)}
.mc-cat-lista{overflow-y:auto;display:flex;flex-direction:column}
.mc-cat-item{display:flex;align-items:center;gap:12px;background:none;border:none;border-bottom:1px solid var(--line2);padding:8px 2px;font-size:15px;font-weight:700;text-align:left}
.mc-cat-item span:not(.mc-ic){flex-grow:1}
.mc-dialogo-fundo{align-items:center;padding:18px}
.mc-dialogo{border-radius:24px;align-items:stretch;text-align:center;padding:22px 18px 18px;max-width:420px}
.mc-dialogo p{margin:0;color:var(--soft);font-size:14px;line-height:1.45}
.mc-dialogo-ic{width:56px;height:56px;border-radius:50%;background:#12402C;color:var(--ac);display:flex;align-items:center;justify-content:center;align-self:center}
.mc-dialogo-ic.perigo{background:#3A2620;color:var(--neg)}

.mc-tela{position:fixed;inset:0;z-index:50;background:var(--bg);overflow-y:auto;animation:mc-fade .2s ease}
.mc-tela-in{max-width:640px;margin:0 auto;padding:16px 16px 40px;display:flex;flex-direction:column;gap:10px}
.mc-tela-topo{display:flex;align-items:center;gap:12px;justify-content:space-between;padding-bottom:6px}
.mc-tela-topo .mc-form-tit{flex-grow:1}
.mc-cat-linha{width:100%;display:flex;align-items:center;gap:12px;background:none;border:none;border-bottom:1px solid var(--line2);padding:6px 4px;min-height:52px;font-size:15px;font-weight:700;text-align:left}
.mc-cat-linha span:not(.mc-ic){flex-grow:1}
.mc-cat-linha.arq{opacity:.6}
.mc-arq-bt{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:48px;margin-top:8px;border-radius:14px;border:1px dashed var(--line);background:none;color:var(--faint);font-size:14px;font-weight:700}
.mc-cat-prev{display:flex;align-items:flex-end;gap:12px}
.mc-grade-ic{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.mc-grade-ic button{aspect-ratio:1;border-radius:14px;border:1px solid var(--line);background:var(--sf2);display:flex;align-items:center;justify-content:center;color:var(--soft)}
.mc-grade-ic svg{stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.mc-grade-ic button.on{color:#fff}
.mc-grade-cor{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:8px}
.mc-grade-cor button{aspect-ratio:1;border-radius:50%;border:none}
.mc-grade-cor button.on{outline:3px solid var(--ink);outline-offset:2px}
.mc-cat-extra{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:12px}

.mc-ev{background:var(--sf);border:1px solid var(--line);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:10px;margin-bottom:10px}
.mc-ev-topo{display:flex;gap:10px;align-items:flex-start}
.mc-ev-t{font-size:14px;font-weight:700;line-height:1.35}
.mc-ev-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mc-ev-ic.pos{background:#12402C;color:var(--ac)} .mc-ev-ic.neg{background:#3A2620;color:var(--neg)}
.mc-ev-ic.amarelo{background:#3A2A12;color:var(--warn)} .mc-ev-ic.neutro{background:var(--sf2);color:var(--soft)}
.mc-ba{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.mc-bx{background:#0F1713;border-radius:12px;padding:10px;font-size:12.5px;line-height:1.6;color:var(--faint);min-width:0;overflow-wrap:anywhere}
.mc-bx span{color:var(--ink)}
.mc-bx-rot{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}
.mc-bx-rot.dep{color:var(--warn)}
.mc-mudou{background:#3A2A12;color:#fff!important;font-weight:800;border-radius:4px;padding:0 3px}
.mc-voltar{align-self:flex-start}

.mc-aviso{position:fixed;left:50%;transform:translateX(-50%);top:12px;z-index:80;max-width:min(560px,calc(100vw - 24px));border-radius:16px;padding:12px 14px;font-size:14px;line-height:1.45;display:flex;gap:12px;align-items:center;box-shadow:0 16px 40px -12px rgba(0,0,0,.7)}
.mc-aviso-conf{background:#3A2A12;color:#FBE7C4}
.mc-aviso-conf button{border:none;border-radius:10px;background:#F0C987;color:#2A1C06;font-weight:800;padding:8px 12px;flex-shrink:0}
.mc-aviso-erro{background:#5A2A20;color:#FFD9CC;font-weight:800}
.mc-ponto{width:9px;height:9px;border-radius:50%;background:#FF8A70;flex-shrink:0;animation:mc-pisca 1s ease infinite alternate}
@keyframes mc-pisca{to{opacity:.3}}
.mc-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(200px + env(safe-area-inset-bottom));z-index:70;background:var(--ink);color:var(--bg);border-radius:14px;padding:10px 10px 10px 16px;display:flex;align-items:center;gap:14px;font-size:14px;font-weight:700;box-shadow:0 16px 40px -12px rgba(0,0,0,.7);max-width:calc(100vw - 24px);animation:mc-sobe .25s var(--ease)}
.mc-larga .mc-toast{bottom:24px}
.mc-toast button{border:none;border-radius:10px;background:var(--bg);color:var(--ac-br);font-weight:800;padding:8px 12px}

/* ---------------- Oink: topo, "faltam", período ---------------- */
.mc-marca .oink-logo{font-size:28px;color:var(--ink)}
.mc-titulo-aba{font-size:26px;font-weight:900;letter-spacing:-.01em}
.mc-hero{padding:6px 4px 14px}
.mc-hero-rot{font-size:15px;color:var(--faint);font-weight:700}
.mc-hero-num{font-size:48px;font-weight:900;line-height:1.05;letter-spacing:-.02em;margin-top:2px}
.mc-hero-num small{font-size:.58em;color:var(--faint);font-weight:800}
.mc-hero-pills{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.mc-pill-e,.mc-pill-s{padding:7px 12px;border-radius:999px;font-size:13px;font-weight:900}
.mc-pill-e{background:color-mix(in srgb, var(--ac) 16%, transparent);color:var(--ac)}
.mc-pill-s{background:color-mix(in srgb, var(--neg) 16%, transparent);color:var(--neg)}
.mc-hero-card{position:relative;overflow:hidden;border-radius:26px;padding:22px;border:1px solid var(--line);
  background:linear-gradient(160deg, color-mix(in srgb, #1E8A5E 70%, var(--sf)), var(--sf))}
.mc-hero-card .mc-hero-rot{color:color-mix(in srgb, var(--ink) 75%, transparent)}
/* o brilho é do tamanho do cartão e anda 100% → atravessa inteiro em qualquer largura */
.mc-hero-card::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.20) 50%,transparent 62%);
  transform:translateX(-100%);animation:mc-brilho 5s ease-in-out infinite}
@keyframes mc-brilho{0%{transform:translateX(-100%)}55%,100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.mc-hero-card::after{animation:none;display:none}}
.mc-hero-ic{position:absolute;right:18px;top:18px}
/* saldo do período: faltando = avermelhado suave, sobrando = verde (zero fica neutro) */
.mc-hero-falta,.mc-hero-sobra{border-radius:22px;padding:16px 18px 18px;margin-bottom:10px}
.mc-hero-falta{background:linear-gradient(135deg,color-mix(in srgb, var(--neg) 17%, transparent),color-mix(in srgb, var(--neg) 6%, transparent));box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--neg) 24%, transparent)}
.mc-hero-sobra{background:linear-gradient(135deg,color-mix(in srgb, var(--ac) 17%, transparent),color-mix(in srgb, var(--ac) 6%, transparent));box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--ac) 24%, transparent)}
.mc-hero-falta .mc-hero-num,.mc-hero-falta .mc-hero-rot{color:color-mix(in srgb, var(--neg) 68%, var(--ink))}
.mc-hero-sobra .mc-hero-num,.mc-hero-sobra .mc-hero-rot{color:var(--ac)}
.mc-hero-falta .mc-hero-num small,.mc-hero-sobra .mc-hero-num small{color:inherit;opacity:.85}
/* no Mac o cartão grande é de vidro verde: o tom muda junto */
.mc-hero-card.mc-hero-falta{background:linear-gradient(160deg, color-mix(in srgb, #C0454A 62%, var(--sf)), var(--sf))}
html[data-plat="mac"] .mc-hero-card.vidro.mc-hero-falta{background:linear-gradient(160deg, color-mix(in srgb, #C0454A 60%, var(--o-sf)), color-mix(in srgb, var(--o-sf) 82%, transparent))!important}
.mc-hero-card.mc-hero-falta .mc-hero-num,.mc-hero-card.mc-hero-falta .mc-hero-rot{color:#FFC2C4}
.mc-hero-card.mc-hero-sobra .mc-hero-num,.mc-hero-card.mc-hero-sobra .mc-hero-rot{color:#C9F7DF}
/* calculadora do campo Valor */
.mc-valor-wrap{position:relative}
.mc-valor-wrap .mc-inp{padding-right:48px}
.mc-calc-bt{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:none;border-radius:11px;background:color-mix(in srgb, var(--ac) 14%, transparent);color:var(--ac);display:flex;align-items:center;justify-content:center;cursor:pointer}
.mc-calc-portal{padding:0;margin:0;max-width:none}
.mc-calc-fundo{z-index:80}
.mc-calc{max-width:380px;gap:6px}
.mc-calc-expr{min-height:20px;text-align:right;color:var(--faint);font-size:15px;font-weight:700;padding:4px 4px 0;word-break:break-all}
.mc-calc-res{text-align:right;font-size:36px;font-weight:900;font-variant-numeric:tabular-nums;padding:0 4px 8px;word-break:break-all}
.mc-calc-teclas{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.mc-calc-k{height:52px;border:none;border-radius:14px;background:var(--sf2);color:var(--ink);font:inherit;font-size:19px;font-weight:800;cursor:pointer}
.mc-calc-k:active{filter:brightness(1.25)}
.mc-calc-k.op{color:var(--warn)}
.mc-calc-k.limpa{color:color-mix(in srgb, var(--neg) 68%, var(--ink))}
.mc-calc-k.cancela{font-size:12px;color:var(--faint)}
.mc-calc-k.usar{grid-column:span 2;background:var(--ac);color:var(--ac-deep);font-size:16px}
.mc-calc-k.usar:disabled{opacity:.4;cursor:default}

.mc-periodo{display:flex;align-items:center;gap:10px;padding:6px 0 10px;position:relative}
.mc-per-centro{flex-grow:1;display:flex;flex-direction:column;align-items:center;position:relative}
.mc-per-bt{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 16px;border-radius:999px;border:none;background:var(--sf2);
  color:var(--ink);font-size:17px;font-weight:900;cursor:pointer;transition:background .2s,color .2s}
.mc-per-bt.on{background:var(--ink);color:var(--bg)}
.mc-per-centro small{font-size:12px;color:var(--faint);font-weight:700;margin-top:3px}
.mc-menu-fundo{position:fixed;inset:0;z-index:44}
.mc-menu{position:absolute;top:50px;left:50%;margin-left:-130px;z-index:45;width:260px;padding:8px;border-radius:22px;
  background:var(--sf2);border:1px solid var(--line);box-shadow:0 24px 50px -12px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:2px;
  animation:oink-sobe .22s cubic-bezier(.22,.9,.32,1)}
.mc-menu button{display:flex;justify-content:space-between;align-items:center;height:46px;padding:0 14px;border:none;border-radius:14px;background:transparent;
  color:var(--ink);font-size:15px;font-weight:800;cursor:pointer;text-align:left}
.mc-menu button span{color:var(--faint);font-weight:700;font-size:13px}
.mc-menu button.on{background:var(--ink);color:var(--bg)}
.mc-menu button.on span{color:var(--bg)}
.mc-rosa{color:var(--o-rosa,#FF7EA6)!important}
.mc-btn-rosa{height:46px;padding:0 18px;border:none;border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;
  background:linear-gradient(180deg,#FF9DBE,#FF6D9B);color:#3A0A1D;font-size:15px;font-weight:900;
  box-shadow:0 4px 0 #C94477,0 12px 24px -10px rgba(255,109,155,.7);transition:transform .12s,box-shadow .12s}
.mc-btn-rosa:active{transform:translateY(3px);box-shadow:0 1px 0 #C94477}
.mc-chip-sel{margin-left:auto}

/* ---------------- lista: moeda de pago, seleção ---------------- */
.mc-lista-anim > div{animation:oink-sobe .35s cubic-bezier(.22,.9,.32,1) both}
.mc-lista-anim > div:nth-child(2){animation-delay:.04s}.mc-lista-anim > div:nth-child(3){animation-delay:.08s}
.mc-lista-anim > div:nth-child(4){animation-delay:.12s}.mc-lista-anim > div:nth-child(n+5){animation-delay:.16s}
.mc-moeda-bt{width:44px;height:44px;border:none;background:transparent;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer}
.mc-moeda-vazia{width:28px;height:28px;border-radius:50%;border:2.5px dashed color-mix(in srgb, var(--faint) 70%, transparent)}
.mc-moeda-bt:hover .mc-moeda-vazia{border-color:var(--o-warn,#FFC94D)}
.mc-caixa{width:28px;height:28px;border-radius:9px;border:2px solid color-mix(in srgb, var(--faint) 80%, transparent);background:transparent;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;color:#3A0A1D;cursor:pointer}
.mc-caixa.on{background:#FF7EA6;border-color:#FF7EA6}
.mc-linha.marcada{background:color-mix(in srgb, #FF7EA6 12%, transparent);border-radius:14px}
.mc-link{border:none;background:none;color:#FF7EA6;font-size:15px;font-weight:900;cursor:pointer;padding:10px 4px}
.mc-sel-topo{display:flex;align-items:center;justify-content:space-between;padding:6px 2px 4px}
.mc-sel-topo b{font-size:18px;font-weight:900}
.mc-sel-aviso{font-size:13px;color:var(--faint);font-weight:700;padding:4px 2px 6px}
.mc-sel-barra{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:8px;border-radius:22px;background:var(--sf2);border:1px solid var(--line);
  position:sticky;bottom:12px;margin-top:12px;box-shadow:0 -8px 30px -10px rgba(0,0,0,.5);animation:oink-sobe .22s cubic-bezier(.22,.9,.32,1)}
.mc-sel-barra.fixa{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:35;max-width:640px;margin:0 auto}
.mc-sel-barra button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:58px;border:none;border-radius:16px;
  background:transparent;color:var(--ink);font-size:12px;font-weight:800;cursor:pointer}
.mc-larga .mc-sel-barra button{flex-direction:row;min-height:44px;font-size:13px;background:color-mix(in srgb, var(--ink) 7%, transparent)}
.mc-sel-barra button:disabled{opacity:.35}
.mc-busca-topo{display:flex;align-items:center;gap:10px;padding:6px 0 10px}
.mc-busca-grande{flex-grow:1;border:2px solid #FF7EA6!important;color:#FF7EA6}
.mc-busca-grande input{color:var(--ink)}
@media (max-width:999px){ .mc-toast{bottom:calc(96px + env(safe-area-inset-bottom))} }
/* seleção: contagem no lugar dos filtros, Cancelar no lugar do Selecionar */
.mc-sel-conta{display:inline-flex;align-items:center;height:36px;font-size:15px;font-weight:900;padding:0 6px}
/* calendário Oink */
.mc-data{position:relative}
.mc-data-bt{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;text-align:left}
.mc-data-bt svg{color:var(--faint)}
.mc-cal{position:absolute;top:58px;right:0;z-index:46;width:292px;padding:12px;border-radius:22px;background:var(--sf2);border:1px solid var(--line);
  box-shadow:0 24px 50px -12px rgba(0,0,0,.55);animation:oink-sobe .2s cubic-bezier(.22,.9,.32,1)}
.mc-cal-topo{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 8px}
.mc-cal-topo b{font-size:16px;font-weight:900}
.mc-cal-topo button{width:38px;height:38px;border:none;border-radius:12px;background:transparent;color:var(--ink);display:flex;align-items:center;justify-content:center;cursor:pointer}
.mc-cal-topo button:hover{background:color-mix(in srgb, var(--ink) 8%, transparent)}
.mc-cal-grade{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px}
.mc-cal-sem{text-align:center;font-size:12px;font-weight:900;color:var(--faint);padding:4px 0}
.mc-cal-dia{height:36px;border:none;border-radius:12px;background:transparent;color:var(--ink);font-size:14px;font-weight:800;cursor:pointer}
.mc-cal-dia:hover{background:color-mix(in srgb, var(--ink) 8%, transparent)}
.mc-cal-dia.hoje{color:#FF7EA6}
.mc-cal-dia.on{background:var(--ink);color:var(--bg)}
.mc-cal-hoje{width:100%;height:40px;margin-top:8px;border:none;border-radius:12px;background:color-mix(in srgb, var(--ink) 8%, transparent);color:var(--ink);font-size:14px;font-weight:900;cursor:pointer}
@media (prefers-reduced-motion:reduce){.mc-wrap *,.mc-wrap *::before,.mc-wrap *::after{animation-duration:.001ms!important;transition-duration:.001ms!important}}
    `}</style>
  );
}
