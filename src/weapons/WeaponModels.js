import * as THREE from 'three';

/** Procedural first-person weapon models. Each returns {group, muzzle (Object3D), parts}. Units: metres, -z forward. */
const mats = {};
function M() {
  if (mats.ready) return mats;
  mats.gun = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.85 });
  mats.gunDark = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6, metalness: 0.7 });
  mats.wood = new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.7, metalness: 0.05 });
  mats.woodDark = new THREE.MeshStandardMaterial({ color: 0x2e1c12, roughness: 0.75 });
  mats.skin = new THREE.MeshStandardMaterial({ color: 0x8a6a58, roughness: 0.8 });
  mats.glove = new THREE.MeshStandardMaterial({ color: 0x1d1b1a, roughness: 0.9 });
  mats.sleeve = new THREE.MeshStandardMaterial({ color: 0x2b2f2a, roughness: 1 });
  mats.silver = new THREE.MeshStandardMaterial({ color: 0xc8ccd6, roughness: 0.25, metalness: 1, emissive: 0x1a2030 });
  mats.holy = new THREE.MeshStandardMaterial({ color: 0xe8d9a0, roughness: 0.3, metalness: 0.9, emissive: 0x6a5a20, emissiveIntensity: 0.6 });
  mats.holyGlow = new THREE.MeshBasicMaterial({ color: 0xbfe0ff });
  mats.blade = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.3, metalness: 1 });
  mats.red = new THREE.MeshStandardMaterial({ color: 0x8a1810, roughness: 0.6, metalness: 0.2 });
  mats.ready = true;
  return mats;
}

const B = (w, h, d, mat, x, y, z, parent) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};
const C = (r1, r2, len, mat, x, y, z, parent, seg = 10) => {
  const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); parent.add(m); return m;
};

function arm(parent, side, x, y, z, rotX = 0.15) {
  const m = M();
  const a = new THREE.Group();
  a.position.set(x, y, z);
  a.rotation.x = rotX;
  const fore = C(0.035, 0.045, 0.34, m.sleeve, 0, -0.02, 0.2, a, 8);
  const hand = B(0.07, 0.06, 0.1, m.glove, 0, 0, 0, a);
  parent.add(a);
  return a;
}

function flash() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mat);
    p.rotation.z = i * Math.PI / 3;
    g.add(p);
  }
  const side = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.28), mat);
  side.rotation.y = Math.PI / 2; side.position.z = -0.1; g.add(side);
  const side2 = side.clone(); side2.rotation.set(0, Math.PI / 2, Math.PI / 2); g.add(side2);
  g.visible = false;
  return g;
}

export function buildPistol() {
  const m = M();
  const g = new THREE.Group();
  const gun = new THREE.Group(); g.add(gun);
  B(0.045, 0.05, 0.22, m.gun, 0, 0.03, -0.06, gun);      // slide
  B(0.04, 0.035, 0.18, m.gunDark, 0, -0.005, -0.04, gun); // frame
  B(0.038, 0.11, 0.055, m.woodDark, 0, -0.07, 0.03, gun).rotation.x = -0.25; // grip
  B(0.01, 0.015, 0.01, m.gunDark, 0, 0.062, -0.16, gun);  // front sight
  B(0.03, 0.012, 0.01, m.gunDark, 0, 0.062, 0.04, gun);   // rear sight
  B(0.012, 0.03, 0.04, m.gunDark, 0, -0.035, -0.03, gun); // trigger guard
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, -0.19); gun.add(muzzle);
  const fl = flash(); muzzle.add(fl);
  const handR = arm(g, 1, 0.0, -0.06, 0.06, 0.3);
  const handL = arm(g, -1, -0.03, -0.075, 0.05, 0.35); handL.rotation.y = 0.35;
  return { group: g, gun, muzzle, flash: fl, slide: gun.children[0], hipPos: new THREE.Vector3(0.2, -0.2, -0.48), adsPos: new THREE.Vector3(0, -0.092, -0.36) };
}

export function buildShotgun() {
  const m = M();
  const g = new THREE.Group();
  const gun = new THREE.Group(); g.add(gun);
  C(0.022, 0.022, 0.75, m.gun, 0.0, 0.035, -0.38, gun);       // barrel
  C(0.02, 0.02, 0.6, m.gunDark, 0, 0.0, -0.32, gun);          // magazine tube
  const pump = C(0.032, 0.032, 0.18, m.woodDark, 0, 0.0, -0.4, gun); // pump
  B(0.06, 0.08, 0.26, m.gunDark, 0, 0.02, 0.0, gun);          // receiver
  const stock = B(0.05, 0.1, 0.32, m.wood, 0, -0.03, 0.26, gun); stock.rotation.x = 0.12;
  B(0.012, 0.012, 0.012, m.silver, 0, 0.062, -0.74, gun);     // bead sight
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.035, -0.77); gun.add(muzzle);
  const fl = flash(); fl.scale.setScalar(1.8); muzzle.add(fl);
  arm(g, 1, 0.0, -0.04, 0.12, 0.2);
  const handL = arm(g, -1, -0.01, -0.03, -0.4, 0.1); handL.rotation.y = 0.15;
  return { group: g, gun, muzzle, flash: fl, pump, pumpHand: handL, hipPos: new THREE.Vector3(0.16, -0.17, -0.32), adsPos: new THREE.Vector3(0, -0.098, -0.22) };
}

