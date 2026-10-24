import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Materials, Geo } from './Materials.js';
import { buildMansion } from './HauntedMansion.js';
import { buildCemetery } from './Cemetery.js';
import { buildForest } from './DarkForest.js';
import { buildTerrain, terrainHeight } from './Terrain.js';
import { layerForY, layerAt } from '../game/NavGrid.js';

import { WORLD } from './WorldConfig.js';
export { WORLD };

/**
 * Collects meshes, collision boxes, lights, spawn points and interactables for the whole map.
 * Location builders (mansion/cemetery/forest) receive this builder and use its helpers.
 */
export class WorldBuilder {
  constructor(scene, physics, navGrid, quality) {
    this.scene = scene;
    this.physics = physics;
    this.navGrid = navGrid;
    this.quality = quality;
    this.mat = new Materials(quality);
    this.m = this.mat.m;
    this.group = new THREE.Group();
    this.group.name = 'world';
    scene.add(this.group);

    this.virtualLights = [];   // {pos, color, intensity, distance, flicker, baseIntensity, phase}
    this.spawnPoints = { mansion: [], cemetery: [], forest: [], grounds: [] };
    this.interactables = [];
    this.doors = [];
    this.ghostAnchors = [];
    this.scareSpots = [];
    this.zones = [];           // {name, minX, minZ, maxX, maxZ}
    this.animated = [];        // objects with update(dt,t)
    this.emissiveFlicker = []; // meshes whose material emissive pulses
    this.secrets = [];
    this.navOpenings = [];
    this.dynamic = [];         // objects that must stay separate (animated / toggled)
  }

