import { buildContactLinks } from '../lib/contacts.js';

export function ConsultationLinks({ iconTitle, compact = false }) {
  const links = buildContactLinks(iconTitle);

  return (
    <div className={`consultation-links${compact ? ' consultation-links--compact' : ''}`}>
      <a className="button button--primary" href={links.whatsapp} target="_blank" rel="noreferrer">
        Написать в WhatsApp
      </a>
      <a className="consultation-links__secondary" href={links.phone}>
        Позвонить
      </a>
      <a className="consultation-links__secondary" href={links.email}>
        Написать на email
      </a>
    </div>
  );
}
