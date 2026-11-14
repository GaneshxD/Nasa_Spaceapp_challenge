/* Orbit Ranger — orbital geometry.
 * Small, dependency-free helpers shared by the design checker, the mission
 * simulation and the 3D views. Runs in the browser and in Node (for tests).
 *
 * Frames
 *   Inertial: Y is Earth’s north pole; the Sun sits in the X–Y plane.
 *   Earth-fixed: rotates with the planet. Longitude 0 is +X, east is toward −Z
 *   (this matches how three.js wraps a world map onto a sphere).
 */
(function (root) {
  'use strict';
  var RG = (root.RG = root.RG || {});
  var D2R = Math.PI / 180;
  var RE = 6371;            // Earth radius, km
  var MU = 398600.4418;     // Earth gravitational parameter, km^3/s^2
  var GEO_ALT = 35786;       // geostationary altitude, km
  var SUN_DECL = 12 * D2R;  // northern-summer Sun, the main fire season
  var MAX_VIEW = 65 * D2R;  // beyond this the ground is seen too edge-on to use
  var MIN_ELEV = 5 * D2R;   // dishes cannot track below 5° above the horizon

  var P = {
    RE: RE, MU: MU, D2R: D2R,
    EARTH_RATE: 0, // rad per minute; set below from the geostationary period
    SUN: [Math.cos(SUN_DECL), Math.sin(SUN_DECL), 0],
    MAX_VIEW: MAX_VIEW
  };

  /** Time for one lap, in minutes (Kepler’s third law). */
  P.periodMin = function (altKm) {
    var a = RE + altKm;
    return (2 * Math.PI * Math.sqrt((a * a * a) / MU)) / 60;
  };

  // Earth turns once in exactly the time a geostationary satellite takes for
  // one lap (about 23 h 56 min). Deriving it this way keeps the two in step.
  P.EARTH_RATE = (2 * Math.PI) / P.periodMin(GEO_ALT);

  /** Orbital speed in km/s for a circular orbit. */
  P.speedKms = function (altKm) {
    return Math.sqrt(MU / (RE + altKm));
  };

  /** Ground size of one pixel, metres. ifov is the pixel’s angle in radians. */
  P.pixelMeters = function (altKm, ifov, blur) {
    return altKm * 1000 * ifov * (blur || 1);
  };

  /**
   * Half-width of the visible strip as an angle at Earth’s centre (radians),
   * for an instrument that scans ±scanHalfDeg from straight down.
   */
  P.swathHalfAngle = function (altKm, scanHalfDeg) {
    var k = (RE + altKm) / RE;
    var eta = scanHalfDeg * D2R;
    var s = k * Math.sin(eta);
    var lam = s >= 1 ? Math.acos(1 / k) : Math.asin(s) - eta; // s>=1: sees to the horizon
    return Math.min(lam, MAX_VIEW);
  };

  /** Full swath width on the ground, km. */
  P.swathKm = function (altKm, scanHalfDeg) {
    return 2 * RE * P.swathHalfAngle(altKm, scanHalfDeg);
  };

  /** How far (angle at Earth’s centre) a ground station can see a satellite. */
  P.contactAngle = function (altKm) {
    return Math.acos((RE * Math.cos(MIN_ELEV)) / (RE + altKm)) - MIN_ELEV;
  };

  /** Unit vector for a latitude/longitude in the Earth-fixed frame. */
  P.latLonToVec = function (latDeg, lonDeg) {
    var la = latDeg * D2R, lo = lonDeg * D2R, c = Math.cos(la);
    return [c * Math.cos(lo), Math.sin(la), -c * Math.sin(lo)];
  };

  /** Latitude/longitude (degrees) of an Earth-fixed unit vector. */
  P.vecToLatLon = function (v) {
    return {
      lat: Math.asin(Math.max(-1, Math.min(1, v[1]))) / D2R,
      lon: Math.atan2(-v[2], v[0]) / D2R
    };
  };

  /**
   * Unit position of a satellite in the inertial frame.
   * u is the angle travelled along the orbit from the ascending node (radians).
   */
  P.orbitPos = function (orbit, u) {
    var i = orbit.inc * D2R, O = orbit.raanDeg * D2R;
    var cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(i), si = Math.sin(i);
    var cO = Math.cos(O), sO = Math.sin(O);
    // node direction N = (cosΩ, 0, −sinΩ); in-plane normal M = (−sinΩ·cos i, sin i, −cosΩ·cos i)
    return [cu * cO - su * sO * ci, su * si, -cu * sO - su * cO * ci];
  };

  /** Rotate an inertial vector into the Earth-fixed frame (Earth has turned by theta). */
  P.toEarthFixed = function (v, theta) {
    var c = Math.cos(theta), s = Math.sin(theta);
    return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c];
  };

  /** Rotate an Earth-fixed vector into the inertial frame. */
  P.toInertial = function (v, theta) {
    var c = Math.cos(theta), s = Math.sin(theta);
    return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  };

  P.dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };

  /** True when Earth blocks the Sun (cylindrical shadow). posUnit is inertial. */
  P.inShadow = function (posUnit, altKm) {
    var k = (RE + altKm) / RE;
    var d = P.dot(posUnit, P.SUN);
    if (d >= 0) return false;
    var perp2 = k * k * (1 - d * d);
    return perp2 < 1;
  };

  /** Where a geostationary satellite must start so it sits above orbit.lon. */
  P.startAngle = function (orbit, theta0, rand) {
    if (orbit.kind === 'geo') return theta0 + orbit.lon * D2R;
    return rand * 2 * Math.PI;
  };

  /* ---------- Whole-day geometry, cached per orbit ---------- */
  var geoCache = {};

  /**
   * Fly one day and measure: shadow time, and how long each ground station
   * can see the satellite. Used by the design checker for quick estimates.
   */
  P.dayGeometry = function (orbitKey) {
    if (geoCache[orbitKey]) return geoCache[orbitKey];
    var D = RG.DATA, orbit = D.ORBITS[orbitKey];
    var T = P.periodMin(orbit.alt), n = (2 * Math.PI) / T;
    var lamC = Math.cos(P.contactAngle(orbit.alt));
    var dt = 0.5, steps = Math.round(1440 / dt);
    var u0 = P.startAngle(orbit, 0, 0.13);
    var shadow = 0, run = 0, longest = 0;
    var sites = {}, k;
    for (k in D.STATIONS) {
      sites[k] = { vec: P.latLonToVec(D.STATIONS[k].lat, D.STATIONS[k].lon), minutes: 0, passes: 0, on: false };
    }
    for (var s = 0; s < steps; s++) {
      var t = s * dt;
      var pos = P.orbitPos(orbit, u0 + n * t);
      if (P.inShadow(pos, orbit.alt)) { shadow += dt; run += dt; if (run > longest) longest = run; }
      else run = 0;
      var ef = P.toEarthFixed(pos, P.EARTH_RATE * t);
      for (k in sites) {
        var see = P.dot(ef, sites[k].vec) >= lamC;
        if (see) { sites[k].minutes += dt; if (!sites[k].on) sites[k].passes++; }
        sites[k].on = see;
      }
    }
    var out = {
      periodMin: T,
      speedKms: P.speedKms(orbit.alt),
      lapsPerDay: 1440 / T,
      shadowFrac: shadow / 1440,
      shadowMaxMin: longest,
      contact: {}
    };
    for (k in sites) out.contact[k] = { minutes: sites[k].minutes, passes: sites[k].passes };
    geoCache[orbitKey] = out;
    return out;
  };

  /** Minutes per day that at least one station in a network sees the satellite, and the longest gap. */
  var netCache = {};
  P.networkContact = function (orbitKey, networkKey) {
    var id = orbitKey + '/' + networkKey;
    if (netCache[id]) return netCache[id];
    var D = RG.DATA, orbit = D.ORBITS[orbitKey];
    var T = P.periodMin(orbit.alt), n = (2 * Math.PI) / T;
    var lamC = Math.cos(P.contactAngle(orbit.alt));
    var vecs = D.NETWORKS[networkKey].sites.map(function (s) {
      return P.latLonToVec(D.STATIONS[s].lat, D.STATIONS[s].lon);
    });
    var dt = 0.5, minutes = 0, gap = 0, maxGap = 0;
    var u0 = P.startAngle(orbit, 0, 0.13);
    for (var t = 0; t < 2880; t += dt) { // two days, so long gaps are measured fairly
      var ef = P.toEarthFixed(P.orbitPos(orbit, u0 + n * t), P.EARTH_RATE * t);
      var see = false;
      for (var j = 0; j < vecs.length; j++) if (P.dot(ef, vecs[j]) >= lamC) { see = true; break; }
      if (see) { minutes += dt; gap = 0; } else { gap += dt; if (gap > maxGap) maxGap = gap; }
    }
    return (netCache[id] = { minutesPerDay: minutes / 2, maxGapMin: maxGap });
  };

  /**
   * Which fire zones does a sensor in this orbit get to see in a day,
   * and how long does a zone wait between looks?
   */
  var covCache = {};
  P.coverage = function (orbitKey, sensorKey) {
    var id = orbitKey + '/' + sensorKey;
    if (covCache[id]) return covCache[id];
    var D = RG.DATA, orbit = D.ORBITS[orbitKey], sensor = D.SENSORS[sensorKey];
    var T = P.periodMin(orbit.alt), n = (2 * Math.PI) / T;
    var lamS = Math.cos(P.swathHalfAngle(orbit.alt, sensor.scanHalfDeg));
    var zones = D.FIRE_ZONES.map(function (z) {
      return { name: z.name, vec: P.latLonToVec(z.lat, z.lon), last: -1, looks: 0, gapSum: 0, gaps: 0, on: false };
    });
    var dt = 0.5, days = 4, u0 = P.startAngle(orbit, 0, 0.13);
    for (var t = 0; t < 1440 * days; t += dt) {
      var ef = P.toEarthFixed(P.orbitPos(orbit, u0 + n * t), P.EARTH_RATE * t);
      for (var j = 0; j < zones.length; j++) {
        var z = zones[j], see = P.dot(ef, z.vec) >= lamS;
        if (see && !z.on) {
          z.looks++;
          if (z.last >= 0) { z.gapSum += t - z.last; z.gaps++; }
        }
        if (see) z.last = t;
        z.on = see;
      }
    }
    var seenDaily = 0, missed = [], waitSum = 0, waitN = 0;
    zones.forEach(function (z) {
      var perDay = z.looks / days;
      if (perDay >= 0.99) seenDaily++;
      if (z.looks === 0) missed.push(z.name);
      if (z.gaps) { waitSum += z.gapSum / z.gaps; waitN++; }
    });
    var stare = orbit.kind === 'geo';
    return (covCache[id] = {
      zones: zones.length,
      seenDaily: stare ? zones.length - missed.length : seenDaily,
      neverSeen: missed,
      revisitHours: stare ? 0 : (waitN ? waitSum / waitN / 60 : Infinity),
      stare: stare
    });
  };

  RG.Physics = P;
})(typeof window !== 'undefined' ? window : globalThis);
