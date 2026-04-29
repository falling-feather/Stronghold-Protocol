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
npm run dev      # 开发模式，打开 http://localhost:3000
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
│   ├── styles/main.css       # 主样式
│   ├── types/index.ts        # TypeScript 类型定义
│   ├── view/Renderer.ts      # Canvas 渲染器
│   └── main.ts               # 入口文件 & UI 逻辑
├── docs/                     # 开发文档（计划、审查、移动端优化）
├── index.html                # HTML 模板
├── package.json
├── tsconfig.json
├── vite.config.ts
└── run.bat                   # Windows 一键运行脚本
```

## 已实现功能

- **塔防核心**：地图系统（6张随机地图）、角色部署（地面/高台）、朝向系统、战斗与阻挡
- **经济系统**：商店刷新、核心升级、角色池限制（每角色最多7次）
- **角色进阶**：1阶/2阶等阶系统，3合1自动合并，合并触发临时商店
- **技力系统**：自然/攻击/受击三种回复方式，技力条显示
- **交互体验**：拖拽部署与出售、详情面板、备战区管理
- **移动端适配**：自动横屏布局、Canvas 响应式缩放

## 待实现功能

| 优先级 | 功能 | 说明 |
|--------|------|------|
| 高 | 盟约叠层机制 | 核心特色，叠层增益效果系统 |
| 高 | 角色选择系统 | 游戏开始时的定向甄选 |
| 高 | 技能激活系统 | 当前仅有技力积累，技能释放未实现 |
| 中 | 联机玩法 | WebSocket 房间系统、状态同步 |
| 中 | 内容扩展 | 更多角色、敌人、地图 |
| 低 | 音效与存档 | 音效、背景音乐、存档系统 |

> 详细开发计划见 [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md)，代码审查见 [docs/PROJECT_REVIEW.md](docs/PROJECT_REVIEW.md)

## 游戏玩法速览

1. **准备阶段**：在商店购买角色，从备战区拖拽部署到地图格子上
2. **战斗阶段**：角色自动攻击敌人，地面角色可阻挡，每波 60-90 秒时限
3. **角色进阶**：3个同名一阶角色自动合并为二阶，触发免费临时商店
4. **目标**：保护基地生命值不被归零

## 许可证

本项目仅供学习和参考使用。灵感来源于《明日方舟》的「卫戍协议」模式。

