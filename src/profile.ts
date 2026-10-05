// Perfil do jogador (sem login): identificador persistente, nome e estatísticas reais.
import { useSyncExternalStore } from 'react';

export interface CharStats { cleared: number; kills: number; bosses: number; dmgDealt: number; dmgTaken: number; specials: number; time: number }
export interface Profile {
  id: string; name: string;
  general: { cleared: number; started: number; completed: number; kills: number; bosses: number; deaths: number; points: number; time: number; bestStreak: number };
  guts: CharStats; caska: CharStats;
  online: { started: number; completed: number; coopCleared: number; coopTime: number; kills: number; bosses: number };
  records: { arenaWave: number; arenaScore: number; survWave: number; survScore: number; dungeonClears: number; defWave: number; docs: string[] };
  ach: Record<string, number>;
  cosm: { ds: 'steel' | 'dark' | 'crimson'; cape: 'black' | 'crimson' | 'brown'; title: string };
}
const P = 'be2:profile';
const RESERVED = ['admin', 'administrator', 'root', 'server', 'null', 'undefined', 'system', 'moderator', 'guts', 'caska'];
const BAD = ['fuck', 'shit', 'bitch', 'nigger', 'faggot', 'cunt', 'puta', 'merda', 'caralho'];

const emptyChar = (): CharStats => ({ cleared: 0, kills: 0, bosses: 0, dmgDealt: 0, dmgTaken: 0, specials: 0, time: 0 });
function uuid() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch { /* */ }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
function fresh(): Profile {
  const n = Math.floor(Math.random() * 9000 + 1000);
  return { id: uuid(), name: 'Mercenário ' + n, general: { cleared: 0, started: 0, completed: 0, kills: 0, bosses: 0, deaths: 0, points: 0, time: 0, bestStreak: 0 }, guts: emptyChar(), caska: emptyChar(), online: { started: 0, completed: 0, coopCleared: 0, coopTime: 0, kills: 0, bosses: 0 }, records: { arenaWave: 0, arenaScore: 0, survWave: 0, survScore: 0, dungeonClears: 0, defWave: 0, docs: [] }, ach: {}, cosm: { ds: 'steel', cape: 'black', title: '' } };
}
function load(): Profile {
  try {
    const raw = localStorage.getItem(P);
    if (raw) { const o = JSON.parse(raw); const d = fresh(); return { ...d, ...o, id: o.id || d.id, general: { ...d.general, ...(o.general || {}) }, guts: { ...emptyChar(), ...(o.guts || {}) }, caska: { ...emptyChar(), ...(o.caska || {}) }, online: { ...d.online, ...(o.online || {}) }, records: { ...d.records, ...(o.records || {}) }, ach: o.ach || {}, cosm: { ...d.cosm, ...(o.cosm || {}) } }; }
  } catch { /* */ }
  const p = fresh(); save(p); return p;
}
let profile = load();
const subs = new Set<() => void>(); let ver = 0;
function save(p: Profile) { try { localStorage.setItem(P, JSON.stringify(p)); } catch { /* */ } }
function emit() { ver++; subs.forEach((f) => f()); save(profile); }

export const getProfile = () => profile;
export function useProfile(): Profile { useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => ver); return profile; }

export function validateName(raw: string): { ok: boolean; value: string; error?: string } {
  const v = raw.trim().replace(/\s+/g, ' ');
  if (!v) return { ok: false, value: v, error: 'empty' };
  if (v.length < 2) return { ok: false, value: v, error: 'short' };
  if (v.length > 18) return { ok: false, value: v, error: 'long' };
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(v)) return { ok: false, value: v, error: 'chars' };
  const low = v.toLowerCase();
  if (RESERVED.includes(low)) return { ok: false, value: v, error: 'reserved' };
  if (BAD.some((b) => low.includes(b))) return { ok: false, value: v, error: 'bad' };
  return { ok: true, value: v };
}
export function setName(name: string): boolean {
  const r = validateName(name); if (!r.ok) return false;
  profile = { ...profile, name: r.value }; emit(); return true;
}

// ---------- hooks de estatística (eventos reais do jogo) ----------
type Who = 'guts' | 'caska';
export function statKill(who: Who, online: boolean) { profile[who].kills++; profile.general.kills++; if (online) profile.online.kills++; ver++; }
export function statBoss(who: Who, online: boolean) { profile[who].bosses++; profile.general.bosses++; if (online) profile.online.bosses++; }
export function statDmgDealt(who: Who, v: number) { profile[who].dmgDealt += v; }
export function statDmgTaken(who: Who, v: number) { profile[who].dmgTaken += v; }
export function statSpecial(who: Who) { profile[who].specials++; }
export function statDeath() { profile.general.deaths++; }
export function statStreak(s: number) { if (s > profile.general.bestStreak) profile.general.bestStreak = s; }
export function statTime(who: Who, dt: number, online: boolean, general = true) { profile[who].time += dt; if (general) profile.general.time += dt; if (online && who === 'caska') profile.online.coopTime += dt; }
export function statLevelStart(online: boolean) { profile.general.started++; if (online) profile.online.started++; emit(); }
export function statLevelComplete(who: Who, points: number, online: boolean) {
  profile.general.completed++; profile.general.cleared++; profile[who].cleared++; profile.general.points += points;
  if (online) { profile.online.completed++; profile.online.coopCleared++; }
  emit();
}
export function flushStats() { emit(); }
export function setRecord(k: 'arenaWave' | 'arenaScore' | 'survWave' | 'survScore' | 'defWave', v: number) { if (v > profile.records[k]) { profile.records[k] = v; emit(); } }
export function addDungeonClear() { profile.records.dungeonClears++; emit(); }
export function addDoc(id: string): boolean { if (profile.records.docs.includes(id)) return false; profile.records.docs.push(id); emit(); return true; }
export function setCosm(c: Partial<Profile['cosm']>) { profile = { ...profile, cosm: { ...profile.cosm, ...c } }; emit(); }
export function unlockAch(id: string): boolean { if (profile.ach[id]) return false; profile.ach[id] = Date.now(); emit(); return true; }
