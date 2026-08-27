import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContactLinks } from '../../src/lib/contacts.js';

test('buildContactLinks includes a named icon in WhatsApp and email links', () => {
  const contacts = { whatsapp: '79166554595', phone: '+79166554595', email: 'iconamaster@yandex.ru' };
  const links = buildContactLinks(contacts, 'Архистратиг Михаил');

  assert.match(links.whatsapp, /^https:\/\/wa\.me\/79166554595\?text=/);
  assert.match(decodeURIComponent(links.whatsapp), /Архистратиг Михаил/);
  assert.equal(links.phone, 'tel:+79166554595');
  assert.match(links.email, /^mailto:iconamaster@yandex\.ru\?/);
  assert.match(decodeURIComponent(links.email), /Архистратиг Михаил/);
});

test('buildContactLinks creates a personal-viewing message when requested', () => {
  const title = 'Преподобный Александр Пересвет';
  const contacts = { whatsapp: '79166554595', phone: '+79166554595', email: 'iconamaster@yandex.ru' };
  const links = buildContactLinks(contacts, title, 'viewing');

  assert.match(decodeURIComponent(links.whatsapp), /личный просмотр/i);
  assert.match(decodeURIComponent(links.whatsapp), new RegExp(title));
  assert.match(decodeURIComponent(links.email), new RegExp(title));
});
