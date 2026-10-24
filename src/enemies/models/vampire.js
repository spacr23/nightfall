import * as THREE from 'three';
import { sculptSphere, limb, skinTexture, clothTexture, cached, smooth } from '../Sculpt.js';
import { prim, mesh, group, glowingEyes, std, clothPanel } from './common.js';

/**
 * Gothic aristocrat vampire.
 * Gaunt sculpted face (deep bruised eye sockets, hollow cheeks, aquiline nose, pointed ears, fangs, blood on the lips),
 * slicked-back hair with a widow's peak, Victorian tailcoat over a blood-red waistcoat with a lace jabot,
 * a high-collared cape with crimson lining that billows when running, long pale fingers ending in claws.
 * The Ancient variant is bald, grey and bat-eared, wears crimson and stands taller and more hunched.
 */

function headGeometry(ancient) {
  return cached(`vampHead${ancient}`, () => sculptSphere(40, 32, (v) => {
    let x = v.x * 2, y = v.y * 2, z = v.z * 2;
    // long, narrow skull with a sharp tapered jaw
    const below = smooth(0.15, -1, y);
    x *= 1 - 0.5 * below * below - 0.12 * below;
    z *= 1 - 0.14 * below;
    // temples pinch in slightly
    if (y > 0.3) x *= 1 - 0.08 * smooth(0.3, 0.8, y);
    if (z < 0) z *= 1.1;
    // flatter face plane
    if (z > 0.35) z = 0.35 + (z - 0.35) * 0.72;
    // hollow cheeks
    const cheek = smooth(0.25, 0.6, Math.abs(x)) * smooth(-0.75, -0.3, y) * (1 - smooth(-0.3, 0.05, y)) * smooth(0.1, 0.5, z);
    x *= 1 - 0.12 * cheek;
    // high cheekbones
    const bone = smooth(0.35, 0.65, Math.abs(x)) * (1 - Math.abs(y + 0.1) / 0.18 > 0 ? 1 - Math.abs(y + 0.1) / 0.18 : 0) * smooth(0.2, 0.6, z);
    x *= 1 + 0.06 * bone;
    // heavy brow ridge
    const brow = smooth(0.08, 0.2, y) * (1 - smooth(0.2, 0.34, y)) * smooth(0.45, 0.7, z);
    z += 0.08 * brow;
    // deep eye sockets
    for (const sx of [-0.34, 0.34]) {
      const d = Math.hypot(x - sx, y - 0.06, (z - 0.72) * 0.8);
      if (d < 0.3) { const k = 1 - d / 0.3; z -= 0.14 * k * k; }
    }
    // pointed chin
    if (y < -0.7 && z > 0.2) z += 0.07 * smooth(-0.7, -0.95, y);
    if (ancient) { y *= 1.06; if (y > 0.4) z *= 1.04; }
    v.set(x / 2, y / 2, z / 2);
  }));
}

