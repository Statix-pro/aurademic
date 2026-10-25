import { Eye } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

import { STATUS_BADGE, errorMessage, formatDateTime } from './importLabels';
import ImportPager from './ImportPager';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { AdminIconButton } from '../components/AdminScreen';

import type { ApiEnvelope, ImportBatch, ImportSource } from './types';

const PER_PAGE = 20;

interface ImportHistoryProps {
  sources: ImportSource[];
  onOpen: (batchId: number) => void;
}

/** Every import, newest first: who read which file when, what it did, and whether it was applied. */
const ImportHistory: React.FC<ImportHistoryProps> = ({ sources, onOpen }) => {
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = (await authenticityUtility.get('/journal-catalog/imports', {
        params: { page, per_page: PER_PAGE },
      })) as ApiEnvelope<{ imports: ImportBatch[]; total: number }>;
      setImports(response.data?.imports ?? []);
      setTotal(response.data?.total ?? 0);
      setError('');
    } catch (err) {
      setImports([]);
      setError(errorMessage(err, 'Failed to load the import history.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const label = (key: string) => sources.find((source) => source.key === key)?.label ?? key;

  const columns = [
    {
      key: 'id',
      label: 'Import',
      style: { width: '80px' },
      render: (row: ImportBatch) => <span className="admin-muted">#{row.id}</span>,
    },
    {
      key: 'source_key',
      label: 'File',
      render: (row: ImportBatch) => (
        <>
          <span className="admin-name">{label(row.source_key)}</span>
          <span className="journal-import__secondary">
            {row.file_name}
            {row.metric_year ? ` · ${row.metric_year}` : ''}
          </span>
        </>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: ImportBatch) => (
        <span className={`admin-badge ${STATUS_BADGE[row.status].className}`}>
          {STATUS_BADGE[row.status].label}
        </span>
      ),
    },
    {
      key: 'outcomes',
      label: 'Result',
      render: (row: ImportBatch) => {
        const outcomes = row.summary?.outcomes;
        if (!outcomes) return <span className="admin-muted">—</span>;
        return `${outcomes.add} added · ${outcomes.update} updated · ${outcomes.exception} to review`;
      },
    },
    {
      key: 'created_at',
      label: 'Read',
      render: (row: ImportBatch) => (
        <>
          <span className="journal-import__nowrap">{formatDateTime(row.created_at)}</span>
          <span className="journal-import__secondary">{row.created_by_name ?? '—'}</span>
        </>
      ),
    },
    {
      key: 'applied_at',
      label: 'Applied',
      render: (row: ImportBatch) =>
        row.applied_at ? (
          <>
            <span className="journal-import__nowrap">{formatDateTime(row.applied_at)}</span>
            <span className="journal-import__secondary">{row.applied_by_name ?? '—'}</span>
          </>
        ) : (
          <span className="admin-muted">—</span>
        ),
    },
  ];

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="admin-card">
        <CustomTable
          columns={columns}
          data={imports}
          loading={loading}
          className={imports.length > 0 ? '' : 'journal-import__table--no-actions'}
          emptyMessage="No file has been imported yet"
          actions={
            imports.length > 0
              ? (row: ImportBatch) => (
                  <div className="admin-actions">
                    <AdminIconButton
                      icon={<Eye size={16} aria-hidden="true" />}
                      label="Open import"
                      onClick={() => onOpen(row.id)}
                    />
                  </div>
                )
              : undefined
          }
        />
      </div>
      <ImportPager
        page={page}
        perPage={PER_PAGE}
        total={total}
        onPage={setPage}
        disabled={loading}
      />
    </>
  );
};

export default ImportHistory;
