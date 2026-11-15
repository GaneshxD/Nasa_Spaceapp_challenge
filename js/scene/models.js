/* Orbit Ranger — real NASA 3D models.
 * Every model comes from NASA 3D Resources (science.nasa.gov/3d-resources),
 * made small for phones by tools/nasa3d/ (fewer triangles, WebP textures,
 * meshopt compression). The list of what exists is RG.NASA3D
 * (assets/nasa3d/catalog.js).
 *
 * Each model is one small script file, assets/nasa3d/<id>.js, that hands its
 * bytes to RG.Models.define(). A script tag is used instead of fetch() so the
 * game still runs from a double-click on index.html, where fetch is refused.
 * Models load only when something asks for them.
 */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE;
  var Md = { ready: {}, waiting: {}, kept: {} };
  var loader = null;

  function bytes(b64) {
    var bin = atob(b64), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function gltf() {
    if (!loader) { loader = new THREE.GLTFLoader(); loader.setMeshoptDecoder(THREE.MeshoptDecoder); }
    return loader;
  }

  /** Called by the model files themselves. */
  Md.define = function (id, data) {
    var w = Md.waiting[id];
    if (!w) return;
    delete Md.waiting[id];
    var info = Md.info(id);
    if (info && info.kind === 'globe') {
      var img = new Image();
      img.onload = function () {
        var tex = new THREE.Texture(img);
        tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; tex.needsUpdate = true;
        var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }));
        var g = new THREE.Group(); g.add(mesh);
        w.done(g);
      };
      img.onerror = function () { w.fail(new Error('picture')); };
      img.src = data;
      return;
    }
    gltf().parse(bytes(data), '', function (res) { w.done(res.scene); }, function (err) { w.fail(err); });
  };

  /** Centre a model on the origin and scale it so its longest side is 1. */
  function normalise(scene) {
    var box = new THREE.Box3().setFromObject(scene), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    var k = 1 / Math.max(s.x, s.y, s.z, 1e-9);
    var wrap = new THREE.Group();
    scene.position.sub(c);
    wrap.add(scene);
    wrap.scale.setScalar(k);
    var out = new THREE.Group();
    out.add(wrap);
    out.userData.size = s.multiplyScalar(k); // its box, after scaling: longest side is 1
    return out;
  }

  /**
   * Load a model by its catalog id. Calls back with a THREE.Group whose longest
   * side is 1 unit, centred on the origin (group.userData.size is its box).
   * opts.keep: remember it, so the next call is instant (models used in play).
   */
  Md.load = function (id, cb, opts) {
    opts = opts || {};
    if (Md.kept[id]) { cb(Md.kept[id].clone(true)); return; }
    if (Md.waiting[id]) { Md.waiting[id].cbs.push([cb, opts]); return; }
    var w = Md.waiting[id] = { cbs: [[cb, opts]] };
    function finish(model) {
      w.cbs.forEach(function (c) {
        if (model && c[1].keep) {
          if (!Md.kept[id]) {
            Md.kept[id] = model;
            model.traverse(function (o) { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.userData.shared = true; if (m.map) m.map.userData.shared = true; }); });
          }
          c[0](Md.kept[id].clone(true));
        } else c[0](model);
      });
    }
    w.done = function (scene) {
      scene.traverse(function (o) {
        if (!o.isMesh) return;
        // The files carry no normals (to keep them small). Work them out here: faces that meet at
        // less than about 40 degrees are shaded as one smooth surface, sharper edges stay crisp.
        if (!o.geometry.attributes.normal && THREE.toCreasedNormals) {
          var old = o.geometry;
          o.geometry = THREE.toCreasedNormals(old, 0.7);
          old.dispose();
        }
        var ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(function (m) {
          if (m.flatShading) { m.flatShading = false; m.needsUpdate = true; }
          if (m.transparent) m.depthWrite = false;
          if (m.map) m.map.anisotropy = 4;
        });
      });
      finish(normalise(scene));
    };
    w.fail = function () { delete Md.waiting[id]; finish(null); };
    var s = document.createElement('script');
    s.src = 'assets/nasa3d/' + id + '.js';
    s.async = true;
    s.onerror = function () { s.remove(); w.fail(); };
    s.onload = function () { s.remove(); };
    document.head.appendChild(s);
  };

  /** Free a model that was loaded without `keep`. */
  Md.dispose = function (model) {
    if (!model) return;
    model.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (m.userData.shared) return;
        if (m.map) m.map.dispose();
        m.dispose();
      });
    });
  };

  var byId = null;
  /** One catalog entry as an object: { id, name, cat, blurb, kb, tris, trisNasa, kind, folder, group }. */
  Md.info = function (id) {
    if (!byId) { byId = {}; Md.all().forEach(function (m) { byId[m.id] = m; }); }
    return byId[id] || null;
  };
  var list = null;
  Md.all = function () {
    if (list) return list;
    var raw = (RG.NASA3D && RG.NASA3D.items) || [];
    list = raw.map(function (r) {
      return { id: r[0], name: r[1], cat: r[2], blurb: r[3], kb: r[4], tris: r[5], trisNasa: r[6], kind: r[7], folder: r[8], group: r[9] };
    });
    return list;
  };
  Md.thumb = function (id) { return 'assets/nasa3d/thumbs/' + id + '.webp'; };
  /** Where NASA keeps the original files. */
  Md.source = function (m) {
    return 'https://github.com/nasa/NASA-3D-Resources/tree/master/' + encodeURIComponent(m.group) + '/' + encodeURIComponent(m.folder);
  };

  RG.Models = Md;
})();
