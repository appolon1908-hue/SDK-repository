<?php
/**
 * Real behavioral smoke test for the generated PHP SDK.
 *
 * scripts/verify-generated-sdks.mjs only checks that the generator produced
 * the expected files; it never even lints the PHP, let alone runs it. That
 * gap let a broken invokerPackage config (see codegen/php.yaml) ship
 * completely unnoticed: every generated file used a namespace declaration
 * with a literal double backslash, which is not valid PHP syntax, so the
 * PHP SDK has never once been requireable. This script installs the
 * generated package's own autoloader, starts a local HTTP server that
 * returns a real, contract-shaped response, and drives the generated
 * client against it end to end.
 *
 * Usage: php scripts/smoke_test_php_sdk.php <path-to-generated/php>
 */

declare(strict_types=1);

function fail(string $message): never
{
    fwrite(STDERR, "FAIL: {$message}\n");
    exit(1);
}

$sdkPath = $argv[1] ?? null;
if ($sdkPath === null || !is_dir($sdkPath)) {
    fail('usage: smoke_test_php_sdk.php <path-to-generated/php>');
}

$autoload = rtrim($sdkPath, '/') . '/vendor/autoload.php';
if (!is_file($autoload)) {
    fail("{$autoload} not found -- run composer install in {$sdkPath} first");
}
require $autoload;

$postId = '6f0a2b3c-1111-4222-8333-000000000001';
$tenantId = '042880db-aa51-4f16-83b5-ae858ee45ad6';
$cannedResponse = [
    'id' => $postId,
    'tenantId' => $tenantId,
    'workspaceId' => '042880db-aa51-4f16-83b5-ae858ee45ad7',
    'status' => 'published',
    'channels' => [['channel' => 'instagram', 'status' => 'accepted']],
    'content' => ['text' => 'Smoke-tested by scripts/smoke_test_php_sdk.php'],
    'createdAt' => '2026-01-01T00:00:00Z',
    'updatedAt' => '2026-01-01T00:00:00Z',
];

// A tiny synchronous mock server run as a PHP built-in server subprocess,
// backed by a router script that serves the canned response only for the
// exact expected path and records the tenant header it received.
$routerDir = sys_get_temp_dir() . '/codestra-php-smoke-' . getmypid();
mkdir($routerDir);
$responseFile = $routerDir . '/response.json';
$seenFile = $routerDir . '/seen.json';
file_put_contents($responseFile, json_encode($cannedResponse));

$router = <<<'PHP'
<?php
$expected = getenv('CODESTRA_SMOKE_EXPECTED_PATH');
$responseFile = getenv('CODESTRA_SMOKE_RESPONSE_FILE');
$seenFile = getenv('CODESTRA_SMOKE_SEEN_FILE');
$seen = [
    'path' => $_SERVER['REQUEST_URI'] ?? '',
    'tenantHeader' => $_SERVER['HTTP_X_CODESTRA_TENANT_ID'] ?? null,
];
file_put_contents($seenFile, json_encode($seen));
header('Content-Type: application/json');
if (($_SERVER['REQUEST_URI'] ?? '') === $expected) {
    echo file_get_contents($responseFile);
} else {
    http_response_code(404);
    echo '{}';
}
PHP;
$routerPath = $routerDir . '/router.php';
file_put_contents($routerPath, $router);

$port = random_int(20000, 40000);
$expectedPath = "/v1/social/posts/{$postId}";
$env = array_merge($_ENV, [
    'CODESTRA_SMOKE_EXPECTED_PATH' => $expectedPath,
    'CODESTRA_SMOKE_RESPONSE_FILE' => $responseFile,
    'CODESTRA_SMOKE_SEEN_FILE' => $seenFile,
]);
$descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$process = proc_open(
    ['php', '-S', "127.0.0.1:{$port}", $routerPath],
    $descriptors,
    $pipes,
    null,
    $env,
);
if ($process === false) {
    fail('could not start the PHP built-in server for the mock backend');
}
usleep(400_000); // give the built-in server a moment to bind before the first request

try {
    $configuration = Codestra\Sdk\Configuration::getDefaultConfiguration()
        ->setHost("http://127.0.0.1:{$port}")
        ->setAccessToken('smoke-test-token');
    $client = new GuzzleHttp\Client();
    $api = new Codestra\Sdk\Api\DefaultApi($client, $configuration);

    $result = $api->getSocialPost($tenantId, $postId);

    $seen = is_file($seenFile) ? json_decode(file_get_contents($seenFile), true) : null;
    if ($seen === null) {
        fail('the generated client never made an HTTP request');
    }
    if ($seen['tenantHeader'] !== $tenantId) {
        fail("expected X-Codestra-Tenant-Id header '{$tenantId}', server saw " . var_export($seen['tenantHeader'], true));
    }
    if ($result->getId() !== $postId) {
        fail("expected id '{$postId}', got '{$result->getId()}'");
    }
    if ($result->getStatus() !== 'published') {
        fail("expected status 'published', got '{$result->getStatus()}'");
    }
    if ($result->getContent()->getText() !== $cannedResponse['content']['text']) {
        fail('nested content.text did not round-trip through deserialization');
    }
    $channels = $result->getChannels();
    if (count($channels) !== 1 || $channels[0]->getChannel() !== 'instagram') {
        fail('channels array did not deserialize correctly');
    }

    echo "PASS: generated PHP SDK autoloaded, called a live HTTP server, and correctly deserialized the response into typed models.\n";
} finally {
    proc_terminate($process);
    proc_close($process);
    @unlink($routerPath);
    @unlink($responseFile);
    @unlink($seenFile);
    @rmdir($routerDir);
}
