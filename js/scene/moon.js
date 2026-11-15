/* Orbit Ranger — the Moon (level 6).
 * The ground of an Apollo landing site (shape from NASA, see core/lunar.js),
 * NASA's Apollo Lunar Module and astronaut models, a low Sun with long
 * shadows, Earth in a black sky, engine plume, flying dust, footprints, and
 * the science kit set up on the surface.
 * Axes: x is the direction of flight, y is up, z is to the right of the flight.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE, Stage = RG.Stage, L = RG.Lunar, Md = RG.Models;
  var M = { group: null, T: null, lmPos: new THREE.Vector3(), pitch: 0, astroPos: new THREE.Vector3(), heading: 0 };
  var ground, rocks, field, sun, lm, lmPivot, lmBody, plume, core, dust, dustData, marker, beacon, earth, astro, astroBody;
  var prints, printCount = 0, props = [], envTex = null, soil = null, time = 0;
  var SUN = new THREE.Vector3(-Math.cos(0.26) * Math.cos(0.6), Math.sin(0.26), Math.cos(0.26) * Math.sin(0.6)).normalize(); // 15° above the horizon, behind the lander
  var LM_HEIGHT = 7, LM_YAW = Math.PI / 2, ASTRO_YAW = 0, DUST = 260;
  var v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), m4 = new THREE.Matrix4(), q1 = new THREE.Quaternion(), e1 = new THREE.Euler();

  /** Light for shiny parts to reflect: a black sky, sunlit ground, and the Sun. */
  M.env = function () {
    if (envTex) return envTex;
    var room = new THREE.Scene();
    room.add(new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })));
    var floor = new THREE.Mesh(new THREE.CircleGeometry(30, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8d8a84).multiplyScalar(1.15) }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.5; room.add(floor);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff4e2).multiplyScalar(26), side: THREE.DoubleSide }));
    disc.position.copy(SUN).multiplyScalar(26); disc.lookAt(0, 0, 0); room.add(disc);
    var pm = new THREE.PMREMGenerator(Stage.renderer);
    envTex = pm.fromScene(room, 0.03).texture;
    room.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pm.dispose();
    return envTex;
  };

  function soilTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d'), rnd = Stage.seeded(31), img = g.createImageData(256, 256), d = img.data, i;
    for (i = 0; i < d.length; i += 4) { var n = 206 + (rnd() - 0.5) * 64; d[i] = n; d[i + 1] = n - 2; d[i + 2] = n - 6; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    for (i = 0; i < 40; i++) { // tiny craters: a dark bowl with a bright rim on the sunny side
      var x = 14 + rnd() * 228, y = 14 + rnd() * 228, r = 2 + rnd() * rnd() * 9;
      g.fillStyle = 'rgba(70,68,64,0.38)'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, 2.4, 5.2); g.stroke();
    }
    for (i = 0; i < 160; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(40,40,40,0.4)'; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.userData.shared = true;
    return t;
  }

  function axis(n, lo, hi) { // n + 1 coordinates from lo to hi, packed close together near 0
    var out = [];
    for (var i = 0; i <= n; i++) { var t = i / n * 2 - 1, m = Math.abs(t), f = 0.07 * m + 0.93 * m * m * m; out.push(t < 0 ? -f * Math.abs(lo) : f * hi); }
    return out;
  }

  M.build = function () {
    if (M.group) return;
    var g = M.group = new THREE.Group(); g.visible = false; Stage.scene.add(g);
    soil = soilTexture();
    sun = new THREE.DirectionalLight(0xfff5e6, 3.4);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 20; sc.far = 800;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    g.add(sun, sun.target); Stage.shadowLights.push(sun);
    g.add(new THREE.HemisphereLight(0x10141c, 0x77746c, 0.5)); // light bounced up off the ground

    // Earth in the sky (NASA Blue Marble map from 3D Resources). Its own small shader: lit only by the Sun,
    // so it shows the right phase, with a thin blue rim of air.
    var blank = document.createElement('canvas'); blank.width = blank.height = 2; var bx = blank.getContext('2d'); bx.fillStyle = '#2b62b8'; bx.fillRect(0, 0, 2, 2);
    var blue = new THREE.CanvasTexture(blank); blue.encoding = THREE.sRGBEncoding;
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({
      uniforms: { map: { value: blue }, sun: { value: SUN.clone() } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 sun; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() { vec3 n = normalize(vN); float lit = smoothstep(-0.06, 0.28, dot(n, sun)); vec3 col = texture2D(map, vUv).rgb * lit * 1.3; float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.5); col += vec3(0.22, 0.48, 1.0) * rim * (0.08 + 0.92 * lit); gl_FragColor = vec4(col, 1.0);\n#include <encodings_fragment>\n}'
    }));
    earth.frustumCulled = false; g.add(earth);
    Md.load('globe-earth', function (globe) {
      if (!globe) return;
      globe.traverse(function (o) { if (o.isMesh && o.material.map) earth.material.uniforms.map.value = o.material.map; });
    }, { keep: true });

    // the lander: a stand-in shape first, NASA's Apollo Lunar Module as soon as it has loaded
    lm = new THREE.Group(); lmPivot = new THREE.Group(); lmPivot.position.y = 3; lm.add(lmPivot); g.add(lm);
    lmBody = standIn(); lmBody.position.y = -3; lmPivot.add(lmBody);
    Md.load('apollo-lunar-module', function (model) {
      if (!model) return;
      var k = LM_HEIGHT / model.userData.size.y;
      model.scale.setScalar(k); model.position.y = -3 + LM_HEIGHT / 2; model.rotation.y = LM_YAW;
      model.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      lmPivot.remove(lmBody); Stage.dispose(lmBody); lmBody = model; lmPivot.add(model);
    }, { keep: true });
    plume = new THREE.Mesh(new THREE.ConeGeometry(1.5, 7, 20, 1, true).translate(0, -3.5, 0),
      new THREE.MeshBasicMaterial({ color: 0x9fc6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    core = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.2, 14, 1, true).translate(0, -1.6, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    plume.position.y = core.position.y = -2.1; lmPivot.add(plume, core);

    // dust thrown out by the engine: with no air it flies in flat, straight sheets
    var dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xd8d2c6, size: 0.7, transparent: true, opacity: 0.55, depthWrite: false }));
    dust.frustumCulled = false; g.add(dust);
    dustData = []; for (var i = 0; i < DUST; i++) dustData.push({ life: 0, vx: 0, vy: 0, vz: 0 });

    marker = new THREE.Mesh(new THREE.RingGeometry(9, 10, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 90, 8).translate(0, 45, 0), new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    marker.add(beacon); g.add(marker);

    astro = new THREE.Group(); astro.visible = false; g.add(astro);
    astroBody = new THREE.Mesh(THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.32, 1.1, 4, 10) : new THREE.CylinderGeometry(0.32, 0.32, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.8 }));
    astroBody.position.y = 0.95; astroBody.castShadow = true; astro.add(astroBody);
    Md.load('astronaut', function (model) {
      if (!model) return;
      var k = 1.9 / model.userData.size.y;
      model.scale.setScalar(k); model.position.y = 0.95; model.rotation.y = ASTRO_YAW;
      model.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      astro.remove(astroBody); Stage.dispose(astroBody); astroBody = model; astro.add(model);
    }, { keep: true });

    prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.17, 0.36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1c1b1a, transparent: true, opacity: 0.55, depthWrite: false }), 500);
    prints.count = 0; prints.frustumCulled = false; g.add(prints);
  };

  function standIn() { // used only until (or unless) the NASA model arrives
    var g = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: 0xc9a13c, roughness: 0.45, metalness: 0.8 }), grey = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.5, metalness: 0.6 });
    var base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.7, 8), gold); base.position.y = 2.3;
    var cab = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 2.6, 10), grey); cab.position.y = 4.5;
    g.add(base, cab);
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + Math.PI / 4, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6), grey);
      leg.position.set(Math.cos(a) * 2.9, 1.4, Math.sin(a) * 2.9); leg.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
      var pad = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 12), gold); pad.position.set(Math.cos(a) * 3.8, 0.06, Math.sin(a) * 3.8);
      g.add(leg, pad);
    }
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  M.show = function (on) {
    if (!M.group) { if (!on) return; M.build(); }
    M.group.visible = on;
  };

  /** Build the ground of one landing site. */
  M.setSite = function (siteId) {
    M.build();
    var T = M.T = L.terrain(siteId), n = 170, xs = axis(n, T.minX, T.maxX), zs = axis(n, T.minZ, T.maxZ);
    var pos = new Float32Array((n + 1) * (n + 1) * 3), uv = new Float32Array((n + 1) * (n + 1) * 2), col = new Float32Array((n + 1) * (n + 1) * 3), idx = [], i, j, k = 0, lo = 1e9, hi = -1e9;
    for (j = 0; j <= n; j++) for (i = 0; i <= n; i++) { var y = T.height(xs[i], zs[j]); pos[k * 3] = xs[i]; pos[k * 3 + 1] = y; pos[k * 3 + 2] = zs[j]; uv[k * 2] = xs[i] / 13; uv[k * 2 + 1] = zs[j] / 13; lo = Math.min(lo, y); hi = Math.max(hi, y); k++; }
    var rnd = Stage.seeded(9);
    for (k = 0; k < (n + 1) * (n + 1); k++) { var b = 0.3 + 0.2 * (pos[k * 3 + 1] - lo) / Math.max(1, hi - lo) + (rnd() - 0.5) * 0.05; col[k * 3] = b; col[k * 3 + 1] = b * 0.985; col[k * 3 + 2] = b * 0.955; }
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) { var a = j * (n + 1) + i, c = a + n + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    if (ground) { M.group.remove(ground); ground.geometry.dispose(); }
    else M.groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: soil, bumpMap: soil, bumpScale: 0.5, roughness: 1, metalness: 0 });
    M.groundMat.envMapIntensity = 0.15; M.groundMat.userData.shared = true;
    ground = new THREE.Mesh(geo, M.groundMat); ground.receiveShadow = true; M.group.add(ground);
    // beyond the mapped square, plain ground out to the horizon (about 40 km away from this height)
    if (!M.skirt) {
      var sm = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }); sm.color.setRGB(0.21, 0.206, 0.2); sm.envMapIntensity = 0.15;
      M.skirt = new THREE.Mesh(new THREE.RingGeometry(900, 60000, 64, 1).rotateX(-Math.PI / 2), sm);
      M.group.add(M.skirt);
    }
    var rim = 0, cnt = 0;
    for (i = 0; i <= n; i += 10) { rim += T.height(xs[i], zs[0]) + T.height(xs[i], zs[n]) + T.height(xs[0], zs[i]) + T.height(xs[n], zs[i]); cnt += 4; }
    M.skirt.position.set((T.minX + T.maxX) / 2, Math.min(rim / cnt, lo + (hi - lo) * 0.3) - 6, (T.minZ + T.maxZ) / 2);

    [rocks, field].forEach(function (r) { if (r) { M.group.remove(r); r.geometry.dispose(); } });
    rocks = rockField(T.rocks, 1); field = rockField(T.field, 1.25); field.visible = false;
    M.group.add(rocks, field);

    // Earth. From these sites it really hangs high overhead (T.earthEl degrees up), out of sight while you look
    // at the ground. The game draws it low over the hills ahead of the lander, and 2.6 times its true size, so
    // it can be seen while flying and walking. It clears whatever high ground lies in that direction.
    var az = 0.72, el = 0.21, ex = Math.cos(az), ez = Math.sin(az);
    for (var dd = 150; dd < 2300; dd += 75) el = Math.max(el, Math.atan2(T.height(ex * dd, ez * dd) - 2, dd) + 0.07);
    M.earthDir = new THREE.Vector3(Math.cos(el) * ex, Math.sin(el), Math.cos(el) * ez);
    earth.position.copy(M.earthDir).multiplyScalar(40000);
    earth.scale.setScalar(40000 * Math.tan(0.95 * Math.PI / 180) * 2.6);
    earth.rotation.set(0.35, 2.2 - T.site.lon * Math.PI / 180, 0.25);
    M.clearSurface();
    M.setTarget(0, true);
    return T;
  };

  function rockField(list, big) {
    var geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position, rnd = Stage.seeded(3);
    for (var i = 0; i < p.count; i++) { var s = 0.78 + rnd() * 0.44; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.75, p.getZ(i) * s); }
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({ color: 0x8b8882, roughness: 1, flatShading: true }); mat.envMapIntensity = 0.1;
    var mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach(function (r, i) {
      e1.set(r.a, r.a * 1.7, 0); q1.setFromEuler(e1);
      m4.compose(v1.set(r.x, M.T.height(r.x, r.z) + r.s * 0.22 * big, r.z), q1, v2.set(r.s * big, r.s * 0.8 * big, r.s * big));
      mesh.setMatrixAt(i, m4);
    });
    mesh.count = list.length; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    return mesh;
  }

  M.setBoulders = function (on) { if (field) field.visible = on; };
  M.setTarget = function (x, on) {
    marker.visible = on;
    if (on) marker.position.set(x, M.T.height(x, 0) + 0.25, 0);
  };

  /** Aim the Sun's shadow camera at whatever the player is looking at. */
  M.focus = function (x, y, z) {
    sun.target.position.set(x, y, z);
    sun.position.set(x + SUN.x * 400, y + SUN.y * 400, z + SUN.z * 400);
  };

  /* ---------- the lander ---------- */
  /** s: the flight state from core/lunar.js. onGround: stand level on the surface. */
  M.setLander = function (s, onGround) {
    M.lmPos.set(s.x, onGround ? M.T.height(s.x, 0) : s.y, 0);
    M.pitch = onGround ? 0 : s.pitch;
    lm.position.copy(M.lmPos); lmPivot.rotation.z = M.pitch;
    var thr = onGround || s.fuel <= 0 ? 0 : s.thr, flick = 0.9 + Math.random() * 0.2;
    plume.visible = core.visible = thr > 0.02;
    plume.scale.set(0.7 + thr * 0.5, (0.35 + thr * 1.5) * flick, 0.7 + thr * 0.5); core.scale.y = (0.4 + thr) * flick;
    M.focus(s.x, M.lmPos.y, 0);
    M.thr = thr;
  };
  M.showLander = function (on) { lmBody.visible = on; plume.material.visible = core.material.visible = on; };

  /** The view from outside: behind and beside the lander. */
  M.chaseCam = function (cam) {
    var alt = M.lmPos.y - M.T.height(M.lmPos.x, 0), d = Stage.clamp(22 + alt * 0.07, 22, 70), portrait = Math.max(1, 1.2 / cam.aspect);
    cam.position.set(M.lmPos.x - d * 0.9 * portrait, Math.max(M.T.height(M.lmPos.x - d * 0.9 * portrait, d * 0.75) + 2.5, M.lmPos.y + 3 + d * 0.22), d * 0.75 * portrait);
    cam.up.set(0, 1, 0);
    cam.lookAt(M.lmPos.x + 7, M.lmPos.y + 2, 0);
  };
  /** The view through the commander's window: forward and down, tilting with the lander. */
  M.cockpitCam = function (cam) {
    var p = M.pitch, ux = -Math.sin(p), uy = Math.cos(p), fx = Math.cos(p), fy = Math.sin(p), down = 0.8;
    cam.position.set(M.lmPos.x + ux * 5.2 + fx * 1.3, M.lmPos.y + 3 * (1 - uy) + uy * 5.2 + fy * 1.3, -0.55);
    cam.up.set(ux, uy, 0);
    cam.lookAt(cam.position.x + fx * Math.cos(down) - ux * Math.sin(down), cam.position.y + fy * Math.cos(down) - uy * Math.sin(down), cam.position.z);
  };

  /* ---------- dust ---------- */
  M.tick = function (dt) {
    if (!M.group || !M.group.visible) return;
    time += dt;
    if (Stage.quality === 0 && M.groundMat && M.groundMat.bumpMap) { M.groundMat.bumpMap = null; M.groundMat.needsUpdate = true; } // lightest setting: no fine surface relief
    var p = dust.geometry.attributes.position, alt = M.lmPos.y - M.T.height(M.lmPos.x, 0), blowing = M.thr > 0.08 && alt < 34 && lm.visible;
    var spawn = blowing ? Math.ceil((1 - alt / 34) * M.thr * 520 * dt) : 0, gy = M.T.height(M.lmPos.x, 0);
    for (var i = 0; i < DUST; i++) {
      var d = dustData[i];
      if (d.life > 0) {
        d.life -= dt; d.vy -= L.G * dt;
        p.setXYZ(i, p.getX(i) + d.vx * dt, Math.max(gy + 0.1, p.getY(i) + d.vy * dt), p.getZ(i) + d.vz * dt);
        if (d.life <= 0) p.setXYZ(i, 0, -9999, 0);
      } else if (spawn > 0) {
        spawn--;
        var a = Math.random() * 6.283, sp = 9 + Math.random() * 22;
        d.life = 0.7 + Math.random() * 0.9; d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = 0.6 + Math.random() * 2.2;
        p.setXYZ(i, M.lmPos.x + Math.cos(a) * 1.2, gy + 0.2, Math.sin(a) * 1.2);
      } else if (d.life === 0) { p.setXYZ(i, 0, -9999, 0); d.life = -1; }
    }
    p.needsUpdate = true;
    marker.scale.setScalar(1 + Math.sin(time * 3) * 0.05);
    props.forEach(function (pr) { if (!pr.done) pr.ring.scale.setScalar(1 + Math.sin(time * 4 + pr.x) * 0.12); });
  };

  /* ---------- the surface ---------- */
  M.clearSurface = function () {
    props.forEach(function (p) { M.group.remove(p.group); Stage.dispose(p.group); });
    props = []; prints.count = 0; printCount = 0; astro.visible = false;
  };
  function mesh(geo, color, o) { var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.5, metalness: 0.3 }, o || {}))); m.castShadow = true; return m; }
  /**
   * The flag of Nepal, drawn to the construction in Nepal's constitution: on a base AB, a hoist AC of one and a
   * third AB; D on the hoist at AB; E on BD at AB from B; FG through E, level with the base, as long as AB; then C
   * to G. Crimson field, blue border, a white moon in the upper pennon and a white sun in the lower one.
   * The picture is transparent outside the flag, so a plain rectangle of cloth takes its shape.
   */
  var FLAG = { x0: -0.08, x1: 1.16, y0: -0.08, y1: 1.5, px: 220 };
  function flagCloth() {
    var F = FLAG, c = document.createElement('canvas'); c.width = Math.round((F.x1 - F.x0) * F.px); c.height = Math.round((F.y1 - F.y0) * F.px);
    var g = c.getContext('2d'), k = Math.SQRT1_2;
    function X(x) { return (x - F.x0) * F.px; } function Y(y) { return (F.y1 - y) * F.px; }
    function outline() { g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(0)); g.lineTo(X(1 - k), Y(k)); g.lineTo(X(1), Y(k)); g.lineTo(X(0), Y(4 / 3)); g.closePath(); }
    function star(cx, cy, rays, outer, inner) {
      g.beginPath();
      for (var i = 0; i < rays * 2; i++) { var a = Math.PI / 2 + i * Math.PI / rays, r = i % 2 ? inner : outer; g.lineTo(X(cx + Math.cos(a) * r), Y(cy + Math.sin(a) * r)); }
      g.closePath(); g.fill();
    }
    g.lineJoin = 'miter'; g.miterLimit = 12;
    outline(); g.strokeStyle = '#003893'; g.lineWidth = 0.075 * F.px; g.stroke(); // the blue border
    g.fillStyle = '#DC143C'; g.fill();
    g.save(); outline(); g.clip();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(X(0.25), Y(1.0), 0.128 * F.px, 0, 6.3); g.fill();            // the moon: a crescent...
    g.fillStyle = '#DC143C'; g.beginPath(); g.arc(X(0.25), Y(1.05), 0.116 * F.px, 0, 6.3); g.fill();
    g.fillStyle = '#fff'; star(0.25, 0.985, 16, 0.078, 0.05);                           // ...holding a rayed disc
    star(0.25, 0.345, 12, 0.165, 0.108);                                                // the sun, twelve rays
    g.restore();
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  var MAKE = {
    flag: function (g) {
      var F = FLAG, m = 0.8; // metres across the base of the flag
      var pole = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), 0xd9dde2); pole.position.y = 1.2;
      var w = (F.x1 - F.x0) * m, h = (F.y1 - F.y0) * m, foot = 2.36 - (4 / 3) * m;
      var cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 10, 10), new THREE.MeshStandardMaterial({ map: flagCloth(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 }));
      var p = cloth.geometry.attributes.position; for (var i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 8) * 0.03); // creases: it was packed folded, and no air smooths it
      cloth.geometry.computeVertexNormals();
      cloth.position.set(F.x0 * m + w / 2 + 0.02, foot + F.y0 * m + h / 2, 0); cloth.castShadow = true;
      var cam = mesh(new THREE.BoxGeometry(0.2, 0.16, 0.3), 0xe8e8e8); cam.position.set(-1.6, 1.2, 0.6);
      var tri = mesh(new THREE.CylinderGeometry(0.015, 0.2, 1.15, 3), 0x888888); tri.position.set(-1.6, 0.57, 0.6);
      g.add(pole, cloth, cam, tri);
    },
    seismo: function (g) {
      var skirt = mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.03, 20), 0xdfe3e6, { metalness: 0.9, roughness: 0.25 }); skirt.position.y = 0.03;
      var drum = mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.36, 16), 0xcaa23a, { metalness: 0.85, roughness: 0.4 }); drum.position.y = 0.2;
      var ant = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.7, 5), 0xcccccc); ant.position.set(0.5, 0.35, 0);
      g.add(skirt, drum, ant);
    },
    mirror: function (g) {
      var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'); x.fillStyle = '#9db4c8'; x.fillRect(0, 0, 64, 64);
      for (var i = 0; i < 10; i++) for (var j = 0; j < 10; j++) { x.fillStyle = (i + j) % 2 ? '#e9f4ff' : '#6f8fb0'; x.beginPath(); x.arc(3.2 + i * 6.4, 3.2 + j * 6.4, 2.3, 0, 6.3); x.fill(); }
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      var tray = mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), 0xffffff, { map: t, metalness: 0.7, roughness: 0.2 }); tray.position.y = 0.3; tray.rotation.set(0.5, 0.4, 0);
      var leg = mesh(new THREE.BoxGeometry(0.5, 0.28, 0.04), 0xb8bcc2); leg.position.set(0, 0.14, -0.12);
      g.add(tray, leg);
    },
    drill: function (g) {
      for (var i = 0; i < 3; i++) { var a = i * 2.094, leg = mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 5), 0xc7cbd1); leg.position.set(Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3); leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(leg); }
      var rod = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), 0xe2b94a, { metalness: 0.8 }); rod.position.y = 0.75;
      var box = mesh(new THREE.BoxGeometry(0.3, 0.2, 0.22), 0xe9e9e9); box.position.set(0.7, 0.1, 0.2);
      g.add(rod, box);
    },
    rocks: function (g) {
      var r = mesh(new THREE.IcosahedronGeometry(0.16, 0), 0xa9a49c, { flatShading: true, roughness: 1, metalness: 0 }); r.position.y = 0.1; r.rotation.set(1, 2, 0.5); g.add(r);
    }
  };
  /** Put a glowing ring on the ground for each job. */
  M.setTasks = function (tasks, base) {
    M.clearSurface();
    tasks.forEach(function (t) {
      var g = new THREE.Group(), x = base.x + t.x, z = base.z + t.z, y = M.T.height(x, z);
      g.position.set(x, y, z); g.rotation.y = t.x * 0.7;
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
      ring.position.y = 0.08; g.add(ring);
      var item = new THREE.Group(); MAKE[t.kit](item); item.visible = t.kit === 'rocks'; g.add(item);
      M.group.add(g);
      props.push({ id: t.id, kit: t.kit, group: g, ring: ring, item: item, x: x, y: y, z: z, done: false });
    });
    M.props = props;
    return props;
  };
  M.taskDone = function (id) {
    props.forEach(function (p) {
      if (p.id !== id) return;
      p.done = true; p.ring.visible = false; p.item.visible = p.kit !== 'rocks';
    });
  };

  M.setAstronaut = function (x, y, z, heading, on) {
    M.astroPos.set(x, y, z); M.heading = heading;
    astro.visible = on !== false; astro.position.set(x, y, z); astro.rotation.y = heading;
    M.focus(x, y, z);
  };
  M.showAstronaut = function (on) { astro.visible = on; };
  /** Leave a bootprint. With no wind or rain it will last for millions of years. */
  M.footprint = function (x, z, heading, left) {
    var side = left ? 0.13 : -0.13, px = x + Math.cos(heading) * side, pz = z - Math.sin(heading) * side;
    e1.set(0, heading, 0); q1.setFromEuler(e1);
    m4.compose(v1.set(px, M.T.height(px, pz) + 0.03, pz), q1, v2.set(1, 1, 1));
    prints.setMatrixAt(printCount % 500, m4); printCount++;
    prints.count = Math.min(500, printCount); prints.instanceMatrix.needsUpdate = true;
  };
  /** The view from inside the helmet. Dragging the screen turns the head (the camera rig's angles). */
  M.eyeCam = function (cam, dt, rig) {
    var pitch = rig.el - 0.26, ce = Math.cos(pitch); // drag up to look at the sky, down to see your boots
    cam.position.set(M.astroPos.x, M.astroPos.y + 1.72, M.astroPos.z);
    cam.up.set(0, 1, 0);
    cam.lookAt(cam.position.x - ce * Math.cos(rig.az), cam.position.y - Math.sin(pitch), cam.position.z + ce * Math.sin(rig.az));
  };

  Stage.onFrame(function (dt) { M.tick(dt); });
  RG.MoonScene = M;
})();
