import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Info, Plus, X, Trash2, Save, Check } from "lucide-react";
import { useDocNuvem, registrar, nuvem } from "../pessoal/nuvem.js";
import { uid } from "../pessoal/logica.js";
import { Carregando, SemInternet, usePilula } from "../tema.jsx";
import {
  PRESETS, NOMES_PRESETS, vazioCalc, normalizarCalc, limparNumeros, contas, mesHoje, mesDoK, kDoMes, mesAno, dur,
  brl, big, curto, tira, p0, degraus, aporteEm, mediasMinhasContas, mediaAportes, presetOink,
} from "./calc.js";

// Calculadora de investimentos (mockup aprovado em 06/11/2026).
// SIMULAÇÃO: não mexe em nenhum dado do Oink. Tem a linha dela na nuvem
// (`chave`), com a mesma proteção das outras abas (useDocNuvem): os números
// que o Joel mexe e os cenários salvos aparecem no Mac e no celular.

const MODO_KEY = "oink-calc-modo";
const clone = (o) => JSON.parse(JSON.stringify(o));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lerNum = (t) => {
  const n = Number(String(t).replace(/\D/g, ""));
  return isFinite(n) ? n : 0;
};
const fmtIn = (n) => (n ? Math.round(n).toLocaleString("pt-BR") : "0");

/* ---------------- ícones (traço único) ---------------- */
const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IC = {
  premio: <><circle cx="12" cy="9" r="6" /><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7" /></>,
  hoje: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  oink: <path d="M19 10c.8 0 1.5.7 1.5 1.5v1c0 .8-.7 1.5-1.5 1.5h-.6a7 7 0 0 1-2.4 2.6V19h-3v-1.5h-3V19H7v-2.6A6 6 0 0 1 4 11c0-3.3 3.1-6 7-6h1.5L15 3v3a6.8 6.8 0 0 1 3.4 4z" />,
  meu: <path d="M6 3h12v18l-6-4-6 4z" />,
};

/* ---------------- campos ---------------- */

function Din({ id, rotulo, valor, onMuda, dica, ariaLabel }) {
  const [txt, setTxt] = useState(fmtIn(valor));
  const foco = useRef(false);
  useEffect(() => {
    if (!foco.current) setTxt(fmtIn(valor));
  }, [valor]);
  const campo = (
    <div className="cv-din">
      <span>R$</span>
      <input
        id={id} inputMode="numeric" autoComplete="off" aria-label={ariaLabel} value={txt}
        onFocus={() => (foco.current = true)}
        onBlur={() => { foco.current = false; setTxt(fmtIn(valor)); }}
        onChange={(e) => {
          const v = lerNum(e.target.value);
          setTxt(v ? v.toLocaleString("pt-BR") : "");
          onMuda(v);
        }}
      />
    </div>
  );
  if (!rotulo) return campo;
  return (
    <div className="cv-campo">
      <label htmlFor={id}>{rotulo}</label>
      {campo}
      {dica && <small>{dica}</small>}
    </div>
  );
}

function Faixa({ id, rotulo, saida, valor, min, max, step, onMuda, dica }) {
  return (
    <div className="cv-campo">
      <label htmlFor={id}>{rotulo}<output htmlFor={id}>{saida}</output></label>
      <input type="range" id={id} min={min} max={max} step={step} value={valor} onChange={(e) => onMuda(+e.target.value)} />
      {dica && <small>{dica}</small>}
    </div>
  );
}

function Passo({ rotulo, saida, onMuda }) {
  return (
    <div className="cv-campo">
      <span className="cv-lab">{rotulo}</span>
      <div className="cv-anos">
        <button type="button" aria-label="Menos um ano" onClick={() => onMuda(-1)}>−</button>
        <b>{saida}</b>
        <button type="button" aria-label="Mais um ano" onClick={() => onMuda(1)}>+</button>
      </div>
    </div>
  );
}

/* ---------------- gráfico (SVG desenhado na escala) ---------------- */

