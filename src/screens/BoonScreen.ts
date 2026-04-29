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
  div.style.cssText = 'display:none;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:30px;background:linear-gradient(135deg,#1a1d24,#2a1d3a);color:#fff;';
  div.innerHTML = `
    <h1 style="font-size:30px;margin:0 0 8px;background:linear-gradient(90deg,#f1c40f,#e67e22);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">⚜ 开局福利</h1>
    <div style="color:#bdc3c7;margin-bottom:20px;font-size:14px;">从 3 个增益中选择 1 个，仅作用于本局</div>
    <div id="boon-grid" style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;max-width:900px;"></div>
    <div style="margin-top:24px;display:flex;gap:14px;">
      <button id="btn-boon-skip" style="padding:10px 20px;background:#34495e;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:14px;">跳过 (无增益)</button>
      <button id="btn-boon-confirm" disabled style="padding:10px 28px;background:linear-gradient(135deg,#27ae60,#16a085);color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:700;font-size:15px;">确认开始 ▶</button>
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
      <div data-id="${b.id}" class="boon-card" style="cursor:pointer;width:240px;padding:18px;border:2px solid ${isSel ? '#f1c40f' : rarityColor};border-radius:10px;background:linear-gradient(135deg,#2a2d35,#1a1d24);transition:transform 0.15s;${isSel ? 'transform:translateY(-4px);box-shadow:0 6px 20px rgba(241,196,15,0.4);' : ''}">
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
