import { CONFIG, MAP_LAYOUT, PATH_WAYPOINTS, ENEMY_DB, OPERATOR_DB, WAVES, PACT_DB, DEFAULT_ACTIVE_PACTS, RESONANCE_DB, resolveSkillForRank, applyTalentsToStats, buildTalentEffects } from '../config/gameData';
import { rollEvent, EVENT_TRIGGER_CHANCE } from '../config/eventData';
import { BoonId, BOON_DB } from '../config/boonData';
import { getStartingMoneyBonus, getPactExtraStack, getEventChanceBonus, getStartingSpBonus, getStartingLivesBonus, getDecayMultiplier, calcShardsForRun } from '../config/metaData';
import { addShards, bumpStat, setStatMax, recordBoonUsed, getStats, unlockAchievement, isAchievementUnlocked, getDailyState, setDailyCompleted } from './MetaSave';
import { ACHIEVEMENTS, checkAchievements } from '../config/achievements';
import { getDailyChallenge, getTodayDate } from '../config/dailyData';
import { playSfx } from './AudioSystem';
import { FACTION_DB, FactionId } from '../config/factions';
import { ShopSystem } from './ShopSystem';
import { Enemy, Operator, Projectile, GamePhase, Direction, AttackType, StatusEffect, StatusStat, PactRuntime, PactSource, PactSelection, EventCard, EventEngineHandle } from '../types';
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
  // v3.3.0：当前激活的共鸣 id 集合 + 最近激活时间戳（UI 闪光用）
  // v3.3.3：值改为 boolean 表示是否处于「枷锁加成」翻倍状态
  activeResonances: Map<string, boolean> = new Map();
  resonanceActivatedAt: Record<string, number> = {};
  // v3.5.0：待解决事件卡（波之间随机触发，玩家选一项后调 resolveEvent 清空）
  pendingEvent: EventCard | null = null;
  // v3.5.3：本局事件日志
  eventHistory: { eventId: string; eventName: string; rarity: 'common'|'rare'|'epic'; optionIdx: number; optionLabel: string; afterWave: number }[] = [];
  // v3.6.2：本局开局福利（boon）
  activeBoonId: BoonId | null = null;
  // v3.8.0是否为每日挑战局
  isDailyMode: boolean = false;

  constructor(factionId: FactionId = 'command', allowedTemplateIds: Set<string> | null = null, activePactSelections: PactSelection[] | null = null, activeBoonId: BoonId | null = null, isDailyMode: boolean = false) {
    this.factionId = factionId;
    this.allowedTemplateIds = allowedTemplateIds;
    this.activeBoonId = activeBoonId;
    const boon = activeBoonId ? BOON_DB[activeBoonId] : null;
    const eff = FACTION_DB[factionId].effect;
    const boonLives = boon?.id === 'boon_starting_lives' ? 2 : 0;
    const boonMoney = boon?.id === 'boon_starting_money' ? 60 : (boon?.id === 'boon_starting_money_big' ? 120 : 0);
    this.lives = (eff.initialLives ?? CONFIG.BASE_LIVES) + getStartingLivesBonus() + boonLives;
    this.money = (eff.initialMoney ?? CONFIG.BASE_MONEY) + getStartingMoneyBonus() + boonMoney;
    this.shop = new ShopSystem(this);
    this.shop.refreshShop(true);
    // v3.0.0/v3.1.0/v3.2.1：初始化盟约运行时（外部传入 selections；缺省走 DEFAULT_ACTIVE_PACTS 全部非枷锁）
    const selections: PactSelection[] = (activePactSelections && activePactSelections.length > 0)
      ? activePactSelections
      : DEFAULT_ACTIVE_PACTS.map(id => ({ defId: id, shackled: false }));
    // v3.6.0：meta 升级"盟约预热"+ v3.6.2 boon"誓约觉醒"
    const boonPactStack = boon?.id === 'boon_pact_warmup' ? 2 : 0;
    const extraStack = getPactExtraStack() + boonPactStack;
    this.pacts = selections.filter(s => PACT_DB[s.defId]).map(s => {
      const def = PACT_DB[s.defId];
      const initStack = Math.min(def.cap, extraStack);
      return { defId: s.defId, stack: initStack, appliedTier: -1, decayAccum: 0, shackled: !!s.shackled };
    });
    // 初始 stack 立即结算 tier，让 meta 加成战斗前就生效
    this.pacts.forEach(rt => (this as any).reconcilePactTier(rt));
    // v3.7.0：开局统计
    bumpStat('totalRunsAttempted', 1);
    if (activeBoonId) recordBoonUsed(activeBoonId);
    // v3.8.0
    this.isDailyMode = isDailyMode;
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
    if (remainingEnemies > 0) playSfx('hit');
    
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
      // v3.6.0：通关时结算碎片
      const epicCount = this.eventHistory.filter(h => h.rarity === 'epic').length;
      const earned = calcShardsForRun({ wavesCleared: WAVES.length, victory: true, epicEventsTriggered: epicCount });
      addShards(earned);
      // v3.7.0：通关统计
      bumpStat('totalRunsWon', 1);
      if (this.pacts.some(p => p.shackled)) bumpStat('shackledRunsWon', 1);
      this.checkAndAnnounceAchievements();
      // v3.8.0：每日挑战奖励（每日仅 1 次）
      let dailyMsg = '';
      if (this.isDailyMode) {
        const today = getTodayDate();
        if (getDailyState().lastCompletedDate !== today) {
          const daily = getDailyChallenge(today);
          setDailyCompleted(today);
          addShards(daily.rewardShards);
          dailyMsg = `\n★ 每日挑战完成 +${daily.rewardShards} 碎片`;
        } else {
          dailyMsg = '\n（今日挑战已结算，不重复发奖）';
        }
      }
      alert(`全域威胁已清除！\n获得碎片：+${earned}（含通关奖励 50 + 每史诗事件 +15）${dailyMsg}`);
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
    // v3.13.0：boon 后勤补给 — 每波额外 +15
    if (this.activeBoonId === 'boon_wave_bonus') this.money += 15;
    this.combatTimeRemaining = 0; // 重置时间
    this.combatTimeLimit = 0;

    // v3.0.0：盟约波次事件
    const perfect = this.killedEnemiesInWave >= this.totalEnemiesInWave;
    this.onPactEvent('wave_clear');
    if (perfect) this.onPactEvent('wave_perfect');
    // v3.6.0：每波结束发 4 碎片（perfect +2），积少成多
    addShards(4 + (perfect ? 2 : 0));
    // v3.9.0：波次清理音效
    playSfx('wave_clear');
    // v3.7.0：累计波数 + 共鸣峰值
    bumpStat('totalWavesCleared', 1);
    setStatMax('maxResonanceInRun', this.activeResonances.size);
    this.checkAndAnnounceAchievements();

    this.operators.forEach(op => {
      op.stats.hp = op.stats.maxHp;
      op.isRetreated = false;
      op.blockingEnemyIds = [];
    });
    
    setTimeout(() => {
        alert(`=== 第 ${this.waveIndex} 波次完成 ===\n获得资金: ${this.currentWaveReward}`);
        this.refreshShop(true);
        this.notifyUpdate(); // 触发UI弹出底部
        // v3.5.0：尝试触发事件卡（不与 alert 冲突，alert 关闭后立即弹出 modal）
        if (!this.pendingEvent) {
          // v3.5.4：传入 currentWave + history 以支持 minWave/once/cooldown 过滤
          // v3.6.0：meta 升级"神秘指引"提升触发概率
          // v3.6.2：boon"命运牵引" +20%；"初遇眷顾" 强制首个事件触发
          const boonChance = this.activeBoonId === 'boon_event_chance' ? 0.2 : 0;
          const forceFirst = this.activeBoonId === 'boon_double_first_event' && this.eventHistory.length === 0;
          const chance = forceFirst ? 1 : (EVENT_TRIGGER_CHANCE + getEventChanceBonus() + boonChance);
          const ev = rollEvent(this.waveIndex, this.eventHistory, chance);
          if (ev) {
            this.pendingEvent = ev;
            this.notifyUpdate();
          }
        }
    }, 100);
  }

  // v3.5.0：事件卡 — 玩家选择某选项后调用
  resolveEvent(optionIndex: number) {
    if (!this.pendingEvent) return;
    const opt = this.pendingEvent.options[optionIndex];
    if (!opt) return;
    const ev = this.pendingEvent;
    const handle = this.asEventHandle();
    opt.apply(handle);
    // v3.5.3：写入事件日志
    this.eventHistory.push({
      eventId: ev.id,
      eventName: ev.name,
      rarity: ev.rarity ?? 'common',
      optionIdx: optionIndex,
      optionLabel: opt.label,
      afterWave: this.waveIndex,
    });
    // v3.7.0：史诗事件计数
    if ((ev.rarity ?? 'common') === 'epic') bumpStat('totalEpicEvents', 1);
    // v3.9.0：事件触发音效
    playSfx('event');
    this.pendingEvent = null;
    this.notifyUpdate();
  }

  // v3.5.0：暴露给事件卡 apply 的最小 API
  private asEventHandle(): EventEngineHandle {
    const self = this;
    return {
      get money() { return self.money; },
      set money(v: number) { self.money = v; },
      addPactStack: (defId: string, n: number) => {
        const rt = self.pacts.find(p => p.defId === defId);
        if (!rt) return;
        const def = PACT_DB[defId];
        if (!def) return;
        const before = rt.stack;
        rt.stack = Math.max(0, Math.min(def.cap, rt.stack + n));
        if (rt.stack !== before) {
          rt.lastStackChangeAt = performance.now();
          // 复用 reconcilePactTier（私有方法，类内可调）
          (self as any).reconcilePactTier(rt);
          self.notifyUpdate();
        }
      },
      addAllOperatorsSp: (amount: number) => {
        for (const op of self.operators) {
          if (op.isRetreated) continue;
          op.currentSp = Math.min(op.skill.cost, op.currentSp + amount);
        }
        self.notifyUpdate();
      },
      notifyUpdate: () => self.notifyUpdate(),
    };
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
    // v3.6.0：meta 升级 — 初始法力（每等级 +5 SP，封顶 skill cost）
    const metaSpBonus = getStartingSpBonus();
    // v3.6.2：boon"能量预热"额外 +15 SP
    const boonSpBonus = this.activeBoonId === 'boon_starting_sp' ? 15 : 0;

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
      currentSp: Math.min(skillInfo.cost, skillInfo.initialSp + extraSp + metaSpBonus + boonSpBonus),
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
    // v3.9.0：部署音效
    playSfx('deploy');

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
      // v3.10.0：护盾初始化
      currentShield: template.traits?.shield ?? 0,
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
        playSfx('hit');
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
    const now = performance.now();
    for (const rt of this.pacts) {
      const def = PACT_DB[rt.defId];
      if (!def) continue;
      const matched = def.sources.find(s => s.source === source);
      if (!matched) continue;
      const before = rt.stack;
      rt.stack = Math.max(0, Math.min(def.cap, rt.stack + matched.perEvent));
      if (rt.stack !== before) {
        rt.lastStackChangeAt = now; // v3.2.2：触发徽记 stack-bump 动画
        this.reconcilePactTier(rt);
        dirty = true;
      }
    }
    if (dirty) this.notifyUpdate();
  }

  // v3.0.0：根据当前 stack 计算 tier 索引并应用差量
  // 返回是否真的发生 tier 变化（用于触发 UI 刷新）
  private reconcilePactTier(rt: PactRuntime): boolean {
    const def = PACT_DB[rt.defId];
    if (!def) return false;
    // v3.2.1：枷锁模式阈值缩减（0.7上取整，下限 1）
    const thr = (t: number) => rt.shackled ? Math.max(1, Math.ceil(t * 0.7)) : t;
    let newTier = -1;
    for (let i = 0; i < def.tiers.length; i++) {
      if (rt.stack >= thr(def.tiers[i].threshold)) newTier = i; else break;
    }
    if (newTier === rt.appliedTier) return false;
    // v3.2.2：tier 升阶动画时间戳（仅升阶不下降）
    if (newTier > rt.appliedTier) rt.lastTierUpAt = performance.now();
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
    // v3.3.0：tier 变化后重新评估盟约共鸣
    this.reconcileResonances();
    return true;
  }

  // v3.3.0：扫描 RESONANCE_DB，激活/失活差量应用到全体单位
  // v3.3.3：支持「枷锁加成」 — 若 requires 中至少 1 个 pact 是 shackled 且 reso.shackledBoosts，effects 翻倍
  private reconcileResonances(): void {
    const now = performance.now();
    for (const reso of Object.values(RESONANCE_DB)) {
      const allMet = reso.requires.every(req => {
        const rt = this.pacts.find(p => p.defId === req.defId);
        return !!rt && rt.appliedTier >= req.minTier;
      });
      const boost = !!reso.shackledBoosts && reso.requires.some(req => {
        const rt = this.pacts.find(p => p.defId === req.defId);
        return !!rt && rt.shackled === true;
      });
      const wasActive = this.activeResonances.has(reso.id);
      const wasBoost = this.activeResonances.get(reso.id) === true;

      const applyOnce = (multiplier: number) => {
        if (reso.scope === 'all_operators') {
          for (const op of this.operators) {
            if (op.isRetreated) continue;
            for (let k = 0; k < multiplier; k++) {
              for (const eff of reso.effects) op.effects.push({ ...eff, remaining: eff.duration });
            }
          }
        } else if (reso.scope === 'all_enemies') {
          for (const en of this.enemies) {
            if (en.markedForDeletion) continue;
            for (let k = 0; k < multiplier; k++) {
              for (const eff of reso.effects) en.effects.push({ ...eff, remaining: eff.duration });
            }
          }
        }
      };
      const removeAll = () => {
        const prefix = `resonance_${reso.id}_`;
        if (reso.scope === 'all_operators') {
          for (const op of this.operators) op.effects = op.effects.filter(e => !e.id.startsWith(prefix));
        } else if (reso.scope === 'all_enemies') {
          for (const en of this.enemies) en.effects = en.effects.filter(e => !e.id.startsWith(prefix));
        }
      };

      if (allMet) {
        if (!wasActive) {
          applyOnce(boost ? 2 : 1);
          this.activeResonances.set(reso.id, boost);
          this.resonanceActivatedAt[reso.id] = now;
        } else if (wasBoost !== boost) {
          // boost 状态切换：先全撤再重挂新倍数
          removeAll();
          applyOnce(boost ? 2 : 1);
          this.activeResonances.set(reso.id, boost);
          this.resonanceActivatedAt[reso.id] = now;
        }
      } else if (wasActive) {
        removeAll();
        this.activeResonances.delete(reso.id);
      }
    }
  }

  // v3.0.0：返回当前已激活 tier 的所有 effects（用于干员部署时叠加）
  // v3.2.0：同时附加每个激活盟约的 penalty（枷锁），无视 tier
  getActivePactEffectsForOperator(): StatusEffect[] {
    const out: StatusEffect[] = [];
    for (const rt of this.pacts) {
      const def = PACT_DB[rt.defId];
      if (!def || def.scope !== 'all_operators') continue;
      // v3.2.0/v3.2.1：仅枷锁模式下附加 penalty
      if (def.penalty && rt.shackled) {
        for (const eff of def.penalty) out.push({ ...eff, remaining: eff.duration });
      }
      // tier 加成：仅当 stack 达阈值
      if (rt.appliedTier < 0) continue;
      for (const eff of def.tiers[rt.appliedTier].effects) out.push({ ...eff, remaining: eff.duration });
    }
    // v3.3.0：当前激活的盟约共鸣（仅 all_operators 范围）也叠加
    // v3.3.3：枷锁加成激活时复制一份 effects（翻倍）
    for (const [resoId, boost] of this.activeResonances) {
      const reso = RESONANCE_DB[resoId];
      if (!reso || reso.scope !== 'all_operators') continue;
      const times = boost ? 2 : 1;
      for (let k = 0; k < times; k++) {
        for (const eff of reso.effects) out.push({ ...eff, remaining: eff.duration });
      }
    }
    return out;
  }

  // v3.0.2：盟约衰减
  private tickPactDecay(dt: number) {
    if (this.pacts.length === 0) return;
    let dirty = false;
    // v3.6.1：meta 升级"韧链"减少衰减 — 直接缩放 dt
    const decayMul = getDecayMultiplier();
    if (decayMul <= 0) return;
    const scaledDt = dt * decayMul;
    for (const rt of this.pacts) {
      const def = PACT_DB[rt.defId];
      if (!def?.decay) continue;
      if (rt.stack <= 0) continue;
      rt.decayAccum += scaledDt;
      while (rt.decayAccum >= def.decay.interval && rt.stack > 0) {
        rt.decayAccum -= def.decay.interval;
        rt.stack = Math.max(0, rt.stack - def.decay.perTick);
        rt.lastStackChangeAt = performance.now(); // v3.2.2
        dirty = this.reconcilePactTier(rt) || dirty;
        dirty = true;
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
        // v3.10.0：先扣护盾，溢出再扣 hp
        let dmgToHp = finalDamage;
        if ((target.currentShield ?? 0) > 0 && proj.atkType !== 'heal') {
          const absorbed = Math.min(target.currentShield!, finalDamage);
          target.currentShield = (target.currentShield ?? 0) - absorbed;
          dmgToHp = finalDamage - absorbed;
        }
        target.stats.hp -= dmgToHp;
        // v3.10.0：被击狂怒 — 命中即给 enemy 加短期 aspd/spd buff（覆盖刷新）
        if (target.traits?.enrageOnHit && proj.atkType !== 'heal' && finalDamage > 0) {
          const er = target.traits.enrageOnHit;
          const existing = target.effects.find(e => e.id === 'enrage_on_hit');
          if (existing) {
            existing.remaining = er.durationS;
          } else {
            target.effects.push({
              id: 'enrage_on_hit', name: '被击狂怒', kind: 'buff',
              stat: 'aspd', mod: er.aspdMod, modType: 'pct',
              duration: er.durationS, remaining: er.durationS,
            });
            target.effects.push({
              id: 'enrage_on_hit_spd', name: '被击狂怒·迅捷', kind: 'buff',
              stat: 'spd', mod: er.spdMod, modType: 'pct',
              duration: er.durationS, remaining: er.durationS,
            });
          }
        }
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
          // v3.13.0：boon 赏金猟人 — 每击杀 +1 资金
          if (this.activeBoonId === 'boon_kill_bounty') this.money += 1;
          if (target.traits?.flying) this.onPactEvent('kill_flying');
          if (target.traits?.stealth) this.onPactEvent('kill_stealth');
          if (target.bossPhaseTriggered || target.traits?.bossPhase) this.onPactEvent('kill_elite');
          // v3.11.0：击杀护盾敌 / 击杀狂怒中敌
          if ((target.traits?.shield ?? 0) > 0) this.onPactEvent('kill_shielded');
          if (target.effects.some(e => e.id === 'enrage_on_hit')) this.onPactEvent('kill_in_enrage');
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
      // v3.6.0：失败时结算碎片
      const epicCount = this.eventHistory.filter(h => h.rarity === 'epic').length;
      const earned = calcShardsForRun({ wavesCleared: this.waveIndex, victory: false, epicEventsTriggered: epicCount });
      addShards(earned);
      this.checkAndAnnounceAchievements();
      playSfx('wave_fail');
      alert(`任务失败！\n清剿波次：${this.waveIndex}\n获得碎片：+${earned}\n页面将刷新。`);
      location.reload();
    }
  }

  // v3.7.0：扫描所有未解锁成就，命中后发奖并弹一次性公告
  private checkAndAnnounceAchievements(): void {
    const stats = getStats();
    const already = ACHIEVEMENTS.filter(a => isAchievementUnlocked(a.id)).map(a => a.id);
    const newly = checkAchievements(stats, already);
    if (newly.length === 0) return;
    const lines: string[] = [];
    let totalReward = 0;
    for (const a of newly) {
      if (unlockAchievement(a.id)) {
        const r = a.reward.shards ?? 0;
        if (r > 0) { addShards(r); totalReward += r; }
        lines.push(`${a.icon} ${a.name} —— ${a.desc}（${a.reward.note ?? ''}）`);
      }
    }
    if (lines.length > 0) {
      playSfx('achievement');
      setTimeout(() => alert(`★ 成就解锁 ★\n${lines.join('\n')}${totalReward ? `\n累计奖励：+${totalReward} 碎片` : ''}`), 50);
    }
  }

  // v4.1.0：序列化最小化游戏状态供联机镜像使用
  getStateSnapshot(): GameStateSnapshot {
    return {
      phase: this.phase,
      money: this.money,
      lives: this.lives,
      waveIndex: this.waveIndex,
      coreLevel: this.coreLevel,
      combatTimeRemaining: Math.max(0, Math.round(this.combatTimeRemaining * 10) / 10),
      enemies: this.enemies.map(e => ({
        id: e.id,
        x: Math.round(e.pos.x),
        y: Math.round(e.pos.y),
        hp: Math.max(0, Math.round(e.stats.hp)),
        maxHp: e.stats.maxHp,
        radius: e.radius,
        color: e.color,
        shield: e.currentShield ? Math.max(0, Math.round(e.currentShield)) : 0,
        maxShield: e.traits?.shield ?? 0,
      })),
      operators: this.operators.map(o => ({
        id: o.id,
        x: Math.round(o.pos.x),
        y: Math.round(o.pos.y),
        hp: Math.max(0, Math.round(o.stats.hp)),
        maxHp: o.stats.maxHp,
        radius: o.radius,
        color: o.color,
        name: o.name,
      })),
      projectiles: this.projectiles.map(p => ({
        x: Math.round(p.pos.x),
        y: Math.round(p.pos.y),
        color: p.color,
      })),
    };
  }
}

export interface GameStateSnapshot {
  phase: GamePhase;
  money: number;
  lives: number;
  waveIndex: number;
  coreLevel: number;
  combatTimeRemaining: number;
  enemies: { id: string; x: number; y: number; hp: number; maxHp: number; radius: number; color: string; shield?: number; maxShield?: number }[];
  operators: { id: string; x: number; y: number; hp: number; maxHp: number; radius: number; color: string; name: string }[];
  projectiles: { x: number; y: number; color: string }[];
}