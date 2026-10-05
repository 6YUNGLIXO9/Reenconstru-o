// Geração procedural de cenários (com semente), colisores, céu, luz, partículas ambientais.
import * as THREE from 'three';
import { gBox, gCyl, gSph, gCone, gTor, mat, mk } from './models';

export const R = 70;
export interface Col { x: number; z: number; r?: number; hx?: number; hz?: number; ry?: number; h: number }

export function resolve(cols: Col[], p: { x: number; z: number }, rad: number, minH = 0, clampArena = true) {
  for (const c of cols) {
    if (c.h < minH) continue;
    if (c.r != null) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad;
      if (d < m) { const k = d > 1e-4 ? m / d : 0; if (k) { p.x = c.x + dx * k; p.z = c.z + dz * k; } else p.x += m; }
    } else {
      const th = c.ry || 0, cs = Math.cos(th), sn = Math.sin(th), wx = p.x - c.x, wz = p.z - c.z;
      const lx = wx * cs - wz * sn, lz = wx * sn + wz * cs;
      const cx = Math.max(-c.hx!, Math.min(c.hx!, lx)), cz = Math.max(-c.hz!, Math.min(c.hz!, lz));
      let dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz), nx: number, nz: number;
      if (d < rad) {
        if (d < 1e-4) { const ox = c.hx! - Math.abs(lx), oz = c.hz! - Math.abs(lz); if (ox < oz) { nx = Math.sign(lx) || 1; nz = 0; d = -ox; } else { nx = 0; nz = Math.sign(lz) || 1; d = -oz; } }
        else { nx = dx / d; nz = dz / d; }
        const push = rad - d, px = lx + nx * push, pz = lz + nz * push;
        p.x = c.x + px * cs + pz * sn; p.z = c.z - px * sn + pz * cs;
      }
    }
  }
  if (!clampArena) return;
  const d = Math.hypot(p.x, p.z); if (d > R - 2) { p.x *= (R - 2) / d; p.z *= (R - 2) / d; }
}
export function blocked(cols: Col[], x: number, z: number, rad: number, minH = 0) {
  const p = { x, z }; resolve(cols, p, rad, minH, false); return Math.abs(p.x - x) > 1e-3 || Math.abs(p.z - z) > 1e-3;
}

