import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { buildGhost } from './EnemyModels.js';

const _d = new THREE.Vector3();

/**
 * Ghosts drift erratically, phase in and out (bullets pass through while phased),
 * blink-teleport short distances and hurl spectral energy. The Revenant is an armoured spirit knight firing volleys.
 */
const ghostBehavior = {
  update(ai, dt) {
    const e = ai.e, game = e.game;
    const revenant = e.type === 'revenant';
    // phasing (regular ghosts only)
    if (!revenant) {
      e.phaseT = (e.phaseT ?? 2 + Math.random() * 3) - dt;
      if (e.phaseT <= 0) { e.phased = !e.phased; e.phaseT = e.phased ? 0.8 + Math.random() * 0.6 : 2.5 + Math.random() * 3; }
    }
    if (ai.state !== 'chase' || ai.override) return;
    const d = ai.dist;
    // lateral drift makes them harder to hit
    if (!revenant) {
      const side = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
      const s = Math.sin(game.time * 2.2 + e.uid) * 2.4;
      ai.desired.addScaledVector(side, s);
    }
    // teleport closer / beside the player
    if (!revenant && (ai.cd.tp || 0) <= 0 && d > 7 && d < 40) {
      ai.cd.tp = 5 + Math.random() * 4;
      _d.subVectors(game.player.position, e.body.pos).setY(0).normalize();
      const side = new THREE.Vector3(-_d.z, 0, _d.x).multiplyScalar((Math.random() - 0.5) * 8);
      const dest = e.body.pos.clone().addScaledVector(_d, Math.min(d - 4, 6 + Math.random() * 5)).add(side);
      const [cx, cz] = game.nav.toCell(dest.x, dest.z);
      if (game.nav.isWalkable(e.layer, cx, cz)) {
        game.effects.ectoplasm(e.bodySphere.c.clone());
        e.body.pos.set(dest.x, e.body.pos.y + 0.3, dest.z);
        e.spawnFx = 0.8;
        game.audio.play('teleport', { pos: e.body.pos });
      }
    }
    // ranged spectral attack
    const rcd = revenant ? 3.2 : 2.8;
    if (ai.canSee && (ai.cd.cast || 0) <= 0 && d > 3.5 && d < (revenant ? 26 : 20)) {
      ai.cd.cast = rcd / e.aggression + Math.random() * 1.2;
      const origin = e.bodySphere.c.clone().add(new THREE.Vector3(0, 0.4, 0));
      const target = game.player.controller.eyePosition.clone().add(new THREE.Vector3(0, -0.35, 0));
      const n = revenant ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const dir = target.clone().sub(origin).normalize();
        if (n > 1) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - 1) * 0.12);
        game.projectiles.fireEnemyOrb(origin, dir, revenant ? 13 : 9, (revenant ? 14 : 11) * e.dmgMul, revenant ? 0x7affc0 : 0x8fb6ff, e);
      }
      e.attackAnim = 0.5;
      setTimeout(() => { e.attackAnim = 0; }, 250);
      game.audio.play('ghostAttack', { pos: e.headSphere.c });
    }
  },
};

export const GHOST = {
  type: 'ghost', family: 'ghost', name: 'Ghost',
  hp: 55, walkSpeed: 2.0, runSpeed: 3.8, accel: 5, detect: 32, fov: 0.0,
  attack: { range: 1.8, windup: 0.45, recover: 0.35, damage: 10, cooldown: 1.4 },
  halfW: 0.3, height: 1.7, headR: 0.13, bodyR: 0.26, staggerThreshold: 30,
  points: 90, idleSound: 'ghostMoan', alertSound: 'ghostMoan', attackSound: 'ghostAttack', sfxInterval: 6, gaitFreq: 0.6,
  behavior: ghostBehavior,
};

export const REVENANT = {
  ...GHOST, type: 'revenant', name: 'Revenant', elite: true,
  hp: 560, walkSpeed: 1.8, runSpeed: 2.9, detect: 40, noStagger: true, crossbowMul: 2.0,
  attack: { range: 2.4, windup: 0.5, recover: 0.4, damage: 24, cooldown: 1.5 },
  halfW: 0.4, height: 2.1, headR: 0.17, bodyR: 0.4, points: 750, gaitFreq: 1.2,
};

export class Ghost extends Enemy {
  constructor(game, pos, scale, revenant = false) {
    super(game, revenant ? REVENANT : GHOST, buildGhost({ revenant }), pos, scale);
    this.spawnFx = 1;
  }
}
