'use strict';
/* The crew mission: seat rules, the go / no-go poll, a whole flight run on the room, and a session over real sockets. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');
const { CrewRoom } = require('../src/rooms/crewRoom');
const { MemoryStore } = require('../src/rooms/memoryStore');
const { parse } = require('../src/ws/protocol');
const { start, lanAddresses } = require('../src/index');
const { Crew } = require('../src/game/core');

/** Every seat played by a simple script that does what its console says. Returns the room when the flight is over. */
function flyRoom(room, lazy = {}) {
  const ids = Object.fromEntries(Crew.SEATS.map((s) => [s, room.ownerOf(s).id]));
  for (let i = 0; i < 30 * 600 && room.stage !== 'over'; i++) {
    const m = room.mission, st = m && m.state();
    if (room.stage === 'flight') {
      const c = st.c, o = st.o;
      room.steer(ids.pilot, c.err > 2.5 ? -1 : c.err < -2.5 ? 1 : 0);
      if (!lazy.engineer) { if (c.bOn && c.bEmpty) room.act(ids.engineer, 'boosters'); if (st.phase === 'staging' && m.coreWait > 0.5) room.act(ids.engineer, 'separate'); }
      if (!lazy.payload) { if (st.phase === 'climb' && c.alt >= 101 && !c.fair && c.steady) room.act(ids.payload, 'fairing'); if (st.phase === 'orbit' && !o.burning) room.act(ids.payload, 'deploy'); }
      room.burn(ids.navigator, !lazy.navigator && !!o && (st.phase === 'coast' || st.phase === 'orbit') && !o.inOrbit && o.vr < 80);
    }
    room.tick(1 / 30);
  }
  return room;
}
function crewOf(n) { const room = new CrewRoom('ABCD', { countMs: 100 }); const ps = ['Asha', 'Ben', 'Chen', 'Dolma'].slice(0, n).map((nm) => room.join(nm)); return { room, ps }; }

test('the four seats are dealt in joining order: one player has all four, four players have one each', () => {
  const one = crewOf(1); assert.deepEqual(Crew.SEATS.map((s) => one.room.ownerOf(s).name), ['Asha', 'Asha', 'Asha', 'Asha']);
  const two = crewOf(2); assert.deepEqual(Crew.SEATS.map((s) => two.room.ownerOf(s).name), ['Asha', 'Ben', 'Asha', 'Ben']);
  const three = crewOf(3); assert.deepEqual(Crew.SEATS.map((s) => three.room.ownerOf(s).name), ['Asha', 'Ben', 'Chen', 'Asha']);
  const four = crewOf(4); assert.deepEqual(Crew.SEATS.map((s) => four.room.ownerOf(s).name), ['Asha', 'Ben', 'Chen', 'Dolma']);
  assert.throws(() => four.room.join('Eve'), { code: 'room-full' });
  const snap = four.room.snapshot();
  assert.equal(snap.kind, 'crew'); assert.equal(JSON.stringify(snap).includes(four.ps[0].token), false, 'seat tokens never leave the server');
});

test('the count starts only when every connected player is go, and stops if one takes it back', () => {
  const { room, ps } = crewOf(3);
  room.vote(ps[0].id, true); room.vote(ps[1].id, true);
  assert.equal(room.stage, 'lobby');
  room.vote(ps[2].id, true);
  assert.equal(room.stage, 'count');
  room.vote(ps[1].id, false);
  assert.equal(room.stage, 'lobby', 'one no-go stops the count');
  room.disconnect(ps[1].id);                       // Ben's phone goes to sleep: the two who are here can fly
  room.vote(ps[0].id, true); room.vote(ps[2].id, true);
  assert.equal(room.stage, 'count');
  assert.throws(() => room.join('Late'), { code: 'in-flight' });
  for (let i = 0; i < 10; i++) room.tick(1 / 30);
  assert.equal(room.stage, 'flight'); assert.equal(room.snapshot().m.phase, 'climb');
});

