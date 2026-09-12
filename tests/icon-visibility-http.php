<?php
require dirname(__FILE__).'/live-editor-http.php';
$path='/corona/admin/content.php?kind=icons&slug=archangel-michael';
$json=request('/content/icons.json');$original=json_decode($json[1],true);
foreach($original as $row) if($row['slug']==='archangel-michael') break;
$r=request($path);verify($r[0]===200 && strpos($r[1],'>Скрыть с сайта</button>')!==false,'hide button in editor');
$data=array('csrf'=>token($r[1],'csrf'),'revision'=>token($r[1],'revision'),'action'=>'hide');
$bad=$data;$bad['csrf']='invalid';$r=request($path,$bad);
$json=request('/content/icons.json');verify($r[0]===403 && json_decode($json[1],true)===$original,'hide CSRF rejected without writes');
$r=request($path,$data);verify($r[0]===303,'hide POST succeeds');
$json=request('/content/icons.json');$hidden=json_decode($json[1],true);
$expected=$original;foreach($expected as $i=>$item)if($item['slug']==='archangel-michael')$expected[$i]['published']=false;
verify($hidden===$expected,'HTTP hide changes only publication flag');
$r=request('/content-page.php?route=/icons/archangel-michael');
$body=substr($r[1],strpos($r[1],'<body'));
verify($r[0]===404 && strpos($r[2],'no-store')!==false && strpos($body,'icon-detail-page__layout')===false,'direct hidden route is 404 with no visible card');
foreach(array('/','/collection') as $route){
  $r=request('/content-page.php?route='.$route);$body=substr($r[1],strpos($r[1],'<body'));
  verify($r[0]===200 && strpos($body,'href="/icons/archangel-michael"')===false && strpos($body,'data-live-visible="archangel-michael"')===false,'hidden card and image absent from HTTP '.$route);
}
$r=request('/content-sitemap.php');verify($r[0]===200 && strpos($r[1],'/icons/archangel-michael</loc>')===false,'HTTP sitemap excludes hidden icon');
$r=request('/corona/admin/content.php?kind=icons');verify(strpos($r[1],'visibility-badge">Скрыта</strong>')!==false,'hidden record remains in admin list');
$r=request($path);verify(strpos($r[1],'>Вернуть на сайт</button>')!==false && strpos($r[1],'Статус: Скрыта')!==false,'restore button and hidden status');
$fields=array();foreach(array('title','price','discount','newPrice','availability','description','moreDetails','size','period','purpose','technique','condition','expertise') as $key)$fields[$key]=isset($row[$key]) ? (string)$row[$key] : '';
$save=array('csrf'=>$data['csrf'],'revision'=>token($r[1],'revision'),'fields'=>$fields);
$save['fields']['description']='Private visibility test';
$r=request($path,$save);verify($r[0]===303,'hidden record remains editable');
$r=request($path);$save['revision']=token($r[1],'revision');$save['fields']=$fields;
$r=request($path,$save);verify($r[0]===303,'hidden description restored');
$stale=$data;$stale['action']='show';$r=request($path,$stale);verify($r[0]===400,'stale restore rejected via HTTP');
$r=request($path);$data['revision']=token($r[1],'revision');$data['action']='show';
$r=request($path,$data);verify($r[0]===303,'restore POST succeeds');
$json=request('/content/icons.json');verify(json_decode($json[1],true)===$original,'HTTP restore retains all original data');
$r=request('/content-page.php?route=/icons/archangel-michael');verify($r[0]===200 && strpos($r[1],'icon-detail-page__layout')!==false,'restored direct route displays card');
$r=request('/content-page.php?route=/collection');verify(strpos($r[1],'href="/icons/archangel-michael"')!==false,'restored icon in collection without build');
$r=request('/content-sitemap.php');verify(strpos($r[1],'/icons/archangel-michael</loc>')!==false,'restored icon in HTTP sitemap');
