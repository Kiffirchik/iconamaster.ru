import { Component, createRef, useState } from 'react';
import { IconCard } from '../components/IconCard.jsx';
import { CatalogFilters } from '../components/CatalogFilters.jsx';
import { FailureAwareImage } from '../components/FailureAwareImage.jsx';
import { filterIcons, getHomeCatalogIcons } from '../lib/catalog.js';
import { homeContent } from '../data/home-content.js';

export class HomeIconGallery extends Component {
  state = { activeIndex: 0, endIndex: 0, pageSize: 1, atStart: true, atEnd: false };
  trackRef = createRef();

  componentDidMount() {
    this.syncActiveCard();
    if (typeof ResizeObserver !== 'undefined' && this.trackRef.current) {
      this.resizeObserver = new ResizeObserver(this.syncActiveCard);
      this.resizeObserver.observe(this.trackRef.current);
    }
    if (typeof MutationObserver !== 'undefined' && this.trackRef.current) {
      this.cardObserver = new MutationObserver(this.syncActiveCard);
      this.cardObserver.observe(this.trackRef.current, { childList: true });
    }
  }

  componentWillUnmount() {
    this.resizeObserver?.disconnect();
    this.cardObserver?.disconnect();
  }

  syncActiveCard = () => {
    const track = this.trackRef.current;
    if (!track) return;
    const rects = [...track.children].map((card) => card.getBoundingClientRect());
    if (!rects.length) {
      this.setState({ activeIndex: 0, endIndex: 0, itemCount: 0, atStart: true, atEnd: true });
      return;
    }
    const left = track.getBoundingClientRect().left;
    const right = left + track.clientWidth;
    let activeIndex = 0;
    let distance = Infinity;
    const fullyVisible = [];
    rects.forEach((rect, index) => {
      if (rect.left >= left - 1 && rect.right <= right + 1) fullyVisible.push(index);
      const nextDistance = Math.abs(rect.left - left);
      if (nextDistance < distance) {
        distance = nextDistance;
        activeIndex = index;
      }
    });
    if (fullyVisible.length) activeIndex = fullyVisible[0];
    const step = rects.length > 1 ? rects[1].left - rects[0].left : rects[0].width;
    const gap = Math.max(0, step - rects[0].width);
    const nextState = {
      activeIndex,
      endIndex: fullyVisible.length ? fullyVisible.at(-1) : activeIndex,
      pageSize: Math.max(1, Math.floor((track.clientWidth + gap) / Math.max(1, step))),
      itemCount: rects.length,
      atStart: track.scrollLeft <= 1,
      atEnd: track.scrollLeft >= track.scrollWidth - track.clientWidth - 1,
    };
    if (Object.keys(nextState).some((key) => nextState[key] !== this.state[key])) this.setState(nextState);
  };

  movePage = (direction) => this.goTo(this.state.activeIndex + direction * this.state.pageSize);

  goTo = (index) => {
    const track = this.trackRef.current;
    if (!track?.children.length) return;
    const next = Math.max(0, Math.min(index, track.children.length - 1));
    const left = track.scrollLeft + track.children[next].getBoundingClientRect().left - track.getBoundingClientRect().left;
    // CSS owns smooth scrolling and respects the user's reduced-motion preference.
    track.scrollTo({ left, behavior: 'auto' });
  };

  handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    const destinations = {
      ArrowLeft: this.state.activeIndex - 1,
      ArrowRight: this.state.activeIndex + 1,
      Home: 0,
      End: this.props.icons.length - 1,
    };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    this.goTo(destinations[event.key]);
  };

  render() {
    const { icons, onNavigate } = this.props;
    const { activeIndex, endIndex, atStart, atEnd } = this.state;
    const itemCount = this.state.itemCount ?? icons.length;
    if (!icons.length) return null;
    return (
      <>
        <div id="home-sale-gallery" className="home-sale__grid" ref={this.trackRef}
          role="group" aria-label="Иконы в подборке" tabIndex={icons.length > 1 ? 0 : undefined}
          onScroll={this.syncActiveCard} onKeyDown={this.handleKeyDown}>
          {icons.map((icon, index) => <IconCard key={icon.slug} icon={icon} onNavigate={onNavigate} eager={index < 4} />)}
        </div>
        {itemCount > 1 && (
          <div className="home-sale__controls">
            <button type="button" aria-label="Предыдущая икона" aria-controls="home-sale-gallery"
              disabled={atStart} onClick={() => this.movePage(-1)}>←</button>
            <span role="status" aria-label="Положение в подборке">{`${activeIndex === endIndex ? activeIndex + 1 : `${activeIndex + 1}–${endIndex + 1}`} из ${itemCount}`}</span>
            <button type="button" aria-label="Следующая икона" aria-controls="home-sale-gallery"
              disabled={atEnd} onClick={() => this.movePage(1)}>→</button>
          </div>
        )}
      </>
    );
  }
}

const homeDefaultFilters = { subject: 'all', availability: 'В наличии' };

