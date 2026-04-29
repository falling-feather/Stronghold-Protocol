# 联机模式使用说明（v4.0.0+）

> v4.0.0 仅实现「大厅 + 房间 + 准备 + 聊天」骨架；`start` 信号已能在双方就绪时下发，但战斗状态同步留待 v4.1+ 实装。

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
| `left` | — | 自身离开确认 |
| `error` | `msg` | 操作错误提示 |

## 5. 已知限制

- 服务端无持久化、无鉴权，仅本地或可信局域网调试。
- `host`/`guest` 角色仅作展示用途，未作流程区分。
- 重连/延迟补偿/状态同步均待 v4.1+ 实装。
- 无房间密码、无最大房间数限制。

## 6. 故障排查

| 现象 | 排查 |
|---|---|
| 浏览器报 `WebSocket 连接失败` | 确认 `npm run mp-server` 已运行；端口未被占用 |
| 创建房间后看不到自己 | 刷新页面重连；服务端重启会丢失所有房间 |
| 准备后无 `start` 提示 | 必须双方都进入同一房间且都点了准备 |
