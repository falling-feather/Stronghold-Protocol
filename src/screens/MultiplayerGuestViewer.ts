// v4.1.0：联机观战（guest 只读镜像）
import { mpAdapter } from '../network/mpBridge';
import { GameStateSnapshot } from '../core/GameEngine';
import { showOnly } from './shared';
import { CONFIG } from '../config/gameData';
import { installMarkerListener, pushLocalMarker, drawMarkers } from '../network/mpMarkers';
import { playSfx } from '../core/AudioSystem';

let initialized = false;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let lastSnap: GameStateSnapshot | null = null;
let infoBar: HTMLElement | null = null;
let containerEl: HTMLElement | null = null;

const W = CONFIG.MAP_WIDTH * CONFIG.TILE_SIZE;
const H = CONFIG.MAP_HEIGHT * CONFIG.TILE_SIZE;

export function initMultiplayerGuestViewer(): void {
  if (initialized) return;
  initialized = true;

  // 注入观战 DOM
  let host = document.getElementById('mp-guest-screen');
  if (!host) {
    host = document.createElement('div');
    host.id = 'mp-guest-screen';
    host.style.cssText = 'display:none;width:100%;height:100%;background:#0e1116;color:#ecf0f1;flex-direction:column;align-items:center;padding:20px;box-sizing:border-box;';
    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;max-width:${W + 40}px;margin-bottom:10px;">
        <button id="btn-mp-guest-back" style="padding:6px 14px;background:#7f8c8d;border:none;color:#fff;border-radius:3px;cursor:pointer;">← 退出观战</button>
        <h3 style="margin:0;color:#3498db;">联机观战（只读镜像 v4.1.0）</h3>
        <span style="width:90px;"></span>
      </div>
      <div id="mp-guest-info" style="width:100%;max-width:${W + 40}px;background:#1a1d24;padding:8px 14px;border-radius:4px;font-family:monospace;font-size:13px;margin-bottom:10px;color:#bdc3c7;">等待 host 推送游戏状态...</div>
      <canvas id="mp-guest-canvas" width="${W}" height="${H}" style="background:#1a1d24;border:1px solid #34495e;border-radius:4px;cursor:crosshair;"></canvas>
      <div id="mp-guest-quick" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;width:100%;max-width:${W + 40}px;justify-content:center;">
        <button id="btn-mp-guest-deploy" style="padding:6px 12px;background:#16a085;border:none;color:#fff;border-radius:3px;cursor:pointer;font-size:12px;font-weight:bold;">🎯 提议部署 (点格子)</button>
      </div>
      <div id="mp-guest-toasts" style="position:fixed;top:60px;right:20px;display:flex;flex-direction:column;gap:6px;z-index:10000;pointer-events:none;"></div>
      <div style="margin-top:6px;font-size:12px;color:#7f8c8d;text-align:center;max-width:${W + 40}px;">
        v4.2.3：点击画布发📍标记；快捷指令按钮使用最近鼠标位置；🎯 部署模式下点击格子向 host 提议部署。
      </div>
    `;
    document.body.appendChild(host);
  }
  containerEl = host;
  canvas = document.getElementById('mp-guest-canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d');
  infoBar = document.getElementById('mp-guest-info');

  document.getElementById('btn-mp-guest-back')?.addEventListener('click', () => hideMultiplayerGuestViewer());

  // v4.2.0：点击发送标记
  installMarkerListener();
  let lastMouse = { x: W / 2, y: H / 2 };
  let deployMode = false;
  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas!.getBoundingClientRect();
    lastMouse = {
      x: Math.round((ev.clientX - rect.left) * (canvas!.width / rect.width)),
      y: Math.round((ev.clientY - rect.top) * (canvas!.height / rect.height)),
    };
  });
  canvas.addEventListener('click', (ev) => {
    const rect = canvas!.getBoundingClientRect();
    const x = Math.round((ev.clientX - rect.left) * (canvas!.width / rect.width));
    const y = Math.round((ev.clientY - rect.top) * (canvas!.height / rect.height));
    if (deployMode) {
      // v4.2.3：部署提议模式
      const gx = Math.floor(x / CONFIG.TILE_SIZE);
      const gy = Math.floor(y / CONFIG.TILE_SIZE);
      mpAdapter.sendEvent('deploy_request', `提议在格 (${gx},${gy}) 部署干员`, 'warn');
      showEventToast(`已发送部署提议 → 格 (${gx},${gy})`, 'info');
      // 本地也放一个标记便于视觉确认
      pushLocalMarker(x, y, mpAdapter.localPeer?.name ?? '我', '🎯部署');
      playSfx('event'); // v4.2.4
      deployMode = false;
      updateDeployBtn();
      render();
      return;
    }
    mpAdapter.sendMarker(x, y);
    pushLocalMarker(x, y, mpAdapter.localPeer?.name ?? '我');
    playSfx('click'); // v4.2.4
    render();
  });

  // v4.2.3：部署提议按钮
  const deployBtn = document.getElementById('btn-mp-guest-deploy') as HTMLButtonElement | null;
  function updateDeployBtn(): void {
    if (!deployBtn) return;
    if (deployMode) {
      deployBtn.textContent = '✕ 取消部署提议';
      deployBtn.style.background = '#c0392b';
    } else {
      deployBtn.textContent = '🎯 提议部署 (点格子)';
      deployBtn.style.background = '#16a085';
    }
  }
  deployBtn?.addEventListener('click', () => {
    deployMode = !deployMode;
    updateDeployBtn();
  });
  updateDeployBtn();

  // v4.2.1：预设快捷指令按钮
  const quick = document.getElementById('mp-guest-quick');
  if (quick) {
    const presets: { emoji: string; label: string; color: string }[] = [
      { emoji: '⚠', label: '危险', color: '#e74c3c' },
      { emoji: '🛡', label: '备战', color: '#3498db' },
      { emoji: '💰', label: '金钱不足', color: '#f1c40f' },
      { emoji: '👹', label: 'Boss', color: '#9b59b6' },
      { emoji: '🏃', label: '撤退', color: '#7f8c8d' },
      { emoji: '🤝', label: '支援', color: '#27ae60' },
    ];
    for (const p of presets) {
      const b = document.createElement('button');
      b.textContent = `${p.emoji} ${p.label}`;
      b.style.cssText = `padding:6px 12px;background:${p.color};border:none;color:#fff;border-radius:3px;cursor:pointer;font-size:12px;font-weight:bold;`;
      b.addEventListener('click', () => {
        const label = `${p.emoji}${p.label}`;
        mpAdapter.sendMarker(lastMouse.x, lastMouse.y, label);
        pushLocalMarker(lastMouse.x, lastMouse.y, mpAdapter.localPeer?.name ?? '我', label);
        playSfx('click'); // v4.2.4
        render();
      });
      quick.appendChild(b);
    }
  }

  mpAdapter.on('game', (msg) => {
    const snap = (msg.payload as any)?.payload as GameStateSnapshot | undefined;
    if (!snap) return;
    lastSnap = snap;
    if (containerEl && containerEl.style.display !== 'none') render();
  });
  mpAdapter.on('event', (msg) => {
    // v4.1.0：host 推送的事件 toast
    const p = msg.payload as any;
    if (!p) return;
    showEventToast(String(p.text || ''), String(p.level || 'info'));
    // v4.2.4：事件音效
    const lvl = String(p.level || 'info');
    if (lvl === 'danger' || lvl === 'warn') playSfx('event');
    else if (lvl === 'success') playSfx('wave_clear');
    else playSfx('click');
  });
  mpAdapter.on('peer_left', () => {
    lastSnap = null;
    if (infoBar) infoBar.textContent = '⚠ 对端（host）已离开 — 直播结束';
    render();
  });
  mpAdapter.on('disconnect', () => {
    lastSnap = null;
    if (infoBar) infoBar.textContent = '⚠ 与服务器连接断开';
    render();
  });
}

