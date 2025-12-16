import { CONFIG, MAP_LAYOUT, PATH_WAYPOINTS, ENEMY_DB, OPERATOR_DB, WAVES, RARITY_RATES } from '../config/gameData';
import { Enemy, Operator, Projectile, GamePhase, ShopItem, PlacementType } from '../types';
import { getDistance, moveTowards, checkCollision } from './MathUtils';

export class GameEngine {
  enemies: Enemy[] = [];
  operators: Operator[] = [];
  projectiles: Projectile[] = [];
  
  phase: GamePhase = 'PREP';
  money: number = CONFIG.BASE_MONEY;
  lives: number = CONFIG.BASE_LIVES;
  waveIndex: number = 0;
  coreLevel: number = 1;
  
  shopItems: ShopItem[] = [];
  selectedShopItemId: string | null = null;

  private enemiesToSpawn: number = 0;
  private spawnTimer: number = 0;
  private spawnInterval: number = 0;
  private currentEnemyId: string = '';
  private currentWaveReward: number = 0;

  constructor() {
    this.refreshShop(true);
  }

  // === 核心循环 (Fix Applied) ===
  update(dt: number) {
    // 1. 逻辑更新
    if (this.phase === 'COMBAT') {
      this.handleSpawning(dt);
      this.updateBlocking();
      this.updateEnemies(dt);
      this.updateOperators(dt);
      this.updateProjectiles(dt);
    }
    
    // 2. 清理 (必须在检查结束前执行！)
    this.cleanup();

    // 3. 检查胜利条件
    if (this.phase === 'COMBAT') {
      this.checkCombatEnd();
    }
  }

  // === 流程控制 ===
  tryStartCombat(): boolean {
    if (this.phase === 'COMBAT') return false;

    // 金币燃烧警告
    if (this.money > 0) {
      const confirmBurn = window.confirm(`还有 $${this.money} 未花费。\n根据卫戍协议，战斗开始将回收所有剩余资金！\n确认开始？`);
      if (!confirmBurn) return false;
    }

    if (this.waveIndex < WAVES.length) {
      const waveConfig = WAVES[this.waveIndex];
      this.enemiesToSpawn = waveConfig.count;
      this.spawnInterval = waveConfig.interval;
      this.currentEnemyId = waveConfig.enemyId;
      this.currentWaveReward = waveConfig.reward;
      
      this.money = 0; // Burn logic
      this.phase = 'COMBAT';
      this.selectedShopItemId = null;
      return true;
    } else {
      alert("全域威胁已清除 (通关)！");
      return false;
    }
  }

  private checkCombatEnd() {
    // 触发条件：战斗中 + 没怪要刷了 + 场上没怪了
    if (this.phase === 'COMBAT' && this.enemiesToSpawn <= 0 && this.enemies.length === 0) {
      this.endCombat();
    }
  }

  private endCombat() {
    this.phase = 'PREP';
    this.waveIndex++;
    this.money += this.currentWaveReward;
    
    // 使用 setTimeout 让 alert 稍微延后，避免卡画面
    setTimeout(() => {
        alert(`=== 第 ${this.waveIndex} 波次完成 ===\n获得补给: $${this.currentWaveReward}`);
        this.refreshShop(true);
    }, 100);
  }

  // === 商店逻辑 ===
  refreshShop(forceFree: boolean = false) {
    const cost = 2;
    if (!forceFree) {
      if (this.phase !== 'PREP') return;
      if (this.money < cost) return;
      this.money -= cost;
    }

    this.shopItems = [];
    const shopSize = 3 + (this.coreLevel >= 3 ? 1 : 0) + (this.coreLevel >= 5 ? 1 : 0);

    for (let i = 0; i < shopSize; i++) {
      const templateId = this.rollForOperator();
      const template = OPERATOR_DB[templateId as keyof typeof OPERATOR_DB];
      
      this.shopItems.push({
        uid: `shop_${Date.now()}_${i}`,
        templateId: templateId,
        cost: template.cost,
        bought: false
      });
    }
  }

