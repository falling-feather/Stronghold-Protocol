// 入口（v1.5.x 多页面拆分）：UI 流程已迁移至 src/screens/*
import { initStartScreen } from './screens/StartScreen';
import { initLayoutManager } from './core/LayoutManager';

function bootstrap() {
  initLayoutManager();
  initStartScreen();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
