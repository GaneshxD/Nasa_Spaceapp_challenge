'use strict';
/* Room rules, message checks, and one real two-player session over a socket. */
const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { Room } = require('../src/rooms/room');
const { MemoryStore } = require('../src/rooms/memoryStore');
const { parse } = require('../src/ws/protocol');
const { start } = require('../src/index');

const GOOD = { sensor: 'wide', orbit: 'sso', bus: 'midi', panels: 'M', battery: 'M', computer: 'rad', pointing: 'wheels3', radio: 'xband', network: 'two', rocket: 'medium' };

test('consoles are dealt in joining order, and only the owner may pick', () => {
  const room = new Room('ABCD', 'engineer');
  const a = room.join('Asha'), b = room.join('Ben');
  assert.equal(room.ownerOf('science').id, a.id);
  assert.equal(room.ownerOf('nav').id, b.id);
  room.pick(a.id, 'sensor', 'wide');
  assert.equal(room.design.sensor, 'wide');
  assert.throws(() => room.pick(b.id, 'sensor', 'mini'), { code: 'not-your-console' });
  assert.throws(() => room.pick(a.id, 'sensor', 'no-such-part'), { code: 'bad-request' });
  assert.throws(() => room.pick(a.id, '__proto__', 'x'), { code: 'bad-request' });
});

test('bonus tools toggle, and any change clears the go votes', () => {
  const room = new Room('ABCD', 'engineer');
  const a = room.join('Asha');
  room.vote(a.id, 'science', true);
  room.pick(a.id, 'extras', 'color');
  assert.deepEqual(room.design.extras, ['color']);
  assert.deepEqual(room.votes, {});
  room.pick(a.id, 'extras', 'color');
  assert.deepEqual(room.design.extras, []);
});

test('a room holds four players and no more', () => {
  const room = new Room('ABCD', 'engineer');
  ['A', 'B', 'C', 'D'].forEach((n) => room.join(n));
  assert.throws(() => room.join('E'), { code: 'room-full' });
});

test('launch needs the host, a finished design that passes the checks, and every console go', () => {
  const room = new Room('ABCD', 'engineer');
  const a = room.join('Asha'), b = room.join('Ben');
  assert.throws(() => room.launch(a.id), { code: 'not-ready' });
  Object.assign(room.design, GOOD);
  assert.throws(() => room.launch(b.id), { code: 'not-host' });
  assert.throws(() => room.launch(a.id), { code: 'not-ready' }); // nobody has said go yet
  ['science', 'eng'].forEach((r) => room.vote(a.id, r, true));
  ['nav', 'comms'].forEach((r) => room.vote(b.id, r, true));
  const seed = room.launch(a.id);
  assert.ok(Number.isInteger(seed) && seed >= 1 && seed <= 9000);
});

test('a dropped player keeps the seat for a while, then loses it', () => {
  const room = new Room('ABCD', 'engineer');
  const a = room.join('Asha'), b = room.join('Ben');
  room.disconnect(b.id);
  assert.equal(room.snapshot().players[1].online, false);
  assert.throws(() => room.rejoin(b.id, 'f'.repeat(32)), { code: 'no-seat' });
  assert.equal(room.rejoin(b.id, b.token).id, b.id);
  room.disconnect(b.id);
  assert.equal(room.sweep(1000, Date.now() + 5000), true);
  assert.deepEqual(room.players.map((p) => p.id), [a.id]);
});

test('seat tokens never appear in what is sent to players', () => {
  const room = new Room('ABCD', 'engineer');
  const a = room.join('Asha');
  assert.ok(!JSON.stringify(room.snapshot()).includes(a.token));
});

test('the store caps the number of rooms and removes empty ones', () => {
  const store = new MemoryStore({ maxRooms: 2, maxPlayers: 4 });
  const r = store.create('engineer'); r.join('A');
  store.create('engineer');
  assert.throws(() => store.create('engineer'), { code: 'busy' });
  store.sweep({ seatHoldMs: 1000, roomIdleMs: 60000 });
  assert.equal(store.size, 1);
});

test('messages are checked before they reach the game', () => {
  assert.deepEqual(parse('{"t":"join","code":"abcd","name":"  Zed\\u0007  "}'), { t: 'join', code: 'ABCD', name: 'Zed' });
  assert.equal(parse('{"t":"join","code":"AB","name":"Zed"}'), null);
  assert.equal(parse('{"t":"pick","group":"sensor","key":{"$gt":""}}'), null);
  assert.equal(parse('{"t":"constructor"}'), null);
  assert.equal(parse('not json'), null);
  assert.equal(parse('{"t":"join","code":"ABCD","name":"' + 'x'.repeat(40) + '"}').name.length, 14);
});

test('two players share a design over real sockets', async () => {
  const app = await start({ port: 0 });
  const url = 'ws://localhost:' + app.port + '/ws';
  const open = () => new Promise((resolve, reject) => {
    const ws = new WebSocket(url); ws.inbox = [];
    ws.on('message', (d) => { const m = JSON.parse(d); ws.inbox.push(m); if (ws.waiting && ws.waiting.test(m)) { const w = ws.waiting; ws.waiting = null; w.resolve(m); } });
    ws.on('open', () => resolve(ws)); ws.on('error', reject);
  });
  const next = (ws, testFn) => new Promise((resolve) => {
    const hit = ws.inbox.find(testFn);
    if (hit) resolve(hit); else ws.waiting = { test: testFn, resolve };
  });
  try {
    const a = await open(), b = await open();
    a.send(JSON.stringify({ t: 'create', name: 'Asha', diff: 'engineer' }));
    const joined = await next(a, (m) => m.t === 'joined');
    const code = joined.state.code;
    b.send(JSON.stringify({ t: 'join', code, name: 'Ben' }));
    await next(b, (m) => m.t === 'joined');
    await next(a, (m) => m.t === 'state' && m.state.players.length === 2);

    a.send(JSON.stringify({ t: 'pick', group: 'sensor', key: 'wide' }));
    const seen = await next(b, (m) => m.t === 'state' && m.state.design.sensor === 'wide');
    assert.equal(seen.state.players[1].name, 'Ben');

    b.send(JSON.stringify({ t: 'pick', group: 'sensor', key: 'mini' })); // not Ben's console
    assert.equal((await next(b, (m) => m.t === 'error')).code, 'not-your-console');

    const c = await open();
    c.send(JSON.stringify({ t: 'join', code: 'ZZZZ', name: 'Cy' }));
    assert.equal((await next(c, (m) => m.t === 'error')).code, 'no-room');

    const health = await (await fetch('http://localhost:' + app.port + '/healthz')).json();
    assert.deepEqual(health, { ok: true, rooms: 1 });
    assert.equal((await fetch('http://localhost:' + app.port + '/server/src/config.js')).status, 404);
    assert.equal((await fetch('http://localhost:' + app.port + '/.git/config')).status, 404);
    assert.equal((await fetch('http://localhost:' + app.port + '/')).status, 200);
    [a, b, c].forEach((ws) => ws.close());
  } finally {
    await app.close();
  }
});
