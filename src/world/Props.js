import * as THREE from 'three';
import { Geo } from './Materials.js';

/** Furniture and decoration builders. All take the WorldBuilder `b` and world coordinates. */

export function table(b, x, baseY, z, w = 2, d = 1, h = 0.8, rotY = 0) {
  const m = b.m;
  b.box(w, 0.08, d, m.darkwood, x, baseY + h, z, { rotY, flags: { decor: true } });
  const lx = w / 2 - 0.08, lz = d / 2 - 0.08;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = x + Math.cos(rotY) * sx * lx - Math.sin(rotY) * sz * lz;
    const pz = z + Math.sin(rotY) * sx * lx + Math.cos(rotY) * sz * lz;
    b.box(0.08, h, 0.08, m.darkwood, px, baseY + h / 2, pz, { collide: false, castShadow: false });
  }
  b.collider(x, baseY + h / 2, z, Math.abs(Math.cos(rotY)) * w + Math.abs(Math.sin(rotY)) * d, h, Math.abs(Math.sin(rotY)) * w + Math.abs(Math.cos(rotY)) * d, { decor: true });
}

export function chair(b, x, baseY, z, rotY = 0, broken = false) {
  const m = b.m;
  const g = new THREE.Group();
  const seat = new THREE.Mesh(Geo.box, m.darkwood); seat.scale.set(0.45, 0.06, 0.45); seat.position.y = 0.45; g.add(seat);
  const back = new THREE.Mesh(Geo.box, m.darkwood); back.scale.set(0.45, 0.5, 0.05); back.position.set(0, 0.72, -0.2); g.add(back);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(Geo.box, m.darkwood); l.scale.set(0.05, 0.45, 0.05); l.position.set(sx * 0.19, 0.225, sz * 0.19); g.add(l); }
  g.position.set(x, baseY, z); g.rotation.y = rotY;
  if (broken) { g.rotation.z = Math.PI / 2 * 0.9; g.position.y = baseY + 0.25; }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  b.group.add(g);
  if (!broken) b.collider(x, baseY + 0.4, z, 0.5, 0.8, 0.5, { decor: true });
}

export function bookshelf(b, x, baseY, z, w = 2, h = 3, rotY = 0) {
  const m = b.m;
  const depth = 0.4;
  b.box(w, h, depth, m.darkwood, x, baseY + h / 2, z, { rotY, flags: { decor: true } });
  // books: coloured strips
  const cols = [0x3a2a24, 0x2a3a44, 0x4a2a2a, 0x2a2a1a, 0x3a3a4a];
  if (!b._bookMats) b._bookMats = cols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  const shelves = Math.floor(h / 0.45);
  for (let s = 0; s < shelves; s++) {
    let u = -w / 2 + 0.08;
    while (u < w / 2 - 0.1) {
      const bw = 0.05 + Math.random() * 0.1, bh = 0.2 + Math.random() * 0.15;
      if (Math.random() < 0.82) {
        const mat = b._bookMats[Math.floor(Math.random() * cols.length)];
        const bk = new THREE.Mesh(Geo.box, mat); bk.scale.set(bw, bh, 0.25);
        const lx = u + bw / 2, ly = baseY + s * 0.45 + 0.1 + bh / 2, lz = depth / 2 + 0.01;
        bk.position.set(x + Math.cos(rotY) * lx + Math.sin(rotY) * lz, ly, z - Math.sin(rotY) * lx + Math.cos(rotY) * lz);
        bk.rotation.y = rotY; bk.castShadow = false; bk.receiveShadow = true;
        b.group.add(bk);
      }
      u += bw + 0.01;
    }
  }
}

export function painting(b, x, y, z, rotY, w = 1.2, h = 1.5, idx = 0) {
  const m = b.m;
  const frame = new THREE.Mesh(Geo.box, m.darkwood); frame.scale.set(w + 0.12, h + 0.12, 0.06);
  frame.position.set(x, y, z); frame.rotation.y = rotY; frame.castShadow = false;
  b.group.add(frame);
  const pic = new THREE.Mesh(Geo.plane, m.paintings[idx % m.paintings.length]); pic.scale.set(w, h, 1);
  pic.position.set(x + Math.sin(rotY) * 0.04, y, z + Math.cos(rotY) * 0.04); pic.rotation.y = rotY; pic.castShadow = false;
  b.group.add(pic);
  b.scareSpots.push({ pos: new THREE.Vector3(x, y, z), type: 'painting', dir: new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)), mesh: pic });
}

