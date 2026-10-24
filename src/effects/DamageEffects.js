/** Screen-space feedback: damage pulses, low-health heartbeat, white flashes, jumpscare overlay. */
export class DamageEffects {
  constructor() {
    this.damageEl = document.getElementById('damage-overlay');
    this.flashEl = document.getElementById('flash-overlay');
    this.scareEl = document.getElementById('scare-overlay');
    this.vignette = document.getElementById('vignette');
    this.damageLevel = 0;
    this.flashLevel = 0;
    this.lowHealth = false;
  }

  damage(amount) { this.damageLevel = Math.min(1, this.damageLevel + 0.25 + amount / 40); }
  flash(v = 0.6) { this.flashLevel = Math.max(this.flashLevel, v); }

  scare() {
    const el = this.scareEl;
    el.classList.remove('show');
    void el.offsetWidth; // restart animation
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 700);
  }

  update(dt, healthPct) {
    this.damageLevel = Math.max(0, this.damageLevel - dt * 1.6);
    this.flashLevel = Math.max(0, this.flashLevel - dt * 4);
    this.damageEl.style.opacity = String(Math.min(0.85, this.damageLevel));
    this.flashEl.style.opacity = String(this.flashLevel * 0.35);
    const low = healthPct < 0.3 && healthPct > 0;
    if (low !== this.lowHealth) { this.lowHealth = low; document.body.classList.toggle('low-health', low); }
  }

  reset() { this.damageLevel = 0; this.flashLevel = 0; this.lowHealth = false; document.body.classList.remove('low-health'); this.update(0, 1); }
}
