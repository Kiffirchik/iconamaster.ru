import { trackGoal } from '../lib/analytics.js';

export function ContactsPage({ contacts = {} }) {
  const whatsapp = String(contacts.whatsapp || '').replace(/\D/g, '');

  return (
    <main id="main-content" className="contacts-page editorial-page">
      <header className="editorial-page__header">
        <p className="eyebrow">Личная консультация</p>
        <h1>Контакты</h1>
        <p className="editorial-page__intro">Свяжитесь с мастерской, чтобы обсудить икону, реставрацию или личный просмотр.</p>
      </header>
      <section className="contacts-page__panel" aria-labelledby="contacts-title">
        <h2 id="contacts-title">Московская иконописная мастерская</h2>
        <address>{contacts.address.display}</address>
        <div className="contacts-page__links">
          {whatsapp ? <a className="button button--primary" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" onClick={() => trackGoal('contact_whatsapp')}>Написать в WhatsApp</a> : null}
          {contacts.phone ? <a href={`tel:${contacts.phone}`} onClick={() => trackGoal('contact_phone')}>{contacts.phone}</a> : null}
          {contacts.email ? <a href={`mailto:${contacts.email}`} onClick={() => trackGoal('contact_email')}>{contacts.email}</a> : null}
          <a href={contacts.mapUrl} target="_blank" rel="noreferrer">Открыть в Яндекс Картах</a>
        </div>
      </section>
    </main>
  );
}
