import { Component, createRef } from 'react';
import { IconImage } from './IconImage.jsx';

export class IconGallery extends Component {
  state = {
    activeSrc: null,
    isOpen: false,
    failedSources: new Set()
  };

  dialogRef = createRef();
  triggerRef = createRef();
  restoreFocusPending = false;
  bodyOverflowBeforeDialog = null;

  componentDidUpdate() {
    this.syncDialog();
  }

  componentWillUnmount() {
    this.releaseBodyOverflow();
  }

  visibleImages = (failedSources = this.state.failedSources) => (
    (this.props.images ?? []).filter((image) => image?.src && !failedSources.has(image.src))
  );

  lockBodyOverflow = () => {
    if (typeof document === 'undefined' || this.bodyOverflowBeforeDialog !== null) return;
    this.bodyOverflowBeforeDialog = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  };

  releaseBodyOverflow = () => {
    if (typeof document === 'undefined' || this.bodyOverflowBeforeDialog === null) return;
    document.body.style.overflow = this.bodyOverflowBeforeDialog;
    this.bodyOverflowBeforeDialog = null;
  };

  restoreFocus = () => {
    if (!this.restoreFocusPending || typeof document === 'undefined') return;
    const trigger = this.triggerRef.current;
    if (trigger?.isConnected !== false && typeof trigger?.focus === 'function') {
      trigger.focus();
    } else {
      const main = document.getElementById('main-content');
      main?.setAttribute?.('tabindex', '-1');
      main?.focus?.({ preventScroll: true });
    }
    this.restoreFocusPending = false;
  };

  syncDialog = () => {
    const dialog = this.dialogRef.current;
    if (this.state.isOpen) {
      this.lockBodyOverflow();
      if (dialog && !dialog.open) {
        dialog.showModal();
        dialog.querySelector('.icon-gallery__close')?.focus();
      }
      return;
    }

    if (dialog?.open) dialog.close();
    this.releaseBodyOverflow();
    this.restoreFocus();
  };

  openImage = (src, trigger) => {
    if (!this.visibleImages().some((image) => image.src === src)) return;
    this.triggerRef.current = trigger;
    this.restoreFocusPending = true;
    this.setState({ activeSrc: src, isOpen: true });
  };

  moveImage = (offset) => {
    const visibleImages = this.visibleImages();
    if (visibleImages.length < 2) return;
    const currentIndex = Math.max(0, visibleImages.findIndex((image) => image.src === this.state.activeSrc));
    const nextIndex = (currentIndex + offset + visibleImages.length) % visibleImages.length;
    this.setState({ activeSrc: visibleImages[nextIndex].src });
  };

  removeFailedImage = (_event, src) => {
    if (!src) return;
    this.setState((current) => {
      if (current.failedSources.has(src)) return null;

      const visibleBeforeFailure = this.visibleImages(current.failedSources);
      const failedIndex = visibleBeforeFailure.findIndex((image) => image.src === src);
      const failedSources = new Set([...current.failedSources, src]);
      const remainingImages = this.visibleImages(failedSources);
      let { activeSrc, isOpen } = current;

      if (activeSrc === src || (activeSrc && !remainingImages.some((image) => image.src === activeSrc))) {
        const fallbackIndex = failedIndex < 0 ? 0 : failedIndex % Math.max(remainingImages.length, 1);
        activeSrc = remainingImages[fallbackIndex]?.src ?? null;
      }

      if (remainingImages.length === 0) {
        activeSrc = null;
        isOpen = false;
      }

      return { failedSources, activeSrc, isOpen };
    });
  };

  finishClose = () => {
    if (this.state.isOpen) {
      this.setState({ isOpen: false });
      return;
    }
    this.releaseBodyOverflow();
    this.restoreFocus();
  };

  closeDialog = () => {
    if (this.state.isOpen) this.setState({ isOpen: false });
  };

  handleCancel = (event) => {
    event.preventDefault();
    this.closeDialog();
  };

  handleDialogKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.closeDialog();
  };

  render() {
    const { title } = this.props;
    const visibleImages = this.visibleImages();
    if (visibleImages.length === 0) return null;

    const displayedIndex = Math.max(0, visibleImages.findIndex((image) => image.src === this.state.activeSrc));
    const activeImage = visibleImages[displayedIndex];

    return (
      <section className="icon-gallery" aria-label={`Галерея: ${title}`}>
        <div className="icon-gallery__grid">
          {visibleImages.map((image) => (
            <IconImage
              image={image}
              title={title}
              mode="full"
              key={image.src}
              onError={this.removeFailedImage}
            >
              {(renderedImage) => (
                <button
                  className="icon-gallery__trigger"
                  type="button"
                  style={{ aspectRatio: `${image.width} / ${image.height}` }}
                  onClick={(event) => this.openImage(image.src, event.currentTarget)}
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
          ref={this.dialogRef}
          aria-label="Полное изображение иконы"
          onClose={this.finishClose}
          onCancel={this.handleCancel}
          onKeyDownCapture={this.handleDialogKeyDown}
        >
          <div className="icon-gallery__dialog-content">
            <div className="icon-gallery__dialog-actions">
              <button type="button" onClick={() => this.moveImage(-1)} disabled={visibleImages.length < 2}>
                Предыдущее изображение
              </button>
              <button className="icon-gallery__close" type="button" onClick={this.closeDialog}>
                Закрыть
              </button>
              <button type="button" onClick={() => this.moveImage(1)} disabled={visibleImages.length < 2}>
                Следующее изображение
              </button>
            </div>
            <IconImage
              key={activeImage.src}
              image={activeImage}
              title={title}
              mode="full"
              onError={this.removeFailedImage}
            />
            <p className="icon-gallery__count" aria-live="polite">
              Изображение {displayedIndex + 1} из {visibleImages.length}
            </p>
          </div>
        </dialog>
      </section>
    );
  }
}
