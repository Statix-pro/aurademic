import { Search, Plus, X, Edit3 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import './ResourcePersonDirectoryDashboard.css';
import '../financecard/financecard.css';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import ResourcePersonDirectory, {
  ResourcePerson,
} from '../../resourcepersondirectory/ResourcePersonDirectory';

type ResourcePersonApiRow = Partial<ResourcePerson> & {
  first_name?: string;
  last_name?: string;
  personal_email?: string;
  official_email?: string;
  linked_in?: string;
  photo_name?: string;
  photo_path?: string;
  resume_name?: string;
  resume_path?: string;
  created_at?: string;
};

// LEGACY: normalize rows from servers that have not yet deployed the camelCase
// resource-person serializer. Remove after all API deployments do.
const normalizeResourcePerson = (row: ResourcePersonApiRow): ResourcePerson => {
  const firstName = row.firstName ?? row.first_name ?? '';
  const lastName = row.lastName ?? row.last_name ?? '';

  return {
    ...row,
    firstName,
    lastName,
    name: row.name ?? [row.title, firstName, lastName].filter(Boolean).join(' '),
    personalEmail: row.personalEmail ?? row.personal_email ?? '',
    officialEmail: row.officialEmail ?? row.official_email ?? '',
    linkedIn: row.linkedIn ?? row.linked_in ?? '',
    photoName: row.photoName ?? row.photo_name ?? '',
    resumeName: row.resumeName ?? row.resume_name ?? '',
    professions: row.professions ?? [],
    date: row.date ?? row.created_at ?? '',
  } as ResourcePerson;
};

/* ─── API Contract (backend must implement) ────────────────────────────────
 * GET    /resource-persons          → { success: true, data: ResourcePerson[] }
 * POST   /resource-persons          → { success: true, data: ResourcePerson }   (body: Omit<ResourcePerson, 'id'|'date'>)
 * PUT    /resource-persons/:id      → { success: true, data: ResourcePerson }   (body: Omit<ResourcePerson, 'id'|'date'>)
 * DELETE /resource-persons/:id      → { success: true }
 * ──────────────────────────────────────────────────────────────────────────── */

const apiGetAll = async (): Promise<ResourcePerson[]> => {
  const res = (await authenticityUtility.get('/resource-persons')) as any;
  if (res?.success && Array.isArray(res.data)) return res.data.map(normalizeResourcePerson);
  throw new Error(res?.message || 'Failed to load resource persons.');
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
  if (res?.success && res.data) return normalizeResourcePerson(res.data);
  throw new Error(res?.message || 'Failed to create resource person.');
};

const apiUpdate = async (
  id: number,
  personData: Omit<ResourcePerson, 'id' | 'date'>,
): Promise<ResourcePerson> => {
  const formData = buildPersonFormData(personData);
  const res = (await authenticityUtility.putFile(`/resource-persons/${id}`, formData)) as any;
  if (res?.success && res.data) return normalizeResourcePerson(res.data);
  throw new Error(res?.message || 'Failed to update resource person.');
};

const getPrimary = (p: ResourcePerson) => {
  if (!p.professions?.length) return null;
  return (
    p.professions.find((x) => x.status === 'Working') ||
    p.professions[0]
  );
};

/* ═══════════════════════════════════════════════════════════
   Dashboard Component
   ═══════════════════════════════════════════════════════════ */

const ResourcePersonDirectoryDashboard: React.FC = () => {
  const [records, setRecords] = useState<ResourcePerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<ResourcePerson | null>(null);
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
      setLoadError(err?.message || 'Failed to load resource persons.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
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
    <div className="financecard-page">
      <div className="financecard-container">
        {showForm ? (
          <div className="rpd-form-wrapper">
            {error && (
              <div className="alert alert-danger mb-3" role="alert">
                {error}
              </div>
            )}
            <ResourcePersonDirectory
              editingPerson={editingPerson}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        ) : (
          <div className="financecard-card">
            <div className="financecard-header-single">
              <div className="header-left-section">
                <h5 className="financecard-title">Resource Person</h5>
              </div>

              <div className="header-right-section">
                <div className="search-box">
                  <Search size={18} className="search-icon" />
                  <input
                    type="search"
                    placeholder="Search Resource Person Name"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                  {searchName && (
                    <X size={16} className="clear-icon" onClick={() => setSearchName('')} />
                  )}
                </div>

                <div className="filter-group">
                  <div className="filter-item">
                    <input
                      className="financecard-financial-year"
                      type="search"
                      placeholder="Search Category"
                      value={searchCategory}
                      onChange={(e) => setSearchCategory(e.target.value)}
                      aria-label="Search category"
                    />
                  </div>
                </div>

                <button type="button" className="rpd-add-btn" onClick={handleAdd}>
                  <Plus size={15} /> Add
                </button>
              </div>
            </div>

            {loadError && (
              <div className="financecard-body" style={{ paddingTop: 0 }}>
                <div
                  className="alert alert-warning d-flex align-items-center justify-content-between mb-0"
                  role="alert"
                  style={{ borderRadius: '8px', fontSize: '0.875rem' }}
                >
                  <span>{loadError}</span>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning"
                      onClick={fetchRecords}
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Dismiss"
                      onClick={() => setLoadError(null)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="financecard-body">
              <div className="rpd-table-wrap">
                <table className="rpd-table">
                  <thead>
                    <tr>
                      <th>S.No.</th>
                      <th>Resource Person</th>
                      <th>Organization</th>
                      <th>Category</th>
                      <th>Tag</th>
                      <th>Status</th>
                      <th className="rpd-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length > 0 ? (
                      filtered.map((person, index) => {
                        const primary = getPrimary(person);
                        return (
                          <tr key={person.id}>
                            <td>
                              <div className="rpd-sno-cell">
                                <span
                                  className="rpd-status-dot"
                                  style={{
                                    backgroundColor:
                                      person.status === 'In Service' ? '#137a3a' : '#a97900',
                                  }}
                                  title={person.status}
                                />
                                <span>{index + 1}</span>
                              </div>
                            </td>
                            <td>
                              <div className="rpd-name-cell">
                                <strong>{person.name || `${person.title || ''} ${person.firstName || ''} ${person.lastName || ''}`.trim() || '—'}</strong>
                                <span>{primary?.designation || '—'}</span>
                              </div>
                            </td>
                            <td>
                              <div className="rpd-org-cell">
                                <strong>{primary?.organization || '—'}</strong>
                                <span>{primary?.city || ''}</span>
                              </div>
                            </td>
                            <td>{person.category}</td>
                            <td>
                              <span className="rpd-tag">{person.tag}</span>
                            </td>
                            <td>
                              <span className={`rpd-status-pill ${
                                (person as ResourcePerson & { approvalStatus?: string }).approvalStatus === 'Approved'
                                  ? 'rpd-status-active'
                                  : (person as ResourcePerson & { approvalStatus?: string }).approvalStatus === 'Rejected'
                                    ? 'rpd-status-rejected'
                                    : 'rpd-status-inactive'
                              }`}>
                                {(person as ResourcePerson & { approvalStatus?: string }).approvalStatus || 'Pending'}
                              </span>
                            </td>

                            <td className="rpd-center">
                              <button
                                type="button"
                                className="rpd-icon-btn"
                                onClick={() => handleEdit(person)}
                                title="Edit Resource Person"
                              >
                                <Edit3 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="rpd-empty">
                          {records.length === 0
                            ? 'No records yet. Click "Add" to add a resource person.'
                            : 'No records match the filter criteria.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourcePersonDirectoryDashboard;
