import { IconCard } from '../components/IconCard.jsx';
import { IconImage } from '../components/IconImage.jsx';
import { publishedIcons } from '../content/schema.js';
import { homeContent } from '../data/home-content.js';

const passportLabels = [
  ['Происхождение', 'origin'],
  ['Датировка', 'period'],
  ['Техника', 'technique'],
  ['Состояние', 'condition'],
  ['Экспертное заключение', 'expertise']
];

export function HomePage({ icons = [], onNavigate }) {
  const catalogIcons = publishedIcons({ icons });
  const heroIcon = catalogIcons.find((icon) => icon.slug === 'archangel-michael') ?? catalogIcons[0] ?? null;
  const featuredIcons = homeContent.featuredSlugs
    .map((slug) => catalogIcons.find((icon) => icon.slug === slug))
    .filter(Boolean);

  function follow(event, path) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.(path);
  }

  return (
    <main id="main-content" className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        {heroIcon ? (
          <IconImage image={heroIcon.images[0]} title={heroIcon.title} mode="full" eager>
            {(renderedImage) => (
              <div
                className="home-hero__image-wrap"
                style={{ aspectRatio: `${heroIcon.images[0].width} / ${heroIcon.images[0].height}` }}
              >
                {renderedImage}
              </div>
            )}
          </IconImage>
        ) : null}
        <div className="home-hero__content">
          <p className="eyebrow">{homeContent.eyebrow}</p>
          <h1 id="home-title">{homeContent.headline}</h1>
          <p className="home-hero__intro">{homeContent.materials}</p>
          <div className="home-hero__actions">
            <a className="button button--primary" href="/collection" onClick={(event) => follow(event, '/collection')}>Открыть коллекцию</a>
            <a className="button button--quiet" href="/contacts" onClick={(event) => follow(event, '/contacts')}>Назначить личный просмотр</a>
          </div>
          {heroIcon ? <dl className="object-passport">
            {passportLabels.filter(([, key]) => String(heroIcon[key] || '').trim()).map(([label, key]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{heroIcon[key]}</dd>
              </div>
            ))}
          </dl> : null}
          <p className="home-hero__trust">Мастерская работает с {homeContent.established} года</p>
        </div>
      </section>

      <section className="home-section home-featured" aria-labelledby="featured-title">
        <div className="home-section__heading">
          <p className="eyebrow">Избранные произведения</p>
          <h2 id="featured-title">Новые поступления</h2>
          <a href="/collection" onClick={(event) => follow(event, '/collection')}>Смотреть коллекцию</a>
        </div>
        <div className="home-featured__grid">
          {featuredIcons.map((icon) => <IconCard key={icon.slug} icon={icon} onNavigate={onNavigate} />)}
        </div>
      </section>

      <section id="atelier" className="home-section home-copy-section" aria-labelledby="atelier-title">
        <p className="eyebrow">Традиционная технология</p>
        <h2 id="atelier-title">{homeContent.atelier.title}</h2>
        <p>{homeContent.atelier.text}</p>
      </section>

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
