# 卫戍协议模拟器

基于明日方舟「卫戍协议：盟约」的塔防策略游戏网页版。

## 快速开始

### 一键运行（Windows）

```bash
run.bat
```

### 手动运行

```bash
npm install      # 安装依赖（首次运行）
npm run dev      # 开发模式，打开终端显示的地址（默认端口 3000）
npm test         # 运行核心逻辑与联机协议测试
npm run build    # 构建生产版本
npm run preview  # 预览构建结果
npm run deploy   # 部署到 GitHub Pages
```

## 技术栈

| 技术 | 用途 |
|------|------|
| TypeScript | 类型安全的核心逻辑 |
| Vite | 构建与开发服务器 |
| Canvas API | 2D 游戏地图渲染 |
| 原生 HTML/CSS | UI 界面 |

## 项目结构

```
StrongholdProtocol/
├── src/
│   ├── config/gameData.ts    # 角色、敌人、地图、波次配置
│   ├── core/
│   │   ├── GameEngine.ts     # 游戏引擎主类
│   │   └── MathUtils.ts      # 数学工具（碰撞检测、范围计算）
│   ├── styles/               # 通用布局与协议主题
│   ├── types/index.ts        # TypeScript 类型定义
│   ├── view/Renderer.ts      # Canvas 渲染器
│   └── main.ts               # 入口
├── server/                   # 联机房间、共享池与回合协调
├── shared/                   # 前后端共用规则
├── tests/                    # 回归测试
├── docs/                     # 路线图与设计文档
├── index.html                # HTML 模板
├── package.json
├── tsconfig.json
├── vite.config.ts
└── run.bat                   # Windows 一键运行脚本
```

## 已实现功能

- **塔防核心**：地图系统（6张随机地图）、角色部署（地面/高台）、朝向系统、战斗与阻挡
- **经济系统**：商店刷新、核心升级、有限干员池；出售后返还名额
- **角色进阶**：干员分为协议阶级和星级；3 名同名初始干员自动合并为精锐，并触发临时商店
- **装备整备**：5 级调度中心提供三种基础装备，可配发、合并进阶，在出售或合并干员时回收
- **技力系统**：自然/攻击/受击回复，支持部分持续强化、下一击、多段、范围和多目标效果；战斗中按目标或受击条件自动释放技能
- **交互体验**：拖拽部署与出售、详情面板、备战区管理；单人可暂停和切换倍速，联合模拟固定 2 倍速
- **移动端适配**：自动横屏布局、Canvas 响应式缩放
- **联合模拟（开发中）**：1–4 人各自经营战场、共享干员池；最多两人同场联防，最后分组共同攻击共享生命的领袖。支持淘汰后观战、查看队友战场、聊天和标记。当前规则及限制见 [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md)。
- **原版资料**：三名预备干员的初始与精锐属性、部分敌人与装备数据参考 PRTS，来源与实现差异见 [docs/PRTS_DATA.md](docs/PRTS_DATA.md)。

## 联机模式快速启动

可用 1–4 个浏览器窗口（同一台机或局域网）。

```powershell
# 终端 1：启动 WebSocket 服务（端口 8787）
npm run mp-server

# 终端 2：启动开发服务器
npm run dev
```

各窗口打开 Vite 显示的地址（默认 `http://localhost:3000/Stronghold-Protocol/`）→ 联机模式 → 连接服务器 → 创建或加入房间 → 所有人准备 → 房主开始模拟 → 各自点击「开始游戏」。休整期分别经营，存活玩家准备后共同开始本回合。

### 公网部署联机（GitHub Pages 等静态站）

GitHub Pages 仅托管前端，**WebSocket 中继需要单独部署**到任何 Node 平台。仓库已附一键部署模板：

- [`Dockerfile`](Dockerfile) — 任何 Docker 平台通用
- [`render.yaml`](render.yaml) — Render Blueprint 一键部署
- 完整指南：[docs/MP_SERVER_DEPLOY.md](docs/MP_SERVER_DEPLOY.md)（含 Render / Fly.io / VPS 三套）

部署完成后，把 `wss://` 地址填到仓库 **Settings → Variables → `VITE_MP_DEFAULT_URL`** 即可。


## 待实现功能

| 优先级 | 功能 | 说明 |
|--------|------|------|
| 高 | 联合模拟 | 断线重连、原版回合编成与更完整的组合战场规则 |
| 高 | 战斗与技能 | 特殊干员的自动技能策略、尚未覆盖的技能效果与完整战斗规则 |
| 高 | 盟约和内容 | 干员对应盟约与特质、更多装备、策略、敌人、领袖技能和难度层次 |
| 中 | 关卡与表现 | 章节、地图机关、界面和移动端体验 |

> 当前方向与阶段见 [docs/ROADMAP.md](docs/ROADMAP.md)；早期开发计划和审查报告保留为历史资料。

## 游戏玩法速览

1. **准备阶段**：在商店购买角色，从备战区拖拽部署到地图格子上，再向目标朝向拖动并松开；也可点击相邻格确认朝向
2. **战斗阶段**：角色自动攻击敌人，地面角色可阻挡，每波 60-90 秒时限
3. **角色进阶**：3 个同名初始干员自动合并为精锐，触发免费临时商店
4. **最终攻势**：完成现有 14 波后挑战共享生命的领袖，保住目标生命并击败领袖

## 许可证

本项目仅供学习和参考使用。灵感来源于《明日方舟》的「卫戍协议」模式。
