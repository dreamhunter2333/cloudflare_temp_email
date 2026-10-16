import { Hono } from 'hono';
import worker from '../../worker/src/worker';
import { CONSTANTS } from '../../worker/src/constants';
import mailApi from './mail-api';

const testApi = new Hono<HonoCustomType>();
testApi.post('/seed_mail', c => mailApi.seedMail(c.req.raw, c.env));
testApi.post('/receive_mail', c => mailApi.receiveMail(c.req.raw, c.env, c.executionCtx as ExecutionContext));
testApi.get('/telegram_binding', async c => {
  const address = c.req.query('address');
  if (!address) return c.text('address is required', 400);
  return c.json(await c.env.KV.get(`${CONSTANTS.TG_KV_PREFIX}:${address}`));
});

const app = new Hono<HonoCustomType>();
app.route('/__test', testApi);
app.all('*', c => {
  const passwordMode = c.req.header('x-test-address-password-mode');
  const env = passwordMode ? {
    ...c.env,
    ADDRESS_PASSWORD_LOGIN_ONLY: true,
    ENABLE_ADDRESS_PASSWORD: passwordMode === 'password-only',
  } : c.env;
  return worker.fetch(c.req.raw, env, c.executionCtx);
});

export default { ...worker, fetch: app.fetch };
