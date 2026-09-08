import test from 'node:test';
import assert from 'node:assert/strict';
import { compileLiveTemplate } from '../../scripts/prepare-live-editor.mjs';

test('live slots preserve wrappers, nested markup boundaries and unrelated content', () => {
  const html = '<main><div data-live-slot="icon-card:sample"><h3>Old</h3><div>x</div></div><div>keep</div><header data-live-slot="article-header:news"><h1>Old</h1></header></main>';
  assert.equal(compileLiveTemplate(html), '<main><div data-live-slot="icon-card:sample"><!--LIVE:icon-card:sample--></div><div>keep</div><header data-live-slot="article-header:news"><!--LIVE:article-header:news--></header></main>');
});
test('live compiler fails closed on unclosed or nested slots', () => {
  assert.throws(() => compileLiveTemplate('<div data-live-slot="icon-card:sample">'), /Unclosed/);
  assert.throws(() => compileLiveTemplate('<div data-live-slot="icon-card:sample"><div data-live-slot="passport:sample"></div></div>'), /Nested/);
});
