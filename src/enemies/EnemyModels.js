import * as THREE from 'three';

/**
 * Procedurally assembled, animatable 3D creatures. Every model returns:
 *  { root, parts: {hips, torso, head, jaw, shoulderL, shoulderR, elbowL, elbowR, legL, legR, kneeL, kneeR, cape, tail},
 *    eyes: [meshes], mats: [materials for hit-flash / fading], headMesh, bodyMesh }
 * Models face +Z. Root origin = feet.
 */
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 14, 12),
  sphereLow: new THREE.SphereGeometry(0.5, 8, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  coneOpen: new THREE.ConeGeometry(0.5, 1, 12, 1, true),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 8),
};

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

function mesh(g, mat, parent, { s = [1, 1, 1], p = [0, 0, 0], r = [0, 0, 0] } = {}) {
  const m = new THREE.Mesh(g, mat);
  m.scale.set(...s); m.position.set(...p); m.rotation.set(...r);
  m.castShadow = Math.max(...s) > 0.14; m.receiveShadow = false;
  parent.add(m);
  return m;
}
function group(parent, p = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...p); parent.add(g); return g; }

function eyeMat(color) { return new THREE.MeshBasicMaterial({ color, fog: false }); }
function addEyes(head, color, spread, y, z, size) {
  const mat = eyeMat(color);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = mesh(geo.sphereLow, mat, head, { s: [size, size * 0.7, size * 0.6], p: [s * spread, y, z] });
    e.castShadow = false;
    eyes.push(e);
  }
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false });
  for (const s of [-1, 1]) {
    const sp = new THREE.Sprite(glowMat); sp.scale.setScalar(size * 5); sp.position.set(s * spread, y, z + 0.01); head.add(sp); eyes.push(sp);
  }
  return eyes;
}

