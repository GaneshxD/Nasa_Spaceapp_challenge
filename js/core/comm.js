/* Orbit Ranger — talking to Earth from the Moon, and the deorbit burn (level 6).
 * Why a lander loses contact with Earth, for how long, and what that means for the burn that starts the trip down.
 * No browser code: this file also runs in Node for the tests.
 *
 * What is modelled, with real numbers:
 *   Radio travels in straight lines at the speed of light, 299,792 km/s. The Moon is about 384,400 km away, so a
 *   signal takes about 1.3 s each way.
 *   A lander in a 110 km parking orbit (Apollo's was 60 nautical miles) laps the Moon in about two hours. For the
 *   part of each lap when the Moon itself stands between the lander and Earth, there is no line of sight and so no
 *   signal: about 46 minutes a lap. Controllers call the two edges LOS (loss of signal) and AOS (acquisition).
 *   The deorbit burn (Apollo: descent orbit insertion, DOI) is a short burn against the direction of travel. It
 *   lowers the far side of the orbit to about 15 km. Because that low point has to sit just short of the landing
 *   site on the near side, the burn itself happens half a lap earlier: behind the Moon, out of contact.
 * Simplified on purpose: the orbit lies in the plane of the picture, Earth is treated as infinitely far away (its
 * rays are parallel), and the price of a mistimed burn (Pass.result().cost) is a game model.
 */
