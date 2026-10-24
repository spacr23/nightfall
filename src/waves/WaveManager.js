import * as THREE from 'three';
import { createEnemy } from '../enemies/EnemyFactory.js';
import { SpawnManager } from './SpawnManager.js';

/**
 * Wave-based survival.
 *  intermission -> announce -> active (spawning while alive < cap) -> cleared -> intermission ...
 * Guards against double starts (single state machine, `wave` only increments in startWave),
 * stalls (far-away enemies are relocated) and infinite spawn loops (finite queue per wave).
 */
const FIXED = {
  1: { vampire: 5 },
  2: { vampire: 7, ghost: 1 },
  3: { vampire: 9, ghost: 2, werewolf: 1 },
  4: { vampire: 8, ghost: 4, werewolf: 4 },
  5: { vampire: 9, ghost: 5, werewolf: 5, ancientVampire: 1 },
  6: { vampire: 9, ghost: 6, werewolf: 8, ancientVampire: 1 },
  7: { vampire: 9, ghost: 7, werewolf: 10, ancientVampire: 1, alphaWerewolf: 1 },
  8: { vampire: 10, ghost: 9, werewolf: 10, ancientVampire: 1, alphaWerewolf: 1, revenant: 1 },
  9: { vampire: 10, ghost: 10, werewolf: 12, ancientVampire: 1, alphaWerewolf: 2, revenant: 1 },
  10: { boss: 1, vampire: 6, ghost: 4, werewolf: 6 },
};
export const FINAL_WAVE = 10;

export class WaveManager {
  constructor(game) {
    this.game = game;
    this.spawner = new SpawnManager(game);
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.wave = 0;
    this.timer = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.maxAlive = 22;
    this.killedThisWave = 0;
    this.boss = null;
    this.victoryShown = false;
  }

  start() {
    this.reset();
    this.state = 'intermission';
    this.timer = 12;
  }

  get alive() { let n = 0; for (const e of this.game.enemies) if (e.alive) n++; return n; }
  get remaining() { return this.queue.length + this.alive; }
  get inIntermission() { return this.state === 'intermission'; }

  /** Difficulty curve: the first three waves are a gentle warm-up, then it ramps steadily. */
  scaleFor(w) {
    const EARLY = {
      1: { hp: 0.55, dmg: 0.35, speed: 0.85, aggression: 0.6 },
      2: { hp: 0.65, dmg: 0.42, speed: 0.88, aggression: 0.68 },
      3: { hp: 0.75, dmg: 0.47, speed: 0.92, aggression: 0.74 },
    };
    if (EARLY[w]) return { ...EARLY[w] };
    return {
      hp: 0.92 + 0.11 * (w - 4),
      dmg: 0.68 + 0.07 * (w - 4),
      speed: Math.min(1.25, 0.97 + 0.02 * (w - 4)),
      aggression: Math.min(1.7, 0.9 + 0.07 * (w - 4)),
    };
  }

  /** How many enemies may be alive at once. */
  capFor(w) { return w === 1 ? 3 : w === 2 ? 3 : w === 3 ? 4 : w === 4 ? 8 : w === 5 ? 12 : 22; }

  compose(w) {
    let comp = FIXED[w];
    if (!comp) {
      const n = 36 + (w - FINAL_WAVE) * 4;
      const elites = Math.min(8, 2 + Math.floor((w - FINAL_WAVE) / 2));
      comp = { vampire: Math.round(n * 0.3), ghost: Math.round(n * 0.3), werewolf: Math.round(n * 0.4) - elites };
      comp.ancientVampire = Math.ceil(elites / 3); comp.alphaWerewolf = Math.ceil(elites / 3); comp.revenant = Math.floor(elites / 3);
      if (w % 5 === 0) comp.boss = 1;
    }
    const q = [];
    for (const t in comp) for (let i = 0; i < comp[t]; i++) q.push(t);
    // shuffle regular enemies, keep elites toward the back half and the boss first
    const regular = q.filter((t) => ['vampire', 'ghost', 'werewolf'].includes(t)).sort(() => Math.random() - 0.5);
    const elites = q.filter((t) => ['ancientVampire', 'alphaWerewolf', 'revenant'].includes(t));
    const out = [];
    if (comp.boss) out.push('boss');
    const half = Math.floor(regular.length / 2);
    out.push(...regular.slice(0, half));
    for (const e of elites) out.push(e, ...regular.splice(half, 3));
    out.push(...regular.slice(half));
    return out;
  }

