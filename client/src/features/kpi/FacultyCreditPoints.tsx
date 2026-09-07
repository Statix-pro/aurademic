import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import './FacultyCreditPoints.css';

const FacultyCreditPoints = () => {
  const navigate = useNavigate();
  const handlePlaceholder = () => undefined;
  const handleAddAssociatedRole = () =>
    navigate('/kpi/associated-roles', { state: { resetForm: true } });

  const creditPointRows: Array<{
    serialNumber: number;
    role: string;
    il1: string;
    il2: string;
    dl1: string;
    dl2: string;
  }> = [];

  return (
    <section className="faculty-credit-points-page" aria-labelledby="faculty-credit-points-title">
      <div className="faculty-credit-points-content">
        <div className="faculty-credit-points-panel">
          <header className="faculty-credit-points-header">
            <h1 id="faculty-credit-points-title">Faculty Credit Points</h1>
          </header>

          <div className="faculty-credit-points-table-wrap">
            <table className="faculty-credit-points-table">
              <colgroup>
                <col className="faculty-credit-points-serial-column" />
                <col className="faculty-credit-points-role-column" />
                <col className="faculty-credit-points-score-column" />
                <col className="faculty-credit-points-score-column" />
                <col className="faculty-credit-points-score-column" />
                <col className="faculty-credit-points-score-column" />
                <col className="faculty-credit-points-action-column" />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2} scope="col">
                    S.No.
                  </th>
                  <th rowSpan={2} scope="col" className="faculty-credit-points-role-heading">
                    Prime Roles
                  </th>
                  <th colSpan={4} scope="colgroup">
                    Credit Points
                  </th>
                  <th rowSpan={2} scope="col">
                    Action
                  </th>
                </tr>
                <tr>
                  <th scope="col">I-L1</th>
                  <th scope="col">I-L2</th>
                  <th scope="col">D-L1</th>
                  <th scope="col">D-L2</th>
                </tr>
              </thead>
              <tbody>
                {creditPointRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="faculty-credit-points-empty-row">
                      <div className="faculty-credit-points-empty-content">
                        <button
                          type="button"
                          className="faculty-credit-points-add-inline"
                          onClick={handleAddAssociatedRole}
                        >
                          <Plus size={14} strokeWidth={3} />
                          Add Prime Role
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  creditPointRows.map((row) => (
                    <tr key={row.serialNumber}>
                      <td>{row.serialNumber}</td>
                      <td className="faculty-credit-points-role">{row.role}</td>
                      <td>{row.il1}</td>
                      <td>{row.il2}</td>
                      <td>{row.dl1}</td>
                      <td>{row.dl2}</td>
                      <td>
                        <div className="faculty-credit-points-actions">
                          <button
                            type="button"
                            className="faculty-credit-points-add"
                            aria-label={`Add credit points for ${row.role}`}
                            onClick={handleAddAssociatedRole}
                          >
                            <Plus size={14} strokeWidth={3} />
                          </button>
                          <button
                            type="button"
                            className="faculty-credit-points-icon-button"
                            aria-label={`Edit ${row.role}`}
                            onClick={handlePlaceholder}
                          >
                            <Pencil size={17} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="faculty-credit-points-icon-button faculty-credit-points-delete"
                            aria-label={`Delete ${row.role}`}
                            onClick={handlePlaceholder}
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FacultyCreditPoints;
