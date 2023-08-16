import { Hono } from 'hono'
import { cors } from 'hono/cors';

import { api } from './router';
import { email } from './email';

const app = new Hono()
app.use('/*', cors());
app.route('/', api)

app.all('/*', async c => c.html(`<h1>Hello World</h1>`))


export default {
	fetch: app.fetch,
	email: email,
}
