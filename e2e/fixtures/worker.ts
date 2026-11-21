import { Hono } from 'hono';
import worker from '../../worker/src/worker';
import { CONSTANTS } from '../../worker/src/constants';
import mailApi from './mail-api';
import { mailProcessingTestEnv } from './mail-processing';

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
  const expiryMode = c.req.header('x-test-address-expiry-mode');
  const env = {
    ...c.env,
    ...(passwordMode ? {
      ADDRESS_PASSWORD_LOGIN_ONLY: true,
      ENABLE_ADDRESS_PASSWORD: passwordMode === 'password-only',
    } : {}),
    ...(expiryMode !== undefined ? {
      ENABLE_ADDRESS_EXPIRY: expiryMode === 'enabled',
    } : {}),
  };
  const batchFailure = c.req.header('x-test-fail-db-batch');
  const kvFailure = c.req.header('x-test-fail-kv');
  const allowlistFailure = c.req.header('x-test-fail-ai-allowlist');
  const mockedMailProvider = c.req.header('x-test-mail-processing-provider');
  const DB = batchFailure || allowlistFailure || mockedMailProvider ? {
    prepare(query: string) {
      if ((allowlistFailure || mockedMailProvider) && query === 'SELECT value FROM settings WHERE key = ?') {
        return { bind: (key: string) => {
          if (key !== CONSTANTS.AI_EXTRACT_SETTINGS_KEY) return c.env.DB.prepare(query).bind(key);
          return { first: async () => {
            if (allowlistFailure === 'read') throw new Error('Injected AI allowlist read failure');
            if (allowlistFailure === 'json') return '{invalid json';
            return c.req.header('x-test-ai-allowlist') ?? null;
          } };
        } };
      }
      return c.env.DB.prepare(query);
    },
    batch: async (statements: D1PreparedStatement[]) => {
      if (!batchFailure) return c.env.DB.batch(statements);
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
  const sitePasswords = c.req.header('x-test-site-passwords');
  const bindings = {
    ...env, DB, KV, ...mailProcessingTestEnv(c.req.raw, env),
    ...(sitePasswords !== undefined ? { PASSWORDS: JSON.parse(sitePasswords) } : {}),
  };
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
