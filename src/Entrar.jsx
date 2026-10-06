import React, { useState, useEffect, useRef } from "react";
import { supabase, EMAIL_DO_DONO, erroDoLinkNaChegada } from "./supa.js";

// Tela de entrada (login) — mockup aprovado em 2026-10-06.
// Link no e-mail OU código de 6 números (o código é o caminho garantido no
// Android, quando o link abre num navegador diferente do app instalado).
// Só cuida de QUEM entra: não lê nem grava nenhum dado das contas.

const EMAIL_SALVO = "oink-email";
const lerEmail = () => { try { return localStorage.getItem(EMAIL_SALVO) || ""; } catch (e) { return ""; } };
const guardarEmail = (v) => { try { localStorage.setItem(EMAIL_SALVO, v); } catch (e) { /* ok */ } };
const norm = (v) => String(v || "").trim().toLowerCase();

// O link do e-mail volta com um erro no endereço quando venceu ou já foi usado
// (lido em supa.js antes do Supabase limpar o endereço); mostra só uma vez.
let erroLinkMostrado = false;

const textoErro = (e) => {
  const m = String(e?.message || e || "").toLowerCase();
  if (!navigator.onLine || m.includes("fetch") || m.includes("network")) return "Sem internet agora. Confira a conexão e tente de novo.";
  if (m.includes("security purposes") || m.includes("rate") || e?.status === 429) return "Muitos pedidos seguidos. Espere um minutinho e tente de novo.";
  return "Não deu certo agora. Tente de novo em instantes.";
};

export function Porteiro({ children }) {
  // undefined = conferindo · null = precisa entrar · objeto = entrou
  const [sessao, setSessao] = useState(undefined);
  const [boasVindas, setBoasVindas] = useState(false);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => { if (vivo) setSessao(data?.session || null); });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (!vivo) return;
      if (evento === "SIGNED_IN" && s) setBoasVindas((b) => b || !sessaoAtual.current);
      setSessao(s || null);
    });
    return () => { vivo = false; sub?.subscription?.unsubscribe(); };
  }, []);
  const sessaoAtual = useRef(null);
  useEffect(() => { sessaoAtual.current = sessao; }, [sessao]);

  // "Tudo certo!" por um instante depois de entrar, e segue pro app
  useEffect(() => {
    if (!boasVindas) return;
    const t = setTimeout(() => setBoasVindas(false), 1100);
    return () => clearTimeout(t);
  }, [boasVindas]);

  if (sessao === undefined) return <TelaEntrada estadoFixo="conferindo" />;
  if (!sessao) return <TelaEntrada />;
  if (boasVindas) return <TelaEntrada estadoFixo="pronto" />;
  return children;
}

