// 游戏对局屏幕：包含初始化、UI 渲染循环、交互事件、详情面板、拖拽（v1.5.x）
import { GameEngine } from '../core/GameEngine';
import { Renderer } from '../view/Renderer';
import { onLayoutChange } from '../core/LayoutManager';
import { CONFIG, OPERATOR_DB, selectRandomMap, validateMaps, resolveSkillForRank, CLASS_TRAITS, PACT_DB, RESONANCE_DB, WAVES, ENEMY_DB } from '../config/gameData';
import { FactionId } from '../config/factions';
import { Roster, rosterToAllowedSet } from '../config/roster';
import { Direction, PactSelection } from '../types';
import { showOnly } from './shared';
import { startBgm } from '../core/AudioSystem';
import type { BoonId } from '../config/boonData';
import { mpAdapter, isMpHost } from '../network/mpBridge';
import { installMarkerListener, drawMarkers, pushLocalMarker } from '../network/mpMarkers';
import { playSfx } from '../core/AudioSystem';

let canvas: HTMLCanvasElement | null = null;
let engine: GameEngine | null = null;
let renderer: Renderer | null = null;

let uiWave: HTMLElement;
let uiLives: HTMLElement;
let uiMoney: HTMLElement;
let uiCore: HTMLElement | null;
let uiTimer: HTMLElement;
let uiTimerBox: HTMLElement;
let benchContainer: HTMLElement;
let shopContainer: HTMLElement;
let bottomArea: HTMLElement;
let detailPanel: HTMLElement;
let detailContent: HTMLElement;
let btnActionMain: HTMLButtonElement;
let btnUpgrade: HTMLButtonElement;
let txtUpgradeCost: HTMLElement;
let appRoot: HTMLElement | null = null;

let selectedType: 'shop' | 'bench' | 'map' | null = null;
let selectedId: string | null = null;
let isDragging = false;
let draggedBenchUid: string | null = null;
let dragGhost: HTMLElement | null = null;
let lastTime = 0;
let mouseGridPos: { x: number, y: number } | null = null;
let isDraggingFromPending: boolean = false;
let pendingDragStartGrid: { x: number, y: number } | null = null;

let resizeListenersBound = false;
let interactionEventsBound = false;

export function startGame(factionId: FactionId, roster: Roster, activePactSelections: PactSelection[] | null = null, activeBoonId: BoonId | null = null, isDaily: boolean = false): void {
  appRoot = document.getElementById('app-root');
  showOnly('app-root');

  // UI 元素延迟获取
  canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  uiWave = document.getElementById('wave-display')!;
  uiLives = document.getElementById('lives-display')!;
  uiMoney = document.getElementById('money-display')!;
  uiCore = document.getElementById('core-display');
  uiTimer = document.getElementById('timer-display')!;
  uiTimerBox = document.getElementById('timer-box')!;
  benchContainer = document.getElementById('bench-area')!;
  shopContainer = document.getElementById('shop-cards')!;
  bottomArea = document.getElementById('bottom-area')!;
  detailPanel = document.getElementById('detail-panel')!;
  detailContent = document.getElementById('detail-content')!;
  btnActionMain = document.getElementById('btn-action-main') as HTMLButtonElement;
  btnUpgrade = document.getElementById('btn-upgrade') as HTMLButtonElement;
  txtUpgradeCost = document.getElementById('txt-upgrade-cost')!;

  const mapCheck = validateMaps();
  if (!mapCheck.ok) {
    console.warn('[validateMaps] 发现违规地图：');
    mapCheck.issues.forEach(s => console.warn('  - ' + s));
  } else {
    console.info('[validateMaps] 全部地图通过路径校验');
  }

  selectRandomMap();

  const allowed = rosterToAllowedSet(roster);
  engine = new GameEngine(factionId, allowed, activePactSelections, activeBoonId, isDaily);
  renderer = new Renderer(canvas);
  // v2.3.0：开发期暴露 engine，便于 devtools 中验证 buff 框架（如：engine.applyEffectToOperator('op_xxx', {id:'t',name:'测试',kind:'buff',stat:'atk',mod:0.5,modType:'pct',duration:10,remaining:10})）
  (window as any).engine = engine;

  engine.onStateUpdated = () => {
    renderUI();
    // v4.1.0：host 广播游戏快照（带节流：每 ~120ms 一帧）
    if (isMpHost()) hostMaybeBroadcast();
    // v4.1.0：host 检测关键事件并 toast 推送给 guest
    if (isMpHost()) hostMaybeEmitEvents();
  };

  // v3.9.0：开战时启动 BGM（用户点击为合法手势）
  startBgm();

  // v4.1.1：host 联机时顶部直播横幅
  ensureMpHostBanner();

  // v4.2.0：host 监听 guest 标记
  if (isMpHost()) installMarkerListener();

  // v4.1.0：重置 host 事件追踪
  if (isMpHost()) resetHostEventTracker();

  // v4.2.3：host 监听 guest 部署提议
  if (isMpHost()) installGuestEventListener();

  // v4.3.1：联机时 host 在游戏内显示可折叠聊天面板
  if (isMpHost()) ensureMpHostChatPanel();

  // v4.3.5：联机时 host 在游戏内显示提议历史面板
  if (isMpHost()) ensureMpHostHistoryPanel();

  // v3.5.3：事件日志按钮（点击弹出已触发事件历史）
  const btnEventLog = document.getElementById('btn-event-log');
  if (btnEventLog) {
    btnEventLog.onclick = () => showEventLogModal();
  }

  renderUI();

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);

  // 一次性绑定按钮（GameScreen 在整个会话内只启动一次时安全；如需重玩需在此清理旧 listener）
  document.getElementById('btn-next-wave')?.addEventListener('click', () => engine!.tryStartCombat());
  document.getElementById('btn-refresh')?.addEventListener('click', () => engine!.refreshShop());
  document.getElementById('btn-upgrade')?.addEventListener('click', () => engine!.upgradeCore());

  setTimeout(() => {
    handleResize();
    if (renderer) renderer.resize();
  }, 100);

  if (!resizeListenersBound) {
    // v3.20.0：布局变化由全局 LayoutManager 统一驱动；本屏只补 canvas 尺寸 + 内部布局
    onLayoutChange(() => {
      handleResize();
      if (renderer) {
        setTimeout(() => { if (renderer) renderer.resize(); }, 50);
      }
    });
    resizeListenersBound = true;
  }

  if (!interactionEventsBound) {
    initInteractionEvents();
    interactionEventsBound = true;
  }
}

function calculateLayout(): void {
  if (!appRoot) return;

  const topBar = document.getElementById('top-bar');
  const bottom = document.getElementById('bottom-area');
  if (!topBar || !bottom) return;

  appRoot.style.transform = 'none';
  appRoot.style.width = '100%';
  appRoot.style.height = '100%';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!appRoot || !topBar || !bottom) return;

      const topBarHeight = topBar.offsetHeight || 50;
      const bottomAreaHeight = bottom.offsetHeight || 220;
      const availableHeight = window.innerHeight - topBarHeight - bottomAreaHeight;
      const minMapHeight = 400;

      let scale = 1;
      if (availableHeight < minMapHeight) {
        const totalRequiredHeight = topBarHeight + bottomAreaHeight + minMapHeight;
        scale = window.innerHeight / totalRequiredHeight;
      }

      if (scale < 1) {
        appRoot.style.transform = `scale(${scale})`;
        appRoot.style.transformOrigin = 'top center';
        appRoot.style.width = `${100 / scale}%`;
        appRoot.style.height = `${100 / scale}%`;
      } else {
        appRoot.style.transform = 'none';
        appRoot.style.width = '100%';
        appRoot.style.height = '100%';
      }
    });
  });
}

