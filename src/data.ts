// Dados centrais de Berserk Eclipse: inimigos, chefes, fases, loja, aliados.
export type Cls = 'common' | 'tough' | 'special' | 'mini' | 'boss';
export interface EDef { id: string; hp: number; dmg: number; spd: number; range: number; cls: Cls; atk: string; scale: number; poise: number; }

const E = (id: string, hp: number, dmg: number, spd: number, range: number, cls: Cls, atk: string, scale = 1): EDef => ({
  id, hp, dmg, spd, range, cls, atk, scale,
  poise: { common: 20, tough: 70, special: 110, mini: 400, boss: 900 }[cls],
});

export const ENEMIES: Record<string, EDef> = {
  bandit: E('bandit', 55, 8, 4.8, 2.1, 'common', 'melee', 1),
  soldier: E('soldier', 70, 10, 4.2, 2.5, 'common', 'melee', 1),
  crossbowman: E('crossbowman', 55, 13, 3.8, 15, 'tough', 'ranged', 1),
  knight: E('knight', 170, 18, 3.5, 2.8, 'tough', 'guard', 1.08),
  elite: E('elite', 240, 24, 5.2, 2.6, 'special', 'charge', 1.1),
  brute: E('brute', 780, 36, 3.6, 3.4, 'mini', 'slam', 1.6),
  imp: E('imp', 45, 8, 6.3, 1.9, 'common', 'melee', 0.7),
  ghoul: E('ghoul', 95, 12, 5.2, 2.2, 'common', 'melee', 1),
  troll: E('troll', 200, 22, 3.8, 3.0, 'tough', 'melee', 1.45),
  apostle: E('apostle', 270, 26, 5.5, 2.6, 'special', 'leap', 1.2),
  spitter: E('spitter', 75, 14, 3.6, 16, 'tough', 'ranged', 1),
  ogre: E('ogre', 900, 42, 3.6, 3.8, 'mini', 'slam', 2.1),
};

export const POINTS: Record<Cls, number> = { common: 10, tough: 20, special: 35, mini: 100, boss: 250 };

export interface BossDef { id: string; hp: number; scale: number; spd: number; phases: number; range: number; dmg: number; atk: string[]; p2: string[]; summon: string[]; flying?: boolean; }
const B = (id: string, hp: number, scale: number, spd: number, phases: number, range: number, dmg: number, atk: string[], p2: string[] = [], summon: string[] = [], flying = false): BossDef =>
  ({ id, hp, scale, spd, phases, range, dmg, atk, p2, summon, flying });
export const BOSSES: Record<string, BossDef> = {
  bazuso: B('bazuso', 1500, 1.55, 3.8, 2, 4.0, 30, ['swing', 'slam', 'charge'], ['summon'], ['soldier', 'soldier', 'bandit']),
  adon: B('adon', 1900, 1.25, 4.4, 2, 4.4, 34, ['swing', 'charge', 'wave', 'leap'], ['summon'], ['knight', 'knight']),
  gennon: B('gennon', 2400, 1.2, 5, 2, 3.4, 36, ['swing', 'spin', 'blink', 'barrage'], ['summon'], ['bandit', 'bandit', 'bandit']),
  zodd: B('zodd', 3000, 1.9, 5, 2, 4.8, 44, ['swing', 'leap', 'wave', 'charge', 'spin'], [], []),
  griffith: B('griffith', 3400, 1.12, 6.2, 2, 3.3, 38, ['swing', 'blink', 'wave', 'bolts', 'barrage'], [], []),
  wyald: B('wyald', 4000, 2.2, 4.2, 2, 5.2, 48, ['slam', 'swing', 'leap', 'bolts', 'barrage'], ['summon'], ['ghoul', 'imp', 'imp']),
  rakshas: B('rakshas', 4600, 1.55, 5.6, 2, 3.8, 46, ['spin', 'blink', 'bolts', 'swing', 'barrage'], [], []),
  grunbeld: B('grunbeld', 5400, 2.1, 4.8, 2, 5.2, 54, ['swing', 'slam', 'wave', 'charge', 'leap', 'bolts', 'barrage'], [], []),
  femto: B('femto', 6200, 1.4, 6.2, 2, 3.6, 50, ['blink', 'bolts', 'wave', 'barrage', 'spin', 'swing'], ['summon'], ['apostle', 'imp', 'imp'], true),
  falcon: B('falcon', 8000, 1.7, 6.6, 3, 4.2, 58, ['swing', 'blink', 'wave', 'bolts', 'barrage', 'spin', 'slam', 'leap'], ['summon'], ['apostle', 'ghoul', 'imp'], true),
  mozgus: B('mozgus', 3800, 1.6, 4.2, 2, 4.2, 46, ['slam', 'swing', 'wave', 'charge', 'barrage'], [], []),
  conrad: B('conrad', 3200, 2.0, 3.2, 2, 4.6, 42, ['slam', 'wave', 'summon', 'barrage'], [], ['ghoul', 'imp']),
  ubik: B('ubik', 2600, 1.1, 5.8, 2, 3.2, 36, ['blink', 'bolts', 'barrage', 'summon'], [], ['imp', 'imp'], true),
  slan: B('slan', 3600, 1.35, 6.0, 2, 3.4, 44, ['swing', 'spin', 'barrage', 'blink', 'wave'], [], [], true),
  void0: B('void0', 4400, 1.8, 3.6, 2, 4.4, 50, ['bolts', 'wave', 'barrage', 'blink', 'slam'], [], []),
};
export const BOSS_NAMES: Record<string, string> = {
  bazuso: 'Bazuso, o Esmagador', adon: 'Adon, Lança de Tudor', gennon: 'Gennon, o Conde das Lâminas', zodd: 'Zodd, o Imortal',
  griffith: 'Griffith, o Falcão Branco', wyald: 'Wyald, o Apóstolo Gigante', rakshas: 'Rakshas, Tempestade de Lâminas',
  grunbeld: 'Grunbeld, Imperador Dragão', femto: 'Femto, Mão de Deus', falcon: 'Falcão da Luz', mozgus: 'Bispo Mozgus',
  conrad: 'Conrad', ubik: 'Ubik', slan: 'Slan', void0: 'Void',
};
// Discípulos de Mozgus: [tipo base, escala]
export const DISCIPLES: [string, string, number][] = [
  ['birdmask', 'apostle', 1.1], ['diablillo', 'imp', 1.3], ['angelface', 'ghoul', 1.15], ['bubblehead', 'spitter', 1.2], ['twin1', 'bandit', 1.1], ['twin2', 'bandit', 1.1],
];

