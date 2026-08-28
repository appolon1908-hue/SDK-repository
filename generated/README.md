# Generated SDK output

CI writes Python and PHP clients into this directory temporarily and uploads them as exact-SHA artifacts. Generated source is ignored by Git so reviews focus on the canonical contract and generator configuration.

Generation alone does not prove the output works. `scripts/generate-sdks.sh` also runs `scripts/smoke_test_python_sdk.py` and `scripts/smoke_test_php_sdk.php` against each freshly generated client: install it into a real venv/vendor tree, start a local HTTP server returning a real contract-shaped response, and call the generated client end to end — request headers, response deserialization, and nested/typed model access all have to actually work. `scripts/verify-generated-sdks.mjs`'s structural check (files exist, no leaked credentials) previously passed on a PHP SDK that could not even be parsed by `php -l`, because nothing ever imported or ran the generated code; that bug is what the smoke tests exist to catch.

Stable publication should occur from a protected release workflow that regenerates from the reviewed commit, tests the package, signs provenance, and publishes the immutable artifact. Do not publish a developer workstation's generated directory.
