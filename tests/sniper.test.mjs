import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('预备狙击使用 PRTS 属性，优先攻击飞行敌人并可回退至地面目标', async t => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { selectRandomMap, CONFIG, OPERATOR_DB } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const template = OPERATOR_DB.reserve_sniper;
  assert.equal(template.stats.maxHp, 1247);
  assert.equal(template.stats.atk, 360);
  assert.equal(template.eliteStats.atk, 427);
  assert.equal(template.skills[0].levels.rank2.cost, 40);
  selectRandomMap(() => 0.4);
  const engine = new GameEngine();
  engine.bench.push({ uid: 'sniper', templateId: 'reserve_sniper', rank: 1 });
  assert.equal(engine.tryPlaceOperator('sniper', 8, 2), true);
  assert.equal(engine.confirmDeployment('right'), true);
  const spawn = (id, x) => {
    engine.spawnEnemy(id, { x: x * CONFIG.TILE_SIZE + 32, y: 2 * CONFIG.TILE_SIZE + 32, gridX: x, gridY: 2, waypointIndex: 0 });
    return engine.enemies.at(-1);
  };
  const ground = spawn('soldier', 9);
  const flying = spawn('flyer', 10);
  engine.updateOperators(0.1);
  assert.equal(engine.projectiles[0].targetId, flying.id);
  engine.projectiles = [];
  engine.operators[0].cooldown = 0;
  flying.markedForDeletion = true;
  engine.updateOperators(0.1);
  assert.equal(engine.projectiles[0].targetId, ground.id);
});
