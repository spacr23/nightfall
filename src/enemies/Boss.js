import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { buildBoss } from './EnemyModels.js';

const _d = new THREE.Vector3();

/**
 * THE NIGHTFATHER - the final horror of the forest. Huge, antlered, heart of embers.
 * Attacks: claw sweep, ground slam shockwave (jump to avoid), charging rush, blood-orb volley,
 * summons the dead at 66% and 33% health, enrages below 40%.
 */
const bossBehavior = {
  update(ai, dt) {
    const e = ai.e, game = e.game;
    const hpPct = e.hp / e.maxHp;
    if (!e.enrage && hpPct < 0.4) { e.enrage = true; e.roarAnim = 1.5; game.audio.play('bossRoar', { pos: e.headSphere.c }); game.hud.message('THE NIGHTFATHER IS ENRAGED', 2.5); }
    e.summoned = e.summoned || {};
    for (const th of [0.66, 0.33]) {
      if (hpPct < th && !e.summoned[th]) {
        e.summoned[th] = true;
        e.roarAnim = 1.5;
        game.audio.play('bossRoar', { pos: e.headSphere.c });
        game.waves.summonMinions(e.body.pos, 3 + Math.floor((1 - th) * 3));
      }
    }
    if (ai.state !== 'chase' || ai.override) return;
    const d = ai.dist;
    const pp = game.player.position;
    const rage = e.enrage ? 0.65 : 1;
    // ground slam
    if ((ai.cd.slam || 0) <= 0 && d < 8) {
      ai.cd.slam = 6 * rage + Math.random() * 2;
      e.attackAnim = 0.3; e.roarAnim = 0.6;
      ai.override = { vel: new THREE.Vector3(), time: 0.8, face: pp, onEnd: () => {
        e.attackAnim = 0;
        game.effects.shockwave(e.body.pos.clone(), 9, 0xff3020);
        game.audio.play('bossRoar', { pos: e.body.pos });
        game.player.controller.addShake(0.9);
        const pd = e.body.pos.distanceTo(game.player.position);
        if (pd < 8.5 && game.player.controller.body.onGround) game.player.takeDamage(32 * e.dmgMul, e.body.pos, e);
      } };
      return;
    }
    // blood volley
    if (ai.canSee && (ai.cd.volley || 0) <= 0 && d > 7 && d < 45) {
      ai.cd.volley = 4.5 * rage + Math.random() * 2;
      const origin = e.headSphere.c.clone();
      const target = game.player.controller.eyePosition.clone().add(new THREE.Vector3(0, -0.4, 0));
      const n = e.enrage ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const dir = target.clone().sub(origin).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * 0.09);
        game.projectiles.fireEnemyOrb(origin, dir, 16, 16 * e.dmgMul, 0xff2a10, e);
      }
      game.audio.play('ghostAttack', { pos: origin });
      e.roarAnim = 0.5;
    }
    // charge
    if (ai.canSee && (ai.cd.charge || 0) <= 0 && d > 10 && d < 35) {
      ai.cd.charge = 7 * rage + Math.random() * 3;
      _d.subVectors(pp, e.body.pos).setY(0).normalize();
      e.roarAnim = 0.8;
      game.audio.play('bossRoar', { pos: e.headSphere.c });
      ai.override = { vel: new THREE.Vector3(), time: 0.6, face: pp, onEnd: () => {
        _d.subVectors(game.player.position, e.body.pos).setY(0).normalize();
        ai.override = { vel: _d.clone().multiplyScalar(e.enrage ? 16 : 13), time: Math.min(1.6, d / 13), face: null, onEnd: () => { ai.attackCd = 0; } };
      } };
    }
  },
};

export const BOSS = {
  type: 'boss', family: 'boss', name: 'THE NIGHTFATHER', elite: true,
  hp: 6000, walkSpeed: 3.0, runSpeed: 5.4, accel: 6, detect: 90, fov: -1, turnRate: 0.6,
  attack: { range: 4.4, windup: 0.55, recover: 0.5, damage: 38, cooldown: 1.2 },
  halfW: 0.6, pushR: 1.5, height: 4.6, headR: 0.55, bodyR: 1.15, staggerThreshold: 99999, noStagger: true,
  points: 5000, idleSound: 'bossRoar', alertSound: 'bossRoar', attackSound: 'werewolfAttack', sfxInterval: 9, gaitFreq: 0.9,
  damageTakenMul: 1,
  behavior: bossBehavior,
};

export class Boss extends Enemy {
  constructor(game, pos, scale) {
    super(game, BOSS, buildBoss(), pos, { ...(scale || {}), hp: Math.max(1, ((scale && scale.hp) || 1) * 0.6) });
    this.ai.alerted = true;
    this.ai.setState('chase');
  }
}
