import * as THREE from 'three';
import { Settings } from './Settings.js';
import { InputManager } from './InputManager.js';
import { AudioManager } from './AudioManager.js';
import { Physics } from './Physics.js';
import { NavGrid } from './NavGrid.js';
import { LightPool } from './LightPool.js';
import { Combat } from './Combat.js';
import { Projectiles } from './Projectiles.js';
import { UpgradeSystem } from './Upgrades.js';
import { GameState } from './GameState.js';
import { WorldBuilder, WORLD } from '../world/WorldBuilder.js';
import { Player, PLAYER_START } from '../player/Player.js';
import { WeaponManager } from '../player/WeaponManager.js';
import { WaveManager } from '../waves/WaveManager.js';
import { Effects } from '../effects/Effects.js';
import { Scares } from '../effects/Scares.js';
import { HUD } from '../ui/HUD.js';
import { Menus } from '../ui/Menus.js';
import { buildGhost, glowTexture } from '../enemies/EnemyModels.js';
import { TouchControls, isTouchDevice } from './TouchControls.js';

const FOG_COLOR = 0x0a0e17;

/**
 * Top-level orchestrator. Owns the renderer, scene, systems and the state machine
 * (loading -> menu -> playing <-> paused/upgrade -> gameover).
 * Gameplay logic lives in the systems; this class only wires them together.
 */
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.isTouch = isTouchDevice();
    const phone = Math.min(window.screen.width, window.screen.height) < 600;
    // touch devices start on lighter graphics (unless the player already saved a choice)
    this.settings = new Settings(this.isTouch ? { quality: phone ? 'low' : 'medium', fov: phone ? 75 : 80 } : {});
    if (this.isTouch) document.body.classList.add('touch');
    this.state = new GameState();
    this.time = 0;
    this.enemies = [];
    this.noiseEvents = [];
    this.pathBudget = 0;
    this.zoneLabel = '';
    this.menuLook = { x: 0, y: 0 };
    this.menuT = 0;
    this.lightningLevel = 0;
    this.initRenderer();
    this.input = new InputManager(canvas);
    this.audio = new AudioManager(this.settings);
  }

  initRenderer() {
    const q = this.settings.quality;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.settings.get('quality') !== 'low', powerPreference: 'high-performance' });
    r.setPixelRatio(this.pixelRatio());
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.3;
    r.shadowMap.enabled = q.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(FOG_COLOR);
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, q.fogDensity);
    this.camera = new THREE.PerspectiveCamera(this.settings.get('fov'), window.innerWidth / window.innerHeight, 0.05, 600);
    this.scene.add(this.camera);
    // moonlight + sky fill
    this.hemi = new THREE.HemisphereLight(0x50648c, 0x0d1016, 0.8);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x9fb4e0, 0.8);
    this.moon.position.set(-60, 120, -120);
    this.moon.castShadow = q.shadows;
    this.moon.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
    const sc = this.moon.shadow.camera;
    sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 10; sc.far = 320;
    this.moon.shadow.bias = -0.0008;
    this.moon.shadow.normalBias = 0.04;
    this.scene.add(this.moon, this.moon.target);
    window.addEventListener('resize', () => this.onResize());
  }

  /** Heavy world generation: called once after the loading screen has painted. */
  async build() {
    this.physics = new Physics();
    this.nav = new NavGrid(this.physics, { minX: WORLD.minX, minZ: WORLD.minZ, maxX: WORLD.maxX, maxZ: WORLD.maxZ }, 1.0);
    this.world = new WorldBuilder(this.scene, this.physics, this.nav, this.settings.quality);
    this.world.build();
    this.lightPool = new LightPool(this.scene, this.world.virtualLights, this.settings.quality.maxLights);
    this.player = new Player(this);
    this.weapons = new WeaponManager(this);
    this.effects = new Effects(this);
    this.combat = new Combat(this);
    this.projectiles = new Projectiles(this);
    this.waves = new WaveManager(this);
    this.upgrades = new UpgradeSystem(this);
    this.scares = new Scares(this);
    this.hud = new HUD(this);
    this.menus = new Menus(this);
    this.touch = this.isTouch ? new TouchControls(this) : null;
    this.buildMenuScene();
    this.interactGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe2a0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.interactGlow.visible = false;
    this.scene.add(this.interactGlow);
    this.input.onLockChange = (locked) => this.onLockChange(locked);
    this.input.onEscape = () => this.onEscape();
    this.settings.onChange((k) => this.onSetting(k));
    // compile shaders up front to avoid hitches on first sight of an object
    const tc = performance.now();
    this.renderer.compile(this.scene, this.camera);
    console.info('[nightfall] shader compile ms', Math.round(performance.now() - tc));
    this.state.set('menu');
    this.menus.showScreen('main');
    this.hud.show(false);
  }

  // ------------------------------------------------------------------ main menu cinematic
  buildMenuScene() {
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    this.menuPath = new THREE.CatmullRomCurve3([P(0, 2.4, -36), P(-22, 5, -44), P(-30, 3.5, -12), P(-24, 2.6, 22), P(6, 2.0, 40), P(28, 3, 58), P(56, 3, 44), P(40, 6, 6), P(18, 7, -30)], true);
    this.menuTargets = new THREE.CatmullRomCurve3([P(0, 5, -70), P(0, 5, -72), P(-6, 3, -40), P(0, 2, 50), P(0, 3, 70), P(-10, 2, 70), P(90, 3, 25), P(0, 3, 40), P(0, 5, -72)], true);
    this.menuGhosts = [];
    for (const [x, y, z] of [[-10, 0.2, 34], [3, 4.2, -60.5], [70, 1.2, 40]]) {
      const g = buildGhost();
      g.root.position.set(x, y, z);
      g.base = new THREE.Vector3(x, y, z);
      this.scene.add(g.root);
      this.menuGhosts.push(g);
    }
  }

  updateMenu(dt) {
    this.menuT = (this.menuT + dt * 0.0105) % 1;
    const pos = this.menuPath.getPointAt(this.menuT);
    const tgt = this.menuTargets.getPointAt(this.menuT);
    const cam = this.camera;
    cam.position.copy(pos);
    const lookOff = new THREE.Vector3(this.menuLook.x * 6, -this.menuLook.y * 3, 0);
    cam.lookAt(tgt.add(lookOff));
    this.menuGhosts.forEach((g, i) => {
      const t = this.time * 0.25 + i * 2;
      g.root.visible = true;
      g.root.position.set(g.base.x + Math.sin(t) * 4, g.base.y + Math.sin(t * 2.3) * 0.25, g.base.z + Math.cos(t * 0.7) * 3);
      g.root.lookAt(cam.position.x, g.root.position.y, cam.position.z);
      const k = 0.5 + 0.5 * Math.sin(this.time * 0.9 + i);
      g.mats.forEach((m) => { m.transparent = true; m.opacity = 0.15 + 0.45 * k; });
      g.parts.shoulderL.rotation.x = -0.9 + Math.sin(t * 2) * 0.2; g.parts.shoulderR.rotation.x = -0.9 - Math.sin(t * 2) * 0.2;
    });
    // occasional menu lightning
    if (Math.random() < dt / 9) { this.lightning(0.8); setTimeout(() => this.audio.play('thunder'), 500 + Math.random() * 1500); }
  }

  // ------------------------------------------------------------------ state transitions
  async startGame() {
    this.audio.unlock();
    this.audio.startAmbience();
    this.newRun();
    this.menuGhosts.forEach((g) => { g.root.visible = false; });
    this.menus.hideAll();
    this.hud.show(true);
    this.state.set('playing');
    await this.input.requestLock();
    this.waves.start();
    this.hud.message('Survive. Find weapons in the mansion, the chapel and the woods.', 5);
  }

  newRun() {
    for (const e of this.enemies) e.remove();
    this.enemies = [];
    this.projectiles.clear();
    this.effects.clear();
    this.player.reset();
    this.weapons.reset();
    this.upgrades.reset();
    this.waves.reset();
    this.world.resetInteractables();
    this.scares.reset();
    this.hud.reset();
    this.camera.fov = this.settings.get('fov');
    this.camera.updateProjectionMatrix();
    this.audio.setMusicIntensity(0.3);
  }

  restart() {
    this.newRun();
    this.menus.hideAll();
    this.hud.show(true);
    this.state.set('playing');
    this.input.requestLock();
    this.waves.start();
  }

  toMainMenu() {
    this.newRun();
    this.input.releaseLock();
    this.hud.show(false);
    this.state.set('menu');
    this.menus.showScreen('main');
  }

  pause() {
    if (!this.state.is('playing')) return;
    this.state.set('paused');
    this.menus.showScreen('pause');
    this.audio.setMusicIntensity(0.15);
  }

  resume() {
    if (!this.state.is('paused') && !this.state.is('upgrade')) return;
    this.menus.hideAll();
    this.state.set('playing');
    this.input.requestLock();
  }

  openUpgrades() {
    if ((!this.state.is('playing') && !this.state.is('paused')) || !this.waves.inIntermission) return;
    this.state.set('upgrade');
    this.input.releaseLock();
    this.menus.renderUpgrades();
    this.menus.showScreen('upgrade');
  }

  closeUpgrades() { this.resume(); }

  onLockChange(locked) {
    if (locked || !this.state.is('playing')) return;
    if (this.hud.noteOpen || performance.now() - (this._noteClosedAt || 0) < 400) {
      // Esc while reading: close the note instead of opening the pause menu
      this.hud.showNote(null);
      this.state.set('paused');
      this.menus.showScreen('resume');
      return;
    }
    this.pause();
  }

  onEscape() {
    if (this.state.is('playing') && this.hud.noteOpen) { this.hud.showNote(null); this._noteClosedAt = performance.now(); return; }
    if (this.state.is('paused') && this.menus.current === 'resume') { this.menus.showScreen('pause'); return; }
    if (this.state.is('paused') && this.menus.current !== 'pause') this.menus.showScreen('pause');
    else if (this.state.is('upgrade')) this.closeUpgrades();
  }

  onPlayerDeath() {
    if (this.state.is('gameover')) return;
    this.state.set('gameover');
    this.input.releaseLock();
    const stats = { wave: this.waves.wave, kills: this.player.stats.kills, headshots: this.player.stats.headshots, points: this.player.stats.pointsEarned };
    try {
      const best = JSON.parse(localStorage.getItem('nightfall.best') || '{}');
      localStorage.setItem('nightfall.best', JSON.stringify({ wave: Math.max(best.wave || 0, stats.wave), kills: Math.max(best.kills || 0, stats.kills), points: Math.max(best.points || 0, stats.points) }));
    } catch (e) { /* ignore */ }
    this.audio.play('bossDead');
    this.effects.screen.damage(10);
    setTimeout(() => { if (!this.state.is('gameover')) return; this.hud.show(false); this.menus.showGameOver(stats); }, 1400);
  }

  onSetting(k) {
    if (k === 'fov') { this.camera.fov = this.settings.get('fov'); this.camera.updateProjectionMatrix(); }
    if (k === 'quality') {
      const q = this.settings.quality;
      this.renderer.setPixelRatio(this.pixelRatio());
      this.renderer.shadowMap.enabled = q.shadows;
      this.moon.castShadow = q.shadows;
      this.scene.fog.density = q.fogDensity;
      this.player.applyFlashlight();
      this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
      this.onResize();
    }
  }

  /** Render resolution: touch screens have very high DPR, so cap it per quality level. */
  pixelRatio() {
    const q = this.settings.get('quality');
    if (!this.isTouch) return this.settings.quality.pixelRatio;
    const cap = { low: 1.15, medium: 1.5, high: 2 }[q] || 1.25;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  // ------------------------------------------------------------------ gameplay hooks
  addEnemy(e) { this.enemies.push(e); }

  /** Broadcast a sound the enemies can hear. */
  noise(pos, radius) { this.noiseEvents.push({ pos: pos.clone(), radius }); }

  lightning(k) { this.lightningLevel = Math.max(this.lightningLevel, k); if (this.effects) this.effects.screen.flash(0.25 * k); }

  onEnemyKilled(e, info) {
    const p = this.player;
    p.stats.kills++;
    const head = info.part === 'head';
    if (head) p.stats.headshots++;
    let pts = e.cfg.points;
    let label = e.isBoss ? 'NIGHTFATHER SLAIN' : e.isElite ? `${e.cfg.name.toUpperCase()} SLAIN` : 'KILL';
    if (head) { pts = Math.round(pts * 1.5); label = e.isElite ? label + ' · HEADSHOT' : 'HEADSHOT'; }
    if (info.weapon && info.weapon.isMelee) { pts += 30; label += ' · AXE'; }
    p.addPoints(pts, label);
    // each kill restores a little health, rewarding aggression and accuracy
    p.health.heal(head ? 6 : 4);
    if (e.isBoss) { this.audio.play('bossDead'); this.hud.bossBar(false); this.player.controller.addShake(1); }
  }

  onPickup(item) {
    const d = item.data || {};
    const hud = this.hud;
    switch (item.type) {
      case 'ammo': {
        const ok = this.weapons.addAmmo(d.weapon || 'any', d.amount || 20);
        if (!ok) { hud.message('Ammo full', 1); return false; }
        this.audio.play('pickup'); hud.message('Ammo collected', 1.2); return true;
      }
      case 'health': {
        if (!this.player.health.heal(d.amount || 40)) { hud.message('Health full', 1); return false; }
        this.audio.play('pickup'); hud.message(`+${d.amount || 40} health`, 1.2); return true;
      }
      case 'armor': {
        if (!this.player.health.addArmor(d.amount || 50)) { hud.message('Armor full', 1); return false; }
        this.audio.play('pickup'); hud.message(`+${d.amount || 50} armor`, 1.2); return true;
      }
      case 'weapon': {
        const w = this.weapons.list.find((x) => x.id === d.weapon);
        const had = w && w.owned;
        if (!this.weapons.give(d.weapon)) { hud.message('Ammo full', 1); return false; }
        this.audio.play('pickup');
        hud.message(had ? `${d.name} ammo` : `${d.name} acquired  [${w.cfg.slot}]`, 2.5);
        return true;
      }
      case 'note':
        this.hud.showNote(this.hud.noteOpen ? null : d.text);
        this.audio.play('ui');
        return true;
      default: return false;
    }
  }

  onSecretFound() {
    this.player.stats.secrets++;
    this.player.addPoints(250, 'SECRET FOUND');
    this.audio.play('upgrade');
    this.hud.message('You found a hidden stash', 2.5);
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    this.time += dt;
    const st = this.state;
    if (st.is('menu')) {
      if (this.touch) this.touch.show(false);
      this.updateMenu(dt);
      this.world.update(dt, this.time, this.camera.position);
      this.lightPool.update(dt, this.time, this.camera.position);
      this.updateSky(dt, this.camera.position);
      this.input.endFrame();
      return;
    }
    if (this.touch) this.touch.show(st.is('playing'));
    if (!st.is('playing')) {
      if (st.is('gameover')) {
        // keep the world alive behind the death screen
        for (const e of this.enemies) e.alive ? e.animate(dt) : e.update(dt);
        this.effects.update(dt);
      }
      this.input.endFrame();
      return;
    }
    this.pathBudget = 6;
    const input = this.input;
    const player = this.player;
    // closing a note takes priority over interaction
    if (this.hud.noteOpen && (input.wasPressed('KeyE') || input.wasPressed('Escape'))) { this.hud.showNote(null); input.pressedThisFrame.delete('KeyE'); }
    if (this.touch) this.touch.update(dt);
    player.controller.update(dt, this.weapons.ads);
    player.update(dt);
    if (input.wasPressed('KeyF')) player.toggleFlashlight();
    if (input.wasPressed('Tab')) this.openUpgrades();
    this.updateInteraction(input);
    const md = { x: 0, y: 0 };
    this.weapons.update(dt, input, {
      moving: player.controller.moving, sprinting: player.controller.sprinting, bobPhase: player.controller.bobPhase,
      bobAmount: player.controller.bobAmount, mouseDX: md.x, mouseDY: md.y,
    });
    // ADS zoom
    const w = this.weapons.current;
    const targetFov = this.settings.get('fov') * (this.weapons.ads && w ? w.cfg.adsFov : 1);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) { this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 14); this.camera.updateProjectionMatrix(); }

    // hearing
    if (this.noiseEvents.length) {
      for (const n of this.noiseEvents) for (const e of this.enemies) if (e.alive) e.ai.hearNoise(n.pos, n.radius);
      this.noiseEvents.length = 0;
    }
    for (const e of this.enemies) e.update(dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].removed) this.enemies.splice(i, 1);
    this.pushPlayerFromEnemies();
    this.projectiles.update(dt);
    this.effects.update(dt);
    this.world.update(dt, this.time, player.position);
    this.lightPool.update(dt, this.time, this.camera.position);
    this.scares.update(dt);
    this.waves.update(dt);
    this.updateSky(dt, player.position);
    this.audio.updateListener(this.camera);
    const zone = this.world.zoneAt(player.position);
    this.audio.updateAmbience(dt, player.position, zone);
    this.zoneLabel = zoneName(zone, player.controller.layer);
    this.hud.update(dt);
    input.endFrame();
  }

  updateSky(dt, center) {
    // moon shadow camera follows the action
    this.moon.position.set(center.x - 60, center.y + 120, center.z - 120);
    this.moon.target.position.copy(center);
    this.lightningLevel = Math.max(0, this.lightningLevel - dt * 3);
    const flick = this.lightningLevel > 0 ? this.lightningLevel * (0.6 + Math.random() * 0.4) : 0;
    this.hemi.intensity = 0.8 + flick * 4;
    this.moon.intensity = 0.8 + flick * 3;
    if (this.effects) this.effects.ambientBoost = Math.max(this.effects.ambientBoost, flick);
  }

  updateInteraction(input) {
    const cam = this.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = null, bestScore = -Infinity;
    for (const it of this.world.interactables) {
      if (it.taken || it.hidden) continue;
      const to = it.pos.clone().sub(cam.position);
      const d = to.length();
      if (d > it.radius + 0.5) continue;
      const dot = to.normalize().dot(fwd);
      if (dot < 0.55) continue;
      const score = dot * 2 - d * 0.3;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    this.focused = best;
    if (best) {
      this.hud.interact(typeof best.label === 'function' ? best.label() : best.label);
      this.interactGlow.visible = best.type !== 'door';
      this.interactGlow.position.copy(best.pos);
      this.interactGlow.scale.setScalar(0.9 + Math.sin(this.time * 5) * 0.15);
      if (input.wasPressed('KeyE')) best.use(this);
    } else {
      this.hud.interact(null);
      this.interactGlow.visible = false;
    }
  }

  /** Enemies never hard-block the player: soft separation pushes both apart. */
  pushPlayerFromEnemies() {
    const body = this.player.controller.body;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = body.pos.x - e.body.pos.x, dz = body.pos.z - e.body.pos.z;
      const min = body.halfW + (e.cfg.pushR || e.body.halfW);
      const d2 = dx * dx + dz * dz;
      if (d2 > min * min || d2 < 1e-6 || Math.abs(body.pos.y - e.body.pos.y) > 1.6) continue;
      const d = Math.sqrt(d2), push = (min - d);
      body.vel.x += dx / d * push * 6; body.vel.z += dz / d * push * 6;
      e.body.vel.x -= dx / d * push * 3; e.body.vel.z -= dz / d * push * 3;
    }
  }

  render() {
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (this.weapons && (this.state.is('playing') || this.state.is('paused') || this.state.is('upgrade'))) {
      this.weapons.render(r, this.camera.aspect);
    }
  }

  loop() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (this.world) { this.update(dt); this.render(); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

function zoneName(zone, layer) {
  if (zone === 'mansion') return layer === -1 ? 'THE CELLAR' : layer === 1 ? 'MANSION · UPPER FLOOR' : 'BLACKWOOD MANOR';
  if (zone === 'cemetery') return layer === -1 ? 'THE CRYPT' : 'THE GREAT CEMETERY';
  if (zone === 'forest') return 'THE DARK FOREST';
  return 'THE HAUNTED GROUNDS';
}
