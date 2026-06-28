// Service worker do CDG Builder.
//
// Estratégia:
//   • Navegações: network-only, com fallback de cache APENAS pra rotas
//     anônimas allowlisted (home, wiki canonical, builder). Rotas que
//     dependem de session NUNCA são cacheadas — senão um logout offline
//     deixa o conteúdo do usuário anterior visível.
//   • Estáticos (CSS/JS/imagens): stale-while-revalidate.
//
// Bump CACHE_VERSION a cada deploy pra invalidar.

const CACHE_VERSION = 'cdg-v3';
const STATIC_CACHE = `cdg-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `cdg-runtime-${CACHE_VERSION}`;

// Páginas anônimas seguras pra cachear como fallback offline. Tudo aqui é
// rendered igual pra todo mundo (mesmo logado, o body principal não muda).
// NUNCA incluir rotas que mostram dados de session, mesmo que indiretamente.
const ANON_NAV_PREFIXES = ['/wiki', '/builder'];
const ANON_NAV_EXACT = new Set(['/', '/login']);

// Rotas explicitamente off-limits pro cache de navegação. Mesmo que algum
// dia ANON_NAV_PREFIXES seja ampliado, essas continuam barradas.
const NEVER_CACHE_PREFIXES = ['/admin', '/settings', '/api'];
// Rotas community que dependem de role (edit, new) — viewer sem permissão
// recebe redirect; o redirect cacheado seria pior que ir online.
const NEVER_CACHE_SUFFIXES = ['/edit', '/new'];

function isCacheableNavigation(pathname) {
  if (NEVER_CACHE_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  if (NEVER_CACHE_SUFFIXES.some((s) => pathname.endsWith(s))) return false;
  if (ANON_NAV_EXACT.has(pathname)) return true;
  if (ANON_NAV_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    // /wiki/c/* é página community que pode incluir indicadores de role
    // (botão "editar", controles mod). Cachear o HTML seria mostrar
    // estado de outro usuário. Excluir.
    if (pathname.startsWith('/wiki/c')) return false;
    return true;
  }
  return false;
}

const CORE_ASSETS = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegações: network-first. Cache só pra rotas allowlisted anônimas.
  if (req.mode === 'navigate') {
    const cacheable = isCacheableNavigation(url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Só cacheia se a resposta veio de uma rota cacheável E não tem
          // Set-Cookie (que indica resposta personalizada).
          if (cacheable && !res.headers.has('Set-Cookie')) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // Offline: tenta cache só se a rota é cacheável; senão deixa
          // o browser mostrar erro de rede em vez de conteúdo possivelmente
          // de outro usuário.
          if (!cacheable) return caches.match('/') || Response.error();
          return caches.match(req).then((hit) => hit || caches.match('/') || Response.error());
        })
    );
    return;
  }

  // Estáticos e JSON: stale-while-revalidate. Estáticos não têm payload
  // de sessão, então é seguro.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
