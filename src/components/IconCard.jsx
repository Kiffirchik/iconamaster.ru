import { Component } from 'react';
import { IconImage } from './IconImage.jsx';

export class IconCard extends Component {
  state = { failedSources: new Set() };

  handleImageError = (_event, failedSource) => {
    if (!failedSource) return;
    this.setState(({ failedSources }) => ({
      failedSources: new Set([...failedSources, failedSource])
    }));
  };

  follow = (event) => {
    const { icon, onNavigate } = this.props;
    if (!onNavigate || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(`/icons/${icon.slug}`);
  };

  render() {
    const { icon } = this.props;
    const image = (icon.images ?? []).find((candidate) => (
      candidate?.src && !this.state.failedSources.has(candidate.src)
    ));
    if (!image) return null;

    const path = `/icons/${icon.slug}`;
    const title = String(icon.title || '').trim();
    const period = String(icon.period || '').trim();
    const technique = String(icon.technique || '').trim();
    const size = String(icon.size || '').trim();
    const price = String(icon.price || '').trim() || 'Цена по запросу';
    const availability = String(icon.availability || '').trim();

    return (
      <article className="icon-card">
        <IconImage image={image} title={title} onError={this.handleImageError}>
          {(renderedImage) => (
            <a className="icon-card__image-link" href={path} onClick={this.follow}>
              <span className="icon-card__image-frame" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
                {renderedImage}
              </span>
            </a>
          )}
        </IconImage>
        <div className="icon-card__content">
          {period ? <p className="icon-card__period">{period}</p> : null}
          {title ? <h3><a href={path} onClick={this.follow}>{title}</a></h3> : null}
          {technique ? <p>{technique}</p> : null}
          {size ? <p>{size}</p> : null}
          <p className="icon-card__price">{price}{availability ? ` · ${availability}` : ''}</p>
          <a className="icon-card__more" href={path} onClick={this.follow}>Подробнее</a>
        </div>
      </article>
    );
  }
}
