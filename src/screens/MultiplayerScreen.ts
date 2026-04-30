// v4.0.0：联机大厅 — WebSocket 房间管理 + 准备 + 聊天
import { RoomInfo } from '../network/WsAdapter';
import { mpAdapter } from '../network/mpBridge';
import { showOnly } from './shared';
import { showMultiplayerGuestViewer } from './MultiplayerGuestViewer';
import { getDefaultMpUrl } from '../network/mpConfig';

const adapter = mpAdapter;
let initialized = false;
let chatLog: string[] = [];
let lastError = '';
let peerReady: Map<string, boolean> = new Map(); // v4.1.1：对端准备状态
let selfReady = false;

// v3.15.0：默认 ws 地址取自 localStorage / VITE_MP_DEFAULT_URL / 本地回退
const DEFAULT_URL = getDefaultMpUrl();

export function showMultiplayerScreen(): void {
  ensureLobbyDom();
  showOnly('mp-screen');
  render();
}

export function hideMultiplayerScreen(): void {
  showOnly('start-screen');
}

export function initMultiplayerScreen(): void {
  if (initialized) return;
  initialized = true;
  adapter.on('*', (msg) => {
    if (msg.type === 'chat') {
      const p = msg.payload as any;
      chatLog.push(`[${p.from}] ${p.text}`);
    } else if (msg.type === 'peer_joined') {
      chatLog.push(`* ${(msg.payload as any).name} 加入`);
    } else if (msg.type === 'peer_ready') {
      const p = msg.payload as any;
      peerReady.set(p.name, !!p.ready);
      chatLog.push(`* ${p.name} ${p.ready ? '已准备' : '取消准备'}`);
    } else if (msg.type === 'peer_left') {
      const p = msg.payload as any;
      peerReady.delete(p.name);
      chatLog.push(`* ${p.name} 离开`);
    } else if (msg.type === 'left' || msg.type === 'joined') {
      peerReady.clear();
      selfReady = false;
    } else if (msg.type === 'start') {
      chatLog.push(`★ 双方就绪 — 进入对局（${adapter.role === 'host' ? '主机模式' : '观战模式'}）`);
      // v4.1.0：guest 立即进入只读镜像观战
      if (adapter.role === 'guest') {
        setTimeout(() => showMultiplayerGuestViewer(), 80);
      } else if (adapter.role === 'host') {
        // v4.1.1：host 自动跳回主菜单提示开始游戏（保持联机连接）
        setTimeout(() => {
          showOnly('start-screen');
          alert('★ 双方已就绪 — 你是主机\n请点击「开始游戏」选择阵营进入战斗，画面会自动同步给观战方。');
        }, 80);
      }
    } else if (msg.type === 'error') {
      lastError = (msg.payload as any).msg || '未知错误';
    } else if (msg.type === 'left') {
      chatLog.push(`* 已离开房间`);
    } else if (msg.type === 'disconnect') {
      chatLog.push(`* 与服务器连接断开`);
    }
    if (chatLog.length > 80) chatLog = chatLog.slice(-80);
    if (document.getElementById('mp-screen')?.style.display !== 'none') render();
  });
}

