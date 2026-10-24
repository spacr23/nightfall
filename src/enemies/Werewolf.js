import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { buildWerewolf } from './EnemyModels.js';

const _d = new THREE.Vector3();

/** Werewolves spot you from far away, sprint in on a flanking arc and leap. The Alpha roars to enrage the pack. */
const werewolfBehavior = {
  chaseGoal(ai, target, dist) {
    if (dist < 9 || !ai.canSee) return target;
    // circle around: aim for a point beside the player, shrinking as we close in
    const e = ai.e;
    _d.subVectors(e.body.pos, target).setY(0).normalize();
    const side = new THREE.Vector3(-_d.z, 0, _d.x).multiplyScalar(ai.flankSide * Math.min(ai.flankDist, dist * 0.45));
    const goal = target.clone().add(side).addScaledVector(_d, Math.min(4, dist * 0.2));
    const [cx, cz] = e.game.nav.toCell(goal.x, goal.z);
    return e.game.nav.isWalkable(e.layer, cx, cz) ? goal : target;
  },
  update(ai, dt) {
    const e = ai.e, game = e.game;
    if (e.enrageT > 0) { e.enrageT -= dt; if (e.enrageT <= 0) e.enrage = false; }
    if (ai.state !== 'chase' || ai.override) return;
    const d = ai.dist;
    const earlyWave = !game.waves || game.waves.wave < 4;
    if (!earlyWave && ai.canSee && (ai.cd.leap || 0) <= 0 && d > 3.5 && d < 9) {
      ai.cd.leap = (e.isElite ? 3.5 : 5) + Math.random() * 3;
      _d.subVectors(game.player.position, e.body.pos).setY(0).normalize();
      const speed = Math.min(14, d * 1.9);
      ai.override = { vel: _d.clone().multiplyScalar(speed), vy: 5.5, time: 0.55, face: game.player.position, onEnd: () => {
        ai.attackCd = 0;
        if (e.isElite && e.alive) {
          // slam on landing
          const pd = e.body.pos.distanceTo(game.player.position);
          game.effects.shockwave(e.body.pos.clone(), 5, 0xb0b0c0);
          game.player.controller.addShake(0.5);
          if (pd < 4.5 && game.player.controller.body.onGround) game.player.takeDamage(18 * e.dmgMul, e.body.pos, e);
        }
      } };
      game.audio.play('werewolfAttack', { pos: e.headSphere.c });
    }
    if (e.isElite && (ai.cd.roar || 0) <= 0 && ai.canSee && d < 35) {
      ai.cd.roar = 12 + Math.random() * 5;
      e.roarAnim = 1.2;
      game.audio.play('werewolfRoar', { pos: e.headSphere.c });
      game.player.controller.addShake(0.35);
      for (const o of game.enemies) if (o.alive && o.family === 'werewolf' && o.body.pos.distanceTo(e.body.pos) < 30) { o.enrage = true; o.enrageT = 7; }
      ai.override = { vel: new THREE.Vector3(), time: 0.9, face: game.player.position };
    }
  },
};

export const WEREWOLF = {
  type: 'werewolf', family: 'werewolf', name: 'Werewolf',
  hp: 230, walkSpeed: 2.6, runSpeed: 7.4, accel: 9, detect: 52, fov: -0.2, turnRate: 0.9,
  attack: { range: 2.3, windup: 0.36, recover: 0.4, damage: 25, cooldown: 1.3 },
  halfW: 0.45, height: 2.0, headR: 0.24, bodyR: 0.5, staggerThreshold: 75,
  points: 130, idleSound: 'werewolfGrowl', alertSound: 'werewolfRoar', attackSound: 'werewolfAttack', sfxInterval: 5, gaitFreq: 1.3,
  behavior: werewolfBehavior,
};

export const ALPHA_WEREWOLF = {
  ...WEREWOLF, type: 'alphaWerewolf', name: 'Alpha Werewolf', elite: true,
  hp: 850, walkSpeed: 3.0, runSpeed: 8.0, detect: 60,
  attack: { range: 2.9, windup: 0.34, recover: 0.4, damage: 36, cooldown: 1.2 },
  halfW: 0.6, pushR: 0.75, height: 2.7, staggerThreshold: 250, points: 900,
};

export class Werewolf extends Enemy {
  constructor(game, pos, scale, alpha = false) {
    super(game, alpha ? ALPHA_WEREWOLF : WEREWOLF, buildWerewolf({ alpha }), pos, scale);
  }
}
