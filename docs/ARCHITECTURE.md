# 架构审视与重构路线（v1.x）

**审视日期：** 2026-04-29  
**版本基线：** v1.0.0（独立仓库迁移完成）

本文档是对当前代码结构的一次集中审视，并据此规划 v1.1 - v1.5 的重构与迭代路径。后续每完成一个阶段都会回写「实际状态」。

---

## 1. 当前架构快照

```
src/
├── config/gameData.ts      # 单一真理源：地图库 / 干员模板 / 敌人模板 / 波次 / 抽取概率
├── core/
│   ├── GameEngine.ts       # 全部运行时状态 + 战斗循环 + 商店 + 合并 + 待部署
│   └── MathUtils.ts        # 距离 / 碰撞 / 攻击范围网格
├── view/Renderer.ts        # 单 Canvas 渲染，无脏矩形
├── types/index.ts          # 全局类型
├── styles/main.css         # 仅入口屏样式
└── main.ts                 # 入口 + 全部 DOM/UI/拖拽/适配（27KB，过厚）
index.html                  # 主结构 + 大量内联样式（18KB）
```

### 量化体积

| 文件 | 体积 | 评估 |
|---|---|---|
| `src/main.ts` | 27 KB | ⚠️ 过厚，UI 与状态机耦合 |
| `src/core/GameEngine.ts` | 24 KB | ⚠️ 引擎 + 商店 + 合并 + 待部署混杂 |
| `index.html` | 18 KB | ⚠️ 内联样式偏多 |
| `src/view/Renderer.ts` | 13 KB | ✅ 职责单一 |
| `src/config/gameData.ts` | 8 KB | ✅ 但需扩展（职业/天赋/技能数组） |

---

## 2. 主要痛点

1. **干员模板不足以承载明日方舟体系** — 当前 `OperatorTemplate` 只有单一 `skill`，没有职业、没有天赋、没有「同一技能不同等级数值」的描述能力。
2. **地图路径校验缺失** — `gameData.ts` 注释要求路径全是地面（type=0），但**没有运行时校验**，已有的部分 waypoint 经过高台。
3. **前置流程缺失** — 当前 `start-screen` 只有「开始游戏」一个按钮，没有阵营选择、阵容编排，全局 buff 与可购买池机制无法注入。
4. **联机能力无骨架** — 没有任何网络层抽象，未来 WebSocket 接入会与 `GameEngine` 内部状态紧耦合。
5. **UI 层缺乏「页面」概念** — 只有 `start-screen` ↔ `app-root` 二元切换，无法承载阵营选择 / 阵容编排 / 联机大厅多页面流程。

---

## 3. 重构原则（v1.x 阶段）

- **不大动核心循环**：`GameEngine.update()` / 战斗 / 阻挡 / 抛射 全部保持兼容，避免回归。
- **数据驱动**：阵营、职业、天赋、技能档位均落到 `config/` 下的纯数据，便于后续扩展到明日方舟全干员表。
- **页面路由极简化**：用 DOM 显隐 + 一个 `screenManager` 模块管理 5 个页面（启动 / 阵营 / 阵容 / 主战 / 联机）。不引入框架。
- **联机预留接口**：定义 `INetworkAdapter`，单机模式给一个 NoopAdapter。WebSocket 真接入留到 v2.x。
- **配置兼容旧存档**：阵营选择、阵容编排结果存 `localStorage`，缺失时回退默认。

---

## 4. v1.x 阶段路线

| 版本 | 主题 | 关键产物 |
|---|---|---|
| **v1.0.0** | 独立仓库迁移 | 新 .git / .gitignore / 编码统一 |
| **v1.1.0** | 地图数据修复 + 路径校验 | `validateMaps()`，所有 waypoint 必须落地面；启动时控制台报错列出违规地图 |
| **v1.2.0** | 干员体系重构 | `OperatorClass` / `Talent` / `SkillLevels`；旧字段平滑映射；商店/渲染/详情联动 |
| **v1.3.0** | 阵营选择 + 阵容编排两个前置页面 | `screens/FactionScreen.ts` / `screens/RosterScreen.ts`；全局 buff 接入 `GameEngine` 初始化 |
| **v1.4.0** | 联机模式占位 UI + 网络适配器骨架 | `network/INetworkAdapter.ts` / `NoopAdapter.ts`；主菜单第三个按钮 |
| **v1.5.0+** | 长期路线写入 ROADMAP | 1:1 明日方舟卫戍协议落地清单 |

---

## 5. 模块化目标终态（参考）

```
src/
├── config/
│   ├── gameData.ts         # 仅 CONFIG / WAVES / RARITY_RATES
│   ├── maps.ts             # 地图库 + 校验
│   ├── operators.ts        # 干员模板（含 class / talents / skills[]）
│   ├── factions.ts         # 阵营定义
│   └── enemies.ts          # 敌人模板
├── core/
│   ├── GameEngine.ts       # 仅运行时
│   ├── ShopSystem.ts       # 商店 / 合并 / 临时商店（待 v1.2 提取）
│   └── MathUtils.ts
├── network/
│   ├── INetworkAdapter.ts
│   └── NoopAdapter.ts
├── screens/
│   ├── ScreenManager.ts
│   ├── StartScreen.ts
│   ├── FactionScreen.ts
│   ├── RosterScreen.ts
│   └── MultiplayerScreen.ts
├── view/Renderer.ts
└── main.ts                 # 仅引导
```

**注意**：v1.x 不强制达到上述终态，按需拆分。优先保证功能落地与 commit 粒度可回滚。

---

## 6. 长期路线（写入 ROADMAP.md，本文档不重复）

参考 PRTS Wiki「卫戍协议：盟约」机制；目标 1:1 复刻：
- 多职业树（近卫/狙击/术师/医疗/重装/先锋/特种/辅助）
- 盟约系统 + 叠层 UI
- 多阵营 / 多盟约组合
- 联机协同（双人共享地图，独立队列）

详见 [ROADMAP.md](ROADMAP.md)。