  private rollForOperator(): string {
    const levelIndex = Math.min(this.coreLevel - 1, RARITY_RATES.length - 1);
    const rates = RARITY_RATES[levelIndex];
    const roll = Math.random();
    
    let cumulative = 0;
    let targetRarity = 1;
    for (let i = 0; i < rates.length; i++) {
      cumulative += rates[i];
      if (roll <= cumulative) {
        targetRarity = i + 1;
        break;
      }
    }

    const candidates = Object.entries(OPERATOR_DB)
      .filter(([_, op]) => op.rarity === targetRarity)
      .map(([id, _]) => id);

    if (candidates.length === 0) {
        // Fallback
        const allKeys = Object.keys(OPERATOR_DB);
        return allKeys[Math.floor(Math.random() * allKeys.length)];
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  upgradeCore() {
    const upgradeCost = this.coreLevel * 10;
    if (this.money >= upgradeCost && this.coreLevel < 5) {
      this.money -= upgradeCost;
      this.coreLevel++;
      this.refreshShop(true); // 升级后免费刷新
    }
  }

  selectShopItem(uid: string) {
    if (this.phase !== 'PREP') return;
    const item = this.shopItems.find(i => i.uid === uid);
    if (item && !item.bought && this.money >= item.cost) {
      this.selectedShopItemId = uid;
    }
  }

  tryPlaceOperator(gridX: number, gridY: number): boolean {
    if (this.phase !== 'PREP' || !this.selectedShopItemId) return false;
    
    // Bounds check
    if (gridX < 0 || gridX >= CONFIG.MAP_WIDTH || gridY < 0 || gridY >= CONFIG.MAP_HEIGHT) return false;
    // Occupied check
    if (this.operators.some(op => op.gridPos.x === gridX && op.gridPos.y === gridY)) return false;

    const shopItem = this.shopItems.find(i => i.uid === this.selectedShopItemId);
    if (!shopItem) return false;
    const template = OPERATOR_DB[shopItem.templateId as keyof typeof OPERATOR_DB];

    // Terrain check
    const tileType = MAP_LAYOUT[gridY][gridX];
    if (template.placement === 'high_ground' && tileType !== 1) return false;
    if (template.placement === 'ground' && tileType !== 0) return false;

    // Place
    this.money -= shopItem.cost;
    shopItem.bought = true;
    this.selectedShopItemId = null;

    this.operators.push({
      id: `op_${Date.now()}`,
      pos: { x: gridX * CONFIG.TILE_SIZE, y: gridY * CONFIG.TILE_SIZE },
      gridPos: { x: gridX, y: gridY },
      radius: CONFIG.TILE_SIZE,
      color: template.color,
      stats: { ...template.stats },
      name: template.name,
      cooldown: 0,
      targetId: null,
      cost: template.cost,
      placement: template.placement,
      rarity: template.rarity,
      markedForDeletion: false,
      blockingEnemyIds: []
    });
    return true;
  }

  // === 战斗系统 ===

  private updateBlocking() {
    this.enemies.forEach(enemy => {
      // 1. 已被阻挡
      if (enemy.isBlockedBy) {
        const blocker = this.operators.find(op => op.id === enemy.isBlockedBy);
        if (!blocker || blocker.markedForDeletion) {
          enemy.isBlockedBy = null; // 解除阻挡
        }
        return; 
      }

      // 2. 未被阻挡，检测碰撞
      const validBlockers = this.operators.filter(op => 
        op.placement === 'ground' &&
        op.blockingEnemyIds.length < op.stats.blockCount &&
        checkCollision(enemy.pos, enemy.radius, op.pos, CONFIG.TILE_SIZE)
      );

      if (validBlockers.length > 0) {
        const blocker = validBlockers[0];
        blocker.blockingEnemyIds.push(enemy.id);
        enemy.isBlockedBy = blocker.id;
      }
    });
  }

  private handleSpawning(dt: number) {
    if (this.enemiesToSpawn > 0) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnEnemy();
        this.spawnTimer = 0;
        this.enemiesToSpawn--; // Decrement inventory
      }
    }
  }