test('only the owner of a seat may work its controls', () => {
  const { room, ps } = crewOf(4);
  ps.forEach((p) => room.vote(p.id, true));
  for (let i = 0; i < 10; i++) room.tick(1 / 30);
  assert.throws(() => room.act(ps[0].id, 'boosters'), { code: 'not-your-console' });
  assert.throws(() => room.act(ps[1].id, 'fairing'), { code: 'not-your-console' });
  assert.throws(() => room.act(ps[1].id, 'self-destruct'), { code: 'bad-request' });
  assert.equal(room.act(ps[1].id, 'boosters'), 'burning');            // the engineer's own switch, pressed too early: refused, and the crew is told
  assert.equal(room.snapshot().ev.at(-1)[1], 'refused'); assert.equal(room.snapshot().ev.at(-1)[2], 'boosters:burning');
  room.steer(ps[1].id, 1); assert.equal(room.mission.steer, 0, 'the engineer cannot steer');
  room.steer(ps[0].id, 1); assert.equal(room.mission.steer, 1);
  room.burn(ps[0].id, true); assert.equal(room.mission.burn, false, 'the pilot cannot burn the upper stage');
});

test('a crew of four that does its jobs reaches orbit with three stars, and each seat gets a line with its player', () => {
  const { room, ps } = crewOf(4);
  ps.forEach((p) => room.vote(p.id, true));
  flyRoom(room);
  const r = room.result;
  assert.equal(room.stage, 'over'); assert.equal(r.ok, true); assert.equal(r.stars, 3);
  assert.deepEqual(Crew.SEATS.map((s) => r.seats[s].who), ['Asha', 'Ben', 'Chen', 'Dolma']);
  Crew.SEATS.forEach((s) => assert.ok(r.seats[s].line.length > 20 && r.seats[s].stars === 3, s + ': ' + r.seats[s].stars + ' ' + r.seats[s].line));
  assert.ok(r.orbit.periKm >= 160 && r.orbit.apoKm < 400, JSON.stringify(r.orbit));
  const names = room.snapshot().ev.map((e) => e[1]);
  assert.ok(names.includes('orbit') && names.includes('deployed'));
  room.again(ps[2].id);
  assert.equal(room.stage, 'lobby'); assert.deepEqual(room.votes, {});
});

test('a seat that does nothing costs the crew stars, and a navigator who never burns loses the rocket', () => {
  const a = crewOf(2); a.ps.forEach((p) => a.room.vote(p.id, true));
  flyRoom(a.room, { engineer: true, payload: true });
  assert.equal(a.room.result.ok, true); assert.ok(a.room.result.stars < 3);
  assert.equal(a.room.result.seats.engineer.stars, 1); assert.match(a.room.result.seats.engineer.line, /computer had to/);
  assert.match(a.room.result.seats.payload.line, /never dropped/);
  const b = crewOf(4); b.ps.forEach((p) => b.room.vote(p.id, true));
  flyRoom(b.room, { navigator: true });
  assert.equal(b.room.result.ok, false); assert.equal(b.room.result.why, 'fell'); assert.equal(b.room.result.stars, 0);
});

test('crew messages are checked: unknown switches, steering out of range and extra fields are refused', () => {
  assert.deepEqual(parse(JSON.stringify({ t: 'crew-steer', v: -1 })), { t: 'crew-steer', v: -1 });
  assert.deepEqual(parse(JSON.stringify({ t: 'crew-steer', v: 0 })), { t: 'crew-steer', v: 0 });
  assert.equal(parse(JSON.stringify({ t: 'crew-steer', v: 5 })), null);
  assert.equal(parse(JSON.stringify({ t: 'crew-act', a: 'explode' })), null);
  assert.deepEqual(parse(JSON.stringify({ t: 'crew-act', a: 'fairing', extra: 1 })), { t: 'crew-act', a: 'fairing' });
  assert.deepEqual(parse(JSON.stringify({ t: 'crew-create', name: ' Asha ' })), { t: 'crew-create', name: 'Asha', tank: '', engines: '' });
  assert.equal(parse(JSON.stringify({ t: 'crew-join', code: 'ab1d', name: 'x' })), null);
  const store = new MemoryStore({ maxRooms: 2, maxPlayers: 4 });
  assert.equal(store.createCrew({ tank: 'L', engines: 'E3' }).build.tank, 'M', 'a rocket that leaves the engineer no time is swapped for the standard one');
  assert.equal(store.createCrew({ tank: 'nope', engines: 'E3' }).build.tank, 'M');
});

