// v3.5.0：事件卡数据库
import { EventCard } from '../types';
import { getEpicWeightBonus } from './metaData';

export const EVENT_DB: Record<string, EventCard> = {
  ev_mystic_merchant: {
    id: 'ev_mystic_merchant',
    name: '神秘商人',
    desc: '一位戴着兜帽的旅人在战场边缘摆开了摊子，他的货物似乎来自远方……',
    rarity: 'common',
    options: [
      {
        label: '购买物资（+200 资金）',
        desc: '直接获得 200 资金',
        apply: (e) => { e.money += 200; e.notifyUpdate(); },
      },
      {
        label: '换取火种（炎佑 +5 层）',
        desc: '盟约·炎佑 stack +5',
        apply: (e) => { e.addPactStack('pact_flame_blessing', 5); },
      },
      {
        label: '换取齿轮（碎铳之簧 +5 层）',
        desc: '盟约·碎铳之簧 stack +5',
        apply: (e) => { e.addPactStack('pact_broken_spring', 5); },
      },
    ],
  },
  ev_wandering_mage: {
    id: 'ev_wandering_mage',
    name: '流浪法师',
    desc: '一位法师路过营地，愿提供短暂的协助。',
    rarity: 'common',
    options: [
      {
        label: '集体冥想（全员 SP +10）',
        desc: '所有已部署干员 currentSp +10',
        apply: (e) => { e.addAllOperatorsSp(10); e.notifyUpdate(); },
      },
      {
        label: '魔法转换（+150 资金）',
        desc: '法师将多余的法力转换为资金',
        apply: (e) => { e.money += 150; e.notifyUpdate(); },
      },
      {
        label: '回响共鸣（余音回响 +2 层）',
        desc: '盟约·余音回响 stack +2',
        apply: (e) => { e.addPactStack('pact_lingering_echo', 2); },
      },
    ],
  },
  ev_battlefield_relic: {
    id: 'ev_battlefield_relic',
    name: '战场遗物',
    desc: '硝烟散去，地上有一件还散发着微光的遗物。',
    rarity: 'rare',
    options: [
      {
        label: '熔铸成盾（钢铁誓约 +3 层）',
        desc: '盟约·钢铁誓约 stack +3',
        apply: (e) => { e.addPactStack('pact_iron_resolve', 3); },
      },
      {
        label: '改造为弩（空中猎手 +3 层）',
        desc: '盟约·空中猎手 stack +3',
        apply: (e) => { e.addPactStack('pact_aerial_hunter', 3); },
      },
      {
        label: '原样留存（+100 资金）',
        desc: '直接出售获得 100 资金',
        apply: (e) => { e.money += 100; e.notifyUpdate(); },
      },
    ],
  },
  ev_black_market: {
    id: 'ev_black_market',
    name: '黑市交易',
    desc: '一名走私贩私下兜售危险但高效的物品，需要付出代价。',
    rarity: 'rare',
    cooldown: 3,
    options: [
      {
        label: '高价火药（-150 资金，炎佑 +10 层）',
        desc: '资金 -150，盟约·炎佑 stack +10',
        apply: (e) => {
          if (e.money >= 150) {
            e.money -= 150;
            e.addPactStack('pact_flame_blessing', 10);
          } else {
            // 资金不足时跳过（提示可选）
            e.notifyUpdate();
          }
        },
      },
      {
        label: '黑市兴奋剂（-100 资金，全员 SP +15）',
        desc: '资金 -100，全员 SP +15',
        apply: (e) => {
          if (e.money >= 100) {
            e.money -= 100;
            e.addAllOperatorsSp(15);
          }
          e.notifyUpdate();
        },
      },
      {
        label: '婉拒离开',
        desc: '不发生任何事情',
        apply: (e) => { e.notifyUpdate(); },
      },
    ],
  },
  ev_old_veteran: {
    id: 'ev_old_veteran',
    name: '老兵的告诫',
    desc: '一位退役老兵向你分享他的经验，但他需要你做出选择。',    rarity: 'common',    options: [
      {
        label: '聆听战术（钢铁誓约 +2、空中猎手 +2 层）',
        desc: '钢铁誓约 +2、空中猎手 +2',
        apply: (e) => {
          e.addPactStack('pact_iron_resolve', 2);
          e.addPactStack('pact_aerial_hunter', 2);
        },
      },
      {
        label: '索要补贴（+120 资金）',
        desc: '老兵掏出私藏的金币',
        apply: (e) => { e.money += 120; e.notifyUpdate(); },
      },
      {
        label: '默默致敬',
        desc: '不发生任何事情',
        apply: (e) => { e.notifyUpdate(); },
      },
    ],
  },
  // === v3.5.2：高品事件（epic）===
  ev_ancient_altar: {
    id: 'ev_ancient_altar',
    name: '远古祭坛',
    desc: '一座沉睡多年的祭坛在战场中央苏醒，渗出的力量令人心悸又心动。',
    rarity: 'epic',    minWave: 5,
    once: true,    options: [
      {
        label: '献祭资金（-200 资金，全员 SP +30）',
        desc: '资金 -200，全员 SP +30',
        apply: (e) => {
          if (e.money >= 200) {
            e.money -= 200;
            e.addAllOperatorsSp(30);
          }
          e.notifyUpdate();
        },
      },
      {
        label: '吸取火焰（炎佑 +12 层）',
        desc: '盟约·炎佑 stack +12',
        apply: (e) => { e.addPactStack('pact_flame_blessing', 12); },
      },
      {
        label: '远走他乡（+300 资金）',
        desc: '不动祭坛，搜刮周围获得 300 资金',
        apply: (e) => { e.money += 300; e.notifyUpdate(); },
      },
    ],
  },
  ev_oracle_vision: {
    id: 'ev_oracle_vision',
    name: '先知的启示',
    desc: '一位先知向你低语未来的轮廓，并要求你做出抉择。',
    rarity: 'epic',    minWave: 4,
    once: true,    options: [
      {
        label: '钢铁之路（钢铁 +6、空中 +6 层）',
        desc: '钢铁誓约 +6、空中猎手 +6',
        apply: (e) => {
          e.addPactStack('pact_iron_resolve', 6);
          e.addPactStack('pact_aerial_hunter', 6);
        },
      },
      {
        label: '余响之路（余音 +6、碎铳 +6 层）',
        desc: '余音回响 +6、碎铳之簧 +6',
        apply: (e) => {
          e.addPactStack('pact_lingering_echo', 6);
          e.addPactStack('pact_broken_spring', 6);
        },
      },
      {
        label: '焰路（炎佑 +10 层）',
        desc: '盟约·炎佑 stack +10',
        apply: (e) => { e.addPactStack('pact_flame_blessing', 10); },
      },
    ],
  },
  ev_treasure_chest: {
    id: 'ev_treasure_chest',
    name: '宝箱',
    desc: '一个镶满宝石的箱子静静躺在路边，看起来无主之物。',
    rarity: 'epic',
    minWave: 3,
    once: true,
    options: [
      {
        label: '直接打开（+400 资金）',
        desc: '直接获得 400 资金',
        apply: (e) => { e.money += 400; e.notifyUpdate(); },
      },
      {
        label: '小心拆解（全员 SP +20，钢铁 +4 层）',
        desc: '全员 SP +20，钢铁誓约 +4',
        apply: (e) => {
          e.addAllOperatorsSp(20);
          e.addPactStack('pact_iron_resolve', 4);
        },
      },
      {
        label: '原路离开',
        desc: '不发生任何事情（避险）',
        apply: (e) => { e.notifyUpdate(); },
      },
    ],
  },
  // === v3.14.0：新增 5 张事件卡（含 2 负面）===
  ev_supply_drop: {
    id: 'ev_supply_drop',
    name: '补给空投',
    desc: '一架不明运输机抛下了一个补给箱，你需要决定如何使用它。',
    rarity: 'common',
    options: [
      {
        label: '资金分发（+180 资金）',
        desc: '直接获得 180 资金',
        apply: (e) => { e.money += 180; e.notifyUpdate(); },
      },
      {
        label: '能源补给（全员 SP +12）',
        desc: '所有已部署干员 currentSp +12',
        apply: (e) => { e.addAllOperatorsSp(12); e.notifyUpdate(); },
      },
      {
        label: '弹药补给（碎铳之簧 +4 层）',
        desc: '盟约·碎铳之簧 stack +4',
        apply: (e) => { e.addPactStack('pact_broken_spring', 4); },
      },
    ],
  },
  ev_field_meditation: {
    id: 'ev_field_meditation',
    name: '战地冥想',
    desc: '短暂的宁静让干员们获得了一次集中精神的机会。',
    rarity: 'common',
    options: [
      {
        label: '统一冥想（全员 SP +18）',
        desc: '所有已部署干员 currentSp +18',
        apply: (e) => { e.addAllOperatorsSp(18); e.notifyUpdate(); },
      },
      {
        label: '聆听余响（余音回响 +3 层）',
        desc: '盟约·余音回响 stack +3',
        apply: (e) => { e.addPactStack('pact_lingering_echo', 3); },
      },
      {
        label: '默默站岗（不触发任何效果）',
        desc: '错过此次机会',
        apply: (e) => { e.notifyUpdate(); },
      },
    ],
  },
  // 负面 1：风暴预警 — 三选一全有代价
  ev_storm_warning: {
    id: 'ev_storm_warning',
    name: '风暴预警',
    desc: '前线传来恶劣天气警告，无论如何都要付出一些代价。',
    rarity: 'rare',
    cooldown: 3,
    options: [
      {
        label: '加固防御（-100 资金，钢铁誓约 +4 层）',
        desc: '资金 -100，钢铁誓约 stack +4',
        apply: (e) => {
          if (e.money >= 100) {
            e.money -= 100;
            e.addPactStack('pact_iron_resolve', 4);
          } else {
            e.notifyUpdate();
          }
        },
      },
      {
        label: '紧急后撤（-1 钢铁誓约，全员 SP +20）',
        desc: '钢铁誓约 stack -1，全员 SP +20',
        apply: (e) => {
          e.addPactStack('pact_iron_resolve', -1);
          e.addAllOperatorsSp(20);
          e.notifyUpdate();
        },
      },
      {
        label: '硬抗损失（-50 资金）',
        desc: '资金 -50，无其它效果',
        apply: (e) => {
          e.money = Math.max(0, e.money - 50);
          e.notifyUpdate();
        },
      },
    ],
  },
  // 负面 2：破坏者潜入 — 必触发损失
  ev_saboteur: {
    id: 'ev_saboteur',
    name: '破坏者潜入',
    desc: '一名敌方破坏者混入营地，必须立刻处理但代价不小。',
    rarity: 'rare',
    cooldown: 4,
    options: [
      {
        label: '雇佣赏金猎人（-180 资金）',
        desc: '资金 -180，破坏者被清理',
        apply: (e) => {
          e.money = Math.max(0, e.money - 180);
          e.notifyUpdate();
        },
      },
      {
        label: '让干员追捕（全员 SP -10）',
        desc: '所有干员 SP -10（不会低于 0）',
        apply: (e) => {
          // 复用 addAllOperatorsSp，传负值会被 Math.min(skill.cost,..) 限制；这里手写减
          e.addAllOperatorsSp(-10);
          e.notifyUpdate();
        },
      },
      {
        label: '放任不管（炎佑 -2、碎铳 -2 层）',
        desc: '盟约 stack 受损：炎佑 -2、碎铳之簧 -2',
        apply: (e) => {
          e.addPactStack('pact_flame_blessing', -2);
          e.addPactStack('pact_broken_spring', -2);
          e.notifyUpdate();
        },
      },
    ],
  },
  // 史诗正面：藏宝图（once, 后期）
  ev_treasure_map: {
    id: 'ev_treasure_map',
    name: '藏宝图碎片',
    desc: '一片泛黄的藏宝图碎片在战场拾得，似乎指向某处宝藏。',
    rarity: 'epic',
    minWave: 4,
    once: true,
    options: [
      {
        label: '兑换情报（+350 资金）',
        desc: '直接卖出获得 350 资金',
        apply: (e) => { e.money += 350; e.notifyUpdate(); },
      },
      {
        label: '寻找宝藏（破甲 +5、狩猎 +5 层）',
        desc: '盟约·破甲誓约 +5、狩猎之心 +5',
        apply: (e) => {
          e.addPactStack('pact_shield_breaker', 5);
          e.addPactStack('pact_hunt_enrage', 5);
        },
      },
      {
        label: '献给营地（全员 SP +25，钢铁 +5 层）',
        desc: '全员 SP +25，钢铁誓约 +5',
        apply: (e) => {
          e.addAllOperatorsSp(25);
          e.addPactStack('pact_iron_resolve', 5);
        },
      },
    ],
  },
  // === v3.17.0：治疗/减速主题事件卡 ===
  ev_field_hospital: {
    id: 'ev_field_hospital',
    name: '前线野战医院',
    desc: '一支医疗分队短暂驻扎，营地的伤亡势头有了喘息空间。',
    rarity: 'rare',
    cooldown: 3,
    options: [
      {
        label: '全员急救（已部署干员 hp 回满）',
        desc: '所有非撤退干员 hp = maxHp',
        apply: (e) => { e.healAllOperatorsFull(); },
      },
      {
        label: '征用药品（-120 资金，全员 SP +20）',
        desc: '资金 -120 但所有干员 SP +20',
        apply: (e) => {
          if (e.money >= 120) { e.money -= 120; e.addAllOperatorsSp(20); }
          e.notifyUpdate();
        },
      },
      {
        label: '婉拒援助（+90 资金）',
        desc: '把医疗物资折价卖了换 90 资金',
        apply: (e) => { e.money += 90; e.notifyUpdate(); },
      },
    ],
  },
  ev_emp_storm: {
    id: 'ev_emp_storm',
    name: '电磁风暴',
    desc: '高空电磁扰动笼罩战场，敌我双方的节奏都将被打乱。',
    rarity: 'rare',
    cooldown: 4,
    options: [
      {
        label: '架设减速力场（消耗 80 资金，下波敌人初始减速 25%）',
        desc: '通过临时盟约层叠加：碎铳之簧 +3 层（间接减速）',
        apply: (e) => {
          if (e.money >= 80) { e.money -= 80; e.addPactStack('pact_broken_spring', 3); }
          e.notifyUpdate();
        },
      },
      {
        label: '听任风暴（全员 SP -8、+150 资金）',
        desc: 'SP 扰动换得意外赏金',
        apply: (e) => {
          e.addAllOperatorsSp(-8);
          e.money += 150;
          e.notifyUpdate();
        },
      },
      {
        label: '强行屏蔽（钢铁誓约 -2 层）',
        desc: '硬撑过去，无资源损失但盟约层数下降',
        apply: (e) => {
          e.addPactStack('pact_iron_resolve', -2);
          e.notifyUpdate();
        },
      },
    ],
  },
};

