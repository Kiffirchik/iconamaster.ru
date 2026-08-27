import { useState } from 'react';
import { FailureAwareImage } from './FailureAwareImage.jsx';

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
        <FailureAwareImage
          image={image}
          key={`${image.src}-${index}`}
          onError={() => removeFailedImage(image.src)}
        >
          {(renderedImage) => (
            <figure className="content-gallery__item">
              {renderedImage}
              {image.caption ? <figcaption>{image.caption}</figcaption> : null}
            </figure>
          )}
        </FailureAwareImage>
      ))}
    </div>
  );
}
