import React from 'react';
import PropTypes from 'prop-types';
import { Table } from 'react-bootstrap';
import './common.css';

const CustomTable = ({
  columns,
  data,
  keyField = 'id',
  actions,
  className = '',
  loading = false,
  emptyMessage = 'No data available'
}) => {
  return (
    <div className="table-responsive">
      <Table hover className={`custom-table align-middle ${className}`}>
        <thead className="table-light">
          <tr>
            {columns.map((col, index) => (
              <th key={col.key || index} style={col.style}>{col.label}</th>
            ))}
            {actions && <th style={{ width: '100px' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-4">
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
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
                {actions && (
                  <td>{actions(row, rowIndex)}</td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-4 text-muted">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

CustomTable.propTypes = {
  columns: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string.isRequired,
    render: PropTypes.func,
    style: PropTypes.object
  })).isRequired,
  data: PropTypes.array.isRequired,
  keyField: PropTypes.string,
  actions: PropTypes.func,
  className: PropTypes.string,
  loading: PropTypes.bool,
  emptyMessage: PropTypes.string
};

export default CustomTable;
