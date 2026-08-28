export default function ApiReferencePage(): JSX.Element {
  return (
    <div>
      <h1>API reference</h1>
      <p className="cds-page-subtitle">
        Live-rendered from <code>contracts/openapi/codestra-public.openapi.yaml</code> using{" "}
        <code>@redocly/cli build-docs</code> -- the same Redocly tooling{" "}
        <code>scripts/validate-contracts.mjs</code> already uses to lint and bundle this contract. Regenerated
        automatically before every <code>dev</code> and <code>build</code>.
      </p>
      <iframe
        src="/api-reference.html"
        title="Codestra Public API Reference"
        style={{ width: "100%", height: "80vh", border: "1px solid var(--cds-border)", borderRadius: 6 }}
      />
    </div>
  );
}
