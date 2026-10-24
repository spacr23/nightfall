import * as THREE from 'three';
import { sculptSphere, limb, tatterTexture, cached, smooth, addRim } from '../Sculpt.js';
import { prim, mesh, group, glowingEyes, glowTexture, std } from './common.js';

/**
 * Ghost: translucent, rim-lit shroud that ripples and trails off into tatters, a gaunt skull-like
 * face with hollow eye sockets and a stretched, screaming mouth, emaciated arms with long bony fingers.
 * The Revenant is an armoured spectral knight with a helm, pauldrons, breastplate and a greatsword.
 */
function faceGeo() {
  return cached('ghostFace', () => sculptSphere(36, 28, (v) => {
    let x = v.x * 2, y = v.y * 2, z = v.z * 2;
    y *= 1.18;
    const below = smooth(0, -1.1, y);
    x *= 1 - 0.3 * below;
    if (z > 0.3) z = 0.3 + (z - 0.3) * 0.8;
    // cheek hollows
    const ch = smooth(0.3, 0.6, Math.abs(x)) * smooth(-0.8, -0.3, y) * (1 - smooth(-0.3, 0.1, y)) * smooth(0.1, 0.5, z);
    x *= 1 - 0.18 * ch;
    // very deep eye sockets
    for (const sx of [-0.33, 0.33]) {
      const d = Math.hypot((x - sx) * 1.1, (y - 0.12) * 0.8, z - 0.75);
      if (d < 0.36) { const k = 1 - d / 0.36; z -= 0.3 * k * k; }
    }
    // gaping vertical mouth
    const md = Math.hypot(x * 1.6, (y + 0.55) * 0.55, z - 0.7);
    if (md < 0.4) { const k = 1 - md / 0.4; z -= 0.35 * k * k; }
    v.set(x / 2, y / 2, z / 2);
  }));
}

