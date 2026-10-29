// === 商店系统（v1.5.0 从 GameEngine 拆出）===
// 持有：商店刷新池、临时商店、角色获取池统计
// 与 GameEngine 通过引用协作（读 phase/money/bench/operators，调用 recallOperator/notifyUpdate）

import { OPERATOR_DB, TIER_RATES, CONFIG } from '../config/gameData';
import { ShopItem, OperatorPoolStats } from '../types';
import type { GameEngine } from './GameEngine';
import { applyShopDiscount } from '../config/metaData';
import { showToast } from './ModalSystem';
import gameRules from '../../shared/gameRules.json';
import { EQUIPMENT_DB } from '../config/equipmentData';

const REFRESH_COST = 2;

export class ShopSystem {
  shopItems: ShopItem[] = [];
  temporaryShopItems: ShopItem[] = [];
  isInTemporaryShop: boolean = false;
  equipmentItems: { uid: string; templateId: string; cost: number; bought: boolean }[] = [];
  operatorPool: Map<string, OperatorPoolStats> = new Map();
  sharedPoolCounts: Record<string, number> | null = null;
  private offerGeneration = 0;

  constructor(private engine: GameEngine) {}

  getPoolLimit(templateId: string): number {
    const tier = OPERATOR_DB[templateId]?.tier;
    const capacities: Record<string, number> = gameRules.operatorPoolByTier;
    const base = capacities[String(tier)] ?? 0;
    return base * (this.sharedPoolCounts === null ? 1 : gameRules.alliancePoolMultiplier);
  }

  private availableCopies(templateId: string): number {
    const held = this.sharedPoolCounts === null
      ? this.operatorPool.get(templateId)?.count ?? 0
      : this.sharedPoolCounts[templateId] ?? 0;
    return Math.max(0, this.getPoolLimit(templateId) - held);
  }

  // ---- 刷新与抽取 ----
  refreshShop(forceFree: boolean = false): void {
    if (this.isInTemporaryShop) {
      showToast('请先完成临时商店的选择！', { level: 'warn' });
      return;
    }
    if (!forceFree) {
      if (this.engine.phase !== 'PREP') return;
      if (this.engine.money < REFRESH_COST) return;
      this.engine.money -= REFRESH_COST;
    }

    this.shopItems = [];
    const generation = ++this.offerGeneration;
    const shopSize = 3 + (this.engine.coreLevel >= 3 ? 1 : 0) + (this.engine.coreLevel >= 5 ? 1 : 0);
    let attempts = 0;
    const maxAttempts = shopSize * 10;

    for (let i = 0; i < shopSize && attempts < maxAttempts; attempts++) {
      const templateId = this.rollForOperator();
      if (!templateId) continue;
      const template = OPERATOR_DB[templateId as keyof typeof OPERATOR_DB];

      this.shopItems.push({
        uid: `shop_${generation}_${i}`,
        templateId,
        cost: this.applyAllDiscounts(template.cost),
        bought: false
      });
      i++;
    }
    const equipmentIds = Object.keys(EQUIPMENT_DB);
    this.equipmentItems = this.engine.coreLevel >= 5 ? Array.from({ length: 2 }, (_, i) => {
      const templateId = equipmentIds[Math.floor(Math.random() * equipmentIds.length)];
      return { uid: `equipment_offer_${generation}_${i}`, templateId, cost: EQUIPMENT_DB[templateId].cost, bought: false };
    }) : [];
    this.engine.notifyUpdate();
  }

  // v3.6.2：综合折扣 = meta 升级 + boon"黑市渠道"
  private applyAllDiscounts(price: number): number {
    let p = applyShopDiscount(price);
    if (this.engine.activeBoonId === 'boon_shop_discount') {
      p = Math.max(1, Math.round(p * 0.85));
    }
    return p;
  }

  private rollForOperator(): string | null {
    const levelIndex = Math.min(this.engine.coreLevel - 1, TIER_RATES.length - 1);
    const rates = TIER_RATES[levelIndex];
    const roll = Math.random();
    let cumulative = 0;
    let targetTier = 1;
    for (let i = 0; i < rates.length; i++) {
      cumulative += rates[i];
      if (roll <= cumulative) {
        targetTier = i + 1;
        break;
      }
    }
    const allowed = this.engine.allowedTemplateIds;
    const candidates = Object.entries(OPERATOR_DB)
      .filter(([id, op]) => op.tier === targetTier && (allowed === null || allowed.has(id)))
      .map(([id]) => ({ id, available: this.availableCopies(id) }))
      .filter(candidate => candidate.available > 0);

    if (candidates.length === 0) {
      return null;
    }
    let choice = Math.random() * candidates.reduce((total, candidate) => total + candidate.available, 0);
    for (const candidate of candidates) {
      choice -= candidate.available;
      if (choice < 0) return candidate.id;
    }
    return candidates[candidates.length - 1].id;
  }

  // ---- 购买 ----
  tryBuyEquipment(uid: string): boolean {
    const item = this.equipmentItems.find(entry => entry.uid === uid);
    if (this.engine.phase !== 'PREP' || this.isInTemporaryShop || !item || item.bought || this.engine.money < item.cost) return false;
    this.engine.money -= item.cost;
    item.bought = true;
    this.engine.addEquipment(item.templateId);
    return true;
  }

