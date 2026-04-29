import { GameEngine } from './core/GameEngine';
import { Renderer } from './view/Renderer';
import { CONFIG, OPERATOR_DB, selectRandomMap } from './config/gameData';
import { Direction } from './types';

// 开始界面控制（延迟获取，确保DOM已加载）
let startScreen: HTMLElement;
let appRoot: HTMLElement;
let btnStartGame: HTMLElement;

// 游戏变量（延迟初始化）
let canvas: HTMLCanvasElement | null = null;
let engine: GameEngine | null = null;
let renderer: Renderer | null = null;

// UI 元素（延迟获取）
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

// 交互状态
let selectedType: 'shop' | 'bench' | 'map' | null = null;
let selectedId: string | null = null;
let isDragging = false;
let draggedBenchUid: string | null = null;
let dragGhost: HTMLElement | null = null;
let lastTime = 0;
let mouseGridPos: { x: number, y: number } | null = null; // 鼠标当前所在的格子位置（用于预览朝向）
let isDraggingFromPending: boolean = false; // 是否正在从待部署角色拖动设置朝向
let pendingDragStartGrid: { x: number, y: number } | null = null; // 待部署拖动的起始格子

// 初始化游戏
function initGame() {
  // 获取UI元素
  canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  uiWave = document.getElementById('wave-display')!;
  uiLives = document.getElementById('lives-display')!;
  uiMoney = document.getElementById('money-display')!;
  uiCore = document.getElementById('core-display'); // 可选，因为新布局中已移除
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

  // 随机选择地图
  selectRandomMap();

  // 初始化引擎和渲染器
  engine = new GameEngine();
  renderer = new Renderer(canvas);

  // 设置事件监听
  engine.onStateUpdated = () => {
    renderUI();
  };

  // 初始化UI
  renderUI();
  
  // 启动游戏循环
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);

  // 绑定按钮事件
  document.getElementById('btn-next-wave')?.addEventListener('click', () => engine!.tryStartCombat());
  document.getElementById('btn-refresh')?.addEventListener('click', () => engine!.refreshShop());
  document.getElementById('btn-upgrade')?.addEventListener('click', () => engine!.upgradeCore());

  // 移动端适配（延迟执行以确保DOM完全加载）
  setTimeout(() => {
    handleResize();
    if (renderer) {
      renderer.resize();
    }
  }, 100);
  
  window.addEventListener('resize', () => {
    handleResize();
    // 移动端需要重新调整Canvas大小
    if (renderer && isMobileDevice()) {
      setTimeout(() => {
        if (renderer) renderer.resize();
      }, 50);
    }
  });
  
  // 监听方向变化（移动端）
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      handleResize();
      if (renderer) {
        renderer.resize();
      }
    }, 200);
  });

  // 初始化交互事件
  initInteractionEvents();
  
  // 隐藏开始界面，显示游戏界面
  if (startScreen) startScreen.style.display = 'none';
  if (appRoot) {
    appRoot.style.display = 'flex';
    // flexDirection由CSS和handleResize控制，不在这里硬编码
  }
}

// 检测是否为移动设备
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
}

// 计算布局尺寸 - 最优先保证top-bar和bottom-area完全显示
function calculateLayout() {
  if (!appRoot) return;
  
  const topBar = document.getElementById('top-bar');
  const bottomArea = document.getElementById('bottom-area');
  
  if (!topBar || !bottomArea) return;
  
  // 先重置transform，获取真实高度（包括内容扩展后的高度）
  appRoot.style.transform = 'none';
  appRoot.style.width = '100%';
  appRoot.style.height = '100%';
  
  // 使用requestAnimationFrame确保DOM已更新
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!topBar || !bottomArea) return;
      
      // 获取top-bar和bottom-area的实际高度（包括内容扩展后的高度）
      const topBarHeight = topBar.offsetHeight || 50;
      const bottomAreaHeight = bottomArea.offsetHeight || 220;
      
      // 计算可用高度（用于地图区域）
      const availableHeight = window.innerHeight - topBarHeight - bottomAreaHeight;
      
      // 地图最小高度要求
      const minMapHeight = 400;
      
      // 计算缩放比例：优先保证top-bar和bottom-area完全显示
      let scale = 1;
      if (availableHeight < minMapHeight) {
        // 需要缩放：确保top-bar和bottom-area完全显示
        const totalRequiredHeight = topBarHeight + bottomAreaHeight + minMapHeight;
        scale = window.innerHeight / totalRequiredHeight;
      }
      
      // 应用缩放（等比例缩放整个app-root）
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

