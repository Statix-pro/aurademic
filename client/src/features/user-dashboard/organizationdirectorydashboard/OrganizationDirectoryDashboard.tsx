import { Search, X, Edit3 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import './OrganizationDirectoryDashboard.css';
import { useAbility } from '../../../shared/casl/AbilityContext';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import OrganizationDirectory, {
  Organization,
} from '../../organizationdirectory/OrganizationDirectory';

/* ─── API Contract (backend must implement) ────────────────────────────────
 * GET    /organizations          → { success: true, data: Organization[] }
 * POST   /organizations          → { success: true, data: Organization }   (body: Omit<Organization, 'id'|'date'>)
 * PUT    /organizations/:id      → { success: true, data: Organization }   (body: Omit<Organization, 'id'|'date'>)
 * DELETE /organizations/:id      → { success: true }
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

/* ═══════════════════════════════════════════════════════════
   Dashboard Component
   ═══════════════════════════════════════════════════════════ */

const OrganizationDirectoryDashboard: React.FC = () => {
  const ability = useAbility();
  const [records, setRecords] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  const fetchRecords = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiGetAll();
      setRecords(data);
    } catch {
      setRecords([]);
      setLoadError('Could not reach the server. Showing empty list — add a record or retry later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filtered = useMemo(() => {
    const nameFilter = searchName.trim().toLowerCase();
    const categoryFilter = searchCategory
      .trim()
      .toLowerCase()
      .replace(/^legacy-/, '');

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
    } catch (err: any) {
      setError(err?.message || err?.response?.data?.message || 'Failed to save record. Please try again.');
    }
  };

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
                <h5 className="budgetdashboard-title" style={{ paddingLeft: 0 }}>
                  Organization
                </h5>
              </div>

              <div className="budgetdashboard-header-right">
                <div
                  className="budgetdashboard-header-search-group"
                  style={{ display: 'flex', alignItems: 'center' }}
                >
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
                      <button
                        type="button"
                        aria-label="Clear organization search"
                        style={{
                          position: 'absolute',
                          right: '20px',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={() => setSearchName('')}
                      >
                        <X size={16} style={{ color: '#64748b' }} aria-hidden="true" />
                      </button>
                    ) : (
                      <Search
                        size={16}
                        style={{
                          position: 'absolute',
                          right: '20px',
                          color: '#94a3b8',
                          pointerEvents: 'none',
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

                {ability.can('create', 'MasterData') || ability.can('read', 'MasterData') ? (
                  <button type="button" className="org-add-btn" onClick={handleAdd}>
                    Add +
                  </button>
                ) : null}
              </div>
            </div>

            {loadError && (
              <div className="budgetdashboard-body" style={{ paddingTop: 0 }}>
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

            <div className="budgetdashboard-body">
              <div className="budgetdashboard-table-wrapper">
                <table className="budgetdashboard-table org-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center' }}>S.No.</th>
                      <th>Organization</th>
                      <th>Category</th>
                      <th>Tag</th>
                      <th>Status</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length > 0 ? (
                      filtered.map((org, index) => {
                        return (
                          <tr key={org.id}>
                            <td style={{ textAlign: 'center' }}>{index + 1}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: '#1f2937' }}>
                                  {org.name}
                                </span>
                                {org.city && (
                                  <span
                                    style={{
                                      fontSize: '0.78rem',
                                      color: '#64748b',
                                      marginTop: '2px',
                                    }}
                                  >
                                    {org.city}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>{org.category}</td>
                            <td>{org.tag && <span className="org-tag-pill">{org.tag}</span>}</td>
                            <td>
                              <span className={`org-status-pill ${org.approvalStatus === 'Approved' ? 'approved' : 'pending'}`}>
                                {org.approvalStatus || ((org as Organization & { is_active?: boolean }).is_active ? 'Approved' : 'Pending')}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {(ability.can('edit', 'MasterData') || ability.can('read', 'MasterData')) && (
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
                        <td colSpan={6} className="org-empty-state">
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
