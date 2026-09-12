export function IconMoreDetails({ text }) {
  const content = typeof text === 'string' ? text.replace(/\r\n?/g, '\n').trim() : '';
  if (!content) return null;
  return <details className="icon-more-details">
    <summary>Подробнее об иконе</summary>
    <div className="icon-more-details__text">{content}</div>
  </details>;
}
