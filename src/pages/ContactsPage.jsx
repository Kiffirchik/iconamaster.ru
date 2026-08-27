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
        <div className="contacts-page__links">
          {whatsapp ? <a className="button button--primary" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Написать в WhatsApp</a> : null}
          {contacts.phone ? <a href={`tel:${contacts.phone}`}>{contacts.phone}</a> : null}
          {contacts.email ? <a href={`mailto:${contacts.email}`}>{contacts.email}</a> : null}
        </div>
      </section>
    </main>
  );
}
