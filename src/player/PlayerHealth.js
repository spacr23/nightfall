/** Health + armor. Armor absorbs 60% of incoming damage until depleted. */
export class PlayerHealth {
  constructor(max = 100) {
    this.max = max;
    this.hp = max;
    this.armor = 0;
    this.maxArmor = 100;
    this.invuln = 0;
    this.regenDelay = 0;
    this.dead = false;
  }

  reset(max = this.max) { this.max = max; this.hp = max; this.armor = 0; this.dead = false; this.invuln = 0; this.regenDelay = 0; }

  /** Returns the damage actually applied to health. */
  damage(amount) {
    if (this.dead || this.invuln > 0) return 0;
    let dmg = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.6);
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    this.hp = Math.max(0, this.hp - dmg);
    this.regenDelay = 5;
    this.invuln = 0.08; // de-duplicates simultaneous hits from one swing
    if (this.hp <= 0) this.dead = true;
    return dmg;
  }

  heal(amount) { if (this.dead) return false; if (this.hp >= this.max) return false; this.hp = Math.min(this.max, this.hp + amount); return true; }
  addArmor(amount) { if (this.armor >= this.maxArmor) return false; this.armor = Math.min(this.maxArmor, this.armor + amount); return true; }

  update(dt) {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dead) return;
    if (this.regenDelay > 0) this.regenDelay -= dt;
    // regeneration up to 50% of max health, encouraging the use of medkits
    else if (this.hp < this.max * 0.5) this.hp = Math.min(this.max * 0.5, this.hp + 4 * dt);
  }
}