function handleResize(): void {
  // v3.20.0：旋转/aspect 由 LayoutManager 负责，本函数只重算游戏区缩放
  const overlay = document.getElementById('mobile-overlay');
  if (overlay) overlay.style.display = 'none';
  if (appRoot && appRoot.style.display !== 'none') {
    setTimeout(() => calculateLayout(), 100);
  }
}

function renderUI(): void {
  if (!engine) return;

  uiWave.innerText = (engine.waveIndex + 1).toString();
  uiLives.innerText = engine.lives.toString();
  uiMoney.innerText = Math.floor(engine.money).toString();
  if (uiCore) uiCore.innerText = engine.coreLevel.toString();
  renderPactBadges();

  if (engine.phase === 'COMBAT') {
    bottomArea.classList.add('hidden');
    uiTimerBox.style.display = 'block';
    uiTimer.innerText = Math.ceil(engine.combatTimeRemaining).toString();
    if (selectedType === 'shop' || selectedType === 'bench') closeDetailPanel();
  } else {
    bottomArea.classList.remove('hidden');
    uiTimerBox.style.display = 'none';
  }

  renderShop();
  renderBench();
  updateDetailPanel();
  renderEventModal();
  // v3.5.3：根据是否有事件历史显示日志按钮
  const btnEventLog = document.getElementById('btn-event-log');
  if (btnEventLog) {
    btnEventLog.style.display = engine.eventHistory.length > 0 ? '' : 'none';
    btnEventLog.textContent = `📜 ${engine.eventHistory.length}`;
  }

  const upgradeCost = engine.coreLevel * 10;
  if (engine.coreLevel >= 5) {
    txtUpgradeCost.innerText = 'MAX';
    btnUpgrade.disabled = true;
  } else {
    txtUpgradeCost.innerText = `资金 ${upgradeCost}`;
    btnUpgrade.disabled = false;
  }

  setTimeout(() => calculateLayout(), 50);
}

// v3.5.0：事件卡 modal 渲染（基于 engine.pendingEvent 状态）
function renderEventModal(): void {
  if (!engine) return;
  let overlay = document.getElementById('event-overlay');
  if (!engine.pendingEvent) {
    if (overlay) overlay.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'event-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;z-index:9999;';
    document.body.appendChild(overlay);
  }
  const ev = engine.pendingEvent;
  // v3.5.2：按 rarity 着色（边框 + 标签）
  const rarity = ev.rarity ?? 'common';
  const rarityStyle = {
    common: { color: '#bdc3c7', label: '常见', glow: 'rgba(189,195,199,0.4)' },
    rare:   { color: '#3498db', label: '稀有', glow: 'rgba(52,152,219,0.55)' },
    epic:   { color: '#9b59b6', label: '史诗', glow: 'rgba(155,89,182,0.65)' },
  }[rarity];
  const optsHtml = ev.options.map((o, i) => `
    <button class="event-opt-btn" data-idx="${i}" style="display:block;width:100%;margin:8px 0;padding:12px 14px;background:linear-gradient(135deg,#3a3f4b,#2c3038);color:${rarityStyle.color};border:1px solid ${rarityStyle.color};border-radius:6px;cursor:pointer;text-align:left;font-size:14px;">
      <div style="font-weight:700;color:#fff;">${o.label}</div>
      <div style="font-size:12px;color:#bdc3c7;margin-top:3px;">${o.desc}</div>
    </button>
  `).join('');
  overlay.innerHTML = `
    <div style="max-width:520px;width:90%;background:linear-gradient(180deg,#1f2530,#161a22);border:2px solid ${rarityStyle.color};border-radius:10px;padding:22px;box-shadow:0 0 32px ${rarityStyle.glow}, 0 10px 40px rgba(0,0,0,0.6);">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;color:${rarityStyle.color};letter-spacing:2px;">
        <span>⚑ 战场事件</span>
        <span style="background:${rarityStyle.color};color:#161a22;padding:2px 8px;border-radius:4px;font-weight:700;letter-spacing:1px;">${rarityStyle.label}</span>
      </div>
      <div style="font-size:22px;font-weight:700;color:#fff;margin:6px 0 10px;">${ev.name}</div>
      <div style="font-size:13px;color:#ecf0f1;line-height:1.6;margin-bottom:12px;">${ev.desc}</div>
      ${optsHtml}
    </div>
  `;
  overlay.querySelectorAll<HTMLButtonElement>('.event-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx || '0', 10);
      engine!.resolveEvent(idx);
    });
  });
}

