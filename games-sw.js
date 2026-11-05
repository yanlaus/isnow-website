/* 腦力勇者：離線快取（只控制 games.html 同 games/…，唔影響 iSnow 其他頁）
   同源檔案：stale-while-revalidate（即開即玩，背景更新）；Google Fonts：快取咗就冇網都有字 */
const VERSION = 'bq-v2';
const FONT_CACHE = 'bq-fonts';
const CORE = [
  'games.html', 'games.css', 'games.webmanifest',
  'vendor/three/three.module.min.js',
  'games/icons/icon-192.png', 'games/icons/icon-512.png', 'games/icons/apple-touch-icon.png', 'games/icons/favicon-64.png',
  'games/main.js', 'games/engine.js', 'games/fx.js', 'games/icons.js', 'games/store.js', 'games/sound.js',
  'games/models.js', 'games/items.js', 'games/textures.js', 'games/menu.js', 'games/grid-world.js',
  'games/schulte.js', 'games/maze.js', 'games/memory.js', 'games/simon.js', 'games/stroke.js',
  'games/mahjong.js', 'games/whack.js', 'games/shop.js', 'games/idiom.js', 'games/idioms.js',
  'games/charts.js', 'games/share.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))   // 個別失敗唔阻安裝
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('bq-') && k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function staleWhileRevalidate(e, cacheName, matchOpts) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(e.request, matchOpts);
  const net = fetch(e.request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  const res = await net;
  if (res) return res;
  // 冇網又未快取：開頁就用返快取咗嘅 games.html
  if (e.request.mode === 'navigate') {
    const page = await cache.match('games.html');
    if (page) return page;
  }
  return new Response('', { status: 504, statusText: 'offline' });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (isFont) { e.respondWith(staleWhileRevalidate(e, FONT_CACHE)); return; }
  if (url.origin !== self.location.origin) return;
  // 網址有 ?debug 等參數都用返同一份頁
  e.respondWith(staleWhileRevalidate(e, VERSION, req.mode === 'navigate' ? { ignoreSearch: true } : undefined));
});
