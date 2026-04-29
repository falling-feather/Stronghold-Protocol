// 游戏对局屏幕：包含初始化、UI 渲染循环、交互事件、详情面板、拖拽（v1.5.x）
import { GameEngine } from '../core/GameEngine';
import { Renderer } from '../view/Renderer';
import { CONFIG, OPERATOR_DB, selectRandomMap, validateMaps, resolveSkillForRank, CLASS_TRAITS, PACT_DB } from '../config/gameData';
import { FactionId } from '../config/factions';
import { Roster, rosterToAllowedSet } from '../config/roster';
import { Direction } from '../types';
import { showOnly } from './shared';

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

export function startGame(factionId: FactionId, roster: Roster): void {
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
  engine = new GameEngine(factionId, allowed);
  renderer = new Renderer(canvas);
  // v2.3.0：开发期暴露 engine，便于 devtools 中验证 buff 框架（如：engine.applyEffectToOperator('op_xxx', {id:'t',name:'测试',kind:'buff',stat:'atk',mod:0.5,modType:'pct',duration:10,remaining:10})）
  (window as any).engine = engine;

  engine.onStateUpdated = () => renderUI();

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
    window.addEventListener('resize', () => {
      handleResize();
      if (renderer && isMobileDevice()) {
        setTimeout(() => { if (renderer) renderer.resize(); }, 50);
      }
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        handleResize();
        if (renderer) renderer.resize();
      }, 200);
    });
    resizeListenersBound = true;
  }

  if (!interactionEventsBound) {
    initInteractionEvents();
    interactionEventsBound = true;
  }
}

function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
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
  const overlay = document.getElementById('mobile-overlay')!;
  const isMobile = isMobileDevice();

  if (document.documentElement) {
    if (isMobile) {
      document.documentElement.classList.add('mobile-rotated');
      overlay.style.display = 'none';
    } else {
      document.documentElement.classList.remove('mobile-rotated');
      overlay.style.display = 'none';
    }
  }

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

// v3.0.0：盟约徽记渲染
function renderPactBadges(): void {
  const container = document.getElementById('pact-badges');
  if (!container || !engine) return;
  if (engine.pacts.length === 0) {
    container.innerHTML = '';
    return;
  }
  const tierColors = ['#7f8c8d', '#3498db', '#9b59b6', '#f1c40f'];
  container.innerHTML = engine.pacts.map(rt => {
    const def = PACT_DB[rt.defId];
    if (!def) return '';
    const tierIdx = rt.appliedTier; // -1 表示未达阈值
    const colorIdx = Math.max(0, tierIdx + 1);
    const color = tierColors[Math.min(colorIdx, tierColors.length - 1)];
    const nextTier = def.tiers[tierIdx + 1];
    const tierDesc = tierIdx >= 0 ? def.tiers[tierIdx].description : '未激活';
    const nextDesc = nextTier ? `\n下一档 @ ${nextTier.threshold}：${nextTier.description}` : '\n已达最高档';
    const title = `${def.name}（${rt.stack}/${def.cap}）\n${def.desc}\n当前：${tierDesc}${nextDesc}`;
    return `<div class="pact-badge" title="${title.replace(/"/g, '&quot;')}" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:bold;margin-left:6px;border:2px solid rgba(255,255,255,0.4);">${rt.stack}</div>`;
  }).join('');
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
