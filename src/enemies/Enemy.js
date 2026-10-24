import * as THREE from 'three';
import { EnemyAI } from './EnemyAI.js';
import { layerAt } from '../game/NavGrid.js';

let UID = 1;
const _v = new THREE.Vector3();

/**
 * Base enemy: stats, body physics, hit detection (head/body spheres), damage, animation and death.
 * Behaviour lives in EnemyAI (shared state machine) + per-type hooks (special abilities).
 */
export class Enemy {
  constructor(game, cfg, model, pos, waveScale) {
    waveScale = waveScale || {};
    this.uid = UID++;
    this.game = game;
    this.cfg = cfg;
    this.type = cfg.type;
    this.family = cfg.family;   // 'vampire' | 'werewolf' | 'ghost' | 'boss'
    this.model = model;
    this.root = model.root;
    this.parts = model.parts;
    this.hpMul = waveScale.hp || 1;
    this.dmgMul = waveScale.dmg || 1;
    this.speedMul = (waveScale.speed || 1) * (0.92 + Math.random() * 0.16); // individual variance
    this.aggression = waveScale.aggression || 1;
    this.maxHp = cfg.hp * this.hpMul;
    this.hp = this.maxHp;
    this.body = { pos: pos.clone(), vel: new THREE.Vector3(), halfW: cfg.halfW, height: cfg.height, onGround: false, flying: false };
    this.yaw = Math.random() * Math.PI * 2;
    this.alive = true;
    this.removed = false;
    this.deathTime = 0;
    this.hitFlash = 0;
    this.animPhase = Math.random() * 10;
    this.attackAnim = 0;     // 0..1 while attacking
    this.roarAnim = 0;
    this.staggerTime = 0;
    this.spawnFx = 1;        // fade-in
    this.visibleAlpha = 1;
    this.phased = false;
    this.headSphere = { c: new THREE.Vector3(), r: cfg.headR * model.heightScale };
    this.bodySphere = { c: new THREE.Vector3(), r: cfg.bodyR * model.heightScale };
    this.layer = layerAt(pos);
    this.ai = new EnemyAI(this);
    this.root.position.copy(pos);
    this.root.traverse((o) => { if (o.isMesh) o.userData.enemy = this; });
    this.baseEmissive = model.mats.map((m) => (m.emissive ? m.emissive.clone() : null));
    this.baseOpacity = model.mats.map((m) => m.opacity ?? 1);
    if (model.transparent) for (const m of model.mats) m.transparent = true;
    game.scene.add(this.root);
    this.sfxTimer = 2 + Math.random() * 6;
  }

  get pos() { return this.body.pos; }
  get isBoss() { return this.family === 'boss'; }
  get isElite() { return !!this.cfg.elite; }

  distanceToPlayer() { return this.body.pos.distanceTo(this.game.player.position); }

  update(dt) {
    if (!this.alive) { this.updateDeath(dt); return; }
    if (this.spawnFx > 0) this.spawnFx = Math.max(0, this.spawnFx - dt * 1.5);
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.ai.update(dt);
    this.layer = layerAt(this.body.pos);
    this.animate(dt);
    this.root.position.copy(this.body.pos);
    this.root.rotation.y = this.yaw;
    this.applyMaterialFx();
    this.root.updateMatrixWorld(true);
    this.model.headMesh.getWorldPosition(this.headSphere.c);
    this.model.bodyMesh.getWorldPosition(this.bodySphere.c);
    // ambient vocalisations
    this.sfxTimer -= dt;
    if (this.sfxTimer <= 0) {
      this.sfxTimer = (this.cfg.sfxInterval || 6) * (0.6 + Math.random() * 0.8);
      if (this.distanceToPlayer() < 45) this.game.audio.play(this.cfg.idleSound, { pos: this.headSphere.c });
    }
  }

  applyMaterialFx() {
    const flash = this.hitFlash > 0 ? this.hitFlash / 0.12 : 0;
    const fade = 1 - this.spawnFx;
    const phaseAlpha = this.phased ? 0.25 : 1;
    this.model.mats.forEach((m, i) => {
      if (m.emissive && this.baseEmissive[i]) {
        m.emissive.copy(this.baseEmissive[i]);
        if (flash > 0) m.emissive.lerp(new THREE.Color(0xff3020), flash * 0.8);
      }
      if (this.model.transparent || this.spawnFx > 0 || m.transparent) {
        m.opacity = this.baseOpacity[i] * fade * phaseAlpha;
      }
    });
  }

