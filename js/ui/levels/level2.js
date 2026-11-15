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
  RG.LevelDefs = RG.LevelDefs || {};

  RG.LevelDefs[2] = function () {
    var b = { tank: null, engines: null, boosters: null };
    var GROUPS = [['tank', 'Fuel tanks', F.TANKS, 'lh2'], ['engines', 'Engines', F.ENGINES, 'engines'], ['boosters', 'Boosters', F.BOOSTERS, 'boosters']];
    R.setBuild({ satellite: DEFAULT_SAT });
    K.App.view('rk-build');
    say('Drag fuel tanks to the glowing slot.');
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
      say(!b.engines ? 'Now drag on some engines. Heavy rockets need more push.' : weak ? 'Too heavy to lift off! More push, or smaller tanks.' : !b.boosters ? 'Boosters or not? Watch the power meter.' : 'Ready. Try a test flight!',
        weak ? 'worry' : full() ? 'cheer' : 'happy');
      draw();
      document.getElementById('lv-side').scrollTop = top;
      var again = document.querySelector('.tile[data-group="' + g + '"][data-key="' + k + '"]');
      if (again) again.focus({ preventScroll: true });
    }

    function full() { return b.tank && b.engines && b.boosters; }
    function draw() {
      var ev = b.tank && b.engines ? F.evaluate(b) : null, html = '';
      GROUPS.forEach(function (g, gi) {
        var locked = gi > 0 && !b[GROUPS[gi - 1][0]];
        html += '<fieldset class="tiles"' + (locked ? ' disabled' : '') + '><legend>' + g[1] + '</legend>' +
          Object.keys(g[2]).map(function (k) {
            return '<button type="button" class="tile" data-lv="pick" data-drag="' + g[0] + '" data-group="' + g[0] + '" data-key="' + k + '" aria-pressed="' + (b[g[0]] === k) + '">' +
              art(g[0], k) + '<b>' + SHORT[k] + '</b><span class="coin">' + g[2][k].cost + '</span></button>';
          }).join('') + '</fieldset>';
      });
      var cost = (b.tank ? F.TANKS[b.tank].cost : 0) + (b.engines ? F.ENGINES[b.engines].cost : 0) + (b.boosters ? F.BOOSTERS[b.boosters].cost : 0) + F.UPPER.cost;
      var tw = ev ? ev.tw : 0, lift = !ev ? 'idle' : tw < 1 ? 'over' : tw < 1.2 ? 'tight' : 'ok';
      var meters = '<div class="build-meters">' +
        '<div class="bm" data-level="' + lift + '"><span>Lift-off power</span><b>' + (ev ? (tw < 1 ? 'Too weak' : tw < 1.2 ? 'Just enough' : 'Strong') : 'Pick tanks and engines') + '</b>' +
        '<div class="bm-bar"><i style="width:' + Math.min(100, tw / 2 * 100).toFixed(0) + '%"></i><em style="left:50%"></em></div><small>' + (ev ? 'Push ' + num(ev.thrust0 / 9806.65) + ' t, weight ' + num(ev.mass0) + ' t' : 'The push must beat the weight') + '</small></div>' +
        '<div class="bm" data-level="' + (b.tank ? 'ok' : 'idle') + '"><span>Fuel on board</span><b>' + (ev ? num(ev.lox) + ' t oxygen, ' + num(ev.lh2) + ' t hydrogen' : b.tank ? num(F.TANKS[b.tank].prop) + ' t' : 'No tanks yet') + '</b>' +
        '<div class="bm-bar two"><i class="ox" style="width:' + (b.tank ? 86 * F.TANKS[b.tank].prop / 700 : 0).toFixed(0) + '%"></i><i class="h2" style="width:' + (b.tank ? 14 * F.TANKS[b.tank].prop / 700 : 0).toFixed(0) + '%"></i></div><small>6 parts oxygen to 1 part hydrogen, by weight</small></div>' +
        '<div class="bm" data-level="' + (cost > F.BUDGET ? 'over' : 'ok') + '"><span>Coins</span><b>' + cost + ' of ' + F.BUDGET + '</b>' +
        '<div class="bm-bar"><i style="width:' + Math.min(100, cost / F.BUDGET * 100).toFixed(0) + '%"></i></div><small>Includes ' + F.UPPER.cost + ' for the upper stage and nose cone</small></div></div>';
      side(meters + html + '<button type="button" class="btn primary big wide" data-lv="test"' + (full() ? '' : ' disabled') + '>Test flight</button>');
      bar((b.tank ? 0.25 : 0) + (b.engines ? 0.25 : 0) + (b.boosters ? 0.25 : 0));
      hud(W.dock(GROUPS.map(function (g) {
        var k = b[g[0]];
        return { key: g[0], label: g[1], icon: g[0] === 'tank' ? 'tank' : g[0] === 'engines' ? 'engine' : 'booster',
          items: k ? [{ icon: g[0] === 'tank' ? 'tank' : g[0] === 'engines' ? 'engine' : k === 'two' ? 'booster' : 'none', name: g[2][k].name }] : [] };
      })));
    }
    return {
      pick: function (el, e) {
        if (W.isTap(e)) { W.hintDrag(el); say('Drag it onto the glowing slot.', 'wow'); return; }
        place(el.dataset.group, el.dataset.key);
      },
      tryfix: function () { // swap in the suggested parts, one at a time so each one pops onto the rocket
        var fix = suggest();
        hideSheet();
        GROUPS.forEach(function (g) { if (fix.build[g[0]] !== b[g[0]]) place(g[0], fix.build[g[0]]); });
      },
      test: function () {
        var ev = F.evaluate(b), res = F.testFlight(b), inBudget = ev.cost <= F.BUDGET, why = '';
        if (ev.tw < 1) why = 'Too heavy: ' + num(ev.thrust0 / 9806.65) + ' t of push cannot lift ' + num(ev.mass0) + ' t. Add push or use smaller tanks.';
        else if (!res.ok) why = 'Too slow to stay up: it ran out of fuel. Try bigger tanks or boosters.';
        function row(ok, text) { return '<li class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✕') + ' ' + text + '</li>'; }
        var rows = '<ul class="test-rows">' + row(ev.tw >= 1, 'Lifts off') + row(res.ok, 'Reaches orbit') + row(inBudget, ev.cost + ' of ' + F.BUDGET + ' coins') + '</ul>';
        if (!res.ok) {
          var fix = suggest();
          A.play('bad');
          say('Watch what happened.', 'sad');
          sheet('bad', '<div class="oops">' + W.replay(ev.tw < 1 ? 'heavy' : 'fall') + '<div>' + rows + '<p>' + why + '</p></div></div><div class="actions">' +
            (fix ? '<button type="button" class="btn primary big" data-lv="tryfix">Try this: ' + fix.label + '</button>' : '') +
            '<button type="button" class="btn" data-lv="closesheet">I will fix it</button></div>');
          return;
        }
        var stars = !inBudget ? 1 : F.BUDGET - ev.cost >= 20 ? 3 : 2;
        Pg.data.build = { tank: b.tank, engines: b.engines, boosters: b.boosters }; Pg.data.meco = null; Pg.save();
        bar(1);
        complete(2, stars, 'It flies!', inBudget ? (stars < 3 ? 'Spend 100 coins or less for 3 stars' : ev.cost + ' coins. Nice and cheap!') : 'It works, but it went over budget',
          [ev.cost <= 90 && 'thrifty', b.boosters === 'none' && 'pure', b.tank === 'S' && 'mini', b.tank === 'L' && 'big']);
      },
      closesheet: hideSheet,
      cleanup: function () {}
    };
  };
})();
