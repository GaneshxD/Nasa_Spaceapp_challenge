/* Orbit Ranger — the satellite the player builds.
 * A detailed, physically shaded model assembled from the chosen parts, one
 * group per part so each new choice can pop into place. One unit is one metre.
 *
 * Local axes: +Y is the instrument deck (it faces Earth in orbit), the solar
 * wings stretch along ±X, and +Z is the open service bay where the battery,
 * computer and steering hardware can be seen.
 *
 * Everything is built in code: crinkled foil, solar cells and mirror tiles are
 * procedural textures, and shapes are rounded so edges catch the light.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE;
  var D = RG.DATA, Stage = RG.Stage;

  var S = { group: null, deploy: 1 };
  var lib = null, pops = [];
  var PI = Math.PI;
  var GHOST = [1.2, 1.6, 1.2];
  var SEG = { S: [0.55, 0.7], M: [0.65, 0.9], L: [0.8, 1.1] };
  var UP = new THREE.Vector3(0, 1, 0);

  /* ====================================================================
   * Procedural textures
   * ==================================================================== */
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function texture(c, o) {
    o = o || {};
    var t = new THREE.CanvasTexture(c);
    if (o.color !== false) t.encoding = THREE.sRGBEncoding;
    t.userData.shared = true;
    if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat, o.repeatY || o.repeat); }
    t.anisotropy = 8;
    return t;
  }

  /** Crinkled foil: a normal map of flat facets, each tipped a different way. */
  function foilNormal() {
    var N = 256, n = 300, rnd = Stage.seeded(21), c = canvas(N, N), g = c.getContext('2d');
    var img = g.createImageData(N, N), d = img.data, i;
    var px = new Float32Array(n), py = new Float32Array(n), tx = new Float32Array(n), ty = new Float32Array(n);
    for (i = 0; i < n; i++) {
      px[i] = rnd() * N; py[i] = rnd() * N;
      var a = rnd() * 2 * PI, m = 0.04 + rnd() * 0.2;
      tx[i] = Math.cos(a) * m; ty[i] = Math.sin(a) * m;
    }
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var d1 = 1e9, d2 = 1e9, k = 0;
        for (i = 0; i < n; i++) {
          var dx = Math.abs(x - px[i]), dy = Math.abs(y - py[i]);
          if (dx > N / 2) dx = N - dx;
          if (dy > N / 2) dy = N - dy;
          var dd = dx * dx + dy * dy;
          if (dd < d1) { d2 = d1; d1 = dd; k = i; } else if (dd < d2) d2 = dd;
        }
        var edge = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / 2.5); // 0 on a crease
        // each facet is nearly flat, with a fine wrinkle on top and a soft roll-off at its creases
        var nx = tx[k] * (0.5 + 0.5 * edge) + (rnd() - 0.5) * 0.035, ny = ty[k] * (0.5 + 0.5 * edge) + (rnd() - 0.5) * 0.035;
        var nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
        var o = (y * N + x) * 4;
        d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return texture(c, { color: false, repeat: 1.35 });
  }

  /** Quilted white insulation blanket. */
  function quiltTexture() {
    var c = canvas(256, 256), g = c.getContext('2d');
    g.fillStyle = '#f3f4f6'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(105,114,128,0.6)'; g.lineWidth = 3;
    for (var i = -256; i < 512; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke();
      g.beginPath(); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke();
    }
    return texture(c, { repeat: 2.2 });
  }

  /** Solar cells: colour, plus a map saying where the surface is glossy. */
  function cellTextures() {
    var W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d'), o = canvas(W, H), q = o.getContext('2d');
    var rnd = Stage.seeded(4);
    g.fillStyle = '#b39a5f'; g.fillRect(0, 0, W, H);          // amber backing sheet between cells
    q.fillStyle = 'rgb(0,175,0)'; q.fillRect(0, 0, W, H);     // rough, not metallic
    var cols = 6, rows = 8, cw = W / cols, ch = H / rows, pad = 3, cut = 9;
    for (var r = 0; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        var x0 = col * cw + pad, y0 = r * ch + pad, w = cw - 2 * pad, h = ch - 2 * pad;
        [g, q].forEach(function (k) {
          k.beginPath();
          k.moveTo(x0 + cut, y0); k.lineTo(x0 + w - cut, y0); k.lineTo(x0 + w, y0 + cut); k.lineTo(x0 + w, y0 + h - cut);
          k.lineTo(x0 + w - cut, y0 + h); k.lineTo(x0 + cut, y0 + h); k.lineTo(x0, y0 + h - cut); k.lineTo(x0, y0 + cut); k.closePath();
        });
        var grad = g.createLinearGradient(x0, y0, x0 + w, y0 + h), v = Math.floor(rnd() * 14);
        grad.addColorStop(0, 'rgb(' + (16 + v) + ',' + (26 + v) + ',' + (92 + v) + ')');
        grad.addColorStop(1, 'rgb(6,10,' + (44 + v) + ')');
        g.fillStyle = grad; g.fill();
        q.fillStyle = 'rgb(0,34,110)'; q.fill();                // glossy and a little metallic
        g.strokeStyle = 'rgba(170,190,255,0.14)'; g.lineWidth = 1;
        for (var fy = y0 + 4; fy < y0 + h - 2; fy += 4) { g.beginPath(); g.moveTo(x0 + 2, fy); g.lineTo(x0 + w - 2, fy); g.stroke(); }
        g.fillStyle = 'rgba(214,224,240,0.85)';
        g.fillRect(x0 + w * 0.27, y0 + 2, 2, h - 4); g.fillRect(x0 + w * 0.73, y0 + 2, 2, h - 4);
        g.fillRect(x0 + w * 0.2, y0 - pad, w * 0.14, pad + 2); g.fillRect(x0 + w * 0.66, y0 - pad, w * 0.14, pad + 2);
      }
    }
    return { map: texture(c), orm: texture(o, { color: false }) };
  }

  function weaveTexture() {
    var c = canvas(64, 64), g = c.getContext('2d');
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#1b1e24' : '#2a2e37'; g.fillRect(x * 8, y * 8, 8, 8);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      if ((x + y) % 2) g.fillRect(x * 8, y * 8 + 3, 8, 2); else g.fillRect(x * 8 + 3, y * 8, 2, 8);
    }
    return texture(c, { repeat: 6 });
  }

  /** Mirror-tile radiator. */
  function tileTexture() {
    var c = canvas(256, 256), g = c.getContext('2d'), rnd = Stage.seeded(9);
    g.fillStyle = '#3a4350'; g.fillRect(0, 0, 256, 256);
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      var v = 218 + Math.floor(rnd() * 34);
      g.fillStyle = 'rgb(' + (v - 8) + ',' + (v - 2) + ',' + v + ')';
      g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29);
    }
    return texture(c, { repeat: 2.6 });
  }

  function honeycombTexture() {
    var c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#0f1319'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#27303c'; g.lineWidth = 1.5;
    for (var row = 0; row < 9; row++) for (var col = 0; col < 9; col++) {
      var cx = col * 16 + (row % 2 ? 8 : 0), cy = row * 14;
      g.beginPath();
      for (var k = 0; k < 6; k++) { var a = PI / 6 + k * PI / 3; g[k ? 'lineTo' : 'moveTo'](cx + 8.6 * Math.cos(a), cy + 8.6 * Math.sin(a)); }
      g.closePath(); g.stroke();
    }
    return texture(c, { repeat: 5 });
  }

  function coilTexture() {
    var c = canvas(8, 64), g = c.getContext('2d');
    for (var y = 0; y < 64; y += 4) { g.fillStyle = '#d98a45'; g.fillRect(0, y, 8, 2); g.fillStyle = '#8a4a1c'; g.fillRect(0, y + 2, 8, 2); }
    return texture(c, { repeat: 1, repeatY: 6 });
  }

  /** The name plate on the side of the body. Redrawn once the display font has loaded. */
  function drawPlate(c) {
    var g = c.getContext('2d'), W = c.width, H = c.height;
    g.fillStyle = '#f2f4f6'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#9aa3ad'; g.lineWidth = 6; g.strokeRect(10, 10, W - 20, H - 20);
    var cx = 150, cy = H / 2, r = 92;                      // the mission patch
    g.fillStyle = '#0f2137'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.fillStyle = '#2563c9'; g.beginPath(); g.arc(cx, cy, 46, 0, 7); g.fill();
    g.fillStyle = '#128a5e'; g.beginPath(); g.ellipse(cx - 6, cy - 8, 30, 15, -0.3, 0, 7); g.fill();
    g.save(); g.translate(cx, cy); g.rotate(-0.45);
    g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.ellipse(0, 0, 80, 30, 0, 0, 7); g.stroke(); g.restore();
    g.fillStyle = '#f2542d'; g.beginPath(); g.arc(cx + 68, cy - 42, 13, 0, 7); g.fill();
    g.fillStyle = '#0f2137'; g.textBaseline = 'middle';
    g.font = "700 124px Fredoka, 'Arial Black', Arial, sans-serif";
    g.fillText('RANGER-1', 280, H / 2 - 26);
    g.font = "600 44px Fredoka, Arial, sans-serif";
    g.fillStyle = '#d43d20';
    g.fillText('WILDFIRE WATCH', 284, H / 2 + 62);
  }
  function plateTexture() {
    var c = canvas(1024, 256);
    drawPlate(c);
    var t = texture(c);
    if (document.fonts && document.fonts.load) {
      document.fonts.load("700 124px Fredoka").then(function () { drawPlate(c); t.needsUpdate = true; }, function () { /* keep the fallback font */ });
    }
    return t;
  }

  function floorTexture() {
    var c = canvas(512, 512), g = c.getContext('2d'), rnd = Stage.seeded(31);
    g.fillStyle = '#3b4350'; g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 2600; i++) {
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
      g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    g.strokeStyle = 'rgba(12,16,22,0.55)'; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512);
    return texture(c, { repeat: 36 });
  }

  /** Yellow and black keep-clear ring painted on the floor around the turntable. */
  function hazardTexture() {
    var N = 1024, c = canvas(N, N), g = c.getContext('2d'), n = 72;
    for (var i = 0; i < n; i++) {
      var a0 = (i / n) * 2 * PI, a1 = ((i + 1) / n) * 2 * PI;
      g.fillStyle = i % 2 ? '#15181d' : '#f2b705';
      g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 4, a0, a1); g.arc(N / 2, N / 2, N / 2 - 62, a1, a0, true); g.closePath(); g.fill();
    }
    return texture(c);
  }

  /* ====================================================================
   * Material library (made once, shared by every build)
   * ==================================================================== */
  function library() {
    if (lib) return lib;
    var fn = foilNormal(), quilt = quiltTexture(), cells = cellTextures(), V2 = THREE.Vector2;
    function std(o) { var m = new THREE.MeshStandardMaterial(o); m.userData.shared = true; return m; }
    function phys(o) { var m = new THREE.MeshPhysicalMaterial(o); m.userData.shared = true; return m; }
    function glow(color) { var m = new THREE.MeshBasicMaterial({ color: color }); m.userData.shared = true; return m; }
    var foil = { metalness: 1, normalMap: fn, normalScale: new V2(1, 1) };
    function foilMat(color, rough, extra) {
      var o = { color: color, roughness: rough, envMapIntensity: 1.4 }, k;
      for (k in foil) o[k] = foil[k];
      for (k in extra || {}) o[k] = extra[k];
      return std(o);
    }
    lib = {
      foilGold: foilMat(0xe6ad3e, 0.33),
      foilGold2: foilMat(0xe6ad3e, 0.33, { side: THREE.DoubleSide }),
      foilSilver: foilMat(0xdde4ec, 0.26),
      foilBlack: foilMat(0x17181d, 0.42, { metalness: 0.75 }),
      quilt: std({ map: quilt, bumpMap: quilt, bumpScale: 0.006, roughness: 0.82, metalness: 0 }),
      quilt2: std({ map: quilt, bumpMap: quilt, bumpScale: 0.006, roughness: 0.82, metalness: 0, side: THREE.DoubleSide }),
      whitePaint: std({ color: 0xeef1f4, roughness: 0.5, metalness: 0 }),
      whitePaint2: std({ color: 0xeef1f4, roughness: 0.5, metalness: 0, side: THREE.DoubleSide }),
      alu: std({ color: 0xb4bcc6, roughness: 0.3, metalness: 1 }),
      alu2: std({ color: 0xb4bcc6, roughness: 0.3, metalness: 1, side: THREE.DoubleSide }),
      aluDark: std({ color: 0x1c2027, roughness: 0.36, metalness: 0.85 }),
      steel: std({ color: 0xd6dbe2, roughness: 0.16, metalness: 1 }),
      black: std({ color: 0x07080a, roughness: 0.95, metalness: 0 }),
      baffle: std({ color: 0x0a0b0e, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
      bayWall: std({ map: honeycombTexture(), roughness: 0.65, metalness: 0.4 }),
      cells: phys({ map: cells.map, roughnessMap: cells.orm, metalnessMap: cells.orm, roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 }),
      carbon: phys({ map: weaveTexture(), roughness: 0.38, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
      osr: std({ map: tileTexture(), color: 0xf2f7ff, roughness: 0.05, metalness: 1, envMapIntensity: 1.5 }),
      lens: phys({ color: 0x070c1c, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 420], envMapIntensity: 2.2 }),
      lensViolet: phys({ color: 0x150a26, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 2.2, iridescenceThicknessRange: [300, 620], envMapIntensity: 2.2 }),
      mirrorGold: std({ color: 0xffcc6a, roughness: 0.04, metalness: 1, envMapIntensity: 1.6 }),
      mirrorGold2: std({ color: 0xffcc6a, roughness: 0.06, metalness: 1, envMapIntensity: 1.6, side: THREE.DoubleSide }),
      copper: std({ color: 0xc8733a, roughness: 0.28, metalness: 1 }),
      coil: std({ map: coilTexture(), roughness: 0.4, metalness: 0.9 }),
      brass: std({ color: 0xcaa24c, roughness: 0.22, metalness: 1 }),
      cellWrap: std({ color: 0x1e9a66, roughness: 0.42, metalness: 0.1 }),
      pcb: std({ color: 0x0e5a35, roughness: 0.45, metalness: 0.1 }),
      plate: std({ map: plateTexture(), roughness: 0.45, metalness: 0.1 }),
      standBlue: std({ color: 0x1f4f8f, roughness: 0.45, metalness: 0.3 }),
      suit: std({ color: 0xf1f4f7, roughness: 0.9, metalness: 0 }),
      glove: std({ color: 0x2f74c8, roughness: 0.6, metalness: 0 }),
      visor: phys({ color: 0x1a2a40, roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
      led: glow(0x54ffb0), ledCyan: glow(0x59d8ff), ledRed: glow(0xff4b3a), ledAmber: glow(0xffb020),
      ghost: new THREE.LineDashedMaterial({ color: 0x86a8d6, dashSize: 0.09, gapSize: 0.06, transparent: true, opacity: 0.9 })
    };
    lib.ghost.userData.shared = true;
    return lib;
  }

  /* ====================================================================
   * Shape helpers
   * ==================================================================== */
  /** A box with rounded edges, centred on the origin. */
  function rbox(w, h, d, r) {
    r = Math.min(r == null ? 0.02 : r, w / 2 - 0.0005, h / 2 - 0.0005, d / 2 - 0.0005);
    var hw = w / 2 - r, hh = h / 2 - r, c = Math.max(0.0004, Math.min(r * 0.7, hw, hh));
    var s = new THREE.Shape();
    s.moveTo(-hw + c, -hh);
    s.lineTo(hw - c, -hh); s.absarc(hw - c, -hh + c, c, -PI / 2, 0, false);
    s.lineTo(hw, hh - c); s.absarc(hw - c, hh - c, c, 0, PI / 2, false);
    s.lineTo(-hw + c, hh); s.absarc(-hw + c, hh - c, c, PI / 2, PI, false);
    s.lineTo(-hw, -hh + c); s.absarc(-hw + c, -hh + c, c, PI, 1.5 * PI, false);
    var g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 4 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    return g;
  }
  function cyl(rt, rb, h, seg, open) { return new THREE.CylinderGeometry(rt, rb, h, seg || 32, 1, !!open); }
  function torus(r, tube, seg) { return new THREE.TorusGeometry(r, tube, 10, seg || 48); }
  function add(p, geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    p.add(m);
    return m;
  }
  function slot(name) { var g = new THREE.Group(); g.userData.slot = name; return g; }
  /** A straight rod between two points. */
  function strut(p, a, b, r, mat) {
    var va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    var m = add(p, cyl(r, r, va.distanceTo(vb), 10), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, vb.sub(va).normalize());
    return m;
  }
  /** Many identical bolt heads drawn as one instanced mesh. */
  function bolts(p, pts, r, mat, axis) {
    var g = cyl(r, r, r * 1.1, 6);
    if (axis === 'z') g.rotateX(PI / 2); else if (axis === 'x') g.rotateZ(PI / 2);
    var im = new THREE.InstancedMesh(g, mat, pts.length), m4 = new THREE.Matrix4();
    for (var i = 0; i < pts.length; i++) { m4.makeTranslation(pts[i][0], pts[i][1], pts[i][2]); im.setMatrixAt(i, m4); }
    im.instanceMatrix.needsUpdate = true;
    p.add(im);
    return im;
  }
  function ringPts(R, n, y) {
    var out = [];
    for (var i = 0; i < n; i++) { var a = (i / n) * 2 * PI; out.push([Math.cos(a) * R, y, Math.sin(a) * R]); }
    return out;
  }
  /** Points around the edge of a rectangle lying in the XZ plane. */
  function rectPts(w, d, y, n) {
    var out = [], i;
    for (i = 0; i <= n; i++) { var t = -0.5 + i / n; out.push([t * w, y, d / 2], [t * w, y, -d / 2]); }
    for (i = 1; i < n; i++) { var u = -0.5 + i / n; out.push([w / 2, y, u * d], [-w / 2, y, u * d]); }
    return out;
  }
  function cable(p, pts, r, mat) {
    var curve = new THREE.CatmullRomCurve3(pts.map(function (v) { return new THREE.Vector3(v[0], v[1], v[2]); }));
    return add(p, new THREE.TubeGeometry(curve, pts.length * 10, r, 8, false), mat);
  }
  /** Part of a sphere, used for lens fronts: rim radius `rim`, bulging by `bulge`. */
  function lensCap(rim, bulge) {
    var R = (rim * rim + bulge * bulge) / (2 * bulge), th = Math.asin(Math.min(1, rim / R));
    var g = new THREE.SphereGeometry(R, 40, 12, 0, 2 * PI, 0, th);
    g.translate(0, -(R - bulge), 0); // rim sits at y = 0
    return g;
  }

  /* ====================================================================
   * The body
   * ==================================================================== */
  function partScale(w) { return Math.max(0.6, Math.min(1.5, w / 1.2)); }

  function buildBus(bus, lite) {
    var m = library(), g = slot('bus');
    var sz = bus ? bus.size : GHOST, w = sz[0], h = sz[1], d = sz[2];
    if (!bus) {
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), m.ghost);
      edges.computeLineDistances();
      g.add(edges);
      var fill = add(g, new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0x6f9be0, transparent: true, opacity: 0.06, depthWrite: false }));
      fill.userData.noShadow = true;
      return g;
    }
    var s = partScale(w), rec = 0.1 * s, barW = w * 0.085, barH = h * 0.095;
    var zf = d / 2 - rec / 2;

    // main body, set back so the front can stay open as a service bay
    add(g, rbox(w, h, d - rec, 0.035 * s), m.foilGold, 0, 0, -rec / 2);
    add(g, rbox(w, barH, rec + 0.03, 0.02 * s), m.foilGold, 0, h / 2 - barH / 2, zf - 0.015);
    add(g, rbox(w, barH, rec + 0.03, 0.02 * s), m.foilGold, 0, -h / 2 + barH / 2, zf - 0.015);
    add(g, rbox(barW, h - 2 * barH + 0.03, rec + 0.03, 0.02 * s), m.foilGold, -w / 2 + barW / 2, 0, zf - 0.015);
    add(g, rbox(barW, h - 2 * barH + 0.03, rec + 0.03, 0.02 * s), m.foilGold, w / 2 - barW / 2, 0, zf - 0.015);
    var ow = w - 2 * barW, oh = h - 2 * barH;
    add(g, new THREE.PlaneGeometry(ow, oh), m.bayWall, 0, 0, d / 2 - rec + 0.003);
    // machined trim around the opening
    var t = 0.016 * s, zt = d / 2 + 0.002;
    add(g, rbox(ow + 2 * t, t, t, 0.003), m.alu, 0, oh / 2 + t / 2, zt);
    add(g, rbox(ow + 2 * t, t, t, 0.003), m.alu, 0, -oh / 2 - t / 2, zt);
    add(g, rbox(t, oh, t, 0.003), m.alu, -ow / 2 - t / 2, 0, zt);
    add(g, rbox(t, oh, t, 0.003), m.alu, ow / 2 + t / 2, 0, zt);

    // instrument deck and base plate
    add(g, rbox(w * 1.05, 0.04, d * 1.05, 0.012), m.whitePaint, 0, h / 2 + 0.02, 0);
    add(g, rbox(w * 1.05, 0.03, d * 1.05, 0.01), m.alu, 0, -h / 2 - 0.015, 0);

    // mirror-tile radiator on the back; louvred radiators low on each side
    add(g, rbox(w * 0.8, h * 0.7, 0.018, 0.006), m.osr, 0, 0, -d / 2 - 0.007);
    [1, -1].forEach(function (side) {
      add(g, rbox(0.016, h * 0.24, d * 0.6, 0.005), m.whitePaint, side * (w / 2 + 0.006), -h * 0.31, -rec / 2);
      for (var i = 0; i < 6; i++) {
        var fin = add(g, new THREE.BoxGeometry(0.022, 0.004, d * 0.56), m.alu, side * (w / 2 + 0.024), -h * 0.31 - h * 0.1 + i * h * 0.04, -rec / 2);
        fin.rotation.z = side * 0.5;
      }
      // name plate, readable from outside on both sides
      var plate = add(g, new THREE.PlaneGeometry(d * 0.66, d * 0.165), m.plate, side * (w / 2 + 0.004), h * 0.34, -rec / 2);
      plate.rotation.y = side * PI / 2;
    });

    // launch adapter ring: where the satellite bolts to the rocket
    var R = w * 0.36, y0 = -h / 2 - 0.03;
    var prof = [[R + 0.036, -0.13], [R + 0.036, -0.116], [R + 0.014, -0.11], [R + 0.009, -0.024], [R + 0.03, -0.014], [R + 0.03, 0], [R - 0.012, 0], [R - 0.012, -0.13]];
    add(g, new THREE.LatheGeometry(prof.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 72), m.alu2, 0, y0, 0);

    // attitude thrusters at the lower corners
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
      var pod = new THREE.Group();
      add(pod, rbox(0.05, 0.07, 0.07, 0.008), m.aluDark);
      var n1 = add(pod, cyl(0.03, 0.011, 0.06, 20, true), m.alu2, 0.05, 0, 0); n1.rotation.z = -PI / 2;
      var n2 = add(pod, cyl(0.011, 0.03, 0.06, 20, true), m.alu2, 0, -0.06, 0);
      n2.userData.keep = true;
      pod.scale.set(c[0] * s, s, s);
      pod.position.set(c[0] * (w / 2 + 0.02 * s), -h / 2 + 0.11 * s, c[1] * (d / 2 - 0.14 * s) - rec / 2);
      g.add(pod);
    });

    if (!lite) {
      var deckY = h / 2 + 0.041;
      bolts(g, rectPts(w * 0.99, d * 0.99, deckY, Math.max(6, Math.round(w * 9))), 0.008 * s, m.steel);
      bolts(g, ringPts(R + 0.021, Math.max(18, Math.round(R * 60)), y0 - 0.008), 0.007 * s + 0.002, m.steel);
      var tp = [], n = Math.max(5, Math.round(ow * 8)), k;
      for (k = 0; k <= n; k++) { var fx = -ow / 2 + (k / n) * ow; tp.push([fx, oh / 2 + t / 2, zt + t / 2], [fx, -oh / 2 - t / 2, zt + t / 2]); }
      bolts(g, tp, 0.0055 * s, m.steel, 'z');
      // lifting eyes and sun sensors on the deck corners
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c, i) {
        var eye = add(g, torus(0.028 * s, 0.007 * s, 20), m.steel, c[0] * w * 0.47, deckY + 0.03 * s, c[1] * d * 0.47);
        eye.rotation.y = PI / 4 * (c[0] * c[1]);
        if (i < 2) {
          add(g, rbox(0.05 * s, 0.03 * s, 0.05 * s, 0.006), m.aluDark, c[0] * w * 0.4, deckY + 0.015 * s, d * 0.47);
          add(g, cyl(0.016 * s, 0.016 * s, 0.004, 20), m.lens, c[0] * w * 0.4, deckY + 0.031 * s, d * 0.47);
        }
      });
      // harness: a cable bundle from the deck down into the bay
      cable(g, [[-w * 0.26, deckY + 0.012, d * 0.3], [-w * 0.4, deckY + 0.012, d * 0.43], [-w * 0.455, h / 2 - 0.02, d / 2 + 0.012],
        [-w * 0.44, h * 0.3, d / 2 - rec * 0.35], [-w * 0.33, h * 0.24, d / 2 - rec + 0.03]], 0.011 * s, m.foilBlack);
      cable(g, [[w * 0.3, deckY + 0.012, -d * 0.3], [w * 0.44, deckY + 0.012, -d * 0.1], [w * 0.47, deckY + 0.01, d * 0.2], [w * 0.455, h / 2 - 0.03, d / 2 + 0.012],
        [w * 0.43, h * 0.25, d / 2 - rec * 0.3], [w * 0.3, h * 0.1, d / 2 - rec + 0.03]], 0.009 * s, m.foilBlack);
    }
    return g;
  }

  /* ====================================================================
   * Solar wings
   * ==================================================================== */
  function buildWings(key, w, deploy, lite) {
    var m = library(), g = slot('panels');
    var p = D.PANELS[key], sw = SEG[key][0], sh = SEG[key][1], gap = 0.035, root = 0.3;
    var faces = [m.alu, m.alu, m.alu, m.alu, m.cells, m.carbon];
    [1, -1].forEach(function (side) {
      var wing = new THREE.Group();
      wing.position.x = side * (w / 2);
      // drive motor that turns the wing to face the Sun, and the yoke that holds it
      var drive = add(wing, cyl(0.055, 0.055, 0.07, 28), m.alu, side * 0.035, 0, 0); drive.rotation.z = PI / 2;
      var flange = add(wing, cyl(0.075, 0.075, 0.012, 28), m.aluDark, side * 0.006, 0, 0); flange.rotation.z = PI / 2;
      add(wing, rbox(0.06, 0.07, 0.05, 0.008), m.aluDark, side * 0.095, 0, 0);
      strut(wing, [side * 0.11, 0, 0], [side * root, sh * 0.32, -0.006], 0.012, m.carbon);
      strut(wing, [side * 0.11, 0, 0], [side * root, -sh * 0.32, -0.006], 0.012, m.carbon);
      strut(wing, [side * root, sh * 0.34, -0.006], [side * root, -sh * 0.34, -0.006], 0.012, m.carbon);
      for (var i = 0; i < p.segs; i++) {
        var cx = side * (root + sw / 2 + i * (sw + gap));
        add(wing, new THREE.BoxGeometry(sw, sh, 0.024), faces, cx, 0, 0);
        // stiffening ribs on the back
        add(wing, new THREE.BoxGeometry(sw * 0.92, 0.028, 0.016), m.carbon, cx, sh * 0.3, -0.02);
        add(wing, new THREE.BoxGeometry(sw * 0.92, 0.028, 0.016), m.carbon, cx, -sh * 0.3, -0.02);
        if (!lite) {
          [-0.34, 0, 0.34].forEach(function (f) { // hinges on the inner edge
            add(wing, cyl(0.013, 0.013, 0.085, 14), m.alu, cx - side * (sw / 2 + gap / 2), sh * f, -0.012);
          });
          var hd = [];
          [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(function (q) { hd.push([cx + q[0] * sw, q[1] * sh, 0.014]); });
          bolts(wing, hd, 0.016, m.aluDark, 'z');
        }
      }
      wing.userData.wing = true;
      wing.scale.x = 0.06 + 0.94 * deploy;
      g.add(wing);
    });
    g.userData.span = w + 2 * (root + p.segs * (sw + gap));
    return g;
  }

  /* ====================================================================
   * Fire sensors (origin on the deck)
   * ==================================================================== */
  function buildSensor(key, top, lite) {
    var m = library(), g = slot('sensor'), i;
    if (key === 'mini') {
      add(g, rbox(0.24, 0.018, 0.24, 0.006), m.alu, 0, 0.009, 0);
      if (!lite) bolts(g, [[0.1, 0.019, 0.1], [-0.1, 0.019, 0.1], [0.1, 0.019, -0.1], [-0.1, 0.019, -0.1]], 0.008, m.steel);
      add(g, rbox(0.17, 0.12, 0.17, 0.014), m.aluDark, 0, 0.078, 0);
      for (i = 0; i < 7; i++) add(g, new THREE.BoxGeometry(0.03, 0.09, 0.004), m.alu, -0.1, 0.078, -0.054 + i * 0.018); // cooling fins
      add(g, new THREE.BoxGeometry(0.012, 0.012, 0.004), m.led, 0.05, 0.11, 0.0865);
      add(g, cyl(0.062, 0.066, 0.05, 40), m.aluDark, 0, 0.163, 0);
      add(g, cyl(0.07, 0.07, 0.016, 40), m.alu, 0, 0.196, 0);
      add(g, cyl(0.058, 0.062, 0.05, 40), m.aluDark, 0, 0.229, 0);
      add(g, lensCap(0.05, 0.016), m.lens, 0, 0.252, 0);
      add(g, cyl(0.076, 0.062, 0.09, 40, true), m.baffle, 0, 0.298, 0);
      var rim = add(g, torus(0.076, 0.004, 40), m.alu, 0, 0.343, 0); rim.rotation.x = PI / 2;
    } else if (key === 'wide') {
      [[0.27, 0.2], [-0.27, 0.2], [0.27, -0.2], [-0.27, -0.2]].forEach(function (q) { add(g, rbox(0.08, 0.03, 0.08, 0.006), m.alu, q[0], 0.015, q[1]); });
      add(g, rbox(0.62, 0.3, 0.48, 0.03), m.quilt, 0, 0.18, 0);
      add(g, rbox(0.52, 0.03, 0.26, 0.008), m.alu, 0, 0.343, 0.02);
      add(g, new THREE.BoxGeometry(0.44, 0.02, 0.17), m.black, 0, 0.352, 0.02);
      add(g, rbox(0.03, 0.13, 0.2, 0.008), m.aluDark, 0.236, 0.4, 0.02);
      add(g, rbox(0.03, 0.13, 0.2, 0.008), m.aluDark, -0.236, 0.4, 0.02);
      // the spinning scan telescope sweeps the view from side to side
      var drum = new THREE.Group();
      var tube = add(drum, cyl(0.068, 0.068, 0.42, 40), m.mirrorGold); tube.rotation.z = PI / 2;
      add(drum, new THREE.BoxGeometry(0.3, 0.02, 0.085), m.black, 0, 0.06, 0);
      add(drum, new THREE.BoxGeometry(0.3, 0.02, 0.085), m.aluDark, 0, -0.06, 0);
      drum.position.set(0, 0.412, 0.02);
      drum.userData.spin = true;
      g.add(drum);
      var hood = new THREE.CylinderGeometry(0.088, 0.088, 0.44, 28, 1, true, PI / 2, PI);
      hood.rotateZ(PI / 2);
      add(g, hood, m.whitePaint2, 0, 0.412, 0.02);
      // passive cooler: nested gold shields that look at cold deep space
      var cooler = new THREE.Group();
      [[0.2, 0.11, 0.12], [0.15, 0.08, 0.1], [0.1, 0.05, 0.08]].forEach(function (q) {
        var shell = new THREE.CylinderGeometry(q[0], q[1], q[2], 4, 1, true);
        shell.rotateY(PI / 4); shell.translate(0, q[2] / 2, 0);
        add(cooler, shell, m.mirrorGold2);
      });
      add(cooler, cyl(0.05, 0.05, 0.006, 24), m.black, 0, 0.004, 0);
      add(cooler, rbox(0.26, 0.03, 0.26, 0.008), m.alu, 0, -0.016, 0);
      cooler.rotation.z = PI / 2 - 0.45;
      cooler.position.set(-0.325, 0.2, 0);
      g.add(cooler);
      // electronics box with its plugs
      add(g, rbox(0.1, 0.15, 0.3, 0.012), m.foilSilver, 0.355, 0.11, 0);
      for (i = 0; i < 3; i++) { var plug = add(g, cyl(0.014, 0.014, 0.03, 14), m.brass, 0.41, 0.12, -0.08 + i * 0.08); plug.rotation.z = PI / 2; }
      var door = add(g, rbox(0.17, 0.006, 0.13, 0.002), m.whitePaint, 0.17, 0.39, 0.215); door.rotation.x = 0.95; // calibration door
      if (!lite) cable(g, [[0.4, 0.1, 0.1], [0.44, 0.05, 0.16], [0.4, 0.012, 0.26], [0.3, 0.012, 0.3]], 0.008, m.foilBlack);
    } else if (key === 'giant') {
      add(g, cyl(0.64, 0.66, 0.1, 64), m.alu, 0, 0.05, 0);
      if (!lite) bolts(g, ringPts(0.61, 28, 0.101), 0.011, m.steel);
      add(g, cyl(0.55, 0.55, 1.5, 64, true), m.quilt, 0, 0.85, 0);
      add(g, cyl(0.538, 0.538, 1.5, 64, true), m.baffle, 0, 0.85, 0);
      for (i = 0; i < 6; i++) { var vane = add(g, torus(0.51, 0.014, 64), m.black, 0, 0.5 + i * 0.19, 0); vane.rotation.x = PI / 2; }
      add(g, cyl(0.525, 0.525, 0.06, 64), m.aluDark, 0, 0.17, 0);
      var primary = add(g, new THREE.RingGeometry(0.1, 0.5, 64), m.mirrorGold, 0, 0.205, 0); primary.rotation.x = -PI / 2;
      add(g, cyl(0.1, 0.1, 0.36, 32, true), m.baffle, 0, 0.38, 0);
      add(g, cyl(0.13, 0.13, 0.05, 40), m.aluDark, 0, 1.31, 0);
      var second = add(g, new THREE.CircleGeometry(0.12, 40), m.mirrorGold, 0, 1.284, 0); second.rotation.x = PI / 2;
      for (i = 0; i < 4; i++) { // the spider that holds the small mirror
        var a = i * PI / 2 + PI / 4, sp = add(g, new THREE.BoxGeometry(0.42, 0.06, 0.006), m.aluDark, Math.cos(a) * 0.335, 1.31, Math.sin(a) * 0.335);
        sp.rotation.y = -a;
      }
      [0.3, 0.85, 1.4].forEach(function (y) { var hoop = add(g, torus(0.557, 0.013, 64), m.alu, 0, y, 0); hoop.rotation.x = PI / 2; });
      add(g, cyl(0.74, 0.56, 0.3, 64, true), m.foilGold2, 0, 1.75, 0);
      var lip = add(g, torus(0.74, 0.009, 64), m.alu, 0, 1.9, 0); lip.rotation.x = PI / 2;
      // the dust cover, swung open on its hinge
      var lid = new THREE.Group();
      add(lid, cyl(0.74, 0.74, 0.03, 64), m.whitePaint, -0.76, 0, 0);
      add(lid, cyl(0.7, 0.7, 0.005, 64), m.black, -0.76, -0.018, 0);
      var pin = add(lid, cyl(0.02, 0.02, 0.24, 14), m.alu); pin.rotation.x = PI / 2;
      lid.position.set(0.77, 1.9, 0); lid.rotation.z = -2.0;
      g.add(lid);
      add(g, rbox(0.02, 0.9, 0.52, 0.006), m.osr, -0.64, 0.85, 0);
      [[0.5, 0.2], [0.5, -0.2], [1.2, 0.2], [1.2, -0.2]].forEach(function (q) { var st = add(g, cyl(0.012, 0.012, 0.09, 10), m.alu, -0.6, q[0], q[1]); st.rotation.z = PI / 2; });
      add(g, rbox(0.3, 0.22, 0.2, 0.014), m.foilSilver, 0, 0.21, 0.66);
    }
    g.position.set(0, top, -0.03);
    return g;
  }

  /* ====================================================================
   * Bonus tools
   * ==================================================================== */
  function buildExtra(key, top, x, z) {
    var m = library(), g = slot('extra:' + key);
    if (key === 'color') {
      add(g, rbox(0.15, 0.014, 0.15, 0.005), m.alu, 0, 0.007, 0);
      add(g, cyl(0.052, 0.056, 0.14, 36), m.whitePaint, 0, 0.084, 0);
      add(g, cyl(0.058, 0.058, 0.022, 36), m.aluDark, 0, 0.165, 0);
      add(g, lensCap(0.042, 0.014), m.lens, 0, 0.176, 0);
      add(g, cyl(0.062, 0.052, 0.06, 36, true), m.baffle, 0, 0.206, 0);
    } else if (key === 'smoke') {
      add(g, rbox(0.2, 0.12, 0.16, 0.012), m.foilSilver, 0, 0.068, 0);
      add(g, new THREE.BoxGeometry(0.1, 0.004, 0.024), m.black, 0, 0.13, 0);
      var horn = new THREE.CylinderGeometry(0.07, 0.03, 0.07, 4, 1, true); horn.rotateY(PI / 4);
      add(g, horn, m.baffle, 0, 0.165, 0);
      add(g, rbox(0.012, 0.13, 0.15, 0.004), m.osr, 0.108, 0.075, 0);
      add(g, new THREE.BoxGeometry(0.012, 0.012, 0.004), m.ledAmber, -0.06, 0.09, 0.0815);
    } else if (key === 'lightning') {
      add(g, cyl(0.112, 0.118, 0.03, 40), m.alu, 0, 0.015, 0);
      add(g, cyl(0.095, 0.105, 0.08, 40), m.whitePaint, 0, 0.07, 0);
      add(g, cyl(0.1, 0.1, 0.014, 40), m.aluDark, 0, 0.117, 0);
      add(g, new THREE.SphereGeometry(0.082, 40, 16, 0, 2 * PI, 0, PI / 2), m.lensViolet, 0, 0.122, 0);
    }
    g.position.set(x, top, z);
    return g;
  }

  /* ====================================================================
   * Inside the service bay
   * ==================================================================== */
  function buildBattery(key, w, h, d, s, rec, lite) {
    var m = library(), g = slot('battery'), k = new THREE.Group();
    var grid = { S: [3, 2], M: [5, 3], L: [8, 4] }[key], cols = grid[0], rows = grid[1], pitch = 0.04, r = 0.0165;
    var bw = cols * pitch + 0.024, bh = rows * pitch + 0.024;
    add(k, rbox(bw, bh, 0.07, 0.008), m.aluDark, 0, 0, 0.035);
    var cellPts = [], capPts = [];
    for (var cy = 0; cy < rows; cy++) for (var cx = 0; cx < cols; cx++) {
      var x = (cx - (cols - 1) / 2) * pitch, y = (cy - (rows - 1) / 2) * pitch;
      cellPts.push([x, y, 0.046]); capPts.push([x, y, 0.086]);
    }
    if (!lite) {
      var cg = cyl(r, r, 0.076, 18); cg.rotateX(PI / 2);
      var cells = new THREE.InstancedMesh(cg, m.cellWrap, cellPts.length), m4 = new THREE.Matrix4();
      cellPts.forEach(function (q, i) { m4.makeTranslation(q[0], q[1], q[2]); cells.setMatrixAt(i, m4); });
      k.add(cells);
      bolts(k, capPts, 0.009, m.steel, 'z');
      for (var row = 0; row < rows; row++) add(k, new THREE.BoxGeometry(cols * pitch - 0.012, 0.007, 0.002), m.copper, 0, (row - (rows - 1) / 2) * pitch, 0.0905);
    }
    add(k, new THREE.BoxGeometry(bw * 0.5, 0.012, 0.002), m.ledAmber, 0, bh / 2 - 0.004, 0.071);
    k.scale.setScalar(s * (key === 'L' ? 1.4 : 1.7));
    k.position.set(w * 0.2, h * 0.2, d / 2 - rec);
    g.add(k);
    return g;
  }

  function buildComputer(key, w, h, d, s, rec, lite) {
    var m = library(), g = slot('computer'), k = new THREE.Group(), i;
    if (key === 'basic') {
      add(k, rbox(0.18, 0.12, 0.004, 0.0015), m.pcb, 0, 0, 0.022);
      [[-0.07, 0.045], [0.07, 0.045], [-0.07, -0.045], [0.07, -0.045]].forEach(function (q) { var st = add(k, cyl(0.005, 0.005, 0.02, 8), m.brass, q[0], q[1], 0.011); st.rotation.x = PI / 2; });
      add(k, new THREE.BoxGeometry(0.05, 0.05, 0.008), m.black, -0.03, 0.005, 0.028);
      add(k, new THREE.BoxGeometry(0.03, 0.018, 0.008), m.black, 0.04, 0.03, 0.028);
      add(k, new THREE.BoxGeometry(0.022, 0.035, 0.012), m.steel, 0.05, -0.02, 0.03);
      add(k, new THREE.BoxGeometry(0.008, 0.008, 0.006), m.led, -0.07, -0.02, 0.027);
    } else {
      var cw = key === 'ai' ? 0.23 : 0.2, ch = 0.145, cd = 0.085, body = key === 'ai' ? m.aluDark : m.alu;
      add(k, rbox(cw, ch, cd, 0.01), body, 0, 0, cd / 2);
      for (i = 0; i < 9; i++) add(k, new THREE.BoxGeometry(0.004, ch * 0.86, 0.02), body, -cw / 2 + 0.02 + i * (cw - 0.04) / 8, 0, cd + 0.008); // heat-sink fins
      if (!lite) bolts(k, [[-cw / 2 + 0.012, ch / 2 - 0.012, cd], [cw / 2 - 0.012, ch / 2 - 0.012, cd], [-cw / 2 + 0.012, -ch / 2 + 0.012, cd], [cw / 2 - 0.012, -ch / 2 + 0.012, cd]], 0.005, m.steel, 'z');
      for (i = 0; i < 3; i++) add(k, cyl(0.012, 0.012, 0.03, 14), m.brass, -cw * 0.28 + i * cw * 0.28, -ch / 2 - 0.012, cd * 0.5);
      if (key === 'ai') {
        add(k, new THREE.BoxGeometry(cw * 0.74, 0.012, 0.004), m.ledCyan, 0, ch / 2 - 0.016, cd + 0.02);
        add(k, new THREE.BoxGeometry(cw * 0.3, 0.008, 0.004), m.ledCyan, 0, -ch / 2 + 0.016, cd + 0.02);
      } else {
        add(k, new THREE.BoxGeometry(0.014, 0.014, 0.004), m.led, cw / 2 - 0.03, ch / 2 - 0.02, cd + 0.02);
      }
    }
    k.scale.setScalar(s * 1.7);
    k.position.set(-w * 0.21, h * 0.2, d / 2 - rec);
    g.add(k);
    return g;
  }

  /** One reaction wheel: a heavy flywheel in a ring-shaped cradle. */
  function wheel(m) {
    var a = new THREE.Group(), spin = new THREE.Group();
    var ring = add(a, torus(0.082, 0.011, 40), m.aluDark); ring.rotation.x = PI / 2;
    add(spin, cyl(0.07, 0.07, 0.02, 40), m.brass);
    var tyre = add(spin, torus(0.066, 0.011, 40), m.steel); tyre.rotation.x = PI / 2;
    add(spin, cyl(0.022, 0.022, 0.05, 20), m.aluDark);
    for (var i = 0; i < 3; i++) { var sp = add(spin, new THREE.BoxGeometry(0.12, 0.022, 0.012), m.aluDark); sp.rotation.y = i * PI / 3; }
    spin.userData.wheel = true;
    a.add(spin);
    return a;
  }

  function buildPointing(key, w, h, d, s, rec, top) {
    var m = library(), g = slot('pointing'), k = new THREE.Group(), i;
    if (key === 'magnets') {
      // three torque rods, one for each direction the satellite can turn
      [[0, 0, PI / 2, -0.02, -0.11, 0.035], [0, 0, 0, -0.2, 0.02, 0.035], [PI / 2, 0, 0, 0.1, -0.02, 0.13]].forEach(function (q) {
        var rod = new THREE.Group();
        add(rod, cyl(0.011, 0.011, 0.34, 14), m.aluDark);
        add(rod, cyl(0.02, 0.02, 0.24, 20), m.coil);
        add(rod, cyl(0.024, 0.024, 0.012, 20), m.alu, 0, 0.126, 0);
        add(rod, cyl(0.024, 0.024, 0.012, 20), m.alu, 0, -0.126, 0);
        rod.rotation.set(q[0], q[1], q[2]);
        rod.position.set(q[3], q[4], q[5]);
        k.add(rod);
      });
      k.position.set(w * 0.04, -h * 0.2, d / 2 - rec);
    } else {
      var n = key === 'wheels4' ? 4 : 3;
      add(k, rbox(n === 4 ? 0.44 : 0.6, n === 4 ? 0.42 : 0.2, 0.012, 0.004), m.aluDark, 0, 0, 0.008);
      for (i = 0; i < n; i++) {
        var pod = wheel(m);
        if (n === 3) {
          pod.position.set(-0.2 + i * 0.2, 0, 0.1);
          if (i === 0) pod.rotation.z = PI / 2; else if (i === 2) pod.rotation.x = PI / 2;
        } else { // four wheels in a pyramid: any three can do the job
          var a = PI / 4 + i * PI / 2;
          pod.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.145, 0.1);
          pod.rotation.set(PI / 2 - Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        }
        k.add(pod);
      }
      k.position.set(0, -h * 0.22, d / 2 - rec);
      if (key === 'wheels4') { // star tracker: a small camera that steers by the stars
        var st = new THREE.Group();
        add(st, rbox(0.07, 0.07, 0.09, 0.008), m.aluDark, 0, 0.035, 0);
        add(st, cyl(0.062, 0.034, 0.15, 28, true), m.baffle, 0, 0.14, 0);
        var lip = add(st, torus(0.062, 0.004, 28), m.alu, 0, 0.215, 0); lip.rotation.x = PI / 2;
        st.scale.setScalar(s);
        st.rotation.set(-0.65, 0, 0.45);
        st.position.set(-w * 0.4, top, -d * 0.4);
        g.add(st);
      }
    }
    k.scale.setScalar(s * 1.4);
    g.add(k);
    return g;
  }

  /* ====================================================================
   * Radio
   * ==================================================================== */
  function buildRadio(key, w, top, d, s, lite) {
    var m = library(), g = slot('radio'), i;
    if (key === 'sband') {
      add(g, rbox(0.16, 0.012, 0.16, 0.004), m.whitePaint, 0, 0.006, 0);
      add(g, new THREE.BoxGeometry(0.09, 0.003, 0.09), m.copper, 0, 0.0135, 0);
      // helix antenna: four wires twisting up a short mast
      add(g, cyl(0.012, 0.014, 0.24, 16), m.whitePaint, 0.12, 0.12, 0.07);
      add(g, new THREE.SphereGeometry(0.014, 14, 10), m.whitePaint, 0.12, 0.24, 0.07);
      for (i = 0; i < 4; i++) {
        var pts = [];
        for (var t = 0; t <= 36; t++) { var a = (t / 36) * 3.2 * PI + i * PI / 2; pts.push([0.12 + Math.cos(a) * 0.024, 0.03 + (t / 36) * 0.2, 0.07 + Math.sin(a) * 0.024]); }
        cable(g, pts, 0.003, m.copper);
      }
    } else if (key === 'xband') {
      add(g, cyl(0.022, 0.032, 0.34, 20), m.alu, 0, 0.17, 0);
      add(g, cyl(0.042, 0.042, 0.05, 24), m.aluDark, 0, 0.36, 0);
      add(g, rbox(0.17, 0.016, 0.045, 0.005), m.alu, 0, 0.392, 0);
      add(g, rbox(0.014, 0.12, 0.034, 0.004), m.alu, 0.078, 0.45, 0);
      add(g, rbox(0.014, 0.12, 0.034, 0.004), m.alu, -0.078, 0.45, 0);
      [1, -1].forEach(function (q) { var mot = add(g, cyl(0.024, 0.024, 0.03, 20), m.aluDark, q * 0.096, 0.48, 0); mot.rotation.z = PI / 2; });
      var dish = new THREE.Group(), prof = [], f = 0.16, R = 0.25;
      for (i = 0; i <= 14; i++) { var r = (i / 14) * R; prof.push(new THREE.Vector2(r, (r * r) / (4 * f))); }
      var rimY = (R * R) / (4 * f);
      add(dish, new THREE.LatheGeometry(prof, 56), m.whitePaint2);
      var rim = add(dish, torus(R, 0.006, 56), m.alu, 0, rimY, 0); rim.rotation.x = PI / 2;
      add(dish, cyl(0.05, 0.034, 0.04, 24), m.aluDark, 0, -0.018, 0);
      add(dish, cyl(0.012, 0.03, 0.05, 20, true), m.alu2, 0, f, 0);          // feed horn at the focus
      add(dish, cyl(0.015, 0.015, 0.035, 16), m.aluDark, 0, f + 0.04, 0);
      for (i = 0; i < 3; i++) { var sa = i * 2 * PI / 3 + PI / 2; strut(dish, [Math.cos(sa) * R * 0.96, rimY, Math.sin(sa) * R * 0.96], [0, f + 0.03, 0], 0.004, m.alu); }
      dish.position.set(0, 0.48, 0);
      dish.rotation.set(0.42, 0, -0.3);
      g.add(dish);
    } else if (key === 'laser') {
      add(g, cyl(0.07, 0.086, 0.05, 32), m.alu, 0, 0.025, 0);
      add(g, cyl(0.064, 0.064, 0.06, 32), m.whitePaint, 0, 0.08, 0);
      add(g, rbox(0.012, 0.11, 0.05, 0.004), m.alu, 0.074, 0.16, 0);
      add(g, rbox(0.012, 0.11, 0.05, 0.004), m.alu, -0.074, 0.16, 0);
      var head = new THREE.Group();
      add(head, new THREE.SphereGeometry(0.062, 32, 20), m.whitePaint);
      add(head, cyl(0.038, 0.038, 0.08, 32), m.aluDark, 0, 0.07, 0);
      add(head, lensCap(0.032, 0.008), m.lens, 0, 0.11, 0);
      var halo = add(head, torus(0.036, 0.004, 32), m.ledRed, 0, 0.111, 0); halo.rotation.x = PI / 2;
      if (!lite) {
        var beam = add(head, cyl(0.004, 0.004, 1.5, 8),
          new THREE.MeshBasicMaterial({ color: 0xff5a48, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.87, 0);
        beam.userData.noShadow = true;
      }
      head.position.set(0, 0.17, 0);
      head.rotation.set(0.5, 0, -0.35);
      g.add(head);
    }
    g.scale.setScalar(s);
    g.position.set(w * 0.4, top, -d * 0.4);
    return g;
  }

  /* ====================================================================
   * Putting a whole satellite together
   * ==================================================================== */
  /**
   * Build a satellite for a design. `lite` leaves out the smallest details
   * (bolts, cables) for the tiny copy used in the orbit views.
   * group.userData holds {span, height, top, bottom, w, h, d} for framing the camera.
   */
  function assemble(design, deploy, lite) {
    var root = new THREE.Group();
    var bus = design.bus ? D.BUSES[design.bus] : null;
    var sz = bus ? bus.size : GHOST, w = sz[0], h = sz[1], d = sz[2];
    var s = partScale(w), rec = 0.1 * s, top = h / 2 + 0.04;
    var span = w, tall = h;

    root.add(buildBus(bus, lite));
    if (design.sensor) {
      root.add(buildSensor(design.sensor, top, lite));
      tall = h + (design.sensor === 'giant' ? 2.3 : design.sensor === 'wide' ? 0.55 : 0.4);
    }
    (design.extras || []).forEach(function (k) {
      var i = Object.keys(D.EXTRAS).indexOf(k);
      root.add(buildExtra(k, top, (i - 1) * w * 0.33, d * (design.sensor === 'giant' ? 0.44 : 0.39)));
    });
    if (design.panels) {
      var wings = buildWings(design.panels, w, deploy, lite);
      root.add(wings);
      span = wings.userData.span;
    }
    if (bus) {
      if (design.battery) root.add(buildBattery(design.battery, w, h, d, s, rec, lite));
      if (design.computer) root.add(buildComputer(design.computer, w, h, d, s, rec, lite));
      if (design.pointing) root.add(buildPointing(design.pointing, w, h, d, s, rec, top));
    }
    if (design.radio) root.add(buildRadio(design.radio, w, top, d, s, lite));
    root.userData = { span: span, height: tall, top: h / 2 + (tall - h), bottom: -h / 2 - 0.16, w: w, h: h, d: d };
    return root;
  }
  S.assemble = assemble;

  /* ====================================================================
   * The build bay
   * ==================================================================== */
  S.build = function () {
    if (S.group) return;
    var m = library(), g = (S.group = new THREE.Group());
    S.model = new THREE.Group();
    g.add(S.model);

    S.lights = new THREE.Group();
    var key = new THREE.SpotLight(0xfff1de, 2.6, 0, 0.55, 0.75, 1);
    key.position.set(4.5, 8.5, 6.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.025;
    key.shadow.camera.near = 2; key.shadow.camera.far = 32;
    S.key = key;
    Stage.shadowLights.push(key);
    var fill = new THREE.DirectionalLight(0x9fc0ff, 0.5); fill.position.set(-6, 3, 3);
    var back = new THREE.DirectionalLight(0xffffff, 1.1); back.position.set(-3, 5, -7);
    S.lights.add(key, key.target, fill, back, new THREE.HemisphereLight(0xbfd4ff, 0x0d1118, 0.3));
    g.add(S.lights);

    S.floor = new THREE.Group();
    var floor = add(S.floor, new THREE.CircleGeometry(45, 96), new THREE.MeshStandardMaterial({ map: floorTexture(), color: 0xb9c2cf, roughness: 0.36, metalness: 0, envMapIntensity: 0.35 }));
    floor.rotation.x = -PI / 2;
    floor.receiveShadow = true;
    // the turntable, its keep-clear ring, and the stand that holds the satellite
    S.table = new THREE.Group();
    var deck = add(S.table, cyl(1, 1.03, 0.12, 96), new THREE.MeshStandardMaterial({ color: 0x232c38, roughness: 0.42, metalness: 0.75 }), 0, 0.06, 0);
    deck.receiveShadow = true; deck.castShadow = true;
    var groove = add(S.table, torus(0.86, 0.006, 96), m.alu, 0, 0.121, 0); groove.rotation.x = PI / 2;
    var groove2 = add(S.table, torus(0.5, 0.006, 96), m.alu, 0, 0.121, 0); groove2.rotation.x = PI / 2;
    var ring = add(S.table, new THREE.RingGeometry(1.06, 1.26, 96), new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6, metalness: 0, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 0, 0.004, 0);
    ring.rotation.x = -PI / 2;
    // map the painted ring onto the square texture
    var uv = ring.geometry.attributes.uv, pos = ring.geometry.attributes.position;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / 2.52, 0.5 + pos.getY(i) / 2.52);
    ring.receiveShadow = true;
    S.stand = new THREE.Group();
    add(S.stand, cyl(1, 1.28, 1, 56, true), m.standBlue).castShadow = true;
    var clamp = add(S.stand, torus(1.02, 0.03, 56), m.alu, 0, 0.5, 0); clamp.rotation.x = PI / 2;
    var foot = add(S.stand, torus(1.28, 0.04, 56), m.alu, 0, -0.5, 0); foot.rotation.x = PI / 2;
    S.floor.add(S.table, S.stand);
    S.figure = makeFigure();
    S.floor.add(S.figure);
    g.add(S.floor);

    g.visible = false;
    Stage.scene.add(g);
    S.update(RG.blankDesign(), null);
  };

  /** An engineer in a clean-room suit, 1.7 m tall, to show how big the satellite is. */
  function makeFigure() {
    var m = library(), g = new THREE.Group();
    function part(geo, mat, x, y, z) { var k = add(g, geo, mat, x, y, z); k.castShadow = true; return k; }
    var leg = new THREE.CapsuleGeometry(0.075, 0.68, 6, 14);
    part(leg, m.suit, -0.1, 0.46, 0); part(leg, m.suit, 0.1, 0.46, 0);
    part(rbox(0.11, 0.07, 0.24, 0.03), m.glove, -0.1, 0.035, 0.04); part(rbox(0.11, 0.07, 0.24, 0.03), m.glove, 0.1, 0.035, 0.04); // boots
    part(new THREE.CapsuleGeometry(0.17, 0.4, 8, 18), m.suit, 0, 1.13, 0);
    var arm = new THREE.CapsuleGeometry(0.055, 0.5, 6, 12);
    var a1 = part(arm, m.suit, -0.25, 1.1, 0.02); a1.rotation.z = -0.14;
    var a2 = part(arm, m.suit, 0.25, 1.1, 0.02); a2.rotation.z = 0.14;
    part(new THREE.SphereGeometry(0.05, 14, 10), m.glove, -0.29, 0.79, 0.02);
    part(new THREE.SphereGeometry(0.05, 14, 10), m.glove, 0.29, 0.79, 0.02);
    part(new THREE.SphereGeometry(0.128, 24, 18), m.suit, 0, 1.57, 0);           // hood
    part(rbox(0.19, 0.075, 0.06, 0.025), m.visor, 0, 1.585, 0.1);                // goggles
    part(rbox(0.15, 0.09, 0.05, 0.02), m.glove, 0, 1.5, 0.095);                  // face mask
    part(rbox(0.1, 0.07, 0.01, 0.003), m.plate, 0.07, 1.25, 0.17);               // badge
    return g;
  }

  /**
   * Rebuild the bay model for a design. `changed` is the slot that was just
   * chosen ('sensor', 'bus', 'extras' …) and gets a little pop.
   */
  S.update = function (design, changed) {
    while (S.model.children.length) { var o = S.model.children.pop(); Stage.dispose(o); }
    var sat = assemble(design, S.deploy, false);
    sat.traverse(function (k) {
      if (k.isMesh && !k.userData.noShadow) { k.castShadow = true; k.receiveShadow = true; }
    });
    S.model.add(sat);
    S.info = sat.userData;
    var u = sat.userData;
    // put the floor under the satellite, whatever its size
    var standH = 0.55, floorY = u.bottom - standH - 0.12;
    S.floor.position.y = floorY;
    var ringR = u.w * 0.36 + 0.02;
    S.stand.scale.set(ringR, standH, ringR);
    S.stand.position.y = 0.12 + standH / 2;
    var tableR = Math.max(1.3, u.w * 0.95);
    S.table.scale.set(tableR, 1, tableR);
    S.figure.position.set(-(Math.max(u.span / 2, tableR * 1.26) + 0.6), 0, 0.4);
    S.figure.rotation.y = 0.5;
    S.floorY = floorY;
    // keep the shadow-casting light framed on the whole satellite
    var reach = Math.max(u.span, u.height + 1.5, 3);
    S.key.position.set(reach * 0.75, floorY + reach * 1.5 + 3, reach * 1.05);
    S.key.target.position.set(0, (u.top + floorY) / 2, 0);
    S.key.angle = Math.min(0.9, Math.atan2(reach * 0.75 + 1.2, reach * 2));
    S.key.shadow.camera.far = reach * 4 + 12;

    if (changed && !Stage.reducedMotion) {
      sat.children.forEach(function (c) {
        var sl = c.userData.slot || '';
        if (sl === changed || (changed === 'extras' && sl.indexOf('extra:') === 0)) {
          c.scale.multiplyScalar(0.001);
          pops.push({ obj: c, t: 0, to: c.scale.x * 1000 });
        }
      });
    }
  };

  S.setDeploy = function (v) {
    S.deploy = v;
    if (!S.model) return;
    S.model.traverse(function (o) { if (o.userData.wing) o.scale.x = 0.06 + 0.94 * v; });
  };

  S.show = function (on) { S.group.visible = on; };

  S.tick = function (dt) {
    for (var i = pops.length - 1; i >= 0; i--) {
      var p = pops[i];
      p.t += dt / 0.5;
      p.obj.scale.setScalar(p.to * Math.max(0.001, Stage.easeOutBack(Math.min(1, p.t))));
      if (p.t >= 1) pops.splice(i, 1);
    }
    if (S.group.visible && !Stage.reducedMotion) {
      S.model.traverse(function (o) {
        if (o.userData.spin) o.rotation.x += dt * 4;
        if (o.userData.wheel) o.rotation.y += dt * 8;
      });
    }
  };

  /** A fresh copy of the finished satellite, scaled to fit a 1-unit box, for the orbit views. */
  S.flightCopy = function (design) {
    var sat = assemble(design, 1, true);
    var u = sat.userData, size = Math.max(u.span, u.height, 0.5);
    var holder = new THREE.Group();
    sat.scale.setScalar(1 / size);
    holder.add(sat);
    return holder;
  };

  RG.SatModel = S;
})();
