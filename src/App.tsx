import { useEffect, useRef, useState } from 'react';
import Menu from './ui/Menu';
import Campaign from './ui/Campaign';
import Shop from './ui/Shop';
import SettingsScreen from './ui/SettingsScreen';
import Game from './ui/Game';
import Multiplayer from './ui/Multiplayer';
import ProfileScreen from './ui/ProfileScreen';
import Extras from './ui/Extras';
import { evalAchs, ExtraMode, MODE_LEVEL } from './extras';
import { MISSIONS, BOUNTIES } from './camp';
import Results, { ResultView } from './ui/Results';
import { EndResult } from './game/engine';
import { Save, loadSlot, saveSlot, newSave, setSettings, useSettings, migrateLegacy, latestSlot, storageError } from './save';
import { DIFFS } from './data';
import * as Prof from './profile';
import * as A from './audio';

type Screen = 'menu' | 'campaign' | 'shop' | 'settings' | 'game' | 'results' | 'multiplayer' | 'profile' | 'extras' | 'camp';
const clone = (s: Save): Save => JSON.parse(JSON.stringify(s));

export default function App() {
  const st = useSettings();
  const [migrated] = useState(() => migrateLegacy());
  const [slot, setSlotState] = useState(() => {
    const cur = st.slot;
    if (loadSlot(cur)) return cur;
    const l = latestSlot();
    return l >= 0 ? l : cur;
  });
  const [save, setSave] = useState<Save | null>(() => loadSlot(slot));
  const [screen, setScreen] = useState<Screen>('menu');
  const [shopBack, setShopBack] = useState<Screen>('menu');
  const [level, setLevel] = useState(1);
  const [run, setRun] = useState(0);
  const [mode, setMode] = useState<'campaign' | ExtraMode>('campaign');
  const [result, setResult] = useState<ResultView | null>(null);
  const saveRef = useRef<Save | null>(save);
  saveRef.current = save;

  useEffect(() => { A.applyVolumes(); }, [st.audio]);
  useEffect(() => { if (screen !== 'game') A.startMusic('eclipse'); }, [screen]);
  useEffect(() => {
    const flush = () => { if (saveRef.current) saveSlot(saveRef.current); };
    const vis = () => { if (document.hidden) flush(); };
    window.addEventListener('beforeunload', flush); document.addEventListener('visibilitychange', vis);
    const iv = setInterval(flush, 20000);
    return () => { window.removeEventListener('beforeunload', flush); document.removeEventListener('visibilitychange', vis); clearInterval(iv); };
  }, []);

  const commit = (s: Save) => { saveSlot(s); setSave(s); };
  const pickSlot = (i: number) => { setSettings({ slot: i }); setSlotState(i); setSave(loadSlot(i)); };
  const startLevel = (lv: number) => {
    const s = saveRef.current; if (!s) return;
    const n = clone(s); n.attempts[lv] = (n.attempts[lv] || 0) + 1; n.current = lv; commit(n);
    Prof.statLevelStart(false);
    setMode('campaign'); setLevel(lv); setRun((r) => r + 1); setScreen('game');
  };
  const startExtra = (m: ExtraMode) => {
    if (!saveRef.current) return;
    Prof.statLevelStart(false);
    setMode(m); setLevel(MODE_LEVEL[m]); setRun((r) => r + 1); setScreen('game');
  };
  const goCamp = () => {
    let s = saveRef.current;
    if (!s) { s = newSave(slot); commit(s); saveRef.current = s; }
    setRun((r) => r + 1); setScreen('camp');
  };
  const newCampaign = () => { const n = newSave(slot); commit(n); saveRef.current = n; setSettings({ slot }); startLevel(1); };
  const onEnd = (r: EndResult) => {
    const s0 = saveRef.current; if (!s0) return;
    const s = clone(s0);
    if (r.mode && r.mode !== 'campaign') { // modos extras: recompensas e recordes próprios
      if (r.mode !== 'training') {
        const earned = Math.floor(r.combat * 0.5 * DIFFS[s.difficulty || 'medium'].points);
        s.points += earned; s.totalEarned += earned; commit(s); saveRef.current = s;
        if (r.mode === 'arena') { Prof.setRecord('arenaWave', r.wave || 0); Prof.setRecord('arenaScore', r.combat); }
        if (r.mode === 'survival') { Prof.setRecord('survWave', r.wave || 0); Prof.setRecord('survScore', r.combat); }
        if (r.mode === 'defense') Prof.setRecord('defWave', r.wave || 0);
        if (r.mode === 'dungeon' && r.win) Prof.addDungeonClear();
        setResult({ win: r.win, kills: r.kills, time: r.time, combat: r.combat, bonus: 0, mult: 0.5, replay: false, earned, total: s.points, level: r.level, relics: r.relics, boss: r.boss, wave: r.wave, mode: r.mode });
        evalAchs(s); setScreen('results'); return;
      }
      evalAchs(s); setScreen('extras'); return; // treinamento: sem recompensas
    }
    const dmul = DIFFS[s.difficulty || 'medium'].points;
    const replay = s.completed.includes(r.level), bonus = r.win ? 100 : 0, mult = (replay ? 0.5 : 1) * (r.win ? 1 : 0.5) * dmul;
    let earned = Math.floor((r.combat + bonus) * mult);
    // contratos e procurados (recompensa única)
    if (r.side) {
      if (r.side.mission && r.side.missionOk) earned += MISSIONS.find((m) => m.id === r.side!.mission)?.reward || 0;
      if (r.side.bounty && r.side.bountyOk && !s.side.bountiesDone.includes(r.side.bounty)) { earned += BOUNTIES.find((b) => b.id === r.side!.bounty)?.reward || 0; s.side.bountiesDone.push(r.side.bounty); }
    }
    if (s.side.forLvl === r.level) { s.side.mission = null; s.side.bounty = null; s.side.forLvl = 0; } // contrato consumido
    s.points += earned; s.totalEarned += earned;
    if (r.win) {
      if (!s.completed.includes(r.level)) s.completed.push(r.level);
      s.unlocked = Math.max(s.unlocked, Math.min(10, r.level + 1)); s.current = Math.min(10, r.level + 1);
      if (r.boss && !s.bosses.includes(r.boss)) s.bosses.push(r.boss);
      if (r.level === 4 && !s.allies.includes('isidro')) { s.allies.push('isidro'); if (s.active.filter((a) => a !== 'puck').length < 2) s.active.push('isidro'); } // Isidro junta-se ao bando pela história
      Prof.statLevelComplete('guts', earned, false);
    }
    commit(s); saveRef.current = s;
    evalAchs(s);
    setResult({ win: r.win, kills: r.kills, time: r.time, combat: r.combat, bonus, mult, replay, earned, total: s.points, level: r.level, relics: r.relics, boss: r.boss });
    setScreen('results');
  };

  let view;
  if (screen === 'menu') view = (
    <Menu slot={slot} save={save} migrated={migrated} onSlot={pickSlot}
      onContinue={() => { const l = latestSlot(); if (l >= 0 && l !== slot) pickSlot(l); goCamp(); }}
      onNew={newCampaign} onLevels={() => setScreen('campaign')} onShop={() => { setShopBack('menu'); setScreen('shop'); }} onSettings={() => setScreen('settings')}
      onOnline={() => { if (!save) { const n = newSave(slot); commit(n); saveRef.current = n; } setScreen('multiplayer'); }} onProfile={() => setScreen('profile')}
      onExtras={() => { if (!save) { const n = newSave(slot); commit(n); saveRef.current = n; } setScreen('extras'); }}
      onDelete={(i) => { if (i === slot) setSave(null); }} />
  );
  else if (screen === 'campaign' && save) view = <Campaign save={save} onStart={startLevel} onBack={() => setScreen('menu')} onDifficulty={(d) => commit({ ...save, difficulty: d })} onHero={(h) => commit({ ...save, hero: h })} />;
  else if (screen === 'shop' && save) view = <Shop save={save} onChange={commit} onBack={() => setScreen(shopBack)} />;
  else if (screen === 'settings') view = <SettingsScreen onBack={() => setScreen('menu')} />;
  else if (screen === 'profile') view = <ProfileScreen onBack={() => setScreen('menu')} />;
  else if (screen === 'extras' && save) view = <Extras save={save} onPlay={startExtra} onBack={() => setScreen('menu')} />;
  else if (screen === 'camp' && save) view = <Game key={'camp' + run} level={Math.min(10, save.current)} mode="camp" save={save} onSave={commit} onEnd={() => setScreen('menu')} onExit={() => setScreen('menu')} onDepart={() => startLevel(Math.min(10, save.current))} onPlayDefense={() => startExtra('defense')} />;
  else if (screen === 'multiplayer' && save) view = <Multiplayer save={save} onBack={() => setScreen('menu')} />;
  else if (screen === 'game' && save) view = <Game key={run} level={level} mode={mode} save={save} onSave={commit} onEnd={onEnd} onExit={() => setScreen('menu')} />;
  else if (screen === 'results' && result) view = (
    <Results r={result} onShop={() => { setShopBack('results'); setScreen('shop'); }}
      onNext={() => (result.mode && result.mode !== 'campaign' ? startExtra(result.mode as ExtraMode) : startLevel(Math.min(10, result.level + 1)))}
      onAgain={() => (result.mode && result.mode !== 'campaign' ? startExtra(result.mode as ExtraMode) : startLevel(result.level))}
      onCampaign={() => { if (result.mode && result.mode !== 'campaign') setScreen('extras'); else goCamp(); }} onMenu={() => setScreen('menu')} />
  );
  else view = <Menu slot={slot} save={save} migrated={0} onSlot={pickSlot} onContinue={() => setScreen('campaign')} onNew={newCampaign} onLevels={() => setScreen('campaign')} onShop={() => setScreen('shop')} onSettings={() => setScreen('settings')} onOnline={() => setScreen('multiplayer')} onProfile={() => setScreen('profile')} onDelete={() => setSave(null)} />;

  return (
    <div className="h-full w-full">
      {view}
      {storageError.msg && screen !== 'menu' && <div className="fixed bottom-2 left-1/2 z-[60] -translate-x-1/2 bg-red-900/90 px-4 py-2 text-xs text-white">⚠ {storageError.msg}</div>}
    </div>
  );
}
