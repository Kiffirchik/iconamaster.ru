import { formatPrice, getDiscount } from '../lib/pricing.js';

export function IconPrice({ icon, className, availability = '' }) {
  const discount = getDiscount(icon);
  const price = String(icon.price || '').trim() || 'Цена по запросу';
  return <p className={className}>{discount ? <>
    <del className="icon-price__old" aria-label="Прежняя цена">{price}</del>
    <span className="icon-price__discount" aria-label={`Скидка ${discount.percent}%`}>%</span>
    <strong className="icon-price__new" aria-label="Новая цена">{formatPrice(discount.newPrice)}</strong>
  </> : price}{availability ? ` · ${availability}` : ''}</p>;
}
