import { IconGallery } from '../components/IconGallery.jsx';
import { getNextIcon } from '../lib/catalog.js';
import { buildContactLinks } from '../lib/contacts.js';

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

  const consultation = buildContactLinks(icon.title);
  const viewing = buildContactLinks(icon.title, 'viewing');
  const nextIcon = getNextIcon(icons, icon.slug);

  function navigateTo(event, path) {
    event.preventDefault();
    onNavigate(path);
  }

  return (
    <main id="main-content" className="icon-detail-page">
      <div className="icon-detail-page__layout">
        <IconGallery images={icon.images} title={icon.title} />
        <article className="icon-detail-page__content">
          <p className="eyebrow">{icon.type} · {icon.period}</p>
          <h1>{icon.title}</h1>
          <p className="icon-detail-page__price">{icon.price}</p>
          <p className="icon-detail-page__description">{icon.description}</p>

          <section aria-labelledby="passport-title">
            <h2 id="passport-title">Паспорт предмета</h2>
            <dl className="object-passport">
              {passportFields.map(([label, key]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{icon[key]}</dd>
                </div>
              ))}
            </dl>
          </section>

          <nav className="icon-detail-page__navigation" aria-label="Навигация по коллекции">
            <a href="/collection" onClick={(event) => navigateTo(event, '/collection')}>← В коллекцию</a>
            <a href={`/icons/${nextIcon.slug}`} onClick={(event) => navigateTo(event, `/icons/${nextIcon.slug}`)}>
              Следующая икона →
            </a>
          </nav>

          <section className="icon-detail-page__consultation" aria-labelledby="consultation-title">
            <h2 id="consultation-title">Консультация и личный просмотр</h2>
            <p>Уточним состояние, историю предмета и удобное время для знакомства с иконой.</p>
            <div className="icon-detail-page__actions">
              <a className="button button--primary" href={consultation.whatsapp} target="_blank" rel="noreferrer">
                Получить консультацию об иконе
              </a>
              <a className="button button--quiet" href={viewing.whatsapp} target="_blank" rel="noreferrer">
                Назначить личный просмотр
              </a>
            </div>
            <div className="icon-detail-page__contact-alternatives">
              <a href={consultation.phone}>Позвонить: +7 916 655-45-95</a>
              <a href={consultation.email}>Написать на email</a>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
