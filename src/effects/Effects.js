import * as THREE from 'three';
import { ParticleEffects } from './ParticleEffects.js';
import { DamageEffects } from './DamageEffects.js';

/** Facade for all gameplay VFX: muzzle flashes, tracers, impacts, decals, blood, spirit energy, shockwaves. */
export class Effects {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.particles = new ParticleEffects(scene, game.settings.quality);
    this.screen = new DamageEffects();
    this.ambientBoost = 0;
    // world muzzle light
    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 14, 1.6);
    scene.add(this.muzzleLight);
    this.muzzleTimer = 0;
    // tracers
    this.tracers = [];
    const tmat = new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 20; i++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, tmat.clone()); l.visible = false; l.frustumCulled = false; scene.add(l);
      this.tracers.push({ line: l, t: 0 });
    }
    this.tracerIdx = 0;
    // decals
    const holeTex = makeHoleTexture();
    this.holeMat = new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.holes = [];
    const holeGeo = new THREE.PlaneGeometry(0.14, 0.14);
    for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(holeGeo, this.holeMat); m.visible = false; scene.add(m); this.holes.push(m); }
    this.holeIdx = 0;
    this.bloodMat = game.world.m.blood;
    this.bloods = [];
    const bGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(bGeo, this.bloodMat); m.visible = false; m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m); this.bloods.push(m); }
    this.bloodIdx = 0;
    // shockwave rings
    this.rings = [];
    const rGeo = new THREE.RingGeometry(0.85, 1, 48); rGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; scene.add(m); this.rings.push({ mesh: m, t: 0, r: 1 });
    }
    this.ringIdx = 0;
    this.c = {
      spark: new THREE.Color(0xffc070), dust: new THREE.Color(0x6a6660), blood: new THREE.Color(0x6a0808), bloodDark: new THREE.Color(0x3a0404),
      ecto: new THREE.Color(0x8fb6ff), ectoG: new THREE.Color(0x7affc0), holy: new THREE.Color(0xd8ecff), ash: new THREE.Color(0x2a2626), ember: new THREE.Color(0xff5a20), smoke: new THREE.Color(0x3a3c40),
    };
  }

  get p() { return this.particles; }

  muzzleFlash(muzzleObj, color, intensity) {
    const cam = this.game.camera;
    const pos = cam.position.clone().add(new THREE.Vector3(0.15, -0.1, -0.8).applyQuaternion(cam.quaternion));
    this.muzzleLight.position.copy(pos);
    this.muzzleLight.color.set(color);
    this.muzzleLight.intensity = 22 * intensity;
    this.muzzleTimer = 0.06;
    this.p.burst(this.p.norm, pos, 3, { color: this.c.smoke, speed: 0.6, size: 0.18, life: 0.6, up: 0.4, drag: 2, grow: 0.4 });
  }

  tracer(weapon, point) {
    if (weapon.isMelee || weapon.id === 'crossbow') return;
    if (weapon.id === 'shotgun' && Math.random() < 0.6) return;
    const cam = this.game.camera;
    const from = cam.position.clone().add(new THREE.Vector3(0.12, -0.1, -0.7).applyQuaternion(cam.quaternion));
    const tr = this.tracers[this.tracerIdx++ % this.tracers.length];
    const a = tr.line.geometry.attributes.position.array;
    // only draw a segment of the path for a streak look
    const dir = point.clone().sub(from);
    const len = dir.length();
    const start = from.clone().addScaledVector(dir, Math.min(0.5, 2 / Math.max(len, 0.01)));
    a[0] = start.x; a[1] = start.y; a[2] = start.z; a[3] = point.x; a[4] = point.y; a[5] = point.z;
    tr.line.geometry.attributes.position.needsUpdate = true;
    tr.line.visible = true; tr.t = 0.05;
  }

  impact(point, normal, box) {
    const n = normal || new THREE.Vector3(0, 1, 0);
    this.p.burst(this.p.add, point, 6, { color: this.c.spark, speed: 4, size: 0.05, life: 0.25, grav: 9, drag: 1, dir: n, spread: 0.8 });
    this.p.burst(this.p.norm, point, 4, { color: this.c.dust, speed: 1.2, size: 0.2, life: 0.8, grav: 0.5, drag: 2, dir: n, spread: 0.6, grow: 0.3 });
    if (box && !box.invisible) {
      const h = this.holes[this.holeIdx++ % this.holes.length];
      h.position.copy(point).addScaledVector(n, 0.01);
      h.lookAt(point.clone().add(n));
      h.rotation.z = Math.random() * Math.PI;
      h.visible = true;
    }
  }

  blood(point, dir, scale = 1) {
    const back = dir.clone().multiplyScalar(-1);
    this.p.burst(this.p.norm, point, 10 * scale, { color: this.c.blood, speed: 3, size: 0.08 * scale, life: 0.7, grav: 9, drag: 0.5, dir: back, spread: 0.9, jitterColor: 0.15 });
    this.p.burst(this.p.norm, point, 6 * scale, { color: this.c.bloodDark, speed: 2.2, size: 0.07, life: 0.6, grav: 9, drag: 0.5, dir: dir, spread: 0.6 });
    if (Math.random() < 0.35) this.floorBlood(point, 0.6 + Math.random() * 0.8 * scale);
  }

  floorBlood(point, size) {
    const physics = this.game.physics;
    const gy = physics.groundHeight(point.x, point.z, point.y, 0.2);
    if (gy === -Infinity || point.y - gy > 3) return;
    const b = this.bloods[this.bloodIdx++ % this.bloods.length];
    b.position.set(point.x + (Math.random() - 0.5) * 0.4, gy + 0.02, point.z + (Math.random() - 0.5) * 0.4);
    b.scale.set(size, size, 1); b.rotation.z = Math.random() * 6;
    b.visible = true;
  }

  bloodBurst(p) {
    this.p.burst(this.p.norm, p, 30, { color: this.c.blood, speed: 4, size: 0.12, life: 0.9, grav: 6, drag: 1 });
    this.p.burst(this.p.add, p, 12, { color: new THREE.Color(0xff2010), speed: 2, size: 0.2, life: 0.5, drag: 2 });
  }

  ectoplasm(p, color) {
    this.p.burst(this.p.add, p, 14, { color: color || this.c.ecto, speed: 2.2, size: 0.18, life: 0.8, grav: -0.6, drag: 1.5, grow: 0.2 });
  }

  holyBurst(p) {
    this.p.burst(this.p.add, p, 22, { color: this.c.holy, speed: 4.5, size: 0.12, life: 0.5, grav: 1, drag: 2.2 });
  }

  orbBurst(p, color) {
    this.p.burst(this.p.add, p, 18, { color, speed: 3, size: 0.18, life: 0.5, drag: 2 });
  }

  dashTrail(e) {
    const p = e.bodySphere.c;
    this.p.burst(this.p.norm, p, 14, { color: new THREE.Color(0x0c0a10), speed: 1, size: 0.5, life: 0.7, drag: 2, grow: 0.6, up: 0.3 });
  }

  shockwave(pos, radius, color) {
    const r = this.rings[this.ringIdx++ % this.rings.length];
    r.mesh.position.copy(pos).setY(pos.y + 0.15);
    r.mesh.material.color.set(color);
    r.mesh.visible = true; r.t = 0; r.r = radius;
    this.p.burst(this.p.norm, pos, 30, { color: this.c.dust, speed: radius * 1.2, size: 0.5, life: 0.8, drag: 2.5, up: 0.5, grow: 0.8 });
  }

  spawnEffect(e) {
    const p = e.body.pos.clone();
    if (e.family === 'ghost') {
      this.p.burst(this.p.add, p.clone().setY(p.y + 0.3), 30, { color: e.type === 'revenant' ? this.c.ectoG : this.c.ecto, speed: 1.4, size: 0.25, life: 1.4, grav: -1.5, drag: 1, grow: 0.2 });
      this.p.burst(this.p.norm, p, 12, { color: new THREE.Color(0x2a221a), speed: 1.8, size: 0.2, life: 0.9, grav: 6, up: 2 });
    } else if (e.family === 'vampire') {
      this.p.burst(this.p.norm, p.clone().setY(p.y + 1), 26, { color: new THREE.Color(0x08070a), speed: 2.4, size: 0.45, life: 1.0, drag: 2, grow: 0.6, up: 0.4 });
    } else if (e.family === 'boss') {
      this.shockwave(p, 12, 0xff2010);
      this.p.burst(this.p.add, p.clone().setY(p.y + 2), 60, { color: this.c.ember, speed: 5, size: 0.25, life: 1.5, grav: -0.5, drag: 1 });
    }
  }

  enemyDeath(e) {
    const p = e.bodySphere.c.clone();
    if (e.family === 'ghost') {
      this.p.burst(this.p.add, p, 50, { color: e.type === 'revenant' ? this.c.ectoG : this.c.ecto, speed: 3.5, size: 0.22, life: 1.2, grav: -1, drag: 1.2, grow: 0.3 });
      this.game.lightPool.flickerAll(0.4);
    } else if (e.family === 'vampire') {
      this.p.burst(this.p.norm, p, 40, { color: this.c.ash, speed: 1.6, size: 0.18, life: 2.2, grav: -0.3, drag: 1, up: 0.6, grow: 0.15 });
      this.p.burst(this.p.add, p, 20, { color: this.c.ember, speed: 1.4, size: 0.08, life: 1.6, grav: -0.8, drag: 1 });
      this.floorBlood(p, 1.4);
    } else {
      this.blood(p, new THREE.Vector3(0, -1, 0), e.family === 'boss' ? 4 : 2);
      this.floorBlood(p, e.family === 'boss' ? 4 : 1.8);
      if (e.family === 'boss') {
        this.shockwave(e.body.pos.clone(), 16, 0xff6020);
        this.p.burst(this.p.add, p, 120, { color: this.c.ember, speed: 7, size: 0.3, life: 2.5, grav: -0.5, drag: 0.8 });
        this.screen.flash(1);
      }
    }
  }

  update(dt) {
    this.particles.update(dt);
    if (this.muzzleTimer > 0) { this.muzzleTimer -= dt; if (this.muzzleTimer <= 0) this.muzzleLight.intensity = 0; }
    for (const t of this.tracers) if (t.t > 0) { t.t -= dt; t.line.material.opacity = Math.max(0, t.t / 0.05) * 0.6; if (t.t <= 0) t.line.visible = false; }
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / 0.7;
      r.mesh.scale.setScalar(0.5 + k * r.r);
      r.mesh.material.opacity = Math.max(0, 1 - k) * 0.8;
      if (k >= 1) r.mesh.visible = false;
    }
    this.ambientBoost = Math.max(0, this.ambientBoost - dt * 2);
    this.screen.update(dt, this.game.player.health.hp / this.game.player.health.max);
  }

  clear() {
    this.particles.clear();
    for (const h of this.holes) h.visible = false;
    for (const b of this.bloods) b.visible = false;
    for (const r of this.rings) r.mesh.visible = false;
    for (const t of this.tracers) { t.line.visible = false; t.t = 0; }
    this.screen.reset();
  }
}

function makeHoleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.35, 'rgba(10,8,6,0.9)'); g.addColorStop(0.6, 'rgba(30,25,20,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
