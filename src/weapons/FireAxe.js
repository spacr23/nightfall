import { Weapon } from './Weapon.js';
import { buildAxe } from './WeaponModels.js';

export const AXE = {
  id: 'axe', name: 'FIRE AXE', slot: 5, type: 'melee', startOwned: true,
  damage: 95, fireRate: 1.6, magSize: 0, reserveMax: 0, reserveStart: 0, reloadTime: 0,
  recoil: { pitch: 0, yaw: 0, shake: 0 }, range: 2.9, arc: 0.85, spread: 0, adsSpread: 0, auto: true,
  adsFov: 1, ghostMul: 0.8, headMul: 1.5, sound: 'axeSwing', noise: 8, special: 'No ammo. Heavy, slow, devastating',
};
export class FireAxe extends Weapon { constructor() { super(AXE, buildAxe()); } }
