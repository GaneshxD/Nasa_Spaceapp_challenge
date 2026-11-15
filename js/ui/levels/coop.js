/* Orbit Ranger — the two-player mission: launch crew.
 * One rocket, one screen, two jobs and two sets of controls:
 *   left   the pilot            keys A and D, or the two round buttons: hold the pitch the computer wants
 *   right  the flight engineer  keys ↓ and ↑, or the two buttons: drop the empty boosters, then the fairing
 * Each console shows only its own instruments, so the two have to talk. The engineer warns the pilot before the
 * boosters go (it kicks the nose); the pilot tells the engineer when the rocket is steady enough for the fairing.
 * It starts with a go / no-go poll: both hold their own go button. The rules are in js/core/crew.js.
 * Not on the numbered path: its stars are kept in Progress.data.coop.
 */
(function () {
  'use strict';
  var RG = window.RG, F = RG.Flight, Crew = RG.Crew, Stage = RG.Stage, R = RG.Rocket, A = RG.Audio, W = RG.Widgets;
  var K = RG.LevelKit, Pg = RG.Progress, num = W.num, D2R = Math.PI / 180;
  var say = K.say, bar = K.bar, hud = K.hud, controls = K.controls, keys = K.keys, set = K.set, height = K.height, rd = K.rd, note = K.note, term = W.term;
  var ID = 'coop1', Q_FULL = 40;
  RG.LevelDefs = RG.LevelDefs || {};
  K.tag(ID, 'Co-op');

  function lamp(id, text) { return '<p class="co-lamp" id="' + id + '" data-state="">' + text + '</p>'; }
  function setLamp(id, state, text) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.state !== state) el.dataset.state = state;
    if (el.textContent !== text) el.textContent = text;
  }

  RG.LevelDefs[ID] = function () {
    var launch = new Crew.Launch(Pg.data.build, 1 + Math.floor(Math.random() * 40)), sim = launch.sim, build = launch.build, ev = sim.ev;
    var phase = 'poll', seen = 0, ended = false, wobble = 0, pollT = 0, timers = [], noteClock = 0;
    document.querySelector('.lv').classList.add('lv-coop');
    R.setBuild({ tank: build.tank, engines: build.engines, boosters: build.boosters, top: true, satellite: K.DEFAULT_SAT });
    K.App.view('ascent');
    // Two consoles. The pilot's has nothing about propellant or altitude; the engineer's has no pitch gauge.
    hud('<section class="co-con is-left plate-w" aria-label="Pilot console"><h3>' + term('pilot', 'Pilot') + '<span>keys A · D</span></h3>' + K.gyroHtml() +
      '<div class="rds">' + rd('co-v', 'speed', 'Speed', { unit: 'km/h', cls: 'is-wide' }) + rd('co-vv', 'vspeed', '↑ Vertical', { unit: 'km/h' }) + rd('co-vh', 'hspeed', '→ Horizontal', { unit: 'km/h' }) + '</div>' +
      lamp('co-steady', 'Pilot: hold for go') + '</section>' +
      '<section class="co-con is-right plate-w" aria-label="Flight engineer console"><h3>' + term('engineer', 'Flight engineer') + '<span>keys ↓ · ↑</span></h3>' +
      '<div class="tanks">' + K.tankHtml('tk-o', 'ox', 'Oxygen', 'lox') + K.tankHtml('tk-h', 'h2', 'Hydrogen', 'lh2') + K.tankHtml('tk-b', 'srb', 'Boosters', 'booster') + '</div>' +
      '<div class="rds">' + rd('co-alt', 'altitude', 'Altitude', { unit: 'km' }) + rd('co-q', 'q', 'Pressure Q', { unit: 'kPa', bar: 'co-qb' }) + '</div>' +
      lamp('co-lamp-b', 'Engineer: hold for go') + lamp('co-lamp-f', 'Fairing: locked below 100 km') + '</section>');
    drawControls();
    say('Two jobs, one rocket! Pilot on the left, {engineer|flight engineer} on the right. You each see only your own gauges, so talk. Both hold your go button to launch: that is a {gonogo|go / no-go} poll.');
    paint(0);

    function alive() { return K.cur && K.cur.id === ID && !ended; }
    function drawControls() {
      if (phase === 'poll' || phase === 'count') {
        controls('<div class="co-pad is-left"><button type="button" class="btn primary big hold" id="co-go-l" data-hold="goL">Pilot: hold for go<small>or hold the W key</small></button></div>' +
          '<div class="co-pad is-right"><button type="button" class="btn primary big hold" id="co-go-r" data-hold="goR">Engineer: hold for go<small>or hold Enter</small></button></div>');
      } else {
        controls('<div class="co-pad is-left"><button type="button" class="round" id="st-l" data-hold="left" aria-label="Pilot: tip the nose left. A key">◀</button>' +
          '<button type="button" class="round" id="st-r" data-hold="right" aria-label="Pilot: tip the nose right. D key">▶</button></div>' +
          '<div class="co-pad is-right"><button type="button" class="btn warn" id="co-b" data-lv="dropB">Drop boosters <kbd>↓</kbd></button>' +
          '<button type="button" class="btn warn" id="co-f" data-lv="dropF">Drop fairing <kbd>↑</kbd></button></div>');
      }
    }
    /* ---------- the poll and the count ---------- */
    function pollFrame(dt) {
      var l = !!keys.goL, r = !!keys.goR;
      setLamp('co-steady', l ? 'go' : '', l ? 'Pilot is go' : 'Pilot: hold for go');
      setLamp('co-lamp-b', r ? 'go' : '', r ? 'Engineer is go' : 'Engineer: hold for go');
      if (l && r) { pollT += dt; if (pollT > 0.4) count(); } else pollT = 0;
    }
    function count() {
      phase = 'count'; A.play('go');
      say('Both consoles are {gonogo|go}. Three, two, one…', 'cheer', false);
      [3, 2, 1].forEach(function (n, i) {
        timers.push(setTimeout(function () { if (alive()) { K.countEl.textContent = n; K.countEl.className = 'is-on'; A.play('count'); } }, i * 800));
      });
      timers.push(setTimeout(function () {
        if (!alive()) return;
        K.countEl.textContent = 'Lift-off!'; K.countEl.className = 'is-on is-word';
        timers.push(setTimeout(function () { K.countEl.className = ''; }, 1100));
        phase = 'fly'; keys.goL = keys.goR = false;
        drawControls(); launch.liftoff(); A.rumble(45);
      }, 2400));
    }
    /* ---------- the engineer's two switches ---------- */
    function dropB() {
      if (phase !== 'fly' || ended || K.paused) return;
      if (launch.dropBoosters() === 'burning') { A.play('warn'); say('Still burning! A {booster|solid booster} cannot be let go until it is empty. Watch the booster gauge.', 'worry', false); }
    }
    function dropF() {
      if (phase !== 'fly' || ended || K.paused) return;
      var r = launch.dropFairing();
      if (r === 'low') { A.play('warn'); say('Too low. Under 100 km the rushing air would wreck the satellite, so the {fairing} stays on.', 'worry', false); }
      else if (r === 'unsteady') { A.play('warn'); say('Not steady enough to let the {fairing} go. Pilot: call “steady” when the needle is in the green.', 'worry', false); }
    }
    function event(e) {
      if (e === 'liftoff') say('Lift-off! Pilot: keep the needle in the green. Engineer: watch the booster gauge and say what you see out loud. That is a {callout|call-out}.');
      else if (e === 'maxq') say('That was {maxq|Max Q}, the hardest push of the air. Engineer: the boosters are nearly empty. Warn the pilot before you let them go.', 'worry');
      // 'boosters-empty' is not announced: spotting it is the engineer's job
      else if (e === 'boosters-dropped') {
        A.play('go');
        say(sim.dropLate ? 'The computer let the boosters go, four seconds late. Engineer: call “boosters empty” the moment the gauge reads zero.'
          : '{separation|Booster separation}! Letting go kicked the nose. Pilot: steer it back. Did the engineer warn you?', sim.dropLate ? 'worry' : 'wow');
      } else if (e === 'space') { A.play('star'); say('100 km: the {karman}. Engineer: the {fairing} can go now, but only while the rocket is steady. Ask the pilot.', 'cheer'); }
      else if (e === 'fairing-dropped') { A.play('go'); R.dropFairing(); say('Fairing away[[ at ' + num(sim.fairingAt) + ' km]]! The rocket is 2.5 tonnes lighter, and the {payload} sees space for the first time.', 'cheer'); }
    }
    /* ---------- drawing ---------- */
    function scene(dt) {
      var alt = Math.max(0, sim.altKm()), sky = Stage.smooth((alt - 8) / 75);
      R.flightUpdate({ alt: alt * 1000, pitch: sim.pitch, burn: sim.status === 'flying' && sim.coreProp > 0 ? sim.throttle : 0,
        boost: !sim.boostersOn ? 'gone' : sim.boostersEmpty ? 'empty' : sim.status === 'flying' ? 'on' : 'empty', sky: sky }, dt);
      var y = R.vehicle.position.y + R.height * 0.45 * Math.cos(sim.pitch), x = R.height * 0.45 * Math.sin(sim.pitch);
      var radius = R.height * 1.7 + 40 + Math.min(80, alt * 0.8), el = alt < 1 ? 0.06 : 0.06 + 0.22 * Stage.smooth(alt / 60);
      Stage.look({ radius: radius, el: Math.max(el, Math.asin(Math.max(-1, Math.min(1, (3 - y) / radius)))), speed: 5 });
      Stage.rig.goal.target.set(x, y, 0); Stage.rig.target.set(x, y, 0);
    }
    function paint(dt) {
      var alt = sim.altKm(), frac = sim.coreProp / (ev.tank.prop * 1000), fly = sim.status === 'flying';
      // the pilot's side
      wobble += dt;
      K.gyro(sim.pitch / D2R, sim.target / D2R, (fly ? 1.5 : 0) * Math.sin(wobble * 1.7), (fly ? 2 : 0) * Math.sin(wobble * 0.9 + 1));
      var g = document.querySelector('.gyro');
      if (g) g.dataset.off = Math.abs(sim.err) > 12 ? 'far' : Math.abs(sim.err) > 6 ? 'near' : '';
      var sl = document.getElementById('st-l'), sr = document.getElementById('st-r');
      if (sl) sl.classList.toggle('is-want', fly && sim.err > 5);
      if (sr) sr.classList.toggle('is-want', fly && sim.err < -5);
      var vv = sim.vertical() * 3.6, vh = sim.horizontal() * 3.6, q = sim.qKpa();
      set('co-v', num(sim.speed() * 3.6)); set('co-vv', num(vv)); set('co-vh', num(vh));
      // the engineer's side
      height('tk-o', frac); height('tk-h', frac);
      set('tk-o-t', num(ev.lox * frac) + ' t'); set('tk-h-t', num(ev.lh2 * frac) + ' t');
      var bf = sim.boostersOn ? sim.boostProp / (ev.boost.prop * 1000) : 0;
      height('tk-b', bf); set('tk-b-t', sim.boostersOn ? Math.round(bf * 100) + '%' : 'gone');
      set('co-alt', alt < 10 ? alt.toFixed(1) : num(alt)); set('co-q', q < 10 ? q.toFixed(1) : num(q));
      var qb = document.getElementById('co-qb'); if (qb) qb.style.width = Math.min(100, q / Q_FULL * 100).toFixed(0) + '%';
      if (phase === 'fly') {
        var steady = launch.steady(), empty = sim.boostersOn && sim.boostersEmpty, canF = alt >= F.FAIRING_MIN && !sim.fairingGone;
        setLamp('co-steady', steady ? 'go' : 'act', steady ? 'Steady: in the green' : 'Off course: steer back');
        setLamp('co-lamp-b', !sim.boostersOn ? 'done' : empty ? 'act' : '', !sim.boostersOn ? 'Boosters: gone' : empty ? 'Boosters EMPTY: drop them' : 'Boosters: burning');
        setLamp('co-lamp-f', sim.fairingGone ? 'done' : canF ? 'act' : '', sim.fairingGone ? 'Fairing: gone' : canF ? 'Fairing: ask “steady?”' : 'Fairing: locked below 100 km');
        var b = document.getElementById('co-b'), f = document.getElementById('co-f');
        if (b) b.classList.toggle('pulse', empty);
        if (f) f.classList.toggle('pulse', canF);
      }
      if (--noteClock <= 0) {
        noteClock = 10;
        note('co-v', num(sim.speed() * 3.6) + ' km/h over the ground. Orbit needs about 28,000 km/h, nearly all of it sideways.');
        note('co-vv', vv >= 0 ? 'Climbing at ' + num(vv) + ' km/h.' : 'Dropping at ' + num(-vv) + ' km/h.');
        note('co-vh', num(vh) + ' km/h along the ground. It grows as the pilot tips the rocket over.');
        note('co-alt', (alt < 10 ? alt.toFixed(1) : num(alt)) + ' km up. ' + (alt < 100 ? 'The fairing must stay on until 100 km.' : 'Above 100 km: the fairing can go.'));
        note('co-q', q.toFixed(1) + ' kPa. ' + (sim.maxQDone ? 'The peak, Max Q, was ' + (sim.maxQ / 1000).toFixed(0) + ' kPa. The air is thinning now.' : 'Still rising toward Max Q.'));
      }
      bar(Math.min(1, Math.max(alt, 0) / 200));
    }
    function finish() {
      if (ended) return;
      ended = true;
      A.stopRumble(); Stage.shake = 0;
      Object.keys(keys).forEach(function (k) { keys[k] = false; });
      var sc = launch.score(), r = sc.result;
      if (sc.ok) {
        Pg.data.coop = Pg.data.coop || {};
        if (sc.stars > (Pg.data.coop[ID] || 0)) { Pg.data.coop[ID] = sc.stars; Pg.save(); }
        K.complete(ID, sc.stars, 'You reached space, as a crew!',
          '</p><ul class="co-lines"><li><b>Pilot ' + K.starRow(sc.pilot.stars) + '</b>' + sc.pilot.line + '</li><li><b>Flight engineer ' + K.starRow(sc.engineer.stars) + '</b>' + sc.engineer.line + '</li></ul><p class="done-line">' +
          'Main engine cut-off at ' + num(r.altKm) + ' km and ' + num(r.speed * 3.6) + ' km/h. The stars are for the two seats together, so swap seats and fly it again.',
          ['crew', sc.stars >= 3 && 'dreamteam'],
          { save: false, next: 0, again: 'Fly again', words: ['pilot', 'engineer', 'gonogo', 'callout', 'pitch', 'booster', 'separation', 'staging', 'maxq', 'karman', 'fairing', 'payload', 'meco'] });
      } else if (r.failWhy === 'tipped') {
        var kicked = launch.kickAt != null && sim.play - launch.kickAt < 4;
        K.failed(ID, 'It tipped over', kicked ? 'The kick at {separation|booster separation} swung the nose too far, and the rushing air took over. Engineer: count “three, two, one, drop” so the pilot is ready to steer back.'
          : 'The nose swung more than 28° away from the {pitch} the computer wanted, and the rushing air took over. Pilot: use small, early taps to stay in the green.', 'tip');
      } else K.failed(ID, 'Too slow', 'The tanks ran dry before the rocket was fast enough. Every degree off the green wastes {thrust}, and every second of dead weight costs speed.', 'fall');
    }
    return {
      dropB: dropB,
      dropF: dropF,
      /** The keyboard is shared: A, D and W for the pilot; the arrows and Enter for the engineer. */
      onKey: function (e, on) {
        if (ended) return false;
        var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (k === 'a') keys.left = on;
        else if (k === 'd') keys.right = on;
        else if (k === 'w') keys.goL = on;
        else if (k === 'Enter') keys.goR = on;
        else if (k === 'ArrowDown') { if (on && !e.repeat) dropB(); }
        else if (k === 'ArrowUp') { if (on && !e.repeat) dropF(); }
        else return false;
        return true;
      },
      frame: function (dt) {
        if (ended) return;
        if (phase === 'poll') pollFrame(dt);
        else if (phase === 'fly') {
          launch.step(dt, (keys.right ? 1 : 0) - (keys.left ? 1 : 0));
          while (seen < launch.events.length) event(launch.events[seen++]);
        }
        scene(dt);
        paint(dt);
        if (sim.status === 'meco' || sim.status === 'fail') finish();
      },
      live: function () { return !ended && phase === 'fly' && sim.status === 'flying'; },
      /** For the browser checks in tools/browser. */
      peek: function () { return { phase: phase, launch: launch, sim: sim, ended: ended }; },
      cleanup: function () { timers.forEach(clearTimeout); }
    };
  };
})();
