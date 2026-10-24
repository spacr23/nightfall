import * as THREE from 'three';

/**
 * Touch controls for iPhone / iPad (and any touch-only device).
 *  - left half: floating joystick (push to the edge while moving forward = sprint)
 *  - right half: drag to look; the FIRE button also steers while held
 *  - buttons: fire, aim (toggle), jump, reload, next weapon, interact (contextual)
 *  - small top buttons: flashlight, upgrades (between waves), next wave (between waves), menu
 * Everything is fed into the InputManager so gameplay code stays identical to desktop.
 */
const LOOK_GAIN = 2.3;

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.root = document.getElementById('touch-ui');
    this.pointers = new Map(); // pointerId -> {role, x, y, ox, oy}
    this.aimToggle = false;
    this.firing = false;
    this.aimAssistTimer = 0;
    this.build();
  }

  build() {
    const r = this.root;
    r.innerHTML = `
      <div class="tc-zone tc-move"></div>
      <div class="tc-zone tc-look"></div>
      <div class="tc-stick hidden"><div class="tc-knob"></div></div>
      <button class="tc-btn tc-fire" data-act="fire"><span>FIRE</span></button>
      <button class="tc-btn tc-aim" data-act="aim"><span>AIM</span></button>
      <button class="tc-btn tc-jump" data-act="jump"><span>JUMP</span></button>
      <button class="tc-btn tc-reload" data-act="reload"><span>R</span></button>
      <button class="tc-btn tc-swap" data-act="swap"><span>⇄</span></button>
      <button class="tc-btn tc-use hidden" data-act="use"><span>USE</span></button>
      <div class="tc-top">
        <button class="tc-mini" data-act="light" title="Flashlight">LIGHT</button>
        <button class="tc-mini tc-upg hidden" data-act="upgrades">UPGRADES</button>
        <button class="tc-mini tc-next hidden" data-act="next">NEXT WAVE ▸</button>
        <button class="tc-mini" data-act="menu" title="Menu">☰</button>
      </div>`;
    this.stick = r.querySelector('.tc-stick');
    this.knob = r.querySelector('.tc-knob');
    this.btn = {};
    r.querySelectorAll('[data-act]').forEach((b) => { this.btn[b.dataset.act] = b; });

    r.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    // iOS: block the page from scrolling / zooming while playing
    r.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    r.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    r.addEventListener('contextmenu', (e) => e.preventDefault());
    // tap a weapon slot in the HUD to select it
    document.querySelectorAll('#hud-weapon-slots span').forEach((s) => s.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.game.weapons.select(+s.dataset.slot); }));
    // tap a note to close it
    document.getElementById('hud-note').addEventListener('pointerdown', () => this.game.hud.showNote(null));
  }

  show(v) { this.root.classList.toggle('hidden', !v); if (!v) this.releaseAll(); }

  releaseAll() {
    this.pointers.clear();
    this.input.moveAxis.active = false; this.input.moveAxis.x = 0; this.input.moveAxis.y = 0;
    this.input.touchSprint = false;
    this.input.mouseButtons.delete(0);
    this.firing = false;
    this.stick.classList.add('hidden');
    for (const b of Object.values(this.btn)) b.classList.remove('down');
  }

  onDown(e) {
    e.preventDefault();
    this.game.audio.unlock();
    const t = e.target.closest('[data-act]');
    const p = { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
    if (t) {
      const act = t.dataset.act;
      t.classList.add('down');
      p.role = act; p.el = t;
      this.press(act);
    } else if (e.clientX < window.innerWidth * 0.45) {
      p.role = 'move';
      this.stick.classList.remove('hidden');
      this.stick.style.transform = `translate(${e.clientX - 60}px, ${e.clientY - 60}px)`;
      this.knob.style.transform = 'translate(0px, 0px)';
    } else {
      p.role = 'look';
    }
    this.pointers.set(e.pointerId, p);
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (p.role === 'move') {
      let ax = (e.clientX - p.ox) / 55, ay = (e.clientY - p.oy) / 55;
      const m = Math.hypot(ax, ay);
      if (m > 1) { ax /= m; ay /= m; }
      this.input.moveAxis.x = ax; this.input.moveAxis.y = ay; this.input.moveAxis.active = true;
      this.input.touchSprint = m > 1.05 && ay < -0.6;
      this.knob.style.transform = `translate(${ax * 45}px, ${ay * 45}px)`;
      this.knob.classList.toggle('sprint', this.input.touchSprint);
    } else if (p.role === 'look' || p.role === 'fire') {
      const k = LOOK_GAIN * (this.game.weapons.ads ? 0.75 : 1);
      this.input.mouseDX += dx * k;
      this.input.mouseDY += dy * k;
    }
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.el) p.el.classList.remove('down');
    if (p.role === 'move') {
      this.input.moveAxis.active = false; this.input.moveAxis.x = 0; this.input.moveAxis.y = 0;
      this.input.touchSprint = false;
      this.stick.classList.add('hidden');
    }
    if (p.role === 'fire') { this.firing = false; this.input.mouseButtons.delete(0); }
    if (p.role === 'jump') this.input.keys.delete('Space');
  }

  press(act) {
    const inp = this.input, g = this.game;
    const tap = (code) => { inp.keys.add(code); inp.pressedThisFrame.add(code); setTimeout(() => inp.keys.delete(code), 120); };
    switch (act) {
      case 'fire': this.firing = true; inp.mouseButtons.add(0); inp.mousePressedThisFrame.add(0); break;
      case 'aim':
        this.aimToggle = !this.aimToggle;
        this.btn.aim.classList.toggle('on', this.aimToggle);
        if (this.aimToggle) inp.mouseButtons.add(2); else inp.mouseButtons.delete(2);
        break;
      case 'jump': inp.keys.add('Space'); inp.pressedThisFrame.add('Space'); break;
      case 'reload': tap('KeyR'); break;
      case 'swap': inp.wheelDelta += 1; break;
      case 'use': tap('KeyE'); break;
      case 'light': tap('KeyF'); break;
      case 'next': tap('KeyN'); break;
      case 'upgrades': this.releaseAll(); g.openUpgrades(); break;
      case 'menu': this.releaseAll(); g.pause(); break;
      default: break;
    }
  }

  /** Per-frame: contextual buttons + gentle aim assist (touch aiming is hard). */
  update(dt) {
    const g = this.game;
    const inter = g.waves.inIntermission;
    this.btn.upgrades.classList.toggle('hidden', !inter);
    this.btn.next.classList.toggle('hidden', !inter);
    this.btn.use.classList.toggle('hidden', !g.focused);
    if (g.focused) {
      const lbl = typeof g.focused.label === 'function' ? g.focused.label() : g.focused.label;
      const span = this.btn.use.firstElementChild;
      const txt = (lbl || 'USE').replace('…', '').toUpperCase();
      if (span.textContent !== txt) span.textContent = txt;
    }
    const w = g.weapons.current;
    this.btn.aim.classList.toggle('hidden', !w || w.isMelee);
    if (w && w.isMelee && this.aimToggle) { this.aimToggle = false; this.input.mouseButtons.delete(2); this.btn.aim.classList.remove('on'); }
    this.btn.light.classList.toggle('on', g.player.flashlightOn);
    // aim assist: while firing or aiming, ease the view toward the enemy closest to the crosshair
    if (!(this.firing || this.aimToggle)) return;
    this.aimAssistTimer -= dt;
    if (this.aimAssistTimer <= 0) {
      this.aimAssistTimer = 0.1;
      this.assistTarget = this.findAssistTarget();
    }
    const tgt = this.assistTarget;
    if (!tgt || !tgt.alive) return;
    const pc = g.player.controller;
    const d = tgt.bodySphere.c.clone().sub(pc.eyePosition);
    let dy = Math.atan2(-d.x, -d.z) - pc.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    const dp = Math.atan2(d.y, Math.hypot(d.x, d.z)) - pc.pitch;
    const k = Math.min(1, dt * 4.5);
    pc.yaw += dy * k; pc.pitch += dp * k;
  }

  findAssistTarget() {
    const g = this.game;
    const cam = g.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = null, bestAng = 0.11;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const to = e.bodySphere.c.clone().sub(cam.position);
      const dist = to.length();
      if (dist > 45) continue;
      const ang = Math.acos(Math.min(1, to.dot(fwd) / dist));
      const limit = bestAng * (dist < 6 ? 2 : 1);
      if (ang < limit && g.physics.lineOfSight(cam.position, e.bodySphere.c, e.family === 'ghost')) { best = e; bestAng = ang; }
    }
    return best;
  }
}

/** True for phones/tablets without a mouse (iPadOS reports a Mac user agent, so check touch points). */
export function isTouchDevice() {
  const q = new URLSearchParams(window.location.search);
  if (q.has('touch')) return true;
  if (q.has('desktop')) return false;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent);
  return !!(coarse || iPadOS || /iPhone|iPad|iPod|Android/.test(navigator.userAgent));
}