  startWave(n) {
    if (this.state === 'announce' || this.state === 'active') return; // never double-start
    this.wave = n;
    this.queue = this.compose(n);
    this.killedThisWave = 0;
    this.state = 'announce';
    this.timer = 2.5;
    this.spawnTimer = 0;
    this.scale = this.scaleFor(n);
    const isBoss = this.queue.includes('boss');
    const sub = isBoss ? 'THE NIGHTFATHER AWAKENS' : n === 1 ? 'SURVIVE THE NIGHT' : n >= 7 ? 'THE DARKNESS HUNGERS' : 'THEY ARE COMING';
    this.game.hud.waveBanner(`WAVE ${n}`, sub);
    this.game.audio.play(isBoss ? 'bossSpawn' : 'waveStart');
    this.game.hud.showUpgradeHint(false);
    this.game.audio.setMusicIntensity(1);
  }

  update(dt) {
    const game = this.game;
    switch (this.state) {
      case 'intermission': {
        this.timer -= dt;
        game.hud.setCenter(`Next wave in ${Math.ceil(this.timer)}  ·  <b>N</b> start now  ·  <b>TAB</b> upgrades`);
        if (game.input.wasPressed('KeyN')) this.timer = 0;
        if (this.timer <= 0) { game.hud.setCenter(''); this.startWave(this.wave + 1); }
        break;
      }
      case 'announce':
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'active';
        break;
      case 'active': {
        this.spawnTimer -= dt;
        const cap = Math.min(this.maxAlive, this.capFor(this.wave));
        if (this.queue.length && this.spawnTimer <= 0 && this.alive < cap) {
          this.spawnNext();
          this.spawnTimer = (this.wave <= 2 ? 2.6 : this.wave === 3 ? 1.8 : 0.8) + Math.random() * 0.6;
        }
        this.antiStall(dt);
        if (!this.queue.length && this.alive === 0) this.waveCleared();
        break;
      }
      default: break;
    }
  }

  spawnNext() {
    const type = this.queue.shift();
    if (!type) return;
    let pos;
    if (type === 'boss') pos = this.game.world.bossArena.clone().add(new THREE.Vector3(0, 0.1, 0));
    else pos = this.spawner.pick(type);
    if (!pos) { this.queue.push(type); return; }
    const e = createEnemy(this.game, type, pos, this.scale);
    this.game.addEnemy(e);
    this.game.effects.spawnEffect(e);
    if (type === 'boss') {
      this.boss = e;
      this.game.hud.bossBar(true, e.cfg.name);
      this.game.hud.message('Something ancient stirs in the eastern woods…', 4);
    }
  }

  summonMinions(center, n) {
    for (let i = 0; i < n; i++) {
      const type = Math.random() < 0.5 ? 'vampire' : 'ghost';
      const pos = this.spawner.around(center, 4, 9);
      const e = createEnemy(this.game, type, pos, this.scale || this.scaleFor(this.wave));
      e.ai.alerted = true; e.ai.setState('chase');
      this.game.addEnemy(e);
      this.game.effects.spawnEffect(e);
    }
  }

  antiStall(dt) {
    const game = this.game;
    const pp = game.player.position;
    for (const e of game.enemies) {
      if (!e.alive || e.isBoss) continue;
      const d = e.body.pos.distanceTo(pp);
      e.farTime = d > 80 && e.ai.lastSeen > 6 ? (e.farTime || 0) + dt : 0;
      if (e.farTime > 15) {
        const p = this.spawner.pick(e.type);
        if (p && p.distanceTo(pp) < d) { e.body.pos.copy(p); e.body.vel.set(0, 0, 0); e.ai.path = null; }
        e.farTime = 0;
      }
    }
  }

  waveCleared() {
    const game = this.game;
    const bonus = 200 + this.wave * 100;
    game.player.addPoints(bonus, 'WAVE CLEARED');
    game.audio.play(this.boss ? 'bossDead' : 'waveClear');
    game.audio.setMusicIntensity(0.3);
    game.world.respawnPickups();
    // resupply between waves: every owned gun gets two magazines, the pistol is topped up to half capacity
    for (const w of game.weapons.list) {
      if (!w.owned || w.isMelee) continue;
      const cap = w.reserveCap(game.player.mods);
      w.reserve = Math.min(cap, w.reserve + w.cfg.magSize * 2);
      if (w.id === 'pistol') w.reserve = Math.max(w.reserve, Math.round(cap / 2));
    }
    if (this.wave === FINAL_WAVE && !this.victoryShown) {
      this.victoryShown = true;
      game.hud.waveBanner('THE NIGHTFATHER FALLS', 'YOU SURVIVED THE HAUNTED GROUNDS · THE NIGHT GOES ON');
    } else {
      game.hud.waveBanner(`WAVE ${this.wave} SURVIVED`, `+${bonus} POINTS`);
    }
    this.boss = null;
    game.hud.bossBar(false);
    this.state = 'intermission';
    this.timer = this.wave < 3 ? 20 : 28;
    game.hud.showUpgradeHint(true);
  }
}
