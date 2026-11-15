/* Orbit Ranger — Level 4: reach orbit.
 * Coast to the top of the arc, burn sideways until the path closes, then
 * release the satellite over real NASA fire detections.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE;
  var F = RG.Flight, E = RG.Earth, P = RG.Physics, A = RG.Audio, D = RG.DATA, W = RG.Widgets;
  var K = RG.LevelKit, Pg = RG.Progress, num = W.num;
  var say = K.say, bar = K.bar, hud = K.hud, controls = K.controls;
  var complete = K.complete, failed = K.failed, keys = K.keys, DEFAULT_SAT = K.DEFAULT_SAT, DEFAULT_BUILD = K.DEFAULT_BUILD, D2R = Math.PI / 180;
  var set = K.set, height = K.height, tankHtml = K.tankHtml, gyroHtml = K.gyroHtml, gyro = K.gyro, rd = K.rd, note = K.note;
  RG.LevelDefs = RG.LevelDefs || {};

  /** The little upper stage with the satellite on its nose, for the globe view. */
  function stageModel() {
    var g = new THREE.Group();
    var white = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.4, metalness: 0.8 });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 24), white); body.rotation.z = Math.PI / 2;
    var bell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 0.2, 20, 1, true), dark); bell.rotation.z = Math.PI / 2; bell.position.x = -0.34;
    var sat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xe6ad3e, roughness: 0.35, metalness: 0.9 })); sat.position.x = 0.36;
    g.add(body, bell, sat);
    return g;
  }

  RG.LevelDefs[4] = function () {
    var build = Pg.data.build || DEFAULT_BUILD, st = Pg.data.meco && Pg.data.meco.state;
    if (!st) { var tf = F.testFlight(build); if (!tf.ok) { build = DEFAULT_BUILD; tf = F.testFlight(build); } st = tf.state; }
    var sim = new F.Insertion(st), orb = { inc: F.SITE.lat, raanDeg: -60 };
    var apex = P.orbitPos(orb, Math.PI / 2), alpha = Math.atan2(-apex[2], apex[0]);
    var theta0 = alpha - F.SITE.lon * D2R; // the launch site sits under the start of the flight path
    var trail = [], trailClock = 0, told = '', orbitAt = -1, canDeploy = false, done = false, ended = false, wasBurning = false;
    K.App.view('insert', { az: alpha + st.u - 0.25, el: 0.85 });
    E.addPin('Kennedy Space Center', F.SITE.lat, F.SITE.lon);
    E.setSatModel(stageModel());
    hud('<button type="button" class="alt plate-w" data-term="altitude" id="al-box"><b id="al-n">0 km</b><span>Altitude</span><div class="alt-bar"><i id="al-f"></i>' +
      '<em style="bottom:' + (100 / 400 * 100) + '%">Space 100 km</em><em class="goal" style="bottom:' + (F.ORBIT_MIN / 400 * 100) + '%">Orbit ' + F.ORBIT_MIN + ' km</em></div></button>' +
      '<div class="hud-r"><div class="tanks plate-w">' + tankHtml('tk-o', 'ox', 'Oxygen', 'lox') + tankHtml('tk-h', 'h2', 'Hydrogen', 'lh2') + '</div>' + gyroHtml('PATH') +
      '<div class="rds plate-w" id="orbit-data">' +
      rd('da-v', 'orbitalv', 'Velocity', { unit: 'km/h', cls: 'is-wide', sub: 'da-vn' }) +
      rd('da-p', 'periapsis', 'Periapsis (low)', { unit: 'km' }) + rd('da-a', 'apoapsis', 'Apoapsis (high)', { unit: 'km' }) +
      rd('da-l', 'period', 'Period: one lap', { cls: 'is-wide' }) + '</div></div>');
    controls('<button type="button" class="btn primary big hold" data-hold="burn">Hold to burn</button><span class="key-tip">or hold the space bar</span>');
    say('The main engines are off. You are coasting up to the {apoapsis|highest point} of the arc, like a thrown ball. Get ready to {burn}.');

    function pos(u, r) { var v = P.orbitPos(orb, Math.PI / 2 + u), k = r / F.RE; return [v[0] * k, v[1] * k, v[2] * k]; }
    function paint() {
      var el = F.elements(sim.s), frac = sim.prop / (F.UPPER.prop * 1000), ox = F.UPPER.prop * F.MIX / (F.MIX + 1), h2 = F.UPPER.prop / (F.MIX + 1);
      var alt = sim.altKm();
      set('al-n', num(alt) + ' km'); height('al-f', alt / 400);
      height('tk-o', frac); height('tk-h', frac);
      set('tk-o-t', (ox * frac * 1000).toFixed(0) + ' kg'); set('tk-h-t', (h2 * frac * 1000).toFixed(0) + ' kg');
      gyro(90 - Math.atan2(sim.s.vr, sim.s.vt) / D2R, 90, 0, 0);
      var need = Math.sqrt(F.MU / sim.s.r) * 3.6, v = sim.speed() * 3.6;
      set('da-v', num(v)); set('da-vn', sim.inOrbit ? 'fast enough to stay up' : 'an orbit here needs ' + num(need));
      set('da-p', num(el.periKm)); // a negative height means the low point is under the ground
      set('da-a', isFinite(el.apoKm) ? num(el.apoKm) : 'escaping');
      set('da-l', sim.inOrbit ? el.periodMin.toFixed(0) + ' min' : 'not an orbit yet');
      K.level('da-p-box', sim.inOrbit ? 'ok' : el.periKm < 100 ? 'over' : 'tight');
      var d = document.getElementById('orbit-data');
      if (d) d.dataset.orbit = sim.inOrbit;
      note('al', 'You are ' + num(alt) + ' km up, and ' + (sim.s.vr > 0 ? 'still climbing.' : 'falling back.'));
      note('da-v', num(v) + ' km/h. A circular orbit at this height needs ' + num(need) + ' km/h, all of it sideways.');
      note('da-p', el.periKm < 0 ? 'The low point of your path is under the ground: without a burn you come back down.' : 'The low point of your path is ' + num(el.periKm) + ' km up. It must be above ' + F.ORBIT_MIN + ' km to stay clear of the air.');
      note('da-a', isFinite(el.apoKm) ? 'The high point of your path is ' + num(el.apoKm) + ' km up. Burning there raises the low point the most.' : 'You are going fast enough to leave Earth altogether.');
      note('da-l', sim.inOrbit ? 'One lap takes ' + el.periodMin.toFixed(0) + ' minutes: about 16 sunrises a day.' : 'A path that hits the ground has no period. Raise the low point first.');
      bar(Math.min(1, Math.max(0, (el.periKm + 6300) / (F.ORBIT_MIN + 6300))) * (done ? 1 : 0.92));
      // the path ahead: where the rocket will go if the engine stays off
      var pts = [], N = 160;
      for (var i = 0; i <= N; i++) {
        var nu = (i / N) * 2 * Math.PI, den = 1 + el.e * Math.cos(nu);
        if (den < 0.08) continue;
        var p = pos(sim.s.u + (nu - el.nu), el.p / den);
        pts.push(p[0], p[1], p[2]);
      }
      E.setRibbon('ahead', pts, 0.014, sim.inOrbit ? 0x58cc02 : 0xffc800);
      if (trail.length >= 6) E.setRibbon('trail', trail, 0.008, 0xffffff);
    }
    function tell(key, text, mood) { if (told !== key) { told = key; say(text, mood); } }
    function fires(altKm) {
      // count the real fires (NASA FIRMS, this week) that pass under the satellite in three laps
      var rec = RG.NASA_FIRES.recent.points, n = rec.length / 2, seen = new Uint8Array(n), vec = [], i;
      for (i = 0; i < n; i++) vec.push(P.latLonToVec(rec[i * 2], rec[i * 2 + 1]));
      var lap = P.periodMin(altKm), rate = 2 * Math.PI / lap, cosS = Math.cos(P.swathHalfAngle(altKm, D.SENSORS.wide.scanHalfDeg)), total = 0;
      for (var t = 0; t < lap * 3; t += 0.5) {
        var sub = P.toEarthFixed(P.orbitPos(orb, rate * t), P.EARTH_RATE * t);
        for (i = 0; i < n; i++) if (!seen[i] && P.dot(sub, vec[i]) >= cosS) { seen[i] = 1; total++; }
      }
      return total;
    }
    function fail(why) {
      if (ended) return;
      ended = true;
      controls('');
      if (why === 'fuel') failed(4, 'Out of propellant', 'The upper stage ran dry before the {periapsis|low point} of the path rose out of the air. A {burn} does the most good at the {apoapsis|top of the arc}: start it there.', 'fuel');
      else failed(4, 'It fell back', 'The {periapsis|low point} of the path was still inside the air, so the rocket came down. Height is not enough: an {orbit} needs sideways speed. Burn sooner, and hold until the path turns green.', 'fuel');
    }
    return {
      deploy: function () {
        if (!canDeploy || done) return;
        done = true;
        controls('');
        A.play('alert');
        E.setSatModel(RG.SatModel.flightCopy(DEFAULT_SAT));
        var r = sim.result(), mid = (r.apoKm + r.periKm) / 2, seenFires = fires(mid);
        var stars = r.round <= 120 && r.fuelLeft >= 0.2 ? 3 : r.round <= 300 ? 2 : 1;
        bar(1);
        setTimeout(function () {
          if (!K.cur || K.cur.id !== 4) return;
          complete(4, stars, 'You are in orbit!', 'Apoapsis ' + num(r.apoKm) + ' km, periapsis ' + num(r.periKm) + ' km, one lap every ' + r.periodMin.toFixed(0) + ' minutes at ' + num(r.speed * 3.6) + ' km/h. Ranger-1 already flew over <b>' + num(seenFires) + '</b> real fires NASA saw this week.',
            [r.fuelLeft >= 0.33 && 'saver', r.round <= 60 && 'circle'], { words: ['orbit', 'orbitalv', 'apoapsis', 'periapsis', 'burn', 'prograde', 'circularize', 'period', 'deltav'] });
        }, 1400);
      },
      frame: function (dt) {
        if (ended) return;
        var burning = keys.burn && sim.prop > 0 && !done;
        if (burning && !wasBurning) A.rumble(30);
        if (!burning && wasBurning) A.stopRumble();
        wasBurning = burning;
        sim.step(dt * (burning ? 4 : done || sim.inOrbit ? 12 : 26), burning);
        if (sim.status === 'fail') { fail(sim.prop <= 0 ? 'fuel' : 'fell'); return; }
        if (!done) {
          if (sim.inOrbit && orbitAt < 0) { orbitAt = 0; A.play('star'); }
          if (sim.inOrbit && !burning) {
            if (!canDeploy) { canDeploy = true; controls('<button type="button" class="btn primary big pulse" data-lv="deploy">Release the satellite</button>'); }
            tell('orbit', 'You are in {orbit}! The path no longer touches the air. Release the satellite.', 'cheer');
          } else if (sim.inOrbit) tell('letgo', 'Green path: the {periapsis|low point} is above the air. Let go!', 'cheer');
          else if (burning) tell('burn', 'Keep holding. This is {circularize|circularizing}: the {periapsis|low point} of your path is rising.');
          else if (sim.prop <= 0) tell('dry', 'The tanks are empty…', 'sad');
          else if (sim.s.vr < 80) tell('now', 'Now! Hold the button. A {prograde} burn at the top adds the sideways speed an orbit needs.', 'wow');
        }
        var p = pos(sim.s.u, sim.s.r);
        trailClock += dt;
        if (trailClock > 0.08) { trailClock = 0; trail.push(p[0], p[1], p[2]); if (trail.length > 900) trail.splice(0, 3); }
        E.setTheta(theta0 + P.EARTH_RATE * (sim.t / 60));
        var len = sim.s.r / F.RE;
        E.setSat([p[0] / len, p[1] / len, p[2] / len], sim.altKm(), { lam: done ? P.swathHalfAngle(sim.altKm(), D.SENSORS.wide.scanHalfDeg) : 0 });
        paint();
      },
      live: function () { return !ended && !done; },
      resume: function () { wasBurning = false; },
      cleanup: function () { E.clearRibbons(); }
    };
  };
})();
