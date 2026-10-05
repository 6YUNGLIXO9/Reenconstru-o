import { useState } from 'react';
import { Btn, Pips } from './common';
import { t } from '../i18n';
import { Save, useSettings, storageError } from '../save';
import { GUTS_UPS, CASKA_UPS, ARMOR_COST, CLOAK_COST, ALLY_COST, ALLY_ICON, MAX_ACTIVE, gutsStats, caskaStats } from '../data';
import * as A from '../audio';

const clone = (s: Save): Save => JSON.parse(JSON.stringify(s));

export default function Shop(p: { save: Save; onChange: (s: Save) => void; onBack?: () => void; embedded?: boolean }) {
  useSettings();
  const s = p.save;
  const [tab, setTab] = useState('guts');
  const [note, setNote] = useState('');
  const buy = (cost: number, label: string, fn: (x: Save) => void) => {
    if (s.points < cost) { setNote(t('shop.nopoints')); A.sfx('warn'); return; }
    const n = clone(s); n.points -= cost; n.spent += cost; n.history.push({ t: Date.now(), item: label, cost }); fn(n); A.sfx('buy'); setNote(''); p.onChange(n);
  };
  const edit = (fn: (x: Save) => void) => { const n = clone(s); fn(n); p.onChange(n); };
  const gs = gutsStats(s), cs = caskaStats(s.cups, s.cloakEq);

  const UpCard = (k: string, def: { icon: string; costs: number[] }, lv: number, ns: 'up' | 'cup') => {
    const max = lv >= 5, cost = def.costs[lv];
    return (
      <div key={ns + k} className="panel flex items-center gap-3 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-amber-700/50 bg-black/50 text-2xl">{def.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between"><b className="tracking-wide">{t(`${ns}.${k}`)}</b><span className="text-[10px] uppercase text-[#a89880]">{t('shop.level')} {lv}/5</span></div>
          <div className="text-xs text-[#b8a890]">{t(`${ns}.${k}.d`)}</div>
          <div className="mt-1"><Pips n={lv} max={5} /></div>
        </div>
        <Btn disabled={max} kind={max ? undefined : 'primary'} className="!px-3 !py-1 !text-xs w-28 shrink-0" onClick={() => buy(cost, `${t(`${ns}.${k}`)} ${lv + 1}`, (x) => { (ns === 'up' ? x.ups : x.cups)[k] = lv + 1; })}>
          {max ? t('shop.max') : `${t('shop.buy')} · ${cost}`}
        </Btn>
      </div>
    );
  };
  const tabs: [string, string][] = [['guts', t('shop.guts') || 'Guts'], ['armor', t('shop.armor')], ['allies', t('shop.allies')], ['caska', t('shop.caska') || 'Caska'], ['history', t('shop.history')]];

  return (
    <div className={`${p.embedded ? '' : 'menu-bg'} h-full w-full overflow-auto p-4 md:p-8`}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="title-glow text-2xl font-bold tracking-[0.2em] md:text-3xl">{t('shop.title')}</h1>
          {p.onBack && <Btn onClick={p.onBack}>← {t('back')}</Btn>}
        </div>
        <div className="panel mb-4 flex flex-wrap items-center gap-x-8 gap-y-1 px-4 py-3 text-sm">
          <span className="text-xl font-bold text-amber-300">🪙 {s.points} <span className="text-xs font-normal uppercase tracking-widest text-[#a89880]">{t('shop.points')}</span></span>
          <span className="text-[#a89880]">{t('shop.spent')}: <b className="text-[#e8dccb]">{s.spent}</b></span>
          <span className="text-[#a89880]">{t('shop.earned')}: <b className="text-[#e8dccb]">{s.totalEarned}</b></span>
          {note && <span className="text-red-400">{note}</span>}
          {storageError.msg && <span className="text-red-400">⚠ {storageError.msg}</span>}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map(([id, label]) => <Btn key={id} kind={tab === id ? 'primary' : undefined} onClick={() => setTab(id)} className="!px-4 !py-1.5">{label}</Btn>)}
        </div>

        {tab === 'guts' && (
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(GUTS_UPS).map(([k, d]) => UpCard(k, d, s.ups[k] || 0, 'up'))}
            <div className="panel p-3 text-xs text-[#c8b8a0] md:col-span-2">
              <b className="mb-1 block uppercase tracking-widest text-[#c9a870]">{t('shop.stats')}</b>
              HP {gs.maxHp} · {t('up.dmg')} ×{gs.dmgMul.toFixed(2)} · {t('up.def')} ×{gs.takeMul.toFixed(2)} · {t('hud.stam')} {gs.maxStam} (+{gs.regen.toFixed(0)}/s) · {t('hud.rage')} {gs.rageDur.toFixed(1)}s ×{gs.rageMul.toFixed(2)}
              <div className="mt-2"><b>{t('shop.weapons')}:</b> Dragon Slayer · {t('k.cannon')} (120) · {t('k.xbow')} (17×12)</div>
            </div>
          </div>
        )}

        {tab === 'armor' && (
          <div className="panel flex flex-col gap-3 p-4 md:flex-row">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center border border-red-900/60 bg-gradient-to-b from-zinc-900 to-black text-6xl">⛓️</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold tracking-wide text-red-300">{t('armor.name')}</h3>
              <p className="text-xs text-[#b8a890]">{t('armor.d')}</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-[#d8c8b0]"><li>{t('armor.b1')}</li><li>{t('armor.b2')}</li><li>{t('armor.b3')}</li><li className="text-red-400">{t('armor.b4')}</li></ul>
              <div className="mt-3 flex items-center gap-3">
                {!s.armor ? <Btn kind="primary" onClick={() => buy(ARMOR_COST, t('armor.name'), (x) => { x.armor = true; x.armorEq = true; })}>{t('shop.buy')} · {ARMOR_COST}</Btn>
                  : <Btn kind={s.armorEq ? 'danger' : 'primary'} onClick={() => edit((x) => { x.armorEq = !x.armorEq; })}>{s.armorEq ? t('shop.unequip') : t('shop.equip')}</Btn>}
                {s.armor && <span className="text-xs uppercase tracking-widest text-emerald-400">{s.armorEq ? t('shop.equipped') : t('shop.owned')}</span>}
              </div>
            </div>
          </div>
        )}

        {tab === 'allies' && (
          <div className="grid gap-3 md:grid-cols-2">
            <p className="text-xs text-[#a89880] md:col-span-2">{t('shop.allyLimit', { n: MAX_ACTIVE })}</p>
            {Object.keys(ALLY_COST).map((id) => {
              const griff = id === 'griffith1' || id === 'griffith2' || id === 'isidro'; // desbloqueios por história/segredo (nunca vendidos)
              const unlocked = !griff || (id === 'griffith1' ? s.secret.g1 : id === 'griffith2' ? s.secret.g2 : s.allies.includes('isidro'));
              const own = s.allies.includes(id) && unlocked, on = s.active.includes(id), cost = ALLY_COST[id];
              const nActive = s.active.filter((a) => a !== 'puck').length;
              const canOn = on || (nActive < MAX_ACTIVE && !(id === 'griffith1' && s.active.includes('griffith2')) && !(id === 'griffith2' && s.active.includes('griffith1')));
              return (
                <div key={id} className={`panel flex items-center gap-3 p-3 ${on ? 'ring-1 ring-emerald-500/60' : ''} ${griff && !unlocked ? 'opacity-70' : ''}`}>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-amber-700/50 bg-black/50 text-3xl">{griff && !unlocked ? '🔒' : ALLY_ICON[id]}</div>
                  <div className="min-w-0 flex-1">
                    <b className="tracking-wide">{t('ally.' + id)}</b>
                    <div className="text-xs text-[#b8a890]">{griff && !unlocked ? t(`ally.${id}.lock`) : t(`ally.${id}.d`)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-[#8a7a68]">{griff ? (unlocked ? t('shop.secretFree') : t('shop.locked')) : cost ? `🪙 ${cost}` : t('shop.free')}{own && ` · ${t('shop.owned')}`}</div>
                  </div>
                  {griff && !unlocked ? <span className="w-28 text-center text-[10px] uppercase tracking-widest text-zinc-500">{t('shop.locked')}</span>
                    : own ? <Btn kind={on ? 'danger' : 'primary'} disabled={!on && !canOn} title={!on && !canOn ? t('shop.allyLimit', { n: MAX_ACTIVE }) : undefined} className="!px-3 !py-1 !text-xs w-28" onClick={() => edit((x) => { x.active = on ? x.active.filter((a) => a !== id) : [...x.active, id]; })}>{on ? t('shop.deactivate') : t('shop.activate')}</Btn>
                      : <Btn kind="primary" className="!px-3 !py-1 !text-xs w-28" onClick={() => buy(cost, t('ally.' + id), (x) => { x.allies.push(id); if (x.active.filter((a) => a !== 'puck').length < MAX_ACTIVE) x.active.push(id); })}>{t('shop.buy')} · {cost}</Btn>}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'caska' && (
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(CASKA_UPS).map(([k, d]) => UpCard(k, d, s.cups[k] || 0, 'cup'))}
            <div className="panel flex items-center gap-3 p-3 md:col-span-2">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-amber-500/60 bg-gradient-to-b from-indigo-900 to-black text-3xl">🧣</div>
              <div className="flex-1"><b className="text-amber-300">{t('cloak.name')}</b><div className="text-xs text-[#b8a890]">{t('cloak.d')}</div></div>
              {!s.cloak ? <Btn kind="primary" className="!px-3 !py-1 !text-xs" onClick={() => buy(CLOAK_COST, t('cloak.name'), (x) => { x.cloak = true; x.cloakEq = true; })}>{t('shop.buy')} · {CLOAK_COST}</Btn>
                : <Btn kind={s.cloakEq ? 'danger' : 'primary'} className="!px-3 !py-1 !text-xs" onClick={() => edit((x) => { x.cloakEq = !x.cloakEq; })}>{s.cloakEq ? t('shop.unequip') : t('shop.equip')}</Btn>}
            </div>
            <div className="panel p-3 text-xs text-[#c8b8a0] md:col-span-2">
              HP {cs.hp.toFixed(0)} · {t('up.dmg')} ×{cs.dmg.toFixed(2)} · {t('hud.stam')} {cs.stam.toFixed(0)} (+{cs.regen.toFixed(0)}) · ×{cs.spd.toFixed(2)} · {t('cup.det')} {cs.detDur.toFixed(1)}s / {cs.detCd}s
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="panel max-h-[60vh] overflow-auto p-3 text-sm">
            {s.history.length === 0 && <p className="text-[#a89880]">{t('shop.nohist')}</p>}
            {[...s.history].reverse().map((h, i) => (
              <div key={i} className="flex justify-between border-b border-white/5 py-1.5"><span>{h.item}</span><span className="text-amber-300">-{h.cost}</span><span className="text-xs text-[#8a7a68]">{new Date(h.t).toLocaleString()}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
