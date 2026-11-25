import { Hono } from 'hono';

import redeemCode from './redeem_code';
import redeemCodeQuery from './redeem_code_query';
import redeemResultQuery from './redeem_result_query';

export const api = new Hono<HonoCustomType>();

api.use('/redeem_api/*', redeemCode.requireRedeemCodeEnabled);
api.post('/redeem_api/query', redeemCodeQuery.queryRedeemCode);
api.post('/redeem_api/result', redeemResultQuery.queryRedeemResult);
api.post('/redeem_api/redeem', redeemCode.redeemCode);
