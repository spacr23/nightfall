import * as THREE from 'three';
import { sculptSphere, limb, furTexture, furCardTexture, cached, smooth } from '../Sculpt.js';
import { prim, mesh, group, glowingEyes, std } from './common.js';

/**
 * Hulking werewolf: sculpted wolf skull with a long snarling muzzle, rows of fangs and a hinged jaw,
 * tall ears, a barrel chest with a shaggy mane of alpha-tested fur cards, heavily muscled arms with
 * huge clawed hands, digitigrade legs and a bushy tail. The Alpha is larger, silver-furred and red-eyed.
 */
function skullGeo() {
  return cached('wolfSkull', () => sculptSphere(32, 24, (v) => {
    let x = v.x * 2, y = v.y * 2, z = v.z * 2;
    if (z < 0) z *= 1.15;
    // broad cheeks, flat top
    if (y > 0.4) y = 0.4 + (y - 0.4) * 0.7;
    const cheek = smooth(-0.6, 0, y) * (1 - smooth(0, 0.4, y));
    x *= 1 + 0.12 * cheek;
    // heavy brow over the eyes
    const brow = smooth(0.0, 0.2, y) * (1 - smooth(0.25, 0.45, y)) * smooth(0.4, 0.8, z);
    z += 0.16 * brow;
    for (const sx of [-0.35, 0.35]) {
      const d = Math.hypot(x - sx, y - 0.05, z - 0.8);
      if (d < 0.28) { const k = 1 - d / 0.28; z -= 0.12 * k * k; }
    }
    v.set(x / 2, y / 2, z / 2);
  }));
}

function muzzleGeo() {
  return cached('wolfMuzzle', () => sculptSphere(24, 16, (v) => {
    // long tapered snout, flat underside, ridge on top
    const t = smooth(-0.5, 0.5, v.z);
    v.x *= 1 - 0.42 * t;
    v.y *= 1 - 0.3 * t;
    if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.35;
    if (v.y > 0.2 && Math.abs(v.x) < 0.15) v.y += 0.02;
  }));
}

function jawGeo() {
  return cached('wolfJaw', () => sculptSphere(18, 12, (v) => {
    const t = smooth(-0.5, 0.5, v.z);
    v.x *= 1 - 0.45 * t;
    v.y *= 0.45;
    if (v.y > 0) v.y *= 0.3;
  }));
}

function card(parent, mat, p, r, s = 1) {
  const g = cached('furCard', () => { const pg = new THREE.PlaneGeometry(0.2, 0.32); pg.translate(0, -0.15, 0); return pg; });
  const m = new THREE.Mesh(g, mat);
  m.position.set(...p); m.rotation.set(...r); m.scale.setScalar(s);
  m.castShadow = false;
  parent.add(m);
  return m;
}

