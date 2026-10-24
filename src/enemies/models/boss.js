import * as THREE from 'three';
import { furTexture, furCardTexture, skinTexture, cached, sculptSphere, smooth } from '../Sculpt.js';
import { glowTexture } from './common.js';

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 18, 14),
  sphereLow: new THREE.SphereGeometry(0.5, 8, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
};
function mesh(g, mat, parent, { s = [1, 1, 1], p = [0, 0, 0], r = [0, 0, 0] } = {}) {
  const m = new THREE.Mesh(g, mat);
  m.scale.set(...s); m.position.set(...p); m.rotation.set(...r);
  m.castShadow = Math.max(...s) > 0.14; m.receiveShadow = false;
  parent.add(m);
  return m;
}
function group(parent, p = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...p); parent.add(g); return g; }
function addEyes(head, color, spread, y, z, size) {
  const mat = new THREE.MeshBasicMaterial({ color, fog: false });
  const eyes = [];
  for (const s of [-1, 1]) { const e = mesh(geo.sphereLow, mat, head, { s: [size, size * 0.7, size * 0.6], p: [s * spread, y, z] }); e.castShadow = false; eyes.push(e); }
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false });
  for (const s of [-1, 1]) { const sp = new THREE.Sprite(glowMat); sp.scale.setScalar(size * 5); sp.position.set(s * spread, y, z + 0.01); head.add(sp); eyes.push(sp); }
  return eyes;
}
function card(parent, mat, p, r, s) {
  const g = cached('bossCard', () => { const pg = new THREE.PlaneGeometry(0.5, 0.8); pg.translate(0, -0.38, 0); return pg; });
  const m = new THREE.Mesh(g, mat); m.position.set(...p); m.rotation.set(...r); m.scale.setScalar(s); parent.add(m); return m;
}

