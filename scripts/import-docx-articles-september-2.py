"""Import the approved second September DOCX batch into a live-derived baseline.

Run with bundled Python (lxml, Pillow):
  import-docx-articles-september-2.py --incoming <directory> --baseline <downloaded-live-articles.json>
"""

import argparse
import copy
import hashlib
import io
import json
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath

from lxml import etree as E
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RELATIONSHIP = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
VML_NAMESPACE = 'urn:schemas-microsoft-com:vml'
SOURCE_DEBRIS = ' elib.rshu.ru +1'

EXPECTED_BASELINE_SLUGS = {
    'history-of-cast-icons',
    'cast-crosses',
    'gorbunov-icons-kholuy',
    'kineshma-icon-painting',
    'panteleimon-monastery-icons',
    'theotokos-russkaya',
    'pavlovo-na-oke',
    'history-of-icon-oklads',
    'icon-painting-canon',
    'guslitsa',
    'restoration-murals-cleaning',
    'georgievsky-church-iconostasis',
}

jobs = [
    ('Ветковская школа иконописи..docx', 'vetka-icon-painting', 'Иконописная традиция Ветки', 49, 7, {4, 7, 11, 16, 21, 27, 33, 42, 48}),
    ('Иконописные традиции села Палех.docx', 'palekh-icon-painting', 'Иконописные традиции села Палех', 38, 7, {28}),
    ('Пешехоновская икона. Византийский стиль.docx', 'peshekhonov-icon-painting', 'Пешехоновская икона. Византийский стиль', 36, 3, {3, 18}),
]

summaries = {
    'vetka-icon-painting': 'История Ветки и особенности её старообрядческой иконописной школы: колорит, орнамент, техника и характерные образы.',
    'palekh-icon-painting': 'История иконописного промысла Палеха, его ведущие мастерские, художественная манера и технико-технологические особенности.',
    'peshekhonov-icon-painting': 'Династия Пешехоновых и новый «византийский стиль» русской иконописи XIX века: мастера, заказы, техника и наследие.',
}

TITLE_INDICES = {
    'vetka-icon-painting': {1},
    'palekh-icon-painting': {1},
    'peshekhonov-icon-painting': {2},
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def save_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
        newline='\n',
    )


def validate_baseline(baseline):
    if not isinstance(baseline, list) or len(baseline) != 12:
        raise ValueError('Baseline must contain exactly twelve articles')
    slugs = [article.get('slug') for article in baseline if isinstance(article, dict)]
    if len(slugs) != 12 or len(set(slugs)) != 12 or set(slugs) != EXPECTED_BASELINE_SLUGS:
        raise ValueError('Baseline does not contain the exact twelve expected article slugs')
    destination_slugs = [slug for _, slug, *_ in jobs]
    if len(set(destination_slugs)) != len(destination_slugs):
        raise ValueError('DOCX jobs contain duplicate destination slugs')
    duplicates = set(destination_slugs).intersection(slugs)
    if duplicates:
        raise ValueError('Destination slugs already exist in baseline: ' + ', '.join(sorted(duplicates)))


def safe_image_member(relationship, filename):
    if relationship is None or relationship.get('TargetMode') == 'External':
        raise ValueError('Unsafe image relationship in ' + filename)
    target = relationship.get('Target')
    if not isinstance(target, str) or '\\' in target or ':' in target:
        raise ValueError('Unsafe image relationship target in ' + filename)
    relative = PurePosixPath(target)
    if relative.is_absolute() or len(relative.parts) < 2 or relative.parts[0] != 'media':
        raise ValueError('Unsafe image relationship target in ' + filename)
    if any(part in {'', '.', '..'} for part in relative.parts):
        raise ValueError('Unsafe image relationship target in ' + filename)
    return 'word/' + relative.as_posix()


def append_image(sections, image):
    if sections and sections[-1]['type'] == 'image':
        sections[-1] = {'type': 'gallery', 'images': [sections[-1]['image'], image]}
    elif sections and sections[-1]['type'] == 'gallery' and len(sections[-1]['images']) < 3:
        sections[-1]['images'].append(image)
    else:
        sections.append({'type': 'image', 'image': image})


def paragraph_text(paragraph):
    parts = []
    for node in paragraph.xpath('.//*[local-name()="t" or local-name()="tab"]'):
        parts.append(' ' if E.QName(node).localname == 'tab' else (node.text or ''))
    return ''.join(parts).strip()


