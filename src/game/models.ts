// Modelos 3D construídos por código + rig humanoide + animações.
import * as THREE from 'three';
type G = THREE.Group;
const Group = THREE.Group;
const gm = new Map<string, THREE.BufferGeometry>();
const g_ = (k: string, f: () => THREE.BufferGeometry) => { let g = gm.get(k); if (!g) { g = f(); gm.set(k, g); } return g; };
export const gBox = (w: number, h: number, d: number) => g_(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
export const gCyl = (a: number, b: number, h: number, s = 10) => g_(`c${a}_${b}_${h}_${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
export const gSph = (r: number, s = 12) => g_(`s${r}_${s}`, () => new THREE.SphereGeometry(r, s, Math.max(6, s - 4)));
export const gCone = (r: number, h: number, s = 8) => g_(`n${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));
export const gTor = (r: number, t: number) => g_(`t${r}_${t}`, () => new THREE.TorusGeometry(r, t, 8, 24));
const mm = new Map<string, THREE.MeshStandardMaterial>();
export function mat(c: number, o: { r?: number; m?: number; e?: number; ec?: number; t?: number } = {}) {
  const k = `${c}_${o.r}_${o.m}_${o.e}_${o.ec}_${o.t}`;
  let m = mm.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.8, metalness: o.m ?? 0, emissive: o.ec ?? (o.e ? c : 0), emissiveIntensity: o.e ?? 0 });
    m.envMapIntensity = (o.m ?? 0) > 0.3 ? 0.55 : 0.25;
    if (o.t != null) { m.transparent = true; m.opacity = o.t; m.depthWrite = false; if (o.e) m.blending = THREE.AdditiveBlending; }
    mm.set(k, m);
  }
  return m;
}
export function mk(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, p?: THREE.Object3D, rx = 0, ry = 0, rz = 0) {
  const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); me.castShadow = true; if (p) p.add(me); return me;
}
const steel = () => mat(0x8a9099, { r: 0.35, m: 0.85 });
const dsteel = () => mat(0x2a2c32, { r: 0.45, m: 0.8 });
const gold = () => mat(0xc9a13a, { r: 0.3, m: 0.9 });
const wood = () => mat(0x5a3d22, { r: 0.9 });
const dark = () => mat(0x15110f, { r: 0.9 });

export interface Rig {
  root: G; body: G; hips: G; torso: G; head: G; lSh: G; lEl: G; lHand: G; rSh: G; rEl: G; rHand: G;
  lHip: G; lKn: G; rHip: G; rKn: G; wings: G[]; cape: G | null; wMount: G; sMount: G;
  x: Record<string, any>; h: number; hunch: number; flying: boolean; wingSpd: number; mats: THREE.MeshStandardMaterial[];
}
interface HO {
  skin: number; cloth: number; armor?: number; metal?: boolean; bulk?: number; height?: number; arm?: number; hunch?: number;
  head?: string; hair?: number; hairStyle?: string; eye?: number; cape?: number; ragged?: boolean; pauld?: boolean; belly?: number;
  tabard?: number; boots?: number; legs?: number; headS?: number; knee?: boolean; plume?: number;
}

