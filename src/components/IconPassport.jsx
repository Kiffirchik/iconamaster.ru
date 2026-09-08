import { getIconDisplayValue } from '../lib/catalog.js';

const passportFields = [
  ['Период', 'period'],
  ['Назначение', 'purpose'],
  ['Размер', 'size'],
  ['Техника', 'technique'],
  ['Состояние', 'condition'],
  ['Экспертное заключение', 'expertise'],
];

export function IconPassport({ icon, headingId }) {
  const fields = passportFields
    .map(([label, key]) => [label, key, getIconDisplayValue(icon?.[key])])
    .filter(([, , value]) => value);

  const passport = (
    <dl className="object-passport">
      {fields.map(([label, key, value]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );

  const content = !fields.length ? null : headingId ? (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>Паспорт предмета</h2>
      {passport}
    </section>
  ) : passport;
  return <div data-live-slot={`passport${headingId ? '-detail' : ''}:${icon.slug}`}>{content}</div>;
}
