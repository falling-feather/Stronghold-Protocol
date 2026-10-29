// v4.0.0：WebSocket 网络适配器（连接 server/index.js）
// 仅承载房间/聊天/准备/开始信号；游戏状态同步留待 v4.1+
import { INetworkAdapter, NetworkEventHandler, NetworkPeerInfo, NetworkRole } from './INetworkAdapter';
import { getDefaultMpUrl } from './mpConfig';
import type { EscapedEnemy, FinalAssaultState, RoundOutcome } from '../core/GameEngine';
import type { DefenseFormation } from '../core/Battlefield';

export interface RoomInfo {
  id: string;
  name: string;
  count: number;
  capacity: number;
  started: boolean;
  readyCount: number;
}

export interface MultiplayerMatch {
  mapSeed: number;
  round: number;
  phase: 'PREP' | 'COMBAT' | 'DEFENSE' | 'ASSAULT' | 'SETTLE' | 'COMPLETE';
  stage: 'NORMAL' | 'FINAL';
  defenseHelperId?: string;
  assaultGroups: { simulatorId: string; members: DefenseFormation[] }[];
  assaultSimulatorId?: string;
  finalState?: FinalAssaultState;
  activeIds: string[];
  eliminatedIds: string[];
  readyIds: string[];
  finishedIds: string[];
  poolCounts: Record<string, number>;
}

export class WsAdapter implements INetworkAdapter {
  private ws: WebSocket | null = null;
  private url: string = '';
  private _role: NetworkRole | null = null;
  private _localPeer: NetworkPeerInfo | null = null;
  private _peers: NetworkPeerInfo[] = [];
  private handlers: Map<string, Set<NetworkEventHandler>> = new Map();
  private _currentRoomId: string | null = null;
  private _rooms: RoomInfo[] = [];
  private _match: MultiplayerMatch | null = null;
  private pendingPoolRequests = new Map<string, (ok: boolean) => void>();
  private nextRequest = 0;
  private nextFinalDamage = 0;

  get isConnected(): boolean { return !!this.ws && this.ws.readyState === WebSocket.OPEN; }
  get role(): NetworkRole | null { return this._role; }
  get localPeer(): NetworkPeerInfo | null { return this._localPeer; }
  get peers(): NetworkPeerInfo[] { return this._peers.slice(); }
  get currentRoomId(): string | null { return this._currentRoomId; }
  get rooms(): RoomInfo[] { return this._rooms.slice(); }
  get match(): MultiplayerMatch | null { return this._match; }

