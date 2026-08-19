import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContactLinks } from '../../src/lib/contacts.js';

test('buildContactLinks includes a named icon in WhatsApp and email links', () => {
  const links = buildContactLinks('Архистратиг Михаил');

  assert.match(links.whatsapp, /^https:\/\/wa\.me\/79166554595\?text=/);
  assert.match(decodeURIComponent(links.whatsapp), /Архистратиг Михаил/);
  assert.equal(links.phone, 'tel:+79166554595');
  assert.match(links.email, /^mailto:iconamaster@yandex\.ru\?/);
  assert.match(decodeURIComponent(links.email), /Архистратиг Михаил/);
});

test('buildContactLinks creates a personal-viewing message when requested', () => {
  const links = buildContactLinks('Архистратиг Михаил', 'viewing');

  assert.match(decodeURIComponent(links.whatsapp), /личный просмотр/i);
});
