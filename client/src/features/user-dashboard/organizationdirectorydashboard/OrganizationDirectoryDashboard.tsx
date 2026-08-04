import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Edit3 } from 'lucide-react';
import './OrganizationDirectoryDashboard.css';
import OrganizationDirectory, { Organization } from '../../organizationdirectory/OrganizationDirectory';
import authenticityUtility, { isFallbackEligible } from '../../../shared/utils/authenticityUtility';
import { useAbility } from '../../../shared/casl/AbilityContext';

/* ─── API Contract (backend must implement) ────────────────────────────────
 * GET    /organizations          → { success: true, data: Organization[] }
 * POST   /organizations          → { success: true, data: Organization }   (body: Omit<Organization, 'id'|'date'>)
 * PUT    /organizations/:id      → { success: true, data: Organization }   (body: Omit<Organization, 'id'|'date'>)
 * DELETE /organizations/:id      → { success: true }
 * ──────────────────────────────────────────────────────────────────────────── */

// LEGACY: _v1 key ('organizationDirectoryRecords_v1') is orphaned. It will be discarded once the backend is live — no migration needed.
// FALLBACK: The _v2 key below is used as a fallback while the backend is absent. Remove the entire FALLBACK block (and STORAGE_KEY) once the API is live.
const STORAGE_KEY = 'organizationDirectoryRecords_v2';


const fallbackGetAll = (): Organization[] => {
  // FALLBACK: remove once backend is live
  console.warn('[Organization] API unavailable — reading from localStorage fallback');
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Organization[]) : [];
  } catch {
    return [];
  }
};

const fallbackSave = (records: Organization[]) => {
  // FALLBACK: remove once backend is live
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
};

let isApiAvailable = false;

const apiGetAll = async (): Promise<Organization[]> => {
  try {
    const res = (await authenticityUtility.get('/organizations')) as any;
    if (res?.success && Array.isArray(res.data)) {
      isApiAvailable = true;
      return res.data;
    }
    throw new Error(res?.message || 'Invalid response');
  } catch (err: any) {
    if (isFallbackEligible(err) || (!isApiAvailable && err.response?.status === 404)) {
      return fallbackGetAll();
    }
    throw err;
  }
};

const apiCreate = async (orgData: Omit<Organization, 'id' | 'date'>): Promise<Organization> => {
  try {
    const res = (await authenticityUtility.post('/organizations', orgData)) as any;
    if (res?.success && res.data) {
      isApiAvailable = true;
      return res.data;
    }
    throw new Error(res?.message || 'Invalid response');
  } catch (err: any) {
    const fallbackAllowed = isFallbackEligible(err) || (!isApiAvailable && err.response?.status === 404);
    if (!fallbackAllowed) throw err;
    // FALLBACK: remove once backend is live
    console.warn('[Organization] API unavailable — writing to localStorage fallback');
    const existing = fallbackGetAll();
    const newRecord: Organization = {
      id: Math.max(0, ...existing.map((r) => r.id)) + 1,
      date: new Date().toISOString().slice(0, 10),
      ...orgData,
    };
    fallbackSave([newRecord, ...existing]);
    return newRecord;
  }
};

const apiUpdate = async (id: number, orgData: Omit<Organization, 'id' | 'date'>): Promise<Organization> => {
  try {
    const res = (await authenticityUtility.put(`/organizations/${id}`, orgData)) as any;
    if (res?.success && res.data) {
      isApiAvailable = true;
      return res.data;
    }
    throw new Error(res?.message || 'Invalid response');
  } catch (err: any) {
    const fallbackAllowed = isFallbackEligible(err) || (!isApiAvailable && err.response?.status === 404);
    if (!fallbackAllowed) throw err;
    // FALLBACK: remove once backend is live
    console.warn('[Organization] API unavailable — writing to localStorage fallback');
    const existing = fallbackGetAll();
    const updated = existing.map((r) => (r.id === id ? { ...r, ...orgData } : r));
    fallbackSave(updated);
    const found = updated.find((r) => r.id === id);
    if (!found) throw new Error('Record not found');
    return found;
  }
};