export function humanoid(o: HO): Rig {
  const b = o.bulk ?? 1, h = o.height ?? 1, al = o.arm ?? 1;
  const skin = mat(o.skin, { r: 0.8 }), cloth = mat(o.cloth, { r: 0.9 });
  const armM = o.armor != null ? (o.metal === false ? mat(o.armor, { r: 0.85 }) : mat(o.armor, { r: 0.4, m: 0.75 })) : cloth;
  const legM = o.legs != null ? mat(o.legs, { r: 0.9 }) : cloth;
  const root = new Group(), body = new Group(); body.position.y = 0.9 * h; root.add(body);
  const hips = new Group(); hips.position.y = 0.05 * h; body.add(hips);
  mk(gBox(0.36 * b, 0.2 * h, 0.22 * b), cloth, 0, 0, 0, hips);
  const leg = (sx: number) => {
    const hip = new Group(); hip.position.set(sx * 0.13 * b, -0.02 * h, 0); hips.add(hip);
    mk(gBox(0.17 * b, 0.46 * h, 0.19 * b), legM, 0, -0.23 * h, 0, hip);
    const th = mk(gSph(0.11 * b), legM, 0, -0.16 * h, 0.015, hip); th.scale.set(1, 1.5, 1.05); // coxa
    const kn = new Group(); kn.position.y = -0.46 * h; hip.add(kn);
    mk(gBox(0.14 * b, 0.44 * h, 0.16 * b), legM, 0, -0.22 * h, 0, kn);
    const cf = mk(gSph(0.085 * b), legM, 0, -0.16 * h, -0.03, kn); cf.scale.set(1, 1.4, 1.1); // panturrilha
    mk(gBox(0.16 * b, 0.1 * h, 0.27 * b), mat(o.boots ?? 0x2a1d14, { r: 0.9 }), 0, -0.42 * h, 0.04, kn);
    mk(gBox(0.13 * b, 0.08 * h, 0.14 * b), mat(o.boots ?? 0x2a1d14, { r: 0.9 }), 0, -0.3 * h, -0.01, kn); // cano da bota
    if (o.knee && o.armor != null) mk(gBox(0.17 * b, 0.1, 0.09), armM, 0, 0.02, 0.1, kn);
    return [hip, kn];
  };
  const [lHip, lKn] = leg(1), [rHip, rKn] = leg(-1);
  const torso = new Group(); torso.position.y = 0.1 * h; hips.add(torso);
  const torsoM = o.armor != null ? armM : cloth;
  mk(gBox(0.46 * b, 0.52 * h, 0.26 * b), torsoM, 0, 0.28 * h, 0, torso);
  mk(gBox(0.5 * b, 0.17 * h, 0.28 * b), torsoM, 0, 0.46 * h, 0, torso); // peito/trapézio largo
  mk(gBox(0.34 * b, 0.16 * h, 0.22 * b), torsoM, 0, 0.1 * h, 0, torso); // cintura estreita (silhueta em V)
  if (o.armor == null && !o.tabard && !o.belly) for (const sx of [-1, 1]) mk(gSph(0.11 * b), torsoM, sx * 0.1 * b, 0.42 * h, 0.08 * b, torso).scale.set(1, 0.8, 0.6); // peitorais
  if (o.tabard != null) { const tm = mat(o.tabard, { r: 0.9 }); mk(gBox(0.3 * b, 0.6 * h, 0.02), tm, 0, 0.12 * h, 0.14 * b, torso); mk(gBox(0.3 * b, 0.6 * h, 0.02), tm, 0, 0.12 * h, -0.14 * b, torso); }
  if (o.belly) mk(gSph(0.2 * o.belly), skin, 0, 0.12 * h, 0.07, torso);
  mk(gBox(0.48 * b, 0.06, 0.28 * b), dark(), 0, 0.03 * h, 0, torso);
  if (o.pauld) for (const sx of [-1, 1]) mk(gSph(0.14 * b), armM, sx * 0.3 * b, 0.5 * h, 0, torso);
  const head = new Group(); head.position.y = 0.6 * h; torso.add(head);
  mk(gCyl(0.055 * b, 0.075 * b, 0.1), skin, 0, -0.02, 0, head); // pescoço com trapézio
  const hs = o.headS ?? 1;
  // crânio tapered
  const skull = mk(gSph(0.12 * hs), skin, 0, 0.115 * hs, -0.005, head); skull.scale.set(0.95, 1.08, 1.0);
  mk(gBox(0.145 * hs, 0.1 * hs, 0.135 * hs), skin, 0, 0.045 * hs, 0.012 * hs, head); // mandíbula
  mk(gBox(0.075 * hs, 0.055 * hs, 0.06 * hs), skin, 0, 0.012 * hs, 0.05 * hs, head); // queixo
  for (const sx of [-1, 1]) { const ch = mk(gSph(0.042 * hs), skin, sx * 0.075 * hs, 0.085 * hs, 0.065 * hs, head); ch.scale.set(1, 0.7, 0.7); } // maçãs do rosto
  mk(gBox(0.17 * hs, 0.028 * hs, 0.035), skin, 0, 0.158 * hs, 0.085 * hs, head); // arco da sobrancelha
  mk(gBox(0.04 * hs, 0.075 * hs, 0.055 * hs), skin, 0, 0.105 * hs, 0.1 * hs, head); // ponte do nariz
  mk(gBox(0.05 * hs, 0.04 * hs, 0.05 * hs), skin, 0, 0.075 * hs, 0.11 * hs, head); // ponta do nariz
  for (const sx of [-1, 1]) mk(gBox(0.022, 0.07 * hs, 0.06 * hs), skin, sx * 0.125 * hs, 0.1 * hs, 0.005, head); // orelhas
  const ec = o.eye != null ? o.eye : 0x241a12;
  for (const sx of [-1, 1]) {
    mk(gBox(0.058 * hs, 0.04 * hs, 0.02), mat(0x120d09), sx * 0.052 * hs, 0.125 * hs, 0.098 * hs, head); // órbita
    if (o.eye != null) mk(gBox(0.04 * hs, 0.024 * hs, 0.02), mat(ec, { e: 2.4 }), sx * 0.052 * hs, 0.125 * hs, 0.107 * hs, head); // olho brilhante (criaturas)
    else { // olho natural: esclera + íris + pupila
      mk(gBox(0.046 * hs, 0.026 * hs, 0.018), mat(0xe8e2d8, { r: 0.35 }), sx * 0.052 * hs, 0.125 * hs, 0.104 * hs, head);
      mk(gBox(0.022 * hs, 0.022 * hs, 0.018), mat(ec, { r: 0.3 }), sx * 0.049 * hs, 0.125 * hs, 0.109 * hs, head);
      mk(gBox(0.01 * hs, 0.012 * hs, 0.018), mat(0x050403), sx * 0.049 * hs, 0.125 * hs, 0.112 * hs, head);
    }
    mk(gBox(0.062 * hs, 0.014, 0.022), mat(o.hair ?? 0x1a1512), sx * 0.052 * hs, 0.152 * hs, 0.1 * hs, head); // sobrancelha
  }
  mk(gBox(0.07 * hs, 0.014, 0.025), mat(0x6a3a36), 0, 0.058 * hs, 0.106 * hs, head); // boca
  const hm = o.hair ?? 0x222222, hMat = mat(hm, { r: 0.75 });
  const hairG = new Group(); head.add(hairG);
  if (o.hairStyle === 'spiky') {
    const base = mk(gSph(0.122 * hs), hMat, 0, 0.15 * hs, -0.01, hairG); base.scale.set(1.06, 0.95, 1.08);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, len = 0.13 + ((i * 7) % 3) * 0.06; const c = mk(gCone(0.038, len, 4), hMat, Math.sin(a) * 0.1, 0.19 * hs, Math.cos(a) * 0.092 - 0.02, hairG); c.rotation.set(Math.cos(a) * 0.5 - 0.25, a, -Math.sin(a) * 0.5); }
    for (let i = 0; i < 4; i++) mk(gCone(0.032, 0.13, 4), hMat, (i - 1.5) * 0.05, 0.195 * hs, 0.085, hairG, 0.55, 0, (i - 1.5) * 0.1); // franja
  } else if (o.hairStyle === 'long') {
    const cap = mk(gSph(0.128 * hs), hMat, 0, 0.14 * hs, -0.02, hairG); cap.scale.set(1.05, 1.02, 1.1);
    for (let i = 0; i < 8; i++) { const a = (i / 7 - 0.5); mk(gBox(0.07, 0.42, 0.06), hMat, a * 0.2, -0.04, -0.1 - Math.abs(a) * 0.04, hairG, 0.12 * a, 0, a * 0.15); }
    for (let i = 0; i < 5; i++) mk(gCone(0.026, 0.13, 4), hMat, (i - 2) * 0.045, 0.2 * hs, 0.072, hairG, 0.65, 0, 0); // franja
  } else if (o.hairStyle === 'short') {
    const cap = mk(gSph(0.124 * hs), hMat, 0, 0.145 * hs, -0.008, hairG); cap.scale.set(1.05, 0.88, 1.05);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; mk(gBox(0.055, 0.045, 0.055), hMat, Math.sin(a) * 0.092, 0.2 * hs, Math.cos(a) * 0.086, hairG, 0, a, 0); }
  }
  const hm2 = armM, hd = o.head;
  if (hd === 'kettle') { mk(gCyl(0.2, 0.2, 0.02), hm2, 0, 0.19, 0, head); mk(gSph(0.13), hm2, 0, 0.17, 0, head); }
  else if (hd === 'bucket') { mk(gCyl(0.125, 0.125, 0.24), hm2, 0, 0.13, 0, head); mk(gBox(0.2, 0.025, 0.02), dark(), 0, 0.15, 0.125, head); }
  else if (hd === 'full') { mk(gSph(0.14), hm2, 0, 0.12, 0, head); mk(gBox(0.16, 0.03, 0.03), dark(), 0, 0.12, 0.13, head); if (o.plume) mk(gBox(0.04, 0.12, 0.26), mat(o.plume), 0, 0.28, -0.02, head); }
  else if (hd === 'horned') { mk(gSph(0.135), hm2, 0, 0.12, 0, head); mk(gBox(0.12, 0.03, 0.03), dark(), 0, 0.12, 0.13, head); for (const sx of [-1, 1]) mk(gCone(0.035, 0.28, 6), mat(0xd8d0b8, { r: 0.5 }), sx * 0.13, 0.26, 0, head, 0, 0, -sx * 0.6); }
  else if (hd === 'hood') { mk(gCone(0.16, 0.3, 8), cloth, 0, 0.18, -0.02, head); }
  else if (hd === 'sack') { mk(gSph(0.13), mat(0xb8a078), 0, 0.12, 0, head); for (const sx of [-1, 1]) mk(gBox(0.03, 0.03, 0.02), dark(), sx * 0.05, 0.14, 0.12, head); }
  const arm = (sx: number) => {
    const sh = new Group(); sh.position.set(sx * 0.3 * b, 0.5 * h, 0); torso.add(sh);
    mk(gSph(0.095 * b), o.armor != null ? armM : cloth, 0, 0.0, 0, sh); // deltóide
    mk(gBox(0.12 * b, 0.32 * al, 0.12 * b), cloth, 0, -0.16 * al, 0, sh);
    const bi = mk(gSph(0.075 * b), cloth, 0, -0.14 * al, 0.015, sh); bi.scale.set(1, 1.4, 1.05); // bíceps
    const el = new Group(); el.position.y = -0.32 * al; sh.add(el);
    const fore = o.armor != null ? armM : skin;
    mk(gBox(0.1 * b, 0.3 * al, 0.1 * b), fore, 0, -0.15 * al, 0, el);
    mk(gSph(0.058 * b), fore, 0, -0.08 * al, 0.01, el).scale.set(1, 1.3, 1); // antebraço
    const hand = new Group(); hand.position.y = -0.31 * al; el.add(hand);
    mk(gBox(0.075 * b, 0.075 * b, 0.05 * b), skin, 0, -0.02, 0, hand); // palma
    mk(gBox(0.072 * b, 0.045 * b, 0.05 * b), skin, 0, -0.08, 0, hand); // dedos
    mk(gBox(0.03 * b, 0.055 * b, 0.04 * b), skin, sx * 0.05 * b, -0.015, 0, hand); // polegar
    return [sh, el, hand];
  };
  const [lSh, lEl, lHand] = arm(1), [rSh, rEl, rHand] = arm(-1);
  const wMount = new Group(); wMount.rotation.x = -1.2; rHand.add(wMount);
  const sMount = new Group(); sMount.position.set(0.05, -0.12, 0.1); lEl.add(sMount);
  let cape: G | null = null;
  if (o.cape != null) {
    cape = new Group(); cape.position.set(0, 0.5 * h, -0.14 * b); torso.add(cape);
    const cm = mat(o.cape, { r: 0.95 }); (cm as any).side = THREE.DoubleSide;
    if (o.ragged) for (let i = 0; i < 6; i++) { const L = (0.55 + ((i * 37) % 5) * 0.08) * h; mk(gBox(0.1 * b, L, 0.025), cm, (i - 2.5) * 0.095 * b, -L / 2, 0, cape); }
    else mk(gBox(0.48 * b, 0.8 * h, 0.025), cm, 0, -0.4 * h, 0, cape);
  }
  const rig: Rig = { root, body, hips, torso, head, lSh, lEl, lHand, rSh, rEl, rHand, lHip, lKn, rHip, rKn, wings: [], cape, wMount, sMount, x: { hair: hairG }, h: 1.85 * h, hunch: o.hunch ?? 0, flying: false, wingSpd: 9, mats: [] };
  return rig;
}

