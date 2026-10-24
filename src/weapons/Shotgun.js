import { Weapon } from './Weapon.js';
import { buildShotgun } from './WeaponModels.js';

export const SHOTGUN = {
  id: 'shotgun', name: 'SHOTGUN', slot: 2, type: 'hitscan',
  damage: 17, fireRate: 1.15, magSize: 6, reserveMax: 36, reserveStart: 18, reloadTime: 2.4,
  recoil: { pitch: 0.11, yaw: 0.04, shake: 0.22 }, range: 40, spread: 0.075, adsSpread: 0.055, pellets: 9, auto: false,
  adsFov: 0.9, ghostMul: 0.5, headMul: 1.6, falloff: [6, 24, 0.25], sound: 'shotgun', noise: 60,
  kickBack: 0.12, kickRot: 0.32, kickRecover: 5, flashIntensity: 1.8, special: '9 blessed-iron pellets, brutal up close',
};
export class Shotgun extends Weapon { constructor() { super(SHOTGUN, buildShotgun()); } }
