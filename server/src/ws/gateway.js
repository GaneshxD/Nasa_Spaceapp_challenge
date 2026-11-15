'use strict';
/* The socket side: who is connected, to which room, and what they may send.
 * It owns no game rules. Each message is validated (protocol.js), rate-limited,
 * handed to the room, and the room's new state is sent to everyone in it.
 */
const { WebSocketServer } = require('ws');
const { parse, out } = require('./protocol');
const { RoomError } = require('../rooms/room');

function attach(server, store, config, log = console) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.maxMessageBytes });
  const members = new Map(); // room code -> Set of sockets

  function originAllowed(req) {
    const origin = req.headers.origin;
    if (!origin) return true; // not a browser (tests, health checks)
    try { if (new URL(origin).host === req.headers.host) return true; } catch (e) { return false; }
    return config.origins.includes(origin);
  }

  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://x').pathname !== '/ws' || !originAllowed(req)) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });

  function broadcast(room) {
    const set = members.get(room.code);
    if (!set) return;
    const msg = out.state(room.snapshot());
    for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(msg);
  }
  function sendAll(room, msg) {
    const set = members.get(room.code);
    if (set) for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(msg);
  }
  function seat(ws, room, player) {
    ws.session = { code: room.code, id: player.id };
    if (!members.has(room.code)) members.set(room.code, new Set());
    members.get(room.code).add(ws);
    ws.send(out.joined(player, room.snapshot()));
    broadcast(room);
  }
  function unseat(ws, leaveForGood) {
    const s = ws.session;
    if (!s) return;
    ws.session = null;
    const set = members.get(s.code);
    if (set) { set.delete(ws); if (!set.size) members.delete(s.code); }
    const room = store.get(s.code);
    if (!room) return;
    if (leaveForGood) room.remove(s.id); else room.disconnect(s.id);
    if (!room.players.length) store.delete(room.code); else broadcast(room);
  }

  const handlers = {
    create(ws, m) {
      if (ws.session) throw new RoomError('bad-request', 'Already in a room.');
      const room = store.create(m.diff);
      seat(ws, room, room.join(m.name));
    },
    join(ws, m) {
      if (ws.session) throw new RoomError('bad-request', 'Already in a room.');
      const room = store.get(m.code);
      if (!room) {
        if (++ws.badJoins >= config.maxBadJoins) ws.close(1008, 'too many wrong codes');
        throw new RoomError('no-room', 'No room has that code.');
      }
      seat(ws, room, room.join(m.name));
    },
    rejoin(ws, m) {
      if (ws.session) throw new RoomError('bad-request', 'Already in a room.');
      const room = store.get(m.code);
      if (!room) throw new RoomError('no-room', 'That room has closed.');
      seat(ws, room, room.rejoin(m.id, m.token));
    },
    pick(ws, m, room) { room.pick(ws.session.id, m.group, m.key); broadcast(room); },
    vote(ws, m, room) { room.vote(ws.session.id, m.role, m.go); broadcast(room); },
    launch(ws, m, room) { sendAll(room, out.launch(room.launch(ws.session.id))); },
    leave(ws) { unseat(ws, true); }
  };
  const NEEDS_ROOM = { pick: true, vote: true, launch: true };

  wss.on('connection', (ws) => {
    ws.session = null;
    ws.badJoins = 0;
    ws.alive = true;
    ws.tokens = config.rate.burst;
    ws.refilledAt = Date.now();

    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (data, isBinary) => {
      // rate limit: a bucket of tokens that refills steadily
      const now = Date.now();
      ws.tokens = Math.min(config.rate.burst, ws.tokens + ((now - ws.refilledAt) / 1000) * config.rate.perSecond);
      ws.refilledAt = now;
      if (ws.tokens < 1) { ws.close(1008, 'too many messages'); return; }
      ws.tokens -= 1;

      const m = isBinary ? null : parse(data.toString('utf8'));
      if (!m) { ws.send(out.error('bad-request', 'That message was not understood.')); return; }
      try {
        let room = null;
        if (NEEDS_ROOM[m.t]) {
          room = ws.session && store.get(ws.session.code);
          if (!room) throw new RoomError('no-room', 'You are not in a room.');
        }
        handlers[m.t](ws, m, room);
      } catch (e) {
        if (e instanceof RoomError) ws.send(out.error(e.code, e.message));
        else { log.error('message failed', e); ws.send(out.error('server', 'Something went wrong on the server.')); }
      }
    });
    ws.on('close', () => unseat(ws, false));
    ws.on('error', () => {});
  });

  // drop dead connections, and tidy rooms and held seats
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
    store.sweep(config).forEach(broadcast);
  }, config.heartbeatMs);
  timer.unref();

  return { wss, close() { clearInterval(timer); wss.close(); } };
}

module.exports = { attach };
