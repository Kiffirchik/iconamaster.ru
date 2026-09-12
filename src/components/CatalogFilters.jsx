import { getFilterOptions } from '../lib/catalog.js';

const filterLabels = {
  period: 'Период',
  purpose: 'Назначение'
};

export function CatalogFilters({ items, filters, onChange, onReset }) {
  const isFiltered = ['period', 'purpose'].some((key) => filters[key] && filters[key] !== 'all') || filters.discountsOnly === true;

  return (
    <form className="catalog-filters" onSubmit={(event) => event.preventDefault()}>
      {Object.entries(filterLabels).map(([key, label]) => (
        <div className="catalog-filters__field" key={key}>
          <label htmlFor={`catalog-filter-${key}`}>{label}</label>
          <select
            id={`catalog-filter-${key}`}
            name={key}
            value={filters[key]}
            onChange={(event) => onChange({ [key]: event.target.value })}
          >
            {getFilterOptions(items, key).map((value) => (
              <option key={value} value={value}>{value === 'all' ? 'Все' : value}</option>
            ))}
          </select>
        </div>
      ))}
      {isFiltered && (
        <button className="catalog-filters__reset" type="button" onClick={onReset}>Сбросить</button>
      )}
      <button className="catalog-filters__discounts" type="button"
        aria-pressed={filters.discountsOnly === true}
        onClick={() => onChange({ discountsOnly: !filters.discountsOnly })}>
        <span aria-hidden="true">%</span> Скидки
      </button>
    </form>
  );
}
