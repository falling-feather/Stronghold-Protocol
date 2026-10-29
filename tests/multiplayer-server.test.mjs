import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { WebSocket } from 'ws';

async function openClient(url) {
  const socket = new WebSocket(url);
  const messages = [];
  const listeners = new Set();
  socket.on('message', (data) => {
    const message = JSON.parse(String(data));
    messages.push(message);
    for (const listener of listeners) listener();
  });
  await once(socket, 'open');
  return {
    socket,
    send(message) { socket.send(JSON.stringify(message)); },
    async take(type, predicate = () => true, timeout = 1500) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          listeners.delete(check);
          reject(new Error(`未收到 ${type}`));
        }, timeout);
        function check() {
          const index = messages.findIndex((message) => message.type === type && predicate(message));
          if (index < 0) return;
          clearTimeout(timer);
          listeners.delete(check);
          resolve(messages.splice(index, 1)[0]);
        }
        listeners.add(check);
        check();
      });
    },
  };
}

async function startServer(t) {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));

  const server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => server.kill());
  await Promise.race([
    once(server.stdout, 'data'),
    once(server, 'exit').then(([code]) => { throw new Error(`联机服务器退出: ${code}`); }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('联机服务器启动超时')), 3000); timer.unref(); }),
  ]);

  return `ws://127.0.0.1:${port}`;
}

