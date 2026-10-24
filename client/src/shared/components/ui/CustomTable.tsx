import React from 'react';
import { Table } from 'react-bootstrap';
import './common.css';

interface TableColumn {
  key?: string;
  label: string;
  render?: (row: any, rowIndex: number) => React.ReactNode;
  style?: React.CSSProperties;
}

interface CustomTableProps {
  columns: TableColumn[];
  data: any[];
  keyField?: string;
  actions?: (row: any, rowIndex: number) => React.ReactNode;
  className?: string;
  loading?: boolean;
  emptyMessage?: string;
}

const CustomTable: React.FC<CustomTableProps> = ({
  columns,
  data,
  keyField = 'id',
  actions,
  className = '',
  loading = false,
  emptyMessage = 'No data available',
}) => {
  return (
    <div className="table-responsive">
      <Table hover className={`custom-table align-middle ${className}`}>
        <thead className="table-light">
          <tr>
            {columns.map((col, index) => (
              <th key={col.key || index} style={col.style}>
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
              <tr key={row[keyField] || rowIndex}>
                {columns.map((col, colIndex) => (
                  <td key={`${row[keyField] || rowIndex}-${col.key || colIndex}`}>
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
