import { Hono } from 'hono';

import { HonoCustomType } from '../types';
import settings from './settings';
import user from './user';
import bind_address from './bind_address';

export const api = new Hono<HonoCustomType>();

api.get('/user_api/open_settings', settings.openSettings);
api.get('/user_api/settings', settings.settings);
api.post('/user_api/login', user.login);
api.post('/user_api/verify_code', user.verifyCode);
api.post('/user_api/register', user.register);
api.get('/user_api/bind_address', bind_address.getBindedAddresses);
api.post('/user_api/bind_address', bind_address.bind);
api.get('/user_api/bind_address_jwt/:address_id', bind_address.getBindedAddressJwt);
api.post('/user_api/unbind_address', bind_address.unbind);
