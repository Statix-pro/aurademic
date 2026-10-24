import { Search, X, Edit3, Eye } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import './OrganizationDirectoryDashboard.css';
import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
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

const CATEGORY_OPTIONS = [
  'Academic',
  'Industry',
  'National Labs',
  'Incubation',
  'Start-up',
  'Government',
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
        (!nameFilter ||
          (record.name ?? '').toLowerCase().includes(nameFilter) ||
          (record.abbreviation ?? '').toLowerCase().includes(nameFilter) ||
          (record.city && record.city.toLowerCase().includes(nameFilter))) &&
        (!categoryFilter || (record.category ?? '').toLowerCase() === categoryFilter),
    );
  }, [records, searchName, searchCategory]);

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
    } catch (err: any) {
      setError(
        err?.message || err?.response?.data?.message || 'Failed to save record. Please try again.',
      );
    }
  };

  const columns = [
    {
      key: 'sno',
      label: 'S.No.',
      style: { width: '80px', textAlign: 'center' as const },
      render: (_org: Organization, index: number) => index + 1,
    },
    {
      key: 'name',
      label: 'Organization',
      render: (org: Organization) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="org-name">{org.name}</span>
          {org.city && <span className="org-meta">{org.city}</span>}
        </div>
      ),
    },
    { key: 'category', label: 'Category' },
    {
      key: 'tag',
      label: 'Tag',
      render: (org: Organization) => org.tag && <span className="org-tag-pill">{org.tag}</span>,
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
      // A column rather than CustomTable's `actions` so the header keeps reading "Action".
      key: 'action',
      label: 'Action',
      style: { width: '100px', textAlign: 'center' as const },
      render: (org: Organization) =>
        org.isOwner ? (
          <CustomButton
            variant="outline-primary"
            size="sm"
            className="org-action-edit-btn"
            onClick={() => handleEdit(org)}
            title="Edit Organization"
            aria-label="Edit Organization"
          >
            <Edit3 size={15} />
          </CustomButton>
        ) : (
          <CustomButton
            variant="outline-primary"
            size="sm"
            className="org-action-edit-btn"
            onClick={() => setViewingOrg(org)}
            title="View Organization"
            aria-label="View Organization"
          >
            <Eye size={15} />
          </CustomButton>
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

              <div className="budgetdashboard-header-right">
                <div
                  className="budgetdashboard-header-search-group"
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <div
                    className="org-search-field"
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      marginRight: '10px',
                    }}
                  >
                    <CustomInput
                      name="organization-search"
                      placeholder="Search Organization"
                      value={searchName}
                      onChange={setSearchName}
                      aria-label="Search Organization"
                      className="mb-0"
                    />
                    {searchName ? (
                      <CustomButton
                        variant="link"
                        aria-label="Clear organization search"
                        className="p-0"
                        style={{ position: 'absolute', right: '10px' }}
                        onClick={() => setSearchName('')}
                      >
                        <X size={16} style={{ color: '#64748b' }} aria-hidden="true" />
                      </CustomButton>
                    ) : (
                      <Search
                        size={16}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          color: 'var(--placeholder-color)',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                  </div>

                  <div style={{ minWidth: 190, marginRight: '10px' }}>
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

                <CustomButton onClick={handleAdd}>Add +</CustomButton>
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
              <div className="budgetdashboard-table-wrapper">
                <CustomTable
                  columns={columns}
                  data={filtered}
                  keyField="id"
                  className="budgetdashboard-table org-table"
                  emptyMessage={
                    records.length === 0
                      ? 'No records yet. Click "Add +" to add an organization.'
                      : 'No records match the filter criteria.'
                  }
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
          <OrganizationDirectory
            editingOrg={viewingOrg}
            readOnly
            onSave={() => undefined}
            onCancel={() => setViewingOrg(null)}
          />
        )}
      </CustomModal>
    </section>
  );
};

export default OrganizationDirectoryDashboard;