function ensureLobbyDom(): void {
  const body = document.getElementById('mp-body');
  if (!body || body.dataset.v4 === '1') return;
  body.dataset.v4 = '1';
  body.innerHTML = `
    <div style="max-width:900px;margin:0 auto;color:#ecf0f1;display:flex;flex-direction:column;gap:16px;">
      <div style="background:rgba(52,152,219,0.1);border-left:4px solid #3498db;padding:12px 16px;border-radius:3px;font-size:13px;line-height:1.6;">
        v4.0.0 联机骨架（房间/聊天/准备）。先在本机另开终端运行 <code style="background:#000;padding:2px 6px;border-radius:3px;">npm run mp-server</code> 启动 WebSocket，再下方连接。游戏战斗同步留待 v4.1+。
      </div>

      <div style="display:flex;gap:10px;align-items:center;">
        <input id="mp-url" value="${DEFAULT_URL}" style="flex:2;padding:8px;background:#2c3e50;border:1px solid #4a627a;color:#ecf0f1;border-radius:3px;" />
        <input id="mp-name" placeholder="昵称" value="玩家" style="flex:1;padding:8px;background:#2c3e50;border:1px solid #4a627a;color:#ecf0f1;border-radius:3px;" />
        <button id="btn-mp-connect" style="padding:8px 18px;background:#3498db;border:none;color:#fff;border-radius:3px;cursor:pointer;font-weight:bold;">连接</button>
        <button id="btn-mp-disconnect" style="padding:8px 14px;background:#7f8c8d;border:none;color:#fff;border-radius:3px;cursor:pointer;">断开</button>
      </div>

      <div id="mp-conn-status" style="font-family:monospace;font-size:12px;color:#95a5a6;"></div>

      <div id="mp-lobby" style="display:none;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div style="background:rgba(255,255,255,0.04);border:1px solid #34495e;border-radius:6px;padding:14px;">
            <div style="font-weight:bold;color:#3498db;margin-bottom:8px;">创建房间</div>
            <input id="mp-create-name" placeholder="房间名" style="width:100%;padding:8px;background:#2c3e50;border:1px solid #4a627a;color:#ecf0f1;border-radius:3px;margin-bottom:8px;" />
            <button id="btn-mp-create" style="width:100%;padding:8px;background:#3498db;border:none;color:#fff;border-radius:3px;cursor:pointer;">创建</button>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid #34495e;border-radius:6px;padding:14px;">
            <div style="font-weight:bold;color:#16a085;margin-bottom:8px;">房间列表</div>
            <div id="mp-room-list" style="max-height:160px;overflow-y:auto;font-size:13px;"></div>
          </div>
        </div>
      </div>

      <div id="mp-room" style="display:none;background:rgba(0,0,0,0.3);border-radius:6px;padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div id="mp-room-info" style="font-weight:bold;color:#f1c40f;"></div>
          <div style="display:flex;gap:8px;">
            <button id="btn-mp-ready" style="padding:6px 16px;background:#27ae60;border:none;color:#fff;border-radius:3px;cursor:pointer;">准备</button>
            <button id="btn-mp-leave" style="padding:6px 14px;background:#c0392b;border:none;color:#fff;border-radius:3px;cursor:pointer;">离开</button>
          </div>
        </div>
        <div id="mp-chat-log" style="background:#1a1d24;padding:10px;height:160px;overflow-y:auto;font-size:12px;font-family:monospace;border-radius:3px;color:#bdc3c7;"></div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <input id="mp-chat-input" placeholder="输入消息" style="flex:1;padding:6px 10px;background:#2c3e50;border:1px solid #4a627a;color:#ecf0f1;border-radius:3px;" />
          <button id="btn-mp-chat-send" style="padding:6px 14px;background:#34495e;border:none;color:#fff;border-radius:3px;cursor:pointer;">发送</button>
        </div>
      </div>

      <div id="mp-error" style="color:#e74c3c;font-size:13px;min-height:18px;"></div>
    </div>
  `;

  body.querySelector<HTMLButtonElement>('#btn-mp-connect')?.addEventListener('click', async () => {
    const url = (body.querySelector<HTMLInputElement>('#mp-url')?.value || DEFAULT_URL).trim();
    const name = (body.querySelector<HTMLInputElement>('#mp-name')?.value || '玩家').trim();
    lastError = '';
    try {
      await adapter.connect(url, name);
      chatLog.push(`* 已连接 ${url}`);
    } catch (e: any) {
      lastError = e?.message || '连接失败';
    }
    render();
  });
  body.querySelector<HTMLButtonElement>('#btn-mp-disconnect')?.addEventListener('click', async () => {
    await adapter.disconnect();
    render();
  });
  body.querySelector<HTMLButtonElement>('#btn-mp-create')?.addEventListener('click', () => {
    const n = (body.querySelector<HTMLInputElement>('#mp-create-name')?.value || '').trim();
    adapter.createRoom(n);
  });
  body.querySelector<HTMLButtonElement>('#btn-mp-leave')?.addEventListener('click', () => {
    adapter.leaveRoom();
  });
  let readyState = false;
  body.querySelector<HTMLButtonElement>('#btn-mp-ready')?.addEventListener('click', () => {
    readyState = !readyState;
    selfReady = readyState;
    adapter.setReady(readyState);
    const btn = body.querySelector<HTMLButtonElement>('#btn-mp-ready');
    if (btn) {
      btn.textContent = readyState ? '取消准备' : '准备';
      btn.style.background = readyState ? '#e67e22' : '#27ae60';
    }
  });
  const sendChat = () => {
    const inp = body.querySelector<HTMLInputElement>('#mp-chat-input');
    if (!inp || !inp.value.trim()) return;
    adapter.sendChat(inp.value.trim());
    inp.value = '';
  };
  body.querySelector<HTMLButtonElement>('#btn-mp-chat-send')?.addEventListener('click', sendChat);
  body.querySelector<HTMLInputElement>('#mp-chat-input')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') sendChat();
  });

  document.getElementById('btn-mp-back')?.addEventListener('click', async () => {
    if (adapter.isConnected) await adapter.disconnect();
    hideMultiplayerScreen();
  });
}

