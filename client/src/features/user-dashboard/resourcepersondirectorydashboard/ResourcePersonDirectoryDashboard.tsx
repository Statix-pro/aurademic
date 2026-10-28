import { Edit3, Linkedin, Plus, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import './ResourcePersonDirectoryDashboard.css';
import '../financecard/financecard.css';
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
import OrganizationDirectory from '../../organizationdirectory/OrganizationDirectory';
import ResourcePersonDirectory, {
  buildResourcePersonFormData,
  CATEGORY_OPTIONS,
  ResourcePerson,
} from '../../resourcepersondirectory/ResourcePersonDirectory';

import type { Organization } from '../../organizationdirectory/OrganizationDirectory';

/* ─── API Contract (backend must implement) ────────────────────────────────
 * GET    /resource-persons          → { success: true, data: ResourcePerson[] }
 * POST   /resource-persons          → { success: true, data: ResourcePerson }   (body: Omit<ResourcePerson, 'id'|'date'>)
 * PUT    /resource-persons/:id      → { success: true, data: ResourcePerson }   (body: Omit<ResourcePerson, 'id'|'date'>)
 * ──────────────────────────────────────────────────────────────────────────── */

const apiGetAll = async (): Promise<ResourcePerson[]> => {
  const res = (await authenticityUtility.get('/resource-persons')) as any;
  if (res?.success && Array.isArray(res.data)) return res.data as ResourcePerson[];
  throw new Error(res?.message || 'Failed to load people.');
};

const apiGetOrganizations = async (): Promise<Organization[]> => {
  const res = (await authenticityUtility.get('/organizations')) as any;
  if (res?.success && Array.isArray(res.data)) return res.data as Organization[];
  throw new Error(res?.message || 'Failed to load organizations.');
};

// Same call OrganizationDirectoryDashboard makes to create an organization.
const apiCreateOrganization = async (
  orgData: Omit<Organization, 'id' | 'date'>,
): Promise<Organization> => {
  const res = (await authenticityUtility.post('/organizations', orgData)) as any;
  if (res?.success && res.data) return res.data;
  throw new Error(res?.message || 'Failed to create organization.');
};

// A stored website or LinkedIn may be typed without its scheme.
const toHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// The category filter offers the form's own categories; '' is the "no filter" choice, so
// picking "Search Category" again clears it.
const CATEGORY_FILTER_OPTIONS: OptionType[] = [
  { value: '', label: 'Search Category' },
  ...CATEGORY_OPTIONS.map((category) => ({ value: category, label: category })),
];

// Matches the search box beside it and the Organization page's filter: --control-height and
// the shared input border, background and focus ring. CustomDropdown merges styles
// shallowly, so the control restates them.
const CATEGORY_FILTER_STYLES = {
  control: (provided: any, state: any) => ({
    ...provided,
    minWidth: 190,
    minHeight: 'var(--control-height)',
    height: 'var(--control-height)',
    backgroundColor: 'var(--bg-input)',
    borderColor: state.isFocused ? 'var(--border-focus)' : 'var(--border-color)',
    borderRadius: 'var(--border-radius-md)',
    boxShadow: state.isFocused ? 'var(--shadow-focus)' : 'none',
    '&:hover': { borderColor: 'var(--border-focus)' },
  }),
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
  // Text per AGENTS.md typography: 14px, primary-text colour.
  container: (provided: any) => ({ ...provided, fontSize: 'var(--font-size-body)' }),
  singleValue: (provided: any) => ({ ...provided, color: 'var(--text-body)' }),
  indicatorSeparator: () => ({ display: 'none' }),
};

const apiCreate = async (
  personData: Omit<ResourcePerson, 'id' | 'date'>,
): Promise<ResourcePerson> => {
  const formData = buildResourcePersonFormData(personData);
  const res = (await authenticityUtility.postFile('/resource-persons', formData)) as any;
  if (res?.success && res.data) return res.data as ResourcePerson;
  throw new Error(res?.message || 'Failed to add person.');
};

const apiUpdate = async (
  id: number,
  personData: Omit<ResourcePerson, 'id' | 'date'>,
): Promise<ResourcePerson> => {
  const formData = buildResourcePersonFormData(personData);
  const res = (await authenticityUtility.putFile(`/resource-persons/${id}`, formData)) as any;
  if (res?.success && res.data) return res.data as ResourcePerson;
  throw new Error(res?.message || 'Failed to update person.');
};

const getPrimary = (p: ResourcePerson) => {
  if (!p.professions?.length) return null;
  return p.professions.find((x) => x.status === 'Working') || p.professions[0];
};

/* ═══════════════════════════════════════════════════════════
   Dashboard Component
   ═══════════════════════════════════════════════════════════ */

const ResourcePersonDirectoryDashboard: React.FC = () => {
  const [records, setRecords] = useState<ResourcePerson[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [organizationLoadError, setOrganizationLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<ResourcePerson | null>(null);
  // Another user's approved record, opened read-only. It arrives without contact details.
  const [viewingPerson, setViewingPerson] = useState<ResourcePerson | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  // Directory: the shared list, Approved records only. Mine: the user's own submissions in
  // every status, which is where Status and the Edit-to-resubmit flow matter.
  const [view, setView] = useState<'directory' | 'mine'>('directory');
  // Set while the "add organization" modal is open; receives the saved organization so
  // the resource-person form can select it on the row that asked for it.
  const [organizationRequest, setOrganizationRequest] = useState<{
    onCreated: (organization: Organization) => void;
  } | null>(null);
  const [organizationSaveError, setOrganizationSaveError] = useState<string | null>(null);

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
      setLoadError(err?.message || 'Failed to load people.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    setOrganizationLoadError(null);
    try {
      setOrganizations(await apiGetOrganizations());
    } catch (err: any) {
      setOrganizationLoadError(err?.message || 'Failed to load organizations.');
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchOrganizations();
  }, []);

  const filtered = useMemo(() => {
    const nameFilter = searchName.trim().toLowerCase();
    const categoryFilter = searchCategory.trim().toLowerCase();

    return records.filter(
      (record) =>
        (view === 'mine' ? record.isOwner : record.approvalStatus === 'Approved') &&
        (!nameFilter ||
          (record.name ?? '').toLowerCase().includes(nameFilter) ||
          (record.specializations ?? []).some((s) => s.toLowerCase().includes(nameFilter))) &&
        (!categoryFilter || (record.category ?? '').toLowerCase() === categoryFilter),
    );
  }, [records, searchName, searchCategory, view]);
  const mineCount = records.filter((record) => record.isOwner).length;
  // A–Z by first and last name (the title, Dr./Prof., would group everyone under D and P),
  // a page at a time, so the list stays quick to scan as it grows.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const sorted = useMemo(() => {
    const sortName = (person: ResourcePerson) =>
      `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || person.name || '';
    return [...filtered].sort((a, b) =>
      sortName(a).localeCompare(sortName(b), undefined, { sensitivity: 'base' }),
    );
  }, [filtered]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    setPage(1);
  }, [searchName, searchCategory, view, pageSize]);

  const handleAdd = () => {
    scrollToFormTop();
    setEditingPerson(null);
    setShowForm(true);
  };

  // Opens a modal instead of navigating away, so the unsaved resource-person form survives.
  const handleAddOrganization = (onCreated: (organization: Organization) => void) => {
    setOrganizationSaveError(null);
    setOrganizationRequest({ onCreated });
  };

  const closeOrganizationModal = () => {
    setOrganizationRequest(null);
    setOrganizationSaveError(null);
  };

  const handleCreateOrganization = async (orgData: Omit<Organization, 'id' | 'date'>) => {
    setOrganizationSaveError(null);
    try {
      const created = await apiCreateOrganization(orgData);
      setOrganizations((prev) => [created, ...prev]);
      organizationRequest?.onCreated(created);
      setOrganizationRequest(null);
    } catch (err: any) {
      setOrganizationSaveError(
        err?.message ||
          err?.response?.data?.message ||
          'Failed to save organization. Please try again.',
      );
    }
  };

  const handleCancel = () => {
    setEditingPerson(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (person: ResourcePerson) => {
    scrollToFormTop();
    setEditingPerson(person);
    setShowForm(true);
  };

  const handleSave = async (personData: Omit<ResourcePerson, 'id' | 'date'>) => {
    setError(null);
    try {
      if (editingPerson) {
        const updated = await apiUpdate(editingPerson.id, personData);
        setRecords((prev) => prev.map((r) => (r.id === editingPerson.id ? updated : r)));
      } else {
        const created = await apiCreate(personData);
        setRecords((prev) => [created, ...prev]);
      }
      setEditingPerson(null);
      setShowForm(false);
      // A new or edited record waits for approval, so it is found under My submissions.
      setView('mine');
    } catch (err: any) {
      setError(err?.message || 'Failed to save record. Please try again.');
    }
  };

  const tableColumns = [
    {
      key: 'sno',
      hideOnPhone: true,
      label: 'S.No.',
      render: (person: ResourcePerson, index: number) => (
        <div className="rpd-sno-cell">
          <span
            className="rpd-status-dot"
            style={{
              backgroundColor: person.status === 'In Service' ? '#137a3a' : '#8f6600',
            }}
            title={person.status}
          />
          <span>{(currentPage - 1) * pageSize + index + 1}</span>
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Person',
      render: (person: ResourcePerson) => (
        <div className="rpd-name-cell">
          <span className="rpd-name-line">
            <strong>
              {person.name ||
                `${person.title || ''} ${person.firstName || ''} ${person.lastName || ''}`.trim() ||
                '—'}
            </strong>
            {/* LinkedIn is public, and the quickest way to check an expert's background. */}
            {person.linkedIn && (
              <a
                className="rpd-linkedin-link"
                href={toHref(person.linkedIn)}
                target="_blank"
                rel="noreferrer"
                title="Open LinkedIn profile"
                aria-label={`LinkedIn profile of ${person.name}`}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <Linkedin size={14} aria-hidden="true" />
              </a>
            )}
          </span>
          <span>{getPrimary(person)?.designation || '—'}</span>
        </div>
      ),
    },
    {
      key: 'organization',
      label: 'Organization',
      render: (person: ResourcePerson) => {
        const primary = getPrimary(person);
        return (
          <div className="rpd-org-cell">
            <strong>{primary?.organization || '—'}</strong>
            <span>{primary?.city || ''}</span>
            {/* The submitter's own record, held by an organization not yet approved. */}
            {person.organizationHolds?.length ? (
              <span
                className={`rpd-org-hold${
                  person.organizationHolds.some((hold) => hold.status === 'Rejected')
                    ? ' rejected'
                    : ''
                }`}
              >
                {person.organizationHolds.some((hold) => hold.status === 'Rejected')
                  ? 'Organization rejected: edit and choose another'
                  : 'Waiting for organization approval'}
              </span>
            ) : null}
            {/* Or by a specialization they added from the form, not yet approved. */}
            {person.specializationHolds?.length ? (
              <span
                className={`rpd-org-hold${
                  person.specializationHolds.some((hold) => hold.status === 'Rejected')
                    ? ' rejected'
                    : ''
                }`}
              >
                {person.specializationHolds.some((hold) => hold.status === 'Rejected')
                  ? 'Specialization rejected: edit and remove it'
                  : 'Waiting for specialization approval'}
              </span>
            ) : null}
          </div>
        );
      },
    },
    // Finding a speaker or expert starts here, so it sits right after their organization.
    {
      key: 'specializations',
      hideOnPhone: true,
      label: 'Specializations',
      render: (person: ResourcePerson) => <CustomChipList items={person.specializations ?? []} />,
    },
    {
      key: 'category',
      hideOnPhone: true,
      label: 'Category',
      render: (person: ResourcePerson) => person.category,
    },
    {
      key: 'tag',
      hideOnPhone: true,
      label: 'Tag',
      render: (person: ResourcePerson) => <span className="rpd-tag">{person.tag}</span>,
    },
    {
      key: 'approvalStatus',
      label: 'Status',
      render: (person: ResourcePerson) => (
        <span
          className={`rpd-status-pill ${
            person.approvalStatus === 'Approved'
              ? 'rpd-status-active'
              : person.approvalStatus === 'Rejected'
                ? 'rpd-status-rejected'
                : 'rpd-status-inactive'
          }`}
        >
          {person.approvalStatus || 'Pending'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      style: { textAlign: 'center' as const },
      // My submissions only: a row click views the record; Edit is its own button. Saving an
      // edit sends the record for approval again, so looking never needs the edit form.
      render: (person: ResourcePerson) => (
        // Kept off the row, whose click opens the read-only view.
        <span
          className="d-flex justify-content-center"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {person.isOwner && (
            <CustomButton
              variant="outline-primary"
              className="rpd-icon-btn"
              onClick={() => handleEdit(person)}
              title={
                person.approvalStatus === 'Approved'
                  ? 'Edit Person (saving sends it for approval again)'
                  : 'Edit Person'
              }
              aria-label="Edit Person"
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
      <div
        className="financecard-page d-flex justify-content-center align-items-center"
        style={{ minHeight: '60vh' }}
      >
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="financecard-page rpd-directory">
      <div className="financecard-container">
        {showForm ? (
          <div className="rpd-form-wrapper">
            {error && (
              <div className="alert alert-danger mb-3" role="alert">
                {error}
              </div>
            )}
            {organizationLoadError && (
              <div className="alert alert-warning mb-3" role="alert">
                <span>{organizationLoadError}</span>
                <CustomButton
                  variant="outline-warning"
                  size="sm"
                  className="ms-3"
                  onClick={fetchOrganizations}
                >
                  Retry
                </CustomButton>
              </div>
            )}
            <ResourcePersonDirectory
              editingPerson={editingPerson}
              organizations={organizations}
              onAddOrganization={handleAddOrganization}
              onSave={handleSave}
              onCancel={handleCancel}
            />
            <CustomModal
              show={organizationRequest !== null}
              onHide={closeOrganizationModal}
              title="Add Organization"
              size="xl"
              scrollable
              className="rpd-form-modal"
              // In the footer so a save failure stays visible however far the form is scrolled.
              footer={
                organizationSaveError ? (
                  <div className="alert alert-danger mb-0 w-100" role="alert">
                    {organizationSaveError}
                  </div>
                ) : undefined
              }
            >
              <OrganizationDirectory
                editingOrg={null}
                onSave={handleCreateOrganization}
                onCancel={closeOrganizationModal}
              />
            </CustomModal>
          </div>
        ) : (
          <div className="financecard-card">
            <div className="financecard-header-single">
              <div className="header-left-section">
                <h5 className="financecard-title">People</h5>
              </div>

              <div className="header-right-section">
                <CustomFilterSearch
                  name="rp-search-name"
                  value={searchName}
                  onChange={setSearchName}
                  placeholder="Search people"
                />

                <div className="filter-group">
                  <div className="filter-item">
                    <CustomDropdown
                      name="rp-search-category"
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

                <CustomButton className="rpd-add-btn" onClick={handleAdd}>
                  Add <Plus size={15} aria-hidden="true" />
                </CustomButton>
              </div>
            </div>

            {loadError && (
              <div className="financecard-body" style={{ paddingTop: 0 }}>
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
                      className="p-0 text-secondary"
                      aria-label="Dismiss"
                      onClick={() => setLoadError(null)}
                    >
                      <X size={18} />
                    </CustomButton>
                  </div>
                </div>
              </div>
            )}

            <div className="financecard-body">
              <div className="rpd-dir-tabs" role="tablist" aria-label="People lists">
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
                    className={`rpd-dir-tab${view === key ? ' active' : ''}`}
                    onClick={() => setView(key)}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <div className="rpd-table-wrap">
                <CustomTable
                  className="rpd-table"
                  columns={
                    view === 'mine'
                      ? // Status and Action need the room on a phone; the organization
                        // is still on the record the row opens.
                        tableColumns.map((column) =>
                          column.key === 'organization' ? { ...column, hideOnPhone: true } : column,
                        )
                      : tableColumns.filter(
                          (column) => column.key !== 'approvalStatus' && column.key !== 'action',
                        )
                  }
                  data={pageRows}
                  keyField="id"
                  onRowClick={(person: ResourcePerson) => setViewingPerson(person)}
                  rowLabel={(person: ResourcePerson) => `View ${person.name}`}
                  emptyMessage={
                    view === 'mine'
                      ? 'You have not submitted any people. Click "Add" to add one.'
                      : records.length === 0
                        ? 'No people in the directory yet.'
                        : 'No records match the filter criteria.'
                  }
                />
                <CustomPagination
                  page={currentPage}
                  pageSize={pageSize}
                  total={sorted.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  name="rp-rows-per-page"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <CustomModal
        show={viewingPerson !== null}
        onHide={() => setViewingPerson(null)}
        title="Person Details"
        size="xl"
        scrollable
        className="rpd-form-modal"
      >
        {viewingPerson && (
          <div>
            <CustomSubmitterLine
              name={viewingPerson.submitted_by_name}
              email={viewingPerson.submitted_by_email}
              date={viewingPerson.date}
              isYou={viewingPerson.isOwner}
            />
            <ResourcePersonDirectory
              editingPerson={viewingPerson}
              organizations={organizations}
              readOnly
              onSave={() => undefined}
              onCancel={() => setViewingPerson(null)}
            />
          </div>
        )}
      </CustomModal>
    </div>
  );
};

export default ResourcePersonDirectoryDashboard;
