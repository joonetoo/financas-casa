import React, { useState, useEffect } from "react";
import { Home, PiggyBank, TrendingUp, Settings, Plus } from "lucide-react";
import FinancasCasa, { STORAGE_KEY as CHAVE_CASA } from "./App.jsx";
import MinhasContas from "./pessoal/MinhasContas.jsx";
import Configuracoes, { AvisoDesfazerGeral } from "./Configuracoes.jsx";
import { TemaStyles, useTemaNoDocumento, IconeOink, usePilula } from "./tema.jsx";

// Qual linha de dados cada aba usa:
//  - servidor de teste (npm run dev): SEMPRE uma cópia de teste;
//  - app beta (build --mode beta): linhas "financas-beta-*", separadas das reais;
//  - app de verdade: as linhas reais.
const BETA = import.meta.env.MODE === "beta";
export const CHAVE_PESSOAL = import.meta.env.DEV
  ? import.meta.env.VITE_PESSOAL_KEY || "financas-pessoal-teste"
  : BETA ? "financas-beta-pessoal" : "financas-pessoal-v1";
export { CHAVE_CASA };

const ABAS = [
  ["casa", "Contas da casa", "Casa", Home],
  ["pessoal", "Minhas contas", "Minhas", PiggyBank],
  ["invest", "Investimentos", "Invest.", TrendingUp],
];
const ABA_KEY = "fc-aba";

