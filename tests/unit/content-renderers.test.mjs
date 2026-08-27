import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

async function rendererModules(context) {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true }
  });
  context.after(() => server.close());

  const [sections, video, articles, videoPage, contacts] = await Promise.all([
    server.ssrLoadModule('/src/components/ContentSections.jsx'),
    server.ssrLoadModule('/src/components/VideoEmbed.jsx'),
    server.ssrLoadModule('/src/pages/ArticlesPage.jsx'),
    server.ssrLoadModule('/src/pages/VideoPage.jsx'),
    server.ssrLoadModule('/src/pages/ContactsPage.jsx')
  ]);

  return { ...sections, ...video, ...articles, ...videoPage, ...contacts };
}

test('ContentSections renders only structured text, image and gallery data', async (context) => {
  const { ContentSections } = await rendererModules(context);
  const markup = renderToStaticMarkup(createElement(ContentSections, {
    sections: [
      { type: 'html', value: '<script>alert(1)</script>' },
      { type: 'text', heading: 'Реставрация', paragraphs: ['Первый абзац', 'Второй абзац'] },
      { type: 'image', image: null },
      { type: 'gallery', images: [null, { src: '/assets/pages/workshop.jpg', alt: 'Мастерская', width: 1200, height: 800 }] }
    ]
  }));

  assert.match(markup, /<h2>Реставрация<\/h2>/);
  assert.match(markup, /Первый абзац/);
  assert.match(markup, /src="\/assets\/pages\/workshop\.jpg"/);
  assert.doesNotMatch(markup, /script|alert\(1\)/);
  assert.equal((markup.match(/<img/g) ?? []).length, 1);
});

test('VideoEmbed defers iframe markup and produces a non-autoplay provider URL', async (context) => {
  const { VideoEmbed, videoEmbedUrl } = await rendererModules(context);
  const markup = renderToStaticMarkup(createElement(VideoEmbed, {
    video: { provider: 'youtube', id: 'y10sw1KIOqQ', title: 'Иконописная мастерская' }
  }));

  assert.match(markup, /<button[^>]*type="button"[^>]*>/);
  assert.match(markup, />Смотреть видео<\//);
  assert.doesNotMatch(markup, /<iframe/);
  assert.equal(videoEmbedUrl({ provider: 'youtube', id: 'y10sw1KIOqQ' }), 'https://www.youtube-nocookie.com/embed/y10sw1KIOqQ?autoplay=0');
  assert.equal(videoEmbedUrl({ provider: 'unknown', id: 'unsafe' }), null);
});

test('article and video indexes remain usable with empty collections', async (context) => {
  const { ArticlesPage, VideoPage } = await rendererModules(context);
  const articlesMarkup = renderToStaticMarkup(createElement(ArticlesPage, { articles: [], onNavigate() {} }));
  const videosMarkup = renderToStaticMarkup(createElement(VideoPage, { videos: [] }));

  assert.match(articlesMarkup, /<h1[^>]*>Статьи<\/h1>/);
  assert.match(articlesMarkup, /Материалы готовятся к публикации/);
  assert.match(videosMarkup, /<h1[^>]*>Видео<\/h1>/);
  assert.match(videosMarkup, /Видеоматериалы готовятся к публикации/);
  assert.doesNotMatch(videosMarkup, /<iframe/);
});

test('ContactsPage builds links from the supplied contact bundle', async (context) => {
  const { ContactsPage } = await rendererModules(context);
  const markup = renderToStaticMarkup(createElement(ContactsPage, {
    contacts: { whatsapp: '79990001122', phone: '+79990001122', email: 'atelier@example.test' }
  }));

  assert.match(markup, /href="https:\/\/wa\.me\/79990001122"/);
  assert.match(markup, /href="tel:\+79990001122"/);
  assert.match(markup, /href="mailto:atelier@example\.test"/);
});
