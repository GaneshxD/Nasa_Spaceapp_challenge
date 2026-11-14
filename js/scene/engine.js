/* Orbit Ranger — 3D stage.
 * Owns the renderer, the camera rig (drag to look around, scroll or pinch to
 * zoom), the star field, text labels pinned to 3D points, and the frame loop.
 * The individual scenes (Earth, build bay, launch pad) live in other files.
 */
(function () {
  'use strict';
  var RG = window.RG;
  var THREE = window.THREE;

  // Treat every colour written as 0xRRGGBB as an sRGB colour (what a designer
  // expects), instead of three.js r149's legacy "already linear" reading.
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  // The renderer uses filmic tone mapping so lit, physically based surfaces
  // (the satellite, the rocket) keep detail in their highlights. Unlit
  // materials are used here for glows, rings, labels and paint, whose colours
  // are chosen by eye, so they opt out of tone mapping.
  ['MeshBasicMaterial', 'SpriteMaterial', 'PointsMaterial', 'LineBasicMaterial', 'LineDashedMaterial'].forEach(function (name) {
    var Base = THREE[name];
    THREE[name] = class extends Base {
      constructor(params) { super(params); this.toneMapped = false; }
    };
  });

  var Stage = {
    ready: false,
    renderer: null, scene: null, camera: null,
    frameFns: [],
    labels: [],
    reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    // Quality steps down by itself on slow computers: 2 = everything, 1 = fewer
    // pixels, 0 = no shadows either. Add ?quality=high to the address to pin it.
    quality: 2,
    adaptive: !/[?&]quality=high/.test(window.location.search),
    shadowLights: []
  };
  var perf = { time: 0, frames: 0, warm: 0 };

  /* Camera rig: the camera sits on a sphere around `target`.
   * az is measured like longitude (east positive), el like latitude. */
  var rig = {
    target: new THREE.Vector3(), az: 0.5, el: 0.3, radius: 4,
    goal: { target: new THREE.Vector3(), az: 0.5, el: 0.3, radius: 4 },
    minR: 1.6, maxR: 30, minEl: -1.35, maxEl: 1.35,
    frame: 0,       // extra azimuth added by a rotating frame (Earth-fixed views)
    autoSpin: 0,    // rad/s of idle rotation
    locked: false,  // true during cut-scenes
    idle: 0,        // seconds since the player last touched the view
    speed: 4
  };
  Stage.rig = rig;

  var offset = { x: 0, y: 0, gx: 0, gy: 0 }; // where the centre of interest sits, in CSS px from canvas centre
  var size = { w: 1, h: 1 };
  var clock = new THREE.Clock();
  var tmp = new THREE.Vector3();

  Stage.init = function (canvas) {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    Stage.renderer = renderer;
    Stage.canvas = canvas;

    Stage.scene = new THREE.Scene();
    Stage.scene.background = new THREE.Color(0x02040a);
    Stage.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 4000);

    Stage.stars = makeStars();
    Stage.scene.add(Stage.stars);
    Stage.env = makeEnvironment(renderer);
    Stage.scene.environment = Stage.env; // reflections for every physically based material

    Stage.labelLayer = document.getElementById('labels');
    bindPointer(canvas);
    window.addEventListener('resize', Stage.resize);
    Stage.resize();
    Stage.ready = true;
    renderer.setAnimationLoop(tick);
    return true;
  };

  Stage.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    size.w = w; size.h = h;
    Stage.renderer.setSize(w, h, false);
    Stage.camera.aspect = w / h;
    Stage.camera.updateProjectionMatrix();
  };

  Stage.onFrame = function (fn) { Stage.frameFns.push(fn); };

  /** Shift the centre of the 3D view so it is not hidden behind UI panels. */
  Stage.setOffset = function (x, y, instant) {
    offset.gx = x; offset.gy = y;
    if (instant) { offset.x = x; offset.y = y; }
  };

  /** Move the camera. Any of {target, az, el, radius}; `instant` skips the glide. */
  Stage.look = function (o, instant) {
    var g = rig.goal;
    if (o.target) g.target.copy(o.target);
    if (o.az != null) g.az = o.az;
    if (o.el != null) g.el = o.el;
    if (o.radius != null) g.radius = o.radius;
    if (o.minR != null) rig.minR = o.minR;
    if (o.maxR != null) rig.maxR = o.maxR;
    if (o.autoSpin != null) rig.autoSpin = o.autoSpin;
    if (o.speed != null) rig.speed = o.speed;
    if (instant || Stage.reducedMotion) {
      rig.target.copy(g.target); rig.az = g.az; rig.el = g.el; rig.radius = g.radius;
    }
  };

  function tick() {
    var raw = clock.getDelta(), dt = Math.min(raw, 0.1);
    if (Stage.hidden) return; // a full-screen page is covering the 3D view
    var time = clock.elapsedTime;
    watchSpeed(raw);
    for (var i = 0; i < Stage.frameFns.length; i++) Stage.frameFns[i](dt, time);

    /* glide the camera toward its goal */
    var g = rig.goal;
    rig.idle += dt;
    if (rig.autoSpin && rig.idle > 2.5 && !Stage.reducedMotion) g.az += rig.autoSpin * dt;
    var k = 1 - Math.exp(-dt * rig.speed);
    rig.az += (g.az - rig.az) * k;
    rig.el += (g.el - rig.el) * k;
    rig.radius += (g.radius - rig.radius) * k;
    rig.target.lerp(g.target, k);
    var a = rig.az + rig.frame, ce = Math.cos(rig.el);
    var cam = Stage.camera;
    // on tall, narrow screens step back so the subject still fits across the width
    var r = rig.radius * Math.max(1, 1.25 / cam.aspect);
    cam.position.set(
      rig.target.x + r * ce * Math.cos(a),
      rig.target.y + r * Math.sin(rig.el),
      rig.target.z - r * ce * Math.sin(a)
    );
    if (Stage.shake) {
      cam.position.x += (Math.random() - 0.5) * Stage.shake;
      cam.position.y += (Math.random() - 0.5) * Stage.shake;
    }
    cam.lookAt(rig.target);

    offset.x += (offset.gx - offset.x) * k;
    offset.y += (offset.gy - offset.y) * k;
    if (Math.abs(offset.x) > 0.5 || Math.abs(offset.y) > 0.5) {
      cam.setViewOffset(size.w, size.h, offset.x, offset.y, size.w, size.h);
    } else if (cam.view && cam.view.enabled) {
      cam.clearViewOffset();
    }

    Stage.stars.position.copy(cam.position);
    Stage.renderer.render(Stage.scene, cam);
    placeLabels(cam);
  }

  /** If frames are slow for a while, trade some polish for smoothness. */
  function watchSpeed(raw) {
    if (!Stage.adaptive || Stage.quality === 0 || raw > 0.5) return; // long gaps are a hidden tab, not a slow one
    if (perf.warm < 40) { perf.warm++; return; }                      // ignore start-up
    perf.time += raw; perf.frames++;
    if (perf.frames < 50) return;
    var average = perf.time / perf.frames;
    perf.time = 0; perf.frames = 0;
    if (average < 0.045) return;
    Stage.quality--;
    if (Stage.quality === 1 && Stage.renderer.getPixelRatio() > 1) {
      Stage.renderer.setPixelRatio(1);
      Stage.resize();
    } else {
      Stage.quality = 0;
      Stage.shadowLights.forEach(function (l) { l.castShadow = false; });
    }
  }

  /* ---------- pointer control ---------- */
  function bindPointer(canvas) {
    var pts = {}, pinch = 0;
    function count() { return Object.keys(pts).length; }
    canvas.addEventListener('pointerdown', function (e) {
      if (rig.locked) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      canvas.classList.add('is-grabbing');
      if (count() === 2) pinch = spread();
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = pts[e.pointerId];
      if (!p || rig.locked) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      rig.idle = 0;
      if (count() === 1) {
        rig.goal.az -= dx * 0.006;
        rig.goal.el = clamp(rig.goal.el + dy * 0.006, rig.minEl, rig.maxEl);
      } else if (count() === 2) {
        var s = spread();
        if (pinch > 0 && s > 0) rig.goal.radius = clamp(rig.goal.radius * (pinch / s), rig.minR, rig.maxR);
        pinch = s;
      }
    });
    function up(e) {
      delete pts[e.pointerId];
      if (!count()) canvas.classList.remove('is-grabbing');
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', function (e) {
      if (rig.locked) return;
      e.preventDefault();
      rig.idle = 0;
      rig.goal.radius = clamp(rig.goal.radius * Math.exp(e.deltaY * 0.0012), rig.minR, rig.maxR);
    }, { passive: false });
    // keyboard: arrow keys turn the view, + and − zoom
    canvas.addEventListener('keydown', function (e) {
      if (rig.locked) return;
      var used = true;
      if (e.key === 'ArrowLeft') rig.goal.az += 0.15;
      else if (e.key === 'ArrowRight') rig.goal.az -= 0.15;
      else if (e.key === 'ArrowUp') rig.goal.el = clamp(rig.goal.el + 0.1, rig.minEl, rig.maxEl);
      else if (e.key === 'ArrowDown') rig.goal.el = clamp(rig.goal.el - 0.1, rig.minEl, rig.maxEl);
      else if (e.key === '+' || e.key === '=') rig.goal.radius = clamp(rig.goal.radius * 0.88, rig.minR, rig.maxR);
      else if (e.key === '-') rig.goal.radius = clamp(rig.goal.radius * 1.14, rig.minR, rig.maxR);
      else used = false;
      if (used) { rig.idle = 0; e.preventDefault(); }
    });
    function spread() {
      var k = Object.keys(pts);
      if (k.length < 2) return 0;
      return Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y);
    }
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- labels pinned to 3D points ---------- */

  /**
   * Add a text label that follows a point in the scene.
   * opts.at(): returns a THREE.Vector3 in world space (called every frame)
   * opts.earth: hide the label when the planet (unit sphere at origin) is in the way
   */
  Stage.addLabel = function (text, cls, opts) {
    var el = document.createElement('div');
    el.className = 'pin ' + (cls || '');
    el.textContent = text;
    Stage.labelLayer.appendChild(el);
    if (opts.onClick) { // a label the player can press, like a button
      el.classList.add('pin-btn');
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.addEventListener('click', function () { opts.onClick(el); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(el); } });
    }
    var label = { el: el, at: opts.at, earth: !!opts.earth, shown: false, group: opts.group || '' };
    Stage.labels.push(label);
    return label;
  };

  Stage.clearLabels = function (group) {
    Stage.labels = Stage.labels.filter(function (l) {
      if (group && l.group !== group) return true;
      l.el.remove();
      return false;
    });
  };

  function placeLabels(cam) {
    for (var i = 0; i < Stage.labels.length; i++) {
      var l = Stage.labels[i];
      var p = l.at();
      var show = !!p;
      if (show && l.earth) show = !hiddenByEarth(cam.position, p);
      if (show) {
        tmp.copy(p).project(cam);
        show = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
        if (show) {
          var x = (tmp.x * 0.5 + 0.5) * size.w, y = (-tmp.y * 0.5 + 0.5) * size.h;
          l.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        }
      }
      if (show !== l.shown) { l.el.classList.toggle('is-on', show); l.shown = show; }
    }
  }

  /** Does the unit sphere at the origin block the line from the camera to p? */
  function hiddenByEarth(camPos, p) {
    var dx = p.x - camPos.x, dy = p.y - camPos.y, dz = p.z - camPos.z;
    var len2 = dx * dx + dy * dy + dz * dz;
    var t = -(camPos.x * dx + camPos.y * dy + camPos.z * dz) / len2; // closest approach to the origin
    if (t <= 0 || t >= 0.999) return false;
    var cx = camPos.x + dx * t, cy = camPos.y + dy * t, cz = camPos.z + dz * t;
    return cx * cx + cy * cy + cz * cz < 0.985;
  }

  /* ---------- sky ---------- */
  function makeStars() {
    var n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    var rnd = seeded(7);
    for (var i = 0; i < n; i++) {
      var u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 60;
      pos[i * 3] = r * s * Math.cos(a); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(a);
      var b = 0.35 + Math.pow(rnd(), 3) * 0.65, tint = rnd();
      col[i * 3] = b * (tint > 0.8 ? 1 : 0.86);
      col[i * 3 + 1] = b * 0.9;
      col[i * 3 + 2] = b * (tint < 0.25 ? 1 : 0.88);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var mat = new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true,
      depthTest: false, depthWrite: false, fog: false
    });
    var pts = new THREE.Points(geo, mat);
    pts.renderOrder = -10;
    pts.frustumCulled = false;
    return pts;
  }

  /**
   * A studio to reflect: a dark room with bright light panels, rendered once
   * into a blurred, high-dynamic-range reflection map. Metal, foil and glass
   * pick up these panels as long soft highlights.
   */
  function makeEnvironment(renderer) {
    var room = new THREE.Scene();
    function panel(w, h, x, y, z, bright, tint) {
      var m = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint || 0xffffff).multiplyScalar(bright), side: THREE.DoubleSide });
      var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      p.position.set(x, y, z);
      p.lookAt(0, 0, 0);
      room.add(p);
    }
    room.add(new THREE.Mesh(new THREE.BoxGeometry(40, 24, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8a94a4).multiplyScalar(0.75), side: THREE.BackSide })));
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4a5464).multiplyScalar(0.6) }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -6;
    room.add(floor);
    panel(14, 9, 2, 11.5, 3, 9);                 // big overhead soft box
    panel(3, 12, -14, 3, 6, 7, 0xcfe0ff);        // cool strip, left
    panel(3, 12, 15, 2, -4, 6, 0xfff0dd);        // warm strip, right
    panel(10, 2.2, 0, 4, -17, 5, 0xdde8ff);      // back strip
    panel(4, 4, -6, 6, 15, 10, 0xfff6ea);        // key, front left
    panel(1.6, 7, 9, 1, 15, 5);                  // thin front strip
    var pm = new THREE.PMREMGenerator(renderer);
    var env = pm.fromScene(room, 0.035).texture;
    room.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pm.dispose();
    return env;
  }

  function seeded(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  Stage.seeded = seeded;

  /* ---------- small shared helpers ---------- */

  /** Ease used for part pop-ins and camera cuts. */
  Stage.easeOutBack = function (t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  Stage.smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  Stage.clamp = clamp;

  /** Free every geometry and material under an object. */
  Stage.dispose = function (obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
          if (m.userData.shared) return; // library materials are reused by the next build
          if (m.map && !m.map.userData.shared) m.map.dispose();
          m.dispose();
        });
      }
    });
  };

  RG.Stage = Stage;
})();