// 移动端适配逻辑
function handleResize() {
  const overlay = document.getElementById('mobile-overlay')!;
  const isMobile = isMobileDevice();

  // 1. 移动端：只旋转90度，不改变布局结构
  if (document.documentElement) {
    if (isMobile) {
      // 移动设备：旋转整个HTML元素90度
      document.documentElement.classList.add('mobile-rotated');
      overlay.style.display = 'none';
    } else {
      // 桌面设备：正常显示
      document.documentElement.classList.remove('mobile-rotated');
      overlay.style.display = 'none';
    }
  }

  // 2. 计算布局（桌面端和移动端都使用）
  // 优先保证top-bar和bottom-area完全显示
  if (appRoot && appRoot.style.display !== 'none') {
    // 延迟执行，确保DOM已更新，特别是商店内容已渲染
    setTimeout(() => {
      calculateLayout();
    }, 100);
  }
}

// === 渲染循环 ===
function renderUI() {
  if (!engine) return;
  
  uiWave.innerText = (engine.waveIndex + 1).toString();
  uiLives.innerText = engine.lives.toString();
  uiMoney.innerText = Math.floor(engine.money).toString();
  // 等级显示已移除，如果元素存在则更新
  if (uiCore) {
    uiCore.innerText = engine.coreLevel.toString();
  }

  // 战斗阶段隐藏底部，锁定操作，显示倒计时
  if (engine.phase === 'COMBAT') {
    bottomArea.classList.add('hidden');
    uiTimerBox.style.display = 'block';
    uiTimer.innerText = Math.ceil(engine.combatTimeRemaining).toString();
    // 如果正在选商店物品或备战区，关掉面板
    if (selectedType === 'shop' || selectedType === 'bench') {
      closeDetailPanel();
    }
  } else {
    bottomArea.classList.remove('hidden');
    uiTimerBox.style.display = 'none';
  }

  renderShop();
  renderBench();
  updateDetailPanel();
  
  // 更新核心升级按钮文案
  const upgradeCost = engine.coreLevel * 10;
  if (engine.coreLevel >= 5) {
    txtUpgradeCost.innerText = "MAX";
    btnUpgrade.disabled = true;
  } else {
    txtUpgradeCost.innerText = `资金 ${upgradeCost}`;
    btnUpgrade.disabled = false;
  }
  
  // 商店内容更新后，重新计算布局（确保商店完全显示）
  setTimeout(() => {
    calculateLayout();
  }, 50);
}

function gameLoop(timestamp: number) {
  if (!engine || !renderer) return;
  
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  engine.update(dt);
  
  let highlightTemplateId: string | null = null;
  if (isDragging && draggedBenchUid) {
    const benchOp = engine.bench.find(b => b.uid === draggedBenchUid);
    if (benchOp) highlightTemplateId = benchOp.templateId;
  } 
  else if (selectedType === 'shop' && selectedId) {
    const item = engine.shopItems.find(i => i.uid === selectedId);
    if (item) highlightTemplateId = item.templateId;
  }
  else if (selectedType === 'bench' && selectedId) {
    const benchOp = engine.bench.find(b => b.uid === selectedId);
    if (benchOp) highlightTemplateId = benchOp.templateId;
  }

  // 计算当前拖拽的朝向（用于预览攻击范围）
  let previewDirection: Direction | null = null;
  
  // 如果有待部署的角色，根据鼠标位置计算朝向预览
  if (engine.pendingDeployment && mouseGridPos) {
    const pending = engine.pendingDeployment;
    const dx = mouseGridPos.x - pending.gridX;
    const dy = mouseGridPos.y - pending.gridY;
    
    // 根据鼠标相对位置计算朝向
    if (Math.abs(dx) > Math.abs(dy)) {
      previewDirection = dx > 0 ? 'right' : 'left';
    } else if (dy !== 0) {
      previewDirection = dy > 0 ? 'down' : 'up';
    } else {
      previewDirection = 'down'; // 默认向下
    }
  }
  
  renderer.render(engine, highlightTemplateId, previewDirection);
  requestAnimationFrame(gameLoop);
}

// === 交互事件 ===

