import { Vector2, TileType, PlacementType } from '../types';

export const CONFIG = {
  TILE_SIZE: 64,
  MAP_WIDTH: 10,
  MAP_HEIGHT: 8,
  BASE_LIVES: 10,
  BASE_MONEY: 25,
};

// --- 地图数据 ---
// 0=地面, 1=高台, 2=墙/不可部署, 3=起点, 4=终点
export const MAP_LAYOUT: TileType[][] = [
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [3, 0, 0, 0, 1, 1, 1, 1, 2, 2], // (0,1) Start
  [2, 2, 2, 0, 1, 1, 1, 1, 2, 2],
  [2, 1, 1, 0, 0, 0, 0, 0, 2, 2],
  [2, 1, 1, 2, 2, 2, 2, 0, 2, 2],
  [2, 1, 1, 1, 1, 0, 0, 0, 2, 2],
  [2, 2, 2, 2, 2, 0, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 4, 2, 2, 2, 2], // (5,7) End
];

// 路径点 (必须与地图逻辑匹配)
export const PATH_WAYPOINTS: Vector2[] = [
  { x: 0, y: 1 }, // Start
  { x: 3, y: 1 },
  { x: 3, y: 3 },
  { x: 7, y: 3 },
  { x: 7, y: 5 },
  { x: 5, y: 5 },
  { x: 5, y: 7 }, // End
];

// --- 抽卡概率表 (索引=Rarity-1) ---
// Lv1 ~ Lv5
export const RARITY_RATES: number[][] = [
  [1.0, 0.0, 0.0, 0.0, 0.0], // Lv1: 100% 1星
  [0.6, 0.4, 0.0, 0.0, 0.0], // Lv2
  [0.3, 0.5, 0.2, 0.0, 0.0], // Lv3
  [0.1, 0.3, 0.4, 0.2, 0.0], // Lv4
  [0.0, 0.1, 0.3, 0.4, 0.2], // Lv5
];

// --- 干员数据库 ---
export const OPERATOR_DB = {
  // 1星
  'recruit_guard': {
    name: '预备近卫', cost: 5, rarity: 1, color: '#95a5a6', placement: 'ground' as PlacementType,
    stats: { hp: 1200, maxHp: 1200, atk: 200, def: 50, spd: 0, range: 1.1, aspd: 1.2, blockCount: 1 }
  },
  // 2星
  'recruit_defender': {
    name: '轻装盾兵', cost: 8, rarity: 2, color: '#7f8c8d', placement: 'ground' as PlacementType,
    stats: { hp: 2000, maxHp: 2000, atk: 120, def: 250, spd: 0, range: 1.0, aspd: 1.5, blockCount: 2 }
  },
  // 3星
  'guard_sword': {
    name: '剑豪', cost: 12, rarity: 3, color: '#3498db', placement: 'ground' as PlacementType,
    stats: { hp: 1800, maxHp: 1800, atk: 450, def: 150, spd: 0, range: 1.2, aspd: 1.1, blockCount: 1 }
  },
  'defender_shield': {
    name: '重盾卫', cost: 16, rarity: 3, color: '#2ecc71', placement: 'ground' as PlacementType,
    stats: { hp: 3500, maxHp: 3500, atk: 200, def: 600, spd: 0, range: 1.0, aspd: 1.6, blockCount: 3 }
  },
  'sniper_aa': {
    name: '速射手', cost: 12, rarity: 3, color: '#e67e22', placement: 'high_ground' as PlacementType,
    stats: { hp: 800, maxHp: 800, atk: 300, def: 50, spd: 0, range: 3.5, aspd: 1.0, blockCount: 0 }
  },
  // 4星
  'sniper_boom': {
    name: '炮击手', cost: 22, rarity: 4, color: '#d35400', placement: 'high_ground' as PlacementType,
    stats: { hp: 1000, maxHp: 1000, atk: 600, def: 80, spd: 0, range: 4.5, aspd: 2.8, blockCount: 0 }
  },
  // 5星
  'caster_volcano': {
    name: '天灾术师', cost: 30, rarity: 5, color: '#9b59b6', placement: 'high_ground' as PlacementType,
    stats: { hp: 1500, maxHp: 1500, atk: 750, def: 100, spd: 0, range: 3.5, aspd: 1.5, blockCount: 0 }
  }
};

// --- 敌人数据库 ---
export const ENEMY_DB = {
  'slug': {
    name: '源石虫', color: '#e74c3c', radius: 15,
    stats: { hp: 350, maxHp: 350, atk: 150, def: 0, spd: 2.2, range: 0, aspd: 1.0, blockCount: 0 }
  },
  'soldier': {
    name: '步兵', color: '#c0392b', radius: 18,
    stats: { hp: 1200, maxHp: 1200, atk: 350, def: 100, spd: 1.5, range: 0, aspd: 1.5, blockCount: 0 }
  },
  'heavy': {
    name: '大盾兵', color: '#8e44ad', radius: 22,
    stats: { hp: 4500, maxHp: 4500, atk: 500, def: 400, spd: 0.8, range: 0, aspd: 2.5, blockCount: 0 }
  }
};

// --- 波次配置 ---
export const WAVES = [
  { count: 6, interval: 1.5, enemyId: 'slug', reward: 15 },
  { count: 10, interval: 1.2, enemyId: 'slug', reward: 20 },
  { count: 6, interval: 2.5, enemyId: 'soldier', reward: 30 },
  { count: 12, interval: 2.0, enemyId: 'soldier', reward: 40 },
  { count: 4, interval: 4.0, enemyId: 'heavy', reward: 60 },
];