import { useEffect, useRef, useState } from 'react';
import { Engine, HudState, EndResult } from '../game/engine';
import { Save, saveSlot, useSettings } from '../save';
import { t, keyLabel } from '../i18n';
import { Bar, Btn, Modal, AllyBars } from './common';
import Shop from './Shop';
import SettingsScreen from './SettingsScreen';
import * as A from '../audio';
import { ALLY_ICON, ALLY_COST, MAX_ACTIVE } from '../data';
import { dlgKeys, campStage, TOPICS, MISSIONS, bountiesFor } from '../camp';

const npcName = (id: string) => (id === 'godo' ? 'Godo' : id === 'gutsai' || id === 'guts' ? 'Guts' : id === 'ivalera' ? 'Ivalera' : id === 'rickert' ? 'Rickert' : id === 'skull' ? '???' : id === 'priest' ? t('npc.priest') : id === 'guard' ? t('npc.guard') : id.startsWith('vil') ? t('npc.villager') : t('ally.' + id));
const HIREABLE = ['serpico', 'schierke', 'farnese', 'roderick'];

const BIG = ['m_boss_down', 'm_rage', 'm_behelit2', 'm_boss_appear', 'm_behelit1', 'm_dead', 'm_phase', 'm_poise'];
let mid = 0;