export function showMultiplayerGuestViewer(): void {
  initMultiplayerGuestViewer();
  showOnly('start-screen');
  // 隐藏其他屏并显示自身
  document.getElementById('start-screen')!.style.display = 'none';
  if (containerEl) containerEl.style.display = 'flex';
  render();
}

export function hideMultiplayerGuestViewer(): void {
  if (containerEl) containerEl.style.display = 'none';
  showOnly('start-screen');
}

// v4.1.0：host→guest 事件 toast
function showEventToast(text: string, level: string): void {
  const wrap = document.getElementById('mp-guest-toasts');
  if (!wrap || !text) return;
  const colors: Record<string, string> = {
    info: '#3498db',
    warn: '#f39c12',
    success: '#27ae60',
    danger: '#e74c3c',
  };
  const bg = colors[level] || colors.info;
  const t = document.createElement('div');
  t.style.cssText = `background:${bg};color:#fff;padding:8px 14px;border-radius:4px;font-size:13px;font-family:monospace;box-shadow:0 2px 8px rgba(0,0,0,0.4);min-width:160px;text-align:left;opacity:0;transform:translateX(20px);transition:opacity 0.2s,transform 0.2s;`;
  t.textContent = text;
  wrap.appendChild(t);
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(0)';
  });
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    setTimeout(() => t.remove(), 250);
  }, 3500);
}

