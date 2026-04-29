// v3.8.0：每日挑战入口屏 — 显示今日固定盟约组合，直接开战
import { showOnly, screenState } from './shared';
import { getDailyChallenge, getTodayDate } from '../config/dailyData';
import { getDailyState } from '../core/MetaSave';
import { PACT_DB } from '../config/gameData';
import { startGame } from './GameScreen';
import type { PactSelection } from '../types';

let initialized = false;

export function initDailyScreen(): void {
  if (initialized) return;
  ensureScreenDom();
  initialized = true;
}

export function showDailyScreen(): void {
  ensureScreenDom();
  showOnly('daily-screen');
  render();
}

function ensureScreenDom(): void {
  if (document.getElementById('daily-screen')) return;
  const div = document.createElement('div');
  div.id = 'daily-screen';
  div.style.cssText = 'display:none;flex-direction:column;align-items:center;min-height:100vh;padding:30px;background:linear-gradient(135deg,#1a1d24,#0d2a2a);color:#fff;overflow-y:auto;';
  div.innerHTML = `
    <h1 style="font-size:30px;margin:0 0 6px;background:linear-gradient(90deg,#1abc9c,#16a085);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">📅 每日挑战</h1>
    <div id="daily-date" style="color:#bdc3c7;margin-bottom:16px;font-size:13px;"></div>
    <div id="daily-status" style="margin-bottom:14px;font-size:13px;font-weight:700;"></div>
    <div id="daily-pacts" style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:900px;margin-bottom:18px;"></div>
    <div style="font-size:12px;color:#7f8c8d;max-width:600px;text-align:center;margin-bottom:20px;line-height:1.5;" id="daily-modifier"></div>
    <div style="display:flex;gap:14px;">
      <button id="btn-daily-back" style="padding:10px 22px;background:#34495e;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:14px;">◀ 返回</button>
      <button id="btn-daily-start" style="padding:10px 28px;background:linear-gradient(135deg,#1abc9c,#16a085);color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:700;font-size:15px;">开始挑战 ▶</button>
    </div>
  `;
  document.body.appendChild(div);
  div.querySelector<HTMLButtonElement>('#btn-daily-back')?.addEventListener('click', () => showOnly('start-screen'));
  div.querySelector<HTMLButtonElement>('#btn-daily-start')?.addEventListener('click', () => proceed());
}

function render(): void {
  const today = getTodayDate();
  const ch = getDailyChallenge(today);
  const completed = getDailyState().lastCompletedDate === today;

  const dEl = document.getElementById('daily-date');
  if (dEl) dEl.textContent = `日期：${today}`;
  const sEl = document.getElementById('daily-status');
  if (sEl) {
    sEl.innerHTML = completed
      ? `<span style="color:#27ae60;">✓ 今日已完成（仍可重玩，但不再发奖）</span>`
      : `<span style="color:#f1c40f;">⚡ 今日未完成 — 通关奖励 +${ch.rewardShards} 碎片</span>`;
  }
  const pEl = document.getElementById('daily-pacts');
  if (pEl) {
    pEl.innerHTML = ch.pactIds.map(id => {
      const def = PACT_DB[id];
      if (!def) return '';
      const isShackled = ch.shackledIds.includes(id);
      const borderColor = isShackled ? '#e74c3c' : '#3498db';
      return `
        <div style="width:240px;padding:14px;border:2px solid ${borderColor};border-radius:10px;background:linear-gradient(135deg,#2a2d35,#1a1d24);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <div style="font-size:15px;font-weight:700;color:#fff;flex:1;">${def.name}</div>
            ${isShackled ? '<span style="font-size:11px;color:#e74c3c;font-weight:700;">⛓ 枷锁</span>' : ''}
          </div>
          <div style="font-size:11px;color:#bdc3c7;line-height:1.45;">${def.desc ?? ''}</div>
        </div>
      `;
    }).join('');
  }
  const mEl = document.getElementById('daily-modifier');
  if (mEl) mEl.textContent = ch.modifierLabel;
}

function proceed(): void {
  const ch = getDailyChallenge();
  const selections: PactSelection[] = ch.pactIds.map(id => ({
    defId: id,
    shackled: ch.shackledIds.includes(id),
  }));
  startGame(screenState.currentFactionId, screenState.currentRoster, selections, null, true);
}
