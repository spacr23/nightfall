import * as THREE from 'three';

/**
 * Player weapon damage resolution: hitscan rays (world boxes + enemy spheres) and melee arcs.
 * Each enemy can only be damaged once per pellet; kills are reported once by Enemy.die().
 */
export class Combat {
  constructor(game) { this.game = game; }

  /** Returns {enemy, part, point, dist} or world hit. */
  hitscan(origin, dir, range, damage, weapon, primary = true) {
    const game = this.game;
    const worldHit = game.physics.raycast(origin, dir, range, (b) => !b.invisible);
    const maxT = worldHit ? worldHit.dist : range;
    let best = null;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (e.phased && weapon.id !== 'crossbow' && Math.random() < 0.8) continue;
      // quick reject by distance to ray
      const toC = e.bodySphere.c.clone().sub(origin);
      const along = toC.dot(dir);
      if (along < 0 || along > maxT + 3) continue;
      const h = e.hitTest(origin, dir, maxT);
      if (h && (!best || h.t < best.t)) best = { enemy: e, part: h.part, t: h.t };
    }
    if (best) {
      const point = origin.clone().addScaledVector(dir, best.t);
      let dmg = damage;
      const fo = weapon.cfg.falloff;
      if (fo) { const [s, e, m] = fo; if (best.t > s) dmg *= Math.max(m, 1 - (1 - m) * Math.min(1, (best.t - s) / (e - s))); }
      this.applyHit(best.enemy, dmg, best.part, weapon, dir, point);
      game.effects.tracer(weapon, point);
      return best;
    }
    if (worldHit) {
      game.effects.impact(worldHit.point, worldHit.normal, worldHit.box);
      if (primary) game.audio.play('impactStone', { pos: worldHit.point });
      game.effects.tracer(weapon, worldHit.point);
      return worldHit;
    }
    game.effects.tracer(weapon, origin.clone().addScaledVector(dir, range));
    return null;
  }

  applyHit(enemy, dmg, part, weapon, dir, point) {
    const game = this.game;
    const res = enemy.takeDamage(dmg, { part, weapon, dir, point });
    if (enemy.family === 'ghost') { game.effects.ectoplasm(point); game.audio.play('hitGhost', { pos: point }); }
    else { game.effects.blood(point, dir, enemy.family === 'boss' ? 2 : 1); game.audio.play('hitFlesh', { pos: point }); }
    game.hud.hitmarker(part === 'head', res.killed);
    if (part === 'head') game.audio.play('headshot');
    game.player.stats.damageDealt += res.dealt;
    if (!res.killed) game.player.addPoints(10, null, true);
    return res;
  }

  melee(weapon) {
    const game = this.game;
    const cam = game.camera;
    const origin = cam.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const range = weapon.cfg.range;
    const dmg = weapon.cfg.damage * (game.player.mods.damageMul || 1);
    let hits = 0;
    const sorted = game.enemies.filter((e) => e.alive).map((e) => [e, e.bodySphere.c.distanceTo(origin)]).sort((a, b) => a[1] - b[1]);
    for (const [e, d] of sorted) {
      if (hits >= 2) break;
      if (d > range + e.bodySphere.r) continue;
      const to = e.bodySphere.c.clone().sub(origin).normalize();
      const head = e.headSphere.c.clone().sub(origin).normalize();
      const dotB = to.dot(fwd), dotH = head.dot(fwd);
      if (Math.max(dotB, dotH) < 0.55) continue;
      if (!game.physics.lineOfSight(origin, e.bodySphere.c)) continue;
      const part = dotH > dotB + 0.05 && dotH > 0.9 ? 'head' : 'body';
      this.applyHit(e, dmg * (hits ? 0.6 : 1), part, weapon, fwd, e.bodySphere.c.clone());
      if (e.alive) {
        // knockback
        e.body.vel.addScaledVector(fwd.clone().setY(0).normalize(), e.isElite ? 2 : 6);
      }
      hits++;
    }
    if (hits) { game.audio.play('axeHit'); game.player.controller.addShake(0.15); }
    else {
      const wh = game.physics.raycast(origin, fwd, range, (b) => !b.invisible);
      if (wh) { game.effects.impact(wh.point, wh.normal, wh.box); game.audio.play('impactStone', { pos: wh.point }); game.player.controller.addShake(0.08); }
    }
  }
}
