import * as THREE from 'three';
import { layerAt } from '../game/NavGrid.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * First-person movement: WASD + mouse look, sprint with stamina, jump, collisions via Physics.
 * Owns the camera transform (position + rotation) including head bob, landing dip, recoil and shake.
 */
export class PlayerController {
  constructor(camera, physics, input, settings) {
    this.camera = camera;
    this.physics = physics;
    this.input = input;
    this.settings = settings;
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), halfW: 0.3, height: 1.75, onGround: false, flying: false };
    this.eyeHeight = 1.62;
    this.yaw = 0; this.pitch = 0;
    this.walkSpeed = 4.6;
    this.sprintMul = 1.6;
    this.speedMul = 1;
    this.stamina = 1;
    this.sprinting = false;
    this.moving = false;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.landDip = 0;
    this.recoilPitch = 0; this.recoilYaw = 0;
    this.shake = 0;
    this.shakeOffset = new THREE.Vector3();
    this.stepTimer = 0;
    this.airTime = 0;
    this.onStep = null;   // callback(surface, sprinting)
    this.onLand = null;
    this.onJump = null;
    this.adsAmount = 0;
    this.layer = 0;
    this.lastSafe = new THREE.Vector3();
    this._fwd = new THREE.Vector3(); this._right = new THREE.Vector3(); this._wish = new THREE.Vector3();
  }

  teleport(x, y, z, yaw = 0) {
    this.body.pos.set(x, y, z);
    this.body.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = 0;
    this.lastSafe.copy(this.body.pos);
    this.updateCamera(0);
  }

  addRecoil(pitch, yaw) { this.recoilPitch += pitch; this.recoilYaw += yaw; }
  addShake(amount) { this.shake = Math.min(1.2, this.shake + amount); }

  get position() { return this.body.pos; }
  get eyePosition() { return this.camera.position; }

  update(dt, ads) {
    const inp = this.input;
    const sens = 0.0022 * this.settings.get('sensitivity') * (ads ? 0.6 : 1);
    const m = inp.consumeMouse();
    this.yaw -= m.x * sens;
    this.pitch -= m.y * sens * (this.settings.get('invertY') ? -1 : 1);
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));

    // Movement intent
    const f = (inp.isDown('KeyW') || inp.isDown('ArrowUp') ? 1 : 0) - (inp.isDown('KeyS') || inp.isDown('ArrowDown') ? 1 : 0);
    const r = (inp.isDown('KeyD') || inp.isDown('ArrowRight') ? 1 : 0) - (inp.isDown('KeyA') || inp.isDown('ArrowLeft') ? 1 : 0);
    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = this._wish.set(0, 0, 0).addScaledVector(this._fwd, f).addScaledVector(this._right, r);
    const hasInput = wish.lengthSq() > 0;
    if (hasInput) wish.normalize();

    const wantSprint = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight');
    this.sprinting = wantSprint && f > 0 && this.stamina > 0.05 && !ads;
    if (this.sprinting && hasInput) this.stamina = Math.max(0, this.stamina - dt * 0.16);
    else this.stamina = Math.min(1, this.stamina + dt * (hasInput ? 0.12 : 0.22));
    if (this.stamina <= 0.01) this.sprinting = false;

    let speed = this.walkSpeed * this.speedMul * (this.sprinting ? this.sprintMul : 1) * (ads ? 0.55 : 1);
    if (f < 0) speed *= 0.8;
    const body = this.body;
    const accel = body.onGround ? 14 : 3.5;
    const targetX = wish.x * speed, targetZ = wish.z * speed;
    body.vel.x += (targetX - body.vel.x) * Math.min(1, accel * dt);
    body.vel.z += (targetZ - body.vel.z) * Math.min(1, accel * dt);

    // Jump + gravity
    if (inp.wasPressed('Space') && body.onGround) {
      body.vel.y = 5.6;
      body.onGround = false;
      if (this.onJump) this.onJump();
    }
    body.vel.y -= 16 * dt;
    if (body.vel.y < -30) body.vel.y = -30;

    const wasGround = body.onGround;
    const vy = body.vel.y;
    // Sub-step to avoid tunnelling at high speed / low framerate
    const steps = dt > 0.025 ? 2 : 1;
    for (let i = 0; i < steps; i++) this.physics.moveBody(body, dt / steps);
    if (!wasGround && body.onGround) {
      const impact = Math.min(1, -vy / 12);
      this.landDip = Math.max(this.landDip, impact * 0.18);
      if (this.onLand && this.airTime > 0.25) this.onLand(impact);
      this.airTime = 0;
    }
    if (!body.onGround) this.airTime += dt;
    else this.lastSafe.copy(body.pos);
    if (body.pos.y < -40) { body.pos.copy(this.lastSafe).add(new THREE.Vector3(0, 1, 0)); body.vel.set(0, 0, 0); }

    const horizSpeed = Math.hypot(body.vel.x, body.vel.z);
    this.moving = horizSpeed > 0.5 && body.onGround;
    this.layer = layerAt(body.pos);

    // Head bob + footsteps
    if (this.moving) {
      const freq = this.sprinting ? 11.5 : 8.2;
      this.bobPhase += dt * freq * Math.min(1.2, horizSpeed / 4.6);
      this.bobAmount += (1 - this.bobAmount) * Math.min(1, dt * 8);
      this.stepTimer -= dt * freq * Math.min(1.2, horizSpeed / 4.6);
      if (this.stepTimer <= 0) { this.stepTimer = Math.PI; if (this.onStep) this.onStep(this.sprinting); }
    } else {
      this.bobAmount += (0 - this.bobAmount) * Math.min(1, dt * 6);
    }

    this.adsAmount += ((ads ? 1 : 0) - this.adsAmount) * Math.min(1, dt * 12);
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    // recoil recovers smoothly
    const rec = Math.min(1, dt * 9);
    const rp = this.recoilPitch * rec, ry = this.recoilYaw * rec;
    this.recoilPitch -= rp; this.recoilYaw -= ry;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + rp * 0.35));
    this.yaw += ry * 0.35;

    this.landDip += (0 - this.landDip) * Math.min(1, dt * 6);
    this.shake = Math.max(0, this.shake - dt * 2.2);

    const bobOn = this.settings.get('headBob') ? 1 : 0.25;
    const bobScale = (this.sprinting ? 1.5 : 1) * this.bobAmount * bobOn * (1 - this.adsAmount * 0.8);
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.055 * bobScale;
    const bobX = Math.cos(this.bobPhase) * 0.035 * bobScale;

    const cam = this.camera;
    const s = this.shake * this.shake;
    this.shakeOffset.set((Math.random() - 0.5) * s * 0.12, (Math.random() - 0.5) * s * 0.12, 0);
    cam.position.set(this.body.pos.x, this.body.pos.y + this.eyeHeight - this.landDip + bobY, this.body.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw + this._right.x * 0 + this.shakeOffset.x * 0.5;
    cam.rotation.x = this.pitch + this.recoilPitch * 0.65 + this.shakeOffset.y * 0.5;
    cam.rotation.z = -bobX * 0.4 + this.shakeOffset.x * 0.3;
    // sideways bob offset in view space
    const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    cam.position.addScaledVector(side, bobX);
  }

  forward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.camera.quaternion); }
}
