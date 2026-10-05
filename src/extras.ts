// Conquistas, galeria e definições dos modos extras.
import { Profile, getProfile, unlockAch } from './profile';
import { Save } from './save';

export interface AchDef { id: string; icon: string; check(p: Profile, s: Save | null): boolean }
export const ACHS: AchDef[] = [
  { id: 'blood10', icon: '🗡️', check: (p) => p.general.kills >= 10 },
  { id: 'blood100', icon: '⚔️', check: (p) => p.general.kills >= 100 },
  { id: 'blood1000', icon: '💀', check: (p) => p.general.kills >= 1000 },
  { id: 'boss1', icon: '👹', check: (p) => p.general.bosses >= 1 },
  { id: 'boss10', icon: '🐉', check: (p) => p.general.bosses >= 10 },
  { id: 'eclipse', icon: '🌑', check: (_p, s) => !!s && s.completed.includes(5) },
  { id: 'campaign', icon: '🏰', check: (_p, s) => !!s && s.completed.includes(10) },
  { id: 'streak20', icon: '🔥', check: (p) => p.general.bestStreak >= 20 },
  { id: 'caska1', icon: '🦅', check: (p) => p.caska.cleared >= 1 },
  { id: 'coop1', icon: '🤝', check: (p) => p.online.completed >= 1 },
  { id: 'g1', icon: '🪶', check: (_p, s) => !!s && s.secret.g1 },
  { id: 'g2', icon: '😈', check: (_p, s) => !!s && s.secret.g2 },
  { id: 'arena10', icon: '🏟️', check: (p) => p.records.arenaWave >= 10 },
  { id: 'surv15', icon: '⏳', check: (p) => p.records.survWave >= 15 },
  { id: 'dungeon1', icon: '🕳️', check: (p) => p.records.dungeonClears >= 1 },
  { id: 'docs5', icon: '📜', check: (p) => p.records.docs.length >= 5 },
  { id: 'docs10', icon: '📚', check: (p) => p.records.docs.length >= 10 },
  { id: 'rich', icon: '◆', check: (p) => p.general.points >= 5000 },
];
export function evalAchs(s: Save | null): string[] {
  const p = getProfile(), out: string[] = [];
  for (const a of ACHS) { if (!p.ach[a.id] && a.check(p, s)) { unlockAch(a.id); out.push(a.id); } }
  return out;
}

// Galeria: documentos colecionáveis (1 por fase da campanha) + chefes derrotados
export const DOCS = ['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6', 'doc7', 'doc8', 'doc9', 'doc10'];
export const GALLERY_BOSSES = ['bazuso', 'adon', 'gennon', 'zodd', 'griffith', 'wyald', 'rakshas', 'grunbeld', 'femto', 'falcon', 'mozgus'];

// Modos extras
export type ExtraMode = 'arena' | 'survival' | 'dungeon' | 'training' | 'defense';
export const MODE_LEVEL: Record<ExtraMode, number> = { arena: 3, survival: 4, dungeon: 6, training: 2, defense: 1 };
export const MODE_THEME: Record<ExtraMode, string> = { arena: 'hall', survival: 'siege', dungeon: 'valley', training: 'camp', defense: 'camp' };
export const ARENA_BOSSES = ['bazuso', 'adon', 'gennon', 'zodd', 'wyald'];
export const WAVE_POOL = [['bandit', 'soldier'], ['soldier', 'ghoul', 'crossbowman'], ['knight', 'ghoul', 'imp'], ['knight', 'elite', 'spitter'], ['elite', 'troll', 'apostle']];
