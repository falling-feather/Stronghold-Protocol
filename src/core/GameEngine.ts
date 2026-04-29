import { CONFIG, MAP_LAYOUT, PATH_WAYPOINTS, ENEMY_DB, OPERATOR_DB, WAVES, RARITY_RATES, resolveSkillForRank, applyTalentsToStats } from '../config/gameData';
import { FACTION_DB, FactionId } from '../config/factions';
import { Enemy, Operator, Projectile, GamePhase, ShopItem, Direction } from '../types';
import { getDistance, moveTowards, checkCollision, isInAttackRange } from './MathUtils';

export interface BenchOperator {
  uid: string;
  templateId: string;
  rank: 1 | 2; // 角色等阶
}

// 角色池统计
interface OperatorPoolStats {
  count: number; // 累计获得次数（最多7次）
  rank1Count: number; // 当前拥有的1阶数量
  rank2Count: number; // 当前拥有的2阶数量
}

// 待部署的角色（第一步：放置位置）
interface PendingDeployment {
  benchUid: string;
  gridX: number;
  gridY: number;
  templateId: string;
  rank: 1 | 2;
}

export class GameEngine {
  enemies: Enemy[] = [];
  operators: Operator[] = [];
  bench: BenchOperator[] = [];
  projectiles: Projectile[] = [];
  
  phase: GamePhase = 'PREP';
  factionId: FactionId;
  // 阵容编排：只有这些 templateId 会进入商店抽取池；null = 不过滤
  allowedTemplateIds: Set<string> | null = null;
  money: number;
  lives: number;
  waveIndex: number = 0;
  coreLevel: number = 1;
  
  shopItems: ShopItem[] = [];
  
  // 角色池系统
  operatorPool: Map<string, OperatorPoolStats> = new Map(); // 记录每个角色的获取统计
  isInTemporaryShop: boolean = false; // 是否在临时商店中
  temporaryShopItems: ShopItem[] = []; // 临时商店物品
  
  // 待部署状态
  pendingDeployment: PendingDeployment | null = null;
  
  onStateUpdated: (() => void) | null = null;

  private enemiesToSpawn: number = 0;
  private spawnTimer: number = 0;
  private spawnInterval: number = 0;
  private currentEnemyId: string = '';
  private currentWaveReward: number = 0;
  
  // 战斗时间限制
  public combatTimeLimit: number = 0; // 当前波次的战斗时间限制（秒）
  public combatTimeRemaining: number = 0; // 剩余时间（秒）
  private totalEnemiesInWave: number = 0; // 当前波次的总怪物数
  private killedEnemiesInWave: number = 0; // 当前波次已击杀的怪物数

  constructor(factionId: FactionId = 'command', allowedTemplateIds: Set<string> | null = null) {
    this.factionId = factionId;
    this.allowedTemplateIds = allowedTemplateIds;
    const eff = FACTION_DB[factionId].effect;
    this.lives = eff.initialLives ?? CONFIG.BASE_LIVES;
    this.money = eff.initialMoney ?? CONFIG.BASE_MONEY;
    this.refreshShop(true);
  }

  update(dt: number) {
    if (this.phase === 'COMBAT') {
      // 更新战斗时间
      this.combatTimeRemaining -= dt;
      if (this.combatTimeRemaining <= 0) {
        this.handleTimeUp();
        return;
      }
      
      this.handleSpawning(dt);
      this.updateBlocking();
      this.updateEnemies(dt);
      this.updateOperators(dt);
      this.updateProjectiles(dt);
    }
    
    this.cleanup();

    if (this.phase === 'COMBAT') {
      this.checkCombatEnd();
    }
  }
  
