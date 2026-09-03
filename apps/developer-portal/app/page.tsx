export default function HomePage(): JSX.Element {
  return (
    <div>
      <h1>Codestra developer portal</h1>
      <p className="cds-page-subtitle">
        Build against the Codestra public API: social publishing across six channels, and webhook
        subscriptions delivered as signed, verifiable CloudEvents.
      </p>

      <div className="cds-stat-row">
        <a className="cds-section" href="/docs/api-reference" style={{ textDecoration: "none", color: "inherit" }}>
          <h2>API reference</h2>
          <p>Every operation in <code>codestra-public.openapi.yaml</code>, live-rendered.</p>
        </a>
        <a className="cds-section" href="/docs/events" style={{ textDecoration: "none", color: "inherit" }}>
          <h2>Event catalogue</h2>
          <p>The CloudEvents Codestra publishes, from <code>codestra-events.asyncapi.yaml</code>.</p>
        </a>
        <a className="cds-section" href="/webhooks" style={{ textDecoration: "none", color: "inherit" }}>
          <h2>Webhook subscriptions</h2>
          <p>Create, verify, rotate, enable, and disable your endpoints.</p>
        </a>
        <a className="cds-section" href="/credentials" style={{ textDecoration: "none", color: "inherit" }}>
          <h2>API credentials</h2>
          <p>Your tenant&apos;s own API token -- never anyone else&apos;s.</p>
        </a>
      </div>
    </div>
  );
}