// ---------- Armas ----------
const MOUNT: Record<string, number> = { sword: -1.2, greatsword: -1.2, rapier: -1.3, saber: -1.2, dagger: -1.2, axe: -1.2, mace: -1.2, hammer: -1.2, club: -1.2, spear: -1.45, longspear: -1.45, halberd: -1.4, crossbow: 0, staff: 0, windsword: -1.3, dragon: -1.2 };
export function weapon(k: string): G {
  const g = new Group(), st = steel();
  const grip = (len = 0.2) => { mk(gCyl(0.022, 0.022, len), wood(), 0, len / 2 - 0.02, 0, g); mk(gSph(0.032), gold(), 0, len, 0, g); };
  const blade = (len: number, w: number, th: number, m: THREE.Material = st) => {
    mk(gBox(w, len, th), m, 0, -0.08 - len / 2, 0, g);
    const t = mk(gCone(w * 0.72, w * 1.6, 4), m, 0, -0.08 - len - w * 0.7, 0, g, Math.PI, Math.PI / 4, 0); t.scale.z = (th / w) * 1.4;
  };
  const guard = (w: number) => mk(gBox(w, 0.035, 0.06), gold(), 0, -0.06, 0, g);
  switch (k) {
    case 'sword': grip(); guard(0.22); blade(0.85, 0.07, 0.016); break;
    case 'greatsword': grip(0.3); guard(0.32); blade(1.4, 0.11, 0.022); break;
    case 'rapier': grip(); mk(gCyl(0.07, 0.07, 0.01, 12), gold(), 0, -0.06, 0, g); blade(1.0, 0.025, 0.012); break;
    case 'windsword': grip(); mk(gCyl(0.07, 0.07, 0.01, 12), gold(), 0, -0.06, 0, g); blade(1.0, 0.03, 0.012, mat(0x9affc8, { e: 1.2, r: 0.2 })); break;
    case 'saber': grip(); guard(0.2); { const s = new Group(); s.rotation.z = 0.08; g.add(s); mk(gBox(0.065, 0.85, 0.014), st, 0, -0.5, 0, s); mk(gBox(0.03, 0.15, 0.014), st, -0.02, -0.98, 0, s, 0, 0, 0.3); } break;
    case 'dagger': grip(0.12); guard(0.1); blade(0.3, 0.05, 0.014); break;
    case 'spear': mk(gCyl(0.02, 0.02, 2.4), wood(), 0, -0.5, 0, g); mk(gCone(0.05, 0.32, 6), st, 0, -1.86, 0, g, Math.PI); break;
    case 'longspear': mk(gCyl(0.02, 0.02, 3.2), wood(), 0, -0.7, 0, g); mk(gCone(0.05, 0.4, 6), st, 0, -2.5, 0, g, Math.PI); break;
    case 'halberd': mk(gCyl(0.022, 0.022, 2.4), wood(), 0, -0.5, 0, g); mk(gBox(0.34, 0.3, 0.02), st, 0.18, -1.55, 0, g); mk(gCone(0.04, 0.4, 6), st, 0, -1.9, 0, g, Math.PI); mk(gCone(0.03, 0.2, 5), st, -0.1, -1.55, 0, g, 0, 0, Math.PI / 2); break;
    case 'mace': mk(gCyl(0.025, 0.025, 0.7), wood(), 0, -0.3, 0, g); mk(gSph(0.1), dsteel(), 0, -0.72, 0, g); for (let i = 0; i < 6; i++) { const a = i * 1.05; mk(gBox(0.03, 0.03, 0.08), dsteel(), Math.sin(a) * 0.11, -0.72, Math.cos(a) * 0.11, g, 0, a, 0); } break;
    case 'axe': mk(gCyl(0.025, 0.025, 0.8), wood(), 0, -0.3, 0, g); mk(gBox(0.3, 0.22, 0.03), st, 0.14, -0.7, 0, g); break;
    case 'hammer': mk(gCyl(0.03, 0.03, 1.0), wood(), 0, -0.4, 0, g); mk(gBox(0.32, 0.22, 0.22), dsteel(), 0, -0.95, 0, g); break;
    case 'club': mk(gCyl(0.03, 0.1, 0.9), wood(), 0, -0.4, 0, g); break;
    case 'crossbow': mk(gBox(0.07, 0.07, 0.6), wood(), 0, 0, 0.2, g); mk(gBox(0.55, 0.035, 0.05), dsteel(), 0, 0.03, 0.5, g); mk(gBox(0.004, 0.004, 0.5), mat(0xddd8c0), 0, 0.03, 0.3, g); break;
    case 'staff': mk(gCyl(0.025, 0.03, 1.8), wood(), 0, 0.3, 0, g); mk(gSph(0.07), gold(), 0, 1.25, 0, g); mk(gCone(0.07, 0.22, 5), mat(0x7fe0ff, { e: 2 }), 0, 1.42, 0, g); mk(gCone(0.07, 0.15, 5), mat(0x7fe0ff, { e: 2 }), 0, 1.24, 0, g, Math.PI); break;
  }
  return g;
}
export function equip(r: Rig, k: string, sc = 1) { const w = weapon(k); w.scale.setScalar(sc); r.wMount.rotation.x = MOUNT[k] ?? -1.2; r.wMount.add(w); return w; }
export function shield(r: Rig, kind: string, col: number, trim = 0xc9a13a) {
  const g = new Group(); const c = mat(col, { r: 0.6, m: 0.3 });
  if (kind === 'round') { mk(gCyl(0.3, 0.3, 0.04, 16), c, 0, 0, 0.06, g, Math.PI / 2); mk(gSph(0.06), mat(trim, { m: 0.9, r: 0.3 }), 0, 0, 0.1, g); }
  else if (kind === 'heater') { mk(gBox(0.4, 0.5, 0.04), c, 0, -0.05, 0.06, g); mk(gCone(0.28, 0.3, 4), c, 0, -0.45, 0.06, g, Math.PI, Math.PI / 4).scale.z = 0.15; }
  else if (kind === 'kite') { mk(gBox(0.34, 0.55, 0.04), c, 0, 0, 0.06, g); mk(gCone(0.24, 0.5, 4), c, 0, -0.52, 0.06, g, Math.PI, Math.PI / 4).scale.z = 0.17; }
  else mk(gCyl(0.15, 0.15, 0.04, 12), c, 0, 0, 0.06, g, Math.PI / 2);
  r.sMount.add(g); return g;
}

export function furCollar(r: Rig, col = 0x241f1b, n = 16, rad = 0.26, y = 0.5) {
  const g = new Group(); g.position.y = y * (r.h / 1.85); r.torso.add(g);
  const m = mat(col, { r: 1 });
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const f = mk(gCone(0.06, 0.17 + ((i * 5) % 3) * 0.03, 5), m, Math.sin(a) * rad, 0.02, Math.cos(a) * rad * 0.8 - 0.02, g); f.rotation.set(Math.cos(a) * 0.35, a, -Math.sin(a) * 0.35); }
  return g;
}
function wingPair(r: Rig, col: number, n: number, size: number, glow = false, y = 0.42, bat = false) {
  for (const sx of [-1, 1]) {
    const w = new Group(); w.position.set(sx * 0.14, y * r.h / 1.85, -0.14); r.torso.add(w);
    const m = bat ? mat(col, { r: 0.9 }) : glow ? mat(col, { e: 1.2, t: 0.85 }) : mat(col, { r: 0.7 });
    (m as any).side = THREE.DoubleSide;
    for (let i = 0; i < n; i++) {
      const f = new Group(); f.rotation.z = sx * (0.25 + (i / Math.max(1, n - 1)) * (bat ? 1.1 : 1.3)); w.add(f);
      const L = size * (1 - Math.abs(i - n / 2.5) * 0.06);
      mk(bat ? gBox(0.04, L, 0.015) : gBox(0.11, L, 0.015), m, 0, L / 2, 0, f);
    }
    w.rotation.y = sx * 0.5; r.wings.push(w);
  }
}