  private handleTimeUp() {
    // 时间到，根据剩余怪物数扣除生命值
    const remainingEnemies = this.totalEnemiesInWave - this.killedEnemiesInWave;
    this.lives -= remainingEnemies;
    
    // 清除所有敌人
    this.enemies.forEach(enemy => enemy.markedForDeletion = true);
    this.enemiesToSpawn = 0;
    
    if (this.lives <= 0) {
      this.phase = 'PREP';
      this.notifyUpdate();
      return;
    }
    
    // 结束战斗
    this.endCombat();
  }

  private notifyUpdate() {
    if (this.onStateUpdated) this.onStateUpdated();
  }

  // === 战斗流程 ===
  tryStartCombat(): boolean {
    if (this.phase === 'COMBAT') return false;

    if (this.money > 0) {
      const confirmBurn = window.confirm(`还有 资金 ${this.money} 未花费。\n战斗开始将回收资金！\n确认开始？`);
      if (!confirmBurn) return false;
    }

    if (this.waveIndex < WAVES.length) {
      const waveConfig = WAVES[this.waveIndex];
      this.enemiesToSpawn = waveConfig.count;
      this.spawnInterval = waveConfig.interval;
      this.currentEnemyId = waveConfig.enemyId;
      this.currentWaveReward = waveConfig.reward;
      
      // 根据波次难度设置战斗时间（60-90秒）
      // 波次越难，时间越短
      const difficultyFactor = Math.min(this.waveIndex / WAVES.length, 1);
      this.combatTimeLimit = 90 - (difficultyFactor * 30); // 90秒到60秒
      this.combatTimeRemaining = this.combatTimeLimit;
      this.totalEnemiesInWave = waveConfig.count;
      this.killedEnemiesInWave = 0;
      
      this.money = 0;
      this.phase = 'COMBAT';
      this.notifyUpdate(); // 触发UI隐藏底部
      return true;
    } else {
      alert("全域威胁已清除！");
      return false;
    }
  }

  private checkCombatEnd() {
    if (this.phase === 'COMBAT' && this.enemiesToSpawn <= 0 && this.enemies.length === 0) {
      this.endCombat();
    }
  }

  private endCombat() {
    this.phase = 'PREP';
    this.waveIndex++;
    this.money += this.currentWaveReward;
    this.combatTimeRemaining = 0; // 重置时间
    this.combatTimeLimit = 0;

    this.operators.forEach(op => {
      op.stats.hp = op.stats.maxHp;
      op.isRetreated = false;
      op.blockingEnemyIds = [];
    });
    
    setTimeout(() => {
        alert(`=== 第 ${this.waveIndex} 波次完成 ===\n获得资金: ${this.currentWaveReward}`);
        this.refreshShop(true);
        this.notifyUpdate(); // 触发UI弹出底部
    }, 100);
  }

