import React from 'react';
import * as A from '../audio';
import { t } from '../i18n';

export function Btn(p: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'primary' | 'danger' | 'ghost'; className?: string; title?: string }) {
  return (
    <button
      title={p.title}
      disabled={p.disabled}
      onClick={() => { A.resume(); A.sfx('ui'); p.onClick?.(); }}
      className={`btn ${p.kind === 'primary' ? 'btn-primary' : p.kind === 'danger' ? 'btn-danger' : ''} ${p.className || ''}`}
    >
      {p.children}
    </button>
  );
}

export function Modal(p: { text: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 fade-in">
      <div className="panel max-w-md p-6 text-center">
        <p className="mb-6 text-lg leading-relaxed">{p.text}</p>
        <div className="flex justify-center gap-3">
          <Btn kind="danger" onClick={p.onYes}>{t('yes')}</Btn>
          <Btn onClick={p.onNo}>{t('no')}</Btn>
        </div>
      </div>
    </div>
  );
}

export function Bar(p: { v: number; max: number; color: string; h?: number; w?: number | string; back?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (p.v / (p.max || 1)) * 100));
  return (
    <div className="relative overflow-hidden border border-black/80 shadow-[0_0_0_1px_rgba(200,160,100,.35)]" style={{ height: p.h ?? 14, width: p.w ?? '100%', background: p.back ?? '#150a0a' }}>
      <div className="h-full transition-[width] duration-100" style={{ width: pct + '%', background: p.color }} />
      {p.label && <span className="absolute inset-0 flex items-center justify-center text-[10px] tracking-widest text-white/90 drop-shadow">{p.label}</span>}
    </div>
  );
}

export function Pips({ n, max }: { n: number; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`h-2.5 w-5 border border-black ${i < n ? 'bg-gradient-to-b from-amber-300 to-amber-700' : 'bg-zinc-800'}`} />
      ))}
    </div>
  );
}

const ALLY_EMOJI: Record<string, string> = { puck: '🧚', serpico: '🌪️', schierke: '🔮', farnese: '✝️', roderick: '🔱', caska: '🦅', ivalera: '🧚‍♀️' };
export function AllyBars({ bars, title }: { bars: { id: string; hp: number; maxHp: number; down: boolean }[]; title: string }) {
  if (!bars.length) return null;
  return (
    <div className="pointer-events-none flex flex-col gap-1">
      <div className="text-[9px] uppercase tracking-[0.25em] text-[#c9a870]">{title}</div>
      {bars.slice(0, 5).map((b) => (
        <div key={b.id} className="flex items-center gap-1.5">
          <span className="w-4 text-center text-xs">{ALLY_EMOJI[b.id] || '•'}</span>
          <div className="relative h-2.5 w-24 overflow-hidden border border-black/80 bg-[#150a0a]">
            <div className="h-full transition-[width] duration-150" style={{ width: Math.max(0, (b.hp / (b.maxHp || 1)) * 100) + '%', background: b.down ? '#555' : 'linear-gradient(180deg,#5aa0e0,#1e4a7a)' }} />
          </div>
          <span className="w-8 text-[9px] text-[#a89880]">{b.down ? '✖' : Math.ceil(b.hp)}</span>
        </div>
      ))}
    </div>
  );
}
export function DiffPicker({ value, onChange }: { value: string; onChange: (d: 'easy' | 'medium' | 'hard') => void }) {
  return (
    <div className="flex flex-col gap-1">
      {(['easy', 'medium', 'hard'] as const).map((d) => (
        <button key={d} onClick={() => { A.sfx('ui'); onChange(d); }} className={`border px-3 py-2 text-left transition ${value === d ? 'border-amber-500 bg-red-950/50' : 'border-white/10 bg-black/30 hover:border-amber-700/60'}`}>
          <div className="text-sm font-bold tracking-widest">{t('diff.' + d)}</div>
          <div className="text-[11px] text-[#b8a890]">{t('diff.' + d + '.d')}</div>
        </button>
      ))}
    </div>
  );
}
export function Embers() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <span key={i} className="ember" style={{ left: (i * 37) % 100 + '%', animationDuration: 6 + ((i * 13) % 9) + 's', animationDelay: -((i * 7) % 10) + 's', width: 2 + (i % 3), height: 2 + (i % 3) }} />
      ))}
    </div>
  );
}
