import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Edit2,
  Eye,
  LoaderCircle,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import authenticityUtility from '../../utils/authenticityUtility';
import '../../components/AddPayeeModal.css';

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

type PayeeFormDraft = PendingPayeeRecord & {
  confirm_account_no: string;
};

const BENEFICIARY_ORG_OPTIONS = ['KSRCT', 'KSREI', 'External'] as const;

const ORGANIZATION_TYPE_OPTIONS = [
  'Sole Proprietorship',
  'Partnership Firm',
  'Private Company',
  'Public Limited',
  'Trust / Society',
  'Government Entity',
];

const TDS_SECTION_OPTIONS = [
  '192 - Salary',
  '194C - Contractor / Work',
  '194J - Professional / Technical Services',
  '194H - Commission / Brokerage',
  '194I - Rent',
  '194Q - Purchase of Goods',
  '195 - Non-Resident Payments',
  'Others',
];

const INDIAN_BANK_OPTIONS = [
  'State Bank of India',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Indian Bank',
  'Bank of India',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Bank of Maharashtra',
  'Punjab & Sind Bank',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Yes Bank',
  'IDFC FIRST Bank',
  'Federal Bank',
  'South Indian Bank',
  'Karnataka Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'Dhanlaxmi Bank',
  'Tamilnad Mercantile Bank',
  'RBL Bank',
  'Bandhan Bank',
  'CSB Bank',
  'DCB Bank',
  'Nainital Bank',
  'Jammu & Kashmir Bank',
  'IDBI Bank',
  'AU Small Finance Bank',
  'Ujjivan Small Finance Bank',
  'Equitas Small Finance Bank',
  'Jana Small Finance Bank',
  'Suryoday Small Finance Bank',
  'ESAF Small Finance Bank',
  'Fincare Small Finance Bank',
  'Utkarsh Small Finance Bank',
  'North East Small Finance Bank',
  'Capital Small Finance Bank',
  'Shivalik Small Finance Bank',
  'Airtel Payments Bank',
  'India Post Payments Bank',
  'Fino Payments Bank',
  'Paytm Payments Bank',
  'NSDL Payments Bank',
  'Aditya Birla Idea Payments Bank',
  'Deutsche Bank India',
  'HSBC India',
  'Standard Chartered Bank',
  'Citibank India',
  'DBS Bank India',
  'Barclays Bank',
  'BNP Paribas India',
  'JPMorgan Chase Bank India',
  'MUFG Bank India',
  'Mizuho Bank India',
  'Bank of America N.A. India',
  'American Express Banking Corp',
  'Societe Generale India',
  'Credit Agricole CIB India',
];

interface PendingPayeeApprovalsProps {
  pendingPayees: PendingPayeeRecord[];
  pendingPayeesLoading: boolean;
  onPayeeDecision: (id: number, decision: 'approved' | 'rejected') => Promise<boolean> | boolean;
  pendingPayeeActingId: number | null;
  onPayeeEdit: (id: number, payload: PendingPayeeRecord) => Promise<boolean> | boolean;
  pendingPayeeEditingId: number | null;
  apiBasePath: string;
  onPayeeDelete: (id: number) => Promise<boolean> | boolean;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  showTopSearch?: boolean;
}

type PayeeModalMode = 'view' | 'edit';
type PayeeFilterStatus = 'all' | 'pending' | 'approved' | 'rejected';
type PayeeBeneficiaryFilter = 'all' | 'individual' | 'organization';

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
  width: 'min(760px, 100%)',
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

const normalizePayeeText = (value: unknown): string => String(value ?? '').trim();

const sanitizeUppercaseAlphaNumeric = (value: unknown, maxLength: number): string =>
  normalizePayeeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength);

const extractPanFromGstin = (value: unknown): string => {
  const gstin = sanitizeUppercaseAlphaNumeric(value, 15);
  return gstin.length >= 12 ? gstin.slice(2, 12) : '';
};

const isExactUppercaseAlphaNumeric = (value: unknown, length: number): boolean =>
  new RegExp(`^[A-Z0-9]{${length}}$`).test(normalizePayeeText(value).toUpperCase());

const capitalizeFirstLetter = (value: unknown): string => {
  const text = normalizePayeeText(value);
  if (!text) return '';
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

const isBeneficiaryOrgValue = (value: unknown): boolean =>
  BENEFICIARY_ORG_OPTIONS.some((option) => option === normalizePayeeText(value));

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
  const token = String(value || '')
    .trim()
    .toLowerCase();
  if (token === 'pending' || token === 'approved' || token === 'rejected') return token;
  return 'unknown';
};

