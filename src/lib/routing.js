export function parseRoute(pathname) {
  const path = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (path === '') return { name: 'home' };
  if (path === '/collection') return { name: 'collection' };

  const iconMatch = path.match(/^\/icons\/([^/]+)$/);
  if (iconMatch) return { name: 'icon', slug: iconMatch[1] };

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
