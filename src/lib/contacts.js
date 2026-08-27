export function buildContactLinks(contacts = {}, iconTitle, intent = 'consultation') {
  const whatsapp = String(contacts.whatsapp || '').replace(/\D/g, '');
  const phone = String(contacts.phone || '').replace(/\D/g, '');
  const email = String(contacts.email || '').trim();
  const viewing = intent === 'viewing';
  const subject = viewing
    ? `Личный просмотр${iconTitle ? ` иконы «${iconTitle}»` : ' икон мастерской'}`
    : iconTitle ? `Консультация об иконе «${iconTitle}»` : 'Консультация в иконописной мастерской';
  const body = viewing
    ? `Здравствуйте! Хочу назначить личный просмотр${iconTitle ? ` иконы «${iconTitle}»` : ' икон мастерской'}.`
    : iconTitle
      ? `Здравствуйте! Хочу получить консультацию об иконе «${iconTitle}».`
      : 'Здравствуйте! Хочу получить консультацию об иконах мастерской.';

  return {
    whatsapp: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(body)}` : null,
    phone: phone ? `tel:+${phone}` : null,
    email: email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null
  };
}
