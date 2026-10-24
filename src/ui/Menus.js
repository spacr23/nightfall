import { UPGRADES } from '../game/Upgrades.js';

const $ = (id) => document.getElementById(id);
const LORE = [
  '“The bell tolls thirteen, and the soil begins to breathe.”',
  '“Silver for the spirits. Iron for the pale ones. Fire for the beast.”',
  '“The Blackwoods never left the manor. They only stopped breathing.”',
  '“Do not run into the woods when the moon is swollen.”',
  '“Something old sleeps beneath the standing stones in the east.”',
  '“If you hear whispering behind you, do not turn around.”',
];

/**
 * All DOM menus: main (dynamic), pause, settings, controls, credits, upgrades, game over.
 * Screen switching is driven by Game via `showScreen(name)`.
 */
export class Menus {
  constructor(game) {
    this.game = game;
    this.screens = {
      main: $('main-menu'), pause: $('pause-menu'), settings: $('settings-menu'), controls: $('controls-menu'),
      credits: $('credits-menu'), upgrade: $('upgrade-menu'), gameover: $('gameover-menu'),
    };
    this.current = null;
    this.back = 'main';
    this.bind();
    this.initSettings();
    this.initMainMenuFx();
  }

  showScreen(name) {
    for (const k in this.screens) this.screens[k].classList.toggle('hidden', k !== name);
    this.current = name;
    if (name === 'main') this.refreshStats();
  }

  hideAll() { this.showScreen(null); }

  click(id, fn) {
    const el = $(id);
    el.addEventListener('click', (e) => { e.preventDefault(); this.game.audio.unlock(); this.game.audio.play('ui'); fn(); });
    el.addEventListener('mouseenter', () => { if (this.game.audio.unlocked) this.game.audio.play('ui'); el.classList.remove('glitch'); void el.offsetWidth; el.classList.add('glitch'); });
  }

