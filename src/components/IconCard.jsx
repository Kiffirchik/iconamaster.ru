import { IconImage } from './IconImage.jsx';

export function IconCard({ icon, onNavigate }) {
  const path = `/icons/${icon.slug}`;

  function follow(event) {
    if (!onNavigate || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(path);
  }

  return (
    <article className="icon-card">
      <a className="icon-card__image-link" href={path} onClick={follow}>
        <span className="icon-card__image-frame" style={{ aspectRatio: `${icon.images[0].width} / ${icon.images[0].height}` }}>
          <IconImage image={icon.images[0]} title={icon.title} />
        </span>
      </a>
      <div className="icon-card__content">
        <p className="icon-card__period">{icon.period}</p>
        <h3><a href={path} onClick={follow}>{icon.title}</a></h3>
        <p>{icon.technique}</p>
        <p>{icon.size}</p>
        <p className="icon-card__price">{icon.price} · {icon.availability}</p>
        <a className="icon-card__more" href={path} onClick={follow}>Подробнее</a>
      </div>
    </article>
  );
}
