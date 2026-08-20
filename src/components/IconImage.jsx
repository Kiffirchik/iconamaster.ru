export function IconImage({ image, title, mode = 'preview', eager = false }) {
  return (
    <img
      src={image.src}
      alt={image.alt || title}
      width={image.width}
      height={image.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      className={`icon-image icon-image--${mode}`}
      style={{ objectFit: mode === 'full' ? 'contain' : image.fit, objectPosition: image.position }}
    />
  );
}