export function buildWerewolf(opts = {}) {
  const alpha = !!opts.alpha;
  const dark = alpha ? '#7a7b82' : '#2a211b', light = alpha ? '#a9abb3' : '#4c3d30';
  const fur = std({ map: furTexture(dark, light), roughness: 1, emissive: 0x000000 });
  const furLight = std({ map: furTexture(alpha ? '#8a8c94' : '#3a2e24', alpha ? '#b4b6be' : '#5e4b3a'), roughness: 1, emissive: 0x000000 });
  const cardMat = new THREE.MeshStandardMaterial({ map: furCardTexture(alpha ? '#8d8e96' : '#2e241c'), color: 0x9a9a9a, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
  const skin = std({ color: alpha ? 0x3a3236 : 0x2a1c1a, roughness: 0.6, emissive: 0x000000 });
  const nose = std({ color: 0x080606, roughness: 0.15, metalness: 0.2 });
  const bone = std({ color: 0xe0d6bc, roughness: 0.35 });
  const gum = std({ color: 0x4a0e14, roughness: 0.3, emissive: 0x0c0000 });
  const claw = std({ color: 0x15110f, roughness: 0.3, metalness: 0.3 });
  const innerEar = std({ color: 0x5a3030, roughness: 0.7 });

  const root = new THREE.Group();
  const P = {};
  P.hips = group(root, [0, 1.12, 0]);

  // ---------------------------------------------------------------- torso: barrel chest, hunched
  P.torso = group(P.hips, [0, 0, 0]);
  P.torso.rotation.x = 0.45;
  const torsoG = cached('wolfTorso', () => {
    const prof = [[0.2, -0.05], [0.27, 0.1], [0.33, 0.3], [0.42, 0.55], [0.45, 0.72], [0.4, 0.86], [0.28, 0.98], [0.14, 1.05]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20);
    g.scale(1, 1, 0.75);
    g.computeVertexNormals();
    return g;
  });
  const body = mesh(torsoG, fur, P.torso);
  mesh(prim.sphere, furLight, P.torso, { s: [0.5, 0.42, 0.2], p: [0, 0.66, 0.24] }); // chest
  // pectoral / shoulder masses
  for (const sd of [-1, 1]) mesh(prim.sphere, fur, P.torso, { s: [0.32, 0.3, 0.32], p: [sd * 0.34, 0.82, 0.04] });
  // mane & spine fur
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    card(P.torso, cardMat, [Math.sin(a) * 0.3, 1.02, Math.cos(a) * 0.24], [0.5 * Math.cos(a) - 0.2, a, 0], 1.2 + Math.random() * 0.4);
  }
  for (let i = 0; i < 9; i++) card(P.torso, cardMat, [(Math.random() - 0.5) * 0.12, 0.25 + i * 0.09, -0.3], [-0.9, Math.PI + (Math.random() - 0.5) * 0.5, 0], 1 + Math.random() * 0.3);
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) card(P.torso, cardMat, [sd * (0.42 + i * 0.02), 0.5 + i * 0.12, -0.02], [0, sd * Math.PI / 2, sd * 0.3], 0.9);

  // ---------------------------------------------------------------- head
  P.neck = group(P.torso, [0, 0.98, 0.14]);
  P.neck.rotation.x = -0.35;
  mesh(cached('wolfNeck', () => limb(0.24, 0.17, 0.2, 0.05, 12)), fur, P.neck, { p: [0, 0.18, 0], r: [0.3, 0, 0] });
  P.head = group(P.neck, [0, 0.18, 0.12]);
  P.head.scale.setScalar(1.32);
  const head = mesh(skullGeo(), fur, P.head, { s: [0.34, 0.3, 0.36], p: [0, 0.04, 0] });
  mesh(muzzleGeo(), fur, P.head, { s: [0.18, 0.16, 0.36], p: [0, -0.03, 0.24] });
  mesh(prim.sphere, nose, P.head, { s: [0.075, 0.055, 0.06], p: [0, 0.0, 0.42], shadow: false });
  // upper fangs and gums
  mesh(prim.box, gum, P.head, { s: [0.11, 0.02, 0.24], p: [0, -0.085, 0.26], shadow: false });
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 5; i++) mesh(prim.cone, bone, P.head, { s: [0.016, i === 0 ? 0.07 : 0.035, 0.016], p: [sd * (0.045 - i * 0.004), -0.1, 0.36 - i * 0.045], r: [Math.PI, 0, 0], shadow: false });
  }
  P.jaw = group(P.head, [0, -0.1, 0.12]);
  mesh(jawGeo(), fur, P.jaw, { s: [0.15, 0.1, 0.32], p: [0, -0.02, 0.12] });
  mesh(prim.box, gum, P.jaw, { s: [0.09, 0.012, 0.22], p: [0, 0.005, 0.13], shadow: false });
  mesh(prim.capsule, std({ color: 0x8a2a32, roughness: 0.3 }), P.jaw, { s: [0.05, 0.12, 0.02], p: [0, 0.0, 0.1], r: [Math.PI / 2, 0, 0], shadow: false });
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) mesh(prim.cone, bone, P.jaw, { s: [0.014, i === 0 ? 0.055 : 0.03, 0.014], p: [sd * (0.038 - i * 0.004), 0.025, 0.24 - i * 0.045], shadow: false });
  // ears
  const earG = cached('wolfEar', () => sculptSphere(10, 8, (v) => { v.z *= 0.35; if (v.y > 0) { v.x *= 1 - v.y * 1.3; v.y *= 2.4; } }));
  for (const sd of [-1, 1]) {
    const e = group(P.head, [sd * 0.11, 0.17, -0.04], [-0.3, sd * -0.25, sd * -0.25]);
    mesh(earG, fur, e, { s: [0.11, 0.12, 0.08] });
    mesh(earG, innerEar, e, { s: [0.07, 0.09, 0.05], p: [0, 0.0, 0.02], shadow: false });
  }
  // cheek ruff
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) card(P.head, cardMat, [sd * 0.16, -0.02 - i * 0.04, 0.04], [0.2, sd * 1.2, sd * 0.4], 0.75);
  const eyes = glowingEyes(P.head, alpha ? 0xff2018 : 0xffc21a, 0.085, 0.07, 0.16, 0.032, 0.35);

  // ---------------------------------------------------------------- arms
  const upperG = cached('wolfUpper', () => limb(0.46, 0.13, 0.095, 0.3, 12));
  const foreG = cached('wolfFore', () => limb(0.42, 0.105, 0.075, 0.25, 12));
  const fingerG = cached('wolfFinger', () => limb(0.1, 0.025, 0.02, 0.1, 6));
  const clawG = cached('wolfClaw', () => new THREE.ConeGeometry(0.016, 0.14, 5).translate(0, -0.07, 0));
  const armSet = (side) => {
    const sh = group(P.torso, [side * 0.46, 0.84, 0.05]);
    sh.rotation.x = -0.35;
    mesh(upperG, fur, sh);
    for (let i = 0; i < 2; i++) card(sh, cardMat, [side * 0.1, -0.12 - i * 0.14, -0.04], [0, side * Math.PI / 2, side * 0.2], 0.8);
    const el = group(sh, [0, -0.46, 0]);
    mesh(prim.sphere, fur, el, { s: [0.2, 0.2, 0.2] }); // elbow
    mesh(foreG, fur, el);
    mesh(prim.sphere, fur, el, { s: [0.15, 0.14, 0.14], p: [0, -0.42, 0] }); // wrist
    for (let i = 0; i < 3; i++) card(el, cardMat, [side * 0.08, -0.05 - i * 0.12, -0.05], [0.2, side * 1.3, side * 0.35], 0.75);
    const hand = group(el, [0, -0.44, 0.02]);
    mesh(prim.sphere, skin, hand, { s: [0.17, 0.16, 0.1], p: [0, -0.05, 0] });
    for (let i = 0; i < 4; i++) {
      const f = group(hand, [-0.06 + i * 0.04, -0.11, 0.02], [0.4, 0, (i - 1.5) * 0.1]);
      mesh(fingerG, skin, f, { shadow: false });
      mesh(clawG, claw, f, { p: [0, -0.09, 0.01], r: [0.4, 0, 0], shadow: false });
    }
    return [sh, el];
  };
  [P.shoulderL, P.elbowL] = armSet(-1);
  [P.shoulderR, P.elbowR] = armSet(1);

  // ---------------------------------------------------------------- digitigrade legs
  const thighG = cached('wolfThigh', () => limb(0.48, 0.17, 0.11, 0.3, 12));
  const shinG = cached('wolfShin', () => limb(0.42, 0.095, 0.06, 0.15, 10));
  const footG = cached('wolfFoot', () => limb(0.24, 0.06, 0.05, 0.05, 8));
  const legSet = (side) => {
    const leg = group(P.hips, [side * 0.22, 0, 0]);
    const thigh = group(leg, [0, 0, 0], [-0.45, 0, 0]);
    mesh(thighG, fur, thigh);
    card(thigh, cardMat, [side * 0.12, -0.1, -0.05], [0, side * 1.4, side * 0.3], 0.9);
    const kn = group(leg, [0, -0.42, 0.2]);
    mesh(prim.sphere, fur, kn, { s: [0.2, 0.2, 0.2] });
    const shin = group(kn, [0, 0, 0], [0.75, 0, 0]);
    mesh(shinG, fur, shin);
    const ankle = group(shin, [0, -0.42, 0], [-0.95, 0, 0]);
    mesh(footG, skin, ankle);
    const paw = group(ankle, [0, -0.24, 0.02], [0.65, 0, 0]);
    mesh(prim.sphere, skin, paw, { s: [0.15, 0.07, 0.2], p: [0, 0, 0.06] });
    for (let i = 0; i < 3; i++) mesh(clawG, claw, paw, { s: [0.9, 0.6, 0.9], p: [-0.04 + i * 0.04, -0.01, 0.15], r: [Math.PI / 2 + 0.3, 0, 0], shadow: false });
    return [leg, kn];
  };
  [P.legL, P.kneeL] = legSet(-1);
  [P.legR, P.kneeR] = legSet(1);

  // ---------------------------------------------------------------- tail
  P.tail = group(P.hips, [0, 0.05, -0.3]);
  const tailG = cached('wolfTail', () => { const g = limb(0.7, 0.09, 0.03, 0.6, 10); return g; });
  const tailSeg = group(P.tail, [0, 0, 0], [-2.3, 0, 0]);
  mesh(tailG, fur, tailSeg);
  for (let i = 0; i < 5; i++) card(tailSeg, cardMat, [0, -0.1 - i * 0.12, 0], [0, i * 1.3, 0], 0.8);

  const scale = alpha ? 1.38 : 1.0;
  root.scale.setScalar(scale);
  return { root, parts: P, eyes, mats: [fur, furLight, skin], headMesh: head, bodyMesh: body, heightScale: scale };
}
