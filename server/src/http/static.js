'use strict';
/* Serves the game's own files, and nothing else on the disk.
 * Only the folders the game is made of are reachable, paths are resolved and
 * checked to stay inside the web root, and dotfiles are never served.
 */
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC = new Set(['index.html', 'css', 'js', 'assets', 'vendor', 'docs']);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function serve(webRoot, req, res) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { rel = null; }
  if (rel === '/') rel = '/index.html';
  const parts = rel ? rel.split('/').filter(Boolean) : [];
  const file = path.resolve(webRoot, ...parts);
  const inside = file.startsWith(webRoot + path.sep);
  if (!parts.length || !inside || !PUBLIC.has(parts[0]) || parts.some((p) => p.startsWith('.')) || !TYPES[path.extname(file)]) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)], 'Content-Length': st.size,
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache'
    });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  });
}

module.exports = { serve };
