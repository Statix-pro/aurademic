import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Info,
  Plus,
  X,
  Upload,
  Eye,
  Trash2,
  Download,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Archive,
} from 'lucide-react';
import React, {
  useState,
  useRef,
  CSSProperties,
  useEffect,
  ChangeEvent,
  MouseEvent,
  Fragment,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import 'bootstrap/dist/css/bootstrap.min.css';

import './expenditureapproval.css';
import { useAuth } from '../../contexts/AuthContext';
import KSRCTLogo from '../../shared/assets/images/ksrct_logo.png';
import AddPayeeModal, { AddPayeeModalPayee } from '../../shared/components/AddPayeeModal';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import CustomDropdown, { OptionType } from '../../shared/components/ui/CustomDropdown';
import CustomModal from '../../shared/components/ui/CustomModal';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
import CustomToggle from '../../shared/components/ui/CustomToggle';
import {
  BUDGET_HEAD_GROUPS,
  SUB_HEAD_BY_BUDGET_HEAD,
  subscribeBudgetCatalog,
} from '../../shared/hooks/budgetCatalogStore';
import { useBudgetCatalog } from '../../shared/hooks/useBudgetCatalog';
import { AccountOption, fetchAccountOptions } from '../../shared/utils/accountOptionsApi';
import authenticityUtility from '../../shared/utils/authenticityUtility';

interface SelectOption {
  value: string;
  label: string;
}
interface BudgetRow {
  category: string;
  head: string;
  amount: string;
}
interface IncomeRow {
  id: string;
  incomeSource: string;
  contribution: string;
  amount: string;
  status: string;
  creditAccount: string;
}
interface PayeeRow {
  id: string;
  payeeId?: number | null;
  approvalStatus?: string;
  payeeName: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  branchName: string;
  url: string;
  amount: string;
  mode: string;
  accountName?: string;
  panNumber?: string;
  accountType?: string;
  beneficiaryType?: 'individual' | 'organization';
  beneficiaryOrg?: string;
  organizationType?: string;
  msme?: string;
  gstin?: string;
  tdsDetails?: string;
  tdsSection?: string;
}
interface PayeeLookupResult {
  id: number;
  payee_id?: number | null;
  payee_name?: string;
  account_name?: string | null;
  pan_number?: string | null;
  account_no?: string;
  account_type?: string | null;
  bank_name?: string;
  branch_name?: string;
  ifsc?: string;
  beneficiary_type?: string | null;
  beneficiary_org?: string | null;
  organization_type?: string | null;
  msme?: string | null;
  gstin?: string | null;
  tds_details?: string | null;
  tds_section?: string | null;
  approval_status?: string | null;
}
type PayeeLookupField = 'payeeName' | 'accountNo' | 'bankName' | 'ifsc' | 'branchName';

const normalizeExpenditureErrorMessage = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const message = value.replace(/\s+/g, ' ').trim();
  if (!message) return '';
  if (/<html[\s>]|<!doctype html/i.test(message)) {
    return 'Server returned an internal error. Please check the server logs for the exact reason.';
  }
  return message;
};

const getSubmitErrorMessage = (error: unknown): string => {
  const candidate = error as {
    response?: {
      data?: unknown;
    };
    message?: string;
  };
  const responseData = candidate.response?.data;

  if (typeof responseData === 'string' && responseData.trim()) {
    return normalizeExpenditureErrorMessage(responseData);
  }

  if (responseData && typeof responseData === 'object') {
    const data = responseData as { message?: unknown; error?: unknown };
    const message = normalizeExpenditureErrorMessage(data.message);
    if (message) return message;
    const errorMessage = normalizeExpenditureErrorMessage(data.error);
    if (errorMessage) return errorMessage;
  }

  const fallbackMessage = normalizeExpenditureErrorMessage(candidate.message);
  if (fallbackMessage) return fallbackMessage;

  return 'Something went wrong while submitting';
};

const formatDateForInput = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';

  const raw = String(value).trim();
  if (!raw) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const ymdPrefixMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return ymdPrefixMatch ? ymdPrefixMatch[1] : '';
};

const getLocalTodayYmd = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
interface FinanceRequestContext {
  finance_request_id: number;
  employee_id?: number | null;
  request_ref?: string;
  applicant_name?: string;
  designation?: string;
  department?: string;
  email?: string;
  mobile?: string;
  request_date?: string;
  description?: string;
  beneficiary_type?: string;
  beneficiary_value?: string;
  finance_tag?: string;
  primary_head?: string;
  event_sub_head?: string;
  budget_tag?: string;
  approved_amount?: number;
}
interface WorkflowStateSnapshot {
  status?: string;
  lastDecision?: string;
  currentStage?: string;
  expenditureMeta?: {
    unplannedBudgetEnabled?: boolean;
    unplannedBudgetAmount?: number | string | null;
    unplannedBudgetHead?: string | null;
    unplannedBudgetSubHead?: string | null;
    unplannedBudgetDescription?: string | null;
  };
}
interface BillFileRecord {
  id?: number;
  original_name?: string;
  file_url?: string | null;
  download_url?: string | null;
  file_path?: string | null;
  stored_name?: string | null;
  mime_type?: string | null;
}
interface ApprovedBudgetOption {
  budgetLineId: number | null;
  budgetProposalId: number | null;
  financeRequestRef: string;
  fiscalYear: number;
  head: string;
  subHead: string;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  beneficiaryType: string;
  beneficiaryValue: string;
}

const normalizeBudgetToken = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeDateForInput = (value: string | null | undefined): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const normalizeApprovedBudgetOption = (row: any): ApprovedBudgetOption | null => {
  if (!row || typeof row !== 'object') return null;

  const head = String(row.head ?? row.budget_head ?? '').trim();
  const subHead = String(row.subHead ?? row.sub_head ?? '').trim();
  if (!head || !subHead) return null;

  return {
    budgetLineId:
      Number(
        row.budgetLineId ??
          row.budget_line_id ??
          row.id ??
          row.finance_budget_breakup_id ??
          row.financeBudgetBreakupId ??
          row.breakup_id,
      ) || null,
    budgetProposalId: Number(row.budgetProposalId ?? row.budget_proposal_id) || null,
    financeRequestRef: String(row.financeRequestRef ?? row.finance_request_ref ?? '').trim(),
    fiscalYear: Number(row.fiscalYear ?? row.fiscal_year) || new Date().getFullYear(),
    head,
    subHead,
    totalAmount: Number(row.totalAmount ?? row.total_amount ?? 0) || 0,
    usedAmount: Number(row.usedAmount ?? row.used_amount ?? 0) || 0,
    remainingAmount: Number(row.remainingAmount ?? row.remaining_amount ?? 0) || 0,
    beneficiaryType: String(row.beneficiaryType ?? row.beneficiary_type ?? '').trim(),
    beneficiaryValue: String(row.beneficiaryValue ?? row.beneficiary_value ?? '').trim(),
  };
};
interface AdvanceFormRow {
  id: string;
  budgetHead: string | number;
  subHead: string | number;
  budget: string;
  preAdvance: string;
  advance: string;
  budgetLineId?: number | null;
  budgetProposalId?: number | null;
}
interface SettlementFormRow {
  id: string;
  budgetHead: string | number;
  subHead: string | number;
  budget: string;
  advance: string;
  settlement: string;
  budgetLineId?: number | null;
  budgetProposalId?: number | null;
}
interface ExpenditureFormRow {
  id: string;
  budgetHead: string | number;
  subHead: string | number;
  budget: string;
  expenditure: string;
  autoSum: string;
  budgetLineId?: number | null;
  budgetProposalId?: number | null;
}
interface UnplannedBudgetRow {
  id: string;
  headOfAccount: string;
  headOfAccountBudgetLineId?: number | null;
  headOfAccountBudgetProposalId?: number | null;
  budgetHead: string;
  subHead: string;
  amount: string;
  description: string;
}
interface BudgetHeadGroup {
  label: string;
  options: string[];
}

const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Faculty_Team: [
    'Project Team',
    'Event Organizing Team',
    'Research Team',
    'Question Paper Setting Team',
  ],
  Student_Team: [
    'Computer Science and Engineering',
    'Electronics and Communication Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Information Technology',
  ],
  Department: [
    'Computer Science and Engineering',
    'Electronics and Communication Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Information Technology',
  ],
  Centre: ['Centre for Research', 'Centre for Innovation', 'Centre for Industry Collaboration'],
  Cell: [
    'Placement Cell',
    'Entrepreneurship Development Cell',
    'Women Empowerment Cell',
    'Alumni Cell',
  ],
  Club: ['Coding Club', 'Robotics Club', 'Cultural Club', 'Sports Club'],
};

const INCOME_SOURCE_OPTIONS = [
  'Government Funding',
  'Registration Fees',
  'Sponsorship',
  'Management',
  'Staff Club',
];
const toOptions = (items: string[]): OptionType[] =>
  items.map((item) => ({ value: item, label: item }));
const CONTRIBUTION_OPTIONS = ['Full', 'Partial'];
const STATUS_OPTIONS = ['Credited', 'Reimbursement'];
const CATEGORY_TYPE_OPTIONS = [
  'Faculty',
  'Staff',
  'Department',
  'Centre',
  'Cell',
  'Club',
  'Section',
  'Professional Body',
  'Institution',
];
const BENEFICIARY_TYPE_TO_ENTITY_API_TYPE: Record<string, string> = {
  Department: 'DEPARTMENT',
  Centre: 'CENTRE',
  Cell: 'CELL',
  Club: 'CLUB',
  Section: 'SECTION',
  'Professional Body': 'PROFESSIONAL_BODY',
};
const FALLBACK_SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Department: [
    'Computer Science and Engineering',
    'Electronics and Communication Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Information Technology',
  ],
  Centre: ['Centre for Research', 'Centre for Innovation', 'Centre for Industry Collaboration'],
  Cell: [
    'Placement Cell',
    'Entrepreneurship Development Cell',
    'Women Empowerment Cell',
    'Alumni Cell',
  ],
  Club: ['Coding Club', 'Robotics Club', 'Cultural Club', 'Sports Club'],
  Section: ['Section A', 'Section B', 'Section C'],
  'Professional Body': [
    'American Society of Mechanical Engineers (Student Chapter)',
    'Computer Society of India',
    'Erode Salaram Foundation',
    'Local Library Authority, Erode & Namakkal',
    'Society for the Advancement of Library and Information Science',
    'The Indian Institute of Welding',
    'The Indian Society of Heating, Refrigerating and Air Conditioning',
  ],
};
const FALLBACK_TAG_OPTIONS: SelectOption[] = [
  { value: 'Laboratory', label: 'Laboratory' },
  { value: 'Association', label: 'Association' },
  { value: 'Skilling', label: 'Skilling' },
  { value: 'Research', label: 'Research' },
  { value: 'Outreach', label: 'Outreach' },
  { value: 'Office', label: 'Office' },
  { value: 'Academics', label: 'Academics' },
  { value: 'Essentials', label: 'Essentials' },
  { value: 'Events', label: 'Events' },
  { value: 'Innovation', label: 'Innovation' },
  { value: 'Start-up', label: 'Start-up' },
  { value: 'Entrepreneurship', label: 'Entrepreneurship' },
  { value: 'CoE Claims', label: 'CoE Claims' },
];
const PAYMENT_MODE_OPTIONS = [
  'NEFT',
  'RTGS',
  'IMPS',
  'Cheque',
  'Cash',
  'Online Transfer',
  'UPI',
  'Internal Transfer',
  'Not Applicable',
];
const PAYMENT_STATUS_OPTIONS = ['Paid', 'Pending', 'Processing', 'Cancelled'];
const BULK_NEFT_TEMPLATE_VERSION = '2026-04-11';
const isCashPaymentMode = (mode: unknown) =>
  ['cash', 'online transfer'].includes(
    String(mode || '')
      .trim()
      .toLowerCase(),
  );

const flattenOptions = (
  options: Array<OptionType | { label: string; options: OptionType[] }>,
): OptionType[] => options.flatMap((opt) => ('options' in opt ? opt.options : opt));

const parsePositiveIntLike = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const direct = Number.parseInt(text, 10);
  if (Number.isInteger(direct) && direct > 0) {
    return direct;
  }

  const match = text.match(/(\d+)(?!.*\d)/);
  if (!match) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeWorkflowModule = (
  value: unknown,
): 'Advance' | 'Settlement' | 'Expenditure' | null => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  if (text === 'advance') return 'Advance';
  if (text === 'settlement') return 'Settlement';
  if (text === 'expenditure') return 'Expenditure';
  return null;
};

const resolveTagValue = (value: unknown, options: SelectOption[]) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';

  const matched = options.find(
    (option) =>
      String(option.value ?? '')
        .trim()
        .toLowerCase() === normalized.toLowerCase(),
  );

  return matched?.value || normalized;
};

const extractTagCandidate = (source: Record<string, unknown> | null | undefined): string => {
  if (!source || typeof source !== 'object') return '';
  const candidate =
    source.budget_tag ??
    source.budgetTag ??
    source.budgettag ??
    source.finance_tag ??
    source.financeTag ??
    source.tag_name ??
    source.tag ??
    '';
  return String(candidate ?? '').trim();
};

const resolveBillFileUrl = (file: BillFileRecord) => {
  const rawUrl = String(file.file_url ?? file.download_url ?? file.file_path ?? '').trim();
  if (!rawUrl) return '';
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

  const baseUrl = authenticityUtility.getBaseURL();
  return rawUrl.startsWith('/') ? `${baseUrl}${rawUrl}` : `${baseUrl}/${rawUrl}`;
};

const hasReachedPostDofStage = (record: Record<string, any>, workflowStatus: string): boolean => {
  if (
    ['approved', 'completed', 'dof_approved', 'principal_approved'].includes(workflowStatus) ||
    workflowStatus.includes('dof_approved') ||
    workflowStatus.includes('principal_approved')
  ) {
    return true;
  }

  const state = record?.workflow_state;
  const currentStage = String(
    (state && typeof state === 'object' ? (state as Record<string, unknown>).currentStage : '') ||
      record?.workflow_stage ||
      '',
  )
    .trim()
    .toLowerCase();

  return ['principal', 'chairman'].includes(currentStage);
};

const getSelectedOption = (
  value: string | number,
  options: Array<OptionType | { label: string; options: OptionType[] }>,
): OptionType | null =>
  flattenOptions(options).find((opt) => String(opt.value) === String(value)) ?? null;

const BUDGET_SELECT_STYLES = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '45px',
    height: 45,
    borderRadius: '12px',
    border: state.isFocused ? '1px solid #0069ab' : '1px solid #e0e0e0',
    backgroundColor: '#fcfdff',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 105, 171, 0.15)' : 'none',
    '&:hover': {
      borderColor: '#0069ab',
    },
  }),
  dropdownIndicator: (base: any, state: any) => ({
    ...base,
    padding: '0 12px',
    color: '#666',
    transition: 'transform 0.2s ease',
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '2px 8px',
    justifyContent: 'center', // This centers the text horizontally
    alignItems: 'center',
    display: 'flex',
  }),
  singleValue: (base: any) => ({
    ...base,
    color: '#333',
    fontSize: '0.95rem',
    textAlign: 'center', // Center text
    margin: 0,
    position: 'static',
    transform: 'none',
    maxWidth: 'calc(100% - 20px)',
  }),
  input: (base: any) => ({
    ...base,
    color: '#333',
    padding: '0',
    margin: '0',
    textAlign: 'center',
    '& input': {
      textAlign: 'center !important',
    },
  }),
  placeholder: (base: any) => ({
    ...base,
    textAlign: 'center',
    color: '#999',
    margin: 0,
    position: 'static',
    transform: 'none',
  }),
  menu: (base: any) => ({
    ...base,
    zIndex: 999999,
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
    marginTop: '4px',
    overflow: 'hidden',
  }),
  menuList: (base: any) => ({
    ...base,
    padding: '8px 0',
    maxHeight: '300px',
  }),
  option: (base: any, state: any) => ({
    ...base,
    padding: '10px 15px',
    backgroundColor: state.isSelected
      ? '#0069ab'
      : state.isFocused
        ? 'rgba(0,105,171,0.1)'
        : 'white',
    color: state.isSelected ? 'white' : '#333',
    cursor: 'pointer',
    textAlign: 'center', // Center option text
    fontSize: '0.9rem',
    '&:active': {
      backgroundColor: '#0069ab',
      color: 'white',
    },
  }),
};

const createIncomeRow = (): IncomeRow => ({
  id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  incomeSource: '',
  contribution: '',
  amount: '',
  status: '',
  creditAccount: '',
});

const createPayeeRow = (): PayeeRow => ({
  id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  payeeId: null,
  approvalStatus: '',
  payeeName: '',
  bankName: '',
  accountNo: '',
  ifsc: '',
  branchName: '',
  url: '',
  amount: '',
  mode: '',
  accountName: '',
  panNumber: '',
  accountType: '',
  beneficiaryType: 'individual',
  beneficiaryOrg: '',
  organizationType: '',
  msme: '',
  gstin: '',
  tdsDetails: '',
  tdsSection: '',
});

const getCashPayeeResetFields = (): Partial<PayeeRow> => ({
  payeeId: null,
  approvalStatus: '',
  payeeName: '',
  bankName: '',
  accountNo: '',
  ifsc: '',
  branchName: '',
  url: '',
  accountName: '',
  panNumber: '',
  accountType: '',
  beneficiaryType: undefined,
  beneficiaryOrg: '',
  organizationType: '',
  msme: '',
  gstin: '',
  tdsDetails: '',
  tdsSection: '',
});

const BENEFICIARY_ORG_OPTIONS = ['KSRCT', 'KSREI', 'External'] as const;

const normalizePayeeText = (value: unknown): string => String(value ?? '').trim();

const normalizeApprovalStatus = (value: unknown): string => normalizePayeeText(value).toLowerCase();

const isApprovedPayeeRecord = (
  value: { approval_status?: string | null; approvalStatus?: string | null } | null | undefined,
): boolean =>
  normalizeApprovalStatus(value?.approval_status ?? value?.approvalStatus) === 'approved';

const isBeneficiaryOrgValue = (value: unknown): boolean =>
  BENEFICIARY_ORG_OPTIONS.some((option) => option === normalizePayeeText(value));

const resolveCanonicalPayeeName = (payeeName: unknown, accountName: unknown): string => {
  const normalizedPayeeName = normalizePayeeText(payeeName);
  const normalizedAccountName = normalizePayeeText(accountName);

  if (normalizedPayeeName && !isBeneficiaryOrgValue(normalizedPayeeName)) {
    return normalizedPayeeName;
  }

  return normalizedAccountName || normalizedPayeeName;
};

const resolveCanonicalBeneficiaryOrg = (
  beneficiaryOrg: unknown,
  legacyPayeeName?: unknown,
): string => {
  const normalizedBeneficiaryOrg = normalizePayeeText(beneficiaryOrg);
  if (normalizedBeneficiaryOrg) {
    return normalizedBeneficiaryOrg;
  }

  const normalizedLegacyPayeeName = normalizePayeeText(legacyPayeeName);
  return isBeneficiaryOrgValue(normalizedLegacyPayeeName) ? normalizedLegacyPayeeName : '';
};

const createAdvanceRow = (): AdvanceFormRow => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  budgetHead: '',
  subHead: '',
  budget: '',
  preAdvance: '0',
  advance: '',
  budgetLineId: null,
  budgetProposalId: null,
});

const createSettlementRow = (): SettlementFormRow => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}-s`,
  budgetHead: '',
  subHead: '',
  budget: '',
  advance: '',
  settlement: '',
  budgetLineId: null,
  budgetProposalId: null,
});

const createExpenditureRow = (): ExpenditureFormRow => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}-e`,
  budgetHead: '',
  subHead: '',
  budget: '',
  expenditure: '',
  autoSum: '',
  budgetLineId: null,
  budgetProposalId: null,
});