  /** Ray test against head and body spheres. Returns {t, part} or null. */
  hitTest(o, d, maxT) {
    if (!this.alive) return null;
    let best = null;
    for (const [s, part] of [[this.headSphere, 'head'], [this.bodySphere, 'body']]) {
      const t = raySphereT(o, d, s.c, s.r);
      if (t >= 0 && t < maxT && (!best || t < best.t)) best = { t, part };
    }
    // legs: a cheap extra sphere between body and feet
    if (!best) {
      _v.copy(this.body.pos); _v.y += this.cfg.height * 0.28 * this.model.heightScale;
      const t = raySphereT(o, d, _v, this.bodySphere.r * 0.8);
      if (t >= 0 && t < maxT) best = { t, part: 'legs' };
    }
    return best;
  }

  /**
   * Apply damage. info = {part, weapon, dir, point}. Returns {killed, dealt}.
   */
  takeDamage(amount, info = {}) {
    if (!this.alive) return { killed: false, dealt: 0 };
    let dmg = amount;
    const w = info.weapon;
    if (info.part === 'head') dmg *= (w && w.cfg.headMul) || 2;
    else if (info.part === 'legs') dmg *= 0.75;
    if (w) {
      if (this.family === 'ghost') dmg *= w.cfg.ghostMul ?? 1;
      if (this.cfg.crossbowMul && w.id === 'crossbow') dmg *= this.cfg.crossbowMul;
      if (this.family === 'vampire' && w.id === 'shotgun') dmg *= 1.15; // blessed iron
    }
    dmg *= this.cfg.damageTakenMul || 1;
    this.hp -= dmg;
    this.hitFlash = 0.12;
    this.ai.onDamaged(info);
    if (this.hp <= 0) { this.die(info); return { killed: true, dealt: dmg }; }
    if (!this.cfg.noStagger && (dmg >= this.cfg.staggerThreshold || (info.part === 'head' && Math.random() < 0.25))) this.ai.stagger(0.35 + Math.random() * 0.25);
    return { killed: false, dealt: dmg };
  }

  die(info) {
    this.alive = false;
    this.hp = 0;
    this.deathTime = 0;
    this.deathDir = info.dir ? info.dir.clone() : new THREE.Vector3(0, 0, -1);
    this.game.audio.play(this.family === 'ghost' ? 'ghostDeath' : 'enemyDeath', { pos: this.bodySphere.c });
    this.game.effects.enemyDeath(this);
    this.game.onEnemyKilled(this, info);
  }

  updateDeath(dt) {
    this.deathTime += dt;
    const t = this.deathTime;
    if (this.family === 'ghost') {
      const k = Math.min(1, t / 0.9);
      this.root.scale.setScalar(this.model.heightScale * (1 + k * 0.6));
      this.root.position.y = this.body.pos.y + k * 1.2;
      this.model.mats.forEach((m, i) => { m.transparent = true; m.opacity = this.baseOpacity[i] * (1 - k); });
      if (k >= 1) this.remove();
      return;
    }
    // fall over backwards (away from the hit) and sink into the ground
    const fall = Math.min(1, t / 0.55);
    const ease = 1 - (1 - fall) * (1 - fall);
    this.root.rotation.x = -ease * Math.PI / 2 * 0.95;
    if (this.parts.torso) this.parts.torso.rotation.x = 0.2 * ease;
    if (this.parts.shoulderL) { this.parts.shoulderL.rotation.x = -1.2 * ease; this.parts.shoulderR.rotation.x = -1.4 * ease; }
    if (t > 3.5) {
      this.root.position.y -= dt * 0.5;
      if (this.family === 'vampire') this.model.mats.forEach((m) => { if (m.color) m.color.multiplyScalar(0.97); });
    }
    if (t > 5.5) this.remove();
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    this.game.scene.remove(this.root);
  }