// ------------------------------------------------------------------ VAMPIRE
export function buildVampire(opts = {}) {
  const ancient = !!opts.ancient;
  const skin = new THREE.MeshStandardMaterial({ color: ancient ? 0xc9c1c8 : 0xd6d3cc, roughness: 0.55, emissive: 0x101418 });
  const coat = new THREE.MeshStandardMaterial({ color: ancient ? 0x1a0508 : 0x0e0d12, roughness: 0.75 });
  const shirt = new THREE.MeshStandardMaterial({ color: ancient ? 0x5a0a10 : 0x2a0a0e, roughness: 0.6 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4 });
  const capeM = new THREE.MeshStandardMaterial({ color: ancient ? 0x6a0812 : 0x14080c, roughness: 0.8, side: THREE.DoubleSide });
  const bone = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.4 });
  const root = new THREE.Group();
  const P = {};
  P.hips = group(root, [0, 0.98, 0]);
  P.torso = group(P.hips, [0, 0, 0]);
  const body = mesh(geo.box, coat, P.torso, { s: [0.44, 0.62, 0.25], p: [0, 0.32, 0] });
  mesh(geo.box, shirt, P.torso, { s: [0.2, 0.5, 0.05], p: [0, 0.36, 0.115] });
  mesh(geo.box, coat, P.torso, { s: [0.5, 0.12, 0.28], p: [0, 0.6, 0] }); // shoulders
  // high collar
  for (const s of [-1, 1]) mesh(geo.box, ancient ? shirt : coat, P.torso, { s: [0.04, 0.32, 0.22], p: [s * 0.16, 0.78, -0.02], r: [0.2, 0, s * 0.35] });
  P.neck = group(P.torso, [0, 0.66, 0]);
  P.head = group(P.neck, [0, 0.12, 0.02]);
  const head = mesh(geo.sphere, skin, P.head, { s: [0.2, 0.26, 0.22], p: [0, 0.08, 0] });
  mesh(geo.sphere, hair, P.head, { s: [0.215, 0.18, 0.23], p: [0, 0.15, -0.02] });
  mesh(geo.box, hair, P.head, { s: [0.06, 0.1, 0.05], p: [0, 0.2, 0.1], r: [0.6, 0, 0] }); // widow's peak
  // gaunt cheeks, nose, mouth w/ fangs
  mesh(geo.box, skin, P.head, { s: [0.03, 0.06, 0.05], p: [0, 0.07, 0.12] });
  P.jaw = group(P.head, [0, -0.01, 0.06]);
  mesh(geo.box, new THREE.MeshBasicMaterial({ color: 0x1a0004 }), P.jaw, { s: [0.09, 0.025, 0.04], p: [0, 0, 0.05] });
  for (const s of [-1, 1]) mesh(geo.cone, bone, P.jaw, { s: [0.012, 0.045, 0.012], p: [s * 0.03, -0.012, 0.065], r: [Math.PI, 0, 0] });
  if (ancient) for (const s of [-1, 1]) mesh(geo.cone, bone, P.head, { s: [0.035, 0.18, 0.035], p: [s * 0.1, 0.28, -0.02], r: [-0.4, 0, s * -0.4] });
  const eyes = addEyes(P.head, ancient ? 0xff1010 : 0xff2a1a, 0.065, 0.1, 0.17, 0.035);
  // arms
  const armSet = (side) => {
    const sh = group(P.torso, [side * 0.27, 0.58, 0]);
    mesh(geo.capsule, coat, sh, { s: [0.09, 0.16, 0.09], p: [0, -0.16, 0] });
    const el = group(sh, [0, -0.33, 0]);
    mesh(geo.capsule, coat, el, { s: [0.08, 0.15, 0.08], p: [0, -0.14, 0] });
    const hand = mesh(geo.box, skin, el, { s: [0.08, 0.1, 0.05], p: [0, -0.32, 0.01] });
    for (let i = 0; i < 4; i++) mesh(geo.cone, bone, el, { s: [0.012, 0.13, 0.012], p: [-0.03 + i * 0.02, -0.42, 0.02], r: [Math.PI + 0.2, 0, 0] });
    return [sh, el];
  };
  [P.shoulderL, P.elbowL] = armSet(-1);
  [P.shoulderR, P.elbowR] = armSet(1);
  // coat tails / legs
  const legSet = (side) => {
    const leg = group(P.hips, [side * 0.11, 0, 0]);
    mesh(geo.capsule, coat, leg, { s: [0.11, 0.24, 0.11], p: [0, -0.22, 0] });
    const kn = group(leg, [0, -0.47, 0]);
    mesh(geo.capsule, hair, kn, { s: [0.09, 0.24, 0.09], p: [0, -0.22, 0] });
    mesh(geo.box, hair, kn, { s: [0.1, 0.06, 0.22], p: [0, -0.48, 0.05] });
    return [leg, kn];
  };
  [P.legL, P.kneeL] = legSet(-1);
  [P.legR, P.kneeR] = legSet(1);
  // long coat skirt
  mesh(geo.coneOpen, coat, P.hips, { s: [0.62, 0.7, 0.45], p: [0, -0.26, -0.02], r: [0, 0, 0] }).material.side = THREE.DoubleSide;
  // cape
  P.cape = group(P.torso, [0, 0.62, -0.14]);
  const capeGeo = new THREE.PlaneGeometry(0.8, 1.45, 4, 6); capeGeo.translate(0, -0.72, 0);
  mesh(capeGeo, capeM, P.cape, { r: [0.12, 0, 0] });
  const scale = ancient ? 1.2 : 1.0;
  root.scale.setScalar(scale);
  return { root, parts: P, eyes, mats: [skin, coat, shirt, capeM], headMesh: head, bodyMesh: body, heightScale: scale };
}