/** Torso texture (lathe UV: u=0.5 is the front). Tailcoat with open front: waistcoat, shirt, lace jabot, lapels. */
function coatTexture(ancient) {
  return cached(`vampCoat${ancient}`, () => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    const W = 512, H = 256;
    const coat = ancient ? '#3a0a10' : '#0f0d12';
    ctx.fillStyle = coat; ctx.fillRect(0, 0, W, H);
    // velvet texture & seams
    for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 6); }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
    for (const u of [0.12, 0.88, 0.3, 0.7]) { ctx.beginPath(); ctx.moveTo(u * W, 0); ctx.lineTo(u * W, H); ctx.stroke(); }
    const cx = W / 2;
    // waistcoat (open front, narrowing toward the top)
    ctx.fillStyle = ancient ? '#120608' : '#5a0a12';
    ctx.beginPath(); ctx.moveTo(cx - 70, H); ctx.lineTo(cx - 34, 30); ctx.lineTo(cx + 34, 30); ctx.lineTo(cx + 70, H); ctx.closePath(); ctx.fill();
    // brocade pattern
    ctx.strokeStyle = ancient ? 'rgba(120,20,30,0.4)' : 'rgba(150,40,50,0.45)'; ctx.lineWidth = 1.5;
    for (let y = 40; y < H; y += 18) for (let x = cx - 60; x < cx + 60; x += 18) { ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.stroke(); }
    // white shirt V and lace jabot
    ctx.fillStyle = '#d8d2c6';
    ctx.beginPath(); ctx.moveTo(cx - 34, 0); ctx.lineTo(cx, 120); ctx.lineTo(cx + 34, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#efe9dd';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(cx, 18 + i * 13, 22 - i * 2.5, 8, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(cx, 18 + i * 13, 22 - i * 2.5, 8, 0, 0, Math.PI); ctx.stroke(); }
    // ruby brooch
    ctx.fillStyle = '#c0101a'; ctx.beginPath(); ctx.arc(cx, 12, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff8080'; ctx.beginPath(); ctx.arc(cx - 2, 10, 2, 0, 7); ctx.fill();
    // buttons
    ctx.fillStyle = '#b89a5a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(cx, 140 + i * 22, 3.5, 0, 7); ctx.fill(); }
    // satin lapels along the V
    ctx.strokeStyle = ancient ? '#5e1018' : '#26222c'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(cx - 44, 0); ctx.lineTo(cx - 74, H * 0.75); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 44, 0); ctx.lineTo(cx + 74, H * 0.75); ctx.stroke();
    // old blood stains on the shirt
    ctx.fillStyle = 'rgba(90,0,0,0.55)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(cx + (Math.random() - 0.5) * 30, 50 + Math.random() * 60, 2 + Math.random() * 5, 0, 7); ctx.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  });
}

function torsoGeometry() {
  return cached('vampTorso', () => {
    const prof = [[0.135, -0.02], [0.15, 0.06], [0.155, 0.16], [0.175, 0.3], [0.19, 0.42], [0.2, 0.5], [0.185, 0.56], [0.13, 0.62], [0.06, 0.66]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 24, Math.PI, Math.PI * 2);
    g.scale(1, 1, 0.66);
    g.computeVertexNormals();
    return g;
  });
}

function handGeometries() {
  return cached('vampHand', () => ({
    palm: sculptSphere(12, 10, (v) => { v.y *= 1.25; v.z *= 0.45; if (v.y < 0) v.x *= 0.85; }),
    finger: limb(0.06, 0.0085, 0.007, 0.05, 6),
    claw: new THREE.ConeGeometry(0.006, 0.05, 5).translate(0, -0.025, 0),
  }));
}

function hand(parent, skin, clawMat, side, ancient) {
  const H = handGeometries();
  const h = group(parent, [0, 0, 0]);
  mesh(H.palm, skin, h, { s: [0.07, 0.08, 0.07], p: [0, -0.04, 0.005], shadow: false });
  const clawLen = ancient ? 1.6 : 1.1;
  for (let i = 0; i < 4; i++) {
    const f1 = group(h, [-0.024 + i * 0.016, -0.08, 0.008], [0.25 + i * 0.05, 0, (i - 1.5) * 0.06]);
    mesh(H.finger, skin, f1, { s: [1, 1 + (i === 1 || i === 2 ? 0.25 : 0), 1], shadow: false });
    const f2 = group(f1, [0, -0.065, 0], [0.35, 0, 0]);
    mesh(H.finger, skin, f2, { s: [0.85, 0.8, 0.85], shadow: false });
    mesh(H.claw, clawMat, f2, { s: [1, clawLen, 1], p: [0, -0.048, 0.002], r: [0.25, 0, 0], shadow: false });
  }
  const th = group(h, [side * 0.03, -0.04, 0.012], [0.3, 0, side * 0.7]);
  mesh(H.finger, skin, th, { shadow: false });
  mesh(H.claw, clawMat, th, { s: [1, clawLen, 1], p: [0, -0.06, 0], shadow: false });
  return h;
}

