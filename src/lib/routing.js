function normalizePath(pathname) {
  try {
    const decoded = decodeURI(pathname || '/');
    return decoded !== '/' && decoded.endsWith('/') ? decoded.slice(0, -1) : decoded;
  } catch {
    return null;
  }
}

export function parseRoute(pathname, aliases = {}) {
  const requestedPath = normalizePath(pathname);
  if (requestedPath === null) return { name: 'not-found' };
  const canonicalPath = aliases[requestedPath] ?? requestedPath;

  if (canonicalPath === '/') return { name: 'home' };
  if (canonicalPath === '/collection') return { name: 'collection' };
  if (canonicalPath === '/articles') return { name: 'articles' };
  if (canonicalPath === '/video') return { name: 'video' };
  if (canonicalPath === '/contacts') return { name: 'contacts' };

  const icon = canonicalPath.match(/^\/icons\/([^/]+)$/);
  if (icon) return { name: 'icon', slug: icon[1] };

  const article = canonicalPath.match(/^\/articles\/([^/]+)$/);
  if (article) return { name: 'article', slug: article[1] };

  const page = canonicalPath.match(/^\/(workshop|excursions|measure-icon|restoration|kiots|oklads|iconostases|raschistka-hramovyh-rospisey)$/);
  if (page) return { name: 'page', slug: page[1], canonicalPath };

  return { name: 'not-found' };
}

export function navigate(path) {
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));

  const hash = new URL(path, window.location.origin).hash;
  if (!hash) {
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  window.requestAnimationFrame(() => {
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  });
}
