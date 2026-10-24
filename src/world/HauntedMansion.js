import * as THREE from 'three';
import { Geo } from './Materials.js';
import * as P from './Props.js';

/**
 * The abandoned mansion. Footprint x -15..15, z -85..-59, front door facing +z (toward the cemetery).
 * Floors: basement y=-4, ground y=0, upper y=4, ceiling y=8, roof ridge y=13.
 *
 *  Ground floor plan (top = north = -z):
 *   z -85 +-----------+--------+-----------+
 *         | Kitchen   |Cellar  |  Study    |
 *   z -76 +---d-------+--d-----+----d------+
 *         |          back corridor         |  side doors at x=±15
 *   z -72 +----d--+---a---[S]---a--+---d---+
 *         |Library|   entrance hall |Dining|
 *         |       d    (stairs)    d       |
 *   z -59 +-------+-------DOOR-----+-------+
 */
export function buildMansion(b) {
  const m = b.m;
  const X0 = -15, X1 = 15, Z0 = -85, Z1 = -59;
  const H = 4, T = 0.4, IT = 0.2;
  b.zone('mansion', X0, Z0, X1, Z1);
  b.navGrid.addRegion(1, X0, Z0, X1, Z1);
  b.navGrid.addRegion(-1, X0, Z0, X1, Z1);

  const win = (at, bottom = 1.0) => ({ at, width: 1.6, height: 1.9, bottom, type: 'window' });
  const door = (at, extra = {}) => ({ at, width: 1.6, height: 2.6, type: 'door', ...extra });
  const arch = (at, width = 1.8) => ({ at, width, height: 3.0, type: 'door', door: false });

  // ------------------------------------------------------------- floors
  // Ground floor slab with hole for the basement stairs (x -0.4..2.4, z -83.6..-77.2)
  b.floorSlab(-14.8, -84.8, -0.4, -59.2, 0, 0.3, m.planks);
  b.floorSlab(2.4, -84.8, 14.8, -59.2, 0, 0.3, m.planks);
  b.floorSlab(-0.4, -84.8, 2.4, -83.6, 0, 0.3, m.planks);
  b.floorSlab(-0.4, -77.2, 2.4, -59.2, 0, 0.3, m.planks);
  // Hall marble overlay + carpets
  const hallFloor = new THREE.Mesh(Geo.plane, m.marble.clone());
  hallFloor.material.map = m.marble.map.clone(); hallFloor.material.map.repeat.set(5, 6); hallFloor.material.map.needsUpdate = true;
  hallFloor.rotation.x = -Math.PI / 2; hallFloor.scale.set(10, 13, 1); hallFloor.position.set(0, 0.01, -65.5); hallFloor.receiveShadow = true;
  b.group.add(hallFloor);
  carpet(b, 0, 0.02, -61, 2.6, 4);

  // Upper floor slab with stair opening (x -1.3..1.3, z -68.6..-62.6)
  b.floorSlab(-14.8, -84.8, -1.3, -59.2, 4, 0.3, m.planks);
  b.floorSlab(1.3, -84.8, 14.8, -59.2, 4, 0.3, m.planks);
  b.floorSlab(-1.3, -84.8, 1.3, -68.6, 4, 0.3, m.planks);
  b.floorSlab(-1.3, -62.6, 1.3, -59.2, 4, 0.3, m.planks);
  // Ceiling
  b.box(30.4, 0.3, 26.4, m.planks, 0, 8.15, -72, { castShadow: true });
  // Basement floor
  b.floorSlab(-14.6, -84.6, 14.6, -59.4, -4, 0.3, m.stoneDark, { tile: 3 });

  // ------------------------------------------------------------- exterior walls (ground + upper)
  for (const [baseY, isGround] of [[0, true], [4, false]]) {
    b.wall(X0, Z1, X1, Z1, H, T, m.stone, { baseY, openings: isGround ? [win(5), door(15, { width: 2.4, height: 3.0, open: true, material: m.darkwood }), win(25)] : [win(5), win(11), win(19), win(25)] });
    b.wall(X0, Z0, X1, Z0, H, T, m.stone, { baseY, openings: isGround ? [door(6, { open: true }), win(16, 1.6), win(25)] : [win(6), win(16), win(25)] });
    b.wall(X0, Z0, X0, Z1, H, T, m.stone, { baseY, openings: isGround ? [win(5), door(11, { open: Math.random() < 0.5 }), win(19.5)] : [win(5), win(11), win(19.5)] });
    b.wall(X1, Z0, X1, Z1, H, T, m.stone, { baseY, openings: isGround ? [win(5), door(11, { open: Math.random() < 0.5 }), win(19.5)] : [win(5), win(11), win(19.5)] });
  }
  // Basement exterior walls
  b.wall(-14.6, -59.4, 14.6, -59.4, 4, T, m.stoneDark, { baseY: -4 });
  b.wall(-14.6, -84.6, 14.6, -84.6, 4, T, m.stoneDark, { baseY: -4 });
  b.wall(-14.6, -84.6, -14.6, -59.4, 4, T, m.stoneDark, { baseY: -4 });
  b.wall(14.6, -84.6, 14.6, -59.4, 4, T, m.stoneDark, { baseY: -4 });

  // ------------------------------------------------------------- interior walls (both floors share the plan)
  for (const baseY of [0, 4]) {
    const g = baseY === 0;
    const L = g ? 0 : 1;
    const wp = g ? m.wallpaper : m.plaster;
    const IH = g ? H - 0.3 : H;
    b.wall(-5, -72, -5, -59, IH, IT, wp, { baseY, openings: [door(6.5, { open: Math.random() < 0.6, layer: L })] });
    b.wall(5, -72, 5, -59, IH, IT, wp, { baseY, openings: [door(6.5, { open: Math.random() < 0.6, layer: L })] });
    b.wall(-15, -72, 15, -72, IH, IT, wp, { baseY, openings: [door(5, { open: Math.random() < 0.5, layer: L }), arch(11.5), arch(18.5), door(25, { open: Math.random() < 0.5, layer: L })] });
    b.wall(-15, -76, 15, -76, IH, IT, wp, { baseY, openings: [door(6, { open: Math.random() < 0.6, layer: L }), door(16, { open: true, layer: L }), door(25, { open: Math.random() < 0.6, layer: L })] });
    b.wall(-3, -85, -3, -76, IH, IT, wp, { baseY });
    b.wall(5, -85, 5, -76, IH, IT, wp, { baseY });
  }

  // ------------------------------------------------------------- stairs
  b.stairs(0, 0, -63, 'n', 2.2, 16, 0.25, 0.35, m.darkwood, 0, 1);
  // Upper-floor railings around the stair opening
  b.box(0.08, 1.0, 6.0, m.darkwood, -1.3, 4.5, -65.6, { flags: { decor: true } });
  b.box(0.08, 1.0, 6.0, m.darkwood, 1.3, 4.5, -65.6, { flags: { decor: true } });
  b.box(2.6, 1.0, 0.08, m.darkwood, 0, 4.5, -62.6, { flags: { decor: true } });
  // Basement stairs (ascend toward +z, top at z=-77.2)
  b.stairs(1, -4, -82.8, 's', 2.0, 16, 0.25, 0.35, m.stoneDark, -1, 0, { rail: false });
  b.box(0.08, 1.0, 6.4, m.darkwood, -0.4, 0.5, -80.4, { flags: { decor: true } });
  b.box(0.08, 1.0, 6.4, m.darkwood, 2.4, 0.5, -80.4, { flags: { decor: true } });
  b.box(2.8, 1.0, 0.08, m.darkwood, 1, 0.5, -83.6, { flags: { decor: true } });

  // ------------------------------------------------------------- roof & facade
  const roofSlope = Math.atan2(5, 13.5);
  const roofLen = Math.hypot(5, 13.5) + 0.8;
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(Geo.box, m.roof);
    r.scale.set(32, 0.35, roofLen);
    r.position.set(0, 8.3 + 2.5, -72 + s * 6.75);
    r.rotation.x = s * roofSlope;
    r.castShadow = true; r.receiveShadow = true;
    b.group.add(r);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-13.2, 0); gable.lineTo(13.2, 0); gable.lineTo(0, 5); gable.closePath();
  const gGeo = new THREE.ExtrudeGeometry(gable, { depth: 0.4, bevelEnabled: false });
  for (const x of [-15.2, 14.8]) {
    const gm = new THREE.Mesh(gGeo, m.stone);
    gm.rotation.y = Math.PI / 2; gm.position.set(x + 0.4, 8.3, -72);
    gm.castShadow = true; b.group.add(gm);
  }
  // Chimneys
  b.box(1.4, 6, 1.4, m.brick, -9, 11, -76, { collide: false });
  b.box(1.4, 5, 1.4, m.brick, 9, 10.5, -68, { collide: false });
  // Front tower bay with pointed roof
  const spire = new THREE.Mesh(Geo.cone, m.roof); spire.scale.set(5, 6, 5); spire.position.set(-12, 16, -61); spire.rotation.y = Math.PI / 4; b.group.add(spire);
  b.box(5, 8, 5, m.stone, -12, 9, -61, { collide: false });
  // Porch: columns + roof
  for (const x of [-3, 3]) P.column(b, x, 0, -56.5, 3.6, 0.25, m.stone);
  b.box(8, 0.3, 3.6, m.stoneDark, 0, 3.75, -57.2, { collide: false });
  b.floorSlab(-4, -59, 4, -55, 0.15, 0.3, m.stone);
  b.lamp(-1.8, 3.0, -58.6, 0xffb060, 2.6, 12, 0.45);
  b.lamp(1.8, 3.0, -58.6, 0xffb060, 2.6, 12, 0.5);
  b.decal(m.blood, 0.6, 0.15, -57, 1.4, 1.2);

  // Exterior wall trim + boarded windows
  for (const z of [Z1 + 0.25]) b.box(30.6, 0.3, 0.2, m.stoneDark, 0, 4, z, { collide: false, castShadow: false });
  boardUp(b, -10, 1.95, -58.75, true);
  boardUp(b, 6, 5.95, -58.75, true);
  boardUp(b, -15.25, 5.95, -80, false);

  // ------------------------------------------------------------- ROOMS: ground floor
  // Entrance hall
  P.chandelier(b, 0, 3.0, -61.5, 1.1);
  P.painting(b, -4.85, 2.2, -62, Math.PI / 2, 1.2, 1.6, 0);
  P.painting(b, 4.85, 2.2, -62, -Math.PI / 2, 1.2, 1.6, 1);
  P.painting(b, -4.85, 2.2, -69, Math.PI / 2, 1.0, 1.3, 2);
  P.clock(b, 4.4, 0, -70.5, -Math.PI / 2);
  P.chair(b, -3.8, 0, -60.5, 0.4, true);
  P.table(b, -3.5, 0, -67.5, 1.2, 0.7, 0.85, Math.PI / 2);
  b.candle(-3.5, 0.89, -67.2); b.candle(-3.4, 0.89, -67.8);
  b.decal(m.blood, 2.8, 0, -66, 1.8, 0.4);
  b.decal(m.blood, 3.5, 0, -64.5, 0.9, 2.0);
  b.ghostAnchors.push(new THREE.Vector3(0, 1.6, -62));

  // Library (west front)
  for (let i = 0; i < 4; i++) P.bookshelf(b, -14.55 + 0.2, 0, -61 - i * 2.5, 2.2, 3.4, Math.PI / 2);
  for (const x of [-13.2, -7.3]) P.bookshelf(b, x, 0, -71.6 + 0.2, 2.2, 3.4, 0); // leave the corridor door (x=-10) free
  P.table(b, -9.5, 0, -64.5, 2.4, 1.2, 0.8);
  P.chair(b, -9.5, 0, -63.4, Math.PI); P.chair(b, -10.6, 0, -65.6, 0.3, true);
  b.candle(-9.2, 0.84, -64.4); b.candle(-9.8, 0.84, -64.7, 0.8);
  P.sofa(b, -7.5, 0, -60.3, Math.PI);
  P.fireplace(b, -5.45, 0, -68.5, -Math.PI / 2, true);
  b.pickup('note', -9.0, 0.85, -64.9, { text: 'Day 41. The bells in the chapel ring on their own now. Mother says the dead are restless when the moon is swollen. I locked the cellar but something scratches from below every night. Whatever we buried there does not want to stay buried.' });
  b.pickup('ammo', -13.5, 0, -70.5, { weapon: 'pistol', amount: 24 });
  b.ghostAnchors.push(new THREE.Vector3(-10, 1.8, -66));

  // Dining room (east front)
  P.table(b, 10, 0, -65.5, 1.6, 6, 0.8);
  for (let i = 0; i < 4; i++) { P.chair(b, 8.8, 0, -63.5 - i * 1.4, Math.PI / 2, i === 2); P.chair(b, 11.2, 0, -63.5 - i * 1.4, -Math.PI / 2); }
  b.candle(10, 0.84, -64); b.candle(10, 0.84, -66.5); b.candle(10.1, 0.84, -67.2, 0.7);
  P.painting(b, 14.55, 2.3, -65.5, -Math.PI / 2, 2.0, 1.4, 1);
  P.piano(b, 13.8, 0, -60.5, -Math.PI / 2);
  b.decal(m.blood, 10, 0.85, -65, 1.2, 0.2);
  b.pickup('health', 6, 0, -70.8, { amount: 40 });

  // Back corridor ground floor: flickering bulbs
  b.lamp(-10, 3.2, -74, 0xffd8a0, 1.6, 9, 0.8);
  b.lamp(10, 3.2, -74, 0xffd8a0, 1.6, 9, 0.9);
  P.painting(b, 0, 2.2, -75.85, 0, 1.4, 1.0, 2);
  b.decal(m.blood, -6, 0, -74, 1.6, 2.5);

  // Kitchen (north west)
  P.table(b, -9, 0, -80.5, 3, 1.2, 0.9);
  P.barrel(b, -4.5, 0, -84); P.barrel(b, -5.3, 0, -84.1); P.crate(b, -4, 0, -82.6, 0.9, 0.3);
  b.box(4, 0.9, 0.7, m.stoneDark, -12.5, 0.45, -84.3, { flags: { decor: true } });
  b.decal(m.blood, -9, 0.92, -80.5, 1.3, 0.8);
  b.decal(m.blood, -7, 0, -78.5, 2.2, 1.5);
  b.lamp(-9, 3.3, -80.5, 0xffc080, 1.8, 9, 0.6);
  b.pickup('ammo', -8.3, 0.92, -80.4, { weapon: 'shotgun', amount: 8 });

  // Basement stair room
  b.candle(4, 0, -77, 1.2);
  // Study (north east)
  P.table(b, 10, 0, -81, 2.0, 1.0, 0.85);
  P.chair(b, 10, 0, -79.9, Math.PI);
  P.bookshelf(b, 14.35, 0, -81, 2.2, 3.0, -Math.PI / 2);
  b.candle(9.4, 0.89, -81.1);
  b.pickup('weapon', 10.4, 0.89, -81.1, { weapon: 'shotgun', name: 'Shotgun' });
  b.pickup('note', 9.2, 0.89, -80.7, { text: 'To whoever finds this: the shotgun on my desk is loaded with blessed iron. It will stop the pale ones, the ones that drink. The wolves need more than that. If you hear the bells, run to the woods and do not look behind you.' });
  P.painting(b, 5.15, 2.2, -80.5, Math.PI / 2, 1.0, 1.3, 0);

  // ------------------------------------------------------------- ROOMS: upper floor
  // Landing
  P.painting(b, -4.85, 6.2, -64, Math.PI / 2, 1.4, 1.8, 2);
  P.painting(b, 4.85, 6.2, -64, -Math.PI / 2, 1.4, 1.8, 0);
  b.lamp(0, 7.3, -60.2, 0xffc080, 1.5, 9, 0.7);
  b.decal(m.blood, -2.5, 4, -70.5, 1.5, 0.3);
  // West bedroom
  P.bed(b, -10, 4, -61.5, Math.PI);
  P.wardrobe(b, -14.3, 4, -68, Math.PI / 2);
  P.chair(b, -7, 4, -70, 0.6, true);
  b.candle(-12.6, 4, -60, 1.0);
  b.pickup('ammo', -6, 4, -60.4, { weapon: 'rifle', amount: 30 });
  b.ghostAnchors.push(new THREE.Vector3(-10, 5.8, -65));
  // East bedroom (nursery)
  P.bed(b, 10, 4, -61.5, Math.PI);
  P.wardrobe(b, 14.3, 4, -68, -Math.PI / 2);
  P.crate(b, 7, 4, -70.8, 0.6);
  b.candle(7.2, 4.6, -70.8, 0.9);
  P.mirror(b, 5.15, 5.7, -64, Math.PI / 2);
  b.ghostAnchors.push(new THREE.Vector3(10, 5.8, -65));
  // Upper back corridor
  b.lamp(0, 7.2, -74, 0xffd8a0, 1.4, 8, 0.95);
  // Master bedroom (north west)
  P.bed(b, -9, 4, -83, 0);
  P.wardrobe(b, -4, 4, -84.4, 0);
  P.mirror(b, -14.55, 5.6, -80, Math.PI / 2);
  b.candle(-11.5, 4, -84.2, 1.1);
  b.pickup('health', -13.5, 4, -77.2, { amount: 40 });
  // Bathroom with mirror (north centre)
  P.mirror(b, 1, 5.8, -84.55, 0, 1.2, 1.4);
  b.box(1.8, 0.7, 0.8, m.marble, 1, 4.35, -82, { flags: { decor: true } });
  b.decal(m.blood, 1, 4, -80, 1.6, 1.2);
  b.decal(m.symbol, 3, 4, -78.5, 1.4);
  // Attic storage (north east)
  for (let i = 0; i < 6; i++) P.crate(b, 7 + (i % 3) * 2.2, 4, -84 + Math.floor(i / 3) * 1.4, 0.7 + Math.random() * 0.4, Math.random());
  P.chains(b, 10, 8, -79);
  b.pickup('armor', 13.5, 4, -77.2, { amount: 50 });

  // ------------------------------------------------------------- BASEMENT
  const BB = -4;
  const BH = 3.7;
  const st = m.stoneDark;
  b.wall(-14.4, -76, 14.4, -76, BH, 0.3, st, { baseY: BB, openings: [arch(5.4, 1.7), arch(12.4, 1.7), arch(18.4, 1.7), arch(24.4, 1.7)] });
  b.wall(-3, -84.4, -3, -76, BH, 0.3, st, { baseY: BB });
  b.wall(5, -84.4, 5, -76, BH, 0.3, st, { baseY: BB });
  b.wall(-14.4, -73.5, 14.4, -73.5, BH, 0.3, st, { baseY: BB, openings: [arch(3.4, 1.7), arch(12.4, 1.7), arch(21.4, 1.7), arch(26.9, 1.6)] });
  b.wall(-4, -73.5, -4, -59.6, BH, 0.3, st, { baseY: BB, openings: [arch(4.5, 1.7), arch(11.5, 1.7)] });
  b.wall(-4, -66.5, 14.4, -66.5, BH, 0.3, st, { baseY: BB, openings: [arch(4, 1.7), arch(16, 1.7)] });
  b.wall(5, -66.5, 5, -59.6, BH, 0.3, st, { baseY: BB, openings: [arch(3.5, 1.6)] });
  // Secret niche in wine cellar (x -14.4..-12, z -73.35..-70)
  b.wall(-14.4, -70, -12, -70, BH, 0.3, st, { baseY: BB });
  const secret = b.box(0.3, BH, 3.2, m.brick, -12, BB + BH / 2, -71.6);
  b.secretWall(secret, 'Loose bricks…', { x: -13.3, y: BB, z: -71.8 });

  // Ritual room (north west)
  P.altar(b, -9, BB, -82.5);
  b.decal(m.symbol, -9, BB, -79.5, 4.5);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.candle(-9 + Math.cos(a) * 2.4, BB, -79.5 + Math.sin(a) * 2.4, 0.9); }
  P.skeleton(b, -12.5, BB, -78.5, 1.2);
  b.decal(m.blood, -6, BB, -78, 2.4, 0.3);
  b.ghostAnchors.push(new THREE.Vector3(-9, BB + 1.6, -80));
  // Prison (north east)
  P.cage(b, 8, BB, -82, 2.4, 2.6, 2.4, 'z+');
  P.cage(b, 12, BB, -82, 2.4, 2.6, 2.4, 'z+');
  P.skeleton(b, 12, BB, -82.6, 0.2);
  P.chains(b, 8, BB + 3.6, -79);
  P.chains(b, 11, BB + 3.6, -78.5);
  b.light(10, BB + 3.0, -78.5, 0xff3020, 1.2, 8, { flicker: 0.8, speed: 4 });
  b.pickup('ammo', 7.5, BB, -77, { weapon: 'pistol', amount: 24 });
  // Corridor + stair room
  b.lamp(1, BB + 3.2, -74.8, 0xb0c8ff, 1.0, 7, 0.95);
  P.coffin(b, -1.8, BB, -80, 0, true);
  // Wine cellar (south west): barrel aisles
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) P.barrel(b, -13.3 + i * 2.7 + (r % 2) * 0.6, BB, -68.5 + r * 3.3);
  b.candle(-6, BB, -60.2, 1.1);
  b.decal(m.blood, -9, BB, -61, 2.0, 0.7);
  // Storage (south east)
  for (let i = 0; i < 8; i++) P.crate(b, -2 + Math.random() * 15, BB, -72.5 + Math.random() * 5, 0.8 + Math.random() * 0.4, Math.random());
  P.coffin(b, 10, BB, -62.5, Math.PI / 2, false);
  P.coffin(b, 10, BB, -60.8, Math.PI / 2, true);
  P.chains(b, 0, BB + 3.6, -62);
  b.pickup('health', 1, BB, -60.5, { amount: 50 });
  b.light(9, BB + 2.0, -61.5, 0x4060ff, 0.8, 6, { flicker: 0.3, speed: 1 });

  // ------------------------------------------------------------- spawns & scares
  for (const [x, z] of [[-10, -66], [10, -66], [-9, -80], [10, -80], [-12, -74], [12, -74]]) b.spawn('mansion', x, z, 0);
  for (const [x, z] of [[-10, -65], [10, -65], [-9, -79], [10, -79], [-8, -74]]) b.spawn('mansion', x, z, 4);
  for (const [x, z] of [[-9, -78], [10, -78], [-9, -63], [8, -62], [1, -70]]) b.spawn('mansion', x, z, -4);
}

function carpet(b, x, y, z, w, d) {
  const c = new THREE.Mesh(Geo.plane, b.m.carpet);
  c.rotation.x = -Math.PI / 2; c.scale.set(w, d, 1); c.position.set(x, y, z); c.receiveShadow = true;
  b.group.add(c);
}

function boardUp(b, x, y, z, horizontal) {
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(Geo.box, b.m.planks);
    p.scale.set(horizontal ? 1.9 : 0.06, 0.22, horizontal ? 0.06 : 1.9);
    p.position.set(x, y - 0.6 + i * 0.6, z);
    p.rotation[horizontal ? 'z' : 'x'] = (Math.random() - 0.5) * 0.5;
    p.castShadow = true;
    b.group.add(p);
  }
}
