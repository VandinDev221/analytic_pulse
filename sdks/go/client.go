// Package pulse is the official Go client for Analytic Pulse Public API (/api/v1).
package pulse

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client talks to /api/v1 using an ap_pk_… API key.
type Client struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
}

// New creates a Client. baseURL should be the API origin without /api/v1.
func New(baseURL, apiKey string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		APIKey:  strings.TrimSpace(apiKey),
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// APIError is returned for non-2xx responses.
type APIError struct {
	Status  int
	Message string
	Code    string
	Body    json.RawMessage
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("pulse api %d [%s]: %s", e.Status, e.Code, e.Message)
	}
	return fmt.Sprintf("pulse api %d: %s", e.Status, e.Message)
}

// ListMonitors GET /monitors
func (c *Client) ListMonitors(ctx context.Context) ([]map[string]any, error) {
	var out []map[string]any
	if err := c.do(ctx, http.MethodGet, "/monitors", nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetMonitor GET /monitors/:id
func (c *Client) GetMonitor(ctx context.Context, id string) (map[string]any, error) {
	var out map[string]any
	if err := c.do(ctx, http.MethodGet, "/monitors/"+url.PathEscape(id), nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// CreateMonitor POST /monitors
func (c *Client) CreateMonitor(ctx context.Context, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	if err := c.do(ctx, http.MethodPost, "/monitors", payload, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// UpdateMonitor PATCH /monitors/:id
func (c *Client) UpdateMonitor(ctx context.Context, id string, payload map[string]any) (map[string]any, error) {
	var out map[string]any
	if err := c.do(ctx, http.MethodPatch, "/monitors/"+url.PathEscape(id), payload, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// DeleteMonitor DELETE /monitors/:id
func (c *Client) DeleteMonitor(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/monitors/"+url.PathEscape(id), nil, nil)
}

// ListIncidents GET /incidents?status=
func (c *Client) ListIncidents(ctx context.Context, status string) ([]map[string]any, error) {
	if status == "" {
		status = "active"
	}
	var out []map[string]any
	path := "/incidents?status=" + url.QueryEscape(status)
	if err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetDashboardOverview GET /dashboard/overview
func (c *Client) GetDashboardOverview(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	if err := c.do(ctx, http.MethodGet, "/dashboard/overview", nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSslOverview GET /ssl/overview
func (c *Client) GetSslOverview(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	if err := c.do(ctx, http.MethodGet, "/ssl/overview", nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetDockerOverview GET /docker/overview
func (c *Client) GetDockerOverview(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	if err := c.do(ctx, http.MethodGet, "/docker/overview", nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetKubernetesOverview GET /kubernetes/overview
func (c *Client) GetKubernetesOverview(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	if err := c.do(ctx, http.MethodGet, "/kubernetes/overview", nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	u := c.BaseURL + "/api/v1" + path
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, u, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}

	if res.StatusCode == http.StatusNoContent {
		return nil
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		var parsed struct {
			Error string `json:"error"`
			Code  string `json:"code"`
		}
		_ = json.Unmarshal(raw, &parsed)
		msg := parsed.Error
		if msg == "" {
			msg = fmt.Sprintf("HTTP %d", res.StatusCode)
		}
		return &APIError{Status: res.StatusCode, Message: msg, Code: parsed.Code, Body: raw}
	}

	if out == nil || len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, out)
}
