# 盟约叠层（Pact Stack）设计文档 — v3.x

本文档定义 v3.x 范围内的「盟约叠层」机制。该机制是一个跨战斗、跨波次的全局状态层，通过事件累加叠层，达到阈值后触发分级 Buff。其底层实现复用 v2.3.0 的 `StatusEffect` 框架。

## 1. 设计目标

1. 提供一套「玩家越打越强」的纵向反馈，弥补当前每波结算只是经济性回血的扁平体验。
2. 让「击杀 / 部署 / 撤退 / 波次结算」这些散点事件具有跨波次价值。
3. 配置驱动：盟约定义全部位于 `gameData.ts`，引擎不耦合具体盟约语义。
4. 分层效果：每个盟约把叠层数映射到若干阈值，阈值跨越时刷新挂载到玩家全局或所有干员上的 effects。

## 2. 数据结构

### 2.1 叠层事件源 `PactSource`

```ts
type PactSource =
  | 'kill_any'        // 击杀任意敌人
  | 'kill_elite'      // 击杀精英（boss 阶段触发的或带 traits.bossPhase 的）
  | 'kill_flying'
  | 'kill_stealth'
  | 'deploy_any'      // 任意干员部署
  | 'deploy_class:X'  // 指定职业部署（X = guard|defender|sniper|caster|medic|vanguard|specialist|supporter）
  | 'retreat_any'
  | 'wave_clear'      // 波次结算（敌人全清且未漏怪）
  | 'wave_perfect';   // 波次结算且当波 0 漏怪
```

### 2.2 盟约定义 `PactDefinition`

```ts
interface PactTier {
  threshold: number;           // 触达此叠层数时生效
  effects: StatusEffect[];     // 应用对象由 scope 决定；duration 通常为 -1
  description: string;         // UI 展示
}

interface PactDefinition {
  id: string;                  // 'pact_flame_blessing'
  name: string;                // '炎佑'
  desc: string;                // 一句话说明
  scope: 'all_operators'       // 挂到每个已部署 + 未部署模板（部署即生效）
       | 'all_enemies'         // 挂到所有敌人（debuff 类盟约）
       | 'global';             // 仅作为状态使用，不挂 effects（由引擎读 stack 直接判定）
  sources: { source: PactSource; perEvent: number }[]; // 每次事件叠加的层数
  decay?: { interval: number; perTick: number };       // 可选衰减（每 interval 秒掉 perTick 层）
  cap: number;                 // 叠层数上限
  tiers: PactTier[];           // 按 threshold 升序
}
```

### 2.3 运行时 `PactState`

```ts
interface PactRuntime {
  defId: string;
  stack: number;
  appliedTier: number;   // 当前已应用到的 tier 索引（-1 表示未达任何阈值）
  decayAccum: number;
}
```

GameEngine 持有 `pacts: PactRuntime[]`。波次开始或战局开始时按 `ACTIVE_PACTS` 列表初始化。

## 3. 引擎接入

### 3.1 事件总线（最小实现）

不引入完整 EventBus，而是在事件触发处直接调用 `this.onPactEvent(source, ctx?)`：

| 触发位置 | source |
|---|---|
| `updateProjectiles` 击杀分支 | `kill_any` + 根据 traits 派发 `kill_flying` / `kill_stealth` / `kill_elite` |
| `tryPlaceOperator` 成功 | `deploy_any` + `deploy_class:<class>` |
| `handleOperatorRetreat` | `retreat_any` |
| `endCombat` 波次结算 | `wave_clear`，未漏怪则追加 `wave_perfect` |

### 3.2 叠层处理流程

`onPactEvent(source)`：
1. 遍历 `this.pacts`，对每个 runtime：
   - 在其 def.sources 中查找匹配 source；若有则 `stack = clamp(stack + perEvent, 0, cap)`。
2. 调用 `reconcilePactTiers(runtime)`：
   - 计算当前 stack 对应的 tier 索引（最大 threshold ≤ stack 的 tier）。
   - 若 != appliedTier：先撤掉旧 tier 的 effects（按 effect.id 在所有目标的 effects 列表里 splice），再应用新 tier 的 effects。
3. UI 标记需要刷新（顶栏徽记数字与详情面板）。

### 3.3 衰减

每帧（或每秒一次）调用 `tickPactDecay(dt)`：
- 对带 decay 的 runtime 累加 `decayAccum`，每跨过 interval 减 perTick，再 reconcile。

## 4. UI 接入（v3.0.0 仅做最小可视化）

- 顶栏右侧追加「盟约徽记区」：每个 active pact 一个圆形徽记，圆内显示 stack。徽记颜色按 tier 渐变（未达 tier1 灰、达 tier1 蓝、tier2 紫、tier3 金）。
- hover 徽记弹出悬浮卡：盟约名 / 当前 stack/cap / 已生效 tier 描述 / 下一档阈值。
- v3.0.x 内不在干员详情面板单独标注 pact 来源的 effects；仅以 `effect.name` 上加前缀「[盟约·炎佑]」便于识别。

## 5. v3.x 子版本切分

- **v3.0.0**：框架落地（PactDefinition/PactRuntime/onPactEvent/reconcile/tick decay）+ 1 个示范盟约「炎佑」（kill_any 累积 → tier1 干员 +5% 攻 / tier2 +10% / tier3 +15%）+ 顶栏徽记最小 UI。
- **v3.0.1**：补 wave_clear / wave_perfect 触发 + 盟约「余音」（wave_perfect → 所有干员 +5% aspd 永久至本局结束）。
- **v3.0.2**：补 deploy/retreat 触发 + 盟约「碎铳之簧」（retreat_any 累积 → 临时全员 atk +10%，5 秒衰减）。
- **v3.1.0**：盟约选择 UI（开局前从 N 个候选里选 K 个）+ 至少 5 个盟约配置覆盖各 source。

## 6. 与既有系统的复用关系

| 现有系统 | 复用方式 |
|---|---|
| v2.3.0 StatusEffect | tier.effects 直接是 StatusEffect[]；scope=all_operators 时遍历 push 到每个 op.effects |
| v2.3.0 modifyStat | 无需改动；盟约 buff 经此统一计算 |
| v2.3.2 buildTalentEffects | 同样的「挂载 / 解除」模式参考；reconcile 时按 effect.id 撤回 |
| v2.4.0 EnemyTraits | onPactEvent 中 `kill_flying/kill_stealth/kill_elite` 直接读 dead.traits 派发 |

## 7. 风险与开放问题

1. **撤回旧 tier 的 effects 时如何识别？** 约定 effect.id 以 `pact_<defId>_t<tierIdx>_<i>` 命名，撤回时 splice 所有 id 匹配前缀 `pact_<defId>_` 的 effects。
2. **未部署的干员如何受 pact buff 影响？** v3.0.0 仅在「部署时」追加当前激活 tier 的 effects；后续 reconcile 仅作用已部署干员。商店预览的属性数值不显示 pact 加成（避免误导）。
3. **多 pact 叠加是否会引发组合膨胀？** 受 cap 与 tier 数量约束，即使 5 个 pact × 3 tier = 至多 15 条 pact effects，仍在 modifyStat 的 O(n) 范围内可控。
4. **盟约持久化？** v3.x 不做存档，每局开局重新初始化。

## 8. 验证路径

- 单元（手动）：在 dev console `engine.pacts[0].stack += N; engine.reconcilePactTiers(engine.pacts[0])` → 干员 effects 列表与 modifyStat 输出预期。
- 烟雾：连续清几波怪 → 顶栏徽记 stack 增长 → 跨过阈值时干员 atk 数值跃升。

