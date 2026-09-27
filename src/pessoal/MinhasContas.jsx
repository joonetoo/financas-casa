import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, Eye, EyeOff, ThumbsUp, MessageSquare, Repeat,
  Filter, Tags, History, Trash2, Copy, ArrowRight, Check, Undo2, Search, Pencil, ShieldCheck,
  Archive, ArchiveRestore, Info, Settings, CheckSquare,
} from "lucide-react";
import { useDocNuvem, registrar, lerHistorico } from "./nuvem.js";
import { ICONES, CORES, CATEGORIAS_PADRAO } from "./categorias.js";
import {
  uid, hojeISO, ymHoje, somaYm, criarLancamentos, doMes, totais, aplicarNasProximas,
  proximasDaSerie, proxMes, normalizar, nomeMes, nomeDia, fmtValor, fmtReais, lerValor, MESES, p2,
  periodoCom, andarPeriodo, nomePeriodo, dentroDo, doPeriodo, semAcento,
} from "./logica.js";
import { MCStyles } from "./estilo.jsx";
import { usePrefs, IconeOink, Carregando } from "../tema.jsx";

const OLHO_KEY = "fc-hide-values";

function vazio() {
  return { v: 1, categorias: CATEGORIAS_PADRAO.map((c) => ({ id: uid(), ...c })), lancamentos: [] };
}

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

