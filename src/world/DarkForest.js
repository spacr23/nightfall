import * as THREE from 'three';
import { Geo } from './Materials.js';
import * as P from './Props.js';
import { pathRibbon, makePathMaterial, PathIndex } from './Paths.js';
import { mergeSimple } from './Props.js';
import { WORLD } from './WorldConfig.js';

/**
 * The dark forest surrounds the grounds on every side. Central (non-forest) rect: x -50..50, z -102..86.
 * Paths connect the cemetery gates and the mansion's back door through the woods.
 */
const CLEARINGS = [
  { x: 125, z: 0, r: 17, name: 'arena' },
  { x: 62, z: -32, r: 9 },
  { x: -82, z: -22, r: 10 },
  { x: 100, z: 100, r: 8 },
  { x: -140, z: 60, r: 10 },
  { x: 142, z: -104, r: 7, name: 'hollow' },
  { x: -40, z: 124, r: 8 },
  { x: 40, z: -122, r: 8 },
];
const STRUCTURES = [
  { x: 88, z: 60.5, r: 9 }, { x: -126, z: -72, r: 9 }, { x: -70, z: 110, r: 9 }, { x: -118, z: 4, r: 9 },
];

export function inForest(x, z) {
  return !(x > -50 && x < 50 && z > -102 && z < 86);
}

