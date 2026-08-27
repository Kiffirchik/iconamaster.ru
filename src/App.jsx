import { useEffect, useState } from 'react';
import { SiteFooter } from './components/SiteFooter.jsx';
import { SiteHeader } from './components/SiteHeader.jsx';
import { ContentProvider, useContent } from './content/ContentProvider.jsx';
import { findIconBySlug } from './lib/catalog.js';
import { navigate, parseRoute } from './lib/routing.js';
import { CollectionPage } from './pages/CollectionPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { IconDetailPage } from './pages/IconDetailPage.jsx';

function getRoute() {
  return parseRoute(window.location.pathname);
}

function AppContent() {
  const [route, setRoute] = useState(getRoute);
  const { status, bundle, error, retry } = useContent();

  useEffect(() => {
    const updateRoute = () => setRoute(getRoute());
    window.addEventListener('popstate', updateRoute);
    return () => window.removeEventListener('popstate', updateRoute);
  }, []);

  let page = (
    <main id="main-content" className="baseline-page" role="status">
      <p>Загружаем коллекцию…</p>
    </main>
  );
  if (status === 'error') {
    page = (
      <main id="main-content" className="baseline-page">
        <h1>Не удалось загрузить коллекцию</h1>
        <p>{error.message}</p>
        <button type="button" className="button button--quiet" onClick={retry}>Повторить</button>
      </main>
    );
  } else if (status === 'ready' && route.name === 'home') {
    page = <HomePage icons={bundle.icons} onNavigate={navigate} />;
  } else if (status === 'ready' && route.name === 'collection') {
    page = <CollectionPage icons={bundle.icons} onNavigate={navigate} />;
  } else if (status === 'ready' && route.name === 'icon') {
    page = <IconDetailPage icon={findIconBySlug(bundle.icons, route.slug)} icons={bundle.icons} onNavigate={navigate} />;
  } else if (status === 'ready') {
    page = (
      <main id="main-content" className="baseline-page not-found-page">
        <h1>Страница не найдена</h1>
        <p>Запрошенный раздел не существует.</p>
        <a href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
          На главную
        </a>
      </main>
    );
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Перейти к содержанию</a>
      <SiteHeader onNavigate={navigate} />
      {page}
      <SiteFooter onNavigate={navigate} />
    </div>
  );
}

export function App() {
  return (
    <ContentProvider>
      <AppContent />
    </ContentProvider>
  );
}
