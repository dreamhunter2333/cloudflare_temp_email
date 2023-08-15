const PostalMime = require("postal-mime");

export default {
	async fetch(request, env) {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "*",
			"Access-Control-Max-Age": "86400",
			"Access-Control-Allow-Headers": "*"
		};

		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: corsHeaders,
			});
		}
		const { pathname, searchParams } = new URL(request.url);
		const address = searchParams.get("address");
		if (address && (pathname === "/api/mails" || pathname === "/api/mails/")) {
			const { results } = await env.DB.prepare(
				`SELECT id, message FROM mails where address = ? order by id desc limit 10`
			).bind(address).all();
			return new Response(JSON.stringify(results), {
				headers: {
					...corsHeaders,
					"Content-Type": "application/json"
				}
			});
		} else if (pathname === "/api/new_address" || pathname === "/api/new_address/") {
			// insert new address
			const name = Math.random().toString(36).substring(2, 15)
			const { success } = await env.DB.prepare(
				`INSERT INTO address (name) VALUES (?)`
			).bind(name).run();
			if (success) {
				return new Response(JSON.stringify({
					address: env.PREFIX + name + "@" + env.DOMAIN
				}), {
					headers: {
						...corsHeaders,
						"Content-Type": "application/json"
					}
				}
				)
			}
			return new Response("error", {
				headers: corsHeaders,
				status: 500
			});

		}
		return new Response("Hello, world!");
	},
	async email(message, env, ctx) {
		if (!env.PREFIX || (message.to && message.to.startsWith(env.PREFIX))) {
			const reader = message.raw.getReader();
			const decoder = new TextDecoder("utf-8");
			let rawEmail = "";
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				rawEmail += decoder.decode(value);
			}

			const parser = new PostalMime.default();
			const parsedEmail = await parser.parse(rawEmail);

			const { success } = await env.DB.prepare(
				`INSERT INTO mails (address, message) VALUES (?, ?)`
			).bind(message.to, parsedEmail.html).run();
			if (!success) {
				message.setReject(`Failed save message to ${message.to}`);
			}
		} else {
			message.setReject(`Unknown address ${message.to}`);
		}
	}
}