/* ─── Constants ─────────────────────────────────────────────────────────── */

const CATEGORY_OPTIONS = [
  'Academic', 'Industry', 'National Labs', 'Incubation', 'Start-up', 'Government'
];

/* ═══════════════════════════════════════════════════════════
   Dashboard Component
   ═══════════════════════════════════════════════════════════ */

const OrganizationDirectoryDashboard: React.FC = () => {
  const ability = useAbility();
  const [records, setRecords] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  const fetchRecords = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGetAll();
      setRecords(data);
    } catch {
      setError('Failed to load organizations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filtered = useMemo(() => {
    const nameFilter = searchName.trim().toLowerCase();
    const categoryFilter = searchCategory.trim().toLowerCase().replace(/^legacy-/, '');

    return records.filter(
      (record) =>
        (!nameFilter || (record.name ?? '').toLowerCase().includes(nameFilter) || (record.abbreviation ?? '').toLowerCase().includes(nameFilter) || (record.city && record.city.toLowerCase().includes(nameFilter))) &&
        (!categoryFilter || (record.category ?? '').toLowerCase() === categoryFilter),
    );

  }, [records, searchName, searchCategory]);

  const handleAdd = () => {
    setEditingOrg(null);
    setShowForm(true);
  };

  const handleEdit = (org: Organization) => {
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
    } catch {
      setError('Failed to save record. Please try again.');
    }
  };

  /* ── Render ── */

  if (isLoading) {
    return (
      <section className="budgetdashboard-page d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </section>
    );
  }

  if (error && !showForm) {
    return (
      <section className="budgetdashboard-page d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="alert alert-danger" role="alert">
          {error}{' '}
          <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={fetchRecords}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="budgetdashboard-page">
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
                <h5 className="budgetdashboard-title" style={{ paddingLeft: 0 }}>Organization</h5>
              </div>

              <div className="budgetdashboard-header-right">
                <div className="budgetdashboard-header-search-group" style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="budgetdashboard-search"
                      placeholder="Search Organization"
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      style={{ marginRight: '10px', paddingRight: '30px' }}
                    />
                    {searchName ? (
                      <X
                        size={16}
                        style={{
                          position: 'absolute',
                          right: '20px',
                          cursor: 'pointer',
                          color: '#64748b'
                        }}
                        onClick={() => setSearchName('')}
                      />
                    ) : (
                      <Search
                        size={16}
                        style={{
                          position: 'absolute',
                          right: '20px',
                          color: '#94a3b8',
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  </div>

                  <select
                    className="budgetdashboard-financial-year"
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    style={{ marginRight: '10px', textTransform: 'capitalize' }}
                  >
                    <option value="">Search Category</option>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={`legacy-${cat.toLowerCase()}`}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {ability.can('create', 'MasterData') && (
                  <button
                    type="button"
                    className="budgetdashboard-add-btn"
                    onClick={handleAdd}
                  >
                    Add +
                  </button>
                )}
              </div>
            </div>

            <div className="budgetdashboard-body">
              <div className="budgetdashboard-table-wrapper">
                <table className="budgetdashboard-table org-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center' }}>S.No.</th>
                      <th>Organization</th>
                      <th>Category</th>
                      <th>Tag</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length > 0 ? (
                      filtered.map((org, index) => {
                        return (
                          <tr key={org.id}>
                            <td style={{ textAlign: 'center' }}>
                              {index + 1}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: '#1f2937' }}>
                                  {org.name}
                                </span>
                                {org.city && (
                                  <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                    {org.city}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>{org.category}</td>
                            <td>
                              {org.tag && (
                                <span className="org-tag-pill">
                                  {org.tag}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {ability.can('edit', 'MasterData') && (
                                <button
                                  type="button"
                                  className="org-action-edit-btn"
                                  onClick={() => handleEdit(org)}
                                  title="Edit Organization"
                                >
                                  <Edit3 size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="org-empty-state">
                          {records.length === 0
                            ? 'No records yet. Click "Add +" to add an organization.'
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
    </section>
  );
};

export default OrganizationDirectoryDashboard;
