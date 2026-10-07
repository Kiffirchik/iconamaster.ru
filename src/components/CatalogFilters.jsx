import { getFilterOptions } from '../lib/catalog.js';

const filterLabels = {
  subject: 'Образ / святой',
  availability: 'Наличие',
  period: 'Период',
  purpose: 'Назначение'
};

export function CatalogFilters({ items, filters, onChange, onReset, fields = ['subject', 'period', 'purpose'], idPrefix = 'catalog', showDiscounts = true, defaultFilters = {} }) {
  const isFiltered = fields.some((key) => (filters[key] ?? 'all') !== (defaultFilters[key] ?? 'all')) || (showDiscounts && filters.discountsOnly === true);

  return (
    <form className="catalog-filters" onSubmit={(event) => event.preventDefault()}>
      {fields.map((key) => (
        <div className="catalog-filters__field" key={key}>
          <label htmlFor={`${idPrefix}-filter-${key}`}>{filterLabels[key]}</label>
          <select
            id={`${idPrefix}-filter-${key}`}
            name={key}
            value={filters[key] ?? 'all'}
            onChange={(event) => onChange({ [key]: event.target.value })}
          >
            {getFilterOptions(items, key).map((value) => (
              <option key={value} value={value}>{value === 'all' ? (key === 'availability' ? 'Все работы' : 'Все') : value}</option>
            ))}
          </select>
        </div>
      ))}
      {isFiltered && (
        <button className="catalog-filters__reset" type="button" onClick={onReset}>Сбросить</button>
      )}
      {showDiscounts && <button className="catalog-filters__discounts" type="button"
        aria-pressed={filters.discountsOnly === true}
        onClick={() => onChange({ discountsOnly: !filters.discountsOnly })}>
        <span aria-hidden="true">%</span> Скидки
      </button>}
    </form>
  );
}
