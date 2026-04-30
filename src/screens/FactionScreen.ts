// 阵营选择页（v1.3.0）
import { FACTION_DB, saveFactionId, listFactions } from '../config/factions';
import { validateRoster } from '../config/roster';
import { screenState, showOnly } from './shared';
import { showRosterScreen, initRosterScreen } from './RosterScreen';
import { showPactScreen, initPactScreen } from './PactScreen';
import { showToast } from '../core/ModalSystem';

export function showFactionScreen(): void {
  showOnly('faction-screen');
  renderFactionScreen();
}

export function hideFactionScreen(): void {
  showOnly('start-screen');
}

export function initFactionScreen(): void {
  const fs = document.getElementById('faction-screen');
  if (!fs) return;
  document.getElementById('btn-faction-back')?.addEventListener('click', hideFactionScreen);
  document.getElementById('btn-faction-confirm')?.addEventListener('click', () => {
    const v = validateRoster(screenState.currentRoster);
    if (!v.ok) {
      showToast('当前阵容未填满稀有度：' + v.missing.join('、') + '，请先完成阵容编排。', { level: 'warn' });
      showRosterScreen();
      return;
    }
    saveFactionId(screenState.currentFactionId);
    // v3.1.0：阵营确认 → 跳到盟约选择页
    showPactScreen();
  });
  document.getElementById('btn-open-roster')?.addEventListener('click', showRosterScreen);
  initRosterScreen();
  initPactScreen();
}

export function renderFactionScreen(): void {
  const grid = document.getElementById('faction-grid')!;
  const detail = document.getElementById('faction-detail')!;
  const factions = listFactions();

  grid.innerHTML = '';
  factions.forEach(f => {
    const card = document.createElement('div');
    card.className = 'faction-card' + (f.id === screenState.currentFactionId ? ' selected' : '');
    card.style.color = f.color;
    card.innerHTML = `
      <div>
        <div class="fc-name">${f.name}</div>
        <div class="fc-tag">${f.shortDesc}</div>
      </div>
      <div class="fc-quick">${f.perks[0]}<br>${f.perks[1]}</div>
    `;
    card.addEventListener('click', () => {
      screenState.currentFactionId = f.id;
      renderFactionScreen();
    });
    grid.appendChild(card);
  });

  const f = FACTION_DB[screenState.currentFactionId];
  detail.style.color = f.color;
  detail.innerHTML = `
    <div class="fd-name" style="color:${f.color};">${f.name}</div>
    <div class="fd-tag">${f.shortDesc}</div>
    <div class="fd-desc" style="color:#ecf0f1;">${f.fullDesc}</div>
    <div style="font-size:13px;color:#7f8c8d;letter-spacing:2px;margin-bottom:8px;">阵营加成</div>
    <ul class="fd-perks">
      ${f.perks.map(p => `<li>${p}</li>`).join('')}
    </ul>
  `;
}
