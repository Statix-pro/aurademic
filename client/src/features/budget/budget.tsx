// budget.tsx - Complete Fixed Version
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate} from "react-router-dom";
import Navbar from '../.././shared/components/layout/navbar/navbar';
import Select, { MultiValue, SingleValue } from 'react-select';
import './budget.css';

// ==================== INTERFACES ====================
interface SelectOption {
  value: string;
  label: string;
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

// ==================== CONSTANTS ====================
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
  { label: 'Recurring', options: [] },
  {
    label: 'Maintenance & Spares',
    options: ['Maintenance Charges', 'Spares', 'Annual Maintenance Charges'],
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
    options: ['Events & Competitions', 'Meetings & Audits'],
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
    options: ['Advertisement & Branding', 'Public Relations', 'Admissions'],
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
    'UPS & Inverter',
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
  Vehicles: ['Two Wheeler', 'Light Motor Vehicle', 'Heavy Motor Vehicle'],
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
  'Advertisement & Branding': ['News Paper Advertisement', 'Digital Promotion'],
  'Public Relations': [
    'Press & Media',
    'Promotions',
    'Branding',
    'Corporate Gift',
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
    'DTCP Approval',
    'Licenses & Taxes',
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
    'RO & Mineral Water',
    'Audit Fees',
    'Office Expenses',
    'Pooja Expenses',
    'Fire Extinguisher',
    'First Aid Kit Expenses',
    'Irrecovable Fee',
  ],
};

const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Department: [
    'Artificial Intelligence & Data Science',
    'Biotechnology',
    'Civil Engineering',
    'Computer Science and Business Systems',
    'Computer Science and Engineering',
    'Computer Science and Engineering (AI&ML)',
    'Electrical and Electronics Engineering',
    'Electronics and Communication Engineering',
    'Food Technology',
    'Information Technology',
    'Mechanical Engineering',
    'Mechatronics Engineering',
    'Nano Science and Technology',
    'Electronics Engineering (VLSI Desing & Technology)',
    'Textile Technology',
    'Management Studies',
    'Master of Computer Applications',
    'English',
    'Tamil',
    'Mathematics',
    'Physics',
    'Chemistry',
    'Library',
    'Physical Education',
  ],
  Centre: [
    'Centre for Research & Development',
    'Centre for Sustainable Development Goals',
    'Centre for Skill Development',
    'AICTE IDEA Lab',
    'Career Guidance Academy',
    'Centre for Student Affairs',
    'Centre for IT Infrastructure',
    'KSRCT MSME Business Incubator',
    'KSRCT ACIC Incubation Foundation',
  ],
  Cell: [
    'Institutions Innovation Council',
    'Intellectual Property Rights Cell',
    'Consultancy',
    'Entrepreneurship Development Cell',
    'Higher Education Cell',
    'Alumni Cell',
    'National Cadet Corps (NCC) - Army Wing',
    'National Cadet Corps (NCC) - Air Wing',
    'National Service Scheme (NSS)',
    'Youth Red Cross (YRC)',
    'Red Ribbon Club (RRC)',
    'Unnat Bharat Abhiyan (UBA)',
    'Autonomous',
    'Internal Quality Assurance Cell',
    'Training',
    'Placement',
    'Exam Cell',
    'Admission',
    'NPTEL',
    'Women Empowerment Cell',
    'Press & Media',
  ],
  Club: [
    'Cultural Club',
    'Readers Club',
    'NDLI Club',
    'Service Motto Volunteers',
    'LifX Club',
    'Build Club',
    'Eco Care Club',
    'Drone Club',
    'Neomutant Association',
    'PAC & PMC Club',
    'Tamil Mandram',
    'Young Indians',
    'Rotaract Club',
  ],
  'Professional Body': [
    'ICT Academy',
    'Indian Society for Technical Education',
    'The Institution of Engineers (India)',
    'Institute of Electrical and Electronics Engineers',
    'Institution of Electronics and Telecommunication Engineers',
    'Indian Welding Society',
    'American Society of Mechanical Engineers',
    'SAE Collegiate Club',
    'Textile Association of India',
    'Madras Management Association',
    'IEEE Engineering in Medicine and Biology Society',
    'Confederation of Indian Industry',
    'Indian Concrete Institute',
    'Indian Geotechnical Society',
    'Association of Food Scientist & Technologists (India)',
    'Microbiologists Society, India',
    'The Indian Society of Heating, Refrigerating and Air Conditioning Engineers (ISHRAE)',
    'The Indian Institute of Welding (IIW - India)',
    'The Institute of Indian Foundrymen (IIF)',
  ],
};