export function buildForest(b) {
  const m = b.m;
  const th = (x, z) => b.physics.terrainHeight(x, z);
  const dirtMat = makePathMaterial(m.dirt);

  // ------------------------------------------------------------- paths
  const paths = [
    [[46, 46], [60, 44], [75, 36], [92, 22], [108, 8], [120, 2]],
    [[125, -14], [118, -40], [100, -64], [76, -86], [50, -104], [25, -108], [0, -104]],
    [[-9, -86], [-6, -96], [0, -104]],
    [[-9, -86], [-14, -96], [-30, -108], [-60, -104], [-88, -86], [-112, -56], [-120, -20], [-112, 8], [-90, 32], [-68, 44], [-46, 46]],
    [[20, 86], [10, 98], [-8, 112], [-34, 120], [-58, 114], [-66, 110]],
    [[10, 98], [34, 108], [62, 104], [84, 80], [88, 66]],
    [[75, 36], [84, 50], [88, 56]],
    [[-120, -20], [-100, -24], [-82, -22], [-70, -10], [-56, 0]],
    [[-112, -56], [-120, -64], [-124, -68]],
    [[62, -32], [80, -20], [100, -64]],
    [[62, -32], [52, -12], [48, 0]],
    [[100, -64], [124, -90], [140, -102]],
    [[-112, 8], [-130, 30], [-140, 56]],
  ];
  const ribbons = paths.map((pts) => pathRibbon(b, pts, 2.6, dirtMat));
  b.forestPaths = ribbons;
  const index = new PathIndex(b.pathSamples);
  b.pathIndex = index;

  // ------------------------------------------------------------- structures
  cabin(b, 88, 60.5, 'w');
  cabin(b, -126, -72, 'e');
  cabin(b, -70, 110, 'n');
  shelter(b, -118, 4);
  arena(b, 125, 0);
  hollowTree(b, 142, -104);
  ruinedGate(b, 52, 45, true);
  ruinedGate(b, -52, 45, true);
  ruinedGate(b, 0, -103, false);

  // ------------------------------------------------------------- trees (instanced, chunked)
  const pineGeo = buildPineGeometry();
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 7); trunkGeo.translate(0, 0.5, 0);
  const deadGeo = buildDeadTreeGeometry();
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x2c4234, roughness: 1, flatShading: true });
  const chunks = new Map();
  const add = (type, mat4, x, z) => {
    const k = `${Math.floor(x / 60)},${Math.floor(z / 60)}`;
    let c = chunks.get(k); if (!c) { c = { pine: [], trunk: [], dead: [], rock: [], bush: [] }; chunks.set(k, c); }
    c[type].push(mat4);
  };
  const occ = new Set();
  const occKey = (x, z) => `${Math.floor(x / 2.6)},${Math.floor(z / 2.6)}`;
  const clear = (x, z, margin) =>
    CLEARINGS.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + margin) ** 2) ||
    STRUCTURES.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + margin) ** 2);
  const tmp = new THREE.Object3D();
  let treeCount = 0;
  const B = WORLD;
  for (let i = 0; i < 9000 && treeCount < 1500; i++) {
    const x = B.minX + 3 + Math.random() * (B.maxX - B.minX - 6);
    const z = B.minZ + 3 + Math.random() * (B.maxZ - B.minZ - 6);
    const forest = inForest(x, z);
    // sparse dead trees on the grounds around the mansion (not on the cemetery / driveway / house)
    const grounds = !forest && !(x > -48 && x < 48 && z > 6 && z < 84) && !(x > -9 && x < 9 && z > -60 && z < 10) && !(x > -20 && x < 20 && z > -92 && z < -54);
    if (!forest && !(grounds && Math.random() < 0.06)) continue;
    if (index.near(x, z, 2.2) || clear(x, z, 1.5)) continue;
    const k = occKey(x, z);
    if (occ.has(k)) continue;
    occ.add(k);
    const y = th(x, z);
    const dead = !forest || Math.random() < 0.22;
    const s = 0.8 + Math.random() * 0.8;
    tmp.position.set(x, y - 0.2, z);
    tmp.rotation.set((Math.random() - 0.5) * 0.08, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.08);
    if (dead) {
      tmp.scale.set(s, s * (0.9 + Math.random() * 0.4), s);
      tmp.updateMatrix(); add('dead', tmp.matrix.clone(), x, z);
      b.collider(x, y + 3, z, 0.55 * s, 6, 0.55 * s);
    } else {
      const h = 8 + Math.random() * 9;
      tmp.scale.set(s, h, s);
      tmp.updateMatrix(); add('trunk', tmp.matrix.clone(), x, z);
      tmp.scale.set(s * (0.9 + Math.random() * 0.3), h / 12, s * (0.9 + Math.random() * 0.3));
      tmp.position.y = y;
      tmp.updateMatrix(); add('pine', tmp.matrix.clone(), x, z);
      b.collider(x, y + 3, z, 0.6 * s, 6, 0.6 * s);
    }
    treeCount++;
  }
  // bushes & rocks
  for (let i = 0; i < 1400; i++) {
    const x = B.minX + Math.random() * (B.maxX - B.minX), z = B.minZ + Math.random() * (B.maxZ - B.minZ);
    if (!inForest(x, z) || index.near(x, z, 0.8) || clear(x, z, 0)) continue;
    const y = th(x, z);
    if (Math.random() < 0.15) {
      const s = 0.6 + Math.random() * 1.6;
      tmp.position.set(x, y + s * 0.25, z); tmp.rotation.set(Math.random(), Math.random() * 6, Math.random()); tmp.scale.set(s * 1.3, s, s * 1.1);
      tmp.updateMatrix(); add('rock', tmp.matrix.clone(), x, z);
      b.collider(x, y + s * 0.4, z, s * 1.1, s * 0.8, s * 0.9);
    } else {
      const s = 0.8 + Math.random() * 1.4;
      tmp.position.set(x, y + s * 0.3, z); tmp.rotation.set(0, Math.random() * 6, 0); tmp.scale.set(s * 1.6, s * 0.9, s * 1.4);
      tmp.updateMatrix(); add('bush', tmp.matrix.clone(), x, z);
    }
  }
  const mats = { pine: pineMat, trunk: m.bark, dead: m.bark, rock: m.rock, bush: m.bush };
  const geos = { pine: pineGeo, trunk: trunkGeo, dead: deadGeo, rock: Geo.dodeca, bush: Geo.ico };
  for (const c of chunks.values()) {
    for (const type in c) {
      const list = c[type]; if (!list.length) continue;
      const im = new THREE.InstancedMesh(geos[type], mats[type], list.length);
      list.forEach((mat, i) => im.setMatrixAt(i, mat));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = type !== 'bush';
      im.receiveShadow = true;
      im.computeBoundingSphere();
      b.group.add(im);
    }
  }

  // Fallen logs (axis aligned so the collider matches)
  for (let i = 0; i < 70; i++) {
    const x = B.minX + 10 + Math.random() * (B.maxX - B.minX - 20), z = B.minZ + 10 + Math.random() * (B.maxZ - B.minZ - 20);
    if (!inForest(x, z) || index.near(x, z, 2.5) || clear(x, z, 2)) continue;
    const alongX = Math.random() < 0.5, len = 4 + Math.random() * 5, r = 0.35 + Math.random() * 0.2;
    const y = Math.max(th(x - (alongX ? len / 2 : 0), z - (alongX ? 0 : len / 2)), th(x + (alongX ? len / 2 : 0), z + (alongX ? 0 : len / 2)), th(x, z));
    b.mesh(Geo.cyl, m.bark, x, y + r * 0.8, z, { scale: new THREE.Vector3(r * 2, len, r * 2), rot: alongX ? { z: Math.PI / 2 } : { x: Math.PI / 2 } });
    b.collider(x, y + r * 0.5, z, alongX ? len : r * 2, r * 2.2, alongX ? r * 2 : len, { decor: true });
  }

  // Grass tufts (quality dependent)
  if (b.quality.grass > 0) {
    const n = 2500 * b.quality.grass;
    const g = new THREE.PlaneGeometry(0.6, 0.5); g.translate(0, 0.25, 0);
    const g2 = g.clone().rotateY(Math.PI / 2);
    const tuft = mergeSimple([g, g2]);
    const im = new THREE.InstancedMesh(tuft, m.grass, n);
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const x = -140 + Math.random() * 280, z = -125 + Math.random() * 250;
      if (x > -16 && x < 16 && z > -86 && z < -58) continue;
      const y = th(x, z);
      if (y < -0.5) continue;
      tmp.position.set(x, y, z); tmp.rotation.set(0, Math.random() * 6, 0); const s = 0.6 + Math.random() * 1.2; tmp.scale.set(s, s, s);
      tmp.updateMatrix(); im.setMatrixAt(k++, tmp.matrix);
    }
    im.count = k; im.castShadow = false; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    b.group.add(im);
  }

  // ------------------------------------------------------------- forest zone + spawn points
  b.zone('forest_e', 50, -140, 170, 140);
  b.zone('forest_w', -170, -140, -50, 140);
  b.zone('forest_n', -50, -140, 50, -102);
  b.zone('forest_s', -50, 86, 50, 140);
  for (const r of ribbons) {
    for (let i = 8; i < r.pts.length; i += 14) {
      const p = r.pts[i];
      if (!inForest(p.x, p.z)) continue;
      b.spawn('forest', p.x + (Math.random() - 0.5) * 3, p.z + (Math.random() - 0.5) * 3);
    }
  }
  for (const c of CLEARINGS) b.spawn('forest', c.x + c.r * 0.5, c.z);
  // a few grounds spawns between house and cemetery
  for (const [x, z] of [[-30, -40], [30, -40], [-36, -10], [36, -10], [-24, -60], [24, -60], [0, -96], [-40, -90], [40, -90]]) b.spawn('grounds', x, z);

  // lights: a couple of eerie will-o-wisps and lanterns along paths
  for (const [x, z, c] of [[70, 40, 0x6080ff], [-95, 30, 0x60ff90], [100, 100, 0x6080ff], [-140, 60, 0x60ff90], [40, -122, 0x8060ff]]) {
    const y = th(x, z) + 1.4;
    const orb = new THREE.Mesh(Geo.sphereLow, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8 }));
    orb.scale.setScalar(0.18); orb.position.set(x, y, z); b.group.add(orb); b.dynamic.push(orb);
    const vl = b.light(x, y, z, c, 1.4, 10, { flicker: 0.25, speed: 1.5 });
    const ph = Math.random() * 10;
    b.animated.push({ update: (dt, t) => { orb.position.y = y + Math.sin(t * 1.3 + ph) * 0.4; orb.position.x = x + Math.sin(t * 0.4 + ph) * 1.5; vl.pos.copy(orb.position); } });
  }
  b.pickup('ammo', 60, th(60, -30), -30, { weapon: 'rifle', amount: 30 });
  b.pickup('health', -82, th(-82, -18), -18, { amount: 40 });
  b.pickup('ammo', 100, th(100, 97), 97, { weapon: 'shotgun', amount: 8 });
  b.pickup('ammo', -40, th(-40, 121), 121, { weapon: 'any', amount: 30 });
  b.pickup('health', 40, th(40, -119), -119, { amount: 40 });
}

