import { Hono } from 'hono';
import worker from '../../worker/src/worker';
import { CONSTANTS } from '../../worker/src/constants';
import mailApi from './mail-api';

const testApi = new Hono<HonoCustomType>();
testApi.post('/seed_mail', c => mailApi.seedMail(c.req.raw, c.env));
testApi.post('/receive_mail', c => mailApi.receiveMail(c.req.raw, c.env, c.executionCtx as ExecutionContext));
testApi.get('/telegram_binding', async c => {
  const userId = c.req.query('userId');
  if (userId) return c.json(await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, 'json'));
  const address = c.req.query('address');
  if (!address) return c.text('address is required', 400);
  return c.json(await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${address}`));
});
testApi.post('/telegram_binding', async c => {
  const { userId, address, jwt } = await c.req.json<{ userId: number; address: string; jwt: string }>();
  await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${userId}`, JSON.stringify([jwt]));
  await c.env.KV.put(`${CONSTANTS.TG_KV_PREFIX}:${address}`, String(userId));
  return c.json({ success: true });
});

const app = new Hono<HonoCustomType>();
app.route('/__test', testApi);
app.all('*', c => worker.fetch(c.req.raw, c.env, c.executionCtx));

export default { ...worker, fetch: app.fetch };
