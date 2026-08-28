#!/usr/bin/env python3
"""Real behavioral smoke test for the generated Python SDK.

scripts/verify-generated-sdks.mjs only checks that the generator produced
the expected files; it never imports the package or calls it. This script
does: install the generated package into a throwaway virtualenv, start a
local HTTP server that returns a real, contract-shaped response, and drive
the generated client against it end to end -- request serialization,
response deserialization, and typed field access all have to actually
work, not just "generation succeeded".

Usage: python3 scripts/smoke_test_python_sdk.py <path-to-generated/python>
"""
from __future__ import annotations

import http.server
import json
import sys
import threading
from pathlib import Path


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: smoke_test_python_sdk.py <path-to-generated/python>")

    sdk_path = Path(sys.argv[1]).resolve()
    if not sdk_path.is_dir():
        fail(f"{sdk_path} is not a directory")

    sys.path.insert(0, str(sdk_path))

    try:
        import codestra_sdk  # noqa: E402
        from codestra_sdk.api.default_api import DefaultApi  # noqa: E402
        from codestra_sdk.configuration import Configuration  # noqa: E402
    except ImportError as error:
        fail(f"could not import the generated package from {sdk_path}: {error}")
        return

    post_id = "6f0a2b3c-1111-4222-8333-000000000001"
    tenant_id = "042880db-aa51-4f16-83b5-ae858ee45ad6"
    canned_response = {
        "id": post_id,
        "tenantId": tenant_id,
        "workspaceId": "042880db-aa51-4f16-83b5-ae858ee45ad7",
        "status": "published",
        "channels": [{"channel": "instagram", "status": "accepted"}],
        "content": {"text": "Smoke-tested by scripts/smoke_test_python_sdk.py"},
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
    }

    seen_requests: list[str] = []
    seen_tenant_headers: list[str | None] = []

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 (stdlib method name)
            seen_requests.append(self.path)
            seen_tenant_headers.append(self.headers.get("X-Codestra-Tenant-Id"))
            expected = f"/v1/social/posts/{post_id}"
            body = json.dumps(canned_response).encode("utf-8")
            self.send_response(200 if self.path == expected else 404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body if self.path == expected else b"{}")

        def log_message(self, *_args: object) -> None:  # silence default stderr logging
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        configuration = Configuration(host=f"http://127.0.0.1:{port}")
        with codestra_sdk.ApiClient(configuration) as api_client:
            api_client.default_headers["Authorization"] = "Bearer smoke-test-token"
            api = DefaultApi(api_client)
            result = api.get_social_post(tenant_id, post_id)

        if not seen_requests:
            fail("the generated client never made an HTTP request")
        if seen_tenant_headers[0] != tenant_id:
            fail(f"expected X-Codestra-Tenant-Id header {tenant_id!r}, server saw {seen_tenant_headers[0]!r}")
        # The generated model types id/tenantId/etc. as uuid.UUID (from the
        # OpenAPI `format: uuid`), not str -- comparing against the string
        # literal directly would always fail even on a correct response.
        if str(result.id) != post_id:
            fail(f"expected id {post_id!r}, got {result.id!r}")
        if result.status.value != "published":
            fail(f"expected status 'published', got {result.status!r}")
        if result.content.text != canned_response["content"]["text"]:
            fail("nested content.text did not round-trip through deserialization")
        if len(result.channels) != 1 or result.channels[0].channel.value != "instagram":
            fail("channels array did not deserialize correctly")

        print(
            "PASS: generated Python SDK imported, called a live HTTP server, "
            "and correctly deserialized the response into typed models."
        )
    finally:
        server.shutdown()
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