  // === 商店与经济 ===
  refreshShop(forceFree: boolean = false) {
    // 如果在临时商店，不能刷新
    if (this.isInTemporaryShop) {
      alert("请先完成临时商店的选择！");
      return;
    }
    
    const cost = 2;
    if (!forceFree) {
      if (this.phase !== 'PREP') return;
      if (this.money < cost) return;
      this.money -= cost;
    }

    this.shopItems = [];
    const shopSize = 3 + (this.coreLevel >= 3 ? 1 : 0) + (this.coreLevel >= 5 ? 1 : 0);
    let attempts = 0;
    const maxAttempts = shopSize * 10; // 防止无限循环

    for (let i = 0; i < shopSize && attempts < maxAttempts; attempts++) {
      const templateId = this.rollForOperator();
      const template = OPERATOR_DB[templateId as keyof typeof OPERATOR_DB];
      
      // 检查角色池限制
      const poolStats = this.operatorPool.get(templateId);
      if (poolStats && poolStats.count >= 7) {
        // 如果已达到上限，重新roll
        continue;
      }
      
      this.shopItems.push({
        uid: `shop_${Date.now()}_${i}`,
        templateId: templateId,
        cost: template.cost,
        bought: false
      });
      i++;
    }
    this.notifyUpdate();
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
      .filter(([id, op]) => op.rarity === targetRarity && (this.allowedTemplateIds === null || this.allowedTemplateIds.has(id)))
      .map(([id, _]) => id);

    if (candidates.length === 0) {
      // 当前稀有度在 roster 里为空，退回全部允许同稀有度
      const fallback = Object.entries(OPERATOR_DB)
        .filter(([_, op]) => op.rarity === targetRarity)
        .map(([id, _]) => id);
      if (fallback.length === 0) return Object.keys(OPERATOR_DB)[0];
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  upgradeCore() {
    const upgradeCost = this.coreLevel * 10;
    if (this.money >= upgradeCost && this.coreLevel < 5) {
      this.money -= upgradeCost;
      this.coreLevel++;
      this.refreshShop(true);
    }
  }

  // === 购买、出售、部署、撤回 (核心逻辑) ===

  tryBuyOperator(shopItemUid: string): boolean {
    if (this.phase !== 'PREP') return false;
    if (this.isInTemporaryShop) {
      // 临时商店购买逻辑
      return this.tryBuyTemporaryShop(shopItemUid);
    }
    
    const item = this.shopItems.find(i => i.uid === shopItemUid);
    if (!item || item.bought) return false;
    
    const template = OPERATOR_DB[item.templateId as keyof typeof OPERATOR_DB];
    if (!template) return false;
    
    // 检查角色池限制（每个角色最多7次）
    const poolStats = this.operatorPool.get(item.templateId);
    if (poolStats && poolStats.count >= 7) {
      alert("该角色已达到最大获取次数！");
      return false;
    }
    
    if (this.money < item.cost) return false;
    if (this.bench.length >= CONFIG.MAX_BENCH_SIZE) {
        alert("备战区已满！");
        return false;
    }

    this.money -= item.cost;
    item.bought = true;
    
    // 更新角色池统计
    if (!poolStats) {
      this.operatorPool.set(item.templateId, { count: 1, rank1Count: 1, rank2Count: 0 });
    } else {
      poolStats.count++;
      poolStats.rank1Count++;
    }
    
    this.bench.push({
        uid: `bench_${Date.now()}_${Math.random()}`,
        templateId: item.templateId,
        rank: 1 // 默认1阶
    });

    // 检查是否需要合并（3个一阶同名角色）
    this.checkAndMergeOperators(item.templateId);

    this.notifyUpdate();
    return true;
  }
  
  private tryBuyTemporaryShop(shopItemUid: string): boolean {
    const item = this.temporaryShopItems.find(i => i.uid === shopItemUid);
    if (!item || item.bought) return false;
    
    if (this.bench.length >= CONFIG.MAX_BENCH_SIZE) {
      alert("备战区已满！");
      return false;
    }
    
    item.bought = true;
    
    // 临时商店免费获得
    const template = OPERATOR_DB[item.templateId as keyof typeof OPERATOR_DB];
    if (!template) return false;
    
    // 更新角色池统计
    const poolStats = this.operatorPool.get(item.templateId);
    if (!poolStats) {
      this.operatorPool.set(item.templateId, { count: 1, rank1Count: 1, rank2Count: 0 });
    } else {
      poolStats.count++;
      poolStats.rank1Count++;
    }
    
    this.bench.push({
      uid: `bench_${Date.now()}_${Math.random()}`,
      templateId: item.templateId,
      rank: 1
    });
    
    // 退出临时商店
    this.exitTemporaryShop();
    
    this.notifyUpdate();
    return true;
  }
  
  private checkAndMergeOperators(templateId: string) {
    const poolStats = this.operatorPool.get(templateId);
    if (!poolStats || poolStats.rank1Count < 3) return;
    
    // 找到所有1阶同名角色（包括场上的和备战区的）
    const rank1OnField = this.operators.filter(op => op.templateId === templateId && op.rank === 1);
    
    // 需要撤回场上的角色
    rank1OnField.forEach(op => {
      this.recallOperator(op.id);
    });
    
    // 重新获取备战区的1阶角色（可能已经撤回了一些）
    const allRank1 = this.bench.filter(b => b.templateId === templateId && b.rank === 1);
    
    if (allRank1.length >= 3) {
      // 移除3个1阶
      for (let i = 0; i < 3; i++) {
        const index = this.bench.findIndex(b => b.uid === allRank1[i].uid);
        if (index !== -1) {
          this.bench.splice(index, 1);
        }
      }
      
      // 添加1个2阶
      this.bench.push({
        uid: `bench_${Date.now()}_${Math.random()}`,
        templateId: templateId,
        rank: 2
      });
      
      // 更新统计
      poolStats.rank1Count -= 3;
      poolStats.rank2Count += 1;
      
      // 进入临时商店
      this.enterTemporaryShop(templateId);
    }
  }
  
  private enterTemporaryShop(mergedTemplateId: string) {
    const template = OPERATOR_DB[mergedTemplateId as keyof typeof OPERATOR_DB];
    if (!template) return;
    
    const nextShopLevel = template.shopLevel + 1;
    
    // 筛选出比当前角色商店等级高一级的角色
    const candidates = Object.entries(OPERATOR_DB)
      .filter(([, op]) => op.shopLevel === nextShopLevel)
      .map(([id]) => id);
    
    if (candidates.length === 0) {
      alert("自动合并完成！但暂时没有更高等级的角色可用。");
      return;
    }
    
    // 随机选择3-4个角色（避免重复）
    const shopSize = Math.min(3 + Math.floor(Math.random() * 2), candidates.length); // 3或4个，但不超过候选数
    const shuffled = [...candidates].sort(() => Math.random() - 0.5); // 打乱数组
    this.temporaryShopItems = [];
    
    for (let i = 0; i < shopSize; i++) {
      const selectedId = shuffled[i];
      
      this.temporaryShopItems.push({
        uid: `temp_shop_${Date.now()}_${i}`,
        templateId: selectedId,
        cost: 0, // 免费
        bought: false
      });
    }
    
    this.isInTemporaryShop = true;
    alert(`自动合并完成！获得2阶${template.name}！\n进入临时商店，可免费获得一个角色。`);
    this.notifyUpdate();
  }
  
  private exitTemporaryShop() {
    this.isInTemporaryShop = false;
    this.temporaryShopItems = [];
  }

  // 新增：出售备战区角色
  sellBenchOperator(benchUid: string): boolean {
    const index = this.bench.findIndex(b => b.uid === benchUid);
    if (index === -1) return false;
    
    const op = this.bench[index];
    const template = OPERATOR_DB[op.templateId];
    
    this.bench.splice(index, 1);
    this.money += template.saleValue;
    this.notifyUpdate();
    return true;
  }

  // 新增：撤回战场上的角色回备战区
  recallOperator(operatorId: string): boolean {
    const index = this.operators.findIndex(op => op.id === operatorId);
    if (index === -1) return false;

    if (this.bench.length >= CONFIG.MAX_BENCH_SIZE) {
        alert("备战区已满，无法撤回！");
        return false;
    }

    const op = this.operators[index];
    // 处理阻挡逻辑：释放被阻挡的敌人
    op.blockingEnemyIds.forEach(eid => {
        const enemy = this.enemies.find(e => e.id === eid);
        if (enemy) enemy.isBlockedBy = null;
    });

    // 从战场移除
    this.operators.splice(index, 1);
    
    // 加回备战区（撤回时保留等阶，但不保留朝向）
    this.bench.push({
        uid: `bench_${Date.now()}_${Math.random()}`,
        templateId: op.templateId,
        rank: op.rank || 1 // 保持原有等阶
    });

    this.notifyUpdate();
    return true;
  }

  // 第一步：放置角色到格子（进入待部署状态）
  tryPlaceOperator(benchUid: string, gridX: number, gridY: number): boolean {
    if (this.phase !== 'PREP') return false;
    if (gridX < 0 || gridX >= CONFIG.MAP_WIDTH || gridY < 0 || gridY >= CONFIG.MAP_HEIGHT) return false;
    if (this.operators.some(op => op.gridPos.x === gridX && op.gridPos.y === gridY)) return false;

    const benchIndex = this.bench.findIndex(b => b.uid === benchUid);
    if (benchIndex === -1) return false;
    const benchOp = this.bench[benchIndex];
    const template = OPERATOR_DB[benchOp.templateId];

    const tileType = MAP_LAYOUT[gridY][gridX];
    if (template.placement === 'high_ground' && tileType !== 1) return false;
    if (template.placement === 'ground' && tileType !== 0) return false;

    // 进入待部署状态
    this.pendingDeployment = {
      benchUid: benchUid,
      gridX: gridX,
      gridY: gridY,
      templateId: benchOp.templateId,
      rank: benchOp.rank || 1
    };

    this.notifyUpdate();
    return true;
  }

  // 第二步：设置朝向并完成部署
  confirmDeployment(direction: Direction): boolean {
    if (!this.pendingDeployment) return false;

    const { benchUid, gridX, gridY, templateId, rank } = this.pendingDeployment;
    
    const benchIndex = this.bench.findIndex(b => b.uid === benchUid);
    if (benchIndex === -1) {
      this.pendingDeployment = null;
      return false;
    }

    const template = OPERATOR_DB[templateId];

    // 从备战区移除
    this.bench.splice(benchIndex, 1);

    // 部署角色 — 使用 v1.2 体系：天赋叠加到属性，技能按 rank 解析
    const finalStats = applyTalentsToStats(template.stats, template.talents, rank);
    const skillInfo = resolveSkillForRank(template, rank);
    // 天赋 sp_init 额外起手 SP
    const extraSp = template.talents.reduce((sum, t) => {
      if (t.effect !== 'sp_init') return sum;
      return sum + (rank === 2 ? t.rankValues.rank2 : t.rankValues.rank1);
    }, 0);

    this.operators.push({
      id: `op_${Date.now()}`,
      templateId: templateId,
      pos: { x: gridX * CONFIG.TILE_SIZE, y: gridY * CONFIG.TILE_SIZE },
      gridPos: { x: gridX, y: gridY },
      radius: CONFIG.TILE_SIZE,
      color: template.color,
      stats: finalStats,
      name: template.name,
      cooldown: 0,
      targetId: null,
      cost: template.cost,
      placement: template.placement,
      rarity: template.rarity,
      markedForDeletion: false,
      blockingEnemyIds: [],
      isRetreated: false,
      skill: skillInfo,
      currentSp: skillInfo.initialSp + extraSp,
      skillActive: false,
      skillDuration: 0,
      rank: rank,
      direction: direction
    });

    // 清除待部署状态
    this.pendingDeployment = null;

    this.notifyUpdate();
    return true;
  }

  // 取消待部署
  cancelPendingDeployment(): void {
    this.pendingDeployment = null;
    this.notifyUpdate();
  }

  // === 战斗循环逻辑 ===

  private updateBlocking() {
    this.enemies.forEach(enemy => {
      if (enemy.isBlockedBy) {
        const blocker = this.operators.find(op => op.id === enemy.isBlockedBy);
        if (!blocker || blocker.markedForDeletion || blocker.isRetreated) {
          enemy.isBlockedBy = null;
        }
        return; 
      }
      const validBlockers = this.operators.filter(op => 
        !op.isRetreated &&
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
        this.enemiesToSpawn--;
      }
    }
  }

  private spawnEnemy() {
    const template = ENEMY_DB[this.currentEnemyId as keyof typeof ENEMY_DB];
    const startNode = PATH_WAYPOINTS[0];
    this.enemies.push({
      id: `en_${Date.now()}`,
      pos: { x: startNode.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2, y: startNode.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2 },
      gridPos: { x: startNode.x, y: startNode.y },
      radius: template.radius,
      color: template.color,
      stats: { ...template.stats },
      waypointIndex: 0,
      markedForDeletion: false,
      isBlockedBy: null,
      attackCooldown: 0
    });
  }

  private updateEnemies(dt: number) {
    this.enemies.forEach(enemy => {
      if (enemy.isBlockedBy) {
        const blocker = this.operators.find(op => op.id === enemy.isBlockedBy);
        if (blocker && !blocker.isRetreated) {
          enemy.attackCooldown -= dt;
          if (enemy.attackCooldown <= 0) {
            const damage = Math.max(10, enemy.stats.atk - blocker.stats.def);
            blocker.stats.hp -= damage;
            
            // 受击回复技力（每次受击+1点）
            const recoveryType = blocker.skill.spRecovery;
            if (recoveryType === 'defense' || recoveryType === 'auto_defense' || 
                recoveryType === 'attack_defense' || recoveryType === 'all') {
              blocker.currentSp = Math.min(blocker.skill.cost, blocker.currentSp + 1);
            }
            
            enemy.attackCooldown = enemy.stats.aspd;
            if (blocker.stats.hp <= 0) this.handleOperatorRetreat(blocker);
          }
        }
        return;
      }
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
      if (getDistance(enemy.pos, targetWorld) < 5) enemy.waypointIndex++;
    });
  }

  private handleOperatorRetreat(op: Operator) {
    op.isRetreated = true;
    op.stats.hp = 0;
    op.blockingEnemyIds.forEach(enemyId => {
      const enemy = this.enemies.find(e => e.id === enemyId);
      if (enemy) enemy.isBlockedBy = null;
    });
    op.blockingEnemyIds = [];
  }

  private updateOperators(dt: number) {
    this.operators.forEach(op => {
      if (op.isRetreated) return;
      op.cooldown = Math.max(0, op.cooldown - dt);
      
      // 技力回复：根据spRecovery类型进行自然回复（每秒1点）
      const recoveryType = op.skill.spRecovery;
      if (recoveryType === 'auto' || recoveryType === 'auto_attack' || 
          recoveryType === 'auto_defense' || recoveryType === 'all') {
        op.currentSp = Math.min(op.skill.cost, op.currentSp + dt);
      }

      if (op.cooldown <= 0) {
        let target: Enemy | null = null;
        if (op.blockingEnemyIds.length > 0) {
          target = this.enemies.find(e => e.id === op.blockingEnemyIds[0]) || null;
        }
        if (!target) {
          // 使用基于朝向的攻击范围系统
          let minDist = Infinity;
          this.enemies.forEach(enemy => {
            if (isInAttackRange(op.gridPos, op.direction, op.placement, op.stats.range, enemy.pos, CONFIG.TILE_SIZE)) {
              const opCenter = { x: op.pos.x + CONFIG.TILE_SIZE/2, y: op.pos.y + CONFIG.TILE_SIZE/2 };
              const dist = getDistance(opCenter, enemy.pos);
              if (dist < minDist) {
                minDist = dist;
                target = enemy;
              }
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
    
    // 攻击回复技力（每次攻击+1点）
    const recoveryType = source.skill.spRecovery;
    if (recoveryType === 'attack' || recoveryType === 'auto_attack' || 
        recoveryType === 'attack_defense' || recoveryType === 'all') {
      source.currentSp = Math.min(source.skill.cost, source.currentSp + 1);
    }
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
          this.killedEnemiesInWave++; // 记录击杀数
          if (target.isBlockedBy) {
            const blocker = this.operators.find(op => op.id === target.isBlockedBy);
            if (blocker) blocker.blockingEnemyIds = blocker.blockingEnemyIds.filter(id => id !== target.id);
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