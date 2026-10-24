import * as THREE from 'three';
import { Geo } from './Materials.js';
import * as P from './Props.js';
import { pathRibbon, makePathMaterial, PathIndex } from './Paths.js';

/**
 * The great cemetery south of the mansion. Fenced area x -46..46, z 10..82.
 * Gates: north (driveway, z=10), east & west (x=±46, z=46, toward the forest), south (z=82).
 */
export function buildCemetery(b) {
  const m = b.m;
  const th = (x, z) => b.physics.terrainHeight(x, z);
  b.zone('cemetery', -46, 10, 46, 82);
  const pathMat = makePathMaterial(m.dirt);
  const gravelMat = makePathMaterial(m.stone);

  // ------------------------------------------------------------- driveway mansion -> cemetery
  pathRibbon(b, [[0, -55], [0.5, -40], [-0.5, -25], [0.5, -10], [0, 4], [0, 12]], 5.5, gravelMat);
  for (let z = -48; z <= 4; z += 8) {
    for (const s of [-1, 1]) {
      const x = s * 5.2;
      if ((z / 8) % 2 === 0) lampPost(b, x, z);
      else P.deadTree(b, s * (7.5 + Math.random() * 2), th(s * 8, z), z + 2, 0.8 + Math.random() * 0.4);
    }
  }
  // Low hedges & ruined walls along the drive
  P.stoneWall(b, -12, -30, -12, -14, 1.2, 0.6);
  P.stoneWall(b, 12, -24, 12, -6, 1.0, 0.6);
  P.statue(b, -9, th(-9, -40), -40, Math.PI / 2, true);

  // ------------------------------------------------------------- paths inside the cemetery
  pathRibbon(b, [[0, 10], [3, 22], [-2, 34], [2, 46], [0, 58], [0, 62]], 3.2, pathMat);
  pathRibbon(b, [[-46, 46], [-34, 40], [-24, 34], [-8, 36], [2, 46]], 2.6, pathMat);
  pathRibbon(b, [[2, 46], [14, 42], [30, 48], [46, 46]], 2.6, pathMat);
  pathRibbon(b, [[2, 46], [-6, 54], [-17, 56], [-17, 53]], 2.2, pathMat);
  pathRibbon(b, [[0, 58], [14, 60], [24, 70], [20, 82], [20, 86]], 2.2, pathMat);
  pathRibbon(b, [[3, 22], [-14, 18], [-28, 24]], 2.0, pathMat);
  pathRibbon(b, [[3, 22], [18, 18], [28, 24]], 2.0, pathMat);
  pathRibbon(b, [[-17, 56], [-26, 64], [-30, 66]], 2.0, pathMat);

  // ------------------------------------------------------------- fence with gates
  const F = { x0: -46, x1: 46, z0: 10, z1: 82 };
  const gateGap = 2.6;
  const fenceLine = (ax, az, bx, bz, gaps) => {
    // split straight line into ~8 m segments, leaving gaps (in distance along line)
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    let cur = 0;
    const stops = [];
    for (const g of gaps) stops.push([g - gateGap, g + gateGap]);
    stops.push([len, len]);
    for (const [ga, gb] of stops) {
      while (cur < ga - 0.1) {
        const end = Math.min(ga, cur + 8);
        const broken = Math.random() < 0.18 && end - cur > 6;
        P.fenceSegment(b, ax + ux * cur, az + uz * cur, ax + ux * end, az + uz * end, 1.9, broken);
        cur = end;
      }
      cur = gb;
    }
  };
  fenceLine(F.x0, F.z0, F.x1, F.z0, [46]);       // north, gate at x=0
  fenceLine(F.x0, F.z1, F.x1, F.z1, [66]);       // south, gate at x=20
  fenceLine(F.x0, F.z0, F.x0, F.z1, [36]);       // west, gate at z=46
  fenceLine(F.x1, F.z0, F.x1, F.z1, [36]);       // east, gate at z=46
  gate(b, 0, F.z0, true); gate(b, 20, F.z1, true); gate(b, F.x0, 46, false); gate(b, F.x1, 46, false);

  // ------------------------------------------------------------- chapel (x -7..7, z 62..80)
  chapel(b);
  // ------------------------------------------------------------- mausolea
  mausoleum(b, -32, 24, '+x', true);
  mausoleum(b, 32, 24, '-x', true);
  mausoleum(b, -34, 66, '+x', false);
  mausoleum(b, 30, 66, '-x', true);
  // ------------------------------------------------------------- crypt (underground, x -22..-12, z 38..52)
  crypt(b);

  // ------------------------------------------------------------- statues & dead trees
  P.statue(b, -12, th(-12, 20), 20, 0.3);
  P.statue(b, 12, th(12, 20), 20, -0.3, true);
  P.statue(b, -20, th(-20, 58), 58, 0.8);
  P.statue(b, 18, th(18, 54), 54, -0.8);
  P.statue(b, 9, th(9, 33), 33, Math.PI, true);
  P.statue(b, -40, th(-40, 78), 78, 2.4);
  const trees = [[-40, 14], [38, 14], [-24, 44], [22, 36], [-8, 70], [40, 58], [-42, 56], [16, 76], [-28, 78], [36, 80], [-6, 26], [26, 52]];
  for (const [x, z] of trees) P.deadTree(b, x, th(x, z), z, 0.9 + Math.random() * 0.6);

  // ------------------------------------------------------------- gravestones (instanced)
  b.pathIndex = new PathIndex(b.pathSamples || []);
  const geos = P.gravestoneGeometries();
  const placements = [[], [], [], []];
  const blocked = [
    [-8.5, 59, 8.5, 85], [-37, 19, -27, 29], [27, 19, 37, 29], [-39, 61, -29, 71], [25, 61, 35, 71], [-24, 36, -10, 55],
    [-4, 8, 4, 14], [16, 78, 24, 84], [-48, 42, -40, 50], [40, 42, 48, 50],
  ];
  const isBlocked = (x, z) => blocked.some(([a, c, bb, d]) => x > a && x < bb && z > c && z < d);
  const statues = [[-12, 20], [12, 20], [-20, 58], [18, 54], [9, 33], [-40, 78], ...trees];
  for (let z = 15; z < 80; z += 3.0) {
    for (let x = -43; x < 44; x += 2.4) {
      if (Math.random() < 0.28) continue;
      const px = x + (Math.random() - 0.5) * 0.8, pz = z + (Math.random() - 0.5) * 0.8;
      if (isBlocked(px, pz) || b.pathIndex.near(px, pz, 1.3)) continue;
      if (statues.some(([sx, sz]) => (sx - px) ** 2 + (sz - pz) ** 2 < 4)) continue;
      const r = Math.random();
      const type = r < 0.5 ? 0 : r < 0.78 ? 1 : r < 0.93 ? 2 : 3;
      placements[type].push([px, pz]);
    }
  }
  const sizes = [[0.75, 1.15, 0.3], [0.7, 1.55, 0.3], [0.95, 0.32, 1.95], [0.65, 2.3, 0.65]];
  const yOff = [0.5, 0.75, 0.15, 0.2];
  const tmp = new THREE.Object3D();
  const col = new THREE.Color();
  placements.forEach((list, type) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geos[type], m.stone, list.length);
    list.forEach(([x, z], i) => {
      const y = th(x, z);
      const s = 0.85 + Math.random() * 0.35;
      tmp.position.set(x, y + yOff[type] * s - 0.05, z);
      tmp.rotation.set((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.22);
      tmp.scale.setScalar(s);
      tmp.updateMatrix();
      im.setMatrixAt(i, tmp.matrix);
      const v = 0.65 + Math.random() * 0.35;
      im.setColorAt(i, col.setRGB(v, v * 1.0, v * 1.05));
      const [sx, sy, sz] = sizes[type];
      b.collider(x, y + sy * s / 2, z, sx * s, sy * s, sz * s, { decor: true });
      if (type === 2 && Math.random() < 0.3) b.decal(m.blood, x, y + 0.3, z, 0.8, Math.random() * 3);
      if (Math.random() < 0.035) {
        b.candle(x + 0.4, y, z + 0.4, 0.9);
      }
    });
    im.castShadow = true; im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    b.group.add(im);
  });

  // Freshly dug graves with dirt mounds (ghosts rise from here)
  for (const [x, z] of [[-20, 28], [22, 30], [-30, 52], [34, 40], [-6, 46], [10, 64]]) {
    const y = th(x, z);
    b.mesh(Geo.sphereLow, m.dirt, x, y, z, { scale: new THREE.Vector3(1.4, 0.5, 2.4), castShadow: false });
    b.ghostAnchors.push(new THREE.Vector3(x, y + 1.4, z));
    b.spawn('cemetery', x + 1.5, z);
  }

  // ------------------------------------------------------------- lights & spawns
  for (const [x, z] of [[-38, 18], [38, 20], [-38, 74], [38, 74], [-10, 44], [16, 44], [0, 30], [-26, 34], [26, 60], [-34, 50], [34, 54], [0, 76]]) b.spawn('cemetery', x, z);
  b.spawn('cemetery', -14, 40, -4); b.spawn('cemetery', -20, 46, -4);
  b.ghostAnchors.push(new THREE.Vector3(0, 1.8, 72), new THREE.Vector3(-17, -2.4, 44), new THREE.Vector3(0, 1.5, 40));
  b.pickup('ammo', 6, th(6, 26), 26, { weapon: 'pistol', amount: 24 });
  b.pickup('health', -26, th(-26, 40) , 40, { amount: 35 });
  b.pickup('ammo', 30, th(30, 46), 46, { weapon: 'rifle', amount: 30 });
  b.pickup('note', -3, th(-3, 47), 47, { text: 'Here lies the Blackwood family. All of them. The priest refused to bless the last grave and the ground has never settled. On the night of the full moon the chapel bell rings thirteen times and the soil breathes.' });
}