// ---------- Personagens ----------
export interface GutsCosm { ds?: 'steel' | 'dark' | 'crimson'; cape?: 'black' | 'crimson' | 'brown' }
const CAPE_COL = { black: 0x090909, crimson: 0x3a0a0a, brown: 0x241408 };
export function buildGuts(cosm?: GutsCosm): Rig {
  const r = humanoid({ skin: 0xbf8f6a, cloth: 0x141418, armor: 0x2e3036, bulk: 1.16, height: 1.05, hair: 0x0c0c0e, hairStyle: 'spiky', eye: 0xff2a18, cape: CAPE_COL[cosm?.cape || 'black'], ragged: true, pauld: true, legs: 0x18181c, boots: 0x0e0e11, knee: true });
  mk(gBox(0.03, 0.1, 0.013), mat(0x7a2622), 0.045, 0.13, 0.112, r.head); // cicatriz vertical no olho
  furCollar(r, 0x2a2420, 18, 0.28, 0.52); // gola de pele
  // placas de peito desgastadas
  for (let i = 0; i < 3; i++) mk(gBox(0.44 - i * 0.04, 0.03, 0.02), mat(0x4a4c52, { r: 0.5, m: 0.6 }), 0, 0.2 + i * 0.12, 0.14, r.torso);
  for (const sx of [-1, 1]) { mk(gSph(0.15), mat(0x3a3c42, { r: 0.45, m: 0.7 }), sx * 0.31, 0.5, 0, r.torso); mk(gBox(0.1, 0.03, 0.14), mat(0x26282c, { r: 0.6, m: 0.6 }), sx * 0.31, 0.56, 0.02, r.torso); }
  // prótese: braço de canhão
  r.lHand.children[0].visible = false;
  const cm = dsteel();
  mk(gCyl(0.085, 0.085, 0.5, 12), cm, 0, -0.18, 0, r.lEl);
  mk(gTor(0.09, 0.02), steel(), 0, -0.43, 0, r.lEl, Math.PI / 2);
  mk(gCyl(0.06, 0.06, 0.06, 10), mat(0x000000), 0, -0.455, 0, r.lEl);
  mk(gBox(0.08, 0.14, 0.06), steel(), 0.1, -0.1, 0, r.lEl);
  mk(gBox(0.03, 0.08, 0.06), steel(), 0.09, -0.02, 0.05, r.lEl, 0, 0, 0.5);
  mk(gSph(0.03), gold(), 0.13, -0.12, 0, r.lEl);
  const ml = new Group(); ml.position.set(0, -0.5, 0); r.lEl.add(ml); r.x.muzzleL = ml;
  // besta repetidora no antebraço direito
  mk(gBox(0.14, 0.3, 0.16), dsteel(), 0, -0.1, 0.1, r.rEl);
  mk(gCyl(0.045, 0.045, 0.22, 8), steel(), 0, 0.0, 0.2, r.rEl, 0, 0, Math.PI / 2);
  mk(gBox(0.5, 0.03, 0.04), dsteel(), 0, -0.28, 0.12, r.rEl);
  for (let i = 0; i < 4; i++) mk(gCyl(0.008, 0.008, 0.1), steel(), -0.06 + i * 0.04, 0.04, 0.2, r.rEl, Math.PI / 2);
  const mr = new Group(); mr.position.set(0, -0.36, 0.12); r.rEl.add(mr); r.x.muzzleR = mr;
  r.x.dragon = dragonSlayer(cosm?.ds); r.wMount.add(r.x.dragon);
  r.x.dragon.scale.setScalar(1);
  r.wMount.rotation.x = -1.2;
  r.x.berserk = berserkArmor(r); r.x.berserk.visible = false;
  return r;
}
export function dragonSlayer(skin?: 'steel' | 'dark' | 'crimson'): G {
  const cols = { steel: [0x7d8189, 0x2c2d33, 0xb9bec6], dark: [0x3a3c42, 0x17181c, 0x6a7078], crimson: [0x6a3034, 0x24121a, 0xc06050] }[skin || 'steel'];
  const g = new Group(), st = mat(cols[0], { r: 0.45, m: 0.85 }), dk = mat(cols[1], { r: 0.6, m: 0.7 }), ed = mat(cols[2], { r: 0.25, m: 0.95 });
  mk(gCyl(0.03, 0.03, 0.55, 8), wood(), 0, 0.22, 0, g); mk(gSph(0.05), dk, 0, 0.5, 0, g);
  mk(gBox(0.52, 0.07, 0.12), dk, 0, -0.1, 0, g);
  mk(gBox(0.32, 2.0, 0.07), st, 0, -1.15, 0, g);
  mk(gBox(0.07, 2.0, 0.13), dk, 0.17, -1.15, 0, g);
  mk(gBox(0.03, 2.0, 0.05), ed, -0.17, -1.15, 0, g);
  mk(gBox(0.05, 1.7, 0.08), dk, 0, -1.2, 0, g);
  for (let i = 0; i < 6; i++) { mk(gSph(0.02), gold(), 0.17, -0.35 - i * 0.3, 0.07, g); mk(gBox(0.3, 0.2, 0.085), mat(0x45474f, { r: 0.8, m: 0.5 }), 0, -0.5 - i * 0.3, 0, g).scale.set(1, 0.5 + (i % 3) * 0.2, 1); }
  for (let i = 0; i < 5; i++) mk(gSph(0.025), dk, -0.17, -0.5 - i * 0.37, 0, g);
  const t = mk(gCone(0.23, 0.35, 4), st, 0, -2.3, 0, g, Math.PI, Math.PI / 4); t.scale.z = 0.3;
  return g;
}
function berserkArmor(r: Rig): G {
  const g = new Group(), m = mat(0x1d1d20, { r: 0.35, m: 0.9 });
  mk(gBox(0.54, 0.56, 0.32), m, 0, 0.28, 0, r.torso).visible = false; // placeholder
  const chest = mk(gBox(0.56, 0.55, 0.32), m, 0, 0.3, 0, g); chest.castShadow = true;
  for (let i = 0; i < 4; i++) mk(gBox(0.5, 0.025, 0.04), steel(), 0, 0.12 + i * 0.12, 0.17, g);
  for (const sx of [-1, 1]) {
    mk(gSph(0.17), m, sx * 0.33, 0.5, 0, g);
    for (let i = 0; i < 3; i++) mk(gCone(0.03, 0.18, 5), steel(), sx * (0.36 + i * 0.02), 0.62 + i * 0.01, (i - 1) * 0.08, g, 0, 0, -sx * 0.7);
    mk(gBox(0.14, 0.34, 0.14), m, sx * 0.31, -0.05, 0, g); // braçais
    for (let i = 0; i < 3; i++) mk(gBox(0.15, 0.03, 0.15), steel(), sx * 0.31, -0.14 + i * 0.09, 0, g); // lamelas
  }
  mk(gBox(0.4, 0.14, 0.3), m, 0, 0.0, 0, g); // faulds
  mk(gBox(0.34, 0.1, 0.32), m, 0, -0.09, 0, g);
  mk(gBox(0.03, 0.44, 0.05), steel(), 0, 0.3, 0.175, g); // nervura central
  g.position.set(0, 0, 0); r.torso.add(g);
  const hg = new Group();
  mk(gSph(0.15), m, 0, 0.12, 0, hg); mk(gBox(0.2, 0.05, 0.04), mat(0xff2a1a, { e: 3 }), 0, 0.14, 0.125, hg);
  mk(gBox(0.18, 0.08, 0.05), dsteel(), 0, 0.03, 0.12, hg);
  for (let i = 0; i < 5; i++) mk(gBox(0.015, 0.05, 0.03), mat(0xd8d0c0), -0.06 + i * 0.03, 0.01, 0.15, hg);
  mk(gBox(0.03, 0.18, 0.26), steel(), 0, 0.28, -0.02, hg);
  r.head.add(hg); r.x.berserkHelm = hg; hg.visible = false;
  g.visible = false;
  return g;
}
export function setBerserk(r: Rig, on: boolean) { r.x.berserk.visible = on; r.x.berserkHelm.visible = on; r.x.hair.visible = !on; }

export function buildCaska(cloak = false): Rig {
  const r = humanoid({ skin: 0xe0b393, cloth: 0x3a2a2a, armor: 0xb4bac2, bulk: 0.88, height: 0.96, hair: 0x1a1210, hairStyle: 'short', cape: 0xf2f2f0, boots: 0x2a1a14, knee: true, legs: 0x2e2420, pauld: true });
  mk(gBox(0.5 * 0.88, 0.07, 0.3), mat(0xa02020), 0, 0.04, 0, r.torso);
  mk(gBox(0.1, 0.1, 0.02), gold(), 0, 0.3, 0.14, r.torso);
  mk(gBox(0.03, 0.1, 0.02), mat(0xc02020), 0, 0.3, 0.155, r.torso);
  const cb = weapon('crossbow'); cb.position.set(0, 0.3, -0.22); cb.rotation.set(0.2, 0, 1.2); cb.scale.setScalar(0.8); r.torso.add(cb);
  equip(r, 'sword', 1.0);
  const c = new Group(); c.visible = cloak; r.torso.add(c);
  const cm = mat(0x1d2a6a, { r: 0.9 }); (cm as any).side = THREE.DoubleSide;
  const cp = new Group(); cp.position.set(0, 0.5 * 0.96, -0.16); c.add(cp); r.x.cloakCape = cp;
  mk(gBox(0.6, 1.0, 0.03), cm, 0, -0.5, 0, cp);
  mk(gBox(0.62, 0.05, 0.035), gold(), 0, -1.0, 0, cp);
  mk(gBox(0.05, 0.9, 0.035), gold(), 0.3, -0.5, 0, cp); mk(gBox(0.05, 0.9, 0.035), gold(), -0.3, -0.5, 0, cp);
  mk(gSph(0.07), mat(0xffd86a, { e: 3 }), 0, -0.4, -0.03, cp);
  r.x.cloak = c;
  return r;
}
export function setCloak(r: Rig, on: boolean) { r.x.cloak.visible = on; if (r.cape) r.cape.visible = !on; }

