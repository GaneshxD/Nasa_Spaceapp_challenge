'use strict';
/* The messages a browser may send, and the checks each one must pass.
 * Everything from the network is untrusted: a message is parsed, its type is
 * looked up here, and only the listed fields, in the listed shapes, go further.
 *
 * Browser -> server                       Server -> browser
 *   create { name, diff }                   joined { you, token, state }
 *   join   { code, name }                   state  { state }
 *   rejoin { code, id, token }              launch { seed }
 *   pick   { group, key }                   error  { code, message }
 *   vote   { role, go }
 *   launch {}
 *   leave  {}
 */
const { ALPHABET, CODE_LENGTH } = require('../rooms/memoryStore');

const CODE = new RegExp('^[' + ALPHABET + ']{' + CODE_LENGTH + '}$');
const KEY = /^[A-Za-z0-9_-]{1,24}$/;
const HEX = /^[0-9a-f]{32}$/;
const UUID = /^[0-9a-f-]{36}$/;

/** A display name: plain text, 1 to 14 characters, no control characters. */
function name(v) {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 14);
  return s || null;
}
const str = (re) => (v) => (typeof v === 'string' && re.test(v) ? v : null);
const bool = (v) => (typeof v === 'boolean' ? v : null);
const code = (v) => (typeof v === 'string' && CODE.test(v.toUpperCase()) ? v.toUpperCase() : null);

const SHAPES = {
  create: { name, diff: str(KEY) },
  join: { code, name },
  rejoin: { code, id: str(UUID), token: str(HEX) },
  pick: { group: str(KEY), key: str(KEY) },
  vote: { role: str(KEY), go: bool },
  launch: {},
  leave: {}
};

/** Returns { t, ...fields } or null when the message is not one we accept. */
function parse(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return null; }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.t !== 'string') return null;
  const shape = Object.prototype.hasOwnProperty.call(SHAPES, msg.t) ? SHAPES[msg.t] : null;
  if (!shape) return null;
  const out = { t: msg.t };
  for (const field of Object.keys(shape)) {
    const v = shape[field](msg[field]);
    if (v === null) return null;
    out[field] = v;
  }
  return out;
}

const out = {
  joined: (player, state) => JSON.stringify({ t: 'joined', you: player.id, token: player.token, state }),
  state: (state) => JSON.stringify({ t: 'state', state }),
  launch: (seed) => JSON.stringify({ t: 'launch', seed }),
  error: (code, message) => JSON.stringify({ t: 'error', code, message })
};

module.exports = { parse, out };
