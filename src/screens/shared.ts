// 屏幕间共享的全局状态（v1.5.x 多页面拆分）
// 仅承载跨屏幕需要协作的少量字段，避免 main.ts 单文件膨胀

import { FactionId, getSavedFactionId } from '../config/factions';
import { Roster, loadRoster } from '../config/roster';

export const screenState = {
  currentFactionId: getSavedFactionId() as FactionId,
  currentRoster: loadRoster() as Roster,
};

// 通用：在多个全屏页之间切换显示（只支持 'start-screen' / 'faction-screen' / 'roster-screen' / 'mp-screen' / 'app-root' 等已知 id）
export function showOnly(targetId: string, displayMode: string = 'flex'): void {
  const ids = ['start-screen', 'faction-screen', 'roster-screen', 'mp-screen', 'pact-screen', 'meta-screen', 'boon-screen', 'achievement-screen', 'daily-screen', 'app-root'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = id === targetId ? displayMode : 'none';
  });
}
