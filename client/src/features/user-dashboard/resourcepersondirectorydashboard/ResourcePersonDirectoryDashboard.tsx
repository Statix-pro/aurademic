import React, { useMemo, useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import './ResourcePersonDirectoryDashboard.css';
import '../financecard/financecard.css';
import ResourcePersonDirectory, { ResourcePerson } from '../../resourcepersondirectory/ResourcePersonDirectory';

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

const STORAGE_KEY = 'resourcePersonDirectoryRecords';

const ResourcePersonDirectoryDashboard: React.FC = () => {
  const [records, setRecords] = useState<ResourcePerson[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as ResourcePerson[]) : [];
    } catch {
      return [];
    }
  });
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<ResourcePerson | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

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

  // Editing is disabled for Add-only mode; keep function removed intentionally.

  const handleCancel = () => {
    setEditingPerson(null);
    setShowForm(false);
  };

  const handleSave = (personData: Omit<ResourcePerson, 'id' | 'date'>) => {
    setRecords((prev) => {
      const newRecord = {
        id: Math.max(0, ...prev.map((record) => record.id)) + 1,
        date: new Date().toISOString().slice(0, 10),
        ...personData,
      } as ResourcePerson;

      const updatedRecords = [newRecord, ...prev];

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
      } catch {
        // ignore localStorage errors
      }

      return updatedRecords;
    });

    // Ensure form closes after adding
    setEditingPerson(null);
    setShowForm(false);
  };

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
                          <td className="rpd-center">-</td>
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
