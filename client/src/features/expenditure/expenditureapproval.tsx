import React, { useState, useRef, CSSProperties, useEffect, ChangeEvent, MouseEvent, Fragment } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Info, Plus, X, Upload, Eye, Trash2, Download, ChevronLeft, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'bootstrap/dist/css/bootstrap.min.css';

import './expenditureapproval.css';
import KSRCTLogo from '../../shared/assets/images/ksrct_logo.png';

import authenticityUtility from '../../shared/utils/authenticityUtility';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
import CustomInput from '../../shared/components/ui/CustomInput';
import CustomDropdown, { OptionType } from '../../shared/components/ui/CustomDropdown';
import CustomToggle from '../../shared/components/ui/CustomToggle';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';

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
}
type PayeeLookupField = 'payeeName' | 'accountNo' | 'bankName' | 'ifsc' | 'branchName';
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
  primary_head?: string;
  event_sub_head?: string;
  approved_amount?: number;
}
interface ApprovedBudgetOption {
  budgetLineId: number;
  budgetProposalId: number | null;
  proposalRef: string;
  fiscalYear: number;
  head: string;
  subHead: string;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  beneficiaryType: string;
  beneficiaryValue: string;
}
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
interface BudgetHeadGroup {
  label: string;
  options: string[];
}
 
const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Faculty_Team: [
    "Project Team",
    "Event Organizing Team",
    "Research Team",
    "Question Paper Setting Team",
  ],
  Student_Team: ["Computer Science and Engineering",
    "Electronics and Communication Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Information Technology",
  ],
  Department: [
    "Computer Science and Engineering",
    "Electronics and Communication Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Information Technology",
  ],
  Centre: [
    "Centre for Research",
    "Centre for Innovation",
    "Centre for Industry Collaboration",
  ],
  Cell: [
    "Placement Cell",
    "Entrepreneurship Development Cell",
    "Women Empowerment Cell",
    "Alumni Cell",
  ],
  Club: [
    "Coding Club",
    "Robotics Club",
    "Cultural Club",
    "Sports Club",
  ],
};

const BUDGET_HEAD_GROUPS: BudgetHeadGroup[] = [
  {
    label: 'Non-Recurring',
    options: [
      'Civil Infrastructure',
      'Electrical Infrastructure',
      'IT Infrastructure',
      'Furniture & Fixtures',
      'Vehicles',
      'Equipment',
      'Accessories & Kits',
    ],
  },
  {
    label: 'Recurring',
    options: [],
  },
  {
    label: 'Maintenance & Spares',
    options: [
      'Maintenance Charges',
      'Spares',
      'Annual Maintenance Charges',
    ],
  },
  {
    label: 'Operational',
    options: [
      'Consumables',
      'Software',
      'Membership & Subscriptions',
      'Student Essentials',
      'Printing & Stationery',
      'Postal Expenses',
      'Local Conveyance',
    ],
  },
  {
    label: 'Events & Engagement',
    options: [
      'Events & Competitions',
      'Meetings & Audits',
    ],
  },
  {
    label: 'Academics',
    options: [
      'Faculty Empowerment',
      'Staff Empowerment',
      'Sudent Empowerment',
      'Student Capacity Building',
      'Learning Resources',
      'Accreditation Expenses',
      'Professional Body Expenses',
    ],
  },
  {
    label: 'Branding & Outreach',
    options: [
      'Advertisement & Branding',
      'Public Relations',
      'Admissions',
    ],
  },
  {
    label: 'General',
    options: [
      'Research & Development',
      'Administrative Expenses',
      'Salary',
      'Bills & Payments',
      'Miscellaneous Expenses',
    ],
  },
];
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
const CREDIT_ACCOUNT_OPTIONS = [
  'PRINCIPAL GNERAL A/C | 0751301000015840',
  'KSRCT-PRINCIPAL COMMON A/C | 0751301000264891',
  'PRINCIPAL SCHOLARSHIP A/C | 0751301000001328',
  'PRINCIPAL KSRCT ASSOCIATION ACCOUNT | 0751301000028594',
  'STAFF CLUB A/C | 0751301000005664',
  'SOCIETY OF AUTOMOTIVE ENGINEERS (SAE) CLUB KSRCTA/C | 0751301000021422',
  'KSRCT IETE CHAPTER A/C | 0751301000265626',
  'KSRCT CIVIL SERB NPDF | 0751301000264860',
  'KSRCT CIVIL SERB NPDF 2 | 0751301000265593',
  'K S RANGASAMY COLLEGE OF TECHNOLOGY AUTONOMOUS | 0751302000000224',
  'KSRCT-CNST A/C | 0751301000045784',
  'CSI CHAPTER BRANCH OF KSRCT A/C | 0751301000185368',
  'KSRCT NSS CORPUS FUND | 0751301000047863',
  'PRINCIPAL NSS UNIT KSRCT | 0751301000004545',
  'IEEE Student KSRCT | 0751301000059822',
  'ISTE Student Chapter KSRCT | 0751301000023696',
  'KSRCT RPS AICTE Project | 0075133800000643',
];
const DEBIT_ACCOUNT_OPTIONS = CREDIT_ACCOUNT_OPTIONS;
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
  Centre: [
    'Centre for Research',
    'Centre for Innovation',
    'Centre for Industry Collaboration',
  ],
  Cell: [
    'Placement Cell',
    'Entrepreneurship Development Cell',
    'Women Empowerment Cell',
    'Alumni Cell',
  ],
  Club: [
    'Coding Club',
    'Robotics Club',
    'Cultural Club',
    'Sports Club',
  ],
  Section: [
    'Section A',
    'Section B',
    'Section C',
  ],
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
];
const PAYMENT_MODE_OPTIONS = ['NEFT', 'RTGS', 'IMPS', 'Cheque', 'Cash', 'G-Pay', 'PhonePe', 'Internal Transfer'];
const PAYMENT_STATUS_OPTIONS = ['Paid', 'Pending', 'Processing', 'Cancelled'];
const BULK_NEFT_TEMPLATE_VERSION = '2026-04-11';
const EVENT_SUBHEAD_GROUPS: Record<string, Array<{ label: string; options: OptionType[] }>> = {
  'Events & Competitions': [
    {
      label: 'Academic & Professional Development',
      options: toOptions([
        'Seminar',
        'Webinar',
        'Guest Lecture',
        'Workshop',
        'Hands-on Training',
        'FDP (Faculty Development Programme)',
        'STTP (Short-Term Training Programme)',
      ]),
    },
    {
      label: 'Conferences & Conclaves',
      options: toOptions([
        'National Conference',
        'International Conference',
        'Conclave',
        'Convention',
      ]),
    },
    {
      label: 'Industry & Networking',
      options: toOptions([
        'Industry Visit',
        'Expert Visit',
        'Networking Event',
        'Industry Interaction',
        'MoU Signing',
      ]),
    },
    {
      label: 'Association & Institutional Activities',
      options: toOptions([
        'Association Function',
        'Alumni Meeting',
        'Alumni Interaction',
        'Parents Meeting',
      ]),
    },
    {
      label: 'Outreach Event',
      options: toOptions([
        'School Visit',
        'Awareness Program',
        'Campaigns',
        'Mini Marathon',
      ]),
    },
    {
      label: 'Competitions & Innovation',
      options: toOptions([
        'Hackathons',
        'Competitions',
        'Club Activities',
        'Project Expo',
        'Ideathon',
        'Start-up meet',
        'Mentoring Sessions',
      ]),
    },
    {
      label: 'Cultural & Celebrations',
      options: toOptions([
        'Annual Day',
        'Sports Day',
        'Graduation Day',
        'Science Day',
        'Womens Day',
        'Celebration Day',
        'Festival Celebrations',
        'Dakshaa',
        'Harmonicks',
      ]),
    },
    {
      label: 'Sports & Student Engagement',
      options: toOptions([
        'Sports Meet',
        'Sports Day (Engagement)',
        'Camp',
        'Rally',
        'Student Induction Programme',
        'Orientation Session',
      ]),
    },
  ],
  'Meetings & Audits': [
    {
      label: 'Institutional Governance',
      options: toOptions([
        'Governing Body Meeting',
        'Research Advisory Board Meeting',
        'Finance Committee Meeting',
        'Result Passing Board Meeting',
        'Examination Committee Meeting',
        'Placement Meeting',
        'Network Meeting',
      ]),
    },
    {
      label: 'Academic Governance',
      options: toOptions([
        'Academic Council Meeting',
        'Standing Committee Meeting',
        'Board of Studies Meeting',
        'DAB Meeting',
      ]),
    },
    {
      label: 'Audits',
      options: toOptions([
        'Academic Audit',
        'Administrative Audit',
        'Energy & Green Audit',
        'Government Meetings',
      ]),
    },
  ],
};

const flattenOptions = (options: Array<OptionType | { label: string; options: OptionType[] }>): OptionType[] =>
  options.flatMap((opt) => ('options' in opt ? opt.options : opt));

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

const normalizeWorkflowModule = (value: unknown): 'Advance' | 'Settlement' | 'Expenditure' | null => {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'advance') return 'Advance';
  if (text === 'settlement') return 'Settlement';
  if (text === 'expenditure') return 'Expenditure';
  return null;
};

const getSelectedOption = (
  value: string | number,
  options: Array<OptionType | { label: string; options: OptionType[] }>
): OptionType | null =>
  flattenOptions(options).find((opt) => String(opt.value) === String(value)) ?? null;

const PRIMARY_HEAD_OPTIONS: Array<{ label: string; options: OptionType[] }> =
  BUDGET_HEAD_GROUPS.map((group) => ({
    label: group.label,
    options: toOptions(group.options),
  }));
const SUB_HEAD_BY_BUDGET_HEAD: Record<string, string[]> = {

  'Civil Infrastructure': [
    'Construction Works',
    'Partition Works',
    'False Ceiling Works',
    'Plumbing Works',
    'Canopy',
  ],

  'Electrical Infrastructure': [
    'Electrical Wiring',
    'Lights & Fans',
    'Lift Installation',
    'Air Conditioner',
    'UPS Inverter',
    'Battery',
  ],

  'IT Infrastructure': [
    'Hardwares',
    'Softwares',
    'Hard Disks',
    'Monitors',
    'Wi-fi Router',
    'Network Materials',
    'Laptops',
    'Interactive Displays',
    'Desktops',
    'CCTV Materials',
    'Television',
    'Projectors',
    'Printers',
    'Mobiles & Tablet',
    'Mic & Speakers',
    'Amplifiers',
    'A/V Equipment',
    'Intercom',
    'Xerox Machine',
  ],

  'Furniture & Fixtures': [
    'Chair',
    'Faculty Table',
    'Computer Table',
    'Discussion Table',
    'Work Table',
    'Wooden Cup Boards',
  ],

  Vehicles: [
    'Two Wheeler',
    'Light Motor Vehicle',
    'Heavy Motor Vehicle',
  ],

  Equipment: [
    'Lab Equipment',
    'Consultancy Equipment',
    'Research Equipment',
    'Equipment Upgrade',
  ],

  'Accessories & Kits': [
    'Power Tools',
    'Weighing Machine',
    'Drilling Machine',
    'Drone Kit',
  ],

  'Maintenance Charges': [
    'Building Maintenance',
    'Computer Maintenance',
    'Electrical Maintenance',
    'Furniture Maintenance',
    'Plumbing Maintenance',
    'Vehicle Maintenance',
    'Garden Maintenance',
    'Equipment Maintenance',
    'Infrastructure Maintenance',
    'AC Maintenance',
    'UPS Maintenance',
    'Lift Maintenance',
    'Printer Maintenance',
    'Painting',
  ],

  Spares: ['Printer Donors', 'SMPS', 'Chargers'],

  'Annual Maintenance Charges': [
    'Equipment Maintenance',
    'Software Maintenance',
  ],


  Consumables: [
    'Chemicals',
    'Glasswares',
    'Plasticwares',
    'Electrical Components',
    'Electronic Components',
    'Mechanical Components',
    'Construction Materials',
    'Cutting Tools',
    'Oils & Lubricants',
    'Metals & Alloys',
    'Carpentary Items',
    'Others',
  ],

  Software: [
    'Plagiarism',
    'Grammer Check',
    'Grievance',
    'Programming',
    'Modelling',
    'Analysis',
    'Antivirus',
    'Firewall',
    'Graphical Design',
    'AI Tools',
    'Others',
  ],

  'Membership & Subscriptions': [
    'Professional Body fees',
    'Membership fees',
    'Annual Membership fee',
    'Journals',
    'Magazines',
    'Newspaper',
    'DELNET',
    'E-Resources',
    'Data Subscription Charges',
  ],

  'Student Essentials': ['Note Books', 'Log Books', 'ID Card', 'Others'],

  'Printing & Stationery': [
    'Banner',
    'Pamphlet',
    'Brochure',
    'Vinyl Boards',
    'Certificates',
    'Diary',
    'Calendar',
    'Visitng Card',
    'Seal/ Stamp Pad',
    'Pen/ Pencil/ Eraser',
    'Stapler/ Punching Machine',
    'Files/ Folders',
    'Entry Registers',
    'Print Sheets',
    'Others',
  ],

  'Postal Expenses': [
    'Frieght Charges',
    'Postal Charges',
    'Courier Charges',
    'Others',
  ],

  'Local Conveyance': [
    'Travel Expense',
    'Food & Refreshment',
    'Beta',
    'Others',
  ],

  'Events & Competitions': [
    'Remuneration',
    'Travel',
    'Accommodation',
    'Memento & Gifts',
    'Food & Refreshment',
    'A/V Arrangements',
    'Stationary',
    'Printing',
    'Prizes',
    'Publication Charges',
    'Promotions',
    'Decorations',
    'Event Logistics',
    'Registration Kit',
    'Give away',
    'T-Shirt',
    'Bag',
    'Consumables',
    'Others',
],

  'Meetings & Audits': [
    'Remuneration',
    'Travel',
    'Accommodation',
    'Memento & Gifts',
    'Food & Refreshment',
    'Stationary',
    'Printing',
    'Others',
  ],

  'Faculty Empowerment': [
    'Registration fee',
    'Travel Allowance',
    'Food & Refreshment',
    'Accommodation',
    'Daily Allowance',
    'Membership Fees',
    'Incentives',
    'Leadership Meet',
    'Faculty Welfare',
  ],

  'Staff Empowerment': [
    'Registration fee',
    'Travel Allowance',
    'Food & Refreshment',
    'Accommodation',
    'Daily Allowance',
    'Incentives',
    'Staff Welfare',
  ],

  'Sudent Empowerment': [
    'Registration fee',
    'Travel Support',
    'Food & Refreshment',
    'Accommodation',
    'Certification Costs',
    'Medical Expense',
    'Incentives',
    'Prizes',
    'Student Welfare',
    'Student Uniform',
  ],

  'Student Capacity Building': [
    'Skill Development Training',
    'ApptitudeTraining',
    'Higher Education Coaching',
    'Competitive Exam Coaching',
    'Placement Training',
    'Placement Drives',
    'One Credit Course',
    'Value Added Course',
    'Certification Programs',
    'Internship',
    'International Connect',
    'Exposure Visit',
    'Language Proficiency Courses',
    'Others',
  ],

  'Learning Resources': ['Text Books', 'E-Resources'],

  'Accreditation Expenses': [
    'NAAC Fees',
    'NBA Fees',
    'NAAC Inspection',
    'NBA Inspection',
  ],

  'Advertisement & Branding': [
    'News Paper Advertisement',
    'Digital Promotion',
  ],

  'Public Relations': ['Press & Media', 'Promotions', 'Branding', 'Corporate Gift'],

  Admissions: [
    'Stalls',
    'School Visits',
    'Field Visits',
    'Student Directory',
    'Consultant Charges',
  ],


  'Research & Development': [
    'Seed Fund (Product Development)',
    'Seed Fund (IPR Charges)',
    'Seed Fund (Travel)',
    'Institute Research Fellowship',
    'Research Grant',
    'Publication Support',
    'Consultancy',
    'Research Cenre Renewal',
    'HI Contribution',
  ],

  'Administrative Expenses': [
    'AICTE Fees',
    'Affiliation Fees',
    'Anna University Fees',
    'DOTE Fees',
    'Consortium Fees',
    'Inspection Expenses',
    'Autonomous Charges',
    'DTCP Approval',
    'Licenses & Taxes',
    'Spirit License',
    'License Renewal',
    'Insurance Charges',
    'Water Charges',
    'Stamp Charges',
    'Flag Day Expenses',
    'Fee Fixation Expenses',
    'Scholarship Expenses',
    'International Travel',
    'Testing Charges',
  ],

  Salary: [
    'Monthly Salary',
    'Provident Fund',
    'Emoluments',
    'Professional Payments',
    'Wages',
  ],

  'Bills & Payments': [
    'Electricity Charges',
    'Internet Charges',
    'Telephone Charges',
  ],

  'Miscellaneous Expenses': [
    'Bank Charges',
    'Bank Interest',
    'Loan Processing Charges',
    'Generator & Fuel',
    'Guest House',
    'Fire Extinguisher',
    'General Expenses',
    'Sewage Treatment',
    'Farm Expenses',
    'Laundry Service',
    'House Keeping',
    'RO Mineral Water',
    'Audit Fees',
    'Office Expenses',
    'Pooja Expenses',
    'Fire Extinguisher',
    'First Aid Kit Expenses',
  ],
};

