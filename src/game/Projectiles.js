import * as THREE from 'three';
import { glowTexture } from '../enemies/EnemyModels.js';

/** Pooled projectiles: holy crossbow bolts (player) and spectral/blood orbs (enemies). */
export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.6, 5); this.boltGeo.rotateX(Math.PI / 2);
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xe8f2ff });
    this.glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9fd0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.trailMat = new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    this.orbGeo = new THREE.SphereGeometry(0.16, 10, 8);
    this.light = new THREE.PointLight(0x9fd0ff, 0, 9, 1.5); // follows the newest bolt
    game.scene.add(this.light);
  }

  fireBolt(origin, dir, damage, weapon) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(this.boltGeo, this.boltMat); g.add(m);
    const s = new THREE.Sprite(this.glowMat); s.scale.setScalar(0.6); s.position.z = -0.3; g.add(s);
    const start = origin.clone().addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.06, 0));
    g.position.copy(start);
    g.lookAt(start.clone().add(dir));
    this.game.scene.add(g);
    // light trail
    const N = 14;
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const trail = new THREE.Line(trailGeo, this.trailMat);
    trail.frustumCulled = false;
    this.game.scene.add(trail);
    const hist = Array.from({ length: N }, () => start.clone());
    this.list.push({ kind: 'bolt', obj: g, trail, hist, pos: start, vel: dir.clone().multiplyScalar(weapon.cfg.boltSpeed || 48), damage, weapon, life: 3, hitSet: new Set(), pierce: 2 });
  }

  fireEnemyOrb(origin, dir, speed, damage, color, owner) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.orbGeo, mat));
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    s.scale.setScalar(1.4); g.add(s);
    g.position.copy(origin);
    this.game.scene.add(g);
    this.list.push({ kind: 'orb', obj: g, pos: g.position, vel: dir.clone().multiplyScalar(speed), damage, life: 4.5, owner, homing: owner && owner.family === 'ghost' ? 1.2 : 0.4 });
  }

  clear() {
    for (const p of this.list) { this.game.scene.remove(p.obj); if (p.trail) this.game.scene.remove(p.trail); }
    this.list = [];
    this.light.intensity = 0;
  }

  update(dt) {
    const game = this.game;
    const physics = game.physics;
    let lightTarget = null;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      const prev = p.pos.clone();
      if (p.kind === 'bolt') {
        p.vel.y -= 2.5 * dt;
        lightTarget = p.pos;
      } else if (p.homing) {
        const to = game.player.controller.eyePosition.clone().add(new THREE.Vector3(0, -0.3, 0)).sub(p.pos);
        if (to.lengthSq() < 400) {
          const sp = p.vel.length();
          p.vel.lerp(to.normalize().multiplyScalar(sp), Math.min(1, p.homing * dt));
          p.vel.setLength(sp);
        }
      }
      const step = p.vel.clone().multiplyScalar(dt);
      const len = step.length();
      const dir = step.clone().divideScalar(len || 1);
      let dead = p.life <= 0;
      // world collision along the segment
      const wh = physics.raycast(prev, dir, len, (b) => !b.invisible && !(p.kind === 'orb' && b.decor && p.owner && p.owner.family === 'ghost'));
      if (p.kind === 'bolt') {
        // enemies
        for (const e of game.enemies) {
          if (!e.alive || p.hitSet.has(e)) continue;
          const h = e.hitTest(prev, dir, wh ? wh.dist : len);
          if (h) {
            p.hitSet.add(e);
            const pt = prev.clone().addScaledVector(dir, h.t);
            game.combat.applyHit(e, p.damage, h.part, p.weapon, dir, pt);
            game.effects.holyBurst(pt);
            p.pierce--;
            if (p.pierce <= 0 || e.family !== 'ghost') { dead = true; break; }
          }
        }
        if (!dead && wh) { dead = true; game.effects.impact(wh.point, wh.normal, wh.box); game.effects.holyBurst(wh.point); game.audio.play('impactStone', { pos: wh.point }); }
      } else {
        // orb vs player
        const eye = game.player.controller.eyePosition;
        const center = eye.clone().add(new THREE.Vector3(0, -0.5, 0));
        const closest = closestOnSegment(prev, p.pos.clone().add(step), center);
        if (closest.distanceTo(center) < 0.55) {
          game.player.takeDamage(p.damage, prev, p.owner);
          game.effects.orbBurst(closest, p.obj.children[0].material.color);
          dead = true;
        } else if (wh) { dead = true; game.effects.orbBurst(wh.point, p.obj.children[0].material.color); }
      }
      p.pos.add(step);
      p.obj.position.copy(p.pos);
      if (p.kind === 'bolt') {
        p.obj.lookAt(p.pos.clone().add(p.vel));
        p.hist.pop(); p.hist.unshift(p.pos.clone());
        const arr = p.trail.geometry.attributes.position.array;
        p.hist.forEach((v, k) => { arr[k * 3] = v.x; arr[k * 3 + 1] = v.y; arr[k * 3 + 2] = v.z; });
        p.trail.geometry.attributes.position.needsUpdate = true;
      } else {
        p.obj.children[1].scale.setScalar(1.2 + Math.sin(game.time * 20 + i) * 0.25);
      }
      if (dead) {
        game.scene.remove(p.obj);
        if (p.trail) game.scene.remove(p.trail);
        this.list.splice(i, 1);
      }
    }
    if (lightTarget) { this.light.position.copy(lightTarget); this.light.intensity = 6; }
    else this.light.intensity = Math.max(0, this.light.intensity - dt * 30);
  }
}

function closestOnSegment(a, b, p) {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
  return a.clone().addScaledVector(ab, t);
}
