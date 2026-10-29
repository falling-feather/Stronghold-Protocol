import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

async function setup(t, templateId) {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { OPERATOR_DB, WAVES, resolveSkillForRank } = await vite.ssrLoadModule('/src/config/gameData.ts');
  const template = OPERATOR_DB[templateId];
  const skill = resolveSkillForRank(template, 1);
  const operator = {
    id: 'operator', templateId, name: template.name, pos: { x: 0, y: 0 }, gridPos: { x: 0, y: 0 },
    radius: 64, color: template.color, stats: { ...template.stats }, markedForDeletion: false,
    cooldown: 0, targetId: null, cost: template.cost, placement: template.placement, rarity: template.rarity,
    blockingEnemyIds: [], isRetreated: false, skill, currentSp: skill.cost, skillActive: false,
    skillDuration: 0, skillAutoCooldown: 3, rank: 1, direction: 'right', deployTime: 0, costRefunded: false, effects: [],
  };
  const engine = new GameEngine();
  engine.operators = [operator];
  engine.phase = 'COMBAT';
  engine.combatTimeRemaining = 90;
  engine.enemiesToSpawn = 1;
  engine.spawnInterval = 1000;
  return { engine, operator, skill, waveCount: WAVES.length };
}

function enemy(id, x = 32, y = 32) {
  return { id, pos: { x, y }, gridPos: { x: Math.floor(x / 64), y: Math.floor(y / 64) },
    radius: 15, color: 'red', stats: { hp: 5000, maxHp: 5000, atk: 300, def: 0, spd: 0,
      range: 0, aspd: 1, blockCount: 0, magicResist: 0 }, waypointIndex: 0,
    markedForDeletion: false, isBlockedBy: null, attackCooldown: 0, effects: [] };
}

test('技能说明展示当前等阶数值', async (t) => {
  const { skill } = await setup(t, 'recruit_guard');
  assert.equal(skill.desc, '攻击 +30% 持续 20s');
});

test('普通干员技力就绪后，在自动操作冷却结束并进行攻击时释放技能', async (t) => {
  const { engine, operator } = await setup(t, 'recruit_guard');
  const foe = enemy('enemy');
  foe.isBlockedBy = operator.id;
  foe.attackCooldown = 100;
  operator.blockingEnemyIds = [foe.id];
  engine.enemies = [foe];
  engine.update(1);
  assert.equal(operator.skillActive, false);
  assert.equal(foe.stats.hp, 4291);
  engine.update(2);
  assert.equal(operator.skillActive, true);
  assert.equal(foe.stats.hp, 3369);
});

test('技能就绪但没有攻击目标时保留技力', async (t) => {
  const { engine, operator } = await setup(t, 'recruit_guard');
  operator.skillAutoCooldown = 0;
  engine.update(0.1);
  assert.equal(operator.skillActive, false);
  assert.equal(operator.currentSp, operator.skill.cost);
  const foe = enemy('enemy');
  foe.isBlockedBy = operator.id;
  operator.blockingEnemyIds = [foe.id];
  engine.enemies = [foe];
  engine.update(0.1);
  assert.equal(operator.skillActive, true);
});

test('不会对已经离场的敌人自动释放技能', async (t) => {
  const { engine, operator } = await setup(t, 'recruit_guard');
  operator.skillAutoCooldown = 0;
  const foe = enemy('enemy');
  foe.markedForDeletion = true;
  engine.enemies = [foe];
  engine.update(0.1);
  assert.equal(operator.skillActive, false);
  assert.equal(operator.currentSp, operator.skill.cost);
});

test('医疗干员在技力就绪且治疗受伤友军时自动开启技能', async (t) => {
  const { engine, operator } = await setup(t, 'medic_field');
  operator.skillAutoCooldown = 0;
  operator.stats.hp = 500;
  engine.enemies = [enemy('enemy', 500, 32)];
  engine.update(0.1);
  assert.equal(operator.skillActive, true);
  assert.equal(operator.stats.hp, 1076);
});

test('重装干员受击充满技力后自动开启技能，技能期间不再受击回复', async (t) => {
  const { engine, operator } = await setup(t, 'recruit_defender');
  const foe = enemy('enemy');
  foe.isBlockedBy = operator.id;
  operator.blockingEnemyIds = [foe.id];
  operator.cooldown = 100;
  operator.skillAutoCooldown = 0;
  operator.currentSp = operator.skill.cost - 1;
  engine.enemies = [foe];
  const before = operator.stats.hp;
  engine.update(0.1);
  assert.equal(before - operator.stats.hp, 50);
  assert.equal(operator.skillActive, true);
  const after = operator.stats.hp;
  foe.attackCooldown = 0;
  operator.currentSp = 0;
  engine.update(0.1);
  assert.equal(after - operator.stats.hp, 25);
  assert.equal(operator.currentSp, 0);
});

test('远程命中也能为重装回复技力并触发技能', async (t) => {
  const { engine, operator } = await setup(t, 'recruit_defender');
  operator.cooldown = 100;
  operator.skillAutoCooldown = 0;
  operator.currentSp = operator.skill.cost - 1;
  engine.enemies = [enemy('enemy', 500, 32)];
  engine.projectiles.push({ id: 'enemy-shot', pos: { x: 32, y: 32 }, targetId: operator.id,
    speed: 600, damage: 300, color: 'red', markedForDeletion: false, atkType: 'physical', targetIsOperator: true });
  engine.update(0.1);
  assert.equal(operator.skillActive, true);
  assert.equal(operator.currentSp, operator.skill.cost);
});

