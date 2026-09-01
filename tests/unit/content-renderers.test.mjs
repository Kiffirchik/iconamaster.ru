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

  const [sections, video, articles, article, videoPage, contacts, home] = await Promise.all([
    server.ssrLoadModule('/src/components/ContentSections.jsx'),
    server.ssrLoadModule('/src/components/VideoEmbed.jsx'),
    server.ssrLoadModule('/src/pages/ArticlesPage.jsx'),
    server.ssrLoadModule('/src/pages/ArticlePage.jsx'),
    server.ssrLoadModule('/src/pages/VideoPage.jsx'),
    server.ssrLoadModule('/src/pages/ContactsPage.jsx'),
    server.ssrLoadModule('/src/pages/HomePage.jsx')
  ]);

  return { ...sections, ...video, ...articles, ...article, ...videoPage, ...contacts, ...home };
}

function renderAfterImageError(ImageComponent, props) {
  const imageComponent = ImageComponent(props);
  const updater = {
    enqueueSetState(instance, update) {
      const nextState = typeof update === 'function' ? update(instance.state, instance.props) : update;
      instance.state = { ...instance.state, ...nextState };
    }
  };
  const instance = new imageComponent.type(imageComponent.props, undefined, updater);
  const image = instance.render();

  assert.equal(image.type, 'img');
  image.props.onError();
  return instance.render();
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

test('article card cover becomes null after a runtime image error', async (context) => {
  const { ArticleCover } = await rendererModules(context);
  const image = { src: '/assets/articles/missing.jpg', alt: 'Статья', width: 1200, height: 800 };

  assert.equal(renderAfterImageError(ArticleCover, { image }), null);
});

test('video thumbnail becomes null after a runtime image error', async (context) => {
  const { VideoThumbnail } = await rendererModules(context);
  const image = { src: '/assets/video/missing.jpg', alt: 'Видео', width: 1280, height: 720 };

  assert.equal(renderAfterImageError(VideoThumbnail, { image }), null);
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

test('HomePage presents the two featured workshop stories as internal article links', async (context) => {
  const { HomePage } = await rendererModules(context);
  const articles = [
    {
      slug: 'restoration-murals-cleaning',
      title: 'Расчистка настенных храмовых росписей',
      summary: 'Бережная расчистка храмовой стенописи.',
      published: true,
      image: { src: '/assets/articles/murals.jpg', alt: 'Храмовые росписи', width: 1200, height: 800 },
    },
    {
      slug: 'georgievsky-church-iconostasis',
      title: 'Иконостас Георгиевского храма в Зеленограде',
      summary: 'Большой проект иконописной мастерской.',
      published: true,
      image: { src: '/assets/articles/iconostasis.jpg', alt: 'Иконостас', width: 1200, height: 800 },
    },
  ];

  const markup = renderToStaticMarkup(createElement(HomePage, { icons: [], articles, onNavigate() {} }));

  assert.match(markup, /Избранные материалы/);
  assert.match(markup, /href="\/articles\/restoration-murals-cleaning"/);
  assert.match(markup, /href="\/articles\/georgievsky-church-iconostasis"/);
  assert.equal((markup.match(/class="home-story-card"/g) ?? []).length, 2);
  assert.ok(
    markup.indexOf('Избранные материалы') < markup.indexOf('Новые поступления'),
    'featured materials must appear before new arrivals on the homepage'
  );
});

test('ArticlePage identifies a Dzen source without replacing the internal reading experience', async (context) => {
  const { ArticlePage } = await rendererModules(context);
  const markup = renderToStaticMarkup(createElement(ArticlePage, {
    article: {
      title: 'Расчистка настенных храмовых росписей',
      summary: 'Кейс мастерской.',
      sourceUrl: 'https://dzen.ru/a/ak_PywErdWEdTZrn',
      sections: [{ type: 'text', paragraphs: ['Полный материал находится на сайте.'] }],
    },
    onNavigate() {},
  }));

  assert.match(markup, /Полный материал находится на сайте/);
  assert.match(markup, /href="https:\/\/dzen\.ru\/a\/ak_PywErdWEdTZrn"/);
  assert.match(markup, /target="_blank"/);
});
