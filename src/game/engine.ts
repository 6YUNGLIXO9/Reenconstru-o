// Motor de jogo: física, câmera, combate, IA, chefes, aliados, projéteis, efeitos, objetivos.
import * as THREE from 'three';
import { Rig, AS, newAS, animate, own, flash, disposeRig, buildGuts, buildCaska, buildPuck, buildSerpico, buildSchierke, buildFarnese, buildRoderick, buildGolem, buildEnemy, buildBoss, buildGriffith, setBerserk, setCloak, mk, gBox, gSph, gCone, gCyl, mat } from './models';
import { buildWorld, resolve, blocked, makeBehelit, makeRelic, R, World } from './world';
import { ENEMIES, BOSSES, LEVELS, POINTS, gutsStats, caskaStats, EDef, BossDef } from '../data';
import { getSettings, Save } from '../save';
import { ETYPES, BTYPES, aIdx, PRKINDS } from './netproto';
import { CASKA_BASE, DIFFS, DiffCfg, Diff, SCHIERKE_BUFF, FARNESE_BUFF, IVALERA_HEAL, IVALERA_CD, DISCIPLES } from '../data';
import { MODE_THEME, ExtraMode, ARENA_BOSSES, WAVE_POOL } from '../extras';
import { NPC_SPOTS, VILLAGERS, DEPART, BOARD, CAMP_EGGS, campStage, STAGE_TINT, BOUNTIES } from '../camp';
import { buildGodo, buildRickert, buildSkullKnight, buildIsidro, dragonSlayer, humanoid } from './models';
import { buildIvalera } from './models';
import * as Prof from '../profile';
import * as A from '../audio';
const CASKA_RED = CASKA_BASE.red;

const PI = Math.PI, TAU = PI * 2;
const wrap = (a: number) => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };
const turn = (c: number, t: number, m: number) => c + Math.max(-m, Math.min(m, wrap(t - c)));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface HudState {
  hp: number; maxHp: number; stam: number; maxStam: number; rage: number; rageNeed: number; rageOn: boolean; rageLeft: number; armor: boolean;
  cannon: number; cannonCd: number; bolts: number; reloading: boolean; points: number; obj: { k: string; a?: number; b?: number }; kills: number; target: number;
  boss: { name: string; hp: number; max: number; phase: number; phases: number } | null; skills: { id: string; cd: number; max: number; on: boolean }[];
  tut: { id: string; i: number; n: number } | null; prompt: string | null; lock: boolean; cine: string; dead: boolean; exhausted: boolean; guard: boolean; eagle: boolean; time: number; shield: number;
  mate?: { hp: number; maxHp: number; dead: boolean } | null;
  allyBars?: { id: string; hp: number; maxHp: number; down: boolean }[]; buffGuts?: boolean; buffCaska?: boolean; ivalera?: { cd: number; max: number; active: boolean } | null; difficulty?: string;
  hero?: 'guts' | 'caska'; secret?: any;
  defense?: { barrier: number; max: number; wave: number; maxW: number; prep: number; vhp: number; vmax: number; left: number } | null;
  cursorFree?: boolean;
}
export interface AllyBar { id: string; hp: number; maxHp: number; down: boolean }
export interface EndResult { win: boolean; kills: number; time: number; combat: number; boss: string | null; level: number; relics: number; wave?: number; mode?: string; side?: { mission: string | null; missionOk: boolean; bounty: string | null; bountyOk: boolean } }
export interface Callbacks { hud(h: HudState): void; msg(k: string, p?: any): void; end(r: EndResult): void; pause(p: boolean, why: string): void; secret?(k: string, p?: any): void }

interface AtkDef { anim: string; W: number; St: number; R: number; range: number; arc: number; mult: number; stam: number; kb: number; stun: number; lunge: number }
const ATK: Record<string, AtkDef> = {
  l1: { anim: 'l1', W: 0.3, St: 0.12, R: 0.36, range: 3.5, arc: 1.3, mult: 1, stam: 8, kb: 3, stun: 0.25, lunge: 3 },
  l2: { anim: 'l2', W: 0.28, St: 0.12, R: 0.38, range: 3.7, arc: 1.4, mult: 1, stam: 10, kb: 3.5, stun: 0.25, lunge: 3 },
  l3: { anim: 'l3', W: 0.42, St: 0.14, R: 0.55, range: 3.9, arc: 1.2, mult: 1.7, stam: 13, kb: 6, stun: 0.5, lunge: 4 },
  heavy: { anim: 'heavy', W: 0.7, St: 0.16, R: 0.7, range: 4.7, arc: 1.75, mult: 3, stam: 26, kb: 10, stun: 1, lunge: 4.5 },
};
const ACFG: Record<string, { W: number; St: number; R: number; anim: string }> = {
  melee: { W: 0.55, St: 0.15, R: 0.85, anim: 'l1' }, swing: { W: 0.8, St: 0.15, R: 1.0, anim: 'l3' }, slam: { W: 1.05, St: 0.2, R: 1.3, anim: 'slam' },
  charge: { W: 0.8, St: 0.65, R: 1.0, anim: 'thrust' }, leap: { W: 0.7, St: 0.6, R: 0.8, anim: 'leap' }, bolts: { W: 0.6, St: 0.2, R: 0.9, anim: 'cast' },
  wave: { W: 0.9, St: 0.2, R: 1.0, anim: 'slam' }, spin: { W: 0.8, St: 1.3, R: 1.0, anim: 'spin' }, summon: { W: 1.2, St: 0.3, R: 1.0, anim: 'cast' },
  barrage: { W: 0.7, St: 1.5, R: 1.1, anim: 'cast' }, blink: { W: 0.5, St: 0.1, R: 0.15, anim: 'cast' }, ranged: { W: 0.85, St: 0.15, R: 1.0, anim: 'shootE' },
};
type Tele = { g: THREE.Group; fill: THREE.Mesh; kind: string; len: number; wid: number };
interface En {
  id: string; def: EDef; boss: BossDef | null; mini: boolean; rig: Rig; as: AS; x: number; z: number; y: number; fa: number; kx: number; kz: number; hp: number; max: number; poise: number; pmax: number; aggro: boolean;
  state: string; st: number; atk: string; W: number; St: number; R: number; anim: string; hitDone: boolean; cd: number; token: boolean; phase: number; flashT: number; stunT: number; dead: boolean; deadT: number;
  tele: Tele | null; tx: number; tz: number; circ: number; guarding: boolean; guardT: number; slow: number; summoned: boolean; last: string; next: string; summonCd: number; dmgMul: number; tick: number; heavy: boolean;
  sx: number; sz: number; hitOnce: boolean; bar: THREE.Sprite[] | null; rad: number; poiseT: number; hitT: number; fade: number; nid: number;
}
interface Proj { m: THREE.Mesh; x: number; y: number; z: number; vx: number; vy: number; vz: number; dmg: number; fr: boolean; life: number; kind: string; rad: number; hit: boolean; aoe: number }
interface Fx { m: THREE.Object3D; life: number; max: number; kind: string; s0: number; s1: number; mat?: THREE.Material }
interface Ally { id: string; rig: Rig; as: AS; x: number; z: number; fa: number; cd: number; atkT: number; atk: string; ap: number; act: number; i: number; extra: number; tgt: En | null; dashT: number; dx: number; dz: number; spinT: number; on: number; tick: number; hp: number; maxHp: number; hurtT: number; downT: number }
interface Golem { rig: Rig; as: AS; x: number; z: number; fa: number; life: number; atkT: number; ring: THREE.Mesh; ap: number; hp?: number; maxHp?: number; dmg?: number; minion?: boolean }
interface Behelit { g: THREE.Group; hp: number; max: number; x: number; z: number; alive: boolean }

// ---------- partículas ----------
class PS {
  pts: THREE.Points; N: number; pos: Float32Array; col: Float32Array; size: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; grav: Float32Array; head = 0; geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial;
  constructor(N: number, additive: boolean) {
    this.N = N; this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 4); this.size = new Float32Array(N); this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N); this.grav = new Float32Array(N);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.geo.setAttribute('acol', new THREE.BufferAttribute(this.col, 4)); this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { sc: { value: 600 } },
      vertexShader: 'attribute vec4 acol; attribute float size; uniform float sc; varying vec4 vC; void main(){ vC=acol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*sc/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vC; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(vC.rgb, vC.a*smoothstep(0.5,0.1,d)); }',
    });
    this.pts = new THREE.Points(this.geo, this.mat); this.pts.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, c: number, a: number, size: number, life: number, grav: number) {
    const i = this.head; this.head = (i + 1) % this.N; const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[i * 4] = ((c >> 16) & 255) / 255; this.col[i * 4 + 1] = ((c >> 8) & 255) / 255; this.col[i * 4 + 2] = (c & 255) / 255; this.col[i * 4 + 3] = a;
    this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = grav;
  }
  update(dt: number) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt; const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt; this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.02 && this.grav[i] > 0) { this.pos[k + 1] = 0.02; this.vel[k + 1] *= -0.2; this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6; }
      const f = this.life[i] / this.max[i]; this.col[i * 4 + 3] = Math.min(1, f * 1.6);
      if (this.life[i] <= 0) this.col[i * 4 + 3] = 0;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.geo.attributes.acol as THREE.BufferAttribute).needsUpdate = true; (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}

const TUT = ['move', 'run', 'dodge', 'light', 'heavy', 'cannon', 'xbow', 'rage', 'heal'];
const PROJ_COL: Record<string, number> = { bazuso: 0xff8030, adon: 0x80ff80, gennon: 0x80c0ff, zodd: 0xff4020, griffith: 0xffffff, wyald: 0xffc040, rakshas: 0xff3080, grunbeld: 0xff5010, femto: 0xff2a40, falcon: 0xfff0a0, mozgus: 0xffe6b0, conrad: 0x9a8a60, ubik: 0xc8ffd0, slan: 0xff2a60, void0: 0xb0a0ff };
const DEF_BOSS: Record<number, string> = { 10: 'griffith', 15: 'mozgus', 16: 'conrad', 17: 'ubik', 18: 'slan', 19: 'void0', 20: 'femto' };
const DEF_HIRE: [string, number][] = [['isidro', 100], ['serpico', 150], ['caska', 150], ['farnese', 160], ['roderick', 180]];

