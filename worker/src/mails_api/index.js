import { Hono } from 'hono'

import auto_reply from './auto_reply'

const api = new Hono()

api.get('/api/auto_reply', auto_reply.getAutoReply)
api.post('/api/auto_reply', auto_reply.saveAutoReply)

export { api }
