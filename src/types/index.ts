export interface Vector2 {
  x: number;
  y: number;
}

export type TileType = 0 | 1 | 2 | 3 | 4;
export type GamePhase = 'PREP' | 'COMBAT';
export type PlacementType = 'ground' | 'high_ground';
export type Direction = 'up' | 'down' | 'left' | 'right'; // 朝向：上、下、左、右

export interface BaseStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  range: number;
  aspd: number;
  blockCount: number;
  magicResist?: number; // v2.1.0：魔法抗性，0-100，仅敌人需要；缺省视作 0
}

// v2.1.0：攻击类型（决定伤害结算公式）
export type AttackType = 'physical' | 'magic' | 'true' | 'heal';

// v2.3.0：Buff/Debuff 框架
export type StatusEffectKind = 'buff' | 'debuff';
export type StatusStat = 'atk' | 'def' | 'aspd' | 'spd' | 'magicResist' | 'blockCount';
export interface StatusEffect {
  id: string;          // 唯一实例 id
  name: string;        // 展示名称
  kind: StatusEffectKind;
  stat: StatusStat;
  mod: number;         // 数值；flat 则直接加减，pct 则按乘法修正（1 + mod）
  modType: 'flat' | 'pct';
  duration: number;    // 总时长（仅展示）
  remaining: number;   // 剩余时长，<=0 即过期
  sourceId?: string;   // 可选：赋予者 id
}

// 技力回复方式
export type SpRecoveryType = 'auto' | 'attack' | 'defense' | 'auto_attack' | 'auto_defense' | 'attack_defense' | 'all';

export interface SkillInfo {
  name: string;
  desc: string;
  initialSp: number;
  cost: number;
  // 技力回复方式：'auto'自然回复, 'attack'攻击回复, 'defense'受击回复
  // 可以组合：'auto_attack', 'auto_defense', 'attack_defense', 'all'
  spRecovery: SpRecoveryType;
  // v2.0.0：技能手动激活所需的运行时资源
  duration: number;                // 持续时间，<=0 表示瞬发（版本限制：当前仅支持持续型）
  effectType: SkillEffectType;
  values: Record<string, number>;  // 如 atkMul / aspdPct / defPct / blkPlus / hits
}

// 角色等阶
export type OperatorRank = 1 | 2; // 1阶或2阶

export interface Entity {
  id: string;
  pos: Vector2; 
  gridPos: Vector2;
  radius: number;
  color: string;
  stats: BaseStats;
  markedForDeletion: boolean;
}

// v2.4.0：敌人特性
export interface EnemyTraits {
  flying?: boolean;
  stealth?: boolean;
  summon?: { childId: string; count: number; on: 'death' };
  bossPhase?: { atHpPct: number; effect: StatusEffect };
  // v3.10.0：护盾、被击狂怒
  shield?: number;
  enrageOnHit?: { aspdMod: number; spdMod: number; durationS: number };
  // v3.17.0：治疗光环（每秒给指定 tile 半径内同盟敌人 +N hp，capped maxHp）
  healAura?: { perSec: number; radiusTiles: number };
  // v3.17.0：远程攻击（不需要 block，对 range tile 内最近的 operator 周期扣 hp）
  ranged?: { rangeTiles: number };
  // v3.17.1：抗治疗光环（场内有存活同阶敌时，医疗弹 damage × mult）
  healSuppress?: { mult: number };
}

// v3.0.0：盟约叠层
export type PactSource =
  | 'kill_any' | 'kill_elite' | 'kill_flying' | 'kill_stealth'
  | 'deploy_any' | `deploy_class:${string}`
  | 'retreat_any'
  | 'wave_clear' | 'wave_perfect'
  // v3.11.0：新事件源
  | 'kill_shielded' | 'kill_in_enrage';

export interface PactTier {
  threshold: number;
  effects: StatusEffect[];
  description: string;
}

