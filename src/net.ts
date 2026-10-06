// Multiplayer online REAL via WebRTC (DataChannel) usando o broker público do PeerJS para sinalização.
// Host = Guts (autoridade da simulação). Cliente = Caska (renderiza estado recebido, envia input).
// Dependência externa real: broker público peerjs.com. Se estiver indisponível/bloqueado, a conexão falha com erro claro.
import Peer, { DataConnection } from 'peerjs';

export type NetMsg =
  | { t: 'hello'; name: string; id: string }
  | { t: 'lobby'; host: { name: string; ready: boolean }; guest: { name: string; ready: boolean } | null }
  | { t: 'ready'; v: boolean }
  | { t: 'cfg'; difficulty: 'easy' | 'medium' | 'hard'; level: number }
  | { t: 'start'; level: number; seedSave: any }
  | { t: 'snap'; d: any }
  | { t: 'input'; d: any }
  | { t: 'end'; d: any }
  | { t: 'bye' }
  | { t: 'ping'; s: number } | { t: 'pong'; s: number };

const PREFIX = 'bers-eclipse-';
export const ROOM_RE = /^[A-Z0-9]{4}-[0-9]{4}$/;
export function genCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let a = ''; for (let i = 0; i < 4; i++) a += L[Math.floor(Math.random() * L.length)];
  return a + '-' + Math.floor(1000 + Math.random() * 9000);
}
const peerId = (code: string) => PREFIX + code.toUpperCase();

export type NetRole = 'host' | 'guest';
export interface NetHandlers {
  onOpen?: () => void;
  onPeer?: (open: boolean) => void;   // conexão com o outro jogador
  onMsg?: (m: NetMsg) => void;
  onError?: (msg: string) => void;
  onClose?: () => void;
}

export class Net {
  peer: Peer | null = null; conn: DataConnection | null = null; role: NetRole; code: string;
  h: NetHandlers; alive = true; ping = 0; lastRecv = 0; retry = 0;
  constructor(role: NetRole, code: string, h: NetHandlers) { this.role = role; this.code = code.toUpperCase(); this.h = h; }

  start() {
    try {
      // host usa o código como ID; guest usa ID aleatório e conecta ao ID do host
      this.peer = this.role === 'host' ? new Peer(peerId(this.code), { debug: 1 }) : new Peer({ debug: 1 });
    } catch (e) { this.h.onError?.('Falha ao iniciar rede: ' + String(e)); return; }
    const p = this.peer;
    const to = setTimeout(() => { if (this.alive && !this._opened) this.h.onError?.('Tempo esgotado ao contatar o servidor de sinalização.'); }, 12000);
    p.on('open', () => { this._opened = true; clearTimeout(to); this.h.onOpen?.(); if (this.role === 'guest') this.doConnect(); });
    p.on('connection', (c) => { if (this.conn && this.conn.open) { c.close(); return; } this.bind(c); });
    p.on('error', (err: any) => {
      const type = err?.type || '';
      let msg = String(err?.message || err);
      if (type === 'unavailable-id') msg = 'Este código já está em uso. Gere outro.';
      else if (type === 'peer-unavailable') msg = 'Sala não encontrada. Verifique o código.';
      else if (type === 'network' || type === 'server-error' || type === 'socket-error') msg = 'Falha de conexão com o servidor de sinalização.';
      else if (type === 'browser-incompatible') msg = 'Navegador incompatível com WebRTC.';
      this.h.onError?.(msg);
    });
    p.on('disconnected', () => { if (this.alive) { try { p.reconnect(); } catch { /* */ } } });
  }
  _opened = false;
  doConnect() {
    if (!this.peer) return;
    const c = this.peer.connect(peerId(this.code), { reliable: true });
    this.bind(c);
  }
  bind(c: DataConnection) {
    this.conn = c;
    c.on('open', () => { this.lastRecv = performance.now(); this.h.onPeer?.(true); });
    c.on('data', (d: any) => { console.log('REDE RECEBEU:', d); this.lastRecv = performance.now(); const m = d as NetMsg; if (m.t === 'ping') this.send({ t: 'pong', s: m.s }); else if (m.t === 'pong') this.ping = performance.now() - m.s; else this.h.onMsg?.(m); });
    c.on('close', () => { this.h.onPeer?.(false); this.h.onClose?.(); });
    c.on('error', () => { this.h.onPeer?.(false); });
  }
  send(m: NetMsg) { try { if (this.conn && this.conn.open) this.conn.send(m); } catch { /* */ } }
  connected() { return !!(this.conn && this.conn.open); }
  measurePing() { this.send({ t: 'ping', s: performance.now() }); }
  destroy() { this.alive = false; try { this.send({ t: 'bye' }); } catch { /* */ } try { this.conn?.close(); } catch { /* */ } try { this.peer?.destroy(); } catch { /* */ } this.conn = null; this.peer = null; }
}
