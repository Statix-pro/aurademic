import React, { useMemo, useState } from 'react';
import { Search, Plus, X, Edit3 } from 'lucide-react';
import './OrganizationDirectoryDashboard.css';
import OrganizationDirectory, { Organization } from '../../organizationdirectory/OrganizationDirectory';

const STORAGE_KEY = 'organizationDirectoryRecords_v2';

const CATEGORY_OPTIONS = [
  'Academic', 'Industry', 'National Labs', 'Incubation', 'Start-up', 'Government'
];

const OrganizationDirectoryDashboard: React.FC = () => {
  const [records, setRecords] = useState<Organization[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Organization[]) : [];
    } catch {
      return [];
    }
  });
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  const filtered = useMemo(() => {
    const nameFilter = searchName.trim().toLowerCase();
    const categoryFilter = searchCategory.trim().toLowerCase();

    return records.filter(
      (record) =>
        (!nameFilter || record.name.toLowerCase().includes(nameFilter) || record.abbreviation.toLowerCase().includes(nameFilter) || (record.city && record.city.toLowerCase().includes(nameFilter))) &&
        (!categoryFilter || record.category.toLowerCase() === categoryFilter),
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

  const handleSave = (orgData: Omit<Organization, 'id' | 'date'>) => {
    setRecords((prev) => {
      let updatedRecords: Organization[];
      if (editingOrg) {
        // Edit Mode: update existing record
        updatedRecords = prev.map((r) =>
          r.id === editingOrg.id ? { ...r, ...orgData } : r
        );
      } else {
        // Add Mode: insert new record
        const newRecord = {
          id: Math.max(0, ...prev.map((record) => record.id)) + 1,
          date: new Date().toISOString().slice(0, 10),
          ...orgData,
        } as Organization;
        updatedRecords = [newRecord, ...prev];
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
      } catch {
        // ignore localStorage errors
      }

      return updatedRecords;
    });

    setEditingOrg(null);
    setShowForm(false);
  };

  return (
    <section className="budgetdashboard-page">
      <div className="budgetdashboard-container">
        {showForm ? (
          <div className="rpd-form-wrapper">
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
                      <option key={cat} value={cat.toLowerCase()}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="budgetdashboard-add-btn"
                  onClick={handleAdd}
                >
                  Add +
                </button>
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
                              <button
                                type="button"
                                className="org-action-edit-btn"
                                onClick={() => handleEdit(org)}
                                title="Edit Organization"
                              >
                                <Edit3 size={15} />
                              </button>
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
