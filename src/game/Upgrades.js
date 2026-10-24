/** Point-based upgrades bought between waves. */
export const UPGRADES = [
  { id: 'vitality', name: 'Vitality', desc: '+20 max health', max: 5, cost: (l) => 400 + l * 300, apply: (g) => { g.player.health.max += 20; g.player.health.heal(20); } },
  { id: 'damage', name: 'Silver Rounds', desc: '+12% weapon damage', max: 5, cost: (l) => 500 + l * 350, apply: (g) => { g.player.mods.damageMul += 0.12; } },
  { id: 'reload', name: 'Sleight of Hand', desc: '-12% reload time, faster axe', max: 4, cost: (l) => 350 + l * 250, apply: (g) => { g.player.mods.reloadMul *= 0.88; g.player.mods.meleeSpeedMul *= 1.08; } },
  { id: 'ammo', name: 'Bandolier', desc: '+25% max reserve ammo', max: 4, cost: (l) => 350 + l * 250, apply: (g) => { g.player.mods.ammoMul += 0.25; } },
  { id: 'speed', name: 'Fleet Foot', desc: '+6% move speed, more stamina', max: 3, cost: (l) => 400 + l * 300, apply: (g) => { g.player.controller.speedMul += 0.06; g.player.controller.sprintMul += 0.04; } },
  { id: 'flashlight', name: 'Better Flashlight', desc: 'Brighter, wider, longer beam', max: 3, cost: (l) => 300 + l * 250, apply: (g) => { g.player.flashlightLevel++; g.player.applyFlashlight(); } },
  { id: 'armor', name: 'Iron Vest', desc: '+50 armor', max: 99, cost: () => 300, repeat: true, can: (g) => g.player.health.armor < g.player.health.maxArmor, apply: (g) => { g.player.health.addArmor(50); } },
  { id: 'resupply', name: 'Resupply', desc: 'Refill all reserve ammo', max: 99, cost: () => 250, repeat: true, apply: (g) => { g.weapons.addAmmo('all', 0); } },
  { id: 'medkit', name: 'Medkit', desc: 'Restore 60 health', max: 99, cost: () => 200, repeat: true, can: (g) => g.player.health.hp < g.player.health.max, apply: (g) => { g.player.health.heal(60); } },
  { id: 'shotgun', name: 'Unlock Shotgun', desc: 'Blessed iron buckshot [2]', max: 1, cost: () => 900, weapon: 'shotgun', apply: (g) => { g.weapons.give('shotgun'); } },
  { id: 'rifle', name: 'Unlock Assault Rifle', desc: 'Full-auto firepower [3]', max: 1, cost: () => 1400, weapon: 'rifle', apply: (g) => { g.weapons.give('rifle'); } },
  { id: 'crossbow', name: 'Unlock Holy Crossbow', desc: 'Bane of spirits [4]', max: 1, cost: () => 1800, weapon: 'crossbow', apply: (g) => { g.weapons.give('crossbow'); } },
];

export class UpgradeSystem {
  constructor(game) { this.game = game; this.levels = {}; }
  reset() { this.levels = {}; }
  level(id) { return this.levels[id] || 0; }

  available(u) {
    const g = this.game;
    if (u.weapon) { const w = g.weapons.list.find((x) => x.id === u.weapon); if (w && w.owned) return false; }
    if (!u.repeat && this.level(u.id) >= u.max) return false;
    if (u.can && !u.can(g)) return false;
    return true;
  }

  cost(u) { return u.cost(this.level(u.id)); }

  buy(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const g = this.game;
    if (!u || !this.available(u)) return false;
    const c = this.cost(u);
    if (g.player.points < c) return false;
    g.player.points -= c;
    this.levels[id] = this.level(id) + 1;
    u.apply(g);
    g.audio.play('upgrade');
    return true;
  }
}
