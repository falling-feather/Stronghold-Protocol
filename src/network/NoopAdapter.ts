// === Noop 网络适配器（v1.4.0 占位实现） ===
// 不进行任何实际网络通信，仅维护本地伪状态
// 待后续接入 WebSocket / WebRTC 时实现真正的 WsAdapter

import { INetworkAdapter, NetworkEventHandler, NetworkPeerInfo, NetworkRole } from './INetworkAdapter';

export class NoopAdapter implements INetworkAdapter {
  private _connected = false;
  private _role: NetworkRole | null = null;
  private _localPeer: NetworkPeerInfo | null = null;
  private _peers: NetworkPeerInfo[] = [];
  private handlers: Map<string, Set<NetworkEventHandler>> = new Map();

  get isConnected() { return this._connected; }
  get role() { return this._role; }
  get localPeer() { return this._localPeer; }
  get peers() { return [...this._peers]; }

  async host(roomCode: string, displayName: string): Promise<void> {
    this._role = 'host';
    this._localPeer = { id: `local_host_${Date.now()}`, name: displayName, role: 'host' };
    this._peers = [this._localPeer];
    this._connected = true;
    console.info(`[NoopAdapter] host room=${roomCode} as ${displayName}`);
  }

  async join(roomCode: string, displayName: string): Promise<void> {
    this._role = 'guest';
    this._localPeer = { id: `local_guest_${Date.now()}`, name: displayName, role: 'guest' };
    this._peers = [this._localPeer];
    this._connected = true;
    console.info(`[NoopAdapter] join room=${roomCode} as ${displayName}`);
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this._role = null;
    this._localPeer = null;
    this._peers = [];
    console.info('[NoopAdapter] disconnected');
  }

  send<T>(type: string, payload: T): void {
    if (!this._connected) return;
    console.info(`[NoopAdapter] send type=${type}`, payload);
  }

  on(type: string, handler: NetworkEventHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler: NetworkEventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }
}
