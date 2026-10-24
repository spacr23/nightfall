import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { buildVampire } from './EnemyModels.js';

const _d = new THREE.Vector3();

/** Vampires close distance with sudden dashes. The Ancient Vampire also blinks behind the player and drains life. */
const vampireBehavior = {
  update(ai, dt) {
    const e = ai.e;
    if (ai.state !== 'chase' || ai.override || !ai.canSee) return;
    const d = ai.dist;
    const earlyWave = !e.game.waves || e.game.waves.wave < 3;
    if (!earlyWave && (ai.cd.dash || 0) <= 0 && d > 4.5 && d < 15 && Math.abs(e.game.player.position.y - e.body.pos.y) < 1.2) {
      ai.cd.dash = (e.isElite ? 4 : 6) + Math.random() * 3;
      _d.subVectors(e.game.player.position, e.body.pos).setY(0).normalize();
      const speed = e.isElite ? 17 : 14;
      ai.override = { vel: _d.clone().multiplyScalar(speed), time: Math.min(0.45, (d - 1.6) / speed), face: e.game.player.position, onEnd: () => { ai.attackCd = 0; } };
      e.game.audio.play('vampireAttack', { pos: e.headSphere.c });
      e.game.effects.dashTrail(e);
    }
    if (e.isElite && (ai.cd.blink || 0) <= 0 && d > 6 && d < 30) {
      ai.cd.blink = 9 + Math.random() * 4;
      const game = e.game;
      const fwd = game.player.controller.forward(new THREE.Vector3()).setY(0).normalize();
      const behind = game.player.position.clone().addScaledVector(fwd, -3);
      const [cx, cz] = game.nav.toCell(behind.x, behind.z);
      if (game.nav.isWalkable(game.player.controller.layer, cx, cz) && game.physics.lineOfSight(game.player.controller.eyePosition, behind.clone().setY(behind.y + 1.4))) {
        game.effects.bloodBurst(e.body.pos.clone().setY(e.body.pos.y + 1));
        e.body.pos.set(behind.x, game.player.position.y + 0.05, behind.z);
        game.effects.bloodBurst(e.body.pos.clone().setY(e.body.pos.y + 1));
        game.audio.play('teleport', { pos: e.body.pos });
        ai.attackCd = 0.2;
      }
    }
  },
  onHit(ai) { if (ai.e.isElite) ai.e.hp = Math.min(ai.e.maxHp, ai.e.hp + 25); },
};

export const VAMPIRE = {
  type: 'vampire', family: 'vampire', name: 'Vampire',
  hp: 90, walkSpeed: 1.9, runSpeed: 5.0, accel: 12, detect: 30, fov: 0.2,
  attack: { range: 1.8, windup: 0.3, recover: 0.35, damage: 13, cooldown: 1.0 },
  halfW: 0.32, height: 1.85, headR: 0.16, bodyR: 0.32, staggerThreshold: 40,
  points: 60, idleSound: 'vampireHiss', alertSound: 'vampireHiss', attackSound: 'vampireAttack', sfxInterval: 7, gaitFreq: 1.7,
  behavior: vampireBehavior,
};

export const ANCIENT_VAMPIRE = {
  ...VAMPIRE, type: 'ancientVampire', name: 'Ancient Vampire', elite: true,
  hp: 420, walkSpeed: 2.2, runSpeed: 5.8, detect: 40,
  attack: { range: 2.1, windup: 0.28, recover: 0.3, damage: 22, cooldown: 0.9 },
  halfW: 0.38, height: 2.2, staggerThreshold: 120, points: 600,
};

export class Vampire extends Enemy {
  constructor(game, pos, scale, ancient = false) {
    super(game, ancient ? ANCIENT_VAMPIRE : VAMPIRE, buildVampire({ ancient }), pos, scale);
  }
}