function lampPost(b, x, z) {
  const y = b.physics.terrainHeight(x, z);
  b.box(0.14, 3.4, 0.14, b.m.ironDark, x, y + 1.7, z, { flags: { decor: true } });
  b.box(0.6, 0.06, 0.06, b.m.ironDark, x - Math.sign(x) * 0.3, y + 3.35, z, { collide: false, castShadow: false });
  b.lamp(x - Math.sign(x) * 0.55, y + 3.1, z, 0xffb070, 2.0, 13, Math.random() < 0.4 ? 0.85 : 0.25);
}

function gate(b, x, z, alongX) {
  const m = b.m;
  const y = b.physics.terrainHeight(x, z);
  for (const s of [-1, 1]) {
    const px = alongX ? x + s * 2.9 : x, pz = alongX ? z : z + s * 2.9;
    b.box(0.9, 3.2, 0.9, m.stoneDark, px, y + 1.6, pz);
    b.box(1.1, 0.25, 1.1, m.stone, px, y + 3.3, pz, { collide: false });
    b.mesh(Geo.sphereLow, m.stone, px, y + 3.7, pz, { scale: new THREE.Vector3(0.5, 0.5, 0.5) });
    // Hanging open gate leaf
    const leaf = new THREE.Group();
    for (let i = 0; i < 6; i++) { const bar = new THREE.Mesh(Geo.box, m.ironDark); bar.scale.set(0.05, 2.2, 0.05); bar.position.set(0.2 + i * 0.4, 1.1, 0); leaf.add(bar); }
    const rail = new THREE.Mesh(Geo.box, m.ironDark); rail.scale.set(2.3, 0.06, 0.06); rail.position.set(1.15, 2.0, 0); leaf.add(rail);
    const rail2 = rail.clone(); rail2.position.y = 0.4; leaf.add(rail2);
    leaf.position.set(px + (alongX ? -s * 0.45 : 0), y, pz + (alongX ? 0 : -s * 0.45));
    leaf.rotation.y = alongX ? (s < 0 ? -1.9 : -Math.PI + 1.9) : (s < 0 ? Math.PI / 2 + 1.9 : -Math.PI / 2 - 1.9);
    if (s > 0 && Math.random() < 0.5) leaf.rotation.z = 0.25; // broken hinge
    b.group.add(leaf);
  }
  b.lamp(alongX ? x - 2.9 : x, y + 4.1, alongX ? z : z - 2.9, 0xffa860, 2.2, 14, 0.5);
}

