import * as THREE from 'three';
import { PlayerController } from './PlayerController.js';
import { PlayerHealth } from './PlayerHealth.js';

export const PLAYER_START = { x: 0, y: 0.2, z: -50, yaw: 0 };

/** Player state: movement controller, health/armor, upgrade modifiers, points, stats and the flashlight. */
export class Player {
  constructor(game) {
    this.game = game;
    this.controller = new PlayerController(game.camera, game.physics, game.input, game.settings);
    this.health = new PlayerHealth(100);
    this.flashlight = new THREE.SpotLight(0xfff1d6, 0, 36, 0.42, 0.55, 1.0);
    this.flashlight.position.set(0.2, -0.15, 0);
    this.flashlight.target.position.set(0, 0, -10);
    game.camera.add(this.flashlight, this.flashlight.target);
    this.flashlightLevel = 0;
    this.reset();
    this.controller.onStep = (sprinting) => this.footstep(sprinting);
    this.controller.onLand = (impact) => { game.audio.play('land'); if (impact > 0.9) this.takeDamage(Math.round((impact - 0.9) * 60), null, null); };
    this.controller.onJump = () => game.audio.play('jump');
  }

  reset() {
    this.health.reset(100);
    this.mods = { damageMul: 1, reloadMul: 1, ammoMul: 1, meleeSpeedMul: 1 };
    this.points = 500;
    this.stats = { kills: 0, headshots: 0, damageDealt: 0, secrets: 0, pointsEarned: 0 };
    this.flashlightOn = true;
    this.flashlightLevel = 0;
    this.controller.speedMul = 1; this.controller.sprintMul = 1.6; this.controller.stamina = 1;
    this.applyFlashlight();
    this.controller.teleport(PLAYER_START.x, PLAYER_START.y, PLAYER_START.z, PLAYER_START.yaw);
    this.lastHurt = 0;
  }

  get position() { return this.controller.body.pos; }
  get dead() { return this.health.dead; }

  applyFlashlight() {
    const l = this.flashlightLevel;
    const q = this.game.settings.quality;
    this.flashlight.angle = 0.42 + l * 0.06;
    this.flashlight.distance = 36 + l * 9;
    this.flashlight.baseIntensity = 16 * (1 + l * 0.3);
    this.flashlight.intensity = this.flashlightOn ? this.flashlight.baseIntensity : 0;
    this.flashlight.castShadow = !!q.shadows && this.game.settings.get('quality') === 'high';
    this.flashlight.shadow.mapSize.set(512, 512);
    this.flashlight.shadow.camera.near = 0.3;
    this.flashlight.shadow.bias = -0.0005;
  }

  toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.game.audio.play('flashlight');
    this.applyFlashlight();
  }

  footstep(sprinting) {
    const game = this.game;
    const zone = game.world.zoneAt(this.position);
    const y = this.position.y;
    const t = game.physics.terrainHeight(this.position.x, this.position.z);
    const onTerrain = Math.abs(y - t) < 0.1;
    let surface = 'stepGrass';
    if (!onTerrain) surface = zone === 'mansion' && this.controller.layer >= 0 ? 'stepWood' : 'stepStone';
    game.audio.play(surface, { gain: sprinting ? 1.3 : 0.8 });
    game.noise(this.position, sprinting ? 14 : 6);
  }

  takeDamage(amount, sourcePos, enemy) {
    if (this.health.dead || amount <= 0) return;
    const game = this.game;
    const dealt = this.health.damage(amount);
    if (dealt <= 0 && this.health.armor <= 0) return;
    game.effects.screen.damage(amount);
    game.audio.play('hurt');
    this.controller.addShake(Math.min(0.6, 0.15 + amount / 60));
    if (sourcePos) {
      // knock the view slightly away from the attacker
      const to = new THREE.Vector3().subVectors(this.position, sourcePos).setY(0);
      if (to.lengthSq() > 0.01) { to.normalize(); this.controller.body.vel.addScaledVector(to, 3); }
      this.controller.addRecoil(0.03, (Math.random() - 0.5) * 0.05);
      game.hud.damageDirection(sourcePos);
    }
    if (this.health.dead) game.onPlayerDeath(enemy);
  }

  addPoints(n, label, silent = false) {
    this.points += n;
    this.stats.pointsEarned += n;
    if (!silent && label) this.game.hud.pointsPopup(n, label);
  }

  update(dt) {
    this.health.update(dt);
    // flashlight flickers when spirits are close
    if (this.flashlightOn) {
      let ghostNear = false;
      for (const e of this.game.enemies) if (e.alive && e.family === 'ghost' && e.body.pos.distanceToSquared(this.position) < 100) { ghostNear = true; break; }
      const base = this.flashlight.baseIntensity;
      this.flashlight.intensity = ghostNear && Math.random() < 0.18 ? base * Math.random() * 0.3 : base;
    }
  }
}
