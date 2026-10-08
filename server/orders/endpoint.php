<?php
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');
require dirname(__FILE__).'/corona/admin/orders/store.php';
function oq_response($status,$body) {
    $names=array(200=>'OK',400=>'Bad Request',403=>'Forbidden',405=>'Method Not Allowed',413=>'Payload Too Large',503=>'Service Unavailable');
    header('HTTP/1.1 '.$status.' '.$names[$status]); echo json_encode($body); exit;
}
$method=isset($_SERVER['REQUEST_METHOD'])?$_SERVER['REQUEST_METHOD']:'GET';
if ($method!=='GET' && $method!=='POST') { header('Allow: GET, POST'); oq_response(405,array('ok'=>false,'message'=>'Метод не поддерживается.')); }
if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN']!=='https://iconamaster.ru') oq_response(403,array('ok'=>false,'message'=>'Откройте форму на iconamaster.ru.'));
if (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && $_SERVER['HTTP_SEC_FETCH_SITE']==='cross-site') oq_response(403,array('ok'=>false,'message'=>'Откройте форму на iconamaster.ru.'));
session_name('iconamaster_order_session'); session_set_cookie_params(0,'/','',true,true); session_start();
try {
    if (empty($_SESSION['order_csrf'])) $_SESSION['order_csrf']=bin2hex(oq_random(32));
    if ($method==='GET') {
        $id=bin2hex(oq_random(16));
        if (!isset($_SESSION['order_forms'])) $_SESSION['order_forms']=array();
        foreach ($_SESSION['order_forms'] as $oldId=>$created) if ($created<time()-7200) unset($_SESSION['order_forms'][$oldId]);
        if (count($_SESSION['order_forms'])>=10) array_shift($_SESSION['order_forms']);
        $_SESSION['order_forms'][$id]=time();
        oq_response(200,array('csrf'=>$_SESSION['order_csrf'],'requestId'=>$id));
    }
    if (isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH']>16384) oq_response(413,array('ok'=>false,'message'=>'Слишком большой текст заявки.'));
    if (!isset($_SERVER['CONTENT_TYPE']) || strpos(strtolower($_SERVER['CONTENT_TYPE']),'application/json')!==0) oq_response(400,array('ok'=>false,'message'=>'Обновите форму и попробуйте снова.'));
    $raw=file_get_contents('php://input',false,null,0,16385);
    if ($raw===false || strlen($raw)>16384) oq_response(413,array('ok'=>false,'message'=>'Слишком большой текст заявки.'));
    $input=json_decode($raw,true);
    if (!is_array($input) || !isset($input['csrf']) || !oq_equal($_SESSION['order_csrf'],$input['csrf'])
        || !isset($input['requestId']) || !is_string($input['requestId']) || !isset($_SESSION['order_forms'][$input['requestId']])
        || $_SESSION['order_forms'][$input['requestId']]<time()-7200) oq_response(403,array('ok'=>false,'message'=>'Время работы формы истекло. Закройте и откройте её снова.'));
    unset($input['csrf']); session_write_close();
    $root=dirname(__FILE__);
    // Outside the document root: no web route can serve visitor contact details.
    $result=oq_accept($root,dirname($root).'/.iconamaster-order-requests',$input,isset($_SERVER['REMOTE_ADDR'])?$_SERVER['REMOTE_ADDR']:'');
    oq_response($result['ok']?200:503,$result);
} catch (InvalidArgumentException $ex) { oq_response(400,array('ok'=>false,'message'=>$ex->getMessage())); }
catch (Exception $ex) { oq_response(503,array('ok'=>false,'message'=>'Не удалось завершить отправку. Попробуйте ещё раз или свяжитесь с мастерской напрямую.')); }