function Grafico({ s, c, modo, base, larga }) {
  const caixa = useRef(null);
  const [w, setW] = useState(larga ? 640 : 320);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return undefined;
    const medir = () => { if (el.clientWidth) setW(Math.max(260, el.clientWidth)); };
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const r = c.r, H = r.length - 1, h = larga ? 240 : 200, pl = 8, pr = 8, pt = 26, pb = 26;
  const alvo = c.meta;
  const ymax = Math.max(...r.map((x) => x.p), alvo || 0) * 1.08 || 1;
  const X = (k) => pl + (w - pl - pr) * (H ? k / H : 0);
  const Y = (v) => pt + (h - pt - pb) * (1 - v / ymax);
  const passoK = Math.max(1, Math.round(H / 120));
  let dp = "", db = "";
  for (let k = 0; k <= H; k += passoK) {
    dp += (k ? "L" : "M") + X(k).toFixed(1) + " " + Y(r[k].p).toFixed(1);
    db += (k ? "L" : "M") + X(k).toFixed(1) + " " + Y(r[k].b).toFixed(1);
  }
  dp += "L" + X(H).toFixed(1) + " " + Y(r[H].p).toFixed(1);
  db += "L" + X(H).toFixed(1) + " " + Y(r[H].b).toFixed(1);
  const y0 = Y(0).toFixed(1);
  const anos = H / 12, pa = anos > 30 ? 10 : anos > 12 ? 5 : anos > 5 ? 2 : 1;
  const marcas = [];
  for (let a = 0; a <= anos + 1e-9; a += pa) marcas.push(a);
  const mudancas = modo === "guardar" ? [] : degraus(s, base).filter((d) => d.k > 0 && d.k <= H);
  let ponto = null;
  if (c.marca != null && c.marca <= H) {
    const x = X(c.marca), y = Y(r[c.marca].p), lado = x > w * 0.7 ? "end" : "start";
    const ty = alvo && Math.abs(y - Y(alvo)) < 22 ? y + 24 : Math.max(14, y - 12);
    ponto = { x, y, lado, tx: x + (lado === "end" ? -10 : 10), ty, txt: `${big(r[c.marca].p)} · ${mesAno(c.marca, base)}` };
  }

  return (
    <div ref={caixa}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Dinheiro guardado mês a mês">
        {[0.5, 1].map((q) => {
          const v = (ymax / 1.08) * q, y = Y(v);
          return (
            <g key={q}>
              <line x1={pl} x2={w - pr} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
              <text x={w - pr} y={y - 6} textAnchor="end">{curto(v)}</text>
            </g>
          );
        })}
        <path d={`${dp}L${X(H)} ${y0}L${X(0)} ${y0}Z`} fill="color-mix(in srgb, var(--ac) 20%, transparent)" />
        <path d={`${db}L${X(H)} ${y0}L${X(0)} ${y0}Z`} fill="color-mix(in srgb, var(--cv-rosa) 26%, transparent)" />
        <path d={db} fill="none" stroke="var(--cv-rosa)" strokeWidth="2" strokeLinejoin="round" />
        <path d={dp} fill="none" stroke="var(--ac)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {alvo ? (
          <g>
            <line x1={pl} x2={w - pr} y1={Y(alvo)} y2={Y(alvo)} stroke="var(--cv-moeda)" strokeWidth="2" strokeDasharray="6 5" />
            <text x={pl} y={Y(alvo) - 7} style={{ fill: "var(--cv-moeda)" }}>{(modo === "parar" ? "meta " : "quero ") + big(alvo)}</text>
          </g>
        ) : null}
        {mudancas.map((d) => (
          <g key={d.k}>
            <line x1={X(d.k)} x2={X(d.k)} y1={pt} y2={y0} stroke="var(--cv-rosa)" strokeWidth="1.5" strokeDasharray="2 4" />
            <circle cx={X(d.k)} cy={y0} r="4.5" fill="var(--cv-rosa)" />
          </g>
        ))}
        {marcas.map((a) => (
          <text key={a} x={X(a * 12)} y={h - 6} textAnchor={a === 0 ? "start" : a * 12 >= H - 6 ? "end" : "middle"}>
            {a === 0 ? "hoje" : `${s.idade + a} anos`}
          </text>
        ))}
        {ponto && (
          <g>
            <circle cx={ponto.x} cy={ponto.y} r="7" fill="var(--bg)" stroke="var(--ink)" strokeWidth="3" />
            <text className="tx-forte" x={ponto.tx} y={ponto.ty} textAnchor={ponto.lado}>{ponto.txt}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function Calculadora({ chave, chavePessoal, docInvest, patrimonio, larga, ativo }) {
  const nv = useDocNuvem(chave, { vazio: vazioCalc, normalizar: normalizarCalc });
  const { doc, editar } = nv;

  const [modo, setModo] = useState(() => {
    try { return ["parar", "ter", "guardar"].includes(localStorage.getItem(MODO_KEY)) ? localStorage.getItem(MODO_KEY) : "parar"; } catch (e) { return "parar"; }
  });
  useEffect(() => {
    try { localStorage.setItem(MODO_KEY, modo); } catch (e) { /* só neste aparelho */ }
  }, [modo]);

  // números na tela (S). Mudou aqui → vai pra nuvem 0,7s depois da última
  // mexida (ou na hora, se a tela for escondida/fechada).
  const [S, setS] = useState(null);
  const sRef = useRef(null);
  sRef.current = S;
  const pendente = useRef(false);
  const timer = useRef(null);

  const enviar = useCallback(() => {
    clearTimeout(timer.current);
    if (!pendente.current || !sRef.current) return;
    pendente.current = false;
    const novo = sRef.current;
    editar((d) => (igual(d.atual, novo) ? d : { ...d, atual: novo }));
  }, [editar]);

  // chegou versão da nuvem (abriu, ou outro aparelho mudou) e não há mexida
  // esperando pra subir: a tela mostra a da nuvem
  useEffect(() => {
    if (!doc) return;
    if (pendente.current) return;
    if (!sRef.current || !igual(sRef.current, doc.atual)) setS(clone(doc.atual));
  }, [doc]);

  useEffect(() => {
    const ver = () => { if (document.visibilityState === "hidden") enviar(); };
    document.addEventListener("visibilitychange", ver);
    window.addEventListener("pagehide", enviar);
    return () => {
      document.removeEventListener("visibilitychange", ver);
      window.removeEventListener("pagehide", enviar);
      enviar();
    };
  }, [enviar]);
  useEffect(() => { if (!ativo) enviar(); }, [ativo, enviar]);

  const mudar = useCallback((fn, manterPreset) => {
    setS((atual) => {
      if (!atual) return atual;
      const novo = limparNumeros(fn(clone(atual)));
      if (!manterPreset) novo.preset = null;
      return novo;
    });
    pendente.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(enviar, 700);
  }, [enviar]);
  const campo = (k) => (v) => mudar((s) => ({ ...s, [k]: v }));

  const base = mesHoje();
  const c = useMemo(() => (S ? contas(S, modo, base) : null), [S, modo, base]);

  const [pergRef, pilulaPerg] = usePilula([modo, larga, ativo, !!S]);

  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const tm = setTimeout(() => setToast(null), toast.desfazer ? 10000 : 3500);
    return () => clearTimeout(tm);
  }, [toast]);
  const [salvando, setSalvando] = useState(null); // {nome}
  const [lendoOink, setLendoOink] = useState(false);
  const [origemOink, setOrigemOink] = useState(null);
  const [origemMeu, setOrigemMeu] = useState(null); // último cenário salvo que foi aberto

  if (nv.erroCarregar) return <SemInternet />;
  if (!nv.carregado || !doc || !S || !c) return <Carregando texto="Abrindo a calculadora…" />;

  /* ---------------- cenários ---------------- */

  const usarPreset = (k) => {
    setOrigemOink(null);
    setOrigemMeu(null);
    mudar(() => ({ ...clone(PRESETS[k]), idade: S.idade, preset: k }), true);
  };
  const usarOink = async () => {
    if (lendoOink) return;
    setLendoOink(true);
    // SÓ LEITURA da Minhas contas: nada é gravado lá
    let medias = null, leu = false;
    if (chavePessoal) {
      const r = await nuvem.get(chavePessoal);
      if (!r.failed) { leu = true; medias = mediasMinhasContas(r.value); }
    }
    const aportes = mediaAportes(docInvest);
    setLendoOink(false);
    setOrigemMeu(null);
    setOrigemOink({ patrimonio, medias, aportes, leu });
    mudar((s) => ({ ...presetOink(s, { patrimonio, medias, aportes }), preset: "oink" }), true);
  };
  const usarMeu = (cen) => {
    setOrigemOink(null);
    setOrigemMeu(cen.id);
    mudar(() => ({ ...clone(cen.dados), preset: cen.id }), true);
  };

  const cenAtivo = doc.cenarios.find((x) => x.id === S.preset) || null;
  const ultimoMeu = origemMeu ? doc.cenarios.find((x) => x.id === origemMeu) || null : null;

  const salvarNovo = (nome) => {
    const n = nome.trim() || "Meu cenário";
    const dados = { ...clone(S), preset: null };
    const cen = { id: uid(), nome: n.slice(0, 40), criado: new Date().toISOString(), dados };
    editar((d) => ({ ...d, cenarios: [...d.cenarios, cen] }));
    registrar(chave, { acao: "calc:salvou", resumo: `Você salvou o cenário "${cen.nome}" na calculadora`, depois: cen });
    setSalvando(null);
    setOrigemMeu(cen.id);
    mudar((s) => ({ ...s, preset: cen.id }), true);
    setToast({ txt: `Cenário "${cen.nome}" salvo` });
  };
  const atualizarMeu = (cen) => {
    const dados = { ...clone(S), preset: null };
    editar((d) => ({ ...d, cenarios: d.cenarios.map((x) => (x.id === cen.id ? { ...x, dados, mudado: new Date().toISOString() } : x)) }));
    registrar(chave, { acao: "calc:atualizou", resumo: `Você atualizou o cenário "${cen.nome}"`, antes: cen, depois: { ...cen, dados } });
    setSalvando(null);
    mudar((s) => ({ ...s, preset: cen.id }), true);
    setToast({ txt: `Cenário "${cen.nome}" atualizado` });
  };
  const apagarMeu = (cen) => {
    const idx = doc.cenarios.findIndex((x) => x.id === cen.id);
    editar((d) => ({ ...d, cenarios: d.cenarios.filter((x) => x.id !== cen.id) }));
    registrar(chave, { acao: "calc:apagou", resumo: `Você apagou o cenário "${cen.nome}"`, antes: cen });
    if (S.preset === cen.id) mudar((s) => s);
    setToast({
      txt: `Cenário "${cen.nome}" apagado`,
      desfazer: () => {
        editar((d) => {
          if (d.cenarios.some((x) => x.id === cen.id)) return d;
          const lista = d.cenarios.slice();
          lista.splice(Math.min(idx, lista.length), 0, cen);
          return { ...d, cenarios: lista };
        });
        registrar(chave, { acao: "calc:desfez", resumo: `Você trouxe de volta o cenário "${cen.nome}"`, depois: cen });
      },
    });
  };

  /* ---------------- textos da resposta ---------------- */

  const vida = S.pess + S.casa;
  const hojeGuardo = aporteEm(degraus(S, base), 0);
  const ma = (k) => mesAno(k, base);

  let hero;
  if (modo === "parar") {
    const pct = Math.min(100, (p0(S) / c.M) * 100);
    let rot, numero, sub, ruim = false;
    if (c.stop === null) {
      ruim = true;
      rot = "Do jeito que está, não chega antes dos 75";
      numero = "75+";
      sub = "Guarde um pouco mais por mês, gaste menos no começo ou baixe o custo de vida pra trazer a data pra perto.";
    } else if (c.stop === 0) {
      rot = "Você já pode parar hoje";
      numero = <>{S.idade}<small> anos</small></>;
      sub = `O que você tem já paga ${brl(vida)} por mês sem acabar.`;
    } else {
      rot = "Você pode parar de trabalhar com";
      numero = <>{Math.floor(S.idade + c.stop / 12)}<small> anos</small></>;
      sub = <>Daqui a <b>{dur(c.stop)}</b>, em {ma(c.stop)}. Daí em diante o dinheiro paga <b>{brl(vida)} por mês</b> sem acabar.</>;
    }
    const dif = c.need != null ? c.need - hojeGuardo : 0;
    hero = (
      <>
        <div className={"cv-hero" + (ruim ? " ruim" : "")}>
          <div className="cv-rot">{rot}</div>
          <div className="cv-num">{numero}</div>
          <div className="cv-sub">{sub}</div>
          <div className="cv-faixa">
            <div className="cv-faixa-top"><span>Meta pra parar</span><b>{big(c.M)}</b></div>
            <div className="cv-barra"><i className="b2" style={{ width: pct + "%" }} /></div>
            <div className="cv-barra-leg"><span>Hoje você tem {Math.round(pct)}% dela. A meta paga {brl(vida)} por mês sem acabar.</span></div>
          </div>
        </div>
        <div className={"cv-card" + (larga ? " vidro" : "")}>
          <div className="cv-card-cab"><h2>E se eu quiser parar antes?</h2></div>
          <Faixa id="cv-alvo" rotulo="Quero parar com" saida={`${S.alvo} anos`} valor={S.alvo} min={Math.min(75, S.idade + 1)} max={75} step={1} onMuda={campo("alvo")} />
          {!c.n ? <p className="cv-linha">Escolha uma idade maior que a sua pra ver quanto guardar.</p> : (
            <>
              <p className="cv-linha">
                {c.need <= tira(S) + 0.5
                  ? <>O que você já tem chega sozinho na meta. Pode guardar <b>zero</b> e ainda parar com {S.alvo}.</>
                  : <>Pra parar com {S.alvo}, guarde <b>{brl(c.need)} por mês</b> desde agora{dif > 0 ? <>, <span className="cv-alerta">{brl(dif)} a mais</span> do que hoje.</> : <>. <span className="cv-ok">Você já guarda isso.</span></>}</>}
              </p>
              <p className="cv-linha">No seu plano, com {S.alvo} anos você teria <b>{big(c.pAlvo)}</b>, o que paga <b>{brl((c.pAlvo * S.saque) / 100 / 12)} por mês</b> pra sempre.</p>
            </>
          )}
        </div>
      </>
    );
  } else if (modo === "ter") {
    const fim = c.fim, ganho = Math.max(0, fim.p - fim.b), tot = Math.max(1, fim.b + ganho);
    const liquido = hojeGuardo - tira(S);
    hero = (
      <>
        <div className="cv-hero">
          <div className="cv-rot">Guardando como você planejou, em {ma(c.n)} você tem</div>
          <div className="cv-num">{big(fim.p)}</div>
          <div className="cv-sub">
            {liquido < 0 && !S.aps.some((a) => a.v > tira(S))
              ? <>As contas da casa saem do guardado: todo mês sai <b>{brl(-liquido)}</b> a mais do que entra.</>
              : `Você estará com ${S.idade + S.anosVer} anos.`}
          </div>
          <div style={{ marginTop: 14 }}>
            <Faixa id="cv-anosver" rotulo="Daqui a" saida={`${S.anosVer} ${S.anosVer === 1 ? "ano" : "anos"} (${ma(S.anosVer * 12)})`} valor={S.anosVer} min={1} max={40} step={1} onMuda={campo("anosVer")} />
          </div>
          <div className="cv-faixa">
            <div className="cv-faixa-top"><span>De onde vem esse dinheiro</span></div>
            <div className="cv-barra"><i className="b1" style={{ width: (fim.b / tot) * 100 + "%" }} /><i className="b2" style={{ width: (ganho / tot) * 100 + "%" }} /></div>
            <div className="cv-barra-leg">
              <span><i style={{ background: "var(--cv-rosa)" }} />Do seu bolso <b>{big(fim.b)}</b></span>
              <span><i style={{ background: "var(--cv-verde)" }} />Rendimento <b>{big(ganho)}</b></span>
            </div>
          </div>
        </div>
        <div className={"cv-card" + (larga ? " vidro" : "")}>
          <div className="cv-card-cab"><h2>Quando chego em…</h2></div>
          <Din id="cv-metab" rotulo="Um valor que eu quero ter" valor={S.metaB} onMuda={campo("metaB")} />
          <p className="cv-linha">
            {c.quando === null ? `Nesse ritmo você não chega em ${big(S.metaB)} nos próximos 80 anos. Tente guardar mais por mês.`
              : c.quando === 0 ? "Você já tem isso hoje."
                : <>Você chega em <b>{big(S.metaB)}</b> em <b>{ma(c.quando)}</b>, daqui a {dur(c.quando)}, com {Math.floor(S.idade + c.quando / 12)} anos.</>}
          </p>
        </div>
      </>
    );
  } else {
    const dif = c.need - hojeGuardo;
    hero = (
      <>
        <div className={"cv-card" + (larga ? " vidro" : "")}>
          <div className="cv-card-cab"><h2>Aonde você quer chegar</h2></div>
          <div className="cv-2">
            <Din id="cv-metac" rotulo="Quero ter" valor={S.metaC} onMuda={campo("metaC")} />
            <Passo rotulo="Em quanto tempo" saida={`${S.anosC} ${S.anosC === 1 ? "ano" : "anos"}`} onMuda={(d) => mudar((s) => ({ ...s, anosC: s.anosC + d }))} />
          </div>
          <p className="cv-linha">Ou seja, em <b>{ma(c.n)}</b>, com {S.idade + S.anosC} anos.</p>
        </div>
        <div className={"cv-hero" + (dif > 0 ? " ruim" : "")}>
          <div className="cv-rot">Pra ter {big(S.metaC)} em {ma(c.n)}, guarde</div>
          <div className="cv-num cv-num-mes">{c.need < 1 ? "R$ 0" : <>{brl(c.need)}<small> por mês</small></>}</div>
          <div className="cv-sub">{c.need < 1 ? "O que você já tem chega lá sozinho, só rendendo." : "Todo mês, a partir de agora, sempre o mesmo valor (em dinheiro de hoje)."}</div>
          <div className="cv-dupla" style={{ marginTop: 14 }}>
            <div className="cv-escuro"><span>Você guarda hoje</span><b>{brl(hojeGuardo)}</b></div>
            <div className="cv-escuro"><span>{dif > 0 ? "Falta por mês" : "Sobra por mês"}</span><b>{dif > 0 ? "+ " + brl(dif) : brl(-dif)}</b></div>
          </div>
        </div>
      </>
    );
  }

  const dicaGraf = modo === "parar" ? `até os ${S.idade + Math.round((c.r.length - 1) / 12)} anos`
    : modo === "ter" ? `nos próximos ${dur(c.n)}` : `guardando ${brl(c.need)} por mês`;
  const grafico = (
    <div className={"cv-card cv-graf" + (larga ? " vidro" : "")}>
      <div className="cv-card-cab"><h2>Seu dinheiro guardado</h2><span>{dicaGraf}</span></div>
      <Grafico s={S} c={c} modo={modo} base={base} larga={larga} />
      <div className="cv-leg">
        <span><i style={{ background: "var(--ac)" }} />Guardado com rendimento</span>
        <span><i style={{ background: "var(--cv-rosa)" }} />Saiu do seu bolso</span>
        {c.meta ? <span><i className="tr" />{modo === "parar" ? "Meta pra parar" : "Aonde quero chegar"}</span> : null}
        {modo !== "guardar" && S.aps.length > 1 && <span><i style={{ background: "var(--cv-rosa)", borderRadius: "50%" }} />Muda o quanto guardo</span>}
      </div>
    </div>
  );

  /* ---------------- cenários (botões) ---------------- */

  const cenarios = (
    <div className="cv-cen-bloco">
      <div className="cv-cen" role="group" aria-label="Cenários">
        {["premio", "hoje"].map((k) => (
          <button key={k} type="button" className={"cv-chip" + (S.preset === k ? " on" : "")} aria-pressed={S.preset === k} onClick={() => usarPreset(k)}>
            <Ic d={IC[k]} />{NOMES_PRESETS[k]}
          </button>
        ))}
        <button type="button" className={"cv-chip" + (S.preset === "oink" ? " on" : "")} aria-pressed={S.preset === "oink"} onClick={usarOink} disabled={lendoOink}>
          <Ic d={IC.oink} />{lendoOink ? "Lendo seus números…" : NOMES_PRESETS.oink}
        </button>
        {doc.cenarios.map((cen) => (
          <span key={cen.id} className={"cv-chip cv-chip-meu" + (S.preset === cen.id ? " on" : "")}>
            <button type="button" className="cv-chip-nome" aria-pressed={S.preset === cen.id} onClick={() => usarMeu(cen)}><Ic d={IC.meu} />{cen.nome}</button>
            {S.preset === cen.id && (
              <button type="button" className="cv-chip-x" aria-label={`Apagar o cenário ${cen.nome}`} title="Apagar este cenário" onClick={() => apagarMeu(cen)}><Trash2 size={15} /></button>
            )}
          </span>
        ))}
        {!salvando && !cenAtivo && (
          <button type="button" className="cv-chip cv-chip-salvar" onClick={() => setSalvando({ nome: "" })}>
            <Save size={15} /> Salvar estes números
          </button>
        )}
      </div>
      {S.preset === "oink" && origemOink && (
        <p className="cv-origem">
          Tirado do Oink, só pra ler: carteira <b>{brl(origemOink.patrimonio || 0)}</b>
          {origemOink.medias ? <>, gasto médio <b>{brl(origemOink.medias.gasto)}</b>/mês e sobra média <b>{brl(origemOink.medias.sobra)}</b>/mês na Minhas contas ({origemOink.medias.meses === 1 ? "último mês" : `últimos ${origemOink.medias.meses} meses`})</>
            : origemOink.leu ? " (a Minhas contas não tem lançamentos nos últimos 3 meses)" : " (não consegui ler a Minhas contas agora)"}
          {!origemOink.medias && origemOink.aportes > 0 ? <>; você guardou em média <b>{brl(origemOink.aportes)}</b>/mês nos investimentos</> : null}
          . Confira e ajuste embaixo.
        </p>
      )}
      {salvando && (
        <form className="cv-salvar" onSubmit={(e) => { e.preventDefault(); salvarNovo(salvando.nome); }}>
          <label htmlFor="cv-nome-cen">Nome do cenário</label>
          <input id="cv-nome-cen" autoFocus maxLength={40} placeholder="Ex.: Depois do aumento" value={salvando.nome} onChange={(e) => setSalvando({ ...salvando, nome: e.target.value })} />
          <div className="cv-salvar-bts">
            {ultimoMeu && <button type="button" className="cv-bt cv-bt-2" onClick={() => atualizarMeu(ultimoMeu)}>Atualizar "{ultimoMeu.nome}"</button>}
            <button type="submit" className="cv-bt"><Check size={17} strokeWidth={2.8} /> {ultimoMeu ? "Salvar como novo" : "Salvar"}</button>
            <button type="button" className="cv-bt cv-bt-3" onClick={() => setSalvando(null)}>Cancelar</button>
          </div>
          <small>Fica guardado na sua conta: aparece no Mac e no celular. Não mexe em nada do Oink.</small>
        </form>
      )}
    </div>
  );

  const pergunta = (
    <div className="cv-perg" role="tablist" aria-label="O que você quer saber" ref={pergRef}>
      <span className="cv-pil" data-pilula style={pilulaPerg} />
      {[["parar", "Quando paro?"], ["ter", "Quanto vou ter?"], ["guardar", "Quanto guardar?"]].map(([k, t]) => (
        <button key={k} type="button" role="tab" aria-selected={modo === k} data-on={modo === k ? "1" : undefined} className={modo === k ? "on" : ""} onClick={() => setModo(k)}>{t}</button>
      ))}
    </div>
  );

  /* ---------------- seus números ---------------- */

  const minMes = mesDoK(1, base);
  const aps = S.aps.map((a, j) => j === 0 ? (
    <div key="agora" className="cv-ap">
      <div className="cv-ap-q agora"><i />Agora</div>
      <Din id="cv-ap0" ariaLabel="Quanto guarda por mês agora" valor={a.v} onMuda={(v) => mudar((s) => { s.aps[0].v = v; return s; })} />
      <span />
    </div>
  ) : (
    <div key={j} className="cv-ap">
      <input type="month" className="cv-mes" aria-label="A partir de que mês" value={a.de} min={minMes}
        onChange={(e) => {
          const v = e.target.value;
          if (!/^\d{4}-\d{2}$/.test(v) || kDoMes(v, base) < 1) return;
          mudar((s) => {
            s.aps[j].de = v;
            const [ag, ...resto] = s.aps;
            return { ...s, aps: [ag, ...resto.sort((x, y) => (x.de < y.de ? -1 : 1))] };
          });
        }} />
      <Din id={`cv-ap${j}`} ariaLabel="Quanto passa a guardar" valor={a.v} onMuda={(v) => mudar((s) => { s.aps[j].v = v; return s; })} />
      <button type="button" className="cv-tirar" aria-label="Tirar esta mudança" onClick={() => mudar((s) => ({ ...s, aps: s.aps.filter((_, i) => i !== j) }))}><X size={18} /></button>
    </div>
  ));
  const maisAp = () => mudar((s) => {
    const ult = s.aps[s.aps.length - 1];
    const k = ult.de ? Math.max(kDoMes(ult.de, base) + 12, 12) : 12;
    return { ...s, aps: [...s.aps, { de: mesDoK(k, base), v: ult.v + 1000 }] };
  });

  const numeros = (
    <div className={"cv-card" + (larga ? " vidro" : "")}>
      <div className="cv-card-cab"><h2>Seus números</h2><span>em dinheiro de hoje</span></div>
      <div className="cv-grupo">
        <h3>Hoje</h3>
        <Passo rotulo="Sua idade" saida={`${S.idade} anos`} onMuda={(d) => mudar((s) => ({ ...s, idade: s.idade + d, alvo: s.alvo <= s.idade + d ? Math.min(75, s.idade + d + 1) : s.alvo }))} />
        <Din id="cv-patr" rotulo="Quanto você tem guardado" valor={S.patr} onMuda={campo("patr")} />
        <Din id="cv-ini" rotulo="Gasto grande no começo" valor={S.ini} onMuda={campo("ini")} dica="Carro, reforma, viagem. Sai do que você tem hoje." />
      </div>
      <div className="cv-grupo">
        <h3>Quanto guardo por mês</h3>
        <div className="cv-aps">{aps}</div>
        <button type="button" className="cv-mais" onClick={maisAp}><Plus size={16} strokeWidth={2.8} /> Mudar o valor a partir de um mês</button>
        <small className="cv-peq">Ex.: hoje guardo R$ 2.000; a partir de março, quando o aumento entrar, passo a guardar R$ 3.500.</small>
      </div>
      <div className="cv-grupo">
        <h3>Custo de vida</h3>
        <div className="cv-2">
          <Din id="cv-pess" rotulo="Gasto comigo" valor={S.pess} onMuda={campo("pess")} />
          <Din id="cv-casa" rotulo="Contas da casa" valor={S.casa} onMuda={campo("casa")} />
        </div>
        <label className="cv-chave">
          <span>As contas da casa saem do dinheiro guardado, não do salário</span>
          <input type="checkbox" checked={S.casaPot} onChange={(e) => mudar((s) => ({ ...s, casaPot: e.target.checked }))} />
          <span className="cv-sw" />
        </label>
      </div>
      <div className="cv-grupo">
        <h3>Premissas</h3>
        <Faixa id="cv-taxa" rotulo="Ganho real por ano" saida={`${S.taxa.toLocaleString("pt-BR")}% ao ano`} valor={S.taxa} min={2} max={8} step={0.5} onMuda={campo("taxa")}
          dica="O que rende acima da inflação, já sem imposto. 5,5% é a renda fixa com CDI perto de 12%." />
        {modo === "parar" && (
          <Faixa id="cv-saque" rotulo="Quanto tirar por ano depois de parar" saida={`${S.saque.toLocaleString("pt-BR")}% ao ano`} valor={S.saque} min={3} max={5} step={0.25} onMuda={campo("saque")}
            dica="4% é a regra clássica pro dinheiro durar a vida toda. Menos é mais seguro." />
        )}
      </div>
    </div>
  );

  const aviso = (
    <div className="cv-aviso">
      <Info size={18} />
      <span><b>É conta de projeção, não indicação de investimento.</b> Tudo em dinheiro de hoje, já sem inflação. Nada do que você mexe aqui muda os seus dados do Oink.</span>
    </div>
  );

  const avisos = (
    <>
      {nv.erroSalvar && <div className="cv-erro">Não consegui guardar suas mudanças na nuvem. Vou tentar de novo sozinho a cada 5 segundos.</div>}
      {nv.conflito && (
        <div className="cv-erro">
          Você mexeu na calculadora em outro aparelho ao mesmo tempo ({nv.conflito.quando}). Fiquei com a versão mais nova e guardei uma cópia da daqui.
          <button type="button" onClick={nv.fecharConflito}>Ok</button>
        </div>
      )}
    </>
  );

  const toastEl = toast && (
    <div className="cv-toast" role="status">
      <span>{toast.txt}</span>
      {toast.desfazer && <button type="button" onClick={() => { toast.desfazer(); setToast(null); }}>Desfazer</button>}
    </div>
  );

  if (larga) {
    return (
      <div className="cv">
        {avisos}
        <div className="cv-mac">
          <div className="cv-col">
            <div className="cv-col" style={{ gap: 12 }}>{cenarios}{pergunta}</div>
            {modo === "guardar" ? hero : <div className="cv-mac-2">{hero}</div>}
            {grafico}
            {aviso}
          </div>
          <div className="cv-lado">{numeros}</div>
        </div>
        {toastEl}
      </div>
    );
  }
  return (
    <div className="cv cv-col">
      {avisos}
      {cenarios}
      {pergunta}
      {hero}
      {grafico}
      {numeros}
      {aviso}
      {toastEl}
    </div>
  );
}

