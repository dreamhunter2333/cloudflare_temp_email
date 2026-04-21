import { Context, Hono } from 'hono'

import { getUserRoles } from '../utils'
import address_api from './address_api'
import address_sender_api from './address_sender_api'
import sendbox_api from './sendbox_api'
import statistics_api from './statistics_api'
import account_settings_api from './account_settings_api'
import cleanup_api from './cleanup_api'
import admin_user_api from './admin_user_api'
import webhook_settings from './webhook_settings'
import mail_webhook_settings from './mail_webhook_settings'
import oauth2_settings from './oauth2_settings'
import worker_config from './worker_config'
import admin_mail_api from './admin_mail_api'
import { sendMailbyAdmin, sendMailByBindingAdmin } from './send_mail'
import db_api from './db_api'
import ip_blacklist_settings from './ip_blacklist_settings'
import ai_extract_settings from './ai_extract_settings'
import e2e_test_api from './e2e_test_api'

export const api = new Hono<HonoCustomType>()

// address
api.get('/admin/address', address_api.listAddresses)
api.post('/admin/new_address', address_api.createNewAddress)
api.delete('/admin/delete_address/:id', address_api.deleteAddress)
api.delete('/admin/clear_inbox/:id', address_api.clearInbox)
api.delete('/admin/clear_sent_items/:id', address_api.clearSentItems)
api.get('/admin/show_password/:id', address_api.showPassword)
api.post('/admin/address/:id/reset_password', address_api.resetPassword)

// mail api
api.get('/admin/mails', admin_mail_api.getMails)
api.get('/admin/mails_unknow', admin_mail_api.getUnknowMails)
api.delete('/admin/mails/:id', admin_mail_api.deleteMail)

// address sender
api.get('/admin/address_sender', address_sender_api.list)
api.post('/admin/address_sender', address_sender_api.update)
api.delete('/admin/address_sender/:id', address_sender_api.remove)

// sendbox
api.get('/admin/sendbox', sendbox_api.list)
api.delete('/admin/sendbox/:id', sendbox_api.remove)

// statistics
api.get('/admin/statistics', statistics_api.get)

// account settings
api.get('/admin/account_settings', account_settings_api.get)
api.post('/admin/account_settings', account_settings_api.save)

// cleanup
api.post('/admin/cleanup', cleanup_api.cleanup)
api.get('/admin/auto_cleanup', cleanup_api.getCleanup)
api.post('/admin/auto_cleanup', cleanup_api.saveCleanup)

// user settings
api.get('/admin/user_settings', admin_user_api.getSetting)
api.post('/admin/user_settings', admin_user_api.saveSetting)
api.get('/admin/users', admin_user_api.getUsers)
api.delete('/admin/users/:user_id', admin_user_api.deleteUser)
api.post('/admin/users', admin_user_api.createUser)
api.post('/admin/users/:user_id/reset_password', admin_user_api.resetPassword)
api.get('/admin/user_roles', async (c: Context<HonoCustomType>) => c.json(getUserRoles(c)))
api.post('/admin/user_roles', admin_user_api.updateUserRoles)
api.get('/admin/role_address_config', admin_user_api.getRoleAddressConfig)
api.post('/admin/role_address_config', admin_user_api.saveRoleAddressConfig)
api.get('/admin/users/bind_address/:user_id', admin_user_api.getBindedAddresses)
api.post('/admin/users/bind_address', admin_user_api.bindAddress)

// user oauth2 settings
api.get('/admin/user_oauth2_settings', oauth2_settings.getUserOauth2Settings)
api.post('/admin/user_oauth2_settings', oauth2_settings.saveUserOauth2Settings)

// webhook settings
api.get('/admin/webhook/settings', webhook_settings.getWebhookSettings)
api.post('/admin/webhook/settings', webhook_settings.saveWebhookSettings)

// mail webhook settings
api.get('/admin/mail_webhook/settings', mail_webhook_settings.getWebhookSettings)
api.post('/admin/mail_webhook/settings', mail_webhook_settings.saveWebhookSettings)
api.post('/admin/mail_webhook/test', mail_webhook_settings.testWebhookSettings)

// worker config
api.get('/admin/worker/configs', worker_config.getConfig)

// send mail by admin
api.post('/admin/send_mail', sendMailbyAdmin)
api.post('/admin/send_mail_by_binding', sendMailByBindingAdmin)

// db api
api.get('admin/db_version', db_api.getVersion)
api.post('admin/db_initialize', db_api.initialize)
api.post('admin/db_migration', db_api.migrate)

// IP blacklist settings
api.get('/admin/ip_blacklist/settings', ip_blacklist_settings.getIpBlacklistSettings)
api.post('/admin/ip_blacklist/settings', ip_blacklist_settings.saveIpBlacklistSettings)

// AI extract settings
api.get('/admin/ai_extract/settings', ai_extract_settings.getAiExtractSettings)
api.post('/admin/ai_extract/settings', ai_extract_settings.saveAiExtractSettings)

// E2E test endpoints
api.post('/admin/test/seed_mail', e2e_test_api.seedMail)
api.post('/admin/test/receive_mail', e2e_test_api.receiveMail)
