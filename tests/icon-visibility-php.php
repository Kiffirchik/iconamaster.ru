<?php
$root=$argv[1];
if (strpos(basename($root),'editor-test-')!==0) die('Private fixture required');
require $root.'/corona/admin/text-editor/render.php';
function visibility_check($ok,$message) { if(!$ok) throw new RuntimeException($message); echo 'PASS '.$message."\n"; }
$original=file_get_contents($root.'/content/icons.json');
$bundle=ce_bundle($root); $i=ce_find($bundle['icons'],'archangel-michael'); $row=$bundle['icons'][$i];
visibility_check(ce_save($root,'icons',$row['slug'],ce_revision($row),null,'hide'),'hide saved');
$hidden=ce_bundle($root); $new=$hidden['icons'][$i];
visibility_check($new['published']===false,'published flag disabled');
$expected=$bundle['icons']; $expected[$i]['published']=false;
visibility_check($hidden['icons']===$expected,'all other records, text, prices and photos preserved');
$backups=glob($root.'/.editor-state/icons-*.json'); $found=false;
foreach($backups as $backup) if(file_get_contents($backup)===$original) $found=true;
visibility_check($found,'exact original backed up');
visibility_check(ce_save($root,'icons',$row['slug'],ce_revision($new),null,'hide')===false,'repeated hide is no-op');
$rejected=false;try{ce_save($root,'icons',$row['slug'],ce_revision($row),null,'show');}catch(Exception $ex){$rejected=true;}
visibility_check($rejected,'stale restore rejected');
foreach(array('delete','toggle') as $action){$rejected=false;try{ce_save($root,'icons',$row['slug'],ce_revision($new),null,$action);}catch(Exception $ex){$rejected=true;}visibility_check($rejected,'unknown action rejected');}
$article=$bundle['articles'][0];$rejected=false;try{ce_save($root,'articles',$article['slug'],ce_revision($article),null,'hide');}catch(Exception $ex){$rejected=true;}
visibility_check($rejected,'icon visibility action cannot change articles');
visibility_check(!ce_route_visible('/icons/archangel-michael',$hidden),'direct hidden URL unavailable');
$routes=ce_read($root.'/.live-templates/routes.json');
foreach(array('/','/collection') as $route){
  $html=ce_render(file_get_contents($root.'/.live-templates/'.$routes[$route]),$route,$hidden);
  // The large JSON snapshot lives in head; avoid legacy PCRE backtracking limits.
  $visible=substr($html,strpos($html,'<body'));
  visibility_check(strpos($visible,'href="/icons/archangel-michael"')===false,'no hidden links on '.$route);
  visibility_check(strpos($visible,'data-live-visible="archangel-michael"')===false,'whole hidden wrappers removed on '.$route);
  visibility_check(strpos($visible,'<h1')!==false,'main heading preserved on '.$route);
}
$sitemap=ce_visible_sitemap(file_get_contents($root.'/.live-templates/sitemap.xml'),$hidden);
visibility_check(strpos($sitemap,'/icons/archangel-michael</loc>')===false,'hidden icon removed from sitemap');
visibility_check(strpos($sitemap,'/collection</loc>')!==false,'other sitemap routes preserved');
$navBundle=$bundle;$navBundle['icons']=array(
array('slug'=>'first','published'=>true,'images'=>array(1),'order'=>0),
array('slug'=>'hidden','published'=>false,'images'=>array(1),'order'=>1),
array('slug'=>'last','published'=>true,'images'=>array(1),'order'=>2));
$renderer=new CeSlots($navBundle);
visibility_check(strpos($renderer->slot(array('','icon-navigation','first')),'href="/icons/last"')!==false,'next navigation skips hidden');
visibility_check(strpos($renderer->slot(array('','icon-navigation','last')),'href="/icons/first"')!==false,'navigation wraps to visible first');
visibility_check(ce_save($root,'icons',$row['slug'],ce_revision($new),null,'show'),'restore saved');
$restored=ce_bundle($root);
visibility_check($restored['icons']===$bundle['icons'],'restore preserves exact data');
visibility_check(ce_route_visible('/icons/archangel-michael',$restored),'restored route available');
visibility_check(strpos(ce_visible_sitemap(file_get_contents($root.'/.live-templates/sitemap.xml'),$restored),'/icons/archangel-michael</loc>')!==false,'restored sitemap entry');
file_put_contents($root.'/content/icons.json',$original);
