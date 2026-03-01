
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Navbar from '../.././shared/components/layout/navbar/navbar';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import { useAuth } from '../../contexts/AuthContext';
import Select from 'react-select';
import './budget.css';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';

interface SelectOption {
  value: string;
  label: string;
}

interface BudgetHeadSelectOption extends SelectOption {
  budgetHead: string;
  subHead?: string;
  optionType: 'budget-head' | 'head-sub-head';
}

interface BudgetHeadSelectGroup {
  label: string;
  options: BudgetHeadSelectOption[];
}

const normalizeText = (value: string | null | undefined): string =>
  String(value || '').trim();

type BudgetLine = {
  budgetHead: string;
  subHead: string;
  amount: string;
  qty: string;
  monthAmounts: Record<string, string>;
  description?: string;
};

interface BudgetHeadGroup {
  label: string;
  options: string[];
}

interface ApplicantSearchResult {
  employee_id: number;
  name: string;
  designation: string;
  department: string;
  email: string;
  mobile: string;
}


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
      'Accessories & Kits', 'Library Books'
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
      'Printing & Stationery',
      'Postal Expenses',
      'Local Conveyance',
    ],
  },
  {
    label: 'Events & Competitions',
    options: ['Academic Events', 'College Events', 'Conferences & Conclaves', 'Association Activities', 'Outreach Event', 'Cultural & Celebrations', 'Sports'
      , 'Competitions'],
  },
  {
    label: 'Meetings & Audits',
    options: [
      'Institutional Governance Meetings', 'Academic Governance Meetings', 'Institutional Audits', 'Government Meetings',
    ],
  },
  {
    label: 'Academics',
    options: [
      'Faculty Empowerment', 'Staff Empowerment', 'Sudent Empowerment', 'Student Capacity Building', 'Accreditation Expenses', 'Examination Expenses',
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
      'Administrative Expenses', 'Licenses & Taxes',
      'Salary',
      'Bills & Payments',
      'Miscellaneous Expenses',
    ],
  },

];

