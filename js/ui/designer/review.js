/* Orbit Ranger — mission designer: the Go / No-go check before launch.
 */
(function () {
  'use strict';
  var RG = window.RG, X = RG.Designer, D = RG.DATA, M = RG.Model, W = RG.Widgets;
  var state = X.state, esc = W.esc, $ = X.$, owner = X.owner, team = X.team, evalNow = X.evalNow;
  var AREA_ROLE = X.AREA_ROLE;

  /* ----- Go / No-go ----- */
  // which console owns each part of the satellite (for the cost list)
  var SLOT_ROLE = {
    sensor: 'science', extra: 'science', bus: 'eng', panels: 'eng', battery: 'eng',
    computer: 'comms', pointing: 'comms', radio: 'comms'
  };

  function renderReview() {
    var ev = evalNow(), d = state.design, blocked = ev.blocked.length > 0;
    var marks = { go: '✓', watch: '!', nogo: '×' }, words = { go: 'Go', watch: 'Caution', nogo: 'No-go' };
    function worst(list) {
      return list.some(function (c) { return c.level === 'nogo'; }) ? 'nogo' : list.some(function (c) { return c.level === 'watch'; }) ? 'watch' : 'go';
    }
    function checkHtml(c) {
      var fix = c.level !== 'go' && c.step ? ' <button type="button" class="link" data-act="goto" data-step="' + c.step + '">Change it</button>' : '';
      return '<li class="chk" data-level="' + c.level + '"><span class="chk-dot" aria-hidden="true">' + marks[c.level] + '</span>' +
        '<span><b>' + esc(c.title) + '</b>' + esc(c.text) + fix + '</span></li>';
    }
    var votesNeeded = 0, votesIn = 0;
    var consoles = D.ROLE_ORDER.map(function (r) {
      var list = ev.checks.filter(function (c) { return AREA_ROLE[c.area] === r; });
      var lv = worst(list), role = D.ROLES[r], vote = '';
      if (team()) {
        votesNeeded++;
        if (state.votes[r]) votesIn++;
        vote = '<button type="button" class="vote" data-act="vote" data-role="' + r + '" aria-pressed="' + !!state.votes[r] + '"' + (lv === 'nogo' || !RG.Room.mine(r) ? ' disabled' : '') + '>' +
          esc(owner(r)) + (state.votes[r] ? ' says go ✓' : ': press when you are go') + '</button>';
      }
      return '<li class="console" style="--role:' + role.color + '"><div class="console-head"><span class="role-tag">' + role.name + '</span>' +
        (team() ? '<span class="who">' + esc(owner(r)) + '</span>' : '') +
        '<span class="stamp" data-level="' + lv + '">' + words[lv] + '</span></div><ul>' + list.map(checkHtml).join('') + '</ul>' + vote + '</li>';
    }).join('');
    var money = ev.checks.filter(function (c) { return c.area === 'budget'; });
    if (!isFinite(ev.budget)) money = [{ level: 'go', title: 'Sandbox: no budget limit', text: 'This mission costs ' + M.fmtMoney(ev.cost) + '.', step: null }];
    consoles += '<li class="console" style="--role:var(--ink)"><div class="console-head"><span class="role-tag">' + (team() ? 'Whole team' : 'Budget') + '</span>' +
      '<span class="stamp" data-level="' + worst(money) + '">' + words[worst(money)] + '</span></div><ul>' + money.map(checkHtml).join('') + '</ul></li>';

    // the three biggest costs, to help decide what to give up
    var slots = M.parts(d).map(function (p) { return { label: p.item.name, cost: p.item.cost, role: SLOT_ROLE[p.slot] }; });
    slots.push({ label: D.NETWORKS[d.network].name, cost: D.NETWORKS[d.network].cost, role: 'comms' });
    slots.push({ label: D.ROCKETS[d.rocket].name, cost: D.ROCKETS[d.rocket].cost, role: 'nav' });
    slots.sort(function (a, b) { return b.cost - a.cost; });
    var huddle = '<div class="huddle"><h2>' + (team() ? 'Team huddle' : 'Where the money goes') + '</h2>' +
      (team() ? '<p>Talk it over before anyone presses go. If something has to go, these cost the most:</p>' : '') +
      '<ul>' + slots.slice(0, 3).map(function (sl) {
        return '<li><span>' + esc(sl.label) + (team() ? ' (' + esc(owner(sl.role)) + ')' : '') + '</span><span>' + M.fmtMoney(sl.cost) + '</span></li>';
      }).join('') + '<li><span>Whole mission</span><span>' + M.fmtMoney(ev.cost) + (isFinite(ev.budget) ? ' of ' + M.fmtMoney(ev.budget) : '') + '</span></li></ul></div>';

    var waiting = team() && votesIn < votesNeeded;
    var guest = !RG.Room.isHost();
    var note = guest && !blocked && !waiting ? esc(RG.Room.host().name) + ' launches for the team.' : blocked ? 'Fix the no-go items first.' : waiting ? 'Waiting for every console to say go.' : ev.watch.length ? 'Caution items can fly, but expect trouble.' : 'All consoles are go.';
    $('panel').innerHTML =
      '<div class="sheet is-wide" style="--role:var(--ink)"><div class="sheet-scroll">' +
      '<h1 tabindex="-1">Go or no-go?</h1>' +
      '<p>' + W.terms('Before every real launch, each console in {missioncontrol|Mission Control} reports “go” or “no-go”: a {gonogo|go / no-go} poll. A caution can still fly, but it means there is little {margin} left. Here is how ' + D.MISSION.satellite + ' looks.') + '</p>' +
      '<ul class="board">' + consoles + '</ul>' + huddle +
      '</div><div class="sheet-foot"><button type="button" class="btn" data-act="back">Back</button><span class="grow foot-note">' + note + '</span>' +
      '<button type="button" class="btn primary" data-act="launch"' + (blocked || waiting || guest ? ' disabled' : '') + '>Launch ' + D.MISSION.satellite + '</button></div></div>';
  }

  X.screens.review = renderReview;
})();
