// Salvamento local (3 espaços), configurações e migração de dados antigos — sem contas.
import { useSyncExternalStore } from 'react';

export interface Save {
  v: number; slot: number; points: number; totalEarned: number; spent: number;
  ups: Record<string, number>; cups: Record<string, number>;
  armor: boolean; armorEq: boolean; cloak: boolean; cloakEq: boolean;
  allies: string[]; active: string[]; unlocked: number; completed: number[];
  attempts: Record<string, number>; bosses: string[];
  history: { t: number; item: string; cost: number }[];
  weapons: string[]; skills: string[]; current: number; updated: number; playTime: number; difficulty: 'easy' | 'medium' | 'hard';
  hero: 'guts' | 'caska';
  secret: { f5: { feathers: number; bonfires: boolean; flag: boolean; lured: boolean }; bLvls: number[]; fLvls: number[]; g1: boolean; g2: boolean };
  side: { mission: string | null; bounty: string | null; forLvl: number; bountiesDone: string[]; eggs: number[]; campEggs: number[] };
}
export interface Settings {
  audio: { master: number; music: number; sfx: number; dialog: number; ambient: number; mute: boolean };
  gfx: { preset: string; tex: number; shadow: number; dist: number; fx: number; res: number; light: number; fps: number };
  lang: 'pt' | 'en' | 'ru';
  keys: Record<string, string>;
  slot: number;
}

const P = 'be2:';
export const PRESETS: Record<string, { tex: number; shadow: number; dist: number; fx: number; res: number; light: number; fps: number }> = {
  vlow: { tex: 0, shadow: 0, dist: 0.6, fx: 0.35, res: 0.6, light: 0.8, fps: 30 },
  low: { tex: 0, shadow: 1, dist: 0.75, fx: 0.55, res: 0.75, light: 0.9, fps: 30 },
  medium: { tex: 1, shadow: 1, dist: 1.0, fx: 0.8, res: 0.9, light: 1.0, fps: 60 },
  high: { tex: 2, shadow: 2, dist: 1.2, fx: 1.0, res: 1.0, light: 1.1, fps: 60 },
  vhigh: { tex: 2, shadow: 2, dist: 1.5, fx: 1.3, res: 1.0, light: 1.2, fps: 0 },
};
export const DEFAULT_KEYS: Record<string, string> = {
  fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', run: 'ShiftLeft', dodge: 'Space',
  light: 'Mouse0', heavy: 'Mouse2', cannon: 'KeyQ', xbow: 'KeyC', rage: 'KeyF', heal: 'KeyR',
  interact: 'KeyE', shop: 'Tab', pause: 'KeyP', block: 'KeyV', lock: 'KeyT', cursor: 'KeyG',
};
const defSettings = (): Settings => ({
  audio: { master: 80, music: 70, sfx: 90, dialog: 90, ambient: 70, mute: false },
  gfx: { preset: 'medium', ...PRESETS.medium },
  lang: 'pt', keys: { ...DEFAULT_KEYS }, slot: 0,
});

let settings: Settings = loadSettings();
const subs = new Set<() => void>();
let ver = 0;
export const storageError: { msg: string | null } = { msg: null };

function loadSettings(): Settings {
  const d = defSettings();
  try {
    const raw = localStorage.getItem(P + 'settings');
    if (raw) {
      const o = JSON.parse(raw);
      const keys = { ...d.keys, ...(o.keys || {}) };
      // migração: G agora é o cursor livre; bloqueio antigo em G vai para V
      if (!o.keys?.cursor) { if (keys.block === 'KeyG') keys.block = 'KeyV'; keys.cursor = 'KeyG'; }
      return { ...d, ...o, audio: { ...d.audio, ...(o.audio || {}) }, gfx: { ...d.gfx, ...(o.gfx || {}) }, keys };
    }
  } catch { /* ignore */ }
  return d;
}
export const getSettings = () => settings;
export function setSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  persist(P + 'settings', settings);
  ver++; subs.forEach((f) => f());
}
export function useSettings(): Settings {
  useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => ver);
  return settings;
}
function persist(key: string, val: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(val)); storageError.msg = null; return true; }
  catch (e) { storageError.msg = 'Falha ao gravar no armazenamento local: ' + String(e); ver++; subs.forEach((f) => f()); return false; }
}

