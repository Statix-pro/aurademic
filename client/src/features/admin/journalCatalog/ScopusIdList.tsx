import { Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

import { errorMessage, formatDateTime } from './importLabels';
import ImportPager from './ImportPager';
import AlertModal from '../../../shared/components/ui/AlertModal';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { AdminIconButton } from '../components/AdminScreen';

import type { ApiEnvelope, Paged, ScopusIdRow } from './types';

const PER_PAGE = 25;

const SOURCE_LABEL: Record<ScopusIdRow['source'], string> = {
  admin_sheet: 'Staff ID sheet',
  self_claim: 'Confirmed by the staff member',
};

/**
 * Scopus Author IDs added to staff beyond the one on their staff record — from a Staff Scopus
 * Author ID sheet, or a staff member confirming a suggested profile, which counts at once. A
 * wrong one is removed here, and the papers it credited go back to unassigned.
 */
const ScopusIdList: React.FC = () => {
  const [rows, setRows] = useState<ScopusIdRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState<ScopusIdRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = (await authenticityUtility.get('/journal-catalog/scopus-ids', {
        params: { search: search || undefined, page, per_page: PER_PAGE },
      })) as ApiEnvelope<Paged<ScopusIdRow>>;
      setRows(response.data?.rows ?? []);
      setTotal(response.data?.total ?? 0);
      setError('');
    } catch (err) {
      setRows([]);
      setError(errorMessage(err, 'Failed to load the Scopus IDs.'));
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (row: ScopusIdRow) => {
    setRemoving(null);
    try {
      const response = (await authenticityUtility.delete(
        `/journal-catalog/scopus-ids/${row.id}`,
      )) as ApiEnvelope<{ papers: number }>;
      setNotice(
        `Removed Scopus ID ${row.scopus_author_id} from ${row.staff_name}; ${response.data?.papers ?? 0} papers went back to unassigned.`,
      );
      setError('');
      await load();
    } catch (err) {
      setNotice('');
      setError(errorMessage(err, 'Failed to remove the Scopus ID.'));
    }
  };

  const columns = [
    {
      key: 'staff_name',
      label: 'Staff member',
      style: { width: '30%' },
      render: (row: ScopusIdRow) => (
        <>
          <span className="admin-name">{row.staff_name}</span>
          <span className="journal-import__secondary">ERP {row.erp_id}</span>
        </>
      ),
    },
    {
      key: 'scopus_author_id',
      label: 'Scopus Author ID',
      render: (row: ScopusIdRow) => (
        <span className="journal-import__issn">{row.scopus_author_id}</span>
      ),
    },
    { key: 'papers', label: 'Papers credited', render: (row: ScopusIdRow) => row.papers },
    {
      key: 'source',
      label: 'Added by',
      render: (row: ScopusIdRow) => (
        <>
          <span>{SOURCE_LABEL[row.source]}</span>
          <span className="journal-import__secondary">
            {row.created_by_name ?? '—'} · {formatDateTime(row.created_at)}
          </span>
        </>
      ),
    },
  ];

  return (
    <>
      <p className="journal-import__meta">
        Scopus IDs added beyond the one on each staff record, from a Staff Scopus Author ID sheet or
        confirmed by the staff member on their profile. Removing one takes the staff member off the
        imported papers it credited them with.
      </p>

      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <CustomInput
            name="scopusIdSearch"
            className="journal-import__search"
            placeholder="Search name, ERP ID or Scopus ID"
            value={searchInput}
            onChange={setSearchInput}
          />
        </div>
      </div>

      {notice && (
        <Alert variant="success" className="journal-import__notice">
          {notice}
        </Alert>
      )}
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="admin-card">
        <CustomTable
          columns={columns}
          data={rows}
          loading={loading}
          emptyMessage={search ? 'No Scopus ID matches' : 'No Scopus IDs have been added yet'}
          actions={(row: ScopusIdRow) => (
            <div className="admin-actions">
              <AdminIconButton
                icon={<Trash2 size={16} aria-hidden="true" />}
                label="Remove"
                variant="danger"
                onClick={() => setRemoving(row)}
              />
            </div>
          )}
        />
      </div>

      <ImportPager
        page={page}
        perPage={PER_PAGE}
        total={total}
        onPage={setPage}
        disabled={loading}
      />

      <AlertModal
        show={removing !== null}
        onHide={() => setRemoving(null)}
        type="warning"
        title="Remove this Scopus ID?"
        message={
          removing
            ? `${removing.staff_name} will no longer be credited with the ${removing.papers} imported papers this Scopus ID gave them. The papers stay in the portal, unassigned.`
            : ''
        }
        showCancel
        confirmText="Remove"
        onConfirm={() => removing && remove(removing)}
      />
    </>
  );
};

export default ScopusIdList;
