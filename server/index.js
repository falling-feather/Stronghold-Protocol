// v4.0.0：联机骨架服务端（Node.js + ws）
// v3.16.0：附加 HTTP 健康检查 + 挂载到同一端口（兼容 Render/Fly/Railway 等 PaaS）
// 启动：npm run mp-server  （默认监听 ws://localhost:8787）
// 协议：JSON 文本帧
//   c→s: { type: 'set_name'|'create_room'|'join_room'|'leave_room'|'ready'|'chat', ... }
//   s→c: { type: 'welcome'|'self'|'rooms'|'joined'|'peer_joined'|'peer_left'|'peer_ready'|'start'|'chat'|'error', ... }

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'node:fs';
import { createFinalState, advanceFinalTime, applyFinalDamage, applyFinalLeak } from './assault.js';

const { operatorPoolByTier, alliancePoolMultiplier, maxPlayers } = JSON.parse(readFileSync(new URL('../shared/gameRules.json', import.meta.url), 'utf8'));
const operatorTiers = JSON.parse(readFileSync(new URL('../shared/operatorTiers.json', import.meta.url), 'utf8'));

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

function relay(roomId, msg, sender, toId) {
  if (!toId) { broadcast(roomId, msg, sender); return; }
  const room = rooms.get(roomId);
  if (!room) return;
  for (const peer of room.players) {
    if (peer !== sender && clients.get(peer)?.id === toId) { send(peer, msg); return; }
  }
}

