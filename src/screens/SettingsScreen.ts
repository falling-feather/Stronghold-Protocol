// v3.9.0：音频设置面板 — 主菜单 ⚙ 入口
import { showOnly } from './shared';
import { getAudioSettings, setAudioSetting, playSfx, startBgm, stopBgm, isBgmRunning, AudioSettings } from '../core/AudioSystem';

let initialized = false;

export function initSettingsScreen(): void {
  if (initialized) return;
  ensureScreenDom();
  initialized = true;
}

export function showSettingsScreen(): void {
  ensureScreenDom();
  showOnly('settings-screen');
  render();
}

function ensureScreenDom(): void {
  if (document.getElementById('settings-screen')) return;
  const div = document.createElement('div');
  div.id = 'settings-screen';
  div.style.cssText = 'display:none;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:30px;background:linear-gradient(135deg,#1a1d24,#1d2a3a);color:#fff;';
  div.innerHTML = `
    <h1 style="font-size:30px;margin:0 0 18px;background:linear-gradient(90deg,#3498db,#2c3e50);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">⚙ 音频设置</h1>
    <div id="settings-body" style="width:380px;background:#2a2d35;padding:22px;border-radius:10px;border:1px solid #3a3d45;"></div>
    <div style="margin-top:24px;display:flex;gap:14px;">
      <button id="btn-settings-test" style="padding:8px 18px;background:#16a085;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:13px;">▶ 测试音效</button>
      <button id="btn-settings-bgm" style="padding:8px 18px;background:#8e44ad;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:13px;">♪ 试听 BGM</button>
      <button id="btn-settings-back" style="padding:8px 22px;background:#34495e;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:13px;">◀ 返回</button>
    </div>
  `;
  document.body.appendChild(div);
  div.querySelector<HTMLButtonElement>('#btn-settings-back')?.addEventListener('click', () => {
    stopBgm();
    showOnly('start-screen');
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
