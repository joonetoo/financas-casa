import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Plus, Trash2, ChevronRight, Home as HomeIcon, X, Check, Eye, EyeOff } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------ */
/* Persistência na nuvem (Supabase) — sincroniza entre notebook/celular */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = "https://oikbmfdlhvqesbgnmeky.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pa2JtZmRsaHZxZXNiZ25tZWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMjUxMTgsImV4cCI6MjEwNDgwMTExOH0.VRvyNxYyvkjNaBnKAsHqfDTZxSM8pd5W9k5ElqGeeF8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const storage = {
  // Importante: distingue "linha realmente não existe" (data null, sem error)
  // de "falha ao buscar" (error, ou exceção de rede) — os dois casos NÃO podem
  // ser tratados igual, senão uma instabilidade de rede vira "banco vazio" e
  // acaba sobrescrevendo dados reais com a semente/vazio (já aconteceu).
  async get(key) {
    try {
      const { data, error } = await supabase
        .from("app_data")
        .select("data")
        .eq("id", key)
        .maybeSingle();
      if (error) return { failed: true };
      if (!data) return { value: null };
      return { value: JSON.stringify(data.data) };
    } catch (e) {
      console.error("Falha ao carregar do Supabase", e);
      return { failed: true };
    }
  },
  async set(key, value) {
    try {
      const parsed = JSON.parse(value);
      const { error } = await supabase
        .from("app_data")
        .upsert({ id: key, data: parsed, updated_at: new Date().toISOString() });
      if (error) console.error("Falha ao salvar no Supabase", error);
    } catch (e) {
      console.error("Falha ao salvar no Supabase", e);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 10);

const fmt = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v) || 0
  );

const sumBy = (arr, key) =>
  (arr || []).reduce((acc, item) => acc + (Number(item[key]) || 0), 0);

/* ------------------------------------------------------------------ */
/* Categorias fixas do sistema (mantidas da planilha original)         */
/* ------------------------------------------------------------------ */

const CATS = [
  { key: "contasCasa", label: "Contas da casa", color: "#1B263B", icon: "contas", fixed: false, catalog: "contasCasaItems" },
  { key: "servicos", label: "Serviços & assinaturas", color: "#415A77", icon: "servicos", fixed: false, catalog: "servicosItems" },
  { key: "mercado", label: "Mercado", color: "#B98A4A", icon: "mercado", fixed: false },
  { key: "feira", label: "Feira da semana", color: "#778D7A", icon: "feira", fixed: false },
  { key: "combustivel", label: "Combustível / estacionamento", color: "#5C7C82", icon: "combustivel", fixed: false },
  { key: "meusGastos", label: "Meus gastos", color: "#A9727C", icon: "meusgastos", fixed: false },
  { key: "comprasCasa", label: "Compras da casa", color: "#A08A64", icon: "compras", fixed: false },
  { key: "investimentos", label: "Investimentos", color: "#6B5B73", icon: "investimentos", fixed: false },
];

const VAR_CATS = CATS.filter((c) => !c.fixed);

const PERSON_COLORS = { joel: "#1B263B", antonio: "#B98A4A" };

/* ------------------------------------------------------------------ */
/* Ícones das categorias (SVG inline, sem dependência externa)         */
/* ------------------------------------------------------------------ */

