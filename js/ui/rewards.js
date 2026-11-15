/* Orbit Ranger — rewards.
 * Badges for different ways of winning, and collectible cards of real NASA
 * missions. What has been earned is kept by RG.Progress.
 */
(function () {
  'use strict';
  var RG = window.RG, W = RG.Widgets;
  var Rw = {};

  var BADGES = {
    expert: ['Rocket expert', 'Get every quiz question right', 1],
    thrifty: ['Cheapest rocket', 'Reach orbit for 90 coins', 2],
    pure: ['Engines only', 'Reach orbit without boosters', 2],
    mini: ['Tiny but mighty', 'Reach orbit on small tanks', 2],
    big: ['Big lifter', 'Reach orbit with large tanks', 2],
    steady: ['Steady hands', 'Stay on course 90% of the climb', 3],
    saver: ['Fuel saver', 'Reach orbit with a third of the fuel left', 4],
    circle: ['Perfect circle', 'Make an almost round orbit', 4],
    cheap: ['Cheapest mission', 'A 2-star mission for $70M or less', 5],
    sharp: ['Sharpest eyes', 'Miss no fire at all', 5],
    fast: ['Fastest warning', 'Warn 6 fires in 10 in under 6 hours', 5],
    science: ['Bonus scientist', 'Fly all three bonus tools', 5]
  };
  var CARDS = {
    sls: ['Space Launch System', 'rocket', '98 m tall', 'First flight 2022', 'NASA’s Moon rocket: a hydrogen core stage with four RS-25 engines and two solid boosters.'],
    rs25: ['RS-25 engine', 'engine', 'Burns hydrogen + oxygen', 'Exhaust is steam', 'It flew on every Space Shuttle mission and now powers the Space Launch System.'],
    artemis1: ['Artemis I', 'moon', 'Launched 16 Nov 2022', 'Kennedy Space Center', 'The first Space Launch System flight sent the Orion capsule around the Moon and back.'],
    terra: ['Terra', 'sso', 'Launched 1999', '705 km up', 'Its MODIS instrument has watched Earth’s fires for over 25 years, and found fires in this game.'],
    aqua: ['Aqua', 'sso', 'Launched 2002', '705 km up', 'Terra’s partner. It crosses in the early afternoon, when fires burn hottest.'],
    snpp: ['Suomi NPP', 'scan', 'Launched 2011', '375 m fire pixels', 'Its VIIRS scanner paints a strip of Earth 3,000 km wide on every pass.'],
    landsat: ['Landsat 9', 'eye', 'Launched 2021', '30 m pixels', 'NASA and USGS Landsat satellites have taken pictures of Earth’s land since 1972.'],
    goes: ['GOES-East', 'geo', '35,786 km up', 'Parked over the Americas', 'It turns with the Earth, so it stares at the same side all day and night.'],
    hyti: ['HyTI', 'cam', 'Launched 2024', 'Shoebox-sized', 'A NASA-funded CubeSat with a heat camera, small enough to carry in two hands.'],
    iss: ['Space Station', 'leo', 'About 400 km up', 'A lap every 93 minutes', 'NASA’s Lightning Imaging Sensor counted lightning from here from 2017 to 2023.']
  };
  Rw.LEVEL_CARD = { 1: 'sls', 2: 'rs25', 3: 'artemis1', 4: 'terra' };

  function badgeHtml(id, locked) {
    var b = BADGES[id];
    return '<div class="badge' + (locked ? ' is-locked' : '') + '">' + W.icon(locked ? 'lock' : 'medal') + '<b>' + b[0] + '</b><span>' + (locked ? 'Level ' + b[2] + ': ' : '') + b[1] + '</span></div>';
  }
  function nasaCard(id, locked) {
    var c = CARDS[id];
    if (locked) return '<div class="nasa-card is-locked">' + W.icon('lock') + '<b>?</b></div>';
    return '<div class="nasa-card"><small>Real NASA mission</small><span class="nc-art">' + W.icon(c[1]) + '</span><b>' + c[0] + '</b>' +
      '<span class="nc-stats"><i>' + c[2] + '</i><i>' + c[3] + '</i></span><p>' + c[4] + '</p></div>';
  }
  function rewardsHtml(r) {
    if (!r || (!r.badges.length && !r.card)) return '';
    return '<div class="rewards"><h3>New!</h3>' + r.badges.map(function (b) { return badgeHtml(b); }).join('') + (r.card ? nasaCard(r.card) : '') + '</div>';
  }
  Rw.html = rewardsHtml;

  /** Level 5: badges for the kind of mission flown, and the real satellite most like the design. */
  Rw.forMission = function (d, score, res, cost) {
    var c = res.counts, okay = score.stars >= 1;
    var card = d.orbit === 'geo' ? 'goes' : d.orbit === 'leo' ? (d.sensor === 'mini' ? 'hyti' : 'iss')
      : d.sensor === 'wide' ? 'snpp' : d.sensor === 'giant' || d.extras.indexOf('color') >= 0 ? 'landsat' : 'aqua';
    return RG.Progress.earn([score.stars >= 2 && cost <= 70 && 'cheap', c.missed === 0 && 'sharp', c.fast >= c.total * 0.6 && 'fast', okay && d.extras.length === 3 && 'science'], card);
  };

  /** The collection: every badge and card, locked ones greyed out. */
  Rw.album = function () {
    var nb = Object.keys(RG.Progress.data.badges).length, nc = Object.keys(RG.Progress.data.cards).length;
    RG.App.openDialog('<h2 id="dialog-title">My collection</h2>' +
      '<h3 class="album-h">Badges <span>' + nb + ' of ' + Object.keys(BADGES).length + '</span></h3><div class="album">' +
      Object.keys(BADGES).map(function (b) { return badgeHtml(b, !RG.Progress.data.badges[b]); }).join('') + '</div>' +
      '<h3 class="album-h">NASA mission cards <span>' + nc + ' of ' + Object.keys(CARDS).length + '</span></h3><div class="album cards-album">' +
      Object.keys(CARDS).map(function (c) { return nasaCard(c, !RG.Progress.data.cards[c]); }).join('') + '</div>' +
      '<div class="actions"><button type="button" class="btn primary" data-act="close" autofocus>Close</button></div>');
  };

  RG.Rewards = Rw;
})();