export function buildVampire(opts = {}) {
  const ancient = !!opts.ancient;
  const skin = std({ map: skinTexture(ancient ? '#b8b4bd' : '#dcd8d4', ancient ? 'rgba(80,40,110,0.4)' : 'rgba(80,70,130,0.16)'), roughness: 0.55, emissive: 0x0c0e14 });
  const coat = std({ map: coatTexture(ancient), roughness: 0.7, emissive: 0x000000 });
  const sleeve = std({ map: clothTexture(ancient ? '#3a0a10' : '#0f0d12'), roughness: 0.75, emissive: 0x000000 });
  const trousers = std({ map: clothTexture('#141218'), roughness: 0.85, emissive: 0x000000 });
  const boots = std({ color: 0x0a0909, roughness: 0.25, metalness: 0.2, emissive: 0x000000 });
  const hair = std({ color: 0x07070a, roughness: 0.3, metalness: 0.1, emissive: 0x000000 });
  const capeOut = std({ map: clothTexture(ancient ? '#14060a' : '#0b0a0e'), roughness: 0.6, side: THREE.FrontSide, emissive: 0x000000 });
  const capeIn = std({ color: ancient ? 0x7a0610 : 0x6a0510, roughness: 0.35, metalness: 0.1, side: THREE.BackSide, emissive: 0x100000 });
  const lace = std({ color: 0xece6da, roughness: 0.9, emissive: 0x000000 });
  const bone = std({ color: 0xefe8d8, roughness: 0.3, emissive: 0x000000 });
  const claw = std({ color: 0x1a1414, roughness: 0.3, metalness: 0.3, emissive: 0x000000 });
  const lips = std({ color: 0x4a0a10, roughness: 0.3, emissive: 0x100000 });
  const mouthM = new THREE.MeshBasicMaterial({ color: 0x120204 });
  const blood = std({ color: 0x5a0006, roughness: 0.15, metalness: 0.2, emissive: 0x1a0000 });

  const root = new THREE.Group();
  const P = {};
  P.hips = group(root, [0, 0.98, 0]);

  // ---------------------------------------------------------------- legs
  const thighG = cached('vampThigh', () => limb(0.47, 0.075, 0.055, 0.1, 10));
  const shinG = cached('vampShin', () => limb(0.45, 0.055, 0.042, 0.12, 10));
  const bootG = cached('vampBoot', () => sculptSphere(16, 12, (v) => { v.z *= 2.6; if (v.z > 0) { v.y *= 1 - 0.4 * (v.z / 1.3); v.x *= 1 - 0.35 * (v.z / 1.3); } if (v.y < -0.1) v.y = -0.1 - (v.y + 0.1) * 0.3; }));
  mesh(cached('vampPelvis', () => limb(0.16, 0.14, 0.13, 0.05, 16)), trousers, P.hips, { s: [1, 1, 0.75], p: [0, 0.08, 0] });
  const legSet = (side) => {
    const leg = group(P.hips, [side * 0.09, -0.02, 0]);
    mesh(thighG, trousers, leg);
    const kn = group(leg, [0, -0.46, 0]);
    mesh(shinG, trousers, kn);
    mesh(cached('vampBootShaft', () => limb(0.24, 0.05, 0.046, 0, 10)), boots, kn, { p: [0, -0.22, 0] });
    mesh(bootG, boots, kn, { s: [0.095, 0.08, 0.1], p: [0, -0.445, 0.05] });
    mesh(prim.box, boots, kn, { s: [0.05, 0.04, 0.05], p: [0, -0.47, -0.04], shadow: false });
    return [leg, kn];
  };
  [P.legL, P.kneeL] = legSet(-1);
  [P.legR, P.kneeR] = legSet(1);

  // ---------------------------------------------------------------- torso
  P.torso = group(P.hips, [0, 0.08, 0]);
  if (ancient) P.torso.rotation.x = 0.18;
  const body = mesh(torsoGeometry(), coat, P.torso);
  // coat tails (split at the back) and a short front skirt
  const tails = [];
  for (const sd of [-1, 1]) {
    const panel = clothPanel(0.2, ancient ? 0.95 : 0.7, 3, 8, 0.03, 0.9);
    const tm = new THREE.Mesh(panel.geo, std({ map: clothTexture(ancient ? '#3a0a10' : '#0f0d12'), roughness: 0.75, side: THREE.DoubleSide, emissive: 0x000000 }));
    tm.position.set(sd * 0.075, 0.02, -0.095); tm.rotation.set(0.08, sd * 0.25 + Math.PI, 0);
    tm.castShadow = true; P.torso.add(tm);
    tails.push({ panel, mesh: tm });
  }
  // neck, high collar
  P.neck = group(P.torso, [0, 0.62, 0]);
  mesh(cached('vampNeck', () => limb(0.12, 0.042, 0.05, 0, 10)), skin, P.neck, { p: [0, 0.11, 0], shadow: false });
  const collarG = cached('vampCollar', () => { const g = new THREE.CylinderGeometry(0.17, 0.1, 0.27, 20, 1, true, Math.PI * 0.32, Math.PI * 1.36); g.translate(0, 0.11, 0); return g; });
  mesh(collarG, capeOut, P.neck, { s: [1, ancient ? 1.35 : 1, 0.9], p: [0, 0.0, -0.03], r: [-0.22, 0, 0] });
  mesh(collarG, capeIn, P.neck, { s: [0.98, ancient ? 1.33 : 0.98, 0.88], p: [0, 0.0, -0.03], r: [-0.22, 0, 0], shadow: false });

  // ---------------------------------------------------------------- head
  P.head = group(P.neck, [0, 0.18, 0.015]);
  const headScale = ancient ? [0.2, 0.29, 0.23] : [0.19, 0.255, 0.215];
  const head = mesh(headGeometry(ancient), skin, P.head, { s: headScale, p: [0, 0.05, 0] });
  const fz = headScale[2] * 0.42; // face plane depth
  // aquiline nose
  mesh(cached('vampNose', () => sculptSphere(10, 8, (v) => { v.z *= 0.6; if (v.y < 0) v.z *= 1 + (-v.y) * 1.4; })), skin, P.head, { s: [0.022, 0.06, 0.03], p: [0, 0.035, fz + 0.005], r: [-0.15, 0, 0], shadow: false });
  // brows: sharp, angled down toward the nose
  for (const sd of [-1, 1]) mesh(prim.box, hair, P.head, { s: [0.045, 0.007, 0.012], p: [sd * 0.035, 0.088, fz - 0.002], r: [0, sd * -0.3, sd * 0.32], shadow: false });
  // sunken eyes: dark sclera + glowing iris
  for (const sd of [-1, 1]) mesh(prim.sphereLow, mouthM, P.head, { s: [0.022, 0.013, 0.01], p: [sd * 0.033, 0.064, fz - 0.012], shadow: false });
  const eyes = glowingEyes(P.head, ancient ? 0xff1010 : 0xff2418, 0.033, 0.064, fz - 0.006, ancient ? 0.013 : 0.011, 0.25);
  // mouth with upper lip and fangs; jaw carries the lower lip and lower teeth
  mesh(prim.sphere, lips, P.head, { s: [0.04, 0.008, 0.012], p: [0, -0.02, fz - 0.006], shadow: false });
  for (const sd of [-1, 1]) mesh(prim.cone, bone, P.head, { s: [0.006, 0.026, 0.006], p: [sd * 0.012, -0.033, fz - 0.004], r: [Math.PI, 0, 0], shadow: false });
  for (let i = -1; i <= 1; i++) mesh(prim.box, bone, P.head, { s: [0.006, 0.007, 0.004], p: [i * 0.0065, -0.025, fz - 0.006], shadow: false });
  P.jaw = group(P.head, [0, -0.026, fz - 0.01]);
  mesh(prim.sphereLow, mouthM, P.jaw, { s: [0.032, 0.016, 0.01], p: [0, -0.007, 0.0], shadow: false });
  mesh(prim.sphere, lips, P.jaw, { s: [0.036, 0.008, 0.012], p: [0, -0.016, 0.003], shadow: false });
  for (const sd of [-1, 1]) mesh(prim.cone, bone, P.jaw, { s: [0.005, 0.016, 0.005], p: [sd * 0.016, -0.01, 0.006], shadow: false });
  // blood dripping from the corner of the mouth
  mesh(prim.capsule, blood, P.head, { s: [0.004, 0.012, 0.004], p: [0.02, -0.04, fz - 0.003], shadow: false });
  mesh(prim.sphereLow, blood, P.head, { s: [0.007, 0.009, 0.006], p: [0.021, -0.058, fz - 0.003], shadow: false });
  // pointed ears
  const earG = cached('vampEar', () => sculptSphere(10, 8, (v) => { v.z *= 0.25; if (v.y > 0) { v.x *= 1 - v.y * 1.2; v.y *= 2.2; } }));
  for (const sd of [-1, 1]) mesh(earG, skin, P.head, { s: ancient ? [0.07, 0.09, 0.07] : [0.045, 0.06, 0.05], p: [sd * headScale[0] * 0.48, 0.06, -0.012], r: [-0.25, sd * -0.5, sd * -0.45], shadow: false });
  // slicked-back hair with widow's peak
  if (!ancient) {
    const hairG = cached('vampHair', () => sculptSphere(28, 20, (v) => { if (v.y < -0.05 && v.z > -0.1) v.multiplyScalar(0.92); if (v.z < 0) v.z *= 1.12; }));
    const capG = cached('vampHairCap', () => { const g = new THREE.SphereGeometry(0.5, 28, 14, 0, Math.PI * 2, 0, 1.45); return g; });
    mesh(capG, hair, P.head, { s: [0.2, 0.2, 0.23], p: [0, 0.07, -0.006], r: [-0.12, 0, 0] });
    mesh(hairG, hair, P.head, { s: [0.17, 0.12, 0.13], p: [0, 0.045, -0.075] });
  } else {
    // bulging veins on the bald scalp
    for (let i = 0; i < 4; i++) mesh(prim.capsule, std({ color: 0x5a4a6a, roughness: 0.5 }), P.head, { s: [0.005, 0.06, 0.005], p: [(i - 1.5) * 0.03, 0.15, -0.02 + (i % 2) * 0.03], r: [0.9, 0, (i - 1.5) * 0.3], shadow: false });
  }

  // ---------------------------------------------------------------- arms
  const upperG = cached('vampUpper', () => limb(0.3, 0.052, 0.045, 0.08, 10));
  const foreG = cached('vampFore', () => limb(0.27, 0.045, 0.036, 0.08, 10));
  const cuffG = cached('vampCuff', () => new THREE.CylinderGeometry(0.05, 0.035, 0.06, 12, 1, true));
  const armSet = (side) => {
    const sh = group(P.torso, [side * 0.205, 0.55, 0]);
    mesh(prim.sphere, sleeve, sh, { s: [0.12, 0.1, 0.11], p: [0, 0.01, 0] }); // shoulder pad
    mesh(upperG, sleeve, sh, { p: [0, 0, 0] });
    const el = group(sh, [0, -0.3, 0]);
    mesh(foreG, sleeve, el);
    mesh(cuffG, lace, el, { p: [0, -0.27, 0], shadow: false });
    const wr = group(el, [0, -0.28, 0]);
    hand(wr, skin, claw, side, ancient);
    return [sh, el];
  };
  [P.shoulderL, P.elbowL] = armSet(-1);
  [P.shoulderR, P.elbowR] = armSet(1);

  // ---------------------------------------------------------------- cape
  P.cape = group(P.torso, [0, 0.6, -0.11]);
  const capePanel = clothPanel(ancient ? 1.0 : 0.86, ancient ? 1.6 : 1.42, 10, 14, 0.16, 0.55);
  const capeOuter = new THREE.Mesh(capePanel.geo, capeOut); capeOuter.rotation.y = Math.PI; capeOuter.castShadow = true; P.cape.add(capeOuter);
  const capeInner = new THREE.Mesh(capePanel.geo, capeIn); capeInner.rotation.y = Math.PI; P.cape.add(capeInner);

  const scale = ancient ? 1.16 : 1.0;
  root.scale.setScalar(scale);
  const mats = [skin, coat, sleeve, trousers, capeOut, capeIn, hair, lips];
  return {
    root, parts: P, eyes, mats, headMesh: head, bodyMesh: body, heightScale: scale,
    /** cloth simulation-lite: cape billows with speed, tails swing with the stride */
    update(dt, gait, phase, t) {
      capePanel.update(t, gait, Math.min(1, gait * 0.9));
      for (const tl of tails) tl.panel.update(t + tl.mesh.position.x * 3, gait, gait * 0.5 + Math.abs(Math.sin(phase)) * 0.15 * gait);
    },
  };
}
