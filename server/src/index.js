'use strict';
/* Orbit Ranger room server: the composition root.
 * Wires the pieces together and starts listening. Each piece knows only the
 * one below it:  index -> http/app, ws/gateway -> rooms -> game/core.
 */
const http = require('node:http');
const config = require('./config');
const { MemoryStore } = require('./rooms/memoryStore');
const { handler } = require('./http/app');
const gateway = require('./ws/gateway');

function start(overrides = {}) {
  const cfg = { ...config, ...overrides };
  const store = new MemoryStore(cfg);
  const server = http.createServer(handler(cfg, store));
  const sockets = gateway.attach(server, store, cfg);
  return new Promise((resolve) => {
    server.listen(cfg.port, () => resolve({
      server, store, port: server.address().port,
      close: () => new Promise((done) => { sockets.close(); server.close(done); server.closeAllConnections(); })
    }));
  });
}

if (require.main === module) {
  start().then(({ port }) => console.log('Orbit Ranger is at http://localhost:' + port));
}

module.exports = { start };