/* ---------------- estilos ---------------- */

export function CVStyles() {
  return (
    <style>{`
.iv{--cv-rosa:var(--o-rosa,#FF7EA6);--cv-moeda:var(--o-moeda,#FFC94D);--cv-verde:var(--ac);--cv-pil:cubic-bezier(.66,.01,.24,1.02)}
/* abas de cima: Investimentos | Calculadora */
.cv-abas{position:relative;display:grid;grid-template-columns:auto auto;gap:2px;background:var(--sf2);border-radius:999px;padding:5px;min-width:0}
.cv-abas button{position:relative;z-index:1;height:44px;padding:0 20px;border:none;border-radius:999px;background:transparent;color:var(--soft);
  font:800 15.5px 'Nunito',sans-serif;white-space:nowrap;cursor:pointer;transition:color .3s}
.mc-larga .cv-abas button{height:48px;padding:0 24px;font-size:17px}
.cv-abas button.on{color:var(--bg);font-weight:900}
.cv-pil{position:absolute;top:0;left:0;z-index:0;border-radius:999px;background:var(--ink);pointer-events:none;will-change:transform,width}
.iv-topo.cv-topo-cel{margin-top:4px}
.cv-topo-cel .cv-abas{flex:1;grid-template-columns:1fr 1fr}
.cv-topo-cel .cv-abas button{padding:0 8px;font-size:14.5px}

.cv-col{display:flex;flex-direction:column;gap:14px;min-width:0}
.cv-mac{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:18px;align-items:start}
.cv-mac .cv-col{gap:16px}
.cv-lado{position:sticky;top:14px;min-width:0}
.cv-mac-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
/* janela do Mac menor: o cartão verde e o "E se…" ficam um embaixo do outro */
@media (max-width:1380px){.cv-mac-2{grid-template-columns:minmax(0,1fr)}}

/* cenários */
.cv-cen-bloco{display:flex;flex-direction:column;gap:10px;min-width:0}
.cv-cen{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:2px 16px}
.cv-cen::-webkit-scrollbar{display:none}
.mc-larga .cv-cen{margin:0;padding:0;flex-wrap:wrap;overflow:visible}
.cv-chip{height:38px;padding:0 15px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--soft);font:800 13.5px 'Nunito',sans-serif;
  white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:7px;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.cv-chip:hover{border-color:var(--faint);color:var(--ink)}
.cv-chip.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.cv-chip:disabled{opacity:.7;cursor:progress}
.cv-chip-meu{padding:0}
.cv-chip-meu button{border:none;background:transparent;color:inherit;font:inherit;height:100%;display:inline-flex;align-items:center;gap:7px;cursor:pointer}
.cv-chip-nome{padding:0 15px}
.cv-chip-meu.on .cv-chip-nome{padding-right:6px}
.cv-chip-x{padding:0 12px 0 6px;opacity:.75}
.cv-chip-x:hover{opacity:1;color:var(--neg)}
.cv-chip-salvar{border-style:dashed;color:var(--cv-rosa)}
.cv-chip-salvar:hover{border-color:var(--cv-rosa);color:var(--cv-rosa)}
.cv-origem{margin:0;font-size:13px;font-weight:700;line-height:1.5;color:var(--soft)}
.cv-origem b{color:var(--ink);font-weight:900}
.cv-salvar{display:flex;flex-direction:column;gap:8px;background:var(--sf);border:1px solid var(--line);border-radius:20px;padding:14px}
.cv-salvar label{font-size:14px;font-weight:800}
.cv-salvar input{min-height:48px;background:var(--sf2);border:1px solid var(--line);border-radius:14px;padding:0 14px;color:var(--ink);font:800 16px 'Nunito',sans-serif;outline:none}
.cv-salvar input:focus{border-color:var(--ac)}
.cv-salvar small{font-size:12.5px;font-weight:700;color:var(--faint);line-height:1.4}
.cv-salvar-bts{display:flex;flex-wrap:wrap;gap:8px}
.cv-bt{height:42px;padding:0 16px;border-radius:999px;border:none;background:var(--ac);color:var(--ac-deep);font:900 14px 'Nunito',sans-serif;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.cv-bt-2{background:var(--ink);color:var(--bg)}
.cv-bt-3{background:transparent;color:var(--soft);border:1px solid var(--line)}

/* a pergunta */
.cv-perg{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:var(--sf2);border-radius:999px;padding:4px}
.cv-perg button{position:relative;z-index:1;height:40px;border:none;border-radius:999px;background:transparent;color:var(--soft);font:800 13px 'Nunito',sans-serif;
  white-space:nowrap;padding:0 2px;letter-spacing:-.01em;cursor:pointer;transition:color .3s}
.mc-larga .cv-perg button{font-size:14.5px}
.cv-perg button.on{color:var(--bg);font-weight:900}

/* cartão-resposta (o verde do Oink) */
.cv-hero{position:relative;overflow:hidden;border-radius:26px;padding:20px 20px 18px;border:1px solid var(--line);color:var(--ink);
  background:linear-gradient(160deg, color-mix(in srgb, #1E8A5E 70%, var(--sf)), var(--sf))}
html[data-tema="claro"] .cv-hero{background:linear-gradient(160deg,#1E8A5E,#0C5237);border-color:transparent;--ink:#F2FBF6;--soft:#CFE9DA;--faint:#A9CDB9;color:#F2FBF6}
.cv-hero.ruim{background:linear-gradient(160deg, color-mix(in srgb, #C0454A 58%, var(--sf)), var(--sf))}
html[data-tema="claro"] .cv-hero.ruim{background:linear-gradient(160deg,#C0454A,#7E2226)}
.cv-hero::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.16) 50%,transparent 62%);
  transform:translateX(-100%);animation:mc-brilho 6s ease-in-out infinite}
.cv-rot{font-size:15px;font-weight:800;color:color-mix(in srgb, var(--ink) 78%, transparent);line-height:1.3}
.cv-num{font-size:52px;font-weight:900;letter-spacing:-.025em;line-height:1.02;margin-top:4px}
.mc-larga .cv-num{font-size:64px}
.cv-num small{font-size:.48em;font-weight:800;opacity:.8;letter-spacing:0;white-space:nowrap}
.cv-num-mes{font-size:clamp(34px,10.5vw,52px)}
.mc-larga .cv-num-mes{font-size:56px}
.cv-sub{font-size:14.5px;font-weight:700;line-height:1.5;color:color-mix(in srgb, var(--ink) 84%, transparent);margin-top:8px;max-width:52ch}
.cv-sub b{font-weight:900;color:var(--ink)}
.mc-larga .cv-hero{padding:26px 28px 24px}
.cv-faixa{margin-top:16px;padding:14px;border-radius:18px;background:color-mix(in srgb, #000 22%, transparent)}
html[data-tema="claro"] .cv-faixa{background:color-mix(in srgb, #000 16%, transparent)}
.cv-faixa-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:14px;font-weight:800}
.cv-faixa-top b{font-size:17px;font-weight:900}
.cv-barra{display:flex;height:12px;border-radius:999px;overflow:hidden;margin-top:12px;background:color-mix(in srgb, var(--ink) 14%, transparent)}
.cv-barra i{display:block;height:100%;transition:width .6s var(--ease)}
.cv-barra .b1{background:var(--cv-rosa)} .cv-barra .b2{background:var(--cv-verde)}
html[data-tema="claro"] .cv-hero{--cv-verde:#7CF0B5}
.cv-barra-leg{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:13px;font-weight:800;color:color-mix(in srgb, var(--ink) 80%, transparent)}
.cv-barra-leg i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px}
.cv-barra-leg b{color:var(--ink);font-weight:900}
.cv-escuro{background:color-mix(in srgb, #000 22%, transparent)!important}

/* cartões */
.cv-card{background:var(--sf);border:1px solid var(--line);border-radius:24px;padding:16px;min-width:0}
.mc-larga .cv-card{padding:20px 22px}
.cv-card h2{margin:0;font-size:17px;font-weight:900;line-height:1.25}
.cv-card-cab{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
.cv-card-cab span{font-size:12.5px;font-weight:800;color:var(--faint);text-align:right}
.cv-linha{font-size:15px;line-height:1.5;color:var(--soft);margin:10px 0 0}
.cv-linha b{color:var(--ink);font-weight:900}
.cv-ok{color:var(--ac)} .cv-alerta{color:var(--cv-rosa)}
.cv-dupla{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.cv-dupla > div{border-radius:16px;padding:11px 13px;min-width:0}
.cv-dupla span{display:block;font-size:12.5px;font-weight:800;color:var(--faint);line-height:1.3}
.cv-dupla b{display:block;font-size:19px;font-weight:900;margin-top:3px;white-space:nowrap}

/* gráfico */
.cv-graf svg{display:block;overflow:visible}
.cv-graf text{font:800 11.5px 'Nunito',sans-serif;fill:var(--faint)}
.cv-graf .tx-forte{fill:var(--ink);font-weight:900;font-size:12.5px}
.cv-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;font-weight:800;color:var(--soft);margin-top:10px}
.cv-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.cv-leg i.tr{height:0;border-top:2px dashed var(--cv-moeda);border-radius:0;width:14px;vertical-align:3px}

/* campos */
.cv-grupo{display:flex;flex-direction:column;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)}
.cv-grupo:first-of-type{padding-top:4px}
.cv-grupo:last-child{border-bottom:none;padding-bottom:2px}
.cv-grupo h3{margin:0;font-size:12px;font-weight:900;color:var(--faint);text-transform:uppercase;letter-spacing:.06em}
.cv-campo{display:flex;flex-direction:column;gap:6px;min-width:0}
.cv-campo label,.cv-campo .cv-lab{font-size:14.5px;font-weight:800;color:var(--ink);display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.cv-campo output{font-weight:900;white-space:nowrap}
.cv-campo small,.cv-peq{font-size:12.5px;font-weight:700;color:var(--faint);line-height:1.4}
.cv-hero .cv-campo small{color:var(--soft)}
.cv-din{display:flex;align-items:center;gap:6px;min-height:50px;background:var(--sf2);border:1px solid var(--line);border-radius:14px;padding:0 14px;transition:border-color .2s;min-width:0}
.cv-din:focus-within{border-color:var(--ac)}
.cv-din span{color:var(--faint);font-weight:800;font-size:15px}
.cv-din input{border:0;background:transparent;color:var(--ink);font:800 17px 'Nunito',sans-serif;width:100%;min-width:0;outline:none;padding:12px 0;font-variant-numeric:tabular-nums}
.cv-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.cv-anos{display:flex;align-items:center;min-height:50px;background:var(--sf2);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.cv-anos button{width:44px;height:48px;border:none;background:transparent;color:var(--ink);font:900 20px 'Nunito',sans-serif;flex-shrink:0;cursor:pointer}
.cv-anos button:hover{background:color-mix(in srgb, var(--ink) 8%, transparent)}
.cv-anos b{flex:1;text-align:center;font-size:16px;font-weight:900;white-space:nowrap}
.cv input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:28px;background:transparent;margin:0}
.cv input[type=range]::-webkit-slider-runnable-track{height:8px;border-radius:999px;background:color-mix(in srgb, var(--ink) 14%, transparent)}
.cv input[type=range]::-moz-range-track{height:8px;border-radius:999px;background:color-mix(in srgb, var(--ink) 14%, transparent)}
.cv input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;margin-top:-8px;background:var(--ink);border:4px solid var(--ac);box-shadow:0 3px 8px rgba(0,0,0,.3)}
.cv input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--ink);border:4px solid var(--ac)}
.cv-hero input[type=range]::-webkit-slider-runnable-track{background:color-mix(in srgb, #fff 22%, transparent)}
.cv-hero input[type=range]::-webkit-slider-thumb{background:#F2FBF6;border-color:#FF7EA6}
.cv :focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.cv-chave{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14.5px;font-weight:800;line-height:1.35;cursor:pointer;min-height:40px;position:relative}
.cv-chave input{position:absolute;opacity:0;width:1px;height:1px}
.cv-sw{width:48px;height:28px;border-radius:999px;background:color-mix(in srgb, var(--ink) 18%, transparent);position:relative;flex-shrink:0;transition:background .25s}
.cv-sw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--ink);transition:transform .3s var(--ease)}
.cv-chave input:checked + .cv-sw{background:var(--ac)}
.cv-chave input:checked + .cv-sw::after{transform:translateX(20px);background:var(--ac-deep)}
html[data-tema="claro"] .cv-chave input:checked + .cv-sw::after{background:#fff}
.cv-chave input:focus-visible + .cv-sw{outline:2px solid var(--ac);outline-offset:2px}

/* quanto guardo (pode mudar) */
.cv-aps{display:flex;flex-direction:column;gap:8px}
.cv-ap{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) 36px;gap:8px;align-items:center}
.cv-ap-q{font-size:14px;font-weight:800;color:var(--soft);display:flex;align-items:center;gap:8px;min-height:50px;padding-left:2px}
.cv-ap-q i{width:10px;height:10px;border-radius:50%;background:var(--cv-rosa);flex-shrink:0}
.cv-ap-q.agora i{background:var(--ac)}
.cv-mes{min-height:50px;background:var(--sf2);border:1px solid var(--line);border-radius:14px;padding:0 8px;color:var(--ink);font:800 13.5px 'Nunito',sans-serif;width:100%;min-width:0;color-scheme:inherit}
.cv-mes::-webkit-calendar-picker-indicator{margin-left:2px;opacity:.6}
.cv-tirar{width:36px;height:36px;border-radius:12px;border:none;background:transparent;color:var(--faint);display:flex;align-items:center;justify-content:center;cursor:pointer}
.cv-tirar:hover{background:var(--sf2);color:var(--neg)}
.cv-mais{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:999px;border:1px dashed var(--line);background:transparent;color:var(--cv-rosa);font:900 13.5px 'Nunito',sans-serif;cursor:pointer}
.cv-mais:hover{border-color:var(--cv-rosa)}

.cv-aviso{display:flex;gap:10px;align-items:flex-start;padding:13px 15px;border-radius:18px;background:color-mix(in srgb, var(--cv-moeda) 12%, transparent);color:var(--soft);font-size:13px;font-weight:700;line-height:1.5}
.cv-aviso svg{flex-shrink:0;color:var(--cv-moeda);margin-top:2px}
html[data-tema="claro"] .cv-aviso svg{color:#B7791F}
.cv-aviso b{color:var(--ink);font-weight:900}
.cv-erro{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:16px;margin-bottom:12px;font-size:13.5px;font-weight:800;line-height:1.4;
  background:color-mix(in srgb, var(--neg) 16%, transparent);color:var(--ink)}
.cv-erro button{border:none;background:var(--ink);color:var(--bg);border-radius:999px;height:34px;padding:0 14px;font:900 13px 'Nunito',sans-serif;cursor:pointer;flex-shrink:0}
.cv-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:14px;
  background:var(--ink);color:var(--bg);border-radius:16px;padding:12px 16px;font-size:14px;font-weight:800;box-shadow:0 12px 30px var(--o-sombra,rgba(0,0,0,.4));max-width:calc(100vw - 32px)}
.mc-larga .cv-toast{bottom:28px;left:calc(50% + 138px)}
.cv-toast button{border:none;background:transparent;color:var(--cv-rosa);font:900 14px 'Nunito',sans-serif;cursor:pointer;padding:4px 2px}
html[data-tema="claro"] .cv-toast button{color:#FFB3CB}
@media (prefers-reduced-motion:reduce){.cv-hero::after{animation:none}}
`}</style>
  );
}