function client(port) {
  const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws'); const got = [];
  ws.on('message', (d) => got.push(JSON.parse(d)));
  const until = (fn, ms = 4000) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const m = got.find(fn); if (m) res(m); else if (Date.now() - t0 > ms) rej(new Error('timed out; last: ' + JSON.stringify(got.at(-1)).slice(0, 200))); else setTimeout(poll, 15); })(); });
  return { ws, got, until, send: (m) => ws.send(JSON.stringify(m)), open: new Promise((r) => ws.on('open', r)) };
}
function get(port, path) { return new Promise((res, rej) => http.get({ host: '127.0.0.1', port, path }, (r) => { let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => res({ status: r.statusCode, body: b })); }).on('error', rej)); }

test('three players join by code over real sockets, say go, lift off, and see the same flight', async () => {
  const srv = await start({ port: 0, crewCountMs: 150 });
  try {
    const a = client(srv.port), b = client(srv.port), c = client(srv.port);
    await Promise.all([a.open, b.open, c.open]);
    a.send({ t: 'crew-create', name: 'Asha' });
    const ja = await a.until((m) => m.t === 'joined'), code = ja.state.code;
    assert.equal(ja.state.kind, 'crew'); assert.equal(ja.state.stage, 'lobby');
    b.send({ t: 'join', code, name: 'Ben' });                       // the design-room message does not get into a crew room
    assert.equal((await b.until((m) => m.t === 'error')).code, 'no-room');
    b.send({ t: 'crew-join', code: code.toLowerCase(), name: 'Ben' }); c.send({ t: 'crew-join', code, name: 'Chen' });
    const jb = await b.until((m) => m.t === 'joined'); await c.until((m) => m.t === 'joined');
    await a.until((m) => m.t === 'state' && m.state.players.length === 3);
    [a, b, c].forEach((x) => x.send({ t: 'crew-go', go: true }));
    const up = await c.until((m) => m.t === 'state' && m.state.stage === 'flight' && m.state.m.c.alt > 0.05, 6000);
    assert.equal(up.state.m.phase, 'climb'); assert.equal(up.state.seats.pilot, ja.you); assert.equal(up.state.seats.engineer, jb.you);
    b.send({ t: 'crew-steer', v: 1 }); a.send({ t: 'crew-act', a: 'boosters' });   // Ben is not the pilot; Asha is not the engineer
    assert.equal((await a.until((m) => m.t === 'error')).code, 'not-your-console');
    a.send({ t: 'crew-steer', v: -1 });
    const later = await b.until((m) => m.t === 'state' && m.state.rev > up.state.rev + 6 && m.state.m.c.err < -0.5, 5000);
    assert.ok(later.state.m.c.alt > up.state.m.c.alt, 'the flight goes on, and the pilot\'s steering shows on another player\'s screen');
    // a shared link opens the game, and the server can tell a lobby its address on the network
    assert.equal((await get(srv.port, '/?crew=' + code)).status, 200);
    const lan = JSON.parse((await get(srv.port, '/lan.json')).body);
    assert.deepEqual(lan.urls, lanAddresses(srv.port));
    [a, b, c].forEach((x) => x.ws.close());
  } finally { await srv.close(); }
});
