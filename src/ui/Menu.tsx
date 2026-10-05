import { useState } from 'react';
import { Btn, Embers, Modal } from './common';
import { t } from '../i18n';
import { Save, loadSlot, deleteSlot, useSettings, storageError } from '../save';

export default function Menu(p: {
  slot: number; save: Save | null; migrated: number;
  onSlot: (i: number) => void; onContinue: () => void; onNew: () => void; onLevels: () => void; onShop: () => void; onSettings: () => void; onDelete: (i: number) => void; onOnline: () => void; onProfile: () => void; onExtras?: () => void;
}) {
  useSettings();
  const [confirm, setConfirm] = useState<null | 'new' | number>(null);
  const [msg, setMsg] = useState('');
  const slots = [0, 1, 2].map((i) => loadSlot(i));
  const need = (f: () => void) => () => { if (!p.save) setMsg(t('menu.needCampaign')); else f(); };
  return (
    <div className="menu-bg relative flex h-full w-full items-center overflow-auto">
      <Embers />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-start gap-10 px-8 py-8 md:flex-row md:items-center md:justify-between">
        <div className="fade-in">
          <h1 className="title-glow text-5xl font-black tracking-[0.25em] text-[#f0e0c8] md:text-7xl">BERSERK</h1>
          <h2 className="title-glow -mt-1 text-3xl font-bold tracking-[0.7em] text-[#c0281c] md:text-5xl">ECLIPSE</h2>
          <p className="mt-4 max-w-md text-sm italic text-[#c8b8a0]">{t('app.tag')}</p>
          <p className="mt-1 text-xs text-[#8a7a68]">{t('menu.noacc')}</p>
          <div className="mt-8 flex w-72 flex-col gap-2">
            <Btn kind="primary" className="!py-3 !text-base" onClick={() => (p.save ? p.onContinue() : p.onNew())}>⚔ {t('menu.start')}</Btn>
            <Btn className="!py-3" onClick={p.onOnline}>🌐 {t('mode.online')}</Btn>
            {p.onExtras && <Btn className="!py-3" onClick={p.onExtras}>✦ {t('menu.free')}</Btn>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Btn className="!px-2 !text-[11px]" onClick={() => (p.save ? setConfirm('new') : p.onNew())}>{t('menu.new')}</Btn>
              <Btn className="!px-2 !text-[11px]" onClick={need(p.onLevels)}>{t('menu.levels')}</Btn>
              <Btn className="!px-2 !text-[11px]" onClick={p.onProfile}>{t('mode.profile')}</Btn>
              <Btn className="!px-2 !text-[11px]" onClick={p.onSettings}>{t('menu.settings')}</Btn>
              <Btn className="!px-2 !text-[11px]" onClick={() => { setMsg(t('menu.exitMsg')); try { window.close(); } catch { /* */ } }}>{t('menu.exit')}</Btn>
            </div>
          </div>
          {msg && <p className="mt-4 max-w-xs text-sm text-amber-300 fade-in">{msg}</p>}
          {p.migrated > 0 && <p className="mt-2 max-w-xs text-sm text-emerald-300">{t('menu.migrated', { n: p.migrated })}</p>}
          {storageError.msg && <p className="mt-2 max-w-xs text-sm text-red-400">⚠ {storageError.msg}</p>}
        </div>
        <div className="panel w-full max-w-md p-4 fade-in">
          <h3 className="mb-3 text-sm uppercase tracking-[0.3em] text-[#c9a870]">{t('menu.slots')}</h3>
          <div className="flex flex-col gap-2">
            {slots.map((s, i) => (
              <div key={i} className={`flex items-center justify-between gap-2 border p-3 ${p.slot === i ? 'border-amber-500/80 bg-red-950/40' : 'border-white/10 bg-black/30'}`}>
                <div className="min-w-0">
                  <div className="text-sm font-bold tracking-wider">{t('menu.slot', { n: i + 1 })}</div>
                  <div className="truncate text-xs text-[#a89880]">{s ? t('menu.slotInfo', { l: s.current, p: s.points, c: s.completed.length }) : t('menu.empty')}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {p.slot !== i && <Btn className="!px-3 !py-1 !text-xs" onClick={() => p.onSlot(i)}>{t('menu.select')}</Btn>}
                  {s && <Btn kind="danger" className="!px-3 !py-1 !text-xs" onClick={() => setConfirm(i)}>✕</Btn>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {confirm === 'new' && <Modal text={t('menu.confirmNew')} onYes={() => { setConfirm(null); p.onNew(); }} onNo={() => setConfirm(null)} />}
      {typeof confirm === 'number' && <Modal text={t('menu.confirmDel', { n: confirm + 1 })} onYes={() => { deleteSlot(confirm); p.onDelete(confirm); setConfirm(null); }} onNo={() => setConfirm(null)} />}
    </div>
  );
}