const CAT_ICON_PATHS = {
  contas: (
    <>
      <path d="M3 10.5 12 3l9 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  servicos: (
    <>
      <path d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M17 3v4h-4M7 21v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  mercado: (
    <>
      <path d="M5 8h14l-1.4 9.1a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),
  feira: (
    <>
      <path d="M12 21c-4-2-7-6-7-10a7 7 0 0 1 14 0c0 4-3 8-7 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <path d="M12 21V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),
  combustivel: (
    <>
      <path d="M6 20V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <path d="M4 20h11M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 0 3 0v-5l-2.5-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M7.5 5.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),
  meusgastos: (
    <>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  compras: (
    <>
      <path d="M5 9h14l-1.2 9.4a2 2 0 0 1-2 1.6H8.2a2 2 0 0 1-2-1.6L5 9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),
  investimentos: (
    <>
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="m7 15 3.5-4 3 2.5L18 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
};

function CatIcon({ name, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {CAT_ICON_PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Indicador deslizante (abas, meses, ano, categorias)                 */
/* ------------------------------------------------------------------ */

const SLIDE_TRANSITION =
  "transform .44s cubic-bezier(.66,.01,.24,1.02), width .44s cubic-bezier(.66,.01,.24,1.02), height .44s cubic-bezier(.66,.01,.24,1.02), opacity .2s ease";

function useSlider() {
  const itemRefs = useRef({});
  const firstRef = useRef(true);
  const [style, setStyle] = useState({ opacity: 0 });

  const registerItem = useCallback(
    (key) => (el) => {
      if (el) itemRefs.current[key] = el;
      else delete itemRefs.current[key];
    },
    []
  );

  const update = useCallback((activeKey, animate = true) => {
    const el = itemRefs.current[activeKey];
    if (!el) {
      setStyle((s) => ({ ...s, opacity: 0 }));
      return;
    }
    setStyle({
      opacity: 1,
      width: el.offsetWidth,
      height: el.offsetHeight,
      transform: `translate(${el.offsetLeft}px, ${el.offsetTop}px)`,
      transition: animate ? SLIDE_TRANSITION : "none",
    });
  }, []);

  const sync = useCallback(
    (activeKey) => {
      update(activeKey, !firstRef.current);
      firstRef.current = false;
    },
    [update]
  );

  return { registerItem, style, update, sync };
}

/* ------------------------------------------------------------------ */
/* Dados semente — extraídos da planilha "Contas do mês - Casa"        */
/* ------------------------------------------------------------------ */

const lump = (valor) => (valor > 0 ? [{ id: uid(), desc: "Total do mês", valor }] : []);

const emptyLanc = () =>
  VAR_CATS.reduce((acc, c) => {
    acc[c.key] = [];
    return acc;
  }, {});

function makeMonth({
  id,
  label,
  joel,
  antonio,
  contas,
  servicosArr,
  variaveis,
  orcamentos,
  servicosLancado = true,
  contasCasaLancado = true,
}) {
  const orc = orcamentos || {};
  const servicosTotal = servicosArr.reduce((acc, [, v]) => acc + v, 0);
  const contasCasaTotal = contas.reduce((acc, [, v]) => acc + v, 0);
  return {
    id,
    label,
    joel,
    antonio,
    contasCasaItems: contas.map(([name, valor]) => ({ id: uid(), name, valor })),
    servicosItems: servicosArr.map(([name, valor]) => ({ id: uid(), name, valor })),
    orcamentos: {
      servicos: orc.servicos ?? servicosTotal,
      mercado: orc.mercado ?? variaveis.mercado ?? 0,
      feira: orc.feira ?? variaveis.feira ?? 0,
      combustivel: orc.combustivel ?? variaveis.combustivel ?? 0,
      meusGastos: orc.meusGastos ?? variaveis.meusGastos ?? 0,
      comprasCasa: orc.comprasCasa ?? variaveis.comprasCasa ?? 0,
      investimentos: orc.investimentos ?? variaveis.investimentos ?? 0,
    },
    lancamentos: {
      ...emptyLanc(),
      contasCasa: contasCasaLancado ? lump(contasCasaTotal) : [],
      servicos: servicosLancado ? lump(servicosTotal) : [],
      mercado: lump(variaveis.mercado),
      feira: lump(variaveis.feira),
      combustivel: lump(variaveis.combustivel),
      meusGastos: lump(variaveis.meusGastos || 0),
      comprasCasa: lump(variaveis.comprasCasa || 0),
      investimentos: lump(variaveis.investimentos || 0),
    },
  };
}

const SEED_MONTHS = [
  makeMonth({
    id: "marco",
    label: "Março",
    joel: 3322.14,
    antonio: 1500.0,
    contas: [
      ["Aluguel", 1309.51],
      ["Condomínio", 482.27],
      ["Energia Copel", 103.78],
    ],
    servicosArr: [
      ["Youtube premium", 53.9],
      ["Nio Fibra", 130.0],
      ["Credpago", 117.94],
      ["Google Drive", 49.99],
      ["Fluke", 9.0],
      ["Plano celular Joel", 35.0],
      ["Academia", 199.9],
      ["Matrix energia", 204.61],
      ["Clube Aiqfome Joel", 12.9],
      ["Ifood Antonio", 7.95],
    ],
    variaveis: { mercado: 1595.39, feira: 400.0, combustivel: 110.0 },
  }),
  makeMonth({
    id: "abril",
    label: "Abril",
    joel: 3213.15,
    antonio: 1500.0,
    contas: [
      ["Aluguel", 1309.51],
      ["Condomínio", 519.15],
      ["Energia Copel", 117.06],
    ],
    servicosArr: [
      ["Youtube premium", 53.9],
      ["Nio Fibra", 130.0],
      ["Credpago", 117.94],
      ["Google Drive", 49.99],
      ["Fluke", 9.0],
      ["Academia", 199.9],
      ["Clube Aiqfome Joel", 12.9],
      ["Ifood Antonio", 7.95],
      ["Conectcar", 0.0],
      ["Seguro Carro", 160.86],
      ["Tim Pré Joel", 49.99],
    ],
    variaveis: { mercado: 1380.0, feira: 320.0, combustivel: 275.0 },
  }),
  makeMonth({
    id: "maio",
    label: "Maio",
    joel: 2936.74,
    antonio: 1500.0,
    contas: [
      ["Aluguel", 1309.51],
      ["Condomínio", 514.32],
      ["Energia Copel", 96.47],
      ["Matrix", 300.0],
    ],
    servicosArr: [
      ["Youtube premium", 53.9],
      ["Nio Fibra", 0.0],
      ["Credpago", 117.94],
      ["Google Drive", 49.9],
      ["Fluke", 9.0],
      ["Academia", 199.9],
      ["Clube Aiqfome Joel", 0.0],
      ["Ifood Antonio", 0.0],
      ["Seguro Carro", 160.86],
      ["Plano Cel Joel", 29.99],
    ],
    variaveis: { mercado: 1394.95, feira: 0.0, combustivel: 200.0 },
  }),
  makeMonth({
    id: "junho",
    label: "Junho",
    joel: 1599.26,
    antonio: 1550.0,
    contas: [
      ["Aluguel", 1309.51],
      ["Condomínio", 506.94],
      ["Energia Copel", 95.59],
      ["Energia Matrix", 202.42],
      ["Nio Fibra", 130.0],
    ],
    servicosArr: [
      ["Youtube premium", 53.9],
      ["Credpago", 117.94],
      ["Google Drive", 49.99],
      ["Fluke", 9.0],
      ["Academia", 199.9],
      ["Seguro Carro", 160.86],
      ["Plano Cel Joel", 29.99],
      ["Spotify DUO", 31.9],
      ["Amazon Prime (3 meses, dep. 19,90)", 9.9],
    ],
    variaveis: { mercado: 241.42, feira: 0.0, combustivel: 0.0 },
  }),
  makeMonth({
    id: "julho",
    label: "Julho",
    joel: 2504.77,
    antonio: 1500.0,
    contas: [
      ["Aluguel", 1309.51],
      ["Condomínio", 487.0],
      ["Energia Copel", 102.37],
      ["Energia Matrix", 200.0],
      ["Nio Fibra", 130.0],
    ],
    servicosArr: [
      ["Youtube premium", 53.9],
      ["Credpago", 117.94],
      ["Google Drive", 24.99],
      ["Fluke", 9.0],
      ["Academia", 199.9],
      ["Seguro Carro", 160.86],
      ["Plano Cel Joel", 29.9],
      ["Spotify DUO", 31.9],
      ["Amazon Prime (2 meses)", 9.9],
    ],
    variaveis: { mercado: 987.6, feira: 0.0, combustivel: 150.0, meusGastos: 603.46 },
  }),
  makeMonth({
    id: "agosto",
    label: "Agosto",
    joel: 3388.31,
    antonio: 1600.0,
    contas: [
      ["Aluguel", 1309.51],
      ["Condomínio", 503.82],
      ["Energia Copel", 126.6],
      ["Energia Matrix", 200.0],
      ["Nio Fibra", 130.0],
    ],
    servicosArr: [
      ["Youtube premium", 53.9],
      ["Credpago", 117.94],
      ["Google Drive", 0.0],
      ["Fluke", 9.0],
      ["Academia (depois 239,80)", 199.9],
      ["Seguro Carro", 160.86],
      ["Plano Cel Joel", 29.99],
      ["Spotify DUO", 31.9],
      ["Amazon Prime (2 meses, dep. 19,90)", 9.9],
      ["Plano Cel Antônio", 29.9],
    ],
    variaveis: { mercado: 1575.09, feira: 300.0, combustivel: 200.0 },
  }),
  makeMonth({
    id: "setembro",
    label: "Setembro",
    joel: 2987.71,
    antonio: 1583.22,
    contas: [
      ["Aluguel", 1309.51],
      ["Condomínio", 496.35],
      ["Energia Copel", 105.24],
      ["Energia Matrix", 196.74],
      ["Nio Fibra", 130.0],
    ],
    servicosArr: [
      ["Youtube premium", 53.9],
      ["Credpago", 117.94],
      ["Google Drive", 49.9],
      ["Fluke", 9.0],
      ["Academia", 239.8],
      ["Seguro Carro", 160.86],
      ["Plano Cel Joel", 29.99],
      ["Spotify DUO", 31.9],
      ["Amazon Prime (1 mês)", 9.9],
      ["Plano Cel Antônio", 29.9],
    ],
    variaveis: { mercado: 1200.0, feira: 200.0, combustivel: 200.0 },
    orcamentos: { mercado: 1200.0, feira: 200.0, combustivel: 200.0, meusGastos: 0 },
  }),
  makeMonth({
    id: "outubro",
    label: "Outubro",
    joel: 2987.71,
    antonio: 1583.22,
    contas: [
      ["Aluguel", 1309.51],
      ["Condomínio", 496.35],
      ["Energia Copel", 105.24],
      ["Energia Matrix", 196.74],
      ["Nio Fibra", 130.0],
    ],
    servicosArr: [
      ["Youtube premium", 53.9],
      ["Credpago", 117.94],
      ["Google Drive", 49.9],
      ["Fluke", 9.0],
      ["Academia", 239.8],
      ["Seguro Carro", 160.86],
      ["Plano Cel Joel", 29.99],
      ["Spotify DUO", 31.9],
      ["Amazon Prime (1 mês)", 9.9],
      ["Plano Cel Antônio", 29.9],
    ],
    variaveis: { mercado: 0, feira: 0, combustivel: 0 },
    orcamentos: { mercado: 1200.0, feira: 200.0, combustivel: 200.0, meusGastos: 0 },
    servicosLancado: false,
    contasCasaLancado: false,
  }),
];

const SEED_DATA = { anos: [{ id: "ano-2026", label: "2026", months: SEED_MONTHS }] };
const STORAGE_KEY = "financas-casa-data-v3";
const STORAGE_KEY_LEGACY = "financas-casa-data-v2";

// Backup diário rotativo: 1x por dia (por dia da semana, guarda até 7
// "fotos" recentes num id separado), sempre a partir de uma leitura que já
// deu certo (nunca de dado que caiu no fallback por falha de rede) — assim,
// se o salvamento principal algum dia sobrescrever algo errado, ainda dá
// pra puxar manualmente um desses backups no Supabase.
const BACKUP_DATE_FLAG = "fc-last-backup-date";
async function backupIfNeeded(goodData) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(BACKUP_DATE_FLAG) === today) return;
    const weekday = new Date().getDay();
    await storage.set(`${STORAGE_KEY}-backup-${weekday}`, JSON.stringify(goodData));
    localStorage.setItem(BACKUP_DATE_FLAG, today);
  } catch (e) {
    console.error("Falha ao gravar backup diário", e);
  }
}

const yearNow = () => String(new Date().getFullYear());

const blankAno = (label) => ({ id: uid(), label: label || yearNow(), months: [] });

/* ------------------------------------------------------------------ */
/* Pequenos componentes de UI                                          */
/* ------------------------------------------------------------------ */

function EditableAmount({ value, onCommit, align = "right", className = "", mask = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));

  useEffect(() => setDraft(String(value ?? 0)), [value]);

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(Number(draft) || 0);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.target.blur();
          if (e.key === "Escape") {
            setDraft(String(value ?? 0));
            setEditing(false);
          }
        }}
        className="fc-input fc-input-amount"
        style={{ textAlign: align }}
      />
    );
  }
  return (
    <button className={"fc-amount-btn fc-tabular " + className} onClick={() => setEditing(true)}>
      {mask ? "••••••" : fmt(value)}
    </button>
  );
}

function TabButton({ active, children, onClick, innerRef }) {
  return (
    <button ref={innerRef} className={"fc-tab" + (active ? " fc-tab-active" : "")} onClick={onClick}>
      {children}
    </button>
  );
}

