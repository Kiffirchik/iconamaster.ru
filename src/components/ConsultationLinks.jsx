import { buildContactLinks } from '../lib/contacts.js';
import { useContent } from '../content/ContentProvider.jsx';

export function ConsultationLinks({ iconTitle, compact = false, includeViewing = false, topic }) {
  const { bundle } = useContent();
  const contacts = bundle?.contacts ?? {};
  const links = buildContactLinks(contacts, iconTitle, topic);
  const viewing = includeViewing ? buildContactLinks(contacts, iconTitle, 'viewing') : null;

  if (!links.whatsapp && !links.phone && !links.email) return null;

  return (
    <div className={`consultation-links${compact ? ' consultation-links--compact' : ''}`}>
      {links.whatsapp ? (
        <a className="button button--primary" href={links.whatsapp} target="_blank" rel="noreferrer">
          {topic === 'murals' ? 'Получить предварительную консультацию' : iconTitle ? 'Получить консультацию об иконе' : 'Написать в WhatsApp'}
        </a>
      ) : null}
      {viewing?.whatsapp ? (
        <a className="button button--quiet" href={viewing.whatsapp} target="_blank" rel="noreferrer">
          Назначить личный просмотр
        </a>
      ) : null}
      {links.phone ? <a className="consultation-links__secondary" href={links.phone}>Позвонить: {contacts.phone}</a> : null}
      {links.email ? <a className="consultation-links__secondary" href={links.email}>Написать: {contacts.email}</a> : null}
    </div>
  );
}
