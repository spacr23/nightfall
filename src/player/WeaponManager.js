import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Pistol } from '../weapons/Pistol.js';
import { Shotgun } from '../weapons/Shotgun.js';
import { AssaultRifle } from '../weapons/AssaultRifle.js';
import { HolyCrossbow } from '../weapons/HolyCrossbow.js';
import { FireAxe } from '../weapons/FireAxe.js';

/**
 * Owns all weapons, the separate viewmodel scene (rendered on top of the world so guns never clip into walls),
 * switching, firing input, ADS and reloading.
 */
export class WeaponManager {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    this.list = [new Pistol(), new Shotgun(), new AssaultRifle(), new HolyCrossbow(), new FireAxe()];
    this.bySlot = {};
    for (const w of this.list) { this.bySlot[w.cfg.slot] = w; this.scene.add(w.group); }
    // viewmodel lighting
    this.hemi = new THREE.HemisphereLight(0x8090b0, 0x101015, 0.6);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xb0c0ff, 0.5); this.key.position.set(1, 2, 1); this.scene.add(this.key);
    this.torch = new THREE.SpotLight(0xffe8c0, 0, 6, 0.9, 0.6, 1); this.torch.position.set(0.1, 0.1, 0.3); this.torch.target.position.set(0, -0.2, -1); this.scene.add(this.torch, this.torch.target);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 3, 1.5); this.flashLight.position.set(0.1, 0, -0.6); this.scene.add(this.flashLight);
    // subtle reflections so metal parts read as metal instead of black
    const pmrem = new THREE.PMREMGenerator(game.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.22;
    this.current = null;
    this.last = null;
    this.pending = null;
    this.equip = 1; // 1 = fully lowered
    this.ads = false;
    this.reset();
  }

  reset() {
    for (const w of this.list) {
      w.owned = !!w.cfg.startOwned;
      w.mag = w.cfg.magSize; w.reserve = w.cfg.reserveStart;
      w.cooldown = 0; w.reloading = 0; w.swing = 0; w.group.visible = false;
    }
    this.current = null; this.last = null; this.pending = null;
    this.select(1, true);
  }

  give(id, fromPickup = true) {
    const w = this.list.find((x) => x.id === id);
    if (!w) return false;
    if (w.owned) {
      // duplicate pickup -> ammo
      const cap = w.reserveCap(this.game.player.mods);
      if (w.reserve >= cap) return false;
      w.reserve = Math.min(cap, w.reserve + w.cfg.magSize * 2);
      return true;
    }
    w.owned = true;
    w.mag = w.cfg.magSize;
    if (fromPickup) this.select(w.cfg.slot);
    return true;
  }

  /** Add ammo. weapon: id | 'any' (current or random owned) | 'all'. */
  addAmmo(weapon, amount) {
    const mods = this.game.player.mods;
    const fill = (w, amt) => { if (!w.owned || w.isMelee) return false; const cap = w.reserveCap(mods); if (w.reserve >= cap) return false; w.reserve = Math.min(cap, w.reserve + amt); return true; };
    if (weapon === 'all') { let any = false; for (const w of this.list) any = fill(w, w.reserveCap(mods)) || any; return any; }
    if (weapon === 'any') {
      const owned = this.list.filter((w) => w.owned && !w.isMelee && w.reserve < w.reserveCap(mods));
      if (!owned.length) return false;
      let any = false;
      for (const w of owned) any = fill(w, Math.ceil(w.cfg.magSize * 1.5)) || any;
      return any;
    }
    const w = this.list.find((x) => x.id === weapon);
    if (!w) return false;
    if (!w.owned) {
      // not owned: give to whatever is owned instead
      return this.addAmmo('any', amount);
    }
    return fill(w, amount);
  }

  select(slot, instant = false) {
    const w = this.bySlot[slot];
    if (!w || !w.owned || w === this.current) return;
    if (this.current) { this.current.cancelReload(); this.last = this.current; }
    this.pending = w;
    if (instant) { this._swap(); this.equip = 0; }
    this.game.audio.play('switch');
  }

  _swap() {
    if (this.current) this.current.group.visible = false;
    this.current = this.pending;
    this.pending = null;
    this.current.group.visible = true;
  }

  cycle(dir) {
    const owned = this.list.filter((w) => w.owned);
    if (!owned.length) return;
    const i = owned.indexOf(this.pending || this.current);
    const n = owned[(i + dir + owned.length) % owned.length];
    this.select(n.cfg.slot);
  }

  update(dt, input, view) {
    const game = this.game;
    // switching
    for (let s = 1; s <= 5; s++) if (input.wasPressed(`Digit${s}`) || input.wasPressed(`Numpad${s}`)) this.select(s);
    if (input.wasPressed('KeyQ') && this.last && this.last.owned) this.select(this.last.cfg.slot);
    const wheel = input.consumeWheel();
    if (wheel) this.cycle(wheel > 0 ? 1 : -1);
    if (this.pending) {
      this.equip = Math.min(1, this.equip + dt * 6);
      if (this.equip >= 1) this._swap();
    } else this.equip = Math.max(0, this.equip - dt * 5);

    const w = this.current;
    if (!w) return;
    const ready = !this.pending && this.equip < 0.3;
    this.ads = input.mouseDown(2) && !w.isMelee && !view.sprinting && ready && w.reloading <= 0;
    if (input.wasPressed('KeyR')) w.startReload(game.player.mods, game.audio);
    const firing = input.mouseDown(0);
    const pressed = input.mousePressed(0);
    if (ready && (firing || pressed || w.pressBuffer > 0)) {
      const cam = game.camera;
      const origin = cam.position.clone();
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      w.tryFire({ game, origin, dir, mods: game.player.mods, ads: this.ads, moving: view.moving, sprinting: view.sprinting }, pressed);
    }
    view.ads = this.ads ? 1 : 0;
    view.adsSmooth = game.player.controller.adsAmount;
    view.equip = this.equip;
    w.update(dt, game, { ...view, ads: game.player.controller.adsAmount });
    // light the viewmodel: flashlight + muzzle flash
    this.torch.intensity = game.player.flashlightOn ? 0.7 : 0;
    this.flashLight.intensity = w.flashTimer > 0 ? 6 * (w.cfg.flashIntensity || 1) : 0;
    this.flashLight.color.set(w.cfg.flashColor || 0xffb060);
    this.hemi.intensity = 0.3 + game.effects.ambientBoost * 0.6;
  }

  render(renderer, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
