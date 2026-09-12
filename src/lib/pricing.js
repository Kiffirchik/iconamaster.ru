// Prices remain textual in the legacy catalog; discount fields are nullable numbers.
export function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^((?:\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)(?:[.,]\d{1,2})?)\s*(?:руб\.?|₽)?$/iu);
  if (!match) return null;
  const amount = Number(match[1].replace(/\s/gu, '').replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function getDiscount(icon) {
  const percent = icon?.discount;
  const price = parsePrice(icon?.price);
  const newPrice = icon?.newPrice;
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent <= 0 || percent >= 100
    || typeof newPrice !== 'number' || !Number.isFinite(newPrice) || newPrice <= 0
    || price === null || newPrice >= price) return null;
  return { percent, price, newPrice };
}

export function formatPrice(amount) {
  const [integer, decimal] = amount.toFixed(2).split('.');
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ' ')}${decimal === '00' ? '' : `,${decimal}`} руб.`;
}
