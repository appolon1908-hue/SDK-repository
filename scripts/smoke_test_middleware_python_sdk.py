#!/usr/bin/env python3
"""Behavioral smoke test for the generated Middleware control-plane Python SDK."""
from __future__ import annotations

import http.server
import json
import sys
import threading
import uuid
from pathlib import Path


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: smoke_test_middleware_python_sdk.py <generated-sdk-path>")

    sdk_path = Path(sys.argv[1]).resolve()
    if not sdk_path.is_dir():
        fail(f"{sdk_path} is not a directory")
    sys.path.insert(0, str(sdk_path))

    try:
        import codestra_middleware_sdk  # noqa: E402
        from codestra_middleware_sdk.api.default_api import DefaultApi  # noqa: E402
        from codestra_middleware_sdk.configuration import Configuration  # noqa: E402
        from codestra_middleware_sdk.models.command_envelope import CommandEnvelope  # noqa: E402
    except ImportError as error:
        fail(f"could not import generated Middleware SDK: {error}")
        return

    command_id = uuid.UUID("6f0a2b3c-1111-4222-8333-000000000099")
    tenant_id = "tenant-smoke-test"
    correlation_id = "corr-smoke-test-0001"
    idempotency_key = "idem-smoke-test-0001"
    operation = {
        "command_id": str(command_id),
        "tenant_id": tenant_id,
        "command_type": "moneybee.crm.project",
        "command_version": "1.0",
        "target": "odoo-19",
        "requested_by": "moneybee-backend",
        "correlation_id": correlation_id,
        "idempotency_key": idempotency_key,
        "capability": "ODOO_WRITE",
        "state": "completed",
        "provider_operation_id": "odoo:123",
        "last_error": None,
        "created_at": "2026-08-29T00:00:00Z",
        "updated_at": "2026-08-29T00:00:01Z",
        "duplicate": False,
    }

    observations: dict[str, object] = {
        "post_count": 0,
        "get_count": 0,
        "post_body": None,
        "post_headers": {},
        "get_headers": {},
    }

    class Handler(http.server.BaseHTTPRequestHandler):
        def _json_response(self, status: int, body: dict[str, object]) -> None:
            encoded = json.dumps(body).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("X-Correlation-ID", correlation_id)
            self.end_headers()
            self.wfile.write(encoded)

        def do_POST(self) -> None:  # noqa: N802
            observations["post_count"] = int(observations["post_count"]) + 1
            observations["post_headers"] = {
                "tenant": self.headers.get("X-Tenant-ID"),
                "correlation": self.headers.get("X-Correlation-ID"),
                "idempotency": self.headers.get("Idempotency-Key"),
                "authorization": self.headers.get("Authorization"),
            }
            length = int(self.headers.get("Content-Length", "0"))
            observations["post_body"] = json.loads(self.rfile.read(length) or b"{}")
            if self.path != "/v1/commands":
                self._json_response(404, {"error": {"code": "not_found", "message": "not found", "correlation_id": correlation_id, "retryable": False, "details": {}}})
                return
            self.send_response(202)
            encoded = json.dumps(operation).encode("utf-8")
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Location", f"/v1/operations/{command_id}")
            self.send_header("X-Correlation-ID", correlation_id)
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self) -> None:  # noqa: N802
            observations["get_count"] = int(observations["get_count"]) + 1
            observations["get_headers"] = {
                "tenant": self.headers.get("X-Tenant-ID"),
                "authorization": self.headers.get("Authorization"),
            }
            if self.path != f"/v1/operations/{command_id}":
                self._json_response(404, {"error": {"code": "not_found", "message": "not found", "correlation_id": correlation_id, "retryable": False, "details": {}}})
                return
            self._json_response(200, operation)

        def log_message(self, *_args: object) -> None:
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        configuration = Configuration(host=f"http://127.0.0.1:{server.server_address[1]}")
        with codestra_middleware_sdk.ApiClient(configuration) as api_client:
            api_client.default_headers["Authorization"] = "Bearer smoke-test-product-token"
            api = DefaultApi(api_client)
            command = CommandEnvelope(
                command_id=command_id,
                command_type="moneybee.crm.project",
                command_version="1.0",
                target="odoo-19",
                tenant_id=tenant_id,
                requested_by="moneybee-backend",
                correlation_id=correlation_id,
                idempotency_key=idempotency_key,
                capability="ODOO_WRITE",
                payload={"intake_id": "MB-CONTACT-EXAMPLE"},
            )
            submitted = api.submit_command(
                x_tenant_id=tenant_id,
                x_correlation_id=correlation_id,
                idempotency_key=idempotency_key,
                command_envelope=command,
            )
            fetched = api.get_operation(
                command_id=command_id,
                x_tenant_id=tenant_id,
            )

        if observations["post_count"] != 1 or observations["get_count"] != 1:
            fail(f"expected one POST and one GET, saw {observations!r}")
        post_headers = observations["post_headers"]
        assert isinstance(post_headers, dict)
        if post_headers.get("tenant") != tenant_id:
            fail("generated client did not send X-Tenant-ID")
        if post_headers.get("correlation") != correlation_id:
            fail("generated client did not send X-Correlation-ID")
        if post_headers.get("idempotency") != idempotency_key:
            fail("generated client did not send Idempotency-Key")
        if post_headers.get("authorization") != "Bearer smoke-test-product-token":
            fail("generated client did not preserve bearer authorization")
        body = observations["post_body"]
        if not isinstance(body, dict) or body.get("command_id") != str(command_id):
            fail(f"command body did not serialize correctly: {body!r}")
        if body.get("tenant_id") != tenant_id or body.get("capability") != "ODOO_WRITE":
            fail(f"command authority fields did not serialize correctly: {body!r}")
        if str(submitted.command_id) != str(command_id) or submitted.state.value != "completed":
            fail(f"submitted operation did not deserialize correctly: {submitted!r}")
        if str(fetched.command_id) != str(command_id) or fetched.state.value != "completed":
            fail(f"operation read-back did not deserialize correctly: {fetched!r}")

        print(
            "PASS: generated Middleware Python SDK submitted a command with the "
            "required authority headers and read the typed operation back."
        )
    finally:
        server.shutdown()
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