  // ------------------------------------------------------------------ animation
  animate(dt) {
    const P = this.parts;
    const speed = Math.hypot(this.body.vel.x, this.body.vel.z);
    const runSpeed = this.cfg.runSpeed;
    const gait = Math.min(1.3, speed / Math.max(0.1, runSpeed * 0.6));
    this.animPhase += dt * (2.2 + speed * (this.cfg.gaitFreq || 1.6));
    const ph = this.animPhase;
    const swing = Math.sin(ph) * 0.75 * gait;
    const fam = this.family;
    if (P.legL) {
      P.legL.rotation.x = swing; P.legR.rotation.x = -swing;
      P.kneeL.rotation.x = Math.max(0, -Math.sin(ph)) * 0.9 * gait + (fam === 'werewolf' ? 0.1 : 0);
      P.kneeR.rotation.x = Math.max(0, Math.sin(ph)) * 0.9 * gait + (fam === 'werewolf' ? 0.1 : 0);
    }
    const bob = Math.abs(Math.sin(ph)) * 0.05 * gait;
    const baseHips = this._hipsY ?? (this._hipsY = P.hips.position.y);
    P.hips.position.y = baseHips + bob + (fam === 'ghost' ? 0.35 + Math.sin(ph * 0.5) * 0.12 : 0);
    // arms
    const att = this.attackAnim;
    const armBase = fam === 'werewolf' ? -0.35 : fam === 'ghost' ? -0.9 : fam === 'boss' ? -0.3 : 0.05;
    let aL = armBase - swing * 0.6, aR = armBase + swing * 0.6;
    if (fam === 'vampire' && speed > runSpeed * 0.7) { aL = 0.9; aR = 0.9; } // arms swept back when running
    if (att > 0) {
      // wind up then slash
      const up = Math.sin(Math.min(1, att / 0.5) * Math.PI / 2);
      const slash = att > 0.5 ? (att - 0.5) / 0.5 : 0;
      aR = -2.4 * up + 2.6 * slash;
      aL = -1.6 * up + 1.8 * slash * (fam === 'werewolf' || fam === 'boss' ? 1 : 0.3);
    }
    if (P.shoulderL) { P.shoulderL.rotation.x = aL; P.shoulderR.rotation.x = aR; P.elbowL.rotation.x = -0.3 - gait * 0.2; P.elbowR.rotation.x = -0.3 - gait * 0.2 - att * 0.4; }
    if (P.shoulderL && fam === 'ghost') { P.shoulderL.rotation.z = -0.25 + Math.sin(ph * 0.7) * 0.15; P.shoulderR.rotation.z = 0.25 - Math.sin(ph * 0.7) * 0.15; }
    // torso lean
    const baseLean = fam === 'werewolf' ? 0.45 : fam === 'boss' ? 0.35 : 0;
    const lean = baseLean + gait * (fam === 'vampire' ? 0.35 : 0.15) - this.staggerTime * 1.2 + att * 0.2;
    P.torso.rotation.x += (lean - P.torso.rotation.x) * Math.min(1, dt * 8);
    P.torso.rotation.y = Math.sin(ph) * 0.08 * gait;
    // jaw
    if (P.jaw) P.jaw.rotation.x = 0.1 + Math.max(att, this.roarAnim) * 0.6 + (fam === 'ghost' ? 0.2 + Math.sin(ph * 3) * 0.1 : 0);
    if (P.cape) P.cape.rotation.x = 0.15 + gait * 0.6 + Math.sin(ph * 1.3) * 0.08;
    if (P.tail) P.tail.rotation.y = Math.sin(ph * 0.8) * 0.4;
    if (P.head && fam === 'ghost') { P.head.rotation.z = Math.sin(ph * 2.3) * 0.15; P.head.scale.set(1, 1 + Math.sin(ph * 4.1) * 0.06, 1); }
    if (P.aura) P.aura.material.opacity = (0.25 + 0.15 * Math.sin(ph * 2)) * (1 - this.spawnFx) * (this.phased ? 0.3 : 1);
    if (P.core) P.core.scale.setScalar(0.32 * (1 + 0.15 * Math.sin(ph * 3)));
    if (this.roarAnim > 0) { this.roarAnim -= dt; if (P.head) P.head.rotation.x = -0.4 * Math.sin(Math.min(1, this.roarAnim) * Math.PI); }
    else if (P.head) P.head.rotation.x *= 0.9;
    if (this.staggerTime > 0) this.staggerTime = Math.max(0, this.staggerTime - dt);
  }
}

function raySphereT(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t = -b - s;
  if (t >= 0) return t;
  return -b + s >= 0 ? 0 : -1;
}