export function mirror(b, x, y, z, rotY, w = 1.0, h = 1.6) {
  const m = b.m;
  const frame = new THREE.Mesh(Geo.box, m.metal); frame.scale.set(w + 0.1, h + 0.1, 0.05); frame.position.set(x, y, z); frame.rotation.y = rotY; b.group.add(frame);
  const glass = new THREE.Mesh(Geo.plane, new THREE.MeshStandardMaterial({ color: 0x7a8696, roughness: 0.05, metalness: 0.95 }));
  glass.scale.set(w, h, 1); glass.position.set(x + Math.sin(rotY) * 0.03, y, z + Math.cos(rotY) * 0.03); glass.rotation.y = rotY; glass.castShadow = false;
  b.group.add(glass);
  b.scareSpots.push({ pos: new THREE.Vector3(x, y, z), type: 'mirror', dir: new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)), mesh: glass });
}

export function bed(b, x, baseY, z, rotY = 0) {
  const m = b.m;
  b.box(1.6, 0.4, 2.1, m.darkwood, x, baseY + 0.2, z, { rotY, flags: { decor: true } });
  b.box(1.5, 0.2, 2.0, m.cloth, x, baseY + 0.5, z, { rotY, collide: false });
  b.box(1.2, 0.15, 0.5, m.candle, x - Math.sin(rotY) * 0.75, baseY + 0.65, z - Math.cos(rotY) * 0.75, { rotY, collide: false, castShadow: false });
  b.box(1.6, 1.2, 0.1, m.darkwood, x - Math.sin(rotY) * 1.05, baseY + 0.6, z - Math.cos(rotY) * 1.05, { rotY, collide: false });
}

export function wardrobe(b, x, baseY, z, rotY = 0) {
  const m = b.m;
  b.box(1.4, 2.3, 0.7, m.darkwood, x, baseY + 1.15, z, { rotY, flags: { decor: true } });
  b.box(0.04, 2.1, 0.02, m.metal, x + Math.cos(rotY) * 0.0 + Math.sin(rotY) * 0.36, baseY + 1.15, z + Math.cos(rotY) * 0.36, { rotY, collide: false, castShadow: false });
}

export function sofa(b, x, baseY, z, rotY = 0) {
  const m = b.m;
  b.box(2.2, 0.5, 0.9, m.cloth, x, baseY + 0.25, z, { rotY, flags: { decor: true } });
  b.box(2.2, 0.6, 0.25, m.cloth, x - Math.sin(rotY) * 0.33, baseY + 0.8, z - Math.cos(rotY) * 0.33, { rotY, collide: false });
  for (const s of [-1, 1]) b.box(0.25, 0.3, 0.9, m.cloth, x + Math.cos(rotY) * s * 0.98, baseY + 0.65, z - Math.sin(rotY) * s * 0.98, { rotY, collide: false });
}

export function fireplace(b, x, baseY, z, rotY = 0, lit = true) {
  const m = b.m;
  // facing direction is +z local (rotY rotates)
  b.box(2.6, 1.6, 0.8, m.stoneDark, x, baseY + 0.8, z, { rotY, flags: { decor: true } });
  b.box(2.8, 0.15, 0.9, m.marble, x, baseY + 1.65, z, { rotY, collide: false });
  const ox = Math.sin(rotY) * 0.42, oz = Math.cos(rotY) * 0.42;
  b.box(1.4, 1.1, 0.1, new THREE.MeshStandardMaterial({ color: 0x050505 }), x + ox, baseY + 0.6, z + oz, { rotY, collide: false, castShadow: false });
  if (lit) {
    const ember = new THREE.Mesh(Geo.sphereLow, new THREE.MeshBasicMaterial({ color: 0xff5a1a }));
    ember.scale.set(0.5, 0.2, 0.3); ember.position.set(x + ox * 1.1, baseY + 0.15, z + oz * 1.1); ember.castShadow = false;
    b.group.add(ember); b.emissiveFlicker.push({ mesh: ember, base: 1 });
    b.light(x + ox * 1.6, baseY + 0.6, z + oz * 1.6, 0xff6a20, 2.4, 10, { flicker: 0.6, speed: 5 });
  }
}

export function piano(b, x, baseY, z, rotY = 0) {
  const m = b.m;
  b.box(1.5, 1.2, 0.6, m.clothDark, x, baseY + 0.6, z, { rotY, flags: { decor: true } });
  b.box(1.4, 0.06, 0.3, m.candle, x + Math.sin(rotY) * 0.4, baseY + 0.75, z + Math.cos(rotY) * 0.4, { rotY, collide: false, castShadow: false });
}

