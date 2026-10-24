import * as THREE from 'three';
import { layerAt } from '../game/NavGrid.js';

/** Picks logical spawn points: preferred zone per enemy type, far enough away and preferably out of sight. */
const PREFS = {
  vampire: { mansion: 0.4, cemetery: 0.45, grounds: 0.15 },
  ancientVampire: { mansion: 0.55, cemetery: 0.45 },
  werewolf: { forest: 0.8, grounds: 0.2 },
  alphaWerewolf: { forest: 1 },
  ghost: { cemetery: 0.45, mansion: 0.35, forest: 0.2 },
  revenant: { cemetery: 0.6, mansion: 0.4 },
};

export class SpawnManager {
  constructor(game) {
    this.game = game;
    this.points = game.world.spawnPoints;
    this.recent = [];
  }

  pick(type) {
    const game = this.game;
    const player = game.player;
    const pp = player.position;
    const eye = player.controller.eyePosition;
    const prefs = PREFS[type] || { cemetery: 1 };
    const minD = type === 'vampire' && game.world.zoneAt(pp) === 'mansion' ? 10 : 18;
    const maxD = 85;
    const candidates = [];
    for (const zone in this.points) {
      const w = prefs[zone] || 0.03;
      for (const p of this.points[zone]) {
        const d = p.distanceTo(pp);
        if (d < minD || d > maxD) continue;
        if (this.recent.some((r) => r.distanceToSquared(p) < 4)) continue;
        candidates.push({ p, w, d });
      }
    }
    // visibility: cull points the player can currently see (only test a limited number for performance)
    candidates.sort(() => Math.random() - 0.5);
    const fwd = player.controller.forward(new THREE.Vector3());
    let best = null, bestScore = -Infinity, tested = 0;
    for (const c of candidates) {
      if (tested > 14) break;
      tested++;
      const to = new THREE.Vector3().subVectors(c.p, eye);
      const inView = to.clone().normalize().dot(fwd) > 0.45;
      let visible = false;
      if (inView && c.d < 55) visible = game.physics.lineOfSight(eye, c.p.clone().setY(c.p.y + 1.4));
      const score = c.w * 3 + Math.random() - (visible ? 4 : 0) - (c.d > 60 ? 0.5 : 0);
      if (score > bestScore) { bestScore = score; best = c.p; }
    }
    if (!best) {
      // fallback: farthest point within a sane range
      let far = 0;
      for (const zone in this.points) for (const p of this.points[zone]) {
        const d = p.distanceTo(pp);
        if (d > far && d < 120) { far = d; best = p; }
      }
    }
    if (!best) return null;
    this.recent.push(best); if (this.recent.length > 6) this.recent.shift();
    // jitter onto a walkable neighbour
    const nav = game.nav;
    const layer = layerAt(best);
    const out = best.clone();
    const n = nav.randomWalkable(layer, best, 0, 2.5, 6);
    if (n) { out.x = n.x; out.z = n.z; }
    out.y = Math.max(best.y, game.physics.terrainHeight(out.x, out.z) > -5 ? game.physics.terrainHeight(out.x, out.z) : best.y) + 0.05;
    if (layer !== 0) out.y = best.y + 0.05;
    return out;
  }

  /** Points around a centre (for boss summons). */
  around(center, r0, r1) {
    const p = this.game.nav.randomWalkable(layerAt(center), center, r0, r1, 20);
    if (!p) return center.clone();
    p.y = Math.max(p.y, this.game.physics.terrainHeight(p.x, p.z)) + 0.05;
    return p;
  }
}
