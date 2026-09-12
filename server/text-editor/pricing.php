<?php
// Shared by the editor validation, public HTML renderer and structured pricing.
function ce_price_number($value) {
    if (is_int($value) || is_float($value)) return is_finite($value) && $value > 0 ? $value : null;
    if (!is_string($value)) return null;
    // Legacy PCRE /u does not give \\s Unicode semantics.
    $value = str_replace(array("\xc2\xa0", "\xe2\x80\xaf"), ' ', $value);
    if (!preg_match('/^((?:\d{1,3}(?:\s\d{3})+|\d+)(?:[.,]\d{1,2})?)\s*(?:руб\.?|₽)?$/uiD', trim($value), $m)) return null;
    $amount = (float)str_replace(',', '.', preg_replace('/\s/u', '', $m[1]));
    return is_finite($amount) && $amount > 0 ? $amount : null;
}
function ce_discount($row) {
    $percent = isset($row['discount']) ? $row['discount'] : null;
    $amount = isset($row['newPrice']) ? $row['newPrice'] : null;
    $original = ce_price_number(isset($row['price']) ? $row['price'] : null);
    if ((!is_int($percent) && !is_float($percent)) || !is_finite($percent) || $percent <= 0 || $percent >= 100
        || (!is_int($amount) && !is_float($amount)) || !is_finite($amount) || $amount <= 0
        || $original === null || $amount >= $original) return null;
    return array('percent'=>$percent, 'price'=>$original, 'newPrice'=>$amount);
}
function ce_format_price($value) {
    return number_format($value, floor($value) == $value ? 0 : 2, ',', ' ').' руб.';
}
