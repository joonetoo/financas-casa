import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// `vite build --mode beta` gera a versão de teste: outro nome no ícone e na
// aba do navegador, pra nunca confundir com o app de verdade.
function nomeBeta(mode) {
  return {
    name: "nome-beta",
    transformIndexHtml(html) {
      return mode === "beta" ? html.replace(/<title>.*?<\/title>/, "<title>Oink BETA</title>") : html;
    },
    closeBundle() {
      if (mode !== "beta") return;
      const p = path.resolve("dist/manifest.json");
      if (!fs.existsSync(p)) return;
      const m = JSON.parse(fs.readFileSync(p, "utf8"));
      m.name = "Oink BETA";
      m.short_name = "Oink BETA";
      m.description = "Versão de teste do Oink";
      fs.writeFileSync(p, JSON.stringify(m, null, 2));
    },
  };
}

// Nível 1 do offline: depois do build, monta o `sw.js` com a lista exata dos
// arquivos desta versão (os nomes têm hash, então mudam a cada build) e um
// nome de cache com um hash desses nomes, pra versão nova nunca ficar presa
// atrás de uma velha. Só guarda o "esqueleto" do app — nunca dados.
function gerarServiceWorker() {
  return {
    name: "gerar-service-worker",
    closeBundle() {
      const dist = path.resolve("dist");
      const indexPath = path.join(dist, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const html = fs.readFileSync(indexPath, "utf8");
      const achados = new Set();
      for (const m of html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)) achados.add(m[1]);
      ["./manifest.json", "./favicon-32.png", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"].forEach((f) => {
        if (fs.existsSync(path.join(dist, f.slice(2)))) achados.add(f);
      });
      const lista = ["./", "./index.html", ...achados];
      const hash = crypto.createHash("sha1").update(lista.join(",")).digest("hex").slice(0, 10);
      const nomeCache = `oink-shell-${hash}`;
      const sw = `// Gerado no build — não editar direto (edite vite.config.js). Guarda só o
// "esqueleto" do app (telas/botões), nunca os dados: esses continuam vindo
// sempre da rede. Estratégia: tenta a rede primeiro (sempre a versão mais
// nova quando tem internet); sem internet, cai pro que já foi guardado.
const CACHE = ${JSON.stringify(nomeCache)};
const ARQUIVOS = ${JSON.stringify(lista, null, 2)};

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k.startsWith("oink-shell-") && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(async () => {
        const doCache = await caches.match(req);
        if (doCache) return doCache;
        if (req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      })
  );
});
`;
      fs.writeFileSync(path.join(dist, "sw.js"), sw);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), nomeBeta(mode), gerarServiceWorker()],
}));
