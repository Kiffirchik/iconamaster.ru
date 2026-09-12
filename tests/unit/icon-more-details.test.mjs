import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Catches missing disclosure, unsafe HTML, empty buttons and accidental catalog expansion.
test('icon detail exposes optional plain text in a closed disclosure after its description', async context => {
  const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
  context.after(()=>server.close());
  const {IconDetailPage}=await server.ssrLoadModule('/src/pages/IconDetailPage.jsx');
  const {IconCard}=await server.ssrLoadModule('/src/components/IconCard.jsx');
  const icon={slug:'test',title:'Икона',description:'Основное описание',price:'100 000 руб.',published:true,
    images:[{src:'/test.jpg',alt:'Икона',width:100,height:120}],
    moreDetails:'Первый абзац\n\nВторой <script>alert(1)</script> & текст'};
  const render=item=>renderToStaticMarkup(createElement(IconDetailPage,{icon:item,icons:[item]}));
  const html=render(icon);
  assert.match(html,/<details class="icon-more-details"><summary>Подробнее об иконе<\/summary>/u);
  assert.ok(html.indexOf('Основное описание')<html.indexOf('<details'));
  assert.ok(html.includes('Первый абзац\n\nВторой &lt;script&gt;alert(1)&lt;/script&gt; &amp; текст'));
  assert.doesNotMatch(html,/<details[^>]*\bopen\b|<script>alert/u);
  for(const moreDetails of [undefined,null,'','  \r\n\t','\u00a0','\ufeff','\u2003']) assert.doesNotMatch(render({...icon,moreDetails}),/<details class="icon-more-details"/u);
  const card=renderToStaticMarkup(createElement(IconCard,{icon}));
  assert.doesNotMatch(card,/Первый абзац|icon-more-details/u);
});
