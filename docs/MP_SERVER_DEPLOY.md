# 联机中继服务 部署指南（v3.16.0）

> 卫戍协议的联机依赖一个 WebSocket 中继服务（`server/index.js`）。
> GitHub Pages 只能托管静态前端，**无法运行 ws**，因此中继必须部署到
> 任何能跑 Node 的 PaaS / VPS，再把公网地址回填到前端构建变量。

---

## 一键部署：Render（推荐，免费额度够用）

1. Fork 或保持本仓库挂在你自己的 GitHub 账号下
2. 登录 <https://render.com> → 顶部 **New +** → **Blueprint**
3. 选择本仓库（首次需授权 Render 访问 GitHub）
4. Render 自动读取根目录的 [`render.yaml`](../render.yaml) 与 [`Dockerfile`](../Dockerfile)，
   显示一个名为 `stronghold-mp` 的 Web Service
5. 点 **Apply** → 等待 3~5 分钟构建完成
6. 部署成功后，在服务详情页顶部能看到 URL，例如：
   `https://stronghold-mp.onrender.com`
7. 把它改成 ws 协议（**推荐 `wss://`**，HTTPS 强制要求）：
   `wss://stronghold-mp.onrender.com/`
   把这个最终 URL 填到下一节的 GitHub Variables

> Render 免费实例 15 分钟无访问会休眠，第一次连接会有 ~30s 冷启动；要长开
> 推荐升级 Starter（$7/月）或换下面的 Fly.io / VPS 方案。

---

## 备选：Fly.io（也免费）

1. 安装 flyctl：<https://fly.io/docs/flyctl/install/>
2. 在仓库根执行：
   ```bash
   fly launch --no-deploy --copy-config --name stronghold-mp
   # 选择最近的区域，提示 detected Dockerfile 时选 Yes
   fly deploy
   ```
3. 部署成功后访问 `https://stronghold-mp.fly.dev/healthz` 应返回
   `Stronghold Protocol MP server: OK`
4. 联机 URL：`wss://stronghold-mp.fly.dev/`

---

## 备选：自己的 VPS（systemd）

```bash
# 在 VPS 上
git clone https://github.com/falling-feather/Stronghold-Protocol.git
cd Stronghold-Protocol
npm install --omit=dev
PORT=8787 HOST=0.0.0.0 node server/index.js
# 推荐用 nginx 反代 + Let's Encrypt 出 wss://your.domain/
```

最小 nginx 反代片段（已有 TLS 的前提下）：

```nginx
location /mp {
    proxy_pass http://127.0.0.1:8787/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 600s;
}
```

联机 URL：`wss://your.domain/mp`

---

## 把 ws 地址告诉前端

部署得到 `wss://...` 之后，有 **三种方式** 让前端用上它：

### 方式 1：构建时注入（GitHub Pages 部署唯一推荐）

1. 仓库 **Settings → Secrets and variables → Actions → Variables → New repository variable**
2. Name: `VITE_MP_DEFAULT_URL`，Value: `wss://stronghold-mp.onrender.com/`
3. 触发 **Actions → Deploy to GitHub Pages → Run workflow**（或 push 任意 commit）
4. 重新部署后，所有访问 `https://falling-feather.github.io/Stronghold-Protocol/`
   的玩家默认就连这个地址

### 方式 2：玩家自己改地址（开发/测试）

打开浏览器控制台执行：

```js
localStorage.setItem('sp.mp.url', 'wss://your-server/');
location.reload();
```

`localStorage` 的优先级 > 构建变量 > 本地回退（见 `src/network/mpConfig.ts`）。

### 方式 3：本机联机（默认）

- 启动 `npm run mp-server`（端口 8787）
- 访问 `http://localhost:3000/Stronghold-Protocol/` 即可，前端自动连
  `ws://localhost:8787`

---

## 健康检查

部署完毕请用浏览器访问：

```
https://你的域名/healthz
```

应该立即看到：

```
Stronghold Protocol MP server: OK
```

若 404 或连接失败：
- Render：查 Logs 是否有 `[Stronghold MP] HTTP/WebSocket server listening on ...`
- Fly：`fly logs`
- VPS：`journalctl -u stronghold-mp -f`（如果做了 systemd unit）

---

## 安全须知

当前中继 **完全无身份验证**，任何人拿到 ws 地址都能开房间发消息。
因为本游戏不涉及账号体系，且服务端不持久化任何数据（房间在最后一名玩家离开后立刻销毁），
风险等级低；但请勿用于生产或真实社交场景。后续 v4.x 可考虑：

- 房间号改 6 位字符 + 服务端速率限流
- 同 IP 同时持有 ws 数量上限
- 简单令牌（房主分享带 `?t=xxx` 的邀请链接）
