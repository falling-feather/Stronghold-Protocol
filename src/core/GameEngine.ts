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
import { Enemy, Operator, OperatorTemplate, SkillInfo, EquipmentItem, Projectile, GamePhase, Direction, AttackType, StatusEffect, StatusStat, PactRuntime, PactSource, PactSelection, EventCard, EventEngineHandle } from '../types';
import { getDistance, moveTowards, checkCollision, isInAttackRange } from './MathUtils';
import { showToast, showAlert, showConfirm } from './ModalSystem';
import { Battlefield, DefenseFormation, buildDefenseField, combineDefenseFormations, buildAssaultField, combineAssaultFormations } from './Battlefield';
import finalAssaultRules from '../../shared/finalAssault.json';
import { EQUIPMENT_DB, equipmentEffect } from '../config/equipmentData';

const pactEffectIds = new Set([
  ...Object.values(PACT_DB).flatMap(def => [...(def.penalty ?? []), ...def.tiers.flatMap(tier => tier.effects)]),
  ...Object.values(RESONANCE_DB).flatMap(def => def.effects),
].map(effect => effect.id));

export interface BenchOperator {
  uid: string;
  templateId: string;
  rank: 1 | 2; // 初始 / 精锐
  equipment?: EquipmentItem[];
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

export interface EscapedEnemy {
  templateId: string;
  hp: number;
  shield?: number;
  leakId?: string;
  ownerId?: string;
}

export interface RoundOutcome {
  round: number;
  complete: boolean;
  lives: number;
  leaks: EscapedEnemy[];
  formation: { deployed: number; activePacts: number; alive: number; operators: Operator[] };
}

export interface FinalAssaultState {
  bossHp: number;
  bossMaxHp: number;
  teamLives: number;
  remainingSeconds: number;
  overtime: number;
  result: 'victory' | 'defeat' | null;
}

export class GameEngine {
  enemies: Enemy[] = [];
  operators: Operator[] = [];
  bench: BenchOperator[] = [];
  equipmentInventory: EquipmentItem[] = [];
  projectiles: Projectile[] = [];
  // v3.18.0：命中闪光（治疗/远程命中视觉反馈）
  hitFlashes: { pos: { x: number; y: number }; color: string; ttl: number; maxTtl: number }[] = [];
  
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
  onRoundFinished: ((outcome: RoundOutcome) => void) | null = null;
  onDefenseFinished: ((survivors: EscapedEnemy[]) => void) | null = null;
  onEliminated: ((earned: number) => void) | null = null;
  onFinalDamage: ((damage: number) => void) | null = null;
  onFinalLeak: (() => void) | null = null;
  isDefense = false;
  isFinalAssault = false;
  finalState: FinalAssaultState | null = null;
  battlefield: Battlefield | null = null;

  private enemiesToSpawn: number = 0;
  private spawnTimer: number = 0;
  private spawnInterval: number = 0;
  private currentEnemyId: string = '';
  private currentWaveReward: number = 0;
  private escapedEnemies: EscapedEnemy[] = [];
  private defenseQueue: EscapedEnemy[] = [];
  private ownOperatorsBeforeDefense: Operator[] | null = null;
  private assaultRoutes: { x: number; y: number }[][] = [];
  private assaultNetworked = false;
  private assaultElapsed = 0;
  private pendingOutcome: RoundOutcome | null = null;
  private settled = false;
  private nextOperatorId = 0;
  private nextEquipmentId = 0;
  
  // 战斗时间限制
  public combatTimeLimit: number = 0; // 当前波次的战斗时间限制（秒）
  public combatTimeRemaining: number = 0; // 剩余时间（秒）

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

  update(dt: number, realDt: number = dt) {
    if (this.phase === 'COMBAT') {
      if (this.isFinalAssault) {
        if (!this.assaultNetworked && this.finalState) {
          this.assaultElapsed += realDt;
          const overtime = Math.min(finalAssaultRules.maxOvertimeSeconds,
            Math.max(0, Math.floor(this.assaultElapsed - finalAssaultRules.timeLimitSeconds)));
          this.finalState.teamLives = Math.max(0, this.finalState.teamLives - (overtime - this.finalState.overtime));
          this.finalState.overtime = overtime;
          this.finalState.remainingSeconds = Math.max(0, Math.ceil(finalAssaultRules.timeLimitSeconds - this.assaultElapsed));
          this.combatTimeRemaining = this.finalState.remainingSeconds;
          this.lives = this.finalState.teamLives;
          if (this.lives <= 0 || overtime >= finalAssaultRules.maxOvertimeSeconds) {
            this.finishFinalAssault('defeat');
            return;
          }
        }
      } else {
        this.combatTimeRemaining -= dt;
        if (this.combatTimeRemaining <= 0) {
          this.handleTimeUp();
          return;
        }
      }

      for (const op of this.operators) {
        if (!op.isRetreated) op.skillAutoCooldown = Math.max(0, op.skillAutoCooldown - dt);
      }
      
      this.handleSpawning(dt);
      this.updateBlocking();
      this.updateEnemies(dt);
      this.updateOperators(dt);
      this.updateProjectiles(dt);
      // v3.18.0：命中闪光 ttl 衰减
      this.hitFlashes = this.hitFlashes.filter(f => { f.ttl -= dt; return f.ttl > 0; });
      if (!this.isDefense && !this.isFinalAssault) this.tickPactDecay(dt);
    }
    
    this.cleanup();

    if (this.phase === 'COMBAT' && !this.isFinalAssault) {
      this.checkCombatEnd();
    }
  }
  
  private handleTimeUp() {
    for (const enemy of this.enemies) {
      if (!enemy.markedForDeletion) this.recordEscape(enemy);
      enemy.markedForDeletion = true;
    }
    if (this.isDefense) {
      this.escapedEnemies.push(...this.defenseQueue);
      this.defenseQueue = [];
    } else {
      const template = ENEMY_DB[this.currentEnemyId];
      if (template) for (let i = 0; i < this.enemiesToSpawn; i++) {
        this.escapedEnemies.push({ templateId: this.currentEnemyId, hp: template.stats.maxHp, shield: template.traits?.shield ?? 0 });
      }
    }
    this.enemiesToSpawn = 0;
    this.endCombat();
  }

