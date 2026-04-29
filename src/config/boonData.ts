// v3.6.2：开局福利（Boons）- 每局抽 3 选 1 增益
// 与 meta 升级树不同，boon 仅作用于本局，提供"build variety"

export type BoonId =
  | 'boon_starting_money'
  | 'boon_starting_sp'
  | 'boon_starting_lives'
  | 'boon_pact_warmup'
  | 'boon_event_chance'
  | 'boon_shop_discount'
  | 'boon_double_first_event'
  // v3.13.0
  | 'boon_kill_bounty'
  | 'boon_wave_bonus'
  | 'boon_starting_money_big';

export interface Boon {
  id: BoonId;
  name: string;
  desc: string;
  icon: string;
  rarity: 'common' | 'rare';
}

export const BOON_DB: Record<BoonId, Boon> = {
  boon_starting_money: {
    id: 'boon_starting_money',
    name: '充裕预算',
    desc: '开局额外 +60 资金',
    icon: '💰',
    rarity: 'common',
  },
  boon_starting_sp: {
    id: 'boon_starting_sp',
    name: '能量预热',
    desc: '所有部署干员起始 SP +15',
    icon: '⚡',
    rarity: 'common',
  },
  boon_starting_lives: {
    id: 'boon_starting_lives',
    name: '加固防线',
    desc: '开局生命 +2',
    icon: '🛡️',
    rarity: 'common',
  },
  boon_pact_warmup: {
    id: 'boon_pact_warmup',
    name: '誓约觉醒',
    desc: '所有携带盟约开局 +2 stack',
    icon: '🔥',
    rarity: 'common',
  },
  boon_event_chance: {
    id: 'boon_event_chance',
    name: '命运牵引',
    desc: '事件触发概率 +20%',
    icon: '🎴',
    rarity: 'rare',
  },
  boon_shop_discount: {
    id: 'boon_shop_discount',
    name: '黑市渠道',
    desc: '商店干员价格 -15%',
    icon: '🏷️',
    rarity: 'rare',
  },
  boon_double_first_event: {
    id: 'boon_double_first_event',
    name: '初遇眷顾',
    desc: '本局必触发首个事件（首次结算波次后）',
    icon: '✨',
    rarity: 'rare',
  },
  // v3.13.0
  boon_kill_bounty: {
    id: 'boon_kill_bounty',
    name: '赏金猟人',
    desc: '每击杀一名敌人额外 +1 资金',
    icon: '💵',
    rarity: 'common',
  },
  boon_wave_bonus: {
    id: 'boon_wave_bonus',
    name: '后勤补给',
    desc: '每波结算额外 +15 资金',
    icon: '📦',
    rarity: 'common',
  },
  boon_starting_money_big: {
    id: 'boon_starting_money_big',
    name: '重金启动',
    desc: '开局额外 +120 资金（与「充裕预算」不叠加）',
    icon: '💰',
    rarity: 'rare',
  },
};

const RARITY_WEIGHT: Record<Boon['rarity'], number> = {
  common: 60,
  rare: 30,
};

// 从 BOON_DB 抽 3 个不重复（按 rarity 加权）
export function rollBoonChoices(rng: () => number = Math.random): Boon[] {
  const all = Object.values(BOON_DB);
  const picks: Boon[] = [];
  const pool = [...all];
  while (picks.length < 3 && pool.length > 0) {
    const weights = pool.map(b => RARITY_WEIGHT[b.rarity] ?? 30);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picks;
}
