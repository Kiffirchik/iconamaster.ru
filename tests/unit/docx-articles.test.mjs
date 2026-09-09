import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { verifyContent, verifyProject } from '../../scripts/verify-content.mjs';

const newDocxArticles = new Map([
  ['vetka-icon-painting', {
    sourceUrl: 'docx:vetka-icon-painting.docx',
    images: 7,
    opening: 'Ветка — исторический центр старообрядчества, возникший в конце XVII века на территории Речи Посполитой (сейчас — Гомельская область Беларуси). Это поселение стало крупнейшим центром поповского старообрядчества, где сформировались уникальные культурные и религиозные традиции.',
    closing: 'Ветковская иконописная школа оказала значительное влияние на старообрядческую иконопись в других регионах, включая Украину, Молдавию, Поволжье, Поднестровье и Забайкалье.',
  }],
  ['palekh-icon-painting', {
    sourceUrl: 'docx:palekh-icon-painting.docx',
    images: 7,
    opening: 'Село Палех – знаменитый и наиболее развитый центр иконописного промысла, широко распространенного в древнем Владимиро-Суздальском крае. Местная традиция мастерства имеет трехсотлетнюю давность. Совершенство иконописной техники, ее утонченные приемы, ее колористическое и фактурное богатство, несравненная красота терпеливой и тщательной завершенности ведут в глубины двух тысячелетий, к истокам античной культуры.',
    closing: 'Однако, разросшееся к началу XX века иконное производство привело к страшному удешевлению иконы и снижению её качества. Положение усугубило появление дешёвой печатной иконы машинного изготовления. Иконопись пришла в упадок, а многие известные в начале XIX века мастерские вообще прекращают своё существование.',
  }],
  ['peshekhonov-icon-painting', {
    sourceUrl: 'docx:peshekhonov-icon-painting.docx',
    images: 3,
    opening: 'Династия иконописцев Пешехоновых и новый «Византийский стиль» в русской иконописи XIX века.',
    closing: 'В 1830-1870-е годы активно работали тверские мастера - ученики С.Ф. Пешехонова, а также третье поколение местных иконописцев (ученики учеников), Михаил Емельянович Сухарев жил по соседству с Пешехоновыми; получив иконописные навыки у главы семейства, он организовал собственную мастерскую и обучил иконному ремеслу сыновей Семена и Матвея, а также М.Г. Гокарсва, В.Ф. Скотина, П.М. Подшивалова, И.Ф. Арефьсва, В.Г. Богомолова. Они не замыкались в рамках региона, успешно работая в Петербурге, Новгороде, в Курской губернии, исполняя заказы сибирских купцов. Стилистически их работы близки к Пешехоновским.',
  }],
]);

test('DOCX source references are bound to approved articles, never service pages', async () => {
  const bundle = Object.fromEntries(await Promise.all(['icons', 'pages', 'articles', 'videos', 'contacts', 'aliases'].map(async name => [name,
    JSON.parse(await readFile(new URL(`../../public/content/${name}.json`, import.meta.url), 'utf8'))])));
  const errorsFor = candidate => verifyContent(candidate).filter(error => error.includes('sourceUrl'));
  assert.deepEqual(errorsFor(bundle), []);
  const wrongSlug = structuredClone(bundle);
  wrongSlug.articles.find(a => a.slug === 'cast-crosses').sourceUrl = 'docx:history-of-cast-icons.docx';
  assert.ok(errorsFor(wrongSlug).some(e => e.includes('article cast-crosses')));
  const service = structuredClone(bundle);
  service.pages.find(p => p.template === 'service').sourceUrl = 'docx:cast-crosses.docx';
  assert.ok(errorsFor(service).some(e => e.includes('page ')));
});

test('DOCX articles publish complete image sets and preserve the existing monastery URL', async () => {
  const articles = JSON.parse(await readFile(new URL('../../public/content/articles.json', import.meta.url), 'utf8'));
  for (const [slug, count] of [['history-of-cast-icons', 8], ['cast-crosses', 12]]) {
    const matches = articles.filter(a => a.slug === slug);
    assert.equal(matches.length, 1, slug + ' has exactly one article');
    const article = matches[0];
    assert.equal(article.published, true);
    assert.ok(article.sections.filter(s => s.type === 'text').length > 1);
    const images = article.sections.flatMap(s => s.type === 'image' ? [s.image] : s.images ?? []);
    assert.equal(images.length, count, slug + ' preserves all illustrations');
    assert.equal(new Set(images.map(i => i.src)).size, count);
  }
  const monastery = articles.filter(a => a.slug === 'panteleimon-monastery-icons');
  assert.equal(monastery.length, 1);
  assert.match(JSON.stringify(monastery[0].sections), /Богоматерь Шестоковская/);
});

test('second DOCX batch preserves reviewed prose, provenance, and every local image', async () => {
  const articles = JSON.parse(await readFile(new URL('../../public/content/articles.json', import.meta.url), 'utf8'));
  for (const [slug, expected] of newDocxArticles) {
    const matches = articles.filter((article) => article.slug === slug);
    assert.equal(matches.length, 1, `${slug} has exactly one article`);
    const article = matches[0];
    assert.equal(article.published, true);
    assert.equal(article.sourceUrl, expected.sourceUrl);
    const images = article.sections.flatMap((section) => (
      section.type === 'image' ? [section.image] : section.images ?? []
    ));
    assert.equal(images.length, expected.images, `${slug} preserves every source image`);
    assert.equal(new Set(images.map(({ src }) => src)).size, expected.images);
    assert.ok(images.every(({ src }) => src.startsWith(`/assets/articles/docx/${slug}-`)));
    const serialized = JSON.stringify(article);
    assert.ok(serialized.includes(expected.opening), `${slug} preserves its reviewed opening`);
    assert.ok(serialized.includes(expected.closing), `${slug} preserves its reviewed closing`);
    assert.doesNotMatch(serialized, /elib\.rshu\.ru \+1/u);
  }
});

test('all DOCX assets have verified ownership and the expanded publication contract passes', async () => {
  const report = await verifyProject(new URL('../../', import.meta.url));
  assert.deepEqual(report.errors, []);
  assert.equal(report.summary.articles, 15);
});
