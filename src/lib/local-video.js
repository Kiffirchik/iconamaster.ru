export function localVideoSource(video) {
  return video?.provider === 'local' && typeof video.src === 'string'
    && /^\/assets\/videos\/[a-z0-9-]+\.mp4$/.test(video.src) ? video.src : null;
}

export function videoDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
