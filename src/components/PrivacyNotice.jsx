import { useEffect, useState } from 'react';

export const analyticsChoiceKey = 'iconamaster.analytics.v1';

export function PrivacyNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { setOpen(!['granted', 'denied'].includes(localStorage.getItem(analyticsChoiceKey))); }
    catch { setOpen(true); }
    const show = () => setOpen(true);
    window.addEventListener('iconamaster:privacy-settings', show);
    return () => window.removeEventListener('iconamaster:privacy-settings', show);
  }, []);

  function choose(choice) {
    // Apply the choice in memory too, when browser storage is unavailable.
    try { localStorage.setItem(analyticsChoiceKey, choice); } catch { /* Optional storage. */ }
    window.dispatchEvent(new CustomEvent('iconamaster:analytics-choice', { detail: choice }));
    setOpen(false);
  }

  if (!open) return null;
  return (
    <aside className="privacy-notice" aria-labelledby="privacy-notice-title">
      <div>
        <h2 id="privacy-notice-title">Настройки аналитики</h2>
        <p>С вашего разрешения Яндекс Метрика использует cookie для статистики посещений и кликов. Вы можете пользоваться сайтом без аналитики. <a href="/privacy">Подробнее о данных</a></p>
      </div>
      <div className="privacy-notice__actions">
        <button type="button" className="button button--quiet" onClick={() => choose('denied')}>Без аналитики</button>
        <button type="button" className="button button--primary" onClick={() => choose('granted')}>Разрешить аналитику</button>
      </div>
    </aside>
  );
}
