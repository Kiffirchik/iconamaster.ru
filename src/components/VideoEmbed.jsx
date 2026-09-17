import { Component } from 'react';
import { FailureAwareImage } from './FailureAwareImage.jsx';
import { localVideoSource } from '../lib/local-video.js';

export function videoEmbedUrl(video) {
  if (!video?.id) return null;
  const id = encodeURIComponent(video.id);
  if (video.provider === 'youtube') return `https://www.youtube-nocookie.com/embed/${id}?autoplay=0`;
  if (video.provider === 'vimeo') return `https://player.vimeo.com/video/${id}?autoplay=0`;
  return null;
}

export function VideoThumbnail({ image }) {
  return <FailureAwareImage image={image} alt="" />;
}

export class VideoEmbed extends Component {
  state = { isActive: false };

  startMedia = (element) => {
    if (!element) return;
    element.focus();
    // Mounted only by the visitor's play button; native controls remain if play is blocked.
    element.play()?.catch(() => {});
  };

  render() {
    const { video } = this.props;
    const embedUrl = videoEmbedUrl(video);
    const localSource = localVideoSource(video);
    if (!embedUrl && !localSource) return null;
    const dimensions = localSource && video.width > 0 && video.height > 0
      ? { '--video-ratio': `${video.width} / ${video.height}` } : undefined;

    return (
      <section className={localSource ? 'video-embed video-embed--local' : 'video-embed'} style={dimensions} aria-label={video.title || 'Видео мастерской'}>
        {this.state.isActive ? (
          localSource ? (
            <video ref={this.startMedia} className="video-embed__native" src={localSource}
              width={video.width} height={video.height} poster={video.image?.src}
              controls playsInline preload="none" tabIndex={0} aria-label={video.title}>
              Ваш браузер не поддерживает видео. <a href={localSource}>Открыть видео</a>
            </video>
          ) : (
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
          )
        ) : (
          <button className="video-embed__trigger" type="button" onClick={() => this.setState({ isActive: true })}>
            <VideoThumbnail image={video.image} />
            <span>Смотреть видео</span>
          </button>
        )}
      </section>
    );
  }
}
