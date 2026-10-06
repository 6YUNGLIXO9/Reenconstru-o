import { useEffect, useRef, useState } from 'react';
import { Engine, HudState } from '../game/engine';
import { NetClient, ClientHud } from '../game/netclient';
import { Net } from '../net';
import { Save, saveSlot, useSettings } from '../save';
import { t, keyLabel } from '../i18n';
import { Bar, Btn, AllyBars, Modal } from './common';
import SettingsScreen from './SettingsScreen';
import * as Prof from '../profile';
import * as A from '../audio';

const BIG = ['m_boss_down', 'm_rage', 'm_boss_appear', 'm_dead', 'm_phase', 'm_poise', 'm_caska_down', 'm_guts_down', 'm_ivalera'];
let mid = 0;

export default function NetGame(p: { role: 'host' | 'guest'; level: number; save: Save; net: Net; seed: { armor: boolean; cloak: boolean; difficulty: 'easy' | 'medium' | 'hard'; mode?: 'campaign' | 'arena' | 'survival' }; partner: string; onExit: () => void; mode?: 'campaign' | 'arena' | 'survival' }) {
  const st = useSettings();
  const host = useRef<HTMLDivElement>(null), mini = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Engine | null>(null), cli = useRef<NetClient | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [chud, setChud] = useState<ClientHud | null>(null);
  const [msgs, setMsgs] = useState<{ id: number; text: string; big: boolean }[]>([]);
  const [conn, setConn] = useState(true);
  const [over, setOver] = useState<null | { win: boolean }>(null);
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState<null | 'main' | 'settings'>(null);
  const [leaveC, setLeaveC] = useState(false);
  const closeMenu = () => { setMenu(null); setLeaveC(false); eng.current?.setInputLocked(false); cli.current?.setInputLocked(false); };

  useEffect(() => {
    const net = p.net;
    const msg = (k: string, pr?: any) => { const q = { ...(pr || {}) }; if (q.id) q.name = t('boss.' + q.id); const text = t(k.replace('_', '.'), q), id = ++mid; setMsgs((m) => [...m.slice(-3), { id, text, big: BIG.includes(k) }]); setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 3400); };
    try {
      if (p.role === 'host') {
        const sv = { ...p.save, armorEq: p.seed.armor, cloakEq: p.seed.cloak };
        const e = new Engine(host.current!, p.level, sv, {
          hud: setHud, msg,
          end: (r) => { net.send({ t: 'end', d: { win: r.win } }); setOver({ win: r.win });
            // aplica recompensas no save local do host
            const s = { ...p.save }; const earned = Math.floor((r.combat + (r.win ? 100 : 0)) * (r.win ? 1 : 0.5)); s.points += earned; s.totalEarned += earned; if (r.win && !s.completed.includes(r.level)) { s.completed.push(r.level); s.unlocked = Math.max(s.unlocked, Math.min(10, r.level + 1)); } saveSlot(s);
            if (r.win) Prof.statLevelComplete('guts', earned, true);
          },
          pause: (_b, why) => { if (why === 'localmenu') setMenu('main'); }, // pausa LOCAL: mundo continua
        }, { coop: true, net: (m) => net.send(m), difficulty: p.seed.difficulty, mode: p.seed.mode || p.mode || 'campaign' });
        eng.current = e; e.setMinimap(mini.current);
      } else {
        const sv = { ...p.save, armorEq: p.seed.armor, cloakEq: p.seed.cloak };
        console.log("PLAYER 2: iniciando NetClient");
const c = new NetClient(host.current!, p.level, sv, (m) => net.send(m), setChud);
console.log("PLAYER 2: NetClient criado");
        c.onPause = () => setMenu('main');
        cli.current = c; c.setMinimap(mini.current);
      }
    } catch (e) {
  console.error("ERRO AO INICIAR MULTIPLAYER:", e);
  setErr(String(e));
}

    net.h.onMsg = (m) => {
      if (m.t === 'input' && eng.current) eng.current.applyRemoteInput(m.d);
      else if (m.t === 'snap' && cli.current) cli.current.onSnap(m.d);
      else if (m.t === 'end') { setOver({ win: (m as any).d.win }); if (!isHost && (m as any).d.win) Prof.statLevelComplete('caska', 0, true); }
      else if (m.t === 'bye') { setConn(false); }
    };
    net.h.onPeer = (open) => { setConn(open); if (!open) { eng.current?.setPaused(true); cli.current?.setPaused(true); } else { eng.current?.setPaused(false); cli.current?.setPaused(false); } };
    net.h.onClose = () => setConn(false);

    const ping = setInterval(() => { net.measurePing(); cli.current?.setPing(net.ping); }, 2000);
    const auto = setInterval(() => saveSlot(p.save), 15000);
    return () => { clearInterval(ping); clearInterval(auto); net.h.onMsg = undefined; eng.current?.dispose(); cli.current?.dispose(); eng.current = null; cli.current = null; };
    // eslint-disable-next-line
  }, []);

  useEffect(() => { eng.current?.applySettings(); cli.current?.applySettings(); A.applyVolumes(); }, [st]);

  const isHost = p.role === 'host';
  const myHp = isHost ? (hud ? { v: hud.hp, m: hud.maxHp } : null) : (chud ? { v: chud.hp, m: chud.maxHp } : null);
  const myStam = isHost ? (hud ? { v: hud.stam, m: hud.maxStam } : null) : (chud ? { v: chud.stam, m: chud.maxStam } : null);
  const mate = isHost ? hud?.mate : (chud?.partner ? { hp: chud.partner.hp, maxHp: chud.partner.maxHp, dead: false } : null);
  const boss = isHost ? hud?.boss : chud?.boss;
  const obj = isHost ? hud?.obj : chud?.obj;
  const points = isHost ? hud?.points : chud?.points;
  const cine = isHost ? hud?.cine : chud?.cine;
  const waiting = !isHost && chud?.waiting;

  return (
    <div className="relative min-h-screen w-full bg-black">
      <div ref={host} className="absolute inset-0" />
      {err && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black p-8 text-center text-red-300">WebGL: {err}<Btn onClick={p.onExit}>{t('back')}</Btn></div>}
      {(cine === 'intro' || cine === 'bossdown' || cine === 'eclipse') && <><div className="pointer-events-none absolute inset-x-0 top-0 h-[9%] bg-black" /><div className="pointer-events-none absolute inset-x-0 bottom-0 h-[9%] bg-black" /></>}

      {myHp && (
        <div className="pointer-events-none absolute left-4 top-4 w-[min(420px,52vw)]">
          <div className="mb-0.5 text-[10px] uppercase tracking-[0.3em] text-amber-300">{t('hud.you')} — {isHost ? 'Guts' : 'Caska'}</div>
          <Bar v={myHp.v} max={myHp.m} color="linear-gradient(180deg,#e03030,#8a1010)" h={15} w={Math.min(420, 160 + myHp.m)} label={`${Math.ceil(myHp.v)}/${Math.round(myHp.m)}`} />
          {myStam && <div className="mt-1"><Bar v={myStam.v} max={myStam.m} color="linear-gradient(180deg,#5ad06a,#1e7a30)" h={10} w={Math.min(360, 140 + myStam.m)} /></div>}
          {isHost && hud && <div className="mt-1"><Bar v={hud.rage} max={100} color={hud.rageOn ? 'linear-gradient(180deg,#ff6a20,#c01000)' : 'linear-gradient(180deg,#d08020,#7a3a08)'} h={8} w={240} /></div>}
          {mate && (
            <div className="mt-2">
              <div className="mb-0.5 text-[10px] uppercase tracking-[0.3em] text-sky-300">{t('hud.partner')} — {isHost ? 'Caska' : 'Guts'} · {p.partner}</div>
              <Bar v={mate.hp} max={mate.maxHp} color="linear-gradient(180deg,#3a7ad0,#15306a)" h={11} w={240} label={mate.dead ? '✖' : `${Math.ceil(mate.hp)}`} />
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-[10px] tracking-widest">
            {isHost && hud?.buffGuts && <span className="border border-sky-700/60 bg-black/60 px-1.5 py-0.5 text-sky-300" title={t('buff.schierke.d')}>🔮 {t('buff.schierke')}</span>}
            {((isHost && hud?.buffCaska) || (!isHost && chud?.buffCaska)) && <span className="border border-amber-700/60 bg-black/60 px-1.5 py-0.5 text-amber-200" title={t('buff.farnese.d')}>✝️ {t('buff.farnese')}</span>}
            {(isHost ? hud?.ivalera : chud?.ivalera) && <span className={`border bg-black/60 px-1.5 py-0.5 ${(isHost ? hud!.ivalera : chud!.ivalera)!.active ? 'border-pink-400 text-pink-200' : (isHost ? hud!.ivalera : chud!.ivalera)!.cd > 0 ? 'border-zinc-700 text-zinc-400' : 'border-pink-700/60 text-pink-300'}`}>🧚‍♀️ {t('hud.ivalera')}{(isHost ? hud!.ivalera : chud!.ivalera)!.cd > 0 ? ` ${Math.ceil((isHost ? hud!.ivalera : chud!.ivalera)!.cd)}s` : ''}</span>}
            <span className="border border-white/10 bg-black/60 px-1.5 py-0.5 text-[#a89880]">{t('hud.difficulty')}: {t('diff.' + ((isHost ? hud?.difficulty : chud?.difficulty) || 'medium'))}</span>
          </div>
          <div className="mt-2"><AllyBars title={t('hud.allies')} bars={(isHost ? hud?.allyBars : chud?.allyBars) || []} /></div>
        </div>
      )}
      <div className="pointer-events-none absolute right-4 top-4 flex w-44 flex-col items-end gap-2">
        <canvas ref={(c) => { mini.current = c; isHost ? eng.current?.setMinimap(c) : cli.current?.setMinimap(c); }} width={170} height={170} className="h-[170px] w-[170px] rounded-full shadow-[0_0_20px_#000]" />
        {obj && <div className="panel w-full px-3 py-2 text-right text-xs"><div className="text-[9px] uppercase tracking-[0.25em] text-[#c9a870]">{t('hud.obj')}</div><div>{t(obj.k.replace('_', '.'), { a: obj.a, b: obj.b })}</div><div className="mt-1 text-amber-300">🪙 {points}</div></div>}
        <div className="panel px-2 py-1 text-[10px] text-[#a89880]">{t('mp.ping')}: {isHost ? Math.round(p.net.ping) : chud?.ping ?? 0}ms</div>
      </div>
      {boss && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 w-[min(640px,60vw)] -translate-x-1/2 text-center">
          <div className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-[#f0d8b0]">{t('boss.' + boss.name)} <span className="ml-2 text-[10px] text-red-400">{t('hud.phase')} {boss.phase}/{boss.phases}</span></div>
          <Bar v={boss.hp} max={boss.max} color="linear-gradient(180deg,#d02020,#6a0808)" h={14} />
        </div>
      )}
      {/* habilidade do cliente (Caska) */}
      {!isHost && chud && <div className="pointer-events-none absolute bottom-4 left-4 flex items-end gap-2"><div className={`relative flex h-12 w-12 items-center justify-center border bg-black/70 text-xl ${chud.special.on ? 'border-amber-300' : 'border-amber-800/60'}`}>🦅{chud.special.cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: Math.min(100, (chud.special.cd / chud.special.max) * 100) + '%' }} />}{chud.special.cd > 0 && <span className="absolute text-[11px] font-bold">{Math.ceil(chud.special.cd)}</span>}</div><span className="text-[10px] text-[#c9a870]">{keyLabel(st.keys.rage)}</span></div>}

      <div className="pointer-events-none absolute left-1/2 top-[18%] flex -translate-x-1/2 flex-col items-center gap-1">
        {msgs.map((m) => <div key={m.id} className={`fade-in text-center drop-shadow-[0_2px_4px_#000] ${m.big ? 'text-3xl font-black tracking-[0.2em] text-[#f0d0a0]' : 'text-sm tracking-wider text-[#e8dccb]'}`}>{m.text}</div>)}
      </div>

      {waiting && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><div className="panel px-6 py-4 text-lg tracking-widest">{t('hud.waiting')}</div></div>}
      {!conn && !over && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
          <div className="panel p-6 text-center">
            <p className="mb-4 text-lg text-red-300">{t('mp.reconnecting')}</p>
            <Btn kind="danger" onClick={p.onExit}>{t('res.menu')}</Btn>
          </div>
        </div>
      )}
      {over && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 fade-in">
          <div className="panel p-8 text-center">
            <h1 className={`title-glow mb-4 text-4xl font-black tracking-[0.3em] ${over.win ? 'text-amber-200' : 'text-red-600'}`}>{over.win ? t('res.victory') : t('res.defeat')}</h1>
            <Btn kind="primary" onClick={p.onExit}>{t('res.menu')}</Btn>
          </div>
        </div>
      )}
      {/* Menu local individual (ESC): o mundo compartilhado NÃO pausa */}
      {menu && !over && (
        <div className="absolute inset-0 z-30 bg-black/60 fade-in">
          {menu === 'main' && (
            <div className="flex h-full items-center justify-center">
              <div className="panel flex w-80 flex-col gap-2 p-6">
                <h2 className="title-glow mb-1 text-center text-xl tracking-[0.25em]">{t('mppause.title', { who: isHost ? 'Guts' : 'Caska' })}</h2>
                <p className="mb-2 text-center text-[11px] text-amber-300/80">{t('mppause.note')}</p>
                <Btn kind="primary" onClick={closeMenu}>{t('pause.resume')}</Btn>
                <Btn onClick={() => setMenu('settings')}>{t('pause.settings')}</Btn>
                <Btn kind="danger" onClick={() => setLeaveC(true)}>{t('pause.leave')}</Btn>
              </div>
            </div>
          )}
          {menu === 'settings' && <SettingsScreen embedded onBack={() => setMenu('main')} />}
        </div>
      )}
      {leaveC && <Modal text={t('mp.confirmLeave')} onYes={() => { saveSlot(p.save); p.onExit(); }} onNo={() => setLeaveC(false)} />}
      {!waiting && <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-white/45">{t('hud.click')} · {t('mp.hostAuthority')}</div>}
      {(() => { const cf = isHost ? hud?.cursorFree : chud?.cursorFree; return (
        <div className={`pointer-events-none absolute bottom-1 right-2 text-[10px] tracking-wider ${cf ? 'text-amber-300' : 'text-white/40'}`}>
          {cf ? `🖱 ${keyLabel(st.keys.cursor)} — ${t('hud.cursorOn')}` : `${keyLabel(st.keys.cursor)} — ${t('hud.cursorOff')}`}
        </div>
      ); })()}
    </div>
  );
}
