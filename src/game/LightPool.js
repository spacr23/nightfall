import * as THREE from 'three';

/**
 * A fixed number of real PointLights is assigned each few frames to the nearest "virtual" lights
 * registered by the world. Keeps shader light counts constant (no recompiles) and the GPU happy.
 */
export class LightPool {
  constructor(scene, virtualLights, count) {
    this.scene = scene;
    this.virtual = virtualLights;
    this.lights = [];
    this.assigned = [];
    this.timer = 0;
    this.globalFlicker = 0;
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffaa66, 0, 10, 1.4);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
      this.assigned.push(null);
    }
  }

  /** Temporarily make every light flicker violently (ghost presence / scare). */
  flickerAll(seconds) { this.globalFlicker = Math.max(this.globalFlicker, seconds); }

  update(dt, t, camPos) {
    this.timer -= dt;
    if (this.globalFlicker > 0) this.globalFlicker -= dt;
    if (this.timer <= 0) {
      this.timer = 0.25;
      const scored = [];
      for (const v of this.virtual) {
        const d2 = v.pos.distanceToSquared(camPos);
        if (d2 > 55 * 55) continue;
        scored.push([d2 / (v.important ? 4 : 1), v]);
      }
      scored.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < this.lights.length; i++) this.assigned[i] = scored[i] ? scored[i][1] : null;
    }
    const gf = this.globalFlicker > 0;
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i], v = this.assigned[i];
      if (!v) { l.intensity = 0; continue; }
      l.position.copy(v.pos);
      l.color.copy(v.color);
      l.distance = v.distance;
      let k = 1;
      if (v.flicker > 0) {
        const s = v.speed;
        const n = Math.sin(t * 7.3 * s + v.phase) * 0.5 + Math.sin(t * 13.1 * s + v.phase * 2) * 0.3 + Math.sin(t * 29.7 * s + v.phase * 3) * 0.2;
        k = 1 - v.flicker * 0.5 * (n * 0.5 + 0.5);
        // occasional dropouts for broken bulbs
        if (v.flicker > 0.7 && Math.sin(t * 2.1 + v.phase) > 0.93) k *= 0.1;
      }
      if (gf) k *= Math.random() < 0.35 ? 0.05 : 0.6 + Math.random() * 0.6;
      // fade out with distance to avoid popping when reassigned
      const d = v.pos.distanceTo(camPos);
      const fade = Math.min(1, Math.max(0, (55 - d) / 12));
      l.intensity = v.intensity * k * fade * 4.0;
    }
  }
}
