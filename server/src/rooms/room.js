'use strict';
/* A room: up to four players sharing one mission design.
 * Pure game rules with no network code, so it can be unit-tested directly.
 * The four consoles (science, nav, eng, comms) are dealt out in joining order,
 * the same way the single-screen game shares them, and only a console's owner
 * may change its parts or press its go button.
 */
const crypto = require('node:crypto');
const { DATA, Model, blankDesign } = require('../game/core');

class RoomError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

class Room {
  constructor(code, diff, opts = {}) {
    if (!DATA.DIFFICULTY[diff]) throw new RoomError('bad-request', 'Unknown level.');
    this.code = code;
    this.diff = diff;
    this.maxPlayers = opts.maxPlayers || 4;
    this.players = [];           // in joining order: { id, token, name, online, leftAt }
    this.design = blankDesign();
    this.votes = {};             // role -> true
    this.rev = 0;                // goes up on every change, so clients can ignore stale states
    this.touchedAt = Date.now();
  }

  touch() { this.rev++; this.touchedAt = Date.now(); }
  get host() { return this.players[0] || null; }
  player(id) { return this.players.find((p) => p.id === id) || null; }

  /** The player who owns a console. */
  ownerOf(role) {
    const i = DATA.ROLE_ORDER.indexOf(role);
    return i < 0 || !this.players.length ? null : this.players[i % this.players.length];
  }

  join(name) {
    if (this.players.length >= this.maxPlayers) throw new RoomError('room-full', 'This room already has four players.');
    const p = { id: crypto.randomUUID(), token: crypto.randomBytes(16).toString('hex'), name, online: true, leftAt: 0 };
    this.players.push(p);
    this.votes = {}; // the consoles are dealt again, so every go is asked again
    this.touch();
    return p;
  }

  /** A dropped player returns to their own seat. */
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
    this.touch();
  }

  remove(id) {
    const n = this.players.length;
    this.players = this.players.filter((p) => p.id !== id);
    if (this.players.length !== n) { this.votes = {}; this.touch(); }
  }

  /** Drop players whose seat has been empty for too long. Returns true if anyone was removed. */
  sweep(seatHoldMs, now = Date.now()) {
    const gone = this.players.filter((p) => !p.online && now - p.leftAt > seatHoldMs);
    gone.forEach((p) => this.remove(p.id));
    return gone.length > 0;
  }

  /** Choose a part. `extras` toggles; every other group holds one choice. */
  pick(playerId, group, key) {
    const step = DATA.STEPS.find((s) => s.groups.some((g) => g.key === group));
    const g = step && step.groups.find((x) => x.key === group);
    if (!g || !Object.prototype.hasOwnProperty.call(DATA[g.from], key)) throw new RoomError('bad-request', 'No such part.');
    const owner = this.ownerOf(step.role);
    if (!owner || owner.id !== playerId) throw new RoomError('not-your-console', 'That choice belongs to ' + (owner ? owner.name : 'another player') + '.');
    if (g.pick === 'any') {
      const i = this.design.extras.indexOf(key);
      if (i >= 0) this.design.extras.splice(i, 1); else this.design.extras.push(key);
    } else {
      if (this.design[group] === key) return;
      this.design[group] = key;
    }
    this.votes = {};
    this.touch();
  }

  vote(playerId, role, go) {
    const owner = this.ownerOf(role);
    if (!owner) throw new RoomError('bad-request', 'No such console.');
    if (owner.id !== playerId) throw new RoomError('not-your-console', 'Only ' + owner.name + ' can press that button.');
    if (go) this.votes[role] = true; else delete this.votes[role];
    this.touch();
  }

  /** The host launches once the design passes the same checks as in the browser and every console is go. */
  launch(playerId) {
    if (!this.host || this.host.id !== playerId) throw new RoomError('not-host', 'Only ' + (this.host ? this.host.name : 'the host') + ' can launch.');
    if (!Model.isComplete(this.design)) throw new RoomError('not-ready', 'The design is not finished.');
    if (Model.evaluate(this.design, this.diff).blocked.length) throw new RoomError('not-ready', 'Fix the no-go items first.');
    if (this.players.length > 1 && !DATA.ROLE_ORDER.every((r) => this.votes[r])) throw new RoomError('not-ready', 'Every console has to say go.');
    this.touch();
    return 1 + crypto.randomInt(9000); // the mission number: every player simulates the same mission from it
  }

  /** What every player is allowed to see. Seat tokens never leave the server. */
  snapshot() {
    return {
      code: this.code, diff: this.diff, rev: this.rev,
      players: this.players.map((p) => ({ id: p.id, name: p.name, online: p.online })),
      design: this.design, votes: this.votes
    };
  }
}

module.exports = { Room, RoomError };
