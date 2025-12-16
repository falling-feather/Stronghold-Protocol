export interface Vector2 {
  x: number;
  y: number;
}

// 0=地面(可部署近战), 1=高台(可部署远程), 2=禁区, 3=红门, 4=蓝门
export type TileType = 0 | 1 | 2 | 3 | 4;

export type GamePhase = 'PREP' | 'COMBAT';

export type PlacementType = 'ground' | 'high_ground';

export interface BaseStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  range: number; // 攻击距离（格）
  aspd: number;  // 攻击间隔（秒）
  blockCount: number; // 阻挡数
}

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
  bounty: number; // 击杀奖励 (本规则下为0)
  isBlockedBy: string | null; // 阻挡它的干员ID
}

export interface Operator extends Entity {
  name: string;
  cooldown: number;
  targetId: string | null;
  cost: number;
  placement: PlacementType;
  rarity: number; // 1-5
  blockingEnemyIds: string[]; // 正在阻挡的敌人ID
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