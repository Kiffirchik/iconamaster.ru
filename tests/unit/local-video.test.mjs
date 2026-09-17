import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const video = {
  provider: 'local', id: 'mineral-paints', title: 'Краски из минералов',
  src: '/assets/videos/mineral-paints.mp4', width: 480, height: 848, duration: 41,
  image: { src: '/assets/videos/mineral-paints.jpg', width: 480, height: 848, alt: 'Кадр' },
};

async function modules(t) {
  const server = await createServer({ root: fileURLToPath(new URL('../..', import.meta.url)), appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  t.after(() => server.close());
  return Object.assign({}, ...await Promise.all([
    server.ssrLoadModule('/src/components/VideoEmbed.jsx'),
    server.ssrLoadModule('/src/pages/VideoPage.jsx'),
    server.ssrLoadModule('/src/pages/ArticlePage.jsx'),
  ]));
}

test('local video only mounts its media source after the play button is clicked', async t => {
  const { VideoEmbed } = await modules(t);
  const instance = new VideoEmbed({ video }, undefined, {
    enqueueSetState(component, update) { component.state = { ...component.state, ...update }; },
  });
  const before = renderToStaticMarkup(instance.render());
  assert.match(before, /<button/);
  assert.match(before, /mineral-paints.jpg/);
  assert.doesNotMatch(before, /<video|<source|\.mp4|<iframe/);
  instance.render().props.children.props.onClick();
  const after = renderToStaticMarkup(instance.render());
  assert.match(after, /<video/);
  assert.match(after, /src="\/assets\/videos\/mineral-paints.mp4"/);
  assert.match(after, /controls=""/);
  assert.match(after, /playsInline=""/i);
  assert.match(after, /width="480" height="848"/);
  assert.doesNotMatch(after, /autoPlay|autoplay|<iframe/);
});

test('local video refuses remote and traversal sources', async t => {
  const { VideoEmbed } = await modules(t);
  for (const src of ['https://evil.test/video.mp4', '//evil.test/video.mp4', '/assets/videos/../secret.mp4', 'javascript:alert(1)']) {
    assert.equal(renderToStaticMarkup(createElement(VideoEmbed, { video: { ...video, src } })), '');
  }
});

test('video cards expose a shareable anchor and readable duration', async t => {
  const { VideoPage } = await modules(t);
  const html = renderToStaticMarkup(createElement(VideoPage, { videos: [video] }));
  assert.match(html, /id="mineral-paints"/);
  assert.match(html, /0:41/);
  assert.doesNotMatch(html, /\.mp4/);
});

test('pigment article links directly to its related film', async t => {
  const { ArticlePage } = await modules(t);
  const html = renderToStaticMarkup(createElement(ArticlePage, { article: { slug: 'icon-painting-pigments', title: 'Краски в иконописи', sections: [] } }));
  assert.match(html, /href="\/video#mineral-paints"/);
});
