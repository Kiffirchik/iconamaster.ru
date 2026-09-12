import { ConsultationLinks } from '../components/ConsultationLinks.jsx';
import { IconPrice } from '../components/IconPrice.jsx';
import { IconMoreDetails } from '../components/IconMoreDetails.jsx';
import { IconGallery } from '../components/IconGallery.jsx';
import { IconPassport } from '../components/IconPassport.jsx';
import { publishedIcons } from '../content/schema.js';
import { getIconDisplayValue, getNextIcon } from '../lib/catalog.js';

export function IconDetailPage({ icon, icons, onNavigate }) {
  if (!icon) {
    return (
      <main id="main-content" className="baseline-page not-found-page">
        <h1>Икона не найдена</h1>
        <p>Запрошенная икона отсутствует в текущей коллекции.</p>
        <a href="/collection" onClick={(event) => { event.preventDefault(); onNavigate('/collection'); }}>
          В коллекцию
        </a>
      </main>
    );
  }

  const catalogIcons = publishedIcons({ icons });
  const nextIcon = catalogIcons.length > 0 ? getNextIcon(catalogIcons, icon.slug) : null;
  const eyebrow = [icon.purpose, icon.period]
    .map(getIconDisplayValue)
    .filter(Boolean)
    .join(' · ');

  function navigateTo(event, path) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.(path);
  }

  return (
    <main id="main-content" className="icon-detail-page">
      <div className="icon-detail-page__layout">
        <div className="icon-detail-page__hero">
          <div data-live-slot={`icon-detail:${icon.slug}`}>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{icon.title}</h1>
          <IconPrice icon={icon} className="icon-detail-page__price" />
          <p className="icon-detail-page__availability">{getIconDisplayValue(icon.availability) || 'Наличие уточняется'}</p>
          </div>
          <ConsultationLinks iconTitle={icon.title} primaryLabel="Задать вопрос об иконе" />
        </div>
        <IconGallery images={icon.images ?? []} title={icon.title} />
        <article className="icon-detail-page__content">
          <div data-live-slot={`icon-description:${icon.slug}`}>
            {getIconDisplayValue(icon.description) ? <p className="icon-detail-page__description">{icon.description}</p> : null}
            <IconMoreDetails key={icon.slug} text={icon.moreDetails} />
          </div>
          <IconPassport icon={icon} headingId="passport-title" />

          <nav className="icon-detail-page__navigation" aria-label="Навигация по коллекции" data-live-slot={`icon-navigation:${icon.slug}`}>
            <a href="/collection" onClick={(event) => navigateTo(event, '/collection')}>← В каталог</a>
            {nextIcon ? <a href={`/icons/${nextIcon.slug}`} onClick={(event) => navigateTo(event, `/icons/${nextIcon.slug}`)}>
              Следующая икона →
            </a> : null}
          </nav>

          <section className="icon-detail-page__consultation" aria-labelledby="consultation-title">
            <h2 id="consultation-title">Консультация и личный просмотр</h2>
            <p>Уточним состояние, историю предмета и удобное время для знакомства с иконой.</p>
            <ConsultationLinks iconTitle={icon.title} includeViewing />
          </section>
        </article>
      </div>
    </main>
  );
}