export interface LevelDef { id: number; theme: string; kills: number; groups: Record<string, number>; mini: string[]; boss: string; behelits: number; defense?: boolean; defWaves?: number; }
export const LEVELS: LevelDef[] = [
  { id: 1, theme: 'camp', kills: 20, groups: { soldier: 5, bandit: 4, ghoul: 1 }, mini: ['brute'], boss: 'bazuso', behelits: 0 },
  { id: 2, theme: 'fort', kills: 20, groups: { soldier: 3, bandit: 3, knight: 2, ghoul: 2, crossbowman: 2 }, mini: ['brute'], boss: 'adon', behelits: 0 },
  { id: 3, theme: 'hall', kills: 21, groups: { knight: 4, soldier: 3, crossbowman: 3, elite: 2, bandit: 2 }, mini: ['brute'], boss: 'gennon', behelits: 0 },
  { id: 4, theme: 'camp', kills: 0, groups: {}, mini: [], boss: 'zodd', behelits: 0, defense: true, defWaves: 5 }, // Defesa da Vila — antes do Eclipse (absorve o antigo campo de batalha de Zodd)
  { id: 5, theme: 'forest', kills: 20, groups: { knight: 3, elite: 2, crossbowman: 2, soldier: 3 }, mini: ['elite'], boss: 'griffith', behelits: 0 },
  { id: 6, theme: 'eclipse', kills: 21, groups: { imp: 4, ghoul: 3, troll: 2, spitter: 2 }, mini: ['ogre'], boss: 'wyald', behelits: 0 },
  { id: 7, theme: 'valley', kills: 22, groups: { ghoul: 3, imp: 3, spitter: 2, troll: 2, apostle: 1 }, mini: ['ogre'], boss: 'rakshas', behelits: 1 },
  { id: 8, theme: 'eclipse', kills: 0, groups: {}, mini: [], boss: 'grunbeld', behelits: 0, defense: true, defWaves: 6 }, // Defesa da Vila — depois do Eclipse (absorve as profundezas de Grunbeld)
  { id: 9, theme: 'altar', kills: 0, groups: {}, mini: [], boss: 'femto', behelits: 0 },
  { id: 10, theme: 'falconia', kills: 20, groups: { apostle: 3, troll: 3, spitter: 2, imp: 2, ghoul: 2 }, mini: ['ogre'], boss: 'falcon', behelits: 1 },
];

