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
  if (!fields.length) return null;

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

  return headingId ? (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>Паспорт предмета</h2>
      {passport}
    </section>
  ) : passport;
}
