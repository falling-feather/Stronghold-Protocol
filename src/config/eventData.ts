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