export function chandelier(b, x, y, z, scale = 1) {
  const m = b.m;
  b.box(0.04, 3, 0.04, m.ironDark, x, y + 1.5, z, { collide: false, castShadow: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 * scale, 0.05, 6, 16), m.ironDark); ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z); b.group.add(ring); b.dynamic.push(ring);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    b.candle(x + Math.cos(a) * 0.9 * scale, y, z + Math.sin(a) * 0.9 * scale, 0.9);
  }
  const vl = b.light(x, y + 0.3, z, 0xffb060, 3.5, 16, { flicker: 0.4, speed: 2, important: true });
  // swinging
  b.animated.push({ update: (dt, t) => { ring.position.x = x + Math.sin(t * 0.7) * 0.08; vl.pos.x = ring.position.x; } });
}

export function clock(b, x, baseY, z, rotY = 0) {
  const m = b.m;
  b.box(0.6, 2.2, 0.4, m.darkwood, x, baseY + 1.1, z, { rotY, flags: { decor: true } });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), m.candle); face.position.set(x + Math.sin(rotY) * 0.21, baseY + 1.8, z + Math.cos(rotY) * 0.21); face.rotation.y = rotY; face.castShadow = false; b.group.add(face);
}

export function barrel(b, x, baseY, z) {
  const m = b.m;
  b.mesh(Geo.cyl, m.darkwood, x, baseY + 0.45, z, { scale: new THREE.Vector3(0.7, 0.9, 0.7), collideSize: new THREE.Vector3(0.7, 0.9, 0.7), flags: { decor: true } });
  b.mesh(new THREE.TorusGeometry(0.36, 0.02, 4, 12), m.metal, x, baseY + 0.25, z, { rot: { x: Math.PI / 2 }, castShadow: false });
  b.mesh(new THREE.TorusGeometry(0.36, 0.02, 4, 12), m.metal, x, baseY + 0.7, z, { rot: { x: Math.PI / 2 }, castShadow: false });
}

export function crate(b, x, baseY, z, s = 0.8, rotY = 0) {
  b.box(s, s, s, b.m.planks, x, baseY + s / 2, z, { rotY, flags: { decor: true } });
}

export function cage(b, x, baseY, z, w = 2, h = 2.4, d = 2, doorSide = 'z+') {
  const m = b.m;
  const bar = 0.05;
  for (const [ax, sign] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
    const side = `${ax}${sign > 0 ? '+' : '-'}`;
    const len = ax === 'x' ? d : w;
    const n = Math.floor(len / 0.3);
    for (let i = 0; i <= n; i++) {
      const u = -len / 2 + i * (len / n);
      if (side === doorSide && Math.abs(u) < 0.45) continue;
      const px = ax === 'x' ? x + sign * w / 2 : x + u;
      const pz = ax === 'x' ? z + u : z + sign * d / 2;
      b.box(bar, h, bar, m.ironDark, px, baseY + h / 2, pz, { collide: false, castShadow: false });
    }
    // top/bottom rails + collider
    const cx = ax === 'x' ? x + sign * w / 2 : x, cz = ax === 'x' ? z : z + sign * d / 2;
    b.box(ax === 'x' ? bar : w, bar, ax === 'x' ? d : bar, m.ironDark, cx, baseY + h, cz, { collide: false, castShadow: false });
    if (side !== doorSide) b.collider(cx, baseY + h / 2, cz, ax === 'x' ? 0.1 : w, h, ax === 'x' ? d : 0.1, {});
    else {
      // two colliders leaving the gap
      const gap = 0.9;
      const segLen = (len - gap) / 2;
      if (ax === 'x') { b.collider(cx, baseY + h / 2, z - gap / 2 - segLen / 2, 0.1, h, segLen); b.collider(cx, baseY + h / 2, z + gap / 2 + segLen / 2, 0.1, h, segLen); }
      else { b.collider(x - gap / 2 - segLen / 2, baseY + h / 2, cz, segLen, h, 0.1); b.collider(x + gap / 2 + segLen / 2, baseY + h / 2, cz, segLen, h, 0.1); }
    }
  }
}

export function altar(b, x, baseY, z) {
  const m = b.m;
  b.box(2.0, 1.0, 1.0, m.stoneDark, x, baseY + 0.5, z, { flags: { decor: true } });
  b.decal(m.symbol, x, baseY + 1.0, z, 1.6);
  b.decal(m.blood, x, baseY + 1.0, z, 1.4, 0.4);
  b.candle(x - 0.8, baseY + 1.0, z - 0.3, 1.2); b.candle(x + 0.8, baseY + 1.0, z - 0.3, 1.2); b.candle(x, baseY + 1.0, z + 0.35, 1.0);
  b.light(x, baseY + 2.0, z, 0xff2020, 1.8, 10, { flicker: 0.5, speed: 2, important: true });
  // skull
  const skull = new THREE.Mesh(Geo.sphere, m.bone); skull.scale.set(0.22, 0.2, 0.25); skull.position.set(x + 0.3, baseY + 1.12, z); b.group.add(skull);
}

