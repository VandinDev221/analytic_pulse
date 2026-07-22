# Analytic Pulse SDK — Rust (scaffold)

Cliente oficial em construção. Exemplo com `reqwest`:

```rust
use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", std::env::var("PULSE_API_KEY")?))?,
    );
    let base = std::env::var("PULSE_API_URL")?;
    let body = reqwest::Client::new()
        .get(format!("{base}/api/v1/monitors"))
        .headers(headers)
        .send()
        .await?
        .text()
        .await?;
    println!("{body}");
    Ok(())
}
```

Ver: [`docs/API.md`](../../docs/API.md) · [`docs/SDKS.md`](../../docs/SDKS.md).
