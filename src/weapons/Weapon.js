import * as THREE from 'three';

/**
 * Generic weapon: ammo, fire timing, reload, recoil and viewmodel animation.
 * Concrete weapons (Pistol.js etc.) supply a config + model builder.
 *
 * config: {
 *   id, name, slot, type: 'hitscan'|'projectile'|'melee',
 *   damage, fireRate (shots/s), magSize, reserveMax, reserveStart, reloadTime,
 *   recoil: {pitch, yaw, kick}, range, spread, adsSpread, pellets, auto, adsFov,
 *   ghostMul, headMul, falloff: [start, end, minMul], sound, special
 * }
 */
export class Weapon {
  constructor(config, model) {
    this.cfg = config;
    this.model = model;
    this.owned = !!config.startOwned;
    this.mag = config.magSize;
    this.reserve = config.reserveStart;
    this.cooldown = 0;
    this.reloading = 0;
    this.reloadTotal = 0;
    this.swing = 0;            // melee swing timer
    this.swingHitDone = false;
    this.kick = 0;             // viewmodel kick back
    this.kickRot = 0;
    this.flashTimer = 0;
    this.triggerHeld = false;
    this.group = model.group;
    this.group.visible = false;
    this.swayX = 0; this.swayY = 0;
  }

  get id() { return this.cfg.id; }
  get name() { return this.cfg.name; }
  get isMelee() { return this.cfg.type === 'melee'; }
  get busy() { return this.reloading > 0 || this.swing > 0; }

  reserveCap(mods) { return Math.round(this.cfg.reserveMax * (mods.ammoMul || 1)); }

  canReload() { return !this.isMelee && this.reloading <= 0 && this.mag < this.cfg.magSize && this.reserve > 0; }

  startReload(mods, audio) {
    if (!this.canReload()) return false;
    this.reloadTotal = this.cfg.reloadTime * (mods.reloadMul || 1);
    this.reloading = this.reloadTotal;
    audio.play('reloadStart');
    return true;
  }

  finishReload(audio) {
    const need = this.cfg.magSize - this.mag;
    const take = Math.min(need, this.reserve);
    this.mag += take; this.reserve -= take;
    audio.play('reloadEnd');
  }

  cancelReload() { this.reloading = 0; this.swing = 0; }

  /**
   * Try to fire. `ctx` = { game, origin, dir, mods, ads, moving, sprinting }.
   * Returns true when a shot happened.
   */
  tryFire(ctx, pressed) {
    const cfg = this.cfg;
    // semi-auto: remember a press for a moment so quick taps (touch!) aren't lost to the fire-rate cooldown
    if (pressed) this.pressBuffer = 0.22;
    if (this.cooldown > 0 || this.reloading > 0 || this.swing > 0) return false;
    if (!cfg.auto && !(this.pressBuffer > 0)) return false;
    this.pressBuffer = 0;
    if (this.isMelee) {
      this.swing = 0.62 / (ctx.mods.meleeSpeedMul || 1);
      this.swingTotal = this.swing;
      this.swingHitDone = false;
      this.cooldown = this.swing;
      ctx.game.audio.play('axeSwing');
      return true;
    }
    if (this.mag <= 0) {
      if (pressed) ctx.game.audio.play('dryfire');
      if (pressed && this.reserve <= 0) ctx.game.hud.message('Out of ammo · grab an ammo crate or use the axe [5]', 2);
      if (this.reserve > 0) this.startReload(ctx.mods, ctx.game.audio);
      this.cooldown = 0.25;
      return false;
    }
    this.mag--;
    this.cooldown = 1 / cfg.fireRate;
    this.kick = 1;
    this.flashTimer = 0.05;
    ctx.game.audio.play(cfg.sound);
    const spreadBase = ctx.ads ? cfg.adsSpread : cfg.spread;
    const spread = spreadBase * (ctx.moving ? 1.6 : 1) * (ctx.sprinting ? 2 : 1);
    const dmg = cfg.damage * (ctx.mods.damageMul || 1);
    if (cfg.type === 'hitscan') {
      for (let i = 0; i < (cfg.pellets || 1); i++) {
        const d = jitter(ctx.dir, spread);
        ctx.game.combat.hitscan(ctx.origin, d, cfg.range, dmg, this, i === 0);
      }
    } else if (cfg.type === 'projectile') {
      ctx.game.projectiles.fireBolt(ctx.origin, jitter(ctx.dir, spread * 0.5), dmg, this);
      if (this.model.bolt) this.model.bolt.visible = false;
    }
    const r = cfg.recoil;
    const adsMul = ctx.ads ? 0.6 : 1;
    ctx.game.player.controller.addRecoil(r.pitch * adsMul, (Math.random() - 0.5) * r.yaw * adsMul);
    ctx.game.player.controller.addShake(r.shake || 0.05);
    ctx.game.effects.muzzleFlash(this.model.muzzle, cfg.flashColor || 0xffb060, cfg.flashIntensity || 1);
    ctx.game.noise(ctx.origin, cfg.noise || 45);
    if (this.mag === 0 && this.reserve > 0) this._autoReloadIn = 0.35;
    return true;
  }

