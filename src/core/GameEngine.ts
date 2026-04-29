import { CONFIG, MAP_LAYOUT, PATH_WAYPOINTS, ENEMY_DB, OPERATOR_DB, WAVES, PACT_DB, DEFAULT_ACTIVE_PACTS, resolveSkillForRank, applyTalentsToStats, buildTalentEffects } from '../config/gameData';
import { FACTION_DB, FactionId } from '../config/factions';
import { ShopSystem } from './ShopSystem';
import { Enemy, Operator, Projectile, GamePhase, Direction, AttackType, StatusEffect, StatusStat, PactRuntime, PactSource } from '../types';
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

  // v3.0.0：盟约叠层运行时
  pacts: PactRuntime[] = [];

  constructor(factionId: FactionId = 'command', allowedTemplateIds: Set<string> | null = null, activePactIds: string[] | null = null) {
    this.factionId = factionId;
    this.allowedTemplateIds = allowedTemplateIds;
    const eff = FACTION_DB[factionId].effect;
    this.lives = eff.initialLives ?? CONFIG.BASE_LIVES;
    this.money = eff.initialMoney ?? CONFIG.BASE_MONEY;
    this.shop = new ShopSystem(this);
    this.shop.refreshShop(true);
    // v3.0.0/v3.1.0：初始化盟约运行时（外部传入；缺省走 DEFAULT_ACTIVE_PACTS）
    const ids = (activePactIds && activePactIds.length > 0) ? activePactIds : DEFAULT_ACTIVE_PACTS;
    this.pacts = ids.filter(id => PACT_DB[id]).map(id => ({ defId: id, stack: 0, appliedTier: -1, decayAccum: 0 }));
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
      this.tickPactDecay(dt); // v3.0.2：盟约衰减
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

    // v3.0.0：盟约波次事件
    const perfect = this.killedEnemiesInWave >= this.totalEnemiesInWave;
    this.onPactEvent('wave_clear');
    if (perfect) this.onPactEvent('wave_perfect');

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
      direction: direction,
      deployTime: 0,
      costRefunded: false,
      effects: [...buildTalentEffects(template.talents, rank, templateId), ...this.getActivePactEffectsForOperator()] // sourceId 用 templateId 更稳定
    });

    // 清除待部署状态
    this.pendingDeployment = null;

    // v3.0.0：盟约事件
    this.onPactEvent('deploy_any');
    this.onPactEvent(`deploy_class:${template.class}` as PactSource);

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
        op.blockingEnemyIds.length < this.modifyStat(op.effects, op.stats.blockCount, 'blockCount') &&
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

  private spawnEnemy(enemyId?: string, atPos?: { x: number; y: number; gridX: number; gridY: number; waypointIndex: number }) {
    const id = enemyId ?? this.currentEnemyId;
    const template = ENEMY_DB[id as keyof typeof ENEMY_DB];
    if (!template) return;
    const startNode = PATH_WAYPOINTS[0];
    const px = atPos?.x ?? (startNode.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2);
    const py = atPos?.y ?? (startNode.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2);
    const gx = atPos?.gridX ?? startNode.x;
    const gy = atPos?.gridY ?? startNode.y;
    const wpi = atPos?.waypointIndex ?? 0;
    this.enemies.push({
      id: `en_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      pos: { x: px, y: py },
      gridPos: { x: gx, y: gy },
      radius: template.radius,
      color: template.color,
      stats: { ...template.stats },
      waypointIndex: wpi,
      markedForDeletion: false,
      isBlockedBy: null,
      attackCooldown: 0,
      effects: [],
      traits: template.traits,
      bossPhaseTriggered: false,
    });
  }

  private updateEnemies(dt: number) {
    this.enemies.forEach(enemy => {
      // v2.3.0：状态效果倒计时
      this.tickEffects(enemy.effects, dt);
      // v2.4.0：Boss 阶段触发
      if (enemy.traits?.bossPhase && !enemy.bossPhaseTriggered &&
          enemy.stats.hp > 0 && enemy.stats.hp <= enemy.stats.maxHp * enemy.traits.bossPhase.atHpPct) {
        enemy.bossPhaseTriggered = true;
        const eff = enemy.traits.bossPhase.effect;
        enemy.effects.push({ ...eff, remaining: eff.duration });
      }
      if (enemy.isBlockedBy) {
        const blocker = this.operators.find(op => op.id === enemy.isBlockedBy);
        if (blocker && !blocker.isRetreated) {
          enemy.attackCooldown -= dt;
          if (enemy.attackCooldown <= 0) {
            // v2.3.0：敌人攻击受 buff/debuff 影响
            const enemyAtk = this.modifyStat(enemy.effects, enemy.stats.atk, 'atk');
            const blockerDef = this.modifyStat(blocker.effects, blocker.stats.def, 'def');
            const damage = Math.max(10, enemyAtk - blockerDef);
            blocker.stats.hp -= damage;
            
            // 受击回复技力（每次受击+1点）
            const recoveryType = blocker.skill.spRecovery;
            if (recoveryType === 'defense' || recoveryType === 'auto_defense' || 
                recoveryType === 'attack_defense' || recoveryType === 'all') {
              blocker.currentSp = Math.min(blocker.skill.cost, blocker.currentSp + 1);
            }
            
            enemy.attackCooldown = this.modifyStat(enemy.effects, enemy.stats.aspd, 'aspd');
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
      enemy.pos = moveTowards(enemy.pos, targetWorld, this.modifyStat(enemy.effects, enemy.stats.spd, 'spd') * 60 * dt);
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
    // v3.0.0：盟约撤退事件
    this.onPactEvent('retreat_any');
  }

  private updateOperators(dt: number) {
    this.operators.forEach(op => {
      if (op.isRetreated) return;
      op.cooldown = Math.max(0, op.cooldown - dt);

      // v2.3.0：状态效果倒计时
      this.tickEffects(op.effects, dt);

      // v2.2.0：先锋部署费用回流
      op.deployTime += dt;
      if (!op.costRefunded && op.deployTime >= CONFIG.VANGUARD_REFUND_DELAY) {
        const tpl = OPERATOR_DB[op.templateId];
        if (tpl?.class === 'vanguard') {
          this.money += Math.round(tpl.cost * CONFIG.VANGUARD_REFUND_RATE);
          op.costRefunded = true;
          this.notifyUpdate();
        } else {
          // 非先锋直接标记，避免重复进入分支
          op.costRefunded = true;
        }
      }

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
          // v2.4.0：隐身/飞行过滤
          const opTemplate = OPERATOR_DB[op.templateId];
          const canHitFlying = op.placement === 'high_ground';
          const canHitStealth = opTemplate?.class === 'specialist';
          let minDist = Infinity;
          this.enemies.forEach(enemy => {
            if (enemy.traits?.flying && !canHitFlying) return;
            if (enemy.traits?.stealth && !canHitStealth) return;
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
          // v2.3.1：skill 的攻速加成已通过 effects 框架统一处理；这里只取 base aspd 走 modifyStat
          const aspd = Math.max(0.2, this.modifyStat(op.effects, op.stats.aspd, 'aspd'));
          op.cooldown = aspd;
        }
      }
    });
  }

  private fireProjectile(source: Operator, target: Enemy) {
    const startPos = { x: source.pos.x + CONFIG.TILE_SIZE / 2, y: source.pos.y + CONFIG.TILE_SIZE / 2 };
    const sourceTemplate = OPERATOR_DB[source.templateId];

    // v2.3.1：skill 的攻击加成已通过 effects 框架统一处理（见 tryActivateSkill）
    let damage = source.stats.atk;
    // v2.3.0：状态效果对攻击力的修正
    damage = Math.round(this.modifyStat(source.effects, damage, 'atk'));

    // v2.1.0：解析攻击类型（template.atkType 优先；其次按职业推断）
    const atkType: AttackType = sourceTemplate?.atkType
      ?? (sourceTemplate?.class === 'caster' ? 'magic'
         : sourceTemplate?.class === 'medic' ? 'heal'
         : 'physical');

    // 颜色提示：法术=紫，真伤=红，治疗=绿，物理=白；激活时统一金色
    const baseColor = atkType === 'magic' ? '#9b59b6'
                    : atkType === 'true' ? '#e74c3c'
                    : atkType === 'heal' ? '#2ecc71'
                    : '#fff';

    this.projectiles.push({
      id: `proj_${Date.now()}_${Math.random()}`,
      pos: startPos,
      targetId: target.id,
      speed: 600,
      damage,
      color: source.skillActive ? '#f1c40f' : baseColor,
      markedForDeletion: false,
      atkType
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
    // v2.3.1：把 skill 的属性加成转写为 effects（让 modifyStat 统一处理）
    if (op.skill.effectType === 'attack_buff') {
      const atkMul = op.skill.values.atkMul;
      if (atkMul) {
        op.effects.push({
          id: `skill_${op.id}_atk`,
          name: `${op.skill.name} · 攻击`,
          kind: 'buff',
          stat: 'atk',
          mod: atkMul - 1,
          modType: 'pct',
          duration: op.skill.duration,
          remaining: op.skill.duration,
          sourceId: op.id
        });
      }
      const aspdPct = op.skill.values.aspdPct;
      if (aspdPct) {
        op.effects.push({
          id: `skill_${op.id}_aspd`,
          name: `${op.skill.name} · 攻速`,
          kind: 'buff',
          stat: 'aspd',
          mod: -(aspdPct / 100), // aspd 是冷却秒数，越小越快
          modType: 'pct',
          duration: op.skill.duration,
          remaining: op.skill.duration,
          sourceId: op.id
        });
      }
    }
    this.notifyUpdate();
    return true;
  }

  // v2.3.0：Buff/Debuff 框架 — 公开 API
  applyEffectToOperator(operatorId: string, effect: StatusEffect): boolean {
    const op = this.operators.find(o => o.id === operatorId);
    if (!op || op.isRetreated) return false;
    op.effects.push({ ...effect, remaining: effect.duration });
    this.notifyUpdate();
    return true;
  }

  applyEffectToEnemy(enemyId: string, effect: StatusEffect): boolean {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy || enemy.markedForDeletion) return false;
    enemy.effects.push({ ...effect, remaining: effect.duration });
    return true;
  }

  // v3.0.0：盟约叠层 — 事件入口
  onPactEvent(source: PactSource) {
    if (this.pacts.length === 0) return;
    let dirty = false;
    for (const rt of this.pacts) {
      const def = PACT_DB[rt.defId];
      if (!def) continue;
      const matched = def.sources.find(s => s.source === source);
      if (!matched) continue;
      const before = rt.stack;
      rt.stack = Math.max(0, Math.min(def.cap, rt.stack + matched.perEvent));
      if (rt.stack !== before) dirty = this.reconcilePactTier(rt) || dirty;
    }
    if (dirty) this.notifyUpdate();
  }

  // v3.0.0：根据当前 stack 计算 tier 索引并应用差量
  // 返回是否真的发生 tier 变化（用于触发 UI 刷新）
  private reconcilePactTier(rt: PactRuntime): boolean {
    const def = PACT_DB[rt.defId];
    if (!def) return false;
    let newTier = -1;
    for (let i = 0; i < def.tiers.length; i++) {
      if (rt.stack >= def.tiers[i].threshold) newTier = i; else break;
    }
    if (newTier === rt.appliedTier) return false;
    // 撤掉旧 tier 的 effects（按 id 前缀匹配）
    const idPrefix = `pact_${def.id.replace(/^pact_/, '')}_`;
    if (def.scope === 'all_operators') {
      for (const op of this.operators) {
        op.effects = op.effects.filter(e => !(e.id.startsWith('pact_') && e.id.includes(def.id.replace(/^pact_/, ''))));
      }
    } else if (def.scope === 'all_enemies') {
      for (const en of this.enemies) {
        en.effects = en.effects.filter(e => !(e.id.startsWith('pact_') && e.id.includes(def.id.replace(/^pact_/, ''))));
      }
    }
    // 应用新 tier 的 effects（如果有）
    if (newTier >= 0) {
      const tierEffects = def.tiers[newTier].effects;
      if (def.scope === 'all_operators') {
        for (const op of this.operators) {
          if (op.isRetreated) continue;
          for (const eff of tierEffects) op.effects.push({ ...eff, remaining: eff.duration });
        }
      } else if (def.scope === 'all_enemies') {
        for (const en of this.enemies) {
          if (en.markedForDeletion) continue;
          for (const eff of tierEffects) en.effects.push({ ...eff, remaining: eff.duration });
        }
      }
    }
    rt.appliedTier = newTier;
    void idPrefix; // 为后续更精细前缀匹配预留
    return true;
  }

  // v3.0.0：返回当前已激活 tier 的所有 effects（用于干员部署时叠加）
  // v3.2.0：同时附加每个激活盟约的 penalty（枷锁），无视 tier
  getActivePactEffectsForOperator(): StatusEffect[] {
    const out: StatusEffect[] = [];
    for (const rt of this.pacts) {
      const def = PACT_DB[rt.defId];
      if (!def || def.scope !== 'all_operators') continue;
      // 枷锁：选择即背负，与 tier 无关
      if (def.penalty) {
        for (const eff of def.penalty) out.push({ ...eff, remaining: eff.duration });
      }
      // tier 加成：仅当 stack 达阈值
      if (rt.appliedTier < 0) continue;
      for (const eff of def.tiers[rt.appliedTier].effects) out.push({ ...eff, remaining: eff.duration });
    }
    return out;
  }

  // v3.0.2：盟约衰减
  private tickPactDecay(dt: number) {
    if (this.pacts.length === 0) return;
    let dirty = false;
    for (const rt of this.pacts) {
      const def = PACT_DB[rt.defId];
      if (!def?.decay) continue;
      if (rt.stack <= 0) continue;
      rt.decayAccum += dt;
      while (rt.decayAccum >= def.decay.interval && rt.stack > 0) {
        rt.decayAccum -= def.decay.interval;
        rt.stack = Math.max(0, rt.stack - def.decay.perTick);
        dirty = this.reconcilePactTier(rt) || dirty;
      }
      if (rt.stack === 0) rt.decayAccum = 0;
    }
    if (dirty) this.notifyUpdate();
  }

  // 内部：倒计时 + 清理过期效果。duration<0 视为永久，不递减。
  private tickEffects(effects: StatusEffect[], dt: number) {
    for (let i = effects.length - 1; i >= 0; i--) {
      if (effects[i].duration < 0) continue;
      effects[i].remaining -= dt;
      if (effects[i].remaining <= 0) effects.splice(i, 1);
    }
  }

  // 内部：把所有匹配 stat 的效果应用到 base 值上
  // 顺序：先 flat 加减，再 pct 乘法（按习惯叠加方式，便于直觉）
  private modifyStat(effects: StatusEffect[], base: number, stat: StatusStat): number {
    let val = base;
    for (const e of effects) {
      if (e.stat !== stat) continue;
      if (e.modType === 'flat') val += e.mod;
    }
    let pctMul = 1;
    for (const e of effects) {
      if (e.stat !== stat) continue;
      if (e.modType === 'pct') pctMul += e.mod;
    }
    return val * pctMul;
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
        // v2.1.0：按攻击类型结算最终伤害
        let finalDamage = proj.damage;
        if (proj.atkType === 'physical') {
          // v2.3.0：状态效果对防御的修正
          const def = this.modifyStat(target.effects, target.stats.def, 'def');
          finalDamage = Math.max(proj.damage * 0.05, proj.damage - def);
        } else if (proj.atkType === 'magic') {
          const baseMr = target.stats.magicResist ?? 0;
          const mr = this.modifyStat(target.effects, baseMr, 'magicResist');
          finalDamage = Math.max(proj.damage * 0.05, proj.damage * (1 - mr / 100));
        } else if (proj.atkType === 'true') {
          finalDamage = proj.damage;
        } else if (proj.atkType === 'heal') {
          // v2.1.0：治疗型暂不对敌人生效（v2.1.x 接入友军选择再做）
          finalDamage = 0;
        }
        target.stats.hp -= finalDamage;
        proj.markedForDeletion = true;
        if (target.stats.hp <= 0 && !target.markedForDeletion) {
          target.markedForDeletion = true;
          this.killedEnemiesInWave++; // 记录击杀数
          if (target.isBlockedBy) {
            const blocker = this.operators.find(op => op.id === target.isBlockedBy);
            if (blocker) blocker.blockingEnemyIds = blocker.blockingEnemyIds.filter(id => id !== target.id);
          }
          // v3.0.0：盟约击杀事件
          this.onPactEvent('kill_any');
          if (target.traits?.flying) this.onPactEvent('kill_flying');
          if (target.traits?.stealth) this.onPactEvent('kill_stealth');
          if (target.bossPhaseTriggered || target.traits?.bossPhase) this.onPactEvent('kill_elite');
          // v2.4.0：死亡召唤
          if (target.traits?.summon && target.traits.summon.on === 'death') {
            const sm = target.traits.summon;
            for (let i = 0; i < sm.count; i++) {
              this.spawnEnemy(sm.childId, {
                x: target.pos.x + (Math.random() - 0.5) * 20,
                y: target.pos.y + (Math.random() - 0.5) * 20,
                gridX: target.gridPos.x,
                gridY: target.gridPos.y,
                waypointIndex: target.waypointIndex,
              });
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