  tryBuyOperator(shopItemUid: string): boolean {
    if (this.engine.phase !== 'PREP') return false;
    if (this.isInTemporaryShop) return this.tryBuyTemporaryShop(shopItemUid);

    const item = this.shopItems.find(i => i.uid === shopItemUid);
    if (!item || item.bought) return false;
    const template = OPERATOR_DB[item.templateId as keyof typeof OPERATOR_DB];
    if (!template) return false;

    if (this.engine.money < item.cost) return false;
    if (this.engine.bench.length >= CONFIG.MAX_BENCH_SIZE) {
      showToast('备战区已满！', { level: 'warn' });
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
      showToast('备战区已满！', { level: 'warn' });
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
    this.checkAndMergeOperators(item.templateId);
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

    const fromBench = this.engine.bench.filter(b => b.templateId === templateId && b.rank === 1).slice(0, 3);
    const fromField = this.engine.operators.filter(op => op.templateId === templateId && op.rank === 1).slice(0, 3 - fromBench.length);
    if (fromBench.length + fromField.length < 3) return;

    for (const operator of fromBench) {
      const idx = this.engine.bench.findIndex(b => b.uid === operator.uid);
      if (idx !== -1) {
        this.engine.recoverEquipment(operator);
        this.engine.bench.splice(idx, 1);
      }
    }
    for (const operator of fromField) this.engine.recoverEquipment(operator);
    if (fromField.length) {
      for (const operator of fromField.slice(1)) this.engine.removeOperatorFromField(operator.id);
      this.engine.promoteDeployedOperator(fromField[0].id);
    } else {
      this.engine.bench.push({
        uid: `bench_${Date.now()}_${Math.random()}`,
        templateId,
        rank: 2
      });
    }
    poolStats.rank1Count -= 3;
    poolStats.rank2Count += 1;
    this.enterTemporaryShop(templateId);
  }

  private enterTemporaryShop(mergedTemplateId: string): void {
    const template = OPERATOR_DB[mergedTemplateId as keyof typeof OPERATOR_DB];
    if (!template) return;
    const nextShopLevel = template.shopLevel + 1;
    let candidates = Object.entries(OPERATOR_DB)
      .filter(([, op]) => op.shopLevel === nextShopLevel)
      .map(([id]) => id);

    // 没有更高商店等级的候选时，从当前等级提供免费选择。
    let topTierFallback = false;
    if (candidates.length === 0) {
      topTierFallback = true;
      const sameTier = Object.entries(OPERATOR_DB)
        .filter(([, op]) => op.shopLevel === template.shopLevel)
        .map(([id]) => id);
      const others = sameTier.filter(id => id !== mergedTemplateId);
      candidates = others.length > 0 ? others : sameTier;
    }

    candidates = candidates.filter(id => (this.engine.allowedTemplateIds === null || this.engine.allowedTemplateIds.has(id)) &&
      this.availableCopies(id) > 0);

    if (candidates.length === 0) {
      showToast('自动合并完成！但暂时没有更高等级的角色可用。', { level: 'info' });
      return;
    }

    const shopSize = Math.min(3 + Math.floor(Math.random() * 2), candidates.length);
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    this.temporaryShopItems = [];
    const generation = ++this.offerGeneration;
    for (let i = 0; i < shopSize; i++) {
      this.temporaryShopItems.push({
        uid: `temp_shop_${generation}_${i}`,
        templateId: shuffled[i],
        cost: 0,
        bought: false
      });
    }
    this.isInTemporaryShop = true;
    if (topTierFallback) {
      showToast(`合成精锐 ${template.name}\n额外赠送：同等级干员（免费选 1）`, { level: 'success', duration: 3800 });
    } else {
      showToast(`自动合并完成！获得精锐 ${template.name}\n进入临时商店，可免费获得一个角色。`, { level: 'success', duration: 3500 });
    }
    this.engine.notifyUpdate();
  }

  private exitTemporaryShop(): void {
    this.isInTemporaryShop = false;
    this.temporaryShopItems = [];
  }

  skipTemporaryShop(): void {
    if (!this.isInTemporaryShop) return;
    this.exitTemporaryShop();
    this.engine.notifyUpdate();
  }

  // ---- 出售 ----
  sellBenchOperator(benchUid: string): boolean {
    const index = this.engine.bench.findIndex(b => b.uid === benchUid);
    if (index === -1) return false;
    const op = this.engine.bench[index];
    const template = OPERATOR_DB[op.templateId];
    if (op.equipment?.length) this.engine.recoverEquipment(op);
    this.engine.bench.splice(index, 1);
    const stats = this.operatorPool.get(op.templateId);
    if (stats) {
      stats.count -= op.rank === 2 ? 3 : 1;
      if (op.rank === 2) stats.rank2Count--; else stats.rank1Count--;
    }
    this.engine.money += template.saleValue;
    this.engine.notifyUpdate();
    return true;
  }
}