function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Theme {
  top: number; hor: number; fog: number; fogD: number; g1: number; g2: number; gk: string; sun: number; sunI: number; amb: number; ambI: number;
  tree: number; dead: number; rock: number; tent: number; banner: number; wall: number; pillar: number; house: number; spike: number; bone: number; fire: number; tower: number; float: number; face: number; hand: number; abyss: number; scar: number;
  part: number; pk: string; disc?: number; ring?: number; leaf: number; stone: number;
}
const T = (o: Partial<Theme>): Theme => ({ top: 0, hor: 0, fog: 0, fogD: 0.015, g1: 0, g2: 0, gk: 'dirt', sun: 0xffffff, sunI: 1, amb: 0x888888, ambI: 0.5, tree: 0, dead: 0, rock: 0, tent: 0, banner: 0, wall: 0, pillar: 0, house: 0, spike: 0, bone: 0, fire: 0, tower: 0, float: 0, face: 0, hand: 0, abyss: 0, scar: 0, part: 0, pk: 'ash', leaf: 0x2a5a2a, stone: 0x77746c, ...o });
export const THEMES: Record<string, Theme> = {
  camp: T({ top: 0x3f7fd0, hor: 0xe8d8a8, fog: 0xc8d4c0, fogD: 0.011, g1: 0x4a6a32, g2: 0x3a5a28, gk: 'grass', sun: 0xfff0c8, sunI: 2.0, amb: 0xa0b8e0, ambI: 0.9, tree: 70, rock: 26, tent: 9, banner: 14, fire: 3, part: 120, pk: 'pollen', disc: 0xfff6d0, leaf: 0x3a6a2a }),
  fort: T({ top: 0x56667a, hor: 0x9aa5ad, fog: 0x8a949c, fogD: 0.016, g1: 0x6a6a62, g2: 0x555550, gk: 'dirt', sun: 0xdde4ee, sunI: 1.3, amb: 0x8090a0, ambI: 0.8, tree: 16, dead: 8, rock: 20, wall: 18, pillar: 14, house: 9, banner: 10, fire: 2, part: 100, pk: 'ash', leaf: 0x3a4a30 }),
  hall: T({ top: 0xc08a40, hor: 0xf4d898, fog: 0xc8a870, fogD: 0.012, g1: 0xa89c88, g2: 0x8c8270, gk: 'stone', sun: 0xffd890, sunI: 1.9, amb: 0xe0b878, ambI: 0.9, rock: 10, wall: 10, pillar: 26, tower: 4, banner: 14, fire: 4, part: 110, pk: 'dust', disc: 0xffe8a0 }),
  siege: T({ top: 0x2a1210, hor: 0xc04a20, fog: 0x4a2418, fogD: 0.02, g1: 0x4a3626, g2: 0x3a2a1e, gk: 'dirt', sun: 0xff7a40, sunI: 1.4, amb: 0x804030, ambI: 0.7, rock: 25, dead: 25, wall: 14, banner: 12, fire: 8, part: 220, pk: 'ember', disc: 0xff6a30 }),
  forest: T({ top: 0x1a2e22, hor: 0x4a6a48, fog: 0x2a4030, fogD: 0.028, g1: 0x1e3018, g2: 0x16240f, gk: 'grass', sun: 0xb0d8b0, sunI: 1.0, amb: 0x607860, ambI: 0.7, tree: 110, dead: 15, rock: 20, fire: 2, part: 130, pk: 'firefly', leaf: 0x1c3a20 }),
  eclipse: T({ top: 0x050205, hor: 0x701010, fog: 0x200808, fogD: 0.022, g1: 0x2e2422, g2: 0x1c1614, gk: 'stone', sun: 0xff3a20, sunI: 0.9, amb: 0x602020, ambI: 0.7, bone: 30, spike: 30, fire: 8, rock: 14, face: 14, hand: 1, scar: 14, part: 220, pk: 'ashred', disc: 0x000000, ring: 0xff4a20 }),
  valley: T({ top: 0x2a1048, hor: 0x7a3a9a, fog: 0x2a1840, fogD: 0.02, g1: 0x2a1a38, g2: 0x1e1228, gk: 'stone', sun: 0xb080ff, sunI: 1.0, amb: 0x6040a0, ambI: 0.8, spike: 40, bone: 20, rock: 20, dead: 18, scar: 6, part: 150, pk: 'glow', disc: 0xd0a0ff }),
  flesh: T({ top: 0x3a0a0a, hor: 0xb02a20, fog: 0x401010, fogD: 0.022, g1: 0x6a2018, g2: 0x4a1410, gk: 'flesh', sun: 0xff5030, sunI: 1.1, amb: 0x802020, ambI: 0.8, bone: 25, spike: 35, rock: 14, fire: 4, abyss: 5, scar: 10, part: 220, pk: 'ember' }),
  altar: T({ top: 0x080308, hor: 0x501018, fog: 0x180810, fogD: 0.016, g1: 0x261e26, g2: 0x1a141a, gk: 'stone', sun: 0xff3040, sunI: 0.9, amb: 0x601828, ambI: 0.8, pillar: 14, spike: 20, bone: 15, fire: 10, scar: 8, part: 200, pk: 'ashred', disc: 0x000000, ring: 0xff2a30 }),
  falconia: T({ top: 0xdce8ff, hor: 0xfff4d0, fog: 0xf0e8d4, fogD: 0.008, g1: 0xd8d0c0, g2: 0xc0b8a6, gk: 'stone', sun: 0xffe8a8, sunI: 2.0, amb: 0xfff0d0, ambI: 1.1, pillar: 26, banner: 14, rock: 12, spike: 8, float: 14, part: 160, pk: 'glow', disc: 0xffffff, stone: 0xe0d8c8 }),
};
const ECL = THEMES.eclipse;

