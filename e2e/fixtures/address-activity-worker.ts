import worker from '../../worker/src/worker';

export default {
  ...worker,
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (!request.headers.has('x-e2e-address-activity')) {
      return worker.fetch(request, env, ctx);
    }
    if (path === '/__e2e/sql') {
      const statements = await request.json() as { sql: string; params?: unknown[] }[];
      const results = await env.DB.batch(statements.map(({ sql, params = [] }) =>
        env.DB.prepare(sql).bind(...params)
      ));
      return Response.json(results);
    }

    const flag = request.headers.get('x-e2e-disable-address-updated-at');
    let addressUpdates = 0;
    const runtimeEnv = {
      ...env,
      ...(flag === null ? {} : { DISABLE_ADDRESS_UPDATED_AT: JSON.parse(flag) }),
      DB: new Proxy(env.DB, {
        get(target, key) {
          if (key === 'prepare') {
            return (sql: string) => {
              if (/^\s*UPDATE\s+address\b/i.test(sql)) addressUpdates++;
              return target.prepare(sql);
            };
          }
          const value = Reflect.get(target, key);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }),
    };
    if (flag === 'null') delete runtimeEnv.DISABLE_ADDRESS_UPDATED_AT;
    const pending: Promise<unknown>[] = [];
    const executionCtx = {
      waitUntil: (promise: Promise<unknown>) => { pending.push(promise); },
      passThroughOnException: () => ctx.passThroughOnException(),
      props: ctx.props,
    };
    let response: Response;
    if (path === '/__e2e/scheduled') {
      await worker.scheduled(
        { cron: '0 0 * * *', scheduledTime: Date.now() } as ScheduledEvent,
        runtimeEnv,
        executionCtx,
      );
      response = Response.json({ success: true });
    } else {
      response = await worker.fetch(request, runtimeEnv, executionCtx);
    }
    await Promise.all(pending);
    const headers = new Headers(response.headers);
    headers.set('x-e2e-address-updates', String(addressUpdates));
    return new Response(response.body, { status: response.status, headers });
  },
};
