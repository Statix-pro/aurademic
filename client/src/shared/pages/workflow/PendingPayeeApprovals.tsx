import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard, Edit2, Eye, LoaderCircle, Search, Trash2, X, XCircle } from 'lucide-react';
import authenticityUtility from '../../utils/authenticityUtility';

interface PendingPayeeRecord {
  id: number;
  payee_name?: string;
  account_name?: string | null;
  pan_number?: string | null;
  account_no?: string;
  account_type?: string | null;
  ifsc?: string;
  bank_name?: string;
  branch_name?: string;
  beneficiary_type?: string | null;
  beneficiary_org?: string | null;
  organization_type?: string | null;
  msme?: string | null;
  gstin?: string | null;
  tds_details?: string | null;
  tds_section?: string | null;
  approval_status?: string | null;
  rejection_reason?: string | null;
  requested_at?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PendingPayeeApprovalsProps {
  pendingPayees: PendingPayeeRecord[];
  pendingPayeesLoading: boolean;
  onPayeeDecision: (id: number, decision: 'approved' | 'rejected') => Promise<boolean> | boolean;
  pendingPayeeActingId: number | null;
  onPayeeEdit: (id: number, payload: PendingPayeeRecord) => Promise<boolean> | boolean;
  pendingPayeeEditingId: number | null;
  apiBasePath: string;
  onPayeeDelete: (id: number) => Promise<boolean> | boolean;
}

type PayeeModalMode = 'view' | 'edit';
type PayeeFilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.32)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1300,
  backdropFilter: 'blur(4px)',
  padding: '24px',
};

const modalStyle: React.CSSProperties = {
  width: 'min(920px, 100%)',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: '#ffffff',
  borderRadius: '16px',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
  border: '1px solid #e2e8f0',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '42px',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  padding: '10px 12px',
  fontSize: '0.95rem',
  color: '#0f172a',
  background: '#fff',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#334155',
};

const detailLabelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  marginBottom: '6px',
};

const detailValueStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: '#0f172a',
  wordBreak: 'break-word',
};

const normalizePayeeName = (payee: PendingPayeeRecord | null | undefined) =>
  String(payee?.payee_name || payee?.account_name || '').trim();

const formatDateTime = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
};

const formatToken = (value?: string | null) => {
  const token = String(value || '').trim();
  if (!token) return '-';
  return token
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getStatusToken = (value?: string | null): PayeeFilterStatus | 'unknown' => {
  const token = String(value || '').trim().toLowerCase();
  if (token === 'pending' || token === 'approved' || token === 'rejected') return token;
  return 'unknown';
};

const createDraftFromPayee = (payee: PendingPayeeRecord): PendingPayeeRecord => ({
  ...payee,
  id: Number(payee.id),
  payee_name: normalizePayeeName(payee),
  account_name: normalizePayeeName(payee) || null,
  pan_number: payee.pan_number || '',
  account_no: String(payee.account_no || '').trim(),
  account_type: payee.account_type || '',
  ifsc: String(payee.ifsc || '').trim().toUpperCase(),
  bank_name: String(payee.bank_name || '').trim(),
  branch_name: String(payee.branch_name || '').trim(),
  beneficiary_type: String(payee.beneficiary_type || 'individual').trim().toLowerCase() === 'organization'
    ? 'organization'
    : 'individual',
  beneficiary_org: payee.beneficiary_org || '',
  organization_type: payee.organization_type || '',
  msme: payee.msme || '',
  gstin: payee.gstin || '',
  tds_details: payee.tds_details || '',
  tds_section: payee.tds_section || '',
});

const PayeeDetailField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div style={{ minWidth: 0 }}>
    <div style={detailLabelStyle}>{label}</div>
    <div style={detailValueStyle}>{String(value || '').trim() || '-'}</div>
  </div>
);