const BENEFICIARY_TYPE_TO_ENTITY_API_TYPE: Record<string, string> = {
  Department: 'DEPARTMENT',
  Centre: 'CENTRE',
  Cell: 'CELL',
  Club: 'CLUB',
  'Professional Body': 'PROFESSIONAL_BODY',
};

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

// ==================== COMPONENT ====================
const Budget: React.FC = () => {
  // Form state
  const [applicantName, setApplicantName] = useState('');
  const [date, setDate] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [beneficiaryType, setBeneficiaryType] = useState('');
  const [beneficiaryValue, setBeneficiaryValue] = useState('');
  const [subcategorySelections, setSubcategorySelections] = useState<string[]>([]);
  const [categorySelections, setCategorySelections] = useState<SelectOption[]>([]);
  const [categoryItem, setCategoryItem] = useState('');
  const [subcategoryOptionsByType, setSubcategoryOptionsByType] = useState<Record<string, SelectOption[]>>({});
  const { id } = useParams(); // /budget/:id
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  // 1. Is it Edit Mode? Only if URL contains "/edit" AND we have an ID
  const isEditMode = location.pathname.includes('/edit') && !!id;

  // 2. Is it View Mode? If we have an ID but NOT in Edit Mode
  const isViewMode = !!id && !location.pathname.includes('/edit');

  // 3. Is it New Mode? If no ID
  const isNewMode = !id;

  // 4. Combined Editable Flag
  // Allows editing if: (New Mode) OR (Edit Mode AND Status allows it - set later)
  const [isEditable, setIsEditable] = useState(isNewMode); 
  const [isApplicantCardOpen, setIsApplicantCardOpen] = useState(!id); 
  
  const getCurrentFY = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fyStart = month >= 4 ? year : year - 1;
    return `${fyStart}-${String(fyStart + 1).slice(2)}`;
  };

  // ✅ 2. Define State NEXT (This holds the value)
  const [explicitFiscalYear, setExplicitFiscalYear] = useState<string>(
    location.state?.fiscalYear || getCurrentFY()
  );

  // Budget lines state
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

  // Helper functions
  const getSubcategoryLabel = (type: string): string => {
    if (!type) return 'Sub category';
    if (type.includes(' ')) return type;
    return type.replace(/([A-Z])/g, ' $1').trim();
  };

  const isMultipleSelect = (type: string): boolean => {
    return ['Faculty_Team', 'Student_Team'].includes(type);
  };

  const fallbackSubcategoryList = beneficiaryType
    ? SUBCATEGORY_OPTIONS[beneficiaryType as keyof typeof SUBCATEGORY_OPTIONS] || []
    : [];

  const fetchedSubcategoryOptions = beneficiaryType
    ? subcategoryOptionsByType[beneficiaryType] || []
    : [];

  const subcategoryList =
    fetchedSubcategoryOptions.length > 0
      ? fetchedSubcategoryOptions.map((option) => option.value)
      : fallbackSubcategoryList;

  const subcategoryOptions: SelectOption[] =
    fetchedSubcategoryOptions.length > 0
      ? fetchedSubcategoryOptions
      : fallbackSubcategoryList.map((value) => ({
          value,
          label: value,
        }));

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

  // Budget line operations
  const getSubHeads = (head: string) => SUB_HEAD_BY_BUDGET_HEAD[head] || [];

  const updateLine = (index: number, field: keyof BudgetLine, value: string) => {
    setBudgetLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      // Clear subHead when budgetHead changes
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

 // CORRECT NAME from your file (line 29)
const getFilteredBudgetHeads = (search: string): string[] => {
  const query = search.toLowerCase();
  return BUDGET_HEAD_GROUPS.flatMap(group => 
    group.options.filter(opt => opt.toLowerCase().includes(query))
  );
};
// At top of component, after budgetLines state
const [budgetHeadFilter, setBudgetHeadFilter] = useState<Record<number, string>>({});
const [budgetHeadFilters, setBudgetHeadFilters] = useState<Record<number, string>>({});

// Helper: returns filtered options for one row
const getFilteredBudgetHeadGroups = (rowIndex: number) => {
  const query = (budgetHeadFilter[rowIndex] || '').toLowerCase();
  if (!query) return BUDGET_HEAD_GROUPS;

  return BUDGET_HEAD_GROUPS.map(group => ({
    ...group,
    options: group.options.filter(opt =>
      opt.toLowerCase().includes(query)
    ),
  })).filter(group => group.options.length > 0);
};


  // ==================== SUBMIT HANDLER (UPGRADED + BACKEND SAFE) ====================
  const handleSubmitBudget = async () => {
    // 1️⃣ Basic Validation
    if (!budgetLines.length) {
      alert('Please add at least one budget line.');
      return;
    }

    // Validate required fields inside each line
    for (let i = 0; i < budgetLines.length; i++) {
      const line = budgetLines[i];
      if (!line.budgetHead?.trim()) {
        alert(`Line ${i + 1}: Budget Head is required`);
        return;
      }
      if (!line.amount || Number(line.amount) <= 0) {
        alert(`Line ${i + 1}: Valid Unit Amount is required`);
        return;
      }
    }

    // 2️⃣ Map Lines
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

    // ✅ 3️⃣ CALCULATE FISCAL YEAR INT
    // Convert to String first to prevent errors if it's already a number
    const safeFY = String(explicitFiscalYear); 
    const fiscalYearInt = parseInt(safeFY.split("-")[0]);

    // Debug check
    if (isNaN(fiscalYearInt)) {
      alert("Error: Invalid Fiscal Year calculated. Please refresh.");
      return;
    }

    // 4️⃣ Construct Payload (Included fiscal_year)
    const payload = {
      request_date: date,
      fiscal_year: fiscalYearInt, // 👈 THIS WAS MISSING OR INVALID
      beneficiary_type: beneficiaryType?.trim(),
      beneficiary_value:
        beneficiaryType === 'Faculty'
          ? applicantName?.trim()
          : beneficiaryType === 'Institution'
          ? 'K.S.Rangasamy College of Technology'
          : categoryItem?.trim(),
      department: department?.trim(),
      proposal_description: '',
      lines: formattedLines,
    };

    try {
      console.log('🚀 Submitting Payload:', payload); // Check console to see if fiscal_year is there

      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        alert('❌ Authentication Error: You are not logged in.');
        return;
      }

      const httpMethod = isEditMode ? 'PUT' : 'POST';
      const endpoint = isEditMode
        ? `http://localhost:5000/api/budget/${id}`
        : 'http://localhost:5000/api/budget';

      const response = await fetch(endpoint, {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Submission failed on server');
      }

      alert(
        isEditMode
          ? `✅ Budget updated successfully!`
          : `✅ Budget submitted successfully! Reference: ${result.data.proposalRef}`
      );

      // Reset form if new
      if (!isEditMode) {
        setBudgetLines([{
           budgetHead: '', subHead: '', amount: '', qty: '1', monthAmounts: { ...EMPTY_MONTHS }, description: '',
        }]);
        setExpandedRows([0]);
        setApplicantName(''); setDepartment(''); setDesignation(''); setEmail(''); setMobile('');
        setBeneficiaryType(''); setBeneficiaryValue(''); setCategoryItem('');
        const today = new Date().toISOString().split('T')[0];
        setDate(today);
      }

      navigate("/budgetcard"); // Or whatever your dashboard route is, e.g., "/budget-dashboard"
    } catch (error: any) {
      console.error('❌ Submit error:', error);
      alert(`Failed to submit: ${error.message}`);
    }
  };


  // ==================== EFFECTS ====================
  useEffect(() => {
    let cancelled = false;

    const loadBeneficiaryOptions = async () => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) return;

      const nextOptions: Record<string, SelectOption[]> = {};

      await Promise.all(
        Object.entries(BENEFICIARY_TYPE_TO_ENTITY_API_TYPE).map(async ([beneficiaryKey, apiType]) => {
          try {
            const response = await fetch(`http://localhost:5000/api/budget/org-units/${apiType}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to load ${beneficiaryKey} options`);
            }

            const json = await response.json();
            const rows = Array.isArray(json?.data) ? json.data : [];

            nextOptions[beneficiaryKey] = rows
              .map((row: any) => normalizeText(row?.name))
              .filter(Boolean)
              .map((name: string) => ({ value: name, label: name }));
          } catch (error) {
            nextOptions[beneficiaryKey] = (
              SUBCATEGORY_OPTIONS[beneficiaryKey as keyof typeof SUBCATEGORY_OPTIONS] || []
            ).map((name) => ({ value: name, label: name }));
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
    console.log('Expanded rows:', expandedRows, 'Lines count:', budgetLines.length);
  }, [expandedRows, budgetLines.length]);

  useEffect(() => {
    if (beneficiaryType === 'Institution') {
      setBeneficiaryValue('K.S.Rangasamy College of Technology');
    } else if (beneficiaryType === 'Faculty') {
      if (applicantName.trim() && !beneficiaryValue) {
        setBeneficiaryValue(applicantName);
      }
    } else {
      setBeneficiaryValue('');
      setCategoryItem('');
    }
  }, [beneficiaryType, applicantName]);

  // ✅ LOAD PROPOSAL DATA FOR VIEW/EDIT MODE
  useEffect(() => {
    if (!id) return;

    const loadProposal = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!token) return;

        const res = await fetch(`http://localhost:5000/api/budget/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json();
        if (!res.ok || !json?.success) {
          console.error("Failed to load proposal", json);
          return;
        }

        const data = json.data;
        const p = data.master || data;

        if (!p) {
          console.error("No proposal data found");
          return;
        }

        // --- 1. PREFILL APPLICANT DETAILS (FIXED) ---
        // We check multiple possible keys because backend joins might name them differently
        setApplicantName(p.applicant_name || p.user_name || p.name || "");
        setEmail(p.user_email || p.email || "");
        
        // MISSING FIELDS ADDED HERE:
        setDesignation(p.designation || p.user_designation || ""); 
        setMobile(p.mobile || p.user_mobile || p.phone || "");

        // --- 2. PREFILL BENEFICIARY & DEPARTMENT (FIXED) ---
        const normalizedBeneficiaryType =
          p.beneficiary_type === 'ProfessionalBodies'
            ? 'Professional Body'
            : p.beneficiary_type || '';
        setBeneficiaryType(normalizedBeneficiaryType);
        
        // Fix for "Value not displayed": Ensure we set the specific value state
        setBeneficiaryValue(p.beneficiary_value || ""); 
        // Also set 'categoryItem' if your UI uses that for the second dropdown
        setCategoryItem(p.beneficiary_value || ""); 

        // Fix for Department: Fallback to user_department if proposal department is empty
        setDepartment(p.department || p.user_department || ""); 
        
        // Date
        setDate((p.request_date || "").split("T")[0]);

        // --- 3. PREFILL BUDGET LINES (Existing Logic) ---
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

        // --- 4. SET EDITABLE STATE ---
        const editableStatuses = ['draft', 'hod_returned', 'dof_returned', 'submitted'];
        const isStatusEditable = editableStatuses.includes((p.status || '').toLowerCase());
        const isEditURL = location.pathname.includes('/edit');

        if (!isEditURL) {
          setIsEditable(false);
          setExpandedRows(mappedLines.map((_, idx) => idx)); // Auto-expand in view
        } else if (isEditURL && !isStatusEditable) {
          alert(`⚠️ This proposal cannot be edited because it is currently '${p.status}'. Switching to View mode.`);
          setIsEditable(false);
          navigate(`/budget/${id}`);
        } else {
          setIsEditable(true);
        }

      } catch (e) {
        console.error("loadProposal error", e);
      }
    };

    loadProposal();
  }, [id, location.pathname, navigate]);

      // ✅ AUTO-FILL USER DETAILS (New Form Only)
  useEffect(() => {
    // Only run if it's a new form (no ID) and name is empty
    if (id || applicantName) return;

    const fetchUserDetails = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!token) return;

        // ✅ Correct Path: Matches router.get('/faculty', ...)
        const res = await fetch('http://localhost:5000/api/budget/faculty', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const json = await res.json();
        if (json.success && json.data) {
          setApplicantName(json.data.name || '');
          setDepartment(json.data.department || '');
          setEmail(json.data.email || '');
          
          // ✅ Add these since we updated the backend to provide them
          if (json.data.designation) setDesignation(json.data.designation);
          if (json.data.mobile) setMobile(json.data.mobile);
        }
      } catch (error) {
        console.error("Failed to auto-fill user details", error);
      }
    };

    fetchUserDetails();
  }, [id, applicantName]); 



  // ==================== RENDER ====================
  return (
    <div className="budgetPage">
      <Navbar />
      <fieldset disabled={isViewMode} style={{ border: 0, padding: 0, margin: 0 }}>
             {/* Card 1: Applicant Details (Collapsible Preview) */}
        <div className="budgetCard">
          {/* Header - Always visible */}
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
            
            {/* Toggle Arrow - EXACT match to table arrows */}
            <svg 
              width="12" 
              height="8" 
              viewBox="0 0 12 8" 
              className={`card-toggle-arrow ${isApplicantCardOpen ? 'open' : ''}`}
              style={{
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',  // Same smooth animation
                cursor: 'pointer'
              }}
            >
              <polyline 
                points="1.5,1.5 6,5.5 10.5,1.5" 
                stroke="#0069ab"    // Blue to match header color
                strokeWidth="1.5" 
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>

          </div>

          {/* Body Content */}
          <div className="cardContent" style={{ padding: '20px' }}>
            
            {/* STATE 1: COLLAPSED PREVIEW (Only Name & Date) */}
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
                        disabled={true} // Preview is read-only or disabled to indicate "click header to edit"
                        placeholder="Enter full name"
                        className="budget-input"
                        style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', cursor: 'pointer' }}
                        onClick={() => setIsApplicantCardOpen(true)} // Click input to open full form
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
                        type="date" // Use text for better formatting in preview if preferred
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

            {/* STATE 2: EXPANDED FULL FORM */}
            {isApplicantCardOpen && (
              <>
                <div className="row mb-3" style={{ marginBottom: '15px' }}>
                  <div className="col-md-7">
                    <div className="formGroup">
                      <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                        Applicant Name
                      </label>
                      <input
                        type="text"
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        disabled={!isEditable}
                        placeholder="Enter full name"
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

        {/* Card 2: Beneficiary Details - Description Box Removed */}
              {/* Card 2: Beneficiary Details */}
        <div className="budgetCard">
          <div className="cardContent">
            <div className="row mb-3" style={{ marginBottom: '15px' }}>
              <div className="col-md-6">
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
          height: 36,                     // ← FIXED: Number, not string
          borderRadius: 12,               // ← FIXED: Number
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

              <div className="col-md-6">
  {beneficiaryType === 'Faculty' ? (
    <div className="form-group" style={{ height: '72px', display: 'flex', flexDirection: 'column' }}>
      <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block', flexShrink: 0 }}>
        Faculty Name
      </label>
      <input
        type="text"
        value={beneficiaryValue || ''}
        onChange={(e) => setBeneficiaryValue(e.target.value)}
        placeholder="Applicant name"
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


        {/* Card 3: Budget Table */}
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
                    <th style={{ width: '10%' }}>₹Total</th>
                    <th style={{ width: '15%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetLines.map((line, idx) => {
                    const total = lineTotal(line);
                    const monthsTotal = lineMonthsTotal(line);
                    const remaining = total - monthsTotal;

                    return (
                      <React.Fragment key={idx}>
                        {/* Main row */}
                        <tr>
                          <td className="centerTd">{idx + 1}</td>
               <td>
  <Select
    className="tableSelect"
    value={
      line.budgetHead 
        ? { value: line.budgetHead, label: line.budgetHead } as SelectOption
        : null
    }
    onChange={(selected: any) => {
      const val = selected?.value || '';
      updateLine(idx, 'budgetHead', val);
    }}
    options={BUDGET_HEAD_GROUPS.map(group => ({
      label: group.label,
      options: group.options.map(opt => ({
        value: opt,
        label: opt
      } as SelectOption))
    }))}
    placeholder=""
    isSearchable={true}
    isClearable={false}
    isDisabled={!isEditable}
    maxMenuHeight={200}
    menuPlacement="auto"
    formatGroupLabel={(group: any) => (
      <div style={{
        fontWeight: 'bold',
        fontSize: '13px',
        color: '#495057',
        padding: '10px 12px 6px',
        background: '#e9ecef',
        borderBottom: '1px solid #dee2e6',
        marginBottom: '4px'
      }}>
        {group.label}
      </div>
    )}
    styles={{
      control: (base: any, state: any) => ({
        ...base,
        minHeight: '38px !important',
        height: '38px !important',           // ← FIXED: Force single height
        borderRadius: '4px',
        border: state.isFocused             // ← FIXED: Single clean border
          ? '2px solid #0069ab' 
          : '1px solid #e0e0e0',
        boxShadow: 'none !important',       // ← FIXED: No double border/shadow
        backgroundColor: '#fff'
      }),
      dropdownIndicator: (base: any, state: any) => ({
        ...base,
        padding: '4px 8px',
        transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)'
      }),
      indicatorSeparator: () => ({ display: 'none' }),
      menu: (base: any) => ({
        ...base,
        marginTop: '2px',
        zIndex: 9999,
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }),
      groupHeading: (base: any) => ({
        ...base,
        fontWeight: 'bold',
        fontSize: '13px'
      }),
      option: (base: any, state: any) => ({
        ...base,
        padding: '8px 12px',
        backgroundColor: state.isSelected 
          ? '#0069ab' 
          : state.isFocused 
          ? 'rgba(0,105,171,0.1)' 
          : 'white'
      })
    }}
  />
</td>

<td>
  <Select
    className="tableSelect"
    value={
      line.subHead 
        ? { value: line.subHead, label: line.subHead } as SelectOption
        : null
    }
    onChange={(selected: any) => {
      const val = selected?.value || '';
      updateLine(idx, 'subHead', val);
    }}
    options={getSubHeads(line.budgetHead).map(sub => ({
      value: sub,
      label: sub
    }))}
    placeholder=""
    isSearchable={true}
    isClearable={false}
    isDisabled={!line.budgetHead || !isEditable}
    maxMenuHeight={200}
    styles={{
      control: (base: any, state: any) => ({
        ...base,
        minHeight: '38px !important',       // ← FIXED: Single height
        height: '38px !important',          // ← FIXED: Single height
        borderRadius: '4px',
        border: state.isFocused             // ← FIXED: Single clean border
          ? '2px solid #0069ab' 
          : '1px solid #e0e0e0',
        boxShadow: 'none !important',       // ← FIXED: No double border
        backgroundColor: '#fff'
      }),
      dropdownIndicator: (base: any, state: any) => ({
        ...base,
        padding: '4px 8px',
        transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)'
      }),
      indicatorSeparator: () => ({ display: 'none' }),
      menu: (base: any) => ({
        ...base,
        marginTop: '2px',
        zIndex: 9999,
        borderRadius: '4px'
      }),
      option: (base: any, state: any) => ({
        ...base,
        padding: '8px 12px',
        backgroundColor: state.isSelected 
          ? '#0069ab' 
          : state.isFocused 
          ? 'rgba(0,105,171,0.1)' 
          : 'white'
      })
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
                          <td className="centerTd totalCell">₹ {total}</td>

                          {/* Actions column */}
                          <td 
                            className="centerTd" 
                            style={{
                              padding: '8px 4px !important',  // ← Match table cell padding
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '80px', 
                              gap: '2px'
                            }}
                          >
                            {/* Arrow - EXACT budget head dropdown match */}
                            <button 
                              type="button"
                              onClick={() => toggleRowSchedule(idx)}
                              title="Month schedule"
                              style={{
                                width: '24px',
                                height: '24px',
                                padding: 0,           // ← Zero padding for perfect centering
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
                                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',  // ← EXACT Select animation
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
                                  if (!line.description?.trim())
                                    missing.push('Description');
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
                                  hasZeroAmountLine(budgetLines)
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

                        {/* Expanded schedule row */}
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
                                  {/* Left: month inputs */}
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

                                  {/* Right: totals and remaining */}
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
                                      <strong>₹ {total}</strong>
                                    </div>

                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '12px',
                                      }}
                                    >
                                      <span>Months Total:</span>
                                      <strong>₹ {monthsTotal}</strong>
                                    </div>

                                    <div
                                      style={{
                                        height: '1px',
                                        backgroundColor: '#dee2e6',
                                        margin: '12px 0',
                                      }}
                                    />

                                    {/* Color-coded remaining box */}
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
                                        ₹ {Math.abs(remaining)}
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
                      Total Budget
                    </td>
                    <td className="totalValueCell">₹ {grandTotal}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </fieldset>
      {/* Submit Button */}
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
    </div>
  );
};

export default Budget;