function AnoSwitcher({
  data,
  activeAnoId,
  openAno,
  addingAno,
  setAddingAno,
  newAnoLabel,
  setNewAnoLabel,
  onConfirmAno,
  registerItem,
  sliderStyle,
}) {
  return (
    <nav className="fc-anos">
      <div className="fc-slide-pill" style={sliderStyle} />
      {data.anos.map((a) => (
        <button
          key={a.id}
          ref={registerItem(a.id)}
          className={"fc-ano-pill" + (a.id === activeAnoId ? " fc-ano-pill-active" : "")}
          onClick={() => openAno(a)}
        >
          {a.label}
        </button>
      ))}
      {addingAno ? (
        <span className="fc-add-month-form">
          <input
            autoFocus
            className="fc-input"
            placeholder="Ex: 2027"
            value={newAnoLabel}
            onChange={(e) => setNewAnoLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onConfirmAno(newAnoLabel)}
          />
          <button className="fc-icon-btn" onClick={() => onConfirmAno(newAnoLabel)} title="Adicionar">
            <ChevronRight size={16} />
          </button>
          <button className="fc-icon-btn" onClick={() => setAddingAno(false)} title="Cancelar">
            <X size={16} />
          </button>
        </span>
      ) : (
        <button className="fc-ano-pill fc-ano-pill-ghost" onClick={() => setAddingAno(true)}>
          <Plus size={12} /> ano
        </button>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* App principal                                                       */
/* ------------------------------------------------------------------ */

export default function FinancasCasa() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeAnoId, setActiveAnoId] = useState(null);
  const [activeMonthId, setActiveMonthId] = useState(null);
  const [activeTab, setActiveTab] = useState("resumo");
  const [activeCat, setActiveCat] = useState("mercado");
  const [addingMonth, setAddingMonth] = useState(false);
  const [newMonthLabel, setNewMonthLabel] = useState("");
  const [addingAno, setAddingAno] = useState(false);
  const [newAnoLabel, setNewAnoLabel] = useState("");
  const [lancDesc, setLancDesc] = useState("");
  const [lancValor, setLancValor] = useState("");
  const [confirmDeleteMonthId, setConfirmDeleteMonthId] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importArmed, setImportArmed] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [toast, setToast] = useState(null);
  const toastIdRef = useRef(0);

  const showToast = useCallback((msg, undoFn) => {
    const id = ++toastIdRef.current;
    setToast({ id, msg, undoFn });
    setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, 10000);
  }, []);
  const [hideValues, setHideValues] = useState(() => {
    try {
      return localStorage.getItem("fc-hide-values") === "1";
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("fc-hide-values", hideValues ? "1" : "0");
    } catch (e) {}
  }, [hideValues]);

  const money = useCallback((v) => (hideValues ? "••••••" : fmt(v)), [hideValues]);

  const tabSlider = useSlider();
  const yearSlider = useSlider();
  const monthSlider = useSlider();
  const chipSlider = useSlider();

  useLayoutEffect(() => {
    tabSlider.sync(activeTab);
  }, [activeTab]);
  useLayoutEffect(() => {
    yearSlider.sync(activeAnoId);
  }, [activeAnoId, data?.anos?.length]);
  useLayoutEffect(() => {
    monthSlider.sync(activeMonthId);
  }, [activeMonthId, activeAnoId, confirmDeleteMonthId]);
  useLayoutEffect(() => {
    chipSlider.sync(activeCat);
  }, [activeCat, activeTab]);

  const resyncSliders = useCallback(
    (animate = false) => {
      tabSlider.update(activeTab, animate);
      yearSlider.update(activeAnoId, animate);
      monthSlider.update(activeMonthId, animate);
      chipSlider.update(activeCat, animate);
    },
    [activeTab, activeAnoId, activeMonthId, activeCat]
  );

  useEffect(() => {
    window.addEventListener("resize", resyncSliders);
    return () => window.removeEventListener("resize", resyncSliders);
  }, [resyncSliders]);

  // a fonte (Sora/Manrope) carrega de forma assíncrona; se o indicador for
  // posicionado antes dela terminar, o texto muda de largura e o indicador
  // fica "preso" no lugar errado — recalcula assim que a fonte estiver pronta.
  useEffect(() => {
    const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    let alive = true;
    ready.then(() => {
      if (alive) resyncSliders(false);
    });
    return () => {
      alive = false;
    };
  }, [resyncSliders]);

  const openAno = (ano) => {
    setActiveAnoId(ano.id);
    setActiveMonthId(ano.months[ano.months.length - 1]?.id ?? null);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      // busca com algumas tentativas: uma instabilidade passageira de rede
      // não pode ser confundida com "banco vazio" (ver storage.get acima).
      let res = await storage.get(STORAGE_KEY);
      for (let tentativa = 0; res.failed && tentativa < 3; tentativa++) {
        await new Promise((r) => setTimeout(r, 800 * (tentativa + 1)));
        res = await storage.get(STORAGE_KEY);
      }
      if (!alive) return;
      if (res.failed) {
        setLoadError(true);
        return;
      }

      let finalData;
      if (res.value) {
        finalData = JSON.parse(res.value);
        backupIfNeeded(finalData);
      } else {
        const legacy = await storage.get(STORAGE_KEY_LEGACY);
        if (!alive) return;
        if (legacy.failed) {
          setLoadError(true);
          return;
        }
        if (legacy.value) {
          const old = JSON.parse(legacy.value);
          finalData = { anos: [{ id: uid(), label: yearNow(), months: old.months || [] }] };
        } else {
          finalData = SEED_DATA;
        }
      }
      if (!finalData.anos || finalData.anos.length === 0) finalData = SEED_DATA;
      setData(finalData);
      openAno(finalData.anos[finalData.anos.length - 1]);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Fila serializada de gravação: sem isso, edições rápidas em sequência
  // disparam vários upserts concorrentes e — numa rede instável — o mais
  // antigo pode terminar DEPOIS do mais novo e sobrescrever uma edição mais
  // recente com uma mais velha. Assim, só existe uma gravação em voo por
  // vez; se `data` mudar de novo enquanto ela está em andamento, a próxima
  // gravação dispara assim que a atual terminar, sempre com o estado mais
  // atual (dataRef), nunca em paralelo.
  const dataRef = useRef(data);
  dataRef.current = data;
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  const flushSave = useCallback(async () => {
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    try {
      await storage.set(STORAGE_KEY, JSON.stringify(dataRef.current), false);
    } catch (e) {
      console.error("Falha ao salvar", e);
    } finally {
      savingRef.current = false;
    }
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false;
      flushSave();
    }
  }, []);

  useEffect(() => {
    // só salva depois de uma leitura bem-sucedida (loaded) — nunca a partir
    // de um estado carregado após falha, pra não sobrescrever dados reais.
    if (!loaded || !data) return;
    flushSave();
  }, [data, loaded, flushSave]);

  // Se a aba for pra segundo plano ou fechar logo depois de uma edição,
  // garante que a gravação seja disparada imediatamente (nada de esperar o
  // próximo tick) — reduz a janela em que a última edição poderia se perder.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && loaded && data) flushSave();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [loaded, data, flushSave]);

  const activeAno = useMemo(
    () => data?.anos.find((a) => a.id === activeAnoId) || null,
    [data, activeAnoId]
  );

  const month = useMemo(
    () => activeAno?.months.find((m) => m.id === activeMonthId) || null,
    [activeAno, activeMonthId]
  );

  const updateMonth = useCallback((monthId, updater) => {
    setData((prev) => ({
      ...prev,
      anos: prev.anos.map((a) => ({
        ...a,
        months: a.months.map((m) => (m.id === monthId ? updater(m) : m)),
      })),
    }));
  }, []);

  const catalogTotal = useCallback(
    (m, listKey) => (m ? sumBy(m[listKey], "valor") : 0),
    []
  );

  const categoryTotal = useCallback((m, key) => {
    if (!m) return 0;
    return sumBy(m.lancamentos[key], "valor");
  }, []);

  const monthTotal = useCallback(
    (m) => CATS.reduce((acc, c) => acc + categoryTotal(m, c.key), 0),
    [categoryTotal]
  );

  const getOrcamento = useCallback(
    (m, key) => {
      if (key === "servicos") return catalogTotal(m, "servicosItems");
      if (key === "contasCasa") return catalogTotal(m, "contasCasaItems");
      return Number(m?.orcamentos?.[key]) || 0;
    },
    [catalogTotal]
  );
  const getResta = useCallback(
    (m, key) => getOrcamento(m, key) - categoryTotal(m, key),
    [getOrcamento, categoryTotal]
  );

  const plannedTotal = useCallback(
    (m, key) => {
      if (!m) return 0;
      return getOrcamento(m, key);
    },
    [getOrcamento]
  );

  const monthPlanned = useCallback(
    (m) => CATS.reduce((acc, c) => acc + plannedTotal(m, c.key), 0),
    [plannedTotal]
  );

  if (loadError) {
    return (
      <div className="fc-wrap fc-loading">
        <FcStyles />
        Não foi possível carregar seus dados. Verifique sua internet e
        recarregue a página — por segurança, nada será salvo até conseguir
        carregar corretamente.
        <div style={{ marginTop: 16 }}>
          <button className="fc-btn-primary" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (!loaded || !data || !activeAno) {
    return (
      <div className="fc-wrap fc-loading">
        <FcStyles />
        Carregando…
      </div>
    );
  }

  if (!month) {
    return (
      <div className="fc-wrap">
        <FcStyles />
        <AnoSwitcher
          data={data}
          activeAnoId={activeAnoId}
          openAno={openAno}
          addingAno={addingAno}
          setAddingAno={setAddingAno}
          newAnoLabel={newAnoLabel}
          setNewAnoLabel={setNewAnoLabel}
          onConfirmAno={(label) => confirmAddAno(label)}
          registerItem={yearSlider.registerItem}
          sliderStyle={yearSlider.style}
        />
        <div className="fc-empty-year">
          <p>O ano {activeAno.label} ainda não tem nenhum mês.</p>
          {addingMonth ? (
            <span className="fc-add-month-form">
              <input
                autoFocus
                className="fc-input"
                placeholder="Nome do mês"
                value={newMonthLabel}
                onChange={(e) => setNewMonthLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmAddMonth()}
              />
              <button className="fc-icon-btn" onClick={confirmAddMonth} title="Adicionar">
                <ChevronRight size={16} />
              </button>
            </span>
          ) : (
            <button className="fc-month-pill fc-month-pill-ghost" onClick={() => setAddingMonth(true)}>
              <Plus size={14} /> primeiro mês
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalGasto = monthTotal(month);
  const totalPrevisto = monthPlanned(month);
  const antonioValor = Number(month.antonio) || 0;
  const joelCalculado = totalPrevisto - antonioValor;
  const diferenca = totalPrevisto - totalGasto;

  /* ---------------- ações ---------------- */

  const addContasCasaItem = () =>
    updateMonth(month.id, (m) => ({
      ...m,
      contasCasaItems: [...m.contasCasaItems, { id: uid(), name: "Nova conta", valor: 0 }],
    }));

  const addServicoItem = () =>
    updateMonth(month.id, (m) => ({
      ...m,
      servicosItems: [...m.servicosItems, { id: uid(), name: "Nova assinatura", valor: 0 }],
    }));

  const removeItem = (list, id) => {
    const monthId = month.id;
    const idx = month[list].findIndex((i) => i.id === id);
    const removed = month[list][idx];
    updateMonth(monthId, (m) => ({ ...m, [list]: m[list].filter((i) => i.id !== id) }));
    if (removed) {
      showToast(`"${removed.name || "Item"}" excluído.`, () =>
        updateMonth(monthId, (m) => {
          const arr = [...m[list]];
          arr.splice(Math.min(idx, arr.length), 0, removed);
          return { ...m, [list]: arr };
        })
      );
    }
  };

  const editItem = (list, id, field, value) =>
    updateMonth(month.id, (m) => ({
      ...m,
      [list]: m[list].map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    }));

  const addLancamento = () => {
    const valor = Number(lancValor.replace(",", "."));
    if (!valor) return;
    addLancamentoDireto(activeCat, lancDesc || "Item sem descrição", valor);
    setLancDesc("");
    setLancValor("");
  };

  const addLancamentoDireto = (catKey, desc, valor) =>
    updateMonth(month.id, (m) => ({
      ...m,
      lancamentos: {
        ...m.lancamentos,
        [catKey]: [...m.lancamentos[catKey], { id: uid(), desc, valor }],
      },
    }));

  const removeLancamento = (catKey, id) => {
    const monthId = month.id;
    const idx = month.lancamentos[catKey].findIndex((i) => i.id === id);
    const removed = month.lancamentos[catKey][idx];
    updateMonth(monthId, (m) => ({
      ...m,
      lancamentos: {
        ...m.lancamentos,
        [catKey]: m.lancamentos[catKey].filter((i) => i.id !== id),
      },
    }));
    if (removed) {
      showToast(`"${removed.desc || "Lançamento"}" excluído.`, () =>
        updateMonth(monthId, (m) => {
          const arr = [...m.lancamentos[catKey]];
          arr.splice(Math.min(idx, arr.length), 0, removed);
          return { ...m, lancamentos: { ...m.lancamentos, [catKey]: arr } };
        })
      );
    }
  };

  const editLancamento = (catKey, id, field, value) =>
    updateMonth(month.id, (m) => ({
      ...m,
      lancamentos: {
        ...m.lancamentos,
        [catKey]: m.lancamentos[catKey].map((i) => (i.id === id ? { ...i, [field]: value } : i)),
      },
    }));

  const setPerson = (who, value) =>
    updateMonth(month.id, (m) => ({ ...m, [who]: value }));

  const setOrcamento = (catKey, value) =>
    updateMonth(month.id, (m) => ({
      ...m,
      orcamentos: { ...m.orcamentos, [catKey]: value },
    }));

  function confirmAddMonth() {
    const label = newMonthLabel.trim();
    if (!label) return;
    const anoIdx = data.anos.findIndex((a) => a.id === activeAnoId);
    const currentAno = data.anos[anoIdx];
    let source = currentAno.months[currentAno.months.length - 1];
    if (!source) {
      for (let i = anoIdx - 1; i >= 0 && !source; i--) {
        source = data.anos[i].months[data.anos[i].months.length - 1];
      }
    }
    const clone = source
      ? {
          id: uid(),
          label,
          joel: 0,
          antonio: 0,
          contasCasaItems: source.contasCasaItems.map((i) => ({ ...i, id: uid() })),
          servicosItems: source.servicosItems.map((i) => ({ ...i, id: uid() })),
          orcamentos: { ...source.orcamentos },
          lancamentos: emptyLanc(),
        }
      : {
          id: uid(),
          label,
          joel: 0,
          antonio: 0,
          contasCasaItems: [],
          servicosItems: [],
          orcamentos: { servicos: 0, mercado: 0, feira: 0, combustivel: 0, meusGastos: 0, comprasCasa: 0, investimentos: 0 },
          lancamentos: emptyLanc(),
        };
    setData((prev) => ({
      ...prev,
      anos: prev.anos.map((a) => (a.id === activeAnoId ? { ...a, months: [...a.months, clone] } : a)),
    }));
    setActiveMonthId(clone.id);
    setNewMonthLabel("");
    setAddingMonth(false);
    setActiveTab("resumo");
  }

  function deleteMonth(monthId) {
    const anoId = activeAnoId;
    const idx = activeAno.months.findIndex((m) => m.id === monthId);
    const removed = activeAno.months[idx];
    setData((prev) => ({
      ...prev,
      anos: prev.anos.map((a) =>
        a.id === anoId ? { ...a, months: a.months.filter((m) => m.id !== monthId) } : a
      ),
    }));
    if (monthId === activeMonthId) {
      const remaining = activeAno.months.filter((m) => m.id !== monthId);
      setActiveMonthId(remaining[remaining.length - 1]?.id ?? null);
    }
    setConfirmDeleteMonthId(null);
    if (removed) {
      showToast(`Mês "${removed.label}" excluído.`, () => {
        setData((prev) => ({
          ...prev,
          anos: prev.anos.map((a) => {
            if (a.id !== anoId) return a;
            const months = [...a.months];
            months.splice(Math.min(idx, months.length), 0, removed);
            return { ...a, months };
          }),
        }));
        setActiveMonthId(removed.id);
      });
    }
  }

  function confirmAddAno(label) {
    const clean = (label || "").trim();
    if (!clean) return;
    const novoAno = blankAno(clean);
    setData((prev) => ({ ...prev, anos: [...prev.anos, novoAno] }));
    openAno(novoAno);
    setNewAnoLabel("");
    setAddingAno(false);
  }

  function resetAll() {
    const previous = data;
    const previousAnoId = activeAnoId;
    const previousMonthId = activeMonthId;
    const fresh = { anos: [blankAno()] };
    setData(fresh);
    openAno(fresh.anos[0]);
    setConfirmReset(false);
    showToast("Todos os dados foram apagados.", () => {
      setData(previous);
      setActiveAnoId(previousAnoId);
      setActiveMonthId(previousMonthId);
    });
  }

  function exportJson() {
    return JSON.stringify(data, null, 2);
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportJson());
      setCopyFeedback("Copiado!");
    } catch (e) {
      setCopyFeedback("Não deu pra copiar automático — selecione o texto e copie manualmente.");
    }
    setTimeout(() => setCopyFeedback(""), 3000);
  }

  function applyImport() {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed || !Array.isArray(parsed.anos) || parsed.anos.length === 0) {
        throw new Error("formato inválido");
      }
      setData(parsed);
      openAno(parsed.anos[parsed.anos.length - 1]);
      setImportText("");
      setImportError("");
      setImportArmed(false);
      setShowImport(false);
    } catch (e) {
      setImportError("Esse texto não parece um export válido do app. Confira se colou tudo, do { até o } final.");
    }
  }

  /* ---------------- render ---------------- */

  return (
    <div className="fc-wrap">
      <FcStyles />

      <header className="fc-header">
        <div className="fc-brand">
          <span className="fc-brand-badge">
            <HomeIcon size={17} strokeWidth={2} />
          </span>
          <div>
            <div className="fc-brand-name">Contas da Casa</div>
            <div className="fc-subtitle">Joel &amp; Antonio</div>
          </div>
        </div>
        <button
          className="fc-icon-btn fc-hide-btn"
          title={hideValues ? "Mostrar valores" : "Esconder valores"}
          onClick={() => setHideValues((v) => !v)}
        >
          {hideValues ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </header>

      <AnoSwitcher
        data={data}
        activeAnoId={activeAnoId}
        openAno={openAno}
        addingAno={addingAno}
        setAddingAno={setAddingAno}
        newAnoLabel={newAnoLabel}
        setNewAnoLabel={setNewAnoLabel}
        onConfirmAno={confirmAddAno}
        registerItem={yearSlider.registerItem}
        sliderStyle={yearSlider.style}
      />

      <nav className="fc-months">
        <div className="fc-slide-pill" style={monthSlider.style} />
        {activeAno.months.map((m) => (
          <span
            key={m.id}
            ref={confirmDeleteMonthId === m.id ? null : monthSlider.registerItem(m.id)}
            className={"fc-month-pill-wrap" + (m.id === activeMonthId ? " fc-month-pill-wrap-active" : "")}
          >
            {confirmDeleteMonthId === m.id ? (
              <span className="fc-confirm-inline">
                <span className="fc-confirm-text">Excluir {m.label}?</span>
                <button
                  className="fc-icon-btn fc-icon-btn-danger"
                  title="Confirmar exclusão"
                  onClick={() => deleteMonth(m.id)}
                >
                  <Check size={13} />
                </button>
                <button
                  className="fc-icon-btn"
                  title="Cancelar"
                  onClick={() => setConfirmDeleteMonthId(null)}
                >
                  <X size={13} />
                </button>
              </span>
            ) : (
              <>
                <button
                  className={"fc-month-pill" + (m.id === activeMonthId ? " fc-month-pill-active" : "")}
                  onClick={() => setActiveMonthId(m.id)}
                >
                  {m.label}
                </button>
                <button
                  className="fc-month-del"
                  title={`Excluir ${m.label}`}
                  onClick={() => setConfirmDeleteMonthId(m.id)}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </span>
        ))}
        {addingMonth ? (
          <span className="fc-add-month-form">
            <input
              autoFocus
              className="fc-input"
              placeholder="Nome do mês"
              value={newMonthLabel}
              onChange={(e) => setNewMonthLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmAddMonth()}
            />
            <button className="fc-icon-btn" onClick={confirmAddMonth} title="Adicionar">
              <ChevronRight size={16} />
            </button>
            <button
              className="fc-icon-btn"
              onClick={() => setAddingMonth(false)}
              title="Cancelar"
            >
              <X size={16} />
            </button>
          </span>
        ) : (
          <button className="fc-month-pill fc-month-pill-ghost" onClick={() => setAddingMonth(true)}>
            <Plus size={14} /> mês
          </button>
        )}
      </nav>

      <nav className="fc-tabs">
        <div className="fc-slide-pill fc-slide-pill-tab" style={tabSlider.style} />
        <TabButton
          innerRef={tabSlider.registerItem("resumo")}
          active={activeTab === "resumo"}
          onClick={() => setActiveTab("resumo")}
        >
          Resumo
        </TabButton>
        <TabButton
          innerRef={tabSlider.registerItem("lancamentos")}
          active={activeTab === "lancamentos"}
          onClick={() => setActiveTab("lancamentos")}
        >
          Lançamentos
        </TabButton>
        <TabButton
          innerRef={tabSlider.registerItem("fixas")}
          active={activeTab === "fixas"}
          onClick={() => setActiveTab("fixas")}
        >
          Fixas &amp; assinaturas
        </TabButton>
        <TabButton
          innerRef={tabSlider.registerItem("comparativo")}
          active={activeTab === "comparativo"}
          onClick={() => setActiveTab("comparativo")}
        >
          Comparativo
        </TabButton>
      </nav>

      <main className="fc-main">
        {activeTab === "resumo" && (
          <div className="fc-hero-resumo fc-tab-content">
            {(() => {
              const pctUsado = totalPrevisto > 0 ? Math.min(100, (totalGasto / totalPrevisto) * 100) : 0;
              const r = 27;
              const circumference = 2 * Math.PI * r;
              const dashoffset = circumference * (1 - pctUsado / 100);
              return (
                <section className="fc-hero">
                  <span className="fc-hero-eyebrow">Ainda dá pra gastar em {month.label}</span>
                  <span className="fc-hero-number fc-tabular">{money(diferenca)}</span>
                  <span className="fc-hero-sub fc-tabular">
                    Previsto {money(totalPrevisto)} · Já gasto {money(totalGasto)}
                  </span>
                  <div className="fc-hero-gauge">
                    <div className="fc-ring-wrap">
                      <svg viewBox="0 0 64 64">
                        <circle className="fc-ring-track" cx="32" cy="32" r={r} />
                        <circle
                          className="fc-ring-fill"
                          cx="32"
                          cy="32"
                          r={r}
                          strokeDasharray={circumference}
                          strokeDashoffset={dashoffset}
                          transform="rotate(-90 32 32)"
                        />
                      </svg>
                    </div>
                    <div className="fc-ring-label">
                      <span className="fc-ring-pct">{Math.round(pctUsado)}% usado</span>
                      <span className="fc-ring-cap">do orçamento do mês</span>
                    </div>
                  </div>
                  <div className="fc-hero-chips">
                    <span className="fc-hero-chip">
                      <span className="fc-hero-avatar">J</span>
                      <span className="fc-hero-role">Joel (calc.)</span>
                      <span className="fc-hero-chip-value fc-tabular">{money(joelCalculado)}</span>
                    </span>
                    <span className="fc-hero-chip">
                      <span className="fc-hero-avatar">A</span>
                      <span className="fc-hero-role">Antonio</span>
                      <EditableAmount
                        value={month.antonio}
                        onCommit={(v) => setPerson("antonio", v)}
                        className="fc-hero-chip-value"
                        mask={hideValues}
                      />
                    </span>
                  </div>
                </section>
              );
            })()}
            <div className="fc-env-grid">
              {CATS.map((c) => {
                const gasto = categoryTotal(month, c.key);
                const orcamento = plannedTotal(month, c.key);
                const resta = orcamento - gasto;
                const pct = orcamento > 0 ? Math.min(100, (gasto / orcamento) * 100) : 0;
                return (
                  <div className="fc-env-card" key={c.key} style={{ "--cat": c.color }}>
                    <div className="fc-env-top">
                      <span className="fc-env-icon">
                        <CatIcon name={c.icon} />
                      </span>
                      <span className="fc-env-name">{c.label}</span>
                    </div>
                    <div className="fc-env-gauge">
                      <div className="fc-env-gauge-fill" style={{ width: pct + "%" }} />
                    </div>
                    <div className="fc-env-nums">
                      <span>
                        <span className="fc-env-spent fc-tabular">{money(gasto)}</span>
                        <span className="fc-env-budget fc-tabular">de {money(orcamento)}</span>
                      </span>
                      <span
                        className="fc-env-left fc-tabular"
                        style={{ color: resta < 0 ? "var(--neg)" : "var(--pos)" }}
                      >
                        {resta < 0 ? "" : "+"}
                        {money(resta)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="fc-ledger-row fc-ledger-total fc-hero-resumo-total">
              <span>Total previsto do mês</span>
              <span className="fc-tabular">{money(totalPrevisto)}</span>
            </div>
          </div>
        )}

        {activeTab === "lancamentos" && (
          <div className="fc-tab-content">
            <div className="fc-cat-chips">
              <div className="fc-slide-pill" style={chipSlider.style} />
              {VAR_CATS.map((c) => (
                <button
                  key={c.key}
                  ref={chipSlider.registerItem(c.key)}
                  className={"fc-chip" + (activeCat === c.key ? " fc-chip-active" : "")}
                  style={{ "--cat": c.color }}
                  onClick={() => setActiveCat(c.key)}
                >
                  <span className="fc-chip-icon">
                    <CatIcon name={c.icon} size={13} />
                  </span>
                  {c.label}
                </button>
              ))}
            </div>

            <div className="fc-lanc-layout">
            <div className="fc-lanc-side">
            {(() => {
              const orcamento = getOrcamento(month, activeCat);
              const gasto = categoryTotal(month, activeCat);
              const resta = orcamento - gasto;
              const pct = orcamento > 0 ? Math.min(100, (gasto / orcamento) * 100) : 0;
              const barColor = pct >= 100 ? "var(--neg)" : pct >= 80 ? "var(--warn)" : "var(--accent)";
              return (
                <div className="fc-budget-panel">
                  <div className="fc-budget-row">
                    <span className="fc-budget-item">
                      <span className="fc-budget-label">Orçamento</span>
                      <span className="fc-tabular fc-amount-computed">{money(orcamento)}</span>
                    </span>
                    <span className="fc-budget-item">
                      <span className="fc-budget-label">Gasto</span>
                      <span className="fc-tabular">{money(gasto)}</span>
                    </span>
                    <span className="fc-budget-item">
                      <span className="fc-budget-label">Resta</span>
                      <span
                        className="fc-tabular"
                        style={{ color: resta < 0 ? "var(--neg)" : "var(--pos)", fontWeight: 600 }}
                      >
                        {money(resta)}
                      </span>
                    </span>
                  </div>
                  <div className="fc-progress-track">
                    <div
                      className="fc-progress-fill"
                      style={{ width: pct + "%", background: barColor }}
                    />
                  </div>
                  <p className="fc-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                    Orçamento definido em Fixas &amp; assinaturas.
                  </p>
                </div>
              );
            })()}
            </div>
            <div className="fc-lanc-main">

            {(() => {
              const catDef = CATS.find((c) => c.key === activeCat);
              if (!catDef?.catalog) return null;
              const jaLancados = new Set((month.lancamentos[activeCat] || []).map((l) => l.desc));
              const pendentes = (month[catDef.catalog] || []).filter(
                (item) => !jaLancados.has(item.name) && item.valor > 0
              );
              if (pendentes.length === 0) return null;
              return (
                <div className="fc-quickadd">
                  <span className="fc-quickadd-label">Ainda não lançados:</span>
                  <div className="fc-cat-chips">
                    {pendentes.map((item) => (
                      <button
                        key={item.id}
                        className="fc-chip fc-chip-quickadd"
                        onClick={() => addLancamentoDireto(activeCat, item.name, item.valor)}
                      >
                        <Plus size={12} /> {item.name} · {money(item.valor)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="fc-add-row">
              <input
                className="fc-input fc-input-grow"
                placeholder="Descrição (ex: compra da semana)"
                value={lancDesc}
                onChange={(e) => setLancDesc(e.target.value)}
              />
              <input
                className="fc-input"
                placeholder="R$ 0,00"
                value={lancValor}
                onChange={(e) => setLancValor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLancamento()}
                style={{ width: 120 }}
              />
              <button className="fc-icon-btn fc-icon-btn-solid" onClick={addLancamento}>
                <Plus size={16} />
              </button>
            </div>

            <div className="fc-ledger" style={{ marginTop: 12 }}>
              {(month.lancamentos[activeCat] || []).length === 0 && (
                <p className="fc-empty">Nenhum lançamento em {month.label.toLowerCase()} ainda.</p>
              )}
              {(month.lancamentos[activeCat] || []).map((item) => (
                <div className="fc-row fc-ledger-row" key={item.id}>
                  <input
                    className="fc-input fc-input-plain"
                    value={item.desc}
                    onChange={(e) => editLancamento(activeCat, item.id, "desc", e.target.value)}
                  />
                  <span className="fc-row-right">
                    <EditableAmount
                      value={item.valor}
                      onCommit={(v) => editLancamento(activeCat, item.id, "valor", v)}
                      mask={hideValues}
                    />
                    <button
                      className="fc-icon-btn fc-icon-btn-trash"
                      onClick={() => removeLancamento(activeCat, item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              ))}
              {(month.lancamentos[activeCat] || []).length > 0 && (
                <div className="fc-ledger-row fc-ledger-total">
                  <span>Subtotal</span>
                  <span className="fc-tabular">{money(categoryTotal(month, activeCat))}</span>
                </div>
              )}
            </div>
            </div>
            </div>
          </div>
        )}

        {activeTab === "fixas" && (
          <div className="fc-tab-content">
          <div className="fc-fixas-grid">
            <div className="fc-fixas-card">
              <div className="fc-section-title">
                <span className="fc-section-title-with-icon">
                  <span className="fc-env-icon fc-env-icon-sm" style={{ "--cat": "#1B263B" }}>
                    <CatIcon name="contas" size={13} />
                  </span>
                  Contas da casa
                </span>
                <button className="fc-icon-btn" onClick={addContasCasaItem}>
                  <Plus size={14} />
                </button>
              </div>
              <p className="fc-hint">
                Esse é o catálogo das contas fixas. Para marcar o que já foi pago, use a aba
                Lançamentos → Contas da casa.
              </p>
              <div className="fc-ledger">
                {month.contasCasaItems.map((item) => (
                  <div className="fc-row fc-ledger-row" key={item.id}>
                    <input
                      className="fc-input fc-input-plain"
                      value={item.name}
                      onChange={(e) => editItem("contasCasaItems", item.id, "name", e.target.value)}
                    />
                    <span className="fc-row-right">
                      <EditableAmount
                        value={item.valor}
                        onCommit={(v) => editItem("contasCasaItems", item.id, "valor", v)}
                        mask={hideValues}
                      />
                      <button
                        className="fc-icon-btn fc-icon-btn-trash"
                        onClick={() => removeItem("contasCasaItems", item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </div>
                ))}
                <div className="fc-ledger-row fc-ledger-total">
                  <span>Subtotal</span>
                  <span className="fc-tabular">{money(catalogTotal(month, "contasCasaItems"))}</span>
                </div>
              </div>
            </div>

            <div className="fc-fixas-card">
              <div className="fc-section-title">
                <span className="fc-section-title-with-icon">
                  <span className="fc-env-icon fc-env-icon-sm" style={{ "--cat": "#415A77" }}>
                    <CatIcon name="servicos" size={13} />
                  </span>
                  Serviços &amp; assinaturas
                </span>
                <button className="fc-icon-btn" onClick={addServicoItem}>
                  <Plus size={14} />
                </button>
              </div>
              <p className="fc-hint">
                Esse é o catálogo de assinaturas. Para marcar o que já caiu no cartão, use a aba
                Lançamentos → Serviços.
              </p>
              <div className="fc-ledger">
                {month.servicosItems.map((item) => (
                  <div className="fc-row fc-ledger-row" key={item.id}>
                    <input
                      className="fc-input fc-input-plain"
                      value={item.name}
                      onChange={(e) => editItem("servicosItems", item.id, "name", e.target.value)}
                    />
                    <span className="fc-row-right">
                      <EditableAmount
                        value={item.valor}
                        onCommit={(v) => editItem("servicosItems", item.id, "valor", v)}
                        mask={hideValues}
                      />
                      <button
                        className="fc-icon-btn fc-icon-btn-trash"
                        onClick={() => removeItem("servicosItems", item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </div>
                ))}
                <div className="fc-ledger-row fc-ledger-total">
                  <span>Subtotal</span>
                  <span className="fc-tabular">{money(catalogTotal(month, "servicosItems"))}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="fc-orcamentos-section">
            <div className="fc-section-title">
              <span>Orçamentos do mês (Mercado, Feira, Combustível...)</span>
            </div>
            <div className="fc-fixas-card">
              <p className="fc-hint" style={{ marginBottom: 12 }}>
                Reserve aqui quanto pretende gastar em cada categoria variável. Esse valor aparece
                automaticamente em Lançamentos, junto com o que já foi gasto.
              </p>
              <div className="fc-ledger">
                {VAR_CATS.filter((c) => !c.catalog).map((c) => (
                  <div className="fc-row fc-ledger-row" key={c.key} style={{ "--cat": c.color }}>
                    <span className="fc-cat-name">
                      <span className="fc-env-icon fc-env-icon-sm">
                        <CatIcon name={c.icon} size={13} />
                      </span>
                      {c.label}
                    </span>
                    <span className="fc-row-right">
                      <EditableAmount
                        value={getOrcamento(month, c.key)}
                        onCommit={(v) => setOrcamento(c.key, v)}
                        mask={hideValues}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        )}

        {activeTab === "comparativo" && (
          <div className="fc-tab-content">
            <p className="fc-section-title" style={{ marginBottom: 4 }}>
              <span>Gastos por categoria, mês a mês</span>
            </p>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={activeAno.months.map((m) => ({
                  name: m.label,
                  ...CATS.reduce((acc, c) => {
                    acc[c.label] = categoryTotal(m, c.key);
                    return acc;
                  }, {}),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--ink-soft)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--ink-soft)", fontSize: 12 }} />
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {CATS.map((c) => (
                    <Bar key={c.key} dataKey={c.label} stackId="a" fill={c.color} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="fc-section-title" style={{ marginTop: 28, marginBottom: 4 }}>
              <span>Joel × Antonio — contribuição mensal</span>
            </p>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart
                  data={activeAno.months.map((m) => ({
                    name: m.label,
                    Joel: monthPlanned(m) - (Number(m.antonio) || 0),
                    Antonio: m.antonio,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--ink-soft)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--ink-soft)", fontSize: 12 }} />
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Joel" fill={PERSON_COLORS.joel} />
                  <Bar dataKey="Antonio" fill={PERSON_COLORS.antonio} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>

      <div className="fc-data-zone">
        <div className="fc-data-buttons">
          <button
            className="fc-data-link"
            onClick={() => {
              setShowExport((s) => !s);
              setShowImport(false);
            }}
          >
            Exportar dados
          </button>
          <span className="fc-data-sep">·</span>
          <button
            className="fc-data-link"
            onClick={() => {
              setShowImport((s) => !s);
              setShowExport(false);
            }}
          >
            Importar dados
          </button>
        </div>
        <p className="fc-hint" style={{ textAlign: "center" }}>
          Use isso pra levar seus dados de um link publicado pro outro, sempre que eu atualizar o
          app: exporte aqui, publique a nova versão, e importe lá.
        </p>

        {showExport && (
          <div className="fc-data-panel">
            <textarea readOnly className="fc-data-textarea" value={exportJson()} onFocus={(e) => e.target.select()} />
            <div className="fc-data-panel-actions">
              <button className="fc-icon-btn fc-icon-btn-solid" onClick={copyExport}>
                Copiar tudo
              </button>
              {copyFeedback && <span className="fc-hint" style={{ margin: 0 }}>{copyFeedback}</span>}
            </div>
          </div>
        )}

        {showImport && (
          <div className="fc-data-panel">
            <textarea
              className="fc-data-textarea"
              placeholder="Cole aqui o texto que você copiou em Exportar dados..."
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportArmed(false);
                setImportError("");
              }}
            />
            {importError && (
              <p className="fc-hint" style={{ color: "var(--neg)" }}>
                {importError}
              </p>
            )}
            <div className="fc-data-panel-actions">
              {importArmed ? (
                <span className="fc-confirm-inline">
                  <span className="fc-confirm-text">Substituir os dados atuais por esse import?</span>
                  <button className="fc-icon-btn fc-icon-btn-danger" onClick={applyImport} title="Confirmar">
                    <Check size={13} />
                  </button>
                  <button className="fc-icon-btn" onClick={() => setImportArmed(false)} title="Cancelar">
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <button
                  className="fc-icon-btn fc-icon-btn-solid"
                  onClick={() => (importText.trim() ? setImportArmed(true) : null)}
                >
                  Importar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="fc-danger-zone">
        {confirmReset ? (
          <span className="fc-confirm-inline fc-confirm-inline-center">
            <span className="fc-confirm-text">
              Apagar TODOS os anos, meses e lançamentos salvos? Não dá pra desfazer.
            </span>
            <button className="fc-danger-btn" onClick={resetAll}>
              Sim, apagar tudo
            </button>
            <button className="fc-icon-btn" onClick={() => setConfirmReset(false)}>
              Cancelar
            </button>
          </span>
        ) : (
          <button className="fc-danger-link" onClick={() => setConfirmReset(true)}>
            Apagar todos os dados e começar do zero
          </button>
        )}
      </div>

      {toast && (
        <div className="fc-toast">
          <span>{toast.msg}</span>
          {toast.undoFn && (
            <button
              className="fc-toast-undo"
              onClick={() => {
                toast.undoFn();
                setToast(null);
              }}
            >
              Desfazer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Estilos                                                              */
/* ------------------------------------------------------------------ */

function FcStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');

      .fc-wrap {
        color-scheme: dark;
        --bg: #0D1512;
        --surface: #161F1A;
        --surface-2: #1D2921;
        --ink: #EAF2EC;
        --ink-soft: #B3C4BA;
        --ink-faint: #7E9086;
        --line: #293830;
        --accent: #4CC38A;
        --accent-deep: #092018;
        --accent-bright: #7CE0AC;
        --pos: #4CC38A;
        --neg: #E39478;
        --neg-soft: #3A2620;
        --warn: #D9A55D;
        --hero-1: #072118;
        --hero-2: #125038;
        --hero-glow: #2C8A61;
        --hero-ink: #FFFFFF;
        --hero-sub: #C3DFD0;
        --shadow-sm: 0 1px 2px rgba(0,0,0,.4);
        --shadow-md: 0 10px 24px -10px rgba(0,0,0,.55);
        --shadow-lg: 0 26px 52px -18px rgba(0,0,0,.7);
        --ease: cubic-bezier(.22,.9,.32,1);
        --ease-slide: cubic-bezier(.66,.01,.24,1.02);

        background: var(--bg);
        color: var(--ink);
        font-family: 'Manrope', sans-serif;
        font-weight: 500;
        border-radius: 18px;
        padding: 24px;
        max-width: 1180px;
        margin: 0 auto;
      }
      @media (prefers-reduced-motion: reduce) {
        .fc-wrap *, .fc-wrap *::before, .fc-wrap *::after {
          animation-duration: .001ms !important; transition-duration: .001ms !important;
        }
      }

      .fc-wrap h1, .fc-wrap h2, .fc-wrap h3, .fc-serif { font-family: 'Sora', sans-serif; }
      .fc-wrap button, .fc-wrap input, .fc-wrap textarea { font-family: 'Manrope', sans-serif; font-weight: 500; }
      .fc-loading { text-align: center; padding: 60px 0; color: var(--ink-soft); max-width: 420px; margin: 0 auto; }
      .fc-btn-primary { background: var(--accent); color: var(--accent-deep); border: none; border-radius: 999px; padding: 10px 22px; font-weight: 700; cursor: pointer; transition: transform .15s var(--ease), box-shadow .15s var(--ease); }
      .fc-btn-primary:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

      .fc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 10px; }
      .fc-brand { display: flex; align-items: center; gap: 10px; }
      .fc-brand-badge {
        width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
        background: linear-gradient(145deg, var(--hero-2), var(--accent)); color: #fff;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .fc-brand-name { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; }
      .fc-subtitle { color: var(--ink-soft); font-size: 12px; margin-top: 1px; font-weight: 500; }
      .fc-hide-btn { flex-shrink: 0; }

      /* -------- indicador deslizante (abas, meses, ano, categorias) -------- */
      .fc-anos, .fc-months, .fc-tabs, .fc-cat-chips { position: relative; }
      .fc-anos > *, .fc-months > *, .fc-tabs > *, .fc-cat-chips > * { position: relative; z-index: 1; }
      .fc-slide-pill {
        position: absolute; top: 0; left: 0; z-index: 0; pointer-events: none;
        border-radius: 999px; background: var(--ink);
        transition: transform .44s var(--ease-slide), width .44s var(--ease-slide), height .44s var(--ease-slide), opacity .2s ease;
        will-change: transform, width;
      }
      .fc-slide-pill-tab { background: var(--surface); box-shadow: var(--shadow-sm); border-radius: 14px; }

      .fc-months {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
        padding-bottom: 12px; margin-bottom: 16px;
      }
      .fc-month-pill {
        border: none; background: transparent; color: var(--ink-soft);
        padding: 9px 11px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer;
        font-family: inherit; transition: color .3s var(--ease-slide);
      }
      .fc-month-pill-active { color: var(--bg); }
      .fc-month-pill-ghost {
        display: inline-flex; align-items: center; gap: 4px; border: 1px dashed var(--line); background: transparent;
        color: var(--ink-faint); padding: 9px 14px; transition: border-color .15s ease, color .15s ease;
      }
      .fc-month-pill-ghost:hover { border-color: var(--accent); color: var(--accent); }
      .fc-add-month-form { display: inline-flex; align-items: center; gap: 4px; }

      .fc-month-pill-wrap {
        display: inline-flex; align-items: center; gap: 2px; border: 1px solid var(--line);
        border-radius: 999px; padding: 3px; transition: border-color .3s var(--ease-slide), transform .15s var(--ease), box-shadow .15s var(--ease);
      }
      .fc-month-pill-wrap:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
      .fc-month-pill-wrap-active { border-color: var(--ink); }
      .fc-month-del {
        width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; border: none;
        background: transparent; color: var(--ink-faint); cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
        transition: background-color .18s var(--ease), color .18s var(--ease), transform .12s var(--ease);
      }
      .fc-month-pill-wrap-active .fc-month-del { color: color-mix(in srgb, var(--bg) 70%, transparent); }
      .fc-month-del:hover { background: var(--neg-soft); color: var(--neg); }
      .fc-month-pill-wrap-active .fc-month-del:hover { background: color-mix(in srgb, var(--neg) 88%, transparent); color: #fff; }
      .fc-month-del:active { transform: scale(.88); }

      .fc-hero {
        position: relative; overflow: hidden;
        background:
          radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--hero-glow) 55%, transparent), transparent 62%),
          linear-gradient(155deg, var(--hero-1) 0%, var(--hero-2) 82%);
        color: var(--hero-ink);
        border-radius: 28px; padding: 22px;
        display: flex; flex-direction: column; gap: 16px;
        box-shadow: var(--shadow-lg);
      }
      .fc-hero-eyebrow {
        font-size: 12px; font-weight: 700; letter-spacing: .03em;
        color: var(--hero-sub);
      }
      .fc-hero-number { font-family: 'Sora', sans-serif; font-size: 36px; font-weight: 800; line-height: 1.05; }
      .fc-hero-sub { font-size: 12.5px; color: var(--hero-sub); font-weight: 500; }
      .fc-hero-chips { display: flex; gap: 8px; margin-top: auto; flex-wrap: wrap; }
      .fc-hero-chip {
        flex: 1; display: flex; align-items: center; gap: 7px;
        background: rgba(0,0,0,.22); border: 1px solid rgba(255,255,255,.16);
        padding: 6px 12px 6px 6px; border-radius: 999px; font-size: 12px; font-weight: 700;
        transition: background-color .18s var(--ease), border-color .18s var(--ease);
      }
      .fc-hero-chip:hover { background: rgba(0,0,0,.3); border-color: rgba(255,255,255,.3); }
      .fc-hero-avatar {
        width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
        background: rgba(255,255,255,.28); display: inline-flex; align-items: center; justify-content: center;
        font-size: 10px; font-weight: 800; color: #fff;
      }
      .fc-hero-role { color: #FFFFFF; font-weight: 700; }
      .fc-hero-chip-value { font-weight: 700 !important; color: var(--hero-ink) !important; font-size: 12.5px !important; padding: 0 !important; }
      .fc-amount-computed { color: inherit; }

      .fc-hero-gauge { display: flex; align-items: center; gap: 14px; }
      .fc-ring-wrap { position: relative; width: 64px; height: 64px; flex-shrink: 0; }
      .fc-ring-wrap svg { width: 100%; height: 100%; }
      .fc-ring-track { fill: none; stroke: rgba(255,255,255,.16); stroke-width: 6; }
      .fc-ring-fill { fill: none; stroke: var(--accent-bright); stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 0.6s var(--ease); }
      .fc-ring-label { display: flex; flex-direction: column; }
      .fc-ring-pct { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 15px; }
      .fc-ring-cap { font-size: 11px; color: var(--hero-sub); font-weight: 500; }

      .fc-tabs {
        display: flex; gap: 3px; margin-bottom: 16px; flex-wrap: wrap;
        background: var(--surface-2); padding: 5px; border-radius: 18px;
      }
      .fc-tab {
        border: none; background: transparent; color: var(--ink-soft); font-size: 12.5px; font-weight: 700;
        padding: 10px 6px; cursor: pointer; font-family: inherit; border-radius: 14px; flex: 1;
        min-height: 40px; transition: color .3s var(--ease-slide), transform .15s var(--ease);
      }
      .fc-tab:hover:not(.fc-tab-active) { color: var(--ink); }
      .fc-tab:active { transform: scale(.98); }
      .fc-tab-active { color: var(--ink); }
      @media (max-width: 699px) { .fc-tabs { display: grid; grid-template-columns: repeat(2, 1fr); } }

      .fc-tab-content { animation: fcTabIn .4s var(--ease-slide); }
      @keyframes fcTabIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      @media (prefers-reduced-motion: reduce) { .fc-tab-content { animation: none; } }

      .fc-hero-resumo { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
      @media (min-width: 900px) { .fc-hero-resumo { grid-template-columns: 360px 1fr; } }
      .fc-hero-resumo-total { grid-column: 1 / -1; }

      .fc-env-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
      @media (min-width: 560px) { .fc-env-grid { grid-template-columns: repeat(3, 1fr); } }
      .fc-env-card {
        background: var(--surface); border-radius: 26px; padding: 16px;
        box-shadow: var(--shadow-sm); border: 1px solid var(--line);
        display: flex; flex-direction: column; gap: 9px; min-height: 128px;
        transition: transform .22s var(--ease), box-shadow .22s var(--ease), border-color .22s var(--ease);
        opacity: 0; animation: fcFadeUp .65s var(--ease) forwards;
      }
      .fc-env-card:hover { transform: translateY(-7px) scale(1.015); box-shadow: var(--shadow-md); border-color: transparent; }
      .fc-env-card:nth-child(1) { animation-delay: .03s; } .fc-env-card:nth-child(2) { animation-delay: .09s; }
      .fc-env-card:nth-child(3) { animation-delay: .15s; } .fc-env-card:nth-child(4) { animation-delay: .21s; }
      .fc-env-card:nth-child(5) { animation-delay: .27s; } .fc-env-card:nth-child(6) { animation-delay: .33s; }
      .fc-env-card:nth-child(7) { animation-delay: .39s; } .fc-env-card:nth-child(8) { animation-delay: .45s; }
      @keyframes fcFadeUp { from { opacity: 0; transform: translateY(22px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @media (prefers-reduced-motion: reduce) { .fc-env-card { opacity: 1; animation: none; } }
      .fc-env-top { display: flex; align-items: center; gap: 8px; }
      .fc-env-icon {
        --cat-on: color-mix(in srgb, var(--cat, var(--accent)), var(--ink) 42%);
        width: 28px; height: 28px; border-radius: 10px; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        background: color-mix(in srgb, var(--cat-on) 20%, var(--surface));
        color: var(--cat-on);
      }
      .fc-env-icon-sm { width: 24px; height: 24px; border-radius: 8px; }
      .fc-env-name { font-weight: 700; font-size: 12.5px; line-height: 1.2; }
      .fc-env-gauge { height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
      .fc-env-gauge-fill {
        --cat-on: color-mix(in srgb, var(--cat, var(--accent)), var(--ink) 42%);
        height: 100%; border-radius: 999px; background: var(--cat-on); transition: width 0.5s var(--ease);
      }
      .fc-env-nums { display: flex; justify-content: space-between; align-items: baseline; margin-top: auto; }
      .fc-env-spent { font-size: 14px; font-weight: 700; font-family: 'Sora', sans-serif; display: block; }
      .fc-env-budget { font-size: 10.5px; color: var(--ink-faint); font-weight: 600; display: block; }
      .fc-env-left { font-size: 11px; font-weight: 700; }

      .fc-section-title-with-icon { display: flex; align-items: center; gap: 8px; }

      .fc-ledger { display: flex; flex-direction: column; }
      .fc-ledger-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 9px 6px; font-size: 13.5px; border-radius: 11px;
        transition: background-color .15s var(--ease);
        opacity: 0; animation: fcFadeUp .4s var(--ease) forwards;
      }
      .fc-ledger-row:hover { background: var(--surface-2); }
      .fc-ledger-row:nth-child(1) { animation-delay: .02s; } .fc-ledger-row:nth-child(2) { animation-delay: .05s; }
      .fc-ledger-row:nth-child(3) { animation-delay: .08s; } .fc-ledger-row:nth-child(4) { animation-delay: .11s; }
      .fc-ledger-row:nth-child(5) { animation-delay: .14s; } .fc-ledger-row:nth-child(6) { animation-delay: .17s; }
      .fc-ledger-row.fc-ledger-total { opacity: 1; animation: none; }
      @media (prefers-reduced-motion: reduce) { .fc-ledger-row { opacity: 1; animation: none; } }
      .fc-anos { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 10px; }
      .fc-ano-pill {
        border: 1px solid var(--line); background: transparent; color: var(--ink-soft);
        padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit;
        transition: color .3s var(--ease-slide), border-color .3s var(--ease-slide), transform .15s var(--ease);
      }
      .fc-ano-pill:hover:not(.fc-ano-pill-active) { border-color: var(--accent); color: var(--ink); transform: translateY(-1px); }
      .fc-ano-pill-active { color: var(--bg); border-color: var(--ink); }
      .fc-ano-pill-ghost { display: inline-flex; align-items: center; gap: 2px; border-style: dashed; }

      .fc-empty-year {
        display: flex; flex-direction: column; align-items: flex-start; gap: 12px;
        padding: 40px 4px; color: var(--ink-soft);
      }

      .fc-quickadd { margin-top: 14px; }
      .fc-quickadd-label { font-size: 11.5px; color: var(--ink-faint); display: block; margin-bottom: 6px; font-weight: 600; }
      .fc-chip-quickadd { display: inline-flex; align-items: center; gap: 3px; }

      .fc-hint { font-size: 11.5px; color: var(--ink-faint); margin: 0 0 8px; font-weight: 500; }

      .fc-confirm-inline {
        display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
        background: var(--surface); border: 1px solid var(--neg); border-radius: 999px; padding: 3px 6px 3px 10px;
      }
      .fc-confirm-inline-center {
        flex-wrap: wrap; justify-content: center; border-radius: 12px; padding: 10px 14px; gap: 10px;
      }
      .fc-confirm-text { color: var(--ink); }
      .fc-icon-btn-danger { border-color: var(--neg); color: var(--neg); }
      .fc-icon-btn-danger:hover { background: var(--neg); color: #fff; }
      .fc-danger-btn {
        border: 1px solid var(--neg); background: var(--neg); color: #fff; border-radius: 10px;
        padding: 6px 12px; font-size: 12px; cursor: pointer; font-family: inherit; font-weight: 700;
      }
      .fc-danger-btn:hover { opacity: 0.9; }

      .fc-data-zone { text-align: center; margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--line); }
      .fc-data-buttons { display: flex; justify-content: center; align-items: center; gap: 8px; }
      .fc-data-link {
        border: none; background: none; color: var(--ink-soft); font-size: 12px; cursor: pointer;
        font-family: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px;
      }
      .fc-data-link:hover { color: var(--ink); }
      .fc-data-sep { color: var(--line); font-size: 12px; }
      .fc-data-panel {
        margin-top: 12px; text-align: left; background: var(--surface-2); border-radius: 12px; padding: 12px;
      }
      .fc-data-textarea {
        width: 100%; min-height: 120px; font-family: monospace; font-size: 11px; border: 1px solid var(--line);
        border-radius: 10px; padding: 8px; background: var(--surface); color: var(--ink); resize: vertical; box-sizing: border-box;
      }
      .fc-data-panel-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }

      .fc-danger-zone { text-align: center; margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--line); }
      .fc-toast {
        position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%);
        display: flex; align-items: center; gap: 14px;
        background: var(--surface-2); color: var(--ink); border: 1px solid var(--line);
        border-radius: 999px; padding: 10px 10px 10px 18px; box-shadow: var(--shadow-lg);
        font-size: 13.5px; z-index: 40; max-width: calc(100vw - 32px);
        animation: fcToastIn .3s var(--ease);
      }
      .fc-toast-undo {
        background: var(--accent); color: var(--accent-deep); border: none; border-radius: 999px;
        padding: 7px 16px; font-weight: 700; cursor: pointer; white-space: nowrap;
        transition: transform .15s var(--ease);
      }
      .fc-toast-undo:hover { transform: translateY(-1px); }
      @keyframes fcToastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      @media (prefers-reduced-motion: reduce) { .fc-toast { animation: none; } }
      .fc-danger-link {
        border: none; background: none; color: var(--ink-faint); font-size: 11.5px; cursor: pointer;
        font-family: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px;
      }
      .fc-danger-link:hover { color: var(--neg); }

      .fc-cat-name { display: flex; align-items: center; gap: 8px; }

      .fc-lanc-layout { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; margin-top: 12px; }
      @media (min-width: 900px) { .fc-lanc-layout { grid-template-columns: 300px 1fr; } }
      .fc-lanc-side .fc-budget-panel { margin-top: 0; }

      .fc-budget-panel {
        background: var(--surface); border: 1px solid var(--line); border-radius: 26px; padding: 18px;
        transition: transform .22s var(--ease), box-shadow .22s var(--ease);
        opacity: 0; animation: fcFadeUp .65s var(--ease) forwards;
      }
      .fc-budget-panel:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
      .fc-budget-row { display: flex; gap: 22px; flex-wrap: wrap; margin-bottom: 10px; }
      .fc-budget-item { display: flex; flex-direction: column; gap: 2px; font-size: 15px; }
      .fc-budget-label { font-size: 10.5px; color: var(--ink-faint); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      .fc-progress-track {
        height: 8px; background: var(--surface-2); border-radius: 999px; overflow: hidden;
      }
      .fc-progress-fill { height: 100%; border-radius: 999px; transition: width 0.5s var(--ease); }
      .fc-ledger-total { border-top: 1.5px solid var(--ink); margin-top: 4px; font-weight: 700; padding-top: 12px; }
      .fc-ledger-total:hover { background: transparent; }
      .fc-row-right { display: flex; align-items: center; gap: 6px; }
      .fc-tabular { font-variant-numeric: tabular-nums; }
      .fc-empty { color: var(--ink-faint); font-size: 13px; padding: 12px 6px; font-weight: 500; }

      .fc-amount-btn {
        background: none; border: none; font: inherit; color: var(--ink); cursor: pointer;
        padding: 8px 10px; border-radius: 10px; font-variant-numeric: tabular-nums; font-weight: 700;
        transition: background-color .15s var(--ease);
      }
      .fc-amount-btn:hover { background: var(--surface-2); }

      .fc-input {
        font-family: inherit; font-size: 13px; border: 1px solid var(--line); border-radius: 11px;
        padding: 9px 11px; background: var(--surface); color: var(--ink);
        transition: border-color .15s var(--ease), background-color .15s var(--ease);
      }
      .fc-input:focus { outline: none; border-color: var(--accent); }
      .fc-input-amount { min-width: 96px; width: auto; text-align: right; }
      .fc-input-plain { border: none; background: transparent; padding: 6px 8px; font-size: 13.5px; flex: 1; border-radius: 9px; }
      .fc-input-plain:hover, .fc-input-plain:focus { background: var(--surface-2); outline: none; }
      .fc-input-grow { flex: 1; }

      .fc-icon-btn {
        border: 1px solid var(--line); background: var(--surface); border-radius: 10px; padding: 8px;
        display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
        color: var(--ink-soft); min-width: 34px; min-height: 34px;
        transition: color .15s var(--ease), border-color .15s var(--ease), background-color .15s var(--ease), transform .12s var(--ease);
      }
      .fc-icon-btn:hover { color: var(--ink); border-color: var(--ink-soft); }
      .fc-icon-btn:active { transform: scale(.94); }
      .fc-icon-btn-solid {
        background: linear-gradient(140deg, var(--hero-2), var(--accent)); color: #fff; border-color: transparent;
      }
      .fc-icon-btn-solid:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: var(--shadow-md); }
      .fc-icon-btn-trash {
        width: 40px; height: 40px; min-width: 40px; min-height: 40px; border-radius: 50%;
        border-color: transparent; background: transparent; color: var(--ink-faint);
      }
      .fc-icon-btn-trash:hover { background: var(--neg-soft); color: var(--neg); border-color: transparent; }

      .fc-add-row { display: flex; gap: 7px; margin-top: 12px; flex-wrap: wrap; }

      .fc-cat-chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .fc-chip {
        --cat-on: color-mix(in srgb, var(--cat, var(--accent)), var(--ink) 42%);
        border: 1px solid var(--line); background: transparent; color: var(--ink-soft);
        padding: 7px 14px 7px 7px; border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit;
        display: inline-flex; align-items: center; gap: 8px; min-height: 40px;
        transition: border-color .3s var(--ease-slide), color .3s var(--ease-slide), transform .15s var(--ease);
      }
      .fc-chip:hover:not(.fc-chip-active) { border-color: var(--cat-on); color: var(--ink); transform: translateY(-1px); }
      .fc-chip:active { transform: scale(.98); }
      .fc-chip-active { font-weight: 700; border-color: var(--ink); color: var(--bg); }
      .fc-chip-icon {
        width: 22px; height: 22px; border-radius: 8px; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        background: color-mix(in srgb, var(--cat-on) 20%, var(--surface)); color: var(--cat-on);
        transition: background-color .3s var(--ease-slide), color .3s var(--ease-slide);
      }
      .fc-chip-active .fc-chip-icon { background: color-mix(in srgb, var(--bg) 26%, transparent); color: var(--bg); }

      .fc-fixas-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
      @media (min-width: 720px) {
        .fc-fixas-grid { grid-template-columns: 1fr 1fr; }
      }
      .fc-fixas-card {
        background: var(--surface); border-radius: 26px; padding: 18px;
        box-shadow: var(--shadow-sm); border: 1px solid var(--line);
        transition: transform .22s var(--ease), box-shadow .22s var(--ease);
        opacity: 0; animation: fcFadeUp .65s var(--ease) forwards;
      }
      .fc-fixas-card:nth-child(1) { animation-delay: .05s; }
      .fc-fixas-card:nth-child(2) { animation-delay: .14s; }
      .fc-fixas-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
      @media (prefers-reduced-motion: reduce) { .fc-budget-panel, .fc-fixas-card { opacity: 1; animation: none; } }
      .fc-orcamentos-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--line); }
      .fc-section-title {
        display: flex; justify-content: space-between; align-items: center;
        font-weight: 700; font-size: 13.5px; margin-bottom: 8px;
      }
    `}</style>
  );
}
