import * as THREE from 'three';

/**
 * Layered 2D navigation grid with A*.
 * Layers: -1 basement (floor y=-4), 0 ground (y=0), 1 upper floor (y=4).
 * Stairs are registered as portals that link two layers.
 */
const LAYER_FLOOR = { '-1': -4, '0': 0, '1': 4 };

// Footprints of buildings that have an upper floor / an underground level.
const UPPER = [];
const LOWER = [];
const inAny = (list, x, z) => list.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);

/** Which nav layer a point belongs to. Outdoors (hills!) is always layer 0. */
export function layerForY(y, x, z) {
  if (x === undefined) { if (y > 2.4) return 1; if (y < -1.6) return -1; return 0; }
  if (y > 2.4 && inAny(UPPER, x, z)) return 1;
  if (y < -1.6 && inAny(LOWER, x, z)) return -1;
  return 0;
}
export function layerAt(p) { return layerForY(p.y + 0.1, p.x, p.z); }

class MinHeap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

export class NavGrid {
  constructor(physics, bounds, cell = 1.5) {
    this.physics = physics;
    this.cell = cell;
    this.minX = bounds.minX; this.minZ = bounds.minZ;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.layers = {};          // layer -> Uint8Array walkable
    this.layerRegions = { 0: [{ minX: bounds.minX, minZ: bounds.minZ, maxX: bounds.maxX, maxZ: bounds.maxZ }], 1: [], '-1': [] };
    this.stairs = [];          // {low:{layer,pos}, high:{layer,pos}, rect}
    this.pathCache = new Map();
  }

  addRegion(layer, minX, minZ, maxX, maxZ) {
    const r = { minX, minZ, maxX, maxZ };
    this.layerRegions[layer].push(r);
    if (layer === 1) UPPER.push(r);
    if (layer === -1) LOWER.push(r);
  }

  /** Register a stair connecting lowLayer -> highLayer. bottom/top are world Vector3 at the stair ends. */
  addStairs(lowLayer, highLayer, bottom, top, rect) {
    this.stairs.push({ low: { layer: lowLayer, pos: bottom.clone() }, high: { layer: highLayer, pos: top.clone() }, rect });
  }