  // === 战斗流程 ===
  async tryStartCombat(): Promise<boolean> {
    if (!await this.confirmStartCombat()) return false;
    return this.startCombat();
  }

  async confirmStartCombat(): Promise<boolean> {
    if (this.phase === 'COMBAT' || this.settled) return false;

    if (this.money > 0) {
      const ok = await showConfirm(
        '资金未花完',
        `还有资金 ${this.money} 未花费。\n战斗开始将回收资金！\n确认开始？`,
        { okLabel: '开始战斗', cancelLabel: '再考虑', danger: true },
      );
      if (!ok) return false;
    }

    return true;
  }

  startCombat(): boolean {
    if (this.phase === 'COMBAT' || this.settled) return false;
    if (this.waveIndex < WAVES.length) {
      const waveConfig = WAVES[this.waveIndex];
      this.enemiesToSpawn = waveConfig.count;
      this.escapedEnemies = [];
      this.isDefense = false;
      this.spawnTimer = 0;
      this.spawnInterval = waveConfig.interval;
      this.currentEnemyId = waveConfig.enemyId;
      this.currentWaveReward = waveConfig.reward;
      
      // 根据波次难度设置战斗时间（60-90秒）
      // 波次越难，时间越短
      const difficultyFactor = Math.min(this.waveIndex / WAVES.length, 1);
      this.combatTimeLimit = 90 - (difficultyFactor * 30); // 90秒到60秒
      this.combatTimeRemaining = this.combatTimeLimit;
      
      this.money = 0;
      this.phase = 'COMBAT';
      for (const op of this.operators) op.skillAutoCooldown = 3;
      this.notifyUpdate(); // 触发UI隐藏底部
      return true;
    } else {
      return this.startFinalAssault([{ playerId: 'solo', operators: this.operators }], {
        bossHp: finalAssaultRules.healthPerPlayer, bossMaxHp: finalAssaultRules.healthPerPlayer,
        teamLives: this.lives, remainingSeconds: finalAssaultRules.timeLimitSeconds, overtime: 0, result: null,
      }, false);
    }
  }

  startFinalAssault(formations: DefenseFormation[], state: FinalAssaultState, networked: boolean): boolean {
    if (this.phase !== 'PREP' || this.settled || formations.length < 1 || formations.length > 2) return false;
    this.ownOperatorsBeforeDefense = this.operators;
    const { field, routes } = buildAssaultField(MAP_LAYOUT, PATH_WAYPOINTS, formations.length);
    this.battlefield = field;
    this.assaultRoutes = routes;
    this.operators = combineAssaultFormations(formations);
    this.enemies = [];
    this.projectiles = [];
    this.enemiesToSpawn = finalAssaultRules.escortCount;
    this.spawnTimer = 0;
    this.spawnInterval = finalAssaultRules.escortIntervalSeconds;
    this.isFinalAssault = true;
    this.assaultNetworked = networked;
    this.assaultElapsed = 0;
    this.finalState = { ...state };
    this.lives = state.teamLives;
    this.combatTimeLimit = finalAssaultRules.timeLimitSeconds;
    this.combatTimeRemaining = state.remainingSeconds;
    this.money = 0;
    this.phase = 'COMBAT';
    for (const [index, route] of routes.entries()) {
      const start = route[0];
      this.spawnEnemy(finalAssaultRules.bossId, { x: start.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
        y: start.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2, gridX: start.x, gridY: start.y, waypointIndex: 0 });
      const boss = this.enemies[this.enemies.length - 1];
      boss.assaultRoute = index;
      boss.assaultBoss = true;
      boss.stats.hp = state.bossHp;
      boss.stats.maxHp = state.bossMaxHp;
    }
    this.notifyUpdate();
    return true;
  }

  updateFinalState(state: FinalAssaultState): void {
    this.finalState = { ...state };
    this.lives = state.teamLives;
    this.combatTimeRemaining = state.remainingSeconds;
    for (const boss of this.enemies) if (boss.assaultBoss) {
      boss.stats.hp = state.bossHp;
      boss.stats.maxHp = state.bossMaxHp;
    }
    this.notifyUpdate();
  }

  finishFinalAssault(result: 'victory' | 'defeat'): void {
    if (this.settled) return;
    this.settled = true;
    this.phase = 'PREP';
    this.isFinalAssault = false;
    this.enemies = [];
    this.projectiles = [];
    if (this.ownOperatorsBeforeDefense) this.operators = this.ownOperatorsBeforeDefense;
    this.ownOperatorsBeforeDefense = null;
    this.battlefield = null;
    this.assaultRoutes = [];
    if (result === 'victory') {
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
      showAlert('全域威胁已清除', `获得碎片：+${earned}\n（含通关奖励 50 + 每史诗事件 +15）${dailyMsg}`);
    } else {
      const epicCount = this.eventHistory.filter(h => h.rarity === 'epic').length;
      const earned = calcShardsForRun({ wavesCleared: this.waveIndex, victory: false, epicEventsTriggered: epicCount });
      addShards(earned);
      playSfx('wave_fail');
      showAlert('最终攻势失败', `共同目标生命已耗尽。\n获得碎片：+${earned}`);
    }
    this.notifyUpdate();
  }

  private checkCombatEnd() {
    if (this.phase === 'COMBAT' && this.enemiesToSpawn <= 0 && this.enemies.length === 0) {
      this.endCombat();
    }
  }

