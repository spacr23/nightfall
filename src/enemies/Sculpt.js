import * as THREE from 'three';

/**
 * Helpers for organic, procedurally sculpted creature parts:
 * deformable spheres (heads, muscles), lathe bodies (torsos, limbs), tapered limbs,
 * and canvas textures for skin, fur, cloth and fur cards. Geometries are cached and shared.
 */
const cache = new Map();
export function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export { smooth };

/** Sphere of radius 0.5 whose vertices are reshaped by fn(v: Vector3 on unit-ish sphere) -> mutates v. */
export function sculptSphere(wSeg, hSeg, fn) {
  const g = new THREE.SphereGeometry(0.5, wSeg, hSeg);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  return g;
}

/** Lathe from a radius profile [[r, y], ...] (y ascending). */
export function lathe(profile, seg = 16) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y));
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

/** Tapered limb hanging down from the origin: length L, radii r0 (top) -> r1 (bottom) with a muscle bulge. */
export function limb(L, r0, r1, bulge = 0.15, seg = 10) {
  const prof = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = r0 + (r1 - r0) * t + Math.sin(t * Math.PI) * bulge * r0;
    prof.push([r * (i === 0 || i === n ? 0.75 : 1), -t * L]);
  }
  prof.reverse();
  return lathe(prof, seg);
}

function canvasTex(size, paint, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  paint(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const rnd = (() => { let s = 1337; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

/** Pale undead skin with mottling and faint blue-violet veins. Sphere UV: face centre at u=0.25. */
export function skinTexture(base = '#d9d6d3', vein = 'rgba(70,60,120,0.18)', face = true) {
  return cached(`skin${base}${vein}${face}`, () => canvasTex(256, (ctx, s) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { const v = rnd(); ctx.fillStyle = `rgba(${v < 0.5 ? '120,100,110' : '255,255,255'},${0.04 + rnd() * 0.05})`; ctx.beginPath(); ctx.arc(rnd() * s, rnd() * s, 2 + rnd() * 10, 0, 7); ctx.fill(); }
    ctx.strokeStyle = vein; ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      ctx.lineWidth = 0.4 + rnd() * 0.6; ctx.beginPath();
      let x = rnd() * s, y = rnd() * s; ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 18; y += 4 + rnd() * 10; ctx.quadraticCurveTo(x + (rnd() - 0.5) * 10, y - 4, x, y); }
      ctx.stroke();
    }
    if (face) {
      // dark, bruised eye sockets and sunken cheeks around the face (u=0.25)
      const eye = (u, v, r, col) => { const g = ctx.createRadialGradient(u * s, v * s, 0, u * s, v * s, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); };
      eye(0.215, 0.43, 22, 'rgba(60,20,40,0.75)'); eye(0.285, 0.43, 22, 'rgba(60,20,40,0.75)');
      eye(0.2, 0.56, 26, 'rgba(70,60,80,0.35)'); eye(0.3, 0.56, 26, 'rgba(70,60,80,0.35)');
      eye(0.25, 0.66, 12, 'rgba(90,10,15,0.6)'); // lips
    }
  }));
}

export function furTexture(dark = '#2b231d', light = '#6b5a48') {
  return cached(`fur${dark}${light}`, () => canvasTex(256, (ctx, s) => {
    ctx.fillStyle = dark; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 3800; i++) {
      const x = rnd() * s, y = rnd() * s, l = 8 + rnd() * 18, a = Math.PI / 2 + (rnd() - 0.5) * 0.5;
      ctx.strokeStyle = rnd() < 0.5 ? light : dark; ctx.globalAlpha = 0.18 + rnd() * 0.35; ctx.lineWidth = 0.8 + rnd() * 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [2, 2]));
}

/** Alpha-tested strand card used to fake shaggy fur silhouettes. */
export function furCardTexture(col = '#3a2f26') {
  return cached(`card${col}`, () => {
    const t = canvasTex(128, (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      for (let i = 0; i < 34; i++) {
        const x0 = s * 0.2 + rnd() * s * 0.6, len = s * (0.45 + rnd() * 0.55);
        ctx.strokeStyle = col; ctx.globalAlpha = 0.7 + rnd() * 0.3; ctx.lineWidth = 1.5 + rnd() * 2.5;
        // strands converge toward a pointed tip, like a clump of fur
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.quadraticCurveTo(x0 + (s / 2 - x0) * 0.3, len * 0.5, s / 2 + (x0 - s / 2) * 0.25, len); ctx.stroke();
      }
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

export function clothTexture(base = '#121016', thread = 'rgba(255,255,255,0.05)') {
  return cached(`cloth${base}${thread}`, () => canvasTex(128, (ctx, s) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = thread; ctx.lineWidth = 1;
    for (let i = 0; i < s; i += 3) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke(); }
    for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`; ctx.fillRect(rnd() * s, rnd() * s, 8 + rnd() * 30, 2 + rnd() * 8); }
  }, [3, 3]));
}

/** Ragged edge alpha for robes and capes (opaque top, torn bottom). */
export function tatterTexture() {
  return cached('tatter', () => {
    const t = canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, s, s);
      ctx.globalCompositeOperation = 'destination-out';
      // torn hem: long tapering triangular rips
      ctx.beginPath(); ctx.moveTo(0, s);
      for (let x = 0; x <= s; x += 6 + rnd() * 10) {
        const depth = s * (0.08 + rnd() * 0.32 * (0.6 + 0.4 * Math.sin(x * 0.05)));
        ctx.lineTo(x, s - depth); ctx.lineTo(x + 3 + rnd() * 5, s - depth * 0.15);
      }
      ctx.lineTo(s, s); ctx.closePath(); ctx.fill();
      // a few frayed tears higher up
      for (let i = 0; i < 10; i++) { const x = rnd() * s, y = s * (0.55 + rnd() * 0.3); ctx.beginPath(); ctx.ellipse(x, y, 1.5 + rnd() * 2, 6 + rnd() * 12, 0, 0, 7); ctx.fill(); }
    });
    t.colorSpace = THREE.NoColorSpace;
    return t;
  });
}

/** Add a fresnel rim glow to a standard material (ghostly edges). */
export function addRim(mat, color, power = 2.0, strength = 1.0) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.rimColor = { value: new THREE.Color(color) };
    sh.uniforms.rimPower = { value: power };
    sh.uniforms.rimStrength = { value: strength };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor; uniform float rimPower; uniform float rimStrength;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), rimPower);\ntotalEmissiveRadiance += rimColor * rim * rimStrength;');
  };
  mat.customProgramCacheKey = () => `rim${color}${power}${strength}`;
  return mat;
}
