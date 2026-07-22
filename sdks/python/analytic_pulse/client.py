from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .errors import PulseApiError


class PulseClient:
    """Cliente síncrono para `/api/v1` (stdlib apenas)."""

    def __init__(self, base_url: str, api_key: str, timeout: float = 30.0):
        if not base_url or not api_key:
            raise ValueError("base_url and api_key are required")
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key.strip()
        self.timeout = timeout

    # ── Monitors ─────────────────────────────────────────────

    def list_monitors(self) -> list[dict[str, Any]]:
        return self._request("GET", "/monitors")

    def get_monitor(self, monitor_id: str) -> dict[str, Any]:
        return self._request("GET", f"/monitors/{monitor_id}")

    def get_monitor_metrics(self, monitor_id: str) -> dict[str, Any]:
        return self._request("GET", f"/monitors/{monitor_id}/metrics")

    def create_monitor(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/monitors", payload)

    def update_monitor(self, monitor_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("PATCH", f"/monitors/{monitor_id}", payload)

    def delete_monitor(self, monitor_id: str) -> None:
        self._request("DELETE", f"/monitors/{monitor_id}")

    # ── Incidents ────────────────────────────────────────────

    def list_incidents(self, status: str = "active") -> list[dict[str, Any]]:
        q = urllib.parse.urlencode({"status": status})
        return self._request("GET", f"/incidents?{q}")

    def get_incident(self, incident_id: str) -> dict[str, Any]:
        return self._request("GET", f"/incidents/{incident_id}")

    # ── Overviews ────────────────────────────────────────────

    def get_dashboard_overview(self) -> dict[str, Any]:
        return self._request("GET", "/dashboard/overview")

    def get_analytics_overview(self, range_: str | None = None) -> dict[str, Any]:
        path = "/analytics/overview"
        if range_:
            path += f"?range={urllib.parse.quote(range_)}"
        return self._request("GET", path)

    def get_ssl_overview(self) -> dict[str, Any]:
        return self._request("GET", "/ssl/overview")

    def get_dns_overview(self) -> dict[str, Any]:
        return self._request("GET", "/dns/overview")

    def get_map_overview(self) -> dict[str, Any]:
        return self._request("GET", "/map/overview")

    def get_docker_overview(self) -> dict[str, Any]:
        return self._request("GET", "/docker/overview")

    def get_kubernetes_overview(self) -> dict[str, Any]:
        return self._request("GET", "/kubernetes/overview")

    # ── Agents ───────────────────────────────────────────────

    def list_agents(self) -> dict[str, Any]:
        return self._request("GET", "/agents")

    def get_agent(self, agent_id: str) -> dict[str, Any]:
        return self._request("GET", f"/agents/{agent_id}")

    # ── HTTP ─────────────────────────────────────────────────

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}/api/v1{path if path.startswith('/') else '/' + path}"
        data = None
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                raw = res.read()
                if res.status == 204 or not raw:
                    return None
                return json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            parsed: Any
            try:
                parsed = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                parsed = raw
            message = (
                parsed.get("error")
                if isinstance(parsed, dict) and parsed.get("error")
                else f"HTTP {exc.code}"
            )
            code = parsed.get("code") if isinstance(parsed, dict) else None
            raise PulseApiError(message, exc.code, code, parsed) from exc