const SUB_HEAD_BY_BUDGET_HEAD: Record<string, string[]> = {
  'Civil Infrastructure': [
    'Construction Works',
    'Partition Works',
    'False Ceiling Works',
    'Plumbing Works',
    'Canopy', 'Water Cooler'
  ],
  'Electrical Infrastructure': [
    'Electrical Wiring',
    'Lights & Fans',
    'Lift Installation',
    'Air Conditioner',
    'UPS & Inverter',
    'Battery', 'Generator'
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
    'Desktops Computers',
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
  Vehicles: ['Two Wheeler', 'Light Motor Vehicle', 'Heavy Motor Vehicle'],
  Equipment: [
    'Lab Equipment',
    'Consultancy Equipment',
    'Research Equipment',
    'Equipment Upgrade', 'Sports Equipment', 'Office Equipment'
  ],
  'Accessories & Kits': [
    'Power Tools',
    'Weighing Machine',
    'Drilling Machine',
    'Drone Kit',
  ],
  'Maintenance Charges': ['Annual Maintenance Charges', 'Equipment Maintenance',
    'Software Maintenance',
    'Building Maintenance',
    'Computer Maintenance',
    'Electrical Maintenance',
    'Furniture Maintenance',
    'Plumbing Maintenance',
    'Vehicle Maintenance',
    'Garden Maintenance',
    'Infrastructure Maintenance',
    'AC Maintenance',
    'UPS Maintenance',
    'Lift Maintenance',
    'Printer Maintenance',
    'Painting', 'Playground Maintenance', 'Office Maintenance',
    'Housekeeping Expenses', 'General Repairs'
  ],
  Spares: ['Printer Donors', 'SMPS', 'Chargers'],
  'Annual Maintenance Charges': ['Equipment Maintenance', 'Software Maintenance'],
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
  'College Essentials': ['Books', 'Note Books', 'Log Books', 'ID Card', 'Others'],
  'Printing & Stationery': [
    'Banner',
    'Pamphlet',
    'Brochure',
    'Vinyl Boards',
    'Certificates',
    'Diary',
    'Calendar',
    'Visiting Card',
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
  'Conferences & Conclaves': ['National Conference', 'International Conference', 'Conclave', 'Convention', 'Networking Event', 'Industry Interaction'],
  'Association Activities': ['Association Function', 'Alumni Meeting', 'Alumni Interaction', 'Parents Meeting'],
  'Outreach Event': ['School Visit', 'Awareness Program', 'Campaigns', 'Mini Marathon', 'Education Fair', 'Rally'],
  'Cultural & Celebrations': ['Celebration Day', 'Festival Celebrations', 'Harmonicks', 'Hostel Day'],
  'Sports': ['Sports Meet', 'Sports Day'],
  'Competitions': ['Hackathons', 'Competitions', 'Club Activities', 'Project Expo', 'Ideathon', 'Start-up meet'],

  'Institutional Governance Meetings': ['Governing Body Meeting', 'Research Advisory Board Meeting', 'Finance Committee Meeting', 'Result Passing Board Meeting', 'Examination Committee Meeting'
    , 'Placement Meeting'],

  'Academic Governance Meetings': ['Academic Council Meeting', 'Standing Committee Meeting',
    'Board of Studies Meeting', 'DAB Meeting'],
  'Institutional Audits': ['Academic Audit', 'Administrative Audit', 'Energy & Green Audit'],
  'Government Meetings': ['Government Meetings'],
  'Faculty Empowerment': [
    'Registration fee',
    'Travel Allowance',
    'Food & Refreshment',
    'Accommodation',
    'Daily Allowance',
    'Membership Fees',
    'Incentives',
    'Leadership Meet',
    'Faculty Welfare', 'Medical Expenses'
  ],

  'Academic Events': [
    'Seminar',
    'Webinar',
    'Guest Lecture',
    'Workshop',
    'Hands-on Training',
    'FDP (Faculty Development Programme)',
    'STTP (Short-Term Training Programme)',
    'MoU Inking',
    'Industry Visit',
    'Expert Visit'
  ],

  'College Events': [
    'Annual Day',
    'Graduation Day',
    'Student Induction Programme',
    'Orientation Session',
    'Dakshaa',
    'Science Day',
    'Womens Day',
    'Founder Day'
  ],
  'Staff Empowerment': [
    'Registration fee',
    'Travel Allowance',
    'Food & Refreshment',
    'Accommodation',
    'Daily Allowance',
    'Incentives',
    'Staff Welfare', 'Medical Expenses'
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

  'Accreditation Expenses': [
    'NAAC Fees',
    'NBA Fees',
    'NAAC Inspection',
    'NBA Inspection',
  ],
  'Examination Expenses': [
    'Autonomous Exam Remuneration', 'Online Exam Remuneration',
    'Government Exam Remuneration',
  ],
  'Advertisement & Branding': ['News Paper Advertisement', 'Digital Promotion'],
  'Public Relations': [
    'Press & Media',
    'Promotions',
    'Branding',
    'Corporate Gift', 'Sponsorship',
    'CSR Activity'
  ],
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
    'Insurance Charges',
    'Stamp Charges', 'Audit Fees',
    'Flag Day Expenses',
    'Fee Fixation Expenses',
    'Scholarship Expenses',
    'International Travel',
    'Testing Charges', 'Legal Expenses'
  ],
  'Licenses & Taxes': ['DTCP Approval', 'Water Tax', 'Road Tax', 'Property Tax', 'Building Tax'],
  'Salary:': [
    'Monthly Salary',
    'Provident Fund',
    'Emoluments',
    'Professional Payments',
    'Wages', 'ESI Scheme', 'Allowances'
  ],
  'Bills & Payments': [
    'Electricity Charges',
    'Internet Charges',
    'Telephone Charges', 'Diesel Expenses'
  ],
  'Miscellaneous Expenses': [
    'Bank Charges',
    'Bank Interest',
    'Loan Processing Charges',
    'General Expenses',
    'Sewage Treatment',
    'Laundry Service',
    'RO  Mineral Water',
    'Pooja Expenses',
    'Fire Extinguisher',
    'First Aid Kit Expenses',
    'Irrecovable Fee', 'Legal Expenses', 'Others'
  ],
};



const BENEFICIARY_TYPE_TO_ENTITY_API_TYPE: Record<string, string> = {
  Department: 'DEPARTMENT',
  Centre: 'CENTRE',
  Cell: 'CELL',
  Club: 'CLUB',
  'Professional Body': 'PROFESSIONAL_BODY',
};

const BUDGET_HEAD_SUB_HEAD_CATALOG = Object.entries(SUB_HEAD_BY_BUDGET_HEAD).flatMap(
  ([budgetHead, subHeads]) => subHeads.map((subHead) => ({ budgetHead, subHead }))
);

const MONTH_KEYS = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
] as const;

const EMPTY_MONTHS: Record<string, string> = {
  Apr: '',
  May: '',
  Jun: '',
  Jul: '',
  Aug: '',
  Sep: '',
  Oct: '',
  Nov: '',
  Dec: '',
  Jan: '',
  Feb: '',
  Mar: '',
};


const Budget: React.FC = () => {
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: () => void;
  }>({
    show: false,
    message: '',
    type: 'info'
  });

  const showAlert = (message: React.ReactNode, type: AlertType = 'info', title?: string, onConfirm?: () => void) => {
    setAlertConfig({ show: true, message, type, title, onConfirm });
  };

  const closeAlert = () => setAlertConfig(prev => ({ ...prev, show: false }));

  // Form state
  const [applicantName, setApplicantName] = useState('');
  const [applicantSearchQuery, setApplicantSearchQuery] = useState('');
  const [applicantEmployeeId, setApplicantEmployeeId] = useState<number | null>(null);
  const [applicantSearchResults, setApplicantSearchResults] = useState<ApplicantSearchResult[]>(
    []
  );
  const [showApplicantDropdown, setShowApplicantDropdown] = useState(false);
  const [date, setDate] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [beneficiaryType, setBeneficiaryType] = useState('');
  const [beneficiaryValue, setBeneficiaryValue] = useState('');
  const [beneficiarySearchQuery, setBeneficiarySearchQuery] = useState('');
  const [beneficiarySearchResults, setBeneficiarySearchResults] = useState<ApplicantSearchResult[]>(
    []
  );
  const [showBeneficiaryDropdown, setShowBeneficiaryDropdown] = useState(false);
  const [subcategorySelections, setSubcategorySelections] = useState<string[]>([]);
  const [categorySelections, setCategorySelections] = useState<SelectOption[]>([]);
  const [categoryItem, setCategoryItem] = useState('');
  const [subcategoryOptionsByType, setSubcategoryOptionsByType] = useState<Record<string, SelectOption[]>>({});
  const { user } = useAuth();
  const isSuperAdminUser = Boolean(user?.is_super_admin) || (
    Array.isArray(user?.roles) &&
    user.roles.some((role) => String(role || '').toLowerCase() === 'super_admin')
  );
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isEditMode = location.pathname.includes('/edit') && !!id;


  const isViewMode = !!id && !location.pathname.includes('/edit');


  const isNewMode = !id;


  const [isEditable, setIsEditable] = useState(isNewMode);
  const [isApplicantCardOpen, setIsApplicantCardOpen] = useState(!id);

  const getCurrentFY = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fyStart = month >= 4 ? year : year - 1;
    return `${fyStart}-${String(fyStart + 1).slice(2)}`;
  };


  const [explicitFiscalYear, setExplicitFiscalYear] = useState<string>(
    location.state?.fiscalYear || getCurrentFY()
  );


  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([
    {
      budgetHead: '',
      subHead: '',
      amount: '',
      qty: '1',
      monthAmounts: { ...EMPTY_MONTHS },
      description: '',
    },
  ]);

  const [expandedRows, setExpandedRows] = useState<number[]>([0]);


  const getSubcategoryLabel = (type: string): string => {
    if (!type) return 'Sub category';
    if (type.includes(' ')) return type;
    return type.replace(/([A-Z])/g, ' $1').trim();
  };

  const isMultipleSelect = (type: string): boolean => {
    return ['Faculty_Team', 'Student_Team'].includes(type);
  };



  const subcategoryOptions: SelectOption[] = beneficiaryType
    ? subcategoryOptionsByType[beneficiaryType] || []
    : [];

  const subcategoryList = subcategoryOptions.map((option) => option.value);

  const hasSubcategories = subcategoryList.length > 0;

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '40px',
      borderColor: '#e0e0e0',
      borderRadius: '12px',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 105, 171, 0.15)' : 'none',
      backgroundColor: '#fcfdff',
      fontSize: '0.95rem',
      padding: '0 12px',
      borderWidth: '1px',
    }),
  };


  const getSubHeads = (head: string) => SUB_HEAD_BY_BUDGET_HEAD[head] || [];

  const updateLine = (index: number, field: keyof BudgetLine, value: string) => {
    setBudgetLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };


      if (field === 'budgetHead' && value !== updated[index].budgetHead) {
        updated[index].subHead = '';
      }

      return updated;
    });
  };

  const updateLineMonthAmount = (index: number, month: string, value: string) => {
    setBudgetLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[index] };
      line.monthAmounts = { ...line.monthAmounts, [month]: value };
      copy[index] = line;
      return copy;
    });
  };

  const lineMonthsTotal = (line: BudgetLine) =>
    MONTH_KEYS.reduce((sum, m) => {
      const val = parseFloat(line.monthAmounts[m] || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  const addLine = () => {
    const newIndex = budgetLines.length;
    setBudgetLines((prev) => [
      ...prev,
      {
        budgetHead: '',
        subHead: '',
        amount: '',
        qty: '1',
        monthAmounts: { ...EMPTY_MONTHS },
        description: '',
      },
    ]);
    setExpandedRows([newIndex]);
  };

  const toggleRowSchedule = (idx: number) => {
    setExpandedRows((prev) => {
      if (prev.includes(idx)) {
        return [];
      }
      return [idx];
    });
  };

  const deleteLine = (index: number) => {
    setBudgetLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const lineTotal = (line: BudgetLine) => {
    const amount = Number(line.amount || 0);
    const qty = Number(line.qty || 0);
    return amount * qty;
  };

  const grandTotal = budgetLines.reduce((sum, line) => sum + lineTotal(line), 0);

  const hasZeroAmountLine = (lines: BudgetLine[]) =>
    lines.some((line) => Number(line.amount || 0) === 0);

  const [budgetHeadFilter, setBudgetHeadFilter] = useState<Record<number, string>>({});

  const handleApplicantSearch = async (query: string) => {
    setApplicantSearchQuery(query);
    if (query.trim() !== applicantName.trim()) {
      setApplicantEmployeeId(null);
    }

    try {
      const response = await authenticityUtility.get(
        `/budget/search-applicant?q=${encodeURIComponent(query)}`
      ) as { success?: boolean; status?: string; data?: ApplicantSearchResult[] };

      if (response.status === 'success' || response.success) {
        setApplicantSearchResults(Array.isArray(response.data) ? response.data : []);
        setShowApplicantDropdown(true);
      }
    } catch (error) {
      console.error('Error searching applicant:', error);
      setApplicantSearchResults([]);
      setShowApplicantDropdown(false);
    }
  };

  const handleSelectApplicant = (emp: ApplicantSearchResult) => {
    setApplicantName((emp.name || '').trim());
    setApplicantSearchQuery((emp.name || '').trim());
    setApplicantEmployeeId(Number.isInteger(Number(emp.employee_id)) ? Number(emp.employee_id) : null);
    setDepartment(emp.department || '');
    setDesignation(emp.designation || '');
    setEmail(emp.email || '');
    setMobile(emp.mobile || '');
    setShowApplicantDropdown(false);
  };

  const handleBeneficiarySearch = async (query: string) => {
    setBeneficiarySearchQuery(query);
    if (query.trim() !== beneficiaryValue.trim()) {
      // Clear the selected employee ID when search changes
    }

    try {
      const response = await authenticityUtility.get(
        `/budget/search-applicant?q=${encodeURIComponent(query)}`
      ) as { success?: boolean; status?: string; data?: ApplicantSearchResult[] };

      if (response.status === 'success' || response.success) {
        setBeneficiarySearchResults(Array.isArray(response.data) ? response.data : []);
        setShowBeneficiaryDropdown(true);
      }
    } catch (error) {
      console.error('Error searching beneficiary:', error);
      setBeneficiarySearchResults([]);
      setShowBeneficiaryDropdown(false);
    }
  };

  const handleSelectBeneficiary = (emp: ApplicantSearchResult) => {
    setBeneficiaryValue((emp.name || '').trim());
    setBeneficiarySearchQuery((emp.name || '').trim());
    setShowBeneficiaryDropdown(false);
  };

  const getBudgetHeadSelectGroups = (rowIndex: number): BudgetHeadSelectGroup[] => {
    const query = normalizeText(budgetHeadFilter[rowIndex]).toLowerCase();

    const headGroups: BudgetHeadSelectGroup[] = BUDGET_HEAD_GROUPS
      .map((group) => ({
        label: group.label,
        options: group.options
          .filter((head) => !query || head.toLowerCase().includes(query))
          .map(
            (head) =>
              ({
                value: `head:${head}`,
                label: head,
                budgetHead: head,
                optionType: 'budget-head',
              }) as BudgetHeadSelectOption
          ),
      }))
      .filter((group) => group.options.length > 0);

    if (!query) {
      return headGroups;
    }

    const quickMatches: BudgetHeadSelectOption[] = BUDGET_HEAD_SUB_HEAD_CATALOG
      .filter(
        ({ budgetHead, subHead }) =>
          subHead.toLowerCase().includes(query) ||
          budgetHead.toLowerCase().includes(query)
      )
      .slice(0, 12)
      .map(
        ({ budgetHead, subHead }) =>
          ({
            value: `match:${budgetHead}:${subHead}`,
            label: `${subHead} (${budgetHead})`,
            budgetHead,
            subHead,
            optionType: 'head-sub-head',
          }) as BudgetHeadSelectOption
      );

    if (quickMatches.length === 0) {
      return headGroups;
    }

    return [
      {
        label: 'Quick Match',
        options: quickMatches,
      },
      ...headGroups,
    ];
  };

  const handleBudgetHeadSelect = (
    rowIndex: number,
    selectedOption: BudgetHeadSelectOption | null
  ) => {
    if (!selectedOption) {
      updateLine(rowIndex, 'budgetHead', '');
      updateLine(rowIndex, 'subHead', '');
      setBudgetHeadFilter((prev) => ({ ...prev, [rowIndex]: '' }));
      return;
    }

    updateLine(rowIndex, 'budgetHead', selectedOption.budgetHead);

    if (selectedOption.optionType === 'head-sub-head' && selectedOption.subHead) {
      updateLine(rowIndex, 'subHead', selectedOption.subHead);
    }

    setBudgetHeadFilter((prev) => ({ ...prev, [rowIndex]: '' }));
  };



  const handleSubmitBudget = async () => {

    if (!budgetLines.length) {
      showAlert('Please add at least one budget line.', 'warning');
      return;
    }


    for (let i = 0; i < budgetLines.length; i++) {
      const line = budgetLines[i];
      if (!line.budgetHead?.trim()) {
        showAlert('Budget Head is required', 'warning');
        return;
      }
      if (!line.amount || Number(line.amount) <= 0) {
        showAlert('Valid Unit Amount is required', 'warning');
        return;
      }
    }


    const formattedLines = budgetLines.map((line) => ({
      budget_head: line.budgetHead?.trim(),
      sub_head: line.subHead?.trim() || '',
      unit_amount: Number(line.amount),
      quantity: Number(line.qty) || 1,
      line_description:
        line.description?.trim() ||
        `${line.budgetHead} - ${line.subHead || ''}`,
      month_allocations: line.monthAmounts || {},
    }));


    const safeFY = String(explicitFiscalYear);
    const fiscalYearInt = parseInt(safeFY.split("-")[0]);


    if (isNaN(fiscalYearInt)) {
      showAlert("Error: Invalid Fiscal Year calculated. Please refresh.", 'error');
      return;
    }


    if (
      isNewMode &&
      applicantSearchQuery.trim() &&
      applicantSearchQuery.trim() !== applicantName.trim()
    ) {
      showAlert('Please select an applicant from the search results.', 'warning');
      return;
    }

    const payload = {
      request_date: date,
      fiscal_year: fiscalYearInt,
      employee_id:
        Number.isInteger(Number(applicantEmployeeId)) && Number(applicantEmployeeId) > 0
          ? Number(applicantEmployeeId)
          : undefined,
      beneficiary_type: beneficiaryType?.trim(),
      beneficiary_value:
        beneficiaryType === 'Faculty'
          ? beneficiaryValue?.trim()
          : beneficiaryType === 'Institution'
            ? 'K.S.Rangasamy College of Technology'
            : categoryItem?.trim(),
      proposal_description: '',
      lines: formattedLines,
    };

    try {
      const httpMethod = isEditMode ? 'put' : 'post';
      const endpoint = isEditMode
        ? `/budget/${id}`
        : '/budget';


      const result = await (authenticityUtility as any)[httpMethod](endpoint, payload);

      if (!result.success) {
        throw new Error(result.message || 'Submission failed on server');
      }

      showAlert(
        isEditMode
          ? `Budget updated successfully!`
          : (
            <>
              Budget submitted successfully!
              <br />
              Reference No.: <strong>{result.data.proposalRef}</strong>
            </>
          ),
        'success',
        undefined,
        () => {
          closeAlert();
          if (!isEditMode) {
            setBudgetLines([{
              budgetHead: '', subHead: '', amount: '', qty: '1', monthAmounts: { ...EMPTY_MONTHS }, description: '',
            }]);
            setExpandedRows([0]);
            setApplicantSearchQuery('');
            setApplicantEmployeeId(null);
            setApplicantSearchResults([]);
            setShowApplicantDropdown(false);
            setApplicantName(''); setDepartment(''); setDesignation(''); setEmail(''); setMobile('');
            setBeneficiaryType(''); setBeneficiaryValue(''); setCategoryItem('');
            setBeneficiarySearchQuery(''); setBeneficiarySearchResults([]); setShowBeneficiaryDropdown(false);
            const today = new Date().toISOString().split('T')[0];
            setDate(today);
          }
          navigate("/budgetcard");
        }
      );
    } catch (error: any) {
      console.error('Submit error:', error);
      showAlert(`Failed to submit: ${error.response?.data?.message || error.message}`, 'error');
    }
  };



  useEffect(() => {
    let cancelled = false;

    const loadBeneficiaryOptions = async () => {
      const nextOptions: Record<string, SelectOption[]> = {};

      await Promise.all(
        Object.entries(BENEFICIARY_TYPE_TO_ENTITY_API_TYPE).map(async ([beneficiaryKey, apiType]) => {
          try {
            const json = await authenticityUtility.get(`/budget/org-units/${apiType}`) as any;
            const rows = Array.isArray(json?.data) ? json.data : [];

            nextOptions[beneficiaryKey] = rows
              .map((row: any) => normalizeText(row?.name))
              .filter(Boolean)
              .map((name: string) => ({ value: name, label: name }));
          } catch (error) {
            console.error(`Failed to fetch options for ${beneficiaryKey}:`, error);
            nextOptions[beneficiaryKey] = [];
          }
        })
      );

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
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  }, []);

  useEffect(() => {
    if (budgetLines.length > 0 && expandedRows.length === 0) {
      setExpandedRows([0]);
    }
  }, []);



  useEffect(() => {
    if (beneficiaryType === 'Institution') {
      setBeneficiaryValue('K.S.Rangasamy College of Technology');
    } else if (beneficiaryType === 'Faculty') {
      if (applicantName.trim() && !beneficiaryValue) {
        setBeneficiaryValue(applicantName);
        setBeneficiarySearchQuery(applicantName);
      }
    }
  }, [beneficiaryType, applicantName]);


  useEffect(() => {
    if (!id) return;

    const loadProposal = async () => {
      try {
        const json = await authenticityUtility.get(`/budget/${id}`) as any;
        if (!json?.success) {
          console.error("Failed to load proposal", json);
          return;
        }

        const data = json.data;
        const p = data.master || data;

        if (!p) {
          console.error("No proposal data found");
          return;
        }


        setApplicantName(p.applicant_name || p.user_name || p.name || "");
        setApplicantSearchQuery(p.applicant_name || p.user_name || p.name || "");
        setApplicantEmployeeId(
          Number.isInteger(Number(p.employee_id)) && Number(p.employee_id) > 0
            ? Number(p.employee_id)
            : null
        );
        setEmail(p.user_email || p.email || "");


        setDesignation(p.designation || p.user_designation || "");
        setMobile(p.mobile || p.user_mobile || p.phone || "");


        const normalizedBeneficiaryType =
          p.beneficiary_type === 'ProfessionalBodies'
            ? 'Professional Body'
            : p.beneficiary_type || '';
        setBeneficiaryType(normalizedBeneficiaryType);

        // For Faculty type, set the search query for editing
        if (normalizedBeneficiaryType === 'Faculty') {
          setBeneficiarySearchQuery(p.beneficiary_value || '');
        }

        const normalizedBeneficiaryValue =
          normalizedBeneficiaryType === 'Department'
            ? (p.department || p.beneficiary_value || '')
            : ['Centre', 'Cell', 'Club', 'Professional Body'].includes(normalizedBeneficiaryType)
              ? (p.org_unit_name || p.beneficiary_value || '')
              : (p.beneficiary_value || '');

        const normalizedApplicantDepartment =
          p.applicant_department ||
          p.user_department ||
          (normalizedBeneficiaryType === 'Department' ? '' : p.department) ||
          '';

        setBeneficiaryValue(normalizedBeneficiaryValue);
        setCategoryItem(normalizedBeneficiaryValue);
        setDepartment(normalizedApplicantDepartment);

        // Date
        setDate((p.request_date || "").split("T")[0]);


        const apiLines = Array.isArray(data.lines) ? data.lines : [];
        const apiAllocations = data.allocations || {};

        const mappedLines = apiLines.map((ln: any) => {
          const lineAllocations = apiAllocations[ln.id] || {};
          return {
            budgetHead: (ln.budget_head || "").toString(),
            subHead: (ln.sub_head || "").toString(),
            amount: String(parseInt(ln.unit_amount || "0", 10)),
            qty: String(ln.quantity || "1"),
            monthAmounts: lineAllocations,
            description: (ln.line_description || "").toString(),
          };
        });

        if (mappedLines.length > 0) {
          setBudgetLines(mappedLines);
        }


        const editableStatuses = ['draft', 'level1_returned', 'dof_returned', 'submitted'];
        const isStatusEditable = editableStatuses.includes((p.status || '').toLowerCase());
        const isEditURL = location.pathname.includes('/edit');
        const canOverrideEditLock = isSuperAdminUser && isEditURL;

        if (!isEditURL) {
          setIsEditable(false);
          setExpandedRows(mappedLines.map((_, idx) => idx));
        } else if (isEditURL && !isStatusEditable && !canOverrideEditLock) {
          setIsEditable(false);
          showAlert(`This proposal cannot be edited because it is currently '${p.status}'. Switching to View mode.`, 'warning', undefined, () => {
            closeAlert();
            navigate(`/budget/${id}`);
          });
        } else {
          setIsEditable(true);
        }

      } catch (e) {
        console.error("loadProposal error", e);
      }
    };

    loadProposal();
  }, [id, location.pathname, navigate, isSuperAdminUser]);


  useEffect(() => {

    if (id || applicantName) return;

    const fetchUserDetails = async () => {
      try {
        const json = await authenticityUtility.get('/budget/faculty') as any;

        if (json.success && json.data) {
          setApplicantEmployeeId(
            Number.isInteger(Number(json.data.employee_id)) && Number(json.data.employee_id) > 0
              ? Number(json.data.employee_id)
              : null
          );
          setApplicantName(json.data.name || '');
          setApplicantSearchQuery(json.data.name || '');
          setDepartment(json.data.department || '');
          setEmail(json.data.email || '');


          if (json.data.designation) setDesignation(json.data.designation);
          if (json.data.mobile) setMobile(json.data.mobile);
        }
      } catch (error) {
        console.error("Failed to auto-fill user details", error);
      }
    };

    fetchUserDetails();
  }, [id, applicantName]);

  const formatINR = (value: number | string): string => {
    const num = Number(value || 0);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  };



  return (
    <div className="budgetPage">
      <Navbar />
      <fieldset disabled={isViewMode} style={{ border: 0, padding: 0, margin: 0 }}>

        <div className="budgetCard">

          <div
            className="cardHeader"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              padding: '15px 20px',
              borderBottom: '1px solid #e0e0e0',
              transition: 'all 0.3s ease'
            }}
            onClick={() => setIsApplicantCardOpen(!isApplicantCardOpen)}
          >
            <h5 style={{ margin: 0, fontSize: '16px', color: '#0069ab', fontWeight: '600' }}>
              Applicant Details
            </h5>


            <svg
              width="12"
              height="8"
              viewBox="0 0 12 8"
              className={`card-toggle-arrow ${isApplicantCardOpen ? 'open' : ''}`}
              style={{
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer'
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


          <div className="cardContent" style={{ padding: '20px' }}>


            {!isApplicantCardOpen && (
              <div className="row">
                <div className="col-md-7">
                  <div className="formGroup" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                      Applicant Name
                    </label>
                    <input
                      type="text"
                      value={applicantName}
                      disabled={true}
                      placeholder="Enter full name"
                      className="budget-input"
                      style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', cursor: 'pointer' }}
                      onClick={() => setIsApplicantCardOpen(true)}
                      readOnly
                    />
                  </div>
                </div>
                <div className="col-md-5">
                  <div className="formGroup" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      disabled={true}
                      className="budget-input"
                      style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', cursor: 'pointer' }}
                      onClick={() => setIsApplicantCardOpen(true)}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            )}


            {isApplicantCardOpen && (
              <>
                <div className="row mb-3" style={{ marginBottom: '15px' }}>
                  <div className="col-md-7">
                    <div className="formGroup" style={{ position: 'relative' }}>
                      <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                        Applicant Name
                      </label>
                      <input
                        type="text"
                        value={applicantSearchQuery}
                        onChange={(e) => handleApplicantSearch(e.target.value)}
                        disabled={!isEditable}
                        placeholder="Search employee by name or ERP ID"
                        className="budget-input"
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#0069ab';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                          if (isEditable && !showApplicantDropdown) {
                            void handleApplicantSearch(applicantSearchQuery);
                          }
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#e0e0e0';
                          e.currentTarget.style.boxShadow = 'none';
                          setTimeout(() => setShowApplicantDropdown(false), 200);
                        }}
                        required
                      />
                      {isEditable && showApplicantDropdown && applicantSearchResults.length > 0 && (
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
                          {applicantSearchResults.map((emp) => (
                            <div
                              key={emp.employee_id}
                              onMouseDown={(evt) => {
                                evt.preventDefault();
                                handleSelectApplicant(emp);
                              }}
                              style={{
                                padding: '10px 15px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(evt) => {
                                evt.currentTarget.style.backgroundColor = '#f8f9fa';
                              }}
                              onMouseLeave={(evt) => {
                                evt.currentTarget.style.backgroundColor = '#fff';
                              }}
                            >
                              <div style={{ fontWeight: '600', color: '#333' }}>{emp.name}</div>
                              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                                {emp.designation} | {emp.department}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {isEditable &&
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
                          </div>
                        )}
                    </div>
                  </div>
                  <div className="col-md-5">
                    <div className="formGroup">
                      <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                        Date
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        disabled={!isEditable}
                        className="budget-input"
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#0069ab'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="row mb-3" style={{ marginBottom: '15px' }}>
                  <div className="col-md-7">
                    <div className="formGroup">
                      <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                        Department
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={!isEditable}
                        placeholder="Department name"
                        className="budget-input"
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#0069ab'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-5">
                    <div className="formGroup">
                      <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                        Designation
                      </label>
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        disabled={!isEditable}
                        placeholder="e.g., Manager, Staff"
                        className="budget-input"
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#0069ab'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="row mb-3" style={{ marginBottom: '15px' }}>
                  <div className="col-md-7">
                    <div className="formGroup">
                      <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={!isEditable}
                        placeholder="example@email.com"
                        className="budget-input"
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#0069ab'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-5">
                    <div className="formGroup">
                      <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                        Mobile
                      </label>
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        disabled={!isEditable}
                        placeholder="10 digit mobile"
                        pattern="[0-9]{10}"
                        className="budget-input"
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#0069ab'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
                        required
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>


        <div className="budgetCard">
          <div className="cardContent">
            <div className="row mb-3" style={{ marginBottom: '15px' }}>
              <div className="col-md-4">
                <div className="form-group">
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                    Beneficiary
                  </label>
                  <div style={{ position: 'relative', zIndex: 1000 }}>
                    <Select
                      value={beneficiaryType ? { value: beneficiaryType, label: beneficiaryType } as SelectOption : null}
                      onChange={(selected: any) => {
                        const val = selected?.value || '';
                        setBeneficiaryType(val);
                        setCategoryItem('');
                        setCategorySelections([]);
                        setBeneficiarySearchQuery('');
                        setBeneficiarySearchResults([]);
                        setShowBeneficiaryDropdown(false);
                        if (val === 'Institution') {
                          setBeneficiaryValue('K.S.Rangasamy College of Technology');
                        } else {
                          setBeneficiaryValue('');
                        }
                      }}
                      options={[
                        { value: 'Faculty', label: 'Faculty' },
                        { value: 'Department', label: 'Department' },
                        { value: 'Centre', label: 'Centre' },
                        { value: 'Cell', label: 'Cell' },
                        { value: 'Club', label: 'Club' },
                        { value: 'Professional Body', label: 'Professional Body' },
                        { value: 'Institution', label: 'Institution' }
                      ]}
                      placeholder=""
                      isSearchable={true}
                      isClearable={false}
                      menuPosition="fixed"
                      menuPlacement="auto"
                      styles={{
                        control: (base: any, state: any) => ({
                          ...base,
                          minHeight: '36px',
                          height: 36,
                          borderRadius: 12,
                          border: state.isFocused
                            ? '1px solid #0069ab'
                            : '1px solid #e0e0e0',
                          backgroundColor: '#fcfdff',
                          boxShadow: state.isFocused
                            ? '0 0 0 3px rgba(0, 105, 171, 0.15)'
                            : 'none'
                        }),
                        dropdownIndicator: (base: any, state: any) => ({
                          ...base,
                          padding: '0 15px',
                          color: '#666', transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                        }),
                        indicatorSeparator: () => ({ display: 'none' }),
                        valueContainer: (base: any) => ({
                          ...base,
                          padding: '2px 15px',
                          color: '#333'
                        }),
                        singleValue: (base: any) => ({
                          ...base,
                          color: '#333',
                          fontSize: '0.95rem'
                        }),
                        input: (base: any) => ({
                          ...base,
                          color: '#333',
                          padding: '0 15px'
                        }),
                        menu: (base: any) => ({
                          ...base,
                          zIndex: 999999,
                          backgroundColor: 'white',
                          borderRadius: 12,
                          boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                        }),
                        option: (base: any, state: any) => ({
                          ...base,
                          padding: '10px 15px',
                          backgroundColor: state.isSelected
                            ? '#0069ab'
                            : state.isFocused
                              ? 'rgba(0,105,171,0.1)'
                              : 'white',
                          color: state.isSelected ? 'white' : '#333'
                        })
                      }}
                    />
                  </div>
                </div>

              </div>

              <div className="col-md-8">
                {beneficiaryType === 'Faculty' ? (
                  <div className="form-group" style={{ height: '72px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block', flexShrink: 0 }}>
                      Faculty Name
                    </label>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="text"
                        value={beneficiarySearchQuery || beneficiaryValue || ''}
                        onChange={(e) => {
                          setBeneficiaryValue(e.target.value);
                          setBeneficiarySearchQuery(e.target.value);
                          handleBeneficiarySearch(e.target.value);
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#0069ab';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                          if (isEditable && !showBeneficiaryDropdown) {
                            void handleBeneficiarySearch(beneficiarySearchQuery);
                          }
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#e0e0e0';
                          e.currentTarget.style.boxShadow = 'none';
                          setTimeout(() => setShowBeneficiaryDropdown(false), 200);
                        }}
                        placeholder="Search faculty by name or ERP ID"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #e0e0e0',
                          padding: '10px 15px',
                          fontSize: '0.95rem',
                          width: '100%',
                          flex: 1,
                          backgroundColor: '#fcfdff',
                          transition: 'all 0.3s ease',
                          outline: 'none'
                        }}
                        required
                      />
                      {isEditable && showBeneficiaryDropdown && beneficiarySearchResults.length > 0 && (
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
                            zIndex: 1001,
                            maxHeight: '250px',
                            overflowY: 'auto',
                            marginTop: '4px',
                          }}
                        >
                          {beneficiarySearchResults.map((emp) => (
                            <div
                              key={emp.employee_id}
                              onMouseDown={(evt) => {
                                evt.preventDefault();
                                handleSelectBeneficiary(emp);
                              }}
                              style={{
                                padding: '10px 15px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(evt) => {
                                evt.currentTarget.style.backgroundColor = '#f8f9fa';
                              }}
                              onMouseLeave={(evt) => {
                                evt.currentTarget.style.backgroundColor = '#fff';
                              }}
                            >
                              <div style={{ fontWeight: '600', color: '#333' }}>{emp.name}</div>
                              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                                {emp.designation} | {emp.department}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {isEditable &&
                        showBeneficiaryDropdown &&
                        beneficiarySearchQuery.length >= 2 &&
                        beneficiarySearchResults.length === 0 && (
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
                              zIndex: 1001,
                              marginTop: '4px',
                            }}
                          >
                            <div style={{ padding: '10px 15px', color: '#6c757d' }}>
                              No employees found
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                ) : beneficiaryType === 'Institution' ? (
                  <div className="form-group" style={{ height: '72px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block', flexShrink: 0 }}>
                      Institution
                    </label>
                    <input
                      type="text"
                      value={beneficiaryValue || ''}
                      onChange={(e) => setBeneficiaryValue(e.target.value)}
                      placeholder="K.S.Rangasamy College of Technology"
                      readOnly={true}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #e0e0e0',
                        padding: '10px 15px',
                        fontSize: '0.95rem',
                        width: '100%',
                        flex: 1,
                        backgroundColor: '#e9ecef',
                        color: '#495057',
                        cursor: 'not-allowed',
                        transition: 'all 0.3s ease',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>
                ) : subcategoryList.length > 0 ? (
                  <div className="form-group" style={{ height: '72px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block', flexShrink: 0 }}>
                      {getSubcategoryLabel(beneficiaryType)}
                    </label>
                    <div style={{ position: 'relative', zIndex: 1000, flex: 1 }}>
                      <Select
                        value={
                          categoryItem
                            ? { value: categoryItem, label: categoryItem } as SelectOption
                            : null
                        }
                        onChange={(selected: any) => {
                          const val = selected?.value || '';
                          setCategoryItem(val);
                          setCategorySelections([]);
                        }}
                        options={subcategoryOptions}
                        placeholder=""
                        isSearchable={true}
                        isClearable={false}
                        menuPosition="fixed"
                        menuPlacement="auto"
                        styles={{
                          control: (base: any, state: any) => ({
                            ...base,
                            minHeight: '100%',
                            height: '100%',
                            borderRadius: 12,
                            border: state.isFocused
                              ? '1px solid #0069ab'
                              : '1px solid #e0e0e0',
                            boxShadow: state.isFocused
                              ? '0 0 0 3px rgba(0, 105, 171, 0.15)'
                              : 'none',
                            backgroundColor: '#fcfdff',
                            fontSize: '0.95rem',
                            fontFamily: 'inherit'
                          }),
                          dropdownIndicator: (base: any, state: any) => ({
                            ...base,
                            padding: '0 15px',
                            transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                          }),
                          indicatorSeparator: () => ({ display: 'none' }),
                          valueContainer: (base: any) => ({
                            ...base,
                            padding: '2px 15px'
                          }),
                          option: (base: any, state: any) => ({
                            ...base,
                            padding: '10px 15px',
                            backgroundColor: state.isSelected ? '#0069ab' : state.isFocused ? 'rgba(0,105,171,0.1)' : '#fff'
                          })
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '72px' }} />
                )}
              </div>

            </div>
          </div>
        </div>



        <div className="budgetCard">
          <div className="cardContent">
            <div
              style={{
                marginBottom: '20px',
                paddingBottom: '10px',
                borderBottom: '2px solid #dee2e6',
                fontSize: '18px',
                fontWeight: '700',
                color: '#2c3e50',
              }}
            >
              Budget Proposal
            </div>

            <div className="budgetTableWrap">
              <table className="budgetEntryTable">
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>S.No</th>
                    <th style={{ width: '25%' }}>Budget Head</th>
                    <th style={{ width: '25%' }}>Sub Head</th>
                    <th style={{ width: '12%' }}>Amount</th>
                    <th style={{ width: '8%' }}>Qty</th>
                    <th style={{ width: '15%' }}>Total (₹)</th>
                    <th style={{ width: '13%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetLines.map((line, idx) => {
                    const total = lineTotal(line);
                    const monthsTotal = lineMonthsTotal(line);
                    const remaining = total - monthsTotal;

                    return (
                      <React.Fragment key={idx}>

                        <tr>
                          <td className="centerTd">{idx + 1}</td>
                          <td>
                            <Select
                              className="tableSelect"
                              value={
                                line.budgetHead
                                  ? ({
                                    value: line.budgetHead,
                                    label: line.budgetHead,
                                    budgetHead: line.budgetHead,
                                    optionType: 'budget-head',
                                  } as BudgetHeadSelectOption)
                                  : null
                              }
                              onChange={(selected: any) =>
                                handleBudgetHeadSelect(idx, selected as BudgetHeadSelectOption)
                              }
                              onInputChange={(inputValue: string, meta: any) => {
                                if (meta?.action === 'input-change') {
                                  setBudgetHeadFilter((prev) => ({ ...prev, [idx]: inputValue }));
                                } else if (meta?.action === 'menu-close') {
                                  setBudgetHeadFilter((prev) => ({ ...prev, [idx]: '' }));
                                }
                                return inputValue;
                              }}
                              options={getBudgetHeadSelectGroups(idx)}
                              placeholder="Select or type"
                              isSearchable={true}
                              isClearable={true}
                              isDisabled={!isEditable}
                              maxMenuHeight={200}
                              menuPlacement="auto"
                              formatGroupLabel={(group: any) => (
                                <div
                                  style={{
                                    fontWeight: 'bold',
                                    fontSize: '13px',
                                    color: '#495057',
                                    padding: '10px 12px 6px',
                                    background: '#e9ecef',
                                    borderBottom: '1px solid #dee2e6',
                                    marginBottom: '4px',
                                  }}
                                >
                                  {group.label}
                                </div>
                              )}
                              styles={{
                                control: (base: any, state: any) => ({
                                  ...base,
                                  minHeight: '38px !important',
                                  height: '38px !important',
                                  borderRadius: '4px',
                                  // Removed border to eliminate double-border effect
                                  border: 'none',
                                  boxShadow: 'none !important',
                                  backgroundColor: 'transparent', // Changed to transparent to match cell
                                }),
                                dropdownIndicator: (base: any, state: any) => ({
                                  ...base,
                                  padding: '4px 2px',
                                  transform: state.selectProps.menuIsOpen
                                    ? 'rotate(180deg)'
                                    : 'rotate(0deg)',
                                }),
                                clearIndicator: (base: any) => ({
                                  ...base,
                                  padding: '4px 2px',
                                  color: '#9aa3af',
                                  ':hover': { color: '#9aa3af' },
                                }),
                                indicatorsContainer: (base: any) => ({
                                  ...base,
                                  paddingRight: '2px',
                                  gap: '0px',
                                }),
                                indicatorSeparator: () => ({ display: 'none' }),
                                menu: (base: any) => ({
                                  ...base,
                                  marginTop: '2px',
                                  zIndex: 9999,
                                  borderRadius: '4px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                }),
                                groupHeading: (base: any) => ({
                                  ...base,
                                  fontWeight: 'bold',
                                  fontSize: '13px',
                                }),
                                option: (base: any, state: any) => ({
                                  ...base,
                                  padding: '8px 12px',
                                  backgroundColor: state.isSelected
                                    ? '#0069ab'
                                    : state.isFocused
                                      ? 'rgba(0,105,171,0.1)'
                                      : 'white',
                                }),
                              }}
                            />


                          </td>


                          <td>
                            <Select
                              className="tableSelect"
                              value={
                                line.subHead
                                  ? ({ value: line.subHead, label: line.subHead } as SelectOption)
                                  : null
                              }
                              onChange={(selected: any) => {
                                const val = selected?.value;
                                updateLine(idx, 'subHead', val);
                              }}
                              options={getSubHeads(line.budgetHead).map((sub) => ({
                                value: sub,
                                label: sub,
                              }))}
                              placeholder=""
                              isSearchable={true}
                              isClearable={false}
                              isDisabled={!line.budgetHead || !isEditable}
                              maxMenuHeight={200}
                              styles={{
                                control: (base: any, state: any) => ({
                                  ...base,
                                  minHeight: '38px !important',
                                  height: '38px !important',
                                  borderRadius: '4px',
                                  // Removed border to eliminate double-border effect
                                  border: 'none',
                                  boxShadow: 'none !important',
                                  backgroundColor: 'transparent', // Changed to transparent
                                }),
                                dropdownIndicator: (base: any, state: any) => ({
                                  ...base,
                                  padding: '4px 8px',
                                  transform: state.selectProps.menuIsOpen
                                    ? 'rotate(180deg)'
                                    : 'rotate(0deg)',
                                }),
                                indicatorSeparator: () => ({ display: 'none' }),
                                menu: (base: any) => ({
                                  ...base,
                                  marginTop: '2px',
                                  zIndex: 9999,
                                  borderRadius: '4px',
                                }),
                                option: (base: any, state: any) => ({
                                  ...base,
                                  padding: '8px 12px',
                                  backgroundColor: state.isSelected
                                    ? '#0069ab'
                                    : state.isFocused
                                      ? 'rgba(0,105,171,0.1)'
                                      : 'white',
                                }),
                              }}
                            />


                          </td>


                          <td>
                            <input
                              className="tableInput"
                              type="number"
                              min={0}
                              placeholder="0"
                              value={line.amount}
                              onChange={e => updateLine(idx, "amount", e.target.value)}
                              onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
                            />
                          </td>
                          <td>
                            <input
                              className="tableInput"
                              type="number"
                              min="0"
                              step="1"
                              value={line.qty}
                              onChange={(e) =>
                                updateLine(idx, 'qty', e.target.value)
                              }
                              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                            />
                          </td>
                          <td className="centerTd totalCell">{formatINR(total)}</td>



                          <td
                            className="centerTd"
                            style={{
                              padding: '8px 4px !important',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '80px',
                              gap: '2px'
                            }}
                          >

                            <button
                              type="button"
                              onClick={() => toggleRowSchedule(idx)}
                              title="Month schedule"
                              style={{
                                width: '24px',
                                height: '24px',
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s ease'
                              }}
                            >
                              <svg
                                width="10"
                                height="8"
                                viewBox="0 0 10 8"
                                className={`action-dropdown-arrow ${expandedRows.includes(idx) ? 'open' : ''}`}
                                style={{
                                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                  transformOrigin: 'center'
                                }}
                              >
                                <polyline
                                  points="1,1 5,5 9,1"
                                  stroke="#666"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="none"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="tableIconBtn"
                              onClick={addLine}
                              title={(() => {
                                const missing: string[] = [];
                                budgetLines.forEach((line) => {
                                  if (!line.budgetHead) missing.push('Budget Head');
                                  if (!line.subHead) missing.push('Sub Head');
                                  if (!line.description?.trim()) missing.push('Description');
                                  // Added: Check if Amount is missing or zero
                                  if (Number(line.amount || 0) <= 0) missing.push('Amount');
                                  if (
                                    Math.abs(
                                      lineTotal(line) - lineMonthsTotal(line)
                                    ) > 0.01
                                  )
                                    missing.push('Months balance');
                                });

                                return missing.length
                                  ? `Fill: ${missing.join(', ')} first!`
                                  : 'Add row';
                              })()}
                              disabled={budgetLines.some(
                                (line) =>
                                  !line.budgetHead ||
                                  !line.subHead ||
                                  !line.description?.trim() ||
                                  Math.abs(
                                    lineTotal(line) - lineMonthsTotal(line)
                                  ) > 0.01 ||
                                  // Added: Direct check for amount on the current line (replaces inefficient hasZeroAmountLine call)
                                  Number(line.amount || 0) <= 0
                              )}
                            >
                              +
                            </button>


                            <button
                              type="button"
                              className="tableIconBtn tableIconBtnDanger"
                              onClick={() => deleteLine(idx)}
                              title="Delete row"
                              disabled={budgetLines.length === 1}
                            >
                              ×
                            </button>
                          </td>
                        </tr>


                        {expandedRows.includes(idx) && (
                          <tr>
                            <td colSpan={7}>
                              <div className="monthScheduleWrap">
                                <div style={{ marginBottom: '20px', width: '100%' }}>
                                  <label
                                    className="form-label"
                                    style={{
                                      fontSize: '14px',
                                      color: '#495057',
                                      marginBottom: '6px',
                                      fontWeight: '600',
                                      display: 'block',
                                    }}
                                  >
                                    Description
                                  </label>
                                  <textarea
                                    value={line.description || ''}
                                    onChange={(e) =>
                                      updateLine(idx, 'description', e.target.value)
                                    }
                                    rows={1}
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
                                      resize: 'vertical',
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
                                    placeholder="Enter detailed description for this budget request"
                                  />
                                </div>

                                <div
                                  className="monthScheduleContent"
                                  style={{
                                    display: 'flex',
                                    gap: '20px',
                                    alignItems: 'flex-start',
                                  }}
                                >

                                  <div className="monthGrid">
                                    {MONTH_KEYS.map((month) => (
                                      <div key={month} className="monthBox">
                                        <div className="monthLabel">{month}</div>
                                        <input
                                          type="number"
                                          placeholder="0"
                                          className="monthAmountInput"
                                          value={line.monthAmounts[month] || ''}
                                          onChange={(e) =>
                                            updateLineMonthAmount(
                                              idx,
                                              month,
                                              e.target.value
                                            )
                                          }
                                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                                        />
                                      </div>
                                    ))}
                                  </div>


                                  <div
                                    className="monthSummaryBox"
                                    style={{
                                      minWidth: '220px',
                                      padding: '16px',
                                      border: '1px solid #dee2e6',
                                      borderRadius: '8px',
                                      backgroundColor: '#f8f9fa',
                                      fontSize: '13px',
                                    }}
                                  >
                                    <div
                                      style={{
                                        marginBottom: '12px',
                                        fontWeight: '600',
                                        fontSize: '14px',
                                      }}
                                    >
                                      Budget Summary
                                    </div>

                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '4px',
                                      }}
                                    >
                                      <span>Total Budget:</span>
                                      <strong>₹ {formatINR(total)}</strong>
                                    </div>

                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '12px',
                                      }}
                                    >
                                      <span>Months Total:</span>
                                      <strong>₹ {formatINR(monthsTotal)}</strong>
                                    </div>


                                    <div
                                      style={{
                                        height: '1px',
                                        backgroundColor: '#dee2e6',
                                        margin: '12px 0',
                                      }}
                                    />


                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        border: '1px solid',
                                        fontWeight: '600',
                                        fontSize: '14px',
                                        marginBottom: '8px',
                                        backgroundColor:
                                          remaining === 0
                                            ? '#d4edda'
                                            : remaining > 0
                                              ? '#fff3cd'
                                              : '#f8d7da',
                                        borderColor:
                                          remaining === 0
                                            ? '#c3e6cb'
                                            : remaining > 0
                                              ? '#ffeaa7'
                                              : '#f5c6cb',
                                      }}
                                    >
                                      <span>
                                        {remaining === 0
                                          ? 'Remaining:'
                                          : remaining > 0
                                            ? 'Remaining:'
                                            : 'Over:'}
                                      </span>
                                      <span
                                        style={{
                                          color:
                                            remaining === 0
                                              ? '#155724'
                                              : remaining > 0
                                                ? '#856404'
                                                : '#721c24',
                                        }}
                                      >
                                        ₹ {formatINR(Math.abs(remaining))}
                                      </span>
                                    </div>

                                    <div
                                      style={{
                                        marginTop: '8px',
                                        fontSize: '12px',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      {remaining === 0
                                        ? 'Perfect match!'
                                        : remaining > 0
                                          ? 'Distribute remaining across months'
                                          : 'Reduce some month amounts'}
                                    </div>

                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="totalLabelCell">
                      Total Budget (₹)
                    </td>
                    <td className="totalValueCell">{formatINR(grandTotal)}</td>

                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </fieldset>

      {!isViewMode && (
        <div
          style={{
            padding: "30px 0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <button
            type="submit"
            className="submitBudgetBtn"
            onClick={handleSubmitBudget}
            style={{
              padding: "12px 40px",
              fontSize: "16px",
              fontWeight: "700",
              backgroundColor: "#0069ab",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              minWidth: "150px",
              boxShadow: "0 6px 20px rgba(0, 105, 171, 0.3)",
              transition: "all 0.3s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#0056b3";
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 105, 171, 0.4)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#0069ab";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 105, 171, 0.3)";
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 4px rgba(0, 105, 171, 0.25)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 105, 171, 0.3)";
            }}
          >
            {isEditMode ? "Update Budget" : "Submit Budget"}
          </button>
        </div>
      )}

      <AlertModal
        show={alertConfig.show}
        onHide={closeAlert}
        message={alertConfig.message}
        type={alertConfig.type}
        title={alertConfig.title}
        onConfirm={alertConfig.onConfirm}
      />
    </div>
  );
};

export default Budget;
