/* Orbit Ranger — scene director.
 * Decides what the 3D stage shows for each part of the game:
 *
 *   title, brief, report   the turning Earth
 *   bay                    the satellite being assembled
 *   orbit                  Earth with orbit rings and a one-day coverage test
 *   shadow                 Earth's shadow and a live battery test
 *   stations               ground stations and a live memory test
 *   pad, launch            the rocket
 *   mission                the three-year flight
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE;
  var Stage = RG.Stage, E = RG.Earth, S = RG.SatModel, R = RG.Rocket;
  var P = RG.Physics, D = RG.DATA, M = RG.Model;

  var V = { name: null, design: RG.blankDesign(), preview: null, mission: null };
  var BG_SPACE = 0x02040a, BG_BAY = 0x0a111b, SKY = 0x79b4e6;
  var EARTH_VIEWS = ['title', 'brief', 'orbit', 'shadow', 'stations', 'mission', 'report', 'insert'];
  var theta = 0, lab = null, launchHooks = null, lastCount = -1, fadeClock = 0;
  var PAINT = '#59e1ff', PAINT_STATION = 'rgba(102,255,176,0.75)';

  V.init = function () {
    E.build(); S.build(); R.build();
    Stage.onFrame(update);
  };

  /** Tell the scenes about a design change. `changed` is the slot that was just picked. */
  V.setDesign = function (design, changed) {
    V.design = design;
    S.update(design, changed);
    if (V.name === 'bay') frameBay(V.opts && V.opts.focus, false);
    else if (V.name === 'pad') setPadRocket();
    else if (V.name === 'orbit' || V.name === 'shadow' || V.name === 'stations') V.set(V.name, V.opts);
  };

  function family(name) {
    return EARTH_VIEWS.indexOf(name) >= 0 ? 'earth' : name === 'bay' ? 'bay' : 'pad';
  }

  V.family = family;

  /** Switch what the stage shows. */
  V.set = function (name, opts) {
    opts = opts || {};
    var prev = V.name, cut = !prev || family(prev) !== family(name);
    V.name = name; V.opts = opts;
    var rig = Stage.rig, cam = Stage.camera, scene = Stage.scene;
    var fam = family(name);

    E.show(fam === 'earth'); S.show(fam === 'bay'); R.show(fam === 'pad');
    scene.environment = fam === 'pad' ? null : Stage.env; // studio reflections indoors and in space, plain daylight on the pad
    E.setZones(false); E.setStations(null); // also removes their text labels
    Stage.stars.visible = fam !== 'bay';
    Stage.stars.material.opacity = fam === 'pad' ? 0 : 1;
    Stage.stars.rotation.y = 0;
    rig.frame = 0; rig.locked = false; Stage.shake = 0;
    lab = null; V.preview = null;
    if (name !== 'mission') V.mission = null;
    if (name !== 'launch') { launchHooks = null; }

    if (fam === 'earth') {
      scene.background.set(BG_SPACE); scene.fog = null;
      cam.near = 0.01; cam.far = 500;
      rig.minEl = -1.35; rig.maxEl = 1.35;
      E.setRings([]); E.setShadow(false); E.setRecent(false);
      E.hideSat(); E.setFires([]); E.paintClear(); E.setSatModel(null); E.clearRibbons();
      E.paintMat.opacity = 0.42;
    } else if (fam === 'bay') {
      scene.background.set(BG_BAY); scene.fog = new THREE.Fog(BG_BAY, 9, 42);
      cam.near = 0.05; cam.far = 300;
      rig.minEl = -0.03; rig.maxEl = 1.3;
    } else {
      scene.background.set(SKY); scene.fog = new THREE.Fog(SKY, 1500, 45000);
      cam.near = 0.5; cam.far = 80000;
      rig.minEl = 0.015; rig.maxEl = 1.3;
    }
    cam.updateProjectionMatrix();

    var d = V.design, orbit = d.orbit && D.ORBITS[d.orbit], far = orbit && orbit.kind === 'geo';
    if (name === 'title' || name === 'report') {
      if (prev !== 'title' && prev !== 'report') theta = 0; // start with Africa and Europe facing us
      E.setRecent(true);
      Stage.look({ target: zero(), az: 0.45, el: 0.28, radius: name === 'title' ? 3.7 : 4.4, minR: 2, maxR: 12, autoSpin: 0, speed: 3 }, cut);
    } else if (name === 'brief') {
      E.setRecent(true);
      E.setZones(true, true);
      Stage.look({ target: zero(), az: 0.3, el: 0.3, radius: 3.25, minR: 1.8, maxR: 10, autoSpin: 0, speed: 3 }, cut);
    } else if (name === 'bay') {
      frameBay(opts.focus, cut);
    } else if (name === 'orbit') {
      E.setRings(Object.keys(D.ORBITS), d.orbit);
      if (orbit) startLab('orbit');
      Stage.look({ target: zero(), radius: far ? 17 : 3.7, minR: 1.8, maxR: 30, autoSpin: 0, speed: 2.4 }, false);
      if (cut || prev !== 'orbit') Stage.look({ az: 0.75, el: 0.5 }, cut);
    } else if (name === 'shadow') {
      E.setShadow(true);
      E.setRings([d.orbit], d.orbit, { shadow: true });
      startLab('shadow');
      Stage.look({ target: zero(), radius: far ? 17 : 4.9, minR: 1.8, maxR: 30, autoSpin: 0, speed: 2.4 }, false);
      if (cut || prev !== 'shadow') Stage.look({ az: -1.85, el: 0.3 }, cut);
    } else if (name === 'stations') {
      var sites = d.network ? D.NETWORKS[d.network].sites : Object.keys(D.STATIONS);
      E.setStations(sites);
      E.setRings([d.orbit], d.orbit);
      startLab('stations');
      E.paintMat.opacity = 0.3;
      var lamC = P.contactAngle(orbit.alt);
      sites.forEach(function (k) { E.paintCap(D.STATIONS[k].lat, D.STATIONS[k].lon, lamC, PAINT_STATION); });
      Stage.look({ target: zero(), radius: far ? 12 : 3.7, minR: 1.8, maxR: 30, autoSpin: 0, speed: 2.4 }, false);
      if (cut || prev !== 'stations') Stage.look({ az: -1.45, el: -0.3 }, cut);
    } else if (name === 'pad') {
      R.reset();
      setPadRocket();
      Stage.look({ az: -Math.PI / 2 + 0.75, el: 0.1, minR: 25, maxR: 600, autoSpin: 0.05, speed: 3 }, cut);
    } else if (name === 'rk-parts' || name === 'rk-build') {
      // levels 1 and 2: the build-it-yourself rocket standing on the pad
      R.reset();
      Stage.look({ target: new THREE.Vector3(0, R.height * 0.5, 0), radius: R.height * 2.1 + 44, az: -Math.PI / 2 + 0.7, el: 0.12, minR: 16, maxR: 600, autoSpin: 0.06, speed: 3 }, cut);
    } else if (name === 'ascent') {
      // level 3: the climb, with the camera riding alongside
      R.reset();
      rig.locked = true;
      Stage.look({ target: new THREE.Vector3(0, R.height * 0.5, 0), radius: R.height * 1.7 + 40, az: -Math.PI / 2 + 0.35, el: 0.06, minR: 5, maxR: 5000, autoSpin: 0, speed: 5 }, true);
    } else if (name === 'insert') {
      // level 4: the whole planet, with the flight path drawn around it
      E.setRecent(true);
      Stage.look({ target: zero(), az: opts.az || 0, el: opts.el == null ? 0.9 : opts.el, radius: 3.9, minR: 1.8, maxR: 14, autoSpin: 0, speed: 2.4 }, cut);
    } else if (name === 'launch') {
      rig.locked = true;
      R.setStyle(d.rocket ? D.ROCKETS[d.rocket].style : 'medium');
      R.start();
      lastCount = -1;
      Stage.look({ target: new THREE.Vector3(0, R.height * 0.45, 0), az: -Math.PI / 2 + 0.55, el: 0.07, radius: R.height * 1.5 + 34, minR: 5, maxR: 5000, autoSpin: 0, speed: 3 }, true);
    } else if (name === 'mission') {
      var sitesM = D.NETWORKS[d.network].sites;
      E.setStations(sitesM);
      E.setRings([d.orbit], d.orbit);
      E.setSatModel(S.flightCopy(d));
      E.paintMat.opacity = 0.2;
      Stage.look({ target: zero(), az: far ? -0.75 : 0.3, el: 0.35, radius: far ? 9.5 : 3.35, minR: 1.8, maxR: 30, autoSpin: 0, speed: 2.4 }, cut);
    }
    return cut;
  };

  function zero() { return new THREE.Vector3(0, 0, 0); }

  /* ---------- build bay framing ---------- */
  var FOCUS = {
    sensor: { az: -1.0, el: 0.44, zoom: 0.9 },
    bus: { az: -0.85, el: 0.26, zoom: 1 },
    power: { az: -1.32, el: 0.2, zoom: 1 },
    brain: { az: -1.42, el: 0.1, zoom: 0.62 },
    radio: { az: 0.05, el: 0.5, zoom: 0.8 },
    all: { az: -1.05, el: 0.24, zoom: 1 }
  };
  function frameBay(focus, instant) {
    var u = S.info, f = FOCUS[focus] || FOCUS.all;
    var wide = Math.max(u.span, u.w + 1.2) + 1.9; // room for the engineer standing alongside
    var radius = Math.max(1.6 * wide, 2.6 * (u.top - S.floorY), 4) * f.zoom;
    var y = focus === 'brain' ? 0 : (u.top + S.floorY) / 2 + 0.25;
    var o = { target: new THREE.Vector3(0, y, 0), radius: radius, minR: 1.2, maxR: 45, autoSpin: 0.1, speed: 3 };
    if (instant || V.lastFocus !== focus) { o.az = f.az; o.el = f.el; }
    V.lastFocus = focus;
    Stage.look(o, instant);
  }

  function setPadRocket() {
    var d = V.design;
    R.setStyle(d.rocket ? D.ROCKETS[d.rocket].style : null);
    Stage.look({ target: new THREE.Vector3(0, R.height * 0.5, 0), radius: R.height * 2.3 + 46 }, false);
  }

  /* ---------- live “lab” tests used while designing ---------- */
  function startLab(mode) {
    var d = V.design, orbit = D.ORBITS[d.orbit], ev = M.evaluate(d);
    var sensor = d.sensor ? D.SENSORS[d.sensor] : D.SENSORS.wide;
    var sites = (d.network ? D.NETWORKS[d.network].sites : Object.keys(D.STATIONS)).map(function (k) {
      return { key: k, name: D.STATIONS[k].name, vec: P.latLonToVec(D.STATIONS[k].lat, D.STATIONS[k].lon) };
    });
    var lapMin = P.periodMin(orbit.alt);
    lab = {
      mode: mode, orbit: orbit, t: 0, hold: 0,
      n: (2 * Math.PI) / lapMin,
      u0: P.startAngle(orbit, 0, 0.13),
      lam: P.swathHalfAngle(orbit.alt, sensor.scanHalfDeg),
      // sim minutes per real second: a day in 20 s, except the shadow test, which shows one lap in about 8 s
      rate: mode === 'shadow' && orbit.kind !== 'geo' ? lapMin / 8 : mode === 'stations' ? 60 : 72,
      load: ev.load, watts: ev.watts, cap: ev.battWh, batt: ev.battWh, brown: false,
      gen: ev.dataGen / 1440, link: ev.linkRate, storage: ev.storage, stored: 0, lost: 0,
      sites: sites, cosC: Math.cos(P.contactAngle(orbit.alt)),
      pos: [1, 0, 0], dark: false, station: null
    };
    theta = 0;
    E.paintClear();
    V.preview = { mode: mode, battFrac: 1, dark: false, brown: false, stored: 0, storage: ev.storage, lost: 0, station: null, hours: 0 };
    if (mode === 'orbit' && orbit.kind === 'geo') paintStare();
  }

  function paintStare() {
    E.paintCap(0, lab.orbit.lon, lab.lam, PAINT);
  }

  function labStep(h) {
    var L = lab;
    L.t += h;
    L.pos = P.orbitPos(L.orbit, L.u0 + L.n * L.t);
    theta = P.EARTH_RATE * L.t;
    L.dark = P.inShadow(L.pos, L.orbit.alt);
    var sub = P.toEarthFixed(L.pos, theta);

    if (L.mode === 'orbit' && L.orbit.kind !== 'geo') {
      var ll = P.vecToLatLon(sub);
      E.paintCap(ll.lat, ll.lon, L.lam, PAINT);
    }
    if (L.mode === 'shadow' && L.cap > 0) {
      var use = L.brown ? L.load * 0.3 : L.load;
      if (L.dark) L.batt -= (use * h) / 60;
      else { var extra = L.watts - use; L.batt += ((extra > 0 ? extra * M.CHARGE_EFF : extra) * h) / 60; }
      if (L.batt > L.cap) L.batt = L.cap;
      if (L.batt <= 0) { L.batt = 0; L.brown = true; }
      else if (L.brown && L.batt > 0.3 * L.cap) L.brown = false;
    }
    if (L.mode === 'stations') {
      L.station = null;
      for (var i = 0; i < L.sites.length; i++) if (P.dot(sub, L.sites[i].vec) >= L.cosC) { L.station = L.sites[i]; break; }
      L.stored += L.gen * h;
      if (L.station) L.stored = Math.max(0, L.stored - L.link * h);
      if (L.storage && L.stored > L.storage) { L.lost += L.stored - L.storage; L.stored = L.storage; }
    }
  }

  function updateLab(dt) {
    var L = lab;
    if (L.hold > 0) {
      L.hold -= dt;
      if (L.hold <= 0) {
        L.t = 0; L.batt = L.cap; L.brown = false; L.stored = 0; L.lost = 0;
        if (L.mode === 'orbit') { E.paintClear(); if (L.orbit.kind === 'geo') paintStare(); }
      }
    } else {
      var left = L.rate * dt;
      while (left > 0) { var h = Math.min(0.5, left); labStep(h); left -= h; }
      // the coverage test restarts after one day; the others after three
      var limit = L.mode === 'orbit' ? 1440 : 4320;
      if (L.t >= limit) L.hold = L.mode === 'orbit' ? 1.6 : 0.01;
    }
    E.setTheta(theta);
    if (L.mode === 'stations') { Stage.rig.frame = theta; Stage.stars.rotation.y = theta; }
    E.setSat(L.pos, L.orbit.alt, {
      dark: L.dark, off: L.mode === 'shadow' && L.brown,
      lam: L.mode === 'orbit' ? L.lam : 0
    });
    E.setBeam(L.mode === 'stations' && L.station ? L.station.vec : null, theta);
    var p = V.preview;
    p.battFrac = L.cap ? L.batt / L.cap : 0; p.dark = L.dark; p.brown = L.brown;
    p.stored = L.stored; p.lost = L.lost; p.station = L.station ? L.station.name : null; p.hours = L.t / 60;
  }

  /* ---------- launch ---------- */
  V.launch = function (hooks) {
    V.set('launch');
    launchHooks = hooks || {};
  };

  function updateLaunch(dt) {
    var st = R.update(dt);
    if (!st) return;
    if (st.count !== lastCount) { lastCount = st.count; if (launchHooks && launchHooks.onCount) launchHooks.onCount(st.count); }
    var up = Math.max(0, R.t - 3);
    var y = 1.2 + R.alt + R.height * 0.45;
    var el = up <= 0 ? 0.07 : up < 3.5 ? 0.07 - 0.3 * Stage.smooth(up / 3.5) : -0.23 + 0.5 * Stage.smooth((up - 3.5) / 3.5);
    var radius = R.height * 1.5 + 34 + up * 9;
    // never let the camera sink into the ground
    var floorEl = Math.asin(Math.max(-1, Math.min(1, (3 - y) / radius)));
    Stage.look({ target: new THREE.Vector3(0, y, 0), el: Math.max(el, floorEl), radius: radius, az: -Math.PI / 2 + 0.55 + up * 0.05, speed: 5 }, false);
    Stage.rig.target.y = y; // stay locked on the rocket however fast it climbs
    if (st.done && launchHooks) {
      var done = launchHooks.onDone; launchHooks = null;
      R.flying = false; Stage.shake = 0;
      if (done) done();
    }
  }

  /* ---------- the mission ---------- */

  /** Attach a simulation. hooks.onChapterEnd() fires once when a year's sample day is over. */
  V.startMission = function (sim, hooks) {
    V.set('mission');
    V.mission = { sim: sim, speed: 1, paused: true, acc: 0, hooks: hooks || {}, ended: false,
      lam: P.swathHalfAngle(sim.orbit.alt, sim.sensor.scanHalfDeg) };
  };

  /** Call right after sim.startChapter(): shows the new year's fires. */
  V.missionChapter = function () {
    var m = V.mission;
    if (!m) return;
    m.ended = false; m.acc = 0;
    E.setFires(m.sim.c.fires);
    E.paintClear();
    drawMission(0);
  };

  function updateMission(dt, time) {
    var m = V.mission, sim = m.sim, c = sim.c;
    if (!c) return;
    if (!m.paused && !c.done) {
      m.acc += 72 * m.speed * dt;
      var geo = sim.orbit.kind === 'geo';
      while (m.acc >= RG.Sim.STEP && !c.done) {
        sim.step();
        m.acc -= RG.Sim.STEP;
        if (c.on && !geo) { var ll = P.vecToLatLon(c.sub); E.paintCap(ll.lat, ll.lon, m.lam, PAINT); }
      }
      fadeClock += dt * m.speed;
      if (fadeClock > 0.1) {
        fadeClock = 0;
        E.paintFade(0.055);
        if (geo && c.on) E.paintCap(0, sim.orbit.lon, m.lam, PAINT);
      }
    }
    drawMission(time);
    if (c.done && !m.ended) { m.ended = true; if (m.hooks.onChapterEnd) m.hooks.onChapterEnd(); }
  }

  function drawMission(time) {
    var m = V.mission, c = m.sim.c;
    theta = c.theta;
    E.setTheta(theta);
    Stage.rig.frame = theta; Stage.stars.rotation.y = theta; // the camera rides along with the turning Earth
    E.setSat(c.pos, m.sim.orbit.alt, { dark: c.dark, off: !c.on, lam: m.lam });
    E.setBeam(c.link && c.on ? c.link.vec : null, theta);
    E.updateFires(time);
  }

  /* ---------- every frame ---------- */
  function update(dt, time) {
    if (!V.name) return;
    S.tick(dt);
    if (V.name === 'title' || V.name === 'brief' || V.name === 'report') {
      if (!Stage.reducedMotion) theta += dt * (V.name === 'brief' ? 0.09 : 0.05);
      E.setTheta(theta);
      E.updateFires(time);
    } else if (lab) {
      updateLab(dt);
    } else if (V.name === 'orbit') {
      if (!Stage.reducedMotion) theta += dt * 0.12;
      E.setTheta(theta);
    } else if (V.name === 'insert') {
      E.updateFires(time);
    } else if (V.name === 'launch') {
      updateLaunch(dt);
    } else if (V.name === 'mission' && V.mission) {
      updateMission(dt, time);
    }
    if (E.group.visible) E.flush();
  }

  RG.Views = V;
})();
