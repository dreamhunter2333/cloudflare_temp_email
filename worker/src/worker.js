import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt'

import { api } from './router';
import { email } from './email';

const app = new Hono()
app.use('/*', cors());
app.use('/api/*', async (c, next) => {
	// check header x-custom-auth
	if (c.env.PASSWORDS && c.env.PASSWORDS.length > 0) {
		const auth = c.req.raw.headers.get("x-custom-auth");
		if (!auth || !c.env.PASSWORDS.includes(auth)) {
			return c.text("Need Password", 401)
		}
	}
	if (c.req.path.startsWith("/api/new_address")) {
		await next();
		return;
	};
	return jwt({ secret: c.env.JWT_SECRET })(c, next);
});

app.use('/admin/*', async (c, next) => {
	// check header x-admin-auth
	if (c.env.ADMIN_PASSWORDS && c.env.ADMIN_PASSWORDS.length > 0) {
		const adminAuth = c.req.raw.headers.get("x-admin-auth");
		if (adminAuth && c.env.ADMIN_PASSWORDS.includes(adminAuth)) {
			await next();
			return;
		}
	}
	return c.text("Need Admin Password", 401)
});


app.route('/', api)

app.all('/*', async c => c.html(`<h1>Hello World</h1>`))


export default {
	fetch: app.fetch,
	email: email,
}