function chapel(b) {
  const m = b.m;
  const X0 = -7, X1 = 7, Z0 = 62, Z1 = 80, H = 6.5, T = 0.5;
  const y = 0.15;
  b.floorSlab(X0 + 0.2, Z0 + 0.2, X1 - 0.2, Z1 - 0.2, y, 0.6, m.stoneDark, { tile: 2 });
  b.floorSlab(-2, 59.5, 2, 62.2, 0.12, 0.4, m.stone); // entrance steps
  const tall = (at) => ({ at, width: 1.4, height: 3.4, bottom: 2.0, type: 'window' });
  b.wall(X0, Z0, X1, Z0, H, T, m.stone, { baseY: 0, openings: [{ at: 7, width: 2.6, height: 3.6, type: 'door', door: false }] });
  b.wall(X0, Z1, X1, Z1, H, T, m.stone, { baseY: 0 });
  b.wall(X0, Z0, X0, Z1, H, T, m.stone, { baseY: 0, openings: [tall(4), tall(9), tall(14)] });
  b.wall(X1, Z0, X1, Z1, H, T, m.stone, { baseY: 0, openings: [tall(4), { at: 9, width: 1.6, height: 2.6, type: 'door', door: false }, tall(14)] });
  // roof along z
  const slope = Math.atan2(4, 7.5);
  const len = Math.hypot(4, 7.5) + 0.6;
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(Geo.box, m.roof);
    r.scale.set(len, 0.3, 19.4); r.position.set(s * 3.6, H + 2.0, 71); r.rotation.z = -s * slope;
    r.castShadow = true; r.receiveShadow = true; b.group.add(r);
  }
  const g = new THREE.Shape(); g.moveTo(-7.4, 0); g.lineTo(7.4, 0); g.lineTo(0, 4.2); g.closePath();
  const gGeo = new THREE.ExtrudeGeometry(g, { depth: 0.5, bevelEnabled: false });
  for (const z of [Z0 - 0.25, Z1 - 0.25]) { const gm = new THREE.Mesh(gGeo, m.stone); gm.position.set(0, H, z); gm.castShadow = true; b.group.add(gm); }
  b.box(14, 0.2, 18, m.planks, 0, H - 0.1, 71, { collide: true }); // ceiling
  // Bell tower behind (z 80..84)
  b.box(4.2, 15, 4.2, m.stone, 0, 7.5, 82.2);
  const spire = new THREE.Mesh(Geo.cone, m.roof); spire.scale.set(4.4, 7, 4.4); spire.position.set(0, 18.5, 82.2); spire.rotation.y = Math.PI / 4; spire.castShadow = true; b.group.add(spire);
  const bell = new THREE.Mesh(Geo.cone, m.metal); bell.scale.set(1.4, 1.4, 1.4); bell.position.set(0, 13.2, 80.0); b.group.add(bell); b.dynamic.push(bell);
  b.animated.push({ update: (dt, t) => { bell.rotation.z = Math.sin(t * 0.8) * 0.15; } });
  // Cross on the roof
  b.box(0.2, 1.6, 0.2, m.ironDark, 0, H + 4.9, Z0 - 0.1, { collide: false });
  b.box(0.9, 0.2, 0.2, m.ironDark, 0, H + 5.2, Z0 - 0.1, { collide: false });
  // Pews
  for (let i = 0; i < 6; i++) {
    const z = 65 + i * 1.7;
    for (const s of [-1, 1]) {
      if (Math.random() < 0.15) { P.chair(b, s * 3.5, y, z, Math.random() * 3, true); continue; }
      b.box(3.8, 0.12, 0.5, m.darkwood, s * 3.4, y + 0.5, z, { flags: { decor: true } });
      b.box(3.8, 0.7, 0.08, m.darkwood, s * 3.4, y + 0.85, z + 0.25, { collide: false });
      b.collider(s * 3.4, y + 0.45, z, 3.8, 0.9, 0.6, { decor: true });
    }
  }
  // Altar
  b.floorSlab(-5, 75.5, 5, 79.6, y + 0.45, 0.45, m.marble);
  b.box(3, 1.1, 1.0, m.marble, 0, y + 0.45 + 0.55, 78, { flags: { decor: true } });
  b.box(0.2, 3.0, 0.2, m.metal, 0, y + 2.6, 79.4, { collide: false });
  b.box(1.4, 0.2, 0.2, m.metal, 0, y + 3.4, 79.4, { collide: false });
  for (const x of [-1.2, -0.6, 0.6, 1.2]) b.candle(x, y + 1.55, 78.2, 1.1);
  for (const x of [-4, 4]) { b.candle(x, y + 0.45, 76.5, 2.0); }
  b.light(0, y + 3, 77, 0x9ab0ff, 1.6, 12, { flicker: 0.15, speed: 0.5, important: true });
  b.pickup('weapon', 0.3, y + 1.55, 77.9, { weapon: 'crossbow', name: 'Holy Crossbow' });
  b.pickup('note', -0.8, y + 1.55, 77.7, { text: 'The Holy Crossbow was consecrated with water from this font. Its bolts burn the restless dead. The spirits cannot hide from blessed silver light. Use it well. Pray for us.' });
  b.decal(m.blood, 2, y, 70, 2.2, 1.4);
  b.decal(m.symbol, 0, y, 66, 2.5);
  b.ghostAnchors.push(new THREE.Vector3(0, 2.2, 70));
  b.spawn('cemetery', 0, 68, y);
  b.spawn('cemetery', -3, 84);
}

