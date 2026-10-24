import { Weapon } from './Weapon.js';
import { buildCrossbow } from './WeaponModels.js';

export const CROSSBOW = {
  id: 'crossbow', name: 'HOLY CROSSBOW', slot: 4, type: 'projectile',
  damage: 95, fireRate: 1.0, magSize: 1, reserveMax: 24, reserveStart: 10, reloadTime: 1.1,
  recoil: { pitch: 0.05, yaw: 0.01, shake: 0.08 }, range: 140, spread: 0.004, adsSpread: 0.0, pellets: 1, auto: false,
  adsFov: 0.6, ghostMul: 4.0, headMul: 1.8, falloff: null, sound: 'crossbow', noise: 12, boltSpeed: 48,
  kickBack: 0.08, kickRot: 0.1, flashColor: 0x9fd0ff, flashIntensity: 0.8, special: 'Silver bolts: x4 damage vs spirits, pierce',
};
export class HolyCrossbow extends Weapon { constructor() { super(CROSSBOW, buildCrossbow()); } }