export interface PactDefinition {
  id: string;
  name: string;
  desc: string;
  scope: 'all_operators' | 'all_enemies' | 'global';
  sources: { source: PactSource; perEvent: number }[];
  decay?: { interval: number; perTick: number };
  cap: number;
  tiers: PactTier[];
  // v3.2.0：誓约枷锁 — 选择此盟约即背负的代价 effects（无视 tier，部署时立即附加）
  penalty?: StatusEffect[];
  penaltyDesc?: string;
}

export interface PactRuntime {
  defId: string;
  stack: number;
  appliedTier: number; // -1 表示未达任何阈值
  decayAccum: number;
  shackled?: boolean; // v3.2.1：枷锁模式（true=承受 penalty，但阈值降低）
  // v3.2.2：UI 动画用时间戳（ms，performance.now()）
  lastTierUpAt?: number;
  lastStackChangeAt?: number;
}

// v3.2.1：玩家选盟约时携带的元信息
export interface PactSelection {
  defId: string;
  shackled: boolean;
}

// v3.3.0：盟约共鸣 — 当多个盟约同时达 minTier 时激活的额外加成
export interface PactResonance {
  id: string; // 例如 'reso_flame_storm'，运行时 sourceId 形如 'resonance_<id>_<n>'
  name: string;
  desc: string;
  requires: { defId: string; minTier: number }[]; // 全部满足才激活
  scope: 'all_operators' | 'all_enemies';
  effects: StatusEffect[]; // 激活期间挂载到 scope 内全体单位  // v3.3.3：枷锁升阶 — 若 requires 中至少 1 个 pact 是 shackled，效果加成翻倍（复制一份 effects）
  shackledBoosts?: boolean;}

// v3.5.0：事件卡（波之间随机弹出，玩家选 1 选项触发效果）
export interface EventEngineHandle {
  money: number;
  addPactStack(defId: string, n: number): void;
  addAllOperatorsSp(amount: number): void;
  // v3.17.0：把所有未撤退干员 hp 回满（野战医院事件用）
  healAllOperatorsFull(): void;
  notifyUpdate(): void;
}
export interface EventOption {
  label: string;
  desc: string;
  apply: (e: EventEngineHandle) => void;
}
export interface EventCard {
  id: string;
  name: string;
  desc: string;
  options: EventOption[];
  // v3.5.2：品质与权重 — 抽卡按 weight 加权；rarity 仅 UI 配色用
  rarity?: 'common' | 'rare' | 'epic';
  weight?: number;
  // v3.5.4：波次联动
  minWave?: number;   // 仅 currentWave >= minWave 时可抽（含等于）
  maxWave?: number;   // 仅 currentWave <= maxWave 时可抽
  once?: boolean;     // 整局仅可触发 1 次
  cooldown?: number;  // 触发后 cooldown 波内不再抽到（不与 once 同用）
}

export interface Enemy extends Entity {
  waypointIndex: number;
  isBlockedBy: string | null;
  attackCooldown: number;
  effects: StatusEffect[]; // v2.3.0
  traits?: EnemyTraits;       // v2.4.0
  bossPhaseTriggered?: boolean; // v2.4.0
  currentShield?: number;     // v3.10.0
}

export interface Operator extends Entity {
  name: string;
  cooldown: number;
  targetId: string | null;
  cost: number;
  placement: PlacementType;
  rarity: number;
  blockingEnemyIds: string[];
  isRetreated: boolean;
  skill: SkillInfo;
  currentSp: number;
  
  // 新增：用于撤回逻辑的追踪
  templateId: string;
  
  // 技力相关状态
  skillActive: boolean; // 技能是否激活
  skillDuration: number; // 技能持续时间（如果技能有时长）
  
  // 角色等阶
  rank: OperatorRank; // 1阶或2阶

  // v2.2.0：部署计时与费用回流（先锋职业）
  deployTime: number;     // 部署后累计存活时间（秒）
  costRefunded: boolean;  // 是否已回流过部署费用

  // v2.3.0：状态效果列表
  effects: StatusEffect[];
  
