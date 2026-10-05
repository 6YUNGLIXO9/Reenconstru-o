// Acampamento central: estágio narrativo, posições dos NPCs e diálogos dinâmicos (chaves i18n).
import { Save } from './save';

export type CampStage = 'early' | 'mid' | 'tense' | 'post';
export function campStage(s: Save): CampStage {
  const done = s.completed;
  if (done.includes(5)) return 'post';          // depois do Eclipse
  if (done.includes(4)) return 'tense';         // aproximação do Eclipse
  if (done.includes(2)) return 'mid';
  return 'early';
}
// intensidade da transformação visual do acampamento (0 = normal, 1 = Eclipse)
export const STAGE_TINT: Record<CampStage, number> = { early: 0, mid: 0.12, tense: 0.45, post: 1 };

export interface NpcSpot { id: string; x: number; z: number; fa: number }
// disposição fixa do acampamento (a fogueira central fica em 0,0 — o jogador nasce ao sul)
// Vila rural: entrada ao sul (+z), rua principal, praça central, igreja ao norte.
export const NPC_SPOTS: NpcSpot[] = [
  { id: 'godo', x: 7, z: 11.5, fa: -2.3 },        // oficina na rua principal
  { id: 'rickert', x: 9.8, z: 9.6, fa: -2.0 },    // bancada ao lado da forja
  { id: 'caska', x: -8.5, z: -5.5, fa: 1.2 },     // casa de comando, oeste da praça
  { id: 'puck', x: -4.2, z: -1.5, fa: 1.9 },      // árvore da praça
  { id: 'serpico', x: 11.5, z: -3.5, fa: -1.7 },  // casa leste
  { id: 'farnese', x: -12.5, z: 3.5, fa: 0.9 },   // bairro residencial oeste
  { id: 'schierke', x: -16.5, z: -11, fa: 1.0 },  // cabana na orla norte-oeste
  { id: 'roderick', x: 18.5, z: 0.5, fa: -2.6 },  // celeiro/depósito da área agrícola
  { id: 'griffith1', x: -18, z: -7, fa: 1.2 },
  { id: 'griffith2', x: -18, z: -7, fa: 1.2 },
  { id: 'guts', x: 4, z: 17.5, fa: -0.3 },        // abrigo perto da entrada (NPC quando Caska joga)
  { id: 'skull', x: -22, z: 12, fa: 2.3 },        // orla da floresta, sudoeste
  { id: 'priest', x: 1.6, z: -8.2, fa: 2.9 },     // frente da igreja
  { id: 'guard', x: 2.8, z: 23.5, fa: 3.1 },      // vigia da entrada
  { id: 'isidro', x: 6.2, z: 19.8, fa: -2.6 },    // perto dos alvos de treino de Guts (história)
];
export const VILLAGERS: { x: number; z: number; r: number; kid?: boolean }[] = [
  { x: -2, z: 1, r: 4 },            // praça
  { x: 3.5, z: -4, r: 3.5, kid: true }, // criança na praça
  { x: -11, z: 8, r: 4 },           // residencial
  { x: 19, z: 6, r: 4 },            // agricultor
  { x: 0.5, z: 14, r: 3 },          // rua principal
];
// tópicos de conversa próprios de cada personagem (chaves i18n: q.<npc>.<t> / a.<npc>.<t>)
export const TOPICS: Record<string, string[]> = {
  guts: ['journey', 'band', 'promise'],
  caska: ['group', 'battle', 'worry', 'gear'],
  rickert: ['sword', 'newgear', 'forge', 'mats'],
  godo: ['upgrade', 'health', 'road'],
  puck: ['guts', 'camp', 'fun'],
  schierke: ['magic', 'spirits', 'armor'],
  serpico: ['strategy', 'farnese', 'danger'],
  farnese: ['journey', 'schierke', 'change'],
  roderick: ['routes', 'supplies', 'sea'],
  ivalera: ['caska', 'heal', 'group'],
  skull: ['fate', 'behelit'],
  griffith1: ['dream', 'band'],
  griffith2: ['presence', 'dream'],
  priest: ['faith', 'village'],
  guard: ['watch', 'road'],
  isidro: ['train', 'guts'],
};
export const DEPART = { x: -0.5, z: 28.5 };      // círculo de partida na estrada de entrada
export const BOARD = { x: -5, z: 3.5 };          // quadro de missões na beira da praça
export const CAMP_EGGS = [{ x: -20, z: -14 }, { x: 22, z: 10 }]; // baús escondidos (orla NW / fundo da área agrícola)

