import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('homepage introduction links directly to the published pigments article', async context => {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true, watch: null, hmr: false },
  });
  context.after(() => server.close());
  const { renderApp } = await server.ssrLoadModule('/src/entry-server.jsx');
  const bundle = Object.fromEntries(await Promise.all(
    ['icons', 'pages', 'articles', 'videos', 'contacts', 'aliases'].map(async name => [
      name,
      JSON.parse(await readFile(new URL(`../../public/content/${name}.json`, import.meta.url), 'utf8')),
    ]),
  ));

  const introduction = renderApp('/', bundle).html.match(
    /<section class="home-shop-intro"[\s\S]*?<\/section>/u,
  )?.[0];
  const destination = introduction?.match(/href="(\/articles\/[^"#?]+)"/u)?.[1];
  assert.equal(destination, '/articles/icon-painting-pigments');
  const pigmentsArticle = bundle.articles.find(article => article.slug === 'icon-painting-pigments');
  assert.equal(pigmentsArticle?.published, true);
  const articlePage = renderApp(destination, bundle);
  assert.deepEqual(articlePage.route, { name: 'article', slug: 'icon-painting-pigments' });
  assert.equal(articlePage.html.match(/<h1[^>]*>([^<]+)<\/h1>/u)?.[1], pigmentsArticle.title);
});
