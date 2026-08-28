#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GENERATOR_VERSION="${OPENAPI_GENERATOR_VERSION:-7.15.0}"
GENERATOR_IMAGE="${OPENAPI_GENERATOR_IMAGE:-openapitools/openapi-generator-cli:v${GENERATOR_VERSION}}"
SPEC="/local/contracts/openapi/codestra-public.openapi.yaml"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required to run the pinned OpenAPI generator." >&2
  exit 1
}

rm -rf "$ROOT/generated/python" "$ROOT/generated/php"
mkdir -p "$ROOT/generated/python" "$ROOT/generated/php"

run_generator() {
  local generator="$1"
  local config="$2"
  local output="$3"
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    --volume "$ROOT:/local" \
    "$GENERATOR_IMAGE" generate \
    --generator-name "$generator" \
    --input-spec "$SPEC" \
    --config "/local/$config" \
    --output "/local/$output" \
    --global-property apiTests=true,modelTests=true,apiDocs=true,modelDocs=true
}

run_generator python codegen/python.yaml generated/python
run_generator php codegen/php.yaml generated/php

node "$ROOT/scripts/verify-generated-sdks.mjs" "$ROOT/generated"

# Structural validation above only proves the generator produced files --
# it has previously passed on a PHP SDK that could not even be parsed
# (see the invokerPackage note in codegen/php.yaml's git history). These
# smoke tests actually install and run each generated client.
python3 -m venv "$ROOT/generated/python/.venv"
"$ROOT/generated/python/.venv/bin/pip" install --quiet -r "$ROOT/generated/python/requirements.txt"
"$ROOT/generated/python/.venv/bin/python" "$ROOT/scripts/smoke_test_python_sdk.py" "$ROOT/generated/python"

composer install --no-interaction --quiet --working-dir="$ROOT/generated/php"
php "$ROOT/scripts/smoke_test_php_sdk.php" "$ROOT/generated/php"
