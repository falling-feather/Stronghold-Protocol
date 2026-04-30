# 卫戍协议 联机中继 — 多平台镜像
# 体积小、纯运行时（仅安装 ws 一个生产依赖）

FROM node:20-alpine

WORKDIR /app

# 仅拷贝 server 与最小化的 package 信息（避免把整个前端塞进镜像）
COPY server/ ./server/
COPY package.json ./package.json

# 只装生产依赖（ws）
RUN npm install --omit=dev --no-audit --no-fund

# Render / Fly / Railway 都会注入 PORT 环境变量；本镜像只声明默认值
ENV PORT=8787
ENV HOST=0.0.0.0

EXPOSE 8787

# 健康检查（PaaS 一般不用此项，但本地 docker run 时方便）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 || exit 1

CMD ["node", "server/index.js"]