export function buildPuck(): Rig {
  const r = humanoid({ skin: 0xf0c8a8, cloth: 0x3a7a4a, bulk: 0.9, height: 1, hair: 0x5a3a20, hairStyle: 'short', headS: 1.5, eye: 0x203060, boots: 0x6a4a20 });
  r.root.scale.setScalar(0.3); r.flying = true; r.wingSpd = 28;
  wingPair(r, 0xbfffe8, 3, 0.45, true, 0.4);
  const gl = mk(gSph(0.5, 10), mat(0xaaffee, { e: 1.5, t: 0.18 }), 0, 0.6, 0, r.body); gl.castShadow = false;
  return r;
}
export function buildIsidro(): Rig {
  const r = humanoid({ skin: 0xd8a878, cloth: 0x8a4a2a, bulk: 0.8, height: 0.78, hair: 0xb03a20, hairStyle: 'spiky', boots: 0x3a2a1a, legs: 0x5a3c28 });
  mk(gBox(0.3, 0.05, 0.2), mat(0xc9a13a, { r: 0.4, m: 0.8 }), 0, 0.04, 0, r.torso); // cinto
  mk(gBox(0.16, 0.22, 0.06), mat(0x4a2c18, { r: 0.9 }), 0.2, 0, 0.05, r.hips); // bolsa
  equip(r, 'saber', 0.7); // espada curta roubada
  return r;
}
export function buildRickert(): Rig {
  const r = humanoid({ skin: 0xe8c8a8, cloth: 0x5a4a34, bulk: 0.82, height: 0.82, hair: 0xd8b060, hairStyle: 'short', boots: 0x3a2a1a, legs: 0x4a3c2c });
  mk(gBox(0.34, 0.5, 0.02), mat(0x6a5440, { r: 0.95 }), 0, 0.2, 0.14, r.torso); // avental pequeno
  mk(gBox(0.1, 0.06, 0.1), mat(0x8a8f98, { r: 0.4, m: 0.7 }), 0.2, 0.02, 0.08, r.hips); // ferramentas
  return r;
}
export function buildSkullKnight(): Rig {
  const r = humanoid({ skin: 0x1a1a1e, cloth: 0x15151a, armor: 0x3a3c44, bulk: 1.25, height: 1.12, pauld: true, knee: true, cape: 0x1a1016, ragged: true, legs: 0x26262c, boots: 0x111114, eye: 0xffb830 });
  // elmo-caveira com chifres curvos
  const bone = mat(0xd8d0bc, { r: 0.55 });
  mk(gSph(0.145), bone, 0, 0.12, 0, r.head); mk(gBox(0.13, 0.07, 0.07), bone, 0, 0.01, 0.07, r.head);
  for (const sx of [-1, 1]) { mk(gBox(0.045, 0.045, 0.02), mat(0xffb830, { e: 2.6 }), sx * 0.05, 0.12, 0.13, r.head); mk(gCone(0.04, 0.34, 6), bone, sx * 0.15, 0.3, -0.02, r.head, 0.3, 0, -sx * 0.9); }
  for (let i = 0; i < 4; i++) mk(gCone(0.025, 0.1, 5), bone, -0.06 + i * 0.04, -0.03, 0.1, r.head, 2.6);
  // armadura espinhada
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) mk(gCone(0.035, 0.2, 5), mat(0x4a4c54, { r: 0.4, m: 0.8 }), sx * 0.33, 0.56, (i - 0.5) * 0.12, r.torso, 0, 0, -sx * 0.6);
  equip(r, 'greatsword', 1.5);
  return r;
}
export function buildGodo(): Rig {
  const r = humanoid({ skin: 0xc49a74, cloth: 0x4a3a2c, bulk: 1.25, height: 0.95, belly: 1.25, hunch: 0.18, boots: 0x2a1c12, legs: 0x3a2e22, arm: 1.05 });
  // careca com barba grisalha
  mk(gSph(0.1), mat(0xd8d8d0, { r: 0.9 }), 0, 0.03, 0.08, r.head).scale.set(1.1, 1.3, 0.7); // barba
  mk(gBox(0.16, 0.03, 0.02), mat(0xd8d8d0), 0, 0.152, 0.1, r.head); // sobrancelhas grossas
  // avental de couro
  const ap = mat(0x5a4330, { r: 0.95 });
  mk(gBox(0.4, 0.62, 0.025), ap, 0, 0.2, 0.17, r.torso);
  mk(gBox(0.1, 0.04, 0.03), mat(0x2a2018), 0, 0.5, 0.17, r.torso);
  equip(r, 'hammer', 0.8);
  return r;
}
export function buildIvalera(): Rig {
  const r = humanoid({ skin: 0xf2d0b0, cloth: 0x7a3a8a, bulk: 0.9, height: 1, hair: 0x9a6a3a, hairStyle: 'long', headS: 1.5, eye: 0x30a060, boots: 0x5a3a7a });
  r.root.scale.setScalar(0.28); r.flying = true; r.wingSpd = 30;
  wingPair(r, 0xffc8e8, 3, 0.45, true, 0.4);
  const gl = mk(gSph(0.5, 10), mat(0xffb0e0, { e: 1.5, t: 0.18 }), 0, 0.6, 0, r.body); gl.castShadow = false;
  return r;
}
export function buildSerpico(): Rig {
  const r = humanoid({ skin: 0xe8cdb4, cloth: 0x244a34, armor: 0x2f5c40, metal: false, bulk: 0.95, height: 1.02, hair: 0x14110f, hairStyle: 'short', cape: 0x3c8a56, ragged: true, boots: 0x3a2a1a, legs: 0x1c2c24 });
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) mk(gCone(0.04, 0.2, 5), mat(0x4aa86a), sx * 0.34, 0.54 - i * 0.02, (i - 1.5) * 0.07, r.torso, 0, 0, -sx * 1.3);
  mk(gBox(0.48, 0.03, 0.28), gold(), 0, 0.55, 0, r.torso);
  mk(gBox(0.13, 0.13, 0.13), mat(0x4a2c18, { r: 0.9 }), 0, -0.2, 0, r.lEl); mk(gBox(0.13, 0.13, 0.13), mat(0x4a2c18, { r: 0.9 }), 0, -0.2, 0, r.rEl);
  equip(r, 'windsword', 1);
  return r;
}
export function buildSchierke(): Rig {
  const r = humanoid({ skin: 0xf0d8c4, cloth: 0x5b3a8a, bulk: 0.8, height: 0.8, hair: 0xe8e2d0, hairStyle: 'long', eye: 0x4aa8ff, boots: 0x3a2a5a, legs: 0x5b3a8a });
  mk(gCyl(0.16, 0.34, 0.62, 12), mat(0x6b46a0, { r: 0.9 }), 0, -0.2, 0, r.hips);
  mk(gBox(0.05, 0.05, 0.03), gold(), 0.09, 0.2, 0.1, r.head);
  mk(gBox(0.4, 0.04, 0.2), gold(), 0, 0.02, 0, r.torso);
  equip(r, 'staff', 0.9);
  const orb = mk(gSph(0.1, 12), mat(0x7fc8ff, { e: 2.5, t: 0.9 }), 0, -0.1, 0.06, r.lHand); r.x.orb = orb;
  return r;
}
export function buildFarnese(): Rig {
  const r = humanoid({ skin: 0xf0d2bc, cloth: 0xe6dcc0, bulk: 0.88, height: 0.96, hair: 0xe0c070, hairStyle: 'short', cape: 0x6a1f2f, boots: 0x3a2a1a, legs: 0xcfc4a8, tabard: 0xe6dcc0 });
  mk(gBox(0.05, 0.22, 0.02), gold(), 0, 0.3, 0.16, r.torso); mk(gBox(0.15, 0.05, 0.02), gold(), 0, 0.34, 0.16, r.torso);
  const bk = mk(gBox(0.2, 0.26, 0.07), mat(0x3a2414, { r: 0.8 }), 0.28, 0.0, 0.0, r.torso); mk(gBox(0.02, 0.2, 0.075), gold(), 0, 0, 0, bk);
  for (let i = 0; i < 5; i++) mk(gSph(0.015), steel(), 0.28, -0.08 - i * 0.04, 0.05, r.torso);
  equip(r, 'mace', 0.8);
  return r;
}
export function buildRoderick(): Rig {
  const r = humanoid({ skin: 0xd8b090, cloth: 0x2e4a8a, armor: 0xa0a6ae, bulk: 1.1, height: 1.06, hair: 0x888078, hairStyle: 'short', tabard: 0x2e4a8a, boots: 0x2a1c14, pauld: true, knee: true, legs: 0x70757d });
  mk(gSph(0.13), mat(0xa0a6ae, { r: 0.4, m: 0.8 }), 0.26, -0.02, -0.05, r.hips); mk(gBox(0.1, 0.03, 0.03), dark(), 0.26, 0.0, 0.07, r.hips);
  equip(r, 'halberd', 1);
  return r;
}
export function buildGolem(): Rig {
  const rk = mat(0x6b6760, { r: 1 }), rk2 = mat(0x514e48, { r: 1 });
  const r = humanoid({ skin: 0x6b6760, cloth: 0x514e48, armor: 0x77736b, metal: false, bulk: 1.7, height: 1.0, arm: 1.2, hunch: 0.25, pauld: true, boots: 0x514e48, legs: 0x5a5750, headS: 1.1 });
  r.root.scale.setScalar(2.6 / 1.85 * 1.0);
  for (const sx of [-1, 1]) { mk(gBox(0.1, 0.05, 0.03), mat(0xff7a1a, { e: 4 }), sx * 0.05, 0.13, 0.115, r.head); mk(gBox(0.3, 0.28, 0.28), rk2, sx * 0.4, 0.58, 0, r.torso, 0.3, 0.2, sx * 0.3); }
  mk(gBox(0.3, 0.04, 0.02), mat(0xff7a1a, { e: 3 }), 0, 0.34, 0.2, r.torso); mk(gBox(0.04, 0.3, 0.02), mat(0xff7a1a, { e: 3 }), 0, 0.3, 0.2, r.torso);
  mk(gBox(0.2, 0.14, 0.22), rk, 0, 0.4, 0.1, r.torso, 0.1, 0.3, 0.1);
  return r;
}
export function buildGriffith(variant: 'human' | 'femto' | 'falcon'): Rig {
  if (variant === 'human') {
    const r = humanoid({ skin: 0xf0dccb, cloth: 0xeeeeee, armor: 0xf4f2ec, bulk: 0.95, height: 1.03, hair: 0xf2efe4, hairStyle: 'long', cape: 0xffffff, boots: 0xd8d4c8, legs: 0xe8e4d8, pauld: true, knee: true, eye: 0x3a5a8a });
    mk(gBox(0.5, 0.04, 0.3), gold(), 0, 0.08, 0, r.torso); mk(gBox(0.05, 0.3, 0.02), gold(), 0, 0.3, 0.15, r.torso);
    for (const sx of [-1, 1]) mk(gSph(0.15), gold(), sx * 0.3, 0.5, 0, r.torso).scale.set(1, 0.4, 1);
    equip(r, 'sword', 1.1); return r;
  }
  if (variant === 'femto') {
    const r = humanoid({ skin: 0xf3e9e0, cloth: 0x1a1030, armor: 0x2a1a48, bulk: 1.0, height: 1.06, hair: 0xf4f0e8, hairStyle: 'long', cape: 0xf0ecff, eye: 0xff2a2a, pauld: true, legs: 0x1a1030, boots: 0x120a20, hunch: 0 });
    r.flying = true; r.wingSpd = 3;
    wingPair(r, 0xf0ecff, 5, 1.4, false, 0.5); wingPair(r, 0x1a1030, 4, 1.1, false, 0.4);
    mk(gSph(0.06), mat(0xff1a1a, { e: 3 }), 0, 0.36, 0.14, r.torso);
    mk(gCone(0.05, 0.22, 5), mat(0xe8e0f0), 0, 0.25, 0, r.head); equip(r, 'sword', 1.2); return r;
  }
  const r = humanoid({ skin: 0xfff3d0, cloth: 0xfff0b8, armor: 0xffe9a0, bulk: 1.0, height: 1.1, hair: 0xffffff, hairStyle: 'long', cape: 0xfffbe8, eye: 0xffffff, pauld: true, legs: 0xffe9a0, boots: 0xffe9a0 });
  r.flying = true; r.wingSpd = 3;
  for (const [y, s] of [[0.58, 1.8], [0.46, 1.5], [0.34, 1.2]] as number[][]) wingPair(r, 0xfffaf0, 6, s, true, y);
  const halo = mk(gTor(0.5, 0.03), mat(0xffe9a0, { e: 3 }), 0, 0.2, -0.3, r.head); halo.castShadow = false; r.x.halo = halo;
  equip(r, 'greatsword', 1.1);
  return r;
}

