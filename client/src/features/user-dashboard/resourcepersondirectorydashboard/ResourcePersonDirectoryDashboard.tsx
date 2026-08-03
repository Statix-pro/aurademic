import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, Edit3 } from 'lucide-react';
import './ResourcePersonDirectoryDashboard.css';
import '../financecard/financecard.css';
import ResourcePersonDirectory, { ResourcePerson } from '../../resourcepersondirectory/ResourcePersonDirectory';
import authenticityUtility, { isFallbackEligible } from '../../../shared/utils/authenticityUtility';

/* ─── API Contract (backend must implement) ────────────────────────────────
 * GET    /resource-persons          → { success: true, data: ResourcePerson[] }
 * POST   /resource-persons          → { success: true, data: ResourcePerson }   (body: Omit<ResourcePerson, 'id'|'date'>)
 * PUT    /resource-persons/:id      → { success: true, data: ResourcePerson }   (body: Omit<ResourcePerson, 'id'|'date'>)
 * DELETE /resource-persons/:id      → { success: true }
 * ──────────────────────────────────────────────────────────────────────────── */

/* ─── TEMPORARY localStorage fallback ──────────────────────────────────────
 * LEGACY: _v1 key ('resourcePersonDirectoryRecords_v1') is orphaned.
 * It will be discarded once the backend is live — no migration needed.
 * TEMPORARY: The _v2 key below is used as a fallback while the backend is absent.
 * Remove the entire FALLBACK block (and STORAGE_KEY) once the API is live.
 * ──────────────────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'resourcePersonDirectoryRecords';

const fallbackGetAll = (): ResourcePerson[] => {
  // FALLBACK: remove once backend is live
  console.warn('[ResourcePerson] API unavailable — reading from localStorage fallback');
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ResourcePerson[]) : [];
  } catch {
    return [];
  }
};

const fallbackSave = (records: ResourcePerson[]) => {
  // FALLBACK: remove once backend is live
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
};

/* ─── API functions (call real backend; fall back to localStorage on failure) */

const apiGetAll = async (): Promise<ResourcePerson[]> => {
  try {
    const res = (await authenticityUtility.get('/resource-persons')) as any;
    if (res?.success && Array.isArray(res.data)) return res.data;
    throw new Error(res?.message || 'Invalid response');
  } catch (err: any) {
    if (isFallbackEligible(err)) return fallbackGetAll();
    throw err;
  }
};

const apiCreate = async (personData: Omit<ResourcePerson, 'id' | 'date'>): Promise<ResourcePerson> => {
  try {
    const res = (await authenticityUtility.post('/resource-persons', personData)) as any;
    if (res?.success && res.data) return res.data;
    throw new Error(res?.message || 'Invalid response');
  } catch (err: any) {
    if (!isFallbackEligible(err)) throw err;
    // FALLBACK: remove once backend is live
    console.warn('[ResourcePerson] API unavailable — writing to localStorage fallback');
    const existing = fallbackGetAll();
    const newRecord: ResourcePerson = {
      id: Math.max(0, ...existing.map((r) => r.id)) + 1,
      date: new Date().toISOString().slice(0, 10),
      ...personData,
    };
    fallbackSave([newRecord, ...existing]);
    return newRecord;
  }
};

const apiUpdate = async (id: number, personData: Omit<ResourcePerson, 'id' | 'date'>): Promise<ResourcePerson> => {
  try {
    const res = (await authenticityUtility.put(`/resource-persons/${id}`, personData)) as any;
    if (res?.success && res.data) return res.data;
    throw new Error(res?.message || 'Invalid response');
  } catch (err: any) {
    if (!isFallbackEligible(err)) throw err;
    // FALLBACK: remove once backend is live
    console.warn('[ResourcePerson] API unavailable — writing to localStorage fallback');
    const existing = fallbackGetAll();
    const updated = existing.map((r) => (r.id === id ? { ...r, ...personData } : r));
    fallbackSave(updated);
    const found = updated.find((r) => r.id === id);
    if (!found) throw new Error('Record not found');
    return found;
  }
};

/* ─── Constants ─────────────────────────────────────────────────────────── */

const CATEGORY_OPTIONS = [
  'Academic',
  'Industry',
  'Scientist',
  'Administration',
  'Incubation',
  'Government',
  'Entrepreneur',
  'Alumni',
  'Social Activist',
];

const getPrimary = (p: ResourcePerson) => {
  if (!p.professions?.length) return null;
  // LEGACY: some older records use 'Current' instead of 'Working'; fall back to it
  // here for backward compatibility. Remove once all persisted records are migrated
  // to the 'Working'/'Relieved' status vocabulary.
  return (
    p.professions.find((x) => x.status === 'Working') ||
    p.professions.find((x) => x.status === 'Current') ||
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

  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<ResourcePerson | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  const fetchRecords = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGetAll();
      setRecords(data);
    } catch {
      setError('Failed to load resource persons. Please try again.');
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
        (!nameFilter || record.name.toLowerCase().includes(nameFilter)) &&
        (!categoryFilter || record.category.toLowerCase().includes(categoryFilter)),
    );
  }, [records, searchName, searchCategory]);

  const handleAdd = () => {
    setEditingPerson(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingPerson(null);
    setShowForm(false);
  };

  const handleEdit = (person: ResourcePerson) => {
    setEditingPerson(person);
    setShowForm(true);
  };

  const handleSave = async (personData: Omit<ResourcePerson, 'id' | 'date'>) => {
    try {
      if (editingPerson) {
        const updated = await apiUpdate(editingPerson.id, personData);
        setRecords((prev) => prev.map((r) => (r.id === editingPerson.id ? updated : r)));
      } else {
        const created = await apiCreate(personData);
        setRecords((prev) => [created, ...prev]);
      }
    } catch {
      setError('Failed to save record. Please try again.');
    }
    setEditingPerson(null);
    setShowForm(false);
  };

  /* ── Render ── */

  if (isLoading) {
    return (
      <div className="financecard-page d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !showForm) {
    return (
      <div className="financecard-page d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="alert alert-danger" role="alert">
          {error}{' '}
          <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={fetchRecords}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="financecard-page">
      <div className="financecard-container">
        {showForm ? (
          <div className="rpd-form-wrapper">
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

                <button
                  type="button"
                  className="financecard-add-btn"
                  onClick={handleAdd}
                >
                  <Plus size={15} /> Add
                </button>
              </div>
            </div>

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
                    <th className="rpd-center">Profile</th>
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
                                  backgroundColor: person.status === 'In Service' ? '#137a3a' : '#a97900',
                                }}
                                title={person.status}
                              />
                              <span>{index + 1}</span>
                            </div>
                          </td>
                          <td>
                            <div className="rpd-name-cell">
                              <strong>{person.name}</strong>
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
                          
                          <td className="rpd-center">-</td>
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
                          ? 'No records yet. Click "Add +" to add a resource person.'
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
