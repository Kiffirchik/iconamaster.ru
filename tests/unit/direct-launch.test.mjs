import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('catalog provides a direct icon-specific contact beside price without hiding details', async (context) => {
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  context.after(() => server.close());
  const { IconCard } = await server.ssrLoadModule('/src/components/IconCard.jsx');
  const { ContentProvider } = await server.ssrLoadModule('/src/content/ContentProvider.jsx');
  const icons = JSON.parse(await readFile('public/content/icons.json', 'utf8'));
  const icon = { ...icons[0], title: 'Тестовая икона', price: '100 000 ₽', availability: 'Продано' };
  const markup = renderToStaticMarkup(h(ContentProvider, { initialBundle: { contacts: { whatsapp: '79166554595', phone: '+79166554595', email: 'iconamaster@yandex.ru' } } }, h(IconCard, { icon })));
  assert.match(markup, /100 000 ₽ · Продано/u);
  const contact = markup.match(/<a[^>]+href="(https:\/\/wa\.me\/[^"]+)"[^>]*>Обсудить икону<\/a>/u);
  assert.ok(contact, 'missing direct catalog contact');
  assert.ok(decodeURIComponent(contact[1]).includes('«Тестовая икона»'));
  assert.match(markup, /Подробнее<\/a>/u);
  assert.doesNotMatch(markup, /href="(?:tel:|mailto:)/u);
});

test('mural consultation is part of the introductory header before long-form content', async (context) => {
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  context.after(() => server.close());
  const { MuralCleaningPage } = await server.ssrLoadModule('/src/pages/MuralCleaningPage.jsx');
  const { ContentProvider } = await server.ssrLoadModule('/src/content/ContentProvider.jsx');
  const pages = JSON.parse(await readFile('public/content/pages.json', 'utf8'));
  const page = pages.find(({ slug }) => slug === 'raschistka-hramovyh-rospisey');
  const markup = renderToStaticMarkup(h(ContentProvider, { initialBundle: { contacts: { whatsapp: '79166554595' } } }, h(MuralCleaningPage, { page })));
  const header = markup.match(/<header\b[^>]*>([\s\S]*?)<\/header>/u)?.[1];
  assert.match(header, /href="https:\/\/wa.me\//u);
  assert.match(header, /Получить предварительную консультацию/u);
});
