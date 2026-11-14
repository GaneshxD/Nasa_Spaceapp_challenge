/* Orbit Ranger — the Earth scene.
 * One unit of length is one Earth radius (6,371 km), so a satellite 700 km up
 * sits at radius 1.11. Everything that is stuck to the planet (fires, ground
 * stations, the coverage paint) lives in `spin`, which turns with the Earth.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE;
  var P = RG.Physics, D = RG.DATA, Stage = RG.Stage;

  var E = { built: false };
  var SUN = new THREE.Vector3(P.SUN[0], P.SUN[1], P.SUN[2]);
  var Y = new THREE.Vector3(0, 1, 0);
  var PAINT_W = 1024, PAINT_H = 512;
  var v3 = function (a, s) { s = s || 1; return new THREE.Vector3(a[0] * s, a[1] * s, a[2] * s); };

  E.build = function () {
    if (E.built) return;
    E.built = true;
    var root = (E.group = new THREE.Group());
    var spin = (E.spin = new THREE.Group());
    root.add(spin);

    /* lights for the little satellite model */
    E.lights = new THREE.Group();
    var sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sun.position.copy(SUN).multiplyScalar(30);
    E.lights.add(sun, new THREE.AmbientLight(0x8fa8d8, 0.45));
    root.add(E.lights);

    /* the globe */
    var day = loadTexture(RG.TEXTURES.earthDay), night = loadTexture(RG.TEXTURES.earthNight);
    E.globeMat = new THREE.ShaderMaterial({
      uniforms: { dayMap: { value: day }, nightMap: { value: night }, sunDir: { value: SUN.clone() } },
      vertexShader: [
        'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
        'void main(){',
        '  vUv = uv;',
        '  vN = normalize(mat3(modelMatrix) * normal);',
        '  vec4 w = modelMatrix * vec4(position, 1.0);',
        '  vW = w.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * w;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunDir;',
        'varying vec2 vUv; varying vec3 vN; varying vec3 vW;',
        'void main(){',
        '  vec3 N = normalize(vN);',
        '  float d = dot(N, sunDir);',
        '  float lit = smoothstep(-0.10, 0.22, d);',
        '  vec3 dayC = texture2D(dayMap, vUv).rgb;',
        '  vec3 nightC = texture2D(nightMap, vUv).rgb;',
        // keep the city lights, drop the dark-blue base of the night image
        '  vec3 lights = max(nightC - vec3(0.02, 0.03, 0.085), 0.0) * vec3(3.4, 3.0, 2.2);',
        '  vec3 dark = dayC * vec3(0.022, 0.03, 0.055) + lights;',
        // a touch of blue air over the near-black oceans of the Blue Marble image
        '  vec3 bright = (dayC + vec3(0.002, 0.010, 0.040)) * (0.10 + 1.05 * max(d, 0.0));',
        '  vec3 col = mix(dark, bright, lit);',
        '  vec3 V = normalize(cameraPosition - vW);',
        '  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.5);',
        '  col += vec3(0.20, 0.42, 0.95) * rim * (0.10 + 0.75 * lit);',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });
    E.globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), E.globeMat);
    spin.add(E.globe);

    /* the thin glow of air around the planet */
    var air = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: { sunDir: { value: SUN.clone() } },
        vertexShader: [
          'varying vec3 vN; varying vec3 vW;',
          'void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;',
          '  gl_Position = projectionMatrix * viewMatrix * w; }'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;',
          'void main(){',
          '  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);',
          '  float edge = clamp(-dot(N, V) / 0.42, 0.0, 1.0);',
          '  float glow = pow(edge, 2.6);',
          '  float sunny = 0.18 + 0.82 * smoothstep(-0.35, 0.45, dot(N, sunDir));',
          '  gl_FragColor = vec4(vec3(0.30, 0.56, 1.0) * glow * sunny, 1.0);',
          '}'
        ].join('\n'),
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
      })
    );
    root.add(air);

    /* coverage paint: a see-through skin we draw on */
    var canvas = document.createElement('canvas');
    canvas.width = PAINT_W; canvas.height = PAINT_H;
    E.paintCtx = canvas.getContext('2d');
    E.paintTex = new THREE.CanvasTexture(canvas);
    E.paintMat = new THREE.MeshBasicMaterial({ map: E.paintTex, transparent: true, opacity: 0.42, depthWrite: false });
    E.paintMesh = new THREE.Mesh(new THREE.SphereGeometry(1.004, 72, 48), E.paintMat);
    E.paintMesh.renderOrder = 2;
    spin.add(E.paintMesh);
    E.paintDirty = false;

    /* the Sun, far away */
    var sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('255,244,214'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    }));
    sunSprite.position.copy(SUN).multiplyScalar(48);
    sunSprite.scale.setScalar(9);
    root.add(sunSprite);

    /* Earth's shadow, drawn as a ghostly tunnel */
    var L = 14;
    E.shadow = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, L, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7f8cff, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    for (var hoop = 1; hoop <= 6; hoop++) { // hoops give the tunnel a shape you can read
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.006, 6, 96),
        new THREE.MeshBasicMaterial({ color: 0x9aa6ff, transparent: true, opacity: 0.55 - hoop * 0.07, depthWrite: false }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = L / 2 - hoop * 1.1 - 0.2;
      E.shadow.add(ring);
    }
    E.shadow.quaternion.setFromUnitVectors(Y, SUN.clone().negate());
    E.shadow.position.copy(SUN).multiplyScalar(-L / 2);
    E.shadow.visible = false;
    root.add(E.shadow);

    /* orbit rings */
    E.rings = new THREE.Group();
    root.add(E.rings);

    /* the satellite marker, its view cone and its radio beam */
    E.sat = makeMarker();
    E.sat.visible = false;
    root.add(E.sat);
    var coneGeo = new THREE.ConeGeometry(1, 1, 56, 1, true);
    coneGeo.translate(0, -0.5, 0); // tip at the origin, opening toward −Y
    E.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
      color: 0x7fe6ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    E.cone.visible = false;
    root.add(E.cone);
    E.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x66ffb0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    E.beam.visible = false;
    root.add(E.beam);

    /* real fires seen by NASA's MODIS during the past week (see assets/nasa-fires.js) */
    var pts = RG.NASA_FIRES.recent.points, pos = new Float32Array((pts.length / 2) * 3);
    for (var k = 0; k < pts.length; k += 2) {
      var pv = P.latLonToVec(pts[k], pts[k + 1]);
      pos[(k / 2) * 3] = pv[0] * 1.005; pos[(k / 2) * 3 + 1] = pv[1] * 1.005; pos[(k / 2) * 3 + 2] = pv[2] * 1.005;
    }
    var recentGeo = new THREE.BufferGeometry();
    recentGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    E.recent = new THREE.Points(recentGeo, new THREE.PointsMaterial({
      color: 0xff7a2a, size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    E.recent.visible = false;
    spin.add(E.recent);

    E.stationGroup = new THREE.Group(); spin.add(E.stationGroup);
    E.fireGroup = new THREE.Group(); spin.add(E.fireGroup);
    E.zoneGroup = new THREE.Group(); spin.add(E.zoneGroup);
    E.fireTex = glowTexture('255,255,255');
    E.ringTex = ringTexture();
    E.fires = [];

    root.visible = false;
    Stage.scene.add(root);
  };

  function loadTexture(dataUrl) {
    var tex = new THREE.Texture();
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    var img = new Image();
    img.onload = function () { tex.image = img; tex.needsUpdate = true; };
    img.src = dataUrl;
    return tex;
  }

  function glowTexture(rgb) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(' + rgb + ',1)');
    grad.addColorStop(0.18, 'rgba(' + rgb + ',0.85)');
    grad.addColorStop(0.45, 'rgba(' + rgb + ',0.25)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); t.userData.shared = true;
    return t;
  }
  function ringTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 9;
    g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
    var t = new THREE.CanvasTexture(c); t.userData.shared = true;
    return t;
  }

  /** A tiny stand-in satellite for the Earth views (not to scale). */
  function makeMarker() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xd9a233, metalness: 0.7, roughness: 0.4, envMap: Stage.env, emissive: 0x3a2400 }));
    var wingMat = new THREE.MeshStandardMaterial({ color: 0x2a55c8, metalness: 0.5, roughness: 0.35, envMap: Stage.env, emissive: 0x0a1c55 });
    var w1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.7), wingMat); w1.position.x = 1.15;
    var w2 = w1.clone(); w2.position.x = -1.15;
    var eye = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 16),
      new THREE.MeshStandardMaterial({ color: 0x10151f, metalness: 0.6, roughness: 0.3 }));
    eye.position.y = 0.58;
    var shape = new THREE.Group();
    shape.add(body, w1, w2, eye);
    g.add(shape);
    g.userData.shape = shape;
    g.userData.simple = [body, w1, w2, eye];
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('255,236,190'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55
    }));
    halo.scale.setScalar(6);
    g.add(halo);
    g.userData.halo = halo;
    return g;
  }

  /** Use the player's own satellite as the marker (pass null for the simple stand-in). */
  E.setSatModel = function (model) {
    var shape = E.sat.userData.shape, simple = E.sat.userData.simple;
    shape.children.slice().forEach(function (c) {
      shape.remove(c);
      if (simple.indexOf(c) < 0) Stage.dispose(c);
    });
    if (model) { model.scale.setScalar(3.6); shape.add(model); }
    else simple.forEach(function (c) { shape.add(c); });
  };

  E.show = function (on) { E.group.visible = on; if (!on) E.sat.visible = E.cone.visible = E.beam.visible = false; };

  E.setTheta = function (theta) { E.spin.rotation.y = theta; };

  /* ---------- coverage paint ---------- */
  E.paintClear = function () {
    E.paintCtx.clearRect(0, 0, PAINT_W, PAINT_H);
    E.paintDirty = true;
  };

  /**
   * Fill every point within `lam` radians of (lat, lon). Works row by row on
   * the map, so the shape stays correct near the poles and across the date line.
   */
  E.paintCap = function (latDeg, lonDeg, lam, style) {
    var ctx = E.paintCtx;
    ctx.fillStyle = style || '#59e1ff';
    var f0 = latDeg * P.D2R, s0 = Math.sin(f0), c0 = Math.cos(f0), cl = Math.cos(lam);
    var y0 = Math.max(0, Math.floor(((90 - latDeg) / 180 - lam / Math.PI) * PAINT_H));
    var y1 = Math.min(PAINT_H - 1, Math.ceil(((90 - latDeg) / 180 + lam / Math.PI) * PAINT_H));
    var cx = ((lonDeg + 180) / 360) * PAINT_W;
    for (var y = y0; y <= y1; y++) {
      var f = (0.5 - (y + 0.5) / PAINT_H) * Math.PI;
      var q = (cl - Math.sin(f) * s0) / (Math.cos(f) * c0 + 1e-9);
      if (q >= 1) continue;
      if (q <= -1) { ctx.fillRect(0, y, PAINT_W, 1); continue; }
      var half = (Math.acos(q) / (2 * Math.PI)) * PAINT_W;
      var a = cx - half, b = cx + half;
      ctx.fillRect(a, y, b - a, 1);
      if (a < 0) ctx.fillRect(a + PAINT_W, y, -a, 1);
      if (b > PAINT_W) ctx.fillRect(0, y, b - PAINT_W, 1);
    }
    E.paintDirty = true;
  };

  /** Let old paint fade away a little (used while flying the mission). */
  E.paintFade = function (amount) {
    var ctx = E.paintCtx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,' + amount + ')';
    ctx.fillRect(0, 0, PAINT_W, PAINT_H);
    ctx.globalCompositeOperation = 'source-over';
    E.paintDirty = true;
  };

  E.flush = function () {
    if (E.paintDirty) { E.paintTex.needsUpdate = true; E.paintDirty = false; }
  };

  /* ---------- orbit rings ---------- */
  function basis(orbit) {
    var N = v3(P.orbitPos(orbit, 0)), M = v3(P.orbitPos(orbit, Math.PI / 2));
    return new THREE.Matrix4().makeBasis(N, M, new THREE.Vector3().crossVectors(N, M));
  }

  /**
   * Draw orbit rings. `keys` lists the orbits to show; `selected` is drawn bright.
   * With opts.shadow the selected ring is split into sunlit and shadowed parts.
   */
  E.setRings = function (keys, selected, opts) {
    opts = opts || {};
    while (E.rings.children.length) { var o = E.rings.children.pop(); Stage.dispose(o); }
    (keys || []).forEach(function (key) {
      var orbit = D.ORBITS[key], a = 1 + orbit.alt / P.RE, on = key === selected;
      var tube = a * (on ? 0.0048 : 0.0022);
      var m = basis(orbit);
      if (on && opts.shadow) {
        // find where the orbit dips into Earth's shadow
        var n = 720, start = -1, count = 0, i;
        var dark = [];
        for (i = 0; i < n; i++) dark.push(P.inShadow(P.orbitPos(orbit, (i / n) * 2 * Math.PI), orbit.alt));
        for (i = 0; i < n; i++) if (dark[i] && !dark[(i + n - 1) % n]) { start = i; break; }
        if (start >= 0) {
          while (count < n && dark[(start + count) % n]) count++;
          var u0 = (start / n) * 2 * Math.PI, span = (count / n) * 2 * Math.PI;
          addArc(m, a, tube * 1.3, u0, span, 0x8e7dff, 1);
          addArc(m, a, tube, u0 + span, 2 * Math.PI - span, 0xffd166, 1);
          return;
        }
      }
      addArc(m, a, tube, 0, 2 * Math.PI, on ? 0xffd166 : 0x9db4d6, on ? 1 : 0.45);
    });
  };
  function addArc(m, radius, tube, start, arc, color, opacity) {
    var geo = new THREE.TorusGeometry(radius, tube, 6, Math.max(24, Math.round(200 * arc / (2 * Math.PI))), arc);
    geo.rotateZ(start);
    geo.applyMatrix4(m);
    var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity, depthWrite: opacity >= 1 }));
    E.rings.add(mesh);
  }

  /* ---------- satellite marker ---------- */
  var satPos = new THREE.Vector3();
  E.satPosition = function () { return E.sat.visible ? satPos : null; };

  /**
   * Place the satellite. `unit` is its inertial unit vector, `alt` in km.
   * opts: {dark, off, lam (view half-angle, radians, or 0 to hide the cone)}
   */
  E.setSat = function (unit, alt, opts) {
    opts = opts || {};
    var a = 1 + alt / P.RE;
    satPos.set(unit[0] * a, unit[1] * a, unit[2] * a);
    var sat = E.sat;
    sat.visible = true;
    sat.position.copy(satPos);
    var down = satPos.clone().normalize().negate();
    sat.quaternion.setFromUnitVectors(Y, down);
    // keep the marker about the same size on screen however far the camera is
    var dist = Stage.camera.position.distanceTo(satPos);
    sat.scale.setScalar(Math.max(0.012, dist * 0.011));
    var halo = sat.userData.halo.material;
    halo.opacity = opts.off ? 0.12 : opts.dark ? 0.25 : 0.6;
    halo.color.set(opts.off ? 0xff5a4a : opts.dark ? 0x9fb4ff : 0xffffff);

    if (opts.lam) {
      E.cone.visible = true;
      E.cone.position.copy(satPos);
      E.cone.quaternion.setFromUnitVectors(Y, satPos.clone().normalize());
      E.cone.scale.set(Math.sin(opts.lam), a - Math.cos(opts.lam), Math.sin(opts.lam));
      E.cone.material.opacity = opts.off ? 0.04 : 0.2;
    } else {
      E.cone.visible = false;
    }
  };
  E.hideSat = function () { E.sat.visible = E.cone.visible = E.beam.visible = false; };

  /** Radio beam from the satellite to a ground point (Earth-fixed unit vector), or null to hide. */
  E.setBeam = function (groundVec, theta) {
    if (!groundVec || !E.sat.visible) { E.beam.visible = false; return; }
    var gi = P.toInertial(groundVec, theta);
    var g = new THREE.Vector3(gi[0], gi[1], gi[2]);
    var d = satPos.clone().sub(g), len = d.length();
    E.beam.visible = true;
    E.beam.position.copy(g).addScaledVector(d, 0.5);
    E.beam.quaternion.setFromUnitVectors(Y, d.normalize());
    var w = Math.max(0.0035, Stage.camera.position.distanceTo(g) * 0.0016);
    E.beam.scale.set(w, len, w);
  };

  /* ---------- flight paths drawn as flat ribbons ---------- */
  E.ribbons = {};
  /** Draw or update a ribbon through `pts` (flat x,y,z list, in Earth radii, inertial frame). */
  E.setRibbon = function (name, pts, width, color) {
    var n = pts.length / 3, rb = E.ribbons[name];
    if (!rb || rb.n !== n) {
      if (rb) { E.group.remove(rb.mesh); Stage.dispose(rb.mesh); }
      var geo = new THREE.BufferGeometry(), idx = [];
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
      for (var i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      geo.setIndex(idx);
      var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
      mesh.frustumCulled = false;
      E.group.add(mesh);
      rb = E.ribbons[name] = { mesh: mesh, n: n };
    }
    var pos = rb.mesh.geometry.attributes.position.array;
    for (var k = 0; k < n; k++) {
      var x = pts[k * 3], y = pts[k * 3 + 1], z = pts[k * 3 + 2], len = Math.sqrt(x * x + y * y + z * z) || 1, h = width / (2 * len);
      pos[k * 6] = x * (1 - h); pos[k * 6 + 1] = y * (1 - h); pos[k * 6 + 2] = z * (1 - h);
      pos[k * 6 + 3] = x * (1 + h); pos[k * 6 + 4] = y * (1 + h); pos[k * 6 + 5] = z * (1 + h);
    }
    rb.mesh.geometry.attributes.position.needsUpdate = true;
    rb.mesh.material.color.set(color);
    rb.mesh.visible = true;
  };
  E.clearRibbons = function () {
    Object.keys(E.ribbons).forEach(function (k) { E.group.remove(E.ribbons[k].mesh); Stage.dispose(E.ribbons[k].mesh); });
    E.ribbons = {};
  };

  /** A named marker on the ground (removed again by setStations(null)). */
  E.addPin = function (name, lat, lon) {
    var v = v3(P.latLonToVec(lat, lon), 1.012);
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc800 }));
    dot.position.copy(v);
    E.stationGroup.add(dot);
    Stage.addLabel(name, 'pin-station', { group: 'station', earth: true, at: function () { return dot.getWorldPosition(new THREE.Vector3()); } });
  };

  E.setShadow = function (on) { E.shadow.visible = on; };
  E.setRecent = function (on) { E.recent.visible = on; };

  /* ---------- ground stations ---------- */
  E.setStations = function (keys) {
    while (E.stationGroup.children.length) Stage.dispose(E.stationGroup.children.pop());
    Stage.clearLabels('station');
    (keys || []).forEach(function (k) {
      var s = D.STATIONS[k], v = v3(P.latLonToVec(s.lat, s.lon), 1.006);
      var dish = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.045, 12),
        new THREE.MeshBasicMaterial({ color: 0x7dffc0 }));
      dish.position.copy(v);
      dish.quaternion.setFromUnitVectors(Y, v.clone().normalize().negate()); // wide end up, like a dish
      dish.position.multiplyScalar(1.02);
      E.stationGroup.add(dish);
      Stage.addLabel(s.name, 'pin-station', {
        group: 'station', earth: true,
        at: function () { return dish.getWorldPosition(new THREE.Vector3()); }
      });
    });
  };

  /* ---------- fire zones (briefing and title) ---------- */
  E.setZones = function (on, withNames) {
    while (E.zoneGroup.children.length) Stage.dispose(E.zoneGroup.children.pop());
    Stage.clearLabels('zone');
    if (!on) return;
    D.FIRE_ZONES.forEach(function (z, i) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: E.fireTex, color: 0xff6a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
      }));
      sp.position.copy(v3(P.latLonToVec(z.lat, z.lon), 1.012));
      sp.userData.phase = i * 1.7;
      E.zoneGroup.add(sp);
      if (withNames) {
        var name = z.name.replace(/^the /, '');
        Stage.addLabel(name.charAt(0).toUpperCase() + name.slice(1), 'pin-zone', {
          group: 'zone', earth: true,
          at: function () { return sp.getWorldPosition(new THREE.Vector3()); }
        });
      }
    });
  };

  /* ---------- fires during the mission ---------- */
  var SIZE_SCALE = { small: 0.085, medium: 0.115, large: 0.15 };
  E.setFires = function (fires) {
    while (E.fireGroup.children.length) Stage.dispose(E.fireGroup.children.pop());
    E.fires = (fires || []).map(function (f) {
      var pos = v3(f.vec, 1.012);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: E.fireTex, color: 0xff5a1f, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
      }));
      var ring = new THREE.Sprite(new THREE.SpriteMaterial({
        map: E.ringTex, color: 0xffffff, depthWrite: false, transparent: true, opacity: 0
      }));
      glow.position.copy(pos); ring.position.copy(pos).multiplyScalar(1.003);
      glow.visible = ring.visible = false;
      E.fireGroup.add(glow, ring);
      return { fire: f, glow: glow, ring: ring, base: SIZE_SCALE[f.size], state: '', since: 0 };
    });
  };

  E.updateFires = function (time) {
    for (var i = 0; i < E.fires.length; i++) {
      var m = E.fires[i], f = m.fire, st = f.state;
      if (st !== m.state) { m.state = st; m.since = time; }
      var age = time - m.since;
      if (st === 'waiting') { m.glow.visible = m.ring.visible = false; continue; }
      m.glow.visible = true;
      var pulse = 1 + 0.22 * Math.sin(time * 7 + i);
      if (st === 'burning') {
        var grow = Math.min(1, age * 3);
        m.glow.material.color.set(0xff4a14);
        m.glow.scale.setScalar(m.base * 1.5 * pulse * grow);
        m.ring.visible = false;
      } else if (st === 'spotted') {
        m.glow.material.color.set(0xffd23d);
        m.glow.scale.setScalar(m.base * 1.4 * pulse);
        m.ring.visible = true;
        m.ring.material.color.set(0xffe27a);
        var r = (age * 1.4) % 1;
        m.ring.scale.setScalar(m.base * (0.8 + r * 1.6));
        m.ring.material.opacity = 1 - r;
      } else if (st === 'alerted') {
        m.glow.material.color.set(0x3dffa0);
        m.glow.scale.setScalar(m.base * (age < 0.5 ? 2.4 - age * 3 : 0.9));
        m.ring.visible = true;
        m.ring.material.color.set(0x63ffb4);
        m.ring.scale.setScalar(m.base * 0.8);
        m.ring.material.opacity = 0.95;
      } else { // missed
        m.glow.material.color.set(0x9a2a1a);
        m.glow.scale.setScalar(m.base * 1.7);
        m.ring.visible = false;
      }
    }
    // zone markers twinkle
    for (var j = 0; j < E.zoneGroup.children.length; j++) {
      var z = E.zoneGroup.children[j];
      z.scale.setScalar(0.085 * (1 + 0.3 * Math.sin(time * 3 + z.userData.phase)));
    }
  };

  RG.Earth = E;
})();
