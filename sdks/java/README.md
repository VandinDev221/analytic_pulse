# Analytic Pulse SDK — Java (scaffold)

Cliente oficial em construção. Exemplo com `HttpClient` (Java 11+):

```java
import java.net.URI;
import java.net.http.*;

var client = HttpClient.newHttpClient();
var req = HttpRequest.newBuilder()
  .uri(URI.create(System.getenv("PULSE_API_URL") + "/api/v1/monitors"))
  .header("Authorization", "Bearer " + System.getenv("PULSE_API_KEY"))
  .GET()
  .build();
System.out.println(client.send(req, HttpResponse.BodyHandlers.ofString()).body());
```

Ver: [`docs/API.md`](../../docs/API.md) · [`docs/SDKS.md`](../../docs/SDKS.md).