// ---------- contratos (missões da próxima fase) ----------
export const MISSIONS: { id: string; reward: number }[] = [
  { id: 'hunt', reward: 120 },     // caçada: elite marcado surge na fase
  { id: 'nodeath', reward: 100 },  // proteção: conclua sem cair
  { id: 'swift', reward: 90 },     // patrulha rápida: conclua em menos de 6 minutos
];
// ---------- procurados (minibosses opcionais) ----------
export interface BountyDef { id: string; base: string; scale: number; hpMul: number; reward: number; lv: [number, number]; tint: number }
export const BOUNTIES: BountyDef[] = [
  { id: 'snake', base: 'apostle', scale: 1.5, hpMul: 3.2, reward: 200, lv: [1, 4], tint: 0x3a7a30 },   // Barão Serpente
  { id: 'slug', base: 'spitter', scale: 1.7, hpMul: 4.5, reward: 220, lv: [3, 6], tint: 0x8a6aa0 },    // Conde Lesma
  { id: 'rosine', base: 'imp', scale: 1.6, hpMul: 4.2, reward: 240, lv: [6, 8], tint: 0xd06a8a },      // Rosine
  { id: 'donovan', base: 'brute', scale: 1.3, hpMul: 1.6, reward: 180, lv: [1, 10], tint: 0x6a5a40 },  // Donovan
  { id: 'boscogn', base: 'knight', scale: 1.4, hpMul: 3.5, reward: 260, lv: [4, 10], tint: 0x8a2a2a }, // General Boscogn
];
export const bountiesFor = (lv: number) => BOUNTIES.filter((b) => lv >= b.lv[0] && lv <= b.lv[1]).slice(0, 3);

// nº de falas por NPC/estágio — as chaves i18n seguem o padrão dlg.<npc>.<estágio>.<n>
const COUNTS: Record<string, Partial<Record<CampStage, number>>> = {
  godo: { early: 3, mid: 2, tense: 2, post: 3 },
  caska: { early: 3, mid: 3, tense: 3, post: 2 },
  puck: { early: 2, post: 2 }, serpico: { early: 2, post: 2 }, schierke: { early: 2, post: 2 },
  farnese: { early: 2, post: 2 }, roderick: { early: 2, post: 2 }, ivalera: { early: 2, post: 2 },
  griffith1: { early: 2, post: 1 }, griffith2: { post: 2 }, guts: { early: 1, post: 1 },
  rickert: { early: 2, post: 2 }, skull: { early: 2, tense: 2, post: 2 },
  villager: { early: 3, post: 2 }, priest: { early: 2, tense: 2, post: 2 }, guard: { early: 2, post: 2 }, isidro: { early: 2, post: 2 },
};
// camada 2: falas específicas quando CASKA é a protagonista (dlgc.*)
const COUNTS_C: Record<string, Partial<Record<CampStage, number>>> = {
  godo: { early: 2, post: 2 }, puck: { early: 2, post: 1 }, schierke: { early: 2, post: 1 }, serpico: { early: 2, post: 1 },
  farnese: { early: 2, post: 1 }, roderick: { early: 2, post: 1 }, ivalera: { early: 2, post: 1 }, guts: { early: 1, post: 1 },
  rickert: { early: 1, post: 1 }, skull: { early: 1, post: 1 }, griffith1: { early: 1 }, griffith2: { post: 1 },
};
export function dlgKeys(npc: string, stage: CampStage, hero: 'guts' | 'caska' = 'guts'): string[] {
  const table = hero === 'caska' ? COUNTS_C : COUNTS;
  const pre = hero === 'caska' ? 'dlgc' : 'dlg';
  let c = table[npc] || {};
  let st: CampStage = c[stage] != null ? stage : stage === 'post' || stage === 'tense' ? (c.post != null ? 'post' : 'early') : 'early';
  let n = c[st] ?? 0;
  if (!n && hero === 'caska') return dlgKeys(npc, stage, 'guts'); // fallback: camada padrão
  if (!n) return ['camp.say.' + npc];
  return Array.from({ length: n }, (_, i) => `${pre}.${npc}.${st}.${i + 1}`);
}
// NPCs com conversas importantes (mostram as 3 opções de resposta)
export const MAJOR_NPCS = ['godo', 'caska', 'griffith1', 'griffith2', 'skull', 'rickert', 'guts'];
