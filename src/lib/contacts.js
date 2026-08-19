const PHONE = '79166554595';
const EMAIL = 'iconamaster@yandex.ru';

export function buildContactLinks(iconTitle, intent = 'consultation') {
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
    whatsapp: `https://wa.me/${PHONE}?text=${encodeURIComponent(body)}`,
    phone: `tel:+${PHONE}`,
    email: `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  };
}