function mausoleum(b, cx, cz, facing, interior) {
  const m = b.m;
  const W = 5, D = 6, H = 3.6, T = 0.4;
  const y = 0.12;
  const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
  b.floorSlab(x0, z0, x1, z1, y, 0.5, m.stoneDark);
  const doorOpening = [{ at: D / 2, width: 1.6, height: 2.6, type: 'door', door: false }];
  b.wall(x0, z0, x1, z0, H, T, m.stone, { baseY: 0 });
  b.wall(x0, z1, x1, z1, H, T, m.stone, { baseY: 0 });
  b.wall(x0, z0, x0, z1, H, T, m.stone, { baseY: 0, openings: facing === '-x' ? doorOpening : [] });
  b.wall(x1, z0, x1, z1, H, T, m.stone, { baseY: 0, openings: facing === '+x' ? doorOpening : [] });
  b.box(W + 0.8, 0.4, D + 0.8, m.stoneDark, cx, H + 0.2, cz);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.2, 4), m.roof); roof.position.set(cx, H + 1.5, cz); roof.rotation.y = Math.PI / 4; roof.castShadow = true; b.group.add(roof);
  const fx = facing === '+x' ? x1 + 0.6 : x0 - 0.6;
  for (const s of [-1, 1]) P.column(b, fx, 0, cz + s * 1.3, H, 0.18, m.stone);
  b.box(0.8, 0.3, 3.4, m.stone, fx, H - 0.1, cz, { collide: false });
  if (interior) {
    P.coffin(b, cx - 0.6, y, cz - 1.6, Math.PI / 2, Math.random() < 0.5);
    P.coffin(b, cx - 0.6, y, cz + 1.6, Math.PI / 2, true);
    b.candle(cx - 1.9, y, cz, 1.0);
    b.decal(m.blood, cx, y, cz, 1.4, Math.random() * 3);
    if (Math.random() < 0.6) P.skeleton(b, cx + 0.5, y, cz - 0.4, Math.random() * 3);
    b.pickup(Math.random() < 0.5 ? 'ammo' : 'health', cx - 1.6, y, cz + 0.8, { weapon: 'any', amount: 30 });
  }
  b.spawn('cemetery', cx, cz, y);
  b.scareSpots.push({ pos: new THREE.Vector3(fx, 1.6, cz), type: 'doorway', dir: new THREE.Vector3(facing === '+x' ? 1 : -1, 0, 0) });
}

