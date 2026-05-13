import React, { useState, useRef, CSSProperties, useEffect, useMemo, ChangeEvent, MouseEvent } from 'react';
import { Info, Library, CheckCircle2, RotateCcw, XCircle, Archive, Upload, Eye, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import './financeapproval.css';
import KSRCTLogo from '../../shared/assets/images/ksrct_logo.png';

import authenticityUtility from '../../shared/utils/authenticityUtility';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
import CustomInput from '../../shared/components/ui/CustomInput';
import CustomDropdown, { OptionType } from '../../shared/components/ui/CustomDropdown';
import CustomToggle from '../../shared/components/ui/CustomToggle';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import CustomModal from '../../shared/components/ui/CustomModal';
import {
  formatDMY,
  numberToIndianWords,
  formatWorkflowTimestamp,
  getCurrentWorkflowTimestamp,
  getWorkflowTimeline,
  formatWorkflowPersonText,
  getSubmittedTimestamp,
  getAnnexureOpenUrl,
  generateAndDownloadFinancePdf,
} from './financeApprovalPdf';

interface SelectOption {
  value: string;
  label: string;
}

const FINANCE_CONFLICT_MESSAGE =
  'Finance request conflicts with approved budget allocation. Please check the budget head amounts and available balance.';

const normalizeErrorMessage = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

const isGenericConflictMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes('page was not displayed') && normalized.includes('conflict');
};

const resolveTagValue = (value: unknown, options: SelectOption[]) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';

  const matched = options.find(
    (option) => String(option.value ?? '').trim().toLowerCase() === normalized.toLowerCase(),
  );

  return matched?.value || normalized;
};

const getFinanceSubmitErrorMessage = (error: unknown): string => {
  const candidate = error as {
    response?: {
      data?: unknown;
      status?: number;
    };
    message?: string;
  };
  const responseData = candidate.response?.data;
  const statusCode = candidate.response?.status;

  if (typeof responseData === 'string') {
    const message = normalizeErrorMessage(responseData);
    if (message) return isGenericConflictMessage(message) ? FINANCE_CONFLICT_MESSAGE : message;
  }

  if (responseData && typeof responseData === 'object') {
    const data = responseData as { message?: unknown; error?: unknown };
    const message = normalizeErrorMessage(data.message);
    if (message) return isGenericConflictMessage(message) ? FINANCE_CONFLICT_MESSAGE : message;

    const errorMessage = normalizeErrorMessage(data.error);
    if (errorMessage) return isGenericConflictMessage(errorMessage) ? FINANCE_CONFLICT_MESSAGE : errorMessage;
  }

  const fallbackMessage = normalizeErrorMessage(candidate.message);
  if (fallbackMessage) {
    return isGenericConflictMessage(fallbackMessage) ? FINANCE_CONFLICT_MESSAGE : fallbackMessage;
  }

  if (statusCode === 409) {
    return FINANCE_CONFLICT_MESSAGE;
  }

  return 'Something went wrong while submitting';
};

interface BudgetRow {
  category: string;
  head: string;
  amount: string;
}

interface BudgetLineMeta {
  budgetLineId: number | null;
  budgetProposalId: number | null;
  availableAmount: number;
}

interface IncomeRow {
  id: string;
  incomeSource: string;
  contribution: string;
  amount: string;
  status: string;
  remarks: string;
  creditAccount: string;
}

interface BudgetHeadGroup {
  label: string;
  options: string[];
}

interface BudgetHeadSearchOption extends OptionType {
  budgetHead: string;
  subHead: string;
  optionType: 'budget-head' | 'head-sub-head';
}

interface AnnexureFileRow {
  id: string;
  annexureType: string;
  file: File | null;
  previewUrl: string;
  originalName: string;
  storedName: string;
  filePath: string;
  mimeType: string;
  size: number | null;
}

// Beneficiary Type to Entity API Type Mapping
const BENEFICIARY_TYPE_TO_ENTITY_API_TYPE: Record<string, string> = {
  Department: 'DEPARTMENT',
  Centre: 'CENTRE',
  Cell: 'CELL',
  Club: 'CLUB',
  Section: 'SECTION',
  'Professional Body': 'PROFESSIONAL_BODY',
};

// Fallback options for when API fails
const FALLBACK_SUBCATEGORY_OPTIONS: Record<string, string[]> = {
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

// Fallback tag options
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
      'Library',
    ],
  },
  { label: 'Recurring', options: [] },
  {
    label: 'Maintenance & Spares',
    options: ['Maintenance Charges', 'Spares'],
  },
  {
    label: 'Operational',
    options: [
      'Consumables',
      'Software',
      'Membership & Subscriptions',
      'College Essentials',
      'Printing',
      'Stationery',
      'Postal Expenses',
      'Local Conveyance',
      'Operational Expenses',
      'Official Visits',
    ],
  },
  {
    label: 'Events & Competitions',
    options: ['Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves', 'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions'],
  },
  {
    label: 'Meetings & Audits',
    options: [
      'Institutional Governance Meetings',
      'Academic Governance Meetings',
      'Institutional Audits',
      'Government Meetings',
    ],
  },
  {
    label: 'Academics',
    options: [
      'Faculty Empowerment',
      'Staff Empowerment',
      'Student Empowerment',
      'Student Capacity Building',
      'Ranking & Accreditation',
      'Examination Expenses',
    ],
  },
  {
    label: 'Branding & Outreach',
    options: ['Advertisement & Branding', 'Public Relations', 'Admissions'],
  },
  {
    label: 'General',
    options: [
      'Research & Development',
      'Government Funded Projects',
      'Government Funded Events',
      'Administrative Expenses',
      'Licenses & Taxes',
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

const ANNEXURE_TYPE_OPTIONS = [
  'Proforma Invoice',
  'Invoice',
  'Quotation',
  'Bills',
  'Pamphlet',
  'Email',
  'Not Applicable',
  'Others',
];
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

// 1. Shared HOAC Sub-Heads (for Events & Competitions, Meetings & Audits)
// Used in the 'extra' top-level dropdown (eventSubHead) when a HOAC group is active.
const HOAC_SUBHEAD_OPTIONS: Record<string, string[]> = {
  'Events & Competitions': [
    'A/V Arrangements',
    'Accessories',
    'Accommodation',
    'Auditing Charge',
    'Bag',
    'Consumables',
    'Decorations',
    'Driver Bata',
    'Event Logistics',
    'Food & Refreshment',
    'Honorarium',
    'Memento & Gifts',
    'Miscellaneous',
    'Printing',
    'Prizes',
    'Promotions',
    'Publication Charges',
    'Registration fee',
    'Registration Kit',
    'Remuneration',
    'Sitting Fees',
    'Stationery',
    'T-Shirt',
    'Travel',
    'Others',
  ],
  'Meetings & Audits': [
    'Accessories',
    'Accommodation',
    'Auditing Charge',
    'Driver Bata',
    'Food & Refreshment',
    'Honorarium',
    'Memento & Gifts',
    'Miscellaneous',
    'Printing',
    'Registration fee',
    'Remuneration',
    'Sitting Fees',
    'Stationery',
    'Travel',
    'Others',
  ],
};

const HOAC_GROUPS = new Set(['Events & Competitions', 'Meetings & Audits']);

const flattenOptions = (options: Array<OptionType | { label: string; options: OptionType[] }>): OptionType[] =>
  options.flatMap((opt) => ('options' in opt ? opt.options : opt));

const getSelectedOption = (
  value: string,
  options: Array<OptionType | { label: string; options: OptionType[] }>
): OptionType | null =>
  flattenOptions(options).find((opt) => String(opt.value) === String(value)) ?? null;

const PRIMARY_HEAD_OPTIONS: Array<{ label: string; options: OptionType[] }> =
  BUDGET_HEAD_GROUPS.map((group) => ({
    label: group.label,
    options: toOptions(group.options),
  }));

const HEAD_TO_GROUP: Record<string, string> = BUDGET_HEAD_GROUPS.reduce(
  (acc, group) => {
    group.options.forEach((option) => {
      acc[option] = group.label;
    });
    return acc;
  },
  {} as Record<string, string>
);

const getHoacGroupForHead = (head: string): string | undefined => {
  if (HOAC_GROUPS.has(head)) return head;
  const mapped = HEAD_TO_GROUP[head];
  if (mapped && HOAC_GROUPS.has(mapped)) return mapped;
  return undefined;
};

const shouldUseHeadOnlyAvailabilityMatch = (budgetHead: string, _subHead: string): boolean => {
  const normalizedHead = String(budgetHead || '').trim();
  return Boolean(normalizedHead);
};

const SUB_HEAD_CHILD_OPTIONS: Record<string, string[]> = {
  FDP: ['AICTE Sponsored', 'Naan Mudhalvan', 'Industry', 'International'],
  Workshop: ['Hands-on', 'Skill Development'],
  Seminar: ['National', 'International'],
  Conference: ['National', 'International'],
  'Guest Lecture': ['Industry', 'Academic'],
};

// 2. Specific Budget Sub-Heads (Head-specific mapping)
// Used in the row-level budget table (subHead-${index}) to pick specific expenses for a head.
const SUB_HEAD_BY_BUDGET_HEAD: Record<string, string[]> = {
  'Civil Infrastructure': [
    'Canopy',
    'Construction Works',
    'False Ceiling Works',
    'Partition Works',
    'Plumbing Works',
    'Water Cooler'
  ],
  'Electrical Infrastructure': [
    'Air Conditioner',
    'Battery',
    'Electrical Wiring',
    'Generator',
    'Lights & Fans',
    'Lift Installation',
    'UPS & Inverter'
  ],
  'IT Infrastructure': [
    'A/V Equipment',
    'Amplifiers',
    'CCTV Materials',
    'CMOS Battery',
    'Desktops Computers',
    'Hard Disks',
    'Hardwares',
    'Interactive Displays',
    'Intercom',
    'Keyboard',
    'Laptops',
    'Mic & Speakers',
    'Mobiles & Tablet',
    'Monitors',
    'Mouse',
    'Network Materials',
    'Printers',
    'Projectors',
    'Softwares',
    'Television',
    'Wi-fi Router',
    'Xerox Machine'
  ],
  'Furniture & Fixtures': [
    'Chair',
    'Computer Table',
    'Discussion Table',
    'Faculty Table',
    'Wooden Cup Boards',
    'Work Table'
  ],
  Vehicles: ['Heavy Motor Vehicle', 'Light Motor Vehicle', 'Two Wheeler'],
  Equipment: [
    'Consultancy Equipment',
    'Equipment Upgrade',
    'Lab Equipment',
    'Office Equipment',
    'Research Equipment',
    'Sports Equipment'
  ],
  'Accessories & Kits': [
    'Drilling Machine',
    'Drone Kit',
    'Lab Accessories',
    'Power Tools',
    'Weighing Machine',
    'Others'
  ],
  'Library': [
    'Books',
    'Databases',
    'E-Books',
    'E-Journals',
    'Journals',
    'Magazines',
    'Membership',
    'Newspapers',
    'Non Books (CD etc.)',
    'Plagiarism Detection Tool',
    'Remote Access Tool'
  ],

  'Maintenance Charges': [
    'AC Maintenance',
    'Annual Maintenance Charges',
    'Building Maintenance',
    'Computer Maintenance',
    'Electrical Maintenance',
    'Equipment Maintenance',
    'Farm Maintenance',
    'Furniture Maintenance',
    'Garden Maintenance',
    'General Repairs',
    'Housekeeping Expenses',
    'Infrastructure Maintenance',
    'Lift Maintenance',
    'Office Maintenance',
    'Painting',
    'Playground Maintenance',
    'Plumbing Maintenance',
    'Printer Maintenance',
    'Software Maintenance',
    'UPS Maintenance',
    'Vehicle Maintenance',
    'Toner Refill'
  ],
  Spares: ['Chargers', 'Printer Toner', 'SMPS'],
  'Annual Maintenance Charges': ['Equipment Maintenance', 'Software Maintenance'],
  Consumables: [
    'Carpentary Items',
    'Chemicals',
    'Construction Materials',
    'Cutting Tools',
    'Electrical Components',
    'Electronic Components',
    'Glasswares',
    'Mechanical Components',
    'Metals & Alloys',
    'Oils & Lubricants',
    'Plasticwares',
    'Others'
  ],
  Software: [
    'AI Tools',
    'Analysis',
    'Antivirus',
    'Firewall',
    'Graphical Design',
    'Grammer Check',
    'Grievance',
    'Modelling',
    'Plagiarism',
    'Programming',
    'Others'
  ],
  'Membership & Subscriptions': [
    'Annual Subscription Charges',
    'Data Subscription Charges',
    'E-Resources',
    'Membership fees',
    'Professional Body fees'
  ],
  'College Essentials': ['Books', 'Note Books', 'Log Books', 'ID Card', 'Student Uniform', 'Others'],

  'Printing': [
    'Badge',
    'Banner',
    'Beach Flag',
    'Binding',
    'Brochure',
    'Calendar',
    'Certificates',
    'Combined Items',
    'Diary',
    'ID Card',
    'Letter Pad',
    'Magazines',
    'News Letters',
    'Note Pad',
    'Official Documents',
    'Pamphlet',
    'Registers',
    'Reports',
    'Sign Board',
    'Vinyl Board',
    'Visiting Card',
    'Wiro Pad',
    'Others'
  ],

  'Stationery': [
    'Adhesive Gum',
    'Adhesive Tape',
    'Answer Booklet',
    'Chalk Box',
    'Clips/ Pins',
    'Cloth Covers',
    'Combined Items',
    'Duster',
    'Files/ Folders',
    'Grade Sheet',
    'Highlighter',
    'Marker Pen',
    'Office Covers',
    'Pen/ Pencil/ Eraser',
    'Plastic Tray',
    'Print Sheets',
    'Rubber Band',
    'Rubber Stamp',
    'Scissor/ Knife',
    'Stamp Pad/ Ink',
    'Stapler/ Punching Machine',
    'Sticky Notes',
    'Others'
  ],

  'Postal Expenses': [
    'Courier Charges',
    'Frieght Charges',
    'Postal Charges',
    'Others'
  ],
  'Local Conveyance': [
    'Beta',
    'Food & Refreshment',
    'Travel Expense',
    'Others'
  ],
  'Operational Expenses': [
    'Water Bottle',
    'Food & Refreshment',
    'Pooja Expenses',
    'Accessories',
    'Legal stamp paper',
    'Miscellaneous'
  ],
  'Conferences & Conclaves': [
    'Conclave',
    'Consumables',
    'Convention',
    'Industry Interaction',
    'International Conference',
    'National Conference',
    'Networking Event'
  ],
  'Association Activities': [
    'Alumni Interaction',
    'Alumni Meeting',
    'Association Function',
    'Parents Meeting'
  ],
  'Outreach Events': [
    'Awareness Program',
    'Campaigns',
    'Crash Course',
    'Education Fair',
    'Mini Marathon',
    'Rally',
    'School Visit',
    'Summer Internship',
    'Grama Saba Meet',
    'Orientation Session'
  ],
  'Cultural & Celebrations': [
    'Celebration Day',
    'Festival Celebrations',
    'Harmonicks',
    'Hostel Day'
  ],
  'Sports': ['Sports Day', 'Sports Meet'],

  'Club Activities': [
    'Flash Mob',
    'Fun Events',
    'Road show',
    'Wall Painting'
  ],
  'Competitions': [
    'Innovation & Startup Competitions',
    'Academic Competitions',
    'Technical Competitions',
    'Cultural Competitions',
    'Creative Competitions',
    'Literary Competitions',
    'Sports Competitions',
    'Management Competitions',
    'Online Competitions',
    'General Competitions',
    'Project Exhibition',
    'Science Exhibition'
  ],

  'Institutional Governance Meetings': [
    'Examination Committee Meeting',
    'Finance Committee Meeting',
    'Governing Body Meeting',
    'Placement Meeting',
    'Research Advisory Board Meeting',
    'Result Passing Board (RPB) Meeting'
  ],

  'Academic Governance Meetings': [
    'Academic Council Meeting',
    'Board of Studies (Bos) Meeting',
    'DAB Meeting',
    'Standing Committee Meeting'
  ],
  'Institutional Audits': ['Academic Audit', 'Administrative Audit', 'Energy & Green Audit'],
  'Government Meetings': ['Government Meetings'],
  'Faculty Empowerment': [
    'Accommodation',
    'Daily Allowance',
    'Faculty Welfare',
    'Food & Refreshment',
    'Incentives',
    'Leadership Meet',
    'Medical Expenses',
    'Membership Fees',
    'Registration fee',
    'Travel Allowance'
  ],

  'Academic Events': [
    'Expert Visit',
    'FDP (Faculty Development Programme)',
    'Guest Lecture',
    'Hands-on Training',
    'Industry Visit',
    'MoU Inking',
    'Seminar',
    'STTP (Short-Term Training Programme)',
    'Webinar',
    'Workshop'
  ],

  'College Events': [
    'Annual Day',
    'Dakshaa',
    'Founder Day',
    'Graduation Day',
    'Orientation Session',
    'Science Day',
    'Student Induction Programme',
    'Womens Day'
  ],
  'Staff Empowerment': [
    'Accommodation',
    'Daily Allowance',
    'Food & Refreshment',
    'Incentives',
    'Staff Welfare',
    'Medical Expenses'
  ],

  'Student Empowerment': [
    'Accommodation',
    'Certification Costs',
    'Food & Refreshment',
    'Incentives',
    'Medical Expense',
    'Prizes',
    'Registration fee',
    'Student Welfare',
    'Travel Support'
  ],
  'Student Capacity Building': [
    'ApptitudeTraining',
    'Certification Programs',
    'Competitive Exam Coaching',
    'Exposure Visit',
    'Higher Education Coaching',
    'Internship',
    'International Connect',
    'Language Proficiency Courses',
    'One Credit Course',
    'Placement Drives',
    'Placement Training',
    'Skill Development Training',
    'Value Added Course',
    'Others'
  ],

  'Ranking & Accreditation': [
    'NAAC Fees',
    'NAAC Inspection',
    'NBA Fees',
    'NBA Inspection',
    'QS Ranking',
    'SDG Ranking',
    'Other Rankings'
  ],
  'Examination Expenses': [
    'Autonomous Exam Remuneration',
    'Government Exam Remuneration',
    'Online Exam Remuneration',
    'QP Setting Expenses',
    'Degree Recommendation',
    'CoE Staff Remuneration'
  ],

  'Advertisement & Branding': ['Digital Promotion', 'News Paper Advertisement'],
  'Public Relations': [
    'Branding',
    'Corporate Gift',
    'CSR Activity',
    'Press & Media',
    'Promotions',
    'Sponsorship'
  ],
  'Admissions': [
    'Consultant Charges',
    'Field Visits',
    'School Visits',
    'Stalls',
    'Student Directory'
  ],
  'Research & Development': [
    'Consultancy',
    'HI Contribution',
    'Institute Research Fellowship',
    'Publication Support',
    'Research Cenre Renewal',
    'Research Grant',
    'Seed Fund (Consumables)',
    'Seed Fund (IPR Charges)',
    'Seed Fund (Product Development)',
    'Seed Fund (Testing)',
    'Seed Fund (Travel)'
  ],
  'Government Funded Projects': [
    'Manpower',
    'Equipment',
    'Consumables',
    'IT Infrastructure',
    'Travel',
    'Printing',
    'Stationery',
    'Miscellaneous',
    'Overhead Expenses',
    'Food & Refreshment',
    'Incidental Expenses',
    'Administrative Expenses',
    'Accommodation',
    'Honorarium',
    'Accessories & Peripherals',
    'Memento & Gifts',
    'Publicity & Promotion',
    'Software & Licenses'
  ],
  'Government Funded Events': [
    'A/V Arrangements',
    'Accessories',
    'Accommodation',
    'Auditing Charge',
    'Bag',
    'Consumables',
    'Decorations',
    'Driver Bata',
    'Event Logistics',
    'Food & Refreshment',
    'Honorarium',
    'Memento & Gifts',
    'Miscellaneous',
    'Printing',
    'Prizes',
    'Promotions',
    'Publication Charges',
    'Registration fee',
    'Registration Kit',
    'Remuneration',
    'Sitting Fees',
    'Stationery',
    'T-shirt',
    'Travel'
  ],
  'Administrative Expenses': [
    'Affiliation Fees',
    'AICTE Fees',
    'Anna University Fees',
    'Audit Fees',
    'Autonomous Charges',
    'Consortium Fees',
    'DOTE Fees',
    'Fee Fixation Expenses',
    'Flag Day Expenses',
    'Inspection Expenses',
    'Insurance Charges',
    'International Travel',
    'Legal Expenses',
    'Office Expenses',
    'Scholarship Expenses',
    'Stamp Charges',
    'Testing Charges',
    'Awards & Recognitions'
  ],
  'Licenses & Taxes': [
    'Building Tax',
    'DTCP Approval',
    'License Renewal',
    'Property Tax',
    'Road Tax',
    'Spirit License',
    'Water Tax'
  ],

  'Salary': [
    'Allowances',
    'Emoluments',
    'ESI Scheme',
    'Monthly Salary',
    'Professional Payments',
    'Provident Fund',
    'Wages'
  ],
  'Bills & Payments': [
    'Diesel Expenses',
    'Electricity Charges',
    'Internet Charges',
    'Telephone Charges'
  ],
  'Miscellaneous Expenses': [
    'Bank Charges',
    'Bank Interest',
    'Fire Extinguisher',
    'First Aid Kit Expenses',
    'General Expenses',
    'Irrecovable Fee',
    'Laundry Service',
    'Legal Expenses',
    'Loan Processing Charges',
    'RO  Mineral Water',
    'Sewage Treatment',
    'Others'
  ],
  'Official Visits': [
    'Registration fees',
    'Travel',
    'Accommodation',
    'Food & Refreshment',
    'Local Conveyance',
    'Printing & Stationery',
    'Miscellaneous'
  ],
};
const getSubHeadOptionsForHeadSearch = (budgetHead: string): string[] => {
  const hoacGroup = getHoacGroupForHead(budgetHead);
  if (hoacGroup && HOAC_SUBHEAD_OPTIONS[hoacGroup]) {
    return HOAC_SUBHEAD_OPTIONS[hoacGroup];
  }
  return SUB_HEAD_BY_BUDGET_HEAD[budgetHead] ?? [];
};

const normalizeSubHeadForDb = (subHeadValue: string): string => {
  const raw = String(subHeadValue || '').trim();
  if (!raw) return '';
  return raw.includes('::') ? raw.split('::')[0].trim() : raw;
};

const getSubHeadDisplayText = (subHeadValue: string): string => {
  const raw = String(subHeadValue || '').trim();
  if (!raw) return '';
  if (!raw.includes('::')) return raw;
  const [parent, child] = raw.split('::');
  return child ? `${parent} - ${child}` : parent;
};

const getSubHeadDropdownOptions = (budgetHead: string): OptionType[] => {
  const base = getSubHeadOptionsForHeadSearch(budgetHead);
  const options: OptionType[] = [];
  base.forEach((item) => {
    options.push({ value: item, label: item });
    const childOptions = SUB_HEAD_CHILD_OPTIONS[item] || [];
    childOptions.forEach((child) => {
      options.push({
        value: `${item}::${child}`,
        label: `${item} - ${child}`,
      });
    });
  });
  return options;
};

const BUDGET_HEAD_SEARCH_OPTIONS: Array<{ label: string; options: BudgetHeadSearchOption[] }> =
  BUDGET_HEAD_GROUPS.map((group) => ({
    label: group.label,
    options: group.options.flatMap((head) => {
      const subHeads = getSubHeadOptionsForHeadSearch(head);
      const headOption: BudgetHeadSearchOption = {
        value: `head::${head}`,
        label: head,
        budgetHead: head,
        subHead: '',
        optionType: 'budget-head',
      };
      const subHeadOptions: BudgetHeadSearchOption[] = subHeads.map((subHead) => ({
        value: `sub::${head}::${subHead}`,
        label: `${subHead} (${head})`,
        budgetHead: head,
        subHead,
        optionType: 'head-sub-head',
      }));
      return [headOption, ...subHeadOptions];
    }),
  }));

const createIncomeRow = (): IncomeRow => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  incomeSource: '',
  contribution: '',
  amount: '',
  status: '',
  remarks: '',
  creditAccount: '',
});

