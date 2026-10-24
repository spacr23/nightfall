import * as THREE from 'three';

/** Procedural canvas textures + shared materials. Everything is generated at runtime. */

function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function makeTexture(size, painter, { repeat = [1, 1], anisotropy = 2, seed = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  painter(ctx, size, rnd(seed));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function grain(ctx, size, r, amount, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(r() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
}

function stains(ctx, size, r, n, color, maxR) {
  for (let i = 0; i < n; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * (0.3 + r() * 0.7));
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(r() * size, r() * size); ctx.fillStyle = g; ctx.fillRect(-maxR, -maxR, maxR * 2, maxR * 2); ctx.restore();
  }
}

const painters = {
  stone(ctx, s, r) {
    ctx.fillStyle = '#4a4c52'; ctx.fillRect(0, 0, s, s);
    const rows = 8, h = s / rows;
    for (let y = 0; y < rows; y++) {
      let x = (y % 2) * -30;
      while (x < s) {
        const w = 40 + r() * 70;
        const v = 60 + r() * 40;
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 8})`;
        ctx.fillRect(x + 2, y * h + 2, w - 4, h - 4);
        x += w;
      }
    }
    grain(ctx, s, r, 6000, 0.1);
    stains(ctx, s, r, 12, 'rgba(20,30,20,0.35)', 60);
  },
  brick(ctx, s, r) {
    ctx.fillStyle = '#2b2522'; ctx.fillRect(0, 0, s, s);
    const rows = 12, h = s / rows, w = s / 4;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * w / 2;
      for (let x = -1; x < 5; x++) {
        const v = 70 + r() * 35;
        ctx.fillStyle = `rgb(${v + 20},${v - 10},${v - 20})`;
        ctx.fillRect(x * w + off + 2, y * h + 2, w - 4, h - 4);
      }
    }
    grain(ctx, s, r, 5000, 0.12);
    stains(ctx, s, r, 10, 'rgba(0,0,0,0.4)', 70);
  },
  planks(ctx, s, r) {
    const n = 6, w = s / n;
    for (let i = 0; i < n; i++) {
      const v = 55 + r() * 30;
      ctx.fillStyle = `rgb(${v + 18},${v + 4},${v - 10})`;
      ctx.fillRect(i * w, 0, w - 2, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(i * w, 0, w - 2, s);
      for (let k = 0; k < 24; k++) { ctx.strokeStyle = `rgba(0,0,0,${0.08 + r() * 0.1})`; ctx.lineWidth = 1; ctx.beginPath(); const x = i * w + r() * w; ctx.moveTo(x, 0); ctx.lineTo(x + (r() - 0.5) * 10, s); ctx.stroke(); }
    }
    grain(ctx, s, r, 3000, 0.08);
    stains(ctx, s, r, 6, 'rgba(0,0,0,0.5)', 50);
  },
  darkwood(ctx, s, r) {
    ctx.fillStyle = '#2a1d14'; ctx.fillRect(0, 0, s, s);
    for (let k = 0; k < 90; k++) { ctx.strokeStyle = `rgba(${10 + r() * 30},${5 + r() * 15},0,${0.25})`; ctx.lineWidth = 1 + r() * 2; ctx.beginPath(); const x = r() * s; ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 10, s / 3, x - 10, s * 2 / 3, x, s); ctx.stroke(); }
    grain(ctx, s, r, 2000, 0.06);
  },
  ground(ctx, s, r) {
    ctx.fillStyle = '#2a3122'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) {
      const g = 30 + r() * 40;
      ctx.fillStyle = `rgba(${g * 0.7},${g},${g * 0.5},0.6)`;
      ctx.fillRect(r() * s, r() * s, 2 + r() * 5, 1 + r() * 3);
    }
    stains(ctx, s, r, 18, 'rgba(40,30,20,0.5)', 60);
    stains(ctx, s, r, 10, 'rgba(0,0,0,0.5)', 50);
    grain(ctx, s, r, 4000, 0.1);
  },
  dirt(ctx, s, r) {
    ctx.fillStyle = '#2a231b'; ctx.fillRect(0, 0, s, s);
    stains(ctx, s, r, 30, 'rgba(60,50,35,0.5)', 50);
    stains(ctx, s, r, 20, 'rgba(10,8,5,0.6)', 40);
    grain(ctx, s, r, 6000, 0.12);
  },
  bark(ctx, s, r) {
    ctx.fillStyle = '#2a241e'; ctx.fillRect(0, 0, s, s);
    for (let k = 0; k < 60; k++) { const v = 25 + r() * 40; ctx.strokeStyle = `rgba(${v + 10},${v},${v - 8},0.8)`; ctx.lineWidth = 2 + r() * 6; ctx.beginPath(); const x = r() * s; ctx.moveTo(x, 0); ctx.bezierCurveTo(x + (r() - 0.5) * 30, s / 3, x + (r() - 0.5) * 30, s * 2 / 3, x, s); ctx.stroke(); }
    grain(ctx, s, r, 3000, 0.1);
  },
  roof(ctx, s, r) {
    ctx.fillStyle = '#1d1c20'; ctx.fillRect(0, 0, s, s);
    const rows = 10, h = s / rows, w = s / 6;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * w / 2;
      for (let x = -1; x < 7; x++) {
        const v = 35 + r() * 25;
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 8})`;
        ctx.beginPath(); ctx.roundRect(x * w + off + 1, y * h + 1, w - 2, h - 2, [0, 0, 6, 6]); ctx.fill();
      }
    }
    grain(ctx, s, r, 3000, 0.1);
    stains(ctx, s, r, 10, 'rgba(30,50,30,0.3)', 50);
  },
  wallpaper(ctx, s, r) {
    ctx.fillStyle = '#3a3230'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(90,70,60,0.35)';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const cx = x * s / 8 + s / 16, cy = y * s / 8 + s / 16;
      ctx.beginPath(); ctx.ellipse(cx, cy, 8, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 16; i++) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, r() * s, s, 1); }
    stains(ctx, s, r, 14, 'rgba(10,8,5,0.6)', 80);
    stains(ctx, s, r, 4, 'rgba(60,10,5,0.35)', 60);
    grain(ctx, s, r, 2500, 0.08);
  },
  plaster(ctx, s, r) {
    ctx.fillStyle = '#4b4842'; ctx.fillRect(0, 0, s, s);
    stains(ctx, s, r, 20, 'rgba(0,0,0,0.35)', 90);
    stains(ctx, s, r, 6, 'rgba(70,60,40,0.4)', 60);
    grain(ctx, s, r, 6000, 0.1);
    // cracks
    for (let i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); let x = r() * s, y = r() * s; ctx.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 30; y += r() * 25; ctx.lineTo(x, y); } ctx.stroke(); }
  },
  carpet(ctx, s, r) {
    ctx.fillStyle = '#3a1416'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(120,90,50,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(14, 14, s - 28, s - 28);
    ctx.strokeStyle = 'rgba(120,90,50,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(30, 30, s - 60, s - 60);
    grain(ctx, s, r, 6000, 0.12);
    stains(ctx, s, r, 6, 'rgba(0,0,0,0.5)', 70);
  },
  marble(ctx, s, r) {
    ctx.fillStyle = '#6a6c70'; ctx.fillRect(0, 0, s, s);
    for (let k = 0; k < 20; k++) { ctx.strokeStyle = `rgba(${40 + r() * 40},${40 + r() * 40},${50 + r() * 40},0.5)`; ctx.lineWidth = 1 + r() * 2; ctx.beginPath(); let x = r() * s, y = 0; ctx.moveTo(x, y); for (let i = 0; i < 6; i++) { x += (r() - 0.5) * 60; y += s / 6; ctx.lineTo(x, y); } ctx.stroke(); }
    grain(ctx, s, r, 3000, 0.06);
    stains(ctx, s, r, 8, 'rgba(20,30,20,0.3)', 50);
  },
  metal(ctx, s, r) {
    ctx.fillStyle = '#23252a'; ctx.fillRect(0, 0, s, s);
    stains(ctx, s, r, 20, 'rgba(90,50,30,0.45)', 40);
    grain(ctx, s, r, 5000, 0.12);
  },
  blood(ctx, s, r) {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * (0.15 + r() * 0.3));
      g.addColorStop(0, 'rgba(70,5,5,0.9)'); g.addColorStop(0.7, 'rgba(50,3,3,0.6)'); g.addColorStop(1, 'rgba(40,0,0,0)');
      ctx.save(); ctx.translate((r() - 0.5) * s * 0.5, (r() - 0.5) * s * 0.5); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); ctx.restore();
    }
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(60,4,4,0.85)'; ctx.beginPath(); ctx.arc(s / 2 + (r() - 0.5) * s * 0.8, s / 2 + (r() - 0.5) * s * 0.8, 1 + r() * 5, 0, Math.PI * 2); ctx.fill(); }
  },
  painting(ctx, s, r) {
    const hue = r() * 60 + 10;
    ctx.fillStyle = `hsl(${hue},25%,12%)`; ctx.fillRect(0, 0, s, s);
    // ominous landscape / portrait
    const g = ctx.createRadialGradient(s / 2, s * 0.4, 10, s / 2, s * 0.4, s * 0.6);
    g.addColorStop(0, `hsl(${hue + 20},30%,30%)`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath(); ctx.ellipse(s / 2, s * 0.42, s * 0.13, s * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(s * 0.28, s * 0.58, s * 0.44, s * 0.5, 30); ctx.fill();
    ctx.fillStyle = 'rgba(180,170,150,0.25)';
    ctx.beginPath(); ctx.ellipse(s / 2, s * 0.42, s * 0.1, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.beginPath(); ctx.arc(s * 0.46, s * 0.4, 5, 0, Math.PI * 2); ctx.arc(s * 0.54, s * 0.4, 5, 0, Math.PI * 2); ctx.fill();
    grain(ctx, s, r, 4000, 0.15);
    stains(ctx, s, r, 6, 'rgba(0,0,0,0.6)', 80);
    ctx.strokeStyle = '#5a4520'; ctx.lineWidth = 18; ctx.strokeRect(0, 0, s, s);
  },
  glass(ctx, s, r) {
    ctx.fillStyle = 'rgba(40,60,80,0.35)'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(220,230,255,0.7)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) { ctx.beginPath(); let x = s / 2, y = s / 2; ctx.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 80; y += (r() - 0.5) * 80; ctx.lineTo(x, y); } ctx.stroke(); }
    grain(ctx, s, r, 1500, 0.08);
  },
  moon(ctx, s, r) {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s * 0.5);
    g.addColorStop(0, 'rgba(235,240,255,1)'); g.addColorStop(0.55, 'rgba(200,210,235,0.95)'); g.addColorStop(0.62, 'rgba(160,180,220,0.25)'); g.addColorStop(1, 'rgba(120,140,200,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(150,160,190,0.25)'; ctx.beginPath(); const a = r() * Math.PI * 2, d = r() * s * 0.22; ctx.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, 3 + r() * 9, 0, Math.PI * 2); ctx.fill(); }
  },
  symbol(ctx, s, r) {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(120,10,10,0.9)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); const x = s / 2 + Math.cos(a) * s * 0.4, y = s / 2 + Math.sin(a) * s * 0.4; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath(); ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(s / 2 + Math.cos(a) * s * 0.44, s / 2 + Math.sin(a) * s * 0.44); ctx.lineTo(s / 2 + Math.cos(a) * s * 0.48, s / 2 + Math.sin(a) * s * 0.48); ctx.stroke(); }
  },
  paper(ctx, s, r) {
    ctx.fillStyle = '#c9bb95'; ctx.fillRect(0, 0, s, s);
    stains(ctx, s, r, 12, 'rgba(90,60,20,0.3)', 50);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(40,30,20,0.7)'; ctx.fillRect(s * 0.15, s * 0.15 + i * 14, s * (0.4 + r() * 0.3), 2); }
  },
};

