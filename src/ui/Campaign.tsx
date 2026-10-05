import { Btn } from './common';
import { t } from '../i18n';
import { Save, useSettings } from '../save';
import { LEVELS, ENEMIES } from '../data';

const THEME_GRAD: Record<string, string> = {
  camp: 'from-sky-700 via-amber-200/60 to-emerald-800', fort: 'from-slate-600 to-stone-700', hall: 'from-amber-600 to-amber-900', siege: 'from-red-900 to-orange-950',
  forest: 'from-emerald-900 to-green-950', eclipse: 'from-black to-red-950', valley: 'from-purple-900 to-indigo-950', flesh: 'from-red-800 to-rose-950', altar: 'from-black to-rose-950', falconia: 'from-white via-amber-100 to-amber-300',
};

export default function Campaign(p: { save: Save; onStart: (lv: number) => void; onBack: () => void; onDifficulty: (d: 'easy' | 'medium' | 'hard') => void; onHero: (h: 'guts' | 'caska') => void }) {
  useSettings();
  const s = p.save;
  return (
    <div className="menu-bg h-full w-full overflow-auto p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="title-glow text-2xl font-bold tracking-[0.2em] md:text-3xl">{t('camp.title')}</h1>
          <Btn onClick={p.onBack}>← {t('back')}</Btn>
        </div>
        <div className="panel mb-4 p-3">
          <div className="mb-2 text-xs uppercase tracking-[0.3em] text-[#c9a870]">{t('hero.title')}</div>
          <div className="grid gap-2 md:grid-cols-2">
            {(['guts', 'caska'] as const).map((h) => (
              <button key={h} onClick={() => p.onHero(h)} className={`flex items-center gap-3 border px-3 py-2 text-left transition ${s.hero === h ? 'border-amber-500 bg-red-950/50' : 'border-white/10 bg-black/30 hover:border-amber-700/60'}`}>
                <span className="text-2xl">{h === 'guts' ? '⚔️' : '🦅'}</span>
                <span><span className="block text-sm font-bold tracking-widest">{h === 'guts' ? 'Guts' : 'Caska'}</span>
                  <span className="block text-[11px] text-[#b8a890]">{t('hero.' + h + '.d')}</span></span>
              </button>
            ))}
          </div>
        </div>
        <div className="panel mb-4 p-3">
          <div className="mb-2 text-xs uppercase tracking-[0.3em] text-[#c9a870]">{t('diff.title')}</div>
          <div className="grid gap-2 md:grid-cols-3">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button key={d} onClick={() => p.onDifficulty(d)} className={`border px-3 py-2 text-left transition ${s.difficulty === d ? 'border-amber-500 bg-red-950/50' : 'border-white/10 bg-black/30 hover:border-amber-700/60'}`}>
                <div className="text-sm font-bold tracking-widest">{t('diff.' + d)}</div>
                <div className="text-[11px] text-[#b8a890]">{t('diff.' + d + '.d')}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {LEVELS.map((l) => {
            const done = s.completed.includes(l.id), unlocked = l.id <= s.unlocked, boss = l.boss;
            return (
              <div key={l.id} className={`panel flex gap-3 p-3 ${unlocked ? '' : 'opacity-50'} ${s.current === l.id ? 'ring-1 ring-amber-500/70' : ''}`}>
                <div className={`flex h-24 w-20 shrink-0 flex-col items-center justify-center border border-black bg-gradient-to-b ${THEME_GRAD[l.theme]}`}>
                  <span className="text-3xl font-black text-black/70 drop-shadow-[0_0_4px_rgba(255,255,255,.6)]">{l.id}</span>
                  <span className="text-[10px] uppercase tracking-widest text-black/70">{done ? '✔' : unlocked ? '' : '🔒'}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate text-lg font-bold tracking-wide">{t(`lv.${l.id}.t`)}</h3>
                    <span className={`shrink-0 text-[10px] uppercase tracking-widest ${done ? 'text-emerald-400' : unlocked ? 'text-amber-300' : 'text-zinc-500'}`}>{done ? t('camp.done') : unlocked ? '' : t('camp.locked')}</span>
                  </div>
                  <div className="text-xs italic text-[#c9a870]">{t(`lv.${l.id}.s`)}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-[#b8a890]">{t(`lv.${l.id}.d`)}</p>
                  <div className="mt-1 text-[11px] text-[#a89880]">
                    <b>{t('camp.kills')}:</b> {l.kills || t('camp.noKills')}
                    {l.mini.length > 0 && <> · <b>{t('camp.mini')}:</b> {l.mini.map((m) => t('e.' + m)).join(', ')}</>}
                    {l.behelits > 0 && <> · <b>{t('camp.behelits')}:</b> {l.behelits}</>}
                  </div>
                  <div className="text-[11px] text-red-300"><b>{t('camp.boss')}:</b> {t('boss.' + boss)}</div>
                  {Object.keys(l.groups).length > 0 && <div className="truncate text-[10px] text-[#8a7a68]">{Object.keys(l.groups).filter((k) => ENEMIES[k]).map((k) => t('e.' + k)).join(' · ')}</div>}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-[#8a7a68]">{t('camp.attempts')}: {s.attempts[l.id] || 0}</span>
                    <Btn kind={done ? undefined : 'primary'} disabled={!unlocked} onClick={() => p.onStart(l.id)} className="!px-4 !py-1 !text-xs">{done ? t('camp.repeat') : t('camp.start')}</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
