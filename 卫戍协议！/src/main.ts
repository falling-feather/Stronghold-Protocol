import { GameEngine } from './core/GameEngine';
import { Renderer } from './view/Renderer';
import { CONFIG, OPERATOR_DB } from './config/gameData';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const engine = new GameEngine();
const renderer = new Renderer(canvas);

// UI DOM Elements
const uiWave = document.getElementById('wave-display')!;
const uiLives = document.getElementById('lives-display')!;
const uiMoney = document.getElementById('money-display')!;
const uiCore = document.getElementById('core-display')!;
const shopContainer = document.getElementById('shop-cards')!;
const btnUpgrade = document.getElementById('btn-upgrade')!;

// --- Event Listeners ---

// 开始战斗按钮
document.getElementById('btn-next-wave')?.addEventListener('click', () => {
  if(engine.tryStartCombat()) {
    renderShopUI(); // 战斗开始，更新商店（变灰/不可用提示）
  }
});

// 刷新商店按钮
document.getElementById('btn-refresh')?.addEventListener('click', () => {
  engine.refreshShop();
  renderShopUI();
});

// 升级核心按钮
document.getElementById('btn-upgrade')?.addEventListener('click', () => {
  engine.upgradeCore();
  renderShopUI();
});

// 点击画布部署单位
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const gridX = Math.floor(x / CONFIG.TILE_SIZE);
  const gridY = Math.floor(y / CONFIG.TILE_SIZE);

  if (engine.tryPlaceOperator(gridX, gridY)) {
    renderShopUI(); // 购买成功后，刷新商店（标记为已购买）
  }
});

// --- UI Rendering ---

function renderShopUI() {
  shopContainer.innerHTML = '';
  
  // 更新升级按钮文字
  const upgradeCost = engine.coreLevel * 10;
  if (engine.coreLevel >= 5) {
    btnUpgrade.innerText = 'MAX LEVEL';
    btnUpgrade.style.opacity = '0.5';
  } else {
    btnUpgrade.innerText = `Upgrade Core ($${upgradeCost})`;
    btnUpgrade.style.opacity = '1';
  }
  
  // 战斗中不显示商店内容
  if (engine.phase === 'COMBAT') {
    shopContainer.innerHTML = '<div style="color:#95a5a6; margin:auto; font-style:italic;">⚠️ 作战进行中... 商店已关闭</div>';
    return;
  }

  // 渲染卡片
  engine.shopItems.forEach(item => {
    const template = OPERATOR_DB[item.templateId as keyof typeof OPERATOR_DB];
    const div = document.createElement('div');
    
    // 动态添加样式类
    div.className = `shop-card ${item.bought ? 'bought' : ''} ${engine.selectedShopItemId === item.uid ? 'selected' : ''}`;
    
    // 星星显示
    const stars = '★'.repeat(template.rarity);
    const rarityColor = getRarityColor(template.rarity);

    div.innerHTML = `
      <div class="card-header" style="background:${template.color}"></div>
      <div class="card-name">${template.name}</div>
      <div class="card-rarity" style="color:${rarityColor}">${stars}</div>
      <div class="card-stats">
        ${template.placement === 'ground' ? '地面' : '高台'}<br>
        <span style="color:#2c3e50">挡${template.stats.blockCount}</span> / 攻${template.stats.atk}
      </div>
      <div class="card-cost">$${item.cost}</div>
    `;

    div.onclick = () => {
      if (!item.bought) {
        engine.selectShopItem(item.uid);
        renderShopUI(); // 重新渲染以显示高亮框
      }
    };
    
    shopContainer.appendChild(div);
  });
}

// 辅助函数：根据稀有度返回颜色
function getRarityColor(r: number) {
  switch(r) {
    case 5: return '#f1c40f'; // 金
    case 4: return '#9b59b6'; // 紫
    case 3: return '#3498db'; // 蓝
    case 2: return '#95a5a6'; // 白
    default: return '#7f8c8d';
  }
}

// --- Game Loop ---

let lastTime = 0;
function gameLoop(timestamp: number) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  engine.update(dt);
  renderer.render(engine);
  
  // 更新顶部数据栏
  uiWave.innerText = (engine.waveIndex + 1).toString();
  uiLives.innerText = engine.lives.toString();
  uiMoney.innerText = Math.floor(engine.money).toString();
  uiCore.innerText = engine.coreLevel.toString();

  requestAnimationFrame(gameLoop);
}

// 初始化
renderShopUI();
requestAnimationFrame(gameLoop);