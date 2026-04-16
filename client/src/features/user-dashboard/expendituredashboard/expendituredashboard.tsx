// client/src/features/user-dashboard/expendituredashboard/expendituredashboard.tsx
import React, { useEffect, useState, useMemo } from 'react';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import './expendituredashboard.css';
import { Eye, Edit2, Trash2, ChevronDown, Package, FolderOpen, Plus, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface ExpenditureItem {
  id: number;
  finance_id?: number;
  proposal_ref?: string;
  applicant_name: string;
  beneficiary_type: string;
  primary_head: string;
  amount: number;
  overall_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

type DemoModule = 'Advance' | 'Settlement' | 'Expenditure';

interface DemoRow {
  id: string;
  primaryChoice: DemoModule | null;
  advanceCount: number;
  advanceAmount: number;
  expenditureAmount: number;
  settlementAmount: number;
  approvalLevel: number;
}

interface DashboardReturnState {
  dashboardRowId?: string;
  submittedModule?: DemoModule;
  submittedAmount?: number;
  financeProposal?: {
    proposalId: string;
    applicantName: string;
    tag: string;
    totalAmount: number;
    expenditureAmount: number;
    balanceAmount: number;
  };
}

interface ExpenditureProposalCard {
  proposalId: string;
  applicantName: string;
  tag: string;
  totalAmount: number;
  expenditureAmount: number;
  balanceAmount: number;
}

interface ExpenditureDashboardCardApi {
  finance_request_id?: number;
  request_ref?: string;
  applicant_name?: string;
  finance_tag?: string;
  approved_amount?: number;
  expenditure_amount?: number;
  balance_amount?: number;
}

const PROPOSAL_CARD_STORAGE_KEY = 'expenditure-dashboard-proposal-card';

const loadStoredProposalCard = (preferred?: ExpenditureProposalCard | null): ExpenditureProposalCard => {
  if (preferred) {
    return preferred;
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(PROPOSAL_CARD_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ExpenditureProposalCard>;
        if (parsed?.proposalId && parsed?.applicantName && parsed?.tag && Number.isFinite(Number(parsed.totalAmount))) {
          return {
            proposalId: String(parsed.proposalId),
            applicantName: String(parsed.applicantName),
            tag: String(parsed.tag),
            totalAmount: Number(parsed.totalAmount || 0),
            expenditureAmount: Number(parsed.expenditureAmount || 0),
            balanceAmount: Number(parsed.balanceAmount || 0),
          };
        }
      }
    } catch {
      // Ignore malformed session storage and fall back below.
    }
  }

  return EMPTY_EXPENDITURE_CARD;
};

const EMPTY_EXPENDITURE_CARD: ExpenditureProposalCard = {
  proposalId: '',
  applicantName: '',
  tag: '',
  totalAmount: 0,
  expenditureAmount: 0,
  balanceAmount: 0,
};



const DEMO_ROWS_STORAGE_KEY = 'expenditure-dashboard-demo-rows';

const DEFAULT_DEMO_ROWS: DemoRow[] = [
  {
    id: 'demo-row-1',
    primaryChoice: null,
    advanceCount: 0,
    advanceAmount: 0,
    expenditureAmount: 0,
    settlementAmount: 0,
    approvalLevel: 0,
  },
];

const createDemoRow = (): DemoRow => ({
  id: `demo-row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  primaryChoice: null,
  advanceCount: 0,
  advanceAmount: 0,
  expenditureAmount: 0,
  settlementAmount: 0,
  approvalLevel: 0,
});

const loadDemoRows = (): DemoRow[] => {
  if (typeof window === 'undefined') {
    return DEFAULT_DEMO_ROWS;
  }

  try {
    const raw = window.sessionStorage.getItem(DEMO_ROWS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_DEMO_ROWS;
    }

    const parsed = JSON.parse(raw) as Array<Record<string, any>>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_DEMO_ROWS;
    }

    return parsed.map((row, index) => {
      const migratedChoice = row?.primaryChoice
        || (row?.flow === 'advance' ? 'Advance' : row?.flow === 'expenditure' ? 'Expenditure' : null);
      const primaryChoice = migratedChoice === 'Advance' || migratedChoice === 'Settlement' || migratedChoice === 'Expenditure'
        ? migratedChoice
        : null;

      const advanceCount = Number.isFinite(Number(row?.advanceCount)) ? Math.max(Number(row.advanceCount), 0) : 0;

      return {
        id: typeof row?.id === 'string' && row.id ? row.id : `demo-row-${index + 1}`,
        primaryChoice,
        advanceCount,
        advanceAmount: Number.isFinite(Number(row?.advanceAmount)) ? Math.max(Number(row.advanceAmount), 0) : 0,
        expenditureAmount: Number.isFinite(Number(row?.expenditureAmount)) ? Math.max(Number(row.expenditureAmount), 0) : 0,
        settlementAmount: Number.isFinite(Number(row?.settlementAmount)) ? Math.max(Number(row.settlementAmount), 0) : 0,
        approvalLevel: Number.isFinite(Number(row?.approvalLevel)) ? Math.max(Math.min(Number(row.approvalLevel), 3), 0) : (primaryChoice ? 1 : 0),
      };
    });
  } catch {
    return DEFAULT_DEMO_ROWS;
  }
};

const ExpenditureDashboard: React.FC = () => {
  const [data, setData] = useState<ExpenditureItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [demoRows, setDemoRows] = useState<DemoRow[]>(loadDemoRows);
  const [showDemoStatusDetail, setShowDemoStatusDetail] = useState<Record<string, boolean>>({});
  const [showRequestStatusDetail, setShowRequestStatusDetail] = useState<Record<number, boolean>>({});
  const [financeIdQuery, setFinanceIdQuery] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();
  const dashboardState = (location.state as DashboardReturnState | null) || null;
  const [proposalCards, setProposalCards] = useState<ExpenditureProposalCard[]>(() => {
    const stored = loadStoredProposalCard(dashboardState?.financeProposal || null);
    return stored.proposalId ? [stored] : [];
  });

  // ── Financial Year helpers ──
  const formatFY = (fyStart: number) => `${fyStart}-${String(fyStart + 1).slice(2)}`;

  const getDefaultFilterFY = () => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth(); // 0=Jan, 1=Feb …
    const fyStart = monthIndex >= 1 ? year : year - 1;
    return formatFY(fyStart);
  };

  const getRunningFYStart = () => {
    const now = new Date();
    const year = now.getFullYear();
    return now.getMonth() >= 3 ? year : year - 1; // Apr = month 3
  };

  const addDemoRow = () => {
    setDemoRows((prev) => [
      ...prev,
      createDemoRow(),
    ]);
  };

  const removeDemoRow = (id: string) => {
    setDemoRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev));
  };

  const handleModuleLaunch = (rowId: string, module: DemoModule, card: ExpenditureProposalCard) => {
    navigate('/expenditure/new', {
      state: {
        activeTab: module,
        dashboardRowId: rowId,
        financeProposal: {
          proposalId: card.proposalId,
          applicantName: card.applicantName,
          tag: card.tag,
          totalAmount: card.totalAmount,
          expenditureAmount: Number(card.expenditureAmount || 0),
          balanceAmount: Math.max(Number(card.balanceAmount || 0), 0),
        },
      },
    });
  };

  const formatAmount = (amount: number) => `Rs ${Number(amount || 0).toLocaleString('en-IN')}`;

  const getDemoActions = (row: DemoRow): Array<{ label: string; module: DemoModule; disabled?: boolean }> => {
    const isCompleted = row.approvalLevel >= 3;
    const advanceLabel = row.advanceCount > 0 ? `Advance ${row.advanceCount}` : 'Advance';

    if (isCompleted) {
      return [
        { label: advanceLabel, module: 'Advance', disabled: true },
        { label: 'Settlement', module: 'Settlement', disabled: true },
        { label: 'Expenditure', module: 'Expenditure', disabled: true },
      ];
    }

    if (row.primaryChoice === 'Settlement') {
      return [
        { label: 'Advance', module: 'Advance', disabled: true },
        { label: 'Settlement', module: 'Settlement' },
        { label: 'Expenditure', module: 'Expenditure', disabled: true },
      ];
    }

    if (row.primaryChoice === 'Advance') {
      return [
        { label: advanceLabel, module: 'Advance' },
        { label: 'Settlement', module: 'Settlement' },
        { label: 'Expenditure', module: 'Expenditure', disabled: true },
      ];
    }

    if (row.primaryChoice === 'Expenditure') {
      return [
        { label: 'Advance', module: 'Advance', disabled: true },
        { label: 'Expenditure', module: 'Expenditure' },
        { label: 'Settlement', module: 'Settlement' },
      ];
    }

    return [
      { label: 'Advance', module: 'Advance' },
      { label: 'Expenditure', module: 'Expenditure' },
    ];
  };

  const getDemoStatusLabel = (row: DemoRow) => {
    if (row.approvalLevel >= 3) {
      return 'Approved';
    }

    if (row.primaryChoice) {
      return 'Pending';
    }

    return 'Status';
  };

  const getDemoTimelineState = (row: DemoRow, stage: 'hod' | 'dof' | 'principal') => {
    if (row.approvalLevel >= 3) return 'completed';
    if (row.approvalLevel === 2) {
      if (stage === 'principal') return 'current';
      return 'completed';
    }

    if (row.approvalLevel === 1) {
      if (stage === 'hod') return 'current';
      return 'pending';
    }

    return 'pending';
  };

  const getRequestStatusLabel = (status: ExpenditureItem['overall_status']) => {
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return 'Pending';
  };

  const getRequestTimelineState = (status: ExpenditureItem['overall_status'], stage: 'hod' | 'dof' | 'principal') => {
    if (status === 'approved') return 'completed';
    if (status === 'rejected') return 'pending';
    if (stage === 'hod') return 'current';
    return 'pending';
  };

  useEffect(() => {
    const state = location.state as DashboardReturnState | null;
    if (!state?.dashboardRowId || !state?.submittedModule) {
      if (state?.financeProposal) {
        setProposalCards((prev) => {
          const next = [...prev];
          const index = next.findIndex((card) => card.proposalId === state.financeProposal!.proposalId);
          if (index >= 0) {
            next[index] = state.financeProposal!;
            return next;
          }
          return [state.financeProposal!, ...next];
        });
      }
      return;
    }

    if (state.financeProposal) {
      setProposalCards((prev) => {
        const next = [...prev];
        const index = next.findIndex((card) => card.proposalId === state.financeProposal!.proposalId);
        if (index >= 0) {
          next[index] = state.financeProposal!;
          return next;
        }
        return [state.financeProposal!, ...next];
      });
    }

    setDemoRows((prev) =>
      prev.map((row) => {
        if (row.id !== state.dashboardRowId) {
          return row;
        }

        if (state.submittedModule === 'Advance') {
          const submittedAmount = Number(state.submittedAmount || 0);
          return {
            ...row,
            primaryChoice: 'Advance',
            advanceCount: row.advanceCount + 1,
            advanceAmount: row.advanceAmount + submittedAmount,
            approvalLevel: 1,
          };
        }

        if (state.submittedModule === 'Expenditure') {
          const submittedAmount = Number(state.submittedAmount || 0);
          return {
            ...row,
            primaryChoice: 'Expenditure',
            expenditureAmount: row.expenditureAmount + submittedAmount,
            approvalLevel: 1,
          };
        }

        if (state.submittedModule === 'Settlement') {
          const submittedAmount = Number(state.submittedAmount || 0);
          return {
            ...row,
            primaryChoice: 'Settlement',
            settlementAmount: row.settlementAmount + submittedAmount,
            approvalLevel: 3,
          };
        }

        return row;
      }),
    );

    navigate('/expenditure', { replace: true, state: null });
  }, [location.state, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const firstCard = proposalCards[0] || EMPTY_EXPENDITURE_CARD;
    window.sessionStorage.setItem(PROPOSAL_CARD_STORAGE_KEY, JSON.stringify(firstCard));
  }, [proposalCards]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(DEMO_ROWS_STORAGE_KEY, JSON.stringify(demoRows));
  }, [demoRows]);

  const [financialYear, setFinancialYear] = useState(getDefaultFilterFY());

  const fyOptions = useMemo(() => {
    const running = getRunningFYStart();
    const defaultStart = Number.parseInt(getDefaultFilterFY().split('-')[0], 10);
    const starts = Array.from(new Set([defaultStart, running, running - 1])).sort((a, b) => b - a);
    return starts.map((start) => {
      const value = formatFY(start);
      return { value, label: `FY ${value}` };
    });
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [financialYear]);

  const normalizedFinanceIdQuery = financeIdQuery.trim().toLowerCase();
  const filteredData = useMemo(() => {
    if (!normalizedFinanceIdQuery) {
      return data;
    }

    return data.filter((item) => {
      const searchValues = [
        String(item.proposal_ref || ''),
        String(item.finance_id || ''),
        String(item.id || ''),
      ]
        .join(' ')
        .toLowerCase();

      return searchValues.includes(normalizedFinanceIdQuery);
    });
  }, [data, normalizedFinanceIdQuery]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const fyStart = Number.parseInt(financialYear.split('-')[0], 10);
      const res = await authenticityUtility.get('/expenditure-dashboard', {
        params: { fiscalYear: fyStart },
      }) as { data?: ExpenditureItem[]; cards?: ExpenditureDashboardCardApi[] };
      const apiData: ExpenditureItem[] = Array.isArray(res?.data) ? res.data : [];
      const apiCards = Array.isArray(res?.cards) ? res.cards as ExpenditureDashboardCardApi[] : [];

      setData(apiData);
      if (apiCards.length > 0) {
        const mappedCards = apiCards.map((card) => ({
          proposalId: String(card.request_ref || card.finance_request_id || ''),
          applicantName: String(card.applicant_name || ''),
          tag: String(card.finance_tag || ''),
          totalAmount: Number(card.approved_amount || 0),
          expenditureAmount: Number(card.expenditure_amount || 0),
          balanceAmount: Number(card.balance_amount || 0),
        }));
        setProposalCards(mappedCards);
        setOpenCardId((prev) => prev || mappedCards[0]?.proposalId || null);
      } else {
        setProposalCards([]);
        setOpenCardId(null);
      }
    } catch (err) {
      console.error('Expenditure dashboard error', err);
      setData([]);
      setProposalCards([]);
      setOpenCardId(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="expenditure-page">
        <div className="expenditure-container">
          <div className="expenditure-card">

            {/* HEADER */}
            <div className="expenditure-header">
              <div className="expenditure-header-left">
                <h5 className="expenditure-title">Expenditure Requests</h5>
              </div>
              <div className="expenditure-header-right">
                <div className="expenditure-search-wrap">
                  <Search size={18} className="expenditure-search-icon" />
                  <input
                    type="text"
                    className="expenditure-search-input"
                    value={financeIdQuery}
                    onChange={(e) => setFinanceIdQuery(e.target.value)}
                    placeholder="Search finance ID..."
                    aria-label="Search finance ID"
                  />
                </div>
                <select
                  className="expenditure-financial-year"
                  value={financialYear}
                  onChange={(e) => setFinancialYear(e.target.value)}
                >
                  {fyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* BODY */}
            <div className="expenditure-body">
              <div className="expenditure-demo-wrap">
                {proposalCards.map((card) => {
                  const isCardOpen = openCardId === card.proposalId;
                  const cardExpenditureAmount = Number(card.expenditureAmount || 0);
                  const cardBalanceAmount = Math.max(Number(card.balanceAmount || 0), 0);

                  return (
                    <div key={card.proposalId || card.applicantName} className={`expenditure-demo-card ${isCardOpen ? 'open' : ''}`}>
                      <button
                        type="button"
                        className="expenditure-demo-trigger"
                        onClick={() => setOpenCardId((prev) => (prev === card.proposalId ? null : card.proposalId))}
                      >
                        <div className="expenditure-demo-trigger__content">
                          <div className="expenditure-demo-trigger__id">{card.proposalId}</div>
                          <div className="expenditure-demo-trigger__title">
                            {card.applicantName}
                          </div>
                          <div className="expenditure-demo-trigger__meta">
                            <span>{card.tag}</span>
                          </div>
                        </div>
                        <div className="expenditure-demo-trigger__summary">
                          <div className="expenditure-demo-trigger__summary-item">
                            <span className="expenditure-demo-trigger__summary-label">Approved</span>
                            <strong>{formatAmount(card.totalAmount)}</strong>
                          </div>
                          <div className="expenditure-demo-trigger__summary-item">
                            <span className="expenditure-demo-trigger__summary-label">Expenditure</span>
                            <strong>{formatAmount(cardExpenditureAmount)}</strong>
                          </div>
                          <div className="expenditure-demo-trigger__summary-item">
                            <span className="expenditure-demo-trigger__summary-label">Balance</span>
                            <strong>{formatAmount(cardBalanceAmount)}</strong>
                          </div>
                        </div>
                        <ChevronDown
                          size={20}
                          className={`expenditure-demo-trigger__arrow ${isCardOpen ? 'open' : ''}`}
                        />
                      </button>

                      {isCardOpen && (
                        <div className="expenditure-demo-dropdown">
                          <div className="expenditure-demo-dropdown__layout">
                            <div className="expenditure-demo-dropdown__left">
                              <div className="expenditure-demo-rows">
                                {demoRows.map((row, rowIndex) => {
                                  const actions = getDemoActions(row);
                                  const isLastRow = rowIndex === demoRows.length - 1;
                                  const showAdvanceAmount = row.advanceAmount > 0;
                                  const showExpenditureAmount = row.expenditureAmount > 0;
                                  const showSettlementAmount = row.settlementAmount > 0;
                                  const isCompleted = row.approvalLevel >= 3;

                                  return (
                                    <div
                                      key={row.id}
                                      className={`expenditure-demo-row ${isCompleted ? 'expenditure-demo-row--completed' : ''}`}
                                    >
                                      <div className="expenditure-demo-row__header">
                                        <div className="expenditure-demo-row__left">
                                          <div className="expenditure-demo-row__buttons">
                                            {actions.map((option) => (
                                              <button
                                                key={option.label}
                                                type="button"
                                                className={`expenditure-demo-option ${option.disabled ? 'disabled' : ''} ${option.module === row.primaryChoice || (option.module === 'Settlement' && row.settlementAmount > 0) ? 'chosen' : ''}`}
                                                onClick={() => !option.disabled && handleModuleLaunch(row.id, option.module, card)}
                                                disabled={option.disabled}
                                              >
                                                <span className="expenditure-demo-option__label">{option.label}</span>
                                              </button>
                                            ))}
                                          </div>

                                          <div className="expenditure-demo-row__amounts">
                                            {showAdvanceAmount && (
                                              <div className="expenditure-demo-row__amount-chip">
                                                <span className="expenditure-demo-row__amount-label">Advance</span>
                                                <strong>{formatAmount(row.advanceAmount)}</strong>
                                              </div>
                                            )}
                                            {showExpenditureAmount && (
                                              <div className="expenditure-demo-row__amount-chip">
                                                <span className="expenditure-demo-row__amount-label">Expenditure</span>
                                                <strong>{formatAmount(row.expenditureAmount)}</strong>
                                              </div>
                                            )}
                                            {showSettlementAmount && (
                                              <div className="expenditure-demo-row__amount-chip">
                                                <span className="expenditure-demo-row__amount-label">Settlement</span>
                                                <strong>{formatAmount(row.settlementAmount)}</strong>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="expenditure-demo-row__status">
                                          <button
                                            type="button"
                                            className={`expenditure-status-pill ${isCompleted ? 'expenditure-status-pill--approved' : ''} ${showDemoStatusDetail[row.id] ? 'expenditure-status-pill--active' : ''}`}
                                            onClick={() => setShowDemoStatusDetail((prev) => ({
                                              ...prev,
                                              [row.id]: !prev[row.id],
                                            }))}
                                            aria-expanded={Boolean(showDemoStatusDetail[row.id])}
                                            aria-label={`Toggle approval status for ${row.id}`}
                                          >
                                            {getDemoStatusLabel(row)}
                                          </button>
                                          {showDemoStatusDetail[row.id] && (
                                            <div className="expenditure-status-detail-line">
                                              {(['hod', 'dof', 'principal'] as const).map((stage, stepIndex, array) => {
                                                const stageState = getDemoTimelineState(row, stage);
                                                return (
                                                  <React.Fragment key={stage}>
                                                    <div
                                                      className={`expenditure-status-line-circle expenditure-status-circle-${stageState}`}
                                                      title={stage.toUpperCase()}
                                                    />
                                                    {stepIndex < array.length - 1 && (
                                                      <div className={`expenditure-status-line-connector expenditure-status-line-connector--${stageState}`} />
                                                    )}
                                                  </React.Fragment>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>

                                        <div className="expenditure-demo-row__actions">
                                          {isLastRow && (
                                            <button
                                              type="button"
                                              className="expenditure-demo-row__icon-btn"
                                              onClick={addDemoRow}
                                              title="Add row"
                                            >
                                              <Plus size={14} />
                                            </button>
                                          )}
                                          {demoRows.length > 1 && (
                                            <button
                                              type="button"
                                              className="expenditure-demo-row__icon-btn expenditure-demo-row__icon-btn--danger"
                                              onClick={() => removeDemoRow(row.id)}
                                              title="Delete row"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!loading && filteredData.length > 0 && (
                <div className="expenditure-request-list">
                  {filteredData.map((item, idx) => {
                    const isExpanded = Boolean(showRequestStatusDetail[item.id]);
                    const statusLabel = getRequestStatusLabel(item.overall_status);

                    return (
                      <div key={item.id} className="expenditure-request-card">
                        <div className="expenditure-request-card__top">
                          <div className="expenditure-request-card__left">
                            <div className="expenditure-request-card__index">{idx + 1}</div>
                            <div className="expenditure-request-card__content">
                              <div className="expenditure-request-card__name">{item.applicant_name}</div>
                              <div className="expenditure-request-card__meta">
                                <span>{item.beneficiary_type}</span>
                                <span className="expenditure-demo-trigger__meta-dot">•</span>
                                <span>{item.primary_head}</span>
                              </div>
                              <div className="expenditure-request-card__sub">
                                Submitted: {new Date(item.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          <div className="expenditure-request-card__right">
                            <div className="expenditure-request-card__amount">
                              Rs {Number(item.amount || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="expenditure-request-card__actions">
                              <button title="View" className="expenditure-action-global"><Eye size={16} /></button>
                              <button title="Edit" className="expenditure-action-global"><Edit2 size={16} /></button>
                              <button title="Delete" className="expenditure-action-global" style={{ color: '#dc2626' }}><Trash2 size={16} /></button>
                            </div>
                            <button
                              type="button"
                              className={`expenditure-status-pill ${isExpanded ? 'expenditure-status-pill--active' : ''}`}
                              onClick={() => setShowRequestStatusDetail((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))}
                              aria-expanded={isExpanded}
                              aria-label={`Toggle status for ${item.applicant_name}`}
                            >
                              {statusLabel}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="expenditure-request-card__timeline">
                            {(['hod', 'dof', 'principal'] as const).map((stage, stageIndex, arr) => {
                              const stageState = getRequestTimelineState(item.overall_status, stage);
                              return (
                                <React.Fragment key={stage}>
                                  <div
                                    className={`expenditure-status-line-circle expenditure-status-circle-${stageState}`}
                                    title={stage.toUpperCase()}
                                  />
                                  {stageIndex < arr.length - 1 && (
                                    <div className={`expenditure-status-line-connector expenditure-status-line-connector--${stageState}`} />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {loading && (
                <div className="expenditure-state">Loading expenditure requests...</div>
              )}

              {!loading && filteredData.length === 0 && (
                <div className="expenditure-state expenditure-state--empty">
                  <div style={{ color: '#6b7280', fontSize: '15px', marginTop: '10px' }}>
                    {financeIdQuery.trim()
                      ? `No expenditure requests found for finance ID "${financeIdQuery.trim()}".`
                      : `No expenditure requests found for FY ${financialYear}`}
                  </div>
                </div>
              )}

              {!loading && filteredData.length > 0 && (
                <div className="expenditure-table-section">
                  <div className="expenditure-table-wrapper" style={{ margin: 0 }}>
                    <table className="expenditure-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '6%', textAlign: 'center' }}>S.No</th>
                          <th style={{ width: '22%', textAlign: 'left' }}>Applicant Name</th>
                          <th style={{ width: '15%', textAlign: 'left' }}>Beneficiary Type</th>
                          <th style={{ width: '20%', textAlign: 'left' }}>Primary Head</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                          <th style={{ width: '15%', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((item, idx) => (
                          <tr key={item.id}>
                            <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ textAlign: 'left' }}>
                              <div className="expenditure-head-title">{item.applicant_name}</div>
                              <div className="expenditure-head-sub">
                                Submitted: {new Date(item.created_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td style={{ textAlign: 'left' }}>{item.beneficiary_type}</td>
                            <td style={{ textAlign: 'left' }}>{item.primary_head}</td>
                            <td style={{ textAlign: 'right' }}>₹ {Number(item.amount || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`expenditure-status-pill expenditure-status-pill--${item.overall_status}`}>
                                {item.overall_status.charAt(0).toUpperCase() + item.overall_status.slice(1)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="expenditure-actions-global" style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                <button title="View" className="expenditure-action-global"><Eye size={16} /></button>
                                <button title="Edit" className="expenditure-action-global"><Edit2 size={16} /></button>
                                <button title="Delete" className="expenditure-action-global" style={{ color: '#dc2626' }}><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ExpenditureDashboard;

