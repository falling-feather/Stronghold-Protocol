// === 阵容编排（v1.3.0） ===
// 玩家在进入战局前，按稀有度从候选池中挑选出战名单
// 未选中的干员不会进入商店刷新池
// 若某个稀有度的候选数 ≤ 槽位数，则该稀有度全选（无可操作）

import { OPERATOR_DB } from './gameData';

// 每个稀有度的「出战槽位数」
// 候选数 ≤ slots 时全选；> slots 时强制玩家选满 slots 个
export const ROSTER_SLOTS: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 1,
  5: 1
};

// roster: rarity -> templateId[]
export type Roster = Record<number, string[]>;

const STORAGE_KEY = 'sp.roster.v1';

// 按稀有度归类候选 templateId 列表
export function getCandidatesByRarity(): Record<number, string[]> {
  const map: Record<number, string[]> = {};
  for (const [id, t] of Object.entries(OPERATOR_DB)) {
    const r = t.rarity;
    if (!map[r]) map[r] = [];
    map[r].push(id);
  }
  return map;
}

// 默认阵容：每个稀有度取前 N 个候选（N = slots）
export function getDefaultRoster(): Roster {
  const cands = getCandidatesByRarity();
  const r: Roster = {};
  for (const [rarityStr, ids] of Object.entries(cands)) {
    const rarity = Number(rarityStr);
    const slots = ROSTER_SLOTS[rarity] ?? 1;
    r[rarity] = ids.slice(0, Math.min(slots, ids.length));
  }
  return r;
}

// 加载阵容；若数据不合法则回退到默认
export function loadRoster(): Roster {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Roster;
      const fixed = sanitizeRoster(parsed);
      return fixed;
    }
  } catch { /* ignore */ }
  return getDefaultRoster();
}

export function saveRoster(roster: Roster): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
  } catch { /* ignore */ }
}

// 清洗：剔除已不存在的 templateId、按 slots 截断
export function sanitizeRoster(roster: Roster): Roster {
  const cands = getCandidatesByRarity();
  const out: Roster = {};
  for (const rarityStr of Object.keys(cands)) {
    const rarity = Number(rarityStr);
    const slots = ROSTER_SLOTS[rarity] ?? 1;
    const allowed = new Set(cands[rarity]);
    const picked = (roster[rarity] || []).filter(id => allowed.has(id));
    out[rarity] = picked.slice(0, slots);
  }
  return out;
}

// 校验：每个稀有度都必须选满 min(slots, candidates) 个
// 返回缺失的稀有度列表
export function validateRoster(roster: Roster): { ok: boolean, missing: number[] } {
  const cands = getCandidatesByRarity();
  const missing: number[] = [];
  for (const rarityStr of Object.keys(cands)) {
    const rarity = Number(rarityStr);
    const slots = ROSTER_SLOTS[rarity] ?? 1;
    const required = Math.min(slots, cands[rarity].length);
    const picked = (roster[rarity] || []).length;
    if (picked < required) missing.push(rarity);
  }
  return { ok: missing.length === 0, missing };
}

// 转成 Set 供 GameEngine 过滤抽取池
export function rosterToAllowedSet(roster: Roster): Set<string> {
  const set = new Set<string>();
  for (const ids of Object.values(roster)) {
    ids.forEach(id => set.add(id));
  }
  return set;
}