function buildPineGeometry() {
  const parts = [];
  const layers = [[2.6, 4.5, 3.2], [2.1, 4.0, 5.8], [1.5, 3.4, 8.2], [0.9, 2.6, 10.4]];
  for (const [r, h, y] of layers) { const c = new THREE.ConeGeometry(r, h, 7, 1); c.translate(0, y, 0); parts.push(c); }
  return mergeSimple(parts);
}

function buildDeadTreeGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.12, 0.32, 7, 6); trunk.translate(0, 3.5, 0); parts.push(trunk);
  for (let i = 0; i < 5; i++) {
    const br = new THREE.CylinderGeometry(0.03, 0.1, 2.6, 4);
    br.translate(0, 1.3, 0);
    br.rotateZ(0.7 + Math.random() * 0.5);
    br.rotateY(i * 1.3 + Math.random());
    br.translate(0, 3 + i * 0.75, 0);
    parts.push(br);
  }
  return mergeSimple(parts);
}

/** Log cabin with door facing `door` ('n','s','e','w'). 7 x 6 m. */
function cabin(b, cx, cz, door) {
  const m = b.m;
  const y = b.physics.terrainHeight(cx, cz);
  const W = 7, D = 6, H = 3.0;
  const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
  b.floorSlab(x0, z0, x1, z1, y + 0.25, 0.8, m.planks);
  const dOpen = (len) => [{ at: len / 2, width: 1.6, height: 2.3, type: 'door', open: Math.random() < 0.6 }];
  const wnd = (at) => ({ at, width: 1.0, height: 0.9, bottom: 1.1, type: 'window' });
  b.wall(x0, z0, x1, z0, H, 0.3, m.darkwood, { baseY: y + 0.25, openings: door === 'n' ? dOpen(W) : [wnd(1.8)] });
  b.wall(x0, z1, x1, z1, H, 0.3, m.darkwood, { baseY: y + 0.25, openings: door === 's' ? dOpen(W) : [wnd(5)] });
  b.wall(x0, z0, x0, z1, H, 0.3, m.darkwood, { baseY: y + 0.25, openings: door === 'w' ? dOpen(D) : [wnd(1.5)] });
  b.wall(x1, z0, x1, z1, H, 0.3, m.darkwood, { baseY: y + 0.25, openings: door === 'e' ? dOpen(D) : [wnd(4.5)] });
  // roof
  const slope = Math.atan2(1.8, 3.5);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(Geo.box, m.roof); r.scale.set(W + 1, 0.25, Math.hypot(1.8, 3.5) + 0.6);
    r.position.set(cx, y + 0.25 + H + 0.9, cz + s * 1.6); r.rotation.x = s * slope; r.castShadow = true; b.group.add(r);
  }
  b.box(W, 0.15, D, m.planks, cx, y + 0.25 + H + 0.05, cz, { castShadow: false });
  // interior
  const fy = y + 0.25;
  P.table(b, cx + 1.2, fy, cz - 1.2, 1.4, 0.8, 0.8);
  P.chair(b, cx + 1.2, fy, cz - 0.4, Math.PI, Math.random() < 0.5);
  P.bed(b, cx - 2.2, fy, cz + 1.2, Math.PI / 2);
  P.crate(b, cx + 2.6, fy, cz + 2.0, 0.7);
  b.lamp(cx + 1.2, fy + 1.05, cz - 1.2, 0xffb060, 1.8, 9, 0.5);
  b.decal(m.blood, cx - 0.5, fy, cz + 0.4, 1.8, Math.random() * 3);
  b.pickup(Math.random() < 0.5 ? 'ammo' : 'health', cx + 0.9, fy + 0.84, cz - 1.0, { weapon: 'any', amount: 30 });
  b.pickup('ammo', cx + 2.6, fy + 0.7, cz + 2.0, { weapon: 'any', amount: 20 });
  b.spawn('forest', cx, cz, fy);
  b.scareSpots.push({ pos: new THREE.Vector3(cx, fy + 1.6, cz), type: 'cabin', dir: new THREE.Vector3(0, 0, 1) });
}

