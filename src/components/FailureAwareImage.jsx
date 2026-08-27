import { Component } from 'react';

export class FailureAwareImage extends Component {
  state = { failed: false };

  handleError = (event) => {
    this.setState({ failed: true });
    this.props.onError?.(event);
  };

  render() {
    const { image, alt, onError, ...attributes } = this.props;
    if (this.state.failed || !image?.src) return null;

    return (
      <img
        {...attributes}
        src={image.src}
        alt={alt ?? image.alt ?? ''}
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
        onError={this.handleError}
      />
    );
  }
}
