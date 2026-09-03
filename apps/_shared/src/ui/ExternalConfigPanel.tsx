export interface ExternalConfigField {
  label: string;
  value: string;
}

export interface ExternalConfigPanelProps {
  title: string;
  ownedBy: string;
  fields: readonly ExternalConfigField[];
}

/**
 * Read-only "configured externally" panel. Per
 * `docs/PRODUCTION_CONFIGURATION_CHECKLIST.md`, this repository must never
 * render an editable form for identity-provider or SMTP settings -- so this
 * component renders a `<dl>` only. It has no input, textarea, select, or
 * submit button, on purpose; `test/external-config-panel.test.tsx` asserts
 * that.
 */
export function ExternalConfigPanel({ title, ownedBy, fields }: ExternalConfigPanelProps): JSX.Element {
  return (
    <section className="cds-external-config" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <p className="cds-external-config-owner">Configured externally &middot; owned by {ownedBy} &middot; read-only</p>
      </header>
      <dl>
        {fields.map((field) => (
          <div className="cds-external-config-row" key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
