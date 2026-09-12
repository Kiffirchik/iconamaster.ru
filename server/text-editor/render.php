<?php
require_once dirname(__FILE__).'/store.php';
function ce_first($values) { foreach ($values as $value) if ($value !== '') return $value; return ''; }
function ce_html($text) { return htmlspecialchars((string)$text, ENT_QUOTES, 'UTF-8'); }
function ce_text($row, $key) { return isset($row[$key]) && is_string($row[$key]) ? trim($row[$key]) : ''; }
function ce_display($row, $key) {
    $value = ce_text($row, $key);
    $normalized = preg_replace('/[.!…]+$/u', '', preg_replace('/\s+/u', ' ', mb_strtolower($value, 'UTF-8')));
    return preg_match('/^[-–—]+$/u', $normalized) || in_array($normalized, array('', 'уточняется при консультации', 'не указано', 'нет данных'), true) ? '' : $value;
}
function ce_p($text, $class = '') { return $text === '' ? '' : '<p'.($class !== '' ? ' class="'.$class.'"' : '').'>'.ce_html($text).'</p>'; }
function ce_price_html($row, $class, $availability = '') {
    $price = ce_text($row, 'price') !== '' ? ce_text($row, 'price') : 'Цена по запросу';
    $discount = ce_discount($row);
    $body = ce_html($price);
    if ($discount !== null) $body = '<del class="icon-price__old" aria-label="Прежняя цена">'.$body.'</del><span class="icon-price__discount" aria-label="Скидка '.ce_html($discount['percent']).'%">%</span><strong class="icon-price__new" aria-label="Новая цена">'.ce_html(ce_format_price($discount['newPrice'])).'</strong>';
    return '<p class="'.$class.'">'.$body.($availability !== '' ? ' · '.ce_html($availability) : '').'</p>';
}
function ce_passport($row, $detail) {
    $body = '';
    foreach (array('period'=>'Период','purpose'=>'Назначение','size'=>'Размер','technique'=>'Техника','condition'=>'Состояние','expertise'=>'Экспертное заключение') as $key=>$label) {
        $value = ce_display($row, $key);
        if ($value !== '') $body .= '<div><dt>'.$label.'</dt><dd>'.ce_html($value).'</dd></div>';
    }
    if ($body === '') return '';
    $body = '<dl class="object-passport">'.$body.'</dl>';
    return $detail ? '<section aria-labelledby="passport-title"><h2 id="passport-title">Паспорт предмета</h2>'.$body.'</section>' : $body;
}
function ce_image($image) {
    return '<img src="'.ce_html($image['src']).'" alt="'.ce_html(isset($image['alt']) ? $image['alt'] : '').'" width="'.(int)$image['width'].'" height="'.(int)$image['height'].'" loading="lazy" decoding="async"/>';
}
function ce_sections($sections) {
    $html = '';
    foreach ($sections as $section) {
        if ($section['type'] === 'text') {
            $body = ce_text($section, 'heading') !== '' ? '<h2>'.ce_html(trim($section['heading'])).'</h2>' : '';
            foreach (isset($section['paragraphs']) ? $section['paragraphs'] : array() as $p) if (is_string($p)) $body .= ce_p(trim($p));
            if ($body !== '') $html .= '<section class="content-section content-section--text">'.$body.'</section>';
        } else {
            $single = $section['type'] === 'image';
            $images = $single ? array($section['image']) : $section['images'];
            $body = '';
            foreach ($images as $image) if (!empty($image['src'])) {
                $body .= '<figure class="content-gallery__item">'.ce_image($image).(!empty($image['caption']) ? '<figcaption>'.ce_html($image['caption']).'</figcaption>' : '').'</figure>';
            }
            if ($body !== '') $html .= '<div class="content-gallery'.($single ? ' content-gallery--single' : '').'">'.$body.'</div>';
        }
    }
    return $html;
}
function ce_more_details($row) {
    $text = isset($row['moreDetails']) && is_string($row['moreDetails']) ? str_replace(array("\r\n", "\r"), "\n", $row['moreDetails']) : '';
    // Match JavaScript String.trim(), including invisible whitespace copied from documents.
    $space = '[\x{0009}-\x{000d}\x{0020}\x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]';
    $text = preg_replace('/^'.$space.'+|'.$space.'+$/u', '', $text);
    return $text === '' ? '' : '<details class="icon-more-details"><summary>Подробнее об иконе</summary><div class="icon-more-details__text">'.ce_html($text).'</div></details>';
}
function ce_slot($type, $row) {
    $title = ce_html($row['title']);
    if ($type === 'passport' || $type === 'passport-detail') return ce_passport($row, $type === 'passport-detail');
    if ($type === 'icon-detail') {
        $eyebrow = array_filter(array(ce_display($row, 'purpose'), ce_display($row, 'period')), 'strlen');
        return ce_p(implode(' · ', $eyebrow), 'eyebrow').'<h1>'.$title.'</h1>'.ce_price_html($row, 'icon-detail-page__price').ce_p(ce_display($row, 'availability') !== '' ? ce_display($row, 'availability') : 'Наличие уточняется', 'icon-detail-page__availability');
    }
    if ($type === 'icon-description') return ce_p(ce_display($row, 'description'), 'icon-detail-page__description').ce_more_details($row);
    if ($type === 'icon-card') {
        $url = '/icons/'.rawurlencode($row['slug']);
        $price = ce_text($row, 'price') !== '' ? ce_text($row, 'price') : 'Цена по запросу';
        $availability = ce_text($row, 'availability');
        return ce_p(ce_display($row, 'period'), 'icon-card__period').'<h3><a href="'.$url.'">'.$title.'</a></h3>'.ce_p(ce_display($row, 'technique')).ce_p(ce_display($row, 'size')).ce_price_html($row, 'icon-card__price', $availability);
    }
    $url = '/articles/'.rawurlencode($row['slug']);
    if ($type === 'article-header') {
        $intro = ce_first(array(ce_text($row, 'intro'), ce_text($row, 'summary'), ce_text($row, 'excerpt')));
        return '<p class="eyebrow">Статья мастерской</p><h1>'.$title.'</h1>'.ce_p($intro, 'editorial-page__intro');
    }
    if ($type === 'article-sections') return ce_sections($row['sections']);
    if ($type === 'article-card') return '<h2><a href="'.$url.'">'.$title.'</a></h2>'.ce_p(ce_first(array(ce_text($row, 'summary'), ce_text($row, 'intro'), ce_text($row, 'excerpt'))));
    if ($type === 'article-feature') return '<p class="eyebrow">Материал мастерской</p><h3><a href="'.$url.'">'.$title.'</a></h3><p>'.ce_html(ce_text($row, 'summary')).'</p><a class="home-story-card__more" href="'.$url.'">Читать материал →</a>';
    throw new RuntimeException('Unknown content slot.');
}
function ce_description($record) {
    $text = ce_first(array(ce_text($record, 'intro'), ce_text($record, 'description')));
    if ($text === '' && isset($record['sections'])) foreach ($record['sections'] as $section) {
        if ($section['type'] !== 'text') continue;
        $values = array_merge(array(ce_text($section, 'heading')), isset($section['paragraphs']) ? $section['paragraphs'] : array());
        foreach ($values as $value) if (trim($value) !== '') { $text = $value; break 2; }
    }
    if ($text === '') $text = $record['title'];
    $text = trim(preg_replace('/\s+/u', ' ', strip_tags($text)));
    if (mb_strlen($text, 'UTF-8') <= 160) return $text;
    $short = mb_substr($text, 0, 159, 'UTF-8');
    $last = mb_strrpos($short, ' ', 0, 'UTF-8');
    return ($last ? mb_substr($short, 0, $last, 'UTF-8') : $short).'…';
}
function ce_seo($html, $route, $record) {
    $renderer = new CeSeo($route, $record);
    $html = preg_replace_callback('~<title\b[^>]*>.*?</title>~s', array($renderer, 'title'), $html);
    $html = preg_replace_callback('~<meta\b[^>]+>~', array($renderer, 'meta'), $html);
    return preg_replace_callback('~(<script type="application/ld\+json"[^>]*>)(.*?)(</script>)~s', array($renderer, 'structured'), $html);
}
class CeSeo {
    var $record, $route, $titleText, $description, $value;
    function __construct($route, $record) {
        $this->record = $record; $this->route = $route;
        $this->titleText = $record['title'].' | Московская иконописная мастерская';
        $this->description = ce_description($record);
    }
    function title($m) { return '<title data-seo-managed="true">'.ce_html($this->titleText).'</title>'; }
    function content($m) { return 'content="'.ce_html($this->value).'"'; }
    function meta($m) {
        if (!preg_match('~(?:name|property)="(description|og:description|twitter:description|og:title|twitter:title)"~', $m[0], $key)) return $m[0];
        $this->value = strpos($key[1], 'title') !== false ? $this->titleText : $this->description;
        return preg_replace_callback('~content="[^"]*"~', array($this, 'content'), $m[0]);
    }
    function structured($m) {
        $record = $this->record; $description = $this->description; $title = $this->titleText; $route = $this->route;
        $data = json_decode($m[2], true);
        if (!$data || !isset($data['@graph'])) throw new RuntimeException('Invalid structured metadata.');
        $graph = array(); $image = null;
        foreach ($data['@graph'] as $node) {
            if ($node['@type'] === 'Product') continue;
            if ($node['@type'] === 'VisualArtwork') { $node['name']=$record['title']; $node['description']=$description; $image=isset($node['image']) ? $node['image'] : null; }
            if ($node['@type'] === 'Article') { $node['headline']=$record['title']; $node['description']=$description; }
            if ($node['@type'] === 'BreadcrumbList') $node['itemListElement'][1]['name']=$title;
            $graph[]=$node;
        }
        $priceText = preg_replace('/\s+/u', '', ce_text($record, 'price'));
        $discount = ce_discount($record);
        if ($discount !== null) $priceText = $discount['newPrice'].'руб.';
        if (strpos($route, '/icons/') === 0 && ce_text($record, 'availability') === 'В наличии' && preg_match('/^(\d+(?:[.,]\d{1,2})?)(?:руб\.?|₽)$/ui', $priceText, $price) && (float)str_replace(',', '.', $price[1]) > 0) {
            $node = array('@type'=>'Product','name'=>$record['title'],'description'=>$description,'offers'=>array('@type'=>'Offer','price'=>(float)str_replace(',', '.', $price[1]),'priceCurrency'=>'RUB','availability'=>'https://schema.org/InStock','url'=>'https://iconamaster.ru'.$route));
            if ($image) $node['image']=$image;
            $graph[]=$node;
        }
        $data['@graph']=$graph;
        return $m[1].ce_safe_json($data).$m[3];
    }
}
function ce_safe_json($data) {
    $json = json_encode($data);
    if ($json === false) throw new RuntimeException('Invalid content encoding.');
    return str_replace(array('<','>','&'), array('\\u003c','\\u003e','\\u0026'), $json);
}
function ce_bundle($root) {
    $manifest = ce_read($root.'/content/manifest.json');
    $bundle = array('version'=>$manifest['version']);
    foreach (array('icons','articles','pages','videos','contacts','aliases') as $key) $bundle[$key] = ce_read($root.'/content/'.$key.'.json');
    return $bundle;
}
function ce_render($template, $route, $bundle) {
    $renderer = new CeSlots($bundle);
    $html = preg_replace_callback('/<!--LIVE:([a-z-]+):([a-z0-9-]+)-->/D', array($renderer, 'slot'), $template);
    if (preg_match('~^/(icons|articles)/([a-z0-9-]+)$~D', $route, $m)) $html = ce_seo($html, $route, $renderer->index[$m[1]][$m[2]]);
    $html = str_replace('id="root"', 'id="root" data-live-rendered="true"', $html);
    // A single response supplies both visible HTML and the exact React snapshot.
    return str_replace('</head>', '<script id="live-content" type="application/json">'.ce_safe_json($bundle).'</script></head>', $html);
}
class CeSlots {
    var $index = array();
    function __construct($bundle) {
        foreach (array('icons','articles') as $kind) foreach ($bundle[$kind] as $row) $this->index[$kind][$row['slug']]=$row;
    }
    function slot($m) {
        $kind = strpos($m[1], 'article-') === 0 ? 'articles' : 'icons';
        if (!isset($this->index[$kind][$m[2]])) throw new RuntimeException('Missing record.');
        return ce_slot($m[1], $this->index[$kind][$m[2]]);
    }
}
