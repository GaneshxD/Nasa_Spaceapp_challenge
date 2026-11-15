'use strict';
/* Orbit Ranger room server: the composition root.
 * Wires the pieces together and starts listening. Each piece knows only the
 * one below it:  index -> http/app, ws/gateway -> rooms -> game/core.
 */
const http = require('node:http');
const os = require('node:os');
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
    server.listen(cfg.port, cfg.host, () => resolve({
      server, store, port: server.address().port,
      close: () => new Promise((done) => { sockets.close(); server.close(done); server.closeAllConnections(); })
    }));
  });
}

/** The addresses other devices on the same network can use to reach this computer. */
function lanAddresses(port) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push('http://' + a.address + ':' + port);
  }
  return out;
}

if (require.main === module) {
  start().then(({ port }) => {
    const lan = lanAddresses(port);
    console.log('Orbit Ranger is running.\n');
    console.log('  On this computer:      http://localhost:' + port);
    if (config.host === '127.0.0.1' || config.host === 'localhost') console.log('  Other devices cannot reach it: HOST is set to this computer only.');
    else if (!lan.length) console.log('  No network found: connect to Wi-Fi or a cable so other devices can join.');
    else lan.forEach((u) => console.log('  On the same network:   ' + u));
    console.log('\nTo fly together: open one of these addresses, press Play, then "Crew online". Share the link it shows.');
    console.log('If another device cannot open the address, allow Node through this computer\'s firewall for private networks.\n');
  });
}

module.exports = { start, lanAddresses };
