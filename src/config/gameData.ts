import { Vector2, TileType, SkillInfo, OperatorTemplate, SpRecoveryType } from '../types';

export const CONFIG = {
  TILE_SIZE: 64,
  MAP_WIDTH: 10,
  MAP_HEIGHT: 8,
  BASE_LIVES: 10,
  BASE_MONEY: 15, // 减少初始资金，只能购买1-2个角色
  MAX_BENCH_SIZE: 10,
};

// 地图库：包含多个不同的地图配置
// === 设计规则（强约束）===
// 1. 敌人路径必须全程在地面（TileType 0）或入口/出口（3/4）上，禁止经过高台（1）和墙（2）
// 2. 相邻 waypoint 之间只允许纯水平或纯垂直移动，且段内每个格子都必须是 0/3/4
// 3. 启动时会调用 validateMaps() 在控制台报告任何违规
export const MAP_LIBRARY: Array<{ name: string, layout: TileType[][], waypoints: Vector2[] }> = [
  // 地图1：U 型 — 入口在左上，出口在右下，沿右侧通道贯通
  {
    name: 'U 型通道',
    layout: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [3, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 4, 2],
    ],
    waypoints: [
      { x: 0, y: 1 }, { x: 8, y: 1 }, { x: 8, y: 7 },
    ]
  },
  // 地图2：S 型 — 三段横向往复
  {
    name: 'S 形蛇道',
    layout: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [3, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 1, 1, 1, 1, 1, 1, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 4, 2],
    ],
    waypoints: [
      { x: 0, y: 1 }, { x: 8, y: 1 }, { x: 8, y: 3 }, { x: 1, y: 3 },
      { x: 1, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 7 },
    ]
  },
  // 地图3：直线长道 — 高台分布两侧，最适合远程
  {
    name: '直线长道',
    layout: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [3, 0, 0, 0, 0, 0, 0, 0, 0, 4],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    waypoints: [
      { x: 0, y: 3 }, { x: 9, y: 3 },
    ]
  },
  // 地图4：П 型 — 入口走左通道下行，再横穿底部到右下出口
  {
    name: 'П 型回廊',
    layout: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [3, 0, 2, 2, 2, 2, 2, 2, 0, 2],
      [2, 0, 2, 1, 1, 1, 1, 2, 0, 2],
      [2, 0, 2, 1, 1, 1, 1, 2, 0, 2],
      [2, 0, 2, 2, 2, 2, 2, 2, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 4, 2],
    ],
    waypoints: [
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 7 },
    ]
  },
  // 地图5：Z 型 — 顶部右行 → 中部左折 → 底部右行
  {
    name: 'Z 字曲线',
    layout: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [3, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 1, 1, 1, 1, 1, 1, 2],
      [2, 0, 1, 1, 1, 1, 1, 1, 1, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 4, 2],
    ],
    waypoints: [
      { x: 0, y: 1 }, { x: 8, y: 1 }, { x: 8, y: 4 }, { x: 1, y: 4 },
      { x: 1, y: 7 }, { x: 8, y: 7 },
    ]
  },
  // 地图6：N 型 — 左侧下行 → 中间横穿 → 右侧下行
  {
    name: 'N 型双折',
    layout: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [3, 0, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 1, 1, 1, 1, 1, 1, 1, 2],
      [2, 0, 1, 1, 1, 1, 1, 1, 1, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 1, 1, 1, 1, 1, 1, 1, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 4, 2],
    ],
    waypoints: [
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 8, y: 4 }, { x: 8, y: 7 },
    ]
  }
];

// 校验所有地图：路径段必须只穿过 0/3/4，禁止穿过高台(1)或墙(2)
// 在 main.ts 启动时调用，仅 console.warn，不阻塞游戏
export function validateMaps(): { ok: boolean, issues: string[] } {
  const issues: string[] = [];
  const isWalkable = (t: TileType) => t === 0 || t === 3 || t === 4;
  MAP_LIBRARY.forEach((map, idx) => {
    const tag = `[地图#${idx} ${map.name}]`;
    const wps = map.waypoints;
    if (wps.length < 2) { issues.push(`${tag} waypoint 不足 2 个`); return; }
    for (let i = 0; i < wps.length; i++) {
      const p = wps[i];
      const t = map.layout[p.y]?.[p.x];
      if (t === undefined) { issues.push(`${tag} waypoint#${i} (${p.x},${p.y}) 越界`); continue; }
      if (!isWalkable(t)) issues.push(`${tag} waypoint#${i} (${p.x},${p.y}) 落在非地面 tile=${t}`);
    }
    for (let i = 0; i < wps.length - 1; i++) {
      const a = wps[i], b = wps[i + 1];
      if (a.x !== b.x && a.y !== b.y) {
        issues.push(`${tag} 段 #${i} (${a.x},${a.y})→(${b.x},${b.y}) 非纯水平/垂直`);
        continue;
      }
      const stepX = a.x === b.x ? 0 : (b.x > a.x ? 1 : -1);
      const stepY = a.y === b.y ? 0 : (b.y > a.y ? 1 : -1);
      let cx = a.x, cy = a.y;
      while (cx !== b.x || cy !== b.y) {
        cx += stepX; cy += stepY;
        const t = map.layout[cy]?.[cx];
        if (t === undefined || !isWalkable(t)) {
          issues.push(`${tag} 段 #${i} 经过非地面格 (${cx},${cy}) tile=${t}`);
          break;
        }
      }
    }
  });
  return { ok: issues.length === 0, issues };
}