// v3.5.3：事件日志 modal（顶栏按钮触发）
function showEventLogModal(): void {
  if (!engine) return;
  let overlay = document.getElementById('event-log-overlay');
  if (overlay) { overlay.remove(); return; }
  overlay = document.createElement('div');
  overlay.id = 'event-log-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9998;';
  const rarityColor: Record<'common'|'rare'|'epic', string> = {
    common: '#bdc3c7', rare: '#3498db', epic: '#9b59b6',
  };
  const items = engine.eventHistory.length === 0
    ? '<div style="color:#7f8c8d;text-align:center;padding:24px;">本局尚未触发任何事件</div>'
    : engine.eventHistory.map((h, i) => `
      <div style="border-left:3px solid ${rarityColor[h.rarity]};padding:10px 12px;margin:8px 0;background:rgba(255,255,255,0.04);border-radius:4px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:${rarityColor[h.rarity]};">
          <span>第 ${h.afterWave} 波后 · ${h.rarity === 'common' ? '常见' : h.rarity === 'rare' ? '稀有' : '史诗'}</span>
          <span>#${i + 1}</span>
        </div>
        <div style="font-size:15px;font-weight:700;color:#fff;margin:4px 0 2px;">${h.eventName}</div>
        <div style="font-size:13px;color:#ecf0f1;">→ ${h.optionLabel}</div>
      </div>
    `).join('');
  overlay.innerHTML = `
    <div style="max-width:560px;width:92%;max-height:80vh;overflow-y:auto;background:linear-gradient(180deg,#1f2530,#161a22);border:2px solid #f1c40f;border-radius:10px;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.6);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:18px;font-weight:700;color:#f1c40f;">📜 事件日志（共 ${engine.eventHistory.length} 条）</div>
        <button id="event-log-close" style="background:transparent;color:#fff;border:1px solid #7f8c8d;border-radius:4px;padding:4px 10px;cursor:pointer;">关闭</button>
      </div>
      ${items}
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#event-log-close')?.addEventListener('click', () => overlay!.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay!.remove(); });
}

// v3.0.0：盟约徽记渲染
function renderPactBadges(): void {
  const container = document.getElementById('pact-badges');
  if (!container || !engine) return;
  if (engine.pacts.length === 0) {
    container.innerHTML = '';
    return;
  }
  const tierColors = ['#7f8c8d', '#3498db', '#9b59b6', '#f1c40f'];
  const now = performance.now();
  container.innerHTML = engine.pacts.map(rt => {
    const def = PACT_DB[rt.defId];
    if (!def) return '';
    const tierIdx = rt.appliedTier; // -1 表示未达阈值
    const colorIdx = Math.max(0, tierIdx + 1);
    const color = tierColors[Math.min(colorIdx, tierColors.length - 1)];
    const nextTier = def.tiers[tierIdx + 1];
    const tierDesc = tierIdx >= 0 ? def.tiers[tierIdx].description : '未激活';
    const nextDesc = nextTier ? `\n下一档 @ ${nextTier.threshold}：${nextTier.description}` : '\n已达最高档';
    const title = `${def.name}${rt.shackled ? ' ⛓枷锁' : ''}（${rt.stack}/${def.cap}）\n${def.desc}\n当前：${tierDesc}${nextDesc}${(def.penaltyDesc && rt.shackled) ? '\n' + def.penaltyDesc + '（生效中）' : ''}`;
    const borderColor = rt.shackled ? '#c0392b' : 'rgba(255,255,255,0.4)';
    // v3.2.2：根据时间戳决定动画 class
    const cls: string[] = ['pact-badge'];
    if (rt.lastTierUpAt && now - rt.lastTierUpAt < 1000) cls.push('tier-up');
    else if (rt.lastStackChangeAt && now - rt.lastStackChangeAt < 280) cls.push('stack-bump');
    return `<div class="${cls.join(' ')}" title="${title.replace(/"/g, '&quot;')}" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:bold;margin-left:6px;border:2px solid ${borderColor};">${rt.stack}${rt.shackled ? '⛓' : ''}</div>`;
  }).join('');
  // v3.3.0：盟约共鸣徽记（金色 ✦）；v3.3.3：枷锁加成版加 ⛓ + 红边
  if (engine && engine.activeResonances.size > 0) {
    const eng = engine;
    const resoHtml = Array.from(eng.activeResonances.entries()).map(([rid, boost]) => {
      const reso = RESONANCE_DB[rid];
      if (!reso) return '';
      const activatedAt = eng.resonanceActivatedAt[rid] || 0;
      const flashCls = (now - activatedAt < 1200) ? ' tier-up' : '';
      const title = `${reso.name}${boost ? '（⛓ 枷锁加成 翻倍）' : ''}\n${reso.desc}（生效中${boost ? '·翻倍' : ''}）`;
      const bg = boost ? 'linear-gradient(90deg,#c0392b,#e67e22,#f1c40f)' : 'linear-gradient(90deg,#f1c40f,#e67e22)';
      const border = boost ? '#c0392b' : '#fff';
      const label = `${boost ? '⛓✦' : '✦'}${reso.name}${boost ? ' ×2' : ''}`;
      return `<div class="pact-badge${flashCls}" title="${title.replace(/"/g, '&quot;')}" style="display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 8px;border-radius:16px;background:${bg};color:#000;font-size:11px;font-weight:bold;margin-left:8px;border:2px solid ${border};">${label}</div>`;
    }).join('');
    container.innerHTML += resoHtml;
  }
}

function gameLoop(timestamp: number): void {
  if (!engine || !renderer) return;

  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  engine.update(dt);

  let highlightTemplateId: string | null = null;
  if (isDragging && draggedBenchUid) {
    const benchOp = engine.bench.find(b => b.uid === draggedBenchUid);
    if (benchOp) highlightTemplateId = benchOp.templateId;
  } else if (selectedType === 'shop' && selectedId) {
    const item = engine.shopItems.find(i => i.uid === selectedId);
    if (item) highlightTemplateId = item.templateId;
  } else if (selectedType === 'bench' && selectedId) {
    const benchOp = engine.bench.find(b => b.uid === selectedId);
    if (benchOp) highlightTemplateId = benchOp.templateId;
  }

  let previewDirection: Direction | null = null;
  if (engine.pendingDeployment && mouseGridPos) {
    const pending = engine.pendingDeployment;
    const dx = mouseGridPos.x - pending.gridX;
    const dy = mouseGridPos.y - pending.gridY;
    if (Math.abs(dx) > Math.abs(dy)) {
      previewDirection = dx > 0 ? 'right' : 'left';
    } else if (dy !== 0) {
      previewDirection = dy > 0 ? 'down' : 'up';
    } else {
      previewDirection = 'down';
    }
  }

  renderer.render(engine, highlightTemplateId, previewDirection);

  // v4.2.0：host 在主画面叠加 guest 发来的标记
  if (isMpHost() && canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) drawMarkers(ctx);
  }

  // v2.0.0：场上单位被选中时实时刷新 SP 进度
  if (selectedType === 'map' && selectedId) updateDetailPanel();

  requestAnimationFrame(gameLoop);
}

function initInteractionEvents(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target && target.closest('#start-screen')) return;
    if (!engine) return;

    const isClickingUI = target && (
      target.closest('#detail-panel') ||
      target.closest('button') ||
      target.closest('#top-bar') ||
      target.closest('#bottom-area') ||
      target.closest('.shop-card') ||
      target.closest('.bench-card')
    );

    if (!isClickingUI || target.id === 'game-canvas') {
      closeDetailPanel();
      if (engine && engine.pendingDeployment) engine.cancelPendingDeployment();
    }
  });

  canvas!.addEventListener('mousemove', (e) => {
    if (!engine || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    mouseGridPos = {
      x: Math.floor(x / CONFIG.TILE_SIZE),
      y: Math.floor(y / CONFIG.TILE_SIZE)
    };
  });

  canvas!.addEventListener('mousedown', (e) => {
    if (!engine || !canvas || engine.phase !== 'PREP') return;
    if (!engine.pendingDeployment) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const gridX = Math.floor(x / CONFIG.TILE_SIZE);
    const gridY = Math.floor(y / CONFIG.TILE_SIZE);

    const pending = engine.pendingDeployment;
    if (gridX === pending.gridX && gridY === pending.gridY) {
      isDraggingFromPending = true;
      pendingDragStartGrid = { x: gridX, y: gridY };
      isDragging = true;

      dragGhost = document.createElement('div');
      dragGhost.className = 'drag-ghost';
      dragGhost.innerText = '设置朝向';
      dragGhost.style.backgroundColor = 'rgba(255, 200, 0, 0.8)';
      document.body.appendChild(dragGhost);
      updateGhostPosition(e);

      const moveHandler = (ev: MouseEvent | TouchEvent) => {
        let clientX, clientY;
        if (ev instanceof MouseEvent) {
          clientX = ev.clientX; clientY = ev.clientY;
        } else {
          clientX = ev.touches[0].clientX; clientY = ev.touches[0].clientY;
        }
        updateGhostPosition({ clientX, clientY } as any);
      };
      const endHandler = (ev: MouseEvent | TouchEvent) => {
        let clientX, clientY;
        if (ev instanceof MouseEvent) {
          clientX = ev.clientX; clientY = ev.clientY;
        } else {
          clientX = ev.changedTouches[0].clientX; clientY = ev.changedTouches[0].clientY;
        }
        onDragEnd(clientX, clientY);
        document.removeEventListener('mousemove', moveHandler as any);
        document.removeEventListener('mouseup', endHandler as any);
        document.removeEventListener('touchmove', moveHandler as any);
        document.removeEventListener('touchend', endHandler as any);
      };
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', endHandler);
      document.addEventListener('touchmove', moveHandler, { passive: false });
      document.addEventListener('touchend', endHandler);
    }
  });

  canvas!.addEventListener('click', (e) => {
    if (!engine) return;
    e.stopPropagation();
    if (isDragging) return;

    const rect = canvas!.getBoundingClientRect();
    const scaleX = canvas!.width / rect.width;
    const scaleY = canvas!.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const gridX = Math.floor(x / CONFIG.TILE_SIZE);
    const gridY = Math.floor(y / CONFIG.TILE_SIZE);

    if (engine.pendingDeployment) {
      const pending = engine.pendingDeployment;
      if (gridX !== pending.gridX || gridY !== pending.gridY) engine.cancelPendingDeployment();
      return;
    }

    const op = engine.operators.find(o => o.gridPos.x === gridX && o.gridPos.y === gridY);
    if (op) {
      selectItem('map', op.id);
    } else {
      closeDetailPanel();
    }
  });
}