  // ------------------------------------------------------------------ primitives
  /** Box mesh centred at (x, y, z) with size (w, h, d). y is the CENTER. */
  box(w, h, d, material, x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(Geo.box, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = opts.receiveShadow !== false;
    this.group.add(mesh);
    if (opts.collide !== false && !opts.rotY) {
      mesh.userData.box = this.physics.addBoxCS(x, y, z, w, h, d, opts.flags || {});
    } else if (opts.collide !== false && opts.rotY) {
      // approximate rotated box with its AABB
      const c = Math.abs(Math.cos(opts.rotY)), s = Math.abs(Math.sin(opts.rotY));
      const ew = w * c + d * s, ed = w * s + d * c;
      mesh.userData.box = this.physics.addBoxCS(x, y, z, ew, h, ed, opts.flags || {});
    }
    return mesh;
  }

  /** Box whose bottom sits at `baseY`. */
  boxB(w, h, d, material, x, baseY, z, opts) { return this.box(w, h, d, material, x, baseY + h / 2, z, opts); }

  mesh(geometry, material, x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (opts.scale) mesh.scale.copy(opts.scale);
    if (opts.rot) mesh.rotation.set(opts.rot.x || 0, opts.rot.y || 0, opts.rot.z || 0);
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = opts.receiveShadow !== false;
    this.group.add(mesh);
    if (opts.collideSize) {
      const s = opts.collideSize;
      mesh.userData.box = this.physics.addBoxCS(x, (opts.collideY ?? y), z, s.x, s.y, s.z, opts.flags || {});
    }
    return mesh;
  }

  collider(x, y, z, w, h, d, flags = {}) { return this.physics.addBoxCS(x, y, z, w, h, d, flags); }

  /**
   * Axis-aligned wall from (x1,z1) to (x2,z2). Supports door and window openings.
   * openings: [{at: distance-from-start, width, height, bottom (default 0), type:'door'|'window'}]
   */
  wall(x1, z1, x2, z2, height, thickness, material, opts = {}) {
    const baseY = opts.baseY || 0;
    const horizontal = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const len = horizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const start = horizontal ? Math.min(x1, x2) : Math.min(z1, z2);
    const fixed = horizontal ? z1 : x1;
    const openings = (opts.openings || []).slice().sort((a, b) => a.at - b.at);
    const seg = (from, to, bottom, top) => {
      if (to - from < 0.01 || top - bottom < 0.01) return;
      const c = (from + to) / 2, l = to - from, h = top - bottom;
      if (horizontal) this.box(l, h, thickness, material, c, baseY + bottom + h / 2, fixed, { flags: opts.flags });
      else this.box(thickness, h, l, material, fixed, baseY + bottom + h / 2, c, { flags: opts.flags });
    };
    let cursor = 0;
    for (const o of openings) {
      const a = start + o.at - o.width / 2, b = start + o.at + o.width / 2;
      seg(start + cursor, a, 0, height);
      const bottom = o.bottom ?? (o.type === 'window' ? 1.0 : 0);
      const top = bottom + o.height;
      if (bottom > 0) seg(a, b, 0, bottom);
      seg(a, b, top, height);
      const cx = horizontal ? (a + b) / 2 : fixed, cz = horizontal ? fixed : (a + b) / 2;
      if (o.type === 'window') this.window(cx, baseY + bottom, cz, o.width, o.height, horizontal, thickness);
      if (o.type === 'door' && o.door !== false) this.door(cx, baseY, cz, o.width, o.height, horizontal, thickness, o);
      if (o.type === 'door' && bottom < 0.3) this.navOpenings.push({ x: cx, z: cz, w: o.width, horizontal, layer: layerForY(baseY + 0.1, cx, cz), y: baseY });
      cursor = b - start;
    }
    seg(start + cursor, start + len, 0, height);
  }

  /** Broken window: cracked glass pane + bars, invisible collider so nobody climbs through. */
  window(cx, baseY, cz, width, height, horizontal, thickness) {
    const m = this.m;
    const pane = new THREE.Mesh(Geo.plane, m.glass);
    pane.scale.set(width * 0.95, height * 0.95, 1);
    pane.position.set(cx, baseY + height / 2, cz);
    if (!horizontal) pane.rotation.y = Math.PI / 2;
    pane.castShadow = false; pane.receiveShadow = false;
    this.group.add(pane);
    // frame cross
    const barW = 0.06;
    if (horizontal) {
      this.box(width, barW, thickness * 0.5, m.darkwood, cx, baseY + height / 2, cz, { collide: false });
      this.box(barW, height, thickness * 0.5, m.darkwood, cx, baseY + height / 2, cz, { collide: false });
    } else {
      this.box(thickness * 0.5, barW, width, m.darkwood, cx, baseY + height / 2, cz, { collide: false });
      this.box(thickness * 0.5, height, barW, m.darkwood, cx, baseY + height / 2, cz, { collide: false });
    }
    const w = horizontal ? width : thickness, d = horizontal ? thickness : width;
    this.collider(cx, baseY + height / 2, cz, w, height, d, { invisible: true, noRay: true });
    this.scareSpots.push({ pos: new THREE.Vector3(cx, baseY + height / 2, cz), type: 'window', dir: horizontal ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0) });
  }

