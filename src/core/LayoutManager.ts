// v3.20.0：全局布局管理器
// - 移动端竖屏自动 90deg 旋转（基于 CSS class `mobile-rotated`）
// - 桌面端按视口纵横比写入 aspect class（aspect-tall / aspect-wide / aspect-ultrawide）
// - 在所有页面（StartScreen / FactionScreen / GameScreen / ...）生效，监听 resize / orientationchange

const ROTATED_CLASS = 'mobile-rotated';
const ASPECT_PREFIX = 'aspect-';
type AspectClass = 'aspect-tall' | 'aspect-portrait' | 'aspect-square' | 'aspect-wide' | 'aspect-ultrawide';

const listeners = new Set<() => void>();

function isMobileUA(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/** 是否需要走移动端旋转逻辑：UA 命中 或 视口最短边 ≤ 540（含小窗口） */
function shouldRotate(): boolean {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const minSide = Math.min(w, h);
  // 只在竖屏（h > w）且小屏（≤ 900 宽）时旋转，避免桌面误触发
  if (h > w && minSide <= 900 && (isMobileUA() || w <= 540)) return true;
  return false;
}

function pickAspect(): AspectClass {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = w / h;
  if (r < 0.7) return 'aspect-portrait';      // 极窄竖屏（手机/PWA 内嵌）
  if (r < 1.1) return 'aspect-tall';          // 接近方形（小窗口/分屏）
  if (r < 1.6) return 'aspect-square';        // 4:3 / 5:4 旧屏
  if (r < 2.1) return 'aspect-wide';          // 16:9 / 16:10 主流
  return 'aspect-ultrawide';                  // 21:9+ 超宽
}

function applyLayout(): void {
  const html = document.documentElement;
  const rotate = shouldRotate();
  html.classList.toggle(ROTATED_CLASS, rotate);

  // aspect class 仅在未旋转时贴；旋转后视口已在 CSS 内交换 wh
  const target = rotate ? 'aspect-wide' : pickAspect();
  for (const c of Array.from(html.classList)) {
    if (c.startsWith(ASPECT_PREFIX) && c !== target) html.classList.remove(c);
  }
  html.classList.add(target);

  // 通知订阅者（如 Renderer 重算 canvas 尺寸）
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.error('[LayoutManager] listener error', e); }
  }
}

let installed = false;
export function initLayoutManager(): void {
  if (installed) return;
  installed = true;
  applyLayout();
  window.addEventListener('resize', () => {
    // 节流到下一帧
    requestAnimationFrame(applyLayout);
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(applyLayout, 150);
  });
}

/** 订阅布局变化（旋转 / 纵横比切换 / resize）；返回取消订阅函数 */
export function onLayoutChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 当前是否处于移动端旋转模式 */
export function isRotatedLayout(): boolean {
  return document.documentElement.classList.contains(ROTATED_CLASS);
}
