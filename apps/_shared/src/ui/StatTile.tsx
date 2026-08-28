export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatTile({ label, value, hint }: StatTileProps): JSX.Element {
  return (
    <div className="cds-stat-tile">
      <span className="cds-stat-label">{label}</span>
      <span className="cds-stat-value">{value}</span>
      {hint ? <span className="cds-stat-hint">{hint}</span> : null}
    </div>
  );
}
