import { renderToString } from 'react-dom/server';
import { App } from './App.jsx';
import { parseRoute } from './lib/routing.js';

export function renderApp(pathname, bundle) {
  const route = parseRoute(pathname, bundle.aliases);
  return {
    route,
    html: renderToString(<App initialBundle={bundle} initialPath={pathname} />),
  };
}