test('已展示的卡片可以在共享库存耗尽后购买，刷新不会产生新卡', async (t) => {
  const url = await startServer(t);

  const host = await openClient(url);
  const guest = await openClient(url);
  t.after(() => { host.socket.terminate(); guest.socket.terminate(); });
  const hostWelcome = await host.take('welcome');
  const guestWelcome = await guest.take('welcome');
  host.send({ type: 'set_name', name: '主机' });
  guest.send({ type: 'set_name', name: '队友' });
  host.send({ type: 'create_room', name: '测试房间' });
  const joined = await host.take('joined');
  guest.send({ type: 'join_room', roomId: joined.roomId });
  await guest.take('joined');
  host.send({ type: 'ready', ready: true });
  guest.send({ type: 'ready', ready: true });
  await host.take('peer_ready', (m) => m.id === guestWelcome.id && m.ready);
  host.send({ type: 'room_start' });
  const hostStart = await host.take('start');
  const guestStart = await guest.take('start');
  assert.equal(typeof hostStart.mapSeed, 'number');
  assert.equal(hostStart.mapSeed, guestStart.mapSeed);

  host.send({ type: 'shop_offer', kind: 'temporary', cards: [{ uid: 'reserve', operatorId: 'reserve_defender' }] });
  assert.deepEqual((await host.take('shop_offer_result')).rejected, []);
  host.send({ type: 'pool_take', operatorId: 'reserve_defender', offerId: 'reserve', kind: 'temporary', requestId: 'reserve' });
  assert.equal((await host.take('pool_result', (m) => m.requestId === 'reserve')).ok, true);

  for (let i = 0; i < 23; i++) {
    host.send({ type: 'shop_offer', kind: 'normal', cards: [{ uid: `offer${i}`, operatorId: 'recruit_guard' }] });
    assert.deepEqual((await host.take('shop_offer_result')).rejected, []);
    host.send({ type: 'pool_take', operatorId: 'recruit_guard', offerId: `offer${i}`, kind: 'normal', requestId: `h${i}` });
    assert.equal((await host.take('pool_result', (m) => m.requestId === `h${i}`)).ok, true);
  }
  host.send({ type: 'shop_offer', kind: 'normal', cards: [{ uid: 'last-host', operatorId: 'recruit_guard' }] });
  guest.send({ type: 'shop_offer', kind: 'normal', cards: [{ uid: 'last-guest', operatorId: 'recruit_guard' }] });
  await Promise.all([host.take('shop_offer_result'), guest.take('shop_offer_result')]);
  host.send({ type: 'pool_take', operatorId: 'recruit_guard', offerId: 'last-host', kind: 'normal', requestId: 'last-host' });
  guest.send({ type: 'pool_take', operatorId: 'recruit_guard', offerId: 'last-guest', kind: 'normal', requestId: 'last-guest' });
  const results = await Promise.all([
    host.take('pool_result', (m) => m.requestId === 'last-host'),
    guest.take('pool_result', (m) => m.requestId === 'last-guest'),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 2);

  const fullPool = await guest.take('pool_state', (m) => m.counts.recruit_guard === 25);
  host.send({ type: 'pool_return', operatorId: 'recruit_guard', count: 1 });
  const stillFull = await guest.take('pool_state', (m) => m.version > fullPool.version && m.counts.recruit_guard === 24);
  guest.send({ type: 'shop_offer', kind: 'normal', cards: [{ uid: 'unavailable', operatorId: 'recruit_guard' }] });
  assert.deepEqual((await guest.take('shop_offer_result')).rejected, ['unavailable']);
  host.send({ type: 'pool_return', operatorId: 'recruit_guard', count: 1 });
  await guest.take('pool_state', (m) => m.version > stillFull.version && m.counts.recruit_guard === 23);
  guest.send({ type: 'shop_offer', kind: 'normal', cards: [{ uid: 'after-sale', operatorId: 'recruit_guard' }] });
  assert.deepEqual((await guest.take('shop_offer_result')).rejected, []);
  guest.send({ type: 'pool_take', operatorId: 'recruit_guard', offerId: 'after-sale', kind: 'normal', requestId: 'after-sale' });
  assert.equal((await guest.take('pool_result', (m) => m.requestId === 'after-sale')).ok, true);
  guest.send({ type: 'pool_take', operatorId: 'recruit_guard', offerId: 'after-sale', kind: 'normal', requestId: 'duplicate' });
  assert.equal((await guest.take('pool_result', (m) => m.requestId === 'duplicate')).ok, false);

  host.send({ type: 'round_ready', round: 0, ready: true });
  await host.take('round_status', (m) => m.readyIds.includes(hostWelcome.id));
  host.send({ type: 'pool_take', operatorId: 'other_operator', requestId: 'while-ready' });
  assert.equal((await host.take('pool_result', (m) => m.requestId === 'while-ready')).ok, false);
  guest.send({ type: 'round_ready', round: 0, ready: true });
  assert.equal((await host.take('round_start')).round, 0);
  assert.equal((await guest.take('round_start')).round, 0);
  host.send({ type: 'round_done', round: 0, lives: 30 });
  await guest.take('round_status', (m) => m.finishedIds.includes(hostWelcome.id));
  guest.send({ type: 'round_done', round: 0, lives: 30 });
  assert.equal((await host.take('round_prep')).round, 1);
  assert.equal((await guest.take('round_prep')).round, 1);

  host.send({ type: 'round_ready', round: 1, ready: true });
  guest.send({ type: 'round_ready', round: 1, ready: true });
  await host.take('round_start', (m) => m.round === 1);
  await guest.take('round_start', (m) => m.round === 1);
  host.send({ type: 'round_done', round: 1, lives: 30, complete: true });
  guest.send({ type: 'round_done', round: 1, lives: 30, complete: true });
  assert.equal((await host.take('round_prep', (m) => m.stage === 'FINAL')).round, 2);
  assert.equal((await guest.take('round_prep', (m) => m.stage === 'FINAL')).round, 2);

  assert.notEqual(hostWelcome.id, guestWelcome.id);
  guest.socket.close();
  assert.equal((await host.take('match_ended')).reason, 'peer_left');
});

test('房主确认后启动一至四名玩家，并等待所有玩家完成回合', async (t) => {
  const url = await startServer(t);
  const players = await Promise.all(Array.from({ length: 5 }, () => openClient(url)));
  t.after(() => players.forEach((player) => player.socket.terminate()));
  const ids = await Promise.all(players.map(async (player) => (await player.take('welcome')).id));
  const [host, ...guests] = players;
  host.send({ type: 'create_room', name: '四人房' });
  const { roomId } = await host.take('joined');
  for (let i = 0; i < 3; i++) {
    guests[i].send({ type: 'join_room', roomId });
    const peer = await guests[i].take('peer_joined', (m) => m.id === ids[0]);
    assert.equal(peer.id, ids[0]);
    await guests[i].take('joined');
  }
  guests[3].send({ type: 'join_room', roomId });
  assert.match((await guests[3].take('error')).msg, /房间已满/);

  guests[0].send({ type: 'room_start' });
  assert.match((await guests[0].take('error')).msg, /房主/);
  host.send({ type: 'room_start' });
  assert.match((await host.take('error')).msg, /准备/);
  for (const player of players.slice(0, 4)) player.send({ type: 'ready', ready: true });
  for (const id of ids.slice(0, 4)) await host.take('peer_ready', (m) => m.id === id && m.ready);
  host.send({ type: 'room_start' });
  const starts = await Promise.all(players.slice(0, 4).map((player) => player.take('start')));
  assert.ok(starts.every((message) => message.mapSeed === starts[0].mapSeed));

  guests[0].send({ type: 'game', payload: { waveIndex: 3 } });
  assert.equal((await host.take('game')).fromId, ids[1]);
  guests[0].send({ type: 'marker', x: 10, y: 20, toId: ids[2] });
  const marker = await guests[1].take('marker');
  assert.equal(marker.fromId, ids[1]);
  await assert.rejects(host.take('marker', () => true, 150), /未收到 marker/);
  guests[0].send({ type: 'event', kind: 'deploy_request', text: '建议', toId: ids[2] });
  assert.equal((await guests[1].take('event')).fromId, ids[1]);
  await assert.rejects(host.take('event', () => true, 150), /未收到 event/);

  for (const player of players.slice(0, 4)) player.send({ type: 'round_ready', round: 0, ready: true });
  await Promise.all(players.slice(0, 4).map((player) => player.take('round_start')));
  for (const player of players.slice(0, 4)) player.send({ type: 'round_done', round: 0, lives: 30 });
  const next = await Promise.all(players.slice(0, 4).map((player) => player.take('round_prep')));
  assert.ok(next.every((message) => message.round === 1));
});

test('房主离开等待室后转交房主，单人也可开始联合模拟', async (t) => {
  const url = await startServer(t);
  const host = await openClient(url);
  const guest = await openClient(url);
  t.after(() => { host.socket.terminate(); guest.socket.terminate(); });
  const guestId = (await guest.take('welcome')).id;
  host.send({ type: 'create_room', name: '测试房间' });
  const { roomId } = await host.take('joined');
  guest.send({ type: 'join_room', roomId });
  await guest.take('joined');
  host.send({ type: 'leave_room' });
  assert.equal((await guest.take('host_changed')).id, guestId);
  guest.send({ type: 'ready', ready: true });
  await guest.take('peer_ready', (m) => m.id === guestId && m.ready);
  guest.send({ type: 'room_start' });
  await guest.take('start');
  guest.send({ type: 'round_ready', round: 0, ready: true });
  assert.equal((await guest.take('round_start')).round, 0);
  guest.send({ type: 'round_done', round: 0, lives: 30 });
  assert.equal((await guest.take('round_prep')).round, 1);
});

test('漏怪后两名完美作战队友在同一场地联防，幸存敌人只扣原玩家生命', async (t) => {
  const url = await startServer(t);
  const players = await Promise.all(Array.from({ length: 4 }, () => openClient(url)));
  t.after(() => players.forEach((player) => player.socket.terminate()));
  const ids = await Promise.all(players.map(async (player) => (await player.take('welcome')).id));
  const [host, ...guests] = players;
  host.send({ type: 'create_room', name: '联防测试' });
  const { roomId } = await host.take('joined');
  for (const guest of guests) { guest.send({ type: 'join_room', roomId }); await guest.take('joined'); }
  for (const player of players) player.send({ type: 'ready', ready: true });
  for (const id of ids) await host.take('peer_ready', (m) => m.id === id && m.ready);
  host.send({ type: 'room_start' });
  await Promise.all(players.map((player) => player.take('start')));
  for (const player of players) player.send({ type: 'round_ready', round: 0, ready: true });
  await Promise.all(players.map((player) => player.take('round_start')));
  const operator = (id) => ({ id, templateId: 'recruit_guard', gridPos: { x: 1, y: 3 }, pos: { x: 64, y: 192 },
    direction: 'right', stats: { hp: 1000, maxHp: 2000 }, skill: { cost: 45, values: {} },
    currentSp: 12, skillActive: false, isRetreated: false, blockingEnemyIds: [], effects: [] });
  host.send({ type: 'round_done', round: 0, lives: 30, leaks: [], formation: { activePacts: 1,
    operators: Array.from({ length: 4 }, (_, i) => operator(`h${i}`)) } });
  guests[0].send({ type: 'round_done', round: 0, lives: 30, leaks: [], formation: { activePacts: 0,
    operators: Array.from({ length: 2 }, (_, i) => operator(`g${i}`)) } });
  guests[1].send({ type: 'round_done', round: 0, lives: 30, leaks: [{ templateId: 'slug', hp: 200 }, { templateId: 'slug', hp: 150 }] });
  guests[2].send({ type: 'round_done', round: 0, lives: 30, leaks: [{ templateId: 'soldier', hp: 1000 }] });
  const first = await host.take('defense_start');
  assert.equal(first.helperId, ids[0]);
  assert.deepEqual(first.helpers.map(helper => helper.playerId), [ids[0], ids[1]]);
  assert.deepEqual(first.helpers.map(helper => helper.operators.length), [4, 2]);
  assert.equal(first.enemies.length, 3);
  assert.deepEqual(first.enemies.map((enemy) => enemy.ownerId), [ids[2], ids[2], ids[3]]);
  guests[0].send({ type: 'defense_done', round: 0, survivors: [] });
  await assert.rejects(host.take('round_settle', () => true, 150), /未收到 round_settle/);
  host.send({ type: 'defense_done', round: 0, survivors: [{ ...first.enemies[0], leakId: 'forged' }] });
  assert.match((await host.take('error')).msg, /联防结果无效/);
  host.send({ type: 'defense_done', round: 0, survivors: [first.enemies[2]] });
  const settlement = await guests[2].take('round_settle');
  assert.equal(settlement.losses[ids[2]] ?? 0, 0);
  assert.equal(settlement.losses[ids[3]], 1);
  const next = await Promise.all(players.map((player) => player.take('round_prep')));
  assert.ok(next.every((message) => message.round === 1));
});

test('玩家淘汰后返还共享卡池，其他玩家继续对局，淘汰者不能参与准备或购买', async (t) => {
  const url = await startServer(t);
  const players = await Promise.all(Array.from({ length: 3 }, () => openClient(url)));
  t.after(() => players.forEach((player) => player.socket.terminate()));
  const ids = await Promise.all(players.map(async (player) => (await player.take('welcome')).id));
  const [host, eliminated, survivor] = players;
  host.send({ type: 'create_room', name: '淘汰测试' });
  const { roomId } = await host.take('joined');
  for (const player of [eliminated, survivor]) { player.send({ type: 'join_room', roomId }); await player.take('joined'); }
  for (const player of players) player.send({ type: 'ready', ready: true });
  for (const id of ids) await host.take('peer_ready', (m) => m.id === id && m.ready);
  host.send({ type: 'room_start' });
  await Promise.all(players.map((player) => player.take('start')));
  eliminated.send({ type: 'shop_offer', kind: 'normal', cards: [{ uid: 'owned', operatorId: 'recruit_guard' }] });
  await eliminated.take('shop_offer_result');
  eliminated.send({ type: 'pool_take', operatorId: 'recruit_guard', offerId: 'owned', kind: 'normal', requestId: 'buy' });
  assert.equal((await eliminated.take('pool_result', (m) => m.requestId === 'buy')).ok, true);
  for (const player of players) player.send({ type: 'round_ready', round: 0, ready: true });
  await Promise.all(players.map((player) => player.take('round_start')));
  const order = [];
  const returnedPool = host.take('pool_state', (m) => m.counts.recruit_guard === 0).then(() => order.push('pool'));
  const hostSettlement = host.take('round_settle').then(() => order.push('settle'));
  for (const [index, player] of players.entries()) player.send({ type: 'round_done', round: 0,
    lives: index === 1 ? 1 : 30, leaks: [{ templateId: 'slug', hp: 200 }] });
  const settlement = await eliminated.take('round_settle');
  assert.deepEqual(settlement.eliminatedIds, [ids[1]]);
  assert.deepEqual(settlement.activeIds, [ids[0], ids[2]]);
  await Promise.all([returnedPool, hostSettlement]);
  assert.deepEqual(order, ['pool', 'settle']);
  await Promise.all(players.map((player) => player.take('round_prep', (m) => m.round === 1)));

  eliminated.send({ type: 'round_ready', round: 1, ready: true });
  eliminated.send({ type: 'pool_take', operatorId: 'recruit_guard', offerId: 'owned', kind: 'normal', requestId: 'after-elimination' });
  assert.equal((await eliminated.take('pool_result', (m) => m.requestId === 'after-elimination')).ok, false);
  host.send({ type: 'round_ready', round: 1, ready: true });
  await assert.rejects(host.take('round_start', (m) => m.round === 1, 150), /未收到 round_start/);
  survivor.send({ type: 'round_ready', round: 1, ready: true });
  await Promise.all(players.map((player) => player.take('round_start', (m) => m.round === 1)));
  host.send({ type: 'round_done', round: 1, lives: 29 });
  survivor.send({ type: 'round_done', round: 1, lives: 29 });
  await Promise.all(players.map((player) => player.take('round_prep', (m) => m.round === 2)));
  eliminated.send({ type: 'leave_room' });
  assert.equal((await host.take('peer_left', (m) => m.id === ids[1])).id, ids[1]);
  host.send({ type: 'round_ready', round: 2, ready: true });
  survivor.send({ type: 'round_ready', round: 2, ready: true });
  await Promise.all([host.take('round_start', (m) => m.round === 2), survivor.take('round_start', (m) => m.round === 2)]);
});

test('所有玩家淘汰时结束对局，不会进入无法准备的下一回合', async (t) => {
  const url = await startServer(t);
  const player = await openClient(url);
  t.after(() => player.socket.terminate());
  await player.take('welcome');
  player.send({ type: 'create_room', name: '单人淘汰' });
  await player.take('joined');
  player.send({ type: 'ready', ready: true });
  await player.take('peer_ready');
  player.send({ type: 'room_start' });
  await player.take('start');
  player.send({ type: 'round_ready', round: 0, ready: true });
  await player.take('round_start');
  player.send({ type: 'round_done', round: 0, lives: 1, leaks: [{ templateId: 'slug', hp: 200 }] });
  assert.deepEqual((await player.take('round_settle')).activeIds, []);
  assert.equal((await player.take('match_complete')).reason, 'all_eliminated');
  await assert.rejects(player.take('round_prep', () => true, 150), /未收到 round_prep/);
});

test('最终攻势两两组队，共享领袖血量与目标生命并由服务器判定胜利', async (t) => {
  const url = await startServer(t);
  const players = await Promise.all(Array.from({ length: 3 }, () => openClient(url)));
  t.after(() => players.forEach(player => player.socket.terminate()));
  const ids = await Promise.all(players.map(async player => (await player.take('welcome')).id));
  const [host, ...guests] = players;
  host.send({ type: 'create_room', name: '最终攻势测试' });
  const { roomId } = await host.take('joined');
  for (const guest of guests) { guest.send({ type: 'join_room', roomId }); await guest.take('joined'); }
  for (const player of players) player.send({ type: 'ready', ready: true });
  for (const id of ids) await host.take('peer_ready', m => m.id === id && m.ready);
  host.send({ type: 'room_start' });
  await Promise.all(players.map(player => player.take('start')));
  for (const player of players) player.send({ type: 'round_ready', round: 0, ready: true });
  await Promise.all(players.map(player => player.take('round_start')));
  for (const [index, player] of players.entries()) player.send({ type: 'round_done', round: 0, lives: 10 * (index + 1), complete: true });
  const prep = await host.take('round_prep', m => m.stage === 'FINAL');
  await Promise.all(guests.map(player => player.take('round_prep', m => m.stage === 'FINAL')));
  assert.equal(prep.round, 1);
  assert.equal(prep.teamLives, 60);
  assert.equal(prep.bossMaxHp, 675000);
  assert.deepEqual(prep.groups.map(group => group.length).sort(), [1, 2]);
  assert.deepEqual(prep.groups.flat().sort(), ids.slice().sort());
  for (const player of players) player.send({ type: 'round_ready', round: 1, ready: true, formation: { operators: [] } });
  const starts = await Promise.all(players.map(player => player.take('final_start')));
  assert.ok(starts.every(start => start.state.teamLives === 60 && start.groups.length === 1));
  const groups = [...new Map(starts.map(start => [start.groups[0].simulatorId, start.groups[0]])).values()];
  assert.equal(groups.length, 2);
  for (const [index, start] of starts.entries()) assert.ok(start.groups[0].members.some(member => member.playerId === ids[index]));
  const byId = new Map(ids.map((id, index) => [id, players[index]]));
  const simulators = groups.map(group => byId.get(group.simulatorId));
  const pair = groups.find(group => group.members.length === 2);
  const nonSimulatorId = pair.members[1].playerId;
  const otherGroupId = groups.find(group => group !== pair).simulatorId;
  byId.get(pair.simulatorId).send({ type: 'game', payload: { field: 'pair' } });
  assert.equal((await byId.get(nonSimulatorId).take('game', m => m.payload?.field === 'pair')).fromId, pair.simulatorId);
  await assert.rejects(byId.get(otherGroupId).take('game', m => m.payload?.field === 'pair', 150), /未收到 game/);
  byId.get(nonSimulatorId).send({ type: 'final_damage', round: 1, sequence: 1, damage: 1000 });
  await assert.rejects(host.take('final_state', m => m.state.bossHp < 675000, 150), /未收到 final_state/);
  simulators[0].send({ type: 'final_damage', round: 1, sequence: 1, damage: 200000 });
  assert.equal((await host.take('final_state', m => m.state.bossHp === 475000)).state.teamLives, 60);
  simulators[0].send({ type: 'final_damage', round: 1, sequence: 1, damage: 200000 });
  simulators[1].send({ type: 'final_damage', round: 1, sequence: 1, damage: 200000 });
  await host.take('final_state', m => m.state.bossHp === 275000);
  simulators[0].send({ type: 'final_damage', round: 1, sequence: 2, damage: 275000 });
  assert.equal((await host.take('match_complete')).reason, 'victory');
  await Promise.all(guests.map(player => player.take('match_complete')));
});
