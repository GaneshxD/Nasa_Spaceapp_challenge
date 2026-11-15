/* Orbit Ranger — mission designer: the title, crew and briefing screens.
 */
(function () {
  'use strict';
  var RG = window.RG, X = RG.Designer, D = RG.DATA, W = RG.Widgets;
  var state = X.state, esc = W.esc, $ = X.$, owner = X.owner, team = X.team;

  /* ----- title ----- */
  function renderTitle() {
    $('panel').innerHTML =
      '<div class="hero">' +
      '<h1><span><span class="o">O</span>rbit</span> <span>Ranger</span></h1>' +
      '<p class="lede">Build a rocket. Fly it to orbit. Spot wildfires from space. Then land on the Moon.</p>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn primary big" data-act="play">Play</button>' +
      '<button type="button" class="btn ghost" data-lv="go" data-id="coop1">2 players</button>' +
      '<button type="button" class="btn ghost" data-lv="go" data-id="crew4">Crew online</button>' +
      '<button type="button" class="btn ghost" data-lv="hangar">NASA 3D hangar</button></div>' +
      '<p class="fine">The Earth, every fire and ' + RG.Models.all().length + ' spacecraft in the game are real NASA data and models.</p>' +
      '</div>';
  }

  /* ----- crew ----- */
  function renderCrew() {
    var n = state.players.length;
    var names = state.players.map(function (name, i) {
      var jobs = D.ROLE_ORDER.filter(function (r, ri) { return ri % n === i; }).map(function (r) {
        return '<span class="role-tag" style="--role:' + D.ROLES[r].color + '">' + D.ROLES[r].name + '</span>';
      }).join('');
      return '<div class="name-row"><label for="name-' + i + '">Player ' + (i + 1) + '</label>' +
        '<input id="name-' + i + '" data-name="' + i + '" maxlength="14" autocomplete="off" value="' + esc(name) + '">' +
        '<div class="jobs">' + jobs + '</div></div>';
    }).join('');
    var diffs = Object.keys(D.DIFFICULTY).map(function (k) {
      var df = D.DIFFICULTY[k];
      return '<button type="button" class="card" data-act="diff" data-key="' + k + '" aria-pressed="' + (state.diff === k) + '">' +
        '<span><span class="card-name">' + df.name + '</span><span class="card-blurb">' + df.note + '</span>' +
        '<span class="chip">Budget: ' + (isFinite(df.budget) ? '$' + df.budget + ' million' : 'no limit') + '</span></span>' +
        '<span class="card-mark">Picked</span></button>';
    }).join('');
    var Room = RG.Room;
    if (Room.active) { renderRoom(); return; }
    var online = !Room.available ? '' :
      '<div class="online"><h2>Or play on your own phones</h2><p>Up to four players, each on their own device, share one design.</p>' +
      '<div class="online-row"><button type="button" class="btn" data-act="room-create">Create a room</button>' +
      '<span class="join"><label class="sr" for="room-code">Room code</label><input id="room-code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE">' +
      '<button type="button" class="btn" data-act="room-join">Join</button></span></div>' +
      '<p class="room-err" id="room-err" role="alert"></p></div>';
    $('panel').innerHTML =
      '<div class="sheet"><div class="sheet-scroll">' +
      '<h1 tabindex="-1">Pick your crew</h1>' +
      '<p>Play alone, or share the four jobs between up to four players.</p>' +
      '<h2 id="lbl-count">How many players?</h2>' +
      '<div class="seg" role="group" aria-labelledby="lbl-count">' + [1, 2, 3, 4].map(function (k) {
        return '<button type="button" data-act="players" data-n="' + k + '" aria-pressed="' + (n === k) + '">' + k + '</button>';
      }).join('') + '</div>' +
      '<div class="names">' + names + '</div>' +
      '<fieldset class="group diff"><legend>How hard?</legend><div class="cards">' + diffs + '</div></fieldset>' + online +
      '</div><div class="sheet-foot"><span class="grow"></span>' +
      '<button type="button" class="btn primary" data-act="brief">Done</button></div></div>';
  }

  /** The crew screen while in an online room: the code to share, and who has which console. */
  function renderRoom() {
    var Room = RG.Room, rs = Room.state, n = rs.players.length;
    var list = rs.players.map(function (p, i) {
      var jobs = D.ROLE_ORDER.filter(function (r, ri) { return ri % n === i; }).map(function (r) {
        return '<span class="role-tag" style="--role:' + D.ROLES[r].color + '">' + D.ROLES[r].name + '</span>';
      }).join('');
      return '<li class="name-row"><span class="who-line"><i class="dot' + (p.online ? ' on' : '') + '"></i><b>' + esc(p.name) + '</b>' +
        (p.id === Room.me ? ' (you)' : '') + (i === 0 ? ' · host' : '') + (p.online ? '' : ' · away') + '</span><div class="jobs">' + jobs + '</div></li>';
    }).join('');
    $('panel').innerHTML =
      '<div class="sheet"><div class="sheet-scroll">' +
      '<h1 tabindex="-1">Your crew</h1>' +
      '<div class="room-card"><span>Room code</span><b>' + esc(rs.code) + '</b><span>Friends type this code to join.</span></div>' +
      '<ul class="names">' + list + '</ul>' +
      (n < 4 ? '<p class="foot-note">Waiting for more players? You can start now and they can join later.</p>' : '') +
      '<p style="margin-top:12px">Level: <b>' + D.DIFFICULTY[rs.diff].name + '</b>. Each player chooses the parts for their own consoles.</p>' +
      '</div><div class="sheet-foot"><button type="button" class="btn" data-act="room-leave">Leave room</button><span class="grow"></span>' +
      '<button type="button" class="btn primary" data-act="brief">Done</button></div></div>';
  }

  /* ----- briefing ----- */
  function renderBrief() {
    var df = D.DIFFICULTY[state.diff];
    var crew = D.ROLE_ORDER.map(function (r) {
      return '<li><span><span class="role-tag" style="--role:' + D.ROLES[r].color + '">' + D.ROLES[r].name + '</span>' +
        (team() ? ' ' + esc(owner(r)) : '') + '</span><span>' + D.ROLES[r].job + '</span></li>';
    }).join('');
    $('panel').innerHTML =
      '<div class="sheet"><div class="sheet-scroll">' +
      '<h1 tabindex="-1">Mission: ' + D.MISSION.name + '</h1>' +
      '<p>Wildfires start small. Design <b>' + D.MISSION.satellite + '</b>, a satellite that spots them from space and warns firefighters fast.</p>' +
      '<h2>Goals</h2><ol class="goals">' + D.MISSION.goals.map(function (g) {
        return '<li>' + (g.id === 'budget' && isFinite(df.budget) ? 'Stay inside the budget: $' + df.budget + ' million' : g.text) + '</li>';
      }).join('') + '</ol>' +
      '<p class="fact"><b>Every fire in this game is real.</b> NASA satellites saw each one in 2023.</p>' +
      (team() ? '<h2>Crew</h2><ul class="huddle">' + crew + '</ul>' : '') +
      '<p style="margin-top:12px"><button type="button" class="link" data-act="crew">' + (team() ? 'Change crew or level' : 'Add players or change level') + '</button> (' + state.players.length + (team() ? ' players, ' : ' player, ') + df.name + ')</p>' +
      '</div><div class="sheet-foot"><button type="button" class="btn" data-act="map">Back</button><span class="grow"></span>' +
      '<button type="button" class="btn primary" data-act="design">Start designing</button></div></div>';
  }

  X.screens.title = renderTitle;
  X.screens.crew = renderCrew;
  X.screens.brief = renderBrief;
})();