function renderShop(): void {
  if (!engine) return;
  shopContainer.innerHTML = '';

  const itemsToRender = engine.isInTemporaryShop ? engine.temporaryShopItems : engine.shopItems;

  itemsToRender.forEach(item => {
    const template = OPERATOR_DB[item.templateId];
    const div = document.createElement('div');
    div.className = `shop-card ${item.bought ? 'bought' : ''} ${selectedType === 'shop' && selectedId === item.uid ? 'selected' : ''}`;
    if (engine!.isInTemporaryShop) {
      div.style.border = '3px solid #f1c40f';
    }
    div.innerHTML = `
      <div class="shop-name">${template.name}</div>
      <div class="shop-stars">${'★'.repeat(template.rarity)}</div>
      <div class="shop-cost">${item.cost === 0 ? '免费' : item.cost}</div>
    `;
    div.onclick = (e) => {
      e.stopPropagation();
      if (!item.bought) selectItem('shop', item.uid);
    };
    shopContainer.appendChild(div);
  });

  if (engine.isInTemporaryShop) {
    const tip = document.createElement('div');
    tip.style.width = '100%';
    tip.style.textAlign = 'center';
    tip.style.color = '#f1c40f';
    tip.style.fontSize = '12px';
    tip.style.marginTop = '10px';
    tip.innerText = '临时商店 - 选择一个免费角色';
    shopContainer.appendChild(tip);
  }
}

function renderBench(): void {
  if (!engine) return;
  benchContainer.innerHTML = '';

  for (let i = 0; i < CONFIG.MAX_BENCH_SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'bench-slot';

    if (i < engine.bench.length) {
      const benchOp = engine.bench[i];
      const template = OPERATOR_DB[benchOp.templateId];

      const card = document.createElement('div');
      card.className = `bench-card ${selectedType === 'bench' && selectedId === benchOp.uid ? 'selected' : ''}`;
      card.style.background = template.color;
      card.style.color = '#fff';
      card.innerText = template.name;

      card.onclick = (e) => {
        e.stopPropagation();
        if (engine!.phase === 'PREP') selectItem('bench', benchOp.uid);
      };
      card.onmousedown = (e) => {
        e.stopPropagation();
        if (engine!.phase === 'PREP') startDrag(e, benchOp.uid, template.name, template.color);
      };
      card.ontouchstart = (e) => {
        e.stopPropagation();
        if (engine!.phase === 'PREP') {
          const touch = e.touches[0];
          startDrag({ clientX: touch.clientX, clientY: touch.clientY } as any, benchOp.uid, template.name, template.color);
        }
      };
      slot.appendChild(card);
    } else {
      slot.innerText = '空置';
    }
    benchContainer.appendChild(slot);
  }

  const sellSlot = document.createElement('div');
  sellSlot.className = 'bench-slot sell-zone';
  sellSlot.innerText = '出售';
  benchContainer.appendChild(sellSlot);
}

function selectItem(type: 'shop' | 'bench' | 'map', id: string): void {
  selectedType = type;
  selectedId = id;
  updateDetailPanel();
  detailPanel.classList.add('visible');
}

function closeDetailPanel(): void {
  selectedType = null;
  selectedId = null;
  detailPanel.classList.remove('visible');
}

