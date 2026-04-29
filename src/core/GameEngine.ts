import { CONFIG, MAP_LAYOUT, PATH_WAYPOINTS, ENEMY_DB, OPERATOR_DB, WAVES, resolveSkillForRank, applyTalentsToStats } from '../config/gameData';
import { FACTION_DB, FactionId } from '../config/factions';
import { ShopSystem } from './ShopSystem';
import { Enemy, Operator, Projectile, GamePhase, Direction } from '../types';
import { getDistance, moveTowards, checkCollision, isInAttackRange } from './MathUtils';

export interface BenchOperator {
  uid: string;
  templateId: string;
  rank: 1 | 2; // 角色等阶
}

// 角色池统计类型已迁至 src/types/index.ts（外部主要通过 ShopSystem 访问）

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

  // === 商店子系统（v1.5.0）=== 实例在 constructor 里初始化
  shop!: ShopSystem;
  // 向后兼容的代理访问（main.ts / Renderer 还在用这些字段名）
  get shopItems() { return this.shop.shopItems; }
  get temporaryShopItems() { return this.shop.temporaryShopItems; }
  get isInTemporaryShop() { return this.shop.isInTemporaryShop; }
  get operatorPool() { return this.shop.operatorPool; }

  
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
    this.shop = new ShopSystem(this);
    this.shop.refreshShop(true);
  }

  // 公开给 ShopSystem 调用
  notifyUpdate() {
    if (this.onStateUpdated) this.onStateUpdated();
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

  // === 商店与经济（v1.5.0：实现迁至 ShopSystem，此处保留 thin proxy）===
  refreshShop(forceFree: boolean = false): void {
    this.shop.refreshShop(forceFree);
  }

  tryBuyOperator(shopItemUid: string): boolean {
    return this.shop.tryBuyOperator(shopItemUid);
  }

  sellBenchOperator(benchUid: string): boolean {
    return this.shop.sellBenchOperator(benchUid);
  }

  upgradeCore() {
    const upgradeCost = this.coreLevel * 10;
    if (this.money >= upgradeCost && this.coreLevel < 5) {
      this.money -= upgradeCost;
      this.coreLevel++;
      this.shop.refreshShop(true);
    }
  }

  // === 部署 / 撤回 ===

  // 撤回战场上的角色回备战区
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

      // v2.0.0：技能持续时间倒计时；归零后取消激活并清空 SP
      if (op.skillActive) {
        op.skillDuration = Math.max(0, op.skillDuration - dt);
        if (op.skillDuration <= 0) {
          op.skillActive = false;
          op.currentSp = 0;
        }
      }

      // 技力回复：根据spRecovery类型进行自然回复（每秒1点）
      // 激活期间不再回复
      const recoveryType = op.skill.spRecovery;
      if (!op.skillActive && (recoveryType === 'auto' || recoveryType === 'auto_attack' ||
          recoveryType === 'auto_defense' || recoveryType === 'all')) {
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
          // 攻速：技能激活时若提供 aspdPct，则按百分比缩短攻击间隔
          let aspd = op.stats.aspd;
          if (op.skillActive && op.skill.effectType === 'attack_buff') {
            const aspdPct = op.skill.values.aspdPct;
            if (aspdPct) aspd = Math.max(0.2, aspd * (1 - aspdPct / 100));
          }
          op.cooldown = aspd;
        }
      }
    });
  }

  private fireProjectile(source: Operator, target: Enemy) {
    const startPos = { x: source.pos.x + CONFIG.TILE_SIZE / 2, y: source.pos.y + CONFIG.TILE_SIZE / 2 };

    // 技能激活期间的伤害倍率（attack_buff 类）
    let damage = source.stats.atk;
    if (source.skillActive && source.skill.effectType === 'attack_buff') {
      const atkMul = source.skill.values.atkMul;
      if (atkMul) damage = Math.round(damage * atkMul);
    }

    this.projectiles.push({
      id: `proj_${Date.now()}_${Math.random()}`,
      pos: startPos,
      targetId: target.id,
      speed: 600,
      damage,
      color: source.skillActive ? '#f1c40f' : '#fff',
      markedForDeletion: false
    });

    // 攻击回复技力（每次攻击+1点）；激活期间不再累计
    const recoveryType = source.skill.spRecovery;
    if (!source.skillActive && (recoveryType === 'attack' || recoveryType === 'auto_attack' ||
        recoveryType === 'attack_defense' || recoveryType === 'all')) {
      source.currentSp = Math.min(source.skill.cost, source.currentSp + 1);
    }
  }

  // v2.0.0：手动激活技能。返回是否成功激活。
  tryActivateSkill(operatorId: string): boolean {
    const op = this.operators.find(o => o.id === operatorId);
    if (!op || op.isRetreated) return false;
    if (op.skillActive) return false;
    if (op.currentSp < op.skill.cost) return false;
    if (op.skill.duration <= 0) {
      // 当前版本仅支持持续型技能；瞬发型在 v2.x 后续迭代支持
      alert('该技能为瞬发型，暂未实现手动激活，敬请期待。');
      return false;
    }
    op.skillActive = true;
    op.skillDuration = op.skill.duration;
    this.notifyUpdate();
    return true;
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