const createUnplannedBudgetRow = (): UnplannedBudgetRow => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}-u`,
  headOfAccount: '',
  headOfAccountBudgetLineId: null,
  headOfAccountBudgetProposalId: null,
  budgetHead: '',
  subHead: '',
  amount: '',
  description: '',
});

const mapFinanceBeneficiaryTypeToExpenditureCategory = (value: string): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (!normalized) return '';
  if (normalized === 'faculty') return 'Faculty';
  if (normalized === 'staff') return 'Staff';
  if (normalized === 'department') return 'Department';
  if (normalized === 'centre' || normalized === 'center') return 'Centre';
  if (normalized === 'cell') return 'Cell';
  if (normalized === 'club') return 'Club';
  if (normalized === 'section') return 'Section';
  if (normalized === 'professional body') return 'Professional Body';
  if (normalized === 'institution') return 'Institution';

  return '';
};

const ExpenditureApproval: React.FC = () => {
  useBudgetCatalog();
  const [, setCatalogVersion] = useState(0);
  useEffect(() => subscribeBudgetCatalog(() => setCatalogVersion((n) => n + 1)), []);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id: routeId } = useParams<{ id?: string }>();
  const launchModuleFromState = (() => {
    const state = location.state as {
      activeTab?: unknown;
      submittedModule?: unknown;
    } | null;

    return (
      normalizeWorkflowModule(state?.activeTab) ?? normalizeWorkflowModule(state?.submittedModule)
    );
  })();

  // Check if this is Advance2
  const isAdvance2 = (() => {
    const state = location.state as {
      isAdvance2?: boolean;
    } | null;
    return Boolean(state?.isAdvance2);
  })();

  const isReadOnlyNavigation = (() => {
    const state = location.state as {
      viewOnly?: boolean;
    } | null;
    return Boolean(state?.viewOnly);
  })();

  const isReadOnlyView =
    Boolean(routeId) &&
    (isReadOnlyNavigation || (!launchModuleFromState && !location.pathname.endsWith('/edit')));
  const isAdminWorkflowContext = new URLSearchParams(location.search).get('admin') === 'true';
  const dashboardRowIdFromState = (() => {
    const state = location.state as {
      dashboardRowId?: unknown;
    } | null;

    return String(state?.dashboardRowId || '').trim() || null;
  })();
  const rowIndexFromState = (() => {
    const state = location.state as {
      rowIndex?: unknown;
    } | null;

    return parsePositiveIntLike(state?.rowIndex);
  })();
  const financeRequestIdFromState = (() => {
    const state = location.state as {
      financeRequestId?: unknown;
      financeProposal?: { proposalId?: unknown };
    } | null;

    const candidates = [state?.financeRequestId, state?.financeProposal?.proposalId];

    for (const candidate of candidates) {
      const parsed = parsePositiveIntLike(candidate);
      if (parsed) return parsed;
    }

    return null;
  })();
  const submittedRequestIdFromState = (() => {
    const state = location.state as {
      submittedRequestId?: unknown;
    } | null;

    return parsePositiveIntLike(state?.submittedRequestId) ?? parsePositiveIntLike(routeId);
  })();
  const isEditingExistingRequest = Boolean(submittedRequestIdFromState);
  const submitActionLabel = isEditingExistingRequest ? 'Update' : 'Submit';
  const sourceRequestIdFromState = (() => {
    const state = location.state as {
      sourceRequestId?: unknown;
      source_request_id?: unknown;
    } | null;

    return (
      parsePositiveIntLike(state?.sourceRequestId) ?? parsePositiveIntLike(state?.source_request_id)
    );
  })();
  const financeApprovedAmountFromState = (() => {
    const state = location.state as {
      financeProposal?: {
        totalAmount?: unknown;
        tag?: unknown;
      };
    } | null;

    return Number.parseFloat(String(state?.financeProposal?.totalAmount ?? '0')) || 0;
  })();
  const financeTagFromState = (() => {
    const state = location.state as {
      financeProposal?: {
        tag?: unknown;
      };
    } | null;
    return String(state?.financeProposal?.tag ?? '').trim();
  })();
  const budgetFiscalYearFromState = (() => {
    const state = location.state as {
      budgetFiscalYear?: unknown;
      isCarryForwardCard?: unknown;
    } | null;
    if (!state?.isCarryForwardCard) return null;
    return parsePositiveIntLike(state?.budgetFiscalYear);
  })();
  const [resolvedFinanceRequestId, setResolvedFinanceRequestId] = useState<number | null>(
    financeRequestIdFromState,
  );
  const [isReturnedWorkflowRequest, setIsReturnedWorkflowRequest] = useState<boolean>(false);
  const [loadedWorkflowStatus, setLoadedWorkflowStatus] = useState<string>('');
  const [loadedCurrentStage, setLoadedCurrentStage] = useState<string>('');
  const [wfActionPopupOpen, setWfActionPopupOpen] = useState(false);
  const [wfActionType, setWfActionType] = useState<'returned' | 'rejected' | null>(null);
  const [wfActionComment, setWfActionComment] = useState('');
  const [wfActionSubmitting, setWfActionSubmitting] = useState(false);
  const [resubmitPopupOpen, setResubmitPopupOpen] = useState(false);
  const [resubmitComment, setResubmitComment] = useState('');
  const [resubmitSubmitting, setResubmitSubmitting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDofApprovalForPaymentStatus, setHasDofApprovalForPaymentStatus] =
    useState<boolean>(false);
  const [financeApprovedAmount, setFinanceApprovedAmount] = useState<number>(
    financeApprovedAmountFromState,
  );
  useEffect(() => {
    setResolvedFinanceRequestId(financeRequestIdFromState);
  }, [financeRequestIdFromState]);
  useEffect(() => {
    setFinanceApprovedAmount(financeApprovedAmountFromState);
  }, [financeApprovedAmountFromState]);
  const [applicantName, setApplicantName] = useState<string>('');
  const [date, setDate] = useState<string>(getLocalTodayYmd());
  const [designation, setDesignation] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amountProposed, setAmountProposed] = useState<string>('');
  const [directorComments, setDirectorComments] = useState<string>('');
  const [isBudgetProposed, setIsBudgetProposed] = useState<string>('');
  const [balanceAmount, setBalanceAmount] = useState<string>('');
  const [debitStatus, setDebitStatus] = useState<'credited' | 'reimbursement' | ''>('');
  const [email, setEmail] = useState<string>('');
  const [budgetRows, setBudgetRows] = useState([{ category: '', head: '', amount: '' }]);
  const [showUnplannedBudget, setShowUnplannedBudget] = useState<boolean>(false);
  const [unplannedRows, setUnplannedRows] = useState<UnplannedBudgetRow[]>([
    createUnplannedBudgetRow(),
  ]);
  const [showIncomeSection, setShowIncomeSection] = useState<boolean>(false);
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([createIncomeRow()]);
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  const [payeeRows, setPayeeRows] = useState<PayeeRow[]>([createPayeeRow()]);
  const [activePayeeLookupRowId, setActivePayeeLookupRowId] = useState<string | null>(null);
  const [activePayeeLookupField, setActivePayeeLookupField] = useState<PayeeLookupField | null>(
    null,
  );
  const [payeeLookupResults, setPayeeLookupResults] = useState<PayeeLookupResult[]>([]);
  const [isPayeeLookupOpen, setIsPayeeLookupOpen] = useState(false);
  const [isPayeeLookupLoading, setIsPayeeLookupLoading] = useState(false);
  const [showBulkNEFT, setShowBulkNEFT] = useState<boolean>(false);
  const [paymentDetails, setPaymentDetails] = useState({
    mode: '',
    refNo: '',
    date: getLocalTodayYmd(),
    status: 'Pending',
    debitAccount: '',
  });
  const bulkNeftInputRef = useRef<HTMLInputElement>(null);
  const [bulkNeftFile, setBulkNeftFile] = useState<File | null>(null);
  const [uploadedPayeeBills, setUploadedPayeeBills] = useState<File[]>([]);
  const [uploadedPaymentProofs, setUploadedPaymentProofs] = useState<File[]>([]);
  const [existingPaymentProofs, setExistingPaymentProofs] = useState<BillFileRecord[]>([]);
  const [existingPayeeBills, setExistingPayeeBills] = useState<BillFileRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [isExternalApplicant, setIsExternalApplicant] = useState<boolean>(false);
  const [applicantSearchQuery, setApplicantSearchQuery] = useState<string>('');
  const [applicantSearchResults, setApplicantSearchResults] = useState<
    Array<{
      employee_id: number;
      name: string;
      designation: string;
      department: string;
      email: string;
      mobile: string;
      employee_type: string;
    }>
  >([]);
  const [showApplicantDropdown, setShowApplicantDropdown] = useState<boolean>(false);
  const isFinalApprovedWorkflow = ['approved', 'completed'].includes(loadedWorkflowStatus);
  const canEditPaymentStatus = Boolean(
    submittedRequestIdFromState &&
    isReadOnlyView &&
    !isAdminWorkflowContext &&
    isFinalApprovedWorkflow,
  );
  const componentRef = useRef<HTMLDivElement>(null);
  const [isApplicantCardOpen, setIsApplicantCardOpen] = useState(true);

  useEffect(() => {
    setIsApplicantCardOpen(!isEditingExistingRequest);
  }, [isEditingExistingRequest]);

  const [advanceRows, setAdvanceRows] = useState<AdvanceFormRow[]>([createAdvanceRow()]);
  const [settlementRows, setSettlementRows] = useState<SettlementFormRow[]>([
    createSettlementRow(),
  ]);
  const [settlementRemarks, setSettlementRemarks] = useState('');
  const [advanceTentativeSettlementDate, setAdvanceTentativeSettlementDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryType, setCategoryType] = useState<string>('');
  const [categoryItem, setCategoryItem] = useState<string>('');
  const [categorySelections, setCategorySelections] = useState<string[]>([]);
  const [primaryHead, setPrimaryHead] = useState<string>('');
  const [eventSubHead, setEventSubHead] = useState<string>('');
  const [beneficiarySearchQuery, setBeneficiarySearchQuery] = useState<string>('');
  const [beneficiarySearchResults, setBeneficiarySearchResults] = useState<
    Array<{
      employeeid: number;
      name: string;
      designation: string;
      department: string;
    }>
  >([]);
  const [showBeneficiaryDropdown, setShowBeneficiaryDropdown] = useState(false);
  const [beneficiaryEmployeeId, setBeneficiaryEmployeeId] = useState<number | null>(null);
  const lockBeneficiaryAndTagFields = true;
  const [isPayeeCardOpen, setIsPayeeCardOpen] = useState(true);
  const [showAddPayeeModal, setShowAddPayeeModal] = useState(false);
  const [newPayee, setNewPayee] = useState<PayeeRow>(createPayeeRow());
  const [approvedBudgetOptions, setApprovedBudgetOptions] = useState<ApprovedBudgetOption[]>([]);
  const [isApprovedBudgetLoading, setIsApprovedBudgetLoading] = useState(false);
  const [subcategoryOptionsByType, setSubcategoryOptionsByType] = useState<
    Record<string, SelectOption[]>
  >({});
  const [tagOptions, setTagOptions] = useState<SelectOption[]>(FALLBACK_TAG_OPTIONS);
  const [pendingPrefillTag, setPendingPrefillTag] = useState<string>(financeTagFromState);
  const [showDebitAccountDropdown, setShowDebitAccountDropdown] = useState(false);
  const payeeLookupTimeoutRef = useRef<number | null>(null);
  const payeeLookupRequestRef = useRef(0);
  const normalizeText = (value: unknown): string => String(value ?? '').trim();
  const firstUnplannedRow: UnplannedBudgetRow = unplannedRows[0] || {
    id: '',
    headOfAccount: '',
    headOfAccountBudgetLineId: null,
    headOfAccountBudgetProposalId: null,
    budgetHead: '',
    subHead: '',
    amount: '',
    description: '',
  };
  const unplannedHeadOfAccount = firstUnplannedRow.headOfAccount;
  const unplannedHeadOfAccountBudgetLineId = firstUnplannedRow.headOfAccountBudgetLineId ?? null;
  const unplannedHeadOfAccountBudgetProposalId =
    firstUnplannedRow.headOfAccountBudgetProposalId ?? null;
  const [expenditureSubRows, setExpenditureSubRows] = useState<ExpenditureFormRow[]>([
    createExpenditureRow(),
  ]);
  const [expenditureRemarks, setExpenditureRemarks] = useState('');
  const [activeTab, setActiveTab] = useState<'Advance' | 'Settlement' | 'Expenditure' | null>(
    launchModuleFromState,
  );
  const normalizedWorkflowStatus = String(loadedWorkflowStatus || '').toLowerCase();
  const isSuperAdminUser =
    Boolean(user?.is_super_admin || (user as any)?.isSuperAdmin) ||
    (Array.isArray(user?.roles) &&
      user.roles.some((role) => String(role || '').toLowerCase() === 'super_admin'));
  const userWorkflowPermissions = Array.isArray(user?.permissions)
    ? user.permissions.map((permission) => String(permission || '').toLowerCase())
    : [];
  const routeStateIsActionablePending = (location.state as any)?.isActionablePending;
  const hideWorkflowActionsForFinalStatus =
    !isSuperAdminUser &&
    (routeStateIsActionablePending === false ||
      normalizedWorkflowStatus.includes('approved') ||
      normalizedWorkflowStatus.includes('returned') ||
      normalizedWorkflowStatus.includes('completed') ||
      normalizedWorkflowStatus.includes('rejected') ||
      normalizedWorkflowStatus.includes('archived'));
  const canActOnCurrentStage =
    isReadOnlyView &&
    Boolean(loadedCurrentStage) &&
    !isSuperAdminUser &&
    (userWorkflowPermissions.includes(`expenditure.workflow.${loadedCurrentStage}`) ||
      userWorkflowPermissions.includes(`finance.workflow.${loadedCurrentStage}`));
  const isWorkflowActionPage =
    isReadOnlyView &&
    isAdminWorkflowContext &&
    (activeTab === 'Advance' || activeTab === 'Expenditure');
  const showWorkflowActions =
    isWorkflowActionPage &&
    Boolean(submittedRequestIdFromState) &&
    !hideWorkflowActionsForFinalStatus &&
    (isSuperAdminUser || canActOnCurrentStage);

  useEffect(() => {
    if (!resolvedFinanceRequestId) {
      return;
    }

    let isCancelled = false;

    const loadFinanceContext = async () => {
      try {
        const response = (await authenticityUtility.get(
          `/expenditure/finance-context/${resolvedFinanceRequestId}`,
        )) as {
          success?: boolean;
          status?: string;
          data?: FinanceRequestContext;
        };

        const isSuccessResponse = response?.success === true || response?.status === 'success';

        if (isCancelled || !isSuccessResponse || !response.data) {
          return;
        }

        const financeContext = response.data;
        const nextCategoryType = mapFinanceBeneficiaryTypeToExpenditureCategory(
          financeContext.beneficiary_type || '',
        );

        setFinanceApprovedAmount(
          Number(financeContext.approved_amount || financeApprovedAmountFromState || 0),
        );
        setEmployeeId(financeContext.employee_id ?? null);
        setApplicantName(financeContext.applicant_name || '');
        setApplicantSearchQuery(financeContext.applicant_name || '');
        setDesignation(financeContext.designation || '');
        setDepartment(financeContext.department || '');
        setEmail(financeContext.email || '');
        setMobile(financeContext.mobile || '');
        setDescription((prev) => prev || financeContext.description || '');
        setPrimaryHead((prev) => prev || financeContext.primary_head || '');
        setEventSubHead((prev) => prev || financeContext.event_sub_head || '');
        setCategoryType((prev) => prev || nextCategoryType);
        setCategoryItem((prev) => prev || financeContext.beneficiary_value || '');
        const financeContextTagRaw = extractTagCandidate(
          financeContext as FinanceRequestContext & Record<string, unknown>,
        );
        let resolvedPrefillTag = resolveTagValue(financeContextTagRaw, tagOptions);

        // Fallback: if finance-context doesn't include tag, fetch finance request details.
        if (!resolvedPrefillTag && resolvedFinanceRequestId) {
          try {
            const financeDetailResp = (await authenticityUtility.get(
              `/finance-requests/${resolvedFinanceRequestId}`,
            )) as any;
            const payload = financeDetailResp?.data ?? {};
            const candidate =
              extractTagCandidate(payload) ||
              extractTagCandidate(payload?.master as Record<string, unknown> | undefined) ||
              extractTagCandidate(payload?.record as Record<string, unknown> | undefined);
            resolvedPrefillTag = resolveTagValue(candidate, tagOptions);
          } catch (tagFallbackError) {
            console.error('Failed to fetch finance tag fallback:', tagFallbackError);
          }
        }

        const nextTag = resolvedPrefillTag || financeContextTagRaw || financeTagFromState || '';
        setSelectedTag((prev) => {
          const apiTag = resolvedPrefillTag || financeContextTagRaw;
          if (apiTag) return apiTag;
          return prev || nextTag;
        });
        if (nextTag) {
          setPendingPrefillTag(nextTag);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load finance context for expenditure form:', error);
        }
      }
    };

    loadFinanceContext();

    return () => {
      isCancelled = true;
    };
  }, [resolvedFinanceRequestId]);

  useEffect(() => {
    if (!pendingPrefillTag) return;
    setSelectedTag((prev) => {
      if (prev && String(prev).trim()) return prev;
      return resolveTagValue(pendingPrefillTag, tagOptions);
    });
  }, [pendingPrefillTag, tagOptions]);

  useEffect(() => {
    if (!submittedRequestIdFromState) {
      setExistingPayeeBills([]);
      setIsReturnedWorkflowRequest(false);
      setLoadedWorkflowStatus('');
      setLoadedCurrentStage('');
      setHasDofApprovalForPaymentStatus(false);
      return;
    }

    let isCancelled = false;

    const loadSubmittedRequest = async () => {
      try {
        const response = (await authenticityUtility.get(
          `/expenditure/${submittedRequestIdFromState}`,
        )) as {
          success?: boolean;
          status?: string;
          data?: any;
        };

        const isSuccessResponse = response?.success === true || response?.status === 'success';

        if (isCancelled || !isSuccessResponse || !response.data) {
          return;
        }

        const record = response.data;
        setResolvedFinanceRequestId(parsePositiveIntLike(record.finance_request_id) ?? null);
        const workflowState = (() => {
          const rawState = record.workflow_state;
          if (rawState && typeof rawState === 'object' && !Array.isArray(rawState)) {
            return rawState as WorkflowStateSnapshot;
          }

          if (typeof rawState === 'string') {
            try {
              const parsed = JSON.parse(rawState) as WorkflowStateSnapshot;
              return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
            } catch {
              return null;
            }
          }

          return null;
        })();
        const workflowStatus = String(
          workflowState?.status ||
            workflowState?.lastDecision ||
            record.workflow_status ||
            record.overall_status ||
            '',
        ).toLowerCase();
        const currentStage = String(
          workflowState?.currentStage ||
            (workflowState as Record<string, unknown> | null)?.stage ||
            record.workflow_stage ||
            record.current_stage ||
            '',
        )
          .trim()
          .toLowerCase();
        setIsReturnedWorkflowRequest(workflowStatus === 'returned');
        setLoadedWorkflowStatus(workflowStatus);
        setLoadedCurrentStage(currentStage);
        setHasDofApprovalForPaymentStatus(hasReachedPostDofStage(record, workflowStatus));
        const toRowId = (suffix: string, index: number) =>
          `${submittedRequestIdFromState}-${suffix}-${index}`;

        const mapAdvanceRows = Array.isArray(record.advance_rows)
          ? record.advance_rows.map((row: any, index: number) => ({
              id: toRowId('advance', index),
              budgetHead: String(row?.budget_head || ''),
              subHead: String(row?.sub_head || ''),
              budget: String(row?.budget_amount ?? ''),
              preAdvance: String(row?.pre_advance_amount ?? ''),
              advance: String(row?.advance_amount ?? ''),
              budgetLineId: row?.budget_line_id ?? null,
              budgetProposalId: row?.budget_proposal_id ?? null,
            }))
          : [];

        const mapSettlementRows = Array.isArray(record.settlement_rows)
          ? record.settlement_rows.map((row: any, index: number) => ({
              id: toRowId('settlement', index),
              budgetHead: String(row?.budget_head || ''),
              subHead: String(row?.sub_head || ''),
              budget: String(row?.budget_amount ?? ''),
              advance: String(row?.advance_amount ?? ''),
              settlement: String(row?.settlement_amount ?? ''),
              budgetLineId: row?.budget_line_id ?? null,
              budgetProposalId: row?.budget_proposal_id ?? null,
            }))
          : [];

        const mapExpenditureRows = Array.isArray(record.expenditure_rows)
          ? record.expenditure_rows.map((row: any, index: number) => ({
              id: toRowId('expenditure', index),
              budgetHead: String(row?.budget_head || ''),
              subHead: String(row?.sub_head || ''),
              budget: String(row?.budget_amount ?? ''),
              expenditure: String(row?.expenditure_input ?? ''),
              autoSum: String(row?.auto_sum_amount ?? ''),
              budgetLineId: row?.budget_line_id ?? null,
              budgetProposalId: row?.budget_proposal_id ?? null,
            }))
          : [];
        setSettlementRemarks(String(record.settlement_remarks || ''));
        setExpenditureRemarks(String(record.expenditure_remarks || ''));
        setAdvanceTentativeSettlementDate(
          normalizeDateForInput(String(record.tentative_settlement_date || '')),
        );

        const mapPayeeRows = Array.isArray(record.payee_rows)
          ? record.payee_rows.map((row: any, index: number) => ({
              ...(() => {
                const canonicalPayeeName = resolveCanonicalPayeeName(
                  row?.payee_name,
                  row?.account_name,
                );
                return {
                  payeeName: canonicalPayeeName,
                  accountName: canonicalPayeeName,
                  beneficiaryOrg: resolveCanonicalBeneficiaryOrg(
                    row?.beneficiary_org,
                    row?.payee_name,
                  ),
                };
              })(),
              id: `${submittedRequestIdFromState}-payee-${index}`,
              payeeId: row?.payee_id ?? null,
              approvalStatus: String(row?.approval_status || '').trim(),
              bankName: String(row?.bank_name || ''),
              accountNo: String(row?.account_no || ''),
              ifsc: String(row?.ifsc || ''),
              branchName: String(row?.branch_name || ''),
              url: String(row?.url || ''),
              amount: String(row?.amount || ''),
              mode: String(row?.mode || ''),
              panNumber: String(row?.pan_number || ''),
              accountType: String(row?.account_type || ''),
              beneficiaryType: String(row?.beneficiary_type || 'individual'),
              organizationType: String(row?.organization_type || ''),
              msme: String(row?.msme || ''),
              gstin: String(row?.gstin || ''),
              tdsDetails: String(row?.tds_details || ''),
              tdsSection: String(row?.tds_section || ''),
            }))
          : [];

        setApplicantName(String(record.applicant_name || ''));
        setApplicantSearchQuery(String(record.applicant_name || ''));
        setDesignation(String(record.designation || ''));
        setDepartment(String(record.department || ''));
        setEmail(String(record.email || ''));
        setMobile(String(record.mobile || ''));
        setDate(normalizeDateForInput(String(record.request_date || '')) || getLocalTodayYmd());
        setDescription(String(record.description || ''));
        setCategoryType(String(record.beneficiary_type || ''));
        setCategoryItem(String(record.beneficiary_value || ''));
        {
          const recordTag = resolveTagValue(
            record.budget_tag ??
              record.budgettag ??
              record.budgetTag ??
              record.tag ??
              record.finance_tag ??
              record.financeTag ??
              '',
            tagOptions,
          );
          setSelectedTag((prev) => prev || recordTag);
        }
        setPrimaryHead(String(record.primary_head || ''));
        setEventSubHead(String(record.event_sub_head || ''));
        {
          const workflowExpenditureMeta =
            (workflowState?.expenditureMeta as Record<string, unknown> | undefined) || {};
          const recordUnplannedBudgetEnabled =
            record.unplanned_budget_enabled ??
            workflowExpenditureMeta.unplannedBudgetEnabled ??
            false;
          const recordUnplannedBudgetAmount =
            record.unplanned_budget_amount ?? workflowExpenditureMeta.unplannedBudgetAmount ?? '';
          const hasUnplannedBudgetAmount =
            recordUnplannedBudgetAmount !== null &&
            recordUnplannedBudgetAmount !== undefined &&
            String(recordUnplannedBudgetAmount).trim() !== '' &&
            Number(recordUnplannedBudgetAmount) > 0;
          const recordUnplannedBudgetDescription =
            record.unplanned_budget_description ??
            workflowExpenditureMeta.unplannedBudgetDescription ??
            '';
          const recordUnplannedBudgetHead =
            record.unplanned_budget_head ?? workflowExpenditureMeta.unplannedBudgetHead ?? '';
          const recordUnplannedBudgetSubHead =
            record.unplanned_budget_sub_head ??
            workflowExpenditureMeta.unplannedBudgetSubHead ??
            '';
          const recordUnplannedHeadOfAccount =
            record.unplanned_head_of_account ??
            workflowExpenditureMeta.unplannedHeadOfAccount ??
            '';
          const recordUnplannedHeadOfAccountBudgetLineId =
            record.unplanned_head_of_account_budget_line_id ??
            workflowExpenditureMeta.unplannedHeadOfAccountBudgetLineId ??
            null;
          const recordUnplannedHeadOfAccountBudgetProposalId =
            record.unplanned_head_of_account_budget_proposal_id ??
            workflowExpenditureMeta.unplannedHeadOfAccountBudgetProposalId ??
            null;
          setShowUnplannedBudget(Boolean(recordUnplannedBudgetEnabled || hasUnplannedBudgetAmount));
          const mappedUnplannedRows = Array.isArray(record.unplanned_rows)
            ? record.unplanned_rows
                .map((row: any, index: number) => ({
                  id: String(row.id ?? `unplanned-${index}`),
                  headOfAccount: String(row.head_of_account ?? row.headOfAccount ?? ''),
                  headOfAccountBudgetLineId: parsePositiveIntLike(
                    row.head_of_account_budget_line_id ?? row.headOfAccountBudgetLineId,
                  ),
                  headOfAccountBudgetProposalId: parsePositiveIntLike(
                    row.head_of_account_budget_proposal_id ?? row.headOfAccountBudgetProposalId,
                  ),
                  budgetHead: String(row.budget_head ?? row.budgetHead ?? ''),
                  subHead: String(row.sub_head ?? row.subHead ?? ''),
                  amount: row.amount !== null && row.amount !== undefined ? String(row.amount) : '',
                  description: String(row.description ?? ''),
                }))
                .filter(
                  (row: UnplannedBudgetRow) =>
                    row.headOfAccount || row.budgetHead || row.subHead || row.amount,
                )
            : [];
          const legacyUnplannedRow: UnplannedBudgetRow = {
            id: 'unplanned-legacy',
            headOfAccount: String(recordUnplannedHeadOfAccount || ''),
            headOfAccountBudgetLineId: parsePositiveIntLike(
              recordUnplannedHeadOfAccountBudgetLineId,
            ),
            headOfAccountBudgetProposalId: parsePositiveIntLike(
              recordUnplannedHeadOfAccountBudgetProposalId,
            ),
            budgetHead: String(recordUnplannedBudgetHead || ''),
            subHead: String(recordUnplannedBudgetSubHead || ''),
            amount:
              recordUnplannedBudgetAmount !== null && recordUnplannedBudgetAmount !== undefined
                ? String(recordUnplannedBudgetAmount)
                : '',
            description: String(recordUnplannedBudgetDescription || ''),
          };
          setUnplannedRows(
            mappedUnplannedRows.length > 0
              ? mappedUnplannedRows
              : hasUnplannedBudgetAmount ||
                  legacyUnplannedRow.headOfAccount ||
                  legacyUnplannedRow.budgetHead ||
                  legacyUnplannedRow.subHead
                ? [legacyUnplannedRow]
                : [createUnplannedBudgetRow()],
          );
        }
        setIsBudgetProposed(String(record.is_budget_proposed || ''));
        setDebitStatus(String(record.debit_status || '') as 'credited' | 'reimbursement' | '');
        setAmountProposed(String(record.total_amount ?? record.approved_total_amount ?? ''));
        if (Number(record.approved_amount || 0) > 0) {
          setFinanceApprovedAmount(Number(record.approved_amount));
        }
        const requestType = normalizeText(record.request_type);
        setActiveTab(
          launchModuleFromState ??
            (requestType === 'Advance' ||
            requestType === 'Settlement' ||
            requestType === 'Expenditure'
              ? requestType
              : null),
        );
        setAdvanceRows(mapAdvanceRows.length > 0 ? mapAdvanceRows : [createAdvanceRow()]);
        setSettlementRows(
          mapSettlementRows.length > 0 ? mapSettlementRows : [createSettlementRow()],
        );
        setExpenditureSubRows(
          mapExpenditureRows.length > 0 ? mapExpenditureRows : [createExpenditureRow()],
        );
        setPayeeRows(mapPayeeRows.length > 0 ? mapPayeeRows : [createPayeeRow()]);
        setPaymentDetails({
          mode: String(record.payment_mode || ''),
          refNo: String(record.payment_ref_no || ''),
          date: String(formatDateForInput(record.payment_date) || getLocalTodayYmd()),
          status: String(record.payment_status || 'Pending'),
          debitAccount: String(record.payment_debit_account || ''),
        });
        setShowBulkNEFT(Boolean(record.bulk_neft_file));
        setShowDebitAccountDropdown(Boolean(record.payment_debit_account));
        setExistingPayeeBills(Array.isArray(record.bill_files) ? record.bill_files : []);
        setExistingPaymentProofs(
          Array.isArray(record.payment_proof_files) ? record.payment_proof_files : [],
        );
        setUploadedPayeeBills([]);
        setUploadedPaymentProofs([]);
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load submitted expenditure request:', error);
          setIsReturnedWorkflowRequest(false);
          setLoadedWorkflowStatus('');
          setLoadedCurrentStage('');
          setHasDofApprovalForPaymentStatus(false);
        }
      }
    };

    loadSubmittedRequest();

    return () => {
      isCancelled = true;
    };
  }, [submittedRequestIdFromState, tagOptions]);

  useEffect(() => {
    let isCancelled = false;

    const loadApprovedBudgets = async () => {
      if (!resolvedFinanceRequestId) {
        setApprovedBudgetOptions([]);
        return;
      }

      try {
        setIsApprovedBudgetLoading(true);
        const query = new URLSearchParams({
          finance_request_id: String(resolvedFinanceRequestId),
        });
        if (budgetFiscalYearFromState) {
          query.set('fiscal_year', String(budgetFiscalYearFromState));
        }
        const budgetUrl = `/expenditure/budget/approved?${query.toString()}`;
        const response = (await authenticityUtility.get(budgetUrl)) as {
          status?: string;
          success?: boolean;
          data?: ApprovedBudgetOption[];
        };

        if (!isCancelled && (response.success === true || response.status === 'success')) {
          const normalizedRows = (Array.isArray(response.data) ? response.data : [])
            .map((row) => normalizeApprovedBudgetOption(row))
            .filter((row): row is ApprovedBudgetOption => Boolean(row));
          setApprovedBudgetOptions(normalizedRows);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load approved budgets:', error);
          setApprovedBudgetOptions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsApprovedBudgetLoading(false);
        }
      }
    };

    loadApprovedBudgets();

    return () => {
      isCancelled = true;
    };
  }, [budgetFiscalYearFromState, resolvedFinanceRequestId]);
  const rowReferenceIdFromState = (() => {
    const state = location.state as { rowReferenceId?: unknown } | null;
    const value = String(state?.rowReferenceId ?? '').trim();
    return value || null;
  })();

  const workflowBudgetLineIdFromState = (() => {
    const state = location.state as {
      workflowbudgetlineid?: unknown;
      budgetLineId?: unknown;
    } | null;

    return (
      parsePositiveIntLike(state?.workflowbudgetlineid) ?? parsePositiveIntLike(state?.budgetLineId)
    );
  })();

  const workflowRowRefFromState = (() => {
    const state = location.state as { workflowrowref?: unknown } | null;
    const value = String(state?.workflowrowref ?? '').trim();
    return value || null;
  })();
  useEffect(() => {
    let cancelled = false;

    const loadBeneficiaryOptions = async () => {
      const toOptionList = (rows: any[]): SelectOption[] =>
        rows
          .map((row: any) => String(row?.name || '').trim())
          .filter(Boolean)
          .map((name: string) => ({ value: name, label: name }));

      const nextOptions: Record<string, SelectOption[]> = {};

      try {
        const response = (await authenticityUtility.get('budget/org-units')) as any;
        const grouped = response?.data?.grouped;

        if (grouped && typeof grouped === 'object') {
          Object.entries(BENEFICIARY_TYPE_TO_ENTITY_API_TYPE).forEach(
            ([beneficiaryKey, apiType]) => {
              const rows = Array.isArray((grouped as Record<string, any[]>)[apiType])
                ? (grouped as Record<string, any[]>)[apiType]
                : [];
              nextOptions[beneficiaryKey] = toOptionList(rows);
            },
          );
        } else {
          throw new Error('Grouped org-units payload unavailable');
        }
      } catch (error) {
        console.error('Failed to fetch bulk org units, falling back to per-type calls:', error);

        for (const [beneficiaryKey, apiType] of Object.entries(
          BENEFICIARY_TYPE_TO_ENTITY_API_TYPE,
        )) {
          try {
            const response = (await authenticityUtility.get(
              `/finance-requests/org-units/${apiType}`,
            )) as any;
            const rows = Array.isArray(response?.data) ? response.data : [];
            nextOptions[beneficiaryKey] = toOptionList(rows);
          } catch (fallbackError) {
            console.error(`Failed to fetch options for ${beneficiaryKey}:`, fallbackError);
            nextOptions[beneficiaryKey] =
              FALLBACK_SUBCATEGORY_OPTIONS[beneficiaryKey]?.map((opt) => ({
                value: opt,
                label: opt,
              })) || [];
          }
        }
      }

      if (!cancelled) {
        setSubcategoryOptionsByType(nextOptions);
      }
    };

    loadBeneficiaryOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadTagOptions = async () => {
      try {
        const response = (await authenticityUtility.get('/finance-requests/tags')) as any;
        if (
          (response?.status === 'success' || response?.success === true) &&
          Array.isArray(response?.data)
        ) {
          const options = response.data
            .map((row: any) => ({
              value: String(row?.tag_name || '').trim(),
              label: String(row?.tag_name || '').trim(),
            }))
            .filter((opt: SelectOption) => opt.value.length > 0);

          setTagOptions(options.length > 0 ? options : FALLBACK_TAG_OPTIONS);
        } else {
          setTagOptions(FALLBACK_TAG_OPTIONS);
        }
      } catch (error) {
        console.error('Failed to load budget tags', error);
        setTagOptions(FALLBACK_TAG_OPTIONS);
      }
    };

    loadTagOptions();
  }, []);

  const addAdvanceRow = () => setAdvanceRows([...advanceRows, createAdvanceRow()]);
  const removeAdvanceRow = (id: string) => setAdvanceRows(advanceRows.filter((r) => r.id !== id));

  const addSettlementRow = () => setSettlementRows([...settlementRows, createSettlementRow()]);
  const removeSettlementRow = (id: string) =>
    setSettlementRows(settlementRows.filter((r) => r.id !== id));

  const calculateSum = (input: string): string => {
    try {
      if (!input) return '';
      // If it doesn't contain '+', just return the value if it's a number
      if (!input.includes('+')) {
        const val = parseFloat(input);
        return isNaN(val) ? '' : val.toString();
      }
      const parts = input.split('+').map((p) => p.trim());
      const sum = parts.reduce((acc, part) => {
        const val = parseFloat(part);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      return sum > 0 ? sum.toString() : '';
    } catch (e) {
      return '';
    }
  };

  const addExpenditureRow = () =>
    setExpenditureSubRows([...expenditureSubRows, createExpenditureRow()]);
  const removeExpenditureRow = (id: string) =>
    setExpenditureSubRows(expenditureSubRows.filter((r) => r.id !== id));

  const formatDMY = (value: string | Date | null | undefined) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const numberToIndianWords = (num: number): string => {
    if (num === 0) return 'Zero rupees only';
    const a = [
      '',
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ];
    const b = [
      '',
      '',
      'Twenty',
      'Thirty',
      'Forty',
      'Fifty',
      'Sixty',
      'Seventy',
      'Eighty',
      'Ninety',
    ];
    const inWordsBelowThousand = (n: number): string => {
      let str = '';
      if (n > 99) {
        str += a[Math.floor(n / 100)] + ' hundred ';
        n %= 100;
      }
      if (n > 19) {
        str += b[Math.floor(n / 10)]!.toLowerCase() + ' ';
        n %= 10;
      }
      if (n > 0) {
        str += a[n]!.toLowerCase().replace(/^./, (c) => c.toUpperCase()) + ' ';
      }
      return str.trim();
    };
    let n = Math.floor(num);
    let result = '';
    const crore = Math.floor(n / 10000000);
    if (crore) {
      result += inWordsBelowThousand(crore) + ' crore ';
      n %= 10000000;
    }
    const lakh = Math.floor(n / 100000);
    if (lakh) {
      result += inWordsBelowThousand(lakh) + ' lakh ';
      n %= 100000;
    }
    const thousand = Math.floor(n / 1000);
    if (thousand) {
      result += inWordsBelowThousand(thousand) + ' thousand ';
      n %= 1000;
    }
    if (n > 0) {
      result += inWordsBelowThousand(n);
    }
    const titleCased = result
      .trim()
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace(/[A-Z]{2,}/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
    return titleCased + ' Rupees only';
  };

  const MAX_AMOUNT = 999999999;

  const getSubcategoryLabel = (category: string) => {
    if (!category) return 'Sub category';
    return category;
  };

  const isMultipleSelect = (type: string) => type === 'Faculty' || type === 'Staff';

  const subcategoryOptions: OptionType[] = subcategoryOptionsByType[categoryType] || [];
  const subcategoryList: string[] = subcategoryOptions.map((option) => String(option.value));
  const hasSubcategories = subcategoryList.length > 0;

  const extraDropdownVisible =
    primaryHead === 'Events & Competitions' || primaryHead === 'Meetings & Audits';

  const addPayeeRow = () => setPayeeRows([...payeeRows, createPayeeRow()]);
  const removePayeeRow = (id: string) =>
    setPayeeRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  useEffect(() => {
    return () => {
      if (payeeLookupTimeoutRef.current) {
        window.clearTimeout(payeeLookupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!categoryType?.trim()) {
      if (!pendingPrefillTag && !financeTagFromState) {
        setSelectedTag('');
      }
      return;
    }

    setSelectedTag((prev) => {
      if (prev && prev.trim() !== '') {
        return prev;
      }

      if (categoryType === 'Staff' || categoryType === 'Faculty') {
        return 'Skilling';
      }

      if (categoryType === 'Department') {
        if (pendingPrefillTag || financeTagFromState) {
          return pendingPrefillTag || financeTagFromState || '';
        }
        return String(tagOptions?.[0]?.value || '');
      }

      if (
        categoryType === 'Centre' ||
        categoryType === 'Cell' ||
        categoryType === 'Club' ||
        categoryType === 'Section' ||
        categoryType === 'Institution' ||
        categoryType === 'Professional Body'
      ) {
        return 'Essentials';
      }

      return '';
    });
  }, [categoryType, pendingPrefillTag, financeTagFromState, tagOptions]);

  const updatePayeeRow = (rowId: string, updater: (row: PayeeRow) => PayeeRow) => {
    setPayeeRows((prev) => prev.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const closePayeeLookup = () => {
    setActivePayeeLookupRowId(null);
    setActivePayeeLookupField(null);
    setIsPayeeLookupOpen(false);
    setIsPayeeLookupLoading(false);
    setPayeeLookupResults([]);
  };

  const getLocalPayeeSuggestions = (rowId: string, query: string): PayeeLookupResult[] => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 1) {
      return [];
    }

    const normalizedParts = normalizedQuery.split(/\s+/).filter(Boolean);

    return payeeRows
      .filter((row) => row.id !== rowId)
      .filter((row) => isApprovedPayeeRecord(row))
      .filter((row) => row.payeeName || row.accountNo || row.bankName || row.ifsc || row.branchName)
      .filter((row) => {
        const haystack = [
          row.payeeName,
          row.accountNo,
          row.bankName,
          row.ifsc,
          row.branchName,
          row.accountName,
          row.panNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return normalizedParts.every((part) => haystack.includes(part));
      })
      .slice(0, 8)
      .map((row, index) => {
        const canonicalPayeeName = resolveCanonicalPayeeName(row.payeeName, row.accountName);

        return {
          id: Number(`9${index + 1}`),
          payee_id: row.payeeId ?? null,
          payee_name: canonicalPayeeName,
          account_name: canonicalPayeeName || null,
          pan_number: row.panNumber || null,
          account_no: row.accountNo,
          account_type: row.accountType || null,
          bank_name: row.bankName,
          branch_name: row.branchName,
          ifsc: row.ifsc,
          beneficiary_type: row.beneficiaryType || 'individual',
          beneficiary_org:
            resolveCanonicalBeneficiaryOrg(row.beneficiaryOrg, row.payeeName) || null,
          organization_type: row.organizationType || null,
          msme: row.msme || null,
          gstin: row.gstin || null,
          tds_details: row.tdsDetails || null,
          tds_section: row.tdsSection || null,
        };
      });
  };

  const fetchPayeeSuggestions = async (rowId: string, query: string) => {
    const normalizedQuery = query.trim();
    setActivePayeeLookupRowId(rowId);

    if (normalizedQuery.length < 2) {
      closePayeeLookup();
      return;
    }

    const requestId = ++payeeLookupRequestRef.current;
    const localMatches = getLocalPayeeSuggestions(rowId, normalizedQuery);
    setIsPayeeLookupLoading(true);

    try {
      const response = (await authenticityUtility.get(
        `/expenditure/payees?search=${encodeURIComponent(normalizedQuery)}&limit=8&status=approved`,
      )) as { status: string; data?: PayeeLookupResult[] };

      if (requestId !== payeeLookupRequestRef.current) {
        return;
      }

      const remoteMatches = Array.isArray(response.data)
        ? response.data.filter((payee) => isApprovedPayeeRecord(payee))
        : [];
      const mergedMatches = [...localMatches];
      const seenKeys = new Set(
        localMatches.map(
          (payee) =>
            `${payee.account_no || ''}|${String(payee.ifsc || '').toUpperCase()}|${resolveCanonicalPayeeName(payee.payee_name, payee.account_name)}`,
        ),
      );

      remoteMatches.forEach((payee) => {
        const key = `${payee.account_no || ''}|${String(payee.ifsc || '').toUpperCase()}|${resolveCanonicalPayeeName(payee.payee_name, payee.account_name)}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          mergedMatches.push(payee);
        }
      });

      setPayeeLookupResults(mergedMatches);
      setIsPayeeLookupOpen(true);
    } catch (error) {
      if (requestId !== payeeLookupRequestRef.current) {
        return;
      }

      console.error('Payee lookup error:', error);
      setPayeeLookupResults(localMatches);
      setIsPayeeLookupOpen(localMatches.length > 0);
      setIsPayeeLookupLoading(false);
    } finally {
      if (requestId === payeeLookupRequestRef.current) {
        setIsPayeeLookupLoading(false);
      }
    }
  };

  const schedulePayeeLookup = (rowId: string, query: string) => {
    if (payeeLookupTimeoutRef.current) {
      window.clearTimeout(payeeLookupTimeoutRef.current);
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      closePayeeLookup();
      return;
    }

    payeeLookupTimeoutRef.current = window.setTimeout(() => {
      fetchPayeeSuggestions(rowId, normalizedQuery);
    }, 250);
  };

  const handlePayeeLookupInputChange = (
    rowId: string,
    field: PayeeLookupField | 'amount',
    value: string,
  ) => {
    let nextQuery = value;
    setActivePayeeLookupRowId(rowId);
    setActivePayeeLookupField(field === 'amount' ? null : field);

    updatePayeeRow(rowId, (row) => {
      const shouldResetPayeeId =
        field !== 'amount' && !(field === 'payeeName' && Boolean(row.payeeId));
      const nextRow = {
        ...row,
        [field]: value,
        payeeId: shouldResetPayeeId ? null : row.payeeId,
      };
      if (field === 'ifsc') {
        nextRow.ifsc = value.toUpperCase();
      }

      if (field === 'accountNo' && nextRow.ifsc) {
        nextQuery = `${value} ${nextRow.ifsc}`;
      } else if (field === 'ifsc' && nextRow.accountNo) {
        nextQuery = `${nextRow.accountNo} ${nextRow.ifsc}`;
      } else if (field === 'payeeName' || field === 'bankName' || field === 'branchName') {
        nextQuery = value;
      }

      return nextRow;
    });

    if (field === 'amount') {
      return;
    }

    schedulePayeeLookup(rowId, nextQuery);
  };

  const getPayeeLookupQueryForRow = (row: PayeeRow) => {
    if (row.accountNo && row.ifsc) {
      return `${row.accountNo} ${row.ifsc}`.trim();
    }

    return (
      row.payeeName ||
      row.accountNo ||
      row.bankName ||
      row.ifsc ||
      row.branchName ||
      ''
    ).trim();
  };

  const getPayeeLookupQueryForField = (row: PayeeRow, field: PayeeLookupField) => {
    if (field === 'accountNo') {
      return row.ifsc ? `${row.accountNo} ${row.ifsc}`.trim() : row.accountNo.trim();
    }

    if (field === 'ifsc') {
      return row.accountNo ? `${row.accountNo} ${row.ifsc}`.trim() : row.ifsc.trim();
    }

    if (field === 'bankName') {
      return row.bankName.trim();
    }

    if (field === 'branchName') {
      return row.branchName.trim();
    }

    return row.payeeName.trim();
  };

  const handlePayeeLookupFocus = (row: PayeeRow, field: PayeeLookupField) => {
    setActivePayeeLookupRowId(row.id);
    setActivePayeeLookupField(field);
    const query = getPayeeLookupQueryForField(row, field);
    if (query.length >= 2) {
      fetchPayeeSuggestions(row.id, query);
    }
  };

  const handlePayeeLookupBlur = () => {
    window.setTimeout(() => {
      closePayeeLookup();
    }, 200);
  };

  const getApprovedBudgetHeadsForAdvance = (): OptionType[] => {
    const approvedHeads: string[] = approvedBudgetOptions
      .map((budget) => String(budget.head || '').trim())
      .filter(Boolean);

    return Array.from(new Set(approvedHeads)).map((head) => ({
      value: head,
      label: head,
    }));
  };

  const getApprovedBudgetHeadSearchOptions = (): OptionType[] => {
    const options: OptionType[] = [];
    const seen = new Set<string>();

    approvedBudgetOptions.forEach((budget, index) => {
      const head = String(budget.head || '').trim();
      const subHead = String(budget.subHead || '').trim();
      if (!head) return;

      const headKey = `head::${normalizeBudgetToken(head)}`;
      if (!seen.has(headKey)) {
        seen.add(headKey);
        options.push({
          value: `head::${head}`,
          label: head,
          budgetHead: head,
          subHead: '',
        });
      }

      if (!subHead) return;
      const subKey = `sub::${normalizeBudgetToken(head)}::${normalizeBudgetToken(subHead)}::${budget.budgetLineId || budget.budgetProposalId || index}`;
      if (seen.has(subKey)) return;
      seen.add(subKey);
      options.push({
        value: `sub::${budget.budgetLineId || budget.budgetProposalId || index}::${head}::${subHead}`,
        label: `${subHead} (${head})`,
        budgetHead: head,
        subHead,
        budgetLineId: budget.budgetLineId,
        budgetProposalId: budget.budgetProposalId,
      });
    });

    return options;
  };

  const getApprovedBudgetHeadSelectedOption = (
    budgetHead: string | number,
    _subHead: string | number,
    budgetLineId?: number | string | null,
  ): OptionType | null => {
    const options = getApprovedBudgetHeadSearchOptions();
    const parsedBudgetLineId = parsePositiveIntLike(budgetLineId);
    const normalizedHead = normalizeBudgetToken(budgetHead);
    let selectedHead = normalizedHead;

    if (!selectedHead && parsedBudgetLineId) {
      const matchedByLineId = approvedBudgetOptions.find(
        (option) => parsePositiveIntLike(option.budgetLineId) === parsedBudgetLineId,
      );
      selectedHead = normalizeBudgetToken(matchedByLineId?.head);
    }

    const matched = options.find(
      (option) =>
        normalizeBudgetToken(option.budgetHead) === selectedHead &&
        !normalizeBudgetToken(option.subHead),
    );
    if (matched) return matched;

    const fallbackHead = String(budgetHead || '').trim();
    return fallbackHead
      ? {
          value: `legacy-head::${fallbackHead}`,
          label: fallbackHead,
          budgetHead: fallbackHead,
          subHead: '',
          budgetLineId: parsedBudgetLineId,
        }
      : null;
  };

  const filterApprovedBudgetHeadOption = (candidate: any, input: string) => {
    const query = normalizeBudgetToken(input);
    const option = candidate?.data || {};
    const subHead = normalizeBudgetToken(option.subHead);
    if (!query) return !subHead;
    return [option.label, option.budgetHead, option.subHead]
      .map((value) => normalizeBudgetToken(value))
      .some((value) => value.includes(query));
  };

  // Unplanned Head of Accounts options always carry a sub-head (label is
  // "head - subHead"), so the planned-budget filter above (which hides any
  // option with a sub-head when no text is typed) would drop every option.
  // Here we show all options when the query is empty and substring-match
  // against head/sub-head/label otherwise.
  const filterUnplannedHeadOfAccountOption = (candidate: any, input: string) => {
    const query = normalizeBudgetToken(input);
    if (!query) return true;
    const option = candidate?.data || {};
    return [option.label, option.budgetHead, option.subHead]
      .map((value) => normalizeBudgetToken(value))
      .some((value) => value.includes(query));
  };

  const getApprovedSubHeadOptionsForAdvance = (budgetHead: string | number): OptionType[] => {
    const normalizedHead = normalizeBudgetToken(budgetHead);
    if (!normalizedHead) return [];
    return approvedBudgetOptions
      .filter((budget) => normalizeBudgetToken(budget.head) === normalizedHead)
      .map((budget, index) => {
        const subHead = String(budget.subHead || '').trim();
        return {
          value: `sub::${budget.budgetLineId || budget.budgetProposalId || index}::${subHead}`,
          label: subHead,
          budgetHead: budget.head,
          subHead,
          budgetLineId: budget.budgetLineId,
          budgetProposalId: budget.budgetProposalId,
        };
      })
      .filter((option) => Boolean(option.subHead)) as OptionType[];
  };

  const getApprovedSubHeadSelectedOption = (
    budgetHead: string | number,
    subHead: string | number,
    budgetLineId?: number | string | null,
  ): OptionType | null => {
    const options = getApprovedSubHeadOptionsForAdvance(budgetHead);
    const parsedBudgetLineId = parsePositiveIntLike(budgetLineId);
    const normalizedSubHead = normalizeBudgetToken(subHead);

    if (parsedBudgetLineId && normalizedSubHead) {
      const matchedByBoth = options.find(
        (option) =>
          parsePositiveIntLike(option.budgetLineId) === parsedBudgetLineId &&
          normalizeBudgetToken(option.subHead) === normalizedSubHead,
      );
      if (matchedByBoth) return matchedByBoth;
    }

    if (normalizedSubHead) {
      const matchedBySubHead = options.find(
        (option) => normalizeBudgetToken(option.subHead) === normalizedSubHead,
      );
      if (matchedBySubHead) return matchedBySubHead;
    }

    if (parsedBudgetLineId) {
      const matchedByLineId = options.find(
        (option) => parsePositiveIntLike(option.budgetLineId) === parsedBudgetLineId,
      );
      if (matchedByLineId) return matchedByLineId;
    }

    const fallbackHead = String(budgetHead || '').trim();
    const fallbackSubHead = String(subHead || '').trim();
    return fallbackSubHead
      ? {
          value: `legacy-sub::${fallbackHead}::${fallbackSubHead}`,
          label: fallbackSubHead,
          budgetHead: fallbackHead,
          subHead: fallbackSubHead,
          budgetLineId: parsedBudgetLineId,
        }
      : null;
  };

  const findApprovedBudgetOption = (
    budgetHead: string | number,
    subHead: string | number,
    budgetLineId?: number | string | null,
  ) => {
    const parsedBudgetLineId = parsePositiveIntLike(budgetLineId);
    const normalizedHead = normalizeBudgetToken(budgetHead);
    const normalizedSubHead = normalizeBudgetToken(subHead);

    if (parsedBudgetLineId && normalizedSubHead) {
      const matchedByBoth = approvedBudgetOptions.find(
        (budget) =>
          parsePositiveIntLike(budget.budgetLineId) === parsedBudgetLineId &&
          normalizeBudgetToken(budget.subHead) === normalizedSubHead,
      );
      if (matchedByBoth) return matchedByBoth;
    }

    if (normalizedHead && normalizedSubHead) {
      const matchedByHeadAndSubHead = approvedBudgetOptions.find(
        (budget) =>
          normalizeBudgetToken(budget.head) === normalizedHead &&
          normalizeBudgetToken(budget.subHead) === normalizedSubHead,
      );
      if (matchedByHeadAndSubHead) return matchedByHeadAndSubHead;
    }

    if (parsedBudgetLineId) {
      const matchedByLineId = approvedBudgetOptions.find(
        (budget) => parsePositiveIntLike(budget.budgetLineId) === parsedBudgetLineId,
      );
      if (matchedByLineId) return matchedByLineId;
    }

    return null;
  };

  const getApprovedBudgetAmount = (budget: ApprovedBudgetOption | null) =>
    budget ? String(budget.totalAmount ?? '') : '';

  const getUnplannedHeadOfAccountOptions = (): OptionType[] =>
    approvedBudgetOptions
      .map((budget, index) => {
        const head = String(budget.head || '').trim();
        const subHead = String(budget.subHead || '').trim();
        const lineId = parsePositiveIntLike(budget.budgetLineId);
        const proposalId = parsePositiveIntLike(budget.budgetProposalId);
        const optionId = lineId || proposalId || index + 1;
        if (!head || !optionId) return null;

        const remainingAmount = Number(budget.remainingAmount || 0);
        return {
          value: `account::${optionId}`,
          label: head,
          budgetHead: head,
          subHead: '',
          budgetLineId: lineId,
          budgetProposalId: proposalId,
          approvedAmount: Number(budget.totalAmount || 0),
          remainingAmount: Number.isFinite(remainingAmount) ? remainingAmount : 0,
          optionIndex: index,
        } as OptionType;
      })
      .filter((option): option is OptionType => Boolean(option));

  const getUnplannedHeadOfAccountSelectedOption = (row: UnplannedBudgetRow): OptionType | null => {
    const lineId = parsePositiveIntLike(row.headOfAccountBudgetLineId);
    const normalizedAccount = normalizeBudgetToken(row.headOfAccount);

    if (!lineId && !normalizedAccount) return null;

    const options = getUnplannedHeadOfAccountOptions();
    if (lineId) {
      const byLineId = options.find(
        (option) => parsePositiveIntLike(option.budgetLineId) === lineId,
      );
      if (byLineId) return byLineId;
    }

    const byHead = options.find(
      (option) => normalizeBudgetToken(option.budgetHead) === normalizedAccount,
    );
    if (byHead) return byHead;

    const byLabel = options.find(
      (option) => normalizeBudgetToken(option.label) === normalizedAccount,
    );
    if (byLabel) return byLabel;

    return row.headOfAccount
      ? {
          value: `account::legacy::${row.headOfAccount}`,
          label: row.headOfAccount,
          budgetHead: row.headOfAccount,
          subHead: '',
          budgetLineId: lineId,
          budgetProposalId: row.headOfAccountBudgetProposalId,
        }
      : null;
  };

  const getUnplannedHeadOfAccountAmount = (row: UnplannedBudgetRow): number | null => {
    const selected = getUnplannedHeadOfAccountSelectedOption(row);
    if (
      selected &&
      selected.remainingAmount === undefined &&
      selected.approvedAmount === undefined
    ) {
      return null;
    }
    const amount = Number(selected?.remainingAmount ?? selected?.approvedAmount ?? 0);
    return Number.isFinite(amount) ? amount : 0;
  };

  const getUnplannedBudgetAmountPlaceholder = (row: UnplannedBudgetRow): string => {
    const amount = getUnplannedHeadOfAccountAmount(row);
    return amount === null
      ? 'Balance unavailable'
      : amount > 0
        ? `₹ ${amount.toLocaleString('en-IN')}`
        : '₹ 0';
  };

  const getUnplannedBudgetHeadOptions = (): Array<
    OptionType | { label: string; options: OptionType[] }
  > =>
    BUDGET_HEAD_GROUPS.map((group) => ({
      label: group.label,
      options: group.options.map((head) => ({
        value: head,
        label: head,
        budgetHead: head,
      })),
    })).filter((group) => group.options.length > 0);

  const getUnplannedBudgetHeadSelectedOption = (budgetHead: string | number): OptionType | null =>
    getSelectedOption(budgetHead, getUnplannedBudgetHeadOptions()) ||
    (budgetHead
      ? {
          value: String(budgetHead),
          label: String(budgetHead),
          budgetHead: String(budgetHead),
        }
      : null);

  const getCatalogSubHeadOptions = (budgetHead: string | number): OptionType[] =>
    (SUB_HEAD_BY_BUDGET_HEAD[String(budgetHead)] || []).filter(Boolean).map((subHead) => ({
      value: subHead,
      label: subHead,
      budgetHead: String(budgetHead),
      subHead,
    }));

  const getCatalogSubHeadSelectedOption = (
    budgetHead: string | number,
    subHead: string | number,
  ): OptionType | null => {
    const normalizedSubHead = normalizeBudgetToken(subHead);
    if (!normalizedSubHead) return null;

    return (
      getCatalogSubHeadOptions(budgetHead).find(
        (option) => normalizeBudgetToken(option.subHead) === normalizedSubHead,
      ) || null
    );
  };

  const getUnplannedBudgetDescription = (head = '', subHead = ''): string =>
    [head, subHead]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' - ');

  const updateUnplannedRow = (
    rowId: string,
    patch: Partial<UnplannedBudgetRow> | ((row: UnplannedBudgetRow) => UnplannedBudgetRow),
  ) => {
    setUnplannedRows((rows) =>
      rows.map((row) =>
        row.id === rowId ? (typeof patch === 'function' ? patch(row) : { ...row, ...patch }) : row,
      ),
    );
  };

  const addUnplannedRow = () => setUnplannedRows((rows) => [...rows, createUnplannedBudgetRow()]);

  const removeUnplannedRow = (rowId: string) =>
    setUnplannedRows((rows) =>
      rows.length > 1 ? rows.filter((row) => row.id !== rowId) : [createUnplannedBudgetRow()],
    );

  const isUnplannedRowFilled = (row: UnplannedBudgetRow): boolean =>
    Boolean(row.budgetHead.trim() && row.subHead.trim() && parseAmountValue(row.amount) > 0);

  const handleUnplannedHeadOfAccountForFormChange = (selected: OptionType | null) => {
    const label = String(selected?.label || selected?.budgetHead || '').trim();
    const budgetLineId = parsePositiveIntLike(selected?.budgetLineId);
    const budgetProposalId = parsePositiveIntLike(selected?.budgetProposalId);

    setUnplannedRows((rows) => {
      const currentRows = rows.length ? rows : [createUnplannedBudgetRow()];
      return currentRows.map((row) => ({
        ...row,
        headOfAccount: label,
        headOfAccountBudgetLineId: budgetLineId,
        headOfAccountBudgetProposalId: budgetProposalId,
      }));
    });
  };

  const handleUnplannedBudgetHeadChange = (rowId: string, selected: OptionType | null) => {
    const head = String(selected?.budgetHead || selected?.value || '').trim();

    updateUnplannedRow(rowId, {
      budgetHead: head,
      subHead: '',
      description: getUnplannedBudgetDescription(head, ''),
    });
  };

  useEffect(() => {
    if (!showUnplannedBudget || !approvedBudgetOptions.length) {
      return;
    }

    setUnplannedRows((rows) =>
      rows.map((row) => {
        if (!row.headOfAccount) return row;
        const selected = getUnplannedHeadOfAccountSelectedOption(row);
        const resolvedLineId = parsePositiveIntLike(selected?.budgetLineId);
        if (!resolvedLineId) return row;

        const resolvedProposalId = parsePositiveIntLike(selected?.budgetProposalId);
        const resolvedLabel = String(selected?.label || selected?.budgetHead || '').trim();
        const currentLineId = parsePositiveIntLike(row.headOfAccountBudgetLineId);
        const currentProposalId = parsePositiveIntLike(row.headOfAccountBudgetProposalId);

        if (
          currentLineId === resolvedLineId &&
          currentProposalId === resolvedProposalId &&
          (!resolvedLabel || resolvedLabel === row.headOfAccount)
        ) {
          return row;
        }

        return {
          ...row,
          headOfAccount: resolvedLabel || row.headOfAccount,
          headOfAccountBudgetLineId: resolvedLineId,
          headOfAccountBudgetProposalId: resolvedProposalId,
        };
      }),
    );
  }, [approvedBudgetOptions, showUnplannedBudget]);

  const handleUnplannedBudgetSubHeadChange = (rowId: string, selected: OptionType | null) => {
    const subHead = String(selected?.subHead || '').trim();

    updateUnplannedRow(rowId, (row) => ({
      ...row,
      subHead,
      description: getUnplannedBudgetDescription(row.budgetHead, subHead),
    }));
  };

  const hydrateRowsFromApprovedBudgets = <
    T extends {
      budgetHead: string | number;
      subHead: string | number;
      budget: string;
      budgetLineId?: number | null;
      budgetProposalId?: number | null;
    },
  >(
    rows: T[],
  ): T[] => {
    if (!approvedBudgetOptions.length) return rows;

    return rows.map((row) => {
      const budgetLineId = Number(row.budgetLineId || 0) || null;
      const normalizedHead = normalizeBudgetToken(row.budgetHead);
      const normalizedSubHead = normalizeBudgetToken(row.subHead);
      const matchedBudget = budgetLineId
        ? approvedBudgetOptions.find(
            (budget) =>
              Number(budget.budgetLineId || 0) === budgetLineId &&
              normalizeBudgetToken(budget.head) === normalizedHead &&
              normalizeBudgetToken(budget.subHead) === normalizedSubHead,
          ) ||
          approvedBudgetOptions.find(
            (budget) =>
              normalizeBudgetToken(budget.head) === normalizedHead &&
              normalizeBudgetToken(budget.subHead) === normalizedSubHead,
          )
        : null;

      if (!matchedBudget) return row;

      return {
        ...row,
        budgetHead: row.budgetHead || matchedBudget.head,
        subHead: row.subHead || matchedBudget.subHead,
        budget: getApprovedBudgetAmount(matchedBudget),
        budgetLineId: row.budgetLineId ?? matchedBudget.budgetLineId,
        budgetProposalId: row.budgetProposalId ?? matchedBudget.budgetProposalId,
      };
    });
  };

  useEffect(() => {
    if (!approvedBudgetOptions.length) return;

    setAdvanceRows((rows) => hydrateRowsFromApprovedBudgets(rows));
    setSettlementRows((rows) => hydrateRowsFromApprovedBudgets(rows));
    setExpenditureSubRows((rows) => hydrateRowsFromApprovedBudgets(rows));
  }, [approvedBudgetOptions]);

  const getBudgetDisplayValue = (rowBudget: string) => {
    if (rowBudget !== '') {
      return `₹ ${Number(rowBudget || 0).toLocaleString('en-IN')}`;
    }

    return '₹ 0';
  };

  const updateAdvanceRow = (rowId: string, updater: (row: AdvanceFormRow) => AdvanceFormRow) => {
    setAdvanceRows((prev) => prev.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const updateSettlementRow = (
    rowId: string,
    updater: (row: SettlementFormRow) => SettlementFormRow,
  ) => {
    setSettlementRows((prev) => prev.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const updateExpenditureRow = (
    rowId: string,
    updater: (row: ExpenditureFormRow) => ExpenditureFormRow,
  ) => {
    setExpenditureSubRows((prev) => prev.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const loadPreAdvanceSummary = async (
    rowId: string,
    budgetLineId: number | null,
    budgetHead: string | number,
    subHead: string | number,
  ) => {
    const normalizedHead = String(budgetHead || '').trim();
    const normalizedSubHead = String(subHead || '').trim();

    if (!budgetLineId && (!normalizedHead || !normalizedSubHead)) {
      updateAdvanceRow(rowId, (row) => ({ ...row, preAdvance: '0' }));
      return;
    }

    try {
      const query = new URLSearchParams();
      if (budgetLineId) query.set('budget_line_id', String(budgetLineId));
      if (normalizedHead) query.set('head', normalizedHead);
      if (normalizedSubHead) query.set('sub_head', normalizedSubHead);
      if (resolvedFinanceRequestId)
        query.set('finance_request_id', String(resolvedFinanceRequestId));
      if (dashboardRowIdFromState) query.set('dashboard_row_id', dashboardRowIdFromState);
      if (workflowRowRefFromState ?? rowReferenceIdFromState) {
        query.set('workflowrowref', workflowRowRefFromState ?? rowReferenceIdFromState ?? '');
      }
      if (sourceRequestIdFromState)
        query.set('source_request_id', String(sourceRequestIdFromState));
      if (
        !dashboardRowIdFromState &&
        !(workflowRowRefFromState ?? rowReferenceIdFromState) &&
        rowIndexFromState
      ) {
        query.set('row_index', String(rowIndexFromState));
      }

      const response = (await authenticityUtility.get(
        `/expenditure/advance-summary?${query.toString()}`,
      )) as {
        success?: boolean;
        status?: string;
        data?: { preAdvance?: number };
      };

      if (response.success === true || response.status === 'success') {
        const preAdvance = Number(response.data?.preAdvance || 0);
        updateAdvanceRow(rowId, (row) => ({
          ...row,
          preAdvance: String(preAdvance),
        }));
      }
    } catch (error) {
      console.error('Failed to load pre-advance summary:', error);
    }
  };

  const totalAdvanceAmount = advanceRows.reduce((sum, row) => {
    const amount = Number(
      String(row.advance || '')
        .replace(/,/g, '')
        .trim(),
    );
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const totalSettlementAmount = settlementRows.reduce((sum, row) => {
    const amount = Number(
      String(row.settlement || '')
        .replace(/,/g, '')
        .trim(),
    );
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const totalSettlementAdvanceAmount = settlementRows.reduce((sum, row) => {
    const amount = Number(
      String(row.advance || '')
        .replace(/,/g, '')
        .trim(),
    );
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const totalExpenditureAmount = expenditureSubRows.reduce((sum, row) => {
    const amount = Number(
      String(row.autoSum || row.expenditure || '')
        .replace(/,/g, '')
        .trim(),
    );
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const getUnplannedRowAmountValue = (row: UnplannedBudgetRow): number => {
    if (activeTab === 'Expenditure') {
      return evaluateArithmeticExpression(row.amount);
    }
    return parseAmountValue(row.amount);
  };

  const unplannedBudgetTotal = showUnplannedBudget
    ? unplannedRows.reduce((sum, row) => sum + getUnplannedRowAmountValue(row), 0)
    : 0;
  const hasUnplannedBudgetPreview =
    showUnplannedBudget || unplannedRows.some((row) => getUnplannedRowAmountValue(row) > 0);
  const totalAdvanceDisplayAmount =
    totalAdvanceAmount + (activeTab === 'Advance' ? unplannedBudgetTotal : 0);
  const totalSettlementDisplayAmount =
    totalSettlementAmount + (activeTab === 'Settlement' ? unplannedBudgetTotal : 0);
  const totalExpenditureDisplayAmount =
    totalExpenditureAmount + (activeTab === 'Expenditure' ? unplannedBudgetTotal : 0);
  const settlementAdjustmentDifference = Number(
    (totalSettlementDisplayAmount - totalSettlementAdvanceAmount).toFixed(2),
  );
  const settlementAdjustmentAmount = Math.abs(settlementAdjustmentDifference);
  const hasSettlementAdjustment = activeTab === 'Settlement' && settlementAdjustmentAmount > 0;
  const settlementAdjustmentLabel =
    settlementAdjustmentDifference > 0 ? 'Amount to be received' : 'Amount to be returned';
  const settlementAdjustmentColor = settlementAdjustmentDifference > 0 ? '#087f23' : '#c62828';

  const getPayeeTransactionTotal = (rows: PayeeRow[]): number =>
    rows.reduce((sum, row) => {
      const amount = parseAmountValue(row.amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

  const hasAnyPayeeRowValue = (row: PayeeRow): boolean => {
    if (parseAmountValue(row.amount) > 0) return true;
    return [
      row.payeeName,
      row.accountNo,
      row.ifsc,
      row.bankName,
      row.branchName,
      row.mode,
      row.url,
      row.accountName,
      row.panNumber,
      row.accountType,
      row.beneficiaryOrg,
      row.organizationType,
      row.msme,
      row.gstin,
      row.tdsDetails,
      row.tdsSection,
    ].some((value) => String(value || '').trim() !== '');
  };

  const isPayeeRowReadyForAdd = (row: PayeeRow): boolean => {
    const hasTransactionFields = Boolean(row.amount && row.mode);
    if (!hasTransactionFields) return false;
    if (isCashPaymentMode(row.mode)) return true;
    if (!row.payeeName) return false;
    return Boolean(row.accountNo && row.bankName && row.ifsc && row.branchName);
  };

  const handleAdvanceBudgetHeadChange = (rowId: string, budgetHeadValue: string) => {
    updateAdvanceRow(rowId, (row) => ({
      ...row,
      budgetHead: budgetHeadValue,
      subHead: '',
      budget: '',
      preAdvance: '0',
      advance: row.advance,
      budgetLineId: null,
      budgetProposalId: null,
    }));
  };

  const handleAdvanceSubHeadChange = async (
    rowId: string,
    subHeadValue: string,
    selected?: OptionType | null,
  ) => {
    const row = advanceRows.find((entry) => entry.id === rowId);
    const budgetHeadValue = String(row?.budgetHead || '').trim();

    const selectedBudget = findApprovedBudgetOption(
      budgetHeadValue,
      subHeadValue,
      selected?.budgetLineId,
    );

    updateAdvanceRow(rowId, (currentRow) => ({
      ...currentRow,
      subHead: subHeadValue,
      budget: getApprovedBudgetAmount(selectedBudget),
      preAdvance: '',
      budgetLineId: selectedBudget?.budgetLineId ?? null,
      budgetProposalId: selectedBudget?.budgetProposalId ?? null,
    }));

    await loadPreAdvanceSummary(
      rowId,
      selectedBudget?.budgetLineId ?? null,
      budgetHeadValue,
      subHeadValue,
    );
  };

  const handleAdvanceBudgetHeadSearchChange = async (
    rowId: string,
    selected: OptionType | null,
  ) => {
    const budgetHeadValue = String(selected?.budgetHead || selected?.value || '')
      .replace(/^head::/, '')
      .trim();
    const subHeadValue = String(selected?.subHead || '').trim();

    if (!subHeadValue) {
      handleAdvanceBudgetHeadChange(rowId, budgetHeadValue);
      return;
    }

    const selectedBudget = findApprovedBudgetOption(
      budgetHeadValue,
      subHeadValue,
      selected?.budgetLineId,
    );
    updateAdvanceRow(rowId, (row) => ({
      ...row,
      budgetHead: budgetHeadValue,
      subHead: subHeadValue,
      budget: getApprovedBudgetAmount(selectedBudget),
      preAdvance: '',
      budgetLineId: selectedBudget?.budgetLineId ?? null,
      budgetProposalId: selectedBudget?.budgetProposalId ?? null,
    }));

    await loadPreAdvanceSummary(
      rowId,
      selectedBudget?.budgetLineId ?? null,
      budgetHeadValue,
      subHeadValue,
    );
  };

  const handleSettlementBudgetHeadChange = (rowId: string, budgetHeadValue: string) => {
    updateSettlementRow(rowId, (row) => ({
      ...row,
      budgetHead: budgetHeadValue,
      subHead: '',
      budget: '',
      advance: '',
      budgetLineId: null,
      budgetProposalId: null,
    }));
  };

  const loadSettlementAdvanceSummary = async (
    rowId: string,
    budgetLineId: number | null,
    budgetHead: string | number,
    subHead: string | number,
  ) => {
    const normalizedHead = String(budgetHead || '').trim();
    const normalizedSubHead = String(subHead || '').trim();

    if (!budgetLineId && (!normalizedHead || !normalizedSubHead)) {
      updateSettlementRow(rowId, (row) => ({ ...row, advance: '0' }));
      return;
    }

    try {
      const query = new URLSearchParams();
      if (budgetLineId) query.set('budget_line_id', String(budgetLineId));
      if (normalizedHead) query.set('head', normalizedHead);
      if (normalizedSubHead) query.set('sub_head', normalizedSubHead);
      if (resolvedFinanceRequestId)
        query.set('finance_request_id', String(resolvedFinanceRequestId));
      if (dashboardRowIdFromState) query.set('dashboard_row_id', dashboardRowIdFromState);
      if (workflowRowRefFromState ?? rowReferenceIdFromState) {
        query.set('workflowrowref', workflowRowRefFromState ?? rowReferenceIdFromState ?? '');
      }
      if (sourceRequestIdFromState)
        query.set('source_request_id', String(sourceRequestIdFromState));
      if (
        !dashboardRowIdFromState &&
        !(workflowRowRefFromState ?? rowReferenceIdFromState) &&
        rowIndexFromState
      ) {
        query.set('row_index', String(rowIndexFromState));
      }

      const response = (await authenticityUtility.get(
        `/expenditure/advance-summary?${query.toString()}`,
      )) as {
        success?: boolean;
        status?: string;
        data?: { preAdvance?: number };
      };

      if (response.success === true || response.status === 'success') {
        const advance = Number(response.data?.preAdvance || 0);
        updateSettlementRow(rowId, (row) => ({
          ...row,
          advance: String(advance),
        }));
      }
    } catch (error) {
      console.error('Failed to load settlement advance summary:', error);
    }
  };

  const handleSettlementSubHeadChange = async (
    rowId: string,
    subHeadValue: string,
    selected?: OptionType | null,
  ) => {
    const row = settlementRows.find((entry) => entry.id === rowId);
    const budgetHeadValue = String(row?.budgetHead || '').trim();
    const selectedBudget = findApprovedBudgetOption(
      budgetHeadValue,
      subHeadValue,
      selected?.budgetLineId,
    );

    updateSettlementRow(rowId, (currentRow) => ({
      ...currentRow,
      subHead: subHeadValue,
      budget: getApprovedBudgetAmount(selectedBudget),
      budgetLineId: selectedBudget?.budgetLineId ?? null,
      budgetProposalId: selectedBudget?.budgetProposalId ?? null,
    }));

    await loadSettlementAdvanceSummary(
      rowId,
      selectedBudget?.budgetLineId ?? null,
      budgetHeadValue,
      subHeadValue,
    );
  };

  const handleSettlementBudgetHeadSearchChange = async (
    rowId: string,
    selected: OptionType | null,
  ) => {
    const budgetHeadValue = String(selected?.budgetHead || selected?.value || '')
      .replace(/^head::/, '')
      .trim();
    const subHeadValue = String(selected?.subHead || '').trim();

    if (!subHeadValue) {
      handleSettlementBudgetHeadChange(rowId, budgetHeadValue);
      return;
    }

    const selectedBudget = findApprovedBudgetOption(
      budgetHeadValue,
      subHeadValue,
      selected?.budgetLineId,
    );
    updateSettlementRow(rowId, (row) => ({
      ...row,
      budgetHead: budgetHeadValue,
      subHead: subHeadValue,
      budget: getApprovedBudgetAmount(selectedBudget),
      budgetLineId: selectedBudget?.budgetLineId ?? null,
      budgetProposalId: selectedBudget?.budgetProposalId ?? null,
    }));

    await loadSettlementAdvanceSummary(
      rowId,
      selectedBudget?.budgetLineId ?? null,
      budgetHeadValue,
      subHeadValue,
    );
  };

  const handleExpenditureBudgetHeadChange = (rowId: string, budgetHeadValue: string) => {
    updateExpenditureRow(rowId, (row) => ({
      ...row,
      budgetHead: budgetHeadValue,
      subHead: '',
      budget: '',
      budgetLineId: null,
      budgetProposalId: null,
    }));
  };

  const handleExpenditureSubHeadChange = (
    rowId: string,
    subHeadValue: string,
    selected?: OptionType | null,
  ) => {
    const row = expenditureSubRows.find((entry) => entry.id === rowId);
    const budgetHeadValue = String(row?.budgetHead || '').trim();
    const selectedBudget = findApprovedBudgetOption(
      budgetHeadValue,
      subHeadValue,
      selected?.budgetLineId,
    );

    updateExpenditureRow(rowId, (currentRow) => ({
      ...currentRow,
      subHead: subHeadValue,
      budget: getApprovedBudgetAmount(selectedBudget),
      budgetLineId: selectedBudget?.budgetLineId ?? null,
      budgetProposalId: selectedBudget?.budgetProposalId ?? null,
    }));
  };

  const handleExpenditureBudgetHeadSearchChange = (rowId: string, selected: OptionType | null) => {
    const budgetHeadValue = String(selected?.budgetHead || selected?.value || '')
      .replace(/^head::/, '')
      .trim();
    const subHeadValue = String(selected?.subHead || '').trim();

    if (!subHeadValue) {
      handleExpenditureBudgetHeadChange(rowId, budgetHeadValue);
      return;
    }

    const selectedBudget = findApprovedBudgetOption(
      budgetHeadValue,
      subHeadValue,
      selected?.budgetLineId,
    );
    updateExpenditureRow(rowId, (row) => ({
      ...row,
      budgetHead: budgetHeadValue,
      subHead: subHeadValue,
      budget: getApprovedBudgetAmount(selectedBudget),
      budgetLineId: selectedBudget?.budgetLineId ?? null,
      budgetProposalId: selectedBudget?.budgetProposalId ?? null,
    }));
  };

  const applyPayeeLookupSelection = (rowId: string, payee: PayeeLookupResult) => {
    const canonicalPayeeName = resolveCanonicalPayeeName(payee.payee_name, payee.account_name);

    updatePayeeRow(rowId, (row) => ({
      ...row,
      payeeId: payee.payee_id ?? payee.id ?? row.payeeId ?? null,
      approvalStatus: payee.approval_status || 'approved',
      payeeName: canonicalPayeeName || row.payeeName,
      accountNo: String(payee.account_no || '').trim() || row.accountNo,
      bankName: String(payee.bank_name || '').trim() || row.bankName,
      ifsc:
        String(payee.ifsc || '')
          .trim()
          .toUpperCase() || row.ifsc,
      branchName: String(payee.branch_name || '').trim() || row.branchName,
      accountName: canonicalPayeeName || row.accountName,
      panNumber: String(payee.pan_number || '').trim() || row.panNumber,
      accountType: String(payee.account_type || '').trim() || row.accountType,
      beneficiaryType:
        String(payee.beneficiary_type || '')
          .trim()
          .toLowerCase() === 'organization'
          ? 'organization'
          : 'individual',
      beneficiaryOrg: resolveCanonicalBeneficiaryOrg(payee.beneficiary_org, payee.payee_name),
      organizationType: String(payee.organization_type || '').trim(),
      msme: String(payee.msme || '').trim(),
      gstin: String(payee.gstin || '').trim(),
      tdsDetails: '',
      tdsSection: '',
    }));

    closePayeeLookup();
  };

  const renderPayeeLookupDropdown = (rowId: string, field: PayeeLookupField) => {
    if (
      activePayeeLookupRowId !== rowId ||
      activePayeeLookupField !== field ||
      !isPayeeLookupOpen
    ) {
      return null;
    }

    return (
      <div className="payee-search-dropdown">
        {isPayeeLookupLoading ? (
          <div className="payee-search-empty">Searching payees...</div>
        ) : payeeLookupResults.length > 0 ? (
          payeeLookupResults.map((payee) => (
            <div
              key={`${payee.payee_id || payee.id}-${payee.account_no || ''}-${payee.ifsc || ''}`}
              className="payee-search-item"
              onMouseDown={(event) => {
                event.preventDefault();
                applyPayeeLookupSelection(rowId, payee);
              }}
            >
              <div className="payee-search-item-name">
                {resolveCanonicalPayeeName(payee.payee_name, payee.account_name) || 'Unnamed payee'}
              </div>
              <div className="payee-search-item-sub">
                {[payee.bank_name, payee.account_no, payee.ifsc, payee.branch_name]
                  .filter(Boolean)
                  .join(' | ')}
              </div>
            </div>
          ))
        ) : (
          <div className="payee-search-empty">No saved payees found.</div>
        )}
      </div>
    );
  };

  const handlePayeeBillUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (!selectedFile) return;

    if (existingPayeeBills.length > 0) {
      e.target.value = '';
      showAlert('Only one bills PDF can be attached for this request.', 'warning');
      return;
    }

    const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      e.target.value = '';
      showAlert('Bills upload accepts only PDF files (.pdf).', 'warning');
      return;
    }

    setUploadedPayeeBills([selectedFile]);
    e.target.value = '';
  };

  const handlePaymentProofUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    const allowedExtensions = new Set(['pdf', 'png', 'jpg', 'jpeg']);
    const invalidFile = selectedFiles.find((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      return !allowedExtensions.has(extension);
    });

    if (invalidFile) {
      e.target.value = '';
      showAlert(
        'Payment proof accepts only PDF or image files (.pdf, .png, .jpg, .jpeg).',
        'warning',
      );
      return;
    }

    setUploadedPaymentProofs((prev) => [...prev, ...selectedFiles]);
    e.target.value = '';
  };

  const handleBulkNeftUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setBulkNeftFile(null);
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isExcelFile = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

    if (!isExcelFile) {
      setBulkNeftFile(null);
      if (bulkNeftInputRef.current) {
        bulkNeftInputRef.current.value = '';
      }
      showAlert('Bulk NEFT upload accepts only Excel files (.xlsx or .xls).', 'warning');
      return;
    }

    setBulkNeftFile(file);
  };

  const handleDownloadBulkNeftTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${authenticityUtility.getBaseURL()}/api/expenditure/templates/bulk-neft`,
        {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );

      if (!response.ok) {
        throw new Error(`Template download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const filename =
        filenameMatch?.[1] || `bulk-neft-template-v${BULK_NEFT_TEMPLATE_VERSION}.xls`;
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Bulk NEFT template download error:', error);
      showAlert('Unable to download the Bulk NEFT template right now.', 'error');
    }
  };

  const removeBulkNeftFile = () => {
    setBulkNeftFile(null);
    if (bulkNeftInputRef.current) {
      bulkNeftInputRef.current.value = '';
    }
  };

  const removePayeeBill = (index: number) => {
    setUploadedPayeeBills((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPayeeBill = (index: number) => {
    setExistingPayeeBills((prev) => prev.filter((_, i) => i !== index));
  };

  const removePaymentProof = (index: number) => {
    setUploadedPaymentProofs((prev) => prev.filter((_, i) => i !== index));
  };

  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
  }>({
    show: false,
    message: '',
    type: 'info',
  });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType = 'info',
    title?: string,
    showCancel = false,
    confirmText = 'OK',
    onConfirm?: () => void,
  ) => {
    setAlertConfig({
      show: true,
      message,
      type,
      title,
      onConfirm,
      showCancel,
      confirmText,
    });
  };

  const closeAlert = () => setAlertConfig((prev) => ({ ...prev, show: false }));

  function parseAmountValue(value: unknown): number {
    const normalized = String(value ?? '')
      .replace(/,/g, '')
      .trim();
    if (!normalized) return 0;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const formatAmountInputValue = (value: number): string => {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  };

  const toNumber = (value: unknown) => {
    const n = Number(
      String(value ?? '')
        .replace(/,/g, '')
        .trim(),
    );
    return Number.isFinite(n) ? n : 0;
  };
  function evaluateArithmeticExpression(input: string) {
    const expression = String(input || '').replace(/\s+/g, '');
    if (!expression || !/^[\d+\-*/().]+$/.test(expression)) return 0;
    const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/]/g);
    if (!tokens) return 0;

    const output: string[] = [];
    const operators: string[] = [];
    const precedence: Record<string, number> = {
      '+': 1,
      '-': 1,
      '*': 2,
      '/': 2,
    };

    for (const token of tokens) {
      if (/^\d+(?:\.\d+)?$/.test(token)) {
        output.push(token);
        continue;
      }
      if (token === '(') {
        operators.push(token);
        continue;
      }
      if (token === ')') {
        while (operators.length && operators[operators.length - 1] !== '(') {
          output.push(operators.pop() as string);
        }
        if (!operators.length) return 0;
        operators.pop();
        continue;
      }
      while (
        operators.length &&
        operators[operators.length - 1] !== '(' &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        output.push(operators.pop() as string);
      }
      operators.push(token);
    }

    while (operators.length) {
      const op = operators.pop() as string;
      if (op === '(' || op === ')') return 0;
      output.push(op);
    }

    const stack: number[] = [];
    for (const token of output) {
      if (/^\d+(?:\.\d+)?$/.test(token)) {
        stack.push(Number(token));
        continue;
      }
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return 0;
      if (token === '+') stack.push(a + b);
      else if (token === '-') stack.push(a - b);
      else if (token === '*') stack.push(a * b);
      else if (token === '/') stack.push(b === 0 ? 0 : a / b);
    }

    if (stack.length !== 1 || !Number.isFinite(stack[0])) return 0;
    return Math.max(0, stack[0]);
  }
  const handleAdvanceAmountChange = (rowId: string | number, value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return;

    const updatedRows = advanceRows.map((row) =>
      row.id === rowId ? { ...row, advance: value } : row,
    );

    setAdvanceRows(updatedRows);
  };

  const handleExpenditureAmountChange = (rowId: string | number, value: string) => {
    const sanitizedValue = value.replace(/[^\d.+\-*/() ]/g, '');

    const updatedRows = expenditureSubRows.map((row) =>
      row.id === rowId ? { ...row, expenditure: sanitizedValue } : row,
    );

    const targetRow = updatedRows.find((row) => row.id === rowId);
    if (!targetRow) {
      setExpenditureSubRows(updatedRows);
      return;
    }

    let evaluatedAmount = 0;

    try {
      if (sanitizedValue.trim()) {
        evaluatedAmount = evaluateArithmeticExpression(sanitizedValue);
      }
    } catch {
      evaluatedAmount = 0;
    }

    const finalRows = updatedRows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            expenditure: sanitizedValue,
            autoSum: evaluatedAmount ? String(evaluatedAmount) : '',
          }
        : row,
    );

    setExpenditureSubRows(finalRows);
  };

  // Search applicant handler
  const handleApplicantSearch = async (query: string) => {
    setApplicantSearchQuery(query);
    // Allow empty query to fetch initial list
    // if (query.length < 2) { ... } <- Removed restriction
    try {
      const response = (await authenticityUtility.get(
        `/expenditure/search-applicant?q=${encodeURIComponent(query)}`,
      )) as {
        success?: boolean;
        status?: string;
        data: Array<{
          employee_id: number;
          name: string;
          designation: string;
          department: string;
          email: string;
          mobile: string;
          employee_type: string;
        }>;
      };
      if (response.success === true || response.status === 'success') {
        setApplicantSearchResults(response.data || []);
        setShowApplicantDropdown(true);
      }
    } catch (error) {
      console.error('Error searching applicant:', error);
    }
  };

  // Select applicant from search results
  const handleSelectApplicant = (emp: {
    employee_id: number;
    name: string;
    designation: string;
    department: string;
    email: string;
    mobile: string;
  }) => {
    setEmployeeId(emp.employee_id);
    setApplicantName(emp.name.trim());
    setDesignation(emp.designation || '');
    setDepartment(emp.department || '');
    setEmail(emp.email || '');
    setMobile(emp.mobile || '');
    setIsExternalApplicant(false);
    setShowApplicantDropdown(false);
    setApplicantSearchQuery(emp.name.trim()); // Show selected name in input
  };

  // Switch to external applicant mode
  const handleAddExternalApplicant = () => {
    setIsExternalApplicant(true);
    setEmployeeId(null);
    setApplicantName('');
    setDesignation('');
    setDepartment('');
    setEmail('');
    setMobile('');
    setShowApplicantDropdown(false);
  };

  const getSubHeadOptions = (budgetHead: string | number): string[] =>
    SUB_HEAD_BY_BUDGET_HEAD[String(budgetHead)] ?? [];
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    pageStyle: `
     @media print {
  @page {
    size: A4;
    margin: 15mm;
  }

  .preview-footer {
    position: running(footer);
    bottom: 0;
  }

  .preview-content {
    page-break-after: avoid;
  }
}

    `,
    documentTitle: 'Expenditure_Approval_Request',
  });
  const formatSelections = (selections: SelectOption[]): string => {
    return selections.map((sel) => sel.value).join(', ') || '';
  };

  const handleAddRow = () => {
    const firstRowCategory = budgetRows[0]?.category || '';

    setBudgetRows((prev) => [
      ...prev,
      {
        category: firstRowCategory,
        head: '',
        amount: '',
      },
    ]);
  };

  const handleDeleteRow = (index: number): void => {
    const updated = budgetRows.filter((_, i) => i !== index);
    setBudgetRows(updated.length ? updated : [{ category: 'Individual', head: '', amount: '' }]);
  };

  const handleBudgetChange = (index: number, field: keyof BudgetRow, value: string) => {
    const updated = [...budgetRows];
    if (field === 'category') {
      updated[index] = { ...updated[index], category: value, head: '' };
    } else if (field === 'amount') {
      let num = Number(value) || 0;
      if (num > MAX_AMOUNT) num = MAX_AMOUNT;
      updated[index][field] = num.toString();
    } else {
      updated[index][field] = value;
    }
    setBudgetRows(updated);
  };

  const handleAddIncomeRow = () => {
    setIncomeRows((prev) => [...prev, createIncomeRow()]);
  };

  const handleDeleteIncomeRow = (id: string) => {
    setIncomeRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  const handleIncomeRowChange = (id: string, field: keyof IncomeRow, value: string) => {
    setIncomeRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const accountDropdownOptions = accountOptions.map((account) => ({
    value: account.name,
    label: account.name,
    id: account.id,
  }));

  const loadAccountOptionsFromApi = async () => {
    try {
      setAccountOptions(await fetchAccountOptions());
    } catch (error) {
      console.error('Failed to load account options', error);
    }
  };

  useEffect(() => {
    void loadAccountOptionsFromApi();
  }, []);

  const totalBudget = budgetRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const actionCell: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'nowrap',
  };

  const iconBtn: CSSProperties = {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 'none',
    background: '#f5f6f8',
    color: '#000000',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    transition: 'background-color 0.3s ease',
  };

  const deleteIconBtn: CSSProperties = {
    ...iconBtn,
    background: '#ffe6e6',
    color: '#000000',
    alignItems: 'center',
  };

  const inputStyle: CSSProperties = {
    border: '1px solid #ced4da',
    borderRadius: '0.25rem',
    padding: '6px 8px',
    fontSize: '0.95rem',
    width: '100%',
    fontFamily: 'inherit',
  };
  const incomeHeaderStyle: CSSProperties = {
    padding: '10px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#eaf2ff',
    textAlign: 'center',
    fontWeight: 600,
    color: '#374151',
  };
  const incomeCellStyle: CSSProperties = {
    padding: '8px',
    border: '1px solid #e0e0e0',
    textAlign: 'center',
  };
  const incomeSubRowLabelStyle: CSSProperties = {
    padding: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#eaf2ff',
    textAlign: 'center',
    fontWeight: 600,
    color: '#374151',
  };

  const renderPayeeDetails = () => {
    if (showBulkNEFT) {
      return (
        <div className="payee-details-card">
          <div className="payee-details-header">
            <h5 className="payee-details-title">Bulk NEFT</h5>
            <div className="payee-details-actions">
              <button
                className="payee-toolbar-btn payee-toolbar-btn-secondary"
                onClick={() => setShowBulkNEFT(false)}
              >
                Back To Payee Details
              </button>
            </div>
          </div>

          <div className="bulk-neft-panel">
            <div className="bulk-neft-file-name">
              <p>{bulkNeftFile?.name || 'No Bulk NEFT file uploaded yet.'}</p>
            </div>
            <div className="bulk-neft-actions">
              <input
                ref={bulkNeftInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleBulkNeftUpload}
              />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="payee-row-btn"
                  style={{ backgroundColor: '#0069ab', color: 'white' }}
                  title="Upload"
                  onClick={(e) => {
                    e.preventDefault();
                    bulkNeftInputRef.current?.click();
                  }}
                >
                  <Upload size={20} />
                </button>
                <button
                  className="payee-row-btn"
                  style={{ backgroundColor: '#629ac4', color: 'white' }}
                  title="View"
                  disabled={!bulkNeftFile}
                  onClick={(e) => {
                    e.preventDefault();
                    if (bulkNeftFile) {
                      window.open(URL.createObjectURL(bulkNeftFile), '_blank');
                    }
                  }}
                >
                  <Eye size={20} />
                </button>
                <button
                  className="payee-row-btn"
                  style={{ backgroundColor: '#fff5f5', color: '#ff4d4f' }}
                  title="Delete"
                  disabled={!bulkNeftFile}
                  onClick={(e) => {
                    e.preventDefault();
                    removeBulkNeftFile();
                  }}
                >
                  <Trash2 size={20} />
                </button>
              </div>
              <button
                className="payee-toolbar-btn payee-toolbar-btn-secondary"
                style={{ color: '#0069ab', gap: '6px' }}
                onClick={(e) => {
                  e.preventDefault();
                  handleDownloadBulkNeftTemplate();
                }}
              >
                <Download size={18} /> Download Template
              </button>
            </div>
          </div>
          <div className="payee-footer-grid">
            <div className="payee-footer-input-wrap">
              <div className="payee-footer-debit-inline">
                <div className="payee-footer-debit-left">
                  <span className="payee-footer-input-label">Debit Account</span>
                  <button
                    type="button"
                    className={`payee-footer-switch ${showDebitAccountDropdown ? 'is-on' : 'is-off'}`}
                    onClick={() => setShowDebitAccountDropdown((prev) => !prev)}
                    aria-label={
                      showDebitAccountDropdown
                        ? 'Disable debit account dropdown'
                        : 'Enable debit account dropdown'
                    }
                    aria-pressed={showDebitAccountDropdown}
                  >
                    <span className="payee-footer-switch-thumb" />
                  </button>
                </div>
                <div className="payee-footer-debit-dropdown">
                  {showDebitAccountDropdown && (
                    <CustomDropdown
                      name="debitAccount"
                      options={accountDropdownOptions}
                      value={getSelectedOption(paymentDetails.debitAccount, accountDropdownOptions)}
                      onChange={(option) =>
                        setPaymentDetails({
                          ...paymentDetails,
                          debitAccount: String((option as OptionType)?.value || ''),
                        })
                      }
                      placeholder="Select debit account"
                      className="mb-0"
                    />
                  )}
                </div>
              </div>
            </div>
            <label className="payee-upload-label payee-footer-upload-label">
              <span className="payee-upload-label-content">
                <span className="payee-upload-label-text">Bills</span>
                <Upload size={18} />
              </span>
              <input
                type="file"
                className="payee-upload-input"
                accept=".pdf,application/pdf"
                onChange={handlePayeeBillUpload}
              />
            </label>
          </div>
        </div>
      );
    }

    return (
      <div className="payee-details-card">
        <div className="payee-details-header">
          <h5 className="payee-details-title">Payee Details</h5>
          <div className="payee-details-actions">
            <button className="payee-toolbar-btn" onClick={() => setShowAddPayeeModal(true)}>
              Add Payee
            </button>
            <button
              className="payee-toolbar-btn payee-toolbar-btn-secondary"
              onClick={() => setShowBulkNEFT(true)}
            >
              Bulk NEFT
            </button>
          </div>
        </div>

        <div className="payee-table-wrapper">
          <table className="payee-details-table">
            <thead>
              <tr>
                <th className="payee-col-sno">S.No</th>
                <th>Payee Details</th>
                <th className="payee-col-transaction">Transaction</th>
                <th className="payee-col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {payeeRows.map((row, index) => {
                const isCashMode = isCashPaymentMode(row.mode);
                const bankFieldClassName = `payee-field payee-field--readonly ${
                  isCashMode ? 'payee-field--disabled' : ''
                }`;
                const isReadyForAdd = isPayeeRowReadyForAdd(row);

                return (
                  <tr key={row.id}>
                    <td className="payee-sno-cell">{index + 1}</td>
                    <td>
                      <div className="payee-lookup-wrap">
                        <div className="payee-details-grid">
                          <div className="payee-field-wrap">
                            <input
                              className={`payee-field payee-field--readonly ${
                                isCashMode ? 'payee-field--disabled' : ''
                              }`}
                              placeholder="Accountant Name"
                              value={row.payeeName}
                              onChange={(e) => {
                                if (isCashMode) return;
                                handlePayeeLookupInputChange(row.id, 'payeeName', e.target.value);
                              }}
                              onFocus={() =>
                                !isCashMode && handlePayeeLookupFocus(row, 'payeeName')
                              }
                              onBlur={handlePayeeLookupBlur}
                              readOnly={isCashMode}
                              disabled={isCashMode}
                              tabIndex={isCashMode ? -1 : undefined}
                            />
                            {!isCashMode && renderPayeeLookupDropdown(row.id, 'payeeName')}
                          </div>
                          <div className="payee-field-wrap">
                            <input
                              className={bankFieldClassName}
                              placeholder="Account No."
                              value={row.accountNo}
                              readOnly
                              disabled={isCashMode}
                              tabIndex={-1}
                            />
                          </div>
                          <div className="payee-field-wrap">
                            <input
                              className={bankFieldClassName}
                              placeholder="Bank Name"
                              value={row.bankName}
                              readOnly
                              disabled={isCashMode}
                              tabIndex={-1}
                            />
                          </div>
                          <div className="payee-field-wrap">
                            <input
                              className={bankFieldClassName}
                              placeholder="IFSC"
                              value={row.ifsc}
                              readOnly
                              disabled={isCashMode}
                              tabIndex={-1}
                            />
                          </div>
                          <div className="payee-field-wrap payee-field-wrap-full">
                            <input
                              className={bankFieldClassName}
                              placeholder="Branch Name"
                              value={row.branchName}
                              readOnly
                              disabled={isCashMode}
                              tabIndex={-1}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="payee-transaction-cell">
                      <div className="payee-transaction-inner">
                        <div className="payee-stack">
                          <input
                            className="payee-field payee-transaction-field"
                            placeholder="Amount"
                            value={row.amount}
                            onChange={(e) => {
                              handlePayeeAmountChange(row.id, e.target.value);
                            }}
                          />
                          <CustomDropdown
                            className="payee-transaction-mode-dropdown"
                            options={toOptions(PAYMENT_MODE_OPTIONS)}
                            value={getSelectedOption(row.mode, toOptions(PAYMENT_MODE_OPTIONS))}
                            onChange={(opt) => {
                              const selected = opt as OptionType | null;
                              const nextMode = selected?.value ? String(selected.value) : '';
                              const updated = payeeRows.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      mode: nextMode,
                                      ...(isCashPaymentMode(nextMode)
                                        ? getCashPayeeResetFields()
                                        : {}),
                                    }
                                  : r,
                              );
                              setPayeeRows(updated);
                              if (isCashPaymentMode(nextMode)) {
                                closePayeeLookup();
                              }
                            }}
                            placeholder="Mode *"
                          />
                        </div>
                        {((row.tdsDetails && row.tdsDetails !== 'Yes' && row.tdsDetails !== 'No') ||
                          (row.tdsSection &&
                            row.tdsSection !== 'Yes' &&
                            row.tdsSection !== 'No')) && (
                          <div
                            style={{
                              marginTop: '8px',
                              fontSize: '12px',
                              color: '#6c757d',
                              lineHeight: 1.5,
                            }}
                          >
                            {row.tdsDetails &&
                              row.tdsDetails !== 'Yes' &&
                              row.tdsDetails !== 'No' && <div>TDS Details: {row.tdsDetails}</div>}
                            {row.tdsSection &&
                              row.tdsSection !== 'Yes' &&
                              row.tdsSection !== 'No' && <div>TDS Section: {row.tdsSection}</div>}
                          </div>
                        )}
                        <div className="payee-tds-row">
                          <span className="payee-tds-label">TDS</span>
                          <label className="payee-tds-option">
                            <input
                              type="radio"
                              name={`tds-${row.id}`}
                              value="Yes"
                              checked={row.tdsSection === 'Yes'}
                              onChange={() =>
                                updatePayeeRow(row.id, (r) => ({
                                  ...r,
                                  tdsSection: 'Yes',
                                }))
                              }
                            />{' '}
                            Yes
                          </label>
                          <label className="payee-tds-option">
                            <input
                              type="radio"
                              name={`tds-${row.id}`}
                              value="No"
                              checked={row.tdsSection === 'No'}
                              onChange={() =>
                                updatePayeeRow(row.id, (r) => ({
                                  ...r,
                                  tdsSection: 'No',
                                }))
                              }
                            />{' '}
                            No
                          </label>
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        borderBottom: 'none',
                        verticalAlign: 'middle',
                        textAlign: 'center',
                      }}
                    >
                      <div className="payee-row-actions">
                        {index === payeeRows.length - 1 && (
                          <button
                            className="payee-row-btn"
                            disabled={!isReadyForAdd}
                            onClick={(e) => {
                              e.preventDefault();
                              addPayeeRow();
                            }}
                            title={
                              !isReadyForAdd ? 'Please fill all fields to add a new row' : 'Add Row'
                            }
                            style={{
                              opacity: !isReadyForAdd ? 0.5 : 1,
                              cursor: !isReadyForAdd ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <Plus size={14} strokeWidth={2.5} />
                          </button>
                        )}
                        {payeeRows.length > 1 && (
                          <button
                            className="payee-row-btn payee-row-btn-delete"
                            onClick={(e) => {
                              e.preventDefault();
                              removePayeeRow(row.id);
                            }}
                            title="Delete Row"
                          >
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="payee-footer-grid">
          <div className="payee-footer-input-wrap">
            <div className="payee-footer-debit-inline">
              <div className="payee-footer-debit-left">
                <span className="payee-footer-input-label">Debit Account</span>
                <button
                  type="button"
                  className={`payee-footer-switch ${showDebitAccountDropdown ? 'is-on' : 'is-off'}`}
                  onClick={() => setShowDebitAccountDropdown((prev) => !prev)}
                  aria-label={
                    showDebitAccountDropdown
                      ? 'Disable debit account dropdown'
                      : 'Enable debit account dropdown'
                  }
                  aria-pressed={showDebitAccountDropdown}
                >
                  <span className="payee-footer-switch-thumb" />
                </button>
              </div>
              <div className="payee-footer-debit-dropdown">
                {showDebitAccountDropdown && (
                  <CustomDropdown
                    name="debitAccount"
                    options={accountDropdownOptions}
                    value={getSelectedOption(paymentDetails.debitAccount, accountDropdownOptions)}
                    onChange={(option) =>
                      setPaymentDetails({
                        ...paymentDetails,
                        debitAccount: String((option as OptionType)?.value || ''),
                      })
                    }
                    placeholder="Select debit account"
                    className="mb-0"
                  />
                )}
              </div>
            </div>
          </div>
          {!isReadOnlyView &&
            existingPayeeBills.length === 0 &&
            uploadedPayeeBills.length === 0 && (
              <label className="payee-upload-label payee-footer-upload-label">
                <span className="payee-upload-label-content">
                  <span className="payee-upload-label-text">Bills</span>
                  <Upload size={18} />
                </span>
                <input
                  type="file"
                  className="payee-upload-input"
                  accept=".pdf,application/pdf"
                  onChange={handlePayeeBillUpload}
                />
              </label>
            )}
        </div>

        {(existingPayeeBills.length > 0 || uploadedPayeeBills.length > 0) && (
          <div
            className="payee-uploaded-files"
            style={{ marginTop: '14px', pointerEvents: 'auto' }}
          >
            <div className="payee-uploaded-files-header">
              <span>S.No</span>
              <span>Bills File</span>
              <span>Action</span>
            </div>
            {existingPayeeBills.map((file, i) => {
              const fileUrl = resolveBillFileUrl(file);
              const displayName = normalizeText(
                file.original_name || file.stored_name || file.file_path || `File ${i + 1}`,
              );

              return (
                <div key={`existing-${file.id ?? i}`} className="payee-uploaded-file-row">
                  <span className="payee-uploaded-file-index">{i + 1}</span>
                  <span className="payee-uploaded-file-name" title={displayName}>
                    {displayName}
                  </span>
                  <div className="payee-upload-actions">
                    <button
                      className="payee-upload-view-btn"
                      disabled={!fileUrl}
                      onClick={(e) => {
                        e.preventDefault();
                        if (fileUrl) window.open(fileUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <Eye size={16} />
                    </button>
                    {!isReadOnlyView && (
                      <button
                        className="payee-upload-view-btn payee-upload-delete-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          removeExistingPayeeBill(i);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {uploadedPayeeBills.map((file, i) => (
              <div key={`uploaded-${i}`} className="payee-uploaded-file-row">
                <span className="payee-uploaded-file-index">
                  {existingPayeeBills.length + i + 1}
                </span>
                <span className="payee-uploaded-file-name" title={file.name}>
                  {file.name}
                </span>
                <div className="payee-upload-actions">
                  <button
                    className="payee-upload-view-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      if (file)
                        window.open(URL.createObjectURL(file), '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <Eye size={16} />
                  </button>
                  {!isReadOnlyView && (
                    <button
                      className="payee-upload-view-btn payee-upload-delete-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        removePayeeBill(i);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  type WorkflowFormRow = AdvanceFormRow | SettlementFormRow | ExpenditureFormRow;

  const getRowsForActiveTab = (): WorkflowFormRow[] => {
    if (activeTab === 'Advance') return advanceRows;
    if (activeTab === 'Settlement') return settlementRows;
    if (activeTab === 'Expenditure') return expenditureSubRows;
    return [];
  };

  const getSelectedWorkflowRow = (): WorkflowFormRow | null => {
    const rows = getRowsForActiveTab();

    if (rowIndexFromState && rows[rowIndexFromState - 1]) {
      return rows[rowIndexFromState - 1];
    }

    if (workflowBudgetLineIdFromState) {
      const matched = rows.find(
        (row) => parsePositiveIntLike(row.budgetLineId) === workflowBudgetLineIdFromState,
      );
      if (matched) return matched;
    }

    if (rows.length === 1) return rows[0];

    const rowsWithBudgetLine = rows.filter((row) =>
      Boolean(parsePositiveIntLike(row.budgetLineId)),
    );

    if (rowsWithBudgetLine.length === 1) return rowsWithBudgetLine[0];

    if (rowsWithBudgetLine.length > 1) return rowsWithBudgetLine[0];

    return rows[0] || null;
  };

  const getSelectedWorkflowBudgetLineId = (): number | null =>
    parsePositiveIntLike(getSelectedWorkflowRow()?.budgetLineId);

  const getSelectedWorkflowBudgetProposalId = (): number | null =>
    parsePositiveIntLike(getSelectedWorkflowRow()?.budgetProposalId);

  const getActiveTabTransactionAmount = (tab: 'Advance' | 'Settlement' | 'Expenditure'): number => {
    if (tab === 'Advance') return totalAdvanceDisplayAmount;
    if (tab === 'Settlement') return totalSettlementDisplayAmount;
    return totalExpenditureDisplayAmount;
  };

  const getActiveTabPayeeExpectedAmount = (
    tab: 'Advance' | 'Settlement' | 'Expenditure',
  ): number => {
    if (tab === 'Settlement') return settlementAdjustmentAmount;
    return getActiveTabTransactionAmount(tab);
  };

  const getWorkflowRowEnteredAmount = (
    row: WorkflowFormRow | null | undefined,
    tab: 'Advance' | 'Settlement' | 'Expenditure' | null,
  ): number => {
    if (!row || !tab) return 0;

    if (tab === 'Advance') return parseAmountValue((row as AdvanceFormRow).advance ?? '');
    if (tab === 'Settlement') return parseAmountValue((row as SettlementFormRow).settlement ?? '');
    return parseAmountValue(
      (row as ExpenditureFormRow).autoSum || (row as ExpenditureFormRow).expenditure || '',
    );
  };

  const getInvalidWorkflowBudgetRowNumbers = (
    rows: WorkflowFormRow[],
    tab: 'Advance' | 'Settlement' | 'Expenditure',
  ): number[] =>
    rows
      .map((row, index) => ({
        rowNumber: index + 1,
        amount: getWorkflowRowEnteredAmount(row, tab),
        budgetLineId: parsePositiveIntLike(row?.budgetLineId),
      }))
      .filter((row) => row.amount > 0 && !row.budgetLineId)
      .map((row) => row.rowNumber);

  const handlePayeeAmountChange = (rowId: string, nextValue: string) => {
    if (!/^\d*\.?\d*$/.test(nextValue)) return;

    const workflowAmount = activeTab ? getActiveTabPayeeExpectedAmount(activeTab) : 0;
    let exceededLimit = false;

    setPayeeRows((prev) => {
      const updatedRows = prev.map((row) =>
        row.id === rowId ? { ...row, amount: nextValue } : row,
      );

      const updatedPayeeTotal = getPayeeTransactionTotal(updatedRows);
      if (
        (activeTab === 'Settlement' && workflowAmount === 0 && updatedPayeeTotal > 0) ||
        (workflowAmount > 0 && updatedPayeeTotal > workflowAmount)
      ) {
        exceededLimit = true;
        return prev;
      }

      return updatedRows;
    });

    if (exceededLimit && activeTab) {
      if (activeTab === 'Settlement' && workflowAmount === 0) {
        showAlert(
          'Settlement expenditure and advance are equal, so there is no amount to be received or returned. Payee transaction amount must be ₹ 0.00.',
          'warning',
        );
        return;
      }

      const amountLabel =
        activeTab === 'Settlement' && hasSettlementAdjustment
          ? settlementAdjustmentLabel.toLowerCase()
          : `${activeTab.toLowerCase()} amount`;
      showAlert(
        `Total payee transaction amount cannot exceed the ${amountLabel} of ₹ ${workflowAmount.toLocaleString('en-IN')}.`,
        'warning',
      );
    }
  };
  const getSettlementAdjustmentNotice = () => {
    if (activeTab !== 'Settlement') {
      return null;
    }

    const difference = settlementAdjustmentDifference;
    if (difference === 0) {
      return null;
    }

    if (difference < 0) {
      const returnedAmount = Math.abs(difference);
      return {
        title: 'Settlement Adjustment',
        message: (
          <div style={{ lineHeight: 1.6 }}>
            <div>
              Settlement is ₹{' '}
              {returnedAmount.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              less than the advance amount.
            </div>
            <div>The returned amount will be added back to the balance.</div>
          </div>
        ),
      };
    }

    return null;
  };

  const getComputedBalanceAmount = () => {
    if (activeTab === 'Settlement') {
      return Math.max(
        0,
        financeApprovedAmount - totalSettlementDisplayAmount - totalExpenditureDisplayAmount,
      );
    }

    if (activeTab === 'Advance') {
      return Math.max(
        0,
        financeApprovedAmount - totalAdvanceDisplayAmount - totalExpenditureDisplayAmount,
      );
    }

    if (activeTab === 'Expenditure') {
      return Math.max(
        0,
        financeApprovedAmount - totalAdvanceDisplayAmount - totalExpenditureDisplayAmount,
      );
    }

    return 0;
  };

  const closeResubmitPopup = (force = false) => {
    if (resubmitSubmitting && !force) return;
    setResubmitPopupOpen(false);
    setResubmitComment('');
  };

  const performSubmit = async (resubmissionComment?: string): Promise<void> => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (isReadOnlyView) {
        showAlert('This proposal is opened in view mode and cannot be submitted again.', 'warning');
        return;
      }

      if (!resolvedFinanceRequestId) {
        showAlert('Open Expenditure from an approved Finance request to continue.', 'warning');
        return;
      }

      if (!activeTab) {
        showAlert(
          'Please choose Advance, Settlement, or Expenditure before submitting.',
          'warning',
        );
        return;
      }

      const effectiveUnplannedRows = showUnplannedBudget
        ? unplannedRows.filter(
            (row) =>
              row.headOfAccount.trim() ||
              row.budgetHead.trim() ||
              row.subHead.trim() ||
              getUnplannedRowAmountValue(row) > 0,
          )
        : [];

      if (showUnplannedBudget) {
        if (!effectiveUnplannedRows.length) {
          showAlert('Please add at least one Unplanned Expenditure row.', 'warning');
          return;
        }
        if (!unplannedHeadOfAccount.trim() || !unplannedHeadOfAccountBudgetLineId) {
          showAlert('Please select Head of Accounts for Unplanned Expenditure.', 'warning');
          return;
        }

        const totalsByHeadOfAccount = new Map<
          number,
          { amount: number; balance: number | null; rowNumber: number }
        >();

        for (const [index, row] of effectiveUnplannedRows.entries()) {
          const rowNumber = index + 1;
          const rowAmount = getUnplannedRowAmountValue(row);
          if (!row.budgetHead.trim() || !row.subHead.trim()) {
            showAlert(
              `Please select budget head and sub head for Unplanned Expenditure row ${rowNumber}.`,
              'warning',
            );
            return;
          }
          if (!(rowAmount > 0)) {
            showAlert(
              `Please enter a valid amount for Unplanned Expenditure row ${rowNumber}.`,
              'warning',
            );
            return;
          }

          const lineId = unplannedHeadOfAccountBudgetLineId;
          const selectedHeadBalance = getUnplannedHeadOfAccountAmount(firstUnplannedRow);
          const current = totalsByHeadOfAccount.get(lineId) || {
            amount: 0,
            balance: selectedHeadBalance,
            rowNumber: 1,
          };
          current.amount += rowAmount;
          current.balance = selectedHeadBalance;
          totalsByHeadOfAccount.set(lineId, current);
        }

        for (const { amount, balance } of totalsByHeadOfAccount.values()) {
          if (balance !== null && amount > balance) {
            showAlert(
              `Unplanned Expenditure amount cannot exceed Head of Accounts balance ₹ ${balance.toLocaleString('en-IN')}.`,
              'warning',
            );
            return;
          }
        }
      }

      const workflowRows = getRowsForActiveTab();
      const selectedWorkflowRow =
        workflowRows.find((row) => getWorkflowRowEnteredAmount(row, activeTab) > 0) ||
        getSelectedWorkflowRow() ||
        workflowRows.find((row) => parsePositiveIntLike(row.budgetLineId)) ||
        workflowRows[0] ||
        null;
      const selectedWorkflowBudgetLineId = parsePositiveIntLike(selectedWorkflowRow?.budgetLineId);
      const selectedWorkflowBudgetProposalId = parsePositiveIntLike(
        selectedWorkflowRow?.budgetProposalId,
      );

      if (!workflowRows.length) {
        showAlert('No workflow rows were found for the selected request type.', 'warning');
        return;
      }

      const invalidBudgetRows = getInvalidWorkflowBudgetRowNumbers(workflowRows, activeTab);
      if (invalidBudgetRows.length > 0) {
        showAlert(
          `Please select a valid approved budget line (head + sub-head) for row ${invalidBudgetRows.join(', ')} before submitting.`,
          'warning',
        );
        return;
      }

      if (activeTab === 'Advance') {
        if (!String(advanceTentativeSettlementDate || '').trim()) {
          showAlert('Please select a Tentative Date of Settlement.', 'warning');
          return;
        }
      }

      const approvedFinanceLimit = Number(financeApprovedAmount || 0);
      if (approvedFinanceLimit > 0) {
        if (activeTab === 'Advance' && totalAdvanceDisplayAmount > approvedFinanceLimit) {
          showAlert(
            `Total advance amount cannot exceed the approved finance amount of ₹ ${approvedFinanceLimit.toLocaleString('en-IN')}.`,
            'warning',
          );
          return;
        }

        if (activeTab === 'Settlement' && totalSettlementDisplayAmount > approvedFinanceLimit) {
          showAlert(
            `Total settlement amount cannot exceed the approved finance amount of ₹ ${approvedFinanceLimit.toLocaleString('en-IN')}.`,
            'warning',
          );
          return;
        }

        if (activeTab === 'Expenditure' && totalExpenditureDisplayAmount > approvedFinanceLimit) {
          showAlert(
            `Total expenditure amount cannot exceed the approved finance amount of ₹ ${approvedFinanceLimit.toLocaleString('en-IN')}.`,
            'warning',
          );
          return;
        }
      }

      const hasExistingBills = isEditingExistingRequest && existingPayeeBills.length > 0;
      if (uploadedPayeeBills.length === 0 && !hasExistingBills) {
        showAlert('Please upload bills before submitting the form.', 'warning');
        return;
      }

      const effectivePayeeRows = payeeRows.filter((row) => hasAnyPayeeRowValue(row));
      const normalizedWorkflowAmount = Number(
        getActiveTabPayeeExpectedAmount(activeTab).toFixed(2),
      );
      const requiresPayeeRows = !(activeTab === 'Settlement' && normalizedWorkflowAmount === 0);

      if (requiresPayeeRows && effectivePayeeRows.length === 0) {
        showAlert('Please add at least one payee transaction row before submitting.', 'warning');
        return;
      }

      const missingModeRowIndex = effectivePayeeRows.findIndex(
        (row) => !row.mode || !row.mode.trim(),
      );
      if (missingModeRowIndex !== -1) {
        showAlert(
          `Please select a transaction mode for Payee row ${missingModeRowIndex + 1} before submitting.`,
          'warning',
        );
        return;
      }

      const incompletePayeeRowIndex = effectivePayeeRows.findIndex(
        (row) => !isPayeeRowReadyForAdd(row),
      );
      if (incompletePayeeRowIndex !== -1) {
        showAlert(
          `Please fill required payee details for Payee row ${incompletePayeeRowIndex + 1}.`,
          'warning',
        );
        return;
      }

      const normalizedTotalPayeeTransactionAmount = Number(
        getPayeeTransactionTotal(effectivePayeeRows).toFixed(2),
      );
      const amountLabel =
        activeTab === 'Settlement' && hasSettlementAdjustment
          ? settlementAdjustmentLabel.toLowerCase()
          : `${activeTab.toLowerCase()} amount`;

      if (normalizedTotalPayeeTransactionAmount !== normalizedWorkflowAmount) {
        if (activeTab === 'Settlement' && normalizedWorkflowAmount === 0) {
          showAlert(
            'Settlement expenditure and advance are equal, so there is no amount to be received or returned. Payee transaction amount must be ₹ 0.00.',
            'warning',
          );
          return;
        }

        showAlert(
          `${amountLabel} is ₹ ${normalizedWorkflowAmount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} and total payee transaction amount is ₹ ${normalizedTotalPayeeTransactionAmount.toLocaleString(
            'en-IN',
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )}. Both must be exactly the same. Form cannot be submitted.`,
          'warning',
        );
        return;
      }

      const primaryIncomeRow = showIncomeSection ? incomeRows[0] : undefined;

      const normalizedPayeeRows = effectivePayeeRows.map((row) => {
        const isCashMode = isCashPaymentMode(row.mode);
        const canonicalPayeeName = resolveCanonicalPayeeName(
          isCashMode ? '' : row.payeeName,
          isCashMode ? '' : row.accountName,
        );

        return {
          payee_id: isCashMode ? null : (row.payeeId ?? null),
          payee_name: canonicalPayeeName,
          bank_name: isCashMode ? '' : row.bankName?.trim() || '',
          account_no: isCashMode ? '' : row.accountNo?.trim() || '',
          ifsc: isCashMode ? '' : row.ifsc?.trim().toUpperCase() || '',
          branch_name: isCashMode ? '' : row.branchName?.trim() || '',
          url: isCashMode ? '' : row.url?.trim() || '',
          amount: row.amount?.trim() || '',
          mode: row.mode?.trim() || '',
          account_name: canonicalPayeeName,
          pan_number: isCashMode ? '' : row.panNumber?.trim() || '',
          account_type: isCashMode ? '' : row.accountType?.trim() || '',
          beneficiary_type: isCashMode ? '' : row.beneficiaryType || 'individual',
          beneficiary_org: isCashMode
            ? ''
            : resolveCanonicalBeneficiaryOrg(row.beneficiaryOrg, row.payeeName),
          organization_type: isCashMode ? '' : row.organizationType?.trim() || '',
          msme: isCashMode ? '' : row.msme?.trim() || '',
          gstin: isCashMode ? '' : row.gstin?.trim() || '',
          tds_details: isCashMode ? '' : row.tdsDetails?.trim() || '',
          tds_section: isCashMode ? '' : row.tdsSection?.trim() || '',
        };
      });

      const selectedAdvanceRows = activeTab === 'Advance' ? advanceRows : [];

      const selectedSettlementRows = activeTab === 'Settlement' ? settlementRows : [];

      const selectedExpenditureRows = activeTab === 'Expenditure' ? expenditureSubRows : [];

      const normalizedUnplannedRows = effectiveUnplannedRows.map((row) => ({
        head_of_account: unplannedHeadOfAccount.trim(),
        head_of_account_budget_line_id: unplannedHeadOfAccountBudgetLineId,
        head_of_account_budget_proposal_id: unplannedHeadOfAccountBudgetProposalId,
        budget_head: row.budgetHead.trim(),
        sub_head: row.subHead.trim(),
        amount: getUnplannedRowAmountValue(row),
        amount_expression: activeTab === 'Expenditure' ? row.amount.trim() || null : null,
        description:
          getUnplannedBudgetDescription(row.budgetHead, row.subHead) || row.description.trim(),
      }));
      const primaryUnplannedRow = normalizedUnplannedRows[0] || null;

      const payload = {
        financerequestid: resolvedFinanceRequestId,
        workflowbudgetlineid: selectedWorkflowBudgetLineId,
        sourcebudgetlineid: selectedWorkflowBudgetLineId,
        workflowbudgetproposalid: selectedWorkflowBudgetProposalId,
        budget_fiscal_year: budgetFiscalYearFromState,
        workflowrequesttype: activeTab,
        row_index: rowIndexFromState,
        dashboard_row_id: dashboardRowIdFromState,
        source_request_id: sourceRequestIdFromState,
        workflowrowref:
          workflowRowRefFromState ?? rowReferenceIdFromState ?? dashboardRowIdFromState ?? null,

        employeeid: isExternalApplicant ? null : employeeId,
        applicantname: isExternalApplicant ? applicantName : null,
        designation: isExternalApplicant ? designation : null,
        department: isExternalApplicant ? department : null,
        email: isExternalApplicant ? email : null,
        mobile: isExternalApplicant ? mobile : null,
        requestdate: date,
        description,
        beneficiarytype: categoryType,
        beneficiaryvalue: categoryItem,
        beneficiaryentityid: beneficiaryEmployeeId,
        budget_tag: selectedTag,
        budgettag: selectedTag,
        primaryhead: primaryHead,
        eventsubhead: eventSubHead,
        isbudgetproposed: isBudgetProposed,
        proposedamount: amountProposed || null,
        balanceamount: getComputedBalanceAmount() || null,
        unplanned_budget_enabled: showUnplannedBudget && normalizedUnplannedRows.length > 0,
        unplanned_budget_amount: showUnplannedBudget ? unplannedBudgetTotal : null,
        unplanned_head_of_account: showUnplannedBudget
          ? primaryUnplannedRow?.head_of_account || null
          : null,
        unplanned_head_of_account_budget_line_id: showUnplannedBudget
          ? primaryUnplannedRow?.head_of_account_budget_line_id || null
          : null,
        unplanned_head_of_account_budget_proposal_id: showUnplannedBudget
          ? primaryUnplannedRow?.head_of_account_budget_proposal_id || null
          : null,
        unplanned_budget_head: showUnplannedBudget
          ? primaryUnplannedRow?.budget_head || null
          : null,
        unplanned_budget_sub_head: showUnplannedBudget
          ? primaryUnplannedRow?.sub_head || null
          : null,
        unplanned_budget_description: showUnplannedBudget
          ? primaryUnplannedRow?.description || null
          : null,
        unplanned_rows: normalizedUnplannedRows,
        settlement_remarks: activeTab === 'Settlement' ? settlementRemarks.trim() || null : null,
        expenditure_remarks: activeTab === 'Expenditure' ? expenditureRemarks.trim() || null : null,
        tentative_settlement_date:
          activeTab === 'Advance' ? advanceTentativeSettlementDate || null : null,
        incometype: primaryIncomeRow?.incomeSource || null,
        incomestatus: primaryIncomeRow?.creditAccount || null,
        incomeamounttype: primaryIncomeRow?.contribution || null,
        creditstatus: primaryIncomeRow?.status || null,
        debitstatus: debitStatus,
        partialamount: primaryIncomeRow?.amount || null,

        incomerows: showIncomeSection ? incomeRows : [],
        advancerows: selectedAdvanceRows,
        settlementrows: selectedSettlementRows,
        expenditurerows: selectedExpenditureRows,

        payeerows: normalizedPayeeRows,
        showbulkneft: showBulkNEFT || Boolean(bulkNeftFile),
        bulknefttemplateversion: BULK_NEFT_TEMPLATE_VERSION,
        paymentdetails: paymentDetails,
      };

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));

      uploadedPayeeBills.forEach((file) => {
        formData.append('bill_files', file);
      });

      if (bulkNeftFile) {
        formData.append('bulk_neft_file', bulkNeftFile);
      }

      const endpoint =
        isEditingExistingRequest && submittedRequestIdFromState
          ? `/expenditure/${submittedRequestIdFromState}`
          : '/expenditure';
      const result =
        isEditingExistingRequest && submittedRequestIdFromState
          ? await authenticityUtility.put(endpoint, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            })
          : await authenticityUtility.postFile(endpoint, formData);
      const normalizedResult = result as {
        success?: boolean;
        status?: string;
        message?: string;
        data?: {
          expenditureId?: unknown;
          requestRef?: unknown;
        };
      };
      const isSubmitSuccess =
        normalizedResult.success === true || normalizedResult.status === 'success';

      if (!isSubmitSuccess) {
        showAlert(normalizedResult.message || 'Submission failed', 'error');
        return;
      }

      const shouldResubmitAfterSave =
        isEditingExistingRequest &&
        Boolean(submittedRequestIdFromState) &&
        isReturnedWorkflowRequest;

      if (shouldResubmitAfterSave) {
        const comment = String(resubmissionComment || '').trim();
        if (!comment) {
          showAlert('Please enter resubmission comments.', 'warning');
          return;
        }

        const resubmitResult = (await authenticityUtility.post(
          `/expenditure/${submittedRequestIdFromState}/resubmit`,
          { feedback: comment },
        )) as { success?: boolean; status?: string; message?: string };

        if (resubmitResult.success !== true && resubmitResult.status !== 'success') {
          showAlert(resubmitResult.message || 'Request updated, but resubmission failed', 'error');
          return;
        }
        closeResubmitPopup(true);
      }

      const submittedAmount =
        activeTab === 'Advance'
          ? totalAdvanceDisplayAmount
          : activeTab === 'Settlement'
            ? totalSettlementDisplayAmount
            : activeTab === 'Expenditure'
              ? totalExpenditureDisplayAmount
              : 0;

      const savedRequestId = parsePositiveIntLike(normalizedResult.data?.expenditureId);
      const savedRequestRef = String(normalizedResult.data?.requestRef || '').trim();
      const financeIdLabel = `Finance ID: ${resolvedFinanceRequestId}`;
      const financeRefLabel = `Finance Ref: ${String(
        (
          location.state as {
            financeProposal?: { proposalId?: unknown };
          } | null
        )?.financeProposal?.proposalId || '',
      ).trim()}`;
      const moduleLabel = activeTab
        ? shouldResubmitAfterSave
          ? `${activeTab} resubmitted successfully.`
          : `${activeTab} ${isEditingExistingRequest ? 'updated successfully.' : 'submitted successfully.'}`
        : isEditingExistingRequest
          ? shouldResubmitAfterSave
            ? 'Resubmitted successfully.'
            : 'Updated successfully.'
          : 'Submitted successfully.';
      const requestLabel = savedRequestRef ? `Request Ref: ${savedRequestRef}` : '';

      showAlert(
        <div style={{ lineHeight: 1.6 }}>
          <div>{moduleLabel}</div>
          <div>{financeIdLabel}</div>
          {financeRefLabel.trim() !== 'Finance Ref:' && <div>{financeRefLabel}</div>}
          {requestLabel && <div>{requestLabel}</div>}
        </div>,
        'success',
        'Submission Successful',
        false,
        'Continue',
        () => {
          closeAlert();
          navigate('/expenditurecard', {
            state: {
              ...(dashboardRowIdFromState ? { dashboardRowId: dashboardRowIdFromState } : {}),
              ...(rowReferenceIdFromState ? { rowReferenceId: rowReferenceIdFromState } : {}),
              ...(workflowRowRefFromState ? { workflowrowref: workflowRowRefFromState } : {}),
              workflowbudgetlineid: selectedWorkflowBudgetLineId,
              budgetLineId: selectedWorkflowBudgetLineId,
              workflowbudgetproposalid: selectedWorkflowBudgetProposalId ?? undefined,
              submittedModule: activeTab ?? undefined,
              submittedAmount,
              submittedRequestId: savedRequestId ?? undefined,
              financeRequestId: resolvedFinanceRequestId ?? undefined,
              fiscalYear: (location.state as { fiscalYear?: unknown } | null)?.fiscalYear,
              financeProposal:
                (location.state as { financeProposal?: unknown } | null)?.financeProposal ?? null,
            },
          });
        },
      );
      return;
    } catch (error) {
      console.error('Expenditure submit error:', error);
      showAlert(getSubmitErrorMessage(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (resubmissionComment?: string): Promise<void> => {
    if (isSubmitting) return;
    const shouldResubmitAfterSave =
      isEditingExistingRequest && Boolean(submittedRequestIdFromState) && isReturnedWorkflowRequest;

    if (shouldResubmitAfterSave && resubmissionComment === undefined) {
      setResubmitComment('');
      setResubmitPopupOpen(true);
      return;
    }

    const settlementNotice = getSettlementAdjustmentNotice();

    if (settlementNotice) {
      showAlert(
        settlementNotice.message,
        'warning',
        settlementNotice.title,
        true,
        'Continue',
        () => {
          closeAlert();
          void performSubmit(resubmissionComment);
        },
      );
      return;
    }

    await performSubmit(resubmissionComment);
  };

  const submitResubmissionWithComment = async () => {
    if (resubmitSubmitting) return;
    const comment = resubmitComment.trim();
    if (!comment) {
      showAlert('Please enter resubmission comments.', 'warning');
      return;
    }

    setResubmitSubmitting(true);
    try {
      await handleSubmit(comment);
    } finally {
      setResubmitSubmitting(false);
    }
  };

  const closeWfActionPopup = () => {
    if (wfActionSubmitting) return;
    setWfActionPopupOpen(false);
    setWfActionType(null);
    setWfActionComment('');
  };

  const executeWorkflowAction = async (
    decision: 'approved' | 'returned' | 'rejected' | 'archived',
    feedback?: string,
  ) => {
    if (!submittedRequestIdFromState) return;

    try {
      setIsLoading(true);

      const response = (
        decision === 'archived'
          ? await authenticityUtility.patch(
              `/expenditure/${submittedRequestIdFromState}/archive-toggle`,
              {},
            )
          : await authenticityUtility.patch(
              `/expenditure/${submittedRequestIdFromState}/approval`,
              {
                decision,
                feedback,
              },
            )
      ) as { status?: string; success?: boolean; message?: string };

      if (response?.status !== 'success' && response?.success !== true) {
        showAlert(response?.message || `Failed to ${decision}`, 'error');
        return;
      }

      navigate('/workflow/expenditure');
    } catch (error: any) {
      showAlert(
        error?.response?.data?.message || error?.message || `Failed to ${decision}`,
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkflowAction = async (
    decision: 'approved' | 'returned' | 'rejected' | 'archived',
  ) => {
    if (!submittedRequestIdFromState) return;

    if (decision === 'returned' || decision === 'rejected') {
      setWfActionType(decision);
      setWfActionComment('');
      setWfActionPopupOpen(true);
      return;
    }

    const isArchiveAction = decision === 'archived';
    showAlert(
      isArchiveAction
        ? 'Are you sure you want to archive this request?'
        : 'Are you sure you want to approve this request?',
      'warning',
      isArchiveAction ? 'Confirm Archive' : 'Confirm Approval',
      true,
      isArchiveAction ? 'Archive' : 'Approve',
      () => {
        closeAlert();
        void executeWorkflowAction(decision);
      },
    );
  };

  const submitWfActionWithComment = async () => {
    if (!wfActionType || wfActionSubmitting) return;
    const comment = wfActionComment.trim();
    if (!comment) {
      showAlert('Please enter comments.', 'warning');
      return;
    }

    try {
      setWfActionSubmitting(true);
      await executeWorkflowAction(wfActionType, comment);
      setWfActionPopupOpen(false);
      setWfActionType(null);
      setWfActionComment('');
    } finally {
      setWfActionSubmitting(false);
    }
  };

  const handlePaymentStatusUpdate = async (): Promise<void> => {
    if (!submittedRequestIdFromState || !canEditPaymentStatus) {
      showAlert('Payment status can be updated only after final approval.', 'warning');
      return;
    }

    try {
      const paymentPayload = {
        payment_status: paymentDetails.status || 'Pending',
        payment_date: formatDateForInput(paymentDetails.date) || '',
        payment_ref_no: paymentDetails.refNo.trim(),
        payment_mode: paymentDetails.mode.trim(),
        payment_debit_account: paymentDetails.debitAccount.trim(),
      };
      const hasPaymentProofs = uploadedPaymentProofs.length > 0;
      const requestBody = hasPaymentProofs
        ? new FormData()
        : {
            payment_status: paymentPayload.payment_status,
            payment_date: paymentPayload.payment_date || null,
            payment_ref_no: paymentPayload.payment_ref_no || null,
            payment_mode: paymentPayload.payment_mode || null,
            payment_debit_account: paymentPayload.payment_debit_account || null,
          };

      if (hasPaymentProofs && requestBody instanceof FormData) {
        Object.entries(paymentPayload).forEach(([key, value]) => {
          requestBody.append(key, value);
        });
        uploadedPaymentProofs.forEach((file) => {
          requestBody.append('payment_proof_files', file);
        });
      }

      const response = (await authenticityUtility.put(
        `/expenditure/${submittedRequestIdFromState}`,
        requestBody,
        hasPaymentProofs
          ? {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            }
          : undefined,
      )) as {
        success?: boolean;
        status?: string;
        message?: string;
        data?: { payment_proof_files?: BillFileRecord[] };
      };
      const isPaymentUpdateSuccess = response.success === true || response.status === 'success';

      if (!isPaymentUpdateSuccess) {
        showAlert(response.message || 'Unable to update payment status', 'error');
        return;
      }

      showAlert(response.message || 'Payment status updated successfully', 'success');
      if (Array.isArray(response.data?.payment_proof_files)) {
        setExistingPaymentProofs(response.data.payment_proof_files);
      }
      setUploadedPaymentProofs([]);
    } catch (error) {
      console.error('Payment status update error:', error);
      showAlert(getSubmitErrorMessage(error), 'error');
    }
  };

  const handleReset = (force = false): void => {
    const performReset = () => {
      setApplicantName('');
      setDate('');
      setDesignation('');
      setMobile('');
      setEmail('');
      setDepartment('');
      setDescription('');

      setCategoryType('');
      setCategoryItem('');
      setBeneficiaryEmployeeId(null);
      setBeneficiarySearchQuery('');
      setBeneficiarySearchResults([]);
      setShowBeneficiaryDropdown(false);
      setSelectedTag('');
      setPrimaryHead('');
      setEventSubHead('');
      setDebitStatus('');
      setBalanceAmount('');
      setIsBudgetProposed('');
      setShowUnplannedBudget(false);
      setUnplannedRows([createUnplannedBudgetRow()]);
      setBudgetRows([{ category: '', head: '', amount: '' }]);
      setAmountProposed('');
      setShowIncomeSection(false);
      setIncomeRows([createIncomeRow()]);
      setAdvanceRows([createAdvanceRow()]);
      setSettlementRows([createSettlementRow()]);
      setExpenditureSubRows([createExpenditureRow()]);
      setSettlementRemarks('');
      setExpenditureRemarks('');
      setAdvanceTentativeSettlementDate('');
      setPayeeRows([createPayeeRow()]);
      setShowBulkNEFT(false);
      setBulkNeftFile(null);
      setUploadedPayeeBills([]);
      setExistingPayeeBills([]);
      setUploadedPaymentProofs([]);
      setExistingPaymentProofs([]);
      if (bulkNeftInputRef.current) {
        bulkNeftInputRef.current.value = '';
      }
      setPaymentDetails({
        mode: '',
        refNo: '',
        date: getLocalTodayYmd(),
        status: 'Pending',
        debitAccount: '',
      });
    };

    if (force) {
      performReset();
    } else {
      showAlert(
        'Are you sure you want to reset the form?',
        'warning',
        'Confirm Reset',
        true,
        'Reset',
        () => {
          closeAlert();
          performReset();
        },
      );
    }
  };

  // Helper functions previously here moved to top

  // Tag
  const [selectedTag, setSelectedTag] = useState<string>('');
  useEffect(() => {
    if (!financeTagFromState) return;
    setSelectedTag((prev) => prev || resolveTagValue(financeTagFromState, tagOptions));
  }, [financeTagFromState, tagOptions]);

  useEffect(() => {
    if (!selectedTag) return;

    const resolvedTag = resolveTagValue(selectedTag, tagOptions);
    if (resolvedTag !== selectedTag) {
      setSelectedTag(resolvedTag);
    }
  }, [selectedTag, tagOptions]);

  const handleBeneficiarySearch = async (query: string) => {
    setBeneficiarySearchQuery(query);
    try {
      let typeParam = '';
      if (categoryType === 'Faculty') typeParam = '&type=Teaching';
      else if (categoryType === 'Staff') typeParam = '&type=Non-Teaching';
      const response = (await (authenticityUtility as any).get(
        `/expenditure/search-applicant?q=${encodeURIComponent(query)}${typeParam}`,
      )) as any;
      if (response?.success === true || response?.status === 'success') {
        setBeneficiarySearchResults(response.data);
        setShowBeneficiaryDropdown(true);
      }
    } catch (error) {
      setBeneficiarySearchResults([]);
      setShowBeneficiaryDropdown(false);
    }
  };

  const handleSelectBeneficiary = (emp: {
    employeeid: number;
    name: string;
    designation: string;
    department: string;
  }) => {
    setCategoryItem(emp.name.trim());
    setBeneficiaryEmployeeId(emp.employeeid);
    setBeneficiarySearchQuery(emp.name.trim());
    setShowBeneficiaryDropdown(false);
  };

  const handleAddPayee = async (payee: AddPayeeModalPayee) => {
    try {
      const canonicalPayeeName = resolveCanonicalPayeeName(payee.payeeName, payee.accountName);

      const response = (await authenticityUtility.post('/expenditure/payees', {
        payee_name: canonicalPayeeName,
        account_name: canonicalPayeeName || null,
        pan_number: payee.panNumber || null,
        account_no: payee.accountNo,
        account_type: payee.accountType || null,
        bank_name: payee.bankName,
        branch_name: payee.branchName,
        ifsc: payee.ifsc,
        beneficiary_type: payee.beneficiaryType || 'individual',
        beneficiary_org:
          resolveCanonicalBeneficiaryOrg(payee.beneficiaryOrg, payee.payeeName) || null,
        organization_type: payee.organizationType || null,
        msme: payee.msme || null,
        gstin: payee.gstin || null,
        tds_details: payee.tdsDetails || null,
        tds_section: payee.tdsSection || null,
      })) as {
        success?: boolean;
        status?: string;
        message?: string;
        data?: PayeeLookupResult;
      };

      if ((response.success !== true && response.status !== 'success') || !response.data) {
        showAlert(response.message || 'Unable to save payee', 'error');
        return;
      }

      const savedPayee = response.data;
      const savedCanonicalPayeeName = resolveCanonicalPayeeName(
        savedPayee.payee_name,
        savedPayee.account_name,
      );
      const nextPayeeRow: PayeeRow = {
        ...payee,
        payeeId: savedPayee.payee_id ?? savedPayee.id ?? payee.payeeId ?? null,
        payeeName: savedCanonicalPayeeName || canonicalPayeeName,
        accountName: savedCanonicalPayeeName || canonicalPayeeName,
        panNumber: String(savedPayee.pan_number || payee.panNumber || '').trim(),
        accountNo: String(savedPayee.account_no || payee.accountNo).trim(),
        accountType: String(savedPayee.account_type || payee.accountType || '').trim(),
        bankName: String(savedPayee.bank_name || payee.bankName).trim(),
        branchName: String(savedPayee.branch_name || payee.branchName).trim(),
        ifsc: String(savedPayee.ifsc || payee.ifsc)
          .trim()
          .toUpperCase(),
        beneficiaryType:
          String(savedPayee.beneficiary_type || payee.beneficiaryType || 'individual')
            .trim()
            .toLowerCase() === 'organization'
            ? 'organization'
            : 'individual',
        beneficiaryOrg: resolveCanonicalBeneficiaryOrg(
          savedPayee.beneficiary_org,
          savedPayee.payee_name || payee.payeeName,
        ),
        organizationType: String(
          savedPayee.organization_type || payee.organizationType || '',
        ).trim(),
        msme: String(savedPayee.msme || payee.msme || '').trim(),
        gstin: String(savedPayee.gstin || payee.gstin || '').trim(),
        tdsDetails: String(savedPayee.tds_details || payee.tdsDetails || '').trim(),
        tdsSection: String(savedPayee.tds_section || payee.tdsSection || '').trim(),
      };

      setPayeeRows((prev) => {
        const hasOnlyEmptyStarterRow =
          prev.length === 1 &&
          !prev[0]?.payeeName &&
          !prev[0]?.accountNo &&
          !prev[0]?.bankName &&
          !prev[0]?.ifsc &&
          !prev[0]?.branchName &&
          !prev[0]?.amount &&
          !prev[0]?.mode;

        if (hasOnlyEmptyStarterRow) {
          return [{ ...prev[0], ...nextPayeeRow, id: prev[0].id }];
        }

        return [...prev, nextPayeeRow];
      });

      setShowAddPayeeModal(false);
      showAlert('Payee saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save payee:', error);
      showAlert('Unable to save payee right now', 'error');
    }
  };

  const handleReadOnlyFocusCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!isReadOnlyView) return;
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('[data-readonly-applicant-card="true"]')) return;
    if (target.closest('[data-readonly-action-bar="true"]')) return;
    if (target.closest('[data-readonly-payment-status="true"]')) return;
    if (target.closest('[data-readonly-scrollable="true"]')) return;
    if (target.matches('input, textarea, select, button, [tabindex]')) {
      target.blur();
    }
  };

  const handleReadOnlyKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isReadOnlyView) return;
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('[data-readonly-applicant-card="true"]')) return;
    if (target.closest('[data-readonly-action-bar="true"]')) return;
    if (target.closest('[data-readonly-payment-status="true"]')) return;
    if (target.closest('[data-readonly-scrollable="true"]')) return;
    if (target.matches('input, textarea, select, button, [tabindex]') && event.key !== 'Tab') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const renderUnplannedExpenditureTable = () => {
    if (!hasUnplannedBudgetPreview) return null;
    const amountColumnLabel = activeTab === 'Settlement' ? 'Settlement' : 'Expenditure';
    const headerColumns =
      activeTab === 'Advance' || activeTab === 'Expenditure'
        ? [
            ['6%', 'S.No'],
            ['35%', 'Budget Head'],
            ['35%', 'Sub Head'],
            ['14%', 'Budget'],
            ['10%', 'Action'],
          ]
        : [
            ['6%', 'S.No'],
            ['30%', 'Budget Head'],
            ['30%', 'Sub Head'],
            ['14%', 'Budget'],
            ['14%', amountColumnLabel],
            ['6%', 'Action'],
          ];
    const amountInputPlaceholder = (row: UnplannedBudgetRow) =>
      activeTab === 'Advance' ? '₹ 0' : getUnplannedBudgetAmountPlaceholder(row);

    return (
      <div
        style={{
          backgroundColor: '#fff',
          padding: '30px',
          borderRadius: '20px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }}
      >
        <h6
          style={{
            fontWeight: 600,
            color: '#0a2540',
            marginBottom: '24px',
          }}
        >
          Unplanned Expenditure
        </h6>
        <div style={{ overflowX: 'visible' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              tableLayout: 'fixed',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f0f6ff' }}>
                {headerColumns.map(([width, label]) => (
                  <th
                    key={label}
                    style={{
                      width,
                      padding: '12px',
                      border: '1px solid #e0e0e0',
                      color: '#0069ab',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unplannedRows.map((row, idx) => {
                const isFilled = isUnplannedRowFilled(row);
                return (
                  <Fragment key={row.id}>
                    <tr>
                      <td
                        rowSpan={activeTab === 'Advance' || activeTab === 'Expenditure' ? 2 : 1}
                        style={{
                          padding: '12px',
                          border: '1px solid #e0e0e0',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          color: '#495057',
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                        <CustomDropdown
                          className="mb-0"
                          options={getUnplannedBudgetHeadOptions()}
                          value={getUnplannedBudgetHeadSelectedOption(row.budgetHead)}
                          onChange={(option) =>
                            handleUnplannedBudgetHeadChange(row.id, option as OptionType | null)
                          }
                          filterOption={filterApprovedBudgetHeadOption}
                          placeholder="Select Head"
                          isDisabled={isReadOnlyView}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                        <CustomDropdown
                          className="mb-0"
                          options={getCatalogSubHeadOptions(row.budgetHead)}
                          value={getCatalogSubHeadSelectedOption(row.budgetHead, row.subHead)}
                          onChange={(option) =>
                            handleUnplannedBudgetSubHeadChange(row.id, option as OptionType | null)
                          }
                          placeholder="Select Sub Head"
                          isDisabled={isReadOnlyView || !row.budgetHead}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                        <input
                          type="text"
                          value={getUnplannedBudgetAmountPlaceholder(firstUnplannedRow)}
                          readOnly
                          style={{
                            border: '1px solid #d7dee7',
                            borderRadius: '12px',
                            padding: '10px 14px',
                            fontSize: '0.95rem',
                            width: '100%',
                            height: '45px',
                            backgroundColor: '#f5f7fb',
                            color: '#5f6f86',
                            textAlign: 'center',
                            outline: 'none',
                          }}
                        />
                      </td>
                      {activeTab === 'Settlement' && (
                        <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                          <input
                            type="text"
                            value={row.amount}
                            readOnly={isReadOnlyView}
                            onChange={(e) =>
                              updateUnplannedRow(row.id, {
                                amount: e.target.value.replace(/[^\d.]/g, ''),
                              })
                            }
                            placeholder={amountInputPlaceholder(row)}
                            style={{
                              border: '1px solid #d7dee7',
                              borderRadius: '12px',
                              padding: '10px 14px',
                              fontSize: '0.95rem',
                              width: '100%',
                              height: '45px',
                              backgroundColor: isReadOnlyView ? '#e9ecef' : '#fcfdff',
                              color: '#2a3f5e',
                              textAlign: 'center',
                              outline: 'none',
                            }}
                          />
                        </td>
                      )}
                      <td
                        rowSpan={activeTab === 'Advance' || activeTab === 'Expenditure' ? 2 : 1}
                        style={{
                          padding: '12px',
                          border: '1px solid #e0e0e0',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          {unplannedRows.length > 1 && !isReadOnlyView && (
                            <button
                              type="button"
                              onClick={() => removeUnplannedRow(row.id)}
                              style={deleteIconBtn}
                              title="Remove Row"
                            >
                              <X size={14} strokeWidth={2.5} />
                            </button>
                          )}
                          {idx === unplannedRows.length - 1 && !isReadOnlyView && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isFilled) addUnplannedRow();
                              }}
                              disabled={!isFilled}
                              style={{
                                ...iconBtn,
                                opacity: isFilled ? 1 : 0.45,
                                cursor: isFilled ? 'pointer' : 'not-allowed',
                              }}
                              title="Add Row"
                            >
                              <Plus size={14} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {activeTab === 'Advance' && (
                      <tr>
                        <td
                          style={{
                            padding: '12px 16px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{
                                minWidth: '110px',
                                color: '#364152',
                                fontSize: '1rem',
                                fontWeight: 500,
                              }}
                            >
                              Pre Advance
                            </span>
                            <input
                              type="text"
                              value="₹ 0"
                              readOnly
                              style={{
                                border: '1px solid #d7dee7',
                                borderRadius: '12px',
                                padding: '10px 14px',
                                fontSize: '0.95rem',
                                width: '100%',
                                height: '45px',
                                backgroundColor: '#f5f7fb',
                                color: '#5f6f86',
                                textAlign: 'center',
                                outline: 'none',
                              }}
                            />
                          </div>
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            padding: '12px 16px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(90px, auto) minmax(160px, 1fr)',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{
                                color: '#364152',
                                fontSize: '1rem',
                                fontWeight: 500,
                              }}
                            >
                              Advance
                            </span>
                            <input
                              type="text"
                              value={row.amount}
                              readOnly={isReadOnlyView}
                              onChange={(e) =>
                                updateUnplannedRow(row.id, {
                                  amount: e.target.value.replace(/[^\d.]/g, ''),
                                })
                              }
                              placeholder="₹ 0"
                              style={{
                                border: '1px solid #d7dee7',
                                borderRadius: '12px',
                                padding: '10px 14px',
                                fontSize: '0.95rem',
                                width: '100%',
                                height: '45px',
                                backgroundColor: isReadOnlyView ? '#e9ecef' : '#fcfdff',
                                color: '#2a3f5e',
                                outline: 'none',
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                    {activeTab === 'Expenditure' && (
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            backgroundColor: '#fff',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 500,
                                color: '#495057',
                                minWidth: '95px',
                              }}
                            >
                              Expenditure
                            </span>
                            <input
                              type="text"
                              placeholder="Eg: 455+345+780"
                              value={row.amount}
                              readOnly={isReadOnlyView}
                              onChange={(e) =>
                                updateUnplannedRow(row.id, {
                                  amount: e.target.value.replace(/[^\d.+\-*/() ]/g, ''),
                                })
                              }
                              style={{
                                border: '1px solid #e0e0e0',
                                borderRadius: '12px',
                                padding: '10px 15px',
                                fontSize: '0.95rem',
                                flex: 1,
                                height: '45px',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit',
                                backgroundColor: isReadOnlyView ? '#e9ecef' : '#fcfdff',
                                color: '#000',
                                outline: 'none',
                              }}
                            />
                            <input
                              type="text"
                              readOnly
                              value={
                                getUnplannedRowAmountValue(row)
                                  ? `₹ ${getUnplannedRowAmountValue(row)}`
                                  : ''
                              }
                              style={{
                                border: '1px solid #e0e0e0',
                                borderRadius: '12px',
                                padding: '10px 15px',
                                fontSize: '0.95rem',
                                width: '145px',
                                height: '45px',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit',
                                backgroundColor: '#fff',
                                color: '#6c757d',
                                textAlign: 'center',
                                outline: 'none',
                                cursor: 'not-allowed',
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f0f6ff' }}>
                <td
                  colSpan={activeTab === 'Settlement' ? 6 : 5}
                  style={{
                    padding: '16px 20px',
                    border: '1px solid #e0e0e0',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: '#0069ab',
                    fontSize: '1.05rem',
                  }}
                >
                  Total Unplanned Expenditure: ₹{' '}
                  {unplannedBudgetTotal.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div
      className="expenditure-approval-body"
      onFocusCapture={handleReadOnlyFocusCapture}
      onKeyDownCapture={handleReadOnlyKeyDownCapture}
      style={{
        padding: '0',
        backgroundColor: '#f0f6ff',
        minHeight: '100vh',
        pointerEvents: isReadOnlyView ? 'none' : 'auto',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 30px' }}>
        <div
          className="ea-applicantCard"
          data-readonly-applicant-card="true"
          style={{
            pointerEvents: 'auto',
            userSelect: 'auto',
          }}
        >
          {/* Collapsible Header */}
          <div
            className="ea-cardHeader"
            onClick={() => setIsApplicantCardOpen(!isApplicantCardOpen)}
          >
            <h5>Applicant Details</h5>
            <svg
              width="12"
              height="8"
              viewBox="0 0 12 8"
              className={`ea-card-toggle-arrow ${isApplicantCardOpen ? 'open' : ''}`}
            >
              <polyline
                points="1.5,1.5 6,5.5 10.5,1.5"
                stroke="#0069ab"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>

          {/* Collapsed view: show only name + date */}
          {!isApplicantCardOpen && (
            <div className="ea-cardContent">
              <div className="ea-row">
                <div className="ea-col-7">
                  <div className="ea-formGroup" style={{ marginBottom: 0 }}>
                    <label>Applicant Name</label>
                    <input
                      type="text"
                      value={applicantName}
                      disabled
                      readOnly
                      className="ea-budget-input"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setIsApplicantCardOpen(true)}
                    />
                  </div>
                </div>
                <div className="ea-col-5">
                  <div className="ea-formGroup" style={{ marginBottom: 0 }}>
                    <label>Date</label>
                    <input
                      type="date"
                      value={date}
                      disabled
                      readOnly
                      className="ea-budget-input"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setIsApplicantCardOpen(true)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expanded form */}
          {isApplicantCardOpen && (
            <div
              className="cardContent"
              style={{
                padding: '20px',
              }}
            >
              <div className="row mb-3" style={{ marginBottom: '15px' }}>
                <div className="col-md-7">
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label
                      style={{
                        fontSize: '14px',
                        color: '#495057',
                        marginBottom: '8px',
                        fontWeight: '600',
                        display: 'block',
                      }}
                    >
                      Applicant Name <span style={{ color: 'red' }}></span>
                      {isExternalApplicant && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#6c757d',
                            marginLeft: '8px',
                          }}
                        >
                          (External)
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={isExternalApplicant ? applicantName : applicantSearchQuery}
                      disabled={isReadOnlyView}
                      readOnly={isReadOnlyView}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (isReadOnlyView) return;
                        if (isExternalApplicant) {
                          setApplicantName(e.target.value);
                        } else {
                          handleApplicantSearch(e.target.value);
                        }
                      }}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #e0e0e0',
                        padding: '10px 15px',
                        fontSize: '0.95rem',
                        width: '100%',
                        fontFamily: 'inherit',
                        backgroundColor: '#fcfdff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#0069ab';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                        if (!isExternalApplicant && !showApplicantDropdown) {
                          handleApplicantSearch(applicantSearchQuery);
                        }
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                        setTimeout(() => setShowApplicantDropdown(false), 200);
                      }}
                      placeholder={
                        isExternalApplicant
                          ? 'Enter external applicant name'
                          : 'Search employee by name or ERP ID'
                      }
                    />
                    {/* Search Results Dropdown */}
                    {!isReadOnlyView &&
                      showApplicantDropdown &&
                      applicantSearchResults.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '12px',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                            zIndex: 1000,
                            maxHeight: '250px',
                            overflowY: 'auto',
                            marginTop: '4px',
                          }}
                        >
                          {/* Add External Option */}
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleAddExternalApplicant();
                            }}
                            style={{
                              padding: '10px 15px',
                              cursor: 'pointer',
                              backgroundColor: '#f8f9fa',
                              color: '#0069ab',
                              fontWeight: '600',
                              borderBottom: '2px solid #e0e0e0',
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = '#e9ecef')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = '#f8f9fa')
                            }
                          >
                            + Add External Applicant
                          </div>

                          {applicantSearchResults.map((emp) => (
                            <div
                              key={emp.employee_id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectApplicant(emp);
                              }}
                              style={{
                                padding: '10px 15px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor = '#f8f9fa')
                              }
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                            >
                              <div style={{ fontWeight: '600', color: '#333' }}>{emp.name}</div>
                              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                                {emp.designation} | {emp.department}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    {/* No results message */}
                    {!isReadOnlyView &&
                      showApplicantDropdown &&
                      applicantSearchQuery.length >= 2 &&
                      applicantSearchResults.length === 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '12px',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                            zIndex: 1000,
                            marginTop: '4px',
                          }}
                        >
                          <div style={{ padding: '10px 15px', color: '#6c757d' }}>
                            No employees found
                          </div>
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleAddExternalApplicant();
                            }}
                            style={{
                              padding: '10px 15px',
                              cursor: 'pointer',
                              backgroundColor: '#f8f9fa',
                              color: '#0069ab',
                              fontWeight: '600',
                              borderTop: '1px solid #e0e0e0',
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = '#e9ecef')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = '#f8f9fa')
                            }
                          >
                            + Add External Applicant
                          </div>
                        </div>
                      )}
                  </div>
                </div>
                <div className="col-md-5">
                  <div className="form-group">
                    <label
                      style={{
                        fontSize: '14px',
                        color: '#495057',
                        marginBottom: '8px',
                        fontWeight: '600',
                        display: 'block',
                      }}
                    >
                      Date<span style={{ color: 'red' }}></span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      disabled={isReadOnlyView}
                      readOnly={isReadOnlyView}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (isReadOnlyView) return;
                        setDate(e.target.value);
                      }}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #e0e0e0',
                        padding: '10px 15px',
                        fontSize: '0.95rem',
                        width: '100%',
                        fontFamily: 'inherit',
                        backgroundColor: '#fcfdff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#0069ab';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="row md-3" style={{ marginBottom: '15px' }}>
                <div className="col-md-7">
                  <div className="form-group">
                    <label
                      style={{
                        fontSize: '14px',
                        color: '#495057',
                        marginBottom: '8px',
                        fontWeight: '600',
                        display: 'block',
                      }}
                    >
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      disabled={isReadOnlyView}
                      readOnly={isReadOnlyView}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (isReadOnlyView) return;
                        setDepartment(e.target.value);
                      }}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #e0e0e0',
                        padding: '10px 15px',
                        fontSize: '0.95rem',
                        width: '100%',
                        fontFamily: 'inherit',
                        backgroundColor: '#fcfdff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#0069ab';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      placeholder="Department name"
                    />
                  </div>
                </div>

                <div className="col-md-5">
                  <div className="form-group">
                    <label
                      style={{
                        fontSize: '14px',
                        color: '#495057',
                        marginBottom: '8px',
                        fontWeight: '600',
                        display: 'block',
                      }}
                    >
                      Designation
                    </label>
                    <input
                      type="text"
                      value={designation}
                      disabled={isReadOnlyView}
                      readOnly={isReadOnlyView}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (isReadOnlyView) return;
                        setDesignation(e.target.value);
                      }}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #e0e0e0',
                        padding: '10px 15px',
                        fontSize: '0.95rem',
                        width: '100%',
                        fontFamily: 'inherit',
                        backgroundColor: '#fcfdff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#0069ab';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      placeholder="e.g., Manager, Staff"
                    />
                  </div>
                </div>
              </div>
              <div className="row mb-3" style={{ marginBottom: '15px' }}>
                <div className="col-md-7">
                  <div className="form-group">
                    <label
                      style={{
                        fontSize: '14px',
                        color: '#495057',
                        marginBottom: '8px',
                        fontWeight: '600',
                        display: 'block',
                      }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      disabled={isReadOnlyView}
                      readOnly={isReadOnlyView}
                      onChange={(e) => {
                        if (isReadOnlyView) return;
                        setEmail(e.target.value);
                      }}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #e0e0e0',
                        padding: '10px 15px',
                        fontSize: '0.95rem',
                        width: '100%',
                        fontFamily: 'inherit',
                        backgroundColor: '#fcfdff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#0069ab';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      placeholder="example@email.com"
                    />
                  </div>
                </div>
                <div className="col-md-5">
                  <div className="form-group">
                    <label
                      style={{
                        fontSize: '14px',
                        color: '#495057',
                        marginBottom: '6px',
                        fontWeight: '600',
                        display: 'block',
                      }}
                    >
                      Mobile <span style={{ color: 'red' }}> </span>
                    </label>
                    <input
                      type="tel"
                      value={mobile}
                      disabled={isReadOnlyView}
                      readOnly={isReadOnlyView}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        if (isReadOnlyView) return;
                        setMobile(e.target.value);
                      }}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #e0e0e0',
                        padding: '10px 15px',
                        fontSize: '0.95rem',
                        width: '100%',
                        fontFamily: 'inherit',
                        backgroundColor: '#fcfdff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#0069ab';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      placeholder="10 digit mobile"
                      pattern="[0-9]{10}"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div
          style={{
            backgroundColor: '#fff',
            padding: '30px',
            borderRadius: '20px',
            marginBottom: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div className="row mb-3">
            <div className="col-md-13">
              <div className="form-group">
                <label
                  style={{
                    fontSize: '14px',
                    color: '#495057',
                    marginBottom: '8px',
                    fontWeight: '600',
                    display: 'block',
                  }}
                ></label>

                {/* REPLACE the entire beneficiary row with this: */}
                <div className="row mb-3" style={{ alignItems: 'flex-start' }}>
                  {/* Column 1: Beneficiary Type */}
                  <div className="col-md-3">
                    <div className="form-group">
                      <label
                        style={{
                          fontSize: 14,
                          color: '#3b4f73',
                          marginBottom: 8,
                          fontWeight: 600,
                          display: 'block',
                        }}
                      >
                        Beneficiary
                      </label>
                      <CustomDropdown
                        name="categoryType"
                        options={toOptions(CATEGORY_TYPE_OPTIONS)}
                        value={getSelectedOption(categoryType, toOptions(CATEGORY_TYPE_OPTIONS))}
                        isDisabled={lockBeneficiaryAndTagFields}
                        onChange={(option) => {
                          const selected = option as OptionType | null;
                          const next = selected?.value ? String(selected.value) : '';
                          setCategoryType(next);
                          setCategoryItem('');
                          setCategorySelections([]);
                          setBeneficiaryEmployeeId(null);
                          setBeneficiarySearchQuery('');
                          setBeneficiarySearchResults([]);
                          setShowBeneficiaryDropdown(false);
                          setSelectedTag('');
                          if (next === 'Institution')
                            setCategoryItem('K.S.Rangasamy College of Technology');
                          else setCategoryItem('');
                        }}
                        placeholder="Select"
                      />
                    </div>
                  </div>

                  {/* Column 2: Dynamic field based on type */}
                  <div className="col-md-6">
                    {/* Faculty / Staff — live search */}
                    {['Faculty', 'Staff'].includes(categoryType) && (
                      <div className="form-group" style={{ position: 'relative' }}>
                        <label
                          style={{
                            fontSize: 14,
                            color: '#495057',
                            marginBottom: 8,
                            fontWeight: 600,
                            display: 'block',
                          }}
                        >
                          {categoryType === 'Staff' ? 'Staff Name' : 'Faculty Name'}
                        </label>
                        <input
                          type="text"
                          value={beneficiarySearchQuery || categoryItem}
                          disabled={lockBeneficiaryAndTagFields}
                          readOnly={lockBeneficiaryAndTagFields}
                          onChange={(e) => {
                            setCategoryItem(e.target.value);
                            setBeneficiaryEmployeeId(null);
                            setBeneficiarySearchQuery(e.target.value);
                            handleBeneficiarySearch(e.target.value);
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#0069ab';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,105,171,0.15)';
                            if (!showBeneficiaryDropdown)
                              handleBeneficiarySearch(beneficiarySearchQuery);
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#e0e0e0';
                            e.currentTarget.style.boxShadow = 'none';
                            setTimeout(() => setShowBeneficiaryDropdown(false), 200);
                          }}
                          placeholder={
                            categoryType === 'Staff'
                              ? 'Search staff by name or ERP ID'
                              : 'Search faculty by name or ERP ID'
                          }
                          style={{
                            borderRadius: 12,
                            border: '1px solid #e0e0e0',
                            padding: '10px 15px',
                            fontSize: '0.95rem',
                            width: '100%',
                            backgroundColor: lockBeneficiaryAndTagFields ? '#e9ecef' : '#fcfdff',
                            color: lockBeneficiaryAndTagFields ? '#495057' : undefined,
                            cursor: lockBeneficiaryAndTagFields ? 'not-allowed' : 'text',
                            outline: 'none',
                          }}
                        />
                        {/* Search Results Dropdown */}
                        {showBeneficiaryDropdown && beneficiarySearchResults.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              backgroundColor: '#fff',
                              border: '1px solid #e0e0e0',
                              borderRadius: 12,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              zIndex: 1001,
                              maxHeight: 250,
                              overflowY: 'auto',
                              marginTop: 4,
                            }}
                          >
                            {beneficiarySearchResults.map((emp) => (
                              <div
                                key={emp.employeeid}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectBeneficiary(emp);
                                }}
                                style={{
                                  padding: '10px 15px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#f8f9fa')
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#fff')
                                }
                              >
                                <div style={{ fontWeight: 600, color: '#333' }}>{emp.name}</div>
                                <div style={{ fontSize: 12, color: '#6c757d' }}>
                                  {emp.designation} — {emp.department}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Institution — readonly */}
                    {categoryType === 'Institution' && (
                      <div className="form-group">
                        <label
                          style={{
                            fontSize: 14,
                            color: '#495057',
                            marginBottom: 8,
                            fontWeight: 600,
                            display: 'block',
                          }}
                        >
                          Institution
                        </label>
                        <input
                          type="text"
                          value="K.S.Rangasamy College of Technology"
                          readOnly
                          style={{
                            borderRadius: 12,
                            border: '1px solid #e0e0e0',
                            padding: '10px 15px',
                            fontSize: '0.95rem',
                            width: '100%',
                            backgroundColor: '#e9ecef',
                            color: '#495057',
                            cursor: 'not-allowed',
                            outline: 'none',
                          }}
                        />
                      </div>
                    )}

                    {/* Department / Centre / Cell / Club — subcategory dropdown or tag */}
                    {hasSubcategories && (
                      <div className="form-group">
                        <label
                          style={{
                            fontSize: 14,
                            color: '#495057',
                            marginBottom: 8,
                            fontWeight: 600,
                            display: 'block',
                          }}
                        >
                          {getSubcategoryLabel(categoryType)}
                        </label>
                        {isMultipleSelect(categoryType) ? (
                          <CustomTagInput
                            name="categorySelections"
                            value={categorySelections}
                            onChange={(tags) => {
                              setCategorySelections(tags);
                              setCategoryItem(tags.join(', '));
                            }}
                            suggestions={subcategoryList.filter(
                              (sub) => !categorySelections.includes(sub),
                            )}
                            placeholder=""
                            disabled={lockBeneficiaryAndTagFields}
                            className="mb-0"
                          />
                        ) : (
                          <CustomDropdown
                            name="categoryItem"
                            options={subcategoryOptions}
                            value={getSelectedOption(categoryItem, subcategoryOptions)}
                            isDisabled={lockBeneficiaryAndTagFields}
                            onChange={(option) => {
                              const selected = option as OptionType | null;
                              setCategoryItem(selected?.value ? String(selected.value) : '');
                              setCategorySelections([]);
                            }}
                            placeholder="Select"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Tag (same as budget page) */}
                  <div className="col-md-3">
                    {categoryType && (
                      <div className="form-group">
                        <label
                          style={{
                            fontSize: 14,
                            color: '#495057',
                            marginBottom: 8,
                            fontWeight: 600,
                            display: 'block',
                          }}
                        >
                          Tag
                        </label>
                        <CustomDropdown
                          name="selectedTag"
                          options={tagOptions}
                          isDisabled={lockBeneficiaryAndTagFields}
                          value={(() => {
                            const resolvedTag = resolveTagValue(selectedTag, tagOptions);
                            return resolvedTag ? { value: resolvedTag, label: resolvedTag } : null;
                          })()}
                          onChange={(option) => {
                            const selected = option as OptionType | null;
                            setSelectedTag(selected?.value ? String(selected.value) : '');
                          }}
                          placeholder="Select Tag"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label
              style={{
                fontSize: '14px',
                color: '#495057',
                marginBottom: '8px',
                fontWeight: '600',
                display: 'block',
              }}
            >
              Description
            </label>
            <textarea
              data-readonly-scrollable="true"
              value={description}
              readOnly={isReadOnlyView}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                if (isReadOnlyView) return;
                setDescription(e.target.value);
              }}
              style={{
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                padding: '10px 15px',
                fontSize: '0.95rem',
                width: '100%',
                fontFamily: 'inherit',
                backgroundColor: '#fcfdff',
                transition: 'all 0.3s ease',
                resize: 'vertical',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#0069ab';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.boxShadow = 'none';
              }}
              rows={3}
              placeholder="Enter short description"
            />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#fff',
            padding: '18px 24px',
            borderRadius: '16px',
            marginBottom: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  color: '#495057',
                  fontWeight: 600,
                }}
              >
                Unplanned Expenditure
              </span>
              <CustomToggle
                name="unplannedBudgetToggle"
                label=""
                checked={showUnplannedBudget}
                onChange={(checked) => {
                  setShowUnplannedBudget(checked);
                  if (!checked) {
                    setUnplannedRows([createUnplannedBudgetRow()]);
                  }
                }}
              />
            </div>
            {hasUnplannedBudgetPreview && (
              <div style={{ flex: '1 1 360px', maxWidth: '520px' }}>
                <CustomDropdown
                  className="mb-0"
                  options={getUnplannedHeadOfAccountOptions()}
                  value={getUnplannedHeadOfAccountSelectedOption(firstUnplannedRow)}
                  onChange={(option) =>
                    handleUnplannedHeadOfAccountForFormChange(option as OptionType | null)
                  }
                  filterOption={filterUnplannedHeadOfAccountOption}
                  placeholder={isApprovedBudgetLoading ? 'Loading...' : 'Select Head of Accounts'}
                  isDisabled={isReadOnlyView}
                />
              </div>
            )}
          </div>
        </div>

        {renderUnplannedExpenditureTable()}

        {activeTab === 'Advance' && (
          <div
            style={{
              backgroundColor: '#fff',
              padding: '30px',
              borderRadius: '20px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <h6
              style={{
                fontWeight: 600,
                color: '#0a2540',
                marginBottom: '24px',
              }}
            >
              Advance
            </h6>
            <div style={{ overflowX: 'visible' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  tableLayout: 'fixed',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <th
                      style={{
                        width: '6%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      S.No
                    </th>
                    <th
                      style={{
                        width: '35%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Budget Head
                    </th>
                    <th
                      style={{
                        width: '35%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Sub Head
                    </th>
                    <th
                      style={{
                        width: '14%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Budget
                    </th>
                    <th
                      style={{
                        width: '10%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {advanceRows.map((row, idx) => (
                    <Fragment key={row.id}>
                      <tr>
                        <td
                          rowSpan={2}
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            color: '#495057',
                          }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <CustomDropdown
                            className="mb-0"
                            options={getApprovedBudgetHeadSearchOptions()}
                            value={getApprovedBudgetHeadSelectedOption(
                              row.budgetHead,
                              row.subHead,
                              row.budgetLineId,
                            )}
                            onChange={(option) =>
                              void handleAdvanceBudgetHeadSearchChange(
                                row.id,
                                option as OptionType | null,
                              )
                            }
                            filterOption={filterApprovedBudgetHeadOption}
                            placeholder={isApprovedBudgetLoading ? 'Loading...' : 'Select Head'}
                          />
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <CustomDropdown
                            className="mb-0"
                            options={getApprovedSubHeadOptionsForAdvance(row.budgetHead)}
                            value={getApprovedSubHeadSelectedOption(
                              row.budgetHead,
                              row.subHead,
                              row.budgetLineId,
                            )}
                            onChange={async (option) => {
                              const selected = option as OptionType | null;
                              const val = String(selected?.subHead || '');
                              await handleAdvanceSubHeadChange(row.id, val, selected);
                            }}
                            placeholder="Select Sub Head"
                            isDisabled={!row.budgetHead}
                          />
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <input
                            type="text"
                            value={getBudgetDisplayValue(row.budget)}
                            readOnly
                            style={{
                              border: '1px solid #d7dee7',
                              borderRadius: '12px',
                              padding: '10px 15px',
                              fontSize: '0.95rem',
                              width: '100%',
                              height: '45px',
                              backgroundColor: '#f3f5f7',
                              color: '#51627d',
                              textAlign: 'center',
                              outline: 'none',
                            }}
                          />
                        </td>
                        <td
                          rowSpan={2}
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                              gap: '10px',
                            }}
                          >
                            {advanceRows.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  removeAdvanceRow(row.id);
                                }}
                                style={deleteIconBtn}
                                title="Delete Row"
                              >
                                <X size={14} strokeWidth={2.5} />
                              </button>
                            )}
                            {idx === advanceRows.length - 1 &&
                              (() => {
                                const isFilled =
                                  row.budgetHead && row.subHead && row.advance !== '';
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      addAdvanceRow();
                                    }}
                                    disabled={!isFilled}
                                    style={{
                                      ...iconBtn,
                                      opacity: isFilled ? 1 : 0.5,
                                      cursor: isFilled ? 'pointer' : 'not-allowed',
                                    }}
                                    title="Add Row"
                                  >
                                    <Plus size={14} strokeWidth={2.5} />
                                  </button>
                                );
                              })()}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '12px 16px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{
                                minWidth: '110px',
                                color: '#364152',
                                fontSize: '1rem',
                                fontWeight: 500,
                              }}
                            >
                              Pre Advance
                            </span>
                            <input
                              type="text"
                              value={row.preAdvance ? `₹ ${row.preAdvance}` : '₹ 0'}
                              readOnly
                              style={{
                                border: '1px solid #d7dee7',
                                borderRadius: '12px',
                                padding: '10px 15px',
                                fontSize: '0.95rem',
                                width: '100%',
                                maxWidth: '100%',
                                height: '45px',
                                backgroundColor: '#f3f5f7',
                                color: '#51627d',
                                textAlign: 'center',
                                outline: 'none',
                              }}
                            />
                          </div>
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            padding: '12px 16px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(90px, auto) minmax(160px, 1fr)',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{
                                color: '#364152',
                                fontSize: '1rem',
                                fontWeight: 500,
                              }}
                            >
                              Advance
                            </span>
                            <input
                              type="text"
                              placeholder="₹ 0"
                              value={row.advance}
                              onChange={(e) => handleAdvanceAmountChange(row.id, e.target.value)}
                              style={{
                                border: '1px solid #d7dee7',
                                borderRadius: '12px',
                                padding: '10px 15px',
                                fontSize: '0.95rem',
                                width: '100%',
                                height: '45px',
                                backgroundColor: '#ffffff',
                                color: '#2a3f5e',
                                outline: 'none',
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '16px 20px',
                        border: '1px solid #e0e0e0',
                        fontWeight: '700',
                        color: '#0069ab',
                        fontSize: '1.05rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                          width: '100%',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.9rem',
                            color: '#0b3d75',
                            fontWeight: 600,
                          }}
                        >
                          <span>Rupees (in words):</span>
                          <span>{numberToIndianWords(totalAdvanceDisplayAmount)}</span>
                        </div>
                        <div>
                          Total Advance: ₹{' '}
                          {totalAdvanceDisplayAmount.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div
                style={{
                  marginTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <label
                  style={{
                    fontWeight: 600,
                    color: '#2a3f5e',
                    fontSize: '0.95rem',
                  }}
                >
                  Tentative Date of Settlement <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="date"
                  value={advanceTentativeSettlementDate}
                  onChange={(e) => setAdvanceTentativeSettlementDate(e.target.value)}
                  style={{
                    border: '1px solid #d7dee7',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '0.95rem',
                    width: '100%',
                    height: '48px',
                    backgroundColor: '#fcfdff',
                    color: '#2a3f5e',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Settlement' && (
          <div
            style={{
              backgroundColor: '#fff',
              padding: '30px',
              borderRadius: '20px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <h6
              style={{
                fontWeight: 600,
                color: '#0a2540',
                marginBottom: '24px',
              }}
            >
              Settlement
            </h6>
            <div style={{ overflowX: 'visible' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  tableLayout: 'fixed',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <th
                      style={{
                        width: '6%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      S.No
                    </th>
                    <th
                      style={{
                        width: '35%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Budget Head
                    </th>
                    <th
                      style={{
                        width: '35%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Sub Head
                    </th>
                    <th
                      style={{
                        width: '14%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Budget
                    </th>
                    <th
                      style={{
                        width: '10%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {settlementRows.map((row, idx) => (
                    <Fragment key={row.id}>
                      <tr>
                        <td
                          rowSpan={2}
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            color: '#495057',
                          }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <CustomDropdown
                            className="mb-0"
                            options={getApprovedBudgetHeadSearchOptions()}
                            value={getApprovedBudgetHeadSelectedOption(
                              row.budgetHead,
                              row.subHead,
                              row.budgetLineId,
                            )}
                            onChange={(option) =>
                              void handleSettlementBudgetHeadSearchChange(
                                row.id,
                                option as OptionType | null,
                              )
                            }
                            filterOption={filterApprovedBudgetHeadOption}
                            placeholder={isApprovedBudgetLoading ? 'Loading...' : 'Select Head'}
                          />
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <CustomDropdown
                            className="mb-0"
                            options={getApprovedSubHeadOptionsForAdvance(row.budgetHead)}
                            value={getApprovedSubHeadSelectedOption(
                              row.budgetHead,
                              row.subHead,
                              row.budgetLineId,
                            )}
                            onChange={(option) => {
                              const selected = option as OptionType | null;
                              const val = String(selected?.subHead || '');
                              void handleSettlementSubHeadChange(row.id, val, selected);
                            }}
                            placeholder="Select Sub Head"
                            isDisabled={!row.budgetHead}
                          />
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <input
                            type="text"
                            value={getBudgetDisplayValue(row.budget)}
                            readOnly
                            style={{
                              border: '1px solid #d7dee7',
                              borderRadius: '12px',
                              padding: '10px 15px',
                              fontSize: '0.95rem',
                              width: '100%',
                              height: '45px',
                              backgroundColor: '#f3f5f7',
                              color: '#51627d',
                              textAlign: 'center',
                              outline: 'none',
                            }}
                          />
                        </td>
                        <td
                          rowSpan={2}
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                              gap: '10px',
                            }}
                          >
                            {settlementRows.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  removeSettlementRow(row.id);
                                }}
                                style={deleteIconBtn}
                                title="Delete Row"
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#ffdede')
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.backgroundColor = '#ffe6e6')
                                }
                              >
                                <X size={14} strokeWidth={2.5} />
                              </button>
                            )}
                            {idx === settlementRows.length - 1 &&
                              (() => {
                                const isFilled =
                                  row.budgetHead && row.subHead && row.settlement !== '';
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      addSettlementRow();
                                    }}
                                    disabled={!isFilled}
                                    style={{
                                      ...iconBtn,
                                      opacity: isFilled ? 1 : 0.5,
                                      cursor: isFilled ? 'pointer' : 'not-allowed',
                                    }}
                                    title="Add Row"
                                    onMouseEnter={(e) => {
                                      if (isFilled)
                                        e.currentTarget.style.backgroundColor = '#eceef2';
                                    }}
                                    onMouseLeave={(e) => {
                                      if (isFilled)
                                        e.currentTarget.style.backgroundColor = '#f5f6f8';
                                    }}
                                  >
                                    <Plus size={14} strokeWidth={2.5} />
                                  </button>
                                );
                              })()}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '12px 16px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{
                                minWidth: '110px',
                                color: '#364152',
                                fontSize: '1rem',
                                fontWeight: 500,
                              }}
                            >
                              Advance
                            </span>
                            <input
                              type="text"
                              value={getBudgetDisplayValue(row.advance)}
                              readOnly
                              style={{
                                border: '1px solid #d7dee7',
                                borderRadius: '12px',
                                padding: '10px 15px',
                                fontSize: '0.95rem',
                                width: '100%',
                                maxWidth: '100%',
                                height: '45px',
                                backgroundColor: '#f3f5f7',
                                color: '#51627d',
                                textAlign: 'center',
                                outline: 'none',
                              }}
                            />
                          </div>
                        </td>
                        <td
                          colSpan={2}
                          style={{
                            padding: '12px 16px',
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(110px, auto) minmax(160px, 1fr)',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <span
                              style={{
                                color: '#364152',
                                fontSize: '1rem',
                                fontWeight: 500,
                              }}
                            >
                              Expenditure
                            </span>
                            <input
                              type="text"
                              placeholder="₹ 0"
                              value={row.settlement}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (!/^\d*\.?\d*$/.test(value)) return;

                                const updated = settlementRows.map((r) =>
                                  r.id === row.id ? { ...r, settlement: value } : r,
                                );
                                setSettlementRows(updated);
                              }}
                              style={{
                                border: '1px solid #e0e0e0',
                                borderRadius: '12px',
                                padding: '10px 15px',
                                fontSize: '0.95rem',
                                width: '100%',
                                height: '45px',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit',
                                backgroundColor: '#fcfdff',
                                color: '#000',
                                outline: 'none',
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#0069ab';
                                e.currentTarget.style.boxShadow =
                                  '0 0 0 3px rgba(0, 105, 171, 0.15)';
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = '#e0e0e0';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '16px 20px',
                        border: '1px solid #e0e0e0',
                        fontWeight: '700',
                        color: '#0069ab',
                        fontSize: '1.05rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                          width: '100%',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.9rem',
                            color: '#0b3d75',
                            fontWeight: 600,
                          }}
                        >
                          <span>Rupees (in words):</span>
                          <span>{numberToIndianWords(totalSettlementDisplayAmount)}</span>
                        </div>
                        <div>
                          Total Expenditure: ₹{' '}
                          {totalSettlementDisplayAmount.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>

              {hasSettlementAdjustment && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#fff8e1',
                    border: '1px solid #f2d38b',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'center',
                    width: '100%',
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: '#7a4b00' }}>{settlementAdjustmentLabel}:</span>
                  <span style={{ color: settlementAdjustmentColor, fontSize: '1.05rem' }}>
                    ₹{' '}
                    {settlementAdjustmentAmount.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'Expenditure' && (
          <div
            style={{
              backgroundColor: '#fff',
              padding: '30px',
              borderRadius: '20px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <h6
              style={{
                fontWeight: 600,
                color: '#0a2540',
                marginBottom: '24px',
              }}
            >
              Expenditure
            </h6>
            <div style={{ overflowX: 'visible' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  tableLayout: 'fixed',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <th
                      style={{
                        width: '5%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      S.No
                    </th>
                    <th
                      style={{
                        width: '28%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Budget Head
                    </th>
                    <th
                      style={{
                        width: '28%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Sub Head
                    </th>
                    <th
                      style={{
                        width: '12%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Budget
                    </th>
                    <th
                      style={{
                        width: '8%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        color: '#0069ab',
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expenditureSubRows.map((row, idx) => (
                    <React.Fragment key={row.id}>
                      <tr>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            borderBottom: 'none',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            color: '#495057',
                          }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            borderBottom: '1px solid #e0e0e0',
                            verticalAlign: 'middle',
                            textAlign: 'center',
                          }}
                        >
                          <CustomDropdown
                            className="mb-0"
                            options={getApprovedBudgetHeadSearchOptions()}
                            value={getApprovedBudgetHeadSelectedOption(
                              row.budgetHead,
                              row.subHead,
                              row.budgetLineId,
                            )}
                            onChange={(option) =>
                              handleExpenditureBudgetHeadSearchChange(
                                row.id,
                                option as OptionType | null,
                              )
                            }
                            filterOption={filterApprovedBudgetHeadOption}
                            placeholder={isApprovedBudgetLoading ? 'Loading...' : 'Select Head'}
                          />
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            borderBottom: '1px solid #e0e0e0',
                            verticalAlign: 'middle',
                            textAlign: 'center',
                          }}
                        >
                          <CustomDropdown
                            className="mb-0"
                            options={getApprovedSubHeadOptionsForAdvance(row.budgetHead)}
                            value={getApprovedSubHeadSelectedOption(
                              row.budgetHead,
                              row.subHead,
                              row.budgetLineId,
                            )}
                            onChange={(option) => {
                              const selected = option as OptionType | null;
                              const val = String(selected?.subHead || '');
                              handleExpenditureSubHeadChange(row.id, val, selected);
                            }}
                            placeholder="Select Sub Head"
                            isDisabled={!row.budgetHead}
                          />
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            borderBottom: '1px solid #e0e0e0',
                            verticalAlign: 'middle',
                            textAlign: 'center',
                          }}
                        >
                          <input
                            type="text"
                            value={getBudgetDisplayValue(row.budget)}
                            readOnly
                            style={{
                              border: '1px solid #e0e0e0',
                              borderRadius: '12px',
                              padding: '10px 15px',
                              fontSize: '0.95rem',
                              width: '100%',
                              height: '45px',
                              boxSizing: 'border-box',
                              fontFamily: 'inherit',
                              backgroundColor: '#fff',
                              color: '#6c757d',
                              textAlign: 'center',
                              outline: 'none',
                              cursor: 'not-allowed',
                            }}
                          />
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            borderBottom: '1px solid #e0e0e0',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                          rowSpan={2}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                              gap: '12px',
                              alignItems: 'center',
                              flexWrap: 'nowrap',
                            }}
                          >
                            {expenditureSubRows.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  removeExpenditureRow(row.id);
                                }}
                                title="Delete Row"
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: '#ffe6e6',
                                  color: '#000000',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <X size={14} strokeWidth={2.5} />
                              </button>
                            )}
                            {idx === expenditureSubRows.length - 1 && (
                              <button
                                disabled={!row.budgetHead || !row.subHead || !row.expenditure}
                                onClick={(e) => {
                                  e.preventDefault();
                                  addExpenditureRow();
                                }}
                                title={
                                  !row.budgetHead || !row.subHead || !row.expenditure
                                    ? 'Please fill all fields to add a new row'
                                    : 'Add Row'
                                }
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: '#f5f6f8',
                                  color: '#000000',
                                  cursor:
                                    !row.budgetHead || !row.subHead || !row.expenditure
                                      ? 'not-allowed'
                                      : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity:
                                    !row.budgetHead || !row.subHead || !row.expenditure ? 0.5 : 1,
                                }}
                              >
                                <Plus size={14} strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderBottom: '1px solid #e0e0e0',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            backgroundColor: '#fff',
                          }}
                        >
                          {/* Empty cell under S.No */}
                        </td>
                        <td
                          colSpan={3}
                          style={{
                            padding: '12px',
                            border: '1px solid #e0e0e0',
                            borderTop: 'none',
                            borderBottom: '1px solid #e0e0e0',
                            verticalAlign: 'middle',
                            backgroundColor: '#fff',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: '500',
                                color: '#495057',
                                minWidth: '80px',
                              }}
                            >
                              Expenditure
                            </span>
                            <input
                              type="text"
                              placeholder="Eg: 455+345+780"
                              value={row.expenditure}
                              onChange={(e) =>
                                handleExpenditureAmountChange(row.id, e.target.value)
                              }
                              style={{
                                border: '1px solid #e0e0e0',
                                borderRadius: '12px',
                                padding: '10px 15px',
                                fontSize: '0.95rem',
                                flex: 1,
                                height: '45px',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit',
                                backgroundColor: '#fcfdff',
                                color: '#000',
                                outline: 'none',
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#0069ab';
                                e.currentTarget.style.boxShadow =
                                  '0 0 0 3px rgba(0, 105, 171, 0.15)';
                                e.currentTarget.style.backgroundColor = '#fcfdff';
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = '#e0e0e0';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.backgroundColor = '#fcfdff';
                              }}
                            />
                            <input
                              type="text"
                              readOnly
                              value={row.autoSum ? `₹ ${row.autoSum}` : ''}
                              style={{
                                border: '1px solid #e0e0e0',
                                borderRadius: '12px',
                                padding: '10px 15px',
                                fontSize: '0.95rem',
                                width: '145px',
                                height: '45px',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit',
                                backgroundColor: '#fff',
                                color: '#6c757d',
                                textAlign: 'center',
                                outline: 'none',
                                cursor: 'not-allowed',
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '16px 20px',
                        border: '1px solid #e0e0e0',
                        fontWeight: '700',
                        color: '#0069ab',
                        fontSize: '1.05rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                          width: '100%',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.9rem',
                            color: '#0b3d75',
                            fontWeight: 600,
                          }}
                        >
                          <span>Rupees (in words):</span>
                          <span>{numberToIndianWords(totalExpenditureDisplayAmount)}</span>
                        </div>
                        <div>
                          Total Expenditure: &#8377;{' '}
                          {totalExpenditureDisplayAmount.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Payee Details Section */}
        <div style={{ marginTop: '20px' }}>{renderPayeeDetails()}</div>

        {/* Payment Status Section - Separate Card */}
        {!showBulkNEFT && hasDofApprovalForPaymentStatus && (
          <div
            className="payee-details-card"
            data-readonly-payment-status={canEditPaymentStatus ? 'true' : undefined}
            style={{ marginTop: '20px', pointerEvents: 'auto' }}
          >
            <div className="payee-details-header">
              <h5 className="payee-details-title">Payment Status</h5>
            </div>
            <div
              className="payee-status-card-fields"
              style={{
                padding: '20px',
              }}
            >
              {/* 1. Dropdown (Status) */}
              <div className="payee-status-col payee-status-col-pending">
                <CustomDropdown
                  options={toOptions(PAYMENT_STATUS_OPTIONS)}
                  value={getSelectedOption(
                    paymentDetails.status,
                    toOptions(PAYMENT_STATUS_OPTIONS),
                  )}
                  onChange={(opt) =>
                    setPaymentDetails({
                      ...paymentDetails,
                      status: String((opt as OptionType)?.value || ''),
                    })
                  }
                  placeholder="Status"
                  isDisabled={!canEditPaymentStatus}
                />
              </div>

              {/* 2. Date Picker */}
              <div className="payee-status-col payee-status-col-date">
                <input
                  type="date"
                  className="payee-field"
                  value={paymentDetails.date}
                  onChange={(e) =>
                    setPaymentDetails({
                      ...paymentDetails,
                      date: e.target.value,
                    })
                  }
                  disabled={!canEditPaymentStatus}
                  style={{ width: '100%' }}
                />
              </div>

              {/* 3. Bills Uploaded Button */}
              <div className="payee-status-col payee-status-col-bills">
                {canEditPaymentStatus && (
                  <label
                    className="payee-upload-label payee-status-upload-label"
                    style={{
                      margin: 0,
                      justifyContent: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span className="payee-upload-label-content">
                      <span className="payee-upload-label-text">Payment proof </span>
                      <Upload size={16} />
                    </span>
                    <input
                      type="file"
                      className="payee-upload-input"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      disabled={!canEditPaymentStatus}
                      onChange={handlePaymentProofUpload}
                    />
                  </label>
                )}
                {(existingPaymentProofs.length > 0 || uploadedPaymentProofs.length > 0) && (
                  <div
                    style={{
                      fontSize: '11px',
                      marginTop: '8px',
                    }}
                  >
                    {[...existingPaymentProofs, ...uploadedPaymentProofs].length} file(s)
                  </div>
                )}
              </div>

              {/* 4. Comments Input */}
              <div className="payee-status-col payee-status-col-comments">
                <div className="payee-comments-group">
                  <input
                    type="text"
                    className="payee-field payee-status-comment-input"
                    placeholder="Transaction Details"
                    value={paymentDetails.refNo}
                    onChange={(e) =>
                      setPaymentDetails({
                        ...paymentDetails,
                        refNo: e.target.value,
                      })
                    }
                    disabled={!canEditPaymentStatus}
                    style={{ width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentDetails((prev) => ({
                        ...prev,
                        refNo: prev.refNo.trim(),
                      }));
                      void handlePaymentStatusUpdate();
                    }}
                    className="payee-comment-tick-btn"
                    aria-label="Update payment status"
                    title="Update payment status"
                    disabled={!canEditPaymentStatus}
                  >
                    <CheckCircle2 size={20} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            </div>
            {(existingPaymentProofs.length > 0 || uploadedPaymentProofs.length > 0) && (
              <div
                className="payee-uploaded-files"
                style={{ margin: '0 20px 20px', pointerEvents: 'auto' }}
              >
                <div className="payee-uploaded-files-header">
                  <span>S.No</span>
                  <span>Payment Proof</span>
                  <span>Action</span>
                </div>
                {existingPaymentProofs.map((file, i) => {
                  const fileUrl = resolveBillFileUrl(file);
                  const displayName = normalizeText(
                    file.original_name || file.stored_name || file.file_path || `Proof ${i + 1}`,
                  );

                  return (
                    <div
                      key={`existing-payment-proof-${file.id ?? i}`}
                      className="payee-uploaded-file-row"
                    >
                      <span className="payee-uploaded-file-index">{i + 1}</span>
                      <span className="payee-uploaded-file-name" title={displayName}>
                        {displayName}
                      </span>
                      <div className="payee-upload-actions">
                        <button
                          className="payee-upload-view-btn"
                          disabled={!fileUrl}
                          onClick={(e) => {
                            e.preventDefault();
                            if (fileUrl) {
                              window.open(fileUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {uploadedPaymentProofs.map((file, i) => (
                  <div key={`uploaded-payment-proof-${i}`} className="payee-uploaded-file-row">
                    <span className="payee-uploaded-file-index">
                      {existingPaymentProofs.length + i + 1}
                    </span>
                    <span className="payee-uploaded-file-name" title={file.name}>
                      {file.name}
                    </span>
                    <div className="payee-upload-actions">
                      <button
                        className="payee-upload-view-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(URL.createObjectURL(file), '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="payee-upload-view-btn payee-upload-delete-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          removePaymentProof(i);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Remarks Section */}
        {(activeTab === 'Settlement' || activeTab === 'Expenditure') && (
          <div
            style={{
              backgroundColor: '#fff',
              padding: '30px',
              borderRadius: '20px',
              marginTop: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <label
                style={{
                  fontWeight: 600,
                  color: '#2a3f5e',
                  fontSize: '0.95rem',
                }}
              >
                Remarks
              </label>
              <textarea
                value={activeTab === 'Settlement' ? settlementRemarks : expenditureRemarks}
                onChange={(event) => {
                  if (activeTab === 'Settlement') {
                    setSettlementRemarks(event.target.value);
                  } else {
                    setExpenditureRemarks(event.target.value);
                  }
                }}
                placeholder="Enter remarks (optional)"
                rows={3}
                style={{
                  border: '1px solid #d7dee7',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  fontSize: '0.95rem',
                  width: '100%',
                  minHeight: '90px',
                  resize: 'vertical',
                  backgroundColor: '#fcfdff',
                  color: '#2a3f5e',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        )}

        {/* Submit Button Section */}
        {!isReadOnlyView && (
          <div className="expenditure-submit-buttons">
            <button
              className="btn-submit"
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              {isSubmitting ? 'Submitting...' : submitActionLabel}
            </button>
          </div>
        )}
        {showWorkflowActions && (
          <div
            className="expenditure-workflow-actions"
            data-readonly-action-bar="true"
            style={{ pointerEvents: 'auto' }}
          >
            {!isSuperAdminUser && canActOnCurrentStage && (
              <>
                <button
                  type="button"
                  className="expenditure-workflow-btn expenditure-workflow-btn--approve"
                  onClick={() => handleWorkflowAction('approved')}
                  disabled={isLoading}
                >
                  <CheckCircle2 size={18} />
                  Approve
                </button>
                <button
                  type="button"
                  className="expenditure-workflow-btn expenditure-workflow-btn--return"
                  onClick={() => handleWorkflowAction('returned')}
                  disabled={isLoading}
                >
                  <RotateCcw size={18} />
                  Return
                </button>
                <button
                  type="button"
                  className="expenditure-workflow-btn expenditure-workflow-btn--reject"
                  onClick={() => handleWorkflowAction('rejected')}
                  disabled={isLoading}
                >
                  <XCircle size={18} />
                  Reject
                </button>
              </>
            )}
            {isSuperAdminUser && (
              <button
                type="button"
                className="expenditure-workflow-btn expenditure-workflow-btn--return"
                onClick={() => handleWorkflowAction('returned')}
                disabled={isLoading}
              >
                <RotateCcw size={18} />
                Return
              </button>
            )}
            <button
              type="button"
              className="expenditure-workflow-btn expenditure-workflow-btn--archive"
              onClick={() => handleWorkflowAction('archived')}
              disabled={isLoading}
            >
              <Archive size={18} />
              Archive
            </button>
          </div>
        )}

        <AlertModal
          show={alertConfig.show}
          onHide={closeAlert}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onConfirm={() => {
            if (alertConfig.onConfirm) {
              alertConfig.onConfirm();
              return;
            }
            closeAlert();
          }}
          showCancel={alertConfig.showCancel}
          confirmText={alertConfig.confirmText}
        />

        <CustomModal
          show={wfActionPopupOpen}
          onHide={wfActionSubmitting ? () => {} : closeWfActionPopup}
          title={wfActionType === 'returned' ? 'Return Item - Comments' : 'Reject Item - Comments'}
          size="sm"
          centered
          backdrop={wfActionSubmitting ? 'static' : true}
          keyboard={!wfActionSubmitting}
          hideCloseButton={wfActionSubmitting}
          footer={
            <div className="d-flex justify-content-end gap-2 w-100" data-readonly-action-bar="true">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={closeWfActionPopup}
                disabled={wfActionSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-sm ${
                  wfActionType === 'rejected' ? 'btn-danger' : 'btn-warning text-dark'
                }`}
                onClick={submitWfActionWithComment}
                disabled={wfActionSubmitting}
              >
                {wfActionSubmitting
                  ? 'Submitting...'
                  : wfActionType === 'returned'
                    ? 'Return'
                    : 'Reject'}
              </button>
            </div>
          }
        >
          <div className="p-2" data-readonly-action-bar="true">
            <label className="form-label fw-semibold">
              Comments <span className="text-danger">*</span>
            </label>
            <textarea
              className="form-control"
              rows={4}
              value={wfActionComment}
              onChange={(event) => setWfActionComment(event.target.value)}
              placeholder={
                wfActionType === 'returned' ? 'Enter return comments' : 'Enter rejection comments'
              }
              disabled={wfActionSubmitting}
              autoFocus
            />
          </div>
        </CustomModal>

        <CustomModal
          show={resubmitPopupOpen}
          onHide={resubmitSubmitting ? () => {} : closeResubmitPopup}
          title="Resubmit Item - Comments"
          size="sm"
          centered
          backdrop={resubmitSubmitting ? 'static' : true}
          keyboard={!resubmitSubmitting}
          hideCloseButton={resubmitSubmitting}
          footer={
            <div className="d-flex justify-content-end gap-2 w-100" data-readonly-action-bar="true">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => closeResubmitPopup()}
                disabled={resubmitSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={submitResubmissionWithComment}
                disabled={resubmitSubmitting}
              >
                {resubmitSubmitting ? 'Resubmitting...' : 'Resubmit'}
              </button>
            </div>
          }
        >
          <div className="p-2" data-readonly-action-bar="true">
            <label className="form-label fw-semibold">
              Comments <span className="text-danger">*</span>
            </label>
            <textarea
              className="form-control"
              rows={4}
              value={resubmitComment}
              onChange={(event) => setResubmitComment(event.target.value)}
              placeholder="Enter resubmission comments"
              disabled={resubmitSubmitting}
              autoFocus
            />
          </div>
        </CustomModal>

        <AddPayeeModal
          show={showAddPayeeModal}
          onClose={() => setShowAddPayeeModal(false)}
          onAddPayee={handleAddPayee}
          showAlert={showAlert}
        />
      </div>
      )
      <div
        style={{
          position: 'absolute',
          bottom: '2mm',
          right: '15mm',
          width: 'auto',
          textAlign: 'right',
          fontSize: '13px',
          color: '#000000',
          fontFamily: '"Times New Roman", serif',
          backgroundColor: '#fff',
          padding: '2px 8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          zIndex: 100,
        }}
      ></div>
    </div>
  );
};

export default ExpenditureApproval;