// ------------------------------------------------------------------ WEREWOLF
export function buildWerewolf(opts = {}) {
  const alpha = !!opts.alpha;
  const fur = new THREE.MeshStandardMaterial({ color: alpha ? 0x9a9a9e : 0x3b3129, roughness: 1, flatShading: true });
  const furDark = new THREE.MeshStandardMaterial({ color: alpha ? 0x5e5e64 : 0x241d18, roughness: 1, flatShading: true });
  const skin = new THREE.MeshStandardMaterial({ color: 0x2a1e1c, roughness: 0.8 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xd9d0b8, roughness: 0.5 });
  const mouth = new THREE.MeshBasicMaterial({ color: 0x300606 });
  const root = new THREE.Group();
  const P = {};
  P.hips = group(root, [0, 1.12, 0]);
  P.torso = group(P.hips, [0, 0, 0]);
  P.torso.rotation.x = 0.45; // hunch
  mesh(geo.sphere, fur, P.torso, { s: [0.62, 0.55, 0.48], p: [0, 0.18, 0] });
  const body = mesh(geo.sphere, fur, P.torso, { s: [0.85, 0.72, 0.62], p: [0, 0.62, 0.04] });
  mesh(geo.sphere, furDark, P.torso, { s: [0.55, 0.4, 0.3], p: [0, 0.6, 0.22] }); // chest
  // spiky fur along spine & shoulders
  for (let i = 0; i < 7; i++) mesh(geo.cone, furDark, P.torso, { s: [0.12, 0.3, 0.12], p: [(Math.random() - 0.5) * 0.2, 0.35 + i * 0.1, -0.28], r: [-1.0 - Math.random() * 0.3, 0, (Math.random() - 0.5) * 0.4] });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) mesh(geo.cone, fur, P.torso, { s: [0.1, 0.24, 0.1], p: [s * (0.38 + i * 0.03), 0.85, -0.1 + i * 0.06], r: [-0.5, 0, s * -1.1] });
  P.neck = group(P.torso, [0, 0.95, 0.12]);
  P.neck.rotation.x = -0.35;
  P.head = group(P.neck, [0, 0.12, 0.08]);
  const head = mesh(geo.sphere, fur, P.head, { s: [0.38, 0.34, 0.4], p: [0, 0.04, 0] });
  mesh(geo.box, fur, P.head, { s: [0.2, 0.16, 0.32], p: [0, -0.03, 0.27] }); // snout
  mesh(geo.sphereLow, skin, P.head, { s: [0.09, 0.07, 0.07], p: [0, 0.02, 0.43] });  // nose
  for (const s of [-1, 1]) mesh(geo.cone, fur, P.head, { s: [0.09, 0.22, 0.06], p: [s * 0.13, 0.25, -0.05], r: [-0.2, 0, s * -0.25] });
  mesh(geo.box, furDark, P.head, { s: [0.32, 0.06, 0.12], p: [0, 0.13, 0.12], r: [0.3, 0, 0] }); // brow
  P.jaw = group(P.head, [0, -0.1, 0.12]);
  mesh(geo.box, fur, P.jaw, { s: [0.17, 0.06, 0.3], p: [0, -0.02, 0.13] });
  mesh(geo.box, mouth, P.jaw, { s: [0.14, 0.02, 0.26], p: [0, 0.015, 0.13] });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    mesh(geo.cone, bone, P.jaw, { s: [0.02, 0.06, 0.02], p: [s * 0.06, 0.04, 0.05 + i * 0.07] });
    mesh(geo.cone, bone, P.head, { s: [0.02, 0.06, 0.02], p: [s * 0.07, -0.12, 0.17 + i * 0.07], r: [Math.PI, 0, 0] });
  }
  const eyes = addEyes(P.head, alpha ? 0xff2020 : 0xffc21a, 0.1, 0.09, 0.2, 0.04);
  const armSet = (side) => {
    const sh = group(P.torso, [side * 0.46, 0.8, 0.06]);
    mesh(geo.capsule, fur, sh, { s: [0.2, 0.32, 0.2], p: [0, -0.26, 0] });
    const el = group(sh, [0, -0.56, 0]);
    mesh(geo.capsule, fur, el, { s: [0.16, 0.3, 0.16], p: [0, -0.24, 0] });
    mesh(geo.box, skin, el, { s: [0.17, 0.15, 0.12], p: [0, -0.52, 0.02] });
    for (let i = 0; i < 4; i++) mesh(geo.cone, bone, el, { s: [0.025, 0.22, 0.025], p: [-0.06 + i * 0.04, -0.66, 0.06], r: [Math.PI + 0.4, 0, 0] });
    sh.rotation.x = -0.35;
    return [sh, el];
  };
  [P.shoulderL, P.elbowL] = armSet(-1);
  [P.shoulderR, P.elbowR] = armSet(1);
  // digitigrade legs
  const legSet = (side) => {
    const leg = group(P.hips, [side * 0.22, 0, 0]);
    mesh(geo.capsule, fur, leg, { s: [0.2, 0.26, 0.2], p: [0, -0.22, 0.06], r: [-0.4, 0, 0] });
    const kn = group(leg, [0, -0.48, 0.18]);
    mesh(geo.capsule, furDark, kn, { s: [0.13, 0.26, 0.13], p: [0, -0.24, -0.08], r: [0.5, 0, 0] });
    mesh(geo.box, skin, kn, { s: [0.16, 0.08, 0.28], p: [0, -0.58, 0.02] });
    for (let i = 0; i < 3; i++) mesh(geo.cone, bone, kn, { s: [0.02, 0.1, 0.02], p: [-0.05 + i * 0.05, -0.6, 0.18], r: [Math.PI / 2, 0, 0] });
    return [leg, kn];
  };
  [P.legL, P.kneeL] = legSet(-1);
  [P.legR, P.kneeR] = legSet(1);
  P.tail = group(P.hips, [0, 0.05, -0.32]);
  mesh(geo.cone, fur, P.tail, { s: [0.14, 0.7, 0.14], p: [0, -0.3, -0.12], r: [-2.4, 0, 0] });
  const scale = alpha ? 1.38 : 1.0;
  root.scale.setScalar(scale);
  return { root, parts: P, eyes, mats: [fur, furDark, skin], headMesh: head, bodyMesh: body, heightScale: scale };
}