  bind() {
    const g = this.game;
    this.click('btn-play', () => g.startGame());
    this.click('btn-settings', () => { this.back = 'main'; this.showScreen('settings'); });
    this.click('btn-controls', () => { this.back = 'main'; this.showScreen('controls'); });
    this.click('btn-credits', () => this.showScreen('credits'));
    this.click('btn-settings-back', () => this.showScreen(this.back));
    this.click('btn-controls-back', () => this.showScreen(this.back));
    this.click('btn-credits-back', () => this.showScreen('main'));
    this.click('btn-resume', () => g.resume());
    this.click('btn-restart', () => g.restart());
    this.click('btn-pause-settings', () => { this.back = 'pause'; this.showScreen('settings'); });
    this.click('btn-pause-main', () => g.toMainMenu());
    this.click('btn-go-restart', () => g.restart());
    this.click('btn-go-main', () => g.toMainMenu());
    this.click('btn-upgrade-close', () => g.closeUpgrades());
    // first interaction anywhere unlocks audio (menu ambience)
    const unlock = () => { g.audio.unlock(); g.audio.startAmbience(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
  }

  initSettings() {
    const s = this.game.settings;
    const bindRange = (id, key, toVal, fmt) => {
      const el = $(id);
      const val = el.parentElement.querySelector('.val');
      el.value = String(Math.round(key === 'fov' ? s.get(key) : s.get(key) * 100));
      const show = () => { val.textContent = fmt(+el.value); };
      show();
      el.addEventListener('input', () => { s.set(key, toVal(+el.value)); show(); });
    };
    bindRange('set-master', 'master', (v) => v / 100, (v) => `${v}%`);
    bindRange('set-sfx', 'sfx', (v) => v / 100, (v) => `${v}%`);
    bindRange('set-music', 'music', (v) => v / 100, (v) => `${v}%`);
    bindRange('set-sens', 'sensitivity', (v) => v / 100, (v) => `${(v / 100).toFixed(2)}x`);
    bindRange('set-fov', 'fov', (v) => v, (v) => `${v}°`);
    const q = $('set-quality'); q.value = s.get('quality');
    q.addEventListener('change', () => s.set('quality', q.value));
    const inv = $('set-invert'); inv.checked = s.get('invertY'); inv.addEventListener('change', () => s.set('invertY', inv.checked));
    const bob = $('set-bob'); bob.checked = s.get('headBob'); bob.addEventListener('change', () => s.set('headBob', bob.checked));
  }

  // ---------------------------------------------------------------- upgrades
  renderUpgrades() {
    const g = this.game, sys = g.upgrades;
    $('upgrade-points').textContent = g.player.points.toLocaleString('en-US');
    const list = $('upgrade-list');
    list.innerHTML = '';
    for (const u of UPGRADES) {
      const avail = sys.available(u);
      if (u.weapon && !avail) continue;
      const lvl = sys.level(u.id);
      const cost = sys.cost(u);
      const item = document.createElement('div');
      item.className = 'upgrade-item';
      const maxed = !u.repeat && lvl >= u.max;
      item.innerHTML = `<div class="u-name">${u.name}</div><div class="u-desc">${u.desc}</div>
        <div class="u-row"><span class="u-level">${u.repeat ? 'Consumable' : `Level ${lvl}/${u.max}`}</span>
        <button ${!avail || g.player.points < cost ? 'disabled' : ''}>${maxed ? 'MAX' : cost + ' PTS'}</button></div>`;
      item.querySelector('button').addEventListener('click', () => { if (sys.buy(u.id)) this.renderUpgrades(); });
      list.appendChild(item);
    }
  }

  // ---------------------------------------------------------------- game over
  showGameOver(stats) {
    $('go-wave').textContent = stats.wave;
    $('go-kills').textContent = stats.kills;
    $('go-headshots').textContent = stats.headshots;
    $('go-points').textContent = stats.points.toLocaleString('en-US');
    this.showScreen('gameover');
  }

  refreshStats() {
    let best = {};
    try { best = JSON.parse(localStorage.getItem('nightfall.best') || '{}'); } catch (e) { /* ignore */ }
    $('menu-stats').innerHTML = best.wave
      ? `BEST WAVE <b>${best.wave}</b><br>MOST KILLS <b>${best.kills}</b><br>HIGH SCORE <b>${(best.points || 0).toLocaleString('en-US')}</b>`
      : 'NO SURVIVORS YET';
  }

  // ---------------------------------------------------------------- dynamic main menu
  initMainMenuFx() {
    // split title into letters that flicker individually
    const t = document.querySelector('.title-main');
    t.innerHTML = [...t.textContent].map((c) => `<span class="ch">${c}</span>`).join('');
    this.chars = [...t.querySelectorAll('.ch')];
    // parallax
    const inner = $('menu-inner');
    window.addEventListener('mousemove', (e) => {
      if (this.current !== 'main') return;
      const x = (e.clientX / window.innerWidth - 0.5), y = (e.clientY / window.innerHeight - 0.5);
      inner.style.transform = `translate(${x * -14}px, ${y * -10}px)`;
      this.game.menuLook = { x, y };
    });
    // lore ticker
    const lore = $('menu-lore');
    let li = Math.floor(Math.random() * LORE.length);
    const nextLore = () => {
      lore.classList.remove('show');
      setTimeout(() => { lore.textContent = LORE[li++ % LORE.length]; lore.classList.add('show'); }, 1300);
    };
    nextLore();
    setInterval(() => { if (this.current === 'main') nextLore(); }, 7000);
    // ember / ash particles
    const c = $('menu-embers');
    const ctx = c.getContext('2d');
    const embers = [];
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    for (let i = 0; i < 90; i++) embers.push(this._ember(c, true));
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (this.current === 'main') {
        ctx.clearRect(0, 0, c.width, c.height);
        for (let i = 0; i < embers.length; i++) {
          const e = embers[i];
          e.x += (e.vx + Math.sin(now * 0.001 * e.f + e.ph) * 12) * dt; e.y += e.vy * dt; e.life -= dt;
          if (e.y < -10 || e.life <= 0) { embers[i] = this._ember(c, false); continue; }
          const a = Math.min(1, e.life / 2) * e.a;
          ctx.fillStyle = e.ash ? `rgba(140,145,155,${a * 0.5})` : `rgba(255,${90 + e.g},40,${a})`;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
        }
        // random letter flicker
        if (Math.random() < 0.04) {
          const ch = this.chars[Math.floor(Math.random() * this.chars.length)];
          ch.classList.add('drop'); setTimeout(() => ch.classList.remove('drop'), 120 + Math.random() * 200);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _ember(c, initial) {
    const ash = Math.random() < 0.45;
    return {
      x: Math.random() * c.width, y: initial ? Math.random() * c.height : c.height + 10,
      vx: (Math.random() - 0.5) * 20, vy: -(20 + Math.random() * 50) * (ash ? 0.5 : 1),
      r: ash ? 1 + Math.random() * 2.2 : 0.6 + Math.random() * 1.6, a: 0.4 + Math.random() * 0.6,
      life: 6 + Math.random() * 10, f: 0.5 + Math.random(), ph: Math.random() * 6, g: Math.floor(Math.random() * 100), ash,
    };
  }
}
