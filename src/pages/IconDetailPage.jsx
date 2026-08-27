import { ConsultationLinks } from '../components/ConsultationLinks.jsx';
import { IconGallery } from '../components/IconGallery.jsx';
import { publishedIcons } from '../content/schema.js';
import { getNextIcon } from '../lib/catalog.js';

const passportFields = [
  ['Датировка', 'period'],
  ['Происхождение', 'origin'],
  ['Техника', 'technique'],
  ['Размер', 'size'],
  ['Состояние', 'condition'],
  ['Реставрация', 'expertise']
];

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
  const visiblePassportFields = passportFields.filter(([, key]) => String(icon[key] || '').trim());
  const eyebrow = [icon.type, icon.period]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' · ');
  const price = String(icon.price || '').trim() || 'Цена по запросу';

  function navigateTo(event, path) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.(path);
  }

  return (
    <main id="main-content" className="icon-detail-page">
      <div className="icon-detail-page__layout">
        <IconGallery images={icon.images ?? []} title={icon.title} />
        <article className="icon-detail-page__content">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{icon.title}</h1>
          <p className="icon-detail-page__price">{price}</p>
          {String(icon.description || '').trim() ? <p className="icon-detail-page__description">{icon.description}</p> : null}

          {visiblePassportFields.length > 0 ? <section aria-labelledby="passport-title">
            <h2 id="passport-title">Паспорт предмета</h2>
            <dl className="object-passport">
              {visiblePassportFields.map(([label, key]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{icon[key]}</dd>
                </div>
              ))}
            </dl>
          </section> : null}

          <nav className="icon-detail-page__navigation" aria-label="Навигация по коллекции">
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
