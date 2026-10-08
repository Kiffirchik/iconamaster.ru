import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '../content/ContentProvider.jsx';
import { buildContactLinks } from '../lib/contacts.js';
import { canRequestIcon, orderRequestApi, validateOrderFields } from '../lib/order-requests.js';
import { trackGoal } from '../lib/analytics.js';
import { IconPrice } from './IconPrice.jsx';

export function OrderRequestButton({ icon, className = '' }) {
  const [open, setOpen] = useState(false);
  if (!canRequestIcon(icon)) return null;
  return <>
    <button type="button" className={`button button--primary ${className}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      Заказать икону
    </button>
    {open && <OrderRequestDialog icon={icon} onClose={() => setOpen(false)} />}
  </>;
}

export function OrderRequestDialog({ icon, onClose }) {
  const id = useId();
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const resultRef = useRef(null);
  const submittingRef = useRef(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const { bundle } = useContent();
  const contacts = bundle?.contacts ?? {};
  const links = buildContactLinks(contacts, icon.title);

  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    let active = true;
    dialog.showModal(); document.body.style.overflow = 'hidden'; nameRef.current?.focus();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    orderRequestApi(null, { signal: controller.signal }).then((value) => { if (active) { setSession(value); setError(''); } }).catch(() => {
      if (active) setError('Не удалось открыть отправку заявки. Закройте форму и попробуйте ещё раз или свяжитесь с мастерской напрямую.');
    }).finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort(); clearTimeout(timeout); submittingRef.current?.abort();
      dialog.close(); document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  async function submit(event) {
    event.preventDefault();
    if (!session || submitting) return;
    const form = new FormData(event.currentTarget);
    const fields = { name: form.get('name'), contact: form.get('contact'), message: form.get('message'), consent: form.get('consent') === 'yes' };
    const validation = validateOrderFields(fields);
    if (validation) { setError(validation); return; }
    setSubmitting(true); setError('');
    const controller = new AbortController(); submittingRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await orderRequestApi({ ...fields, slug: icon.slug, website: form.get('website') || '', csrf: session.csrf, requestId: session.requestId }, { signal: controller.signal });
      setResult(response);
      if (!response.preview) trackGoal('order_request_sent');
    } catch (failure) {
      setError(failure?.name === 'AbortError'
        ? 'Ответ задерживается. Попробуйте отправить ещё раз — повторная отправка не создаст вторую заявку.'
        : failure instanceof TypeError ? 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.' : failure.message);
    } finally { clearTimeout(timeout); submittingRef.current = null; setSubmitting(false); }
  }

  return createPortal(<dialog className="order-dialog" ref={dialogRef} aria-labelledby={`${id}-title`}
    onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }}>
    <button className="order-dialog__close" type="button" aria-label="Закрыть форму заказа" onClick={onClose} disabled={submitting}>×</button>
    <p className="eyebrow">Связаться с мастерской</p>
    <h2 id={`${id}-title`}>Заказать икону</h2>
    <div className="order-dialog__icon"><strong>{icon.title}</strong><IconPrice icon={icon} /></div>
    {result ? <div className="order-dialog__result" role="status" tabIndex={-1} ref={resultRef}>
      <h3>{result.preview ? 'Форма готова к отправке' : 'Заявка отправлена'}</h3>
      <p>{result.preview ? 'Это локальный предпросмотр. Письмо в мастерскую не отправлялось.' : `Номер заявки: ${result.reference}. Мы свяжемся с вами по указанному контакту, чтобы подтвердить наличие и обсудить покупку.`}</p>
      <button type="button" className="button button--primary" onClick={onClose}>Готово</button>
    </div> : <form onSubmit={submit} aria-busy={submitting}>
      <p className="order-dialog__intro">Оставьте контакт — мастерская ответит вам и согласует оплату и доставку. Заявка не резервирует икону автоматически.</p>
      {session?.preview && <p className="order-dialog__preview">Предпросмотр: письмо не отправляется.</p>}
      <fieldset disabled={submitting}>
        <label htmlFor={`${id}-name`}>Ваше имя<input ref={nameRef} id={`${id}-name`} name="name" autoComplete="name" required maxLength={100} /></label>
        <label htmlFor={`${id}-contact`}>Телефон или email<input id={`${id}-contact`} name="contact" type="text" required maxLength={200} placeholder="+7 … или name@example.ru" autoCapitalize="none" spellCheck={false} /></label>
        <label htmlFor={`${id}-message`}>Комментарий <span>(необязательно)</span><textarea id={`${id}-message`} name="message" rows={3} maxLength={2000} placeholder="Например, вопрос о доставке или удобное время для звонка" /></label>
        <label className="order-dialog__trap" aria-hidden="true">Ваш сайт<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <label className="order-dialog__consent"><input type="checkbox" name="consent" value="yes" required /><span>Согласен на обработку моего имени, контакта и комментария для ответа на заявку, как описано в <a href="/privacy" target="_blank" rel="noopener noreferrer">политике конфиденциальности</a>.</span></label>
      </fieldset>
      {error && <p className="order-dialog__error" role="alert">{error}</p>}
      {!session && !error && <p role="status">Подготавливаем форму…</p>}
      <button type="submit" className="button button--primary order-dialog__submit" disabled={!session || submitting}>{submitting ? 'Отправляем…' : 'Отправить заявку'}</button>
    </form>}
    <div className="order-dialog__alternatives"><span>Можно связаться напрямую:</span>
      {links.phone && <a href={links.phone} onClick={() => trackGoal('contact_phone')}>{contacts.phone}</a>}
      {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => trackGoal('contact_whatsapp')}>WhatsApp</a>}
      {links.email && <a href={links.email} onClick={() => trackGoal('contact_email')}>Email</a>}
    </div>
  </dialog>, document.body);
}
