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
const DEMO_ROWS_MAP_STORAGE_KEY = 'expenditure-dashboard-demo-rows-map';

const loadStoredProposalCard = (preferred?: ExpenditureProposalCard | null): ExpenditureProposalCard => {
  if (preferred) {
    return preferred;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(PROPOSAL_CARD_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.proposalId) return parsed;
      }
    } catch {}
  }
  return { proposalId: '', applicantName: '', tag: '', totalAmount: 0, expenditureAmount: 0, balanceAmount: 0 };
};

const loadDemoRowsMap = (): Record<string, DemoRow[]> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(DEMO_ROWS_MAP_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const createDemoRow = (proposalId: string, index: number): DemoRow => ({
  id: `demo-row-${proposalId}-${index}-${Date.now()}`,
  primaryChoice: null,
  advanceCount: 0,
  advanceAmount: 0,
  expenditureAmount: 0,
  settlementAmount: 0,
  approvalLevel: 0,
});

const ExpenditureDashboard: React.FC = () => {
  const [data, setData] = useState<ExpenditureItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [demoRowsMap, setDemoRowsMap] = useState<Record<string, DemoRow[]>>(loadDemoRowsMap);
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

  const formatFY = (fyStart: number) => `${fyStart}-${String(fyStart + 1).slice(2)}`;
  const getDefaultFilterFY = () => {
    const now = new Date();
    const year = now.getFullYear();
    const fyStart = now.getMonth() >= 1 ? year : year - 1;
    return formatFY(fyStart);
  };
  const [financialYear, setFinancialYear] = useState(getDefaultFilterFY());

  const addDemoRow = (proposalId: string) => {
    setDemoRowsMap((prev) => {
      const rows = prev[proposalId] || [{
        id: `demo-row-${proposalId}-1`, primaryChoice: null, advanceCount: 0, advanceAmount: 0, expenditureAmount: 0, settlementAmount: 0, approvalLevel: 0
      }];
      return { ...prev, [proposalId]: [...rows, createDemoRow(proposalId, rows.length + 1)] };
    });
  };

  const removeDemoRow = (proposalId: string, rowId: string) => {
    setDemoRowsMap((prev) => {
      const rows = prev[proposalId] || [];
      if (rows.length <= 1) return prev;
      return { ...prev, [proposalId]: rows.filter(r => r.id !== rowId) };
    });
  };

  const handleModuleLaunch = (rowId: string, module: DemoModule, card: ExpenditureProposalCard) => {
    navigate('/expenditure/new', {
      state: {
        activeTab: module,
        dashboardRowId: rowId,
        financeProposal: { ...card },
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

  const getDemoStatusLabel = (row: DemoRow) => (row.approvalLevel >= 3 ? 'Approved' : row.primaryChoice ? 'Pending' : 'Status');

  const getDemoTimelineState = (row: DemoRow, stage: 'hod' | 'dof' | 'principal') => {
    if (row.approvalLevel >= 3) return 'completed';
    if (row.approvalLevel === 2) return stage === 'principal' ? 'current' : 'completed';
    if (row.approvalLevel === 1) return stage === 'hod' ? 'current' : 'pending';
    return 'pending';
  };

  const getRequestStatusLabel = (status: ExpenditureItem['overall_status']) => status.charAt(0).toUpperCase() + status.slice(1);
  const getRequestTimelineState = (status: ExpenditureItem['overall_status'], stage: 'hod' | 'dof' | 'principal') => 
    status === 'approved' ? 'completed' : status === 'rejected' ? 'pending' : (stage === 'hod' ? 'current' : 'pending');

  useEffect(() => {
    const state = location.state as DashboardReturnState | null;
    if (!state) return;

    if (state.financeProposal) {
      setProposalCards((prev) => {
        const exists = prev.find(p => p.proposalId === state.financeProposal!.proposalId);
        if (exists) return prev.map(p => p.proposalId === state.financeProposal!.proposalId ? state.financeProposal! : p);
        return [state.financeProposal!, ...prev];
      });
    }

    const propId = state.financeProposal?.proposalId;
    if (state.dashboardRowId && state.submittedModule && propId) {
      const amt = Number(state.submittedAmount || 0);

      // Local update for card expenditure and balance
      if (state.submittedModule === 'Settlement' || state.submittedModule === 'Expenditure') {
        setProposalCards((prev) => prev.map(p => {
          if (p.proposalId !== propId) return p;
          const currentExp = Number(p.expenditureAmount || 0);
          const currentBal = Number(p.balanceAmount || 0);
          return {
            ...p,
            expenditureAmount: currentExp + amt,
            balanceAmount: currentBal - amt
          };
        }));
      }

      setDemoRowsMap((prev) => {
        const rows = prev[propId] || [{
          id: state.dashboardRowId!, primaryChoice: null, advanceCount: 0, advanceAmount: 0, expenditureAmount: 0, settlementAmount: 0, approvalLevel: 0
        }];
        const updated = rows.map(r => {
          if (r.id !== state.dashboardRowId) return r;
          if (state.submittedModule === 'Advance') {
            return { 
              ...r, 
              primaryChoice: 'Advance' as const, 
              advanceCount: r.advanceCount + 1, 
              advanceAmount: amt, 
              approvalLevel: 1 
            };
          }
          if (state.submittedModule === 'Expenditure') {
            return { 
              ...r, 
              primaryChoice: 'Expenditure' as const, 
              expenditureAmount: amt, 
              approvalLevel: 1 
            };
          }
          if (state.submittedModule === 'Settlement') {
            return { 
              ...r, 
              primaryChoice: 'Settlement' as const, 
              settlementAmount: amt, 
              approvalLevel: 3 
            };
          }
          return r;
        });
        return { ...prev, [propId]: updated };
      });
      navigate('/expenditurecard', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(DEMO_ROWS_MAP_STORAGE_KEY, JSON.stringify(demoRowsMap));
    }
  }, [demoRowsMap]);

  useEffect(() => {
    if (typeof window !== 'undefined' && proposalCards.length > 0) {
      window.sessionStorage.setItem(PROPOSAL_CARD_STORAGE_KEY, JSON.stringify(proposalCards[0]));
    }
  }, [proposalCards]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const fyStart = Number.parseInt(financialYear.split('-')[0], 10);
      const res = await authenticityUtility.get('/expenditure-dashboard', { params: { fiscalYear: fyStart } }) as any;
      const apiData = Array.isArray(res?.data) ? res.data : [];
      const apiCards = Array.isArray(res?.cards) ? res.cards : [];
      setData(apiData);
      if (apiCards.length > 0) {
        setProposalCards(apiCards.map((c: any) => ({
          proposalId: String(c.request_ref || c.finance_request_id || ''),
          applicantName: String(c.applicant_name || ''),
          tag: String(c.finance_tag || ''),
          totalAmount: Number(c.approved_amount || 0),
          expenditureAmount: Number(c.expenditure_amount || 0),
          balanceAmount: Number(c.balance_amount || 0),
        })));
        setOpenCardId(prev => prev || String(apiCards[0].request_ref || apiCards[0].finance_request_id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, [financialYear]);

  const filteredData = useMemo(() => {
    const query = financeIdQuery.trim().toLowerCase();
    if (!query) return data;
    return data.filter(item => [item.proposal_ref, item.finance_id, item.applicant_name].join(' ').toLowerCase().includes(query));
  }, [data, financeIdQuery]);

  const fyOptions = useMemo(() => {
    const year = new Date().getFullYear();
    const starts = [year, year - 1, year + 1];
    return starts.map(s => ({ value: formatFY(s), label: `FY ${formatFY(s)}` }));
  }, []);

  return (
    <section className="expenditure-page">
      <div className="expenditure-container">
        <div className="expenditure-card">
          <div className="expenditure-header">
            <h5 className="expenditure-title">Expenditure Requests</h5>
            <div className="expenditure-header-right">
              <div className="expenditure-search-wrap">
                <Search size={18} className="expenditure-search-icon" />
                <input type="text" className="expenditure-search-input" value={financeIdQuery} onChange={(e) => setFinanceIdQuery(e.target.value)} placeholder="Search..." />
              </div>
              <select className="expenditure-financial-year" value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>
                {fyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="expenditure-body">
            <div className="expenditure-demo-wrap">
              {proposalCards.map((card) => {
                const isCardOpen = openCardId === card.proposalId;
                const rows = demoRowsMap[card.proposalId] || [{
                  id: `demo-row-${card.proposalId}-1`, primaryChoice: null, advanceCount: 0, advanceAmount: 0, expenditureAmount: 0, settlementAmount: 0, approvalLevel: 0
                }];
                const totalAdvance = rows.reduce((s, r) => s + r.advanceAmount, 0);

                return (
                  <div key={card.proposalId} className={`expenditure-demo-card ${isCardOpen ? 'open' : ''}`}>
                    <button type="button" className="expenditure-demo-trigger" onClick={() => setOpenCardId(prev => prev === card.proposalId ? null : card.proposalId)}>
                      <div className="expenditure-demo-trigger__content">
                        <div className="expenditure-demo-trigger__id">{card.proposalId}</div>
                        <div className="expenditure-demo-trigger__title">{card.applicantName}</div>
                        <div className="expenditure-demo-trigger__meta"><span>{card.tag}</span></div>
                      </div>
                      <div className="expenditure-demo-trigger__summary">
                        <div className="expenditure-demo-trigger__summary-item"><span className="expenditure-demo-trigger__summary-label">Approved</span><strong>{formatAmount(card.totalAmount)}</strong></div>
                        {totalAdvance > 0 && <div className="expenditure-demo-trigger__summary-item"><span className="expenditure-demo-trigger__summary-label">Advance</span><strong>{formatAmount(totalAdvance)}</strong></div>}
                        <div className="expenditure-demo-trigger__summary-item"><span className="expenditure-demo-trigger__summary-label">Expenditure</span><strong>{formatAmount(card.expenditureAmount)}</strong></div>
                        <div className="expenditure-demo-trigger__summary-item"><span className="expenditure-demo-trigger__summary-label">Balance</span><strong>{formatAmount(card.balanceAmount)}</strong></div>
                      </div>
                      <ChevronDown size={20} className={`expenditure-demo-trigger__arrow ${isCardOpen ? 'open' : ''}`} />
                    </button>

                    {isCardOpen && (
                      <div className="expenditure-demo-dropdown">
                        <div className="expenditure-demo-rows">
                          {rows.map((row, idx) => {
                            const actions = getDemoActions(row);
                            return (
                              <div key={row.id} className={`expenditure-demo-row ${row.approvalLevel >= 3 ? 'expenditure-demo-row--completed' : ''}`}>
                                <div className="expenditure-demo-row__header">
                                  <div className="expenditure-demo-row__left">
                                    <div className="expenditure-demo-row__buttons">
                                      {actions.map(a => (
                                        <button key={a.label} type="button" className={`expenditure-demo-option ${a.disabled ? 'disabled' : ''} ${a.module === row.primaryChoice ? 'chosen' : ''}`} disabled={a.disabled} onClick={() => !a.disabled && handleModuleLaunch(row.id, a.module, card)}>
                                          <span className="expenditure-demo-option__label">{a.label}</span>
                                        </button>
                                      ))}
                                    </div>
                                    <div className="expenditure-demo-row__amounts">
                                      {row.advanceAmount > 0 && <div className="expenditure-demo-row__amount-chip"><span className="expenditure-demo-row__amount-label">Advance</span><strong>{formatAmount(row.advanceAmount)}</strong></div>}
                                      {row.expenditureAmount > 0 && <div className="expenditure-demo-row__amount-chip"><span className="expenditure-demo-row__amount-label">Expenditure</span><strong>{formatAmount(row.expenditureAmount)}</strong></div>}
                                      {row.settlementAmount > 0 && <div className="expenditure-demo-row__amount-chip"><span className="expenditure-demo-row__amount-label">Settlement</span><strong>{formatAmount(row.settlementAmount)}</strong></div>}
                                    </div>
                                  </div>
                                  <div className="expenditure-demo-row__status">
                                    <button type="button" className={`expenditure-status-pill ${row.approvalLevel >= 3 ? 'expenditure-status-pill--approved' : ''}`} onClick={() => setShowDemoStatusDetail(p => ({ ...p, [row.id]: !p[row.id] }))}>
                                      {getDemoStatusLabel(row)}
                                    </button>
                                    {showDemoStatusDetail[row.id] && (
                                      <div className="expenditure-status-detail-line">
                                        {['hod', 'dof', 'principal'].map((s: any) => <div key={s} className={`expenditure-status-line-circle expenditure-status-circle-${getDemoTimelineState(row, s)}`} title={s.toUpperCase()} />)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="expenditure-demo-row__actions">
                                    {idx === rows.length - 1 && <button type="button" className="expenditure-demo-row__icon-btn" onClick={() => addDemoRow(card.proposalId)}><Plus size={14} /></button>}
                                    {rows.length > 1 && <button type="button" className="expenditure-demo-row__icon-btn expenditure-demo-row__icon-btn--danger" onClick={() => removeDemoRow(card.proposalId, row.id)}><Trash2 size={14} /></button>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!loading && filteredData.length > 0 && (
              <div className="expenditure-request-list">
                {filteredData.map((item, idx) => (
                  <div key={item.id} className="expenditure-request-card">
                    <div className="expenditure-request-card__top">
                      <div className="expenditure-request-card__left">
                        <div className="expenditure-request-card__index">{idx + 1}</div>
                        <div className="expenditure-request-card__content">
                          <div className="expenditure-request-card__name">{item.applicant_name}</div>
                          <div className="expenditure-request-card__meta"><span>{item.beneficiary_type}</span> • <span>{item.primary_head}</span></div>
                        </div>
                      </div>
                      <div className="expenditure-request-card__right">
                        <div className="expenditure-request-card__amount">{formatAmount(item.amount)}</div>
                        <span className={`expenditure-status-pill expenditure-status-pill--${item.overall_status}`}>{getRequestStatusLabel(item.overall_status)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExpenditureDashboard;
