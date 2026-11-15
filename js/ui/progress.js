/* Orbit Ranger — saved progress.
 * Stars, the rocket built in level 2, the hand-over from level 3 to level 4,
 * badges and cards, the last Moon plan, and the stars of the two-player mission (coop). Kept in the browser's localStorage; nothing leaves the device.
 */
(function () {
  'use strict';
  var RG = window.RG;
  var KEY = 'orbit-ranger.progress', LEVELS = 6;
  function blank() { return { stars: {}, build: null, meco: null, all: false, badges: {}, cards: {}, seen: {}, moon: null, moonBest: {}, moonSites: {}, moonOrbit: false, coop: {} }; }
  var Pg = { data: blank() };

  Pg.load = function () {
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (p && p.stars) { Pg.data = p; p.badges = p.badges || {}; p.cards = p.cards || {}; p.seen = p.seen || {}; p.moonBest = p.moonBest || {}; p.moonSites = p.moonSites || {}; p.coop = p.coop || {}; }
    } catch (e) { /* storage may be off */ }
  };
  Pg.save = function () { try { localStorage.setItem(KEY, JSON.stringify(Pg.data)); } catch (e) { /* storage may be off */ } };
  Pg.reset = function () { Pg.data = blank(); Pg.save(); };
  /** Levels unlock in order: one star on a level opens the next. */
  Pg.isOpen = function (id) {
    if (id === 6) return Pg.data.all || (Pg.data.stars[4] || 0) >= 1; // the Moon opens once you can reach orbit; level 5 is a long mission
    return id === 1 || Pg.data.all || (Pg.data.stars[id - 1] || 0) >= 1;
  };
  Pg.award = function (id, stars) {
    if (stars > (Pg.data.stars[id] || 0)) Pg.data.stars[id] = stars;
    Pg.save();
  };
  Pg.LEVELS = LEVELS;
  Pg.totalStars = function () {
    var n = 0;
    for (var id = 1; id <= LEVELS; id++) n += Pg.data.stars[id] || 0;
    return n;
  };
  /** Record badges and a card; returns only the ones that are new. */
  Pg.earn = function (badges, card) {
    var d = Pg.data;
    var out = { badges: badges.filter(function (b) { return b && !d.badges[b]; }), card: card && !d.cards[card] ? card : null };
    out.badges.forEach(function (b) { d.badges[b] = true; });
    if (out.card) d.cards[out.card] = true;
    Pg.save();
    return out;
  };

  RG.Progress = Pg;
})();