// ---------- Saves ----------
export const newSave = (slot: number): Save => ({
  v: 1, slot, points: 0, totalEarned: 0, spent: 0,
  ups: { dmg: 0, def: 0, stam: 0, rageDur: 0, rageDmg: 0 },
  cups: { hp: 0, dmg: 0, stam: 0, spd: 0, det: 0 },
  armor: false, armorEq: false, cloak: false, cloakEq: false,
  allies: ['puck', 'caska'], active: ['puck'], unlocked: 1, completed: [], attempts: {}, bosses: [], history: [],
  weapons: ['dragonslayer', 'cannon', 'crossbow'], skills: ['rage', 'puckHeal', 'dodge', 'block'], current: 1, updated: Date.now(), playTime: 0, difficulty: 'medium',
  hero: 'guts', secret: { f5: { feathers: 0, bonfires: false, flag: false, lured: false }, bLvls: [], fLvls: [], g1: false, g2: false },
  side: { mission: null, bounty: null, forLvl: 0, bountiesDone: [], eggs: [], campEggs: [] },
});
const num = (x: unknown, d: number, min = 0, max = 1e9) => (typeof x === 'number' && isFinite(x) ? Math.min(max, Math.max(min, x)) : d);
export function normalize(o: any, slot: number): Save | null {
  if (!o || typeof o !== 'object') return null;
  const d = newSave(slot);
  const recN = (src: any, base: Record<string, number>) => { const r = { ...base }; if (src && typeof src === 'object') for (const k of Object.keys(base)) r[k] = Math.round(num(src[k], 0, 0, 5)); return r; };
  const arr = (a: any, def: any[]) => (Array.isArray(a) ? a : def);
  const s: Save = {
    ...d,
    points: Math.floor(num(o.points ?? o.score, 0)), totalEarned: Math.floor(num(o.totalEarned ?? o.total, 0)), spent: Math.floor(num(o.spent, 0)),
    ups: recN(o.ups ?? o.upgrades, d.ups), cups: recN(o.cups, d.cups),
    armor: !!o.armor, armorEq: !!(o.armor && (o.armorEq ?? true)), cloak: !!o.cloak, cloakEq: !!(o.cloak && (o.cloakEq ?? true)),
    allies: Array.from(new Set([...d.allies, ...arr(o.allies, []).filter((x: any) => typeof x === 'string')])),
    active: arr(o.active, d.active).filter((x: any) => typeof x === 'string'),
    unlocked: Math.round(num(o.unlocked ?? o.unlockedLevel, 1, 1, 10)),
    completed: arr(o.completed, []).filter((x: any) => typeof x === 'number' && x >= 1 && x <= 10),
    attempts: o.attempts && typeof o.attempts === 'object' ? o.attempts : {},
    bosses: arr(o.bosses, []).filter((x: any) => typeof x === 'string'),
    history: arr(o.history, []).filter((h: any) => h && typeof h.item === 'string').slice(-200),
    weapons: arr(o.weapons, d.weapons), skills: arr(o.skills, d.skills),
    current: Math.round(num(o.current ?? o.level, 1, 1, 10)), updated: num(o.updated, Date.now()), playTime: num(o.playTime, 0),
    difficulty: (['easy', 'medium', 'hard'].includes(o.difficulty) ? o.difficulty : 'medium'),
    hero: o.hero === 'caska' ? 'caska' : 'guts',
    secret: {
      f5: { feathers: Math.round(num(o.secret?.f5?.feathers, 0, 0, 5)), bonfires: !!o.secret?.f5?.bonfires, flag: !!o.secret?.f5?.flag, lured: !!o.secret?.f5?.lured },
      bLvls: arr(o.secret?.bLvls, []).filter((x: any) => typeof x === 'number'), fLvls: arr(o.secret?.fLvls, []).filter((x: any) => typeof x === 'number'),
      g1: !!o.secret?.g1, g2: !!o.secret?.g2,
    },
    side: {
      mission: typeof o.side?.mission === 'string' ? o.side.mission : null, bounty: typeof o.side?.bounty === 'string' ? o.side.bounty : null,
      forLvl: Math.round(num(o.side?.forLvl, 0, 0, 10)), bountiesDone: arr(o.side?.bountiesDone, []).filter((x: any) => typeof x === 'string'),
      eggs: arr(o.side?.eggs, []).filter((x: any) => typeof x === 'number'), campEggs: arr(o.side?.campEggs, []).filter((x: any) => typeof x === 'number'),
    },
  };
  s.active = s.active.filter((a) => s.allies.includes(a));
  const maxDone = s.completed.length ? Math.max(...s.completed) : 0;
  s.unlocked = Math.min(10, Math.max(s.unlocked, maxDone + 1));
  return s;
}
export function loadSlot(i: number): Save | null {
  try { const r = localStorage.getItem(P + 'slot:' + i); if (!r) return null; return normalize(JSON.parse(r), i); } catch { return null; }
}
export function saveSlot(s: Save): boolean { s.updated = Date.now(); return persist(P + 'slot:' + s.slot, s); }
export function deleteSlot(i: number) { try { localStorage.removeItem(P + 'slot:' + i); } catch { /* */ } ver++; subs.forEach((f) => f()); }
export function latestSlot(): number {
  let best = -1, t = -1;
  for (let i = 0; i < 3; i++) { const s = loadSlot(i); if (s && s.updated > t) { t = s.updated; best = i; } }
  return best;
}

// Migração de dados antigos (nunca sobrescreve slots existentes, nunca apaga chaves antigas).
export function migrateLegacy(): number {
  let n = 0;
  try {
    if (localStorage.getItem(P + 'migrated')) return 0;
    const cands: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith(P) || !/berserk|guts|eclipse|campaign|save/i.test(k)) continue;
      try {
        const o = JSON.parse(localStorage.getItem(k) || 'null');
        if (!o) continue;
        if (Array.isArray(o)) o.forEach((x) => cands.push(x));
        else if (Array.isArray(o.slots)) o.slots.forEach((x: any) => cands.push(x));
        else if (o.campaign || o.save) cands.push(o.campaign || o.save);
        else cands.push(o);
      } catch { /* */ }
    }
    for (const c of cands) {
      const ns = normalize(c, 0);
      if (!ns || (ns.points === 0 && ns.totalEarned === 0 && ns.completed.length === 0 && !Object.values(ns.ups).some((x) => x))) continue;
      for (let sl = 0; sl < 3; sl++) { if (!loadSlot(sl)) { ns.slot = sl; saveSlot(ns); n++; break; } }
    }
    localStorage.setItem(P + 'migrated', '1');
  } catch { /* */ }
  return n;
}
