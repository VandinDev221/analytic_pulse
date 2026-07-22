# Analytic Pulse SDK — C# (scaffold)

Cliente oficial em construção. Exemplo com `HttpClient`:

```csharp
using var http = new HttpClient();
http.BaseAddress = new Uri(Environment.GetEnvironmentVariable("PULSE_API_URL")!);
http.DefaultRequestHeaders.Authorization =
  new System.Net.Http.Headers.AuthenticationHeaderValue(
    "Bearer", Environment.GetEnvironmentVariable("PULSE_API_KEY"));
var json = await http.GetStringAsync("/api/v1/monitors");
Console.WriteLine(json);
```

Ver: [`docs/API.md`](../../docs/API.md) · [`docs/SDKS.md`](../../docs/SDKS.md).
