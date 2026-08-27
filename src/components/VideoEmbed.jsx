import { useState } from 'react';

export function videoEmbedUrl(video) {
  if (!video?.id) return null;
  const id = encodeURIComponent(video.id);
  if (video.provider === 'youtube') return `https://www.youtube-nocookie.com/embed/${id}?autoplay=0`;
  if (video.provider === 'vimeo') return `https://player.vimeo.com/video/${id}?autoplay=0`;
  return null;
}

export function VideoEmbed({ video }) {
  const [isActive, setIsActive] = useState(false);
  const embedUrl = videoEmbedUrl(video);

  if (!embedUrl) return null;

  return (
    <section className="video-embed" aria-label={video.title || 'Видео мастерской'}>
      {isActive ? (
        <div className="video-embed__frame">
          <iframe
            src={embedUrl}
            title={video.title || 'Видео мастерской'}
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <button className="video-embed__trigger" type="button" onClick={() => setIsActive(true)}>
          {video.image?.src ? (
            <img
              src={video.image.src}
              alt=""
              width={video.image.width}
              height={video.image.height}
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <span>Смотреть видео</span>
        </button>
      )}
    </section>
  );
}
