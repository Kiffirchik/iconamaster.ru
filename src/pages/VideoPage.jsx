import { VideoEmbed } from '../components/VideoEmbed.jsx';

export function VideoPage({ videos = [] }) {
  const publishedVideos = videos.filter((video) => video?.published !== false);

  return (
    <main id="main-content" className="video-page editorial-index-page">
      <header className="editorial-page__header">
        <p className="eyebrow">Мастерская в работе</p>
        <h1>Видео</h1>
        <p className="editorial-page__intro">Фильмы о мастерской, традиционной технологии и создании икон.</p>
      </header>
      {publishedVideos.length > 0 ? (
        <div className="video-list">
          {publishedVideos.map((video) => (
            <article className="video-card" key={`${video.provider}-${video.id}`}>
              <h2>{video.title}</h2>
              {video.description ? <p>{video.description}</p> : null}
              <VideoEmbed video={video} />
            </article>
          ))}
        </div>
      ) : (
        <p className="editorial-empty" role="status">Видеоматериалы готовятся к публикации.</p>
      )}
    </main>
  );
}
