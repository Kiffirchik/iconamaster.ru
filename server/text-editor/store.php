<?php
require_once dirname(__FILE__).'/pricing.php';
// Compatible with the legacy Corona PHP runtime; no database or credentials required.
function ce_random($bytes) {
    if (function_exists('random_bytes')) return random_bytes($bytes);
    if (function_exists('openssl_random_pseudo_bytes')) {
        $strong = false;
        $value = openssl_random_pseudo_bytes($bytes, $strong);
        if ($strong && strlen($value) === $bytes) return $value;
    }
    if (function_exists('mcrypt_create_iv') && defined('MCRYPT_DEV_URANDOM')) {
        $value = mcrypt_create_iv($bytes, MCRYPT_DEV_URANDOM);
        if (is_string($value) && strlen($value) === $bytes) return $value;
    }
    throw new RuntimeException('Secure random source unavailable.');
}
function ce_equal($left, $right) {
    if (!is_string($left) || !is_string($right) || strlen($left) !== strlen($right)) return false;
    $difference = 0;
    for ($i = 0; $i < strlen($left); $i++) $difference |= ord($left[$i]) ^ ord($right[$i]);
    return $difference === 0;
}
function ce_status($code) {
    $names = array(400=>'Bad Request',403=>'Forbidden',404=>'Not Found',503=>'Service Unavailable');
    header('HTTP/1.1 '.$code.' '.$names[$code]);
}
function ce_read($file) {
    $raw = file_get_contents($file);
    $data = json_decode($raw, true);
    if ($raw === false || !is_array($data)) {
        throw new RuntimeException('Не удалось прочитать данные сайта.');
    }
    return $data;
}
function ce_collection($kind) {
    if (!in_array($kind, array('icons', 'articles'), true)) throw new InvalidArgumentException('Неизвестный раздел.');
    return $kind;
}
function ce_find($rows, $slug) {
    foreach ($rows as $index => $row) if ($row['slug'] === $slug) return $index;
    throw new InvalidArgumentException('Запись не найдена.');
}
function ce_revision($record) { return hash('sha256', json_encode($record)); }
function ce_fields($kind, $record) {
    $fields = array('title' => array('Название', 'text', $record['title']));
    if ($kind === 'icons') {
        $labels = array('price'=>'Цена', 'discount'=>'Скидка (%)', 'newPrice'=>'Новая цена (руб.)', 'availability'=>'Наличие', 'description'=>'Описание', 'size'=>'Размер', 'period'=>'Период', 'purpose'=>'Назначение', 'technique'=>'Техника', 'condition'=>'Состояние', 'expertise'=>'Экспертное заключение');
        foreach ($labels as $key => $label) $fields[$key] = array($label, in_array($key, array('description','expertise'), true) ? 'textarea' : 'text', isset($record[$key]) ? (string)$record[$key] : '');
    } else {
        $fields['summary'] = array('Краткое описание', 'textarea', isset($record['summary']) ? $record['summary'] : '');
        foreach (array('intro'=>'Вступление', 'excerpt'=>'Анонс') as $key=>$label) {
            if (isset($record[$key])) $fields[$key] = array($label, 'textarea', $record[$key]);
        }
        foreach ($record['sections'] as $i => $section) {
            if ($section['type'] !== 'text') continue;
            $fields['heading_'.$i] = array('Блок '.($i+1).' — подзаголовок', 'text', isset($section['heading']) ? $section['heading'] : '');
            $fields['paragraphs_'.$i] = array('Блок '.($i+1).' — текст', 'paragraphs', implode("\n\n", isset($section['paragraphs']) ? $section['paragraphs'] : array()));
        }
    }
    return $fields;
}
function ce_updated($kind, $record, $input) {
    if (!is_array($input)) throw new InvalidArgumentException('Некорректная форма.');
    $fields = ce_fields($kind, $record);
    if (array_diff(array_keys($input), array_keys($fields))) throw new InvalidArgumentException('Форма содержит недоступные поля.');
    foreach ($fields as $key=>$field) {
        if (!array_key_exists($key, $input) || !is_string($input[$key])) throw new InvalidArgumentException('Форма неполная. Обновите страницу.');
        $value = str_replace(array("\r\n", "\r"), "\n", $input[$key]);
        if (!preg_match('//u', $value) || strpos($value, "\0") !== false || strlen($value) > 200000) throw new InvalidArgumentException('Недопустимый текст или превышен размер поля.');
        if ($key === 'title' && (trim($value) === '' || strlen($value) > 1000)) throw new InvalidArgumentException('Укажите название (до 1000 байт).');
        if ($kind === 'icons' && ($key === 'discount' || $key === 'newPrice')) {
            $clean = trim($value);
            if ($clean === '' || strtolower($clean) === 'null' || preg_match('/^0+(?:[.,]0+)?$/D', $clean)) $number = null;
            else {
                $number = ce_price_number($clean);
                if ($number === null || ($key === 'discount' && $number >= 100)) throw new InvalidArgumentException($key === 'discount' ? 'Скидка: число больше 0 и меньше 100, либо пустое поле.' : 'Новая цена: положительная сумма в рублях, либо пустое поле.');
            }
            if ($number !== null && isset($record[$key]) && (is_int($record[$key]) || is_float($record[$key])) && $number == $record[$key]) continue;
            if (array_key_exists($key, $record) || $number !== null) $record[$key] = $number;
            continue;
        }
        if ($value === $field[2]) continue; // A no-op preserves exact source text and optional keys.
        if (preg_match('/^(heading|paragraphs)_(\d+)$/D', $key, $m)) {
            if ($m[1] === 'heading') $record['sections'][(int)$m[2]]['heading'] = trim($value);
            else $record['sections'][(int)$m[2]]['paragraphs'] = trim($value) === '' ? array() : preg_split('/\n[ \t]*\n+/u', trim($value));
        } else $record[$key] = trim($value);
    }
    if ($kind === 'icons' && !empty($record['discount']) && ce_discount($record) === null) {
        throw new InvalidArgumentException('Для скидки укажите прежнюю цену числом и новую цену больше нуля и меньше прежней.');
    }
    return $record;
}
function ce_save($root, $kind, $slug, $revision, $input) {
    ce_collection($kind);
    $state = $root.'/.editor-state';
    if (!is_dir($state)) throw new RuntimeException('Хранилище редактора не настроено.');
    $lock = fopen($state.'/write.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Не удалось заблокировать сохранение.');
    $temp = null;
    try {
        $result = ce_save_locked($root, $kind, $slug, $revision, $input, $temp);
    } catch (Exception $ex) {
        if ($temp && is_file($temp)) unlink($temp);
        flock($lock, LOCK_UN);
        fclose($lock);
        throw $ex;
    }
    flock($lock, LOCK_UN);
    fclose($lock);
    return $result;
}
function ce_save_locked($root, $kind, $slug, $revision, $input, &$temp) {
        $state = $root.'/.editor-state';
        $file = $root.'/content/'.$kind.'.json';
        $rows = ce_read($file);
        $i = ce_find($rows, $slug);
        if (!ce_equal(ce_revision($rows[$i]), $revision)) throw new RuntimeException('Запись уже изменена в другой вкладке. Скопируйте свой текст и откройте запись заново.');
        $new = ce_updated($kind, $rows[$i], $input);
        if ($new === $rows[$i]) return false;
        $rows[$i] = $new;
        $json = json_encode($rows);
        if ($json === false) throw new RuntimeException('Ошибка кодировки.');
        $backup = $state.'/'.$kind.'-'.gmdate('Ymd-His').'-'.bin2hex(ce_random(8)).'.json';
        if (!copy($file, $backup)) throw new RuntimeException('Не удалось создать резервную копию.');
        chmod($backup, 0600);
        $temp = tempnam($root.'/content', '.text-');
        if (!$temp || file_put_contents($temp, $json."\n") !== strlen($json)+1) throw new RuntimeException('Не удалось записать изменения.');
        chmod($temp, 0644);
        if (!rename($temp, $file)) throw new RuntimeException('Не удалось опубликовать изменения.');
        $temp = null;
        return true;
}
