# 项目快照（SNAPSHOT）

> 写作时间：2026-04-30（v3.16.0 更新）
> 目的：让接手者在 5 分钟内理解仓库现状、当前进度、提交规范、下一步候选。
> HEAD：`<待推送> V3.16.0 三职业底层接入 + ws 中继部署模板 + MP 大厅重排`
> 工作树：clean，远端 `origin → github.com/falling-feather/Stronghold-Protocol`（main 已强推覆盖远端）。

---

## 1. 项目一句话

「明日方舟·卫戍协议」灵感的塔防 + Roguelike + 局内联机协作 demo。
TypeScript 5 strict + Vite 5 + WebSocket（ws@8.20）。所有游玩态都在浏览器，
联机仅用一个轻量 Node 中继服（`server/index.js`，端口 8787）。

## 2. 仓库目录速览

```
src/
  main.ts              # 入口、screen 路由、全局 mp/audio 适配挂载
  config/              # 静态 DB（gameData.ts: 干员/敌人/波次/盟约/共鸣；boonData.ts；events.ts；achievements.ts；factions.ts）
  core/                # GameEngine.ts（主循环/状态/盟约调度）、MetaSave.ts（localStorage）、AudioSystem.ts、MathUtils.ts
  network/             # WsAdapter.ts、mpMarkers.ts（共享 marker 池）、mpHistory.ts（host 提议历史）
  screens/             # 13 个屏幕模块（见 §4）
  styles/main.css      # 全部 UI 样式（盟约徽记动画、聊天面板、toast、event modal 等）
  types/index.ts       # 全部共享类型（PactSource、StatusEffect、EnemyTraits、Snapshot 等）
  view/Renderer.ts     # 主画布渲染（盟约徽记、护盾条、敌人/干员、攻击动画）
server/index.js        # ws 中继：rooms/chat/ready/start/game/marker/event 转发
docs/                  # ROADMAP / PACT_DESIGN / MULTIPLAYER / V4_SUMMARY / ARCHITECTURE 等
```

## 3. 当前版本与近 8 提交

```
<待推送> V3.15.0 干员扩充 + GH Pages + UI 微整      ← HEAD
ccd3810   V3.14.0 事件卡扩充（+5，含 2 负面）
f86945d   V3.13.0 boon 扩充（7→10）
d1cfcfd   V3.12.0 共鸣全覆盖（7C2=21）
1e3806e   V3.11.0 盟约扩充（搭配 v3.10 新机制）
cce8a98   V3.10.0 敌人扩充（护盾 / 被击狂怒 / 碎尸召唤）
7f1a544   V4.3.8 提议防守点
c7fbd1a   V4.3.0 联机协作增强收束（含 v4.3.1~v4.3.7）
a3d9382   V4.0.0 联机骨架收束（含 v4.0.1/v4.1.0/v4.1.1/v4.2.0~v4.2.4）
```

## 远端 / 部署（v3.15.0 新增）

- 远端：`origin → https://github.com/falling-feather/Stronghold-Protocol.git`，本仓库 `main` 已强推覆盖（旧远端被全量替换）。
- GitHub Pages 工作流：`.github/workflows/deploy.yml`（push main 自动 build + 部署，使用 `actions/deploy-pages@v4`）。
- 部署后访问：`https://falling-feather.github.io/Stronghold-Protocol/`（首次 push 后需在仓库 Settings → Pages 把 Source 改成 "GitHub Actions"）。
- 联机 ws 地址：构建期注入 `VITE_MP_DEFAULT_URL`（在仓库 Settings → Secrets and variables → Actions → Variables 添加）。运行时优先级：`localStorage('sp.mp.url')` > 构建变量 > `ws://localhost:8787`。
- 注意：GitHub Pages 是静态托管，**不能托管 ws 中继**。`server/index.js` 必须自行部署到 Render/Fly.io/VPS 等，再把公网地址填入 `VITE_MP_DEFAULT_URL`（推荐 wss://）。

## 4. 屏幕（screen）流转

```
StartScreen
  ├─ FactionScreen → RosterScreen → PactScreen → BoonScreen → GameScreen
  ├─ MultiplayerScreen
  │     ├─ host: 准备 → start → 回 StartScreen 再单机起局，状态广播给 guest
  │     └─ guest: 准备 → start → MultiplayerGuestViewer（只读镜像）
  ├─ DailyScreen → 直接进 GameScreen（isDailyMode=true）
  ├─ MetaScreen（升级树）
  ├─ AchievementScreen
  └─ SettingsScreen（音量）
```

`shared.ts` 集中导出 mpAdapter / audio / 弹窗工具，所有 screen 复用。