const PayeeDetailModal: React.FC<{
  payeeId: number | null;
  queuePayee: PendingPayeeRecord | null;
  apiBasePath: string;
  initialMode: PayeeModalMode;
  busyActionId: number | null;
  busyEditId: number | null;
  onClose: () => void;
  onSave: (id: number, payload: PendingPayeeRecord) => Promise<boolean> | boolean;
  onDecision: (id: number, decision: 'approved' | 'rejected') => Promise<boolean> | boolean;
  onDelete: (id: number) => Promise<boolean> | boolean;
}> = ({ payeeId, queuePayee, apiBasePath, initialMode, busyActionId, busyEditId, onClose, onSave, onDecision, onDelete }) => {
  const [mode, setMode] = useState<PayeeModalMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payee, setPayee] = useState<PendingPayeeRecord | null>(null);
  const [draft, setDraft] = useState<PendingPayeeRecord | null>(null);

  const isOpen = Number.isInteger(payeeId) && Number(payeeId) > 0;
  const isEditing = busyEditId !== null && busyEditId === payeeId;
  const isActing = busyActionId !== null && busyActionId === payeeId;
  const busy = loading || isEditing || isActing;
  const effectivePayee = payee || queuePayee;
  const approvalStatus = String(effectivePayee?.approval_status || 'pending').trim().toLowerCase();
  const isPending = approvalStatus === 'pending';
  const isApproved = approvalStatus === 'approved';
  const isRejected = approvalStatus === 'rejected';
  const isOrganization = String(draft?.beneficiary_type || effectivePayee?.beneficiary_type || 'individual').toLowerCase() === 'organization';

  const loadPayee = async (targetPayeeId: number, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await authenticityUtility.get(`${apiBasePath}/payees/${targetPayeeId}`) as {
        status?: string;
        data?: PendingPayeeRecord;
        message?: string;
      };

      if (response?.status === 'success' && response.data) {
        setPayee(response.data);
        setDraft(createDraftFromPayee(response.data));
        setError('');
        return true;
      }

      setError(response?.message || 'Unable to load payee details.');
      return false;
    } catch (fetchError: any) {
      setError(fetchError?.response?.data?.message || fetchError?.message || 'Unable to load payee details.');
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !payeeId) return undefined;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [busy, isOpen, onClose, payeeId]);

  useEffect(() => {
    if (!payeeId) {
      setMode(initialMode);
      setLoading(false);
      setError('');
      setPayee(null);
      setDraft(null);
      return;
    }

    setMode(initialMode);
    setError('');
    if (queuePayee) {
      setPayee(queuePayee);
      setDraft(createDraftFromPayee(queuePayee));
    } else {
      setPayee(null);
      setDraft(null);
    }

    let cancelled = false;
    void (async () => {
      const success = await loadPayee(payeeId);
      if (cancelled && success) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBasePath, initialMode, payeeId, queuePayee]);

  const title = useMemo(() => normalizePayeeName(effectivePayee) || 'Payee Details', [effectivePayee]);

  if (!isOpen || !payeeId) return null;

  const updateDraft = (key: keyof PendingPayeeRecord, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!draft) return;
    const payload: PendingPayeeRecord = {
      ...draft,
      payee_name: String(draft.payee_name || '').trim(),
      account_name: String(draft.payee_name || '').trim() || null,
      account_no: String(draft.account_no || '').trim(),
      ifsc: String(draft.ifsc || '').trim().toUpperCase(),
      bank_name: String(draft.bank_name || '').trim(),
      branch_name: String(draft.branch_name || '').trim(),
      beneficiary_type: isOrganization ? 'organization' : 'individual',
      beneficiary_org: isOrganization ? String(draft.beneficiary_org || '').trim() : '',
      organization_type: isOrganization ? String(draft.organization_type || '').trim() : '',
      msme: isOrganization ? String(draft.msme || '').trim() : '',
      gstin: isOrganization ? String(draft.gstin || '').trim() : '',
      tds_details: isOrganization ? String(draft.tds_details || '').trim() : '',
      tds_section: isOrganization ? String(draft.tds_section || '').trim() : '',
      pan_number: String(draft.pan_number || '').trim(),
      account_type: String(draft.account_type || '').trim(),
    };

    const updated = await onSave(payeeId, payload);
    if (!updated) return;
    await loadPayee(payeeId, { silent: true });
    setMode('view');
  };

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    const success = await onDecision(payeeId, decision);
    if (success) onClose();
  };

  const handleDelete = async () => {
    const deleted = await onDelete(payeeId);
    if (deleted) onClose();
  };

  return (
    <div style={overlayStyle} onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div style={modalStyle}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '1.08rem', fontWeight: 700, color: '#0f172a' }}>{title}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
              {mode === 'edit' ? 'Update payee details before approval.' : 'Review the full payee record before taking action.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '36px 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#475569' }}>
            <LoaderCircle size={20} className="spin" />
            Loading payee details...
          </div>
        ) : error ? (
          <div style={{ padding: '24px 22px', color: '#b91c1c', fontSize: '0.95rem' }}>{error}</div>
        ) : mode === 'edit' && draft ? (
          <div style={{ padding: '22px', display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Payee Name</label>
                <input style={inputStyle} value={draft.payee_name || ''} onChange={(e) => updateDraft('payee_name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Beneficiary Type</label>
                <select
                  style={inputStyle}
                  value={String(draft.beneficiary_type || 'individual')}
                  onChange={(e) => updateDraft('beneficiary_type', e.target.value)}
                >
                  <option value="individual">Individual</option>
                  <option value="organization">Organization</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Account Number</label>
                <input style={inputStyle} value={draft.account_no || ''} onChange={(e) => updateDraft('account_no', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>IFSC</label>
                <input style={inputStyle} value={draft.ifsc || ''} onChange={(e) => updateDraft('ifsc', e.target.value.toUpperCase())} />
              </div>
              <div>
                <label style={labelStyle}>Bank Name</label>
                <input style={inputStyle} value={draft.bank_name || ''} onChange={(e) => updateDraft('bank_name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Branch Name</label>
                <input style={inputStyle} value={draft.branch_name || ''} onChange={(e) => updateDraft('branch_name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Account Type</label>
                <input style={inputStyle} value={draft.account_type || ''} onChange={(e) => updateDraft('account_type', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>PAN Number</label>
                <input style={inputStyle} value={draft.pan_number || ''} onChange={(e) => updateDraft('pan_number', e.target.value)} />
              </div>
            </div>

            {isOrganization ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Beneficiary Org</label>
                  <select
                    style={inputStyle}
                    value={draft.beneficiary_org || ''}
                    onChange={(e) => updateDraft('beneficiary_org', e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="KSRCT">KSRCT</option>
                    <option value="KSREI">KSREI</option>
                    <option value="External">External</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Organization Type</label>
                  <input style={inputStyle} value={draft.organization_type || ''} onChange={(e) => updateDraft('organization_type', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>MSME</label>
                  <input style={inputStyle} value={draft.msme || ''} onChange={(e) => updateDraft('msme', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>GSTIN</label>
                  <input style={inputStyle} value={draft.gstin || ''} onChange={(e) => updateDraft('gstin', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>TDS Details</label>
                  <input style={inputStyle} value={draft.tds_details || ''} onChange={(e) => updateDraft('tds_details', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>TDS Section</label>
                  <input style={inputStyle} value={draft.tds_section || ''} onChange={(e) => updateDraft('tds_section', e.target.value)} />
                </div>
              </div>
            ) : null}
          </div>
        ) : effectivePayee ? (
          <div style={{ padding: '22px', display: 'grid', gap: '22px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
              <PayeeDetailField label="Payee Name" value={normalizePayeeName(effectivePayee)} />
              <PayeeDetailField label="Account Name" value={effectivePayee.account_name} />
              <PayeeDetailField label="PAN Number" value={effectivePayee.pan_number} />
              <PayeeDetailField label="Account Number" value={effectivePayee.account_no} />
              <PayeeDetailField label="Account Type" value={effectivePayee.account_type} />
              <PayeeDetailField label="Bank Name" value={effectivePayee.bank_name} />
              <PayeeDetailField label="Branch Name" value={effectivePayee.branch_name} />
              <PayeeDetailField label="IFSC" value={String(effectivePayee.ifsc || '').toUpperCase()} />
              <PayeeDetailField label="Beneficiary Type" value={formatToken(effectivePayee.beneficiary_type)} />
              {String(effectivePayee.beneficiary_type || '').trim().toLowerCase() === 'organization' ? (
                <>
                  <PayeeDetailField label="Beneficiary Org" value={effectivePayee.beneficiary_org} />
                  <PayeeDetailField label="Organization Type" value={effectivePayee.organization_type} />
                  <PayeeDetailField label="MSME" value={effectivePayee.msme} />
                  <PayeeDetailField label="GSTIN" value={effectivePayee.gstin} />
                  <PayeeDetailField label="TDS Details" value={effectivePayee.tds_details} />
                  <PayeeDetailField label="TDS Section" value={effectivePayee.tds_section} />
                </>
              ) : null}
              <PayeeDetailField label="Approval Status" value={formatToken(effectivePayee.approval_status)} />
              {isRejected ? (
                <PayeeDetailField label="Rejection Reason" value={effectivePayee.rejection_reason} />
              ) : null}
              <PayeeDetailField label="Requested At" value={formatDateTime(effectivePayee.requested_at)} />
              {isApproved ? (
                <PayeeDetailField label="Approved At" value={formatDateTime(effectivePayee.approved_at)} />
              ) : null}
            </div>
          </div>
        ) : null}

        <div style={{ padding: '18px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {mode === 'view' ? (
              <button
                type="button"
                onClick={() => setMode('edit')}
                disabled={busy || !isPending || !effectivePayee}
                style={{ border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', borderRadius: '10px', padding: '10px 16px', cursor: busy || !isPending ? 'not-allowed' : 'pointer', opacity: busy || !isPending ? 0.7 : 1 }}
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft(effectivePayee ? createDraftFromPayee(effectivePayee) : null);
                  setMode('view');
                }}
                disabled={busy}
                style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: '10px', padding: '10px 16px', cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Cancel Edit
              </button>
            )}
            {isPending && mode === 'view' ? (
              <>
                <button
                  type="button"
                  onClick={() => { void handleDecision('approved'); }}
                  disabled={busy}
                  style={{ border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', borderRadius: '10px', padding: '10px 16px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
                >
                  {isActing ? 'Working...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => { void handleDecision('rejected'); }}
                  disabled={busy}
                  style={{ border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', borderRadius: '10px', padding: '10px 16px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
                >
                  {isActing ? 'Working...' : 'Reject'}
                </button>
              </>
            ) : null}
            {mode === 'view' ? (
              <button
                type="button"
                onClick={() => { void handleDelete(); }}
                disabled={busy}
                style={{ border: '1px solid #fecaca', background: '#fff1f2', color: '#dc2626', borderRadius: '10px', padding: '10px 16px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
              >
                Delete
              </button>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: '10px', padding: '10px 16px', cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              Close
            </button>
            {mode === 'edit' ? (
              <button
                type="button"
                onClick={() => { void handleSave(); }}
                disabled={busy}
                style={{ border: '1px solid #0f766e', background: '#0f766e', color: '#fff', borderRadius: '10px', padding: '10px 16px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
              >
                {isEditing ? 'Saving...' : 'Save'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const PendingPayeeApprovals: React.FC<PendingPayeeApprovalsProps> = ({
  pendingPayees,
  pendingPayeesLoading,
  onPayeeDecision,
  pendingPayeeActingId,
  onPayeeEdit,
  pendingPayeeEditingId,
  apiBasePath,
  onPayeeDelete,
}) => {
  const [selectedPayeeId, setSelectedPayeeId] = useState<number | null>(null);
  const [selectedMode, setSelectedMode] = useState<PayeeModalMode>('view');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayeeFilterStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const selectedQueuePayee = useMemo(
    () => pendingPayees.find((payee) => Number(payee.id) === Number(selectedPayeeId)) || null,
    [pendingPayees, selectedPayeeId],
  );

  const statusCounts = useMemo(() => {
    return pendingPayees.reduce(
      (acc, payee) => {
        const status = getStatusToken(payee.approval_status);
        if (status === 'pending' || status === 'approved' || status === 'rejected') {
          acc[status] += 1;
        }
        acc.all += 1;
        return acc;
      },
      { all: 0, pending: 0, approved: 0, rejected: 0 },
    );
  }, [pendingPayees]);

  const filteredPayees = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return pendingPayees.filter((payee) => {
      const status = getStatusToken(payee.approval_status);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        payee.payee_name,
        payee.account_name,
        payee.account_no,
        payee.ifsc,
        payee.bank_name,
        payee.branch_name,
        payee.pan_number,
        payee.beneficiary_type,
        payee.beneficiary_org,
        payee.organization_type,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(normalizedQuery);
    });
  }, [pendingPayees, searchTerm, statusFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPayees.length / ITEMS_PER_PAGE)),
    [filteredPayees.length],
  );

  const paginatedPayees = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPayees.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredPayees]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (pendingPayeesLoading) {
    return <div className="fw-state" style={{ padding: '2rem 0' }}>Loading payees...</div>;
  }

  if (pendingPayees.length === 0) {
    return (
      <div className="fw-state" style={{ padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '18px', background: '#f8fafc' }}>
        <CreditCard size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h4 style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>No payees found</h4>
        <p style={{ margin: '0.5rem 0 0' }}>There are no active payees available in this management view.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'grid', gap: '16px', padding: '4px 0 0' }}>
        <div style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1f2a44' }}>Payee Management</div>
            <div style={{ position: 'relative', width: '100%', maxWidth: '460px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search payee..."
                style={{ ...inputStyle, minHeight: '40px', paddingLeft: '36px', background: '#fff' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
          {[
            { key: 'all', label: 'All', value: statusCounts.all, icon: CreditCard, tone: '#1d4ed8', bg: '#eff6ff' },
            { key: 'pending', label: 'Pending', value: statusCounts.pending, icon: Clock3, tone: '#b45309', bg: '#fff7ed' },
            { key: 'approved', label: 'Approved', value: statusCounts.approved, icon: CheckCircle2, tone: '#15803d', bg: '#f0fdf4' },
            { key: 'rejected', label: 'Rejected', value: statusCounts.rejected, icon: XCircle, tone: '#b91c1c', bg: '#fef2f2' },
          ].map((item) => {
            const Icon = item.icon;
            const active = statusFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key as PayeeFilterStatus)}
                style={{
                  border: active ? `1px solid ${item.tone}` : '1px solid #e2e8f0',
                  background: active ? item.bg : '#fff',
                  borderRadius: '10px',
                  minHeight: '86px',
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: active ? '0 8px 24px rgba(15, 23, 42, 0.08)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{item.value}</div>
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.bg, color: item.tone }}>
                    <Icon size={22} />
                  </div>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
            {statusFilter === 'all' ? 'All payees' : `${formatToken(statusFilter)} payees`} · {filteredPayees.length} record{filteredPayees.length === 1 ? '' : 's'}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['all', 'pending', 'approved', 'rejected'] as PayeeFilterStatus[]).map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  style={{
                    border: active ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    background: active ? '#eff6ff' : '#fff',
                    color: active ? '#2563eb' : '#475569',
                    borderRadius: '999px',
                    padding: '8px 14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {formatToken(status)}
                </button>
              );
            })}
          </div>
        </div>

        {filteredPayees.length === 0 ? (
          <div className="fw-state" style={{ padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '18px', background: '#f8fafc' }}>
            <CreditCard size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h4 style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>No matching payees</h4>
            <p style={{ margin: '0.5rem 0 0' }}>Try another search or status filter.</p>
          </div>
        ) : (
        <div className="fw-payee-list" style={{ display: 'grid', gap: '16px' }}>
        {paginatedPayees.map((payee) => {
          const payeeName = normalizePayeeName(payee) || 'Unnamed payee';
          const busy = pendingPayeeActingId === Number(payee.id);
          const editing = pendingPayeeEditingId === Number(payee.id);
          const status = getStatusToken(payee.approval_status);
          const isPending = status === 'pending';
          const statusTheme = status === 'approved'
            ? { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
            : status === 'rejected'
              ? { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' }
              : { bg: '#fff7ed', color: '#b45309', border: '#fed7aa' };

          return (
            <div
              key={`pending-payee-${payee.id}`}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '18px 20px',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: '18px',
                boxShadow: '0 8px 22px rgba(15,23,42,0.04)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  flexShrink: 0,
                }}>
                  <CreditCard size={24} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {payeeName}
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', background: statusTheme.bg, color: statusTheme.color, border: `1px solid ${statusTheme.border}`, fontSize: '0.78rem', fontWeight: 700 }}>
                      {formatToken(status)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                      {payee.bank_name || 'No Bank'}
                    </span>
                    <span>A/C: <strong style={{ color: '#475569' }}>{payee.account_no || '-'}</strong></span>
                    <span>IFSC: <strong style={{ color: '#475569' }}>{String(payee.ifsc || '').toUpperCase() || '-'}</strong></span>
                    <span>Type: <strong style={{ color: '#475569' }}>{formatToken(payee.beneficiary_type)}</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, auto)', gap: '10px', alignContent: 'center', justifyContent: 'end' }}>
                <button
                  type="button"
                  disabled={busy || editing}
                  onClick={() => {
                    setSelectedMode('view');
                    setSelectedPayeeId(Number(payee.id));
                  }}
                  title="View"
                  aria-label="View"
                  style={{
                    width: '44px', height: '44px', borderRadius: '10px',
                    border: '1px solid #334155', background: '#f8fafc', color: '#334155', fontWeight: 600,
                    cursor: busy || editing ? 'not-allowed' : 'pointer', opacity: busy || editing ? 0.7 : 1, transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Eye size={20} />
                </button>
                <button
                  type="button"
                  disabled={busy || editing || !isPending}
                  onClick={() => {
                    setSelectedMode('edit');
                    setSelectedPayeeId(Number(payee.id));
                  }}
                  title={editing ? 'Editing' : 'Edit'}
                  aria-label={editing ? 'Editing' : 'Edit'}
                  style={{
                    width: '44px', height: '44px', borderRadius: '10px',
                    border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontWeight: 600,
                    cursor: busy || editing || !isPending ? 'not-allowed' : 'pointer', opacity: busy || editing || !isPending ? 0.7 : 1, transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Edit2 size={20} />
                </button>
                <button
                  type="button"
                  disabled={busy || editing || !isPending}
                  onClick={() => { void onPayeeDecision(Number(payee.id), 'approved'); }}
                  title="Approve"
                  aria-label="Approve"
                  style={{
                    width: '44px', height: '44px', borderRadius: '10px',
                    border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', fontWeight: 600,
                    cursor: busy || editing || !isPending ? 'not-allowed' : 'pointer', opacity: busy || editing || !isPending ? 0.7 : 1, transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 size={20} />
                </button>
                <button
                  type="button"
                  disabled={busy || editing || !isPending}
                  onClick={() => { void onPayeeDecision(Number(payee.id), 'rejected'); }}
                  title="Reject"
                  aria-label="Reject"
                  style={{
                    width: '44px', height: '44px', borderRadius: '10px',
                    border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', fontWeight: 600,
                    cursor: busy || editing || !isPending ? 'not-allowed' : 'pointer', opacity: busy || editing || !isPending ? 0.7 : 1, transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <XCircle size={20} />
                </button>
                <button
                  type="button"
                  disabled={busy || editing}
                  onClick={() => { void onPayeeDelete(Number(payee.id)); }}
                  title="Delete"
                  aria-label="Delete"
                  style={{
                    width: '44px', height: '44px', borderRadius: '10px',
                    border: '1px solid #fecaca', background: '#fff1f2', color: '#dc2626', fontWeight: 600,
                    cursor: busy || editing ? 'not-allowed' : 'pointer', opacity: busy || editing ? 0.7 : 1, transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          );
        })}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredPayees.length)} of {filteredPayees.length}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.6 : 1,
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', minWidth: '72px', textAlign: 'center' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.6 : 1,
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
      )}
      </div>

      <PayeeDetailModal
        payeeId={selectedPayeeId}
        queuePayee={selectedQueuePayee}
        apiBasePath={apiBasePath}
        initialMode={selectedMode}
        busyActionId={pendingPayeeActingId}
        busyEditId={pendingPayeeEditingId}
        onClose={() => {
          if (pendingPayeeActingId !== null || pendingPayeeEditingId !== null) return;
          setSelectedPayeeId(null);
        }}
        onSave={onPayeeEdit}
        onDecision={onPayeeDecision}
        onDelete={onPayeeDelete}
      />
    </>
  );
};

export default PendingPayeeApprovals;