test('防御技能降低实际受击伤害并在结束后失效', async (t) => {
  const { engine, operator } = await setup(t, 'recruit_defender');
  const foe = enemy('enemy');
  foe.isBlockedBy = operator.id;
  operator.blockingEnemyIds = [foe.id];
  operator.cooldown = 100;
  engine.enemies = [foe];
  assert.equal(engine.tryActivateSkill(operator.id), true);
  const before = operator.stats.hp;
  engine.update(0.1);
  assert.equal(before - operator.stats.hp, 25);
  engine.update(10);
  assert.equal(operator.skillActive, false);
  foe.attackCooldown = 0;
  const after = operator.stats.hp;
  engine.update(0.1);
  assert.equal(after - operator.stats.hp, 50);
});

test('防守姿态期间停止攻击', async (t) => {
  const { engine, operator } = await setup(t, 'defender_shield');
  const foe = enemy('enemy');
  foe.isBlockedBy = operator.id;
  operator.blockingEnemyIds = [foe.id];
  engine.enemies = [foe];
  assert.equal(engine.tryActivateSkill(operator.id), true);
  engine.update(0.1);
  assert.equal(foe.stats.hp, 5000);
});

test('持续技能的百分比攻击加成作用于实际伤害', async (t) => {
  const { engine, operator } = await setup(t, 'vanguard_scout');
  const foe = enemy('enemy');
  foe.isBlockedBy = operator.id;
  operator.blockingEnemyIds = [foe.id];
  engine.enemies = [foe];
  assert.equal(engine.tryActivateSkill(operator.id), true);
  engine.update(0.1);
  assert.equal(foe.stats.hp, 4600);
});

test('瞬发连击技能在下一次攻击生效一次并消耗技力', async (t) => {
  const { engine, operator } = await setup(t, 'guard_sword');
  const foe = enemy('enemy');
  foe.isBlockedBy = operator.id;
  operator.blockingEnemyIds = [foe.id];
  engine.enemies = [foe];
  assert.equal(engine.tryActivateSkill(operator.id), true);
  engine.update(0.1);
  assert.equal(foe.stats.hp, 4100);
  assert.equal(operator.skillActive, false);
  assert.equal(operator.currentSp, 0);
});

test('瞬发技能在没有目标时保持待触发，下一次攻击后结束', async (t) => {
  const { engine, operator } = await setup(t, 'sniper_marksman');
  assert.equal(engine.tryActivateSkill(operator.id), true);
  engine.update(1);
  assert.equal(operator.skillActive, true);
  const foe = enemy('enemy', 96, 32);
  engine.enemies = [foe];
  engine.update(0.2);
  assert.equal(foe.stats.hp, 3272);
  assert.equal(operator.skillActive, false);
});

test('瞬发范围技能按实际半径伤害邻近敌人', async (t) => {
  const { engine, operator } = await setup(t, 'caster_arclight');
  const first = enemy('first', 96, 32);
  const second = enemy('second', 120, 32);
  engine.enemies = [first, second];
  assert.equal(engine.tryActivateSkill(operator.id), true);
  engine.update(0.2);
  assert.equal(first.stats.hp, 3196);
  assert.equal(second.stats.hp, 3196);
});

test('持续多目标技能攻击范围内多个敌人并遵守目标上限', async (t) => {
  const { engine, operator } = await setup(t, 'caster_volcano');
  const enemies = Array.from({ length: 7 }, (_, i) => enemy(`enemy-${i}`, 96 + i, 32));
  engine.enemies = enemies;
  assert.equal(engine.tryActivateSkill(operator.id), true);
  engine.update(0.2);
  assert.equal(enemies.filter((target) => target.stats.hp < 5000).length, 6);
});

test('生命耗尽后只弹出一次失败结算', async (t) => {
  const { engine } = await setup(t, 'recruit_guard');
  const host = { children: [], appendChild(child) { this.children.push(child); } };
  const element = () => ({ classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, remove() {} });
  globalThis.document = { getElementById: () => host, createElement: element, addEventListener() {} };
  globalThis.requestAnimationFrame = () => {};
  t.after(() => { delete globalThis.document; delete globalThis.requestAnimationFrame; });
  engine.phase = 'PREP';
  engine.lives = 0;
  engine.update(0);
  engine.update(0);
  assert.equal(host.children.length, 1);
});

test('最终攻势胜利结算不会重复发放', async (t) => {
  const { engine, waveCount } = await setup(t, 'recruit_guard');
  const host = { children: [], appendChild(child) { this.children.push(child); } };
  const element = () => ({ classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, remove() {} });
  globalThis.document = { getElementById: () => host, createElement: element, addEventListener() {} };
  globalThis.requestAnimationFrame = () => {};
  t.after(() => { delete globalThis.document; delete globalThis.requestAnimationFrame; });
  engine.phase = 'PREP';
  engine.waveIndex = waveCount;
  engine.checkAndAnnounceAchievements = () => {};
  engine.finishFinalAssault('victory');
  engine.finishFinalAssault('victory');
  assert.equal(host.children.length, 1);
});
