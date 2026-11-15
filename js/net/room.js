/* Orbit Ranger — team play on separate devices.
 * A thin client for the room server (server/). It only carries messages: the
 * server owns the shared design, and the mission designer listens to
 * Room.on.state / launch / error / closed and redraws.
 * The game never needs this file to work: opened from a double-click there is
 * no server, Room.available is false, and team play stays on one screen.
 */
(function () {
  'use strict';
  var RG = window.RG;
  var ws = null, seat = null, retries = 0, retryTimer = 0, wanted = false;
  var Room = {
    available: /^https?:$/.test(window.location.protocol),
    active: false,   // true while seated in a room
    me: null,        // this player's id
    state: null,     // the latest room state from the server
    on: { state: null, launch: null, error: null, closed: null }
  };

  function url() {
    var meta = document.querySelector('meta[name="orbit-ranger-server"]'); // set this when the game and the server live on different hosts
    if (meta && meta.content) return meta.content;
    return (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';
  }
  function emit(name, arg) { if (Room.on[name]) Room.on[name](arg); }
  function send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

  function closed(text) {
    wanted = false; seat = null; ws = null;
    Room.active = false; Room.me = null; Room.state = null;
    emit('closed', text);
  }

  function connect(first) {
    clearTimeout(retryTimer);
    try { ws = new WebSocket(url()); } catch (e) { closed('Could not reach the room server.'); return; }
    var sock = ws;
    sock.onopen = function () { sock.send(JSON.stringify(first)); };
    sock.onmessage = function (e) {
      var m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'joined') {
        retries = 0;
        seat = { code: m.state.code, id: m.you, token: m.token };
        Room.active = true; Room.me = m.you; Room.state = m.state;
        emit('state', m.state);
      } else if (m.t === 'state') {
        if (Room.state && m.state.rev < Room.state.rev) return; // an older state that arrived late
        Room.state = m.state;
        emit('state', m.state);
      } else if (m.t === 'launch') emit('launch', m.seed);
      else if (m.t === 'error') {
        emit('error', m.message);
        if (!Room.active) { wanted = false; sock.close(); }       // could not get in: give up quietly
        else if (m.code === 'no-seat' || m.code === 'no-room') { wanted = false; sock.close(); closed('The room has closed.'); }
      }
    };
    sock.onclose = function () {
      if (sock !== ws) return;
      ws = null;
      if (!wanted) return;
      // the phone slept or the network blinked: come back to the same seat
      if (seat && retries < 6) {
        retries++;
        retryTimer = setTimeout(function () { connect({ t: 'rejoin', code: seat.code, id: seat.id, token: seat.token }); }, 600 * retries);
      } else closed('Connection lost. You can keep playing on this device.');
    };
  }

  Room.create = function (name, diff) { wanted = true; retries = 0; connect({ t: 'create', name: name, diff: diff }); };
  Room.join = function (code, name) { wanted = true; retries = 0; connect({ t: 'join', code: code, name: name }); };
  Room.leave = function () {
    send({ t: 'leave' });
    wanted = false;
    if (ws) ws.close();
    closed('');
  };
  Room.pick = function (group, key) { send({ t: 'pick', group: group, key: key }); };
  Room.vote = function (role, go) { send({ t: 'vote', role: role, go: go }); };
  Room.launch = function () { send({ t: 'launch' }); };

  /** The player who owns a console: dealt out in joining order, exactly as the server does it. */
  Room.owner = function (role) {
    var players = Room.state ? Room.state.players : [], i = RG.DATA.ROLE_ORDER.indexOf(role);
    return players.length && i >= 0 ? players[i % players.length] : null;
  };
  Room.mine = function (role) { var o = Room.owner(role); return !Room.active || (!!o && o.id === Room.me); };
  Room.host = function () { return Room.state && Room.state.players[0]; };
  Room.isHost = function () { var h = Room.host(); return !Room.active || (!!h && h.id === Room.me); };

  RG.Room = Room;
})();
