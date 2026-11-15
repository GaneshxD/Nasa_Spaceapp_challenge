/* Orbit Ranger — mission simulation and scoring.
 *
 * The mission is flown as three sample days, one from each year in orbit.
 * On each day one wildfire starts in every fire zone. Each one is a real fire
 * from NASA's FIRMS archive (see assets/nasa-fires.js): its place, its date and
 * its strength are NASA's measurements. When it starts on the sample day is ours. The simulation moves
 * the satellite along its real orbit in half-minute steps while the Earth
 * turns underneath, and tracks four things the player designed for:
 *
 *   power   solar wings charge the battery in sunlight; shadow drains it
 *   sight   a fire is spotted when it is inside the sensor’s strip and the
 *           pixels are small enough to show it
 *   data    pictures fill the memory and leave through ground-station passes
 *   alerts  a warning counts when it reaches the ground
 *
 * The same engine runs in the browser (stepped a little each frame) and in
 * Node (run flat out for tests and balancing).
 */
(function (root) {
  'use strict';
  var RG = (root.RG = root.RG || {});
  var D = RG.DATA, P = RG.Physics, M = RG.Model;

  var DAY = 1440;          // minutes in one simulated day
  var SPAWN_WINDOW = 480;  // fires start during the first 8 hours
  var STEP = 0.5;          // minutes per simulation step
  var RELAY_MIN = 10;      // smart computer: alert reaches the ground via relay satellites

  /** Small seeded random generator, so a mission can be replayed exactly. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function Sim(design, opts) {
    opts = opts || {};
    this.design = design;
    this.seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
    this.listener = opts.onEvent || null;

    this.sensor = D.SENSORS[design.sensor];
    this.orbit = D.ORBITS[design.orbit];
    this.bus = D.BUSES[design.bus];
    this.panels = D.PANELS[design.panels];
    this.battery = D.BATTERIES[design.battery];
    this.computer = D.COMPUTERS[design.computer];
    this.pointing = D.POINTING[design.pointing];
    this.radio = D.RADIOS[design.radio];
    this.network = D.NETWORKS[design.network];
    this.extras = (design.extras || []).slice();

    var parts = M.parts(design), load = 0, gen = 0;
    parts.forEach(function (p) { load += p.item.power || 0; gen += p.item.data || 0; });
    this.load = load;
    this.loadSurvival = this.bus.power * 0.5 + this.computer.power; // heaters and brain only
    this.genRate = gen / DAY;                 // GB per minute
    this.linkRate = M.linkRate(this.radio, this.orbit);
    this.storage = this.computer.storage;

    this.period = P.periodMin(this.orbit.alt);
    this.n = (2 * Math.PI) / this.period;
    this.cosSwath = Math.cos(P.swathHalfAngle(this.orbit.alt, this.sensor.scanHalfDeg));
    this.cosContact = Math.cos(P.contactAngle(this.orbit.alt));

    // things that can change during the mission
    this.blur = this.pointing.blur;
    this.panelFactor = 1;
    this.battFactor = 1;

    // The fire season is the same for every design, so missions compare fairly.
    // Surprises depend on the mission number.
    this.fireRng = mulberry32(20261003);
    this.rng = mulberry32(this.seed * 2654435761);
    var pool = shuffle(['storm', 'wheel', 'station', 'panel'], this.rng);
    this.plan = [null, pool[0], pool[1]];
    this.events = [];

    this.stats = {
      shadowMin: 0, brownoutMin: 0, brownouts: 0, onMin: 0, totalMin: 0,
      contactMin: 0, linkCap: 0, dataGen: 0, dataDown: 0, dataLost: 0
    };
    this.allFires = [];
    this.chapter = -1;
    this.c = null;
  }

  Sim.DAY = DAY;
  Sim.STEP = STEP;
  Sim.CHAPTERS = 3;

  Sim.prototype.emit = function (type, data) {
    if (this.listener) this.listener(type, data, this);
  };

  Sim.prototype.pixelNow = function () {
    return P.pixelMeters(this.orbit.alt, this.sensor.ifov, this.blur);
  };

  /**
   * Work out the surprise before year `i` (1 or 2) and what it does to this
   * design. Returns a card for the UI; call startChapter(i) afterwards.
   */
  Sim.prototype.surprise = function (i) {
    var key = this.plan[i];
    if (!key) return null;
    var ev = D.EVENTS[key], outcome = 'good', effect = {};
    var geo = this.orbit.kind === 'geo';

    if (key === 'storm') {
      if (!this.computer.radHard) { outcome = 'bad'; effect.offlineMin = (geo ? 14 : 8) * 60; }
    } else if (key === 'wheel') {
      if (this.pointing.wheels === 0) outcome = 'none';
      else if (!this.pointing.spare) { outcome = 'bad'; effect.blur = 2; }
    } else if (key === 'station') {
      var day = P.dayGeometry(this.design.orbit);
      var others = this.network.sites.filter(function (s) { return s !== 'wallops' && day.contact[s].minutes > 0; });
      if (!others.length) outcome = this.computer.ai ? 'relay' : 'bad';
      effect.wallopsDownMin = 720;
    } else if (key === 'panel') {
      effect.panelFactor = 0.8;
      var f = P.dayGeometry(this.design.orbit).shadowFrac;
      var need = this.load * (1 + f / (M.CHARGE_EFF * (1 - f)));
      if (this.panels.watts * 0.8 < need) outcome = 'bad';
    }
    var text = ev[outcome].replace('{h}', effect.offlineMin ? effect.offlineMin / 60 : '');
    var card = {
      key: key, year: i + 1, title: ev.title, story: ev.story, outcome: outcome,
      ok: outcome !== 'bad', text: text, lesson: ev.lesson, effect: effect,
      aging: i === 2 // by year three the battery has faded
    };
    this.pending = card;
    return card;
  };

  Sim.prototype.startChapter = function (i) {
    var self = this, rng = this.fireRng;
    this.chapter = i;
    var theta0 = rng() * 2 * Math.PI;
    var c = (this.c = {
      index: i, t: 0, done: false,
      theta0: theta0, theta: theta0,
      u0: P.startAngle(this.orbit, theta0, rng()),
      batt: 0, brownout: false, dark: false, on: true,
      gen: 0, head: 0, fullWarned: false,
      offlineUntil: 0, wallopsDownUntil: 0,
      link: null, pos: [1, 0, 0], sub: [1, 0, 0],
      stations: this.network.sites.map(function (k) {
        var s = D.STATIONS[k];
        return { key: k, name: s.name, vec: P.latLonToVec(s.lat, s.lon), on: false, cloud: false, passes: 0 };
      }),
      fires: []
    });

    // apply the surprise that was announced for this year
    var card = this.pending;
    if (card && card.year === i + 1) {
      var e = card.effect;
      if (e.offlineMin) c.offlineUntil = e.offlineMin;
      if (e.blur) this.blur = Math.max(this.blur, e.blur);
      if (e.wallopsDownMin) c.wallopsDownUntil = e.wallopsDownMin;
      if (e.panelFactor) this.panelFactor = e.panelFactor;
      this.events.push(card);
      this.pending = null;
    }
    if (i === 2) this.battFactor = 0.8;
    c.batt = this.battery.wh * this.battFactor;

    // one fire per zone: 6 small, 5 medium, 3 large, in a shuffled order
    var sizes = [];
    Object.keys(D.FIRE_SIZES).forEach(function (k) { for (var j = 0; j < D.FIRE_SIZES[k].perYear; j++) sizes.push(k); });
    shuffle(sizes, rng);
    D.FIRE_ZONES.forEach(function (z, zi) {
      // a real fire: where and when NASA's MODIS saw it, and how strongly it burned
      var real = RG.NASA_FIRES.zones[zi].fires[sizes[zi]][i];
      var lat = real.lat, lon = real.lon;
      var f = {
        id: i + '-' + zi, year: i + 1, zone: zi, place: z.name, lat: lat, lon: lon,
        seenOn: real.date, frp: real.frp, seenBy: real.sat, seenAtNight: real.night,
        vec: P.latLonToVec(lat, lon), size: sizes[zi], maxPixel: D.FIRE_SIZES[sizes[zi]].maxPixel,
        tStart: 20 + rng() * (SPAWN_WINDOW - 20), state: 'waiting',
        tSpot: null, tAlert: null, delayH: null, grade: null, reason: null, via: null,
        seen: false, seenOff: false, tooSmall: false, dropped: false, queuePos: 0, relayAt: 0
      };
      c.fires.push(f);
      self.allFires.push(f);
    });
    this.emit('chapter', c);
    return c;
  };

  Sim.prototype._alert = function (f, t, via) {
    f.state = 'alerted';
    f.tAlert = t;
    f.via = via;
    f.delayH = (t - f.tStart) / 60;
    f.grade = f.delayH <= D.MISSION.fastHours ? 'fast' : f.delayH <= D.MISSION.goalHours ? 'onTime' : 'late';
    this.emit('alert', f);
  };

  /** Advance the current day by one step. */
  Sim.prototype.step = function () {
    var c = this.c;
    if (!c || c.done) return;
    var dt = STEP, st = this.stats, self = this;
    c.t += dt;
    var t = c.t;
    st.totalMin += dt;

    /* where is everything? */
    var pos = P.orbitPos(this.orbit, c.u0 + this.n * t);
    var theta = c.theta0 + P.EARTH_RATE * t;
    var sub = P.toEarthFixed(pos, theta);
    c.pos = pos; c.theta = theta; c.sub = sub;
    var dark = P.inShadow(pos, this.orbit.alt);
    c.dark = dark;
    var offline = t < c.offlineUntil;
    c.offline = offline;

    /* power */
    var cap = this.battery.wh * this.battFactor;
    var loadNow = c.brownout || offline ? this.loadSurvival : this.load;
    if (dark) {
      st.shadowMin += dt;
      c.batt -= (loadNow * dt) / 60;
    } else {
      var surplus = this.panels.watts * this.panelFactor - loadNow;
      c.batt += ((surplus > 0 ? surplus * M.CHARGE_EFF : surplus) * dt) / 60;
    }
    if (c.batt > cap) c.batt = cap;
    if (c.batt <= 0) {
      c.batt = 0;
      if (!c.brownout) { c.brownout = true; st.brownouts++; this.emit('brownout', c); }
    } else if (c.brownout && c.batt >= 0.3 * cap) {
      c.brownout = false;
      this.emit('power-back', c);
    }
    if (c.brownout) st.brownoutMin += dt;
    var on = !c.brownout && !offline;
    c.on = on;
    if (on) st.onMin += dt;

    /* pictures fill the memory */
    if (on) { var g = this.genRate * dt; c.gen += g; st.dataGen += g; }
    var stored = c.gen - c.head;
    if (stored > this.storage) {
      var extra = stored - this.storage;
      c.head += extra; st.dataLost += extra;
      c.fires.forEach(function (f) {
        if (f.state === 'spotted' && !self.computer.ai && f.queuePos <= c.head) {
          f.state = 'burning'; f.dropped = true; self.emit('deleted', f);
        }
      });
      if (!c.fullWarned) { c.fullWarned = true; this.emit('memory-full', c); }
    }

    /* ground stations */
    var link = null;
    for (var i = 0; i < c.stations.length; i++) {
      var s = c.stations[i];
      var see = P.dot(sub, s.vec) >= this.cosContact && !(s.key === 'wallops' && t < c.wallopsDownUntil);
      if (see && !s.on) {
        s.passes++;
        s.cloud = this.radio.cloud > 0 && this.rng() < this.radio.cloud;
        if (s.cloud) this.emit('cloud', s);
      }
      s.on = see;
      if (see && !s.cloud && !link) link = s;
    }
    c.link = link;
    if (link) {
      st.contactMin += dt;
      if (on) {
        st.linkCap += this.linkRate * dt;
        var send = Math.min(this.linkRate * dt, c.gen - c.head);
        c.head += send; st.dataDown += send;
        for (var k = 0; k < c.fires.length; k++) {
          var q = c.fires[k];
          if (q.state === 'spotted' && q.queuePos <= c.head + 1e-9) this._alert(q, t, link.name);
        }
      }
    }

    /* fires */
    var pixel = this.pixelNow();
    for (var j = 0; j < c.fires.length; j++) {
      var f = c.fires[j];
      if (f.state === 'waiting' && t >= f.tStart) { f.state = 'burning'; this.emit('fire', f); }
      if (f.state === 'burning' && P.dot(sub, f.vec) >= this.cosSwath) {
        f.seen = true;
        if (!on) f.seenOff = true;
        else if (pixel > f.maxPixel) f.tooSmall = true;
        else {
          f.state = 'spotted'; f.tSpot = t; f.queuePos = c.gen; f.relayAt = t + RELAY_MIN;
          this.emit('spotted', f);
        }
      }
      if (f.state === 'spotted' && this.computer.ai && t >= f.relayAt) this._alert(f, t, 'relay satellites');
    }

    if (t >= DAY) this._endChapter();
  };

  Sim.prototype._endChapter = function () {
    var c = this.c;
    c.done = true;
    c.fires.forEach(function (f) {
      if (f.state === 'alerted') return;
      f.reason = f.state === 'spotted' ? 'noLink'
        : f.dropped ? 'deleted'
        : f.tooSmall ? 'tooSmall'
        : f.seenOff ? 'off'
        : 'notSeen';
      f.state = 'missed';
      f.grade = 'missed';
    });
    this.emit('chapter-end', c);
  };

  Sim.prototype.finishChapter = function () {
    while (this.c && !this.c.done) this.step();
  };

  Sim.prototype.isOver = function () {
    return this.chapter === Sim.CHAPTERS - 1 && this.c && this.c.done;
  };

  /** Summary of the whole mission, used by the score and the report. */
  Sim.prototype.results = function () {
    var counts = { total: 0, fast: 0, onTime: 0, late: 0, missed: 0 };
    var reasons = { notSeen: 0, tooSmall: 0, off: 0, noLink: 0, deleted: 0 };
    var delaySum = 0, alerted = 0, zoneMiss = {}, zoneHit = {};
    this.allFires.forEach(function (f) {
      counts.total++;
      counts[f.grade]++;
      if (f.grade === 'missed') {
        reasons[f.reason]++;
        if (f.reason === 'notSeen') zoneMiss[f.place] = (zoneMiss[f.place] || 0) + 1;
      } else {
        delaySum += f.delayH; alerted++; zoneHit[f.place] = true;
      }
    });
    var never = Object.keys(zoneMiss).filter(function (z) { return zoneMiss[z] === Sim.CHAPTERS; });
    return {
      seed: this.seed,
      fires: this.allFires,
      counts: counts, reasons: reasons,
      avgDelayH: alerted ? delaySum / alerted : null,
      zonesNeverSeen: never,
      stats: this.stats,
      events: this.events,
      pixel: this.pixelNow(),
      blurred: this.blur > this.pointing.blur
    };
  };

  /** Fly a whole mission instantly. */
  Sim.runAll = function (design, seed) {
    var sim = new Sim(design, { seed: seed });
    for (var i = 0; i < Sim.CHAPTERS; i++) {
      if (i > 0) sim.surprise(i);
      sim.startChapter(i);
      sim.finishChapter();
    }
    return sim.results();
  };

  /* ---------- Scoring ---------- */
  var GRADE_POINTS = { fast: 1, onTime: 0.75, late: 0.35, missed: 0 };
  var SANDBOX_BUDGET = 120; // sandbox has no limit, so efficiency is judged against a normal budget

  function score(design, diffKey, res) {
    var ev = M.evaluate(design, diffKey);
    var st = res.stats, c = res.counts;

    var fireSum = 0;
    res.fires.forEach(function (f) { fireSum += GRADE_POINTS[f.grade]; });
    var science = 60 * (fireSum / c.total);

    var delivered = st.dataGen > 0
      ? Math.min(1, st.linkCap / st.dataGen, 1 - st.dataLost / st.dataGen) : 0;
    var uptime = st.onMin / st.totalMin;
    var bonus = (design.extras || []).length * (10 / 3) * delivered * uptime;

    var budget = isFinite(ev.budget) ? ev.budget : SANDBOX_BUDGET;
    var leftFrac = Math.max(0, (budget - ev.cost) / budget);
    var efficiency = 15 * Math.min(1, leftFrac / 0.25);

    var powerPts = 5 * (1 - Math.min(1, (st.brownoutMin / st.totalMin) * 4));
    var dataPts = 5 * delivered;
    var okEvents = res.events.filter(function (e) { return e.ok; }).length;
    var toughPts = res.events.length ? 5 * (okEvents / res.events.length) : 5;
    var health = powerPts + dataPts + toughPts;

    var total = Math.round(science + bonus + efficiency + health);
    var stars = total >= 75 ? 3 : total >= 55 ? 2 : total >= 35 ? 1 : 0;
    return {
      total: total, stars: stars,
      science: science, bonus: bonus, efficiency: efficiency, health: health,
      powerPts: powerPts, dataPts: dataPts, toughPts: toughPts,
      delivered: delivered, uptime: uptime, leftFrac: leftFrac,
      verdict: ['The mission fell short', 'Partial success', 'Mission success', 'Outstanding mission'][stars],
      eval: ev
    };
  }

  /* ---------- Plain-language debrief ---------- */
  function fires(n) { return n + (n === 1 ? ' fire was' : ' fires were'); }

  function listPlaces(names) {
    if (names.length <= 3) return names.join(', ');
    return names.slice(0, 3).join(', ') + ' and ' + (names.length - 3) + ' more';
  }

  function debrief(design, diffKey, res, sc) {
    var good = [], fix = [];
    var c = res.counts, r = res.reasons, st = res.stats, ev = sc.eval;
    var inTime = c.fast + c.onTime;
    var px = M.fmtPixel(res.pixel);
    var orbit = D.ORBITS[design.orbit], sensor = D.SENSORS[design.sensor];

    if (inTime >= c.total * 0.5) {
      good.push('Firefighters were warned in time for ' + inTime + ' of ' + c.total + ' fires' +
        (c.fast ? ', and ' + c.fast + ' of those warnings took under 6 hours.' : '.'));
    }
    if (res.avgDelayH != null && res.avgDelayH <= 3) {
      good.push('Warnings were quick: ' + M.fmtHours(res.avgDelayH) + ' on average from first flame to alert.');
    }
    if (st.brownouts === 0) good.push('The battery never ran flat, even on the dark side of the planet.');
    res.events.forEach(function (e) {
      if (e.outcome === 'good' || e.outcome === 'relay') good.push(e.title + ': ' + e.text);
    });
    if (sc.leftFrac >= 0.25 && isFinite(ev.budget)) {
      good.push('You finished ' + M.fmtMoney(ev.budget - ev.cost) + ' under budget. That money could build a second satellite.');
    }
    if ((design.extras || []).length && sc.delivered > 0.9) {
      good.push('Your bonus tools sent home extra science about smoke, lightning or burned land.');
    }

    if (r.notSeen) {
      var never = res.zonesNeverSeen;
      if (never.length && orbit.kind === 'geo') {
        fix.push({ step: 'orbit', title: fires(r.notSeen) + ' out of sight',
          text: 'From its parking spot over the Americas the satellite could never see ' + listPlaces(never) + '. One far-orbit satellite watches only a third of the planet. A polar orbit passes over everywhere.' });
      } else if (never.length && orbit.kind === 'leo') {
        fix.push({ step: 'orbit', title: fires(r.notSeen) + ' never flown over',
          text: 'The tilted low orbit stays near the middle of the planet, so ' + listPlaces(never) + ' never came into view. A polar orbit passes over every place on Earth.' });
      } else {
        fix.push({ step: 'sensor', title: fires(r.notSeen) + ' not seen in time',
          text: 'Your sensor sees a strip ' + Math.round(ev.swathKm).toLocaleString('en-US') + ' km wide. Earth is 40,000 km around, so it takes many laps to cover it all and some fires burned a whole day before a pass. A wider-looking sensor covers the planet faster.' });
      }
    }
    if (r.tooSmall) {
      fix.push({ step: res.blurred || ev.blur > 1 ? 'brain' : 'sensor', title: fires(r.tooSmall) + ' too small to see',
        text: 'Each pixel covered ' + px + ' of ground' + (res.blurred ? ' after the wheel failed' : ev.blur > 1 ? ' because the satellite wobbled' : '') +
          '. A fire much smaller than a pixel does not warm it enough to notice. Sharper pixels come from a better sensor, a lower orbit or steadier steering.' });
    }
    if (r.off) {
      fix.push({ step: st.brownouts ? 'power' : 'brain', title: r.off + (r.off === 1 ? ' fire' : ' fires') + ' passed below while the sensor was off',
        text: st.brownouts
          ? 'The battery ran flat ' + (st.brownouts === 1 ? 'once' : st.brownouts + ' times') + ', so the instruments shut down to save the satellite. Bigger wings or a bigger battery would keep them on.'
          : 'The computer was restarting after the solar storm. A shielded computer keeps working.' });
    } else if (st.brownouts) {
      fix.push({ step: 'power', title: 'The battery ran flat ' + (st.brownouts === 1 ? 'once' : st.brownouts + ' times'),
        text: 'Each time, the instruments switched off to save the satellite. Check the power step: the wings must run everything and refill the battery before the next shadow.' });
    }
    if (r.deleted || st.dataLost > 1) {
      fix.push({ step: 'radio', title: Math.round(st.dataLost) + ' GB of pictures were deleted',
        text: 'The memory filled up before a ground station came into view' + (r.deleted ? ', and ' + r.deleted + (r.deleted === 1 ? ' fire sighting was' : ' fire sightings were') + ' lost with it' : '') +
          '. A faster radio, more stations or a bigger memory would fix this.' });
    }
    if (r.noLink + c.late >= 3) {
      fix.push({ step: 'radio', title: (r.noLink + c.late) + ' warnings arrived too late',
        text: 'The satellite had the picture, but had to wait for a ground station before it could send it. More stations shorten the wait. The smart computer skips it by sending alerts through relay satellites.' });
    }
    res.events.forEach(function (e) {
      if (e.outcome === 'bad') fix.push({ step: e.key === 'station' ? 'radio' : e.key === 'panel' ? 'power' : 'brain', title: e.title, text: e.text + ' ' + e.lesson });
    });
    if (sc.leftFrac < 0.05 && isFinite(ev.budget)) {
      fix.push({ step: null, title: 'Almost no money left over',
        text: 'You spent nearly the whole budget. Real missions keep some in reserve, because surprises always cost something.' });
    }
    return { good: good.slice(0, 4), fix: fix.slice(0, 4) };
  }

  RG.Sim = Sim;
  RG.Score = { compute: score, debrief: debrief, GRADE_POINTS: GRADE_POINTS };
})(typeof window !== 'undefined' ? window : globalThis);
