// === 联机模式网络适配层（v1.4.0 占位） ===
// 本接口为后续 WebSocket 实现预留契约
// v1.4.0 仅提供 NoopAdapter（不发送任何包，所有方法为 no-op）

export type NetworkRole = 'host' | 'guest';

export interface NetworkPeerInfo {
  id: string;
  name: string;
  role: NetworkRole;
}

export interface NetworkMessage<T = unknown> {
  type: string;
  payload: T;
  ts: number;
  from: string;
}

export type NetworkEventHandler = (msg: NetworkMessage) => void;

// 适配器统一接口：未来不论 WebSocket / WebRTC / 本地回环都实现这个接口
export interface INetworkAdapter {
  readonly isConnected: boolean;
  readonly role: NetworkRole | null;
  readonly localPeer: NetworkPeerInfo | null;
  readonly peers: NetworkPeerInfo[];

  // 创建房间（host）
  host(roomCode: string, displayName: string): Promise<void>;
  // 加入房间（guest）
  join(roomCode: string, displayName: string): Promise<void>;
  // 断开
  disconnect(): Promise<void>;

  // 广播消息
  send<T>(type: string, payload: T): void;

  // 事件监听
  on(type: string, handler: NetworkEventHandler): void;
  off(type: string, handler: NetworkEventHandler): void;
}