const BUDGET_SELECT_STYLES = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '45px',
    height: 45,
    borderRadius: '12px',
    border: state.isFocused
      ? '1px solid #0069ab'
      : '1px solid #e0e0e0',
    backgroundColor: '#fcfdff',
    boxShadow: state.isFocused
      ? '0 0 0 3px rgba(0, 105, 171, 0.15)'
      : 'none',
    '&:hover': {
      borderColor: '#0069ab'
    }
  }),
  dropdownIndicator: (base: any, state: any) => ({
    ...base,
    padding: '0 12px',
    color: '#666',
    transition: 'transform 0.2s ease',
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)'
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '2px 8px',
    justifyContent: 'center',  // This centers the text horizontally
    alignItems: 'center',
    display: 'flex'
  }),
  singleValue: (base: any) => ({
    ...base,
    color: '#333',
    fontSize: '0.95rem',
    textAlign: 'center',  // Center text
    margin: 0,
    position: 'static',
    transform: 'none',
    maxWidth: 'calc(100% - 20px)'
  }),
  input: (base: any) => ({
    ...base,
    color: '#333',
    padding: '0',
    margin: '0',
    textAlign: 'center',
    '& input': {
      textAlign: 'center !important'
    }
  }),
  placeholder: (base: any) => ({
    ...base,
    textAlign: 'center',
    color: '#999',
    margin: 0,
    position: 'static',
    transform: 'none'
  }),
  menu: (base: any) => ({
    ...base,
    zIndex: 999999,
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
    marginTop: '4px',
    overflow: 'hidden'
  }),
  menuList: (base: any) => ({
    ...base,
    padding: '8px 0',
    maxHeight: '300px'
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
    textAlign: 'center',  // Center option text
    fontSize: '0.9rem',
    '&:active': {
      backgroundColor: '#0069ab',
      color: 'white'
    }
  })
};

const createIncomeRow = (): IncomeRow => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  incomeSource: '',
  contribution: '',
  amount: '',
  status: '',
  creditAccount: '',
});

const createPayeeRow = (): PayeeRow => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  payeeId: null,
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

const createAdvanceRow = (): AdvanceFormRow => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  budgetHead: '',
  subHead: '',
  budget: '',
  preAdvance: '',
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

const mapFinanceBeneficiaryTypeToExpenditureCategory = (value: string): string => {
  const normalized = String(value || '').trim().toLowerCase();

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

// ==================== ADD PAYEE MODAL COMPONENT ====================
// ==================== ADD PAYEE MODAL COMPONENT (FIXED) ====================
interface AddPayeeModalProps {
  show: boolean;
  onClose: () => void;
  onAddPayee: (payee: PayeeRow) => Promise<void> | void;
  showAlert: (message: React.ReactNode, type: AlertType, title?: string, showCancel?: boolean, confirmText?: string, onConfirm?: () => void) => void;
}

const AddPayeeModal: React.FC<AddPayeeModalProps> = ({ show, onClose, onAddPayee, showAlert }) => {
  // Separate data for Individual and Organization
  const [individualData, setIndividualData] = useState<{
    payeeName: string;
    accountName: string;
    panNumber: string;
    accountNo: string;
    accountType: string;
    bankName: string;
    branchName: string;
    ifsc: string;
  }>({
    payeeName: '',
    accountName: '',
    panNumber: '',
    accountNo: '',
    accountType: '',
    bankName: '',
    branchName: '',
    ifsc: '',
  });

  const [organizationData, setOrganizationData] = useState<{
    payeeName: string;
    accountName: string;
    organizationType: string;
    msme: string;
    gstin: string;
    panNumber: string;
    tdsDetails: string;
    tdsSection: string;
    accountNo: string;
    accountType: string;
    bankName: string;
    branchName: string;
    ifsc: string;
  }>({
    payeeName: '',
    accountName: '',
    organizationType: '',
    msme: '',
    gstin: '',
    panNumber: '',
    tdsDetails: '',
    tdsSection: '',
    accountNo: '',
    accountType: '',
    bankName: '',
    branchName: '',
    ifsc: '',
  });

  const [beneficiaryType, setBeneficiaryType] = useState<'individual' | 'organization'>('individual');

  // Helper: Save current form data based on active type
  const saveCurrentData = () => {
    if (beneficiaryType === 'individual') {
      setIndividualData({
        payeeName: newPayeeName,
        accountName: newAccountName,
        panNumber: newPanNumber,
        accountNo: newAccountNo,
        accountType: newAccountType,
        bankName: newBankName,
        branchName: newBranchName,
        ifsc: newIfsc,
      });
    } else {
      setOrganizationData({
        payeeName: newPayeeName,
        accountName: newAccountName,
        organizationType: orgType,
        msme: msmeValue,
        gstin: gstinValue,
        panNumber: orgPanNumber,
        tdsDetails: tdsValue,
        tdsSection: tdsSectionValue,
        accountNo: newAccountNo,
        accountType: newAccountType,
        bankName: newBankName,
        branchName: newBranchName,
        ifsc: newIfsc,
      });
    }
  };

  // Load data for the active type
  const loadDataForType = (type: 'individual' | 'organization') => {
    if (type === 'individual') {
      const data = individualData;
      setNewPayeeName(data.payeeName);
      setNewAccountName(data.accountName);
      setNewPanNumber(data.panNumber);
      setNewAccountNo(data.accountNo);
      setNewAccountType(data.accountType);
      setNewBankName(data.bankName);
      setNewBranchName(data.branchName);
      setNewIfsc(data.ifsc);
      setOrgType('');
      setMsmeValue('');
      setGstinValue('');
      setOrgPanNumber('');
      setTdsValue('');
      setTdsSectionValue('');
    } else {
      const data = organizationData;
      setNewPayeeName(data.payeeName);
      setNewAccountName(data.accountName);
      setNewAccountNo(data.accountNo);
      setNewAccountType(data.accountType);
      setNewBankName(data.bankName);
      setNewBranchName(data.branchName);
      setNewIfsc(data.ifsc);
      setOrgType(data.organizationType);
      setMsmeValue(data.msme);
      setGstinValue(data.gstin);
      setOrgPanNumber(data.panNumber);
      setTdsValue(data.tdsDetails);
      setTdsSectionValue(data.tdsSection);
    }
  };

  // Reset everything to empty (for fresh start)
  const resetToEmpty = () => {
    setNewPayeeName('');
    setNewAccountName('');
    setNewPanNumber('');
    setNewAccountNo('');
    setNewAccountType('');
    setNewBankName('');
    setNewBranchName('');
    setNewIfsc('');
    setOrgType('');
    setMsmeValue('');
    setGstinValue('');
    setOrgPanNumber('');
    setTdsValue('');
    setTdsSectionValue('');
  };

  // When modal opens, load Individual data (preserved) and set type to Individual
  useEffect(() => {
    if (show) {
      setBeneficiaryType('individual');
      loadDataForType('individual');
    }
  }, [show]);

  // ESC key handler - ADD THIS useEffect
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && show) {
        onClose();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [show, onClose]);

  // Handle toggle
  const handleToggle = (type: 'individual' | 'organization') => {
    if (type === beneficiaryType) return;
    saveCurrentData();
    setBeneficiaryType(type);
    if (type === 'individual') {
      loadDataForType('individual');
    } else {
      resetToEmpty();
    }
  };

  // Individual fields state
  const [newPayeeName, setNewPayeeName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newPanNumber, setNewPanNumber] = useState('');
  const [newAccountNo, setNewAccountNo] = useState('');
  const [newAccountType, setNewAccountType] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newIfsc, setNewIfsc] = useState('');

  // Organization fields state
  const [orgType, setOrgType] = useState('');
  const [msmeValue, setMsmeValue] = useState('');
  const [gstinValue, setGstinValue] = useState('');
  const [orgPanNumber, setOrgPanNumber] = useState('');
  const [tdsValue, setTdsValue] = useState('');
  const [tdsSectionValue, setTdsSectionValue] = useState('');

  const ORGANIZATION_TYPE_OPTIONS = [
    'Sole Proprietorship',
    'Partnership Firm',
    'Private Company',
    'Public Limited',
    'Trust / Society',
    'Government Entity'
  ];

  const TDS_SECTION_OPTIONS = [
    '192 – Salary',
    '194C – Contractor / Work',
    '194J – Professional / Technical Services',
    '194H – Commission / Brokerage',
    '194I – Rent',
    '194Q – Purchase of Goods',
    '195 – Non-Resident Payments',
    'Others'
  ];

  const handleModalSubmit = async () => {
    if (!newPayeeName || !newAccountNo || !newIfsc || !newBankName || !newBranchName) {
      showAlert('Please enter beneficiary name, account number, IFSC, bank name and branch name', 'warning');
      return;
    }

    const payeeToAdd: PayeeRow = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      payeeName: newPayeeName,
      bankName: newBankName,
      accountNo: newAccountNo,
      ifsc: newIfsc.toUpperCase(),
      branchName: newBranchName,
      url: '',
      amount: '',
      mode: '',
      accountName: newAccountName,
      accountType: newAccountType,
      beneficiaryType,
      ...(beneficiaryType === 'individual' && { panNumber: newPanNumber }),
      ...(beneficiaryType === 'organization' && {
        organizationType: orgType,
        msme: msmeValue,
        gstin: gstinValue,
        panNumber: orgPanNumber,
        tdsDetails: tdsValue,
        tdsSection: tdsValue === 'Yes' ? tdsSectionValue : ''
      })
    };

    await onAddPayee(payeeToAdd);
  };

  if (!show) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        backdropFilter: 'blur(4px)',
        cursor: 'pointer'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '560px',
          maxWidth: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          fontFamily: '"Inter", "Segoe UI", sans-serif',
          cursor: 'default'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '16px', 
            right: '16px', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            color: '#6c757d', 
            padding: '0', 
            margin: '0', 
            fontSize: '20px', 
            zIndex: 10, 
            lineHeight: 1,
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#0069ab'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6c757d'}
        >
          <X size={18} />
        </button>

        <div style={{ padding: '28px 32px' }}>
          {/* Toggle Buttons */}
          <div className="payee-modal-toggle">
            <button 
              onClick={() => handleToggle('individual')} 
              className={`payee-modal-toggle-btn ${beneficiaryType === 'individual' ? 'active' : ''}`}
            >
              Individual
            </button>
            <button 
              onClick={() => handleToggle('organization')} 
              className={`payee-modal-toggle-btn ${beneficiaryType === 'organization' ? 'active' : ''}`}
            >
              Organization
            </button>
          </div>

          {/* Individual Fields */}
          {beneficiaryType === 'individual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px', fontSize: '0.9rem', fontWeight: 600, color: '#2d3748' }}>Beneficiary</label>
                <div style={{ flex: 1, display: 'flex', gap: '24px' }}>
                  {['KSRCT', 'KSREI', 'External'].map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" name="beneficiaryInd" value={opt} checked={newPayeeName === opt} onChange={() => setNewPayeeName(opt)} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>Account Name</label>
                <input type="text" style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Enter account name" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>PAN Number</label>
                <input type="text" style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} value={newPanNumber} onChange={(e) => setNewPanNumber(e.target.value)} placeholder="Enter PAN number" />
              </div>
            </div>
          )}

          {/* Organization Fields */}
          {beneficiaryType === 'organization' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>Beneficiary</label>
                <div style={{ flex: 1, display: 'flex', gap: '24px' }}>
                  {['KSRCT', 'KSREI', 'External'].map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" name="beneficiaryOrg" value={opt} checked={newPayeeName === opt} onChange={() => setNewPayeeName(opt)} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>Account Name</label>
                <input type="text" style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Enter organization name" />
              </div>
               <div style={{ display: 'flex', alignItems: 'center' }}>
  <label style={{ width: '129px' }}>Organization Type</label>
  <div style={{ flex: 1 }}>
    <CustomDropdown
      options={ORGANIZATION_TYPE_OPTIONS.map(opt => ({ value: opt, label: opt }))}
      value={orgType ? { value: orgType, label: orgType } : null}
      onChange={(option) => {
        const selected = option as OptionType | null;
        setOrgType(selected?.value ? String(selected.value) : '');
      }}
      placeholder="Select Organization Type"
    />
  </div>
</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>MSME</label>
                <div style={{ flex: 1, display: 'flex', gap: '24px' }}>
                  <label><input type="radio" name="msme" value="Yes" onChange={(e) => setMsmeValue(e.target.value)} /> Yes</label>
                  <label><input type="radio" name="msme" value="No" onChange={(e) => setMsmeValue(e.target.value)} /> No</label>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>GSTIN</label>
                <input type="text" style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} value={gstinValue} onChange={(e) => setGstinValue(e.target.value)} placeholder="Enter GSTIN" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>PAN Number</label>
                <input type="text" style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} value={orgPanNumber} onChange={(e) => setOrgPanNumber(e.target.value)} placeholder="Enter PAN number" />
              </div>
                 {/* TDS Details - All in one horizontal line */}
