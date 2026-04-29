// 入口（v1.5.x 多页面拆分）：UI 流程已迁移至 src/screens/*
import { initStartScreen } from './screens/StartScreen';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStartScreen);
} else {
  initStartScreen();
}
