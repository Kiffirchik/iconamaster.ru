export function clampGalleryIndex(index, imageCount) {
  if (imageCount < 1) return 0;
  return Math.min(Math.max(index, 0), imageCount - 1);
}