const createDraftFromPayee = (payee: PendingPayeeRecord): PayeeFormDraft => ({
  ...payee,
  id: Number(payee.id),
  payee_name: normalizePayeeText(payee.payee_name || payee.account_name),
  account_name: normalizePayeeText(payee.account_name || payee.payee_name) || null,
  pan_number: normalizePayeeText(payee.pan_number || '').toUpperCase(),
  account_no: String(payee.account_no || '').trim(),
  account_type: payee.account_type || '',
  ifsc: String(payee.ifsc || '')
    .trim()
    .toUpperCase(),
  bank_name: String(payee.bank_name || '').trim(),
  branch_name: String(payee.branch_name || '').trim(),
  beneficiary_type:
    String(payee.beneficiary_type || 'individual')
      .trim()
      .toLowerCase() === 'organization'
      ? 'organization'
      : 'individual',
  beneficiary_org:
    normalizePayeeText(payee.beneficiary_org || '') ||
    (isBeneficiaryOrgValue(payee.payee_name) ? normalizePayeeText(payee.payee_name) : ''),
  organization_type: payee.organization_type || '',
  msme: payee.msme || '',
  gstin: payee.gstin || '',
  tds_details: payee.tds_details || '',
  tds_section: payee.tds_section || '',
  confirm_account_no: String(payee.account_no || '').trim(),
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
}> = ({
  payeeId,
  queuePayee,
  apiBasePath,
  initialMode,
  busyActionId,
  busyEditId,
  onClose,
  onSave,
  onDecision,
  onDelete,
}) => {
  const [mode, setMode] = useState<PayeeModalMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payee, setPayee] = useState<PendingPayeeRecord | null>(null);
  const [draft, setDraft] = useState<PayeeFormDraft | null>(null);

  const isOpen = Number.isInteger(payeeId) && Number(payeeId) > 0;
  const isEditing = busyEditId !== null && busyEditId === payeeId;
  const isActing = busyActionId !== null && busyActionId === payeeId;
  const busy = loading || isEditing || isActing;
  const effectivePayee = payee || queuePayee;
  const approvalStatus = String(effectivePayee?.approval_status || 'pending')
    .trim()
    .toLowerCase();
  const isPending = approvalStatus === 'pending';
  const isApproved = approvalStatus === 'approved';
  const isRejected = approvalStatus === 'rejected';
  const isOrganization =
    String(
      draft?.beneficiary_type || effectivePayee?.beneficiary_type || 'individual',
    ).toLowerCase() === 'organization';
  const formDraft = draft || (effectivePayee ? createDraftFromPayee(effectivePayee) : null);
  const isReadOnly = mode === 'view';

  const loadPayee = async (targetPayeeId: number, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = (await authenticityUtility.get(
        `${apiBasePath}/payees/${targetPayeeId}`,
      )) as {
        success?: boolean;
        status?: string;
        data?: PendingPayeeRecord;
        message?: string;
      };

      if ((response?.success === true || response?.status === 'success') && response.data) {
        setPayee(response.data);
        setDraft(createDraftFromPayee(response.data));
        setError('');
        return true;
      }

      setError(response?.message || 'Unable to load payee details.');
      return false;
    } catch (fetchError: any) {
      setError(
        fetchError?.response?.data?.message ||
          fetchError?.message ||
          'Unable to load payee details.',
      );
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

  const title = useMemo(
    () => normalizePayeeName(effectivePayee) || 'Payee Details',
    [effectivePayee],
  );

  if (!isOpen || !payeeId) return null;

  const updateDraft = (key: keyof PayeeFormDraft, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;

      if (key === 'gstin') {
        const gstin = sanitizeUppercaseAlphaNumeric(value, 15);
        const extractedPan = extractPanFromGstin(gstin);
        return {
          ...prev,
          gstin,
          ...(String(prev.beneficiary_type || '').toLowerCase() === 'organization' && extractedPan
            ? { pan_number: extractedPan }
            : {}),
        };
      }

      if (key === 'beneficiary_type') {
        const beneficiaryType = value === 'organization' ? 'organization' : 'individual';
        return {
          ...prev,
          beneficiary_type: beneficiaryType,
          ...(beneficiaryType === 'organization'
            ? {
                pan_number: extractPanFromGstin(prev.gstin) || prev.pan_number,
              }
            : {
                organization_type: '',
                msme: '',
                gstin: '',
                tds_details: '',
                tds_section: '',
              }),
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    const accountName = normalizePayeeText(draft.payee_name).toUpperCase();
    const beneficiaryOrg = normalizePayeeText(draft.beneficiary_org);
    const panNumber = sanitizeUppercaseAlphaNumeric(
      draft.pan_number || extractPanFromGstin(draft.gstin),
      10,
    );
    const ifsc = sanitizeUppercaseAlphaNumeric(draft.ifsc, 11);
    const accountNo = normalizePayeeText(draft.account_no);
    const confirmAccountNo = normalizePayeeText(draft.confirm_account_no);
    const bankName = normalizePayeeText(draft.bank_name);
    const branchName = capitalizeFirstLetter(draft.branch_name);
    const beneficiaryType =
      String(draft.beneficiary_type || 'individual').toLowerCase() === 'organization'
        ? 'organization'
        : 'individual';
    const organizationType = normalizePayeeText(draft.organization_type);
    const msme = normalizePayeeText(draft.msme);
    const gstin = sanitizeUppercaseAlphaNumeric(draft.gstin, 15);
    const tdsDetails = normalizePayeeText(draft.tds_details);
    const tdsSection = normalizePayeeText(draft.tds_section);
    const accountType = normalizePayeeText(draft.account_type);

    const missingFields: string[] = [];
    if (!beneficiaryOrg) missingFields.push('Beneficiary');
    if (!accountName) missingFields.push('Account Name');
    if (beneficiaryType === 'individual') {
      if (!panNumber) missingFields.push('PAN Number');
      else if (!isExactUppercaseAlphaNumeric(panNumber, 10))
        missingFields.push('PAN Number (must be exactly 10 uppercase alphanumeric characters)');
    } else {
      if (!organizationType) missingFields.push('Organization Type');
      if (!msme) missingFields.push('MSME');
      if (!gstin) missingFields.push('GSTIN');
      if (!panNumber) missingFields.push('PAN Number');
      else if (!isExactUppercaseAlphaNumeric(panNumber, 10))
        missingFields.push('PAN Number (must be exactly 10 uppercase alphanumeric characters)');
      if (!tdsDetails) missingFields.push('TDS Details');
      if (tdsDetails === 'Yes' && !tdsSection) missingFields.push('TDS Section');
    }
    if (!accountNo) missingFields.push('Account Number');
    if (!confirmAccountNo) missingFields.push('Re-enter Account Number');
    if (!accountType) missingFields.push('Account Type');
    if (!bankName) missingFields.push('Bank Name');
    if (!branchName) missingFields.push('Branch Name');
    if (!ifsc) missingFields.push('IFSC Code');
    else if (!isExactUppercaseAlphaNumeric(ifsc, 11))
      missingFields.push('IFSC Code (must be exactly 11 uppercase alphanumeric characters)');

    if (missingFields.length > 0) {
      setError(`Please fill all mandatory fields: ${missingFields.join(', ')}`);
      return;
    }

    if (accountNo !== confirmAccountNo) {
      setError('Account number and re-enter account number must match.');
      return;
    }

    const payload: PendingPayeeRecord = {
      ...draft,
      payee_name: accountName,
      account_name: accountName || null,
      account_no: accountNo,
      ifsc,
      bank_name: bankName,
      branch_name: branchName,
      beneficiary_type: beneficiaryType,
      beneficiary_org: beneficiaryOrg,
      organization_type: beneficiaryType === 'organization' ? organizationType : '',
      msme: beneficiaryType === 'organization' ? msme : '',
      gstin: beneficiaryType === 'organization' ? gstin : '',
      tds_details: beneficiaryType === 'organization' ? tdsDetails : '',
      tds_section:
        beneficiaryType === 'organization' ? (tdsDetails === 'Yes' ? tdsSection : '') : '',
      pan_number: panNumber,
      account_type: accountType,
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
    <div
      style={overlayStyle}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div style={modalStyle}>
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '1.08rem', fontWeight: 700, color: '#0f172a' }}>{title}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
              {mode === 'edit'
                ? 'Update payee details before approval.'
                : 'Review the full payee record before taking action.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div
            style={{
              padding: '36px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#475569',
            }}
          >
            <LoaderCircle size={20} className="spin" />
            Loading payee details...
          </div>
        ) : error ? (
          <div style={{ padding: '24px 22px', color: '#b91c1c', fontSize: '0.95rem' }}>{error}</div>
        ) : mode === 'edit' && draft ? (
          <div style={{ padding: '22px', display: 'grid', gap: '16px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <label style={labelStyle}>Payee Name</label>
                <input
                  style={inputStyle}
                  value={draft.payee_name || ''}
                  onChange={(e) => updateDraft('payee_name', e.target.value)}
                />
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
                <input
                  style={inputStyle}
                  value={draft.account_no || ''}
                  onChange={(e) => updateDraft('account_no', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>IFSC</label>
                <input
                  style={inputStyle}
                  value={draft.ifsc || ''}
                  onChange={(e) => updateDraft('ifsc', e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label style={labelStyle}>Bank Name</label>
                <input
                  style={inputStyle}
                  value={draft.bank_name || ''}
                  onChange={(e) => updateDraft('bank_name', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Branch Name</label>
                <input
                  style={inputStyle}
                  value={draft.branch_name || ''}
                  onChange={(e) => updateDraft('branch_name', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Account Type *</label>
                <select
                  style={inputStyle}
                  value={draft.account_type || ''}
                  onChange={(e) => updateDraft('account_type', e.target.value)}
                >
                  <option value="">Select Account Type</option>
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>PAN Number</label>
                <input
                  style={inputStyle}
                  value={draft.pan_number || ''}
                  onChange={(e) => updateDraft('pan_number', e.target.value)}
                />
              </div>
            </div>

            {isOrganization ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                <div>
                  <label style={labelStyle}>Beneficiary Org *</label>
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
                  <input
                    style={inputStyle}
                    value={draft.organization_type || ''}
                    onChange={(e) => updateDraft('organization_type', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>MSME</label>
                  <input
                    style={inputStyle}
                    value={draft.msme || ''}
                    onChange={(e) => updateDraft('msme', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>GSTIN</label>
                  <input
                    style={inputStyle}
                    value={draft.gstin || ''}
                    onChange={(e) => updateDraft('gstin', e.target.value)}
                    maxLength={15}
                  />
                </div>
                <div>
                  <label style={labelStyle}>TDS Details</label>
                  <input
                    style={inputStyle}
                    value={draft.tds_details || ''}
                    onChange={(e) => updateDraft('tds_details', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>TDS Section</label>
                  <input
                    style={inputStyle}
                    value={draft.tds_section || ''}
                    onChange={(e) => updateDraft('tds_section', e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : effectivePayee ? (
          <div style={{ padding: '22px', display: 'grid', gap: '22px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '18px',
              }}
            >
              <PayeeDetailField label="Payee Name" value={normalizePayeeName(effectivePayee)} />
              <PayeeDetailField label="Account Name" value={effectivePayee.account_name} />
              <PayeeDetailField label="PAN Number" value={effectivePayee.pan_number} />
              <PayeeDetailField label="Account Number" value={effectivePayee.account_no} />
              <PayeeDetailField label="Account Type" value={effectivePayee.account_type} />
              <PayeeDetailField label="Bank Name" value={effectivePayee.bank_name} />
              <PayeeDetailField label="Branch Name" value={effectivePayee.branch_name} />
              <PayeeDetailField
                label="IFSC"
                value={String(effectivePayee.ifsc || '').toUpperCase()}
              />
              <PayeeDetailField
                label="Beneficiary Type"
                value={formatToken(effectivePayee.beneficiary_type)}
              />
              {String(effectivePayee.beneficiary_type || '')
                .trim()
                .toLowerCase() === 'organization' ? (
                <>
                  <PayeeDetailField
                    label="Beneficiary Org"
                    value={effectivePayee.beneficiary_org}
                  />
                  <PayeeDetailField
                    label="Organization Type"
                    value={effectivePayee.organization_type}
                  />
                  <PayeeDetailField label="MSME" value={effectivePayee.msme} />
                  <PayeeDetailField label="GSTIN" value={effectivePayee.gstin} />
                  <PayeeDetailField label="TDS Details" value={effectivePayee.tds_details} />
                  <PayeeDetailField label="TDS Section" value={effectivePayee.tds_section} />
                </>
              ) : null}
              <PayeeDetailField
                label="Approval Status"
                value={formatToken(effectivePayee.approval_status)}
              />
              {isRejected ? (
                <PayeeDetailField
                  label="Rejection Reason"
                  value={effectivePayee.rejection_reason}
                />
              ) : null}
              <PayeeDetailField
                label="Requested At"
                value={formatDateTime(effectivePayee.requested_at)}
              />
              {isApproved ? (
                <PayeeDetailField
                  label="Approved At"
                  value={formatDateTime(effectivePayee.approved_at)}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          style={{
            padding: '18px 22px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {mode === 'view' ? (
              <button
                type="button"
                onClick={() => setMode('edit')}
                disabled={busy || !effectivePayee}
                style={{
                  border: '1px solid #2563eb',
                  background: '#eff6ff',
                  color: '#2563eb',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  cursor: busy || !effectivePayee ? 'not-allowed' : 'pointer',
                  opacity: busy || !effectivePayee ? 0.7 : 1,
                }}
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
                style={{
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel Edit
              </button>
            )}
            {isPending && mode === 'view' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void handleDecision('approved');
                  }}
                  disabled={busy}
                  style={{
                    border: '1px solid #16a34a',
                    background: '#f0fdf4',
                    color: '#16a34a',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  {isActing ? 'Working...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDecision('rejected');
                  }}
                  disabled={busy}
                  style={{
                    border: '1px solid #dc2626',
                    background: '#fef2f2',
                    color: '#dc2626',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  {isActing ? 'Working...' : 'Reject'}
                </button>
              </>
            ) : null}
            {mode === 'view' ? (
              <button
                type="button"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={busy}
                style={{
                  border: '1px solid #fecaca',
                  background: '#fff1f2',
                  color: '#dc2626',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.7 : 1,
                }}
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
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                borderRadius: '10px',
                padding: '10px 16px',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Close
            </button>
            {mode === 'edit' ? (
              <button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={busy}
                style={{
                  border: '1px solid #0f766e',
                  background: '#0f766e',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.7 : 1,
                }}
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

const PayeeFormModal: React.FC<{
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
}> = ({
  payeeId,
  queuePayee,
  apiBasePath,
  initialMode,
  busyActionId,
  busyEditId,
  onClose,
  onSave,
  onDecision,
  onDelete,
}) => {
  const [mode, setMode] = useState<PayeeModalMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payee, setPayee] = useState<PendingPayeeRecord | null>(null);
  const [draft, setDraft] = useState<PayeeFormDraft | null>(null);
  const [originalDraft, setOriginalDraft] = useState<PayeeFormDraft | null>(null);

  const isOpen = Number.isInteger(payeeId) && Number(payeeId) > 0;
  const isEditing = busyEditId !== null && busyEditId === payeeId;
  const isActing = busyActionId !== null && busyActionId === payeeId;
  const busy = loading || isEditing || isActing;
  const effectivePayee = payee || queuePayee;
  const approvalStatus = String(effectivePayee?.approval_status || 'pending')
    .trim()
    .toLowerCase();
  const isPending = approvalStatus === 'pending';
  const isApproved = approvalStatus === 'approved';
  const isRejected = approvalStatus === 'rejected';
  const isReadOnly = mode === 'view';
  const formDraft = draft || (effectivePayee ? createDraftFromPayee(effectivePayee) : null);
  const beneficiaryType =
    String(formDraft?.beneficiary_type || 'individual')
      .trim()
      .toLowerCase() === 'organization'
      ? 'organization'
      : 'individual';

  const loadPayee = async (targetPayeeId: number, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = (await authenticityUtility.get(
        `${apiBasePath}/payees/${targetPayeeId}`,
      )) as {
        success?: boolean;
        status?: string;
        data?: PendingPayeeRecord;
        message?: string;
      };

      if ((response?.success === true || response?.status === 'success') && response.data) {
        setPayee(response.data);
        const nextDraft = createDraftFromPayee(response.data);
        setDraft(nextDraft);
        setOriginalDraft(nextDraft);
        setError('');
        return true;
      }

      setError(response?.message || 'Unable to load payee details.');
      return false;
    } catch (fetchError: any) {
      setError(
        fetchError?.response?.data?.message ||
          fetchError?.message ||
          'Unable to load payee details.',
      );
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
      setOriginalDraft(null);
      return;
    }

    setMode(initialMode);
    setError('');
    if (queuePayee) {
      setPayee(queuePayee);
      const nextDraft = createDraftFromPayee(queuePayee);
      setDraft(nextDraft);
      setOriginalDraft(nextDraft);
    } else {
      setPayee(null);
      setDraft(null);
      setOriginalDraft(null);
    }

    let cancelled = false;
    void (async () => {
      const success = await loadPayee(payeeId);
      if (cancelled && success) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBasePath, initialMode, payeeId]);

  const title = useMemo(
    () => normalizePayeeName(effectivePayee) || 'Payee Details',
    [effectivePayee],
  );

  if (!isOpen || !payeeId) return null;

  const updateDraft = (key: keyof PayeeFormDraft, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;

      if (key === 'gstin') {
        const gstin = sanitizeUppercaseAlphaNumeric(value, 15);
        const extractedPan = extractPanFromGstin(gstin);
        return {
          ...prev,
          gstin,
          ...(String(prev.beneficiary_type || '').toLowerCase() === 'organization' && extractedPan
            ? { pan_number: extractedPan }
            : {}),
        };
      }

      if (key === 'beneficiary_type') {
        const beneficiaryType = value === 'organization' ? 'organization' : 'individual';
        return {
          ...prev,
          beneficiary_type: beneficiaryType,
          ...(beneficiaryType === 'organization'
            ? {
                pan_number: extractPanFromGstin(prev.gstin) || prev.pan_number,
              }
            : {
                organization_type: '',
                msme: '',
                gstin: '',
                tds_details: '',
                tds_section: '',
              }),
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const resetToView = () => {
    setDraft(effectivePayee ? createDraftFromPayee(effectivePayee) : null);
    setOriginalDraft(effectivePayee ? createDraftFromPayee(effectivePayee) : null);
    setMode('view');
    setError('');
  };

  const handleSave = async () => {
    if (!draft) return;

    const original = originalDraft || createDraftFromPayee(effectivePayee || draft);
    const accountName = normalizePayeeText(draft.payee_name).toUpperCase();
    const beneficiaryOrg =
      normalizePayeeText(draft.beneficiary_org) || normalizePayeeText(original.beneficiary_org);
    const originalPan = normalizePayeeText(original.pan_number).toUpperCase();
    const originalIfsc = normalizePayeeText(original.ifsc).toUpperCase();
    const panNumber = sanitizeUppercaseAlphaNumeric(
      draft.pan_number || extractPanFromGstin(draft.gstin),
      10,
    );
    const ifsc = sanitizeUppercaseAlphaNumeric(draft.ifsc, 11);
    const originalPanChanged = panNumber !== sanitizeUppercaseAlphaNumeric(originalPan, 10);
    const originalIfscChanged = ifsc !== sanitizeUppercaseAlphaNumeric(originalIfsc, 11);
    const accountNo = normalizePayeeText(draft.account_no);
    const confirmAccountNo = normalizePayeeText(draft.confirm_account_no);
    const bankName = normalizePayeeText(draft.bank_name);
    const branchName = capitalizeFirstLetter(draft.branch_name);
    const organizationType = normalizePayeeText(draft.organization_type);
    const msme = normalizePayeeText(draft.msme);
    const gstin = sanitizeUppercaseAlphaNumeric(draft.gstin, 15);
    const tdsDetails = normalizePayeeText(draft.tds_details);
    const tdsSection = normalizePayeeText(draft.tds_section);
    const accountType = normalizePayeeText(draft.account_type);

    const missingFields: string[] = [];
    if (!beneficiaryOrg) missingFields.push('Beneficiary');
    if (!accountName) missingFields.push('Account Name');
    if (beneficiaryType === 'organization') {
      if (!organizationType) missingFields.push('Organization Type');
      if (!msme) missingFields.push('MSME');
      if (!gstin) missingFields.push('GSTIN');
      if (!tdsDetails) missingFields.push('TDS Details');
      if (tdsDetails === 'Yes' && !tdsSection) missingFields.push('TDS Section');
    }
    if (!accountNo) missingFields.push('Account Number');
    if (!confirmAccountNo) missingFields.push('Re-enter Account Number');
    if (!accountType) missingFields.push('Account Type');
    if (!bankName) missingFields.push('Bank Name');
    if (!branchName) missingFields.push('Branch Name');
    if (!ifsc) missingFields.push('IFSC Code');
    else if (originalIfscChanged && !isExactUppercaseAlphaNumeric(ifsc, 11))
      missingFields.push('IFSC Code (must be exactly 11 uppercase alphanumeric characters)');
    if ((beneficiaryType === 'individual' || beneficiaryType === 'organization') && !panNumber)
      missingFields.push('PAN Number');
    else if (originalPanChanged && !isExactUppercaseAlphaNumeric(panNumber, 10))
      missingFields.push('PAN Number (must be exactly 10 uppercase alphanumeric characters)');

    if (missingFields.length > 0) {
      setError(`Please fill all mandatory fields: ${missingFields.join(', ')}`);
      return;
    }

    if (accountNo !== confirmAccountNo) {
      setError('Account number and re-enter account number must match.');
      return;
    }

    const payload: PendingPayeeRecord = {
      ...draft,
      payee_name: accountName,
      account_name: accountName || null,
      account_no: accountNo,
      ifsc,
      bank_name: bankName,
      branch_name: branchName,
      beneficiary_type: beneficiaryType,
      beneficiary_org: beneficiaryOrg,
      organization_type: beneficiaryType === 'organization' ? organizationType : '',
      msme: beneficiaryType === 'organization' ? msme : '',
      gstin: beneficiaryType === 'organization' ? gstin : '',
      tds_details: beneficiaryType === 'organization' ? tdsDetails : '',
      tds_section:
        beneficiaryType === 'organization' ? (tdsDetails === 'Yes' ? tdsSection : '') : '',
      pan_number: panNumber,
      account_type: accountType,
    };

    const updated = await onSave(payeeId, payload);
    if (!updated) {
      setError('Unable to save payee details. Please check the highlighted fields and try again.');
      return;
    }
    const refreshed = createDraftFromPayee({ ...payload, id: payeeId });
    setPayee({ ...payload, id: payeeId });
    setDraft(refreshed);
    setOriginalDraft(refreshed);
    void loadPayee(payeeId, { silent: true });
    setError('');
    setMode('view');
    onClose();
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
    <div
      style={overlayStyle}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div style={modalStyle} role="dialog" aria-modal="true" aria-label={title}>
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '1.08rem', fontWeight: 700, color: '#0f172a' }}>{title}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
              {isReadOnly
                ? 'Review the full payee record before taking action.'
                : 'Update payee details before approval.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
            aria-label="Close payee details"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div
            style={{
              padding: '36px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#475569',
            }}
          >
            <LoaderCircle size={20} className="spin" />
            Loading payee details...
          </div>
        ) : formDraft ? (
          <>
            {error ? (
              <div
                style={{
                  padding: '14px 22px 0',
                  color: '#b91c1c',
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            ) : null}
            <div className="add-payee-modal-content" style={{ padding: '18px 34px 14px' }}>
              <div className="payee-modal-toggle">
                <button
                  type="button"
                  onClick={() => !isReadOnly && updateDraft('beneficiary_type', 'individual')}
                  className={`payee-modal-toggle-btn ${beneficiaryType === 'individual' ? 'active' : ''}`}
                  disabled={busy || isReadOnly}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => !isReadOnly && updateDraft('beneficiary_type', 'organization')}
                  className={`payee-modal-toggle-btn ${beneficiaryType === 'organization' ? 'active' : ''}`}
                  disabled={busy || isReadOnly}
                >
                  Organization
                </button>
              </div>

              <div className="add-payee-modal-section">
                <div className="add-payee-modal-row">
                  <label>Beneficiary *</label>
                  <div className="add-payee-modal-radio-group">
                    {BENEFICIARY_ORG_OPTIONS.map((option) => (
                      <label key={option} className="add-payee-modal-radio">
                        <input
                          type="radio"
                          name="beneficiaryOrg"
                          value={option}
                          checked={String(formDraft.beneficiary_org || '') === option}
                          onChange={() => !isReadOnly && updateDraft('beneficiary_org', option)}
                          disabled={busy || isReadOnly}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="add-payee-modal-row">
                  <label>Account Name</label>
                  <input
                    className="payee-modal-field-input"
                    type="text"
                    value={String(formDraft.payee_name || '')}
                    onChange={(event) =>
                      !isReadOnly && updateDraft('payee_name', event.target.value.toUpperCase())
                    }
                    placeholder="Enter Account name"
                    readOnly={isReadOnly}
                    disabled={busy}
                  />
                </div>

                <div className="add-payee-modal-row">
                  <label>PAN Number</label>
                  <input
                    className="payee-modal-field-input"
                    type="text"
                    value={String(formDraft.pan_number || '')}
                    onChange={(event) =>
                      !isReadOnly &&
                      updateDraft(
                        'pan_number',
                        sanitizeUppercaseAlphaNumeric(event.target.value, 10),
                      )
                    }
                    placeholder="Enter PAN number"
                    maxLength={10}
                    minLength={10}
                    pattern="[A-Z0-9]{10}"
                    readOnly={isReadOnly}
                    disabled={busy}
                  />
                </div>

                {beneficiaryType === 'organization' && (
                  <>
                    <div className="add-payee-modal-row">
                      <label>Organization Type</label>
                      <select
                        className="payee-modal-field-input"
                        value={String(formDraft.organization_type || '')}
                        onChange={(event) =>
                          !isReadOnly && updateDraft('organization_type', event.target.value)
                        }
                        disabled={busy || isReadOnly}
                      >
                        <option value="">Select Organization Type</option>
                        {ORGANIZATION_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="add-payee-modal-row">
                      <label>MSME</label>
                      <div className="add-payee-modal-radio-group">
                        <label className="add-payee-modal-radio">
                          <input
                            type="radio"
                            name="msme"
                            value="Yes"
                            checked={String(formDraft.msme || '') === 'Yes'}
                            onChange={(event) =>
                              !isReadOnly && updateDraft('msme', event.target.value)
                            }
                            disabled={busy || isReadOnly}
                          />
                          <span>Yes</span>
                        </label>
                        <label className="add-payee-modal-radio">
                          <input
                            type="radio"
                            name="msme"
                            value="No"
                            checked={String(formDraft.msme || '') === 'No'}
                            onChange={(event) =>
                              !isReadOnly && updateDraft('msme', event.target.value)
                            }
                            disabled={busy || isReadOnly}
                          />
                          <span>No</span>
                        </label>
                      </div>
                    </div>

                    <div className="add-payee-modal-row">
                      <label>GSTIN</label>
                      <input
                        className="payee-modal-field-input"
                        type="text"
                        value={String(formDraft.gstin || '')}
                        onChange={(event) =>
                          !isReadOnly && updateDraft('gstin', event.target.value.toUpperCase())
                        }
                        placeholder="Enter GSTIN"
                        maxLength={15}
                        readOnly={isReadOnly}
                        disabled={busy}
                      />
                    </div>

                    <div className="add-payee-modal-row">
                      <label>PAN Number</label>
                      <input
                        className="payee-modal-field-input"
                        type="text"
                        value={String(formDraft.pan_number || '')}
                        onChange={(event) =>
                          !isReadOnly &&
                          updateDraft(
                            'pan_number',
                            sanitizeUppercaseAlphaNumeric(event.target.value, 10),
                          )
                        }
                        placeholder="Enter PAN number"
                        maxLength={10}
                        minLength={10}
                        pattern="[A-Z0-9]{10}"
                        readOnly={isReadOnly}
                        disabled={busy}
                      />
                    </div>

                    <div className="add-payee-modal-row add-payee-modal-row--tds">
                      <label>TDS Details</label>
                      <div className="add-payee-modal-radio-group add-payee-modal-tds-control">
                        <label className="add-payee-modal-radio">
                          <input
                            type="radio"
                            name="tds"
                            value="Yes"
                            checked={String(formDraft.tds_details || '') === 'Yes'}
                            onChange={(event) =>
                              !isReadOnly && updateDraft('tds_details', event.target.value)
                            }
                            disabled={busy || isReadOnly}
                          />
                          <span>Yes</span>
                        </label>
                        <label className="add-payee-modal-radio">
                          <input
                            type="radio"
                            name="tds"
                            value="No"
                            checked={String(formDraft.tds_details || '') === 'No'}
                            onChange={(event) =>
                              !isReadOnly && updateDraft('tds_details', event.target.value)
                            }
                            disabled={busy || isReadOnly}
                          />
                          <span>No</span>
                        </label>
                        <div
                          className={`add-payee-modal-tds-section ${String(formDraft.tds_details || '') === 'Yes' ? 'visible' : ''}`}
                        >
                          <select
                            className="payee-modal-field-input"
                            value={String(formDraft.tds_section || '')}
                            onChange={(event) =>
                              !isReadOnly && updateDraft('tds_section', event.target.value)
                            }
                            disabled={
                              busy || isReadOnly || String(formDraft.tds_details || '') !== 'Yes'
                            }
                          >
                            <option value="">Select TDS Section</option>
                            {TDS_SECTION_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="add-payee-modal-section add-payee-modal-section--bank">
                <div className="add-payee-modal-row">
                  <label>Account Number</label>
                  <input
                    className="payee-modal-field-input"
                    type="text"
                    value={String(formDraft.account_no || '')}
                    onChange={(event) =>
                      !isReadOnly && updateDraft('account_no', event.target.value)
                    }
                    placeholder="Enter account number"
                    inputMode="numeric"
                    readOnly={isReadOnly}
                    disabled={busy}
                  />
                </div>
                <div className="add-payee-modal-row">
                  <label>Re-enter Account No</label>
                  <div className="payee-modal-confirm-field">
                    <input
                      className={`payee-modal-field-input ${!isReadOnly && formDraft.confirm_account_no && formDraft.account_no && formDraft.confirm_account_no !== formDraft.account_no ? 'is-invalid' : ''}`}
                      type="password"
                      value={String(formDraft.confirm_account_no || '')}
                      onChange={(event) =>
                        !isReadOnly && updateDraft('confirm_account_no', event.target.value)
                      }
                      onPaste={(event) => !isReadOnly && event.preventDefault()}
                      onDrop={(event) => !isReadOnly && event.preventDefault()}
                      placeholder="Re-enter account number"
                      inputMode="numeric"
                      readOnly={isReadOnly}
                      disabled={busy}
                    />
                    {!isReadOnly &&
                      formDraft.confirm_account_no &&
                      formDraft.account_no &&
                      formDraft.confirm_account_no === formDraft.account_no && (
                        <CheckCircle2
                          className="payee-modal-confirm-icon"
                          size={18}
                          aria-hidden="true"
                        />
                      )}
                  </div>
                </div>
                {!isReadOnly &&
                  formDraft.confirm_account_no &&
                  formDraft.account_no &&
                  formDraft.confirm_account_no !== formDraft.account_no && (
                    <div className="add-payee-modal-row add-payee-modal-row--helper">
                      <span className="add-payee-modal-helper-text add-payee-modal-helper-text--error">
                        Account numbers do not match
                      </span>
                    </div>
                  )}
                <div className="add-payee-modal-row">
                  <label>Account Type *</label>
                  <div className="add-payee-modal-radio-group">
                    <label className="add-payee-modal-radio">
                      <input
                        type="radio"
                        name="accountType"
                        value="Savings"
                        checked={String(formDraft.account_type || '') === 'Savings'}
                        onChange={() => !isReadOnly && updateDraft('account_type', 'Savings')}
                        disabled={busy || isReadOnly}
                      />
                      <span>Savings</span>
                    </label>
                    <label className="add-payee-modal-radio">
                      <input
                        type="radio"
                        name="accountType"
                        value="Current"
                        checked={String(formDraft.account_type || '') === 'Current'}
                        onChange={() => !isReadOnly && updateDraft('account_type', 'Current')}
                        disabled={busy || isReadOnly}
                      />
                      <span>Current</span>
                    </label>
                  </div>
                </div>
                <div className="add-payee-modal-row">
                  <label>Bank Name</label>
                  <select
                    className="payee-modal-field-input"
                    value={String(formDraft.bank_name || '')}
                    onChange={(event) =>
                      !isReadOnly && updateDraft('bank_name', event.target.value)
                    }
                    disabled={busy || isReadOnly}
                  >
                    <option value="">Select bank name</option>
                    {INDIAN_BANK_OPTIONS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="add-payee-modal-row">
                  <label>Branch Name</label>
                  <input
                    className="payee-modal-field-input"
                    type="text"
                    value={capitalizeFirstLetter(formDraft.branch_name)}
                    onChange={(event) =>
                      !isReadOnly &&
                      updateDraft('branch_name', capitalizeFirstLetter(event.target.value))
                    }
                    placeholder="Enter branch name"
                    readOnly={isReadOnly}
                    disabled={busy}
                  />
                </div>
                <div className="add-payee-modal-row">
                  <label>IFSC Code</label>
                  <input
                    className="payee-modal-field-input"
                    type="text"
                    value={String(formDraft.ifsc || '')}
                    onChange={(event) =>
                      !isReadOnly &&
                      updateDraft('ifsc', sanitizeUppercaseAlphaNumeric(event.target.value, 11))
                    }
                    placeholder="Enter IFSC code"
                    maxLength={11}
                    minLength={11}
                    pattern="[A-Z0-9]{11}"
                    readOnly={isReadOnly}
                    disabled={busy}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <PayeeDetailField
                    label="Approval Status"
                    value={formatToken(formDraft.approval_status)}
                  />
                  <PayeeDetailField
                    label="Requested At"
                    value={formatDateTime(formDraft.requested_at)}
                  />
                  {isApproved ? (
                    <PayeeDetailField
                      label="Approved At"
                      value={formatDateTime(formDraft.approved_at)}
                    />
                  ) : null}
                  {isRejected ? (
                    <PayeeDetailField label="Rejection Reason" value={formDraft.rejection_reason} />
                  ) : null}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '18px 22px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {mode === 'view' ? (
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    disabled={busy || !formDraft}
                    style={{
                      border: '1px solid #2563eb',
                      background: '#eff6ff',
                      color: '#2563eb',
                      borderRadius: '10px',
                      padding: '10px 16px',
                      cursor: busy || !formDraft ? 'not-allowed' : 'pointer',
                      opacity: busy || !formDraft ? 0.7 : 1,
                    }}
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resetToView}
                    disabled={busy}
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#334155',
                      borderRadius: '10px',
                      padding: '10px 16px',
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
                {isPending && mode === 'view' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDecision('approved');
                      }}
                      disabled={busy}
                      style={{
                        border: '1px solid #16a34a',
                        background: '#f0fdf4',
                        color: '#16a34a',
                        borderRadius: '10px',
                        padding: '10px 16px',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      {isActing ? 'Working...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDecision('rejected');
                      }}
                      disabled={busy}
                      style={{
                        border: '1px solid #dc2626',
                        background: '#fef2f2',
                        color: '#dc2626',
                        borderRadius: '10px',
                        padding: '10px 16px',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      {isActing ? 'Working...' : 'Reject'}
                    </button>
                  </>
                ) : null}
                {mode === 'view' ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete();
                    }}
                    disabled={busy}
                    style={{
                      border: '1px solid #fecaca',
                      background: '#fff1f2',
                      color: '#dc2626',
                      borderRadius: '10px',
                      padding: '10px 16px',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      opacity: busy ? 0.7 : 1,
                    }}
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
                  style={{
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  Close
                </button>
                {mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleSave();
                    }}
                    disabled={busy}
                    style={{
                      border: '1px solid #0f766e',
                      background: '#0f766e',
                      color: '#fff',
                      borderRadius: '10px',
                      padding: '10px 16px',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      opacity: busy ? 0.7 : 1,
                    }}
                  >
                    {isEditing ? 'Saving...' : 'Save'}
                  </button>
                ) : null}
              </div>
            </div>
          </>
        ) : error ? (
          <div style={{ padding: '24px 22px', color: '#b91c1c', fontSize: '0.95rem' }}>{error}</div>
        ) : null}
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
  searchTerm: externalSearchTerm,
  onSearchTermChange,
  showTopSearch = true,
}) => {
  const [selectedPayeeId, setSelectedPayeeId] = useState<number | null>(null);
  const [selectedMode, setSelectedMode] = useState<PayeeModalMode>('view');
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = externalSearchTerm ?? internalSearchTerm;
  const setSearchTerm = (value: string) => {
    if (onSearchTermChange) onSearchTermChange(value);
    else setInternalSearchTerm(value);
  };
  const [statusFilter, setStatusFilter] = useState<PayeeFilterStatus>('all');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<PayeeBeneficiaryFilter>('all');
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
      const beneficiaryType = String(payee.beneficiary_type || '')
        .trim()
        .toLowerCase();
      if (beneficiaryFilter !== 'all' && beneficiaryType !== beneficiaryFilter) return false;
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
  }, [pendingPayees, searchTerm, statusFilter, beneficiaryFilter]);

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
  }, [searchTerm, statusFilter, beneficiaryFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (pendingPayeesLoading) {
    return <div className="fw-state fw-payee-state-compact">Loading payees...</div>;
  }

  if (pendingPayees.length === 0) {
    return (
      <div className="fw-state fw-payee-empty">
        <CreditCard size={48} className="fw-payee-empty-icon" />
        <h4 className="fw-payee-empty-title">No payees found</h4>
        <p className="fw-payee-empty-copy">
          There are no active payees available in this management view.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="fw-payee-panel">
        {showTopSearch && (
          <div className="fw-payee-topsearch">
            <div className="fw-payee-search">
              <Search size={16} className="fw-payee-search-icon" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search payee..."
                className="fw-control fw-payee-search-input"
              />
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gap: '14px' }}>
          <div className="fw-payee-head">
            <div className="fw-payee-title">Payee Management</div>
          </div>
          <div className="fw-payee-stats">
            {[
              {
                key: 'all',
                label: 'All',
                value: statusCounts.all,
                icon: CreditCard,
                tone: '#1d4ed8',
                bg: '#eff6ff',
              },
              {
                key: 'pending',
                label: 'Pending',
                value: statusCounts.pending,
                icon: Clock3,
                tone: '#b45309',
                bg: '#fff7ed',
              },
              {
                key: 'approved',
                label: 'Approved',
                value: statusCounts.approved,
                icon: CheckCircle2,
                tone: '#15803d',
                bg: '#f0fdf4',
              },
              {
                key: 'rejected',
                label: 'Rejected',
                value: statusCounts.rejected,
                icon: XCircle,
                tone: '#b91c1c',
                bg: '#fef2f2',
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = statusFilter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStatusFilter(item.key as PayeeFilterStatus)}
                  className={`fw-stats-card fw-payee-stats-card ${item.key} ${active ? 'active' : ''}`}
                >
                  <div className="fw-payee-stats-row">
                    <div className="fw-stats-icon">
                      <Icon size={22} />
                    </div>
                    <div className="fw-stats-text">
                      <div className="fw-stats-label">{item.label}</div>
                      <div className="fw-stats-number">{item.value}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fw-payee-toolbar">
          <div className="fw-payee-count">
            {statusFilter === 'all' ? 'All payees' : `${formatToken(statusFilter)} payees`} -{' '}
            {filteredPayees.length} record{filteredPayees.length === 1 ? '' : 's'}
          </div>
          <select
            className="fw-control fw-payee-type-filter"
            value={beneficiaryFilter}
            onChange={(e) => setBeneficiaryFilter(e.target.value as PayeeBeneficiaryFilter)}
            aria-label="Filter payee by beneficiary type"
          >
            <option value="all">All Types</option>
            <option value="individual">Individual</option>
            <option value="organization">Organization</option>
          </select>
        </div>

        {filteredPayees.length === 0 ? (
          <div className="fw-state fw-payee-empty">
            <CreditCard size={48} className="fw-payee-empty-icon" />
            <h4 className="fw-payee-empty-title">No matching payees</h4>
            <p className="fw-payee-empty-copy">Try another search or status filter.</p>
          </div>
        ) : (
          <div className="fw-cards-container fw-payee-list">
            {paginatedPayees.map((payee) => {
              const payeeName = normalizePayeeName(payee) || 'Unnamed payee';
              const busy = pendingPayeeActingId === Number(payee.id);
              const editing = pendingPayeeEditingId === Number(payee.id);
              const status = getStatusToken(payee.approval_status);
              const isPending = status === 'pending';
              const statusTheme =
                status === 'approved'
                  ? { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
                  : status === 'rejected'
                    ? { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' }
                    : { bg: '#fff7ed', color: '#b45309', border: '#fed7aa' };

              return (
                <div
                  key={`pending-payee-${payee.id}`}
                  className="fw-item fw-payee-item"
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
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
                      }}
                    >
                      <CreditCard size={24} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap',
                          marginBottom: '6px',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            color: '#0f172a',
                            fontSize: '1.05rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {payeeName}
                        </div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: statusTheme.bg,
                            color: statusTheme.color,
                            border: `1px solid ${statusTheme.border}`,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                          }}
                        >
                          {formatToken(status)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.85rem',
                          color: '#64748b',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                          }}
                        >
                          {payee.bank_name || 'No Bank'}
                        </span>
                        <span>
                          A/C:{' '}
                          <strong style={{ color: '#475569' }}>{payee.account_no || '-'}</strong>
                        </span>
                        <span>
                          IFSC:{' '}
                          <strong style={{ color: '#475569' }}>
                            {String(payee.ifsc || '').toUpperCase() || '-'}
                          </strong>
                        </span>
                        <span>
                          Type:{' '}
                          <strong style={{ color: '#475569' }}>
                            {formatToken(payee.beneficiary_type)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="fw-payee-action-buttons">
                    <button
                      type="button"
                      disabled={busy || editing}
                      onClick={() => {
                        setSelectedMode('view');
                        setSelectedPayeeId(Number(payee.id));
                      }}
                      title="View"
                      aria-label="View"
                      className="fw-payee-action-btn fw-payee-action-btn--view"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      type="button"
                      disabled={busy || editing}
                      onClick={() => {
                        setSelectedMode('edit');
                        setSelectedPayeeId(Number(payee.id));
                      }}
                      title={editing ? 'Editing' : 'Edit'}
                      aria-label={editing ? 'Editing' : 'Edit'}
                      className="fw-payee-action-btn fw-payee-action-btn--edit"
                    >
                      <Edit2 size={20} />
                    </button>
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          disabled={busy || editing}
                          onClick={() => {
                            void onPayeeDecision(Number(payee.id), 'approved');
                          }}
                          title="Approve"
                          aria-label="Approve"
                          className="fw-payee-action-btn fw-payee-action-btn--approve"
                        >
                          <CheckCircle2 size={20} />
                        </button>
                        <button
                          type="button"
                          disabled={busy || editing}
                          onClick={() => {
                            void onPayeeDecision(Number(payee.id), 'rejected');
                          }}
                          title="Reject"
                          aria-label="Reject"
                          className="fw-payee-action-btn fw-payee-action-btn--reject"
                        >
                          <XCircle size={20} />
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy || editing}
                      onClick={() => {
                        void onPayeeDelete(Number(payee.id));
                      }}
                      title="Delete"
                      aria-label="Delete"
                      className="fw-payee-action-btn fw-payee-action-btn--delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredPayees.length)} of{' '}
                  {filteredPayees.length}
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
                  <span
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#334155',
                      minWidth: '72px',
                      textAlign: 'center',
                    }}
                  >
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

      <PayeeFormModal
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
