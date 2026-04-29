// === 商店系统（v1.5.0 从 GameEngine 拆出）===
// 持有：商店刷新池、临时商店、角色获取池统计
// 与 GameEngine 通过引用协作（读 phase/money/bench/operators，调用 recallOperator/notifyUpdate）

import { OPERATOR_DB, RARITY_RATES, CONFIG } from '../config/gameData';
import { ShopItem, OperatorPoolStats } from '../types';
import type { GameEngine } from './GameEngine';

const POOL_LIMIT = 7;
const REFRESH_COST = 2;

export class ShopSystem {
  shopItems: ShopItem[] = [];
  temporaryShopItems: ShopItem[] = [];
  isInTemporaryShop: boolean = false;
  operatorPool: Map<string, OperatorPoolStats> = new Map();

  constructor(private engine: GameEngine) {}

  // ---- 刷新与抽取 ----
  refreshShop(forceFree: boolean = false): void {
    if (this.isInTemporaryShop) {
      alert('请先完成临时商店的选择！');
      return;
    }
    if (!forceFree) {
      if (this.engine.phase !== 'PREP') return;
      if (this.engine.money < REFRESH_COST) return;
      this.engine.money -= REFRESH_COST;
    }

    this.shopItems = [];
    const shopSize = 3 + (this.engine.coreLevel >= 3 ? 1 : 0) + (this.engine.coreLevel >= 5 ? 1 : 0);
    let attempts = 0;
    const maxAttempts = shopSize * 10;

    for (let i = 0; i < shopSize && attempts < maxAttempts; attempts++) {
      const templateId = this.rollForOperator();
      const template = OPERATOR_DB[templateId as keyof typeof OPERATOR_DB];

      // 角色池上限：单个干员最多 7 次
      const poolStats = this.operatorPool.get(templateId);
      if (poolStats && poolStats.count >= POOL_LIMIT) continue;

      this.shopItems.push({
        uid: `shop_${Date.now()}_${i}`,
        templateId,
        cost: template.cost,
        bought: false
      });
      i++;
    }
    this.engine.notifyUpdate();
  }

