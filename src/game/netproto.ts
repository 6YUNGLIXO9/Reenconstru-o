// Protocolo compartilhado host/cliente: índices compactos de tipos e animações.
export const ETYPES = ['bandit', 'soldier', 'crossbowman', 'knight', 'elite', 'brute', 'imp', 'ghoul', 'troll', 'apostle', 'spitter', 'ogre'];
export const BTYPES = ['bazuso', 'adon', 'gennon', 'zodd', 'griffith', 'wyald', 'rakshas', 'grunbeld', 'femto', 'falcon'];
export const ANIMS = ['', 'l1', 'l2', 'l3', 'heavy', 'thrust', 'slam', 'cast', 'spin', 'leap', 'shootL', 'shootR', 'shootE', 'rageRoar'];
export const aIdx = (s: string) => Math.max(0, ANIMS.indexOf(s || ''));
export const aStr = (i: number) => ANIMS[i] || '';

// pack de estado de jogador: [x,z,fa, animIdx,p,mv,dodge,hit,dead,stun,block,rage,fly, hp,maxHp,stam,maxStam]
export interface NetPlayer { x: number; z: number; fa: number; a: number; p: number; mv: number; dg: number; hit: number; dead: number; stun: number; blk: number; rage: number; fly: number; hp: number; mhp: number; st: number; mst: number }
export interface NetSnap {
  t: number;
  gu: NetPlayer; ca: NetPlayer | null;
  en: number[][];   // [nid, typeIdx, x,z,fa, animIdx, p, mv, hpFrac, deadFlag, scale, y]
  bo: number[] | null; // [typeIdx, x,z,fa, animIdx, p, mv, hp, max, phase, phases, y]
  pr: number[][];   // [x,y,z,kindIdx]
  ob: { k: string; a?: number; b?: number }; ki: number; tg: number; pt: number; cine: string;
}
export const PRKINDS = ['bolt', 'ebolt', 'cannon', 'orb', 'spit', 'wave'];
export interface NetInput { mx: number; mz: number; run: boolean; yaw: number; light: boolean; heavy: boolean; dodge: boolean; block: boolean; special: boolean; interact: boolean; }
