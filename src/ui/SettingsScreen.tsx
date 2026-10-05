import { useEffect, useState } from 'react';
import { Btn } from './common';
import { t, keyLabel } from '../i18n';
import { useSettings, setSettings, PRESETS, DEFAULT_KEYS } from '../save';

const ACTIONS = ['fwd', 'back', 'left', 'right', 'run', 'dodge', 'light', 'heavy', 'block', 'cannon', 'xbow', 'rage', 'heal', 'lock', 'interact', 'cursor', 'shop', 'pause'];

function Slider(p: { label: string; v: number; min: number; max: number; step: number; fmt?: (v: number) => string; on: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 py-1.5 text-sm">
      <span className="w-52 shrink-0 text-[#d8c8b0]">{p.label}</span>
      <input type="range" className="flex-1" min={p.min} max={p.max} step={p.step} value={p.v} onChange={(e) => p.on(parseFloat(e.target.value))} />
      <span className="w-14 text-right text-amber-300">{p.fmt ? p.fmt(p.v) : p.v}</span>
    </label>
  );
}

export default function SettingsScreen(p: { onBack?: () => void; embedded?: boolean }) {
  const st = useSettings();
  const [tab, setTab] = useState('audio');
  const [listen, setListen] = useState<string | null>(null);
  const [conflict, setConflict] = useState('');

  useEffect(() => {
    if (!listen) return;
    const apply = (code: string) => {
      const other = Object.keys(st.keys).find((a) => a !== listen && st.keys[a] === code);
      if (other) { setConflict(t('set.conflict', { a: t('k.' + other) })); return; }
      setConflict(''); setSettings({ keys: { ...st.keys, [listen]: code } }); setListen(null);
    };
    const kd = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (e.code === 'Escape') { setListen(null); setConflict(''); return; } apply(e.code); };
    const md = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); apply('Mouse' + e.button); };
    window.addEventListener('keydown', kd, true); window.addEventListener('mousedown', md, true);
    return () => { window.removeEventListener('keydown', kd, true); window.removeEventListener('mousedown', md, true); };
  }, [listen, st.keys]);

  const a = st.audio, g = st.gfx;
  const setA = (k: string, v: number | boolean) => setSettings({ audio: { ...a, [k]: v } });
  const setG = (k: string, v: number) => setSettings({ gfx: { ...g, [k]: v, preset: 'custom' } });
  const presets: [string, string][] = [['vlow', 'g.p.vlow'], ['low', 'g.p.low'], ['medium', 'g.p.medium'], ['high', 'g.p.high'], ['vhigh', 'g.p.vhigh']];
  const tabs: [string, string][] = [['audio', 'set.audio'], ['gfx', 'set.gfx'], ['lang', 'set.lang'], ['controls', 'set.controls']];
  const lv = (n: number) => t('g.l' + n);

  return (
    <div className={`${p.embedded ? '' : 'menu-bg'} h-full w-full overflow-auto p-4 md:p-8`}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="title-glow text-2xl font-bold tracking-[0.2em] md:text-3xl">{t('set.title')}</h1>
          {p.onBack && <Btn onClick={p.onBack}>← {t('back')}</Btn>}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">{tabs.map(([id, k]) => <Btn key={id} kind={tab === id ? 'primary' : undefined} onClick={() => setTab(id)} className="!px-4 !py-1.5">{t(k)}</Btn>)}</div>
        <div className="panel p-4">
          {tab === 'audio' && (
            <div>
              <Slider label={t('a.master')} v={a.master} min={0} max={100} step={1} fmt={(v) => v + '%'} on={(v) => setA('master', v)} />
              <Slider label={t('a.music')} v={a.music} min={0} max={100} step={1} fmt={(v) => v + '%'} on={(v) => setA('music', v)} />
              <Slider label={t('a.sfx')} v={a.sfx} min={0} max={100} step={1} fmt={(v) => v + '%'} on={(v) => setA('sfx', v)} />
              <Slider label={t('a.dialog')} v={a.dialog} min={0} max={100} step={1} fmt={(v) => v + '%'} on={(v) => setA('dialog', v)} />
              <Slider label={t('a.ambient')} v={a.ambient} min={0} max={100} step={1} fmt={(v) => v + '%'} on={(v) => setA('ambient', v)} />
              <label className="mt-2 flex items-center gap-3 text-sm"><input type="checkbox" checked={a.mute} onChange={(e) => setA('mute', e.target.checked)} /> {t('a.mute')}</label>
            </div>
          )}
          {tab === 'gfx' && (
            <div>
              <div className="mb-3"><div className="mb-1 text-xs uppercase tracking-widest text-[#c9a870]">{t('g.preset')}: {g.preset === 'custom' ? t('g.p.custom') : t('g.p.' + g.preset)}</div>
                <div className="flex flex-wrap gap-2">{presets.map(([id, k]) => <Btn key={id} kind={g.preset === id ? 'primary' : undefined} className="!px-3 !py-1 !text-xs" onClick={() => setSettings({ gfx: { preset: id, ...PRESETS[id] } })}>{t(k)}</Btn>)}</div></div>
              <Slider label={t('g.tex')} v={g.tex} min={0} max={2} step={1} fmt={lv} on={(v) => setG('tex', v)} />
              <Slider label={t('g.shadow')} v={g.shadow} min={0} max={2} step={1} fmt={(v) => (v === 0 ? t('g.off') : lv(v === 1 ? 1 : 2))} on={(v) => setG('shadow', v)} />
              <Slider label={t('g.dist')} v={g.dist} min={0.5} max={1.5} step={0.05} fmt={(v) => v.toFixed(2)} on={(v) => setG('dist', v)} />
              <Slider label={t('g.fx')} v={g.fx} min={0.2} max={1.5} step={0.05} fmt={(v) => v.toFixed(2)} on={(v) => setG('fx', v)} />
              <Slider label={t('g.res')} v={g.res} min={0.5} max={1} step={0.05} fmt={(v) => v.toFixed(2)} on={(v) => setG('res', v)} />
              <Slider label={t('g.light')} v={g.light} min={0.6} max={1.4} step={0.05} fmt={(v) => v.toFixed(2)} on={(v) => setG('light', v)} />
              <div className="mt-2 flex items-center gap-3 text-sm"><span className="w-52 text-[#d8c8b0]">{t('g.fps')}</span>
                {[30, 60, 120, 0].map((f) => <Btn key={f} kind={g.fps === f ? 'primary' : undefined} className="!px-3 !py-1 !text-xs" onClick={() => setG('fps', f)}>{f || t('g.nolimit')}</Btn>)}</div>
              <p className="mt-3 text-xs text-[#8a7a68]">{t('set.pausenote')}</p>
            </div>
          )}
          {tab === 'lang' && (
            <div className="flex gap-3">{([['pt', 'Português'], ['en', 'English'], ['ru', 'Русский']] as const).map(([id, n]) => <Btn key={id} kind={st.lang === id ? 'primary' : undefined} onClick={() => setSettings({ lang: id })}>{n}</Btn>)}</div>
          )}
          {tab === 'controls' && (
            <div>
              {ACTIONS.map((ac) => (
                <div key={ac} className="flex items-center justify-between border-b border-white/5 py-1.5 text-sm">
                  <span>{t('k.' + ac)}</span>
                  <Btn className={`!px-3 !py-1 !text-xs min-w-40 ${listen === ac ? 'pulse' : ''}`} onClick={() => { setListen(ac); setConflict(''); }}>{listen === ac ? t('set.press') : keyLabel(st.keys[ac])}</Btn>
                </div>
              ))}
              {conflict && <p className="mt-2 text-sm text-red-400">{conflict}</p>}
              <div className="mt-3 flex items-center gap-3"><Btn kind="danger" onClick={() => { setListen(null); setConflict(''); setSettings({ keys: { ...DEFAULT_KEYS } }); }}>{t('set.reset')}</Btn><span className="text-xs text-emerald-400/80">{t('set.saved')}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
