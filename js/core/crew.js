/* Orbit Ranger — the launch crew: the rules of the two-player mission.
 * One rocket, two jobs, as on a real flight deck:
 *   the pilot            holds the pitch the flight computer asks for
 *   the flight engineer  lets the empty boosters go, and drops the payload fairing once the rocket is in space
 * Each needs the other. Letting the boosters go kicks the nose off course, so the engineer has to warn the pilot.
 * The fairing may only go while the rocket is steady, and only the pilot can see that, so the pilot has to say so.
 * This file wraps the climb of js/core/flight.js and keeps score for both seats. No browser code: the tests fly it.
 *
 * Real: boosters are dropped when empty because dead weight costs speed; a fairing is dropped above about 100 km,
 * once the air is too thin to harm the satellite. A game model: the size of the kick, the rule that the fairing
 * waits for a steady rocket, and the timings that earn stars.
 */
(function (root) {
  'use strict';
  var RG = (root.RG = root.RG || {}), F = RG.Flight;
  var WARP = 8;                       // flight seconds for each second of play, as in level 3
  var KICK = 11;                      // degrees the nose is knocked off course when the boosters let go
  var STEADY = 6;                     // the fairing may go while the nose is within this many degrees of the wanted pitch
  var SEP_SHARP = 1.2, SEP_OK = 2.5;  // seconds the empty boosters were carried: sharp, acceptable (the computer lets go at 4)
  var FAIR_SHARP = 2.5, FAIR_OK = 6;  // seconds past the 100 km line before the fairing went
  var WINDOW_MIN = 8;                 // a rocket must give the engineer at least this long between space and engine cut-off
  var DEFAULT = { tank: 'M', engines: 'E3', boosters: 'two' };

  /** Fly a build on the computer and report how long the engineer would have, in seconds of play. */
  function rehearse(build) {
    var a = new F.Ascent(build, 1), space = null;
    a.launch();
    for (var i = 0; i < 9000 && a.status === 'flying'; i++) {
      a.step(0.1, WARP, 0, true);
      if (a.boostersEmpty) a.dropBoosters();
      if (space == null && a.reachedSpace) space = a.play;
    }
    return { ok: a.result().ok, window: space == null ? 0 : a.play - space };
  }
  /** The rocket the crew flies: the one built in level 2 with boosters added, if that gives both seats a fair job. */
  function crewBuild(saved) {
    if (saved && F.TANKS[saved.tank] && F.ENGINES[saved.engines]) {
      var b = { tank: saved.tank, engines: saved.engines, boosters: 'two' }, r = rehearse(b);
      if (r.ok && r.window >= WINDOW_MIN) return b;
    }
    return { tank: DEFAULT.tank, engines: DEFAULT.engines, boosters: DEFAULT.boosters };
  }

  function Launch(saved, seed) {
    this.build = crewBuild(saved);
    this.sim = new F.Ascent(this.build, seed || 1);
    this.kickSign = (seed || 1) % 2 ? 1 : -1;
    this.seen = 0; this.events = [];
    this.sepDelay = null; this.kickAt = null; this.spaceAt = null; this.fairDelay = null;
    this.tries = { burning: 0, low: 0, unsteady: 0 }; // times the engineer asked for something that was refused
  }
  Launch.prototype.liftoff = function () { this.sim.launch(); };
  /** Is the nose close enough to the wanted pitch for the fairing to go? Only the pilot's gauge shows it. */
  Launch.prototype.steady = function () { return Math.abs(this.sim.err) <= STEADY; };
  /** steer: -1 … 1 from the pilot. */
  Launch.prototype.step = function (dt, steer) {
    var s = this.sim;
    if (s.status !== 'flying') return;
    s.step(dt, WARP, steer);
    while (this.seen < s.events.length) {
      var e = s.events[this.seen++];
      if (e === 'boosters-dropped') {
        this.sepDelay = s.dropWait;       // how long the dead weight was carried
        s.err += KICK * this.kickSign;    // letting go kicks the nose: a pilot who was warned is ready for it
        this.kickAt = s.play;
      } else if (e === 'space') this.spaceAt = s.play;
      this.events.push(e);
    }
  };
  /** The engineer's first switch. Returns 'ok', or why not: 'pad', 'burning' (a solid booster cannot be let go alight), 'gone'. */
  Launch.prototype.dropBoosters = function () {
    var s = this.sim;
    if (s.status !== 'flying') return 'pad';
    if (!s.boostersOn) return 'gone';
    if (!s.boostersEmpty) { this.tries.burning++; return 'burning'; }
    s.dropBoosters();
    return 'ok';
  };
  /** The engineer's second switch. Returns 'ok', or why not: 'pad', 'low' (still in the air), 'unsteady', 'gone'. */
  Launch.prototype.dropFairing = function () {
    var s = this.sim;
    if (s.status !== 'flying') return 'pad';
    if (s.fairingGone) return 'gone';
    if (s.altKm() < F.FAIRING_MIN) { this.tries.low++; return 'low'; }
    if (!this.steady()) { this.tries.unsteady++; return 'unsteady'; }
    if (!s.dropFairing()) return 'low';
    this.fairDelay = this.spaceAt == null ? 0 : s.play - this.spaceAt; // the next step() passes the event on
    return 'ok';
  };
  /** How each seat did, and the stars the crew earned together. */
  Launch.prototype.score = function () {
    var s = this.sim, r = s.result(), acc = r.accuracy, pc = Math.round(acc * 100);
    var pilot = { accuracy: acc, stars: acc >= 0.85 ? 3 : acc >= 0.65 ? 2 : 1 };
    pilot.line = pilot.stars === 3 ? 'On course ' + pc + '% of the climb. Steady hands.'
      : pilot.stars === 2 ? 'On course ' + pc + '% of the climb. Smaller, earlier taps keep the needle in the green.'
      : 'On course only ' + pc + '% of the climb. Every degree off the green wastes thrust.';
    var sep = s.dropLate || this.sepDelay == null ? 'late' : this.sepDelay <= SEP_SHARP ? 'sharp' : this.sepDelay <= SEP_OK ? 'ok' : 'late';
    var fair = this.fairDelay == null ? 'never' : this.fairDelay <= FAIR_SHARP ? 'sharp' : this.fairDelay <= FAIR_OK ? 'ok' : 'late';
    var pts = { sharp: 2, ok: 1, late: 0, never: 0 }, got = pts[sep] + pts[fair];
    var engineer = { sep: sep, sepDelay: this.sepDelay, fairing: fair, fairDelay: this.fairDelay, fairingKm: s.fairingAt == null ? null : s.fairingAt, stars: got >= 4 ? 3 : got >= 2 ? 2 : 1 };
    engineer.sepLine = s.dropLate || this.sepDelay == null ? 'The computer had to let the boosters go, four seconds late.'
      : 'Boosters dropped ' + this.sepDelay.toFixed(1) + ' s after they ran dry' + (sep === 'sharp' ? ': sharp.' : sep === 'ok' ? ': a little dead weight carried.' : ': late, and dead weight costs speed.');
    engineer.fairLine = fair === 'never' ? 'The fairing was never dropped, so 2.5 tonnes of shell went all the way up.'
      : 'Fairing away at ' + Math.round(engineer.fairingKm) + ' km' + (fair === 'sharp' ? ', as soon as it was safe.' : fair === 'ok' ? ', a little after it was safe.' : ', long after it was safe.');
    engineer.line = engineer.sepLine + ' ' + engineer.fairLine;
    // one rating for the crew: three stars only when both seats earned three
    var stars = r.ok ? Math.max(1, Math.floor((pilot.stars + engineer.stars) / 2)) : 0;
    return { ok: r.ok, stars: stars, pilot: pilot, engineer: engineer, result: r, tries: this.tries };
  };

  /* ====================================================================
   * The whole trip to orbit, for a crew of up to four on their own devices.
   * Four seats. With fewer players the seats are shared out in joining order, as the consoles of level 5 are.
   *   pilot      holds the pitch during the climb
   *   engineer   lets the empty boosters go, then separates the empty core stage after main engine cut-off
   *   navigator  has the altitude and the orbit numbers, and burns the upper stage until the path is an orbit
   *   payload    drops the fairing once in space (and steady), then releases the satellite in orbit
   * Nobody can finish alone: the engineer warns the pilot before the boosters go; the payload officer needs the
   * altitude from the navigator and "steady" from the pilot; the navigator cannot burn until the engineer has let the
   * core stage go; the satellite is released only when the navigator says the orbit is closed and the engine is off.
   * This object is the rule book. The room server steps it and sends its state() to every player; the tests fly it.
   * ==================================================================== */
  var SEATS = ['pilot', 'engineer', 'navigator', 'payload'];
  var SEAT = {
    pilot: { name: 'Pilot', job: 'Holds the pitch the flight computer wants during the climb.' },
    engineer: { name: 'Flight engineer', job: 'Lets the empty boosters go, then separates the empty core stage.' },
    navigator: { name: 'Navigator', job: 'Calls out the altitude, then burns the upper stage until the path is an orbit.' },
    payload: { name: 'Payload officer', job: 'Drops the fairing once in space, then releases the satellite in orbit.' }
  };
  var CORE_SHARP = 1.5, CORE_OK = 3, CORE_AUTO = 5;       // seconds the empty core stage was carried; the computer lets go at 5
  var DEPLOY_SHARP = 2.5, DEPLOY_OK = 6, DEPLOY_AUTO = 12; // seconds in orbit before the satellite was released
  var STAGING_WARP = 12, COAST_WARP = 26, BURN_WARP = 4, ORBIT_WARP = 12; // flight seconds for each second of play, as in level 4

  function Mission(saved, seed) {
    this.launch = new Launch(saved, seed);
    this.build = this.launch.build;
    this.phase = 'pad';            // pad → climb → staging → coast → orbit → done, or fail
    this.why = '';                 // tipped, slow, fell, fuel
    this.ins = null;               // the upper stage's flight (F.Insertion), from main engine cut-off on
    this.play = 0;
    this.steer = 0; this.burn = false;   // what the pilot and the navigator are holding
    this.events = []; this.seenL = 0; this.wasBurning = false;
    this.coreWait = 0; this.coreDelay = null; this.coreLate = false;
    this.orbitAt = null; this.deployDelay = null; this.deployLate = false;
  }
  Mission.prototype.liftoff = function () { if (this.phase === 'pad') { this.launch.liftoff(); this.phase = 'climb'; } };
  Mission.prototype.burning = function () { return (this.phase === 'coast' || this.phase === 'orbit') && this.burn && this.ins.prop > 0; };
  /** One of the four switches. Returns 'ok', or why not. */
  Mission.prototype.act = function (name, byComputer) {
    if (name === 'boosters') return this.phase === 'climb' ? this.launch.dropBoosters() : this.phase === 'pad' ? 'pad' : 'gone';
    if (name === 'fairing') return this.phase === 'climb' ? this.launch.dropFairing() : this.phase === 'pad' ? 'pad' : this.launch.sim.fairingGone ? 'gone' : 'late';
    if (name === 'separate') {
      if (this.phase !== 'staging') return this.phase === 'pad' || this.phase === 'climb' ? 'burning' : 'gone';
      this.coreDelay = this.coreWait; this.coreLate = !!byComputer; this.phase = 'coast';
      this.events.push(byComputer ? 'core-late' : 'core-separated');
      return 'ok';
    }
    if (name === 'deploy') {
      if (this.phase !== 'orbit') return this.phase === 'done' ? 'gone' : 'early';
      if (this.burning()) return 'burning';
      this.deployDelay = this.play - this.orbitAt; this.deployLate = !!byComputer; this.phase = 'done';
      this.events.push(byComputer ? 'deploy-late' : 'deployed');
      return 'ok';
    }
    return 'unknown';
  };
  /** dt: seconds of play. */
  Mission.prototype.step = function (dt) {
    var L = this.launch, s = L.sim;
    if (this.phase === 'pad' || this.phase === 'done' || this.phase === 'fail') return;
    this.play += dt;
    if (this.phase === 'climb') {
      L.step(dt, this.steer);
      while (this.seenL < L.events.length) this.events.push(L.events[this.seenL++]);
      if (s.status === 'fail') { this.phase = 'fail'; this.why = s.failWhy; }
      else if (s.status === 'meco') {
        var r = s.result();
        if (!r.ok) { this.phase = 'fail'; this.why = 'slow'; this.events.push('fail'); }
        else { this.ins = new F.Insertion(r.state); this.phase = 'staging'; this.coreWait = 0; }
      }
      return;
    }
    var burning = this.burning();
    if (this.phase === 'staging') {
      // the engines are out and the empty core stage is still bolted on: nothing can burn until it is let go
      this.coreWait += dt;
      this.ins.step(dt * STAGING_WARP, false);
      if (this.coreWait >= CORE_AUTO) this.act('separate', true);
    } else {
      if (burning && !this.wasBurning) { this.wasBurning = true; this.events.push('burn-start'); } // told once, however often the button is pressed
      this.ins.step(dt * (burning ? BURN_WARP : this.ins.inOrbit ? ORBIT_WARP : COAST_WARP), burning);
    }
    if (this.ins.status === 'fail') { this.phase = 'fail'; this.why = this.ins.prop <= 0 ? 'fuel' : 'fell'; this.events.push('fail'); return; }
    if (this.phase === 'coast' && this.ins.inOrbit && !burning) { this.phase = 'orbit'; this.orbitAt = this.play; this.events.push('orbit'); }
    if (this.phase === 'orbit' && !burning && this.play - this.orbitAt >= DEPLOY_AUTO) this.act('deploy', true);
  };
  /** Everything a screen needs to draw the flight, in small numbers: the server sends this many times a second. */
  Mission.prototype.state = function () {
    var s = this.launch.sim, ev = s.ev, o = this.ins;
    function r(v, k) { return Math.round(v * k) / k; }
    return { phase: this.phase, why: this.why, play: r(this.play, 100),
      c: { alt: r(s.altKm(), 100), pitch: r(s.pitch, 1000), target: r(s.target, 1000), err: r(s.err, 10), thr: r(s.throttle, 100), burnOn: s.status === 'flying' && s.coreProp > 0,
        core: r(s.coreProp / (ev.tank.prop * 1000), 1000), boost: r(s.boostersOn ? s.boostProp / (ev.boost.prop * 1000) : 0, 1000), bOn: s.boostersOn, bEmpty: s.boostersEmpty, late: s.dropLate,
        fair: !!s.fairingGone, fairAt: s.fairingAt == null ? null : r(s.fairingAt, 1), apo: Math.round(Math.min(9999, F.elements(s.s).apoKm)), q: r(s.qKpa(), 10), maxQ: r(s.maxQ / 1000, 10), maxQDone: s.maxQDone, g: r(s.g, 10),
        v: Math.round(s.speed()), vv: Math.round(s.vertical()), vh: Math.round(s.horizontal()), t: Math.round(s.t), st: s.status, steady: this.launch.steady() },
      o: o ? { r: Math.round(o.s.r), vr: r(o.s.vr, 10), vt: r(o.s.vt, 10), u: r(o.s.u, 100000), prop: r(o.prop / (F.UPPER.prop * 1000), 1000), burning: this.burning(), inOrbit: o.inOrbit, t: Math.round(o.t) } : null };
  };
  /** How each seat did, and the stars the crew earned together: three only when every seat earned three. */
  Mission.prototype.score = function () {
    var ls = this.launch.score(), pts = { sharp: 2, ok: 1, late: 0, never: 0 }, seats = {}, ok = this.phase === 'done';
    function stars(n) { return n >= 4 ? 3 : n >= 2 ? 2 : 1; }
    seats.pilot = { stars: ls.pilot.stars, line: ls.pilot.line };
    var core = this.coreDelay == null ? 'never' : this.coreLate ? 'late' : this.coreDelay <= CORE_SHARP ? 'sharp' : this.coreDelay <= CORE_OK ? 'ok' : 'late';
    seats.engineer = { stars: stars(pts[ls.engineer.sep] + pts[core]), line: ls.engineer.sepLine + ' ' +
      (core === 'never' ? 'The flight ended before the core stage was let go.' : this.coreLate ? 'The computer had to separate the empty core stage, five seconds after cut-off.'
        : 'Core stage separated ' + this.coreDelay.toFixed(1) + ' s after cut-off' + (core === 'sharp' ? ': sharp.' : ': the upper stage waited for it.')) };
    var orbit = this.ins ? this.ins.result() : null, nav = 1;
    if (orbit && orbit.ok) nav = orbit.round <= 120 && orbit.fuelLeft >= 0.2 ? 3 : orbit.round <= 300 ? 2 : 1;
    seats.navigator = { stars: nav, line: !orbit ? 'The rocket never reached the upper-stage burn.' : !orbit.ok ? 'The path never closed into an orbit.'
      : 'Orbit ' + Math.round(orbit.periKm) + ' by ' + Math.round(orbit.apoKm) + ' km, with ' + Math.round(orbit.fuelLeft * 100) + '% of the upper-stage propellant left' +
        (nav === 3 ? ': nearly a circle, and thrifty.' : nav === 2 ? '. Burning right at the top of the arc makes it rounder and cheaper.' : '. A long way from a circle: start the burn at the top of the arc.') };
    var dep = this.deployDelay == null ? 'never' : this.deployLate ? 'late' : this.deployDelay <= DEPLOY_SHARP ? 'sharp' : this.deployDelay <= DEPLOY_OK ? 'ok' : 'late';
    seats.payload = { stars: stars(pts[ls.engineer.fairing] + pts[dep]), line: ls.engineer.fairLine + ' ' +
      (dep === 'never' ? 'The satellite was never released.' : this.deployLate ? 'The computer released the satellite after twelve seconds of waiting.'
        : 'Satellite released ' + this.deployDelay.toFixed(1) + ' s after the orbit closed' + (dep === 'sharp' ? ': sharp.' : '.')) };
    var sum = SEATS.reduce(function (a, k) { return a + seats[k].stars; }, 0);
    return { ok: ok, stars: ok ? Math.max(1, Math.floor(sum / SEATS.length)) : 0, seats: seats, why: this.why,
      orbit: orbit && orbit.ok ? { apoKm: Math.round(orbit.apoKm), periKm: Math.round(orbit.periKm), periodMin: Math.round(orbit.periodMin), fuelLeft: orbit.fuelLeft } : null };
  };

  RG.Crew = { SEATS: SEATS, SEAT: SEAT, Mission: Mission, CORE_AUTO: CORE_AUTO, DEPLOY_AUTO: DEPLOY_AUTO, WARP: WARP, KICK: KICK, STEADY: STEADY, SEP_SHARP: SEP_SHARP, SEP_OK: SEP_OK, FAIR_SHARP: FAIR_SHARP, FAIR_OK: FAIR_OK, WINDOW_MIN: WINDOW_MIN,
    DEFAULT: DEFAULT, rehearse: rehearse, build: crewBuild, Launch: Launch };
})(typeof window !== 'undefined' ? window : globalThis);
