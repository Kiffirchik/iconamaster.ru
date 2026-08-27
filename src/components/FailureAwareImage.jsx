import { Component } from 'react';

export class FailureAwareImage extends Component {
  state = { failedSource: null };

  handleError = (event) => {
    const failedSource = this.props.image?.src ?? null;
    this.setState({ failedSource });
    this.props.onError?.(event, failedSource);
  };

  render() {
    const {
      image,
      alt,
      onError,
      children,
      loading = 'lazy',
      decoding = 'async',
      ...attributes
    } = this.props;
    if (!image?.src || this.state.failedSource === image.src) return null;

    const renderedImage = (
      <img
        {...attributes}
        src={image.src}
        alt={alt ?? image.alt ?? ''}
        width={image.width}
        height={image.height}
        loading={loading}
        decoding={decoding}
        onError={this.handleError}
      />
    );

    return typeof children === 'function' ? children(renderedImage) : renderedImage;
  }
}