export default function TelaEntrada({ estadoFixo }) {
  const [estado, setEstado] = useState(() => (erroDoLinkNaChegada && !erroLinkMostrado ? "expirou" : "entrar"));
  useEffect(() => {
    if (!erroDoLinkNaChegada || erroLinkMostrado) return;
    erroLinkMostrado = true;
    try { window.history.replaceState(null, "", window.location.pathname); } catch (e) { /* ok */ }
  }, []);
  const [email, setEmail] = useState(lerEmail);
  const [codigo, setCodigo] = useState(["", "", "", "", "", ""]);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);
  const caixas = useRef([]);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const pedirLink = async () => {
    const e = norm(email);
    setAviso("");
    if (!e || !e.includes("@")) { setAviso("Digite seu e-mail."); return; }
    if (e !== EMAIL_DO_DONO) { setEstado("outro"); return; }
    setOcupado(true);
    try {
      const volta = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.signInWithOtp({ email: e, options: { emailRedirectTo: volta, shouldCreateUser: false } });
      if (error) throw error;
      guardarEmail(e);
      setCodigo(["", "", "", "", "", ""]);
      setEspera(60);
      setEstado("enviado");
    } catch (err) {
      const m = String(err?.message || "").toLowerCase();
      if (m.includes("signups not allowed") || m.includes("not found") || m.includes("otp_disabled")) setEstado("outro");
      else setAviso(textoErro(err));
    } finally {
      setOcupado(false);
    }
  };

  const entrarComCodigo = async () => {
    const token = codigo.join("");
    setAviso("");
    if (token.length < 6) { setAviso("Digite os 6 números do e-mail."); return; }
    setOcupado(true);
    setEstado("entrando");
    try {
      const { error } = await supabase.auth.verifyOtp({ email: norm(email), token, type: "email" });
      if (error) throw error;
      // o Porteiro percebe a entrada sozinho e mostra "Tudo certo!"
    } catch (err) {
      const m = String(err?.message || "").toLowerCase();
      setEstado("enviado");
      setAviso(m.includes("expired") || m.includes("invalid") || m.includes("token")
        ? "Código errado ou vencido. Confira os números ou peça um novo."
        : textoErro(err));
    } finally {
      setOcupado(false);
    }
  };

  const digitar = (i, v) => {
    const so = v.replace(/\D/g, "");
    if (so.length > 1) { // colou o código inteiro
      const n = so.slice(0, 6).split("");
      setCodigo([0, 1, 2, 3, 4, 5].map((k) => n[k] || ""));
      caixas.current[Math.min(5, n.length - 1)]?.focus();
      return;
    }
    setCodigo((c) => c.map((x, k) => (k === i ? so : x)));
    if (so && i < 5) caixas.current[i + 1]?.focus();
  };
  const apagar = (i, ev) => {
    if (ev.key === "Backspace" && !codigo[i] && i > 0) caixas.current[i - 1]?.focus();
    if (ev.key === "Enter") entrarComCodigo();
  };

  const est = estadoFixo || estado;
  const marca = (
    <>
      <img className="oe-ic" src="./icon-192.png" alt="" />
      <div className="oe-logo">oink<i>.</i></div>
      <div className="oe-frase">suas contas sem susto</div>
    </>
  );

  let corpo;
  if (est === "conferindo" || est === "entrando") {
    corpo = (<>
      <div className="oe-focinho"><i /><i /></div>
      <div className="oe-t">{est === "entrando" ? "Entrando…" : "Abrindo o Oink…"}</div>
      {est === "entrando" && <div className="oe-d">Só um instante, conferindo.</div>}
    </>);
  } else if (est === "pronto") {
    corpo = (<>
      <div className="oe-ok">✓</div>
      <div className="oe-t">Tudo certo!</div>
      <div className="oe-d">Este aparelho ficou lembrado.<br />Abrindo suas contas…</div>
    </>);
  } else if (est === "enviado") {
    corpo = (<>
      <div className="oe-env">✉️</div>
      <div className="oe-t">Olha seu e-mail</div>
      <div className="oe-d">Mandamos um e-mail pra <b>{norm(email)}</b>.<br />Toque no link <b>ou</b> digite aqui o código de 6 números.</div>
      <div className="oe-cod">
        {codigo.map((c, i) => (
          <input key={i} ref={(el) => (caixas.current[i] = el)} value={c} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? 6 : 1} aria-label={`Número ${i + 1} do código`}
            onChange={(e) => digitar(i, e.target.value)} onKeyDown={(e) => apagar(i, e)} />
        ))}
      </div>
      {aviso && <div className="oe-aviso">{aviso}</div>}
      <button className="oe-bt oe-p" disabled={ocupado} onClick={entrarComCodigo}>Entrar com o código</button>
      <button className="oe-bt oe-g" onClick={() => { setAviso(""); setEstado("entrar"); }}>Usar outro e-mail</button>
      <button className="oe-bt oe-g" disabled={espera > 0 || ocupado} onClick={pedirLink}>
        {espera > 0 ? `Reenviar em 0:${String(espera).padStart(2, "0")}` : "Reenviar o e-mail"}
      </button>
      <div className="oe-rodape">Não chegou? Olhe a pasta de spam.</div>
    </>);
  } else if (est === "expirou") {
    corpo = (<>
      <div className="oe-erro">⌛</div>
      <div className="oe-t">Esse link venceu</div>
      <div className="oe-d">Por segurança, o link vale por pouco tempo e só uma vez. Peça um novo.</div>
      <button className="oe-bt oe-p" onClick={() => setEstado("entrar")}>Mandar outro link</button>
    </>);
  } else if (est === "outro") {
    corpo = (<>
      <div className="oe-erro">🚫</div>
      <div className="oe-t">E-mail não autorizado</div>
      <div className="oe-d">O Oink é pessoal: só o e-mail cadastrado consegue entrar. Confira se digitou certo.</div>
      <button className="oe-bt oe-p" onClick={() => setEstado("entrar")}>Tentar de novo</button>
    </>);
  } else {
    corpo = (<>
      {marca}
      <div className="oe-t">Entrar no Oink</div>
      <div className="oe-d">Digite seu e-mail que a gente manda um link de entrada. Sem senha.</div>
      <label className="oe-campo">
        <span>SEU E-MAIL</span>
        <input className="oe-inp" type="email" inputMode="email" autoComplete="email" placeholder="voce@email.com" value={email}
          onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pedirLink()} />
      </label>
      {aviso && <div className="oe-aviso">{aviso}</div>}
      <button className="oe-bt oe-p" disabled={ocupado} onClick={pedirLink}>{ocupado ? "Mandando…" : "Me manda o link ✉️"}</button>
      <div className="oe-nota">🔒 Você só precisa fazer isso uma vez em cada aparelho.</div>
      <div className="oe-rodape">Oink · só pra você</div>
    </>);
  }

  return (
    <div className="oe-fundo">
      <style>{CSS}</style>
      <div className={"oe-tela oe-" + est}>{corpo}</div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Nunito:wght@600;700;800;900&display=swap');
.oe-fundo{--bg:#0A1511;--sf:#12211A;--sf2:#1A2E24;--ink:#F2FBF6;--mut:#8FA89B;--line:#243a2e;--verde:#5FE3A1;--rosa:#FF7EA6;--moeda:#FFC94D;
  position:fixed;inset:0;overflow-y:auto;color:var(--ink);font-family:'Nunito',system-ui,sans-serif;-webkit-tap-highlight-color:transparent;
  background:radial-gradient(120% 60% at 50% 0%,#17442F 0%,var(--bg) 60%);display:flex;justify-content:center}
.oe-fundo *{box-sizing:border-box}
.oe-tela{width:100%;max-width:440px;min-height:100%;display:flex;flex-direction:column;align-items:center;padding:calc(56px + env(safe-area-inset-top)) 26px calc(28px + env(safe-area-inset-bottom))}
.oe-conferindo,.oe-entrando,.oe-pronto,.oe-expirou,.oe-outro{justify-content:center}
@media (min-width:768px){
  .oe-fundo{align-items:center;background:radial-gradient(60% 70% at 18% 20%,#1E6A48 0%,transparent 60%),radial-gradient(50% 60% at 85% 80%,#5a2440 0%,transparent 60%),var(--bg)}
  .oe-tela{min-height:0;width:460px;padding:44px 40px 36px;border-radius:30px;margin:32px 0;background:color-mix(in srgb,#12211A 78%,transparent);
    backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border:1px solid rgba(255,255,255,.12);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 40px 90px -30px rgba(0,0,0,.7)}
}
.oe-ic{width:92px;height:92px;border-radius:26px;box-shadow:0 18px 40px -14px rgba(0,0,0,.6)}
.oe-logo{font-family:'Fredoka',sans-serif;font-weight:600;font-size:40px;margin:14px 0 0;letter-spacing:-.5px}.oe-logo i{color:var(--rosa);font-style:normal}
.oe-frase{color:var(--mut);font-weight:700;font-size:15px;margin:2px 0 30px}
.oe-t{font-size:21px;font-weight:900;text-align:center;margin:0 0 6px}
.oe-d{font-size:14.5px;color:var(--mut);font-weight:700;text-align:center;line-height:1.5;margin:0 0 20px;overflow-wrap:anywhere}
.oe-d b{color:var(--ink)}
.oe-campo{width:100%;display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.oe-campo span{font-size:12px;font-weight:800;color:var(--mut);letter-spacing:.3px}
.oe-inp{width:100%;height:54px;border-radius:16px;background:var(--sf2);border:1.5px solid var(--line);color:var(--ink);font:inherit;font-size:16px;font-weight:800;padding:0 16px;outline:none}
.oe-inp:focus{border-color:var(--verde)}
.oe-bt{width:100%;height:56px;border:0;border-radius:18px;font:inherit;font-size:16.5px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.oe-bt:disabled{opacity:.55;cursor:default}
.oe-p{background:linear-gradient(180deg,#FF9DBE,#FF6D9B);color:#3A0A1D;box-shadow:0 4px 0 #B23A63}
.oe-p:active:not(:disabled){transform:translateY(2px);box-shadow:0 2px 0 #B23A63}
.oe-g{background:transparent;color:var(--mut);height:44px;font-size:14.5px}
.oe-nota{display:flex;gap:8px;font-size:12.5px;color:var(--mut);font-weight:700;line-height:1.45;margin-top:18px;background:rgba(255,255,255,.04);border-radius:14px;padding:11px 13px;width:100%}
.oe-aviso{width:100%;font-size:13.5px;font-weight:800;color:#FF8F93;background:rgba(255,90,95,.1);border-radius:12px;padding:10px 12px;margin:0 0 12px;text-align:center}
.oe-env{width:84px;height:84px;border-radius:50%;background:rgba(95,227,161,.14);display:flex;align-items:center;justify-content:center;font-size:40px;margin:4px 0 18px;animation:oe-pulo 1.6s ease-in-out infinite}
@keyframes oe-pulo{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.oe-cod{display:flex;gap:8px;justify-content:center;width:100%;margin:2px 0 14px}
.oe-cod input{width:46px;height:58px;border-radius:14px;background:var(--sf2);border:1.5px solid var(--line);color:var(--ink);font:inherit;font-size:26px;font-weight:900;text-align:center;outline:none;font-variant-numeric:tabular-nums;padding:0}
.oe-cod input:focus{border-color:var(--verde)}
.oe-focinho{width:96px;height:72px;border-radius:40px;background:#FF8FB3;display:flex;align-items:center;justify-content:center;gap:16px;margin:0 0 22px;animation:oe-resp 1.4s ease-in-out infinite}
.oe-focinho i{width:16px;height:22px;border-radius:50%;background:#B23A63}
@keyframes oe-resp{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
.oe-erro{width:84px;height:84px;border-radius:50%;background:rgba(255,90,95,.14);display:flex;align-items:center;justify-content:center;font-size:38px;margin:4px 0 18px}
.oe-ok{width:84px;height:84px;border-radius:50%;background:var(--moeda);display:flex;align-items:center;justify-content:center;font-size:40px;color:#4a3200;margin:4px 0 18px;font-weight:900}
.oe-rodape{margin-top:auto;padding-top:22px;font-size:12px;color:#5d7569;font-weight:700}
@media (prefers-reduced-motion:reduce){.oe-env,.oe-focinho{animation:none}}
`;
