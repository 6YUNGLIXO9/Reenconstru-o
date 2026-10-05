import { useState } from 'react';
import { Btn, Embers } from './common';
import { t } from '../i18n';
import { useProfile, setName, validateName } from '../profile';
import { useSettings } from '../save';

const fmtT = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60); return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`; };

export default function ProfileScreen(p: { onBack: () => void }) {
  useSettings();
  const prof = useProfile();
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(prof.name);
  const [err, setErr] = useState('');
  const save = () => { const r = validateName(val); if (!r.ok) { setErr(t('nerr.' + r.error)); return; } setName(r.value); setEdit(false); setErr(''); };

  const Group = ({ title, rows }: { title: string; rows: [string, string | number][] }) => (
    <div className="panel p-4">
      <h3 className="mb-2 text-sm uppercase tracking-[0.3em] text-[#c9a870]">{title}</h3>
      {rows.map(([a, b]) => <div key={a} className="flex justify-between border-b border-white/5 py-1 text-sm"><span className="text-[#b8a890]">{a}</span><span className="font-bold">{b}</span></div>)}
    </div>
  );
  const c = (x: typeof prof.guts) => ([[t('st.cleared'), x.cleared], [t('st.kills'), x.kills], [t('st.bosses'), x.bosses], [t('st.dmgDealt'), Math.round(x.dmgDealt)], [t('st.dmgTaken'), Math.round(x.dmgTaken)], [t('st.specials'), x.specials], [t('st.time'), fmtT(x.time)]] as [string, string | number][]);

  return (
    <div className="menu-bg relative h-full w-full overflow-auto p-4 md:p-8">
      <Embers />
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="title-glow text-2xl font-bold tracking-[0.2em] md:text-3xl">{t('prof.title')}</h1>
          <Btn onClick={p.onBack}>← {t('back')}</Btn>
        </div>
        <div className="panel mb-4 flex flex-wrap items-center gap-3 p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-600/60 bg-gradient-to-b from-red-900 to-black text-3xl">⚔️</div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#c9a870]">{t('prof.name')}</div>
            {!edit ? <div className="text-2xl font-bold">{prof.name}</div> : (
              <div className="flex items-center gap-2">
                <input autoFocus value={val} maxLength={18} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} className="rounded border border-amber-700/60 bg-black/60 px-2 py-1 text-lg text-white outline-none" />
                <Btn kind="primary" className="!px-3 !py-1 !text-xs" onClick={save}>{t('prof.save')}</Btn>
                <Btn className="!px-3 !py-1 !text-xs" onClick={() => { setEdit(false); setVal(prof.name); setErr(''); }}>{t('cancel')}</Btn>
              </div>
            )}
            {err && <div className="text-xs text-red-400">{err}</div>}
            <div className="mt-1 text-[10px] text-[#8a7a68]">{t('prof.id')}: {prof.id.slice(0, 18)}…</div>
          </div>
          {!edit && <Btn onClick={() => { setVal(prof.name); setEdit(true); }}>{t('prof.edit')}</Btn>}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Group title={t('prof.g.general')} rows={[[t('st.cleared'), prof.general.cleared], [t('st.started'), prof.general.started], [t('st.completed'), prof.general.completed], [t('st.kills'), prof.general.kills], [t('st.bosses'), prof.general.bosses], [t('st.deaths'), prof.general.deaths], [t('st.points'), prof.general.points], [t('st.streak'), prof.general.bestStreak], [t('st.time'), fmtT(prof.general.time)]]} />
          <Group title={t('prof.g.online')} rows={[[t('st.started'), prof.online.started], [t('st.completed'), prof.online.completed], [t('st.coop'), prof.online.coopCleared], [t('st.kills'), prof.online.kills], [t('st.bosses'), prof.online.bosses], [t('st.time'), fmtT(prof.online.coopTime)]]} />
          <Group title={t('prof.g.guts')} rows={c(prof.guts)} />
          <Group title={t('prof.g.caska')} rows={c(prof.caska)} />
        </div>
      </div>
    </div>
  );
}