  /** Door that can be opened with E (and by enemies). */
  door(cx, baseY, cz, width, height, horizontal, thickness, o = {}) {
    const m = this.m;
    const pivot = new THREE.Group();
    const panel = new THREE.Mesh(Geo.box, o.material || m.darkwood);
    panel.scale.set(horizontal ? width : thickness * 0.4, height, horizontal ? thickness * 0.4 : width);
    // pivot at hinge edge
    const hingeOffset = horizontal ? new THREE.Vector3(-width / 2, 0, 0) : new THREE.Vector3(0, 0, -width / 2);
    panel.position.set(-hingeOffset.x, height / 2, -hingeOffset.z);
    panel.castShadow = true; panel.receiveShadow = true;
    pivot.add(panel);
    // handle
    const handle = new THREE.Mesh(Geo.sphereLow, m.metal);
    handle.scale.setScalar(0.12);
    handle.position.set(horizontal ? width * 0.85 : thickness * 0.3, height * 0.45, horizontal ? thickness * 0.3 : width * 0.85);
    pivot.add(handle);
    pivot.position.set(cx + hingeOffset.x, baseY, cz + hingeOffset.z);
    this.group.add(pivot);
    const w = horizontal ? width : thickness, d = horizontal ? thickness : width;
    const door = {
      type: 'door', pivot, open: !!o.open, locked: !!o.locked, angle: 0, target: o.open ? 1 : 0, horizontal, width, height,
      pos: new THREE.Vector3(cx, baseY + height / 2, cz),
      collider: null, physics: this.physics, nav: this.navGrid, layer: o.layer ?? 0, label: o.locked ? 'Locked' : 'Open door',
      size: { w, h: height, d },
    };
    if (!door.open) door.collider = this.physics.addBoxCS(cx, baseY + height / 2, cz, w, height, d, { userData: door });
    else pivot.rotation.y = horizontal ? -Math.PI / 2 * 0.95 : Math.PI / 2 * 0.95, door.angle = 1;
    this.doors.push(door);
    this.interactables.push({
      type: 'door', pos: door.pos, radius: 2.2, label: () => (door.locked ? 'Locked' : door.target ? 'Close door' : 'Open door'), door,
      use: (game) => { if (door.locked) { game.hud.message('The door is locked', 1.2); return false; } toggleDoor(door, game); return true; },
      highlight: panel,
    });
    return door;
  }

  /**
   * Straight stairs. (x,z) is the centre of the bottom step; dir: 'n'|'s'|'e'|'w' = direction of ascent.
   * Registers nav portal between lowLayer and highLayer.
   */
  stairs(x, baseY, z, dir, width, steps, rise, run, material, lowLayer, highLayer, opts = {}) {
    const dx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0;
    const dz = dir === 's' ? 1 : dir === 'n' ? -1 : 0;
    const totalRun = steps * run;
    for (let i = 0; i < steps; i++) {
      const cx = x + dx * (i * run + run / 2), cz = z + dz * (i * run + run / 2);
      const top = baseY + (i + 1) * rise;
      const h = opts.solid === false ? rise : (i + 1) * rise;
      const w = dx ? run : width, d = dx ? width : run;
      this.box(w, h, d, material, cx, top - h / 2, cz, { flags: { step: true } });
    }
    const bottom = new THREE.Vector3(x - dx * 0.8, baseY, z - dz * 0.8);
    const topP = new THREE.Vector3(x + dx * (totalRun + 0.8), baseY + steps * rise, z + dz * (totalRun + 0.8));
    const rect = {
      minX: Math.min(x, x + dx * totalRun) - (dx ? 0.8 : width / 2), maxX: Math.max(x, x + dx * totalRun) + (dx ? 0.8 : width / 2),
      minZ: Math.min(z, z + dz * totalRun) - (dz ? 0.8 : width / 2), maxZ: Math.max(z, z + dz * totalRun) + (dz ? 0.8 : width / 2),
    };
    this.navGrid.addStairs(lowLayer, highLayer, bottom, topP, rect);
    // railing
    if (opts.rail !== false) {
      const railH = 1.0;
      for (const side of [-1, 1]) {
        const ox = dx ? 0 : side * width / 2, oz = dz ? 0 : side * width / 2;
        const cx = x + dx * totalRun / 2 + ox, cz = z + dz * totalRun / 2 + oz;
        const cy = baseY + (steps * rise) / 2 + railH;
        const rail = new THREE.Mesh(Geo.box, this.m.darkwood);
        const len = Math.hypot(totalRun, steps * rise);
        rail.scale.set(dx ? len : 0.08, 0.08, dz ? len : 0.08);
        rail.position.set(cx, cy, cz);
        const slope = Math.atan2(steps * rise, totalRun);
        if (dx) rail.rotation.z = -dx * slope; else rail.rotation.x = dz * slope;
        this.group.add(rail);
        for (let i = 0; i <= steps; i += 2) {
          const px = x + dx * (i * run) + ox, pz = z + dz * (i * run) + oz;
          this.box(0.06, railH, 0.06, this.m.darkwood, px, baseY + i * rise + railH / 2, pz, { collide: false, castShadow: false });
        }
      }
    }
    return { bottom, top: topP, rect };
  }

