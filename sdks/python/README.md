# analytic-pulse (Python)

SDK oficial **Python 3.10+** para a [API pública](../../docs/API.md) (`/api/v1`). Usa apenas a stdlib (`urllib`).

## Install

```bash
cd sdks/python
pip install -e .
```

## Uso

```python
import os
from analytic_pulse import PulseClient

pulse = PulseClient(
    base_url="https://sua-api.onrender.com",
    api_key=os.environ["PULSE_API_KEY"],  # ap_pk_…
)

monitors = pulse.list_monitors()
created = pulse.create_monitor({
    "name": "Home",
    "url": "https://example.com",
    "check_type": "https",
})
```

Erros HTTP viram `PulseApiError` (`status`, `code`, `body`).
