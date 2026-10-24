import * as THREE from 'three';
import { layerAt } from '../game/NavGrid.js';
import { toggleDoor } from '../world/WorldBuilder.js';

/**
 * Reusable enemy state machine.
 * States: idle, patrol, investigate, chase, attack, stagger, dead.
 * Movement: direct steering when the nav-grid has line of sight, A* paths otherwise,
 * stair portals between floors, door opening, separation, stuck recovery.
 * Type-specific abilities plug in through cfg.behavior.update(ai, dt) and may set `ai.override`.
 */
const _d = new THREE.Vector3();
const _t = new THREE.Vector3();
const ghostFilter = (b) => !b.decor;
// the Nightfather smashes through fences, gravestones and other low clutter
const bossFilter = (b) => !b.decor && (b.max.y - b.min.y) > 2.2;

export class EnemyAI {
  constructor(e) {
    this.e = e;
    this.state = 'idle';
    this.stateTime = 0;
    this.home = e.body.pos.clone();
    this.lastKnown = null;
    this.lastSeen = 99;
    this.canSee = false;
    this.perceiveTimer = Math.random() * 0.3;
    this.path = null; this.pathIdx = 0; this.pathGoal = new THREE.Vector3(); this.repathTimer = 0;
    this.attackCd = 0.5 + Math.random();
    this.attackT = 0; this.attackHit = false;
    this.staggerT = 0;
    this.override = null;   // {vel: Vector3, time, gravity: bool, onEnd}
    this.desired = new THREE.Vector3();
    this.wantsMove = false;
    this.stuckTimer = 1; this.stuckPos = e.body.pos.clone(); this.stuckN = 0;
    this.huntTimer = 1 + Math.random() * 3;
    this.hunter = true;
    this.flankSide = Math.random() < 0.5 ? -1 : 1;
    this.flankDist = 6 + Math.random() * 6;
    this.cd = {};            // ability cooldowns
    this.alerted = false;
    this.wanderTarget = null;
  }

  setState(s) { if (this.state === s) return; this.state = s; this.stateTime = 0; }

  stagger(t) {
    if (this.state === 'dead') return;
    this.staggerT = t; this.e.staggerTime = t;
    this.override = null;
    this.setState('stagger');
    this.e.attackAnim = 0;
    this.e.game.audio.play('stagger', { pos: this.e.bodySphere.c });
  }

  onDamaged() {
    const p = this.e.game.player.position;
    this.lastKnown = p.clone();
    this.lastSeen = 0;
    if (this.state === 'idle' || this.state === 'patrol' || this.state === 'investigate') this.setState('chase');
  }

  hearNoise(pos, radius) {
    if (this.state === 'chase' || this.state === 'attack') return;
    if (pos.distanceTo(this.e.body.pos) > radius) return;
    this.lastKnown = pos.clone();
    this.setState('investigate');
  }

  // ---------------------------------------------------------------- perception
  perceive(dt) {
    const e = this.e, game = e.game, player = game.player;
    this.perceiveTimer -= dt;
    this.lastSeen += dt;
    if (this.perceiveTimer > 0) return;
    this.perceiveTimer = 0.2 + Math.random() * 0.15;
    const pp = player.position;
    const d = e.body.pos.distanceTo(pp);
    let range = e.cfg.detect * e.aggression * (player.flashlightOn ? 1.25 : 1) * (player.controller.sprinting ? 1.15 : 1);
    if (this.alerted) range *= 1.4;
    this.canSee = false;
    if (d < range) {
      _d.subVectors(pp, e.body.pos).setY(0).normalize();
      const fwd = _t.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      const inFov = this.alerted || d < 6 || fwd.dot(_d) > (e.cfg.fov ?? 0.1);
      if (inFov) {
        const eye = e.headSphere.c;
        this.canSee = game.physics.lineOfSight(eye, player.controller.eyePosition, e.family === 'ghost');
      }
    }
    if (this.canSee) {
      this.lastKnown = pp.clone();
      this.lastSeen = 0;
      if (this.state !== 'chase' && this.state !== 'attack' && this.state !== 'stagger') {
        if (!this.alerted) game.audio.play(e.cfg.alertSound || e.cfg.idleSound, { pos: e.headSphere.c });
        this.alerted = true;
        this.setState('chase');
      }
    }
  }

