import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
}

export interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  caption?: string;
}

export function DataTable<T>({ rows, columns, getRowKey, emptyMessage, caption }: DataTableProps<T>): JSX.Element {
  if (rows.length === 0) {
    return <p className="cds-empty">{emptyMessage ?? "No records."}</p>;
  }
  return (
    <div className="cds-table-wrap">
      <table className="cds-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" style={column.align === "right" ? { textAlign: "right" } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} style={column.align === "right" ? { textAlign: "right" } : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
