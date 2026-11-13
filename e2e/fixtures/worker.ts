import { Hono } from 'hono';
import worker from '../../worker/src/worker';
import { CONSTANTS } from '../../worker/src/constants';
import mailApi from './mail-api';

const testApi = new Hono<HonoCustomType>();
testApi.post('/seed_mail', c => mailApi.seedMail(c.req.raw, c.env));
testApi.post('/receive_mail', c => mailApi.receiveMail(c.req.raw, c.env, c.executionCtx as ExecutionContext));
testApi.post('/expire_redeem_code', async c => {
  const { code } = await c.req.json<{ code: string }>();
  const { meta } = await c.env.DB.prepare("UPDATE redeem_codes SET expires_at = '2020-01-01T00:00:00.000Z' WHERE code = ?")
    .bind(code).run();
  return c.json({ updated: meta.changes });
});
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
app.all('*', async c => {
  const passwordMode = c.req.header('x-test-address-password-mode');
  const env = passwordMode ? {
    ...c.env,
    ADDRESS_PASSWORD_LOGIN_ONLY: true,
    ENABLE_ADDRESS_PASSWORD: passwordMode === 'password-only',
  } : c.env;
  const batchFailure = c.req.header('x-test-fail-db-batch');
  const kvFailure = c.req.header('x-test-fail-kv');
  const DB = batchFailure ? {
    prepare: c.env.DB.prepare.bind(c.env.DB),
    batch: async () => {
      if (batchFailure === 'throw') throw new Error('Injected database batch failure');
      return [{ success: false }];
    },
  } as D1Database : c.env.DB;
  const KV = kvFailure ? new Proxy(c.env.KV, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        if (property === kvFailure) throw new Error('Injected KV failure');
        const result = await value.apply(target, args);
        if (property === 'delete' && kvFailure === 'delete-after') throw new Error('Injected KV response failure');
        return result;
      };
    },
  }) : c.env.KV;
  const bindings = batchFailure || kvFailure ? { ...env, DB, KV } : env;
  if (!c.req.header('x-test-await-background')) return worker.fetch(c.req.raw, bindings, c.executionCtx);

  const tasks: Promise<unknown>[] = [];
  const response = await worker.fetch(c.req.raw, bindings, {
    waitUntil(task) {
      tasks.push(task);
      c.executionCtx.waitUntil(task);
    },
    passThroughOnException: () => c.executionCtx.passThroughOnException(),
    props: c.executionCtx.props,
    exports: c.executionCtx.exports,
  });
  await Promise.all(tasks);
  return response;
});

export default { ...worker, fetch: app.fetch };
