/* Orbit Ranger — mission designer: the help, NASA data, mission code and mission log dialogs.
 */
(function () {
  'use strict';
  var RG = window.RG, X = RG.Designer, W = RG.Widgets;
  var esc = W.esc;
  var recentWeek = X.recentWeek, openDialog = X.openDialog, okButton = X.okButton;

  function showHelp() {
    openDialog('<h2 id="dialog-title">How to play</h2><ol class="howto">' +
      '<li>Read the mission, then make seven choices, one step at a time.</li>' +
      '<li>Tap a part to pick it, or drag it onto its glowing slot. The little numbers show its mass, power, data and price, and the face tells you how it fits your design.</li>' +
      '<li>Watch the gauges at the bottom. Red means something does not add up.</li>' +
      '<li>Drag the 3D view to look around. Scroll or pinch to zoom.</li>' +
      '<li>Launch, watch three years of fires, then read the report and try to do better.</li></ol>' +
      '<p style="margin-top:12px"><b>Every word and every gauge explains itself.</b> Tap a word with a dotted line, or any instrument, to see what it means, why it matters and a real number. A flight waits while you read. The <b>Words</b> button lists them all, and the speaker button reads the guide’s line again.</p>' +
      '<p>The sound button has three settings: sound and voice, sound only, and off.</p>' +
      '<p><b>Level 6, the Moon.</b> Choose a landing site, a science kit and who flies. Then make one pass around the back of the Moon: watch the radio link to Earth, and fire the deorbit burn when the clock reaches zero (the button, or the space bar). In the descent, hold the button that lights up: pitch back to slow down, pitch forward to move on. The steering settles by itself as it nears the pitch the computer wants, so a late press does not send the lander swinging. Arrow keys or A and D pitch the lander; with your own hand on the throttle, the up and down arrows work it. On the surface, move with the arrow keys, W A S D or the stick, and jump with the space bar.</p>' +
      '<p><b>Two players.</b> The <b>2 players</b> button starts a launch flown by a crew of two on one screen. The pilot, on the left, holds the pitch with A and D or the round buttons. The flight engineer, on the right, drops the empty boosters with ↓ and the nose cone with ↑, or the two buttons. Each sees only their own gauges, so talk to each other.</p>' +
      '<p><b>Locked levels.</b> Tap one to be taken to the level to play first, or to skip ahead.</p>' +
      '<p><b>The NASA 3D hangar</b> holds every NASA model in the game. Open one to turn it around, or play Name that spacecraft.</p>' +
      '<div class="actions"><button type="button" class="btn primary" data-act="close" autofocus>Got it</button><button type="button" class="btn" data-act="words">Space words</button><button type="button" class="btn" data-act="sources">NASA data</button></div>');
  }

  function showSources() {
    var nf = RG.NASA_FIRES, r = nf.recent;
    openDialog('<h2 id="dialog-title">NASA data in this game</h2>' +
      '<p>Everything you see about the Earth and its fires comes from NASA.</p><ul class="sources">' +
      '<li><b>The fires in your mission</b>Real fires from ' + nf.archiveYear + ', found by the MODIS instruments on NASA’s Terra and Aqua satellites. Each flight uses 42 of the ' + (nf.zones.length * 9) + ' fires stored in the game. Source: NASA FIRMS, the Fire Information for Resource Management System.</li>' +
      '<li><b>The specks on the globe</b>' + W.num(r.points.length / 2) + ' of the ' + W.num(r.total) + ' fires MODIS saw from ' + recentWeek() + '. Source: NASA FIRMS.</li>' +
      '<li><b>The Earth</b>By day: Blue Marble Next Generation, August 2004. By night: Black Marble 2016, made with the VIIRS instrument on Suomi NPP. Source: NASA GIBS, Global Imagery Browse Services.</li>' +
      '<li><b>Ground stations</b>Wallops, McMurdo, Fairbanks and White Sands are real stations of NASA’s Near Space Network.</li>' +
      '<li><b>' + RG.Models.all().length + ' 3D models</b>Spacecraft, rockets, suits, tools, asteroids and worlds from NASA 3D Resources (science.nasa.gov/3d-resources), made smaller for phones. The lander and the astronaut in level 6 are NASA’s models.</li>' +
      '<li><b>The voice</b>The guide’s spoken lines in level 6 were made with Higgsfield (Seed Audio, voice “Nadine”). They are not NASA recordings.</li>' +
      '<li><b>The ground on the Moon</b>The shape of each landing site comes from NASA’s printable Apollo landing-site models, built from Lunar Reconnaissance Orbiter data.</li>' +
      '<li><b>Sensors and orbits</b>Modelled on VIIRS on Suomi NPP, the imager on GOES, the Space Station’s orbit and GOES-East’s parking spot.</li></ul>' +
      '<p><b>Made up for the game:</b> the prices and masses of parts, which pixel size catches which fire, the hour each fire starts, the surprises and the scoring. On the Moon: the width and height range of the ground, the spare mass, the oxygen clock, the flag of Nepal, and Earth drawn lower in the sky and 2.6 times its true size so you can see it. They are simplified so the game stays playable.</p>' +
      okButton('Close'));
  }

  function showCode() {
    openDialog('<h2 id="dialog-title">Use a mission code</h2><p>Type a code from a friend’s report to load their design.</p>' +
      '<p><label class="vh" for="code-in">Mission code</label><input id="code-in" class="code-box" placeholder="OR-11111111120" autocomplete="off" autocapitalize="characters" autofocus></p>' +
      '<p id="code-err" role="alert" style="color:var(--red-d);font-weight:700"></p>' +
      '<div class="actions"><button type="button" class="btn primary" data-act="load-code">Load this design</button>' +
      '<button type="button" class="btn" data-act="close">Cancel</button></div>');
  }

  function loadLog() {
    try { return JSON.parse(localStorage.getItem('orbit-ranger.log') || '[]'); } catch (e) { return []; }
  }
  function saveLog(entry) {
    try {
      var log = loadLog(); log.push(entry);
      log.sort(function (a, b) { return b.score - a.score; });
      localStorage.setItem('orbit-ranger.log', JSON.stringify(log.slice(0, 20)));
    } catch (e) { /* storage may be switched off */ }
  }
  function showLog() {
    var log = loadLog();
    var rows = log.slice(0, 10).map(function (e, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(e.crew) + '</td><td>' + esc(e.diff) + '</td><td>' + '★'.repeat(e.stars) + '</td><td><b>' + e.score + '</b></td><td>' + esc(e.code) + '</td></tr>';
    }).join('');
    openDialog('<h2 id="dialog-title">Mission log</h2>' + (rows
      ? '<table class="logtable"><thead><tr><th></th><th>Crew</th><th>Level</th><th>Stars</th><th>Points</th><th>Code</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p style="margin-top:10px;font-size:14px;color:var(--ink-soft)">Best missions flown in this browser.</p>'
      : '<p>No missions flown yet. Finish one and it will be listed here.</p>') + okButton('Close'));
  }

  X.dialogs.help = showHelp;
  X.dialogs.sources = showSources;
  X.dialogs.code = showCode;
  X.dialogs.log = showLog;
  X.saveLog = saveLog;
})();
