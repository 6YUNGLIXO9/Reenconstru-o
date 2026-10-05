import { useState } from 'react';
import { Btn, Embers } from './common';
import { t } from '../i18n';
import { Save, useSettings } from '../save';
import { useProfile, setCosm } from '../profile';
import { ACHS, GALLERY_BOSSES, DOCS, ExtraMode } from '../extras';
import { ALLY_ICON } from '../data';

const fmtD = (ts: number) => new Date(ts).toLocaleDateString();

export default function Extras(p: { save: Save; onPlay: (m: ExtraMode) => void; onBack: () => void }) {
  useSettings();
  const prof = useProfile();
  const [tab, setTab] = useState('modes');
  const s = p.save;
  const tabs: [string, string][] = [['modes', t('ex.modes')], ['ach', t('ex.ach')], ['gallery', t('ex.gallery')], ['camp', t('ex.camp')], ['cosm', t('ex.cosm')]];
  const modes: { id: ExtraMode; icon: string; rec?: string }[] = [
    { id: 'defense', icon: '🏰', rec: prof.records.defWave ? t('ex.rec.def', { n: prof.records.defWave }) : undefined },
    { id: 'arena', icon: '🏟️', rec: prof.records.arenaWave ? t('ex.rec.wave', { n: prof.records.arenaWave, s: prof.records.arenaScore }) : undefined },
    { id: 'survival', icon: '⏳', rec: prof.records.survWave ? t('ex.rec.wave', { n: prof.records.survWave, s: prof.records.survScore }) : undefined },
    { id: 'dungeon', icon: '🕳️', rec: prof.records.dungeonClears ? t('ex.rec.clears', { n: prof.records.dungeonClears }) : undefined },
    { id: 'training', icon: '🎯' },
  ];
  const campAllies = s.active.filter((a) => ALLY_ICON[a]);
  const nAch = Object.keys(prof.ach).length;
  return (
    <div className="menu-bg relative h-full w-full overflow-auto p-4 md:p-8">
      <Embers />
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="title-glow text-2xl font-bold tracking-[0.2em] md:text-3xl">{t('ex.title')}</h1>
          <Btn onClick={p.onBack}>← {t('back')}</Btn>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">{tabs.map(([id, l]) => <Btn key={id} kind={tab === id ? 'primary' : undefined} className="!px-4 !py-1.5" onClick={() => setTab(id)}>{l}</Btn>)}</div>

        {tab === 'modes' && (
          <div className="grid gap-3 md:grid-cols-2">
            {modes.map((m) => (
              <div key={m.id} className="panel flex items-center gap-3 p-4">
                <span className="text-4xl">{m.icon}</span>
                <div className="min-w-0 flex-1">
                  <b className="text-lg tracking-wide">{t('mode.' + m.id)}</b>
                  <div className="text-xs text-[#b8a890]">{t('mode.' + m.id + '.d')}</div>
                  {m.rec && <div className="mt-0.5 text-[11px] text-amber-300">🏆 {m.rec}</div>}
                  {(m.id === 'arena' || m.id === 'survival') && <div className="text-[10px] text-sky-300/80">{t('ex.alsoOnline')}</div>}
                </div>
                <Btn kind="primary" onClick={() => p.onPlay(m.id)}>{t('camp.start')}</Btn>
              </div>
            ))}
            <p className="text-xs text-[#8a7a68] md:col-span-2">{t('ex.note')}</p>
          </div>
        )}

        {tab === 'ach' && (
          <div>
            <p className="mb-3 text-sm text-[#c9a870]">{nAch}/{ACHS.length}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {ACHS.map((a) => {
                const un = prof.ach[a.id];
                return (
                  <div key={a.id} className={`panel flex items-center gap-3 p-3 ${un ? '' : 'opacity-50'}`}>
                    <span className="text-2xl">{un ? a.icon : '🔒'}</span>
                    <div className="min-w-0 flex-1">
                      <b className="text-sm tracking-wide">{t('ach.' + a.id)}</b>
                      <div className="text-[11px] text-[#b8a890]">{t('ach.' + a.id + '.d')}</div>
                    </div>
                    {un ? <span className="text-[10px] text-emerald-400">{fmtD(un)}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'gallery' && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="mb-2 text-sm uppercase tracking-[0.3em] text-[#c9a870]">{t('ex.docs')} ({prof.records.docs.length}/10)</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {DOCS.map((d, i) => {
                  const got = prof.records.docs.includes(d);
                  return <div key={d} className={`panel p-3 ${got ? '' : 'opacity-45'}`}><b className="text-sm">📜 {got ? t('doc.' + (i + 1)) : '???'}</b>{got && <p className="mt-1 text-[11px] leading-relaxed text-[#b8a890]">{t('doc.' + (i + 1) + '.d')}</p>}{!got && <p className="mt-1 text-[10px] text-[#8a7a68]">{t('ex.docHint', { n: i + 1 })}</p>}</div>;
                })}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm uppercase tracking-[0.3em] text-[#c9a870]">{t('ex.bosses')} ({s.bosses.length}/{GALLERY_BOSSES.length})</h3>
              <div className="flex flex-wrap gap-2">
                {GALLERY_BOSSES.map((b) => <span key={b} className={`panel px-3 py-1.5 text-xs ${s.bosses.includes(b) ? 'text-red-300' : 'opacity-40'}`}>{s.bosses.includes(b) ? '☠ ' + t('boss.' + b) : '???'}</span>)}
              </div>
            </div>
          </div>
        )}

        {tab === 'camp' && (
          <div className="flex flex-col gap-2">
            <p className="mb-1 text-xs text-[#8a7a68]">{t('ex.campNote')}</p>
            {campAllies.length === 0 && <p className="text-sm text-[#a89880]">{t('ex.campEmpty')}</p>}
            {campAllies.map((a) => (
              <div key={a} className="panel flex gap-3 p-3">
                <span className="text-3xl">{ALLY_ICON[a]}</span>
                <div><b className="text-sm">{t('ally.' + a)}</b><p className="mt-0.5 text-sm italic leading-relaxed text-[#d8c8b0]">“{t('camp.say.' + a)}”</p></div>
              </div>
            ))}
            {s.hero === 'caska' && <div className="panel flex gap-3 p-3"><span className="text-3xl">🧚‍♀️</span><div><b className="text-sm">Ivalera</b><p className="mt-0.5 text-sm italic text-[#d8c8b0]">“{t('camp.say.ivalera')}”</p></div></div>}
          </div>
        )}

        {tab === 'cosm' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[#8a7a68]">{t('ex.cosmNote')}</p>
            <div className="panel p-4">
              <h3 className="mb-2 text-sm uppercase tracking-[0.3em] text-[#c9a870]">{t('ex.dsFinish')}</h3>
              <div className="flex gap-2">{(['steel', 'dark', 'crimson'] as const).map((d) => <Btn key={d} kind={prof.cosm.ds === d ? 'primary' : undefined} onClick={() => setCosm({ ds: d })}>{t('cosm.ds.' + d)}</Btn>)}</div>
            </div>
            <div className="panel p-4">
              <h3 className="mb-2 text-sm uppercase tracking-[0.3em] text-[#c9a870]">{t('ex.cape')}</h3>
              <div className="flex gap-2">{(['black', 'crimson', 'brown'] as const).map((c) => <Btn key={c} kind={prof.cosm.cape === c ? 'primary' : undefined} onClick={() => setCosm({ cape: c })}>{t('cosm.cape.' + c)}</Btn>)}</div>
            </div>
            <div className="panel p-4">
              <h3 className="mb-2 text-sm uppercase tracking-[0.3em] text-[#c9a870]">{t('ex.titleSel')}</h3>
              <div className="flex flex-wrap gap-2">
                <Btn kind={!prof.cosm.title ? 'primary' : undefined} onClick={() => setCosm({ title: '' })}>—</Btn>
                {Object.keys(prof.ach).map((id) => <Btn key={id} kind={prof.cosm.title === id ? 'primary' : undefined} className="!px-3 !py-1 !text-xs" onClick={() => setCosm({ title: id })}>{t('ach.' + id)}</Btn>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
