// 开始界面：仅承接两个入口（开始游戏 / 联机模式）
import { showFactionScreen, initFactionScreen } from './FactionScreen';
import { showMultiplayerScreen, initMultiplayerScreen } from './MultiplayerScreen';

export function initStartScreen(): void {
  const startScreen = document.getElementById('start-screen');
  const appRoot = document.getElementById('app-root');
  const btnStartGame = document.getElementById('btn-start-game');

  if (!startScreen || !appRoot || !btnStartGame) {
    console.error('无法找到必要的DOM元素');
    return;
  }

  btnStartGame.addEventListener('click', () => showFactionScreen());
  document.getElementById('btn-multiplayer')?.addEventListener('click', () => showMultiplayerScreen());

  initFactionScreen();
  initMultiplayerScreen();
}
