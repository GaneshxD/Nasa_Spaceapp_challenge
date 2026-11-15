/* Orbit Ranger — Level 2: build the rocket.
 * Drag fuel tanks, engines and boosters onto their slots, watch the lift-off
 * power, fuel and coin meters, then run a test flight on the computer.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE;
  var F = RG.Flight, Stage = RG.Stage, R = RG.Rocket, A = RG.Audio, W = RG.Widgets;
  var K = RG.LevelKit, Pg = RG.Progress, num = W.num;
  var say = K.say, bar = K.bar, side = K.side, hud = K.hud, sheet = K.sheet, hideSheet = K.hideSheet;
  var complete = K.complete, DEFAULT_SAT = K.DEFAULT_SAT;
  var SHORT = { S: 'Small', M: 'Medium', L: 'Large', E2: '2', E3: '3', E4: '4', none: 'None', two: 'Two' }; // labels on the tiles;
  var TERM = { tank: 'propellant', engines: 'engine', boosters: 'booster' };
  var ASK = { tank: 'Bigger tanks hold more propellant. That is more speed, and more weight.', engines: 'More engines give more thrust, and cost more.', boosters: 'Boosters add a huge push for two minutes, then become dead weight.' };
  RG.LevelDefs = RG.LevelDefs || {};

  RG.LevelDefs[2] = function () {
    var b = { tank: null, engines: null, boosters: null };
    var GROUPS = [['tank', 'Fuel tanks', F.TANKS, 'lh2'], ['engines', 'Engines', F.ENGINES, 'engines'], ['boosters', 'Boosters', F.BOOSTERS, 'boosters']];
    R.setBuild({ satellite: DEFAULT_SAT });
    K.App.view('rk-build');
    say('Pick your {propellant} tanks. Tap one, or drag it onto the rocket.');
    draw();

    function art(g, k) { // a picture of the option: tank size, number of engines, boosters or none
      if (g === 'tank') return '<span class="t-art t-' + k + '">' + W.icon('tank') + '</span>';
      if (g === 'engines') return '<span class="t-art t-n">' + new Array(F.ENGINES[k].n + 1).join(W.icon('engine')) + '</span>';
      return '<span class="t-art">' + (k === 'two' ? W.icon('booster') + W.icon('booster') : W.icon('none')) + '</span>';
    }
    /** The nearest rocket that reaches orbit: fewest parts changed, then cheapest. */
    function suggest() {
      var best = null;
      Object.keys(F.TANKS).forEach(function (t) { Object.keys(F.ENGINES).forEach(function (e) { Object.keys(F.BOOSTERS).forEach(function (bo) {
        var c = { tank: t, engines: e, boosters: bo }, ev = F.evaluate(c);
        var changed = GROUPS.filter(function (g) { return c[g[0]] !== b[g[0]]; });
        var rank = changed.length * 1000 + ev.cost;
        if (ev.tw >= 1 && (!best || rank < best.rank) && F.testFlight(c).ok) {
          best = { rank: rank, build: c, label: changed.map(function (g) { return g[2][c[g[0]]].name.toLowerCase(); }).join(' + ') };
        }
      }); }); });
      return best;
    }
    function place(g, k) {
      var top = document.getElementById('lv-side').scrollTop;
      b[g] = k;
      A.play('pick');
      R.setBuild({ tank: b.tank, engines: b.engines, boosters: b.boosters, top: !!full(), satellite: DEFAULT_SAT },
        g === 'tank' ? 'lh2' : g === 'engines' ? 'engines' : b.boosters === 'two' ? 'boosters' : 'nose');
      Stage.look({ target: new THREE.Vector3(0, R.height * 0.5, 0), radius: R.height * 2.1 + 44 });
      var weak = b.tank && b.engines && F.evaluate(b).tw < 1;
      var ev2 = b.tank && b.engines ? F.evaluate(b) : null;
      say(!b.engines ? 'Tanks on. Now the {engine|engines}: their {thrust} has to beat the rocket’s {weight}.'
        : weak ? 'Too heavy to lift off! The {twr} must be more than 1[[, and it is ' + ev2.tw.toFixed(2) + ']]. Add thrust, or carry less.'
        : !b.boosters ? 'Thrust beats weight[[: the {twr} is ' + ev2.tw.toFixed(2) + ']]. Now, {booster|boosters} or not? They add thrust, mass and cost.'
        : 'Ready. Run a test flight to see if it reaches {orbitalv|orbital velocity}.',
        weak ? 'worry' : full() ? 'cheer' : 'happy');
      draw();
      document.getElementById('lv-side').scrollTop = top;
      var again = document.querySelector('.tile[data-group="' + g + '"][data-key="' + k + '"]');
      if (again) again.focus({ preventScroll: true });
    }

    function full() { return b.tank && b.engines && b.boosters; }
    /** What the pick means for this rocket, in numbers. */
    function means(g, ev) {
      if (g === 'tank') return 'More {propellant} means more speed at the end, and more {weight} to lift at the start.'.replace(/\{(\w+)\}/g, function (m, k) { return W.term(k); });
      if (!ev) return '';
      if (g === 'engines') return 'Together they push with ' + num(ev.n * F.RS25.sl / 1000) + ' kN of ' + W.term('thrust') + ' at lift-off.';
      return ev.boost.thrust ? 'They add ' + num(ev.boost.thrust / 1000) + ' kN of thrust and ' + num(ev.boost.prop + ev.boost.dry) + ' t of mass.' : 'Nothing to drop on the way up, and ' + F.BOOSTERS.two.cost + ' coins saved.';
    }
    function draw() {
      var ev = b.tank && b.engines ? F.evaluate(b) : null, html = '';
      GROUPS.forEach(function (g, gi) {
        var locked = gi > 0 && !b[GROUPS[gi - 1][0]];
        html += '<fieldset class="tiles"' + (locked ? ' disabled' : '') + '><legend>' + W.term(TERM[g[0]], g[1]) + '</legend>' +
          Object.keys(g[2]).map(function (k) {
            return '<button type="button" class="tile" data-lv="pick" data-drag="' + g[0] + '" data-group="' + g[0] + '" data-key="' + k + '" aria-pressed="' + (b[g[0]] === k) + '" aria-label="' + g[2][k].name + ', ' + g[2][k].cost + ' coins">' +
              art(g[0], k) + '<b>' + SHORT[k] + '</b><span class="coin">' + g[2][k].cost + '</span></button>';
          }).join('') + '</fieldset>' + (b[g[0]] ? '<p class="pick-note"><b>' + g[2][b[g[0]]].name + '.</b> ' + g[2][b[g[0]]].blurb + ' ' + means(g[0], ev) + '</p>' : locked ? '' : '<p class="pick-note is-ask">' + ASK[g[0]] + '</p>');
      });
      var cost = (b.tank ? F.TANKS[b.tank].cost : 0) + (b.engines ? F.ENGINES[b.engines].cost : 0) + (b.boosters ? F.BOOSTERS[b.boosters].cost : 0) + F.UPPER.cost;
      var tw = ev ? ev.tw : 0, lift = !ev ? 'idle' : tw < 1 ? 'over' : tw < 1.2 ? 'tight' : 'ok';
      // three meters, each named as an engineer would name it; tap one to read what it is and why it matters
      var meters = '<div class="build-meters">' +
        '<button type="button" class="bm" data-term="twr" data-level="' + lift + '"' + (ev ? ' data-note="Thrust ' + num(ev.thrust0 / 1000) + ' kN ÷ weight ' + num(ev.mass0 * F.G0) + ' kN = ' + tw.toFixed(2) + '."' : '') + '><span>Thrust-to-weight</span><b>' + (ev ? tw.toFixed(2) + (tw < 1 ? ' · too weak' : tw < 1.2 ? ' · just enough' : ' · strong') : 'needs engines') + '</b>' +
        '<div class="bm-bar"><i style="width:' + Math.min(100, tw / 2 * 100).toFixed(0) + '%"></i><em style="left:50%"></em></div><small>' + (ev ? 'must be more than 1' : 'thrust must beat weight') + '</small></button>' +
        '<button type="button" class="bm" data-term="propellant" data-level="' + (b.tank ? 'ok' : 'idle') + '"' + (ev ? ' data-note="' + num(ev.lox) + ' t of liquid oxygen and ' + num(ev.lh2) + ' t of liquid hydrogen: 6 parts to 1, by mass."' : '') + '><span>Propellant</span><b>' + (b.tank ? num(F.TANKS[b.tank].prop) + ' t' : 'no tanks yet') + '</b>' +
        '<div class="bm-bar two"><i class="ox" style="width:' + (b.tank ? 86 * F.TANKS[b.tank].prop / 700 : 0).toFixed(0) + '%"></i><i class="h2" style="width:' + (b.tank ? 14 * F.TANKS[b.tank].prop / 700 : 0).toFixed(0) + '%"></i></div><small>' + (ev ? num(ev.lox) + ' t LOX, ' + num(ev.lh2) + ' t LH2' : 'oxygen and hydrogen') + '</small></button>' +
        '<button type="button" class="bm" data-term="budget" data-level="' + (cost > F.BUDGET ? 'over' : 'ok') + '" data-note="This rocket costs ' + cost + ' coins, including ' + F.UPPER.cost + ' for the upper stage and nose cone."><span>Budget</span><b>' + cost + ' of ' + F.BUDGET + '</b>' +
        '<div class="bm-bar"><i style="width:' + Math.min(100, cost / F.BUDGET * 100).toFixed(0) + '%"></i></div><small>' + (cost > F.BUDGET ? (cost - F.BUDGET) + ' coins over' : (F.BUDGET - cost) + ' coins left') + '</small></button></div>';
      side(meters + html + '<button type="button" class="btn primary big wide" data-lv="test"' + (full() ? '' : ' disabled') + '>Test flight</button>');
      bar((b.tank ? 0.25 : 0) + (b.engines ? 0.25 : 0) + (b.boosters ? 0.25 : 0));
      hud(W.dock(GROUPS.map(function (g) {
        var k = b[g[0]];
        return { key: g[0], label: g[1], icon: g[0] === 'tank' ? 'tank' : g[0] === 'engines' ? 'engine' : 'booster',
          items: k ? [{ icon: g[0] === 'tank' ? 'tank' : g[0] === 'engines' ? 'engine' : k === 'two' ? 'booster' : 'none', name: g[2][k].name }] : [] };
      })));
    }
    return {
      pick: function (el) { place(el.dataset.group, el.dataset.key); }, // a tap picks; a drag onto the rocket ends in the same click
      tryfix: function () { // swap in the suggested parts, one at a time so each one pops onto the rocket
        var fix = suggest();
        hideSheet();
        GROUPS.forEach(function (g) { if (fix.build[g[0]] !== b[g[0]]) place(g[0], fix.build[g[0]]); });
      },
      test: function () {
        var ev = F.evaluate(b), res = F.testFlight(b), inBudget = ev.cost <= F.BUDGET, why = '';
        if (ev.tw < 1) why = 'Too heavy. The engines push with ' + num(ev.thrust0 / 1000) + ' kN, and the rocket weighs ' + num(ev.mass0 * F.G0) + ' kN. A {twr} of ' + ev.tw.toFixed(2) + ' cannot lift off. Add thrust, or use smaller tanks.';
        else if (!res.ok) why = 'It lifted off, but ran out of {propellant} before reaching {orbitalv|orbital velocity}, so it fell back. Try bigger tanks, or boosters.';
        function row(ok, text) { return '<li class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✕') + ' ' + text + '</li>'; }
        var rows = '<ul class="test-rows">' + row(ev.tw >= 1, 'Lifts off: thrust-to-weight ' + ev.tw.toFixed(2)) + row(res.ok, 'Reaches orbital velocity') + row(inBudget, ev.cost + ' of ' + F.BUDGET + ' coins') + '</ul>';
        if (!res.ok) {
          var fix = suggest();
          A.play('bad');
          say('Watch what happened.', 'sad');
          sheet('bad', '<div class="oops">' + W.replay(ev.tw < 1 ? 'heavy' : 'fall') + '<div>' + rows + '<p>' + W.terms(why) + '</p></div></div><div class="actions">' +
            (fix ? '<button type="button" class="btn primary big" data-lv="tryfix">Try this: ' + fix.label + '</button>' : '') +
            '<button type="button" class="btn" data-lv="closesheet">I will fix it</button></div>');
          return;
        }
        var stars = !inBudget ? 1 : F.BUDGET - ev.cost >= 20 ? 3 : 2;
        Pg.data.build = { tank: b.tank, engines: b.engines, boosters: b.boosters }; Pg.data.meco = null; Pg.save();
        bar(1);
        complete(2, stars, 'It flies!', (inBudget ? (stars < 3 ? 'It reaches orbit for ' + ev.cost + ' coins. Spend 100 or less for 3 stars.' : 'It reaches orbit for only ' + ev.cost + ' coins.') : 'It reaches orbit, but it went over budget.') + ' More than one rocket works: that is a trade-off.',
          [ev.cost <= 90 && 'thrifty', b.boosters === 'none' && 'pure', b.tank === 'S' && 'mini', b.tank === 'L' && 'big'],
          { words: ['thrust', 'weight', 'twr', 'propellant', 'mixture', 'booster', 'budget', 'tradeoff', 'orbitalv'] });
      },
      closesheet: hideSheet,
      cleanup: function () {}
    };
  };
})();
