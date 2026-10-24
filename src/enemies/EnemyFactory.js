import { Vampire } from './Vampire.js';
import { Werewolf } from './Werewolf.js';
import { Ghost } from './Ghost.js';
import { Boss } from './Boss.js';

export const ENEMY_TYPES = ['vampire', 'werewolf', 'ghost', 'ancientVampire', 'alphaWerewolf', 'revenant', 'boss'];

export function createEnemy(game, type, pos, scale) {
  switch (type) {
    case 'vampire': return new Vampire(game, pos, scale);
    case 'ancientVampire': return new Vampire(game, pos, scale, true);
    case 'werewolf': return new Werewolf(game, pos, scale);
    case 'alphaWerewolf': return new Werewolf(game, pos, scale, true);
    case 'ghost': return new Ghost(game, pos, scale);
    case 'revenant': return new Ghost(game, pos, scale, true);
    case 'boss': return new Boss(game, pos, scale);
    default: throw new Error(`Unknown enemy type ${type}`);
  }
}