export class Engine {
  host: HTMLElement; cb: Callbacks; lv: number; ld: typeof LEVELS[0]; save: Save;
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); cam: THREE.PerspectiveCamera; world: World;
  gs: ReturnType<typeof gutsStats>; cs: ReturnType<typeof caskaStats>;
  keys = new Set<string>(); pressed = new Set<string>(); yaw = 0; pitch = 0.4; camDist = 7.4; lockT: En | null = null; shake = 0; noLock = false; fov = 62;
  raf = 0; last = performance.now(); paused = false; fx = 1; minDt = 0; hitStop = 0; slow = 1; disposed = false; time = 0; hudT = 0; fpsAcc = 0; cine = ''; cineT = 0;
  p: any; rig: Rig; as = newAS();
  enemies: En[] = []; allies: Ally[] = []; golems: Golem[] = []; projs: Proj[] = []; fxs: Fx[] = []; behelits: Behelit[] = []; relics: { g: THREE.Group; x: number; z: number; got: boolean }[] = [];
  psA: PS; psN: PS; kills = 0; spawned = 0; minisSpawned = 0; minisDead = 0; bossSpawned = false; boss: En | null = null; bossDead = false; endT = -1; spawnT = 4; combat = 0; relicN = 0;
  minimap: HTMLCanvasElement | null = null; tutDone = new Set<string>(); tutMoveD = 0; lastSettings = ''; eagle = 0; eagleCd = 0; mods = { atkSpd: 1 }; curTexQ = -1; shield = 0; shieldT = 0; armorT = 0; dummy = new THREE.Object3D();
  geoCache = new Map<string, THREE.BufferGeometry>(); matCache = new Map<string, THREE.Material>(); watchers: Rig[] = []; tokens = 3; started = false; healFx = 0; endSent = false;

  coop = false; netSend: ((m: any) => void) | null = null; remoteInput: any = null; caskaNet: Ally | null = null;
  cask = { hp: 0, maxHp: 0, stam: 0, maxStam: 0, iframes: 0, dead: false, deadT: 0, eagle: 0, eagleCd: 0, flashT: 0, atkCd: 0, attackT: 0, atk: '', buf: '', combo: 0, hurtT: 0, ivaleraCd: 0, ivaleraT: 0 };
  nid = 1; snapAcc = 0; pingAcc = 0; streak = 0; _lastKiller: 'guts' | 'caska' = 'guts';
  diff: DiffCfg = DIFFS.medium; inputLocked = false; ivalera: Rig | null = null; ivaleraAS = newAS();
  gBuff = false; cBuff = false; // Schierke→Guts, Farnese→Caska
  hero: 'guts' | 'caska' = 'guts'; heroSpd = 1; ivaleraT = 0;
  feathers: { g: THREE.Group; x: number; z: number; got: boolean }[] = [];
  secretFlag: { g: THREE.Group; x: number; z: number; found: boolean } | null = null;
  falconFlag: { g: THREE.Group; x: number; z: number; hp: number; alive: boolean } | null = null;
  behItem: { g: THREE.Group; x: number; z: number; got: boolean } | null = null;
  talkBeh: { g: THREE.Group; x: number; z: number; used: boolean } | null = null;
  mozgusMinis: number[] = []; mozgusOn = false; secretDone = false;
  mode: 'campaign' | 'arena' | 'survival' | 'dungeon' | 'training' | 'camp' | 'defense' = 'campaign';
  // tower defense (defesa da vila)
  defs = { barrier: 600, barrierMax: 600, dome: null as THREE.Mesh | null, shopHp: 400, shopDead: false, alerts: {} as Record<string, number>, schierke: null as { rig: Rig; as: AS } | null };
  posts: { x: number; z: number; unit: 'soldier' | 'archer' | null; ring: THREE.Mesh }[] = [];
  defCam = false; skipReq = false; cursorFree = false;
  defHired: string[] = []; defNpcs: { id: string; rig: Rig; as: AS; x: number; z: number }[] = []; vHp = 300; vHpMax = 300;
  toggleCursor() {
    this.cursorFree = !this.cursorFree;
    if (this.cursorFree) { this.keys.clear(); if (document.pointerLockElement) document.exitPointerLock(); }
    else if (!this.noLock && !this.paused && !this.inputLocked) { try { (this.renderer.domElement.requestPointerLock() as any)?.catch?.(() => { this.noLock = true; }); } catch { this.noLock = true; } }
  }
  get defOn() { return this.mode === 'defense' || this.defCam; }
  get defMaxW() { return this.defCam ? (this.ld.defWaves || 5) : 20; }
  skipPrep() { if (this.defOn && !this.enemies.some((e) => !e.dead)) this.skipReq = true; }
  wave = 0; waveRest = 2; waveBossOn = false; traps: { tele: Tele; t: number; x: number; z: number }[] = []; trapT = 8; docItem: { g: THREE.Group; x: number; z: number; got: boolean } | null = null;
  npcs: { id: string; rig: Rig; as: AS; x: number; z: number; fa: number }[] = []; departFx: THREE.Mesh | null = null;
  chests: { g: THREE.Group; x: number; z: number; i: number }[] = []; noStamT = -9; stepErrLogged = false;
  eggItem: { g: THREE.Group; x: number; z: number; got: boolean } | null = null;
  hens: { g: THREE.Group; t: number }[] = [];
  missionId: string | null = null; missionOk = false; missionFail = false; bountyId: string | null = null; bountyOk = false; bountySpawned = false; huntSpawned = false; diedOnce = false;
  constructor(host: HTMLElement, level: number, save: Save, cb: Callbacks, opts?: { coop?: boolean; net?: (m: any) => void; difficulty?: Diff; hero?: 'guts' | 'caska'; mode?: 'campaign' | 'arena' | 'survival' | 'dungeon' | 'training' | 'camp' | 'defense' }) {
    this.host = host; this.cb = cb; this.lv = level; this.ld = LEVELS[level - 1]; this.save = save;
    this.mode = opts?.mode || 'campaign';
    this.defCam = this.mode === 'campaign' && !!this.ld.defense; // fases 4 e 8: defesa da vila dentro da campanha
    if (this.mode === 'camp') this.ld = { ...this.ld, kills: 0, groups: {}, mini: [], boss: 'zodd', behelits: 0, theme: campStage(save) === 'post' ? 'eclipse' : 'camp' };
    else if (this.mode !== 'campaign') this.ld = { ...this.ld, kills: 0, groups: {}, mini: [], boss: 'zodd', behelits: 0, theme: MODE_THEME[this.mode as ExtraMode] };
    this.coop = !!opts?.coop; this.netSend = opts?.net || null; this.diff = DIFFS[opts?.difficulty || save.difficulty || 'medium'];
    this.hero = (!this.coop && opts?.hero === 'caska') ? 'caska' : 'guts';
    this.gs = gutsStats(save); this.cs = caskaStats(save.cups, save.cloakEq);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;outline:none';
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    host.appendChild(this.renderer.domElement);
    this.setupEnv();
    this.cam = new THREE.PerspectiveCamera(this.fov, 1, 0.2, 300);
    const g = getSettings().gfx; this.curTexQ = g.tex;
    this.world = buildWorld(this.ld.theme, level, g.tex); this.scene.add(this.world.group); this.scene.fog = this.world.fog; this.scene.background = new THREE.Color(this.world.theme.fog);
    this.psA = new PS(1400, true); this.psN = new PS(500, false); this.scene.add(this.psA.pts, this.psN.pts);
    if (this.hero === 'caska') {
      this.rig = buildCaska(save.cloakEq); own(this.rig); setCloak(this.rig, save.cloakEq);
      // mapeia os atributos de Caska para a estrutura do jogador
      this.gs = { maxHp: Math.round(this.cs.hp), dmgMul: this.cs.dmg, takeMul: (1 - CASKA_RED), maxStam: Math.round(this.cs.stam), regen: this.cs.regen, rageDur: this.cs.detDur, rageMul: 1.35, rageNeed: 100, rageGain: 1 };
      this.heroSpd = this.cs.spd;
    } else { this.rig = buildGuts(Prof.getProfile().cosm); own(this.rig); setBerserk(this.rig, save.armorEq); }
    this.scene.add(this.rig.root);
    this.p = { x: 0, z: 0, fa: PI, vx: 0, vz: 0, hp: this.gs.maxHp, stam: this.gs.maxStam, rage: 0, rageT: 0, state: 'free', st: 0, atk: null as AtkDef | null, an: '', combo: 0, comboT: 0, buf: '', iframes: 0, ddx: 0, ddz: 0, stamDelay: 0, dead: false, deadT: 0, cannon: 3, cannonCd: 0, bolts: 12, reload: 0, boltCd: 0, healCd: 0, exhausted: false, hitDone: false, recov: 0, shootT: 0, step: 0, hurtT: 0, flashT: 0, block: false, castT: 0, dodgeSpd: 13 };
    this.initInput(); this.syncAllies(); this.applySettings();
    this.setupLevel();
    A.resume(); A.startMusic(this.ld.theme);
    this.resize(); window.addEventListener('resize', this.resize);
    this.cb.msg('m_start', { n: level });
    this.raf = requestAnimationFrame(this.loop);
  }

  envTex: THREE.Texture | null = null;
  setupEnv() {
    try {
      const c = document.createElement('canvas'); c.width = 64; c.height = 32; const x = c.getContext('2d')!;
      const g = x.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, '#2a2e34'); g.addColorStop(0.5, '#3a322c'); g.addColorStop(1, '#0a0806');
      x.fillStyle = g; x.fillRect(0, 0, 64, 32);
      const src = new THREE.CanvasTexture(c); src.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(this.renderer); pm.compileEquirectangularShader();
      this.envTex = pm.fromEquirectangular(src).texture; this.scene.environment = this.envTex; src.dispose(); pm.dispose();
    } catch { /* ambiente opcional */ }
  }
  // ---------- configuração ----------
  applySettings = () => {
    const g = getSettings().gfx, r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * g.res);
    r.shadowMap.enabled = g.shadow > 0; r.shadowMap.type = g.shadow === 1 ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    const s = this.world.sun; const ms = g.shadow === 2 ? 2048 : 1024;
    if (s.shadow.mapSize.x !== ms || s.castShadow !== g.shadow > 0) { s.shadow.map?.dispose(); (s.shadow as any).map = null; s.shadow.mapSize.set(ms, ms); }
    s.castShadow = g.shadow > 0;
    this.cam.far = 280 * g.dist; this.cam.updateProjectionMatrix();
    this.world.fog.density = this.world.baseFog / g.dist;
    s.intensity = this.world.baseSunI * g.light; this.world.hemi.intensity = this.world.baseAmbI * g.light;
    this.fx = g.fx; this.minDt = g.fps ? 1 / g.fps : 0;
    if (g.tex !== this.curTexQ) { this.world.setTex(g.tex); this.curTexQ = g.tex; }
    this.resize();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material) { const mt = m.material as THREE.Material; mt.needsUpdate = true; } });
  };
  resize = () => {
    const w = this.host.clientWidth || 800, h = this.host.clientHeight || 600;
    this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    const sc = this.renderer.domElement.height / (2 * Math.tan((this.cam.fov * PI) / 360)); this.psA.mat.uniforms.sc.value = sc; this.psN.mat.uniforms.sc.value = sc;
  };
  refreshLoadout(save: Save) {
    this.save = save; const old = this.gs.maxHp; this.cs = caskaStats(save.cups, save.cloakEq);
    if (this.hero === 'caska') { this.gs = { maxHp: Math.round(this.cs.hp), dmgMul: this.cs.dmg, takeMul: (1 - CASKA_RED), maxStam: Math.round(this.cs.stam), regen: this.cs.regen, rageDur: this.cs.detDur, rageMul: 1.35, rageNeed: 100, rageGain: 1 }; this.heroSpd = this.cs.spd; setCloak(this.rig, save.cloakEq); }
    else { this.gs = gutsStats(save); setBerserk(this.rig, save.armorEq); }
    this.p.hp = Math.min(this.gs.maxHp, this.p.hp + Math.max(0, this.gs.maxHp - old)); this.p.stam = Math.min(this.p.stam, this.gs.maxStam);
    this.syncAllies();
  }

  // ---------- entrada ----------
  code = (a: string) => getSettings().keys[a];
  down = (a: string) => !this.inputLocked && this.keys.has(this.code(a));
  was = (a: string) => !this.inputLocked && this.pressed.has(this.code(a));
  setInputLocked(b: boolean) { this.inputLocked = b; this.keys.clear(); this.pressed.clear(); if (b && document.pointerLockElement) document.exitPointerLock(); this.last = performance.now(); }
  initInput() {
    window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku); window.addEventListener('blur', this.bl);
    const c = this.renderer.domElement; c.addEventListener('mousedown', this.md); window.addEventListener('mouseup', this.mu); document.addEventListener('mousemove', this.mm);
    c.addEventListener('contextmenu', (e) => e.preventDefault()); document.addEventListener('pointerlockchange', this.plc); document.addEventListener('pointerlockerror', () => { this.noLock = true; });
  }
  kd = (e: KeyboardEvent) => {
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (this.paused) return;
    // Multiplayer: ESC abre menu LOCAL (não pausa o mundo compartilhado)
    if (this.coop && (e.code === this.code('pause') || e.code === 'Escape')) { this.setInputLocked(true); this.cb.pause(true, 'localmenu'); return; }
    if (e.code === this.code('cursor') && !this.inputLocked) { this.toggleCursor(); return; } // G: alternar cursor livre / controle da câmera
    if (this.inputLocked) return;
    this.keys.add(e.code); this.pressed.add(e.code);
    if (this.was('pause') || e.code === 'Escape') { this.setPaused(true); this.cb.pause(true, 'pause'); }
    // loja removida do atalho TAB: compras só no acampamento, com Godo
  };
  ku = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  bl = () => { this.keys.clear(); };
  md = (e: MouseEvent) => {
    if (this.paused || this.inputLocked || this.cursorFree) return; // cursor livre: cliques vão para a interface, não para o combate
    if (!document.pointerLockElement && !this.noLock) { try { (this.renderer.domElement.requestPointerLock() as any)?.catch?.(() => { this.noLock = true; }); } catch { this.noLock = true; } }
    const c = 'Mouse' + e.button; this.keys.add(c); this.pressed.add(c); e.preventDefault(); A.resume();
  };
  mu = (e: MouseEvent) => { this.keys.delete('Mouse' + e.button); };
  mm = (e: MouseEvent) => {
    if (this.paused || this.cine || this.inputLocked || this.cursorFree) return;
    if (document.pointerLockElement || this.noLock) {
      if (!this.lockT) this.yaw -= e.movementX * 0.0026;
      this.pitch = clamp(this.pitch + e.movementY * 0.0022, 0.02, 1.25);
    }
  };
  plc = () => { if (this.coop || this.cursorFree) return; if (!document.pointerLockElement && this.started && !this.paused && !this.p.dead && this.endT < 0) { this.setPaused(true); this.cb.pause(true, 'pause'); } };
  setPaused(b: boolean) {
    this.paused = b; if (b) { this.keys.clear(); if (document.pointerLockElement) document.exitPointerLock(); }
    this.last = performance.now();
  }
  setMinimap(c: HTMLCanvasElement | null) { this.minimap = c; }

  // ---------- fases ----------
  setupLevel() {
    const w = this.world, ld = this.ld;
    // grupos iniciais
    if (ld.kills > 0) {
      const nGroups = Math.min(w.spawnSpots.length, Math.ceil(ld.kills * 0.55 / 2.5));
      for (let i = 0; i < nGroups && this.spawned < ld.kills; i++) {
        const sp = w.spawnSpots[i]; if (Math.hypot(sp.x, sp.z) < 20) continue;
        const n = Math.min(ld.kills - this.spawned, 2 + (i % 2));
        for (let k = 0; k < n; k++) this.spawnEnemy(this.pickId(), sp.x + rnd(-3, 3), sp.z + rnd(-3, 3), false);
      }
    }
    for (let i = 0; i < ld.behelits; i++) { const s = w.behelitSpots[i]; if (!s) continue; const g = makeBehelit(); g.position.set(s.x, 0, s.z); this.scene.add(g); this.behelits.push({ g, hp: 360, max: 360, x: s.x, z: s.z, alive: true }); w.cols.push({ x: s.x, z: s.z, r: 1.1, h: 3 }); }
    w.relicSpots.forEach((s) => { const g = makeRelic(); g.position.set(s.x, 0, s.z); this.scene.add(g); this.relics.push({ g, x: s.x, z: s.z, got: false }); });
    w.watchSpots.forEach((s) => { const r = buildEnemy('apostle'); own(r); r.root.scale.setScalar(2.4); r.root.position.set(s.x, 0, s.z); r.root.rotation.y = Math.atan2(-s.x, -s.z); this.scene.add(r.root); this.watchers.push(r); animate(r, { ...newAS(), t: 0 }); });
    if (this.mode !== 'campaign') {
      // modos extras: limpar spawns/objetivos da campanha
      for (const e of [...this.enemies]) { this.scene.remove(e.rig.root); disposeRig(e.rig); }
      this.enemies.length = 0; this.spawned = 0;
      for (const b of this.behelits) this.scene.remove(b.g); this.behelits.length = 0;
      if (this.mode !== 'dungeon') { for (const r of this.relics) this.scene.remove(r.g); this.relics.length = 0; }
      if (this.mode === 'training') { this.spawnDummies(); TUT.forEach((t) => this.tutDone.add(t)); }
      if (this.mode === 'camp') this.setupCamp();
      if (this.mode === 'defense') { this.setupCamp(true); this.setupDefense(); }
      this.started = true; return;
    }
    if (this.defCam) { // fases 4/8: defesa da vila dentro da campanha
      for (const e of [...this.enemies]) { this.scene.remove(e.rig.root); disposeRig(e.rig); }
      this.enemies.length = 0; this.spawned = 0;
      for (const b of this.behelits) this.scene.remove(b.g); this.behelits.length = 0;
      for (const r of this.relics) this.scene.remove(r.g); this.relics.length = 0;
      this.setupCamp(true); this.setupDefense();
      if (!this.coop && this.save.side.forLvl === this.lv) { this.missionId = this.save.side.mission === 'hunt' ? null : this.save.side.mission; this.bountyId = null; } // nas defesas só valem contratos de proteção/velocidade
      this.started = true; return;
    }
    if (this.lv === 9) { this.spawnBoss(); }
    else { this.p.z = 0; }
    this.setupSecrets();
    // contratos e procurados escolhidos no quadro
    if (!this.coop && this.save.side.forLvl === this.lv) { this.missionId = this.save.side.mission; this.bountyId = this.save.side.bounty; }
    // easter egg escondido da fase (1 por fase)
    if (!this.coop && !this.save.side.eggs.includes(this.lv)) {
      const sp = this.world.spawnSpots[3] || this.world.spawnSpots[0];
      const g = new THREE.Group();
      mk(gBox(0.5, 1.1, 0.14), mat(0x6a655c, { r: 0.95 }), 0, 0.55, 0, g, 0, 0.4, 0.15); // lápide/marco
      mk(gSph(0.14, 8), mat(0xff2a20, { e: 1.4 }), 0.1, 1.02, 0.1, g).castShadow = false;
      g.position.set(sp.x + 2, 0, sp.z + 2); this.scene.add(g);
      this.eggItem = { g, x: sp.x + 2, z: sp.z + 2, got: false };
    }
    // documento colecionável (1 por fase) — galeria
    if (!this.coop && !Prof.getProfile().records.docs.includes('doc' + this.lv)) {
      const sp = this.world.behelitSpots[2] || this.world.spawnSpots[2] || { x: 20, z: 20 };
      const g = new THREE.Group(); mk(gBox(0.5, 0.08, 0.38), mat(0x4a3420, { r: 0.8 }), 0, 0.5, 0, g); mk(gBox(0.44, 0.04, 0.32), mat(0xd8ccae, { r: 0.9 }), 0, 0.56, 0, g); mk(gSph(0.3, 8), mat(0xffe6a0, { e: 0.9, t: 0.14 }), 0, 0.6, 0, g).castShadow = false;
      g.position.set(sp.x, 0, sp.z); this.scene.add(g); this.docItem = { g, x: sp.x, z: sp.z, got: false };
    }
    this.started = true;
  }
  // ---------- acampamento central ----------
  setupCamp(defense = false) {
    const stage = campStage(this.save), w = this.world;
    // aplica a transformação narrativa do ambiente (tensão/Eclipse)
    const tint = STAGE_TINT[stage];
    if (tint > 0 && this.ld.theme !== 'eclipse') { w.eclipse(tint); this.applyLightK(); }
    // ---- limpar o miolo do mapa procedural: a vila é construída à mão ----
    const CLEAR = 27, m4 = new THREE.Matrix4(), v3 = new THREE.Vector3();
    w.group.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if ((im as any).isInstancedMesh) {
        for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m4); v3.setFromMatrixPosition(m4); if (Math.hypot(v3.x, v3.z) < CLEAR) { m4.makeTranslation(0, -200, 0); im.setMatrixAt(i, m4); } }
        im.instanceMatrix.needsUpdate = true;
      }
    });
    for (const ch of w.group.children) if ((ch as any).isGroup && Math.hypot(ch.position.x, ch.position.z) < CLEAR && (ch.position.x || ch.position.z)) ch.visible = false;
    w.fires = w.fires.filter((f) => Math.hypot(f.x, f.z) >= CLEAR);
    w.cols = w.cols.filter((c) => Math.hypot(c.x, c.z) >= CLEAR);

    // ---- materiais e utilitários ----
    const stone = mat(0x6a655c, { r: 0.95 }), woodM = mat(0x4a3220, { r: 0.9 }), dirt = mat(0x4b3b29, { r: 1 }), steelM = mat(0x8a9099, { r: 0.35, m: 0.85 });
    const hay = mat(0xb8a04a, { r: 1 }), thatch = mat(0x8a6f3a, { r: 1 });
    const crate = (x: number, z: number, s = 1, ry = 0.3) => { mk(gBox(0.7 * s, 0.7 * s, 0.7 * s), woodM, x, 0.35 * s, z, undefined, 0, ry, 0); };
    const barrel = (x: number, z: number) => { mk(gCyl(0.33, 0.38, 0.85, 10), mat(0x5a4330, { r: 0.9 }), x, 0.42, z); mk(gCyl(0.36, 0.36, 0.06, 10), mat(0x2a2a2e, { r: 0.5, m: 0.6 }), x, 0.5, z); };
    const trailSeg = (x1: number, z1: number, x2: number, z2: number, wide = 1) => {
      const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), n = Math.ceil(L / 2), ux = dx / L, uz = dz / L, ang = Math.atan2(dx, dz);
      for (let i = 0; i <= n; i++) {
        const k = i / n, wob = Math.sin(i * 1.7 + x1) * 0.7;
        const m = mk(gBox((1.5 + (i % 2) * 0.4) * wide, 0.035, 2.4), dirt, x1 + dx * k - uz * wob, 0.018, z1 + dz * k + ux * wob, undefined, 0, ang + Math.sin(i * 2.3) * 0.13, 0);
        m.castShadow = false; m.receiveShadow = true;
        if (i % 3 === 1) mk(gSph(0.09, 6), stone, x1 + dx * k - uz * (wob + 1.1 * wide), 0.05, z1 + dz * k + ux * (wob + 1.1 * wide)).castShadow = false;
      }
    };
    const fenceLine = (x1: number, z1: number, x2: number, z2: number) => {
      const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.round(L / 1.6)), ang = Math.atan2(x2 - x1, z2 - z1);
      for (let i = 0; i <= n; i++) { const k = i / n; mk(gBox(0.1, 0.9, 0.1), woodM, x1 + (x2 - x1) * k, 0.45, z1 + (z2 - z1) * k); }
      mk(gBox(0.06, 0.08, L), woodM, (x1 + x2) / 2, 0.72, (z1 + z2) / 2, undefined, 0, ang, 0);
      mk(gBox(0.06, 0.08, L), woodM, (x1 + x2) / 2, 0.38, (z1 + z2) / 2, undefined, 0, ang, 0);
      this.world.cols.push({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, hx: 0.15, hz: L / 2, ry: ang, h: 0.9 });
    };
    const lantern = (x: number, z: number) => { mk(gBox(0.09, 2, 0.09), woodM, x, 1, z); const l = mk(gBox(0.22, 0.26, 0.22), mat(0xffc860, { e: 1.8 }), x, 1.95, z); l.castShadow = false; mk(gBox(0.28, 0.06, 0.28), dark0, x, 2.12, z); };
    const dark0 = mat(0x1a140e, { r: 0.9 });
    const bench = (x: number, z: number, ry: number) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.scene.add(g); mk(gBox(1.4, 0.08, 0.4), woodM, 0, 0.42, 0, g); mk(gBox(0.1, 0.42, 0.34), woodM, -0.55, 0.21, 0, g); mk(gBox(0.1, 0.42, 0.34), woodM, 0.55, 0.21, 0, g); };
    const vtree = (x: number, z: number, s = 1) => { mk(gCyl(0.2 * s, 0.3 * s, 2.6 * s, 7), mat(0x4a3220), x, 1.3 * s, z); mk(gCone(1.6 * s, 3 * s, 7), mat(0x3a5a2a, { r: 1 }), x, 3.4 * s, z); mk(gCone(1.2 * s, 2.4 * s, 7), mat(0x3a5a2a, { r: 1 }), x, 4.6 * s, z); this.world.cols.push({ x, z, r: 0.45 * s, h: 5 }); };
    // casa de vila com variações (madeira/pedra, telhado, chaminé, quintal)
    const house = (x: number, z: number, ry: number, o: { w?: number; d?: number; stoneBase?: boolean; roof?: number; chimney?: boolean; col?: number } = {}) => {
      const W = o.w ?? 3.6, D = o.d ?? 3, H = 2.2;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.scene.add(g);
      const wallM = mat(o.col ?? 0x6a5340, { r: 0.95 });
      if (o.stoneBase) mk(gBox(W + 0.15, 0.7, D + 0.15), stone, 0, 0.35, 0, g);
      mk(gBox(W, H, D), wallM, 0, H / 2 + (o.stoneBase ? 0.3 : 0), 0, g);
      const roof = mk(gCone(Math.hypot(W, D) * 0.62, 1.5, 4), mat(o.roof ?? 0x5a3a28, { r: 1 }), 0, H + (o.stoneBase ? 0.3 : 0) + 0.75, 0, g, 0, PI / 4, 0); roof.scale.z = D / W;
      mk(gBox(0.75, 1.4, 0.06), dark0, W * 0.18, 0.7 + (o.stoneBase ? 0.3 : 0), D / 2 + 0.01, g); // porta
      mk(gBox(0.5, 0.5, 0.05), mat(0x2a2016, { e: 0.35, ec: 0xffc860 }), -W * 0.25, 1.4, D / 2 + 0.01, g); // janela iluminada
      if (o.chimney) mk(gBox(0.4, 1.3, 0.4), stone, -W * 0.3, H + 1.1, -D * 0.2, g);
      this.world.cols.push({ x, z, hx: W / 2 + 0.1, hz: D / 2 + 0.1, ry, h: H + 1 });
      return g;
    };

    // ================= ENTRADA DA VILA (sul) =================
    trailSeg(0, 34, 0, 20, 1.3);              // estrada vindo de fora
    trailSeg(0, 20, -0.8, 6, 1.3);            // rua principal (leve curva)
    trailSeg(-0.8, 6, 0, -2, 1.2);            // chegada à praça
    trailSeg(1, 16, 7, 11.5);                 // desvio para a oficina
    trailSeg(-1, 4, -11, 6);                  // ruela do bairro residencial
    trailSeg(2, 2, 17, 4);                    // caminho da área agrícola
    trailSeg(0, -6, 0, -10, 0.9);             // caminho de pedra até a igreja
    trailSeg(-5, 1, BOARD.x, BOARD.z, 0.8);
    { // pórtico simples de madeira
      mk(gBox(0.22, 3, 0.22), woodM, -2.2, 1.5, 24); mk(gBox(0.22, 3, 0.22), woodM, 2.2, 1.5, 24);
      mk(gBox(5, 0.3, 0.26), woodM, 0, 3, 24); mk(gBox(1.6, 0.6, 0.06), mat(0x7a5c38, { r: 0.9 }), 0, 2.45, 24);
      this.world.cols.push({ x: -2.2, z: 24, r: 0.25, h: 3 }, { x: 2.2, z: 24, r: 0.25, h: 3 });
      fenceLine(-2.4, 24, -7, 22); fenceLine(2.4, 24, 7.5, 22.5);
      // carroça com feno
      const cart = new THREE.Group(); cart.position.set(-4.5, 0, 20); cart.rotation.y = 0.5; this.scene.add(cart);
      mk(gBox(2, 0.5, 1.1), woodM, 0, 0.75, 0, cart); mk(gCyl(0.45, 0.45, 0.12, 10), dark0, -0.7, 0.45, 0.6, cart, PI / 2); mk(gCyl(0.45, 0.45, 0.12, 10), dark0, 0.7, 0.45, 0.6, cart, PI / 2);
      mk(gCyl(0.45, 0.45, 0.12, 10), dark0, -0.7, 0.45, -0.6, cart, PI / 2); mk(gCyl(0.45, 0.45, 0.12, 10), dark0, 0.7, 0.45, -0.6, cart, PI / 2);
      mk(gBox(1.7, 0.5, 0.9), hay, 0, 1.2, 0, cart);
      this.world.cols.push({ x: -4.5, z: 20, r: 1.3, h: 1.6 });
      barrel(3.4, 21); barrel(4.1, 20.4); crate(3.8, 19.3, 0.8, 0.5); mk(gBox(1, 0.7, 1), hay, 5.2, 0.35, 21.5, undefined, 0, 0.4, 0);
      lantern(2.6, 24.6); lantern(-2.6, 24.6);
    }
    // abrigo de Guts perto da entrada (tenda robusta + suporte da Dragon Slayer + alvos)
    { const g = new THREE.Group(); g.position.set(4.5, 0, 17.5); g.rotation.y = -0.4; this.scene.add(g);
      const tm = mk(gCone(2.3, 2.5, 4), mat(0x2a2420, { r: 1 }), 0, 1.25, 0, g, 0, PI / 4, 0); tm.scale.z = 1.35;
      this.world.cols.push({ x: 4.5, z: 17.5, r: 1.9, h: 2.6 });
      const rack = new THREE.Group(); rack.position.set(6.6, 0, 15.8); rack.rotation.y = -0.5; this.scene.add(rack);
      mk(gBox(0.16, 1.5, 0.16), woodM, -0.7, 0.75, 0, rack); mk(gBox(0.16, 1.5, 0.16), woodM, 0.7, 0.75, 0, rack);
      const ds = dragonSlayer(); ds.rotation.z = PI / 2 - 0.12; ds.position.set(1.15, 1.25, 0); ds.scale.setScalar(0.9); rack.add(ds);
      this.world.cols.push({ x: 6.6, z: 15.8, r: 0.9, h: 1.6 });
      const x0 = 7.6, z0 = 18.6; mk(gCyl(0.12, 0.14, 1.7), woodM, x0, 0.85, z0); mk(gBox(0.9, 0.16, 0.16), woodM, x0, 1.45, z0); mk(gSph(0.22, 8), mat(0xb8a078, { r: 1 }), x0, 1.75, z0); this.world.cols.push({ x: x0, z: z0, r: 0.35, h: 1.8 });
    }

    // ================= OFICINA DO GODO (rua principal) =================
    { const g = new THREE.Group(); g.position.set(8, 0, 11.5); g.rotation.y = -2.2; this.scene.add(g);
      mk(gBox(4.6, 2.4, 0.3), mat(0x5a4a38, { r: 0.95 }), 0, 1.2, -1.9, g); mk(gBox(0.3, 2.4, 3.6), mat(0x5a4a38, { r: 0.95 }), -2.2, 1.2, 0, g); mk(gBox(0.3, 2.4, 3.6), stone, 2.2, 1.2, 0, g);
      mk(gBox(5.4, 0.25, 4.6), woodM, 0, 2.6, 0, g, 0, 0, 0.07);
      mk(gBox(0.5, 1.6, 0.5), stone, 1.6, 3.2, -1.2, g); // chaminé
      mk(gBox(0.9, 0.5, 0.5), stone, -0.6, 0.55, 0.4, g); mk(gBox(0.6, 0.3, 0.6), mat(0x2a2a2e, { r: 0.4, m: 0.7 }), -0.6, 0.95, 0.4, g); // bigorna
      const emb = mk(gBox(1.1, 0.5, 1.1), mat(0xff5a10, { e: 1.6 }), 0.9, 0.3, 0.3, g); emb.castShadow = false;
      const fl = new THREE.PointLight(0xff7a30, 10, 10, 1.8); fl.position.set(0.9, 1, 0.3); g.add(fl);
      this.world.cols.push({ x: 8, z: 13.2, hx: 2.3, hz: 0.3, ry: -2.2, h: 2.6 }, { x: 6.3, z: 10.4, r: 0.5, h: 2.6 }, { x: 9.8, z: 12.8, r: 0.5, h: 2.6 });
      // bancada do Rickert + materiais
      mk(gBox(1.6, 0.1, 0.7), woodM, 10.6, 0.8, 8.8, undefined, 0, -0.4, 0); mk(gBox(0.12, 0.8, 0.12), woodM, 10, 0.4, 9); mk(gBox(0.12, 0.8, 0.12), woodM, 11.2, 0.4, 8.6);
      mk(gBox(0.3, 0.06, 0.2), steelM, 10.4, 0.88, 8.9); mk(gCyl(0.03, 0.03, 0.4, 6), steelM, 10.8, 0.9, 8.7, undefined, 0, 0, 1.2);
      crate(11.8, 10.6, 0.9, 0.7); crate(12.2, 11.5, 0.7, 0.1); barrel(5.4, 13.6);
      mk(gBox(1.2, 0.5, 0.8), woodM, 11.6, 0.25, 12.6, undefined, 0, 0.5, 0); mk(gBox(0.8, 0.3, 0.6), dark0, 11.6, 0.65, 12.6, undefined, 0, 0.5, 0); // lenha e carvão
      const wr = new THREE.Group(); wr.position.set(5.2, 0, 9.6); wr.rotation.y = 1; this.scene.add(wr);
      mk(gBox(0.12, 1.2, 0.12), woodM, -0.5, 0.6, 0, wr); mk(gBox(0.12, 1.2, 0.12), woodM, 0.5, 0.6, 0, wr); mk(gBox(1.1, 0.1, 0.1), woodM, 0, 1.1, 0, wr);
    }

    // ================= PRAÇA CENTRAL =================
    { const pl = mk(gCyl(7.2, 7.2, 0.05, 28), dirt, 0, 0.012, -1); pl.castShadow = false; pl.receiveShadow = true;
      // poço
      const wx = 3, wz = -1; mk(gCyl(0.9, 1, 0.9, 10), stone, wx, 0.45, wz); mk(gCyl(0.7, 0.7, 0.2, 10), mat(0x0c0a08), wx, 0.95, wz);
      mk(gBox(0.12, 1.6, 0.12), woodM, wx - 0.8, 0.8, wz); mk(gBox(0.12, 1.6, 0.12), woodM, wx + 0.8, 0.8, wz);
      mk(gCone(1.2, 0.8, 4), thatch, wx, 1.95, wz, undefined, 0, PI / 4, 0);
      this.world.cols.push({ x: wx, z: wz, r: 1.1, h: 1.6 });
      bench(-3, 1.5, 0.6); bench(4.8, -4.2, -2.2); bench(-4.4, -5, 1.8);
      lantern(-5.6, -1); lantern(5.6, 1.5); lantern(0.5, 4.5);
      vtree(-4.5, -3, 1.1); vtree(5.8, -6.5, 0.9);
      crate(-6.2, 1.8, 0.7, 0.8); barrel(6.4, -0.5);
    }

    // ================= IGREJA (norte da praça) =================
    { const g = new THREE.Group(); g.position.set(0, 0, -13); this.scene.add(g);
      const cw = mat(0x7a7468, { r: 0.95 });
      mk(gBox(7.4, 0.18, 9.4), stone, 0, 0.09, 0, g); // base levemente elevada
      mk(gBox(7, 3.4, 0.4), cw, 0, 1.7, -4.3, g);                       // fundo
      mk(gBox(0.4, 3.4, 8.6), cw, -3.3, 1.7, 0, g); mk(gBox(0.4, 3.4, 8.6), cw, 3.3, 1.7, 0, g); // laterais
      mk(gBox(2.3, 3.4, 0.4), cw, -2.3, 1.7, 4.3, g); mk(gBox(2.3, 3.4, 0.4), cw, 2.3, 1.7, 4.3, g); // frente com vão da porta
      mk(gBox(2.4, 0.9, 0.4), cw, 0, 2.95, 4.3, g);                     // verga da porta
      const rf = mk(gCone(5.3, 2.6, 4), mat(0x4a3428, { r: 1 }), 0, 4.7, 0, g, 0, PI / 4, 0); rf.scale.z = 1.35;
      // torre do sino
      mk(gBox(1.6, 2.8, 1.6), cw, 0, 4.8, -3, g); mk(gCone(1.4, 1.4, 4), mat(0x4a3428, { r: 1 }), 0, 6.9, -3, g, 0, PI / 4, 0);
      mk(gSph(0.3, 8), mat(0xc9a13a, { r: 0.4, m: 0.8 }), 0, 5.6, -3, g); // sino
      mk(gBox(0.5, 0.9, 0.06), mat(0xffd890, { e: 0.6 }), 0, 2.2, -4.28, g); // vitral simples
      // interior: bancos, altar, velas
      for (let i = 0; i < 3; i++) { mk(gBox(1.9, 0.1, 0.4), woodM, -1.4, 0.55, 2.4 - i * 1.4, g); mk(gBox(1.9, 0.1, 0.4), woodM, 1.4, 0.55, 2.4 - i * 1.4, g); }
      mk(gBox(1.6, 0.9, 0.7), stone, 0, 0.55, -3.3, g); mk(gBox(0.16, 0.9, 0.06), mat(0xc9a13a, { r: 0.4, m: 0.8 }), 0, 1.6, -3.3, g); mk(gBox(0.5, 0.16, 0.06), mat(0xc9a13a, { r: 0.4, m: 0.8 }), 0, 1.75, -3.3, g);
      for (const sx of [-1, 1]) { mk(gCyl(0.05, 0.06, 0.4, 6), mat(0xe8e0d0), sx * 0.9, 0.3, -3.1, g); mk(gSph(0.05, 6), mat(0xffb060, { e: 2.4 }), sx * 0.9, 0.56, -3.1, g).castShadow = false; }
      const il = new THREE.PointLight(0xffc880, 8, 11, 1.8); il.position.set(0, 2.2, -1.5); g.add(il);
      this.world.cols.push(
        { x: 0, z: -17.3, hx: 3.5, hz: 0.3, ry: 0, h: 4 }, { x: -3.3, z: -13, hx: 0.3, hz: 4.3, ry: 0, h: 4 }, { x: 3.3, z: -13, hx: 0.3, hz: 4.3, ry: 0, h: 4 },
        { x: -2.3, z: -8.7, hx: 1.15, hz: 0.3, ry: 0, h: 4 }, { x: 2.3, z: -8.7, hx: 1.15, hz: 0.3, ry: 0, h: 4 },
        { x: 0, z: -16.3, r: 1, h: 1.5 },
      );
    }

    // ================= CASAS =================
    house(-8.5, -7.5, 1.2, { stoneBase: true, chimney: true, col: 0x60492f }); // casa de comando de Caska
    { mk(gCyl(0.05, 0.06, 3.2), woodM, -6.6, 1.6, -6, undefined); mk(gBox(0.8, 1.1, 0.03), mat(0xe8e4dc, { r: 0.9 }), -6.2, 2.4, -6); } // estandarte do Falcão
    house(11.5, -5.5, -1.6, { col: 0x5c5340, roof: 0x4a4434 });               // casa de Serpico
    { const wr2 = new THREE.Group(); wr2.position.set(9.9, 0, -2.6); wr2.rotation.y = 0.6; this.scene.add(wr2); mk(gBox(0.12, 1.2, 0.12), woodM, -0.5, 0.6, 0, wr2); mk(gBox(0.12, 1.2, 0.12), woodM, 0.5, 0.6, 0, wr2); mk(gBox(1.1, 0.1, 0.1), woodM, 0, 1.1, 0, wr2); }
    house(-12.5, 5.5, 0.9, { col: 0x6a5c48, chimney: true });                 // casa de Farnese
    { mk(gBox(1, 0.08, 0.6), woodM, -10.6, 0.6, 4.4, undefined, 0, 0.5, 0); mk(gBox(0.2, 0.06, 0.15), mat(0x3a2414, { r: 0.8 }), -10.8, 0.68, 4.3); mk(gBox(0.18, 0.05, 0.13), mat(0x6a1f2f, { r: 0.8 }), -10.4, 0.67, 4.5, undefined, 0, 0.7, 0); }
    // bairro residencial (oeste) — casas variadas com quintais
    house(-10, 10.5, 0.4, { w: 3, d: 2.6, col: 0x705a42 });
    house(-14.5, 9, 1.1, { w: 3.2, d: 2.8, stoneBase: true, col: 0x5a4c3a, roof: 0x4f3a2a });
    house(-16, -1, 1.7, { w: 3.4, d: 2.8, chimney: true, col: 0x655038 });
    house(-7, -14.5, 0.2, { w: 3.2, d: 2.6, col: 0x6a5340 });                  // casas ao norte
    house(7.5, -13.5, -0.3, { w: 3.4, d: 2.8, stoneBase: true, col: 0x5f4e3c });
    fenceLine(-9, 12.5, -13.5, 11.5); fenceLine(-16.5, 7, -17.5, 2.5);
    { mk(gBox(1.2, 0.5, 0.8), woodM, -12.8, 0.25, 7.6, undefined, 0, 0.4, 0); // lenha
      mk(gBox(0.03, 1.2, 0.03), woodM, -8.8, 0.6, 8.8); mk(gBox(0.03, 1.2, 0.03), woodM, -6.6, 0.6, 9.4); mk(gBox(2.2, 0.02, 0.02), mat(0xd8ccae), -7.7, 1.15, 9.1, undefined, 0, 0.25, 0);
      mk(gBox(0.5, 0.7, 0.03), mat(0xb8c0c8, { r: 0.9 }), -7.3, 0.85, 9.2, undefined, 0, 0.25, 0); mk(gBox(0.45, 0.6, 0.03), mat(0x8a6a50, { r: 0.9 }), -8.1, 0.8, 9, undefined, 0, 0.25, 0); } // varal
    crate(-9.4, 11.6, 0.7, 0.2); barrel(-14, 10.6);

    // ================= ÁREA AGRÍCOLA (leste) =================
    { const field = (fx: number, fz: number, fw: number, fd: number, ry: number) => {
        const g = new THREE.Group(); g.position.set(fx, 0, fz); g.rotation.y = ry; this.scene.add(g);
        const soil = mk(gBox(fw, 0.08, fd), mat(0x3a2c1c, { r: 1 }), 0, 0.04, 0, g); soil.castShadow = false;
        const rows = Math.floor(fd / 0.8);
        for (let r2 = 0; r2 < rows; r2++) for (let c2 = 0; c2 < Math.floor(fw / 0.9); c2++) mk(gCone(0.1, 0.34, 5), mat(0x4f7a30, { r: 1 }), -fw / 2 + 0.6 + c2 * 0.9, 0.22, -fd / 2 + 0.5 + r2 * 0.8, g).castShadow = false;
      };
      field(18, 6.5, 5, 3.6, 0.15); field(22, 1.5, 4, 3, -0.1);
      fenceLine(15, 9, 21.5, 9.5); fenceLine(21.5, 9.5, 24.5, 4);
      // celeiro
      const barn = new THREE.Group(); barn.position.set(19.5, 0, -2); barn.rotation.y = -2.6; this.scene.add(barn);
      mk(gBox(4.4, 2.6, 3.4), mat(0x6a4432, { r: 0.95 }), 0, 1.3, 0, barn); const br = mk(gCone(3.4, 1.8, 4), thatch, 0, 3.5, 0, barn, 0, PI / 4, 0); br.scale.z = 0.85;
      mk(gBox(1.4, 1.8, 0.06), dark0, 0, 0.9, 1.72, barn);
      this.world.cols.push({ x: 19.5, z: -2, hx: 2.3, hz: 1.8, ry: -2.6, h: 3 });
      mk(gBox(1, 0.7, 1), hay, 16.6, 0.35, -0.6, undefined, 0, 0.6, 0); mk(gBox(0.9, 0.6, 0.9), hay, 17.5, 0.3, -1.4);
      crate(21.5, -4.2, 0.9, 0.4); barrel(22.3, -3.2);
      // cercado dos animais + galinhas
      fenceLine(14.5, 3, 17.5, 1); fenceLine(17.5, 1, 16.5, -1.8); fenceLine(16.5, -1.8, 13.5, -0.5); fenceLine(13.5, -0.5, 14.5, 3);
      for (let i = 0; i < 3; i++) { const hx2 = 15.2 + i * 0.8, hz2 = 0.8 - i * 0.7; const hen = new THREE.Group(); hen.position.set(hx2, 0, hz2); this.scene.add(hen);
        mk(gSph(0.16, 8), mat(0xe8e2d4, { r: 1 }), 0, 0.2, 0, hen).scale.set(1, 0.85, 1.25); mk(gSph(0.09, 6), mat(0xe8e2d4, { r: 1 }), 0, 0.37, 0.16, hen); mk(gCone(0.03, 0.08, 4), mat(0xd08030), 0, 0.36, 0.26, hen, 1.3); mk(gBox(0.03, 0.05, 0.03), mat(0xc03028), 0, 0.44, 0.14, hen);
        this.hens.push({ g: hen, t: i * 2.1 }); }
    }

    // ================= GRIFFITH / BORDAS =================
    if (this.save.secret.g1 || this.save.secret.g2) {
      mk(gCyl(0.06, 0.08, 3.6), woodM, -19, 1.8, -8.4); mk(gBox(0.9, 1.2, 0.03), mat(0xf0ede4, { r: 0.9 }), -18.6, 2.8, -8.4);
      mk(gCyl(0.3, 0.22, 0.5, 8), stone, -17, 0.25, -5.8); const fl2 = mk(gCone(0.2, 0.5, 6), mat(0xff8a30, { e: 2.2, t: 0.9 }), -17, 0.75, -5.8); fl2.castShadow = false;
    }
    { // cabana de magia de Schierke na orla
      const g = new THREE.Group(); g.position.set(-17.5, 0, -12.5); g.rotation.y = 0.9; this.scene.add(g);
      const tm2 = mk(gCone(2.2, 2.4, 4), mat(0x4a3a6a, { r: 1 }), 0, 1.2, 0, g, 0, PI / 4, 0); tm2.scale.z = 1.3;
      this.world.cols.push({ x: -17.5, z: -12.5, r: 1.8, h: 2.5 });
      const circ = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 32), new THREE.MeshBasicMaterial({ color: 0x9a7aff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      circ.rotation.x = -PI / 2; circ.position.set(-15.4, 0.04, -10.6); this.scene.add(circ);
      for (let i = 0; i < 3; i++) { const a = i * 2.1, cx2 = -15.4 + Math.sin(a) * 1.3, cz2 = -10.6 + Math.cos(a) * 1.3; mk(gCyl(0.05, 0.06, 0.3, 6), mat(0xe8e0d0, { r: 0.9 }), cx2, 0.15, cz2); mk(gSph(0.05, 6), mat(0xffb060, { e: 2.4 }), cx2, 0.36, cz2).castShadow = false; }
    }
    { // cantinho do Puck na árvore da praça
      const mush = (x: number, z: number, s: number) => { mk(gCyl(0.05 * s, 0.07 * s, 0.22 * s, 6), mat(0xe8dcc0, { r: 0.9 }), x, 0.11 * s, z); mk(gCone(0.16 * s, 0.14 * s, 8), mat(0xa03028, { r: 0.8 }), x, 0.27 * s, z); };
      mush(-5, -2.2, 1); mush(-4.6, -2.9, 0.7); mush(-3.9, -2, 1.2);
      for (let i = 0; i < 4; i++) mk(gSph(0.05, 6), mat([0xffd0e0, 0xc8e8ff, 0xfff0b0][i % 3], { e: 0.9 }), -4.4 + Math.sin(i * 2.2) * 0.7, 0.07, -1.8 + Math.cos(i * 1.7) * 0.7).castShadow = false;
    }
    // vegetação de transição nas bordas da vila (esconde o limite)
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + 0.2, d = 24 + (i % 3) * 1.5; vtree(Math.sin(a) * d, Math.cos(a) * d - 2, 0.8 + (i % 3) * 0.25); }
    // círculo de partida
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.1, 40), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -PI / 2; ring.position.set(DEPART.x, 0.1, DEPART.z); this.scene.add(ring); this.departFx = ring;
    const stones = new THREE.Group(); this.scene.add(stones);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; mk(gBox(0.35, 0.5, 0.35), stone, DEPART.x + Math.sin(a) * 2.6, 0.25, DEPART.z + Math.cos(a) * 2.6, stones, 0, a, 0); }
    // quadro de missões (placa de madeira)
    const bg = new THREE.Group(); bg.position.set(BOARD.x, 0, BOARD.z); bg.rotation.y = PI; this.scene.add(bg);
    mk(gCyl(0.08, 0.1, 2.6), woodM, -1, 1.3, 0, bg); mk(gCyl(0.08, 0.1, 2.6), woodM, 1, 1.3, 0, bg);
    mk(gBox(2.6, 1.5, 0.08), mat(0x5a4330, { r: 0.95 }), 0, 1.9, 0, bg);
    for (let i = 0; i < 4; i++) mk(gBox(0.4, 0.5, 0.02), mat(0xd8ccae, { r: 0.9 }), -0.9 + i * 0.6, 1.95 + (i % 2) * 0.15, 0.06, bg, 0, 0, (i % 3 - 1) * 0.08);
    this.world.cols.push({ x: BOARD.x, z: BOARD.z, hx: 1.3, hz: 0.15, ry: 0, h: 2.6 });
    // baús escondidos (easter eggs do acampamento) — lista própria, fora dos NPCs animados
    CAMP_EGGS.forEach((c, i) => {
      if (this.save.side.campEggs.includes(i)) return;
      const g = new THREE.Group(); g.position.set(c.x, 0, c.z); this.scene.add(g);
      mk(gBox(0.7, 0.4, 0.45), woodM, 0, 0.2, 0, g); mk(gBox(0.72, 0.12, 0.47), mat(0x8a7030, { r: 0.5, m: 0.5 }), 0, 0.42, 0, g);
      this.chests.push({ g, x: c.x, z: c.z, i });
    });
    if (defense) { this.p.x = 0; this.p.z = 2; this.p.fa = PI; return; } // defesa da vila: sem NPCs civis fora da igreja
    // NPCs presentes: Godo, Caska (se Guts), aliados, sacerdote, vigia e moradores
    const bld: Record<string, () => Rig> = {
      godo: buildGodo, caska: () => buildCaska(this.save.cloakEq), puck: buildPuck, serpico: buildSerpico, schierke: buildSchierke, farnese: buildFarnese, roderick: buildRoderick,
      griffith1: () => buildGriffith('human'), griffith2: () => buildGriffith('femto'), guts: buildGuts, ivalera: buildIvalera, rickert: buildRickert, skull: buildSkullKnight,
      priest: () => humanoid({ skin: 0xd8b896, cloth: 0x3a342c, tabard: 0xd8d0bc, hair: 0xb8b0a0, hairStyle: 'short', height: 0.95, boots: 0x2a2018, legs: 0x3a342c }),
      guard: () => buildEnemy('soldier'), isidro: buildIsidro,
    };
    for (const sp of NPC_SPOTS) {
      if (sp.id === 'caska' && this.hero === 'caska') continue;       // Caska é a jogadora: só existe a instância controlada
      if (sp.id === 'guts' && this.hero !== 'caska') continue;        // Guts NPC só quando Caska é a protagonista (instância única)
      if ((sp.id === 'griffith1' && (!this.save.secret.g1 || this.save.secret.g2)) || (sp.id === 'griffith2' && !this.save.secret.g2)) continue; // pós-Behelit substitui a versão normal
      if (sp.id === 'skull' && stage === 'early') continue;           // o Cavaleiro aparece quando a escuridão se aproxima
      if (sp.id === 'isidro' && !this.save.allies.includes('isidro')) continue; // Isidro só após a Fase 4
      if (!bld[sp.id]) continue;
      const rig = bld[sp.id](); own(rig);
      rig.root.position.set(sp.x, sp.id === 'puck' ? 1.6 : 0, sp.z); rig.root.rotation.y = sp.fa; this.scene.add(rig.root);
      this.npcs.push({ id: sp.id, rig, as: newAS(), x: sp.x, z: sp.z, fa: sp.fa });
      if (sp.id !== 'puck') this.world.cols.push({ x: sp.x, z: sp.z, r: 0.5, h: 2 });
    }
    if (this.hero === 'caska') { const iv = NPC_SPOTS.find((s) => s.id === 'puck')!; const rig = buildIvalera(); own(rig); rig.root.position.set(iv.x, 1.6, iv.z); this.scene.add(rig.root); this.npcs.push({ id: 'ivalera', rig, as: newAS(), x: iv.x, z: iv.z, fa: iv.fa }); }
    // moradores que circulam em pequenas áreas próprias
    const palettes = [[0x6a5340, 0x4a5a3a], [0x5a4a5a, 0x3a4a5a], [0x7a5a3a, 0x5a3a2a], [0x4a5a4a, 0x6a5a40], [0x5c4c44, 0x44504a]];
    VILLAGERS.forEach((v, i) => {
      const [c1, c2] = palettes[i % palettes.length];
      const rig = humanoid({ skin: [0xd8b090, 0xc9a080, 0xe0c0a0][i % 3], cloth: c1, legs: c2, boots: 0x3a2a1a, hair: [0x3a2a18, 0x6a5a40, 0x2a2018][i % 3], hairStyle: i % 2 ? 'short' : 'long', height: v.kid ? 0.68 : 0.94 + (i % 3) * 0.03, bulk: v.kid ? 0.8 : 0.95 });
      own(rig); rig.root.position.set(v.x, 0, v.z); this.scene.add(rig.root);
      const n: any = { id: 'vil' + i, rig, as: newAS(), x: v.x, z: v.z, fa: rnd(0, TAU) };
      n.wander = { hx: v.x, hz: v.z, r: v.r, tx: v.x, tz: v.z, wait: rnd(1, 3) };
      this.npcs.push(n);
    });
    // Guts surge na rua principal, perto da entrada, olhando para a vila
    this.p.x = 0.5; this.p.z = 21; this.p.fa = PI;
  }
  // ---------- DEFESA DA VILA (tower defense em camadas) ----------
  static ENTR: { id: string; x: number; z: number; route: [number, number][] }[] = [
    { id: 'S', x: 0, z: 30, route: [[0, 21], [-0.8, 12], [0, -1], [0, -6.6]] },
    { id: 'E', x: 25, z: 3, route: [[16, 2.5], [8, 0.5], [2.5, -2], [0, -6.6]] },
    { id: 'W', x: -25, z: 2, route: [[-16, 2.5], [-8, 0.5], [-2.5, -2], [0, -6.6]] },
    { id: 'N', x: 15, z: -19, route: [[9, -13], [4.5, -9], [1.5, -7], [0, -6.6]] },
  ];
  static POSTS: [number, number][] = [[-2.5, 19.5], [2.5, 19.5], [14.5, 2.5], [8.5, -0.5], [-14.5, 2.5], [-8.5, -0.5], [-3, -4.2], [3, -4.2]];
  // posições temáticas e espelhadas dos aliados na defesa (função → área)
  static DEF_SPOTS: Record<string, { x: number; z: number; fa: number }> = {
    isidro: { x: 5.5, z: 14.5, fa: 0.2 },    // circulação/treino, perto da entrada sul
    serpico: { x: -9.5, z: 8.5, fa: 0.6 },   // área aberta oeste, entre entrada e centro
    caska: { x: 10, z: 7, fa: -0.7 },        // posição espelhada a leste
    farnese: { x: -6, z: -3.5, fa: 2.4 },    // observação na beira da praça, perto da igreja
    roderick: { x: 15.5, z: 1, fa: -1.8 },   // área de suprimentos/celeiro
    gutsai: { x: -2.5, z: 16, fa: 3.0 },     // entrada principal
  };
  // procura um ponto livre próximo (evita sobreposição com outros NPCs, jogador e colisores)
  freeSpot(x: number, z: number, minD = 2.6): { x: number; z: number } {
    const others: { x: number; z: number }[] = [
      ...this.defNpcs, ...this.npcs, ...this.allies, { x: this.p.x, z: this.p.z },
      ...(this.defs.schierke ? [{ x: 0, z: -6 }] : []),
    ];
    for (let r = 0; r < 7; r++) {
      const steps = r === 0 ? 1 : 8;
      for (let k = 0; k < steps; k++) {
        const a2 = (k / steps) * TAU + r * 0.7, nx = x + Math.sin(a2) * r * 1.3, nz = z + Math.cos(a2) * r * 1.3;
        if (others.some((o) => Math.hypot(o.x - nx, o.z - nz) < minD)) continue;
        if (blocked(this.world.cols, nx, nz, 0.6)) continue;
        return { x: nx, z: nz };
      }
    }
    return { x, z };
  }
  setupDefense() {
    // barreira de Schierke na entrada da igreja
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 12, 0, TAU, 0, PI / 2), mat(0x8a6aff, { e: 0.9, t: 0.22 }));
    dome.position.set(0, 0, -7.4); dome.castShadow = false; this.scene.add(dome); this.defs.dome = dome;
    const sch = buildSchierke(); own(sch); sch.root.position.set(0, 0, -6); sch.root.rotation.y = PI; this.scene.add(sch.root);
    this.defs.schierke = { rig: sch, as: newAS() };
    // postos de defesa (anéis no chão)
    Engine.POSTS.forEach(([x, z]) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 24), this.fmat(0xffc860, 0.4).clone());
      ring.rotation.x = -PI / 2; ring.position.set(x, 0.05, z); this.scene.add(ring);
      this.posts.push({ x, z, unit: null, ring });
    });
    this.waveRest = this.defCam ? 7 : 12; this.cb.msg('m_def_start');
    // TD independente: aliados contratáveis aguardam ESPALHADOS em suas áreas de defesa (não em fila)
    if (this.mode === 'defense') {
      const bld: Record<string, () => Rig> = { isidro: buildIsidro, serpico: buildSerpico, caska: () => buildCaska(this.save.cloakEq), farnese: buildFarnese, roderick: buildRoderick };
      DEF_HIRE.forEach(([id], i) => {
        if (id === 'caska' && (this.coop || this.hero === 'caska')) return; // Caska é jogadora
        if (!bld[id]) return;
        const rig = bld[id](); own(rig);
        const sp = Engine.DEF_SPOTS[id] || { x: -4.5 + i * 3, z: -3, fa: PI };
        const q = this.freeSpot(sp.x + rnd(-0.8, 0.8), sp.z + rnd(-0.8, 0.8)); // leve variação: nada de formação artificial
        rig.root.position.set(q.x, 0, q.z); rig.root.rotation.y = sp.fa + rnd(-0.25, 0.25); this.scene.add(rig.root);
        // marcador discreto sobre quem pode ser convencido a lutar
        const mark = mk(gSph(0.09, 8), mat(0xffd860, { e: 2 }), 0, 2.35, 0, rig.root); mark.castShadow = false; (rig.root as any)._mark = mark;
        this.defNpcs.push({ id, rig, as: newAS(), x: q.x, z: q.z });
      });
    }
  }
  hireAlly(id: string): boolean {
    const h = DEF_HIRE.find(([q]) => q === id); if (!h || this.defHired.includes(id)) return false;
    if (this.combat < h[1]) { this.cb.msg('m_def_nocoins'); return false; }
    this.combat -= h[1]; this.defHired.push(id);
    const n = this.defNpcs.find((q) => q.id === id);
    if (n) { this.scene.remove(n.rig.root); disposeRig(n.rig); this.defNpcs.splice(this.defNpcs.indexOf(n), 1); }
    this.syncAllies(); const al = this.allies.find((a) => a.id === id);
    if (al) { const sp = Engine.DEF_SPOTS[id]; if (n) { al.x = n.x; al.z = n.z; } (al as any).defHome = sp ? { x: sp.x, z: sp.z } : { x: al.x, z: al.z }; }
    this.cb.msg('m_def_hired'); A.sfx('buy'); this.ring(n ? n.x : this.p.x, 0.2, n ? n.z : this.p.z, 2.5, 0x8affc8, 0.6);
    return true;
  }
  upgradePost(i: number) {
    const g = this.golems.find((q) => (q as any).post === i); if (!g) return;
    if (((g as any).lvl || 0) >= 2) return;
    if (this.combat < 50) { this.cb.msg('m_def_nocoins'); return; }
    this.combat -= 50; (g as any).lvl = ((g as any).lvl || 0) + 1;
    g.maxHp = Math.round((g.maxHp || 100) * 1.5); g.hp = g.maxHp; g.dmg = Math.round((g.dmg || 14) * 1.4);
    g.rig.root.scale.multiplyScalar(1.08); this.ring(g.x, 0.2, g.z, 2, 0xffd860, 0.5); A.sfx('buy'); this.cb.msg('m_def_upgraded');
  }
  defAlert(k: string, pr?: any, cd = 15) { const now = this.time; if ((this.defs.alerts[k] || -99) + cd < now) { this.defs.alerts[k] = now; this.cb.msg(k, pr); A.sfx('warn'); } }
  defBarrierHit(dmg: number) {
    if (!this.defOn) return;
    this.defs.barrier = Math.max(0, this.defs.barrier - dmg);
    this.vHpHit(dmg * 0.15); // pressão na igreja também corrói a integridade da vila
    this.burst(0, 1.5, -7.4, 10, 0x9a7aff, 5, 0.25, 0.5, 0, true); this.defAlert('m_def_barrier', undefined, 8);
    if (this.defs.barrier <= 0 && this.endT < 0) { this.cb.msg('m_def_lost'); this.explode(0, 1.5, -7.4, 6, 0); this.endT = 0; this.slow = 0.4; setTimeout(() => this.finish(false), 2500); }
  }
  vHpHit(d: number) {
    if (this.endT >= 0) return;
    this.vHp = Math.max(0, this.vHp - d);
    if (this.vHp <= 0) { this.cb.msg('m_def_vlost'); this.endT = 0; this.slow = 0.4; setTimeout(() => this.finish(false), 2500); }
  }
  defShopHit(dmg: number) {
    if (this.defs.shopDead) return;
    this.defs.shopHp -= dmg; this.vHpHit(dmg * 0.25); this.defAlert('m_def_shop', undefined, 10);
    if (this.defs.shopHp <= 0) { this.defs.shopDead = true; this.cb.msg('m_def_shopdown'); this.explode(8, 1.5, 11.5, 5, 0); this.vHpHit(40); }
  }
  deployAt(i: number, kind: 'soldier' | 'archer' | null) {
    const post = this.posts[i]; if (!post) return;
    if (kind === null) { const g = this.golems.find((q) => (q as any).post === i); if (g) { this.scene.remove(g.rig.root, g.ring); disposeRig(g.rig); this.golems.splice(this.golems.indexOf(g), 1); } post.unit = null; return; }
    const cost = kind === 'soldier' ? 60 : 80;
    if (this.combat < cost) { this.cb.msg('m_def_nocoins'); return; }
    if (post.unit) this.deployAt(i, null);
    this.combat -= cost; post.unit = kind;
    const rig = buildEnemy(kind === 'soldier' ? 'soldier' : 'crossbowman'); own(rig); this.scene.add(rig.root);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 24), this.fmat(kind === 'soldier' ? 0x6ab0ff : 0x8affc8, 0.5).clone());
    ring.rotation.x = -PI / 2; this.scene.add(ring);
    const g: Golem = { rig, as: newAS(), x: post.x, z: post.z, fa: 0, life: 9999, atkT: 0.5, ring, ap: 1, hp: kind === 'soldier' ? 170 : 110, maxHp: kind === 'soldier' ? 170 : 110, dmg: kind === 'soldier' ? 14 : 16, minion: true };
    (g as any).post = i; (g as any).hold = { x: post.x, z: post.z }; (g as any).ranged = kind === 'archer'; (g as any).shootT = 0;
    this.golems.push(g); A.sfx('summon'); this.ring(post.x, 0.2, post.z, 2, 0xffc860, 0.5);
  }
  nearDefender(x: number, z: number, r: number) {
    let best: Golem | null = null, bd = r;
    for (const g of this.golems) { if (!g.minion) continue; const d = Math.hypot(g.x - x, g.z - z); if (d < bd) { bd = d; best = g; } }
    return best;
  }
  updDefense(dt: number) {
    const d = this.defs;
    // barreira: visual + regeneração lenta
    if (d.dome) { const k = d.barrier / d.barrierMax; (d.dome.material as THREE.MeshStandardMaterial).opacity = 0.08 + k * 0.2; d.dome.scale.setScalar(1 + Math.sin(this.time * 3) * 0.015); }
    if (d.barrier > 0 && d.barrier < d.barrierMax && !this.enemies.some((e) => !e.dead && Math.hypot(e.x, e.z + 7.4) < 8)) d.barrier = Math.min(d.barrierMax, d.barrier + 3 * dt);
    if (d.schierke) { d.schierke.as.t += dt; d.schierke.as.atk = 'cast'; d.schierke.as.p = 0.35 + Math.sin(d.schierke.as.t * (d.barrier < d.barrierMax * 0.4 ? 6 : 1.2)) * 0.1; animate(d.schierke.rig, d.schierke.as); if (Math.random() < dt * 8 * this.fx) this.burst(rnd(-1.5, 1.5), rnd(0.5, 2.5), -7.4 + rnd(-1, 1), 1, 0x9a7aff, 1.5, 0.15, 0.6, -0.5, true); }
    for (const n of this.defNpcs) { n.as.t += dt; const dp = Math.hypot(n.x - this.p.x, n.z - this.p.z); if (dp < 5) n.rig.root.rotation.y = turn(n.rig.root.rotation.y, Math.atan2(this.p.x - n.x, this.p.z - n.z), dt * 4); const mk2 = (n.rig.root as any)._mark; if (mk2) mk2.position.y = 2.35 + Math.sin(n.as.t * 2.5) * 0.12; animate(n.rig, n.as); }
    for (const hn of this.hens) { hn.t += dt; hn.g.rotation.y += Math.sin(hn.t * 0.7) * dt * 0.8; }
    for (const p2 of this.posts) { const s = 1 + Math.sin(this.time * 2.5) * 0.06; p2.ring.scale.set(s, s, 1); (p2.ring.material as THREE.MeshBasicMaterial).opacity = p2.unit ? 0.1 : 0.35; }
    // alerta de praça invadida
    if (this.enemies.some((e) => !e.dead && Math.hypot(e.x, e.z + 1) < 7)) this.defAlert('m_def_plaza', undefined, 20);
    // ondas
    if (this.endT >= 0 || this.p.dead) return;
    if (this.bossSpawned && this.boss && !this.boss.dead) return; // luta de chefe em andamento
    const alive = this.enemies.filter((e) => !e.dead).length;
    if (alive > 0) return;
    this.waveRest -= dt * (this.skipReq ? 99 : 1);
    if (this.waveRest > 0) return;
    this.skipReq = false;
    const maxW = this.defMaxW;
    if (this.wave >= maxW) {
      if (this.defCam) { if (!this.bossSpawned) { this.cb.msg('m_def_bossIn'); this.spawnBoss(); } return; } // campanha: chefe final da defesa (Zodd/Grunbeld)
      this.cb.msg('m_def_win'); this.finish(true); return;
    }
    this.wave++; this.waveRest = this.defCam ? 9 : 30; // TD independente: 30 s de preparação
    // TD independente: ondas de chefe (10 Griffith/Eclipse, 15–20 Mão de Deus)
    const bossId = !this.defCam ? DEF_BOSS[this.wave] : undefined;
    if (bossId) {
      this.ld = { ...this.ld, boss: bossId }; this.cb.msg('m_wave', { n: this.wave }); this.spawnBoss();
      if (this.boss) { const sc = this.wave === 20 ? 1 : 0.55 + this.wave * 0.012; this.boss.hp = this.boss.max = Math.round(this.boss.max * sc * this.diff.enemyHp); }
      if (this.wave === 10) { setTimeout(() => { if (this.disposed) return; this.cb.msg('m_def_eclipse'); this.world.eclipse(1); this.applyLightK(); A.sfx('eclipse'); A.startMusic('eclipse'); }, 1200); }
      return;
    }
    const sets: string[][] = [['S'], ['S', 'E'], ['S', 'W'], ['S', 'E', 'W'], ['E', 'W', 'N'], ['S', 'E', 'N'], ['S', 'E', 'W', 'N'], ['S', 'E', 'W', 'N']];
    const ents = sets[Math.min(sets.length, Math.ceil(this.wave * (this.defCam ? 1.3 : 0.45))) - 1];
    this.cb.msg('m_wave', { n: this.wave });
    for (const id of ents) this.defAlert('m_def_' + id, undefined, 1);
    const tier = this.defCam ? (this.lv >= 8 ? 3 : Math.min(3, Math.ceil(this.wave / 2))) : this.wave <= 2 ? 0 : this.wave <= 5 ? 1 : this.wave <= 9 ? 2 : 3;
    const pools = [['bandit', 'ghoul'], ['bandit', 'soldier', 'imp'], ['soldier', 'ghoul', 'knight', 'imp'], ['knight', 'troll', 'apostle', 'imp', 'spitter']];
    const pool = this.wave > 10 && !this.defCam ? ['ghoul', 'imp', 'troll', 'apostle', 'spitter'] : pools[tier]; // pós-Eclipse: criaturas
    const n = Math.min(15, 3 + this.wave * (this.defCam ? 2 : 1.2)), hpM = (1 + 0.05 * this.wave + (this.defCam && this.lv >= 8 ? 0.35 : 0)) * this.diff.enemyHp;
    for (let i = 0; i < n; i++) {
      const E2 = Engine.ENTR.find((q) => q.id === ents[i % ents.length])!;
      const e = this.spawnEnemy(pool[i % pool.length], E2.x + rnd(-2, 2), E2.z + rnd(-2, 2), true, true);
      e.hp = e.max = Math.round(e.max * hpM); (e as any).ent = E2.id; (e as any).ri = 0;
      (e as any).route = E2.route.map(([x, z], ix) => [x + rnd(-1.5, 1.5) * (ix < E2.route.length - 1 ? 1 : 0.3), z + rnd(-1.5, 1.5) * (ix < E2.route.length - 1 ? 1 : 0.3)]);
      if (!this.defs.shopDead && E2.id === 'S' && e.def.cls !== 'common' && Math.random() < 0.5) (e as any).route.splice(1, 0, [7.5, 11]); // alguns fortes atacam a oficina
    }
    if ((this.defCam && this.wave === 3) || (!this.defCam && this.wave === 9)) { const e = this.spawnEnemy('brute', 0, 30, true, true, true); (e as any).ent = 'S'; (e as any).ri = 0; (e as any).route = Engine.ENTR[0].route.map((q) => [...q]); this.cb.msg('m_mini'); }
    if (!this.defCam && this.wave === 14) { const e = this.spawnEnemy('ogre', 25, 3, true, true, true); (e as any).ent = 'E'; (e as any).ri = 0; (e as any).route = Engine.ENTR[1].route.map((q) => [...q]); this.cb.msg('m_mini'); A.sfx('roar'); }
  }
  nearNpc(): { id: string } | null {
    if (this.mode !== 'camp') return null;
    for (const n of this.npcs) if (Math.hypot(n.x - this.p.x, n.z - this.p.z) < 2.6) return n;
    return null;
  }
  nearBoard() { return this.mode === 'camp' && Math.hypot(BOARD.x - this.p.x, BOARD.z - this.p.z) < 3; }
  updCampNpcs(dt: number) {
    for (const hn of this.hens) { hn.t += dt; hn.g.position.y = Math.abs(Math.sin(hn.t * 3)) * 0.04; hn.g.rotation.y += Math.sin(hn.t * 0.7) * dt * 0.8; hn.g.rotation.x = Math.max(0, Math.sin(hn.t * 1.3)) * 0.35; }
    for (const n of this.npcs) {
      n.as.t += dt;
      const d = Math.hypot(n.x - this.p.x, n.z - this.p.z);
      const wd = (n as any).wander;
      if (wd) { // moradores circulam em sua pequena área
        if (d < 3.5) { wd.wait = 1; const want = Math.atan2(this.p.x - n.x, this.p.z - n.z); n.rig.root.rotation.y = turn(n.rig.root.rotation.y, want, dt * 4); n.as.mv = 0; }
        else {
          const dx = wd.tx - n.x, dz = wd.tz - n.z, dd = Math.hypot(dx, dz);
          if (dd > 0.4) { const sp2 = 1.15; n.x += (dx / dd) * sp2 * dt; n.z += (dz / dd) * sp2 * dt; n.rig.root.rotation.y = turn(n.rig.root.rotation.y, Math.atan2(dx, dz), dt * 5); n.as.mv = 0.45; }
          else { n.as.mv = 0; wd.wait -= dt; if (wd.wait <= 0) { const a = rnd(0, TAU), r2 = rnd(0.5, wd.r); wd.tx = wd.hx + Math.sin(a) * r2; wd.tz = wd.hz + Math.cos(a) * r2; wd.wait = rnd(2, 5); } }
          const q2 = { x: n.x, z: n.z }; resolve(this.world.cols, q2, 0.4); n.x = q2.x; n.z = q2.z;
        }
        n.rig.root.position.set(n.x, 0, n.z); animate(n.rig, n.as); continue;
      }
      if (d < 5) { const want = Math.atan2(this.p.x - n.x, this.p.z - n.z); n.rig.root.rotation.y = turn(n.rig.root.rotation.y, want, dt * 4); }
      n.as.fly = n.id === 'puck' || n.id === 'ivalera';
      const near = d < 5;
      if (!near) { // atividades contextuais quando o jogador não está por perto
        if (n.id === 'godo') { n.as.atk = Math.sin(n.as.t * 0.7) > 0.4 ? 'l1' : ''; n.as.p = (n.as.t % 1.4) / 1.4; } // martelando
        else if (n.id === 'rickert') { n.as.atk = (n.as.t % 1.1) < 0.6 ? 'l1' : ''; n.as.p = (n.as.t % 1.1) / 1.1; } // consertando peças
        else if (n.id === 'schierke') { n.as.atk = 'cast'; n.as.p = 0.3 + Math.sin(n.as.t * 0.8) * 0.08; } // estudando magia
        else if (n.id === 'guts' || n.id === 'gutsai') { const c = n.as.t % 7; if (c < 1.4) { n.as.atk = 'l2'; n.as.p = c / 1.4; } else n.as.atk = ''; } // treinando golpes
        else if (n.id === 'serpico') { n.as.atk = ''; n.as.block = Math.sin(n.as.t * 0.3) > 0.6; } // conferindo a guarda
        else if (n.id === 'roderick') { const c = n.as.t % 9; if (c < 1) { n.as.atk = 'l1'; n.as.p = c; } else n.as.atk = ''; } // movendo suprimentos
        else n.as.atk = '';
      } else { n.as.atk = ''; n.as.block = false; } // de frente para o jogador, atenção total
      if (n.as.fly) n.rig.root.position.y = 1.5 + Math.sin(n.as.t * 3) * 0.2;
      animate(n.rig, n.as);
    }
    if (this.departFx) { const s = 1 + Math.sin(this.time * 2.2) * 0.07; this.departFx.scale.set(s, s, 1); (this.departFx.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(this.time * 2.2) * 0.2; }
  }
  spawnDummies(n = 3) {
    for (let i = 0; i < n; i++) {
      const e = this.spawnEnemy(['soldier', 'knight', 'troll'][i % 3], 6 + i * 4 + rnd(-1, 1), 6 + rnd(-1, 1), false, true);
      e.max = e.hp = 99999; (e as any).dummy = true; e.aggro = false;
    }
  }
  // ---------- desafios secretos de Griffith ----------
  setupSecrets() {
    const S = this.save.secret, w = this.world;
    const spotAt = (i: number) => w.relicSpots[i % w.relicSpots.length] || w.spawnSpots[i % w.spawnSpots.length];
    const mkFeather = (x: number, z: number) => { const g = new THREE.Group(); const f = mk(gCone(0.08, 0.7, 5), mat(0xf2f2ee, { r: 0.6 }), 0, 0.6, 0, g, 0.4, 0, 0.5); f.castShadow = true; mk(gSph(0.25, 8), mat(0xffffff, { e: 0.8, t: 0.15 }), 0, 0.6, 0, g).castShadow = false; g.position.set(x, 0, z); this.scene.add(g); return g; };
    const mkBanner = (x: number, z: number, col: number) => { const g = new THREE.Group(); mk(gCyl(0.06, 0.08, 4.5), mat(0x4a3220), 0, 2.2, 0, g); mk(gBox(1.3, 1.8, 0.05), mat(col, { r: 0.9 }), 0.7, 3.4, 0, g); mk(gCone(0.3, 0.5, 6), mat(0xffffff, { e: 0.4, ec: 0xffffff }), 0.7, 3.4, 0.06, g, 0, 0, -0.8); g.position.set(x, 0, z); this.scene.add(g); return g; };
    if (!this.coop && this.hero === 'caska' && this.lv === 5 && !S.g1) {
      const need = 5 - S.f5.feathers;
      for (let i = 0; i < need; i++) { const sp = w.spawnSpots[(i * 2 + 1) % w.spawnSpots.length]; const x = sp.x + rnd(-4, 4), z = sp.z + rnd(-4, 4); this.feathers.push({ g: mkFeather(x, z), x, z, got: false }); }
      if (!S.f5.flag) { const sp = w.behelitSpots[0] || spotAt(0); this.secretFlag = { g: mkBanner(sp.x, sp.z, 0xe8e8e8), x: sp.x, z: sp.z, found: false }; }
      else { const sp = w.behelitSpots[0] || spotAt(0); this.secretFlag = { g: mkBanner(sp.x, sp.z, 0xe8e8e8), x: sp.x, z: sp.z, found: true }; }
    }
    if (!this.coop && this.hero === 'guts' && this.lv >= 1 && this.lv <= 5 && !S.g2) {
      if (!S.bLvls.includes(this.lv)) { const sp = spotAt(1); const g = makeBehelit(); g.scale.setScalar(0.45); g.position.set(sp.x, 0, sp.z); this.scene.add(g); this.behItem = { g, x: sp.x, z: sp.z, got: false }; }
      if (!S.fLvls.includes(this.lv)) { const sp = spotAt(2); this.falconFlag = { g: mkBanner(sp.x, sp.z, 0xf0f0f0), x: sp.x, z: sp.z, hp: 120, alive: true }; }
    }
    if (!this.coop && this.hero === 'guts' && this.lv === 6 && !S.g2 && S.bLvls.length >= 4 && S.fLvls.length >= 4 && this.save.bosses.includes('griffith')) { // 4 fases de exploração (a Fase 4 virou defesa da vila)
      const sp = spotAt(0); const g = makeBehelit(); g.scale.setScalar(0.85); g.position.set(sp.x, 0, sp.z); this.scene.add(g); this.talkBeh = { g, x: sp.x, z: sp.z, used: false };
    }
  }
  secretHud(): any {
    if (this.mode !== 'campaign') return null;
    const S = this.save.secret;
    if (this.hero === 'caska' && this.lv === 5 && !S.g1) {
      const fires = this.world.fires.filter((f) => f.usable); const bon = S.f5.bonfires || (fires.length > 0 && fires.every((f) => f.used));
      return { k: 'f5', feathers: S.f5.feathers + this.feathers.filter((f) => f.got).length, bonfires: bon, flag: S.f5.flag || !!this.secretFlag?.found, lured: S.f5.lured || (this as any)._lured };
    }
    if (this.hero === 'guts' && this.lv <= 5 && !S.g2) return { k: 'g2p', b: S.bLvls.length + (this.behItem?.got ? 1 : 0), f: S.fLvls.length + (this.falconFlag && !this.falconFlag.alive ? 1 : 0) };
    if (this.mozgusOn) return { k: 'moz', left: this.enemies.filter((e) => !e.dead && (this.mozgusMinis.includes(e.nid) || e.boss)).length };
    return null;
  }
  updSecrets(dt: number) {
    if (this.mode !== 'campaign') return;
    void dt; const S = this.save.secret;
    if (this.hero === 'caska' && this.lv === 5 && !S.g1 && !this.secretDone) {
      const fires = this.world.fires.filter((f) => f.usable);
      if (!S.f5.bonfires && fires.length > 0 && fires.every((f) => f.used)) { S.f5.bonfires = true; this.cb.secret?.('f5', { ...S.f5 }); this.cb.msg('m_sec_bonfires'); }
      if (this.boss && !this.boss.dead && this.secretFlag?.found && !(this as any)._lured && Math.hypot(this.boss.x - this.secretFlag.x, this.boss.z - this.secretFlag.z) < 7) {
        (this as any)._lured = true; S.f5.lured = true; this.cb.secret?.('f5', { ...S.f5 }); this.cb.msg('m_sec_lured'); this.ring(this.secretFlag.x, 0.2, this.secretFlag.z, 7, 0xffffff, 1);
      }
      const feathersAll = S.f5.feathers >= 5, flagOk = S.f5.flag, luredOk = S.f5.lured, bonOk = S.f5.bonfires;
      if (feathersAll && flagOk && luredOk && bonOk) { this.secretDone = true; S.g1 = true; this.cb.secret?.('g1'); this.cb.msg('m_sec_g1'); A.sfx('win'); this.burst(this.p.x, 1.5, this.p.z, 60, 0xffffff, 8, 0.4, 1.2, -1, true); }
    }
    if (this.mozgusOn && !this.secretDone) {
      const left = this.enemies.filter((e) => !e.dead && this.mozgusMinis.includes(e.nid)).length;
      if (left === 0 && this.boss && this.boss.dead) { this.secretDone = true; S.g2 = true; this.cb.secret?.('g2'); this.cb.msg('m_sec_g2'); A.sfx('win'); }
    }
  }
  startMozgus(): boolean {
    const act = this.save.active;
    if (!this.save.secret.g1 || !act.includes('griffith1') || !act.includes('caska')) { this.cb.msg('m_needTeam'); return false; }
    if (this.bossSpawned) { this.cb.msg('m_cd'); return false; }
    this.ld = { ...this.ld, boss: 'mozgus' };
    for (const [, type, scale] of DISCIPLES) {
      const a = rnd(0, TAU), d = rnd(10, 16); const q = { x: this.p.x + Math.sin(a) * d, z: this.p.z + Math.cos(a) * d }; resolve(this.world.cols, q, 2);
      const e = this.spawnEnemy(type, q.x, q.z, true, true, true); e.rig.root.scale.setScalar(ENEMIES[type].scale * scale); e.rad *= scale; this.mozgusMinis.push(e.nid);
    }
    this.spawnBoss(); this.mozgusOn = true; this.cb.msg('m_mozgus'); return true;
  }
  pickId(): string {
    const g = this.ld.groups, ks = Object.keys(g), tot = ks.reduce((a, k) => a + g[k], 0); let r = Math.random() * tot;
    for (const k of ks) { r -= g[k]; if (r <= 0) return k; } return ks[0];
  }
  lvHp() { return this.lv >= 7 ? Math.min(1.3, 1 + 0.1 * (this.lv - 6)) : 1; }
  spawnEnemy(id: string, x: number, z: number, aggro = true, summoned = false, miniFlag = false): En {
    const def = ENEMIES[id]; const rig = buildEnemy(id); own(rig); rig.root.scale.setScalar(def.scale);
    const hpM = this.lvHp() * this.diff.enemyHp; const e = this.mkEn(id, def, null, rig, x, z, def.hp * hpM, aggro); e.summoned = summoned; e.dmgMul = (this.lv >= 7 ? 1 + 0.04 * (this.lv - 6) : 1);
    e.mini = def.cls === 'mini' || miniFlag; if (!summoned && !e.mini) this.spawned++;
    if (miniFlag && def.cls !== 'mini') { e.max = e.hp = e.hp * 3; rig.root.scale.setScalar(def.scale * 1.25); e.rad *= 1.25; e.def = { ...def, scale: def.scale * 1.25, cls: 'special' }; }
    this.enemies.push(e); this.scene.add(rig.root);
    if (!e.mini) this.makeBar(e);
    return e;
  }
  mkEn(id: string, def: EDef, boss: BossDef | null, rig: Rig, x: number, z: number, hp: number, aggro: boolean): En {
    return { id, def, boss, mini: false, rig, as: newAS(), x, z, y: 0, fa: Math.atan2(-x, -z), kx: 0, kz: 0, hp, max: hp, poise: def.poise, pmax: def.poise, aggro, state: 'chase', st: 0, atk: '', W: 0, St: 0, R: 0, anim: '', hitDone: false, cd: rnd(0.5, 1.5), token: false, phase: 1, flashT: 0, stunT: 0, dead: false, deadT: 0, tele: null, tx: 0, tz: 0, circ: Math.random() < 0.5 ? 1 : -1, guarding: false, guardT: 0, slow: 0, summoned: false, last: '', next: '', summonCd: 8, dmgMul: 1, tick: 0, heavy: false, sx: 0, sz: 0, hitOnce: false, bar: null, rad: 0.45 * def.scale, poiseT: 0, hitT: 0, fade: 1, nid: this.nid++ };
  }
  makeBar(e: En) {
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x120808, depthTest: false, transparent: true, opacity: 0.8 })), fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xc02020, depthTest: false, transparent: true }));
    bg.center.set(0, 0.5); fg.center.set(0, 0.5); bg.renderOrder = 20; fg.renderOrder = 21; bg.visible = fg.visible = false; this.scene.add(bg, fg); e.bar = [bg, fg];
  }
  spawnBoss() {
    const bd = BOSSES[this.ld.boss]; const rig = buildBoss(bd.id); own(rig); rig.root.scale.setScalar(bd.scale);
    const def: EDef = { id: bd.id, hp: bd.hp, dmg: bd.dmg, spd: bd.spd, range: bd.range, cls: 'boss', atk: 'boss', scale: bd.scale, poise: 900 + bd.hp * 0.05 };
    const a = this.yaw + PI, d = 15; let x = this.p.x - Math.sin(a) * 0 + Math.sin(this.yaw + PI) * 0 - Math.sin(this.yaw) * d, z = this.p.z - Math.cos(this.yaw) * d;
    if (this.lv === 9) { x = 0; z = 18; }
    const pp = { x, z }; resolve(this.world.cols, pp, 2); x = pp.x; z = pp.z;
    const e = this.mkEn(bd.id, def, bd, rig, x, z, bd.hp * this.diff.enemyHp, true); e.state = 'intro'; e.rad = 0.6 * bd.scale; this.enemies.push(e); this.scene.add(rig.root); this.boss = e; this.bossSpawned = true;
    this.cine = 'intro'; this.cineT = 0; e.cd = 1.5;
    this.cb.msg('m_boss_appear', { id: bd.id });
    this.ring(x, 0.1, z, 10, 0xff3020, 1.4); A.sfx('roar');
  }

  // ---------- aliados ----------
  syncAllies() {
    let want: string[];
    if (this.mode === 'defense') want = [...this.defHired]; // TD independente: SÓ aliados contratados na partida ajudam
    else {
      want = this.save.active.filter((a) => this.save.allies.includes(a));
      if (this.coop && !want.includes('caska')) want.unshift('caska'); // multiplayer: Caska é o jogador 2
      if (this.hero === 'caska') { want = want.filter((a) => a !== 'caska' && a !== 'puck'); want.unshift('gutsai'); } // solo Caska: Guts vira aliado de IA, Ivalera substitui Puck
    }
    if (this.defOn) { want = want.filter((a) => a !== 'schierke'); if (this.defCam) { if (!want.includes('serpico')) want.push('serpico'); if (!want.includes('isidro')) want.push('isidro'); } } // defesa: Schierke está na igreja; Serpico e Isidro ajudam por história
    if (this.mode === 'camp') want = []; // no acampamento NINGUÉM segue o jogador — todos são NPCs fixos (corrige Guts duplicado)
    for (const a of [...this.allies]) if (!want.includes(a.id)) { this.scene.remove(a.rig.root); disposeRig(a.rig); this.allies.splice(this.allies.indexOf(a), 1); }
    want.forEach((id) => {
      if (this.allies.find((a) => a.id === id)) return;
      const bld: Record<string, () => Rig> = { puck: buildPuck, serpico: buildSerpico, schierke: buildSchierke, farnese: buildFarnese, roderick: buildRoderick, caska: () => buildCaska(this.save.cloakEq), gutsai: buildGuts, isidro: buildIsidro, griffith1: () => buildGriffith('human'), griffith2: () => buildGriffith('femto') };
      if (!bld[id]) return;
      const rig = bld[id]!(); own(rig);
      const i = this.allies.length; this.scene.add(rig.root);
      this.allies.push({ id, rig, as: newAS(), x: this.p.x + 2 + i, z: this.p.z + 2, fa: 0, cd: id === 'caska' ? 10 : 5, atkT: 0, atk: '', ap: 0, act: 0, i, extra: 0, tgt: null, dashT: 0, dx: 0, dz: 0, spinT: 0, on: 0, tick: 0, hp: 0, maxHp: 0, hurtT: 0, downT: 0 });
    });
    this.allies.forEach((a, i) => {
      a.i = i; if (a.id === 'caska') setCloak(a.rig, this.save.cloakEq);
      // defesa: cada aliado ancora na sua área temática (espelhada pela vila), não em fila atrás do jogador
      if (this.defOn && !(a as any).defHome) { const sp = Engine.DEF_SPOTS[a.id]; if (sp) { (a as any).defHome = { x: sp.x, z: sp.z }; const q = this.freeSpot(sp.x, sp.z); a.x = q.x; a.z = q.z; a.fa = sp.fa; } }
    });
    if (this.coop) {
      this.caskaNet = this.allies.find((a) => a.id === 'caska') || null;
      if (this.caskaNet && this.cask.maxHp === 0) { this.cask.maxHp = this.cs.hp; this.cask.hp = this.cs.hp; this.cask.maxStam = this.cs.stam; this.cask.stam = this.cs.stam; }
      if (this.caskaNet && !this.ivalera) { this.ivalera = buildIvalera(); own(this.ivalera); this.scene.add(this.ivalera.root); }
    }
    if (this.hero === 'caska' && !this.ivalera) { this.ivalera = buildIvalera(); own(this.ivalera); this.scene.add(this.ivalera.root); }
    // buffs de suporte exclusivos (Schierke→Guts; Farnese→Caska)
    this.gBuff = this.allies.some((a) => a.id === 'schierke') && this.hero === 'guts';
    this.cBuff = this.allies.some((a) => a.id === 'farnese') && (this.coop || this.hero === 'caska');
    this.mods.atkSpd = this.hero === 'caska' && this.cBuff ? FARNESE_BUFF.atkSpd : 1;
    if (this.hero === 'caska') this.heroSpd = this.cs.spd * (this.cBuff ? FARNESE_BUFF.moveSpd : 1);
    // dar vida aos aliados de suporte (para as barras)
    for (const a of this.allies) { if (a.id === 'puck') continue; if (!a.maxHp) { a.maxHp = { serpico: 140, schierke: 90, farnese: 160, roderick: 200, caska: this.cs.hp, gutsai: 280, griffith1: 250, griffith2: 300 }[a.id] || 120; a.hp = a.maxHp; } }
  }
  allyEnemy(a: { x: number; z: number }, r: number): En | null {
    let b: En | null = null, bd = r;
    for (const e of this.enemies) {
      if (e.dead || e.state === 'intro' || (!e.aggro && Math.hypot(e.x - this.p.x, e.z - this.p.z) > 14)) continue;
      let d = Math.hypot(e.x - a.x, e.z - a.z);
      // prioridade em camadas na defesa da vila: igreja > praça > resto
      if (this.defOn) { const dc = Math.hypot(e.x, e.z + 7.4); if (dc < 10) d *= 0.35; else if (Math.hypot(e.x, e.z + 1) < 8) d *= 0.6; }
      if (d < bd) { bd = d; b = e; }
    }
    return b;
  }
  puckOn() { return this.allies.some((a) => a.id === 'puck'); }
  updAllies(dt: number) {
    const p = this.p, eagle = this.eagle > 0;
    for (const a of this.allies) {
      if (this.coop && a === this.caskaNet) { this.updCaskaNet(a, dt); continue; }
      a.hurtT = Math.max(0, a.hurtT - dt);
      if (a.downT > 0) { a.downT -= dt; a.as.t += dt; if (a.downT <= 0) { a.hp = a.maxHp * 0.5; a.rig.root.visible = true; this.burst(a.x, 1, a.z, 14, 0x8affc8, 4, 0.25, 0.7, -1, true); } else continue; }
      if (a.maxHp && a.id !== 'puck' && a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.03 * dt);
      a.as.t += dt; a.cd = Math.max(0, a.cd - dt); a.atkT = Math.max(0, a.atkT - dt);
      const rig = a.rig; let tx: number, tz: number, spd = 6.5;
      const ang = this.yaw + PI * 0.5 + (a.i - (this.allies.length - 1) / 2) * 0.9; // atrás/ao lado do jogador
      const off = a.id === 'schierke' || a.id === 'farnese' ? 4.2 : a.id === 'puck' ? 1.8 : 3.2;
      tx = p.x + Math.sin(ang) * off; tz = p.z + Math.cos(ang) * off;
      // defesa da vila: sem inimigos por perto, cada aliado guarda a SUA área (espalhados, não em fila)
      const dh = (a as any).defHome as { x: number; z: number } | undefined;
      if (this.defOn && dh) { tx = dh.x + Math.sin(a.i * 2.3) * 1.1; tz = dh.z + Math.cos(a.i * 1.9) * 1.1; }
      const t = this.allyEnemy(a, a.id === 'schierke' || a.id === 'farnese' ? 0 : this.defOn ? 22 : 16);
      let atk = false; void atk;
      const meleeId = ['serpico', 'roderick', 'caska', 'gutsai', 'isidro', 'griffith1', 'griffith2'].includes(a.id);
      if (meleeId && t) {
        const fast = a.id === 'griffith1' || a.id === 'griffith2';
        const rng = a.id === 'roderick' ? 3.6 : a.id === 'gutsai' ? 3.2 : 2.6; const d = Math.hypot(t.x - a.x, t.z - a.z);
        tx = t.x - Math.sin(Math.atan2(t.x - a.x, t.z - a.z)) * rng * 0.7; tz = t.z - Math.cos(Math.atan2(t.x - a.x, t.z - a.z)) * rng * 0.7; spd = 8.2 * (a.id === 'caska' ? this.cs.spd : fast ? 1.2 : 1);
        a.fa = turn(a.fa, Math.atan2(t.x - a.x, t.z - a.z), dt * 10);
        if (d < rng + 0.6 && a.atkT <= 0 && a.spinT <= 0 && a.dashT <= 0) {
          const gap = a.id === 'serpico' ? 0.55 : a.id === 'roderick' ? 0.95 : fast ? 0.45 : a.id === 'isidro' ? 0.5 : a.id === 'gutsai' ? 0.8 : 0.7 / (eagle ? 1.4 : 1);
          a.atkT = gap; a.atk = a.id === 'roderick' ? 'thrust' : a.id === 'gutsai' && a.extra % 3 === 2 ? 'heavy' : a.extra % 2 ? 'l2' : 'l1'; a.extra++; a.ap = 0;
          const dmg = { serpico: 13, roderick: 24, gutsai: 30, isidro: 10, griffith1: 18, griffith2: 27 }[a.id] ?? 20 * this.cs.dmg * (eagle ? 1.3 : 1);
          const heavy = a.atk === 'heavy';
          setTimeout(() => { if (!this.disposed && !t.dead) this.damageEnemy(t, dmg * (heavy ? 1.8 : 1), { kb: heavy ? 6 : 2, ally: true, stun: heavy ? 0.6 : 0.1, heavy }); }, 150);
        }
        atk = true;
      } else if (a.id === 'caska' && !t) { /* segue */ }
      if (a.id === 'caska' && t && Math.hypot(t.x - a.x, t.z - a.z) > 7 && a.atkT <= 0) { a.atkT = 1.1; this.shoot(a.x, 1.3, a.z, t.x, 1.0, t.z, 9 * this.cs.dmg * 1.4, true, 'bolt'); A.sfx('bolt'); }
      // habilidades
      const near = this.enemies.filter((e) => !e.dead && e.state !== 'intro' && Math.hypot(e.x - p.x, e.z - p.z) < 10).length;
      if (a.cd <= 0 && near > 0) {
        if (a.id === 'serpico' && (near >= 2 || this.boss) && t && Math.hypot(t.x - a.x, t.z - a.z) < 5) { a.spinT = 1.2; a.cd = 20; a.tick = 0; this.cb.msg('m_ally', { n: 'Serpico', s: 'Vendaval' }); A.sfx('gust'); }
        if (a.id === 'roderick' && t && Math.hypot(t.x - a.x, t.z - a.z) < 12 && Math.hypot(t.x - a.x, t.z - a.z) > 3) { a.dashT = 0.45; a.cd = 18; a.dx = (t.x - a.x); a.dz = (t.z - a.z); const l = Math.hypot(a.dx, a.dz); a.dx /= l; a.dz /= l; this.cb.msg('m_ally', { n: 'Roderick', s: 'Estocada Perfurante' }); this.ring(a.x, 0.2, a.z, 3, 0xffd060, 0.4); }
        if (a.id === 'schierke' && near >= 2) { this.summonGolems(a); a.cd = 60; }
        if (a.id === 'griffith1' && near >= 1) { this.summonMinions(a, 'soldier', 2, 100, 7); a.cd = 60; this.cb.msg('m_ally', { n: 'Griffith', s: 'Bando do Falcão' }); }
        if (a.id === 'griffith2' && near >= 1) { this.summonMinions(a, 'imp', 3, 200, 20); a.cd = 75; this.cb.msg('m_ally', { n: 'Griffith', s: 'Invocação de Demônios' }); }
        if (a.id === 'farnese' && (p.hp < this.gs.maxHp * 0.85 || this.boss) && this.shieldT <= 0) { this.shield = 70; this.shieldT = 8; a.cd = 25; a.act = 1; this.cb.msg('m_ally', { n: 'Farnese', s: 'Escudo Sagrado' }); this.ring(p.x, 0.2, p.z, 6, 0xfff0a0, 0.8); A.sfx('magic'); }
      }
      if (a.id === 'caska' && this.eagleCd <= 0 && (near >= 3 || (this.boss && this.boss.state !== 'intro') || p.hp < this.gs.maxHp * 0.5)) { this.eagle = this.cs.detDur; this.eagleCd = this.cs.detCd; this.cb.msg('m_ally', { n: 'Caska', s: 'Determinação da Águia' }); this.ring(a.x, 0.2, a.z, 5, 0xffd860, 0.8); A.sfx('rage'); }
      // habilidades ativas
      if (a.spinT > 0) { a.spinT -= dt; a.ap = Math.min(1, (1.2 - a.spinT) / 1.2); a.atk = 'spin'; a.tick -= dt; if (a.tick <= 0) { a.tick = 0.4; for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - a.x, e.z - a.z) < 5.5) this.damageEnemy(e, 22, { kb: 5, ally: true, stun: 0.3 }); this.burst(a.x, 1, a.z, 8, 0x9affc8, 6, 0.3, 0.5, 0, true); } if (a.spinT <= 0) a.atk = ''; atk = true; }
      if (a.dashT > 0) {
        a.dashT -= dt; a.x += a.dx * 22 * dt; a.z += a.dz * 22 * dt; a.fa = Math.atan2(a.dx, a.dz); a.atk = 'thrust'; a.ap = 0.55; atk = true;
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - a.x, e.z - a.z) < 2.2 + e.rad && !(e as any)._rd) { const big = e.def.cls !== 'common'; this.damageEnemy(e, big ? 130 : 50, { kb: 6, ally: true, heavy: big, pierce: true }); (e as any)._rd = true; setTimeout(() => { (e as any)._rd = false; }, 600); }
        if (a.dashT <= 0) a.atk = '';
      }
      if (a.atkT > 0 && a.atk && a.atk !== 'spin') { const tot = a.id === 'roderick' ? 0.95 : 0.6; a.ap = clamp(1 - a.atkT / tot, 0, 1) * 1.0; if (a.atkT <= 0.02) a.atk = ''; }
      else if (a.atkT <= 0 && a.atk !== 'spin' && a.atk !== 'thrust') a.atk = '';
      if (a.id === 'caska' && eagle) { /* aura */ if (Math.random() < dt * 30 * this.fx) this.burst(a.x, 1.2, a.z, 1, 0xffd860, 2, 0.2, 0.7, -1, true); }
      // movimento
      if (a.dashT <= 0) {
        const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
        if (d > 32) { a.x = tx; a.z = tz; }
        const stop = a.id === 'puck' ? 0.4 : 0.8; let mv = 0;
        if (d > stop) { const s = Math.min(spd * (d > 8 ? 1.7 : 1), d / dt); a.x += (dx / d) * s * dt; a.z += (dz / d) * s * dt; mv = Math.min(1.2, s / 7); if (!t || !meleeId) a.fa = turn(a.fa, Math.atan2(dx, dz), dt * 8); }
        a.as.mv = mv; a.as.run = mv > 0.9;
      } else a.as.mv = 0;
      if (a.id !== 'puck') { const q = { x: a.x, z: a.z }; resolve(this.world.cols, q, 0.5); a.x = q.x; a.z = q.z; }
      // espaçamento automático: aliados nunca ficam encostados uns nos outros
      if (a.id !== 'puck') for (const o of this.allies) { if (o === a || o.id === 'puck') continue; const dx2 = a.x - o.x, dz2 = a.z - o.z, d2 = Math.hypot(dx2, dz2); if (d2 < 1.6 && d2 > 0.001) { const push = (1.6 - d2) * 0.5; a.x += (dx2 / d2) * push; a.z += (dz2 / d2) * push; } }
      if (!t && a.id !== 'puck' && a.atkT <= 0 && a.spinT <= 0) a.fa = turn(a.fa, p.fa, dt * 3);
      rig.root.position.set(a.x, a.id === 'puck' ? 1.8 + Math.sin(a.as.t * 3) * 0.2 : 0, a.z); rig.root.rotation.y = a.fa;
      a.as.atk = a.atk; a.as.p = a.ap; a.as.fly = a.id === 'puck';
      if (a.id === 'schierke' && a.cd < 3) a.as.atk = 'cast', a.as.p = 0.3;
      animate(rig, a.as);
      if (a.id === 'puck' && this.healFx > 0 && Math.random() < 0.7) this.burst(a.x, 1.8, a.z, 1, 0x8affc8, 2, 0.2, 0.6, 0, true);
    }
    // regeneração passiva de Puck e suporte de Caska
    if (this.puckOn() && !p.dead) p.hp = Math.min(this.gs.maxHp, p.hp + 0.9 * dt);
    if (this.allies.some((a) => a.id === 'caska') && !p.dead) p.hp = Math.min(this.gs.maxHp, p.hp + this.cs.hp * 0.004 * dt);
    this.eagle = Math.max(0, this.eagle - dt); this.eagleCd = Math.max(0, this.eagleCd - dt); this.shieldT = Math.max(0, this.shieldT - dt); if (this.shieldT <= 0) this.shield = 0;
    this.healFx = Math.max(0, this.healFx - dt);
    // golens e unidades invocadas (soldados/demônios/defensores da vila)
    for (const g of [...this.golems]) {
      if (!g.minion) g.life -= dt; // invocações de Griffith permanecem até serem derrotadas
      g.as.t += dt; g.atkT = Math.max(0, g.atkT - dt);
      const hold = (g as any).hold as { x: number; z: number } | undefined;
      // defensores da vila: mantêm o posto e atacam o que se aproximar
      if (hold) {
        const t2 = this.allyEnemy(hold, (g as any).ranged ? 15 : 11); let mv2 = 0;
        if (t2) {
          const dx = t2.x - g.x, dz = t2.z - g.z, d2 = Math.hypot(dx, dz);
          g.fa = turn(g.fa, Math.atan2(dx, dz), dt * 8);
          if ((g as any).ranged) {
            (g as any).shootT -= dt;
            if ((g as any).shootT <= 0 && d2 > 2) { (g as any).shootT = 1.7; this.shoot(g.x, 1.4, g.z, t2.x, 1.1, t2.z, g.dmg ?? 16, true, 'bolt'); A.sfx('bolt'); g.as.atk = 'shootE'; g.ap = 0.3; g.atkT = 0.4; }
            if (d2 < 2 && g.atkT <= 0) { g.atkT = 1; const gd2 = (g.dmg ?? 16) * 0.6; setTimeout(() => { if (!this.disposed && !t2.dead) this.damageEnemy(t2, gd2, { kb: 2, ally: true, stun: 0.1 }); }, 200); }
          } else {
            const far = Math.hypot(g.x - hold.x, g.z - hold.z);
            if (d2 > 2.1 && far < 6) { g.x += (dx / d2) * 4.5 * dt; g.z += (dz / d2) * 4.5 * dt; mv2 = 0.7; }
            else if (d2 <= 2.3 && g.atkT <= 0) { g.atkT = 1; g.ap = 0; const gd2 = g.dmg ?? 14; setTimeout(() => { if (!this.disposed && !t2.dead) this.damageEnemy(t2, gd2, { kb: 3, ally: true, stun: 0.2 }); }, 250); g.as.atk = 'l1'; }
          }
        } else { // volta ao posto
          const dx = hold.x - g.x, dz = hold.z - g.z, d2 = Math.hypot(dx, dz);
          if (d2 > 0.5) { g.x += (dx / d2) * 3.5 * dt; g.z += (dz / d2) * 3.5 * dt; mv2 = 0.5; g.fa = turn(g.fa, Math.atan2(dx, dz), dt * 6); }
        }
        const q2 = { x: g.x, z: g.z }; resolve(this.world.cols, q2, 0.45); g.x = q2.x; g.z = q2.z;
        g.ap = Math.min(1, g.ap + dt / 0.9); g.as.mv = mv2; if (g.atkT <= 0.1) g.as.atk = ''; g.as.p = g.ap;
        g.rig.root.position.set(g.x, 0, g.z); g.rig.root.rotation.y = g.fa; animate(g.rig, g.as);
        g.ring.position.set(g.x, 0.08, g.z); (g.ring.material as THREE.MeshBasicMaterial).opacity = 0.35;
        continue;
      }
      const t = this.allyEnemy(g, 20); let mv = 0;
      if (t) {
        const dx = t.x - g.x, dz = t.z - g.z, d = Math.hypot(dx, dz); g.fa = turn(g.fa, Math.atan2(dx, dz), dt * 8);
        const mrange = g.minion ? 2.2 : 3.2;
        if (d > mrange) { g.x += (dx / d) * (g.minion ? 6 : 5.5) * dt; g.z += (dz / d) * (g.minion ? 6 : 5.5) * dt; mv = 1; } else if (g.atkT <= 0) {
          g.atkT = g.minion ? 0.9 : 1.2; g.ap = 0; const gd = g.dmg ?? 28, hv = !g.minion;
          setTimeout(() => { if (!this.disposed && !t.dead) { this.damageEnemy(t, gd, { kb: hv ? 7 : 2, ally: true, heavy: hv, stun: hv ? 0.6 : 0.1 }); if (hv) this.burst(t.x, 0.5, t.z, 10, 0x8a8a80, 4, 0.3, 0.5, 8, false); } }, g.minion ? 250 : 450);
        }
      } else { const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz); if (d > 4) { g.x += (dx / d) * 5.5 * dt; g.z += (dz / d) * 5.5 * dt; mv = 1; g.fa = turn(g.fa, Math.atan2(dx, dz), dt * 6); } }
      const q = { x: g.x, z: g.z }; resolve(this.world.cols, q, 0.9); g.x = q.x; g.z = q.z;
      g.ap = Math.min(1, g.ap + dt / 1.1); g.as.mv = mv * 0.6; g.as.atk = g.atkT > 0.1 ? 'slam' : ''; g.as.p = g.ap;
      g.rig.root.position.set(g.x, 0, g.z); g.rig.root.rotation.y = g.fa; animate(g.rig, g.as);
      g.ring.position.set(g.x, 0.08, g.z); const s = 2.2 + Math.sin(g.as.t * 4) * 0.25; g.ring.scale.set(s, s, 1); (g.ring.material as THREE.MeshBasicMaterial).opacity = Math.min(0.7, g.life / 2);
      if (g.life <= 0) { this.burst(g.x, 1.3, g.z, 24, 0x8a8a80, 5, 0.4, 0.8, 6, false); this.scene.remove(g.rig.root, g.ring); (g.ring.material as THREE.Material).dispose(); disposeRig(g.rig); this.golems.splice(this.golems.indexOf(g), 1); }
    }
  }
  // ---------- Caska controlada pelo jogador 2 (host autoritativo) ----------
  updCaskaNet(a: Ally, dt: number) {
    const c = this.cask, in_ = this.remoteInput as (import('./netproto').NetInput | null), rig = a.rig;
    a.as.t += dt; a.atkT = Math.max(0, a.atkT - dt); c.iframes = Math.max(0, c.iframes - dt); c.flashT = Math.max(0, c.flashT - dt); c.atkCd = Math.max(0, c.atkCd - dt); c.eagle = Math.max(0, c.eagle - dt); c.eagleCd = Math.max(0, c.eagleCd - dt); c.hurtT = Math.max(0, c.hurtT - dt);
    c.ivaleraCd = Math.max(0, c.ivaleraCd - dt); c.ivaleraT = Math.max(0, c.ivaleraT - dt);
    if (c.dead) { c.deadT += dt; a.as.dead = c.deadT * 1.4; a.as.atk = ''; a.as.mv = 0; rig.root.position.set(a.x, 0, a.z); rig.root.rotation.y = a.fa; animate(rig, a.as); this.updIvalera(a, dt); if (c.deadT > 6) { c.dead = false; c.hp = c.maxHp * 0.5; c.deadT = 0; a.x = this.p.x + 1.5; a.z = this.p.z + 1.5; } return; }
    // Ivalera cura automática: 40% da vida máxima, recarga 60s, somente quando necessário
    if (c.ivaleraCd <= 0 && c.hp < c.maxHp * 0.6 && c.hp > 0) {
      c.hp = Math.min(c.maxHp, c.hp + c.maxHp * IVALERA_HEAL); c.ivaleraCd = IVALERA_CD; c.ivaleraT = 1.2;
      this.burst(a.x, 1.3, a.z, 26, 0xffb0e0, 4, 0.22, 0.9, -1, true); this.ring(a.x, 0.2, a.z, 3, 0xffb0e0, 0.6); A.sfx('heal'); this.cb.msg('m_ivalera');
    }
    const fb = this.cBuff ? FARNESE_BUFF : null;
    const regen = this.cs.regen * this.diff.stamRegen * (fb ? fb.stamRegen : 1);
    let mv = 0, run = false;
    if (in_) {
      const sp = (in_.run && c.stam > 5 ? 8.6 : 5.6) * (fb ? fb.moveSpd : 1); const sf = this.cs.spd;
      if (in_.mx || in_.mz) { const l = Math.hypot(in_.mx, in_.mz) || 1; const vx = in_.mx / l * sp * sf, vz = in_.mz / l * sp * sf; a.x += vx * dt; a.z += vz * dt; a.fa = turn(a.fa, Math.atan2(in_.mx, in_.mz), dt * 14); mv = Math.min(1.1, sp / 8.6 + 0.3); run = in_.run && c.stam > 5; if (run) { c.stam = Math.max(0, c.stam - 9 * dt); } }
      // dodge
      if (in_.dodge && c.stam >= 18 && a.atkT <= 0) { c.stam -= 18; c.iframes = 0.34; a.atkT = 0.5; a.atk = 'dodge'; a.ap = 0; const dx = in_.mx || Math.sin(a.fa), dz = in_.mz || Math.cos(a.fa); const l = Math.hypot(dx, dz) || 1; a.dx = dx / l; a.dz = dz / l; a.dashT = 0.4; A.sfx('dodge'); }
      // ataque leve/pesado
      if ((in_.light || in_.heavy) && a.atkT <= 0 && c.stam > 6 && a.dashT <= 0) {
        const heavy = in_.heavy; c.stam -= heavy ? 22 : 10; const asp = fb ? fb.atkSpd : 1; a.atkT = (heavy ? 0.6 : 0.42) / asp; a.atk = heavy ? 'heavy' : (c.combo = (c.combo % 3) + 1) >= 3 ? 'l3' : c.combo === 2 ? 'l2' : 'l1'; a.ap = 0;
        const base = (heavy ? 3 : c.combo >= 3 ? 1.7 : 1) * 34 * this.cs.dmg * (c.eagle > 0 ? 1.25 : 1);
        setTimeout(() => {
          if (this.disposed) return; const range = heavy ? 4.3 : 3.6, arc = heavy ? 1.6 : 1.2;
          for (const e of this.enemies) { if (e.dead || e.state === 'intro') continue; const dx = e.x - a.x, dz = e.z - a.z; if (Math.hypot(dx, dz) - e.rad <= range && Math.abs(wrap(Math.atan2(dx, dz) - a.fa)) < arc) this.damageEnemy(e, base * rnd(0.92, 1.08), { kb: heavy ? 9 : 3, heavy, stun: heavy ? 0.9 : 0.25, ally: true, who: 'caska' } as any); }
          this.slashFx(a.x, a.z, a.fa, range, arc, heavy ? 0xffe0a0 : 0xd0e0ff); A.sfx(heavy ? 'heavy' : 'slash');
        }, heavy ? 230 : 130);
      }
      // especial: Determinação da Águia
      if (in_.special && c.eagleCd <= 0) { c.eagle = this.cs.detDur; c.eagleCd = this.cs.detCd; Prof.statSpecial('caska'); this.cb.msg('m_ally', { n: 'Caska', s: 'Determinação da Águia' }); this.ring(a.x, 0.2, a.z, 5, 0xffd860, 0.8); A.sfx('rage'); }
      if (in_.interact) { const sx = a.x, sz = a.z; for (const f of this.world.fires) if (f.usable && !f.used && Math.hypot(f.x - sx, f.z - sz) < 3.2) { f.used = true; c.hp = c.maxHp; c.stam = c.maxStam; this.burst(f.x, 1, f.z, 30, 0xffc060, 5, 0.3, 1, -1, true); } }
    }
    if (a.dashT > 0) { a.dashT -= dt; a.x += a.dx * 12 * Math.max(0, a.dashT / 0.4) * 2 * dt; a.as.dodge = Math.min(1, (0.4 - a.dashT) / 0.4); if (a.dashT <= 0) a.atk = ''; }
    else a.as.dodge = 0;
    // stamina regen
    if (!run) c.stam = Math.min(c.maxStam, c.stam + regen * dt);
    // colisão + separação de inimigos
    for (const e of this.enemies) { if (e.dead || e.state === 'intro') continue; const dx = a.x - e.x, dz = a.z - e.z, d = Math.hypot(dx, dz), mn = e.rad + 0.42; if (d < mn && d > 0.001 && c.iframes <= 0) { a.x += (dx / d) * (mn - d) * 0.5; a.z += (dz / d) * (mn - d) * 0.5; } }
    const q = { x: a.x, z: a.z }; resolve(this.world.cols, q, 0.42); a.x = q.x; a.z = q.z;
    if (c.eagle > 0 && Math.random() < dt * 25 * this.fx) this.burst(a.x, 1.2, a.z, 1, 0xffd860, 2, 0.2, 0.7, -1, true);
    if (a.atkT > 0 && a.atk && a.atk !== 'dodge') { a.ap = clamp(1 - a.atkT / (a.atk === 'heavy' || a.atk === 'l3' ? 0.6 : 0.42), 0, 1); } else if (a.dashT <= 0 && a.atk !== 'dodge') a.atk = '';
    a.as.mv = mv; a.as.run = run; a.as.atk = a.dashT > 0 ? '' : a.atk; a.as.p = a.ap; a.as.rage = c.eagle > 0; a.as.hit = Math.max(0, a.as.hit - dt * 5); if (c.hurtT > 0) a.as.hit = Math.max(a.as.hit, c.hurtT / 0.35);
    rig.root.position.set(a.x, 0, a.z); rig.root.rotation.y = a.fa; animate(rig, a.as);
    if (c.flashT > 0) flash(rig, 0.8, 0xff1010); else if (c.eagle > 0) flash(rig, 0.18, 0xffc040); else if ((a as any)._fl) flash(rig, 0);
    (a as any)._fl = c.flashT > 0 || c.eagle > 0;
    if (in_) { in_.light = in_.heavy = in_.dodge = in_.special = in_.interact = false; }
    this.updIvalera(a, dt);
  }
  updIvalera(a: Ally, dt: number) {
    const iv = this.ivalera; if (!iv) return; this.ivaleraAS.t += dt;
    const ang = a.fa + 2.2, tx = a.x + Math.sin(ang) * 1.1, tz = a.z + Math.cos(ang) * 1.1, ty = 1.9 + Math.sin(this.ivaleraAS.t * 3) * 0.15;
    iv.root.position.x += (tx - iv.root.position.x) * Math.min(1, dt * 6);
    iv.root.position.z += (tz - iv.root.position.z) * Math.min(1, dt * 6);
    iv.root.position.y += (ty - iv.root.position.y) * Math.min(1, dt * 6);
    iv.root.rotation.y = a.fa;
    this.ivaleraAS.mv = 0; this.ivaleraAS.fly = true; animate(iv, this.ivaleraAS);
    if (this.cask.ivaleraT > 0 && Math.random() < dt * 30 * this.fx) this.burst(this.caskaNet!.x + rnd(-0.4, 0.4), rnd(1, 2), this.caskaNet!.z + rnd(-0.4, 0.4), 1, 0xffb0e0, 2, 0.2, 0.7, -1, true);
  }
  hurtAlly(a: Ally, dmg: number) {
    if (!a.maxHp || a.downT > 0 || a.id === 'puck' || a === this.caskaNet) return;
    a.hp -= dmg * this.diff.enemyDmg * 0.6; a.hurtT = 0.3;
    this.burst(a.x, 1.2, a.z, 6, 0x8a0a0a, 3, 0.15, 0.4, 8, false);
    if (a.hp <= 0) { a.hp = 0; a.downT = 12; a.rig.root.visible = false; this.burst(a.x, 1, a.z, 16, 0x6a3030, 4, 0.3, 0.7, 2, false); }
  }
  hurtAlliesNear(cx: number, cz: number, r: number, dmg: number) {
    for (const a of this.allies) { if (a === this.caskaNet) continue; if (Math.hypot(a.x - cx, a.z - cz) < r + 0.5) this.hurtAlly(a, dmg); }
  }
  hurtCaska(dmg: number) {
    const c = this.cask; if (!this.coop || !this.caskaNet || c.dead || c.iframes > 0) return;
    let d = dmg * (1 - CASKA_RED) * (c.eagle > 0 ? 0.75 : 1) * this.diff.enemyDmg; c.hp -= d; c.flashT = 0.15; c.hurtT = 0.35 / (this.cBuff ? FARNESE_BUFF.poise : 1);
    Prof.statDmgTaken('caska', d);
    this.burst(this.caskaNet.x, 1.2, this.caskaNet.z, 10, 0x8a0a0a, 4, 0.18, 0.5, 9, false); A.sfx('hurt');
    if (c.hp <= 0) { c.hp = 0; c.dead = true; c.deadT = 0; A.sfx('die'); this.cb.msg('m_caska_down'); }
  }
  // ---------- snapshot/entrada de rede ----------
  applyRemoteInput(d: any) {
  this.remoteInput = d;
  console.log("REMOTE INPUT:", d);
}
  packP(x: number, z: number, fa: number, as: AS, hp: number, mhp: number, st: number, mst: number) {
    return { x: +x.toFixed(2), z: +z.toFixed(2), fa: +fa.toFixed(2), a: aIdx(as.atk), p: +as.p.toFixed(2), mv: +as.mv.toFixed(2), dg: +as.dodge.toFixed(2), hit: +as.hit.toFixed(2), dead: +as.dead.toFixed(2), stun: as.stun ? 1 : 0, blk: as.block ? 1 : 0, rage: as.rage ? 1 : 0, fly: as.fly ? 1 : 0, hp: Math.round(hp), mhp: Math.round(mhp), st: Math.round(st), mst: Math.round(mst) };
  }
  netSnapshot(): any {
    const gs = this.gs, p = this.p, ca = this.caskaNet, c = this.cask;
    const en: number[][] = [];
    for (const e of this.enemies) { if (e.boss) continue; en.push([e.nid, ETYPES.indexOf(e.id), +e.x.toFixed(2), +e.z.toFixed(2), +e.fa.toFixed(2), aIdx(e.as.atk), +e.as.p.toFixed(2), +e.as.mv.toFixed(2), +(e.hp / e.max).toFixed(3), e.dead ? 1 : 0, +e.rig.root.scale.x.toFixed(2), +e.y.toFixed(2)]); }
    const b = this.boss && !this.boss.dead ? this.boss : (this.boss && this.boss.dead && this.boss.deadT < 4 ? this.boss : null);
    const bo = b ? [BTYPES.indexOf(b.id), +b.x.toFixed(2), +b.z.toFixed(2), +b.fa.toFixed(2), aIdx(b.as.atk), +b.as.p.toFixed(2), +b.as.mv.toFixed(2), Math.round(Math.max(0, b.hp)), Math.round(b.max), b.phase, b.boss!.phases, +b.y.toFixed(2), b.dead ? 1 : 0] : null;
    const pr: number[][] = [];
    for (const q of this.projs) { if (pr.length > 40) break; pr.push([+q.x.toFixed(1), +q.y.toFixed(1), +q.z.toFixed(1), Math.max(0, PRKINDS.indexOf(q.kind))]); }
    return {
      t: +this.time.toFixed(2),
      gu: this.packP(p.x, p.z, p.fa, this.as, p.hp, gs.maxHp, p.stam, gs.maxStam),
      ca: ca ? this.packP(ca.x, ca.z, ca.fa, ca.as, c.hp, c.maxHp, c.stam, c.maxStam) : null,
      en, bo, pr, ob: this.objective(), ki: this.kills, tg: this.ld.kills, pt: this.combat, cine: this.cine,
      guRage: { v: Math.round(p.rage), on: p.rageT > 0 }, caEagle: { cd: Math.round(c.eagleCd), on: c.eagle > 0, max: Math.round(this.cs.detCd) },
      gBars: this.allyBarsFor('guts'), cBars: this.allyBarsFor('caska'), buffGuts: this.gBuff, buffCaska: this.cBuff,
      ivalera: { cd: Math.round(c.ivaleraCd), max: IVALERA_CD, active: c.ivaleraT > 0 }, diff: this.diffName(),
      ivPos: this.ivalera ? [+this.ivalera.root.position.x.toFixed(2), +this.ivalera.root.position.y.toFixed(2), +this.ivalera.root.position.z.toFixed(2)] : null,
    };
  }
  summonMinions(a: Ally, type: string, n: number, hp: number, dmg: number) {
    A.sfx('summon'); this.ring(a.x, 0.2, a.z, 4, type === 'imp' ? 0xff3060 : 0xd8d8f0, 0.7);
    for (let i = 0; i < n; i++) {
      const an = a.fa + (i - (n - 1) / 2) * 0.9, x = a.x + Math.sin(an) * 2.5, z = a.z + Math.cos(an) * 2.5;
      const rig = buildEnemy(type); own(rig); if (type === 'imp') rig.root.scale.setScalar(1.1); this.scene.add(rig.root);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 32), new THREE.MeshBasicMaterial({ color: 0xa0c8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -PI / 2; this.scene.add(ring);
      this.golems.push({ rig, as: newAS(), x, z, fa: an, life: 9999, atkT: 0.5, ring, ap: 1, hp, maxHp: hp, dmg, minion: true });
      this.burst(x, 1, z, 14, 0xa0c8ff, 5, 0.25, 0.7, -1, true);
    }
  }
  hurtMinionsArc(e: En, range: number, half: number, dmg: number) {
    for (const g of [...this.golems]) {
      if (!g.minion || g.hp == null) continue; const dx = g.x - e.x, dz = g.z - e.z;
      if (Math.hypot(dx, dz) - 0.4 > range || Math.abs(wrap(Math.atan2(dx, dz) - e.fa)) > half) continue;
      g.hp -= dmg * this.diff.enemyDmg * 0.7; this.burst(g.x, 1, g.z, 6, 0x8a0a0a, 3, 0.15, 0.4, 8, false);
      if (g.hp <= 0) { const pi2 = (g as any).post; if (pi2 != null && this.posts[pi2]) { this.posts[pi2].unit = null; this.defAlert('m_def_unit', undefined, 6); } this.burst(g.x, 1, g.z, 16, 0x6a3030, 4, 0.3, 0.7, 2, false); this.scene.remove(g.rig.root, g.ring); (g.ring.material as THREE.Material).dispose(); disposeRig(g.rig); this.golems.splice(this.golems.indexOf(g), 1); }
    }
  }
  summonGolems(s: Ally) {
    this.cb.msg('m_ally', { n: 'Schierke', s: 'Golem de Pedra' }); A.sfx('summon');
    for (let i = 0; i < 2; i++) {
      const a = this.p.fa + (i ? 1 : -1) * 1.2, x = this.p.x + Math.sin(a) * 3.5, z = this.p.z + Math.cos(a) * 3.5;
      const rig = buildGolem(); own(rig); this.scene.add(rig.root);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -PI / 2; this.scene.add(ring);
      this.golems.push({ rig, as: newAS(), x, z, fa: a, life: 15, atkT: 0.5, ring, ap: 1 }); this.ring(x, 0.2, z, 4, 0xff8a2a, 0.7); this.burst(x, 0.3, z, 20, 0x8a8a80, 6, 0.4, 0.8, 8, false);
    }
    void s;
  }

  // ---------- efeitos ----------
  geo(k: string, f: () => THREE.BufferGeometry) { let g = this.geoCache.get(k); if (!g) { g = f(); this.geoCache.set(k, g); } return g; }
  fmat(c: number, o = 0.8) { const k = c + '_' + o; let m = this.matCache.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }); this.matCache.set(k, m); } return m as THREE.MeshBasicMaterial; }
  burst(x: number, y: number, z: number, n: number, c: number, sp: number, size: number, life: number, grav: number, add: boolean) {
    const ps = add ? this.psA : this.psN; n = Math.ceil(n * this.fx);
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, u = rnd(-0.3, 1), s = sp * rnd(0.3, 1); ps.emit(x, y, z, Math.cos(a) * s * (1 - Math.abs(u) * 0.4), u * s, Math.sin(a) * s * (1 - Math.abs(u) * 0.4), c, 0.95, size * rnd(0.6, 1.3), life * rnd(0.6, 1.1), grav); }
  }
  ring(x: number, y: number, z: number, r: number, c: number, life: number) {
    if (this.fxs.length > 40) return;
    const m = new THREE.Mesh(this.geo('ring', () => new THREE.RingGeometry(0.82, 1, 40)), this.fmat(c, 0.8).clone()); m.rotation.x = -PI / 2; m.position.set(x, y, z); this.scene.add(m);
    this.fxs.push({ m, life, max: life, kind: 'ring', s0: 0.3, s1: r, mat: m.material as THREE.Material });
  }
  slashFx(x: number, z: number, fa: number, range: number, arc: number, c: number, y = 1.1) {
    if (this.fxs.length > 40) return;
    const k = 'arc' + arc.toFixed(1); const m = new THREE.Mesh(this.geo(k, () => new THREE.RingGeometry(0.55, 1, 24, 1, -PI / 2 - arc, arc * 2)), this.fmat(c, 0.9).clone());
    m.rotation.x = -PI / 2; const g = new THREE.Group(); g.add(m); g.position.set(x, y, z); g.rotation.y = fa; this.scene.add(g);
    this.fxs.push({ m: g, life: 0.2, max: 0.2, kind: 'slash', s0: range * 0.7, s1: range * 1.05, mat: m.material as THREE.Material });
  }
  updFx(dt: number) {
    for (let i = this.fxs.length - 1; i >= 0; i--) {
      const f = this.fxs[i]; f.life -= dt; const k = 1 - f.life / f.max;
      f.m.scale.setScalar(f.s0 + (f.s1 - f.s0) * Math.min(1, k * 1.2)); (f.mat as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
      if (f.life <= 0) { this.scene.remove(f.m); f.mat?.dispose(); this.fxs.splice(i, 1); }
    }
  }
  makeTele(kind: string, len: number, wid: number, col = 0xff2a1a): Tele {
    const g = new THREE.Group(); let gg: THREE.BufferGeometry;
    if (kind === 'circle') gg = this.geo('tc', () => new THREE.CircleGeometry(1, 40).rotateX(-PI / 2));
    else if (kind === 'cone') gg = this.geo('tcone' + wid.toFixed(2), () => new THREE.CircleGeometry(1, 28, -PI / 2 - wid, wid * 2).rotateX(-PI / 2));
    else gg = this.geo('tl', () => new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2).translate(0, 0, 0.5));
    const o = new THREE.Mesh(gg, this.fmat(col, 0.18)), f = new THREE.Mesh(gg, this.fmat(col, 0.5));
    g.add(o, f); g.position.y = 0.06; o.renderOrder = 2; f.renderOrder = 3;
    if (kind === 'line') o.scale.set(wid, 1, len); else o.scale.set(len, 1, len);
    this.scene.add(g); return { g, fill: f, kind, len, wid };
  }
  setTele(t: Tele, p: number) { p = clamp(p, 0.02, 1); if (t.kind === 'line') t.fill.scale.set(t.wid, 1, t.len * p); else t.fill.scale.set(t.len * p, 1, t.len * p); }
  rmTele(e: En) { if (e.tele) { this.scene.remove(e.tele.g); e.tele = null; } }

  // ---------- projéteis ----------
  shoot(x: number, y: number, z: number, tx: number, ty: number, tz: number, dmg: number, fr: boolean, kind: string, spd = 0, spread = 0) {
    let dx = tx - x, dz = tz - z, dy = ty - y; const d = Math.hypot(dx, dy, dz) || 1; dx /= d; dy /= d; dz /= d;
    if (spread) { const a = Math.atan2(dx, dz) + spread, h = Math.hypot(dx, dz); dx = Math.sin(a) * h; dz = Math.cos(a) * h; }
    const sp = spd || { bolt: 40, cannon: 32, orb: 15, spit: 14, wave: 13, ebolt: 22 }[kind] || 20;
    const col = kind === 'spit' ? 0x9aff30 : kind === 'orb' ? (this.boss ? PROJ_COL[this.boss.id] : 0xff7030) : 0xffffff;
    const m = kind === 'wave' ? new THREE.Mesh(this.geo('wave', () => new THREE.BoxGeometry(5, 0.5, 0.6)), this.fmat(this.boss ? PROJ_COL[this.boss.id] : 0xff5030, 0.7))
      : kind === 'bolt' || kind === 'ebolt' ? new THREE.Mesh(this.geo('bolt', () => new THREE.BoxGeometry(0.06, 0.06, 0.7)), new THREE.MeshBasicMaterial({ color: kind === 'bolt' ? 0xe8e0c0 : 0xffb060 }))
        : kind === 'cannon' ? new THREE.Mesh(this.geo('cb', () => new THREE.SphereGeometry(0.24, 10, 8)), new THREE.MeshBasicMaterial({ color: 0x222222 }))
          : new THREE.Mesh(this.geo('orb', () => new THREE.SphereGeometry(0.3, 10, 8)), this.fmat(col, 0.95));
    m.position.set(x, y, z); this.scene.add(m);
    const pr: Proj = { m, x, y, z, vx: dx * sp, vy: dy * sp, vz: dz * sp, dmg, fr, life: kind === 'wave' ? 1.8 : 2.2, kind, rad: kind === 'wave' ? 2.4 : kind === 'cannon' ? 0.5 : 0.35, hit: false, aoe: kind === 'cannon' ? 4.2 : 0 };
    m.rotation.y = Math.atan2(dx, dz); this.projs.push(pr); return pr;
  }
  explode(x: number, y: number, z: number, r: number, dmg: number) {
    this.burst(x, y, z, 50, 0xff8a20, 12, 0.5, 0.7, -2, true); this.burst(x, y, z, 25, 0x333030, 8, 0.7, 1.1, -1, false); this.ring(x, 0.2, z, r * 1.1, 0xffa040, 0.5); A.sfx('explosion');
    this.shake = Math.max(this.shake, clamp(1.2 - Math.hypot(x - this.p.x, z - this.p.z) / 30, 0.2, 1));
    for (const e of this.enemies) if (!e.dead && e.state !== 'intro' && Math.hypot(e.x - x, e.z - z) < r + e.rad) this.damageEnemy(e, dmg, { kb: 11, heavy: true, stun: 1, ally: false, noRage: false });
    for (const b of this.behelits) if (b.alive && Math.hypot(b.x - x, b.z - z) < r + 1.2) this.hurtBehelit(b, dmg);
  }
  updProj(dt: number) {
    const p = this.p;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const q = this.projs[i]; q.life -= dt; let kill = q.life <= 0;
      if (q.kind === 'cannon') q.vy -= 3 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.m.position.set(q.x, q.y, q.z);
      if (q.kind === 'orb' || q.kind === 'spit' || q.kind === 'cannon') { if (Math.random() < 0.6 * this.fx) this.psA.emit(q.x, q.y, q.z, rnd(-0.5, 0.5), rnd(-0.5, 0.5), rnd(-0.5, 0.5), q.kind === 'spit' ? 0x9aff30 : q.kind === 'cannon' ? 0xff8030 : 0xff5030, 0.8, 0.3, 0.3, 0); }
      if (q.kind === 'wave' && Math.random() < 0.8 * this.fx) this.burst(q.x, 0.3, q.z, 2, 0xff6030, 2, 0.4, 0.4, 0, true);
      if (!kill && q.kind !== 'wave' && blocked(this.world.cols, q.x, q.z, 0.15, q.y)) kill = true;
      if (!kill && q.y < 0.05) { if (q.kind === 'wave') q.y = 0.3; else kill = true; }
      if (!kill && q.fr) {
        for (const e of this.enemies) if (!e.dead && e.state !== 'intro' && Math.hypot(e.x - q.x, e.z - q.z) < e.rad + q.rad && q.y < 2.8 * e.def.scale) {
          if (q.kind === 'cannon') { kill = true; break; }
          this.damageEnemy(e, q.dmg, { kb: 1.5, ally: false, stun: 0.1, bolt: true }); kill = true; break;
        }
        if (!kill) for (const b of this.behelits) if (b.alive && Math.hypot(b.x - q.x, b.z - q.z) < 1.4 && q.y < 3) { this.hurtBehelit(b, q.dmg); if (q.kind !== 'cannon') kill = true; else kill = true; }
      } else if (!kill && !q.fr && !p.dead) {
        if (Math.hypot(p.x - q.x, p.z - q.z) < 0.55 + q.rad && q.y < 2.2 && q.y > -0.5 && !q.hit) {
          this.hurtPlayer(q.dmg, { x: q.x - q.vx, z: q.z - q.vz }, {}); if (q.kind === 'wave') q.hit = true; else kill = true;
        }
        const ca = this.caskaNet; if (!kill && ca && !this.cask.dead && Math.hypot(ca.x - q.x, ca.z - q.z) < 0.55 + q.rad && q.y < 2.2 && q.y > -0.5 && !q.hit) { this.hurtCaska(q.dmg); if (q.kind === 'wave') q.hit = true; else kill = true; }
      }
      if (kill) {
        if (q.kind === 'cannon') this.explode(q.x, Math.max(0.3, q.y), q.z, q.aoe, q.dmg);
        else if (q.kind === 'spit') { this.burst(q.x, q.y, q.z, 8, 0x9aff30, 3, 0.3, 0.4, 6, true); }
        else this.burst(q.x, q.y, q.z, 5, 0xffd080, 3, 0.15, 0.25, 4, true);
        this.scene.remove(q.m); this.projs.splice(i, 1);
      }
    }
  }

  // ---------- dano ----------
  hurtBehelit(b: Behelit, d: number) {
    if (!b.alive) return; b.hp -= d; this.burst(b.x, 1.5, b.z, 10, 0xff3020, 5, 0.3, 0.5, 4, true); A.sfx('clang');
    (b.g.userData.body as THREE.Mesh).scale.multiplyScalar(0.995);
    if (b.hp <= 0) {
      b.alive = false; this.scene.remove(b.g); this.explode(b.x, 1.5, b.z, 6, 0); A.sfx('behelit');
      const left = this.behelits.filter((x) => x.alive).length; this.cb.msg(left ? 'm_behelit_down' : 'm_behelit_all', { left });
      for (let i = 0; i < 2; i++) this.spawnEnemy(this.pickId(), b.x + rnd(-3, 3), b.z + rnd(-3, 3), true, true);
      const c = this.world.cols.findIndex((c) => c.x === b.x && c.z === b.z); if (c >= 0) this.world.cols.splice(c, 1);
    }
  }
  hurtPlayer(dmg: number, src: { x: number; z: number }, o: { unblock?: boolean; noStagger?: boolean }) {
    const p = this.p; if (p.dead || p.iframes > 0 || this.cine === 'intro' || this.endT >= 0) return false;
    let d = dmg * this.gs.takeMul * this.diff.enemyDmg; if (this.save.armorEq && p.hp < this.gs.maxHp * 0.35) d *= 0.9;
    if (this.eagle > 0) d *= 0.8;
    const toSrc = Math.atan2(src.x - p.x, src.z - p.z); let stagger = true;
    if (p.block && !o.unblock && Math.abs(wrap(toSrc - p.fa)) < 1.2 && p.state === 'free') {
      const cost = d * 0.9;
      if (p.stam >= cost) { p.stam -= cost; p.stamDelay = 1.0; d *= 0.2; stagger = false; A.sfx('clang'); this.burst(p.x + Math.sin(p.fa) * 0.8, 1.2, p.z + Math.cos(p.fa) * 0.8, 10, 0xffe8a0, 5, 0.12, 0.3, 8, true); }
      else { p.stam = 0; p.exhausted = true; d *= 0.8; p.block = false; this.cb.msg('m_guardbreak'); p.stamDelay = 1.5; }
    }
    if (this.shield > 0) { const a = Math.min(this.shield, d); this.shield -= a; d -= a; this.burst(p.x, 1.3, p.z, 6, 0xfff0a0, 3, 0.15, 0.4, 0, true); }
    p.hp -= d; p.flashT = 0.15; if (d > 0.5) Prof.statDmgTaken('guts', d);
    if (d > 0.5) { this.p.rage = Math.min(100, p.rage + d * 0.3 * this.gs.rageGain * (this.gBuff ? SCHIERKE_BUFF.rageGain : 1)); this.burst(p.x, 1.2, p.z, 12, 0x8a0a0a, 4, 0.18, 0.5, 9, false); if (stagger) { A.sfx('hurt'); this.shake = Math.max(this.shake, 0.5); } }
    if (stagger && !o.noStagger && d > 0.5 && p.rageT <= 0 && p.state !== 'dodge') { p.state = 'hurt'; p.st = 0; p.atk = null; p.an = ''; const a = Math.atan2(p.x - src.x, p.z - src.z); p.vx = Math.sin(a) * 5; p.vz = Math.cos(a) * 5; }
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deadT = 0; p.state = 'dead'; this.diedOnce = true; A.sfx('die'); Prof.statDeath(); this.cb.msg('m_dead'); if (!this.coop) this.endT = 0; else this.cb.msg('m_guts_down'); }
    return true;
  }
  damageEnemy(e: En, dmg: number, o: { kb?: number; stun?: number; heavy?: boolean; ally?: boolean; pierce?: boolean; noRage?: boolean; bolt?: boolean; who?: 'guts' | 'caska' }) {
    if (e.dead || e.state === 'intro') return false;
    const who = o.who || (o.ally ? null : 'guts');
    let d = dmg * this.diff.playerDmg; if (who === 'guts' && this.gBuff) d *= SCHIERKE_BUFF.dmg;
    if (who) Prof.statDmgDealt(who, Math.round(d));
    const ax = this.p.x, az = this.p.z;
    const toA = Math.atan2(ax - e.x, az - e.z);
    if (e.guarding && !o.pierce && Math.abs(wrap(toA - e.fa)) < 1.1) {
      if (!o.heavy) { d *= 0.12; this.burst(e.x + Math.sin(e.fa) * 0.8, 1.2, e.z + Math.cos(e.fa) * 0.8, 8, 0xffe8a0, 5, 0.12, 0.3, 8, true); A.sfx('clang'); e.kx -= Math.sin(toA) * 1; e.kz -= Math.cos(toA) * 1; e.hp -= d; e.flashT = 0.05; return true; }
      e.state = 'stun'; e.stunT = 1.3; e.guarding = false; d *= 0.8; this.cb.msg('m_guardbreak');
    }
    if (e.boss && e.state === 'stun') d *= 1.25;
    e.hp -= d; e.flashT = 0.12; e.hitT = 1; e.aggro = true; e.poiseT = 4;
    this.burst(e.x, 1.2 * e.def.scale, e.z, e.boss ? 10 : 14, e.def.id === 'ghoul' || e.id === 'spitter' ? 0x2a3a1a : 0x8a0a0a, 5, 0.2, 0.55, 10, false);
    A.sfx(o.heavy ? 'hitHeavy' : 'hit');
    if (!o.ally && !o.noRage && this.p.rageT <= 0) this.p.rage = Math.min(100, this.p.rage + d * 0.18 * this.gs.rageGain * (this.gBuff ? SCHIERKE_BUFF.rageGain : 1));
    e.poise -= o.heavy ? d * 1.5 : d * (o.bolt ? 0.3 : 1);
    const big = e.def.cls === 'mini' || e.boss;
    if (e.poise <= 0 && e.state !== 'stun') {
      e.poise = e.pmax; e.state = 'stun'; e.stunT = e.boss ? 1.5 : e.def.cls === 'mini' ? 1.2 : e.def.cls === 'common' ? 0.55 : 0.9; e.st = 0; this.rmTele(e); this.releaseToken(e); e.guarding = false; e.cd = 0.4;
      if (e.boss) this.cb.msg('m_poise');
    }
    e.as.hit = 1;
    const kb = (o.kb || 0) * (big ? 0.12 : 1) / Math.max(0.8, e.def.scale * 0.8); const a = Math.atan2(e.x - ax, e.z - az); e.kx += Math.sin(a) * kb * 3; e.kz += Math.cos(a) * kb * 3;
    if (!o.ally && !o.bolt) { this.hitStop = Math.max(this.hitStop, o.heavy ? 0.1 : 0.05); this.shake = Math.max(this.shake, o.heavy ? 0.6 : 0.25); }
    if (e.boss) { const np = Math.min(e.boss.phases, Math.floor((1 - Math.max(0, e.hp) / e.max) * e.boss.phases) + 1); if (np > e.phase && e.hp > 0) this.bossPhase(e, np); }
    // Mozgus só pode cair depois dos seis discípulos
    if (e.boss && e.id === 'mozgus' && e.hp <= 0 && this.enemies.some((q) => !q.dead && this.mozgusMinis.includes(q.nid))) { e.hp = 1; if (!(this as any)._mzWarn) { (this as any)._mzWarn = true; this.cb.msg('m_mozgus_minis'); setTimeout(() => { (this as any)._mzWarn = false; }, 4000); } }
    if (e.hp <= 0) { this._lastKiller = who || 'guts'; this.killEnemy(e); }
    return true;
  }
  bossPhase(e: En, np: number) {
    e.phase = np; this.cb.msg('m_phase', { n: np }); A.sfx('roar'); this.ring(e.x, 0.2, e.z, 14, 0xff3020, 1); this.shake = 1; this.burst(e.x, 1.5, e.z, 60, 0xff4020, 10, 0.5, 0.9, -1, true);
    // Fase 4 da campanha: na 2ª fase de Zodd, a criatura das águas emerge do poço da praça
    if (this.defCam && this.lv === 4 && np === 2 && !(this as any)._aqua) {
      (this as any)._aqua = 1;
      const q = this.spawnEnemy('spitter', 3, -1, true, true, true);
      q.rig.root.scale.setScalar(ENEMIES.spitter.scale * 1.8); q.rad *= 1.8; q.hp = q.max = Math.round(420 * this.diff.enemyHp); q.dmgMul *= 1.3;
      q.rig.mats.forEach((m) => { if (!m.transparent) m.color.lerp(new THREE.Color(0x3a7a9a), 0.55); });
      this.cb.msg('m_seabeast'); this.burst(3, 1, -1, 40, 0x6ac8e8, 8, 0.4, 1, -1, true); this.ring(3, 0.2, -1, 6, 0x6ac8e8, 1);
    }
    e.state = 'stun'; e.stunT = 1.2; e.poise = e.pmax; this.rmTele(e); e.next = e.boss!.p2.length ? 'summon' : ''; e.summonCd = 0; e.as.hit = 0;
  }
  releaseToken(e: En) { e.token = false; }
  killEnemy(e: En) {
    e.dead = true; e.state = 'dead'; e.deadT = 0; this.rmTele(e); this.releaseToken(e); if (e.bar) e.bar.forEach((s) => (s.visible = false));
    A.sfx(e.boss ? 'bossDie' : 'die'); this.burst(e.x, 1, e.z, e.boss ? 80 : 18, e.boss ? 0xffe0a0 : 0x8a0a0a, e.boss ? 12 : 5, 0.3, 0.8, e.boss ? -1 : 9, !!e.boss);
    if ((e as any).bounty) { this.bountyOk = true; this.cb.msg('m_bounty_down', { id: (e as any).bounty }); A.sfx('win'); }
    if ((e as any).hunt) { this.missionOk = true; this.cb.msg('m_hunt_down'); }
    const isDummy = !!(e as any).dummy, extra = this.mode !== 'campaign';
    if ((!e.summoned || extra) && !isDummy) { this.combat += e.mini ? POINTS.mini : POINTS[e.def.cls]; if (!e.mini && !e.boss) this.kills++; }
    if ((!e.summoned || extra) && !isDummy) { Prof.statKill(this._lastKiller, this.coop); this.streak++; Prof.statStreak(this.streak); if (e.boss) Prof.statBoss(this._lastKiller, this.coop); }
    if (e.mini) { this.minisDead++; if (!extra) this.cb.msg('m_mini_down'); }
    if (e.boss && extra && !(this.mode === 'dungeon' && this.waveBossOn)) {
      // arena: chefe derrotado é só o fim da onda
      this.boss = null; this.bossSpawned = false; this.bossDead = false; this.cb.msg('m_boss_down'); this.shake = 1; if (this.lockT === e) this.lockT = null; this.combat += 150; return;
    }
    if (e.boss) { this.bossDead = true; this.endT = 0; this.slow = 0.3; this.shake = 1; this.cb.msg('m_boss_down'); this.cine = 'bossdown'; this.cineT = 0; for (const o of this.enemies) if (o !== e && !o.dead) { o.dead = true; o.state = 'dead'; o.deadT = 0; this.rmTele(o); if (o.bar) o.bar.forEach((s) => (s.visible = false)); this.burst(o.x, 1, o.z, 10, 0xffe0a0, 5, 0.3, 0.8, -1, true); } this.lockT = null; }
    if (this.lockT === e) this.lockT = null;
  }

  // ---------- jogador ----------
  aimAngle(maxD: number, maxA: number, ref: number): number | null {
    let best: number | null = null, bs = 1e9;
    for (const e of this.enemies) { if (e.dead || e.state === 'intro') continue; const dx = e.x - this.p.x, dz = e.z - this.p.z, d = Math.hypot(dx, dz); if (d > maxD) continue; const a = Math.atan2(dx, dz), da = Math.abs(wrap(a - ref)); if (da > maxA) continue; const s = d + da * 4; if (s < bs) { bs = s; best = a; } }
    return best;
  }
  moveDir(): { x: number; z: number; has: boolean } {
    const ix = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0), iz = (this.down('fwd') ? 1 : 0) - (this.down('back') ? 1 : 0);
    if ((!ix && !iz) || this.cine) return { x: 0, z: 0, has: false };
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw); let mx = ix * cy - iz * sy, mz = -ix * sy - iz * cy; const l = Math.hypot(mx, mz); return { x: mx / l, z: mz / l, has: true };
  }
  startAtk(key: string) {
    const p = this.p, a = ATK[key]; if (p.stam <= 0) { this.noStamMsg(); return; }
    p.stam = Math.max(0, p.stam - a.stam); p.stamDelay = 0.9; if (p.stam <= 0) p.exhausted = true;
    p.state = 'attack'; p.atk = a; p.an = key; p.st = 0; p.hitDone = false; p.buf = '';
    const m = this.moveDir(); let fa = p.fa;
    if (this.lockT && !this.lockT.dead) fa = Math.atan2(this.lockT.x - p.x, this.lockT.z - p.z); else if (m.has) fa = Math.atan2(m.x, m.z); else { const t = this.aimAngle(5, 1.2, p.fa); if (t != null) fa = t; }
    p.fa = fa; p.vx = Math.sin(fa) * a.lunge; p.vz = Math.cos(fa) * a.lunge;
    if (key === 'heavy') this.tutDone.add('heavy'); else this.tutDone.add('light');
  }
  perfHit(a: AtkDef, key: string) {
    const p = this.p; let hits = 0; const heavy = key === 'heavy';
    const base = 34 * a.mult * this.gs.dmgMul * (p.rageT > 0 ? this.gs.rageMul : 1);
    for (const e of this.enemies) {
      if (e.dead || e.state === 'intro') continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) - e.rad;
      if (d > a.range || Math.abs(wrap(Math.atan2(dx, dz) - p.fa)) > a.arc) continue;
      if (this.damageEnemy(e, base * rnd(0.94, 1.06), { kb: a.kb, heavy, stun: a.stun })) hits++;
    }
    for (const b of this.behelits) if (b.alive) { const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < a.range + 1 && Math.abs(wrap(Math.atan2(b.x - p.x, b.z - p.z) - p.fa)) < a.arc + 0.3) { this.hurtBehelit(b, base); hits++; } }
    const ff = this.falconFlag;
    if (ff && ff.alive && Math.hypot(ff.x - p.x, ff.z - p.z) < a.range + 1 && Math.abs(wrap(Math.atan2(ff.x - p.x, ff.z - p.z) - p.fa)) < a.arc + 0.3) {
      ff.hp -= base; this.burst(ff.x, 2.5, ff.z, 8, 0xf0f0f0, 4, 0.2, 0.5, 5, false); A.sfx('clang');
      if (ff.hp <= 0) { ff.alive = false; this.scene.remove(ff.g); const S = this.save.secret; if (!S.fLvls.includes(this.lv)) S.fLvls.push(this.lv); this.cb.secret?.('fLvl', { lv: this.lv }); this.cb.msg('m_sec_flagd', { a: S.fLvls.length }); this.burst(ff.x, 2, ff.z, 24, 0xf0f0f0, 6, 0.3, 0.9, 4, false); }
    }
    this.slashFx(p.x, p.z, p.fa, a.range, a.arc, p.rageT > 0 ? 0xff5030 : heavy ? 0xffe0a0 : 0xffffff);
    A.sfx(heavy ? 'heavy' : 'slash');
    if (heavy) { this.shake = Math.max(this.shake, 0.4); this.burst(p.x + Math.sin(p.fa) * 3.2, 0.2, p.z + Math.cos(p.fa) * 3.2, 14, 0x6a5a4a, 5, 0.3, 0.6, 8, false); this.ring(p.x + Math.sin(p.fa) * 3, 0.1, p.z + Math.cos(p.fa) * 3, 2.6, 0xffe0a0, 0.3); }
    return hits;
  }
  noStamMsg() { if (this.time - this.noStamT > 1.5) { this.noStamT = this.time; this.cb.msg('m_noStam'); } }
  startDodge() {
    const p = this.p; if (p.stam <= 0) { this.noStamMsg(); return; }
    p.stam = Math.max(0, p.stam - 20 * (this.eagle > 0 ? 0.7 : 1)); p.stamDelay = 0.8; if (p.stam <= 0) p.exhausted = true;
    const m = this.moveDir(); let dx = m.x, dz = m.z, sp = 13;
    if (!m.has) { dx = -Math.sin(p.fa); dz = -Math.cos(p.fa); sp = 9; } else p.fa = Math.atan2(dx, dz);
    p.ddx = dx; p.ddz = dz; p.dodgeSpd = sp * (p.rageT > 0 ? 1.1 : 1); p.state = 'dodge'; p.st = 0; p.atk = null; p.an = ''; A.sfx('dodge'); this.tutDone.add('dodge'); this.burst(p.x, 0.2, p.z, 6, 0x8a7a6a, 3, 0.3, 0.5, 4, false);
  }
  fireCannon() {
    if (this.hero !== 'guts') return;
    const p = this.p; if (p.cannon <= 0) { this.cb.msg('m_noAmmo'); return; }
    p.cannon--; if (p.cannon < 3 && p.cannonCd <= 0) p.cannonCd = 8; p.state = 'cast'; p.castT = 0; p.an = 'shootL'; p.fired = false; p.st = 0; p.atk = null; this.tutDone.add('cannon');
    const t = this.lockT && !this.lockT.dead ? Math.atan2(this.lockT.x - p.x, this.lockT.z - p.z) : this.aimAngle(35, 0.4, this.yaw + PI) ?? (this.yaw + PI); p.fa = t;
  }
  playerCast(dt: number) {
    const p = this.p; p.st += dt;
    if (p.an === 'shootL' && !p.fired && p.st > 0.22) {
      p.fired = true; this.rig.x.muzzleL.getWorldPosition(this.tmpV);
      const tg = this.lockT && !this.lockT.dead ? this.lockT : this.enemies.find((e) => !e.dead && Math.abs(wrap(Math.atan2(e.x - p.x, e.z - p.z) - p.fa)) < 0.3 && Math.hypot(e.x - p.x, e.z - p.z) < 35);
      const tx = tg ? tg.x : p.x + Math.sin(p.fa) * 30, tz = tg ? tg.z : p.z + Math.cos(p.fa) * 30;
      this.shoot(this.tmpV.x, this.tmpV.y, this.tmpV.z, tx, tg ? 1.1 : 1.3, tz, 120 * this.gs.dmgMul * (p.rageT > 0 ? this.gs.rageMul : 1), true, 'cannon');
      this.burst(this.tmpV.x, this.tmpV.y, this.tmpV.z, 24, 0xffb050, 8, 0.35, 0.5, 0, true); this.burst(this.tmpV.x, this.tmpV.y, this.tmpV.z, 10, 0x555050, 4, 0.5, 0.9, -1, false); A.sfx('cannon'); this.shake = Math.max(this.shake, 0.55);
      p.vx = -Math.sin(p.fa) * 5; p.vz = -Math.cos(p.fa) * 5;
    }
    if (p.st > 0.6) { p.state = 'free'; p.an = ''; }
    p.vx *= Math.exp(-6 * dt); p.vz *= Math.exp(-6 * dt);
  }
  tmpV = new THREE.Vector3();
  fireBolt() {
    if (this.hero !== 'guts') return;
    const p = this.p; if (p.reload > 0 || p.boltCd > 0) return;
    if (p.bolts <= 0) { p.reload = 2.2; A.sfx('reload'); this.cb.msg('m_reload'); return; }
    p.bolts--; p.boltCd = 0.17; p.shootT = 0.3; this.tutDone.add('xbow');
    this.rig.x.muzzleR.getWorldPosition(this.tmpV);
    const aim = this.lockT && !this.lockT.dead ? Math.atan2(this.lockT.x - p.x, this.lockT.z - p.z) : this.aimAngle(35, 0.35, this.yaw + PI) ?? (this.yaw + PI);
    if (p.state === 'free') p.fa = turn(p.fa, aim, 0.5);
    const tg = this.enemies.find((e) => !e.dead && Math.abs(wrap(Math.atan2(e.x - p.x, e.z - p.z) - aim)) < 0.05);
    const tx = this.tmpV.x + Math.sin(aim) * 30, tz = this.tmpV.z + Math.cos(aim) * 30;
    this.shoot(this.tmpV.x, this.tmpV.y, this.tmpV.z, tg ? tg.x : tx, tg ? 1.1 : this.tmpV.y, tg ? tg.z : tz, 17 * this.gs.dmgMul * (p.rageT > 0 ? this.gs.rageMul : 1), true, 'bolt');
    A.sfx('bolt'); this.burst(this.tmpV.x, this.tmpV.y, this.tmpV.z, 3, 0xffe8b0, 3, 0.1, 0.2, 0, true);
    if (p.bolts <= 0) { p.reload = 2.2; A.sfx('reload'); }
  }
  activateRage() {
    const p = this.p; if (p.rageT > 0 || p.rage < this.gs.rageNeed) return;
    p.rageT = this.gs.rageDur; p.rage = Math.max(p.rage, 100); p.state = 'cast'; p.an = 'rageRoar'; p.st = 0; p.atk = null; p.fired = true; Prof.statSpecial('guts'); A.sfx('rage'); this.cb.msg('m_rage');
    this.burst(p.x, 1, p.z, 60, 0xff3010, 10, 0.4, 0.9, -1, true); this.ring(p.x, 0.2, p.z, 8, 0xff3010, 0.7); this.shake = 0.8; this.tutDone.add('rage');
  }
  updPlayer(dt: number) {
    const p = this.p, gs = this.gs;
    p.comboT = Math.max(0, p.comboT - dt); p.iframes = Math.max(0, p.iframes - dt); p.stamDelay -= dt; p.recov = Math.max(0, p.recov - dt); p.shootT = Math.max(0, p.shootT - dt); p.boltCd -= dt; p.healCd = Math.max(0, p.healCd - dt); p.flashT = Math.max(0, p.flashT - dt);
    if (p.cannon < 3) { p.cannonCd -= dt; if (p.cannonCd <= 0) { p.cannon++; p.cannonCd = p.cannon < 3 ? 8 : 0; A.sfx('reload'); } }
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { p.bolts = 12; } }
    if (p.rageT > 0) { p.rageT -= dt; p.rage = Math.max(0, (p.rageT / gs.rageDur) * 100); if (Math.random() < 0.8 * this.fx) this.burst(p.x + rnd(-0.4, 0.4), rnd(0.2, 1.8), p.z + rnd(-0.4, 0.4), 1, 0xff3010, 2, 0.25, 0.7, -2, true); if (p.rageT <= 0) p.rage = 0; }
    if (this.hero === 'guts' && this.save.armorEq && !p.dead && this.endT < 0) { this.armorT += dt; if (this.armorT >= 2) { this.armorT = 0; p.hp = Math.max(1, p.hp - 2); } }
    if (p.dead) { p.deadT += dt; this.as.dead = p.deadT * 1.4; p.vx = p.vz = 0; if (this.coop && p.deadT > 8 && this.endT < 0) { p.dead = false; p.deadT = 0; p.state = 'free'; p.hp = gs.maxHp * 0.5; this.as.dead = 0; } return; }
    const cin = !!this.cine && this.cine !== 'bossdown';
    const m = this.moveDir(); const isRun = this.down('run') && m.has && p.stam > 0 && !p.exhausted && (p.state === 'free');
    p.block = p.state === 'free' && this.down('block') && p.stam > 0 && !p.exhausted && !cin;
    if (!this.cine) {
      // bloqueio de alvo
      if (this.was('lock')) { if (this.lockT) { this.lockT = null; this.cb.msg('m_lockoff'); } else { const t = this.aimAngle(32, 1.3, this.yaw + PI); const e = t != null ? this.enemies.filter((q) => !q.dead && q.state !== 'intro').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) + Math.abs(wrap(Math.atan2(a.x - p.x, a.z - p.z) - (this.yaw + PI))) * 8 - (Math.hypot(b.x - p.x, b.z - p.z) + Math.abs(wrap(Math.atan2(b.x - p.x, b.z - p.z) - (this.yaw + PI))) * 8))[0] : null; if (e) { this.lockT = e; this.cb.msg('m_lockon'); } } }
      if (this.lockT && (this.lockT.dead || Math.hypot(this.lockT.x - p.x, this.lockT.z - p.z) > 45)) { const n = this.allyEnemy(p, 30); this.lockT = this.boss && !this.boss.dead ? this.boss : n; }
      if (this.was('interact')) this.interact();
      if (this.was('heal')) {
        if (this.hero === 'caska') { // Ivalera: 40% da vida máxima, recarga 60 s
          if (p.healCd > 0) this.cb.msg('m_cd');
          else if (p.hp >= gs.maxHp - 1) this.cb.msg('m_fullhp');
          else { p.hp = Math.min(gs.maxHp, p.hp + gs.maxHp * IVALERA_HEAL); p.healCd = IVALERA_CD; this.ivaleraT = 1.4; this.burst(p.x, 1.3, p.z, 30, 0xffb0e0, 4, 0.22, 0.9, -1, true); this.ring(p.x, 0.2, p.z, 3, 0xffb0e0, 0.6); A.sfx('heal'); this.cb.msg('m_ivalera'); }
        } else if (!this.puckOn()) this.cb.msg('m_noPuck'); else if (p.healCd > 0) this.cb.msg('m_cd'); else { p.hp = Math.min(gs.maxHp, p.hp + gs.maxHp * 0.3); p.healCd = 60 * (this.gBuff ? SCHIERKE_BUFF.cdr : 1); this.healFx = 2; this.burst(p.x, 1, p.z, 30, 0x8affc8, 4, 0.25, 0.9, -1, true); this.ring(p.x, 0.2, p.z, 3, 0x8affc8, 0.6); A.sfx('heal'); this.cb.msg('m_heal'); this.tutDone.add('heal'); }
      }
    }
    switch (p.state) {
      case 'free': {
        if (!cin && p.recov <= 0) {
          if (this.was('dodge')) this.startDodge();
          else if (this.was('light') || p.buf === 'light') { p.buf = ''; const nx = p.comboT > 0 && p.combo < 3 ? p.combo + 1 : 1; p.combo = nx; this.startAtk('l' + nx); }
          else if (this.was('heavy') || p.buf === 'heavy') { p.buf = ''; p.combo = 0; this.startAtk('heavy'); }
          else if (this.was('cannon')) this.fireCannon();
          else if (this.was('rage')) this.activateRage();
          else if (this.down('xbow') && !p.block) this.fireBolt();
        }
        if (p.state !== 'free') break;
        const sp = (p.block ? 2.8 : p.exhausted ? 3.6 : isRun ? 8.6 : 5.6) * this.heroSpd; const slowF = p.shootT > 0 ? 0.7 : 1;
        const tvx = m.x * sp * slowF, tvz = m.z * sp * slowF; const k = Math.min(1, dt * (m.has ? 12 : 9));
        p.vx += (tvx - p.vx) * k; p.vz += (tvz - p.vz) * k;
        if (isRun) { p.stam -= 9 * dt; p.stamDelay = 0.5; this.tutDone.add('run'); if (p.stam <= 0) { p.stam = 0; p.exhausted = true; } }
        if (m.has) { this.tutMoveD += Math.hypot(p.vx, p.vz) * dt; if (this.tutMoveD > 4) this.tutDone.add('move'); }
        const lt = this.lockT && !this.lockT.dead ? this.lockT : null;
        if (p.shootT > 0 && !lt) p.fa = turn(p.fa, this.aimAngle(35, 0.4, this.yaw + PI) ?? this.yaw + PI, dt * 14);
        else if (lt && !isRun) p.fa = turn(p.fa, Math.atan2(lt.x - p.x, lt.z - p.z), dt * 12);
        else if (m.has) p.fa = turn(p.fa, Math.atan2(m.x, m.z), dt * 14);
        else if (p.block) { /* mantém */ }
        p.step -= dt * Math.hypot(p.vx, p.vz); if (p.step <= 0 && m.has) { p.step = isRun ? 2.6 : 2.0; A.sfx('step'); }
        break;
      }
      case 'attack': {
        const a = p.atk as AtkDef; p.st += dt * this.mods.atkSpd * (this.eagle > 0 ? 1.15 : 1) * (p.rageT > 0 ? 1.12 : 1);
        if (this.was('light')) p.buf = 'light'; else if (this.was('heavy')) p.buf = 'heavy';
        if (!p.hitDone && p.st >= a.W) { p.hitDone = true; this.perfHit(a, p.an); }
        p.vx *= Math.exp(-7 * dt); p.vz *= Math.exp(-7 * dt);
        if (p.st < a.W * 0.6 && m.has && !this.lockT) p.fa = turn(p.fa, Math.atan2(m.x, m.z), dt * 3);
        const tot = a.W + a.St + a.R;
        if (p.st >= a.W + a.St && this.was('dodge') && p.stam > 0) { this.startDodge(); break; }
        if (p.buf && p.st >= a.W + a.St + a.R * 0.45) { const b = p.buf; p.buf = ''; if (b === 'heavy') { p.combo = 0; this.startAtk('heavy'); } else { p.combo = p.combo >= 3 || p.an === 'heavy' ? 1 : p.combo + 1; if (p.an === 'heavy') p.combo = 1; this.startAtk('l' + p.combo); } break; }
        if (p.st >= tot) { p.state = 'free'; p.atk = null; p.an = ''; p.comboT = p.an === 'heavy' ? 0 : 0.55; p.recov = 0; }
        break;
      }
      case 'dodge': {
        p.st += dt; const k = p.st / 0.55; const sp = p.dodgeSpd * Math.pow(Math.max(0, 1 - k), 1.3);
        p.vx = p.ddx * sp; p.vz = p.ddz * sp; if (p.st > 0.06 && p.st < 0.34) p.iframes = 0.05;
        if (p.st >= 0.55) { p.state = 'free'; p.recov = 0.1; p.vx *= 0.3; p.vz *= 0.3; }
        break;
      }
      case 'hurt': p.st += dt; p.vx *= Math.exp(-6 * dt); p.vz *= Math.exp(-6 * dt); if (p.st > 0.38) p.state = 'free'; break;
      case 'cast': this.playerCast(dt); break;
    }
    if (p.state === 'cast' && p.an === 'rageRoar') { /* roar */ }
    // exaustão (dificuldade + Bênção de Schierke)
    const gStam = gs.regen * this.diff.stamRegen * (this.gBuff ? SCHIERKE_BUFF.stamRegen : 1) * (this.hero === 'caska' && this.cBuff ? FARNESE_BUFF.stamRegen : 1);
    if (p.stamDelay <= 0 && !isRun && !(p.block)) p.stam = Math.min(gs.maxStam, p.stam + gStam * (p.state === 'free' ? 1 : 0.4) * dt);
    else if (p.block && p.stamDelay <= 0) p.stam = Math.min(gs.maxStam, p.stam + gStam * 0.3 * dt);
    if (p.exhausted && p.stam >= gs.maxStam * 0.3) p.exhausted = false;
    // integração + colisão
    p.x += p.vx * dt; p.z += p.vz * dt;
    if (p.state !== 'dodge') for (const e of this.enemies) { if (e.dead || e.state === 'intro') continue; const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), mn = e.rad + 0.45; if (d < mn && d > 0.001) { const push = (mn - d); p.x += (dx / d) * push * 0.6; p.z += (dz / d) * push * 0.6; e.x -= (dx / d) * push * 0.4; e.z -= (dz / d) * push * 0.4; } }
    resolve(this.world.cols, p, 0.45);
    // animação
    const a = this.as; a.t += dt; const spd = Math.hypot(p.vx, p.vz); a.mv = p.state === 'free' ? Math.min(1.1, spd / 8.6 * (isRun ? 1 : 1.35)) : 0; a.run = isRun; a.block = p.block; a.rage = p.rageT > 0; a.fly = false;
    a.atk = ''; a.p = 0; a.dodge = 0; a.stun = false;
    if (p.state === 'attack') { const A_ = p.atk as AtkDef; a.atk = A_.anim; a.p = animP(p.st, A_.W, A_.St, A_.R); }
    else if (p.state === 'dodge') a.dodge = Math.min(1, p.st / 0.55);
    else if (p.state === 'hurt') a.hit = p.st / 0.38;
    else if (p.state === 'cast') { a.atk = p.an; a.p = p.an === 'rageRoar' ? Math.min(1, p.st / 0.9) * 0.6 : 0.5; if (p.an === 'shootL') a.p = 0.55; if (p.an === 'rageRoar' && p.st > 0.9) p.state = 'free'; }
    else if (p.shootT > 0) { a.atk = 'shootR'; a.p = 0.55; }
    if (p.state !== 'hurt') a.hit = 0;
    if (p.state === 'free' && p.block) a.block = true;
    animate(this.rig, a);
    this.rig.root.position.set(p.x, 0, p.z); this.rig.root.rotation.y = p.fa;
    if (p.flashT > 0) flash(this.rig, 0.8, 0xff1010); else if (p.rageT > 0) flash(this.rig, 0.25 + Math.sin(this.time * 14) * 0.1, 0xff2200); else if (this.eagle > 0) flash(this.rig, 0.15, 0xffc040); else if (this.rig.mats.length && (this.rig as any)._fl) flash(this.rig, 0);
    (this.rig as any)._fl = p.flashT > 0 || p.rageT > 0 || this.eagle > 0;
  }
  interact() {
    const p = this.p, S = this.save.secret;
    if (this.mode === 'camp') {
      const ch = this.chests.find((c) => Math.hypot(c.x - p.x, c.z - p.z) < 2.4);
      if (ch) { this.cb.secret?.('campEgg', { i: ch.i }); this.scene.remove(ch.g); this.chests.splice(this.chests.indexOf(ch), 1); this.burst(ch.x, 0.5, ch.z, 20, 0xffd860, 5, 0.25, 0.9, -1, true); A.sfx('pickup'); return; }
      const n = this.nearNpc();
      if (n) { this.cb.secret?.('talk', { id: n.id }); A.sfx('ui'); return; }
      if (this.nearBoard()) { this.cb.secret?.('board'); A.sfx('ui'); return; }
      if (Math.hypot(DEPART.x - p.x, DEPART.z - p.z) < 3) { this.cb.secret?.('depart'); A.sfx('ui'); return; }
      return;
    }
    if (this.defOn) {
      // contratação por interação: conversar com o aliado que aguarda na vila
      const n = this.defNpcs.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2.6);
      if (n) { const h = DEF_HIRE.find(([q]) => q === n.id); this.cb.secret?.('defTalk', { id: n.id, cost: h ? h[1] : 0, hired: false }); A.sfx('ui'); return; }
      // aliado já contratado: conversa curta de confirmação
      const al = this.mode === 'defense' ? this.allies.find((q) => this.defHired.includes(q.id) && Math.hypot(q.x - p.x, q.z - p.z) < 2.6) : null;
      if (al) { this.cb.secret?.('defTalk', { id: al.id, cost: 0, hired: true }); A.sfx('ui'); return; }
      const pi = this.posts.findIndex((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2.3);
      if (pi >= 0) { this.cb.secret?.('post', { i: pi, unit: this.posts[pi].unit }); A.sfx('ui'); }
      return;
    }
    // easter egg escondido da fase
    if (this.eggItem && !this.eggItem.got && Math.hypot(this.eggItem.x - p.x, this.eggItem.z - p.z) < 2.5) { this.eggItem.got = true; this.scene.remove(this.eggItem.g); this.cb.secret?.('egg', { lv: this.lv }); A.sfx('pickup'); this.burst(this.eggItem.x, 1, this.eggItem.z, 24, 0xffe6a0, 5, 0.25, 0.9, -1, true); return; }
    for (const f of this.world.fires) if (f.usable && !f.used && Math.hypot(f.x - p.x, f.z - p.z) < 3.2) {
      f.used = true; p.hp = this.gs.maxHp; p.stam = this.gs.maxStam; p.cannon = 3; p.bolts = 12; p.healCd = Math.max(0, p.healCd - 30); this.cb.msg('m_rest'); A.sfx('heal'); this.burst(f.x, 1, f.z, 40, 0xffc060, 5, 0.3, 1, -1, true); return;
    }
    for (const f of this.feathers) if (!f.got && Math.hypot(f.x - p.x, f.z - p.z) < 2.5) { f.got = true; this.scene.remove(f.g); S.f5.feathers = Math.min(5, S.f5.feathers + 1); this.cb.secret?.('f5', { ...S.f5 }); this.cb.msg('m_sec_feather', { a: S.f5.feathers }); A.sfx('pickup'); return; }
    if (this.secretFlag && !this.secretFlag.found && Math.hypot(this.secretFlag.x - p.x, this.secretFlag.z - p.z) < 3.5) { this.secretFlag.found = true; S.f5.flag = true; this.cb.secret?.('f5', { ...S.f5 }); this.cb.msg('m_sec_flag'); A.sfx('pickup'); return; }
    if (this.behItem && !this.behItem.got && Math.hypot(this.behItem.x - p.x, this.behItem.z - p.z) < 2.5) { this.behItem.got = true; this.scene.remove(this.behItem.g); if (!S.bLvls.includes(this.lv)) S.bLvls.push(this.lv); this.cb.secret?.('bLvl', { lv: this.lv }); this.cb.msg('m_sec_beh', { a: S.bLvls.length }); A.sfx('behelit'); return; }
    if (this.talkBeh && !this.talkBeh.used && Math.hypot(this.talkBeh.x - p.x, this.talkBeh.z - p.z) < 3) { this.cb.secret?.('quiz'); A.sfx('behelit'); return; }
    if (this.docItem && !this.docItem.got && Math.hypot(this.docItem.x - p.x, this.docItem.z - p.z) < 2.5) { this.docItem.got = true; this.scene.remove(this.docItem.g); if (Prof.addDoc('doc' + this.lv)) this.cb.msg('m_doc'); this.combat += 25; A.sfx('pickup'); return; }
    for (const r of this.relics) if (!r.got && Math.hypot(r.x - p.x, r.z - p.z) < 3) { r.got = true; this.scene.remove(r.g); this.combat += 40; this.relicN++; p.hp = Math.min(this.gs.maxHp, p.hp + this.gs.maxHp * 0.2); this.cb.msg('m_relic'); A.sfx('pickup'); this.burst(r.x, 1, r.z, 30, 0xffd860, 5, 0.25, 0.9, -1, true); return; }
  }

  // ---------- inimigos ----------
  nTokens() { let n = 0; for (const e of this.enemies) if (e.token && !e.dead) n++; return n; }
  chooseBoss(e: En): string {
    const b = e.boss!, d = Math.hypot(this.p.x - e.x, this.p.z - e.z);
    if (e.next) { const n = e.next; e.next = ''; if (n === 'summon' && this.enemies.filter((q) => !q.dead && q.summoned).length > 4) { /* sem espaço */ } else return n; }
    let list = [...b.atk]; if (e.phase >= 2) list.push(...b.p2);
    const live = this.enemies.filter((q) => !q.dead && q.summoned).length;
    list = list.filter((a) => (a !== 'summon' || (live < 4 && e.summonCd <= 0)) && a !== e.last);
    const closeSet = ['swing', 'spin', 'slam'], w = list.map((a) => (closeSet.includes(a) === d < b.range + 2 ? 3 : 0.7) * (a === 'summon' ? 0.8 : 1));
    let r = Math.random() * w.reduce((x, y) => x + y, 0); for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; } return list[0] || 'swing';
  }
  beginAttack(e: En, name: string) {
    const cfg = ACFG[name], boss = !!e.boss; const pm = boss ? Math.max(0.6, 1 - 0.14 * (e.phase - 1)) : (this.lv >= 7 ? 0.92 : 1);
    e.atk = name; e.state = 'windup'; e.st = 0; e.hitDone = false; e.W = cfg.W * pm * this.diff.react; e.St = cfg.St; e.R = cfg.R * (boss ? pm : 1); e.anim = cfg.anim; e.hitOnce = false; e.tick = 0; e.last = name;
    if (!boss && ['melee'].includes(name)) {
      e.heavy = e.def.cls !== 'common' && Math.random() < 0.3; if (e.def.id === 'troll' || e.def.id === 'knight') e.anim = 'l3'; if (e.heavy) { e.W *= 1.5; e.anim = 'slam'; e.R *= 1.2; }
    }
    if (!boss && name === 'slam') { e.W = 1.1; e.R = 1.4; }
    if (!boss && name === 'charge') { e.W = 0.75; e.St = 0.55; }
    const r = e.boss ? e.boss.range : e.def.range; const sc = e.def.scale;
    if (boss && !e.boss!.flying) e.rig.root.position.y = 0;
    switch (name) {
      case 'melee': if (e.heavy) e.tele = this.makeTele('cone', r + 0.8, 0.8); else if (e.def.cls !== 'common') e.tele = this.makeTele('cone', r + 0.4, 0.6, 0xff6a3a); break;
      case 'swing': e.tele = this.makeTele('cone', r + 1.2, 1.05); break;
      case 'slam': e.tele = this.makeTele('circle', r + (boss ? 2.4 : 1.2), 0); break;
      case 'charge': e.tele = this.makeTele('line', boss ? 16 : 9, 2.6 * Math.max(1, sc * 0.7)); break;
      case 'leap': e.tx = this.p.x; e.tz = this.p.z; e.sx = e.x; e.sz = e.z; e.tele = this.makeTele('circle', boss ? 5.5 : 2.6, 0); e.tele.g.position.set(e.tx, 0.06, e.tz); break;
      case 'wave': e.tele = this.makeTele('line', 18, 4.4); break;
      case 'spin': e.tele = this.makeTele('circle', r + 1.4, 0); break;
      case 'summon': e.tele = this.makeTele('circle', 4, 0, 0x6a8aff); break;
      case 'bolts': case 'barrage': e.tele = this.makeTele('cone', 14, name === 'bolts' ? 0.45 : 0.6, 0xff8a3a); break;
      case 'blink': this.burst(e.x, 1.5, e.z, 30, 0xc8a0ff, 6, 0.3, 0.6, -1, true); A.sfx('blink'); break;
    }
    if (e.tele && name !== 'leap') e.tele.g.position.set(e.x, 0.06, e.z);
    if (name === 'ranged') e.anim = 'shootE';
    if (boss || e.def.cls !== 'common') A.sfx('warn');
    e.as.atk = e.anim; e.as.p = 0;
  }
  atkArc(e: En, range: number, half: number, dmg: number) {
    const p = this.p, dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) - 0.4;
    if (d <= range && Math.abs(wrap(Math.atan2(dx, dz) - e.fa)) < half) this.hurtPlayer(dmg, e, {});
    const ca = this.caskaNet; if (ca) { const cx = ca.x - e.x, cz = ca.z - e.z; if (Math.hypot(cx, cz) - 0.4 <= range && Math.abs(wrap(Math.atan2(cx, cz) - e.fa)) < half) this.hurtCaska(dmg); }
    for (const al of this.allies) { if (al === this.caskaNet || !al.maxHp || al.downT > 0) continue; const ax = al.x - e.x, az = al.z - e.z; if (Math.hypot(ax, az) - 0.4 <= range && Math.abs(wrap(Math.atan2(ax, az) - e.fa)) < half) this.hurtAlly(al, dmg); }
    this.hurtMinionsArc(e, range, half, dmg);
    if (this.defOn) {
      if (this.defs.barrier > 0 && Math.hypot(e.x, e.z + 7.4) < range + 3.2) this.defBarrierHit(dmg);
      if (!this.defs.shopDead && Math.hypot(e.x - 8, e.z - 11.5) < range + 2.4) this.defShopHit(dmg);
    }
    this.slashFx(e.x, e.z, e.fa, range, half, e.boss ? 0xff7050 : 0xffd0b0, 1.1 * e.def.scale);
    A.sfx(e.def.scale > 1.4 ? 'heavy' : 'slash');
  }
  atkCircle(cx: number, cz: number, r: number, dmg: number, e: En) {
    const p = this.p; if (Math.hypot(p.x - cx, p.z - cz) < r + 0.4) this.hurtPlayer(dmg, { x: cx, z: cz }, {});
    const ca = this.caskaNet; if (ca && Math.hypot(ca.x - cx, ca.z - cz) < r + 0.4) this.hurtCaska(dmg);
    this.hurtAlliesNear(cx, cz, r, dmg);
    this.ring(cx, 0.15, cz, r, e.boss ? 0xff5030 : 0xffb070, 0.4); this.burst(cx, 0.3, cz, 20, 0x6a5a4a, 6, 0.4, 0.7, 8, false); this.shake = Math.max(this.shake, 0.6); A.sfx('hitHeavy');
  }
  execAttack(e: En, dt: number) {
    const p = this.p, b = e.boss, dmg = (b ? b.dmg : e.def.dmg) * e.dmgMul, name = e.atk, r = b ? b.range : e.def.range;
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    const bc = b ? PROJ_COL[b.id] : 0xff7030;
    switch (name) {
      case 'melee': if (!e.hitDone) { e.hitDone = true; this.atkArc(e, r + 0.5, e.heavy ? 1.0 : 0.85, e.heavy ? dmg * 1.6 : dmg); } break;
      case 'swing': if (!e.hitDone) { e.hitDone = true; this.atkArc(e, r + 1.2, 1.05, dmg); } break;
      case 'slam': if (!e.hitDone) { e.hitDone = true; const cx = e.x + Math.sin(e.fa) * r * 0.5, cz = e.z + Math.cos(e.fa) * r * 0.5; void cx; void cz; this.atkCircle(e.x, e.z, r + (b ? 2.4 : 1.2), dmg * 1.15, e); } break;
      case 'charge': {
        const sp = b ? 17 : 12; e.x += Math.sin(e.fa) * sp * dt; e.z += Math.cos(e.fa) * sp * dt;
        if (!e.hitOnce && dist < e.rad + 0.9) { e.hitOnce = true; this.hurtPlayer(dmg * 1.1, e, {}); }
        if (Math.random() < 0.8) this.burst(e.x, 0.2, e.z, 2, 0x8a7a6a, 3, 0.3, 0.4, 3, false); break;
      }
      case 'leap': { const k = Math.min(1, e.st / e.St); e.x = e.sx + (e.tx - e.sx) * k; e.z = e.sz + (e.tz - e.sz) * k; e.y = Math.sin(k * PI) * (b ? 5 : 3.2); if (!e.hitDone && e.st >= e.St) { e.hitDone = true; e.y = 0; this.atkCircle(e.tx, e.tz, b ? 5.5 : 2.6, dmg * 1.1, e); } break; }
      case 'ranged': if (!e.hitDone) { e.hitDone = true; e.rig.root.getWorldPosition(this.tmpV); const spit = e.id === 'spitter'; this.shoot(e.x + Math.sin(e.fa) * 0.8, 1.5 * e.def.scale, e.z + Math.cos(e.fa) * 0.8, p.x, 1.1, p.z, dmg, false, spit ? 'spit' : 'ebolt', spit ? 15 : 22); A.sfx(spit ? 'magic' : 'bolt'); } break;
      case 'bolts': if (!e.hitDone) { e.hitDone = true; const n = e.phase >= 2 ? 7 : 5; for (let i = 0; i < n; i++) this.shoot(e.x, 1.6 * e.def.scale, e.z, p.x, 1.1, p.z, dmg * 0.45, false, 'orb', 16, (i - (n - 1) / 2) * 0.16); A.sfx('magic'); } break;
      case 'wave': if (!e.hitDone) { e.hitDone = true; const w = this.shoot(e.x, 0.4, e.z, e.x + Math.sin(e.fa) * 10, 0.4, e.z + Math.cos(e.fa) * 10, dmg * 0.9, false, 'wave', 13); w.m.rotation.y = e.fa; A.sfx('wave'); this.ring(e.x, 0.2, e.z, 4, bc, 0.5); } break;
      case 'spin': {
        e.tick -= dt; if (e.tick <= 0) { e.tick = 0.42; if (dist < r + 1.4 + 0.4) this.hurtPlayer(dmg * 0.8, e, {}); this.slashFx(e.x, e.z, e.fa, r + 1.4, PI, bc, 1.2); A.sfx('slash'); }
        const a = Math.atan2(dx, dz); e.x += Math.sin(a) * e.def.spd * 0.45 * dt; e.z += Math.cos(a) * e.def.spd * 0.45 * dt; break;
      }
      case 'summon': if (!e.hitDone) {
        e.hitDone = true; A.sfx('summon'); const list = b!.summon; this.ring(e.x, 0.2, e.z, 6, 0x6a8aff, 0.9);
        const n = Math.min(list.length, 4 - this.enemies.filter((q) => !q.dead && q.summoned).length); for (let i = 0; i < Math.max(2, n); i++) { const a = rnd(0, TAU), q = { x: e.x + Math.sin(a) * 4, z: e.z + Math.cos(a) * 4 }; resolve(this.world.cols, q, 0.6); this.spawnEnemy(list[i % list.length], q.x, q.z, true, true); this.burst(q.x, 1, q.z, 16, 0x6a8aff, 5, 0.3, 0.7, -1, true); }
        e.summonCd = 22; this.cb.msg('m_summon');
      } break;
      case 'barrage': {
        e.tick -= dt; if (e.tick <= 0) { e.tick = 0.12; const a = toP + Math.sin(e.st * 5) * 0.4; this.shoot(e.x, 1.6 * e.def.scale, e.z, e.x + Math.sin(a) * 20, 1.1, e.z + Math.cos(a) * 20, dmg * 0.35, false, 'orb', 15); } break;
      }
      case 'blink': if (!e.hitDone) {
        e.hitDone = true; const a = p.fa + PI + rnd(-0.6, 0.6); let nx = p.x + Math.sin(a) * 4.2, nz = p.z + Math.cos(a) * 4.2; const q = { x: nx, z: nz }; resolve(this.world.cols, q, 1);
        e.x = q.x; e.z = q.z; e.fa = Math.atan2(p.x - e.x, p.z - e.z); this.burst(e.x, 1.5, e.z, 30, 0xc8a0ff, 6, 0.3, 0.6, -1, true); this.ring(e.x, 0.2, e.z, 3, 0xc8a0ff, 0.4); e.next = 'swing'; A.sfx('blink');
      } break;
    }
  }
  updEnemy(e: En, dt: number) {
    const p = this.p, as = e.as, b = e.boss, def = e.def;
    as.t += dt; e.flashT = Math.max(0, e.flashT - dt); e.slow = Math.max(0, e.slow - dt); e.summonCd -= dt; e.hitT = Math.max(0, e.hitT - dt * 4);
    if (e.dead) {
      e.deadT += dt; as.dead = e.deadT * 1.6; as.atk = ''; as.hit = 0; animate(e.rig, as); if (e.deadT > 3) e.rig.root.position.y = -(e.deadT - 3) * 0.8;
      if (e.boss && e.deadT < 2.5 && Math.random() < 0.5) this.burst(e.x, rnd(0.5, 3) * def.scale, e.z, 3, 0xffe0a0, 5, 0.4, 0.8, -1, true);
      if (e.deadT > 6 || (e.boss && e.deadT > 3.5)) { this.scene.remove(e.rig.root); disposeRig(e.rig); const i = this.enemies.indexOf(e); if (i >= 0) this.enemies.splice(i, 1); if (e.bar) this.scene.remove(...e.bar); if (e.boss) e.rig.root.visible = false; }
      return;
    }
    if ((e as any).dummy) { e.as.hit = Math.max(0, e.as.hit - dt * 5); this.finEnemy(e, dt, 0, false); return; }
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    // kb decay
    e.x += e.kx * dt; e.z += e.kz * dt; const kd = Math.exp(-8 * dt); e.kx *= kd; e.kz *= kd;
    e.poiseT -= dt; if (e.poiseT <= 0 && e.poise < e.pmax) e.poise = Math.min(e.pmax, e.poise + 12 * dt);
    const slowF = e.slow > 0 ? 0.6 : 1, farnese = this.shieldT > 0 && dist < 9 ? 0.65 : 1;
    const spdM = (b ? 1 + 0.1 * (e.phase - 1) : this.lv >= 8 ? 1.05 : 1) * slowF * farnese;
    let mv = 0, run = false; as.atk = ''; as.stun = false; as.dodge = 0; as.block = e.guarding;
    if (!e.aggro) { if (dist < (def.cls === 'tough' && def.range > 10 ? 24 : 18)) { e.aggro = true; if (def.cls === 'special' || def.cls === 'mini') this.burst(e.x, 1.5, e.z, 6, 0xff4020, 3, 0.2, 0.5, 0, true); } else { this.finEnemy(e, dt, 0, false); return; } }
    switch (e.state) {
      case 'intro': {
        e.st += dt; const k = Math.min(1, e.st / 2.2); e.rig.root.position.y = b!.flying ? 0 : -(1 - k) * 4; e.fa = turn(e.fa, toP, dt * 3);
        if (Math.random() < 0.6) this.burst(e.x + rnd(-3, 3), 0.2, e.z + rnd(-3, 3), 2, 0xff4020, 3, 0.4, 0.8, -1, true); if (e.st > 0.5 && !e.hitDone) { e.hitDone = true; A.sfx('roar'); this.shake = 1; }
        as.atk = e.st > 0.4 && e.st < 1.8 ? 'rageRoar' : ''; as.p = 0.5;
        if (e.st > 2.4) { e.state = 'chase'; this.cine = ''; if (!this.lockT) this.lockT = e; e.cd = 0.8; } break;
      }
      case 'stun': e.stunT -= dt; as.stun = true; e.st += dt; if (e.stunT <= 0) { e.state = 'chase'; e.cd = 0.3; } break;
      case 'chase': {
        e.guardT -= dt; e.cd -= dt;
        // defesa da vila: marcha em rota com desvios para combate
        const route = (e as any).route as [number, number][] | undefined;
        if (this.defOn && route) {
          const nd = this.nearDefender(e.x, e.z, 6.5);
          const pNear = dist < 8;
          let tx2: number | null = null, tz2: number | null = null, atkR = def.range;
          if (pNear) { tx2 = p.x; tz2 = p.z; } // jogador por perto: briga normal (lógica padrão abaixo)
          else if (nd) { tx2 = nd.x; tz2 = nd.z; } // defensor no caminho
          if (!pNear) {
            if (tx2 != null) { // atacar defensor
              const ddx = tx2 - e.x, ddz = tz2! - e.z, dd = Math.hypot(ddx, ddz);
              e.fa = turn(e.fa, Math.atan2(ddx, ddz), dt * 7);
              if (dd > atkR) { e.x += (ddx / dd) * def.spd * 0.9 * dt; e.z += (ddz / dd) * def.spd * 0.9 * dt; mv = 0.8; }
              else if (e.cd <= 0) { this.beginAttack(e, def.atk === 'ranged' ? 'ranged' : 'melee'); e.cd = rnd(0.8, 1.6); }
            } else { // marchar pela rota
              let ri = (e as any).ri as number;
              const wp = route[Math.min(ri, route.length - 1)];
              const ddx = wp[0] - e.x, ddz = wp[1] - e.z, dd = Math.hypot(ddx, ddz);
              // oficina no caminho?
              if (!this.defs.shopDead && Math.hypot(e.x - 8, e.z - 11.5) < def.range + 2.2 && route.some((q) => Math.hypot(q[0] - 7.5, q[1] - 11) < 1)) {
                e.fa = turn(e.fa, Math.atan2(8 - e.x, 11.5 - e.z), dt * 6);
                if (e.cd <= 0) { this.beginAttack(e, 'melee'); e.cd = rnd(1, 1.8); }
              } else if (dd < 1.6) {
                if (ri >= route.length - 1) { // chegou à barreira da igreja
                  e.fa = turn(e.fa, Math.atan2(-e.x, -7.4 - e.z), dt * 6);
                  if (e.cd <= 0) { this.beginAttack(e, 'melee'); e.cd = rnd(0.9, 1.5); }
                } else (e as any).ri = ri + 1;
              } else { e.x += (ddx / dd) * def.spd * 0.85 * dt; e.z += (ddz / dd) * def.spd * 0.85 * dt; e.fa = turn(e.fa, Math.atan2(ddx, ddz), dt * 6); mv = 0.75; }
            }
            this.finEnemy(e, dt, mv, false); return;
          }
        }
        const range = b ? b.range : def.range; const ranged = def.atk === 'ranged';
        e.fa = turn(e.fa, toP, dt * (b ? 5 : 7));
        if (e.guarding && e.guardT <= 0) e.guarding = false;
        let tx = 0, tz = 0, sp = def.spd * spdM; const nx = dx / (dist || 1), nz = dz / (dist || 1);
        if (ranged) {
          const lo = range * 0.45, hi = range * 0.8;
          if (dist > hi) { tx = nx; tz = nz; } else if (dist < lo) { tx = -nx; tz = -nz; sp *= 0.8; } else { tx = -nz * e.circ; tz = nx * e.circ; sp *= 0.5; if (Math.random() < dt * 0.3) e.circ *= -1; }
          if (e.cd <= 0 && dist < range && dist > 3) { this.beginAttack(e, 'ranged'); e.cd = rnd(2.2, 3.6); }
        } else if (b) {
          const bf = b.flying; const near = dist < range * 0.9;
          if (!near) { tx = nx; tz = nz; } else if (dist < range * 0.5) { tx = -nx * 0.3; tz = -nz * 0.3; } else { tx = -nz * e.circ * 0.5; tz = nx * e.circ * 0.5; }
          if (e.cd <= 0) { const a = this.chooseBoss(e); this.beginAttack(e, a); e.cd = Math.max(0.5, 1.4 - 0.3 * (e.phase - 1)); }
          void bf;
        } else {
          if (def.atk === 'guard' && !e.guarding && dist < 6 && e.guardT <= -2 && Math.random() < dt * 0.6) { e.guarding = true; e.guardT = 1.6; }
          const hasT = e.token || this.nTokens() < this.tokens;
          const want = def.atk === 'charge' ? dist < 9 && dist > 4 : def.atk === 'leap' ? dist < 8 && dist > 3 : dist < range + 0.3;
          if (want && e.cd <= 0 && hasT && !e.guarding) { e.token = true; this.beginAttack(e, def.atk === 'guard' ? 'melee' : def.atk === 'melee' || def.atk === 'guard' ? 'melee' : def.atk); }
          else if (dist > range * 0.9 + (hasT ? 0 : 3)) { tx = nx; tz = nz; } else { tx = -nz * e.circ * 0.6; tz = nx * e.circ * 0.6; if (!hasT) { sp *= 0.6; } }
          if (e.guarding) sp *= 0.4;
        }
        const l = Math.hypot(tx, tz); if (l > 0.01) { e.x += (tx / l) * sp * dt; e.z += (tz / l) * sp * dt; mv = Math.min(1.1, sp / 7); run = sp > 5.5; }
        break;
      }
      case 'windup': {
        e.st += dt; const tr = e.atk === 'charge' ? 0.5 : e.atk === 'leap' ? 0.2 : 0.65;
        if (e.st < e.W * tr && e.atk !== 'blink') e.fa = turn(e.fa, toP, dt * (b ? 6 : 8));
        if (e.tele) { this.setTele(e.tele, e.st / e.W); if (e.atk !== 'leap') { e.tele.g.position.set(e.x, 0.06, e.z); e.tele.g.rotation.y = e.fa; } }
        as.atk = e.anim; as.p = animP(e.st, e.W, e.St, e.R); as.p = Math.min(as.p, 0.44 * (e.st / e.W));
        if (e.atk === 'leap') { as.p = 0.2 * (e.st / e.W); }
        if (e.st >= e.W) { e.state = 'attack'; e.st = 0; if (e.atk !== 'leap') this.rmTele(e); else if (e.tele) this.setTele(e.tele, 1); if (e.atk === 'blink') { e.rig.root.visible = false; } }
        if (b && b.flying && e.atk !== 'blink') e.y += (0.6 - e.y) * dt * 4;
        break;
      }
      case 'attack': {
        e.st += dt; this.execAttack(e, dt); as.atk = e.anim; as.p = animP(e.st + e.W, e.W, e.St, e.R);
        if (e.atk === 'spin') as.p = e.st / e.St; if (e.atk === 'leap') as.p = 0.45 + 0.2 * Math.min(1, e.st / e.St);
        if (e.atk === 'barrage' || e.atk === 'bolts') as.p = 0.55;
        if (e.atk === 'blink') { e.rig.root.visible = true; }
        const dur = e.atk === 'melee' || e.atk === 'swing' || e.atk === 'slam' || e.atk === 'ranged' || e.atk === 'bolts' || e.atk === 'wave' || e.atk === 'summon' || e.atk === 'blink' ? e.St : e.St;
        if (e.st >= dur) { e.state = 'recover'; e.st = 0; as.p = 0.66; e.y = 0; this.rmTele(e); }
        if (e.atk === 'charge') { const q = { x: e.x, z: e.z }; resolve(this.world.cols, q, e.rad); if (Math.abs(q.x - e.x) + Math.abs(q.z - e.z) > 0.01) { e.x = q.x; e.z = q.z; e.state = 'recover'; e.st = 0; e.R += 0.6; this.shake = 0.5; } }
        break;
      }
      case 'recover': {
        e.st += dt; as.atk = e.anim; as.p = 0.65 + 0.35 * Math.min(1, e.st / e.R); if (e.atk === 'spin' || e.atk === 'leap') as.atk = '';
        if (e.next && e.atk === 'blink') { e.state = 'chase'; e.cd = 0; this.releaseToken(e); break; }
        if (b && b.flying) e.y += (2.2 - e.y) * dt * 2;
        if (e.st >= e.R) { e.state = 'chase'; this.releaseToken(e); e.cd = b ? Math.max(0.5, 1.4 - 0.3 * (e.phase - 1)) : rnd(0.5, 1.4); if (!b && Math.random() < 0.5) e.circ *= -1; }
        break;
      }
    }
    if (b && b.flying && (e.state === 'chase')) e.y += (2.4 + Math.sin(this.time * 1.5) * 0.4 - e.y) * dt * 2;
    this.finEnemy(e, dt, mv, run);
  }
  finEnemy(e: En, dt: number, mv: number, run: boolean) {
    const as = e.as;
    for (const o of this.enemies) { if (o === e || o.dead) continue; const dx = e.x - o.x, dz = e.z - o.z, d = Math.hypot(dx, dz), mn = e.rad + o.rad; if (d < mn && d > 0.001) { const k = (mn - d) * 0.5 * (o.boss ? 0.2 : 1); e.x += (dx / d) * k; e.z += (dz / d) * k; } }
    if (!(e.boss && e.boss.flying)) { const q = { x: e.x, z: e.z }; resolve(this.world.cols, q, e.rad); e.x = q.x; e.z = q.z; } else { const d = Math.hypot(e.x, e.z); if (d > R - 4) { e.x *= (R - 4) / d; e.z *= (R - 4) / d; } }
    as.mv = mv; as.run = run; as.fly = !!(e.boss && e.boss.flying && e.state !== 'attack'); as.hit = Math.max(0, as.hit - dt * 5);
    if (e.state === 'intro' && !e.boss!.flying) { /* y handled */ } else e.rig.root.position.y = e.y;
    if (e.state === 'windup' && e.atk === 'blink') { e.rig.root.scale.setScalar(e.def.scale * Math.max(0.02, 1 - e.st / e.W)); } else if (e.rig.root.scale.x !== e.def.scale) e.rig.root.scale.setScalar(e.def.scale);
    e.rig.root.position.x = e.x; e.rig.root.position.z = e.z; e.rig.root.rotation.y = e.fa;
    animate(e.rig, as);
    if (e.flashT > 0) flash(e.rig, 0.9); else if (e.state === 'windup' && (e.boss || e.def.cls !== 'common')) flash(e.rig, 0.25 + 0.2 * Math.sin(e.st * 30), 0xff2010); else if (e.boss && e.phase > 1) flash(e.rig, 0.12 + 0.08 * Math.sin(this.time * 6), 0xff1000); else if ((e as any)._fl) flash(e.rig, 0);
    (e as any)._fl = e.flashT > 0 || (e.state === 'windup' && (!!e.boss || e.def.cls !== 'common')) || (!!e.boss && e.phase > 1);
    if (e.bar) {
      const vis = e.hp < e.max && !e.dead && Math.hypot(e.x - this.p.x, e.z - this.p.z) < 32 && e.hitT >= 0; const [bg, fg] = e.bar; bg.visible = fg.visible = vis;
      if (vis) { const w = 1.1, h = 0.1, y = 2.4 * e.def.scale + 0.3; bg.scale.set(w, h, 1); fg.scale.set(Math.max(0.001, w * e.hp / e.max), h * 0.7, 1); bg.position.set(e.x - this.camRight.x * w / 2, y, e.z - this.camRight.z * w / 2); fg.position.copy(bg.position); }
    }
  }
  camRight = new THREE.Vector3(1, 0, 0);

  // ---------- spawner / objetivos ----------
  updSpawner(dt: number) {
    if (this.defCam) { this.updDefense(dt); return; }
    if (this.mode !== 'campaign') { this.updWaves(dt); return; }
    if (this.bossSpawned || this.endT >= 0) return;
    const ld = this.ld, alive = this.enemies.filter((e) => !e.dead && !e.mini && !e.boss && !e.summoned).length;
    if (this.spawned < ld.kills) {
      this.spawnT -= dt; const cap = 5 + Math.min(4, Math.floor(this.lv / 2));
      if (this.spawnT <= 0 && alive < cap) {
        this.spawnT = 5.5; const n = Math.min(ld.kills - this.spawned, 2 + (Math.random() < 0.4 ? 1 : 0)); const a = rnd(0, TAU), d = rnd(22, 32); let bx = this.p.x + Math.sin(a) * d, bz = this.p.z + Math.cos(a) * d; const q = { x: bx, z: bz }; resolve(this.world.cols, q, 3);
        for (let i = 0; i < n; i++) this.spawnEnemy(this.pickId(), q.x + rnd(-2, 2), q.z + rnd(-2, 2), true);
        if (Math.random() < 0.3) this.cb.msg('m_ambush');
      }
    }
    // procurado: surge quando 30% das eliminações foram feitas
    if (this.bountyId && !this.bountySpawned && this.kills >= Math.ceil(ld.kills * 0.3)) {
      this.bountySpawned = true;
      const bd = BOUNTIES.find((b) => b.id === this.bountyId);
      if (bd) {
        const a = this.yaw + rnd(-0.5, 0.5), q = { x: this.p.x - Math.sin(a) * 18, z: this.p.z - Math.cos(a) * 18 }; resolve(this.world.cols, q, 3);
        const e = this.spawnEnemy(bd.base, q.x, q.z, true, true, true);
        e.hp = e.max = Math.round(ENEMIES[bd.base].hp * bd.hpMul * this.diff.enemyHp); e.rig.root.scale.setScalar(ENEMIES[bd.base].scale * bd.scale); e.rad *= bd.scale; e.dmgMul *= 1.4;
        (e as any).bounty = this.bountyId; e.rig.mats.forEach((m) => { if (!m.transparent) m.color.lerp(new THREE.Color(bd.tint), 0.45); });
        this.cb.msg('m_bounty', { id: this.bountyId }); A.sfx('roar'); this.ring(q.x, 0.2, q.z, 8, bd.tint, 1);
      }
    }
    // contrato de caçada: elite marcado
    if (this.missionId === 'hunt' && !this.huntSpawned && this.kills >= Math.ceil(ld.kills * 0.4)) {
      this.huntSpawned = true;
      const a = this.yaw + rnd(-0.5, 0.5), q = { x: this.p.x - Math.sin(a) * 16, z: this.p.z - Math.cos(a) * 16 }; resolve(this.world.cols, q, 3);
      const e = this.spawnEnemy('elite', q.x, q.z, true, true, true); (e as any).hunt = true;
      e.rig.mats.forEach((m) => { if (!m.transparent) m.color.lerp(new THREE.Color(0xffd040), 0.3); });
      this.cb.msg('m_hunt'); A.sfx('warn');
    }
    for (let i = this.minisSpawned; i < ld.mini.length; i++) {
      if (this.kills >= Math.ceil(ld.kills * (i + 1) / (ld.mini.length + 1))) {
        const a = this.yaw + rnd(-0.6, 0.6), d = 20; const q = { x: this.p.x - Math.sin(a) * d, z: this.p.z - Math.cos(a) * d }; resolve(this.world.cols, q, 3);
        this.spawnEnemy(ld.mini[i], q.x, q.z, true, false, true); this.minisSpawned++; this.cb.msg('m_mini'); A.sfx('roar'); break;
      }
    }
    const behLeft = this.behelits.filter((b) => b.alive).length;
    if (this.kills >= ld.kills && this.minisSpawned >= ld.mini.length && this.minisDead >= ld.mini.length && behLeft === 0 && alive === 0 + 0 || (this.kills >= ld.kills && this.minisDead >= ld.mini.length && behLeft === 0 && this.minisSpawned >= ld.mini.length && alive <= 1)) this.spawnBoss();
  }
  updWaves(dt: number) {
    if (this.mode === 'camp') { this.updCampNpcs(dt); return; }
    if (this.mode === 'defense') { this.updDefense(dt); return; }
    if (this.endT >= 0 || this.p.dead) return;
    if (this.mode === 'training') {
      // repõe bonecos destruídos
      const alive = this.enemies.filter((e) => !e.dead).length;
      if (alive < 3) { (this as any)._dummyT = ((this as any)._dummyT ?? 2) - dt; if ((this as any)._dummyT <= 0) { this.spawnDummies(3 - alive); (this as any)._dummyT = null; } }
      return;
    }
    // armadilhas da masmorra
    if (this.mode === 'dungeon') {
      this.trapT -= dt;
      if (this.trapT <= 0) { this.trapT = rnd(6, 10); const a = rnd(0, TAU), d = rnd(1, 7); const x = this.p.x + Math.sin(a) * d, z = this.p.z + Math.cos(a) * d; const tele = this.makeTele('circle', 3, 0, 0xff8a20); tele.g.position.set(x, 0.06, z); this.traps.push({ tele, t: 1.3, x, z }); A.sfx('warn'); }
      for (const tr of [...this.traps]) {
        tr.t -= dt; this.setTele(tr.tele, 1 - tr.t / 1.3);
        if (tr.t <= 0) {
          if (Math.hypot(this.p.x - tr.x, this.p.z - tr.z) < 3.4) this.hurtPlayer(26, { x: tr.x, z: tr.z }, { unblock: true });
          this.burst(tr.x, 0.3, tr.z, 24, 0xff8a20, 8, 0.4, 0.6, -1, true); this.ring(tr.x, 0.15, tr.z, 3.2, 0xff8a20, 0.4); A.sfx('explosion');
          this.scene.remove(tr.tele.g); this.traps.splice(this.traps.indexOf(tr), 1);
        }
      }
    }
    const alive = this.enemies.filter((e) => !e.dead).length;
    if (alive > 0) return;
    this.waveRest -= dt;
    if (this.waveRest > 0) return;
    // próxima onda
    this.wave++; this.waveRest = 4; this.cb.msg('m_wave', { n: this.wave });
    const maxW = this.mode === 'dungeon' ? 6 : 999;
    if (this.mode === 'dungeon' && this.wave > 1) { // tesouro após cada sala
      const a = rnd(0, TAU); const q = { x: this.p.x + Math.sin(a) * 6, z: this.p.z + Math.cos(a) * 6 }; resolve(this.world.cols, q, 1);
      const g = makeRelic(); g.position.set(q.x, 0, q.z); this.scene.add(g); this.relics.push({ g, x: q.x, z: q.z, got: false }); this.cb.msg('m_chest');
    }
    const bossWave = (this.mode === 'arena' && this.wave % 5 === 0) || (this.mode === 'dungeon' && this.wave >= maxW);
    const hpMul = 1 + 0.07 * (this.wave - 1), dmgMul = 1 + 0.045 * (this.wave - 1);
    if (bossWave) {
      const bid = this.mode === 'dungeon' ? ARENA_BOSSES[Math.floor(Math.random() * ARENA_BOSSES.length)] : ARENA_BOSSES[(Math.floor(this.wave / 5) - 1) % ARENA_BOSSES.length];
      this.ld = { ...this.ld, boss: bid }; this.spawnBoss();
      if (this.boss) { const sc = this.mode === 'dungeon' ? 0.85 : 0.45 + 0.05 * Math.floor(this.wave / 5); this.boss.hp = this.boss.max = Math.round(this.boss.max * sc * this.diff.enemyHp); this.boss.dmgMul = dmgMul; }
      if (this.mode === 'dungeon') this.waveBossOn = true;
      return;
    }
    const pool = WAVE_POOL[Math.min(WAVE_POOL.length - 1, Math.floor((this.wave - 1) / 3))];
    const n = Math.min(9, 3 + Math.floor(this.wave * 0.7));
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), d = rnd(14, 24); const q = { x: this.p.x + Math.sin(a) * d, z: this.p.z + Math.cos(a) * d }; resolve(this.world.cols, q, 1.5);
      const e = this.spawnEnemy(pool[i % pool.length], q.x, q.z, true, true);
      e.hp = e.max = Math.round(e.max * hpMul); e.dmgMul *= dmgMul;
    }
  }
  objective(): { k: string; a?: number; b?: number } {
    if (this.mode === 'camp') return { k: 'o_camp' };
    if (this.mode === 'training') return { k: 'o_train' };
    if (this.defOn) return this.bossSpawned ? { k: 'o_boss' } : { k: 'o_def', a: this.wave, b: this.defMaxW };
    if (this.mode !== 'campaign') return { k: 'o_wave', a: this.wave };
    const ld = this.ld; const behLeft = this.behelits.filter((b) => b.alive).length;
    if (this.bossDead) return { k: 'o_done' };
    if (this.bossSpawned) return { k: 'o_boss' };
    if (this.kills < ld.kills) return { k: 'o_kill', a: this.kills, b: ld.kills };
    if (this.minisDead < ld.mini.length) return { k: 'o_mini' };
    if (behLeft > 0) return { k: 'o_behelit', a: behLeft };
    return { k: 'o_boss_soon' };
  }

  // ---------- câmera ----------
  updCamera(dt: number) {
    const p = this.p; const tgt = this.lockT && !this.lockT.dead ? this.lockT : null;
    if (this.cine === 'intro' && this.boss) { this.yaw = turn(this.yaw, Math.atan2(-(this.boss.x - p.x), -(this.boss.z - p.z)), dt * 2.5); this.pitch += (0.3 - this.pitch) * dt * 3; }
    else if (tgt) { this.yaw = turn(this.yaw, Math.atan2(-(tgt.x - p.x), -(tgt.z - p.z)), dt * 5); this.pitch += (0.32 - this.pitch) * dt * 2; }
    if (this.keys.has('ArrowLeft')) this.yaw += dt * 2; if (this.keys.has('ArrowRight')) this.yaw -= dt * 2; if (this.keys.has('ArrowUp')) this.pitch = clamp(this.pitch - dt * 1.2, 0.02, 1.25); if (this.keys.has('ArrowDown')) this.pitch = clamp(this.pitch + dt * 1.2, 0.02, 1.25);
    const bs = this.boss && !this.boss.dead ? this.boss.def.scale : 1; const want = 7.2 + (tgt ? 0.8 : 0) + (bs - 1) * 3.2 + (this.cine === 'intro' ? 3 : 0);
    this.camDist += (want - this.camDist) * dt * 3;
    const ty = 1.7 + (this.p.state === 'dodge' ? -0.3 : 0), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dirx = Math.sin(this.yaw) * cp, diry = sp, dirz = Math.cos(this.yaw) * cp;
    let d = this.camDist; for (let s = 0.5; s <= d; s += 0.5) { const x = p.x + dirx * s, y = ty + diry * s, z = p.z + dirz * s; if (blocked(this.world.cols, x, z, 0.35, y) || y < 0.4) { d = Math.max(1.4, s - 0.6); break; } }
    this.curD = this.curD == null ? d : this.curD + (d - this.curD) * Math.min(1, dt * (d < this.curD ? 14 : 4)); d = this.curD;
    let cx = p.x + dirx * d, cy = ty + diry * d, cz = p.z + dirz * d;
    if (this.shake > 0) { cx += rnd(-1, 1) * this.shake * 0.25; cy += rnd(-1, 1) * this.shake * 0.25; cz += rnd(-1, 1) * this.shake * 0.25; this.shake = Math.max(0, this.shake - dt * 2.5); }
    this.cam.position.set(cx, Math.max(0.5, cy), cz);
    let lx = p.x, lz = p.z; if (tgt && !this.cine) { lx = p.x + (tgt.x - p.x) * 0.25; lz = p.z + (tgt.z - p.z) * 0.25; } if (this.cine === 'intro' && this.boss) { lx = (p.x + this.boss.x) / 2; lz = (p.z + this.boss.z) / 2; }
    this.cam.lookAt(lx, ty - 0.1 + (this.cine === 'intro' ? 0.8 : 0), lz);
    const tf = 62 + (p.rageT > 0 ? 9 : 0) + (p.state === 'dodge' ? 3 : 0) + (this.p.state === 'attack' && p.an === 'heavy' ? 2 : 0); this.fov += (tf - this.fov) * Math.min(1, dt * 5); if (Math.abs(this.cam.fov - this.fov) > 0.05) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
    this.camRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.world.sun.position.set(p.x - 30, 50, p.z - 20); this.world.sun.target.position.set(p.x, 0, p.z); this.world.sun.target.updateMatrixWorld();
  }
  curD: number | null = null;

  // ---------- loop ----------
  loop = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop);
    if (now - this.last < this.minDt * 1000 - 2) return;
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.rdt = dt;
    if (this.paused) { this.renderer.render(this.scene, this.cam); this.pressed.clear(); return; }
    this.fpsAcc = this.fpsAcc * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
    if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.06; }
    dt *= this.slow;
    try { this.step(dt); } catch (err) { if (!this.stepErrLogged) { this.stepErrLogged = true; console.error('[BerserkEclipse] erro no passo de simulação:', err); } }
    this.pressed.clear(); // sempre limpar a entrada, mesmo se o passo falhar (evita ações presas)
    try { this.renderer.render(this.scene, this.cam); } catch { /* nunca travar o loop de render */ }
  };
  step(dt: number) {
    this.time += dt; this.save.playTime += dt;
    Prof.statTime('guts', dt, this.coop); if (this.coop) Prof.statTime('caska', dt, this.coop, false);
    if (this.cine) this.cineT += dt;
    this.updPlayer(dt);
    for (const e of [...this.enemies]) this.updEnemy(e, dt);
    this.updAllies(dt); this.updProj(dt); this.updFx(dt); this.updSpawner(dt); this.updCamera(dt);
    this.world.update(this.time, dt, this.p.x, this.p.z, this.fx);
    this.psA.update(dt); this.psN.update(dt);
    // brasas das fogueiras
    for (const f of this.world.fires) if (Math.hypot(f.x - this.p.x, f.z - this.p.z) < 40 && Math.random() < dt * 8 * this.fx) this.psA.emit(f.x + rnd(-0.3, 0.3), 0.6, f.z + rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(1, 2.5), rnd(-0.3, 0.3), 0xff8a30, 0.9, 0.12, rnd(0.8, 1.6), -0.2);
    for (const b of this.behelits) if (b.alive) { b.g.rotation.y += dt * 0.5; (b.g.userData.light as THREE.PointLight).intensity = 12 + Math.sin(this.time * 5) * 4; if (Math.random() < dt * 6 * this.fx) this.psA.emit(b.x + rnd(-0.6, 0.6), 0.5, b.z + rnd(-0.6, 0.6), 0, rnd(1, 2), 0, 0xff2a20, 0.9, 0.2, 1, 0); }
    for (const r of this.relics) if (!r.got) { r.g.rotation.y += dt * 2; r.g.position.y = Math.sin(this.time * 2) * 0.15; }
    this.watchers.forEach((w, i) => { w.root.position.y = 0; animate(w, { ...newAS(), t: this.time + i, atk: '', mv: 0 }); });
    // armadura berserker: aura
    if (this.save.armorEq && Math.random() < dt * 15 * this.fx) this.psA.emit(this.p.x + rnd(-0.4, 0.4), rnd(0.3, 2), this.p.z + rnd(-0.4, 0.4), 0, 1, 0, 0xa01010, 0.6, 0.18, 0.8, -0.5);
    // segredos de Griffith + Ivalera no modo solo com Caska
    this.updSecrets(dt); this.ivaleraT = Math.max(0, this.ivaleraT - dt);
    if (this.hero === 'caska' && this.ivalera) {
      const iv = this.ivalera; this.ivaleraAS.t += dt;
      const ang = this.p.fa + 2.2, tx = this.p.x + Math.sin(ang) * 1.1, tz = this.p.z + Math.cos(ang) * 1.1, ty = 1.9 + Math.sin(this.ivaleraAS.t * 3) * 0.15;
      iv.root.position.x += (tx - iv.root.position.x) * Math.min(1, dt * 6); iv.root.position.z += (tz - iv.root.position.z) * Math.min(1, dt * 6); iv.root.position.y += (ty - iv.root.position.y) * Math.min(1, dt * 6);
      iv.root.rotation.y = this.p.fa; this.ivaleraAS.fly = true; animate(iv, this.ivaleraAS);
      if (this.ivaleraT > 0 && Math.random() < dt * 30 * this.fx) this.burst(this.p.x + rnd(-0.4, 0.4), rnd(1, 2), this.p.z + rnd(-0.4, 0.4), 1, 0xffb0e0, 2, 0.2, 0.7, -1, true);
    }
    for (const f of this.feathers) if (!f.got) f.g.rotation.y += dt * 1.5;
    if (this.behItem && !this.behItem.got) this.behItem.g.rotation.y += dt;
    if (this.talkBeh && !this.talkBeh.used) { this.talkBeh.g.rotation.y += dt * 0.8; if (Math.random() < dt * 4 * this.fx) this.burst(this.talkBeh.x, 1.5, this.talkBeh.z, 1, 0xff2a20, 2, 0.25, 0.8, -1, true); }
    if (this.docItem && !this.docItem.got) { this.docItem.g.rotation.y += dt * 1.2; this.docItem.g.position.y = Math.sin(this.time * 2) * 0.1; }
    // cinemática / fim
    if (this.endT >= 0) this.updEnd(dt);
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.08; this.emitHud(); this.drawMinimap(); }
    // host: envia snapshot ~16Hz + mede ping
    if (this.netSend) {
      this.snapAcc += this.rdt; if (this.snapAcc >= 0.06) { this.snapAcc = 0; try { this.netSend({ t: 'snap', d: this.netSnapshot() }); } catch { /* */ } }
      this.pingAcc += this.rdt; if (this.pingAcc >= 2) { this.pingAcc = 0; Prof.flushStats(); }
    }
  }
  rdt = 0.016;
  updEnd(_dt: number) {
    const dt = this.rdt; this.endT += dt;
    if (this.p.dead) { if (this.endT > 2.8 && !this.endSent) this.finish(false); return; }
    if (this.bossDead) {
      if (this.cine === 'bossdown' && this.endT > 1.8) { this.cine = this.lv === 5 ? 'eclipse' : ''; if (this.lv !== 5) this.slow = 1; }
      if (this.lv === 5) {
        if (this.endT > 2.5 && !(this as any)._b1) { (this as any)._b1 = 1; this.slow = 1; this.cb.msg('m_behelit1'); A.sfx('behelit'); this.burst(this.p.x, 2, this.p.z, 40, 0xff2a20, 8, 0.4, 1, -1, true); }
        if (this.endT > 5 && !(this as any)._b2) { (this as any)._b2 = 1; this.cb.msg('m_behelit2'); A.sfx('eclipse'); A.startMusic('eclipse'); }
        if (this.endT > 5) { this.world.eclipse(clamp((this.endT - 5) / 4, 0, 1)); this.applyLightK(); this.shake = Math.max(this.shake, 0.15); if (Math.random() < 0.8) this.psA.emit(this.p.x + rnd(-20, 20), rnd(0, 10), this.p.z + rnd(-20, 20), 0, rnd(1, 3), 0, 0xff3010, 0.9, 0.3, 2, 0); }
        if (this.endT > 10.5) this.finish(true);
      } else if (this.endT > 3.4) { A.sfx('win'); this.finish(true); }
    }
  }
  applyLightK() { const g = getSettings().gfx; this.world.sun.intensity = this.world.baseSunI * g.light; this.world.hemi.intensity = this.world.baseAmbI * g.light; this.scene.background = (this.world.fog.color as THREE.Color).clone(); }
  finish(win: boolean) {
    if (this.endSent) return; this.endSent = true; A.sfx(win ? 'win' : 'lose'); document.pointerLockElement && document.exitPointerLock();
    if (this.missionId === 'nodeath') this.missionOk = win && !this.diedOnce;
    if (this.missionId === 'swift') this.missionOk = win && this.time < 360;
    if (this.missionId === 'hunt') this.missionOk = this.missionOk && win;
    this.cb.end({
      win, kills: this.kills + this.minisDead + (this.bossDead ? 1 : 0), time: this.time, combat: this.combat, boss: this.bossDead ? this.ld.boss : null, level: this.lv, relics: this.relicN, wave: this.wave, mode: this.mode,
      side: this.missionId || this.bountyId ? { mission: this.missionId, missionOk: this.missionOk, bounty: this.bountyId, bountyOk: this.bountyOk } : undefined,
    });
  }
  emitHud() {
    const p = this.p, gs = this.gs, tut = this.lv === 1 && this.mode === 'campaign' ? TUT.find((t) => !this.tutDone.has(t)) : undefined;
    if (this.lv === 1 && this.tutDone.has('xbow') && !(this as any)._tr) { (this as any)._tr = 1; p.rage = 100; }
    let prompt: string | null = null;
    if (this.mode === 'camp') {
      const n = this.nearNpc();
      if (this.chests.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 2.4)) prompt = 'p_chest';
      else if (n) prompt = 'p_talk:' + n.id;
      else if (this.nearBoard()) prompt = 'p_board';
      else if (Math.hypot(DEPART.x - p.x, DEPART.z - p.z) < 3) prompt = 'p_depart';
    }
    if (this.eggItem && !this.eggItem.got && Math.hypot(this.eggItem.x - p.x, this.eggItem.z - p.z) < 2.5) prompt = 'p_egg';
    if (this.defOn) {
      const n = this.defNpcs.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2.6);
      const al = !n && this.mode === 'defense' ? this.allies.find((q) => this.defHired.includes(q.id) && Math.hypot(q.x - p.x, q.z - p.z) < 2.6) : null;
      if (n) prompt = 'p_talk:' + n.id;
      else if (al) prompt = 'p_talk:' + al.id;
      else if (this.posts.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2.3)) prompt = 'p_post';
    }
    for (const f of this.world.fires) if (f.usable && !f.used && Math.hypot(f.x - p.x, f.z - p.z) < 3.2) prompt = 'p_rest';
    for (const r of this.relics) if (!r.got && Math.hypot(r.x - p.x, r.z - p.z) < 3) prompt = 'p_relic';
    for (const f of this.feathers) if (!f.got && Math.hypot(f.x - p.x, f.z - p.z) < 2.5) prompt = 'p_feather';
    if (this.secretFlag && !this.secretFlag.found && Math.hypot(this.secretFlag.x - p.x, this.secretFlag.z - p.z) < 3.5) prompt = 'p_flag';
    if (this.behItem && !this.behItem.got && Math.hypot(this.behItem.x - p.x, this.behItem.z - p.z) < 2.5) prompt = 'p_behitem';
    if (this.talkBeh && !this.talkBeh.used && Math.hypot(this.talkBeh.x - p.x, this.talkBeh.z - p.z) < 3) prompt = 'p_talkbeh';
    if (this.docItem && !this.docItem.got && Math.hypot(this.docItem.x - p.x, this.docItem.z - p.z) < 2.5) prompt = 'p_doc';
    const sk: HudState['skills'] = [];
    if (this.puckOn()) sk.push({ id: 'puck', cd: p.healCd, max: 60, on: false });
    this.allies.forEach((a) => { if (a.id === 'puck') return; sk.push({ id: a.id, cd: a.id === 'caska' ? this.eagleCd : a.cd, max: { serpico: 20, roderick: 18, schierke: 60, farnese: 25, caska: this.cs.detCd }[a.id] || 20, on: (a.id === 'caska' && this.eagle > 0) || (a.id === 'farnese' && this.shieldT > 0) || (a.id === 'serpico' && a.spinT > 0) }); });
    const b = this.boss && !this.boss.dead && this.boss.state !== 'intro' ? this.boss : null;
    this.cb.hud({
      hp: p.hp, maxHp: gs.maxHp, stam: p.stam, maxStam: gs.maxStam, rage: p.rage, rageNeed: gs.rageNeed, rageOn: p.rageT > 0, rageLeft: p.rageT, armor: this.save.armorEq, cannon: p.cannon, cannonCd: p.cannon < 3 ? Math.max(0, p.cannonCd) / 8 : 0,
      bolts: p.bolts, reloading: p.reload > 0, points: this.combat, obj: this.objective(), kills: this.kills, target: this.ld.kills,
      boss: b ? { name: b.id, hp: Math.max(0, b.hp), max: b.max, phase: b.phase, phases: b.boss!.phases } : null, skills: sk,
      tut: tut ? { id: tut, i: TUT.indexOf(tut), n: TUT.length } : null, prompt, lock: !!this.lockT, cine: this.cine, dead: p.dead, exhausted: p.exhausted, guard: p.block, eagle: this.eagle > 0, time: this.time, shield: this.shield,
      mate: this.coop ? { hp: this.cask.hp, maxHp: this.cask.maxHp, dead: this.cask.dead } : null,
      allyBars: this.allyBarsFor('guts'), buffGuts: this.gBuff, buffCaska: this.cBuff, difficulty: this.diffName(),
      ivalera: this.coop ? { cd: this.cask.ivaleraCd, max: IVALERA_CD, active: this.cask.ivaleraT > 0 } : this.hero === 'caska' ? { cd: p.healCd, max: IVALERA_CD, active: this.ivaleraT > 0 } : null,
      hero: this.hero, secret: this.secretHud(),
      defense: this.defOn ? {
        barrier: Math.round(this.defs.barrier), max: this.defs.barrierMax, wave: this.wave, maxW: this.defMaxW,
        prep: this.enemies.some((e) => !e.dead) || (this.bossSpawned && this.boss && !this.boss.dead) ? 0 : Math.max(0, this.waveRest),
        vhp: Math.round(this.vHp), vmax: this.vHpMax, left: this.enemies.filter((e) => !e.dead).length,
      } : null,
      cursorFree: this.cursorFree,
    });
  }
  diffName() { return this.diff === DIFFS.easy ? 'easy' : this.diff === DIFFS.hard ? 'hard' : 'medium'; }
  allyBarsFor(side: 'guts' | 'caska'): AllyBar[] {
    const out: AllyBar[] = [];
    for (const a of this.allies) {
      if (a.id === 'puck' || a === this.caskaNet || !a.maxHp) continue;
      const forCaska = a.id === 'farnese'; // Farnese é suporte de Caska no coop
      if (side === 'guts' && this.coop && forCaska) continue;
      if (side === 'caska' && !forCaska) continue;
      out.push({ id: a.id, hp: Math.ceil(a.hp), maxHp: Math.round(a.maxHp), down: a.downT > 0 });
    }
    return out.slice(0, 5);
  }
  drawMinimap() {
    const c = this.minimap; if (!c) return; const x = c.getContext('2d'); if (!x) return; const S = c.width, h = S / 2, sc = h / 38;
    x.clearRect(0, 0, S, S); x.save(); x.beginPath(); x.arc(h, h, h - 1, 0, TAU); x.clip(); x.fillStyle = 'rgba(8,6,6,0.82)'; x.fillRect(0, 0, S, S);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), p = this.p;
    const tr = (wx: number, wz: number) => { const dx = wx - p.x, dz = wz - p.z; return [h + (dx * cy - dz * sy) * sc, h + (dx * sy + dz * cy) * sc]; };
    x.strokeStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.arc(h, h, h * 0.5, 0, TAU); x.stroke();
    x.fillStyle = 'rgba(120,110,100,0.6)'; for (const c of this.world.cols) { if (c.h < 2.5) continue; const [a, b] = tr(c.x, c.z); if (Math.hypot(a - h, b - h) > h + 8) continue; if (c.r) { x.beginPath(); x.arc(a, b, Math.max(1.2, c.r * sc), 0, TAU); x.fill(); } else { x.save(); x.translate(a, b); x.rotate(this.yaw - (c.ry || 0)); x.fillRect(-c.hx! * sc, -c.hz! * sc, c.hx! * 2 * sc, c.hz! * 2 * sc); x.restore(); } }
    const edge = (a: number, b: number) => { const d = Math.hypot(a - h, b - h), m = h - 7; if (d > m) return [h + (a - h) * m / d, h + (b - h) * m / d, true]; return [a, b, false]; };
    for (const f of this.world.fires) if (f.usable && !f.used) { const [a, b] = tr(f.x, f.z); const [ea, eb] = edge(a, b); x.fillStyle = '#ffa030'; x.beginPath(); x.arc(ea as number, eb as number, 3, 0, TAU); x.fill(); }
    for (const r of this.relics) if (!r.got) { const [a, b] = tr(r.x, r.z); if (Math.hypot(a - h, b - h) < h) { x.fillStyle = '#ffe060'; x.fillRect(a - 2, b - 2, 4, 4); } }
    for (const bh of this.behelits) if (bh.alive) { const [a, b] = tr(bh.x, bh.z); const [ea, eb] = edge(a, b); x.fillStyle = '#c040ff'; x.save(); x.translate(ea as number, eb as number); x.rotate(PI / 4); x.fillRect(-4, -4, 8, 8); x.restore(); }
    for (const e of this.enemies) { if (e.dead || (!e.aggro && !e.boss)) continue; const [a, b] = tr(e.x, e.z); const [ea, eb, off] = edge(a, b); if (off && !e.boss && !e.mini) continue; x.fillStyle = e.boss ? '#ffd040' : e.mini ? '#ff7030' : '#e03030'; x.beginPath(); x.arc(ea as number, eb as number, e.boss ? 6 : e.mini ? 4.5 : 2.6, 0, TAU); x.fill(); if (e.boss) { x.strokeStyle = '#fff'; x.stroke(); } }
    x.fillStyle = '#6ad0ff'; for (const a of this.allies) { const [ax, ay] = tr(a.x, a.z); x.fillRect(ax - 1.5, ay - 1.5, 3, 3); }
    if (this.defOn) {
      // igreja (dourado) + entradas sob ataque (vermelho piscante)
      { const [a, b] = tr(0, -7.4); const [ea, eb] = edge(a, b); x.fillStyle = '#ffd860'; x.save(); x.translate(ea as number, eb as number); x.fillRect(-2, -5, 4, 10); x.fillRect(-5, -2, 10, 4); x.restore(); }
      const hot = new Set(this.enemies.filter((e) => !e.dead).map((e) => (e as any).ent as string | undefined));
      for (const E2 of Engine.ENTR) { if (!hot.has(E2.id)) continue; if (Math.floor(this.time * 3) % 2 === 0) continue; const [a, b] = tr(E2.x, E2.z); const [ea, eb] = edge(a, b); x.fillStyle = '#ff3020'; x.beginPath(); x.arc(ea as number, eb as number, 5, 0, TAU); x.fill(); x.strokeStyle = '#fff'; x.stroke(); }
      x.fillStyle = '#8affc8'; for (const g of this.golems) if (g.minion) { const [a, b] = tr(g.x, g.z); if (Math.hypot(a - h, b - h) < h) x.fillRect(a - 1.5, b - 1.5, 3, 3); }
    }
    x.translate(h, h); x.rotate(this.yaw + PI - p.fa); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -6); x.lineTo(4.5, 5); x.lineTo(0, 2.5); x.lineTo(-4.5, 5); x.closePath(); x.fill();
    x.restore(); x.strokeStyle = 'rgba(200,170,120,0.8)'; x.lineWidth = 2; x.beginPath(); x.arc(h, h, h - 1, 0, TAU); x.stroke();
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku); window.removeEventListener('blur', this.bl); window.removeEventListener('mouseup', this.mu); document.removeEventListener('mousemove', this.mm); document.removeEventListener('pointerlockchange', this.plc); window.removeEventListener('resize', this.resize);
    if (document.pointerLockElement) document.exitPointerLock();
    this.enemies.forEach((e) => disposeRig(e.rig)); this.allies.forEach((a) => disposeRig(a.rig)); this.npcs.forEach((n) => disposeRig(n.rig)); this.defNpcs.forEach((n) => disposeRig(n.rig)); if (this.defs.schierke) disposeRig(this.defs.schierke.rig); this.chests.forEach((c) => this.scene.remove(c.g)); disposeRig(this.rig);
    this.geoCache.forEach((g) => g.dispose()); this.matCache.forEach((m) => m.dispose()); this.fxs.forEach((f) => f.mat?.dispose());
    this.psA.geo.dispose(); this.psA.mat.dispose(); this.psN.geo.dispose(); this.psN.mat.dispose(); this.world.dispose(); this.envTex?.dispose(); this.scene.environment = null;
    this.scene.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); });
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); A.stopMusic();
    void mk; void gBox; void gSph; void gCone; void makeRelic;
  }
}
function animeP(t: number, W: number, S: number, R: number) { return animP(t, W, S, R); }
function animP(t: number, W: number, S: number, R: number) { void animeP; if (t < W) return 0.45 * (t / W); if (t < W + S) return 0.45 + 0.2 * ((t - W) / S); return Math.min(1, 0.65 + 0.35 * ((t - W - S) / R)); }
