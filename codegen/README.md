# SDK generation

The Python and PHP clients are generated from `contracts/openapi/codestra-public.openapi.yaml`. Generated source is treated as a build artifact, not hand-edited source.

The generator version is pinned in `scripts/generate-sdks.sh`. A generator upgrade requires its own reviewed pull request because template changes can alter serialization, authentication, error handling, or package metadata even when the API contract is unchanged.

Generated clients must preserve these Codestra requirements through templates or a thin handwritten facade before stable publication:

- bearer-token injection without token persistence;
- `X-Codestra-Tenant-Id`, `X-Correlation-Id`, and `Idempotency-Key` support;
- no caching of financial, authentication, or mutation responses;
- retry only for safe methods or idempotent mutations;
- normalized structured errors and request IDs;
- explicit timeouts and cancellation;
- no production base URL credentials or example secrets.
