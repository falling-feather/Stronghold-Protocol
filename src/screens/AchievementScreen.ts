// v3.7.0：成就一览屏（从主菜单进入，可查看进度与解锁状态）
import { ACHIEVEMENTS } from '../config/achievements';
import { showOnly } from './shared';
import { getStats, isAchievementUnlocked } from '../core/MetaSave';

let initialized = false;

export function initAchievementScreen(): void {
  if (initialized) return;
  ensureScreenDom();
  initialized = true;
}

export function showAchievementScreen(): void {
  ensureScreenDom();
  showOnly('achievement-screen');
  render();
}

function ensureScreenDom(): void {
  if (document.getElementById('achievement-screen')) return;
  const div = document.createElement('div');
  div.id = 'achievement-screen';
  div.style.cssText = 'display:none;flex-direction:column;align-items:center;min-height:100vh;padding:30px;background:linear-gradient(135deg,#1a1d24,#2a1f0d);color:#fff;overflow-y:auto;';
  div.innerHTML = `
    <h1 style="font-size:30px;margin:0 0 6px;background:linear-gradient(90deg,#f39c12,#e67e22);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">🏆 成就殿堂</h1>
    <div id="ach-summary" style="color:#bdc3c7;margin-bottom:18px;font-size:13px;text-align:center;"></div>
    <div id="ach-stats" style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:900px;margin-bottom:20px;font-size:12px;"></div>
    <div id="ach-grid" style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:1000px;"></div>
    <button id="btn-ach-back" style="margin-top:24px;padding:10px 28px;background:#34495e;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:14px;">◀ 返回主菜单</button>
  `;
  document.body.appendChild(div);
  div.querySelector<HTMLButtonElement>('#btn-ach-back')?.addEventListener('click', () => {
    showOnly('start-screen');
  });
}

function render(): void {
  const stats = getStats();
  const total = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter(a => isAchievementUnlocked(a.id)).length;
  const sumEl = document.getElementById('ach-summary');
  if (sumEl) sumEl.textContent = `已解锁 ${unlockedCount} / ${total}`;

  const statEl = document.getElementById('ach-stats');
  if (statEl) {
    const items: Array<[string, string | number]> = [
      ['累计开局', stats.totalRunsAttempted],
      ['累计通关', stats.totalRunsWon],
      ['累计波数', stats.totalWavesCleared],
      ['史诗事件', stats.totalEpicEvents],
      ['单局共鸣峰值', stats.maxResonanceInRun],
      ['枷锁通关', stats.shackledRunsWon],
      ['尝试 Boon', `${stats.boonsUsed.length} / 10`],
    ];
    statEl.innerHTML = items.map(([k, v]) =>
      `<div style="background:#2a2d35;padding:8px 14px;border-radius:6px;border:1px solid #3a3d45;"><span style="color:#95a5a6;">${k}</span> <span style="color:#f1c40f;font-weight:700;margin-left:6px;">${v}</span></div>`
    ).join('');
  }

  const grid = document.getElementById('ach-grid');
  if (!grid) return;
  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = isAchievementUnlocked(a.id);
    const p = a.progress(stats);
    const pct = Math.min(100, Math.round((p.cur / p.target) * 100));
    const borderColor = unlocked ? '#27ae60' : '#3a3d45';
    const opacity = unlocked ? '1' : '0.75';
    return `
      <div style="width:280px;padding:14px;border:2px solid ${borderColor};border-radius:10px;background:linear-gradient(135deg,#2a2d35,#1a1d24);opacity:${opacity};">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <div style="font-size:32px;">${a.icon}</div>
          <div style="flex:1;">
            <div style="font-size:15px;font-weight:700;color:#fff;">${a.name}</div>
            <div style="font-size:11px;color:${unlocked ? '#27ae60' : '#7f8c8d'};">${unlocked ? '✓ 已解锁' : '未解锁'}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#bdc3c7;line-height:1.45;margin-bottom:8px;min-height:34px;">${a.desc}</div>
        <div style="background:#1a1d24;border-radius:4px;height:8px;overflow:hidden;margin-bottom:4px;">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#f39c12,#e67e22);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#95a5a6;">
          <span>${Math.min(p.cur, p.target)} / ${p.target}</span>
          <span>${a.reward.note ?? ''}</span>
        </div>
      </div>
    `;
  }).join('');
}
