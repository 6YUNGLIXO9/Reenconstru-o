// Cliente (jogador 2 = Caska): NÃO simula o jogo. Reconstrói o mundo a partir da semente (nível),
// renderiza os estados recebidos do host com sua própria câmera e envia a entrada local.
import * as THREE from 'three';
import { Rig, AS, newAS, animate, own, disposeRig, buildGuts, buildCaska, buildEnemy, buildBoss, setBerserk, setCloak, buildIvalera } from './models';
import { buildWorld, blocked, World } from './world';
import { ETYPES, BTYPES, aStr, NetSnap, NetPlayer } from './netproto';
import { LEVELS } from '../data';
import { getSettings, Save } from '../save';
import * as A from '../audio';

const PI = Math.PI;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerpA = (a: number, b: number, k: number) => { let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return a + d * k; };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function applyAS(as: AS, np: NetPlayer, dt: number) {
  as.t += dt; as.atk = aStr(np.a); as.p = np.p; as.mv = np.mv; as.run = np.mv > 0.9; as.dodge = np.dg; as.hit = np.hit; as.dead = np.dead; as.stun = !!np.stun; as.block = !!np.blk; as.rage = !!np.rage; as.fly = !!np.fly;
}
interface AllyBar { id: string; hp: number; maxHp: number; down: boolean }
interface ClientHud { hp: number; maxHp: number; stam: number; maxStam: number; special: { cd: number; max: number; on: boolean }; partner: { hp: number; maxHp: number } | null; boss: { name: string; hp: number; max: number; phase: number; phases: number } | null; obj: { k: string; a?: number; b?: number }; kills: number; target: number; points: number; cine: string; dead: boolean; ping: number; waiting: boolean; allyBars: AllyBar[]; buffCaska: boolean; ivalera: { cd: number; max: number; active: boolean } | null; difficulty: string; cursorFree?: boolean }

interface EntView { rig: Rig; as: AS; x: number; z: number; fa: number; tx: number; tz: number; tfa: number; ty: number; y: number; type: number; seen: number; dead: boolean }

