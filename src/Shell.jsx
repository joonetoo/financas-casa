import React, { useState, useEffect } from "react";
import FinancasCasa from "./App.jsx";
import MinhasContas from "./pessoal/MinhasContas.jsx";

// Qual linha de dados cada aba usa:
//  - servidor de teste (npm run dev): SEMPRE uma cópia de teste;
//  - app beta (build --mode beta): linhas "financas-beta-*", separadas das reais;
//  - app de verdade: as linhas reais.
const BETA = import.meta.env.MODE === "beta";
const CHAVE_PESSOAL = import.meta.env.DEV
  ? import.meta.env.VITE_PESSOAL_KEY || "financas-pessoal-teste"
  : BETA ? "financas-beta-pessoal" : "financas-pessoal-v1";

const ABAS = [
  ["casa", "Contas da casa"],
  ["pessoal", "Minhas contas"],
  ["invest", "Investimentos"],
];
const ABA_KEY = "fc-aba";

export default function Shell() {
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

  // As abas ficam TODAS montadas (só escondidas): cada uma continua com suas
  // proteções de salvamento rodando, e trocar de aba nunca recarrega nem
  // perde uma edição que ainda estava indo pra nuvem.
  return (
    <>
      <style>{`
        .sh-bar{position:sticky;top:0;z-index:20;background:#0D1512;padding:10px 16px 8px;padding-top:calc(10px + env(safe-area-inset-top))}
        .sh-abas{max-width:640px;margin:0 auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;background:#161F1A;border:1px solid #293830;border-radius:16px;padding:4px}
        .sh-abas button{height:40px;border:none;border-radius:12px;background:transparent;color:#B3C4BA;font-family:'Manrope',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:background .25s cubic-bezier(.22,.9,.32,1),color .25s}
        .sh-abas button.on{background:#EAF2EC;color:#0D1512}
        .sh-beta{max-width:640px;margin:0 auto 6px;text-align:center;font:800 11px 'Manrope',sans-serif;letter-spacing:.08em;color:#2A1C06;background:#F0C987;border-radius:8px;padding:3px 8px}
        .sh-vazio{max-width:520px;margin:40px auto;padding:28px 22px;text-align:center;color:#B3C4BA;font-family:'Manrope',sans-serif;border:1px dashed #293830;border-radius:22px;line-height:1.6}
        .sh-vazio b{display:block;font-family:'Sora',sans-serif;font-size:20px;color:#EAF2EC;margin-bottom:6px}
      `}</style>
      <div className="sh-bar">
        {BETA && <div className="sh-beta">VERSÃO DE TESTE · os dados daqui são uma cópia</div>}
        <nav className="sh-abas" aria-label="Abas">
          {ABAS.map(([k, t]) => (
            <button key={k} className={aba === k ? "on" : ""} aria-current={aba === k ? "page" : undefined} onClick={() => setAba(k)}>
              {t}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ display: aba === "casa" ? "block" : "none" }}><FinancasCasa /></div>
      <div style={{ display: aba === "pessoal" ? "block" : "none" }}>
        <MinhasContas chave={CHAVE_PESSOAL} ativo={aba === "pessoal"} />
      </div>
      {aba === "invest" && (
        <div className="sh-vazio">
          <b>Investimentos</b>
          Esta aba está guardada pra depois. Quando você tiver a ideia do que quer
          acompanhar aqui, a gente monta junto.
        </div>
      )}
    </>
  );
}
