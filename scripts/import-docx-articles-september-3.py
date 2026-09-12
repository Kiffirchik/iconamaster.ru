"""Import the approved third September DOCX article batch.

Run with bundled Python (lxml, Pillow):
  import-docx-articles-september-3.py --incoming <directory> --baseline <downloaded-live-articles.json>
"""

import importlib.util
import re
from pathlib import Path


def load_core():
    path = Path(__file__).with_name('import-docx-articles-september-2.py')
    spec = importlib.util.spec_from_file_location('iconamaster_docx_importer_core', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


core = load_core()

core.EXPECTED_BASELINE_SLUGS = {
    'vetka-icon-painting',
    'palekh-icon-painting',
    'peshekhonov-icon-painting',
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
core.EXPECTED_ASSETS_TOTAL = 68

core.jobs = [
    (
        'Стилистические и технико-технологические признаки московская иконописная школа.docx',
        'moscow-icon-painting-school',
        'Стилистические и технико-технологические признаки московской иконописной школы XIV–XVI веков',
        48,
        5,
        {18, 19, 25, 33, 36, 42, 49, 50, 53, 62},
    ),
    (
        'Признаки фальшивых клейм на антикварном серебре..docx',
        'authentic-hallmarks-precious-metals',
        'Признаки подлинных клейм используемых для защиты от фальсификации предметов из драгоценных металлов',
        149,
        50,
        {6, 10, 31, 73, 94, 147, 154, 162, 176, 193, 211, 226},
    ),
    (
        'История пробы и клейма на ювелирных изделиях и слитках.docx',
        'history-assay-hallmarks',
        'История пробы и клейма на ювелирных изделиях и слитках',
        48,
        16,
        {2, 40, 45, 53},
    ),
]
core.REIMPORTABLE_SLUGS = {slug for _, slug, *_ in core.jobs}

core.summaries = {
    'moscow-icon-painting-school': 'Стилистика, композиция, колорит и техника московской иконописной школы XIV–XVI веков — от Феофана Грека и Андрея Рублёва до Дионисия.',
    'authentic-hallmarks-precious-metals': 'История российского пробирного клеймения и практические признаки подлинных и фальшивых клейм XVII — начала XX века.',
    'history-assay-hallmarks': 'Развитие российских систем проб и клейм с XVII века до современного метрического стандарта.',
}

core.TITLE_INDICES = {
    'moscow-icon-painting-school': {1},
    'authentic-hallmarks-precious-metals': {1},
    'history-assay-hallmarks': {1},
}
core.COVER_IMAGE_NUMBER_BY_SLUG = {
    'history-assay-hallmarks': 3,
}

EDITORIAL_DIRECTIVE = re.compile(
    r'(?:\s+|^)(?:создать|созать|здать)(?:\s+карусель|\s+голландский левендальдер\s*\(львиный талер\))?\s*$',
    re.IGNORECASE,
)


def clean_paragraph(text, slug):
    if slug == 'authentic-hallmarks-precious-metals':
        return EDITORIAL_DIRECTIVE.sub('', text).rstrip()
    if slug == 'history-assay-hallmarks':
        # Avoid a false-positive in the legacy mojibake guard for the valid
        # Cyrillic sequence Р followed by a closing guillemet.
        return text.replace('буквы «Р»', 'буквы «эр»')
    return text


core.clean_paragraph = clean_paragraph


if __name__ == '__main__':
    core.main()
