import * as THREE from 'three';

/**
 * CPU-simulated particle pool rendered as a single THREE.Points draw call.
 * Two pools: additive (sparks, spirit energy, embers) and normal-blended (blood, dust, ash).
 */
const VERT = `
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = alpha;
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, vAlpha * soft);
}`;

class Pool {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0, drag = 0, grow = 0) {
    let i = this.n;
    if (i >= this.max) { i = Math.floor(Math.random() * this.max); } else this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
    this.alpha[i] = 1;
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[j * 3 + k]; this.vel[i * 3 + k] = this.vel[j * 3 + k]; this.col[i * 3 + k] = this.col[j * 3 + k]; }
          this.size[i] = this.size[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.grow[i] = this.grow[j]; this.alpha[i] = this.alpha[j];
        }
        i--;
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.5);
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.pcolor.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }

  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

export class ParticleEffects {
  constructor(scene, quality) {
    const mul = quality.particles || 1;
    this.add = new Pool(scene, Math.floor(1500 * mul), true);
    this.norm = new Pool(scene, Math.floor(1500 * mul), false);
    this.mul = mul;
    this._c = new THREE.Color();
  }

  burst(pool, p, count, { color, speed = 3, size = 0.1, life = 0.6, grav = 0, drag = 1, up = 0, spread = 1, dir = null, grow = 0, jitterColor = 0 }) {
    const n = Math.max(1, Math.round(count * this.mul));
    const c = this._c;
    for (let i = 0; i < n; i++) {
      let vx = (Math.random() - 0.5) * 2, vy = (Math.random() - 0.5) * 2, vz = (Math.random() - 0.5) * 2;
      if (dir) { vx = dir.x + vx * spread; vy = dir.y + vy * spread; vz = dir.z + vz * spread; }
      const l = Math.hypot(vx, vy, vz) || 1;
      const s = speed * (0.4 + Math.random() * 0.8);
      c.set(color);
      if (jitterColor) c.offsetHSL(0, 0, (Math.random() - 0.5) * jitterColor);
      pool.emit(p.x, p.y, p.z, vx / l * s, vy / l * s + up, vz / l * s, c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), grav, drag, grow);
    }
  }

  update(dt) { this.add.update(dt); this.norm.update(dt); }
  clear() { this.add.clear(); this.norm.clear(); }
}
