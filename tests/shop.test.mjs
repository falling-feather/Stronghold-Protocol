import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('出售干员后名额回到可招募池，精锐占用三个名额', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { ShopSystem } = await vite.ssrLoadModule('/src/core/ShopSystem.ts');
  const engine = { phase: 'PREP', money: 100, bench: [], operators: [], coreLevel: 1,
    allowedTemplateIds: null, activeBoonId: null, notifyUpdate() {} };
  const shop = new ShopSystem(engine);
  shop.operatorPool.set('recruit_guard', { count: 4, rank1Count: 1, rank2Count: 1 });
  engine.bench.push({ uid: 'one', templateId: 'recruit_guard', rank: 1 });
  engine.bench.push({ uid: 'elite', templateId: 'recruit_guard', rank: 2 });

  assert.equal(shop.sellBenchOperator('one'), true);
  assert.deepEqual(shop.operatorPool.get('recruit_guard'), { count: 3, rank1Count: 0, rank2Count: 1 });
  assert.equal(shop.sellBenchOperator('elite'), true);
  assert.deepEqual(shop.operatorPool.get('recruit_guard'), { count: 0, rank1Count: 0, rank2Count: 0 });
});

test('共享池已满的干员不会在刷新后继续出现', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { ShopSystem } = await vite.ssrLoadModule('/src/core/ShopSystem.ts');
  const engine = { phase: 'PREP', money: 100, bench: [], operators: [], coreLevel: 1,
    allowedTemplateIds: new Set(['recruit_guard']), activeBoonId: null, notifyUpdate() {} };
  const shop = new ShopSystem(engine);
  assert.equal(shop.getPoolLimit('recruit_guard'), 12);
  shop.sharedPoolCounts = { recruit_guard: 24 };
  assert.equal(shop.getPoolLimit('recruit_guard'), 24);
  shop.refreshShop(true);
  assert.equal(shop.shopItems.length, 0);
});

test('库存耗尽前已展示的卡片仍可购买，超额持有会计入库存', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { ShopSystem } = await vite.ssrLoadModule('/src/core/ShopSystem.ts');
  const engine = { phase: 'PREP', money: 100, bench: [
    { uid: 'elite1', templateId: 'recruit_guard', rank: 2 },
    { uid: 'elite2', templateId: 'recruit_guard', rank: 2 },
    { uid: 'elite3', templateId: 'recruit_guard', rank: 2 },
    { uid: 'elite4', templateId: 'recruit_guard', rank: 2 },
  ], operators: [], coreLevel: 1, allowedTemplateIds: null, activeBoonId: null, notifyUpdate() {} };
  const shop = new ShopSystem(engine);
  shop.operatorPool.set('recruit_guard', { count: 12, rank1Count: 0, rank2Count: 4 });
  shop.shopItems = [{ uid: 'already-shown', templateId: 'recruit_guard', cost: 8, bought: false }];
  assert.equal(shop.tryBuyOperator('already-shown'), true);
  assert.equal(shop.operatorPool.get('recruit_guard').count, 13);
});

test('商店缺少目标阶级时不引入阵容外的干员', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { ShopSystem } = await vite.ssrLoadModule('/src/core/ShopSystem.ts');
  const engine = { phase: 'PREP', money: 100, bench: [], operators: [], coreLevel: 1,
    allowedTemplateIds: new Set(['guard_sword']), activeBoonId: null, notifyUpdate() {} };
  const shop = new ShopSystem(engine);
  shop.refreshShop(true);
  assert.equal(shop.shopItems.length, 0);
});

test('同等阶干员按共享池剩余份数抽取', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { ShopSystem } = await vite.ssrLoadModule('/src/core/ShopSystem.ts');
  const engine = { phase: 'PREP', money: 100, bench: [], operators: [], coreLevel: 3,
    allowedTemplateIds: new Set(['guard_sword', 'defender_shield']), activeBoonId: null, notifyUpdate() {} };
  const shop = new ShopSystem(engine);
  shop.sharedPoolCounts = { guard_sword: 35 };
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => [0.95, 0.1][index++ % 2];
  t.after(() => { Math.random = originalRandom; });
  shop.refreshShop(true);
  assert.equal(shop.shopItems.length, 4);
  assert.ok(shop.shopItems.every(item => item.templateId === 'defender_shield'));
});

test('备战区满时，场上和备战区的同名干员仍可正常合并', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { MAP_LAYOUT } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const engine = new GameEngine();
  engine.money = 100;
  const positions = [];
  for (let y = 0; y < MAP_LAYOUT.length; y++) for (let x = 0; x < MAP_LAYOUT[y].length; x++) {
    if (MAP_LAYOUT[y][x] === 0) positions.push({ x, y });
  }
  for (let i = 0; i < 2; i++) {
    engine.bench.push({ uid: `placed-${i}`, templateId: 'recruit_guard', rank: 1 });
    assert.equal(engine.tryPlaceOperator(`placed-${i}`, positions[i].x, positions[i].y), true);
    assert.equal(engine.confirmDeployment('right'), true);
  }
  const first = engine.operators[0];
  assert.notEqual(first.id, engine.operators[1].id);
  engine.bench = Array.from({ length: 9 }, (_, i) => ({ uid: `other-${i}`, templateId: 'guard_sword', rank: 1 }));
  engine.shop.operatorPool.set('recruit_guard', { count: 2, rank1Count: 2, rank2Count: 0 });
  engine.shop.shopItems = [{ uid: 'third', templateId: 'recruit_guard', cost: 8, bought: false }];
  engine.shop.enterTemporaryShop = () => {};
  assert.equal(engine.shop.tryBuyOperator('third'), true);
  assert.equal(engine.operators.length, 1);
  assert.equal(engine.operators[0].id, first.id);
  assert.deepEqual(engine.operators[0].gridPos, positions[0]);
  assert.equal(engine.operators[0].direction, 'right');
  assert.equal(engine.operators[0].rank, 2);
  assert.equal(engine.operators[0].stats.maxHp, 3204);
  assert.equal(engine.operators[0].skill.cost, 40);
  assert.equal(engine.operators[0].effects.find(effect => effect.stat === 'atk')?.mod, 0.08);
  assert.equal(engine.bench.length, 9);
  const snapshot = engine.getStateSnapshot().operators[0];
  assert.equal(snapshot.rank, 2);
  assert.equal(snapshot.direction, 'right');
  assert.deepEqual(engine.shop.operatorPool.get('recruit_guard'), { count: 3, rank1Count: 0, rank2Count: 1 });
});

test('三名备战干员合并后，精锐仍留在备战区', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const engine = new GameEngine();
  engine.money = 100;
  engine.bench = ['one', 'two'].map(uid => ({ uid, templateId: 'recruit_guard', rank: 1 }));
  engine.shop.operatorPool.set('recruit_guard', { count: 2, rank1Count: 2, rank2Count: 0 });
  engine.shop.shopItems = [{ uid: 'third', templateId: 'recruit_guard', cost: 8, bought: false }];
  engine.shop.enterTemporaryShop = () => {};
  assert.equal(engine.shop.tryBuyOperator('third'), true);
  assert.equal(engine.operators.length, 0);
  assert.deepEqual(engine.bench.map(operator => operator.rank), [2]);
});