  private spawnEnemy() {
    const template = ENEMY_DB[this.currentEnemyId as keyof typeof ENEMY_DB];
    const startNode = PATH_WAYPOINTS[0];
    this.enemies.push({
      id: `en_${Date.now()}`,
      pos: { 
        x: startNode.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2, 
        y: startNode.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2 
      },
      gridPos: { x: startNode.x, y: startNode.y },
      radius: template.radius,
      color: template.color,
      stats: { ...template.stats },
      waypointIndex: 0,
      bounty: 0,
      markedForDeletion: false,
      isBlockedBy: null
    });
  }

  private updateEnemies(dt: number) {
    this.enemies.forEach(enemy => {
      if (enemy.isBlockedBy) return; // Blocked = No Move

      const targetGrid = PATH_WAYPOINTS[enemy.waypointIndex + 1];
      if (!targetGrid) {
        this.lives -= 1;
        enemy.markedForDeletion = true;
        return;
      }

      const targetWorld = {
        x: targetGrid.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
        y: targetGrid.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2
      };

      enemy.pos = moveTowards(enemy.pos, targetWorld, enemy.stats.spd * 60 * dt);

      if (getDistance(enemy.pos, targetWorld) < 5) {
        enemy.waypointIndex++;
      }
    });
  }

  private updateOperators(dt: number) {
    this.operators.forEach(op => {
      op.cooldown = Math.max(0, op.cooldown - dt);

      if (op.cooldown <= 0) {
        let target: Enemy | null = null;

        // 优先攻击被自己阻挡的
        if (op.blockingEnemyIds.length > 0) {
          const blockedId = op.blockingEnemyIds[0];
          target = this.enemies.find(e => e.id === blockedId) || null;
        }

        // 其次攻击范围内最近的
        if (!target) {
          let minDist = Infinity;
          const rangePx = op.stats.range * CONFIG.TILE_SIZE;
          const opCenter = { x: op.pos.x + CONFIG.TILE_SIZE/2, y: op.pos.y + CONFIG.TILE_SIZE/2 };

          this.enemies.forEach(enemy => {
            const dist = getDistance(opCenter, enemy.pos);
            if (dist <= rangePx && dist < minDist) {
              minDist = dist;
              target = enemy;
            }
          });
        }

        if (target) {
          this.fireProjectile(op, target as Enemy);
          op.cooldown = op.stats.aspd;
        }
      }
    });
  }

  private fireProjectile(source: Operator, target: Enemy) {
    const startPos = { x: source.pos.x + CONFIG.TILE_SIZE / 2, y: source.pos.y + CONFIG.TILE_SIZE / 2 };
    this.projectiles.push({
      id: `proj_${Date.now()}_${Math.random()}`,
      pos: startPos,
      targetId: target.id,
      speed: 600,
      damage: source.stats.atk,
      color: '#fff',
      markedForDeletion: false
    });
  }

  private updateProjectiles(dt: number) {
    this.projectiles.forEach(proj => {
      const target = this.enemies.find(e => e.id === proj.targetId);
      if (!target || target.markedForDeletion) {
        proj.markedForDeletion = true;
        return;
      }

      proj.pos = moveTowards(proj.pos, target.pos, proj.speed * dt);

      if (getDistance(proj.pos, target.pos) < 15) {
        target.stats.hp -= proj.damage;
        proj.markedForDeletion = true;

        if (target.stats.hp <= 0 && !target.markedForDeletion) {
          target.markedForDeletion = true;
          // 敌人死亡，解除其对干员的占用
          if (target.isBlockedBy) {
            const blocker = this.operators.find(op => op.id === target.isBlockedBy);
            if (blocker) {
              blocker.blockingEnemyIds = blocker.blockingEnemyIds.filter(id => id !== target.id);
            }
          }
        }
      }
    });
  }

  private cleanup() {
    this.enemies = this.enemies.filter(e => !e.markedForDeletion);
    this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
    if (this.lives <= 0) {
      alert('任务失败！页面将刷新。');
      location.reload();
    }
  }
}