import { ConsultationLinks } from '../components/ConsultationLinks.jsx';
import { ContentSections } from '../components/ContentSections.jsx';

export function ContentPage({ page }) {
  const introduction = page.intro || page.summary || page.description;

  return (
    <main id="main-content" className="content-page editorial-page">
      <header className="editorial-page__header">
        <p className="eyebrow">Московская иконописная мастерская</p>
        <h1>{page.title}</h1>
        {introduction ? <p className="editorial-page__intro">{introduction}</p> : null}
      </header>
      <ContentSections sections={page.sections} />
      <section className="editorial-page__consultation" aria-labelledby="page-consultation-title">
        <h2 id="page-consultation-title">Обсудить работу с мастерской</h2>
        <p>Расскажите о задаче — мастерская уточнит детали и предложит следующий шаг.</p>
        <ConsultationLinks />
      </section>
    </main>
  );
}
