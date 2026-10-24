import * as THREE from 'three';

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export const prim = {
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  sphereLow: new THREE.SphereGeometry(0.5, 8, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  box: new THREE.BoxGeometry(1, 1, 1),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
};

/** Add a mesh. opts: s (scale [x,y,z] or number), p (pos), r (rot), shadow (bool). */
export function mesh(geo, mat, parent, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  const s = opts.s ?? 1;
  if (Array.isArray(s)) m.scale.set(...s); else m.scale.setScalar(s);
  if (opts.p) m.position.set(...opts.p);
  if (opts.r) m.rotation.set(...opts.r);
  m.castShadow = opts.shadow ?? true;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

export function group(parent, p = [0, 0, 0], r) {
  const g = new THREE.Group();
  g.position.set(...p);
  if (r) g.rotation.set(...r);
  parent.add(g);
  return g;
}

/** Glowing eyes: iris spheres + additive glow sprites (fog-free so they pierce the darkness). */
export function glowingEyes(head, color, spread, y, z, size, slant = 0) {
  const mat = new THREE.MeshBasicMaterial({ color, fog: false });
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, fog: false });
  const out = [];
  for (const sd of [-1, 1]) {
    const e = mesh(prim.sphereLow, mat, head, { s: [size, size * 0.6, size * 0.5], p: [sd * spread, y, z], r: [0, 0, sd * slant], shadow: false });
    const sp = new THREE.Sprite(glowMat); sp.scale.setScalar(size * 4.5); sp.position.set(sd * spread, y, z + 0.005); head.add(sp);
    out.push(e, sp);
  }
  return out;
}

export function std(opts) { return new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...opts }); }

/** Hanging cloth (cape / coat tails) whose vertices sway; returns {geo, update(t, amount)}. */
export function clothPanel(w, h, wSeg, hSeg, wrap = 0, topGather = 1) {
  const geo = new THREE.PlaneGeometry(w, h, wSeg, hSeg);
  geo.translate(0, -h / 2, 0);
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    const k = -y / h; // 0 top .. 1 bottom
    const gx = x * (topGather + (1 - topGather) * Math.min(1, k * 2.5));
    base[i * 3] = gx;
    base[i * 3 + 2] = -wrap * (gx / (w / 2)) ** 2; // curve around the body
  }
  pos.array.set(base);
  geo.computeVertexNormals();
  const update = (t, sway, lift) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      const k = -y / h;
      const wave = Math.sin(t * 3.1 + x * 4 + k * 3) * 0.05 * k + Math.sin(t * 1.7 + x * 2) * 0.03 * k;
      pos.setZ(i, z + (lift * k * k * 0.6) + wave * (0.4 + sway));
      pos.setY(i, y + lift * k * k * 0.25);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return { geo, update };
}
