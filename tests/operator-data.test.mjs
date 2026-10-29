import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('预备近卫区分四星与Ⅰ阶，并按 PRTS 对应培养状态部署', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { OPERATOR_DB, MAP_LAYOUT, resolveSkillForRank } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { getCandidatesByTier, sanitizeRoster } = await vite.ssrLoadModule('/src/config/roster.ts');
  const template = OPERATOR_DB.recruit_guard;
  assert.equal(template.tier, 1);
  assert.equal(template.rarity, 4);
  assert.ok(getCandidatesByTier()[1].includes('recruit_guard'));
  assert.deepEqual(sanitizeRoster({ 1: ['recruit_guard'] })[1], ['recruit_guard']);
  assert.equal(resolveSkillForRank(template, 1).cost, 45);
  assert.equal(resolveSkillForRank(template, 1).values.atkPct, 30);
  assert.equal(resolveSkillForRank(template, 2).cost, 40);
  assert.equal(resolveSkillForRank(template, 2).values.atkPct, 50);

  const positions = [];
  for (let y = 0; y < MAP_LAYOUT.length; y++) for (let x = 0; x < MAP_LAYOUT[y].length; x++) {
    if (MAP_LAYOUT[y][x] === 0) positions.push({ x, y });
  }
  const engine = new GameEngine();
  for (let i = 0; i < 2; i++) {
    engine.bench.push({ uid: `rank${i + 1}`, templateId: 'recruit_guard', rank: i + 1 });
    assert.equal(engine.tryPlaceOperator(`rank${i + 1}`, positions[i].x, positions[i].y), true);
    assert.equal(engine.confirmDeployment('right'), true);
  }
  assert.deepEqual(engine.operators.map((op) => [op.stats.maxHp, op.stats.atk, op.stats.def]),
    [[2510, 709, 122], [3204, 827, 141]]);
  assert.deepEqual(engine.operators.map((op) => op.effects.find((effect) => effect.stat === 'atk')?.mod), [0.04, 0.08]);
});

test('预备重装使用 PRTS 的初始与精锐属性、天赋和技能', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { OPERATOR_DB, MAP_LAYOUT, resolveSkillForRank } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const template = OPERATOR_DB.reserve_defender;
  assert.equal(template.rarity, 4);
  assert.equal(template.tier, 1);
  assert.deepEqual([template.stats.maxHp, template.stats.atk, template.stats.def, template.stats.aspd, template.stats.blockCount], [2083, 271, 399, 1.2, 3]);
  assert.deepEqual([template.eliteStats.maxHp, template.eliteStats.atk, template.eliteStats.def], [2776, 311, 515]);
  assert.deepEqual([resolveSkillForRank(template, 1).cost, resolveSkillForRank(template, 1).values.defPct, resolveSkillForRank(template, 1).duration], [45, 30, 30]);
  assert.deepEqual([resolveSkillForRank(template, 2).cost, resolveSkillForRank(template, 2).values.defPct], [40, 50]);
  const y = MAP_LAYOUT.findIndex(row => row.includes(0));
  const x = MAP_LAYOUT[y].indexOf(0);
  const engine = new GameEngine();
  engine.bench.push({ uid: 'defender', templateId: 'reserve_defender', rank: 2 });
  assert.equal(engine.tryPlaceOperator('defender', x, y), true);
  assert.equal(engine.confirmDeployment('right'), true);
  assert.equal(engine.operators[0].effects.find(effect => effect.stat === 'def')?.mod, 0.1);
});

test('PRTS 记载的步兵和宿主士兵属性及生命自回接入战斗', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { ENEMY_DB, WAVES } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  assert.deepEqual([ENEMY_DB.soldier.stats.maxHp, ENEMY_DB.soldier.stats.atk, ENEMY_DB.soldier.stats.def,
    ENEMY_DB.soldier.stats.magicResist, ENEMY_DB.soldier.stats.aspd], [2500, 280, 85, 40, 2]);
  assert.equal(ENEMY_DB.host_soldier.traits.regeneratePerSecond, 80);
  assert.ok(WAVES.some((wave) => wave.enemyId === 'host_soldier'));
  const engine = new GameEngine();
  engine.spawnEnemy('host_soldier', { x: 96, y: 96, gridX: 1, gridY: 1, waypointIndex: 0 });
  const enemy = engine.enemies[0];
  enemy.stats.hp -= 100;
  engine.phase = 'COMBAT';
  engine.combatTimeRemaining = 90;
  engine.enemiesToSpawn = 1;
  engine.spawnInterval = 1000;
  engine.update(1);
  assert.equal(enemy.stats.hp, enemy.stats.maxHp - 20);
  engine.update(1);
  assert.equal(enemy.stats.hp, enemy.stats.maxHp);
});
