import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { WebSocketServer } from 'ws';

let server;
let onMailpitMessage;

before(async () => {
  server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const originalApi = process.env.MAILPIT_API;
  process.env.MAILPIT_API = `http://127.0.0.1:${server.address().port}/api`;
  try {
    ({ onMailpitMessage } = await import('../../fixtures/test-helpers.ts'));
  } finally {
    if (originalApi === undefined) delete process.env.MAILPIT_API;
    else process.env.MAILPIT_API = originalApi;
  }
});

after(async () => {
  for (const client of server.clients) client.terminate();
  await new Promise((resolve) => server.close(resolve));
});

const target = { Subject: 'target-message' };
const newEvent = JSON.stringify({ Type: 'new', Data: target });
const statsEvent = JSON.stringify({ Type: 'stats', Data: { total: 1 } });

for (const [name, payload] of [
  ['single event', newEvent],
  ['new event followed by stats', `${newEvent}\n${statsEvent}`],
  ['stats followed by new event', `${statsEvent}\n${newEvent}`],
  ['malformed and unrelated events before the match',
    `invalid-json\n${JSON.stringify({ Type: 'new', Data: { Subject: 'other' } })}\n${newEvent}\n`],
]) {
  test(name, async () => {
    const connected = once(server, 'connection');
    const listener = onMailpitMessage((mail) => mail.Subject === target.Subject, { timeout: 1000 });
    const received = assert.doesNotReject(async () => {
      assert.deepEqual(await listener.message, target);
    });
    const [client] = await connected;
    await listener.ready;
    client.send(payload);
    await received;
  });
}
