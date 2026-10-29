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
  div.style.display = 'none';
  div.innerHTML = `
    <div class="screen-kicker">SIMULATION // DAILY</div>
    <h1>每日挑战</h1>
    <div id="daily-date" style="color:#bdc3c7;margin-bottom:16px;font-size:13px;"></div>
    <div id="daily-status" style="margin-bottom:14px;font-size:13px;font-weight:700;"></div>
    <div id="daily-pacts" style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:900px;margin-bottom:18px;"></div>
    <div style="font-size:12px;color:#7f8c8d;max-width:600px;text-align:center;margin-bottom:20px;line-height:1.5;" id="daily-modifier"></div>
    <div style="display:flex;gap:14px;">
      <button id="btn-daily-back" class="faction-back">← 返回</button>
      <button id="btn-daily-start" class="faction-confirm">开始挑战 →</button>
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
      return `
        <div class="daily-pact-card${isShackled ? ' shackled' : ''}">
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
