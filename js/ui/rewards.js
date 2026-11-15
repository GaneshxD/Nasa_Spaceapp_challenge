/* Orbit Ranger — rewards.
 * Mission-patch badges for different ways of winning, and collectible cards of
 * real NASA missions with NASA's own 3D model on the front. What has been
 * earned is kept by RG.Progress.
 */
(function () {
  'use strict';
  var RG = window.RG, W = RG.Widgets;
  var Rw = {};

  // id: [name, how to earn it, level (or place), icon, metal]
  var BADGES = {
    expert: ['Rocket expert', 'Get every quiz question right', 1, 'rocket', 'bronze'],
    thrifty: ['Cheapest rocket', 'Reach orbit for 90 coins', 2, 'coin', 'silver'],
    pure: ['Engines only', 'Reach orbit without boosters', 2, 'engine', 'silver'],
    mini: ['Tiny but mighty', 'Reach orbit on small tanks', 2, 'tank', 'silver'],
    big: ['Big lifter', 'Reach orbit with large tanks', 2, 'booster', 'bronze'],
    steady: ['Steady hands', 'Stay on course 90% of the climb', 3, 'up', 'silver'],
    saver: ['Fuel saver', 'Reach orbit with a third of the fuel left', 4, 'tank', 'gold'],
    circle: ['Perfect circle', 'Make an almost round orbit', 4, 'disk', 'gold'],
    cheap: ['Cheapest mission', 'A 2-star mission for $70M or less', 5, 'coin', 'gold'],
    sharp: ['Sharpest eyes', 'Miss no fire at all', 5, 'eye', 'gold'],
    fast: ['Fastest warning', 'Warn 6 fires in 10 in under 6 hours', 5, 'bolt', 'gold'],
    science: ['Bonus scientist', 'Fly all three bonus tools', 5, 'scope', 'silver'],
    eagle: ['Moon lander', 'Land on the Moon', 6, 'moon', 'silver'],
    feather: ['Feather touch', 'Touch down slower than 1 m/s', 6, 'up', 'gold'],
    bingo: ['Running on fumes', 'Land with under 6% of the fuel left', 6, 'tank', 'gold'],
    bullseye: ['Bullseye', 'Land within 5 m of the target', 6, 'pin', 'gold'],
    geologist: ['Field geologist', 'Finish three or more jobs and get back inside', 6, 'box', 'gold'],
    stick: ['Hands on the engine', 'Land with the throttle in your own hands', 6, 'hand', 'cosmic'],
    tourist: ['Moon hopper', 'Land at three different sites', 6, 'pin', 'silver'],
    sixpack: ['All six', 'Land at every Apollo site', 6, 'moon', 'cosmic'],
    ontime: ['On the mark', 'Fire the deorbit burn within a second of zero, behind the Moon', 6, 'radio', 'gold'],
    crew: ['Launch crew', 'Fly the two-player launch to space', 'Co-op', 'rocket', 'silver'],
    dreamteam: ['Dream team', 'Three stars as a launch crew', 'Co-op', 'medal', 'cosmic'],
    curator: ['Curator', 'Open 10 models in the hangar', 'Hangar', 'cam', 'bronze'],
    archivist: ['Archivist', 'Open 60 models in the hangar', 'Hangar', 'chip', 'gold'],
    namer: ['Sharp spotter', 'Name 5 spacecraft out of 5', 'Hangar', 'eye', 'gold']
  };
  var METAL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', cosmic: 'Cosmic' };
  // id: [name, fallback icon, fact, fact, what it is, NASA 3D model id, foil]
  var CARDS = {
    sls: ['Space Launch System', 'rocket', '98 m tall', 'First flight 2022', 'NASA’s Moon rocket: a hydrogen core stage with four RS-25 engines and two solid boosters.', 'space-launch-system-block-1', 'gold'],
    rs25: ['RS-25 engine', 'engine', 'Burns hydrogen + oxygen', 'Exhaust is steam', 'It flew on every Space Shuttle mission and now powers the Space Launch System.', 'space-shuttle-d-eng', 'silver'],
    artemis1: ['Artemis I', 'moon', 'Launched 16 Nov 2022', 'Kennedy Space Center', 'The first Space Launch System flight sent the Orion capsule around the Moon and back.', 'mobile-launcher-assembled', 'gold'],
    terra: ['Terra', 'sso', 'Launched 1999', '705 km up', 'Its MODIS instrument has watched Earth’s fires for over 25 years, and found fires in this game.', 'terra', 'gold'],
    aqua: ['Aqua', 'sso', 'Launched 2002', '705 km up', 'Terra’s partner. It crosses in the early afternoon, when fires burn hottest.', 'aqua-b', 'silver'],
    snpp: ['Suomi NPP', 'scan', 'Launched 2011', '375 m fire pixels', 'Its VIIRS scanner paints a strip of Earth 3,000 km wide on every pass.', 'suomi-national-polar-orbiting-partnership-suomi-npp', 'silver'],
    landsat: ['Landsat 9', 'eye', 'Launched 2021', '30 m pixels', 'NASA and USGS Landsat satellites have taken pictures of Earth’s land since 1972.', 'landsat-9', 'silver'],
    goes: ['GOES-East', 'geo', '35,786 km up', 'Parked over the Americas', 'It turns with the Earth, so it stares at the same side all day and night.', 'geostationary-operational-environmental-satellites', 'silver'],
    hyti: ['HyTI', 'cam', 'Launched 2024', 'Shoebox-sized', 'A NASA-funded CubeSat with a heat camera, small enough to carry in two hands.', '', 'bronze'],
    iss: ['Space Station', 'leo', 'About 400 km up', 'A lap every 93 minutes', 'NASA’s Lightning Imaging Sensor counted lightning from here from 2017 to 2023.', 'international-space-station-iss', 'gold'],
    lm: ['Apollo Lunar Module', 'moon', '7 m tall', 'Six Moon landings', 'Built only for space: too fragile to stand on Earth fully fuelled. You flew it in level 6.', 'apollo-lunar-module', 'cosmic'],
    saturn5: ['Saturn V', 'rocket', '111 m tall', '13 launches', 'The rocket that carried every Apollo crew toward the Moon.', 'saturn-v', 'gold'],
    lro: ['Lunar Reconnaissance Orbiter', 'moon', 'At the Moon since 2009', 'Sees the Apollo sites', 'Its maps shaped the ground you landed on in level 6.', 'lunar-reconnaissance-orbiter-b', 'silver'],
    emu: ['Spacewalk suit', 'hand', 'About 145 kg on Earth', 'A one-person spacecraft', 'Air, cooling water, power and radio, all carried on your back.', 'extravehicular-mobility-unit', 'silver'],
    hubble: ['Hubble', 'scope', 'Launched 1990', 'Repaired five times', 'The telescope astronauts fixed in orbit. Still working after more than 35 years.', 'hubble-space-telescope-b', 'gold'],
    webb: ['Webb', 'scope', '6.5 m mirror', '1.5 million km away', 'Sees the first galaxies in infrared light, from behind a sunshield the size of a tennis court.', 'james-webb-space-telescope-a', 'cosmic'],
    percy: ['Perseverance', 'wheel', 'On Mars since 2021', 'Jezero Crater', 'Collects rock samples and looks for signs of ancient life.', 'mars-2020-perseverance-rover', 'gold'],
    voyager: ['Voyager', 'dish', 'Launched 1977', 'Beyond the Sun’s bubble', 'The farthest things people have ever made, still phoning home.', 'voyager-probe-b', 'cosmic']
  };
  var CARD_ORDER = Object.keys(CARDS);
  var LEVEL_CARDS = { 1: ['sls'], 2: ['rs25'], 3: ['artemis1'], 4: ['terra'], 6: ['lm', 'saturn5', 'lro', 'emu'] };
  Rw.LEVEL_CARD = { 1: 'sls', 2: 'rs25', 3: 'artemis1', 4: 'terra' };
  /** The next card a level still has to give. */
  Rw.cardFor = function (level) {
    var list = LEVEL_CARDS[level] || [], have = RG.Progress.data.cards;
    for (var i = 0; i < list.length; i++) if (!have[list[i]]) return list[i];
    return null;
  };
  Rw.BADGES = BADGES; Rw.CARDS = CARDS;

  function where(b) { return typeof b[2] === 'number' ? 'Level ' + b[2] : b[2]; }
  function badgeHtml(id, locked) {
    var b = BADGES[id];
    return '<div class="badge m-' + b[4] + (locked ? ' is-locked' : '') + '"' + (locked ? '' : ' data-tilt') + '>' +
      '<span class="bd-medal"><span class="bd-art">' + W.icon(locked ? 'lock' : b[3]) + '</span><i class="bd-shine" aria-hidden="true"></i></span>' +
      '<b>' + b[0] + '</b><span class="bd-how">' + b[1] + '</span><small>' + (locked ? where(b) : METAL[b[4]] + ', ' + where(b).toLowerCase()) + '</small></div>';
  }
  function nasaCard(id, locked) {
    var c = CARDS[id], n = CARD_ORDER.indexOf(id) + 1, no = (n < 10 ? '0' : '') + n;
    if (locked) return '<div class="nasa-card is-locked"><span class="nc-back" aria-hidden="true"><i></i><i></i><b>?</b></span><small>Card ' + no + '</small></div>';
    var art = c[5] && RG.Models && RG.Models.info(c[5]) ? '<img src="' + RG.Models.thumb(c[5]) + '" alt="" loading="lazy">' : W.icon(c[1]);
    return '<div class="nasa-card f-' + c[6] + '" data-tilt><i class="nc-foil" aria-hidden="true"></i>' +
      '<span class="nc-top"><small>NASA mission card</small><small>' + no + ' of ' + CARD_ORDER.length + '</small></span>' +
      '<span class="nc-art">' + art + '</span><b>' + c[0] + '</b>' +
      '<span class="nc-stats"><i>' + c[2] + '</i><i>' + c[3] + '</i></span><p>' + c[4] + '</p>' +
      (c[5] && RG.Models && RG.Models.info(c[5]) ? '<button type="button" class="nc-3d" data-lv="hgOpen" data-id="' + c[5] + '">See it in 3D</button>' : '') + '</div>';
  }
  function rewardsHtml(r) {
    if (!r || (!r.badges.length && !r.card)) return '';
    return '<div class="rewards"><h3>New in your collection</h3>' + r.badges.map(function (b) { return badgeHtml(b); }).join('') + (r.card ? nasaCard(r.card) : '') + '</div>';
  }
  Rw.html = rewardsHtml;

  /** Level 5: badges for the kind of mission flown, and the real satellite most like the design. */
  Rw.forMission = function (d, score, res, cost) {
    var c = res.counts, okay = score.stars >= 1;
    var card = d.orbit === 'geo' ? 'goes' : d.orbit === 'leo' ? (d.sensor === 'mini' ? 'hyti' : 'iss')
      : d.sensor === 'wide' ? 'snpp' : d.sensor === 'giant' || d.extras.indexOf('color') >= 0 ? 'landsat' : 'aqua';
    return RG.Progress.earn([score.stars >= 2 && cost <= 70 && 'cheap', c.missed === 0 && 'sharp', c.fast >= c.total * 0.6 && 'fast', okay && d.extras.length === 3 && 'science'], card);
  };

  /** Rewards for time spent in the hangar. Shows a short message for anything new. */
  Rw.forHangar = function (seen, quiz) {
    var card = seen >= 40 ? 'percy' : seen >= 20 ? 'webb' : seen >= 5 ? 'hubble' : null;
    if (quiz >= 4 && !RG.Progress.data.cards.voyager) card = 'voyager';
    else if (card && RG.Progress.data.cards[card]) card = seen >= 20 && !RG.Progress.data.cards.webb ? 'webb' : seen >= 5 && !RG.Progress.data.cards.hubble ? 'hubble' : null;
    var won = RG.Progress.earn([seen >= 10 && 'curator', seen >= 60 && 'archivist', quiz >= 5 && 'namer'], card);
    var names = won.badges.map(function (b) { return BADGES[b][0] + ' badge'; });
    if (won.card) names.push(CARDS[won.card][0] + ' card');
    if (names.length) { RG.Designer.toast('New in your collection: ' + names.join(' and ')); RG.Audio.play('star'); }
    return won;
  };

  /** The collection: every badge and card, locked ones face down. */
  Rw.album = function () {
    var nb = Object.keys(RG.Progress.data.badges).length, nc = Object.keys(RG.Progress.data.cards).length, dlg = document.getElementById('dialog');
    dlg.classList.add('is-vault');
    RG.App.openDialog('<div class="vault"><div class="vault-head"><h2 id="dialog-title">My collection</h2><button type="button" class="btn ghost" data-act="close" autofocus>Close</button></div>' +
      '<p class="vault-lede">Mission patches for the ways you win, and cards of real NASA missions.</p>' +
      '<h3 class="album-h">Mission patches <span>' + nb + ' of ' + Object.keys(BADGES).length + '</span></h3><div class="album">' +
      Object.keys(BADGES).map(function (b) { return badgeHtml(b, !RG.Progress.data.badges[b]); }).join('') + '</div>' +
      '<h3 class="album-h">NASA mission cards <span>' + nc + ' of ' + CARD_ORDER.length + '</span></h3><div class="album cards-album">' +
      CARD_ORDER.map(function (c) { return nasaCard(c, !RG.Progress.data.cards[c]); }).join('') + '</div>' +
      '</div>',
      function () { dlg.classList.remove('is-vault'); });
  };

  // Cards and patches lean toward the pointer and catch the light. Skipped on touch screens and with reduced motion.
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fine && !calm) {
    var last = null;
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest ? e.target.closest('[data-tilt]') : null;
      if (last && last !== el) { last.style.removeProperty('--rx'); last.style.removeProperty('--ry'); last.classList.remove('is-lit'); }
      last = el;
      if (!el) return;
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', ((0.5 - y) * 14).toFixed(2) + 'deg'); el.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      el.classList.add('is-lit');
    }, { passive: true });
  }

  RG.Rewards = Rw;
})();
