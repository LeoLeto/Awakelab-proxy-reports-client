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
          <tr style={{ backgroundColor: '#34455c' }}>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  width: c.width,
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '13px',
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              style={{
                borderBottom: '1px solid #eef0f2',
                backgroundColor: i % 2 === 0 ? 'white' : '#fafbfc',
              }}
            >
              {columns.map((c) => (
                <td key={String(c.key)} style={{ padding: '9px 12px', verticalAlign: 'top', fontSize: '13px', color: '#444' }}>
                  {c.render ? c.render(r[c.key], r) : String(r[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: '20px 12px', color: '#aaa', fontSize: '14px' }}>
                Sin filas
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