export function buildGhost(opts = {}) {
  const revenant = !!opts.revenant;
  const color = revenant ? 0x7affc0 : 0x9ab8ff;
  const robe = addRim(std({ color: revenant ? 0x2a4a3a : 0x8ea0c4, emissive: revenant ? 0x0a3a22 : 0x1c3266, emissiveIntensity: 1, transparent: true, opacity: 0.6, alphaMap: tatterTexture(), side: THREE.DoubleSide, depthWrite: false, roughness: 0.9 }), color, 2.2, 1.4);
  const face = addRim(std({ color: 0xd8e0ec, emissive: revenant ? 0x184a34 : 0x2a4478, emissiveIntensity: 0.8, transparent: true, opacity: 0.88, depthWrite: false, roughness: 0.6 }), color, 2.5, 0.9);
  const bone = addRim(std({ color: 0xc8d2e2, emissive: revenant ? 0x103a28 : 0x1a3060, transparent: true, opacity: 0.8, depthWrite: false, roughness: 0.6 }), color, 2, 0.8);
  const voidM = new THREE.MeshBasicMaterial({ color: 0x000003, transparent: true, opacity: 0.96 });
  const armor = addRim(std({ color: 0x4e5c5a, emissive: 0x0a2a1c, roughness: 0.35, metalness: 0.85, transparent: true, opacity: 0.9 }), color, 3, 0.7);

  const root = new THREE.Group();
  const P = {};
  P.hips = group(root, [0, 1.0, 0]);
  P.torso = group(P.hips, [0, 0, 0]);

  // shroud: open cylinder with per-vertex ripples (per-instance geometry)
  const robeGeo = new THREE.CylinderGeometry(revenant ? 0.26 : 0.2, revenant ? 0.55 : 0.5, 1.75, 28, 14, true);
  robeGeo.translate(0, -0.12, 0);
  const rpos = robeGeo.attributes.position;
  const rbase = Float32Array.from(rpos.array);
  const body = mesh(robeGeo, robe, P.torso, { shadow: false });
  // shoulders / chest under the shroud
  mesh(prim.sphere, robe, P.torso, { s: [0.48, 0.3, 0.32], p: [0, 0.62, 0], shadow: false });
  if (revenant) {
    const bp = cached('revBreast', () => { const g = new THREE.LatheGeometry([[0.2, 0], [0.26, 0.2], [0.27, 0.38], [0.2, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 16); g.scale(1, 1, 0.7); g.computeVertexNormals(); return g; });
    mesh(bp, armor, P.torso, { p: [0, 0.2, 0] });
    for (const sd of [-1, 1]) mesh(cached('revPauldron', () => new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2)), armor, P.torso, { s: [0.28, 0.2, 0.28], p: [sd * 0.3, 0.64, 0], r: [0, 0, sd * -0.3] });
  }

  // hood + face
  P.neck = group(P.torso, [0, 0.72, 0]);
  P.head = group(P.neck, [0, 0.15, 0]);
  const hoodG = cached('ghostHood', () => new THREE.SphereGeometry(0.5, 24, 18, Math.PI * 0.25 + Math.PI, Math.PI * 1.5, 0, Math.PI * 0.8));
  mesh(hoodG, robe, P.head, { s: [0.4, 0.46, 0.42], p: [0, 0.05, -0.02], shadow: false });
  const head = mesh(faceGeo(), face, P.head, { s: [0.21, 0.27, 0.22], p: [0, 0.0, 0.03], shadow: false });
  for (const sd of [-1, 1]) mesh(prim.sphereLow, voidM, P.head, { s: [0.045, 0.065, 0.03], p: [sd * 0.035, 0.022, 0.085], r: [0, 0, sd * 0.25], shadow: false });
  P.jaw = group(P.head, [0, -0.06, 0.08]);
  mesh(prim.sphereLow, voidM, P.jaw, { s: [0.05, 0.11, 0.03], p: [0, -0.02, 0], shadow: false });
  if (revenant) {
    const helm = cached('revHelm', () => new THREE.SphereGeometry(0.5, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62));
    mesh(helm, armor, P.head, { s: [0.25, 0.27, 0.26], p: [0, 0.07, -0.01] });
    mesh(prim.box, armor, P.head, { s: [0.02, 0.12, 0.05], p: [0, 0.08, 0.13] }); // nasal guard
    for (const sd of [-1, 1]) mesh(prim.cone, armor, P.head, { s: [0.04, 0.24, 0.04], p: [sd * 0.13, 0.2, -0.02], r: [-0.3, 0, sd * -0.5] });
  }
  const eyes = glowingEyes(P.head, color, 0.035, 0.022, 0.07, 0.016);

  // arms: sleeves trailing tatters, bony hands with long fingers
  const sleeveG = cached('ghostSleeve', () => { const g = new THREE.CylinderGeometry(0.05, 0.11, 0.42, 12, 1, true); g.translate(0, -0.21, 0); return g; });
  const foreG = cached('ghostFore', () => limb(0.3, 0.03, 0.022, 0.05, 8));
  const fingerG = cached('ghostFinger', () => limb(0.1, 0.008, 0.004, 0.1, 5));
  const armSet = (side) => {
    const sh = group(P.torso, [side * 0.25, 0.6, 0]);
    mesh(sleeveG, robe, sh, { shadow: false });
    const el = group(sh, [0, -0.38, 0]);
    mesh(foreG, bone, el, { shadow: false });
    mesh(cached('ghostCuff', () => { const g = new THREE.CylinderGeometry(0.1, 0.13, 0.2, 12, 1, true); g.translate(0, -0.05, 0); return g; }), robe, el, { shadow: false });
    const hand = group(el, [0, -0.3, 0]);
    mesh(prim.sphere, bone, hand, { s: [0.05, 0.07, 0.025], p: [0, -0.02, 0], shadow: false });
    for (let i = 0; i < 4; i++) {
      const f = group(hand, [-0.018 + i * 0.012, -0.05, 0.005], [0.3, 0, (i - 1.5) * 0.12]);
      mesh(fingerG, bone, f, { s: [1, 1.2 + (i === 1 || i === 2 ? 0.3 : 0), 1], shadow: false });
    }
    if (revenant && side > 0) {
      const sword = group(hand, [0, -0.05, 0.02], [1.2, 0, 0]);
      mesh(prim.box, armor, sword, { s: [0.035, 1.1, 0.01], p: [0, -0.62, 0] });
      mesh(prim.box, armor, sword, { s: [0.22, 0.03, 0.04], p: [0, -0.08, 0] });
      mesh(prim.cyl, armor, sword, { s: [0.03, 0.14, 0.03], p: [0, 0.0, 0] });
    }
    sh.rotation.x = -0.6;
    return [sh, el];
  };
  [P.shoulderL, P.elbowL] = armSet(-1);
  [P.shoulderR, P.elbowR] = armSet(1);

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.scale.set(2.2, 2.8, 1); aura.position.y = 0.2; P.torso.add(aura);
  P.aura = aura;

  const scale = revenant ? 1.25 : 1.0;
  root.scale.setScalar(scale);
  return {
    root, parts: P, eyes, mats: [robe, face, bone, voidM, armor, aura.material], headMesh: head, bodyMesh: body, heightScale: scale, transparent: true,
    update(dt, gait, phase, t) {
      // ripple the shroud, strongest at the hem, trailing behind when moving
      for (let i = 0; i < rpos.count; i++) {
        const x = rbase[i * 3], y = rbase[i * 3 + 1], z = rbase[i * 3 + 2];
        const k = Math.max(0, (0.6 - y) / 1.6);
        const a = Math.atan2(z, x);
        const w = Math.sin(t * 2.4 + a * 3 + y * 4) * 0.06 * k + Math.sin(t * 4.1 + a * 7) * 0.025 * k;
        rpos.setXYZ(i, x * (1 + w * 2), y, z * (1 + w * 2) - gait * k * k * 0.35);
      }
      rpos.needsUpdate = true;
    },
  };
}