// ---------- Inimigos ----------
const FACT = [[0x7a1f1f, 0xc9a13a], [0x1f3c7a, 0xd8d8d8], [0x2d5a2d, 0xb8a04a], [0x4a2a6a, 0xc0c0c0]];
let fi = 0;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export function buildEnemy(id: string): Rig {
  const f = FACT[fi++ % FACT.length];
  let r: Rig;
  switch (id) {
    case 'bandit': r = humanoid({ skin: 0xb08060, cloth: 0x4a3a2a, armor: 0x5a4630, metal: false, head: pick(['hood', 'none', 'sack']), hair: 0x2a1a10, hairStyle: 'short', boots: 0x2a1a10, legs: 0x3a2e22 }); equip(r, pick(['axe', 'dagger', 'club'])); if (Math.random() < 0.4) shield(r, 'buckler', 0x6a4a2a); break;
    case 'soldier': r = humanoid({ skin: 0xc9a080, cloth: 0x555a60, armor: 0x7a8088, head: 'kettle', tabard: f[0], legs: 0x444850, boots: 0x2a1c14 }); if (Math.random() < 0.5) { equip(r, 'spear'); } else { equip(r, 'sword'); shield(r, 'round', f[0]); } break;
    case 'crossbowman': r = humanoid({ skin: 0xc9a080, cloth: 0x4a5a3a, armor: 0x55603e, metal: false, head: 'hood', legs: 0x3a3a2a, boots: 0x2a1c14, bulk: 0.95 }); equip(r, 'crossbow'); r.x.shoot = true; break;
    case 'knight': r = humanoid({ skin: 0xc9a080, cloth: 0x333, armor: 0x9096a0, head: 'full', plume: f[0], tabard: f[0], pauld: true, knee: true, bulk: 1.2, legs: 0x70757d, boots: 0x2a2a2a }); equip(r, pick(['mace', 'sword', 'axe']), 1.1); shield(r, pick(['heater', 'kite']), f[0]); break;
    case 'elite': r = humanoid({ skin: 0xc09070, cloth: 0x1a1a1e, armor: 0x24242a, head: 'horned', cape: 0x6a1010, pauld: true, knee: true, bulk: 1.1, legs: 0x1a1a1e, boots: 0x111 }); equip(r, pick(['saber', 'greatsword']), 1.15); mk(gBox(0.5, 0.04, 0.3), gold(), 0, 0.08, 0, r.torso); break;
    case 'brute': r = humanoid({ skin: 0xb89070, cloth: 0x3a2a1c, head: 'sack', bulk: 1.45, belly: 1.4, hunch: 0.15, boots: 0x2a1a10, legs: 0x3a2a1c, arm: 1.05 }); equip(r, 'hammer', 1.6); mk(gSph(0.05), mat(0xd8d0b8), 0.1, 0.05, 0.2, r.torso); break;
    case 'imp': r = humanoid({ skin: 0x8a3030, cloth: 0x4a1a1a, headS: 1.5, arm: 1.3, hunch: 0.35, eye: 0xffe040, boots: 0x4a1a1a, bulk: 0.8 }); wingPair(r, 0x3a1010, 4, 0.7, false, 0.4, true); for (const sx of [-1, 1]) mk(gCone(0.025, 0.14, 5), mat(0xd8d0b8), sx * 0.08, 0.28, 0, r.head, 0, 0, -sx * 0.3); r.flying = false; r.wingSpd = 20; break;
    case 'ghoul': r = humanoid({ skin: 0x8d9a8a, cloth: 0x3a3a34, bulk: 0.8, arm: 1.45, hunch: 0.5, eye: 0xff3030, hair: 0x555555, hairStyle: 'short', boots: 0x5a5a50, legs: 0x4a4a40 }); mk(gBox(0.1, 0.06, 0.03), dark(), 0, 0.05, 0.1, r.head); break;
    case 'troll': r = humanoid({ skin: 0x5f7a52, cloth: 0x4a3a2a, bulk: 1.4, belly: 1.5, hunch: 0.3, arm: 1.15, eye: 0xffd040, headS: 0.95, boots: 0x3a2a1a, legs: 0x4a3a2a }); for (const sx of [-1, 1]) mk(gCone(0.025, 0.12, 5), mat(0xe0d8c0), sx * 0.06, 0.05, 0.1, r.head, 0.2); equip(r, 'club', 1.8); break;
    case 'apostle': r = humanoid({ skin: 0x3a2f4a, cloth: 0x201830, armor: 0x2c2240, metal: false, bulk: 1.15, arm: 1.15, eye: 0xff2020, head: 'horned', hunch: 0.15, boots: 0x201830, legs: 0x2c2240 }); wingPair(r, 0x15101f, 5, 1.0, false, 0.5, true); for (let i = 0; i < 4; i++) mk(gCone(0.04, 0.2, 5), mat(0xc0b8a8), 0, 0.5 - i * 0.12, -0.2, r.torso, -1.3); break;
    case 'spitter': r = humanoid({ skin: 0x6d8a3a, cloth: 0x3a4a22, bulk: 1.2, height: 0.85, belly: 2.4, arm: 0.9, eye: 0xc8ff40, headS: 1.2, boots: 0x3a4a22, legs: 0x4a5a2a, hunch: 0.15 }); mk(gSph(0.08), mat(0xb8ff40, { e: 2.2 }), 0, 0.07, 0.1, r.head).scale.set(1.4, 0.8, 1); for (let i = 0; i < 3; i++) mk(gSph(0.025), mat(0xffe040, { e: 2 }), (i - 1) * 0.06, 0.2, 0.09, r.head); break;
    case 'ogre': r = humanoid({ skin: 0x9a8a78, cloth: 0x3a3028, bulk: 1.6, belly: 1.3, hunch: 0.2, arm: 1.1, eye: 0xff9020, boots: 0x2a2018, legs: 0x3a3028 }); mk(gCone(0.04, 0.2, 5), mat(0xd8d0b8), 0, 0.32, 0.08, r.head); mk(gTor(0.22, 0.03), dsteel(), 0, 0.5, 0.05, r.torso, Math.PI / 2.4); equip(r, 'hammer', 2.2); break;
    default: r = humanoid({ skin: 0xc9a080, cloth: 0x444444 });
  }
  r.root.scale.setScalar(1); return r;
}