// 事件卡随机抽取（每波结束后按 EVENT_TRIGGER_CHANCE 概率触发）
export const EVENT_TRIGGER_CHANCE = 0.5;
export const EVENT_TRIGGER_MIN_WAVE = 1; // 第 1 波结束后才可能触发（即第 2 波开始前）

// v3.5.2：rarity → 默认 weight 映射
const RARITY_DEFAULT_WEIGHT: Record<NonNullable<EventCard['rarity']>, number> = {
  common: 100,
  rare: 35,
  epic: 10,
};

// v3.5.4：history 项类型（与 GameEngine.eventHistory 子集兼容）
export interface RollHistoryEntry {
  eventId: string;
  afterWave: number;
}

export function rollEvent(
  currentWave: number,
  history: RollHistoryEntry[] = [],
  chance: number = EVENT_TRIGGER_CHANCE,
  rng: () => number = Math.random,
): EventCard | null {
  if (rng() >= chance) return null;
  const all = Object.values(EVENT_DB);
  if (all.length === 0) return null;
  // v3.5.4：过滤可抽卡集合
  const cards = all.filter(c => {
    if (c.minWave !== undefined && currentWave < c.minWave) return false;
    if (c.maxWave !== undefined && currentWave > c.maxWave) return false;
    const hits = history.filter(h => h.eventId === c.id);
    if (c.once && hits.length > 0) return false;
    if (c.cooldown !== undefined && hits.length > 0) {
      const last = hits[hits.length - 1];
      if (currentWave - last.afterWave < c.cooldown) return false;
    }
    return true;
  });
  if (cards.length === 0) return null;
  const weights = cards.map(c => {
    const base = c.weight ?? RARITY_DEFAULT_WEIGHT[c.rarity ?? 'common'] ?? 50;
    // v3.6.1：epic 事件抽取权重加成（meta 升级"深渊低语"）
    if ((c.rarity ?? 'common') === 'epic') return base + getEpicWeightBonus();
    return base;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < cards.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return cards[i];
  }
  return cards[cards.length - 1];
}
