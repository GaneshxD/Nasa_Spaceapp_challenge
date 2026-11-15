/* Orbit Ranger — Level 1: meet the rocket.
 * Tap a name on the 3D rocket to x-ray that part, with numbered call-outs,
 * then answer a three-question quiz.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE;
  var Stage = RG.Stage, R = RG.Rocket, A = RG.Audio, W = RG.Widgets;
  var K = RG.LevelKit;
  var say = K.say, bar = K.bar, side = K.side;
  var complete = K.complete, failed = K.failed, DEFAULT_SAT = K.DEFAULT_SAT;
  RG.LevelDefs = RG.LevelDefs || {};

  var PARTS = [
    // say: what Pip says (and reads aloud), with the technical words marked. why: what the part changes for the mission.
    // vb: the part of the x-ray drawing to zoom in on. marks: [point x, y, badge x, y, what it is]
    { key: 'satellite', name: 'Satellite', term: 'payload', say: 'The passenger. It rides inside the {fairing|nose cone}, and the whole rocket exists to carry it. Engineers call it the {payload}.',
      why: 'The payload sizes everything else: a heavier satellite needs more thrust and more propellant.', fact: 'The payload is only a few percent of the mass on the pad.',
      vb: [60, 0, 240, 140], marks: [[180, 63, 252, 40, 'The satellite, folded up small.'], [163, 63, 104, 52, 'Solar wings stay folded for the ride.'], [205, 84, 256, 104, 'In space the nose cone splits open.']] },
    { key: 'lox', name: 'Oxygen tank', term: 'lox', say: '{lox|Liquid oxygen} at −183 °C. Fire needs oxygen and space has no air, so the rocket carries its own.',
      why: 'Without it the engines would go out as soon as the air ran thin.', fact: 'The engines burn 6 kg of oxygen with every 1 kg of hydrogen.',
      vb: [60, 132, 240, 100], marks: [[180, 186, 256, 172, 'Liquid oxygen, colder than any freezer.'], [168, 168, 100, 160, 'The level sinks as the engines drink.'], [200, 222, 256, 216, 'A pipe carries it down to the engines.']] },
    { key: 'gyro', name: 'Gyroscope', term: 'gyro', say: 'A {gyro|gyroscope} feels which way the rocket is tipping, so the flight computer can steer it back.',
      why: 'A rocket is like a pencil balanced on a fingertip. Without constant small corrections it falls over.', fact: 'It measures three turns: pitch (nose up or down), yaw (left or right) and roll (spin).',
      vb: [110, 100, 140, 76], marks: [[180, 137, 226, 116, 'A spinning wheel always points the same way.'], [160, 137, 132, 160, 'Sensors feel the rocket tilt around it.'], [200, 137, 232, 162, 'The computer swivels the engines to steer back.']] },
    { key: 'lh2', name: 'Hydrogen tank', term: 'lh2', say: '{lh2|Liquid hydrogen} at −253 °C. This is the fuel. It is so light that it needs the biggest tank.',
      why: 'A light fuel adds the most speed for each kilogram burned. That is worth the giant tank.', fact: 'The orange foam on NASA’s SLS keeps the hydrogen cold.',
      vb: [60, 202, 240, 160], marks: [[180, 290, 256, 270, 'Liquid hydrogen: the fuel.'], [153, 305, 100, 305, 'Foam on the outside keeps it cold.'], [180, 348, 256, 344, 'Fuel flows out of the bottom.']] },
    { key: 'engines', name: 'Engines', term: 'engine', say: 'The {engine|engines} burn hydrogen with oxygen and throw the hot gas downward. The push that gives is called {thrust}.',
      why: 'Thrust has to be bigger than the rocket’s weight, or it never leaves the pad.', fact: 'NASA’s RS-25 first flew on the Space Shuttle. Its exhaust is steam.',
      vb: [90, 335, 180, 105], marks: [[180, 358, 246, 348, 'Pumps squirt hydrogen and oxygen together.'], [162, 378, 112, 372, 'The bell shape aims the fire straight down.'], [198, 408, 246, 418, 'The exhaust is steam: just water!']] },
    { key: 'boosters', name: 'Boosters', term: 'booster', say: '{booster|Solid rocket boosters}: a giant extra push for two minutes. Then they are dropped, which is called {staging}.',
      why: 'They push hardest at lift-off, exactly when the rocket is heaviest. Empty, they are dead weight.', fact: 'On NASA’s SLS they give more than three quarters of the thrust at lift-off.',
      vb: [60, 138, 240, 280], marks: [[130, 162, 84, 162, 'A pointed nose cuts through the air.'], [230, 270, 276, 270, 'Solid fuel burns from the middle out.'], [130, 380, 84, 392, 'Once lit, it cannot be switched off.']] }
  ];

  /** The whole rocket as an x-ray. Every part is drawn; the chosen one glows and the view zooms in on it. */
  function xray(p) {
    function g(key, body) { return '<g class="xr' + (key === p.key ? ' on' : '') + '" data-p="' + key + '">' + body + '</g>'; }
    function bell(x) { return '<circle cx="' + x + '" cy="358" r="4"/><path d="M' + (x - 5) + ' 366h10l4 22h-18z"/><path class="xr-flame" d="M' + (x - 8) + ' 389h16l-8 34z"/>'; }
    function booster(x) {
      return '<path d="M' + (x - 12) + ' 172L' + x + ' 148l12 24v200h-24z"/><rect class="xr-fill" x="' + (x - 8) + '" y="178" width="16" height="190" rx="3"/><path class="xr-flow" d="M' + x + ' 182v184"/>' +
        '<path d="M' + (x - 8) + ' 372h16l4 14h-24z"/><path class="xr-flame" d="M' + (x - 10) + ' 387h20l-10 30z"/>';
    }
    var r = p.vb[2] / 26, marks = p.marks.map(function (m, i) {
      return '<path class="xr-lead" d="M' + m[2] + ' ' + m[3] + 'L' + m[0] + ' ' + m[1] + '"/><circle class="xr-dot" cx="' + m[0] + '" cy="' + m[1] + '" r="' + (r / 3.5).toFixed(1) + '"/>' +
        '<circle class="xr-num" cx="' + m[2] + '" cy="' + m[3] + '" r="' + r.toFixed(1) + '"/><text x="' + m[2] + '" y="' + (m[3] + r * 0.38).toFixed(1) + '" font-size="' + (r * 1.15).toFixed(1) + '" text-anchor="middle">' + (i + 1) + '</text>';
    }).join('');
    return '<svg class="xray" viewBox="' + p.vb.join(' ') + '" role="img" aria-label="X-ray drawing of the ' + p.name.toLowerCase() + '">' +
      '<defs><pattern id="xr-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="#5fdcff" stroke-width=".3" opacity=".35"/></pattern></defs>' +
      '<rect x="0" y="-20" width="360" height="500" fill="#06203f"/><rect x="0" y="-20" width="360" height="500" fill="url(#xr-grid)"/>' +
      g('boosters', booster(130) + booster(230) + '<path d="M142 200h10M142 330h10M208 200h10M208 330h10"/>') +
      '<g class="xr"><rect x="152" y="92" width="56" height="258"/><ellipse cx="180" cy="106" rx="18" ry="9"/><path d="M174 116h12l5 14h-22zM152 206l56 10M208 206l-56 10"/></g>' +
      g('satellite', '<path d="M152 92C152 50 168 22 180 12c12 10 28 38 28 80z"/><g class="xr-pulse"><rect class="xr-fill" x="170" y="52" width="20" height="22" rx="2"/><path d="M158 58h10v10h-10zM192 58h10v10h-10zM180 52v-7"/><circle cx="180" cy="43" r="2.5"/></g>') +
      g('gyro', '<rect x="152" y="130" width="56" height="14"/><circle cx="180" cy="137" r="5"/><ellipse class="xr-spin" cx="180" cy="137" rx="10" ry="3"/><path d="M160 133v8M200 133v8"/>') +
      g('lox', '<path class="xr-fill ox" d="M156 160a24 12 0 0 1 48 0v34a24 12 0 0 1-48 0z"/><path class="xr-wave" d="M157 168q6-4 12 0t12 0 12 0 10 0"/><path class="xr-flow" d="M200 204V352"/>') +
      g('lh2', '<path class="xr-fill h2" d="M156 230a24 12 0 0 1 48 0v102a24 12 0 0 1-48 0z"/><path class="xr-wave" d="M157 240q6-4 12 0t12 0 12 0 10 0"/><path class="xr-flow" d="M180 344v10"/>') +
      g('engines', '<path d="M152 350h56v14h-56z"/>' + bell(162) + bell(180) + bell(198)) + marks + '</svg>' +
      '<ol class="xr-key">' + p.marks.map(function (m) { return '<li>' + m[4] + '</li>'; }).join('') + '</ol>';
  }
  var QUIZ = [
    { q: 'Which tank is the biggest?', a: ['Hydrogen', 'Oxygen', 'Same size'], ok: 0, why: 'Liquid hydrogen is very light, so the same mass of it takes up far more room.' },
    { q: 'Why does a rocket carry oxygen?', a: ['To cool the satellite', 'Space has no air for the fire', 'To be lighter'], ok: 1, why: 'Fire needs an oxidizer, and above the atmosphere there is none.' },
    { q: 'What do boosters do?', a: ['Extra thrust, then drop away', 'Steer the rocket', 'Carry the satellite'], ok: 0, why: 'They add thrust for two minutes and are dropped when empty. That is staging.' },
    { q: 'What must thrust beat for lift-off?', a: ['The speed of sound', 'The rocket’s weight', 'The wind'], ok: 1, why: 'If thrust is smaller than weight, the rocket sits on the pad burning propellant.' }
  ];

  RG.LevelDefs[1] = function () {
    var seen = {}, pins = {}, qi = -1, right = 0, answered = false, timer = 0;
    R.setBuild({ tank: 'M', engines: 'E3', boosters: 'two', top: true, satellite: DEFAULT_SAT });
    K.App.view('rk-parts');
    PARTS.forEach(function (p) {
      pins[p.key] = Stage.addLabel(p.name, 'pin-part', { group: 'part', at: function () { return R.partPos(p.key); }, onClick: function () { select(p.key); } });
    });
    say('Tap a name on the rocket to x-ray that part. Words with a dotted line can be tapped too.');
    Stage.look({ radius: R.height * 1.45 + 30, az: -Math.PI / 2 + 0.25, el: 0.12 });

    function count() { return Object.keys(seen).length; }
    function dots() { return '<span class="dots" aria-label="' + count() + ' of ' + PARTS.length + ' found">' + PARTS.map(function (x) { return '<i class="' + (seen[x.key] ? 'on' : '') + '"></i>'; }).join('') + '</span>'; }
    function select(key) {
      var p = PARTS.filter(function (x) { return x.key === key; })[0];
      seen[key] = true;
      A.play('pick');
      R.setPeek(key === 'satellite');
      pins[key].el.classList.add('is-seen');
      var pos = R.partPos(key);
      Stage.look({ target: new THREE.Vector3(0, pos.y, 0), radius: key === 'satellite' ? 44 : 62 });
      var left = PARTS.length - count();
      side('<div class="info"><h3>' + W.term(p.term, p.name) + dots() + '</h3>' + xray(p) +
        '<p class="why-line"><i>Why it matters</i>' + p.why + '</p><p class="nasa-fact">' + p.fact + '</p></div>' +
        (left ? '<p class="foot-note">' + left + ' more to find.</p>' : '<button type="button" class="btn primary big wide" data-lv="quiz">Quiz time</button>'));
      bar(count() / PARTS.length * 0.5);
      say(p.say, left ? 'wow' : 'cheer');
    }
    function ask() {
      qi++; answered = false;
      if (qi >= QUIZ.length) {
        if (right) complete(1, right >= QUIZ.length ? 3 : right >= QUIZ.length - 1 ? 2 : 1, 'You know your rocket!', right + ' of ' + QUIZ.length + ' right', [right === QUIZ.length && 'expert'],
          { words: ['payload', 'fairing', 'lox', 'lh2', 'mixture', 'engine', 'thrust', 'weight', 'booster', 'staging', 'gyro'] });
        else failed(1, 'Have another look', 'X-ray the parts again, then retry the quiz.');
        return;
      }
      var q = QUIZ[qi];
      say('[[Question ' + (qi + 1) + ' of ' + QUIZ.length + '. ]]' + q.q);
      side('<h2>' + q.q + '</h2><div class="answers">' + q.a.map(function (t, i) {
        return '<button type="button" class="answer" data-lv="answer" data-i="' + i + '">' + t + '</button>';
      }).join('') + '</div>');
      bar(0.5 + (qi / QUIZ.length) * 0.5);
    }
    return {
      quiz: function () { Stage.clearLabels('part'); R.setPeek(false); Stage.look({ target: new THREE.Vector3(0, R.height * 0.5, 0), radius: R.height * 1.7 + 36 }); ask(); },
      answer: function (el) {
        if (answered) return;
        answered = true;
        var q = QUIZ[qi], good = +el.dataset.i === q.ok, all = document.querySelectorAll('.answer');
        if (good) right++;
        A.play(good ? 'go' : 'bad');
        el.classList.add(good ? 'is-right' : 'is-wrong');
        all[q.ok].classList.add('is-right');
        Array.prototype.forEach.call(all, function (b) { b.disabled = true; });
        say((good ? 'Yes! ' : 'Not quite. ') + q.why, good ? 'cheer' : 'worry', [good ? 'yes' : 'notquite', RG.Voice.key(q.why)]); // two recordings, one after the other
        // moves on by itself, once there has been time to read why (and a tap on Next skips the wait)
        document.querySelector('.answers').insertAdjacentHTML('afterend', '<button type="button" class="btn primary wide" data-lv="nextq">Next</button>');
        timer = setTimeout(ask, good ? 3200 : 5200);
      },
      nextq: function () { clearTimeout(timer); ask(); },
      cleanup: function () { clearTimeout(timer); R.setPeek(false); }
    };
  };
})();
