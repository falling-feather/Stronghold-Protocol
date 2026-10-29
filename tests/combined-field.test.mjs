import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('双人联防将两个战场拼接，敌人依次经过两名协防者的阵地', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { buildDefenseField } = await vite.ssrLoadModule('/src/core/Battlefield.ts');
  const { MAP_LIBRARY, CONFIG } = await vite.ssrLoadModule('/src/config/gameData.ts');
  for (const original of MAP_LIBRARY) {
    const field = buildDefenseField(original.layout, original.waypoints, 2);
    assert.equal(field.layout.length, CONFIG.MAP_HEIGHT);
    assert.ok(field.layout.every(row => row.length === CONFIG.MAP_WIDTH * 2));
    assert.equal(field.layout[field.waypoints[0].y][field.waypoints[0].x], 3);
    const end = field.waypoints.at(-1);
    assert.equal(field.layout[end.y][end.x], 4);
    assert.ok(field.waypoints[0].x >= CONFIG.MAP_WIDTH);
    assert.ok(end.x < CONFIG.MAP_WIDTH);
    for (let i = 1; i < field.waypoints.length; i++) {
      const a = field.waypoints[i - 1], b = field.waypoints[i];
      assert.ok(a.x === b.x || a.y === b.y);
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      let { x, y } = a;
      while (x !== b.x || y !== b.y) {
        x += dx; y += dy;
        assert.ok([0, 3, 4].includes(field.layout[y][x]), `${original.name}: ${x},${y}`);
      }
    }
  }
});

test('联防阵容同时保留两名玩家的生命和技力，镜像站位并隔离相同干员 ID', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { combineDefenseFormations } = await vite.ssrLoadModule('/src/core/Battlefield.ts');
  const { CONFIG } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const unit = { id: 'op_1', templateId: 'recruit_guard', gridPos: { x: 2, y: 3 }, pos: { x: 128, y: 192 },
    direction: 'right', stats: { hp: 700, maxHp: 1000 }, currentSp: 13, skillActive: false, skillDuration: 0,
    skillAutoCooldown: 0, cooldown: 2, blockingEnemyIds: ['old'], effects: [{ id: 'talent', duration: -1 }, { id: 'temporary', duration: 2 }] };
  const first = structuredClone(unit);
  const second = structuredClone(unit);
  second.currentSp = 45;
  second.skillActive = true;
  const combined = combineDefenseFormations([{ playerId: 'a', operators: [first] }, { playerId: 'b', operators: [second] }]);
  assert.equal(combined.length, 2);
  assert.notEqual(combined[0].id, combined[1].id);
  assert.equal(combined[0].gridPos.x, CONFIG.MAP_WIDTH * 2 - 1 - 2);
  assert.equal(combined[1].gridPos.x, CONFIG.MAP_WIDTH - 1 - 2);
  assert.equal(combined[0].direction, 'left');
  assert.equal(combined[0].stats.hp, 700);
  assert.equal(combined[0].currentSp, 13);
  assert.equal(combined[1].currentSp, 0);
  assert.equal(combined[1].skillActive, false);
  assert.deepEqual(combined[0].blockingEnemyIds, []);
  assert.deepEqual(combined[0].effects.map(effect => effect.id), ['talent']);
  assert.equal(first.gridPos.x, 2);
  assert.equal(second.skillActive, true);
});

test('联防在同一战场计算双方干员的攻击，结束后恢复自己的阵容', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { selectRandomMap, CONFIG } = await vite.ssrLoadModule('/src/config/gameData.ts');
  selectRandomMap(() => 0.4); // 直线地图
  const first = new GameEngine();
  const second = new GameEngine();
  for (const [engine, x, direction] of [[first, 8, 'right'], [second, 1, 'left']]) {
    engine.bench.push({ uid: 'sniper', templateId: 'sniper_aa', rank: 1 });
    assert.equal(engine.tryPlaceOperator('sniper', x, 2), true);
    assert.equal(engine.confirmDeployment(direction), true);
    engine.operators[0].stats.atk = 100;
  }
  const original = first.operators;
  first.pendingOutcome = { round: 0, complete: false, lives: first.lives, leaks: [], formation: { deployed: 1, activePacts: 0, alive: 1 } };
  first.combatTimeLimit = 30;
  let result;
  first.onDefenseFinished = survivors => { result = survivors; };
  const leaks = [{ templateId: 'slug', hp: 350, leakId: 'leak:0', ownerId: 'leaker' }];
  assert.equal(first.startDefense(leaks, [
    { playerId: 'first', operators: first.operators },
    { playerId: 'second', operators: second.operators },
  ]), true);
  assert.equal(first.battlefield.layout[0].length, CONFIG.MAP_WIDTH * 2);
  assert.equal(first.operators.length, 2);
  assert.notEqual(first.operators[0].id, first.operators[1].id);
  first.update(0.1);
  const foe = first.enemies[0];
  foe.pos = { x: 9 * CONFIG.TILE_SIZE + 32, y: 3 * CONFIG.TILE_SIZE + 32 };
  foe.stats.spd = 0;
  first.update(0.2);
  first.update(0.2);
  assert.equal(first.operators.filter(operator => operator.cooldown > 0).length, 2);
  assert.equal(foe.stats.hp, 140);
  first.combatTimeRemaining = 0.01;
  first.update(0.1);
  assert.equal(result.length, 1);
  assert.equal(first.battlefield, null);
  assert.equal(first.operators, original);
  assert.equal(first.operators.length, 1);
});

test('最终攻势使用左右镜像的双人场地，各自保留一条独立敌人路线', async (t) => {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { buildAssaultField, combineAssaultFormations } = await vite.ssrLoadModule('/src/core/Battlefield.ts');
  const { MAP_LIBRARY, CONFIG } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const original = MAP_LIBRARY[2];
  const { field, routes } = buildAssaultField(original.layout, original.waypoints, 2);
  assert.equal(field.layout[0].length, CONFIG.MAP_WIDTH * 2);
  assert.deepEqual(routes[0][0], original.waypoints[0]);
  assert.equal(routes[1][0].x, CONFIG.MAP_WIDTH * 2 - 1 - original.waypoints[0].x);
  const unit = { id: 'op_1', gridPos: { x: 2, y: 3 }, pos: { x: 128, y: 192 }, direction: 'right',
    stats: { hp: 900, maxHp: 1000 }, currentSp: 10, skillActive: false, skillAutoCooldown: 0,
    cooldown: 0, blockingEnemyIds: [], effects: [] };
  const operators = combineAssaultFormations([{ playerId: 'a', operators: [unit] }, { playerId: 'b', operators: [unit] }]);
  assert.equal(operators[0].gridPos.x, 2);
  assert.equal(operators[0].direction, 'right');
  assert.equal(operators[1].gridPos.x, CONFIG.MAP_WIDTH * 2 - 1 - 2);
  assert.equal(operators[1].direction, 'left');
  assert.notEqual(operators[0].id, operators[1].id);
});