export function skeleton(b, x, baseY, z, rotY = 0) {
  const m = b.m;
  const g = new THREE.Group();
  const skull = new THREE.Mesh(Geo.sphere, m.bone); skull.scale.set(0.2, 0.18, 0.22); skull.position.set(0, 0.11, 0); g.add(skull);
  for (let i = 0; i < 6; i++) { const rib = new THREE.Mesh(Geo.box, m.bone); rib.scale.set(0.35 - i * 0.03, 0.03, 0.03); rib.position.set(0, 0.03, 0.3 + i * 0.09); g.add(rib); }
  const spine = new THREE.Mesh(Geo.box, m.bone); spine.scale.set(0.04, 0.04, 0.9); spine.position.set(0, 0.03, 0.65); g.add(spine);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(Geo.box, m.bone); leg.scale.set(0.04, 0.04, 0.6); leg.position.set(s * 0.12, 0.03, 1.4); leg.rotation.y = s * 0.2; g.add(leg); }
  g.position.set(x, baseY, z); g.rotation.y = rotY;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  b.group.add(g);
  b.decal(m.blood, x, baseY, z + 0.5, 1.6, rotY);
}

export function chains(b, x, y, z, count = 3) {
  for (let i = 0; i < count; i++) {
    const len = 0.8 + Math.random() * 1.0;
    b.box(0.05, len, 0.05, b.m.ironDark, x + (Math.random() - 0.5) * 1.2, y - len / 2, z + (Math.random() - 0.5) * 0.4, { collide: false, castShadow: false });
  }
}

export function column(b, x, baseY, z, h = 4, r = 0.3, material) {
  b.mesh(Geo.cyl, material || b.m.stone, x, baseY + h / 2, z, { scale: new THREE.Vector3(r * 2, h, r * 2), collideSize: new THREE.Vector3(r * 2, h, r * 2) });
  b.box(r * 2.6, 0.2, r * 2.6, material || b.m.stone, x, baseY + h - 0.1, z, { collide: false });
  b.box(r * 2.6, 0.2, r * 2.6, material || b.m.stone, x, baseY + 0.1, z, { collide: false });
}

export function coffin(b, x, baseY, z, rotY = 0, open = false) {
  const m = b.m;
  b.box(0.8, 0.5, 2.0, m.darkwood, x, baseY + 0.25, z, { rotY, flags: { decor: true } });
  if (open) {
    b.box(0.8, 0.06, 2.0, m.darkwood, x + Math.cos(rotY) * 0.75, baseY + 0.6, z - Math.sin(rotY) * 0.75, { rotY: rotY + 0.0, collide: false });
  } else b.box(0.82, 0.06, 2.02, m.darkwood, x, baseY + 0.53, z, { rotY, collide: false });
}

export function statue(b, x, baseY, z, rotY = 0, broken = false) {
  const m = b.m;
  b.box(1.2, 0.5, 1.2, m.stone, x, baseY + 0.25, z, { flags: { decor: true } });
  const g = new THREE.Group();
  const body = new THREE.Mesh(Geo.box, m.stone); body.scale.set(0.5, 1.3, 0.35); body.position.y = 0.65; g.add(body);
  const robe = new THREE.Mesh(Geo.cone, m.stone); robe.scale.set(0.9, 1.0, 0.7); robe.position.y = 0.5; g.add(robe);
  if (!broken) { const head = new THREE.Mesh(Geo.sphere, m.stone); head.scale.setScalar(0.3); head.position.y = 1.45; g.add(head); }
  const wingL = new THREE.Mesh(Geo.box, m.stone); wingL.scale.set(0.08, 1.0, 0.6); wingL.position.set(-0.32, 0.9, -0.15); wingL.rotation.z = 0.3; g.add(wingL);
  if (!broken) { const wingR = wingL.clone(); wingR.position.x = 0.32; wingR.rotation.z = -0.3; g.add(wingR); }
  g.position.set(x, baseY + 0.5, z); g.rotation.y = rotY;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  b.group.add(g);
  b.collider(x, baseY + 1.3, z, 0.7, 1.6, 0.6, { decor: true });
  b.scareSpots.push({ pos: new THREE.Vector3(x, baseY + 1.5, z), type: 'statue', dir: new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)), mesh: g });
}

