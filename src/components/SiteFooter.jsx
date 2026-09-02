import { ConsultationLinks } from './ConsultationLinks.jsx';
import { useContent } from '../content/ContentProvider.jsx';

const sections = [
  ['Главная', '/'],
  ['Иконы в наличии', '/collection'],
  ['Реставрация', '/restoration'],
  ['Расчистка росписей', '/raschistka-hramovyh-rospisey'],
  ['Статьи', '/articles'],
  ['Видео', '/video'],
  ['Контакты', '/contacts']
];

export function SiteFooter({ onNavigate }) {
  const { bundle } = useContent();
  const address = bundle?.contacts?.address;

  function follow(event, path) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    onNavigate?.(path);
  }

  return (
    <footer id="contact" className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="site-footer__title">Московская иконописная мастерская</p>
          <p>Работаем с 1991 года</p>
          {address ? <p>{[address.addressLocality, address.addressRegion].join(', ')}</p> : null}
        </div>
        <div>
          <p className="site-footer__label">Консультация</p>
          <ConsultationLinks compact />
        </div>
        <nav className="site-footer__nav" aria-label="Разделы сайта">
          {sections.map(([label, path]) => (
            <a key={path} href={path} onClick={(event) => follow(event, path)}>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
