// 盟约选择页（v3.1.0；v3.2.1：每个盟约可切换 普通/枷锁 模式；v3.3.2：预览潜在共鸣）
import { PACT_DB, SELECTABLE_PACTS, PACT_PICK_MIN, PACT_PICK_MAX, RESONANCE_DB } from '../config/gameData';
import { PactSelection } from '../types';
import { screenState, showOnly } from './shared';
import { startGame } from './GameScreen';

let selections: PactSelection[] = []; // 玩家已选盟约（含 shackled 标记）
let initialized = false;

export function showPactScreen(): void {
  showOnly('pact-screen');
  selections = [];
  renderPactScreen();
}

export function initPactScreen(): void {
  if (initialized) return;
  const ps = document.getElementById('pact-screen');
  if (!ps) return;
  document.getElementById('btn-pact-back')?.addEventListener('click', () => showOnly('faction-screen'));
  document.getElementById('btn-pact-confirm')?.addEventListener('click', () => {
    if (selections.length < PACT_PICK_MIN) {
      alert(`至少需要选择 ${PACT_PICK_MIN} 个盟约`);
      return;
    }
    startGame(screenState.currentFactionId, screenState.currentRoster, selections.slice());
  });
  initialized = true;
}

function renderPactScreen(): void {
  const grid = document.getElementById('pact-grid');
  const counter = document.getElementById('pact-counter');
  if (!grid || !counter) return;

  counter.textContent = `已选 ${selections.length} / ${PACT_PICK_MAX}（至少 ${PACT_PICK_MIN}）`;

  // v3.3.2：共鸣预览 — 扫描 RESONANCE_DB，列出当前选择可能触发的共鸣
  let preview = document.getElementById('pact-resonance-preview') as HTMLDivElement | null;
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'pact-resonance-preview';
    preview.style.cssText = 'margin:10px 0 4px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;';
    counter.parentElement?.insertBefore(preview, counter.nextSibling);
  }
  const selIds = new Set(selections.map(s => s.defId));
  const matched = Object.values(RESONANCE_DB).filter(r => r.requires.every(req => selIds.has(req.defId)));
  if (matched.length === 0) {
    preview.innerHTML = '';
  } else {
    preview.innerHTML = matched.map(r => {
      const tip = r.requires.map(req => {
        const d = PACT_DB[req.defId];
        return d ? `${d.name} 达 tier${req.minTier + 1}` : req.defId;
      }).join(' + ');
      // v3.3.3：检测当前选择中是否至少 1 个 require pact 是 shackled → 提示翻倍
      const willBoost = !!r.shackledBoosts && r.requires.some(req => {
        const sel = selections.find(s => s.defId === req.defId);
        return !!sel && sel.shackled;
      });
      const bg = willBoost ? 'linear-gradient(90deg,#c0392b,#e67e22,#f1c40f)' : 'linear-gradient(90deg,#f1c40f,#e67e22)';
      const border = willBoost ? '#c0392b' : '#fff';
      const prefix = willBoost ? '⛓✨ 枷锁加成·翻倍' : '✨ 潜在共鸣';
      const suffix = willBoost ? ' ×2' : '';
      return `<div title="需满足：${tip}${willBoost ? '\n枷锁加成生效中：效果翻倍' : ''}" style="padding:4px 12px;border-radius:14px;background:${bg};color:#000;font-size:12px;font-weight:bold;border:1px solid ${border};">${prefix}：${r.name} — ${r.desc.split('：').pop()}${suffix}</div>`;
    }).join('');
  }

  grid.innerHTML = '';
  for (const id of SELECTABLE_PACTS) {
    const def = PACT_DB[id];
    if (!def) continue;
    const sel = selections.find(s => s.defId === id);
    const isSelected = !!sel;
    const isShackled = !!sel?.shackled;

    const card = document.createElement('div');
    card.className = 'pact-card' + (isSelected ? ' selected' : '');
    card.style.cssText = `
      border: 2px solid ${isSelected ? (isShackled ? '#c0392b' : '#f1c40f') : '#34495e'};
      border-radius: 10px;
      padding: 14px 16px;
      background: ${isSelected ? (isShackled ? 'rgba(192,57,43,0.10)' : 'rgba(241,196,15,0.10)') : 'rgba(0,0,0,0.25)'};
      cursor: pointer;
      transition: all 0.15s;
      color: #ecf0f1;
      position: relative;
    `;

    const sources = def.sources.map(s => `${s.source}(+${s.perEvent})`).join('，');
    const decayTxt = def.decay ? `<div style="color:#e67e22;font-size:12px;">衰减：每 ${def.decay.interval}s 掉 ${def.decay.perTick} 层</div>` : '';
    // v3.2.1：枷锁模式下展示降低后的阈值
    const thrFn = (t: number) => isShackled ? Math.max(1, Math.ceil(t * 0.7)) : t;
    const tiersHtml = def.tiers.map((t, i) => {
      const eff = thrFn(t.threshold);
      const orig = t.threshold;
      const thrTxt = isShackled && eff !== orig ? `<s style="color:#7f8c8d;">${orig}</s> ${eff}` : `${eff}`;
      return `<li style="margin:2px 0;color:${['#7f8c8d','#3498db','#9b59b6','#f1c40f'][Math.min(i+1,3)]};">阈值 ${thrTxt}：${t.description}</li>`;
    }).join('');
    const penaltyTxt = def.penaltyDesc
      ? `<div style="margin-top:8px;padding:6px 8px;border-left:3px solid #c0392b;background:rgba(192,57,43,${isShackled ? 0.20 : 0.06});color:${isShackled ? '#e74c3c' : '#7f8c8d'};font-size:12px;">⛓ ${def.penaltyDesc}${isShackled ? '（已生效）' : '（未启用）'}</div>`
      : '';

    // v3.2.1：模式切换按钮（仅当此盟约有 penalty 时）
    const modeBtn = def.penalty
      ? `<button class="pact-mode-toggle" data-pid="${id}" style="position:absolute;top:10px;right:10px;padding:3px 9px;font-size:11px;border-radius:4px;border:1px solid ${isShackled ? '#c0392b' : '#7f8c8d'};background:${isShackled ? '#c0392b' : 'transparent'};color:${isShackled ? '#fff' : '#bdc3c7'};cursor:pointer;">${isShackled ? '枷锁 ⛓' : '普通'}</button>`
      : '';

    card.innerHTML = `
      ${modeBtn}
      <div style="font-size:18px;font-weight:bold;margin-bottom:6px;color:${isShackled ? '#e74c3c' : '#f1c40f'};padding-right:60px;">${def.name}</div>
      <div style="font-size:13px;color:#bdc3c7;margin-bottom:8px;">${def.desc}</div>
      <div style="font-size:12px;color:#95a5a6;">来源：${sources}　上限：${def.cap}</div>
      ${decayTxt}
      <ul style="margin:6px 0 0;padding-left:18px;font-size:12px;">${tiersHtml}</ul>
      ${penaltyTxt}
    `;

    // 卡片主体点击：选中/取消
    card.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      if (target.classList.contains('pact-mode-toggle')) return;
      const idx = selections.findIndex(s => s.defId === id);
      if (idx >= 0) {
        selections.splice(idx, 1);
      } else {
        if (selections.length >= PACT_PICK_MAX) selections.shift();
        selections.push({ defId: id, shackled: false });
      }
      renderPactScreen();
    });

    // 模式切换按钮
    if (def.penalty) {
      const btn = card.querySelector('.pact-mode-toggle') as HTMLButtonElement | null;
      btn?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        let s = selections.find(x => x.defId === id);
        if (!s) {
          if (selections.length >= PACT_PICK_MAX) selections.shift();
          s = { defId: id, shackled: false };
          selections.push(s);
        }
        s.shackled = !s.shackled;
        renderPactScreen();
      });
    }

    grid.appendChild(card);
  }
}
