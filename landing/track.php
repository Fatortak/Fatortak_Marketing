<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo '{"ok":false,"error":"POST only"}';
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw ?: '{}', true);
if (!is_array($payload)) {
    $payload = [];
}

$path = isset($payload['path']) ? substr((string) $payload['path'], 0, 200) : '/';
if ($path === '' || $path[0] !== '/') {
    $path = '/';
}
$referrer = isset($payload['ref']) ? substr((string) $payload['ref'], 0, 500) : '';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
if (preg_match('/bot|crawl|spider|preview|headless|curl|wget|python|monitor/i', $userAgent)) {
    echo '{"ok":true,"skipped":true}';
    exit;
}

$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'App_Data';
if (!is_dir($dataDir) && !mkdir($dataDir, 0775, true) && !is_dir($dataDir)) {
    http_response_code(500);
    echo '{"ok":false,"error":"data directory unavailable"}';
    exit;
}

$lock = fopen($dataDir . DIRECTORY_SEPARATOR . 'traffic.lock', 'c');
if (!$lock) {
    http_response_code(500);
    echo '{"ok":false,"error":"lock unavailable"}';
    exit;
}
flock($lock, LOCK_EX);

$file = $dataDir . DIRECTORY_SEPARATOR . 'traffic.json';
$data = [];
if (is_file($file)) {
    $decoded = json_decode((string) file_get_contents($file), true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
}
if (!isset($data['days']) || !is_array($data['days'])) {
    $data['days'] = [];
}

$today = gmdate('Y-m-d');
$day = isset($data['days'][$today]) && is_array($data['days'][$today]) ? $data['days'][$today] : [];
$day['views'] = (int) ($day['views'] ?? 0) + 1;
$day['paths'] = isset($day['paths']) && is_array($day['paths']) ? $day['paths'] : [];
$day['paths'][$path] = (int) ($day['paths'][$path] ?? 0) + 1;
$day['sources'] = isset($day['sources']) && is_array($day['sources']) ? $day['sources'] : [];
$day['visitors'] = isset($day['visitors']) && is_array($day['visitors']) ? $day['visitors'] : [];

$source = 'direct';
if ($referrer !== '') {
    $host = parse_url($referrer, PHP_URL_HOST);
    if (is_string($host) && $host !== '') {
        $host = strtolower(preg_replace('/^www\./', '', $host));
        if (strpos($host, 'github') !== false) {
            $source = 'github';
        } elseif (strpos($host, 'linkedin') !== false) {
            $source = 'linkedin';
        } elseif (strpos($host, 'x.com') !== false || strpos($host, 'twitter') !== false) {
            $source = 'x';
        } elseif (strpos($host, 'facebook') !== false) {
            $source = 'facebook';
        } elseif (strpos($host, 'instagram') !== false) {
            $source = 'instagram';
        } elseif (strpos($host, 'google') !== false) {
            $source = 'google';
        } else {
            $source = substr($host, 0, 80);
        }
    }
}
$day['sources'][$source] = (int) ($day['sources'][$source] ?? 0) + 1;

$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$visitor = hash('sha256', $ip . '|' . $userAgent . '|' . $today . '|fatortak');
if (!in_array($visitor, $day['visitors'], true)) {
    $day['visitors'][] = $visitor;
    if (count($day['visitors']) > 50000) {
        $day['visitors'] = array_slice($day['visitors'], -50000);
    }
}

$data['days'][$today] = $day;
$data['updatedAt'] = gmdate('c');
file_put_contents($file, json_encode($data, JSON_UNESCAPED_SLASHES), LOCK_EX);
flock($lock, LOCK_UN);
fclose($lock);

echo '{"ok":true}';