  connect(url: string, name: string): Promise<void> {
    this.url = url;
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.addEventListener('open', () => {
          this._send({ type: 'set_name', name });
          resolve();
        });
        ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')));
        ws.addEventListener('close', () => {
          const wasMatch = !!this._match;
          this._currentRoomId = null;
          this._role = null;
          this._peers = [];
          this._match = null;
          this.resolvePendingPoolRequests();
          this.emit('disconnect', { wasMatch });
        });
        ws.addEventListener('message', (ev) => this._onMessage(ev.data));
      } catch (e) {
        reject(e);
      }
    });
  }

  private _send(obj: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(obj));
  }

  private _onMessage(raw: any): void {
    let m: any;
    try { m = JSON.parse(String(raw)); } catch { return; }
    switch (m.type) {
      case 'welcome':
        this._localPeer = { id: m.id, name: this._localPeer?.name ?? '玩家', role: 'guest' };
        break;
      case 'self':
        if (this._localPeer) this._localPeer.name = m.name;
        break;
      case 'rooms':
        this._rooms = m.list || [];
        break;
      case 'joined':
        this._currentRoomId = m.roomId;
        this._role = (m.role === 'host' || m.role === 'guest') ? m.role : 'guest';
        if (this._localPeer && m.you) this._localPeer.name = m.you;
        // 注意：不在此清空 _peers — peer_joined 可能先到（服务端在 joined 之前发送已存在对端）
        break;
      case 'left':
        this._currentRoomId = null;
        this._peers = [];
        this._match = null;
        this.resolvePendingPoolRequests();
        break;
      case 'peer_joined':
        this._peers = this._peers.filter(p => p.id !== m.id);
        this._peers.push({ id: m.id, name: m.name, role: m.role, ready: !!m.ready });
        break;
      case 'peer_left':
        this._peers = this._peers.filter(p => p.id !== m.id);
        break;
      case 'peer_ready': {
        const peer = this._peers.find(p => p.id === m.id);
        if (peer) peer.ready = !!m.ready;
        break;
      }
      case 'host_changed':
        if (this._localPeer?.id === m.id) this._role = 'host';
        this._peers.forEach(p => { p.role = p.id === m.id ? 'host' : 'guest'; });
        break;
      case 'start':
        this._match = { mapSeed: m.mapSeed, round: 0, phase: 'PREP', stage: 'NORMAL', assaultGroups: [],
          activeIds: m.activeIds, eliminatedIds: [], readyIds: [], finishedIds: [], poolCounts: {} };
        break;
      case 'pool_state':
        if (this._match) this._match.poolCounts = m.counts;
        break;
      case 'pool_result': {
        const resolve = this.pendingPoolRequests.get(m.requestId);
        if (resolve) {
          this.pendingPoolRequests.delete(m.requestId);
          resolve(m.ok === true);
        }
        break;
      }
      case 'round_status':
        if (this._match && m.round === this._match.round) {
          this._match.readyIds = m.readyIds;
          this._match.finishedIds = m.finishedIds;
        }
        break;
      case 'round_start':
        if (this._match && m.round === this._match.round) {
          this._match.phase = 'COMBAT';
          this._match.readyIds = [];
        }
        break;
      case 'defense_start':
        if (this._match && m.round === this._match.round) {
          this._match.phase = 'DEFENSE';
          this._match.defenseHelperId = m.helperId;
        }
        break;
      case 'round_settle':
        if (this._match && m.round === this._match.round) {
          this._match.phase = 'SETTLE';
          this._match.activeIds = m.activeIds;
          this._match.eliminatedIds.push(...m.eliminatedIds);
        }
        break;
      case 'round_prep':
        if (this._match) {
          this._match.phase = 'PREP';
          this._match.round = m.round;
          this._match.stage = m.stage === 'FINAL' ? 'FINAL' : 'NORMAL';
          this._match.readyIds = [];
          this._match.finishedIds = [];
          this._match.defenseHelperId = undefined;
        }
        break;
      case 'final_start':
        if (this._match && m.round === this._match.round) {
          this._match.phase = 'ASSAULT';
          this._match.readyIds = [];
          this._match.assaultGroups = m.groups;
          this._match.finalState = m.state;
          const localId = this._localPeer?.id;
          const group = m.groups.find((candidate: { members: DefenseFormation[] }) => candidate.members.some(member => member.playerId === localId));
          this._match.assaultSimulatorId = group?.simulatorId;
          this.nextFinalDamage = 0;
        }
        break;
      case 'final_state':
        if (this._match) this._match.finalState = m.state;
        break;
      case 'match_complete':
        if (this._match) this._match.phase = 'COMPLETE';
        break;
      case 'match_ended':
        this._currentRoomId = null;
        this._role = null;
        this._peers = [];
        this._match = null;
        this.resolvePendingPoolRequests();
        break;
    }
    this.emit(m.type, m);
  }

  // 兼容旧 INetworkAdapter
  async host(roomCode: string, displayName: string): Promise<void> {
    if (!this.isConnected) await this.connect(this.url || getDefaultMpUrl(), displayName);
    this._send({ type: 'create_room', name: roomCode });
  }
  async join(roomCode: string, displayName: string): Promise<void> {
    if (!this.isConnected) await this.connect(this.url || getDefaultMpUrl(), displayName);
    this._send({ type: 'join_room', roomId: roomCode });
  }
  async disconnect(): Promise<void> {
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }
  send<T>(type: string, payload: T): void {
    this._send({ type, payload });
  }

  // 房间扩展 API
  createRoom(name: string): void { this._send({ type: 'create_room', name }); }
  joinRoom(roomId: string): void { this._send({ type: 'join_room', roomId }); }
  leaveRoom(): void { this._send({ type: 'leave_room' }); }
  setReady(ready: boolean): void { this._send({ type: 'ready', ready }); }
  startRoom(): void { this._send({ type: 'room_start' }); }
  sendChat(text: string): void { this._send({ type: 'chat', text }); }
  sendGame(payload: any): void { this._send({ type: 'game', payload }); }
  sendMarker(x: number, y: number, label?: string, toId?: string): void { this._send({ type: 'marker', x, y, label: label || '', toId }); }
  sendEvent(kind: string, text: string, level: 'info' | 'warn' | 'success' | 'danger' = 'info', extra: any = null, toId?: string): void { this._send({ type: 'event', kind, text, level, extra, toId }); }

  registerShopOffers(kind: 'normal' | 'temporary', cards: { uid: string; operatorId: string }[]): void {
    this._send({ type: 'shop_offer', kind, cards });
  }

  takeFromPool(operatorId: string, offerId: string, kind: 'normal' | 'temporary'): Promise<boolean> {
    if (!this.isConnected || !this._match) return Promise.resolve(false);
    const requestId = `${this._localPeer?.id ?? 'player'}_${++this.nextRequest}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        if (this.pendingPoolRequests.has(requestId)) this.ws?.close();
      }, 8000);
      this.pendingPoolRequests.set(requestId, ok => { clearTimeout(timer); resolve(ok); });
      this._send({ type: 'pool_take', operatorId, offerId, kind, requestId });
    });
  }

  returnToPool(operatorId: string, count: number): void {
    this._send({ type: 'pool_return', operatorId, count });
  }

  setRoundReady(round: number, ready: boolean, formation?: RoundOutcome['formation']): void {
    this._send({ type: 'round_ready', round, ready, formation });
  }
  finishRound(outcome: RoundOutcome): void { this._send({ type: 'round_done', ...outcome }); }
  finishDefense(round: number, survivors: EscapedEnemy[]): void { this._send({ type: 'defense_done', round, survivors }); }
  sendFinalDamage(round: number, damage: number): void {
    this._send({ type: 'final_damage', round, sequence: ++this.nextFinalDamage, damage });
  }
  sendFinalLeak(round: number): void {
    this._send({ type: 'final_leak', round, sequence: ++this.nextFinalDamage });
  }

  private resolvePendingPoolRequests(): void {
    for (const resolve of this.pendingPoolRequests.values()) resolve(false);
    this.pendingPoolRequests.clear();
  }

  on(type: string, handler: NetworkEventHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
  }
  off(type: string, handler: NetworkEventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }
  private emit(type: string, payload: any): void {
    const message = { type, payload, ts: Date.now(), from: payload?.from ?? '' };
    this.handlers.get(type)?.forEach(h => h(message));
    if (type !== '*') this.handlers.get('*')?.forEach(h => h(message));
  }
}
