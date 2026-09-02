import { ContentSections } from '../components/ContentSections.jsx';

export function ArticlePage({ article, onNavigate }) {
  const introduction = article.intro || article.summary || article.excerpt;

  return (
    <main id="main-content" className="article-page editorial-page">
      <article>
        <header className="editorial-page__header">
          <p className="eyebrow">Статья мастерской</p>
          <h1>{article.title}</h1>
          {introduction ? <p className="editorial-page__intro">{introduction}</p> : null}
        </header>
        <ContentSections sections={article.sections} />
        {article.sourceUrl?.startsWith('https://dzen.ru/') ? (
          <p className="editorial-page__source">
            Материал также опубликован в <a href={article.sourceUrl} target="_blank" rel="noreferrer">Дзене</a>.
          </p>
        ) : null}
        {article.slug === 'restoration-murals-cleaning' ? (
          <a className="button button--primary article-page__service-link" href="/raschistka-hramovyh-rospisey">
            Обсудить расчистку росписей
          </a>
        ) : null}
      </article>
      <a
        className="editorial-page__back-link"
        href="/articles"
        onClick={(event) => {
          if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onNavigate('/articles');
        }}
      >
        ← Все статьи
      </a>
    </main>
  );
}