  private endCombat() {
    this.phase = 'PREP';
    this.enemies = [];
    this.projectiles = [];
    this.enemiesToSpawn = 0;
    if (this.isDefense) {
      const survivors = this.escapedEnemies.slice();
      this.isDefense = false;
      this.escapedEnemies = [];
      if (this.ownOperatorsBeforeDefense) this.operators = this.ownOperatorsBeforeDefense;
      this.ownOperatorsBeforeDefense = null;
      this.battlefield = null;
      this.notifyUpdate();
      this.onDefenseFinished?.(survivors);
      return;
    }

    const outcome: RoundOutcome = {
      round: this.waveIndex,
      complete: this.waveIndex + 1 >= WAVES.length,
      lives: this.lives,
      leaks: this.escapedEnemies.slice(),
      formation: this.getFormationSnapshot(),
    };
    this.pendingOutcome = outcome;
    this.notifyUpdate();
    if (this.onRoundFinished) this.onRoundFinished(outcome);
    else this.settleRound(outcome.leaks.length);
  }

  getFormationSnapshot(): RoundOutcome['formation'] {
    return {
      deployed: this.operators.length,
      activePacts: this.pacts.filter(pact => pact.appliedTier >= 0).length,
      alive: this.operators.filter(op => !op.isRetreated && !op.markedForDeletion).length,
      operators: structuredClone(this.operators),
    };
  }

  startDefense(enemies: EscapedEnemy[], formations: DefenseFormation[] = [{ playerId: 'self', operators: this.operators }]): boolean {
    if (this.phase !== 'PREP' || !this.pendingOutcome || enemies.length === 0 ||
        formations.length < 1 || formations.length > 2 ||
        enemies.some(enemy => !ENEMY_DB[enemy.templateId] || !enemy.leakId || !enemy.ownerId)) return false;
    this.ownOperatorsBeforeDefense = this.operators;
    this.battlefield = buildDefenseField(MAP_LAYOUT, PATH_WAYPOINTS, formations.length);
    this.operators = combineDefenseFormations(formations);
    this.isDefense = true;
    this.escapedEnemies = [];
    this.defenseQueue = enemies.map(enemy => ({ ...enemy }));
    this.enemiesToSpawn = enemies.length;
    this.spawnInterval = 1.5;
    this.spawnTimer = this.spawnInterval;
    this.combatTimeRemaining = this.combatTimeLimit;
    this.phase = 'COMBAT';
    this.notifyUpdate();
    return true;
  }