// ------------------------------------------------------------------ GHOST
export function buildGhost(opts = {}) {
  const revenant = !!opts.revenant;
  const color = revenant ? 0x7affc0 : 0x9ab8ff;
  const robe = new THREE.MeshStandardMaterial({ color: revenant ? 0x2a4a3a : 0x9aa8c8, emissive: revenant ? 0x0a4a2a : 0x203a6a, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const face = new THREE.MeshStandardMaterial({ color: 0xdfe6f2, emissive: revenant ? 0x206040 : 0x4060a0, emissiveIntensity: 0.7, transparent: true, opacity: 0.85, roughness: 0.6, depthWrite: false });
  const voidM = new THREE.MeshBasicMaterial({ color: 0x000004, transparent: true, opacity: 0.95 });
  const armor = new THREE.MeshStandardMaterial({ color: 0x4a5a58, emissive: 0x0a3020, roughness: 0.4, metalness: 0.8, transparent: true, opacity: 0.85 });
  const root = new THREE.Group();
  const P = {};
  P.hips = group(root, [0, 1.0, 0]);
  P.torso = group(P.hips, [0, 0, 0]);
  // tattered robe: open cone + wisps
  const body = mesh(geo.coneOpen, robe, P.torso, { s: [0.75, 1.5, 0.6], p: [0, -0.05, 0], r: [0, 0, 0] });
  body.castShadow = false;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const w = mesh(geo.cone, robe, P.torso, { s: [0.12, 0.6 + Math.random() * 0.4, 0.12], p: [Math.cos(a) * 0.28, -0.85, Math.sin(a) * 0.22], r: [Math.PI, 0, 0] }); w.castShadow = false; }
  if (revenant) {
    mesh(geo.box, armor, P.torso, { s: [0.5, 0.5, 0.3], p: [0, 0.45, 0] });
    for (const s of [-1, 1]) mesh(geo.sphere, armor, P.torso, { s: [0.22, 0.16, 0.22], p: [s * 0.3, 0.68, 0] });
  }
  // hood
  P.neck = group(P.torso, [0, 0.72, 0]);
  P.head = group(P.neck, [0, 0.12, 0]);
  const hood = mesh(geo.sphere, robe, P.head, { s: [0.36, 0.42, 0.36], p: [0, 0.04, -0.03] }); hood.castShadow = false;
  const head = mesh(geo.sphere, face, P.head, { s: [0.24, 0.32, 0.22], p: [0, 0.0, 0.05] }); head.castShadow = false;
  // distorted face: long black eye sockets & gaping mouth
  for (const s of [-1, 1]) mesh(geo.sphereLow, voidM, P.head, { s: [0.06, 0.1, 0.04], p: [s * 0.055, 0.05, 0.155], r: [0, 0, s * 0.3] });
  P.jaw = group(P.head, [0, -0.08, 0.14]);
  mesh(geo.sphereLow, voidM, P.jaw, { s: [0.08, 0.16, 0.05], p: [0, -0.02, 0.01] });
  if (revenant) { mesh(geo.box, armor, P.head, { s: [0.3, 0.12, 0.3], p: [0, 0.2, 0] }); for (const s of [-1, 1]) mesh(geo.cone, armor, P.head, { s: [0.05, 0.2, 0.05], p: [s * 0.14, 0.32, 0], r: [0, 0, s * -0.3] }); }
  const eyes = addEyes(P.head, color, 0.055, 0.05, 0.16, 0.022);
  const armSet = (side) => {
    const sh = group(P.torso, [side * 0.26, 0.6, 0]);
    const ua = mesh(geo.capsule, robe, sh, { s: [0.07, 0.24, 0.07], p: [0, -0.2, 0] }); ua.castShadow = false;
    const el = group(sh, [0, -0.42, 0]);
    const fa = mesh(geo.capsule, face, el, { s: [0.05, 0.22, 0.05], p: [0, -0.18, 0] }); fa.castShadow = false;
    for (let i = 0; i < 3; i++) { const f = mesh(geo.cone, face, el, { s: [0.015, 0.16, 0.015], p: [-0.02 + i * 0.02, -0.42, 0.01], r: [Math.PI, 0, 0] }); f.castShadow = false; }
    if (revenant && side > 0) { const sw = mesh(geo.box, armor, el, { s: [0.04, 1.1, 0.08], p: [0, -0.7, 0.15], r: [0.9, 0, 0] }); }
    sh.rotation.x = -0.6;
    return [sh, el];
  };
  [P.shoulderL, P.elbowL] = armSet(-1);
  [P.shoulderR, P.elbowR] = armSet(1);
  // aura
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.scale.set(2.2, 2.8, 1); aura.position.y = 0.2; P.torso.add(aura);
  P.aura = aura;
  const scale = revenant ? 1.25 : 1.0;
  root.scale.setScalar(scale);
  return { root, parts: P, eyes, mats: [robe, face, voidM, armor, aura.material], headMesh: head, bodyMesh: body, heightScale: scale, transparent: true };
}

// ------------------------------------------------------------------ BOSS: THE NIGHTFATHER
export function buildBoss() {
  const hide = new THREE.MeshStandardMaterial({ color: 0x2a2224, roughness: 0.9, flatShading: true });
  const bone = new THREE.MeshStandardMaterial({ color: 0xcfc4ac, roughness: 0.6, flatShading: true });
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
  P.neck = group(P.torso, [0, 1.75, 0.2]);
  P.neck.rotation.x = -0.4;
  P.head = group(P.neck, [0, 0.3, 0.1]);
  const head = mesh(geo.sphere, bone, P.head, { s: [0.62, 0.7, 0.75], p: [0, 0, 0.1] }); // skull
  mesh(geo.box, bone, P.head, { s: [0.32, 0.22, 0.45], p: [0, -0.15, 0.45] });
  for (const s of [-1, 1]) mesh(geo.sphereLow, dark, P.head, { s: [0.16, 0.14, 0.1], p: [s * 0.15, 0.06, 0.42] });
  P.jaw = group(P.head, [0, -0.25, 0.25]);
  mesh(geo.box, bone, P.jaw, { s: [0.3, 0.1, 0.45], p: [0, -0.05, 0.2] });
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
    mesh(geo.box, bone, kn, { s: [0.4, 0.15, 0.6], p: [0, -1.15, 0.05] });
    return [leg, kn];
  };
  [P.legL, P.kneeL] = legSet(-1);
  [P.legR, P.kneeR] = legSet(1);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2010, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.scale.set(3, 3, 1); aura.position.set(0, 1.0, 0.4); P.torso.add(aura);
  P.aura = aura;
  return { root, parts: P, eyes, mats: [hide, bone, dark], headMesh: head, bodyMesh: body, heightScale: 1 };
}
