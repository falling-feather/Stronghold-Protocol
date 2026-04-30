// v4.0.0：联机大厅 — WebSocket 房间管理 + 准备 + 聊天
import { RoomInfo } from '../network/WsAdapter';
import { mpAdapter } from '../network/mpBridge';
import { showOnly } from './shared';
import { showMultiplayerGuestViewer } from './MultiplayerGuestViewer';
import { getDefaultMpUrl } from '../network/mpConfig';
import { showAlert } from '../core/ModalSystem';

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
          showAlert('双方已就绪 · 你是主机', '请点击「开始游戏」选择阵营进入战斗，画面会自动同步给观战方。');
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
    <div class="mp-lobby-wrap">
      <div class="mp-banner">
        <b>v4.0+ 联机骨架</b> · 房间 / 聊天 / 准备 / 双向标记 / 提议 / 提示。
        本地联调请另开终端 <code>npm run mp-server</code>；公网部署见
        <a href="https://github.com/falling-feather/Stronghold-Protocol/blob/main/docs/MP_SERVER_DEPLOY.md" target="_blank" rel="noopener">MP_SERVER_DEPLOY.md</a>。
      </div>

      <div class="mp-conn-bar">
        <input id="mp-url" class="mp-input mp-input-url" value="${escapeAttr(DEFAULT_URL)}" placeholder="ws:// 或 wss:// 中继地址" />
        <input id="mp-name" class="mp-input mp-input-name" placeholder="昵称" value="玩家" />
        <button id="btn-mp-connect" class="mp-btn mp-btn-primary">连接</button>
        <button id="btn-mp-disconnect" class="mp-btn mp-btn-ghost">断开</button>
      </div>

      <div id="mp-conn-status" class="mp-status">状态：未连接</div>

      <div id="mp-lobby" class="mp-lobby" style="display:none;">
        <div class="mp-lobby-grid">
          <section class="mp-card mp-card-host">
            <header class="mp-card-title">创建房间</header>
            <input id="mp-create-name" class="mp-input" placeholder="房间名（可选）" />
            <button id="btn-mp-create" class="mp-btn mp-btn-primary mp-btn-block">创建</button>
          </section>
          <section class="mp-card mp-card-join">
            <header class="mp-card-title">房间列表</header>
            <div id="mp-room-list" class="mp-room-list"></div>
          </section>
        </div>
      </div>

      <div id="mp-room" class="mp-room" style="display:none;">
        <div class="mp-room-head">
          <div id="mp-room-info" class="mp-room-info"></div>
          <div class="mp-room-actions">
            <button id="btn-mp-ready" class="mp-btn mp-btn-success">准备</button>
            <button id="btn-mp-leave" class="mp-btn mp-btn-danger">离开</button>
          </div>
        </div>
        <div id="mp-chat-log" class="mp-chat-log"></div>
        <div class="mp-chat-input-row">
          <input id="mp-chat-input" class="mp-input" placeholder="输入消息后按 Enter 发送" />
          <button id="btn-mp-chat-send" class="mp-btn mp-btn-slate">发送</button>
        </div>
      </div>

      <div id="mp-error" class="mp-error"></div>
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
      btn.classList.toggle('mp-btn-success', !readyState);
      btn.classList.toggle('mp-btn-warn', readyState);
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
    if (rooms.length === 0) listEl.innerHTML = '<div class="mp-room-empty">（暂无房间）</div>';
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
    <div class="mp-room-row">
      <div class="mp-room-row-info">
        <span class="mp-room-row-name">${escapeHtml(r.name)}</span>
        <span class="mp-room-row-meta">${r.count}/2 · 准备 ${r.readyCount}</span>
      </div>
      <button data-room="${r.id}" ${full ? 'disabled' : ''} class="mp-btn ${full ? 'mp-btn-disabled' : 'mp-btn-success'} mp-btn-sm">${full ? '已满' : '加入'}</button>
    </div>
  `;
}

function escapeAttr(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}