// ---------- Loja ----------
export const GUTS_UPS: Record<string, { icon: string; costs: number[] }> = {
  dmg: { icon: '⚔️', costs: [300, 500, 750, 1100, 1500] },
  def: { icon: '🛡️', costs: [300, 500, 750, 1100, 1500] },
  stam: { icon: '🫁', costs: [250, 450, 700, 1000, 1350] },
  rageDur: { icon: '⏳', costs: [400, 650, 950, 1300, 1800] },
  rageDmg: { icon: '🔥', costs: [500, 800, 1200, 1700, 2300] },
};
export const CASKA_UPS: Record<string, { icon: string; costs: number[] }> = {
  hp: { icon: '❤️', costs: [280, 480, 720, 1050, 1450] },
  dmg: { icon: '🗡️', costs: [320, 520, 780, 1150, 1550] },
  stam: { icon: '💨', costs: [260, 430, 660, 950, 1300] },
  spd: { icon: '👢', costs: [300, 500, 750, 1100, 1500] },
  det: { icon: '🦅', costs: [450, 750, 1100, 1550, 2100] },
};
export const ARMOR_COST = 5000;
export const CLOAK_COST = 2500;

// ---------- Dificuldade ----------
export type Diff = 'easy' | 'medium' | 'hard';
export interface DiffCfg { enemyHp: number; enemyDmg: number; stamRegen: number; playerDmg: number; react: number; points: number }
export const DIFFS: Record<Diff, DiffCfg> = {
  easy: { enemyHp: 0.75, enemyDmg: 0.65, stamRegen: 1.2, playerDmg: 1.15, react: 1.2, points: 1.0 },
  medium: { enemyHp: 1.0, enemyDmg: 1.0, stamRegen: 1.0, playerDmg: 1.0, react: 1.0, points: 1.0 },
  hard: { enemyHp: 1.3, enemyDmg: 1.35, stamRegen: 0.9, playerDmg: 0.95, react: 0.85, points: 1.25 },
};

// Buffs de suporte exclusivos
export const SCHIERKE_BUFF = { dmg: 1.15, stamRegen: 1.10, rageGain: 1.20, cdr: 0.90 }; // Bênção Espiritual (Guts)
export const FARNESE_BUFF = { atkSpd: 1.15, stamRegen: 1.15, moveSpd: 1.10, poise: 1.10 }; // Graça da Nobreza (Caska)
export const IVALERA_HEAL = 0.40, IVALERA_CD = 60;
export const ALLY_COST: Record<string, number> = { puck: 0, serpico: 1000, schierke: 1500, farnese: 1750, roderick: 2000, caska: 0, isidro: 0, griffith1: 0, griffith2: 0 };
export const ALLY_ICON: Record<string, string> = { puck: '🧚', serpico: '🌪️', schierke: '🔮', farnese: '✝️', roderick: '🔱', caska: '🦅', isidro: '🔥', griffith1: '🪶', griffith2: '😈', gutsai: '⚔️', ivalera: '🧚‍♀️' };
export const MAX_ACTIVE = 2; // aliados ativos no modo solo (fadas não contam)

// Caska (dados preservados)
export const CASKA_BASE = { hp: 172, dmg: 0.72, stam: 140, regen: 34, red: 0.05 };

export function caskaStats(c: Record<string, number>, cloak: boolean) {
  const hp = CASKA_BASE.hp * (1 + 0.07 * (c.hp || 0)) * (cloak ? 1.1 : 1);
  const dmg = CASKA_BASE.dmg * (1 + 0.1 * (c.dmg || 0)) * (cloak ? 1.1 : 1);
  const stam = CASKA_BASE.stam * (1 + 0.1 * (c.stam || 0)) * (cloak ? 1.2 : 1);
  const regen = CASKA_BASE.regen * (1 + 0.08 * (c.stam || 0)) * (cloak ? 1.15 : 1);
  const spd = 1 + 0.05 * (c.spd || 0);
  const dodge = 1 + 0.1 * (c.spd || 0) + (cloak ? 0.1 : 0);
  const detDur = 8 + 0.8 * (c.det || 0) + (cloak ? 2 : 0);
  const detCd = 60 - 2 * (c.det || 0);
  return { hp, dmg, stam, regen, spd, dodge, detDur, detCd };
}

// Guts (atributos derivados)
export function gutsStats(s: { ups: Record<string, number>; armorEq: boolean }) {
  const u = s.ups, a = s.armorEq;
  return {
    maxHp: 200 + (a ? 50 : 0),
    dmgMul: (1 + 0.1 * (u.dmg || 0)) * (a ? 1.15 : 1),
    takeMul: (1 - 0.06 * (u.def || 0)) * (a ? 0.85 : 1),
    maxStam: 100 + 18 * (u.stam || 0),
    regen: 30 * (1 + 0.08 * (u.stam || 0)),
    rageDur: 7 + 2.4 * (u.rageDur || 0) + (a ? 5 : 0),
    rageMul: 1.5 + 0.13 * (u.rageDmg || 0) + (a ? 0.5 : 0),
    rageNeed: a ? 75 : 100,
    rageGain: a ? 1.3 : 1,
  };
}
