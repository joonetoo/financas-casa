import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ShieldCheck, Download, Upload, History, Tags, Trash2, X, Check, Undo2 } from "lucide-react";
import { nuvem, registrar } from "./pessoal/nuvem.js";
import { usePrefs, IconeOink } from "./tema.jsx";
import { supabase } from "./supa.js";

// Configurações do app todo. Regras de segurança (skill zero-data-loss):
//  - restaurar e "começar do zero" SEMPRE guardam antes uma cópia do que existe
//    (linha "<chave>-antes-<ação>-<data>") e mostram "Desfazer" depois;
//  - restaurar mostra o que vai ser trocado e pede confirmação;
//  - começar do zero pede confirmação duas vezes.

const p2 = (n) => String(n).padStart(2, "0");
const agoraTxt = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
};
const hojeTxt = () => agoraTxt().slice(0, 10);
const DESFAZER_KEY = "oink-desfazer";

function baixar(nome, conteudo, tipo = "application/json") {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function lerAbas(chaveCasa, chavePessoal, chaveInvest) {
  const [casa, pessoal, invest] = await Promise.all([nuvem.get(chaveCasa), nuvem.get(chavePessoal), chaveInvest ? nuvem.get(chaveInvest) : { value: null }]);
  if (casa.failed || pessoal.failed || invest.failed) throw new Error("sem conexão");
  return { casa: casa.value, pessoal: pessoal.value, invest: invest.value };
}

function csvMinhasContas(doc) {
  const cat = Object.fromEntries((doc.categorias || []).map((c) => [c.id, c.nome]));
  const q = (t) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const linhas = [["Data", "Descrição", "Categoria", "Tipo", "Valor", "Pago", "Parcela", "Observação"].map(q).join(";")];
  for (const l of [...(doc.lancamentos || [])].sort((a, b) => (a.data < b.data ? -1 : 1))) {
    linhas.push([
      l.data.split("-").reverse().join("/"), l.desc, cat[l.catId] || "", l.tipo === "receita" ? "Receita" : "Despesa",
      (l.tipo === "receita" ? "" : "-") + Number(l.valor).toFixed(2).replace(".", ","), l.pago ? "Sim" : "Não",
      l.serie?.tipo === "parcela" ? `${l.serie.n}/${l.serie.total}` : l.serie?.tipo === "fixo" ? "Todo mês" : "", l.obs || "",
    ].map(q).join(";"));
  }
  return "﻿" + linhas.join("\r\n");
}

// guarda o que existe hoje numa linha à parte e troca pelo novo; depois recarrega
async function trocarComCopia(trocas, motivo) {
  const carimbo = agoraTxt();
  const copias = [];
  for (const { chave, novo } of trocas) {
    const atual = await nuvem.get(chave);
    if (atual.failed) throw new Error("sem conexão");
    const idCopia = `${chave}-antes-${motivo}-${carimbo}`;
    if (atual.value) {
      await nuvem.set(idCopia, atual.value);
      copias.push({ chave, idCopia });
    }
  }
  for (const { chave, novo } of trocas) await nuvem.set(chave, novo);
  try {
    sessionStorage.setItem(DESFAZER_KEY, JSON.stringify({ motivo, quando: Date.now(), copias }));
  } catch (e) { /* sem desfazer automático, mas a cópia existe */ }
  window.location.reload();
}

// Aviso que aparece depois de restaurar / começar do zero, com "Desfazer"
export function AvisoDesfazerGeral() {
  const [info, setInfo] = useState(() => {
    try {
      const i = JSON.parse(sessionStorage.getItem(DESFAZER_KEY) || "null");
      return i && Date.now() - i.quando < 10 * 60 * 1000 ? i : null;
    } catch (e) {
      return null;
    }
  });
  const [trabalhando, setTrabalhando] = useState(false);
  if (!info) return null;
  const fechar = () => {
    try { sessionStorage.removeItem(DESFAZER_KEY); } catch (e) { /* nada */ }
    setInfo(null);
  };
  const desfazer = async () => {
    setTrabalhando(true);
    try {
      for (const c of info.copias) {
        const r = await nuvem.get(c.idCopia);
        if (r.failed || !r.value) throw new Error("cópia não encontrada");
        await nuvem.set(c.chave, r.value);
      }
      sessionStorage.removeItem(DESFAZER_KEY);
      window.location.reload();
    } catch (e) {
      setTrabalhando(false);
      alert("Não consegui desfazer agora (sem internet?). Tente de novo — a cópia continua guardada.");
    }
  };
  const txt = info.motivo === "restaurar" ? "Backup restaurado." : "Lançamentos apagados.";
  return (
    <div className="cf-aviso" role="status">
      <span>{txt} O que tinha antes ficou guardado.</span>
      <button onClick={desfazer} disabled={trabalhando}><Undo2 size={16} /> {trabalhando ? "Desfazendo…" : "Desfazer"}</button>
      <button className="cf-aviso-x" aria-label="Fechar aviso" onClick={fechar}><X size={16} /></button>
    </div>
  );
}

function Item({ titulo, sub, children, onClick }) {
  return onClick
    ? <button className="cf-item cf-item-bt" onClick={onClick}><div><b>{titulo}</b>{sub && <small>{sub}</small>}</div>{children || <ChevronRight size={18} className="cf-fraco" />}</button>
    : <div className="cf-item"><div><b>{titulo}</b>{sub && <small>{sub}</small>}</div>{children}</div>;
}

function Seg({ opcoes, valor, onChange, rotulo }) {
  return (
    <div className="cf-seg" role="radiogroup" aria-label={rotulo}>
      {opcoes.map(([k, t]) => (
        <button key={k} role="radio" aria-checked={valor === k} className={valor === k ? "on" : ""} onClick={() => onChange(k)}>{t}</button>
      ))}
    </div>
  );
}

export default function Configuracoes({ chaveCasa, chavePessoal, chaveInvest, larga, onFechar }) {
  // sair deste aparelho: toca 2x pra confirmar (o primeiro toque só "arma" por 4s)
  const [sairArmado, setSairArmado] = useState(false);
  const [emailEntrada, setEmailEntrada] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmailEntrada(data?.session?.user?.email || ""));
  }, []);
  useEffect(() => {
    if (!sairArmado) return;
    const t = setTimeout(() => setSairArmado(false), 4000);
    return () => clearTimeout(t);
  }, [sairArmado]);
  const tocarSair = async () => {
    if (!sairArmado) { setSairArmado(true); return; }
    await supabase.auth.signOut({ scope: "local" });
  };
  const [prefs, setPref] = usePrefs();
  const [msg, setMsg] = useState("");
  const [exportando, setExportando] = useState(false);
  const [restaurar, setRestaurar] = useState(null); // { nome, dados }
  const [zeroArmado, setZeroArmado] = useState(0); // 0, 1 (1º toque), 2 (confirmação final)
  const [ocupado, setOcupado] = useState(false);
  const arquivoRef = useRef(null);
  const zeroTimer = useRef(null);

  useEffect(() => () => clearTimeout(zeroTimer.current), []);
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const ultimoBackup = (() => {
    try {
      const a = localStorage.getItem(`fc-backup:${chavePessoal}`);
      const b = localStorage.getItem(`fc-last-backup-date:${chaveCasa}`);
      const d = [a, b].filter(Boolean).sort().pop();
      if (!d) return "ainda não feito neste aparelho";
      return d === hojeTxt() ? "hoje" : d.split("-").reverse().join("/");
    } catch (e) {
      return "—";
    }
  })();

  const falhou = (e) => {
    setOcupado(false);
    setMsg("Não consegui agora — confira a internet e tente de novo. Nada foi mudado.");
  };

  const backupTudo = async () => {
    setOcupado(true);
    try {
      const abas = await lerAbas(chaveCasa, chavePessoal, chaveInvest);
      const arquivo = { app: "oink", versao: 1, criadoEm: new Date().toISOString(), abas: {
        casa: { chave: chaveCasa, dados: abas.casa }, pessoal: { chave: chavePessoal, dados: abas.pessoal },
        ...(abas.invest ? { invest: { chave: chaveInvest, dados: abas.invest } } : {}) } };
      baixar(`oink-backup-${hojeTxt()}.json`, JSON.stringify(arquivo, null, 2));
      setMsg("Backup baixado. Guarde o arquivo num lugar seguro (Drive, e-mail…).");
    } catch (e) { falhou(e); }
    setOcupado(false);
  };

  const exportar = async (qual, formato) => {
    setOcupado(true);
    try {
      const abas = await lerAbas(chaveCasa, chavePessoal, chaveInvest);
      if (qual === "pessoal" && formato === "csv") {
        baixar(`oink-minhas-contas-${hojeTxt()}.csv`, csvMinhasContas(abas.pessoal || {}), "text/csv;charset=utf-8");
      } else {
        const dados = abas[qual];
        const nomes = { casa: "contas-da-casa", pessoal: "minhas-contas", invest: "investimentos" };
        baixar(`oink-${nomes[qual]}-${hojeTxt()}.json`, JSON.stringify(dados, null, 2));
      }
      setExportando(false);
      setMsg("Arquivo baixado.");
    } catch (e) { falhou(e); }
    setOcupado(false);
  };

  const escolherArquivo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j?.app !== "oink" || !j.abas || (!j.abas.casa?.dados && !j.abas.pessoal?.dados && !j.abas.invest?.dados)) {
        setMsg("Esse arquivo não é um backup do Oink (use o arquivo de “Baixar backup de tudo”).");
        return;
      }
      setRestaurar({ nome: f.name, dados: j });
    } catch (err) {
      setMsg("Não consegui ler esse arquivo.");
    }
  };

  const confirmarRestaurar = async () => {
    setOcupado(true);
    try {
      const a = restaurar.dados.abas;
      const trocas = [];
      if (a.casa?.dados) trocas.push({ chave: chaveCasa, novo: a.casa.dados });
      if (a.pessoal?.dados) trocas.push({ chave: chavePessoal, novo: a.pessoal.dados });
      // backups antigos não têm investimentos: aí a aba Investimentos fica como está
      if (a.invest?.dados && chaveInvest) trocas.push({ chave: chaveInvest, novo: a.invest.dados });
      registrar(chavePessoal, { acao: "geral:restaurou", resumo: `Você restaurou o backup ${restaurar.nome}` });
      await trocarComCopia(trocas, "restaurar");
    } catch (e) { falhou(e); }
  };

  const tocarZero = async () => {
    clearTimeout(zeroTimer.current);
    if (zeroArmado < 2) {
      setZeroArmado(zeroArmado + 1);
      zeroTimer.current = setTimeout(() => setZeroArmado(0), 5000);
      return;
    }
    setOcupado(true);
    try {
      const r = await nuvem.get(chavePessoal);
      if (r.failed) throw new Error("sem conexão");
      const atual = r.value || { v: 1, categorias: [], lancamentos: [] };
      registrar(chavePessoal, { acao: "geral:zerou", resumo: `Você apagou todos os ${atual.lancamentos?.length || 0} lançamentos de Minhas contas (as categorias ficaram)` });
      await trocarComCopia([{ chave: chavePessoal, novo: { ...atual, lancamentos: [] } }], "zerar");
    } catch (e) { falhou(e); }
  };

  const abrirNaAba = (tela) => {
    window.dispatchEvent(new CustomEvent("oink-aba", { detail: "pessoal" }));
    window.dispatchEvent(new CustomEvent("oink-abrir", { detail: tela }));
    onFechar();
  };

  const zeroTxt = ["Apagar", "Tem certeza?", "Toque de novo pra apagar"][zeroArmado];

  return (
    <div className={"cf-tela" + (larga ? " cf-larga" : "")}>
      <style>{`
        .cf-tela{position:fixed;inset:0;z-index:55;background:var(--o-bg);overflow-y:auto;font-family:'Nunito',sans-serif;color:var(--o-ink);animation:oink-sobe .25s cubic-bezier(.22,.9,.32,1)}
        html[data-plat="mac"] .cf-tela{background:color-mix(in srgb, var(--o-bg) 78%, transparent);backdrop-filter:blur(40px) saturate(150%);-webkit-backdrop-filter:blur(40px) saturate(150%)}
        .cf-larga{left:276px}
        .cf-in{max-width:980px;margin:0 auto;padding:18px 16px 60px}
        .cf-topo{display:flex;align-items:center;gap:12px;padding:6px 0 8px}
        .cf-topo h1{margin:0;font-size:28px;font-weight:900}
        .cf-ib{width:44px;height:44px;border-radius:15px;border:1px solid var(--o-line);background:var(--o-sf);color:var(--o-ink);display:flex;align-items:center;justify-content:center;cursor:pointer}
        .cf-grade{display:grid;grid-template-columns:minmax(0,1fr);gap:0 18px}
        .cf-larga .cf-grade{grid-template-columns:repeat(2,minmax(0,1fr))}
        .cf-sec{font-size:12px;font-weight:900;letter-spacing:.07em;color:var(--o-faint);padding:18px 8px 8px}
        .cf-caixa{background:var(--o-sf);border:1px solid var(--o-line);border-radius:22px;overflow:hidden}
        .cf-item{width:100%;display:flex;align-items:center;gap:12px;padding:14px 16px;border:none;border-bottom:1px solid var(--o-line2);background:transparent;color:var(--o-ink);text-align:left;font-family:inherit}
        .cf-item:last-child{border-bottom:none}
        .cf-item > div{flex-grow:1;min-width:0}
        .cf-item b{display:block;font-size:15px;font-weight:800}
        .cf-item small{display:block;font-size:12.5px;color:var(--o-faint);font-weight:600;margin-top:2px}
        .cf-item-bt{cursor:pointer}
        .cf-item-bt:hover{background:color-mix(in srgb, var(--o-ink) 5%, transparent)}
        .cf-fraco{color:var(--o-faint)}
        .cf-status{display:flex;align-items:center;gap:14px;padding:16px;background:linear-gradient(160deg,#1E8A5E,#0C5237);color:#fff}
        .cf-status b{display:block;font-weight:900}
        .cf-status small{display:block;font-size:12.5px;color:#C9F1DC;font-weight:600}
        .cf-bt-verde{height:38px;padding:0 14px;border:none;border-radius:999px;background:linear-gradient(180deg,#7DF0B6,#3CC486);color:#06301E;font:900 13px 'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
        .cf-bt-verde:disabled{opacity:.5}
        .cf-bt-perigo{height:38px;padding:0 14px;border-radius:999px;border:1.5px solid var(--o-saiu);background:transparent;color:var(--o-saiu);font:900 13px 'Nunito',sans-serif;cursor:pointer;flex-shrink:0}
        .cf-bt-perigo.armado{background:var(--o-saiu);color:#fff}
        .cf-seg{display:flex;background:var(--o-sf2);border-radius:12px;padding:3px;flex-shrink:0}
        .cf-seg button{border:none;background:transparent;color:var(--o-faint);font:800 12.5px 'Nunito',sans-serif;padding:7px 10px;border-radius:9px;cursor:pointer}
        .cf-seg button.on{background:var(--o-ink);color:var(--o-bg)}
        .cf-msg{margin:14px 0 0;padding:12px 14px;border-radius:14px;background:var(--o-sf2);font-weight:700;font-size:14px;display:flex;gap:10px;align-items:center;justify-content:space-between}
        .cf-msg button{border:none;background:none;color:var(--o-faint);cursor:pointer}
        .cf-fim{text-align:center;padding:30px 0 10px}
        .cf-fim .oink-logo{font-size:30px}
        .cf-fim div{font-size:13px;color:var(--o-faint);font-weight:700}
        .cf-modal-fundo{position:fixed;inset:0;z-index:70;background:rgba(4,8,6,.72);display:flex;align-items:center;justify-content:center;padding:18px}
        .cf-modal{width:100%;max-width:440px;background:var(--o-sf);border:1px solid var(--o-line);border-radius:24px;padding:22px 18px 18px;display:flex;flex-direction:column;gap:12px}
        .cf-modal h2{margin:0;font-size:20px;font-weight:900}
        .cf-modal p{margin:0;color:var(--o-soft);font-size:14px;line-height:1.5}
        .cf-modal .cf-linha-bts{display:flex;gap:10px}
        .cf-modal .cf-linha-bts button{flex:1;height:50px;border-radius:16px;font:900 15px 'Nunito',sans-serif;cursor:pointer}
        .cf-b-sec{border:1px solid var(--o-line);background:transparent;color:var(--o-ink)}
        .cf-b-pri{border:none;background:var(--o-entrou);color:var(--o-entrou-deep)}
        .cf-b-verm{border:none;background:var(--o-saiu);color:#fff}
        .cf-opcoes{display:flex;flex-direction:column;gap:8px}
        .cf-opcoes button{height:50px;border-radius:14px;border:1px solid var(--o-line);background:var(--o-sf2);color:var(--o-ink);font:800 15px 'Nunito',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:0 16px}
        .cf-aviso{position:fixed;left:50%;transform:translateX(-50%);top:12px;z-index:90;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 24px);
          background:var(--o-ink);color:var(--o-bg);border-radius:16px;padding:10px 10px 10px 16px;font:800 14px 'Nunito',sans-serif;box-shadow:0 16px 40px -12px rgba(0,0,0,.6)}
        .cf-aviso button{border:none;border-radius:10px;background:var(--o-bg);color:var(--o-entrou);font:900 13px 'Nunito',sans-serif;padding:8px 12px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
        .cf-aviso .cf-aviso-x{background:transparent;color:var(--o-bg);padding:6px}
      `}</style>
      <div className="cf-in">
        <div className="cf-topo">
          <button className="cf-ib" aria-label="Voltar" onClick={onFechar}><ChevronLeft size={20} /></button>
          <h1>Configurações</h1>
        </div>

        <div className="cf-grade">
          <div>
            <div className="cf-sec">SEUS DADOS</div>
            <div className="cf-caixa">
              <div className="cf-status"><ShieldCheck size={30} /><div><b>Backup automático ligado</b><small>Último: {ultimoBackup} · uma cópia por dia, guardada no cofre</small></div></div>
              <Item titulo="Baixar backup de tudo" sub="Contas da casa, Minhas contas e Investimentos num arquivo só">
                <button className="cf-bt-verde" disabled={ocupado} onClick={backupTudo}><Download size={15} /> Baixar</button>
              </Item>
              <Item titulo="Exportar uma aba" sub="Escolha a aba e o formato (pra levar pra outro app ou planilha)" onClick={() => setExportando(true)} />
              <Item titulo="Restaurar de um arquivo" sub="Usa um arquivo de “Baixar backup de tudo” · pede confirmação e dá pra desfazer" onClick={() => arquivoRef.current?.click()}>
                <Upload size={18} className="cf-fraco" />
              </Item>
              <Item titulo="Registro de atividades" sub="Tudo que foi lançado, mudado ou apagado" onClick={() => abrirNaAba("atividades")}><History size={18} className="cf-fraco" /></Item>
            </div>
            <input ref={arquivoRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={escolherArquivo} />
          </div>

          <div>
            <div className="cf-sec">PREFERÊNCIAS (neste aparelho)</div>
            <div className="cf-caixa">
              <Item titulo="Ordem dos lançamentos" sub="Pela data">
                <Seg rotulo="Ordem" valor={prefs.ordem} onChange={(v) => setPref("ordem", v)} opcoes={[["crescente", "Crescente"], ["decrescente", "Decrescente"]]} />
              </Item>
              <Item titulo="Período padrão" sub="O que aparece ao abrir o app">
                <Seg rotulo="Período padrão" valor={prefs.periodo} onChange={(v) => setPref("periodo", v)} opcoes={[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]]} />
              </Item>
              <Item titulo="Aparência">
                <Seg rotulo="Aparência" valor={prefs.aparencia} onChange={(v) => setPref("aparencia", v)} opcoes={[["escuro", "Escuro"], ["claro", "Claro"], ["auto", "Auto"]]} />
              </Item>
              <Item titulo="Categorias" sub="Criar, editar, arquivar" onClick={() => abrirNaAba("categorias")}><Tags size={18} className="cf-fraco" /></Item>
            </div>

            <div className="cf-sec">ESTE APARELHO</div>
            <div className="cf-caixa">
              <Item titulo="Sair deste aparelho" sub={emailEntrada ? `Entrou como ${emailEntrada} · pra voltar, é só pedir o link de novo` : "Pra voltar, é só pedir o link de novo"}>
                <button className={"cf-bt-perigo" + (sairArmado ? " armado" : "")} onClick={tocarSair}>{sairArmado ? "Toque de novo pra sair" : "Sair"}</button>
              </Item>
            </div>

            <div className="cf-sec">COMEÇAR DO ZERO</div>
            <div className="cf-caixa">
              <Item titulo="Apagar os lançamentos de Minhas contas" sub="As categorias ficam. Guarda uma cópia antes e dá pra desfazer. (Pra aba da casa, use o botão no fim dela.)">
                <button className={"cf-bt-perigo" + (zeroArmado ? " armado" : "")} disabled={ocupado} onClick={tocarZero}>{zeroTxt}</button>
              </Item>
            </div>
          </div>
        </div>

        {msg && <div className="cf-msg" role="status"><span>{msg}</span><button aria-label="Fechar" onClick={() => setMsg("")}><X size={16} /></button></div>}

        <div className="cf-fim"><IconeOink size={44} /><div className="oink-logo">oink<i>.</i></div><div>suas contas sem susto</div></div>
      </div>

      {exportando && (
        <div className="cf-modal-fundo" onClick={() => setExportando(false)}>
          <div className="cf-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Exportar uma aba">
            <h2>Exportar uma aba</h2>
            <div className="cf-opcoes">
              <button disabled={ocupado} onClick={() => exportar("pessoal", "csv")}>Minhas contas · planilha (Excel) <Download size={16} /></button>
              <button disabled={ocupado} onClick={() => exportar("pessoal", "json")}>Minhas contas · arquivo de dados <Download size={16} /></button>
              <button disabled={ocupado} onClick={() => exportar("casa", "json")}>Contas da casa · arquivo de dados <Download size={16} /></button>
              <button disabled={ocupado} onClick={() => exportar("invest", "json")}>Investimentos · arquivo de dados <Download size={16} /></button>
            </div>
            <div className="cf-linha-bts"><button className="cf-b-sec" onClick={() => setExportando(false)}>Fechar</button></div>
          </div>
        </div>
      )}

      {restaurar && (
        <div className="cf-modal-fundo" onClick={() => !ocupado && setRestaurar(null)}>
          <div className="cf-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Restaurar backup">
            <h2>Restaurar este backup?</h2>
            <p>O arquivo <b>{restaurar.nome}</b> foi feito em <b>{new Date(restaurar.dados.criadoEm).toLocaleString("pt-BR")}</b>.
              Ele vai <b>trocar</b> {[restaurar.dados.abas.casa?.dados && "Contas da casa", restaurar.dados.abas.pessoal?.dados && "Minhas contas", restaurar.dados.abas.invest?.dados && "Investimentos"].filter(Boolean).join(" e ")} pelo que está no arquivo.</p>
            <p>O que existe hoje fica guardado numa cópia, e aparece um botão “Desfazer” logo depois.</p>
            <div className="cf-linha-bts">
              <button className="cf-b-sec" disabled={ocupado} onClick={() => setRestaurar(null)}>Cancelar</button>
              <button className="cf-b-verm" disabled={ocupado} onClick={confirmarRestaurar}>{ocupado ? "Restaurando…" : "Restaurar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
