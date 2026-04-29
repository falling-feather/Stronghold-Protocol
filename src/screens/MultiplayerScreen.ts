// 联机模式占位页（v1.4.0 起）
import { NoopAdapter } from '../network/NoopAdapter';
import { showOnly } from './shared';

const mpAdapter = new NoopAdapter();

export function showMultiplayerScreen(): void {
  showOnly('mp-screen');
  refreshMultiplayerStatus();
}

export function hideMultiplayerScreen(): void {
  showOnly('start-screen');
}

export function initMultiplayerScreen(): void {
  document.getElementById('btn-mp-back')?.addEventListener('click', async () => {
    if (mpAdapter.isConnected) await mpAdapter.disconnect();
    hideMultiplayerScreen();
  });
  document.getElementById('btn-mp-host')?.addEventListener('click', async () => {
    const nameEl = document.getElementById('mp-host-name') as HTMLInputElement;
    const code = 'R-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    await mpAdapter.host(code, nameEl?.value || 'Host');
    refreshMultiplayerStatus(`已创建房间，房间号：${code}（占位实现，无真实联机）`);
  });
  document.getElementById('btn-mp-join')?.addEventListener('click', async () => {
    const nameEl = document.getElementById('mp-guest-name') as HTMLInputElement;
    const codeEl = document.getElementById('mp-room-code') as HTMLInputElement;
    if (!codeEl?.value.trim()) {
      refreshMultiplayerStatus('请输入房间号');
      return;
    }
    await mpAdapter.join(codeEl.value.trim(), nameEl?.value || 'Guest');
    refreshMultiplayerStatus(`已加入房间 ${codeEl.value.trim()}（占位实现，无真实联机）`);
  });
}

function refreshMultiplayerStatus(extra?: string): void {
  const el = document.getElementById('mp-status');
  if (!el) return;
  const lines: string[] = [];
  lines.push(`状态：${mpAdapter.isConnected ? '已连接' : '未连接'}`);
  lines.push(`角色：${mpAdapter.role ?? '—'}`);
  lines.push(`本机：${mpAdapter.localPeer ? `${mpAdapter.localPeer.name} (${mpAdapter.localPeer.id})` : '—'}`);
  lines.push(`对端列表：${mpAdapter.peers.map(p => p.name).join(', ') || '—'}`);
  if (extra) lines.push('', extra);
  el.innerText = lines.join('\n');
}