export function deadTree(b, x, baseY, z, scale = 1) {
  const m = b.m;
  const h = 6 * scale;
  b.mesh(Geo.cyl, m.bark, x, baseY + h / 2, z, { scale: new THREE.Vector3(0.5 * scale, h, 0.5 * scale), collideSize: new THREE.Vector3(0.5 * scale, h, 0.5 * scale) });
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + Math.random();
    const br = new THREE.Mesh(Geo.cyl, m.bark);
    br.scale.set(0.12 * scale, 2.5 * scale, 0.12 * scale);
    br.position.set(x + Math.cos(a) * 0.8 * scale, baseY + h * (0.6 + i * 0.1), z + Math.sin(a) * 0.8 * scale);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    br.castShadow = true; b.group.add(br);
  }
}

export function fenceSegment(b, x1, z1, x2, z2, h = 1.8, broken = false) {
  const m = b.m;
  const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const cy = Math.max(b.physics.terrainHeight(x1, z1), b.physics.terrainHeight(x2, z2));
  // rails
  b.box(len, 0.06, 0.06, m.ironDark, cx, cy + h - 0.1, cz, { rotY: -ang, collide: false, castShadow: false });
  b.box(len, 0.06, 0.06, m.ironDark, cx, cy + 0.4, cz, { rotY: -ang, collide: false, castShadow: false });
  const n = Math.floor(len / 0.35);
  for (let i = 0; i <= n; i++) {
    if (broken && i > n * 0.3 && i < n * 0.6) continue;
    const t = i / n;
    const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
    const bh = broken && Math.random() < 0.3 ? h * 0.5 : h;
    b.box(0.05, bh, 0.05, m.ironDark, px, cy + bh / 2, pz, { collide: false, castShadow: false });
    if (i % 2 === 0) { const tip = new THREE.Mesh(Geo.cone, m.ironDark); tip.scale.set(0.1, 0.2, 0.1); tip.position.set(px, cy + bh + 0.1, pz); tip.castShadow = false; b.group.add(tip); }
  }
  if (!broken) {
    const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang));
    b.collider(cx, cy + h / 2, cz, len * c + 0.2 * s, h, len * s + 0.2 * c, {});
  } else {
    // collide only the intact ends
    const seg = (ta, tb) => { const ax = x1 + (x2 - x1) * ta, az = z1 + (z2 - z1) * ta, bx = x1 + (x2 - x1) * tb, bz = z1 + (z2 - z1) * tb; const l = Math.hypot(bx - ax, bz - az); const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang)); b.collider((ax + bx) / 2, cy + h / 2, (az + bz) / 2, l * c + 0.2 * s, h, l * s + 0.2 * c, {}); };
    seg(0, 0.3); seg(0.6, 1);
  }
}

export function stoneWall(b, x1, z1, x2, z2, h = 2.2, thickness = 0.5) {
  const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const cy = Math.max(b.physics.terrainHeight(x1, z1), b.physics.terrainHeight(x2, z2), b.physics.terrainHeight(cx, cz));
  b.box(len, h + 1.5, thickness, b.m.stoneDark, cx, cy - 1.5 + (h + 1.5) / 2, cz, { rotY: -ang });
}

export function gravestoneGeometries() {
  const g1 = new THREE.BoxGeometry(0.7, 1.0, 0.15);
  const g2 = new THREE.CylinderGeometry(0.35, 0.35, 0.15, 12, 1, false, 0, Math.PI);
  g2.rotateX(Math.PI / 2); g2.rotateY(Math.PI / 2); g2.translate(0, 0.5, 0);
  const rounded = mergeSimple([g1, g2]);
  const cross = mergeSimple([new THREE.BoxGeometry(0.18, 1.5, 0.15), new THREE.BoxGeometry(0.7, 0.18, 0.15).translate(0, 0.45, 0)]);
  const slab = new THREE.BoxGeometry(0.9, 0.3, 1.9);
  const obelisk = mergeSimple([new THREE.BoxGeometry(0.6, 0.4, 0.6), new THREE.CylinderGeometry(0.1, 0.25, 2.0, 4).translate(0, 1.2, 0)]);
  return [rounded, cross, slab, obelisk];
}

/** Minimal geometry merge (same attribute layout: position + normal + uv, non-indexed). */
export function mergeSimple(geos) {
  const parts = geos.map((g) => g.index ? g.toNonIndexed() : g);
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
