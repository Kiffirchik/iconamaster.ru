import { getFilterOptions } from '../lib/catalog.js';

const filterLabels = {
  type: 'Тип иконы',
  period: 'Период',
  availability: 'Наличие'
};

export function CatalogFilters({ items, filters, onChange, onReset }) {
  const isFiltered = Object.values(filters).some((value) => value !== 'all');

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
    </form>
  );
}
