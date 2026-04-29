// v4.0.0：WebSocket 网络适配器（连接 server/index.js）
// 仅承载房间/聊天/准备/开始信号；游戏状态同步留待 v4.1+
import { INetworkAdapter, NetworkEventHandler, NetworkPeerInfo, NetworkRole } from './INetworkAdapter';

export interface RoomInfo {
  id: string;
  name: string;
  count: number;
  readyCount: number;
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

  get isConnected(): boolean { return !!this.ws && this.ws.readyState === WebSocket.OPEN; }
  get role(): NetworkRole | null { return this._role; }
  get localPeer(): NetworkPeerInfo | null { return this._localPeer; }
  get peers(): NetworkPeerInfo[] { return this._peers.slice(); }
  get currentRoomId(): string | null { return this._currentRoomId; }
  get rooms(): RoomInfo[] { return this._rooms.slice(); }

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
          this._currentRoomId = null;
          this._role = null;
          this._peers = [];
          this.emit('disconnect', {});
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
        break;
      case 'peer_joined':
        this._peers.push({ id: m.name, name: m.name, role: 'guest' });
        break;
      case 'peer_left':
        this._peers = this._peers.filter(p => p.name !== m.name);
        break;
    }
    this.emit(m.type, m);
    this.emit('*', m);
  }

  // 兼容旧 INetworkAdapter
  async host(roomCode: string, displayName: string): Promise<void> {
    if (!this.isConnected) await this.connect(this.url || 'ws://localhost:8787', displayName);
    this._send({ type: 'create_room', name: roomCode });
  }
  async join(roomCode: string, displayName: string): Promise<void> {
    if (!this.isConnected) await this.connect(this.url || 'ws://localhost:8787', displayName);
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
  sendChat(text: string): void { this._send({ type: 'chat', text }); }
  sendGame(payload: any): void { this._send({ type: 'game', payload }); }
  sendMarker(x: number, y: number, label?: string): void { this._send({ type: 'marker', x, y, label: label || '' }); }
  sendEvent(kind: string, text: string, level: 'info' | 'warn' | 'success' | 'danger' = 'info', extra: any = null): void { this._send({ type: 'event', kind, text, level, extra }); }

  on(type: string, handler: NetworkEventHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
  }
  off(type: string, handler: NetworkEventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }
  private emit(type: string, payload: any): void {
    const set = this.handlers.get(type);
    if (!set) return;
    set.forEach(h => h({ type, payload, ts: Date.now(), from: payload?.from ?? '' }));
  }
}
