// v4.1.0：联机桥接 — 共享 WsAdapter 单例，供 MultiplayerScreen 与 GameScreen 共用
import { WsAdapter } from './WsAdapter';

export const mpAdapter = new WsAdapter();

// host 在 GameScreen.onStateUpdated 时调用；guest 接收并镜像渲染
export function isMpHost(): boolean {
  return mpAdapter.isConnected && mpAdapter.role === 'host' && !!mpAdapter.currentRoomId;
}

export function isMpGuest(): boolean {
  return mpAdapter.isConnected && mpAdapter.role === 'guest' && !!mpAdapter.currentRoomId;
}