export function HomePage({ icons = [], articles = [], onNavigate }) {
  const [filters, setFilters] = useState(homeDefaultFilters);
  const catalogIcons = getHomeCatalogIcons(icons, homeContent.saleSlugs);
  const filteredIcons = filterIcons(catalogIcons, filters);
  const featuredArticles = homeContent.featuredArticleSlugs
    .map((slug) => articles.find((article) => article.slug === slug && article.published !== false))
    .filter(Boolean);

  function follow(event, path) {
    if (!onNavigate || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.(path);
  }

  return (
    <main id="main-content" className="home-page">
      <section className="home-shop-intro" aria-labelledby="home-title">
        <p className="eyebrow">{homeContent.eyebrow}</p>
        <h1 id="home-title">{homeContent.headline}</h1>
        <p>
          {homeContent.intro}
          <a className="home-shop-intro__materials-link" href="/articles/icon-painting-pigments" onClick={(event) => follow(event, '/articles/icon-painting-pigments')}>
            Как мы готовим краски для икон →
          </a>
        </p>
      </section>

      <section className="home-sale" aria-labelledby="sale-title">
        <div className="home-sale__heading">
          <h2 id="sale-title">Каталог мастерской</h2>
          <a href="/collection" onClick={(event) => follow(event, '/collection')}>Все иконы →</a>
        </div>
        <CatalogFilters items={catalogIcons} filters={filters} defaultFilters={homeDefaultFilters} fields={['subject', 'availability']} idPrefix="home" showDiscounts={false}
          onChange={(next) => setFilters((current) => ({ ...current, ...next }))} onReset={() => setFilters(homeDefaultFilters)} />
        <p className="catalog-result-count" role="status">Найдено: {filteredIcons.length}</p>
        {filteredIcons.length ? (
          <HomeIconGallery key={`${filters.subject}|${filters.availability}|${filteredIcons.map((icon) => icon.slug).join('|')}`} icons={filteredIcons} onNavigate={onNavigate} />
        ) : (
          <div className="collection-empty">
            <p>{catalogIcons.length ? 'По выбранным фильтрам работ не найдено. Попробуйте выбрать «Все работы» или другой образ.' : 'Сейчас в каталоге нет доступных работ.'}</p>
            <button type="button" onClick={() => setFilters({ subject: 'all', availability: 'all' })}>Показать все работы</button>
            <a href="/collection" onClick={(event) => follow(event, '/collection')}>Посмотреть полный каталог</a>
          </div>
        )}
        <div className="home-sale__footer">
          <p>Все работы в виде сетки — в полном каталоге.</p>
          <a className="button button--quiet" href="/collection" onClick={(event) => follow(event, '/collection')}>Перейти в каталог</a>
        </div>
      </section>

      <section id="atelier" className="home-section home-workshop" aria-labelledby="atelier-title">
        <div>
          <p className="eyebrow">История и ремесло</p>
          <h2 id="atelier-title">{homeContent.atelier.title}</h2>
        </div>
        <div className="home-workshop__text">
          <p>{homeContent.atelier.text}</p>
          <p>{homeContent.atelier.history}</p>
        </div>
      </section>

      <section className="home-section home-blessing" aria-labelledby="blessing-title">
        <a className="home-blessing__image" href={homeContent.blessing.image} target="_blank" rel="noopener noreferrer" aria-label="Открыть полный снимок Патриаршей грамоты (новая вкладка)">
          <img src={homeContent.blessing.image} alt="Патриаршая грамота коллективу Московской иконописной мастерской, 14 мая 2007 года" width="1007" height="1600" loading="lazy" />
        </a>
        <div>
          <p className="eyebrow">14 мая 2007 года</p>
          <h2 id="blessing-title">{homeContent.blessing.title}</h2>
          <p>{homeContent.blessing.text}</p>
          <a href={homeContent.blessing.image} target="_blank" rel="noopener noreferrer">Рассмотреть грамоту ↗</a>
        </div>
      </section>

      {featuredArticles.length ? (
        <section className="home-section home-stories" aria-labelledby="stories-title">
          <div className="home-section__heading">
            <p className="eyebrow">Работы и исследования</p>
            <h2 id="stories-title">Избранные материалы</h2>
            <a href="/articles" onClick={(event) => follow(event, '/articles')}>Все статьи</a>
          </div>
          <div className="home-stories__grid">
            {featuredArticles.map((article) => (
              <article className="home-story-card" key={article.slug}>
                <a
                  className="home-story-card__image"
                  href={`/articles/${article.slug}`}
                  onClick={(event) => follow(event, `/articles/${article.slug}`)}
                  aria-label={`Открыть материал «${article.title}»`}
                >
                  <FailureAwareImage image={article.image} />
                </a>
                <div className="home-story-card__content" data-live-slot={`article-feature:${article.slug}`}>
                  <p className="eyebrow">Материал мастерской</p>
                  <h3><a href={`/articles/${article.slug}`} onClick={(event) => follow(event, `/articles/${article.slug}`)}>{article.title}</a></h3>
                  <p>{article.summary}</p>
                  <a className="home-story-card__more" href={`/articles/${article.slug}`} onClick={(event) => follow(event, `/articles/${article.slug}`)}>Читать материал →</a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="restoration" className="home-section home-copy-section" aria-labelledby="restoration-title">
        <p className="eyebrow">Бережный подход</p>
        <h2 id="restoration-title">{homeContent.restoration.title}</h2>
        <p>{homeContent.restoration.text}</p>
      </section>

      <section id="research" className="home-section home-copy-section home-copy-section--research" aria-labelledby="research-title">
        <p className="eyebrow">Мастерская говорит о ремесле</p>
        <h2 id="research-title">{homeContent.research.title}</h2>
        <p>{homeContent.research.text}</p>
        <a className="button button--quiet" href="/articles" onClick={(event) => follow(event, '/articles')}>Открыть статьи и исследования</a>
      </section>
    </main>
  );
}
