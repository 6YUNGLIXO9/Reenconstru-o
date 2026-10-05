import { useEffect, useRef, useState } from 'react';
import { Btn, Embers } from './common';
import { t } from '../i18n';
import { Save, useSettings } from '../save';
import { getProfile } from '../profile';
import { Net, genCode, ROOM_RE, NetMsg } from '../net';
import NetGame from './NetGame';
import * as Prof from '../profile';

type Phase = 'choose' | 'creating' | 'joining' | 'lobby' | 'game';

export default function Multiplayer(p: { save: Save; onBack: () => void }) {
  useSettings();
  const net = useRef<Net | null>(null);
  const [phase, setPhase] = useState<Phase>('choose');
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [myReady, setMyReady] = useState(false);
  const [otherReady, setOtherReady] = useState(false);
  const [level, setLevel] = useState(1);
  const [gmode, setGmode] = useState<'campaign' | 'arena' | 'survival'>('campaign');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(p.save.difficulty || 'medium');
  const [seed, setSeed] = useState<{ armor: boolean; cloak: boolean; difficulty: 'easy' | 'medium' | 'hard'; mode?: 'campaign' | 'arena' | 'survival' }>({ armor: p.save.armorEq, cloak: p.save.cloakEq, difficulty: p.save.difficulty || 'medium' });
  const [copied, setCopied] = useState(false);
  const myName = getProfile().name;

  useEffect(() => () => { net.current?.destroy(); net.current = null; }, []);
  useEffect(() => { if (role === 'host' && connected) net.current?.send({ t: 'cfg', difficulty, level }); }, [difficulty, level, connected, role]);

  const handlers = (r: 'host' | 'guest') => ({
    onOpen: () => setStatus(r === 'host' ? t('mp.waiting') : t('mp.connecting')),
    onPeer: (open: boolean) => {
      setConnected(open);
      if (open) { setError(''); net.current?.send({ t: 'hello', name: myName, id: getProfile().id }); setStatus(''); }
      else { setOtherName(''); setOtherReady(false); if (phase === 'lobby') setStatus(t('mp.partnerLeft')); }
    },
    onMsg: (m: NetMsg) => {
      if (m.t === 'hello') { setOtherName(m.name); if (r === 'host') net.current?.send({ t: 'hello', name: myName, id: getProfile().id }); }
      else if (m.t === 'ready') setOtherReady(m.v);
      else if (m.t === 'cfg' && r === 'guest') { setDifficulty(m.difficulty); setLevel(m.level); }
      else if (m.t === 'start' && r === 'guest') { setLevel((m as any).level); const sd = (m as any).seedSave; setSeed(sd); setDifficulty(sd.difficulty || 'medium'); setGmode(sd.mode || 'campaign'); Prof.statLevelStart(true); setPhase('game'); }
    },
    onError: (msg: string) => { setError(msg); },
    onClose: () => { setConnected(false); },
  });

  const create = () => {
    setRole('host'); const c = genCode(); setCode(c); setError(''); setMyReady(false); setOtherReady(false); setOtherName('');
    const n = new Net('host', c, handlers('host')); net.current = n; n.start(); setPhase('lobby'); setStatus(t('mp.creating'));
  };
  const join = () => {
    const c = joinCode.trim().toUpperCase();
    if (!ROOM_RE.test(c)) { setError(t('mp.joinCode') + ' (ex: BERS-4821)'); return; }
    setRole('guest'); setCode(c); setError(''); setMyReady(false); setOtherReady(false); setOtherName('');
    const n = new Net('guest', c, handlers('guest')); net.current = n; n.start(); setPhase('lobby'); setStatus(t('mp.connecting'));
  };
  const toggleReady = () => { const v = !myReady; setMyReady(v); net.current?.send({ t: 'ready', v }); };
  const leave = () => { net.current?.destroy(); net.current = null; setPhase('choose'); setConnected(false); setOtherName(''); setMyReady(false); setOtherReady(false); setError(''); setStatus(''); };
  const copy = () => { try { navigator.clipboard?.writeText(code); } catch { /* */ } setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const startGame = () => {
    if (role !== 'host' || !connected || !myReady || !otherReady) return;
    const sd = { armor: p.save.armorEq, cloak: p.save.cloakEq, difficulty, mode: gmode };
    net.current?.send({ t: 'start', level: gmode === 'campaign' ? level : gmode === 'arena' ? 3 : 4, seedSave: sd } as any); setSeed(sd); Prof.statLevelStart(true); setPhase('game');
  };
  const exitGame = () => { net.current?.destroy(); net.current = null; p.onBack(); };

  if (phase === 'game' && net.current) {
    return <NetGame role={role} level={gmode === 'campaign' ? level : gmode === 'arena' ? 3 : 4} save={p.save} net={net.current} seed={seed} mode={gmode} partner={otherName || '—'} onExit={exitGame} />;
  }

  const canStart = role === 'host' && connected && myReady && otherReady;
  return (
    <div className="menu-bg relative h-full w-full overflow-auto p-4 md:p-8">
      <Embers />
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="title-glow text-2xl font-bold tracking-[0.2em] md:text-3xl">{t('mp.title')}</h1>
          <Btn onClick={phase === 'choose' ? p.onBack : leave}>← {phase === 'choose' ? t('back') : t('mp.leave')}</Btn>
        </div>

        {phase === 'choose' && (
          <div className="flex flex-col gap-4">
            <div className="panel p-5">
              <h2 className="mb-1 text-lg font-bold text-amber-200">{t('mp.create')}</h2>
              <p className="mb-3 text-xs text-[#b8a890]">{t('mp.p1')} · {t('mp.hostAuthority')}</p>
              <Btn kind="primary" onClick={create}>{t('mp.create')}</Btn>
            </div>
            <div className="panel p-5">
              <h2 className="mb-1 text-lg font-bold text-amber-200">{t('mp.join')}</h2>
              <p className="mb-3 text-xs text-[#b8a890]">{t('mp.p2')}</p>
              <div className="flex gap-2">
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && join()} placeholder="BERS-4821" maxLength={9} className="flex-1 rounded border border-amber-700/60 bg-black/60 px-3 py-2 tracking-[0.3em] text-white outline-none" />
                <Btn kind="primary" onClick={join}>{t('mp.enter')}</Btn>
              </div>
            </div>
            <p className="text-center text-[11px] text-[#8a7a68]">{t('mp.dep')}</p>
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
          </div>
        )}

        {phase === 'lobby' && (
          <div className="panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#c9a870]">{t('mp.roomCode')}</div>
                <div className="text-3xl font-black tracking-[0.3em] text-amber-200">{code}</div>
              </div>
              <Btn onClick={copy} className="!px-3 !py-1 !text-xs">{copied ? t('mp.copied') : t('mp.copy')}</Btn>
            </div>
            {status && <p className="mb-3 text-sm text-amber-300">{status}</p>}
            {error && <p className="mb-3 text-sm text-red-400">⚠ {error}</p>}
            <div className="grid grid-cols-2 gap-3">
              {([['host', t('mp.p1')], ['guest', t('mp.p2')]] as const).map(([slot, label]) => {
                const isMe = role === slot;
                const present = isMe || connected;
                const nm = isMe ? myName : otherName;
                const rdy = isMe ? myReady : otherReady;
                return (
                  <div key={slot} className={`border p-3 ${rdy && present ? 'border-emerald-500/70 bg-emerald-950/30' : 'border-white/10 bg-black/30'}`}>
                    <div className="text-[10px] uppercase tracking-widest text-[#c9a870]">{label}</div>
                    <div className="truncate text-lg font-bold">{present ? (nm || '—') : t('mp.waitingSlot')}</div>
                    <div className={`text-xs ${!present ? 'text-zinc-500' : rdy ? 'text-emerald-400' : 'text-amber-300'}`}>{!present ? t('mp.disconnected') : rdy ? t('mp.ready.on') : t('mp.ready.off')}</div>
                    {isMe && <div className="mt-1 text-[10px] text-[#8a7a68]">{t('hud.you')}</div>}
                  </div>
                );
              })}
            </div>

            {role === 'host' ? (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest text-[#c9a870]">{t('ex.modes')}:</span>
                  {(['campaign', 'arena', 'survival'] as const).map((m) => <Btn key={m} kind={gmode === m ? 'primary' : undefined} className="!px-3 !py-1 !text-xs" onClick={() => setGmode(m)}>{m === 'campaign' ? t('camp.title').split('—')[0] : t('mode.' + m)}</Btn>)}
                </div>
                <div className="flex items-center gap-2" style={{ display: gmode !== 'campaign' ? 'none' : undefined }}>
                  <span className="text-xs uppercase tracking-widest text-[#c9a870]">{t('mp.selectLevel')}:</span>
                  <select value={level} onChange={(e) => setLevel(+e.target.value)} className="rounded border border-amber-700/60 bg-black/70 px-2 py-1 text-sm text-white">
                    {Array.from({ length: p.save.unlocked }).map((_, i) => <option key={i} value={i + 1}>{i + 1}. {t(`lv.${i + 1}.t`)}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest text-[#c9a870]">{t('mp.start.diff')}:</span>
                  {(['easy', 'medium', 'hard'] as const).map((d) => <Btn key={d} kind={difficulty === d ? 'primary' : undefined} className="!px-3 !py-1 !text-xs" onClick={() => setDifficulty(d)}>{t('diff.' + d)}</Btn>)}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-xs text-[#a89880]">{t('hud.difficulty')}: <b className="text-amber-300">{t('diff.' + difficulty)}</b></div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Btn kind={myReady ? 'danger' : 'primary'} disabled={!connected} onClick={toggleReady}>{myReady ? t('mp.notready') : t('mp.ready')}</Btn>
              {role === 'host'
                ? <Btn kind="primary" disabled={!canStart} onClick={startGame}>{t('mp.start')}</Btn>
                : <span className="text-xs text-[#a89880]">{t('mp.onlyHost')}</span>}
              <Btn kind="danger" onClick={leave}>{t('mp.leave')}</Btn>
            </div>
            {role === 'host' && !canStart && connected && <p className="mt-2 text-xs text-[#a89880]">{t('mp.needReady')}</p>}
            <p className="mt-3 text-[11px] text-[#8a7a68]">{t('mp.dep')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