// 当前选中的地图（在游戏开始时随机选择）
export let MAP_LAYOUT: TileType[][] = MAP_LIBRARY[0].layout;
export let PATH_WAYPOINTS: Vector2[] = MAP_LIBRARY[0].waypoints;

// 随机选择地图
export function selectRandomMap() {
  const randomIndex = Math.floor(Math.random() * MAP_LIBRARY.length);
  const selectedMap = MAP_LIBRARY[randomIndex];
  MAP_LAYOUT = selectedMap.layout;
  PATH_WAYPOINTS = selectedMap.waypoints;
  return randomIndex;
}

export const RARITY_RATES: number[][] = [
  [1.0, 0.0, 0.0, 0.0, 0.0],
  [0.6, 0.4, 0.0, 0.0, 0.0],
  [0.3, 0.5, 0.2, 0.0, 0.0],
  [0.1, 0.3, 0.4, 0.2, 0.0],
  [0.0, 0.1, 0.3, 0.4, 0.2],
];

const defaultSkill = (name: string, desc: string, spRecovery: SpRecoveryType = 'auto'): SkillInfo => ({
  name, desc, initialSp: 0, cost: 10, spRecovery
});

// 使用 OperatorTemplate 类型约束
export const OPERATOR_DB: Record<string, OperatorTemplate> = {
  'recruit_guard': {
    name: '预备近卫', cost: 8, rarity: 1, color: '#95a5a6', placement: 'ground',
    stats: { hp: 1200, maxHp: 1200, atk: 200, def: 50, spd: 0, range: 1.1, aspd: 1.2, blockCount: 1 },
    skill: defaultSkill('强力击·α', '下一次攻击力提升至150%', 'attack'),
    saleValue: 1,
    shopLevel: 0
  },
  'recruit_defender': {
    name: '轻装盾兵', cost: 10, rarity: 2, color: '#7f8c8d', placement: 'ground',
    stats: { hp: 2000, maxHp: 2000, atk: 120, def: 250, spd: 0, range: 1.0, aspd: 1.5, blockCount: 2 },
    skill: defaultSkill('防御力强化·α', '防御力+10%，持续10秒', 'defense'),
    saleValue: 1,
    shopLevel: 0
  },
  'guard_sword': {
    name: '剑豪', cost: 15, rarity: 3, color: '#3498db', placement: 'ground',
    stats: { hp: 1800, maxHp: 1800, atk: 450, def: 150, spd: 0, range: 1.2, aspd: 1.1, blockCount: 1 },
    skill: defaultSkill('二连击', '下一次攻击造成两次伤害', 'attack'),
    saleValue: 1,
    shopLevel: 1
  },
  'defender_shield': {
    name: '重盾卫', cost: 18, rarity: 3, color: '#2ecc71', placement: 'ground',
    stats: { hp: 3500, maxHp: 3500, atk: 200, def: 600, spd: 0, range: 1.0, aspd: 1.6, blockCount: 3 },
    skill: defaultSkill('龟壳姿态', '停止攻击，防御力+50%，回血速度提升', 'defense'),
    saleValue: 1,
    shopLevel: 1
  },
  'sniper_aa': {
    name: '速射手', cost: 14, rarity: 3, color: '#e67e22', placement: 'high_ground',
    stats: { hp: 800, maxHp: 800, atk: 300, def: 50, spd: 0, range: 3.5, aspd: 1.0, blockCount: 0 },
    skill: defaultSkill('射速爆发', '攻击速度+30，持续15秒', 'auto'),
    saleValue: 1,
    shopLevel: 1
  },
  'sniper_boom': {
    name: '炮击手', cost: 25, rarity: 4, color: '#d35400', placement: 'high_ground',
    stats: { hp: 1000, maxHp: 1000, atk: 600, def: 80, spd: 0, range: 4.5, aspd: 2.8, blockCount: 0 },
    skill: defaultSkill('爆破弹', '下一次攻击造成范围爆炸伤害', 'attack'),
    saleValue: 1,
    shopLevel: 2
  },
  'caster_volcano': {
    name: '天灾术师', cost: 35, rarity: 5, color: '#9b59b6', placement: 'high_ground',
    stats: { hp: 1500, maxHp: 1500, atk: 750, def: 100, spd: 0, range: 3.5, aspd: 1.5, blockCount: 0 },
    skill: defaultSkill('火山', '攻击范围大幅扩大，同时攻击6个目标', 'auto'),
    saleValue: 1,
    shopLevel: 3
  }
};

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

export const WAVES = [
  { count: 6, interval: 1.5, enemyId: 'slug', reward: 15 },
  { count: 10, interval: 1.2, enemyId: 'slug', reward: 20 },
  { count: 6, interval: 2.5, enemyId: 'soldier', reward: 30 },
  { count: 12, interval: 2.0, enemyId: 'soldier', reward: 40 },
  { count: 4, interval: 4.0, enemyId: 'heavy', reward: 60 },
];
