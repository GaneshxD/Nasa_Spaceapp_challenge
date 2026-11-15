/* Orbit Ranger — design checker.
 * Takes a (possibly unfinished) design and works out its mass, power, cost
 * and data budgets, what its sensor can see, and a list of checks used by the
 * dashboard, the coach and the Go / No-go review.
 */
(function (root) {
  'use strict';
  var RG = (root.RG = root.RG || {});
  var D = RG.DATA, P = RG.Physics;

  var M = {};
  var CHARGE_EFF = 0.9;        // batteries give back about 90% of what goes in
  var GEO_LINK = 0.1;          // from far orbit the signal is weak: one tenth the speed
  var MBPS_TO_GB_MIN = 0.0075; // 1 Mbps for one minute = 0.0075 GB

  M.CHARGE_EFF = CHARGE_EFF;

  /** Usable radio speed in GB per minute of contact. */
  M.linkRate = function (radio, orbit) {
    return radio.mbps * MBPS_TO_GB_MIN * (orbit && orbit.kind === 'geo' ? GEO_LINK : 1);
  };

  M.fmtMoney = function (m) {
    if (!isFinite(m)) return 'no limit';
    return '$' + (Math.round(m * 10) / 10) + 'M';
  };
  M.fmtPixel = function (m) {
    return m >= 1000 ? (Math.round(m / 100) / 10) + ' km' : Math.round(m / 10) * 10 + ' m';
  };
  M.fmtHours = function (h) {
    if (!isFinite(h)) return 'never';
    if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min';
    if (h < 48) return (Math.round(h * 10) / 10) + ' h';
    return Math.round(h / 24) + ' days';
  };

  /** Every chosen part as a flat list: [{slot, key, item}] */
  M.parts = function (d) {
    var out = [];
    function add(slot, table, key) { if (key && D[table][key]) out.push({ slot: slot, key: key, item: D[table][key] }); }
    add('sensor', 'SENSORS', d.sensor);
    (d.extras || []).forEach(function (k) { add('extra', 'EXTRAS', k); });
    add('bus', 'BUSES', d.bus);
    add('panels', 'PANELS', d.panels);
    add('battery', 'BATTERIES', d.battery);
    add('computer', 'COMPUTERS', d.computer);
    add('pointing', 'POINTING', d.pointing);
    add('radio', 'RADIOS', d.radio);
    return out;
  };

  M.isComplete = function (d) {
    return !!(d.sensor && d.orbit && d.bus && d.panels && d.battery && d.computer &&
      d.pointing && d.radio && d.network && d.rocket);
  };

  M.stepDone = function (d, step) {
    return step.groups.every(function (g) { return g.pick === 'any' || !!d[g.key]; });
  };

  M.evaluate = function (d, diffKey) {
    var diff = D.DIFFICULTY[diffKey || 'engineer'];
    var parts = M.parts(d);
    var sensor = d.sensor && D.SENSORS[d.sensor];
    var orbit = d.orbit && D.ORBITS[d.orbit];
    var bus = d.bus && D.BUSES[d.bus];
    var panels = d.panels && D.PANELS[d.panels];
    var battery = d.battery && D.BATTERIES[d.battery];
    var computer = d.computer && D.COMPUTERS[d.computer];
    var pointing = d.pointing && D.POINTING[d.pointing];
    var radio = d.radio && D.RADIOS[d.radio];
    var network = d.network && D.NETWORKS[d.network];
    var rocket = d.rocket && D.ROCKETS[d.rocket];
    var geo = orbit ? P.dayGeometry(d.orbit) : null;

    /* --- mass --- */
    var mass = 0, payloadMass = 0;
    parts.forEach(function (p) {
      mass += p.item.mass;
      if (p.slot === 'sensor' || p.slot === 'extra') payloadMass += p.item.mass;
    });

    /* --- cost --- */
    var cost = D.MISSION.opsCost;
    var costItems = [{ label: 'Mission control team, 3 years', cost: D.MISSION.opsCost }];
    parts.forEach(function (p) { cost += p.item.cost; costItems.push({ label: p.item.name, cost: p.item.cost }); });
    if (network) { cost += network.cost; costItems.push({ label: network.name, cost: network.cost }); }
    if (rocket) { cost += rocket.cost; costItems.push({ label: rocket.name, cost: rocket.cost }); }
    var budget = diff.budget;

    /* --- power --- */
    var load = 0;
    parts.forEach(function (p) { if (p.item.power) load += p.item.power; });
    var f = geo ? geo.shadowFrac : 0.36; // assume a low orbit until one is chosen
    var shadowMin = geo ? geo.shadowMaxMin : 35;
    var genNeed = load * (1 + f / (CHARGE_EFF * (1 - f)));
    var battNeed = load * (shadowMin / 60);

    /* --- data --- */
    var dataGen = 0;
    parts.forEach(function (p) { if (p.item.data) dataGen += p.item.data; });
    var contact = orbit && network ? P.networkContact(d.orbit, d.network) : null;
    var rate = radio ? M.linkRate(radio, orbit) : 0;
    var downPerDay = contact ? rate * contact.minutesPerDay * (1 - (radio ? radio.cloud : 0)) : 0;
    var storeNeed = contact ? dataGen * (contact.maxGapMin / 1440) : 0;

    /* --- what the sensor sees --- */
    var blur = pointing ? pointing.blur : 1;
    var pixel = sensor && orbit ? P.pixelMeters(orbit.alt, sensor.ifov, blur) : null;
    var swath = sensor && orbit ? P.swathKm(orbit.alt, sensor.scanHalfDeg) : null;
    var cov = sensor && orbit ? P.coverage(d.orbit, d.sensor) : null;
    var sizes = [];
    if (pixel != null) {
      ['small', 'medium', 'large'].forEach(function (k) { if (pixel <= D.FIRE_SIZES[k].maxPixel) sizes.push(k); });
    }

    /* --- launch --- */
    var cap = rocket && orbit ? rocket.cap[orbit.kind] : null;

    /* --- checks --- */
    var checks = [];
    function check(id, area, step, level, title, text) {
      checks.push({ id: id, area: area, step: step, level: level, title: title, text: text });
    }

    if (sensor && orbit) {
      var px = M.fmtPixel(pixel);
      var wob = blur > 1 ? ' Magnetic steering wobbles, which doubles the blur.' : '';
      if (!sizes.length) {
        check('sight', 'science', blur > 1 ? 'brain' : 'orbit', 'watch', 'Too blurry to see fires',
          'From ' + orbit.alt.toLocaleString('en-US') + ' km each pixel covers ' + px + ' of ground. Even a large fire disappears inside one pixel.' + wob);
      } else if (sizes.indexOf('small') < 0) {
        check('sight', 'science', blur > 1 ? 'brain' : 'sensor', 'watch', 'Small fires are invisible',
          'Each pixel covers ' + px + '. Small fires need pixels of 500 m or less, so you will only spot ' +
          (sizes.indexOf('medium') >= 0 ? 'medium and large' : 'large') + ' fires.' + wob);
      } else {
        check('sight', 'science', 'sensor', 'go', 'Sharp enough for small fires', 'Each pixel covers ' + px + ' of ground.');
      }
      if (cov.neverSeen.length) {
        var few = cov.neverSeen.slice(0, 3).join(', ') + (cov.neverSeen.length > 3 ? ' and ' + (cov.neverSeen.length - 3) + ' more' : '');
        check('coverage', 'science', 'orbit', 'watch', cov.neverSeen.length + ' fire zones are never seen',
          (orbit.kind === 'geo' ? 'From its parking spot the satellite cannot see ' : 'This path never passes over ') + few + '.');
      } else if (!cov.stare && cov.revisitHours > 13) {
        check('coverage', 'science', 'sensor', 'watch', 'Long waits between looks',
          'The strip you see is ' + Math.round(swath).toLocaleString('en-US') + ' km wide, so each fire zone is seen only about every ' +
          M.fmtHours(cov.revisitHours) + '. A fire can grow a lot in that time.');
      } else {
        check('coverage', 'science', 'orbit', 'go', 'Every fire zone is covered',
          cov.stare ? 'The satellite stares at its zones all day.' : 'Each zone is seen about every ' + M.fmtHours(cov.revisitHours) + '.');
      }
    }

    if (bus && sensor) {
      if (payloadMass > bus.payloadCap) {
        check('payloadFit', 'body', 'bus', 'nogo', 'Instruments do not fit',
          'Your instruments have a mass of ' + Math.round(payloadMass) + ' kg. The ' + bus.name.toLowerCase() + ' can carry ' + bus.payloadCap + ' kg.');
      } else {
        check('payloadFit', 'body', 'bus', 'go', 'Instruments fit on the body',
          Math.round(payloadMass) + ' kg of instruments on a body that can carry ' + bus.payloadCap + ' kg.');
      }
    }
    if (bus && panels && bus.panels.indexOf(d.panels) < 0) {
      check('panelFit', 'body', 'power', 'nogo', 'Wings do not match the body',
        panels.name + ' cannot be mounted on the ' + bus.name.toLowerCase() + '.');
    }

    if (panels && load > 0) {
      var needW = Math.ceil(genNeed / 5) * 5;
      if (panels.watts < genNeed) {
        check('powerGen', 'power', 'power', 'watch', 'Not enough solar power',
          'The satellite needs about ' + needW + ' W from its wings (it uses ' + Math.round(load) + ' W, and must refill the battery too). These wings make ' + panels.watts + ' W.');
      } else if (panels.watts * 0.8 < genNeed) {
        check('powerGen', 'power', 'power', 'watch', 'Power is just enough',
          'Needs about ' + needW + ' W, wings make ' + panels.watts + ' W. There is almost no margin if a wing is damaged.');
      } else {
        check('powerGen', 'power', 'power', 'go', 'Plenty of solar power', 'Needs about ' + needW + ' W, wings make ' + panels.watts + ' W.');
      }
    }
    if (battery && load > 0 && orbit) {
      var needWh = Math.ceil(battNeed / 5) * 5;
      if (shadowMin < 1) {
        check('battery', 'power', 'power', 'go', 'Hardly any shadow up here',
          'In far orbit the satellite is in sunlight nearly all year. (Short shadows come around March and September.)');
      } else if (battery.wh < battNeed) {
        check('battery', 'power', 'power', 'watch', 'Battery too small for the shadow',
          'Each lap has up to ' + Math.round(shadowMin) + ' minutes of darkness, which takes ' + needWh + ' Wh. This battery holds ' + battery.wh + ' Wh.');
      } else if (battery.wh * 0.8 < battNeed) {
        check('battery', 'power', 'power', 'watch', 'Battery is just big enough',
          'Fine today (' + needWh + ' Wh needed, ' + battery.wh + ' Wh on board), but batteries fade after years in space.');
      } else {
        check('battery', 'power', 'power', 'go', 'Battery lasts through the shadow',
          needWh + ' Wh needed for ' + Math.round(shadowMin) + ' minutes of darkness, ' + battery.wh + ' Wh on board.');
      }
    }

    if (radio && network && orbit && dataGen > 0) {
      var g = Math.round(dataGen), dn = downPerDay < 10 ? Math.round(downPerDay * 10) / 10 : Math.round(downPerDay);
      if (downPerDay < dataGen) {
        check('dataLink', 'data', 'radio', 'watch', 'Radio cannot keep up',
          'The instruments make ' + g + ' GB a day. In ' + Math.round(contact.minutesPerDay) + ' minutes of station time a day, this radio sends ' + dn + ' GB. Pictures will pile up and be deleted.');
      } else {
        check('dataLink', 'data', 'radio', 'go', 'Radio keeps up with the instruments',
          'Makes ' + g + ' GB a day, can send ' + dn.toLocaleString('en-US') + ' GB a day.');
      }
    }
    if (computer && contact && dataGen > 0 && computer.storage < storeNeed) {
      check('storage', 'data', 'brain', 'watch', 'Memory fills between passes',
        'The longest wait for a station is ' + M.fmtHours(contact.maxGapMin / 60) + '. That is ' + Math.round(storeNeed) + ' GB of pictures, but the computer holds ' + computer.storage + ' GB.');
    }
    if (computer && !computer.radHard) {
      check('radiation', 'data', 'brain', 'watch', 'Computer is not shielded',
        orbit && orbit.kind === 'geo'
          ? 'Far orbit sits inside a belt of strong radiation. A solar storm will knock this computer out for a long time.'
          : 'A solar storm could crash this computer and wipe its memory.');
    }

    if (rocket && orbit) {
      if (cap == null) {
        check('rocketReach', 'launch', 'rocket', 'nogo', 'This rocket cannot reach your orbit',
          'The ' + rocket.name.toLowerCase() + ' does not fly to ' + orbit.name.toLowerCase() + '.');
      } else if (mass > cap) {
        check('rocketMass', 'launch', 'rocket', 'nogo', 'Too heavy for this rocket',
          'Your satellite is ' + Math.round(mass) + ' kg. The ' + rocket.name.toLowerCase() + ' can lift ' + cap.toLocaleString('en-US') + ' kg to ' + orbit.name.toLowerCase() + '.');
      } else {
        check('rocketMass', 'launch', 'rocket', 'go', 'The rocket can lift it',
          Math.round(mass) + ' kg satellite, ' + cap.toLocaleString('en-US') + ' kg lifting power to this orbit.');
      }
    }

    if (isFinite(budget)) {
      if (cost > budget) {
        check('budget', 'budget', null, 'nogo', 'Over budget',
          'The mission costs ' + M.fmtMoney(cost) + ' and the budget is ' + M.fmtMoney(budget) + '. Something has to go.');
      } else if (M.isComplete(d)) {
        check('budget', 'budget', null, 'go', 'Inside the budget', M.fmtMoney(budget - cost) + ' left over.');
      }
    }

    /* --- a rough guess at how long a warning takes --- */
    var alertHours = null;
    if (cov && computer && contact) {
      var look = cov.stare ? 0.1 : cov.revisitHours / 2;
      var send = computer.ai ? 0.2 : (contact.maxGapMin / 60) / 2;
      alertHours = look + send;
    }

    return {
      mass: mass, payloadMass: payloadMass,
      cost: cost, costItems: costItems, budget: budget, left: budget - cost,
      load: load, watts: panels ? panels.watts : 0, genNeed: genNeed,
      battWh: battery ? battery.wh : 0, battNeed: battNeed, shadowMin: shadowMin, shadowFrac: f,
      dataGen: dataGen, downPerDay: downPerDay, storage: computer ? computer.storage : 0, storeNeed: storeNeed,
      contact: contact, linkRate: rate,
      pixel: pixel, swathKm: swath, sizes: sizes, coverage: cov, blur: blur,
      cap: cap, geometry: geo, alertHours: alertHours,
      checks: checks,
      blocked: checks.filter(function (c) { return c.level === 'nogo'; }),
      watch: checks.filter(function (c) { return c.level === 'watch'; })
    };
  };

  /* ---------- Share codes: a whole design in 14 characters ---------- */
  var SLOTS = [
    ['sensor', 'SENSORS'], ['orbit', 'ORBITS'], ['bus', 'BUSES'], ['panels', 'PANELS'], ['battery', 'BATTERIES'],
    ['computer', 'COMPUTERS'], ['pointing', 'POINTING'], ['radio', 'RADIOS'], ['network', 'NETWORKS'], ['rocket', 'ROCKETS']
  ];
  M.encode = function (d) {
    var s = SLOTS.map(function (sl) {
      var i = Object.keys(D[sl[1]]).indexOf(d[sl[0]]);
      return i < 0 ? 'x' : String(i);
    }).join('');
    var bits = 0;
    Object.keys(D.EXTRAS).forEach(function (k, i) { if ((d.extras || []).indexOf(k) >= 0) bits |= 1 << i; });
    return 'OR-' + s + bits;
  };
  M.decode = function (code) {
    var m = /^OR-([0-9x]{10})([0-7])$/.exec(String(code || '').trim());
    if (!m) return null;
    var d = RG.blankDesign(), ok = true;
    SLOTS.forEach(function (sl, i) {
      var ch = m[1][i];
      if (ch === 'x') return;
      var key = Object.keys(D[sl[1]])[+ch];
      if (!key) ok = false; else d[sl[0]] = key;
    });
    if (!ok) return null;
    var bits = +m[2];
    Object.keys(D.EXTRAS).forEach(function (k, i) { if (bits & (1 << i)) d.extras.push(k); });
    return d;
  };

  RG.Model = M;
})(typeof window !== 'undefined' ? window : globalThis);