function crypt(b) {
  const m = b.m;
  const X0 = -22.4, X1 = -11.6, Z0 = 38, Z1 = 47.2, BY = -4;
  b.navGrid.addRegion(-1, X0, Z0, X1, Z1);
  // Chamber
  b.floorSlab(X0, Z0, X1, Z1, BY, 0.3, m.stoneDark);
  b.wall(X0, Z0, X1, Z0, 4, 0.4, m.stoneDark, { baseY: BY });
  b.wall(X0, Z1, X1, Z1, 4, 0.4, m.stoneDark, { baseY: BY, openings: [{ at: 5.4, width: 2.4, height: 4, type: 'door', door: false }] });
  b.wall(X0, Z0, X0, Z1, 4, 0.4, m.stoneDark, { baseY: BY });
  b.wall(X1, Z0, X1, Z1, 4, 0.4, m.stoneDark, { baseY: BY });
  // Roof slab with stair hole (x -18.2..-15.8, z 41.4..47.2)
  b.floorSlab(X0, Z0, -18.2, Z1, 0.05, 0.4, m.stone);
  b.floorSlab(-15.8, Z0, X1, Z1, 0.05, 0.4, m.stone);
  b.floorSlab(-18.2, Z0, -15.8, 41.4, 0.05, 0.4, m.stone);
  // Entrance landing (z 47.2..52.4)
  b.floorSlab(X0, Z1, X1, 52.4, 0.05, 0.4, m.stone);
  b.stairs(-17, BY, 41.6, 's', 2.0, 16, 0.25, 0.35, m.stoneDark, -1, 0, { rail: false });
  // Surface enclosure around the stairwell
  b.box(0.4, 1.0, 5.8, m.stone, -18.4, 0.55, 44.3);
  b.box(0.4, 1.0, 5.8, m.stone, -15.6, 0.55, 44.3);
  b.box(3.2, 1.0, 0.4, m.stone, -17, 0.55, 41.2);
  for (const x of [-18.6, -15.4]) P.column(b, x, 0.05, 47.6, 3.2, 0.22, m.stone);
  b.box(3.8, 0.5, 0.6, m.stone, -17, 3.4, 47.6, { collide: false });
  b.decal(m.symbol, -17, 0.06, 50, 2.0);
  // Interior
  for (let i = 0; i < 3; i++) {
    P.coffin(b, -20.6, BY, 40 + i * 2.6, 0, i === 1);
    P.coffin(b, -13.4, BY, 40 + i * 2.6, 0, i !== 1);
  }
  b.candle(-17, BY, 38.8, 1.3); b.candle(-20.8, BY, 46.4, 1.0); b.candle(-13.2, BY, 46.4, 1.0);
  b.light(-17, BY + 2.5, 41, 0xff4020, 1.2, 9, { flicker: 0.6, speed: 3 });
  P.chains(b, -17, -0.4, 40);
  b.decal(m.blood, -17, BY, 39.6, 2.0, 0.3);
  // Secret: loose stone in the west wall reveals a niche
  const loose = b.box(0.3, 1.2, 1.2, m.brick, -22.0, BY + 1.0, 42.6);
  b.secretWall(loose, 'Loose stone…', { x: -21.6, y: BY, z: 44.6 });
  b.pickup('ammo', -17, BY, 39.4, { weapon: 'crossbow', amount: 6 });
}