(function (root) {
  'use strict';
  var RG = (root.RG = root.RG || {});
  var C = 299792.458;          // km/s
  var EARTH_MOON = 384400;     // km, the average distance
  var MOON_R = 1737.4;         // km
  var MOON_MU = 4902.8;        // km³/s², the Moon's gravity
  var PARK_ALT = 110, LOW_ALT = 15, D2R = Math.PI / 180;
  var LM_MASS = 15100;         // kg, the lander at the deorbit burn (Apollo 11: about 15,100 kg)
  var THRUST = 45040;          // N, the descent engine at full thrust
  var ARM = 10, BACKUP = 8;    // seconds: the fire button is live from T-10; the computer fires by itself at T+8
  var ON_TIME = 1, COST_PER_S = 3, COST_MAX = 18; // a burn within a second is perfect; each second beyond costs 3 kg of landing propellant

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /** Seconds a radio signal takes to cover a distance (one way). */
  function delay(km) { return (km == null ? EARTH_MOON : km) / C; }
  /** A circular orbit at a height above the Moon. */
  function circ(altKm) {
    var r = MOON_R + altKm, v = Math.sqrt(MOON_MU / r), period = 2 * Math.PI * r / v;
    return { r: r, v: v, period: period, rate: 360 / period };
  }
  /** The radio shadow behind the Moon for a circular orbit: how wide it is and how long a lap spends in it. */
  function shadow(altKm) {
    var o = circ(altKm), half = Math.asin(MOON_R / o.r) / D2R;
    return { half: half, frac: half / 180, seconds: o.period * half / 180, from: 180 - half, to: 180 + half };
  }
  /**
   * Is the Moon in the way? phi: degrees travelled around the Moon since passing the point directly under Earth.
   * r: distance from the Moon's centre, km. Hidden when on the far half and inside the Moon's "shadow" for radio.
   */
  function hidden(phi, r) {
    var a = phi * D2R;
    return Math.cos(a) < 0 && Math.abs(Math.sin(a)) * r < MOON_R;
  }
  /** The deorbit burn: from a circle at altKm to an orbit whose low point is lowKm. */
  function doi(altKm, lowKm) {
    var ra = MOON_R + altKm, rp = MOON_R + lowKm, a = (ra + rp) / 2;
    var v0 = Math.sqrt(MOON_MU / ra), v1 = Math.sqrt(MOON_MU * (2 / ra - 1 / a));
    return { dv: (v0 - v1) * 1000, vBefore: v0, vAfter: v1, a: a, e: (ra - rp) / (ra + rp), ra: ra, rp: rp,
      period: 2 * Math.PI * Math.sqrt(a * a * a / MOON_MU), h: ra * v1 };
  }
  /** How long the engine runs for a change in speed: 15 s at a tenth of full thrust to settle the propellant, the rest at 40%. */
  function burnTime(dv, massKg) {
    var a1 = 0.1 * THRUST / massKg, a2 = 0.4 * THRUST / massKg;
    return dv <= a1 * 15 ? dv / a1 : 15 + (dv - a1 * 15) / a2;
  }
  /** What a mistimed burn costs in landing propellant, kg. err: seconds late (negative: early). */
  function cost(err) { return Math.round(clamp((Math.abs(err) - ON_TIME) * COST_PER_S, 0, COST_MAX)); }

  /**
   * One pass around the back of the Moon: in contact, loss of signal, the deorbit burn, back in contact, go for
   * the landing. siteLon: the landing site's longitude in degrees east. Advance it with advance(seconds); press
   * the fire button with ignite(). Events are pushed onto pass.events as they happen, in order:
   *   'pad' the burn numbers arrive by uplink · 'los' · 'arm' the fire button goes live · 'ignite' · 'cutoff'
   *   'aos' · 'go'
   */
  function Pass(siteLon) {
    var park = circ(PARK_ALT), sh = shadow(PARK_ALT), d = doi(PARK_ALT, LOW_ALT);
    this.park = park; this.sh = sh; this.doi = d;
    // The low point belongs 16° short of the site (Apollo started its powered descent about 480 km out). Apollo
    // orbits ran east to west across the near side, so that point is at longitude site + 16°, and the burn is
    // half a lap before it: 164° - longitude past the point under Earth. For all six sites that is in the shadow.
    this.phiBurn = 164 - siteLon;
    this.phiPdi = this.phiBurn + 180;
    this.phi0 = sh.from - 40;                                  // start on the near side, about 13 minutes before loss of signal
    this.phi = this.phi0; this.t = 0; this.r = park.r;
    this.tLos = (sh.from - this.phi0) / park.rate;
    this.tPad = this.tLos * 0.35;
    this.tBurn = (this.phiBurn - this.phi0) / park.rate;
    this.burnLen = burnTime(d.dv, LM_MASS);
    this.status = 'contact';                                   // contact → dark → burning → coast → contact2 → go
    this.events = []; this.fired = null; this.byComputer = false; this.padIn = false; this.done = false;
    this.tAos = null; this.tGo = null; this.burnLeft = 0;
  }
  /** Seconds until the burn (negative once it is past). */
  Pass.prototype.toBurn = function () { return this.tBurn - this.t; };
  Pass.prototype.armed = function () { return this.fired == null && this.toBurn() <= ARM && this.status === 'dark'; };
  /** Fire the engine. True if it lit. */
  Pass.prototype.ignite = function (byComputer) {
    if (this.fired != null || this.status !== 'dark' || this.toBurn() > ARM) return false;
    this.fired = this.t; this.byComputer = !!byComputer; this.status = 'burning'; this.burnLeft = this.burnLen;
    this.events.push('ignite');
    return true;
  };
  Pass.prototype.altKm = function () { return this.r - MOON_R; };
  /** Is Earth in view right now, and how long does a signal take? */
  Pass.prototype.link = function () {
    var up = !hidden(this.phi, this.r);
    return { up: up, delay: delay(), blockedKm: up ? 0 : 2 * MOON_R };
  };
  /** Highest and lowest points of the orbit as it is now, km above the Moon. */
  Pass.prototype.orbit = function () {
    var f = this.fired == null ? 0 : this.status === 'burning' ? 1 - this.burnLeft / this.burnLen : 1;
    return { apo: PARK_ALT, peri: PARK_ALT - (PARK_ALT - LOW_ALT) * f };
  };
  Pass.prototype.advance = function (dt) {
    if (this.done) return;
    var left = dt;
    while (left > 1e-9 && !this.done) {
      var h = Math.min(left, 0.25); left -= h;
      this.t += h;
      // where the lander is: on the circle until the burn is done, on the new, lower orbit after it
      if (this.status === 'coast' || this.status === 'contact2' || this.status === 'go') {
        this.phi += (this.doi.h / (this.r * this.r)) / D2R * h;
        var nu = (this.phi - this.phiBurnAt - 180) * D2R; // angle from the low point; the burn is at the high point
        this.r = this.doi.a * (1 - this.doi.e * this.doi.e) / (1 + this.doi.e * Math.cos(nu));
      } else this.phi += this.park.rate * h;

      if (!this.padIn && this.t >= this.tPad) { this.padIn = true; this.events.push('pad'); }
      if (this.status === 'contact' && hidden(this.phi, this.r)) { this.status = 'dark'; this.events.push('los'); }
      if (this.status === 'dark') {
        if (!this.armSaid && this.toBurn() <= ARM) { this.armSaid = true; this.events.push('arm'); }
        if (this.toBurn() <= -BACKUP) this.ignite(true);       // nobody fired it: the computer does, late
      }
      if (this.status === 'burning') {
        this.burnLeft -= h;
        if (this.burnLeft <= 0) { this.burnLeft = 0; this.status = 'coast'; this.phiBurnAt = this.phi; this.events.push('cutoff'); }
      }
      if (this.status === 'coast' && !hidden(this.phi, this.r)) { this.status = 'contact2'; this.tAos = this.t; this.events.push('aos'); }
      // Mission Control needs a little time with fresh tracking before it can answer: here, 90 seconds
      if (this.status === 'contact2' && this.t - this.tAos >= 90) { this.status = 'go'; this.tGo = this.t; this.done = true; this.events.push('go'); }
    }
  };
  /** How the burn went. */
  Pass.prototype.result = function () {
    var err = this.fired == null ? BACKUP : this.fired - this.tBurn, c = cost(err);
    return { err: err, cost: c, byComputer: this.byComputer, onTime: Math.abs(err) <= ON_TIME,
      shiftKm: Math.abs(err) * this.park.v,                      // the low point moves this far along the ground
      darkMin: this.tAos == null ? this.sh.seconds / 60 : (this.tAos - this.tLos) / 60,
      dv: this.doi.dv, burnLen: this.burnLen, apo: PARK_ALT, peri: LOW_ALT };
  };

  RG.Comm = {
    C: C, EARTH_MOON: EARTH_MOON, MOON_R: MOON_R, MOON_MU: MOON_MU, PARK_ALT: PARK_ALT, LOW_ALT: LOW_ALT, ARM: ARM, BACKUP: BACKUP,
    delay: delay, circ: circ, shadow: shadow, hidden: hidden, doi: doi, burnTime: burnTime, cost: cost, Pass: Pass
  };
})(typeof window !== 'undefined' ? window : globalThis);
