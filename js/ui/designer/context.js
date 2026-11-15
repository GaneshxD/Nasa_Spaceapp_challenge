/* Orbit Ranger — mission designer: shared context.
 * The state of the level 5 game, the constants every screen needs and a few
 * helpers. Each screen file registers its draw function in X.screens; the
 * controller (ui/app.js) decides which one is showing.
 */
(function () {
  'use strict';
  var RG = window.RG, D = RG.DATA, M = RG.Model;
  var $ = function (id) { return document.getElementById(id); };
  var small = window.matchMedia('(max-width: 860px)');

  var state = {
    screen: 'title', step: 0, view: 'bay',
    design: RG.blankDesign(), diff: 'engineer',
    players: ['Ranger'], seed: 1,
    votes: {}, asked: {}, autoLab: {},
    sim: null, log: [], skipping: false,
    result: null, score: null, debrief: null
  };

  var STEP_VIEWS = {
    sensor: ['bay'], orbit: ['orbit'], bus: ['bay'], brain: ['bay'],
    radio: ['bay', 'stations'], power: ['bay', 'shadow'], rocket: ['pad']
  };
  var VIEW_NAMES = { bay: 'Satellite', stations: 'Station test', shadow: 'Shadow test' };
  var AREA_ROLE = { science: 'science', launch: 'nav', body: 'eng', power: 'eng', data: 'comms' };
  var CAPTIONS = {
    brief: '',
    bay: 'Your satellite on the build stand. The engineer is 1.7 m tall. Drag to look around.',
    shadow: 'The ghostly tunnel is Earth’s shadow. The purple part of the ring is the dark part of each lap.',
    stations: 'Green patches show where a ground station can hear the satellite. A beam appears while they talk.',
    mission: ''
  };

  /* ---------- helpers ---------- */
  function owner(role) { return state.players[D.ROLE_ORDER.indexOf(role) % state.players.length]; }
  function team() { return state.players.length > 1; }
  function evalNow() { return M.evaluate(state.design, state.diff); }
  function step() { return D.STEPS[state.step]; }
  function say(text) { var live = $('live'); live.textContent = ''; setTimeout(function () { live.textContent = text; }, 40); }
  function possessive(name) { return name + '’s'; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /** '2023-06-12' → '12 June 2023' */
  function fmtDate(iso) { var p = iso.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; }
  /** The week covered by the "recent fires" layer, e.g. '7 to 14 November 2026'. */
  function recentWeek() {
    var r = RG.NASA_FIRES.recent, a = r.from.split('-'), b = r.to.split('-');
    return a[0] === b[0] && a[1] === b[1] ? +a[2] + ' to ' + fmtDate(r.to) : fmtDate(r.from) + ' to ' + fmtDate(r.to);
  }

  /* ---------- the one dialog box ---------- */
  var onClose = null;
  function openDialog(html, cb) {
    $('dialog-body').innerHTML = html;
    onClose = cb || null;
    if (!$('dialog').open) $('dialog').showModal();
  }
  function okButton(text) {
    return '<div class="actions"><button type="button" class="btn primary" data-act="close" autofocus>' + text + '</button></div>';
  }
  function closed() { var cb = onClose; onClose = null; if (cb) cb(); }

  /* ---------- small DOM helpers ---------- */
  function setBar(id, frac, level) {
    var el = $(id);
    if (!el) return;
    el.style.width = Math.max(0, Math.min(100, frac * 100)).toFixed(0) + '%';
    el.parentNode.dataset.level = level || '';
  }
  function setText(id, t) { var el = $(id); if (el && el.textContent !== t) el.textContent = t; }

  /** A short message that fades away by itself. Also read out by screen readers. */
  function toast(text) {
    if (!text) return;
    var el = $('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = text;
    el.className = 'is-on';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.className = ''; }, 3200);
  }

  RG.state = state;
  RG.Designer = {
    state: state, $: $, small: small, screens: {}, dialogs: {},
    STEP_VIEWS: STEP_VIEWS, VIEW_NAMES: VIEW_NAMES, AREA_ROLE: AREA_ROLE, CAPTIONS: CAPTIONS,
    owner: owner, team: team, evalNow: evalNow, step: step, say: say, possessive: possessive,
    fmtDate: fmtDate, recentWeek: recentWeek, openDialog: openDialog, okButton: okButton, dialogClosed: closed,
    setBar: setBar, setText: setText, toast: toast
  };
})();
