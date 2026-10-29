import assert from 'node:assert/strict';
import test from 'node:test';
import { createFinalState, advanceFinalTime, applyFinalDamage, applyFinalLeak } from '../server/assault.js';

test('最终攻势合并目标生命、按存活人数设定领袖生命并在超时后扣生命', () => {
  const state = createFinalState(2, 10, 1000);
  assert.equal(state.bossMaxHp, 450000);
  assert.equal(state.teamLives, 10);
  assert.equal(advanceFinalTime(state, 120999), null);
  assert.equal(state.teamLives, 10);
  assert.equal(advanceFinalTime(state, 122000), null);
  assert.equal(state.teamLives, 9);
  assert.equal(advanceFinalTime(state, 125999), null);
  assert.equal(state.teamLives, 6);
  assert.equal(advanceFinalTime(state, 140000), 'defeat');
  assert.equal(state.teamLives, 0);
});

test('领袖伤害按单次限伤判定，生命耗尽之后的伤害无效', () => {
  const state = createFinalState(1, 1, 0);
  assert.equal(applyFinalDamage(state, 300000, 0), false);
  assert.equal(state.bossHp, 225000);
  assert.equal(applyFinalDamage(state, 100, 120000), true);
  assert.equal(state.bossHp, 224900);
  assert.equal(applyFinalDamage(state, 224900, 121000), false);
  assert.equal(state.teamLives, 0);
  assert.equal(state.bossHp, 224900);
});

test('到达最终攻势最长时限时仍未获胜则失败', () => {
  const state = createFinalState(1, 500, 0);
  assert.equal(advanceFinalTime(state, 269999), null);
  assert.equal(advanceFinalTime(state, 270000), 'defeat');
});

test('最终攻势漏怪直接扣共享目标生命，扣尽时立即失败', () => {
  const state = createFinalState(2, 2, 0);
  assert.equal(applyFinalLeak(state, 1, 10000), true);
  assert.equal(state.teamLives, 1);
  assert.equal(applyFinalLeak(state, 1, 11000), true);
  assert.equal(state.result, 'defeat');
  assert.equal(applyFinalDamage(state, 100, 11000), false);
});