/** Abandoned survivor shelter: log walls, sandbags, tarp, supply cache with the assault rifle. */
function shelter(b, cx, cz) {
  const m = b.m;
  const y = b.physics.terrainHeight(cx, cz);
  // sandbag ring (low walls you can shoot over)
  for (const [x1, z1, x2, z2] of [[-5, -5, 5, -5], [-5, 5, -1.2, 5], [1.2, 5, 5, 5], [-5, -5, -5, 5], [5, -5, 5, 1]]) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const alongX = Math.abs(x2 - x1) > 0.1;
    b.box(alongX ? len : 0.9, 1.1, alongX ? 0.9 : len, m.cloth, cx + (x1 + x2) / 2, y + 0.55, cz + (z1 + z2) / 2);
  }
  // lean-to roof on posts
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 1], [3, 1]]) b.box(0.2, 2.6, 0.2, m.bark, cx + x, y + 1.3, cz + z, { flags: { decor: true } });
  const tarp = new THREE.Mesh(Geo.box, new THREE.MeshStandardMaterial({ color: 0x2c3326, roughness: 1 }));
  tarp.scale.set(7, 0.05, 5); tarp.position.set(cx, y + 2.7, cz - 1); tarp.rotation.x = 0.12; tarp.castShadow = true; b.group.add(tarp);
  P.crate(b, cx - 2, y, cz - 2.5, 0.9); P.crate(b, cx - 1, y, cz - 2.5, 0.7, 0.4); P.barrel(b, cx + 2.4, y, cz - 2.6);
  P.table(b, cx + 1, y, cz - 1, 1.6, 0.8, 0.8);
  b.pickup('weapon', cx + 1, y + 0.84, cz - 1, { weapon: 'rifle', name: 'Assault Rifle' });
  b.pickup('note', cx + 0.4, y + 0.84, cz - 1.2, { text: 'Supply drop #3. Rifle and two mags. The wolves circle at night and the big one, the one with silver fur, keeps coming back to the stones in the east. Do not go there when the bells ring. I am going for help. If I am not back by dawn I am not coming back.' });
  b.pickup('armor', cx - 2, y + 0.9, cz - 2.5, { amount: 50 });
  // dying campfire
  const fire = new THREE.Mesh(Geo.sphereLow, new THREE.MeshBasicMaterial({ color: 0xff5010 }));
  fire.scale.set(0.5, 0.25, 0.5); fire.position.set(cx, y + 0.1, cz + 2.5); b.group.add(fire);
  b.emissiveFlicker.push({ mesh: fire, base: 1 });
  b.light(cx, y + 0.8, cz + 2.5, 0xff6020, 2.2, 11, { flicker: 0.5, speed: 4 });
  b.spawn('forest', cx + 8, cz);
}

