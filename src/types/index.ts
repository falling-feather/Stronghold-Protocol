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

export interface Enemy extends Entity {
  waypointIndex: number;
  isBlockedBy: string | null;
  attackCooldown: number;
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
}

export interface ShopItem {
  uid: string;
  templateId: string;
  cost: number;
  bought: boolean;
}

// 模板数据结构扩展
export interface OperatorTemplate {
    name: string;
    cost: number;
    rarity: number;
    color: string;
    placement: PlacementType;
    stats: BaseStats;
    skill: SkillInfo;
    saleValue: number; // 新增：出售价值
    shopLevel: number; // 商店等级（用于临时商店系统）
}