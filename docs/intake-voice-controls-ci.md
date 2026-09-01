# Intake Voice Controls CI

This branch is expected to validate the complete stacked intake application layer on every exact head:

- compatibility gates
- workspace build
- workspace typecheck
- workspace tests and coverage

The voice controls remain browser-safe and deployment-free. Realtime media stays owned by the communication voice transport. Server control traffic remains same-origin BFF -> Caddy -> Kong -> Middleware.
