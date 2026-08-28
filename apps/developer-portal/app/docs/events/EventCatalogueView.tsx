import type { EventCatalogueChannel } from "../../../lib/contracts";

export interface EventCatalogueViewProps {
  channels: readonly EventCatalogueChannel[];
}

export function EventCatalogueView({ channels }: EventCatalogueViewProps): JSX.Element {
  return (
    <div>
      <h1>Event catalogue</h1>
      <p className="cds-page-subtitle">
        Canonical CloudEvents from <code>contracts/asyncapi/codestra-events.asyncapi.yaml</code>, parsed and
        rendered at request time -- this page always matches the checked-in contract file.
      </p>

      {channels.map((channel) => (
        <section className="cds-section" key={channel.key}>
          <h2>{channel.address}</h2>
          {channel.messages.map((message) => (
            <div key={message.name}>
              <p className="cds-op-summary">
                {message.title} &middot; <code>type: {message.cloudEventType}</code>
              </p>
              {message.fields.length > 0 ? (
                <table className="cds-op-params">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Type</th>
                      <th>Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {message.fields.map((field) => (
                      <tr key={field.name}>
                        <td>
                          <code>{field.name}</code>
                          {field.enumValues ? (
                            <div style={{ color: "var(--cds-text-muted)", fontSize: "0.75rem" }}>
                              {field.enumValues.join(" | ")}
                            </div>
                          ) : null}
                        </td>
                        <td>{field.type}</td>
                        <td>{field.required ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