export class NetClient {
  host: HTMLElement; lv: number; save: Save; sendInput: (d: any) => void; hud: (h: ClientHud) => void; onReady: () => void;
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); cam: THREE.PerspectiveCamera; world: World;
  guts: Rig; gutsAS = newAS(); caska: Rig; caskaAS = newAS();
  ents = new Map<number, EntView>(); boss: EntView | null = null; projs: THREE.Mesh[] = []; projGeo: THREE.BufferGeometry; projMat: THREE.Material;
  yaw = 0; pitch = 0.4; curD = 7.4; keys = new Set<string>(); raf = 0; last = performance.now(); disposed = false; paused = false; noLock = false;
  snap: NetSnap | null = null; prev: NetSnap | null = null; cx = 0; cz = 0; cfa = PI; gx = 0; gz = 0; gfa = PI; inputAcc = 0; curHud: ClientHud; ping = 0; waiting = true; minimap: HTMLCanvasElement | null = null;
  edge = { light: false, heavy: false, dodge: false, special: false, interact: false };
  caskaRig!: Rig; ivalera!: Rig; ivAS = newAS(); inputLocked = false; cursorFree = false;
  toggleCursor() {
    this.cursorFree = !this.cursorFree;
    if (this.cursorFree) { this.keys.clear(); this.sendLocalInput(); if (document.pointerLockElement) document.exitPointerLock(); }
    else if (!this.noLock && !this.paused && !this.inputLocked) { try { (this.renderer.domElement.requestPointerLock() as any)?.catch?.(() => { this.noLock = true; }); } catch { this.noLock = true; } }
  }

  constructor(host: HTMLElement, level: number, save: Save, sendInput: (d: any) => void, hud: (h: ClientHud) => void) {
    this.host = host; this.lv = level; this.save = save; this.sendInput = sendInput; this.hud = hud; this.onReady = () => {};
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;outline:none';
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    host.appendChild(this.renderer.domElement);
    this.cam = new THREE.PerspectiveCamera(62, 1, 0.2, 300);
    const g = getSettings().gfx; const theme = LEVELS[level - 1].theme;
    this.world = buildWorld(theme, level, g.tex); this.scene.add(this.world.group); this.scene.fog = this.world.fog; this.scene.background = new THREE.Color(this.world.theme.fog);
    this.guts = buildGuts(); own(this.guts); setBerserk(this.guts, save.armorEq); this.scene.add(this.guts.root);
    this.caska = buildCaska(save.cloakEq); own(this.caska); setCloak(this.caska, save.cloakEq); this.scene.add(this.caska.root);
    this.projGeo = new THREE.SphereGeometry(0.28, 8, 6); this.projMat = new THREE.MeshBasicMaterial({ color: 0xff6030 });
    this.caskaRig = this.caska;
    this.ivalera = buildIvalera(); own(this.ivalera); this.scene.add(this.ivalera.root);
    this.curHud = { hp: 172, maxHp: 172, stam: 140, maxStam: 140, special: { cd: 0, max: 60, on: false }, partner: null, boss: null, obj: { k: 'o_boss_soon' }, kills: 0, target: 0, points: 0, cine: '', dead: false, ping: 0, waiting: true, allyBars: [], buffCaska: false, ivalera: null, difficulty: 'medium' };
    this.applySettings(); this.initInput(); this.resize(); window.addEventListener('resize', this.resize);
    A.resume(); A.startMusic(theme);
    this.raf = requestAnimationFrame(this.loop);
  }
  setMinimap(c: HTMLCanvasElement | null) { this.minimap = c; }
  applySettings() {
    const g = getSettings().gfx, r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * g.res);
    r.shadowMap.enabled = g.shadow > 0; r.shadowMap.type = g.shadow === 1 ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    this.world.sun.castShadow = g.shadow > 0; this.cam.far = 280 * g.dist; this.cam.updateProjectionMatrix();
    this.world.fog.density = this.world.baseFog / g.dist; this.world.sun.intensity = this.world.baseSunI * g.light; this.world.hemi.intensity = this.world.baseAmbI * g.light;
    this.resize();
  }
  resize = () => { const w = this.host.clientWidth || 800, h = this.host.clientHeight || 600; this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); };

  // entrada local
  code = (a: string) => getSettings().keys[a];
  down = (a: string) => this.keys.has(this.code(a));
  initInput() {
    window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku); window.addEventListener('blur', this.bl);
    const c = this.renderer.domElement; c.addEventListener('mousedown', this.md); window.addEventListener('mouseup', this.mu); document.addEventListener('mousemove', this.mm);
    c.addEventListener('contextmenu', (e) => e.preventDefault()); document.addEventListener('pointerlockerror', () => { this.noLock = true; });
  }
  onPause: (() => void) | null = null;
  setInputLocked(b: boolean) { this.inputLocked = b; this.keys.clear(); this.edge = { light: false, heavy: false, dodge: false, special: false, interact: false }; if (b && document.pointerLockElement) document.exitPointerLock(); if (b) this.sendLocalInput(); }
  kd = (e: KeyboardEvent) => {
    if (['Tab', 'Space'].includes(e.code)) e.preventDefault(); if (e.repeat || this.paused) return;
    if (e.code === this.code('pause') || e.code === 'Escape') { this.setInputLocked(true); this.onPause?.(); return; }
    if (e.code === this.code('cursor') && !this.inputLocked) { this.toggleCursor(); return; } // G: cursor livre local (não sincroniza)
    if (this.inputLocked) return;
    this.keys.add(e.code); if (e.code === this.code('dodge')) this.edge.dodge = true; if (e.code === this.code('rage')) this.edge.special = true; if (e.code === this.code('interact')) this.edge.interact = true;
  };
  ku = (e: KeyboardEvent) => this.keys.delete(e.code);
  bl = () => this.keys.clear();
  md = (e: MouseEvent) => { if (this.paused || this.inputLocked || this.cursorFree) return; if (!document.pointerLockElement && !this.noLock) { try { (this.renderer.domElement.requestPointerLock() as any)?.catch?.(() => { this.noLock = true; }); } catch { this.noLock = true; } } this.keys.add('Mouse' + e.button); if (e.button === 0) this.edge.light = true; if (e.button === 2) this.edge.heavy = true; e.preventDefault(); A.resume(); };
  mu = (e: MouseEvent) => this.keys.delete('Mouse' + e.button);
  mm = (e: MouseEvent) => { if (this.paused || this.inputLocked || this.cursorFree) return; if (document.pointerLockElement || this.noLock) { this.yaw -= e.movementX * 0.0026; this.pitch = clamp(this.pitch + e.movementY * 0.0022, 0.02, 1.25); } };
  setPaused(b: boolean) { this.paused = b; if (b) { this.keys.clear(); if (document.pointerLockElement) document.exitPointerLock(); } this.last = performance.now(); }

  onSnap(d: NetSnap) { this.prev = this.snap; this.snap = d; this.waiting = false; if (this.prev == null) { this.cx = d.ca?.x ?? 0; this.cz = d.ca?.z ?? 0; this.gx = d.gu.x; this.gz = d.gu.z; this.onReady(); } }
  setPing(p: number) { this.ping = p; }

  sendLocalInput() {
    if (this.inputLocked) { this.sendInput({ t: 'input', d: { mx: 0, mz: 0, run: false, yaw: +this.yaw.toFixed(2), block: false, light: false, heavy: false, dodge: false, special: false, interact: false } }); return; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const ix = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0), iz = (this.down('fwd') ? 1 : 0) - (this.down('back') ? 1 : 0);
    let mx = 0, mz = 0; if (ix || iz) { mx = ix * cy - iz * sy; mz = -ix * sy - iz * cy; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; }
    this.sendInput({ t: 'input', d: { mx: +mx.toFixed(3), mz: +mz.toFixed(3), run: this.down('run'), yaw: +this.yaw.toFixed(2), block: this.down('block'), light: this.edge.light, heavy: this.edge.heavy, dodge: this.edge.dodge, special: this.edge.special, interact: this.edge.interact } });
    this.edge = { light: false, heavy: false, dodge: false, special: false, interact: false };
  }

  entFor(nid: number, type: number): EntView {
    let e = this.ents.get(nid);
    if (!e) { const rig = buildEnemy(ETYPES[type]); own(rig); this.scene.add(rig.root); e = { rig, as: newAS(), x: 0, z: 0, fa: 0, tx: 0, tz: 0, tfa: 0, ty: 0, y: 0, type, seen: this.frame, dead: false }; this.ents.set(nid, e); }
    e.seen = this.frame; return e;
  }
  frame = 0;
  loop = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.paused) { this.renderer.render(this.scene, this.cam); return; }
    this.frame++;
    this.inputAcc += dt; if (this.inputAcc >= 0.033 || this.edge.light || this.edge.heavy || this.edge.dodge || this.edge.special) { this.inputAcc = 0; this.sendLocalInput(); }
    this.step(dt);
    this.renderer.render(this.scene, this.cam);
  };
  step(dt: number) {
    const s = this.snap; const k = Math.min(1, dt * 12);
    if (s) {
      // Caska (jogador local) e Guts (parceiro)
      if (s.ca) { this.cx = lerp(this.cx, s.ca.x, k); this.cz = lerp(this.cz, s.ca.z, k); this.cfa = lerpA(this.cfa, s.ca.fa, k); applyAS(this.caskaAS, s.ca, dt); this.caska.root.position.set(this.cx, 0, this.cz); this.caska.root.rotation.y = this.cfa; animate(this.caska, this.caskaAS); this.caska.root.visible = s.ca.dead < 0.01 || true; }
      this.gx = lerp(this.gx, s.gu.x, k); this.gz = lerp(this.gz, s.gu.z, k); this.gfa = lerpA(this.gfa, s.gu.fa, k); applyAS(this.gutsAS, s.gu, dt); this.guts.root.position.set(this.gx, 0, this.gz); this.guts.root.rotation.y = this.gfa; animate(this.guts, this.gutsAS);
      // inimigos
      const live = new Set<number>();
      for (const row of s.en) { const [nid, type, x, z, fa, a, p, mv, hpf, dead, scale, y] = row; live.add(nid); const e = this.entFor(nid, type); e.tx = x; e.tz = z; e.tfa = fa; e.ty = y; e.rig.root.scale.setScalar(scale); e.dead = !!dead; e.as.atk = aStr(a); e.as.p = p; e.as.mv = mv; e.as.run = mv > 0.9; e.as.dead = dead ? (e.as.dead + dt * 1.6) : 0; void hpf; }
      for (const [nid, e] of [...this.ents]) { if (!live.has(nid)) { this.scene.remove(e.rig.root); disposeRig(e.rig); this.ents.delete(nid); continue; } e.x = lerp(e.x, e.tx, k); e.z = lerp(e.z, e.tz, k); e.fa = lerpA(e.fa, e.tfa, k); e.y = lerp(e.y, e.ty, k); e.as.t += dt; e.rig.root.position.set(e.x, e.y, e.z); e.rig.root.rotation.y = e.fa; animate(e.rig, e.as); }
      // chefe
      if (s.bo) {
        const [type, x, z, fa, a, p, mv, hp, max, phase, phases, y, dead] = s.bo;
        if (!this.boss || this.boss.type !== type) { if (this.boss) { this.scene.remove(this.boss.rig.root); disposeRig(this.boss.rig); } const rig = buildBoss(BTYPES[type]); own(rig); this.scene.add(rig.root); this.boss = { rig, as: newAS(), x, z, fa, tx: x, tz: z, tfa: fa, ty: y, y, type, seen: 0, dead: false }; }
        const b = this.boss; b.tx = x; b.tz = z; b.tfa = fa; b.ty = y; b.x = lerp(b.x, x, k); b.z = lerp(b.z, z, k); b.fa = lerpA(b.fa, fa, k); b.y = lerp(b.y, y, k);
        b.as.t += dt; b.as.atk = aStr(a); b.as.p = p; b.as.mv = mv; b.as.run = mv > 0.9; b.as.dead = dead ? b.as.dead + dt * 1.6 : 0; b.rig.root.scale.setScalar(buildScale(type)); b.rig.root.position.set(b.x, b.y, b.z); b.rig.root.rotation.y = b.fa; animate(b.rig, b.as);
        this.curHud.boss = { name: BTYPES[type], hp, max, phase, phases };
      } else { if (this.boss) { this.scene.remove(this.boss.rig.root); disposeRig(this.boss.rig); this.boss = null; } this.curHud.boss = null; }
      // projéteis (visual)
      while (this.projs.length < s.pr.length) { const m = new THREE.Mesh(this.projGeo, this.projMat); this.scene.add(m); this.projs.push(m); }
      while (this.projs.length > s.pr.length) { const m = this.projs.pop()!; this.scene.remove(m); }
      s.pr.forEach((pr, i) => { this.projs[i].position.set(pr[0], pr[1], pr[2]); });
      // hud
      if (s.ca) { this.curHud.hp = s.ca.hp; this.curHud.maxHp = s.ca.mhp; this.curHud.stam = s.ca.st; this.curHud.maxStam = s.ca.mst; this.curHud.dead = s.ca.dead > 0.01; }
      this.curHud.partner = { hp: s.gu.hp, maxHp: s.gu.mhp };
      this.curHud.obj = s.ob; this.curHud.kills = s.ki; this.curHud.target = s.tg; this.curHud.points = s.pt; this.curHud.cine = s.cine; this.curHud.ping = Math.round(this.ping); this.curHud.waiting = false;
      if ((s as any).caEagle) this.curHud.special = { cd: (s as any).caEagle.cd, max: (s as any).caEagle.max, on: (s as any).caEagle.on };
      const sx = s as any; this.curHud.allyBars = sx.cBars || []; this.curHud.buffCaska = !!sx.buffCaska; this.curHud.ivalera = sx.ivalera || null; this.curHud.difficulty = sx.diff || 'medium';
      // Ivalera (fada de Caska)
      const ip = sx.ivPos; if (ip) { this.ivalera.root.visible = true; this.ivalera.root.position.set(lerp(this.ivalera.root.position.x, ip[0], k), lerp(this.ivalera.root.position.y, ip[1], k), lerp(this.ivalera.root.position.z, ip[2], k)); this.ivAS.t += dt; this.ivAS.fly = true; this.ivalera.root.rotation.y = this.cfa; animate(this.ivalera, this.ivAS); } else this.ivalera.root.visible = false;
    } else { this.curHud.waiting = this.waiting; this.ivalera.root.visible = false; }
    this.world.update(performance.now() / 1000, dt, this.cx, this.cz, getSettings().gfx.fx);
    this.updCam(dt); this.drawMinimap();
    this.curHud.cursorFree = this.cursorFree;
    this.hud(this.curHud);
  }
  updCam(dt: number) {
    if (this.keys.has('ArrowLeft')) this.yaw += dt * 2; if (this.keys.has('ArrowRight')) this.yaw -= dt * 2;
    const bs = this.boss ? buildScale(this.boss.type) : 1, want = 7.2 + (bs - 1) * 3;
    this.curD += (want - this.curD) * dt * 3;
    const ty = 1.7, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = sp, dz = Math.cos(this.yaw) * cp;
    let d = this.curD; for (let st = 0.5; st <= d; st += 0.5) { const x = this.cx + dx * st, y = ty + dy * st, z = this.cz + dz * st; if (blocked(this.world.cols, x, z, 0.35, y) || y < 0.4) { d = Math.max(1.4, st - 0.6); break; } }
    this.cam.position.set(this.cx + dx * d, Math.max(0.5, ty + dy * d), this.cz + dz * d);
    this.cam.lookAt(this.cx, ty - 0.1, this.cz);
    this.world.sun.position.set(this.cx - 30, 50, this.cz - 20); this.world.sun.target.position.set(this.cx, 0, this.cz); this.world.sun.target.updateMatrixWorld();
  }
  drawMinimap() {
    const c = this.minimap; if (!c) return; const x = c.getContext('2d'); if (!x) return; const S = c.width, h = S / 2, sc = h / 38;
    x.clearRect(0, 0, S, S); x.save(); x.beginPath(); x.arc(h, h, h - 1, 0, 2 * PI); x.clip(); x.fillStyle = 'rgba(8,6,6,0.82)'; x.fillRect(0, 0, S, S);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const tr = (wx: number, wz: number) => { const ddx = wx - this.cx, ddz = wz - this.cz; return [h + (ddx * cy - ddz * sy) * sc, h + (ddx * sy + ddz * cy) * sc]; };
    for (const e of this.ents.values()) { if (e.dead) continue; const [a, b] = tr(e.x, e.z); if (Math.hypot(a - h, b - h) < h) { x.fillStyle = '#e03030'; x.beginPath(); x.arc(a, b, 2.6, 0, 2 * PI); x.fill(); } }
    if (this.boss) { const [a, b] = tr(this.boss.x, this.boss.z); x.fillStyle = '#ffd040'; x.beginPath(); x.arc(a, b, 6, 0, 2 * PI); x.fill(); }
    { const [a, b] = tr(this.gx, this.gz); x.fillStyle = '#6ad0ff'; x.fillRect(a - 2, b - 2, 4, 4); }
    x.translate(h, h); x.rotate(this.yaw + PI - this.cfa); x.fillStyle = '#ffd86a'; x.beginPath(); x.moveTo(0, -6); x.lineTo(4.5, 5); x.lineTo(0, 2.5); x.lineTo(-4.5, 5); x.closePath(); x.fill();
    x.restore(); x.strokeStyle = 'rgba(200,170,120,0.8)'; x.lineWidth = 2; x.beginPath(); x.arc(h, h, h - 1, 0, 2 * PI); x.stroke();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku); window.removeEventListener('blur', this.bl); window.removeEventListener('mouseup', this.mu); document.removeEventListener('mousemove', this.mm); window.removeEventListener('resize', this.resize);
    if (document.pointerLockElement) document.exitPointerLock();
    this.ents.forEach((e) => disposeRig(e.rig)); if (this.boss) disposeRig(this.boss.rig); disposeRig(this.guts); disposeRig(this.caska); disposeRig(this.ivalera);
    this.projGeo.dispose(); (this.projMat as THREE.Material).dispose(); this.world.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); A.stopMusic();
  }
}
import { BOSSES } from '../data';
const buildScale = (type: number) => BOSSES[BTYPES[type]]?.scale ?? 1;
export type { ClientHud };
