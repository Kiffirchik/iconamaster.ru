import { useState } from 'react';
import { CatalogFilters } from '../components/CatalogFilters.jsx';
import { IconCard } from '../components/IconCard.jsx';
import { icons } from '../data/icons.js';
import { filterIcons } from '../lib/catalog.js';

const initialFilters = {
  type: 'all',
  period: 'all',
  availability: 'all'
};

export function CollectionPage({ onNavigate }) {
  const [filters, setFilters] = useState(initialFilters);
  const filteredIcons = filterIcons(icons, filters);

  return (
    <main id="main-content" className="collection-page">
      <section className="collection-page__intro" aria-labelledby="collection-title">
        <p className="eyebrow">Кураторская подборка</p>
        <h1 id="collection-title">Иконы в наличии</h1>
        <p>Собрание произведений мастерской и проверенных икон для личного просмотра и консультации.</p>
      </section>
      <section className="collection-page__catalog" aria-label="Каталог икон">
        <CatalogFilters
          items={icons}
          filters={filters}
          onChange={(nextFilter) => setFilters((current) => ({ ...current, ...nextFilter }))}
          onReset={() => setFilters(initialFilters)}
        />
        {filteredIcons.length > 0 ? (
          <div className="collection-grid">
            {filteredIcons.map((icon) => <IconCard key={icon.slug} icon={icon} onNavigate={onNavigate} />)}
          </div>
        ) : (
          <div className="collection-empty" role="status">
            <p>По выбранным параметрам икон нет</p>
            <button type="button" onClick={() => setFilters(initialFilters)}>Сбросить фильтры</button>
          </div>
        )}
      </section>
    </main>
  );
}