export default function Game(p: { level: number; save: Save; onSave: (s: Save) => void; onEnd: (r: EndResult) => void; onExit: () => void; mode?: 'campaign' | 'arena' | 'survival' | 'dungeon' | 'training' | 'camp' | 'defense'; onDepart?: () => void; onPlayDefense?: () => void }) {
  const st = useSettings();
  const host = useRef<HTMLDivElement>(null), mini = useRef<HTMLCanvasElement>(null), eng = useRef<Engine | null>(null), saveRef = useRef(p.save);
  saveRef.current = p.save;
  const [hud, setHud] = useState<HudState | null>(null);
  const [msgs, setMsgs] = useState<{ id: number; text: string; big: boolean }[]>([]);
  const [pause, setPause] = useState<null | 'pause' | 'shop' | 'settings'>(null);
  const [leave, setLeave] = useState(false);
  const [banner, setBanner] = useState(true);
  const [err, setErr] = useState('');
  const [quiz, setQuiz] = useState<number | null>(null); // índice da pergunta do Behelit falante
  const [quizMsg, setQuizMsg] = useState('');
  const [dlg, setDlg] = useState<{ npc: string; i: number; topic: string | null } | null>(null); // conversa do acampamento
  const [depart, setDepart] = useState(false);
  const [board, setBoard] = useState<null | 'missions' | 'wanted' | 'defense'>(null);
  const [post, setPost] = useState<null | { i: number; unit: string | null }>(null);
  const [defTalk, setDefTalk] = useState<null | { id: string; cost: number; hired: boolean; state: 'ask' | 'nocoins' | 'done' }>(null);

  useEffect(() => {
    let e: Engine | null = null;
    try {
      e = new Engine(host.current!, p.level, saveRef.current, {
        hud: setHud,
        msg: (k, pr) => {
          const q = { ...(pr || {}) }; if (q.id) q.name = t('boss.' + q.id);
          const text = t(k.replace('_', '.'), q), id = ++mid;
          setMsgs((m) => (m.some((x) => x.text === text) ? m : [...m.slice(-3), { id, text, big: BIG.includes(k) }])); // nunca empilhar a mesma mensagem
          setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), BIG.includes(k) ? 3200 : 3600);
        },
        end: (r) => p.onEnd(r),
        pause: (_b, why) => setPause(why as any),
        secret: (k, pr) => {
          const s = saveRef.current, n: Save = JSON.parse(JSON.stringify(s));
          if (k === 'f5') n.secret.f5 = { ...n.secret.f5, ...pr };
          else if (k === 'bLvl') { if (!n.secret.bLvls.includes(pr.lv)) n.secret.bLvls.push(pr.lv); }
          else if (k === 'fLvl') { if (!n.secret.fLvls.includes(pr.lv)) n.secret.fLvls.push(pr.lv); }
          else if (k === 'g1') { n.secret.g1 = true; if (!n.allies.includes('griffith1')) n.allies.push('griffith1'); }
          else if (k === 'g2') { n.secret.g2 = true; if (!n.allies.includes('griffith2')) n.allies.push('griffith2'); }
          else if (k === 'quiz') { setQuiz(0); eng.current?.setPaused(true); return; }
          else if (k === 'talk') { setDlg({ npc: pr.id, i: 0, topic: null }); eng.current?.setPaused(true); return; }
          else if (k === 'depart') { setDepart(true); eng.current?.setPaused(true); return; }
          else if (k === 'board') { setBoard('missions'); eng.current?.setPaused(true); return; }
          else if (k === 'post') { setPost({ i: pr.i, unit: pr.unit }); return; }
          else if (k === 'defTalk') { setDefTalk({ id: pr.id, cost: pr.cost, hired: pr.hired, state: 'ask' }); return; }
          else if (k === 'campEgg') { if (!n.side.campEggs.includes(pr.i)) { n.side.campEggs.push(pr.i); n.points += 40; n.totalEarned += 40; } }
          else if (k === 'egg') { if (!n.side.eggs.includes(pr.lv)) { n.side.eggs.push(pr.lv); n.points += 30; n.totalEarned += 30; } }
          p.onSave(n); saveSlot(n);
        },
      }, { hero: saveRef.current.hero, mode: p.mode || 'campaign' });
      eng.current = e; e.setMinimap(mini.current);
    } catch (er) { setErr(String(er)); }
    const bt = setTimeout(() => setBanner(false), 4600);
    const auto = setInterval(() => saveSlot(saveRef.current), 15000);
    const vis = () => { if (document.hidden) saveSlot(saveRef.current); };
    const unload = () => saveSlot(saveRef.current);
    document.addEventListener('visibilitychange', vis); window.addEventListener('beforeunload', unload);
    return () => { clearTimeout(bt); clearInterval(auto); document.removeEventListener('visibilitychange', vis); window.removeEventListener('beforeunload', unload); e?.dispose(); eng.current = null; };
    // eslint-disable-next-line
  }, [p.level]);

  useEffect(() => { eng.current?.applySettings(); A.applyVolumes(); }, [st]);

  const resume = () => { setPause(null); eng.current?.setPaused(false); };
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (!pause) return;
      const k = st.keys;
      if (e.code === 'Escape' || e.code === k.pause || (pause === 'shop' && e.code === k.shop)) { e.preventDefault(); if (pause === 'pause') resume(); else setPause('pause'); }
    };
    window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd);
    // eslint-disable-next-line
  }, [pause, st.keys]);

  const keyOf = (id: string) => ({ move: 'W A S D', run: keyLabel(st.keys.run), dodge: keyLabel(st.keys.dodge), light: keyLabel(st.keys.light), heavy: keyLabel(st.keys.heavy), cannon: keyLabel(st.keys.cannon), xbow: keyLabel(st.keys.xbow), rage: keyLabel(st.keys.rage), heal: keyLabel(st.keys.heal) } as Record<string, string>)[id];
  const h = hud;
  const lowHp = h ? h.hp / h.maxHp : 1;

  return (
    <div className="relative h-full w-full bg-black">
      <div ref={host} className="absolute inset-0" />
      {err && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black p-8 text-center text-red-300">WebGL error: {err}<br /><Btn onClick={p.onExit}>{t('back')}</Btn></div>}
      {/* vinhetas */}
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 ${120 + (1 - lowHp) * 160}px rgba(${lowHp < 0.3 ? '200,0,0' : '0,0,0'},${lowHp < 0.3 ? 0.6 : 0.5})` }} />
      {h?.rageOn && <div className="pointer-events-none absolute inset-0 pulse" style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(220,30,10,.4) 100%)' }} />}
      {h?.eagle && <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(255,200,60,.22) 100%)' }} />}
      {h?.cine === 'eclipse' && <div className="pointer-events-none absolute inset-0 bg-red-950/50 transition-opacity" style={{ animation: 'fade-in 6s both' }} />}
      {h && (h.cine === 'intro' || h.cine === 'bossdown' || h.cine === 'eclipse') && <><div className="pointer-events-none absolute inset-x-0 top-0 h-[9%] bg-black" /><div className="pointer-events-none absolute inset-x-0 bottom-0 h-[9%] bg-black" /></>}

      {h && !h.cine.startsWith('eclipse') && (
        <>
          {/* esquerda: barras */}
          <div className="pointer-events-none absolute left-4 top-4 w-[min(420px,50vw)] select-none">
            <Bar v={h.hp} max={h.maxHp} color="linear-gradient(180deg,#e03030,#8a1010)" h={16} w={Math.min(420, 160 + h.maxHp)} label={`${t('hud.hp')} ${Math.ceil(h.hp)}/${h.maxHp}`} />
            <div className="mt-1"><Bar v={h.stam} max={h.maxStam} color={h.exhausted ? 'linear-gradient(180deg,#888,#444)' : 'linear-gradient(180deg,#5ad06a,#1e7a30)'} h={11} w={Math.min(380, 140 + h.maxStam)} /></div>
            <div className="mt-1"><Bar v={h.rage} max={100} color={h.rageOn ? 'linear-gradient(180deg,#ff6a20,#c01000)' : 'linear-gradient(180deg,#d08020,#7a3a08)'} h={9} w={260} /></div>
            <div className="mt-1 flex items-center gap-2 text-[10px] tracking-widest">
              {h.buffGuts && <span className="border border-sky-700/60 bg-black/60 px-1.5 py-0.5 text-sky-300" title={t('buff.schierke.d')}>🔮 {t('buff.schierke')}</span>}
              {h.buffCaska && h.hero === 'caska' && <span className="border border-amber-700/60 bg-black/60 px-1.5 py-0.5 text-amber-200" title={t('buff.farnese.d')}>✝️ {t('buff.farnese')}</span>}
              {h.ivalera && <span className={`border bg-black/60 px-1.5 py-0.5 ${h.ivalera.active ? 'border-pink-400 text-pink-200' : h.ivalera.cd > 0 ? 'border-zinc-700 text-zinc-400' : 'border-pink-700/60 text-pink-300'}`}>🧚‍♀️ {t('hud.ivalera')}{h.ivalera.cd > 0 ? ` ${Math.ceil(h.ivalera.cd)}s` : ''}</span>}
              {h.difficulty && <span className="border border-white/10 bg-black/60 px-1.5 py-0.5 text-[#a89880]">{t('diff.' + h.difficulty)}</span>}
            </div>
            {h.allyBars && h.allyBars.length > 0 && <div className="mt-2"><AllyBars title={t('hud.allies')} bars={h.allyBars} /></div>}
            <div className="mt-1 flex items-center gap-3 text-[11px] tracking-widest text-[#d8c8b0]">
              {h.rageOn ? <span className="pulse font-bold text-orange-400">{t('hud.rageOn')} {h.rageLeft.toFixed(1)}s</span> : h.rage >= h.rageNeed ? <span className="pulse font-bold text-orange-300">{t('hud.rageReady', { k: keyLabel(st.keys.rage) })}</span> : <span className="text-[#8a7a68]">{t('hud.rage')} {Math.floor(h.rage)}%</span>}
              {h.exhausted && <span className="text-zinc-400">{t('hud.exhausted')}</span>}
              {h.guard && <span className="text-sky-300">{t('hud.guard')}</span>}
              {h.shield > 0 && <span className="text-yellow-200">✝ {Math.ceil(h.shield)}</span>}
              {h.armor && <span className="text-red-400">⛓ {t('hud.armor')}</span>}
              {h.lock && <span className="text-amber-300">◎</span>}
            </div>
          </div>
          {/* direita: minimapa e objetivo */}
          <div className="pointer-events-none absolute right-4 top-4 flex w-44 flex-col items-end gap-2">
            <canvas ref={(c) => { mini.current = c; eng.current?.setMinimap(c); }} width={170} height={170} className="h-[170px] w-[170px] rounded-full shadow-[0_0_20px_#000]" />
            <div className="panel w-full px-3 py-2 text-right text-xs">
              <div className="text-[9px] uppercase tracking-[0.25em] text-[#c9a870]">{t('hud.obj')}</div>
              <div>{t(h.obj.k.replace('_', '.'), { a: h.obj.a, b: h.obj.b })}</div>
              <div className="mt-1 text-amber-300">🪙 {h.points}</div>
            </div>
          </div>
          {/* munição (somente Guts) */}
          <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-end gap-1 text-xs tracking-widest" style={{ display: h.hero === 'caska' ? 'none' : undefined }}>
            <div className="panel flex items-center gap-2 px-3 py-1.5"><span>{t('hud.cannon')} [{keyLabel(st.keys.cannon)}]</span>{[0, 1, 2].map((i) => <span key={i} className={`inline-block h-3 w-3 rounded-full border border-black ${i < h.cannon ? 'bg-orange-500 shadow-[0_0_6px_#ff7a20]' : 'bg-zinc-800'}`} />)}{h.cannon < 3 && <span className="w-10"><Bar v={1 - h.cannonCd} max={1} color="#ff7a20" h={4} /></span>}</div>
            <div className="panel flex items-center gap-2 px-3 py-1.5"><span>{t('hud.bolts')} [{keyLabel(st.keys.xbow)}]</span><b className={h.reloading ? 'pulse text-yellow-300' : ''}>{h.reloading ? t('hud.reload') : `${h.bolts}/12`}</b></div>
          </div>
          {/* habilidades */}
          <div className="pointer-events-none absolute bottom-4 left-4 flex gap-2">
            {h.skills.map((s) => (
              <div key={s.id} className={`relative flex h-12 w-12 items-center justify-center border bg-black/70 text-xl ${s.on ? 'border-amber-300 shadow-[0_0_10px_#ffd060]' : 'border-amber-800/60'}`} title={s.id}>
                {s.id === 'puck' ? '🧚' : ALLY_ICON[s.id]}
                {s.cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: Math.min(100, (s.cd / s.max) * 100) + '%' }} />}
                {s.cd > 0 && <span className="absolute text-[11px] font-bold text-white">{Math.ceil(s.cd)}</span>}
                {s.id === 'puck' && <span className="absolute -bottom-4 text-[9px] text-[#c9a870]">{keyLabel(st.keys.heal)}</span>}
              </div>
            ))}
          </div>
          {/* chefe */}
          {h.boss && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 w-[min(640px,60vw)] -translate-x-1/2 text-center">
              <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-[#f0d8b0] drop-shadow">{t('boss.' + h.boss.name)} <span className="ml-2 text-[10px] text-red-400">{t('hud.phase')} {h.boss.phase}/{h.boss.phases}</span></div>
              <Bar v={h.boss.hp} max={h.boss.max} color="linear-gradient(180deg,#d02020,#6a0808)" h={14} />
            </div>
          )}
          {/* tutorial */}
          {h.tut && p.level === 1 && (
            <div className="pointer-events-none absolute left-4 top-40 max-w-xs panel p-3 text-sm fade-in">
              <div className="mb-1 text-[10px] uppercase tracking-[0.3em] text-amber-300">{t('tut.title')} {h.tut.i + 1}/{h.tut.n}</div>
              {t('tut.' + h.tut.id, { k: keyOf(h.tut.id) })}
            </div>
          )}
          {h.prompt && <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 panel px-4 py-2 text-sm">{h.prompt.startsWith('p_talk:') ? (h.prompt.includes('chest') ? t('p.chest', { k: keyLabel(st.keys.interact) }) : t('p.talk', { k: keyLabel(st.keys.interact), n: npcName(h.prompt.slice(7)) })) : t(h.prompt.replace('_', '.'), { k: keyLabel(st.keys.interact) })}</div>}
          {h.secret && (
            <div className="pointer-events-none absolute left-4 top-[7.5rem] panel px-3 py-1.5 text-[11px] tracking-wider text-[#d8c8b0]">
              {h.secret.k === 'f5' && <>🪶 {h.secret.feathers}/5 · 🔥 {h.secret.bonfires ? '✔' : '…'} · 🚩 {h.secret.flag ? '✔' : '…'} · 🦅 {h.secret.lured ? '✔' : t('sec.lure')}</>}
              {h.secret.k === 'g2p' && <>🥚 {h.secret.b}/5 · 🚩 {h.secret.f}/5</>}
              {h.secret.k === 'moz' && <>⛪ {t('sec.moz', { n: h.secret.left })}</>}
            </div>
          )}
        </>
      )}
      {/* defesa da vila: barreira + preparação */}
      {h?.defense && (
        <div className="absolute left-1/2 top-2 w-[min(460px,58vw)] -translate-x-1/2 text-center">
          <div className="pointer-events-none mb-0.5 text-[10px] uppercase tracking-[0.3em] text-purple-300">{t('def.barrier')} — {t('m.wave', { n: h.defense.wave })}/{h.defense.maxW}{h.defense.left > 0 && <span className="ml-2 text-red-300">⚔ {h.defense.left}</span>}</div>
          <div className="pointer-events-none"><Bar v={h.defense.barrier} max={h.defense.max} color="linear-gradient(180deg,#9a7aff,#4a2a9a)" h={10} label={`${h.defense.barrier}/${h.defense.max}`} /></div>
          <div className="pointer-events-none mt-0.5"><Bar v={h.defense.vhp} max={h.defense.vmax} color="linear-gradient(180deg,#d0a050,#7a5a20)" h={8} label={`${t('def.vhp')} ${h.defense.vhp}/${h.defense.vmax}`} /></div>
          {h.defense.prep > 0 && (
            <div className="mt-1 flex items-center justify-center gap-2 text-xs text-amber-300">
              <span className="pointer-events-none">{t('def.prep', { s: Math.ceil(h.defense.prep) })}</span>
              <Btn className="!px-2 !py-0.5 !text-[10px]" onClick={() => eng.current?.skipPrep()}>{t('def.skip')}</Btn>
            </div>
          )}
          {/* contratação agora acontece conversando com os aliados pela vila (E) */}
        </div>
      )}
      {/* contratação por conversa: diálogo individual do aliado na defesa */}
      {defTalk && (() => {
        const d = defTalk, close = () => setDefTalk(null);
        const line = d.hired || d.state === 'done' ? t(`defhire.${d.id}.ok`) : d.state === 'nocoins' ? t(`defhire.${d.id}.poor`) : t(`defhire.${d.id}.ask`);
        return (
          <div className="absolute inset-x-0 bottom-0 z-40 fade-in">
            <div className="mx-auto mb-6 w-full max-w-xl panel p-5">
              <div className="mb-1 flex items-center gap-2"><span className="text-2xl">{ALLY_ICON[d.id] || '🗨️'}</span><b className="tracking-[0.2em] text-amber-200">{npcName(d.id)}</b></div>
              <p className="min-h-10 text-[15px] italic leading-relaxed text-[#e8dccb]">“{line}”</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!d.hired && d.state === 'ask' && (
                  <Btn kind="primary" className="!px-3 !py-1 !text-xs" onClick={() => {
                    const ok = eng.current?.hireAlly(d.id);
                    setDefTalk({ ...d, state: ok ? 'done' : 'nocoins', hired: !!ok });
                  }}>⚔ {t('defhire.yes', { c: d.cost })}</Btn>
                )}
                {!d.hired && d.state === 'ask' && <Btn className="!px-3 !py-1 !text-xs" onClick={close}>{t('defhire.no')}</Btn>}
                {(d.hired || d.state !== 'ask') && <Btn kind="primary" className="!px-3 !py-1 !text-xs" onClick={close}>{t('close')}</Btn>}
              </div>
            </div>
          </div>
        );
      })()}
      {/* posto de defesa: contratar soldado/arqueiro */}
      {post && (
        <div className="absolute inset-x-0 bottom-24 z-40 flex justify-center fade-in">
          <div className="panel flex items-center gap-2 p-3">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c9a870]">{t('def.post')}:</span>
            <Btn kind="primary" className="!px-3 !py-1 !text-xs" onClick={() => { eng.current?.deployAt(post.i, 'soldier'); setPost(null); }}>🛡️ {t('def.soldier')} · 60</Btn>
            <Btn kind="primary" className="!px-3 !py-1 !text-xs" onClick={() => { eng.current?.deployAt(post.i, 'archer'); setPost(null); }}>🏹 {t('def.archer')} · 80</Btn>
            {post.unit && <Btn className="!px-3 !py-1 !text-xs" onClick={() => { eng.current?.upgradePost(post.i); setPost(null); }}>⬆ {t('def.upgrade')} · 50</Btn>}
            {post.unit && <Btn kind="danger" className="!px-3 !py-1 !text-xs" onClick={() => { eng.current?.deployAt(post.i, null); setPost(null); }}>{t('def.remove')}</Btn>}
            <Btn className="!px-3 !py-1 !text-xs" onClick={() => setPost(null)}>{t('close')}</Btn>
          </div>
        </div>
      )}
      {/* quadro de missões e procurados */}
      {board && (() => {
        const s = p.save, lv = Math.min(10, s.current);
        const close = () => { setBoard(null); eng.current?.setPaused(false); };
        const pick = (patch: Partial<Save['side']>) => { const n: Save = JSON.parse(JSON.stringify(s)); n.side = { ...n.side, ...patch, forLvl: lv }; p.onSave(n); saveSlot(n); A.sfx('buy'); };
        return (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 fade-in">
            <div className="panel w-full max-w-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="title-glow text-xl tracking-[0.25em]">{t('board.title')} — {lv}. {t(`lv.${lv}.t`)}</h2>
                <div className="flex gap-2">
                  <Btn kind={board === 'missions' ? 'primary' : undefined} className="!px-3 !py-1 !text-xs" onClick={() => setBoard('missions')}>{t('board.missions')}</Btn>
                  <Btn kind={board === 'wanted' ? 'primary' : undefined} className="!px-3 !py-1 !text-xs" onClick={() => setBoard('wanted')}>{t('board.wanted')}</Btn>
                  {p.onPlayDefense && <Btn kind={board === 'defense' ? 'primary' : undefined} className="!px-3 !py-1 !text-xs" onClick={() => setBoard('defense')}>🏰 {t('mode.defense')}</Btn>}
                </div>
              </div>
              {board === 'missions' && (
                <div className="flex flex-col gap-2">
                  {MISSIONS.map((m) => {
                    const on = s.side.mission === m.id && s.side.forLvl === lv;
                    return (
                      <div key={m.id} className={`flex items-center gap-3 border p-3 ${on ? 'border-amber-500 bg-red-950/40' : 'border-white/10 bg-black/30'}`}>
                        <div className="flex-1"><b className="text-sm tracking-wide">{t('msn.' + m.id)}</b><div className="text-[11px] text-[#b8a890]">{t('msn.' + m.id + '.d')}</div><div className="text-[10px] text-amber-300">🪙 {m.reward}</div></div>
                        <Btn kind={on ? 'danger' : 'primary'} className="!px-3 !py-1 !text-xs" onClick={() => pick({ mission: on ? null : m.id })}>{on ? t('board.drop') : t('board.take')}</Btn>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-[#8a7a68]">{t('board.note')}</p>
                </div>
              )}
              {board === 'wanted' && (
                <div className="grid gap-2 md:grid-cols-3">
                  {bountiesFor(lv).map((b) => {
                    const done = s.side.bountiesDone.includes(b.id), on = s.side.bounty === b.id && s.side.forLvl === lv;
                    return (
                      <div key={b.id} className={`border p-3 text-center ${on ? 'border-amber-500 bg-red-950/40' : 'border-amber-900/50 bg-[#1a120c]'} ${done ? 'opacity-50' : ''}`} style={{ backgroundImage: 'linear-gradient(180deg, rgba(90,60,30,.25), transparent)' }}>
                        <div className="text-[9px] uppercase tracking-[0.4em] text-[#c9a870]">{t('board.wantedTag')}</div>
                        <div className="my-1 text-4xl">💀</div>
                        <b className="block text-sm">{t('bounty.' + b.id)}</b>
                        <div className="text-[10px] text-[#b8a890]">{t('bounty.' + b.id + '.d')}</div>
                        <div className="mt-1 text-[10px] text-red-300">{t('board.danger')}: {'☠'.repeat(Math.min(5, Math.round(b.hpMul)))}</div>
                        <div className="text-xs text-amber-300">🪙 {b.reward}</div>
                        {done ? <div className="mt-1 text-[10px] text-emerald-400">{t('board.done')}</div>
                          : <Btn kind={on ? 'danger' : 'primary'} className="mt-1 !px-3 !py-1 !text-xs" onClick={() => pick({ bounty: on ? null : b.id })}>{on ? t('board.drop') : t('board.take')}</Btn>}
                      </div>
                    );
                  })}
                </div>
              )}
              {board === 'defense' && (
                <div className="text-center">
                  <div className="my-3 text-5xl">🏰</div>
                  <p className="mb-1 text-lg font-bold text-amber-200">{t('mode.defense')}</p>
                  <p className="mb-3 text-sm text-[#d8c8b0]">{t('def.rules1')}</p>
                  <p className="mb-4 text-[11px] text-[#a89880]">{t('def.rules2')}</p>
                  <Btn kind="primary" onClick={() => { close(); p.onPlayDefense?.(); }}>{t('camp.start')}</Btn>
                </div>
              )}
              <div className="mt-3 text-right"><Btn onClick={close}>{t('close')}</Btn></div>
            </div>
          </div>
        );
      })()}
      {/* conversa do acampamento */}
      {dlg && (() => {
        const s = p.save, stage = campStage(s);
        // árvore de tópicos PRÓPRIA de cada personagem (corrige falas trocadas entre NPCs)
        const npcKey = dlg.npc === 'gutsai' ? 'guts' : dlg.npc.startsWith('vil') ? 'villager' : dlg.npc;
        const lines = dlgKeys(npcKey, stage, s.hero), line = lines[Math.min(dlg.i, lines.length - 1)];
        const hire = HIREABLE.includes(dlg.npc) && !s.allies.includes(dlg.npc);
        const cost = ALLY_COST[dlg.npc] || 0, canHire = hire && s.points >= cost;
        const active = s.active.includes(dlg.npc), nAct = s.active.filter((a) => a !== 'puck').length;
        const close = () => { setDlg(null); eng.current?.setPaused(false); };
        const has = (k: string) => t(k) !== k;
        const topics = (TOPICS[npcKey] || []).filter((tp) => has(`q.${npcKey}.${tp}`));
        const ansKey = dlg.topic ? (stage === 'post' && has(`a.${npcKey}.${dlg.topic}.post`) ? `a.${npcKey}.${dlg.topic}.post` : `a.${npcKey}.${dlg.topic}`) : '';
        return (
          <div className="absolute inset-x-0 bottom-0 z-40 fade-in">
            <div className="mx-auto mb-6 w-full max-w-2xl panel p-5">
              <div className="mb-1 flex items-center gap-2"><span className="text-2xl">{ALLY_ICON[dlg.npc] || (dlg.npc === 'godo' ? '🔨' : dlg.npc === 'rickert' ? '⚒️' : dlg.npc === 'skull' ? '💀' : '🗨️')}</span><b className="tracking-[0.2em] text-amber-200">{npcName(dlg.npc)}</b></div>
              <p className="min-h-12 text-[15px] italic leading-relaxed text-[#e8dccb]">“{dlg.topic ? t(ansKey) : t(line)}”</p>
              {/* escolhas de resposta específicas do personagem */}
              {!dlg.topic && (
                <div className="mt-2 flex flex-col gap-1">
                  {topics.map((tp, ix) => (
                    <button key={tp} className="border border-white/10 bg-black/40 px-3 py-1.5 text-left text-[13px] text-[#d8c8b0] transition hover:border-amber-600/60 hover:bg-red-950/30" onClick={() => { A.sfx('ui'); setDlg({ ...dlg, topic: tp }); }}>
                      <span className="mr-1 text-amber-500/80">{ix + 1}.</span> “{t(`q.${npcKey}.${tp}`)}”
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {dlg.topic && <Btn kind="primary" className="!px-3 !py-1 !text-xs" onClick={() => setDlg({ ...dlg, topic: null })}>{t('dlg.back')}</Btn>}
                {!dlg.topic && dlg.i < lines.length - 1 && <Btn kind="primary" className="!px-3 !py-1 !text-xs" onClick={() => setDlg({ ...dlg, i: dlg.i + 1 })}>{t('dlg.more')}</Btn>}
                {dlg.npc === 'godo' && <Btn className="!px-3 !py-1 !text-xs" onClick={() => { setDlg(null); setPause('shop'); }}>🔨 {t('dlg.forge')}</Btn>}
                {hire && <Btn kind="primary" disabled={!canHire} className="!px-3 !py-1 !text-xs" onClick={() => { if (!canHire) return; const n: Save = JSON.parse(JSON.stringify(s)); n.points -= cost; n.spent += cost; n.allies.push(dlg.npc); if (n.active.filter((a) => a !== 'puck').length < MAX_ACTIVE) n.active.push(dlg.npc); n.history.push({ t: Date.now(), item: t('ally.' + dlg.npc), cost }); p.onSave(n); saveSlot(n); A.sfx('buy'); }}>🪙 {t('dlg.hire', { c: cost })}</Btn>}
                {hire && !canHire && <span className="self-center text-[11px] text-red-400">{t('shop.nopoints')}</span>}
                {!hire && s.allies.includes(dlg.npc) && dlg.npc !== 'godo' && dlg.npc !== 'caska' && dlg.npc !== 'puck' && dlg.npc !== 'ivalera' && dlg.npc !== 'gutsai' && (
                  active ? <span className="self-center text-[11px] text-emerald-400">✔ {t('dlg.inParty')}</span>
                    : nAct < MAX_ACTIVE || s.active.includes(dlg.npc) ? <Btn className="!px-3 !py-1 !text-xs" onClick={() => { const n: Save = JSON.parse(JSON.stringify(s)); if (!n.active.includes(dlg.npc)) n.active.push(dlg.npc); p.onSave(n); saveSlot(n); }}>{t('dlg.callParty')}</Btn>
                      : <span className="self-center text-[11px] text-[#a89880]">{t('shop.allyLimit', { n: MAX_ACTIVE })}</span>)}
                {dlg.npc === 'caska' && <Btn className="!px-3 !py-1 !text-xs" onClick={() => { const n: Save = JSON.parse(JSON.stringify(s)); if (!n.active.includes('caska') && n.active.filter((a) => a !== 'puck').length < MAX_ACTIVE) { n.active.push('caska'); p.onSave(n); saveSlot(n); A.sfx('buy'); } }}>{t('dlg.askHelp')}</Btn>}
                <Btn kind="danger" className="!px-3 !py-1 !text-xs" onClick={close}>{t('close')}</Btn>
              </div>
            </div>
          </div>
        );
      })()}
      {/* círculo de partida: próxima missão */}
      {depart && (() => {
        const lv = Math.min(10, p.save.current);
        const close = () => { setDepart(false); eng.current?.setPaused(false); };
        return (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 fade-in">
            <div className="panel w-full max-w-md p-6">
              <h2 className="title-glow mb-1 text-center text-xl tracking-[0.25em]">{t('depart.title')}</h2>
              <p className="mb-1 text-center text-lg font-bold text-amber-200">{lv}. {t(`lv.${lv}.t`)}</p>
              <p className="mb-2 text-center text-xs italic text-[#c9a870]">{t(`lv.${lv}.s`)}</p>
              <p className="mb-3 text-center text-sm text-[#d8c8b0]">{t(`lv.${lv}.d`)}</p>
              <p className="mb-4 text-center text-[11px] text-[#a89880]">{t('depart.allies')}: {p.save.active.filter((a) => ALLY_ICON[a]).map((a) => t('ally.' + a)).join(', ') || '—'}</p>
              <div className="flex justify-center gap-3">
                <Btn kind="primary" onClick={() => { setDepart(false); p.onDepart?.(); }}>{t('depart.go')}</Btn>
                <Btn onClick={close}>{t('cancel')}</Btn>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Behelit falante: teste de conhecimento */}
      {quiz != null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 fade-in">
          <div className="panel w-full max-w-lg p-6">
            <h2 className="title-glow mb-1 text-center text-xl tracking-[0.25em] text-red-400">{t('quiz.title')}</h2>
            <p className="mb-4 text-center text-xs text-[#a89880]">{t('quiz.sub', { n: quiz + 1 })}</p>
            <p className="mb-4 text-lg">{t(`quiz.q${quiz + 1}`)}</p>
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Btn key={i} className="!text-left !normal-case !tracking-normal" onClick={() => {
                  const correct = [1, 0, 2][quiz];
                  if (i !== correct) { setQuiz(null); setQuizMsg(''); eng.current?.setPaused(false); setMsgs((m) => [...m, { id: ++mid, text: t('quiz.wrong'), big: true }]); setTimeout(() => setMsgs((mm) => mm.slice(1)), 3400); return; }
                  if (quiz < 2) setQuiz(quiz + 1);
                  else { setQuiz(null); eng.current?.setPaused(false); const ok = eng.current?.startMozgus(); if (ok && eng.current) (eng.current as any).talkBeh && ((eng.current as any).talkBeh.used = true); }
                }}>{String.fromCharCode(65 + i)}) {t(`quiz.q${quiz + 1}${String.fromCharCode(97 + i)}`)}</Btn>
              ))}
            </div>
            {quizMsg && <p className="mt-3 text-center text-sm text-red-400">{quizMsg}</p>}
          </div>
        </div>
      )}
      {/* mensagens */}
      <div className="pointer-events-none absolute left-1/2 top-[18%] flex -translate-x-1/2 flex-col items-center gap-1">
        {msgs.map((m) => <div key={m.id} className={`fade-in text-center drop-shadow-[0_2px_4px_#000] ${m.big ? 'text-3xl font-black tracking-[0.2em] text-[#f0d0a0]' : 'text-sm tracking-wider text-[#e8dccb]'}`}>{m.text}</div>)}
      </div>
      {banner && <div className="banner pointer-events-none absolute inset-x-0 top-[36%] text-center"><div className="title-glow text-4xl font-black tracking-[0.3em]">{p.mode && p.mode !== 'campaign' ? t('mode.' + p.mode) : `${p.level}. ${t(`lv.${p.level}.t`)}`}</div><div className="mt-1 italic tracking-widest text-[#c9a870]">{p.mode && p.mode !== 'campaign' ? t('mode.' + p.mode + '.d') : t(`lv.${p.level}.s`)}</div></div>}
      {h?.dead && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 fade-in"><div className="title-glow text-6xl font-black tracking-[0.3em] text-red-600">{t('res.defeat')}</div></div>}
      {!pause && h && h.time < 12 && <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-white/50">{t('hud.click')}</div>}
      {!pause && h && (
        <div className={`pointer-events-none absolute bottom-1 right-2 text-[10px] tracking-wider ${h.cursorFree ? 'text-amber-300' : 'text-white/40'}`}>
          {h.cursorFree ? `🖱 ${keyLabel(st.keys.cursor)} — ${t('hud.cursorOn')}` : `${keyLabel(st.keys.cursor)} — ${t('hud.cursorOff')}`}
        </div>
      )}

      {/* pausa */}
      {pause && (
        <div className="absolute inset-0 z-40 bg-black/80 fade-in">
          {pause === 'pause' && (
            <div className="flex h-full items-center justify-center">
              <div className="panel flex w-80 flex-col gap-2 p-6">
                <h2 className="title-glow mb-2 text-center text-2xl tracking-[0.3em]">{t('pause.title')}</h2>
                <Btn kind="primary" onClick={resume}>{t('pause.resume')}</Btn>
                <Btn onClick={() => setPause('settings')}>{t('pause.settings')}</Btn>
                <Btn kind="danger" onClick={() => setLeave(true)}>{t('pause.leave')}</Btn>
              </div>
            </div>
          )}
          {pause === 'shop' && <Shop embedded save={p.save} onChange={(s) => { p.onSave(s); saveSlot(s); eng.current?.refreshLoadout(s); }} onBack={() => setPause('pause')} />}
          {pause === 'settings' && <SettingsScreen embedded onBack={() => setPause('pause')} />}
        </div>
      )}
      {leave && <Modal text={t('pause.confirmLeave')} onYes={() => { setLeave(false); setPause(null); eng.current?.setPaused(false); eng.current?.finish(false); }} onNo={() => setLeave(false)} />}
    </div>
  );
}
