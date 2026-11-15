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
  var set = K.set, height = K.height, tankHtml = K.tankHtml, gyroHtml = K.gyroHtml, gyro = K.gyro, clock = K.clock;
  RG.LevelDefs = RG.LevelDefs || {};

  RG.LevelDefs[3] = function () {
    var build = Pg.data.build || DEFAULT_BUILD, ev = F.evaluate(build), hasBoost = ev.boost.thrust > 0;
    var sim = new F.Ascent(build, 1 + Math.floor(Math.random() * 40));
    var seenEvents = 0, counting = false, ended = false, wobble = 0;
    R.setBuild({ tank: build.tank, engines: build.engines, boosters: build.boosters, top: true, satellite: DEFAULT_SAT });
    K.App.view('ascent');
    hud('<div class="alt plate-w"><b id="al-n">0 km</b><span>Altitude</span><div class="alt-bar"><i id="al-f"></i>' +
      '<em style="bottom:' + (10 / 220 * 100) + '%">Clouds</em><em style="bottom:' + (100 / 220 * 100) + '%">Space 100 km</em><em class="goal" style="bottom:' + (200 / 220 * 100) + '%">Goal 200 km</em></div></div>' +
      '<div class="hud-r"><div class="tanks plate-w">' + tankHtml('tk-o', 'ox', 'Oxygen') + tankHtml('tk-h', 'h2', 'Hydrogen') + (hasBoost ? tankHtml('tk-b', 'srb', 'Boosters') : '') + '</div>' +
      gyroHtml() + '<div class="data plate-w"><div><span>Speed</span><b id="da-v">0 km/h</b></div><div><span>Push</span><b id="da-g">0 g</b></div><div><span>Clock</span><b id="da-t">T−3</b></div></div></div>');
    drawControls('launch');
    say('Keep the needle in the green. Ready?');
    paint(0);

    function drawControls(mode) {
      controls('<button type="button" class="round" data-hold="left" aria-label="Tip left">◀</button>' +
        (mode === 'launch' ? '<button type="button" class="btn primary big" data-lv="launch">Launch</button>'
          : mode === 'drop' ? '<button type="button" class="btn warn big pulse" data-lv="drop">Drop boosters</button>'
          : '') +
        '<button type="button" class="round" data-hold="right" aria-label="Tip right">▶</button>');
    }
    function paint(dt) {
      var alt = sim.altKm(), frac = sim.coreProp / (ev.tank.prop * 1000);
      set('al-n', (alt < 10 ? alt.toFixed(1) : num(alt)) + ' km'); height('al-f', alt / 220);
      height('tk-o', frac); height('tk-h', frac);
      set('tk-o-t', num(ev.lox * frac) + ' t'); set('tk-h-t', num(ev.lh2 * frac) + ' t');
      if (hasBoost) { var bf = sim.boostersOn ? sim.boostProp / (ev.boost.prop * 1000) : 0; height('tk-b', bf); set('tk-b-t', sim.boostersOn ? Math.round(bf * 100) + '%' : 'gone'); }
      wobble += dt;
      var noisy = sim.status === 'flying' ? 1 : 0;
      gyro(sim.pitch / D2R, sim.target / D2R, noisy * 1.5 * Math.sin(wobble * 1.7), noisy * 2 * Math.sin(wobble * 0.9 + 1));
      var g = document.querySelector('.gyro');
      if (g) g.dataset.off = Math.abs(sim.err) > 12 ? 'far' : Math.abs(sim.err) > 6 ? 'near' : '';
      if (sim.status === 'flying' && Math.abs(sim.err) > 12) say('Tipping too far! Steer back to the green.', 'worry');
      set('da-v', num(sim.speed() * 3.6) + ' km/h'); set('da-g', sim.g.toFixed(1) + ' g');
      if (sim.status !== 'pad') set('da-t', clock(sim.t));
      bar(Math.min(1, Math.max(alt, 0) / 200));
    }
    function finish() {
      if (ended) return;
      ended = true;
      A.stopRumble(); Stage.shake = 0;
      var res = sim.result();
      if (res.ok) {
        var stars = res.accuracy >= 0.85 && !res.dropLate ? 3 : res.accuracy >= 0.65 ? 2 : 1;
        Pg.data.meco = { state: res.state, build: build }; Pg.save();
        complete(3, stars, 'You reached space!', 'On course ' + Math.round(res.accuracy * 100) + '% of the way' + (res.dropLate ? ', boosters dropped late' : ''), [res.accuracy >= 0.9 && 'steady']);
      } else if (res.failWhy === 'tipped') failed(3, 'It tipped over', 'Use small, early taps to stay in the green.', 'tip');
      else if (res.failWhy === 'fell') failed(3, 'It fell back', 'This rocket is too weak. Build a stronger one.', 'heavy', '<button type="button" class="btn primary big" data-lv="go" data-id="2">Try this: rebuild it</button>');
      else failed(3, 'Too slow', 'Stay closer to the green to waste less fuel.', 'fall');
    }
    return {
      launch: function () {
        if (counting || sim.status !== 'pad') return;
        counting = true;
        drawControls('fly');
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
          if (e === 'liftoff') say('Lift-off!');
          else if (e === 'maxq') say('Max Q: the air pushes hardest now. Hold steady!', 'worry');
          else if (e === 'boosters-empty') { drawControls('drop'); say('Boosters empty. Drop them!', 'wow'); A.play('warn'); }
          else if (e === 'boosters-dropped') { drawControls('fly'); say(sim.dropLate ? 'Boosters dropped (a bit late).' : 'Boosters away!', sim.dropLate ? 'worry' : 'cheer'); A.play('go'); }
          else if (e === 'space') { say('100 km. This is space!', 'cheer'); A.play('star'); }
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
      cleanup: function () {}
    };
  };
})();
