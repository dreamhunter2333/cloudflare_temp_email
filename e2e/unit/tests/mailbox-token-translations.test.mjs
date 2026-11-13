import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deMessages } from '../../../frontend/src/i18n/locales/source/de.ts';
import { esMessages } from '../../../frontend/src/i18n/locales/source/es.ts';
import { jaMessages } from '../../../frontend/src/i18n/locales/source/ja.ts';
import { ptBRMessages } from '../../../frontend/src/i18n/locales/source/ptBR.ts';

for (const [locale, messages] of Object.entries({ de: deMessages, es: esMessages, ja: jaMessages, 'pt-BR': ptBRMessages })) {
  test(`mailbox token and unlink wording is translated for ${locale}`, () => {
    for (const key of [
      'components.AddressCredentialModal.passwordOnlyTip',
      'components.AddressCredentialModal.sessionToken',
      'components.AddressCredentialModal.expiresAt',
      'components.AddressCredentialModal.sessionTokenTip',
      'views.index.AccountSettings.showSessionToken',
      'views.user.AddressManagement.unbindPasswordTip',
    ]) {
      assert.equal(typeof messages[key], 'string', key);
      assert.notEqual(messages[key].trim(), '', key);
    }
  });
}
