import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createNetServer } from 'node:net';
import test from 'node:test';
import { createServer as createVite } from 'vite';
import { WebSocket } from 'ws';

test('真实 WebSocket 服务器接收组合战场中干员对共同领袖造成的伤害', async (t) => {
  const probe = createNetServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => server.kill());
  await once(server.stdout, 'data');
  const vite = await createVite({ configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { GameEngine } = await vite.ssrLoadModule('/src/core/GameEngine.ts');
  const { selectRandomMap, CONFIG } = await vite.ssrLoadModule('/src/config/gameData.ts');
  selectRandomMap(() => 0.4);

  async function connect() {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const messages = [], listeners = new Set();
    socket.on('message', data => { messages.push(JSON.parse(String(data))); for (const listener of listeners) listener(); });
    await once(socket, 'open');
    return {
      socket,
      send: message => socket.send(JSON.stringify(message)),
      take: (type, predicate = () => true) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => { listeners.delete(check); reject(new Error(`未收到 ${type}`)); }, 2000);
        function check() {
          const index = messages.findIndex(message => message.type === type && predicate(message));
          if (index < 0) return;
          clearTimeout(timer); listeners.delete(check); resolve(messages.splice(index, 1)[0]);
        }
        listeners.add(check); check();
      }),
    };
  }
  const clients = await Promise.all([connect(), connect()]);
  t.after(() => clients.forEach(client => client.socket.terminate()));
  const ids = await Promise.all(clients.map(async client => (await client.take('welcome')).id));
  const engines = clients.map(() => {
    const engine = new GameEngine();
    engine.bench.push({ uid: 'guard', templateId: 'recruit_guard', rank: 1 });
    assert.equal(engine.tryPlaceOperator('guard', 1, 3), true);
    assert.equal(engine.confirmDeployment('right'), true);
    return engine;
  });
  clients[0].send({ type: 'create_room', name: '最终攻势链路' });
  const { roomId } = await clients[0].take('joined');
  clients[1].send({ type: 'join_room', roomId });
  await clients[1].take('joined');
  for (const client of clients) client.send({ type: 'ready', ready: true });
  for (const id of ids) await clients[0].take('peer_ready', message => message.id === id && message.ready);
  clients[0].send({ type: 'room_start' });
  await Promise.all(clients.map(client => client.take('start')));
  for (const client of clients) client.send({ type: 'round_ready', round: 0, ready: true });
  await Promise.all(clients.map(client => client.take('round_start')));
  for (const [index, client] of clients.entries()) client.send({ type: 'round_done', round: 0, lives: 30,
    complete: true, leaks: [], formation: engines[index].getFormationSnapshot() });
  await Promise.all(clients.map(client => client.take('round_prep', message => message.stage === 'FINAL')));
  for (const [index, client] of clients.entries()) client.send({ type: 'round_ready', round: 1, ready: true,
    formation: engines[index].getFormationSnapshot() });
  const starts = await Promise.all(clients.map(client => client.take('final_start')));
  const group = starts[0].groups[0];
  const simulatorIndex = ids.indexOf(group.simulatorId);
  const simulator = engines[simulatorIndex];
  let sequence = 0;
  simulator.onFinalDamage = damage => clients[simulatorIndex].send({ type: 'final_damage', round: 1, sequence: ++sequence, damage });
  assert.equal(simulator.startFinalAssault(group.members, starts[0].state, true), true);
  assert.equal(simulator.operators.length, 2);
  const boss = simulator.enemies[0];
  boss.pos = { x: 2 * CONFIG.TILE_SIZE + 32, y: 3 * CONFIG.TILE_SIZE + 32 };
  boss.stats.spd = 0;
  simulator.update(0.2);
  const update = await clients[1 - simulatorIndex].take('final_state', message => message.state.bossHp < message.state.bossMaxHp);
  assert.ok(update.state.bossHp < 450000);
  simulator.updateFinalState(update.state);
  assert.equal(simulator.enemies[0].stats.hp, update.state.bossHp);
  assert.equal(simulator.enemies[1].stats.hp, update.state.bossHp);
});
