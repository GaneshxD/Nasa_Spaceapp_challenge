'use strict';
/* A crew room: up to four players, each on their own device, flying one rocket to orbit together.
 * The flight itself runs here, on the server (js/core/crew.js, the same rule book the browser tests use), so nobody
 * can disagree about what happened. Players send only what they are holding or pressing; the room sends everyone
 * the same picture of the flight many times a second.
 * Pure rules with no network code, so it is unit-tested directly.
 *
 *   lobby   players join and say go; the four seats are dealt out in joining order
 *   count   everyone is go: a short countdown (anyone taking their go back stops it)
 *   flight  the mission runs; only a seat's owner may work its controls
 *   over    in orbit, or failed: the score, and anyone may call the crew back to the lobby
 */
const crypto = require('node:crypto');
const { Crew } = require('../game/core');
const { RoomError } = require('./room');

const SEAT_OF = { boosters: 'engineer', separate: 'engineer', fairing: 'payload', deploy: 'payload' };

class CrewRoom {
  constructor(code, opts = {}) {
    this.kind = 'crew';
    this.code = code;
    this.maxPlayers = opts.maxPlayers || 4;
    this.countMs = opts.countMs || 3000;
    this.build = Crew.build(opts.build || null); // the creator's rocket from level 2 if it suits, else the standard one
    this.players = [];           // in joining order: { id, token, name, online, leftAt }
    this.votes = {};             // player id -> true
    this.stage = 'lobby';
    this.countLeft = 0;
    this.mission = null; this.seenEv = 0;
    this.log = []; this.seq = 0; // the last few things that happened, numbered, so a screen can tell new from old
    this.result = null; this.flights = 0;
    this.rev = 0;
    this.touchedAt = Date.now();
  }

  touch() { this.rev++; this.touchedAt = Date.now(); }
  get busy() { return this.stage === 'count' || this.stage === 'flight'; }
  player(id) { return this.players.find((p) => p.id === id) || null; }
  /** The player who has a seat: dealt in joining order, so one player has all four and four players have one each. */
  ownerOf(seat) {
    const i = Crew.SEATS.indexOf(seat);
    return i < 0 || !this.players.length ? null : this.players[i % this.players.length];
  }
  owns(id, seat) { const o = this.ownerOf(seat); return !!o && o.id === id; }
  note(name, extra) { this.log.push([++this.seq, name, extra || '']); if (this.log.length > 16) this.log.shift(); }

