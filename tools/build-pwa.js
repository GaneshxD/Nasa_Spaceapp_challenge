/* Writes sw.js: the service worker, with the list of files to keep for offline play.
 * Run it after changing any file the game loads:  node tools/build-pwa.js   (or: npm run pwa)
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const KEEP = ['apollo-lunar-module', 'astronaut', 'globe-earth']; // models the Moon level needs; the rest load when first opened
function walk(dir, test) {
  let out = [];
  for (const f of fs.readdirSync(path.join(root, dir)).sort()) {
    const rel = dir + '/' + f, st = fs.statSync(path.join(root, rel));
    if (st.isDirectory()) out = out.concat(walk(rel, test)); else if (test(rel)) out.push(rel);
  }
  return out;
}
const files = ['index.html', 'manifest.webmanifest']
  .concat(walk('css', (f) => f.endsWith('.css')), walk('js', (f) => f.endsWith('.js')), walk('vendor', (f) => f.endsWith('.js')), walk('icons', (f) => f.endsWith('.png')),
    walk('assets/fonts', (f) => f.endsWith('.woff2')), ['assets/textures.js', 'assets/nasa-fires.js', 'assets/moon-sites.js', 'assets/nasa3d/catalog.js'],
    walk('assets/nasa3d/thumbs', (f) => f.endsWith('.webp')), walk('assets/voice', (f) => /\.(mp3|js)$/.test(f) && !f.includes('/words/')), KEEP.map((id) => 'assets/nasa3d/' + id + '.js'));
const hash = crypto.createHash('sha1');
let bytes = 0;
for (const f of files) { const b = fs.readFileSync(path.join(root, f)); hash.update(f); hash.update(b); bytes += b.length; }
const version = hash.digest('hex').slice(0, 12);
const sw = `/* Orbit Ranger — service worker. Written by tools/build-pwa.js; do not edit by hand.
 * Keeps the game's own files so it starts and plays with no connection:
 *   - everything in PRECACHE is fetched when the app is first opened;
 *   - a file already kept is served at once, and refreshed in the background for next time;
 *   - NASA models (assets/nasa3d/) are kept the first time each one is opened, and never change.
 */
const VERSION = '${version}';
const SHELL = 'orbit-ranger-shell-' + VERSION;
const MODELS = 'orbit-ranger-models-v1';
const PRECACHE = ${JSON.stringify(files)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('orbit-ranger-shell-') && k !== SHELL).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
function refresh(request) {
  return fetch(request).then((res) => (res.ok ? caches.open(SHELL).then((cache) => cache.put(request, res)) : null)).catch(() => null);
}
self.addEventListener('fetch', (event) => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/\\/(ws|healthz)$/.test(url.pathname)) return; // the team-play server
  const page = request.mode === 'navigate';
  const model = url.pathname.includes('/assets/nasa3d/') && !/catalog\\.js$|\\/thumbs\\//.test(url.pathname);
  event.respondWith((async () => {
    const hit = (await caches.match(request, { ignoreSearch: page })) || (page ? await caches.match('index.html') : undefined);
    if (hit) { if (!model) event.waitUntil(refresh(request)); return hit; }
    try {
      const res = await fetch(request);
      if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(model ? MODELS : SHELL).then((cache) => cache.put(request, copy))); }
      return res;
    } catch (err) {
      return new Response('Offline, and this file has not been saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
`;
fs.writeFileSync(path.join(root, 'sw.js'), sw);
console.log('sw.js written: version ' + version + ', ' + files.length + ' files, ' + (bytes / 1048576).toFixed(1) + ' MB kept for offline play');
