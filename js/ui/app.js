/* Orbit Ranger — the game itself.
 * Screens, in order:
 *   title → crew → brief → step (seven design steps) → review (Go / No-go)
 *   → launch → mission (three years) → report
 */
(function () {
  'use strict';
  var RG = window.RG, D = RG.DATA, M = RG.Model, W = RG.Widgets;
  var V = RG.Views, Stage = RG.Stage, A = RG.Audio, Sim = RG.Sim, Score = RG.Score;
  var esc = W.esc;
  var $ = function (id) { return document.getElementById(id); };
  var panel, gauges, rail, hud, caption, viewtabs, dialog, dialogBody, live, fade, count, dock;
  var small = window.matchMedia('(max-width: 860px)');

  var state = {
    screen: 'title', step: 0, view: 'bay',
    design: RG.blankDesign(), diff: 'engineer',
    players: ['Ranger'], seed: 1,
    votes: {}, asked: {}, autoLab: {},
    sim: null, log: [], skipping: false,
    result: null, score: null, debrief: null
  };
  RG.state = state;

  var STEP_VIEWS = {
    sensor: ['bay'], orbit: ['orbit'], bus: ['bay'], brain: ['bay'],
    radio: ['bay', 'stations'], power: ['bay', 'shadow'], rocket: ['pad']
  };
  var VIEW_NAMES = { bay: 'Satellite', stations: 'Station test', shadow: 'Shadow test' };
  var SLOT_ROLE = {
    sensor: 'science', extra: 'science', bus: 'eng', panels: 'eng', battery: 'eng',
    computer: 'comms', pointing: 'comms', radio: 'comms'
  };
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
  function say(text) { live.textContent = ''; setTimeout(function () { live.textContent = text; }, 40); }
  function possessive(name) { return name + '’s'; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /** '2023-06-12' → '12 June 2023' */
  function fmtDate(iso) { var p = iso.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; }
  /** The week covered by the "recent fires" layer, e.g. '7 to 14 November 2026'. */
  function recentWeek() {
    var r = RG.NASA_FIRES.recent, a = r.from.split('-'), b = r.to.split('-');
    return a[0] === b[0] && a[1] === b[1] ? +a[2] + ' to ' + fmtDate(r.to) : fmtDate(r.from) + ' to ' + fmtDate(r.to);
  }

  /** Fade to black, change the scene, fade back in. */
  function cut(fn) {
    fade.classList.add('is-on');
    setTimeout(function () {
      fn();
      setTimeout(function () { fade.classList.remove('is-on'); }, 90);
    }, 240);
  }

  function setView(name, opts) {
    var hard = V.name && V.family(V.name) !== V.family(name);
    if (hard) cut(function () { V.set(name, opts); }); else V.set(name, opts);
  }

  /** Keep the 3D subject clear of the panels. */
  function layout() {
    var w = window.innerWidth, h = window.innerHeight, s = state.screen;
    var sheet = panel.querySelector('.sheet') || document.querySelector('.lv-side:not([hidden])');
    if (s === 'map') Stage.setOffset(small.matches ? 0 : -w * 0.22, 0);
    else if (s === 'title') Stage.setOffset(small.matches ? 0 : -w * 0.2, small.matches ? h * 0.17 : 0);
    else if (!sheet) Stage.setOffset(0, 0);
    else if (small.matches) Stage.setOffset(0, sheet.offsetHeight / 2);
    else Stage.setOffset(sheet.offsetWidth / 2, s === 'step' ? 34 : 0);
  }

  function go(screen) {
    Stage.hidden = false;
    state.screen = screen;
    document.body.dataset.screen = screen;
    if (screen === 'title' || screen === 'crew') setView('title');
    else if (screen === 'brief') setView('brief');
    else if (screen === 'step') enterStep();
    else if (screen === 'review') setView('bay', { focus: 'all' });
    else if (screen === 'report') setView('report');
    render();
    var h = panel.querySelector('h1');
    if (h && screen !== 'title') h.focus({ preventScroll: true });
  }

  function enterStep() {
    var id = step().id, views = STEP_VIEWS[id];
    state.view = views[0];
    applyStepView();
  }
  function applyStepView() {
    var id = step().id;
    if (state.view === 'bay') setView('bay', { focus: id });
    else setView(state.view);
  }

  /* ---------- rendering ---------- */
  function render() {
    var s = state.screen;
    if (s === 'title') renderTitle();
    else if (s === 'crew') renderCrew();
    else if (s === 'brief') renderBrief();
    else if (s === 'step') renderStep();
    else if (s === 'review') renderReview();
    else if (s === 'report') renderReport();
    else panel.innerHTML = '';
    if (s !== 'map' && s !== 'level') document.getElementById('levels').innerHTML = '';
    renderRail();
    renderChrome();
    layout();
  }

  function renderChrome() {
    var s = state.screen, tabs = '', cap = '';
    if (s === 'step') {
      var id = step().id, views = STEP_VIEWS[id], ready = M.stepDone(state.design, step());
      if (views.length > 1) {
        tabs = views.map(function (v) {
          return '<button type="button" data-act="view" data-view="' + v + '" aria-pressed="' + (state.view === v) + '"' +
            (v !== 'bay' && !ready ? ' disabled title="Make your picks first"' : '') + '>' + VIEW_NAMES[v] + '</button>';
        }).join('');
      }
      if (state.view === 'orbit') {
        var o = state.design.orbit;
        cap = !o ? 'Three ways to circle the Earth. Pick one to test it.'
          : o === 'geo' ? 'The far orbit, drawn to scale. The satellite turns with the Earth, so it always sees the same side.'
          : 'One day in fast-forward. The blue paint shows the ground your sensor has seen.';
      } else if (state.view === 'pad') {
        cap = state.design.rocket ? 'Your rocket on the launch pad. Drag to look around.' : 'The launch pad is empty. Pick a rocket.';
      } else cap = CAPTIONS[state.view] || '';
    } else if (s === 'brief') cap = 'Small specks: real fires NASA satellites saw from ' + recentWeek() + '. Named dots: the 14 fire zones in your mission.';
    else if (s === 'title') cap = small.matches ? '' : 'Each orange speck is a real fire seen by NASA’s MODIS instruments, ' + recentWeek() + '.';
    else if (s === 'review') cap = CAPTIONS.bay;
    viewtabs.innerHTML = tabs;
    document.body.classList.toggle('has-tabs', !!tabs);
    caption.textContent = cap;
    gauges.innerHTML = s === 'step' ? W.gauges(evalNow(), state.design) : '';
    dock.innerHTML = s === 'step' ? W.dock(step().groups.map(function (g) {
      var d = state.design, keys = g.pick === 'any' ? d.extras : d[g.key] ? [d[g.key]] : [], all = Object.keys(D[g.from]);
      return {
        key: g.key, label: g.label, multi: g.pick === 'any', icon: D[g.from][all[0]].icon || all[0],
        items: keys.map(function (k) {
          return { icon: D[g.from][k].icon || k, name: D[g.from][k].name, attrs: 'data-act="pick" data-group="' + g.key + '" data-key="' + k + '"' };
        })
      };
    })) : '';
  }

  function renderRail() {
    var s = state.screen;
    if (s !== 'step' && s !== 'review') { rail.innerHTML = ''; return; }
    var d = state.design, open = D.STEPS.length;
    for (var i = 0; i < D.STEPS.length; i++) if (!M.stepDone(d, D.STEPS[i])) { open = i; break; }
    var html = D.STEPS.map(function (st, i) {
      var cur = s === 'step' && i === state.step, done = M.stepDone(d, st);
      return '<li><button type="button" class="rail-btn' + (done ? ' is-done' : '') + '" data-act="goto" data-step="' + st.id + '"' +
        (cur ? ' aria-current="step"' : '') + (i > open ? ' disabled' : '') + '><b>' + (i + 1) + '</b><span>' + st.nav + '</span></button></li>';
    }).join('');
    html += '<li><button type="button" class="rail-btn" data-act="review"' + (s === 'review' ? ' aria-current="step"' : '') +
      (M.isComplete(d) ? '' : ' disabled') + '><b>' + (D.STEPS.length + 1) + '</b><span>Check</span></button></li>';
    rail.innerHTML = '<ol>' + html + '</ol>';
  }

  /* ----- title ----- */
  function renderTitle() {
    var orbit = Stage.reducedMotion ? '' :
      '<animateMotion dur="7s" repeatCount="indefinite" path="M10,60 a90,34 0 1,0 180,0 a90,34 0 1,0 -180,0"/>';
    panel.innerHTML =
      '<div class="hero">' +
      '<h1><span><span class="o">O<svg class="title-orbit" viewBox="0 0 200 120" aria-hidden="true"><g transform="rotate(-20 100 60)">' +
      '<ellipse cx="100" cy="60" rx="90" ry="34" fill="none" stroke="#F2542D" stroke-width="4"/>' +
      '<circle r="8" cx="0" cy="0" fill="#fff">' + orbit + '</circle></g></svg></span>rbit</span><span>Ranger</span></h1>' +
      '<p class="lede">Build a rocket. Fly it to orbit. Spot wildfires from space.</p>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn primary big" data-act="play">Play</button>' +
      '<button type="button" class="btn ghost" data-act="code">Use a mission code</button></div>' +
      '<p class="fine">The Earth and every fire in the game are real NASA data.</p>' +
      '</div>';
  }

  /* ----- crew ----- */
  function renderCrew() {
    var n = state.players.length;
    var names = state.players.map(function (name, i) {
      var jobs = D.ROLE_ORDER.filter(function (r, ri) { return ri % n === i; }).map(function (r) {
        return '<span class="role-tag" style="--role:' + D.ROLES[r].color + '">' + D.ROLES[r].name + '</span>';
      }).join('');
      return '<div class="name-row"><label for="name-' + i + '">Player ' + (i + 1) + '</label>' +
        '<input id="name-' + i + '" data-name="' + i + '" maxlength="14" autocomplete="off" value="' + esc(name) + '">' +
        '<div class="jobs">' + jobs + '</div></div>';
    }).join('');
    var diffs = Object.keys(D.DIFFICULTY).map(function (k) {
      var df = D.DIFFICULTY[k];
      return '<button type="button" class="card" data-act="diff" data-key="' + k + '" aria-pressed="' + (state.diff === k) + '">' +
        '<span><span class="card-name">' + df.name + '</span><span class="card-blurb">' + df.note + '</span>' +
        '<span class="chip">Budget: ' + (isFinite(df.budget) ? '$' + df.budget + ' million' : 'no limit') + '</span></span>' +
        '<span class="card-mark">Picked</span></button>';
    }).join('');
    panel.innerHTML =
      '<div class="sheet"><div class="sheet-scroll">' +
      '<h1 tabindex="-1">Pick your crew</h1>' +
      '<p>Play alone, or share the four jobs between up to four players.</p>' +
      '<h2 id="lbl-count">How many players?</h2>' +
      '<div class="seg" role="group" aria-labelledby="lbl-count">' + [1, 2, 3, 4].map(function (k) {
        return '<button type="button" data-act="players" data-n="' + k + '" aria-pressed="' + (n === k) + '">' + k + '</button>';
      }).join('') + '</div>' +
      '<div class="names">' + names + '</div>' +
      '<fieldset class="group diff"><legend>How hard?</legend><div class="cards">' + diffs + '</div></fieldset>' +
      '</div><div class="sheet-foot"><span class="grow"></span>' +
      '<button type="button" class="btn primary" data-act="brief">Done</button></div></div>';
  }

  /* ----- briefing ----- */
  function renderBrief() {
    var df = D.DIFFICULTY[state.diff];
    var crew = D.ROLE_ORDER.map(function (r) {
      return '<li><span><span class="role-tag" style="--role:' + D.ROLES[r].color + '">' + D.ROLES[r].name + '</span>' +
        (team() ? ' ' + esc(owner(r)) : '') + '</span><span>' + D.ROLES[r].job + '</span></li>';
    }).join('');
    panel.innerHTML =
      '<div class="sheet"><div class="sheet-scroll">' +
      '<h1 tabindex="-1">Mission: ' + D.MISSION.name + '</h1>' +
      '<p>Wildfires start small. Design <b>' + D.MISSION.satellite + '</b>, a satellite that spots them from space and warns firefighters fast.</p>' +
      '<h2>Goals</h2><ol class="goals">' + D.MISSION.goals.map(function (g) {
        return '<li>' + (g.id === 'budget' && isFinite(df.budget) ? 'Stay inside the budget: $' + df.budget + ' million' : g.text) + '</li>';
      }).join('') + '</ol>' +
      '<p class="fact"><b>Every fire in this game is real.</b> NASA satellites saw each one in 2023.</p>' +
      (team() ? '<h2>Crew</h2><ul class="huddle">' + crew + '</ul>' : '') +
      '<p style="margin-top:12px"><button type="button" class="link" data-act="crew">' + (team() ? 'Change crew or level' : 'Add players or change level') + '</button> (' + state.players.length + (team() ? ' players, ' : ' player, ') + df.name + ')</p>' +
      '</div><div class="sheet-foot"><button type="button" class="btn" data-act="map">Back</button><span class="grow"></span>' +
      '<button type="button" class="btn primary" data-act="design">Start designing</button></div></div>';
  }

  /* ----- a design step ----- */
  var LEVEL_WORD = { ok: 'Good.', warn: 'Careful.', bad: 'Problem.' };
  /** A tile: picture, name, a few numbers and a face. The words wait in detailHtml until it is picked. */
  function cardHtml(g, key) {
    var item = D[g.from][key], d = state.design;
    var on = g.pick === 'any' ? d.extras.indexOf(key) >= 0 : d[g.key] === key;
    var lv = W.liveLine(g.key, key, d, state.diff).level;
    return '<button type="button" class="card" data-act="pick" data-drag="' + g.key + '" data-group="' + g.key + '" data-key="' + key + '" aria-pressed="' + on + '">' +
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
    panel.innerHTML =
      '<div class="sheet" style="--role:' + role.color + '"><div class="sheet-scroll">' +
      '<div class="step-meta"><span>Step ' + (state.step + 1) + ' of ' + D.STEPS.length + '</span>' +
      '<span class="role-tag">' + role.name + '</span>' +
      (team() ? '<span class="turn-tag">' + esc(possessive(owner(st.role))) + ' turn</span>' : '') + '</div>' +
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

  /** Re-draw the step after a pick without losing the scroll position or keyboard focus. */
  function rerenderStep(group, key) {
    var sc = panel.querySelector('.sheet-scroll'), top = sc ? sc.scrollTop : 0;
    render();
    sc = panel.querySelector('.sheet-scroll');
    if (sc) sc.scrollTop = top;
    if (group) {
      var el = panel.querySelector('.card[data-group="' + group + '"][data-key="' + key + '"]');
      if (el) { el.focus({ preventScroll: true }); el.classList.add('just'); }
    }
  }

  /* ----- Go / No-go ----- */
  function renderReview() {
    var ev = evalNow(), d = state.design, blocked = ev.blocked.length > 0;
    var marks = { go: '✓', watch: '!', nogo: '×' }, words = { go: 'Go', watch: 'Caution', nogo: 'No-go' };
    function worst(list) {
      return list.some(function (c) { return c.level === 'nogo'; }) ? 'nogo' : list.some(function (c) { return c.level === 'watch'; }) ? 'watch' : 'go';
    }
    function checkHtml(c) {
      var fix = c.level !== 'go' && c.step ? ' <button type="button" class="link" data-act="goto" data-step="' + c.step + '">Change it</button>' : '';
      return '<li class="chk" data-level="' + c.level + '"><span class="chk-dot" aria-hidden="true">' + marks[c.level] + '</span>' +
        '<span><b>' + esc(c.title) + '</b>' + esc(c.text) + fix + '</span></li>';
    }
    var votesNeeded = 0, votesIn = 0;
    var consoles = D.ROLE_ORDER.map(function (r) {
      var list = ev.checks.filter(function (c) { return AREA_ROLE[c.area] === r; });
      var lv = worst(list), role = D.ROLES[r], vote = '';
      if (team()) {
        votesNeeded++;
        if (state.votes[r]) votesIn++;
        vote = '<button type="button" class="vote" data-act="vote" data-role="' + r + '" aria-pressed="' + !!state.votes[r] + '"' + (lv === 'nogo' ? ' disabled' : '') + '>' +
          esc(owner(r)) + (state.votes[r] ? ' says go ✓' : ': press when you are go') + '</button>';
      }
      return '<li class="console" style="--role:' + role.color + '"><div class="console-head"><span class="role-tag">' + role.name + '</span>' +
        (team() ? '<span class="who">' + esc(owner(r)) + '</span>' : '') +
        '<span class="stamp" data-level="' + lv + '">' + words[lv] + '</span></div><ul>' + list.map(checkHtml).join('') + '</ul>' + vote + '</li>';
    }).join('');
    var money = ev.checks.filter(function (c) { return c.area === 'budget'; });
    if (!isFinite(ev.budget)) money = [{ level: 'go', title: 'Sandbox: no budget limit', text: 'This mission costs ' + M.fmtMoney(ev.cost) + '.', step: null }];
    consoles += '<li class="console" style="--role:var(--ink)"><div class="console-head"><span class="role-tag">' + (team() ? 'Whole team' : 'Budget') + '</span>' +
      '<span class="stamp" data-level="' + worst(money) + '">' + words[worst(money)] + '</span></div><ul>' + money.map(checkHtml).join('') + '</ul></li>';

    // the three biggest costs, to help decide what to give up
    var slots = M.parts(d).map(function (p) { return { label: p.item.name, cost: p.item.cost, role: SLOT_ROLE[p.slot] }; });
    slots.push({ label: D.NETWORKS[d.network].name, cost: D.NETWORKS[d.network].cost, role: 'comms' });
    slots.push({ label: D.ROCKETS[d.rocket].name, cost: D.ROCKETS[d.rocket].cost, role: 'nav' });
    slots.sort(function (a, b) { return b.cost - a.cost; });
    var huddle = '<div class="huddle"><h2>' + (team() ? 'Team huddle' : 'Where the money goes') + '</h2>' +
      (team() ? '<p>Talk it over before anyone presses go. If something has to go, these cost the most:</p>' : '') +
      '<ul>' + slots.slice(0, 3).map(function (sl) {
        return '<li><span>' + esc(sl.label) + (team() ? ' (' + esc(owner(sl.role)) + ')' : '') + '</span><span>' + M.fmtMoney(sl.cost) + '</span></li>';
      }).join('') + '<li><span>Whole mission</span><span>' + M.fmtMoney(ev.cost) + (isFinite(ev.budget) ? ' of ' + M.fmtMoney(ev.budget) : '') + '</span></li></ul></div>';

    var waiting = team() && votesIn < votesNeeded;
    var note = blocked ? 'Fix the no-go items first.' : waiting ? 'Waiting for every console to say go.' : ev.watch.length ? 'Caution items can fly, but expect trouble.' : 'All consoles are go.';
    panel.innerHTML =
      '<div class="sheet is-wide" style="--role:var(--ink)"><div class="sheet-scroll">' +
      '<h1 tabindex="-1">Go or no-go?</h1>' +
      '<p>Before every real launch, each console in mission control reports “go” or “no-go”. Here is how ' + D.MISSION.satellite + ' looks.</p>' +
      '<ul class="board">' + consoles + '</ul>' + huddle +
      '</div><div class="sheet-foot"><button type="button" class="btn" data-act="back">Back</button><span class="grow foot-note">' + note + '</span>' +
      '<button type="button" class="btn primary" data-act="launch"' + (blocked || waiting ? ' disabled' : '') + '>Launch ' + D.MISSION.satellite + '</button></div></div>';
  }

  /* ----- report ----- */
  var REPLAY = { power: 'battery', radio: 'data', sensor: 'blur', orbit: 'blur', brain: 'blur', bus: 'heavy', rocket: 'heavy' }; // the cartoon for each step's usual trouble
  function starSvg(on) {
    return '<svg viewBox="0 0 24 24" class="' + (on ? 'is-on' : '') + '" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"/></svg>';
  }
  function renderReport() {
    var sc = state.score, res = state.result, db = state.debrief, c = res.counts;
    var parts = [
      ['Fire warnings', sc.science, 60], ['Bonus science', sc.bonus, 10],
      ['Money left over', sc.efficiency, 15], ['Healthy satellite', sc.health, 15]
    ].map(function (p) {
      return '<div class="part"><span>' + p[0] + '</span><div class="bar"><i style="width:' + Math.round((p[1] / p[2]) * 100) + '%"></i></div><span>' + Math.round(p[1]) + ' of ' + p[2] + '</span></div>';
    }).join('');
    var gradeWord = { fast: 'warned in under 6 hours', onTime: 'warned within 12 hours', late: 'warned late', missed: 'missed' };
    var strip = [1, 2, 3].map(function (y) {
      return '<span>Year ' + y + '</span>' + res.fires.filter(function (f) { return f.year === y; }).map(function (f) {
        return '<span class="dot" data-g="' + f.grade + '" title="' + esc(f.place + ', ' + f.size + ' fire: ' + gradeWord[f.grade] + '. Real fire seen by MODIS on ' + f.seenBy + ', ' + fmtDate(f.seenOn) + ', ' + Math.round(f.frp) + ' MW.') + '"></span>';
      }).join('');
    }).join('');
    var good = db.good.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var fix = db.fix.map(function (f) {
      return '<li>' + (f.step ? W.replay(REPLAY[f.step]) : '') + '<b>' + esc(f.title) + '</b>' + esc(f.text) +
        (f.step ? ' <button type="button" class="btn primary" style="margin-top:8px" data-act="goto" data-step="' + f.step + '">Try this: change the ' + D.STEPS.filter(function (x) { return x.id === f.step; })[0].nav.toLowerCase() + '</button>' : '') + '</li>';
    }).join('');
    panel.innerHTML =
      '<div class="sheet is-wide" style="--role:var(--ink)"><div class="sheet-scroll">' +
      '<div class="verdict"><div class="stars" role="img" aria-label="' + sc.stars + ' of 3 stars">' + starSvg(sc.stars >= 1) + starSvg(sc.stars >= 2) + starSvg(sc.stars >= 3) + '</div>' +
      '<h1 tabindex="-1">' + sc.verdict + '</h1>' +
      '<p class="score"><b>' + sc.total + '</b> points out of 100. Mission number ' + res.seed + '.</p></div>' +
      RG.Levels.rewardsHtml(state.rewards) +
      '<h2>How the points add up</h2><div class="parts">' + parts + '</div>' +
      '<h2>The ' + c.total + ' fires</h2>' +
      '<div class="strip">' + strip + '</div>' +
      '<div class="strip-key"><span><i style="background:var(--green)"></i>' + c.fast + ' warned in under 6 hours</span><span><i style="background:#a5e66f"></i>' + c.onTime + ' within 12 hours</span>' +
      '<span><i style="background:var(--yellow)"></i>' + c.late + ' late</span><span><i style="background:var(--red-d)"></i>' + c.missed + ' missed</span></div>' +
      '<p class="foot-note" style="margin-top:8px">Every dot is a real fire from NASA’s 2023 FIRMS archive. Point at a dot to see which one.</p>' +
      (good ? '<h2>What went well</h2><ul class="notes">' + good + '</ul>' : '') +
      (fix ? '<h2>What to try next time</h2><ul class="notes fix">' + fix + '</ul>' : '') +
      '<p style="margin-top:16px">Mission code: <b>' + M.encode(state.design) + '</b>. Share it so a friend can fly your design.</p>' +
      '</div><div class="sheet-foot"><button type="button" class="btn" data-act="copy">Copy the code</button>' +
      '<button type="button" class="btn" data-act="map">Level map</button><span class="grow"></span>' +
      '<button type="button" class="btn primary" data-act="improve">Improve this design</button></div></div>';
  }

  /* ---------- dialogs ---------- */
  var onClose = null;
  function openDialog(html, cb) {
    dialogBody.innerHTML = html;
    onClose = cb || null;
    if (!dialog.open) dialog.showModal();
  }
  function okButton(text) {
    return '<div class="actions"><button type="button" class="btn primary" data-act="close" autofocus>' + text + '</button></div>';
  }

  function showHelp() {
    openDialog('<h2 id="dialog-title">How to play</h2><ol class="howto">' +
      '<li>Read the mission, then make seven choices, one step at a time.</li>' +
      '<li>Drag a part onto its glowing slot. The little numbers show its mass, power, data and price, and the face tells you how it fits your design.</li>' +
      '<li>Watch the gauges at the bottom. Red means something does not add up.</li>' +
      '<li>Drag the 3D view to look around. Scroll or pinch to zoom.</li>' +
      '<li>Launch, watch three years of fires, then read the report and try to do better.</li></ol>' +
      '<p style="margin-top:12px">Words with a dotted line under them can be tapped for an explanation.</p>' + okButton('Got it'));
  }

  function showSources() {
    var nf = RG.NASA_FIRES, r = nf.recent;
    openDialog('<h2 id="dialog-title">NASA data in this game</h2>' +
      '<p>Everything you see about the Earth and its fires comes from NASA.</p><ul class="sources">' +
      '<li><b>The fires in your mission</b>Real fires from ' + nf.archiveYear + ', found by the MODIS instruments on NASA’s Terra and Aqua satellites. Each flight uses 42 of the ' + (nf.zones.length * 9) + ' fires stored in the game. Source: NASA FIRMS, the Fire Information for Resource Management System.</li>' +
      '<li><b>The specks on the globe</b>' + W.num(r.points.length / 2) + ' of the ' + W.num(r.total) + ' fires MODIS saw from ' + recentWeek() + '. Source: NASA FIRMS.</li>' +
      '<li><b>The Earth</b>By day: Blue Marble Next Generation, August 2004. By night: Black Marble 2016, made with the VIIRS instrument on Suomi NPP. Source: NASA GIBS, Global Imagery Browse Services.</li>' +
      '<li><b>Ground stations</b>Wallops, McMurdo, Fairbanks and White Sands are real stations of NASA’s Near Space Network.</li>' +
      '<li><b>Sensors and orbits</b>Modelled on VIIRS on Suomi NPP, the imager on GOES, the Space Station’s orbit and GOES-East’s parking spot.</li></ul>' +
      '<p><b>Made up for the game:</b> the prices and masses of parts, which pixel size catches which fire, the hour each fire starts, the surprises and the scoring. They are simplified so the game stays playable.</p>' +
      okButton('Close'));
  }

  function showCode() {
    openDialog('<h2 id="dialog-title">Use a mission code</h2><p>Type a code from a friend’s report to load their design.</p>' +
      '<p><label class="vh" for="code-in">Mission code</label><input id="code-in" class="code-box" placeholder="OR-11111111120" autocomplete="off" autocapitalize="characters" autofocus></p>' +
      '<p id="code-err" role="alert" style="color:var(--red-d);font-weight:700"></p>' +
      '<div class="actions"><button type="button" class="btn primary" data-act="load-code">Load this design</button>' +
      '<button type="button" class="btn" data-act="close">Cancel</button></div>');
  }

  function loadLog() {
    try { return JSON.parse(localStorage.getItem('orbit-ranger.log') || '[]'); } catch (e) { return []; }
  }
  function saveLog(entry) {
    try {
      var log = loadLog(); log.push(entry);
      log.sort(function (a, b) { return b.score - a.score; });
      localStorage.setItem('orbit-ranger.log', JSON.stringify(log.slice(0, 20)));
    } catch (e) { /* storage may be switched off */ }
  }
  function showLog() {
    var log = loadLog();
    var rows = log.slice(0, 10).map(function (e, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(e.crew) + '</td><td>' + esc(e.diff) + '</td><td>' + '★'.repeat(e.stars) + '</td><td><b>' + e.score + '</b></td><td>' + esc(e.code) + '</td></tr>';
    }).join('');
    openDialog('<h2 id="dialog-title">Mission log</h2>' + (rows
      ? '<table class="logtable"><thead><tr><th></th><th>Crew</th><th>Level</th><th>Stars</th><th>Points</th><th>Code</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p style="margin-top:10px;font-size:14px;color:var(--ink-soft)">Best missions flown in this browser.</p>'
      : '<p>No missions flown yet. Finish one and it will be listed here.</p>') + okButton('Close'));
  }

  /* ---------- launch ---------- */
  function launch() {
    state.seed = 1 + Math.floor(Math.random() * 9000);
    A.play('go');
    cut(function () {
      state.screen = 'launch';
      document.body.dataset.screen = 'launch';
      render();
      Stage.setOffset(0, 0, true);
      V.launch({ onCount: onCount, onDone: launchDone });
      say('Countdown started.');
    });
  }
  function onCount(n) {
    if (state.screen !== 'launch') return;
    count.textContent = n > 0 ? n : 'Lift-off!';
    count.className = n > 0 ? 'is-on' : 'is-on is-word';
    if (n > 0) A.play('count');
    if (n === 1) A.rumble(11);
    if (n === 0) setTimeout(function () { count.className = ''; }, 1500);
  }
  function launchDone() {
    if (state.screen !== 'launch') return;
    state.screen = 'launch-done';
    cut(startMission);
  }

  /* ---------- mission ---------- */
  function startMission() {
    A.stopRumble();
    count.className = '';
    state.log = []; state.skipping = false;
    state.sim = new Sim(state.design, { seed: state.seed, onEvent: simEvent });
    state.screen = 'mission';
    document.body.dataset.screen = 'mission';
    render();
    Stage.setOffset(0, 0, true);
    V.startMission(state.sim, { onChapterEnd: chapterEnd });
    state.sim.startChapter(0);
    V.missionChapter();
    renderHud();
    var o = D.ORBITS[state.design.orbit];
    openDialog('<h2 id="dialog-title">' + D.MISSION.satellite + ' is in orbit</h2>' +
      '<p>It is ' + W.num(o.alt) + ' km up. Watch one day from each of its three years: orange dots are fires, yellow means spotted, green means firefighters know.</p>' +
      okButton('Start year 1'), function () { if (V.mission) V.mission.paused = false; });
  }

  function addLog(kind, text) {
    state.log.unshift({ kind: kind, text: text });
    if (state.log.length > 7) state.log.pop();
  }
  function simEvent(type, data) {
    if (state.skipping) return;
    var quiet = V.mission && V.mission.speed > 2;
    if (type === 'fire') {
      addLog('fire', 'A ' + data.size + ' fire starts in ' + data.place + '. Real fire: MODIS saw it on ' + fmtDate(data.seenOn) + ' at ' + Math.round(data.frp) + ' MW.');
      if (!quiet) A.play('fire');
    }
    else if (type === 'spotted') { addLog('spotted', 'Spotted the fire in ' + data.place + '.'); if (!quiet) A.play('spotted'); }
    else if (type === 'alert') {
      addLog('alert', 'Warning sent for ' + data.place + ' after ' + M.fmtHours(data.delayH) + (data.grade === 'late' ? ' (late).' : '.'));
      if (!quiet) A.play('alert');
    }
    else if (type === 'deleted') addLog('bad', 'Memory full. The picture of ' + data.place + ' was deleted.');
    else if (type === 'memory-full') { addLog('bad', 'The memory is full. Old pictures are being deleted.'); A.play('warn'); }
    else if (type === 'brownout') { addLog('bad', 'The battery is empty. Instruments switch off.'); A.play('bad'); }
    else if (type === 'power-back') addLog('', 'Power is back. Instruments switch on.');
    else if (type === 'cloud') addLog('', 'Clouds over ' + data.name + ' block the laser.');
  }

  function renderHud() {
    var sim = state.sim;
    var years = [0, 1, 2].map(function (i) {
      return '<span class="year' + (i === sim.chapter ? ' is-on' : i < sim.chapter ? ' is-done' : '') + '">Year ' + (i + 1) + '</span>';
    }).join('');
    function tele(id, name) {
      return '<div class="plate tele" id="t-' + id + '"><div class="tele-name"><span>' + name + '</span><b id="h-' + id + '"></b></div>' +
        '<div class="bar"><i id="h-' + id + '-bar"></i></div><div class="tele-note" id="h-' + id + '-note"></div></div>';
    }
    var speed = V.mission ? V.mission.speed : 1;
    hud.innerHTML =
      '<div class="hud-top plate"><div class="years">' + years + '</div><div class="clock"><span id="h-clock">Hour 0 of 24</span><div class="bar"><i id="h-day"></i></div></div></div>' +
      '<div class="hud-left">' + tele('batt', 'Battery') + tele('mem', 'Memory') +
      '<div class="plate tele" id="t-link"><div class="tele-name"><span>Radio</span><b id="h-link"></b></div><div class="tele-note" id="h-link-note"></div></div>' +
      '<div class="plate tele" id="t-eye"><div class="tele-name"><span>Fire sensor</span><b id="h-eye"></b></div><div class="tele-note" id="h-eye-note"></div></div></div>' +
      '<div class="hud-right"><div class="plate"><div class="tally">' +
      '<div class="t-burn"><b id="h-burn">0</b><span>burning</span></div><div class="t-spot"><b id="h-spot">0</b><span>spotted</span></div>' +
      '<div class="t-ok"><b id="h-ok">0</b><span>warned</span></div><div><b id="h-late">0</b><span>late</span></div></div>' +
      '<div class="legend" style="margin-top:8px"><span><i style="background:#ff5a1f"></i>burning</span><span><i style="background:#ffd23d"></i>spotted</span><span><i style="background:#3dffa0"></i>firefighters warned</span></div></div>' +
      '<div class="plate"><ul class="log" id="h-log" aria-label="Mission log"></ul></div></div>' +
      '<div class="hud-bottom plate"><div class="seg" role="group" aria-label="Speed">' + [1, 2, 4].map(function (k) {
        return '<button type="button" data-act="speed" data-x="' + k + '" aria-pressed="' + (speed === k) + '">' + k + '×</button>';
      }).join('') + '</div><button type="button" class="btn ghost" data-act="skip">Skip to the report</button></div>';
    updateHud();
  }

  var lastLog = '';
  function setBar(id, frac, level) {
    var el = $(id);
    if (!el) return;
    el.style.width = Math.max(0, Math.min(100, frac * 100)).toFixed(0) + '%';
    el.parentNode.dataset.level = level || '';
  }
  function setText(id, t) { var el = $(id); if (el && el.textContent !== t) el.textContent = t; }

  function updateHud() {
    var sim = state.sim, c = sim && sim.c;
    if (!c || state.screen !== 'mission') return;
    setText('h-clock', 'Hour ' + Math.min(24, Math.floor(c.t / 60)) + ' of 24');
    setBar('h-day', c.t / Sim.DAY);
    var cap = sim.battery.wh * sim.battFactor, b = cap ? c.batt / cap : 0;
    setText('h-batt', Math.round(b * 100) + '%');
    setBar('h-batt-bar', b, c.brownout ? 'over' : b < 0.35 ? 'tight' : '');
    setText('h-batt-note', c.brownout ? 'Empty. Instruments are off.' : c.dark ? 'In Earth’s shadow, on battery' : 'In sunlight, charging');
    $('t-batt').dataset.alarm = c.brownout;
    var stored = Math.max(0, c.gen - c.head), full = stored / sim.storage;
    setText('h-mem', (stored < 10 ? stored.toFixed(1) : Math.round(stored)) + ' of ' + sim.storage + ' GB');
    setBar('h-mem-bar', full, full > 0.98 ? 'over' : full > 0.75 ? 'tight' : '');
    setText('h-mem-note', sim.stats.dataLost > 0.5 ? 'Deleted so far: ' + Math.round(sim.stats.dataLost) + ' GB' : 'Pictures waiting to be sent');
    $('t-mem').dataset.alarm = full > 0.98;
    setText('h-link', c.link && c.on ? 'Sending' : 'Waiting');
    setText('h-link-note', c.link ? 'Talking to ' + c.link.name : 'No ground station in view');
    setText('h-eye', c.on ? 'On' : 'Off');
    setText('h-eye-note', c.offline ? 'Computer is restarting' : c.on ? M.fmtPixel(sim.pixelNow()) + ' pixels' : 'No power');
    $('t-eye').dataset.alarm = !c.on;
    var n = { burning: 0, spotted: 0, ok: 0, late: 0 };
    c.fires.forEach(function (f) {
      if (f.state === 'burning') n.burning++;
      else if (f.state === 'spotted') n.spotted++;
      else if (f.state === 'alerted') { if (f.grade === 'late') n.late++; else n.ok++; }
    });
    setText('h-burn', String(n.burning)); setText('h-spot', String(n.spotted));
    setText('h-ok', String(n.ok)); setText('h-late', String(n.late));
    var html = state.log.map(function (l) { return '<li data-kind="' + l.kind + '">' + esc(l.text) + '</li>'; }).join('');
    if (html !== lastLog) { lastLog = html; var ul = $('h-log'); if (ul) ul.innerHTML = html; }
  }

  function chapterEnd() {
    var sim = state.sim, i = sim.chapter;
    V.mission.paused = true;
    updateHud();
    var warned = sim.c.fires.filter(function (f) { return f.grade === 'fast' || f.grade === 'onTime'; }).length;
    var summary = '<p>Year ' + (i + 1) + ': firefighters were warned in time for <b>' + warned + ' of ' + sim.c.fires.length + '</b> fires.</p>';
    if (i >= Sim.CHAPTERS - 1) {
      openDialog('<h2 id="dialog-title">Three years in orbit</h2>' + summary + '<p>The mission is complete. Time to see how ' + D.MISSION.satellite + ' did.</p>' + okButton('Read the report'), finishMission);
      return;
    }
    var card = sim.surprise(i + 1);
    A.play(card.ok ? 'go' : 'bad');
    openDialog('<h2 id="dialog-title">Year ' + card.year + ' surprise: ' + esc(card.title) + '</h2>' + summary +
      '<p>' + esc(card.story) + '</p>' +
      '<div class="outcome" data-ok="' + card.ok + '"><b>' + (card.ok ? 'You were ready.' : 'This one hurts.') + '</b>' + esc(card.text) + '</div>' +
      '<p class="lesson">' + esc(card.lesson) + '</p>' +
      (card.aging ? '<p>Also, after two years in space the battery now holds 20% less.</p>' : '') +
      okButton('Start year ' + card.year), function () {
        sim.startChapter(i + 1);
        V.missionChapter();
        renderHud();
        V.mission.paused = false;
      });
  }

  function skipMission() {
    var sim = state.sim;
    if (!sim || !V.mission) return;
    state.skipping = true;
    V.mission.paused = true; V.mission.ended = true;
    while (!sim.isOver()) {
      sim.finishChapter();
      if (sim.chapter < Sim.CHAPTERS - 1) { sim.surprise(sim.chapter + 1); sim.startChapter(sim.chapter + 1); }
    }
    finishMission();
  }

  function finishMission() {
    var res = state.sim.results();
    state.result = res;
    state.score = Score.compute(state.design, state.diff, res);
    state.debrief = Score.debrief(state.design, state.diff, res, state.score);
    RG.Levels.award(5, Math.max(1, state.score.stars)); // finishing the mission always completes level 5
    state.rewards = RG.Levels.reward5(state.design, state.score, res, evalNow().cost);
    saveLog({
      crew: state.players.join(', '), diff: D.DIFFICULTY[state.diff].name,
      score: state.score.total, stars: state.score.stars, code: M.encode(state.design)
    });
    cut(function () {
      hud.innerHTML = '';
      go('report');
      A.play(state.score.stars >= 2 ? 'star' : 'go');
      say(state.score.verdict + '. ' + state.score.total + ' points.');
    });
  }

  /* ---------- live widgets (10 times a second) ---------- */
  function poll() {
    if (state.screen === 'mission') { updateHud(); return; }
    var p = V.preview;
    if (state.screen !== 'step' || !p || !$('lab-bar')) return;
    if (p.mode === 'shadow') {
      setBar('lab-bar', p.battFrac, p.brown ? 'over' : p.battFrac < 0.35 ? 'tight' : '');
      $('lab-bar').firstChild.style.width = Math.round(p.battFrac * 100) + '%';
      setText('lab-num', Math.round(p.battFrac * 100) + '%');
      setText('lab-state', p.brown ? 'Battery empty. Instruments off.' : p.dark ? 'In Earth’s shadow, on battery' : 'In sunlight, charging');
      setText('lab-note', p.brown ? 'The wings or the battery are too small. Try a bigger one and watch again.' : 'Hour ' + Math.floor(p.hours) + ' of 72. If the bar ever hits zero, the instruments switch off.');
    } else if (p.mode === 'stations') {
      var f = p.storage ? p.stored / p.storage : 0;
      $('lab-bar').firstChild.style.width = Math.round(Math.min(1, f) * 100) + '%';
      $('lab-bar').dataset.level = f > 0.98 ? 'over' : f > 0.75 ? 'tight' : '';
      setText('lab-num', (p.stored < 10 ? p.stored.toFixed(1) : Math.round(p.stored)) + ' of ' + p.storage + ' GB');
      setText('lab-state', p.station ? 'Sending to ' + p.station : 'No station in view');
      setText('lab-note', p.lost > 0.5 ? 'Memory overflowed: ' + Math.round(p.lost) + ' GB of pictures deleted so far. Try a faster radio or more stations.' : 'Hour ' + Math.floor(p.hours) + ' of 72. Nothing has been deleted.');
    }
  }

  /* ---------- actions ---------- */
  var SLOTS = { sensor: 'sensor', extras: 'extras', bus: 'bus', panels: 'panels', battery: 'battery', computer: 'computer', pointing: 'pointing', radio: 'radio' };

  function pick(group, key) {
    var d = state.design, st = step();
    var g = st.groups.filter(function (x) { return x.key === group; })[0];
    if (!g) return;
    var name = D[g.from][key].name;
    if (g.pick === 'any') {
      var i = d.extras.indexOf(key);
      if (i >= 0) { d.extras.splice(i, 1); A.play('drop'); say(name + ' removed.'); }
      else { d.extras.push(key); A.play('pick'); say(name + ' added.'); }
    } else {
      if (d[group] === key) return;
      d[group] = key;
      A.play('pick');
      say(name + ' picked.');
    }
    state.votes = {};
    V.setDesign(d, SLOTS[group] || null);
    rerenderStep(group, key);

    // once a step with a live test is complete, glide over to the test
    var views = STEP_VIEWS[st.id];
    if (views.length > 1 && state.view === 'bay' && M.stepDone(d, st) && !state.autoLab[st.id]) {
      state.autoLab[st.id] = true;
      setTimeout(function () {
        if (state.screen === 'step' && step() === st && state.view === 'bay') { state.view = views[1]; applyStepView(); setTimeout(function () { rerenderStep(); }, 260); }
      }, 1200);
    }
  }

  function gotoStep(id) {
    for (var i = 0; i < D.STEPS.length; i++) if (D.STEPS[i].id === id) { state.step = i; go('step'); return; }
  }

  var actions = {
    home: function () { if (state.screen === 'mission' || state.screen === 'launch') return; go('title'); },
    start: function () { A.play('tap'); go('crew'); },
    play: function () { A.play('tap'); RG.Levels.showMap(); },
    map: function () { RG.Levels.showMap(); },
    crew: function () { go('crew'); },
    brief: function () { A.play('tap'); go('brief'); },
    design: function () {
      A.play('tap');
      var d = state.design, open = 0;
      for (var i = 0; i < D.STEPS.length; i++) { if (!M.stepDone(d, D.STEPS[i])) break; open = Math.min(i + 1, D.STEPS.length - 1); }
      state.step = M.isComplete(d) ? 0 : open;
      V.setDesign(d, null);
      go('step');
    },
    players: function (el) {
      var n = +el.dataset.n;
      while (state.players.length < n) state.players.push('Player ' + (state.players.length + 1));
      state.players.length = n;
      if (n > 1 && state.players[0] === 'Ranger') state.players[0] = 'Player 1';
      if (n === 1 && /^Player \d$/.test(state.players[0])) state.players[0] = 'Ranger';
      render();
    },
    diff: function (el) { state.diff = el.dataset.key; A.play('pick'); render(); },
    pick: function (el, e) {
      var g = el.dataset.group, k = el.dataset.key, inDock = !!el.closest('.dock');
      if (W.isTap(e) && !inDock) { W.hintDrag(el); say('Drag it to the glowing slot.'); return; }
      if (g === 'extras' && !inDock && state.design.extras.indexOf(k) >= 0) return; // already on board; the × in its slot takes it off
      pick(g, k);
    },
    ask: function () { state.asked[step().id] = true; rerenderStep(); },
    view: function (el) { state.view = el.dataset.view; applyStepView(); setTimeout(function () { rerenderStep(); }, 260); },
    goto: function (el) { A.play('tap'); gotoStep(el.dataset.step); },
    review: function () { go('review'); },
    back: function () {
      if (state.screen === 'review') { state.step = D.STEPS.length - 1; go('step'); }
      else if (state.step === 0) go('brief');
      else { state.step--; go('step'); }
    },
    next: function () {
      A.play('tap');
      if (state.step === D.STEPS.length - 1) go('review');
      else { state.step++; go('step'); }
    },
    vote: function (el) {
      var r = el.dataset.role;
      state.votes[r] = !state.votes[r];
      A.play(state.votes[r] ? 'go' : 'drop');
      rerenderStep();
      var b = panel.querySelector('.vote[data-role="' + r + '"]');
      if (b) b.focus({ preventScroll: true });
    },
    launch: function () { launch(); },
    'skip-launch': function () { if (state.screen === 'launch') { A.stopRumble(); launchDone(); } },
    speed: function (el) { if (V.mission) { V.mission.speed = +el.dataset.x; renderHud(); } },
    skip: function () { skipMission(); },
    improve: function () { state.step = 0; state.votes = {}; V.setDesign(state.design, null); go('step'); },
    copy: function (el) {
      var code = M.encode(state.design);
      function done() { el.textContent = 'Copied'; say('Mission code copied.'); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, function () { window.prompt('Copy this mission code:', code); });
      else window.prompt('Copy this mission code:', code);
    },
    term: function (el) {
      var g = D.GLOSSARY[el.dataset.term];
      openDialog('<h2 id="dialog-title">' + esc(g[0]) + '</h2><p>' + esc(g[1]) + '</p>' + okButton('Got it'));
    },
    help: function () { showHelp(); },
    sources: function () { showSources(); },
    code: function () { showCode(); },
    log: function () { showLog(); },
    'load-code': function () {
      var d = M.decode(($('code-in').value || '').toUpperCase());
      if (!d) { $('code-err').textContent = 'That code does not look right. A code looks like OR-11111111120.'; return; }
      state.design = d; state.votes = {};
      V.setDesign(d, null);
      dialog.close();
      go('crew');
      say('Design loaded.');
    },
    close: function () { dialog.close(); },
    sound: function (el) {
      var on = A.toggle();
      el.textContent = on ? 'Sound on' : 'Sound off';
      el.setAttribute('aria-pressed', on);
      if (on) A.play('tap');
    }
  };

  /* ---------- start-up ---------- */
  function init() {
    panel = $('panel'); gauges = $('gauges'); rail = $('rail'); hud = $('hud'); caption = $('caption');
    viewtabs = $('viewtabs'); dialog = $('dialog'); dialogBody = $('dialog-body'); live = $('live');
    fade = $('fade'); count = $('count');

    dock = document.createElement('div');
    dock.id = 'dock';
    document.body.appendChild(dock);
    W.initDrag();

    var skip = document.createElement('button');
    skip.type = 'button'; skip.id = 'skip-launch'; skip.className = 'btn ghost';
    skip.dataset.act = 'skip-launch'; skip.textContent = 'Skip the launch';
    document.body.appendChild(skip);

    var sb = $('sound-btn');
    sb.textContent = A.on ? 'Sound on' : 'Sound off';
    sb.setAttribute('aria-pressed', A.on);

    if (!window.THREE || !Stage.init($('stage'))) {
      panel.innerHTML = '<div class="hero"><h1><span>Orbit</span><span>Ranger</span></h1><p class="lede">This game needs 3D graphics (WebGL), and this browser could not start it. Try a recent version of Chrome, Edge, Firefox or Safari.</p></div>';
      return;
    }
    V.init();
    // the level path (js/ui/levels.js) drives the same stage and dialogs
    RG.App = {
      state: state,
      setScreen: function (name) { state.screen = name; document.body.dataset.screen = name; render(); },
      view: setView,
      layout: layout,
      say: say,
      openDialog: openDialog,
      closeDialog: function () { if (dialog.open) dialog.close(); },
      startDesigner: function () { go('brief'); }
    };
    RG.Levels.init(RG.App);

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      var fn = actions[el.dataset.act];
      if (fn) fn(el, e);
    });
    document.addEventListener('input', function (e) {
      var i = e.target.dataset && e.target.dataset.name;
      if (i != null) state.players[+i] = e.target.value.trim() || 'Player ' + (+i + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'code-in') actions['load-code']();
    });
    dialog.addEventListener('close', function () {
      var cb = onClose; onClose = null;
      if (cb) cb();
    });
    window.addEventListener('resize', layout);
    small.addEventListener('change', layout);
    setInterval(poll, 100);

    go('title');
    Stage.setOffset(small.matches ? 0 : -window.innerWidth * 0.2, small.matches ? window.innerHeight * 0.17 : 0, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
