<?php
// The production host runs PHP 5.2. Keep this module independent of the editor.
function oq_random($length) {
    if (function_exists('random_bytes')) return random_bytes($length);
    if (function_exists('openssl_random_pseudo_bytes')) {
        $strong = false; $bytes = openssl_random_pseudo_bytes($length, $strong);
        if ($strong && strlen($bytes) === $length) return $bytes;
    }
    if (function_exists('mcrypt_create_iv') && defined('MCRYPT_DEV_URANDOM')) {
        $bytes = mcrypt_create_iv($length, MCRYPT_DEV_URANDOM);
        if (is_string($bytes) && strlen($bytes) === $length) return $bytes;
    }
    throw new RuntimeException('Сервис временно недоступен. Свяжитесь с мастерской по телефону или email.');
}
function oq_equal($a, $b) {
    if (!is_string($a) || !is_string($b) || strlen($a) !== strlen($b)) return false;
    $difference = 0;
    for ($i=0; $i<strlen($a); $i++) $difference |= ord($a[$i]) ^ ord($b[$i]);
    return $difference === 0;
}
function oq_read($file) {
    $raw = @file_get_contents($file);
    $value = $raw === false ? null : json_decode($raw, true);
    if (!is_array($value)) throw new RuntimeException('Не удалось прочитать данные. Попробуйте позднее.');
    return $value;
}
function oq_write($file, $value) {
    $json = json_encode($value);
    if ($json === false) throw new RuntimeException('Не удалось сохранить заявку.');
    $temp = tempnam(dirname($file), '.request-');
    if ($temp === false) throw new RuntimeException('Не удалось сохранить заявку.');
    chmod($temp, 0600);
    if (file_put_contents($temp, $json."\n") !== strlen($json)+1 || !rename($temp, $file)) {
        @unlink($temp); throw new RuntimeException('Не удалось сохранить заявку.');
    }
}
function oq_text($value, $max, $multiline) {
    if (!is_string($value) || !preg_match('//u', $value) || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $value)) throw new InvalidArgumentException('Проверьте заполненные поля.');
    $value = trim(str_replace(array("\r\n", "\r"), "\n", $value));
    if ((!$multiline && strpos($value, "\n") !== false) || mb_strlen($value, 'UTF-8') > $max) throw new InvalidArgumentException('Проверьте длину и формат заполненных полей.');
    return $value;
}
function oq_valid_contact($contact) {
    if (strpos($contact, '@') !== false) return filter_var($contact, FILTER_VALIDATE_EMAIL) !== false;
    return preg_match('/^\+?[0-9 ()\-]+$/D', $contact) && preg_match('/^[0-9]{7,15}$/D', preg_replace('/\D/', '', $contact));
}
function oq_validate($input) {
    $fields = array('requestId','slug','name','contact','message','consent','website');
    if (!is_array($input) || array_diff(array_keys($input), $fields) || array_diff($fields, array_keys($input))) throw new InvalidArgumentException('Обновите форму и попробуйте снова.');
    if (!is_string($input['requestId']) || !preg_match('/^[a-f0-9]{32}$/D', $input['requestId'])) throw new InvalidArgumentException('Обновите форму и попробуйте снова.');
    if (!is_string($input['slug']) || !preg_match('/^[a-z0-9-]{1,200}$/D', $input['slug'])) throw new InvalidArgumentException('Икона не найдена.');
    if ($input['consent'] !== true) throw new InvalidArgumentException('Подтвердите согласие на обработку заявки.');
    if ($input['website'] !== '') throw new InvalidArgumentException('Не удалось отправить форму. Свяжитесь с мастерской напрямую.');
    $input['name'] = oq_text($input['name'], 100, false);
    $input['contact'] = oq_text($input['contact'], 200, false);
    $input['message'] = oq_text($input['message'], 2000, true);
    if ($input['name'] === '') throw new InvalidArgumentException('Укажите ваше имя.');
    if (!oq_valid_contact($input['contact'])) throw new InvalidArgumentException('Укажите телефон или email для ответа.');
    return $input;
}
function oq_init($state) {
    foreach (array($state, $state.'/requests', $state.'/limits') as $directory) {
        if (is_link($directory) || (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory))) throw new RuntimeException('Не удалось сохранить заявку.');
        chmod($directory, 0700);
    }
}
function oq_limit($state, $ip, $now) {
    $secretFile = $state.'/rate-secret';
    if (!is_file($secretFile)) {
        if (file_put_contents($secretFile, bin2hex(oq_random(32))) === false) throw new RuntimeException('Сервис временно недоступен.');
        chmod($secretFile,0600);
    }
    $secret = file_get_contents($secretFile);
    $key = hash_hmac('sha256', (string)$ip, $secret);
    $files = array($state.'/limits/'.$key.'.json'=>array(600,5), $state.'/limits/all.json'=>array(3600,100));
    $updates = array();
    foreach ($files as $file=>$policy) {
        $old = is_file($file) ? oq_read($file) : array(); $times = array();
        foreach ($old as $time) if (is_int($time) && $time > $now-$policy[0]) $times[]=$time;
        if (count($times) >= $policy[1]) throw new RuntimeException('Слишком много отправок. Попробуйте позже или свяжитесь с мастерской напрямую.');
        $times[]=$now; $updates[$file]=$times;
    }
    foreach ($updates as $file=>$times) oq_write($file,$times);
}
function oq_mail($to, $subject, $body, $headers) { return @mail($to, $subject, $body, $headers); }
function oq_notification($recipient, $record, $transport) {
    $encoding=mb_internal_encoding(); mb_internal_encoding('UTF-8');
    $subject=mb_encode_mimeheader('Заявка '.$record['reference'].' — '.$record['icon']['title'],'UTF-8','B',"\r\n");
    mb_internal_encoding($encoding);
    $body="Новая заявка на икону\n\nНомер: ".$record['reference']."\nДата (Москва): ".gmdate('d.m.Y H:i',$record['createdAt']+10800)
        ."\nИкона: ".$record['icon']['title']."\nЦена на сайте: ".$record['icon']['price']
        ."\nСтраница: https://iconamaster.ru/icons/".$record['icon']['slug']
        ."\n\nИмя: ".$record['name']."\nКонтакт: ".$record['contact']."\nКомментарий: ".($record['message']!==''?$record['message']:'Не указан')
        ."\n\nПокупатель оставил заявку. Наличие, оплату и доставку нужно подтвердить при ответе."
        ."\nЗаявки также доступны в редакторе: https://iconamaster.ru/corona/admin/orders.php\n";
    $headers="From: Iconamaster <no-reply@iconamaster.ru>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64";
    if (filter_var($record['contact'],FILTER_VALIDATE_EMAIL) !== false) $headers.="\r\nReply-To: ".$record['contact'];
    return call_user_func($transport,$recipient,$subject,chunk_split(base64_encode($body),76,"\r\n"),$headers) === true;
}
function oq_accept($root, $state, $input, $ip, $transport = 'oq_mail') {
    $input=oq_validate($input); oq_init($state);
    $lock=fopen($state.'/requests.lock','a');
    if (!$lock || !flock($lock,LOCK_EX)) throw new RuntimeException('Сервис занят. Попробуйте ещё раз.');
    chmod($state.'/requests.lock',0600);
    try { $result=oq_accept_locked($root,$state,$input,$ip,$transport); }
    catch (Exception $ex) { flock($lock,LOCK_UN); fclose($lock); throw $ex; }
    flock($lock,LOCK_UN); fclose($lock); return $result;
}
function oq_accept_locked($root,$state,$input,$ip,$transport) {
    $file=$state.'/requests/'.$input['requestId'].'.json';
    $fingerprint=hash('sha256',json_encode($input));
    if (is_file($file)) {
        $record=oq_read($file);
        if (!oq_equal($record['fingerprint'],$fingerprint)) throw new InvalidArgumentException('Эта заявка уже сохранена. Закройте форму и откройте её заново для новой заявки.');
        if ($record['notificationAcceptedAt']) return array('ok'=>true,'reference'=>$record['reference']);
    } else {
        $icons=oq_read($root.'/content/icons.json'); $icon=null;
        foreach ($icons as $candidate) if ($candidate['slug']===$input['slug'] && !empty($candidate['published'])) { $icon=$candidate; break; }
        if (!$icon || !isset($icon['availability']) || trim($icon['availability'])!=='В наличии') throw new InvalidArgumentException('Наличие этой иконы нужно уточнить. Свяжитесь с мастерской по телефону или в WhatsApp.');
        oq_limit($state,$ip,time());
        $record=array('reference'=>'IM-'.gmdate('Ymd',time()+10800).'-'.strtoupper(substr($input['requestId'],0,8)),
            'createdAt'=>time(),'fingerprint'=>$fingerprint,'name'=>$input['name'],'contact'=>$input['contact'],'message'=>$input['message'],
            'consentVersion'=>'2026-10-08','consentAcceptedAt'=>time(),'notificationAcceptedAt'=>null,
            'icon'=>array('slug'=>$icon['slug'],'title'=>$icon['title'],'price'=>isset($icon['newPrice']) && !empty($icon['discount']) && $icon['newPrice'] ? $icon['newPrice'].' ₽' : (isset($icon['price'])?$icon['price']:'Цена по запросу')));
        oq_write($file,$record);
    }
    $contacts=oq_read($root.'/content/contacts.json');
    $recipient=isset($contacts['email']) ? $contacts['email'] : '';
    if (!is_string($recipient) || filter_var($recipient,FILTER_VALIDATE_EMAIL)===false) throw new RuntimeException('Заявка сохранена, но письмо пока не отправилось. Свяжитесь с мастерской напрямую.');
    if (!oq_notification($recipient,$record,$transport)) return array('ok'=>false,'saved'=>true,'reference'=>$record['reference'],'message'=>'Заявка сохранена, но письмо пока не отправилось. Попробуйте ещё раз или свяжитесь с мастерской напрямую.');
    $record['notificationAcceptedAt']=time(); oq_write($file,$record);
    return array('ok'=>true,'reference'=>$record['reference']);
}