  // 朝向系统
  direction: Direction; // 角色朝向
}

export interface Projectile {
  id: string;
  pos: Vector2;
  targetId: string;
  speed: number;
  damage: number;
  color: string;
  markedForDeletion: boolean;
  atkType: AttackType; // v2.1.0
  sourceId?: string; // v3.16.0：发射者 operator id（用于击杀回报、治疗目标等）
  sourceClass?: string; // v3.16.0：发射者职业（命中分支判断减速等附加效果）
  targetIsAlly?: boolean; // v3.16.0：true 表示 targetId 指向 operator（治疗弹）
  // v3.17.1：敌人远程攻击的类型标记
  targetIsOperator?: boolean; // true 表示 targetId 指向 operator（敌人远程弹）
  sourceEnemyId?: string; // 发射者 enemy id
}

export interface ShopItem {
  uid: string;
  templateId: string;
  cost: number;
  bought: boolean;
}

// 角色池统计（v1.5.0：从 GameEngine 提到 types）
export interface OperatorPoolStats {
  count: number;       // 累计获得次数（上限 7）
  rank1Count: number;  // 当前持有 1 阶数
  rank2Count: number;  // 当前持有 2 阶数
}

// 模板数据结构扩展
// === v1.2.0 干员体系（参考明日方舟）===
//
// 设计：每个干员有
//   - class: 职业，决定职业特性（如速射手优先打飞行 / 高威胁）
//   - talents[]: 0-2 个天赋，按 rank（1阶/2阶）有不同数值
//   - skills[]:  1-3 个技能，进入战斗只能携带其中 1 个
//   - 同一技能在不同 rank 下数值/持续时间也不同（叠层强化）

export type OperatorClass =
  | 'guard'       // 近卫 — 高攻 / 单段
  | 'defender'    // 重装 — 高血/高防/多阻挡
  | 'sniper'      // 狙击 — 远程，优先攻击高威胁/飞行单位
  | 'caster'      // 术师 — 法术伤害
  | 'medic'       // 医疗 — 治疗友军
  | 'vanguard'    // 先锋 — 部署费用回流
  | 'specialist'  // 特种
  | 'supporter';  // 辅助

export type TargetPriority = 'first' | 'flying' | 'highest_hp' | 'lowest_def' | 'lowest_hp' | 'lowest_self_distance';

export interface ClassTrait {
  name: string;
  desc: string;
  targetPriority: TargetPriority;
}

// 天赋：0-2 个，按 rank 有不同数值
export type TalentEffect = 'atk_pct' | 'hp_pct' | 'def_pct' | 'aspd_pct' | 'block_plus' | 'sp_init';

export interface Talent {
  name: string;
  desc: string;          // 描述模板，可写 {r1}/{r2} 占位
  effect: TalentEffect;
  rankValues: { rank1: number; rank2: number };
}

// 技能：单个等阶的具体数值
export interface SkillLevel {
  initialSp: number;
  cost: number;
  duration?: number;
  values: Record<string, number>; // 如 { atkMul: 1.5 }，由 effectType 解释
}

export type SkillEffectType = 'attack_buff' | 'defense_buff' | 'aoe' | 'multistrike' | 'heal' | 'passive';

export interface SkillDefinition {
  id: string;
  name: string;
  desc: string;
  spRecovery: SpRecoveryType;
  effectType: SkillEffectType;
  levels: { rank1: SkillLevel; rank2: SkillLevel };
}

export interface OperatorTemplate {
    name: string;
    cost: number;
    rarity: number;
    color: string;
    placement: PlacementType;
    class: OperatorClass;
    atkType?: AttackType; // v2.1.0：缺省按职业推断（caster→magic, medic→heal, 其余→physical）
    stats: BaseStats;
    talents: Talent[];                // 0-2 个
    skills: SkillDefinition[];        // 1-3 个
    defaultSkillIndex: number;        // 默认携带技能（v1.x 暂未做战前选择）
    saleValue: number;
    shopLevel: number;
}