function render(): void {
  const connEl = document.getElementById('mp-conn-status');
  if (connEl) {
    connEl.textContent = adapter.isConnected
      ? `状态：已连接 — 本机 ${adapter.localPeer?.name ?? ''}（${adapter.localPeer?.id ?? ''}）`
      : '状态：未连接';
  }
  const lobbyEl = document.getElementById('mp-lobby');
  if (lobbyEl) lobbyEl.style.display = adapter.isConnected && !adapter.currentRoomId ? 'block' : 'none';
  const roomEl = document.getElementById('mp-room');
  if (roomEl) roomEl.style.display = adapter.currentRoomId ? 'block' : 'none';

  const listEl = document.getElementById('mp-room-list');
  if (listEl) {
    const rooms = adapter.rooms;
    if (rooms.length === 0) listEl.innerHTML = '<div style="color:#7f8c8d;">（暂无房间）</div>';
    else listEl.innerHTML = rooms.map(r => renderRoomRow(r)).join('');
    listEl.querySelectorAll<HTMLButtonElement>('button[data-room]').forEach(b => {
      b.addEventListener('click', () => adapter.joinRoom(b.getAttribute('data-room')!));
    });
  }

  const infoEl = document.getElementById('mp-room-info');
  if (infoEl) {
    const me = adapter.localPeer?.name ?? '';
    const meTag = `${me}${selfReady ? ' ✓' : ''}`;
    const peers = adapter.peers.map(p => `${p.name}${peerReady.get(p.name) ? ' ✓' : ''}`).join(', ');
    const roleTag = adapter.role === 'host' ? '[主机]' : adapter.role === 'guest' ? '[观战]' : '';
    infoEl.textContent = `房间 ${adapter.currentRoomId ?? ''} ${roleTag} — 我：${meTag}${peers ? '；对端：' + peers : '；等待对端加入...'}`;
  }

  const logEl = document.getElementById('mp-chat-log');
  if (logEl) {
    logEl.innerHTML = chatLog.map(l => l.replace(/</g, '&lt;')).join('<br/>');
    logEl.scrollTop = logEl.scrollHeight;
  }

  const errEl = document.getElementById('mp-error');
  if (errEl) errEl.textContent = lastError;
}

function renderRoomRow(r: RoomInfo): string {
  const full = r.count >= 2;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #34495e;">
      <div>
        <span style="color:#fff;font-weight:bold;">${escapeHtml(r.name)}</span>
        <span style="color:#7f8c8d;margin-left:8px;font-size:11px;">${r.count}/2 · 准备 ${r.readyCount}</span>
      </div>
      <button data-room="${r.id}" ${full ? 'disabled' : ''} style="padding:4px 12px;background:${full ? '#7f8c8d' : '#16a085'};border:none;color:#fff;border-radius:3px;cursor:${full ? 'not-allowed' : 'pointer'};font-size:12px;">${full ? '已满' : '加入'}</button>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}