function render(): void {
  if (!ctx || !canvas) return;
  ctx.fillStyle = '#1a1d24';
  ctx.fillRect(0, 0, W, H);

  // 网格
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x <= CONFIG.MAP_WIDTH; x++) {
    ctx.beginPath(); ctx.moveTo(x * CONFIG.TILE_SIZE, 0); ctx.lineTo(x * CONFIG.TILE_SIZE, H); ctx.stroke();
  }
  for (let y = 0; y <= CONFIG.MAP_HEIGHT; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CONFIG.TILE_SIZE); ctx.lineTo(W, y * CONFIG.TILE_SIZE); ctx.stroke();
  }

  if (!lastSnap) {
    if (infoBar) infoBar.textContent = '等待 host 推送游戏状态...';
    return;
  }
  const s = lastSnap;

  // 操作员
  for (const o of s.operators) {
    ctx.fillStyle = o.color || '#3498db';
    ctx.beginPath(); ctx.arc(o.x, o.y, o.radius || 18, 0, Math.PI * 2); ctx.fill();
    // 血条
    const w = 30, h = 4, hpr = o.maxHp ? o.hp / o.maxHp : 1;
    ctx.fillStyle = '#000'; ctx.fillRect(o.x - w / 2, o.y - (o.radius || 18) - 8, w, h);
    ctx.fillStyle = '#27ae60'; ctx.fillRect(o.x - w / 2, o.y - (o.radius || 18) - 8, w * hpr, h);
  }

  // 敌人
  for (const e of s.enemies) {
    ctx.fillStyle = e.color || '#e74c3c';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius || 12, 0, Math.PI * 2); ctx.fill();
    const w = 24, h = 3, hpr = e.maxHp ? e.hp / e.maxHp : 1;
    ctx.fillStyle = '#000'; ctx.fillRect(e.x - w / 2, e.y - (e.radius || 12) - 6, w, h);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(e.x - w / 2, e.y - (e.radius || 12) - 6, w * hpr, h);
  }

  // 子弹
  for (const p of s.projectiles) {
    ctx.fillStyle = p.color || '#f1c40f';
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // v4.2.0：标记点
  drawMarkers(ctx);

  if (infoBar) {
    const hostName = mpAdapter.peers[0]?.name ?? 'host';
    infoBar.textContent = `📡 ${hostName} · 阶段 ${s.phase} · 波次 ${s.waveIndex} · 生命 ${s.lives} · 金钱 ${s.money} · 核心 Lv${s.coreLevel} · 剩余 ${s.combatTimeRemaining}s · 敌 ${s.enemies.length} / 干 ${s.operators.length}`;
  }
}
