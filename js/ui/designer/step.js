/* Orbit Ranger — mission designer: one design step.
 * Option tiles, the speech bubble for what is picked, the coach's hints, the
 * “what your sensor sees” picture and the shadow and station tests.
 */
(function () {
  'use strict';
  var RG = window.RG, X = RG.Designer, D = RG.DATA, M = RG.Model, W = RG.Widgets;
  var state = X.state, esc = W.esc, $ = X.$, owner = X.owner, team = X.team, evalNow = X.evalNow, step = X.step;
  var possessive = X.possessive;

  /* ----- a design step ----- */
  var LEVEL_WORD = { ok: 'Good.', warn: 'Careful.', bad: 'Problem.' };
  /** A tile: picture, name, a few numbers and a face. The words wait in detailHtml until it is picked. */
  function cardHtml(g, key) {
    var item = D[g.from][key], d = state.design;
    var on = g.pick === 'any' ? d.extras.indexOf(key) >= 0 : d[g.key] === key;
    var lv = W.liveLine(g.key, key, d, state.diff).level;
    var locked = !RG.Room.mine(step().role); // in an online room, another player's console
    return '<button type="button" class="card' + (locked ? ' is-locked' : '') + '" data-act="pick"' + (locked ? ' aria-disabled="true"' : ' data-drag="' + g.key + '"') + ' data-group="' + g.key + '" data-key="' + key + '" aria-pressed="' + on + '">' +
      '<span class="card-icon">' + W.icon(item.icon || key) + '</span>' +
      '<span class="card-name">' + item.name + '</span>' +
      '<span class="card-chips">' + W.chips(g.key, item) + '</span>' +
      (lv ? '<span class="card-face" data-level="' + lv + '">' + W.icon(lv) + '<span class="sr">' + LEVEL_WORD[lv] + '</span></span>' : '') +
      '<span class="card-mark" aria-hidden="true">✓</span></button>';
  }

  /** The speech bubble under a group: one short sentence about each picked tile. */
  function detailHtml(g) {
    var d = state.design;
    var keys = g.pick === 'any' ? d.extras : d[g.key] ? [d[g.key]] : [];
    return keys.map(function (key) {
      var item = D[g.from][key], live = W.liveLine(g.key, key, d, state.diff);
      return '<div class="card-detail" data-level="' + live.level + '"><p><b>' + item.name + '.</b> ' + esc(item.blurb.split('. ')[0].replace(/\.$/, '')) + '.</p>' +
        (live.text ? '<p class="card-live">' + (LEVEL_WORD[live.level] ? '<b>' + LEVEL_WORD[live.level] + '</b> ' : '') + esc(live.text) + '</p>' : '') +
        (item.real ? '<details><summary>In real life</summary><p>' + item.real + '</p></details>' : '') + '</div>';
    }).join('');
  }

  function hintsHtml(ev) {
    var st = step(), df = D.DIFFICULTY[state.diff];
    var list = ev.checks.filter(function (c) {
      return c.level !== 'go' && (c.step === st.id || c.id === 'budget');
    });
    if (!list.length) return '';
    if (!df.hints && !state.asked[st.id]) {
      return '<div class="hint"><button type="button" class="link" data-act="ask">Ask the coach for a hint</button></div>';
    }
    return list.slice(0, 2).map(function (c) {
      return '<div class="hint" data-level="' + c.level + '"><b>' + esc(c.title) + '</b>' + esc(c.text) + '</div>';
    }).join('');
  }

  function sightHtml(ev) {
    var d = state.design;
    if (!d.sensor) return '';
    var px = ev.pixel != null ? ev.pixel : RG.Physics.pixelMeters(700, D.SENSORS[d.sensor].ifov, ev.blur);
    var sizes = Object.keys(D.FIRE_SIZES).filter(function (k) { return px <= D.FIRE_SIZES[k].maxPixel; });
    var p = M.fmtPixel(px), verdict;
    if (sizes.length === 3) verdict = 'With ' + p + ' pixels you can spot all three fires.';
    else if (sizes.length === 2) verdict = 'With ' + p + ' pixels the small fire is lost inside one pixel. You still catch the medium and large ones.';
    else if (sizes.length === 1) verdict = 'With ' + p + ' pixels only the large fire shows up.';
    else verdict = px > 6000 ? 'One pixel is ' + p + ' wide, bigger than this whole patch of forest. No fire shows up.' : 'With ' + p + ' pixels even the large fire is too faint to notice.';
    if (ev.pixel == null) verdict += ' This is from 700 km up. The orbit you pick next will change it.';
    return '<div class="widget sight"><h2>What your sensor sees</h2>' +
      '<canvas id="sight" width="656" height="244" role="img" aria-label="Left: three fires in a forest. Right: the same scene as your sensor records it. ' + esc(verdict) + '"></canvas>' +
      '<div class="sight-cap"><span>A patch of forest 6 km wide</span><span>Your heat picture of it</span></div>' +
      '<p>' + esc(verdict) + '</p></div>';
  }

  function labHtml(id, ready) {
    if (id !== 'power' && id !== 'radio') return '';
    var lab = id === 'power' ? 'shadow' : 'stations', title = id === 'power' ? 'Shadow test' : 'Station test';
    if (!ready) return '';
    if (state.view !== lab) {
      return '<div class="widget"><h2>' + title + '</h2><p>' +
        (id === 'power' ? 'Watch your battery through three days of sunlight and shadow.' : 'Watch the memory fill up and empty as the satellite passes its ground stations.') +
        '</p><button type="button" class="btn" style="margin-top:10px" data-act="view" data-view="' + lab + '">Run the ' + title.toLowerCase() + '</button></div>';
    }
    if (id === 'power') {
      return '<div class="widget"><h2>Shadow test</h2><div class="widget-row"><span id="lab-state">In sunlight</span><b id="lab-num">100%</b></div>' +
        '<div class="bar" id="lab-bar"><i></i></div><p id="lab-note">The bar is your battery.</p></div>';
    }
    return '<div class="widget"><h2>Station test</h2><div class="widget-row"><span id="lab-state">No station in view</span><b id="lab-num">0 GB</b></div>' +
      '<div class="bar" id="lab-bar"><i></i></div><p id="lab-note">The bar is the computer’s memory.</p></div>';
  }

  function renderStep() {
    var st = step(), d = state.design, ev = evalNow(), role = D.ROLES[st.role];
    var ready = M.stepDone(d, st), last = state.step === D.STEPS.length - 1;
    var groups = st.groups.map(function (g) {
      return '<fieldset class="group"><legend>' + g.label + '</legend>' +
        (g.help ? '<p class="group-help">' + g.help + '</p>' : '') +
        '<div class="cards picks">' + Object.keys(D[g.from]).map(function (k) { return cardHtml(g, k); }).join('') + '</div>' +
        '<div aria-live="polite">' + detailHtml(g) + '</div></fieldset>';
    }).join('');
    var showSight = st.id === 'sensor' || st.id === 'orbit' || st.id === 'brain';
    var trouble = ev.checks.filter(function (c) { return c.level !== 'go' && (c.step === st.id || c.id === 'budget'); });
    var mood = trouble.some(function (c) { return c.level === 'nogo'; }) ? 'sad' : trouble.length ? 'worry' : ready ? 'cheer' : 'happy';
    var next = last ? 'Launch check' : 'Next: ' + D.STEPS[state.step + 1].nav;
    $('panel').innerHTML =
      '<div class="sheet" style="--role:' + role.color + '"><div class="sheet-scroll">' +
      '<div class="step-meta"><span>Step ' + (state.step + 1) + ' of ' + D.STEPS.length + '</span>' +
      '<span class="role-tag">' + role.name + '</span>' +
      (team() ? '<span class="turn-tag">' + esc(possessive(owner(st.role))) + ' turn</span>' : '') +
      (RG.Room.active ? '<span class="room-tag">Room ' + esc(RG.Room.state.code) + '</span>' : '') + '</div>' +
      (RG.Room.mine(st.role) ? '' : '<div class="hint"><b>' + esc(owner(st.role)) + ' chooses here.</b>Talk it over: every choice spends the team’s budget.</div>') +
      '<h1 tabindex="-1">' + st.title + '</h1>' +
      '<div class="coach"><span class="coach-face">' + W.pip(mood) + '</span><p>' + W.terms(st.coach) + '</p></div>' +
      hintsHtml(ev) + groups +
      (showSight ? sightHtml(ev) : '') + labHtml(st.id, ready) +
      '<details class="why"><summary>Why does this matter?</summary><p>' + W.terms(st.why) + '</p></details>' +
      '</div><div class="sheet-foot">' +
      '<button type="button" class="btn" data-act="back">Back</button><span class="grow foot-note">' + (ready ? '' : 'Drag one of each') + '</span>' +
      '<button type="button" class="btn primary" data-act="next"' + (ready ? '' : ' disabled') + '>' + next + '</button></div></div>';
    var cv = $('sight');
    if (cv) W.drawSight(cv, ev.pixel != null ? ev.pixel : RG.Physics.pixelMeters(700, D.SENSORS[d.sensor].ifov, ev.blur));
  }

  X.screens.step = renderStep;
})();
