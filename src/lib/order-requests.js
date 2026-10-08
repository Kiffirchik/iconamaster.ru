const endpoint = '/order-request.php';

export function canRequestIcon(icon) {
  return icon?.published !== false && String(icon?.availability || '').trim() === 'В наличии';
}

export function validateOrderFields({ name, contact, message = '', consent }) {
  if (!String(name || '').trim()) return 'Укажите ваше имя.';
  const value = String(contact || '').trim();
  const valid = value.includes('@')
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
    : /^\+?[\d ()-]+$/u.test(value) && /^\d{7,15}$/u.test(value.replace(/\D/gu, ''));
  if (!valid) return 'Укажите телефон или email для ответа.';
  if (String(name).length > 100 || value.length > 200 || message.length > 2000) return 'Сократите текст в полях формы.';
  if (!consent) return 'Подтвердите согласие на обработку заявки.';
  return '';
}

export async function orderRequestApi(payload, { fetchLike = globalThis.fetch, signal } = {}) {
  const response = await fetchLike(endpoint, {
    method: payload ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object') throw new Error('Сервис временно недоступен. Попробуйте ещё раз или свяжитесь с мастерской напрямую.');
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Не удалось отправить заявку. Попробуйте ещё раз.');
  const validSubmission = data.ok === true && (data.preview === true || /^IM-\d{8}-[A-F0-9]{8}$/u.test(data.reference || ''));
  if (payload ? !validSubmission : (typeof data.csrf !== 'string' || !/^[a-f0-9]{32}$/u.test(data.requestId || ''))) {
    throw new Error('Не удалось завершить отправку. Попробуйте ещё раз.');
  }
  return data;
}
