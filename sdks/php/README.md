# Analytic Pulse SDK — PHP (scaffold)

Cliente oficial em construção. Enquanto isso, use a [API pública](../../docs/API.md) com cURL / Guzzle.

```php
<?php
$apiKey = getenv('PULSE_API_KEY');
$base = rtrim(getenv('PULSE_API_URL'), '/');

$ch = curl_init("$base/api/v1/monitors");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer $apiKey",
    "Accept: application/json",
  ],
]);
echo curl_exec($ch);
```

Ver também: [`docs/SDKS.md`](../../docs/SDKS.md) · OpenAPI `/api/openapi.json`.