export function buildBoss(id: string): Rig {
  let r: Rig;
  switch (id) {
    case 'bazuso': r = humanoid({ skin: 0xb08868, cloth: 0x2a2018, armor: 0x3a3a40, head: 'bucket', bulk: 1.5, belly: 1.2, hunch: 0.12, arm: 1.1, pauld: true, boots: 0x1a1410, legs: 0x2a2018 }); equip(r, 'hammer', 2.0); mk(gCyl(0.2, 0.2, 0.08), dsteel(), 0, 0.02, 0, r.hips); break;
    case 'adon': r = humanoid({ skin: 0xc9a080, cloth: 0x1c3a2a, armor: 0x8a8f98, head: 'full', plume: 0x1c6a3a, cape: 0x1c4a2e, pauld: true, knee: true, bulk: 1.15, tabard: 0x1c6a3a, legs: 0x70757d, boots: 0x222 }); equip(r, 'longspear', 1.0); break;
    case 'gennon': r = humanoid({ skin: 0xe0c0a0, cloth: 0x22305a, armor: 0x6a7a9a, hair: 0xd8d0c0, hairStyle: 'long', cape: 0x1a2a6a, pauld: true, bulk: 0.95, eye: 0x6ac0ff, legs: 0x1a2040, boots: 0x14182a }); equip(r, 'rapier', 1.2); { const d = weapon('dagger'); d.rotation.x = -1.2; r.lHand.add(d); } break;
    case 'zodd': r = humanoid({ skin: 0x8a6a50, cloth: 0x1a1a1e, armor: 0x24242a, head: 'horned', cape: 0x2a0a0a, pauld: true, knee: true, bulk: 1.3, eye: 0xff4020, legs: 0x18181c, boots: 0x111, ragged: true }); wingPair(r, 0x15101a, 4, 1.2, false, 0.5, true); equip(r, 'greatsword', 1.9); break;
    case 'griffith': r = buildGriffith('human'); break;
    case 'wyald': r = humanoid({ skin: 0x6a6a62, cloth: 0x3a3a34, bulk: 1.5, belly: 1.1, hunch: 0.35, arm: 1.5, eye: 0xffd020, headS: 0.9, boots: 0x44443c, legs: 0x4a4a42 }); for (let i = 0; i < 6; i++) mk(gCone(0.05, 0.25, 5), mat(0xc8c0a8), (i - 2.5) * 0.08, 0.5, -0.18, r.torso, -1.2); for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) mk(gCone(0.015, 0.14, 4), mat(0xc8c0a8), sx * (0.03 - i * 0.03), -0.04, 0.05, sx > 0 ? r.lHand : r.rHand, Math.PI); mk(gBox(0.2, 0.08, 0.04), dark(), 0, 0.05, 0.1, r.head); break;
    case 'rakshas': r = humanoid({ skin: 0x2a2030, cloth: 0x1a1226, armor: 0x2a1c3a, head: 'horned', pauld: true, eye: 0xff2a60, bulk: 1.05, cape: 0x120a1c, ragged: true, legs: 0x1a1226, boots: 0x0a0610 }); equip(r, 'saber', 1.5); for (const sx of [-1, 1]) for (const yy of [0.18, 0.4]) { const a = new Group(); a.position.set(sx * 0.3, yy, 0.05); r.torso.add(a); mk(gBox(0.09, 0.6, 0.09), mat(0x2a2030), 0, -0.3, 0, a).rotation.z = 0; const s = weapon('saber'); s.scale.setScalar(1.3); s.position.y = -0.6; s.rotation.x = -1.3; a.add(s); a.rotation.set(-0.4, 0, sx * (0.6 + yy)); } break;
    case 'grunbeld': r = humanoid({ skin: 0x5a1a14, cloth: 0x2a0a08, armor: 0x7a1c14, head: 'horned', cape: 0x1a0606, pauld: true, knee: true, bulk: 1.35, eye: 0xffa020, legs: 0x4a100c, boots: 0x1a0606 }); wingPair(r, 0x4a0e0a, 5, 1.4, false, 0.5, true); equip(r, 'greatsword', 2.0); mk(gBox(0.56, 0.05, 0.32), gold(), 0, 0.1, 0, r.torso); break;
    case 'femto': r = buildGriffith('femto'); break;
    case 'falcon': r = buildGriffith('falcon'); break;
    case 'conrad': { // massa encapuzada e inchada
      r = humanoid({ skin: 0x9a8a7a, cloth: 0x3a3230, bulk: 1.7, belly: 1.8, height: 0.95, hunch: 0.4, arm: 1.0, eye: 0xd0c0a0, headS: 0.85, boots: 0x2a2420, legs: 0x3a3230 });
      mk(gCone(0.22, 0.4, 7), mat(0x3a3230, { r: 1 }), 0, 0.22, -0.02, r.head);
      for (let i = 0; i < 5; i++) mk(gSph(0.12, 7), mat(0x8a7a6a, { r: 0.9 }), Math.sin(i * 1.3) * 0.3, 0.15 + (i % 3) * 0.14, 0.12, r.torso); // verrugas
      break;
    }
    case 'ubik': { // pequeno flutuante de óculos com tentáculos
      r = humanoid({ skin: 0xb8a890, cloth: 0x4a4440, bulk: 0.75, height: 0.7, headS: 1.5, eye: 0xfff0b0, hunch: 0.25, legs: 0x4a4440, boots: 0x3a3430, belly: 1.4 });
      r.flying = true; r.wingSpd = 4;
      for (const sx of [-1, 1]) mk(gTor(0.07, 0.015), mat(0xc9a13a, { r: 0.3, m: 0.9 }), sx * 0.07, 0.18, 0.16, r.head, 0, 0, 0); // óculos
      for (let i = 0; i < 4; i++) mk(gCone(0.05, 0.6, 5), mat(0x8a7a68, { r: 0.9 }), Math.sin(i * 1.6) * 0.2, -0.3, Math.cos(i * 1.6) * 0.15, r.hips, 2.8 + i * 0.1); // tentáculos
      break;
    }
    case 'slan': { // figura alada de cabelos longos
      r = humanoid({ skin: 0xe8d0c8, cloth: 0x2a1020, bulk: 0.9, height: 1.05, hair: 0x1a0c14, hairStyle: 'long', eye: 0xff2a60, legs: 0x2a1020, boots: 0x1a0a14 });
      r.flying = true; r.wingSpd = 3;
      wingPair(r, 0x3a1024, 5, 1.3, false, 0.5, true);
      for (let i = 0; i < 3; i++) mk(gBox(0.05, 0.5, 0.02), mat(0x2a1020, { r: 0.9 }), (i - 1) * 0.12, -0.2, 0.1, r.hips, 0.2 * (i - 1)); // faixas
      break;
    }
    case 'void0': { // cabeça exposta e manto
      r = humanoid({ skin: 0x6a6258, cloth: 0x14121a, bulk: 1.2, height: 1.1, headS: 1.6, eye: 0xffffff, hunch: 0.25, cape: 0x14121a, legs: 0x14121a, boots: 0x0c0a12, arm: 1.1 });
      mk(gSph(0.19, 12), mat(0x7a7268, { r: 0.7 }), 0, 0.2, -0.03, r.head).scale.set(1, 1.25, 1.1); // cérebro exposto
      for (let i = 0; i < 4; i++) mk(gBox(0.16, 0.012, 0.03), mat(0x3a352e), 0, 0.1 + i * 0.07, 0.165, r.head); // costuras
      mk(gBox(0.2, 0.03, 0.03), mat(0x0a0808), 0, 0.125, 0.17, r.head); // olhos costurados
      break;
    }
    case 'mozgus': {
      r = humanoid({ skin: 0xd8c0a8, cloth: 0xd8d0bc, armor: 0xcfc6ae, metal: false, bulk: 1.45, belly: 1.2, height: 1.05, arm: 1.1, boots: 0x2a2018, legs: 0xc8c0aa, headS: 1.05 });
      // cabeça quadrada e rosto severo de Mozgus
      mk(gBox(0.2, 0.2, 0.16), mat(0xd8c0a8), 0, 0.1, -0.01, r.head);
      mk(gBox(0.2, 0.03, 0.17), mat(0x3a2c20), 0, 0.17, 0, r.head); // franja reta
      for (const sx of [-1, 1]) mk(gBox(0.05, 0.015, 0.02), mat(0x2a2018), sx * 0.055, 0.14, 0.085, r.head); // sobrancelhas grossas
      mk(gBox(0.1, 0.02, 0.02), mat(0x5a3a30), 0, 0.03, 0.085, r.head);
      // hábito e estola
      const stole = mat(0x6a1a14, { r: 0.85 });
      mk(gBox(0.1, 0.62, 0.03), stole, 0.14, 0.18, 0.16, r.torso); mk(gBox(0.1, 0.62, 0.03), stole, -0.14, 0.18, 0.16, r.torso);
      mk(gBox(0.08, 0.26, 0.015), gold(), 0, 0.3, 0.17, r.torso); mk(gBox(0.22, 0.07, 0.015), gold(), 0, 0.37, 0.17, r.torso); // cruz
      // bíblia de ferro na mão
      const book = new Group(); mk(gBox(0.3, 0.42, 0.1), mat(0x3a332c, { r: 0.5, m: 0.5 }), 0, 0, 0, book); mk(gBox(0.06, 0.3, 0.11), gold(), 0, 0, 0, book); mk(gBox(0.22, 0.05, 0.11), gold(), 0, 0.08, 0, book);
      book.rotation.x = -1.3; r.wMount.add(book);
      // rodas de tortura às costas
      for (const sx of [-1, 1]) { const w = mk(gTor(0.34, 0.045), mat(0x4a4038, { r: 0.6, m: 0.4 }), sx * 0.3, 0.44, -0.26, r.torso); w.rotation.y = 0.5 * sx; for (let i = 0; i < 4; i++) mk(gBox(0.03, 0.62, 0.03), mat(0x5a5048, { r: 0.7 }), 0, 0, 0, w).rotation.z = i * 0.785; }
      break;
    }
    default: r = humanoid({ skin: 0xc9a080, cloth: 0x444444 });
  }
  return r;
}

// ---------- Mapeamento de materiais por instância (flash de dano) ----------
export function own(r: Rig) {
  const seen = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  r.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    let c = seen.get(src);
    if (!c) { c = src.clone(); c.userData.e = c.emissive.clone(); c.userData.ei = c.emissiveIntensity; seen.set(src, c); r.mats.push(c); }
    m.material = c;
  });
}
const fc = new THREE.Color();
export function flash(r: Rig, v: number, col = 0xff3010) {
  fc.set(col);
  for (const m of r.mats) { if (m.transparent) continue; if (v <= 0) { m.emissive.copy(m.userData.e); m.emissiveIntensity = m.userData.ei; } else { m.emissive.copy(fc); m.emissiveIntensity = v; } }
}
export function disposeRig(r: Rig) { r.mats.forEach((m) => m.dispose()); r.mats.length = 0; }

