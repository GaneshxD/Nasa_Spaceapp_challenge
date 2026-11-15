/* Orbit Ranger — the home screen's backdrop.
 * A painted nebula behind everything (navy above, violet and pink clouds toward the corners, the middle
 * left clear for the planet) and a loose ring of small asteroids drifting around the Earth in 3D.
 * Both are made in code: no image files. Shown on the home screen only.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE, Stage = RG.Stage;
  var T = { tex: null, group: null, on: false };

  function hash(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  function noise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) { var s = 0, a = 0.5; for (var i = 0; i < 5; i++) { s += a * noise(x, y); x = x * 2.03 + 11.3; y = y * 2.03 + 4.7; a *= 0.5; } return s / 0.96875; }
  function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /** Paint the sky. The clouds are worked out small and stretched (which keeps them soft); stars are drawn sharp on top. */
  function nebula() {
    var w = 400, h = 225, c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, i = 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++, i += 4) {
      var u = x / w, v = y / h;
      var n = fbm(u * 3.1 + 1.7, v * 2.3 + 0.3), m = fbm(u * 6.4 + 9.1, v * 5.2 + 4.2), k = fbm(u * 2.2 + 20.5, v * 1.7 + 7.3);
      var t1 = ss(0, 0.62, v), t2 = ss(0.5, 1.05, v);                      // navy at the top, indigo in the middle, violet low down
      var r = 5 + 13 * t1 + 50 * t2, gr = 8 + 20 * t1 + 12 * t2, b = 27 + 62 * t1 + 44 * t2;
      var side = Math.pow(Math.min(1, Math.abs(u - 0.5) * 2.15), 1.25);    // clouds gather at the sides and near the bottom
      var wgt = Math.min(1, side * 0.8 * (0.35 + 0.65 * ss(0.12, 0.6, v)) + ss(0.6, 1, v) * 0.5 + 0.04);
      var den = ss(0.43, 0.73, n) * wgt, warm = ss(0.34, 0.8, m * 0.5 + v * 0.8 - 0.1);
      r += (40 + 150 * warm) * den; gr += (70 + 14 * warm) * den; b += (170 - 6 * warm) * den;
      var wisp = ss(0.56, 0.86, m) * wgt * 0.55;
      r += (28 + 110 * warm) * wisp; gr += 46 * wisp; b += 92 * wisp;
      var dust = 1 - ss(0.5, 0.82, k) * 0.34 * (1 - v * 0.45);            // darker lanes drifting across
      r *= dust; gr *= dust; b *= dust;
      d[i] = r > 255 ? 255 : r; d[i + 1] = gr > 255 ? 255 : gr; d[i + 2] = b > 255 ? 255 : b; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    var big = document.createElement('canvas'); big.width = 1600; big.height = 900;
    var B = big.getContext('2d'), rnd = Stage.seeded(77), q;
    B.imageSmoothingEnabled = true; B.imageSmoothingQuality = 'high';
    B.drawImage(c, 0, 0, big.width, big.height);
    B.globalCompositeOperation = 'screen';
    [[0.03, 1.04, 0.46, '236,140,214', 0.42], [0.98, 1.0, 0.44, '222,128,220', 0.38], [0.5, 1.15, 0.4, '120,150,255', 0.24], [0.16, 0.6, 0.26, '70,110,235', 0.14], [0.86, 0.55, 0.26, '80,110,235', 0.13]].forEach(function (p) {
      q = B.createRadialGradient(p[0] * 1600, p[1] * 900, 0, p[0] * 1600, p[1] * 900, p[2] * 1600);
      q.addColorStop(0, 'rgba(' + p[3] + ',' + p[4] + ')'); q.addColorStop(1, 'rgba(' + p[3] + ',0)');
      B.fillStyle = q; B.fillRect(0, 0, 1600, 900);
    });
    for (var s = 0; s < 46; s++) {                                         // a few nearer stars, each with a soft halo
      var sx = rnd() * 1600, sy = rnd() * 900, big2 = rnd() < 0.2, rad = big2 ? 9 + rnd() * 9 : 3 + rnd() * 4;
      q = B.createRadialGradient(sx, sy, 0, sx, sy, rad);
      q.addColorStop(0, 'rgba(255,255,255,' + (big2 ? 0.95 : 0.8) + ')'); q.addColorStop(0.25, 'rgba(190,215,255,0.35)'); q.addColorStop(1, 'rgba(150,180,255,0)');
      B.fillStyle = q; B.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    }
    B.globalCompositeOperation = 'source-over';
    q = B.createLinearGradient(0, 0, 0, 900);                              // a little darker at the very top, behind the buttons
    q.addColorStop(0, 'rgba(4,6,20,0.5)'); q.addColorStop(0.28, 'rgba(4,6,20,0)');
    B.fillStyle = q; B.fillRect(0, 0, 1600, 900);
    var tex = new THREE.CanvasTexture(big);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  /** About a hundred small rocks in a tilted ring around the planet. */
  function asteroids() {
    var geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position, rnd = Stage.seeded(41), n = 150, i;
    for (i = 0; i < p.count; i++) { var k = 0.7 + rnd() * 0.6; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({ color: 0x474c66, roughness: 1, metalness: 0, flatShading: true });
    mat.envMapIntensity = 0.3; // dark rocks against the bright clouds, with only a little shine
    var mesh = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    for (i = 0; i < n; i++) {
      var a = rnd() * 6.283, dist = 1.75 + Math.pow(rnd(), 0.75) * 3, size = 0.007 + Math.pow(rnd(), 3) * 0.026;
      e.set(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3); q.setFromEuler(e);
      m4.compose(v.set(Math.cos(a) * dist, (rnd() - 0.5) * (0.5 + dist * 0.42), Math.sin(a) * dist), q, s.set(size, size, size));
      mesh.setMatrixAt(i, m4);
    }
    mesh.frustumCulled = false;
    var grp = new THREE.Group(); grp.add(mesh); grp.rotation.set(0.22, 0, 0.1); grp.visible = false;
    Stage.scene.add(grp);
    return grp;
  }

  /** Show or hide the backdrop. Off puts back the plain colour the other scenes paint. */
  T.show = function (on) {
    if (!Stage.scene) return;
    if (!Stage.bg) Stage.bg = Stage.scene.background; // the scene's own colour object
    if (on && !T.tex) { T.tex = nebula(); T.group = asteroids(); }
    T.on = on;
    if (T.group) T.group.visible = on;
    Stage.scene.background = on ? T.tex : Stage.bg;
  };
  /** The picture is 16:9. On other screens show a 16:9-shaped piece of it rather than stretching it. */
  var fitted = 0;
  function fit() {
    var ar = Stage.camera.aspect, pic = 16 / 9;
    if (ar === fitted) return;
    fitted = ar;
    if (ar < pic) { T.tex.repeat.set(ar / pic, 1); T.tex.offset.set(Math.max(0, 0.3 - ar / pic / 2), 0); } // tall screens: a strip left of centre, where the clouds are
    else { T.tex.repeat.set(1, pic / ar); T.tex.offset.set(0, 0); }                                            // very wide screens: keep the bottom, trim the top
    T.tex.updateMatrix();
  }
  Stage.onFrame(function (dt) {
    if (!T.on || !T.tex) return;
    fit();
    if (!Stage.reducedMotion) T.group.rotation.y += dt * 0.012;
  });

  RG.TitleScene = T;
})();
