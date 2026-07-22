# pulse (Go)

SDK oficial **Go** para a [API pública](../../docs/API.md) (`/api/v1`).

## Uso

```go
package main

import (
	"context"
	"fmt"
	"os"

	pulse "github.com/VandinDev221/analytic_pulse/sdks/go"
)

func main() {
	c := pulse.New(os.Getenv("PULSE_API_URL"), os.Getenv("PULSE_API_KEY"))
	monitors, err := c.ListMonitors(context.Background())
	if err != nil {
		panic(err)
	}
	fmt.Println(len(monitors), "monitors")
}
```

```bash
cd sdks/go
go test ./...
```
