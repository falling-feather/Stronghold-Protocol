import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

async function setup(t) {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { MAP_LAYOUT } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const engine = new GameEngine();
  const positions = [];
  for (let y = 0; y < MAP_LAYOUT.length; y++) for (let x = 0; x < MAP_LAYOUT[y].length; x++) {
    if (MAP_LAYOUT[y][x] === 0) positions.push({ x, y });
  }
  engine.bench.push({ uid: 'guard', templateId: 'recruit_guard', rank: 1 });
  assert.equal(engine.tryPlaceOperator('guard', positions[0].x, positions[0].y), true);
  assert.equal(engine.confirmDeployment('right'), true);
  return { engine, positions };
}

test('装备可配发给场上干员，撤回和重新部署后仍保留效果', async (t) => {
  const { engine, positions } = await setup(t);
  const op = engine.operators[0];
  const item = engine.addEquipment('victoria_hammer');
  assert.ok(item);
  assert.equal(engine.equipOperator(op.id, item.uid), true);
  assert.equal(op.equipment.length, 1);
  assert.equal(op.effects.find(effect => effect.id === `equipment_${item.uid}`).mod, 0.1);
  assert.equal(engine.recallOperator(op.id), true);
  const bench = engine.bench[0];
  assert.equal(bench.equipment[0].uid, item.uid);
  assert.equal(engine.tryPlaceOperator(bench.uid, positions[0].x, positions[0].y), true);
  assert.equal(engine.confirmDeployment('right'), true);
  assert.equal(engine.operators[0].effects.find(effect => effect.id === `equipment_${item.uid}`).mod, 0.1);
});

test('装备也可配发给备战干员，部署后应用属性', async (t) => {
  const { engine, positions } = await setup(t);
  const op = engine.operators[0];
  engine.recallOperator(op.id);
  const bench = engine.bench[0];
  const shield = engine.addEquipment('defense_shield');
  assert.equal(engine.equipBenchOperator(bench.uid, shield.uid), true);
  assert.equal(engine.tryPlaceOperator(bench.uid, positions[0].x, positions[0].y), true);
  assert.equal(engine.confirmDeployment('right'), true);
  assert.equal(engine.operators[0].effects.find(effect => effect.id === `equipment_${shield.uid}`).mod, 0.35);
});

test('装备攻击加成与干员自身天赋独立乘算并影响实际伤害', async (t) => {
  const { engine } = await setup(t);
  const operator = engine.operators[0];
  const hammer = engine.addEquipment('victoria_hammer');
  engine.equipOperator(operator.id, hammer.uid);
  engine.spawnEnemy('soldier', { x: operator.pos.x + 32, y: operator.pos.y + 32,
    gridX: operator.gridPos.x, gridY: operator.gridPos.y, waypointIndex: 0 });
  const enemy = engine.enemies[0];
  enemy.stats.hp = enemy.stats.maxHp = 5000;
  enemy.stats.def = 0;
  enemy.isBlockedBy = operator.id;
  enemy.attackCooldown = 100;
  operator.blockingEnemyIds = [enemy.id];
  engine.phase = 'COMBAT';
  engine.combatTimeRemaining = 90;
  engine.enemiesToSpawn = 1;
  engine.spawnInterval = 1000;
  engine.update(0.1);
  assert.equal(enemy.stats.hp, 4189);
});

test('两件同名初始装备自动合成为进阶装备，已穿戴装备会卸回整备区', async (t) => {
  const { engine } = await setup(t);
  const op = engine.operators[0];
  const first = engine.addEquipment('victoria_hammer');
  engine.equipOperator(op.id, first.uid);
  engine.addEquipment('victoria_hammer');
  assert.equal(op.equipment.length, 0);
  assert.equal(op.effects.some(effect => effect.id === `equipment_${first.uid}`), false);
  assert.equal(engine.equipmentInventory.length, 1);
  const upgraded = engine.equipmentInventory[0];
  assert.equal(upgraded.rank, 2);
  assert.equal(engine.equipOperator(op.id, upgraded.uid), true);
  assert.equal(op.effects.find(effect => effect.id === `equipment_${upgraded.uid}`).mod, 0.2);
});

test('干员最多配发两件装备，出售时装备返还', async (t) => {
  const { engine } = await setup(t);
  const op = engine.operators[0];
  const hammer = engine.addEquipment('victoria_hammer');
  const shield = engine.addEquipment('defense_shield');
  assert.equal(engine.equipOperator(op.id, hammer.uid), true);
  assert.equal(engine.equipOperator(op.id, shield.uid), true);
  const extra = engine.addEquipment('pocket_array');
  assert.equal(engine.equipOperator(op.id, extra.uid), false);
  assert.equal(engine.recallOperator(op.id), true);
  assert.equal(engine.sellBenchOperator(engine.bench[0].uid), true);
  assert.equal(engine.equipmentInventory.length, 3);
});

test('干员晋升时装备从被合并的单位返还，且不会重复获得', async (t) => {
  const { engine } = await setup(t);
  const op = engine.operators[0];
  const item = engine.addEquipment('victoria_hammer');
  assert.equal(engine.equipOperator(op.id, item.uid), true);
  engine.shop.operatorPool.set(op.templateId, { count: 1, rank1Count: 1, rank2Count: 0 });
  engine.shop.enterTemporaryShop = () => {};
  engine.shop.shopItems = [
    { uid: 'a', templateId: op.templateId, cost: 8, bought: false },
    { uid: 'b', templateId: op.templateId, cost: 8, bought: false },
  ];
  engine.money = 100;
  assert.equal(engine.shop.tryBuyOperator('a'), true);
  assert.equal(engine.shop.tryBuyOperator('b'), true);
  assert.equal(engine.operators[0].rank, 2);
  assert.equal(engine.operators[0].equipment.length, 0);
  assert.deepEqual(engine.equipmentInventory.map(equipment => equipment.uid), [item.uid]);
});

test('调度中心达到 5 级后提供装备，购买扣除资金并加入整备区', async (t) => {
  const { engine } = await setup(t);
  engine.money = 100;
  engine.shop.refreshShop(true);
  assert.equal(engine.shop.equipmentItems.length, 0);
  engine.coreLevel = 5;
  engine.shop.refreshShop(true);
  assert.ok(engine.shop.equipmentItems.length > 0);
  const offer = engine.shop.equipmentItems[0];
  const before = engine.money;
  assert.equal(engine.shop.tryBuyEquipment(offer.uid), true);
  assert.equal(engine.money, before - offer.cost);
  assert.equal(engine.equipmentInventory.length, 1);
  assert.equal(engine.shop.tryBuyEquipment(offer.uid), false);
});
