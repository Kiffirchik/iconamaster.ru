<?php
// Integration client for the private loopback test server, no production writes.
$cookie = '';
function request($path, $data = null) {
    global $cookie;
    $options = array('method'=>$data === null ? 'GET' : 'POST','ignore_errors'=>true,'follow_location'=>0,
        'header'=>"Cookie: ".$cookie."\r\n".($data === null ? '' : "Content-Type: application/x-www-form-urlencoded\r\n"));
    if ($data !== null) $options['content']=http_build_query($data);
    $body=file_get_contents('http://127.0.0.1:18969'.$path,false,stream_context_create(array('http'=>$options)));
    $headers=$http_response_header;
    foreach($headers as $header) if (preg_match('/^Set-Cookie: (PHPSESSID=[^;]+)/i',$header,$m)) $cookie=$m[1];
    return array((int)substr($headers[0],9,3),$body,implode("\n",$headers));
}
function verify($ok,$name) { if(!$ok) throw new RuntimeException($name); echo 'PASS '.$name."\n"; }
function token($html,$name) { preg_match('/name="'.$name.'" value="([a-f0-9]+)"/',$html,$m); return $m[1]; }
$path='/corona/admin/content.php?kind=icons&slug=theotokos-kazanskaya';
$r=request($path); verify($r[0]===302 && strpos($r[2],'/corona/admin/login.php')!==false,'anonymous access blocked');
request('/test-session'); $r=request($path); verify($r[0]===200,'authenticated editor opens');
$json=request('/content/icons.json'); $rows=json_decode($json[1],true);
foreach($rows as $row) if($row['slug']==='theotokos-kazanskaya') break;
$fields=array();
foreach(array('title','price','discount','newPrice','availability','description','size','period','purpose','technique','condition','expertise') as $key) $fields[$key]=isset($row[$key]) ? (string)$row[$key] : '';
$data=array('csrf'=>token($r[1],'csrf'),'revision'=>token($r[1],'revision'),'fields'=>$fields);
$bad=$data; $bad['csrf']='invalid'; $r=request($path,$bad);
$json=request('/content/icons.json');
verify($r[0]===403 && json_decode($json[1],true)===$rows,'CSRF rejected without changing data');
$data['fields']['price']='100 000 руб.'; $data['fields']['discount']='10'; $data['fields']['newPrice']='90 000'; $r=request($path,$data);
verify($r[0]===303,'authenticated save redirects');
$r=request('/content-page.php?route=/icons/theotokos-kazanskaya');
verify($r[0]===200 && strpos($r[1],'90 000 руб.')!==false && strpos($r[1],'icon-price__old')!==false && strpos($r[2],'no-store')!==false,'saved discount immediately visible in public HTTP response');
$r=request($path); $data['revision']=token($r[1],'revision'); $data['fields']=$fields;
$r=request($path,$data); $json=request('/content/icons.json');
verify($r[0]===303 && json_decode($json[1],true)===$rows,'private test data restored');
