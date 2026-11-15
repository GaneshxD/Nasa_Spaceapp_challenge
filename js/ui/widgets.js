/* Orbit Ranger — small UI building blocks for the mission designer: glossary
 * words, the numbers on an option tile, the worked-out line for the player's own
 * design, the resource gauges and the “what your sensor sees” picture.
 * Icons, drag and drop and replays live in their own files and share RG.Widgets.
 */
(function () {
  'use strict';
  var RG = window.RG, D = RG.DATA, M = RG.Model, P = RG.Physics;
  var W = RG.Widgets = RG.Widgets || {};

  W.num = function (n) { return Math.round(n).toLocaleString('en-US'); };

  // W.term() and W.terms(), which turn {key} markers into words the player can tap, are in ui/explain.js.

  /* ---------- the numbers printed on an option card ---------- */
  // the unit behind each number, so a tap on the chip explains it (js/core/terms.js)
  var CHIP_TERM = { kg: 'mass', sun: 'watt', batt: 'wh', bolt: 'watt', radio: 'mbps', disk: 'gb', coin: 'budget', up: 'altitude', moon: 'eclipse' };
  function chipNote(group, t) {
    if (t[0] === 'up') return 'This orbit is ' + t[2] + ' above the ground.';
    if (t[0] === 'moon') return t[2] === 'no shadow' ? 'This orbit never passes through Earth’s shadow.' : 'This orbit spends ' + t[2].replace(' dark', '') + ' of every lap in Earth’s shadow.';
    return 'This part ' + t[1] + ' ' + t[2] + '.';
  }
  W.chips = function (group, item) {
    var out = []; // [icon, hidden word for screen readers, value]
    if (group === 'orbit') {
      var g = P.dayGeometry(Object.keys(D.ORBITS).filter(function (k) { return D.ORBITS[k] === item; })[0]);
      out.push(['up', 'height', W.num(item.alt) + ' km']);
      out.push(['moon', 'in shadow', g.shadowFrac < 0.005 ? 'no shadow' : Math.round(g.shadowFrac * 100) + '% dark']);
    } else {
      if (item.mass != null) out.push(['kg', 'weighs', item.mass + ' kg']);
      if (item.watts != null) out.push(['sun', 'makes', W.num(item.watts) + ' W']);
      if (item.wh != null) out.push(['batt', 'holds', W.num(item.wh) + ' Wh']);
      if (item.power != null) out.push(['bolt', 'uses', item.power + ' W']);
      if (item.mbps != null) out.push(['radio', 'sends', W.num(item.mbps) + ' Mbps']);
      if (item.data != null) out.push(['disk', 'makes', item.data + ' GB/day']);
      if (item.cost != null) out.push(['coin', 'costs', M.fmtMoney(item.cost)]);
    }
    return out.map(function (t) {
      var key = CHIP_TERM[t[0]];
      return '<span class="chip" data-kind="' + t[0] + '"' + (key ? ' data-term="' + key + '" data-note="' + W.esc(chipNote(group, t)) + '"' : ' title="' + t[1] + '"') + '>' +
        W.icon(t[0]) + '<span class="sr">' + t[1] + ' </span>' + W.esc(t[2]) + '</span>';
    }).join('');
  };

  function withPick(design, group, key) {
    var t = JSON.parse(JSON.stringify(design));
    if (group === 'extras') { if (t.extras.indexOf(key) < 0) t.extras.push(key); }
    else t[group] = key;
    return t;
  }

  /**
   * One sentence, worked out for the player's own design, saying what this
   * option would mean. Returns {text, level: 'ok' | 'warn' | 'bad' | ''}.
   */
  W.liveLine = function (group, key, design, diff) {
    var t = withPick(design, group, key), ev = M.evaluate(t, diff);
    var orbit = t.orbit && D.ORBITS[t.orbit];
    var text = '', level = '';
    if (group === 'sensor') {
      var s = D.SENSORS[key], alt = orbit ? orbit.alt : 700, blur = t.pointing ? D.POINTING[t.pointing].blur : 1;
      var px = P.pixelMeters(alt, s.ifov, blur);
      text = (orbit ? 'From your orbit: ' : 'From 700 km up: ') + M.fmtPixel(px) + ' pixels, a strip ' + W.num(P.swathKm(alt, s.scanHalfDeg)) + ' km wide.';
      level = px <= 500 ? 'ok' : px <= 10000 ? 'warn' : 'bad';
    } else if (group === 'orbit') {
      var g = ev.geometry;
      text = 'One lap takes ' + (g.periodMin < 200 ? Math.round(g.periodMin) + ' minutes' : 'a whole day') + ' at ' + W.num(Math.round(g.speedKms * 3.6) * 1000) + ' km/h.';
      if (ev.pixel != null) {
        var cov = ev.coverage, seen = cov.zones - cov.neverSeen.length;
        text += ' Your sensor here: ' + M.fmtPixel(ev.pixel) + ' pixels, flies over ' + seen + ' of ' + cov.zones + ' fire zones.';
        level = !ev.sizes.length ? 'bad' : (cov.neverSeen.length || ev.sizes.indexOf('small') < 0) ? 'warn' : 'ok';
      }
    } else if (group === 'bus') {
      var b = D.BUSES[key];
      text = 'Carries ' + b.payloadCap + ' kg of instruments. Yours: ' + W.num(ev.payloadMass) + ' kg.';
      level = ev.payloadMass > b.payloadCap ? 'bad' : 'ok';
    } else if (group === 'panels') {
      var bus = t.bus && D.BUSES[t.bus];
      if (bus && bus.panels.indexOf(key) < 0) { text = 'Cannot be mounted on the ' + bus.name.toLowerCase() + '.'; level = 'bad'; }
      else {
        text = 'Your satellite needs about ' + W.num(Math.ceil(ev.genNeed / 5) * 5) + ' W from its wings.';
        level = ev.watts < ev.genNeed ? 'bad' : ev.watts * 0.8 < ev.genNeed ? 'warn' : 'ok';
      }
    } else if (group === 'battery') {
      if (ev.shadowMin < 1) { text = 'Up here there is almost no shadow, so any battery will do.'; level = 'ok'; }
      else {
        text = 'Each shadow uses about ' + W.num(Math.ceil(ev.battNeed / 5) * 5) + ' Wh.';
        level = ev.battWh < ev.battNeed ? 'bad' : ev.battWh * 0.8 < ev.battNeed ? 'warn' : 'ok';
      }
    } else if (group === 'computer') {
      var c = D.COMPUTERS[key];
      text = 'Memory: ' + c.storage + ' GB. ' + (c.radHard ? 'Safe in a solar storm.' : 'Not safe in a solar storm.');
      level = c.radHard ? 'ok' : 'warn';
    } else if (group === 'pointing') {
      if (ev.pixel != null) {
        text = 'Your pixels: ' + M.fmtPixel(ev.pixel) + (ev.blur > 1 ? ', blurred.' : ', sharp.');
        level = !ev.sizes.length ? 'bad' : ev.sizes.indexOf('small') < 0 ? 'warn' : 'ok';
      }
    } else if (group === 'radio') {
      var per = ev.linkRate * 10;
      text = 'Sends ' + (per < 10 ? Math.round(per * 10) / 10 : W.num(per)) + ' GB in a 10-minute pass' + (orbit && orbit.kind === 'geo' ? ' (far orbit: one tenth speed)' : '') + '.';
      if (t.network) {
        text += ' About ' + W.num(ev.downPerDay) + ' GB a day with your stations. You make ' + W.num(ev.dataGen) + '.';
        level = ev.downPerDay < ev.dataGen ? 'bad' : 'ok';
      } else text += ' Your instruments make ' + W.num(ev.dataGen) + ' GB a day.';
    } else if (group === 'network') {
      if (ev.contact) {
        text = 'Station time: ' + W.num(ev.contact.minutesPerDay) + ' minutes a day. Longest wait: ' + M.fmtHours(ev.contact.maxGapMin / 60) + '.';
        if (t.radio) {
          text += ' Can send ' + W.num(ev.downPerDay) + ' GB a day. You make ' + W.num(ev.dataGen) + '.';
          level = ev.downPerDay < ev.dataGen ? 'bad' : 'ok';
        }
      }
    } else if (group === 'rocket') {
      if (!orbit) return { text: '', level: '' };
      if (ev.cap == null) { text = 'Does not fly to the ' + orbit.short.toLowerCase() + '.'; level = 'bad'; }
      else {
        text = 'Lifts ' + W.num(ev.cap) + ' kg to your orbit. Your satellite: ' + W.num(ev.mass) + ' kg.';
        level = ev.mass > ev.cap ? 'bad' : 'ok';
      }
    }
    return { text: text, level: level };
  };

  /* ---------- resource gauges ---------- */
  var METER_ICON = { Money: 'coin', Mass: 'kg', Power: 'bolt', Data: 'disk', Sharpness: 'eye' };
  var METER_TERM = { Money: 'budget', Mass: 'mass', Power: 'watt', Data: 'downlink', Sharpness: 'pixel' }; // what a tap on each gauge explains
  function meter(name, big, small, frac, level) {
    var pct = frac == null ? 0 : Math.max(3, Math.min(100, frac * 100));
    var word = { ok: 'OK', tight: 'Tight', over: 'Too much', idle: '' }[level];
    return '<div class="meter" data-level="' + level + '" data-term="' + METER_TERM[name] + '" data-note="' + W.esc(big + ', ' + small + '.') + '" tabindex="0" role="button">' +
      '<div class="meter-top"><span class="meter-ico">' + W.icon(METER_ICON[name]) + '</span><span class="meter-name">' + name + '</span><span class="meter-state">' + word + '</span></div>' +
      '<div class="meter-num">' + big + '</div>' +
      '<div class="meter-bar"><i style="width:' + pct.toFixed(0) + '%"></i></div>' +
      '<div class="meter-sub">' + small + '</div></div>';
  }
  function lvl(use, have, tight) { return use > have ? 'over' : use > have * (tight || 0.8) ? 'tight' : 'ok'; }

  W.gauges = function (ev, d) {
    var out = '';
    if (isFinite(ev.budget)) {
      out += meter('Money', M.fmtMoney(ev.cost), 'of ' + M.fmtMoney(ev.budget), ev.cost / ev.budget, lvl(ev.cost, ev.budget, 0.95));
    } else out += meter('Money', M.fmtMoney(ev.cost), 'no limit in sandbox', null, 'idle');

    if (ev.cap != null) out += meter('Mass', W.num(ev.mass) + ' kg', 'rocket lifts ' + W.num(ev.cap) + ' kg', ev.mass / ev.cap, lvl(ev.mass, ev.cap, 0.97));
    else out += meter('Mass', W.num(ev.mass) + ' kg', d.rocket && d.orbit ? 'rocket cannot reach this orbit' : 'rocket comes last', null, d.rocket && d.orbit ? 'over' : 'idle');

    if (d.panels) out += meter('Power', 'needs ' + W.num(Math.ceil(ev.genNeed / 5) * 5) + ' W', 'wings make ' + W.num(ev.watts) + ' W', ev.genNeed / ev.watts, lvl(ev.genNeed, ev.watts));
    else out += meter('Power', 'uses ' + W.num(ev.load) + ' W', 'wings come later', null, 'idle');

    if (d.radio && d.network && d.orbit) out += meter('Data', W.num(ev.dataGen) + ' GB a day', 'radio sends ' + W.num(ev.downPerDay), ev.dataGen / Math.max(ev.downPerDay, 0.01), lvl(ev.dataGen, ev.downPerDay, 0.9));
    else out += meter('Data', W.num(ev.dataGen) + ' GB a day', 'radio comes later', null, 'idle');

    if (ev.pixel != null) {
      var see = !ev.sizes.length ? 'no fires visible' : ev.sizes.indexOf('small') >= 0 ? 'sees small fires' : ev.sizes.indexOf('medium') >= 0 ? 'medium fires and up' : 'large fires only';
      var lv = !ev.sizes.length ? 'over' : ev.sizes.indexOf('small') >= 0 ? 'ok' : 'tight';
      out += meter('Sharpness', M.fmtPixel(ev.pixel) + ' pixels', see, Math.min(1, 500 / ev.pixel), lv).replace('Too much', 'Too blurry').replace('Tight', 'Blurry');
    } else out += meter('Sharpness', 'not known yet', 'needs a sensor and an orbit', null, 'idle');
    return out;
  };

  /* ---------- “what your sensor sees” ---------- */
  var SCENE_W = 6000, SCENE_H = 4600; // metres of ground shown
  var FIRES = [
    { key: 'small', x: 1150, y: 3500, d: 170 },
    { key: 'medium', x: 2300, y: 1350, d: 620 },
    { key: 'large', x: 4300, y: 2800, d: 1750 }
  ];

  /** Draw the real scene (left) and the satellite's heat picture (right). */
  W.drawSight = function (canvas, pixelM) {
    var g = canvas.getContext('2d'), CW = canvas.width, CH = canvas.height;
    var gap = 16, w = (CW - gap) / 2, h = CH, k = w / SCENE_W;
    var rnd = RG.Stage.seeded(5);
    g.clearRect(0, 0, CW, CH);

    // left: the ground as a person in a plane would see it
    g.save();
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    g.fillStyle = '#31452e'; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 70; i++) {
      g.fillStyle = rnd() > 0.5 ? 'rgba(20,40,20,0.35)' : 'rgba(120,130,70,0.22)';
      g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 40, 6 + rnd() * 22, rnd() * 3, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(110,160,200,0.8)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-5, h * 0.2); g.bezierCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.05, w + 5, h * 0.42); g.stroke();
    FIRES.forEach(function (f) {
      var r = Math.max(2.5, (f.d / 2) * k), x = f.x * k, y = f.y * k;
      var gr = g.createRadialGradient(x, y, 0, x, y, r * 1.5);
      gr.addColorStop(0, '#fff4b8'); gr.addColorStop(0.45, '#ff8a1e'); gr.addColorStop(1, 'rgba(160,30,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.5, 0, 7); g.fill();
      g.font = 'bold ' + Math.round(h * 0.085) + 'px sans-serif'; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.fillStyle = '#fff';
      var ty = y - r * 1.5 - 6 < 20 ? y + r * 1.5 + 22 : y - r * 1.5 - 6;
      g.strokeText(f.key, x, ty); g.fillText(f.key, x, ty);
    });
    g.restore();

    // right: what the heat sensor records, one square per pixel
    var x0 = w + gap, cell = Math.max(3, pixelM * k);
    g.save();
    g.beginPath(); g.rect(x0, 0, w, h); g.clip();
    for (var cy = 0; cy < h; cy += cell) {
      for (var cx = 0; cx < w; cx += cell) {
        var heat = 0;
        for (var j = 0; j < FIRES.length; j++) {
          var f = FIRES[j];
          if (pixelM > D.FIRE_SIZES[f.key].maxPixel) continue;
          var fx = f.x * k, fy = f.y * k, fr = Math.max(1.5, (f.d / 2) * k);
          var nx = Math.max(cx, Math.min(fx, cx + cell)), ny = Math.max(cy, Math.min(fy, cy + cell));
          if ((nx - fx) * (nx - fx) + (ny - fy) * (ny - fy) <= fr * fr) {
            heat = Math.max(heat, Math.min(1, 0.4 + 0.6 * (f.d / pixelM)));
          }
        }
        if (heat > 0) {
          var a = Math.round(120 + 120 * heat), b = Math.round(40 + 190 * heat * heat);
          g.fillStyle = 'rgb(255,' + a + ',' + b + ')';
        } else {
          var n = Math.round(rnd() * 10);
          g.fillStyle = 'rgb(' + (22 + n) + ',' + (30 + n) + ',' + (62 + n) + ')';
        }
        g.fillRect(x0 + cx, cy, cell + 0.5, cell + 0.5);
      }
    }
    if (cell >= 10) {
      g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 1;
      g.beginPath();
      for (var gx = 0; gx <= w; gx += cell) { g.moveTo(x0 + gx, 0); g.lineTo(x0 + gx, h); }
      for (var gy = 0; gy <= h; gy += cell) { g.moveTo(x0, gy); g.lineTo(x0 + w, gy); }
      g.stroke();
    }
    g.restore();
  };

})();
