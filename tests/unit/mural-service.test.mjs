import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const readJson = async (relativePath) => JSON.parse(
  await readFile(new URL(relativePath, import.meta.url), 'utf8'),
);

test('mural-cleaning service content remains durable, verified, and renderable', async (context) => {
  const [pages, articles] = await Promise.all([
    readJson('../../public/content/pages.json'),
    readJson('../../public/content/articles.json'),
  ]);
  const service = pages.find(({ slug }) => slug === 'raschistka-hramovyh-rospisey');

  assert.ok(service, 'missing mural-cleaning service page');
  assert.equal(pages.length, 8);
  assert.equal(articles.length, 10);
  assert.equal(service.template, 'service');
  assert.equal(service.consultationTopic, 'murals');
  assert.equal(service.relatedArticleSlug, 'restoration-murals-cleaning');
  assert.equal(service.sourceUrl, 'https://dzen.ru/a/ak_PywErdWEdTZrn');
  assert.equal(service.sections.filter((section) => section.type === 'image').length, 3);

  const { manualPages } = await import('../../scripts/data/manual-pages.mjs');
  assert.deepEqual(manualPages, [service]);

  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true },
  });
  context.after(() => server.close());
  const [muralModule, headerModule, footerModule, articleModule] = await Promise.all([
    server.ssrLoadModule('/src/pages/MuralCleaningPage.jsx'),
    server.ssrLoadModule('/src/components/SiteHeader.jsx'),
    server.ssrLoadModule('/src/components/SiteFooter.jsx'),
    server.ssrLoadModule('/src/pages/ArticlePage.jsx'),
  ]);
  const muralPage = muralModule.MuralCleaningPage({ page: service });
  const consultationElements = muralPage.props.children
    .flatMap((child) => child?.props?.children ?? [])
    .filter((child) => child?.type?.name === 'ConsultationLinks');
  const markup = renderToStaticMarkup(createElement(muralModule.MuralCleaningPage, { page: service }));

  assert.match(markup, /от одного до двух месяцев/u);
  assert.match(markup, /Получить предварительную консультацию/u);
  assert.match(markup, /Подробный материал о технологии/u);
  assert.match(markup, /href="\/articles\/restoration-murals-cleaning"/u);
  assert.doesNotMatch(markup, /target=/u);
  assert.equal((markup.match(/class="[^"]*mural-service-page__consultation[^"]*"/gu) ?? []).length, 2);
  assert.deepEqual(consultationElements.map(({ props }) => props.topic), ['murals', 'murals']);

  const headerMarkup = renderToStaticMarkup(createElement(headerModule.SiteHeader, { onNavigate() {} }));
  const footerMarkup = renderToStaticMarkup(createElement(footerModule.SiteFooter, { onNavigate() {} }));
  const articleMarkup = renderToStaticMarkup(createElement(articleModule.ArticlePage, {
    article: articles.find(({ slug }) => slug === service.relatedArticleSlug),
    onNavigate() {},
  }));
  for (const shellMarkup of [headerMarkup, footerMarkup]) {
    assert.match(shellMarkup, /href="\/raschistka-hramovyh-rospisey"[^>]*>Расчистка росписей<\/a>/u);
  }
  assert.match(articleMarkup, /href="\/raschistka-hramovyh-rospisey"[^>]*>Обсудить расчистку росписей<\/a>/u);
});

test('mural-cleaning contact mode uses the dedicated consultation message', async () => {
  const { buildContactLinks } = await import('../../src/lib/contacts.js');
  const contacts = {
    whatsapp: '79166554595',
    phone: '+79166554595',
    email: 'iconamaster@yandex.ru',
  };
  const links = buildContactLinks(contacts, undefined, 'murals');
  const expected = 'Здравствуйте! Нужна консультация по расчистке настенных храмовых росписей.';

  assert.match(decodeURIComponent(links.whatsapp), new RegExp(`${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'u'));
  assert.match(decodeURIComponent(links.email), new RegExp(`${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'u'));
});

test('only the two workshop-location paragraphs use the normalized address', async () => {
  const pages = await readJson('../../public/content/pages.json');
  const paragraphs = pages.flatMap(({ sections }) => sections)
    .filter(({ type }) => type === 'text')
    .flatMap(({ paragraphs: values }) => values);
  const serialized = JSON.stringify(pages);

  assert.equal(paragraphs.filter((paragraph) => paragraph.includes('Московская область, д. Брёхово, Ромашковая ул., 16')).length, 2);
  assert.doesNotMatch(serialized, /деревня Брехово|ул Ромашковая|Пятницкое шоссе, деревня Брехово/u);
  assert.match(serialized, /перекрестке Зеленограда и Пятницкого шоссе/u);
});
