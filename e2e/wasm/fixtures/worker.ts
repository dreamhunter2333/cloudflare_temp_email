import { parse_message_wrapper } from 'mail-parser-wasm-worker';
import worker from '../../fixtures/worker';

export default {
  ...worker,
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === '/__test/wasm_parse' && request.method === 'POST') {
      const parsed = parse_message_wrapper(await request.text());
      return Response.json({
        sender: parsed.sender, subject: parsed.subject, text: parsed.text, html: parsed.body_html,
        headers: parsed.headers.map(header => ({ key: header.key.toLowerCase(), value: header.value })),
        attachments: parsed.attachments.map(file => ({
          filename: file.filename, content: [...file.content], content_type: file.content_type,
        })),
      });
    }
    return worker.fetch(request, env, ctx);
  },
};
