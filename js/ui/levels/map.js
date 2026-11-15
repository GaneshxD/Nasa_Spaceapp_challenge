/* Orbit Ranger — the level map.
 * A journey from the grass, through the clouds, into space: five stops on a
 * winding path, each with its stars. Levels unlock in order.
 */
(function () {
  'use strict';
  var RG = window.RG, Stage = RG.Stage, W = RG.Widgets, K = RG.LevelKit, Pg = RG.Progress;
  var Map = {};

  // x and y place each level on the map, in percent from the left and from the bottom.
  var LEVELS = Map.LEVELS = [
    { id: 1, title: 'Meet the rocket', x: 30, y: 9, color: '#58cc02', icon: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>' },
    { id: 2, title: 'Build it', x: 68, y: 26, color: '#1cb0f6', icon: '<path d="M12 2c3 2.5 4.5 6 4.5 10v5h-9v-5C7.5 8 9 4.5 12 2z"/><path d="M7.5 14L4 18h3.5M16.5 14l3.5 4h-3.5"/>' },
    { id: 3, title: 'Lift-off', x: 32, y: 44, color: '#ff9600', icon: '<path d="M12 21V5M5.5 11.5L12 5l6.5 6.5"/>' },
    { id: 4, title: 'Reach orbit', x: 66, y: 62, color: '#ce82ff', icon: '<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="4.6" transform="rotate(-25 12 12)"/>' },
    { id: 5, title: 'Fire watch', x: 36, y: 80, color: '#ff4b4b', icon: '<rect x="9" y="8" width="6" height="8" rx="1"/><path d="M2 9h6v6H2zM16 9h6v6h-6zM12 8V4M10 4h4"/>' }
  ];

  /* ---------- the map: a journey from the grass, through the clouds, into space ---------- */
  function scenery() {
    var rnd = Stage.seeded(5), stars = '', i;
    for (i = 0; i < 70; i++) stars += '<circle cx="' + (rnd() * 100).toFixed(1) + '" cy="' + (rnd() * 36).toFixed(1) + '" r="' + (0.12 + rnd() * 0.28).toFixed(2) + '"' + (i % 4 === 0 ? ' class="tw"' : '') + '/>';
    var clouds = '';
    [[8, 40, 1], [62, 47, 0.8], [30, 56, 1.2], [78, 60, 0.9], [-6, 66, 0.7]].forEach(function (c, k) {
      clouds += '<i class="w-cloud" style="left:' + c[0] + '%;bottom:' + c[1] + '%;--s:' + c[2] + ';--t:' + (50 + k * 14) + 's"></i>';
    });
    return '<div class="w-sky"></div>' +
      '<svg class="w-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + stars + '</svg>' +
      '<svg class="w-moon" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="22" fill="#f4f1de"/><circle cx="22" cy="24" r="5" fill="#dedbc6"/><circle cx="38" cy="36" r="7" fill="#dedbc6"/><circle cx="36" cy="18" r="3" fill="#dedbc6"/></svg>' +
      clouds +
      '<svg class="w-hills" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd866"/><stop offset="1" stop-color="#6cc04a"/></linearGradient>' +
      '<linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fca4b"/><stop offset="1" stop-color="#4fa836"/></linearGradient>' +
      '<linearGradient id="hg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58b63a"/><stop offset="1" stop-color="#3f8f2a"/></linearGradient></defs>' +
      '<path d="M0 150 Q150 60 320 120 T640 100 T960 130 T1200 90 V300 H0Z" fill="url(#hg1)"/>' +
      '<path d="M0 200 Q200 120 420 180 T820 160 T1200 190 V300 H0Z" fill="url(#hg2)"/>' +
      '<path d="M0 250 Q250 190 520 235 T1000 225 T1200 240 V300 H0Z" fill="url(#hg3)"/>' +
      '<g fill="#2f7d24">' + [90, 240, 300, 760, 905, 1090].map(function (x, k) {
        var y = 205 + (k % 3) * 12;
        return '<ellipse cx="' + (x + 6) + '" cy="' + (y + 34) + '" rx="22" ry="5" fill="rgba(0,0,0,0.18)"/><rect x="' + (x - 3) + '" y="' + y + '" width="6" height="32" fill="#7a5230"/><circle cx="' + x + '" cy="' + (y - 4) + '" r="20"/><circle cx="' + (x - 14) + '" cy="' + (y + 6) + '" r="13"/><circle cx="' + (x + 14) + '" cy="' + (y + 7) + '" r="13"/>';
      }).join('') + '</g></svg>';
  }

  Map.show = function () {
    Stage.hidden = true; // the map covers the 3D view, so there is no need to draw it
    K.App.setScreen('map');
    var next = LEVELS.filter(function (l) { return Pg.isOpen(l.id) && !(Pg.data.stars[l.id] >= 1); })[0];
    var nodes = LEVELS.map(function (l) {
      var st = Pg.data.stars[l.id] || 0, isOpen = Pg.isOpen(l.id), cls = st ? 'is-done' : isOpen ? 'is-open' : 'is-locked';
      var here = next && next.id === l.id;
      return '<div class="w-stop' + (l.x > 50 ? ' is-right' : '') + '" style="left:' + l.x + '%;bottom:' + l.y + '%">' +
        (here ? '<span class="w-pip">' + W.pip() + '</span>' : '') +
        '<button type="button" class="node ' + cls + '" style="--c:' + l.color + '" data-lv="go" data-id="' + l.id + '"' + (isOpen ? '' : ' disabled') +
        ' aria-label="Level ' + l.id + ', ' + l.title + (isOpen ? ', ' + st + ' of 3 stars' : ', locked') + '">' +
        (isOpen ? K.icon(l.icon) : K.icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')) + '</button>' +
        '<span class="w-label"><b>' + l.title + '</b>' + (isOpen ? K.starRow(st) : '') + '</span></div>';
    }).join('');
    var pts = LEVELS.map(function (l) { return [l.x, 100 - l.y - 4]; }), d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], bend = i % 2 ? 16 : -16;
      d += ' C' + (a[0] + bend) + ' ' + (a[1] - 5) + ',' + (b[0] + bend) + ' ' + (b[1] + 9) + ',' + b[0] + ' ' + b[1];
    }
    K.root.innerHTML = '<div class="world">' + scenery() +
      '<div class="w-board"><svg class="w-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d + '" class="w-road"/><path d="' + d + '" class="w-dash"/></svg>' + nodes + '</div>' +
      '<span class="star-pill">' + K.starRow(1) + '<b>' + Pg.totalStars() + '</b> / 15</span>' +
      '<button type="button" class="album-btn" data-lv="album">' + W.icon('medal') + '<b>' + (Object.keys(Pg.data.badges).length + Object.keys(Pg.data.cards).length) + '</b><span class="sr"> badges and cards. Open my collection</span></button>' +
      '<p class="map-foot"><button type="button" class="link" data-lv="unlock">' + (Pg.data.all ? 'Lock levels' : 'Unlock all') + '</button>' +
      '<button type="button" class="link" data-lv="reset">Start over</button></p></div>';
  };

  RG.LevelMap = Map;
})();
