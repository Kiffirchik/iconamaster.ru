import { useEffect, useRef, useState } from 'react';
import { IconImage } from './IconImage.jsx';

export function IconGallery({ images, title }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const activeImage = images[activeIndex];

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
    setActiveIndex((index) => (index + offset + images.length) % images.length);
  }

  function handleDialogClose() {
    setIsOpen(false);
    if (restoreFocusRef.current) {
      triggerRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }

  return (
    <section className="icon-gallery" aria-label={`Галерея: ${title}`}>
      <div className="icon-gallery__grid">
        {images.map((image, index) => (
          <button
            className="icon-gallery__trigger"
            key={image.src}
            type="button"
            onClick={(event) => openImage(index, event.currentTarget)}
            aria-label={`Открыть полное изображение: ${image.alt || title}`}
          >
            <IconImage image={image} title={title} mode="full" />
          </button>
        ))}
      </div>

      <dialog
        className="icon-gallery__dialog"
        ref={dialogRef}
        aria-label="Полное изображение иконы"
        onClose={handleDialogClose}
      >
        <div className="icon-gallery__dialog-content">
          <div className="icon-gallery__dialog-actions">
            <button type="button" onClick={() => moveImage(-1)} disabled={images.length < 2}>
              Предыдущее изображение
            </button>
            <button className="icon-gallery__close" type="button" onClick={() => dialogRef.current?.close()}>
              Закрыть
            </button>
            <button type="button" onClick={() => moveImage(1)} disabled={images.length < 2}>
              Следующее изображение
            </button>
          </div>
          <IconImage image={activeImage} title={title} mode="full" />
          <p className="icon-gallery__count" aria-live="polite">
            Изображение {activeIndex + 1} из {images.length}
          </p>
        </div>
      </dialog>
    </section>
  );
}
