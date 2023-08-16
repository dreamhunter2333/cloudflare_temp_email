import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt'

import { api } from './router';
import { email } from './email';

const app = new Hono()
app.use('/*', cors());
app.use('/api/*', async (c, next) => {
	if (c.req.path.startsWith("/api/new_address")) {
		await next();
		return;
	};
	return jwt({ secret: c.env.JWT_SECRET })(c, next);
});


app.route('/', api)

app.all('/*', async c => c.html(`<h1>Hello World</h1>`))


export default {
	fetch: app.fetch,
	email: email,
}
