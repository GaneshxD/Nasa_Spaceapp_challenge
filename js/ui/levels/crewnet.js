/* Orbit Ranger — the crew mission: up to four players, each on their own device, fly one rocket to orbit.
 * The flight runs on the room server; this screen shows this player's own seats and sends what they hold or press.
 *   door    not in a room yet: make a crew, or join one with its code (a shared link fills the code in)
 *   lobby   the code and the link to share, who has which seat, and the go / no-go poll
 *   flight  one console for each of this player's seats: the climb on the launch pad view, then the orbit view
 *   over    the crew's stars and a line for each seat
 * Four seats (js/core/crew.js): pilot, flight engineer, navigator, payload officer. Each console shows only its own
 * instruments, so the crew has to talk. Keys: pilot ◀ ▶ or A D · engineer B (boosters), C (core stage) ·
 * navigator space bar (hold to burn) · payload officer F (fairing), R (release) · G or Enter says go.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE, F = RG.Flight, P = RG.Physics, E = RG.Earth, R = RG.Rocket, Stage = RG.Stage, A = RG.Audio, W = RG.Widgets, Crew = RG.Crew;
  var K = RG.LevelKit, Pg = RG.Progress, N = RG.CrewNet, num = W.num, esc = W.esc, D2R = Math.PI / 180;
  var say = K.say, bar = K.bar, hud = K.hud, controls = K.controls, keys = K.keys, set = K.set, height = K.height, rd = K.rd, note = K.note, term = W.term;
  var ID = 'crew4', Q_FULL = 40;
  RG.LevelDefs = RG.LevelDefs || {};
  K.tag(ID, 'Crew');

  var SEAT_COLOR = { pilot: 'var(--blue)', engineer: 'var(--orange)', navigator: 'var(--purple)', payload: 'var(--green)' };
  var SEAT_KEYS = { pilot: 'A · D', engineer: 'B · C', navigator: 'space', payload: 'F · R' };
  // what the guide says when something happens in the flight: [words, face]
  var SAY = {
    'poll-go': ['Every seat is go. Counting down!', 'cheer'], // @voice
    hold: ['Hold! Someone took their go back. The count waits until every seat is go again.', 'worry'], // @voice
    liftoff: ['Lift-off! Pilot: keep the needle in the green. Everyone: say out loud what your own gauges show. That is a {callout|call-out}.', 'cheer'], // @voice
    maxq: ['That was {maxq|Max Q}, the hardest push of the air. Engineer: the boosters are nearly empty. Warn the pilot before you let them go.', 'worry'], // @voice
    'boosters-dropped': ['{separation|Booster separation}! Letting go kicked the nose. Pilot: steer it back.', 'wow'], // @voice
    'boosters-late': ['The computer let the boosters go, four seconds late. Engineer: call “boosters empty” the moment the gauge reads zero.', 'worry'], // @voice
    space: ['100 km: the {karman}. Navigator: call the altitude. Payload officer: the {fairing} can go, once the pilot says the rocket is steady.', 'cheer'], // @voice
    'fairing-dropped': ['Fairing away! The rocket is 2.5 tonnes lighter, and the {payload} sees space for the first time.', 'cheer'], // @voice
    meco: ['{meco|Main engine cut-off}. The core stage is empty. Engineer: let it go, so the {upperstage|upper stage} can burn.', 'wow'], // @voice
    'core-separated': ['Core stage away: that is {staging}. Navigator: wait for the top of the arc, then hold the burn until the path turns green.', 'cheer'], // @voice
    'core-late': ['The computer let the core stage go, five seconds late. Navigator: burn at the top of the arc.', 'worry'], // @voice
    'burn-start': ['The {upperstage|upper stage} is burning {prograde}. The {periapsis|low point} of the path is rising: this is {circularize|circularizing}.', 'happy'], // @voice
    orbit: ['The path is an {orbit}! Navigator: say so. Payload officer: release the satellite.', 'cheer'], // @voice
    deployed: ['Satellite released. You are a launch crew!', 'cheer'], // @voice
    'deploy-late': ['The computer released the satellite, after a long wait.', 'worry'] // @voice
  };
  var REFUSED = {
    'boosters:burning': 'Still burning! A {booster|solid booster} cannot be let go until it is empty. Engineer: watch the booster gauge.', // @voice
    'fairing:low': 'Too low. Under 100 km the rushing air would wreck the satellite, so the {fairing} stays on. Ask the navigator for the altitude.', // @voice
    'fairing:unsteady': 'Not steady enough to let the {fairing} go. Pilot: call “steady” when the needle is in the green.', // @voice
    'separate:burning': 'The core stage is still burning. Engineer: let it go after {meco|main engine cut-off}.', // @voice
    'deploy:early': 'Not in orbit yet. The satellite stays on until the navigator has closed the path.', // @voice
    'deploy:burning': 'The engine is still burning. Navigator: let go of the burn first.' // @voice
  };
  function lamp(id, text) { return '<p class="co-lamp" id="' + id + '" data-state="">' + text + '</p>'; }
  function setLamp(id, state, text) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.state !== state) el.dataset.state = state;
    if (el.textContent !== text) el.textContent = text;
  }
  /** The little upper stage with the satellite on its nose, for the orbit view. */
  function stageModel() {
    var g = new THREE.Group();
    var white = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.4, metalness: 0.8 });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 24), white); body.rotation.z = Math.PI / 2;
    var bell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 0.2, 20, 1, true), dark); bell.rotation.z = Math.PI / 2; bell.position.x = -0.34;
    var sat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xe6ad3e, roughness: 0.35, metalness: 0.9 })); sat.position.x = 0.36;
    g.add(body, bell, sat);
    return g;
  }

  RG.LevelDefs[ID] = function () {
    var screen = '', hudFor = '', lastSeq = -1, built = '', view = '', orbitReady = false, wobble = 0, noteClock = 0, sheetFor = -1, link = '', linkFor = '', err = '', trail = [], trailClock = 0, rumbling = false;
    var orb = { inc: F.SITE.lat, raanDeg: -60 }, apex = P.orbitPos(orb, Math.PI / 2), alpha = Math.atan2(-apex[2], apex[0]), theta0 = alpha - F.SITE.lon * D2R;
    var wantCode = (/[?&]crew=([A-Za-z]{4})\b/.exec(window.location.search) || [])[1] || '';
    document.querySelector('.lv').classList.add('lv-coop', 'lv-crew');
    padView(Crew.DEFAULT);
    N.on.state = onState;
    // could not get in (wrong code, full crew, flight in progress): back to the door, with the reason. In a room: a short notice.
    N.on.error = function (text) { if (!N.active) { err = text; door(); } else if (RG.Designer) RG.Designer.toast(text); };
    N.on.closed = function (text) { if (!K.cur || K.cur.id !== ID) return; err = text; screen = ''; door(); };
    if (N.active) onState(N.state);
    else { var kept = N.kept(); if (N.available && kept && (!wantCode || kept.code === wantCode.toUpperCase())) { waiting('Going back to your seat…'); N.resume(); } else door(); }

    function myName() { var el = document.getElementById('cr-name'), v = el ? el.value.trim() : ''; return v || (RG.App.state.players || [])[0] || 'Ranger'; }
    function padView(build) {
      var key = build.tank + build.engines;
      if (built !== key || view !== 'pad') {
        R.setBuild({ tank: build.tank, engines: build.engines, boosters: 'two', top: true, satellite: K.DEFAULT_SAT });
        built = key;
      }
      if (view !== 'pad') { view = 'pad'; orbitReady = false; trail = []; E.clearRibbons(); K.App.view('ascent'); }
    }
    function waiting(text) { screen = 'wait'; hud(''); controls(''); K.side('<h2>Crew online</h2><p class="cr-note">' + esc(text) + '</p>'); }

    /* ================= the door: make a crew or join one ================= */
    function door() {
      screen = 'door'; hudFor = '';
      hud(''); controls(''); K.hideSheet(); K.countEl.className = '';
      var name = esc((RG.App.state.players || [])[0] || 'Ranger');
      if (!N.available) {
        K.side('<h2>Crew online</h2><p>Up to four players, each on their own phone or computer, fly one rocket to orbit together.</p>' +
          '<p class="why-line"><i>It needs the game server</i>This page was opened straight from a file, so there is no server to connect the players. On the computer that holds the game, run ' +
          '<b>cd server</b>, <b>npm install</b>, <b>npm start</b>, then open the address it prints on every device.</p>' +
          '<button type="button" class="btn wide" data-lv="go" data-id="coop1">Play two players on this screen instead</button>');
        say('To fly with friends on their own devices, start the game server first.', 'happy', false);
        return;
      }
      K.side('<h2>Crew online</h2><p>Up to four players, each on their own phone or computer, fly one rocket to orbit together. Each of you gets a job nobody else can do.</p>' +
        '<label class="cr-field"><span>Your name</span><input id="cr-name" maxlength="14" autocomplete="off" value="' + name + '"></label>' +
        (wantCode ? '' : '<button type="button" class="btn primary big wide" data-lv="crewCreate">Start a crew</button><p class="cr-or">or join one</p>') +
        '<div class="cr-join"><label class="sr" for="cr-code">Crew code</label><input id="cr-code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE" value="' + esc(wantCode.toUpperCase()) + '">' +
        '<button type="button" class="btn' + (wantCode ? ' primary big' : '') + '" data-lv="crewJoin">Join the crew</button></div>' +
        (wantCode ? '<p class="cr-or"><button type="button" class="link" data-lv="crewCreate">Start a new crew instead</button></p>' : '') +
        '<p class="cr-err" id="cr-err" role="alert">' + esc(err) + (/server answered|reach the game server/.test(err) ? ' Start it with: cd server, npm install, npm start. Then open the address it prints.' : '') + '</p>');
      say(wantCode ? 'You have been invited to a crew. Type your name and join.' : 'Start a crew and share its link, or join a crew with its four-letter code.', 'happy', false);
      bar(0.02);
    }

    /* ================= the lobby: who sits where, and the go / no-go poll ================= */
    function lobby(s) {
      screen = 'lobby'; hudFor = '';
      hud(''); controls(''); K.hideSheet();
      padView(s.build);
      var n = s.players.length, here = s.players.filter(function (p) { return p.online; }), waitingFor = here.filter(function (p) { return !s.votes[p.id]; });
      var seats = Crew.SEATS.map(function (k) {
        var mine = s.seats[k] === N.me, word = k === 'pilot' || k === 'engineer' || k === 'payload' ? term(k, Crew.SEAT[k].name) : Crew.SEAT[k].name;
        return '<li class="cr-seat' + (mine ? ' is-mine' : '') + '" style="--role:' + SEAT_COLOR[k] + '"><b>' + word + '</b><em>' + (mine ? 'You' : esc(N.nameOf(s.seats[k]))) + '</em><span>' + Crew.SEAT[k].job + '</span></li>';
      }).join('');
      var people = s.players.map(function (p) {
        return '<li><i class="dot' + (p.online ? ' on' : '') + '"></i><b>' + esc(p.name) + '</b>' + (p.id === N.me ? ' (you)' : '') + (p.online ? '' : ' · away') +
          '<span class="cr-vote" data-go="' + !!s.votes[p.id] + '">' + (s.votes[p.id] ? 'go ✓' : 'not yet') + '</span></li>';
      }).join('');
      var go = !!s.votes[N.me];
      K.side('<h2>Crew ' + esc(s.code) + '</h2>' +
        '<div class="cr-share"><span>Send this link to your crew (up to four)</span><div class="cr-link"><input id="cr-link" readonly value="' + esc(linkFor === s.code ? link : '…') + '" aria-label="Link to share">' +
        '<button type="button" class="btn" data-lv="crewCopy">Copy</button></div><small id="cr-link-note">They can also type the code <b>' + esc(s.code) + '</b> under Crew online.</small></div>' +
        '<h3 class="cr-h">Crew <small>' + n + ' of 4</small></h3><ul class="cr-people">' + people + '</ul>' +
        '<h3 class="cr-h">Seats</h3><ul class="cr-seats">' + seats + '</ul>' +
        '<p class="cr-note">' + (n === 1 ? 'Alone, you have all four seats. Each player who joins takes some of them.' : 'The seats are dealt in joining order. Each console shows only its own gauges, so talk to each other.') + '</p>' +
        '<button type="button" class="btn ' + (go ? 'warn' : 'primary') + ' big wide" data-lv="crewGo" aria-pressed="' + go + '">' + (go ? 'Go ✓ (press to take it back)' : 'I am go') + '</button>' +
        '<p class="cr-note" id="cr-wait">' + (s.stage === 'count' ? 'Every seat is go.' : waitingFor.length ? 'Waiting for: ' + esc(waitingFor.map(function (p) { return p.id === N.me ? 'you' : p.name; }).join(', ')) : '') + '</p>');
      if (linkFor !== s.code) {
        linkFor = s.code; link = '';
        N.link(s.code, function (url, onlyLocal) {
          link = url;
          var el = document.getElementById('cr-link'); if (el) el.value = url;
          var nt = document.getElementById('cr-link-note');
          if (nt && onlyLocal) nt.innerHTML = 'This address only works on this computer. Open the game at the network address the server printed, and share that link.';
        });
      }
      bar(0.05);
    }

    /* ================= the consoles ================= */
    function consoleHtml(k, build) {
      var head = '<section class="co-con cr-con" style="--role:' + SEAT_COLOR[k] + '" aria-label="' + Crew.SEAT[k].name + ' console"><h3>' +
        (k === 'pilot' || k === 'engineer' || k === 'payload' ? term(k, Crew.SEAT[k].name) : '<b>' + Crew.SEAT[k].name + '</b>') + '<span>' + SEAT_KEYS[k] + '</span></h3>';
      if (k === 'pilot') return head + K.gyroHtml() + '<div class="rds">' + rd('cn-v', 'speed', 'Speed', { unit: 'km/h', cls: 'is-wide' }) + '</div>' + lamp('cn-steady', 'On the pad') + '</section>';
      if (k === 'engineer') return head + '<div class="tanks">' + K.tankHtml('tk-o', 'ox', 'Oxygen', 'lox') + K.tankHtml('tk-h', 'h2', 'Hydrogen', 'lh2') + K.tankHtml('tk-b', 'srb', 'Boosters', 'booster') + '</div>' +
        lamp('cn-lamp-b', 'Boosters: on the pad') + lamp('cn-lamp-c', 'Core stage: burning') + '</section>';
      if (k === 'navigator') return head + '<div class="rds">' + rd('cn-alt', 'altitude', 'Altitude', { unit: 'km' }) + rd('cn-ov', 'orbitalv', 'Velocity', { unit: 'km/h' }) +
        rd('cn-ap', 'apoapsis', 'Apoapsis', { unit: 'km' }) + rd('cn-pe', 'periapsis', 'Periapsis', { unit: 'km' }) + '</div>' + lamp('cn-lamp-n', 'Burn: after the core stage is gone') + '</section>';
      return head + '<div class="rds">' + rd('cn-q', 'q', 'Pressure Q', { unit: 'kPa', bar: 'cn-qb', cls: 'is-wide' }) + '</div>' + lamp('cn-lamp-f', 'Fairing: locked below 100 km') + lamp('cn-lamp-s', 'Satellite: on board') + '</section>';
    }
    function padHtml(k) {
      if (k === 'pilot') return '<button type="button" class="round" id="st-l" data-hold="left" aria-label="Pilot: tip the nose left">◀</button><button type="button" class="round" id="st-r" data-hold="right" aria-label="Pilot: tip the nose right">▶</button>';
      if (k === 'engineer') return '<button type="button" class="btn warn" id="cn-b" data-lv="crewAct" data-a="boosters">Drop boosters <kbd>B</kbd></button><button type="button" class="btn warn" id="cn-c" data-lv="crewAct" data-a="separate">Core stage <kbd>C</kbd></button>';
      if (k === 'navigator') return '<button type="button" class="btn primary hold" id="cn-burn" data-hold="burn">Hold to burn <kbd>space</kbd></button>';
      return '<button type="button" class="btn warn" id="cn-f" data-lv="crewAct" data-a="fairing">Drop fairing <kbd>F</kbd></button><button type="button" class="btn warn" id="cn-r" data-lv="crewAct" data-a="deploy">Release <kbd>R</kbd></button>';
    }
    function flightHud(s) {
      var mine = N.seats(), key = mine.join('+');
      if (hudFor === key) return;
      hudFor = key; screen = 'flight';
      K.side(''); K.hideSheet();
      // one console for each of this player's seats: the first and third on the left, the second and fourth on the right
      var left = mine.filter(function (k, i) { return i % 2 === 0; }), right = mine.filter(function (k, i) { return i % 2 === 1; });
      hud('<div class="cr-col is-left">' + left.map(function (k) { return consoleHtml(k, s.build); }).join('') + '</div><div class="cr-col is-right">' + right.map(function (k) { return consoleHtml(k, s.build); }).join('') + '</div>' +
        '<p class="cr-crew" id="cr-crew"></p>');
      controls('<div class="co-pad is-left">' + left.map(padHtml).join('') + '</div><div class="co-pad is-right">' + right.map(padHtml).join('') + '</div>');
      set('cr-crew', Crew.SEATS.map(function (k) { return Crew.SEAT[k].name + ': ' + (s.seats[k] === N.me ? 'you' : N.nameOf(s.seats[k])); }).join('  ·  '));
    }
    function paint(s, dt) {
      var m = s.m, c = m.c, o = m.o, ev = F.evaluate(s.build), climb = m.phase === 'climb', fly = climb && c.st === 'flying';
      // pilot
      wobble += dt;
      K.gyro(c.pitch / D2R, c.target / D2R, (fly ? 1.5 : 0) * Math.sin(wobble * 1.7), (fly ? 2 : 0) * Math.sin(wobble * 0.9 + 1));
      var g = document.querySelector('.gyro'); if (g) g.dataset.off = Math.abs(c.err) > 12 ? 'far' : Math.abs(c.err) > 6 ? 'near' : '';
      var sl = document.getElementById('st-l'), sr = document.getElementById('st-r');
      if (sl) sl.classList.toggle('is-want', fly && c.err > 5);
      if (sr) sr.classList.toggle('is-want', fly && c.err < -5);
      set('cn-v', num(c.v * 3.6));
      setLamp('cn-steady', !climb ? 'done' : c.steady ? 'go' : 'act', !climb ? 'Climb finished' : c.steady ? 'Steady: in the green' : 'Off course: steer back');
      // engineer
      height('tk-o', c.core); height('tk-h', c.core);
      set('tk-o-t', num(ev.lox * c.core) + ' t'); set('tk-h-t', num(ev.lh2 * c.core) + ' t');
      height('tk-b', c.boost); set('tk-b-t', c.bOn ? Math.round(c.boost * 100) + '%' : 'gone');
      var empty = c.bOn && c.bEmpty, staging = m.phase === 'staging', coreGone = !!o && !staging;
      setLamp('cn-lamp-b', !c.bOn ? 'done' : empty ? 'act' : '', !c.bOn ? 'Boosters: gone' : empty ? 'Boosters EMPTY: drop them' : 'Boosters: burning');
      setLamp('cn-lamp-c', coreGone ? 'done' : staging ? 'act' : '', coreGone ? 'Core stage: gone' : staging ? 'Core stage EMPTY: let it go' : 'Core stage: burning');
      var bb = document.getElementById('cn-b'), cc = document.getElementById('cn-c');
      if (bb) bb.classList.toggle('pulse', empty);
      if (cc) cc.classList.toggle('pulse', staging);
      // navigator
      var alt = o ? (o.r - F.RE) / 1000 : c.alt, el = o ? F.elements(o) : null, v = o ? Math.sqrt(o.vr * o.vr + o.vt * o.vt) : c.v, burnable = !!o && !staging && m.phase !== 'done';
      set('cn-alt', alt < 10 ? alt.toFixed(1) : num(alt)); set('cn-ov', num(v * 3.6));
      set('cn-ap', el ? (isFinite(el.apoKm) ? num(el.apoKm) : 'escaping') : num(c.apo)); set('cn-pe', el ? num(el.periKm) : 'below ground');
      K.level('cn-pe-box', o && o.inOrbit ? 'ok' : el && el.periKm < 100 ? 'over' : '');
      setLamp('cn-lamp-n', o && o.inOrbit ? 'go' : o && o.burning ? 'act' : burnable && o.vr < 80 ? 'act' : '',
        o && o.inOrbit ? (o.burning ? 'Orbit closed: let go' : 'Orbit closed: say so') : o && o.burning ? 'Burning: hold until the path is green' : !burnable ? (staging ? 'Burn: wait for the core stage to go' : 'Burn: after main engine cut-off')
          : o.vr < 80 ? 'Top of the arc: hold the burn now' : 'Coasting up: wait for the top');
      var nb = document.getElementById('cn-burn'); if (nb) nb.classList.toggle('pulse', burnable && !o.inOrbit && !o.burning && o.vr < 80);
      // payload officer
      set('cn-q', c.q < 10 ? c.q.toFixed(1) : num(c.q));
      var qb = document.getElementById('cn-qb'); if (qb) qb.style.width = Math.min(100, c.q / Q_FULL * 100).toFixed(0) + '%';
      var canF = climb && c.alt >= F.FAIRING_MIN && !c.fair, canR = m.phase === 'orbit' && !o.burning;
      setLamp('cn-lamp-f', c.fair ? 'done' : canF ? 'act' : '', c.fair ? 'Fairing: gone' : canF ? 'Fairing: ask “steady?”' : climb ? 'Fairing: ask for the altitude' : 'Fairing: still on');
      setLamp('cn-lamp-s', m.phase === 'done' ? 'done' : canR ? 'act' : '', m.phase === 'done' ? 'Satellite: released' : canR ? 'Satellite: release it' : 'Satellite: waits for the orbit');
      var ff = document.getElementById('cn-f'), rr = document.getElementById('cn-r');
      if (ff) ff.classList.toggle('pulse', canF);
      if (rr) rr.classList.toggle('pulse', canR);
      if (--noteClock <= 0) {
        noteClock = 10;
        note('cn-v', num(c.v * 3.6) + ' km/h over the ground. Orbit needs about 28,000 km/h, nearly all of it sideways.');
        note('cn-alt', (alt < 10 ? alt.toFixed(1) : num(alt)) + ' km up. The payload officer needs to hear when this passes 100 km: the fairing can go then.');
        note('cn-ov', num(v * 3.6) + ' km/h. A circular orbit at this height needs about ' + num(Math.sqrt(F.MU / (F.RE + alt * 1000)) * 3.6) + ' km/h.');
        note('cn-ap', 'The high point of the path. Burning there raises the low point the most.');
        note('cn-pe', el && el.periKm > 0 ? 'The low point of the path is ' + num(el.periKm) + ' km up. Above ' + F.ORBIT_MIN + ' km it clears the air: that is an orbit.' : 'The low point of the path is under the ground: without the upper-stage burn the rocket comes back down.');
        note('cn-q', c.q.toFixed(1) + ' kPa of air pressure on the fairing. ' + (c.maxQDone ? 'The peak, Max Q, was ' + c.maxQ.toFixed(0) + ' kPa.' : 'Still rising toward Max Q.') + ' The fairing is what keeps it off the satellite.');
      }
      bar(climb ? 0.1 + 0.5 * Math.min(1, Math.max(0, c.alt) / 200) : m.phase === 'done' ? 1 : o && o.inOrbit ? 0.92 : 0.65);
    }
    /* ---------- the 3D view: the climb beside the rocket, then the whole planet with the path drawn round it ---------- */
    function pos(u, r) { var v = P.orbitPos(orb, Math.PI / 2 + u), k = r / F.RE; return [v[0] * k, v[1] * k, v[2] * k]; }
    function scene(s, dt) {
      var m = s.m, c = m ? m.c : null, o = m ? m.o : null;
      if (!o) {
        padView(s.build);
        var alt = c ? Math.max(0, c.alt) : 0, pitch = c ? c.pitch : 0, flying = !!c && c.st === 'flying';
        R.flightUpdate({ alt: alt * 1000, pitch: pitch, burn: c && c.burnOn ? c.thr : 0, boost: !c ? 'empty' : !c.bOn ? 'gone' : c.bEmpty ? 'empty' : flying ? 'on' : 'empty', sky: Stage.smooth((alt - 8) / 75) }, dt);
        var y = R.vehicle.position.y + R.height * 0.45 * Math.cos(pitch), x = R.height * 0.45 * Math.sin(pitch);
        var radius = R.height * 1.7 + 40 + Math.min(80, alt * 0.8), elv = alt < 1 ? 0.06 : 0.06 + 0.22 * Stage.smooth(alt / 60);
        Stage.look({ radius: radius, el: Math.max(elv, Math.asin(Math.max(-1, Math.min(1, (3 - y) / radius)))), speed: 5 });
        Stage.rig.goal.target.set(x, y, 0); Stage.rig.target.set(x, y, 0);
        if (flying && !rumbling) { A.rumble(40); rumbling = true; }
        return;
      }
      if (view !== 'orbit') { view = 'orbit'; orbitReady = false; A.stopRumble(); rumbling = false; Stage.shake = 0; K.App.view('insert', { az: alpha + o.u - 0.25, el: 0.85 }); }
      if (!orbitReady) { // the picture is faded across: wait until the planet is the one on show
        if (RG.Views.name !== 'insert') return;
        E.addPin('Kennedy Space Center', F.SITE.lat, F.SITE.lon); E.setSatModel(m.phase === 'done' ? RG.SatModel.flightCopy(K.DEFAULT_SAT) : stageModel()); orbitReady = true;
      }
      var el = F.elements(o), pts = [], Np = 160, i;
      for (i = 0; i <= Np; i++) {
        var nu = (i / Np) * 2 * Math.PI, den = 1 + el.e * Math.cos(nu);
        if (den < 0.08) continue;
        var q = pos(o.u + (nu - el.nu), el.p / den);
        pts.push(q[0], q[1], q[2]);
      }
      E.setRibbon('ahead', pts, 0.014, o.inOrbit ? 0x58cc02 : 0xffc800);
      var p = pos(o.u, o.r), len = o.r / F.RE;
      trailClock += dt;
      if (trailClock > 0.1) { trailClock = 0; trail.push(p[0], p[1], p[2]); if (trail.length > 900) trail.splice(0, 3); }
      if (trail.length >= 6) E.setRibbon('trail', trail, 0.008, 0xffffff);
      E.setTheta(theta0 + P.EARTH_RATE * ((s.m.c.t + o.t) / 60));
      E.setSat([p[0] / len, p[1] / len, p[2] / len], (o.r - F.RE) / 1000, { lam: 0 });
    }
    /* ---------- the end of a flight ---------- */
    function over(s) {
      if (sheetFor === s.rev || screen === 'over') return;
      screen = 'over'; sheetFor = s.rev; hudFor = '';
      var r = s.result;
      controls(''); A.stopRumble(); rumbling = false;
      Object.keys(keys).forEach(function (k) { keys[k] = false; });
      var lines = Crew.SEATS.map(function (k) {
        var x = r.seats[k];
        return '<li><b>' + Crew.SEAT[k].name + (x.who ? ' · ' + esc(x.who) : '') + ' ' + K.starRow(x.stars) + '</b>' + esc(x.line) + '</li>';
      }).join('');
      var again = '<button type="button" class="btn primary big" data-lv="crewAgain">Back to the briefing room</button>';
      if (r.ok) {
        if (orbitReady) E.setSatModel(RG.SatModel.flightCopy(K.DEFAULT_SAT));
        Pg.data.coop = Pg.data.coop || {};
        if (r.stars > (Pg.data.coop[ID] || 0)) { Pg.data.coop[ID] = r.stars; Pg.save(); }
        K.complete(ID, r.stars, 'In orbit, as a crew of ' + s.players.length + '!',
          '</p><ul class="co-lines">' + lines + '</ul><p class="done-line">Orbit ' + num(r.orbit.periKm) + ' by ' + num(r.orbit.apoKm) + ' km, one lap every ' + r.orbit.periodMin +
          ' minutes. The stars are for all four seats together. Swap seats in the briefing room and fly it again.',
          ['crew', r.stars >= 3 && 'dreamteam'],
          { save: false, next: 0, again: false, extra: again, words: ['pilot', 'engineer', 'payload', 'gonogo', 'callout', 'pitch', 'booster', 'separation', 'staging', 'karman', 'fairing', 'meco', 'upperstage', 'apoapsis', 'periapsis', 'prograde', 'circularize', 'orbit'] });
      } else {
        var WHY = {
          tipped: ['It tipped over', 'The nose swung more than 28° away from the {pitch} the computer wanted, and the rushing air took over. Pilot: small, early taps. Engineer: warn the pilot before the boosters go.'],
          slow: ['Too slow', 'The tanks ran dry before the rocket was fast enough. Every degree off the green wastes {thrust}, and every second of dead weight costs speed.'],
          fell: ['It fell back', 'The {periapsis|low point} of the path was still inside the air, so the rocket came down. Navigator: hold the burn at the {apoapsis|top of the arc} until the path turns green. Engineer: the burn cannot start until the core stage is gone.'],
          fuel: ['Out of propellant', 'The {upperstage|upper stage} ran dry before the path closed. A burn does the most good at the {apoapsis|top of the arc}: start it there.']
        }, w = WHY[r.why] || WHY.slow;
        K.failed(ID, w[0], w[1], r.why === 'tipped' ? 'tip' : r.why === 'slow' ? 'fall' : 'fuel', again);
        var sh = document.querySelector('#lv-sheet .oops');
        if (sh) sh.insertAdjacentHTML('afterend', '<ul class="co-lines">' + lines + '</ul>');
      }
    }

    function onState(s) {
      if (!K.cur || K.cur.id !== ID || !s) return;
      err = '';
      // things that happened since the last picture
      if (lastSeq < 0) lastSeq = s.ev.length ? s.ev[s.ev.length - 1][0] : 0; // joined part-way: do not replay the past
      s.ev.forEach(function (e) {
        if (e[0] <= lastSeq) return;
        lastSeq = e[0];
        var name = e[1] === 'boosters-dropped' && s.m && s.m.c.late ? 'boosters-late' : e[1];
        if (name === 'refused') { if (REFUSED[e[2]]) { A.play('warn'); say(REFUSED[e[2]], 'worry'); } return; }
        if (name === 'fairing-dropped') R.dropFairing();
        if (name === 'space' || name === 'orbit' || name === 'deployed') A.play('star'); else if (name === 'liftoff' || name === 'poll-go' || name === 'core-separated' || name === 'boosters-dropped') A.play('go');
        if (SAY[name]) say(SAY[name][0], SAY[name][1]);
      });
      if (s.stage === 'lobby' || s.stage === 'count') {
        if (screen !== 'lobby' && s.stage === 'lobby') say(s.players.length === 1 ? 'Share the link so your crew can join. When everyone is here, each of you says go: that is a {gonogo|go / no-go} poll.' : 'When everyone is here, each of you says go: that is a {gonogo|go / no-go} poll.', 'happy');
        lobby(s);
        if (s.stage === 'count') { K.countEl.textContent = s.count; K.countEl.className = 'is-on'; } else K.countEl.className = '';
      } else if (s.stage === 'flight') {
        if (K.countEl.className) { K.countEl.textContent = 'Lift-off!'; K.countEl.className = 'is-on is-word'; setTimeout(function () { if (K.countEl.textContent === 'Lift-off!') K.countEl.className = ''; }, 1100); }
        flightHud(s);
      } else if (s.stage === 'over' && s.result) { if (screen !== 'over') { flightHud(s); paint(s, 0); } over(s); }
    }

    function act(a) { var seat = a === 'boosters' || a === 'separate' ? 'engineer' : 'payload'; if (N.active && N.state.stage === 'flight' && N.mine(seat)) N.act(a); }
    return {
      crewCreate: function () { A.play('tap'); err = ''; var nm = myName(); waiting('Opening a crew room…'); N.create(nm, Pg.data.build); },
      crewJoin: function () {
        var code = ((document.getElementById('cr-code') || {}).value || '').trim().toUpperCase(), nm = myName();
        if (!/^[A-Z]{4}$/.test(code)) { var e = document.getElementById('cr-err'); if (e) e.textContent = 'A crew code is four letters.'; return; }
        A.play('tap'); err = ''; waiting('Joining crew ' + code + '…'); N.join(code, nm);
      },
      crewGo: function () { if (N.active) { A.play('tap'); N.go(!N.state.votes[N.me]); } },
      crewCopy: function (el) {
        var input = document.getElementById('cr-link'), text = input ? input.value : '';
        function done() { el.textContent = 'Copied'; setTimeout(function () { el.textContent = 'Copy'; }, 1600); }
        if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: 'Orbit Ranger crew', text: 'Join my launch crew', url: text }).catch(function () {});
        else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { input.select(); });
        else if (input) { input.select(); try { document.execCommand('copy'); done(); } catch (e) { /* the link is selected: the player can copy it */ } }
      },
      crewAct: function (el) { act(el.dataset.a); },
      crewAgain: function () { if (N.active) { A.play('tap'); K.hideSheet(); N.again(); } },
      /** One keyboard can work any of the seats this player has. */
      onKey: function (e, on) {
        if (!N.active || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return false;
        var k = e.key.length === 1 ? e.key.toLowerCase() : e.key, flying = N.state.stage === 'flight';
        if (k === 'g' || k === 'Enter') { if (on && !e.repeat && (N.state.stage === 'lobby' || N.state.stage === 'count')) N.go(!N.state.votes[N.me]); else if (!flying) return false; }
        else if (k === 'a' || k === 'ArrowLeft') keys.left = on;
        else if (k === 'd' || k === 'ArrowRight') keys.right = on;
        else if (k === ' ') { if (e.target.tagName === 'BUTTON' && !flying) return false; keys.burn = on; }
        else if (on && !e.repeat && k === 'b') act('boosters');
        else if (on && !e.repeat && k === 'c') act('separate');
        else if (on && !e.repeat && k === 'f') act('fairing');
        else if (on && !e.repeat && k === 'r') act('deploy');
        else return false;
        return true;
      },
      frame: function (dt) {
        var s = N.state;
        if (!N.active || !s) { if (view === 'pad') R.flightUpdate({ alt: 0, pitch: 0, burn: 0, boost: 'empty', sky: 0 }, dt); return; }
        if (s.stage === 'flight') {
          if (N.mine('pilot')) N.steer((keys.right ? 1 : 0) - (keys.left ? 1 : 0));
          if (N.mine('navigator')) N.burn(!!keys.burn);
        }
        if (s.stage === 'lobby' || s.stage === 'count') scene({ build: s.build, m: null }, dt);
        else if (s.m) { scene(s, dt); if (screen === 'flight') paint(s, dt); }
      },
      live: function () { return false; }, // the flight is on the server: it does not wait while one player reads
      /** For the browser checks in tools/browser. */
      peek: function () { return { screen: screen, view: view, net: N }; },
      cleanup: function () {
        N.on.state = N.on.error = N.on.closed = null;
        if (N.active) N.leave();
        A.stopRumble(); E.clearRibbons(); K.countEl.className = '';
      }
    };
  };
})();
