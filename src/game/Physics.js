import * as THREE from 'three';

/**
 * Lightweight static AABB collision world with a uniform spatial hash.
 * Everything solid in the world (walls, floors, stairs, props, trees) is an axis-aligned box.
 * Flags:
 *   step      - stair step; walkable, never blocks nav-grid cells
 *   decor     - decorative prop; ghosts pass through, bullets still stop
 *   noRay     - bullets pass through (e.g. fog planes, invisible blockers)
 *   invisible - exists only for collision (world bounds)
 */
const CELL = 8;
const STEP_HEIGHT = 0.55;
const EPS = 1e-4;

export class Physics {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
    this.nextId = 1;
    this.terrainFn = () => 0;
    this.stepHeight = STEP_HEIGHT;
  }

  setTerrain(fn) { this.terrainFn = fn; }
  terrainHeight(x, z) { return this.terrainFn(x, z); }

  _cellKey(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

  _cellsFor(min, max, fn) {
    const x0 = Math.floor(min.x / CELL), x1 = Math.floor(max.x / CELL);
    const z0 = Math.floor(min.z / CELL), z1 = Math.floor(max.z / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) fn(this._cellKey(cx, cz));
  }

  /** Add a solid box. min/max are THREE.Vector3 or {x,y,z}. */
  addBox(min, max, flags = {}) {
    const box = {
      id: this.nextId++,
      min: new THREE.Vector3(Math.min(min.x, max.x), Math.min(min.y, max.y), Math.min(min.z, max.z)),
      max: new THREE.Vector3(Math.max(min.x, max.x), Math.max(min.y, max.y), Math.max(min.z, max.z)),
      step: !!flags.step, decor: !!flags.decor, noRay: !!flags.noRay, invisible: !!flags.invisible,
      userData: flags.userData || null,
    };
    this.boxes.push(box);
    this._cellsFor(box.min, box.max, (k) => {
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(box);
    });
    return box;
  }

  /** Convenience: box from center + size. */
  addBoxCS(cx, cy, cz, sx, sy, sz, flags) {
    return this.addBox({ x: cx - sx / 2, y: cy - sy / 2, z: cz - sz / 2 }, { x: cx + sx / 2, y: cy + sy / 2, z: cz + sz / 2 }, flags);
  }

  removeBox(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
    this._cellsFor(box.min, box.max, (k) => {
      const arr = this.grid.get(k);
      if (!arr) return;
      const j = arr.indexOf(box);
      if (j >= 0) arr.splice(j, 1);
    });
  }

  /** Iterate candidate boxes overlapping an XZ rectangle. */
  query(minX, minZ, maxX, maxZ, fn) {
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    const seen = new Set();
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const arr = this.grid.get(this._cellKey(cx, cz));
      if (!arr) continue;
      for (const b of arr) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        if (fn(b) === false) return;
      }
    }
  }

  /** Does the body AABB overlap any box (respecting filter)? Returns first overlapping box. */
  overlap(min, max, filter) {
    let hit = null;
    this.query(min.x, min.z, max.x, max.z, (b) => {
      if (filter && !filter(b)) return;
      if (b.max.x > min.x + EPS && b.min.x < max.x - EPS &&
          b.max.y > min.y + EPS && b.min.y < max.y - EPS &&
          b.max.z > min.z + EPS && b.min.z < max.z - EPS) { hit = b; return false; }
    });
    return hit;
  }

  /**
   * Height of the surface a character would stand on at (x,z) if its feet are currently at
   * `fromY`. Considers box tops up to stepHeight above fromY, plus terrain.
   */
  groundHeight(x, z, fromY, radius = 0.25, filter) {
    let best = -Infinity;
    const limit = fromY + this.stepHeight;
    this.query(x - radius, z - radius, x + radius, z + radius, (b) => {
      if (filter && !filter(b)) return;
      if (b.min.x > x + radius || b.max.x < x - radius || b.min.z > z + radius || b.max.z < z - radius) return;
      const top = b.max.y;
      if (top <= limit && top > best && b.min.y < limit) best = top;
    });
    const t = this.terrainFn(x, z);
    if (t <= limit && t > best) best = t;
    return best;
  }

  /**
   * Move a character body: pos is feet-center, halfW half width, height full height.
   * Mutates body.pos and body.vel. Sets body.onGround. Returns true if horizontal movement was blocked.
   */
  moveBody(body, dt, filter) {
    const { pos, vel } = body;
    const hw = body.halfW, h = body.height;
    const min = new THREE.Vector3(), max = new THREE.Vector3();
    const setBounds = (p) => { min.set(p.x - hw, p.y, p.z - hw); max.set(p.x + hw, p.y + h, p.z + hw); };
    let blocked = false;

    const tryAxis = (axis, delta) => {
      if (Math.abs(delta) < 1e-6) return;
      const orig = pos[axis];
      pos[axis] += delta;
      setBounds(pos);
      // Lift the body slightly so standing on a surface does not count as overlap.
      min.y += 0.02;
      let hit = this.overlap(min, max, filter);
      if (!hit) return;
      // Attempt step-up
      if (body.onGround || body.flying) {
        const stepTop = hit.max.y;
        const rise = stepTop - pos.y;
        if (rise > 0 && rise <= this.stepHeight + 0.01) {
          const oy = pos.y;
          pos.y = stepTop + 0.001;
          setBounds(pos); min.y += 0.02;
          const hit2 = this.overlap(min, max, filter);
          if (!hit2) return;
          pos.y = oy;
        }
      }
      // Blocked: slide back to contact
      pos[axis] = orig;
      blocked = true;
      body.lastHit = hit;
      // push to contact surface
      const sign = Math.sign(delta);
      const edge = sign > 0 ? hit.min[axis] - hw - 0.001 : hit.max[axis] + hw + 0.001;
      const moved = Math.abs(edge - orig);
      if (moved < Math.abs(delta) && Math.sign(edge - orig) === sign) {
        pos[axis] = edge;
        setBounds(pos); min.y += 0.02;
        if (this.overlap(min, max, filter)) pos[axis] = orig;
      }
    };

    tryAxis('x', vel.x * dt);
    tryAxis('z', vel.z * dt);

    // Vertical
    if (!body.flying) {
      const dy = vel.y * dt;
      pos.y += dy;
      setBounds(pos);
      body.onGround = false;
      const hit = this.overlap(min, max, filter);
      if (hit) {
        if (dy <= 0) { pos.y = hit.max.y; vel.y = 0; body.onGround = true; }
        else { pos.y = hit.min.y - h - 0.001; vel.y = 0; }
      }
      const t = this.terrainFn(pos.x, pos.z);
      if (pos.y <= t) { pos.y = t; if (vel.y < 0) vel.y = 0; body.onGround = true; }
      // Resting check: is there ground right under the feet?
      if (!body.onGround && vel.y <= 0) {
        const g = this.groundHeight(pos.x, pos.z, pos.y, hw * 0.8, filter);
        if (g > -Infinity && pos.y - g < 0.05) { pos.y = g; vel.y = 0; body.onGround = true; }
      }
    } else {
      pos.y += vel.y * dt;
    }
    return blocked;
  }

  /**
   * Ray vs all boxes. Returns {dist, point, normal, box} or null.
   * filter(box) -> false to skip.
   */
  raycast(origin, dir, maxDist = 200, filter) {
    let best = null;
    // Walk the ray through grid cells in XZ.
    const stepLen = CELL * 0.9;
    const steps = Math.ceil(maxDist / stepLen) + 1;
    const seen = new Set();
    const p = new THREE.Vector3();
    for (let i = 0; i <= steps; i++) {
      const t0 = i * stepLen;
      if (t0 > maxDist) break;
      p.copy(origin).addScaledVector(dir, t0);
      const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const arr = this.grid.get(this._cellKey(cx + ox, cz + oz));
        if (!arr) continue;
        for (const b of arr) {
          if (seen.has(b.id)) continue;
          seen.add(b.id);
          if (b.noRay) continue;
          if (filter && !filter(b)) continue;
          const r = rayAABB(origin, dir, b.min, b.max);
          if (r && r.t < maxDist && (!best || r.t < best.dist)) {
            best = { dist: r.t, point: origin.clone().addScaledVector(dir, r.t), normal: r.normal, box: b };
          }
        }
      }
      if (best && best.dist < t0) break;
    }
    return best;
  }

  /** Line of sight between two points (ignores decor if ignoreDecor). */
  lineOfSight(a, b, ignoreDecor = false) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const d = dir.length();
    if (d < 1e-4) return true;
    dir.divideScalar(d);
    const hit = this.raycast(a, dir, d, ignoreDecor ? (bx) => !bx.decor : undefined);
    return !hit;
  }
}

/** Slab-method ray/AABB intersection. Returns {t, normal} or null. */
export function rayAABB(o, d, min, max) {
  let tmin = -Infinity, tmax = Infinity;
  let nAxis = -1, nSign = 0;
  for (const ax of ['x', 'y', 'z']) {
    const inv = 1 / (d[ax] || 1e-12);
    let t1 = (min[ax] - o[ax]) * inv;
    let t2 = (max[ax] - o[ax]) * inv;
    let s = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = ax; nSign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  const t = tmin >= 0 ? tmin : tmax;
  const normal = new THREE.Vector3();
  if (nAxis !== -1) normal[nAxis] = nSign;
  return { t, normal };
}

/** Ray vs sphere. Returns t or -1. */
export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (-b + Math.sqrt(disc) >= 0 ? 0 : -1);
}
