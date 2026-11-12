// Guarda o app para abrir sem internet e mostra os lembretes.
// Os dados financeiros ficam na conta (Supabase) ou no navegador; aqui só a lista de lembretes já calculada pelo app.
const CACHE = "minhas-financas-v4";
const REM = "mf-lembretes";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icons/logo.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./vendor/supabase-2.117.3.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("minhas-financas-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== location.origin && !e.request.url.includes("supabase-js")) return; // API do Supabase vai direto para a rede
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && new URL(e.request.url).origin === location.origin) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(m => m || caches.match("./index.html"))));
});

// ---- lembretes ----
const remUrl = name => new URL("./" + name, self.registration.scope).href;
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
async function fireDue(){
  const c = await caches.open(REM);
  const r = await c.match(remUrl("__lembretes.json")); if (!r) return;
  const { list = [] } = await r.json();
  const sr = await c.match(remUrl("__mostrados.json")); const shown = sr ? await sr.json() : [];
  const td = today(); let changed = false;
  for (const x of list){
    if (x.date !== td || shown.includes(x.id)) continue;
    await self.registration.showNotification(x.title, { body: x.body, tag: x.id, icon: "icons/icon-192.png", badge: "icons/favicon-32.png", data: { url: x.url || "./" } });
    shown.push(x.id); changed = true;
  }
  if (changed) await c.put(remUrl("__mostrados.json"), new Response(JSON.stringify(shown.slice(-300)), { headers: { "content-type": "application/json" } }));
}
// Android/Chrome com o app instalado: verificação periódica em segundo plano (o navegador decide o horário)
self.addEventListener("periodicsync", e => { if (e.tag === "mf-lembretes") e.waitUntil(fireDue()); });
self.addEventListener("message", e => { if (e.data === "mf-lembretes") e.waitUntil ? e.waitUntil(fireDue()) : fireDue(); });
// Preparado para envio pelo servidor (Web Push), se for ligado no futuro
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Minhas Finanças", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Minhas Finanças", { body: d.body || "", tag: d.tag, icon: "icons/icon-192.png", badge: "icons/favicon-32.png", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws){ if ("focus" in w){ w.navigate && w.navigate(url).catch(() => {}); return w.focus(); } }
    return self.clients.openWindow(url);
  }));
});