def clean_paragraph(text, slug):
    if slug == 'vetka-icon-painting' and text.endswith(SOURCE_DEBRIS):
        return text[:-len(SOURCE_DEBRIS)]
    return text


def has_vml_rotation(document):
    for node in document.xpath('//*[namespace-uri()=$namespace]', namespace=VML_NAMESPACE):
        for attribute, value in node.attrib.items():
            name = E.QName(attribute).localname.casefold()
            if name in {'rotation', 'rot'}:
                return True
            if name == 'style' and any(
                declaration.partition(':')[0].strip().casefold().endswith('rotation')
                for declaration in value.split(';')
                if ':' in declaration
            ):
                return True
    return False


def parse_job(job, incoming, next_order):
    filename, slug, title, expected_paragraphs, expected_images, heading_indices = job
    source_path = incoming / filename
    records = []
    paragraphs = []
    images = []
    assets = []
    writes = []
    seen_targets = set()
    seen_hashes = set()

    with zipfile.ZipFile(source_path) as archive:
        document = E.fromstring(archive.read('word/document.xml'))
        if document.xpath('//*[local-name()="ins" or local-name()="del" or local-name()="moveFrom" or local-name()="moveTo"]'):
            raise ValueError('Unsupported tracked changes in ' + filename)
        if document.xpath('//*[local-name()="xfrm"]/@rot'):
            raise ValueError('Rotation requires explicit handling in ' + filename)
        if has_vml_rotation(document):
            raise ValueError('VML rotation requires explicit handling in ' + filename)

        relationships_xml = E.fromstring(archive.read('word/_rels/document.xml.rels'))
        relationships = {relationship.get('Id'): relationship for relationship in relationships_xml}
        for index, paragraph in enumerate(document.xpath('//*[local-name()="body"]//*[local-name()="p"]'), 1):
            text = paragraph_text(paragraph)
            if text:
                cleaned = clean_paragraph(text, slug)
                paragraphs.append((index, cleaned))
                records.append(('text', index, cleaned))

            for node in paragraph.xpath('.//*[local-name()="blip" or local-name()="imagedata"]'):
                if node.get(RELATIONSHIP + 'link'):
                    raise ValueError('External image relationship in ' + filename)
                relationship_id = node.get(RELATIONSHIP + 'embed') or node.get(RELATIONSHIP + 'id')
                member = safe_image_member(relationships.get(relationship_id), filename)
                if member in seen_targets:
                    raise ValueError('Duplicate embedded image target in ' + filename)
                seen_targets.add(member)
                payload = archive.read(member)
                digest = sha256(payload)
                if digest in seen_hashes:
                    raise ValueError('Duplicate embedded image bytes in ' + filename)
                seen_hashes.add(digest)
                with Image.open(io.BytesIO(payload)) as source_image:
                    width, height = source_image.size

                suffix = Path(member).suffix.lower().replace('.jpeg', '.jpg')
                src = f'/assets/articles/docx/{slug}-{len(images) + 1}{suffix}'
                destination = ROOT / 'public' / src.lstrip('/')
                if destination.exists() and sha256(destination.read_bytes()) != digest:
                    raise ValueError('Refusing to overwrite different image bytes: ' + src)
                writes.append((destination, payload))
                assets.append({
                    'src': src,
                    'alt': title,
                    'width': width,
                    'height': height,
                    'bytes': len(payload),
                    'sha256': digest,
                    'provenance': 'docx-embedded-original',
                    'sourceRef': f'docx:{filename}#/{member}',
                    'ownerType': 'article',
                    'ownerSlug': slug,
                    'order': len(images) + 1,
                })
                image = {
                    'src': src,
                    'alt': f'{title} — иллюстрация {len(images) + 1}',
                    'width': width,
                    'height': height,
                }
                images.append(image)
                records.append(('image', index, image))

    if len(paragraphs) != expected_paragraphs:
        raise ValueError(f'Unexpected paragraph count for {filename}: {len(paragraphs)}')
    if len(images) != expected_images:
        raise ValueError(f'Unexpected image count for {filename}: {len(images)}')

    title_indices = TITLE_INDICES[slug]
    sections = []
    represented = []
    accepted = [(index, text) for index, text in paragraphs if index not in title_indices]
    for kind, index, value in records:
        if kind == 'image':
            append_image(sections, value)
        elif index in title_indices:
            continue
        elif index in heading_indices:
            sections.append({'type': 'text', 'heading': value, 'paragraphs': []})
            represented.append(value)
        elif sections and sections[-1]['type'] == 'text':
            sections[-1]['paragraphs'].append(value)
            represented.append(value)
        else:
            sections.append({'type': 'text', 'paragraphs': [value]})
            represented.append(value)

    if Counter(represented) != Counter(text for _, text in accepted):
        raise AssertionError('Not every accepted source paragraph is represented for ' + slug)
    if any(section['type'] == 'gallery' and len(section['images']) > 3 for section in sections):
        raise AssertionError('Gallery exceeds three images for ' + slug)

    cover = {
        **images[0],
        'sha256': assets[0]['sha256'],
        'provenance': 'docx-embedded-original',
    }
    article = {
        'id': slug,
        'slug': slug,
        'title': title,
        'published': True,
        'order': next_order,
        'sourceUrl': f'docx:{slug}.docx',
        'summary': summaries[slug],
        'image': cover,
        'sections': sections,
    }
    document_report = {
        'filename': filename,
        'slug': slug,
        'sha256': sha256(source_path.read_bytes()),
        'paragraphs': len(paragraphs),
        'images': len(images),
        'embeddedImageSources': [image['src'] for image in images],
    }
    return article, document_report, assets, writes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--incoming', type=Path, required=True)
    parser.add_argument('--baseline', type=Path, required=True)
    args = parser.parse_args()

    baseline = json.loads(args.baseline.read_text(encoding='utf-8-sig'))
    validate_baseline(baseline)
    report_path = ROOT / 'reports/docx-import.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    if report.get('schemaVersion') != 1 or not isinstance(report.get('assets'), list) or not isinstance(report.get('documents'), list):
        raise ValueError('Existing DOCX report has an unsupported schema')

    destination_slugs = {slug for _, slug, *_ in jobs}
    report_slugs = {
        entry.get('slug') for entry in report['documents'] if isinstance(entry, dict)
    } | {
        entry.get('ownerSlug') for entry in report['assets'] if isinstance(entry, dict)
    }
    duplicates = destination_slugs.intersection(report_slugs)
    if duplicates:
        raise ValueError('Destination slugs already exist in DOCX report: ' + ', '.join(sorted(duplicates)))

    editorial_path = ROOT / 'reports/editorial-migration.json'
    editorial = json.loads(editorial_path.read_text(encoding='utf-8'))
    article_output = next(
        (output for output in editorial.get('outputs', []) if output.get('path') == 'public/content/articles.json'),
        None,
    )
    if article_output is None:
        raise ValueError('Editorial report does not describe public/content/articles.json')
    editorial_records = editorial.get('summary', {}).get('records')
    if not isinstance(editorial_records, dict):
        raise ValueError('Editorial report does not contain a records summary')

    next_order = max(article.get('order', 0) for article in baseline) + 1
    new_articles = []
    new_documents = []
    new_assets = []
    pending_writes = []
    for offset, job in enumerate(jobs):
        article, document, assets, writes = parse_job(job, args.incoming, next_order + offset)
        new_articles.append(article)
        new_documents.append(document)
        new_assets.extend(assets)
        pending_writes.extend(writes)

    destinations = [destination for destination, _ in pending_writes]
    if len(destinations) != len(set(destinations)):
        raise ValueError('DOCX jobs produce duplicate asset destinations')
    if len(new_assets) != 17:
        raise AssertionError('Second DOCX batch must produce exactly seventeen assets')

    final_articles = new_articles + copy.deepcopy(baseline)
    if final_articles[len(new_articles):] != baseline:
        raise AssertionError('Baseline article objects changed during import')

    for destination, payload in pending_writes:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            destination.write_bytes(payload)

    report['assets'].extend(new_assets)
    report['documents'].extend(new_documents)
    save_json(ROOT / 'public/content/articles.json', final_articles)
    save_json(report_path, report)

    article_path = ROOT / 'public/content/articles.json'
    article_bytes = article_path.read_bytes()
    article_output.update(records=len(final_articles), bytes=len(article_bytes), sha256=sha256(article_bytes))
    editorial_records['articles'] = len(final_articles)
    save_json(editorial_path, editorial)

    print(json.dumps(
        {'articles': len(final_articles), 'newArticles': len(new_articles), 'newImages': len(new_assets)},
        separators=(',', ':'),
    ))


if __name__ == '__main__':
    main()
