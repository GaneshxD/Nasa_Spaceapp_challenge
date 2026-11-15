/* Orbit Ranger — rocket flight.
 * The physics behind levels 2, 3 and 4: building a rocket that can lift off,
 * flying it up through the air, and speeding up sideways until it stays in orbit.
 *
 * The rocket is a small cousin of NASA's Space Launch System (SLS):
 *   a core stage burning liquid hydrogen with liquid oxygen (RS-25 engines),
 *   optional solid boosters on the sides, and a small upper stage (RL10 engine).
 * Engine numbers are NASA's; tank and booster sizes are scaled down for play.
 *
 * Motion is worked out around a round Earth: gravity, thrust, air drag and the
 * free sideways speed from Earth's spin at Kennedy Space Center.
 * Runs in the browser and in Node (tests and tuning).
 */
(function (root) {
  'use strict';
  var RG = (root.RG = root.RG || {});
  var G0 = 9.80665, MU = 3.986004418e14, RE = 6371000;
  var D2R = Math.PI / 180;
  var F = { G0: G0, MU: MU, RE: RE };

  F.SITE = { name: 'Kennedy Space Center', lat: 28.57, lon: -80.65, spin: 408 }; // spin: eastward speed of the pad, m/s
  F.TARGET_APO = 200;     // km: the height the climb aims for
  F.ORBIT_MIN = 160;      // km: lowest point must stay above this to count as an orbit
  F.KARMAN = 100;         // km: where space begins
  F.FAIRING_MIN = 100;    // km: the nose cone may be dropped above this
  F.BUDGET = 120;         // coins for level 2

  // RS-25: NASA's hydrogen engine, first flown on the Space Shuttle.
  var RS25 = { vac: 2279e3, sl: 1860e3, isp: 452, mass: 3.5 };
  // RL10: the small hydrogen engine of the upper stage.
  var UPPER = { name: 'Upper stage', thrust: 110e3, isp: 462, prop: 1.2, dry: 1.8, payload: 1.0, fairing: 2.5, cost: 15 };
  F.RS25 = RS25; F.UPPER = UPPER;
  F.MIX = 6; // kilograms of oxygen burned for each kilogram of hydrogen

  /* Masses in tonnes, lengths in metres, cost in coins. */
  F.TANKS = {
    S: { name: 'Small tanks', prop: 150, dry: 20, len: 22, cost: 30, blurb: 'Light and cheap, but they hold little fuel.' },
    M: { name: 'Medium tanks', prop: 400, dry: 40, len: 38, cost: 45, blurb: 'A good load of fuel without too much weight.' },
    L: { name: 'Large tanks', prop: 700, dry: 65, len: 56, cost: 60, blurb: 'A huge load of fuel. Very heavy when full.' }
  };
  F.ENGINES = {
    E2: { name: 'Two engines', n: 2, cost: 20, blurb: 'Gentle push. Fine for a light rocket.' },
    E3: { name: 'Three engines', n: 3, cost: 30, blurb: 'A strong push for a medium rocket.' },
    E4: { name: 'Four engines', n: 4, cost: 40, blurb: 'The biggest push. NASA’s SLS has four.' }
  };
  F.BOOSTERS = {
    none: { name: 'No boosters', thrust: 0, prop: 0, dry: 0, burn: 0, cost: 0, blurb: 'Save money. The engines must lift everything alone.' },
    two: { name: 'Two boosters', thrust: 6000e3, prop: 240, dry: 36, burn: 105, cost: 35, blurb: 'A giant extra push for the first two minutes. Then they drop away.' }
  };

  /** Everything about a build that does not need a flight: masses, thrust, cost. */
  F.evaluate = function (b) {
    var t = F.TANKS[b.tank], e = F.ENGINES[b.engines], bo = F.BOOSTERS[b.boosters || 'none'];
    if (!t || !e) return null;
    var top = UPPER.prop + UPPER.dry + UPPER.payload + UPPER.fairing;
    var core = t.prop + t.dry + e.n * RS25.mass;
    var m0 = core + top + bo.prop + bo.dry;
    var thrust = e.n * RS25.sl + bo.thrust;
    return {
      tank: t, eng: e, boost: bo, n: e.n,
      mass0: m0, top: top,
      thrust0: thrust, tw: thrust / (m0 * 1000 * G0),
      lox: t.prop * F.MIX / (F.MIX + 1), lh2: t.prop / (F.MIX + 1),
      coreFlow: e.n * RS25.vac / (RS25.isp * G0),          // kg/s at full throttle
      cost: t.cost + e.cost + bo.cost + UPPER.cost,
      upperDv: UPPER.isp * G0 * Math.log((UPPER.prop + UPPER.dry + UPPER.payload) / (UPPER.dry + UPPER.payload))
    };
  };

  /* ---------- orbit maths for a state {r, vr, vt} ---------- */
  F.elements = function (s) {
    var h = s.r * s.vt, eps = (s.vr * s.vr + s.vt * s.vt) / 2 - MU / s.r;
    var e = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (MU * MU)));
    var p = (h * h) / MU;
    var ra = e < 1 ? p / (1 - e) : Infinity, rp = p / (1 + e);
    var nu = e > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, (p / s.r - 1) / e))) : 0;
    if (s.vr < 0) nu = -nu;
    return {
      e: e, p: p, h: h, nu: nu,
      apoKm: (ra - RE) / 1000, periKm: (rp - RE) / 1000,
      // extra speed needed at the top of the arc to make the orbit a circle
      circNeed: isFinite(ra) ? Math.sqrt(MU / ra) - h / ra : 0,
      periodMin: eps < 0 ? (2 * Math.PI * Math.sqrt(Math.pow(-MU / (2 * eps), 3) / MU)) / 60 : Infinity
    };
  };
  function air(h) { return 1.225 * Math.exp(-h / 8500); }   // kg/m^3
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /** The tilt the flight computer asks for (radians from straight up) at this moment. */
  F.guidance = function (s) {
    var hk = (s.r - RE) / 1000;
    if (hk < 0.3) return 0;
    var open = (Math.PI / 2) * 0.82 * Math.pow(clamp((hk - 0.3) / 55, 0, 1), 0.55);
    if (hk < 45) return open;
    var apo = F.elements(s).apoKm;
    var closed = clamp(Math.PI / 2 - (F.TARGET_APO - apo) * 0.012, 0.85, 1.72);
    var k = clamp((hk - 45) / 15, 0, 1);
    return open + (closed - open) * k;
  };

  /* ---------- level 3: the climb ---------- */
  function Ascent(build, seed) {
    var ev = F.evaluate(build);
    this.ev = ev; this.build = build;
    this.t = 0; this.play = 0;
    this.s = { r: RE, vr: 0, vt: F.SITE.spin, u: 0 };
    this.coreProp = ev.tank.prop * 1000;
    this.boostProp = ev.boost.prop * 1000;
    this.boostersOn = ev.boost.thrust > 0;
    this.boostersEmpty = false; this.dropLate = false; this.dropWait = 0;
    this.err = 0; this.badTime = 0; this.goodTime = 0; this.steerTime = 0;
    this.phase = (seed || 1) * 1.7;
    this.pitch = 0; this.target = 0; this.g = 0; this.q = 0; this.maxQ = 0; this.maxQDone = false;
    this.throttle = 1;
    this.status = 'pad'; // pad → flying → meco | fail
    this.failWhy = '';
    this.events = [];
    this.reachedSpace = false;
  }
  Ascent.prototype.mass = function () {
    var ev = this.ev;
    return (ev.tank.dry + ev.n * RS25.mass + ev.top - (this.fairingGone ? UPPER.fairing : 0)) * 1000 + this.coreProp +
      (this.boostersOn ? ev.boost.dry * 1000 + this.boostProp : 0);
  };
  /**
   * Drop the payload fairing (the nose cone): 2.5 t less to carry. Below the Kármán line the air would wreck
   * the satellite, so it is refused there. Levels 3 and 4 never call this; the two-player launch does.
   */
  Ascent.prototype.dropFairing = function () {
    if (this.fairingGone || this.status !== 'flying' || this.altKm() < F.FAIRING_MIN) return false;
    this.fairingGone = true; this.fairingAt = this.altKm(); this.events.push('fairing-dropped');
    return true;
  };
  /** The push of the air on the rocket, in kilopascals. */
  Ascent.prototype.qKpa = function () { return this.q / 1000; };
  /** Velocity over the ground, split in two: straight up, and along the ground. m/s. */
  Ascent.prototype.vertical = function () { return this.s.vr; };
  Ascent.prototype.horizontal = function () { return this.s.vt - F.SITE.spin * (this.s.r / RE); };
  Ascent.prototype.altKm = function () { return (this.s.r - RE) / 1000; };
  /** Speed over the ground, m/s (what a tracking camera would measure). */
  Ascent.prototype.speed = function () {
    var vt = this.s.vt - F.SITE.spin * (this.s.r / RE);
    return Math.sqrt(this.s.vr * this.s.vr + vt * vt);
  };
  Ascent.prototype.launch = function () { if (this.status === 'pad') { this.status = 'flying'; this.events.push('liftoff'); } };
  Ascent.prototype.dropBoosters = function () {
    if (this.boostersOn && this.boostersEmpty) { this.boostersOn = false; this.events.push('boosters-dropped'); }
  };

  /**
   * Advance the flight. dtPlay is real seconds since the last frame, warp is
   * how many flight seconds pass per real second, steer is −1 … 1 from the player.
   * Pass auto = true to let the computer steer perfectly (used for predictions).
   */
  Ascent.prototype.step = function (dtPlay, warp, steer, auto) {
    if (this.status !== 'flying') return;
    var ev = this.ev, s = this.s, n = Math.max(1, Math.ceil((dtPlay * warp) / 0.25)), dt = (dtPlay * warp) / n;
    this.play += dtPlay;

    // steering: wind pushes the nose off course, the player pushes it back
    if (!auto) {
      var gust = 1.5 + 7 * Math.min(1, this.q / 30000);
      var wind = gust * (Math.sin(0.9 * this.play + this.phase) + 0.6 * Math.sin(2.3 * this.play + this.phase * 2));
      this.err += (wind + (steer || 0) * 16 - this.err * 0.35) * dtPlay;
      this.steerTime += dtPlay;
      if (Math.abs(this.err) <= 6) this.goodTime += dtPlay;
      if (Math.abs(this.err) > 28) this.badTime += dtPlay; else this.badTime = 0;
      if (this.badTime > 1.6) { this.status = 'fail'; this.failWhy = 'tipped'; this.events.push('fail'); return; }
    }
    if (this.boostersOn && this.boostersEmpty) {
      this.dropWait += dtPlay;
      if (this.dropWait > 4) { this.dropLate = true; this.dropBoosters(); } // the computer lets go for you, late
    }

    for (var i = 0; i < n; i++) {
      var h = s.r - RE, m = this.mass();
      var pr = Math.exp(-h / 7400);
      var thrust = 0, flow = 0;
      if (this.coreProp > 0) {
        var full = ev.n * (RS25.sl + (RS25.vac - RS25.sl) * (1 - pr));
        // ease the engines back so the crew of instruments never feels more than 3.5 g
        this.throttle = Math.min(1, (3.5 * G0 * m) / full);
        thrust += full * this.throttle; flow = ev.coreFlow * this.throttle;
      }
      if (this.boostersOn && this.boostProp > 0) {
        thrust += ev.boost.thrust;
        this.boostProp -= ((ev.boost.prop * 1000) / ev.boost.burn) * dt;
        if (this.boostProp <= 0) { this.boostProp = 0; this.boostersEmpty = true; this.events.push('boosters-empty'); }
      }
      this.target = F.guidance(s);
      this.pitch = this.target + this.err * D2R;
      var a = thrust / m;
      var vtAir = s.vt - F.SITE.spin * (s.r / RE), v = Math.sqrt(s.vr * s.vr + vtAir * vtAir);
      var q = 0.5 * air(h) * v * v, drag = (q * 0.4 * (56 + (this.boostersOn ? 22 : 0))) / m;
      this.q = q;
      if (q > this.maxQ) this.maxQ = q;
      else if (!this.maxQDone && h > 5000 && q < this.maxQ * 0.97) { this.maxQDone = true; this.events.push('maxq'); }
      var dvr = (s.vt * s.vt) / s.r - MU / (s.r * s.r) + a * Math.cos(this.pitch) - (v > 1 ? (drag * s.vr) / v : 0);
      var dvt = -(s.vr * s.vt) / s.r + a * Math.sin(this.pitch) - (v > 1 ? (drag * vtAir) / v : 0);
      s.vr += dvr * dt; s.vt += dvt * dt;
      s.r += s.vr * dt; s.u += (s.vt / s.r) * dt;
      this.coreProp = Math.max(0, this.coreProp - flow * dt);
      this.g = a / G0;
      this.t += dt;
      if (s.r < RE) { s.r = RE; if (this.t > 5) { this.status = 'fail'; this.failWhy = 'fell'; this.events.push('fail'); return; } s.vr = Math.max(0, s.vr); }
      if (!this.reachedSpace && h > F.KARMAN * 1000) { this.reachedSpace = true; this.events.push('space'); }
      // main engine cut-off: out of fuel, or already fast enough for the upper stage to finish the job
      var el = F.elements(s);
      if (this.coreProp <= 0 || (h > 100000 && el.apoKm >= F.TARGET_APO - 15 && el.circNeed <= 600)) {
        this.status = 'meco'; this.events.push('meco'); return;
      }
      if (h < 60000 && s.vr < -50 && this.t > 30) { this.status = 'fail'; this.failWhy = 'fell'; this.events.push('fail'); return; }
    }
  };

  /** How the climb ended, and whether the upper stage can finish the trip. */
  Ascent.prototype.result = function () {
    var el = F.elements(this.s), ev = this.ev;
    var ok = this.status === 'meco' && el.apoKm >= F.ORBIT_MIN && el.circNeed <= ev.upperDv * 0.9;
    return {
      ok: ok, status: this.status, failWhy: this.failWhy,
      apoKm: el.apoKm, altKm: this.altKm(), speed: Math.sqrt(this.s.vr * this.s.vr + this.s.vt * this.s.vt),
      circNeed: el.circNeed, upperDv: ev.upperDv,
      fuelLeft: this.coreProp / (ev.tank.prop * 1000),
      accuracy: this.steerTime ? this.goodTime / this.steerTime : 1,
      dropLate: this.dropLate, time: this.t,
      state: { r: this.s.r, vr: this.s.vr, vt: this.s.vt, u: this.s.u }
    };
  };

  /** Fly a build on the computer with perfect steering. Used by level 2 to test a design. */
  F.testFlight = function (build) {
    var a = new Ascent(build);
    a.launch();
    for (var i = 0; i < 6000 && a.status === 'flying'; i++) {
      a.step(0.5, 1, 0, true);
      if (a.boostersEmpty) a.dropBoosters();
    }
    return a.result();
  };

  /* ---------- level 4: reaching orbit ---------- */
  function Insertion(state) {
    this.s = { r: state.r, vr: state.vr, vt: state.vt, u: state.u };
    this.prop = UPPER.prop * 1000;
    this.t = 0; this.burnTime = 0;
    this.status = 'coast'; // coast → orbit | fail
    this.failWhy = '';
    this.inOrbit = false;
    this.g = 0;
  }
  Insertion.prototype.mass = function () { return (UPPER.dry + UPPER.payload) * 1000 + this.prop; };
  Insertion.prototype.altKm = function () { return (this.s.r - RE) / 1000; };
  Insertion.prototype.speed = function () { return Math.sqrt(this.s.vr * this.s.vr + this.s.vt * this.s.vt); };
  Insertion.prototype.step = function (dtSim, burning) {
    if (this.status === 'fail') return;
    var s = this.s, n = Math.max(1, Math.ceil(dtSim / 0.5)), dt = dtSim / n;
    for (var i = 0; i < n; i++) {
      var a = 0;
      if (burning && this.prop > 0) {
        a = UPPER.thrust / this.mass();
        this.prop = Math.max(0, this.prop - (UPPER.thrust / (UPPER.isp * G0)) * dt);
        this.burnTime += dt;
      }
      // the upper stage points along the horizon, the way it is already moving
      var dvr = (s.vt * s.vt) / s.r - MU / (s.r * s.r);
      var dvt = -(s.vr * s.vt) / s.r + a;
      s.vr += dvr * dt; s.vt += dvt * dt;
      s.r += s.vr * dt; s.u += (s.vt / s.r) * dt;
      this.t += dt; this.g = a / G0;
      if (s.r - RE < 70000 && s.vr < 0) { this.status = 'fail'; this.failWhy = 'fell'; return; }
    }
    var el = F.elements(s);
    this.inOrbit = el.periKm >= F.ORBIT_MIN && el.e < 1;
    if (this.inOrbit) this.status = 'orbit';
    else if (this.status === 'orbit') this.status = 'coast';
  };
  Insertion.prototype.result = function () {
    var el = F.elements(this.s);
    return {
      ok: this.inOrbit, apoKm: el.apoKm, periKm: el.periKm, periodMin: el.periodMin,
      speed: this.speed(), fuelLeft: this.prop / (UPPER.prop * 1000), round: el.apoKm - el.periKm
    };
  };

  F.Ascent = Ascent;
  F.Insertion = Insertion;
  RG.Flight = F;
})(typeof window !== 'undefined' ? window : globalThis);
