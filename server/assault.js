import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../shared/finalAssault.json', import.meta.url), 'utf8'));

export function createFinalState(players, teamLives, startedAt) {
  const bossMaxHp = rules.healthPerPlayer * players;
  return { bossHp: bossMaxHp, bossMaxHp, teamLives, startedAt, overtime: 0,
    remainingSeconds: rules.timeLimitSeconds, result: null };
}

export function advanceFinalTime(state, now) {
  if (state.result) return state.result;
  const seconds = Math.max(0, Math.floor((now - state.startedAt) / 1000));
  state.remainingSeconds = Math.max(0, rules.timeLimitSeconds - seconds);
  const overtime = Math.min(rules.maxOvertimeSeconds, Math.max(0, seconds - rules.timeLimitSeconds));
  state.teamLives = Math.max(0, state.teamLives - (overtime - state.overtime));
  state.overtime = overtime;
  if (state.teamLives <= 0 || overtime >= rules.maxOvertimeSeconds) state.result = 'defeat';
  return state.result;
}

export function applyFinalDamage(state, amount, now) {
  if (advanceFinalTime(state, now) || !Number.isFinite(amount) || amount <= 0 || amount >= rules.damageLimit) return false;
  state.bossHp = Math.max(0, state.bossHp - amount);
  if (state.bossHp === 0) state.result = 'victory';
  return true;
}

export function applyFinalLeak(state, count, now) {
  if (advanceFinalTime(state, now) || !Number.isInteger(count) || count < 1) return false;
  state.teamLives = Math.max(0, state.teamLives - count);
  if (state.teamLives === 0) state.result = 'defeat';
  return true;
}