  join(name) {
    if (this.busy) throw new RoomError('in-flight', 'This crew is in the middle of a flight. Join when they are back in the briefing room.');
    if (this.players.length >= this.maxPlayers) throw new RoomError('room-full', 'This crew already has four players.');
    const p = { id: crypto.randomUUID(), token: crypto.randomBytes(16).toString('hex'), name, online: true, leftAt: 0 };
    this.players.push(p);
    this.votes = {}; // the seats are dealt again, so every go is asked again
    this.touch();
    return p;
  }
  /** A dropped player returns to their own seats, even in the middle of a flight. */
  rejoin(id, token) {
    const p = this.player(id);
    const ok = p && token.length === p.token.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(p.token));
    if (!ok) throw new RoomError('no-seat', 'That seat is no longer held.');
    p.online = true; p.leftAt = 0;
    this.touch();
    return p;
  }
  disconnect(id) {
    const p = this.player(id);
    if (!p) return;
    p.online = false; p.leftAt = Date.now();
    delete this.votes[id];
    if (this.stage === 'count') this.stage = 'lobby';
    if (this.stage === 'flight') { if (this.owns(id, 'pilot')) this.mission.steer = 0; if (this.owns(id, 'navigator')) this.mission.burn = false; }
    this.touch();
  }
  remove(id) {
    const n = this.players.length;
    this.players = this.players.filter((p) => p.id !== id);
    if (this.players.length === n) return;
    this.votes = {};
    if (this.stage === 'count') this.stage = 'lobby';
    this.touch();
  }
  sweep(seatHoldMs, now = Date.now()) {
    const gone = this.players.filter((p) => !p.online && now - p.leftAt > seatHoldMs);
    gone.forEach((p) => this.remove(p.id));
    return gone.length > 0;
  }

  /** The go / no-go poll: every player who is connected has to say go. Then the count starts by itself. */
  vote(id, go) {
    if (!this.player(id)) throw new RoomError('bad-request', 'You are not in this crew.');
    if (this.stage !== 'lobby' && this.stage !== 'count') throw new RoomError('not-now', 'The poll is over.');
    if (go) this.votes[id] = true; else delete this.votes[id];
    const here = this.players.filter((p) => p.online);
    const all = here.length > 0 && here.every((p) => this.votes[p.id]);
    if (this.stage === 'count' && !all) { this.stage = 'lobby'; this.note('hold'); }
    else if (this.stage === 'lobby' && all) {
      this.stage = 'count'; this.countLeft = this.countMs;
      this.mission = new Crew.Mission(this.build, 1 + crypto.randomInt(40)); this.seenEv = 0; this.result = null;
      this.note('poll-go');
    }
    this.touch();
  }
  steer(id, v) { if (this.stage === 'flight' && this.owns(id, 'pilot')) this.mission.steer = v; }
  burn(id, on) { if (this.stage === 'flight' && this.owns(id, 'navigator')) this.mission.burn = on; }
  /** One of the four switches. A refusal (too early, not steady…) is told to the whole crew: it is a thing to talk about. */
  act(id, a) {
    const seat = SEAT_OF[a];
    if (!seat) throw new RoomError('bad-request', 'No such switch.');
    if (this.stage !== 'flight') throw new RoomError('not-now', 'There is no flight in progress.');
    if (!this.owns(id, seat)) { const o = this.ownerOf(seat); throw new RoomError('not-your-console', 'That switch belongs to ' + (o ? o.name : 'another player') + '.'); }
    const r = this.mission.act(a);
    if (r !== 'ok') this.note('refused', a + ':' + r);
    this.touch();
    return r;
  }
  /** After a flight: back to the briefing room, for the same crew or a bigger one. */
  again(id) {
    if (!this.player(id)) throw new RoomError('bad-request', 'You are not in this crew.');
    if (this.stage !== 'over') throw new RoomError('not-now', 'The flight is not over.');
    this.stage = 'lobby'; this.votes = {}; this.mission = null; this.result = null;
    this.touch();
  }

  /** Move time on by dt seconds. Returns true while there is something new to send. */
  tick(dt) {
    if (this.stage === 'count') {
      this.countLeft -= dt * 1000;
      if (this.countLeft <= 0) { this.stage = 'flight'; this.flights++; this.mission.liftoff(); }
      this.rev++;
      return true;
    }
    if (this.stage !== 'flight') return false;
    const m = this.mission;
    m.step(dt);
    while (this.seenEv < m.events.length) this.note(m.events[this.seenEv++]);
    if (m.phase === 'done' || m.phase === 'fail') {
      this.stage = 'over';
      const sc = m.score();
      Crew.SEATS.forEach((s) => { const o = this.ownerOf(s); sc.seats[s].who = o ? o.name : ''; });
      this.result = sc;
      this.touchedAt = Date.now();
    }
    this.rev++;
    return true;
  }

  /** What every player is allowed to see. Seat tokens never leave the server. */
  snapshot() {
    const seats = {};
    Crew.SEATS.forEach((s) => { const o = this.ownerOf(s); seats[s] = o ? o.id : null; });
    return {
      kind: 'crew', code: this.code, rev: this.rev, stage: this.stage, count: Math.max(0, Math.ceil(this.countLeft / 1000)), build: this.build,
      players: this.players.map((p) => ({ id: p.id, name: p.name, online: p.online })), seats, votes: this.votes,
      m: this.mission ? this.mission.state() : null, ev: this.log, result: this.result
    };
  }
}

module.exports = { CrewRoom };
