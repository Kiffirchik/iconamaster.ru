import { useEffect, useState } from 'react';
import { SiteFooter } from './components/SiteFooter.jsx';
import { SiteHeader } from './components/SiteHeader.jsx';
import { icons } from './data/icons.js';
import { findIconBySlug } from './lib/catalog.js';
import { navigate, parseRoute } from './lib/routing.js';
import { CollectionPage } from './pages/CollectionPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { IconDetailPage } from './pages/IconDetailPage.jsx';

function getRoute() {
  return parseRoute(window.location.pathname);
}

export function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const updateRoute = () => setRoute(getRoute());
    window.addEventListener('popstate', updateRoute);
    return () => window.removeEventListener('popstate', updateRoute);
  }, []);

  let page;
  if (route.name === 'home') {
    page = <HomePage onNavigate={navigate} />;
  } else if (route.name === 'collection') {
    page = <CollectionPage onNavigate={navigate} />;
  } else if (route.name === 'icon') {
    page = <IconDetailPage icon={findIconBySlug(icons, route.slug)} onNavigate={navigate} />;
  } else {
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
