<?php
$root=$argv[1];
if (strpos(basename($root),'editor-test-')!==0) die('Private fixture required');
require $root.'/corona/admin/text-editor/render.php';
function details_check($ok,$message) { if(!$ok) throw new RuntimeException($message); echo 'PASS '.$message."\n"; }
function details_fields($row) { $input=array(); foreach(ce_fields('icons',$row) as $key=>$field) $input[$key]=$field[2]; return $input; }
$original=file_get_contents($root.'/content/icons.json'); $bundle=ce_bundle($root); $row=$bundle['icons'][0];
$input=details_fields($row); $input['moreDetails']="Первый абзац\n\nВторой <script>alert(1)</script> & текст";
$fields=ce_fields('icons',$row); details_check(isset($fields['moreDetails']) && $fields['moreDetails'][1]==='textarea','multiline editor field');
details_check(ce_save($root,'icons',$row['slug'],ce_revision($row),$input),'new text saved');
$updated=ce_bundle($root); $new=$updated['icons'][0];
$copy=$new; if(array_key_exists('moreDetails',$row)) $copy['moreDetails']=$row['moreDetails']; else unset($copy['moreDetails']);
details_check($copy===$row,'all other attributes and images preserved');
details_check(ce_save($root,'icons',$new['slug'],ce_revision($new),details_fields($new))===false,'unchanged save is a no-op');
$expected='<details class="icon-more-details"><summary>Подробнее об иконе</summary><div class="icon-more-details__text">Первый абзац' . "\n\n" . 'Второй &lt;script&gt;alert(1)&lt;/script&gt; &amp; текст</div></details>';
details_check(ce_more_details($new)===$expected,'closed escaped disclosure matches React');
$routes=ce_read($root.'/.live-templates/routes.json'); $route='/icons/'.$row['slug'];
$html=ce_render(file_get_contents($root.'/.live-templates/'.$routes[$route]),$route,$updated);
details_check(strpos($html,$expected)!==false,'saved details appear in fresh server HTML');
foreach(array(''," \r\n\t",null,"\xc2\xa0","\xef\xbb\xbf","\xe2\x80\x83") as $value){$empty=$new;$empty['moreDetails']=$value;details_check(ce_more_details($empty)==='','empty details hide button');}
$input=details_fields($new); $input['moreDetails']='';
details_check(ce_save($root,'icons',$new['slug'],ce_revision($new),$input),'clear field saved');
$cleared=ce_bundle($root);details_check(ce_more_details($cleared['icons'][0])==='','cleared field has no disclosure');
file_put_contents($root.'/content/icons.json',$original);
