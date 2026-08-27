import { useEffect, useState } from 'react';

const workshopNavigation = [
  ['Экскурсии по мастерской', '/excursions'],
  ['Мерная икона', '/measure-icon'],
  ['Киоты и резьба', '/kiots'],
  ['Оклады на иконы', '/oklads'],
  ['Иконостасы', '/iconostases']
];

export function SiteHeader({ onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const mediaQuery = window.matchMedia('(min-width: 1009px)');
    const closeOnDesktop = (event) => {
      if (event.matches) setIsOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    mediaQuery.addEventListener('change', closeOnDesktop);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      mediaQuery.removeEventListener('change', closeOnDesktop);
    };
  }, []);

  function follow(event, path) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    onNavigate?.(path);
    setIsOpen(false);
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="/" onClick={(event) => follow(event, '/')}>
          Московская иконописная мастерская
        </a>
        <button
          className="site-header__menu-button"
          type="button"
          aria-expanded={isOpen}
          aria-controls="site-navigation"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? 'Закрыть' : 'Меню'}
        </button>
        <nav id="site-navigation" className={`site-header__nav${isOpen ? ' is-open' : ''}`} aria-label="Основная навигация">
          {[
            ['Главная', '/'],
            ['Иконы в наличии', '/collection']
          ].map(([label, path]) => (
            <a key={path + label} href={path} onClick={(event) => follow(event, path)}>
              {label}
            </a>
          ))}
          <details className="site-header__workshop">
            <summary>Мастерская</summary>
            <div className="site-header__workshop-links">
              {workshopNavigation.map(([label, path]) => (
                <a key={path} href={path} onClick={(event) => follow(event, path)}>{label}</a>
              ))}
            </div>
          </details>
          {[
            ['Реставрация', '/restoration'],
            ['Статьи', '/articles'],
            ['Видео', '/video'],
            ['Контакты', '/contacts']
          ].map(([label, path]) => (
            <a key={path} href={path} onClick={(event) => follow(event, path)}>{label}</a>
          ))}
        </nav>
      </div>
    </header>
  );
}
