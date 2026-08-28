# Pact compatibility artifacts

Consumer Pact files are generated into `pact/pacts/` during CI and uploaded as short-lived build artifacts. They are not committed because generated files can conceal stale compatibility evidence.

Publishing to a Pact Broker is intentionally absent from pull-request jobs. Add a separate `workflow_dispatch` release workflow with a protected environment and short-lived broker credentials when the broker is approved.
