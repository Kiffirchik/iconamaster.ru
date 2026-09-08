<?php
// Run against a PRIVATE extracted build, never against the production document root.
$root = $argv[1];
if (strpos(basename($root), 'editor-test-') !== 0) die("Private editor-test-* directory required\n");
require $root.'/corona/admin/text-editor/render.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); echo 'PASS '.$message."\n"; }
function form_fields($kind, $row) { $values=array(); foreach(ce_fields($kind,$row) as $k=>$v) $values[$k]=$v[2]; return $values; }
function rejected_save($root,$kind,$row,$input,$revision) {
    try { ce_save($root,$kind,$row['slug'],$revision,$input); } catch(Exception $ex) { return true; }
    return false;
}
$bundle = ce_bundle($root);
$iconsOriginal=file_get_contents($root.'/content/icons.json');
$articlesOriginal=file_get_contents($root.'/content/articles.json');
$icons=$bundle['icons']; $i=ce_find($icons,'theotokos-kazanskaya'); $row=$icons[$i];
$revision=ce_revision($row); $input=form_fields('icons',$row);
check(strlen(ce_random(32))===32 && ce_random(32)!==ce_random(32),'cryptographic random source');
check(ce_equal('abc','abc') && !ce_equal('abc','abd') && !ce_equal('abc',array()),'constant time comparison handles invalid input');
check(ce_save($root,'icons',$row['slug'],$revision,$input)===false,'no-op does not rewrite source');
check(file_get_contents($root.'/content/icons.json')===$iconsOriginal,'exact original bytes preserved on no-op');
$bad=$input; $bad['slug']='injected';
check(rejected_save($root,'icons',$row,$bad,$revision),'immutable slug cannot be submitted');
$bad=$input; $bad['title']='';
check(rejected_save($root,'icons',$row,$bad,$revision),'empty title rejected');
$bad=$input; $bad['price']=array('bad');
check(rejected_save($root,'icons',$row,$bad,$revision),'non-text values rejected');
$input['price']='123 456 руб.'; $input['description']='Проверка <script>alert(1)</script> & "кавычки"';
check(ce_save($root,'icons',$row['slug'],$revision,$input),'price and description save');
$updated=ce_bundle($root); $new=$updated['icons'][$i];
check($new['price']===$input['price'] && $new['images']===$row['images'] && $new['slug']===$row['slug'],'only text changed, images and URL preserved');
check(rejected_save($root,'icons',$row,$input,$revision),'stale tab cannot overwrite newer save');
$map=ce_read($root.'/.live-templates/routes.json');
$route='/icons/'.$row['slug'];
$html=ce_render(file_get_contents($root.'/.live-templates/'.$map[$route]),$route,$updated);
check(strpos($html,'123 456 руб.')!==false && strpos($html,'&lt;script&gt;')!==false && strpos($html,'<script>alert(1)')===false,'fresh price and escaped description in server HTML');
check(strpos($html,'id="live-content"')!==false && strpos($html,'<!--LIVE:')===false,'fresh client snapshot and resolved slots');
check(count(glob($root.'/.editor-state/icons-*.json'))===1,'one private backup per actual save');
$article=$bundle['articles'][0]; $articleInput=form_fields('articles',$article);
$articleInput['title']='Тестовая статья';
foreach($articleInput as $key=>$value) if(strpos($key,'paragraphs_')===0) { $articleInput[$key]="Первый абзац\n\nВторой абзац"; break; }
check(ce_save($root,'articles',$article['slug'],ce_revision($article),$articleInput),'article paragraphs save');
$updated=ce_bundle($root); $articleNew=$updated['articles'][0];
foreach($article['sections'] as $k=>$section) if($section['type']!=='text') check($articleNew['sections'][$k]===$section,'article media preserved '.$k);
$route='/articles/'.$article['slug'];
$html=ce_render(file_get_contents($root.'/.live-templates/'.$map[$route]),$route,$updated);
check(strpos($html,'<h1>Тестовая статья</h1>')!==false && strpos($html,'<p>Первый абзац</p><p>Второй абзац</p>')!==false,'new article text and paragraphs in server HTML');
// Restore private fixtures before rendering every real route.
file_put_contents($root.'/content/icons.json',$iconsOriginal);
file_put_contents($root.'/content/articles.json',$articlesOriginal);
foreach($map as $route=>$file) {
    $html=ce_render(file_get_contents($root.'/.live-templates/'.$file),$route,$bundle);
    if(strpos($html,'<!--LIVE:')!==false || strpos($html,'id="live-content"')===false) throw new RuntimeException('Bad render '.$route);
}
check(true,'all '.count($map).' production routes render');
