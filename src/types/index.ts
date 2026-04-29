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
}

export interface Enemy extends Entity {
  waypointIndex: number;
  isBlockedBy: string | null;
  attackCooldown: number;
  effects: StatusEffect[]; // v2.3.0
  traits?: EnemyTraits;       // v2.4.0
  bossPhaseTriggered?: boolean; // v2.4.0
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