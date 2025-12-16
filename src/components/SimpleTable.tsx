import React from 'react';

type Column<T> = { key: keyof T | string; label: string; width?: string; render?: (value: any, row: T) => React.ReactNode };

export function SimpleTable<T extends Record<string, any>>(props: {
  columns: Column<T>[];
  rows: T[];
}) {
  const { columns, rows } = props;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px', width: c.width }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
              {columns.map((c) => (
                <td key={String(c.key)} style={{ padding: '8px', verticalAlign: 'top' }}>
                  {c.render ? c.render(r[c.key], r) : String(r[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 12, color: '#666' }}>
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