  /** Called every frame while equipped. */
  update(dt, game, view) {
    const cfg = this.cfg;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.pressBuffer > 0) this.pressBuffer -= dt;
    if (this.flashTimer > 0) { this.flashTimer -= dt; if (this.model.flash) this.model.flash.visible = this.flashTimer > 0; }
    else if (this.model.flash) this.model.flash.visible = false;
    if (this._autoReloadIn !== undefined) {
      this._autoReloadIn -= dt;
      if (this._autoReloadIn <= 0) { this._autoReloadIn = undefined; this.startReload(game.player.mods, game.audio); }
    }
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; this.finishReload(game.audio); if (this.model.bolt) this.model.bolt.visible = true; }
    }
    if (this.model.bolt && this.reloading <= 0 && this.cooldown <= 0 && this.mag > 0) this.model.bolt.visible = true;
    if (this.swing > 0) {
      this.swing -= dt;
      const t = 1 - this.swing / (this.swingTotal || 0.62);
      if (!this.swingHitDone && t > 0.38) { this.swingHitDone = true; game.combat.melee(this); }
      if (this.swing <= 0) this.swing = 0;
    }
    this.kick = Math.max(0, this.kick - dt * (cfg.kickRecover || 9));
    this.animate(dt, view);
  }

  /** Viewmodel pose. view = {ads, moving, sprinting, bobPhase, bobAmount, mouseDX, mouseDY, equip} */
  animate(dt, view) {
    const mdl = this.model, g = this.group, gun = mdl.gun;
    const cfg = this.cfg;
    const ads = view.ads;
    // sway from mouse movement
    this.swayX += ((-view.mouseDX * 0.0006) - this.swayX) * Math.min(1, dt * 10);
    this.swayY += ((view.mouseDY * 0.0006) - this.swayY) * Math.min(1, dt * 10);
    const base = mdl.hipPos.clone().lerp(mdl.adsPos, ads);
    const bob = view.bobAmount * (1 - ads * 0.85);
    // blend into / out of the sprint pose smoothly instead of snapping
    const sprintTarget = view.sprinting && !this.busy && this.cooldown <= 0 ? 1 : 0;
    this.sprintBlend = (this.sprintBlend || 0) + (sprintTarget - (this.sprintBlend || 0)) * Math.min(1, dt * 7);
    const sb = this.sprintBlend;
    const bx = Math.cos(view.bobPhase) * 0.012 * bob * (1 + 0.8 * sb);
    const by = Math.abs(Math.sin(view.bobPhase)) * 0.012 * bob * (1 + 0.8 * sb);
    g.position.set(base.x + bx + this.swayX, base.y - by + this.swayY - view.equip * 0.35, base.z + this.kick * (cfg.kickBack || 0.06));
    let rx = this.kick * (cfg.kickRot || 0.12) + this.swayY * 2, ry = this.swayX * 2, rz = 0;
    rx -= 0.25 * sb; ry += 0.55 * sb; rz += 0.25 * sb; g.position.x -= 0.03 * sb;
    // reload animation: dip & tilt
    if (this.reloading > 0) {
      const t = 1 - this.reloading / this.reloadTotal;
      const k = Math.sin(Math.min(1, t) * Math.PI);
      rx -= 0.5 * k; rz += 0.6 * k; g.position.y -= 0.08 * k;
      if (mdl.mag) mdl.mag.position.y = -0.08 - 0.15 * Math.sin(Math.min(1, t * 1.6) * Math.PI);
      if (mdl.pump) mdl.pump.position.z = -0.4 + 0.08 * Math.abs(Math.sin(t * Math.PI * 3));
    } else if (mdl.mag) mdl.mag.position.y = -0.08;
    // shotgun pump after shot
    if (mdl.pump && this.reloading <= 0) {
      const c = Math.max(0, this.cooldown) * cfg.fireRate;
      mdl.pump.position.z = -0.4 + 0.08 * Math.sin(Math.min(1, Math.max(0, (1 - c) * 1.4)) * Math.PI) * (c > 0 ? 1 : 0);
      if (mdl.pumpHand) mdl.pumpHand.position.z = mdl.pump.position.z;
    }
    if (mdl.slide) mdl.slide.position.z = -0.06 + this.kick * 0.03;
    // melee swing: wind up, slash diagonally down-left, recover
    if (this.isMelee) {
      const total = 0.62;
      const t = this.swing > 0 ? 1 - this.swing / (this.swingTotal || total) : 0;
      if (this.swing > 0) {
        const wind = Math.min(1, t / 0.3), slash = Math.max(0, Math.min(1, (t - 0.3) / 0.2)), rec = Math.max(0, (t - 0.5) / 0.5);
        rx += 0.9 * wind - 2.2 * slash + 1.3 * rec * slash;
        ry += 0.6 * wind - 1.3 * slash + 0.7 * rec;
        rz += -0.6 * wind + 0.9 * slash - 0.3 * rec;
        g.position.x += -0.25 * slash * (1 - rec) + 0.05 * wind;
        g.position.y += 0.12 * wind - 0.1 * slash;
      }
    }
    g.rotation.set(rx, ry, rz);
    if (gun && cfg.gunTilt) gun.rotation.z = cfg.gunTilt;
  }
}

const _up = new THREE.Vector3(0, 1, 0);
export function jitter(dir, spread) {
  if (spread <= 0) return dir.clone();
  const right = new THREE.Vector3().crossVectors(dir, _up).normalize();
  if (right.lengthSq() < 0.1) right.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
  return dir.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
}
