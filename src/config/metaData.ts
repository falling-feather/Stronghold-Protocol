// v3.6.0：跨局 meta 升级树定义
import { getUpgradeTier } from '../core/MetaSave';

export interface MetaUpgrade {
  id: string;
  name: string;
  desc: string;
  maxTier: number;
  costPerTier: (tier: number) => number; // 升到 tier+1 所需碎片
  // v3.6.1：前置依赖（required.id 升至 required.tier 才能购买）
  prereq?: { id: string; tier: number };
  // v3.6.3：分类标签（用于筛选/分组显示）
  tag: 'economy' | 'pact' | 'event' | 'defense';
}

export const META_UPGRADES: MetaUpgrade[] = [
  // 第 1 列（无前置）
  {
    id: 'meta_starting_money',
    name: '启动资金',
    desc: '每等级开局额外 +25 资金',
    maxTier: 4,
    costPerTier: (t) => 50 * (t + 1),
    tag: 'economy',
  },
  {
    id: 'meta_pact_extra_stack',
    name: '盟约预热',
    desc: '每等级所有携带盟约开局 +1 stack',
    maxTier: 3,
    costPerTier: (t) => 80 * (t + 1),
    tag: 'pact',
  },
  {
    id: 'meta_event_chance',
    name: '神秘指引',
    desc: '每等级事件触发概率 +5%',
    maxTier: 3,
    costPerTier: (t) => 70 * (t + 1),
    tag: 'event',
  },
  {
    id: 'meta_starting_sp',
    name: '初始法力',
    desc: '每等级新部署干员 +5 起始 SP',
    maxTier: 4,
    costPerTier: (t) => 40 * (t + 1),
    tag: 'economy',
  },
  // v3.6.1：第 2 列（有前置依赖）
  {
    id: 'meta_starting_lives',
    name: '坚壁计划',
    desc: '每等级开局额外 +1 生命',
    maxTier: 3,
    costPerTier: (t) => 90 * (t + 1),
    prereq: { id: 'meta_starting_money', tier: 2 },
    tag: 'defense',
  },
  {
    id: 'meta_shop_discount',
    name: '物流优势',
    desc: '每等级商店干员价格 -5%',
    maxTier: 3,
    costPerTier: (t) => 100 * (t + 1),
    prereq: { id: 'meta_starting_money', tier: 2 },
    tag: 'economy',
  },
  {
    id: 'meta_decay_resist',
    name: '韧链',
    desc: '每等级盟约 stack 衰减速率 -50%',
    maxTier: 2,
    costPerTier: (t) => 120 * (t + 1),
    prereq: { id: 'meta_pact_extra_stack', tier: 1 },
    tag: 'pact',
  },
  {
    id: 'meta_epic_weight',
    name: '深渊低语',
    desc: '每等级 epic 事件抽取权重 +5（默认 10）',
    maxTier: 3,
    costPerTier: (t) => 90 * (t + 1),
    prereq: { id: 'meta_event_chance', tier: 2 },
    tag: 'event',
  },
];

// v3.6.0：通用获取器 — 读 tier、计算下一级 cost
export function getMetaUpgradeTier(id: string): number {
  return getUpgradeTier(id);
}

// v3.6.1：检查前置是否满足
export function isPrereqMet(up: MetaUpgrade): boolean {
  if (!up.prereq) return true;
  return getUpgradeTier(up.prereq.id) >= up.prereq.tier;
}

// v3.6.3：tag 展示配置
export const TAG_LABELS: Record<MetaUpgrade['tag'], { label: string; color: string }> = {
  economy: { label: '经济', color: '#f1c40f' },
  pact: { label: '盟约', color: '#e74c3c' },
  event: { label: '事件', color: '#9b59b6' },
  defense: { label: '防御', color: '#3498db' },
};

// v3.6.3：计算所有升级累计已花费碎片（用于重置返还）
export function calcTotalSpentShards(): number {
  let total = 0;
  for (const up of META_UPGRADES) {
    const tier = getUpgradeTier(up.id);
    for (let t = 0; t < tier; t++) {
      total += up.costPerTier(t);
    }
  }
  return total;
}

// 数值便捷方法（GameEngine 与构造时使用）
export function getStartingMoneyBonus(): number {
  return getUpgradeTier('meta_starting_money') * 25;
}
export function getPactExtraStack(): number {
  return getUpgradeTier('meta_pact_extra_stack');
}
export function getEventChanceBonus(): number {
  return getUpgradeTier('meta_event_chance') * 0.05;
}
export function getStartingSpBonus(): number {
  return getUpgradeTier('meta_starting_sp') * 5;
}
// v3.6.1
export function getStartingLivesBonus(): number {
  return getUpgradeTier('meta_starting_lives');
}
export function applyShopDiscount(price: number): number {
  const t = getUpgradeTier('meta_shop_discount');
  return Math.max(1, Math.round(price * (1 - 0.05 * t)));
}
export function getDecayMultiplier(): number {
  // 每等级 -50% 衰减；2 级 = 25% 残留
  const t = getUpgradeTier('meta_decay_resist');
  return Math.pow(0.5, t);
}
export function getEpicWeightBonus(): number {
  return getUpgradeTier('meta_epic_weight') * 5;
}

// 战斗结束时碎片产出
export function calcShardsForRun(opts: { wavesCleared: number; victory: boolean; epicEventsTriggered: number }): number {
  const base = opts.wavesCleared * (opts.victory ? 8 : 4);
  const epicBonus = opts.epicEventsTriggered * 15;
  const winBonus = opts.victory ? 50 : 0;
  return base + epicBonus + winBonus;
}
