import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  ChevronLeft, ChevronDown, Plus, Minus, X, Eye, EyeOff, Settings, Pencil, Trash2, Check, Target, Info, Waves, Scale,
} from "lucide-react";
import { useDocNuvem, registrar } from "../pessoal/nuvem.js";
import { MCStyles } from "../pessoal/estilo.jsx";
import { CampoData } from "../pessoal/MinhasContas.jsx";
import { Carregando, SemInternet } from "../tema.jsx";
import { IVStyles } from "./estilo.jsx";
import {
  TIPOS, vazio, normalizar, simular, calcularCarteira, evolucao, progressoMetas, primeiraData,
  atualizarMercado, lerCacheMercado, fmt, fmtSinal, fmtPct, fmtQtd, lerNumero, uid, hojeISO,
  brData, dataLonga, faixaIR,
} from "./logica.js";

const OLHO_KEY = "fc-hide-values";
const GRUPOS_KEY = "oink-inv-fechados";

/* ---------------- ícones dos tipos ---------------- */

const DESENHOS = {
  cdi: <><path d="M19 10c.8 0 1.5.7 1.5 1.5v1c0 .8-.7 1.5-1.5 1.5h-.6a7 7 0 0 1-2.4 2.6V19h-3v-1.5h-3V19H7v-2.6A6 6 0 0 1 4 11c0-3.3 3.1-6 7-6h1.5L15 3v3a6.8 6.8 0 0 1 3.4 4z" /><path d="M8 9.5h.01" /></>,
  selic: <path d="M3 21h18M4 10h16M12 3l9 5H3zM6 10v8M10 10v8M14 10v8M18 10v8" />,
  ipca: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
};
function IcTipo({ tipo, size = 44 }) {
  const s = Math.round(size * 0.46);
  return (
    <span className="iv-ic" style={{ width: size, height: size, background: TIPOS[tipo].cor }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">{DESENHOS[tipo]}</svg>
    </span>
  );
}

/* ---------------- taxas do mercado ---------------- */

// Busca as taxas do Banco Central e os preços do Tesouro. Mostra na hora o
// que já estava guardado no aparelho e atualiza por trás; tenta de novo a
// cada 30 min enquanto a aba estiver aberta.
function useMercado(desde, ativo) {
  const [estado, setEstado] = useState(() => ({ mercado: lerCacheMercado() || {}, falhou: false, buscando: true }));
  const buscar = useCallback(async () => {
    setEstado((e) => ({ ...e, buscando: true }));
    const r = await atualizarMercado(desde || hojeISO());
    setEstado({ mercado: r.mercado, falhou: r.falhou, buscando: false });
  }, [desde]);
  useEffect(() => {
    if (!ativo) return undefined;
    buscar();
    const iv = setInterval(buscar, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [buscar, ativo]);
  return { ...estado, tentarDeNovo: buscar };
}

const cdiAno = (m) => {
  const d = m.cdi?.length ? m.cdi[m.cdi.length - 1][1] : null;
  return d == null ? null : (Math.pow(1 + d / 100, 252) - 1) * 100;
};

/* ------------------------------------------------------------------ */

export default function Investimentos({ chave, ativo = true, larga }) {
  const nv = useDocNuvem(chave, { vazio, normalizar });
  const { doc, editar } = nv;
  const desde = useMemo(() => (doc ? primeiraData(doc) : null), [doc]);
  const mk = useMercado(desde, ativo);
  const mercado = mk.mercado;

  const [oculto, setOculto] = useState(() => {
    try { return localStorage.getItem(OLHO_KEY) === "1"; } catch (e) { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(OLHO_KEY, oculto ? "1" : "0"); } catch (e) { /* só neste aparelho */ }
  }, [oculto]);
  const [fechados, setFechados] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GRUPOS_KEY) || "[]"); } catch (e) { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(GRUPOS_KEY, JSON.stringify(fechados)); } catch (e) { /* só neste aparelho */ }
  }, [fechados]);

  const [abertoId, setAbertoId] = useState(null);
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const tm = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(tm);
  }, [toast]);

  // o "+" da barra de baixo (celular) abre o cadastro
  useEffect(() => {
    if (!ativo) return undefined;
    const novo = () => setForm({ tipo: "novo" });
    window.addEventListener("oink-novo", novo);
    return () => window.removeEventListener("oink-novo", novo);
  }, [ativo]);

  const carteira = useMemo(() => (doc ? calcularCarteira(doc, mercado) : null), [doc, mercado]);
  const pontos = useMemo(() => (doc ? evolucao(doc, mercado) : []), [doc, mercado]);
  const metas = useMemo(() => (doc && carteira ? progressoMetas(doc, carteira) : []), [doc, carteira]);

  if (nv.erroCarregar) return <div className="mc-wrap iv"><MCStyles /><IVStyles /><SemInternet /></div>;
  if (!nv.carregado || !doc) return <div className="mc-wrap iv"><MCStyles /><IVStyles /><Carregando texto="Abrindo seus investimentos…" /></div>;

  const v = (n) => (oculto ? "••••" : fmt(n));
  const aberto = abertoId ? carteira.itens.find((x) => x.inv.id === abertoId) : null;

  /* ---------------- gravar (só o que o Joel digitou) ---------------- */

  const mudarInv = (id, fn, resumo) => {
    const antes = doc.investimentos.find((i) => i.id === id);
    const depois = fn(antes);
    editar((d) => ({ ...d, investimentos: d.investimentos.map((i) => (i.id === id ? fn(i) : i)) }));
    registrar(chave, { acao: "invest:editou", resumo, antes, depois });
  };
  const criarInv = (inv, novaMeta) => {
    editar((d) => ({
      ...d,
      metas: novaMeta ? [...d.metas, novaMeta] : d.metas,
      investimentos: [...d.investimentos, inv],
    }));
    registrar(chave, { acao: "invest:criou", resumo: `Você cadastrou o investimento ${inv.nome}`, depois: inv });
    setToast("Investimento guardado");
  };
  const excluirInv = (id) => {
    const antes = doc.investimentos.find((i) => i.id === id);
    editar((d) => ({ ...d, investimentos: d.investimentos.filter((i) => i.id !== id) }));
    registrar(chave, { acao: "invest:excluiu", resumo: `Você apagou o investimento ${antes?.nome}`, antes });
    setAbertoId(null);
    setToast("Investimento apagado (fica guardado no registro de atividades)");
  };
  const salvarMov = (invId, mov) => {
    const inv = doc.investimentos.find((i) => i.id === invId);
    const existe = inv.movs.some((m) => m.id === mov.id);
    const nome = { aporte: "guardou", resgate: "resgatou", ajuste: "ajustou o saldo de" }[mov.tipo];
    mudarInv(invId, (i) => ({ ...i, movs: existe ? i.movs.map((m) => (m.id === mov.id ? mov : m)) : [...i.movs, mov] }),
      existe ? `Você mudou um registro de ${inv.nome}` : `Você ${nome} ${inv.nome}: R$ ${fmt(mov.valor ?? mov.saldo)}`);
    setToast(existe ? "Registro atualizado" : mov.tipo === "resgate" ? "Resgate registrado" : mov.tipo === "ajuste" ? "Saldo ajustado" : "Guardado!");
  };
  const excluirMov = (invId, movId) => {
    const inv = doc.investimentos.find((i) => i.id === invId);
    mudarInv(invId, (i) => ({ ...i, movs: i.movs.filter((m) => m.id !== movId) }), `Você apagou um registro de ${inv.nome}`);
    setToast("Registro apagado");
  };
  const salvarMetas = (novasMetas, ligacoes) => {
    const antes = { metas: doc.metas, ligacoes: doc.investimentos.map((i) => [i.id, i.metaId || null]) };
    editar((d) => ({
      ...d,
      metas: novasMetas,
      investimentos: d.investimentos.map((i) => (i.id in ligacoes ? { ...i, metaId: ligacoes[i.id] || null } : i)),
    }));
    registrar(chave, { acao: "invest:metas", resumo: "Você mudou as metas", antes, depois: { metas: novasMetas, ligacoes } });
    setToast("Metas guardadas");
  };

  /* ---------------- pedaços da tela ---------------- */

  const semNada = carteira.itens.length === 0;
  const taxaAno = cdiAno(mercado);
  const infoMercado = mk.falhou ? (
    <div className="iv-vivo off"><i />Sem conexão com o Banco Central agora · {mercado.buscadoEm ? `taxas de ${brData(mercado.buscadoEm.slice(0, 10))}` : "mostrando o valor guardado"}</div>
  ) : (
    <div className="iv-vivo"><i />
      {carteira.porDia > 0.004 ? `Rendendo ≈ R$ ${v(carteira.porDia)} por dia útil` : "Taxas oficiais do dia"}
      {taxaAno ? ` · CDI ${taxaAno.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a.` : ""}
    </div>
  );

  const [inteiro, centavos] = fmt(carteira.bruto).split(",");
  const hero = (
    <div className="mc-hero-card iv-hero vidro">
      <div className="mc-hero-rot">Minha carteira</div>
      <div className="mc-hero-num">{oculto ? "R$ ••••" : <><small>R$ </small>{inteiro}<small>,{centavos}</small></>}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <span className="iv-pill">Guardei <b>{v(carteira.custo)}</b></span>
        <span className="iv-pill">Rendeu <b className={carteira.ganho < 0 ? "iv-neg" : "iv-pos"}>{oculto ? "••••" : fmtSinal(carteira.ganho)}{carteira.custo > 0 ? ` · ${fmtPct(carteira.pct)}` : ""}</b></span>
      </div>
      <div className="iv-liq"><span>Se resgatar tudo hoje<br />(já sem Imposto de Renda)</span><b>R$ {v(carteira.liquido)}</b></div>
      {infoMercado}
    </div>
  );

  const tres = (
    <div className="iv-tres">
      <div><span>Este mês</span><b className={carteira.esteMes < 0 ? "iv-neg" : "iv-pos"}>{oculto ? "••••" : fmtSinal(carteira.esteMes)}</b></div>
      <div><span>Por dia</span><b>{carteira.porDia > 0 ? "≈ " + v(carteira.porDia) : "—"}</b></div>
      <div title="Quanto a carteira rendeu comparado a deixar o mesmo dinheiro em 100% do CDI"><span>Do CDI</span><b className={carteira.vsCDI >= 100 ? "iv-pos" : ""}>{carteira.vsCDI != null ? `${Math.round(carteira.vsCDI)}%` : "—"}</b></div>
    </div>
  );

  const lista = (
    <>
      <div className="iv-sec" style={{ margin: "10px 0 0" }}>
        <h2>Meus investimentos</h2>
        <span>{carteira.itens.length}</span>
      </div>
      {semNada ? (
        <div className="iv-vazio">
          <b>Nenhum investimento ainda</b>
          Cadastre a sua caixinha, CDB ou Tesouro e o Oink calcula o rendimento sozinho, com as taxas oficiais.
          <button className="mc-btn-rosa" onClick={() => setForm({ tipo: "novo" })}><Plus size={18} strokeWidth={2.8} /> Cadastrar o primeiro</button>
        </div>
      ) : carteira.grupos.map((g) => {
        const fechado = fechados.includes(g.tipo);
        return (
          <div key={g.tipo} className={"iv-grp" + (fechado ? "" : " aberto")}>
            <button className="iv-gcab" aria-expanded={!fechado} onClick={() => setFechados((f) => (fechado ? f.filter((x) => x !== g.tipo) : [...f, g.tipo]))}>
              <IcTipo tipo={g.tipo} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="iv-nome">{TIPOS[g.tipo].nome}</div>
                <div className="iv-sub" style={{ whiteSpace: "normal" }}>{g.itens.length} {g.itens.length === 1 ? "investimento" : "investimentos"} · {Math.round(g.pct * 100)}% da carteira</div>
              </div>
              <div>
                <div className="iv-val">{v(g.bruto)}</div>
                <div className={"iv-ganho" + (g.ganho < 0 ? " neg" : "")}>{oculto ? "••••" : fmtSinal(g.ganho)}</div>
              </div>
              <span className="iv-chev"><ChevronDown size={20} /></span>
            </button>
            {!fechado && (
              <div className="iv-subs">
                {g.itens.map(({ inv, r }) => (
                  <button key={inv.id} className={"iv-it" + (larga && abertoId === inv.id ? " on" : "")} onClick={() => setAbertoId(inv.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="iv-nome">{inv.nome}{inv.tipo === "ipca" && <span className="iv-tag"><Waves size={11} /> oscila</span>}</div>
                      <div className="iv-sub">{subtitulo(inv)}</div>
                    </div>
                    <div>
                      <div className="iv-val">{v(r.bruto)}</div>
                      <div className={"iv-ganho" + (r.ganho < 0 ? " neg" : "")}>{oculto ? "••••" : fmtSinal(r.ganho)}{r.custo > 0 ? ` · ${fmtPct(r.ganho / r.custo)}` : ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );

  const cardMetas = !semNada && (
    <div className="iv-card vidro">
      <div className="iv-sec"><h2>Metas</h2><button className="iv-link" onClick={() => setForm({ tipo: "metas" })}>{metas.length ? "editar" : "+ nova meta"}</button></div>
      {metas.length === 0 ? (
        <p className="iv-ajuda">Ex.: "Reserva de emergência: R$ 5.000". Ligue um ou mais investimentos a cada meta e acompanhe a barrinha enchendo.</p>
      ) : metas.map(({ meta, valor, alvo, pct, qtd }) => (
        <button key={meta.id} className="iv-meta" onClick={() => setForm({ tipo: "metas" })}>
          <div className="iv-meta-top"><span>{meta.nome}</span><small>{Math.round(pct * 100)}%</small></div>
          <div className="iv-barra"><i style={{ width: `${pct * 100}%`, background: pct >= 1 ? "var(--o-moeda,#FFC94D)" : "var(--ac)" }} /></div>
          <div className="iv-sub" style={{ whiteSpace: "normal" }}>
            R$ {v(valor)} de R$ {v(alvo)}
            {pct >= 1 ? " · meta batida!" : alvo > valor && !oculto ? ` · faltam R$ ${fmt(alvo - valor)}` : ""}
            {qtd === 0 ? " · nenhum investimento ligado" : qtd > 1 ? ` · ${qtd} investimentos` : ""}
          </div>
        </button>
      ))}
    </div>
  );

  const rosca = !semNada && <Rosca grupos={carteira.grupos} total={carteira.itens.length} tamanho={larga ? 110 : 120} />;
  const grafico = !semNada && <Grafico pontos={pontos} oculto={oculto} larga={larga} />;
  const avisoTaxa = carteira.semTaxa && !mk.buscando && (
    <div className="iv-aviso-taxa"><Info size={18} />
      <span>Ainda não consegui as taxas {mk.falhou ? "(sem conexão)" : ""} de algum investimento. Por enquanto ele aparece com o valor que você guardou, sem rendimento.
        {mk.falhou && <button className="iv-link" onClick={mk.tentarDeNovo}> Tentar de novo</button>}</span>
    </div>
  );

  const detalhe = aberto && (
    <Detalhe
      x={aberto} doc={doc} mercado={mercado} metas={metas} v={v} oculto={oculto} larga={larga}
      onVoltar={() => setAbertoId(null)}
      onMov={(tipo, mov) => setForm({ tipo: "mov", invId: aberto.inv.id, movTipo: tipo, mov })}
      onEditar={() => setForm({ tipo: "editar", invId: aberto.inv.id })}
    />
  );

  const botoesTopo = (
    <div className="iv-topo-bts">
      {larga && <button className="mc-btn-rosa" onClick={() => setForm({ tipo: "novo" })}><Plus size={18} strokeWidth={2.8} /> Novo investimento</button>}
      <button className="mc-ib" title={oculto ? "Mostrar valores" : "Esconder valores"} aria-label="Esconder valores" onClick={() => setOculto((o) => !o)}>
        {oculto ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
      {!larga && <button className="mc-ib" title="Configurações" aria-label="Configurações" onClick={() => window.dispatchEvent(new Event("oink-config"))}><Settings size={19} /></button>}
    </div>
  );

  return (
    <div className={"mc-wrap iv" + (larga ? " mc-larga" : "")}>
      <MCStyles />
      <IVStyles />
      <header className="iv-topo">
        <h1 className="iv-titulo">Investimentos</h1>
        {botoesTopo}
      </header>

      {larga ? (
        <div className="iv-mac">
          <div className="iv-col" style={{ gap: 18 }}>
            <div className="iv-mac-topo">
              {hero}
              <div className="iv-card vidro" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {tres}
                {rosca}
              </div>
            </div>
            {avisoTaxa}
            {grafico && <div className="iv-card vidro">{grafico}</div>}
          </div>
          <div className="iv-lado">
            {detalhe ? <div className="iv-card vidro">{detalhe}</div> : (
              <>
                <div className="iv-card vidro" style={{ padding: "4px 18px" }}><div className="iv-lista-rola">{lista}</div></div>
                {cardMetas}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="iv-col">
          {hero}
          {!semNada && tres}
          {avisoTaxa}
          {grafico && <div className="iv-card">{grafico}</div>}
          <div className="iv-card" style={{ padding: "4px 16px" }}>{lista}</div>
          {cardMetas}
          {rosca && <div className="iv-card">{rosca}</div>}
        </div>
      )}

      {!larga && detalhe && (
        <div className="mc-tela" role="dialog" aria-label={aberto.inv.nome}>
          <div className="mc-tela-in iv-col" style={{ gap: 14 }}>{detalhe}</div>
        </div>
      )}

      {form?.tipo === "novo" && (
        <Modal onFechar={() => setForm(null)} largo>
          <FormNovo doc={doc} mercado={mercado} onFechar={() => setForm(null)}
            onSalvar={(inv, novaMeta) => { criarInv(inv, novaMeta); setForm(null); }} />
        </Modal>
      )}
      {form?.tipo === "mov" && (() => {
        const x = carteira.itens.find((i) => i.inv.id === form.invId);
        if (!x) return null;
        return (
          <Modal onFechar={() => setForm(null)}>
            <FormMov x={x} tipo={form.movTipo} mov={form.mov} mercado={mercado} onFechar={() => setForm(null)}
              onSalvar={(mov) => { salvarMov(x.inv.id, mov); setForm(null); }}
              onExcluir={(movId) => { excluirMov(x.inv.id, movId); setForm(null); }} />
          </Modal>
        );
      })()}
      {form?.tipo === "editar" && (() => {
        const inv = doc.investimentos.find((i) => i.id === form.invId);
        if (!inv) return null;
        return (
          <Modal onFechar={() => setForm(null)}>
            <FormEditar inv={inv} doc={doc} mercado={mercado} onFechar={() => setForm(null)}
              onSalvar={(novo, novaMeta) => {
                if (novaMeta) editar((d) => ({ ...d, metas: [...d.metas, novaMeta] }));
                mudarInv(inv.id, () => novo, `Você editou o investimento ${novo.nome}`);
                setForm(null);
                setToast("Investimento atualizado");
              }}
              onExcluir={() => { excluirInv(inv.id); setForm(null); }} />
          </Modal>
        );
      })()}
      {form?.tipo === "metas" && (
        <Modal onFechar={() => setForm(null)}>
          <FormMetas doc={doc} onFechar={() => setForm(null)} onSalvar={(m, l) => { salvarMetas(m, l); setForm(null); }} />
        </Modal>
      )}

      {nv.conflito && (
        <div className="mc-aviso mc-aviso-conf" role="alert">
          <span><b>Este aparelho estava com uma versão antiga</b> — os investimentos foram mudados em outro aparelho.
            Carreguei a versão mais nova. O que foi feito aqui ({nv.conflito.quando}) ficou guardado à parte, nada foi perdido.</span>
          <button onClick={nv.fecharConflito}>Entendi</button>
        </div>
      )}
      {nv.erroSalvar && <div className="mc-aviso mc-aviso-erro" role="alert"><span className="mc-ponto" /> Erro ao salvar · tentando de novo…</div>}
      {toast && <div className="mc-toast"><span>{toast}</span></div>}
    </div>
  );
}

function subtitulo(inv) {
  if (inv.tipo === "cdi") return [inv.banco, `${fmtNum(inv.pct || 100)}% do CDI`].filter(Boolean).join(" · ");
  if (inv.tipo === "selic") return `Selic${Number(inv.spread) ? ` + ${fmtNum(inv.spread)}%` : ""}${inv.venc ? ` · vence ${inv.venc.slice(0, 4)}` : ""}`;
  const [tipo, venc] = String(inv.titulo || "").split("|");
  // Renda+ e Educa+: o ano do nome é o 1º pagamento; o "vencimento" é o último
  const ano = venc ? +venc.slice(0, 4) : 0;
  const quando = !venc ? "" : tipo === "Renda+" ? `paga de ${ano - 19} a ${ano}` : tipo === "Educa+" ? `paga de ${ano - 4} a ${ano}` : `vence ${ano}`;
  return [inv.taxa ? `IPCA + ${fmtNum(inv.taxa)}%` : "Tesouro Direto", quando].filter(Boolean).join(" · ");
}
const fmtNum = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/* ---------------- gráfico e rosca ---------------- */

function Grafico({ pontos, oculto, larga }) {
  const [per, setPer] = useState("6");
  const dados = per === "tudo" ? pontos : pontos.slice(-Number(per));
  const vistos = dados.map((p) => ({ ...p, rendPos: Math.max(0, p.rendimento), guardadoVisto: p.rendimento < 0 ? p.total : p.guardado }));
  const eixo = (n) => (oculto ? "" : n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(Math.round(n)));
  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="iv-tip">
        <b>{p.mes} {p.ano}</b>
        <div><span>Guardado</span>{oculto ? "••••" : fmt(p.guardado)}</div>
        <div><span>Rendimento</span>{oculto ? "••••" : fmtSinal(p.rendimento)}</div>
        <div><span>Total</span>{oculto ? "••••" : fmt(p.total)}</div>
      </div>
    );
  };
  return (
    <>
      <div className="iv-sec">
        <h2>Evolução</h2>
        <div className="iv-per" role="group" aria-label="Período do gráfico">
          {[["6", "6 meses"], ["12", "12 meses"], ["tudo", "Tudo"]].map(([k, t]) => (
            <button key={k} className={per === k ? "on" : ""} aria-pressed={per === k} onClick={() => setPer(k)}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", height: larga ? 230 : 180 }}>
        <ResponsiveContainer>
          <BarChart data={vistos} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: "var(--faint)", fontSize: 11, fontWeight: 800, fontFamily: "Nunito" }} />
            <YAxis tickFormatter={eixo} tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--faint)", fontSize: 11, fontWeight: 800, fontFamily: "Nunito" }} />
            <Tooltip content={<Tip />} cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }} />
            <Bar dataKey="guardadoVisto" stackId="a" fill="#1E8A5E" radius={[0, 0, 6, 6]} isAnimationActive={false} />
            <Bar dataKey="rendPos" stackId="a" fill="#5FE3A1" radius={[6, 6, 0, 0]} minPointSize={0} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="iv-leg"><span><i style={{ background: "#1E8A5E" }} />Guardado</span><span><i style={{ background: "#5FE3A1" }} />Rendimento</span></div>
    </>
  );
}

function Rosca({ grupos, total, tamanho }) {
  const C = 2 * Math.PI * 40;
  let ini = 0;
  const arcos = grupos.map((g) => {
    const tam = g.pct * C;
    const a = { tipo: g.tipo, dash: Math.max(0, tam - (grupos.length > 1 ? 2 : 0)), off: -ini };
    ini += tam;
    return a;
  });
  return (
    <>
      <div className="iv-sec"><h2>Onde está o dinheiro</h2></div>
      <div className="iv-donut">
        <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} style={{ flexShrink: 0 }} role="img" aria-label="Divisão da carteira por tipo">
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--sf2)" strokeWidth="14" />
          <g transform="rotate(-90 50 50)">
            {arcos.map((a) => (
              <circle key={a.tipo} cx="50" cy="50" r="40" fill="none" stroke={TIPOS[a.tipo].cor} strokeWidth="14" strokeDasharray={`${a.dash} ${C}`} strokeDashoffset={a.off} />
            ))}
          </g>
          <text x="50" y="48" textAnchor="middle" fontFamily="Nunito" fontWeight="900" fontSize="14" fill="var(--ink)">{total}</text>
          <text x="50" y="61" textAnchor="middle" fontFamily="Nunito" fontWeight="800" fontSize="8" fill="var(--faint)">{total === 1 ? "investimento" : "investimentos"}</text>
        </svg>
        <div className="iv-dleg">
          {grupos.map((g) => (
            <div key={g.tipo}><i style={{ background: TIPOS[g.tipo].cor }} /><span>{TIPOS[g.tipo].nome}</span><b>{Math.round(g.pct * 100)}%</b></div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------- dentro de um investimento ---------------- */

function Detalhe({ x, doc, mercado, metas, v, oculto, larga, onVoltar, onMov, onEditar }) {
  const { inv, r } = x;
  const [inteiro, centavos] = fmt(r.bruto).split(",");
  const meta = metas.find((m) => m.meta.id === inv.metaId);
  const eventos = [...r.eventos].reverse();
  const ultimo = r.eventos.length ? r.eventos[0].mov.data : null;
  const dias = r.diasMaisVelho;
  const preco = inv.tipo === "ipca" ? mercado.tesouro?.titulos?.[inv.titulo] : null;
  const porDia = r.porDia;
  // no Tesouro IPCA+ a quantidade pode ter sido estimada
  return (
    <div className="iv-det">
      <button className="iv-voltar" onClick={onVoltar}><ChevronLeft size={18} /> {larga ? "Meus investimentos" : "Investimentos"}</button>
      <div className="iv-det-cab">
        <IcTipo tipo={inv.tipo} size={larga ? 44 : 52} />
        <div style={{ minWidth: 0 }}>
          <h1>{inv.nome}</h1>
          <div className="iv-sub" style={{ whiteSpace: "normal" }}>{subtitulo(inv)}</div>
        </div>
      </div>
      <div className="mc-hero-card iv-hero vidro" style={{ padding: larga ? 16 : 20 }}>
        <div className="mc-hero-rot">Valor hoje</div>
        <div className="mc-hero-num" style={{ fontSize: larga ? 34 : 40 }}>{oculto ? "R$ ••••" : <><small>R$ </small>{inteiro}<small>,{centavos}</small></>}</div>
        <div className="iv-liq"><span>Sem IR {r.ganho > 0 && ultimo ? `(${faixaIR(dias)})` : ""}{r.iof > 0.004 ? " e IOF" : ""}</span><b>R$ {v(r.liquido)}</b></div>
        {porDia > 0.004 && <div className="iv-vivo"><i />Rendendo ≈ R$ {v(porDia)} por dia útil</div>}
        {preco && <div className="iv-vivo"><i />Preço do Tesouro em {brData(mercado.tesouro.data)}: R$ {fmt(preco.pu)} por título</div>}
      </div>
      <div className="iv-tres">
        <div><span>Guardei</span><b>{v(r.custo)}</b></div>
        <div><span>Rendeu</span><b className={r.ganho < 0 ? "iv-neg" : "iv-pos"}>{oculto ? "••••" : fmtSinal(r.ganho)}</b></div>
        <div><span>Imposto</span><b>{r.ir + r.iof > 0.004 ? "−" + v(r.ir + r.iof) : "0,00"}</b></div>
      </div>
      {inv.tipo === "ipca" && (
        <p className="iv-ajuda">
          {fmtQtd(r.qtd)} {r.qtd === 1 ? "título" : "títulos"}{r.qtdEstimada ? " (quantidade estimada pelo preço do mês da compra — coloque a quantidade certa no registro pra ficar exato)" : ""}.
          O preço do IPCA+ e do Renda+ muda todo dia; antes do vencimento pode ficar abaixo do que você pagou.
        </p>
      )}
      {meta && (
        <div className="iv-card" style={{ background: "var(--sf2)", border: "none" }}>
          <div className="iv-sec" style={{ marginBottom: 8 }}><h2 style={{ fontSize: 15 }}><Target size={15} style={{ verticalAlign: -2 }} /> {meta.meta.nome}</h2><span>{Math.round(meta.pct * 100)}%</span></div>
          <div className="iv-barra"><i style={{ width: `${meta.pct * 100}%`, background: TIPOS[inv.tipo].cor }} /></div>
          <div className="iv-sub" style={{ marginTop: 8, whiteSpace: "normal" }}>
            {meta.pct >= 1 ? "Meta batida!" : oculto ? `Meta de R$ ••••` : `Faltam R$ ${fmt(meta.alvo - meta.valor)} para R$ ${fmt(meta.alvo)}`}
          </div>
        </div>
      )}
      <div className="iv-2bts">
        <button className="mc-btn-rosa" onClick={() => onMov("aporte")}><Plus size={18} strokeWidth={2.8} /> Guardar mais</button>
        <button className="mc-btn-s" onClick={() => onMov("resgate")}><Minus size={18} /> Resgatar</button>
      </div>
      <div className={larga ? "" : "iv-card"} style={larga ? {} : { padding: "8px 16px" }}>
        <div className="iv-sec" style={{ margin: larga ? "4px 0 0" : "8px 0 0" }}><h2>Extrato</h2><span>toque pra corrigir</span></div>
        {eventos.map(({ mov, irPago, diferenca }) => (
          <button key={mov.id} className="iv-ext" onClick={() => onMov(mov.tipo, mov)}>
            <span className={"iv-seta " + (mov.tipo === "aporte" ? "mais" : mov.tipo === "resgate" ? "menos" : "ajuste")}>
              {mov.tipo === "aporte" ? <Plus size={16} /> : mov.tipo === "resgate" ? <Minus size={16} /> : <Scale size={16} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="iv-nome" style={{ fontSize: 15 }}>{mov.tipo === "aporte" ? "Guardei" : mov.tipo === "resgate" ? "Resgatei" : "Ajustei com o banco"}</div>
              <div className="iv-sub">
                {dataLonga(mov.data)}
                {mov === r.eventos[0]?.mov ? " · primeiro" : ""}
                {irPago > 0.004 && !oculto ? ` · IR ≈ R$ ${fmt(irPago)}` : ""}
                {mov.tipo === "ajuste" && diferenca != null && !oculto ? ` · ${fmtSinal(diferenca)}` : ""}
                {Number(mov.qtd) > 0 ? ` · ${fmtQtd(mov.qtd)} títulos` : ""}
              </div>
            </div>
            <div className="iv-val">{mov.tipo === "ajuste" ? v(mov.saldo) : (mov.tipo === "aporte" ? "+" : "−") + v(mov.valor)}</div>
          </button>
        ))}
      </div>
      <div className="iv-acoes-fim">
        {inv.tipo !== "ipca" && <button onClick={() => onMov("ajuste")}><Scale size={15} /> Ajustar com o banco</button>}
        <button onClick={onEditar}><Pencil size={15} /> Editar</button>
      </div>
    </div>
  );
}

/* ---------------- janelas ---------------- */

function Modal({ children, onFechar, largo }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  return (
    <div className="mc-modal-fundo" onClick={onFechar}>
      <div className="mc-modal iv-modal" style={largo ? { maxWidth: 520 } : undefined} onClick={(e) => e.stopPropagation()} role="dialog">
        {children}
      </div>
    </div>
  );
}

function Topo({ titulo, sub, onFechar }) {
  return (
    <div className="mc-form-topo">
      <div>
        {sub && <div className="mc-form-tipo mc-fraco">{sub}</div>}
        <div className="mc-form-tit" style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900 }}>{titulo}</div>
      </div>
      <button className="mc-ib mc-ib-plano" aria-label="Fechar" onClick={onFechar}><X size={18} /></button>
    </div>
  );
}

function Campo({ rot, id, children }) {
  return <div className="mc-campo"><label className="mc-rot" htmlFor={id}>{rot}</label>{children}</div>;
}

// escolher (ou criar) a meta de um investimento
function EscolherMeta({ doc, f, set }) {
  return (
    <>
      <Campo rot="Meta (opcional)" id="iv-meta">
        <select id="iv-meta" className="mc-inp iv-sel" value={f.metaId} onChange={(e) => set("metaId", e.target.value)}>
          <option value="">Sem meta</option>
          {doc.metas.map((m) => <option key={m.id} value={m.id}>{m.nome} · R$ {fmt(m.alvo)}</option>)}
          <option value="nova">+ Nova meta…</option>
        </select>
      </Campo>
      {f.metaId === "nova" && (
        <div className="mc-2col">
          <Campo rot="Nome da meta" id="iv-mnome"><input id="iv-mnome" className="mc-inp" value={f.metaNome} placeholder="Reserva de emergência" onChange={(e) => set("metaNome", e.target.value)} /></Campo>
          <Campo rot="Quanto quer juntar" id="iv-malvo"><input id="iv-malvo" className="mc-inp" inputMode="decimal" value={f.metaAlvo} placeholder="5.000,00" onChange={(e) => set("metaAlvo", e.target.value)} /></Campo>
        </div>
      )}
    </>
  );
}

function resolverMeta(f) {
  if (f.metaId !== "nova") return { metaId: f.metaId || null, novaMeta: null, erro: "" };
  const alvo = lerNumero(f.metaAlvo);
  if (!f.metaNome.trim()) return { erro: "Dê um nome pra meta." };
  if (!(alvo > 0)) return { erro: "Coloque quanto quer juntar na meta." };
  const novaMeta = { id: uid(), nome: f.metaNome.trim(), alvo };
  return { metaId: novaMeta.id, novaMeta, erro: "" };
}

function titulosTesouro(mercado, tipos) {
  const tt = mercado.tesouro?.titulos || {};
  return Object.entries(tt)
    .filter(([, x]) => tipos.includes(x.tipo))
    .sort((a, b) => (a[1].tipo === b[1].tipo ? (a[1].venc < b[1].venc ? -1 : 1) : a[1].tipo < b[1].tipo ? -1 : 1));
}

/* ---------------- novo investimento ---------------- */

function FormNovo({ doc, mercado, onFechar, onSalvar }) {
  const hoje = hojeISO();
  const [f, setF] = useState({
    tipo: "cdi", jaTenho: false, modo: "datas", nome: "", banco: "", pct: "100", spread: "0", titulo: "", tituloSelic: "",
    valor: "", data: hoje, qtd: "", linhas: [{ id: uid(), sinal: "+", data: hoje, valor: "" }], saldo: "", total: "", desde: "",
    metaId: "", metaNome: "", metaAlvo: "",
  });
  const [erro, setErro] = useState("");
  const set = (k, val) => setF((o) => ({ ...o, [k]: val }));
  const setLinha = (id, k, val) => setF((o) => ({ ...o, linhas: o.linhas.map((l) => (l.id === id ? { ...l, [k]: val } : l)) }));

  const ipcaTits = titulosTesouro(mercado, ["IPCA+", "Renda+", "Educa+", "IPCA+ Juros Semestrais"]);
  const selicTits = titulosTesouro(mercado, ["Selic"]);
  const tituloIpca = mercado.tesouro?.titulos?.[f.titulo];
  const porTaxa = f.tipo !== "ipca";

  // monta as entradas do jeito escolhido
  const montarMovs = () => {
    const agora = Date.now();
    if (f.tipo === "ipca") {
      const valor = lerNumero(f.valor);
      const qtd = lerNumero(f.qtd);
      if (!f.titulo) return { erro: "Escolha qual título do Tesouro." };
      if (!(valor > 0)) return { erro: "Coloque quanto você pagou." };
      return { movs: [{ id: uid(), tipo: "aporte", data: f.data, valor, ...(qtd > 0 ? { qtd } : {}), criado: agora }] };
    }
    if (!f.jaTenho) {
      const valor = lerNumero(f.valor);
      if (!(valor > 0)) return { erro: "Coloque quanto você guardou." };
      return { movs: [{ id: uid(), tipo: "aporte", data: f.data, valor, criado: agora }] };
    }
    if (f.modo === "datas") {
      const movs = [];
      for (const [k, l] of f.linhas.entries()) {
        const valor = lerNumero(l.valor);
        if (!(valor > 0)) return { erro: `Coloque o valor da linha ${k + 1}.` };
        movs.push({ id: uid(), tipo: l.sinal === "+" ? "aporte" : "resgate", data: l.data, valor, criado: agora + k });
      }
      if (!movs.some((m) => m.tipo === "aporte")) return { erro: "Precisa ter pelo menos uma vez que você guardou." };
      return { movs };
    }
    const saldo = lerNumero(f.saldo), total = lerNumero(f.total);
    if (!(saldo > 0)) return { erro: "Coloque o saldo que o banco mostra hoje." };
    if (!(total > 0)) return { erro: "Coloque quanto você colocou no total." };
    if (!f.desde) return { erro: "Escolha desde quando o dinheiro está aplicado (pode ser aproximado)." };
    if (f.desde > hoje) return { erro: "A data de início não pode ser no futuro." };
    return {
      movs: [
        { id: uid(), tipo: "aporte", data: f.desde, valor: total, criado: agora },
        { id: uid(), tipo: "ajuste", data: hoje, saldo, criado: agora + 1 },
      ],
    };
  };

  const montarInv = (movs) => {
    const base = { id: uid(), tipo: f.tipo, criado: Date.now(), movs };
    if (f.tipo === "cdi") return { ...base, nome: f.nome.trim() || `${f.banco.trim() || "Caixinha"}`, banco: f.banco.trim(), pct: lerNumero(f.pct) || 100 };
    if (f.tipo === "selic") {
      const t = mercado.tesouro?.titulos?.[f.tituloSelic];
      return { ...base, nome: f.nome.trim() || (t ? t.nome : "Tesouro Selic"), banco: "Tesouro Direto", spread: lerNumero(f.spread) || 0, ...(t ? { venc: t.venc } : {}) };
    }
    return { ...base, nome: f.nome.trim() || tituloIpca?.nome || "Tesouro IPCA+", banco: "Tesouro Direto", titulo: f.titulo, ...(tituloIpca?.taxa ? { taxa: tituloIpca.taxa } : {}) };
  };

  // prévia: quanto isso vale hoje, pelas contas do app
  const previa = useMemo(() => {
    const m = montarMovs();
    if (m.erro) return null;
    const r = simular(montarInv(m.movs), mercado);
    return r.semTaxa ? null : r;
  }, [f, mercado]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = () => {
    const m = montarMovs();
    if (m.erro) return setErro(m.erro);
    const mt = resolverMeta(f);
    if (mt.erro) return setErro(mt.erro);
    setErro("");
    onSalvar({ ...montarInv(m.movs), metaId: mt.metaId }, mt.novaMeta);
  };

  return (
    <div className="mc-form">
      <Topo titulo="Novo investimento" onFechar={onFechar} />
      <div className="mc-campo">
        <span className="mc-rot">Tipo</span>
        <div className="iv-tipos">
          {["cdi", "selic", "ipca"].map((t) => (
            <button key={t} className={"iv-tipo" + (f.tipo === t ? " on" : "")} aria-pressed={f.tipo === t} onClick={() => set("tipo", t)}>
              <IcTipo tipo={t} size={30} />{TIPOS[t].curto}
            </button>
          ))}
        </div>
      </div>

      {porTaxa && (
        <label className="mc-chave" style={{ padding: "8px 12px", margin: "0 -12px", borderRadius: 14, background: f.jaTenho ? "color-mix(in srgb, var(--ac) 10%, transparent)" : "transparent" }}>
          <span>Já tenho esse investimento<small>Ligue se o dinheiro já está aplicado há um tempo</small></span>
          <input type="checkbox" checked={f.jaTenho} onChange={(e) => set("jaTenho", e.target.checked)} />
          <span className="mc-chave-trilho"><span /></span>
        </label>
      )}

      {f.tipo === "cdi" && (
        <>
          <Campo rot="Nome" id="iv-nome"><input id="iv-nome" className="mc-inp" value={f.nome} placeholder="Reserva de emergência" onChange={(e) => set("nome", e.target.value)} /></Campo>
          <div className="mc-2col">
            <Campo rot="Banco" id="iv-banco"><input id="iv-banco" className="mc-inp" value={f.banco} placeholder="Nubank" onChange={(e) => set("banco", e.target.value)} /></Campo>
            <Campo rot="Rende (% do CDI)" id="iv-pct"><input id="iv-pct" className="mc-inp" inputMode="decimal" value={f.pct} onChange={(e) => set("pct", e.target.value)} /></Campo>
          </div>
          <p className="iv-ajuda">Olhe no app do banco quanto ele rende: "100% do CDI", "110% do CDI"… A caixinha e o RDB do Nubank rendem 100%.</p>
        </>
      )}
      {f.tipo === "selic" && (
        <>
          <Campo rot="Qual título" id="iv-tsel">
            <select id="iv-tsel" className="mc-inp iv-sel" value={f.tituloSelic} onChange={(e) => set("tituloSelic", e.target.value)}>
              <option value="">Tesouro Selic (qualquer vencimento)</option>
              {selicTits.map(([k, x]) => <option key={k} value={k}>{x.nome}</option>)}
            </select>
          </Campo>
          <div className="mc-2col">
            <Campo rot="Nome (opcional)" id="iv-nome"><input id="iv-nome" className="mc-inp" value={f.nome} placeholder="Viagem" onChange={(e) => set("nome", e.target.value)} /></Campo>
            <Campo rot="Selic + (% ao ano)" id="iv-spread"><input id="iv-spread" className="mc-inp" inputMode="decimal" value={f.spread} onChange={(e) => set("spread", e.target.value)} /></Campo>
          </div>
          <p className="iv-ajuda">A taxa extra aparece na compra (ex.: "Selic + 0,05%"). Se não souber, deixe 0.</p>
        </>
      )}
      {f.tipo === "ipca" && (
        <>
          <Campo rot="Qual título" id="iv-tipca">
            <select id="iv-tipca" className="mc-inp iv-sel" value={f.titulo} onChange={(e) => set("titulo", e.target.value)}>
              <option value="">{ipcaTits.length ? "Escolha…" : "Carregando a lista do Tesouro…"}</option>
              {ipcaTits.map(([k, x]) => <option key={k} value={k}>{x.nome} · hoje IPCA + {fmtNum(x.taxa)}%</option>)}
            </select>
          </Campo>
          <Campo rot="Nome (opcional)" id="iv-nome"><input id="iv-nome" className="mc-inp" value={f.nome} placeholder={tituloIpca?.nome || "Aposentadoria"} onChange={(e) => set("nome", e.target.value)} /></Campo>
          <div className="mc-2col">
            <Campo rot="Quanto paguei" id="iv-valor"><input id="iv-valor" className="mc-inp mc-inp-valor" inputMode="decimal" value={f.valor} placeholder="0,00" onChange={(e) => set("valor", e.target.value)} /></Campo>
            <div className="mc-campo"><span className="mc-rot">Data da compra</span><CampoData value={f.data} onChange={(d) => set("data", d)} /></div>
          </div>
          <Campo rot="Quantidade de títulos (se souber)" id="iv-qtd"><input id="iv-qtd" className="mc-inp" inputMode="decimal" value={f.qtd} placeholder="ex.: 0,35" onChange={(e) => set("qtd", e.target.value)} /></Campo>
          <p className="iv-ajuda">A quantidade aparece no app da corretora e deixa o valor exato. Sem ela, o Oink estima pelo preço do mês da compra.</p>
        </>
      )}

      {porTaxa && !f.jaTenho && (
        <div className="mc-2col">
          <Campo rot="Quanto guardei" id="iv-valor"><input id="iv-valor" className="mc-inp mc-inp-valor" inputMode="decimal" value={f.valor} placeholder="0,00" onChange={(e) => set("valor", e.target.value)} /></Campo>
          <div className="mc-campo"><span className="mc-rot">Data</span><CampoData value={f.data} onChange={(d) => set("data", d)} /></div>
        </div>
      )}

      {porTaxa && f.jaTenho && (
        <>
          <div className="mc-campo">
            <span className="mc-rot">Como você quer cadastrar?</span>
            <div className="iv-modo">
              <button className={f.modo === "datas" ? "on" : ""} aria-pressed={f.modo === "datas"} onClick={() => set("modo", "datas")}>Com as datas<small>Exato. Pego no extrato do banco</small></button>
              <button className={f.modo === "saldo" ? "on" : ""} aria-pressed={f.modo === "saldo"} onClick={() => set("modo", "saldo")}>Só o saldo de hoje<small>Rápido. O imposto fica aproximado</small></button>
            </div>
          </div>
          {f.modo === "datas" ? (
            <div className="mc-campo">
              <span className="mc-rot">Cada vez que guardou (+) ou tirou (−)</span>
              {f.linhas.map((l, k) => (
                <div key={l.id} className="iv-linha-mov">
                  <button className={"iv-sinal " + (l.sinal === "+" ? "mais" : "menos")} aria-label={l.sinal === "+" ? "Guardei (toque pra trocar)" : "Tirei (toque pra trocar)"}
                    onClick={() => setLinha(l.id, "sinal", l.sinal === "+" ? "−" : "+")}>{l.sinal}</button>
                  <CampoData value={l.data} onChange={(d) => setLinha(l.id, "data", d)} rotulo={`Data da linha ${k + 1}`} />
                  <input className="mc-inp" inputMode="decimal" aria-label={`Valor da linha ${k + 1}`} value={l.valor} placeholder="0,00" onChange={(e) => setLinha(l.id, "valor", e.target.value)} />
                  <button className="iv-tirar" aria-label="Tirar esta linha" disabled={f.linhas.length === 1}
                    onClick={() => set("linhas", f.linhas.filter((x) => x.id !== l.id))}><X size={16} /></button>
                </div>
              ))}
              <button className="mc-btn-s" style={{ height: 46 }} onClick={() => set("linhas", [...f.linhas, { id: uid(), sinal: "+", data: hoje, valor: "" }])}><Plus size={17} /> Outra data</button>
            </div>
          ) : (
            <>
              <div className="mc-2col">
                <Campo rot="Saldo hoje no banco" id="iv-saldo"><input id="iv-saldo" className="mc-inp mc-inp-valor" inputMode="decimal" value={f.saldo} placeholder="0,00" onChange={(e) => set("saldo", e.target.value)} /></Campo>
                <Campo rot="Quanto coloquei" id="iv-total"><input id="iv-total" className="mc-inp mc-inp-valor" inputMode="decimal" value={f.total} placeholder="0,00" onChange={(e) => set("total", e.target.value)} /></Campo>
              </div>
              <div className="mc-campo"><span className="mc-rot">Desde quando, mais ou menos</span><CampoData value={f.desde} onChange={(d) => set("desde", d)} rotulo="Desde quando" /></div>
              <p className="iv-ajuda">O Oink começa do saldo que você informou e calcula daqui pra frente. A data ajuda a estimar o imposto (22,5% até 6 meses, 20% até 1 ano…).</p>
            </>
          )}
        </>
      )}

      {previa && (f.jaTenho || f.tipo === "ipca" || f.data < hoje) && (
        <div className="iv-calc">
          <span>O Oink calculou<small>{f.tipo === "ipca" ? "pelo preço oficial de hoje" : "confira com o banco"}</small></span>
          <b>R$ {fmt(previa.bruto)}</b>
        </div>
      )}

      <EscolherMeta doc={doc} f={f} set={set} />
      {erro && <div className="mc-erro">{erro}</div>}
      <button className="mc-btn-rosa" style={{ height: 54, justifyContent: "center", borderRadius: 18 }} onClick={salvar}><Check size={18} strokeWidth={2.8} /> Guardar investimento</button>
    </div>
  );
}

/* ---------------- guardar mais / resgatar / ajustar / corrigir ---------------- */

function FormMov({ x, tipo, mov, mercado, onFechar, onSalvar, onExcluir }) {
  const { inv, r } = x;
  const hoje = hojeISO();
  const [f, setF] = useState(() => ({
    valor: mov ? fmt(tipo === "ajuste" ? mov.saldo : mov.valor) : "",
    data: mov ? mov.data : hoje,
    qtd: mov?.qtd ? fmtQtd(mov.qtd) : "",
  }));
  const [erro, setErro] = useState("");
  const [armado, setArmado] = useState(false);
  const set = (k, val) => setF((o) => ({ ...o, [k]: val }));
  const titulo = { aporte: mov ? "Corrigir: guardei" : "Guardar mais", resgate: mov ? "Corrigir: resgatei" : "Resgatar", ajuste: mov ? "Corrigir ajuste" : "Ajustar com o banco" }[tipo];

  const salvar = () => {
    const valor = lerNumero(f.valor);
    const qtd = lerNumero(f.qtd);
    if (!(valor > 0)) return setErro("Coloque um valor maior que zero.");
    if (f.data > hoje) return setErro("A data não pode ser no futuro.");
    if (tipo === "resgate" && !mov) {
      const naData = simular(inv, mercado, f.data).bruto;
      if (valor > naData + 0.05) return setErro(`Nessa data o investimento valia R$ ${fmt(naData)}. Confira o valor.`);
    }
    const base = mov ? { ...mov } : { id: uid(), tipo, criado: Date.now() };
    const novo = tipo === "ajuste" ? { ...base, data: f.data, saldo: valor } : { ...base, data: f.data, valor };
    if (inv.tipo === "ipca") { if (qtd > 0) novo.qtd = qtd; else delete novo.qtd; }
    onSalvar(novo);
  };

  return (
    <div className="mc-form">
      <Topo titulo={titulo} sub={inv.nome} onFechar={onFechar} />
      {tipo === "ajuste" && (
        <p className="iv-ajuda">Abra o app do banco e coloque o saldo que aparece lá. O Oink passa a calcular a partir desse valor (o que você guardou não muda).
          Hoje o Oink calcula R$ {fmt(r.bruto)}.</p>
      )}
      <div className="mc-2col">
        <Campo rot={tipo === "ajuste" ? "Saldo no banco" : tipo === "resgate" ? "Quanto tirei" : "Quanto guardei"} id="iv-mvalor">
          <input id="iv-mvalor" className="mc-inp mc-inp-valor" inputMode="decimal" autoFocus value={f.valor} placeholder="0,00" onChange={(e) => set("valor", e.target.value)} />
        </Campo>
        <div className="mc-campo"><span className="mc-rot">Data</span><CampoData value={f.data} onChange={(d) => set("data", d)} /></div>
      </div>
      {inv.tipo === "ipca" && tipo !== "ajuste" && (
        <Campo rot="Quantidade de títulos (se souber)" id="iv-mqtd"><input id="iv-mqtd" className="mc-inp" inputMode="decimal" value={f.qtd} placeholder="ex.: 0,12" onChange={(e) => set("qtd", e.target.value)} /></Campo>
      )}
      {tipo === "resgate" && !mov && (
        <p className="iv-ajuda">Hoje vale R$ {fmt(r.bruto)} (R$ {fmt(r.liquido)} já sem imposto). O resgate sai do dinheiro mais antigo primeiro, igual ao banco.</p>
      )}
      {erro && <div className="mc-erro">{erro}</div>}
      <div className="mc-form-bts">
        {mov && (
          <button className={armado ? "mc-btn-verm" : "mc-btn-s"} onClick={() => (armado ? onExcluir(mov.id) : setArmado(true))}>
            <Trash2 size={17} /> {armado ? "Toque de novo pra apagar" : "Apagar"}
          </button>
        )}
        <button className="mc-btn-p" onClick={salvar}><Check size={18} /> {mov ? "Salvar" : tipo === "resgate" ? "Registrar resgate" : tipo === "ajuste" ? "Ajustar" : "Guardar"}</button>
      </div>
    </div>
  );
}

/* ---------------- editar investimento ---------------- */

function FormEditar({ inv, doc, mercado, onFechar, onSalvar, onExcluir }) {
  const [f, setF] = useState({
    nome: inv.nome || "", banco: inv.banco || "", pct: fmtNum(inv.pct ?? 100), spread: fmtNum(inv.spread ?? 0),
    titulo: inv.titulo || "", metaId: inv.metaId || "", metaNome: "", metaAlvo: "",
  });
  const [erro, setErro] = useState("");
  const [armado, setArmado] = useState(0);
  const set = (k, val) => setF((o) => ({ ...o, [k]: val }));
  const ipcaTits = titulosTesouro(mercado, ["IPCA+", "Renda+", "Educa+", "IPCA+ Juros Semestrais"]);

  const salvar = () => {
    if (!f.nome.trim()) return setErro("Dê um nome pro investimento.");
    const mt = resolverMeta(f);
    if (mt.erro) return setErro(mt.erro);
    const novo = { ...inv, nome: f.nome.trim(), metaId: mt.metaId };
    if (inv.tipo === "cdi") { novo.banco = f.banco.trim(); novo.pct = lerNumero(f.pct) || 100; }
    if (inv.tipo === "selic") novo.spread = lerNumero(f.spread) || 0;
    if (inv.tipo === "ipca" && f.titulo) {
      novo.titulo = f.titulo;
      const t = mercado.tesouro?.titulos?.[f.titulo];
      if (t?.taxa && f.titulo !== inv.titulo) novo.taxa = t.taxa;
    }
    onSalvar(novo, mt.novaMeta);
  };
  const excluir = () => {
    if (armado < 1) { setArmado(1); return; }
    onExcluir();
  };

  return (
    <div className="mc-form">
      <Topo titulo="Editar investimento" sub={TIPOS[inv.tipo].nome} onFechar={onFechar} />
      <Campo rot="Nome" id="iv-enome"><input id="iv-enome" className="mc-inp" value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
      {inv.tipo === "cdi" && (
        <div className="mc-2col">
          <Campo rot="Banco" id="iv-ebanco"><input id="iv-ebanco" className="mc-inp" value={f.banco} onChange={(e) => set("banco", e.target.value)} /></Campo>
          <Campo rot="Rende (% do CDI)" id="iv-epct"><input id="iv-epct" className="mc-inp" inputMode="decimal" value={f.pct} onChange={(e) => set("pct", e.target.value)} /></Campo>
        </div>
      )}
      {inv.tipo === "selic" && (
        <Campo rot="Selic + (% ao ano)" id="iv-espread"><input id="iv-espread" className="mc-inp" inputMode="decimal" value={f.spread} onChange={(e) => set("spread", e.target.value)} /></Campo>
      )}
      {inv.tipo === "ipca" && (
        <Campo rot="Qual título" id="iv-etit">
          <select id="iv-etit" className="mc-inp iv-sel" value={f.titulo} onChange={(e) => set("titulo", e.target.value)}>
            {!ipcaTits.some(([k]) => k === f.titulo) && <option value={f.titulo}>{f.titulo.replace("|", " ")}</option>}
            {ipcaTits.map(([k, x]) => <option key={k} value={k}>{x.nome}</option>)}
          </select>
        </Campo>
      )}
      <EscolherMeta doc={doc} f={f} set={set} />
      {erro && <div className="mc-erro">{erro}</div>}
      <div className="mc-form-bts">
        <button className={armado ? "mc-btn-verm" : "mc-btn-s"} onClick={excluir}><Trash2 size={17} /> {armado ? "Toque de novo pra apagar" : "Apagar"}</button>
        <button className="mc-btn-p" onClick={salvar}><Check size={18} /> Salvar</button>
      </div>
      {armado > 0 && <p className="iv-ajuda" style={{ textAlign: "center" }}>Apaga o investimento e o extrato dele. Uma cópia fica no registro de atividades.</p>}
    </div>
  );
}

/* ---------------- metas ---------------- */

function FormMetas({ doc, onFechar, onSalvar }) {
  const ativos = doc.investimentos.filter((i) => !i.arquivado);
  const [metas, setMetas] = useState(() => doc.metas.map((m) => ({ ...m, alvoTxt: fmt(m.alvo) })));
  const [lig, setLig] = useState(() => Object.fromEntries(ativos.map((i) => [i.id, i.metaId || ""])));
  const [editando, setEditando] = useState(null); // id da meta aberta
  const [erro, setErro] = useState("");

  const nova = () => {
    const m = { id: uid(), nome: "", alvoTxt: "" };
    setMetas((ms) => [...ms, m]);
    setEditando(m.id);
  };
  const setMeta = (id, k, val) => setMetas((ms) => ms.map((m) => (m.id === id ? { ...m, [k]: val } : m)));
  const tirar = (id) => {
    setMetas((ms) => ms.filter((m) => m.id !== id));
    setLig((l) => Object.fromEntries(Object.entries(l).map(([k, x]) => [k, x === id ? "" : x])));
    setEditando(null);
  };
  const salvar = () => {
    const prontas = [];
    for (const m of metas) {
      const alvo = lerNumero(m.alvoTxt);
      if (!m.nome.trim()) return setErro("Toda meta precisa de um nome.");
      if (!(alvo > 0)) return setErro(`Coloque quanto quer juntar em "${m.nome}".`);
      const { alvoTxt, ...resto } = m;
      prontas.push({ ...resto, nome: m.nome.trim(), alvo });
    }
    onSalvar(prontas, lig);
  };

  return (
    <div className="mc-form">
      <Topo titulo="Metas" onFechar={onFechar} />
      {metas.length === 0 && <p className="iv-ajuda">Nenhuma meta ainda. Crie uma e escolha quais investimentos contam pra ela.</p>}
      {metas.map((m) => (
        <div key={m.id} className="iv-card" style={{ background: "var(--sf2)", border: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {editando === m.id || !m.nome ? (
            <>
              <div className="mc-2col">
                <Campo rot="Nome" id={"mn" + m.id}><input id={"mn" + m.id} className="mc-inp" value={m.nome} placeholder="Reserva de emergência" onChange={(e) => setMeta(m.id, "nome", e.target.value)} /></Campo>
                <Campo rot="Quanto quer juntar" id={"ma" + m.id}><input id={"ma" + m.id} className="mc-inp" inputMode="decimal" value={m.alvoTxt} placeholder="5.000,00" onChange={(e) => setMeta(m.id, "alvoTxt", e.target.value)} /></Campo>
              </div>
              <span className="mc-rot">Investimentos que contam pra esta meta</span>
              <div>
                {ativos.map((i) => (
                  <button key={i.id} className={"iv-marcar" + (lig[i.id] === m.id ? " on" : "")} aria-pressed={lig[i.id] === m.id}
                    onClick={() => setLig((l) => ({ ...l, [i.id]: l[i.id] === m.id ? "" : m.id }))}>
                    <IcTipo tipo={i.tipo} size={30} /> {i.nome}
                    <span className="mc-cat-marca">{lig[i.id] === m.id && <Check size={15} strokeWidth={3} />}</span>
                  </button>
                ))}
              </div>
              <div className="mc-form-bts">
                <button className="mc-btn-fraco mc-btn-peq mc-perigo" onClick={() => tirar(m.id)}><Trash2 size={15} /> Tirar meta</button>
                <button className="mc-btn-s mc-btn-peq" onClick={() => setEditando(null)}>Pronto</button>
              </div>
            </>
          ) : (
            <button className="iv-marcar" style={{ borderBottom: "none", padding: 0 }} onClick={() => setEditando(m.id)}>
              <Target size={18} /> <span style={{ flex: 1 }}>{m.nome}<span className="iv-sub" style={{ display: "block" }}>R$ {m.alvoTxt} · {ativos.filter((i) => lig[i.id] === m.id).length} investimento(s)</span></span>
              <Pencil size={16} />
            </button>
          )}
        </div>
      ))}
      <button className="mc-btn-s" style={{ height: 46 }} onClick={nova}><Plus size={17} /> Nova meta</button>
      {erro && <div className="mc-erro">{erro}</div>}
      <button className="mc-btn-p" onClick={salvar}><Check size={18} /> Salvar metas</button>
    </div>
  );
}
