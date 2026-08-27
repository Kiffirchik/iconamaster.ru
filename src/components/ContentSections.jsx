import { ContentGallery } from './ContentGallery.jsx';
import { renderableSections } from '../lib/content-selectors.js';

export function ContentSections({ sections = [] }) {
  return (
    <div className="content-sections">
      {renderableSections(sections).map((section, index) => {
        if (section.type === 'text') {
          const paragraphs = (section.paragraphs ?? []).filter((paragraph) => typeof paragraph === 'string' && paragraph.trim());
          return (
            <section className="content-section content-section--text" key={`text-${index}`}>
              {section.heading ? <h2>{section.heading}</h2> : null}
              {paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
            </section>
          );
        }

        if (section.type === 'image') {
          return <ContentGallery key={`image-${index}`} images={[section.image]} single />;
        }

        return <ContentGallery key={`gallery-${index}`} images={section.images} />;
      })}
    </div>
  );
}