## 5. 路线图状态（ROADMAP.md 的 §标题，详细见 docs/ROADMAP.md）

- ✅ v1.x 框架与数据扩展（全部）
- ✅ v2.x 战斗系统深化（全部）
- ✅ v3.x 盟约叠层（v3.0~v3.14 全部）
- ⏳ v4.x 联机
  - ✅ v4.0.0 ~ v4.3.8（骨架 + 帧广播 + 双向标记/聊天/提议）
  - ❌ 状态同步策略：增量帧 + 操作包
  - ❌ 双人共享地图、独立资源 / 独立队列
  - ❌ 断线重连 + 延迟补偿
- ❌ v5.x 内容扩充（职业 / 30+ 干员 / 20+ 敌人 / 章节制）

## 6. 关键约定与陷阱（必读）

### 6.1 提交规范

- 格式：`V{大}.{中}.{小} 中文说明`，三段位必备。
- 提交信息一律用 `create_file` 写到 `.git/MSG_VXXXX`，再 `git commit -F .git/MSG_VXXXX`。
  PowerShell 直接 `-m "中文"` 会乱码。
- 中版本递增时（如 v4.3 → v4.4）应做分支整理 + squash 收束（参见
  v4.0.0/v4.3.0 两个 squash commit 的做法：建 `backup/<name>` → `git reset --soft <base>` → `git commit -F`）。

### 6.2 终端显示乱码 ≠ 仓库乱码

- PowerShell 5.1 输出会把 UTF-8 中文 commit subject 显示成
  `V3.14.0 浜嬩欢鍗℃墿鍏...`。**仓库存的是正确的 UTF-8**，git log 在
  其他终端 / GitHub 上正确。不要试图"修复"。

### 6.3 文件编辑

- 不要用 `Get-Content` / `Set-Content` 处理含中文的 ts/md 文件，会被
  默认 ANSI(GBK) 破坏。一律走 `replace_string_in_file` /
  `multi_replace_string_in_file` / `create_file`。
- 单文件并行多处补丁容易在尾部留重复，优先 `multi_replace_string_in_file`
  统一发；改后立刻读末尾抽样核实。

### 6.4 必跑校验

- 每次实现完成 → `npx tsc --noEmit`（strict + noUnusedLocals + noUnusedParameters）。
- UI 改动 → `npm run dev`（端口 3000 占用时自动跳 3001）人工验证。
- 联机改动 → 同时起 `npm run mp-server`（8787），双开浏览器。

### 6.5 askQuestions 协议

- 用户偏好"全程问答驱动"。每个版本完成 → `vscode_askQuestions` 列出
  3~6 个候选下一步。schema 必须是 `{questions:[{header,question,options:[{label}]}]}`，
  顶层是数组会报 invalid。

## 7. 核心数据结构速记

### PactDefinition（src/config/gameData.ts → PACT_DB）

```ts
{
  id, name, desc, scope:'all_operators',
  sources: [{source: PactSource, perEvent: number}],
  cap: number,
  tiers: [{threshold, description, effects: StatusEffect[]}],
  penalty: StatusEffect[],   // 枷锁模式恒定附加（duration:-1）
  penaltyDesc: string,
}
```

- 当前 `PACT_DB` 共 7 条，`SELECTABLE_PACTS` 全部 7 个。
- `PactSource` 联合类型：`kill_any | kill_flying | kill_stealth | kill_elite |
  deploy_any | retreat_any | wave_clear | wave_perfect | kill_shielded |
  kill_in_enrage`。
- `RESONANCE_DB` 共 21 条 = C(7,2) 全覆盖；任何 3 选必触发 3 共鸣。

### StatusEffect 计算（GameEngine.modifyStat）

- 同 stat 先把所有 `flat` 累加到 base，再乘 `(1 + Σ pct)`。
- `aspd` 是攻击间隔系数：负 pct = 攻得快；`spd` 是移动速度系数：正 pct = 跑得快。

### EnemyTraits（v3.10 新增）

```ts
{ flying?, stealth?, summon?, bossPhase?,
  shield?: number,                        // 护盾在 hp 之前承伤
  enrageOnHit?: {aspdMod, spdMod, durationS} }  // 受击后 push 'enrage_on_hit' / 'enrage_on_hit_spd' effect
```

### Boon（src/config/boonData.ts，10 个）

- 起始资源类：boon_starting_money / _starting_money_big / _starting_sp / _starting_lives
- 盟约/事件/经济类：boon_pact_warmup / _event_chance / _shop_discount / _double_first_event
- v3.13 新增（GameEngine 内联判断）：
  - `boon_kill_bounty`（kill_any 分支 +1）
  - `boon_wave_bonus`（endCombat +15）
  - `boon_starting_money_big`（构造器 boonMoney 三元 +120）