  // ---------------------------------------------------------------- main update
  update(dt) {
    const e = this.e, game = e.game;
    this.stateTime += dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] -= dt;
    this.perceive(dt);
    this.wantsMove = false;
    this.desired.set(0, 0, 0);
    const player = game.player;
    const pp = player.position;
    const dist = e.body.pos.distanceTo(pp);
    this.dist = dist;

    // wave hunters keep a rough scent of the player so waves never stall
    this.huntTimer -= dt;
    if (this.hunter && this.huntTimer <= 0) {
      this.huntTimer = (4 + Math.random() * 5) / e.aggression;
      const exact = game.waves && game.waves.remaining <= 3;
      const spread = exact ? 0 : Math.min(14, dist * 0.25);
      this.lastKnown = pp.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, 0, (Math.random() - 0.5) * spread));
      if (this.state === 'idle' || this.state === 'patrol') this.setState('investigate');
      if (exact && this.state === 'investigate') this.setState('chase');
    }

    const beh = e.cfg.behavior;
    if (beh && beh.update) beh.update(this, dt);

    if (this.override) {
      const o = this.override;
      o.time -= dt;
      e.body.vel.x = o.vel.x; e.body.vel.z = o.vel.z;
      if (o.vy !== undefined) { e.body.vel.y = o.vy; o.vy = undefined; }
      if (o.face) this.faceTowards(o.face, dt, 12);
      if (o.time <= 0) { const end = o.onEnd; this.override = null; if (end) end(); }
    } else {
      switch (this.state) {
        case 'idle': this.doIdle(dt); break;
        case 'patrol': this.doPatrol(dt); break;
        case 'investigate': this.doInvestigate(dt); break;
        case 'chase': this.doChase(dt, dist); break;
        case 'attack': this.doAttack(dt, dist); break;
        case 'stagger':
          this.staggerT -= dt;
          if (this.staggerT <= 0) this.setState('chase');
          break;
        default: break;
      }
      // steering -> velocity
      const accel = e.cfg.accel || 10;
      const k = Math.min(1, accel * dt);
      e.body.vel.x += (this.desired.x - e.body.vel.x) * k;
      e.body.vel.z += (this.desired.z - e.body.vel.z) * k;
    }
    this.separate(dt);
    // gravity + collision
    e.body.vel.y -= 18 * dt;
    if (e.body.vel.y < -25) e.body.vel.y = -25;
    e.body.lastHit = null;
    game.physics.moveBody(e.body, dt, e.family === 'ghost' ? ghostFilter : e.family === 'boss' ? bossFilter : undefined);
    const hit = e.body.lastHit;
    if (hit && hit.userData && hit.userData.type === 'door' && !hit.userData.target && !hit.userData.locked) toggleDoor(hit.userData, game);
    if (e.body.pos.y < -30) { e.body.pos.copy(this.home); e.body.vel.set(0, 0, 0); }
    this.checkStuck(dt);
  }

  // ---------------------------------------------------------------- states
  doIdle(dt) {
    if (this.stateTime > 1.5 + Math.random() * 2) this.setState('patrol');
    this.e.yaw += Math.sin(this.stateTime * 0.8) * dt * 0.3;
  }

  doPatrol(dt) {
    const e = this.e, nav = e.game.nav;
    if (!this.wanderTarget || this.stateTime > 12) {
      this.wanderTarget = nav.randomWalkable(e.layer, this.home, 3, 14) || this.home.clone();
      this.stateTime = 0.01;
    }
    if (this.navigate(this.wanderTarget, e.cfg.walkSpeed * e.speedMul, dt) < 1.0) { this.wanderTarget = null; this.setState('idle'); }
  }

  doInvestigate(dt) {
    const e = this.e;
    if (!this.lastKnown) { this.setState('patrol'); return; }
    const speed = (this.alerted ? e.cfg.runSpeed * 0.75 : e.cfg.walkSpeed * 1.3) * e.speedMul;
    const d = this.navigate(this.lastKnown, speed, dt);
    if (d < 1.6 || this.stateTime > 20) {
      this.lastKnown = null;
      this.setState('idle');
    }
  }

  doChase(dt, dist) {
    const e = this.e, game = e.game;
    const pp = game.player.position;
    if (!this.canSee && this.lastSeen > 5) {
      this.setState('investigate');
      return;
    }
    const target = this.canSee || this.lastSeen < 1.5 ? pp : (this.lastKnown || pp);
    const beh = e.cfg.behavior;
    let goal = target;
    if (beh && beh.chaseGoal) goal = beh.chaseGoal(this, target, dist) || target;
    const speed = e.cfg.runSpeed * e.speedMul * (e.enrage ? 1.3 : 1);
    this.navigate(goal, speed, dt);
    // attack?
    const atk = e.cfg.attack;
    const dy = Math.abs(pp.y - e.body.pos.y);
    if (dist < atk.range && dy < 1.6 && this.attackCd <= 0 && (this.canSee || this.lastSeen < 0.5)) {
      this.setState('attack');
      this.attackT = 0; this.attackHit = false;
      game.audio.play(e.cfg.attackSound, { pos: e.headSphere.c });
    }
  }

  doAttack(dt, dist) {
    const e = this.e, game = e.game, atk = e.cfg.attack;
    const pp = game.player.position;
    this.attackT += dt;
    // weaker early-wave enemies telegraph their attacks longer
    const windup = atk.windup / Math.min(1, e.aggression + 0.15);
    const total = windup + (atk.recover ?? 0.35);
    e.attackAnim = Math.min(1, this.attackT / total);
    this.faceTowards(pp, dt, 10);
    // slight lunge forward during windup
    if (this.attackT < windup && dist > 1.0) {
      _d.subVectors(pp, e.body.pos).setY(0).normalize();
      this.desired.copy(_d).multiplyScalar(e.cfg.walkSpeed * 0.8);
    }
    if (!this.attackHit && this.attackT >= windup) {
      this.attackHit = true;
      _d.subVectors(pp, e.body.pos).setY(0);
      const fwd = _t.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      const facing = _d.lengthSq() < 0.01 || fwd.dot(_d.normalize()) > 0.2;
      const clear = game.physics.lineOfSight(e.headSphere.c, game.player.controller.eyePosition, e.family === 'ghost');
      if (dist < atk.range * 1.35 && facing && clear && Math.abs(pp.y - e.body.pos.y) < 1.8) {
        game.player.takeDamage(atk.damage * e.dmgMul, e.body.pos, e);
        if (e.cfg.behavior && e.cfg.behavior.onHit) e.cfg.behavior.onHit(this);
      }
    }
    if (this.attackT >= total) {
      e.attackAnim = 0;
      this.attackCd = atk.cooldown / e.aggression * (0.85 + Math.random() * 0.3);
      this.setState('chase');
    }
  }

  // ---------------------------------------------------------------- navigation
  /** Move toward target with pathfinding. Returns remaining 2D distance. */
  navigate(target, speed, dt) {
    const e = this.e, game = e.game, nav = game.nav;
    const pos = e.body.pos;
    const tLayer = layerAt(target);
    let goal = target;
    // Standing on a staircase: commit to the end that leads toward the target's floor.
    for (const st of nav.stairs) {
      const r = st.rect;
      if (pos.x < r.minX - 0.2 || pos.x > r.maxX + 0.2 || pos.z < r.minZ - 0.2 || pos.z > r.maxZ + 0.2) continue;
      // only while actually standing on the steps (not on the floor in front of / behind them)
      if (pos.y < st.low.pos.y + 0.12 || pos.y > st.high.pos.y - 0.12) continue;
      let end = null;
      if (tLayer === st.high.layer) end = st.high.pos;
      else if (tLayer === st.low.layer) end = st.low.pos;
      else end = tLayer > st.high.layer ? st.high.pos : st.low.pos;
      const atEnd = Math.hypot(end.x - pos.x, end.z - pos.z) < 0.7 && Math.abs(end.y - pos.y) < 0.6;
      if (!atEnd) { this.path = null; this.steer(end, speed); return pos.distanceTo(target); }
      break;
    }
    if (tLayer !== e.layer) {
      const st = nav.findStair(e.layer, tLayer, pos, target);
      if (st) {
        const r = st.stair.rect;
        const onStair = pos.x > r.minX - 0.3 && pos.x < r.maxX + 0.3 && pos.z > r.minZ - 0.3 && pos.z < r.maxZ + 0.3;
        if (onStair) { this.steer(st.exit, speed); return pos.distanceTo(target); }
        goal = st.entry;
      }
    }
    const dx = goal.x - pos.x, dz = goal.z - pos.z;
    const d2 = Math.hypot(dx, dz);
    // direct line on the nav grid? steer straight
    const [cx, cz] = nav.toCell(pos.x, pos.z), [gx, gz] = nav.toCell(goal.x, goal.z);
    const direct = (d2 < 1.2 && Math.abs(goal.y - pos.y) < 1.5) || (d2 < 40 && nav._los(e.layer, [cx, cz], [gx, gz]));
    if (direct) {
      this.path = null;
      this.steer(goal, speed);
      return goal === target ? d2 : pos.distanceTo(target);
    }
    this.repathTimer -= dt;
    if (!this.path || this.repathTimer <= 0 || this.pathGoal.distanceTo(goal) > 3) {
      if (game.pathBudget > 0) {
        game.pathBudget--;
        this.path = nav.findPath(e.layer, pos, goal);
        this.pathIdx = 0;
        this.pathGoal.copy(goal);
        this.repathTimer = 0.8 + Math.random() * 0.8;
      }
    }
    if (this.path && this.path.length) {
      let wp = this.path[this.pathIdx];
      while (wp && Math.hypot(wp.x - pos.x, wp.z - pos.z) < 0.45 && this.pathIdx < this.path.length - 1) { this.pathIdx++; wp = this.path[this.pathIdx]; }
      // skip ahead when a later waypoint is directly reachable
      if (this.pathIdx + 1 < this.path.length) {
        const nxt = this.path[this.pathIdx + 1];
        const nc = nav.toCell(nxt.x, nxt.z);
        if (nav._los(e.layer, [cx, cz], nc)) this.pathIdx++;
      }
      this.steer(this.path[this.pathIdx], speed);
    } else {
      this.steer(goal, speed);
    }
    return d2;
  }

  steer(goal, speed) {
    const e = this.e;
    _d.set(goal.x - e.body.pos.x, 0, goal.z - e.body.pos.z);
    const l = _d.length();
    if (l < 0.05) return;
    _d.divideScalar(l);
    const slow = Math.min(1, l / 0.6);
    this.desired.set(_d.x * speed * slow, 0, _d.z * speed * slow);
    this.wantsMove = true;
    const targetYaw = Math.atan2(_d.x, _d.z);
    this.turnTo(targetYaw, 1 / 60 * 8 * (e.cfg.turnRate || 1));
  }

  faceTowards(p, dt, rate = 8) {
    const e = this.e;
    const yaw = Math.atan2(p.x - e.body.pos.x, p.z - e.body.pos.z);
    this.turnTo(yaw, Math.min(1, dt * rate));
  }

  turnTo(yaw, k) {
    const e = this.e;
    let diff = yaw - e.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    e.yaw += diff * Math.min(1, k * 1.6);
  }

  separate(dt) {
    const e = this.e;
    const list = e.game.enemies;
    for (const o of list) {
      if (o === e || !o.alive) continue;
      const dx = e.body.pos.x - o.body.pos.x, dz = e.body.pos.z - o.body.pos.z;
      const min = e.body.halfW + o.body.halfW + 0.15;
      const d2 = dx * dx + dz * dz;
      if (d2 > min * min || d2 < 1e-6 || Math.abs(e.body.pos.y - o.body.pos.y) > 1.5) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / min * 4;
      e.body.vel.x += dx / d * push; e.body.vel.z += dz / d * push;
    }
  }

  checkStuck(dt) {
    const e = this.e;
    this.stuckTimer -= dt;
    if (this.stuckTimer > 0) return;
    this.stuckTimer = 1.0;
    const moved = Math.hypot(e.body.pos.x - this.stuckPos.x, e.body.pos.z - this.stuckPos.z);
    this.stuckPos.copy(e.body.pos);
    if (!this.wantsMove || this.override || this.state === 'attack') { this.stuckN = 0; return; }
    if (moved > 0.35) { this.stuckN = Math.max(0, this.stuckN - 1); return; }
    this.stuckN++;
    this.path = null; this.repathTimer = 0;
    // side-step to get around the obstacle
    const side = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw)).multiplyScalar(this.flankSide * e.cfg.walkSpeed);
    this.flankSide *= -1;
    this.override = { vel: side, time: 0.45 };
    if (this.stuckN >= 4) {
      // still stuck: relocate to a nearby walkable cell while the player isn't looking
      const game = e.game;
      const seen = game.physics.lineOfSight(game.player.controller.eyePosition, e.headSphere.c);
      if (!seen || this.stuckN >= 8) {
        const p = game.nav.randomWalkable(e.layer, e.body.pos, 1.5, 5);
        if (p) { e.body.pos.copy(p); e.body.pos.y = Math.max(e.body.pos.y, game.physics.groundHeight(p.x, p.z, e.body.pos.y + 0.5)) + 0.1; e.body.vel.set(0, 0, 0); }
        this.stuckN = 0;
      }
    }
  }
}
