'use strict';
/* Everything that can be tuned from the environment, in one place. */
const path = require('node:path');

function int(name, fallback) {
  const n = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

module.exports = Object.freeze({
  port: int('PORT', 8080),
  // The folder holding index.html. The server also hosts the game, so one address serves both.
  webRoot: path.resolve(__dirname, '..', '..'),
  // Extra origins allowed to open a socket, comma-separated. The server's own origin is always allowed.
  origins: (process.env.ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  maxRooms: int('MAX_ROOMS', 500),
  maxPlayers: 4,
  roomIdleMs: int('ROOM_IDLE_MINUTES', 120) * 60 * 1000, // a room nobody touches is removed
  seatHoldMs: int('SEAT_HOLD_SECONDS', 120) * 1000,      // a dropped player can come back to the same seat
  maxMessageBytes: 2048,
  rate: { burst: 30, perSecond: 6 },                     // messages allowed per connection
  maxBadJoins: 8,                                        // wrong room codes before the socket is closed
  heartbeatMs: 30 * 1000
});
