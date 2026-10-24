import * as THREE from 'three';
import { cached } from '../Sculpt.js';
import { prim, mesh, group, std, glowTexture } from './common.js';

/**
 * Sculpted vampire head: one high-resolution mesh whose features (brow ridge, nose bridge and wings,
 * cheekbones, hollow cheeks, lips, chin, temples, hair volume) are displaced from a sphere, plus a
 * matching face texture painted in the same spherical coordinates (brows, eye shadow, lips, hairline
 * with a widow's peak, veins). Because geometry and texture share one coordinate system, every painted
 * feature sits exactly on its sculpted counterpart.
 *
 * Coordinates: lat = latitude (deg, + up), lon = longitude from the face centre (deg, + toward the
 * model's left/+x). Sphere UV: u = 0.25 + lon / 360, v-down = (90 - lat) / 180.
 */
const D = Math.PI / 180;
const g2 = (dLat, dLon, sLat, sLon) => Math.exp(-((dLat * dLat) / (2 * sLat * sLat) + (dLon * dLon) / (2 * sLon * sLon)));

function landmarks(ancient) {
  return {
    eyeLat: 6, eyeLon: 21,
    browLat: 15,
    noseTipLat: -12,
    mouthLat: -27,
    chinLat: -46,
    hairLat: ancient ? 99 : 31, // ancient vampires are bald
    gaunt: ancient ? 1.5 : 1,
  };
}

/** Radial displacement field r(lat, lon) on the unit sphere. */
function relief(lat, lon, L) {
  const alon = Math.abs(lon);
  let r = 1;
  // overall skull: long, narrow jaw, slightly pinched temples
  if (lat < -6) r -= 0.2 * Math.min(1, (-6 - lat) / 46) * Math.min(1, alon / 34);
  r -= 0.035 * g2(lat - 18, alon - 60, 12, 14) * L.gaunt;
  // brow ridge + glabella
  r += 0.07 * g2(lat - L.browLat, alon - 17, 4, 13);
  r += 0.04 * g2(lat - (L.browLat - 3), lon, 5, 6);
  // eye sockets (deep)
  r -= (0.11 + 0.03 * L.gaunt) * g2(lat - L.eyeLat, alon - L.eyeLon, 5.5, 9);
  // nose: bridge widening into an aquiline tip with nostril wings
  const bridge = Math.max(0, Math.min(1, (L.eyeLat + 4 - lat) / (L.eyeLat + 4 - L.noseTipLat)));
  r += (0.05 + 0.2 * bridge * bridge) * g2(0, lon, 1, 3.2 + 1.6 * bridge) * (lat > L.noseTipLat - 6 && lat < L.eyeLat + 6 ? 1 : 0) * g2(lat - (L.noseTipLat + 4), 0, 13, 1);
  r += 0.09 * g2(lat - L.noseTipLat, alon - 6, 3, 3.5);
  r -= 0.03 * g2(lat - (L.noseTipLat - 4), lon, 2, 4); // under the nose
  // high cheekbones, hollow cheeks below them
  r += 0.05 * g2(lat + 3, alon - 37, 6, 12);
  r -= 0.12 * L.gaunt * g2(lat + 19, alon - 34, 8, 9);
  // lips (thin upper, fuller lower) with a mouth groove
  r += 0.03 * g2(lat - (L.mouthLat + 2), lon, 1.5, 9);
  r += 0.03 * g2(lat - (L.mouthLat - 2.5), lon, 1.8, 8);
  r -= 0.025 * g2(lat - L.mouthLat, lon, 0.6, 10);
  // chin, and a rounded (not pinched) underside where the head meets the neck
  r += 0.06 * g2(lat - L.chinLat, lon, 7, 14);
  if (lat < -55) r *= 1 - 0.3 * Math.min(1, (-55 - lat) / 35);
  // hair volume
  if (lat > L.hairLat - 4 && L.hairLat < 90) r += 0.035 * Math.min(1, (lat - L.hairLat + 4) / 6);
  return r;
}