function listRooms() {
  const arr = [];
  for (const r of rooms.values()) {
    arr.push({
      id: r.id,
      name: r.name,
      count: r.players.size,
      capacity: maxPlayers,
      started: !!r.match,
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
    if (r.match?.active.has(c.id)) {
      for (const peer of r.players) {
        const player = clients.get(peer);
        if (player) { player.roomId = null; player.ready = false; }
        send(peer, { type: 'match_ended', reason: 'peer_left', name: c.name });
      }
      rooms.delete(r.id);
    } else if (r.players.size === 0) rooms.delete(r.id);
    else {
      broadcast(r.id, { type: 'peer_left', id: c.id, name: c.name });
      if (r.hostId === c.id) {
        const nextHost = [...r.players].find(peer => r.match?.active.has(clients.get(peer)?.id)) ?? r.players.values().next().value;
        r.hostId = clients.get(nextHost).id;
        broadcast(r.id, { type: 'host_changed', id: r.hostId });
      }
    }
  }
  c.roomId = null;
  c.ready = false;
  broadcastRoomList();
}

function broadcastPool(room) {
  room.match.poolVersion++;
  broadcast(room.id, { type: 'pool_state', version: room.match.poolVersion, counts: Object.fromEntries(room.match.pool) });
}

function broadcastRound(room) {
  const match = room.match;
  broadcast(room.id, { type: 'round_status', round: match.round,
    readyIds: [...match.ready], finishedIds: [...match.finished] });
}

function readFormation(input) {
  const formation = input || {};
  const operators = formation.operators ?? [];
  if (!Array.isArray(operators) || operators.length > 100 || operators.some(op =>
    typeof op?.id !== 'string' || typeof op.templateId !== 'string' || !operatorTiers[op.templateId] ||
    !op.gridPos || !op.pos || !op.stats || !op.skill || !Array.isArray(op.effects) || !Array.isArray(op.blockingEnemyIds))) return null;
  const activePacts = Number.isInteger(formation.activePacts) ? Math.max(0, Math.min(100, formation.activePacts)) : 0;
  return { operators, deployed: operators.length, activePacts,
    alive: operators.filter(op => !op.isRetreated && !op.markedForDeletion).length };
}

function finishAssault(room) {
  const match = room.match;
  if (match.phase !== 'ASSAULT' || !match.assault.state.result) return;
  match.phase = 'COMPLETE';
  broadcast(room.id, { type: 'match_complete', reason: match.assault.state.result });
}

function settleRound(room, survivors) {
  const match = room.match;
  const losses = {};
  for (const enemy of survivors) losses[enemy.ownerId] = Math.min(10, (losses[enemy.ownerId] || 0) + 1);
  const eliminatedIds = [...match.active].filter(id => match.outcomes.get(id).lives <= (losses[id] || 0));
  let poolChanged = false;
  for (const id of eliminatedIds) {
    match.active.delete(id);
    for (const [operatorId, count] of match.owned.get(id) || []) {
      if (count > 0) {
        match.pool.set(operatorId, match.pool.get(operatorId) - count);
        poolChanged = true;
      }
    }
    match.owned.delete(id);
    match.offers.delete(id);
  }
  if (poolChanged) broadcastPool(room);
  broadcast(room.id, { type: 'round_settle', round: match.round, losses, eliminatedIds, activeIds: [...match.active] });
  if (match.active.size === 0) {
    match.phase = 'COMPLETE';
    broadcast(room.id, { type: 'match_complete', reason: 'all_eliminated' });
  } else {
    const finalRound = [...match.active].every(id => match.completed.has(id));
    let finalInfo = {};
    if (finalRound) {
      const teamLives = [...match.active].reduce((sum, id) => sum + match.outcomes.get(id).lives - (losses[id] || 0), 0);
      const order = [...match.active];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const groups = [];
      for (let i = 0; i < order.length; i += 2) groups.push(order.slice(i, i + 2));
      match.assault = { groups, teamLives, formations: new Map(), sequence: new Map(), state: null };
      const preview = createFinalState(match.active.size, teamLives, 0);
      finalInfo = { stage: 'FINAL', groups, teamLives, bossMaxHp: preview.bossMaxHp };
    }
    match.phase = 'PREP';
    match.round++;
    match.finished.clear();
    match.completed.clear();
    match.outcomes.clear();
    match.defense = null;
    broadcast(room.id, { type: 'round_prep', round: match.round, ...finalInfo });
  }
}

function startDefense(room) {
  const match = room.match;
  const defense = match.defense;
  broadcast(room.id, { type: 'defense_start', round: match.round, helperId: defense.helpers[0],
    helpers: defense.helpers.map(playerId => ({ playerId, operators: match.outcomes.get(playerId).formation.operators })),
    enemies: defense.enemies });
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
        const r = { id, name: String(m.name || `${c.name} 的房间`).slice(0, 30), players: new Set([ws]), hostId: c.id, match: null };
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
        if (r.match) { send(ws, { type: 'error', msg: '对局已经开始' }); break; }
        if (r.players.size >= maxPlayers) { send(ws, { type: 'error', msg: '房间已满' }); break; }
        if (c.roomId) leaveRoom(ws);
        // 让加入者先看见已在房间内的对端
        for (const other of r.players) {
          const oc = clients.get(other);
          if (oc) send(ws, { type: 'peer_joined', id: oc.id, name: oc.name, ready: oc.ready,
            role: oc.id === r.hostId ? 'host' : 'guest' });
        }
        r.players.add(ws);
        c.roomId = r.id;
        c.ready = false;
        send(ws, { type: 'joined', roomId: r.id, name: r.name, you: c.name, role: 'guest' });
        broadcast(r.id, { type: 'peer_joined', id: c.id, name: c.name, ready: false, role: 'guest' }, ws);
        broadcastRoomList();
        break;
      }
      case 'leave_room':
        leaveRoom(ws);
        send(ws, { type: 'left' });
        break;
      case 'ready': {
        if (c.roomId) {
          const r = rooms.get(c.roomId);
          if (!r || r.match) break;
          c.ready = !!m.ready;
          broadcast(c.roomId, { type: 'peer_ready', id: c.id, name: c.name, ready: c.ready });
          broadcastRoomList();
        }
        break;
      }
      case 'room_start': {
        const r = c.roomId && rooms.get(c.roomId);
        if (!r || r.match) break;
        if (r.hostId !== c.id) { send(ws, { type: 'error', msg: '只有房主可以开始' }); break; }
        if (![...r.players].every(p => clients.get(p)?.ready)) {
          send(ws, { type: 'error', msg: '请等待所有玩家准备' }); break;
        }
        r.match = { mapSeed: Math.random(), pool: new Map(), poolVersion: 0, owned: new Map(), offers: new Map(),
          round: 0, phase: 'PREP', ready: new Set(), finished: new Set(), completed: new Set(), outcomes: new Map(), defense: null,
          active: new Set([...r.players].map(player => clients.get(player).id)), assault: null };
        broadcast(r.id, { type: 'start', mapSeed: r.match.mapSeed, activeIds: [...r.match.active] });
        broadcastRoomList();
        break;
      }
      case 'shop_offer': {
        const r = c.roomId && rooms.get(c.roomId);
        const match = r?.match;
        const kind = m.kind;
        if (!match || !match.active.has(c.id) || match.phase !== 'PREP' || match.ready.has(c.id) || (kind !== 'normal' && kind !== 'temporary') || !Array.isArray(m.cards) || m.cards.length > 5) break;
        const groups = match.offers.get(c.id) || new Map();
        const offered = new Map();
        const rejected = [];
        for (const card of m.cards) {
          const tier = typeof card?.operatorId === 'string' ? operatorTiers[card.operatorId] : undefined;
          const capacity = operatorPoolByTier[tier] * alliancePoolMultiplier;
          if (typeof card?.uid !== 'string' || card.uid.length > 120 || !Number.isFinite(capacity) ||
              (match.pool.get(card.operatorId) || 0) >= capacity || offered.has(card.uid)) {
            if (typeof card?.uid === 'string') rejected.push(card.uid);
            continue;
          }
          offered.set(card.uid, card.operatorId);
        }
        groups.set(kind, offered);
        match.offers.set(c.id, groups);
        send(ws, { type: 'shop_offer_result', kind, rejected });
        break;
      }
      case 'pool_take': {
        const r = c.roomId && rooms.get(c.roomId);
        const match = r?.match;
        const id = typeof m.operatorId === 'string' ? m.operatorId : '';
        const requestId = typeof m.requestId === 'string' ? m.requestId : '';
        const count = match?.pool.get(id) || 0;
        const offers = match?.offers.get(c.id)?.get(m.kind);
        const ok = !!match && match.active.has(c.id) && match.phase === 'PREP' && !match.ready.has(c.id)
          && /^[a-z0-9_]{1,64}$/.test(id) && requestId.length > 0 && requestId.length <= 80
          && typeof m.offerId === 'string' && offers?.get(m.offerId) === id;
        if (ok) {
          offers.delete(m.offerId);
          match.pool.set(id, count + 1);
          const owned = match.owned.get(c.id) || new Map();
          owned.set(id, (owned.get(id) || 0) + 1);
          match.owned.set(c.id, owned);
        }
        send(ws, { type: 'pool_result', requestId, ok });
        if (ok) broadcastPool(r);
        break;
      }
      case 'pool_return': {
        const r = c.roomId && rooms.get(c.roomId);
        const match = r?.match;
        const owned = match?.owned.get(c.id);
        const id = m.operatorId;
        const count = m.count;
        if (!match || !match.active.has(c.id) || match.phase !== 'PREP' || match.ready.has(c.id) || !owned
            || typeof id !== 'string' || !Number.isInteger(count) || count < 1 || count > (owned.get(id) || 0)) break;
        owned.set(id, owned.get(id) - count);
        match.pool.set(id, match.pool.get(id) - count);
        broadcastPool(r);
        break;
      }
      case 'round_ready': {
        const r = c.roomId && rooms.get(c.roomId);
        const match = r?.match;
        if (!match || !match.active.has(c.id) || match.phase !== 'PREP' || m.round !== match.round) break;
        if (match.assault) {
          if (m.ready) {
            const formation = readFormation(m.formation);
            if (!formation) { send(ws, { type: 'error', msg: '最终攻势阵容无效' }); break; }
            match.assault.formations.set(c.id, formation.operators);
          } else match.assault.formations.delete(c.id);
        }
        if (m.ready) match.ready.add(c.id); else match.ready.delete(c.id);
        broadcastRound(r);
        if (match.ready.size === match.active.size && match.active.size > 0) {
          match.ready.clear();
          if (match.assault) {
            match.phase = 'ASSAULT';
            match.assault.state = createFinalState(match.active.size, match.assault.teamLives, Date.now());
            const groups = match.assault.groups.map(group => ({ simulatorId: group[0],
              members: group.map(playerId => ({ playerId, operators: match.assault.formations.get(playerId) })) }));
            for (const peer of r.players) {
              const id = clients.get(peer).id;
              const ownGroup = groups.find(group => group.members.some(member => member.playerId === id));
              send(peer, { type: 'final_start', round: match.round, groups: ownGroup ? [ownGroup] : groups, state: match.assault.state });
            }
          } else {
            match.phase = 'COMBAT';
            broadcast(r.id, { type: 'round_start', round: match.round });
          }
        }
        break;
      }
      case 'round_done': {
        const r = c.roomId && rooms.get(c.roomId);
        const match = r?.match;
        if (!match || !match.active.has(c.id) || match.phase !== 'COMBAT' || m.round !== match.round || match.finished.has(c.id)) break;
        const leaks = m.leaks ?? [];
        if (!Number.isInteger(m.lives) || m.lives <= 0 || !Array.isArray(leaks) || leaks.length > 200 || leaks.some(enemy =>
          typeof enemy?.templateId !== 'string' || !/^[a-z0-9_]{1,64}$/.test(enemy.templateId) ||
          !Number.isFinite(enemy.hp) || enemy.hp <= 0 || (enemy.shield !== undefined && (!Number.isFinite(enemy.shield) || enemy.shield < 0)))) {
          send(ws, { type: 'error', msg: '回合结果无效' }); break;
        }
        const formation = readFormation(m.formation);
        if (!formation) { send(ws, { type: 'error', msg: '作战阵容无效' }); break; }
        match.outcomes.set(c.id, { lives: m.lives, leaks, formation });
        match.finished.add(c.id);
        if (m.complete) match.completed.add(c.id);
        broadcastRound(r);
        if (match.finished.size === match.active.size && match.active.size > 0) {
          const seats = [...r.players].map((peer, seat) => ({ id: clients.get(peer).id, seat })).filter(({ id }) => match.active.has(id));
          const enemies = seats.flatMap(({ id }) => match.outcomes.get(id).leaks.map((enemy, index) =>
            ({ ...enemy, ownerId: id, leakId: `${id}:${index}` })));
          const helpers = seats.filter(({ id }) => match.outcomes.get(id).leaks.length === 0)
            .sort((a, b) => {
              const x = match.outcomes.get(a.id).formation;
              const y = match.outcomes.get(b.id).formation;
              return y.deployed - x.deployed || Number(y.activePacts > 0) - Number(x.activePacts > 0) || y.alive - x.alive || a.seat - b.seat;
            }).slice(0, 2).map(({ id }) => id);
          if (enemies.length && helpers.length) {
            match.phase = 'DEFENSE';
            match.defense = { helpers, enemies };
            startDefense(r);
          } else settleRound(r, enemies);
        }
        break;
      }
      case 'defense_done': {
        const r = c.roomId && rooms.get(c.roomId);
        const match = r?.match;
        const defense = match?.defense;
        if (!defense || match.phase !== 'DEFENSE' || m.round !== match.round || defense.helpers[0] !== c.id || !Array.isArray(m.survivors)) break;
        const originals = new Map(defense.enemies.map(enemy => [enemy.leakId, enemy]));
        const seen = new Set();
        let invalid = false;
        for (const enemy of m.survivors) {
          if (!originals.has(enemy?.leakId) || seen.has(enemy.leakId) || !Number.isFinite(enemy.hp) || enemy.hp <= 0) {
            invalid = true;
            break;
          }
          seen.add(enemy.leakId);
        }
        if (invalid) {
          send(ws, { type: 'error', msg: '联防结果无效' }); break;
        }
        defense.enemies = m.survivors.map(enemy => ({ ...originals.get(enemy.leakId), hp: enemy.hp,
          shield: Number.isFinite(enemy.shield) && enemy.shield >= 0 ? enemy.shield : 0 }));
        settleRound(r, defense.enemies);
        break;
      }
      case 'final_damage':
      case 'final_leak': {
        const r = c.roomId && rooms.get(c.roomId);
        const match = r?.match;
        const assault = match?.assault;
        if (!assault || match.phase !== 'ASSAULT' || m.round !== match.round ||
            !assault.groups.some(group => group[0] === c.id) || !Number.isInteger(m.sequence) ||
            m.sequence <= (assault.sequence.get(c.id) || 0)) break;
        const accepted = m.type === 'final_damage' ? applyFinalDamage(assault.state, m.damage, Date.now())
          : applyFinalLeak(assault.state, 1, Date.now());
        if (accepted) assault.sequence.set(c.id, m.sequence);
        if (accepted || assault.state.result) broadcast(r.id, { type: 'final_state', state: assault.state });
        finishAssault(r);
        break;
      }
      case 'chat': {
        if (c.roomId) broadcast(c.roomId, { type: 'chat', from: c.name, fromId: c.id, text: String(m.text || '').slice(0, 200) });
        break;
      }
      case 'game': {
        const room = c.roomId && rooms.get(c.roomId);
        const message = { type: 'game', from: c.name, fromId: c.id, payload: m.payload };
        if (room?.match?.phase === 'ASSAULT') {
          const group = room.match.assault.groups.find(members => members[0] === c.id);
          if (group) for (const peer of room.players) {
            const id = clients.get(peer)?.id;
            if (peer !== ws && (group.includes(id) || !room.match.active.has(id))) send(peer, message);
          }
        } else if (c.roomId) broadcast(c.roomId, message, ws);
        break;
      }
      case 'marker': {
        // v4.2.0：guest→host 反向标记点
        if (c.roomId) relay(c.roomId, { type: 'marker', from: c.name, fromId: c.id, x: m.x, y: m.y, label: m.label || '' }, ws, m.toId);
        break;
      }
      case 'event': {
        // v4.1.0：host→guest 事件 toast 推送（kind/text/level）
        // v4.1.0(后提)：附加 extra 字段依附任意负载（转发使用者约定结构）
        if (c.roomId) relay(c.roomId, { type: 'event', from: c.name, fromId: c.id, kind: String(m.kind || ''), text: String(m.text || '').slice(0, 200), level: String(m.level || 'info'), extra: (m.extra ?? null) }, ws, m.toId);
        break;
      }
    }
  });

  ws.on('close', () => leaveRoom(ws));
});

const assaultClock = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const match = room.match;
    if (match?.phase !== 'ASSAULT') continue;
    const state = match.assault.state;
    const previousSeconds = state.remainingSeconds, previousLives = state.teamLives;
    advanceFinalTime(state, now);
    if (state.remainingSeconds !== previousSeconds || state.teamLives !== previousLives || state.result) {
      broadcast(room.id, { type: 'final_state', state });
    }
    finishAssault(room);
  }
}, 1000);
assaultClock.unref();

httpServer.listen(PORT, HOST, () => {
  console.log(`[Stronghold MP] HTTP/WebSocket server listening on http://${HOST}:${PORT} (ws path: /)`);
});