<div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
  <label style={{ width: '130px', fontSize: '0.9rem', fontWeight: 600, color: '#2d3748' }}>TDS Details</label>
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
      <input type="radio" name="tds" value="Yes" checked={tdsValue === 'Yes'} onChange={(e) => setTdsValue(e.target.value)} /> Yes
    </label>
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
      <input type="radio" name="tds" value="No" checked={tdsValue === 'No'} onChange={(e) => setTdsValue(e.target.value)} /> No
    </label>
    {tdsValue === 'Yes' && (
      <div style={{ flex: 1, minWidth: '200px' }}>
        <CustomDropdown
          options={TDS_SECTION_OPTIONS.map(opt => ({ value: opt, label: opt }))}
          value={tdsSectionValue ? { value: tdsSectionValue, label: tdsSectionValue } : null}
          onChange={(option) => {
            const selected = option as OptionType | null;
            setTdsSectionValue(selected?.value ? String(selected.value) : '');
          }}
          placeholder="Select TDS Section"
        />
      </div>
    )}
  </div>
</div>
            </div>
          )}

          {/* Common Bank Details (appear for both) */}
          <div style={{ marginTop: beneficiaryType === 'individual' ? '28px' : '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>Account Number</label>
                <input type="text" style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} value={newAccountNo} onChange={(e) => setNewAccountNo(e.target.value)} placeholder="Enter account number" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>Account Type</label>
                <div style={{ flex: 1, display: 'flex', gap: '24px' }}>
                  <label><input type="radio" name="accountType" value="Savings" checked={newAccountType === 'Savings'} onChange={() => setNewAccountType('Savings')} /> Savings</label>
                  <label><input type="radio" name="accountType" value="Current" checked={newAccountType === 'Current'} onChange={() => setNewAccountType('Current')} /> Current</label>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>Bank Name</label>
                <input type="text" style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} value={newBankName} onChange={(e) => setNewBankName(e.target.value)} placeholder="Enter bank name" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>Branch Name</label>
                <input type="text" style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }} value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} placeholder="Enter branch name" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '130px' }}>IFSC Code</label>
                <input type="text" style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', textTransform: 'uppercase' }} value={newIfsc} onChange={(e) => setNewIfsc(e.target.value.toUpperCase())} placeholder="Enter IFSC code" />
              </div>
            </div>
          </div>

          <button 
            onClick={handleModalSubmit} 
            style={{ 
              width: '100%', 
              height: '52px', 
              backgroundColor: '#0069ab', 
              color: '#ffffff', 
              border: 'none', 
              borderRadius: '16px', 
              fontSize: '1rem', 
              fontWeight: 600, 
              marginTop: '32px', 
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#005492'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0069ab'}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

const ExpenditureApproval: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  const launchModuleFromState = (() => {
    const state = location.state as {
      activeTab?: unknown;
      submittedModule?: unknown;
    } | null;

    return normalizeWorkflowModule(state?.activeTab) ?? normalizeWorkflowModule(state?.submittedModule);
  })();
  const isReadOnlyView = Boolean(routeId) && !launchModuleFromState && !location.pathname.endsWith('/edit');
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

    const candidates = [
      state?.financeRequestId,
      state?.financeProposal?.proposalId,
    ];

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
  const financeApprovedAmountFromState = (() => {
    const state = location.state as {
      financeProposal?: {
        totalAmount?: unknown;
      };
    } | null;

    return Number.parseFloat(String(state?.financeProposal?.totalAmount ?? '0')) || 0;
  })();
  const [resolvedFinanceRequestId, setResolvedFinanceRequestId] = useState<number | null>(
    financeRequestIdFromState,
  );
  const [financeApprovedAmount, setFinanceApprovedAmount] = useState<number>(financeApprovedAmountFromState);
  useEffect(() => {
    setResolvedFinanceRequestId(financeRequestIdFromState);
  }, [financeRequestIdFromState]);
  useEffect(() => {
    setFinanceApprovedAmount(financeApprovedAmountFromState);
  }, [financeApprovedAmountFromState]);
  const [applicantName, setApplicantName] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
  const [budgetRows, setBudgetRows] = useState([
    { category: "", head: "", amount: "" },]);
  const [showIncomeSection, setShowIncomeSection] = useState<boolean>(false);
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([createIncomeRow()]);
  const [payeeRows, setPayeeRows] = useState<PayeeRow[]>([createPayeeRow()]);
  const [activePayeeLookupRowId, setActivePayeeLookupRowId] = useState<string | null>(null);
  const [activePayeeLookupField, setActivePayeeLookupField] = useState<PayeeLookupField | null>(null);
  const [payeeLookupResults, setPayeeLookupResults] = useState<PayeeLookupResult[]>([]);
  const [isPayeeLookupOpen, setIsPayeeLookupOpen] = useState(false);
  const [isPayeeLookupLoading, setIsPayeeLookupLoading] = useState(false);
  const [showBulkNEFT, setShowBulkNEFT] = useState<boolean>(false);
  const [paymentDetails, setPaymentDetails] = useState({
    mode: '',
    refNo: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    debitAccount: ''
  });
  const bulkNeftInputRef = useRef<HTMLInputElement>(null);
  const [bulkNeftFile, setBulkNeftFile] = useState<File | null>(null);
  const [uploadedPayeeBills, setUploadedPayeeBills] = useState<File[]>([]);
  const [remarks, setRemarks] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [isExternalApplicant, setIsExternalApplicant] = useState<boolean>(false);
  const [applicantSearchQuery, setApplicantSearchQuery] = useState<string>('');
  const [applicantSearchResults, setApplicantSearchResults] = useState<Array<{ employee_id: number; name: string; designation: string; department: string; email: string; mobile: string; employee_type: string }>>([]);
  const [showApplicantDropdown, setShowApplicantDropdown] = useState<boolean>(false);
  const componentRef = useRef<HTMLDivElement>(null);
  const [isApplicantCardOpen, setIsApplicantCardOpen] = useState(true);

  const [advanceRows, setAdvanceRows] = useState<AdvanceFormRow[]>([createAdvanceRow()]);
  const [settlementRows, setSettlementRows] = useState<SettlementFormRow[]>([createSettlementRow()]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryType, setCategoryType] = useState<string>('');
  const [categoryItem, setCategoryItem] = useState<string>('');
  const [categorySelections, setCategorySelections] = useState<string[]>([]);
  const [primaryHead, setPrimaryHead] = useState<string>('');
  const [eventSubHead, setEventSubHead] = useState<string>('');
  const [showBudgetHeadModal, setShowBudgetHeadModal] = useState<boolean>(false);
  const [selectedBudgetHeadForModal, setSelectedBudgetHeadForModal] = useState<string>('');
  const [beneficiarySearchQuery, setBeneficiarySearchQuery] = useState<string>('');
  const [beneficiarySearchResults, setBeneficiarySearchResults] = useState<Array<{
    employeeid: number; name: string; designation: string; department: string;
  }>>([]);
  const [showBeneficiaryDropdown, setShowBeneficiaryDropdown] = useState(false);
  const [beneficiaryEmployeeId, setBeneficiaryEmployeeId] = useState<number | null>(null);
  const [isPayeeCardOpen, setIsPayeeCardOpen] = useState(true);
  const [showAddPayeeModal, setShowAddPayeeModal] = useState(false);
  const [newPayee, setNewPayee] = useState<PayeeRow>(createPayeeRow());
  const [approvedBudgetOptions, setApprovedBudgetOptions] = useState<ApprovedBudgetOption[]>([]);
  const [isApprovedBudgetLoading, setIsApprovedBudgetLoading] = useState(false);
  const [subcategoryOptionsByType, setSubcategoryOptionsByType] = useState<Record<string, SelectOption[]>>({});
  const [tagOptions, setTagOptions] = useState<SelectOption[]>(FALLBACK_TAG_OPTIONS);
  const [showDebitAccountDropdown, setShowDebitAccountDropdown] = useState(false);
  const payeeLookupTimeoutRef = useRef<number | null>(null);
  const payeeLookupRequestRef = useRef(0);
const normalizeText = (value: unknown): string => String(value ?? '').trim();
  const [expenditureSubRows, setExpenditureSubRows] = useState<ExpenditureFormRow[]>([createExpenditureRow()]);
  const [activeTab, setActiveTab] = useState<'Advance' | 'Settlement' | 'Expenditure' | null>(
    launchModuleFromState,
  );

  useEffect(() => {
    if (!resolvedFinanceRequestId) {
      return;
    }

    let isCancelled = false;

    const loadFinanceContext = async () => {
      try {
        const response = await authenticityUtility.get(
          `/expenditure/finance-context/${resolvedFinanceRequestId}`
        ) as { status: string; data?: FinanceRequestContext };

        if (isCancelled || response.status !== 'success' || !response.data) {
          return;
        }

        const financeContext = response.data;
        const nextCategoryType = mapFinanceBeneficiaryTypeToExpenditureCategory(financeContext.beneficiary_type || '');

        setFinanceApprovedAmount(Number(financeContext.approved_amount || financeApprovedAmountFromState || 0));
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
    if (!submittedRequestIdFromState) {
      return;
    }

    let isCancelled = false;

    const loadSubmittedRequest = async () => {
      try {
        const response = await authenticityUtility.get(`/expenditure/${submittedRequestIdFromState}`) as {
          status: string;
          data?: any;
        };

        if (isCancelled || response.status !== 'success' || !response.data) {
          return;
        }

        const record = response.data;
        setResolvedFinanceRequestId(parsePositiveIntLike(record.finance_request_id) ?? null);
        const toRowId = (suffix: string, index: number) => `${submittedRequestIdFromState}-${suffix}-${index}`;

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

        const mapPayeeRows = Array.isArray(record.payee_rows)
          ? record.payee_rows.map((row: any, index: number) => ({
              id: `${submittedRequestIdFromState}-payee-${index}`,
              payeeId: row?.payee_id ?? null,
              payeeName: String(row?.payee_name || ''),
              bankName: String(row?.bank_name || ''),
              accountNo: String(row?.account_no || ''),
              ifsc: String(row?.ifsc || ''),
              branchName: String(row?.branch_name || ''),
              url: String(row?.url || ''),
              amount: String(row?.amount || ''),
              mode: String(row?.mode || ''),
              accountName: String(row?.account_name || ''),
              panNumber: String(row?.pan_number || ''),
              accountType: String(row?.account_type || ''),
              beneficiaryType: String(row?.beneficiary_type || 'individual'),
              beneficiaryOrg: String(row?.beneficiary_org || ''),
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
        setDate(String(record.request_date || new Date().toISOString().split('T')[0]));
        setDescription(String(record.description || ''));
        setCategoryType(String(record.beneficiary_type || ''));
        setCategoryItem(String(record.beneficiary_value || ''));
        setSelectedTag(String(record.budget_tag || ''));
        setPrimaryHead(String(record.primary_head || ''));
        setEventSubHead(String(record.event_sub_head || ''));
        setIsBudgetProposed(String(record.is_budget_proposed || ''));
        setDebitStatus(String(record.debit_status || '') as 'credited' | 'reimbursement' | '');
        setAmountProposed(String(record.total_amount ?? record.approved_total_amount ?? ''));
        if (Number(record.approved_amount || 0) > 0) {
          setFinanceApprovedAmount(Number(record.approved_amount));
        }
        const requestType = normalizeText(record.request_type);
        setActiveTab(
          launchModuleFromState
            ?? (requestType === 'Advance' || requestType === 'Settlement' || requestType === 'Expenditure'
              ? requestType
              : null),
        );
        setAdvanceRows(mapAdvanceRows.length > 0 ? mapAdvanceRows : [createAdvanceRow()]);
        setSettlementRows(mapSettlementRows.length > 0 ? mapSettlementRows : [createSettlementRow()]);
        setExpenditureSubRows(mapExpenditureRows.length > 0 ? mapExpenditureRows : [createExpenditureRow()]);
        setPayeeRows(mapPayeeRows.length > 0 ? mapPayeeRows : [createPayeeRow()]);
        setPaymentDetails({
          mode: String(record.payment_mode || ''),
          refNo: String(record.payment_ref_no || ''),
          date: String(record.payment_date || new Date().toISOString().split('T')[0]),
          status: String(record.payment_status || 'Pending'),
          debitAccount: String(record.payment_debit_account || ''),
        });
        setShowBulkNEFT(Boolean(record.bulk_neft_file));
        setShowDebitAccountDropdown(Boolean(record.payment_debit_account));
        setUploadedPayeeBills([]);
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load submitted expenditure request:', error);
        }
      }
    };

    loadSubmittedRequest();

    return () => {
      isCancelled = true;
    };
  }, [submittedRequestIdFromState]);

  useEffect(() => {
    let isCancelled = false;

    const loadApprovedBudgets = async () => {
      if (!resolvedFinanceRequestId) {
        setApprovedBudgetOptions([]);
        return;
      }

      try {
        setIsApprovedBudgetLoading(true);
        const budgetUrl = `/expenditure/budget/approved?finance_request_id=${resolvedFinanceRequestId}`;
        const response = await authenticityUtility.get(budgetUrl) as {
          status: string;
          data?: ApprovedBudgetOption[];
        };

        if (!isCancelled && response.status === 'success') {
          setApprovedBudgetOptions(Array.isArray(response.data) ? response.data : []);
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
  }, [resolvedFinanceRequestId]);
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
    parsePositiveIntLike(state?.workflowbudgetlineid) ??
    parsePositiveIntLike(state?.budgetLineId)
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
        const response = await authenticityUtility.get('budget/org-units') as any;
        const grouped = response?.data?.grouped;

        if (grouped && typeof grouped === 'object') {
          Object.entries(BENEFICIARY_TYPE_TO_ENTITY_API_TYPE).forEach(([beneficiaryKey, apiType]) => {
            const rows = Array.isArray((grouped as Record<string, any[]>)[apiType])
              ? (grouped as Record<string, any[]>)[apiType]
              : [];
            nextOptions[beneficiaryKey] = toOptionList(rows);
          });
        } else {
          throw new Error('Grouped org-units payload unavailable');
        }
      } catch (error) {
        console.error('Failed to fetch bulk org units, falling back to per-type calls:', error);

        for (const [beneficiaryKey, apiType] of Object.entries(BENEFICIARY_TYPE_TO_ENTITY_API_TYPE)) {
          try {
            const response = await authenticityUtility.get(`/finance-requests/org-units/${apiType}`) as any;
            const rows = Array.isArray(response?.data) ? response.data : [];
            nextOptions[beneficiaryKey] = toOptionList(rows);
          } catch (fallbackError) {
            console.error(`Failed to fetch options for ${beneficiaryKey}:`, fallbackError);
            nextOptions[beneficiaryKey] =
              FALLBACK_SUBCATEGORY_OPTIONS[beneficiaryKey]?.map((opt) => ({ value: opt, label: opt })) || [];
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
        const response = await authenticityUtility.get('/finance-requests/tags') as any;
        if (response?.success && Array.isArray(response?.data)) {
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
  const removeAdvanceRow = (id: string) => setAdvanceRows(advanceRows.filter(r => r.id !== id));

  const addSettlementRow = () => setSettlementRows([...settlementRows, createSettlementRow()]);
  const removeSettlementRow = (id: string) => setSettlementRows(settlementRows.filter(r => r.id !== id));

  const calculateSum = (input: string): string => {
    try {
      if (!input) return '';
      // If it doesn't contain '+', just return the value if it's a number
      if (!input.includes('+')) {
        const val = parseFloat(input);
        return isNaN(val) ? '' : val.toString();
      }
      const parts = input.split('+').map(p => p.trim());
      const sum = parts.reduce((acc, part) => {
        const val = parseFloat(part);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      return sum > 0 ? sum.toString() : '';
    } catch (e) {
      return '';
    }
  };

  const addExpenditureRow = () => setExpenditureSubRows([...expenditureSubRows, createExpenditureRow()]);
  const removeExpenditureRow = (id: string) => setExpenditureSubRows(expenditureSubRows.filter(r => r.id !== id));
 
   const formatDMY = (value: string | Date | null | undefined) => {
     if (!value) return "";
     const d = new Date(value);
     if (isNaN(d.getTime())) return "";
     const day = String(d.getDate()).padStart(2, "0");
     const month = String(d.getMonth() + 1).padStart(2, "0");
     const year = d.getFullYear();
     return `${day}.${month}.${year}`;
   };
 
   const numberToIndianWords = (num: number): string => {
     if (num === 0) return "Zero rupees only";
     const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
     const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
     const inWordsBelowThousand = (n: number): string => {
       let str = "";
       if (n > 99) { str += a[Math.floor(n / 100)] + " hundred "; n %= 100; }
       if (n > 19) { str += b[Math.floor(n / 10)]!.toLowerCase() + " "; n %= 10; }
       if (n > 0) { str += a[n]!.toLowerCase().replace(/^./, c => c.toUpperCase()) + " "; }
       return str.trim();
     };
     let n = Math.floor(num);
     let result = "";
     const crore = Math.floor(n / 10000000);
     if (crore) { result += inWordsBelowThousand(crore) + " crore "; n %= 10000000; }
     const lakh = Math.floor(n / 100000);
     if (lakh) { result += inWordsBelowThousand(lakh) + " lakh "; n %= 100000; }
     const thousand = Math.floor(n / 1000);
     if (thousand) { result += inWordsBelowThousand(thousand) + " thousand "; n %= 1000; }
     if (n > 0) { result += inWordsBelowThousand(n); }
     const titleCased = result.trim().replace(/\b\w/g, l => l.toUpperCase()).replace(/[A-Z]{2,}/g, m => m.charAt(0) + m.slice(1).toLowerCase());
     return titleCased + " Rupees only";
   };

   const MAX_AMOUNT = 999999999;
 
   const getSubcategoryLabel = (category: string) => {
     if (!category) return "Sub category";
     return category;
   };
 
  const isMultipleSelect = (type: string) => type === 'Faculty' || type === 'Staff';

  const subcategoryOptions: OptionType[] = subcategoryOptionsByType[categoryType] || [];
  const subcategoryList: string[] = subcategoryOptions.map((option) => String(option.value));
   const hasSubcategories = subcategoryList.length > 0;
 
   const extraDropdownVisible = primaryHead === 'Events & Competitions' || primaryHead === 'Meetings & Audits';

  const addPayeeRow = () => setPayeeRows([...payeeRows, createPayeeRow()]);
  const removePayeeRow = (id: string) => setPayeeRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

  useEffect(() => {
    return () => {
      if (payeeLookupTimeoutRef.current) {
        window.clearTimeout(payeeLookupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!categoryType?.trim()) {
      setSelectedTag('');
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
        return '';
      }

      if (
        categoryType === 'Centre'
        || categoryType === 'Cell'
        || categoryType === 'Club'
        || categoryType === 'Section'
        || categoryType === 'Institution'
        || categoryType === 'Professional Body'
      ) {
        return 'Essentials';
      }

      return '';
    });
  }, [categoryType]);

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
      .map((row, index) => ({
        id: Number(`9${index + 1}`),
        payee_id: row.payeeId ?? null,
        payee_name: row.payeeName,
        account_name: row.accountName || null,
        pan_number: row.panNumber || null,
        account_no: row.accountNo,
        account_type: row.accountType || null,
        bank_name: row.bankName,
        branch_name: row.branchName,
        ifsc: row.ifsc,
        beneficiary_type: row.beneficiaryType || 'individual',
        beneficiary_org: row.beneficiaryOrg || null,
        organization_type: row.organizationType || null,
        msme: row.msme || null,
        gstin: row.gstin || null,
        tds_details: row.tdsDetails || null,
        tds_section: row.tdsSection || null,
      }));
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
      const response = await authenticityUtility.get(
        `/expenditure/payees?search=${encodeURIComponent(normalizedQuery)}&limit=8`
      ) as { status: string; data?: PayeeLookupResult[] };

      if (requestId !== payeeLookupRequestRef.current) {
        return;
      }

      const remoteMatches = Array.isArray(response.data) ? response.data : [];
      const mergedMatches = [...localMatches];
      const seenKeys = new Set(
        localMatches.map((payee) => `${payee.account_no || ''}|${String(payee.ifsc || '').toUpperCase()}|${payee.payee_name || ''}`)
      );

      remoteMatches.forEach((payee) => {
        const key = `${payee.account_no || ''}|${String(payee.ifsc || '').toUpperCase()}|${payee.payee_name || ''}`;
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
      const shouldResetPayeeId = field !== 'amount';
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

    if (approvedHeads.length > 0) {
      return Array.from(new Set(approvedHeads))
        .map((head) => ({ value: head, label: head }));
    }

    return PRIMARY_HEAD_OPTIONS.flatMap((group) => group.options)
      .map((option) => ({ value: String(option.value), label: String(option.label) }));
  };

  const getApprovedSubHeadOptionsForAdvance = (budgetHead: string | number): OptionType[] => {
    const normalizedHead = String(budgetHead || '').trim().toLowerCase();
    if (!normalizedHead) return [];
    const approvedSubHeads: string[] = approvedBudgetOptions
      .filter((budget) => budget.head.trim().toLowerCase() === normalizedHead)
      .map((budget) => String(budget.subHead || '').trim())
      .filter(Boolean);

    if (approvedSubHeads.length > 0) {
      return Array.from(new Set(approvedSubHeads))
        .map((subHead) => ({ value: subHead, label: subHead }));
    }

    return (SUB_HEAD_BY_BUDGET_HEAD[String(budgetHead)] || [])
      .map((subHead) => ({ value: String(subHead), label: String(subHead) }));
  };

  const findApprovedBudgetOption = (budgetHead: string | number, subHead: string | number) => {
    const normalizedHead = String(budgetHead || '').trim().toLowerCase();
    const normalizedSubHead = String(subHead || '').trim().toLowerCase();
    if (!normalizedHead || !normalizedSubHead) return null;

    return approvedBudgetOptions.find((budget) =>
      budget.head.trim().toLowerCase() === normalizedHead
      && budget.subHead.trim().toLowerCase() === normalizedSubHead
    ) || null;
  };

  const getApprovedBudgetAmount = (budget: ApprovedBudgetOption | null) =>
    String(financeApprovedAmount || budget?.totalAmount || '');

  const getBudgetDisplayValue = (rowBudget: string) => {
    const approved = Number(financeApprovedAmount || 0);
    if (approved > 0) {
      return `₹ ${approved.toLocaleString('en-IN')}`;
    }

    return rowBudget !== '' ? `₹ ${Number(rowBudget || 0).toLocaleString('en-IN')}` : '';
  };

  const updateAdvanceRow = (rowId: string, updater: (row: AdvanceFormRow) => AdvanceFormRow) => {
    setAdvanceRows((prev) => prev.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const updateSettlementRow = (rowId: string, updater: (row: SettlementFormRow) => SettlementFormRow) => {
    setSettlementRows((prev) => prev.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const updateExpenditureRow = (rowId: string, updater: (row: ExpenditureFormRow) => ExpenditureFormRow) => {
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
      updateAdvanceRow(rowId, (row) => ({ ...row, preAdvance: '' }));
      return;
    }

    try {
      const query = new URLSearchParams();
      if (budgetLineId) query.set('budget_line_id', String(budgetLineId));
      if (normalizedHead) query.set('head', normalizedHead);
      if (normalizedSubHead) query.set('sub_head', normalizedSubHead);

      const response = await authenticityUtility.get(
        `/expenditure/advance-summary?${query.toString()}`
      ) as { status: string; data?: { preAdvance?: number } };

      if (response.status === 'success') {
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
    const amount = Number(String(row.advance || '').replace(/,/g, '').trim());
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const totalSettlementAmount = settlementRows.reduce((sum, row) => {
    const amount = Number(String(row.settlement || '').replace(/,/g, '').trim());
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const totalExpenditureAmount = expenditureSubRows.reduce((sum, row) => {
    const amount = Number(String(row.autoSum || row.expenditure || '').replace(/,/g, '').trim());
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const handleAdvanceBudgetHeadChange = (rowId: string, budgetHeadValue: string) => {
    updateAdvanceRow(rowId, (row) => ({
      ...row,
      budgetHead: budgetHeadValue,
      subHead: '',
      budget: '',
      preAdvance: '',
      advance: row.advance,
      budgetLineId: null,
      budgetProposalId: null,
    }));
  };

  const handleAdvanceSubHeadChange = async (rowId: string, subHeadValue: string) => {
    const row = advanceRows.find((entry) => entry.id === rowId);
    const budgetHeadValue = String(row?.budgetHead || '').trim();

    const selectedBudget = findApprovedBudgetOption(budgetHeadValue, subHeadValue);

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

  const handleSettlementBudgetHeadChange = (rowId: string, budgetHeadValue: string) => {
    updateSettlementRow(rowId, (row) => ({
      ...row,
      budgetHead: budgetHeadValue,
      subHead: '',
      budget: '',
      budgetLineId: null,
      budgetProposalId: null,
    }));
  };

  const handleSettlementSubHeadChange = (rowId: string, subHeadValue: string) => {
    const row = settlementRows.find((entry) => entry.id === rowId);
    const budgetHeadValue = String(row?.budgetHead || '').trim();
    const selectedBudget = findApprovedBudgetOption(budgetHeadValue, subHeadValue);

    updateSettlementRow(rowId, (currentRow) => ({
      ...currentRow,
      subHead: subHeadValue,
      budget: getApprovedBudgetAmount(selectedBudget),
      budgetLineId: selectedBudget?.budgetLineId ?? null,
      budgetProposalId: selectedBudget?.budgetProposalId ?? null,
    }));
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

  const handleExpenditureSubHeadChange = (rowId: string, subHeadValue: string) => {
    const row = expenditureSubRows.find((entry) => entry.id === rowId);
    const budgetHeadValue = String(row?.budgetHead || '').trim();
    const selectedBudget = findApprovedBudgetOption(budgetHeadValue, subHeadValue);

    updateExpenditureRow(rowId, (currentRow) => ({
      ...currentRow,
      subHead: subHeadValue,
      budget: getApprovedBudgetAmount(selectedBudget),
      budgetLineId: selectedBudget?.budgetLineId ?? null,
      budgetProposalId: selectedBudget?.budgetProposalId ?? null,
    }));
  };

  const applyPayeeLookupSelection = (rowId: string, payee: PayeeLookupResult) => {
    updatePayeeRow(rowId, (row) => ({
      ...row,
      payeeId: payee.payee_id ?? payee.id ?? row.payeeId ?? null,
      payeeName: String(payee.payee_name || '').trim() || row.payeeName,
      accountNo: String(payee.account_no || '').trim() || row.accountNo,
      bankName: String(payee.bank_name || '').trim() || row.bankName,
      ifsc: String(payee.ifsc || '').trim().toUpperCase() || row.ifsc,
      branchName: String(payee.branch_name || '').trim() || row.branchName,
      accountName: String(payee.account_name || '').trim() || row.accountName,
      panNumber: String(payee.pan_number || '').trim() || row.panNumber,
      accountType: String(payee.account_type || '').trim() || row.accountType,
      beneficiaryType: String(payee.beneficiary_type || '').trim().toLowerCase() === 'organization'
        ? 'organization'
        : 'individual',
      beneficiaryOrg: String(payee.beneficiary_org || '').trim() || row.beneficiaryOrg,
      organizationType: String(payee.organization_type || '').trim() || row.organizationType,
      msme: String(payee.msme || '').trim() || row.msme,
      gstin: String(payee.gstin || '').trim() || row.gstin,
      tdsDetails: String(payee.tds_details || '').trim() || row.tdsDetails,
      tdsSection: String(payee.tds_section || '').trim() || row.tdsSection,
    }));

    closePayeeLookup();
  };

  const renderPayeeLookupDropdown = (rowId: string, field: PayeeLookupField) => {
    if (activePayeeLookupRowId !== rowId || activePayeeLookupField !== field || !isPayeeLookupOpen) {
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
                {payee.payee_name || 'Unnamed payee'}
              </div>
              <div className="payee-search-item-sub">
                {[
                  payee.bank_name,
                  payee.account_no,
                  payee.ifsc,
                  payee.branch_name,
                ].filter(Boolean).join(' | ')}
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
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedPayeeBills(prev => [...prev, ...files]);
    }
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
        }
      );

      if (!response.ok) {
        throw new Error(`Template download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const filename = filenameMatch?.[1] || `bulk-neft-template-v${BULK_NEFT_TEMPLATE_VERSION}.xls`;
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
    setUploadedPayeeBills(prev => prev.filter((_, i) => i !== index));
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
    message: "",
    type: "info"
  });

  const showAlert = (message: React.ReactNode, type: AlertType = "info", title?: string, showCancel = false, confirmText = "OK", onConfirm?: () => void) => {
    setAlertConfig({ show: true, message, type, title, onConfirm, showCancel, confirmText });
  };

  const closeAlert = () => setAlertConfig(prev => ({ ...prev, show: false }));

  // Search applicant handler
  const handleApplicantSearch = async (query: string) => {
    setApplicantSearchQuery(query);
    // Allow empty query to fetch initial list
    // if (query.length < 2) { ... } <- Removed restriction
    try {
      const response = await authenticityUtility.get(`/expenditure/search-applicant?q=${encodeURIComponent(query)}`) as { status: string; data: Array<{ employee_id: number; name: string; designation: string; department: string; email: string; mobile: string; employee_type: string }> };
      if (response.status === 'success') {
        setApplicantSearchResults(response.data || []);
        setShowApplicantDropdown(true);
      }
    } catch (error) {
      console.error('Error searching applicant:', error);
    }
  };

  // Select applicant from search results
  const handleSelectApplicant = (emp: { employee_id: number; name: string; designation: string; department: string; email: string; mobile: string }) => {
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
    documentTitle: "Expenditure_Approval_Request",
  });
   const formatSelections = (selections: SelectOption[]): string => {
    return selections.map(sel => sel.value).join(', ') || '';
  };

  const handleAddRow = () => {
    const firstRowCategory = budgetRows[0]?.category || '';

    setBudgetRows(prev => [
      ...prev,
      {
        category: firstRowCategory,
        head: '',
        amount: ''
      }
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
    setIncomeRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const totalBudget = budgetRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const actionCell: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
  };

  const iconBtn: CSSProperties = {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: '#f0f7ff',
    color: '#0069ab',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    transition: 'all 0.3s ease',
  };

  const deleteIconBtn: CSSProperties = {
    ...iconBtn,
    background: '#fff5f5',
    color: '#ff4d4f',
    alignItems:'center'
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
                style={{ color: '#ff4d4f', gap: '6px' }}
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
          aria-label={showDebitAccountDropdown ? 'Disable debit account dropdown' : 'Enable debit account dropdown'}
          aria-pressed={showDebitAccountDropdown}
        >
          <span className="payee-footer-switch-thumb" />
        </button>
      </div>
      <div className="payee-footer-debit-dropdown">
        {showDebitAccountDropdown && (
          <CustomDropdown
            name="debitAccount"
            options={toOptions(DEBIT_ACCOUNT_OPTIONS)}
            value={getSelectedOption(paymentDetails.debitAccount, toOptions(DEBIT_ACCOUNT_OPTIONS))}
            onChange={(option) => setPaymentDetails({ ...paymentDetails, debitAccount: String((option as OptionType)?.value || '') })}
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
                multiple
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
            <button className="payee-toolbar-btn" onClick={() => setShowAddPayeeModal(true)}>Add Payee</button>
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
                <th style={{ width: '25%' }}>Transaction</th>
                <th className="payee-col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {payeeRows.map((row, index) => (
                <tr key={row.id}>
                  <td className="payee-sno-cell">{index + 1}</td>
                  <td>
                    <div className="payee-lookup-wrap">
                      <div className="payee-details-grid">
                        <div className="payee-field-wrap">
                          <input
                            className="payee-field"
                            placeholder="<<Payee Name>>"
                            value={row.payeeName}
                            onChange={(e) => {
                              handlePayeeLookupInputChange(row.id, 'payeeName', e.target.value);
                            }}
                            onFocus={() => handlePayeeLookupFocus(row, 'payeeName')}
                            onBlur={handlePayeeLookupBlur}
                          />
                          {renderPayeeLookupDropdown(row.id, 'payeeName')}
                        </div>
                        <div className="payee-field-wrap">
                          <input
                            className="payee-field"
                            placeholder="<<Account No.>>"
                            value={row.accountNo}
                            onChange={(e) => {
                              handlePayeeLookupInputChange(row.id, 'accountNo', e.target.value);
                            }}
                            onFocus={() => handlePayeeLookupFocus(row, 'accountNo')}
                            onBlur={handlePayeeLookupBlur}
                          />
                          {renderPayeeLookupDropdown(row.id, 'accountNo')}
                        </div>
                        <div className="payee-field-wrap">
                          <input
                            className="payee-field"
                            placeholder="<<Bank Name>>"
                            value={row.bankName}
                            onChange={(e) => {
                              handlePayeeLookupInputChange(row.id, 'bankName', e.target.value);
                            }}
                            onFocus={() => handlePayeeLookupFocus(row, 'bankName')}
                            onBlur={handlePayeeLookupBlur}
                          />
                          {renderPayeeLookupDropdown(row.id, 'bankName')}
                        </div>
                        <div className="payee-field-wrap">
                          <input
                            className="payee-field"
                            placeholder="<<IFSC>>"
                            value={row.ifsc}
                            onChange={(e) => {
                              handlePayeeLookupInputChange(row.id, 'ifsc', e.target.value);
                            }}
                            onFocus={() => handlePayeeLookupFocus(row, 'ifsc')}
                            onBlur={handlePayeeLookupBlur}
                          />
                          {renderPayeeLookupDropdown(row.id, 'ifsc')}
                        </div>
                        <div className="payee-field-wrap payee-field-wrap-full">
                          <input
                            className="payee-field"
                            placeholder="<<Branch Name>>"
                            value={row.branchName}
                            onChange={(e) => {
                              handlePayeeLookupInputChange(row.id, 'branchName', e.target.value);
                            }}
                            onFocus={() => handlePayeeLookupFocus(row, 'branchName')}
                            onBlur={handlePayeeLookupBlur}
                          />
                          {renderPayeeLookupDropdown(row.id, 'branchName')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="payee-stack">
                      <input
                        className="payee-field"
                        placeholder="<<Amount>>"
                        value={row.amount}
                        onChange={(e) => {
                          const updated = payeeRows.map(r => r.id === row.id ? { ...r, amount: e.target.value } : r);
                          setPayeeRows(updated);
                        }}
                      />
                      <CustomDropdown
                        options={toOptions(PAYMENT_MODE_OPTIONS)}
                        value={getSelectedOption(row.mode, toOptions(PAYMENT_MODE_OPTIONS))}
                        onChange={(opt) => {
                          const selected = opt as OptionType | null;
                          const updated = payeeRows.map(r => r.id === row.id ? { ...r, mode: selected?.value ? String(selected.value) : '' } : r);
                          setPayeeRows(updated);
                        }}
                        placeholder="<<Mode>>"
                        
                      />
                    </div>
                    {(row.tdsDetails || row.tdsSection) && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#6c757d', lineHeight: 1.5 }}>
                        {row.tdsDetails && <div>TDS Details: {row.tdsDetails}</div>}
                        {row.tdsSection && <div>TDS Section: {row.tdsSection}</div>}
                      </div>
                    )}
                    TDS   <input type="radio" name={`tds-${row.id}`} /> Yes <input type="radio" name={`tds-${row.id}`} /> No
                  </td>
                  <td style={{ borderBottom: 'none', verticalAlign: 'middle', textAlign: 'center' }}>
                    <div className="payee-row-actions">
                      <button
                        className="payee-row-btn"
                        disabled={!row.payeeName || !row.accountNo || !row.bankName || !row.ifsc || !row.branchName || !row.amount || !row.mode}
                        onClick={(e) => { e.preventDefault(); addPayeeRow(); }}
                        title={(!row.payeeName || !row.accountNo || !row.bankName || !row.ifsc || !row.branchName || !row.amount || !row.mode) ? "Please fill all fields to add a new row" : "Add Row"}
                        style={{
                          opacity: (!row.payeeName || !row.accountNo || !row.bankName || !row.ifsc || !row.branchName || !row.amount || !row.mode) ? 0.5 : 1,
                          cursor: (!row.payeeName || !row.accountNo || !row.bankName || !row.ifsc || !row.branchName || !row.amount || !row.mode) ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Plus size={20} />
                      </button>
                      {payeeRows.length > 1 && (
                        <button
                          className="payee-row-btn payee-row-btn-delete"
                          onClick={(e) => { e.preventDefault(); removePayeeRow(row.id); }}
                          title="Delete Row"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
                  aria-label={showDebitAccountDropdown ? 'Disable debit account dropdown' : 'Enable debit account dropdown'}
                  aria-pressed={showDebitAccountDropdown}
                >
                  <span className="payee-footer-switch-thumb" />
                </button>
              </div>
              <div className="payee-footer-debit-dropdown">
                {showDebitAccountDropdown && (
                  <CustomDropdown
                    name="debitAccount"
                    options={toOptions(DEBIT_ACCOUNT_OPTIONS)}
                    value={getSelectedOption(paymentDetails.debitAccount, toOptions(DEBIT_ACCOUNT_OPTIONS))}
                    onChange={(option) => setPaymentDetails({ ...paymentDetails, debitAccount: String((option as OptionType)?.value || '') })}
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
              multiple
              onChange={handlePayeeBillUpload}
            />
          </label>
        </div>

        {uploadedPayeeBills.length > 0 && (
          <div className="payee-uploaded-files">
            <div className="payee-uploaded-files-header">
              <span>S.No</span>
              <span>Bills File</span>
              <span>Action</span>
            </div>
            {uploadedPayeeBills.map((file, i) => (
              <div key={i} className="payee-uploaded-file-row">
                <span className="payee-uploaded-file-index">{i + 1}</span>
                <span className="payee-uploaded-file-name" title={file.name}>{file.name}</span>
                <div className="payee-upload-actions">
                  <button
                    className="payee-upload-view-btn"
                    onClick={(e) => { e.preventDefault(); if (file) window.open(URL.createObjectURL(file), '_blank'); }}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className="payee-upload-view-btn payee-upload-delete-btn"
                    onClick={(e) => { e.preventDefault(); removePayeeBill(i); }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  type WorkflowFormRow =
  | AdvanceFormRow
  | SettlementFormRow
  | ExpenditureFormRow;

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
      (row) => parsePositiveIntLike(row.budgetLineId) === workflowBudgetLineIdFromState
    );
    if (matched) return matched;
  }

  if (rows.length === 1) return rows[0];

  const rowsWithBudgetLine = rows.filter((row) =>
    Boolean(parsePositiveIntLike(row.budgetLineId))
  );

  if (rowsWithBudgetLine.length === 1) return rowsWithBudgetLine[0];

  return null;
};

const getSelectedWorkflowBudgetLineId = (): number | null =>
  parsePositiveIntLike(getSelectedWorkflowRow()?.budgetLineId);

const getSelectedWorkflowBudgetProposalId = (): number | null =>
  parsePositiveIntLike(getSelectedWorkflowRow()?.budgetProposalId);
 const handleSubmit = async (): Promise<void> => {
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
      showAlert('Please choose Advance, Settlement, or Expenditure before submitting.', 'warning');
      return;
    }

    const selectedWorkflowRow = getSelectedWorkflowRow();
    const selectedWorkflowBudgetLineId = parsePositiveIntLike(selectedWorkflowRow?.budgetLineId);
    const selectedWorkflowBudgetProposalId = parsePositiveIntLike(selectedWorkflowRow?.budgetProposalId);

    if (!selectedWorkflowRow) {
      showAlert(
        'Unable to identify the selected workflow row. Please open the request again from the dashboard row you want to submit.',
        'warning'
      );
      return;
    }

    if (!selectedWorkflowBudgetLineId) {
      showAlert(
        'Please select a valid approved budget head and sub-head for this row before submitting.',
        'warning'
      );
      return;
    }

    const primaryIncomeRow = showIncomeSection ? incomeRows[0] : undefined;

    const normalizedPayeeRows = payeeRows.map((row) => ({
      payee_id: row.payeeId ?? null,
      payee_name: row.payeeName?.trim() || '',
      bank_name: row.bankName?.trim() || '',
      account_no: row.accountNo?.trim() || '',
      ifsc: row.ifsc?.trim().toUpperCase() || '',
      branch_name: row.branchName?.trim() || '',
      url: row.url?.trim() || '',
      amount: row.amount?.trim() || '',
      mode: row.mode?.trim() || '',
      account_name: row.accountName?.trim() || '',
      pan_number: row.panNumber?.trim() || '',
      account_type: row.accountType?.trim() || '',
      beneficiary_type: row.beneficiaryType || 'individual',
      beneficiary_org: row.beneficiaryOrg?.trim() || '',
      organization_type: row.organizationType?.trim() || '',
      msme: row.msme?.trim() || '',
      gstin: row.gstin?.trim() || '',
      tds_details: row.tdsDetails?.trim() || '',
      tds_section: row.tdsSection?.trim() || '',
    }));

    const selectedAdvanceRows =
      activeTab === 'Advance' && selectedWorkflowRow
        ? [selectedWorkflowRow as AdvanceFormRow]
        : [];

    const selectedSettlementRows =
      activeTab === 'Settlement' && selectedWorkflowRow
        ? [selectedWorkflowRow as SettlementFormRow]
        : [];

    const selectedExpenditureRows =
      activeTab === 'Expenditure' && selectedWorkflowRow
        ? [selectedWorkflowRow as ExpenditureFormRow]
        : [];

    const payload = {
      financerequestid: resolvedFinanceRequestId,
      workflowbudgetlineid: selectedWorkflowBudgetLineId,
      sourcebudgetlineid: selectedWorkflowBudgetLineId,
      workflowbudgetproposalid: selectedWorkflowBudgetProposalId,
      workflowrequesttype: activeTab,
      row_index: rowIndexFromState,
      dashboard_row_id: dashboardRowIdFromState,
      workflowrowref:
        workflowRowRefFromState ?? 
        rowReferenceIdFromState ?? 
        dashboardRowIdFromState ??
        null,

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
      budgettag: selectedTag,
      primaryhead: primaryHead,
      eventsubhead: eventSubHead,
      isbudgetproposed: isBudgetProposed,
      proposedamount: amountProposed || null,
      balanceamount: balanceAmount || null,
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

    const result = (await authenticityUtility.postFile('/expenditure', formData)) as {
      status: string;
      message?: string;
      data?: {
        expenditureId?: unknown;
        requestRef?: unknown;
      };
    };

    if (result.status !== 'success') {
      showAlert(result.message || 'Submission failed', 'error');
      return;
    }

    const submittedAmount =
      activeTab === 'Advance'
        ? totalAdvanceAmount
        : activeTab === 'Settlement'
          ? totalSettlementAmount
          : activeTab === 'Expenditure'
            ? totalExpenditureAmount
            : 0;

    const savedRequestId = parsePositiveIntLike(result.data?.expenditureId);
    const savedRequestRef = String(result.data?.requestRef || '').trim();
    const financeIdLabel = `Finance ID: ${resolvedFinanceRequestId}`;
    const proposalRefLabel = `Proposal Ref: ${String(
      (location.state as { financeProposal?: { proposalId?: unknown } } | null)?.financeProposal?.proposalId || ''
    ).trim()}`;
    const moduleLabel = activeTab ? `${activeTab} submitted successfully.` : 'Submitted successfully.';
    const requestLabel = savedRequestRef ? `Request Ref: ${savedRequestRef}` : '';

    showAlert(
      <div style={{ lineHeight: 1.6 }}>
        <div>{moduleLabel}</div>
        <div>{financeIdLabel}</div>
        {proposalRefLabel.trim() !== 'Proposal Ref:' && <div>{proposalRefLabel}</div>}
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
            financeProposal:
              (location.state as { financeProposal?: unknown } | null)?.financeProposal ?? null,
          },
        });
      }
    );
    return;
  } catch (error) {
    console.error('Expenditure submit error:', error);
    const apiError = error as {
      response?: {
        data?: {
          message?: string;
          error?: string;
        };
      };
      message?: string;
    };
    const errorMessage =
      apiError.response?.data?.message ||
      apiError.response?.data?.error ||
      apiError.message ||
      'Something went wrong while submitting';

    showAlert(errorMessage, 'error');
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
      setBudgetRows([{ category: '', head: '', amount: '' }]);
      setAmountProposed("");
      setShowIncomeSection(false);
      setIncomeRows([createIncomeRow()]);
      setAdvanceRows([createAdvanceRow()]);
      setSettlementRows([createSettlementRow()]);
      setExpenditureSubRows([createExpenditureRow()]);
      setPayeeRows([createPayeeRow()]);
      setShowBulkNEFT(false);
      setBulkNeftFile(null);
      setUploadedPayeeBills([]);
      if (bulkNeftInputRef.current) {
        bulkNeftInputRef.current.value = '';
      }
      setPaymentDetails({
        mode: '',
        refNo: '',
        date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        debitAccount: ''
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
        }
      );
    }
  };

   // Helper functions previously here moved to top

// Tag
const [selectedTag, setSelectedTag] = useState<string>('');
const handleBeneficiarySearch = async (query: string) => {
  setBeneficiarySearchQuery(query);
  try {
    let typeParam = '';
    if (categoryType === 'Faculty') typeParam = '&type=Teaching';
    else if (categoryType === 'Staff') typeParam = '&type=Non-Teaching';
    const response = await (authenticityUtility as any).get(
      `/expenditure/search-applicant?q=${encodeURIComponent(query)}${typeParam}`
    ) as any;
    if (response.status === 'success') {
      setBeneficiarySearchResults(response.data);
      setShowBeneficiaryDropdown(true);
    }
  } catch (error) {
    setBeneficiarySearchResults([]);
    setShowBeneficiaryDropdown(false);
  }
};

const handleSelectBeneficiary = (emp: { employeeid: number; name: string; designation: string; department: string }) => {
  setCategoryItem(emp.name.trim());
  setBeneficiaryEmployeeId(emp.employeeid);
  setBeneficiarySearchQuery(emp.name.trim());
  setShowBeneficiaryDropdown(false);
};

  const BudgetHeadModal = () => {
    if (!showBudgetHeadModal || !selectedBudgetHeadForModal) return null;

    const subHeads = SUB_HEAD_BY_BUDGET_HEAD[selectedBudgetHeadForModal] || [];

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '30px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: '2px solid #0069ab',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            borderBottom: '2px solid #0069ab',
            paddingBottom: '15px',
          }}>
            <h2 style={{
              margin: 0,
              color: '#0069ab',
              fontSize: '20px',
              fontWeight: 'bold',
            }}>
              {selectedBudgetHeadForModal}
            </h2>

          </div>

          {/* SubHeads List */}
          <div style={{ marginTop: '15px' }}>
            <h3 style={{
              color: '#495057',
              fontSize: '16px',
              marginBottom: '12px',
              fontWeight: '600',
            }}>
              Sub-Heads ({subHeads.length}):
            </h3>

            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}>
              {subHeads.map((subHead, index) => (
                <li
                  key={index}
                  style={{
                    padding: '10px 12px',
                    marginBottom: '8px',
                    backgroundColor: index % 2 === 0 ? '#f8f9fa' : '#fff',
                    borderLeft: '4px solid #0069ab',
                    borderRadius: '6px',
                    color: '#333',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLLIElement).style.backgroundColor = '#e9ecef';
                    (e.currentTarget as HTMLLIElement).style.paddingLeft = '16px';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLLIElement).style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : '#fff';
                    (e.currentTarget as HTMLLIElement).style.paddingLeft = '12px';
                  }}
                >
                  {subHead}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: '20px',
            paddingTop: '15px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={() => setShowBudgetHeadModal(false)}
              style={{
                backgroundColor: '#0069ab',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#005492';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0069ab';
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };


  
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedHead, setExpandedHead] = useState<string>('');
  const [activeSubHead, setActiveSubHead] = useState<string>('');
  const SearchBudgetModal = () => {
    if (!showSearchModal) return null;
    const query = searchTerm.trim().toLowerCase();
    const allData = BUDGET_HEAD_GROUPS.flatMap((g) =>
      g.options.map((head) => ({
        head,
        subheads: SUB_HEAD_BY_BUDGET_HEAD[head] || [],
      }))
    );

    const filteredData = allData
      .filter(({ head, subheads }) => {
        if (!query) return true;
        return (
          head.toLowerCase().includes(query) ||
          subheads.some((sub) => sub.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (!query) return 0;
        const aScore = a.head.toLowerCase().includes(query) ? 0 : 1;
        const bScore = b.head.toLowerCase().includes(query) ? 0 : 1;
        return aScore - bScore;
      });
    useEffect(() => {
      if (!expandedHead) return;

      const headBlock = document.querySelector(`[data-head="${expandedHead}"]`);
      if (!headBlock) return;
      let targetSub = activeSubHead;
      if (!targetSub && query) {
        const item = filteredData.find((x) => x.head === expandedHead);
        const match = item?.subheads.find((s) => s.toLowerCase().includes(query));
        if (match) targetSub = match;
      }

      if (!targetSub) return;
      setTimeout(() => {
        const el = headBlock.querySelector(`[data-subhead="${targetSub}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }, [expandedHead, activeSubHead, query]);


    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowSearchModal(false);
        }}
       >
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            padding: "30px",
            maxWidth: "700px",
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            border: "2px solid #0069ab",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#0069ab",
                fontSize: "20px",
                fontWeight: "bold",
              }}
            >
              Search Budget Heads & Subheads
            </h2>

            <button
              onClick={() => setShowSearchModal(false)}
              style={{
                fontSize: "24px",
                cursor: "pointer",
                background: "none",
                border: "none",
              }}
            >
              ×
            </button>
          </div>

          {/* Search Bar */}
          <CustomInput
            name="searchTerm"
            type="text"
            value={searchTerm}
            onChange={(value) => {
              setSearchTerm(value);
              setActiveSubHead("");
            }}
            autoFocus={true}
            onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
            placeholder="Type head or subhead"
            onFocus={(e) => (e.currentTarget.style.borderColor = "#0069ab")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
          />

          {/* Results */}
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {filteredData.length > 0 ? (
              filteredData.map(({ head, subheads }) => {
                const isExpanded = expandedHead === head;
                const firstMatched =
                  query && subheads.find((s) => s.toLowerCase().includes(query));

                return (
                  <div
                    key={head}
                    data-head={head}
                    style={{
                      padding: "16px",
                      marginBottom: "12px",
                      borderRadius: "12px",
                      backgroundColor: "#f8f9fa",
                      borderLeft: "4px solid #0069ab",
                    }}
                  >
                    {/* Top row: head text selects+closes, caret toggles expand */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "8px",
                      }}
                    >
                      {/* Click head name => setPrimaryHead + close (no Select button) */}
                      <div
                        style={{ cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}
                        title="Click to use this Head"
                        onClick={() => {
                          setPrimaryHead(head);
                          setShowSearchModal(false);
                        }}
                      >
                        {head}
                      </div>

                      {/* Caret => expand/collapse only */}
                      <div
                        style={{ cursor: "pointer", fontSize: "14px", color: "#666" }}
                        title="Expand / collapse subheads"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedHead(isExpanded ? "" : head);
                          setActiveSubHead(""); // allow jump-to-match on expand
                        }}
                      >
                        {subheads.length} subheads {isExpanded ? "▼" : "▶"}
                      </div>
                    </div>

                    {/* Preview line */}
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      {subheads.slice(0, 3).join(", ")}
                      {subheads.length > 3 && !isExpanded && "..."}
                    </div>

                    {/* Expanded list */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: "12px",
                          maxHeight: "170px",
                          overflowY: "auto",
                          borderTop: "1px solid #e0e0e0",
                          paddingTop: "12px",
                        }}
                      >
                        {subheads.map((subhead, idx) => {
                          const isHit =
                            (!!query && subhead.toLowerCase().includes(query)) ||
                            subhead === activeSubHead ||
                            subhead === firstMatched;

                          return (
                            <div
                              key={idx}
                              data-subhead={subhead}
                              style={{
                                padding: "8px 10px",
                                marginBottom: "6px",
                                backgroundColor: isHit ? "#e3f2fd" : "white",
                                borderRadius: "6px",
                                fontSize: "13px",
                                borderLeft: isHit ? "3px solid #0069ab" : "3px solid #28a745",
                                cursor: "pointer",
                              }}
                              title="Click to jump here (no dragging)"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrimaryHead(head); // Set the main category
                                setEventSubHead(subhead); // Fill the sub-head field
                                setShowSearchModal(false); // Close the modal
                              }}
                            >
                              {subhead}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                No matches for "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  const handleAddPayee = async (payee: PayeeRow) => {
    try {
      const response = await authenticityUtility.post('/expenditure/payees', {
        payee_name: payee.payeeName,
        account_name: payee.accountName || null,
        pan_number: payee.panNumber || null,
        account_no: payee.accountNo,
        account_type: payee.accountType || null,
        bank_name: payee.bankName,
        branch_name: payee.branchName,
        ifsc: payee.ifsc,
        beneficiary_type: payee.beneficiaryType || 'individual',
        beneficiary_org: payee.beneficiaryOrg || null,
        organization_type: payee.organizationType || null,
        msme: payee.msme || null,
        gstin: payee.gstin || null,
        tds_details: payee.tdsDetails || null,
        tds_section: payee.tdsSection || null,
      }) as { status: string; message?: string; data?: PayeeLookupResult };

      if (response.status !== 'success' || !response.data) {
        showAlert(response.message || 'Unable to save payee', 'error');
        return;
      }

      const savedPayee = response.data;
      const nextPayeeRow: PayeeRow = {
        ...payee,
        payeeId: savedPayee.id ?? payee.payeeId ?? null,
        payeeName: String(savedPayee.payee_name || payee.payeeName).trim(),
        accountName: String(savedPayee.account_name || payee.accountName || '').trim(),
        panNumber: String(savedPayee.pan_number || payee.panNumber || '').trim(),
        accountNo: String(savedPayee.account_no || payee.accountNo).trim(),
        accountType: String(savedPayee.account_type || payee.accountType || '').trim(),
        bankName: String(savedPayee.bank_name || payee.bankName).trim(),
        branchName: String(savedPayee.branch_name || payee.branchName).trim(),
        ifsc: String(savedPayee.ifsc || payee.ifsc).trim().toUpperCase(),
        beneficiaryType: String(savedPayee.beneficiary_type || payee.beneficiaryType || 'individual').trim().toLowerCase() === 'organization'
          ? 'organization'
          : 'individual',
        beneficiaryOrg: String(savedPayee.beneficiary_org || payee.beneficiaryOrg || '').trim(),
        organizationType: String(savedPayee.organization_type || payee.organizationType || '').trim(),
        msme: String(savedPayee.msme || payee.msme || '').trim(),
        gstin: String(savedPayee.gstin || payee.gstin || '').trim(),
        tdsDetails: String(savedPayee.tds_details || payee.tdsDetails || '').trim(),
        tdsSection: String(savedPayee.tds_section || payee.tdsSection || '').trim(),
      };

      setPayeeRows((prev) => {
        const hasOnlyEmptyStarterRow = prev.length === 1
          && !prev[0]?.payeeName
          && !prev[0]?.accountNo
          && !prev[0]?.bankName
          && !prev[0]?.ifsc
          && !prev[0]?.branchName
          && !prev[0]?.amount
          && !prev[0]?.mode;

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

  return (
    <div
      className="expenditure-approval-body"
      style={{
        padding: '0',
        backgroundColor: '#f0f6ff',
        minHeight: '100vh',
        pointerEvents: isReadOnlyView ? 'none' : 'auto',
      }}
    >


       (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 30px' }}>
          <div className="ea-applicantCard">

            {/* Collapsible Header */}
            <div
              className="ea-cardHeader"
              onClick={() => setIsApplicantCardOpen(!isApplicantCardOpen)}
            >
              <h5>Applicant Details</h5>
              <svg
                width="12" height="8" viewBox="0 0 12 8"
                className={`ea-card-toggle-arrow ${isApplicantCardOpen ? 'open' : ''}`}
              >
                <polyline points="1.5,1.5 6,5.5 10.5,1.5" stroke="#0069ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>

            {/* Collapsed view: show only name + date */}
            {!isApplicantCardOpen && (
              <div className="ea-cardContent">
                <div className="ea-row">
                  <div className="ea-col-7">
                    <div className="ea-formGroup" style={{ marginBottom: 0 }}>
                      <label>Applicant Name</label>
                      <input type="text" value={applicantName} disabled readOnly
                        className="ea-budget-input" style={{ cursor: 'pointer' }}
                        onClick={() => setIsApplicantCardOpen(true)} />
                    </div>
                  </div>
                  <div className="ea-col-5">
                    <div className="ea-formGroup" style={{ marginBottom: 0 }}>
                      <label>Date</label>
                      <input type="date" value={date} disabled readOnly
                        className="ea-budget-input" style={{ cursor: 'pointer' }}
                        onClick={() => setIsApplicantCardOpen(true)} />
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
                pointerEvents: isReadOnlyView ? 'none' : 'auto',
              }}
            >

            <div className="row mb-3" style={{ marginBottom: '15px' }}>
              <div className="col-md-7">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                    Applicant Name <span style={{ color: 'red' }}></span>
                    {isExternalApplicant && <span style={{ fontSize: '12px', color: '#6c757d', marginLeft: '8px' }}>(External)</span>}
                  </label>
                  <CustomInput
                    name="applicantName"
                    type="text"
                    value={isExternalApplicant ? applicantName : applicantSearchQuery}
                    onChange={(value) => {
                      if (isExternalApplicant) {
                        setApplicantName(value);
                      } else {
                        handleApplicantSearch(value);
                      }
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
                    placeholder={isExternalApplicant ? "Enter external applicant name" : "Search employee by name or ERP ID"}
                  />
                  {/* Search Results Dropdown */}
                  {showApplicantDropdown && applicantSearchResults.length > 0 && (
                    <div style={{
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
                      marginTop: '4px'
                    }}>
                      {/* Add External Option */}
                      <div
                        onMouseDown={(e) => { e.preventDefault(); handleAddExternalApplicant(); }}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          backgroundColor: '#f8f9fa',
                          color: '#0069ab',
                          fontWeight: '600',
                          borderBottom: '2px solid #e0e0e0'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      >
                        + Add External Applicant
                      </div>

                      {applicantSearchResults.map((emp) => (
                        <div
                          key={emp.employee_id}
                          onMouseDown={(e) => { e.preventDefault(); handleSelectApplicant(emp); }}
                          style={{
                            padding: '10px 15px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
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
                  {showApplicantDropdown && applicantSearchQuery.length >= 2 && applicantSearchResults.length === 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                      zIndex: 1000,
                      marginTop: '4px'
                    }}>
                      <div style={{ padding: '10px 15px', color: '#6c757d' }}>No employees found</div>
                      <div
                        onMouseDown={(e) => { e.preventDefault(); handleAddExternalApplicant(); }}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          backgroundColor: '#f8f9fa',
                          color: '#0069ab',
                          fontWeight: '600',
                          borderTop: '1px solid #e0e0e0'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      >
                        + Add External Applicant
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-md-5">
                <div className="form-group">
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                    Date<span style={{ color: 'red' }}></span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #e0e0e0',
                      padding: '10px 15px',
                      fontSize: '0.95rem',
                      width: '100%',
                      fontFamily: 'inherit',
                      backgroundColor: '#fcfdff',
                      transition: 'all 0.3s ease',
                      outline: 'none'
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
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDepartment(e.target.value)}
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #e0e0e0',
                      padding: '10px 15px',
                      fontSize: '0.95rem',
                      width: '100%',
                      fontFamily: 'inherit',
                      backgroundColor: '#fcfdff',
                      transition: 'all 0.3s ease',
                      outline: 'none'
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
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDesignation(e.target.value)}
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #e0e0e0',
                      padding: '10px 15px',
                      fontSize: '0.95rem',
                      width: '100%',
                      fontFamily: 'inherit',
                      backgroundColor: '#fcfdff',
                      transition: 'all 0.3s ease',
                      outline: 'none'
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
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #e0e0e0',
                      padding: '10px 15px',
                      fontSize: '0.95rem',
                      width: '100%',
                      fontFamily: 'inherit',
                      backgroundColor: '#fcfdff',
                      transition: 'all 0.3s ease',
                      outline: 'none'
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
                    placeholder="example@email.com"
                  />
                </div>
              </div>
              <div className="col-md-5">
                <div className="form-group">
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '6px', fontWeight: '600', display: 'block' }}>Mobile <span style={{ color: 'red' }}>   </span></label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setMobile(e.target.value)}
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #e0e0e0',
                      padding: '10px 15px',
                      fontSize: '0.95rem',
                      width: '100%',
                      fontFamily: 'inherit',
                      backgroundColor: '#fcfdff',
                      transition: 'all 0.3s ease',
                      outline: 'none'
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
          <div style={{
            backgroundColor: '#fff',
            padding: '30px',
            borderRadius: '20px',
            marginBottom: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>

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
                  >

                  </label>

                  {/* REPLACE the entire beneficiary row with this: */}
                        <div className="row mb-3" style={{ alignItems: 'flex-start' }}>

                       {/* Column 1: Beneficiary Type */}
                          <div className="col-md-3">
                              <div className="form-group">
                                 <label style={{ fontSize: 14, color: '#495057', marginBottom: 8, fontWeight: 600, display: 'block' }}>
                                      Beneficiary 
                                      </label>
                                  <CustomDropdown
        name="categoryType"
        options={toOptions(CATEGORY_TYPE_OPTIONS)}
        value={getSelectedOption(categoryType, toOptions(CATEGORY_TYPE_OPTIONS))}
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
          if (next === 'Institution') setCategoryItem('K.S.Rangasamy College of Technology');
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
        <label style={{ fontSize: 14, color: '#495057', marginBottom: 8, fontWeight: 600, display: 'block' }}>
          {categoryType === 'Staff' ? 'Staff Name' : 'Faculty Name'}
        </label>
        <input
          type="text"
          value={beneficiarySearchQuery || categoryItem}
          onChange={(e) => {
            setCategoryItem(e.target.value);
            setBeneficiaryEmployeeId(null);
            setBeneficiarySearchQuery(e.target.value);
            handleBeneficiarySearch(e.target.value);
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#0069ab';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,105,171,0.15)';
            if (!showBeneficiaryDropdown) handleBeneficiarySearch(beneficiarySearchQuery);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e0e0e0';
            e.currentTarget.style.boxShadow = 'none';
            setTimeout(() => setShowBeneficiaryDropdown(false), 200);
          }}
          placeholder={categoryType === 'Staff' ? 'Search staff by name or ERP ID' : 'Search faculty by name or ERP ID'}
          style={{ borderRadius: 12, border: '1px solid #e0e0e0', padding: '10px 15px', fontSize: '0.95rem', width: '100%', backgroundColor: '#fcfdff', outline: 'none' }}
        />
        {/* Search Results Dropdown */}
        {showBeneficiaryDropdown && beneficiarySearchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1001, maxHeight: 250, overflowY: 'auto', marginTop: 4 }}>
            {beneficiarySearchResults.map((emp) => (
              <div key={emp.employeeid} onMouseDown={(e) => { e.preventDefault(); handleSelectBeneficiary(emp); }}
                style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}>
                <div style={{ fontWeight: 600, color: '#333' }}>{emp.name}</div>
                <div style={{ fontSize: 12, color: '#6c757d' }}>{emp.designation} — {emp.department}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* Institution — readonly */}
    {categoryType === 'Institution' && (
      <div className="form-group">
        <label style={{ fontSize: 14, color: '#495057', marginBottom: 8, fontWeight: 600, display: 'block' }}>Institution</label>
        <input type="text" value="K.S.Rangasamy College of Technology" readOnly
          style={{ borderRadius: 12, border: '1px solid #e0e0e0', padding: '10px 15px', fontSize: '0.95rem', width: '100%', backgroundColor: '#e9ecef', color: '#495057', cursor: 'not-allowed', outline: 'none' }} />
      </div>
    )}

    {/* Department / Centre / Cell / Club — subcategory dropdown or tag */}
    {hasSubcategories && (
      <div className="form-group">
        <label style={{ fontSize: 14, color: '#495057', marginBottom: 8, fontWeight: 600, display: 'block' }}>
          {getSubcategoryLabel(categoryType)}
        </label>
        {isMultipleSelect(categoryType) ? (
          <CustomTagInput
            name="categorySelections"
            value={categorySelections}
            onChange={(tags) => { setCategorySelections(tags); setCategoryItem(tags.join(', ')); }}
            suggestions={subcategoryList.filter((sub) => !categorySelections.includes(sub))}
            placeholder=""
            disabled={false}
            className="mb-0"
          />
        ) : (
          <CustomDropdown
            name="categoryItem"
            options={subcategoryOptions}
            value={getSelectedOption(categoryItem, subcategoryOptions)}
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
        <label style={{ fontSize: 14, color: '#495057', marginBottom: 8, fontWeight: 600, display: 'block' }}>Tag</label>
        <CustomDropdown
          name="selectedTag"
          options={tagOptions}
          value={selectedTag ? { value: selectedTag, label: selectedTag } : null}
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
              <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>Description</label>
              <textarea
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
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
                  outline: 'none'
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


          {activeTab === 'Advance' && (
            <div style={{
              backgroundColor: '#fff',
              padding: '30px',
              borderRadius: '20px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
              <h6 style={{ fontWeight: 600, color: '#0a2540', marginBottom: '24px' }}>Advance</h6>
            <div style={{ overflowX: 'visible' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                tableLayout: 'fixed'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <th style={{ width: '5%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>S.No</th>
                    <th style={{ width: '22%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Budget Head</th>
                    <th style={{ width: '22%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Sub Head</th>
                    <th style={{ width: '12%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Budget</th>
                    <th style={{ width: '12%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Pre Advance</th>
                    <th style={{ width: '12%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Advance</th>
                    <th style={{ width: '15%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {advanceRows.map((row, idx) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', color: '#495057' }}>{idx + 1}</td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                        <CustomDropdown
                          options={getApprovedBudgetHeadsForAdvance()}
                          value={getSelectedOption(row.budgetHead, getApprovedBudgetHeadsForAdvance())}
                          onChange={(option) => {
                            const val = String((option as OptionType)?.value || '');
                            handleAdvanceBudgetHeadChange(row.id, val);
                          }}
                          placeholder={isApprovedBudgetLoading ? "Loading..." : "Select Head"}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                        <CustomDropdown
                          options={getApprovedSubHeadOptionsForAdvance(row.budgetHead)}
                          value={getSelectedOption(row.subHead, getApprovedSubHeadOptionsForAdvance(row.budgetHead))}
                          onChange={async (option) => {
                            const val = String((option as OptionType)?.value || '');
                            await handleAdvanceSubHeadChange(row.id, val);
                          }}
                          placeholder="Select Sub Head"
                          isDisabled={!row.budgetHead}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                        <input
                          type="text"
                          placeholder="<Fetch>"
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
                            backgroundColor: '#f8f9fa',
                            color: '#6c757d',
                            textAlign: 'center',
                            outline: 'none',
                            cursor: 'not-allowed'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                        <input
                          type="text"
                          placeholder="₹ 0"
                          value={row.preAdvance}
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
                            backgroundColor: '#f8f9fa',
                            color: '#6c757d',
                            outline: 'none',
                            textAlign: 'center',
                            cursor: 'not-allowed'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                        <input
                          type="text"
                          placeholder="₹ 0"
                          value={row.advance}
                          onChange={(e) => {
                            const updated = advanceRows.map(r => r.id === row.id ? { ...r, advance: e.target.value } : r);
                            setAdvanceRows(updated);
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
                            textAlign: 'center'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#0069ab';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#e0e0e0';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          {advanceRows.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                removeAdvanceRow(row.id);
                              }}
                              style={deleteIconBtn}
                              title="Delete Row"
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ffd6d6')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff5f5')}
                            >
                              <X size={20} />
                            </button>
                          )}
                          {idx === advanceRows.length - 1 && (() => {
                            const isFilled = row.budgetHead && row.subHead && row.budget !== '' && row.preAdvance !== '' && row.advance !== '';
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
                                  cursor: isFilled ? 'pointer' : 'not-allowed'
                                }}
                                title="Add Row"
                                onMouseEnter={(e) => {
                                  if (isFilled) e.currentTarget.style.backgroundColor = '#e0efff';
                                }}
                                onMouseLeave={(e) => {
                                  if (isFilled) e.currentTarget.style.backgroundColor = '#f0f7ff';
                                }}
                              >
                                <Plus size={16} />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <td colSpan={5} style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'right', paddingRight: '15px', fontWeight: '600', color: '#0069ab' }}>
                      Total Advance
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e0e0e0', fontWeight: '600', color: '#0069ab', textAlign: 'center' }}>
                      &#8377; {totalAdvanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ border: '1px solid #e0e0e0' }}></td>
                  </tr>
                </tfoot>
              </table>

              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  backgroundColor: "#f0f6ff",
                  border: "1px solid #cfe2ff",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.9rem",
                  color: "#0b3d75",
                  textAlign: "center",
                  width: "100%",
                }}
              >
                <span style={{ fontWeight: 600 }}>Rupees (in words):</span>
                <span style={{ fontWeight: 600 }}>{numberToIndianWords(totalAdvanceAmount)}</span>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'Settlement' && (
            <div style={{
              backgroundColor: '#fff',
              padding: '30px',
              borderRadius: '20px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
              <h6 style={{ fontWeight: 600, color: '#0a2540', marginBottom: '24px' }}>Settlement</h6>
            <div style={{ overflowX: 'visible' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                tableLayout: 'fixed'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <th style={{ width: '8%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>S.No</th>
                    <th style={{ width: '25%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Budget Head</th>
                    <th style={{ width: '25%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Sub Head</th>
                    <th style={{ width: '14%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Budget</th>
                    <th style={{ width: '13%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Settlement</th>
                    <th style={{ width: '15%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementRows.map((row, idx) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', color: '#495057' }}>{idx + 1}</td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                        <CustomDropdown
                          options={getApprovedBudgetHeadsForAdvance()}
                          value={getSelectedOption(row.budgetHead, getApprovedBudgetHeadsForAdvance())}
                          onChange={(option) => {
                            const val = String((option as OptionType)?.value || '');
                            handleSettlementBudgetHeadChange(row.id, val);
                          }}
                          placeholder={isApprovedBudgetLoading ? "Loading..." : "Select Head"}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                        <CustomDropdown
                          options={getApprovedSubHeadOptionsForAdvance(row.budgetHead)}
                          value={getSelectedOption(row.subHead, getApprovedSubHeadOptionsForAdvance(row.budgetHead))}
                          onChange={(option) => {
                            const val = String((option as OptionType)?.value || '');
                            handleSettlementSubHeadChange(row.id, val);
                          }}
                          placeholder="Select Sub Head"
                          isDisabled={!row.budgetHead}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                        <input
                          type="text"
                          placeholder="<Fetch>"
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
                            backgroundColor: '#f8f9fa',
                            color: '#6c757d',
                            textAlign: 'center',
                            outline: 'none',
                            cursor: 'not-allowed'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                        <input
                          type="text"
                          placeholder="₹ 0"
                          value={row.settlement}
                          onChange={(e) => {
  const value = e.target.value;
  if (!/^\d*\.?\d*$/.test(value)) return;

  const updated = settlementRows.map((r) =>
    r.id === row.id ? { ...r, settlement: value } : r
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
                            textAlign: 'center'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#0069ab';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#e0e0e0';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          {settlementRows.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                removeSettlementRow(row.id);
                              }}
                              style={deleteIconBtn}
                              title="Delete Row"
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ffd6d6')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff5f5')}
                            >
                              <X size={20} />
                            </button>
                          )}
                          {idx === settlementRows.length - 1 && (() => {
                            const isFilled = row.budgetHead && row.subHead && row.settlement !== '';
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
                                  cursor: isFilled ? 'pointer' : 'not-allowed'
                                }}
                                title="Add Row"
                                onMouseEnter={(e) => {
                                  if (isFilled) e.currentTarget.style.backgroundColor = '#e0efff';
                                }}
                                onMouseLeave={(e) => {
                                  if (isFilled) e.currentTarget.style.backgroundColor = '#f0f7ff';
                                }}
                              >
                                <Plus size={16} />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
  <tr style={{ backgroundColor: "#f0f6ff" }}>
    <td
      colSpan={4}
      style={{
        padding: "12px",
        border: "1px solid #e0e0e0",
        textAlign: "right",
        paddingRight: "15px",
        fontWeight: 600,
        color: "#0069ab",
      }}
    >
      Total Settlement
    </td>
    <td
      style={{
        padding: "12px",
        border: "1px solid #e0e0e0",
        fontWeight: 600,
        color: "#0069ab",
        textAlign: "center",
      }}
    >
      ₹ {totalSettlementAmount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </td>
    <td style={{ border: "1px solid #e0e0e0" }}></td>
  </tr>
</tfoot>
              </table>

              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  backgroundColor: "#f0f6ff",
                  border: "1px solid #cfe2ff",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.9rem",
                  color: "#0b3d75",
                  textAlign: "center",
                  width: "100%",
                }}
               >
                <span style={{ fontWeight: 600 }}>Rupees (in words):</span>
                <span style={{ fontWeight: 600 }}>{numberToIndianWords(totalAdvanceAmount)}</span>
              </div>
            </div>
          </div>
          )}
              {activeTab === 'Expenditure' && (
  <div style={{
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
  }}>
    <h6 style={{ fontWeight: 600, color: '#0a2540', marginBottom: '24px' }}>Expenditure</h6>
    <div style={{ overflowX: 'visible' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        tableLayout: 'fixed'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f6ff' }}>
            <th style={{ width: '5%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>S.No</th>
            <th style={{ width: '28%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Budget Head</th>
            <th style={{ width: '28%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Sub Head</th>
            <th style={{ width: '12%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Budget</th>
            <th style={{ width: '8%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {expenditureSubRows.map((row, idx) => (
            <React.Fragment key={row.id}>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', borderBottom: 'none', textAlign: 'center', verticalAlign: 'middle', color: '#495057' }}>
                  {idx + 1}
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                  <CustomDropdown
                    options={getApprovedBudgetHeadsForAdvance()}
                    value={getSelectedOption(row.budgetHead, getApprovedBudgetHeadsForAdvance())}
                    onChange={(option) => {
                      const val = String((option as OptionType)?.value || '');
                      handleExpenditureBudgetHeadChange(row.id, val);
                    }}
                    placeholder={isApprovedBudgetLoading ? "Loading..." : "Select Head"}
                  />
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                  <CustomDropdown
                    options={getApprovedSubHeadOptionsForAdvance(row.budgetHead)}
                    value={getSelectedOption(row.subHead, getApprovedSubHeadOptionsForAdvance(row.budgetHead))}
                    onChange={(option) => {
                      const val = String((option as OptionType)?.value || '');
                      handleExpenditureSubHeadChange(row.id, val);
                    }}
                    placeholder="Select Sub Head"
                    isDisabled={!row.budgetHead}
                  />
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', verticalAlign: 'middle', textAlign: 'center' }}>
                  <input
                    type="text"
                    placeholder="<Fetch>"
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
                      cursor: 'not-allowed'
                    }}
                  />
                </td>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle' }} rowSpan={2}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
                    {expenditureSubRows.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          removeExpenditureRow(row.id);
                        }}
                        title="Delete Row"
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          border: 'none',
                          background: '#fff5f5',
                          color: '#ff4d4f',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={20} />
                      </button>
                    )}
                    <button
                      disabled={!row.budgetHead || !row.subHead || !row.expenditure}
                      onClick={(e) => {
                        e.preventDefault();
                        addExpenditureRow();
                      }}
                      title={(!row.budgetHead || !row.subHead || !row.expenditure) ? "Please fill all fields to add a new row" : "Add Row"}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        border: 'none',
                        background: '#eaf2ff',
                        color: '#0069ab',
                        cursor: (!row.budgetHead || !row.subHead || !row.expenditure) ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: (!row.budgetHead || !row.subHead || !row.expenditure) ? 0.5 : 1
                      }}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #e0e0e0', borderTop: 'none', borderBottom: '1px solid #e0e0e0', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fff' }}>
                  {/* Empty cell under S.No */}
                </td>
                <td colSpan={3} style={{ padding: '12px', border: '1px solid #e0e0e0', borderTop: 'none', borderBottom: '1px solid #e0e0e0', verticalAlign: 'middle', backgroundColor: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: '500', color: '#495057', minWidth: '80px' }}>Expenditure</span>
                    <input
                      type="text"
                      placeholder="Enter amount"
                      value={row.expenditure}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!/^[0-9+.]*$/.test(val)) return;
                        const sum = calculateSum(val);
                        const updated = expenditureSubRows.map(r => r.id === row.id ? { ...r, expenditure: val, autoSum: sum } : r);
                        setExpenditureSubRows(updated);
                      }}
                      style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px',
                        padding: '10px 15px',
                        fontSize: '0.95rem',
                        flex: 1,
                        height: '45px',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        backgroundColor: '#fff',
                        color: '#000',
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
                        width: '120px',
                        height: '45px',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        backgroundColor: '#fff',
                        color: '#6c757d',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: 'not-allowed'
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
            <td colSpan={4} style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'right', paddingRight: '15px', fontWeight: '600', color: '#0069ab' }}>
              Total Expenditure
            </td>
            <td style={{ padding: '12px', border: '1px solid #e0e0e0', fontWeight: '600', color: '#0069ab', textAlign: 'center' }}>
              ₹ {expenditureSubRows.reduce((sum, r) => sum + (parseFloat(r.autoSum) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>

      <div
        style={{
          marginTop: "10px",
          padding: "10px 14px",
          borderRadius: "10px",
          backgroundColor: "#f0f6ff",
          border: "1px solid #cfe2ff",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.9rem",
          color: "#0b3d75",
          textAlign: "center",
          width: "100%",
        }}
      >
        <span style={{ fontWeight: 600 }}>Rupees (in words):</span>
        <span style={{ fontWeight: 600 }}>{numberToIndianWords(expenditureSubRows.reduce((sum, r) => sum + (parseFloat(r.autoSum) || 0), 0))}</span>
      </div>
    </div>
  </div>
)}

          {/* Payee Details Section */}
          <div style={{ marginTop: '20px' }}>
            {renderPayeeDetails()}
          </div>

          {/* Payment Status Section - Separate Card */}
       {!showBulkNEFT && (
  <div className="payee-details-card" style={{ marginTop: '20px' }}>
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
          value={getSelectedOption(paymentDetails.status, toOptions(PAYMENT_STATUS_OPTIONS))}
          onChange={(opt) =>
            setPaymentDetails({ ...paymentDetails, status: String((opt as OptionType)?.value || '') })
          }
          placeholder="Status"
        />
      </div>

      {/* 2. Date Picker */}
      <div className="payee-status-col payee-status-col-date">
        <input
          type="date"
          className="payee-field"
          value={paymentDetails.date}
          onChange={(e) => setPaymentDetails({ ...paymentDetails, date: e.target.value })}
          style={{ width: '100%' }}
        />
      </div>

      {/* 3. Bills Uploaded Button */}
      <div className="payee-status-col payee-status-col-bills">
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
            <span className="payee-upload-label-text">Bills </span>
            <Upload size={16} />
          </span>
          <input
            type="file"
            className="payee-upload-input"
            multiple
            onChange={handlePayeeBillUpload}
          />
        </label>
        {uploadedPayeeBills.length > 0 && (
          <div style={{ fontSize: '11px', color: '#2c7a4d', marginTop: '4px', textAlign: 'center' }}>
            {uploadedPayeeBills.length} file(s)
          </div>
        )}
      </div>

      {/* 4. Comments Input */}
      <div className="payee-status-col payee-status-col-comments">
        <div className="payee-comments-group">
          <input
            type="text"
            className="payee-field payee-status-comment-input"
            placeholder=""
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            style={{ width: '100%' }}
          />
          <button
            type="button"
            onClick={() => console.log('Tick clicked, remarks:', remarks)}
            className="payee-comment-tick-btn"
            aria-label="Confirm comment"
          >
            <CheckCircle2 size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>

    </div>
  </div>
)}
          {/* Submit Button Section */}
          {!isReadOnlyView && (
            <div className="expenditure-submit-buttons">
              <button
                className="btn-submit"
                onClick={(e) => { e.preventDefault(); handleSubmit(); }}
              >
                Submit
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

          <AddPayeeModal
            show={showAddPayeeModal}
            onClose={() => setShowAddPayeeModal(false)}
            onAddPayee={handleAddPayee}
            showAlert={showAlert}
          />
        </div>
        )
     
         
          <div style={{
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
          }}>
          </div>
        
    

     </div>
    
  );
};

export default ExpenditureApproval;

