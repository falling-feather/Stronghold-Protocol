// 盟约选择页（v3.1.0）：阵营确认后插入此页，玩家选 1-2 个盟约后进入对局
import { PACT_DB, SELECTABLE_PACTS, PACT_PICK_MIN, PACT_PICK_MAX } from '../config/gameData';
import { screenState, showOnly } from './shared';
import { startGame } from './GameScreen';

let selectedPacts: string[] = [];
let initialized = false;

export function showPactScreen(): void {
  showOnly('pact-screen');
  selectedPacts = [];
  renderPactScreen();
}

export function initPactScreen(): void {
  if (initialized) return;
  const ps = document.getElementById('pact-screen');
  if (!ps) return;
  document.getElementById('btn-pact-back')?.addEventListener('click', () => showOnly('faction-screen'));
  document.getElementById('btn-pact-confirm')?.addEventListener('click', () => {
    if (selectedPacts.length < PACT_PICK_MIN) {
      alert(`至少需要选择 ${PACT_PICK_MIN} 个盟约`);
      return;
    }
    startGame(screenState.currentFactionId, screenState.currentRoster, selectedPacts.slice());
  });
  initialized = true;
}

function renderPactScreen(): void {
  const grid = document.getElementById('pact-grid');
  const counter = document.getElementById('pact-counter');
  if (!grid || !counter) return;

  counter.textContent = `已选 ${selectedPacts.length} / ${PACT_PICK_MAX}（至少 ${PACT_PICK_MIN}）`;

  grid.innerHTML = '';
  for (const id of SELECTABLE_PACTS) {
    const def = PACT_DB[id];
    if (!def) continue;
    const isSelected = selectedPacts.includes(id);

    const card = document.createElement('div');
    card.className = 'pact-card' + (isSelected ? ' selected' : '');
    card.style.cssText = `
      border: 2px solid ${isSelected ? '#f1c40f' : '#34495e'};
      border-radius: 10px;
      padding: 14px 16px;
      background: ${isSelected ? 'rgba(241,196,15,0.10)' : 'rgba(0,0,0,0.25)'};
      cursor: pointer;
      transition: all 0.15s;
      color: #ecf0f1;
    `;

    const sources = def.sources.map(s => `${s.source}(+${s.perEvent})`).join('，');
    const decayTxt = def.decay ? `<div style="color:#e67e22;font-size:12px;">衰减：每 ${def.decay.interval}s 掉 ${def.decay.perTick} 层</div>` : '';
    const tiersHtml = def.tiers.map((t, i) => `<li style="margin:2px 0;color:${['#7f8c8d','#3498db','#9b59b6','#f1c40f'][Math.min(i+1,3)]};">阈值 ${t.threshold}：${t.description}</li>`).join('');
    // v3.2.0：枷锁段
    const penaltyTxt = def.penaltyDesc
      ? `<div style="margin-top:8px;padding:6px 8px;border-left:3px solid #c0392b;background:rgba(192,57,43,0.12);color:#e74c3c;font-size:12px;">⛓ ${def.penaltyDesc}</div>`
      : '';

    card.innerHTML = `
      <div style="font-size:18px;font-weight:bold;margin-bottom:6px;color:#f1c40f;">${def.name}</div>
      <div style="font-size:13px;color:#bdc3c7;margin-bottom:8px;">${def.desc}</div>
      <div style="font-size:12px;color:#95a5a6;">来源：${sources}　上限：${def.cap}</div>
      ${decayTxt}
      <ul style="margin:6px 0 0;padding-left:18px;font-size:12px;">${tiersHtml}</ul>
      ${penaltyTxt}
    `;

    card.addEventListener('click', () => {
      const idx = selectedPacts.indexOf(id);
      if (idx >= 0) {
        selectedPacts.splice(idx, 1);
      } else {
        if (selectedPacts.length >= PACT_PICK_MAX) {
          // 达到上限：替换最早一个
          selectedPacts.shift();
        }
        selectedPacts.push(id);
      }
      renderPactScreen();
    });

    grid.appendChild(card);
  }
}
