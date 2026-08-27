import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';

const bundle = {
  icons: [],
  pages: [{ slug: 'restoration', title: 'Реставрация', published: true, sections: [] }],
  articles: [{ slug: 'guslitsa', title: 'Гуслица', published: true, sections: [] }],
  videos: [{ id: 'y10sw1KIOqQ', provider: 'youtube', title: 'Мастерская', autoplay: false }],
  contacts: { whatsapp: '79166554595', phone: '+79166554595', email: 'iconamaster@yandex.ru' }
};

test('ready routes render their data-backed page components', async (context) => {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true }
  });
  context.after(() => server.close());

  const { renderReadyRoute } = await server.ssrLoadModule('/src/App.jsx');
  const cases = [
    [{ name: 'page', slug: 'restoration' }, 'ContentPage', 'page', bundle.pages[0]],
    [{ name: 'articles' }, 'ArticlesPage', 'articles', bundle.articles],
    [{ name: 'article', slug: 'guslitsa' }, 'ArticlePage', 'article', bundle.articles[0]],
    [{ name: 'video' }, 'VideoPage', 'videos', bundle.videos],
    [{ name: 'contacts' }, 'ContactsPage', 'contacts', bundle.contacts]
  ];

  for (const [route, componentName, propName, propValue] of cases) {
    const element = renderReadyRoute(route, bundle, () => {});
    assert.equal(element.type.name, componentName, route.name);
    assert.equal(element.props[propName], propValue, route.name);
  }
});

test('missing page and article slugs use the shared not-found renderer', async (context) => {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true }
  });
  context.after(() => server.close());

  const { renderReadyRoute } = await server.ssrLoadModule('/src/App.jsx');

  assert.equal(renderReadyRoute({ name: 'page', slug: 'missing' }, bundle, () => {}).type.name, 'NotFoundPage');
  assert.equal(renderReadyRoute({ name: 'article', slug: 'missing' }, bundle, () => {}).type.name, 'NotFoundPage');
});
