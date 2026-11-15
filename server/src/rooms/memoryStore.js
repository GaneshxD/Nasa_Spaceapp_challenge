'use strict';
/* Where rooms live: in this process's memory.
 * The rest of the server only uses create / get / delete / sweep / size, so a
 * shared store (Redis, for several server processes) can replace this file
 * without touching the game rules or the socket code.
 */
const crypto = require('node:crypto');
const { Room, RoomError } = require('./room');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: easy to read aloud and type on a phone
const CODE_LENGTH = 4;

class MemoryStore {
  constructor({ maxRooms, maxPlayers }) {
    this.rooms = new Map();
    this.maxRooms = maxRooms;
    this.maxPlayers = maxPlayers;
  }

  get size() { return this.rooms.size; }

  newCode() {
    for (let tries = 0; tries < 50; tries++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError('busy', 'No room codes are free right now.');
  }

  create(diff) {
    if (this.rooms.size >= this.maxRooms) throw new RoomError('busy', 'The server is full. Try again in a few minutes.');
    const room = new Room(this.newCode(), diff, { maxPlayers: this.maxPlayers });
    this.rooms.set(room.code, room);
    return room;
  }

  get(code) { return this.rooms.get(code) || null; }
  delete(code) { this.rooms.delete(code); }

  /** Remove held seats that timed out, then rooms that are empty or idle. Returns the rooms that changed. */
  sweep({ seatHoldMs, roomIdleMs }, now = Date.now()) {
    const changed = [];
    for (const room of this.rooms.values()) {
      if (room.sweep(seatHoldMs, now)) changed.push(room);
      if (!room.players.length || now - room.touchedAt > roomIdleMs) this.rooms.delete(room.code);
    }
    return changed.filter((r) => this.rooms.has(r.code));
  }
}

module.exports = { MemoryStore, CODE_LENGTH, ALPHABET };
