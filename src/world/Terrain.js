import * as THREE from 'three';

/** Smooth pseudo-noise terrain. Flat around the mansion, gentle in the cemetery, hilly in the forest. */
function noise2(x, z) {
  return Math.sin(x * 0.045) * Math.cos(z * 0.038) + 0.5 * Math.sin(x * 0.11 + z * 0.07) + 0.25 * Math.sin(x * 0.23 - z * 0.19) + 0.12 * Math.sin(x * 0.51 + z * 0.43);
}
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function rectMask(x, z, minX, minZ, maxX, maxZ, fade) {
  const dx = Math.max(minX - x, 0, x - maxX), dz = Math.max(minZ - z, 0, z - maxZ);
  return smooth(Math.hypot(dx, dz) / fade);
}

/** Pits: physics terrain drops away here (basements / crypt). The visual mesh dips slightly instead. */
export const PITS = [
  { minX: -14.6, minZ: -84.6, maxX: 14.6, maxZ: -59.4, depth: -20 }, // mansion basement
  { minX: -22.4, minZ: 38, maxX: -11.6, maxZ: 52.4, depth: -20 },    // cemetery crypt
];

/** Flattened plateaus under buildings. level=null -> natural height at the rect centre. */
export const FLATS = [
  // cemetery buildings (level 0 = cemetery base)
  { minX: -8.5, minZ: 59, maxX: 8.5, maxZ: 85, level: 0, fade: 6 },     // chapel + bell tower
  { minX: -36, minZ: 20, maxX: -28, maxZ: 28, level: 0, fade: 5 },      // mausolea
  { minX: 28, minZ: 20, maxX: 36, maxZ: 28, level: 0, fade: 5 },
  { minX: -38, minZ: 62, maxX: -30, maxZ: 70, level: 0, fade: 5 },
  { minX: 26, minZ: 62, maxX: 34, maxZ: 70, level: 0, fade: 5 },
  { minX: -24, minZ: 36, maxX: -10, maxZ: 55, level: 0, fade: 5 },      // crypt
  // forest structures
  { minX: 82, minZ: 55, maxX: 94, maxZ: 66, level: null, fade: 6 },     // cabin east
  { minX: -132, minZ: -78, maxX: -120, maxZ: -66, level: null, fade: 6 }, // cabin west
  { minX: -77, minZ: 103, maxX: -63, maxZ: 117, level: null, fade: 6 }, // cabin south
  { minX: -124, minZ: -2, maxX: -112, maxZ: 10, level: null, fade: 6 }, // shelter
  { minX: 108, minZ: -17, maxX: 142, maxZ: 17, level: null, fade: 8 },  // boss arena
];

function baseHeight(x, z) {
  const n = noise2(x, z);
  let h = (n + 1.9) * 0.5 * 2.2; // ~0 .. 4
  let m = 1;
  m = Math.min(m, rectMask(x, z, -32, -102, 32, -48, 14));            // mansion grounds
  m = Math.min(m, rectMask(x, z, -6, -56, 6, 10, 10));                 // driveway
  m = Math.min(m, 0.35 + 0.65 * rectMask(x, z, -48, 2, 48, 84, 12));   // cemetery: gentle undulation
  h *= m;
  const edge = Math.max(0, Math.hypot(x / 170, z / 140) - 0.88) * 14;
  return h + edge;
}

for (const f of FLATS) if (f.level === null) f.level = baseHeight((f.minX + f.maxX) / 2, (f.minZ + f.maxZ) / 2);

export function visualTerrainHeight(x, z) {
  for (const p of PITS) if (x > p.minX + 0.3 && x < p.maxX - 0.3 && z > p.minZ + 0.3 && z < p.maxZ - 0.3) return -0.35;
  let h = baseHeight(x, z);
  for (const f of FLATS) {
    const t = rectMask(x, z, f.minX, f.minZ, f.maxX, f.maxZ, f.fade);
    if (t < 1) h = f.level + (h - f.level) * t;
  }
  return h;
}

export function terrainHeight(x, z) {
  for (const p of PITS) if (x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ) return p.depth;
  return visualTerrainHeight(x, z);
}

export function buildTerrain(b) {
  const size = 360, seg = 180;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = visualTerrainHeight(x, z);
    pos.setY(i, h);
    // subtle tint: muddy in the cemetery, mossy in the forest
    const inCem = x > -48 && x < 48 && z > 4 && z < 86;
    const v = 0.85 + 0.15 * Math.sin(x * 0.3) * Math.cos(z * 0.27);
    colors[i * 3] = v * (inCem ? 0.95 : 0.85);
    colors[i * 3 + 1] = v * (inCem ? 0.9 : 1.0);
    colors[i * 3 + 2] = v * (inCem ? 0.88 : 0.85);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = b.m.ground.clone();
  mat.vertexColors = true;
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true; ground.castShadow = false;
  b.group.add(ground);
  b.ground = ground;
}
