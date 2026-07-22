package pulse_test

import (
	"testing"

	pulse "github.com/VandinDev221/analytic_pulse/sdks/go"
)

func TestNew(t *testing.T) {
	c := pulse.New("https://example.com", "ap_pk_test")
	if c.BaseURL != "https://example.com" {
		t.Fatalf("base url: %s", c.BaseURL)
	}
	if c.APIKey != "ap_pk_test" {
		t.Fatalf("api key")
	}
}