function updateDetailPanel(): void {
  if (!engine || !selectedType || !selectedId) return;

  let template: any = null;
  let currentData: any = null;

  btnActionMain.style.display = 'block';
  btnActionMain.className = '';
  btnActionMain.disabled = false;

  if (selectedType === 'shop') {
    const itemsToSearch = engine.isInTemporaryShop ? engine.temporaryShopItems : engine.shopItems;
    const item = itemsToSearch.find(i => i.uid === selectedId);
    if (!item) return;
    template = OPERATOR_DB[item.templateId];
    const costText = item.cost === 0 ? '免费' : item.cost.toString();
    btnActionMain.innerText = `购买 (${costText})`;
    btnActionMain.disabled = (engine.isInTemporaryShop ? false : engine.money < item.cost) || engine.bench.length >= CONFIG.MAX_BENCH_SIZE;
    btnActionMain.onclick = () => {
      if (engine!.tryBuyOperator(item.uid)) closeDetailPanel();
    };
  } else if (selectedType === 'bench') {
    const benchOp = engine.bench.find(b => b.uid === selectedId);
    if (!benchOp) { closeDetailPanel(); return; }
    template = OPERATOR_DB[benchOp.templateId];
    btnActionMain.style.display = 'none';
  } else if (selectedType === 'map') {
    const op = engine.operators.find(o => o.id === selectedId);
    if (!op) { closeDetailPanel(); return; }
    template = OPERATOR_DB[op.templateId];
    currentData = op;
    btnActionMain.innerText = '撤回 (Recall)';
    btnActionMain.className = 'recall';
    btnActionMain.disabled = engine.phase !== 'PREP';
    btnActionMain.onclick = () => {
      if (engine!.phase === 'PREP' && engine!.recallOperator(op.id)) closeDetailPanel();
    };
  }

  const hp = currentData ? Math.floor(currentData.stats.hp) : template.stats.hp;
  const maxHp = template.stats.maxHp;
  const rank: 1 | 2 = ((currentData && currentData.rank) || (selectedType === 'bench'
    ? (engine.bench.find(b => b.uid === selectedId)?.rank ?? 1)
    : 1)) as 1 | 2;
  const trait = CLASS_TRAITS[template.class as keyof typeof CLASS_TRAITS];
  const skillInfo = resolveSkillForRank(template, rank);

  const talentsHtml = template.talents.length === 0
    ? '<div style="color:#7f8c8d;font-size:12px;">— 无天赋 —</div>'
    : template.talents.map((t: any) => {
        const v = rank === 2 ? t.rankValues.rank2 : t.rankValues.rank1;
        const desc = t.desc.replace(/\{r1\}/g, t.rankValues.rank1.toString()).replace(/\{r2\}/g, t.rankValues.rank2.toString());
        return `<div style="background:rgba(241,196,15,0.12);padding:4px 6px;margin:3px 0;border-left:3px solid #f1c40f;border-radius:2px;font-size:12px;">
          <b>${t.name}</b>（当前: ${v}）<br><span style="color:#bdc3c7">${desc}</span>
        </div>`;
      }).join('');

  // v2.0.0：场上单位显示 SP 条 + 手动激活按钮
  let spBlockHtml = '';
  if (selectedType === 'map' && currentData) {
    const op = currentData;
    const pct = Math.min(100, Math.floor((op.currentSp / op.skill.cost) * 100));
    const isReady = op.currentSp >= op.skill.cost && !op.skillActive && op.skill.duration > 0;
    const stateLabel = op.skillActive
      ? `<span style="color:#f1c40f;">激活中 ${op.skillDuration.toFixed(1)}s</span>`
      : (op.skill.duration > 0 ? '待充能' : '瞬发型（暂未支持手动）');

    // v2.2.0：先锋费用回流提示
    let refundHtml = '';
    if (template.class === 'vanguard') {
      if (op.costRefunded) {
        refundHtml = `<div style="margin-top:6px;font-size:12px;color:#2ecc71;">✓ 部署费用已回流 +${Math.round(template.cost * CONFIG.VANGUARD_REFUND_RATE)}</div>`;
      } else {
        const remain = Math.max(0, CONFIG.VANGUARD_REFUND_DELAY - op.deployTime);
        refundHtml = `<div style="margin-top:6px;font-size:12px;color:#bdc3c7;">先锋回流：${remain.toFixed(1)}s 后 +${Math.round(template.cost * CONFIG.VANGUARD_REFUND_RATE)}</div>`;
      }
    }

    // v2.3.0：状态效果列表
    let effectsHtml = '';
    if (op.effects && op.effects.length > 0) {
      effectsHtml = '<div style="margin-top:8px;font-size:12px;color:#bdc3c7;">状态效果：</div>' +
        op.effects.map((e: any) => {
          const sign = e.mod >= 0 ? '+' : '';
          const value = e.modType === 'pct' ? `${sign}${(e.mod * 100).toFixed(0)}%` : `${sign}${e.mod}`;
          const color = e.kind === 'buff' ? '#2ecc71' : '#e67e22';
          const timeText = e.duration < 0 ? '永久' : `剩余 ${e.remaining.toFixed(1)}s`;
          return `<div style="background:rgba(${e.kind === 'buff' ? '46,204,113' : '230,126,34'},0.15);padding:3px 6px;margin:2px 0;border-left:3px solid ${color};font-size:12px;">
            ${e.name}（${e.stat} ${value}） · ${timeText}
          </div>`;
        }).join('');
    }

    spBlockHtml = `
      <div style="margin:8px 0 6px 0;">
        <div style="font-size:12px;color:#bdc3c7;margin-bottom:4px;">SP: ${op.currentSp.toFixed(1)} / ${op.skill.cost} · ${stateLabel}</div>
        <div style="background:#1f2937;height:8px;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${op.skillActive ? '#f1c40f' : '#3498db'};"></div>
        </div>
        ${isReady && engine!.phase === 'COMBAT' ? `<button id="btn-activate-skill" style="margin-top:6px;width:100%;padding:6px;background:#f39c12;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:bold;">释放技能</button>` : ''}
        ${refundHtml}
        ${effectsHtml}
      </div>
    `;
  }

  detailContent.innerHTML = `
    <div class="detail-header">${template.name}</div>
    <div class="detail-sub">${'★'.repeat(template.rarity)} · ${trait.name} · ${template.placement === 'ground' ? '地面' : '高台'} · ${rank === 2 ? '精英Ⅱ' : '精英Ⅰ'}</div>

    <div class="detail-stats">
      <div class="stat-row">生命: ${hp} / ${maxHp}</div>
      <div class="stat-row">攻击: ${template.stats.atk}</div>
      <div class="stat-row">防御: ${template.stats.def}</div>
      <div class="stat-row">阻挡: ${template.stats.blockCount}</div>
      <div class="stat-row">攻速: ${template.stats.aspd}s</div>
      <div class="stat-row">费用: ${template.cost}</div>
      <div class="stat-row">伤害类型: ${(() => {
        const t = template.atkType ?? (template.class === 'caster' ? 'magic' : template.class === 'medic' ? 'heal' : 'physical');
        return t === 'magic' ? '法术' : t === 'true' ? '真伤' : t === 'heal' ? '治疗' : '物理';
      })()}</div>
    </div>

    <div class="skill-section">
      <div style="font-size:12px;color:#7f8c8d;margin-bottom:6px;">职业特性 · ${trait.desc}</div>
      <div style="font-weight:bold;color:#f39c12;margin-bottom:6px;">天赋（${template.talents.length}/2）</div>
      ${talentsHtml}
      <div style="font-weight:bold;color:#3498db;margin:10px 0 6px 0;">技能（携带 ${template.defaultSkillIndex + 1} / ${template.skills.length}）</div>
      <div class="skill-name">${skillInfo.name}</div>
      <div class="skill-desc">${skillInfo.desc}</div>
      <div style="margin-top:5px; font-size:12px; color:#bdc3c7;">
        消耗: ${skillInfo.cost} / 初始: ${skillInfo.initialSp} / 回复: ${skillInfo.spRecovery}
      </div>
      ${spBlockHtml}
    </div>
  `;

  // 绑定释放技能按钮（每次重渲染后重新查找）
  if (selectedType === 'map' && currentData) {
    const btn = document.getElementById('btn-activate-skill') as HTMLButtonElement | null;
    if (btn) {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        engine!.tryActivateSkill(currentData.id);
      };
    }
  }
}

function startDrag(e: MouseEvent, benchUid: string, name: string, color: string): void {
  isDragging = true;
  draggedBenchUid = benchUid;
  isDraggingFromPending = false;
  closeDetailPanel();

  const benchCard = e.currentTarget as HTMLElement;
  if (benchCard) benchCard.classList.add('dragging');

  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.innerHTML = `<div style="font-weight: bold; font-size: 12px;">${name}</div>`;
  dragGhost.style.backgroundColor = color;
  document.body.appendChild(dragGhost);

  updateGhostPosition(e);

  const moveHandler = (ev: MouseEvent | TouchEvent) => {
    let clientX, clientY;
    if (ev instanceof MouseEvent) {
      clientX = ev.clientX; clientY = ev.clientY;
    } else {
      clientX = ev.touches[0].clientX; clientY = ev.touches[0].clientY;
    }
    updateGhostPosition({ clientX, clientY } as any);
  };
  const endHandler = (ev: MouseEvent | TouchEvent) => {
    let clientX, clientY;
    if (ev instanceof MouseEvent) {
      clientX = ev.clientX; clientY = ev.clientY;
    } else {
      clientX = ev.changedTouches[0].clientX; clientY = ev.changedTouches[0].clientY;
    }
    onDragEnd(clientX, clientY);
    document.removeEventListener('mousemove', moveHandler as any);
    document.removeEventListener('mouseup', endHandler as any);
    document.removeEventListener('touchmove', moveHandler as any);
    document.removeEventListener('touchend', endHandler as any);
  };
  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('mouseup', endHandler);
  document.addEventListener('touchmove', moveHandler, { passive: false });
  document.addEventListener('touchend', endHandler);
}