// ---------- Animação ----------
export interface AS { t: number; mv: number; run: boolean; atk: string; p: number; dodge: number; hit: number; dead: number; stun: boolean; block: boolean; fly: boolean; rage: boolean; }
export const newAS = (): AS => ({ t: 0, mv: 0, run: false, atk: '', p: 0, dodge: 0, hit: 0, dead: 0, stun: false, block: false, fly: false, rage: false });
type P11 = number[];
const IDLE: P11 = [0.1, 0, -0.12, -0.35, 0.1, 0, 0.12, -0.35, 0, 0, 0];
const ATT: Record<string, { A: P11; B: P11 }> = {
  l1: { A: [-2.6, -0.2, -0.3, -0.4, -1.3, 0, 0.5, -0.9, -0.9, -0.1, 0], B: [-0.5, 0.3, -0.1, -0.2, -0.7, 0.2, 0.4, -0.6, 0.9, 0.3, 0] },
  l2: { A: [-1.2, 0.8, -1.1, -0.3, -1.0, 0.4, 0.5, -0.8, 0.9, 0.0, 0], B: [-1.35, -0.7, -0.9, -0.2, -0.8, -0.3, 0.6, -0.8, -1.0, 0.1, 0] },
  l3: { A: [-3.1, 0, -0.2, -0.3, -2.8, 0, 0.2, -0.4, 0, -0.3, 0], B: [0.25, 0, -0.1, -0.1, 0.1, 0, 0.1, -0.2, 0, 0.55, 0] },
  heavy: { A: [-3.2, 0, -0.45, -0.5, -2.9, 0, 0.4, -0.5, -0.5, -0.4, 0], B: [0.4, 0, -0.1, -0.1, 0.2, 0, 0.1, -0.2, 0.3, 0.7, 0] },
  thrust: { A: [-1.1, 0.3, -0.3, -1.6, -0.7, 0, 0.5, -1.0, -0.6, 0, 0], B: [-1.55, 0, -0.1, -0.05, -0.9, 0, 0.3, -0.5, 0.4, 0.2, 0] },
  slam: { A: [-3.0, 0, -0.3, -0.4, -3.0, 0, 0.3, -0.4, 0, -0.35, 0], B: [0.3, 0, -0.2, -0.1, 0.3, 0, 0.2, -0.1, 0, 0.7, 0] },
  cast: { A: [-1.4, 0, -0.5, -0.3, -1.4, 0, 0.5, -0.3, 0, -0.1, 0], B: [-2.7, 0, -0.8, -0.1, -2.7, 0, 0.8, -0.1, 0, -0.3, 0] },
  spin: { A: [-1.5, 0, -1.3, -0.1, -1.5, 0, 1.3, -0.1, 0, 0, 0], B: [-1.5, 0, -1.3, -0.1, -1.5, 0, 1.3, -0.1, 0, 0, 0] },
  leap: { A: [0.6, 0, -0.3, -0.6, 0.6, 0, 0.3, -0.6, 0, 0.5, 0], B: [-2.8, 0, -0.4, -0.2, -2.8, 0, 0.4, -0.2, 0, -0.2, 0] },
  shootL: { A: [0.1, 0, -0.15, -0.35, -1.5, 0, 0.05, -0.05, 0.2, 0, 0], B: [0.1, 0, -0.15, -0.35, -1.55, 0, 0.05, -0.05, 0.2, -0.05, 0] },
  shootR: { A: [-1.5, 0, -0.05, -0.05, 0.1, 0, 0.15, -0.35, -0.2, 0, 0], B: [-1.55, 0, -0.05, -0.05, 0.1, 0, 0.15, -0.35, -0.2, -0.05, 0] },
  shootE: { A: [-1.2, 0.2, -0.1, -0.8, -1.0, 0.3, 0.2, -1.2, 0, 0, 0], B: [-1.4, 0.1, -0.1, -0.2, -1.2, 0.3, 0.2, -0.9, 0, -0.1, 0] },
  rageRoar: { A: [-0.5, 0, -0.9, -0.3, -0.5, 0, 0.9, -0.3, 0, 0.1, 0], B: [-0.2, 0, -1.2, -0.1, -0.2, 0, 1.2, -0.1, 0, -0.4, 0] },
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => k * k * (3 - 2 * k);
const out: P11 = new Array(11).fill(0);
export function animate(r: Rig, s: AS) {
  const h = r.h / 1.85;
  const f = s.t * (s.run ? 12 : 8), amp = s.mv * (s.run ? 1.0 : 0.6);
  const sw = Math.sin(f) * amp;
  r.body.rotation.set(0, 0, 0); r.body.position.y = 0.9 * h; r.body.position.x = 0;
  const pose: P11 = IDLE;
  for (let i = 0; i < 11; i++) out[i] = pose[i];
  let lh = sw, rh = -sw, lk = Math.max(0, -Math.sin(f + 0.8)) * amp * 1.4, rk = Math.max(0, Math.sin(f + 0.8)) * amp * 1.4;
  const breathe = Math.sin(s.t * 2) * 0.02;
  out[9] = r.hunch + (s.run ? 0.22 * s.mv : 0) + breathe;
  out[0] += -sw * 0.35; out[4] += sw * 0.9; out[3] -= s.run ? 0.5 * s.mv : 0; out[7] -= s.run ? 0.9 * s.mv : 0;
  r.hips.position.y = 0.05 * h + Math.abs(Math.sin(f)) * 0.04 * amp;
  r.hips.rotation.y = Math.sin(f) * 0.12 * amp;
  if (s.fly) { lh = 0.15; rh = -0.1; lk = 0.3; rk = 0.5; r.body.position.y = 0.9 * h + Math.sin(s.t * 2) * 0.1; r.body.rotation.x = 0.1 + s.mv * 0.3; }
  if (s.atk) {
    const T = ATT[s.atk] || ATT.l1, p = s.p;
    for (let i = 0; i < 11; i++) {
      if (p < 0.45) out[i] = lerp(IDLE[i], T.A[i], ease(p / 0.45));
      else if (p < 0.65) { const k = (p - 0.45) / 0.2; out[i] = lerp(T.A[i], T.B[i], 1 - (1 - k) * (1 - k)); }
      else out[i] = lerp(T.B[i], IDLE[i], ease((p - 0.65) / 0.35));
    }
    out[9] += r.hunch;
    if (!s.fly) { lh = -0.3; rh = 0.3; lk = 0.5; rk = 0.2; }
    if (s.atk === 'spin') r.body.rotation.y = ease(Math.min(1, s.p)) * Math.PI * 4;
    if (s.atk === 'leap') { const q = Math.max(0, (p - 0.45) / 0.55); r.body.position.y += Math.sin(q * Math.PI) * 0.8 * h; lk = rk = p < 0.45 ? 1.2 * (p / 0.45) : 0.4; lh = rh = p < 0.45 ? -0.8 * (p / 0.45) : -0.2; }
    if (s.atk === 'slam' || s.atk === 'heavy' || s.atk === 'l3') { const k = p > 0.45 && p < 0.7 ? Math.sin((p - 0.45) / 0.25 * Math.PI) : 0; r.hips.position.y -= k * 0.1; }
  }
  if (s.block) { out[0] = -1.4; out[1] = 0.6; out[2] = -0.3; out[3] = -1.9; out[4] = -1.3; out[5] = -0.4; out[6] = 0.3; out[7] = -1.9; out[8] = 0.2; lh = 0.2; rh = -0.3; }
  if (s.stun) { out[0] = 0.4; out[4] = 0.4; out[9] = 0.5 + Math.sin(s.t * 14) * 0.08; out[3] = -0.1; out[7] = -0.1; }
  if (s.rage && !s.atk) { out[2] -= 0.15; out[6] += 0.15; out[9] += 0.12 + Math.sin(s.t * 14) * 0.04; }
  let hitK = 0;
  if (s.hit > 0) { hitK = Math.sin(s.hit * Math.PI); out[9] -= 0.55 * hitK; out[0] += 0.5 * hitK; out[4] += 0.5 * hitK; r.head.rotation.x = -0.4 * hitK; } else r.head.rotation.x = 0;
  if (s.dodge > 0) {
    const p = s.dodge;
    r.body.rotation.x = p * Math.PI * 2; r.body.position.y = 0.9 * h - 0.4 * h * Math.sin(p * Math.PI);
    lh = rh = -1.3; lk = rk = 1.9; out[0] = -0.9; out[4] = -0.9; out[3] = -1.5; out[7] = -1.5; out[9] = 0;
  }
  r.lHip.rotation.x = lh; r.rHip.rotation.x = rh; r.lKn.rotation.x = lk; r.rKn.rotation.x = rk;
  r.rSh.rotation.set(out[0], out[1], out[2]); r.rEl.rotation.x = out[3];
  r.lSh.rotation.set(out[4], out[5], out[6]); r.lEl.rotation.x = out[7];
  r.torso.rotation.set(out[9], out[8], out[10]);
  if (s.dead > 0) {
    const k = ease(Math.min(1, s.dead));
    r.body.rotation.x = -Math.PI / 2 * k; r.body.position.y = lerp(0.9 * h, 0.2 * h, k);
    r.body.rotation.y = 0; r.lSh.rotation.z = 0.8 * k; r.rSh.rotation.z = -0.8 * k; r.lHip.rotation.x = 0.2 * k; r.rHip.rotation.x = -0.1 * k;
  }
  if (r.cape) r.cape.rotation.x = 0.1 + s.mv * 0.55 + Math.sin(s.t * 3) * 0.05 + (s.dodge > 0 ? 0.6 : 0);
  if (r.x.cloakCape) r.x.cloakCape.rotation.x = 0.08 + s.mv * 0.5 + Math.sin(s.t * 2.5) * 0.05;
  if (r.wings.length) { const fl = Math.sin(s.t * r.wingSpd) * (r.wingSpd > 10 ? 0.6 : 0.25); r.wings[0].rotation.z = -fl; r.wings[1].rotation.z = fl; }
  if (r.x.halo) r.x.halo.rotation.z += 0.02;
  if (r.x.orb) r.x.orb.scale.setScalar(1 + Math.sin(s.t * 5) * 0.2);
}
