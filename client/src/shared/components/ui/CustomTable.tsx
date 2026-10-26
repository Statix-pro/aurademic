import React from 'react';
import { Table } from 'react-bootstrap';
import './common.css';

interface TableColumn {
  key?: string;
  label: string;
  render?: (row: any, rowIndex: number) => React.ReactNode;
  style?: React.CSSProperties;
  /** A secondary column (S.No., Category, Tag, ...) that a phone drops so the table fits
   *  without a sideways scroll; the row's details still carry the value. */
  hideOnPhone?: boolean;
}

const PHONE_HIDDEN = 'custom-table-col--phone-hidden';

interface CustomTableProps {
  columns: TableColumn[];
  data: any[];
  keyField?: string;
  actions?: (row: any, rowIndex: number) => React.ReactNode;
  className?: string;
  loading?: boolean;
  emptyMessage?: string;
  /** Makes each row open the record: click, or Enter/Space when the row has focus. */
  onRowClick?: (row: any) => void;
  /** The accessible name of a clickable row, e.g. "View National Chemical Laboratory". */
  rowLabel?: (row: any) => string;
}

const CustomTable: React.FC<CustomTableProps> = ({
  columns,
  data,
  keyField = 'id',
  actions,
  className = '',
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  rowLabel,
}) => {
  return (
    <div className="table-responsive">
      <Table hover className={`custom-table align-middle ${className}`}>
        <thead className="table-light">
          <tr>
            {columns.map((col, index) => (
              <th
                key={col.key || index}
                style={col.style}
                className={col.hideOnPhone ? PHONE_HIDDEN : undefined}
              >
                {col.label}
              </th>
            ))}
            {actions && (
              <th style={{ fontSize: 'var(--font-size-secondary)', width: '100px' }}>Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-4">
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Loading...
              </td>
            </tr>
          ) : data && data.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr
                key={row[keyField] || rowIndex}
                {...(onRowClick && {
                  className: 'custom-table-row-link',
                  tabIndex: 0,
                  'aria-label': rowLabel?.(row),
                  onClick: () => onRowClick(row),
                  // Only when the row itself has focus, so a button inside it keeps its own keys.
                  onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  },
                })}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={`${row[keyField] || rowIndex}-${col.key || colIndex}`}
                    className={col.hideOnPhone ? PHONE_HIDDEN : undefined}
                  >
                    {col.render ? col.render(row, rowIndex) : row[col.key]}
                  </td>
                ))}
                {actions && <td>{actions(row, rowIndex)}</td>}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                className="text-center py-4 text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default CustomTable;