function updateGhostPosition(e: { clientX: number, clientY: number }): void {
  if (dragGhost) {
    dragGhost.style.left = e.clientX + 'px';
    dragGhost.style.top = e.clientY + 'px';
  }
}

function onDragEnd(clientX: number, clientY: number): void {
  if (!isDragging || !engine || !canvas) return;

  if (isDraggingFromPending && pendingDragStartGrid) {
    const rect = canvas.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom) {
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      const gridX = Math.floor(x / CONFIG.TILE_SIZE);
      const gridY = Math.floor(y / CONFIG.TILE_SIZE);

      const dx = gridX - pendingDragStartGrid.x;
      const dy = gridY - pendingDragStartGrid.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        let direction: Direction = 'down';
        if (dx === 1) direction = 'right';
        else if (dx === -1) direction = 'left';
        else if (dy === 1) direction = 'down';
        else if (dy === -1) direction = 'up';
        engine.confirmDeployment(direction);
      }
    }

    isDraggingFromPending = false;
    pendingDragStartGrid = null;
    cleanupDrag();
    return;
  }

  const sellZone = document.querySelector('.sell-zone');
  if (sellZone) {
    const rect = sellZone.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      if (draggedBenchUid) engine.sellBenchOperator(draggedBenchUid);
      cleanupDrag();
      return;
    }
  }

  const rect = canvas.getBoundingClientRect();
  if (clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom) {
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const gridX = Math.floor(x / CONFIG.TILE_SIZE);
    const gridY = Math.floor(y / CONFIG.TILE_SIZE);

    if (draggedBenchUid) engine.tryPlaceOperator(draggedBenchUid, gridX, gridY);
  }

  cleanupDrag();
}

function cleanupDrag(): void {
  isDragging = false;
  draggedBenchUid = null;
  isDraggingFromPending = false;
  pendingDragStartGrid = null;

  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
  document.querySelectorAll('.bench-card.dragging, .shop-card.dragging').forEach(card => {
    card.classList.remove('dragging');
  });
}

// v4.1.0：host 节流广播游戏快照
let lastBroadcastAt = 0;
function hostMaybeBroadcast(): void {
  const now = performance.now();
  if (now - lastBroadcastAt < 120) return;
  lastBroadcastAt = now;
  if (!engine) return;
  try {
    mpAdapter.sendGame(engine.getStateSnapshot());
  } catch {}
}

// v4.1.1：host 直播横幅
function ensureMpHostBanner(): void {
  let banner = document.getElementById('mp-host-banner');
  const visible = isMpHost();
  if (!visible) {
    if (banner) banner.style.display = 'none';
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'mp-host-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#27ae60;color:#fff;padding:6px 12px;font-size:12px;font-family:monospace;text-align:center;z-index:9999;box-shadow:0 2px 4px rgba(0,0,0,0.3);';
    document.body.appendChild(banner);
  }
  const peer = mpAdapter.peers[0]?.name ?? '观战者';
  banner.textContent = `📡 联机直播中 → ${peer}（你的画面会以 ~120ms 间隔同步给对端）`;
  banner.style.display = 'block';
}

// v4.1.0：host 关键事件推送（波次/阶段/血量阈值/胜负）
let lastEvtPhase: 'PREP' | 'COMBAT' | null = null;
let lastEvtWave = -1;
let lastEvtLives = -1;
let endEmitted = false;
function resetHostEventTracker(): void {
  lastEvtPhase = null;
  lastEvtWave = -1;
  lastEvtLives = -1;
  endEmitted = false;
}
function hostMaybeEmitEvents(): void {
  if (!engine) return;
  const snap = engine.getStateSnapshot();
  // 波次开始
  if (snap.waveIndex !== lastEvtWave) {
    if (lastEvtWave >= 0 && snap.waveIndex > lastEvtWave) {
      // v4.3.3：附下一波预告 extra
      const preview = buildWavePreview(snap.waveIndex);
      const previewText = preview ? `（下一波：${preview.label}）` : '';
      mpAdapter.sendEvent('wave', `第 ${snap.waveIndex + 1} 波开始${previewText}`, 'warn', preview);
    }
    lastEvtWave = snap.waveIndex;
  }
  // 阶段切换
  if (snap.phase !== lastEvtPhase) {
    if (lastEvtPhase === 'COMBAT' && snap.phase === 'PREP') {
      mpAdapter.sendEvent('phase', '波次结束 进入备战', 'success');
    }
    lastEvtPhase = snap.phase;
  }
  // 血量低警（只在变低时发，且 ≤3）
  if (lastEvtLives > 0 && snap.lives < lastEvtLives && snap.lives > 0 && snap.lives <= 3) {
    mpAdapter.sendEvent('lives', `生命剩余 ${snap.lives}！`, 'danger');
  }
  lastEvtLives = snap.lives;
  // 失败
  if (!endEmitted && snap.lives <= 0) {
    mpAdapter.sendEvent('end', '基地陷落 失败', 'danger');
    endEmitted = true;
  }
}

// v4.3.3：构造下一波预告 extra
function buildWavePreview(currentIdx: number): { count: number; enemyId: string; enemyName: string; label: string; isBoss: boolean; isFlying: boolean; isStealth: boolean; nextWaveNo: number } | null {
  const nextIdx = currentIdx + 1;
  if (nextIdx >= WAVES.length) return null;
  const w = WAVES[nextIdx];
  const def = ENEMY_DB[w.enemyId];
  if (!def) return null;
  const traits = def.traits || {};
  const isBoss = !!traits.bossPhase;
  const isFlying = !!traits.flying;
  const isStealth = !!traits.stealth;
  const tags: string[] = [];
  if (isBoss) tags.push('Boss');
  if (isFlying) tags.push('飞行');
  if (isStealth) tags.push('隐身');
  const tagStr = tags.length > 0 ? ` [${tags.join('/')}]` : '';
  const label = `${w.count}×${def.name}${tagStr}`;
  return {
    count: w.count,
    enemyId: w.enemyId,
    enemyName: def.name,
    label,
    isBoss,
    isFlying,
    isStealth,
    nextWaveNo: nextIdx + 1,
  };
}

