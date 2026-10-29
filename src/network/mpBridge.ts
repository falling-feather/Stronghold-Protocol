// 共享联机适配器，供大厅与对局页面使用。
import { WsAdapter } from './WsAdapter';

export const mpAdapter = new WsAdapter();

export function isMpMatch(): boolean {
  return mpAdapter.isConnected && !!mpAdapter.currentRoomId && !!mpAdapter.match;
}
