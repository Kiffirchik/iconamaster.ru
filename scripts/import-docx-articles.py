"""Import the approved September DOCX batch without changing existing live text.

Run with bundled Python (lxml, Pillow):
  import-docx-articles.py --incoming <directory> --baseline <downloaded-live-articles.json>
The caller must compare hosting hashes again before deployment.
"""
import argparse
import copy
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path
from lxml import etree as E
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
def sha(data):
    return hashlib.sha256(data).hexdigest()
def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--incoming', type=Path, required=True)
    parser.add_argument('--baseline', type=Path, required=True)
    args = parser.parse_args()
    baseline = json.loads(args.baseline.read_text(encoding='utf-8-sig'))
    articles = copy.deepcopy(baseline)
    report = {'schemaVersion':1, 'source':'Owner-supplied DOCX documents, September 2026', 'assets':[], 'documents':[]}
    jobs = [
        ('История меднолитых икон.docx','history-of-cast-icons','История меднолитых икон',8),
        ('Литые Кресты.docx','cast-crosses','Литые кресты',12),
        ('Иконопись в Русском Пантелеймоновом монастыре.docx','panteleimon-monastery-icons','Иконы Русского Пантелеймонова монастыря',6),
    ]
    new_articles = []
    for filename, slug, title, expected_images in jobs:
        if slug != 'panteleimon-monastery-icons' and any(a['slug']==slug for a in baseline):
            raise ValueError('Already imported: '+slug)
        file = args.incoming / filename
        records=[]; images=[]; paragraphs={}
        with zipfile.ZipFile(file) as archive:
            xml=E.fromstring(archive.read('word/document.xml'))
            if xml.xpath('//*[local-name()="ins" or local-name()="del"]'):
                raise ValueError('Unsupported tracked changes in '+filename)
            # This reviewed batch uses tables only for image rows and their captions.
            # Reading descendant paragraphs keeps both in document order.
            if xml.xpath('//*[local-name()="xfrm"]/@rot'):
                raise ValueError('Rotation requires explicit handling')
            rels={r.get('Id'):r.get('Target') for r in E.fromstring(archive.read('word/_rels/document.xml.rels'))}
            existing = {sha(p.read_bytes()):p for p in (ROOT/'public/assets/articles').glob('panteleimon*')} if slug=='panteleimon-monastery-icons' else {}
            for index,p in enumerate(xml.xpath('//*[local-name()="body"]//*[local-name()="p"]'),1):
                text=''.join(p.xpath('.//*[local-name()="t"]/text()')).strip()
                if text:
                    paragraphs[index]=text
                    records.append(('text',index,text))
                for node in p.xpath('.//*[local-name()="blip" or local-name()="imagedata"]'):
                    rid=node.get(R+'embed') or node.get(R+'id')
                    target=rels[rid]
                    if not target.startswith('media/') or '..' in target:
                        raise ValueError('Unexpected image target')
                    payload=archive.read('word/'+target)
                    digest=sha(payload)
                    with Image.open(io.BytesIO(payload)) as image:
                        width,height=image.size
                    original=existing.get(digest)
                    if original:
                        src='/'+original.relative_to(ROOT/'public').as_posix()
                    else:
                        suffix=Path(target).suffix.lower().replace('.jpeg','.jpg')
                        src=f'/assets/articles/docx/{slug}-{len(images)+1}{suffix}'
                        destination=ROOT/'public'/src.lstrip('/')
                        destination.parent.mkdir(parents=True,exist_ok=True)
                        if destination.exists() and sha(destination.read_bytes())!=digest:
                            raise ValueError('Refusing to overwrite different image')
                        destination.write_bytes(payload)
                        report['assets'].append(dict(src=src,alt=title,width=width,height=height,bytes=len(payload),
                            sha256=digest,provenance='docx-embedded-original',sourceRef='docx:'+filename+'#/word/'+target,
                            ownerType='article',ownerSlug=slug,order=len(images)+1))
                    meta=dict(src=src,alt=title+' — иллюстрация '+str(len(images)+1),width=width,height=height)
                    images.append(meta); records.append(('image',index,meta))
            assert len(images)==expected_images, (filename,len(images))
        report['documents'].append(dict(filename=filename,slug=slug,sha256=sha(file.read_bytes()),paragraphs=len(paragraphs),
            images=len(images),embeddedImageSources=[i['src'] for i in images]))
        if slug=='panteleimon-monastery-icons':
            article=next(a for a in articles if a['slug']==slug)
            for section in article['sections']:
                if section['type']=='text':
                    section['paragraphs']=[t.replace('листков духовного содержания и литографий.',
                        'листков духовного содержания и литографий, а также ввел в процесс обучения иконописцев методики академического письма.')
                        for t in section['paragraphs']]
            shestokovskaya=paragraphs[14].split('Индивидуальные приемы')[0].strip()
            for needle, image in [('Русско-афонская иконописная школа славилась',images[2]),
                                  ('В начале ХХ века',images[3]),('Индивидуальные приемы',images[5])]:
                position=next(i for i,s in enumerate(article['sections']) if any(needle in t for t in s.get('paragraphs',[])))
                if needle=='Индивидуальные приемы':
                    article['sections'][position]['paragraphs'].insert(0,shestokovskaya)
                article['sections'].insert(position,{'type':'image','image':image})
            continue
        sections=[]
        headings={20,23,26,33,44,46,49,60,68,72} if slug=='history-of-cast-icons' else set()
        for kind,index,value in records:
            if kind=='image':
                if sections and sections[-1]['type']=='image':
                    sections[-1]={'type':'gallery','images':[sections[-1]['image'],value]}
                elif sections and sections[-1]['type']=='gallery' and len(sections[-1]['images'])<3:
                    sections[-1]['images'].append(value)
                else:
                    sections.append({'type':'image','image':value})
            elif index==1 or index in headings:
                sections.append({'type':'text','heading':re.sub(r'\s+',' ',value),'paragraphs':[]})
            elif sections and sections[-1]['type']=='text':
                sections[-1]['paragraphs'].append(value)
            else:
                sections.append({'type':'text','paragraphs':[value]})
        summary=('История меднолитой иконы на Руси: от византийских образцов и новгородских мастерских до Гуслиц, Выга и московского литья.'
                 if slug=='history-of-cast-icons' else
                 'Киотные кресты в старообрядческой традиции: литейные центры, разновидности, изображения и толкование надписей.')
        cover=dict(images[0],sha256=sha((ROOT/'public'/images[0]['src'].lstrip('/')).read_bytes()),provenance='docx-embedded-original')
        new_articles.append(dict(id=slug,slug=slug,title=title,published=True,order=102+len(new_articles),
            sourceUrl='docx:'+slug+'.docx',summary=summary,image=cover,sections=sections))
        # Independent loss guard: every source paragraph survives as prose, heading or caption.
        represented=json.dumps(sections,ensure_ascii=False)
        for index,text in paragraphs.items():
            normalized=re.sub(r'\s+',' ',text) if index==1 or index in headings else text
            assert json.dumps(normalized,ensure_ascii=False)[1:-1] in represented, (slug,index)
    save(ROOT/'public/content/articles.json',new_articles+articles)
    save(ROOT/'reports/docx-import.json',report)
    # Refresh current output checksums without rewriting the historical Cargo inventory.
    editorial_path=ROOT/'reports/editorial-migration.json'
    editorial=json.loads(editorial_path.read_text(encoding='utf-8'))
    for output in editorial['outputs']:
        if output['path']=='public/content/articles.json':
            data=(ROOT/output['path']).read_bytes()
            output.update(records=len(articles)+len(new_articles),bytes=len(data),sha256=sha(data))
    editorial['summary']['records']['articles']=len(articles)+len(new_articles)
    save(editorial_path,editorial)
    print(json.dumps({'articles':len(articles)+len(new_articles),'newArticles':len(new_articles),'newImages':len(report['assets'])}))

if __name__=='__main__':
    main()
