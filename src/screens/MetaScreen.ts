// v3.6.0：跨局升级树屏幕
import { showOnly } from './shared';
import { META_UPGRADES, isPrereqMet, TAG_LABELS, calcTotalSpentShards } from '../config/metaData';
import { loadMeta, getUpgradeTier, setUpgradeTier, addShards, resetMetaWithRefund } from '../core/MetaSave';
import { showToast, showConfirm } from '../core/ModalSystem';

let inited = false;
let body: HTMLElement | null = null;
let shardsDisplay: HTMLElement | null = null;
let activeTagFilter: 'all' | 'economy' | 'pact' | 'event' | 'defense' = 'all';

export function initMetaScreen(): void {
  if (inited) return;
  inited = true;
  body = document.getElementById('meta-body');
  shardsDisplay = document.getElementById('meta-shards-display');
  document.getElementById('btn-meta-back')?.addEventListener('click', () => showOnly('start-screen', 'flex'));
  document.getElementById('btn-meta-tree')?.addEventListener('click', () => showMetaScreen());
}

export function showMetaScreen(): void {
  initMetaScreen();
  showOnly('meta-screen', 'flex');
  render();
}

function render(): void {
  if (!body || !shardsDisplay) return;
  const meta = loadMeta();
  shardsDisplay.textContent = `⬢ ${meta.shards}`;
  const filtered = activeTagFilter === 'all'
    ? META_UPGRADES
    : META_UPGRADES.filter(u => u.tag === activeTagFilter);
  const cards = filtered.map(up => {
    const tier = getUpgradeTier(up.id);
    const maxed = tier >= up.maxTier;
    const prereqOk = isPrereqMet(up);
    const cost = maxed ? 0 : up.costPerTier(tier);
    const canAfford = !maxed && prereqOk && meta.shards >= cost;
    const tiers = Array.from({ length: up.maxTier }, (_, i) =>
      `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:4px;background:${i < tier ? '#9b59b6' : 'rgba(255,255,255,0.12)'};border:1px solid #555;"></span>`
    ).join('');
    const prereqHint = up.prereq && !prereqOk
      ? `<div style="font-size:12px;color:#e67e22;margin-top:4px;">🔒 需要：${META_UPGRADES.find(u => u.id === up.prereq!.id)?.name ?? up.prereq.id} 达 ${up.prereq.tier} 级</div>`
      : '';
    const tag = TAG_LABELS[up.tag];
    const tagChip = `<span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${tag.color}22;color:${tag.color};border:1px solid ${tag.color}66;margin-right:6px;vertical-align:middle;">${tag.label}</span>`;
    return `
      <div data-id="${up.id}" class="meta-card${maxed ? ' maxed' : ''}${!prereqOk ? ' locked' : ''}">
        <div style="flex:1;">
          <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:4px;">${tagChip}${up.name}<span style="font-size:13px;color:#bdc3c7;font-weight:400;margin-left:8px;">(${tier}/${up.maxTier})</span></div>
          <div style="font-size:13px;color:#bdc3c7;margin-bottom:6px;">${up.desc}</div>
          <div>${tiers}</div>
          ${prereqHint}
        </div>
        <button class="meta-buy-btn" data-id="${up.id}" ${!canAfford ? 'disabled' : ''}>
          ${maxed ? '已满级' : !prereqOk ? '🔒 锁定' : `升级 · ⬢${cost}`}
        </button>
      </div>
    `;
  }).join('');
  const totalSpent = calcTotalSpentShards();
  const refund = Math.floor(totalSpent * 0.8);
  const filterChips = (['all', 'economy', 'pact', 'event', 'defense'] as const).map(key => {
    const isActive = activeTagFilter === key;
    const label = key === 'all' ? '全部' : TAG_LABELS[key].label;
    return `<button class="meta-filter-chip${isActive ? ' selected' : ''}" data-tag="${key}">${label}</button>`;
  }).join('');
  const resetBtn = `
    <div style="margin-top:24px;text-align:center;">
      <button id="meta-reset-btn">重置进度（返还 80% = ⬢${refund}）</button>
    </div>
  `;
  body.innerHTML = `
    <div style="max-width:760px;margin:0 auto;">
      <div class="meta-intro">
        ⬢ <b>碎片</b>是跨局货币：每完成 1 波 +4，完美作战额外 +2；结算时按通关情况和史诗事件获得额外碎片。<br>
        升级在此处一次性消耗碎片，效果永久生效于所有后续局。重置可返还 80% 已花费碎片，便于重新分配。
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:14px;flex-wrap:wrap;">${filterChips}</div>
      ${cards || '<div style="text-align:center;color:#7f8c8d;padding:40px;">该分类下暂无升级</div>'}
      ${resetBtn}
    </div>
  `;
  body.querySelectorAll<HTMLButtonElement>('.meta-buy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id!;
      const up = META_UPGRADES.find(u => u.id === id);
      if (!up) return;
      const tier = getUpgradeTier(id);
      if (tier >= up.maxTier) return;
      const cost = up.costPerTier(tier);
      const m = loadMeta();
      if (m.shards < cost) return;
      addShards(-cost);
      setUpgradeTier(id, tier + 1);
      render();
    });
  });
  body.querySelector('#meta-reset-btn')?.addEventListener('click', async () => {
    const spent = calcTotalSpentShards();
    const refund = Math.floor(spent * 0.8);
    if (spent === 0) {
      showToast('当前没有可重置的升级。', { level: 'info' });
      return;
    }
    const ok = await showConfirm('重置跨局升级', `将返还 ⦿${refund}（已花费 ⦿${spent} 的 80%）。\n确定要重置所有跨局升级吗？`, { okLabel: '确定重置', danger: true });
    if (ok) {
      const refunded = resetMetaWithRefund(spent, 0.8);
      showToast(`已重置。返还 ⦿${refunded}`, { level: 'success' });
      render();
    }
  });
  body.querySelectorAll<HTMLButtonElement>('.meta-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      activeTagFilter = chip.dataset.tag as typeof activeTagFilter;
      render();
    });
  });
}
