import { Trash2, Eye, Plus, CloudUpload } from 'lucide-react';
import React, { useState } from 'react';
import '../styles/EventForm.css';
import { v4 as uuidv4 } from 'uuid';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { FINANCE_INCOME_HEADS, FINANCE_BUDGET_HEADS, FINANCE_INITIAL_DOCS } from '../constants';

// Type definitions
interface IncomeRow {
  id: string;
  incomeHead: string;
  incomeHeadOther?: string;
  agency: string;
  income: string;
}

interface ExpenditureRow {
  id: string;
  budgetHead: string;
  budgetHeadOther?: string;
  amountProposed: string;
  actualExpenditure: string;
  file?: File | null;
}

interface BudgetRow {
  id: string;
  head: string;
  amount: string;
}

interface FinanceDoc {
  active: boolean;
  file: File | null;
}

interface FinanceDocs {
  [key: string]: FinanceDoc;
}

interface SanctionDetails {
  orderNo: string;
  amount: string;
  date: string;
}

interface DocState {
  name: string;
  enabled: boolean;
  file: File | null;
}

interface Agency {
  id: string;
  agency: string;
  sanctionDetails: SanctionDetails;
  docStates: DocState[];
}

interface FinanceSectionProps {
  incomeRows: IncomeRow[];
  setIncomeRows: React.Dispatch<React.SetStateAction<IncomeRow[]>>;
  expenditureRows: ExpenditureRow[];
  setExpenditureRows: React.Dispatch<React.SetStateAction<ExpenditureRow[]>>;
  financeDocs: FinanceDocs;
  setFinanceDocs: React.Dispatch<React.SetStateAction<FinanceDocs>>;
  budgetRows: BudgetRow[];
  setBudgetRows: React.Dispatch<React.SetStateAction<BudgetRow[]>>;
}

interface SponsoringAgencySectionProps {
  goToTab: (tab: string) => void;
  eventId?: string;
}

