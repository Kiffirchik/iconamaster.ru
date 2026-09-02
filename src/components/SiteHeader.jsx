import { Component, createRef } from 'react';

const workshopNavigation = [
  ['Экскурсии по мастерской', '/excursions'],
  ['Мерная икона', '/measure-icon'],
  ['Киоты и резьба', '/kiots'],
  ['Оклады на иконы', '/oklads'],
  ['Иконостасы', '/iconostases'],
  ['Расчистка росписей', '/raschistka-hramovyh-rospisey']
];

export class SiteHeader extends Component {
  state = { isOpen: false };

  menuButtonRef = createRef();
  workshopRef = createRef();
  workshopSummaryRef = createRef();
  mediaQuery = null;

  componentDidMount() {
    window.addEventListener('keydown', this.handleKeyDown);
    this.mediaQuery = window.matchMedia('(min-width: 1009px)');
    this.mediaQuery.addEventListener('change', this.handleMediaChange);
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.mediaQuery?.removeEventListener('change', this.handleMediaChange);
  }

  focusMainContent = () => {
    const focus = () => {
      const main = document.getElementById('main-content');
      main?.setAttribute?.('tabindex', '-1');
      main?.focus?.({ preventScroll: true });
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focus);
    } else {
      focus();
    }
  };

  closeDisclosures = ({ restoreController = true } = {}) => {
    const workshop = this.workshopRef.current;
    const activeElement = typeof document === 'undefined' ? null : document.activeElement;

    if (restoreController) {
      if (this.state.isOpen) {
        this.menuButtonRef.current?.focus();
      } else if (workshop?.open && workshop.contains(activeElement)) {
        (this.workshopSummaryRef.current ?? workshop.querySelector('summary'))?.focus();
      }
    }

    if (workshop) workshop.open = false;
    if (this.state.isOpen) this.setState({ isOpen: false });
  };

  handleKeyDown = (event) => {
    if (event.key === 'Escape') this.closeDisclosures();
  };

  handleMediaChange = (event) => {
    if (event.matches) this.closeDisclosures();
  };

  toggleMenu = () => {
    if (this.state.isOpen) {
      this.closeDisclosures();
      return;
    }
    this.setState({ isOpen: true });
  };

  follow = (event, path) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.closeDisclosures();
    this.props.onNavigate?.(path);
    this.focusMainContent();
  };

  render() {
    const { isOpen } = this.state;
    return (
      <header className="site-header">
        <div className="site-header__inner">
          <a className="site-header__brand" href="/" onClick={(event) => this.follow(event, '/')}>
            Московская иконописная мастерская
          </a>
          <button
            ref={this.menuButtonRef}
            className="site-header__menu-button"
            type="button"
            aria-expanded={isOpen}
            aria-controls="site-navigation"
            onClick={this.toggleMenu}
          >
            {isOpen ? 'Закрыть' : 'Меню'}
          </button>
          <nav id="site-navigation" className={`site-header__nav${isOpen ? ' is-open' : ''}`} aria-label="Основная навигация">
            {[
              ['Главная', '/'],
              ['Иконы в наличии', '/collection']
            ].map(([label, path]) => (
              <a key={path + label} href={path} onClick={(event) => this.follow(event, path)}>
                {label}
              </a>
            ))}
            <details className="site-header__workshop" ref={this.workshopRef}>
              <summary ref={this.workshopSummaryRef}>Мастерская</summary>
              <div className="site-header__workshop-links">
                {workshopNavigation.map(([label, path]) => (
                  <a key={path} href={path} onClick={(event) => this.follow(event, path)}>{label}</a>
                ))}
              </div>
            </details>
            {[
              ['Реставрация', '/restoration'],
              ['Статьи', '/articles'],
              ['Видео', '/video'],
              ['Контакты', '/contacts']
            ].map(([label, path]) => (
              <a key={path} href={path} onClick={(event) => this.follow(event, path)}>{label}</a>
            ))}
          </nav>
        </div>
      </header>
    );
  }
}