  toCell(x, z) { return [Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell)]; }
  toWorld(cx, cz) { return [this.minX + (cx + 0.5) * this.cell, this.minZ + (cz + 0.5) * this.cell]; }
  inBounds(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h; }

  build() {
    for (const layer of [0, 1, -1]) {
      const arr = new Uint8Array(this.w * this.h);
      const floorY = LAYER_FLOOR[layer];
      const regions = this.layerRegions[layer];
      const half = this.cell * 0.5;
      const probe = this.cell * 0.47; // (almost) the full cell, so thin walls can't slip between samples
      for (let cz = 0; cz < this.h; cz++) for (let cx = 0; cx < this.w; cx++) {
        const [x, z] = this.toWorld(cx, cz);
        let inRegion = false;
        for (const r of regions) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) { inRegion = true; break; }
        if (!inRegion) continue;
        // Is there floor? Outdoors the reference is the terrain (hills), indoors the storey height.
        let refY = floorY;
        if (layer === 0) { const t = this.physics.terrainHeight(x, z); refY = t < -5 ? 0 : t; }
        const g = this.physics.groundHeight(x, z, refY, half * 0.6);
        let stairCell = false;
        for (const s of this.stairs) {
          if (s.rect && x >= s.rect.minX && x <= s.rect.maxX && z >= s.rect.minZ && z <= s.rect.maxZ && (s.low.layer === layer || s.high.layer === layer)) stairCell = true;
        }
        // stair cells only count where the step height matches this floor (bottom steps below, top steps above)
        if (g === -Infinity || g < refY - 1.0 || g > refY + 1.0) continue;
        // Blocked by a wall/prop in the body height range?
        let blocked = false;
        const base = g === -Infinity ? refY : g;
        const lo = base + 0.6, hi = base + 1.6;
        this.physics.query(x - probe, z - probe, x + probe, z + probe, (b) => {
          if (b.userData && b.userData.type === 'door') return;
          // stair steps are walkable where they're low, but the tall part of a staircase is a wall from the side
          if (b.step) { if (b.max.y > base + 1.0 && b.min.y < hi && b.min.x < x + probe && b.max.x > x - probe && b.min.z < z + probe && b.max.z > z - probe) { blocked = true; return false; } return; }
          if (b.min.x >= x + probe || b.max.x <= x - probe || b.min.z >= z + probe || b.max.z <= z - probe) return;
          if (b.max.y > lo && b.min.y < hi) { blocked = true; return false; }
        });
        if (blocked) continue;
        arr[cz * this.w + cx] = 1;
      }
      this.layers[layer] = arr;
    }
    this.pathCache.clear();
  }

  /** Force cells walkable (door openings narrower than two cells). */
  carve(layer, minX, minZ, maxX, maxZ, floorY) {
    const arr = this.layers[layer]; if (!arr) return;
    const [x0, z0] = this.toCell(minX, minZ), [x1, z1] = this.toCell(maxX, maxZ);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      if (!this.inBounds(cx, cz)) continue;
      const [wx, wz] = this.toWorld(cx, cz);
      if (wx < minX || wx > maxX || wz < minZ || wz > maxZ) continue;
      if (floorY !== undefined) {
        // only open the cell if nothing but the (thin) wall is near its centre
        const lo = floorY + 0.4, hi = floorY + 1.6, r = 0.22;
        let blocked = false;
        this.physics.query(wx - r, wz - r, wx + r, wz + r, (bx) => {
          if (bx.step || (bx.userData && bx.userData.type === 'door')) return;
          if (bx.min.x >= wx + r || bx.max.x <= wx - r || bx.min.z >= wz + r || bx.max.z <= wz - r) return;
          if (bx.max.y > lo && bx.min.y < hi) { blocked = true; return false; }
        });
        if (blocked) continue;
      }
      arr[cz * this.w + cx] = 1;
    }
  }

  isWalkable(layer, cx, cz) {
    if (!this.inBounds(cx, cz)) return false;
    const arr = this.layers[layer];
    return arr ? arr[cz * this.w + cx] === 1 : false;
  }

  /** Mark a world rect as walkable/unwalkable at runtime (doors). */
  setRectWalkable(layer, minX, minZ, maxX, maxZ, walkable) {
    const arr = this.layers[layer]; if (!arr) return;
    const [x0, z0] = this.toCell(minX, minZ), [x1, z1] = this.toCell(maxX, maxZ);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) if (this.inBounds(cx, cz)) arr[cz * this.w + cx] = walkable ? 1 : 0;
    this.pathCache.clear();
  }

  nearestWalkable(layer, cx, cz, maxR = 6) {
    if (this.isWalkable(layer, cx, cz)) return [cx, cz];
    for (let r = 1; r <= maxR; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (this.isWalkable(layer, cx + dx, cz + dz)) return [cx + dx, cz + dz];
      }
    }
    return null;
  }

  /** Find the stair to use to go from layer a to layer b, nearest to `from`. */
  findStair(fromLayer, toLayer, from, target) {
    let best = null, bd = Infinity;
    for (const s of this.stairs) {
      let entry = null, exit = null;
      if (s.low.layer === fromLayer && s.high.layer === toLayer) { entry = s.low.pos; exit = s.high.pos; }
      else if (s.high.layer === fromLayer && s.low.layer === toLayer) { entry = s.high.pos; exit = s.low.pos; }
      if (!entry) continue;
      const d = entry.distanceTo(from) + (target ? exit.distanceTo(target) : 0);
      if (d < bd) { bd = d; best = { entry, exit, stair: s }; }
    }
    // Two-step (basement -> upper): go via ground floor
    if (!best && fromLayer !== 0 && toLayer !== 0) return this.findStair(fromLayer, 0, from, target);
    return best;
  }

  /**
   * A* path within a layer. Returns array of THREE.Vector3 (y = layer floor) or null.
   */
  findPath(layer, from, to, maxExpand = 12000) {
    const arr = this.layers[layer];
    if (!arr) return null;
    let [sx, sz] = this.toCell(from.x, from.z);
    let [gx, gz] = this.toCell(to.x, to.z);
    const s = this.nearestWalkable(layer, sx, sz, 4);
    const g = this.nearestWalkable(layer, gx, gz, 4);
    if (!s || !g) return null;
    [sx, sz] = s; [gx, gz] = g;
    if (sx === gx && sz === gz) return [new THREE.Vector3(to.x, LAYER_FLOOR[layer], to.z)];

    const key = `${layer}:${sx},${sz}>${gx},${gz}`;
    const cached = this.pathCache.get(key);
    if (cached) return cached.map((v) => v.clone());

    const w = this.w;
    const start = sz * w + sx, goal = gz * w + gx;
    const N = arr.length;
    if (!this._g || this._g.length !== N) { this._g = new Float32Array(N); this._came = new Int32Array(N); this._closed = new Uint8Array(N); this._touched = []; this._init = false; }
    const gS = this._g, came = this._came, closed = this._closed;
    for (const i of this._touched) { gS[i] = Infinity; closed[i] = 0; came[i] = -1; }
    if (!this._init) { gS.fill(Infinity); came.fill(-1); this._init = true; }
    const touched = this._touched = [];
    gS[start] = 0; touched.push(start);
    const open = new MinHeap();
    const h = (i) => { const x = i % w, z = (i / w) | 0; const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    open.push({ i: start, f: h(start) });
    let expanded = 0;
    let found = false;
    let bestNode = start, bestH = h(start);
    const nbrs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (open.size) {
      const cur = open.pop();
      const i = cur.i;
      if (closed[i]) continue;
      closed[i] = 1;
      if (i === goal) { found = true; break; }
      if (++expanded > maxExpand) break;
      const cx = i % w, cz = (i / w) | 0;
      const hi = h(i);
      if (hi < bestH) { bestH = hi; bestNode = i; }
      for (const [dx, dz, cost] of nbrs) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= this.h) continue;
        const ni = nz * w + nx;
        if (!arr[ni] || closed[ni]) continue;
        if (dx && dz && (!arr[cz * w + nx] || !arr[nz * w + cx])) continue;
        const ng = gS[i] + cost;
        if (ng < gS[ni]) {
          if (gS[ni] === Infinity) touched.push(ni);
          gS[ni] = ng; came[ni] = i;
          open.push({ i: ni, f: ng + h(ni) * 1.15 });
        }
      }
    }
    const end = found ? goal : bestNode;
    if (!found && end === start) return null;
    const cells = [];
    let n = end, guard = 0;
    while (n !== -1 && n !== start && guard++ < 100000) { cells.push(n); n = came[n]; }
    cells.reverse();
    // String pulling
    const pts = [];
    const y = LAYER_FLOOR[layer];
    let anchor = [sx, sz];
    for (let k = 0; k < cells.length; k++) {
      const c = [cells[k] % w, (cells[k] / w) | 0];
      const next = k + 1 < cells.length ? [cells[k + 1] % w, (cells[k + 1] / w) | 0] : null;
      if (!next || !this._los(layer, anchor, next)) {
        const [wx, wz] = this.toWorld(c[0], c[1]);
        pts.push(new THREE.Vector3(wx, y, wz));
        anchor = c;
      }
    }
    if (found) pts[pts.length - 1] = new THREE.Vector3(to.x, y, to.z);
    if (this.pathCache.size > 400) this.pathCache.clear();
    this.pathCache.set(key, pts.map((v) => v.clone()));
    return pts;
  }

  /** Conservative grid line of sight: dense sampling, and diagonal steps need both side cells free. */
  _los(layer, a, b) {
    const [x0, z0] = a, [x1, z1] = b;
    const dx = x1 - x0, dz = z1 - z0;
    const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) * 3) + 1;
    let px = x0, pz = z0;
    if (!this.isWalkable(layer, x0, z0)) return false;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const cx = Math.floor(x0 + 0.5 + dx * t), cz = Math.floor(z0 + 0.5 + dz * t);
      if (cx === px && cz === pz) continue;
      if (!this.isWalkable(layer, cx, cz)) return false;
      if (cx !== px && cz !== pz && (!this.isWalkable(layer, px, cz) || !this.isWalkable(layer, cx, pz))) return false;
      px = cx; pz = cz;
    }
    return true;
  }

  /** Random walkable point on layer 0 within radius range of a center (for wandering). */
  randomWalkable(layer, center, minR, maxR, tries = 20) {
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
      const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      const [cx, cz] = this.toCell(x, z);
      if (this.isWalkable(layer, cx, cz)) return new THREE.Vector3(x, LAYER_FLOOR[layer], z);
    }
    return null;
  }
}