  floorSlab(minX, minZ, maxX, maxZ, topY, thickness, material, opts = {}) {
    const w = maxX - minX, d = maxZ - minZ;
    const mesh = this.box(w, thickness, d, material, (minX + maxX) / 2, topY - thickness / 2, (minZ + maxZ) / 2, { castShadow: false, flags: opts.flags });
    if (material.map && opts.uvScale !== false) {
      // Clone material for per-slab texture repeat
      const m2 = material.clone(); m2.map = material.map.clone(); m2.map.needsUpdate = true;
      m2.map.repeat.set(w / (opts.tile || 2), d / (opts.tile || 2));
      mesh.material = m2;
    }
    return mesh;
  }

  /** Thin decal plane lying on a floor. */
  decal(material, x, y, z, size, rotY = 0) {
    const d = new THREE.Mesh(Geo.plane, material);
    d.rotation.x = -Math.PI / 2; d.rotation.z = rotY;
    d.position.set(x, y + 0.012, z);
    d.scale.set(size, size, 1);
    d.castShadow = false; d.receiveShadow = true;
    this.group.add(d);
    return d;
  }

  /** Register a light that the LightPool may realise as a real PointLight. */
  light(x, y, z, color, intensity, distance, opts = {}) {
    const vl = { pos: new THREE.Vector3(x, y, z), color: new THREE.Color(color), intensity, baseIntensity: intensity, distance, flicker: opts.flicker || 0, phase: Math.random() * 100, speed: opts.speed || 1, important: !!opts.important };
    this.virtualLights.push(vl);
    return vl;
  }

  /** Candle with flame + light. */
  candle(x, baseY, z, scale = 1) {
    const m = this.m;
    this.box(0.08 * scale, 0.25 * scale, 0.08 * scale, m.candle, x, baseY + 0.125 * scale, z, { collide: false, castShadow: false });
    const flame = new THREE.Mesh(Geo.sphereLow, m.flame);
    flame.scale.set(0.05 * scale, 0.1 * scale, 0.05 * scale);
    flame.position.set(x, baseY + 0.3 * scale, z);
    flame.castShadow = false;
    this.group.add(flame);
    return this.light(x, baseY + 0.5 * scale, z, 0xffa040, 1.6 * scale, 7 * scale, { flicker: 0.5, speed: 3 });
  }

  /** Wall lamp / lantern. */
  lamp(x, y, z, color = 0xffc070, intensity = 2.2, distance = 12, flicker = 0.35) {
    const m = this.m;
    this.box(0.25, 0.4, 0.25, m.ironDark, x, y, z, { collide: false, castShadow: false });
    const glow = new THREE.Mesh(Geo.sphereLow, m.lampGlow);
    glow.scale.setScalar(0.14); glow.position.set(x, y, z); glow.castShadow = false;
    this.group.add(glow);
    return this.light(x, y, z, color, intensity, distance, { flicker, speed: 6 });
  }

  spawn(zone, x, z, y) { this.spawnPoints[zone].push(new THREE.Vector3(x, y ?? terrainHeight(x, z), z)); }
  zone(name, minX, minZ, maxX, maxZ) { this.zones.push({ name, minX, minZ, maxX, maxZ }); }

  zoneAt(p) {
    for (const z of this.zones) if (p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ) return z.name.startsWith('forest') ? 'forest' : z.name;
    return 'grounds';
  }