// v4.2.3：host 监听 guest 部署提议
let guestEventListenerInstalled = false;
function installGuestEventListener(): void {
  if (guestEventListenerInstalled) return;
  guestEventListenerInstalled = true;
  mpAdapter.on('event', (msg) => {
    const p = msg.payload as any;
    if (!p) return;
    const from = String(p.from || '观战者');
    const text = String(p.text || '');
    if (p.kind === 'deploy_request') {
      showDeployRequestPrompt(from, text);
      playSfx('event');
      pushMpHostHistory({ icon: '🎯', from, text, ts: performance.now() });
    } else if (p.kind === 'focus_request') {
      const opId = (p.extra && p.extra.operatorId) ? String(p.extra.operatorId) : '';
      showFocusRequestPrompt(from, text, opId);
      playSfx('event');
      pushMpHostHistory({
        icon: '⭐', from, text, ts: performance.now(),
        onClick: opId ? () => {
          const op = engine?.operators.find(o => o.id === opId);
          if (op) selectItem('map', opId);
        } : undefined,
      });
    } else if (p.kind === 'enemy_intel') {
      // v4.3.2：guest 标记敌人 — 在敌人位置叠加标记 + 顶部短暂提示
      const ex = Number((p.extra && p.extra.x) ?? 0);
      const ey = Number((p.extra && p.extra.y) ?? 0);
      pushLocalMarker(ex, ey, from, '⚠敌情');
      showHostBriefBanner(`⚠ ${from} 标记了敌情`);
      playSfx('event');
      pushMpHostHistory({ icon: '⚠', from, text, ts: performance.now() });
    } else if (p.kind === 'intel_response') {
      // v4.3.6：guest 对 wave 预告的快速反馈
      const ack = (p.extra && p.extra.ack) ? String(p.extra.ack) : '';
      const icon = ack === 'help' ? '🆘' : '✅';
      showHostBriefBanner(`${icon} ${from}：${text}`);
      playSfx(ack === 'help' ? 'event' : 'wave_clear');
      pushMpHostHistory({ icon, from, text, ts: performance.now() });
    } else if (p.kind === 'defend_request') {
      // v4.3.8：guest 提议防守点 — 在该点叠加 🛡 防守 marker + 顶部短横幅
      const dx = Number((p.extra && p.extra.x) ?? 0);
      const dy = Number((p.extra && p.extra.y) ?? 0);
      pushLocalMarker(dx, dy, from, '🛡防守');
      showHostBriefBanner(`🛡 ${from} 提议加固防守`);
      playSfx('event');
      pushMpHostHistory({ icon: '🛡', from, text, ts: performance.now() });
    }
  });
  // v4.2.4：host 收到 guest 标记点也响一下
  mpAdapter.on('marker', (msg) => {
    playSfx('click');
    // v4.3.5：marker 也进入提议历史
    const m = msg.payload as any;
    if (!m) return;
    pushMpHostHistory({
      icon: '📍',
      from: String(m.from || '对端'),
      text: m.label ? String(m.label) : `(${Math.round(m.x)},${Math.round(m.y)})`,
      ts: performance.now(),
    });
  });
}

function showFocusRequestPrompt(from: string, text: string, operatorId: string): void {
  const id = 'mp-host-focus-prompt';
  let bar = document.getElementById(id);
  if (bar) bar.remove();
  bar = document.createElement('div');
  bar.id = id;
  bar.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#2c3e50;color:#fff;padding:10px 14px;border-radius:6px;font-family:monospace;font-size:13px;z-index:9999;display:flex;gap:10px;align-items:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:1px solid #8e44ad;';
  bar.innerHTML = `
    <span>⭐ <b>${from}</b>：${text}</span>
    <button id="btn-focus-accept" style="padding:4px 10px;background:#27ae60;border:none;color:#fff;border-radius:3px;cursor:pointer;">查看</button>
    <button id="btn-focus-reject" style="padding:4px 10px;background:#7f8c8d;border:none;color:#fff;border-radius:3px;cursor:pointer;">忽略</button>
  `;
  document.body.appendChild(bar);
  const cleanup = () => bar?.remove();
  document.getElementById('btn-focus-accept')?.addEventListener('click', () => {
    if (operatorId && engine?.operators.find(o => o.id === operatorId)) {
      selectItem('map', operatorId);
      mpAdapter.sendEvent('focus_response', `host 已查看你提议的干员`, 'success');
      playSfx('wave_clear');
    } else {
      mpAdapter.sendEvent('focus_response', `host 未找到该干员（可能已撤离）`, 'info');
      playSfx('click');
    }
    cleanup();
  });
  document.getElementById('btn-focus-reject')?.addEventListener('click', () => {
    mpAdapter.sendEvent('focus_response', `host 忽略了你的提议`, 'info');
    playSfx('click');
    cleanup();
  });
  setTimeout(cleanup, 10000);
}

function showDeployRequestPrompt(from: string, text: string): void {
  // 顶部固定提示条 + 接受/拒绝按钮
  const id = 'mp-host-deploy-prompt';
  let bar = document.getElementById(id);
  if (bar) bar.remove();
  bar = document.createElement('div');
  bar.id = id;
  bar.style.cssText = 'position:fixed;top:36px;left:50%;transform:translateX(-50%);background:#2c3e50;color:#fff;padding:10px 14px;border-radius:6px;font-family:monospace;font-size:13px;z-index:9999;display:flex;gap:10px;align-items:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:1px solid #3498db;';
  bar.innerHTML = `
    <span>📨 <b>${from}</b>：${text}</span>
    <button id="btn-deploy-accept" style="padding:4px 10px;background:#27ae60;border:none;color:#fff;border-radius:3px;cursor:pointer;">接受</button>
    <button id="btn-deploy-reject" style="padding:4px 10px;background:#c0392b;border:none;color:#fff;border-radius:3px;cursor:pointer;">拒绝</button>
  `;
  document.body.appendChild(bar);
  const cleanup = () => bar?.remove();
  document.getElementById('btn-deploy-accept')?.addEventListener('click', () => {
    mpAdapter.sendEvent('deploy_response', `host 接受了你的提议：${text}`, 'success');
    playSfx('wave_clear'); // v4.2.4
    cleanup();
  });
  document.getElementById('btn-deploy-reject')?.addEventListener('click', () => {
    mpAdapter.sendEvent('deploy_response', `host 拒绝了你的提议`, 'info');
    playSfx('click'); // v4.2.4
    cleanup();
  });
  // 10s 自动关闭
  setTimeout(cleanup, 10000);
}

// v4.3.2：host 顶部短暂提示横幅（3s 自动消失）
function showHostBriefBanner(text: string): void {
  const id = 'mp-host-brief-banner';
  let bar = document.getElementById(id);
  if (bar) bar.remove();
  bar = document.createElement('div');
  bar.id = id;
  bar.style.cssText = 'position:fixed;top:36px;right:12px;background:#d35400;color:#fff;padding:8px 14px;border-radius:6px;font-family:monospace;font-size:13px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:opacity 0.3s;opacity:1;';
  bar.textContent = text;
  document.body.appendChild(bar);
  setTimeout(() => { if (bar) bar.style.opacity = '0'; }, 2700);
  setTimeout(() => bar?.remove(), 3000);
}