export class Materials {
  constructor(quality) {
    const an = quality.anisotropy;
    const T = (name, repeat, seed = 1, size = 256) => makeTexture(size, painters[name], { repeat, anisotropy: an, seed });
    this.tex = {
      stone: T('stone', [2, 2], 3), brick: T('brick', [2, 2], 5), planks: T('planks', [2, 2], 7), darkwood: T('darkwood', [1, 1], 9),
      ground: T('ground', [40, 40], 11, 512), dirt: T('dirt', [6, 6], 13), bark: T('bark', [1, 2], 15), roof: T('roof', [4, 4], 17),
      wallpaper: T('wallpaper', [2, 1], 19), plaster: T('plaster', [2, 2], 21), carpet: T('carpet', [1, 1], 23), marble: T('marble', [2, 2], 25),
      metal: T('metal', [1, 1], 27), blood: T('blood', [1, 1], 29), glass: T('glass', [1, 1], 31), moon: T('moon', [1, 1], 33),
      symbol: T('symbol', [1, 1], 35), paper: T('paper', [1, 1], 37, 128),
      painting1: T('painting', [1, 1], 101), painting2: T('painting', [1, 1], 202), painting3: T('painting', [1, 1], 303),
    };
    const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0.05, ...extra });
    this.m = {
      stone: std(this.tex.stone, { color: 0x9a9ca3 }),
      stoneDark: std(this.tex.stone, { color: 0x5a5c63 }),
      brick: std(this.tex.brick, { color: 0x8a7a72 }),
      planks: std(this.tex.planks, { color: 0x9c8c7a, roughness: 0.85 }),
      darkwood: std(this.tex.darkwood, { color: 0x8a7868, roughness: 0.7 }),
      ground: std(this.tex.ground, { color: 0xb4c0a4, roughness: 1 }),
      dirt: std(this.tex.dirt, { color: 0xb0a490, roughness: 1 }),
      bark: std(this.tex.bark, { color: 0x6e6256, roughness: 1 }),
      leaves: new THREE.MeshStandardMaterial({ color: 0x1a2a1c, roughness: 1, flatShading: true }),
      roof: std(this.tex.roof, { color: 0x6a6c74 }),
      wallpaper: std(this.tex.wallpaper, { color: 0x9a8f88 }),
      plaster: std(this.tex.plaster, { color: 0x9a968e }),
      carpet: std(this.tex.carpet, { color: 0xa08a80, roughness: 1 }),
      marble: std(this.tex.marble, { color: 0xbfc2c8, roughness: 0.4, metalness: 0.1 }),
      metal: std(this.tex.metal, { color: 0x6f737a, roughness: 0.6, metalness: 0.7 }),
      ironDark: new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5, metalness: 0.8 }),
      blood: new THREE.MeshStandardMaterial({ map: this.tex.blood, transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      glass: new THREE.MeshStandardMaterial({ map: this.tex.glass, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }),
      candle: new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.6 }),
      flame: new THREE.MeshBasicMaterial({ color: 0xffb060 }),
      lampGlow: new THREE.MeshBasicMaterial({ color: 0xffd090 }),
      bone: new THREE.MeshStandardMaterial({ color: 0xcfc6b0, roughness: 0.9 }),
      cloth: new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }),
      clothDark: new THREE.MeshStandardMaterial({ color: 0x1e1a1c, roughness: 1 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 1, flatShading: true }),
      bush: new THREE.MeshStandardMaterial({ color: 0x15231a, roughness: 1, flatShading: true }),
      grass: new THREE.MeshStandardMaterial({ color: 0x24301f, roughness: 1, side: THREE.DoubleSide }),
      symbol: new THREE.MeshBasicMaterial({ map: this.tex.symbol, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      paper: new THREE.MeshStandardMaterial({ map: this.tex.paper, roughness: 1, side: THREE.DoubleSide }),
      moon: new THREE.MeshBasicMaterial({ map: this.tex.moon, transparent: true, depthWrite: false, fog: false }),
      fogPlane: new THREE.MeshBasicMaterial({ color: 0x7f8ea8, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }),
      paintings: [std(this.tex.painting1, { roughness: 0.8 }), std(this.tex.painting2, { roughness: 0.8 }), std(this.tex.painting3, { roughness: 0.8 })],
      invisible: new THREE.MeshBasicMaterial({ visible: false }),
    };
    // The canvas textures are painted dark; lift albedo so moonlight reads without killing the mood.
    const lift = (m, k) => { if (m && m.isMeshStandardMaterial && m.map) m.color.multiplyScalar(k); };
    for (const k in this.m) { const v = this.m[k]; if (Array.isArray(v)) v.forEach((x) => lift(x, 1.6)); else lift(v, 2.0); }
    this.m.ground.color.multiplyScalar(1.5);
    this.m.dirt.color.multiplyScalar(1.2);
    this.m.leaves.color.multiplyScalar(1.6);
    this.m.bush.color.multiplyScalar(1.6);
    this.m.rock.color.multiplyScalar(1.4);
  }
}

/** Shared geometries used across the world. */
export const Geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 12, 10),
  sphereLow: new THREE.SphereGeometry(0.5, 7, 6),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  plane: new THREE.PlaneGeometry(1, 1),
  dodeca: new THREE.DodecahedronGeometry(0.5, 0),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
};