  settleRound(loss: number): void {
    const outcome = this.pendingOutcome;
    if (!outcome) return;
    this.pendingOutcome = null;
    this.lives = Math.max(0, this.lives - Math.min(10, Math.max(0, Math.floor(loss))));
    if (this.lives <= 0) {
      this.notifyUpdate();
      this.cleanup();
      return;
    }

    this.waveIndex++;
    this.money += this.currentWaveReward;
    if (this.activeBoonId === 'boon_wave_bonus') this.money += 15;
    this.combatTimeRemaining = 0;
    this.combatTimeLimit = 0;
    this.onPactEvent('wave_clear');
    if (outcome.leaks.length === 0) this.onPactEvent('wave_perfect');
    addShards(4 + (outcome.leaks.length === 0 ? 2 : 0));
    playSfx('wave_clear');
    bumpStat('totalWavesCleared', 1);
    setStatMax('maxResonanceInRun', this.activeResonances.size);
    this.checkAndAnnounceAchievements();

    this.operators.forEach(op => {
      op.stats.hp = op.stats.maxHp;
      op.isRetreated = false;
      op.blockingEnemyIds = [];
      op.cooldown = 0;
      op.currentSp = this.initialSkillSp(OPERATOR_DB[op.templateId], op.rank, op.skill);
      op.skillActive = false;
      op.skillDuration = 0;
      op.effects = [
        ...op.effects.filter(effect => effect.duration < 0 && !pactEffectIds.has(effect.id)),
        ...this.getActivePactEffectsForOperator(),
      ];
    });
    this.refreshShop(true);
    if (!this.pendingEvent) {
      const boonChance = this.activeBoonId === 'boon_event_chance' ? 0.2 : 0;
      const forceFirst = this.activeBoonId === 'boon_double_first_event' && this.eventHistory.length === 0;
      const chance = forceFirst ? 1 : (EVENT_TRIGGER_CHANCE + getEventChanceBonus() + boonChance);
      this.pendingEvent = rollEvent(this.waveIndex, this.eventHistory, chance);
    }
    showToast(`第 ${this.waveIndex} 波完成 · +${this.currentWaveReward} 资金`, { level: 'success' });
    this.notifyUpdate();
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
          // v3.14.0：允许负值（事件代价），下界 clamp 到 0
          op.currentSp = Math.max(0, Math.min(op.skill.cost, op.currentSp + amount));
        }
        self.notifyUpdate();
      },
      // v3.17.0：野战医院事件 — 全员 hp 回满
      healAllOperatorsFull: () => {
        for (const op of self.operators) {
          if (op.isRetreated) continue;
          op.stats.hp = op.stats.maxHp;
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

  addEquipment(templateId: string): EquipmentItem | null {
    if (!EQUIPMENT_DB[templateId]) return null;
    const item: EquipmentItem = { uid: `equipment_${++this.nextEquipmentId}`, templateId, rank: 1 };
    this.equipmentInventory.push(item);
    this.mergeEquipment(templateId);
    this.notifyUpdate();
    return item;
  }

  private mergeEquipment(templateId: string): void {
    const candidates: { item: EquipmentItem; holder: Operator | BenchOperator | null }[] = [];
    for (const item of this.equipmentInventory) if (item.templateId === templateId && item.rank === 1) candidates.push({ item, holder: null });
    for (const holder of [...this.bench, ...this.operators]) {
      for (const item of holder.equipment ?? []) if (item.templateId === templateId && item.rank === 1) candidates.push({ item, holder });
    }
    if (candidates.length < 2) return;
    for (const { item, holder } of candidates.slice(0, 2)) {
      if (!holder) this.equipmentInventory = this.equipmentInventory.filter(entry => entry.uid !== item.uid);
      else {
        holder.equipment = holder.equipment?.filter(entry => entry.uid !== item.uid);
        if ('effects' in holder) holder.effects = holder.effects.filter(effect => effect.id !== `equipment_${item.uid}`);
      }
    }
    this.equipmentInventory.push({ uid: `equipment_${++this.nextEquipmentId}`, templateId, rank: 2 });
  }

  equipOperator(operatorId: string, equipmentUid: string): boolean {
    return this.equipToHolder(this.operators.find(operator => operator.id === operatorId), equipmentUid);
  }

  equipBenchOperator(benchUid: string, equipmentUid: string): boolean {
    return this.equipToHolder(this.bench.find(operator => operator.uid === benchUid), equipmentUid);
  }

  private equipToHolder(holder: Operator | BenchOperator | undefined, equipmentUid: string): boolean {
    if (this.phase !== 'PREP' || this.settled) return false;
    const index = this.equipmentInventory.findIndex(item => item.uid === equipmentUid);
    if (!holder || index < 0 || (holder.equipment?.length ?? 0) >= 2) return false;
    const [item] = this.equipmentInventory.splice(index, 1);
    holder.equipment = [...(holder.equipment ?? []), item];
    if ('effects' in holder) holder.effects.push(equipmentEffect(item));
    this.notifyUpdate();
    return true;
  }

  recoverEquipment(holder: Operator | BenchOperator): void {
    const items = holder.equipment ?? [];
    if (!items.length) return;
    this.equipmentInventory.push(...items);
    if ('effects' in holder) {
      const ids = new Set(items.map(item => `equipment_${item.uid}`));
      holder.effects = holder.effects.filter(effect => !ids.has(effect.id));
    }
    holder.equipment = [];
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

  private initialSkillSp(template: OperatorTemplate, rank: 1 | 2, skill: SkillInfo): number {
    const talentSp = template.talents.reduce((sum, talent) => talent.effect === 'sp_init'
      ? sum + (rank === 2 ? talent.rankValues.rank2 : talent.rankValues.rank1) : sum, 0);
    const boonSp = this.activeBoonId === 'boon_starting_sp' ? 15 : 0;
    return Math.min(skill.cost, skill.initialSp + talentSp + getStartingSpBonus() + boonSp);
  }

  // 撤回战场上的角色回备战区
  recallOperator(operatorId: string): boolean {
    if (!this.operators.some(op => op.id === operatorId)) return false;

    if (this.bench.length >= CONFIG.MAX_BENCH_SIZE) {
        showToast('备战区已满，无法撤回！', { level: 'warn' });
        return false;
    }

    const op = this.removeOperatorFromField(operatorId)!;
    // 加回备战区（撤回时保留等阶，但不保留朝向）
    this.bench.push({
        uid: `bench_${Date.now()}_${Math.random()}`,
        templateId: op.templateId,
        rank: op.rank || 1,
        equipment: op.equipment ?? [],
    });

    this.notifyUpdate();
    return true;
  }

  // 撤回和合并共用场上移除逻辑；调用方负责后续放置和通知。
  removeOperatorFromField(operatorId: string): Operator | null {
    const index = this.operators.findIndex(op => op.id === operatorId);
    if (index === -1) return null;
    const op = this.operators[index];
    // 处理阻挡逻辑：释放被阻挡的敌人
    op.blockingEnemyIds.forEach(eid => {
        const enemy = this.enemies.find(e => e.id === eid);
        if (enemy) enemy.isBlockedBy = null;
    });

    // 从战场移除
    this.operators.splice(index, 1);
    return op;
  }

  promoteDeployedOperator(operatorId: string): void {
    const op = this.operators.find(operator => operator.id === operatorId);
    if (!op) return;
    const template = OPERATOR_DB[op.templateId];
    const talentIds = new Set(buildTalentEffects(template.talents, op.rank, op.templateId).map(effect => effect.id));
    op.effects = [
      ...op.effects.filter(effect => effect.duration < 0 && !talentIds.has(effect.id)),
      ...buildTalentEffects(template.talents, 2, op.templateId),
    ];
    op.rank = 2;
    op.stats = applyTalentsToStats(template.eliteStats ?? template.stats, template.talents, 2);
    op.skill = resolveSkillForRank(template, 2);
    op.currentSp = this.initialSkillSp(template, 2, op.skill);
    op.skillActive = false;
    op.skillDuration = 0;
    op.skillAutoCooldown = 3;
    op.cooldown = 0;
    op.isRetreated = false;
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
    const equipment = this.bench[benchIndex].equipment ?? [];

    // 从备战区移除
    this.bench.splice(benchIndex, 1);

    // 部署角色 — 使用 v1.2 体系：天赋叠加到属性，技能按 rank 解析
    const finalStats = applyTalentsToStats(rank === 2 ? template.eliteStats ?? template.stats : template.stats, template.talents, rank);
    const skillInfo = resolveSkillForRank(template, rank);

    this.operators.push({
      id: `op_${++this.nextOperatorId}`,
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
      tier: template.tier,
      rarity: template.rarity,
      markedForDeletion: false,
      blockingEnemyIds: [],
      isRetreated: false,
      skill: skillInfo,
      currentSp: this.initialSkillSp(template, rank, skillInfo),
      skillActive: false,
      skillDuration: 0,
      skillAutoCooldown: 3,
      equipment,
      rank: rank,
      direction: direction,
      deployTime: 0,
      costRefunded: false,
      effects: [...buildTalentEffects(template.talents, rank, templateId), ...this.getActivePactEffectsForOperator(), ...equipment.map(equipmentEffect)]
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
      if (enemy.markedForDeletion) return;
      if (enemy.traits?.flying || enemy.traits?.unblockable) return;
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
        if (this.isFinalAssault) {
          for (const [index, route] of this.assaultRoutes.entries()) {
            const start = route[0];
            this.spawnEnemy(finalAssaultRules.escortEnemyId, { x: start.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
              y: start.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2, gridX: start.x, gridY: start.y, waypointIndex: 0 });
            this.enemies[this.enemies.length - 1].assaultRoute = index;
          }
        } else {
          const escaped = this.isDefense ? this.defenseQueue.shift() : undefined;
          this.spawnEnemy(escaped?.templateId, undefined, escaped);
        }
        this.spawnTimer = 0;
        this.enemiesToSpawn--;
      }
    }
  }

  private spawnEnemy(enemyId?: string, atPos?: { x: number; y: number; gridX: number; gridY: number; waypointIndex: number }, escaped?: EscapedEnemy) {
    const id = enemyId ?? this.currentEnemyId;
    const template = ENEMY_DB[id as keyof typeof ENEMY_DB];
    if (!template) return;
    const startNode = (this.battlefield?.waypoints ?? PATH_WAYPOINTS)[0];
    const px = atPos?.x ?? (startNode.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2);
    const py = atPos?.y ?? (startNode.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2);
    const gx = atPos?.gridX ?? startNode.x;
    const gy = atPos?.gridY ?? startNode.y;
    const wpi = atPos?.waypointIndex ?? 0;
    this.enemies.push({
      id: `en_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      templateId: id,
      leakId: escaped?.leakId,
      ownerId: escaped?.ownerId,
      pos: { x: px, y: py },
      gridPos: { x: gx, y: gy },
      radius: template.radius,
      color: template.color,
      stats: { ...template.stats, hp: escaped ? Math.min(template.stats.maxHp, escaped.hp) : template.stats.hp },
      waypointIndex: wpi,
      markedForDeletion: false,
      isBlockedBy: null,
      attackCooldown: 0,
      effects: [],
      traits: template.traits,
      bossPhaseTriggered: false,
      // v3.10.0：护盾初始化
      currentShield: escaped?.shield ?? template.traits?.shield ?? 0,
    });
  }

  private recordEscape(enemy: Enemy): void {
    if (this.isDefense && !enemy.leakId) return;
    this.escapedEnemies.push({ templateId: enemy.templateId, hp: Math.max(1, enemy.stats.hp),
      shield: enemy.currentShield ?? 0, leakId: enemy.leakId, ownerId: enemy.ownerId });
  }

  private updateEnemies(dt: number) {
    this.enemies.forEach(enemy => {
      if (enemy.markedForDeletion) return;
      // v2.3.0：状态效果倒计时
      this.tickEffects(enemy.effects, dt);
      if (enemy.traits?.regeneratePerSecond) {
        enemy.stats.hp = Math.min(enemy.stats.maxHp, enemy.stats.hp + enemy.traits.regeneratePerSecond * dt);
      }
      // v3.17.0：治疗光环 — 每秒对半径内同盟敌人 +perSec hp（capped maxHp）
      if (enemy.traits?.healAura) {
        const aura = enemy.traits.healAura;
        const radiusPx = aura.radiusTiles * CONFIG.TILE_SIZE;
        const heal = aura.perSec * dt;
        this.enemies.forEach(other => {
          if (other === enemy || other.markedForDeletion) return;
          if (getDistance(enemy.pos, other.pos) > radiusPx) return;
          other.stats.hp = Math.min(other.stats.maxHp, other.stats.hp + heal);
        });
      }
      // v2.4.0：Boss 阶段触发
      if (enemy.traits?.bossPhase && !enemy.bossPhaseTriggered &&
          enemy.stats.hp > 0 && enemy.stats.hp <= enemy.stats.maxHp * enemy.traits.bossPhase.atHpPct) {
        enemy.bossPhaseTriggered = true;
        const eff = enemy.traits.bossPhase.effect;
        enemy.effects.push({ ...eff, remaining: eff.duration });
      }
      // v3.17.0：远程攻击 — 不需要 block，周期对 range 内最近 operator 扣 hp
      if (!enemy.isBlockedBy && enemy.traits?.ranged) {
        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0) {
          const radiusPx = enemy.traits.ranged.rangeTiles * CONFIG.TILE_SIZE;
          let nearest: Operator | null = null;
          let minDist = Infinity;
          this.operators.forEach(op => {
            if (op.isRetreated || op.markedForDeletion) return;
            const opCenter = { x: op.pos.x + CONFIG.TILE_SIZE/2, y: op.pos.y + CONFIG.TILE_SIZE/2 };
            const d = getDistance(enemy.pos, opCenter);
            if (d <= radiusPx && d < minDist) { minDist = d; nearest = op; }
          });
          if (nearest) {
            const target = nearest as Operator;
            const enemyAtk = this.modifyStat(enemy.effects, enemy.stats.atk, 'atk');
            // v3.17.1：发射可视弹道（projectile 飞向目标后再扣 hp）
            this.projectiles.push({
              id: `eproj_${Date.now()}_${Math.random()}`,
              pos: { x: enemy.pos.x, y: enemy.pos.y },
              targetId: target.id,
              speed: 600,
              damage: enemyAtk,
              color: '#e67e22',
              markedForDeletion: false,
              atkType: 'physical',
              targetIsOperator: true,
              sourceEnemyId: enemy.id,
            });
            enemy.attackCooldown = this.modifyStat(enemy.effects, enemy.stats.aspd, 'aspd');
          } else {
            enemy.attackCooldown = 0.2; // 没目标，短促重试
          }
        }
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
            this.receiveOperatorDamage(blocker, damage);
            enemy.attackCooldown = this.modifyStat(enemy.effects, enemy.stats.aspd, 'aspd');
          }
        }
        return;
      }
      const route = enemy.assaultRoute !== undefined ? this.assaultRoutes[enemy.assaultRoute] : (this.battlefield?.waypoints ?? PATH_WAYPOINTS);
      const targetGrid = route[enemy.waypointIndex + 1];
      if (!targetGrid) {
        if (enemy.assaultBoss) return;
        if (this.isFinalAssault && enemy.assaultRoute !== undefined) {
          if (this.onFinalLeak) this.onFinalLeak();
          else if (this.finalState) {
            this.updateFinalState({ ...this.finalState, teamLives: Math.max(0, this.finalState.teamLives - 1) });
            if (this.finalState.teamLives <= 0) this.finishFinalAssault('defeat');
          }
          enemy.markedForDeletion = true;
          return;
        }
        this.recordEscape(enemy);
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

  private receiveOperatorDamage(op: Operator, damage: number): void {
    op.stats.hp -= damage;
    const recoveryType = op.skill.spRecovery;
    if (!op.skillActive && (recoveryType === 'defense' || recoveryType === 'auto_defense' ||
        recoveryType === 'attack_defense' || recoveryType === 'all')) {
      op.currentSp = Math.min(op.skill.cost, op.currentSp + 1);
    }
    if (op.stats.hp <= 0) {
      this.handleOperatorRetreat(op);
    } else if (OPERATOR_DB[op.templateId]?.class === 'defender' && op.skillAutoCooldown <= 0) {
      this.tryActivateSkill(op.id);
    }
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
      if (op.skillActive && op.skill.duration > 0) {
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

      if (op.skillActive && op.skill.values.stopAttack) return;

      if (op.cooldown <= 0) {
        const opTemplate = OPERATOR_DB[op.templateId];
        // v3.16.0：medic 寻友军（受伤比例最低者）—— 完全独立于敌人寻敌
        if (opTemplate?.class === 'medic') {
          let allyTarget: Operator | null = null;
          let lowestRatio = 1;
          const opCenter = { x: op.pos.x + CONFIG.TILE_SIZE/2, y: op.pos.y + CONFIG.TILE_SIZE/2 };
          this.operators.forEach(ally => {
            if (ally.isRetreated || ally.markedForDeletion) return;
            if (ally.stats.maxHp <= 0) return;
            const ratio = ally.stats.hp / ally.stats.maxHp;
            if (ratio >= 1) return; // 满血跳过（医疗自身可治疗，包括自己）
            const allyCenter = { x: ally.pos.x + CONFIG.TILE_SIZE/2, y: ally.pos.y + CONFIG.TILE_SIZE/2 };
            const dist = getDistance(opCenter, allyCenter);
            if (dist > op.stats.range * CONFIG.TILE_SIZE) return;
            if (ratio < lowestRatio) {
              lowestRatio = ratio;
              allyTarget = ally;
            }
          });
          if (allyTarget) {
            if (op.skillAutoCooldown <= 0) this.tryActivateSkill(op.id);
            if (op.skillActive && op.skill.values.stopAttack) return;
            this.fireHealProjectile(op, allyTarget);
            const aspd = Math.max(0.2, this.modifyStat(op.effects, op.stats.aspd, 'aspd'));
            op.cooldown = aspd;
          }
          return; // medic 本帧攻击逻辑已结束（不打敌人）
        }

        let target: Enemy | null = null;
        if (op.blockingEnemyIds.length > 0) {
          target = this.enemies.find(e => e.id === op.blockingEnemyIds[0] && !e.markedForDeletion) || null;
        }
        if (!target) {
          // 使用基于朝向的攻击范围系统
          // v2.4.0：隐身/飞行过滤
          const canHitFlying = op.placement === 'high_ground';
          const canHitStealth = opTemplate?.class === 'specialist';
          const preferFlying = opTemplate?.targetPriority === 'flying';
          let bestIsFlying = false;
          let minDist = Infinity;
          this.enemies.forEach(enemy => {
            if (enemy.markedForDeletion) return;
            if (enemy.traits?.flying && !canHitFlying) return;
            if (enemy.traits?.stealth && !canHitStealth) return;
            if (isInAttackRange(op.gridPos, op.direction, op.placement, op.stats.range, enemy.pos, CONFIG.TILE_SIZE)) {
              const opCenter = { x: op.pos.x + CONFIG.TILE_SIZE/2, y: op.pos.y + CONFIG.TILE_SIZE/2 };
              const dist = getDistance(opCenter, enemy.pos);
              const isFlying = !!enemy.traits?.flying;
              if ((preferFlying && isFlying && !bestIsFlying) ||
                  ((!preferFlying || isFlying === bestIsFlying) && dist < minDist)) {
                minDist = dist;
                bestIsFlying = isFlying;
                target = enemy;
              }
            }
          });
        }
        if (target) {
          // 重装的自动技能由受击触发；其余干员在即将攻击时尝试开启。
          if (opTemplate?.class !== 'defender' && op.skillAutoCooldown <= 0) this.tryActivateSkill(op.id);
          if (op.skillActive && op.skill.values.stopAttack) return;
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
    const skillActive = source.skillActive;
    const instant = skillActive && source.skill.duration <= 0;
    if (instant) {
      damage = Math.round(damage * ((source.skill.values.atkMul ?? 1) + (source.skill.values.atkPct ?? 0) / 100));
    }

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

    const hits = instant && source.skill.effectType === 'multistrike' ? Math.max(1, Math.floor(source.skill.values.hits ?? 1)) : 1;
    const splashRadius = skillActive && source.skill.effectType === 'aoe' && !source.skill.values.targets
      ? (source.skill.values.radius ?? 0) * CONFIG.TILE_SIZE : 0;
    const targetLimit = skillActive ? Math.max(1, Math.floor(source.skill.values.targets ?? 1)) : 1;
    const extraTargets = targetLimit > 1 ? this.enemies.filter(enemy =>
      enemy !== target && !enemy.markedForDeletion &&
      (!enemy.traits?.flying || source.placement === 'high_ground') &&
      (!enemy.traits?.stealth || sourceTemplate?.class === 'specialist') &&
      isInAttackRange(source.gridPos, source.direction, source.placement, source.stats.range, enemy.pos, CONFIG.TILE_SIZE)
    ).sort((a, b) => getDistance(startPos, a.pos) - getDistance(startPos, b.pos)).slice(0, targetLimit - 1) : [];
    for (const skillTarget of [target, ...extraTargets]) for (let hit = 0; hit < hits; hit++) this.projectiles.push({
      id: `proj_${Date.now()}_${Math.random()}`,
      pos: startPos,
      targetId: skillTarget.id,
      speed: 600,
      damage,
      color: source.skillActive ? '#f1c40f' : baseColor,
      markedForDeletion: false,
      atkType,
      sourceId: source.id,
      sourceClass: sourceTemplate?.class,
      splashRadius,
    });

    if (instant) {
      source.skillActive = false;
      source.currentSp = 0;
    }

    // 攻击回复技力（每次攻击+1点）；激活期间不再累计
    const recoveryType = source.skill.spRecovery;
    if (!skillActive && (recoveryType === 'attack' || recoveryType === 'auto_attack' ||
        recoveryType === 'attack_defense' || recoveryType === 'all')) {
      source.currentSp = Math.min(source.skill.cost, source.currentSp + 1);
    }
  }

  // v3.16.0：medic 治疗弹（target 为友军 operator）
  private fireHealProjectile(source: Operator, target: Operator) {
    const startPos = { x: source.pos.x + CONFIG.TILE_SIZE / 2, y: source.pos.y + CONFIG.TILE_SIZE / 2 };
    let healAmount = source.stats.atk;
    healAmount = Math.round(this.modifyStat(source.effects, healAmount, 'atk'));
    this.projectiles.push({
      id: `proj_heal_${Date.now()}_${Math.random()}`,
      pos: startPos,
      targetId: target.id,
      speed: 700,
      damage: healAmount,
      color: source.skillActive ? '#f1c40f' : '#2ecc71',
      markedForDeletion: false,
      atkType: 'heal',
      sourceId: source.id,
      sourceClass: 'medic',
      targetIsAlly: true,
    });
    const recoveryType = source.skill.spRecovery;
    if (!source.skillActive && (recoveryType === 'attack' || recoveryType === 'auto_attack' ||
        recoveryType === 'attack_defense' || recoveryType === 'all')) {
      source.currentSp = Math.min(source.skill.cost, source.currentSp + 1);
    }
  }

  // 激活技能，自动操作的冷却时间从成功开启时开始计算。
  tryActivateSkill(operatorId: string): boolean {
    const op = this.operators.find(o => o.id === operatorId);
    if (!op || op.isRetreated) return false;
    if (op.skillActive) return false;
    if (op.currentSp < op.skill.cost) return false;
    op.skillActive = true;
    op.skillDuration = op.skill.duration;
    op.skillAutoCooldown = 3;
    if (op.skill.duration > 0) {
      const values = op.skill.values;
      const bonuses: { stat: StatusStat; label: string; mod: number; modType: 'flat' | 'pct' }[] = [
        { stat: 'atk', label: '攻击', mod: (values.atkMul ?? 1) - 1 + (values.atkPct ?? 0) / 100, modType: 'pct' },
        { stat: 'aspd', label: '攻速', mod: -(values.aspdPct ?? 0) / 100, modType: 'pct' },
        { stat: 'def', label: '防御', mod: (values.defPct ?? 0) / 100, modType: 'pct' },
        { stat: 'blockCount', label: '阻挡', mod: values.blkPlus ?? 0, modType: 'flat' },
      ];
      for (const bonus of bonuses) {
        if (!bonus.mod) continue;
        op.effects.push({ id: `skill_${op.id}_${bonus.stat}`, name: `${op.skill.name} · ${bonus.label}`,
          kind: 'buff', stat: bonus.stat, mod: bonus.mod, modType: bonus.modType,
          duration: op.skill.duration, remaining: op.skill.duration, sourceId: op.id });
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
    if (this.isDefense || this.isFinalAssault || this.pacts.length === 0) return;
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
    let equipmentMul = 1;
    for (const e of effects) {
      if (e.stat !== stat) continue;
      if (e.modType === 'pct') {
        if (e.id.startsWith('equipment_')) equipmentMul *= 1 + e.mod;
        else pctMul += e.mod;
      }
    }
    return val * pctMul * equipmentMul;
  }

  private updateProjectiles(dt: number) {
    this.projectiles.forEach(proj => {
      // v3.17.1：敌人远程弹分支（targetIsOperator=true → target 为 operator，命中扣 hp）
      if (proj.targetIsOperator) {
        const op = this.operators.find(o => o.id === proj.targetId);
        if (!op || op.markedForDeletion || op.isRetreated) {
          proj.markedForDeletion = true;
          return;
        }
        const opCenter = { x: op.pos.x + CONFIG.TILE_SIZE/2, y: op.pos.y + CONFIG.TILE_SIZE/2 };
        proj.pos = moveTowards(proj.pos, opCenter, proj.speed * dt);
        if (getDistance(proj.pos, opCenter) < 15) {
          const opDef = this.modifyStat(op.effects, op.stats.def, 'def');
          const damage = Math.max(5, proj.damage - opDef);
          this.receiveOperatorDamage(op, damage);
          // v3.18.0：橙色命中闪光
          this.hitFlashes.push({ pos: { x: opCenter.x, y: opCenter.y }, color: '#e67e22', ttl: 0.25, maxTtl: 0.25 });
          proj.markedForDeletion = true;
        }
        return;
      }
      // v3.16.0：治疗弹分支（targetIsAlly=true → target 为友军 operator）
      if (proj.targetIsAlly) {
        const ally = this.operators.find(o => o.id === proj.targetId);
        if (!ally || ally.markedForDeletion || ally.isRetreated) {
          proj.markedForDeletion = true;
          return;
        }
        const allyCenter = { x: ally.pos.x + CONFIG.TILE_SIZE/2, y: ally.pos.y + CONFIG.TILE_SIZE/2 };
        proj.pos = moveTowards(proj.pos, allyCenter, proj.speed * dt);
        if (getDistance(proj.pos, allyCenter) < 15) {
          // v3.17.1：抗治疗光环 — 全场存在 healSuppress trait 敌人时，治疗量 × mult
          let healAmount = proj.damage;
          const suppressor = this.enemies.find(e => !e.markedForDeletion && e.traits?.healSuppress);
          if (suppressor) healAmount = healAmount * suppressor.traits!.healSuppress!.mult;
          ally.stats.hp = Math.min(ally.stats.maxHp, ally.stats.hp + healAmount);
          // v3.18.0：绿色命中闪光（被压制时颜色变深参考区分）
          this.hitFlashes.push({
            pos: { x: allyCenter.x, y: allyCenter.y },
            color: suppressor ? '#16a085' : '#2ecc71',
            ttl: 0.3, maxTtl: 0.3
          });
          proj.markedForDeletion = true;
        }
        return;
      }

      const target = this.enemies.find(e => e.id === proj.targetId);
      if (!target || target.markedForDeletion) {
        proj.markedForDeletion = true;
        return;
      }
      proj.pos = moveTowards(proj.pos, target.pos, proj.speed * dt);
      if (getDistance(proj.pos, target.pos) < 15) {
        const source = this.operators.find(op => op.id === proj.sourceId);
        const radius = proj.splashRadius ?? 0;
        const splashTargets = radius > 0 ? this.enemies.filter(other =>
          other !== target && !other.markedForDeletion && getDistance(target.pos, other.pos) <= radius &&
          (!other.traits?.flying || source?.placement === 'high_ground') &&
          (!other.traits?.stealth || proj.sourceClass === 'specialist')
        ) : [];
        for (const hitTarget of [target, ...splashTargets]) this.applyProjectileHit(proj, hitTarget);
        proj.markedForDeletion = true;
      }
    });
  }

  private applyProjectileHit(proj: Projectile, target: Enemy): void {
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
    if (this.isFinalAssault && target.assaultBoss) {
      if (finalDamage <= 0 || finalDamage >= finalAssaultRules.damageLimit) return;
      if (this.onFinalDamage) this.onFinalDamage(finalDamage);
      else if (this.finalState) {
        this.updateFinalState({ ...this.finalState, bossHp: Math.max(0, this.finalState.bossHp - finalDamage) });
        if (this.finalState.bossHp <= 0) this.finishFinalAssault('victory');
      }
      return;
    }
    // v3.10.0：先扣护盾，溢出再扣 hp
    let dmgToHp = finalDamage;
    if ((target.currentShield ?? 0) > 0 && proj.atkType !== 'heal') {
      const absorbed = Math.min(target.currentShield!, finalDamage);
      target.currentShield = (target.currentShield ?? 0) - absorbed;
      dmgToHp = finalDamage - absorbed;
    }
    target.stats.hp -= dmgToHp;
    // v3.16.0：supporter 命中附加减速（aspd/spd 各 -25%，1.8s，覆盖刷新）
    if (proj.sourceClass === 'supporter' && proj.atkType !== 'heal' && finalDamage > 0) {
      const SLOW_DUR = 1.8;
      const exist = target.effects.find(e => e.id === 'supporter_slow_spd');
      if (exist) {
        exist.remaining = SLOW_DUR;
        const existAspd = target.effects.find(e => e.id === 'supporter_slow_aspd');
        if (existAspd) existAspd.remaining = SLOW_DUR;
      } else {
        target.effects.push({
          id: 'supporter_slow_spd', name: '辅助·减速', kind: 'debuff',
          stat: 'spd', mod: -0.25, modType: 'pct',
          duration: SLOW_DUR, remaining: SLOW_DUR,
        });
        target.effects.push({
          id: 'supporter_slow_aspd', name: '辅助·迟缓', kind: 'debuff',
          stat: 'aspd', mod: 0.25, modType: 'pct',
          duration: SLOW_DUR, remaining: SLOW_DUR,
        });
      }
    }
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
    if (target.stats.hp <= 0 && !target.markedForDeletion) {
      target.markedForDeletion = true;
      if (target.isBlockedBy) {
        const blocker = this.operators.find(op => op.id === target.isBlockedBy);
        if (blocker) blocker.blockingEnemyIds = blocker.blockingEnemyIds.filter(id => id !== target.id);
      }
      // v3.0.0：盟约击杀事件
      this.onPactEvent('kill_any');
      // v3.13.0：boon 赏金猟人 — 每击杀 +1 资金
      if (this.activeBoonId === 'boon_kill_bounty') this.money += 1;
      // v3.16.0：vanguard 击杀回 +1 资金（先锋差异化：持续生费）
      if (proj.sourceClass === 'vanguard') this.money += 1;
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

  private cleanup() {
    this.enemies = this.enemies.filter(e => !e.markedForDeletion);
    this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
    if (this.lives <= 0 && !this.settled && !this.finalState) {
      this.settled = true;
      // v3.6.0：失败时结算碎片
      const epicCount = this.eventHistory.filter(h => h.rarity === 'epic').length;
      const earned = calcShardsForRun({ wavesCleared: this.waveIndex, victory: false, epicEventsTriggered: epicCount });
      addShards(earned);
      this.checkAndAnnounceAchievements();
      playSfx('wave_fail');
      if (this.onEliminated) this.onEliminated(earned);
      else showAlert('任务失败', `清剿波次：${this.waveIndex}\n获得碎片：+${earned}\n点击确认后页面将刷新。`).then(() => location.reload());
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
      setTimeout(() => showAlert('★ 成就解锁 ★', `${lines.join('\n')}${totalReward ? `\n\n累计奖励：+${totalReward} 碎片` : ''}`), 50);
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
      battlefield: this.battlefield,
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
        templateId: o.templateId,
        rank: o.rank,
        direction: o.direction,
        isRetreated: o.isRetreated,
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
  battlefield: Battlefield | null;
  enemies: { id: string; x: number; y: number; hp: number; maxHp: number; radius: number; color: string; shield?: number; maxShield?: number }[];
  operators: { id: string; templateId: string; x: number; y: number; hp: number; maxHp: number; radius: number; color: string; name: string; rank: 1 | 2; direction: Direction; isRetreated: boolean }[];
  projectiles: { x: number; y: number; color: string }[];
}
