<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$file = __DIR__ . DIRECTORY_SEPARATOR . 'App_Data' . DIRECTORY_SEPARATOR . 'traffic.json';
$data = [];
if (is_file($file)) {
    $decoded = json_decode((string) file_get_contents($file), true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
}

$since = gmdate('Y-m-d', time() - 29 * 86400);
$views = 0;
$visitors = [];
$sources = [];
$paths = [];
foreach (($data['days'] ?? []) as $date => $day) {
    if (!is_string($date) || $date < $since || !is_array($day)) {
        continue;
    }
    $views += (int) ($day['views'] ?? 0);
    foreach (($day['visitors'] ?? []) as $visitor) {
        $visitors[(string) $visitor] = true;
    }
    foreach (($day['sources'] ?? []) as $source => $count) {
        $sources[(string) $source] = (int) ($sources[(string) $source] ?? 0) + (int) $count;
    }
    foreach (($day['paths'] ?? []) as $path => $count) {
        $paths[(string) $path] = (int) ($paths[(string) $path] ?? 0) + (int) $count;
    }
}
arsort($sources);

$sourceRows = [];
foreach (array_slice($sources, 0, 12, true) as $source => $count) {
    $sourceRows[] = ['source' => $source, 'visitors' => $count, 'pageviews' => $count];
}
$pathRows = [];
foreach ($paths as $path => $count) {
    $pathRows[] = ['path' => $path, 'views' => $count];
}

echo json_encode([
    'version' => 1,
    'provider' => 'first-party',
    'period' => '30d',
    'updatedAt' => $data['updatedAt'] ?? null,
    'visitors' => count($visitors),
    'pageviews' => $views,
    'bounceRate' => 0,
    'sources' => $sourceRows,
    'paths' => $pathRows,
], JSON_UNESCAPED_SLASHES);
