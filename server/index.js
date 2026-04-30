// v4.0.0：联机骨架服务端（Node.js + ws）
// v3.16.0：附加 HTTP 健康检查 + 挂载到同一端口（兼容 Render/Fly/Railway 等 PaaS）
// 启动：npm run mp-server  （默认监听 ws://localhost:8787）
// 协议：JSON 文本帧
//   c→s: { type: 'set_name'|'create_room'|'join_room'|'leave_room'|'ready'|'chat', ... }
//   s→c: { type: 'welcome'|'self'|'rooms'|'joined'|'peer_joined'|'peer_left'|'peer_ready'|'start'|'chat'|'error', ... }

import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '0.0.0.0';

// HTTP 服务器：根路径 + /healthz 都返回 200，便于 PaaS 健康检查
const httpServer = createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Stronghold Protocol MP server: OK\n');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found\n');
});

const wss = new WebSocketServer({ server: httpServer });

const rooms = new Map(); // roomId -> { id, name, players: Set<ws> }
const clients = new WeakMap(); // ws -> { id, name, roomId, ready }

let nextRoomId = 1;
let nextClientId = 1;

function send(ws, msg) {
  try { ws.send(JSON.stringify(msg)); } catch {}
}

function broadcast(roomId, msg, exclude = null) {
  const r = rooms.get(roomId);
  if (!r) return;
  for (const p of r.players) {
    if (p !== exclude) send(p, msg);
  }
}

function listRooms() {
  const arr = [];
  for (const r of rooms.values()) {
    arr.push({
      id: r.id,
      name: r.name,
      count: r.players.size,
      readyCount: [...r.players].filter(p => clients.get(p)?.ready).length,
    });
  }
  return arr;
}

function broadcastRoomList() {
  const list = listRooms();
  for (const ws of wss.clients) send(ws, { type: 'rooms', list });
}

function leaveRoom(ws) {
  const c = clients.get(ws);
  if (!c || !c.roomId) return;
  const r = rooms.get(c.roomId);
  if (r) {
    r.players.delete(ws);
    if (r.players.size === 0) rooms.delete(r.id);
    else broadcast(r.id, { type: 'peer_left', name: c.name });
  }
  c.roomId = null;
  c.ready = false;
  broadcastRoomList();
}

wss.on('connection', (ws) => {
  const cid = `c${nextClientId++}`;
  clients.set(ws, { id: cid, name: `玩家${cid}`, roomId: null, ready: false });
  send(ws, { type: 'welcome', id: cid });
  send(ws, { type: 'rooms', list: listRooms() });

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    const c = clients.get(ws);
    if (!c) return;

    switch (m.type) {
      case 'set_name': {
        c.name = String(m.name || c.name).slice(0, 20);
        send(ws, { type: 'self', name: c.name });
        break;
      }
      case 'create_room': {
        if (c.roomId) leaveRoom(ws);
        const id = `r${nextRoomId++}`;
        const r = { id, name: String(m.name || `${c.name} 的房间`).slice(0, 30), players: new Set([ws]) };
        rooms.set(id, r);
        c.roomId = id;
        c.ready = false;
        send(ws, { type: 'joined', roomId: id, name: r.name, you: c.name, role: 'host' });
        broadcastRoomList();
        break;
      }
      case 'join_room': {
        const r = rooms.get(m.roomId);
        if (!r) { send(ws, { type: 'error', msg: '房间不存在' }); break; }
        if (r.players.size >= 2) { send(ws, { type: 'error', msg: '房间已满' }); break; }
        if (c.roomId) leaveRoom(ws);
        // 让加入者先看见已在房间内的对端
        for (const other of r.players) {
          const oc = clients.get(other);
          if (oc) send(ws, { type: 'peer_joined', name: oc.name });
        }
        r.players.add(ws);
        c.roomId = r.id;
        c.ready = false;
        send(ws, { type: 'joined', roomId: r.id, name: r.name, you: c.name, role: 'guest' });
        broadcast(r.id, { type: 'peer_joined', name: c.name }, ws);
        broadcastRoomList();
        break;
      }
      case 'leave_room':
        leaveRoom(ws);
        send(ws, { type: 'left' });
        break;
      case 'ready': {
        c.ready = !!m.ready;
        if (c.roomId) {
          broadcast(c.roomId, { type: 'peer_ready', name: c.name, ready: c.ready });
          const r = rooms.get(c.roomId);
          if (r && r.players.size === 2 && [...r.players].every(p => clients.get(p)?.ready)) {
            broadcast(c.roomId, { type: 'start' });
          }
        }
        break;
      }
      case 'chat': {
        if (c.roomId) broadcast(c.roomId, { type: 'chat', from: c.name, text: String(m.text || '').slice(0, 200) });
        break;
      }
      case 'game': {
        // v4.1.0：通用游戏帧转发（host→guest），不入服务端逻辑
        if (c.roomId) broadcast(c.roomId, { type: 'game', from: c.name, payload: m.payload }, ws);
        break;
      }
      case 'marker': {
        // v4.2.0：guest→host 反向标记点
        if (c.roomId) broadcast(c.roomId, { type: 'marker', from: c.name, x: m.x, y: m.y, label: m.label || '' }, ws);
        break;
      }
      case 'event': {
        // v4.1.0：host→guest 事件 toast 推送（kind/text/level）
        // v4.1.0(后提)：附加 extra 字段依附任意负载（转发使用者约定结构）
        if (c.roomId) broadcast(c.roomId, { type: 'event', from: c.name, kind: String(m.kind || ''), text: String(m.text || '').slice(0, 200), level: String(m.level || 'info'), extra: (m.extra ?? null) }, ws);
        break;
      }
    }
  });

  ws.on('close', () => leaveRoom(ws));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[Stronghold MP] HTTP/WebSocket server listening on http://${HOST}:${PORT} (ws path: /)`);
});
