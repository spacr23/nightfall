import * as THREE from 'three';

/**
 * Procedural audio: every sound is synthesised with the Web Audio API at runtime.
 * Call `unlock()` from a user gesture before anything plays.
 */
export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null; this.sfx = null; this.music = null; this.ambient = null;
    this.buffers = {};
    this.unlocked = false;
    this.ambientNodes = [];
    this.musicNodes = [];
    this.listenerPos = new THREE.Vector3();
    this.heartbeatTimer = 0;
    this._ambientTimers = { howl: 8, bats: 14, whisper: 20, creak: 6 };
    settings.onChange((k) => { if (['master', 'sfx', 'music'].includes(k)) this.applyVolumes(); });
  }

  unlock() {
    if (this.unlocked) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.ambient = this.ctx.createGain();
    this.sfx.connect(this.master); this.music.connect(this.master); this.ambient.connect(this.sfx);
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.unlocked = true;
    this.applyVolumes();
    this._buildBuffers();
  }

  applyVolumes() {
    if (!this.unlocked) return;
    this.master.gain.value = this.settings.get('master');
    this.sfx.gain.value = this.settings.get('sfx');
    this.music.gain.value = this.settings.get('music') * 0.5;
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // ---------------------------------------------------------------- buffers
  _noiseBuffer(seconds, shape) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let v = Math.random() * 2 - 1;
      if (shape.brown) { last = (last + 0.02 * v) / 1.02; v = last * 3.5; }
      d[i] = v * shape.env(t, i / sr);
    }
    return buf;
  }

  _buildBuffers() {
    const exp = (k) => (t) => Math.exp(-k * t);
    this.buffers.shot = this._noiseBuffer(0.35, { env: (t) => Math.exp(-14 * t) * (t < 0.01 ? t / 0.01 : 1) });
    this.buffers.shotBig = this._noiseBuffer(0.7, { env: (t) => Math.exp(-7 * t), brown: true });
    this.buffers.click = this._noiseBuffer(0.05, { env: exp(60) });
    this.buffers.step = this._noiseBuffer(0.18, { env: (t) => Math.exp(-22 * t) * Math.min(1, t * 80), brown: true });
    this.buffers.stepWood = this._noiseBuffer(0.22, { env: (t) => Math.exp(-16 * t) * Math.min(1, t * 60) });
    this.buffers.whoosh = this._noiseBuffer(0.4, { env: (t) => Math.sin(Math.PI * t) ** 2, brown: true });
    this.buffers.impact = this._noiseBuffer(0.12, { env: exp(40) });
    this.buffers.flesh = this._noiseBuffer(0.25, { env: exp(18), brown: true });
    this.buffers.wind = this._noiseBuffer(6, { env: () => 1, brown: true });
    this.buffers.white = this._noiseBuffer(3, { env: () => 1 });
    this.buffers.rumble = this._noiseBuffer(1.2, { env: (t) => Math.exp(-4 * t), brown: true });
  }

  // ---------------------------------------------------------------- helpers
  _now() { return this.ctx.currentTime; }

  _out(pos) {
    if (!pos) return this.sfx;
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 3; p.maxDistance = 120; p.rolloffFactor = 1.1;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    p.connect(this.sfx);
    return p;
  }

  _playBuffer(buf, { pos, gain = 1, rate = 1, filter, q = 1, dur } = {}) {
    if (!this.unlocked) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    let node = src;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = q;
      node.connect(f); node = f;
    }
    node.connect(g); g.connect(this._out(pos));
    src.start();
    if (dur) src.stop(this._now() + dur);
    return { src, gain: g };
  }

  _tone({ type = 'sine', freq = 440, freqEnd, dur = 0.5, gain = 0.3, pos, attack = 0.01, release, detune = 0, filterFreq, delay = 0 }) {
    if (!this.unlocked) return;
    const t0 = this._now() + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0); osc.detune.value = detune;
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + (release || 0));
    let node = osc;
    if (filterFreq) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq; node.connect(f); node = f; }
    node.connect(g); g.connect(this._out(pos));
    osc.start(t0); osc.stop(t0 + dur + (release || 0) + 0.05);
  }

  updateListener(camera) {
    if (!this.unlocked) return;
    const l = this.ctx.listener;
    const p = camera.position;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
      l.upX.value = up.x; l.upY.value = up.y; l.upZ.value = up.z;
    } else {
      l.setPosition(p.x, p.y, p.z); l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
    this.listenerPos.copy(p);
  }

  // ---------------------------------------------------------------- weapons
  play(name, opts = {}) {
    if (!this.unlocked) return;
    const pos = opts.pos;
    switch (name) {
      case 'pistol':
        this._playBuffer(this.buffers.shot, { gain: 0.9, rate: 1.1, filter: { freq: 3200 } });
        this._tone({ type: 'square', freq: 180, freqEnd: 50, dur: 0.12, gain: 0.35 });
        break;
      case 'shotgun':
        this._playBuffer(this.buffers.shotBig, { gain: 1.2, rate: 0.9, filter: { freq: 1800 } });
        this._playBuffer(this.buffers.shot, { gain: 0.7, rate: 0.8 });
        this._tone({ type: 'sawtooth', freq: 90, freqEnd: 30, dur: 0.3, gain: 0.5 });
        break;
      case 'rifle':
        this._playBuffer(this.buffers.shot, { gain: 0.75, rate: 1.35, filter: { freq: 4000 } });
        this._tone({ type: 'square', freq: 240, freqEnd: 70, dur: 0.08, gain: 0.25 });
        break;
      case 'crossbow':
        this._playBuffer(this.buffers.whoosh, { gain: 0.8, rate: 1.6, filter: { type: 'bandpass', freq: 1200 }, q: 1.5 });
        this._tone({ type: 'sine', freq: 880, freqEnd: 1760, dur: 0.35, gain: 0.18 });
        this._tone({ type: 'triangle', freq: 1320, dur: 0.6, gain: 0.08, attack: 0.05 });
        break;
      case 'axeSwing':
        this._playBuffer(this.buffers.whoosh, { gain: 0.6, rate: 1.1, filter: { freq: 900 } });
        break;
      case 'axeHit':
        this._playBuffer(this.buffers.flesh, { gain: 1.0, rate: 0.9, filter: { freq: 1200 } });
        this._tone({ type: 'triangle', freq: 120, freqEnd: 40, dur: 0.2, gain: 0.4 });
        break;
      case 'dryfire':
        this._playBuffer(this.buffers.click, { gain: 0.5, rate: 0.8 });
        break;
      case 'reloadStart':
        this._playBuffer(this.buffers.click, { gain: 0.6, rate: 0.7, filter: { freq: 2500 } });
        break;
      case 'reloadEnd':
        this._playBuffer(this.buffers.click, { gain: 0.7, rate: 1.1, filter: { freq: 3500 } });
        this._tone({ type: 'square', freq: 1400, dur: 0.03, gain: 0.08 });
        break;
      case 'switch':
        this._playBuffer(this.buffers.click, { gain: 0.4, rate: 1.3 });
        break;
      case 'impactStone':
        this._playBuffer(this.buffers.impact, { gain: 0.5, rate: 1 + Math.random() * 0.4, pos, filter: { freq: 3000 } });
        break;
      case 'hitFlesh':
        this._playBuffer(this.buffers.flesh, { gain: 0.6, rate: 1 + Math.random() * 0.3, pos, filter: { freq: 1500 } });
        break;
      case 'hitGhost':
        this._tone({ type: 'sine', freq: 600 + Math.random() * 300, freqEnd: 200, dur: 0.3, gain: 0.25, pos });
        break;
      case 'headshot':
        this._tone({ type: 'sine', freq: 1500, freqEnd: 900, dur: 0.12, gain: 0.2 });
        break;

      // ------------------------------------------------------- player
      case 'stepGrass':
        this._playBuffer(this.buffers.step, { gain: 0.35 * (opts.gain || 1), rate: 0.9 + Math.random() * 0.3, filter: { freq: 900 } });
        break;
      case 'stepWood':
        this._playBuffer(this.buffers.stepWood, { gain: 0.45 * (opts.gain || 1), rate: 0.8 + Math.random() * 0.3, filter: { freq: 700 } });
        this._tone({ type: 'triangle', freq: 90 + Math.random() * 40, freqEnd: 60, dur: 0.12, gain: 0.12 });
        break;
      case 'stepStone':
        this._playBuffer(this.buffers.step, { gain: 0.4 * (opts.gain || 1), rate: 1.4 + Math.random() * 0.3, filter: { freq: 2500 } });
        break;
      case 'jump':
        this._playBuffer(this.buffers.whoosh, { gain: 0.25, rate: 1.8, filter: { freq: 600 } });
        break;
      case 'land':
        this._playBuffer(this.buffers.step, { gain: 0.6, rate: 0.7, filter: { freq: 500 } });
        break;
      case 'hurt':
        this._playBuffer(this.buffers.flesh, { gain: 0.9, rate: 0.7, filter: { freq: 900 } });
        this._tone({ type: 'sawtooth', freq: 140, freqEnd: 60, dur: 0.35, gain: 0.35, filterFreq: 500 });
        break;
      case 'heartbeat':
        this._tone({ type: 'sine', freq: 55, freqEnd: 35, dur: 0.18, gain: 0.7 });
        this._tone({ type: 'sine', freq: 50, freqEnd: 30, dur: 0.15, gain: 0.5, delay: 0.22 });
        break;
      case 'pickup':
        this._tone({ type: 'triangle', freq: 520, dur: 0.1, gain: 0.25 });
        this._tone({ type: 'triangle', freq: 780, dur: 0.18, gain: 0.25, delay: 0.09 });
        break;
      case 'doorCreak':
        this._tone({ type: 'sawtooth', freq: 180 + Math.random() * 60, freqEnd: 260, dur: 0.9, gain: 0.15, pos, attack: 0.1, filterFreq: 900 });
        this._playBuffer(this.buffers.step, { gain: 0.4, rate: 0.5, pos, filter: { freq: 400 } });
        break;
      case 'upgrade':
        [440, 554, 659, 880].forEach((f, i) => this._tone({ type: 'triangle', freq: f, dur: 0.25, gain: 0.2, delay: i * 0.07 }));
        break;
      case 'flashlight':
        this._playBuffer(this.buffers.click, { gain: 0.5, rate: 1.5 });
        break;
      case 'ui':
        this._playBuffer(this.buffers.click, { gain: 0.3, rate: 1.2, filter: { freq: 2000 } });
        break;

      // ------------------------------------------------------- waves
      case 'waveStart':
        this._tone({ type: 'sine', freq: 110, freqEnd: 55, dur: 2.2, gain: 0.6, attack: 0.05 });
        this._tone({ type: 'triangle', freq: 220, dur: 2.5, gain: 0.2, attack: 0.3, detune: 8 });
        this._playBuffer(this.buffers.rumble, { gain: 1.0, rate: 0.7, filter: { freq: 300 } });
        this._bell(392, 0.2, 2.5); this._bell(311, 0.9, 2.5);
        break;
      case 'waveClear':
        this._bell(523, 0, 1.6); this._bell(659, 0.25, 1.6); this._bell(784, 0.5, 2.2);
        break;
      case 'bossSpawn':
        this._playBuffer(this.buffers.rumble, { gain: 1.4, rate: 0.5, filter: { freq: 220 } });
        this._tone({ type: 'sawtooth', freq: 60, freqEnd: 30, dur: 3, gain: 0.5, attack: 0.5, filterFreq: 300 });
        this._bell(196, 0.4, 3.5); this._bell(185, 1.6, 3.5);
        break;
      case 'bossDead':
        this._playBuffer(this.buffers.rumble, { gain: 1.2, rate: 0.6, filter: { freq: 300 } });
        [261, 329, 392, 523, 659].forEach((f, i) => this._bell(f, 0.35 + i * 0.22, 3));
        break;

      // ------------------------------------------------------- enemies (positional)
      case 'vampireHiss':
        this._playBuffer(this.buffers.white, { gain: 0.35, rate: 1.0, pos, filter: { type: 'bandpass', freq: 2800 + Math.random() * 800 }, q: 2, dur: 0.6 });
        this._tone({ type: 'sawtooth', freq: 300, freqEnd: 180, dur: 0.5, gain: 0.12, pos, filterFreq: 1200 });
        break;
      case 'vampireAttack':
        this._playBuffer(this.buffers.whoosh, { gain: 0.6, rate: 1.4, pos, filter: { freq: 1500 } });
        this._tone({ type: 'sawtooth', freq: 420, freqEnd: 150, dur: 0.3, gain: 0.2, pos });
        break;
      case 'werewolfGrowl':
        this._tone({ type: 'sawtooth', freq: 70 + Math.random() * 20, freqEnd: 55, dur: 1.1, gain: 0.45, pos, attack: 0.15, filterFreq: 400 });
        this._tone({ type: 'square', freq: 95, freqEnd: 70, dur: 1.0, gain: 0.15, pos, attack: 0.2, filterFreq: 350, detune: 15 });
        break;
      case 'werewolfRoar':
        this._tone({ type: 'sawtooth', freq: 110, freqEnd: 160, dur: 0.9, gain: 0.55, pos, attack: 0.08, filterFreq: 900 });
        this._tone({ type: 'sawtooth', freq: 165, freqEnd: 210, dur: 0.8, gain: 0.3, pos, attack: 0.1, filterFreq: 1200, detune: -20 });
        this._playBuffer(this.buffers.shotBig, { gain: 0.5, rate: 0.5, pos, filter: { freq: 900 } });
        break;
      case 'werewolfAttack':
        this._playBuffer(this.buffers.whoosh, { gain: 0.9, rate: 0.9, pos, filter: { freq: 1000 } });
        this._tone({ type: 'sawtooth', freq: 140, freqEnd: 90, dur: 0.35, gain: 0.4, pos, filterFreq: 700 });
        break;
      case 'ghostMoan':
        this._tone({ type: 'sine', freq: 180 + Math.random() * 80, freqEnd: 120, dur: 2.2, gain: 0.3, pos, attack: 0.6, detune: 10 });
        this._tone({ type: 'sine', freq: 270 + Math.random() * 60, freqEnd: 190, dur: 2.0, gain: 0.15, pos, attack: 0.8, detune: -12 });
        break;
      case 'ghostAttack':
        this._tone({ type: 'sine', freq: 900, freqEnd: 300, dur: 0.5, gain: 0.3, pos });
        this._playBuffer(this.buffers.white, { gain: 0.3, pos, filter: { type: 'highpass', freq: 3000 }, dur: 0.4 });
        break;
      case 'teleport':
        this._tone({ type: 'sine', freq: 400, freqEnd: 1600, dur: 0.35, gain: 0.2, pos });
        this._playBuffer(this.buffers.white, { gain: 0.25, pos, filter: { type: 'bandpass', freq: 1800 }, q: 3, dur: 0.35 });
        break;
      case 'bossRoar':
        this._tone({ type: 'sawtooth', freq: 55, freqEnd: 90, dur: 1.6, gain: 0.8, pos, attack: 0.1, filterFreq: 600 });
        this._tone({ type: 'square', freq: 82, freqEnd: 120, dur: 1.5, gain: 0.3, pos, attack: 0.15, filterFreq: 500, detune: 25 });
        this._playBuffer(this.buffers.rumble, { gain: 1.0, rate: 0.6, pos, filter: { freq: 400 } });
        break;
      case 'enemyDeath':
        this._playBuffer(this.buffers.flesh, { gain: 0.8, rate: 0.6, pos, filter: { freq: 800 } });
        this._tone({ type: 'sawtooth', freq: 200, freqEnd: 40, dur: 0.7, gain: 0.3, pos, filterFreq: 600 });
        break;
      case 'ghostDeath':
        this._tone({ type: 'sine', freq: 500, freqEnd: 60, dur: 1.4, gain: 0.35, pos, attack: 0.05 });
        this._playBuffer(this.buffers.white, { gain: 0.3, pos, filter: { type: 'bandpass', freq: 1200 }, q: 2, dur: 1.2 });
        break;
      case 'stagger':
        this._tone({ type: 'sawtooth', freq: 250, freqEnd: 120, dur: 0.2, gain: 0.2, pos, filterFreq: 900 });
        break;

      // ------------------------------------------------------- ambience one-shots
      case 'howl':
        this._tone({ type: 'sine', freq: 300, freqEnd: 520, dur: 1.4, gain: 0.22, pos, attack: 0.4, release: 1.2 });
        this._tone({ type: 'triangle', freq: 302, freqEnd: 525, dur: 1.4, gain: 0.08, pos, attack: 0.5, release: 1.2, detune: 7 });
        break;
      case 'bats':
        for (let i = 0; i < 9; i++) this._playBuffer(this.buffers.click, { gain: 0.25, rate: 2.5 + Math.random(), pos, filter: { type: 'highpass', freq: 4000 } });
        for (let i = 0; i < 6; i++) this._tone({ type: 'sine', freq: 3200 + Math.random() * 1500, freqEnd: 2500, dur: 0.05, gain: 0.08, pos, delay: i * 0.09 });
        break;
      case 'whisper':
        for (let i = 0; i < 5; i++) {
          this._playBuffer(this.buffers.white, { gain: 0.09 + Math.random() * 0.06, rate: 0.8 + Math.random() * 0.5, pos, filter: { type: 'bandpass', freq: 1600 + Math.random() * 1400 }, q: 6, dur: 0.25 + Math.random() * 0.3 });
        }
        break;
      case 'creak':
        this._tone({ type: 'sawtooth', freq: 140 + Math.random() * 90, freqEnd: 120, dur: 0.5, gain: 0.08, pos, attack: 0.15, filterFreq: 700 });
        break;
      case 'scare':
        this._playBuffer(this.buffers.white, { gain: 0.9, rate: 1, filter: { type: 'bandpass', freq: 2200 }, q: 1.2, dur: 0.6 });
        this._tone({ type: 'sawtooth', freq: 900, freqEnd: 1800, dur: 0.5, gain: 0.35 });
        this._tone({ type: 'square', freq: 60, freqEnd: 30, dur: 0.8, gain: 0.5, filterFreq: 300 });
        break;
      case 'thunder':
        this._playBuffer(this.buffers.rumble, { gain: 1.3, rate: 0.45 + Math.random() * 0.2, filter: { freq: 250 } });
        break;
      default:
        break;
    }
  }

  _bell(freq, delay, dur) {
    this._tone({ type: 'sine', freq, dur, gain: 0.3, attack: 0.005, delay });
    this._tone({ type: 'sine', freq: freq * 2.01, dur: dur * 0.6, gain: 0.1, attack: 0.005, delay });
    this._tone({ type: 'sine', freq: freq * 2.98, dur: dur * 0.3, gain: 0.05, attack: 0.005, delay });
  }

  // ---------------------------------------------------------------- ambience loops
  startAmbience() {
    if (!this.unlocked || this.ambientNodes.length) return;
    const ctx = this.ctx;
    // Wind
    const wind = ctx.createBufferSource(); wind.buffer = this.buffers.wind; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 400; wf.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0.35;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain(); lfoG.gain.value = 220;
    lfo.connect(lfoG); lfoG.connect(wf.frequency);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.17;
    const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.15;
    lfo2.connect(lfo2G); lfo2G.connect(wg.gain);
    wind.connect(wf); wf.connect(wg); wg.connect(this.ambient);
    wind.start(); lfo.start(); lfo2.start();
    this.ambientNodes.push(wind, lfo, lfo2);
    // Music drone pad
    const padFreqs = [55, 82.4, 110, 164.8];
    padFreqs.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 260;
      const g = ctx.createGain(); g.gain.value = 0.045;
      const l = ctx.createOscillator(); l.frequency.value = 0.05 + i * 0.013;
      const lg = ctx.createGain(); lg.gain.value = 0.03;
      l.connect(lg); lg.connect(g.gain);
      o.connect(fl); fl.connect(g); g.connect(this.music);
      o.start(); l.start();
      this.musicNodes.push(o, l);
    });
    // Sparse high eerie tone
    const hi = ctx.createOscillator(); hi.type = 'sine'; hi.frequency.value = 1318;
    const hg = ctx.createGain(); hg.gain.value = 0.0;
    const hl = ctx.createOscillator(); hl.frequency.value = 0.031;
    const hlg = ctx.createGain(); hlg.gain.value = 0.012;
    hl.connect(hlg); hlg.connect(hg.gain);
    hi.connect(hg); hg.connect(this.music); hi.start(); hl.start();
    this.musicNodes.push(hi, hl);
  }

  stopAmbience() {
    for (const n of [...this.ambientNodes, ...this.musicNodes]) { try { n.stop(); } catch (e) { /* */ } }
    this.ambientNodes = []; this.musicNodes = [];
  }

  /** Called every frame by the game while playing: random distant ambience. */
  updateAmbience(dt, playerPos, zone) {
    if (!this.unlocked) return;
    const T = this._ambientTimers;
    for (const k in T) T[k] -= dt;
    const far = (r) => { const a = Math.random() * Math.PI * 2; return new THREE.Vector3(playerPos.x + Math.cos(a) * r, playerPos.y + 2, playerPos.z + Math.sin(a) * r); };
    if (T.howl <= 0) { T.howl = 18 + Math.random() * 30; this.play('howl', { pos: far(50 + Math.random() * 40) }); }
    if (T.bats <= 0) { T.bats = 20 + Math.random() * 30; this.play('bats', { pos: far(8 + Math.random() * 12) }); }
    if (T.whisper <= 0) { T.whisper = 14 + Math.random() * 30; this.play('whisper', { pos: far(3 + Math.random() * 4) }); }
    if (T.creak <= 0) { T.creak = 5 + Math.random() * 12; if (zone === 'mansion') this.play('creak', { pos: far(3 + Math.random() * 6) }); }
  }

  setMusicIntensity(v) {
    if (!this.unlocked) return;
    const target = this.settings.get('music') * (0.4 + 0.6 * v);
    this.music.gain.setTargetAtTime(target, this._now(), 1.5);
  }
}
