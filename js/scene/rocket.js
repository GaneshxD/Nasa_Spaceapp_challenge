/* Orbit Ranger — launch pad and rocket.
 * One unit of length is one metre. The pad is shown while the player picks a
 * rocket, and again for the lift-off cut-scene.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE, Stage = RG.Stage;

  var R = { group: null, style: null, flying: false, t: 0, height: 40, alt: 0 };
  var SKY_HIGH = new THREE.Color(0x12305e), SKY_SPACE = new THREE.Color(0x02040a);
  var PAD_TOP = 1.2;

  // Shapes for the three rocket sizes (metres).
  var STYLES = {
    small: { r: 0.65, h: 14, fairR: 0.8, fairH: 3.6, boosters: 0, engines: 1 },
    medium: { r: 1.85, h: 38, fairR: 2.5, fairH: 11, boosters: 0, engines: 3 },
    heavy: { r: 1.85, h: 44, fairR: 2.7, fairH: 13, boosters: 2, engines: 3 }
  };

  function mat(color, o) {
    o = o || {}; o.color = color;
    if (o.roughness == null) o.roughness = 0.55;
    return new THREE.MeshStandardMaterial(o);
  }
  function mesh(geo, m, x, y, z) { var k = new THREE.Mesh(geo, m); k.position.set(x || 0, y || 0, z || 0); return k; }

  function puffTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.5, 'rgba(240,240,240,0.5)');
    grad.addColorStop(1, 'rgba(230,230,230,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); t.userData.shared = true;
    return t;
  }

  /* ====================================================================
   * The launch site: sky with clouds, grass, the sea, the pad, tower and tanks
   * ==================================================================== */
  var HAZE = new THREE.Color(0xa9d0f7), siteLib = null;

  function canvasTex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.userData.shared = true;
    if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry || rx); }
    return t;
  }
  /**
   * Grass with large, soft, never-repeating lighter and darker patches. The
   * patches are multiplied into the grass colour inside the material, using
   * each point's position on the ground, so there is no second layer to
   * flicker or to leave straight edges.
   */
  function grassMaterial(grass, rnd) {
    var c = document.createElement('canvas'); c.width = c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, 512, 512); // mid grey leaves the grass unchanged
    for (var k = 0; k < 300; k++) {
      var px = 40 + rnd() * 432, py = 40 + rnd() * 432, pr = 8 + rnd() * 34, v = rnd() > 0.45 ? 84 : 168;
      var gr = g.createRadialGradient(px, py, 0, px, py, pr);
      gr.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',0.55)'); gr.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)');
      g.fillStyle = gr; g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
    var patches = new THREE.CanvasTexture(c);
    patches.userData.shared = true;
    var mat = new THREE.MeshStandardMaterial({ map: grass, color: 0xd3dccb, roughness: 1, metalness: 0 });
    mat.userData.shared = true;
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.patchMap = { value: patches };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vPatch;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPatch = position.xz / 6000.0 + 0.5;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D patchMap;\nvarying vec2 vPatch;')
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(patchMap, vPatch).r * 2.0;');
    };
    return mat;
  }

  function siteMats() {
    if (siteLib) return siteLib;
    var rnd = Stage.seeded(41);
    var grass = canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = '#4c8c34'; g.fillRect(0, 0, w, h);
      var i, k, greens = ['#43802d', '#5c9a3c', '#3a7227', '#6aa644', '#4d8a34', '#7fb24f', '#8fa64f'];
      for (i = 0; i < 24000; i++) { // blades
        var x = rnd() * w, y = rnd() * h, len = 3 + rnd() * 7, a = -Math.PI / 2 + (rnd() - 0.5) * 1.3;
        g.strokeStyle = greens[Math.floor(rnd() * rnd() * greens.length)]; g.lineWidth = 0.8 + rnd() * 0.9;
        for (k = 0; k < 4; k++) {
          var bx = x - (k % 2) * w, by = y - (k > 1 ? h : 0);
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len); g.stroke();
        }
      }
    }, 3000);
    var concrete = canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = '#bcc0c5'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 5000; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
      for (i = 0; i < 26; i++) { var x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(60,60,55,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      g.strokeStyle = 'rgba(70,74,80,0.5)'; g.lineWidth = 2;
      for (i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
    }, 5);
    var gravel = canvasTex(128, 256, function (g, w, h) {
      g.fillStyle = '#cdbd97'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#b7a57e'; g.fillRect(14, 0, 34, h); g.fillRect(80, 0, 34, h);
      for (var i = 0; i < 2600; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(60,45,20,0.14)'; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    }, 1, 110);
    var lattice = canvasTex(128, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#6c7a8a'; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(6, 6); g.lineTo(w - 6, h - 6); g.moveTo(w - 6, 6); g.lineTo(6, h - 6); g.stroke();
      g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    }, 1, 1);
    var vab = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#e9edf1'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,130,145,0.5)'; g.lineWidth = 1;
      for (var i = 0; i < 16; i++) { g.beginPath(); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); }
      g.fillStyle = '#3a4350';
      [28, 92, 156, 220].forEach(function (x) { g.fillRect(x - 12, 36, 24, h - 36); });
      g.fillStyle = '#2563c9'; g.fillRect(0, 12, w, 10);
    });
    function std(o) { var m = new THREE.MeshStandardMaterial(o); m.userData.shared = true; return m; }
    siteLib = {
      grass: grassMaterial(grass, rnd),
      concrete: std({ map: concrete, roughness: 0.92, metalness: 0 }),
      asphalt: std({ color: 0x4d535b, roughness: 0.95 }),
      gravel: std({ map: gravel, roughness: 1 }),
      sand: std({ color: 0xe6d5a8, roughness: 1 }),
      sea: std({ color: 0x1f7fb6, roughness: 0.22, metalness: 0.15 }),
      steel: std({ color: 0x8a96a5, roughness: 0.5, metalness: 0.6 }),
      white: std({ color: 0xf6f8fa, roughness: 0.5 }),
      dark: std({ color: 0x2b3038, roughness: 0.8 }),
      hazard: std({ color: 0xf2b705, roughness: 0.7 }),
      lattice: std({ map: lattice, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 }),
      latticeMap: lattice,
      vab: std({ map: vab, roughness: 0.8 }),
      bush: std({ color: 0xffffff, roughness: 1, flatShading: true })
    };
    return siteLib;
  }

  /** A copy of a material for something painted flat on the ground. Higher `layer` draws on top. */
  function decal(mat, layer) {
    var d = mat.clone();
    d.polygonOffset = true; d.polygonOffsetFactor = -layer; d.polygonOffsetUnits = -layer * 4;
    d.userData.shared = true;
    return d;
  }

  function buildSite(g, sun) {
    var m = siteMats(), rnd = Stage.seeded(77), i;
    function put(geo, mat, x, y, z, cast) { var k = new THREE.Mesh(geo, mat); k.position.set(x || 0, y || 0, z || 0); k.receiveShadow = true; if (cast) k.castShadow = true; g.add(k); return k; }

    /* sky: a blue dome with drifting clouds that thins out into space */
    var sunDir = sun.position.clone().normalize();
    R.dome = new THREE.Mesh(new THREE.SphereGeometry(20000, 48, 24), new THREE.ShaderMaterial({
      uniforms: { sunDir: { value: sunDir }, space: { value: 0 }, time: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 sunDir; uniform float space; uniform float time; varying vec3 vDir;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
        '  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }',
        'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a*noise(p); p = p*2.03 + vec2(17.0, 9.0); a *= 0.5; } return v; }',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  vec3 horizon = vec3(0.40, 0.64, 0.93), zenith = vec3(0.025, 0.17, 0.68);',
        '  vec3 col = mix(horizon, zenith, pow(clamp(d.y, 0.0, 1.0), 0.45));',
        '  float s = max(dot(d, sunDir), 0.0);',
        '  col += vec3(1.0, 0.92, 0.75) * (pow(s, 700.0) * 4.0 + pow(s, 14.0) * 0.22);',
        '  if (d.y > 0.02) {',
        '    vec2 uv = d.xz / (d.y + 0.16) * 1.5 + vec2(time * 0.006, 0.0);',
        '    float n = fbm(uv);',
        '    float cloud = smoothstep(0.50, 0.72, n) * smoothstep(0.02, 0.2, d.y) * (1.0 - clamp(space * 3.0, 0.0, 1.0));',
        '    col = mix(col, mix(vec3(0.80, 0.86, 0.93), vec3(1.0), smoothstep(0.6, 0.9, n)), cloud * 0.95);',
        '  }',
        '  col = mix(col, vec3(0.004, 0.008, 0.024), smoothstep(0.0, 1.0, space));',
        '  gl_FragColor = vec4(col, 1.0 - smoothstep(0.55, 1.0, space));',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n'),
      side: THREE.BackSide, depthWrite: false, transparent: true, fog: false
    }));
    R.dome.renderOrder = -5; R.dome.frustumCulled = false;
    g.add(R.dome);

    /* grass, with gentle hills inland and lighter and darker patches */
    var geo = new THREE.PlaneGeometry(60000, 60000, 140, 140);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position, nor = geo.attributes.normal;
    for (i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), dist = Math.sqrt(x * x + z * z);
      var inland = Stage.smooth((dist - 3300) / 2600) * (1 - Stage.smooth((x - 500) / 500)); // flat for 3 km around the pad
      pos.setY(i, inland * (Math.sin(x * 0.0011) + Math.cos(z * 0.0013) + Math.sin((x + z) * 0.0007) + 1.2) * 16);
      // Light the whole field as if it were flat. The ground mesh is coarse (one
      // square is over 400 m), so per-corner tints or slopes would show up as
      // giant dark triangles that look like broken shadows.
      nor.setXYZ(i, 0, 1, 0);
    }
    put(geo, m.grass);
    // the Atlantic to the east, with a strip of beach
    var beach = put(new THREE.PlaneGeometry(170, 60000), decal(m.sand, 2), 1085, 0.25, 0); beach.rotation.x = -Math.PI / 2;
    var sea = put(new THREE.PlaneGeometry(40000, 60000), decal(m.sea, 3), 21150, 0.5, 0); sea.rotation.x = -Math.PI / 2;

    /* the pad: concrete apron, ring road, crawlerway and flame trench */
    var apron = put(new THREE.CircleGeometry(74, 96), decal(m.concrete, 4), 0, 0.07, 0); apron.rotation.x = -Math.PI / 2;
    var road = put(new THREE.RingGeometry(74, 81, 96), decal(m.asphalt, 3), 0, 0.06, 0); road.rotation.x = -Math.PI / 2;
    var way = put(new THREE.PlaneGeometry(30, 2700), decal(m.gravel, 2), 0, 0.05, -1425); way.rotation.x = -Math.PI / 2;
    var trench = put(new THREE.PlaneGeometry(150, 13), decal(m.dark, 5), 0, 0.1, 0); trench.rotation.x = -Math.PI / 2;
    put(new THREE.BoxGeometry(150, 1.4, 1), m.concrete, 0, 0.7, 7, true);
    put(new THREE.BoxGeometry(150, 1.4, 1), m.concrete, 0, 0.7, -7, true);
    var mount = put(new THREE.CylinderGeometry(17, 18.5, PAD_TOP, 8), m.concrete, 0, PAD_TOP / 2, 0, true); mount.rotation.y = Math.PI / 8;
    var stripe = put(new THREE.RingGeometry(15.4, 16.6, 8), decal(m.hazard, 2), 0, PAD_TOP + 0.02, 0); stripe.rotation.x = -Math.PI / 2; stripe.rotation.z = Math.PI / 8;
    var hole = put(new THREE.CircleGeometry(7, 40), decal(m.dark, 3), 0, PAD_TOP + 0.03, 0); hole.rotation.x = -Math.PI / 2;

    /* things around the pad */
    function sphereTank(x, z, r) { // the big white balls hold super-cold fuel
      put(new THREE.SphereGeometry(r, 32, 20), m.white, x, r * 1.25, z, true);
      for (var k = 0; k < 6; k++) { var a = (k / 6) * Math.PI * 2; put(new THREE.CylinderGeometry(0.35, 0.35, r * 1.3, 8), m.steel, x + Math.cos(a) * r * 0.75, r * 0.65, z + Math.sin(a) * r * 0.75, true); }
      var len = Math.sqrt(x * x + z * z) - 20, pipe = put(new THREE.CylinderGeometry(0.4, 0.4, len, 8), m.steel, x * 0.5 + (x > 0 ? 5 : -5), 0.9, z * 0.5, true);
      pipe.rotation.z = Math.PI / 2; pipe.rotation.y = -Math.atan2(z, x);
    }
    sphereTank(58, -44, 9);
    sphereTank(-34, -60, 7);
    // water tower: its water floods the pad at lift-off to soften the roar
    put(new THREE.CylinderGeometry(7, 7, 9, 28), m.white, -76, 62, -34, true);
    put(new THREE.ConeGeometry(7.4, 3.5, 28), m.white, -76, 68.2, -34, true);
    put(new THREE.CylinderGeometry(1, 1, 58, 12), m.steel, -76, 29, -34, true);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) { put(new THREE.CylinderGeometry(0.45, 0.6, 58, 8), m.steel, -76 + c[0] * 5, 29, -34 + c[1] * 5, true); });
    // flood lights
    [[-58, -68], [74, -58], [88, -6]].forEach(function (c) {
      put(new THREE.CylinderGeometry(0.3, 0.45, 26, 8), m.steel, c[0], 13, c[1], true);
      put(new THREE.BoxGeometry(4, 1.6, 1), m.dark, c[0], 26.5, c[1], true);
    });
    // far away: the giant building where rockets are put together
    put(new THREE.BoxGeometry(160, 160, 210), m.vab, -150, 80, -2820);
    put(new THREE.BoxGeometry(90, 60, 150), m.vab, -20, 30, -2840);

    /* bushes and trees */
    var n = 260, bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), m.bush, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c3 = new THREE.Color();
    var done = 0, tries = 0, spots = [];
    while (done < n && tries++ < 4000) {
      var ang = rnd() * Math.PI * 2, rad = 96 + Math.pow(rnd(), 1.6) * 1500, bx = Math.cos(ang) * rad, bz = Math.sin(ang) * rad;
      if (bx > 960 || (Math.abs(bx) < 26 && bz < -70)) continue; // not on the beach or the crawlerway
      var sz = 2 + rnd() * 4.5;
      m4.compose(new THREE.Vector3(bx, sz * 0.45, bz), q, new THREE.Vector3(sz * (0.9 + rnd() * 0.6), sz * 0.7, sz * (0.9 + rnd() * 0.6)));
      bushes.setMatrixAt(done, m4);
      bushes.setColorAt(done, c3.setHSL(0.28 + rnd() * 0.06, 0.55 + rnd() * 0.2, 0.11 + rnd() * 0.08));
      spots.push([bx, bz, sz]);
      done++;
    }
    bushes.count = done; bushes.receiveShadow = true;
    g.add(bushes);
    var blobGeo = new THREE.CircleGeometry(1, 20); blobGeo.rotateX(-Math.PI / 2);
    var blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({
      map: canvasTex(64, 64, function (c) {
        var gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(10,30,10,0.55)'); gr.addColorStop(0.6, 'rgba(10,30,10,0.3)'); gr.addColorStop(1, 'rgba(10,30,10,0)');
        c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8
    }), done);
    // each soft shadow lies a little way from its bush, on the side away from the Sun
    var away = new THREE.Vector3(-sun.position.x, 0, -sun.position.z).normalize();
    spots.forEach(function (b, k) {
      m4.compose(new THREE.Vector3(b[0] + away.x * b[2] * 0.6, 0.05, b[1] + away.z * b[2] * 0.6), q, new THREE.Vector3(b[2] * 1.7, 1, b[2] * 1.35));
      blobs.setMatrixAt(k, m4);
    });
    g.add(blobs);

    /* lightning masts (shown with the classic rocket) and the service tower */
    R.masts = [];
    [[-46, -40], [46, -40], [0, 60]].forEach(function (p) {
      var mast = put(new THREE.CylinderGeometry(0.25, 0.8, 96, 8), m.steel, p[0], 48, p[1], true);
      R.masts.push(mast);
    });
    R.tower = new THREE.Group();
    g.add(R.tower);
  }

  /**
   * Build the service tower: `h` metres tall, standing at (x, z), with an arm
   * that reaches toward the rocket (stopping `reach` metres from its centre).
   */
  R.setTower = function (h, x, z, reach) {
    var m = siteMats(), t = R.tower, w = 5.4, i;
    while (t.children.length) { var o = t.children.pop(); Stage.dispose(o); }
    function put(geo, mat, px, py, pz) { var k = new THREE.Mesh(geo, mat); k.position.set(px || 0, py || 0, pz || 0); k.castShadow = true; k.receiveShadow = true; t.add(k); return k; }
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) { put(new THREE.BoxGeometry(0.55, h, 0.55), m.steel, c[0] * w / 2, h / 2, c[1] * w / 2); });
    m.latticeMap.repeat.set(1, Math.round(h / 5.4));
    for (i = 0; i < 4; i++) { // cross-braced sides
      var face = put(new THREE.PlaneGeometry(w, h), m.lattice, Math.sin(i * Math.PI / 2) * w / 2, h / 2, Math.cos(i * Math.PI / 2) * w / 2);
      face.rotation.y = i * Math.PI / 2;
    }
    put(new THREE.BoxGeometry(2.2, h, 2.2), m.white, 0, h / 2, 0); // lift shaft
    for (var y = 9; y < h; y += 9) put(new THREE.BoxGeometry(w + 1.6, 0.35, w + 1.6), m.steel, 0, y, 0);
    put(new THREE.BoxGeometry(w + 1, 1.2, w + 1), m.dark, 0, h + 0.6, 0);
    put(new THREE.CylinderGeometry(0.1, 0.25, 12, 8), m.steel, 0, h + 7, 0);
    if (reach) { // access arm to the top of the rocket
      var dist = Math.sqrt(x * x + z * z), len = Math.max(1, dist - reach - w / 2);
      var arm = put(new THREE.BoxGeometry(len, 1.1, 1.6), m.white, 0, h * 0.84, 0);
      var room = put(new THREE.BoxGeometry(2.6, 2.4, 2.6), m.white, 0, h * 0.84, 0);
      var ux = -x / dist, uz = -z / dist, mid = w / 2 + len / 2;
      arm.position.set(ux * mid, h * 0.84, uz * mid); arm.rotation.y = -Math.atan2(uz, ux);
      room.position.set(ux * (w / 2 + len - 0.6), h * 0.84 + 0.3, uz * (w / 2 + len - 0.6)); room.rotation.y = arm.rotation.y;
    }
    t.position.set(x, 0, z);
  };

  /** Set the sky: 0 is a sunny day on the ground, 1 is the black of space. */
  R.setSky = function (space) {
    if (R.dome) R.dome.material.uniforms.space.value = space;
    var col = Stage.bg; // not scene.background: on the home screen that is a picture, which has no colour to blend
    if (space < 0.5) col.copy(HAZE).lerp(SKY_HIGH, space * 2); else col.copy(SKY_HIGH).lerp(SKY_SPACE, (space - 0.5) * 2);
    var fog = Stage.scene.fog;
    if (fog) { fog.color.copy(col); fog.near = 400 - 360 * space; fog.far = 9000 * Math.pow(1 - space, 2) + 700; }
    Stage.stars.material.opacity = space;
  };


  R.build = function () {
    if (R.group) return;
    var g = (R.group = new THREE.Group());

    R.lights = new THREE.Group();
    var sun = new THREE.DirectionalLight(0xfff2dc, 1.9); sun.position.set(-60, 90, 70);
    sun.castShadow = true;
    Stage.shadowLights.push(sun);
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
    var sc = sun.shadow.camera;
    sc.left = -135; sc.right = 135; sc.top = 135; sc.bottom = -135; sc.near = 10; sc.far = 520;
    var fill = new THREE.DirectionalLight(0xdcebff, 0.55); fill.position.set(70, 40, -50);
    R.lights.add(sun, fill, new THREE.HemisphereLight(0xdcecff, 0x6f8a4e, 0.8));
    g.add(R.lights);

    buildSite(g, sun);

    R.vehicle = new THREE.Group();
    R.vehicle.position.y = PAD_TOP;
    g.add(R.vehicle);

    /* exhaust */
    R.flame = new THREE.Group();
    var outer = mesh(new THREE.ConeGeometry(1, 1, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    var inner = mesh(new THREE.ConeGeometry(0.55, 0.7, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    outer.geometry.rotateX(Math.PI); outer.geometry.translate(0, -0.5, 0);   // wide at the nozzle, tapering down
    inner.geometry.rotateX(Math.PI); inner.geometry.translate(0, -0.35, 0);
    R.flame.add(outer, inner);
    R.flame.visible = false;
    R.vehicle.add(R.flame);
    R.glow = new THREE.PointLight(0xff9a40, 0, 220, 1.5);
    R.vehicle.add(R.glow);

    var tex = puffTexture();
    R.puffs = [];
    for (var i = 0; i < 90; i++) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0xf2efe9 }));
      s.visible = false;
      g.add(s);
      R.puffs.push({ s: s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 1 });
    }
    R.nextPuff = 0;

    g.visible = false;
    Stage.scene.add(g);
    R.setStyle(null);
  };

  /** Swap the rocket on the pad. `style` is 'small' | 'medium' | 'heavy' | null (empty pad). */
  R.setStyle = function (style) {
    R.style = style;
    R.masts.forEach(function (k) { k.visible = true; });
    while (R.vehicle.children.length > 2) { // keep flame and glow
      var o = R.vehicle.children[R.vehicle.children.length - 1];
      R.vehicle.remove(o); Stage.dispose(o);
    }
    var s = STYLES[style];
    var towerH = s ? s.h + s.fairH * 0.6 : 30, gap = s ? s.r + 1.2 : 3;
    R.setTower(towerH, -(gap + 4.6), 0, s ? s.r + 0.4 : 0);
    R.height = s ? s.h + s.fairH : 30;
    if (!s) { R.flameSize = 1; return; }

    var white = mat(0xf3f5f7, { roughness: 0.4, metalness: 0.1 });
    var black = mat(0x15191f, { roughness: 0.5 });
    var grey = mat(0x7c8590, { metalness: 0.7, roughness: 0.35 });
    var ember = mat(0xd43d20, { roughness: 0.5 });
    var body = new THREE.Group();

    function stage(r, h, y0, parent) {
      parent.add(mesh(new THREE.CylinderGeometry(r, r, h, 40), white, 0, y0 + h / 2, 0));
      parent.add(mesh(new THREE.CylinderGeometry(r * 1.005, r * 1.005, h * 0.045, 40), black, 0, y0 + h * 0.62, 0));
      parent.add(mesh(new THREE.CylinderGeometry(r * 1.006, r * 1.006, h * 0.018, 40), ember, 0, y0 + h * 0.585, 0));
      parent.add(mesh(new THREE.CylinderGeometry(r * 1.004, r * 1.004, h * 0.06, 40), black, 0, y0 + h * 0.03, 0));
    }
    function nozzles(r, n, parent) {
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2, off = n > 1 ? r * 0.5 : 0;
        parent.add(mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.36, r * 0.9, 16, 1, true), grey, Math.cos(a) * off, -r * 0.4, Math.sin(a) * off));
      }
    }
    function ogive(r, h) {
      var pts = [];
      for (var i = 0; i <= 14; i++) { var t = i / 14; pts.push(new THREE.Vector2(r * Math.cos(t * Math.PI / 2) * (1 - 0.08 * t), h * Math.sin(t * Math.PI / 2))); }
      return new THREE.LatheGeometry(pts, 40);
    }

    stage(s.r, s.h, 0, body);
    nozzles(s.r, s.engines, body);
    // the fairing: the hollow nose cone that protects the satellite
    var skirt = s.fairH * 0.42;
    body.add(mesh(new THREE.CylinderGeometry(s.fairR, s.r, s.fairH * 0.12, 40), white, 0, s.h + s.fairH * 0.06, 0));
    body.add(mesh(new THREE.CylinderGeometry(s.fairR, s.fairR, skirt, 40), white, 0, s.h + s.fairH * 0.12 + skirt / 2, 0));
    var nose = mesh(ogive(s.fairR, s.fairH - s.fairH * 0.12 - skirt), white, 0, s.h + s.fairH * 0.12 + skirt, 0);
    body.add(nose);
    for (var b = 0; b < s.boosters; b++) {
      var side = b === 0 ? 1 : -1, bg = new THREE.Group();
      var bh = s.h * 0.86;
      stage(s.r, bh, 0, bg);
      nozzles(s.r, 3, bg);
      bg.add(mesh(ogive(s.r, s.r * 3.2), white, 0, bh, 0));
      bg.position.z = side * (s.r * 2 + 0.25);
      body.add(bg);
    }
    body.position.y = s.r * 0.85; // stand on the nozzles
    body.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    R.vehicle.add(body);
    R.flameSize = s.r * (s.boosters ? 3 : 1.25);
    R.flame.position.y = 0;
  };

  R.show = function (on) { R.group.visible = on; };

  /** Put everything back on the pad. */
  R.reset = function () {
    R.flying = false; R.t = 0; R.alt = 0; R.dropT = -1; R.fairT = -1;
    R.vehicle.position.y = PAD_TOP; R.vehicle.rotation.z = 0;
    R.flame.visible = false; R.glow.intensity = 0;
    R.puffs.forEach(function (p) { p.life = 0; p.s.visible = false; });
    R.tower.visible = true;
    Stage.shake = 0;
    R.setSky(0);
  };

  R.start = function () { R.reset(); R.flying = true; };

  function puff(x, y, z, vx, vy, vz, size, life) {
    var p = R.puffs[R.nextPuff];
    R.nextPuff = (R.nextPuff + 1) % R.puffs.length;
    p.s.position.set(x, y, z); p.s.scale.setScalar(size);
    p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life; p.grow = size * 1.3;
    p.s.visible = true;
  }

  /**
   * Advance the lift-off. Timeline (seconds): 0–3 countdown with ignition at 2.2,
   * lift-off at 3, then a climb until the sky turns black.
   * Returns {count, lifted, sky (0 day … 1 space), done}.
   */
  R.update = function (dt) {
    if (!R.flying) return null;
    R.t += dt;
    var t = R.t, up = Math.max(0, t - 3);
    var burn = Stage.smooth((t - 2.2) / 0.8);
    R.alt = 4.5 * up * up + 1.6 * Math.pow(up, 3.4);
    R.vehicle.position.y = PAD_TOP + R.alt;
    R.tower.visible = true;

    R.flame.visible = burn > 0.01;
    var flick = 0.85 + Math.random() * 0.3;
    var len = R.flameSize * (3 + 9 * burn + Math.min(up, 6) * 1.5) * flick;
    R.flame.scale.set(R.flameSize * (0.9 + 0.2 * Math.random()), len, R.flameSize * (0.9 + 0.2 * Math.random()));
    R.glow.intensity = 4 * burn * flick;
    R.glow.position.y = -4;

    // smoke: rolling clouds at the pad, then a trail
    if (burn > 0.05 && R.alt < 900) {
      var n = up < 2.5 ? 3 : 1;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 22;
        if (up < 2.5) puff(Math.cos(a) * 4, 2 + Math.random() * 3, Math.sin(a) * 4, Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp, 9 + Math.random() * 8, 3.2);
        else puff((Math.random() - 0.5) * 3, R.vehicle.position.y - 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, -6, (Math.random() - 0.5) * 4, R.flameSize * 4, 2.4);
      }
    }
    for (var j = 0; j < R.puffs.length; j++) {
      var p = R.puffs[j];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      var s = p.s;
      s.position.x += p.vx * dt; s.position.y += p.vy * dt; s.position.z += p.vz * dt;
      p.vx *= 0.97; p.vz *= 0.97;
      s.scale.addScalar(p.grow * dt);
      s.material.opacity = 0.7 * Math.min(1, p.life / p.max * 1.6);
    }

    // the sky darkens as the air thins out
    var sky = Stage.smooth((up - 2.2) / 5.2);
    R.setSky(sky);

    Stage.shake = Stage.reducedMotion ? 0 : burn * (up < 3 ? 0.35 : 0.12);
    return { count: t < 3 ? 3 - Math.floor(t) : 0, lifted: up > 0, sky: sky, done: up > 8.4 };
  };

  /* ====================================================================
   * The build-it-yourself rocket (levels 1 to 4)
   * A small cousin of NASA's Space Launch System: an orange core stage with a
   * big hydrogen tank below a smaller oxygen tank, RS-25 style engines,
   * optional white boosters, and an upper stage carrying the satellite.
   * ==================================================================== */
  var CORE_R = 4.2, BASE = 3.3, FL = RG.Flight, cm = null;

  function customMats() {
    if (cm) return cm;
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), rnd = Stage.seeded(17);
    g.fillStyle = '#d97a30'; g.fillRect(0, 0, 128, 128);
    for (var i = 0; i < 900; i++) { // sprayed-on foam is never one flat colour
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,190,120,0.10)' : 'rgba(120,50,10,0.10)';
      g.beginPath(); g.arc(rnd() * 128, rnd() * 128, 1 + rnd() * 5, 0, 7); g.fill();
    }
    var foam = new THREE.CanvasTexture(c);
    foam.encoding = THREE.sRGBEncoding; foam.wrapS = foam.wrapT = THREE.RepeatWrapping; foam.repeat.set(6, 4); foam.userData.shared = true;
    var r = document.createElement('canvas'); r.width = 64; r.height = 8;
    var rg = r.getContext('2d');
    for (var k = 0; k < 64; k += 8) { rg.fillStyle = '#b8622a'; rg.fillRect(k, 0, 5, 8); rg.fillStyle = '#7c3f18'; rg.fillRect(k + 5, 0, 3, 8); }
    var ribs = new THREE.CanvasTexture(r);
    ribs.encoding = THREE.sRGBEncoding; ribs.wrapS = ribs.wrapT = THREE.RepeatWrapping; ribs.repeat.set(12, 1); ribs.userData.shared = true;
    function std(o) { var m = new THREE.MeshStandardMaterial(o); m.userData.shared = true; return m; }
    cm = {
      foam: std({ map: foam, roughness: 0.9, metalness: 0 }),
      ribs: std({ map: ribs, roughness: 0.85, metalness: 0 }),
      white: std({ color: 0xf4f6f8, roughness: 0.42, metalness: 0.05 }),
      black: std({ color: 0x16191e, roughness: 0.5, metalness: 0.2 }),
      steel: std({ color: 0x5a6068, roughness: 0.35, metalness: 0.9, side: THREE.DoubleSide }),
      blue: std({ color: 0x1cb0f6, roughness: 0.5 }),
      red: std({ color: 0xe8472b, roughness: 0.5 }),
      silver: std({ color: 0xc9d0d8, roughness: 0.3, metalness: 0.9 }),
      clear: std({ color: 0xffffff, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })
    };
    return cm;
  }
  function flameGroup() {
    var f = new THREE.Group();
    var o = new THREE.ConeGeometry(1, 1, 20, 1, true); o.rotateX(Math.PI); o.translate(0, -0.5, 0);
    var i = new THREE.ConeGeometry(0.55, 0.7, 16, 1, true); i.rotateX(Math.PI); i.translate(0, -0.35, 0);
    f.add(new THREE.Mesh(o, new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    f.add(new THREE.Mesh(i, new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    f.visible = false;
    return f;
  }
  function noseShape(r, h) {
    var pts = [];
    for (var i = 0; i <= 16; i++) { var t = i / 16; pts.push(new THREE.Vector2(r * Math.cos(t * Math.PI / 2), h * Math.pow(Math.sin(t * Math.PI / 2), 0.9))); }
    return new THREE.LatheGeometry(pts, 48);
  }

  /**
   * Build the rocket from the player's picks.
   * cfg: { tank: 'S'|'M'|'L', engines: 'E2'|'E3'|'E4', boosters: 'none'|'two', top: true, satellite: design }
   * Any pick may be missing while the rocket is still being put together.
   */
  R.setBuild = function (cfg, popPart) {
    cfg = cfg || {};
    R.style = 'custom'; R.cfg = cfg;
    R.masts.forEach(function (k) { k.visible = false; }); // keep the view of the rocket clear
    while (R.vehicle.children.length > 2) { var old = R.vehicle.children[R.vehicle.children.length - 1]; R.vehicle.remove(old); Stage.dispose(old); }
    var m = customMats(), parts = (R.parts = {}), stack = new THREE.Group();
    var tank = cfg.tank && FL.TANKS[cfg.tank], eng = cfg.engines && FL.ENGINES[cfg.engines];
    var H = tank ? tank.len : 0, ES = 4, y = BASE, topY = BASE;
    R.boostGroups = []; R.boostFlames = []; R.fairing = null; R.cargo = null; R.fairT = -1;
    function part(name, anchor) { var p = new THREE.Group(); p.userData.part = name; stack.add(p); parts[name] = { group: p, anchor: anchor }; return p; }
    function add(p, geo, mat, x, yy, z) { var k = new THREE.Mesh(geo, mat); k.position.set(x || 0, yy || 0, z || 0); p.add(k); return k; }
    function cylg(rt, rb, h, open) { return new THREE.CylinderGeometry(rt, rb, h, 48, 1, !!open); }

    if (tank) {
      var hL = (H - ES) * 0.62, hI = (H - ES) * 0.1, hO = H - ES - hL - hI;
      var lh2 = part('lh2', new THREE.Vector3(0, y + ES + hL * 0.5, CORE_R));
      add(lh2, cylg(CORE_R, CORE_R, ES), m.foam, 0, y + ES / 2, 0);
      add(lh2, cylg(CORE_R * 1.006, CORE_R * 1.006, 0.5), m.white, 0, y + ES, 0);
      add(lh2, cylg(CORE_R, CORE_R, hL), m.foam, 0, y + ES + hL / 2, 0);
      add(lh2, cylg(0.24, 0.24, hL + hI), m.silver, CORE_R * 0.72, y + ES + (hL + hI) / 2, CORE_R * 0.72); // oxygen feed line
      var inter = part('gyro', new THREE.Vector3(0, y + ES + hL + hI * 0.5, CORE_R));
      add(inter, cylg(CORE_R * 1.012, CORE_R * 1.012, hI), m.ribs, 0, y + ES + hL + hI / 2, 0);
      var lox = part('lox', new THREE.Vector3(0, y + ES + hL + hI + hO * 0.5, CORE_R));
      add(lox, cylg(CORE_R, CORE_R, hO), m.foam, 0, y + ES + hL + hI + hO / 2, 0);
      add(lox, cylg(CORE_R * 1.008, CORE_R * 1.008, Math.min(0.9, hO * 0.25)), m.blue, 0, y + ES + hL + hI + hO * 0.5, 0);
      topY = y + H;
    }
    if (eng && tank) {
      var e = part('engines', new THREE.Vector3(0, 1.6, CORE_R * 0.8)), n = eng.n;
      add(e, cylg(CORE_R, CORE_R * 0.92, 0.9), m.black, 0, BASE - 0.1, 0);
      var bell = [];
      for (var i = 0; i <= 10; i++) { var t = i / 10; bell.push(new THREE.Vector2(0.42 + 0.78 * Math.pow(t, 0.6), -t * 2.9)); }
      for (i = 0; i < n; i++) {
        var a = n === 2 ? i * Math.PI : (i / n) * 2 * Math.PI + (n === 4 ? Math.PI / 4 : Math.PI / 2), rr = n === 2 ? 1.7 : n === 3 ? 2.0 : 2.3;
        add(e, new THREE.LatheGeometry(bell, 28), m.steel, Math.cos(a) * rr, BASE - 0.3, Math.sin(a) * rr);
        add(e, cylg(0.5, 0.42, 0.7), m.silver, Math.cos(a) * rr, BASE - 0.1, Math.sin(a) * rr);
      }
    }
    if (cfg.boosters === 'two' && tank) {
      var b = part('boosters', new THREE.Vector3(CORE_R + 3.9, BASE + H * 0.16, 0)), bh = Math.max(16, H * 0.84), br = 1.85;
      [1, -1].forEach(function (side) {
        var bg = new THREE.Group();
        add(bg, cylg(br, br, bh), m.white, 0, bh / 2, 0);
        add(bg, noseShape(br, br * 3), m.white, 0, bh, 0);
        add(bg, cylg(br * 1.02, br * 1.02, 0.7), m.black, 0, bh * 0.72, 0);
        add(bg, cylg(br * 1.02, br * 1.02, 0.7), m.black, 0, bh * 0.36, 0);
        add(bg, cylg(br, br * 1.28, 2.4), m.white, 0, -1.2, 0);
        add(bg, cylg(br * 0.6, br * 0.95, 2.2, true), m.steel, 0, -3.1, 0);
        add(bg, new THREE.BoxGeometry(1.2, 0.5, 0.5), m.black, -side * (br + 0.4), bh * 0.2, 0);
        add(bg, new THREE.BoxGeometry(1.2, 0.5, 0.5), m.black, -side * (br + 0.4), bh * 0.8, 0);
        var fl = flameGroup(); fl.position.y = -4.2; bg.add(fl);
        bg.position.set(side * (CORE_R + br + 0.55), BASE + 1.2, 0);
        bg.userData.side = side;
        b.add(bg);
        R.boostGroups.push(bg); R.boostFlames.push(fl);
      });
    }
    if (cfg.top && tank) {
      var up = part('upper', new THREE.Vector3(0, topY + 5.5, 2.7));
      add(up, cylg(2.7, CORE_R, 3.6), m.foam, 0, topY + 1.8, 0);
      add(up, cylg(2.7, 2.7, 4.6), m.white, 0, topY + 5.9, 0);
      add(up, cylg(2.72, 2.72, 0.5), m.silver, 0, topY + 4.2, 0);
      var nose = part('nose', new THREE.Vector3(0, topY + 15, 2.2)), fairMat = cfg.peek ? m.clear : m.white;
      R.fairing = [add(nose, cylg(2.75, 2.7, 3.6, true), fairMat, 0, topY + 10, 0), add(nose, noseShape(2.75, 7.5), fairMat, 0, topY + 11.8, 0)];
      add(nose, cylg(2.77, 2.77, 0.45), m.red, 0, topY + 8.6, 0);
      var cargo = part('satellite', new THREE.Vector3(0, topY + 11.4, 2.75));
      if (cfg.satellite && RG.SatModel) {
        var sat = RG.SatModel.flightCopy(cfg.satellite);
        sat.scale.setScalar(4.6); sat.rotation.x = Math.PI; sat.position.set(0, topY + 11.4, 0);
        sat.visible = !!cfg.peek;
        cargo.add(sat);
        R.cargo = sat;
      }
      topY += 19.3;
    }
    stack.traverse(function (o) { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    R.vehicle.add(stack);
    R.stack = stack;
    R.height = Math.max(20, topY);
    R.flameSize = eng ? 1.5 + eng.n * 0.55 : 1;
    R.flame.position.y = 0.4;
    R.setTower(Math.max(30, R.height * 0.92), -10.5, -10.5, tank ? 3.2 : 0);
    if (popPart && parts[popPart] && !Stage.reducedMotion) R.pop = { g: parts[popPart].group, t: 0 };
  };

  /** Where a named part is in the world (for labels and the camera). */
  R.partPos = function (name) {
    var p = R.parts && R.parts[name];
    return p ? R.vehicle.localToWorld(p.anchor.clone()) : null;
  };

  /** Make the nose cone see-through to show the satellite inside. */
  R.setPeek = function (on) {
    if (!R.fairing) return;
    R.fairing.forEach(function (k) { k.material = on ? cm.clear : cm.white; k.castShadow = !on; });
    if (R.cargo) R.cargo.visible = on;
  };

  /** Let the nose cone go (the two-player launch): its shells fall away and the satellite inside is uncovered. */
  R.dropFairing = function () {
    if (!R.fairing || R.fairT >= 0) return;
    R.fairT = 0;
    if (R.cargo) R.cargo.visible = true;
  };

  /**
   * Draw one moment of a flight.
   * o: { alt (metres), pitch (radians from straight up), burn (0…1), boost: 'on'|'empty'|'gone'|'none', sky (0 day … 1 space) }
   */
  R.flightUpdate = function (o, dt) {
    R.vehicle.position.y = PAD_TOP + o.alt;
    R.vehicle.rotation.z = -o.pitch;
    var flick = 0.85 + Math.random() * 0.3;
    R.flame.visible = o.burn > 0.02;
    R.flame.scale.set(R.flameSize, R.flameSize * (5 + 9 * o.burn) * flick, R.flameSize);
    R.glow.intensity = 4 * o.burn * flick; R.glow.position.y = -4;
    (R.boostFlames || []).forEach(function (f) { f.visible = o.boost === 'on'; f.scale.set(1.9, 22 * flick, 1.9); });
    if (o.boost === 'gone' && R.dropT < 0 && R.boostGroups && R.boostGroups.length) R.dropT = 0;
    if (R.dropT >= 0 && R.boostGroups) { // the empty boosters peel away and fall behind
      R.dropT += dt;
      R.boostGroups.forEach(function (bg) {
        bg.position.x += bg.userData.side * 9 * dt;
        bg.position.y -= (10 + 40 * R.dropT) * dt;
        bg.rotation.z -= bg.userData.side * 0.35 * dt;
        if (R.dropT > 4) bg.visible = false;
      });
    }
    if (R.fairT >= 0 && R.fairing) { // the shells of the nose cone peel off to either side
      R.fairT += dt;
      R.fairing.forEach(function (k, i) {
        var side = i ? 1 : -1;
        k.position.x += side * 8 * dt; k.position.y -= (6 + 34 * R.fairT) * dt; k.rotation.z -= side * 0.6 * dt;
        if (R.fairT > 3.5) k.visible = false;
      });
    }
    if (o.burn > 0.02 && o.alt < 600) { // clouds of exhaust around the pad
      for (var i = 0; i < 2; i++) {
        var a = Math.random() * Math.PI * 2, sp = 12 + Math.random() * 26;
        puff(Math.cos(a) * 5, 2 + Math.random() * 3, Math.sin(a) * 5, Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp, 10 + Math.random() * 9, 3);
      }
    }
    for (var j = 0; j < R.puffs.length; j++) {
      var p = R.puffs[j];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      p.vx *= 0.97; p.vz *= 0.97;
      p.s.scale.addScalar(p.grow * dt);
      p.s.material.opacity = 0.7 * Math.min(1, (p.life / p.max) * 1.6);
    }
    var sky = o.sky;
    R.setSky(sky);
    Stage.shake = Stage.reducedMotion ? 0 : o.burn * (o.alt < 3000 ? 0.4 : 0.1) * (1 - sky * 0.8);
  };

  /** Small per-frame animation for a part that was just added. */
  R.tick = function (dt) {
    if (R.group.visible && R.dome) { // the sky travels with the camera, so you can never reach its edge
      R.dome.position.copy(Stage.camera.position);
      R.dome.material.uniforms.time.value += dt;
      var near = Math.max(0.5, Stage.rig.radius * 0.02);
      if (Math.abs(near - Stage.camera.near) > 0.05) { Stage.camera.near = near; Stage.camera.updateProjectionMatrix(); }
    }
    if (!R.pop) return;
    R.pop.t += dt / 0.45;
    var k = Stage.easeOutBack(Math.min(1, R.pop.t));
    R.pop.g.scale.set(1, Math.max(0.001, k), 1);
    R.pop.g.position.y = (1 - k) * 14;
    if (R.pop.t >= 1) { R.pop.g.scale.set(1, 1, 1); R.pop.g.position.y = 0; R.pop = null; }
  };

  RG.Rocket = R;
})();