### EventCard（src/config/events.ts）

- 13 张：8 张老 + 5 张 v3.14 新（含 2 张全代价负面：ev_storm_warning / ev_saboteur）。
- 字段：rarity / weight / minWave / maxWave / once / cooldown / options[{text,effects:{money,allOpsSp,pactStack}}]。
- `GameEngine.addAllOperatorsSp` 已对 SP/钱做 `Math.max(0, …)` clamp，允许负值代价。

### 联机事件总线（network/WsAdapter）

- `sendEvent(kind, text, level, extra=null)` — kind 一览：wave / phase / lives /
  fail / deploy_request / deploy_response / focus_request / focus_response /
  enemy_intel / intel_response / defend_request（v4.3.8）。
- `sendChat(text)` / `sendMarker(x,y,label)` / `sendGame(snapshot)`。
- guest 工具：`mpMarkers.pushLocalMarker(x,y,from,label)` 5s TTL；
  host 工具：`mpHistory.pushMpHostHistory({icon,from,text,ts})` 近 5 条。

## 8. 接手时建议的工作流

1. **理解现状**：读 `docs/ROADMAP.md` 全文 + 本快照 §6 §7。
2. **环境校验**：`npx tsc --noEmit` 确认 0 错；`npm run dev` 跑起来过一局。
3. **挑选下一项**：见 §9。
4. **做改动 → tsc → 跑 dev 验证**。
5. **更新 ROADMAP.md** 对应行（`[ ]` → `[x]` + 简介）。
6. **`create_file .git/MSG_VXXXX`** 写中文提交信息。
7. **`git add -A; git commit -F .git/MSG_VXXXX`**。
8. **`vscode_askQuestions`** 让用户挑下一步。

## 9. 下一步候选（优先级建议）

排序按"用户口味（穿插单机/联机）+ 改动规模"：

| 优先级 | 候选 | 规模 | 备注 |
|---|---|---|---|
| 高 | v4.4.0 状态同步增量帧 | 中 | 把 sendGame 全量快照换成 diff；先做 enemies/operators 两个集合的 add/update/remove 三段式 |
| 高 | v3.15.0 干员/职业扩充（向 v5.x 过渡） | 中 | 现有 5 职业骨架，可先加 3~5 个 6 星模板让"30+ 干员"有进度 |
| 中 | v4.4.0 host→guest 主动问询 | 小 | host 发"是否援助" 模板事件，guest 用 v4.3.6 actions 回复 |
| 中 | v3.15.0 boss 波 | 中 | 利用 EnemyTraits.bossPhase 做 1~2 个真正 boss + WAVES boss 关 |
| 中 | v3.15.0 干员主动技能扩展 | 中 | 现 v2.0 只支持持续型，扩瞬发型（伤害脉冲 / 召唤援军） |
| 低 | v4.4.0 共享地图独立资源 | 大 | 涉及双 GameEngine 同步 / 命令包；建议先做增量帧 |
| 低 | v4.4.0 断线重连 | 大 | 服务端要持久 lastSnapshot；客户端要 resync |

> 单机内容扩充和联机协议升级可以并行迭代，建议在 v4.4.x 与 v3.15.x
> 之间穿插，避免一段时间只动一个面。

## 10. 已知 backup 分支

- `backup/pre-v4-tidy-3` — v4.3.x squash 之前的 8 commit 链。
  squash 失误时可 `git reset --hard backup/pre-v4-tidy-3` 复原。

## 11. 文档地图

- `docs/ROADMAP.md` — 全量路线图（**真理之源**）。
- `docs/PACT_DESIGN.md` — 盟约/共鸣/枷锁的设计意图与 6 章理论。
- `docs/MULTIPLAYER.md` — 联机协议、event.kind 全表、UI 概览。
- `docs/V4_SUMMARY.md` — v4.0~v4.3.6 收束总结。
- `docs/ARCHITECTURE.md` — 架构总览（screen 拆分、core/network/view 职责）。
- `docs/MOBILE_OPTIMIZATION.md` / `PROJECT_REVIEW.md` — 历史专项笔记。

## 12. 常用命令

```powershell
# tsc 校验（必须 0 输出）
npx tsc --noEmit

# 单机 dev
npm run dev                    # http://localhost:3000/Stronghold-Protocol/

# 联机 dev（双开终端）
npm run mp-server              # ws://localhost:8787
npm run dev                    # 浏览器 A 创建房间，浏览器 B 加入

# 提交
git add -A
git commit -F .git/MSG_VXXXX   # 切勿用 -m "中文"

# 查看最近提交（终端中文显示乱码无所谓）
git log --oneline -10
```
