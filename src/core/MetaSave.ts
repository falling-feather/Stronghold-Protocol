// v3.6.0：跨局 meta 进度持久化
// localStorage key: sp_meta_v1
// 数据结构：{ shards: number, upgrades: Record<upgradeId, tier> }

const META_KEY = 'sp_meta_v1';

export interface MetaSave {
  shards: number;
  upgrades: Record<string, number>;
}

const DEFAULT_META: MetaSave = { shards: 0, upgrades: {} };

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
  cache = { shards: refund, upgrades: {} };
  saveMeta(cache);
  return refund;
}