function groundTex(kind: string, c1: number, c2: number, size: number) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d')!;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  x.fillStyle = hex(c1); x.fillRect(0, 0, size, size);
  let seed = 7; const rd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  x.strokeStyle = hex(c2); x.fillStyle = hex(c2);
  const n = size * size / 40;
  if (kind === 'grass') { for (let i = 0; i < n; i++) { const px = rd() * size, py = rd() * size; x.globalAlpha = 0.5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rd() * 4 - 2, py - 4 - rd() * 5); x.stroke(); } }
  else if (kind === 'stone') { x.globalAlpha = 0.5; x.lineWidth = 1; const s = size / 4; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, size); x.moveTo(0, i * s); x.lineTo(size, i * s); x.stroke(); } for (let i = 0; i < n / 3; i++) { x.globalAlpha = 0.3; x.fillRect(rd() * size, rd() * size, 2, 2); } for (let i = 0; i < 8; i++) { x.beginPath(); let px = rd() * size, py = rd() * size; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += rd() * 20 - 10; py += rd() * 20 - 10; x.lineTo(px, py); } x.stroke(); } }
  else if (kind === 'flesh') { x.globalAlpha = 0.6; x.lineWidth = 2; for (let i = 0; i < 14; i++) { x.strokeStyle = i % 2 ? '#8a2a20' : '#2a0806'; x.beginPath(); let px = rd() * size, py = rd() * size; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += rd() * 40 - 20; py += rd() * 40 - 20; x.lineTo(px, py); } x.stroke(); } for (let i = 0; i < n / 4; i++) { x.globalAlpha = 0.25; x.fillRect(rd() * size, rd() * size, 3, 3); } }
  else { for (let i = 0; i < n; i++) { x.globalAlpha = 0.35; x.fillRect(rd() * size, rd() * size, 1 + rd() * 2, 1 + rd() * 2); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 36); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function faceTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 62); g.addColorStop(0, '#e8d8c8'); g.addColorStop(0.7, '#a89888'); g.addColorStop(1, 'rgba(60,40,40,0)');
  x.fillStyle = g; x.beginPath(); x.ellipse(64, 66, 44, 58, 0, 0, 7); x.fill();
  x.fillStyle = '#100808'; x.beginPath(); x.ellipse(46, 54, 11, 16, 0.2, 0, 7); x.ellipse(82, 54, 11, 16, -0.2, 0, 7); x.fill();
  x.beginPath(); x.ellipse(64, 96, 12, 20, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(64, 62); x.lineTo(58, 78); x.lineTo(70, 78); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export interface Fire { x: number; z: number; flames: THREE.Mesh[]; light?: THREE.PointLight; usable: boolean; used: boolean }
export interface World {
  group: THREE.Group; cols: Col[]; theme: Theme; sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; sky: THREE.Mesh; skyMat: THREE.ShaderMaterial;
  fog: THREE.FogExp2; spawnSpots: { x: number; z: number }[]; fires: Fire[]; relicSpots: { x: number; z: number }[]; behelitSpots: { x: number; z: number }[]; watchSpots: { x: number; z: number }[];
  update(t: number, dt: number, px: number, pz: number, fx: number): void; setTex(q: number): void; eclipse(k: number): void; dispose(): void; ground: THREE.Mesh; baseSunI: number; baseAmbI: number; baseFog: number;
}

export function buildWorld(themeId: string, level: number, texQ: number): World {
  const th = THEMES[themeId] || THEMES.camp, rd = rng(level * 7919 + 13);
  const group = new THREE.Group(), cols: Col[] = [], disposables: THREE.BufferGeometry[] = [], texs: THREE.Texture[] = [];
  const rr = (a: number, b: number) => a + rd() * (b - a);
  const free = (x: number, z: number, r: number) => Math.hypot(x, z) > 9 && Math.hypot(x, z) < R - 4 && !blocked(cols, x, z, r);
  const spot = (r: number, a = 10, b = R - 6) => { for (let i = 0; i < 40; i++) { const an = rd() * Math.PI * 2, d = rr(a, b); const x = Math.cos(an) * d, z = Math.sin(an) * d; if (free(x, z, r)) return { x, z }; } return null; };

  // céu
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(th.top) }, hor: { value: new THREE.Color(th.hor) }, bot: { value: new THREE.Color(th.fog) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.0 ? mix(hor, top, pow(h,0.55)) : mix(hor, bot, min(1.0,-h*4.0)); gl_FragColor=vec4(c,1.0);} ',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 16), skyMat); sky.renderOrder = -10; sky.scale.setScalar(0.2); sky.frustumCulled = false; group.add(sky);
  if (th.disc != null) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(th.ring ? 46 : 36, 32), new THREE.MeshBasicMaterial({ color: th.disc, fog: false, depthWrite: false })); d.renderOrder = -9; d.position.set(-180, 150, -380); d.lookAt(0, 0, 0); sky.add(d);
    if (th.ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(46, 70, 40), new THREE.MeshBasicMaterial({ color: th.ring, fog: false, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); rg.position.copy(d.position).multiplyScalar(0.999); rg.lookAt(0, 0, 0); sky.add(rg); }
  }
  // luz
  const fog = new THREE.FogExp2(th.fog, th.fogD);
  const hemi = new THREE.HemisphereLight(th.amb, th.g2, th.ambI); group.add(hemi);
  const sun = new THREE.DirectionalLight(th.sun, th.sunI); sun.position.set(-30, 50, -20); sun.castShadow = true;
  sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34; sun.shadow.camera.far = 140; sun.shadow.bias = -0.0006; sun.shadow.camera.updateProjectionMatrix();
  group.add(sun, sun.target);
  // luz de recorte (rim) dramática que destaca os personagens do cenário
  const darkTheme = ['eclipse', 'valley', 'flesh', 'altar'].includes(themeId);
  const rimCol = new THREE.Color(th.sun).lerp(new THREE.Color(darkTheme ? 0xff2a18 : 0xff6a3a), darkTheme ? 0.7 : 0.3);
  const rim = new THREE.DirectionalLight(rimCol, darkTheme ? 1.1 : 0.7); rim.position.set(26, 16, 34); group.add(rim, rim.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(th.amb), 0.3); fill.position.set(10, 8, -30); group.add(fill);
  // chão
  const gm = new THREE.MeshStandardMaterial({ map: groundTex(th.gk, th.g1, th.g2, [128, 256, 512][texQ]), roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 60, 64), gm); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  texs.push(gm.map!);
  const edge = new THREE.Mesh(new THREE.RingGeometry(R + 58, R + 400, 48), new THREE.MeshBasicMaterial({ color: th.fog })); edge.rotation.x = -Math.PI / 2; edge.position.y = -0.3; group.add(edge);

  // instanciamento
  type Part = { g: THREE.BufferGeometry; m: THREE.Material; p: number[]; r?: number[]; s?: number[] };
  const dm = new THREE.Matrix4(), pm = new THREE.Matrix4(), lm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const instance = (parts: Part[], pl: { x: number; z: number; s: number; ry: number; sy?: number }[]) => {
    if (!pl.length) return;
    parts.forEach((pt) => {
      const im = new THREE.InstancedMesh(pt.g, pt.m, pl.length); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      pl.forEach((a, i) => {
        pm.compose(v.set(a.x, 0, a.z), q.setFromEuler(e.set(0, a.ry, 0)), sc.set(a.s, a.s * (a.sy ?? 1), a.s));
        lm.compose(v.set(pt.p[0], pt.p[1], pt.p[2]), q.setFromEuler(e.set(pt.r?.[0] || 0, pt.r?.[1] || 0, pt.r?.[2] || 0)), sc.set(pt.s?.[0] ?? 1, pt.s?.[1] ?? 1, pt.s?.[2] ?? 1));
        dm.multiplyMatrices(pm, lm); im.setMatrixAt(i, dm);
      });
      group.add(im);
    });
  };
  const scatter = (n: number, rad: number, a = 8, b = R - 4) => { const o: { x: number; z: number; s: number; ry: number; sy?: number }[] = []; for (let i = 0; i < n; i++) { const p = spot(rad * 1.0, a, b); if (!p) continue; const s = rr(0.8, 1.4); o.push({ x: p.x, z: p.z, s, ry: rd() * 6.28, sy: rr(0.8, 1.2) }); } return o; };

  // árvores
  if (th.tree) {
    const pl = scatter(th.tree, 0.6, 6, R - 2); pl.forEach((p) => cols.push({ x: p.x, z: p.z, r: 0.5 * p.s, h: 6 }));
    instance([
      { g: gCyl(0.22, 0.34, 3, 7), m: mat(0x4a3220), p: [0, 1.5, 0] },
      { g: gCone(1.9, 3.6, 7), m: mat(th.leaf, { r: 1 }), p: [0, 4.2, 0] },
      { g: gCone(1.35, 3, 7), m: mat(th.leaf, { r: 1 }), p: [0, 6.0, 0] },
    ], pl);
  }
  const deadMat = mat(0x3a3029, { r: 1 });
  if (th.dead) {
    const pl = scatter(th.dead, 0.5); pl.forEach((p) => cols.push({ x: p.x, z: p.z, r: 0.4 * p.s, h: 5 }));
    instance([
      { g: gCyl(0.12, 0.3, 4.4, 6), m: deadMat, p: [0, 2.2, 0] },
      { g: gCyl(0.04, 0.1, 2.2, 5), m: deadMat, p: [0.8, 3.3, 0], r: [0, 0, -0.9] },
      { g: gCyl(0.04, 0.09, 1.8, 5), m: deadMat, p: [-0.6, 2.6, 0.3], r: [0.2, 0, 1.0] },
    ], pl);
  }
  if (th.rock) {
    const pl = scatter(th.rock, 1.2); pl.forEach((p) => { p.s *= 1.5; cols.push({ x: p.x, z: p.z, r: 1.1 * p.s, h: 2 }); });
    instance([{ g: new THREE.DodecahedronGeometry(1, 0), m: mat(th.stone, { r: 1 }), p: [0, 0.45, 0], s: [1, 0.75, 1] }], pl);
  }
  if (th.spike) {
    const pl = scatter(th.spike, 0.6); pl.forEach((p) => { p.s *= 1.3; cols.push({ x: p.x, z: p.z, r: 0.6 * p.s, h: 5 }); });
    instance([{ g: gCone(0.6, 5, 5), m: mat(0x2a2224, { r: 0.7, m: 0.2 }), p: [0, 2.4, 0], r: [0.1, 0, 0.1] }, { g: gCone(0.35, 3, 5), m: mat(0x3a2e30, { r: 0.7 }), p: [0.8, 1.4, 0.3], r: [0, 0, -0.4] }], pl);
  }
  if (th.bone) {
    const pl = scatter(th.bone, 1.5); pl.forEach((p) => { p.s *= 1.2; cols.push({ x: p.x, z: p.z, r: 0.4, h: 3 }); });
    const bm = mat(0xd8d0b8, { r: 0.7 });
    instance([{ g: new THREE.TorusGeometry(2, 0.16, 6, 14, Math.PI), m: bm, p: [0, 0, 0] }, { g: new THREE.TorusGeometry(1.6, 0.14, 6, 14, Math.PI), m: bm, p: [0, 0, 0.7] }, { g: gCyl(0.18, 0.12, 3.2, 6), m: bm, p: [1.8, 0.2, -0.3], r: [0, 0, 1.4] }, { g: gSph(0.5, 8), m: bm, p: [-1.5, 0.3, 0.5] }], pl);
  }
  // fogueiras
  const fires: Fire[] = [];
  const addFire = (x: number, z: number, usable: boolean, light: boolean) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
    for (let i = 0; i < 4; i++) mk(gCyl(0.08, 0.08, 1.1, 5), wood(), 0, 0.12, 0, g, 1.3, i * 0.8, 0);
    const fl: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) { const f = mk(gCone(0.35 - i * 0.07, 1.1 - i * 0.2, 6), mat(i ? 0xffc040 : 0xff6a10, { e: 2.5, t: 0.9 }), 0, 0.5, 0, g); f.castShadow = false; fl.push(f); }
    const ring = mk(gTor(0.7, 0.1), mat(0x4a4a48, { r: 1 }), 0, 0.1, 0, g, Math.PI / 2); ring.castShadow = false;
    let pl: THREE.PointLight | undefined; if (light) { pl = new THREE.PointLight(0xff8a30, 18, 20, 1.6); pl.position.set(0, 1.4, 0); g.add(pl); }
    cols.push({ x, z, r: 0.8, h: 1 });
    fires.push({ x, z, flames: fl, light: pl, usable, used: false });
  };
  const wood = () => mat(0x4a3220);
  const spawnSpots: { x: number; z: number }[] = [];
  // acampamentos / clareiras
  const nCamps = 6;
  for (let i = 0; i < nCamps; i++) {
    const a = (i / nCamps) * Math.PI * 2 + rr(-0.3, 0.3), d = rr(26, 54), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (blocked(cols, x, z, 3)) { const p = spot(3, 22, 56); if (p) spawnSpots.push(p); continue; }
    spawnSpots.push({ x, z });
  }
  if (th.fire) {
    let li = 0;
    for (let i = 0; i < th.fire; i++) {
      const base = spawnSpots[i % spawnSpots.length]; const ox = i < spawnSpots.length ? 0 : rr(-8, 8), oz = i < spawnSpots.length ? 0 : rr(-8, 8);
      const x = base.x + ox, z = base.z + oz;
      if (!blocked(cols, x, z, 1)) { addFire(x, z, i < 3, li < 3); if (li < 3) li++; }
    }
  }
  // tendas
  if (th.tent) {
    const cl = [0x8a2a2a, 0xc8b890, 0x2a4a7a, 0x6a5a3a];
    for (let i = 0; i < th.tent; i++) {
      const base = spawnSpots[i % spawnSpots.length]; const a = rd() * 6.28, d = rr(4, 8); const x = base.x + Math.cos(a) * d, z = base.z + Math.sin(a) * d;
      if (blocked(cols, x, z, 2.2)) continue;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = a; group.add(g);
      mk(gCone(2.4, 2.6, 4), mat(cl[i % 4], { r: 1 }), 0, 1.3, 0, g, 0, Math.PI / 4, 0).scale.z = 1.4; mk(gBox(0.8, 1.4, 0.05), dark(), 0, 0.7, 1.7, g);
      cols.push({ x, z, r: 2.0, h: 3 });
    }
  }
  function dark() { return mat(0x0a0806); }
  // bandeiras
  if (th.banner) {
    const cl = [0x8a2020, 0x203a7a, 0xc9a13a, 0xe8e8e8];
    for (let i = 0; i < th.banner; i++) {
      const p = spot(0.5, 8, R - 5); if (!p) continue;
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = rd() * 6.28; group.add(g);
      mk(gCyl(0.07, 0.09, 6, 6), wood(), 0, 3, 0, g); const cm = mat(cl[i % 4], { r: 1 }); (cm as any).side = THREE.DoubleSide;
      const cloth = mk(gBox(1.5, 2.2, 0.04), cm, 0.8, 4.8, 0, g); cloth.userData.sway = rd() * 6;
      group.userData.banners = (group.userData.banners || []); group.userData.banners.push(cloth);
      cols.push({ x: p.x, z: p.z, r: 0.25, h: 6 });
    }
  }
  const stone = mat(th.stone, { r: 0.95 });
  const wallAt = (x: number, z: number, len: number, ry: number, hgt: number) => {
    const m = mk(gBox(len, hgt, 0.9), stone, x, hgt / 2, z, group, 0, ry, 0); m.receiveShadow = true;
    mk(gBox(len * 0.9, 0.3, 1.1), stone, 0, hgt / 2 + 0.1, 0, m);
    cols.push({ x, z, hx: len / 2, hz: 0.5, ry, h: hgt });
  };
  const pillarAt = (x: number, z: number, hgt: number) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
    mk(gBox(1.8, 0.6, 1.8), stone, 0, 0.3, 0, g); mk(gCyl(0.7, 0.8, hgt, 10), stone, 0, hgt / 2 + 0.5, 0, g); mk(gBox(1.7, 0.5, 1.7), stone, 0, hgt + 0.7, 0, g);
    cols.push({ x, z, r: 0.95, h: hgt });
  };
  if (th.wall) {
    for (let i = 0; i < th.wall; i++) {
      const p = spot(3, 10, R - 8); if (!p) continue; const ry = rd() < 0.5 ? 0 : Math.PI / 2 + rr(-0.15, 0.15), len = rr(5, 10);
      if (blocked(cols, p.x, p.z, len / 2)) continue; wallAt(p.x, p.z, len, ry, rr(1.6, 3.4));
    }
  }
  if (th.house) {
    for (let i = 0; i < th.house; i++) {
      const p = spot(5, 14, R - 10); if (!p) continue; const w = rr(5, 7), d = rr(5, 7), hg = rr(2.2, 3.6);
      wallAt(p.x, p.z - d / 2, w, 0, hg); wallAt(p.x - w / 2, p.z, d, Math.PI / 2, hg * 0.7); if (rd() < 0.6) wallAt(p.x + w / 2, p.z, d * 0.5, Math.PI / 2, hg * 0.5);
      wallAt(p.x - w * 0.3, p.z + d / 2, w * 0.4, 0, hg * 0.6);
      mk(gBox(0.3, 0.3, w), wood(), p.x, 2.2, p.z, group, 0, 0.2, 0.3);
    }
  }
  if (th.pillar) {
    const hg = themeId === 'hall' || themeId === 'falconia' ? 8 : 6;
    if (themeId === 'altar' || themeId === 'falconia') for (let i = 0; i < th.pillar; i++) { const a = (i / th.pillar) * Math.PI * 2, d = i % 2 ? 46 : 60; pillarAt(Math.cos(a) * d, Math.sin(a) * d, rr(hg * 0.7, hg * 1.4)); }
    else for (let i = 0; i < th.pillar; i++) { const p = spot(1, 10, R - 5); if (p) pillarAt(p.x, p.z, rr(hg * 0.5, hg * 1.3)); }
  }
  if (themeId === 'hall') { // pátio com muralha circular e portões
    const RR = 34, n = 18;
    for (let i = 0; i < n; i++) { if (i % 3 === 0) continue; const a = (i / n) * Math.PI * 2; const len = (2 * Math.PI * RR / n) * 1.02; wallAt(Math.cos(a) * RR, Math.sin(a) * RR, len, -a + Math.PI / 2, 4.2); }
  }
  if (themeId === 'fort' || themeId === 'siege') { // ruas entre muros
    for (let i = 0; i < 6; i++) { const z = -36 + i * 14 + rr(-3, 3); if (i % 2) wallAt(rr(-20, 20), z, rr(12, 20), 0, rr(1.8, 3.2)); }
  }
  if (th.tower) {
    for (let i = 0; i < th.tower; i++) {
      const a = (i / th.tower) * Math.PI * 2 + 0.4, x = Math.cos(a) * 46, z = Math.sin(a) * 46; const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
      mk(gCyl(3.2, 3.6, 12, 14), stone, 0, 6, 0, g); mk(gCyl(3.8, 3.4, 1.2, 14), stone, 0, 12.4, 0, g);
      for (let k = 0; k < 8; k++) { const aa = k / 8 * 6.28; mk(gBox(1.2, 1, 1), stone, Math.cos(aa) * 3.3, 13.5, Math.sin(aa) * 3.3, g, 0, -aa, 0); }
      mk(gCone(3.4, 4.5, 14), mat(0x6a2a20, { r: 0.8 }), 0, 15.5, 0, g).visible = rd() < 0.5;
      cols.push({ x, z, r: 3.5, h: 14 });
    }
  }
  // elementos sobrenaturais
  const faces: THREE.Mesh[] = [];
  if (th.face) {
    const ft = faceTex(); texs.push(ft); const fm = new THREE.MeshBasicMaterial({ map: ft, transparent: true, opacity: 0.6, depthWrite: false, color: 0xcc9a90 });
    for (let i = 0; i < th.face; i++) { const p = spot(1, 6, R - 4); if (!p) continue; const s = rr(4, 8); const f = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 1.2), fm); f.rotation.set(-Math.PI / 2, 0, rd() * 6.28); f.position.set(p.x, 0.04, p.z); group.add(f); }
    const sm = new THREE.MeshBasicMaterial({ map: ft, transparent: true, opacity: 0.4, depthWrite: false, color: 0xff6a5a, fog: false });
    for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(90, 110), sm); const a = rd() * 6.28, el = rr(0.25, 0.9); f.position.set(Math.cos(a) * 360, 60 + el * 220, Math.sin(a) * 360); f.lookAt(0, 0, 0); sky.add(f); faces.push(f); }
  }
  if (th.scar) {
    const sm = mat(0xff2a10, { e: 1.6, t: 0.65 });
    for (let i = 0; i < th.scar; i++) { const p = spot(0.1, 6, R - 4); if (!p) continue; const m = new THREE.Mesh(gBox(rr(0.2, 0.5), 0.03, rr(10, 26)), sm); m.position.set(p.x, 0.04, p.z); m.rotation.y = rd() * 6.28; group.add(m); }
  }
  if (th.hand) {
    const a = rd() * 6.28, hx = Math.cos(a) * 56, hz = Math.sin(a) * 56; const g = new THREE.Group(); g.position.set(hx, 0, hz); group.add(g);
    const hm = mat(0x8a6a58, { r: 0.9 });
    mk(gBox(10, 11, 2.4), hm, 0, 5.5, 0, g);
    for (let i = 0; i < 4; i++) mk(gBox(1.9, 9 - Math.abs(i - 1.5) * 1.2, 1.9), hm, -3.8 + i * 2.5, 15, 0, g, 0, 0, (i - 1.5) * 0.08);
    mk(gBox(2.2, 7, 2), hm, 6.4, 8, 0, g, 0, 0, -0.9);
    mk(gSph(2.6, 14), mat(0xe8dcc8, { r: 0.4 }), 0, 6, 1.1, g).scale.set(1, 0.8, 0.4);
    mk(gSph(1.3, 12), mat(0xcc1a10, { e: 1.5 }), 0, 6, 1.9, g).scale.z = 0.4; mk(gSph(0.6, 10), mat(0x000000), 0, 6, 2.3, g).scale.z = 0.3;
    g.lookAt(0, 0, 0); g.scale.setScalar(1.5); cols.push({ x: hx, z: hz, r: 7, h: 20 });
  }
  if (th.abyss) {
    for (let i = 0; i < th.abyss; i++) {
      const p = spot(5, 14, R - 12); if (!p) continue; const r = rr(4, 7);
      const d = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })); d.rotation.x = -Math.PI / 2; d.position.set(p.x, 0.05, p.z); group.add(d);
      const rg = new THREE.Mesh(new THREE.RingGeometry(r, r + 1.3, 24), new THREE.MeshBasicMaterial({ color: 0xc02a14, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); rg.rotation.x = -Math.PI / 2; rg.position.set(p.x, 0.06, p.z); group.add(rg);
      cols.push({ x: p.x, z: p.z, r: r - 0.4, h: 1 });
    }
  }
  const floats: THREE.Group[] = [];
  if (th.float) {
    for (let i = 0; i < th.float; i++) {
      const a = rd() * 6.28, d = rr(25, 85); const g = new THREE.Group(); g.position.set(Math.cos(a) * d, rr(14, 34), Math.sin(a) * d); g.userData.base = g.position.y; group.add(g);
      mk(gCone(rr(3, 6), rr(4, 8), 6), stone, 0, -3, 0, g, Math.PI); mk(gBox(rr(6, 11), 1.2, rr(6, 11)), stone, 0, 0, 0, g);
      if (rd() < 0.7) mk(gCyl(0.6, 0.7, 5, 8), stone, 1, 3.4, 1, g); floats.push(g);
    }
  }
  const watchSpots: { x: number; z: number }[] = [];
  if (themeId === 'eclipse' || themeId === 'altar') for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; watchSpots.push({ x: Math.cos(a) * 66, z: Math.sin(a) * 66 }); }
  const relicSpots: { x: number; z: number }[] = [];
  for (let i = 0; i < 3; i++) { const p = spot(1, 40, R - 5); if (p) relicSpots.push(p); }
  const behelitSpots: { x: number; z: number }[] = [];
  for (let i = 0; i < 3; i++) { const p = spot(2, 28, 60); if (p) behelitSpots.push(p); }
  if (!spawnSpots.length) spawnSpots.push({ x: 30, z: 0 });

  // partículas ambientais
  const N = Math.max(60, th.part * 2);
  const pg = new THREE.BufferGeometry(); const pp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pp[i * 3] = rr(-45, 45); pp[i * 3 + 1] = rr(0, 22); pp[i * 3 + 2] = rr(-45, 45); }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pcol = { pollen: 0xfff2b0, ash: 0xaaaaaa, dust: 0xffe0a0, ember: 0xff7a20, firefly: 0xc8ff70, ashred: 0xff6a50, glow: th.pk === 'glow' && themeId === 'falconia' ? 0xfff0b0 : 0xc090ff }[th.pk] as number;
  const additive = th.pk !== 'ash';
  const pmat = new THREE.PointsMaterial({ color: pcol, size: th.pk === 'ember' ? 0.22 : 0.18, transparent: true, opacity: 0.85, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
  const pts = new THREE.Points(pg, pmat); pts.frustumCulled = false; group.add(pts);
  const bannerList: THREE.Mesh[] = group.userData.banners || [];

  const base = { top: new THREE.Color(th.top), hor: new THREE.Color(th.hor), fog: new THREE.Color(th.fog), sun: new THREE.Color(th.sun), amb: new THREE.Color(th.amb) };
  const tmp = new THREE.Color();
  const w: World = {
    group, cols, theme: th, sun, hemi, sky, skyMat, fog, spawnSpots, fires, relicSpots, behelitSpots, watchSpots, ground, baseSunI: th.sunI, baseAmbI: th.ambI, baseFog: th.fogD,
    update(t, dt, px, pz, fx) {
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        let vx = 0, vy = 0, vz = 0;
        switch (th.pk) {
          case 'ember': case 'ashred': vy = th.pk === 'ember' ? 1.2 + (i % 5) * 0.3 : -0.8; vx = Math.sin(t + i) * 0.8; break;
          case 'ash': vy = -0.7; vx = 0.6; break;
          case 'firefly': vx = Math.sin(t * 0.7 + i) * 1.2; vy = Math.cos(t * 0.9 + i * 2) * 0.6; vz = Math.cos(t * 0.5 + i) * 1.2; break;
          case 'glow': vy = 0.4; vx = Math.sin(t * 0.5 + i) * 0.5; break;
          default: vx = 0.8 + Math.sin(t + i) * 0.5; vy = Math.sin(t * 0.7 + i) * 0.3; vz = Math.cos(t * 0.6 + i) * 0.4;
        }
        pp[k] += vx * dt; pp[k + 1] += vy * dt; pp[k + 2] += vz * dt;
        if (pp[k + 1] > 24) pp[k + 1] = 0; if (pp[k + 1] < 0) pp[k + 1] = 22;
        if (pp[k] - px > 45) pp[k] -= 90; else if (pp[k] - px < -45) pp[k] += 90;
        if (pp[k + 2] - pz > 45) pp[k + 2] -= 90; else if (pp[k + 2] - pz < -45) pp[k + 2] += 90;
      }
      pg.attributes.position.needsUpdate = true; pg.setDrawRange(0, Math.min(N, Math.floor(th.part * fx)));
      pmat.opacity = th.pk === 'firefly' ? 0.5 + Math.sin(t * 3) * 0.4 : 0.85;
      fires.forEach((f, i) => { f.flames.forEach((m, j) => { m.scale.set(1 + Math.sin(t * 12 + i + j) * 0.12, 1 + Math.sin(t * 9 + j * 2 + i) * 0.25, 1); }); if (f.light) f.light.intensity = 16 + Math.sin(t * 14 + i * 3) * 4 + Math.random() * 2; });
      bannerList.forEach((b) => { b.rotation.y = Math.sin(t * 2 + b.userData.sway) * 0.25; });
      floats.forEach((f, i) => { f.position.y = f.userData.base + Math.sin(t * 0.4 + i) * 1.2; f.rotation.y += dt * 0.03; });
      faces.forEach((f, i) => { (f.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 0.6 + i) * 0.1; });
      sky.position.set(px, 0, pz);
    },
    setTex(qv) { gm.map?.dispose(); gm.map = groundTex(th.gk, th.g1, th.g2, [128, 256, 512][qv]); gm.needsUpdate = true; texs[0] = gm.map; },
    eclipse(k) {
      skyMat.uniforms.top.value.lerpColors(base.top, tmp.set(0x050105), k); skyMat.uniforms.hor.value.lerpColors(base.hor, tmp.set(ECL.hor), k);
      fog.color.lerpColors(base.fog, tmp.set(0x200606), k); skyMat.uniforms.bot.value.copy(fog.color);
      sun.color.lerpColors(base.sun, tmp.set(0xff3010), k); hemi.color.lerpColors(base.amb, tmp.set(0x601818), k);
      w.baseSunI = lerp(th.sunI, 0.8, k); w.baseAmbI = lerp(th.ambI, 0.6, k);
    },
    dispose() {
      group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh || (m as any).isPoints) { const mt = m.material as any; if (mt && !Array.isArray(mt) && mt.map === undefined) { /* shared */ } } });
      texs.forEach((t) => t.dispose()); void disposables;
      gm.dispose(); skyMat.dispose(); pg.dispose(); pmat.dispose();
    },
  };
  return w;
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function makeBehelit(): THREE.Group {
  const g = new THREE.Group();
  const body = mk(gSph(0.8, 16), mat(0x3a0a12, { r: 0.3, m: 0.4, e: 0.4, ec: 0x701018 }), 0, 1.4, 0, g); body.scale.set(0.7, 1.15, 0.6);
  mk(gSph(0.12, 8), mat(0xffe0d0, { e: 1.5 }), 0, 1.7, 0.45, g); mk(gBox(0.4, 0.05, 0.05), mat(0x000000), 0, 1.1, 0.46, g);
  mk(gSph(0.18, 8), mat(0xff2a20, { e: 2 }), 0, 1.4, 0.52, g).scale.set(1.3, 0.6, 0.4);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; mk(gCone(0.14, 1.1, 5), mat(0xb02020, { e: 1.2, t: 0.85 }), Math.cos(a) * 1.0, 0.7, Math.sin(a) * 1.0, g, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
  mk(gBox(1.8, 0.3, 1.8), mat(0x2a2224, { r: 0.8 }), 0, 0.15, 0, g);
  const l = new THREE.PointLight(0xff2a20, 14, 18, 1.5); l.position.y = 1.5; g.add(l); g.userData.light = l; g.userData.body = body;
  return g;
}
export function makeRelic(): THREE.Group {
  const g = new THREE.Group();
  mk(new THREE.OctahedronGeometry(0.4), mat(0xffd860, { e: 2.5, r: 0.2 }), 0, 1.0, 0, g); mk(gCyl(0.5, 0.5, 0.1, 10), mat(0x4a4038, { r: 0.9 }), 0, 0.05, 0, g);
  return g;
}