function initInteractionEvents() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // 如果点击的是开始界面，不处理
    if (target && target.closest('#start-screen')) {
      return;
    }
    
    // 如果游戏未初始化，不处理
    if (!engine) {
      return;
    }
    
    // 点击穿透：点击UI空白处（包括详情面板右侧空白）取消选中
    const isClickingUI = target && (
      target.closest('#detail-panel') ||
      target.closest('button') ||
      target.closest('#top-bar') ||
      target.closest('#bottom-area') ||
      target.closest('.shop-card') ||
      target.closest('.bench-card')
    );
    
    // 如果点击的是地图区域或UI空白处，取消选中
    if (!isClickingUI || target.id === 'game-canvas') {
      closeDetailPanel();
      // 点击外部取消待部署
      if (engine && engine.pendingDeployment) {
        engine.cancelPendingDeployment();
      }
    }
  });

  // 鼠标移动事件：更新鼠标位置用于预览朝向
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

  // 处理从待部署角色开始拖动设置朝向
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

    // 检查是否点击在待部署角色的格子上
    const pending = engine.pendingDeployment;
    if (gridX === pending.gridX && gridY === pending.gridY) {
      // 开始从待部署位置拖动
      isDraggingFromPending = true;
      pendingDragStartGrid = { x: gridX, y: gridY };
      isDragging = true;
      
      // 创建拖动视觉反馈
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
    
    // 如果正在拖动，不处理点击
    if (isDragging) return;
    
    const rect = canvas!.getBoundingClientRect();
    const scaleX = canvas!.width / rect.width;
    const scaleY = canvas!.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const gridX = Math.floor(x / CONFIG.TILE_SIZE);
    const gridY = Math.floor(y / CONFIG.TILE_SIZE);

    // 如果有待部署的角色，点击其他地方取消部署
    if (engine.pendingDeployment) {
      const pending = engine.pendingDeployment;
      if (gridX !== pending.gridX || gridY !== pending.gridY) {
        engine.cancelPendingDeployment();
      }
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

function renderShop() {
  if (!engine) return;
  
  shopContainer.innerHTML = '';
  
  // 如果在临时商店，显示临时商店物品
  const itemsToRender = engine.isInTemporaryShop ? engine.temporaryShopItems : engine.shopItems;
  
  itemsToRender.forEach(item => {
    const template = OPERATOR_DB[item.templateId];
    const div = document.createElement('div');
    div.className = `shop-card ${item.bought ? 'bought' : ''} ${selectedType === 'shop' && selectedId === item.uid ? 'selected' : ''}`;
    if (engine!.isInTemporaryShop) {
      div.style.border = '3px solid #f1c40f'; // 临时商店特殊标记
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
  
  // 如果是在临时商店，显示提示
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

function renderBench() {
  if (!engine) return;
  
  benchContainer.innerHTML = '';
  
  // 渲染备战槽位 (Max - 1)
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
        // 只有准备阶段能拖拽
        if (engine!.phase === 'PREP') {
          startDrag(e, benchOp.uid, template.name, template.color);
        }
      };

      // 移动端触摸支持
      card.ontouchstart = (e) => {
        e.stopPropagation();
        if (engine!.phase === 'PREP') {
          const touch = e.touches[0];
          startDrag({ clientX: touch.clientX, clientY: touch.clientY } as any, benchOp.uid, template.name, template.color);
        }
      };

      slot.appendChild(card);
    } else {
      slot.innerText = "空置";
    }
    benchContainer.appendChild(slot);
  }

  // 渲染回收站槽位
  const sellSlot = document.createElement('div');
  sellSlot.className = 'bench-slot sell-zone';
  sellSlot.innerText = "出售";
  benchContainer.appendChild(sellSlot);
}

// === 详情面板 ===

function selectItem(type: 'shop' | 'bench' | 'map', id: string) {
  selectedType = type;
  selectedId = id;
  updateDetailPanel();
  detailPanel.classList.add('visible');
}

function closeDetailPanel() {
  selectedType = null;
  selectedId = null;
  detailPanel.classList.remove('visible');
}

function updateDetailPanel() {
  if (!engine || !selectedType || !selectedId) return;

  let template: any = null;
  let currentData: any = null;
  
  // 重置按钮样式
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
  } 
  else if (selectedType === 'bench') {
    const benchOp = engine.bench.find(b => b.uid === selectedId);
    if (!benchOp) { closeDetailPanel(); return; }
    template = OPERATOR_DB[benchOp.templateId];
    // 备战区角色详情不显示操作按钮，只能拖拽或出售
    btnActionMain.style.display = 'none';
  }
  else if (selectedType === 'map') {
    const op = engine.operators.find(o => o.id === selectedId);
    if (!op) { closeDetailPanel(); return; }
    template = OPERATOR_DB[op.templateId];
    currentData = op;
    
    // 撤回逻辑：只在准备阶段可以撤回
    btnActionMain.innerText = "撤回 (Recall)";
    btnActionMain.className = 'recall';
    btnActionMain.disabled = engine.phase !== 'PREP';
    btnActionMain.onclick = () => {
      if (engine!.phase === 'PREP' && engine!.recallOperator(op.id)) closeDetailPanel();
    };
  }

  const hp = currentData ? Math.floor(currentData.stats.hp) : template.stats.hp;
  const maxHp = template.stats.maxHp;

  detailContent.innerHTML = `
    <div class="detail-header">${template.name}</div>
    <div class="detail-sub">${'★'.repeat(template.rarity)} / ${template.placement === 'ground' ? '地面' : '高台'}</div>
    
    <div class="detail-stats">
      <div class="stat-row">生命: ${hp} / ${maxHp}</div>
      <div class="stat-row">攻击: ${template.stats.atk}</div>
      <div class="stat-row">防御: ${template.stats.def}</div>
      <div class="stat-row">阻挡: ${template.stats.blockCount}</div>
      <div class="stat-row">攻速: ${template.stats.aspd}s</div>
      <div class="stat-row">费用: ${template.cost}</div>
    </div>

    <div class="skill-section">
      <div class="skill-name">技能: ${template.skill.name}</div>
      <div class="skill-desc">${template.skill.desc}</div>
      <div style="margin-top:5px; font-size:12px; color:#bdc3c7;">
        消耗: ${template.skill.cost} / 初始: ${template.skill.initialSp}
      </div>
    </div>
  `;
}

// === 拖拽系统 ===

function startDrag(e: MouseEvent, benchUid: string, name: string, color: string) {
  isDragging = true;
  draggedBenchUid = benchUid;
  isDraggingFromPending = false;
  closeDetailPanel();

  // 原卡片变暗
  const benchCard = e.currentTarget as HTMLElement;
  benchCard.classList.add('dragging');

  // 创建全息投影效果
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

function updateGhostPosition(e: { clientX: number, clientY: number }) {
  if (dragGhost) {
    dragGhost.style.left = e.clientX + 'px';
    dragGhost.style.top = e.clientY + 'px';
  }
}

function onDragEnd(clientX: number, clientY: number) {
  if (!isDragging || !engine || !canvas) return;

  // 如果是待部署状态下的拖动（设置朝向）
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

      // 计算拖动方向
      const dx = gridX - pendingDragStartGrid.x;
      const dy = gridY - pendingDragStartGrid.y;

      // 只处理四个方向的拖动
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

  // 1. 检查是否拖到了出售区
  const sellZone = document.querySelector('.sell-zone');
  if (sellZone) {
    const rect = sellZone.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        if (draggedBenchUid) engine.sellBenchOperator(draggedBenchUid);
        cleanupDrag();
        return;
    }
  }
  
  // 2. 检查是否拖到了 Canvas
  const rect = canvas.getBoundingClientRect();
  if (clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom) {
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const gridX = Math.floor(x / CONFIG.TILE_SIZE);
    const gridY = Math.floor(y / CONFIG.TILE_SIZE);

    if (draggedBenchUid) {
      // 第一步：放置角色到格子（进入待部署状态）
      engine.tryPlaceOperator(draggedBenchUid, gridX, gridY);
    }
  }

  cleanupDrag();
}

function cleanupDrag() {
  isDragging = false;
  draggedBenchUid = null;
  isDraggingFromPending = false;
  pendingDragStartGrid = null;
  
  // 移除拖拽效果
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
  
  // 恢复所有卡片正常显示
  document.querySelectorAll('.bench-card.dragging, .shop-card.dragging').forEach(card => {
    card.classList.remove('dragging');
  });
}

// 初始化：等待DOM加载后绑定开始按钮事件
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStartScreen);
} else {
  initStartScreen();
}

function initStartScreen() {
  startScreen = document.getElementById('start-screen')!;
  appRoot = document.getElementById('app-root')!;
  btnStartGame = document.getElementById('btn-start-game')!;
  
  if (!startScreen || !appRoot || !btnStartGame) {
    console.error('无法找到必要的DOM元素');
    return;
  }
  
  btnStartGame.addEventListener('click', () => {
    initGame();
  });
}