/** Ritual stone circle in the eastern forest: the boss arena. */
function arena(b, cx, cz) {
  const m = b.m;
  const y = b.physics.terrainHeight(cx, cz);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    if (i === 6) continue; // gap toward the west path
    const x = cx + Math.cos(a) * 14, z = cz + Math.sin(a) * 14;
    const h = 3 + Math.random() * 2.5;
    b.box(1.2, h, 1.2, m.stoneDark, x, y + h / 2 - 0.3, z, { rotY: 0 });
    if (i % 3 === 0) b.box(1.4, 0.6, 3.8, m.stoneDark, x, y + h - 0.1, z, { collide: false, castShadow: true });
  }
  b.box(3, 0.8, 1.6, m.stoneDark, cx, y + 0.4, cz);
  b.decal(m.symbol, cx, y + 0.03, cz, 12);
  b.decal(m.blood, cx + 2, y + 0.03, cz - 1, 4, 0.5);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; b.candle(cx + Math.cos(a) * 5, y, cz + Math.sin(a) * 5, 1.4); }
  b.light(cx, y + 3, cz, 0xff1810, 2.6, 22, { flicker: 0.4, speed: 1, important: true });
  b.bossArena = new THREE.Vector3(cx, y, cz);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; b.spawn('forest', cx + Math.cos(a) * 9, cz + Math.sin(a) * 9); }
}

function hollowTree(b, cx, cz) {
  const m = b.m;
  const y = b.physics.terrainHeight(cx, cz);
  b.mesh(Geo.cyl, m.bark, cx, y + 4, cz, { scale: new THREE.Vector3(2.6, 8, 2.6), collideSize: new THREE.Vector3(2.4, 8, 2.4) });
  b.mesh(Geo.box, new THREE.MeshBasicMaterial({ color: 0x050403 }), cx + 1.2, y + 1.0, cz, { scale: new THREE.Vector3(0.3, 1.4, 0.9), castShadow: false });
  for (let i = 0; i < 6; i++) { const a = i * 1.1; const r = new THREE.Mesh(Geo.dodeca, m.rock); const s = 0.6 + Math.random(); r.scale.setScalar(s); r.position.set(cx + Math.cos(a) * 4, y + s * 0.2, cz + Math.sin(a) * 4); b.group.add(r); }
  b.secretWall(null, 'Search the hollow tree…', { x: cx + 1.8, y, z: cz + 0.3 });
}

function ruinedGate(b, cx, cz, alongZ) {
  const m = b.m;
  const y = b.physics.terrainHeight(cx, cz);
  for (const s of [-1, 1]) {
    const x = alongZ ? cx : cx + s * 2.8, z = alongZ ? cz + s * 2.8 : cz;
    b.box(1.0, 3.6 - (s > 0 ? 1.2 : 0), 1.0, m.stoneDark, x, y + (3.6 - (s > 0 ? 1.2 : 0)) / 2, z);
  }
  // broken lintel lying on the ground
  b.box(alongZ ? 0.8 : 4.2, 0.6, alongZ ? 4.2 : 0.8, m.stoneDark, cx + (alongZ ? 2 : 0), y + 0.3, cz + (alongZ ? 0 : 2), { rotY: 0.3, flags: { decor: true } });
  b.lamp(alongZ ? cx : cx - 2.8, y + 3.9, alongZ ? cz - 2.8 : cz, 0xff9050, 1.6, 10, 0.7);
}