// v4.3.1：联机时 host 在游戏内显示可折叠聊天面板（右下角 fixed）
// v4.3.4：聊天快捷预设
const CHAT_QUICK_PRESETS = ['好', '不好', '等一下', 'GG', 'GL'];
let mpHostChatInstalled = false;
function ensureMpHostChatPanel(): void {
  if (!isMpHost()) return;
  if (mpHostChatInstalled) {
    const panel = document.getElementById('mp-host-chat');
    if (panel) panel.style.display = 'flex';
    return;
  }
  mpHostChatInstalled = true;
  const wrap = document.createElement('div');
  wrap.id = 'mp-host-chat';
  wrap.style.cssText = 'position:fixed;right:12px;bottom:12px;width:280px;background:rgba(26,29,36,0.95);color:#ecf0f1;border:1px solid #34495e;border-radius:6px;font-family:monospace;font-size:12px;z-index:9998;display:flex;flex-direction:column;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
  wrap.innerHTML = `
    <div id="mp-host-chat-head" style="padding:6px 10px;background:#2c3e50;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-radius:6px 6px 0 0;">
      <span>💬 联机聊天</span>
      <span id="mp-host-chat-toggle" style="font-size:14px;">▾</span>
    </div>
    <div id="mp-host-chat-body" style="display:flex;flex-direction:column;">
      <div id="mp-host-chat-log" style="height:140px;overflow-y:auto;padding:6px 10px;background:#1a1d24;font-size:11px;line-height:1.5;"></div>
      <div id="mp-host-chat-quick" style="display:flex;flex-wrap:wrap;gap:3px;padding:4px 6px;background:#1a1d24;border-top:1px solid #2c3e50;"></div>
      <div style="display:flex;gap:4px;padding:6px;background:#1a1d24;border-radius:0 0 6px 6px;">
        <input id="mp-host-chat-input" type="text" maxlength="200" placeholder="输入消息..." style="flex:1;padding:4px 6px;background:#0e1116;border:1px solid #34495e;color:#ecf0f1;border-radius:3px;font-family:inherit;font-size:11px;" />
        <button id="mp-host-chat-send" style="padding:4px 10px;background:#3498db;border:none;color:#fff;border-radius:3px;cursor:pointer;font-size:11px;">发送</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const log = document.getElementById('mp-host-chat-log')!;
  const input = document.getElementById('mp-host-chat-input') as HTMLInputElement;
  const head = document.getElementById('mp-host-chat-head')!;
  const body = document.getElementById('mp-host-chat-body')!;
  const toggle = document.getElementById('mp-host-chat-toggle')!;
  let collapsed = false;
  head.addEventListener('click', () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? 'none' : 'flex';
    toggle.textContent = collapsed ? '▸' : '▾';
  });

  function appendLog(from: string, text: string, color: string): void {
    const line = document.createElement('div');
    line.innerHTML = `<span style="color:${color};">[${from}]</span> ${text.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c))}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function send(): void {
    const t = input.value.trim();
    if (!t) return;
    mpAdapter.sendChat(t);
    appendLog(mpAdapter.localPeer?.name ?? '我', t, '#3498db');
    input.value = '';
    playSfx('click');
  }
  document.getElementById('mp-host-chat-send')?.addEventListener('click', send);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); send(); }
  });

  // v4.3.4：快捷预设按钮
  const quickWrap = document.getElementById('mp-host-chat-quick');
  if (quickWrap) {
    for (const preset of CHAT_QUICK_PRESETS) {
      const btn = document.createElement('button');
      btn.textContent = preset;
      btn.style.cssText = 'padding:2px 6px;background:#34495e;border:none;color:#ecf0f1;border-radius:3px;cursor:pointer;font-size:10px;font-family:inherit;';
      btn.addEventListener('click', () => {
        mpAdapter.sendChat(preset);
        appendLog(mpAdapter.localPeer?.name ?? '我', preset, '#3498db');
        playSfx('click');
      });
      quickWrap.appendChild(btn);
    }
  }

  mpAdapter.on('chat', (msg) => {
    const p = msg.payload as any;
    if (!p) return;
    const from = String(p.from || '?');
    const text = String(p.text || '');
    if (from === (mpAdapter.localPeer?.name ?? '我')) return; // 自己已本地追加
    appendLog(from, text, '#e67e22');
    playSfx('event');
  });
}

// v4.3.5：联机时 host 在游戏内显示提议历史面板（最近 5 条 marker / deploy / focus / intel）
interface MpHostHistoryItem {
  icon: string;
  from: string;
  text: string;
  ts: number; // performance.now()
  onClick?: () => void;
}
const mpHostHistory: MpHostHistoryItem[] = [];
const MP_HOST_HISTORY_MAX = 5;
let mpHostHistoryInstalled = false;

function escapeHostHistory(s: string): string {
  return s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c));
}

function pushMpHostHistory(item: MpHostHistoryItem): void {
  mpHostHistory.unshift(item);
  if (mpHostHistory.length > MP_HOST_HISTORY_MAX) mpHostHistory.length = MP_HOST_HISTORY_MAX;
  renderMpHostHistory();
}

function renderMpHostHistory(): void {
  const list = document.getElementById('mp-host-history-list');
  if (!list) return;
  if (mpHostHistory.length === 0) {
    list.innerHTML = '<div style="color:#7f8c8d;padding:6px 10px;">暂无提议</div>';
    return;
  }
  const now = performance.now();
  list.innerHTML = '';
  for (let i = 0; i < mpHostHistory.length; i++) {
    const it = mpHostHistory[i];
    const ageSec = Math.max(0, Math.floor((now - it.ts) / 1000));
    const ageStr = ageSec < 60 ? `${ageSec}s前` : `${Math.floor(ageSec / 60)}m前`;
    const row = document.createElement('div');
    row.style.cssText = 'padding:4px 10px;border-bottom:1px solid #2c3e50;font-size:11px;line-height:1.4;' + (it.onClick ? 'cursor:pointer;' : '');
    row.innerHTML = `<span style="margin-right:4px;">${it.icon}</span><span style="color:#3498db;">[${escapeHostHistory(it.from)}]</span> ${escapeHostHistory(it.text)} <span style="color:#7f8c8d;font-size:10px;">· ${ageStr}</span>`;
    if (it.onClick) {
      row.addEventListener('click', () => {
        it.onClick!();
        playSfx('click');
      });
      row.addEventListener('mouseenter', () => { row.style.background = '#2c3e50'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
    }
    list.appendChild(row);
  }
}

function ensureMpHostHistoryPanel(): void {
  if (!isMpHost()) return;
  if (mpHostHistoryInstalled) {
    const panel = document.getElementById('mp-host-history');
    if (panel) panel.style.display = 'flex';
    return;
  }
  mpHostHistoryInstalled = true;
  // 清空（同一会话不同 run 复用）
  mpHostHistory.length = 0;

  const wrap = document.createElement('div');
  wrap.id = 'mp-host-history';
  wrap.style.cssText = 'position:fixed;right:12px;top:130px;width:280px;background:rgba(26,29,36,0.95);color:#ecf0f1;border:1px solid #34495e;border-radius:6px;font-family:monospace;font-size:12px;z-index:9997;display:flex;flex-direction:column;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
  wrap.innerHTML = `
    <div id="mp-host-history-head" style="padding:6px 10px;background:#2c3e50;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-radius:6px 6px 0 0;">
      <span>📜 提议历史 (近 5)</span>
      <span id="mp-host-history-toggle" style="font-size:14px;">▾</span>
    </div>
    <div id="mp-host-history-body" style="display:flex;flex-direction:column;">
      <div id="mp-host-history-list" style="max-height:160px;overflow-y:auto;background:#1a1d24;border-radius:0 0 6px 6px;"></div>
    </div>
  `;
  document.body.appendChild(wrap);

  const head = document.getElementById('mp-host-history-head')!;
  const body = document.getElementById('mp-host-history-body')!;
  const toggle = document.getElementById('mp-host-history-toggle')!;
  let collapsed = false;
  head.addEventListener('click', () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? 'none' : 'flex';
    toggle.textContent = collapsed ? '▸' : '▾';
  });

  renderMpHostHistory();
  // 每 5s 刷新一次时间显示
  setInterval(() => {
    if (mpHostHistory.length > 0) renderMpHostHistory();
  }, 5000);
}
