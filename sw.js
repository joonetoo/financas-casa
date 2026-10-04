// Gerado no build — não editar direto (edite vite.config.js). Guarda só o
// "esqueleto" do app (telas/botões), nunca os dados: esses continuam vindo
// sempre da rede. Estratégia: tenta a rede primeiro (sempre a versão mais
// nova quando tem internet); sem internet, cai pro que já foi guardado.
const CACHE = "oink-shell-a31a663744";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./assets/index-DoqYUNKS.js",
  "./assets/index-BwUxfZeh.css",
  "./manifest.json",
  "./favicon-32.png",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

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