export function CatIcone({ cat, size = 38 }) {
  const cor = cat?.cor || "#8C959B";
  const svg = ICONES[cat?.icone] || ICONES.lista;
  return (
    <span className="mc-ic" style={{ width: size, height: size, background: cor }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={Math.round(size * 0.5)} height={Math.round(size * 0.5)}
        dangerouslySetInnerHTML={{ __html: svg }} />
    </span>
  );
}

// Texto de uma linha: "Macbook 2/12"
const nomeCompleto = (l) =>
  l.desc + (l.serie?.tipo === "parcela" ? ` ${l.serie.n}/${l.serie.total}` : "");

export default function MinhasContas({ chave, ativo = true, larga: largaProp }) {
  const nv = useDocNuvem(chave, { vazio, normalizar });
  const { doc, editar } = nv;
  const largaInterna = useLarga();
  const larga = largaProp ?? largaInterna;
  const [prefs] = usePrefs();

  // o app sempre abre no período de HOJE (mês, semana ou dia, conforme a preferência)
  const [periodo, setPeriodo] = useState(() => periodoCom(prefs.periodo));
  const ym = periodo.de.slice(0, 7);
  const irPara = (iso) => setPeriodo((p) => (dentroDo(p, iso) ? p : periodoCom(p.tipo === "intervalo" ? "mes" : p.tipo, iso)));
  const [menuPeriodo, setMenuPeriodo] = useState(false);
  const [escolhendoIntervalo, setEscolhendoIntervalo] = useState(false);
  const [busca, setBusca] = useState(null); // null = fechada; texto = buscando
  const [selecionando, setSelecionando] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [escolhendoCatSel, setEscolhendoCatSel] = useState(false);
  const [moedaCaindo, setMoedaCaindo] = useState(0);
  const [pulo, setPulo] = useState(null);
  const [estado, setEstado] = useState("todas"); // todas | apagar | pagas
  const [catFiltro, setCatFiltro] = useState(null);
  const [escolhendoFiltro, setEscolhendoFiltro] = useState(false);
  const [painel, setPainel] = useState(null); // {modo:'novo'} | {modo:'editar', id}
  const [perguntaProximas, setPerguntaProximas] = useState(null); // item editado
  const [perguntaExcluir, setPerguntaExcluir] = useState(null); // item
  const [tela, setTela] = useState(null); // null | 'categorias' | 'atividades'
  const [toast, setToast] = useState(null);
  const toastId = useRef(0);
  const [oculto, setOculto] = useState(() => {
    try { return localStorage.getItem(OLHO_KEY) === "1"; } catch (e) { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(OLHO_KEY, oculto ? "1" : "0"); } catch (e) { /* só neste aparelho */ }
  }, [oculto]);

  const v = useCallback((n) => (oculto ? "••••" : fmtValor(n)), [oculto]);
  const vR = useCallback((n) => (oculto ? "R$ ••••" : fmtReais(n)), [oculto]);

  const mostrarToast = useCallback((msg, desfazer) => {
    const id = ++toastId.current;
    setToast({ id, msg, desfazer });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 10000);
  }, []);

  const cats = doc?.categorias || [];
  const catPorId = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);
  const lancs = doc?.lancamentos || [];

  const doMesTodos = useMemo(() => doPeriodo(lancs, periodo, prefs.ordem), [lancs, periodo, prefs.ordem]);
  const tot = useMemo(() => totais(doMesTodos), [doMesTodos]);
  const visiveis = useMemo(
    () => doMesTodos.filter((l) =>
      (estado === "todas" || (estado === "receitas" ? l.tipo === "receita" : estado === "pagas" ? l.pago : !l.pago)) &&
      (!catFiltro || l.catId === catFiltro)),
    [doMesTodos, estado, catFiltro]
  );
  const filtrando = estado !== "todas" || !!catFiltro;
  const totFiltro = useMemo(() => totais(visiveis), [visiveis]);

  const grupos = useMemo(() => {
    const g = [];
    for (const l of visiveis) {
      if (!g.length || g[g.length - 1].data !== l.data) g.push({ data: l.data, itens: [] });
      g[g.length - 1].itens.push(l);
    }
    return g;
  }, [visiveis]);

  /* ---------------- ações (todas passam pelo registro de atividades) ---------------- */

  const registrarLanc = (acao, resumo, antes, depois) =>
    registrar(chave, { acao: `lanc:${acao}`, resumo, antes, depois });

  // desfaz trocando exatamente os itens "depois" pelos "antes"
  // (quem continua existindo fica no MESMO lugar da lista; só os novos vão pro fim)
  const trocar = useCallback((tirar, por) => {
    const ids = new Set(tirar.map((l) => l.id));
    const novos = new Map(por.map((l) => [l.id, l]));
    editar((d) => {
      const lista = [];
      for (const l of d.lancamentos) {
        if (novos.has(l.id)) { lista.push(novos.get(l.id)); novos.delete(l.id); }
        else if (!ids.has(l.id)) lista.push(l);
      }
      return { ...d, lancamentos: lista.concat([...novos.values()]) };
    });
  }, [editar]);

  const salvarNovo = (form) => {
    const novos = criarLancamentos(form);
    editar((d) => ({ ...d, lancamentos: d.lancamentos.concat(novos) }));
    const p = novos[0];
    const extra = p.serie?.tipo === "parcela" ? ` em ${novos.length}× de ${fmtReais(p.valor)}`
      : p.serie?.tipo === "fixo" ? " (todo mês)" : "";
    registrarLanc("lancou", `Você lançou ${p.desc}${extra}`, [], novos);
    irPara(p.data);
    setMoedaCaindo((n) => n + 1);
    mostrarToast(`${p.desc} lançado`, () => {
      trocar(novos, []);
      registrarLanc("desfez", `Você desfez o lançamento de ${p.desc}`, novos, []);
    });
  };

  const salvarEdicao = (antigo, form) => {
    const valor = lerValor(form.valorTxt);
    const novo = {
      ...antigo, tipo: form.tipo, desc: form.desc.trim() || antigo.desc, valor,
      data: form.data, catId: form.catId, pago: form.pago, obs: form.obs.trim(),
    };
    // um avulso que ganhou "repetir": vira uma série a partir desta data
    if (!antigo.serie && form.repetir) {
      const serie = criarLancamentos({ ...form, valor, pago: form.pago });
      trocar([antigo], serie);
      registrarLanc("mudou", `Você passou ${novo.desc} a ${form.repetir === "fixo" ? "repetir todo mês" : `${serie.length} parcelas`}`, [antigo], serie);
      return;
    }
    const mudou = ["tipo", "desc", "valor", "data", "catId", "pago", "obs"].some((k) => novo[k] !== antigo[k]);
    if (!mudou) return;
    editar((d) => ({ ...d, lancamentos: d.lancamentos.map((l) => (l.id === antigo.id ? novo : l)) }));
    registrarLanc("mudou", `Você mudou ${nomeCompleto(antigo)}`, [antigo], [novo]);
    irPara(novo.data);
    // só pergunta se mudou algo que faz sentido levar pras próximas
    const levaveis = ["tipo", "desc", "valor", "catId", "obs"].some((k) => novo[k] !== antigo[k]) ||
      novo.data.slice(8) !== antigo.data.slice(8);
    if (antigo.serie && levaveis && proximasDaSerie(lancs, antigo).length) setPerguntaProximas(novo);
  };

  const aplicarProximas = (editado) => {
    const antes = proximasDaSerie(lancs, editado);
    const novoLista = aplicarNasProximas(lancs, editado);
    const idsAntes = new Set(antes.map((l) => l.id));
    const depois = novoLista.filter((l) => idsAntes.has(l.id));
    editar((d) => ({ ...d, lancamentos: aplicarNasProximas(d.lancamentos, editado) }));
    registrarLanc("mudou", `Você mudou os próximos de ${editado.desc} (${antes.length})`, antes, depois);
    mostrarToast(`${antes.length} próximos atualizados`, () => {
      trocar(depois, antes);
      registrarLanc("desfez", `Você desfez a mudança nos próximos de ${editado.desc}`, depois, antes);
    });
  };

  const excluir = (item, escopo) => {
    const tirar = escopo === "proximas" ? [item, ...proximasDaSerie(lancs, item)] : [item];
    trocar(tirar, []);
    const txt = tirar.length > 1 ? `${item.desc} e os próximos (${tirar.length})` : nomeCompleto(item);
    registrarLanc("apagou", `Você apagou ${txt}`, tirar, []);
    setPainel(null);
    mostrarToast(`Apagado: ${txt}`, () => {
      trocar([], tirar);
      registrarLanc("desfez", `Você recuperou ${txt}`, [], tirar);
    });
  };

  const pedirExcluir = (item) => {
    if (item.serie && proximasDaSerie(lancs, item).length) setPerguntaExcluir(item);
    else excluir(item, "esta");
  };

  const alternarPago = (item) => {
    const novo = { ...item, pago: !item.pago };
    if (novo.pago) setPulo(item.id);
    editar((d) => ({ ...d, lancamentos: d.lancamentos.map((l) => (l.id === item.id ? novo : l)) }));
    const verbo = item.tipo === "receita" ? (novo.pago ? "marcou como recebido" : "desmarcou o recebido de")
      : (novo.pago ? "marcou como pago" : "desmarcou o pago de");
    registrarLanc(novo.pago ? "pagou" : "despagou", `Você ${verbo} ${nomeCompleto(item)}`, [item], [novo]);
  };

  const moverProxMes = (item) => {
    const novo = proxMes(item);
    editar((d) => ({ ...d, lancamentos: d.lancamentos.map((l) => (l.id === item.id ? novo : l)) }));
    registrarLanc("mudou", `Você passou ${nomeCompleto(item)} para ${nomeMes(novo.data.slice(0, 7)).toLowerCase()}`, [item], [novo]);
    setPainel(null);
    mostrarToast(`Passou para ${nomeMes(novo.data.slice(0, 7))}`, () => {
      trocar([novo], [item]);
      registrarLanc("desfez", `Você desfez a mudança de mês de ${nomeCompleto(item)}`, [novo], [item]);
    });
  };

  const copiar = (item) => {
    const c = { ...item, id: uid(), pago: false };
    delete c.serie;
    editar((d) => ({ ...d, lancamentos: d.lancamentos.concat([c]) }));
    registrarLanc("lancou", `Você copiou ${nomeCompleto(item)}`, [], [c]);
    setPainel({ modo: "editar", id: c.id });
    mostrarToast("Cópia criada — é só ajustar", () => {
      trocar([c], []);
      setPainel(null);
    });
  };

  // "Voltar como estava" (registro de atividades)
  const voltarComoEstava = (ev) => {
    const [alvo] = String(ev.acao).split(":");
    const antes = Array.isArray(ev.antes) ? ev.antes : [];
    const depois = Array.isArray(ev.depois) ? ev.depois : [];
    if (alvo === "cat") {
      const ids = new Set(depois.map((c) => c.id));
      editar((d) => ({ ...d, categorias: d.categorias.filter((c) => !ids.has(c.id)).concat(antes) }));
      registrar(chave, { acao: "cat:desfez", resumo: `Você voltou como estava: ${ev.resumo.replace(/^Você /, "")}`, antes: depois, depois: antes });
    } else {
      trocar(depois, antes);
      registrarLanc("desfez", `Você voltou como estava: ${ev.resumo.replace(/^Você /, "")}`, depois, antes);
    }
    mostrarToast("Voltou como estava");
  };

  const salvarCategoria = (antiga, nova) => {
    editar((d) => ({
      ...d,
      categorias: antiga ? d.categorias.map((c) => (c.id === antiga.id ? nova : c)) : d.categorias.concat([nova]),
    }));
    const txt = !antiga ? `criou a categoria ${nova.nome}`
      : antiga.arquivada !== nova.arquivada ? `${nova.arquivada ? "arquivou" : "desarquivou"} a categoria ${nova.nome}`
      : `mudou a categoria ${nova.nome}`;
    registrar(chave, { acao: "cat:mudou", resumo: `Você ${txt}`, antes: antiga ? [antiga] : [], depois: [nova] });
  };
  const excluirCategoria = (cat) => {
    editar((d) => ({ ...d, categorias: d.categorias.filter((c) => c.id !== cat.id) }));
    registrar(chave, { acao: "cat:apagou", resumo: `Você apagou a categoria ${cat.nome}`, antes: [cat], depois: [] });
    mostrarToast(`Categoria ${cat.nome} apagada`, () =>
      editar((d) => ({ ...d, categorias: d.categorias.concat([cat]) })));
  };

  // busca: em TODOS os meses, sem ligar pra acento (nome, categoria ou observação)
  const resultadosBusca = useMemo(() => {
    const q = semAcento(busca);
    if (!q) return { total: 0, grupos: [] };
    const achados = lancs
      .filter((l) => semAcento(l.desc).includes(q) || semAcento(catPorId[l.catId]?.nome).includes(q) || semAcento(l.obs).includes(q))
      .sort((a, b) => (a.data < b.data ? 1 : -1));
    const grupos = [];
    for (const l of achados.slice(0, 300)) {
      const g = l.data.slice(0, 7);
      if (!grupos.length || grupos[grupos.length - 1].ym !== g) grupos.push({ ym: g, itens: [] });
      grupos[grupos.length - 1].itens.push(l);
    }
    return { total: achados.length, grupos };
  }, [busca, lancs, catPorId]);

  // o "+" da barra de baixo (celular) e as Configurações conversam com esta aba por avisos
  useEffect(() => {
    if (!ativo) return undefined;
    const novo = () => { setBusca(null); setSelecionando(false); setPainel({ modo: "novo", n: Date.now() }); };
    window.addEventListener("oink-novo", novo);
    return () => window.removeEventListener("oink-novo", novo);
  }, [ativo]);
  useEffect(() => {
    const abrir = (e) => setTela(e.detail);
    window.addEventListener("oink-abrir", abrir);
    return () => window.removeEventListener("oink-abrir", abrir);
  }, []);

  /* ---------------- telas de estado ---------------- */

  if (nv.erroCarregar) {
    return (
      <div className="mc-wrap mc-centro">
        <MCStyles />
        <p>Não foi possível carregar suas contas. Verifique a internet e tente de novo —
          por segurança, nada será salvo até carregar direito.</p>
        <button className="mc-btn-p" onClick={() => window.location.reload()}>Tentar de novo</button>
      </div>
    );
  }
  if (!nv.carregado || !doc) {
    return <div className="mc-wrap"><MCStyles /><Carregando texto="Abrindo suas contas…" /></div>;
  }

  const editando = painel?.modo === "editar" ? lancs.find((l) => l.id === painel.id) : null;
  const painelAberto = painel && (painel.modo === "novo" || editando);
  const form = painelAberto && (
    <FormLancamento
      key={painel.modo === "novo" ? "novo" + painel.n : painel.id}
      modo={painel.modo}
      item={editando}
      ymPadrao={ym}
      cats={cats}
      catPorId={catPorId}
      lancs={lancs}
      larga={larga}
      onFechar={() => setPainel(null)}
      onSalvarNovo={(f, deNovo) => {
        salvarNovo(f);
        setPainel(deNovo ? { modo: "novo", n: (painel.n || 0) + 1 } : null);
      }}
      onSalvarEdicao={(f) => {
        salvarEdicao(editando, f);
        setPainel(null);
      }}
      onNavegar={(outro) => setPainel({ modo: "editar", id: outro.id })}
      onPagar={() => alternarPago(editando)}
      onCopiar={() => copiar(editando)}
      onProxMes={() => moverProxMes(editando)}
      onExcluir={() => pedirExcluir(editando)}
    />
  );

  const hoje = hojeISO();
  const res = tot.resultado;
  const rotHero = periodo.tipo === "mes"
    ? (res < 0 ? "Faltam pra fechar o mês" : "Sobra no mês")
    : (res < 0 ? "Faltam no período" : "Sobra no período");
  const [inteiro, centavos] = fmtValor(Math.abs(res)).split(",");
  const hero = (
    <div className={"mc-hero" + (larga ? " mc-hero-card vidro" : "")}>
      {larga && <span className="mc-hero-ic"><IconeOink size={44} moedaCaindo={moedaCaindo > 0} key={moedaCaindo} /></span>}
      <div className="mc-hero-rot">{rotHero}</div>
      <div className="mc-hero-num">{oculto ? "R$ ••••" : <>R$ {inteiro}<small>,{centavos}</small></>}</div>
      <div className="mc-hero-pills">
        <span className="mc-pill-e">+{v(tot.entradas)} entrou</span>
        <span className="mc-pill-s">−{v(tot.saidas)} saiu</span>
      </div>
    </div>
  );

  const idsVisiveis = visiveis.map((l) => l.id);
  const alternarSel = (id) => setSel((o) => {
    const n = new Set(o);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const sairSelecao = () => { setSelecionando(false); setSel(new Set()); };

  // ações em vários de uma vez: só nos marcados, sem mexer nos outros meses
  const acaoSel = (tipo, catId) => {
    const alvo = lancs.filter((l) => sel.has(l.id));
    if (!alvo.length) return;
    let depois;
    if (tipo === "excluir") depois = [];
    else if (tipo === "pagar") {
      const todosPagos = alvo.every((l) => l.pago);
      depois = alvo.map((l) => ({ ...l, pago: !todosPagos }));
    } else if (tipo === "categoria") depois = alvo.map((l) => ({ ...l, catId }));
    else depois = alvo.map((l) => proxMes(l));
    trocar(alvo, depois);
    const n = alvo.length;
    const txt = { excluir: `apagou ${n} lançamentos`, pagar: depois[0]?.pago ? `marcou ${n} como pagos` : `desmarcou o pago de ${n}`,
      categoria: `mudou a categoria de ${n} lançamentos`, prox: `passou ${n} lançamentos pro mês seguinte` }[tipo];
    registrarLanc(tipo === "excluir" ? "apagou" : "mudou", `Você ${txt}`, alvo, depois);
    mostrarToast(`Pronto: ${txt}`, () => {
      trocar(depois, alvo);
      registrarLanc("desfez", `Você desfez: ${txt}`, depois, alvo);
    });
    sairSelecao();
  };


  const linha = (l, comData) => {
    const c = catPorId[l.catId];
    const sele = sel.has(l.id);
    const aoTocar = () => (selecionando ? alternarSel(l.id) : setPainel({ modo: "editar", id: l.id }));
    return (
      <div key={l.id} className={"mc-linha" + (l.pago ? " pago" : "") + (editando && editando.id === l.id ? " sel" : "") + (sele ? " marcada" : "")}>
        {selecionando && (
          <button className={"mc-caixa" + (sele ? " on" : "")} aria-label={sele ? "Desmarcar" : "Marcar"} aria-pressed={sele} onClick={() => alternarSel(l.id)}>
            {sele && <Check size={16} strokeWidth={3.2} />}
          </button>
        )}
        <button className="mc-linha-bt" onClick={aoTocar}>
          <CatIcone cat={c} />
          <span className="mc-nm">
            <span className="mc-t">{l.desc}{l.serie?.tipo === "parcela" && <span className="mc-pc">{l.serie.n}/{l.serie.total}</span>}</span>
            <span className="mc-s">
              {comData ? `${l.data.split("-").reverse().join("/")} · ` : ""}{c ? c.nome : "Sem categoria"}
              {l.obs && <MessageSquare size={13} aria-label="tem observação" />}
              {l.serie?.tipo === "fixo" && <Repeat size={13} aria-label="repete todo mês" />}
            </span>
          </span>
          <span className={"mc-val" + (l.tipo === "receita" ? " mc-pos" : "")}>
            {l.tipo === "receita" ? "+" : "−"}{v(l.valor)}
          </span>
        </button>
        {!selecionando && (
          <button
            className={"mc-moeda-bt" + (pulo === l.id ? " oink-pulo" : "")}
            onAnimationEnd={() => setPulo(null)}
            aria-label={l.pago ? (l.tipo === "receita" ? "Recebido" : "Pago") : (l.tipo === "receita" ? "Marcar como recebido" : "Marcar como pago")}
            aria-pressed={l.pago}
            onClick={() => alternarPago(l)}
          >
            {l.pago ? <MoedaOk /> : <span className="mc-moeda-vazia" />}
          </button>
        )}
      </div>
    );
  };

  const nomeOpcaoPeriodo = (tipo) => nomePeriodo(periodoCom(tipo));

  return (
    <div className={"mc-wrap" + (larga ? " mc-larga" : "")}>
      <MCStyles />

      {busca === null && (
        <header className="mc-topo">
          {larga ? (
            <div className="mc-titulo-aba">Minhas contas</div>
          ) : (
            <div className="mc-marca"><IconeOink size={36} moedaCaindo={moedaCaindo > 0} key={moedaCaindo} /><span className="oink-logo">oink<i>.</i></span></div>
          )}
          <div className="mc-topo-bts">
            <button className="mc-ib" title="Buscar" aria-label="Buscar" onClick={() => setBusca("")}><Search size={19} /></button>
            <button className="mc-ib" title={oculto ? "Mostrar valores" : "Esconder valores"} aria-label="Esconder valores" onClick={() => setOculto((o) => !o)}>
              {oculto ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
            {!larga && <button className="mc-ib" title="Configurações" aria-label="Configurações" onClick={() => window.dispatchEvent(new Event("oink-config"))}><Settings size={19} /></button>}
          </div>
        </header>
      )}

      {busca !== null && (
        <div className="mc-busca-topo">
          <label className="mc-busca mc-busca-grande">
            <Search size={19} />
            <input autoFocus value={busca} placeholder="Buscar em todos os meses…" onChange={(e) => setBusca(e.target.value)} aria-label="Buscar lançamentos" />
          </label>
          <button className="mc-link" onClick={() => setBusca(null)}>Cancelar</button>
        </div>
      )}


      {!larga && busca === null && hero}

      <div className="mc-corpo">
        <section className={"mc-lista-card" + (larga ? " vidro" : "")}>
          {busca === null && (
            <div className="mc-periodo">
              <button className="mc-ib" aria-label="Período anterior" onClick={() => setPeriodo(andarPeriodo(periodo, -1))}><ChevronLeft size={20} /></button>
              <div className="mc-per-centro">
                <button className={"mc-per-bt" + (menuPeriodo ? " on" : "")} aria-expanded={menuPeriodo} onClick={() => setMenuPeriodo((o) => !o)}>
                  {nomePeriodo(periodo)} <ChevronDown size={16} />
                </button>
                <small>{doMesTodos.length} {doMesTodos.length === 1 ? "lançamento" : "lançamentos"}</small>
                {menuPeriodo && (
                  <>
                    <div className="mc-menu-fundo" onClick={() => setMenuPeriodo(false)} />
                    <div className="mc-menu vidro" role="menu">
                      {[["dia", "Hoje"], ["semana", "Esta semana"], ["mes", "Este mês"]].map(([k, t]) => (
                        <button key={k} role="menuitem" className={periodo.tipo === k && dentroDo(periodo, hoje) ? "on" : ""}
                          onClick={() => { setPeriodo(periodoCom(k)); setMenuPeriodo(false); }}>
                          {t}<span>{nomeOpcaoPeriodo(k)}</span>
                        </button>
                      ))}
                      <button role="menuitem" className={periodo.tipo === "intervalo" ? "on" : ""} onClick={() => { setMenuPeriodo(false); setEscolhendoIntervalo(true); }}>
                        Escolher período<span className="mc-rosa">De / Até</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button className="mc-ib" aria-label="Próximo período" onClick={() => setPeriodo(andarPeriodo(periodo, 1))}><ChevronRight size={20} /></button>
              {larga && (
                <button className="mc-btn-rosa" onClick={() => setPainel({ modo: "novo", n: Date.now() })}><Plus size={18} strokeWidth={2.8} /> Lançar</button>
              )}
            </div>
          )}

          {busca === null && selecionando && (
            <div className="mc-chips">
              <span className="mc-sel-conta">{sel.size} {sel.size === 1 ? "selecionado" : "selecionados"}</span>
              <button className="mc-chip" onClick={() => setSel(sel.size === idsVisiveis.length && sel.size ? new Set() : new Set(idsVisiveis))}>
                {sel.size === idsVisiveis.length && sel.size ? "Nenhum" : "Todos"}
              </button>
              <button className="mc-chip mc-chip-sel on" onClick={sairSelecao}><X size={14} /> Cancelar</button>
            </div>
          )}
          {busca === null && !selecionando && (
            <div className="mc-chips">
              {[["todas", "Todas"], ["apagar", "A pagar"], ["pagas", "Pagas"], ["receitas", "Receitas"]].map(([k, t]) => (
                <button key={k} className={"mc-chip" + (estado === k ? " on" : "")} onClick={() => setEstado(k)}>{t}</button>
              ))}
              {catFiltro && catPorId[catFiltro] ? (
                <button className="mc-chip on" onClick={() => setCatFiltro(null)}>
                  <CatIcone cat={catPorId[catFiltro]} size={18} /> {catPorId[catFiltro].nome} <X size={14} />
                </button>
              ) : (
                <button className="mc-chip" onClick={() => setEscolhendoFiltro(true)}><Filter size={14} /> Categoria</button>
              )}
              <button className="mc-chip mc-chip-sel" onClick={() => setSelecionando(true)}><CheckSquare size={14} /> Selecionar</button>
            </div>
          )}

          {selecionando && <div className="mc-sel-aviso">Só no período que está na tela: nada muda nos outros meses.</div>}

          {busca !== null ? (
            <div className="mc-lista-anim">
              {busca.trim() && (
                <div className="mc-sel-aviso">
                  {resultadosBusca.total === 0 ? "Nada encontrado." : `Achei ${resultadosBusca.total} em todos os meses · sem ligar pra acento`}
                </div>
              )}
              {resultadosBusca.grupos.map((g) => (
                <div key={g.ym}>
                  <div className="mc-dia"><span>{nomeMes(g.ym)}</span><span>{g.itens.length}</span></div>
                  {g.itens.map((l) => linha(l, true))}
                </div>
              ))}
            </div>
          ) : (
            <div className="mc-lista-anim" key={periodo.tipo + periodo.de}>
              {filtrando && visiveis.length > 0 && (
                <div className="mc-filtro-tot">
                  Neste filtro: <b>{totFiltro.saidas ? `−${v(totFiltro.saidas)}` : ""}{totFiltro.saidas && totFiltro.entradas ? " · " : ""}{totFiltro.entradas ? `+${v(totFiltro.entradas)}` : ""}</b>
                </div>
              )}
              {grupos.length === 0 && (
                <div className="mc-vazio">
                  {doMesTodos.length === 0
                    ? <>Nada lançado em {nomePeriodo(periodo)}.<br />Toque no <b>+</b> pra lançar.</>
                    : <>Nenhum lançamento neste filtro.</>}
                </div>
              )}
              {grupos.map((g) => {
                const tg = totais(g.itens);
                return (
                  <div key={g.data}>
                    <div className={"mc-dia" + (g.data === hoje ? " mc-dia-hoje" : "")}>
                      <span>{g.data === hoje ? "Hoje · " : ""}{nomeDia(g.data)}</span>
                      <span>{tg.resultado < 0 ? "−" : "+"}{v(Math.abs(tg.resultado))}</span>
                    </div>
                    {g.itens.map((l) => linha(l, false))}
                  </div>
                );
              })}
            </div>
          )}

          {selecionando && (
            <div className={"mc-sel-barra" + (larga ? "" : " fixa") + " vidro"}>
              <button disabled={!sel.size} onClick={() => acaoSel("pagar")}><MoedaOk size={22} /> Pagar</button>
              <button disabled={!sel.size} onClick={() => setEscolhendoCatSel(true)}><Tags size={18} /> Categoria</button>
              <button disabled={!sel.size} onClick={() => acaoSel("prox")}><ArrowRight size={18} /> Próx. mês</button>
              <button disabled={!sel.size} className="mc-perigo" onClick={() => acaoSel("excluir")}><Trash2 size={18} /> Excluir</button>
            </div>
          )}
        </section>

        {larga && (
          <aside className="mc-lado">
            {hero}
            {form || <div className="mc-lado-dica vidro">Toque num lançamento pra ver, mudar ou apagar.</div>}
          </aside>
        )}
      </div>

      {!larga && form && <div className="mc-folha-fundo" onClick={() => setPainel(null)}><div className="mc-folha" onClick={(e) => e.stopPropagation()}>{form}</div></div>}

      {escolhendoIntervalo && (
        <EscolherIntervalo
          inicial={periodo}
          onEscolher={(de, ate) => { setPeriodo({ tipo: "intervalo", de, ate }); setEscolhendoIntervalo(false); }}
          onFechar={() => setEscolhendoIntervalo(false)}
        />
      )}

      {escolhendoFiltro && (
        <EscolherCategoria
          cats={cats.filter((c) => !c.arquivada)}
          titulo="Filtrar por categoria"
          onEscolher={(c) => { setCatFiltro(c.id); setEscolhendoFiltro(false); }}
          onFechar={() => setEscolhendoFiltro(false)}
        />
      )}
      {escolhendoCatSel && (
        <EscolherCategoria
          cats={cats.filter((c) => !c.arquivada)}
          titulo={`Categoria dos ${sel.size} selecionados`}
          onEscolher={(c) => { setEscolhendoCatSel(false); acaoSel("categoria", c.id); }}
          onFechar={() => setEscolhendoCatSel(false)}
        />
      )}

      {perguntaProximas && (
        <Dialogo
          icone={<Repeat size={24} />}
          titulo="Alteração salva!"
          texto={`Este lançamento ${perguntaProximas.serie?.tipo === "parcela" ? "é parcelado" : "se repete todo mês"}. Quer aplicar a mesma mudança nos próximos (${proximasDaSerie(lancs, perguntaProximas).length})?`}
          botoes={[
            { txt: "Não, apenas este", vermelho: true, onClick: () => setPerguntaProximas(null) },
            { txt: "Sim, atualizar próximos", principal: true, onClick: () => { aplicarProximas(perguntaProximas); setPerguntaProximas(null); } },
          ]}
          onFechar={() => setPerguntaProximas(null)}
        />
      )}

      {perguntaExcluir && (
        <Dialogo
          icone={<Trash2 size={24} />}
          perigo
          titulo={`Apagar ${perguntaExcluir.desc}?`}
          texto={`Este lançamento ${perguntaExcluir.serie?.tipo === "parcela" ? "é parcelado" : "se repete todo mês"}. O que você quer apagar?`}
          botoes={[
            { txt: "Só este", onClick: () => { excluir(perguntaExcluir, "esta"); setPerguntaExcluir(null); } },
            { txt: `Este e os próximos (${proximasDaSerie(lancs, perguntaExcluir).length + 1})`, perigo: true, onClick: () => { excluir(perguntaExcluir, "proximas"); setPerguntaExcluir(null); } },
            { txt: "Cancelar", fraco: true, onClick: () => setPerguntaExcluir(null) },
          ]}
          onFechar={() => setPerguntaExcluir(null)}
        />
      )}

      {tela === "categorias" && (
        <TelaCategorias cats={cats} lancs={lancs} onSalvar={salvarCategoria} onExcluir={excluirCategoria} onFechar={() => setTela(null)} />
      )}
      {tela === "atividades" && (
        <TelaAtividades chave={chave} catPorId={catPorId} oculto={oculto} onVoltar={voltarComoEstava} onFechar={() => setTela(null)} />
      )}

      {nv.conflito && (
        <div className="mc-aviso mc-aviso-conf" role="alert">
          <span><b>Este aparelho estava com uma versão antiga</b> — as contas foram mudadas em outro aparelho.
            Carreguei a versão mais nova. O que foi feito aqui ({nv.conflito.quando}) ficou guardado à parte, nada foi perdido.</span>
          <button onClick={nv.fecharConflito}>Entendi</button>
        </div>
      )}
      {nv.erroSalvar && (
        <div className="mc-aviso mc-aviso-erro" role="alert"><span className="mc-ponto" /> Erro ao salvar · tentando de novo…</div>
      )}
      {toast && (
        <div className="mc-toast">
          <span>{toast.msg}</span>
          {toast.desfazer && <button onClick={() => { toast.desfazer(); setToast(null); }}>Desfazer</button>}
        </div>
      )}
    </div>
  );
}

function MoedaOk({ size = 28 }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#C98714" /><circle cx="20" cy="19" r="17" fill="#FFC94D" />
      <path d="M13 20l5 5 9-10" stroke="#7A4E00" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Calendário no estilo Oink (no lugar do calendário cinza do sistema)
const SEMANA_CURTA = ["D", "S", "T", "Q", "Q", "S", "S"];
function CampoData({ value, onChange, rotulo = "Data" }) {
  const [aberto, setAberto] = useState(false);
  const [ym, setYmCal] = useState((value || hojeISO()).slice(0, 7));
  useEffect(() => { if (aberto) setYmCal((value || hojeISO()).slice(0, 7)); }, [aberto]);
  const [a, m] = ym.split("-").map(Number);
  const primeiro = new Date(a, m - 1, 1).getDay();
  const total = new Date(a, m, 0).getDate();
  const hoje = hojeISO();
  const dias = [];
  for (let i = 0; i < primeiro; i++) dias.push(null);
  for (let d = 1; d <= total; d++) dias.push(`${ym}-${p2(d)}`);
  const escolher = (iso) => { onChange(iso); setAberto(false); };
  const txt = value ? value.split("-").reverse().join("/") : "Escolher";
  return (
    <div className="mc-data">
      <button type="button" className="mc-inp mc-data-bt" aria-label={`${rotulo}: ${txt}`} aria-expanded={aberto} onClick={() => setAberto((o) => !o)}>
        <span>{txt}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
      </button>
      {aberto && (
        <>
          <div className="mc-menu-fundo" onClick={() => setAberto(false)} />
          <div className="mc-cal vidro" role="dialog" aria-label={rotulo}>
            <div className="mc-cal-topo">
              <button type="button" aria-label="Mês anterior" onClick={() => setYmCal(somaYm(ym, -1))}><ChevronLeft size={18} /></button>
              <b>{MESES[m - 1]} {a}</b>
              <button type="button" aria-label="Próximo mês" onClick={() => setYmCal(somaYm(ym, 1))}><ChevronRight size={18} /></button>
            </div>
            <div className="mc-cal-grade">
              {SEMANA_CURTA.map((d, i) => <span key={i} className="mc-cal-sem">{d}</span>)}
              {dias.map((iso, i) => iso ? (
                <button type="button" key={iso} className={"mc-cal-dia" + (iso === value ? " on" : "") + (iso === hoje ? " hoje" : "")} onClick={() => escolher(iso)}>
                  {Number(iso.slice(8))}
                </button>
              ) : <span key={"v" + i} />)}
            </div>
            <button type="button" className="mc-cal-hoje" onClick={() => escolher(hoje)}>Hoje</button>
          </div>
        </>
      )}
    </div>
  );
}

function EscolherIntervalo({ inicial, onEscolher, onFechar }) {
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const ok = de && ate && de <= ate;
  return (
    <div className="mc-modal-fundo" onClick={onFechar}>
      <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Escolher período">
        <div className="mc-form-topo">
          <div className="mc-form-tit">Escolher período</div>
          <button className="mc-ib mc-ib-plano" aria-label="Fechar" onClick={onFechar}><X size={18} /></button>
        </div>
        <div className="mc-2col">
          <div className="mc-campo"><span className="mc-rot">De</span><CampoData value={de} onChange={setDe} rotulo="Data inicial" /></div>
          <div className="mc-campo"><span className="mc-rot">Até</span><CampoData value={ate} onChange={setAte} rotulo="Data final" /></div>
        </div>
        {!ok && <div className="mc-erro">A data "até" precisa ser depois da data "de".</div>}
        <div className="mc-form-bts">
          <button className="mc-btn-p" disabled={!ok} onClick={() => onEscolher(de, ate)}><Check size={18} /> Ver esse período</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Novo / editar lançamento                                            */
/* ------------------------------------------------------------------ */

function FormLancamento({
  modo, item, ymPadrao, cats, catPorId, lancs, larga, onFechar, onSalvarNovo, onSalvarEdicao,
  onNavegar, onPagar, onCopiar, onProxMes, onExcluir,
}) {
  const dataPadrao = ymPadrao === ymHoje() ? hojeISO() : `${ymPadrao}-01`;
  const [f, setF] = useState(() => item ? {
    tipo: item.tipo, desc: item.desc, valorTxt: fmtValor(item.valor), data: item.data, catId: item.catId,
    pago: !!item.pago, obs: item.obs || "", repetir: null, parcelas: 2, modoValor: "total",
  } : {
    tipo: "despesa", desc: "", valorTxt: "", data: dataPadrao, catId: null, pago: false, obs: "",
    repetir: null, parcelas: 2, modoValor: "total",
  });
  const [verObs, setVerObs] = useState(!!item?.obs);
  const [verRepetir, setVerRepetir] = useState(false);
  const [escolhendoCat, setEscolhendoCat] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, val) => setF((o) => ({ ...o, [k]: val }));

  const cat = catPorId[f.catId];
  const valor = lerValor(f.valorTxt);
  const serieItens = item?.serie
    ? lancs.filter((l) => l.serie && l.serie.id === item.serie.id).sort((a, b) => (a.data < b.data ? -1 : 1))
    : [];
  const pos = item ? serieItens.findIndex((l) => l.id === item.id) : -1;

  const parcelasN = Math.max(2, Math.min(120, Number(f.parcelas) || 2));
  let aviso = "";
  if (f.repetir === "parcela" && valor > 0) {
    const cada = f.modoValor === "parcela" ? valor : Math.floor((valor * 100) / parcelasN) / 100;
    const total = f.modoValor === "parcela" ? valor * parcelasN : valor;
    const ult = somaYm(f.data.slice(0, 7), parcelasN - 1);
    const mm = (ym) => `${MESES[Number(ym.slice(5)) - 1].slice(0, 3).toLowerCase()}/${ym.slice(0, 4)}`;
    aviso = `Serão lançadas ${parcelasN} parcelas de ${fmtReais(cada)}, de ${mm(f.data.slice(0, 7))} a ${mm(ult)}. Total ${fmtReais(total)}.`;
  } else if (f.repetir === "fixo") {
    aviso = "Vai aparecer todo mês, pelos próximos 3 anos. Dá pra mudar ou parar quando quiser.";
  }

  const salvar = (deNovo) => {
    if (!(valor > 0)) return setErro("Coloque um valor maior que zero.");
    if (!f.data) return setErro("Escolha a data.");
    setErro("");
    const pronto = { ...f, valor, parcelas: parcelasN };
    if (modo === "novo") onSalvarNovo(pronto, deNovo);
    else onSalvarEdicao(pronto);
  };

  const catsDoTipo = cats.filter((c) => c.tipo === f.tipo && (!c.arquivada || c.id === f.catId));

  return (
    <div className="mc-form">
      <div className="mc-form-topo">
        <div>
          {modo === "editar" && <div className={"mc-form-tipo " + (f.tipo === "receita" ? "mc-pos" : "mc-neg")}>{f.tipo === "receita" ? "Receita" : "Despesa"}{item.serie?.tipo === "fixo" ? " · todo mês" : ""}</div>}
          <div className="mc-form-tit">{modo === "novo" ? "Novo lançamento" : item.desc}</div>
        </div>
        <button className="mc-ib mc-ib-plano" aria-label="Fechar" onClick={onFechar}><X size={18} /></button>
      </div>

      {item?.serie?.tipo === "parcela" && pos >= 0 && (
        <div className="mc-parc-nav">
          <button aria-label="Parcela anterior" disabled={pos <= 0} onClick={() => onNavegar(serieItens[pos - 1])}><ChevronLeft size={18} /></button>
          <span>Parcela {item.serie.n} de {item.serie.total}</span>
          <button aria-label="Próxima parcela" disabled={pos >= serieItens.length - 1} onClick={() => onNavegar(serieItens[pos + 1])}><ChevronRight size={18} /></button>
        </div>
      )}

      <div className="mc-seg mc-seg-tipo">
        {[["despesa", "Despesa"], ["receita", "Receita"]].map(([k, t]) => (
          <button key={k} className={f.tipo === k ? "on " + k : ""} onClick={() => setF((o) => ({ ...o, tipo: k, catId: catPorId[o.catId]?.tipo === k ? o.catId : null }))}>{t}</button>
        ))}
      </div>

      <label className="mc-campo">
        <span className="mc-rot">Descrição</span>
        <input className="mc-inp" value={f.desc} placeholder="Ex.: Fatura Nubank" onChange={(e) => set("desc", e.target.value)} />
      </label>

      <div className="mc-2col">
        <label className="mc-campo">
          <span className="mc-rot">{f.repetir === "parcela" ? (f.modoValor === "parcela" ? "Valor da parcela" : "Valor total") : "Valor"}</span>
          <input className="mc-inp mc-inp-valor" inputMode="decimal" placeholder="0,00" value={f.valorTxt}
            onChange={(e) => set("valorTxt", e.target.value)} onFocus={(e) => e.target.select()} />
        </label>
        <div className="mc-campo">
          <span className="mc-rot">{f.repetir === "parcela" ? "1ª parcela" : "Data"}</span>
          <CampoData value={f.data} onChange={(v) => set("data", v)} rotulo={f.repetir === "parcela" ? "Data da 1ª parcela" : "Data"} />
        </div>
      </div>

      <div className="mc-campo">
        <span className="mc-rot">Categoria</span>
        <button className="mc-inp mc-cat-bt" onClick={() => setEscolhendoCat(true)}>
          {cat ? <><CatIcone cat={cat} size={28} /><span>{cat.nome}</span></> : <span className="mc-fraco">Escolher categoria</span>}
          <ChevronDown size={18} className="mc-fraco" />
        </button>
      </div>

      <label className="mc-chave">
        <span>{f.tipo === "receita" ? "Já recebi" : "Já está pago"}</span>
        <input type="checkbox" checked={f.pago} onChange={(e) => set("pago", e.target.checked)} />
        <span className="mc-chave-trilho" aria-hidden="true"><span /></span>
      </label>

      <div className="mc-2bts">
        {(modo === "novo" || !item?.serie) && (
          <button className={"mc-bt-op" + (verRepetir || f.repetir ? " on" : "")} onClick={() => { setVerRepetir((x) => !x); if (!verRepetir && !f.repetir) set("repetir", "parcela"); if (verRepetir) set("repetir", null); }}>
            <Repeat size={17} /> Repetir
          </button>
        )}
        <button className={"mc-bt-op" + (verObs ? " on" : "")} onClick={() => setVerObs((x) => !x)}>
          <MessageSquare size={17} /> Observação
        </button>
      </div>

      {verObs && (
        <label className="mc-campo">
          <span className="mc-rot">Observação</span>
          <textarea className="mc-inp mc-area" rows={2} value={f.obs} placeholder="Algo pra lembrar…" onChange={(e) => set("obs", e.target.value)} />
        </label>
      )}

      {(verRepetir || f.repetir) && (modo === "novo" || !item?.serie) && (
        <div className="mc-rep">
          {[["fixo", "Todo mês (fixa)", "Remédios, DAS, plano de saúde…"], ["parcela", "Parcelado", "Aparece em cada mês como 1/10, 2/10…"]].map(([k, t, s]) => (
            <button key={k} className={"mc-opt" + (f.repetir === k ? " on" : "")} onClick={() => set("repetir", k)}>
              <span className="mc-dot" />
              <span><b>{t}</b><small>{s}</small></span>
            </button>
          ))}
          {f.repetir === "parcela" && (
            <>
              <div className="mc-campo">
                <span className="mc-rot">Parcelas</span>
                <div className="mc-passo">
                  <button aria-label="Menos parcelas" onClick={() => set("parcelas", Math.max(2, parcelasN - 1))}>−</button>
                  <input inputMode="numeric" value={f.parcelas} onChange={(e) => set("parcelas", e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Número de parcelas" />
                  <button aria-label="Mais parcelas" onClick={() => set("parcelas", Math.min(120, parcelasN + 1))}>+</button>
                </div>
              </div>
              <div className="mc-campo">
                <span className="mc-rot">O valor que digitei é</span>
                <div className="mc-seg">
                  <button className={f.modoValor === "total" ? "on" : ""} onClick={() => set("modoValor", "total")}>O total</button>
                  <button className={f.modoValor === "parcela" ? "on" : ""} onClick={() => set("modoValor", "parcela")}>De cada parcela</button>
                </div>
              </div>
            </>
          )}
          {aviso && <div className="mc-info"><Info size={17} /> <span>{aviso}</span></div>}
        </div>
      )}

      {erro && <div className="mc-erro">{erro}</div>}

      {modo === "editar" && (
        <div className="mc-acoes">
          <button onClick={onPagar}><span><ThumbsUp size={19} /></span>{item.pago ? (item.tipo === "receita" ? "Desmarcar" : "Despagar") : (item.tipo === "receita" ? "Recebido" : "Pagar")}</button>
          <button onClick={onCopiar}><span><Copy size={19} /></span>Copiar</button>
          <button onClick={onProxMes}><span><ArrowRight size={19} /></span>Próx. mês</button>
          <button onClick={onExcluir} className="mc-perigo"><span><Trash2 size={19} /></span>Excluir</button>
        </div>
      )}

      <div className="mc-form-bts">
        {modo === "novo" && <button className="mc-btn-s" onClick={() => salvar(true)}>Salvar e lançar outra</button>}
        <button className="mc-btn-p" onClick={() => salvar(false)}><Check size={18} strokeWidth={2.6} /> Salvar</button>
      </div>

      {escolhendoCat && (
        <EscolherCategoria
          cats={catsDoTipo}
          titulo={f.tipo === "receita" ? "Categoria da receita" : "Categoria da despesa"}
          onEscolher={(c) => { set("catId", c.id); setEscolhendoCat(false); }}
          onFechar={() => setEscolhendoCat(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EscolherCategoria({ cats, titulo, onEscolher, onFechar }) {
  const [busca, setBusca] = useState("");
  const tiraAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = cats
    .filter((c) => tiraAcento(c.nome).includes(tiraAcento(busca)))
    .sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome, "pt-BR") : a.tipo === "despesa" ? -1 : 1));
  return (
    <div className="mc-modal-fundo" onClick={onFechar}>
      <div className="mc-modal mc-modal-lista" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="mc-form-topo">
          <div className="mc-form-tit">{titulo}</div>
          <button className="mc-ib mc-ib-plano" aria-label="Fechar" onClick={onFechar}><X size={18} /></button>
        </div>
        <label className="mc-busca"><Search size={16} /><input value={busca} placeholder="Buscar…" onChange={(e) => setBusca(e.target.value)} /></label>
        <div className="mc-cat-lista">
          {lista.map((c) => (
            <button key={c.id} className="mc-cat-item" onClick={() => onEscolher(c)}>
              <CatIcone cat={c} size={34} /><span>{c.nome}</span>
              {c.tipo === "receita" && <small className="mc-pos">receita</small>}
            </button>
          ))}
          {lista.length === 0 && <div className="mc-vazio">Nenhuma categoria com esse nome.</div>}
        </div>
      </div>
    </div>
  );
}

function Dialogo({ icone, titulo, texto, botoes, onFechar, perigo }) {
  return (
    <div className="mc-modal-fundo mc-dialogo-fundo" onClick={onFechar}>
      <div className="mc-modal mc-dialogo" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label={titulo}>
        <span className={"mc-dialogo-ic" + (perigo ? " perigo" : "")}>{icone}</span>
        <div className="mc-form-tit">{titulo}</div>
        <p>{texto}</p>
        {botoes.map((b) => (
          <button key={b.txt} className={b.principal ? "mc-btn-p" : b.vermelho ? "mc-btn-verm" : b.perigo ? "mc-btn-perigo" : b.fraco ? "mc-btn-fraco" : "mc-btn-s"} onClick={b.onClick}>{b.txt}</button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Categorias                                                          */
/* ------------------------------------------------------------------ */

function TelaCategorias({ cats, lancs, onSalvar, onExcluir, onFechar }) {
  const [tipo, setTipo] = useState("despesa");
  const [editando, setEditando] = useState(null); // categoria | {nova:true}
  const [verArq, setVerArq] = useState(false);
  const usos = useMemo(() => {
    const u = {};
    for (const l of lancs) u[l.catId] = (u[l.catId] || 0) + 1;
    return u;
  }, [lancs]);
  const doTipo = cats.filter((c) => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const ativas = doTipo.filter((c) => !c.arquivada);
  const arq = doTipo.filter((c) => c.arquivada);
  return (
    <div className="mc-tela">
      <div className="mc-tela-in">
        <div className="mc-tela-topo">
          <button className="mc-ib" aria-label="Voltar" onClick={onFechar}><ChevronLeft size={20} /></button>
          <div className="mc-form-tit">Categorias</div>
          <button className="mc-btn-p mc-btn-peq" onClick={() => setEditando({ nova: true })}><Plus size={16} /> Nova</button>
        </div>
        <div className="mc-seg">
          <button className={tipo === "despesa" ? "on" : ""} onClick={() => setTipo("despesa")}>Despesas · {cats.filter((c) => c.tipo === "despesa" && !c.arquivada).length}</button>
          <button className={tipo === "receita" ? "on" : ""} onClick={() => setTipo("receita")}>Receitas · {cats.filter((c) => c.tipo === "receita" && !c.arquivada).length}</button>
        </div>
        <div>
          {ativas.map((c) => (
            <button key={c.id} className="mc-cat-linha" onClick={() => setEditando(c)}>
              <CatIcone cat={c} size={36} /><span>{c.nome}</span><Pencil size={16} className="mc-fraco" />
            </button>
          ))}
        </div>
        {arq.length > 0 && (
          <>
            <button className="mc-arq-bt" onClick={() => setVerArq((x) => !x)}>
              <Archive size={16} /> Arquivadas ({arq.length}) <ChevronDown size={16} style={{ transform: verArq ? "rotate(180deg)" : "" }} />
            </button>
            {verArq && arq.map((c) => (
              <button key={c.id} className="mc-cat-linha arq" onClick={() => setEditando(c)}>
                <CatIcone cat={c} size={36} /><span>{c.nome}</span><Pencil size={16} className="mc-fraco" />
              </button>
            ))}
          </>
        )}
      </div>
      {editando && (
        <EditarCategoria
          cat={editando.nova ? null : editando}
          tipo={tipo}
          usos={editando.nova ? 0 : usos[editando.id] || 0}
          onSalvar={(antiga, nova) => { onSalvar(antiga, nova); setEditando(null); }}
          onExcluir={(c) => { onExcluir(c); setEditando(null); }}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function EditarCategoria({ cat, tipo, usos, onSalvar, onExcluir, onFechar }) {
  const [nome, setNome] = useState(cat?.nome || "");
  const [icone, setIcone] = useState(cat?.icone || "etiqueta");
  const [cor, setCor] = useState(cat?.cor || CORES[3]);
  const salvar = (extra = {}) => {
    if (!nome.trim()) return;
    const nova = cat ? { ...cat, nome: nome.trim(), icone, cor, ...extra }
      : { id: uid(), tipo, nome: nome.trim(), icone, cor, arquivada: false };
    onSalvar(cat, nova);
  };
  return (
    <div className="mc-modal-fundo" onClick={onFechar}>
      <div className="mc-modal mc-modal-cat" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Categoria">
        <div className="mc-form-topo">
          <div className="mc-form-tit">{cat ? "Editar categoria" : "Nova categoria"}</div>
          <button className="mc-ib mc-ib-plano" aria-label="Fechar" onClick={onFechar}><X size={18} /></button>
        </div>
        <div className="mc-cat-prev">
          <CatIcone cat={{ icone, cor }} size={52} />
          <label className="mc-campo" style={{ flexGrow: 1 }}>
            <span className="mc-rot">Nome</span>
            <input className="mc-inp" value={nome} placeholder="Ex.: Mercado Livre" onChange={(e) => setNome(e.target.value)} />
          </label>
        </div>
        <div className="mc-campo">
          <span className="mc-rot">Desenho</span>
          <div className="mc-grade-ic">
            {Object.keys(ICONES).map((k) => (
              <button key={k} className={icone === k ? "on" : ""} style={icone === k ? { background: cor, borderColor: cor } : undefined} aria-label={`Desenho ${k}`} onClick={() => setIcone(k)}>
                <svg viewBox="0 0 24 24" width="22" height="22" dangerouslySetInnerHTML={{ __html: ICONES[k] }} />
              </button>
            ))}
          </div>
        </div>
        <div className="mc-campo">
          <span className="mc-rot">Cor</span>
          <div className="mc-grade-cor">
            {CORES.map((c) => (
              <button key={c} className={cor === c ? "on" : ""} style={{ background: c }} aria-label={`Cor ${c}`} onClick={() => setCor(c)} />
            ))}
          </div>
        </div>
        <div className="mc-form-bts">
          <button className="mc-btn-p" onClick={() => salvar()} disabled={!nome.trim()}><Check size={18} /> {cat ? "Salvar" : "Criar categoria"}</button>
        </div>
        {cat && (
          <div className="mc-cat-extra">
            <button className="mc-btn-s" onClick={() => salvar({ arquivada: !cat.arquivada })}>
              {cat.arquivada ? <><ArchiveRestore size={16} /> Desarquivar</> : <><Archive size={16} /> Arquivar (some das opções)</>}
            </button>
            {usos === 0 ? (
              <button className="mc-btn-fraco mc-perigo" onClick={() => onExcluir(cat)}><Trash2 size={16} /> Apagar categoria</button>
            ) : (
              <p className="mc-fraco mc-peq">Usada em {usos} {usos === 1 ? "lançamento" : "lançamentos"} — dá pra arquivar, mas não apagar.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Registro de atividades                                              */
/* ------------------------------------------------------------------ */

function TelaAtividades({ chave, catPorId, oculto, onVoltar, onFechar }) {
  const [res, setRes] = useState(null);
  const [feitos, setFeitos] = useState({});
  useEffect(() => {
    let vivo = true;
    lerHistorico(chave).then((r) => vivo && setRes(r));
    return () => { vivo = false; };
  }, [chave]);

  const dias = useMemo(() => {
    if (!res?.itens) return [];
    const g = [];
    for (const e of res.itens) {
      const d = new Date(e.quando);
      const k = hojeISO(d);
      if (!g.length || g[g.length - 1].k !== k) g.push({ k, itens: [] });
      g[g.length - 1].itens.push(e);
    }
    return g;
  }, [res]);

  const hoje = hojeISO();
  const ontem = hojeISO(new Date(Date.now() - 864e5));
  const rotDia = (k) => (k === hoje ? "Hoje · " : k === ontem ? "Ontem · " : "") + nomeDia(k);
  const hora = (q) => { const d = new Date(q); return `${p2(d.getHours())}h${p2(d.getMinutes())}`; };
  const valorTxt = (n) => (oculto ? "••••" : fmtValor(n));

  const campos = (l) => [
    ["Nome", l.desc],
    ["Valor", (l.tipo === "receita" ? "+" : "−") + valorTxt(l.valor)],
    ["Data", l.data ? l.data.split("-").reverse().join("/") : ""],
    ["Categoria", catPorId[l.catId]?.nome || "—"],
    [l.tipo === "receita" ? "Recebido" : "Pago", l.pago ? "Sim" : "Não"],
    ["Obs.", l.obs || "—"],
  ];

  return (
    <div className="mc-tela">
      <div className="mc-tela-in">
        <div className="mc-tela-topo">
          <button className="mc-ib" aria-label="Voltar" onClick={onFechar}><ChevronLeft size={20} /></button>
          <div style={{ flexGrow: 1 }}>
            <div className="mc-form-tit">Registro de atividades</div>
            <div className="mc-fraco mc-peq">Tudo que foi lançado, mudado ou apagado</div>
          </div>
        </div>
        <div className="mc-info"><ShieldCheck size={18} /><span>Guardado num cofre que o app não consegue apagar.</span></div>

        {!res && <div className="mc-vazio">Carregando…</div>}
        {res?.failed && (
          <div className="mc-vazio">Não consegui abrir o registro agora (sem internet, ou o cofre ainda não foi ativado).
            Suas alterações continuam guardadas no aparelho e vão pro cofre assim que der.</div>
        )}
        {res?.itens && res.itens.length === 0 && <div className="mc-vazio">Nada registrado ainda.</div>}

        {dias.map((g) => (
          <div key={g.k}>
            <div className="mc-dia">{rotDia(g.k)}</div>
            {g.itens.map((e, i) => {
              const [alvo, acao] = String(e.acao).split(":");
              const antes = Array.isArray(e.antes) ? e.antes : [];
              const depois = Array.isArray(e.depois) ? e.depois : [];
              const umParaUm = alvo === "lanc" && antes.length === 1 && depois.length === 1;
              const cor = acao === "apagou" ? "neg" : acao === "lancou" ? "pos" : acao === "desfez" ? "neutro" : "amarelo";
              const chaveEv = e.id || `${e.quando}-${i}`;
              return (
                <div key={chaveEv} className="mc-ev">
                  <div className="mc-ev-topo">
                    <span className={"mc-ev-ic " + cor}>
                      {acao === "apagou" ? <Trash2 size={17} /> : acao === "lancou" ? <Plus size={17} /> : acao === "desfez" ? <Undo2 size={17} /> : acao === "pagou" ? <ThumbsUp size={17} /> : <Pencil size={17} />}
                    </span>
                    <div>
                      <div className="mc-ev-t">{e.resumo}</div>
                      <div className="mc-fraco mc-peq">{hora(e.quando)}{e.aparelho ? ` · ${e.aparelho}` : ""}{e.pendente ? " · ainda no aparelho" : ""}</div>
                    </div>
                  </div>
                  {umParaUm && (
                    <div className="mc-ba">
                      {[["Antes", antes[0]], ["Depois", depois[0]]].map(([t, l], j) => {
                        const outro = j === 0 ? depois[0] : antes[0];
                        const co = campos(outro);
                        return (
                          <div key={t} className="mc-bx">
                            <div className={"mc-bx-rot" + (j ? " dep" : "")}>{t}</div>
                            {campos(l).map(([k, val], x) => (
                              <div key={k}>{k} <span className={j && val !== co[x][1] ? "mc-mudou" : ""}>{val}</span></div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {acao !== "foto" && (
                    feitos[chaveEv]
                      ? <div className="mc-fraco mc-peq"><Check size={14} /> Voltou como estava</div>
                      : <button className="mc-btn-s mc-btn-peq mc-voltar" onClick={() => { onVoltar(e); setFeitos((o) => ({ ...o, [chaveEv]: true })); }}>
                          <Undo2 size={15} /> {acao === "apagou" ? "Recuperar" : acao === "lancou" ? "Desfazer lançamento" : "Voltar como estava"}
                        </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
