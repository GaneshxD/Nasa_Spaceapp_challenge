/* Orbit Ranger — Level 3: lift-off.
 * Steer the climb to space with the gyro needle, drop the empty boosters,
 * and hand the rocket's state over to level 4.
 */
(function () {
  'use strict';
  var RG = window.RG;
  var F = RG.Flight, Stage = RG.Stage, R = RG.Rocket, A = RG.Audio, W = RG.Widgets;
  var K = RG.LevelKit, Pg = RG.Progress, num = W.num;
  var say = K.say, bar = K.bar, hud = K.hud, controls = K.controls;
  var complete = K.complete, failed = K.failed, keys = K.keys, DEFAULT_SAT = K.DEFAULT_SAT, DEFAULT_BUILD = K.DEFAULT_BUILD, D2R = Math.PI / 180;
  var set = K.set, height = K.height, tankHtml = K.tankHtml, gyroHtml = K.gyroHtml, gyro = K.gyro, clock = K.clock, rd = K.rd, note = K.note;
  RG.LevelDefs = RG.LevelDefs || {};
  var quick = false; // after a failed climb, the next Launch skips the three-second count: the player has seen it

  RG.LevelDefs[3] = function () {
    var build = Pg.data.build || DEFAULT_BUILD, ev = F.evaluate(build), hasBoost = ev.boost.thrust > 0;
    var sim = new F.Ascent(build, 1 + Math.floor(Math.random() * 40));
    var seenEvents = 0, counting = false, ended = false, wobble = 0;
    R.setBuild({ tank: build.tank, engines: build.engines, boosters: build.boosters, top: true, satellite: DEFAULT_SAT });
    K.App.view('ascent');
    var Q_FULL = 40, told = {}; // kPa at the top of the pressure bar; lines Pip has already said
    // Every instrument is a button: tap it to read what it measures and why it matters. The flight waits while you read.
    hud('<button type="button" class="alt plate-w" data-term="altitude" id="al-box"><b id="al-n">0 km</b><span>Altitude</span><div class="alt-bar"><i id="al-f"></i>' +
      '<em style="bottom:' + (10 / 220 * 100) + '%">Clouds 10 km</em><em style="bottom:' + (100 / 220 * 100) + '%">Space 100 km</em><em class="goal" style="bottom:' + (200 / 220 * 100) + '%">Goal 200 km</em></div></button>' +
      '<div class="hud-r"><div class="tanks plate-w">' + tankHtml('tk-o', 'ox', 'Oxygen', 'lox') + tankHtml('tk-h', 'h2', 'Hydrogen', 'lh2') + (hasBoost ? tankHtml('tk-b', 'srb', 'Boosters', 'booster') : '') + '</div>' +
      gyroHtml() + '<div class="rds plate-w">' +
      rd('da-v', 'speed', 'Speed', { unit: 'km/h', cls: 'is-wide' }) +
      rd('da-vv', 'vspeed', '↑ Vertical', { unit: 'km/h' }) + rd('da-vh', 'hspeed', '→ Horizontal', { unit: 'km/h' }) +
      rd('da-g', 'gforce', 'Acceleration', { unit: 'g' }) + rd('da-q', 'q', 'Pressure Q', { unit: 'kPa', bar: 'da-qb' }) +
      '<div class="rd is-wide is-plain"><span class="rd-l">Clock</span><span class="rd-n"><b id="da-t">T−3</b></span></div></div></div>');
    drawControls('launch');
    say(quick ? 'Again! Keep the needle in the green. This time Launch lifts off at once.' : 'Keep the needle in the green: that is the {pitch} the flight computer wants. Tap any gauge to see what it measures. Ready?');
    paint(0);

    function drawControls(mode) {
      controls('<button type="button" class="round" id="st-l" data-hold="left" aria-label="Tip the nose left">◀</button>' +
        (mode === 'launch' ? '<button type="button" class="btn primary big" data-lv="launch">Launch</button>'
          : mode === 'drop' ? '<button type="button" class="btn warn big pulse" data-lv="drop">Drop boosters</button>'
          : '<span class="key-tip">Steer with ◀ ▶ or the arrow keys</span>') +
        '<button type="button" class="round" id="st-r" data-hold="right" aria-label="Tip the nose right">▶</button>');
    }
    function once(key, text, mood) { if (!told[key]) { told[key] = true; say(text, mood); } }
    function paint(dt) {
      var alt = sim.altKm(), frac = sim.coreProp / (ev.tank.prop * 1000);
      set('al-n', (alt < 10 ? alt.toFixed(1) : num(alt)) + ' km'); height('al-f', alt / 220);
      height('tk-o', frac); height('tk-h', frac);
      set('tk-o-t', num(ev.lox * frac) + ' t'); set('tk-h-t', num(ev.lh2 * frac) + ' t');
      if (sim.status === 'flying' && alt > 1.2) once('turn', 'Now the rocket tips over, slowly. This is the {gravityturn|gravity turn}: an orbit needs sideways speed, not just height.');
      if (sim.status === 'flying' && alt > 150) once('meco', 'Nearly there. When the tanks run dry the engines stop: that is {meco|main engine cut-off}.');
      if (hasBoost) { var bf = sim.boostersOn ? sim.boostProp / (ev.boost.prop * 1000) : 0; height('tk-b', bf); set('tk-b-t', sim.boostersOn ? Math.round(bf * 100) + '%' : 'gone'); }
      wobble += dt;
      var noisy = sim.status === 'flying' ? 1 : 0;
      gyro(sim.pitch / D2R, sim.target / D2R, noisy * 1.5 * Math.sin(wobble * 1.7), noisy * 2 * Math.sin(wobble * 0.9 + 1));
      var g = document.querySelector('.gyro');
      if (g) g.dataset.off = Math.abs(sim.err) > 12 ? 'far' : Math.abs(sim.err) > 6 ? 'near' : '';
      // the arrow to press lights up: the needle is right of the green, so tip left, and the other way round
      var sl = document.getElementById('st-l'), sr = document.getElementById('st-r'), fly = sim.status === 'flying';
      if (sl) sl.classList.toggle('is-want', fly && sim.err > 5);
      if (sr) sr.classList.toggle('is-want', fly && sim.err < -5);
      if (fly && Math.abs(sim.err) > 12) say('Tipping too far! Steer the needle back to the green.', 'worry', false);
      var vv = sim.vertical() * 3.6, vh = sim.horizontal() * 3.6, q = sim.qKpa();
      set('da-v', num(sim.speed() * 3.6)); set('da-vv', num(vv)); set('da-vh', num(vh));
      set('da-g', sim.g.toFixed(1)); set('da-q', q < 10 ? q.toFixed(1) : num(q));
      var qb = document.getElementById('da-qb'); if (qb) qb.style.width = Math.min(100, q / Q_FULL * 100).toFixed(0) + '%';
      K.level('da-q-box', sim.maxQDone ? '' : q > 20 ? 'tight' : '');
      if (sim.status !== 'pad') set('da-t', clock(sim.t));
      // what each number means at this moment, for the pop-up
      note('al', 'You are ' + (alt < 10 ? alt.toFixed(1) : num(alt)) + ' km up. ' + (alt < 100 ? 'Space begins at 100 km.' : 'You are above the Kármán line: this is space.'));
      note('da-v', num(sim.speed() * 3.6) + ' km/h over the ground. Orbit needs about 28,000 km/h, nearly all of it sideways.');
      note('da-vv', vv >= 0 ? 'Climbing at ' + num(vv) + ' km/h.' : 'Dropping at ' + num(-vv) + ' km/h.');
      note('da-vh', num(vh) + ' km/h along the ground. This is the part that makes an orbit, and it grows as the rocket tips over.');
      note('da-g', sim.g.toFixed(1) + ' g: everything on board feels ' + sim.g.toFixed(1) + ' times its normal weight. The engines ease off at 3.5 g.');
      note('da-q', q.toFixed(1) + ' kPa. ' + (sim.maxQDone ? 'The peak, Max Q, was ' + (sim.maxQ / 1000).toFixed(0) + ' kPa. The air is thinning now.' : 'Still rising toward Max Q.'));
      bar(Math.min(1, Math.max(alt, 0) / 200));
    }
    function finish() {
      if (ended) return;
      ended = true;
      A.stopRumble(); Stage.shake = 0;
      var res = sim.result();
      var WORDS = ['thrust', 'weight', 'pitch', 'gravityturn', 'maxq', 'q', 'gforce', 'staging', 'karman', 'velocity', 'meco'];
      quick = !res.ok;
      if (res.ok) {
        var stars = res.accuracy >= 0.85 && !res.dropLate ? 3 : res.accuracy >= 0.65 ? 2 : 1;
        Pg.data.meco = { state: res.state, build: build }; Pg.save();
        complete(3, stars, 'You reached space!', 'Main engine cut-off at ' + num(res.altKm) + ' km and ' + num(res.speed * 3.6) + ' km/h. You held the right pitch ' + Math.round(res.accuracy * 100) + '% of the way' +
          (res.dropLate ? ', but the empty boosters were dropped late: dead weight costs speed.' : '.') + ' The upper stage will finish the job in level 4.', [res.accuracy >= 0.9 && 'steady'], { words: WORDS });
      } else if (res.failWhy === 'tipped') failed(3, 'It tipped over', 'The nose swung more than 28° away from the {pitch} the computer wanted, and the rushing air took over. Near {maxq|Max Q} the wind pushes hardest: use small, early taps to stay in the green.', 'tip');
      else if (res.failWhy === 'fell') failed(3, 'It fell back', 'The engines could not give this rocket enough speed. Its {twr} is too low for the {propellant} it carries. Build a stronger one.', 'heavy', '<button type="button" class="btn primary big" data-lv="go" data-id="2">Try this: rebuild it</button>');
      else failed(3, 'Too slow', 'The tanks ran dry before the rocket was fast enough for the upper stage to finish the trip. Every degree off the green wastes {thrust}: stay closer to it.', 'fall');
    }
    return {
      launch: function () {
        if (counting || sim.status !== 'pad') return;
        counting = true;
        drawControls('fly');
        if (quick) {
          K.countEl.textContent = 'Lift-off!'; K.countEl.className = 'is-on is-word';
          setTimeout(function () { K.countEl.className = ''; }, 900);
          sim.launch(); A.rumble(45);
          return;
        }
        [3, 2, 1].forEach(function (n, i) {
          setTimeout(function () { if (K.cur && K.cur.id === 3 && !ended) { K.countEl.textContent = n; K.countEl.className = 'is-on'; A.play('count'); } }, i * 800);
        });
        setTimeout(function () {
          if (!K.cur || K.cur.id !== 3 || ended) return;
          K.countEl.textContent = 'Lift-off!'; K.countEl.className = 'is-on is-word';
          setTimeout(function () { K.countEl.className = ''; }, 1100);
          sim.launch(); A.rumble(45);
        }, 2400);
      },
      drop: function () { sim.dropBoosters(); },
      frame: function (dt) {
        if (ended) return;
        if (sim.status === 'flying') sim.step(dt, 8, (keys.right ? 1 : 0) - (keys.left ? 1 : 0));
        while (seenEvents < sim.events.length) {
          var e = sim.events[seenEvents++];
          if (e === 'liftoff') say('Lift-off! The {thrust} is bigger than the {weight}, so the rocket rises.');
          else if (e === 'maxq') say('That was {maxq|Max Q}: the hardest push of the air on the rocket. It gets smoother from here.', 'worry');
          else if (e === 'boosters-empty') { drawControls('drop'); say('The {booster|boosters} are empty. Drop them! Dead weight costs speed. This is {staging}.', 'wow'); A.play('warn'); }
          else if (e === 'boosters-dropped') { drawControls('fly'); say(sim.dropLate ? 'The computer dropped the boosters for you, a few seconds late.' : '{separation|Booster separation}! The rocket is [[' + num(ev.boost.dry) + ' tonnes ]]lighter.', sim.dropLate ? 'worry' : 'cheer'); A.play('go'); }
          else if (e === 'space') { say('100 km: the {karman}. You are in space!', 'cheer'); A.play('star'); }
        }
        var alt = Math.max(0, sim.altKm()), sky = Stage.smooth((alt - 8) / 75);
        R.flightUpdate({ alt: alt * 1000, pitch: sim.pitch, burn: sim.status === 'flying' && sim.coreProp > 0 ? sim.throttle : 0,
          boost: !hasBoost ? 'none' : !sim.boostersOn ? 'gone' : sim.boostersEmpty ? 'empty' : sim.status === 'flying' ? 'on' : 'empty', sky: sky }, dt);
        var y = R.vehicle.position.y + R.height * 0.45 * Math.cos(sim.pitch), x = R.height * 0.45 * Math.sin(sim.pitch);
        var radius = R.height * 1.7 + 40 + Math.min(80, alt * 0.8), el = alt < 1 ? 0.06 : 0.06 + 0.22 * Stage.smooth(alt / 60);
        Stage.look({ radius: radius, el: Math.max(el, Math.asin(Math.max(-1, Math.min(1, (3 - y) / radius)))), speed: 5 });
        Stage.rig.goal.target.set(x, y, 0); Stage.rig.target.set(x, y, 0);
        paint(dt);
        if (sim.status === 'meco' || sim.status === 'fail') finish();
      },
      live: function () { return !ended && sim.status === 'flying'; },
      cleanup: function () {}
    };
  };
})();
