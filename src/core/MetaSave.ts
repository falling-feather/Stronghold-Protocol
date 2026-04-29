// v3.6.0：跨局 meta 进度持久化
// localStorage key: sp_meta_v1
// 数据结构：{ shards: number, upgrades: Record<upgradeId, tier>, stats?, achievements? }

const META_KEY = 'sp_meta_v1';

export interface MetaStats {
  totalWavesCleared: number;
  totalRunsWon: number;
  totalRunsAttempted: number;
  totalEpicEvents: number;
  maxResonanceInRun: number;
  boonsUsed: string[];
  shackledRunsWon: number;
}

export interface DailyState {
  lastCompletedDate: string; // YYYY-MM-DD；空串表示从未完成
}

export interface MetaSave {
  shards: number;
  upgrades: Record<string, number>;
  // v3.7.0
  stats: MetaStats;
  achievements: string[]; // 已解锁成就 id
  // v3.8.0
  daily: DailyState;
}

const DEFAULT_STATS: MetaStats = {
  totalWavesCleared: 0,
  totalRunsWon: 0,
  totalRunsAttempted: 0,
  totalEpicEvents: 0,
  maxResonanceInRun: 0,
  boonsUsed: [],
  shackledRunsWon: 0,
};

const DEFAULT_DAILY: DailyState = { lastCompletedDate: '' };

const DEFAULT_META: MetaSave = { shards: 0, upgrades: {}, stats: { ...DEFAULT_STATS }, achievements: [], daily: { ...DEFAULT_DAILY } };

let cache: MetaSave | null = null;

export function loadMeta(): MetaSave {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      cache = { ...DEFAULT_META };
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = {
      shards: typeof parsed.shards === 'number' ? parsed.shards : 0,
      upgrades: parsed.upgrades && typeof parsed.upgrades === 'object' ? parsed.upgrades : {},
      stats: { ...DEFAULT_STATS, ...(parsed.stats ?? {}) },
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      daily: { ...DEFAULT_DAILY, ...(parsed.daily ?? {}) },
    };
    return cache;
  } catch {
    cache = { ...DEFAULT_META };
    return cache;
  }
}

export function saveMeta(m?: MetaSave): void {
  const data = m ?? cache ?? DEFAULT_META;
  cache = data;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(data));
  } catch {
    // 忽略隐私模式 / 存储满
  }
}

export function addShards(n: number): void {
  const m = loadMeta();
  m.shards = Math.max(0, m.shards + n);
  saveMeta(m);
}

export function getUpgradeTier(id: string): number {
  return loadMeta().upgrades[id] ?? 0;
}

export function setUpgradeTier(id: string, tier: number): void {
  const m = loadMeta();
  m.upgrades[id] = tier;
  saveMeta(m);
}

export function resetMeta(): void {
  cache = { ...DEFAULT_META };
  saveMeta(cache);
}

// v3.6.3：重置并按比例返还已花费碎片（pct 默认 0.8）
export function resetMetaWithRefund(totalSpent: number, pct: number = 0.8): number {
  const refund = Math.floor(totalSpent * pct);
  cache = { shards: refund, upgrades: {}, stats: loadMeta().stats, achievements: loadMeta().achievements, daily: loadMeta().daily };
  saveMeta(cache);
  return refund;
}

// v3.7.0：stats / achievements 操作
export function getStats(): MetaStats {
  return loadMeta().stats;
}

export function bumpStat<K extends keyof MetaStats>(key: K, delta: number): void {
  const m = loadMeta();
  const cur = m.stats[key];
  if (typeof cur === 'number') {
    (m.stats[key] as number) = cur + delta;
    saveMeta(m);
  }
}

export function setStatMax<K extends keyof MetaStats>(key: K, value: number): void {
  const m = loadMeta();
  const cur = m.stats[key];
  if (typeof cur === 'number' && value > cur) {
    (m.stats[key] as number) = value;
    saveMeta(m);
  }
}

export function recordBoonUsed(boonId: string): void {
  const m = loadMeta();
  if (!m.stats.boonsUsed.includes(boonId)) {
    m.stats.boonsUsed.push(boonId);
    saveMeta(m);
  }
}

export function isAchievementUnlocked(id: string): boolean {
  return loadMeta().achievements.includes(id);
}

export function unlockAchievement(id: string): boolean {
  const m = loadMeta();
  if (m.achievements.includes(id)) return false;
  m.achievements.push(id);
  saveMeta(m);
  return true;
}

// v3.8.0：每日挑战
export function getDailyState(): DailyState {
  return loadMeta().daily;
}

export function setDailyCompleted(date: string): void {
  const m = loadMeta();
  m.daily.lastCompletedDate = date;
  saveMeta(m);
}
