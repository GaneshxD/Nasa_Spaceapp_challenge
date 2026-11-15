/* Orbit Ranger — mission designer: the mission report.
 * Stars, the score breakdown, every fire, rewards and what to try next.
 */
(function () {
  'use strict';
  var RG = window.RG, X = RG.Designer, D = RG.DATA, M = RG.Model, W = RG.Widgets;
  var state = X.state, esc = W.esc, $ = X.$;
  var fmtDate = X.fmtDate;

  /* ----- report ----- */
  var REPLAY = { power: 'battery', radio: 'data', sensor: 'blur', orbit: 'blur', brain: 'blur', bus: 'heavy', rocket: 'heavy' }; // the cartoon for each step's usual trouble
  function starSvg(on) {
    return '<svg viewBox="0 0 24 24" class="' + (on ? 'is-on' : '') + '" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"/></svg>';
  }
  function renderReport() {
    var sc = state.score, res = state.result, db = state.debrief, c = res.counts;
    var parts = [
      ['Fire warnings', sc.science, 60], ['Bonus science', sc.bonus, 10],
      ['Money left over', sc.efficiency, 15], ['Healthy satellite', sc.health, 15]
    ].map(function (p) {
      return '<div class="part"><span>' + p[0] + '</span><div class="bar"><i style="width:' + Math.round((p[1] / p[2]) * 100) + '%"></i></div><span>' + Math.round(p[1]) + ' of ' + p[2] + '</span></div>';
    }).join('');
    var gradeWord = { fast: 'warned in under 6 hours', onTime: 'warned within 12 hours', late: 'warned late', missed: 'missed' };
    var strip = [1, 2, 3].map(function (y) {
      return '<span>Year ' + y + '</span>' + res.fires.filter(function (f) { return f.year === y; }).map(function (f) {
        return '<span class="dot" data-g="' + f.grade + '" title="' + esc(f.place + ', ' + f.size + ' fire: ' + gradeWord[f.grade] + '. Real fire seen by MODIS on ' + f.seenBy + ', ' + fmtDate(f.seenOn) + ', ' + Math.round(f.frp) + ' MW.') + '"></span>';
      }).join('');
    }).join('');
    var good = db.good.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var fix = db.fix.map(function (f) {
      return '<li>' + (f.step ? W.replay(REPLAY[f.step]) : '') + '<b>' + esc(f.title) + '</b>' + esc(f.text) +
        (f.step ? ' <button type="button" class="btn primary" style="margin-top:8px" data-act="goto" data-step="' + f.step + '">Try this: change the ' + D.STEPS.filter(function (x) { return x.id === f.step; })[0].nav.toLowerCase() + '</button>' : '') + '</li>';
    }).join('');
    $('panel').innerHTML =
      '<div class="sheet is-wide" style="--role:var(--ink)"><div class="sheet-scroll">' +
      '<div class="verdict"><div class="stars" role="img" aria-label="' + sc.stars + ' of 3 stars">' + starSvg(sc.stars >= 1) + starSvg(sc.stars >= 2) + starSvg(sc.stars >= 3) + '</div>' +
      '<h1 tabindex="-1">' + sc.verdict + '</h1>' +
      '<p class="score"><b>' + sc.total + '</b> points out of 100. Mission number ' + res.seed + '.</p></div>' +
      RG.Rewards.html(state.rewards) +
      '<h2>How the points add up</h2><div class="parts">' + parts + '</div>' +
      '<h2>The ' + c.total + ' fires</h2>' +
      '<div class="strip">' + strip + '</div>' +
      '<div class="strip-key"><span><i style="background:var(--green)"></i>' + c.fast + ' warned in under 6 hours</span><span><i style="background:#a5e66f"></i>' + c.onTime + ' within 12 hours</span>' +
      '<span><i style="background:var(--yellow)"></i>' + c.late + ' late</span><span><i style="background:var(--red-d)"></i>' + c.missed + ' missed</span></div>' +
      '<p class="foot-note" style="margin-top:8px">Every dot is a real fire from NASA’s 2023 FIRMS archive. Point at a dot to see which one.</p>' +
      (good ? '<h2>What went well</h2><ul class="notes">' + good + '</ul>' : '') +
      (fix ? '<h2>What to try next time</h2><ul class="notes fix">' + fix + '</ul>' : '') +
      '<p style="margin-top:16px">Mission code: <b>' + M.encode(state.design) + '</b>. Share it so a friend can fly your design.</p>' +
      '</div><div class="sheet-foot"><button type="button" class="btn" data-act="copy">Copy the code</button>' +
      '<button type="button" class="btn" data-act="map">Level map</button><span class="grow"></span>' +
      '<button type="button" class="btn primary" data-act="improve">Improve this design</button></div></div>';
  }

  X.screens.report = renderReport;
})();
