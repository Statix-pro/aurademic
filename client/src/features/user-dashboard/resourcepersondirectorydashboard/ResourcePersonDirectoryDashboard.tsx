import { Search, Plus, X, Edit3, Eye } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import './ResourcePersonDirectoryDashboard.css';
import '../financecard/financecard.css';
// The add/edit form reuses the resource-person directory's form styles (.rpd-form-wrapper).
import '../../resourcepersondirectory/ResourcePersonDirectory.css';
import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import OrganizationDirectory from '../../organizationdirectory/OrganizationDirectory';
import ResourcePersonDirectory, {
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
  throw new Error(res?.message || 'Failed to load resource persons.');
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

// Helper: build multipart FormData for ResourcePerson operations
const buildPersonFormData = (personData: Omit<ResourcePerson, 'id' | 'date'>): FormData => {
  const formData = new FormData();
  Object.entries(personData).forEach(([key, val]) => {
    if (key === 'professions') {
      formData.append(key, JSON.stringify(val));
    } else if (key === 'photoFile' || key === 'resumeFile') {
      if (val instanceof File) {
        formData.append(key, val);
      }
    } else if (val !== undefined && val !== null) {
      formData.append(key, String(val));
    }
  });
  return formData;
};

const apiCreate = async (
  personData: Omit<ResourcePerson, 'id' | 'date'>,
): Promise<ResourcePerson> => {
  const formData = buildPersonFormData(personData);
  const res = (await authenticityUtility.postFile('/resource-persons', formData)) as any;
  if (res?.success && res.data) return res.data as ResourcePerson;
  throw new Error(res?.message || 'Failed to create resource person.');
};

const apiUpdate = async (
  id: number,
  personData: Omit<ResourcePerson, 'id' | 'date'>,
): Promise<ResourcePerson> => {
  const formData = buildPersonFormData(personData);
  const res = (await authenticityUtility.putFile(`/resource-persons/${id}`, formData)) as any;
  if (res?.success && res.data) return res.data as ResourcePerson;
  throw new Error(res?.message || 'Failed to update resource person.');
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
      setLoadError(err?.message || 'Failed to load resource persons.');
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
        (!nameFilter || (record.name ?? '').toLowerCase().includes(nameFilter)) &&
        (!categoryFilter || (record.category ?? '').toLowerCase().includes(categoryFilter)),
    );
  }, [records, searchName, searchCategory]);

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
    } catch (err: any) {
      setError(err?.message || 'Failed to save record. Please try again.');
    }
  };

  const tableColumns = [
    {
      key: 'sno',
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
          <span>{index + 1}</span>
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Resource Person',
      render: (person: ResourcePerson) => (
        <div className="rpd-name-cell">
          <strong>
            {person.name ||
              `${person.title || ''} ${person.firstName || ''} ${person.lastName || ''}`.trim() ||
              '—'}
          </strong>
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
          </div>
        );
      },
    },
    { key: 'category', label: 'Category', render: (person: ResourcePerson) => person.category },
    {
      key: 'tag',
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
      render: (person: ResourcePerson) => (
        <div className="rpd-center">
          {person.isOwner ? (
            <CustomButton
              variant="outline-primary"
              className="rpd-icon-btn"
              onClick={() => handleEdit(person)}
              title="Edit Resource Person"
              aria-label="Edit Resource Person"
            >
              <Edit3 size={15} />
            </CustomButton>
          ) : (
            <CustomButton
              variant="outline-primary"
              className="rpd-icon-btn"
              onClick={() => setViewingPerson(person)}
              title="View Resource Person"
              aria-label="View Resource Person"
            >
              <Eye size={15} />
            </CustomButton>
          )}
        </div>
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
                <h5 className="financecard-title">Resource Person</h5>
              </div>

              <div className="header-right-section">
                <div className="search-box rpd-dashboard-search">
                  <Search size={18} className="search-icon" />
                  <CustomInput
                    name="rp-search-name"
                    type="search"
                    placeholder="Search Resource Person Name"
                    value={searchName}
                    onChange={setSearchName}
                    className="mb-0"
                  />
                  {searchName && (
                    <X size={16} className="clear-icon" onClick={() => setSearchName('')} />
                  )}
                </div>

                <div className="filter-group">
                  <div className="filter-item">
                    <CustomInput
                      name="rp-search-category"
                      type="search"
                      placeholder="Search Category"
                      value={searchCategory}
                      onChange={setSearchCategory}
                      className="mb-0 rpd-dashboard-filter"
                    />
                  </div>
                </div>

                <CustomButton className="rpd-add-btn" onClick={handleAdd}>
                  <Plus size={15} /> Add
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
              <div className="rpd-table-wrap">
                <CustomTable
                  className="rpd-table"
                  columns={tableColumns}
                  data={filtered}
                  keyField="id"
                  emptyMessage={
                    records.length === 0
                      ? 'No records yet. Click "Add" to add a resource person.'
                      : 'No records match the filter criteria.'
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <CustomModal
        show={viewingPerson !== null}
        onHide={() => setViewingPerson(null)}
        title="Resource Person Details"
        size="xl"
        scrollable
        className="rpd-form-modal"
      >
        {viewingPerson && (
          <ResourcePersonDirectory
            editingPerson={viewingPerson}
            organizations={organizations}
            readOnly
            onSave={() => undefined}
            onCancel={() => setViewingPerson(null)}
          />
        )}
      </CustomModal>
    </div>
  );
};

export default ResourcePersonDirectoryDashboard;