  /** Pickup (ammo / health / note / armor). */
  pickup(kind, x, y, z, data = {}) {
    const m = this.m;
    const g = new THREE.Group();
    let highlight;
    if (kind === 'ammo') {
      highlight = new THREE.Mesh(Geo.box, m.metal); highlight.scale.set(0.6, 0.35, 0.4); highlight.position.y = 0.175; g.add(highlight);
      const lid = new THREE.Mesh(Geo.box, m.darkwood); lid.scale.set(0.62, 0.06, 0.42); lid.position.y = 0.38; g.add(lid);
    } else if (kind === 'health') {
      highlight = new THREE.Mesh(Geo.box, new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 })); highlight.scale.set(0.45, 0.25, 0.3); highlight.position.y = 0.125; g.add(highlight);
      const cross1 = new THREE.Mesh(Geo.box, new THREE.MeshStandardMaterial({ color: 0xb01818, emissive: 0x400000 })); cross1.scale.set(0.22, 0.02, 0.07); cross1.position.y = 0.26; g.add(cross1);
      const cross2 = cross1.clone(); cross2.scale.set(0.07, 0.02, 0.22); g.add(cross2);
    } else if (kind === 'armor') {
      highlight = new THREE.Mesh(Geo.box, m.ironDark); highlight.scale.set(0.5, 0.5, 0.25); highlight.position.y = 0.3; g.add(highlight);
    } else if (kind === 'note') {
      highlight = new THREE.Mesh(Geo.plane, m.paper); highlight.scale.set(0.3, 0.4, 1); highlight.rotation.x = -Math.PI / 2; highlight.rotation.z = Math.random(); highlight.position.y = 0.02; g.add(highlight);
    } else if (kind === 'weapon') {
      highlight = new THREE.Mesh(Geo.box, m.metal); highlight.scale.set(0.9, 0.12, 0.25); highlight.position.y = 0.2; highlight.rotation.z = 0.1; g.add(highlight);
    }
    g.position.set(x, y, z);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(g);
    const item = {
      type: kind, pos: new THREE.Vector3(x, y + 0.3, z), radius: 2.0, group: g, data, taken: false, highlight,
      label: () => kind === 'ammo' ? 'Take ammo' : kind === 'health' ? 'Take medkit' : kind === 'armor' ? 'Take armor' : kind === 'note' ? 'Read note' : `Take ${data.name || 'weapon'}`,
      use: (game) => {
        if (item.taken) return false;
        const ok = game.onPickup(item);
        if (ok && kind !== 'note') { item.taken = true; g.visible = false; }
        return ok;
      },
    };
    this.interactables.push(item);
    return item;
  }

  /** A breakable / movable wall section hiding a secret stash. */
  secretWall(mesh, label, stashPos) {
    const item = {
      type: 'secret', pos: stashPos && !mesh ? new THREE.Vector3(stashPos.x, stashPos.y + 1, stashPos.z) : mesh.position.clone(), radius: 2.2, highlight: mesh, taken: false,
      label: () => label,
      use: (game) => {
        if (item.taken) return false;
        item.taken = true;
        if (mesh) {
          mesh.visible = false;
          if (mesh.userData.box) this.physics.removeBox(mesh.userData.box);
        }
        for (const p of item.stash) { p.hidden = false; p.group.visible = true; }
        game.onSecretFound(item);
        return true;
      },
    };
    this.interactables.push(item);
    item.stash = [];
    if (stashPos) {
      item.stash.push(this.pickup('ammo', stashPos.x, stashPos.y, stashPos.z, { weapon: 'all', amount: 1 }));
      item.stash.push(this.pickup('health', stashPos.x + 0.5, stashPos.y, stashPos.z + 0.6, { amount: 100 }));
      for (const p of item.stash) { p.hidden = true; p.group.visible = false; p.fromSecret = true; }
    }
    this.secrets.push(item);
    return item;
  }

  // ------------------------------------------------------------------ build everything
  build() {
    const { scene, physics } = this;
    physics.setTerrain(terrainHeight);
    const T = (label, fn) => { const t0 = performance.now(); fn(); this.timings[label] = Math.round(performance.now() - t0); };
    this.timings = {};
    T('terrain', () => buildTerrain(this));
    T('mansion', () => buildMansion(this));
    T('cemetery', () => buildCemetery(this));
    T('forest', () => buildForest(this));

    // World boundary (invisible walls)
    const B = WORLD;
    const H = 40;
    physics.addBoxCS((B.minX + B.maxX) / 2, H / 2, B.minZ - 1, B.maxX - B.minX + 10, H, 2, { invisible: true, noRay: true });
    physics.addBoxCS((B.minX + B.maxX) / 2, H / 2, B.maxZ + 1, B.maxX - B.minX + 10, H, 2, { invisible: true, noRay: true });
    physics.addBoxCS(B.minX - 1, H / 2, (B.minZ + B.maxZ) / 2, 2, H, B.maxZ - B.minZ + 10, { invisible: true, noRay: true });
    physics.addBoxCS(B.maxX + 1, H / 2, (B.minZ + B.maxZ) / 2, 2, H, B.maxZ - B.minZ + 10, { invisible: true, noRay: true });

    // Sky: moon + stars
    const moon = new THREE.Mesh(Geo.plane, this.m.moon);
    moon.scale.set(28, 28, 1);
    moon.position.set(-120, 150, -260);
    moon.lookAt(0, 20, 0);
    moon.castShadow = false; moon.receiveShadow = false;
    scene.add(moon);
    const starGeo = new THREE.BufferGeometry();
    const N = 900, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.8 + 0.1, r = 480;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb0d0, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.6, fog: false }));
    scene.add(stars);

    // Low ground fog planes drifting (cheap volumetric approximation)
    this.fogPlanes = [];
    const fogGeo = new THREE.PlaneGeometry(60, 60);
    for (let i = 0; i < 26; i++) {
      const f = new THREE.Mesh(fogGeo, this.m.fogPlane);
      f.rotation.x = -Math.PI / 2;
      const x = (Math.random() - 0.5) * 280, z = (Math.random() - 0.5) * 240;
      f.position.set(x, terrainHeight(x, z) + 0.6 + Math.random() * 1.2, z);
      f.userData.speed = 0.2 + Math.random() * 0.4; f.userData.phase = Math.random() * 10;
      f.castShadow = false; f.receiveShadow = false; f.renderOrder = 2;
      this.group.add(f); this.fogPlanes.push(f);
    }

    T('bake', () => this.bake());
    T('nav', () => {
      this.navGrid.build();
      for (const o of this.navOpenings) {
        const a = o.w / 2 - 0.2, c = 0.8;
        if (o.horizontal) this.navGrid.carve(o.layer, o.x - a, o.z - c, o.x + a, o.z + c, o.y);
        else this.navGrid.carve(o.layer, o.x - c, o.z - a, o.x + c, o.z + a, o.y);
      }
    });
    this._validateSpawns();
    console.info('[nightfall] world build ms', JSON.stringify(this.timings), 'boxes', this.physics.boxes.length);
  }

  /**
   * Merge all static meshes per material and per 40 m chunk into a handful of big meshes.
   * Turns thousands of draw calls (walls, books, props, gravestone details) into a few hundred.
   */
  bake() {
    const dyn = new Set();
    const mark = (o) => o && o.traverse((c) => dyn.add(c));
    for (const d of this.doors) mark(d.pivot);
    for (const it of this.interactables) { mark(it.group); mark(it.highlight); }
    for (const e of this.emissiveFlicker) mark(e.mesh);
    for (const f of this.fogPlanes) mark(f);
    for (const o of this.dynamic) mark(o);
    this.group.updateMatrixWorld(true);
    const buckets = new Map();
    const remove = [];
    const wp = new THREE.Vector3();
    this.group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || dyn.has(o) || o === this.ground || Array.isArray(o.material) || !o.visible) return;
      if (o.material.transparent && o.material.map === this.m.glass.map) { /* glass ok */ }
      o.getWorldPosition(wp);
      const key = `${o.material.uuid}|${Math.floor(wp.x / 40)},${Math.floor(wp.z / 40)}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}`;
      let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      geo.morphAttributes = {};
      geo.applyMatrix4(o.matrixWorld);
      let b = buckets.get(key);
      if (!b) { b = { geos: [], mat: o.material, cast: o.castShadow, recv: o.receiveShadow, order: o.renderOrder }; buckets.set(key, b); }
      b.geos.push(geo);
      remove.push(o);
    });
    for (const o of remove) o.parent.remove(o);
    let n = 0;
    for (const b of buckets.values()) {
      const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.order;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      n++;
    }
    this.bakeStats = { merged: remove.length, meshes: n };
  }

  _validateSpawns() {
    for (const zone in this.spawnPoints) {
      this.spawnPoints[zone] = this.spawnPoints[zone].filter((p) => {
        const [cx, cz] = this.navGrid.toCell(p.x, p.z);
        const layer = layerAt(p);
        const ok = this.navGrid.isWalkable(layer, cx, cz) || this.navGrid.nearestWalkable(layer, cx, cz, 2);
        return !!ok;
      });
    }
  }

  /** Bring back consumed ammo/health/armor pickups (called after every wave). */
  respawnPickups() {
    for (const it of this.interactables) {
      if (!['ammo', 'health', 'armor'].includes(it.type) || !it.taken || it.hidden || it.fromSecret) continue;
      it.taken = false; it.group.visible = true;
    }
  }

  /** Full reset for a new game. */
  resetInteractables() {
    for (const it of this.interactables) {
      if (it.type === 'secret') {
        it.taken = false;
        if (it.highlight) { it.highlight.visible = true; if (it.highlight.userData.box && !this.physics.boxes.includes(it.highlight.userData.box)) it.highlight.userData.box = this.physics.addBox(it.highlight.userData.box.min, it.highlight.userData.box.max, {}); }
        for (const p of it.stash) { p.hidden = true; p.group.visible = false; p.taken = false; }
      } else if (it.group) { it.taken = false; if (!it.hidden) it.group.visible = true; }
    }
  }

  update(dt, t, playerPos) {
    for (const it of this.interactables) {
      if (it.group && it.group.visible && it.type !== 'note') {
        it.group.rotation.y += dt * 0.6;
        if (it.baseY === undefined) it.baseY = it.group.position.y;
        it.group.position.y = it.baseY + 0.04 + Math.sin(t * 2 + it.pos.x) * 0.04;
      }
    }
    for (const f of this.fogPlanes) {
      f.position.x += Math.sin(t * 0.1 + f.userData.phase) * f.userData.speed * dt;
      f.position.z += Math.cos(t * 0.07 + f.userData.phase) * f.userData.speed * dt;
      f.material.opacity = 0.05 + 0.04 * Math.sin(t * 0.3 + f.userData.phase);
    }
    for (const e of this.emissiveFlicker) {
      const s = 0.8 + 0.3 * Math.sin(t * 9 + e.mesh.position.x * 7) + 0.15 * Math.sin(t * 23 + e.mesh.position.z * 3);
      e.mesh.scale.y = e.mesh.userData.baseScaleY ?? (e.mesh.userData.baseScaleY = e.mesh.scale.y);
      e.mesh.scale.y = e.mesh.userData.baseScaleY * s;
    }
    for (const d of this.doors) {
      const target = d.target * (d.horizontal ? -1 : 1) * Math.PI / 2 * 0.95;
      const cur = d.pivot.rotation.y;
      const n = cur + (target - cur) * Math.min(1, dt * 4);
      d.pivot.rotation.y = n;
      d.angle = Math.abs(n) / (Math.PI / 2 * 0.95);
    }
    for (const a of this.animated) a.update(dt, t, playerPos);
  }
}

export function toggleDoor(door, game) {
  if (door.locked) return;
  door.target = door.target ? 0 : 1;
  if (door.target) {
    // the nav grid already treats every doorway as passable (enemies open doors they bump into)
    if (door.collider) { door.physics.removeBox(door.collider); door.collider = null; }
  } else if (!door.collider) {
    door.collider = door.physics.addBoxCS(door.pos.x, door.pos.y, door.pos.z, door.size.w, door.size.h, door.size.d, { userData: door });
  }
  if (game && game.audio) game.audio.play('doorCreak', { pos: door.pos });
}
