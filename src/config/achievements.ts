// v3.7.0：成就定义 + 解锁判定
import { MetaStats } from '../core/MetaSave';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  // 进度获取（current, target）
  progress: (s: MetaStats) => { cur: number; target: number };
  reward: { shards?: number; note?: string };
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach_first_win',
    name: '首胜',
    desc: '完成 1 次通关',
    icon: '🏅',
    progress: (s) => ({ cur: s.totalRunsWon, target: 1 }),
    reward: { shards: 30, note: '+30 碎片' },
  },
  {
    id: 'ach_veteran',
    name: '沙场老将',
    desc: '累计完成 50 波',
    icon: '⚔️',
    progress: (s) => ({ cur: s.totalWavesCleared, target: 50 }),
    reward: { shards: 50, note: '+50 碎片' },
  },
  {
    id: 'ach_centurion',
    name: '百战之躯',
    desc: '累计完成 200 波',
    icon: '🛡️',
    progress: (s) => ({ cur: s.totalWavesCleared, target: 200 }),
    reward: { shards: 150, note: '+150 碎片' },
  },
  {
    id: 'ach_epic_seeker',
    name: '深渊探求',
    desc: '累计触发 10 张史诗事件',
    icon: '✨',
    progress: (s) => ({ cur: s.totalEpicEvents, target: 10 }),
    reward: { shards: 80, note: '+80 碎片' },
  },
  {
    id: 'ach_resonance_master',
    name: '共鸣大师',
    desc: '单局触发 ≥3 个共鸣',
    icon: '💫',
    progress: (s) => ({ cur: Math.min(s.maxResonanceInRun, 3), target: 3 }),
    reward: { shards: 100, note: '+100 碎片' },
  },
  {
    id: 'ach_shackled_winner',
    name: '枷锁勇者',
    desc: '携带至少 1 个枷锁通关 1 次',
    icon: '⛓️',
    progress: (s) => ({ cur: s.shackledRunsWon, target: 1 }),
    reward: { shards: 120, note: '+120 碎片' },
  },
  {
    id: 'ach_boon_collector',
    name: '福利收藏家',
    desc: '尝试过全部 7 个 boon',
    icon: '🎴',
    progress: (s) => ({ cur: s.boonsUsed.length, target: 7 }),
    reward: { shards: 200, note: '+200 碎片' },
  },
  {
    id: 'ach_persistent',
    name: '不屈意志',
    desc: '累计开始 20 次对局',
    icon: '🔁',
    progress: (s) => ({ cur: s.totalRunsAttempted, target: 20 }),
    reward: { shards: 40, note: '+40 碎片' },
  },
];

// 检查所有成就，返回新解锁的列表（已带 reward 信息，由调用方处理碎片发放）
export function checkAchievements(stats: MetaStats, alreadyUnlocked: string[]): Achievement[] {
  const unlocked: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (alreadyUnlocked.includes(a.id)) continue;
    const p = a.progress(stats);
    if (p.cur >= p.target) unlocked.push(a);
  }
  return unlocked;
}
