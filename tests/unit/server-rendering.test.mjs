import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';

const bundle = {
  version: 1,
  icons: [
    {
      slug: 'example-icon',
      title: 'Икона Николая Чудотворца',
      published: true,
      order: 1,
      price: '120 000 руб.',
      images: [
        {
          src: '/assets/icons/example.jpg',
          alt: 'Икона Николая Чудотворца',
          width: 1200,
          height: 1600,
        },
      ],
    },
  ],
  pages: [
    {
      slug: 'raschistka-hramovyh-rospisey',
      title: 'Расчистка настенных храмовых росписей',
      intro: 'Бережная расчистка храмовой стенописи.',
      published: true,
      template: 'service',
      relatedArticleSlug: 'restoration-murals-cleaning',
      sections: [],
    },
  ],
  articles: [],
  videos: [],
  contacts: {
    whatsapp: '79166554595',
    phone: '+79166554595',
    email: 'iconamaster@yandex.ru',
    mapUrl: 'https://yandex.com/maps/-/CTT2bAoq',
    address: {
      display: 'Московская область, д. Брёхово, Ромашковая ул., 16',
      streetAddress: 'Ромашковая ул., 16',
      addressLocality: 'д. Брёхово',
      addressRegion: 'Московская область',
      addressCountry: 'RU',
    },
  },
  aliases: {},
};

async function loadServerEntry(context) {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true },
  });
  context.after(() => server.close());
  return server.ssrLoadModule('/src/entry-server.jsx');
}

test('server rendering returns the complete mural service route', async (context) => {
  const { renderApp } = await loadServerEntry(context);

  const result = renderApp('/raschistka-hramovyh-rospisey', bundle);

  assert.equal(result.route.name, 'page');
  assert.match(result.html, /<h1[^>]*>Расчистка настенных храмовых росписей/u);
  assert.match(result.html, /href="\/collection"/u);
  assert.match(result.html, /wa\.me\/79166554595/u);
  assert.doesNotMatch(result.html, /Загружаем коллекцию/u);
});

test('footer WhatsApp message follows only the mural service route without changing email or labels', async (context) => {
  const { renderApp } = await loadServerEntry(context);
  for (const [path, expected] of [
    ['/raschistka-hramovyh-rospisey', 'Здравствуйте! Нужна консультация по расчистке настенных храмовых росписей.'],
    ['/', 'Здравствуйте! Хочу получить консультацию об иконах мастерской.'],
    ['/icons/example-icon', 'Здравствуйте! Хочу получить консультацию об иконах мастерской.'],
  ]) {
    const footer = renderApp(path, bundle).html.match(/<footer\b[\s\S]*?<\/footer>/u)?.[0];
    assert.ok(footer);
    const href = footer.match(/href="(https:\/\/wa\.me\/[^"]+)"/u)?.[1];
    assert.equal(new URL(href.replaceAll('&amp;', '&')).searchParams.get('text'), expected, path);
    assert.match(footer, />Написать в WhatsApp<\/a>/u);
    assert.match(decodeURIComponent(footer), /Хочу получить консультацию об иконах мастерской/u, 'email remains unchanged');
  }
});

test('server rendering returns a complete icon detail route', async (context) => {
  const { renderApp } = await loadServerEntry(context);

  const result = renderApp('/icons/example-icon', bundle);

  assert.deepEqual(result.route, { name: 'icon', slug: 'example-icon' });
  assert.match(result.html, /<h1[^>]*>Икона Николая Чудотворца/u);
  assert.match(result.html, /120 000 руб\./u);
  assert.match(result.html, /width="1200" height="1600"/u);
  assert.match(result.html, /href="\/collection"/u);
  assert.doesNotMatch(result.html, /Загружаем коллекцию/u);
});
