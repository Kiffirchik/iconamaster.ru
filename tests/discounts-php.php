<?php
// Private test fixture only: never save test prices to production.
$root=$argv[1];
if (strpos(basename($root), 'editor-test-') !== 0) die("Private editor-test-* directory required\n");
require $root.'/corona/admin/text-editor/render.php';
function check_discount($ok,$message) { if (!$ok) throw new RuntimeException($message); echo 'PASS '.$message."\n"; }
function discount_form($row) { $input=array(); foreach(ce_fields('icons',$row) as $key=>$field) $input[$key]=$field[2]; return $input; }
$bundle=ce_bundle($root); $row=$bundle['icons'][0];
$original=file_get_contents($root.'/content/icons.json');
$input=discount_form($row); $input['price']='100 000 руб.'; $input['discount']='10'; $input['newPrice']='90 000';
$input['availability']='В наличии';
check_discount(ce_save($root,'icons',$row['slug'],ce_revision($row),$input),'editor saves percentage and independent amount');
$updated=ce_bundle($root); $sale=$updated['icons'][0];
check_discount($sale['discount']==10 && $sale['newPrice']==90000 && $sale['images']===$row['images'],'numeric fields and unchanged icon originals');
check_discount(ce_save($root,'icons',$sale['slug'],ce_revision($sale),discount_form($sale))===false,'discount no-op preserves exact bytes');
$price=ce_price_html($sale,'price');
check_discount($price==='<p class="price"><del class="icon-price__old" aria-label="Прежняя цена">100 000 руб.</del><span class="icon-price__discount" aria-label="Скидка 10%">%</span><strong class="icon-price__new" aria-label="Новая цена">90 000 руб.</strong></p>','PHP sale markup matches React');
$map=ce_read($root.'/.live-templates/routes.json'); $route='/icons/'.$sale['slug'];
$html=ce_render(file_get_contents($root.'/.live-templates/'.$map[$route]),$route,$updated);
check_discount(strpos($html,'"price":90000')!==false && strpos($html,'icon-price__old')!==false,'server detail and structured offer use new price');
$html=ce_render(file_get_contents($root.'/.live-templates/'.$map['/collection']),'/collection',$updated);
check_discount(strpos($html,'icon-price__old')!==false && strpos($html,'90 000 руб.')!==false,'server collection shows same sale');
foreach(array(array('discount','100'),array('discount','-10'),array('newPrice',''),array('newPrice','100000'),array('newPrice','120000'),array('price','Цена по запросу')) as $case) {
    $bad=discount_form($sale); $bad[$case[0]]=$case[1]; $rejected=false;
    try { ce_updated('icons',$sale,$bad); } catch(Exception $ex) { $rejected=true; }
    check_discount($rejected,'reject invalid '.$case[0].' '.$case[1]);
}
foreach(array('', '0', 'null') as $off) {
    $input=discount_form($sale); $input['discount']=$off;
    $disabled=ce_updated('icons',$sale,$input);
    check_discount($disabled['discount']===null && strpos(ce_price_html($disabled,'price'),'icon-price__new')===false,'disabled sale hides new amount: '.$off);
}
$input=discount_form($sale); $input['discount']=''; $input['newPrice']='';
check_discount(ce_save($root,'icons',$sale['slug'],ce_revision($sale),$input),'editor clears both fields');
$cleared=ce_bundle($root); check_discount($cleared['icons'][0]['discount']===null && $cleared['icons'][0]['newPrice']===null,'cleared fields persist as null');
check_discount(ce_price_number('100 000,50 ₽')===100000.5,'nonbreaking thousands separator and decimal amount');
check_discount(ce_price_number('100 000,50 ₽')===100000.5,'narrow nonbreaking thousands separator');
file_put_contents($root.'/content/icons.json',$original);
check_discount(file_get_contents($root.'/content/icons.json')===$original,'private fixture restored');
