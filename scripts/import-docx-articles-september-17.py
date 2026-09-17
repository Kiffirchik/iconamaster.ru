"""Import the September 17 source documents, preserving original media and prose.

Uses the established DOCX importer. Tables become labelled text blocks using
the existing site schema, so no frontend/editor changes are needed.
"""
import importlib.util
import zipfile
from pathlib import Path
from lxml import etree as E

spec = importlib.util.spec_from_file_location('docx_core', Path(__file__).with_name('import-docx-articles-september-2.py'))
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
core.EXPECTED_BASELINE_SLUGS.update({
    'vetka-icon-painting', 'palekh-icon-painting', 'peshekhonov-icon-painting',
    'moscow-icon-painting-school', 'authentic-hallmarks-precious-metals', 'history-assay-hallmarks',
})
core.EXPECTED_ASSETS_TOTAL = 14  # One pigment photo appears twice in the source.
core.jobs = [
    ('Краски в иконописи.docx', 'icon-painting-pigments', 'Краски в иконописи', 265, 12,
     {4,29,32,36,49,51,58,64,66,68,76,81,83,86,93,101,104,108,116,123,125,128,134,
      137,140,147,152,160,165,167,172,193,200,205,210,214,218,223,230,236,240,244,
      247,249,256,258,266,268,273,279,281,283,285,287,292,302}),
    ('Левкас.docx', 'levkas', 'Левкас', 33, 2, {5,16,22,32}),
    ('Техника золочения листовым золотом, Мардан, Полимен, Ассист.docx',
     'gold-leaf-gilding', 'Техники золочения икон листовым золотом: мордан, полимент, ассист',
     96, 1, {5,8,13,20,23,29,42,62,65,70,83}),
]
core.TITLE_INDICES = {slug: {1} for _, slug, *_ in core.jobs}
core.summaries = {
    'icon-painting-pigments': 'Минеральные и органические пигменты традиционной иконописи: происхождение, свойства, символика цвета и работа с яичной темперой.',
    'levkas': 'Состав традиционного иконописного грунта, подготовка доски и паволоки, нанесение и шлифовка левкаса.',
    'gold-leaf-gilding': 'Полиментное золочение, золочение на мордан и ассист: материалы, этапы работы и различия трёх техник.',
}
core.REIMPORTABLE_SLUGS = set(core.TITLE_INDICES)
original_parse = core.parse_job


def reflow_table(sections, rows):
    """Replace a contiguous table's cell paragraphs with labelled comparisons."""
    if len(rows) < 2 or len(rows[0]) < 2 or any(len(row) != len(rows[0]) for row in rows):
        raise ValueError('Unsupported table structure')
    cells = [cell for row in rows for cell in row]
    for index, section in enumerate(sections):
        if section['type'] != 'text':
            continue
        paragraphs = section['paragraphs']
        for start in range(len(paragraphs) - len(cells) + 1):
            if paragraphs[start:start + len(cells)] != cells:
                continue
            replacement = []
            if start or section.get('heading'):
                replacement.append(dict(section, paragraphs=paragraphs[:start]))
            for row in rows[1:]:
                replacement.append({'type': 'text', 'heading': row[0], 'paragraphs': [
                    f'{label}: {value}' for label, value in zip(rows[0][1:], row[1:])
                ]})
            remaining = paragraphs[start + len(cells):]
            if remaining:
                replacement.append({'type': 'text', 'paragraphs': remaining})
            sections[index:index + 1] = replacement
            return
    raise ValueError('Source table not found intact in imported sections')


def parse_job(job, incoming, order):
    article, report, assets, writes = original_parse(job, incoming, order)
    with zipfile.ZipFile(incoming / job[0]) as archive:
        document = E.fromstring(archive.read('word/document.xml'))
    tables = document.xpath('//*[local-name()="tbl"]')
    for table in tables:
        rows = []
        for row in table.xpath('./*[local-name()="tr"]'):
            cells = []
            for cell in row.xpath('./*[local-name()="tc"]'):
                paragraphs = [core.paragraph_text(p) for p in cell.xpath('./*[local-name()="p"]')]
                if len(paragraphs) != 1 or not paragraphs[0]:
                    raise ValueError('Expected exactly one nonempty paragraph per table cell')
                cells.append(paragraphs[0])
            rows.append(cells)
        reflow_table(article['sections'], rows)
    # Every source paragraph is still present verbatim, except the repeated H1
    # and a table's first-column label, now implicit in each block's heading.
    report['tablesReflowed'] = len(tables)
    return article, report, assets, writes


core.parse_job = parse_job
if __name__ == '__main__':
    core.main()
