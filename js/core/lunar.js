/* Orbit Ranger — the Moon landing rules (level 6).
 * Plan a landing (site, science kit, who works the throttle), fly the last
 * minute of the descent, then work on the surface. No browser code: this file
 * also runs in Node for the tests.
 *
 * Real numbers used here:
 *   Moon gravity 1.62 m/s² (one sixth of Earth's)
 *   Apollo Lunar Module descent engine: 45,040 N at full thrust, specific impulse 311 s
 *   Landing limits from the Lunar Module's design: about 3 m/s down, 1.2 m/s sideways, 12° of slope
 * Simplified on purpose: the flight is in one vertical plane, it starts 1.1 km
 * from the target, and the masses and the oxygen clock are scaled for play.
 * The shape of the ground at each site comes from NASA (assets/moon-sites.js);
 * its width and height range are set here.
 */
(function (root) {
  'use strict';
  var RG = (root.RG = root.RG || {});
  var G = 1.62, THRUST = 45040, ISP = 311, G0 = 9.80665, D2R = Math.PI / 180;
  var DRY = 7300;        // kg landed without descent fuel or kit: fuelled ascent stage, empty descent stage, crew
  var SPARE = 150;       // kg the planners may share between science kit and extra fuel
  var FUEL_BASE = 400;   // kg of descent fuel left when the game takes over, before any spare is added
  var SIZE = 2600;       // metres across the square of ground
  var APPROACH = 1100, START_ALT = 520;
  var PITCH_RATE = 0.45, PITCH_MAX = 1.2;
  // The real descent engine could not be turned down below about a tenth of full thrust. While the computer
  // has the throttle it keeps at least that much, so leaning the lander always does something.
  var THR_MIN = 0.1;
  // Steering help. A person reacts a third of a second or more after the screen changes, and a lander that
  // turns at full speed until the button is let go sails past the attitude it wanted, then back again, burning
  // fuel all the way. So the turn slows as the lander nears the attitude the guidance wants (inside ASSIST_BAND
  // radians, down to ASSIST_MIN of full speed) and turning away from it is slow (ASSIST_AWAY). The pilot can
  // still put the lander anywhere; it just settles instead of swinging. tests/learn-tests.js flies it late.
  var ASSIST_BAND = 0.22, ASSIST_MIN = 0.16, ASSIST_AWAY = 0.3;
  var THR_RATE = 0.7, THR_BAND = 0.25, THR_ASSIST_MIN = 0.18; // the same help for a hand on the throttle
  var MODES = { full: 'F', auto: 'A', manual: 'M' };           // who flies: the computer, both, or you
  var CLOSE = 10, CREEP = 0.2, BRAKE = 0.83;                   // final approach: see Descent.guide
  var MARGIN_MIN = 0.05, MARGIN_THIN = 0.15;                   // share of propellant a clean landing must leave: no-go below the first, caution below the second

  var SITES = {
    apollo11: { name: 'Sea of Tranquility', short: 'Tranquility', mission: 'Apollo 11', year: 1969, lat: 0.674, lon: 23.473, relief: 60, science: 0.8,
      blurb: 'A wide, flat plain of old dark lava. The safest ground on this list, and the least varied rocks.',
      real: 'Neil Armstrong and Buzz Aldrin landed here on 20 July 1969 with about 25 seconds of fuel to spare.' },
    apollo12: { name: 'Ocean of Storms', short: 'Storms', mission: 'Apollo 12', year: 1969, lat: -3.012, lon: -23.422, relief: 90, science: 0.85,
      blurb: 'Flat lava dotted with craters. Aim well: the crew landed beside an older robot lander on purpose.',
      real: 'Apollo 12 touched down 160 m from Surveyor 3, which had landed two and a half years earlier.' },
    apollo14: { name: 'Fra Mauro hills', short: 'Fra Mauro', mission: 'Apollo 14', year: 1971, lat: -3.645, lon: -17.471, relief: 140, science: 0.9,
      blurb: 'Rolling hills made of rock thrown out by a giant impact. Bumpier ground, older rocks.',
      real: 'Alan Shepard hit two golf balls here in 1971.' },
    apollo15: { name: 'Hadley Rille', short: 'Hadley', mission: 'Apollo 15', year: 1971, lat: 26.132, lon: 3.634, relief: 420, science: 1,
      blurb: 'A plain squeezed between tall mountains and a deep winding canyon. Hard to reach, rich in science.',
      real: 'Apollo 15 was the first mission to drive a rover, and brought back the 4-billion-year-old “Genesis Rock”.' },
    apollo16: { name: 'Descartes highlands', short: 'Descartes', mission: 'Apollo 16', year: 1972, lat: -8.973, lon: 15.5, relief: 260, science: 1,
      blurb: 'Bright, rough highlands. The only landing in the Moon’s ancient uplands.',
      real: 'The rocks here turned out to be smashed-up crust, not the volcanic rock scientists expected.' },
    apollo17: { name: 'Taurus–Littrow valley', short: 'Littrow', mission: 'Apollo 17', year: 1972, lat: 20.191, lon: 30.772, relief: 520, science: 1,
      blurb: 'A narrow valley between mountains over 2 km tall. The approach flies over a ridge.',
      real: 'Geologist Harrison Schmitt found orange soil here: tiny beads of volcanic glass. Nobody has been back since.' }
  };
  var SITE_ORDER = ['apollo11', 'apollo12', 'apollo14', 'apollo15', 'apollo16', 'apollo17'];

  // The science kit. kg: mass carried down. pts: science points. secs: time to set up on the surface.
  var KIT = {
    flag: { name: 'Flag of Nepal and TV camera', short: 'Flag', icon: 'cam', kg: 10, pts: 5, secs: 6, r: 13, verb: 'Plant the flag of Nepal',
      blurb: 'The flag of Nepal, and a camera so the whole world can watch.',
      lesson: 'The flag of Nepal stands on the Moon. With no wind, it stays perfectly still.' },
    rocks: { name: 'Rock boxes and scoop', short: 'Rocks', icon: 'box', kg: 25, pts: 13, secs: 3, r: 0, verb: 'Collect 3 rock samples',
      blurb: 'Bring Moon rocks home. Scientists still study them today.',
      lesson: 'Apollo crews brought back 382 kg of rock and soil. It showed the Moon is about 4.5 billion years old.' },
    seismo: { name: 'Moonquake sensor', short: 'Quakes', icon: 'radio', kg: 48, pts: 12, secs: 9, r: 34, verb: 'Set up the moonquake sensor',
      blurb: 'A seismometer that listens for moonquakes and meteorite hits.',
      lesson: 'Apollo seismometers felt thousands of moonquakes. They showed the Moon has a small core.' },
    mirror: { name: 'Laser mirror', short: 'Mirror', icon: 'laser', kg: 30, pts: 10, secs: 5, r: 29, verb: 'Place the laser mirror',
      blurb: 'A tray of mirrors that bounces laser beams back to Earth. It needs no power.',
      lesson: 'Scientists still fire lasers at the Apollo mirrors. The Moon drifts 3.8 cm farther from Earth every year.' },
    drill: { name: 'Heat-flow drill', short: 'Drill', icon: 'bolt', kg: 60, pts: 14, secs: 12, r: 46, verb: 'Drill for heat',
      blurb: 'Drills two holes and measures heat leaking out of the Moon. Heavy and slow.',
      lesson: 'Heat probes on Apollo 15 and 17 showed the Moon is still warm inside.' },
    oxygen: { name: 'Extra oxygen pack', short: 'Oxygen', icon: 'batt', kg: 25, pts: 0, secs: 0, r: 0, verb: '',
      blurb: 'No science by itself, but a longer walk: one more minute outside.',
      lesson: '' }
  };
  var KIT_ORDER = ['flag', 'rocks', 'seismo', 'mirror', 'drill', 'oxygen'];
  var WALK = { speed: 2.3, jump: 2.0, o2: 150, o2Extra: 60, range: 150 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function decode16(b64) {
    var bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('latin1');
    var n = bin.length / 2, out = new Float32Array(n);
    for (var i = 0; i < n; i++) out[i] = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) / 65535;
    return out;
  }

  /* ---------- the ground ---------- */
  var groundCache = {};
  /** The ground at a site: height(x, z) in metres, with x along the flight path and the landing target at (0, 0). */
  function terrain(siteId) {
    if (groundCache[siteId]) return groundCache[siteId];
    var site = SITES[siteId], raw = RG.MOON_SITES[siteId], n = raw.n, h = decode16(raw.h);
    function grid(u, v) {
      var fx = clamp(u * n - 0.5, 0, n - 1.001), fz = clamp(v * n - 0.5, 0, n - 1.001);
      var ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz, o = iz * n + ix;
      return (h[o] * (1 - ax) + h[o + 1] * ax) * (1 - az) + (h[o + n] * (1 - ax) + h[o + n + 1] * ax) * az;
    }
    var h0 = grid(raw.tx, raw.tz), rnd = rng(SITE_ORDER.indexOf(siteId) * 977 + 11);
    // distance to the landing strip: the target, and the spare spot 110 m beyond it
    function strip(x, z) { var px = clamp(x, 0, 120); return Math.hypot(x - px, z); }
    var craters = [], rocks = [], i;
    for (i = 0; i < 34; i++) {
      var cx = (rnd() * 2 - 1) * 520, cz = (rnd() * 2 - 1) * 420, cr = 5 + Math.pow(rnd(), 2) * 30;
      if (strip(cx, cz) > cr + 16) craters.push({ x: cx, z: cz, r: cr, d: cr * (0.14 + rnd() * 0.07) });
    }
    for (i = 0; i < 260; i++) {
      var rx = (rnd() * 2 - 1) * 380, rz = (rnd() * 2 - 1) * 300, rs = 0.25 + Math.pow(rnd(), 3) * 1.9;
      if (strip(rx, rz) > 9 + rs * 2) rocks.push({ x: rx, z: rz, s: rs, a: rnd() * 6.28 });
    }
    var field = []; // the boulder field that can turn up on the target (see events)
    for (i = 0; i < 26; i++) { var fa = rnd() * 6.28, fr = Math.sqrt(rnd()) * 24; field.push({ x: Math.cos(fa) * fr, z: Math.sin(fa) * fr, s: 0.7 + rnd() * 1.6, a: rnd() * 6.28 }); }
    function height(x, z) {
      var y = (grid(raw.tx + x / SIZE, raw.tz + z / SIZE) - h0) * site.relief;
      var d = strip(x, z), w = d < 40 ? 1 : d > 130 ? 0 : 1 - (d - 40) / 90;
      y *= 1 - 0.9 * w * w * (3 - 2 * w);
      for (var k = 0; k < craters.length; k++) {
        var c = craters[k], q = Math.hypot(x - c.x, z - c.z) / c.r;
        if (q < 1.6) y += q < 1 ? -c.d * (1 - q * q) + c.d * 0.16 * q * q : c.d * 0.16 * Math.exp(-Math.pow((q - 1) / 0.28, 2));
      }
      return y;
    }
    var T = {
      id: siteId, site: site, size: SIZE, craters: craters, rocks: rocks, field: field, rough: raw.rough,
      minX: -raw.tx * SIZE, maxX: (1 - raw.tx) * SIZE, minZ: -raw.tz * SIZE, maxZ: (1 - raw.tz) * SIZE,
      height: height,
      profile: function (x) { return height(x, 0); },
      /** Steepness of the ground in degrees. */
      slope: function (x, z) {
        var gx = (height(x + 2.5, z) - height(x - 2.5, z)) / 5, gz = (height(x, z + 2.5) - height(x, z - 2.5)) / 5;
        return Math.atan(Math.hypot(gx, gz)) / D2R;
      }
    };
    // how high Earth hangs in the sky here: straight overhead at the middle of the near side
    T.earthEl = 90 - Math.acos(Math.cos(site.lat * D2R) * Math.cos(site.lon * D2R)) / D2R;
    groundCache[siteId] = T;
    return T;
  }

  /* ---------- the plan ---------- */
  function hoverRate(mass) { return mass * G / (ISP * G0); } // kg of fuel a second, just to stay up

  var cleanCache = {};
  /**
   * Fly the approach to a site with the guidance computer and no surprises, and report what is left.
   * This is the plan's fuel margin: a real flight over that site's real ground, not a rule of thumb.
   */
  function cleanLanding(siteId, kitKg, fuel) {
    var key = siteId + '|' + kitKg + '|' + Math.round(fuel);
    if (cleanCache[key]) return cleanCache[key];
    var d = new Descent({ terrain: terrain(siteId), dry: DRY + kitKg, fuel: fuel, mode: 'full', seed: 1 });
    d.ev = { alarm: 0, boulders: false };
    for (var i = 0; i < 60 * 240 && d.status === 'fly'; i++) d.tick(1 / 60, {});
    var r = d.result, ok = !!r && r.grade !== 'crash';
    return (cleanCache[key] = { ok: ok, margin: ok ? r.fuelFrac : 0, left: ok ? r.fuel : 0, used: ok ? fuel - r.fuel : fuel, time: r ? r.time : 240 });
  }

  /** Work out what a plan means. plan: { site, kit: [ids], mode: 'auto' | 'manual' } */
  function plan(p) {
    var site = SITES[p.site], kitKg = 0, pts = 0, work = 0, far = 0, checks = [];
    (p.kit || []).forEach(function (k) { var it = KIT[k]; kitKg += it.kg; pts += it.pts; work += it.secs; far = Math.max(far, it.r); });
    var over = kitKg > SPARE, fuel = FUEL_BASE + Math.max(0, SPARE - kitKg), mass = DRY + kitKg + fuel;
    var hover = fuel / hoverRate(mass);
    var clean = site && !over ? cleanLanding(p.site, kitKg, fuel) : { ok: false, margin: 0, left: 0, used: 0, time: 0 };
    var o2 = WALK.o2 + (p.kit.indexOf('oxygen') >= 0 ? WALK.o2Extra : 0);
    var jobs = p.kit.filter(function (k) { return KIT[k].pts > 0; });
    // a rough guess of the time outside: walking out and back between jobs, plus the set-up time
    var need = work + jobs.length * 18 + (p.kit.indexOf('rocks') >= 0 ? 30 : 0) + 14;
    var science = Math.min(45, pts * (site ? site.science : 1));
    function check(id, level, title, text) { checks.push({ id: id, level: level, title: title, text: text }); }
    if (over) check('mass', 'nogo', 'Too heavy to land', 'The kit weighs ' + kitKg + ' kg. The lander has ' + SPARE + ' kg to spare. Leave something behind.');
    else check('mass', 'go', 'The kit fits', kitKg + ' kg of kit. The other ' + (SPARE - kitKg) + ' kg of spare mass is carried as extra fuel.');
    if (!over && site) {
      // the margin: what a clean, computer-flown landing at this site leaves in the tanks
      var pc = Math.round(clean.margin * 100), usedTxt = 'A clean landing here burns ' + Math.round(clean.used) + ' of your ' + Math.round(fuel) + ' kg of propellant, and leaves ' + pc + '%.';
      if (clean.margin < MARGIN_MIN) check('fuel', 'nogo', 'No propellant margin', usedTxt + ' Mission rules want at least ' + Math.round(MARGIN_MIN * 100) + '%. Pack less kit, or choose flatter ground.');
      else if (clean.margin < MARGIN_THIN) check('fuel', 'watch', 'Thin propellant margin', usedTxt + ' Boulders on the target, or a slow approach, could use all of it.');
      else check('fuel', 'go', 'Propellant to spare', usedTxt);
    }
    if (!jobs.length) check('science', 'watch', 'Nothing to do outside', 'With no science kit the landing itself is the whole mission.');
    else if (need > o2) check('time', 'watch', 'Not enough oxygen for every job', 'The jobs need about ' + Math.round(need) + ' seconds outside. The suit lasts ' + o2 + '.');
    else check('time', 'go', 'Time for every job', 'About ' + Math.round(need) + ' seconds of work, ' + o2 + ' seconds of oxygen.');
    if (site) {
      var rough = RG.MOON_SITES[p.site].rough;
      if (site.relief >= 400) check('site', 'watch', 'Mountains on the way in', 'The approach to ' + site.name + ' crosses high ground. Stay high until the target is close.');
      else if (rough > 12) check('site', 'watch', 'Bumpy ground', 'Hills and craters around the target. Look for a flat spot.');
      else check('site', 'go', 'Smooth ground', 'A flat plain with room to land.');
    }
    return { kitKg: kitKg, spare: SPARE, over: over, fuel: fuel, mass: mass, hover: hover, o2: o2, need: need, science: science,
      margin: clean.margin, used: clean.used, flightSecs: clean.time,
      scienceRaw: pts, jobs: jobs, checks: checks, ok: !over && !!site && clean.margin >= MARGIN_MIN };
  }

  /* ---------- the descent ---------- */
  /** Surprises, fixed by the mission number so a flight can be repeated. */
  function events(seed) {
    var r = rng(seed * 131 + 7), a = r(), b = r();
    return { alarm: a < 0.6 ? 300 + r() * 160 : 0, boulders: b < 0.45 };
  }

  function Descent(o) {
    var T = this.T = o.terrain, top = 0;
    for (var x = -APPROACH; x <= 0; x += 20) top = Math.max(top, T.profile(x));
    this.dry = o.dry; this.fuel0 = o.fuel; this.mode = MODES[o.mode] ? o.mode : 'auto';
    // It starts on the sink rate the guidance itself wants (19 m/s), so the engine is lit and steering from the
    // first second. It used to start slower, and the computer shut the engine down for four seconds to catch up:
    // four seconds in which "lean back" did nothing at all.
    this.s = { x: -APPROACH, y: Math.max(START_ALT, top + 230), vx: 45, vy: -19, pitch: 0.62, thr: 0.3, fuel: o.fuel, t: 0 };
    this.targetX = 0; this.status = 'fly'; this.result = null;
    this.ev = events(o.seed || 1); this.alarmLeft = 0; this.moved = false; this.acc = 0;
    this.calls = {}; // fuel call-outs already made
  }
  Descent.prototype.mass = function () { return this.dry + this.s.fuel; };
  Descent.prototype.alt = function () { return this.s.y - this.T.profile(this.s.x); };
  Descent.prototype.dist = function () { return this.targetX - this.s.x; };
  /** Seconds of hovering left in the tanks. */
  Descent.prototype.hoverLeft = function () { return this.s.fuel / hoverRate(this.mass()); };
  /** The highest ground under the next few seconds of flight. */
  Descent.prototype.groundAhead = function () {
    var s = this.s, g = this.T.profile(s.x);
    for (var k = 1; k <= 4; k++) g = Math.max(g, this.T.profile(s.x + s.vx * k * 1.6));
    return g;
  };
  /**
   * What the guidance computer would do now: the ground speed and sink rate it
   * wants, and the tilt and throttle that get there. Used by the autopilot in
   * the tests, by the automatic throttle, and for the hints on screen.
   */
  Descent.prototype.guide = function () {
    var s = this.s, dist = this.dist(), ad = Math.abs(dist), sgn = dist > 0 ? 1 : -1;
    // Ground speed. Far out: brake steadily (0.83 m/s²). Inside CLOSE metres of the ring: stop chasing the exact
    // spot and just creep toward it while the sideways speed dies away. The ring is 20 m across; the middle of
    // it is not worth a fight. (It used to aim for the last metre at full strength, asking for 40° swings a few
    // metres up. A real pilot, a moment late on each one, rocked over the ring until the tanks were dry.)
    // (The plan outside the ring is the speed a steady BRAKE m/s² of braking leaves you with at each distance,
    // arriving at the ring at the creeping speed: v² = v_ring² + 2 · BRAKE · distance.)
    var vxT = ad < CLOSE ? dist * CREEP : sgn * Math.min(dist > 0 ? 60 : 6, Math.sqrt(CLOSE * CREEP * CLOSE * CREEP + 2 * BRAKE * (ad - CLOSE)));
    var alt = s.y - this.groundAhead();
    // a 16° glide path, like Apollo's final approach; and no touching down while still drifting sideways
    var floor = Math.max(clamp((ad - 12) * 0.28, 0, 260), clamp((Math.abs(s.vx) - 0.8) * 4, 0, 30));
    var vyT = alt > floor ? -clamp(0.9 * Math.sqrt(2 * 0.9 * (alt - floor)), ad < 14 ? 0.9 : 0.2, 30) : clamp((floor - alt) * 0.25, 0, 5);
    // Sideways: the steady braking the speed plan itself asks for (fading out near the ring), plus a correction
    // for any error. The correction is strong far out, where there is room to swing, and gentle by the ring:
    // inside CLOSE metres it asks for no more than about 15° of lean, and less still in the last few metres down.
    var far = clamp((ad - CLOSE) / 45, 0, 1), corr = (0.45 + 1.9 * far) * (ad < CLOSE ? clamp(alt / 8, 0.3, 1) : 1);
    var ff = dist > 0 && s.vx > 0 && ad > CLOSE ? -BRAKE * Math.min(1, s.vx / 3) : 0;
    var ax = clamp(ff + clamp((vxT - s.vx) * (0.24 + 0.16 * far), -corr, corr), -2.4, 2.4), ay = Math.max(0, (vyT - s.vy) * 1.1 + G);
    return { vx: vxT, vy: vyT, pitch: clamp(Math.atan2(-ax, Math.max(ay, 0.5)), -0.9, 0.9), ax: ax, ay: ay,
      thr: clamp(this.mass() * Math.hypot(ax, ay) / THRUST, 0, 1) };
  };
  /**
   * What to tell the pilot right now. tilt: 1 lean back, -1 lean forward, 0 hold. engine (manual throttle only):
   * 1 more, -1 less, 0 hold. A pilot who simply does what this says lands safely; the tests check that.
   */
  Descent.prototype.advice = function () {
    var s = this.s, g = this.guide(), e = g.pitch - s.pitch, was = this.told || 0, tilt = 0, engine = 0, want = s.thr;
    if (this.mode === 'full') return { tilt: 0, engine: 0, pitch: g.pitch, thr: g.thr };
    // start asking at 4 degrees of error, stop at 1.5, so the arrow does not flicker
    if (e > (was === 1 ? 0.026 : 0.07)) tilt = 1; else if (e < (was === -1 ? -0.026 : -0.07)) tilt = -1;
    this.told = tilt;
    if (this.mode === 'manual') {
      want = this.wantThr(g);
      var d = want - (this.hand == null ? s.thr : this.hand), wasE = this.toldE || 0;
      if (d > (wasE === 1 ? 0.02 : 0.06)) engine = 1; else if (d < (wasE === -1 ? -0.02 : -0.06)) engine = -1;
      this.toldE = engine;
    }
    return { tilt: tilt, engine: engine, pitch: g.pitch, thr: want };
  };
  /**
   * The throttle the guidance wants at the lean the lander has now: enough to hold the sink rate, and never
   * less than the whole push the plan calls for (braking included). The second part matters over high ground,
   * where the plan is to fall fast: holding the sink rate alone needs almost no engine there, and with almost
   * no engine a leaning lander cannot brake. It then reached the ring far too fast and flew a long way past.
   */
  Descent.prototype.wantThr = function (g) {
    g = g || this.guide();
    var m = this.mass();
    return clamp(Math.max(m * g.ay / Math.max(0.35, Math.cos(this.s.pitch)), m * Math.hypot(g.ax, g.ay)) / THRUST, 0, 1);
  };
  /**
   * Move a hand-held throttle. thr: where it is (0..1). dir: 1 more, -1 less. Returns where it is after dt
   * seconds. Like the steering, it slows as it nears the setting the guidance wants, so a late hand settles.
   */
  Descent.prototype.throttleStep = function (thr, dir, dt) {
    if (!dir) return thr;
    var d = this.wantThr() - thr, k = dir * d > 0 ? clamp(Math.abs(d) / THR_BAND, THR_ASSIST_MIN, 1) : ASSIST_AWAY;
    return (this.hand = clamp(thr + dir * THR_RATE * k * dt, 0, 1));
  };
  /** Everything the instruments show, in one place: used by the screen, the co-op level and the tests. */
  Descent.prototype.telemetry = function () {
    var s = this.s, g = this.guide(), m = this.mass(), thrust = s.fuel > 0 ? THRUST * s.thr : 0;
    return { alt: Math.max(0, this.alt()), vs: -s.vy, hs: Math.abs(s.vx), speed: Math.hypot(s.vx, s.vy), range: Math.abs(this.dist()),
      pitchDeg: s.pitch / D2R, wantPitchDeg: g.pitch / D2R, wantVs: Math.max(0, -g.vy), wantHs: Math.abs(g.vx),
      thr: s.thr, fuel: s.fuel, fuelFrac: s.fuel / this.fuel0, hover: this.hoverLeft(), mass: m,
      twr: thrust / (m * G), accel: thrust / m, t: s.t };
  };
  /** ctl: { tilt: -1..1 (1 leans back, which brakes), thr: 0..1 (manual throttle), auto: true lets the computer fly it all } */
  Descent.prototype.step = function (dt, ctl) {
    if (this.status !== 'fly') return;
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= 1 / 60 && this.status === 'fly') { this.acc -= 1 / 60; this.tick(1 / 60, ctl || {}); }
  };
  Descent.prototype.tick = function (h, ctl) {
    var s = this.s, g = this.guide(), T = this.T;
    var full = ctl.auto || this.mode === 'full';
    if (full) s.pitch += clamp(g.pitch - s.pitch, -PITCH_RATE * h, PITCH_RATE * h);
    else if (ctl.tilt) {
      var e = g.pitch - s.pitch, k = ctl.tilt * e > 0 ? clamp(Math.abs(e) / ASSIST_BAND, ASSIST_MIN, 1) : ASSIST_AWAY; // see ASSIST_BAND
      s.pitch = clamp(s.pitch + ctl.tilt * PITCH_RATE * k * h, -PITCH_MAX, PITCH_MAX);
    }
    var want;
    if (full) want = g.thr;
    else if (this.mode === 'auto') want = Math.max(THR_MIN, this.wantThr(g)); // the computer holds the sink rate
    else want = clamp(ctl.thr || 0, 0, 1);
    s.thr += clamp(want - s.thr, -1.6 * h, 1.6 * h); // the engine takes a moment to follow
    var thrust = s.fuel > 0 ? THRUST * s.thr : 0, m = this.mass();
    s.vx += (-Math.sin(s.pitch) * thrust / m) * h;
    s.vy += (Math.cos(s.pitch) * thrust / m - G) * h;
    s.x += s.vx * h; s.y += s.vy * h; s.t += h;
    s.fuel = Math.max(0, s.fuel - thrust / (ISP * G0) * h);
    if (s.fuel <= 0) s.thr = 0;
    // surprises
    var alt = s.y - T.profile(s.x);
    if (this.ev.alarm && alt < this.ev.alarm) { this.ev.alarm = 0; this.alarmLeft = 3.2; this.event = 'alarm'; }
    if (this.alarmLeft > 0) this.alarmLeft -= h;
    if (this.ev.boulders && !this.moved && alt < 240 && Math.abs(this.dist()) < 330) { this.moved = true; this.targetX = 110; this.event = 'boulders'; }
    if (s.x < T.minX + 20 || s.x > T.maxX - 20 || s.y > 3000) { this.finish('lost'); return; }
    if (alt <= 0) { s.y = T.profile(s.x); this.finish('ground'); }
  };
  Descent.prototype.finish = function (how) {
    var s = this.s, T = this.T, vs = -s.vy, hs = Math.abs(s.vx), tilt = Math.abs(s.pitch) / D2R, slope = T.slope(s.x, 0);
    var r = { vs: vs, hs: hs, tilt: tilt, slope: slope, miss: Math.abs(s.x - this.targetX), fuel: s.fuel, fuelFrac: s.fuel / this.fuel0, time: s.t, x: s.x };
    if (how === 'lost') { r.grade = 'crash'; r.cause = 'lost'; }
    else if (this.ev.boulders && Math.abs(s.x) < 26) { r.grade = 'crash'; r.cause = 'boulder'; }
    else if (vs > 4.6) { r.grade = 'crash'; r.cause = s.fuel <= 0 ? 'fuel' : 'fast'; }
    else if (hs > 3) { r.grade = 'crash'; r.cause = 'sideways'; }
    else if (tilt > 30) { r.grade = 'crash'; r.cause = 'tilt'; }
    else if (slope > 20) { r.grade = 'crash'; r.cause = 'slope'; }
    else if (vs <= 1.8 && hs <= 0.9 && tilt <= 8 && slope <= 10) r.grade = 'soft';
    else if (vs <= 3 && hs <= 1.3 && tilt <= 12 && slope <= 12) r.grade = 'firm';
    else r.grade = 'hard';
    this.status = r.grade === 'crash' ? 'crash' : 'landed';
    this.result = r;
  };

  /* ---------- the surface ---------- */
  /** Where each job is, measured from the lander. Fixed by the mission number. */
  function tasks(kit, seed, T) {
    var r = rng(seed * 53 + 3), out = [], a0 = r() * 6.28, n = 0;
    function spot(dist, ang) {
      for (var tries = 0; tries < 12; tries++) { // keep jobs off steep crater walls
        var x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
        if (!T || T.slope(x, z) < 9) break;
        ang += 0.5;
      }
      return { x: Math.cos(ang) * dist, z: Math.sin(ang) * dist };
    }
    kit.forEach(function (k) {
      var it = KIT[k];
      if (!it.pts) return;
      if (k === 'rocks') {
        for (var j = 0; j < 3; j++) { var p = spot(20 + j * 16 + r() * 6, a0 + 2.2 + j * 1.5 + r()); out.push({ id: 'rock' + j, kit: 'rocks', x: p.x, z: p.z, secs: it.secs, name: 'Rock sample' }); }
      } else {
        var q = spot(it.r, a0 + n * 1.35 + r() * 0.4); n++;
        out.push({ id: k, kit: k, x: q.x, z: q.z, secs: it.secs, name: it.verb });
      }
    });
    return out;
  }

  /* ---------- the score ---------- */
  /** landing: a Descent result. surface: { done: { kitId: fraction 0..1 }, back: true/false, o2Frac: share of oxygen left }. */
  function score(p, landing, surface) {
    var site = SITES[p.site], pl = plan(p), parts = { landing: 0, science: 0, safe: 0 }, lines = [];
    if (landing.grade === 'crash') return { total: 0, stars: 0, parts: parts, lines: lines };
    var touch = landing.grade === 'soft' ? 22 : landing.grade === 'firm' ? 15 : 7;
    var aim = 10 * (1 - Math.min(1, landing.miss / 60)), spare = 8 * Math.min(1, landing.fuelFrac / 0.12);
    parts.landing = Math.round((touch + aim + spare) * (landing.byComputer ? 0.6 : 1));
    var pts = 0;
    Object.keys((surface && surface.done) || {}).forEach(function (k) { pts += KIT[k].pts * surface.done[k]; });
    parts.science = Math.round(Math.min(45, pts * site.science));
    parts.safe = surface && surface.back ? Math.round(9 + 6 * Math.min(1, surface.o2Frac / 0.2)) : 0;
    var total = parts.landing + parts.science + parts.safe;
    lines.push(landing.grade === 'soft' ? 'A soft touchdown at ' + landing.vs.toFixed(1) + ' m/s. The legs barely noticed.'
      : landing.grade === 'firm' ? 'A firm touchdown at ' + landing.vs.toFixed(1) + ' m/s, inside the limit of 3.'
      : 'A hard touchdown at ' + landing.vs.toFixed(1) + ' m/s down and ' + landing.hs.toFixed(1) + ' sideways. The legs bent. Slow down sooner next time.');
    lines.push(landing.miss < 12 ? 'You landed ' + Math.round(landing.miss) + ' m from the target. Pinpoint.' : 'You landed ' + Math.round(landing.miss) + ' m from the target. Closer landings mean shorter walks.');
    lines.push(landing.fuelFrac < 0.05 ? 'Only ' + Math.round(landing.fuel) + ' kg of fuel was left. That is how close Apollo 11 came.'
      : landing.fuelFrac > 0.3 ? Math.round(landing.fuel) + ' kg of fuel was left over. That spare mass could have been science kit.'
      : Math.round(landing.fuel) + ' kg of fuel was left: a sensible margin.');
    if (landing.byComputer) lines.push('The guidance computer flew this landing by itself, so it earned six tenths of the landing points. Take the controls next time for all of them.');
    if (!pl.jobs.length) lines.push('No science kit was carried, so there were no science points to win.');
    else if (parts.science >= 40) lines.push('The science team is thrilled with everything you set up at ' + site.name + '.');
    else if (pts < pl.scienceRaw * 0.99) lines.push('Some jobs were left unfinished. A lighter plan, or the extra oxygen pack, would fit the time.');
    else if (site.science < 1) lines.push('Every job was done. A harder site, such as the highlands, would be worth more science.');
    else lines.push('Every job was done. More kit would score more, if the fuel margin allows it.');
    if (surface && !surface.back) lines.push('You were still outside when the oxygen ran low. Mission control never allows that.');
    return { total: total, stars: total >= 80 ? 3 : total >= 60 ? 2 : 1, parts: parts, lines: lines };
  }

  /** A plan as a short code to share, for example MN-4-07-A: site 4, kit pieces 1 to 3, automatic throttle. */
  function encode(p) {
    var bits = 0;
    KIT_ORDER.forEach(function (k, i) { if (p.kit.indexOf(k) >= 0) bits |= 1 << i; });
    return 'MN-' + (SITE_ORDER.indexOf(p.site) + 1) + '-' + (bits < 10 ? '0' : '') + bits + '-' + (MODES[p.mode] || 'A');
  }
  /** Read a plan code back; null if it is not one. */
  function decode(code) {
    var m = /^MN-([1-6])-(\d\d)-([AMF])$/.exec(String(code || '').trim().toUpperCase());
    if (!m || +m[2] > 63) return null;
    var bits = +m[2];
    return { site: SITE_ORDER[+m[1] - 1], kit: KIT_ORDER.filter(function (k, i) { return bits & (1 << i); }), mode: m[3] === 'M' ? 'manual' : m[3] === 'F' ? 'full' : 'auto' };
  }

  RG.Lunar = {
    G: G, THRUST: THRUST, ISP: ISP, DRY: DRY, SPARE: SPARE, FUEL_BASE: FUEL_BASE, SIZE: SIZE, APPROACH: APPROACH, THR_MIN: THR_MIN, MODES: MODES,
    SITES: SITES, SITE_ORDER: SITE_ORDER, KIT: KIT, KIT_ORDER: KIT_ORDER, WALK: WALK,
    encode: encode, decode: decode, terrain: terrain, plan: plan, cleanLanding: cleanLanding, MARGIN_MIN: MARGIN_MIN, MARGIN_THIN: MARGIN_THIN, Descent: Descent, events: events, tasks: tasks, score: score, hoverRate: hoverRate, rng: rng
  };
})(typeof window !== 'undefined' ? window : globalThis);
