// sw.js — cache para abrir mais rápido e funcionar com sinal ruim no celular.
// - tiles do mosaico de drone (…/z/x/y.png|jpg|webp): cache primeiro (nunca mudam)
// - demais arquivos do próprio site: rede primeiro (3 s) e, se falhar/demorar, usa o cache → você sempre vê a versão nova quando há internet
// - Google, Photon, Overpass etc. (outros domínios): não são interceptados
var VERSAO = 'v1';
var CACHE_SITE = 'site-' + VERSAO;
var CACHE_TILES = 'tiles-' + VERSAO;
var MAX_TILES = 1500;
var RE_TILE = /\/\d{1,2}\/\d+\/\d+\.(png|jpe?g|webp)$/i;

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE_SITE && k !== CACHE_TILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function limitar(nome, max) {
  caches.open(nome).then(function (c) {
    c.keys().then(function (ks) { if (ks.length > max) c.delete(ks[0]).then(function () { limitar(nome, max); }); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\.pdf$/i.test(url.pathname)) return;   // PDFs grandes: deixa o navegador cuidar

  if (RE_TILE.test(url.pathname)) {
    e.respondWith(caches.open(CACHE_TILES).then(function (c) {
      return c.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (r) {
          if (r.ok) { c.put(req, r.clone()); limitar(CACHE_TILES, MAX_TILES); }
          return r;
        });
      });
    }));
    return;
  }

  e.respondWith(caches.open(CACHE_SITE).then(function (c) {
    var rede = fetch(req).then(function (r) { if (r.ok) c.put(req, r.clone()); return r; });
    var limite = new Promise(function (_, rej) { setTimeout(rej, 3000); });
    return Promise.race([rede, limite]).catch(function () {
      return c.match(req).then(function (hit) { return hit || rede; });
    });
  }));
});
