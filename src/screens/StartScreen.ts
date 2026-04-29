// 开始界面：仅承接两个入口（开始游戏 / 联机模式）
import { showFactionScreen, initFactionScreen } from './FactionScreen';
import { showMultiplayerScreen, initMultiplayerScreen } from './MultiplayerScreen';
import { showMetaScreen, initMetaScreen } from './MetaScreen';
import { showAchievementScreen, initAchievementScreen } from './AchievementScreen';
import { showDailyScreen, initDailyScreen } from './DailyScreen';
import { showSettingsScreen, initSettingsScreen } from './SettingsScreen';
import { playSfx } from '../core/AudioSystem';

export function initStartScreen(): void {
  const startScreen = document.getElementById('start-screen');
  const appRoot = document.getElementById('app-root');
  const btnStartGame = document.getElementById('btn-start-game');

  if (!startScreen || !appRoot || !btnStartGame) {
    console.error('无法找到必要的DOM元素');
    return;
  }

  btnStartGame.addEventListener('click', () => { playSfx('click'); showFactionScreen(); });
  document.getElementById('btn-multiplayer')?.addEventListener('click', () => { playSfx('click'); showMultiplayerScreen(); });
  document.getElementById('btn-meta-tree')?.addEventListener('click', () => { playSfx('click'); showMetaScreen(); });
  document.getElementById('btn-achievements')?.addEventListener('click', () => { playSfx('click'); showAchievementScreen(); });
  document.getElementById('btn-daily')?.addEventListener('click', () => { playSfx('click'); showDailyScreen(); });
  document.getElementById('btn-settings')?.addEventListener('click', () => { playSfx('click'); showSettingsScreen(); });

  initFactionScreen();
  initMultiplayerScreen();
  initMetaScreen();
  initAchievementScreen();
  initDailyScreen();
  initSettingsScreen();
}
