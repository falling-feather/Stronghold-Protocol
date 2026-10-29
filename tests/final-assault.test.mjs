import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

async function setup(t) {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { WAVES } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const engine = new GameEngine();
  engine.waveIndex = WAVES.length;
  engine.checkAndAnnounceAchievements = () => {};
  return engine;
}

test('单人完成常规波次后进入领袖战，而不是直接通关', async (t) => {
  const engine = await setup(t);
  assert.equal(engine.startCombat(), true);
  assert.equal(engine.isFinalAssault, true);
  assert.equal(engine.finalState.bossMaxHp, 225000);
  assert.equal(engine.finalState.teamLives, engine.lives);
  assert.equal(engine.enemies.length, 1);
  assert.equal(engine.enemies[0].templateId, 'final_musketeer');
  assert.equal(engine.enemies[0].stats.def, 1100);
});

test('领袖遭受伤害时扣减共享生命，超过单次限伤的攻击不生效', async (t) => {
  const engine = await setup(t);
  engine.startCombat();
  const boss = engine.enemies[0];
  const makeProjectile = damage => ({ id: `p-${damage}`, pos: { ...boss.pos }, targetId: boss.id,
    speed: 600, damage, color: 'white', markedForDeletion: false, atkType: 'true' });
  engine.projectiles.push(makeProjectile(300000));
  engine.update(0.1);
  assert.equal(engine.finalState.bossHp, 225000);
  engine.projectiles.push(makeProjectile(100));
  engine.update(0.1);
  assert.equal(engine.finalState.bossHp, 224900);
  assert.equal(boss.stats.hp, 224900);
});

test('领袖生命归零后胜利只结算一次', async (t) => {
  const engine = await setup(t);
  const host = { children: [], appendChild(child) { this.children.push(child); } };
  const element = () => ({ classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, remove() {} });
  globalThis.document = { getElementById: () => host, createElement: element, addEventListener() {} };
  globalThis.requestAnimationFrame = () => {};
  t.after(() => { delete globalThis.document; delete globalThis.requestAnimationFrame; });
  engine.startCombat();
  const boss = engine.enemies[0];
  engine.projectiles.push({ id: 'lethal', pos: { ...boss.pos }, targetId: boss.id,
    speed: 600, damage: 225000, color: 'white', markedForDeletion: false, atkType: 'true' });
  engine.update(0.1);
  engine.finishFinalAssault('victory');
  assert.equal(host.children.length, 1);
  assert.equal(engine.phase, 'PREP');
});

test('最终攻势普通敌人到达终点时扣减队伍共享生命', async (t) => {
  const engine = await setup(t);
  engine.startCombat();
  const route = engine.assaultRoutes[0];
  const end = route[route.length - 1];
  engine.spawnEnemy('soldier', { x: end.x * 64 + 32, y: end.y * 64 + 32, gridX: end.x, gridY: end.y, waypointIndex: route.length - 1 });
  engine.enemies[1].assaultRoute = 0;
  const before = engine.finalState.teamLives;
  engine.update(0.1);
  assert.equal(engine.finalState.teamLives, before - 1);
  assert.equal(engine.lives, before - 1);
  assert.equal(engine.enemies.length, 1);
});

test('单人最终攻势倒计时按实际经过时间计算，不随战斗倍速翻倍', async (t) => {
  const engine = await setup(t);
  engine.startCombat();
  engine.update(20, 10);
  assert.equal(engine.finalState.remainingSeconds, 110);
  assert.equal(engine.combatTimeRemaining, 110);
});

test('联机最终攻势共享生命归零时等待服务器统一结算', async (t) => {
  const engine = await setup(t);
  const state = { bossHp: 225000, bossMaxHp: 225000, teamLives: 1, remainingSeconds: 1, overtime: 0, result: null };
  engine.startFinalAssault([{ playerId: 'p1', operators: [] }], state, true);
  let eliminated = 0;
  engine.onEliminated = () => { eliminated++; };
  engine.updateFinalState({ ...state, teamLives: 0, result: 'defeat' });
  engine.update(0.1);
  assert.equal(eliminated, 0);
  assert.equal(engine.settled, false);
  assert.equal(engine.phase, 'COMBAT');
});
