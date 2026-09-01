#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GENERATOR_VERSION="${OPENAPI_GENERATOR_VERSION:-7.15.0}"
GENERATOR_IMAGE="${OPENAPI_GENERATOR_IMAGE:-openapitools/openapi-generator-cli:v${GENERATOR_VERSION}}"
PUBLIC_SPEC="/local/contracts/openapi/codestra-public.openapi.yaml"
CONTROL_PLANE_SPEC="/local/contracts/openapi/codestra-control-plane.openapi.yaml"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required to run the pinned OpenAPI generator." >&2
  exit 1
}

rm -rf \
  "$ROOT/generated/python" \
  "$ROOT/generated/php" \
  "$ROOT/generated/middleware-python"
mkdir -p \
  "$ROOT/generated/python" \
  "$ROOT/generated/php" \
  "$ROOT/generated/middleware-python"

run_generator() {
  local generator="$1"
  local spec="$2"
  local config="$3"
  local output="$4"
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    --volume "$ROOT:/local" \
    "$GENERATOR_IMAGE" generate \
    --generator-name "$generator" \
    --input-spec "$spec" \
    --config "/local/$config" \
    --output "/local/$output" \
    --global-property apiTests=true,modelTests=true,apiDocs=true,modelDocs=true
}

# Public application SDKs remain generated from the public API contract.
run_generator python "$PUBLIC_SPEC" codegen/python.yaml generated/python
run_generator php "$PUBLIC_SPEC" codegen/php.yaml generated/php

# Service-to-service clients use the principal Middleware control-plane contract.
# This is deliberately a separate package so public/browser-facing consumers
# cannot accidentally gain command-plane methods by upgrading the public SDK.
run_generator \
  python \
  "$CONTROL_PLANE_SPEC" \
  codegen/python-control-plane.yaml \
  generated/middleware-python

node "$ROOT/scripts/verify-generated-sdks.mjs" "$ROOT/generated"

# Structural validation above only proves the generator produced files. These
# smoke tests install and execute each generated client against local HTTP
# servers so serialization, required headers and typed responses are proven.
python3 -m venv "$ROOT/generated/python/.venv"
"$ROOT/generated/python/.venv/bin/pip" install --quiet -r "$ROOT/generated/python/requirements.txt"
"$ROOT/generated/python/.venv/bin/python" \
  "$ROOT/scripts/smoke_test_python_sdk.py" \
  "$ROOT/generated/python"

python3 -m venv "$ROOT/generated/middleware-python/.venv"
"$ROOT/generated/middleware-python/.venv/bin/pip" install --quiet \
  -r "$ROOT/generated/middleware-python/requirements.txt"
"$ROOT/generated/middleware-python/.venv/bin/python" \
  "$ROOT/scripts/smoke_test_middleware_python_sdk.py" \
  "$ROOT/generated/middleware-python"

composer install --no-interaction --quiet --working-dir="$ROOT/generated/php"
php "$ROOT/scripts/smoke_test_php_sdk.php" "$ROOT/generated/php"
