<?php
// Run against a private test directory; never invokes the real mail transport.
require dirname(__FILE__).'/../server/orders/store.php';
function oq_check($condition, $label) { if (!$condition) throw new Exception($label); echo 'PASS '.$label."\n"; }
function oq_fake_mail($to, $subject, $body, $headers) {
    $GLOBALS['oq_messages'][] = array($to, $subject, $body, $headers);
    return empty($GLOBALS['oq_mail_fails']);
}
function oq_rejects($root, $state, $input, $label, $ip = '127.0.0.1') {
    try { oq_accept($root, $state, $input, $ip, 'oq_fake_mail'); }
    catch (Exception $ex) { echo 'PASS '.$label."\n"; return; }
    throw new Exception('Expected rejection: '.$label);
}
$testRoot = isset($argv[1]) ? $argv[1] : '';
if (!is_dir($testRoot) || strpos(basename($testRoot), 'order-test-') !== 0) die('Private order-test-* root required');
$root = $testRoot.'/site'; $state = $testRoot.'/private';
mkdir($root, 0700); mkdir($root.'/content', 0700);
file_put_contents($root.'/content/icons.json', json_encode(array(
    array('slug'=>'test-icon', 'title'=>'Тестовая икона', 'price'=>'29 000 ₽', 'availability'=>'В наличии', 'published'=>true),
    array('slug'=>'hidden-icon', 'title'=>'Hidden', 'availability'=>'В наличии', 'published'=>false),
    array('slug'=>'sold-icon', 'title'=>'Sold', 'availability'=>'Продано', 'published'=>true)
)));
file_put_contents($root.'/content/contacts.json', json_encode(array('email'=>'atelier@example.test')));
$input = array('requestId'=>str_repeat('a',32),'slug'=>'test-icon','name'=>'Тестовый посетитель','contact'=>'client@example.test','message'=>'Прошу уточнить доставку.','consent'=>true,'website'=>'');
$GLOBALS['oq_messages'] = array();
$result = oq_accept($root, $state, $input, '127.0.0.1', 'oq_fake_mail');
oq_check($result['ok'] && preg_match('/^IM-[0-9]{8}-[A-F0-9]{8}$/D',$result['reference']), 'request receives a reference after durable save and mail acceptance');
$record = json_decode(file_get_contents($state.'/requests/'.$input['requestId'].'.json'), true);
oq_check($record['icon']['title']==='Тестовая икона' && $record['icon']['price']==='29 000 ₽', 'icon and price are read from current catalogue');
oq_check($record['contact']===$input['contact'] && $record['consentVersion']==='2026-10-08', 'request and consent are stored privately');
oq_check(count($GLOBALS['oq_messages'])===1 && $GLOBALS['oq_messages'][0][0]==='atelier@example.test', 'recipient comes only from workshop configuration');
oq_check(strpos($GLOBALS['oq_messages'][0][3], 'Reply-To: client@example.test')!==false, 'valid visitor email is available for replies');
$again = oq_accept($root, $state, $input, '127.0.0.1', 'oq_fake_mail');
oq_check($again['reference']===$result['reference'] && count($GLOBALS['oq_messages'])===1, 'network retries do not create duplicate requests or emails');
$changed=$input; $changed['contact']='+7 999 123-45-67'; oq_rejects($root,$state,$changed,'idempotency ID cannot replace an existing request');
foreach (array('hidden-icon','sold-icon','unknown') as $slug) { $bad=$input; $bad['requestId']=bin2hex(oq_random(16)); $bad['slug']=$slug; oq_rejects($root,$state,$bad,'reject unavailable icon '.$slug); }
$bad=$input; $bad['consent']=false; oq_rejects($root,$state,$bad,'explicit consent is required');
$bad=$input; $bad['website']='spam'; oq_rejects($root,$state,$bad,'honeypot rejects automated spam');
$bad=$input; $bad['contact']="client@example.test\r\nBcc: bad@example.test"; oq_rejects($root,$state,$bad,'reject email header injection');
$bad=$input; $bad['name']=array('not text'); oq_rejects($root,$state,$bad,'reject non-text fields');
$bad=$input; $bad['message']=str_repeat('x',2001); oq_rejects($root,$state,$bad,'reject oversized comments');
$bad=$input; $bad['requestId']='../outside'; oq_rejects($root,$state,$bad,'reject request ID path traversal');
$bad=$input; $bad['to']='outsider@example.test'; oq_rejects($root,$state,$bad,'reject client-supplied recipients');
$GLOBALS['oq_mail_fails']=true;
$failed=$input; $failed['requestId']=str_repeat('b',32); $failed['contact']='+7 (999) 123-45-67';
$failure=oq_accept($root,$state,$failed,'127.0.0.2','oq_fake_mail');
oq_check(!$failure['ok'] && $failure['saved'] && is_file($state.'/requests/'.$failed['requestId'].'.json'), 'mail failure keeps the request and does not report successful notification');
$GLOBALS['oq_mail_fails']=false;
$recovered=oq_accept($root,$state,$failed,'127.0.0.2','oq_fake_mail');
oq_check($recovered['ok'] && $recovered['reference']===$failure['reference'], 'retry after transport failure retains the request number');
oq_check(oq_valid_contact('+7 999 123-45-67') && !oq_valid_contact('call me maybe'), 'validate a usable callback contact');
for ($i=0; $i<5; $i++) { $fresh=$input; $fresh['requestId']=bin2hex(oq_random(16)); oq_accept($root,$state,$fresh,'198.51.100.1','oq_fake_mail'); }
$fresh['requestId']=bin2hex(oq_random(16)); oq_rejects($root,$state,$fresh,'limit repeated new requests from one address','198.51.100.1');
