/* Orbit Ranger — the showroom: one NASA model on a turntable (the hangar's 3D view). */
(function () {
  'use strict';
  var RG = window.RG, THREE = window.THREE, Stage = RG.Stage;
  var S = { group: null, model: null, globe: false };
  var holder, key;

  S.build = function () {
    if (S.group) return;
    var g = S.group = new THREE.Group(); g.visible = false; Stage.scene.add(g);
    var floor = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.45, 0.12, 64), new THREE.MeshStandardMaterial({ color: 0x141d33, roughness: 0.45, metalness: 0.5 }));
    floor.position.y = -0.06; floor.receiveShadow = true; g.add(floor);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(2.34, 0.018, 8, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc800 }));
    rim.position.y = 0.01; g.add(rim);
    key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(3.5, 6, 4.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    var c = key.shadow.camera; c.left = -3; c.right = 3; c.top = 3; c.bottom = -3; c.near = 1; c.far = 20; key.shadow.bias = -0.0005;
    g.add(key); Stage.shadowLights.push(key);
    g.add(new THREE.DirectionalLight(0x9db8ff, 0.5).translateX(-4).translateY(2).translateZ(-3));
    holder = new THREE.Group(); g.add(holder);
  };
  S.show = function (on) { if (!S.group) { if (!on) return; S.build(); } S.group.visible = on; if (!on) S.clear(); };
  S.clear = function () {
    if (S.model) { holder.remove(S.model); RG.Models.dispose(S.model); S.model = null; }
  };
  /** Stand a loaded model on the turntable. */
  S.set = function (model, info) {
    S.build(); S.clear();
    S.model = model; S.globe = info.kind === 'globe';
    var size = model.userData.size || new THREE.Vector3(1, 1, 1), k = S.globe ? 1.8 : 2.5 / Math.max(size.x, size.z, size.y * 0.85, 0.2);
    k = Math.min(k, 2.6 / Math.max(size.y, 0.05));
    model.scale.setScalar(k);
    model.position.y = S.globe ? 1.15 : size.y * k / 2 + 0.02;
    model.rotation.set(0, 0, S.globe ? 0.3 : 0);
    model.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = !S.globe; } });
    holder.rotation.y = 0;
    holder.add(model);
    S.height = S.globe ? 2.1 : size.y * k;
  };
  Stage.onFrame(function (dt) {
    if (S.group && S.group.visible && S.model && S.globe && !Stage.reducedMotion) S.model.children[0].rotation.y += dt * 0.25;
  });
  RG.Showroom = S;
})();