const normalizeText = (value: string | null | undefined): string =>
  String(value || '').trim();

interface SearchBudgetModalProps {
  show: boolean;
  searchTerm: string;
  expandedHead: string;
  activeSubHead: string;
  onClose: () => void;
  onSearchTermChange: (value: string) => void;
  onExpandedHeadChange: (value: string) => void;
  onActiveSubHeadChange: (value: string) => void;
  onSelectHead: (head: string) => void;
  onSelectSubHead: (head: string, subhead: string) => void;
}

const SearchBudgetModal: React.FC<SearchBudgetModalProps> = ({
  show,
  searchTerm,
  expandedHead,
  activeSubHead,
  onClose,
  onSearchTermChange,
  onExpandedHeadChange,
  onActiveSubHeadChange,
  onSelectHead,
  onSelectSubHead,
}) => {
  const allData = useMemo(
    () =>
      BUDGET_HEAD_GROUPS.flatMap((group) =>
        group.options.map((head) => ({
          head,
          subheads: SUB_HEAD_BY_BUDGET_HEAD[head] || [],
        }))
      ),
    []
  );

  const query = searchTerm.trim().toLowerCase();

  const filteredData = useMemo(
    () =>
      allData
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
        }),
    [allData, query]
  );

  useEffect(() => {
    if (!show || !expandedHead) return;

    const headBlock = document.querySelector(`[data-head="${expandedHead}"]`);
    if (!headBlock) return;

    let targetSub = activeSubHead;
    if (!targetSub && query) {
      const item = filteredData.find((x) => x.head === expandedHead);
      const match = item?.subheads.find((subhead) => subhead.toLowerCase().includes(query));
      if (match) targetSub = match;
    }

    if (!targetSub) return;

    setTimeout(() => {
      const el = headBlock.querySelector(`[data-subhead="${targetSub}"]`);
      if (el) {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  }, [activeSubHead, expandedHead, filteredData, query, show]);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '30px',
          maxWidth: '700px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '2px solid #0069ab',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: 0,
              color: '#0069ab',
              fontSize: '20px',
              fontWeight: 'bold',
            }}
          >
            Search Budget Heads & Subheads
          </h2>

          <button
            onClick={onClose}
            style={{
              fontSize: '24px',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
            }}
          >
            ×
          </button>
        </div>

        <CustomInput
          name="searchTerm"
          type="text"
          value={searchTerm}
          onChange={(value) => {
            onSearchTermChange(value);
            onActiveSubHeadChange('');
          }}
          autoFocus={true}
          onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
          placeholder="Type head or subhead"
          onFocus={(e) => (e.currentTarget.style.borderColor = '#0069ab')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#e0e0e0')}
        />

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {filteredData.length > 0 ? (
            filteredData.map(({ head, subheads }) => {
              const isExpanded = expandedHead === head;

              return (
                <div
                  key={head}
                  data-head={head}
                  style={{
                    padding: '16px',
                    marginBottom: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#f8f9fa',
                    borderLeft: '4px solid #0069ab',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px',
                    }}
                  >
                    <div
                      style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
                      title="Click to use this Head"
                      onClick={() => onSelectHead(head)}
                    >
                      {head}
                    </div>

                    <div
                      style={{ cursor: 'pointer', fontSize: '14px', color: '#666' }}
                      title="Expand / collapse subheads"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExpandedHeadChange(isExpanded ? '' : head);
                        onActiveSubHeadChange('');
                      }}
                    >
                      {subheads.length} subheads {isExpanded ? '?' : '?'}
                    </div>
                  </div>

                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {subheads.slice(0, 3).join(', ')}
                    {subheads.length > 3 && !isExpanded && '...'}
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '12px',
                        maxHeight: '170px',
                        overflowY: 'auto',
                        borderTop: '1px solid #e0e0e0',
                        paddingTop: '12px',
                      }}
                    >
                      {subheads.map((subhead) => (
                        <div
                          key={`${head}-${subhead}`}
                          data-subhead={subhead}
                          style={{
                            padding: '8px 10px',
                            marginBottom: '6px',
                            backgroundColor: 'white',
                            borderRadius: '6px',
                            fontSize: '13px',
                            borderLeft: '3px solid #28a745',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSubHead(head, subhead);
                          }}
                        >
                          {subhead}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              No matches for "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FinanceApproval: React.FC = () => {
  const [applicantName, setApplicantName] = useState<string>('');
  const [date, setDate] = useState<string>(getLocalTodayYmd());
  const [designation, setDesignation] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amountProposed, setAmountProposed] = useState<string>('');
  const [directorComments, setDirectorComments] = useState<string>('');
  const [directorStatus, setDirectorStatus] = useState<string>('');
  const [principalComments, setPrincipalComments] = useState<string>('');
  const [principalStatus, setPrincipalStatus] = useState<string>('');
  const [principalPriority, setPrincipalPriority] = useState<string>('');
  const [chairmanComments, setChairmanComments] = useState<string>('');
  const [chairmanStatus, setChairmanStatus] = useState<string>('');
  const [stageRemarkInput, setStageRemarkInput] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [autoDownloadPdf, setAutoDownloadPdf] = useState<boolean>(false);
  const [submittedAt, setSubmittedAt] = useState<string>('');
  const [isBudgetProposed, setIsBudgetProposed] = useState<string>('');
  const [balanceAmount, setBalanceAmount] = useState<string>('');
  const [debitStatus, setDebitStatus] = useState<'credited' | 'reimbursement' | ''>('');
  const [email, setEmail] = useState<string>('');
  const [budgetRows, setBudgetRows] = useState([
    { category: "", head: "", amount: "" },
  ]);
  const [showIncomeSection, setShowIncomeSection] = useState<boolean>(false);
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([createIncomeRow()]);
  const [budgetLineMetaByRow, setBudgetLineMetaByRow] = useState<Record<number, BudgetLineMeta>>({});
  const [statusUpdates, setStatusUpdates] = useState<any[]>([]);
  const [proposalRef, setProposalRef] = useState<string>('');
  const [expandedTimelineDetails, setExpandedTimelineDetails] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [isExternalApplicant, setIsExternalApplicant] = useState<boolean>(false);
  const [applicantSearchQuery, setApplicantSearchQuery] = useState<string>('');
  const [applicantSearchResults, setApplicantSearchResults] = useState<Array<{ employee_id: number; name: string; designation: string; department: string; email: string; mobile: string; employee_type: string }>>([]);
  const [showApplicantDropdown, setShowApplicantDropdown] = useState<boolean>(false);
  const componentRef = useRef<HTMLDivElement>(null);
  const autoDownloadTriggeredRef = useRef<boolean>(false);
  const [showUnplannedBudget, setShowUnplannedBudget] = useState<boolean>(false);
  const [unplannedBudgetAmount, setUnplannedBudgetAmount] = useState<string>('');
  const [unplannedBudgetDescription, setUnplannedBudgetDescription] = useState<string>('');
  const [hasPrincipalDocument, setHasPrincipalDocument] = useState<boolean>(false);
  const [principalApprovalPopupOpen, setPrincipalApprovalPopupOpen] = useState(false);
  const [principalApprovalFile, setPrincipalApprovalFile] = useState<File | null>(null);
  const [principalApprovalSubmitting, setPrincipalApprovalSubmitting] = useState(false);
  // State for dynamic subcategory options (Department, Centre, Cell, Club, Professional Body)
  const [subcategoryOptionsByType, setSubcategoryOptionsByType] = useState<Record<string, SelectOption[]>>({});
  const [annexureType, setAnnexureType] = useState<string>('');
  const [annexureFiles, setAnnexureFiles] = useState<AnnexureFileRow[]>([]);
  const [eventSubHeadError, setEventSubHeadError] = useState<string>('');
  const annexureFileInputRef = useRef<HTMLInputElement>(null);
  const annexureFilesRef = useRef<AnnexureFileRow[]>([]);

  // State for tag options
  const [tagOptions, setTagOptions] = useState<SelectOption[]>(FALLBACK_TAG_OPTIONS);

  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
  }>({
    show: false,
    message: "",
    type: "info"
  });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType = "info",
    title?: string,
    showCancel = false,
    confirmText = "OK",
    onConfirm?: () => void,
    cancelText = "Cancel"
  ) => {
    setAlertConfig({
      show: true,
      message,
      type,
      title,
      onConfirm,
      showCancel,
      confirmText,
      cancelText,
    });
  };

  const closeAlert = () => setAlertConfig(prev => ({ ...prev, show: false }));

  // Action popup state (custom modal for return/reject comments)
  const [wfActionPopupOpen, setWfActionPopupOpen] = useState(false);
  const [wfActionType, setWfActionType] = useState<'returned' | 'rejected' | null>(null);
  const [wfActionComment, setWfActionComment] = useState('');
  const [wfActionSubmitting, setWfActionSubmitting] = useState(false);

  useEffect(() => {
    setExpandedTimelineDetails({});
  }, [statusUpdates]);

  useEffect(() => {
    annexureFilesRef.current = annexureFiles;
  }, [annexureFiles]);

  useEffect(() => {
    return () => {
      annexureFilesRef.current.forEach((row) => {
        if (row.previewUrl && row.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(row.previewUrl);
        }
      });
    };
  }, []);

  // Load all beneficiary options (Department, Centre, Cell, Club, Professional Body) - SAME AS BUDGET.TSX
  useEffect(() => {
    let cancelled = false;

    const loadBeneficiaryOptions = async () => {
      const toOptions = (rows: any[]): SelectOption[] =>
        rows
          .map((row: any) => normalizeText(row?.name))
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
            nextOptions[beneficiaryKey] = toOptions(rows);
          });
        } else {
          throw new Error('Grouped org-units payload unavailable');
        }
      } catch (bulkError) {
        console.error('Failed to fetch bulk org units, falling back to per-type calls:', bulkError);

        for (const [beneficiaryKey, apiType] of Object.entries(BENEFICIARY_TYPE_TO_ENTITY_API_TYPE)) {
          try {
            const response = await authenticityUtility.get(`/finance-requests/org-units/${apiType}`) as any;
            const rows = Array.isArray(response?.data) ? response.data : [];
            nextOptions[beneficiaryKey] = toOptions(rows);
          } catch (error) {
            console.error(`Failed to fetch options for ${beneficiaryKey}:`, error);
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

  // Load tag options - SAME AS BUDGET.TSX
  useEffect(() => {
    const loadTagOptions = async () => {
      try {
        const response = await authenticityUtility.get('/finance-requests/tags') as any;
        if ((response?.status === 'success' || response?.success === true) && Array.isArray(response?.data)) {
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

  // Search applicant handler
  const handleApplicantSearch = async (query: string) => {
    setApplicantSearchQuery(query);
    try {
      const response = await authenticityUtility.get(`/finance-requests/search-applicant?q=${encodeURIComponent(query)}`) as { status: string; data: Array<{ employee_id: number; name: string; designation: string; department: string; email: string; mobile: string; employee_type: string }> };
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
    setApplicantSearchQuery(emp.name.trim());
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

  const getSubHeadOptions = (budgetHead: string): string[] => {
    const headGroup = HEAD_TO_GROUP[budgetHead];
    if (headGroup && HOAC_GROUPS.has(headGroup) && HOAC_SUBHEAD_OPTIONS[headGroup]) {
      return HOAC_SUBHEAD_OPTIONS[headGroup];
    }
    return SUB_HEAD_BY_BUDGET_HEAD[budgetHead] ?? [];
  };

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
    documentTitle: "Finance_Approval_Request",
  });

  const generatePDF = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const approvalHistory = getWorkflowTimeline(statusUpdates, {
        name: applicantName || '',
        email: email || '',
        date: submittedAt ? formatWorkflowTimestamp(submittedAt) : getCurrentWorkflowTimestamp(),
      });

      const submittedBy = approvalHistory.find((entry) => entry.label === 'Submitted') || {
        actor: applicantName || '',
        email: email || '',
        timestamp: getSubmittedTimestamp(
          approvalHistory,
          submittedAt ? formatWorkflowTimestamp(submittedAt) : '',
          !id
        ),
      };

      const beneficiaryText = (() => {
        const type = String(beneficiaryType || '').trim();
        const value = String(beneficiaryValue || '').trim();
        if (!type) return '\u00A0';
        if (!value) return type;
        if (type === 'Institution') return value;
        return `${type} - ${value}`;
      })();

      const annexureSummary = annexureFiles.length
        ? annexureFiles
          .map((row) => {
            const type = String(row.annexureType || '').trim();
            return type || 'Unnamed File';
          })
          .join(', ')
        : 'Not Added';

      const skippedFiles = await generateAndDownloadFinancePdf({
        applicantName,
        requestDate: date,
        department,
        designation,
        email,
        mobile,
        beneficiaryText,
        description,
        headOfAccountsText: primaryHead + (extraDropdownVisible && eventSubHead ? ` - ${eventSubHead}` : ''),
        budgetRows,
        showUnplannedBudget,
        unplannedBudgetAmount,
        unplannedBudgetDescription,
        totalBudget,
        showIncomeSection,
        incomeRows,
        annexureSummary,
        approvalHistory,
        proposalRef,
        submittedBy,
        annexureFiles,
        baseUrl: authenticityUtility.getBaseURL(),
        authToken: localStorage.getItem('token'),
      });

      if (skippedFiles.length) {
        showAlert(
          `Downloaded combined PDF. Skipped unsupported annexure files: ${skippedFiles.join(', ')}`,
          'warning'
        );
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      showAlert('Error generating PDF. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdfClick = async () => {
    if (!canDownloadPdf) {
      showAlert(
        isAdminWorkflowContext && totalBudget > 10000
          ? 'You can download the PDF once the DOF approval is completed.'
          : 'You can download the PDF once the proposal is approved.',
        'warning'
      );
      return;
    }

    await generatePDF();
  };

  const handlePreviewToggleClick = () => {
    if (isViewMode) {
      navigate('/financecard');
      return;
    }

    setShowPreview((prev) => !prev);
  };

  const handleAddRow = () => {
    const lastIndex = budgetRows.length - 1;
    if (!isBudgetRowReadyForAdd(lastIndex)) {
      showAlert(getBudgetAddTooltip(lastIndex), 'warning');
      return;
    }

    const firstRowCategory = budgetRows[0]?.category || '';
    const newIndex = budgetRows.length;

    setBudgetRows(prev => [
      ...prev,
      {
        category: firstRowCategory,
        head: '',
        amount: ''
      }
    ]);
    setBudgetLineMetaByRow((prev) => ({
      ...prev,
      [newIndex]: {
        budgetLineId: null,
        budgetProposalId: null,
        availableAmount: 0,
      },
    }));
  };

  const handleDeleteRow = (index: number): void => {
    const updated = budgetRows.filter((_, i) => i !== index);
    setBudgetRows(updated.length ? updated : [{ category: 'Individual', head: '', amount: '' }]);
    setBudgetLineMetaByRow((prev) => {
      const nextMeta: Record<number, BudgetLineMeta> = {};
      updated.forEach((_, nextIndex) => {
        const oldIndex = nextIndex >= index ? nextIndex + 1 : nextIndex;
        const existing = prev[oldIndex];
        nextMeta[nextIndex] = existing || {
          budgetLineId: null,
          budgetProposalId: null,
          availableAmount: 0,
        };
      });
      return nextMeta;
    });
  };

  const getBudgetRowKey = (rowIndex: number): string => {
    const row = budgetRows[rowIndex];
    const budgetLineId = budgetLineMetaByRow[rowIndex]?.budgetLineId ?? null;
    if (budgetLineId) {
      return `line:${budgetLineId}`;
    }
    const effectiveHead = normalizeText(primaryHead) || normalizeText(row?.category);
    const effectiveSubHead =
      (extraDropdownVisible ? normalizeText(eventSubHead) : '') || normalizeText(row?.head);
    const headOnlyMatch = shouldUseHeadOnlyAvailabilityMatch(effectiveHead, effectiveSubHead);
    if (headOnlyMatch) {
      return `head:${effectiveHead}|mode:head-only`;
    }
    return `head:${effectiveHead}|sub:${effectiveSubHead}`;
  };

  const getRemainingAvailableForRow = (rowIndex: number): number => {
    const baseAvailable = Number(budgetLineMetaByRow[rowIndex]?.availableAmount ?? 0);
    const rowKey = getBudgetRowKey(rowIndex);
    const reservedByPreviousRows = budgetRows
      .slice(0, rowIndex)
      .reduce((sum, _prevRow, prevIndex) => {
        if (getBudgetRowKey(prevIndex) !== rowKey) {
          return sum;
        }
        return sum + Number(budgetRows[prevIndex]?.amount || 0);
      }, 0);

    return Math.max(0, baseAvailable - reservedByPreviousRows);
  };
  const fetchBudgetAvailability = async (rowIndex: number, budgetHead: string, subHead: string) => {
    const normalizedHead = normalizeText(primaryHead) || normalizeText(budgetHead);
    const normalizedSubHead =
      (extraDropdownVisible ? normalizeText(eventSubHead) : '') || normalizeText(subHead);
    const headOnlyMatch = shouldUseHeadOnlyAvailabilityMatch(normalizedHead, normalizedSubHead);

    if (!normalizedHead || (!headOnlyMatch && !normalizedSubHead)) {
      setBudgetLineMetaByRow((prev) => ({
        ...prev,
        [rowIndex]: {
          budgetLineId: null,
          budgetProposalId: null,
          availableAmount: 0,
        },
      }));
      return;
    }

    try {
      const response = await authenticityUtility.get('/finance-requests/budget-availability', {
        params: {
          budget_head: normalizedHead,
          ...(normalizedSubHead ? { sub_head: normalizeSubHeadForDb(normalizedSubHead) } : {}),
          head_only_match: headOnlyMatch ? '1' : '0',
          finance_id: isEditMode && id ? id : undefined,
          beneficiary_type: beneficiaryType || undefined,
          beneficiary_value: beneficiaryValue || undefined,
        },
      }) as {
        status: string;
        data?: {
          selected?: {
            budgetLineId?: number;
            budgetProposalId?: number;
            availableAmount?: number;
          } | null;
          totalAvailable?: number;
        };
      };

      const selected = response?.data?.selected || null;
      const availableAmount = Number(
        headOnlyMatch
          ? (response?.data?.totalAvailable ?? selected?.availableAmount ?? 0)
          : (selected?.availableAmount ?? response?.data?.totalAvailable ?? 0)
      );

      setBudgetLineMetaByRow((prev) => ({
        ...prev,
        [rowIndex]: {
          budgetLineId: headOnlyMatch
            ? null
            : (selected?.budgetLineId ? Number(selected.budgetLineId) : null),
          budgetProposalId: headOnlyMatch
            ? null
            : (selected?.budgetProposalId ? Number(selected.budgetProposalId) : null),
          availableAmount: Number.isFinite(availableAmount) ? availableAmount : 0,
        },
      }));
    } catch (error) {
      console.error('Failed to fetch budget availability', error);
      setBudgetLineMetaByRow((prev) => ({
        ...prev,
        [rowIndex]: {
          budgetLineId: null,
          budgetProposalId: null,
          availableAmount: 0,
        },
      }));
    }
  };

  const handleBudgetChange = (index: number, field: keyof BudgetRow, value: string) => {
    const updated = [...budgetRows];
    if (field === 'category') {
      updated[index] = { ...updated[index], category: value, head: '', amount: '' };
      setBudgetLineMetaByRow((prev) => ({
        ...prev,
        [index]: {
          budgetLineId: null,
          budgetProposalId: null,
          availableAmount: 0,
        },
      }));
    } else if (field === 'amount') {
      const raw = String(value ?? '').trim();
      if (raw === '') {
        updated[index][field] = '';
        setBudgetRows(updated);
        return;
      }

      let num = Number(raw) || 0;
      if (num > MAX_AMOUNT) num = MAX_AMOUNT;
      const remainingAmount = getRemainingAvailableForRow(index);
      if (num > remainingAmount) {
        showAlert(
          `Row ${index + 1}: Requested amount cannot exceed available balance  ${remainingAmount}.`,
          'warning'
        );
        num = remainingAmount;
      }
      updated[index][field] = num.toString();
    } else {
      updated[index][field] = value;
      if (field === 'head') {
        fetchBudgetAvailability(index, normalizeText(primaryHead) || updated[index].category, normalizeSubHeadForDb(value));
      }
    }
    setBudgetRows(updated);
  };

  const handleBudgetHeadSelection = (index: number, option: OptionType | null) => {
    const selected = option as BudgetHeadSearchOption | null;
    const selectedHead = selected?.budgetHead ? String(selected.budgetHead) : '';
    const selectedSubHead = selected?.subHead ? String(selected.subHead) : '';

    setBudgetRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        category: selectedHead,
        head: selectedSubHead,
      };
      return updated;
    });

    const effectiveLookupHead = normalizeText(primaryHead) || selectedHead;
    const canFetchWithHeadOnly = shouldUseHeadOnlyAvailabilityMatch(effectiveLookupHead, selectedSubHead);
    if (effectiveLookupHead && (selectedSubHead || canFetchWithHeadOnly)) {
      fetchBudgetAvailability(index, effectiveLookupHead, normalizeSubHeadForDb(selectedSubHead));
    } else {
      setBudgetLineMetaByRow((prev) => ({
        ...prev,
        [index]: {
          budgetLineId: null,
          budgetProposalId: null,
          availableAmount: 0,
        },
      }));
    }
  };

  const availabilityFetchKeyByRowRef = useRef<Record<number, string>>({});

  const handleAddIncomeRow = () => {
    const lastIndex = incomeRows.length - 1;
    const lastRow = incomeRows[lastIndex];
    if (!isIncomeRowReadyForAdd(lastRow)) {
      showAlert(getIncomeAddTooltip(lastRow, lastIndex), 'warning');
      return;
    }

    setIncomeRows((prev) => [...prev, createIncomeRow()]);
  };

  const handleDeleteIncomeRow = (id: string) => {
    setIncomeRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  const handleIncomeRowChange = (id: string, field: keyof IncomeRow, value: string) =>
    setIncomeRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
            ...row,
            [field]: field === "amount" ? value.replace(/\D/g, "") : value,
          }
          : row
      )
    );
  const createAnnexureRowId = () => `annexure-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  const handleAnnexureFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (String(annexureType || '').trim() === 'Not Applicable') {
      showAlert('File upload is disabled when Annexure Type is "Not Applicable".', 'warning');
      if (annexureFileInputRef.current) {
        annexureFileInputRef.current.value = '';
      }
      return;
    }

    if (!String(annexureType || '').trim()) {
      showAlert('Please select annexure type before uploading files.', 'warning');
      if (annexureFileInputRef.current) {
        annexureFileInputRef.current.value = '';
      }
      return;
    }

    const invalidFiles = files.filter(
      (file) => file.type !== 'application/pdf' || file.size >= 2 * 1024 * 1024
    );

    if (invalidFiles.length > 0) {
      showAlert('Only PDF files with a size less than 2MB are allowed.', 'warning');
      if (annexureFileInputRef.current) {
        annexureFileInputRef.current.value = '';
      }
      return;
    }

    const nextRows = files.map((file) => ({
      id: createAnnexureRowId(),
      annexureType: annexureType,
      file,
      previewUrl: URL.createObjectURL(file),
      originalName: file.name,
      storedName: '',
      filePath: '',
      mimeType: file.type || '',
      size: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
    }));

    setAnnexureFiles((prev) => [...prev, ...nextRows]);
    if (annexureFileInputRef.current) {
      annexureFileInputRef.current.value = '';
    }
  };

  const openAnnexureFile = (row: AnnexureFileRow) => {
    const openUrl = getAnnexureOpenUrl(row, authenticityUtility.getBaseURL());
    if (!openUrl) return;
    window.open(openUrl, '_blank', 'noopener,noreferrer');
  };

  const deleteAnnexureFile = (rowId: string) => {
    setAnnexureFiles((prev) => {
      const target = prev.find((row) => row.id === rowId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const getAnnexureSummary = () => {
    if (!annexureFiles.length) {
      return 'Not Added';
    }
    return annexureFiles
      .map((row) => {
        const type = String(row.annexureType || '').trim();
        return type || 'Unnamed File';
      })
      .join(', ');
  };

  const unplannedBudgetTotal = showUnplannedBudget ? Number(unplannedBudgetAmount || 0) : 0;
  const hasUnplannedBudgetPreview = showUnplannedBudget || Number(unplannedBudgetAmount || 0) > 0;
  const totalBudget = budgetRows.reduce((sum, row) => sum + Number(row.amount || 0), 0) + unplannedBudgetTotal;
  const actionCell: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
  };

  const iconBtn: CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: '#f5f6f8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    transition: 'background-color 0.3s ease',
  };

  const deleteIconBtn: CSSProperties = {
    ...iconBtn,
    background: '#ffe6e6',
    alignItems: 'center',
    color: '#dc3545'
  };
  const annexureUploadButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: '1px solid #cfd8e3',
    borderRadius: '12px',
    padding: '12px 16px',
    background: '#0069ab',
    color: 'white',
    fontWeight: 300,
    cursor: 'pointer',
    boxShadow: '0 6px 14px rgba(15, 23, 42, 0.06)',
  };
  const annexureFileRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    color: '#1f2937',
    fontSize: '0.92rem',
    fontWeight: 500,
  };

  const incomeCellStyle: CSSProperties = {
    padding: '8px',
    border: '1px solid #e0e0e0',
    textAlign: 'left',

  };
  const incomeSubRowLabelStyle: CSSProperties = {
    padding: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#eaf2ff',
    textAlign: 'center',
    fontWeight: 600,
    color: '#374151',
  };

  const hasFilledText = (value: string | null | undefined): boolean => normalizeText(value).length > 0;

  const getBudgetRowMissingFields = (row: BudgetRow): string[] => {
    const missing: string[] = [];
    const normalizedBudgetHead = normalizeText(row.category);

    if (!normalizedBudgetHead) {
      missing.push('Budget Head');
    }

    if (!(Number(row.amount || 0) > 0)) {
      missing.push('Amount');
    }

    return missing;
  };

  const isBudgetRowReadyForAdd = (index: number): boolean => {
    const row = budgetRows[index];
    if (!row) return false;
    if (!hasFilledText(primaryHead)) return false;
    return getBudgetRowMissingFields(row).length === 0;
  };

  const getBudgetAddTooltip = (index: number): string => {
    const row = budgetRows[index];
    if (!hasFilledText(primaryHead)) {
      return 'Select Head of Accounts first';
    }
    if (!row) {
      return 'Fill the current budget row first';
    }

    const missing = getBudgetRowMissingFields(row);
    return missing.length
      ? `Fill ${missing.join(', ')} in row ${index + 1} to add a new row`
      : 'Add Row';
  };

  const getIncomeRowMissingFields = (row: IncomeRow): string[] => {
    const missing: string[] = [];

    if (!hasFilledText(row.incomeSource)) missing.push('Income Source');
    if (!(Number(row.amount || 0) > 0)) missing.push('Amount');
    if (!hasFilledText(row.status)) missing.push('Status');
    if (!hasFilledText(row.remarks)) missing.push('Remarks');
    if (!hasFilledText(row.contribution)) missing.push('Contribution');
    if (!hasFilledText(row.creditAccount)) missing.push('Credit Account');

    return missing;
  };

  const isIncomeRowReadyForAdd = (row: IncomeRow | undefined): boolean =>
    Boolean(row) && getIncomeRowMissingFields(row as IncomeRow).length === 0;

  const getIncomeAddTooltip = (row: IncomeRow | undefined, index: number): string => {
    if (!row) {
      return 'Fill the current income row first';
    }

    const missing = getIncomeRowMissingFields(row);
    return missing.length
      ? `Fill ${missing.join(', ')} in row ${index + 1} to add a new row`
      : 'Add Row';
  };

  const getAnnexureRowMissingFields = (row: AnnexureFileRow): string[] => {
    const missing: string[] = [];
    const isNotApplicable = String(row.annexureType || '').trim() === 'Not Applicable';

    if (!hasFilledText(row.annexureType)) missing.push('Annexure Type');
    if (!isNotApplicable && !hasFilledText(row.originalName) && !hasFilledText(row.storedName) && !hasFilledText(row.filePath)) {
      missing.push('File');
    }

    return missing;
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      if (isViewMode) {
        return;
      }

      if (!hasFilledText(applicantName)) {
        showAlert('Please fill Applicant Name.', 'warning');
        return;
      }
      if (!hasFilledText(date)) {
        showAlert('Please select Date.', 'warning');
        return;
      }
      if (!hasFilledText(department)) {
        showAlert('Please fill Department.', 'warning');
        return;
      }
      if (!hasFilledText(designation)) {
        showAlert('Please fill Designation.', 'warning');
        return;
      }
      if (!hasFilledText(email)) {
        showAlert('Please fill Email.', 'warning');
        return;
      }
      if (!hasFilledText(mobile)) {
        showAlert('Please fill Mobile.', 'warning');
        return;
      }
      if (!hasFilledText(beneficiaryType)) {
        showAlert('Please select Beneficiary.', 'warning');
        return;
      }
      if (beneficiaryType !== 'Institution' && !hasFilledText(beneficiaryValue)) {
        showAlert(`Please select ${getSubcategoryLabel(beneficiaryType)}.`, 'warning');
        return;
      }
      if (!hasFilledText(selectedTag)) {
        showAlert('Please select Tag.', 'warning');
        return;
      }
      if (!hasFilledText(description)) {
        showAlert('Please enter Description.', 'warning');
        return;
      }
      if (!hasFilledText(primaryHead)) {
        showAlert('Please select Head of Accounts.', 'warning');
        return;
      }
      if (extraDropdownVisible && !hasFilledText(eventSubHead)) {
        setEventSubHeadError('Please select Sub Head.');
        showAlert('Please select Sub Head.', 'warning');
        return;
      }
      if (showUnplannedBudget) {
        if (!hasFilledText(unplannedBudgetDescription)) {
          showAlert('Please enter Unplanned Budget description.', 'warning');
          return;
        }
        if (!(Number(unplannedBudgetAmount || 0) > 0)) {
          showAlert('Please enter a valid Unplanned Budget amount.', 'warning');
          return;
        }
      }

      for (let index = 0; index < budgetRows.length; index += 1) {
        const row = budgetRows[index];
        const requestedAmount = Number(row.amount || 0);
        const remainingAmount = getRemainingAvailableForRow(index);
        const missingFields = getBudgetRowMissingFields(row);

        if (missingFields.length > 0) {
          showAlert(`Please fill ${missingFields.join(', ')} for budget row ${index + 1}.`, 'warning');
          return;
        }

        if (requestedAmount > remainingAmount) {
          showAlert(
            `Row ${index + 1}: Requested amount (${requestedAmount}) exceeds available balance (${remainingAmount}).`,
            'warning'
          );
          return;
        }
      }

      if (showIncomeSection) {
        for (let index = 0; index < incomeRows.length; index += 1) {
          const row = incomeRows[index];
          const missingFields = getIncomeRowMissingFields(row);

          if (missingFields.length > 0) {
            showAlert(`Please fill ${missingFields.join(', ')} for income row ${index + 1}.`, 'warning');
            return;
          }
        }
      }

      const isAnnexureNotApplicable = String(annexureType || '').trim() === 'Not Applicable';

      if (!isAnnexureNotApplicable && annexureFiles.length === 0) {
        showAlert('Please add at least one annexure.', 'warning');
        return;
      }

      if (annexureFiles.length > 0) {
        for (let index = 0; index < annexureFiles.length; index += 1) {
          const row = annexureFiles[index];
          const missingFields = getAnnexureRowMissingFields(row);

          if (missingFields.length > 0) {
            showAlert(`Please fill ${missingFields.join(', ')} for annexure row ${index + 1}.`, 'warning');
            return;
          }
        }
      }

      const annexuresPayload: Array<{
        annexure_type: string | null;
        original_name: string | null;
        stored_name: string | null;
        file_path: string | null;
        mime_type: string | null;
        file_size: number | null;
      }> = [];

      for (const row of annexureFiles) {
        if (row.file) {
          const formData = new FormData();
          formData.append('file', row.file);
          const uploadResponse = await authenticityUtility.postFile('/finance-requests/annexure/upload', formData) as {
            status?: string;
            data?: {
              originalName?: string;
              storedName?: string;
              filePath?: string;
              mimeType?: string;
              size?: number;
            };
            message?: string;
          };

          if (uploadResponse?.status !== 'success' || !uploadResponse?.data) {
            showAlert(uploadResponse?.message || 'Failed to upload annexure file', 'error');
            return;
          }

          annexuresPayload.push({
            annexure_type: row.annexureType || null,
            original_name: uploadResponse.data.originalName || row.originalName || row.file.name || null,
            stored_name: uploadResponse.data.storedName || null,
            file_path: uploadResponse.data.filePath || null,
            mime_type: uploadResponse.data.mimeType || row.mimeType || null,
            file_size: Number.isFinite(Number(uploadResponse.data.size))
              ? Number(uploadResponse.data.size)
              : (row.size ?? null),
          });
        } else if (row.storedName && row.filePath) {
          annexuresPayload.push({
            annexure_type: row.annexureType || null,
            original_name: row.originalName || row.storedName || null,
            stored_name: row.storedName || null,
            file_path: row.filePath || null,
            mime_type: row.mimeType || null,
            file_size: row.size ?? null,
          });
        }
      }
      const primaryAnnexure = annexuresPayload[0] || null;

      const primaryIncomeRow = showIncomeSection ? incomeRows[0] : undefined;
      const payload = {
        employee_id: isExternalApplicant ? null : employeeId,
        applicant_name: isExternalApplicant ? applicantName : null,
        designation: isExternalApplicant ? designation : null,
        department: isExternalApplicant ? department : null,
        email: isExternalApplicant ? email : null,
        mobile: isExternalApplicant ? mobile : null,

        request_date: date,
        description,

        beneficiary_type: beneficiaryType,
        beneficiary_value: beneficiaryValue,
        budget_tag: selectedTag || null,

        primary_head: primaryHead,
        event_sub_head: eventSubHead,

        is_budget_proposed: isBudgetProposed,
        proposed_amount: amountProposed || null,
        balance_amount: balanceAmount || null,
        unplanned_budget_enabled: showUnplannedBudget,
        unplanned_budget_amount: showUnplannedBudget ? Number(unplannedBudgetAmount || 0) : null,
        unplanned_budget_description: showUnplannedBudget ? (normalizeText(unplannedBudgetDescription) || null) : null,

        income_type: primaryIncomeRow?.incomeSource || '',
        income_status: primaryIncomeRow?.creditAccount || '',
        income_amount_type: primaryIncomeRow?.contribution || '',
        annexure_type: primaryAnnexure?.annexure_type || null,
        annexure_file_name: primaryAnnexure?.original_name || null,
        annexure_storage_name: primaryAnnexure?.stored_name || null,
        annexure_file_path: primaryAnnexure?.file_path || null,
        annexure_mime_type: primaryAnnexure?.mime_type || null,
        annexure_file_size: primaryAnnexure?.file_size ?? null,
        annexures: annexuresPayload,
        credit_status: primaryIncomeRow?.status || '',
        debit_status: debitStatus || null,
        partial_amount: primaryIncomeRow?.amount || null,
        budget_rows: budgetRows.map((row, index) => {
          const normalizedBudgetHead = normalizeText(primaryHead) || normalizeText(row.category);
          const normalizedSubHead = normalizeText(row.head);
          const headOnlyMatch = shouldUseHeadOnlyAvailabilityMatch(normalizedBudgetHead, normalizedSubHead);
          return {
            budget_head: normalizedBudgetHead,
            sub_head: normalizedSubHead,
            head_only_match: headOnlyMatch,
            amount: Number(row.amount || 0),
            budget_line_id: headOnlyMatch ? null : (budgetLineMetaByRow[index]?.budgetLineId || null),
            budget_proposal_id: headOnlyMatch ? null : (budgetLineMetaByRow[index]?.budgetProposalId || null),
            available_amount_snapshot: budgetLineMetaByRow[index]?.availableAmount ?? null,
          };
        }),
        income_rows: showIncomeSection ? incomeRows : [],
      };

      const result = (isEditMode && id
        ? await authenticityUtility.put(`/finance-requests/${id}`, payload)
        : await authenticityUtility.post('/finance-requests', payload)) as { status: string; message?: string };

      if (result.status !== 'success') {
        showAlert(result.message || 'Submission failed', 'error');
        return;
      }

      if (isEditMode && loadedWorkflowStatus === 'returned' && !isAdminWorkflowContext) {
        const resubmitResult = await authenticityUtility.post(`/finance-requests/${id}/resubmit`, {}) as { status?: string; message?: string };
        if (resubmitResult.status !== 'success') {
          showAlert(resubmitResult.message || 'Finance request updated, but resubmission failed', 'error');
          return;
        }
      }

      const responseId = isEditMode ? id : (result as any).data?.id;
      const refNo = responseId ? `#F-${new Date().getFullYear()}-${String(responseId).padStart(4, '0')}` : '';

      showAlert(
        <div>
          <div>{isEditMode ? 'Finance request updated successfully!' : 'Finance request submitted successfully!'}</div>
          {refNo && <div style={{ marginTop: '8px', fontWeight: 'bold' }}>Reference No.: {refNo}</div>}
        </div>,
        'success',
        'Success',
        false,
        'OK',
        () => {
          closeAlert();
          navigate(isAdminWorkflowContext ? '/workflow/finance' : '/financecard');
        }
      );
    } catch (error) {
      console.error('Finance submit error:', error);
      showAlert(getFinanceSubmitErrorMessage(error), 'error');
    }
  };

  const handleWorkflowAction = async (decision: 'approved' | 'returned' | 'rejected' | 'archived') => {
    if (!id) return;

    // For return/reject, open the custom comment modal instead of window.prompt
    if (decision === 'returned' || decision === 'rejected') {
      setWfActionType(decision);
      setWfActionComment('');
      setWfActionPopupOpen(true);
      return;
    }

    if (decision === 'approved' || decision === 'archived') {
      const isArchivedAction = decision === 'archived';
      showAlert(
        isArchivedAction
          ? 'Are you sure you want to archive this request?'
          : 'Are you sure you want to approve this request?',
        'warning',
        isArchivedAction ? 'Confirm Archive' : 'Confirm Approval',
        true,
        isArchivedAction ? 'Archive' : 'Approve',
        () => {
          closeAlert();
          executeWorkflowAction(decision);
        }
      );
      return;
    }

    await executeWorkflowAction(decision);
  };

  const executeWorkflowAction = async (decision: 'approved' | 'returned' | 'rejected' | 'archived', feedback?: string) => {
    if (!id) return;

    try {
      setIsLoading(true);

      const response = (decision === 'archived'
        ? await authenticityUtility.patch(`/finance-requests/${id}/archive-toggle`, {})
        : await authenticityUtility.patch(`/finance-requests/${id}/approval`, {
          decision,
          feedback,
          stageRemark: normalizeText(stageRemarkInput) || undefined,
        })) as { status?: string; success?: boolean; message?: string; data?: { message?: string } };

      if (response?.status !== 'success' && response?.success !== true) {
        showAlert(response?.message || response?.data?.message || `Failed to ${decision}`, 'error');
        return;
      }

      navigate('/workflow/finance');
    } catch (error: any) {
      showAlert(error?.response?.data?.message || error?.message || `Failed to ${decision}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const submitWfActionWithComment = async () => {
    if (!wfActionType || wfActionSubmitting) return;
    const comment = wfActionComment.trim();
    if (!comment) {
      showAlert('Please enter comments.', 'warning');
      return;
    }
    setWfActionSubmitting(true);
    try {
      await executeWorkflowAction(wfActionType, comment);
      setWfActionPopupOpen(false);
      setWfActionType(null);
      setWfActionComment('');
    } finally {
      setWfActionSubmitting(false);
    }
  };

  const closeWfActionPopup = () => {
    if (wfActionSubmitting) return;
    setWfActionPopupOpen(false);
    setWfActionType(null);
    setWfActionComment('');
  };

  const uploadPrincipalDocument = async (file: File): Promise<boolean> => {
    if (!id) return false;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setIsLoading(true);
      const response = await authenticityUtility.postFile(`/finance-requests/${id}/principal-document`, formData) as any;
      if (response?.status !== 'success') {
        showAlert(response?.message || 'Failed to upload principal document', 'error');
        return false;
      }
      setHasPrincipalDocument(true);
      return true;
    } catch (error: any) {
      showAlert(error?.response?.data?.message || error?.message || 'Failed to upload principal document', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const closePrincipalApprovalPopup = () => {
    if (principalApprovalSubmitting) return;
    setPrincipalApprovalPopupOpen(false);
    setPrincipalApprovalFile(null);
  };

  const submitPrincipalApproval = async () => {
    if (principalApprovalSubmitting) return;
    if (!principalApprovalFile) {
      showAlert('Please select a PDF document to upload before approving.', 'warning');
      return;
    }

    setPrincipalApprovalSubmitting(true);
    try {
      const success = await uploadPrincipalDocument(principalApprovalFile);
      if (success) {
        await executeWorkflowAction('approved');
        setPrincipalApprovalPopupOpen(false);
        setPrincipalApprovalFile(null);
      }
    } finally {
      setPrincipalApprovalSubmitting(false);
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
      setDirectorComments('');
      setDirectorStatus('');
      setPrincipalComments('');
      setPrincipalStatus('');
      setPrincipalPriority('');
      setChairmanComments('');
      setChairmanStatus('');
      setBeneficiaryType('');
      setPrimaryHead('');
      setEventSubHead('');
      setDebitStatus('');
      setBalanceAmount('');
      setIsBudgetProposed('');
      setShowUnplannedBudget(false);
      setUnplannedBudgetAmount('');
      setUnplannedBudgetDescription('');
      setBudgetRows([{ category: '', head: '', amount: '' }]);
      setBudgetLineMetaByRow({});
      setAmountProposed("");
      setShowIncomeSection(false);
      setIncomeRows([createIncomeRow()]);
      setAnnexureType('');
      annexureFiles.forEach((row) => {
        if (row.previewUrl) {
          URL.revokeObjectURL(row.previewUrl);
        }
      });
      setAnnexureFiles([]);
      if (annexureFileInputRef.current) {
        annexureFileInputRef.current.value = '';
      }
      setSelectedTag('');
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

  const getSubcategoryLabel = (category: string) => {
    if (!category) return "Sub category";
    return category;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isApplicantCardOpen, setIsApplicantCardOpen] = useState(true);
  const [beneficiaryType, setBeneficiaryType] = useState<string>('');
  const [beneficiaryValue, setBeneficiaryValue] = useState<string>('');
  // Get subcategory options from the loaded data (dynamic from API) - SAME AS BUDGET.TSX
  // SAME AS BUDGET.TSX - Dynamic subcategory list from API
  // SAME AS BUDGET.TSX
  const subcategoryOptions: SelectOption[] = beneficiaryType ? subcategoryOptionsByType[beneficiaryType] || [] : [];
  const subcategoryList = subcategoryOptions.map(option => option.value);
  const hasSubcategories = subcategoryList.length > 0;

  const getBeneficiaryDisplayText = () => {
    const type = String(beneficiaryType || '').trim();
    const value = String(beneficiaryValue || '').trim();

    if (!type) return '\u00A0';
    if (!value) return type;
    if (type === 'Institution') return value;

    return `${type} - ${value}`;
  };


  const isMultipleSelect = (type: string) =>
    type === "Faculty" || type === "Staff";

  const [categorySelections, setCategorySelections] = useState<string[]>([]);

  const [primaryHead, setPrimaryHead] = useState<string>('');
  // eventSubHead: Shared sub-head for the entire request (appears for HOAC groups)
  const [eventSubHead, setEventSubHead] = useState<string>('');
  const MAX_AMOUNT = 999999999;
  const [selectedBudgetHeadForModal, setSelectedBudgetHeadForModal] = useState<string>('');
  const [showBudgetHeadModal, setShowBudgetHeadModal] = useState<boolean>(false);

  // Beneficiary search (for Faculty/Staff types)
  const [beneficiarySearchQuery, setBeneficiarySearchQuery] = useState<string>('');
  const [beneficiarySearchResults, setBeneficiarySearchResults] = useState<Array<{
    employeeid: number; name: string; designation: string; department: string;
  }>>([]);
  const [showBeneficiaryDropdown, setShowBeneficiaryDropdown] = useState(false);
  const [beneficiaryEmployeeId, setBeneficiaryEmployeeId] = useState<number | null>(null);

  // Tag
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [loadedWorkflowStatus, setLoadedWorkflowStatus] = useState<string>('');
  const [loadedCurrentStage, setLoadedCurrentStage] = useState<string>('');

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id && location.pathname.includes('edit'));
  const isViewMode = Boolean(id && !isEditMode);
  const isAdminWorkflowContext = new URLSearchParams(location.search).get('admin') === 'true';
  const isApprovalMode = isViewMode && isAdminWorkflowContext;

  const normalizedWorkflowStatus = String(
    loadedWorkflowStatus || ''
  ).toLowerCase();
  const hasDofApproval = statusUpdates.some((update: any) => {
    const stage = String(update?.stage || update?.role || '').toLowerCase();
    const decision = String(update?.decision || update?.status || '').toLowerCase();
    return stage.includes('dof') && (decision === 'approved' || decision.includes('approved'));
  });
  const canDownloadPdf =
    ['approved', 'completed'].includes(normalizedWorkflowStatus) ||
    (isAdminWorkflowContext && totalBudget > 10000 && hasDofApproval);

  const isSuperAdminUser = Boolean(user?.is_super_admin || (user as any)?.isSuperAdmin) || (
    Array.isArray(user?.roles) &&
    user.roles.some((role) => String(role || '').toLowerCase() === 'super_admin')
  );

  const routeStateIsActionablePending = (location.state as any)?.isActionablePending;
  const hideWorkflowActionsForFinalStatus =
    !isSuperAdminUser && (
      routeStateIsActionablePending === false ||
      normalizedWorkflowStatus.includes('approved') ||
      normalizedWorkflowStatus.includes('returned') ||
      normalizedWorkflowStatus.includes('completed') ||
      normalizedWorkflowStatus.includes('rejected') ||
      normalizedWorkflowStatus.includes('archived')
    );

  // Only allow the respective stage head to act (not super admin)
  const canActOnCurrentStage = (() => {
    if (!isViewMode || !loadedCurrentStage) return false;
    // Super admin cannot approve/reject — only the respective head can
    if (isSuperAdminUser) return false;
    const userPermissions = (user?.permissions || []).map(p => String(p).toLowerCase());
    return userPermissions.includes(`finance.workflow.${loadedCurrentStage}`);
  })();
  const canEditStageRemark =
    canActOnCurrentStage && ['dof', 'principal', 'chairman'].includes(loadedCurrentStage);

  // Tag auto-selection based on beneficiary type
  useEffect(() => {
    if (!beneficiaryType?.trim()) {
      setSelectedTag('');
      return;
    }

    setSelectedTag((prev) => {
      if (prev && prev.trim() !== '') {
        return prev;
      }

      if (beneficiaryType === 'Staff' || beneficiaryType === 'Faculty') {
        return 'Skilling';
      }
      if (beneficiaryType === 'Department') {
        return '';
      }
      if (beneficiaryType === 'Centre' || beneficiaryType === 'Cell' ||
        beneficiaryType === 'Club' || beneficiaryType === 'Section' || beneficiaryType === 'Institution' || beneficiaryType === 'Professional Body') {
        return 'Essentials';
      }
      return '';
    });
  }, [beneficiaryType]);

  useEffect(() => {
    if (!selectedTag) return;

    const resolvedTag = resolveTagValue(selectedTag, tagOptions);
    if (resolvedTag !== selectedTag) {
      setSelectedTag(resolvedTag);
    }
  }, [selectedTag, tagOptions]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const requestId = Number(id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return;
    }

    let cancelled = false;

    const loadFinanceRequest = async () => {
      try {
        setIsLoading(true);
        const response = await authenticityUtility.get(`/finance-requests/${requestId}`) as {
          status?: string;
          data?: any;
          message?: string;
        };

        if (response?.status !== 'success' || !response?.data || cancelled) {
          return;
        }

        const record = response.data;
        const currentStageFromRecord = String(
          record.workflow_state?.currentStage || record.workflow_stage || ''
        ).toLowerCase();
        const budgetRowsFromApi = Array.isArray(record.budget) ? record.budget : [];
        const incomeRowsFromApi = Array.isArray(record.income_rows) ? record.income_rows : [];
        const statusUpdatesFromApi = Array.isArray(record.status_updates) ? record.status_updates : [];

        const resolvedApplicantName = String(record.applicant_name || '').trim();
        setApplicantName(resolvedApplicantName);
        setApplicantSearchQuery(resolvedApplicantName);
        setDate(formatDateForInput(record.request_date));
        setDesignation(record.designation || '');
        setDepartment(record.department || '');
        setEmail(record.email || '');
        setMobile(record.mobile || '');
        setDescription(record.description || '');
        setProposalRef(record.proposal_ref || '');
        setEmployeeId(record.employee_id ? Number(record.employee_id) : null);
        setIsExternalApplicant(!record.employee_id);
        setSubmittedAt(
          String(
            record.workflow_state?.submittedAt ||
            record.workflow_state?.submitted_at ||
            record.workflow_state?.startedAt ||
            record.workflow_state?.started_at ||
            record.created_at ||
            record.submitted_at ||
            ''
          ).trim()
        );
        const workflowFinanceMeta = record.workflow_state?.financeMeta || {};
        const recordUnplannedBudgetEnabled =
          record.unplanned_budget_enabled ??
          workflowFinanceMeta.unplannedBudgetEnabled ??
          false;
        const recordUnplannedBudgetAmount =
          record.unplanned_budget_amount ??
          workflowFinanceMeta.unplannedBudgetAmount ??
          '';
        const hasUnplannedBudgetAmount =
          recordUnplannedBudgetAmount !== null &&
          recordUnplannedBudgetAmount !== undefined &&
          String(recordUnplannedBudgetAmount).trim() !== '' &&
          Number(recordUnplannedBudgetAmount) > 0;
        const recordUnplannedBudgetDescription =
          record.unplanned_budget_description ??
          workflowFinanceMeta.unplannedBudgetDescription ??
          '';
        setShowUnplannedBudget(Boolean(recordUnplannedBudgetEnabled || hasUnplannedBudgetAmount));
        setUnplannedBudgetAmount(
          recordUnplannedBudgetAmount !== null && recordUnplannedBudgetAmount !== undefined
            ? String(recordUnplannedBudgetAmount)
            : ''
        );
        setUnplannedBudgetDescription(String(recordUnplannedBudgetDescription || ''));
        setBeneficiaryType(record.beneficiary_type || '');
        setBeneficiaryValue(record.beneficiary_value || '');
        setPrimaryHead(record.primary_head || '');
        setEventSubHead(record.event_sub_head || '');
        setIsBudgetProposed(record.is_budget_proposed || 'No');
        setAmountProposed(record.proposed_amount !== null && record.proposed_amount !== undefined ? String(record.proposed_amount) : '');
        setBalanceAmount(record.balance_amount !== null && record.balance_amount !== undefined ? String(record.balance_amount) : '');
        setDebitStatus(record.debit_status || '');
        setSelectedTag(resolveTagValue(record.budget_tag, tagOptions));
        const annexuresFromApi = Array.isArray(record.annexures)
          ? record.annexures
          : [];
        const fallbackLegacyAnnexure = (record.annexure_file_path && record.annexure_storage_name)
          ? [{
            annexure_type: record.annexure_type || '',
            original_name: record.annexure_file_name || record.annexure_storage_name || '',
            stored_name: record.annexure_storage_name || '',
            file_path: record.annexure_file_path || '',
            mime_type: record.annexure_mime_type || '',
            file_size: record.annexure_file_size,
          }]
          : [];
        const effectiveAnnexures = annexuresFromApi.length ? annexuresFromApi : fallbackLegacyAnnexure;
        setAnnexureFiles((prev) => {
          prev.forEach((row) => {
            if (row.previewUrl) {
              URL.revokeObjectURL(row.previewUrl);
            }
          });
          return effectiveAnnexures.map((row: any, index: number) => ({
            id: `annexure-existing-${index}-${Date.now()}`,
            annexureType: String(row?.annexure_type || ''),
            file: null,
            previewUrl: '',
            originalName: String(row?.original_name || row?.annexure_file_name || row?.stored_name || row?.annexure_storage_name || ''),
            storedName: String(row?.stored_name || row?.annexure_storage_name || ''),
            filePath: String(row?.file_path || row?.annexure_file_path || ''),
            mimeType: String(row?.mime_type || row?.annexure_mime_type || ''),
            size: row?.file_size !== null && row?.file_size !== undefined ? Number(row.file_size) : null,
          }));
        });
        setAnnexureType(String((effectiveAnnexures[0] as any)?.annexure_type || ''));
        if (annexureFileInputRef.current) {
          annexureFileInputRef.current.value = '';
        }
        setLoadedWorkflowStatus(String(record.workflow_state?.status || record.workflow_status || record.overall_status || '').toLowerCase());
        setLoadedCurrentStage(String(record.workflow_state?.currentStage || record.workflow_stage || '').toLowerCase());
        setDirectorComments(String(record.director_comment || ''));
        setDirectorStatus(String(record.director_status || '').toLowerCase());
        setPrincipalComments(String(record.principal_comment || ''));
        setPrincipalStatus(String(record.principal_status || '').toLowerCase());
        setChairmanComments(String(record.chairman_comment || ''));
        setChairmanStatus(String(record.chairman_status || '').toLowerCase());
        if (currentStageFromRecord === 'dof') {
          setStageRemarkInput(String(record.director_comment || ''));
        } else if (currentStageFromRecord === 'principal') {
          setStageRemarkInput(String(record.principal_comment || ''));
        } else if (currentStageFromRecord === 'chairman') {
          setStageRemarkInput(String(record.chairman_comment || ''));
        } else {
          setStageRemarkInput('');
        }
        setCategorySelections(
          String(record.beneficiary_value || '')
            .split(',')
            .map((item: string) => item.trim())
            .filter(Boolean)
        );
        setShowIncomeSection(incomeRowsFromApi.length > 0);
        setBudgetRows(
          budgetRowsFromApi.length > 0
            ? budgetRowsFromApi.map((row: any) => ({
              category: String(row?.budget_head || ''),
              head: String(row?.sub_head || ''),
              amount: String(row?.amount ?? ''),
            }))
            : [{ category: '', head: '', amount: '' }]
        );
        setBudgetLineMetaByRow(
          budgetRowsFromApi.reduce((acc: Record<number, BudgetLineMeta>, row: any, index: number) => {
            acc[index] = {
              budgetLineId: row?.budget_line_id ? Number(row.budget_line_id) : null,
              budgetProposalId: row?.budget_proposal_id ? Number(row.budget_proposal_id) : null,
              availableAmount: Number(row?.available_amount_snapshot ?? 0),
            };
            return acc;
          }, {})
        );
        setIncomeRows(
          incomeRowsFromApi.length > 0
            ? incomeRowsFromApi.map((row: any, index: number) => ({
              id: row?.id ? String(row.id) : `${Date.now()}-${index}`,
              incomeSource: String(row?.income_source || ''),
              contribution: String(row?.contribution || ''),
              amount: String(row?.amount ?? ''),
              status: String(row?.status || ''),
              remarks: String(row?.remarks || ''),
              creditAccount: String(row?.credit_account || ''),
            }))
            : [createIncomeRow()]
        );
        setHasPrincipalDocument(Boolean(record.principal_document && record.principal_document.file_path));
        setStatusUpdates(statusUpdatesFromApi);
      } catch (error) {
        console.error('Failed to load finance request', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadFinanceRequest();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (id || applicantName || isExternalApplicant) {
      return;
    }

    let cancelled = false;

    const loadLoggedInApplicant = async () => {
      try {
        const response = await authenticityUtility.get('/finance-requests/me') as {
          status?: string;
          data?: {
            employee_id?: number | null;
            name?: string;
            designation?: string;
            department?: string;
            email?: string;
            mobile?: string;
          };
        };

        if (cancelled || response?.status !== 'success' || !response?.data) {
          return;
        }

        const data = response.data;
        const resolvedName = String(data.name || '').trim();
        if (!resolvedName) {
          return;
        }

        setEmployeeId(
          Number.isInteger(Number(data.employee_id)) && Number(data.employee_id) > 0
            ? Number(data.employee_id)
            : null
        );
        setApplicantName(resolvedName);
        setApplicantSearchQuery(resolvedName);
        setDesignation(String(data.designation || ''));
        setDepartment(String(data.department || ''));
        setEmail(String(data.email || ''));
        setMobile(String(data.mobile || ''));
      } catch (error) {
        console.error('Failed to auto-fill finance applicant details', error);
      }
    };

    loadLoggedInApplicant();

    return () => {
      cancelled = true;
    };
  }, [id, applicantName, isExternalApplicant]);

  useEffect(() => {
    setIsApplicantCardOpen(!id);
  }, [id]);

  const handleBeneficiarySearch = async (query: string) => {
    setBeneficiarySearchQuery(query);
    try {
      let typeParam = '';
      if (beneficiaryType === 'Faculty') typeParam = '&type=Teaching';
      else if (beneficiaryType === 'Staff') typeParam = '&type=Non-Teaching';
      const response = await (authenticityUtility as any).get(
        `finance-requests/search-applicant?q=${encodeURIComponent(query)}${typeParam}`
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
    setBeneficiaryValue(emp.name.trim());
    setBeneficiaryEmployeeId(emp.employeeid);
    setBeneficiarySearchQuery(emp.name.trim());
    setShowBeneficiaryDropdown(false);
  };

  useEffect(() => {
    if (showPreview && componentRef.current) {
      const contentHeight = componentRef.current.scrollHeight;
      const pageHeight = 270;
      setTotalPages(Math.ceil(contentHeight / pageHeight));
    }
  }, [showPreview, applicantName, department, totalBudget]);

  useEffect(() => {
    const routeState = location.state as { openPreview?: boolean; autoDownloadPdf?: boolean; isActionablePending?: boolean } | null;
    if (!routeState) {
      setShowPreview(false);
      setAutoDownloadPdf(false);
      return;
    }

    if (routeState.openPreview) {
      setShowPreview(true);
    }

    setAutoDownloadPdf(Boolean(routeState.autoDownloadPdf));
  }, [location.state]);

  useEffect(() => {
    autoDownloadTriggeredRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!autoDownloadPdf || autoDownloadTriggeredRef.current) {
      return;
    }

    if (isLoading || !showPreview || !canDownloadPdf) {
      return;
    }

    autoDownloadTriggeredRef.current = true;
    void generatePDF();
    // Intentionally excluding generatePDF from deps to avoid re-running this effect
    // on every render due function identity churn; guards above keep it safe.
  }, [autoDownloadPdf, canDownloadPdf, isLoading, showPreview]);

  const activeHoacGroup = getHoacGroupForHead(primaryHead) || '';
  const extraDropdownVisible = Boolean(activeHoacGroup);
  const hoacSubheadDropdownOptions = useMemo(() => {
    if (!activeHoacGroup) return [];
    const firstLevelSubHeads = SUB_HEAD_BY_BUDGET_HEAD[primaryHead] || [];
    if (firstLevelSubHeads.length > 0) {
      return toOptions(firstLevelSubHeads);
    }
    const groupSubHeads = HOAC_SUBHEAD_OPTIONS[activeHoacGroup] || [];
    return toOptions(groupSubHeads);
  }, [primaryHead, activeHoacGroup]);
  useEffect(() => {
    const nextFetchKeys: Record<number, string> = {};
    const normalizedBeneficiaryType = normalizeText(beneficiaryType);
    const normalizedBeneficiaryValue = normalizeText(beneficiaryValue);
    const normalizedFinanceId = isEditMode && id ? String(id) : '';

    budgetRows.forEach((row, index) => {
      const normalizedHead = normalizeText(primaryHead) || normalizeText(row.category);
      const rowSubHead = normalizeText(row.head);
      const effectiveSubHead = (extraDropdownVisible ? normalizeText(eventSubHead) : '') || rowSubHead;
      const headOnlyMatch = shouldUseHeadOnlyAvailabilityMatch(normalizedHead, effectiveSubHead);

      if (!normalizedHead || (!headOnlyMatch && !effectiveSubHead)) {
        return;
      }

      const fetchKey = [
        normalizedHead,
        effectiveSubHead,
        headOnlyMatch ? '1' : '0',
        normalizedBeneficiaryType,
        normalizedBeneficiaryValue,
        normalizedFinanceId,
      ].join('|');
      nextFetchKeys[index] = fetchKey;
      if (availabilityFetchKeyByRowRef.current[index] === fetchKey) {
        return;
      }

      fetchBudgetAvailability(index, normalizedHead, rowSubHead);
    });

    availabilityFetchKeyByRowRef.current = nextFetchKeys;
  }, [budgetRows, primaryHead, eventSubHead, extraDropdownVisible, beneficiaryType, beneficiaryValue, isEditMode, id]);
  const firstBudgetRowAutoSyncRef = useRef<{ category: string; head: string }>({ category: '', head: '' });
  useEffect(() => {
    if (!primaryHead) return;

    const nextCategory = normalizeText(primaryHead);

    setBudgetRows((rows) => {
      if (rows.length === 0) return rows;

      const firstRow = rows[0];
      const lastAutoSync = firstBudgetRowAutoSyncRef.current;
      const firstRowMatchesLastSync =
        normalizeText(firstRow.category) === normalizeText(lastAutoSync.category) &&
        normalizeText(firstRow.head) === normalizeText(lastAutoSync.head);

      const shouldAutoFill =
        firstRowMatchesLastSync ||
        !normalizeText(firstRow.category) ||
        !normalizeText(firstRow.head);

      if (!shouldAutoFill) return rows;

      // Only auto-sync the budget head (category); leave sub head for the
      // user to pick from the HOAC sub-head options in the table dropdown.
      firstBudgetRowAutoSyncRef.current = { category: nextCategory, head: firstRow.head || '' };

      return rows.map((row, index) =>
        index === 0
          ? {
            ...row,
            category: nextCategory,
          }
          : row
      );
    });
  }, [primaryHead, eventSubHead]);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedHead, setExpandedHead] = useState<string>('');
  const [activeSubHead, setActiveSubHead] = useState<string>('');
  const stageRemarksForDisplay = [
    { label: 'DOF', status: directorStatus, remarks: directorComments },
    { label: 'Principal', status: principalStatus, remarks: principalComments },
    { label: 'Chairman', status: chairmanStatus, remarks: chairmanComments },
  ].filter((entry) => {
    const labelToStageMap: Record<string, string> = {
      dof: 'dof',
      principal: 'principal',
      chairman: 'chairman',
    };
    const entryStage = labelToStageMap[String(entry.label || '').toLowerCase()] || '';
    if (canEditStageRemark && entryStage === loadedCurrentStage) {
      return true;
    }
    return hasFilledText(entry.status) || hasFilledText(entry.remarks);
  });

  return (
    <div className="finance-approval-body" style={{ padding: '0', backgroundColor: '#f0f6ff', minHeight: '100vh' }}>

      {!showPreview && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 30px' }}>
          <div style={isViewMode ? { pointerEvents: 'none', userSelect: 'none' } : undefined}>
            {/* Applicant Details Section */}
            <div style={{
              backgroundColor: '#fff',
              padding: '24px',
              marginBottom: '30px',
              marginTop: '30px',
              borderRadius: '18px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
              pointerEvents: 'auto',
              userSelect: 'auto',
            }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '0 0 15px 0',
                  borderBottom: '1px solid #e0e0e0',
                }}
                onClick={() => setIsApplicantCardOpen((prev) => !prev)}
              >
                <h5 style={{ margin: 0, fontSize: '16px', color: '#0069ab', fontWeight: 600 }}>
                  Applicant Details
                </h5>
                <svg
                  width="12"
                  height="8"
                  viewBox="0 0 12 8"
                  style={{
                    transform: isApplicantCardOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                  }}
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

              <div style={{ paddingTop: '20px' }}>
                {!isApplicantCardOpen && (
                  <div className="row">
                    <div className="col-md-7">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: 600, display: 'block' }}>
                          Applicant Name
                        </label>
                        <input
                          type="text"
                          value={applicantName}
                          disabled
                          readOnly
                          style={{
                            borderRadius: '12px',
                            border: '1px solid #e0e0e0',
                            padding: '10px 15px',
                            fontSize: '0.95rem',
                            width: '100%',
                            fontFamily: 'inherit',
                            backgroundColor: '#fcfdff',
                            cursor: 'pointer',
                          }}
                          onClick={() => setIsApplicantCardOpen(true)}
                        />
                      </div>
                    </div>
                    <div className="col-md-5">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: 600, display: 'block' }}>
                          Date
                        </label>
                        <input
                          type="date"
                          value={date}
                          disabled
                          readOnly
                          style={{
                            borderRadius: '12px',
                            border: '1px solid #e0e0e0',
                            padding: '10px 15px',
                            fontSize: '0.95rem',
                            width: '100%',
                            fontFamily: 'inherit',
                            backgroundColor: '#fcfdff',
                            cursor: 'pointer',
                          }}
                          onClick={() => setIsApplicantCardOpen(true)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isApplicantCardOpen && (
                  <>
                    <div className="row mb-3" style={{ marginBottom: '15px' }}>
                      <div className="col-md-7">
                        <div className="form-group" style={{ position: 'relative' }}>
                          <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                            Applicant Name
                            {isExternalApplicant && <span style={{ fontSize: '12px', color: '#6c757d', marginLeft: '8px' }}>(External)</span>}
                          </label>
                          <CustomInput
                            name="applicantName"
                            type="text"
                            value={isViewMode ? applicantName : (isExternalApplicant ? applicantName : applicantSearchQuery)}
                            readOnly={isViewMode}
                            onChange={(value) => {
                              if (isViewMode) return;
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
                          {!isViewMode && showApplicantDropdown && applicantSearchResults.length > 0 && (
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
                          {!isViewMode && showApplicantDropdown && applicantSearchQuery.length >= 2 && applicantSearchResults.length === 0 && (
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
                            Date
                          </label>
                          <input
                            type="date"
                            value={date}
                            disabled={isViewMode}
                            readOnly={isViewMode}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              if (isViewMode) return;
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
                            disabled={isViewMode}
                            readOnly={isViewMode}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              if (isViewMode) return;
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
                            disabled={isViewMode}
                            readOnly={isViewMode}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              if (isViewMode) return;
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
                          <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                            Email
                          </label>
                          <input
                            type="email"
                            value={email}
                            disabled={isViewMode}
                            readOnly={isViewMode}
                            onChange={(e) => {
                              if (isViewMode) return;
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
                            placeholder="example@email.com"
                          />
                        </div>
                      </div>
                      <div className="col-md-5">
                        <div className="form-group">
                          <label style={{ fontSize: '14px', color: '#495057', marginBottom: '6px', fontWeight: '600', display: 'block' }}>Mobile</label>
                          <input
                            type="tel"
                            value={mobile}
                            disabled={isViewMode}
                            readOnly={isViewMode}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              if (isViewMode) return;
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
                  </>
                )}
              </div>
            </div>

            {/* Beneficiary Section */}
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
                    <div className="row mb-3" style={{ alignItems: 'flex-start' }}>
                      <div className="col-md-3">
                        <div className="form-group">
                          <label style={{ fontSize: 14, color: '#495057', marginBottom: 8, fontWeight: 600, display: 'block' }}>
                            Beneficiary
                          </label>
                          <CustomDropdown
                            name="beneficiaryType"
                            options={[
                              { value: 'Faculty', label: 'Faculty' },
                              { value: 'Staff', label: 'Staff' },
                              { value: 'Department', label: 'Department' },
                              { value: 'Centre', label: 'Centre' },
                              { value: 'Cell', label: 'Cell' },
                              { value: 'Club', label: 'Club' },
                              { value: 'Section', label: 'Section' },
                              { value: 'Professional Body', label: 'Professional Body' },
                              { value: 'Institution', label: 'Institution' }
                            ]}
                            value={beneficiaryType ? { value: beneficiaryType, label: beneficiaryType } : null}
                            onChange={(option) => {
                              const selected = option as OptionType | null;
                              const next = selected?.value ? String(selected.value) : '';
                              setBeneficiaryType(next);
                              setBeneficiaryValue('');
                              setBeneficiaryEmployeeId(null);
                              setBeneficiarySearchQuery('');
                              setBeneficiarySearchResults([]);
                              setShowBeneficiaryDropdown(false);
                              setSelectedTag('');
                              if (next === 'Institution') setBeneficiaryValue('K.S.Rangasamy College of Technology');
                            }}
                          />
                        </div>
                      </div>

                      <div className="col-md-6">
                        {/* Faculty / Staff */}
                        {['Faculty', 'Staff'].includes(beneficiaryType) && (
                          <div className="form-group" style={{ position: 'relative' }}>
                            <label style={{ fontSize: 14, color: '#495057', marginBottom: '8px', fontWeight: 600, display: 'block' }}>
                              {beneficiaryType === 'Staff' ? 'Staff Name' : 'Faculty Name'}
                            </label>
                            <input
                              type="text"
                              value={beneficiarySearchQuery || beneficiaryValue}
                              onChange={(e) => {
                                setBeneficiaryValue(e.target.value);
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
                              placeholder={beneficiaryType === 'Staff' ? "Search staff by name or ERP ID" : "Search faculty by name or ERP ID"}
                              style={{
                                borderRadius: '12px',
                                border: '1px solid #e0e0e0',
                                padding: '8px 14px',
                                fontSize: '0.95rem',
                                width: '100%',
                                backgroundColor: '#fcfdff',
                                outline: 'none'
                              }}
                              required
                            />
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

                        {/* Institution */}
                        {beneficiaryType === 'Institution' && (
                          <div className="form-group">
                            <label style={{ fontSize: 14, color: '#495057', marginBottom: '8px', fontWeight: 600, display: 'block' }}>Institution</label>
                            <input type="text" value="K.S.Rangasamy College of Technology" readOnly
                              style={{ borderRadius: 12, border: '1px solid #e0e0e0', padding: '10px 15px', fontSize: '0.95rem', width: '100%', backgroundColor: '#e9ecef', color: '#495057', cursor: 'not-allowed', outline: 'none' }} />
                          </div>
                        )}

                        {/* Professional Body */}
                        {beneficiaryType === 'Professional Body' && (
                          <div className="form-group">
                            <label style={{ fontSize: 14, color: '#495057', marginBottom: 8, fontWeight: 600, display: 'block' }}>
                              Professional Body
                            </label>
                            <CustomDropdown
                              name="professionalBody"
                              options={subcategoryOptionsByType['Professional Body'] || []}
                              value={getSelectedOption(beneficiaryValue, subcategoryOptionsByType['Professional Body'] || [])}
                              onChange={(option) => {
                                const selected = option as OptionType | null;
                                setBeneficiaryValue(selected?.value ? String(selected.value) : '');
                                setCategorySelections([]);
                              }}
                              placeholder="Select Professional Body"
                            />
                          </div>
                        )}

                        {/* Department / Centre / Cell / Club */}
                        {hasSubcategories && !['Faculty', 'Staff', 'Institution', 'Professional Body'].includes(beneficiaryType) && (
                          <div className="form-group">
                            <label style={{ fontSize: 14, color: '#495057', marginBottom: 8, fontWeight: 600, display: 'block' }}>
                              {getSubcategoryLabel(beneficiaryType)}
                            </label>
                            {isMultipleSelect(beneficiaryType) ? (
                              <CustomTagInput
                                name="categorySelections"
                                value={categorySelections}
                                onChange={(tags) => { setCategorySelections(tags); setBeneficiaryValue(tags.join(', ')); }}
                                suggestions={subcategoryList.filter((sub) => !categorySelections.includes(sub))}
                                placeholder=""
                                disabled={false}
                                className="mb-0"
                              />
                            ) : (
                              <CustomDropdown
                                name="beneficiaryValue"
                                options={subcategoryOptions}
                                value={getSelectedOption(beneficiaryValue, subcategoryOptions)}
                                onChange={(option) => {
                                  const selected = option as OptionType | null;
                                  setBeneficiaryValue(selected?.value ? String(selected.value) : '');
                                  setCategorySelections([]);
                                }}
                                placeholder="Select"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="col-md-3">
                        {beneficiaryType && (
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

            {/* Budget Table Section */}
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
                <div className="col-md-12">
                  <div className="form-group hoac-form-group">
                    <label
                      style={{
                        fontSize: '14px',
                        color: '#495057',
                        marginBottom: '4px',
                        fontWeight: 600,
                        display: 'block',
                      }}
                    >
                      Head of Accounts
                    </label>

                    {extraDropdownVisible ? (
                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                          <CustomDropdown
                            name="primaryHead"
                            options={PRIMARY_HEAD_OPTIONS}
                            value={getSelectedOption(primaryHead, PRIMARY_HEAD_OPTIONS)}
                            onChange={(option) => {
                              const selected = option as OptionType | null;
                              setPrimaryHead(selected?.value ? String(selected.value) : '');
                              setEventSubHead('');
                              setEventSubHeadError('');
                            }}
                            placeholder="Select Primary Head"
                          />
                        </div>

                        <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                          <CustomDropdown
                            // SHARED EVENT/MEETING SUB-HEAD DROPDOWN (Extra Dropdown)
                            name="eventSubHead"
                            options={hoacSubheadDropdownOptions}
                            value={getSelectedOption(eventSubHead, hoacSubheadDropdownOptions)}
                            onChange={(option) => {
                              const selected = option as OptionType | null;
                              setEventSubHead(selected?.value ? String(selected.value) : '');
                              setEventSubHeadError('');
                            }}
                            placeholder="Select Sub Head"
                            error={eventSubHeadError}
                          />
                        </div>

                        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '14px', color: '#495057', fontWeight: 600 }}>Unplanned Budget</span>
                          <CustomToggle
                            name="unplannedBudgetToggle"
                            label=""
                            checked={showUnplannedBudget}
                            onChange={(checked) => setShowUnplannedBudget(checked)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                          <CustomDropdown
                            name="primaryHead"
                            options={PRIMARY_HEAD_OPTIONS}
                            value={getSelectedOption(primaryHead, PRIMARY_HEAD_OPTIONS)}
                            onChange={(option) => {
                              const selected = option as OptionType | null;
                              setPrimaryHead(selected?.value ? String(selected.value) : '');
                              setEventSubHead('');
                              setEventSubHeadError('');
                            }}
                            placeholder="Select Primary Head"
                          />
                        </div>
                        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '14px', color: '#495057', fontWeight: 600 }}>Unplanned Budget</span>
                          <CustomToggle
                            name="unplannedBudgetToggle"
                            label=""
                            checked={showUnplannedBudget}
                            onChange={(checked) => setShowUnplannedBudget(checked)}
                          />
                        </div>
                      </div>
                    )}

                    <SearchBudgetModal
                      show={showSearchModal}
                      searchTerm={searchTerm}
                      expandedHead={expandedHead}
                      activeSubHead={activeSubHead}
                      onClose={() => setShowSearchModal(false)}
                      onSearchTermChange={setSearchTerm}
                      onExpandedHeadChange={setExpandedHead}
                      onActiveSubHeadChange={setActiveSubHead}
                      onSelectHead={(head) => {
                        setPrimaryHead(head);
                        setShowSearchModal(false);
                      }}
                      onSelectSubHead={(head, subhead) => {
                        setPrimaryHead(head);
                        setEventSubHead(subhead);
                        setShowSearchModal(false);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'visible' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f6ff' }}>
                      <th style={{ width: '6%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>S.No</th>
                      <th style={{ width: '30%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Budget Head</th>
                      <th style={{ width: '30%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Sub Head</th>
                      <th style={{ width: '15%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Amount</th>
                      <th style={{ width: '10%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetRows.map((row, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #e0e0e0', opacity: primaryHead ? 1 : 0.6 }}>
                        <td style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'center', color: '#495057' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                          <CustomDropdown
                            name={`budgetHead-${index}`}
                            options={BUDGET_HEAD_SEARCH_OPTIONS}
                            value={row.category ? {
                              value: `head::${row.category}`,
                              label: row.category,
                              budgetHead: row.category,
                              subHead: row.head || '',
                              optionType: 'budget-head',
                            } : null}
                            onChange={(option) => {
                              handleBudgetHeadSelection(index, option as OptionType | null);
                            }}
                            filterOption={(candidate: any, input: string) => {
                              const option = (candidate?.data || {}) as BudgetHeadSearchOption;
                              const query = normalizeText(input).toLowerCase();
                              const budgetHead = normalizeText(option.budgetHead).toLowerCase();
                              const subHead = normalizeText(option.subHead).toLowerCase();

                              if (!query) {
                                return option.optionType === 'budget-head';
                              }

                              if (option.optionType === 'head-sub-head') {
                                return subHead.includes(query) || budgetHead.includes(query);
                              }

                              return budgetHead.includes(query);
                            }}
                            placeholder="Select"
                            isDisabled={!primaryHead}
                          />
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                          <CustomDropdown
                            // ROW-LEVEL BUDGET SUB-HEAD DROPDOWN
                            name={`subHead-${index}`}
                            options={getSubHeadDropdownOptions(row.category)}
                            value={
                              getSelectedOption(row.head, getSubHeadDropdownOptions(row.category))
                              || (row.head ? { value: row.head, label: getSubHeadDisplayText(row.head) } : null)
                            }
                            onChange={(option) => {
                              const selected = option as OptionType | null;
                              handleBudgetChange(index, 'head', selected?.value ? String(selected.value) : '');
                            }}
                            placeholder="Select"
                            isDisabled={!row.category || !primaryHead}
                          />
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                          <input
                            type="text"
                            value={row.amount}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleBudgetChange(index, 'amount', e.target.value)}
                            disabled={!primaryHead}
                            placeholder={`₹  ${getRemainingAvailableForRow(index)}`}
                            style={{
                              border: '1px solid #e0e0e0',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '0.9rem',
                              width: '120px',
                              fontFamily: 'inherit',
                              backgroundColor: primaryHead ? '#fcfdff' : '#f8f9fa',
                              color: primaryHead ? '#000' : '#6c757d',
                              cursor: primaryHead ? 'pointer' : 'not-allowed',
                              outline: 'none',
                              textAlign: 'left',
                              margin: '0 auto',
                              display: 'block'
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
                        <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '10px'
                          }}>
                            {(index > 0 || (index === 0 && budgetRows.length > 1)) && (
                              <button
                                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                  e.preventDefault();
                                  handleDeleteRow(index);
                                }}
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: '#ffe6e6',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '18px',
                                  transition: 'all 0.15s ease',
                                  color: '#dc3545'
                                }}
                                title="Delete Row"
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.background = '#ffcccc';
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.background = '#ffe6e6';
                                }}
                              >
                                ×
                              </button>
                            )}
                            {index === budgetRows.length - 1 && (
                              <button
                                type="button"
                                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                  e.preventDefault();
                                  handleAddRow();
                                }}
                                disabled={!isBudgetRowReadyForAdd(index)}
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: '#f5f6f8',
                                  cursor: isBudgetRowReadyForAdd(index) ? 'pointer' : 'not-allowed',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '18px',
                                  transition: 'all 0.15s ease',
                                  opacity: isBudgetRowReadyForAdd(index) ? 1 : 0.5,
                                  color: '#0069ab'
                                }}
                                title={getBudgetAddTooltip(index)}
                                onMouseEnter={(e) => {
                                  if (isBudgetRowReadyForAdd(index)) {
                                    (e.currentTarget as HTMLButtonElement).style.background = '#e8f5e9';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.background = '#f5f6f8';
                                }}
                              >
                                +
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {hasUnplannedBudgetPreview && (
                      <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td colSpan={2} style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'center', fontWeight: '600', color: '#0069ab', backgroundColor: '#fafcff' }}>
                          Unplanned Budget
                        </td>
                        <td colSpan={1} style={{ padding: '12px', border: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
                          <input
                            type="text"
                            value={unplannedBudgetDescription}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setUnplannedBudgetDescription(e.target.value)}
                            placeholder="Enter unplanned budget description"
                            style={{
                              border: '1px solid #e0e0e0',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '0.9rem',
                              width: '100%',
                              fontFamily: 'inherit',
                              backgroundColor: '#fcfdff',
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
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
                          <input
                            type="text"
                            value={unplannedBudgetAmount}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              setUnplannedBudgetAmount(e.target.value.replace(/\D/g, ""))
                            }
                            placeholder="₹  0"
                            style={{
                              border: '1px solid #e0e0e0',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '0.9rem',
                              width: '120px',
                              fontFamily: 'inherit',
                              backgroundColor: '#fcfdff',
                              color: '#000',
                              cursor: 'pointer',
                              outline: 'none',
                              textAlign: 'left',
                              margin: '0 auto',
                              display: 'block',
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
                        <td style={{ border: '1px solid #e0e0e0', backgroundColor: '#fafcff' }} />
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f0f6ff' }}>
                      <td colSpan={3} style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'right', paddingRight: '15px', fontWeight: '600', color: '#0069ab' }}>
                        Total Budget
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', fontWeight: '600', color: '#0069ab', textAlign: 'center' }}>
                        ₹ {totalBudget}
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
                  <span style={{ fontWeight: 600 }}>
                    {numberToIndianWords(totalBudget)
                      .replace(/\b\w/g, l => l.toUpperCase())
                      .replace(/[^\s][A-Z]/g, l => l.toLowerCase())
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Income Section */}
            <div
              style={{
                backgroundColor: '#fff',
                padding: '30px',
                borderRadius: '20px',
                marginBottom: '20px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div className="row mt-3">
                <div className="col-md-12">
                  <div className="form-group">
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "20px",
                        }}
                      >
                        <span style={{ fontSize: "16px", color: "#495057", fontWeight: 600 }}>
                          Income
                        </span>
                        <CustomToggle
                          name="incomeToggle"
                          checked={showIncomeSection}
                          onChange={(checked) => setShowIncomeSection(checked)}
                        />
                      </div>
                      <div
                        style={{
                          height: "2px",
                          backgroundColor: "#e0e0e0",
                          marginBottom: "20px",
                        }}
                      />
                    </div>
                    {showIncomeSection && (
                      <>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f0f6ff' }}>
                              <th style={{ width: '6%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>S.No</th>
                              <th style={{ width: '28%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Income Source</th>
                              <th style={{ width: '10%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Amount</th>
                              <th style={{ width: '20%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Status</th>
                              <th style={{ width: '26%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Remarks</th>
                              <th style={{ width: '15%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {incomeRows.map((row, index) => {
                              const isLastRow = index === incomeRows.length - 1;

                              return (
                                <React.Fragment key={row.id}>
                                  {/* First Row - Income Details */}
                                  <tr>
                                    <td style={incomeCellStyle}>{index + 1}</td>

                                    <td style={incomeCellStyle}>
                                      <CustomDropdown
                                        name={`incomeSource-${row.id}`}
                                        options={toOptions(INCOME_SOURCE_OPTIONS)}
                                        value={getSelectedOption(row.incomeSource, toOptions(INCOME_SOURCE_OPTIONS))}
                                        onChange={(option) => {
                                          const selected = option as OptionType | null;
                                          handleIncomeRowChange(row.id, "incomeSource", selected?.value ? String(selected.value) : "");
                                        }}
                                        placeholder="Select"
                                      />
                                    </td>
                                    <td style={incomeCellStyle}>
                                      <input
                                        type="text"
                                        value={row.amount}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                          handleIncomeRowChange(row.id, "amount", e.target.value.replace(/\D/g, ""))
                                        }
                                        placeholder="₹  0"
                                        min="0"
                                        step="0"
                                        style={{
                                          border: '1px solid #e0e0e0',
                                          borderRadius: '8px',
                                          padding: '6px 8px',
                                          fontSize: '0.9rem',
                                          width: '100%',
                                          fontFamily: 'inherit',
                                          backgroundColor: '#fcfdff',
                                          color: '#000',
                                          cursor: 'pointer',
                                          outline: 'none',
                                          marginTop: '2px'
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
                                    <td style={incomeCellStyle}>
                                      <CustomDropdown
                                        name={`status-${row.id}`}
                                        options={toOptions(STATUS_OPTIONS)}
                                        value={getSelectedOption(row.status, toOptions(STATUS_OPTIONS))}
                                        onChange={(option) => {
                                          const selected = option as OptionType | null;
                                          handleIncomeRowChange(row.id, "status", selected?.value ? String(selected.value) : "");
                                        }}
                                        placeholder="Select"
                                      />
                                    </td>
                                    <td style={incomeCellStyle}>
                                      <input
                                        type="text"
                                        value={row.remarks}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                          handleIncomeRowChange(row.id, "remarks", e.target.value)
                                        }
                                        placeholder="Enter remarks"
                                        style={{
                                          border: '1px solid #e0e0e0',
                                          borderRadius: '8px',
                                          padding: '6px 8px',
                                          fontSize: '0.9rem',
                                          width: '100%',
                                          fontFamily: 'inherit',
                                          backgroundColor: '#fcfdff',
                                          color: '#000',
                                          cursor: 'text',
                                          outline: 'none',
                                          marginTop: '2px'
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
                                    {/* Action cell with vertical centering spanning both rows */}
                                    <td rowSpan={2} style={{
                                      padding: '8px',
                                      border: '1px solid #e0e0e0',
                                      textAlign: 'center',
                                      verticalAlign: 'middle',
                                      backgroundColor: '#fff',
                                    }}>
                                      <div style={actionCell}>
                                        {(index > 0 || (index === 0 && incomeRows.length > 1)) && (
                                          <button
                                            type="button"
                                            onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                              e.preventDefault();
                                              handleDeleteIncomeRow(row.id);
                                            }}
                                            style={deleteIconBtn}
                                            title="Delete Row"
                                            className="btn-sm"
                                            onMouseEnter={(e) => {
                                              (e.currentTarget as HTMLButtonElement).style.background = '#ffcccc';
                                            }}
                                            onMouseLeave={(e) => {
                                              (e.currentTarget as HTMLButtonElement).style.background = '#ffe6e6';
                                            }}
                                          >
                                            ×
                                          </button>
                                        )}
                                        {isLastRow && (
                                          <button
                                            type="button"
                                            onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                              e.preventDefault();
                                              handleAddIncomeRow();
                                            }}
                                            disabled={!isIncomeRowReadyForAdd(row)}
                                            style={{
                                              width: '36px',
                                              height: '36px',
                                              borderRadius: '50%',
                                              border: 'none',
                                              background: '#f5f6f8',
                                              cursor: isIncomeRowReadyForAdd(row) ? 'pointer' : 'not-allowed',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '18px',
                                              transition: 'all 0.15s ease',
                                              color: '#0069ab',
                                              opacity: isIncomeRowReadyForAdd(row) ? 1 : 0.5,
                                            }}
                                            title={getIncomeAddTooltip(row, index)}
                                            className="btn-sm"
                                            onMouseEnter={(e) => {
                                              if (isIncomeRowReadyForAdd(row)) {
                                                (e.currentTarget as HTMLButtonElement).style.background = '#e8f5e9';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              (e.currentTarget as HTMLButtonElement).style.background = '#f5f6f8';
                                            }}
                                          >
                                            +
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  {/* Second Row - Credit Account (Reduced width) */}
                                  <tr>
                                    <td
                                      style={{
                                        border: '1px solid #e0e0e0',
                                        backgroundColor: '#fafcff',
                                      }}
                                    />
                                    <td
                                      colSpan={1}
                                      style={{
                                        padding: '8px 12px',
                                        border: '1px solid #e0e0e0',
                                        backgroundColor: '#ffffff',
                                        verticalAlign: 'middle',
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '16px',
                                          flexWrap: 'nowrap',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        <span style={{ fontWeight: 600, color: '#0069ab' }}>Contribution</span>
                                        {CONTRIBUTION_OPTIONS.map((option) => (
                                          <label
                                            key={option}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              fontSize: '0.9rem',
                                              color: '#495057',
                                              fontWeight: 500,
                                              cursor: 'pointer',
                                              marginBottom: 0,
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            <input
                                              type="radio"
                                              name={`contribution-${row.id}`}
                                              value={option}
                                              checked={row.contribution === option}
                                              onChange={() => handleIncomeRowChange(row.id, 'contribution', option)}
                                              style={{ accentColor: '#0069ab' }}
                                            />
                                            <span>{option}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </td>
                                    <td
                                      colSpan={3}
                                      style={{
                                        padding: '8px 12px',
                                        border: '1px solid #e0e0e0',
                                        backgroundColor: '#ffffff',
                                        verticalAlign: 'middle',
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
                                            fontWeight: 600,
                                            color: '#0069ab',
                                            minWidth: '120px',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          Credit Account
                                        </span>

                                        <div style={{ flex: 1 }}>
                                          <CustomDropdown
                                            name={`creditAccount-${row.id}`}
                                            options={toOptions(CREDIT_ACCOUNT_OPTIONS)}
                                            value={getSelectedOption(row.creditAccount, toOptions(CREDIT_ACCOUNT_OPTIONS))}
                                            onChange={(option) => {
                                              const selected = option as OptionType | null;
                                              handleIncomeRowChange(row.id, "creditAccount", selected?.value ? String(selected.value) : "");
                                            }}
                                            placeholder="Select"
                                          />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: '#f0f6ff' }}>
                              <td colSpan={2} style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'right', paddingRight: '15px', fontWeight: '600', color: '#0069ab' }}>Total Income</td>
                              <td style={{ padding: '12px', border: '1px solid #e0e0e0', fontWeight: '600', color: '#0069ab', textAlign: 'center' }}>
                                ₹ {incomeRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)}
                              </td>
                              <td colSpan={3} style={{ border: '1px solid #e0e0e0' }}></td>
                            </tr>
                          </tfoot>
                        </table>

                        {/* Rupees in words */}
                        <div style={{ marginTop: "10px", padding: "10px 14px", borderRadius: "10px", backgroundColor: "#f0f6ff", border: "1px solid #cfe2ff", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontSize: "0.9rem", color: "#0b3d75", textAlign: "center", width: "100%" }}>
                          <span style={{ fontWeight: 600 }}>Rupees (in words):</span>
                          <span style={{ fontWeight: 600 }}>
                            {numberToIndianWords(incomeRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)).replace(/\b\w/g, l => l.toUpperCase()).replace(/[^\s][A-Z]/g, l => l.toLowerCase())}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '20px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e0e0e0',
            }}
          >
            <div className="row mt-3">
              <div className="col-md-12">
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
                    <span style={{ fontSize: '16px', color: '#495057', fontWeight: 600 }}>
                      Annexure
                    </span>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="form-group mb-0">

                        <CustomDropdown
                          name="annexureType"
                          options={toOptions(ANNEXURE_TYPE_OPTIONS)}
                          value={getSelectedOption(annexureType, toOptions(ANNEXURE_TYPE_OPTIONS))}
                          isDisabled={isViewMode}
                          onChange={(option) => {
                            const selected = option as OptionType | null;
                            setAnnexureType(selected?.value ? String(selected.value) : '');
                          }}
                          placeholder="Select"
                        />
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="form-group mb-0">

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                          <input
                            ref={annexureFileInputRef}
                            id="annexure-file-input"
                            type="file"
                            accept="application/pdf,.pdf"
                            multiple
                            style={{ display: 'none' }}
                            disabled={isViewMode || String(annexureType || '').trim() === 'Not Applicable'}
                            onChange={handleAnnexureFileChange}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!isViewMode && String(annexureType || '').trim() !== 'Not Applicable' && hasFilledText(annexureType)) {
                                annexureFileInputRef.current?.click();
                              }
                            }}
                            style={{
                              ...annexureUploadButtonStyle,
                              opacity: (!isViewMode && hasFilledText(annexureType) && String(annexureType || '').trim() !== 'Not Applicable') ? 1 : 0.55,
                              cursor: (!isViewMode && hasFilledText(annexureType) && String(annexureType || '').trim() !== 'Not Applicable') ? 'pointer' : 'not-allowed',
                            }}
                            disabled={isViewMode || !hasFilledText(annexureType) || String(annexureType || '').trim() === 'Not Applicable'}
                            title={
                              isViewMode
                                ? 'View mode'
                                : String(annexureType || '').trim() === 'Not Applicable'
                                  ? 'Upload disabled for Not Applicable'
                                  : hasFilledText(annexureType)
                                    ? 'Choose annexure file'
                                    : 'Select annexure type before choosing files'
                            }
                            onMouseEnter={(e) => {
                              if (!isViewMode && hasFilledText(annexureType) && String(annexureType || '').trim() !== 'Not Applicable') {
                                (e.currentTarget as HTMLButtonElement).style.background = '#005c95';
                              }
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#0069ab';
                            }}
                          >
                            <Upload size={18} />
                            Choose File
                          </button>

                          {annexureFiles.length ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {annexureFiles.map((fileRow) => (
                                <div key={fileRow.id} style={annexureFileRowStyle}>
                                  <span
                                    style={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      maxWidth: '240px',
                                    }}
                                    title={fileRow.originalName || fileRow.storedName}
                                  >
                                    {fileRow.originalName || fileRow.storedName}
                                  </span>
                                  {fileRow.annexureType ? (
                                    <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                                      ({fileRow.annexureType})
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => openAnnexureFile(fileRow)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#0069ab',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: '2px',
                                    }}
                                    title="View uploaded document"
                                  >
                                    <Eye size={18} />
                                  </button>
                                  {!isViewMode && (
                                    <button
                                      type="button"
                                      onClick={() => deleteAnnexureFile(fileRow.id)}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#dc3545',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        padding: '2px',
                                      }}
                                      title="Delete annexure"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                              No file selected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
        <div
          style={{
            maxWidth: '100%',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '18px',
          }}
        >
          {!showPreview && stageRemarksForDisplay.length > 0 && (
            <div
              style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: '18px',
                width: '100%',
                maxWidth: '1200px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              }}
            >
              <h5 style={{ margin: '0 0 16px', fontSize: '16px', color: '#0069ab', fontWeight: 600 }}>
                Workflow Remarks
              </h5>
              <div className="row g-3">
                {stageRemarksForDisplay.map((entry) => (
                  <div className="col-md-4" key={entry.label}>
                    <label style={{ fontSize: '13px', color: '#495057', marginBottom: '8px', fontWeight: 600, display: 'block' }}>
                      {entry.label}{hasFilledText(entry.status) ? ` (${entry.status})` : ''}
                    </label>
                    {(() => {
                      const entryStage = String(entry.label || '').toLowerCase();
                      const isCurrentStageEditable = canEditStageRemark && loadedCurrentStage === entryStage;
                      return (
                        <textarea
                          value={isCurrentStageEditable ? stageRemarkInput : (entry.remarks || '')}
                          readOnly={!isCurrentStageEditable}
                          onChange={(event) => {
                            if (isCurrentStageEditable) {
                              setStageRemarkInput(event.target.value);
                            }
                          }}
                          rows={3}
                          placeholder={isCurrentStageEditable ? `Enter ${entry.label} remarks (optional)` : `No ${entry.label} remarks`}
                          style={{
                            borderRadius: '10px',
                            border: '1px solid #e0e0e0',
                            padding: '10px 12px',
                            fontSize: '0.9rem',
                            width: '100%',
                            fontFamily: 'inherit',
                            backgroundColor: '#fcfdff',
                            resize: isCurrentStageEditable ? 'vertical' : 'none',
                            color: '#495057',
                          }}
                        />
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showPreview && !isViewMode && (
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                backgroundColor: '#0069ab',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '0.95rem',
                fontWeight: '500',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                minWidth: '140px',
                opacity: isLoading ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
              disabled={isLoading}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = '#005492';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0069ab';
              }}
            >
              {isLoading ? 'Submitting...' : isEditMode ? 'Update Form' : 'Submit Form'}
            </button>
          )}

          {(isApprovalMode || canActOnCurrentStage) && !hideWorkflowActionsForFinalStatus && !showPreview ? (
            <div className="finance-workflow-actions">
              {!isSuperAdminUser && canActOnCurrentStage && (
                <>
                  <button
                    type="button"
                    className="finance-workflow-btn finance-workflow-btn--approve"
                    onClick={() => handleWorkflowAction('approved')}
                    disabled={isLoading}
                  >
                    <CheckCircle2 size={18} />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="finance-workflow-btn finance-workflow-btn--return"
                    onClick={() => handleWorkflowAction('returned')}
                    disabled={isLoading}
                  >
                    <RotateCcw size={18} />
                    Return
                  </button>
                  <button
                    type="button"
                    className="finance-workflow-btn finance-workflow-btn--reject"
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
                  className="finance-workflow-btn finance-workflow-btn--return"
                  onClick={() => handleWorkflowAction('returned')}
                  disabled={isLoading}
                >
                  <RotateCcw size={18} />
                  Return
                </button>
              )}
              <button
                type="button"
                className="finance-workflow-btn finance-workflow-btn--archive"
                onClick={() => handleWorkflowAction('archived')}
                disabled={isLoading}
              >
                <Archive size={18} />
                Archive
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showPreview && (() => {
        const getApprovalDetailUi = (stageKeys: string[]) => {
          let lastResetIdx = -1;

          for (let i = statusUpdates.length - 1; i >= 0; i--) {
            const dec = String(statusUpdates[i]?.decision || '').toLowerCase();
            const stat = String(statusUpdates[i]?.status || '').toLowerCase();

            if (
              dec === 'returned' ||
              dec === 'rejected' ||
              stat === 'returned' ||
              stat === 'rejected' ||
              dec === 'resubmitted' ||
              dec.includes('resubmit')
            ) {
              lastResetIdx = i;
              break;
            }
          }

          const currentFlowUpdates = statusUpdates.slice(lastResetIdx + 1);

          const approved = currentFlowUpdates.filter((u: any) => {
            const stage = String(u?.stage || '').toLowerCase();
            const decision = String(u?.decision || '').toLowerCase();
            const status = String(u?.status || '').toLowerCase();

            return (
              stageKeys.includes(stage) &&
              (decision === 'approved' || status === 'approved' || status.includes('approved'))
            );
          });

          if (approved.length === 0) {
            return { name: '', email: '', date: '' };
          }

          approved.sort((a: any, b: any) => {
            const tA = new Date(a?.decidedat || a?.createdat || 0).getTime();
            const tB = new Date(b?.decidedat || b?.createdat || 0).getTime();
            return tB - tA;
          });

          const latest = approved[0];
          const dateStr = latest?.decidedat || latest?.createdat;

          const formattedDate = dateStr
            ? new Date(dateStr).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour12: true,
            })
            : '';

          return {
            name: latest?.username || latest?.actorname || '',
            email: latest?.email || latest?.actoremail || latest?.useremail || '',
            date: formattedDate,
          };
        };
        const getSubmittedDetailUi = () => {
          const approvalHistory = getWorkflowTimeline(statusUpdates, {
            name: applicantName || '',
            email: email || '',
            date: submittedAt ? formatWorkflowTimestamp(submittedAt) : getCurrentWorkflowTimestamp(),
          });
          const submittedTimestamp = getSubmittedTimestamp(
            approvalHistory,
            submittedAt ? formatWorkflowTimestamp(submittedAt) : '',
            !id
          );
          const submitted = approvalHistory.find((entry) => entry.label === 'Submitted');

          if (!submitted) {
            return { name: applicantName || '', email: email || '', date: submittedTimestamp };
          }

          return {
            name: submitted.actor || applicantName || '',
            email: submitted.email || email || '',
            date: submittedTimestamp || submitted.timestamp || '',
          };
        };

        const submittedByUi = getSubmittedDetailUi();
        const level1ApprovalUi = getApprovalDetailUi(['level1', 'hod', 'coordinator', 'ithead']);
        const dofApprovalUi = getApprovalDetailUi(['dof']);
        const chairmanApprovalUi = getApprovalDetailUi(['chairman']);
        const approvalHistory = getWorkflowTimeline(statusUpdates, {
          name: applicantName || '',
          email: email || '',
          date: submittedAt ? formatWorkflowTimestamp(submittedAt) : getCurrentWorkflowTimestamp(),
        });
        const approvalSteps = approvalHistory.filter((entry) =>
          entry.label === 'Approved' &&
          !(totalBudget > 10000 && (String(entry.stage).includes('principal') || String(entry.stage).includes('chairman')))
        );
        const showSeniorApprovalRow = totalBudget > 10000;

        const renderPersonLine = (name?: string, mail?: string, timestamp?: string) => {
          const trimmedName = String(name || '').trim();
          const trimmedMail = String(mail || '').trim();
          const trimmedTime = String(timestamp || '').trim();

          const actorAlreadyHasMail =
            trimmedMail.length > 0 &&
            trimmedName.toLowerCase().includes(trimmedMail.toLowerCase());

          const displayName = trimmedName || '-';
          const displayMail = trimmedMail && !actorAlreadyHasMail ? ` (${trimmedMail})` : '';
          const displayTime = trimmedTime ? ` on ${trimmedTime}` : '';

          return (
            <span>
              {displayName}
              {displayMail}
              {displayTime}
            </span>
          );
        };

        const getPreviewDecisionLabel = (entry: any): string => {
          const label = String(entry?.label || '').trim();
          if (label !== 'Approved') return `${label} by`;

          const stageToken = String(entry?.stage || '').toLowerCase();
          const actorToken = String(entry?.actor || '').toLowerCase();
          const emailToken = String(entry?.email || '').toLowerCase();
          const isPrincipalEntry =
            stageToken.includes('principal') ||
            actorToken.includes('principal') ||
            emailToken.includes('principal@');

          return isPrincipalEntry ? 'Approved by' : 'Recommended by';
        };
        const previewTimelineRowStyle: CSSProperties = {
          padding: '8px 10px',
          fontSize: '14px',
          lineHeight: '1.45',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          alignItems: 'baseline',
        };

        const previewTimelineLabelStyle: CSSProperties = {
          fontWeight: 600,
          whiteSpace: 'nowrap',
        };

        const previewTimelineValueStyle: CSSProperties = {
          flex: '1 1 auto',
          minWidth: 0,
        };
        return (
          <div ref={componentRef} style={{
            position: 'relative',
            backgroundColor: '#fff',
            padding: '22px 18px',
            width: '210mm',
            boxSizing: 'border-box',
            margin: '0 auto',
          }}>
            <table style={{
              marginBottom: "14px",
              tableLayout: "fixed",
              width: '94%',
              margin: '0 auto 14px auto',
              borderCollapse: 'collapse'
            }}>
              <tr>
                <td style={{
                  width: "16%",
                  border: "1px solid #000",
                  textAlign: "center",
                  verticalAlign: "middle",
                  padding: "10px 6px",
                }}>
                  <img src={KSRCTLogo} alt="Logo" style={{ width: "75px", height: "75px", objectFit: "contain" }} />
                </td>
                <td style={{
                  width: "68%",
                  border: "1px solid #000",
                  textAlign: "center",
                  verticalAlign: "middle",
                  padding: "8px 10px",
                }}>
                  <div style={{ fontSize: "19px", fontWeight: "bold", color: "#000", lineHeight: "1.05", marginBottom: "4px" }}>
                    K.S.RANGASAMY COLLEGE OF TECHNOLOGY
                  </div>
                  <div style={{ fontSize: "14px", color: "#000", marginBottom: "4px" }}>
                    (Autonomous)
                  </div>
                  <div style={{ fontSize: "16px", color: "#000", lineHeight: "1.2" }}>
                    Tiruchengode – 637 215, Namakkal Dt. Tamil Nadu
                  </div>
                </td>
                <td style={{
                  width: "16%",
                  border: "1px solid #000",
                  textAlign: "center",
                  verticalAlign: "middle",
                  padding: "10px 6px",
                }}>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#000" }}>
                    FINANCE
                  </div>
                  {proposalRef && (
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#000", marginTop: "4px" }}>
                      {proposalRef}
                    </div>
                  )}
                </td>
              </tr>
            </table>

            <h2 style={{
              textAlign: 'center',
              margin: '0 0 18px 0',
              fontSize: '18px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: '#000000'
            }}>
              APPLICATION FOR FINANCIAL APPROVAL
            </h2>

            <table style={{
              marginBottom: "14px",
              tableLayout: "fixed",
              width: '94%',
              borderCollapse: 'collapse',
              margin: '0 auto 14px auto'
            }}>
              <tr>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', width: '18%', fontSize: '14px' }}><strong>Name</strong></td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', width: '32%', fontSize: '14px' }}>{applicantName || '\u00A0'}</td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', width: '20%', fontSize: '14px' }}><strong>Date</strong></td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', width: '30%', fontSize: '14px' }}>{date ? formatDMY(date) : '\u00A0'}</td>
              </tr>
              <tr>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }}><strong>Department</strong></td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }}>{department || '\u00A0'}</td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', width: '15%', fontSize: '14px' }}><strong>Designation</strong></td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }}>{designation || '\u00A0'}</td>
              </tr>
              <tr>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }}><strong>Email</strong></td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }}>{email || '\u00A0'}</td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }}><strong>Mobile</strong></td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }}>{mobile || '\u00A0'}</td>
              </tr>
              <tr>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }} colSpan={1}><strong>Beneficiary</strong></td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }} colSpan={3}>
                  {getBeneficiaryDisplayText()}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }} colSpan={1}><strong>Description</strong></td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px', wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }} colSpan={3}>
                  {description || '\u00A0'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }} colSpan={1}><strong>Head of Accounts</strong></td>
                <td style={{ padding: '4.5px 5.5px', border: '1px solid #000', fontSize: '14px' }} colSpan={1}>
                  {primaryHead || '\u00A0'}
                  {extraDropdownVisible && eventSubHead && ` - ${eventSubHead}`}
                </td>

                <td style={{ padding: '8px 5.5px', border: '1px solid #000', fontSize: '14px', verticalAlign: 'middle', height: '42px' }}><strong>Annexure</strong></td>
                <td style={{ padding: '8px 5.5px', border: '1px solid #000', fontSize: '14px', verticalAlign: 'middle', height: '42px', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                  {getAnnexureSummary()}
                </td>

              </tr>

              <tr>
                <td colSpan={4} style={{ padding: '8px 6px', border: '1px solid #000', verticalAlign: 'top' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '4px', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '36%' }} />
                      <col style={{ width: '16%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f8f8' }}>
                        <th style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'center' }}>S.No</th>
                        <th style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'center' }}>Budget Head</th>
                        <th style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'center' }}>Sub Head</th>
                        <th style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'center' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetRows.map((row, index) => (
                        <tr key={index}>
                          <td style={{ padding: '2.5px 4px', border: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>
                          <td style={{ padding: '2.5px 4px', border: '1px solid #000' }}>{row.category || '\u00A0'}</td>
                          <td style={{ padding: '2.5px 4px', border: '1px solid #000' }}>{getSubHeadDisplayText(row.head) || '\u00A0'}</td>
                          <td style={{ padding: '2.5px 4px', border: '1px solid #000', textAlign: 'right' }}>₹  {Number(row.amount || 0)}</td>
                        </tr>
                      ))}
                      {hasUnplannedBudgetPreview && (
                        <tr style={{ backgroundColor: 'white', fontWeight: 'bold' }}>
                          <td colSpan={3} style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold' }}>Unplanned Budget:{unplannedBudgetDescription || '\u00A0'}</td>
                          <td style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'right' }}>₹  {Number(unplannedBudgetAmount || 0)}</td>
                        </tr>
                      )}
                      <tr style={{ backgroundColor: 'white', fontWeight: 'bold' }}>
                        <td colSpan={3} style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>Total Budget:</td>
                        <td style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'right' }}>₹ {totalBudget}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '6px 16px', border: '1px solid #000', textAlign: 'center', fontSize: '15px', backgroundColor: '#f8f9fa' }}>
                  Rupees in Words: {numberToIndianWords(totalBudget).replace(/\b\w/g, l => l.toUpperCase()).replace(/([A-Z])(?=[A-Z][a-z])/, '$1 ').replace(/[A-Z]{2,}/g, m => m.charAt(0) + m.slice(1).toLowerCase())}
                </td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '6px 8px', border: '1px solid #000' }}>
                  {showIncomeSection ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '27%' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f8f8' }}>
                          <th style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'center' }}>S.No</th>

                          <th style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'center' }}>Income Source</th>
                          <th style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'center' }}>Amount</th>
                          <th style={{ padding: '3px 4px', border: '1px solid #000', textAlign: 'center' }}>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeRows.map((row, index) => (
                          <React.Fragment key={row.id}>
                            <tr>
                              <td rowSpan={2} style={{ padding: '2.5px 4px', border: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>

                              <td style={{ padding: '2.5px 4px', border: '1px solid #000' }}>{row.incomeSource || ''}</td>
                              <td style={{ padding: '2.5px 4px', border: '1px solid #000', textAlign: 'center' }}>{row.status || ''}</td>
                              <td style={{ padding: '2.5px 4px', border: '1px solid #000', textAlign: 'right' }}>₹ {row.amount ? ` ${row.amount}` : ''}</td>
                              <td style={{ padding: '2.5px 4px', border: '1px solid #000' }}>{row.remarks || ''}</td>
                            </tr>
                            <tr>

                              <td colSpan={1} style={{ padding: '2.5px 4px', border: '1px solid #000', fontWeight: 'bold', backgroundColor: '#f8f8f8' }}>
                                <strong>Contribution</strong>{row.contribution ? ` - ${row.contribution}` : ''}
                              </td>
                              <td colSpan={3} style={{ padding: '2.5px 4px', border: '1px solid #000', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                <b>Credit Account:</b>
                                {row.creditAccount || '\u00A0'}
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', fontSize: '14px' }}>Income: Not Applicable</div>
                  )}
                </td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '0', border: '1px solid #000' }}>
                  <div
                    style={{
                      ...previewTimelineRowStyle,
                      borderBottom: approvalSteps.length > 0 || showSeniorApprovalRow ? '1px solid #000' : 'none',
                    }}
                  >
                    <span style={previewTimelineLabelStyle}>Submitted by</span>
                    <span style={previewTimelineValueStyle}>
                      {renderPersonLine(submittedByUi.name, submittedByUi.email, submittedByUi.date)}
                    </span>
                  </div>



                  {approvalSteps.map((entry, index) => {
                    const entryKey = String(entry.key || `${entry.label}-${index}`);
                    const hasExpandedDetails =
                      Boolean(entry.fullSubtitle) &&
                      entry.fullSubtitle !== entry.subtitle;
                    const detailText = hasExpandedDetails && expandedTimelineDetails[entryKey]
                      ? entry.fullSubtitle
                      : entry.subtitle;

                    return (
                      <div
                        key={entryKey}
                        style={{
                          ...previewTimelineRowStyle,
                          borderBottom: index === approvalSteps.length - 1 ? 'none' : '1px solid #000',
                        }}
                      >
                        <span style={previewTimelineLabelStyle}>{getPreviewDecisionLabel(entry)}</span>
                        <span
                          style={{
                            ...previewTimelineValueStyle,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '4px',
                          }}
                        >
                          <span>
                            {renderPersonLine(entry.actor, entry.email, entry.timestamp)}
                          </span>
                          {detailText ? (
                            <span style={{ fontSize: '12px', color: '#495057', lineHeight: 1.4 }}>
                              {detailText}
                            </span>
                          ) : null}
                          {hasExpandedDetails ? (
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedTimelineDetails((prev) => ({
                                  ...prev,
                                  [entryKey]: !prev[entryKey],
                                }));
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#0d6efd',
                                padding: 0,
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              {expandedTimelineDetails[entryKey] ? 'Show less' : 'Show full changes'}
                            </button>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                  {approvalHistory.length === 0 ? (
                    <div style={previewTimelineRowStyle}>
                      No approval history available
                    </div>
                  ) : null}
                </td>
              </tr>
            </table>

            {(isApprovalMode || canActOnCurrentStage) && !hideWorkflowActionsForFinalStatus ? (
              <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'center' }}>
                <div className="finance-workflow-actions">
                  {!isSuperAdminUser && canActOnCurrentStage && (
                    <>
                      <button
                        type="button"
                        className="finance-workflow-btn finance-workflow-btn--approve"
                        onClick={() => handleWorkflowAction('approved')}
                        disabled={isLoading}
                      >
                        <CheckCircle2 size={18} />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="finance-workflow-btn finance-workflow-btn--return"
                        onClick={() => handleWorkflowAction('returned')}
                        disabled={isLoading}
                      >
                        <RotateCcw size={18} />
                        Return
                      </button>
                      <button
                        type="button"
                        className="finance-workflow-btn finance-workflow-btn--reject"
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
                      className="finance-workflow-btn finance-workflow-btn--return"
                      onClick={() => handleWorkflowAction('returned')}
                      disabled={isLoading}
                    >
                      <RotateCcw size={18} />
                      Return
                    </button>
                  )}
                  <button
                    type="button"
                    className="finance-workflow-btn finance-workflow-btn--archive"
                    onClick={() => handleWorkflowAction('archived')}
                    disabled={isLoading}
                  >
                    <Archive size={18} />
                    Archive
                  </button>
                </div>
              </div>
            ) : null}

            <div
              style={{
                marginTop: '18px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => navigate(isAdminWorkflowContext ? '/workflow/finance' : '/financecard')}
                style={{
                  backgroundColor: '#0069ab',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005492')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0069ab')}
                disabled={isLoading}
              >
                Back to Dashboard
              </button>

              <button
                type="button"
                onClick={handleDownloadPdfClick}
                style={{
                  backgroundColor: '#0069ab',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005492')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0069ab')}
                disabled={isLoading}
              >
                {isLoading ? 'Generating...' : 'Download PDF'}
              </button>
            </div>
          </div>
        );
      })()}

      <CustomModal
        show={wfActionPopupOpen}
        onHide={wfActionSubmitting ? (() => { }) : closeWfActionPopup}
        title={wfActionType === 'returned' ? 'Return Item - Comments' : 'Reject Item - Comments'}
        size="sm"
        centered
        backdrop={wfActionSubmitting ? 'static' : true}
        keyboard={!wfActionSubmitting}
        hideCloseButton={wfActionSubmitting}
        footer={
          <div className="d-flex justify-content-end gap-2 w-100">
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
              className={`btn btn-sm ${wfActionType === 'rejected' ? 'btn-danger' : 'btn-warning text-dark'}`}
              onClick={submitWfActionWithComment}
              disabled={wfActionSubmitting}
            >
              {wfActionSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        }
      >
        {proposalRef && (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
            Reference: <b>{proposalRef}</b>
          </div>
        )}
        <textarea
          value={wfActionComment}
          onChange={(e) => setWfActionComment(e.target.value)}
          disabled={wfActionSubmitting}
          rows={4}
          placeholder="Enter comments (required)..."
          className="form-control"
        />
      </CustomModal>

      <AlertModal
        show={alertConfig.show}
        onHide={closeAlert}
        message={alertConfig.message}
        type={alertConfig.type}
        title={alertConfig.title}
        onConfirm={alertConfig.onConfirm}
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
      />
      <CustomModal
        show={principalApprovalPopupOpen}
        onHide={closePrincipalApprovalPopup}
        title="Principal Approval Form"
        centered
        backdrop={principalApprovalSubmitting ? "static" : true}
        keyboard={!principalApprovalSubmitting}
        hideCloseButton={principalApprovalSubmitting}
        footer={
          <div className="d-flex justify-content-end gap-2 w-100">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={closePrincipalApprovalPopup}
              disabled={principalApprovalSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-success"
              onClick={submitPrincipalApproval}
              disabled={principalApprovalSubmitting || !principalApprovalFile}
            >
              {principalApprovalSubmitting ? "Submitting..." : "Approve and Submit"}
            </button>
          </div>
        }
      >
        <div style={{ fontSize: 14, marginBottom: 15 }}>
          Please upload the required annexure document before approving this request.
        </div>
        <div className="mb-3">
          <label className="form-label fw-bold">Upload Principal Annexure (PDF)</label>
          <input
            type="file"
            accept="application/pdf,.pdf"
            required
            className="form-control"
            disabled={principalApprovalSubmitting}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && ((file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) || file.size >= 2 * 1024 * 1024)) {
                showAlert('Only PDF files with a size less than 2MB are allowed.', 'error');
                e.target.value = '';
                setPrincipalApprovalFile(null);
                return;
              }
              setPrincipalApprovalFile(file || null);
            }}
          />
        </div>
      </CustomModal>
    </div>
  );
};

export default FinanceApproval;
