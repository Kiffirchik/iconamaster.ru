#!/usr/bin/env python3
"""Create only missing Cargo JPEG deployment derivatives using Pillow.

Run with any Python 3 runtime containing Pillow:
  <python> scripts/prepare-cargo-deployment-images.py --root <release-worktree>
  <python> scripts/prepare-cargo-deployment-images.py --root <release-worktree> --verify-only

No originals or existing derivatives are overwritten. No build/deploy is run.
The report is create-only; --verify-only safely rechecks a completed batch.
"""

import argparse
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, __version__ as pillow_version


def digest(data):
    return hashlib.sha256(data).hexdigest()


def snapshot(root, paths):
    return {p.relative_to(root).as_posix(): digest(p.read_bytes()) for p in paths}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def decoded(data):
    with Image.open(io.BytesIO(data)) as check:
        check.verify()
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def verify(root, report):
    for category in ('originals', 'existingDerivatives'):
        for rel, expected in report['protectedSha256'][category].items():
            require(digest((root / rel).read_bytes()) == expected,
                    f'Protected file changed: {rel}')
    for item in report['images']:
        source = (root / item['source']).read_bytes()
        output = (root / item['output']).read_bytes()
        require(digest(source) == item['sourceSha256'], f'Source changed: {item["source"]}')
        require(digest(output) == item['outputSha256'], f'Output changed: {item["output"]}')
        with decoded(source) as src, decoded(output) as out:
            require(out.format == 'JPEG', 'Output must be JPEG')
            require(list(src.size) == item['sourceDimensions'], 'Source dimensions mismatch')
            require(list(out.size) == item['outputDimensions'], 'Output dimensions mismatch')
            expected = src.copy()
            expected.thumbnail((report['settings']['maxLongEdge'],) * 2, Image.Resampling.LANCZOS)
            require(out.size == expected.size, 'Aspect ratio/size mismatch')
            expected.close()
            require(out.mode == src.mode, 'Color mode changed')
            require(out.info.get('icc_profile') == src.info.get('icc_profile'), 'ICC changed')
            require(out.info.get('exif') == src.info.get('exif'), 'EXIF changed')
        require(len(source) == item['sourceBytes'], 'Source byte count mismatch')
        require(len(output) == item['outputBytes'] and len(output) < len(source),
                f'Derivative is not smaller: {item["output"]}')
    return {'originalHashesUnchanged': True, 'existingDerivativeHashesUnchanged': True,
            'allOutputsDecodable': True, 'allOutputsSmaller': True,
            'fullCompositionAndAspectPreserved': True, 'iccAndExifPreserved': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--max-long-edge', type=int, default=1600)
    parser.add_argument('--quality', type=int, default=90)
    parser.add_argument('--min-quality', type=int, default=75)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    require(1 <= args.max_long_edge <= 1600, 'Long edge must be between 1 and 1600')
    require(1 <= args.quality <= 95, 'Quality must be between 1 and 95')
    require(1 <= args.min_quality <= args.quality, 'Invalid minimum quality')
    root = args.root.resolve()
    source_dir = root / 'public/assets/icons'
    derivative_dir = root / 'release/optimized-assets/assets'
    output_dir = derivative_dir / 'icons'
    report_path = root / 'reports/cargo-deployment-images.json'
    for p in (source_dir, derivative_dir, output_dir, report_path):
        require(p.resolve().is_relative_to(root), f'Path escapes worktree: {p}')
    if args.verify_only:
        report = json.loads(report_path.read_text(encoding='utf-8'))
        print(json.dumps({'verifiedImages': len(report['images']), **verify(root, report)}, indent=2))
        return
    require(not report_path.exists(), 'Report already exists; use --verify-only')
    sources = sorted(source_dir.glob('*-cargo-*.jpg'))
    require(len(sources) == 65, f'Expected exactly 65 Cargo JPEGs, found {len(sources)}')
    manifest = json.loads((source_dir / 'manifest.json').read_text(encoding='utf-8'))
    originals = sorted({source_dir / entry['file'] for entry in manifest})
    require(len(originals) == 144, f'Expected 144 original files, found {len(originals)}')
    existing = sorted(p for p in derivative_dir.rglob('*') if p.is_file())
    require(len(existing) == 247, f'Expected 247 existing derivatives, found {len(existing)}')
    for p in originals + existing + sources:
        require(p.resolve().is_relative_to(root) and not p.is_symlink(), f'Unsafe file: {p}')
    for p in sources:
        require(not (output_dir / p.name).exists(), f'Refusing to overwrite {p.name}')
    protected = {'originals': snapshot(root, originals),
                 'existingDerivatives': snapshot(root, existing)}
    manifest_hashes = {entry['file']: entry['sha256'] for entry in manifest}
    for p in originals:
        require(protected['originals'][p.relative_to(root).as_posix()] == manifest_hashes[p.name],
                f'Original does not match manifest SHA256: {p.name}')
    images, pending = [], []
    # Encode and decode the entire batch in memory before any output is created.
    for p in sources:
        source = p.read_bytes()
        with decoded(source) as src:
            require(src.format == 'JPEG' and src.mode == 'RGB', f'Unsupported image: {p.name}')
            transformed = src.copy()
            transformed.thumbnail((args.max_long_edge,) * 2, Image.Resampling.LANCZOS)
            options = dict(subsampling=0, optimize=True, progressive=True)
            for key in ('icc_profile', 'exif'):
                if key in src.info:
                    options[key] = src.info[key]
            qualities = sorted({args.quality, args.min_quality} |
                               {q for q in (90, 88, 85, 82, 80, 78, 75)
                                if args.min_quality <= q <= args.quality}, reverse=True)
            for quality in qualities:
                stream = io.BytesIO()
                transformed.save(stream, format='JPEG', quality=quality, **options)
                output = stream.getvalue()
                if len(output) < len(source):
                    break
            with decoded(output) as out:
                require(out.size == transformed.size, f'Encode dimensions mismatch: {p.name}')
                require(out.info.get('icc_profile') == src.info.get('icc_profile'), 'ICC not preserved')
                require(out.info.get('exif') == src.info.get('exif'), 'EXIF not preserved')
            require(len(output) < len(source), f'Quality floor {args.min_quality} does not reduce {p.name}; no files written')
            destination = output_dir / p.name
            images.append({'source': p.relative_to(root).as_posix(),
                           'output': destination.relative_to(root).as_posix(),
                           'sourceSha256': digest(source), 'outputSha256': digest(output),
                           'sourceDimensions': list(src.size), 'outputDimensions': list(transformed.size),
                           'sourceBytes': len(source), 'outputBytes': len(output),
                           'savedBytes': len(source) - len(output),
                           'quality': quality,
                           'iccSha256': digest(src.info['icc_profile']) if src.info.get('icc_profile') else None,
                           'exifOrientation': src.getexif().get(274, 1)})
            transformed.close()
            pending.append((destination, output))
    report = {'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
              'runtime': {'library': 'Pillow', 'version': pillow_version},
              'settings': {'maxLongEdge': args.max_long_edge, 'qualityCeiling': args.quality,
                           'qualityFloor': args.min_quality, 'qualityPolicy': 'highest-smaller-among-candidates',
                           'qualityCandidates': qualities,
                           'subsampling': '4:4:4', 'progressive': True, 'optimize': True,
                           'resampling': 'LANCZOS', 'crop': False, 'upscale': False,
                           'colorTransforms': False, 'preserveIcc': True, 'preserveExif': True},
              'protectedSha256': protected, 'images': images,
              'summary': {'imageCount': len(images), 'protectedOriginals': len(originals),
                          'protectedExistingDerivatives': len(existing),
                          'sourceBytes': sum(x['sourceBytes'] for x in images),
                          'outputBytes': sum(x['outputBytes'] for x in images)}}
    # Recheck immutable inputs immediately before the create-only write phase.
    require(snapshot(root, originals) == protected['originals'], 'Originals changed during encoding')
    require(snapshot(root, existing) == protected['existingDerivatives'], 'Existing derivatives changed during encoding')
    output_dir.mkdir(parents=True, exist_ok=True)
    for destination, output in pending:
        with destination.open('xb') as handle:
            handle.write(output)
    report['verification'] = verify(root, report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open('x', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    print(json.dumps({'report': str(report_path), **report['summary'], **report['verification']}, indent=2))


if __name__ == '__main__':
    main()
