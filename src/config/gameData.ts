import { Vector2, TileType, SkillInfo, OperatorTemplate, SpRecoveryType, OperatorClass, ClassTrait, SkillDefinition, BaseStats, Talent, StatusEffect, EnemyTraits, PactDefinition, PactResonance } from '../types';

export const CONFIG = {
  TILE_SIZE: 64,
  MAP_WIDTH: 10,
  MAP_HEIGHT: 8,
  BASE_LIVES: 10,
  BASE_MONEY: 15, // 减少初始资金，只能购买1-2个角色
  MAX_BENCH_SIZE: 10,
  // v2.2.0：先锋部署费用回流
  VANGUARD_REFUND_DELAY: 30, // 秒
  VANGUARD_REFUND_RATE: 0.5,  // 50% 回流
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

// 旧 defaultSkill helper 已废弃，迁移到 mkSkill。
// === 职业特性表（v1.2 仅记录元数据，targetPriority 在敌人类型扩展后生效）===
export const CLASS_TRAITS: Record<OperatorClass, ClassTrait> = {
  guard:      { name: '近卫',  desc: '高攻近战，单段输出',           targetPriority: 'first' },
  defender:   { name: '重装',  desc: '高血高防，多阻挡',             targetPriority: 'first' },
  sniper:     { name: '狙击',  desc: '远程，优先攻击空中/高威胁单位', targetPriority: 'flying' },
  caster:     { name: '术师',  desc: '法术伤害，无视防御',           targetPriority: 'first' },
  medic:      { name: '医疗',  desc: '治疗友军',                    targetPriority: 'lowest_hp' },
  vanguard:   { name: '先锋',  desc: '部署费用回流',                 targetPriority: 'first' },
  specialist: { name: '特种',  desc: '特殊机制（位移、召唤等）',      targetPriority: 'first' },
  supporter:  { name: '辅助',  desc: '减速/削弱敌人',                targetPriority: 'first' },
};

const mkSkill = (
  id: string, name: string, desc: string,
  spRecovery: SpRecoveryType,
  effectType: SkillDefinition['effectType'],
  rank1: { initialSp: number; cost: number; duration?: number; values: Record<string, number> },
  rank2: { initialSp: number; cost: number; duration?: number; values: Record<string, number> },
): SkillDefinition => ({ id, name, desc, spRecovery, effectType, levels: { rank1, rank2 } });

const mkTalent = (name: string, desc: string, effect: Talent['effect'], r1: number, r2: number): Talent =>
  ({ name, desc, effect, rankValues: { rank1: r1, rank2: r2 } });

// 把模板按 rank 解析为运行时 SkillInfo（GameEngine deployment / 商店预览均使用）
export function resolveSkillForRank(template: OperatorTemplate, rank: 1 | 2, skillIndex?: number): SkillInfo {
  const idx = skillIndex ?? template.defaultSkillIndex;
  const def = template.skills[idx];
  const lvl = rank === 2 ? def.levels.rank2 : def.levels.rank1;
  return {
    name: def.name + (rank === 2 ? '·精炼' : ''),
    desc: def.desc,
    initialSp: lvl.initialSp,
    cost: lvl.cost,
    spRecovery: def.spRecovery,
    duration: lvl.duration ?? 0,
    effectType: def.effectType,
    values: lvl.values ?? {},
  };
}

// 把天赋叠加到基础属性（部署时调用一次）
// v2.3.2：仅正变 hp/maxHp 仍在本函数烘烤（变更 量需重生成 max 上限），
//          atk/def/aspd/blockCount 改为通过 buildTalentEffects 以 effects 形式运行期生效。
export function applyTalentsToStats(base: BaseStats, talents: Talent[], rank: 1 | 2): BaseStats {
  const s: BaseStats = { ...base };
  talents.forEach(t => {
    const v = rank === 2 ? t.rankValues.rank2 : t.rankValues.rank1;
    if (t.effect === 'hp_pct') {
      s.hp = Math.round(s.hp * (1 + v / 100));
      s.maxHp = s.hp;
    }
  });
  return s;
}

// v2.3.2：生成天赋对应的永久 StatusEffect 列表（duration=-1 不过期）
export function buildTalentEffects(talents: Talent[], rank: 1 | 2, ownerId: string): StatusEffect[] {
  const out: StatusEffect[] = [];
  talents.forEach(t => {
    const v = rank === 2 ? t.rankValues.rank2 : t.rankValues.rank1;
    switch (t.effect) {
      case 'atk_pct':
        out.push({ id: `talent_${ownerId}_atk`, name: `天赋·${t.name}`, kind: 'buff', stat: 'atk', mod: v / 100, modType: 'pct', duration: -1, remaining: -1, sourceId: ownerId });
        break;
      case 'def_pct':
        out.push({ id: `talent_${ownerId}_def`, name: `天赋·${t.name}`, kind: 'buff', stat: 'def', mod: v / 100, modType: 'pct', duration: -1, remaining: -1, sourceId: ownerId });
        break;
      case 'aspd_pct':
        out.push({ id: `talent_${ownerId}_aspd`, name: `天赋·${t.name}`, kind: 'buff', stat: 'aspd', mod: -(v / 100), modType: 'pct', duration: -1, remaining: -1, sourceId: ownerId });
        break;
      case 'block_plus':
        out.push({ id: `talent_${ownerId}_blk`, name: `天赋·${t.name}`, kind: 'buff', stat: 'blockCount', mod: Math.floor(v), modType: 'flat', duration: -1, remaining: -1, sourceId: ownerId });
        break;
      // hp_pct 在 applyTalentsToStats 中烘烤；sp_init 在部署点处理
    }
  });
  return out;
}

// === v1.2 干员模板库（职业 / 天赋 / 多技能 / 叠层数值）===
export const OPERATOR_DB: Record<string, OperatorTemplate> = {
  'recruit_guard': {
    name: '预备近卫', cost: 8, rarity: 1, color: '#95a5a6', placement: 'ground', class: 'guard',
    stats: { hp: 1200, maxHp: 1200, atk: 200, def: 50, spd: 0, range: 1.1, aspd: 1.2, blockCount: 1 },
    talents: [],
    skills: [
      mkSkill('s_alpha_strike', '强力击·α', '下一次攻击力提升至 {atkMul}×', 'attack', 'attack_buff',
        { initialSp: 0, cost: 10, values: { atkMul: 1.5 } },
        { initialSp: 2, cost: 9,  values: { atkMul: 1.8 } }),
    ],
    defaultSkillIndex: 0,
    saleValue: 1, shopLevel: 0,
  },
  'recruit_defender': {
    name: '轻装盾兵', cost: 10, rarity: 2, color: '#7f8c8d', placement: 'ground', class: 'defender',
    stats: { hp: 2000, maxHp: 2000, atk: 120, def: 250, spd: 0, range: 1.0, aspd: 1.5, blockCount: 2 },
    talents: [
      mkTalent('坚毅', '初始生命 +{r1}% / +{r2}%', 'hp_pct', 5, 10),
    ],
    skills: [
      mkSkill('s_def_alpha', '防御力强化·α', '防御 +{defPct}% 持续 {duration}s', 'defense', 'defense_buff',
        { initialSp: 0, cost: 12, duration: 10, values: { defPct: 10 } },
        { initialSp: 3, cost: 10, duration: 12, values: { defPct: 18 } }),
    ],
    defaultSkillIndex: 0,
    saleValue: 1, shopLevel: 0,
  },
  'guard_sword': {
    name: '剑豪', cost: 15, rarity: 3, color: '#3498db', placement: 'ground', class: 'guard',
    stats: { hp: 1800, maxHp: 1800, atk: 450, def: 150, spd: 0, range: 1.2, aspd: 1.1, blockCount: 1 },
    talents: [
      mkTalent('双手剑技', '攻击力 +{r1}% / +{r2}%', 'atk_pct', 8, 15),
    ],
    skills: [
      mkSkill('s_double_strike', '二连击', '下一次攻击造成 {hits} 段伤害', 'attack', 'multistrike',
        { initialSp: 0, cost: 8, values: { hits: 2 } },
        { initialSp: 2, cost: 7, values: { hits: 3 } }),
      mkSkill('s_swift_blade', '疾风斩', '攻速 +{aspdPct}% 持续 {duration}s', 'auto', 'attack_buff',
        { initialSp: 0, cost: 25, duration: 15, values: { aspdPct: 30 } },
        { initialSp: 5, cost: 22, duration: 18, values: { aspdPct: 45 } }),
    ],
    defaultSkillIndex: 0,
    saleValue: 1, shopLevel: 1,
  },
  'defender_shield': {
    name: '重盾卫', cost: 18, rarity: 3, color: '#2ecc71', placement: 'ground', class: 'defender',
    stats: { hp: 3500, maxHp: 3500, atk: 200, def: 600, spd: 0, range: 1.0, aspd: 1.6, blockCount: 3 },
    talents: [
      mkTalent('盾阵', '防御 +{r1}% / +{r2}%', 'def_pct', 8, 15),
    ],
    skills: [
      mkSkill('s_turtle_stance', '龟壳姿态', '停止攻击，防御 +{defPct}%，回血加速', 'defense', 'defense_buff',
        { initialSp: 0, cost: 15, duration: 20, values: { defPct: 50 } },
        { initialSp: 4, cost: 13, duration: 25, values: { defPct: 75 } }),
      mkSkill('s_taunt', '挑衅', '阻挡数 +{blkPlus}，仇恨拉满', 'auto', 'passive',
        { initialSp: 0, cost: 30, duration: 12, values: { blkPlus: 1 } },
        { initialSp: 6, cost: 26, duration: 15, values: { blkPlus: 2 } }),
    ],
    defaultSkillIndex: 0,
    saleValue: 1, shopLevel: 1,
  },
  'sniper_aa': {
    name: '速射手', cost: 14, rarity: 3, color: '#e67e22', placement: 'high_ground', class: 'sniper',
    stats: { hp: 800, maxHp: 800, atk: 300, def: 50, spd: 0, range: 3.5, aspd: 1.0, blockCount: 0 },
    talents: [
      mkTalent('精确射击', '攻击力 +{r1}% / +{r2}%', 'atk_pct', 5, 12),
    ],
    skills: [
      mkSkill('s_rapid_fire', '射速爆发', '攻速 +{aspdPct}% 持续 {duration}s', 'auto', 'attack_buff',
        { initialSp: 0, cost: 25, duration: 15, values: { aspdPct: 35 } },
        { initialSp: 5, cost: 22, duration: 18, values: { aspdPct: 55 } }),
      mkSkill('s_focus_fire', '集中火力', '攻击力 +{atkPct}% 持续 {duration}s', 'attack', 'attack_buff',
        { initialSp: 0, cost: 18, duration: 10, values: { atkPct: 40 } },
        { initialSp: 4, cost: 15, duration: 12, values: { atkPct: 60 } }),
    ],
    defaultSkillIndex: 0,
    saleValue: 1, shopLevel: 1,
  },
  'sniper_boom': {
    name: '炮击手', cost: 25, rarity: 4, color: '#d35400', placement: 'high_ground', class: 'sniper',
    stats: { hp: 1000, maxHp: 1000, atk: 600, def: 80, spd: 0, range: 4.5, aspd: 2.8, blockCount: 0 },
    talents: [
      mkTalent('爆破师', '范围攻击伤害 +{r1}% / +{r2}%', 'atk_pct', 10, 18),
    ],
    skills: [
      mkSkill('s_blast_shell', '爆破弹', '下一发为范围爆炸，半径 {radius}', 'attack', 'aoe',
        { initialSp: 0, cost: 12, values: { radius: 1.2, atkMul: 1.4 } },
        { initialSp: 3, cost: 10, values: { radius: 1.5, atkMul: 1.7 } }),
      mkSkill('s_barrage', '弹幕轰炸', '持续 {duration}s 内每发都为爆炸', 'auto', 'aoe',
        { initialSp: 0, cost: 35, duration: 12, values: { radius: 1.0, atkMul: 1.2 } },
        { initialSp: 6, cost: 30, duration: 15, values: { radius: 1.2, atkMul: 1.4 } }),
    ],
    defaultSkillIndex: 0,
    saleValue: 1, shopLevel: 2,
  },
  'caster_volcano': {
    name: '天灾术师', cost: 35, rarity: 5, color: '#9b59b6', placement: 'high_ground', class: 'caster',
    stats: { hp: 1500, maxHp: 1500, atk: 750, def: 100, spd: 0, range: 3.5, aspd: 1.5, blockCount: 0 },
    talents: [
      mkTalent('魔力涌动', '攻击力 +{r1}% / +{r2}%', 'atk_pct', 12, 20),
      mkTalent('火属性精通', '起手 SP +{r1} / +{r2}', 'sp_init', 5, 10),
    ],
    skills: [
      mkSkill('s_volcano', '火山', '范围扩大，同时攻击 {targets} 个目标', 'auto', 'aoe',
        { initialSp: 5,  cost: 40, duration: 20, values: { targets: 6, radius: 1.5 } },
        { initialSp: 10, cost: 36, duration: 25, values: { targets: 8, radius: 1.8 } }),
      mkSkill('s_meteor', '流星雨', '召唤陨石，对范围内敌人造成 {atkMul}× 伤害', 'attack', 'aoe',
        { initialSp: 0, cost: 28, values: { atkMul: 2.5, radius: 2.0 } },
        { initialSp: 5, cost: 25, values: { atkMul: 3.2, radius: 2.5 } }),
      mkSkill('s_burning', '持续灼烧', '攻击附带燃烧 {duration}s 每秒 {dotPct}% atk', 'auto', 'passive',
        { initialSp: 0, cost: 30, duration: 15, values: { dotPct: 25 } },
        { initialSp: 5, cost: 27, duration: 18, values: { dotPct: 40 } }),
    ],
    defaultSkillIndex: 0,
    saleValue: 1, shopLevel: 3,
  },
  'specialist_blade': {
    name: '影刃', cost: 16, rarity: 3, color: '#1abc9c', placement: 'ground', class: 'specialist',
    atkType: 'physical',
    stats: { hp: 1300, maxHp: 1300, atk: 520, def: 120, spd: 0, range: 1.2, aspd: 1.1, blockCount: 1 },
    talents: [
      mkTalent('夜视', '可侦测隐身敌人；攻击力 +{r1}% / +{r2}%', 'atk_pct', 10, 16),
    ],
    skills: [
      mkSkill('s_assassinate', '暗杀', '攻击力提升 {atkMul}×', 'attack', 'attack_buff',
        { initialSp: 0, cost: 18, duration: 10, values: { atkMul: 1.6 } },
        { initialSp: 4, cost: 15, duration: 12, values: { atkMul: 2.0 } }),
    ],
    defaultSkillIndex: 0,
    saleValue: 1, shopLevel: 2,
  },
};

export const ENEMY_DB: Record<string, { name: string; color: string; radius: number; stats: BaseStats; traits?: EnemyTraits }> = {
  'slug': {
    name: '源石虫', color: '#e74c3c', radius: 15,
    stats: { hp: 350, maxHp: 350, atk: 150, def: 0, spd: 2.2, range: 0, aspd: 1.0, blockCount: 0, magicResist: 0 }
  },
  'soldier': {
    name: '步兵', color: '#c0392b', radius: 18,
    stats: { hp: 1200, maxHp: 1200, atk: 350, def: 100, spd: 1.5, range: 0, aspd: 1.5, blockCount: 0, magicResist: 30 }
  },
  'heavy': {
    name: '大盾兵', color: '#8e44ad', radius: 22,
    stats: { hp: 4500, maxHp: 4500, atk: 500, def: 400, spd: 0.8, range: 0, aspd: 2.5, blockCount: 0, magicResist: 60 },
    // v2.4.0：Boss 阶段（血量<50% 时附加永久 +50% 攻） + 死亡召唤 2 只源石虫
    traits: {
      bossPhase: { atHpPct: 0.5, effect: { id: 'boss_heavy_atk', name: 'Boss 狂怒', kind: 'buff', stat: 'atk', mod: 0.5, modType: 'pct', duration: -1, remaining: -1 } },
      summon: { childId: 'slug', count: 2, on: 'death' },
    }
  },
  'flyer': {
    name: '飞虫', color: '#16a085', radius: 13,
    stats: { hp: 600, maxHp: 600, atk: 250, def: 20, spd: 2.6, range: 0, aspd: 1.0, blockCount: 0, magicResist: 20 },
    // v2.4.0：飞行—仅可被高地干员攻击
    traits: { flying: true }
  },
  'phantom': {
    name: '潜行刺客', color: '#34495e', radius: 14,
    stats: { hp: 900, maxHp: 900, atk: 400, def: 50, spd: 1.8, range: 0, aspd: 1.2, blockCount: 0, magicResist: 10 },
    // v2.4.1：隐身—仅可被特种干员攻击
    traits: { stealth: true }
  }
};

export const WAVES = [
  { count: 6, interval: 1.5, enemyId: 'slug', reward: 15 },
  { count: 10, interval: 1.2, enemyId: 'slug', reward: 20 },
  { count: 6, interval: 2.5, enemyId: 'soldier', reward: 30 },
  { count: 5, interval: 1.4, enemyId: 'flyer', reward: 25 },
  { count: 4, interval: 2.0, enemyId: 'phantom', reward: 35 },
  { count: 12, interval: 2.0, enemyId: 'soldier', reward: 40 },
  { count: 4, interval: 4.0, enemyId: 'heavy', reward: 60 },
];

// v3.0.0：盟约叠层数据库
const mkPactEffect = (id: string, name: string, stat: 'atk' | 'def' | 'aspd' | 'spd' | 'magicResist' | 'blockCount', mod: number, modType: 'flat' | 'pct'): StatusEffect => ({
  id, name, kind: 'buff', stat, mod, modType, duration: -1, remaining: -1,
});

// v3.2.0：誓约枷锁负面 effect 构造器（kind: 'debuff'，永久）
const mkPactPenalty = (id: string, name: string, stat: 'atk' | 'def' | 'aspd' | 'spd' | 'magicResist' | 'blockCount', mod: number, modType: 'flat' | 'pct'): StatusEffect => ({
  id, name, kind: 'debuff', stat, mod, modType, duration: -1, remaining: -1,
});

export const PACT_DB: Record<string, PactDefinition> = {
  'pact_flame_blessing': {
    id: 'pact_flame_blessing',
    name: '炎佑',
    desc: '每次击杀敌人累积火种；分级强化全体干员的攻击力',
    scope: 'all_operators',
    sources: [{ source: 'kill_any', perEvent: 1 }],
    cap: 60,
    tiers: [
      { threshold: 10, description: 'tier1：干员攻击力 +5%', effects: [mkPactEffect('pact_flame_blessing_t0_atk', '[盟约·炎佑] 灼热 I', 'atk', 0.05, 'pct')] },
      { threshold: 25, description: 'tier2：干员攻击力 +10%', effects: [mkPactEffect('pact_flame_blessing_t1_atk', '[盟约·炎佑] 灼热 II', 'atk', 0.10, 'pct')] },
      { threshold: 45, description: 'tier3：干员攻击力 +15%', effects: [mkPactEffect('pact_flame_blessing_t2_atk', '[盟约·炎佑] 灼热 III', 'atk', 0.15, 'pct')] },
    ],    // v3.2.0：枷锁 — 热冲代价，防御 -3 flat
    penalty: [mkPactPenalty('pact_flame_blessing_penalty_def', '[枷锁·炎佑] 焦身', 'def', -3, 'flat')],
    penaltyDesc: '枷锁：干员防御 -3',  },
  'pact_lingering_echo': {
    id: 'pact_lingering_echo',
    name: '余音',
    desc: '每次完美通关一波（无漏怪）累积回音；分级降低全体干员攻击间隔',
    scope: 'all_operators',
    sources: [{ source: 'wave_perfect', perEvent: 1 }],
    cap: 9,
    tiers: [
      { threshold: 1, description: 'tier1：攻速 +5%（攻击间隔 -5%）', effects: [mkPactEffect('pact_lingering_echo_t0_aspd', '[盟约·余音] 回响 I', 'aspd', -0.05, 'pct')] },
      { threshold: 3, description: 'tier2：攻速 +10%', effects: [mkPactEffect('pact_lingering_echo_t1_aspd', '[盟约·余音] 回响 II', 'aspd', -0.10, 'pct')] },
      { threshold: 6, description: 'tier3：攻速 +15%', effects: [mkPactEffect('pact_lingering_echo_t2_aspd', '[盟约·余音] 回响 III', 'aspd', -0.15, 'pct')] },
    ],
    // v3.2.0：枷锁 — 魔抗 -5 flat
    penalty: [mkPactPenalty('pact_lingering_echo_penalty_mr', '[枷锁·余音] 魂悗', 'magicResist', -5, 'flat')],
    penaltyDesc: '枷锁：干员魔抗 -5',
  },
  'pact_broken_spring': {
    id: 'pact_broken_spring',
    name: '碎铳之簧',
    desc: '撤退干员时积蓄怒火；衰减叠层带来高强度短期攻击力暴增',
    scope: 'all_operators',
    sources: [{ source: 'retreat_any', perEvent: 3 }],
    decay: { interval: 5, perTick: 1 }, // 每 5 秒掉 1 层
    cap: 18,
    tiers: [
      { threshold: 3, description: 'tier1：干员攻击力 +10%', effects: [mkPactEffect('pact_broken_spring_t0_atk', '[盟约·碎铳之簧] 怒火 I', 'atk', 0.10, 'pct')] },
      { threshold: 9, description: 'tier2：干员攻击力 +20%', effects: [mkPactEffect('pact_broken_spring_t1_atk', '[盟约·碎铳之簧] 怒火 II', 'atk', 0.20, 'pct')] },
      { threshold: 15, description: 'tier3：干员攻击力 +30%', effects: [mkPactEffect('pact_broken_spring_t2_atk', '[盟约·碎铳之簧] 怒火 III', 'atk', 0.30, 'pct')] },
    ],
    // v3.2.0：枷锁 — 防御 -5 flat
    penalty: [mkPactPenalty('pact_broken_spring_penalty_def', '[枷锁·碎铳之簧] 狂恍', 'def', -5, 'flat')],
    penaltyDesc: '枷锁：干员防御 -5',
  },
  // v3.1.0：高翔之狩 — 击杀飞行单位累积，干员攻击力分级提升
  'pact_aerial_hunter': {
    id: 'pact_aerial_hunter',
    name: '高翔之狩',
    desc: '每次击杀飞行单位累积猎心；分级提升全体干员攻击力',
    scope: 'all_operators',
    sources: [{ source: 'kill_flying', perEvent: 1 }],
    cap: 12,
    tiers: [
      { threshold: 2, description: 'tier1：攻击力 +5%', effects: [mkPactEffect('pact_aerial_hunter_t0_atk', '[盟约·高翔之狩] 猎心 I', 'atk', 0.05, 'pct')] },
      { threshold: 5, description: 'tier2：攻击力 +12%', effects: [mkPactEffect('pact_aerial_hunter_t1_atk', '[盟约·高翔之狩] 猎心 II', 'atk', 0.12, 'pct')] },
      { threshold: 10, description: 'tier3：攻击力 +20%', effects: [mkPactEffect('pact_aerial_hunter_t2_atk', '[盟约·高翔之狩] 猎心 III', 'atk', 0.20, 'pct')] },
    ],
    // v3.2.0：枷锁 — 魔抗 -3 flat
    penalty: [mkPactPenalty('pact_aerial_hunter_penalty_mr', '[枷锁·高翔之狩] 高处不胜寒', 'magicResist', -3, 'flat')],
    penaltyDesc: '枷锁：干员魔抗 -3',
  },
  // v3.1.0：钢铁誓约 — 部署任意干员累积，分级提升全体防御（flat）
  'pact_iron_resolve': {
    id: 'pact_iron_resolve',
    name: '钢铁誓约',
    desc: '每次部署干员累积誓言；分级提升全体干员防御力（固定值）',
    scope: 'all_operators',
    sources: [{ source: 'deploy_any', perEvent: 1 }],
    cap: 8,
    tiers: [
      { threshold: 2, description: 'tier1：防御 +5', effects: [mkPactEffect('pact_iron_resolve_t0_def', '[盟约·钢铁誓约] 誓言 I', 'def', 5, 'flat')] },
      { threshold: 4, description: 'tier2：防御 +12', effects: [mkPactEffect('pact_iron_resolve_t1_def', '[盟约·钢铁誓约] 誓言 II', 'def', 12, 'flat')] },
      { threshold: 8, description: 'tier3：防御 +25', effects: [mkPactEffect('pact_iron_resolve_t2_def', '[盟约·钢铁誓约] 誓言 III', 'def', 25, 'flat')] },
    ],
    // v3.2.0：枷锁 — 攻击力 -8%
    penalty: [mkPactPenalty('pact_iron_resolve_penalty_atk', '[枷锁·钢铁誓约] 笨重', 'atk', -0.08, 'pct')],
    penaltyDesc: '枷锁：干员攻击 -8%',
  },
};

// v3.1.0：默认激活盟约（开发期 fallback；正式开局走 PactScreen 选择 → 透传至 GameEngine）
export const DEFAULT_ACTIVE_PACTS: string[] = ['pact_flame_blessing', 'pact_lingering_echo', 'pact_broken_spring'];

// v3.1.0：开局可选盟约清单（PactScreen 渲染来源，可与 PACT_DB 不完全一致 — 例如保留某些隐藏/事件盟约）
export const SELECTABLE_PACTS: string[] = [
  'pact_flame_blessing',
  'pact_lingering_echo',
  'pact_broken_spring',
  'pact_aerial_hunter',
  'pact_iron_resolve',
];

// v3.1.0：开局选择盟约的数量上下限
export const PACT_PICK_MIN = 1;
export const PACT_PICK_MAX = 2;

// v3.3.0：盟约共鸣 — 多个盟约同时达 minTier 时触发额外加成
const mkResoEffect = (id: string, name: string, stat: 'atk' | 'def' | 'aspd' | 'spd' | 'magicResist' | 'blockCount', mod: number, modType: 'flat' | 'pct'): StatusEffect => ({
  id, name, kind: 'buff', stat, mod, modType, duration: -1, remaining: -1,
});

export const RESONANCE_DB: Record<string, PactResonance> = {
  reso_flame_storm: {
    id: 'reso_flame_storm',
    name: '共鸣·烈风',
    desc: '烎佑 + 空中猎手 同时达 tier1：全体攻击 +8%',
    requires: [
      { defId: 'pact_flame_blessing', minTier: 0 },
      { defId: 'pact_aerial_hunter', minTier: 0 },
    ],
    scope: 'all_operators',
    effects: [mkResoEffect('resonance_reso_flame_storm_atk', '[共鸣·烈风] 炽烈之心', 'atk', 0.08, 'pct')],
  },
  reso_iron_echo: {
    id: 'reso_iron_echo',
    name: '共鸣·坚壁',
    desc: '钢铁誓约 + 余音回响 同时达 tier1：全体魔抗 +8',
    requires: [
      { defId: 'pact_iron_resolve', minTier: 0 },
      { defId: 'pact_lingering_echo', minTier: 0 },
    ],
    scope: 'all_operators',
    effects: [mkResoEffect('resonance_reso_iron_echo_mr', '[共鸣·坚壁] 不动之余', 'magicResist', 8, 'flat')],
  },
};
