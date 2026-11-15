/* Orbit Ranger — the crew mission on separate devices: the browser's end of the wire.
 * Up to four players fly one rocket. The flight runs on the room server (server/src/rooms/crewRoom.js); this file
 * only carries messages. It sends what this player is holding or pressing, and hands every new picture of the
 * flight to whoever is listening (js/ui/levels/crewnet.js).
 * A seat survives a dropped connection and a reloaded page: its key is kept for this browser tab.
 */
(function () {
  'use strict';
  var RG = window.RG, KEY = 'orbit-ranger.crew';
  var ws = null, seat = null, retries = 0, retryTimer = 0, wanted = false, sentSteer = 0, sentBurn = false;
  var N = {
    available: /^https?:$/.test(window.location.protocol),
    active: false,  // true while seated in a crew room
    me: null,       // this player's id
    state: null,    // the latest room state from the server
    on: { state: null, error: null, closed: null }
  };

  function url() {
    var meta = document.querySelector('meta[name="orbit-ranger-server"]'); // set this when the game and the server live on different hosts
    if (meta && meta.content) return meta.content;
    return (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';
  }
  function emit(name, arg) { if (N.on[name]) N.on[name](arg); }
  function send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
  function remember() { try { if (seat) sessionStorage.setItem(KEY, JSON.stringify(seat)); else sessionStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
  /** A seat kept from before a reload, if there is one. */
  N.kept = function () { try { var s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return s && s.code && s.id && s.token ? s : null; } catch (e) { return null; } };

  function closed(text) {
    wanted = false; seat = null; ws = null; remember();
    N.active = false; N.me = null; N.state = null;
    emit('closed', text);
  }
  function connect(first) {
    clearTimeout(retryTimer);
    try { ws = new WebSocket(url()); } catch (e) { closed('Could not reach the game server.'); return; }
    var sock = ws, opened = false;
    sock.onopen = function () { opened = true; sock.send(JSON.stringify(first)); };
    sock.onmessage = function (e) {
      var m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'joined') {
        retries = 0; sentSteer = 0; sentBurn = false;
        seat = { code: m.state.code, id: m.you, token: m.token }; remember();
        N.active = true; N.me = m.you; N.state = m.state;
        emit('state', m.state);
      } else if (m.t === 'state') {
        if (!m.state || m.state.kind !== 'crew') return;
        if (N.state && m.state.rev < N.state.rev) return; // an older picture that arrived late
        N.state = m.state;
        emit('state', m.state);
      } else if (m.t === 'error') {
        if (!N.active) { wanted = false; seat = null; remember(); sock.close(); emit('error', m.message); }  // could not get in
        else if (m.code === 'no-seat' || m.code === 'no-room') { wanted = false; sock.close(); closed('The crew room has closed.'); }
        else emit('error', m.message);
      }
    };
    sock.onclose = function () {
      if (sock !== ws) return;
      ws = null;
      if (!wanted) return;
      if (!opened && !seat) { closed('No game server answered at this address.'); return; }
      // the phone slept or the network blinked: come back to the same seat
      if (seat && retries < 8) {
        retries++;
        retryTimer = setTimeout(function () { connect({ t: 'rejoin', code: seat.code, id: seat.id, token: seat.token }); }, 500 * retries);
      } else closed('Connection lost.');
    };
  }

  N.create = function (name, build) {
    wanted = true; retries = 0;
    var m = { t: 'crew-create', name: name };
    if (build && build.tank && build.engines) { m.tank = build.tank; m.engines = build.engines; }
    connect(m);
  };
  N.join = function (code, name) { wanted = true; retries = 0; connect({ t: 'crew-join', code: code, name: name }); };
  /** Go back to a seat kept from before a reload. */
  N.resume = function () { var s = N.kept(); if (!s) return false; seat = s; wanted = true; retries = 0; connect({ t: 'rejoin', code: s.code, id: s.id, token: s.token }); return true; };
  N.leave = function () {
    send({ t: 'leave' });
    wanted = false; clearTimeout(retryTimer);
    if (ws) ws.close();
    closed('');
  };
  N.go = function (on) { send({ t: 'crew-go', go: !!on }); };
  /** What the pilot is holding: -1 left, 1 right, 0 nothing. Sent only when it changes. */
  N.steer = function (v) { if (v !== sentSteer) { sentSteer = v; send({ t: 'crew-steer', v: v }); } };
  /** Whether the navigator is holding the burn button. Sent only when it changes. */
  N.burn = function (on) { on = !!on; if (on !== sentBurn) { sentBurn = on; send({ t: 'crew-burn', on: on }); } };
  N.act = function (a) { send({ t: 'crew-act', a: a }); };
  N.again = function () { send({ t: 'crew-again' }); };

  /** The seats this player has, in order. */
  N.seats = function () { var s = N.state; return s ? RG.Crew.SEATS.filter(function (k) { return s.seats[k] === N.me; }) : []; };
  N.mine = function (k) { return !!N.state && N.state.seats[k] === N.me; };
  N.nameOf = function (id) { var p = N.state && N.state.players.filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; };
  /**
   * The link to send to the rest of the crew. If this page was opened at localhost, other devices need this
   * computer's address on the network instead; the server knows it (/lan.json).
   */
  N.link = function (code, cb) {
    var here = window.location, local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(here.hostname), own = here.origin + here.pathname + '?crew=' + code;
    if (!local || !window.fetch) { cb(own, false); return; }
    fetch('/lan.json').then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.urls && j.urls.length) cb(j.urls[0] + here.pathname + '?crew=' + code, false); else cb(own, true);
    }).catch(function () { cb(own, true); });
  };

  RG.CrewNet = N;
})();