function useLarga() {
  const q = "(min-width: 1000px)";
  const [larga, setLarga] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setLarga(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return larga;
}

export default function Shell() {
  useTemaNoDocumento();
  const larga = useLarga();
  const [config, setConfig] = useState(false);
  const [aba, setAba] = useState(() => {
    try {
      const a = localStorage.getItem(ABA_KEY);
      return ABAS.some(([k]) => k === a) ? a : "pessoal";
    } catch (e) {
      return "pessoal";
    }
  });
  useEffect(() => {
    try { localStorage.setItem(ABA_KEY, aba); } catch (e) { /* só lembra neste aparelho */ }
    window.scrollTo(0, 0);
    // a aba da casa mede as "pílulas" deslizantes na tela; se ela nasceu
    // escondida, mede de novo quando aparece (ela já escuta o "resize")
    if (aba === "casa") requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }, [aba]);
  // outras partes do app pedem pra trocar de aba / abrir configurações
  useEffect(() => {
    const irPara = (e) => setAba(e.detail);
    const abrirConfig = () => setConfig(true);
    window.addEventListener("oink-aba", irPara);
    window.addEventListener("oink-config", abrirConfig);
    return () => {
      window.removeEventListener("oink-aba", irPara);
      window.removeEventListener("oink-config", abrirConfig);
    };
  }, []);

  const novo = () => window.dispatchEvent(new Event("oink-novo"));
  const [ladoRef, pilulaLado] = usePilula([aba, config, larga]);

  // As abas ficam TODAS montadas (só escondidas): cada uma continua com suas
  // proteções de salvamento rodando, e trocar de aba nunca recarrega nem
  // perde uma edição que ainda estava indo pra nuvem.
  return (
    <>
      <TemaStyles />
      <style>{`
        .sh-beta{margin:8px auto 0;max-width:640px;text-align:center;font:900 11px 'Nunito',sans-serif;letter-spacing:.08em;color:#2A1C06;background:#F0C987;border-radius:8px;padding:3px 8px}
        .sh-conteudo{min-height:100vh}
        .sh-larga .sh-conteudo{margin-left:276px}
        .sh-lado{position:fixed;left:14px;top:14px;bottom:14px;width:248px;z-index:30;border-radius:24px;padding:20px 14px;
          display:flex;flex-direction:column;gap:6px;background:var(--o-sf);border:1px solid var(--o-line)}
        .sh-lado-marca{display:flex;align-items:center;gap:10px;padding:0 6px 18px}
        .sh-lado-marca .oink-logo{font-size:32px;color:var(--o-ink)}
        .sh-lado button{display:flex;align-items:center;gap:12px;height:46px;padding:0 14px;border:none;border-radius:14px;background:transparent;
          color:var(--o-soft);font:700 15px 'Nunito',sans-serif;cursor:pointer;text-align:left;transition:background .2s,color .2s}
        .sh-lado button:hover{background:color-mix(in srgb, var(--o-ink) 8%, transparent)}
        .sh-lado button{position:relative;z-index:1}
        .sh-lado button.on{color:var(--o-bg);font-weight:900}
        .sh-lado button.on:hover{background:transparent}
        .sh-pilula{position:absolute;top:0;left:0;z-index:0;border-radius:14px;background:var(--o-ink);pointer-events:none;will-change:transform,width}
        .sh-lado-fim{margin-top:auto}
        .sh-baixo{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:30;display:flex;gap:10px;align-items:center;
          max-width:640px;margin:0 auto}
        .sh-baixo-abas{flex-grow:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:var(--o-sf2);border-radius:30px;padding:6px;
          box-shadow:0 -6px 30px var(--o-sombra);border:1px solid var(--o-line)}
        .sh-baixo-abas button{height:46px;border:none;border-radius:24px;background:transparent;color:var(--o-faint);font:800 13px 'Nunito',sans-serif;
          display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:background .25s cubic-bezier(.22,.9,.32,1),color .25s}
        .sh-baixo-abas button.on{background:var(--o-ink);color:var(--o-bg);font-weight:900}
        .sh-mais{width:60px;height:60px;border-radius:22px;border:none;flex-shrink:0;cursor:pointer;
          background:linear-gradient(180deg,#FF9DBE,#FF6D9B);color:var(--o-rosa-deep);box-shadow:0 5px 0 var(--o-rosa-sombra),0 14px 26px -10px rgba(255,109,155,.7);
          display:flex;align-items:center;justify-content:center;transition:transform .12s,box-shadow .12s}
        .sh-mais:active{transform:translateY(4px);box-shadow:0 1px 0 var(--o-rosa-sombra)}
        .sh-cfg{width:60px;height:60px;border-radius:22px;border:1px solid var(--o-line);background:var(--o-sf2);color:var(--o-ink);flex-shrink:0;cursor:pointer;
          display:flex;align-items:center;justify-content:center;box-shadow:0 -6px 30px var(--o-sombra)}
        .sh-vazio{max-width:520px;margin:60px auto;padding:28px 22px;text-align:center;color:var(--o-soft);font-family:'Nunito',sans-serif;
          border:1px dashed var(--o-line);border-radius:24px;line-height:1.6}
        .sh-vazio b{display:block;font-size:22px;color:var(--o-ink);margin-bottom:6px}
      `}</style>

      <div className={larga ? "sh-larga" : ""}>
        {larga && (
          <nav className="sh-lado vidro" aria-label="Abas" ref={ladoRef}>
            <div className="sh-pilula" data-pilula style={pilulaLado} />
            <div className="sh-lado-marca"><IconeOink size={42} /><span className="oink-logo">oink<i>.</i></span></div>
            {ABAS.map(([k, nome, , Icone]) => (
              <button key={k} className={aba === k && !config ? "on" : ""} data-on={aba === k && !config ? "1" : undefined} onClick={() => { setConfig(false); setAba(k); }}>
                <Icone size={19} /> {nome}
              </button>
            ))}
            <button className={"sh-lado-fim" + (config ? " on" : "")} data-on={config ? "1" : undefined} onClick={() => setConfig(true)}><Settings size={19} /> Configurações</button>
          </nav>
        )}

        <div className="sh-conteudo">
          {BETA && <div className="sh-beta">VERSÃO DE TESTE · os dados daqui são uma cópia</div>}
          <div style={{ display: aba === "casa" ? "block" : "none" }}><FinancasCasa ativo={aba === "casa"} /></div>
          <div style={{ display: aba === "pessoal" ? "block" : "none" }}>
            <MinhasContas chave={CHAVE_PESSOAL} ativo={aba === "pessoal"} larga={larga} />
          </div>
          {aba === "invest" && (
            <div className="sh-vazio">
              <b>Investimentos</b>
              Esta aba está guardada pra depois. Quando você tiver a ideia do que quer
              acompanhar aqui, a gente monta junto.
            </div>
          )}
          {!larga && <div style={{ height: 96 }} />}
        </div>

        {!larga && (
          <div className="sh-baixo">
            <nav className="sh-baixo-abas" aria-label="Abas">
              {ABAS.map(([k, , curto]) => (
                <button key={k} className={aba === k ? "on" : ""} aria-current={aba === k ? "page" : undefined} onClick={() => setAba(k)}>{curto}</button>
              ))}
            </nav>
            {aba === "pessoal" ? (
              <button className="sh-mais" aria-label="Novo lançamento" onClick={novo}><Plus size={28} strokeWidth={2.8} /></button>
            ) : (
              <button className="sh-cfg" aria-label="Configurações" onClick={() => setConfig(true)}><Settings size={24} /></button>
            )}
          </div>
        )}
      </div>

      <AvisoDesfazerGeral />
      {config && <Configuracoes chaveCasa={CHAVE_CASA} chavePessoal={CHAVE_PESSOAL} larga={larga} onFechar={() => setConfig(false)} />}
    </>
  );
}