// ---------------- Finance Section ----------------
const FinanceSection: React.FC<FinanceSectionProps> = ({
  incomeRows,
  setIncomeRows,
  expenditureRows,
  setExpenditureRows,
  financeDocs,
  setFinanceDocs,
  budgetRows,
  setBudgetRows,
}) => {
  // Add/Delete Income
  const addIncomeRow = (): void => {
    setIncomeRows([...incomeRows, { id: uuidv4(), incomeHead: '', agency: '', income: '' }]);
  };

  const deleteIncomeRow = (id: string): void => {
    if (incomeRows.length === 1) return; // prevent deleting last row
    setIncomeRows(incomeRows.filter((row) => row.id !== id));
  };

  // Add/Delete Expenditure
  const addExpenditureRow = (): void => {
    setExpenditureRows([
      ...expenditureRows,
      {
        id: uuidv4(),
        budgetHead: '',
        amountProposed: '',
        actualExpenditure: '',
      },
    ]);
  };

  const deleteExpenditureRow = (id: string): void => {
    if (expenditureRows.length === 1) return; // prevent deleting last row
    setExpenditureRows(expenditureRows.filter((row) => row.id !== id));
  };

  // Add/Delete Budget
  const addBudgetRow = (): void => {
    setBudgetRows([...budgetRows, { id: uuidv4(), head: '', amount: '' }]);
  };

  const deleteBudgetRow = (id: string): void => {
    if (budgetRows.length === 1) return; // prevent deleting last row
    setBudgetRows(budgetRows.filter((row) => row.id !== id));
  };

  // Totals
  const totalIncome: number = incomeRows.reduce(
    (sum, row) => sum + (parseFloat(row.income) || 0),
    0,
  );
  const totalExpenditure: number = expenditureRows.reduce(
    (sum, row) => sum + (parseFloat(row.actualExpenditure) || 0),
    0,
  );

  const handleViewFile = (file: File | null): void => {
    if (file) {
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    }
  };

  return (
    <div className="event-finance-wrapper">
      {/* Income Section */}
      <div className="event-finance-card">
        <div className="event-card-header">
          <h3 style={{ fontSize: '20px' }}>Income</h3>
        </div>
        <table className="event-finance-table">
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Income Head</th>
              <th>Agency</th>
              <th>Income</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {incomeRows.map((row, index) => {
              const isLastRow = index === incomeRows.length - 1;

              return (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    {row.incomeHead !== 'Others' ? (
                      <select
                        value={row.incomeHead}
                        onChange={(e) =>
                          setIncomeRows(
                            incomeRows.map((r) =>
                              r.id === row.id
                                ? {
                                    ...r,
                                    incomeHead: e.target.value,
                                    incomeHeadOther: '', // clear the other input
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        <option value="">-- Select --</option>
                        {FINANCE_INCOME_HEADS.map(head => (
                          <option key={head} value={head}>{head}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={row.incomeHeadOther || ''}
                        placeholder="Enter other"
                        onChange={(e) =>
                          setIncomeRows(
                            incomeRows.map((r) =>
                              r.id === row.id
                                ? {
                                    ...r,
                                    incomeHeadOther: e.target.value,
                                    incomeHead: e.target.value === '' ? '' : 'Others', // switch back if cleared
                                  }
                                : r,
                            ),
                          )
                        }
                        autoFocus
                      />
                    )}
                  </td>

                  <td>
                    <input
                      type="text"
                      value={row.agency}
                      onChange={(e) =>
                        setIncomeRows(
                          incomeRows.map((r) =>
                            r.id === row.id ? { ...r, agency: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.income}
                      onChange={(e) =>
                        setIncomeRows(
                          incomeRows.map((r) =>
                            r.id === row.id ? { ...r, income: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="event-actions-cell">
                    <div className="event-action-icons">
                      {index === 0 && incomeRows.length === 1 ? (
                        // First row → Only Add
                        <button
                          type="button"
                          className="event-add"
                          onClick={addIncomeRow}
                          title="Add"
                        >
                          <Plus size={16} />
                        </button>
                      ) : isLastRow ? (
                        // Last row → Delete + Add
                        <>
                          <button
                            type="button"
                            className="event-icon-btn"
                            onClick={() => deleteIncomeRow(row.id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="event-add"
                            onClick={addIncomeRow}
                            title="Add"
                          >
                            <Plus size={16} />
                          </button>
                        </>
                      ) : (
                        // Middle rows → Only Delete
                        <button
                          type="button"
                          className="event-icon-btn text-red-500"
                          onClick={() => deleteIncomeRow(row.id)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Total row */}
            <tr className="event-total-row">
              <td colSpan={3} style={{ textAlign: 'right', fontWeight: '600' }}>
                Total Income:
              </td>
              <td colSpan={2} style={{ fontWeight: '600' }}>
                {totalIncome}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Expenditure Section */}
      <div className="event-finance-card">
        <div className="event-card-header">
          <h3 style={{ fontSize: '20px' }}>Expenditure</h3>
        </div>
        <table className="event-finance-table">
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Budget Head</th>
              <th>Amount Proposed</th>
              <th>Actual Expenditure</th>
              <th>Upload Document</th> {/* New column header */}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenditureRows.map((row, index) => {
              const isLastRow = index === expenditureRows.length - 1;

              return (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    {row.budgetHead !== 'Others' ? (
                      <select
                        value={row.budgetHead}
                        onChange={(e) =>
                          setExpenditureRows(
                            expenditureRows.map((r) =>
                              r.id === row.id
                                ? {
                                    ...r,
                                    budgetHead: e.target.value,
                                    budgetHeadOther: '',
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        <option value="">-- Select --</option>
                        {FINANCE_BUDGET_HEADS.map(head => (
                          <option key={head} value={head}>{head}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={row.budgetHeadOther || ''}
                        placeholder="Enter other"
                        onChange={(e) =>
                          setExpenditureRows(
                            expenditureRows.map((r) =>
                              r.id === row.id
                                ? {
                                    ...r,
                                    budgetHeadOther: e.target.value,
                                    budgetHead: e.target.value.trim() ? 'Others' : '',
                                  }
                                : r,
                            ),
                          )
                        }
                        autoFocus
                      />
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.amountProposed}
                      onChange={(e) =>
                        setExpenditureRows(
                          expenditureRows.map((r) =>
                            r.id === row.id ? { ...r, amountProposed: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.actualExpenditure}
                      onChange={(e) =>
                        setExpenditureRows(
                          expenditureRows.map((r) =>
                            r.id === row.id ? { ...r, actualExpenditure: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </td>

                  {/* Upload Document Column */}
                  <td style={{ verticalAlign: 'middle', padding: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        justifyContent: 'center',
                        height: '100%',
                      }}
                    >
                      <label
                        className="event-upload-icon"
                        title="Upload document"
                        style={{ cursor: 'pointer' }}
                      >
                        <CloudUpload size={18} />
                        <input
                          type="file"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setExpenditureRows((prevRows) =>
                              prevRows.map((r) => (r.id === row.id ? { ...r, file } : r)),
                            );
                          }}
                          accept=".pdf,.doc,.docx,.jpg,.png"
                        />
                      </label>
                      <span
                        className={`event-eye-icon ${!row.file ? 'disabled' : ''}`}
                        onClick={() => {
                          if (row.file) window.open(URL.createObjectURL(row.file), '_blank');
                        }}
                        title={row.file ? 'View uploaded document' : 'No document uploaded'}
                        style={{
                          cursor: row.file ? 'pointer' : 'default',
                          color: row.file ? '#3182ce' : '#ccc',
                          display: 'flex',
                          alignItems: 'center',
                          height: '100%',
                        }}
                      >
                        <Eye size={18} />
                      </span>
                    </div>
                  </td>

                  <td className="event-actions-cell">
                    <div className="event-action-icons">
                      {index === 0 && expenditureRows.length === 1 ? (
                        <button
                          type="button"
                          className="event-add"
                          onClick={addExpenditureRow}
                          title="Add"
                        >
                          <Plus size={16} />
                        </button>
                      ) : isLastRow ? (
                        <>
                          <button
                            type="button"
                            className="event-icon-btn "
                            onClick={() => deleteExpenditureRow(row.id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="event-add"
                            onClick={addExpenditureRow}
                            title="Add"
                          >
                            <Plus size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="event-icon-btn "
                          onClick={() => deleteExpenditureRow(row.id)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Total row */}
            <tr className="event-total-row">
              <td colSpan={4} style={{ textAlign: 'right', fontWeight: '600' }}>
                Total Expenditure:
              </td>
              <td colSpan={2} style={{ fontWeight: '600' }}>
                {totalExpenditure}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="event-docs-grid">
          {Object.keys(financeDocs)
            .filter((doc) => doc !== 'Bill Copies') // exclude Bill Copies
            .map((doc) => {
              const { active, file } = financeDocs[doc];
              return (
                <div className="event-doc-row" key={doc}>
                  <span className="event-doc-label">{doc}</span>
                  <label className="event-switch">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() =>
                        setFinanceDocs((prev) => ({
                          ...prev,
                          [doc]: { ...prev[doc], active: !active },
                        }))
                      }
                    />
                    <span className="event-slider"></span>
                  </label>
                  <label className={`event-upload-icon ${!active ? 'disabled' : ''}`}>
                    <CloudUpload size={18} />
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      disabled={!active}
                      onChange={(e) =>
                        setFinanceDocs((prev) => ({
                          ...prev,
                          [doc]: {
                            ...prev[doc],
                            file: e.target.files?.[0] || null,
                          },
                        }))
                      }
                    />
                  </label>
                  <span
                    className={`event-eye-icon ${!file ? 'disabled' : ''}`}
                    onClick={() => file && handleViewFile(file)}
                  >
                    <Eye size={18} />
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

// ---------------- Sponsoring Agency Section ----------------
const SponsoringAgencySection: React.FC<SponsoringAgencySectionProps> = ({ goToTab, eventId }) => {
  const [enabled, setEnabled] = useState<boolean>(true);

  const initialDocStates: DocState[] = FINANCE_INITIAL_DOCS.map(name => ({
    name,
    enabled: false,
    file: null,
  }));

  const [agencies, setAgencies] = useState<Agency[]>([
    {
      id: uuidv4(),
      agency: '',
      sanctionDetails: { orderNo: '', amount: '', date: '' },
      docStates: initialDocStates,
    },
  ]);

  // Finance section states
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([
    { id: uuidv4(), incomeHead: '', agency: '', income: '' },
  ]);
  const [expenditureRows, setExpenditureRows] = useState<ExpenditureRow[]>([
    { id: uuidv4(), budgetHead: '', amountProposed: '', actualExpenditure: '' },
  ]);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([
    { id: uuidv4(), head: '', amount: '' },
  ]);
  const [financeDocs, setFinanceDocs] = useState<FinanceDocs>({
    'Finance Approval Documents': { active: true, file: null },
    'Bill Copies': { active: false, file: null },
  });

  const addAgency = (): void => {
    setAgencies([
      ...agencies,
      {
        id: uuidv4(),
        agency: '',
        sanctionDetails: { orderNo: '', amount: '', date: '' },
        docStates: initialDocStates,
      },
    ]);
  };

  const deleteAgency = (id: string): void => {
    if (agencies.length === 1) return;
    setAgencies(agencies.filter((a) => a.id !== id));
  };

  const handleAgencyChange = (id: string, value: string): void => {
    setAgencies(agencies.map((a) => (a.id === id ? { ...a, agency: value } : a)));
  };

  const handleSanctionChange = (id: string, field: keyof SanctionDetails, value: string): void => {
    setAgencies(
      agencies.map((a) =>
        a.id === id
          ? {
              ...a,
              sanctionDetails: { ...a.sanctionDetails, [field]: value },
            }
          : a,
      ),
    );
  };

  const handleToggleDoc = (agencyId: string, index: number): void => {
    setAgencies(
      agencies.map((a) =>
        a.id === agencyId
          ? {
              ...a,
              docStates: a.docStates.map((doc, i) =>
                i === index ? { ...doc, enabled: !doc.enabled, file: null } : doc,
              ),
            }
          : a,
      ),
    );
  };

  const handleFileChange = (agencyId: string, index: number, file: File | null): void => {
    setAgencies(
      agencies.map((a) =>
        a.id === agencyId
          ? {
              ...a,
              docStates: a.docStates.map((doc, i) => (i === index ? { ...doc, file } : doc)),
            }
          : a,
      ),
    );
  };

  const viewFile = (file: File | null): void => {
    if (file) {
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    }
  };

  const handleSubmitToBackend = async (): Promise<void> => {
    // console.log("🔴 Finance Submit button clicked!");

    // Prepare finance data
    const financeData = {
      event_id: eventId ? parseInt(eventId) : 1,
      income: incomeRows
        .filter((row) => row.incomeHead && row.agency && row.income)
        .map((row) => ({
          source: row.incomeHead,
          amount: parseFloat(row.income) || 0,
          agency: row.agency,
        })),
      expenditure: expenditureRows
        .filter((row) => row.budgetHead && row.actualExpenditure)
        .map((row) => ({
          category: row.budgetHead,
          amount: parseFloat(row.actualExpenditure) || 0,
          proposed_amount: parseFloat(row.amountProposed) || 0,
        })),
      sponsoring_agencies: enabled
        ? agencies
            .filter((agency) => agency.agency)
            .map((agency) => ({
              agency_name: agency.agency,
              order_no: agency.sanctionDetails.orderNo,
              amount: parseFloat(agency.sanctionDetails.amount) || null,
              date: agency.sanctionDetails.date,
            }))
        : [],
      supporting_docs: Object.keys(financeDocs)
        .filter((doc) => financeDocs[doc].active && financeDocs[doc].file)
        .map((doc) => ({
          filename: financeDocs[doc].file!.name,
          original_name: financeDocs[doc].file!.name,
          mime: financeDocs[doc].file!.type,
          size: financeDocs[doc].file!.size,
        })),
      budget: budgetRows
        .filter((row) => row.head && row.amount)
        .map((row) => ({
          head: row.head,
          amount: parseFloat(row.amount) || 0,
        })),
    };

    // console.log("🔴 Prepared finance data:", financeData);

    try {
      const response = await authenticityUtility.post('/finance', financeData);
      // console.log("🟢 Finance backend response:", response);
      alert('✅ Finance data submitted successfully!');
      goToTab('updates');
    } catch (error: any) {
      console.error('🔴 Finance frontend error:', error);
      console.error('🔴 Error response:', error.response?.data);
      alert(`❌ Failed to submit finance data: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div className="event-sponsor-section">
      {(enabled ? agencies : [agencies[0]]).map((agency, index) => {
        const isLastRow = index === agencies.length - 1;
        return (
          <div key={agency.id} className="event-agency-card">
            {/* Card Header with Sponsoring Agency title + toggle */}
            {/* Render title/toggle only for the very first card */}
            {index === 0 && (
              <div className="event-card-header">
                <h3 className="event-section-title">Sponsoring Agency</h3>
                <label className="event-toggle-switch">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => {
                      setEnabled(!enabled);
                      if (enabled) {
                        setAgencies([
                          {
                            id: uuidv4(),
                            agency: '',
                            sanctionDetails: {
                              orderNo: '',
                              amount: '',
                              date: '',
                            },
                            docStates: initialDocStates,
                          },
                        ]);
                      }
                    }}
                  />
                  <span className="event-slider"></span>
                </label>
              </div>
            )}

            {/* Render Table + Sanction Details only if enabled */}
            {enabled && (
              <>
                {/* Name of Funding Agency Table */}
                <table className="event-sponsor-table">
                  <thead>
                    <tr>
                      <th>S.No.</th>
                      <th>Name of the Funding Agency</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{index + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="event-input-field"
                          placeholder="Enter Agency Name"
                          value={agency.agency}
                          onChange={(e) => handleAgencyChange(agency.id, e.target.value)}
                          disabled={!enabled}
                        />
                      </td>
                      <td className="event-row-actions text-center align-middle">
                        <div className="event-flex items-center justify-center gap-2">
                          {index === 0 && agencies.length === 1 ? (
                            <button
                              type="button"
                              className="event-add"
                              onClick={addAgency}
                              title="Add"
                              disabled={!enabled}
                            >
                              <Plus size={16} />
                            </button>
                          ) : isLastRow ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="event-icon-btn"
                                onClick={() => deleteAgency(agency.id)}
                                title="Delete"
                                disabled={!enabled}
                              >
                                <Trash2 size={16} />
                              </button>
                              <button
                                type="button"
                                className="event-add"
                                onClick={addAgency}
                                title="Add"
                                disabled={!enabled}
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="event-icon-btn"
                              onClick={() => deleteAgency(agency.id)}
                              title="Delete"
                              disabled={!enabled}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Sanction Order Details */}
                <div className="event-sanction-card enabled">
                  <div className="event-sanction-header">
                    <h4 style={{ fontSize: '20px' }}>Sanction Order Details</h4>
                  </div>

                  <div className="event-form-row event-inline-fields">
                    <input
                      type="text"
                      className="event-input-field"
                      placeholder="Order No."
                      value={agency.sanctionDetails.orderNo}
                      onChange={(e) => handleSanctionChange(agency.id, 'orderNo', e.target.value)}
                    />
                    <input
                      type="number"
                      className="event-input-field"
                      placeholder="Amount"
                      value={agency.sanctionDetails.amount}
                      onChange={(e) => handleSanctionChange(agency.id, 'amount', e.target.value)}
                    />
                    <input
                      type="date"
                      className="event-input-field"
                      value={agency.sanctionDetails.date}
                      onChange={(e) => handleSanctionChange(agency.id, 'date', e.target.value)}
                    />
                  </div>

                  {/* Supporting Docs */}
                  <div className="event-docs-grid">
                    {agency.docStates.map((doc, i) => (
                      <div className="event-doc-row event-compact-doc-row" key={i}>
                        <span className="event-doc-label">{doc.name}</span>
                        <label className="event-switch">
                          <input
                            type="checkbox"
                            checked={doc.enabled}
                            onChange={() => handleToggleDoc(agency.id, i)}
                          />
                          <span className="event-slider"></span>
                        </label>
                        <label
                          className={`event-upload-icon ${!doc.enabled ? 'disabled' : ''}`}
                          onClick={() =>
                            doc.enabled &&
                            document.getElementById(`file-upload-${agency.id}-${i}`)?.click()
                          }
                        >
                          <CloudUpload size={18} />
                          <input
                            type="file"
                            onChange={(e) =>
                              handleFileChange(agency.id, i, e.target.files?.[0] || null)
                            }
                            style={{ display: 'none' }}
                            disabled={!doc.enabled}
                            id={`file-upload-${agency.id}-${i}`}
                          />
                        </label>
                        <span
                          className={`event-eye-icon ${!doc.file ? 'disabled' : ''}`}
                          onClick={() => doc.file && viewFile(doc.file)}
                        >
                          <Eye size={18} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Finance Section - always visible */}
      <div>
        <FinanceSection
          incomeRows={incomeRows}
          setIncomeRows={setIncomeRows}
          expenditureRows={expenditureRows}
          setExpenditureRows={setExpenditureRows}
          financeDocs={financeDocs}
          setFinanceDocs={setFinanceDocs}
          budgetRows={budgetRows}
          setBudgetRows={setBudgetRows}
        />
      </div>

      {/* Navigation */}
      <div className="event-section-navigation">
        <button type="button" className="event-prev-btn" onClick={() => goToTab('pre-event')}>
          ← Previous
        </button>
        <button type="button" className="event-save-next-btn" onClick={handleSubmitToBackend}>
          Save & Next →
        </button>
      </div>
    </div>
  );
};

// Export SponsoringAgencySection as FinanceSection to match EventPage's import
// Export as FinanceSection to match EventPage's import expectation
export default SponsoringAgencySection as React.ComponentType<SponsoringAgencySectionProps>;
export { SponsoringAgencySection };
