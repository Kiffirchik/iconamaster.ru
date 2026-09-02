import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { siteConfig } from '../../src/data/site-config.js';
import { buildContactLinks } from '../../src/lib/contacts.js';

test('site configuration exposes the canonical workshop identity', () => {
  assert.deepEqual(siteConfig, {
    name: 'Московская иконописная мастерская',
    url: 'https://iconamaster.ru',
    locale: 'ru_RU',
    metrikaId: 112185835,
  });
});

test('contact content exposes the canonical address and map URL', async () => {
  const contacts = JSON.parse(await readFile(new URL('../../public/content/contacts.json', import.meta.url), 'utf8'));

  assert.deepEqual(contacts.address, {
    display: 'Московская область, д. Брёхово, Ромашковая ул., 16',
    streetAddress: 'Ромашковая ул., 16',
    addressLocality: 'д. Брёхово',
    addressRegion: 'Московская область',
    addressCountry: 'RU',
  });
  assert.equal(contacts.mapUrl, 'https://yandex.com/maps/-/CTT2bAoq');
});

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
