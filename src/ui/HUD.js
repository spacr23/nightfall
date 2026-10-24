import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

/** In-game HUD. Caches values so the DOM is only touched when something changes. */
export class HUD {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.el = {
      wave: $('hud-wave'), enemies: $('hud-enemies'), points: $('hud-points'), flashlight: $('hud-flashlight'), zone: $('hud-zone'),
      hpBar: $('hud-health-bar'), hpText: $('hud-health-text'), arBar: $('hud-armor-bar'), arText: $('hud-armor-text'), stBar: $('hud-stamina-bar'),
      weapon: $('hud-weapon-name'), ammo: $('hud-ammo'), mag: $('hud-mag'), reserve: $('hud-reserve'), slots: $('hud-weapon-slots'),
      center: $('hud-center-msg'), banner: $('hud-wave-banner'), interact: $('hud-interact'), upgradeHint: $('hud-upgrade-hint'),
      note: $('hud-note'), noteText: $('hud-note-text'), cross: $('crosshair'), hit: $('hitmarker'), boss: $('hud-bossbar'),
      bossFill: document.querySelector('#hud-bossbar .boss-fill'), bossName: document.querySelector('#hud-bossbar .boss-name'),
      feed: $('hud-points-feed'), msg: $('hud-msg'), dmgDir: $('hud-damage-dir'),
    };
    this.cache = {};
    this.hitTimer = 0;
    this.msgTimer = 0;
    this.dmgTimer = 0;
    this.noteOpen = false;
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  set(key, value, fn) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(value);
  }

  update(dt) {
    const g = this.game, p = g.player, w = g.weapons.current, E = this.el;
    this.set('wave', g.waves.wave || '—', (v) => { E.wave.textContent = v; });
    this.set('enemies', g.waves.remaining, (v) => { E.enemies.textContent = v; });
    this.set('points', p.points, (v) => { E.points.textContent = v.toLocaleString('en-US'); });
    this.set('flash', p.flashlightOn, (v) => { E.flashlight.textContent = v ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF'; E.flashlight.classList.toggle('on', v); });
    const hp = Math.ceil(p.health.hp), max = p.health.max;
    this.set('hp', `${hp}/${max}`, () => { E.hpBar.style.width = `${(hp / max) * 100}%`; E.hpText.textContent = hp; });
    const ar = Math.ceil(p.health.armor);
    this.set('ar', ar, (v) => { E.arBar.style.width = `${v}%`; E.arText.textContent = v; });
    this.set('st', Math.round(p.controller.stamina * 50), (v) => { E.stBar.style.width = `${v * 2}%`; });
    if (w) {
      this.set('wname', w.name + (w.reloading > 0 ? ' · RELOADING' : ''), (v) => { E.weapon.textContent = v; });
      const ammo = w.isMelee ? '∞' : `${w.mag}|${w.reserve}`;
      this.set('ammo', ammo, () => {
        if (w.isMelee) { E.mag.textContent = '—'; E.reserve.textContent = '∞'; E.ammo.classList.remove('low'); }
        else { E.mag.textContent = w.mag; E.reserve.textContent = w.reserve; E.ammo.classList.toggle('low', w.mag <= Math.ceil(w.cfg.magSize * 0.25)); }
      });
      const slotKey = g.weapons.list.map((x) => (x.owned ? 1 : 0)).join('') + w.cfg.slot;
      this.set('slots', slotKey, () => {
        for (const s of E.slots.children) {
          const slot = +s.dataset.slot;
          const ww = g.weapons.bySlot[slot];
          s.classList.toggle('active', slot === w.cfg.slot);
          s.classList.toggle('locked', !ww || !ww.owned);
        }
      });
    }
    this.set('zone', g.zoneLabel, (v) => { E.zone.textContent = v; });
    // crosshair spread
    const spread = p.controller.moving || (w && w.cooldown > 0 && !w.isMelee);
    E.cross.classList.toggle('spread', !!spread);
    E.cross.classList.toggle('hidden-cross', g.weapons.ads && w && w.id !== 'axe');
    if (this.hitTimer > 0) { this.hitTimer -= dt; if (this.hitTimer <= 0) E.hit.classList.remove('show'); }
    if (this.msgTimer > 0) { this.msgTimer -= dt; if (this.msgTimer <= 0) E.msg.classList.remove('show'); }
    if (this.dmgTimer > 0) { this.dmgTimer -= dt; if (this.dmgTimer <= 0) E.dmgDir.classList.remove('show'); }
    const boss = g.waves.boss;
    if (boss) this.set('boss', Math.ceil((boss.hp / boss.maxHp) * 200), (v) => { E.bossFill.style.width = `${v / 2}%`; });
  }

  hitmarker(head, kill) {
    const h = this.el.hit;
    h.classList.toggle('head', !!head || !!kill);
    h.classList.add('show');
    this.hitTimer = kill ? 0.25 : 0.1;
  }

  pointsPopup(n, label) {
    const d = document.createElement('div');
    d.className = 'pts' + (label && label.includes('HEAD') ? ' head' : '');
    d.textContent = `+${n} ${label}`;
    this.el.feed.appendChild(d);
    setTimeout(() => d.remove(), 1700);
    while (this.el.feed.children.length > 6) this.el.feed.firstChild.remove();
  }

  message(text, seconds = 2) { this.el.msg.textContent = text; this.el.msg.classList.add('show'); this.msgTimer = seconds; }

  setCenter(html) {
    this.set('center', html, (v) => { this.el.center.innerHTML = v; this.el.center.classList.toggle('hidden', !v); });
  }

  waveBanner(title, sub) {
    const b = this.el.banner;
    b.querySelector('.banner-title').textContent = title;
    b.querySelector('.banner-sub').textContent = sub;
    b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => b.classList.add('hidden'), 3700);
  }

  showUpgradeHint(v) { this.el.upgradeHint.classList.toggle('hidden', !v); }

  interact(label) {
    this.set('interact', label || '', (v) => { this.el.interact.textContent = v ? `[E] ${v}` : ''; this.el.interact.classList.toggle('hidden', !v); });
  }

  showNote(text) {
    this.noteOpen = !!text;
    this.el.noteText.textContent = text || '';
    this.el.note.classList.toggle('hidden', !text);
  }

  bossBar(v, name) { this.el.boss.classList.toggle('hidden', !v); if (name) this.el.bossName.textContent = name; this.cache.boss = null; }

  damageDirection(sourcePos) {
    const cam = this.game.camera;
    const to = new THREE.Vector3().subVectors(sourcePos, cam.position).setY(0).normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const ang = Math.atan2(to.dot(right), to.dot(fwd));
    this.el.dmgDir.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
    this.el.dmgDir.classList.add('show');
    this.dmgTimer = 0.5;
  }

  reset() {
    this.cache = {};
    this.showNote(null);
    this.bossBar(false);
    this.setCenter('');
    this.showUpgradeHint(false);
    this.el.banner.classList.add('hidden');
    this.el.feed.innerHTML = '';
  }
}
