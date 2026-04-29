// v3.8.0：每日挑战 — 基于日期的伪随机种子生成固定盟约组合
import { PACT_DB } from './gameData';

export interface DailyChallenge {
  date: string;          // YYYY-MM-DD
  pactIds: string[];     // 3 个固定盟约
  shackledIds: string[]; // 其中 1 个为枷锁
  rewardShards: number;  // 通关奖励
  modifierLabel: string; // 简短描述
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDailyChallenge(date: string = getTodayDate()): DailyChallenge {
  const seed = parseInt(date.replace(/-/g, ''), 10) || 1;
  const rng = mulberry32(seed);
  const allPacts = Object.keys(PACT_DB);
  // 打乱
  const shuffled = [...allPacts].sort(() => rng() - 0.5);
  const pactIds = shuffled.slice(0, Math.min(3, shuffled.length));
  const shackledIdx = Math.floor(rng() * pactIds.length);
  const shackledIds = pactIds.length > 0 ? [pactIds[shackledIdx]] : [];
  return {
    date,
    pactIds,
    shackledIds,
    rewardShards: 150,
    modifierLabel: '固定 3 盟约（含 1 枷锁），通关 +150 碎片，每天可挑战 1 次',
  };
}
