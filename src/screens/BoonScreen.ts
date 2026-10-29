// v3.6.2：开局福利选择屏（PactScreen 之后、startGame 之前）
import { rollBoonChoices, Boon, BoonId } from '../config/boonData';
import { screenState, showOnly } from './shared';
import { startGame } from './GameScreen';

let initialized = false;
let currentChoices: Boon[] = [];
let selected: BoonId | null = null;
let pendingPactSelections: any[] | null = null;

export function showBoonScreen(activePactSelections: any[]): void {
  pendingPactSelections = activePactSelections;
  selected = null;
  currentChoices = rollBoonChoices();
  ensureScreenDom();
  showOnly('boon-screen');
  render();
}

export function initBoonScreen(): void {
  if (initialized) return;
  ensureScreenDom();
  initialized = true;
}

function ensureScreenDom(): void {
  if (document.getElementById('boon-screen')) return;
  const root = document.body;
  const div = document.createElement('div');
  div.id = 'boon-screen';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="screen-kicker">SIMULATION // PREPARATION</div>
    <h1>选择开局福利</h1>
    <div class="screen-description">从 3 个增益中选择 1 个，仅作用于本局</div>
    <div id="boon-grid"></div>
    <div class="screen-actions">
      <button id="btn-boon-skip" class="faction-back">跳过（无增益）</button>
      <button id="btn-boon-confirm" class="faction-confirm" disabled>确认开始 →</button>
    </div>
  `;
  root.appendChild(div);

  div.querySelector<HTMLButtonElement>('#btn-boon-skip')?.addEventListener('click', () => {
    selected = null;
    proceed();
  });
  div.querySelector<HTMLButtonElement>('#btn-boon-confirm')?.addEventListener('click', () => {
    proceed();
  });
}

function render(): void {
  const grid = document.getElementById('boon-grid');
  const confirm = document.getElementById('btn-boon-confirm') as HTMLButtonElement;
  if (!grid || !confirm) return;
  grid.innerHTML = currentChoices.map(b => {
    const isSel = selected === b.id;
    const rarityColor = b.rarity === 'rare' ? '#9b59b6' : '#3498db';
    return `
      <div data-id="${b.id}" class="boon-card${isSel ? ' selected' : ''}">
        <div style="font-size:36px;text-align:center;margin-bottom:8px;">${b.icon}</div>
        <div style="font-size:18px;font-weight:700;text-align:center;color:#fff;margin-bottom:4px;">${b.name}</div>
        <div style="font-size:11px;text-align:center;color:${rarityColor};font-weight:700;margin-bottom:8px;">${b.rarity === 'rare' ? '★ 稀有' : '常规'}</div>
        <div style="font-size:13px;color:#bdc3c7;text-align:center;line-height:1.5;">${b.desc}</div>
      </div>
    `;
  }).join('');
  grid.querySelectorAll<HTMLDivElement>('.boon-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id') as BoonId;
      selected = id;
      render();
    });
  });
  confirm.disabled = selected === null;
}

function proceed(): void {
  if (pendingPactSelections === null) return;
  const pacts = pendingPactSelections;
  pendingPactSelections = null;
  startGame(screenState.currentFactionId, screenState.currentRoster, pacts, selected);
}
