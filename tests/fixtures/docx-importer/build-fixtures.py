"""Build minimal DOCX inputs for the second-batch importer integration tests."""

import argparse
import binascii
import struct
import zlib
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


JOBS = [
    ('Ветковская школа иконописи..docx', 49, 7),
    ('Иконописные традиции села Палех.docx', 38, 7),
    ('Пешехоновская икона. Византийский стиль.docx', 36, 3),
]


def png_bytes(seed):
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack(
            '>I', binascii.crc32(kind + payload) & 0xFFFFFFFF,
        )

    pixel = bytes((seed % 251, (seed * 3) % 251, (seed * 7) % 251))
    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(b'\x00' + pixel))
        + chunk(b'IEND', b'')
    )


def text_runs(parts):
    runs = []
    for part in parts:
        if part is None:
            runs.append('<w:r><w:tab/></w:r>')
        else:
            runs.append(f'<w:r><w:t xml:space="preserve">{escape(part)}</w:t></w:r>')
    return ''.join(runs)


def paragraph_parts(filename, index):
    if filename.startswith('Ветковская'):
        if index == 1:
            return ['Иконописная традиция Ветки']
        if index == 3:
            return ['•', None, 'Декоративность']
        if index == 5:
            return ['Удалить только суффикс elib.rshu.ru +1']
        if index == 6:
            return ['Сохранить elib.rshu.ru +1 внутри строки']
    if filename.startswith('Иконописные традиции'):
        if index == 1:
            return ['Иконописные традиции села Палех']
        if index == 4:
            return ['Чужой суффикс elib.rshu.ru +1']
    if filename.startswith('Пешехоновская') and index == 2:
        return ['Пешехоновская икона.']
    return [f'Абзац {index} документа {filename}']


def build_docx(output, filename, paragraph_count, image_count, mode, seed_offset):
    paragraphs = []
    for index in range(1, paragraph_count + 1):
        drawing = ''
        if index <= image_count:
            drawing = (
                '<w:r><w:drawing><a:blip r:embed="rId'
                + str(index)
                + '"/></w:drawing></w:r>'
            )
        vml = ''
        if index == 1 and mode == 'vml-style-rotation':
            vml = '<v:shape id="rotated-style" style="width:1pt;rotation:90;height:1pt"/>'
        elif index == 1 and mode == 'vml-attribute-rotation':
            vml = '<v:shape id="rotated-attribute" rotation="90"/>'
        paragraphs.append(
            '<w:p>' + text_runs(paragraph_parts(filename, index)) + drawing + vml + '</w:p>',
        )

    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document '
        'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:v="urn:schemas-microsoft-com:vml">'
        '<w:body>' + ''.join(paragraphs) + '</w:body></w:document>'
    )
    relationships = ''.join(
        '<Relationship Id="rId{index}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
        'Target="media/image{index}.png"/>'.format(index=index)
        for index in range(1, image_count + 1)
    )
    relationships = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + relationships
        + '</Relationships>'
    )

    with zipfile.ZipFile(output / filename, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('word/document.xml', document)
        archive.writestr('word/_rels/document.xml.rels', relationships)
        for index in range(1, image_count + 1):
            archive.writestr(
                f'word/media/image{index}.png',
                png_bytes(seed_offset + index),
            )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument(
        '--mode',
        choices=['valid', 'vml-style-rotation', 'vml-attribute-rotation'],
        default='valid',
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for offset, (filename, paragraphs, images) in enumerate(JOBS):
        mode = args.mode if offset == 0 else 'valid'
        build_docx(args.output, filename, paragraphs, images, mode, offset * 32)


if __name__ == '__main__':
    main()
