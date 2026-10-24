import { Weapon } from './Weapon.js';
import { buildPistol } from './WeaponModels.js';

export const PISTOL = {
  id: 'pistol', name: 'PISTOL', slot: 1, type: 'hitscan', startOwned: true,
  damage: 28, fireRate: 4.5, magSize: 12, reserveMax: 144, reserveStart: 96, reloadTime: 1.3,
  recoil: { pitch: 0.035, yaw: 0.015, shake: 0.06 }, range: 90, spread: 0.018, adsSpread: 0.004, pellets: 1, auto: false,
  adsFov: 0.82, ghostMul: 0.6, headMul: 2.2, falloff: [30, 80, 0.6], sound: 'pistol', noise: 40,
  kickBack: 0.05, kickRot: 0.18, special: 'Reliable sidearm',
};
export class Pistol extends Weapon { constructor() { super(PISTOL, buildPistol()); } }
