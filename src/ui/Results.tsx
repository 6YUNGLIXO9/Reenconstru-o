import { Btn, Embers } from './common';
import { t } from '../i18n';
import { useSettings } from '../save';

export interface ResultView { win: boolean; kills: number; time: number; combat: number; bonus: number; mult: number; replay: boolean; earned: number; total: number; level: number; relics: number; boss: string | null; wave?: number; mode?: string }

export default function Results(p: { r: ResultView; onShop: () => void; onNext: () => void; onAgain: () => void; onCampaign: () => void; onMenu: () => void }) {
  useSettings();
  const r = p.r, mm = Math.floor(r.time / 60), ss = Math.floor(r.time % 60).toString().padStart(2, '0');
  const final = r.win && r.level === 10;
  const Row = ({ a, b, hl }: { a: string; b: string | number; hl?: boolean }) => <div className={`flex justify-between border-b border-white/5 py-1.5 ${hl ? 'text-lg font-bold text-amber-300' : 'text-sm'}`}><span className="text-[#c8b8a0]">{a}</span><span>{b}</span></div>;
  return (
    <div className="menu-bg relative flex h-full w-full items-center justify-center overflow-auto p-4">
      <Embers />
      <div className="panel fade-in relative z-10 w-full max-w-lg p-6">
        <h1 className={`title-glow mb-1 text-center text-4xl font-black tracking-[0.3em] ${r.win ? 'text-amber-200' : 'text-red-600'}`}>{r.win ? t('res.victory') : t('res.defeat')}</h1>
        <p className="mb-4 text-center text-xs italic text-[#c9a870]">{r.mode && r.mode !== 'campaign' ? t('mode.' + r.mode) : `${r.level}. ${t(`lv.${r.level}.t`)}`} {r.boss && `— ${t('boss.' + r.boss)}`}</p>
        {r.wave != null && r.mode !== 'campaign' && <Row a={t('ex.waves')} b={r.wave} hl />}
        <Row a={t('res.kills')} b={r.kills} />
        <Row a={t('res.time')} b={`${mm}:${ss}`} />
        <Row a={t('res.combat')} b={r.combat} />
        {r.relics > 0 && <Row a={t('res.relics')} b={r.relics} />}
        <Row a={t('res.bonus')} b={r.bonus} />
        <Row a={t('res.mult')} b={`×${r.mult}${r.replay ? ' (' + t('res.repeat') + ')' : ''}${!r.win ? ' (' + t('res.defeatMult') + ')' : ''}`} />
        <Row a={t('res.earned')} b={`+${r.earned}`} hl />
        <Row a={t('res.total')} b={r.total} />
        {final && <p className="mt-4 text-center text-sm italic text-amber-100">{t('res.final')}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Btn kind="primary" onClick={p.onCampaign}>{t('res.campaign')}</Btn>
          {r.win && !final ? <Btn onClick={p.onNext}>{t('res.next')}</Btn> : <Btn onClick={p.onAgain}>{t('res.again')}</Btn>}
          {r.win && !final && <Btn onClick={p.onAgain}>{t('res.again')}</Btn>}
          <Btn onClick={p.onMenu}>{t('res.menu')}</Btn>
        </div>
      </div>
    </div>
  );
}
