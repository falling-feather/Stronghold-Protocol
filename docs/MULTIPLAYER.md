# 联机模式使用说明（v4.0.0+）

> v4.3.x 已扩展为「host 单人战斗 + guest 观战 + 双向标记/提议/聊天/反馈」的协作型联机。
> 状态同步为单向（host→guest 节流广播帧），guest 不影响战斗进程，仅通过事件向 host 提议/反馈。

## 1. 启动 WebSocket 服务

在仓库根目录另开一个终端：

```powershell
npm run mp-server
```

正常输出：

```
[Stronghold MP] WebSocket server listening on ws://localhost:8787
```

默认端口 8787，可通过环境变量覆盖：

```powershell
$env:PORT = "9000"; npm run mp-server
```

## 2. 启动客户端

另开终端启动 dev server：

```powershell
npm run dev
```

浏览器打开 Vite 给出的地址（通常 `http://localhost:5173`）。

## 3. 双人本地联调

1. 两个浏览器窗口（或同一窗口两个标签）分别打开同一地址。
2. 主菜单 → 「联机模式」。
3. 服务器地址保持 `ws://localhost:8787`，分别填入不同昵称，点「连接」。
4. 一方点「创建」生成房间；另一方在房间列表中点对应房间「加入」。
5. 双方都点「准备」后，聊天日志会出现 `★ 双方就绪 — 进入对局`。
   - **host**（先创建房间者）：聊天日志显示「主机模式」，需手动返回主菜单 →「开始游戏」走正常单机流程；战斗中游戏快照会自动广播给 guest。
   - **guest**（后加入者）：聊天日志显示「观战模式」，自动跳转到只读镜像视图，渲染 host 的游戏画面（节流 ~120ms / 帧）。
6. 房间内可实时收发聊天；任意一方点「离开」或关闭窗口会触发对端 `peer_left`。

## 4. 协议简表

JSON 文本帧。

### 客户端 → 服务端

| type | 字段 | 说明 |
|---|---|---|
| `set_name` | `name` | 设置昵称（≤20 字符） |
| `create_room` | `name` | 新建房间，自动加入 |
| `join_room` | `roomId` | 加入指定房间（满 2 人拒绝） |
| `leave_room` | — | 离开当前房间 |
| `ready` | `ready` | 切换准备状态 |
| `chat` | `text` | 房间内广播文本（≤200 字符） |
| `game` | `payload` | host→guest 游戏快照帧（120ms 节流，v4.1.0） |
| `marker` | `x, y, label` | guest→host 画布标记点（v4.2.0） |
| `event` | `kind, text, level, extra` | 双向事件（host→guest 通知 / guest→host 提议，v4.1.0+） |

### 服务端 → 客户端

| type | 字段 | 说明 |
|---|---|---|
| `welcome` | `id` | 分配客户端 id |
| `self` | `name` | 昵称回显 |
| `rooms` | `list[]` | 全局房间列表（每次变更广播） |
| `joined` | `roomId, name, you` | 进入某房间 |
| `peer_joined` | `name` | 房间内出现新对端 |
| `peer_left` | `name` | 对端离开 |
| `peer_ready` | `name, ready` | 对端切换准备状态 |
| `start` | — | 房间满员且双方就绪 |
| `chat` | `from, text` | 房间内聊天 |
| `game` | `from, payload` | 游戏帧广播（host→guest，v4.1.0） |
| `marker` | `from, x, y, label` | 标记点广播（guest→host，v4.2.0） |
| `event` | `from, kind, text, level, extra` | 事件广播（v4.1.0+，详见下表） |
| `left` | — | 自身离开确认 |
| `error` | `msg` | 操作错误提示 |

### `event.kind` 一览

| kind | 方向 | 说明 |
|---|---|---|
| `wave` | host→guest | 波次开始；`extra` 含下一波预告 `{count, enemyName, label, isBoss, isFlying, isStealth, nextWaveNo}` (v4.3.3) |
| `phase` | host→guest | 阶段切换（COMBAT→PREP，level=success） |
| `lives` | host→guest | 生命≤3 下降警示（level=danger） |
| `end` | host→guest | 失败终结（level=danger） |
| `deploy_request` | guest→host | guest 在格子上提议部署，host 弹横幅接受/拒绝 (v4.2.3) |
| `deploy_response` | host→guest | host 对 deploy_request 的回应 toast |
| `focus_request` | guest→host | guest 提议关注最近干员；`extra.operatorId`；host 弹横幅查看/忽略，查看 → selectItem('map', id) (v4.3.0) |
| `focus_response` | host→guest | host 对 focus_request 的回应 toast |
| `enemy_intel` | guest→host | guest 标记最近敌人；`extra.enemyId/x/y`；host 在敌人位置叠加 ⚠敌情 marker + 顶部短横幅 (v4.3.2) |
| `intel_response` | guest→host | guest 对 wave 预告的快反馈；`extra.ack=ready/help`；host 顶部短横幅 + history (v4.3.6) |
| `defend_request` | guest→host | guest 提议防守点；`extra.x/y/gx/gy`；host 在该点叠加 🛡防守 marker + 顶部短横幅 (v4.3.8) |

## 5. 已知限制

- 服务端无持久化、无鉴权，仅本地或可信局域网调试。
- guest 仅能观战 + 提议 + 标记 + 聊天，不能直接干预 host 战斗（所有 *_request 需 host 手动确认）。
- 重连/延迟补偿/状态同步增量化均待 v4.4+ 实装；当前 host→guest 为全量快照 120ms 节流。
- 无房间密码、无最大房间数限制。

## 6. v4.3.x 协作 UI 概览

**host（主画面）**
- 右下 fixed `#mp-host-chat`：可折叠聊天面板（标题栏 ▾/▸，140px 日志 + 输入 + 5 个快捷预设按钮 [好/不好/等一下/GG/GL]）
- 右上 top:130px `#mp-host-history`：📜 提议历史 (近 5)，记录 marker 📍 / deploy_request 🎯 / focus_request ⭐ / enemy_intel ⚠ / defend_request 🛡 / intel_response ✅🆘；focus 行可点击跳转干员
- 顶部 top:36px：deploy_request / focus_request 横幅（接受/拒绝/查看/忽略）+ enemy_intel/defend_request/intel_response 短横幅（3s）

**guest（观战面板）**
- 中央 Canvas 640×512：渲染 host 推送的快照 + marker 圆环
- 4 个 toggle 按钮（互斥）：🎯 提议部署 / ⭐ 提议关注 / ⚠ 标记敌人 / 🤝 默认 marker
- 6 个 emoji 快捷标记按钮（⚠/🛡/💰/👹/🏃/🤝）：发预设 marker
- 底部 100px 聊天框 + 5 快捷预设
- 右上 toast 列表：host 事件通知；wave 预告附「✅ 可以」「🆘 需援」按钮（8s）

## 6. 故障排查

| 现象 | 排查 |
|---|---|
| 浏览器报 `WebSocket 连接失败` | 确认 `npm run mp-server` 已运行；端口未被占用 |
| 创建房间后看不到自己 | 刷新页面重连；服务端重启会丢失所有房间 |
| 准备后无 `start` 提示 | 必须双方都进入同一房间且都点了准备 |
