import { Edit3, Globe, Plus, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import './OrganizationDirectoryDashboard.css';
// The add/edit form reuses the resource-person directory's form styles (.rpd-form-wrapper).
import '../../resourcepersondirectory/ResourcePersonDirectory.css';
import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomChipList from '../../../shared/components/ui/CustomChipList';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomFilterSearch from '../../../shared/components/ui/CustomFilterSearch';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomPagination, {
  PAGE_SIZE_OPTIONS,
} from '../../../shared/components/ui/CustomPagination';
import CustomSubmitterLine from '../../../shared/components/ui/CustomSubmitterLine';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import OrganizationDirectory, {
  Organization,
} from '../../organizationdirectory/OrganizationDirectory';

/* ─── API Contract (backend must implement) ────────────────────────────────
 * GET    /organizations          → { success: true, data: Organization[] }
 * POST   /organizations          → { success: true, data: Organization }   (body: Omit<Organization, 'id'|'date'>)
 * PUT    /organizations/:id      → { success: true, data: Organization }   (body: Omit<Organization, 'id'|'date'>)
 * ──────────────────────────────────────────────────────────────────────────── */

const apiGetAll = async (): Promise<Organization[]> => {
  const res = (await authenticityUtility.get('/organizations')) as any;
  if (res?.success && Array.isArray(res.data)) return res.data;
  throw new Error(res?.message || 'Failed to load organizations.');
};

const apiCreate = async (orgData: Omit<Organization, 'id' | 'date'>): Promise<Organization> => {
  const res = (await authenticityUtility.post('/organizations', orgData)) as any;
  if (res?.success && res.data) return res.data;
  throw new Error(res?.message || 'Failed to create organization.');
};

const apiUpdate = async (
  id: number,
  orgData: Omit<Organization, 'id' | 'date'>,
): Promise<Organization> => {
  const res = (await authenticityUtility.put(`/organizations/${id}`, orgData)) as any;
  if (res?.success && res.data) return res.data;
  throw new Error(res?.message || 'Failed to update organization.');
};

/* ─── Constants ─────────────────────────────────────────────────────────── */

// A stored website or LinkedIn may be typed without its scheme.
const toHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const CATEGORY_OPTIONS = [
  'Academic',
  'Industry',
  'National Labs',
  'Incubation',
  'Start-up',
  'Government',
  'Organization',
  'Others',
];

// '' is the "no filter" choice, so picking "Search Category" again clears the filter.
const CATEGORY_FILTER_OPTIONS: OptionType[] = [
  { value: '', label: 'Search Category' },
  ...CATEGORY_OPTIONS.map((cat) => ({ value: cat, label: cat })),
];

// Matches the search box beside it on --control-height; CustomDropdown defaults to 45px.
const CATEGORY_FILTER_STYLES = {
  // CustomDropdown merges styles shallowly, so this replaces its whole control style:
  // keep its corners, colours and focus ring, and change only the height.
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: 'var(--control-height)',
    height: 'var(--control-height)',
    backgroundColor: 'var(--bg-input)',
    borderColor: state.isFocused ? 'var(--border-focus)' : 'var(--border-color)',
    borderRadius: 'var(--border-radius-md)',
    boxShadow: state.isFocused ? 'var(--shadow-focus)' : 'none',
    '&:hover': { borderColor: 'var(--border-focus)' },
  }),
  // Text per AGENTS.md typography: 14px, primary-text colour.
  container: (provided: any) => ({ ...provided, fontSize: 'var(--font-size-body)' }),
  singleValue: (provided: any) => ({ ...provided, color: 'var(--text-body)' }),
  valueContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
    padding: '0 12px',
  }),
  indicatorsContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
  }),
  // No bar before the chevron, like the plain selects on the other list pages.
  indicatorSeparator: () => ({ display: 'none' }),
};

/* ═══════════════════════════════════════════════════════════
   Dashboard Component
   ═══════════════════════════════════════════════════════════ */

const OrganizationDirectoryDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [records, setRecords] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  // Another user's approved organization, opened read-only.
  const [viewingOrg, setViewingOrg] = useState<Organization | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  // Directory: the shared list, Approved records only. Mine: the user's own submissions in
  // every status, which is where Status and the Edit-to-resubmit flow matter.
  const [view, setView] = useState<'directory' | 'mine'>('directory');

  const scrollToFormTop = () => {
    document.querySelector<HTMLElement>('.app-content')?.scrollTo({ top: 0, behavior: 'auto' });
  };

  const fetchRecords = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiGetAll();
      setRecords(data);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load organizations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    if (location.state?.openOrganizationForm) {
      setEditingOrg(null);
      setShowForm(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const filtered = useMemo(() => {
    const nameFilter = searchName.trim().toLowerCase();
    const categoryFilter = searchCategory.trim().toLowerCase();

    return records.filter(
      (record) =>
        (view === 'mine' ? record.isOwner : record.approvalStatus === 'Approved') &&
        (!nameFilter ||
          (record.name ?? '').toLowerCase().includes(nameFilter) ||
          (record.abbreviation ?? '').toLowerCase().includes(nameFilter) ||
          (record.specializations ?? []).some((s) => s.toLowerCase().includes(nameFilter)) ||
          (record.city && record.city.toLowerCase().includes(nameFilter))) &&
        (!categoryFilter || (record.category ?? '').toLowerCase() === categoryFilter),
    );
  }, [records, searchName, searchCategory, view]);
  const mineCount = records.filter((record) => record.isOwner).length;
  // A–Z by name, a page at a time, so the list stays quick to scan as it grows.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }),
      ),
    [filtered],
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [searchName, searchCategory, view, pageSize]);

  const handleAdd = () => {
    scrollToFormTop();
    setEditingOrg(null);
    setShowForm(true);
  };

  const handleEdit = (org: Organization) => {
    scrollToFormTop();
    setEditingOrg(org);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingOrg(null);
    setShowForm(false);
  };

  const handleSave = async (orgData: Omit<Organization, 'id' | 'date'>) => {
    setError(null);
    try {
      if (editingOrg) {
        const updated = await apiUpdate(editingOrg.id, orgData);
        setRecords((prev) => prev.map((r) => (r.id === editingOrg.id ? updated : r)));
      } else {
        const created = await apiCreate(orgData);
        setRecords((prev) => [created, ...prev]);
      }
      setEditingOrg(null);
      setShowForm(false);
      // A new or edited record waits for approval, so it is found under My submissions.
      setView('mine');
    } catch (err: any) {
      setError(
        err?.message || err?.response?.data?.message || 'Failed to save record. Please try again.',
      );
    }
  };

  const columns = [
    {
      key: 'sno',
      hideOnPhone: true,
      label: 'S.No.',
      style: { textAlign: 'center' as const },
      render: (_org: Organization, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      key: 'name',
      label: 'Organization',
      // What a reader looks for first: the name, then where it is; the website is one click.
      render: (org: Organization) => {
        const meta = [org.abbreviation, [org.city, org.state].filter(Boolean).join(', ')]
          .filter(Boolean)
          .join(' · ');
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="org-name-line">
              <span className="org-name">{org.name}</span>
              {org.website && (
                <a
                  className="org-website-link"
                  href={toHref(org.website)}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open ${org.website}`}
                  aria-label={`Website of ${org.name}`}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Globe size={14} aria-hidden="true" />
                </a>
              )}
            </span>
            {meta && <span className="org-meta">{meta}</span>}
          </div>
        );
      },
    },
    { key: 'category', hideOnPhone: true, label: 'Category' },
    {
      key: 'tag',
      hideOnPhone: true,
      label: 'Tag',
      render: (org: Organization) => org.tag && <span className="org-tag-pill">{org.tag}</span>,
    },
    {
      key: 'funding',
      hideOnPhone: true,
      label: 'Funding',
      // Older records have none until their next edit.
      render: (org: Organization) => org.funding || '—',
    },
    {
      key: 'specializations',
      hideOnPhone: true,
      label: 'Specializations',
      render: (org: Organization) => <CustomChipList items={org.specializations ?? []} />,
    },
    {
      key: 'approvalStatus',
      label: 'Status',
      render: (org: Organization) => (
        <span
          className={`org-status-pill ${
            org.approvalStatus === 'Approved'
              ? 'approved'
              : org.approvalStatus === 'Rejected'
                ? 'rejected'
                : 'pending'
          }`}
        >
          {org.approvalStatus ||
            ((org as Organization & { is_active?: boolean }).is_active ? 'Approved' : 'Pending')}
        </span>
      ),
    },
    {
      // My submissions only: a row click views the record; Edit is its own button. Saving an
      // edit sends the record for approval again, so looking never needs the edit form.
      key: 'action',
      label: 'Action',
      style: { textAlign: 'center' as const },
      render: (org: Organization) => (
        // Kept off the row, whose click opens the read-only view.
        <span
          className="d-inline-flex"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {org.isOwner && (
            <CustomButton
              variant="outline-primary"
              size="sm"
              className="org-action-edit-btn"
              onClick={() => handleEdit(org)}
              title={
                org.approvalStatus === 'Approved'
                  ? 'Edit Organization (saving sends it for approval again)'
                  : 'Edit Organization'
              }
              aria-label="Edit Organization"
            >
              <Edit3 size={15} />
            </CustomButton>
          )}
        </span>
      ),
    },
  ];

  /* ── Render ── */

  if (isLoading) {
    return (
      <section
        className="budgetdashboard-page d-flex justify-content-center align-items-center"
        style={{ minHeight: '60vh' }}
      >
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="budgetdashboard-page org-directory">
      <div className="budgetdashboard-container">
        {showForm ? (
          <div className="rpd-form-wrapper">
            {error && (
              <div className="alert alert-danger mb-3" role="alert">
                {error}
              </div>
            )}
            <OrganizationDirectory
              editingOrg={editingOrg}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        ) : (
          <div className="budgetdashboard-card">
            {/* Header section styled like Consolidated Budget */}
            <div className="budgetdashboard-header">
              <div className="budgetdashboard-header-left">
                <h5 className="budgetdashboard-title" style={{ paddingLeft: 0 }}>
                  Organization
                </h5>
              </div>

              <div className="budgetdashboard-header-right orgdash-header-controls">
                <div
                  className="budgetdashboard-header-search-group orgdash-filters"
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <CustomFilterSearch
                    name="organization-search"
                    value={searchName}
                    onChange={setSearchName}
                    placeholder="Search organization"
                  />

                  <div className="orgdash-category" style={{ minWidth: 190 }}>
                    <CustomDropdown
                      name="organization-category-filter"
                      options={CATEGORY_FILTER_OPTIONS}
                      value={CATEGORY_FILTER_OPTIONS.find(
                        (option) => option.value === searchCategory,
                      )}
                      onChange={(option) => {
                        if (option && !Array.isArray(option) && 'value' in option) {
                          setSearchCategory(String(option.value));
                        }
                      }}
                      className="mb-0"
                      styles={CATEGORY_FILTER_STYLES}
                    />
                  </div>
                </div>

                <CustomButton className="org-add-btn" onClick={handleAdd}>
                  Add <Plus size={15} aria-hidden="true" />
                </CustomButton>
              </div>
            </div>

            {loadError && (
              <div className="budgetdashboard-body" style={{ paddingTop: 0 }}>
                <div
                  className="alert alert-warning d-flex align-items-center justify-content-between mb-0"
                  role="alert"
                  style={{ borderRadius: '8px', fontSize: 'var(--font-size-body)' }}
                >
                  <span>{loadError}</span>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <CustomButton variant="outline-warning" size="sm" onClick={fetchRecords}>
                      Retry
                    </CustomButton>
                    <CustomButton
                      variant="link"
                      className="p-0"
                      aria-label="Dismiss"
                      onClick={() => setLoadError(null)}
                    >
                      <X size={16} aria-hidden="true" />
                    </CustomButton>
                  </div>
                </div>
              </div>
            )}

            <div className="budgetdashboard-body">
              <div className="org-dir-tabs" role="tablist" aria-label="Organization lists">
                {(
                  [
                    ['directory', 'Directory'],
                    ['mine', `My submissions (${mineCount})`],
                  ] as const
                ).map(([key, text]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={view === key}
                    className={`org-dir-tab${view === key ? ' active' : ''}`}
                    onClick={() => setView(key)}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <div className="budgetdashboard-table-wrapper">
                <CustomTable
                  columns={
                    view === 'mine'
                      ? columns
                      : columns.filter(
                          (column) => column.key !== 'approvalStatus' && column.key !== 'action',
                        )
                  }
                  data={pageRows}
                  keyField="id"
                  onRowClick={(org: Organization) => setViewingOrg(org)}
                  rowLabel={(org: Organization) => `View ${org.name}`}
                  className={`budgetdashboard-table org-table${
                    view === 'directory' ? ' org-table--directory' : ''
                  }`}
                  emptyMessage={
                    view === 'mine'
                      ? 'You have not submitted any organizations. Click "Add" to add one.'
                      : records.length === 0
                        ? 'No organizations in the directory yet.'
                        : 'No records match the filter criteria.'
                  }
                />
                <CustomPagination
                  page={currentPage}
                  pageSize={pageSize}
                  total={sorted.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  name="org-rows-per-page"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <CustomModal
        show={viewingOrg !== null}
        onHide={() => setViewingOrg(null)}
        title="Organization Details"
        size="xl"
        scrollable
        className="org-form-modal"
      >
        {viewingOrg && (
          <div>
            <CustomSubmitterLine
              name={viewingOrg.submitted_by_name}
              email={viewingOrg.submitted_by_email}
              date={viewingOrg.date}
              isYou={viewingOrg.isOwner}
            />
            <OrganizationDirectory
              editingOrg={viewingOrg}
              readOnly
              onSave={() => undefined}
              onCancel={() => setViewingOrg(null)}
            />
          </div>
        )}
      </CustomModal>
    </section>
  );
};

export default OrganizationDirectoryDashboard;
