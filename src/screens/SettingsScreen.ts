// v3.9.0：音频设置面板 — 主菜单 ⚙ 入口
import { showOnly } from './shared';
import { getAudioSettings, setAudioSetting, playSfx, startBgm, stopBgm, isBgmRunning, AudioSettings } from '../core/AudioSystem';

let initialized = false;
let returnScreen: 'start-screen' | 'app-root' = 'start-screen';
let onReturn: (() => void) | undefined;

export function initSettingsScreen(): void {
  if (initialized) return;
  ensureScreenDom();
  initialized = true;
}

export function showSettingsScreen(target: 'start-screen' | 'app-root' = 'start-screen', afterReturn?: () => void): void {
  ensureScreenDom();
  returnScreen = target;
  onReturn = afterReturn;
  showOnly('settings-screen');
  render();
}

function ensureScreenDom(): void {
  if (document.getElementById('settings-screen')) return;
  const div = document.createElement('div');
  div.id = 'settings-screen';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="screen-kicker">SYSTEM // AUDIO</div>
    <h1>音频设置</h1>
    <div id="settings-body"></div>
    <div class="screen-actions">
      <button id="btn-settings-test" class="faction-back">测试音效</button>
      <button id="btn-settings-bgm" class="faction-back">试听 BGM</button>
      <button id="btn-settings-back" class="faction-confirm">返回</button>
    </div>
  `;
  document.body.appendChild(div);
  div.querySelector<HTMLButtonElement>('#btn-settings-back')?.addEventListener('click', () => {
    if (returnScreen === 'start-screen') stopBgm();
    showOnly(returnScreen);
    onReturn?.();
    onReturn = undefined;
  });
  div.querySelector<HTMLButtonElement>('#btn-settings-test')?.addEventListener('click', () => playSfx('click'));
  div.querySelector<HTMLButtonElement>('#btn-settings-bgm')?.addEventListener('click', () => {
    if (isBgmRunning()) stopBgm(); else startBgm();
    render();
  });
}

function render(): void {
  const body = document.getElementById('settings-body');
  if (!body) return;
  const s = getAudioSettings();
  const rows: Array<[keyof AudioSettings, string]> = [
    ['master', '主音量'],
    ['sfx', '音效'],
    ['bgm', '背景音乐'],
  ];
  body.innerHTML = rows.map(([k, label]) => `
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
        <span>${label}</span>
        <span id="val-${k}" style="color:#f1c40f;font-weight:700;">${Math.round(s[k] * 100)}</span>
      </div>
      <input type="range" min="0" max="100" value="${Math.round(s[k] * 100)}" data-key="${k}" style="width:100%;cursor:pointer;" />
    </div>
  `).join('') + `
    <div style="font-size:11px;color:#7f8c8d;margin-top:8px;">BGM 状态：<span style="color:${isBgmRunning() ? '#27ae60' : '#7f8c8d'};">${isBgmRunning() ? '播放中' : '已停止'}</span></div>
  `;
  body.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(inp => {
    inp.addEventListener('input', () => {
      const k = inp.getAttribute('data-key') as keyof AudioSettings;
      const v = parseInt(inp.value, 10) / 100;
      setAudioSetting(k, v);
      const valEl = document.getElementById(`val-${k}`);
      if (valEl) valEl.textContent = String(Math.round(v * 100));
    });
  });
}
