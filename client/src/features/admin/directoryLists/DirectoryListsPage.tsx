import { Edit3, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from 'react-bootstrap';

import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomCard from '../../../shared/components/ui/CustomCard';
import CustomFilterSearch from '../../../shared/components/ui/CustomFilterSearch';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomPagination, {
  PAGE_SIZE_OPTIONS,
} from '../../../shared/components/ui/CustomPagination';
import CustomTable from '../../../shared/components/ui/CustomTable';
import CustomTabs, { TabOption } from '../../../shared/components/ui/CustomTabs';
import CustomToggle from '../../../shared/components/ui/CustomToggle';
import DeleteConfirmationModal from '../../../shared/components/ui/DeleteConfirmationModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';

type ListKey = 'tag' | 'specialization';

interface ListEntry {
  id: number;
  list_key: ListKey;
  name: string;
  is_active: boolean;
}

// Both directories pick from these lists; either directory's Directory Admin edits them.
const ENDPOINT = '/directory-options';

// DEFAULT_TAG in server/modules/shared/directoryLists.js, which refuses to rename, retire or
// delete it.
const DEFAULT_TAG = 'General';

const LISTS: TabOption<ListKey>[] = [
  { value: 'tag', label: 'Tag' },
  { value: 'specialization', label: 'Specialization' },
];

/**
 * The Tag and Specialization lists the organization and resource person forms both offer as
 * the only choices. Records store an entry by name, so renaming or retiring one changes only
 * what the forms offer next.
 */
export default function DirectoryListsPage() {
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [list, setList] = useState<ListKey>('tag');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Partial<ListEntry> | null>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ListEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let current = true;
    (async () => {
      try {
        const response = (await authenticityUtility.get(`${ENDPOINT}/all`)) as any;
        if (!current) return;
        setEntries(response.data || []);
        setError('');
      } catch (err: any) {
        if (current) setError(err?.message || 'Failed to load the lists.');
      }
    })();
    return () => {
      current = false;
    };
  }, []);

  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter(
      (entry) => entry.list_key === list && (!needle || entry.name.toLowerCase().includes(needle)),
    );
  }, [entries, list, search]);
  const listLabel = LISTS.find((item) => item.value === list)?.label ?? '';
  // The whole list is already loaded (the forms need every entry), so pages are cut here.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [list, pageSize, search]);

  const openForm = (entry: Partial<ListEntry> | null) => {
    setEditing(entry ?? {});
    setName(entry?.name ?? '');
    setIsActive(entry?.is_active ?? true);
    setFormError('');
  };

  const save = async () => {
    if (!editing || saving) return;
    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing.id) {
        const response = (await authenticityUtility.put(`${ENDPOINT}/${editing.id}`, {
          name: name.trim(),
          is_active: isActive,
        })) as any;
        const saved = response.data as ListEntry;
        setEntries((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
        setNotice('');
      } else {
        // Adding takes several entries at once, separated by commas or new lines.
        const names = name
          .split(/[,\n]/)
          .map((value) => value.trim())
          .filter(Boolean);
        const response = (await authenticityUtility.post(`${ENDPOINT}/${list}`, {
          names,
          is_active: isActive,
        })) as any;
        const { added, skipped } = response.data as { added: ListEntry[]; skipped: string[] };
        setEntries((current) => [...current, ...added]);
        setNotice(
          skipped.length
            ? `Added ${added.length}. Already in the list, so skipped: ${skipped.join(', ')}.`
            : '',
        );
      }
      setEditing(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save the entry.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const response = (await authenticityUtility.delete(`${ENDPOINT}/${deleting.id}`)) as any;
      setEntries((current) =>
        response.data?.deactivated
          ? current.map((entry) =>
              entry.id === deleting.id ? { ...entry, is_active: false } : entry,
            )
          : current.filter((entry) => entry.id !== deleting.id),
      );
      setNotice(response.data?.deactivated ? response.message : '');
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete the entry.');
    } finally {
      setIsDeleting(false);
      setDeleting(null);
    }
  };

  const columns = [
    {
      key: 'sno',
      hideOnPhone: true,
      label: 'S.No.',
      render: (_entry: ListEntry, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      key: 'name',
      label: 'Name',
      // On a phone the Status column is hidden and the pill shows under the name instead.
      render: (entry: ListEntry) => (
        <>
          <span className="dlp-entry-name">{entry.name}</span>
          <span
            className={`dlp-status-pill dlp-status-inline ${entry.is_active ? 'active' : 'inactive'}`}
          >
            {entry.is_active ? 'Active' : 'Inactive'}
          </span>
        </>
      ),
    },
    {
      key: 'is_active',
      hideOnPhone: true,
      label: 'Status',
      render: (entry: ListEntry) => (
        <span className={`dlp-status-pill ${entry.is_active ? 'active' : 'inactive'}`}>
          {entry.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      // General is the Tag a record gets when none is chosen; the server keeps it as it is.
      render: (entry: ListEntry) =>
        entry.list_key === 'tag' && entry.name.toLowerCase() === DEFAULT_TAG.toLowerCase() ? (
          <span className="dlp-default-note">Default</span>
        ) : (
          <div className="dlp-actions">
            <CustomButton
              variant="outline-primary"
              className="dlp-icon-btn"
              onClick={() => openForm(entry)}
              title={`Edit ${entry.name}`}
              aria-label={`Edit ${entry.name}`}
            >
              <Edit3 size={15} />
            </CustomButton>
            <CustomButton
              variant="outline-danger"
              className="dlp-icon-btn dlp-icon-btn--delete"
              onClick={() => setDeleting(entry)}
              title={`Delete ${entry.name}`}
              aria-label={`Delete ${entry.name}`}
            >
              <Trash2 size={15} />
            </CustomButton>
          </div>
        ),
    },
  ];

  return (
    <div className="dlp-page p-3 p-md-4">
      <style>{`
        .dlp-page { min-height: 100%; background: #f1f6fb; }
        .dlp-card { max-width: 900px; border: 0; border-radius: 18px; background: #fff; box-shadow: 0 8px 24px rgba(15,42,70,.08); }
        .dlp-title { color: var(--text-strong); font-size: var(--font-size-page-title); line-height: var(--leading-page-title); font-weight: 700; }
        .dlp-admin-badge { background: #0878bd !important; border-radius: 6px !important; color: #fff !important; display: inline-flex; align-items: center; height: var(--tag-height); font-size: var(--font-size-tertiary); font-weight: 700; letter-spacing: .04em; padding: 0 10px !important; }
        .dlp-intro { color: var(--text-soft); font-size: var(--font-size-secondary); line-height: var(--leading-secondary); }
        .dlp-header-controls { gap: 12px; }
        .dlp-header-controls .custom-filter-search { width: 180px; }
        .custom-btn.dlp-add-btn { display: inline-flex; align-items: center; gap: 6px; min-width: 0; padding: 0 16px; border: 0; border-radius: 12px; }
        .dlp-table.custom-table thead th { padding: var(--table-cell-padding); background: #eef5fd; color: var(--primary-color); font-size: var(--font-size-secondary); line-height: var(--leading-secondary); font-weight: var(--weight-bold); }
        .dlp-table.custom-table tbody td { padding: var(--table-cell-padding); color: var(--text-body); font-size: var(--font-size-body); line-height: var(--leading-body); vertical-align: middle; }
        .dlp-table.custom-table th:nth-child(1), .dlp-table.custom-table td:nth-child(1) { width: 12%; text-align: center; }
        .dlp-table.custom-table th:nth-child(3), .dlp-table.custom-table td:nth-child(3) { width: 18%; text-align: center; }
        .dlp-table.custom-table th:nth-child(4), .dlp-table.custom-table td:nth-child(4) { width: 18%; text-align: center; }
        .dlp-table .dlp-entry-name { color: var(--text-strong); font-weight: 700; }
        .dlp-table .dlp-status-pill.dlp-status-inline { display: none; }
        .dlp-table .dlp-status-pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: var(--font-size-tertiary); font-weight: 600; }
        .dlp-table .dlp-status-pill.active { background: #dcfce7; color: #166534; }
        .dlp-table .dlp-status-pill.inactive { background: #eef2f6; color: #475569; }
        .dlp-table .dlp-actions { display: flex; gap: 6px; justify-content: center; }
        .dlp-table .dlp-default-note { color: var(--text-muted); font-size: var(--font-size-tertiary); line-height: var(--leading-tertiary); }
        @media (max-width: 576px) { .dlp-table .dlp-status-pill.dlp-status-inline { display: table; margin-top: 4px; } }
        .custom-btn.dlp-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: var(--icon-action-size); height: var(--icon-action-size); min-width: 0; min-height: 0; padding: 0; border: 1px solid #0069ab; border-radius: 8px; background: #fff; color: #0069ab; }
        .custom-btn.dlp-icon-btn:hover { background: #e0f0ff; color: #0069ab; }
        .custom-btn.dlp-icon-btn--delete { border-color: #b91c1c; color: #b91c1c; }
        .custom-btn.dlp-icon-btn--delete:hover { background: #fde1e5; color: #b91c1c; }
        .dlp-modal .dlp-help { margin-top: 6px; color: var(--text-soft); font-size: var(--font-size-secondary); line-height: var(--leading-secondary); }
        .dlp-modal .modal-title { font-size: var(--font-size-modal-title); line-height: var(--leading-modal-title); font-weight: 600; }
      `}</style>
      <CustomCard className="dlp-card mx-auto">
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-2">
          <div className="d-flex align-items-center gap-3">
            <h2 className="dlp-title mb-0">Directory Lists</h2>
            <Badge className="dlp-admin-badge">ADMIN</Badge>
          </div>
          <div className="dlp-header-controls d-flex align-items-center flex-wrap">
            <CustomFilterSearch
              name="dlp-search"
              value={search}
              onChange={setSearch}
              placeholder="Search"
            />
            <CustomButton className="dlp-add-btn" onClick={() => openForm(null)}>
              Add <Plus size={15} aria-hidden="true" />
            </CustomButton>
          </div>
        </div>
        <p className="dlp-intro mb-3">
          The organization and resource person forms both offer only these entries. Renaming or
          making one inactive changes what the forms offer next; records keep the value they already
          hold.
        </p>

        <CustomTabs<ListKey>
          options={LISTS}
          value={list}
          onChange={setList}
          ariaLabel="List"
          className="mb-3"
        />

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="alert alert-info" role="status">
            {notice}
          </div>
        )}

        <CustomTable
          columns={columns}
          data={pageRows}
          keyField="id"
          className="dlp-table"
          emptyMessage={
            search.trim()
              ? `No ${listLabel.toLowerCase()} entries match "${search.trim()}".`
              : `No ${listLabel.toLowerCase()} entries yet. Click "Add +" to add one.`
          }
        />
        <CustomPagination
          page={currentPage}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          name="dlp-rows-per-page"
        />
      </CustomCard>

      <CustomModal
        show={editing !== null}
        onHide={() => !saving && setEditing(null)}
        title={`${editing?.id ? 'Edit' : 'Add'} ${listLabel}`}
        // One field needs no more than the kit's small dialog; the default "lg" is 80% wide.
        size="sm"
        className="dlp-modal"
        footer={
          <>
            <CustomButton variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </CustomButton>
            <CustomButton onClick={() => void save()} loading={saving}>
              Save
            </CustomButton>
          </>
        }
      >
        {editing?.id ? (
          <CustomInput
            name="dlp-name"
            label="Name"
            value={name}
            onChange={setName}
            error={formError}
            autoFocus
            required
          />
        ) : (
          <>
            <CustomInput
              name="dlp-name"
              label="Names"
              as="textarea"
              rows={3}
              value={name}
              onChange={setName}
              placeholder="e.g. Chemistry, Physics, Biology"
              error={formError}
              autoFocus
              required
            />
            <div className="dlp-help">Add several at once by separating them with commas.</div>
          </>
        )}
        <CustomToggle
          name="dlp-active"
          label="Active (offered on the form)"
          checked={isActive}
          onChange={setIsActive}
          className="mt-3"
        />
      </CustomModal>

      <DeleteConfirmationModal
        show={deleting !== null}
        onHide={() => !isDeleting && setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        itemName={deleting?.name}
        isDeleting={isDeleting}
      />
    </div>
  );
}
