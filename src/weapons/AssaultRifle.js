import { Weapon } from './Weapon.js';
import { buildRifle } from './WeaponModels.js';

export const RIFLE = {
  id: 'rifle', name: 'ASSAULT RIFLE', slot: 3, type: 'hitscan',
  damage: 22, fireRate: 10, magSize: 30, reserveMax: 210, reserveStart: 90, reloadTime: 2.0,
  recoil: { pitch: 0.022, yaw: 0.022, shake: 0.04 }, range: 110, spread: 0.028, adsSpread: 0.009, pellets: 1, auto: true,
  adsFov: 0.72, ghostMul: 0.55, headMul: 2.0, falloff: [40, 100, 0.6], sound: 'rifle', noise: 50,
  kickBack: 0.03, kickRot: 0.06, kickRecover: 14, special: 'Full-auto, burns through ammo',
};
export class AssaultRifle extends Weapon { constructor() { super(RIFLE, buildRifle()); } }
