function follow(event, path, onNavigate) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onNavigate(path);
}

export function ArticlesPage({ articles = [], onNavigate }) {
  const publishedArticles = articles.filter((article) => article?.published !== false);

  return (
    <main id="main-content" className="articles-page editorial-index-page">
      <header className="editorial-page__header">
        <p className="eyebrow">Исследования и традиция</p>
        <h1>Статьи</h1>
        <p className="editorial-page__intro">Материалы мастерской об иконописи, памятниках и художественных центрах.</p>
      </header>
      {publishedArticles.length > 0 ? (
        <div className="article-index">
          {publishedArticles.map((article) => {
            const image = article.image || article.cover;
            return (
              <article className="article-card" key={article.slug}>
                {image?.src ? (
                  <img src={image.src} alt={image.alt || ''} width={image.width} height={image.height} loading="lazy" decoding="async" />
                ) : null}
                <div className="article-card__content">
                  <h2><a href={`/articles/${article.slug}`} onClick={(event) => follow(event, `/articles/${article.slug}`, onNavigate)}>{article.title}</a></h2>
                  {article.summary || article.intro || article.excerpt ? <p>{article.summary || article.intro || article.excerpt}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="editorial-empty" role="status">Материалы готовятся к публикации.</p>
      )}
    </main>
  );
}
