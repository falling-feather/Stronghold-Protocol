# v4.x 联机模式阶段总结

> 收束所有 v4.0 ~ v4.3.6 已落地内容；下一阶段（v4.4+）方向参考末尾。

---

## 1. 设计目标

将单人塔防扩展为「**1 host 单人战斗 + 1 guest 协作观战**」的轻量联机模式。
guest 不直接操作战斗，而是通过 marker / 提议 / 反馈 / 聊天 与 host 协作。
host 保留完整单机流程，仅在联机时启用「广播 + 监听 + UI 增强」。

## 2. 全量功能清单

### v4.0.x — 联机骨架
- v4.0.0 WebSocket 服务端（`server/index.js`，端口 8787）；大厅/房间/准备/聊天
- v4.0.1 联机 UI 入口（StartScreen → 联机模式）

### v4.1.x — 状态同步
- v4.1.0 host→guest 游戏帧广播（`getStateSnapshot()` + 120ms 节流）；guest 镜像 Canvas 渲染
- v4.1.1 host 顶部「主机模式」横幅 + guest 自动跳转观战视图

### v4.2.x — 双向交互
- v4.2.0 guest→host 标记点 (`marker`)；TTL 5s 圆环 + 标签
- v4.2.1 6 个预设 emoji 快捷标记按钮
- v4.2.2 guest 鼠标位置追踪 + 默认 marker
- v4.2.3 guest 部署提议 (`deploy_request`) + host 横幅接受/拒绝
- v4.2.4 联机音效反馈（`event/click/wave_clear` SfxId 联动）

### v4.3.x — 协作增强
- v4.3.0 提议关注干员 (`focus_request` + `extra.operatorId`)；host 查看 → `selectItem('map', id)`
- v4.3.1 游戏内实时聊天（host 右下可折叠面板 + guest 底部聊天框）
- v4.3.2 guest 提议标记敌人 (`enemy_intel` + `extra.enemyId/x/y`)；host 在敌人位置叠加 ⚠敌情 marker + 顶部短横幅
- v4.3.3 波次预告增强（host 在 wave 事件附 `extra.{count, enemyName, label, isBoss, isFlying, isStealth}`，guest 强敌时 toast 升 danger）
- v4.3.4 聊天面板快捷预设（5 个：好/不好/等一下/GG/GL）
- v4.3.5 host 提议历史面板（右上 top:130px，📜 近 5 条 marker/提议/反馈，相对时间，5s 刷新）
- v4.3.6 预告后 guest 快反馈（toast 附「✅ 可以」「🆘 需援」按钮 → `intel_response`）

## 3. 协议总览

文本 JSON 帧。完整字段见 [docs/MULTIPLAYER.md](MULTIPLAYER.md)。

| 类型 | 方向 | 用途 |
|---|---|---|
| `set_name` / `create_room` / `join_room` / `leave_room` / `ready` | c→s | 大厅/房间管理 |
| `chat` | 双向 | 200 字符限文本聊天（含 5 快捷预设） |
| `game` | host→guest | 全量快照 120ms 节流 |
| `marker` | guest→host | 画布标记点 + label |
| `event` | 双向 | 通用事件总线（含 10+ kind，见 MULTIPLAYER.md） |

## 4. 关键文件

| 文件 | 作用 |
|---|---|
| `server/index.js` | WebSocket 服务端，转发所有协议 |
| `src/network/WsAdapter.ts` | 客户端 WS 封装；`sendChat/sendGame/sendMarker/sendEvent` |
| `src/network/mpBridge.ts` | mpAdapter 单例 + `isMpHost/isMpGuest` |
| `src/network/mpMarkers.ts` | 标记点池 (TTL 5s) + 渲染 |
| `src/screens/MultiplayerGuestViewer.ts` | guest 观战面板（toggle 按钮 / toast / 聊天） |
| `src/screens/GameScreen.ts` | host 联机增强（chat 面板 / history 面板 / 提议横幅 / 事件广播） |

## 5. 设计决策

### 5.1 单向状态同步
- host 全量快照 + 120ms 节流（约 8 fps），不做增量化
- 优点：实现简单、guest 任意时刻加入即同步
- 缺点：带宽随干员/敌人数线性增长；适合 LAN 不适合公网
- v4.4+ 计划：增量帧 + 操作包

### 5.2 guest 提议而非操作
- guest 所有 `*_request` 都需 host 手动接受 → 避免双方意图冲突
- host 横幅 10s 自动关闭；接受/拒绝均回送 `*_response` toast
- 简化了多端冲突解决问题，guest 体验更像「军师/观战指挥」

### 5.3 事件总线统一
- 单一 `event` 类型 + `kind` 区分子类，避免协议爆炸
- `extra: any` 字段允许子类自定义负载（operatorId / enemyId / x,y / nextWavePreview / ack）
- 服务端只做透传，不解析 kind

### 5.4 UI 复用与隔离
- host 联机 UI 全部 fixed 定位 + 一次性 install 标志位 (`mpHostChatInstalled` / `mpHostHistoryInstalled`)
- 离开联机不卸载 DOM（隐藏即可）；下次联机复用
- 与单机 UI 完全隔离，不影响单机流程

## 6. 未完成 / 已知限制

- 增量状态同步（v4.4+）
- 双人共享地图、独立资源/独立队列
- 断线重连 + 延迟补偿
- 房间密码 + 鉴权
- 公网部署（HTTPS/WSS）
- 移动端 guest 触控适配未验证

## 7. 下一阶段方向

| 候选 | 说明 |
|---|---|
| v4.3.7 host history 快回复 | history 行加「意了/不行」按钮 → ack_response → guest toast |
| v4.3.7 提议防守点 | guest `defend_request` → host 在该点叠加 🛡 marker + history |
| v4.3.x squash | 将 v4.3.0~v4.3.6 合并为 v4.3.0 收束历史 |
| v4.4.0 增量同步 | host 改为发 diff，guest 维护本地状态 |
| v3.10.0 单人内容 | 暂离联机，回到 boon/盟约/敌人扩展 |
