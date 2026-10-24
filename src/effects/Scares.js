import * as THREE from 'three';
import { buildGhost } from '../enemies/EnemyModels.js';

/**
 * Atmosphere + jumpscares. Events are rare, randomised and gated by cooldowns and context:
 *  - a face in a window / mirror / painting the player is looking at
 *  - a shadow figure between the trees that vanishes when looked at
 *  - glowing eyes in the dark that blink out
 *  - all lights flicker while whispers surround the player
 *  - lightning + thunder
 *  - a rare full-screen scare (first trip into the basement, very occasionally otherwise)
 */
export class Scares {
  constructor(game) {
    this.game = game;
    this.cooldown = 35 + Math.random() * 25;
    this.lightningTimer = 25 + Math.random() * 30;
    this.bigScareCooldown = 240;
    this.firstBasement = true;
    // apparition: a ghost model reused for windows/mirrors/trees
    const ap = buildGhost();
    this.apparition = ap;
    ap.root.visible = false;
    for (const m of ap.mats) { m.transparent = true; }
    game.scene.add(ap.root);
    this.appT = 0;
    // shadow figure (pure black silhouette)
    const sil = new THREE.Group();
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.3, 4, 8), black); body.position.y = 1.0; sil.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), black); head.position.y = 1.95; sil.add(head);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.9, 3, 6), black); arm.position.set(s * 0.35, 1.05, 0); arm.rotation.z = s * 0.12; sil.add(arm); }
    sil.visible = false;
    game.scene.add(sil);
    this.shadow = sil;
    this.shadowT = 0;
    // eyes in the dark
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2010, fog: false });
    const eyes = new THREE.Group();
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), eyeMat); e.position.x = s * 0.09; eyes.add(e); }
    eyes.visible = false;
    game.scene.add(eyes);
    this.eyes = eyes; this.eyesT = 0;
  }

  reset() {
    this.cooldown = 35 + Math.random() * 25;
    this.apparition.root.visible = false; this.shadow.visible = false; this.eyes.visible = false;
    this.firstBasement = true;
  }

  update(dt) {
    const game = this.game;
    const cam = game.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    this.cooldown -= dt;
    this.bigScareCooldown -= dt;
    this.lightningTimer -= dt;

    // lightning
    if (this.lightningTimer <= 0) {
      this.lightningTimer = 30 + Math.random() * 50;
      game.lightning(1);
      setTimeout(() => game.audio.play('thunder'), 600 + Math.random() * 1800);
    }

    // first descent into the basement
    if (this.firstBasement && game.player.controller.layer === -1 && game.world.zoneAt(game.player.position) === 'mansion') {
      this.firstBasement = false;
      setTimeout(() => this.bigScare(), 1500 + Math.random() * 2000);
    }

    // active apparition
    if (this.appT > 0) {
      this.appT -= dt;
      const a = this.apparition;
      const k = Math.min(1, this.appT / 0.25);
      a.mats.forEach((m) => { m.opacity = 0.75 * k; });
      if (this.appT <= 0) a.root.visible = false;
    }
    // shadow figure vanishes when looked at
    if (this.shadowT > 0) {
      this.shadowT -= dt;
      const to = this.shadow.position.clone().setY(this.shadow.position.y + 1.2).sub(cam.position).normalize();
      if (to.dot(fwd) > 0.985 || this.shadowT <= 0) { this.shadow.visible = false; this.shadowT = 0; game.audio.play('whisper', { pos: this.shadow.position }); }
      else this.shadow.position.x += Math.sin(game.time * 3) * dt * 0.8;
    }
    if (this.eyesT > 0) {
      this.eyesT -= dt;
      this.eyes.visible = this.eyesT > 0 && Math.sin(this.eyesT * 9) > -0.9;
      if (this.eyesT <= 0) this.eyes.visible = false;
    }

    if (this.cooldown > 0) return;
    const zone = game.world.zoneAt(game.player.position);
    const r = Math.random();
    let fired = false;
    if (r < 0.3) fired = this.tryLookScare(fwd);
    else if (r < 0.55 && zone === 'forest') fired = this.shadowFigure(fwd);
    else if (r < 0.75) fired = this.darkEyes(fwd);
    else { game.lightPool.flickerAll(1.8); game.audio.play('whisper', { pos: cam.position.clone().addScaledVector(fwd, -2) }); fired = true; }
    if (!fired && Math.random() < 0.05 && this.bigScareCooldown <= 0) { this.bigScare(); fired = true; }
    this.cooldown = fired ? 40 + Math.random() * 60 : 6;
  }

  bigScare() {
    if (this.bigScareCooldown > 0 && !this.firstBasementFired) { this.firstBasementFired = true; }
    this.bigScareCooldown = 300;
    this.game.effects.screen.scare();
    this.game.audio.play('scare');
    this.game.player.controller.addShake(0.6);
    this.game.lightPool.flickerAll(1.2);
  }

  /** A face in a window, mirror, painting or doorway the player is currently looking toward. */
  tryLookScare(fwd) {
    const game = this.game;
    const cam = game.camera;
    let best = null, bd = Infinity;
    for (const s of game.world.scareSpots) {
      const to = s.pos.clone().sub(cam.position);
      const d = to.length();
      if (d < 3 || d > 16) continue;
      if (to.normalize().dot(fwd) < 0.8) continue;
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return false;
    const a = this.apparition;
    a.root.visible = true;
    // put the apparition just beyond the surface, facing the player
    const away = best.pos.clone().sub(cam.position).setY(0).normalize();
    const pos = best.pos.clone().addScaledVector(away, best.type === 'mirror' || best.type === 'painting' ? 0.15 : 0.9);
    pos.y -= 1.35;
    a.root.position.copy(pos);
    a.root.lookAt(cam.position.x, pos.y, cam.position.z);
    this.appT = best.type === 'mirror' ? 0.45 : 0.7;
    game.audio.play(best.type === 'mirror' ? 'scare' : 'whisper', { pos: best.pos });
    if (best.type === 'mirror') game.effects.screen.flash(0.3);
    return true;
  }

  shadowFigure(fwd) {
    const game = this.game;
    const cam = game.camera;
    // at the edge of vision, 18-30 m away
    const side = Math.random() < 0.5 ? -1 : 1;
    const dir = fwd.clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), side * (0.45 + Math.random() * 0.25));
    const d = 18 + Math.random() * 12;
    const x = cam.position.x + dir.x * d, z = cam.position.z + dir.z * d;
    const y = game.physics.terrainHeight(x, z);
    if (y < -3) return false;
    this.shadow.position.set(x, y, z);
    this.shadow.lookAt(cam.position.x, y, cam.position.z);
    this.shadow.visible = true;
    this.shadowT = 3.5;
    game.audio.play('creak', { pos: this.shadow.position });
    return true;
  }

  darkEyes(fwd) {
    const game = this.game;
    const cam = game.camera;
    const dir = fwd.clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2);
    const d = 14 + Math.random() * 14;
    const p = cam.position.clone().addScaledVector(dir, d);
    const gy = game.physics.groundHeight(p.x, p.z, cam.position.y, 0.2);
    if (gy === -Infinity) return false;
    p.y = gy + 1.5 + Math.random() * 0.4;
    if (!game.physics.lineOfSight(cam.position, p)) return false;
    this.eyes.position.copy(p);
    this.eyes.lookAt(cam.position);
    this.eyesT = 2.5;
    game.audio.play(Math.random() < 0.5 ? 'werewolfGrowl' : 'whisper', { pos: p });
    return true;
  }
}
