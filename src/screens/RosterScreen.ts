// 阵容编排页（v1.3.1）
import { OPERATOR_DB } from '../config/gameData';
import { ROSTER_SLOTS, getCandidatesByRarity, saveRoster, validateRoster } from '../config/roster';
import { screenState, showOnly } from './shared';
import { renderFactionScreen } from './FactionScreen';

export function showRosterScreen(): void {
  showOnly('roster-screen');
  renderRosterScreen();
}

export function hideRosterScreen(): void {
  showOnly('faction-screen');
  renderFactionScreen();
}

export function initRosterScreen(): void {
  document.getElementById('btn-roster-back')?.addEventListener('click', hideRosterScreen);
  document.getElementById('btn-roster-save')?.addEventListener('click', () => {
    const v = validateRoster(screenState.currentRoster);
    if (!v.ok) {
      alert('阵容未填满！以下稀有度需补选：' + v.missing.map(r => '★'.repeat(r)).join(' / '));
      return;
    }
    saveRoster(screenState.currentRoster);
    hideRosterScreen();
  });
}

function renderRosterScreen(): void {
  const body = document.getElementById('roster-body')!;
  const cands = getCandidatesByRarity();
  const rarities = Object.keys(cands).map(Number).sort((a, b) => a - b);
  const v = validateRoster(screenState.currentRoster);
  const missingSet = new Set(v.missing);

  body.innerHTML = '';
  rarities.forEach(rarity => {
    const slots = ROSTER_SLOTS[rarity] ?? 1;
    const candIds = cands[rarity];
    const required = Math.min(slots, candIds.length);
    const picked = screenState.currentRoster[rarity] || [];
    const isInvalid = missingSet.has(rarity);

    const block = document.createElement('div');
    block.className = 'roster-rarity-block' + (isInvalid ? ' invalid' : '');
    const slotInfoCls = picked.length < required ? 'slot-info warn' : 'slot-info';
    block.innerHTML = `
      <div class="roster-rarity-title">
        <span class="stars">${'★'.repeat(rarity)}</span>
        <span>稀有度 ${rarity}</span>
        <span class="${slotInfoCls}">已选 ${picked.length} / 需要 ${required}（候选 ${candIds.length}）</span>
      </div>
      <div class="roster-cards" data-rarity="${rarity}"></div>
    `;
    const cardsContainer = block.querySelector('.roster-cards') as HTMLElement;

    candIds.forEach(id => {
      const tpl = OPERATOR_DB[id];
      const isPicked = picked.includes(id);
      const isFull = picked.length >= required && !isPicked;
      const card = document.createElement('div');
      card.className = 'roster-card' + (isPicked ? ' selected' : '') + (isFull ? ' disabled' : '');
      card.style.borderLeft = `4px solid ${tpl.color}`;
      card.innerHTML = `
        ${isPicked ? '<div class="rc-check">✓</div>' : ''}
        <div class="rc-name">${tpl.name}</div>
        <div class="rc-meta">${tpl.placement === 'ground' ? '地面' : '高台'} · 费用 ${tpl.cost}</div>
      `;
      card.addEventListener('click', () => toggleRosterPick(rarity, id, required));
      cardsContainer.appendChild(card);
    });

    body.appendChild(block);
  });
}

function toggleRosterPick(rarity: number, id: string, required: number): void {
  const picked = screenState.currentRoster[rarity] || [];
  const idx = picked.indexOf(id);
  if (idx >= 0) {
    picked.splice(idx, 1);
  } else {
    if (picked.length >= required) return;
    picked.push(id);
  }
  screenState.currentRoster[rarity] = picked;
  renderRosterScreen();
}
