import * as THREE from 'three';
import { visualTerrainHeight } from './Terrain.js';

/** Terrain-draped ribbon along a smooth curve. Records samples for tree avoidance. */
export function pathRibbon(b, points, width, material, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.3);
  const len = curve.getLength();
  const n = Math.max(4, Math.ceil(len / 1.5));
  const pts = curve.getSpacedPoints(n);
  const pos = [], uv = [], idx = [];
  let dist = 0;
  for (let i = 0; i <= n; i++) {
    const p = pts[i];
    const next = pts[Math.min(n, i + 1)], prev = pts[Math.max(0, i - 1)];
    const dir = new THREE.Vector3().subVectors(next, prev).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    if (i > 0) dist += p.distanceTo(pts[i - 1]);
    for (const s of [-1, 1]) {
      const w = width * 0.5 * (1 + 0.15 * Math.sin(i * 0.7));
      const x = p.x + side.x * s * w, z = p.z + side.z * s * w;
      pos.push(x, visualTerrainHeight(x, z) + (opts.lift ?? 0.05), z);
      uv.push(s < 0 ? 0 : 1, dist / width);
    }
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true; mesh.castShadow = false;
  mesh.renderOrder = 1;
  b.group.add(mesh);
  b.pathSamples = b.pathSamples || [];
  for (let i = 0; i <= n; i += 1) b.pathSamples.push({ x: pts[i].x, z: pts[i].z, r: width * 0.5 });
  return { curve, pts, len };
}

export function makePathMaterial(base) {
  const m = base.clone();
  m.map = base.map.clone();
  m.map.repeat.set(1, 0.25);
  m.map.needsUpdate = true;
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
  return m;
}

/** Fast spatial lookup for "is (x,z) near a path?" */
export class PathIndex {
  constructor(samples, cell = 6) {
    this.cell = cell; this.map = new Map();
    for (const s of samples) {
      const k = `${Math.floor(s.x / cell)},${Math.floor(s.z / cell)}`;
      let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(s);
    }
  }
  near(x, z, margin) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const a = this.map.get(`${cx + dx},${cz + dz}`); if (!a) continue;
      for (const s of a) if ((s.x - x) ** 2 + (s.z - z) ** 2 < (s.r + margin) ** 2) return true;
    }
    return false;
  }
}