// ------------------------------------------------------------------ BOSS: THE NIGHTFATHER
export function buildBoss() {
  const hide = new THREE.MeshStandardMaterial({ map: furTexture('#1c1618', '#4a3a36'), roughness: 1 });
  const bone = new THREE.MeshStandardMaterial({ map: skinTexture('#cfc4ac', 'rgba(90,60,40,0.35)', false), roughness: 0.6 });
  const cardMat = new THREE.MeshStandardMaterial({ map: furCardTexture('#241c1c'), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1 });
  const core = new THREE.MeshBasicMaterial({ color: 0xff2a10, fog: false });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0a0c, roughness: 1 });
  const root = new THREE.Group();
  const P = {};
  P.hips = group(root, [0, 2.3, 0]);
  P.torso = group(P.hips, [0, 0, 0]);
  P.torso.rotation.x = 0.35;
  const body = mesh(geo.sphere, hide, P.torso, { s: [1.3, 1.6, 0.9], p: [0, 1.0, 0] });
  // exposed ribcage
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) mesh(geo.cyl, bone, P.torso, { s: [0.06, 0.7, 0.06], p: [s * 0.32, 0.55 + i * 0.17, 0.38], r: [0, 0, s * 1.2] });
  const heart = mesh(geo.sphere, core, P.torso, { s: [0.32, 0.38, 0.3], p: [0, 1.0, 0.3] });
  P.core = heart;
  for (let i = 0; i < 8; i++) mesh(geo.cone, bone, P.torso, { s: [0.14, 0.6, 0.14], p: [0, 0.6 + i * 0.2, -0.38], r: [-1.2, 0, 0] });
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; card(P.torso, cardMat, [Math.sin(a) * 0.9, 1.75, Math.cos(a) * 0.6], [0.5 * Math.cos(a) - 0.3, a, 0], 1.1 + Math.random() * 0.5); }
  for (let i = 0; i < 8; i++) card(P.torso, cardMat, [(Math.random() - 0.5) * 0.4, 0.4 + i * 0.18, -0.75], [-0.8, Math.PI, 0], 1);
  P.neck = group(P.torso, [0, 1.75, 0.2]);
  P.neck.rotation.x = -0.4;
  P.head = group(P.neck, [0, 0.3, 0.1]);
  // elongated animal skull: brain case tapering into a long bony snout with deep sockets
  const skullG = cached('bossSkull', () => sculptSphere(32, 24, (v) => {
    let x = v.x * 2, y = v.y * 2, z = v.z * 2;
    const t = smooth(-0.2, 1, z);
    x *= 1 - 0.55 * t; y *= 1 - 0.45 * t;
    z *= 1.0 + 0.9 * Math.max(0, z);
    for (const sx of [-0.42, 0.42]) { const d = Math.hypot(x - sx, y - 0.2, z - 0.55); if (d < 0.35) { const k = 1 - d / 0.35; x *= 1 - 0.1 * k; z -= 0.25 * k * k; } }
    v.set(x / 2, y / 2, z / 2);
  }));
  const head = mesh(skullG, bone, P.head, { s: [0.6, 0.55, 0.65], p: [0, 0, 0.12] });
  for (const s of [-1, 1]) mesh(geo.sphereLow, dark, P.head, { s: [0.16, 0.14, 0.1], p: [s * 0.15, 0.06, 0.42] });
  P.jaw = group(P.head, [0, -0.25, 0.25]);
  const jawG = cached('bossJaw', () => sculptSphere(20, 12, (v) => { const t = smooth(-0.5, 0.5, v.z); v.x *= 1 - 0.5 * t; v.y *= 0.35; }));
  mesh(jawG, bone, P.jaw, { s: [0.32, 0.25, 0.6], p: [0, -0.03, 0.22] });
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) mesh(geo.cone, bone, P.jaw, { s: [0.04, 0.14, 0.04], p: [s * 0.11, 0.06, 0.05 + i * 0.08] });
  // antlers
  const antler = (side) => {
    const a = group(P.head, [side * 0.22, 0.3, 0]);
    a.rotation.z = side * -0.5;
    mesh(geo.cyl, bone, a, { s: [0.07, 1.2, 0.07], p: [0, 0.6, 0] });
    for (let i = 0; i < 4; i++) {
      const b = group(a, [0, 0.35 + i * 0.25, 0]);
      b.rotation.set(-0.5 + i * 0.2, 0, side * (0.8 - i * 0.1));
      mesh(geo.cyl, bone, b, { s: [0.045, 0.6 - i * 0.08, 0.045], p: [0, 0.28, 0] });
    }
  };
  antler(-1); antler(1);
  const eyes = addEyes(P.head, 0xff2010, 0.15, 0.06, 0.47, 0.06);
  const armSet = (side) => {
    const sh = group(P.torso, [side * 1.05, 1.5, 0.1]);
    mesh(geo.capsule, hide, sh, { s: [0.32, 0.7, 0.32], p: [0, -0.55, 0] });
    const el = group(sh, [0, -1.2, 0]);
    mesh(geo.capsule, hide, el, { s: [0.26, 0.7, 0.26], p: [0, -0.5, 0] });
    for (let i = 0; i < 4; i++) mesh(geo.cone, bone, el, { s: [0.06, 0.6, 0.06], p: [-0.14 + i * 0.09, -1.3, 0.12], r: [Math.PI + 0.4, 0, 0] });
    sh.rotation.x = -0.3;
    return [sh, el];
  };
  [P.shoulderL, P.elbowL] = armSet(-1);
  [P.shoulderR, P.elbowR] = armSet(1);
  const legSet = (side) => {
    const leg = group(P.hips, [side * 0.55, 0, 0]);
    mesh(geo.capsule, hide, leg, { s: [0.38, 0.55, 0.38], p: [0, -0.5, 0.1], r: [-0.3, 0, 0] });
    const kn = group(leg, [0, -1.1, 0.3]);
    mesh(geo.capsule, dark, kn, { s: [0.26, 0.5, 0.26], p: [0, -0.5, -0.15], r: [0.4, 0, 0] });
    for (const sd of [-1, 1]) mesh(geo.cone, dark, kn, { s: [0.2, 0.32, 0.36], p: [sd * 0.1, -1.08, 0.08], r: [0.35, 0, 0] }); // cloven hooves
    return [leg, kn];
  };
  [P.legL, P.kneeL] = legSet(-1);
  [P.legR, P.kneeR] = legSet(1);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2010, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.scale.set(3, 3, 1); aura.position.set(0, 1.0, 0.4); P.torso.add(aura);
  P.aura = aura;
  return { root, parts: P, eyes, mats: [hide, bone, dark], headMesh: head, bodyMesh: body, heightScale: 1 };
}
