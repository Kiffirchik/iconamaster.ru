import { FailureAwareImage } from './FailureAwareImage.jsx';

export function IconImage({ image, title, mode = 'preview', eager = false, onError, children }) {
  return (
    <FailureAwareImage
      image={image}
      alt={image.alt || title}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      className={`icon-image icon-image--${mode}`}
      onError={onError}
      style={{
        aspectRatio: `${image.width} / ${image.height}`,
        objectFit: mode === 'full' ? 'contain' : image.fit,
        objectPosition: image.position
      }}
    >
      {children}
    </FailureAwareImage>
  );
}
