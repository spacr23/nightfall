const KEY = 'nightfall.settings.v1';

const DEFAULTS = {
  master: 0.8,
  sfx: 0.9,
  music: 0.6,
  sensitivity: 1.0,
  fov: 80,
  quality: 'medium',
  invertY: false,
  headBob: true,
};

export const QUALITY_PRESETS = {
  low: { pixelRatio: 0.75, shadows: false, shadowMapSize: 512, fogDensity: 0.028, grass: 0, maxLights: 4, anisotropy: 1, particles: 0.5 },
  medium: { pixelRatio: 1.0, shadows: true, shadowMapSize: 1024, fogDensity: 0.022, grass: 1, maxLights: 8, anisotropy: 2, particles: 1 },
  high: { pixelRatio: Math.min(window.devicePixelRatio || 1, 2), shadows: true, shadowMapSize: 2048, fogDensity: 0.018, grass: 2, maxLights: 12, anisotropy: 4, particles: 1.5 },
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch (e) { /* ignore */ }
  }

  get(k) { return this.values[k]; }

  set(k, v) {
    this.values[k] = v;
    this.save();
    for (const l of this.listeners) l(k, v, this.values);
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  get quality() { return QUALITY_PRESETS[this.values.quality] || QUALITY_PRESETS.medium; }
}
