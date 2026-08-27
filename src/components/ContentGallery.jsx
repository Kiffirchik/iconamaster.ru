import { useState } from 'react';

export function ContentGallery({ images = [], single = false }) {
  const [failedSources, setFailedSources] = useState(() => new Set());
  const visibleImages = images.filter((image) => image?.src && !failedSources.has(image.src));

  if (visibleImages.length === 0) return null;

  function removeFailedImage(src) {
    setFailedSources((current) => new Set([...current, src]));
  }

  return (
    <div className={`content-gallery${single ? ' content-gallery--single' : ''}`}>
      {visibleImages.map((image, index) => (
        <figure className="content-gallery__item" key={`${image.src}-${index}`}>
          <img
            src={image.src}
            alt={image.alt || ''}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            onError={() => removeFailedImage(image.src)}
          />
          {image.caption ? <figcaption>{image.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}