function headGeometry(ancient) {
  return cached(`vampHead2${ancient}`, () => {
    const L = landmarks(ancient);
    const g = new THREE.SphereGeometry(0.5, 96, 72);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).multiplyScalar(2);
      const lat = Math.asin(Math.max(-1, Math.min(1, v.y))) / D;
      const lon = Math.atan2(v.x, v.z) / D;
      v.multiplyScalar(relief(lat, lon, L) * 0.5);
      // flatten the face plane a little and deepen the back of the skull
      if (v.z < 0) v.z *= 1.06;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** Paint the face in sphere-UV space so it lines up with the sculpt. */
function faceTexture(ancient) {
  return cached(`vampFace${ancient}`, () => {
    const W = 1024, H = 512, L = landmarks(ancient);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const X = (lon) => (0.25 + lon / 360) * W;
    const Y = (lat) => ((90 - lat) / 180) * H;
    const blob = (lat, lon, rx, ry, col) => { const g = ctx.createRadialGradient(X(lon), Y(lat), 0, X(lon), Y(lat), 1); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.translate(X(lon), Y(lat)); ctx.scale(rx, ry); ctx.translate(-X(lon), -Y(lat)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(lon), Y(lat), 1, 0, 7); ctx.fill(); ctx.restore(); };
    // base skin: cold porcelain with grey-violet undertone
    ctx.fillStyle = ancient ? '#b3aeb8' : '#cfcac5'; ctx.fillRect(0, 0, W, H);
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 1600; i++) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '110,95,120' : '255,250,250'},${0.025 + rnd() * 0.03})`; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 2 + rnd() * 9, 0, 7); ctx.fill(); }
    // shading that sells the anatomy: sunken eyes, cheek hollows, temples, under the jaw
    for (const sd of [-1, 1]) {
      blob(L.eyeLat, sd * L.eyeLon, 34, 22, 'rgba(70,30,55,0.75)');
      blob(L.eyeLat - 5, sd * (L.eyeLon + 3), 30, 14, 'rgba(90,60,90,0.45)');
      blob(-20, sd * 33, 34, 40, 'rgba(90,75,95,0.38)');
      blob(20, sd * 60, 30, 30, 'rgba(110,100,130,0.3)');
    }
    blob(-58, 0, 120, 26, 'rgba(70,60,75,0.35)');
    // nose bridge highlight + nostrils
    blob(-2, 0, 6, 34, 'rgba(255,255,255,0.18)');
    for (const sd of [-1, 1]) blob(L.noseTipLat - 2, sd * 4, 5, 3, 'rgba(40,10,20,0.55)');
    // brows: thin, dark, sharply arched and angled down toward the nose
    ctx.strokeStyle = ancient ? 'rgba(60,50,60,0.55)' : '#141016'; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      ctx.lineWidth = ancient ? 3 : 5;
      ctx.beginPath();
      // angry: low at the nose, rising to a sharp point at the temple
      ctx.moveTo(X(sd * 5), Y(L.browLat - 4.5));
      ctx.quadraticCurveTo(X(sd * 16), Y(L.browLat - 1), X(sd * 31), Y(L.browLat + 4));
      ctx.stroke();
      // upper eyelid line and lower lid redness
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30,8,18,0.8)';
      ctx.beginPath(); ctx.moveTo(X(sd * 12), Y(L.eyeLat + 0.5)); ctx.quadraticCurveTo(X(sd * 19), Y(L.eyeLat + 3.5), X(sd * 26), Y(L.eyeLat)); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,30,40,0.55)';
      ctx.beginPath(); ctx.moveTo(X(sd * 13), Y(L.eyeLat - 2.5)); ctx.quadraticCurveTo(X(sd * 19), Y(L.eyeLat - 4), X(sd * 25), Y(L.eyeLat - 2)); ctx.stroke();
      ctx.strokeStyle = ancient ? 'rgba(60,50,60,0.55)' : '#141016';
      // nasolabial fold
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(90,60,75,0.45)';
      ctx.beginPath(); ctx.moveTo(X(sd * 7), Y(L.noseTipLat - 2)); ctx.quadraticCurveTo(X(sd * 13), Y(L.mouthLat + 4), X(sd * 12), Y(L.mouthLat - 3)); ctx.stroke();
    }
    // lips: thin, bloodless purple-red with a dark parting line
    // thin, cold lips with a slight sneer
    ctx.fillStyle = ancient ? 'rgba(80,40,55,0.8)' : 'rgba(110,45,60,0.75)';
    ctx.beginPath(); ctx.ellipse(X(0), Y(L.mouthLat + 1.4), 30, 4, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(X(0), Y(L.mouthLat - 1.8), 26, 5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1a0408'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(X(-10), Y(L.mouthLat - 1.2)); ctx.quadraticCurveTo(X(0), Y(L.mouthLat + 0.6), X(10), Y(L.mouthLat + 0.3)); ctx.stroke();
    // fresh blood from the corner of the mouth
    ctx.fillStyle = 'rgba(120,0,8,0.85)';
    ctx.beginPath(); ctx.moveTo(X(9), Y(L.mouthLat - 1)); ctx.quadraticCurveTo(X(11.5), Y(L.mouthLat - 10), X(10), Y(L.chinLat + 2)); ctx.lineTo(X(8.5), Y(L.chinLat + 3)); ctx.quadraticCurveTo(X(9.5), Y(L.mouthLat - 8), X(8), Y(L.mouthLat - 1)); ctx.fill();
    // veins at the temples
    ctx.strokeStyle = ancient ? 'rgba(80,40,110,0.55)' : 'rgba(80,70,140,0.28)'; ctx.lineWidth = 1.2;
    for (const sd of [-1, 1]) for (let k = 0; k < (ancient ? 7 : 3); k++) {
      ctx.beginPath(); let lo = sd * (42 + rnd() * 20), la = 30 + rnd() * 20; ctx.moveTo(X(lo), Y(la));
      for (let j = 0; j < 5; j++) { lo += sd * (rnd() * 4); la -= 3 + rnd() * 4; ctx.lineTo(X(lo), Y(la)); }
      ctx.stroke();
    }
    // hair: slick black, swept back, with a sharp widow's peak
    if (L.hairLat < 90) {
      ctx.fillStyle = '#0b0a0d';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, Y(L.hairLat - 30));
      // back and sides (cover the back of the skull down to the nape)
      for (let lon = 180 + 90; lon >= -90; lon -= 3) {
        const a = ((lon + 180) % 360) - 180;
        const aa = Math.abs(a);
        let lat;
        if (aa < 30) lat = L.hairLat - 8 * Math.max(0, 1 - aa / 8) + aa * 0.1; // widow's peak
        else if (aa < 80) lat = L.hairLat + 2 - (aa - 30) * 0.5; // recede over the temples, then down to the ears
        else lat = -10; // sideburn / back
        const x = (0.25 + lon / 360) * W;
        ctx.lineTo(x, Y(lat));
      }
      ctx.lineTo(0, Y(L.hairLat - 30)); ctx.closePath(); ctx.fill();
      // comb lines / sheen
      ctx.strokeStyle = 'rgba(120,120,140,0.18)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 70; i++) { const x0 = rnd() * W; ctx.beginPath(); ctx.moveTo(x0, Y(L.hairLat - 4)); ctx.lineTo(x0 + (rnd() - 0.5) * 30, Y(80)); ctx.stroke(); }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  });
}

/** Point on the sculpted surface for a (lat, lon) landmark, in head-mesh local units (before mesh scale). */
function surfacePoint(lat, lon, ancient, inset = 0) {
  const L = landmarks(ancient);
  const r = relief(lat, lon, L) * 0.5 - inset;
  const v = new THREE.Vector3(Math.sin(lon * D) * Math.cos(lat * D), Math.sin(lat * D), Math.cos(lon * D) * Math.cos(lat * D)).multiplyScalar(r);
  if (v.z < 0) v.z *= 1.06;
  return v;
}

export function buildVampireHead(headGroup, { ancient = false, eyeColor = 0xff2418 } = {}) {
  const L = landmarks(ancient);
  const skin = std({ map: faceTexture(ancient), roughness: 0.55, emissive: 0x06070a });
  const S = ancient ? new THREE.Vector3(0.18, 0.28, 0.235) : new THREE.Vector3(0.168, 0.252, 0.225);
  const head = mesh(headGeometry(ancient), skin, headGroup, { s: [S.x, S.y, S.z], p: [0, 0.05, 0] });
  const toLocal = (v) => new THREE.Vector3(v.x * S.x, v.y * S.y + 0.05, v.z * S.z);

  // eyes: dark bloodshot sclera with a small glowing iris and pupil, set deep in the sockets
  const sclera = new THREE.MeshStandardMaterial({ color: 0x3a1418, roughness: 0.15, metalness: 0.1 });
  const irisMat = new THREE.MeshBasicMaterial({ color: eyeColor, fog: false });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050002 });
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: eyeColor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45, fog: false });
  const eyes = [];
  for (const sd of [-1, 1]) {
    const c = toLocal(surfacePoint(L.eyeLat, sd * L.eyeLon, ancient, 0.035));
    const e = mesh(prim.sphere, sclera, headGroup, { s: 0.022, p: [c.x, c.y, c.z], shadow: false });
    const fwd = toLocal(surfacePoint(L.eyeLat, sd * (L.eyeLon - 2), ancient, 0.012));
    const iris = mesh(prim.sphereLow, irisMat, headGroup, { s: [0.009, 0.009, 0.004], p: [fwd.x, fwd.y, fwd.z], shadow: false });
    const pupil = mesh(prim.sphereLow, pupilMat, headGroup, { s: [0.0025, 0.006, 0.002], p: [fwd.x, fwd.y, fwd.z + 0.002], shadow: false });
    const sp = new THREE.Sprite(glowMat); sp.scale.setScalar(ancient ? 0.05 : 0.04); sp.position.copy(fwd); headGroup.add(sp);
    eyes.push(e, iris, pupil, sp);
  }

  // fangs just below the upper lip, small incisors between them
  const bone = std({ color: 0xf2ece0, roughness: 0.25 });
  const m = toLocal(surfacePoint(L.mouthLat + 0.5, 0, ancient, 0.004));
  for (const sd of [-1, 1]) mesh(prim.cone, bone, headGroup, { s: [0.0045, 0.016, 0.0045], p: [sd * 0.0105, m.y - 0.006, m.z - 0.003], r: [Math.PI + 0.1, 0, 0], shadow: false });
  // jaw: a dark mouth opening that grows as the jaw drops (attacks / hissing)
  const jaw = group(headGroup, [0, m.y + 0.001, m.z - 0.006]);
  const mouthM = new THREE.MeshBasicMaterial({ color: 0x140205 });
  mesh(prim.sphere, mouthM, jaw, { s: [0.026, 0.0025, 0.006], p: [0, -0.002, 0], shadow: false });

  // pointed, swept-back ears
  const earG = cached('vampEar2', () => {
    const g = new THREE.SphereGeometry(0.5, 14, 10);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.z *= 0.22; if (v.y > 0) { v.x *= 1 - v.y * 1.25; v.y *= 2.3; v.z -= v.y * 0.25; } p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    return g;
  });
  for (const sd of [-1, 1]) {
    const e = toLocal(surfacePoint(2, sd * 86, ancient, 0.01));
    mesh(earG, skin, headGroup, { s: ancient ? [0.07, 0.085, 0.07] : [0.042, 0.055, 0.05], p: [e.x, e.y, e.z - 0.005], r: [-0.3, sd * 0.35, sd * -0.35], shadow: false });
  }
  return { head, eyes, jaw, skin };
}
