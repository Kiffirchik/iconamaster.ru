import { ConsultationLinks } from '../components/ConsultationLinks.jsx';
import { ContentSections } from '../components/ContentSections.jsx';

export function MuralCleaningPage({ page }) {
  return (
    <main id="main-content" className="content-page editorial-page mural-service-page">
      <header className="editorial-page__header">
        <p className="eyebrow">Услуга мастерской</p>
        <h1>{page.title}</h1>
        <p className="editorial-page__intro">{page.intro}</p>
      </header>
      <section className="editorial-page__consultation mural-service-page__consultation">
        <h2>Получить предварительную консультацию</h2>
        <p>Опишите состояние росписей и приложите фотографии — мастерская уточнит возможный порядок работ.</p>
        <ConsultationLinks topic="murals" />
      </section>
      <ContentSections sections={page.sections} />
      <section className="mural-service-page__related">
        <h2>Подробный материал о технологии</h2>
        <p>Посмотрите примеры расчистки, укрепления и восстановления храмовой стенописи.</p>
        <a className="button button--quiet" href={`/articles/${page.relatedArticleSlug}`}>
          Читать статью о расчистке росписей
        </a>
      </section>
      <section className="editorial-page__consultation mural-service-page__consultation">
        <h2>Обсудить расчистку росписей</h2>
        <p>Расскажите о храме и предполагаемом объёме работ, чтобы получить предварительную оценку.</p>
        <ConsultationLinks topic="murals" />
      </section>
    </main>
  );
}
