'use strict';
/* The plain HTTP side: a health check and the game's files. */
const { serve } = require('./static');

function handler(config, store) {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }).end('Method not allowed');
      return;
    }
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        .end(JSON.stringify({ ok: true, rooms: store.size }));
      return;
    }
    serve(config.webRoot, req, res);
  };
}

module.exports = { handler };
