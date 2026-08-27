import { useEffect, useRef, useState } from 'react';
import { IconImage } from './IconImage.jsx';
import { clampGalleryIndex } from '../lib/gallery.js';

export function IconGallery({ images, title }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [failedSources, setFailedSources] = useState(() => new Set());
  const visibleImages = images.filter((image) => image?.src && !failedSources.has(image.src));
  const displayedIndex = clampGalleryIndex(activeIndex, visibleImages.length);
  const activeImage = visibleImages[displayedIndex];

  useEffect(() => {
    setActiveIndex((index) => clampGalleryIndex(index, visibleImages.length));
  }, [visibleImages.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('.icon-gallery__close')?.focus();
    }

    if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function openImage(index, trigger) {
    triggerRef.current = trigger;
    restoreFocusRef.current = true;
    setActiveIndex(index);
    setIsOpen(true);
  }

  function moveImage(offset) {
    if (visibleImages.length < 2) return;
    setActiveIndex((index) => (
      clampGalleryIndex(index, visibleImages.length) + offset + visibleImages.length
    ) % visibleImages.length);
  }

  function removeFailedImage(src) {
    setFailedSources((current) => new Set([...current, src]));
  }

  function finishClose() {
    setIsOpen(false);
    if (restoreFocusRef.current) {
      triggerRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    finishClose();
  }

  function handleCancel(event) {
    event.preventDefault();
    closeDialog();
  }

  function handleDialogKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
    }
  }

  if (visibleImages.length === 0) return null;

  return (
    <section className="icon-gallery" aria-label={`Галерея: ${title}`}>
      <div className="icon-gallery__grid">
        {visibleImages.map((image, index) => (
          <IconImage
            image={image}
            title={title}
            mode="full"
            key={image.src}
            onError={() => removeFailedImage(image.src)}
          >
            {(renderedImage) => (
              <button
                className="icon-gallery__trigger"
                type="button"
                style={{ aspectRatio: `${image.width} / ${image.height}` }}
                onClick={(event) => openImage(index, event.currentTarget)}
                aria-label={`Открыть полное изображение: ${image.alt || title}`}
              >
                {renderedImage}
              </button>
            )}
          </IconImage>
        ))}
      </div>

      <dialog
        className="icon-gallery__dialog"
        ref={dialogRef}
        aria-label="Полное изображение иконы"
        onClose={finishClose}
        onCancel={handleCancel}
        onKeyDownCapture={handleDialogKeyDown}
      >
        <div className="icon-gallery__dialog-content">
          <div className="icon-gallery__dialog-actions">
            <button type="button" onClick={() => moveImage(-1)} disabled={visibleImages.length < 2}>
              Предыдущее изображение
            </button>
            <button className="icon-gallery__close" type="button" onClick={closeDialog}>
              Закрыть
            </button>
            <button type="button" onClick={() => moveImage(1)} disabled={visibleImages.length < 2}>
              Следующее изображение
            </button>
          </div>
          <IconImage image={activeImage} title={title} mode="full" onError={() => removeFailedImage(activeImage.src)} />
          <p className="icon-gallery__count" aria-live="polite">
            Изображение {displayedIndex + 1} из {visibleImages.length}
          </p>
        </div>
      </dialog>
    </section>
  );
}
