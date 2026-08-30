# @codestra/intake-survey

Versioned public survey/questionnaire engine for the unified Codestra intake pipeline.

Canonical path:

`survey UI -> @codestra/intake-survey -> @codestra/intake-sdk -> same-origin @codestra/intake-bff -> Caddy -> Kong -> Middleware -> durable processing -> Odoo/analytics/permitted workflows`

Supported v1 capabilities include CSAT, NPS, post-call, post-service, qualification and nonprofit-impact surveys; single/multiple choice, ratings, NPS, yes/no, text, textarea and conditional visibility; anonymous mode when explicitly allowed; expiration; versioning; validation; and protected-field rejection.

Survey responses are represented as survey payloads inside the canonical intake envelope. Full response data should remain survey-response data. Middleware may associate a response with a lead/contact, but survey answers must not be flattened indiscriminately into CRM lead columns.

Public surveys are not approved surfaces for government identifiers, passwords, banking/card credentials, credit reports, medical records/diagnoses or other protected data. Such collection requires a separately reviewed protected workflow.
