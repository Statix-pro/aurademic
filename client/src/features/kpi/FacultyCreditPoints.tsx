import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomInput from '../../shared/components/ui/CustomInput';
import CustomModal from '../../shared/components/ui/CustomModal';
import CustomTable from '../../shared/components/ui/CustomTable';
import './FacultyCreditPoints.css';

const STORAGE_KEY = 'aurademic.kpi.primary-roles';

type RoleCategory = 'Academic' | 'Non-Academic';

interface PrimaryRoleRow {
  id: string;
  name: string;
  role: string;
  email: string;
  category: RoleCategory;
}

interface RoleForm {
  name: string;
  role: string;
  category: RoleCategory;
}

const createRoleId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `primary-role-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const readStoredRoles = (): PrimaryRoleRow[] => {
  try {
    const storedRoles = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(storedRoles) ? storedRoles : [];
  } catch {
    return [];
  }
};

const FacultyCreditPoints = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [primaryRoles, setPrimaryRoles] = useState<PrimaryRoleRow[]>(readStoredRoles);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<RoleForm>({
    name: '',
    role: '',
    category: 'Academic',
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(primaryRoles));
  }, [primaryRoles]);

  useEffect(() => {
    const savedRole = (location.state as { savedRole?: PrimaryRoleRow } | null)?.savedRole;
    if (savedRole) {
      setPrimaryRoles((current) => {
        const exists = current.some((item) => item.id === savedRole.id);
        return exists
          ? current.map((item) => (item.id === savedRole.id ? savedRole : item))
          : [...current, savedRole];
      });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const openAddModal = () => {
    setForm({ name: '', role: '', category: 'Academic' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const savePrimaryRole = () => {
    const name = form.name.trim();
    const role = form.role.trim();
    if (!name || !role) return;

    setPrimaryRoles((current) => [
      ...current,
      {
        id: createRoleId(),
        name,
        role,
        email: user?.email || '',
        category: form.category,
      },
    ]);
    closeModal();
  };

  const removePrimaryRole = (row: PrimaryRoleRow) => {
    if (window.confirm(`Delete primary role "${row.role}"?`)) {
      setPrimaryRoles((current) => current.filter((item) => item.id !== row.id));
    }
  };

  const openDetails = (row: PrimaryRoleRow, mode: 'edit' | 'view' = 'edit') => {
    navigate('/kpi/associated-roles', {
      state: {
        primaryRoleId: row.id,
        primaryRole: row.role,
        primaryRoleName: row.name,
        email: row.email,
        category: row.category,
        readOnly: mode === 'view',
      },
    });
  };

  const columns = [
    {
      key: 'serialNumber',
      label: 'S.No',
      render: (_row: PrimaryRoleRow, rowIndex: number) => rowIndex + 1,
      style: { width: '8%' },
    },
    { key: 'role', label: 'Role' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Mail ID' },
  ];

  return (
    <section className="faculty-credit-points-page" aria-labelledby="faculty-credit-points-title">
      <div className="faculty-credit-points-content">
        <div className="faculty-credit-points-panel">
          <header className="faculty-credit-points-header">
            <h1 id="faculty-credit-points-title">Faculty Credit Points</h1>
            <CustomButton
              variant="primary"
              className="faculty-credit-points-add-inline"
              onClick={openAddModal}
            >
              <Plus size={14} strokeWidth={3} aria-hidden="true" />
              Add Primary Role
            </CustomButton>
          </header>

          <div className="faculty-credit-points-table-wrap">
            <CustomTable
              columns={columns}
              data={primaryRoles}
              keyField="id"
              className="faculty-credit-points-table"
              emptyMessage="No primary roles configured."
              actions={(row: PrimaryRoleRow) => (
                <div className="faculty-credit-points-actions">
                  <CustomButton
                    variant="outline-primary"
                    className="faculty-credit-points-icon-button"
                    aria-label={`View ${row.role}`}
                    title={`View ${row.role}`}
                    onClick={() => openDetails(row, 'view')}
                  >
                    <Eye size={16} aria-hidden="true" />
                  </CustomButton>
                  <CustomButton
                    variant="outline-primary"
                    className="faculty-credit-points-icon-button"
                    aria-label={`Add associated role to ${row.role}`}
                    title={`Add associated role to ${row.role}`}
                    onClick={() => openDetails(row)}
                  >
                    <Plus size={16} aria-hidden="true" />
                  </CustomButton>
                  <CustomButton
                    variant="outline-secondary"
                    className="faculty-credit-points-icon-button"
                    aria-label={`Edit ${row.role}`}
                    title={`Edit ${row.role}`}
                    onClick={() => openDetails(row)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </CustomButton>
                  <CustomButton
                    variant="outline-danger"
                    className="faculty-credit-points-icon-button faculty-credit-points-delete"
                    aria-label={`Delete ${row.role}`}
                    title={`Delete ${row.role}`}
                    onClick={() => removePrimaryRole(row)}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </CustomButton>
                </div>
              )}
            />
          </div>
        </div>
      </div>

      <CustomModal show={isModalOpen} onHide={closeModal} title="Add Primary Role" size="sm">
        <div className="faculty-credit-points-form">
          <CustomInput
            name="primary-role-name"
            label="Name"
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            autoFocus
          />
          <CustomInput
            name="primary-role"
            label="Primary Role"
            value={form.role}
            onChange={(value) => setForm((current) => ({ ...current, role: value }))}
          />
          <fieldset className="faculty-credit-points-category">
            <legend>Category</legend>
            <div className="faculty-credit-points-category-actions">
              {(['Academic', 'Non-Academic'] as const).map((category) => (
                <button
                  key={category}
                  type="button"
                  className={form.category === category ? 'is-selected' : ''}
                  aria-pressed={form.category === category}
                  onClick={() => setForm((current) => ({ ...current, category }))}
                >
                  {category}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="faculty-credit-points-modal-actions">
            <CustomButton variant="secondary" onClick={closeModal}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              onClick={savePrimaryRole}
              disabled={!form.name.trim() || !form.role.trim()}
            >
              Save
            </CustomButton>
          </div>
        </div>
      </CustomModal>
    </section>
  );
};

export default FacultyCreditPoints;
