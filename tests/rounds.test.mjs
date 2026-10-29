import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('多人战斗漏怪先记录，超时不会重复记录或提前扣生命', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { PATH_WAYPOINTS, CONFIG } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const engine = new GameEngine();
  const startLives = engine.lives;
  const last = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
  engine.spawnEnemy('slug', { x: last.x * CONFIG.TILE_SIZE + 32, y: last.y * CONFIG.TILE_SIZE + 32,
    gridX: last.x, gridY: last.y, waypointIndex: PATH_WAYPOINTS.length - 1 });
  engine.spawnEnemy('soldier', { x: 32, y: 32, gridX: 0, gridY: 0, waypointIndex: 0 });
  engine.phase = 'COMBAT';
  engine.combatTimeRemaining = 0.5;
  engine.enemiesToSpawn = 0;
  engine.totalEnemiesInWave = 2;
  let result;
  engine.onRoundFinished = (outcome) => { result = outcome; };
  engine.update(0.1);
  assert.equal(engine.lives, startLives);
  engine.update(1);
  assert.equal(engine.lives, startLives);
  assert.equal(result.round, 0);
  assert.deepEqual(result.leaks.map((enemy) => enemy.templateId).sort(), ['slug', 'soldier']);
});

test('飞行敌人不会被地面干员阻挡', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { MAP_LAYOUT } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const engine = new GameEngine();
  const y = MAP_LAYOUT.findIndex((row) => row.includes(0));
  const x = MAP_LAYOUT[y].indexOf(0);
  engine.bench.push({ uid: 'guard', templateId: 'recruit_guard', rank: 1 });
  assert.equal(engine.tryPlaceOperator('guard', x, y), true);
  assert.equal(engine.confirmDeployment('right'), true);
  engine.spawnEnemy('flyer', { x: x * 64 + 32, y: y * 64 + 32, gridX: x, gridY: y, waypointIndex: 0 });
  const flyer = engine.enemies[0];
  engine.phase = 'COMBAT';
  engine.combatTimeRemaining = 30;
  engine.enemiesToSpawn = 1;
  engine.spawnInterval = 1000;
  engine.update(0.1);
  assert.equal(flyer.isBlockedBy, null);
  assert.deepEqual(engine.operators[0].blockingEnemyIds, []);
});

test('联防沿用协防者剩余生命、清除已开启技能且不叠加盟约', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { MAP_LAYOUT } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const engine = new GameEngine();
  const y = MAP_LAYOUT.findIndex((row) => row.includes(0));
  const x = MAP_LAYOUT[y].indexOf(0);
  engine.bench.push({ uid: 'guard', templateId: 'recruit_guard', rank: 1 });
  engine.tryPlaceOperator('guard', x, y);
  engine.confirmDeployment('right');
  const operator = engine.operators[0];
  operator.stats.hp = 1000;
  operator.currentSp = operator.skill.cost;
  engine.tryActivateSkill(operator.id);
  operator.cooldown = 100;
  engine.combatTimeLimit = 30;
  engine.pendingOutcome = { round: 0, complete: false, leaks: [], formation: { deployed: 1, activePacts: 0, alive: 1 } };
  const before = engine.pacts.map((pact) => pact.stack);
  let survivors;
  engine.onDefenseFinished = (result) => { survivors = result; };
  assert.equal(engine.startDefense([{ templateId: 'slug', hp: 150, leakId: 'c2:0', ownerId: 'c2' }]), true);
  const defender = engine.operators[0];
  assert.equal(defender.stats.hp, 1000);
  assert.equal(defender.skillActive, false);
  assert.equal(defender.currentSp, 0);
  engine.update(0.1);
  const foe = engine.enemies[0];
  foe.pos = { x: defender.pos.x + 32, y: defender.pos.y + 32 };
  foe.attackCooldown = 100;
  defender.cooldown = 0;
  engine.update(0.1);
  assert.deepEqual(survivors, []);
  assert.deepEqual(engine.pacts.map((pact) => pact.stack), before);
});

test('联防超时保留尚未出场的敌人及其来源', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const engine = new GameEngine();
  engine.combatTimeLimit = 0.05;
  engine.pendingOutcome = { round: 0, complete: false, leaks: [], formation: { deployed: 0, activePacts: 0, alive: 0 } };
  const enemies = [{ templateId: 'slug', hp: 150, leakId: 'c2:0', ownerId: 'c2' },
    { templateId: 'soldier', hp: 900, leakId: 'c3:0', ownerId: 'c3' }];
  let survivors;
  engine.onDefenseFinished = (result) => { survivors = result; };
  assert.equal(engine.startDefense(enemies), true);
  engine.update(0.1);
  assert.deepEqual(survivors, enemies);
});

test('联机玩家生命归零时只结算一次淘汰，供界面继续观战', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const engine = new GameEngine();
  engine.lives = 1;
  engine.pendingOutcome = { round: 0, complete: false, lives: 1, leaks: [], formation: { deployed: 0, activePacts: 0, alive: 0 } };
  engine.checkAndAnnounceAchievements = () => {};
  let calls = 0;
  engine.onEliminated = () => { calls++; };
  engine.settleRound(10);
  engine.settleRound(1);
  engine.update(0);
  assert.equal(engine.lives, 0);
  assert.equal(calls, 1);
  assert.equal(engine.startCombat(), false);
});

test('普通回合结算后干员恢复初始技力，清除上轮技能与临时状态', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { MAP_LAYOUT } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const y = MAP_LAYOUT.findIndex(row => row.includes(1));
  const x = MAP_LAYOUT[y].indexOf(1);
  const engine = new GameEngine();
  engine.bench.push({ uid: 'caster', templateId: 'caster_volcano', rank: 1 });
  engine.tryPlaceOperator('caster', x, y);
  engine.confirmDeployment('right');
  const operator = engine.operators[0];
  assert.equal(operator.currentSp, 10);
  operator.currentSp = operator.skill.cost;
  engine.tryActivateSkill(operator.id);
  operator.stats.hp -= 500;
  operator.isRetreated = true;
  operator.cooldown = 5;
  operator.effects.push({ id: 'temporary', name: '临时', kind: 'debuff', stat: 'def', mod: -5,
    modType: 'flat', duration: 8, remaining: 8 });
  operator.effects.push({ id: 'permanent', name: '常驻', kind: 'buff', stat: 'def', mod: 5,
    modType: 'flat', duration: -1, remaining: -1 });
  engine.pendingOutcome = { round: 0, complete: false, lives: engine.lives, leaks: [], formation: { deployed: 1, activePacts: 0, alive: 1 } };
  engine.checkAndAnnounceAchievements = () => {};
  const host = { appendChild() {} };
  const element = () => ({ classList: { add() {}, remove() {} }, appendChild() {}, remove() {} });
  globalThis.document = { getElementById: () => host, createElement: element };
  globalThis.requestAnimationFrame = () => {};
  t.after(() => { delete globalThis.document; delete globalThis.requestAnimationFrame; });
  engine.settleRound(0);
  assert.equal(operator.stats.hp, operator.stats.maxHp);
  assert.equal(operator.currentSp, 10);
  assert.equal(operator.skillActive, false);
  assert.equal(operator.cooldown, 0);
  assert.equal(operator.isRetreated, false);
  assert.ok(operator.effects.some(effect => effect.duration < 0));
  assert.ok(operator.effects.every(effect => effect.duration < 0));
  assert.ok(operator.effects.some(effect => effect.id === 'permanent'));
  assert.equal(operator.effects.filter(effect => effect.id === 'pact_lingering_echo_t0_aspd').length, 1);
});
