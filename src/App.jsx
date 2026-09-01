import { useEffect, useState } from 'react';
import { SiteFooter } from './components/SiteFooter.jsx';
import { SiteHeader } from './components/SiteHeader.jsx';
import { ContentProvider, useContent } from './content/ContentProvider.jsx';
import { findIconBySlug } from './lib/catalog.js';
import { selectBySlug } from './lib/content-selectors.js';
import { navigate, parseRoute } from './lib/routing.js';
import { ArticlePage } from './pages/ArticlePage.jsx';
import { ArticlesPage } from './pages/ArticlesPage.jsx';
import { CollectionPage } from './pages/CollectionPage.jsx';
import { ContactsPage } from './pages/ContactsPage.jsx';
import { ContentPage } from './pages/ContentPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { IconDetailPage } from './pages/IconDetailPage.jsx';
import { VideoPage } from './pages/VideoPage.jsx';

function getRoute(aliases) {
  return parseRoute(window.location.pathname, aliases);
}

export function NotFoundPage({ onNavigate }) {
  return (
    <main id="main-content" className="baseline-page not-found-page">
      <h1>Страница не найдена</h1>
      <p>Запрошенный раздел не существует.</p>
      <a href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }}>
        На главную
      </a>
    </main>
  );
}

export function renderReadyRoute(route, bundle, onNavigate) {
  if (route.name === 'home') return <HomePage icons={bundle.icons} articles={bundle.articles} onNavigate={onNavigate} />;
  if (route.name === 'collection') return <CollectionPage icons={bundle.icons} onNavigate={onNavigate} />;
  if (route.name === 'icon') {
    return <IconDetailPage icon={findIconBySlug(bundle.icons, route.slug)} icons={bundle.icons} onNavigate={onNavigate} />;
  }
  if (route.name === 'page') {
    const page = selectBySlug(bundle.pages, route.slug);
    return page ? <ContentPage page={page} /> : <NotFoundPage onNavigate={onNavigate} />;
  }
  if (route.name === 'articles') return <ArticlesPage articles={bundle.articles} onNavigate={onNavigate} />;
  if (route.name === 'article') {
    const article = selectBySlug(bundle.articles, route.slug);
    return article ? <ArticlePage article={article} onNavigate={onNavigate} /> : <NotFoundPage onNavigate={onNavigate} />;
  }
  if (route.name === 'video') return <VideoPage videos={bundle.videos} />;
  if (route.name === 'contacts') return <ContactsPage contacts={bundle.contacts} />;
  return <NotFoundPage onNavigate={onNavigate} />;
}

function AppContent() {
  const [route, setRoute] = useState(getRoute);
  const { status, bundle, error, retry } = useContent();

  useEffect(() => {
    const updateRoute = () => setRoute(getRoute(bundle?.aliases));
    updateRoute();
    window.addEventListener('popstate', updateRoute);
    return () => window.removeEventListener('popstate', updateRoute);
  }, [bundle?.aliases]);

  return (
    <AppView
      status={status}
      bundle={bundle}
      error={error}
      retry={retry}
      route={route}
      onNavigate={navigate}
    />
  );
}

export function AppView({ status, bundle, error, retry, route, onNavigate }) {
  let page = (
    <main id="main-content" className="baseline-page" role="status">
      <p>Загружаем коллекцию…</p>
    </main>
  );
  if (status === 'error') {
    page = (
      <main id="main-content" className="baseline-page">
        <h1>Не удалось загрузить коллекцию</h1>
        <p>{error?.message}</p>
        <button type="button" className="button button--quiet" onClick={retry}>Повторить</button>
      </main>
    );
  } else if (status === 'ready') {
    page = renderReadyRoute(route, bundle, onNavigate);
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Перейти к содержанию</a>
      <SiteHeader onNavigate={onNavigate} />
      {page}
      <SiteFooter onNavigate={onNavigate} />
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
