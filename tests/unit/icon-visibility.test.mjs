import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';

test('client routes never display hidden icon details, while collection and home omit them', async context => {
  const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
  context.after(()=>server.close());
  const {renderReadyRoute}=await server.ssrLoadModule('/src/App.jsx');
  const hidden={slug:'archangel-michael',title:'Hidden title',description:'Hidden description',published:false,
    images:[{src:'/hidden-original.jpg',width:100,height:120}],order:0};
  const bundle={icons:[hidden],articles:[]};
  for(const route of [{name:'icon',slug:hidden.slug},{name:'collection'},{name:'home'}]){
    const html=renderToStaticMarkup(renderReadyRoute(route,bundle,()=>{}));
    assert.doesNotMatch(html,/Hidden title|Hidden description|hidden-original.jpg/);
    if(route.name==='icon')assert.match(html,/Икона не найдена/);
  }
});
