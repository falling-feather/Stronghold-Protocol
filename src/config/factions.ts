// === 阵营数据库 ===
// 玩家在进入战局前必须选择一个阵营，阵营会修改基础初始资源
// 这是 v1.3.0 引入的前置流程

export type FactionId = 'command' | 'logistics';

export interface FactionEffect {
  // 与 CONFIG.BASE_LIVES / BASE_MONEY 是「绝对覆盖」语义；undefined 则保留默认
  initialLives?: number;
  initialMoney?: number;
}

export interface FactionDef {
  id: FactionId;
  name: string;          // 中文名（如「指挥」）
  shortDesc: string;     // 阵营标签（用于卡片）
  fullDesc: string;      // 详情区描述
  color: string;         // 主题色（卡片描边/标题）
  effect: FactionEffect; // 数值效果
  perks: string[];       // 详情区列表展示的 buff 项
}

export const FACTION_DB: Record<FactionId, FactionDef> = {
  command: {
    id: 'command',
    name: '指挥',
    shortDesc: '前线指挥部 · 重防守',
    fullDesc: '依托坚固的前线指挥所，承受更高的进攻压力。代价是常规资金不变，必须更精打细算。',
    color: '#c0392b',
    effect: { initialLives: 30 },
    perks: [
      '初始生命：30（默认 10）',
      '初始资金：保持默认（15）',
      '适合稳健防守、容错率高的打法'
    ]
  },
  logistics: {
    id: 'logistics',
    name: '后勤',
    shortDesc: '后勤补给线 · 重经济',
    fullDesc: '充裕的开局资金允许你在第一波就拉出更厚的阵容，但承伤上限不变，开局更脆。',
    color: '#16a085',
    effect: { initialMoney: 20 },
    perks: [
      '初始生命：保持默认（10）',
      '初始资金：20（默认 15）',
      '适合速攻 / 高风险高回报打法'
    ]
  }
};

const STORAGE_KEY = 'sp.selectedFaction';

export function getSavedFactionId(): FactionId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'command' || v === 'logistics') return v;
  } catch { /* localStorage 不可用 */ }
  return 'command';
}

export function saveFactionId(id: FactionId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* 忽略 */ }
}

export function listFactions(): FactionDef[] {
  return [FACTION_DB.command, FACTION_DB.logistics];
}
