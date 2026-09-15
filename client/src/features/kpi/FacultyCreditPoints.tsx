import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import CustomButton from '../../shared/components/ui/CustomButton';
import CustomTable from '../../shared/components/ui/CustomTable';
import './FacultyCreditPoints.css';

interface CreditPointRow {
  serialNumber: number;
  role: string;
  il1: string;
  il2: string;
  dl1: string;
  dl2: string;
}

const FacultyCreditPoints = () => {
  const navigate = useNavigate();
  const handleAddAssociatedRole = () =>
    navigate('/kpi/associated-roles', { state: { resetForm: true } });

  const creditPointRows: CreditPointRow[] = [];
  const columns = [
    { key: 'serialNumber', label: 'S.No.' },
    { key: 'role', label: 'Prime Roles' },
    { key: 'il1', label: 'I-L1' },
    { key: 'il2', label: 'I-L2' },
    { key: 'dl1', label: 'D-L1' },
    { key: 'dl2', label: 'D-L2' },
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
              onClick={handleAddAssociatedRole}
            >
              <Plus size={14} strokeWidth={3} aria-hidden="true" />
              Add Prime Role
            </CustomButton>
          </header>

          <div className="faculty-credit-points-table-wrap">
            <CustomTable
              columns={columns}
              data={creditPointRows}
              keyField="serialNumber"
              className="faculty-credit-points-table"
              emptyMessage="No prime roles configured."
              actions={(row: CreditPointRow) => (
                <div className="faculty-credit-points-actions">
                  <CustomButton
                    variant="outline-primary"
                    className="faculty-credit-points-add"
                    aria-label={`Add credit points for ${row.role}`}
                    onClick={handleAddAssociatedRole}
                  >
                    <Plus size={14} strokeWidth={3} aria-hidden="true" />
                  </CustomButton>
                  <CustomButton
                    variant="outline-secondary"
                    className="faculty-credit-points-icon-button"
                    aria-label={`Edit ${row.role}`}
                    disabled
                    title="Editing is unavailable until KPI persistence is implemented"
                  >
                    <Pencil size={17} strokeWidth={2} aria-hidden="true" />
                  </CustomButton>
                  <CustomButton
                    variant="outline-danger"
                    className="faculty-credit-points-icon-button faculty-credit-points-delete"
                    aria-label={`Delete ${row.role}`}
                    disabled
                    title="Deleting is unavailable until KPI persistence is implemented"
                  >
                    <Trash2 size={18} strokeWidth={2.5} aria-hidden="true" />
                  </CustomButton>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default FacultyCreditPoints;