export function buildRifle() {
  const m = M();
  const g = new THREE.Group();
  const gun = new THREE.Group(); g.add(gun);
  B(0.055, 0.075, 0.4, m.gun, 0, 0.02, -0.08, gun);              // receiver
  C(0.016, 0.016, 0.42, m.gunDark, 0, 0.03, -0.48, gun);         // barrel
  B(0.06, 0.06, 0.25, m.gunDark, 0, 0.015, -0.35, gun);          // handguard
  const mag = B(0.035, 0.16, 0.07, m.gunDark, 0, -0.08, -0.12, gun); mag.rotation.x = 0.25; // curved-ish mag
  B(0.04, 0.09, 0.05, m.gunDark, 0, -0.06, 0.06, gun).rotation.x = -0.3; // grip
  B(0.05, 0.08, 0.26, m.gunDark, 0, 0.0, 0.24, gun);             // stock
  B(0.02, 0.04, 0.02, m.gunDark, 0, 0.075, -0.52, gun);          // front post
  B(0.035, 0.03, 0.05, m.gunDark, 0, 0.073, 0.05, gun);          // rear sight
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, -0.7); gun.add(muzzle);
  const fl = flash(); fl.scale.setScalar(1.3); muzzle.add(fl);
  arm(g, 1, 0.0, -0.06, 0.08, 0.3);
  const handL = arm(g, -1, -0.01, -0.03, -0.33, 0.1); handL.rotation.y = 0.15;
  return { group: g, gun, muzzle, flash: fl, mag, hipPos: new THREE.Vector3(0.15, -0.16, -0.32), adsPos: new THREE.Vector3(0, -0.11, -0.2) };
}

export function buildCrossbow() {
  const m = M();
  const g = new THREE.Group();
  const gun = new THREE.Group(); g.add(gun);
  B(0.05, 0.05, 0.6, m.woodDark, 0, 0, -0.15, gun);          // stock/tiller
  B(0.045, 0.1, 0.12, m.woodDark, 0, -0.05, 0.15, gun).rotation.x = -0.2;
  // limbs (bow)
  const limbs = new THREE.Group(); limbs.position.set(0, 0.02, -0.42); gun.add(limbs);
  for (const s of [-1, 1]) {
    const l = B(0.32, 0.025, 0.03, m.holy, s * 0.17, 0, 0.03, limbs);
    l.rotation.y = -s * 0.25;
  }
  // string
  const strMat = new THREE.LineBasicMaterial({ color: 0xdde6ff });
  const strGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.32, 0.02, -0.33), new THREE.Vector3(0, 0.02, -0.12), new THREE.Vector3(0.32, 0.02, -0.33)]);
  const string = new THREE.Line(strGeo, strMat); gun.add(string);
  // holy cross ornament
  B(0.012, 0.09, 0.012, m.holy, 0, 0.06, -0.2, gun); B(0.05, 0.012, 0.012, m.holy, 0, 0.08, -0.2, gun);
  // bolt (hidden when unloaded)
  const bolt = new THREE.Group(); gun.add(bolt);
  C(0.006, 0.006, 0.42, m.silver, 0, 0.04, -0.32, bolt, 6);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 6), m.holyGlow); tip.rotation.x = -Math.PI / 2; tip.position.set(0, 0.04, -0.55); bolt.add(tip);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.04, -0.58); gun.add(muzzle);
  const fl = flash(); fl.children.forEach((c) => { c.material = c.material.clone(); c.material.color.set(0x9fd0ff); }); muzzle.add(fl);
  arm(g, 1, 0.0, -0.08, 0.14, 0.25);
  const handL = arm(g, -1, -0.02, -0.04, -0.25, 0.1); handL.rotation.y = 0.2;
  return { group: g, gun, muzzle, flash: fl, bolt, hipPos: new THREE.Vector3(0.15, -0.16, -0.34), adsPos: new THREE.Vector3(0, -0.105, -0.26) };
}

export function buildAxe() {
  const m = M();
  const g = new THREE.Group();
  const gun = new THREE.Group(); g.add(gun);
  const handle = C(0.018, 0.022, 0.65, m.wood, 0, 0, -0.1, gun, 8);
  const head = new THREE.Group(); head.position.set(0, 0, -0.42); gun.add(head);
  B(0.03, 0.16, 0.07, m.red, 0, 0.0, 0, head);
  const bladeShape = new THREE.Shape(); bladeShape.moveTo(0, 0.07); bladeShape.lineTo(0.17, 0.12); bladeShape.quadraticCurveTo(0.21, 0, 0.17, -0.12); bladeShape.lineTo(0, -0.07); bladeShape.closePath();
  const bg = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1 });
  bg.translate(0, 0, -0.006);
  // shape X (outward) -> +Y, shape Y (width) -> Z, extrusion -> X (thickness)
  bg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
  const blade = new THREE.Mesh(bg, m.blade); blade.position.set(0, 0.06, 0);
  head.add(blade);
  // pick on the back
  const pick = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), m.red); pick.rotation.x = Math.PI; pick.position.set(0, -0.12, 0); head.add(pick);
  gun.rotation.set(0.12, 0.25, -0.15);
  const handR = arm(g, 1, 0.0, -0.01, 0.16, 0.0);
  const muzzle = new THREE.Object3D(); head.add(muzzle);
  return { group: g, gun, head, muzzle, flash: null, hipPos: new THREE.Vector3(0.24, -0.33, -0.42), adsPos: new THREE.Vector3(0.24, -0.33, -0.42) };
}