  private rollForOperator(): string {
    const levelIndex = Math.min(this.engine.coreLevel - 1, RARITY_RATES.length - 1);
    const rates = RARITY_RATES[levelIndex];
    const roll = Math.random();
    let cumulative = 0;
    let targetRarity = 1;
    for (let i = 0; i < rates.length; i++) {
      cumulative += rates[i];
      if (roll <= cumulative) {
        targetRarity = i + 1;
        break;
      }
    }
    const allowed = this.engine.allowedTemplateIds;
    const candidates = Object.entries(OPERATOR_DB)
      .filter(([id, op]) => op.rarity === targetRarity && (allowed === null || allowed.has(id)))
      .map(([id]) => id);

    if (candidates.length === 0) {
      const fallback = Object.entries(OPERATOR_DB)
        .filter(([, op]) => op.rarity === targetRarity)
        .map(([id]) => id);
      if (fallback.length === 0) return Object.keys(OPERATOR_DB)[0];
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ---- 购买 ----
  tryBuyOperator(shopItemUid: string): boolean {
    if (this.engine.phase !== 'PREP') return false;
    if (this.isInTemporaryShop) return this.tryBuyTemporaryShop(shopItemUid);

    const item = this.shopItems.find(i => i.uid === shopItemUid);
    if (!item || item.bought) return false;
    const template = OPERATOR_DB[item.templateId as keyof typeof OPERATOR_DB];
    if (!template) return false;

    const poolStats = this.operatorPool.get(item.templateId);
    if (poolStats && poolStats.count >= POOL_LIMIT) {
      alert('该角色已达到最大获取次数！');
      return false;
    }
    if (this.engine.money < item.cost) return false;
    if (this.engine.bench.length >= CONFIG.MAX_BENCH_SIZE) {
      alert('备战区已满！');
      return false;
    }

    this.engine.money -= item.cost;
    item.bought = true;
    this.bumpPool(item.templateId);

    this.engine.bench.push({
      uid: `bench_${Date.now()}_${Math.random()}`,
      templateId: item.templateId,
      rank: 1
    });

    this.checkAndMergeOperators(item.templateId);
    this.engine.notifyUpdate();
    return true;
  }

  private tryBuyTemporaryShop(shopItemUid: string): boolean {
    const item = this.temporaryShopItems.find(i => i.uid === shopItemUid);
    if (!item || item.bought) return false;
    if (this.engine.bench.length >= CONFIG.MAX_BENCH_SIZE) {
      alert('备战区已满！');
      return false;
    }
    const template = OPERATOR_DB[item.templateId as keyof typeof OPERATOR_DB];
    if (!template) return false;

    item.bought = true;
    this.bumpPool(item.templateId);

    this.engine.bench.push({
      uid: `bench_${Date.now()}_${Math.random()}`,
      templateId: item.templateId,
      rank: 1
    });

    this.exitTemporaryShop();
    this.engine.notifyUpdate();
    return true;
  }

  private bumpPool(templateId: string): void {
    const stats = this.operatorPool.get(templateId);
    if (!stats) {
      this.operatorPool.set(templateId, { count: 1, rank1Count: 1, rank2Count: 0 });
    } else {
      stats.count++;
      stats.rank1Count++;
    }
  }

  // ---- 合并 ----
  private checkAndMergeOperators(templateId: string): void {
    const poolStats = this.operatorPool.get(templateId);
    if (!poolStats || poolStats.rank1Count < 3) return;

    // 把场上的同名 1 阶撤回备战区
    const onField = this.engine.operators.filter(op => op.templateId === templateId && op.rank === 1);
    onField.forEach(op => this.engine.recallOperator(op.id));

    const allRank1 = this.engine.bench.filter(b => b.templateId === templateId && b.rank === 1);
    if (allRank1.length < 3) return;

    for (let i = 0; i < 3; i++) {
      const idx = this.engine.bench.findIndex(b => b.uid === allRank1[i].uid);
      if (idx !== -1) this.engine.bench.splice(idx, 1);
    }
    this.engine.bench.push({
      uid: `bench_${Date.now()}_${Math.random()}`,
      templateId,
      rank: 2
    });
    poolStats.rank1Count -= 3;
    poolStats.rank2Count += 1;
    this.enterTemporaryShop(templateId);
  }

  private enterTemporaryShop(mergedTemplateId: string): void {
    const template = OPERATOR_DB[mergedTemplateId as keyof typeof OPERATOR_DB];
    if (!template) return;
    const nextShopLevel = template.shopLevel + 1;
    const candidates = Object.entries(OPERATOR_DB)
      .filter(([, op]) => op.shopLevel === nextShopLevel)
      .map(([id]) => id);

    if (candidates.length === 0) {
      alert('自动合并完成！但暂时没有更高等级的角色可用。');
      return;
    }

    const shopSize = Math.min(3 + Math.floor(Math.random() * 2), candidates.length);
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    this.temporaryShopItems = [];
    for (let i = 0; i < shopSize; i++) {
      this.temporaryShopItems.push({
        uid: `temp_shop_${Date.now()}_${i}`,
        templateId: shuffled[i],
        cost: 0,
        bought: false
      });
    }
    this.isInTemporaryShop = true;
    alert(`自动合并完成！获得2阶${template.name}！\n进入临时商店，可免费获得一个角色。`);
    this.engine.notifyUpdate();
  }

  private exitTemporaryShop(): void {
    this.isInTemporaryShop = false;
    this.temporaryShopItems = [];
  }

  // ---- 出售 ----
  sellBenchOperator(benchUid: string): boolean {
    const index = this.engine.bench.findIndex(b => b.uid === benchUid);
    if (index === -1) return false;
    const op = this.engine.bench[index];
    const template = OPERATOR_DB[op.templateId];
    this.engine.bench.splice(index, 1);
    this.engine.money += template.saleValue;
    this.engine.notifyUpdate();
    return true;
  }
}
