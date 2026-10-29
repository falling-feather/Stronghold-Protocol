import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';

test('联机事件监听能收到实际事件类型和断线通知', async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  t.after(() => vite.close());

  const relay = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(relay, 'listening');
  t.after(() => {
    for (const client of relay.clients) client.terminate();
    return new Promise((resolve) => relay.close(resolve));
  });

  globalThis.WebSocket = WebSocket;
  const { WsAdapter } = await vite.ssrLoadModule('/src/network/WsAdapter.ts');
  const adapter = new WsAdapter();
  t.after(() => adapter.disconnect());
  const connection = once(relay, 'connection');
  await adapter.connect(`ws://127.0.0.1:${relay.address().port}`, '测试玩家');
  const [peer] = await connection;

  const wildcardEvents = [];
  const typedEvents = [];
  adapter.on('*', (event) => wildcardEvents.push(event));
  adapter.on('start', (event) => typedEvents.push(event));

  const start = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('未收到开始事件')), 1000);
    adapter.on('*', (event) => {
      if (event.payload?.type === 'start') {
        clearTimeout(timer);
        resolve(event);
      }
    });
  });
  peer.send(JSON.stringify({ type: 'start', from: '主机' }));
  const event = await start;

  assert.equal(event.type, 'start');
  assert.equal(event.from, '主机');
  assert.equal(typedEvents.length, 1);
  assert.equal(wildcardEvents.length, 1);
  assert.equal(typedEvents[0].type, 'start');

  const disconnected = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('未收到断线事件')), 1000);
    adapter.on('*', (message) => {
      if (message.type === 'disconnect') {
        clearTimeout(timer);
        resolve(message);
      }
    });
  });
  peer.close();
  assert.equal((await disconnected).type, 'disconnect');
});
