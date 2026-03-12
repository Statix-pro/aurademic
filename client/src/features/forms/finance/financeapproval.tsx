import React, { useState, useRef, CSSProperties, useEffect, ChangeEvent, MouseEvent } from 'react';
import Select, { MultiValue, StylesConfig, ControlProps, GroupBase, CSSObjectWithLabel } from 'react-select';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'bootstrap/dist/css/bootstrap.min.css';
import './financeapproval.css';
import KSRCTLogo from '../../../shared/assets/images/ksrct_logo.png';

import authenticityUtility from '../../../shared/utils/authenticityUtility';
import CustomTagInput from '../../../shared/components/ui/CustomTagInput';
import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
interface SelectOption {
  value: string;
  label: string;
}

interface BudgetRow {
  category: string;
  head: string;
  amount: string;

}

interface BudgetHeadByCategory {
  Individual: string[];
  Cell: string[];
}
interface BudgetHeadGroup {
  label: string;      // group label (bold text)
  options: string[];  // selectable options under that group
}
const selectStyles: StylesConfig<SelectOption, true, GroupBase<SelectOption>> = {
  control: (base: CSSObjectWithLabel, state: ControlProps<SelectOption, true, GroupBase<SelectOption>>) => ({
    ...base,
    // ✅ Same as your single-selects:
    minHeight: "40px",  // Matches input height
    borderColor: "#e0e0e0",  // Matches input border
    borderRadius: "12px",    // Matches input borderRadius
    boxShadow: state.isFocused
      ? "0 0 0 3px rgba(0, 105, 171, 0.15)"  // Focus glow like inputs
      : "none",
    backgroundColor: "#fcfdff",  // Matches input bg
    fontSize: "0.95rem",
    padding: "0 12px",  // Matches input padding
    borderWidth: "1px",  // Explicit border
  } as CSSObjectWithLabel),

  valueContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "2px 12px",  // Fine-tune chip padding
  } as CSSObjectWithLabel),

  input: (base: CSSObjectWithLabel) => ({
    ...base,
    margin: "0px",
    padding: "0",
  } as CSSObjectWithLabel),

  multiValue: (base: CSSObjectWithLabel) => ({
    ...base,
    backgroundColor: "#e9ecef",  // Chip bg
    borderRadius: "6px",
    margin: "2px 4px 2px 0",
    padding: "2px 8px",
    fontSize: "0.85rem",
  } as CSSObjectWithLabel),

  multiValueLabel: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "#495057",
  } as CSSObjectWithLabel),

  multiValueRemove: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "#6c757d",
    ":hover": {
      backgroundColor: "#dc3545",
      color: "white",
    },
  } as CSSObjectWithLabel),

  indicatorsContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "0 8px",
  } as CSSObjectWithLabel),

  menu: (base: CSSObjectWithLabel) => ({
    ...base,
    zIndex: 9999,
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
  } as CSSObjectWithLabel),

  option: (base: CSSObjectWithLabel, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#0069ab"
      : state.isFocused
        ? "#f0f6ff"
        : "white",
    color: state.isSelected ? "white" : "#495057",
    cursor: "pointer",
  } as CSSObjectWithLabel),
};

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
interface BudgetHeadGroup {
  label: string;      // group label (bold text)
  options: string[];  // selectable options under that group
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
const SUB_HEAD_BY_BUDGET_HEAD: Record<string, string[]> = {
  // Non-Recurring
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

  // Maintenance & Spares
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

  // Operational
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

  // Events & Engagement
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

  // Academics
  'Faculty Empowerment': [
    'Registration fee',
    'Travel Allowance',
    'Food & Refreshment',
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

  // Branding & Outreach
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

  // General
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
    'RO Mineral Water',
    'Audit Fees',
    'Office Expenses',
    'Pooja Expenses',
    'Fire Extinguisher',
    'First Aid Kit Expenses',
    'Irrecovable Fee',
  ],
};

const FinanceApproval: React.FC = () => {
  const [applicantName, setApplicantName] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [designation, setDesignation] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [individualSelections, setIndividualSelections] = useState<SelectOption[]>([]);
  const [cellSelections, setCellSelections] = useState<SelectOption[]>([]);
  const [description, setDescription] = useState<string>('');
  const [amountProposed, setAmountProposed] = useState<string>('');
  const [amountUtilized, setAmountUtilized] = useState<string>('');
  const [amountRequested, setAmountRequested] = useState<string>('');
  const [directorComments, setDirectorComments] = useState<string>('');
  const [directorStatus, setDirectorStatus] = useState<string>('');
  const [principalComments, setPrincipalComments] = useState<string>('');
  const [principalStatus, setPrincipalStatus] = useState<string>('');
  const [principalPriority, setPrincipalPriority] = useState<string>('');
  const [chairmanComments, setChairmanComments] = useState<string>('');
  const [chairmanStatus, setChairmanStatus] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isBudgetProposed, setIsBudgetProposed] = useState<string>('');
  const [balanceAmount, setBalanceAmount] = useState<string>('');
  const [debitStatus, setDebitStatus] = useState<'credited' | 'reimbursement' | ''>('');
  const [email, setEmail] = useState<string>('');  // ✅ ADD THIS LINE
  const [enclosureSelections, setEnclosureSelections] = useState<SelectOption[]>([]);

  const [budgetRows, setBudgetRows] = useState([
    { category: "", head: "", amount: "" },
    // more rows...
  ]);

  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const componentRef = useRef<HTMLDivElement>(null);
  const getSubHeadOptions = (budgetHead: string): string[] =>
    SUB_HEAD_BY_BUDGET_HEAD[budgetHead] ?? [];



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

  const onPrintClick = (): void => {
    handlePrint();
  };

  const generatePDF = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const element = componentRef.current;
      if (!element) {
        showAlert('Preview not available. Please show preview first.', 'warning');
        return;
      }

      // Optimized html2canvas: lower scale, quality, remove unnecessary options
      const canvas = await html2canvas(element, {
        scale: 2.5,        // Reduced from 3 → 1.5 (still sharp, 4x smaller)
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        imageTimeout: 15000,
        removeContainer: true  // Garbage collect after render
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png', 0.8);  // Compress PNG 80% quality
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;

      // Single page first (most forms fit)
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);

      // Only add pages if truly needed
      if (heightLeft > pdf.internal.pageSize.getHeight()) {
        heightLeft -= pdf.internal.pageSize.getHeight();
        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();
        }
      }

      pdf.save('FinanceApprovalRequest.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showAlert('Error generating PDF. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatSelections = (selections: SelectOption[]): string => {
    return selections.map(sel => sel.value).join(', ') || '';
  };

  const handleAddRow = () => {
    // ✅ Get first row's category (e.g., "Equipment")
    const firstRowCategory = budgetRows[0]?.category || '';

    setBudgetRows(prev => [
      ...prev,
      {
        category: firstRowCategory,  // ✅ Auto-fill from first row
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
      updated[index] = { ...updated[index], category: value, head: '' };  // ✅ Clear head!
    } else if (field === 'amount') {
      let num = Number(value) || 0;
      if (num > MAX_AMOUNT) num = MAX_AMOUNT;
      updated[index][field] = num.toString();
    } else {
      updated[index][field] = value;
    }
    setBudgetRows(updated);
  };

  const totalBudget = budgetRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);


  const actionCell: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
  };

  const iconBtn: CSSProperties = {
    width: '40px',
    height: '40px',
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
  };

  const inputStyle: CSSProperties = {
    border: '1px solid #ced4da',
    borderRadius: '0.25rem',
    padding: '6px 8px',
    fontSize: '0.95rem',
    width: '100%',
    fontFamily: 'inherit',
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
      setCategoryType('');           // ✅ Current category dropdown
      setCategoryItem('');           // ✅ Current subcategory dropdown  
      setPrimaryHead('');            // ✅ Current primary budget head
      setEventSubHead('');           // ✅ Current event subhead
      setIncomeType('');
      setIncomeStatus('');
      setIncomeAmountType('' as 'complete' | 'partial' | '');
      setCreditStatus('');
      setDebitStatus('');
      setBalanceAmount('');
      setIsBudgetProposed('');
      setBudgetRows([{ category: '', head: '', amount: '' }]);
      setEnclosureSelections([]);
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
    return category; // or customize per type if you want
  };
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryType, setCategoryType] = useState<string>('');
  const [categoryItem, setCategoryItem] = useState<string>('');
  const subcategoryList = SUBCATEGORY_OPTIONS[categoryType] ?? [];
  const hasSubcategories = subcategoryList.length > 0;
  const subcategoryOptions: SelectOption[] = subcategoryList.map((s) => ({
    value: s,
    label: s,
  }));
  const isMultipleSelect = (type: string) =>
    type === "Faculty_Team" || type === "Student_Team";

  const [partialAmount, setPartialAmount] = useState<string>("");
  const [categorySelections, setCategorySelections] = useState<MultiValue<SelectOption>>([]);

  const [primaryHead, setPrimaryHead] = useState<string>('');
  const [eventSubHead, setEventSubHead] = useState<string>('');
  const [incomeType, setIncomeType] = useState<string>('');
  const [incomeStatus, setIncomeStatus] = useState<string>('');
  const [incomeAmountType, setIncomeAmountType] = useState<'complete' | 'partial' | ''>('');
  const [creditStatus, setCreditStatus] = useState<string>(""); // Empty string
  const MAX_AMOUNT = 999999999; // 9,99,99,999
  const [selectedBudgetHeadForModal, setSelectedBudgetHeadForModal] = useState<string>('');
  const [showBudgetHeadModal, setShowBudgetHeadModal] = useState<boolean>(false);
  // Modal for viewing budget head details
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

  const numberToIndianWords = (num: number): string => {
    if (num === 0) return "Zero rupees only";

    const a = [
      "", "One", "Two", "Three", "Four", "Five", "Six",
      "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
      "Thirteen", "Fourteen", "Fifteen", "Sixteen",
      "Seventeen", "Eighteen", "Nineteen",
    ];
    const b = [
      "", "", "Twenty", "Thirty", "Forty", "Fifty",
      "Sixty", "Seventy", "Eighty", "Ninety",
    ];

    const inWordsBelowThousand = (n: number): string => {
      let str = "";
      if (n > 99) {
        str += a[Math.floor(n / 100)] + " hundred ";
        n = n % 100;
      }
      if (n > 19) {
        str += b[Math.floor(n / 10)]!.toLowerCase() + " ";  // ✅ Lowercase except first
        n = n % 10;
      }
      if (n > 0) {
        str += a[n]!.toLowerCase().replace(/^./, c => c.toUpperCase()) + " ";  // ✅ First letter only
      }
      return str.trim();
    };

    let n = Math.floor(num);
    let result = "";

    const crore = Math.floor(n / 10000000);
    if (crore) {
      result += inWordsBelowThousand(crore) + " crore ";  // ✅ Lowercase units
      n %= 10000000;
    }

    const lakh = Math.floor(n / 100000);
    if (lakh) {
      result += inWordsBelowThousand(lakh) + " lakh ";
      n %= 100000;
    }

    const thousand = Math.floor(n / 1000);
    if (thousand) {
      result += inWordsBelowThousand(thousand) + " thousand ";
      n %= 1000;
    }

    if (n > 0) {
      result += inWordsBelowThousand(n);
    }

    // ✅ Title case: First letter upper, rest lower (e.g., "One Crore Twenty Lakh Only")
    const titleCased = result.trim()
      .replace(/\b\w/g, l => l.toUpperCase())  // First letter of each word UPPER
      .replace(/[A-Z]{2,}/g, m => m.charAt(0) + m.slice(1).toLowerCase());  // Rest lowercase

    return titleCased + " Rupees only";
  };
  const formatDMY = (value: string | Date | null | undefined) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  useEffect(() => {
    if (showPreview && componentRef.current) {
      const contentHeight = componentRef.current.scrollHeight;
      const pageHeight = 270; // A4 content area in px (adjust if needed)
      setTotalPages(Math.ceil(contentHeight / pageHeight));
    }
  }, [showPreview, applicantName, department, totalBudget, /* add your data states */]);
  const extraDropdownVisible =
    primaryHead === 'Events & Competitions' ||
    primaryHead === 'Meetings & Audits';

  return (
    <div style={{ padding: '0', backgroundColor: '#f0f6ff', minHeight: '100vh' }}>


      {!showPreview && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 30px' }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '24px',
            marginBottom: '30px',
            marginTop: '30px',

            /* 👇 CURVY EFFECT */
            borderRadius: '18px',

            /* 👇 SOFT CARD SHADOW */
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
          }}>

            {/* Top Row: Name, Date, Mobile */}
            <div className="row mb-3" style={{ marginBottom: '15px' }}>
              <div className="col-md-6">
                <div className="form-group">
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>Applicant Name: <span style={{ color: 'red' }}></span></label>
                  <input
                    type="text"
                    value={applicantName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setApplicantName(e.target.value)}
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #e0e0e0',
                      padding: '10px 15px',
                      fontSize: '0.95rem',
                      width: '100%',
                      fontFamily: 'inherit',
                      backgroundColor: '#fcfdff',
                      transition: 'all 0.3s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#0069ab';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e0e0e0';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    placeholder="Enter full name"
                    required
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-group">
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                    Date: <span style={{ color: 'red' }}>*</span>
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

            {/* Bottom Row: Designation, Department */}
            <div className="row md-3" style={{ marginBottom: '15px' }}>
              <div className="col-md-6">
                <div className="form-group">
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>Designation:</label>
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
              <div className="col-md-6">
                <div className="form-group">
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '6px', fontWeight: '600', display: 'block' }}>Mobile: <span style={{ color: 'red' }}>   </span></label>
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


              <div className="col-md-6">
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
              <div className="col-md-6">
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
                    Email:
                  </label>
                  <input
                    type="email"
                    value={email}           // ✅ Add this
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
            </div>
            {/* Description Field */}

          </div>
          <div style={{
            backgroundColor: '#fff',
            padding: '30px',
            borderRadius: '20px',
            marginBottom: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            {/* Category row */}
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
                  {/* Category row */}
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label style={{ fontSize: "14px", color: "#495057", marginBottom: "8px", fontWeight: 600, display: "block" }}>Category</label>
                        <select
                          value={categoryType}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            const next = e.target.value;
                            setCategoryType(next);
                            setCategoryItem("");
                            setCategorySelections([]);
                          }}
                          style={{
                            borderRadius: "12px",
                            border: "1px solid #e0e0e0",
                            padding: "10px 15px",
                            fontSize: "0.95rem",
                            width: "100%",
                            fontFamily: "inherit",
                            backgroundColor: "#fcfdff",
                            transition: "all 0.3s ease",
                            cursor: "pointer",
                          }}
                        >
                          <option value="" disabled hidden></option>
                          <option value="Individual Faculty">Individual Faculty</option>
                          <option value="Faculty_Team">Faculty Team</option>
                          <option value="Student_Team">Student Team</option>
                          <option value="Department">Department</option>
                          <option value="Centre">Centre</option>
                          <option value="Cell">Cell</option>
                          <option value="Club">Club</option>
                          <option value="Institution">Institution</option>
                        </select>
                      </div>
                    </div>

                    {hasSubcategories && (
                      <div className="col-md-6">
                        <div className="form-group">
                          <label style={{ fontSize: "14px", color: "#495057", marginBottom: "8px", fontWeight: 600, display: "block" }}>
                            {getSubcategoryLabel(categoryType)}
                          </label>

                          {isMultipleSelect(categoryType) ? (
                            <Select
                              isMulti
                              closeMenuOnSelect={false}
                              value={categorySelections}
                              onChange={(selected) => {
                                const vals = (selected as MultiValue<SelectOption>) ?? [];
                                setCategorySelections(vals);
                                setCategoryItem(vals.map((v) => v.value).join(", "));
                              }}
                              options={subcategoryOptions}
                              styles={selectStyles}
                              components={{ IndicatorSeparator: () => null }}
                              placeholder=""
                            />
                          ) : (
                            <select
                              value={categoryItem}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                setCategoryItem(e.target.value);
                                setCategorySelections([]);
                              }}
                              style={{
                                borderRadius: "12px",
                                border: "1px solid #e0e0e0",
                                padding: "10px 15px",
                                fontSize: "0.95rem",
                                width: "100%",
                                fontFamily: "inherit",
                                backgroundColor: "#fcfdff",
                                transition: "all 0.3s ease",
                                cursor: "pointer",
                              }}
                            >
                              <option value="" disabled hidden />
                              {subcategoryList.map((sub) => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    )}
                  </div>




                </div>
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>Description:</label>
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
              padding: '30px',
              borderRadius: '20px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            {/* Top row: primary head (left) + amount proposed (right) */}
            <div className="row mb-3">
              {/* Left half: Primary budget head */}
              <div className="col-md-6">
                <div className="form-group">
                  <label
                    style={{
                      fontSize: '14px',
                      color: '#495057',
                      marginBottom: '8px',
                      fontWeight: 600,
                      display: 'block',
                    }}
                  >
                    Head of Accounts
                  </label>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                    {/* Primary dropdown */}
                    <select
                      value={primaryHead}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setPrimaryHead(e.target.value);
                        setEventSubHead("");
                      }}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #e0e0e0',
                        padding: '10px 15px',
                        fontSize: '0.95rem',
                        width: extraDropdownVisible ? '50%' : 'calc(100% - 50px)',
                        fontFamily: 'inherit',
                        backgroundColor: '#fcfdff',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                      }}
                    >

                      <optgroup label="Non-Recurring">
                        <option value="" disabled selected hidden></option>
                        <option value="Civil Infrastructure">Civil Infrastructure</option>
                        <option value="Electrical Infrastructure">Electrical Infrastructure</option>
                        <option value="IT Infrastructure">IT Infrastructure</option>
                        <option value="Furniture & Fixtures">Furniture & Fixtures</option>
                        <option value="Vehicles">Vehicles</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Accessories & Kits">Accessories & Kits</option>
                      </optgroup>

                      <optgroup label="Recurring">
                        <optgroup label="Maintenance & Spares">
                          <option value="Maintenance Charges">Maintenance Charges</option>
                          <option value="Spares">Spares</option>
                          <option value="Annual Maintenance Charges">
                            Annual Maintenance Charges
                          </option>
                        </optgroup>
                      </optgroup>

                      <optgroup label="Operational">
                        <option value="Consumables">Consumables</option>
                        <option value="Software">Software</option>
                        <option value="Membership & Subscriptions">
                          Membership & Subscriptions
                        </option>
                        <option value="Student Essentials">Student Essentials</option>
                        <option value="Printing & Stationery">Printing & Stationery</option>
                        <option value="Postal Expenses">Postal Expenses</option>
                        <option value="Local Conveyance">Local Conveyance</option>
                      </optgroup>

                      <optgroup label="Events & Engagement">
                        <option value="Events & Competitions">Events & Competitions</option>
                        <option value="Meetings & Audits">Meetings & Audits</option>
                      </optgroup>

                      <optgroup label="Academics">
                        <option value="Faculty Empowerment">Faculty Empowerment</option>
                        <option value="Staff Empowerment">Staff Empowerment</option>
                        <option value="Sudent Empowerment">Sudent Empowerment</option>
                        <option value="Student Capacity Building">
                          Student Capacity Building
                        </option>
                        <option value="Learning Resources">Learning Resources</option>
                        <option value="Accreditation Expenses">Accreditation Expenses</option>
                        <option value="Professional Body Expenses">
                          Professional Body Expenses
                        </option>
                      </optgroup>

                      <optgroup label="Branding & Outreach">
                        <option value="Advertisement & Branding">
                          Advertisement & Branding
                        </option>
                        <option value="Public Relations">Public Relations</option>
                        <option value="Admissions">Admissions</option>
                      </optgroup>

                      <optgroup label="General">
                        <option value="Research & Development">Research & Development</option>
                        <option value="Administrative Expenses">Administrative Expenses</option>
                        <option value="Salary">Salary</option>
                        <option value="Bills & Payments">Bills & Payments</option>
                        <option value="Miscellaneous Expenses">Miscellaneous Expenses</option>
                      </optgroup>
                    </select>
                    {primaryHead && (
                      <button
                        onClick={() => {
                          setSelectedBudgetHeadForModal(primaryHead);
                          setShowBudgetHeadModal(true);
                        }}
                        style={{
                          width: '45px',
                          height: '45px',
                          borderRadius: '10px',
                          border: '2px solid #0069ab',
                          background: '#e9f0f8',
                          cursor: 'pointer',
                          fontSize: '22px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0069ab';
                          (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e9f0f8';
                          (e.currentTarget as HTMLButtonElement).style.color = '#0069ab';
                        }}
                        title="View Sub-heads"
                      >
                        ℹ️
                      </button>
                    )}

                    {/* Extra dropdown - same line, only for Events/Meetings */}
                    {extraDropdownVisible && (
                      <select
                        value={eventSubHead}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                          setEventSubHead(e.target.value)
                        }
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #e0e0e0',
                          padding: '10px 15px',
                          fontSize: '0.95rem',
                          width: '50%',
                          fontFamily: 'inherit',
                          backgroundColor: '#fcfdff',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled selected hidden></option>
                        {primaryHead === 'Events & Competitions' && (
                          <>
                            <optgroup label="Academic & Professional Development">

                              <option value="Seminar">Seminar</option>
                              <option value="Webinar">Webinar</option>
                              <option value="Guest Lecture">Guest Lecture</option>
                              <option value="Workshop">Workshop</option>
                              <option value="Hands-on Training">Hands-on Training</option>
                              <option value="FDP (Faculty Development Programme)">
                                FDP (Faculty Development Programme)
                              </option>
                              <option value="STTP (Short-Term Training Programme)">
                                STTP (Short-Term Training Programme)
                              </option>
                            </optgroup>

                            <optgroup label="Conferences & Conclaves">

                              <option value="National Conference">National Conference</option>
                              <option value="International Conference">International Conference</option>
                              <option value="Conclave">Conclave</option>
                              <option value="Convention">Convention</option>
                            </optgroup>

                            <optgroup label="Industry & Networking">

                              <option value="Industry Visit">Industry Visit</option>
                              <option value="Expert Visit">Expert Visit</option>
                              <option value="Networking Event">Networking Event</option>
                              <option value="Industry Interaction">Industry Interaction</option>
                              <option value="MoU Signing">MoU Signing</option>
                            </optgroup>

                            <optgroup label="Association & Institutional Activities">

                              <option value="Association Function">Association Function</option>
                              <option value="Alumni Meeting">Alumni Meeting</option>
                              <option value="Alumni Interaction">Alumni Interaction</option>
                              <option value="Parents Meeting">Parents Meeting</option>
                            </optgroup>

                            <optgroup label="Outreach Event">

                              <option value="School Visit">School Visit</option>
                              <option value="Awareness Program">Awareness Program</option>
                              <option value="Campaigns">Campaigns</option>
                              <option value="Mini Marathon">Mini Marathon</option>
                            </optgroup>

                            <optgroup label="Competitions & Innovation">

                              <option value="Hackathons">Hackathons</option>
                              <option value="Competitions">Competitions</option>
                              <option value="Club Activities">Club Activities</option>
                              <option value="Project Expo">Project Expo</option>
                              <option value="Ideathon">Ideathon</option>
                              <option value="Start-up meet">Start-up meet</option>
                              <option value="Mentoring Sessions">Mentoring Sessions</option>
                            </optgroup>

                            <optgroup label="Cultural & Celebrations">

                              <option value="Annual Day">Annual Day</option>
                              <option value="Sports Day">Sports Day</option>
                              <option value="Graduation Day">Graduation Day</option>
                              <option value="Science Day">Science Day</option>
                              <option value="Womens Day">Womens Day</option>
                              <option value="Celebration Day">Celebration Day</option>
                              <option value="Festival Celebrations">Festival Celebrations</option>
                              <option value="Dakshaa">Dakshaa</option>
                              <option value="Harmonicks">Harmonicks</option>
                            </optgroup>

                            <optgroup label="Sports & Student Engagement">

                              <option value="Sports Meet">Sports Meet</option>
                              <option value="Sports Day (Engagement)">Sports Day</option>
                              <option value="Camp">Camp</option>
                              <option value="Rally">Rally</option>
                              <option value="Student Induction Programme">
                                Student Induction Programme
                              </option>
                              <option value="Orientation Session">Orientation Session</option>
                            </optgroup>
                          </>
                        )}

                        {primaryHead === 'Meetings & Audits' && (
                          <>
                            <optgroup label="Institutional Governance">

                              <option value="Governing Body Meeting">Governing Body Meeting</option>
                              <option value="Research Advisory Board Meeting">
                                Research Advisory Board Meeting
                              </option>
                              <option value="Finance Committee Meeting">Finance Committee Meeting</option>
                              <option value="Result Passing Board Meeting">
                                Result Passing Board Meeting
                              </option>
                              <option value="Examination Committee Meeting">
                                Examination Committee Meeting
                              </option>
                              <option value="Placement Meeting">Placement Meeting</option>
                              <option value="Network Meeting">Network Meeting</option>
                            </optgroup>

                            <optgroup label="Academic Governance">

                              <option value="Academic Council Meeting">Academic Council Meeting</option>
                              <option value="Standing Committee Meeting">
                                Standing Committee Meeting
                              </option>
                              <option value="Board of Studies Meeting">
                                Board of Studies Meeting
                              </option>
                              <option value="DAB Meeting">DAB Meeting</option>
                            </optgroup>

                            <optgroup label="Audits">

                              <option value="Academic Audit">Academic Audit</option>
                              <option value="Administrative Audit">Administrative Audit</option>
                              <option value="Energy & Green Audit">Energy & Green Audit</option>
                              <option value="Government Meetings">Government Meetings</option>
                            </optgroup>
                          </>
                        )}

                      </select>

                    )}
                    <BudgetHeadModal />
                  </div>
                </div>

              </div>

              {/* Right half: Amount Proposed */}
              <div className="col-md-6">
                <div className="form-group">
                  {/* headings row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      columnGap: "10px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontSize: "14px", color: "#495057", fontWeight: 600 }}>
                      Proposed in Budget
                    </span>

                    {isBudgetProposed === "Yes" ? (
                      <>
                        <span
                          style={{ fontSize: "14px", color: "#495057", fontWeight: 600 }}
                        >
                          Proposed

                        </span>
                        <span
                          style={{ fontSize: "14px", color: "#495057", fontWeight: 600 }}
                        >
                          Balance
                        </span>
                      </>
                    ) : (
                      <>
                        {/* keep grid structure but no text when No */}
                        <span></span>
                        <span></span>
                      </>
                    )}
                  </div>

                  {/* controls row – unchanged */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      columnGap: "10px",
                      alignItems: "center",
                      paddingTop: "4px"
                    }}
                  >
                    {/* Yes / No */}
                    <div style={{ display: "flex", gap: "12px", justifyContent: "flex-start" }}>
                      <label style={{ fontSize: "1rem", fontWeight: "500", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="radio"
                          name="isBudgetProposed"
                          value="Yes"
                          checked={isBudgetProposed === "Yes"}
                          onChange={(e) => setIsBudgetProposed(e.target.value)}
                          style={{ width: "18px", height: "18px" }}
                        />
                        Yes
                      </label>
                      <label style={{ fontSize: "1rem", fontWeight: "500", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="radio"
                          name="isBudgetProposed"
                          value="No"
                          checked={isBudgetProposed === "No"}
                          onChange={(e) => {
                            setIsBudgetProposed(e.target.value);
                            if (e.target.value !== "Yes") {
                              setAmountProposed("");
                              setBalanceAmount("");
                            }
                          }}
                          style={{ width: "18px", height: "18px" }}
                        />
                        No
                      </label>
                    </div>


                    {isBudgetProposed !== "Yes" ? (
                      <div
                        style={{
                          gridColumn: "2 / 4",
                          borderRadius: "12px",
                          border: "1px solid #e0e0e0",
                          backgroundColor: "#f8f9fa",
                          padding: "8px 12px",
                          fontSize: "0.9rem",
                          color: "#6c757d",
                          fontStyle: "italic",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        Amount not proposed
                      </div>
                    ) : (
                      <>
                        {/* Amount */}
                        <input
                          type="number"
                          value={amountProposed}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const MAX_AMOUNT = 999999999;
                            let num = Number(e.target.value || 0);
                            if (num > MAX_AMOUNT) num = MAX_AMOUNT;
                            if (num < 0) num = 0;
                            setAmountProposed(num.toString());
                          }}
                          placeholder="Proposed Amount"
                          min={0}
                          max={999999999}
                          step="0.01"
                          style={{
                            width: "100%",
                            borderRadius: "12px",
                            border: "1px solid #e0e0e0",
                            padding: "8px 12px",
                            fontSize: "0.9rem",
                            fontFamily: "inherit",
                            backgroundColor: "#fcfdff",
                            color: "#0069ab",
                          }}
                        />

                        {/* Balance */}
                        <input
                          type="number"
                          value={balanceAmount}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const MAX_AMOUNT = 999999999;
                            let num = Number(e.target.value || 0);
                            if (num > MAX_AMOUNT) num = MAX_AMOUNT;
                            if (num < 0) num = 0;
                            setBalanceAmount(num.toString());
                          }}
                          placeholder="Balance"
                          min={0}
                          max={999999999}
                          step="0.01"
                          style={{
                            width: "100%",
                            borderRadius: "12px",
                            border: "1px solid #e0e0e0",
                            padding: "8px 12px",
                            fontSize: "0.9rem",
                            fontFamily: "inherit",
                            backgroundColor: "#fcfdff",
                            color: "#dc3545",
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>


            </div>
            <div style={{ overflowX: 'auto' }}>
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
                    <th style={{ width: '15%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Amount Requested</th>
                    <th style={{ width: '8%', padding: '12px', border: '1px solid #e0e0e0', color: '#0069ab', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #e0e0e0', opacity: primaryHead ? 1 : 0.6 }}>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'center', color: '#495057' }}>{index + 1}</td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                        <select
                          value={row.category}
                          onChange={(e) => handleBudgetChange(index, 'category', e.target.value)}  // ✅ Resets subhead here
                          disabled={!primaryHead}
                          style={{
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            padding: '6px 8px',
                            fontSize: '0.9rem',
                            width: '100%',
                            fontFamily: 'inherit',
                            backgroundColor: primaryHead ? "#fcfdff" : "#f8f9fa",
                            color: primaryHead ? "#000" : "#6c757d",
                            cursor: primaryHead ? "pointer" : "not-allowed"
                          }}
                        >
                          <option value="" disabled selected hidden></option>
                          {BUDGET_HEAD_GROUPS.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                        <select
                          value={row.head}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => handleBudgetChange(index, 'head', e.target.value)}
                          disabled={!row.category || !primaryHead}  // ✅ Disabled if no category OR no primaryHead
                          style={{
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            padding: '6px 8px',
                            fontSize: '0.9rem',
                            width: '100%',
                            fontFamily: 'inherit',
                            backgroundColor: (row.category && primaryHead) ? '#fcfdff' : '#f8f9fa',
                            color: (row.category && primaryHead) ? '#000' : '#6c757d',
                            cursor: (row.category && primaryHead) ? 'pointer' : 'not-allowed'
                          }}
                        >
                          <option value="" disabled selected hidden></option>
                          {getSubHeadOptions(row.category).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #e0e0e0' }}>
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleBudgetChange(index, 'amount', e.target.value)}
                          disabled={!primaryHead}
                          placeholder="₹ 0.00"
                          min="0"
                          step="0.01"
                          style={{
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            fontSize: '0.9rem',
                            width: '100%',
                            fontFamily: 'inherit',
                            backgroundColor: primaryHead ? '#fcfdff' : '#f8f9fa',
                            color: primaryHead ? '#000' : '#6c757d',
                            cursor: primaryHead ? 'pointer' : 'not-allowed'
                          }}
                        />
                      </td>
                      <td style={actionCell}>
                        {index > 0 && (
                          <button
                            onClick={(e: MouseEvent<HTMLButtonElement>) => {
                              e.preventDefault();
                              handleDeleteRow(index);
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
                            🗑️
                          </button>
                        )}
                        {index === budgetRows.length - 1 && (
                          <button
                            onClick={(e: MouseEvent<HTMLButtonElement>) => {
                              e.preventDefault();
                              handleAddRow();
                            }}
                            disabled={!primaryHead}
                            style={{
                              ...iconBtn,
                              opacity: primaryHead ? 1 : 0.5,
                              cursor: primaryHead ? "pointer" : "not-allowed"
                            }}
                            title="Add Row"
                            className="btn-sm"
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#e8f5e9';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#f5f6f8';
                            }}
                          >
                            ➕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f0f6ff' }}>
                    <td colSpan={3} style={{ padding: '12px', border: '1px solid #e0e0e0', textAlign: 'right', paddingRight: '15px', fontWeight: '600', color: '#0069ab' }}>
                      Total Budget
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #e0e0e0', fontWeight: '600', color: '#0069ab' }}>
                      ₹ {totalBudget.toFixed(2)}
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
                  justifyContent: "center",   // center horizontally
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.9rem",
                  color: "#0b3d75",
                  textAlign: "center",        // text centered inside spans
                  width: "100%",              // take full row
                }}
              >
                <span style={{ fontWeight: 600 }}>Rupees (in words):</span>
                <span style={{ fontWeight: 600 }}>
                  {numberToIndianWords(totalBudget)
                    .replace(/\b\w/g, l => l.toUpperCase())  // First letter of each word UPPER
                    .replace(/[^\s][A-Z]/g, l => l.toLowerCase())  // Rest lowercase
                  }
                </span>

              </div>
            </div>
            {/* Income & Status row */}
            <div className="row mt-3">
              <div className="col-md-12">
                <div className="form-group">
                  {/* Headings row - First 3 columns fill the line */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: incomeType === "Management" ? "1fr 1fr" : "1.2fr 0.8fr 1fr",
                    gap: "20px",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}>
                    <span style={{ fontSize: "14px", color: "#495057", fontWeight: 600 }}>
                      Income Source
                    </span>
                    {incomeType !== "Management" && (
                      <>

                        <span
                          style={{
                            fontSize: "14px",
                            color: "#495057",
                            fontWeight: 600,
                            paddingRight: "50px",
                            display: "inline-block",   // add this
                            marginLeft: "-70px",       // adjust this value as needed
                          }}
                        >
                          Contribution
                        </span>



                        <span style={{
                          fontSize: "14px",
                          color: "#495057",
                          fontWeight: 600,
                          paddingLeft: "18px"  // Subtle 8px right shift
                        }}>
                          Credit Status
                        </span>

                      </>
                    )}
                  </div>


                  {/* Controls row - First 3 columns fill the line */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: incomeType === "Management" ? "1fr 1fr" : "1.2fr 0.8fr 1fr",
                    gap: "20px",
                    alignItems: "center",
                  }}>
                    {/* 1. Income Source */}
                    <select
                      value={incomeType}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIncomeType(e.target.value)}
                      style={{
                        width: "80%",
                        borderRadius: "12px",
                        border: "1px solid #e0e0e0",
                        padding: "8px 12px",
                        fontSize: "0.95rem",
                        fontFamily: "inherit",
                        backgroundColor: "#fcfdff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="" disabled selected hidden></option>
                      <option value="Government Funding">Government Funding</option>
                      <option value="Registration Fees">Registration Fees</option>
                      <option value="Sponsorship">Sponsorship</option>
                      <option value="Management">Management</option>
                    </select>

                    {/* 2. Contribution radios */}
                    {incomeType !== "Management" && (
                      <div style={{
                        display: "flex",
                        gap: "12px",
                        justifyContent: "flex-start",
                        alignItems: "center",
                        paddingLeft: "8px", marginLeft: "-70px",
                      }}>
                        <label style={{
                          fontSize: "1rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}>
                          <input
                            type="radio"
                            name="contribution"
                            value="complete"
                            checked={incomeAmountType === "complete"}
                            onChange={(e) => {
                              setIncomeAmountType(e.target.value as "complete" | "partial");
                              setPartialAmount(""); // Clear amount when switching to complete
                            }}
                            style={{ width: "18px", height: "18px" }}
                          />
                          Complete
                        </label>
                        <label style={{
                          fontSize: "1rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}>
                          <input
                            type="radio"
                            name="contribution"
                            value="partial"
                            checked={incomeAmountType === "partial"}
                            onChange={(e) => setIncomeAmountType(e.target.value as "complete" | "partial")}
                            style={{ width: "18px", height: "18px" }}
                          />
                          Partial
                          {incomeAmountType === "partial" && (
                            <input
                              type="number"
                              placeholder="₹ Amount"
                              value={partialAmount || ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                let num = Number(e.target.value) || 0;
                                if (num > 999999999) num = 999999999;
                                setPartialAmount(num.toString());
                              }}
                              style={{
                                marginLeft: "12px",
                                width: "160px",
                                height: "27px",

                                borderRadius: "12px",
                                border: "1px solid #e0e0e0",
                                padding: "2px 6px",
                                fontSize: "0.95rem",
                                fontFamily: "inherit",
                                backgroundColor: "#fcfdff",
                                cursor: "pointer",
                              }}
                            />
                          )}
                        </label>
                      </div>
                    )}




                    {/* 3. Credit Status */}
                    {incomeType !== "Management" && (
                      <div style={{
                        paddingLeft: "12px",
                        display: "flex",
                        justifyContent: "flex-start"
                      }}>
                        <select
                          value={creditStatus}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreditStatus(e.target.value as "complete" | "partial")}
                          style={{
                            width: "100%",
                            borderRadius: "12px",
                            border: "1px solid #e0e0e0",
                            padding: "8px 12px",
                            fontSize: "0.95rem",
                            fontFamily: "inherit",
                            backgroundColor: "#fcfdff",
                            cursor: "pointer",
                          }}
                        >
                          <option value="" disabled selected hidden></option>
                          <option value="complete">Credited</option>
                          <option value="partial">Reimbursement</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                      marginTop: "12px",
                      alignItems: "flex-start", // valid + consistent [MDN]
                    }}
                  >
                    {/* Debit Account - Left */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "14px", color: "#495057", fontWeight: 600, lineHeight: "1.2" }}>
                        Debit Account
                      </span>

                      <select
                        value={incomeStatus}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIncomeStatus(e.target.value)}
                        style={{
                          width: "100%",
                          borderRadius: "12px",
                          border: "1px solid #e0e0e0",
                          padding: "10px 12px",
                          fontSize: "0.95rem",
                          fontFamily: "inherit",
                          backgroundColor: "#fcfdff",
                          cursor: "pointer",
                          height: "44px",
                          boxSizing: "border-box",
                        }}
                      >
                        <option value="" disabled>

                        </option>
                        <option value="Credited">Credited</option>
                        <option value="Reimbursement">Reimbursement</option>
                      </select>
                    </div>

                    {/* Enclosure - Right */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "14px", color: "#495057", fontWeight: 600, lineHeight: "1.2" }}>
                        Enclosure
                      </span>

                      <Select
                        isMulti
                        value={enclosureSelections}
                        onChange={(selected) =>
                          setEnclosureSelections((selected as MultiValue<SelectOption>)?.slice() ?? [])
                        }
                        options={[
                          { value: "Invoice", label: "Invoice" },
                          { value: "Quotation", label: "Quotation" },
                          { value: "Proforma Invoice", label: "Proforma Invoice" },
                          { value: "Detailed Budget", label: "Detailed Budget" },
                          { value: "Pamphlet | Brochure", label: "Pamphlet | Brochure" },
                          { value: "Nil", label: "Nil" },
                        ]}
                        styles={{
                          control: (provided, state) => ({
                            ...provided,
                            width: "100%",
                            minHeight: "44px",
                            height: "44px",
                            borderRadius: "12px",
                            border: state.isFocused ? "1px solid #0069ab" : "1px solid #e0e0e0",
                            backgroundColor: "#fcfdff",
                            boxShadow: "none",
                            boxSizing: "border-box",

                            // IMPORTANT: don't add extra padding here; it changes true width alignment
                            padding: 0,
                          }),
                          valueContainer: (provided) => ({
                            ...provided,
                            padding: "0 12px", // inner padding (safe)
                            height: "44px",
                          }),
                          indicatorsContainer: (provided) => ({
                            ...provided,
                            paddingRight: "10px",
                            height: "44px",
                          }),
                          placeholder: (provided) => ({
                            ...provided,
                            color: "#6c757d",
                          }),
                          multiValue: (provided) => ({
                            ...provided,
                            backgroundColor: "#e3f2fd",
                            borderRadius: "6px",
                          }),
                        }}
                        components={{ IndicatorSeparator: () => null }}
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>


        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowPreview(!showPreview)}
            style={{
              backgroundColor: '#0069ab',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005492')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0069ab')}
            disabled={isLoading}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          <button
            onClick={generatePDF}
            style={{
              backgroundColor: '#0069ab',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005492')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0069ab')}
            disabled={isLoading || !showPreview}
          >
            {isLoading ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={() => handleReset(false)}
            style={{
              backgroundColor: '#0069ab',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005492')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0069ab')}
            disabled={isLoading}
          >
            Reset Form
          </button>
        </div>
      </div>
      {showPreview && (
        <div ref={componentRef} style={{
          position: 'relative',
          backgroundColor: '#fff',
          padding: '22px 18px',
          fontFamily: '"Times New Roman", serif',
          fontSize: '9.5px',
          lineHeight: '1.25',
          maxWidth: '210mm',
          maxHeight: '297mm',
          margin: '0 auto',
          border: '1px solid #ddd',
          overflow: 'visible',
        }}>
          {/* HEADER BOX (like 2nd image) */}
          <table
            style={{

              marginBottom: "14px",
              tableLayout: "fixed",
              width: '92%', margin: '0 auto 14px auto', borderCollapse: 'collapse'
            }}
          >
            <tr>
              {/* Logo box */}
              <td
                style={{
                  width: "16%",
                  border: "1px solid #000",
                  textAlign: "center",
                  verticalAlign: "middle",
                  padding: "10px 6px",
                }}
              >
                <img
                  src={KSRCTLogo}
                  alt="Logo"
                  style={{ width: "75px", height: "75px", objectFit: "contain" }}
                />
              </td>

              {/* College text box */}
              <td
                style={{
                  width: "68%",
                  border: "1px solid #000",
                  textAlign: "center",
                  verticalAlign: "middle",
                  padding: "8px 10px",
                }}
              >
                <div
                  style={{
                    fontSize: "19px",
                    fontWeight: "bold",
                    color: "#000",
                    lineHeight: "1.05",
                    marginBottom: "4px",
                  }}
                >
                  K.S.RANGASAMY COLLEGE OF TECHNOLOGY
                </div>
                <div style={{ fontSize: "14px", color: "#000", marginBottom: "4px" }}>
                  (Autonomous)
                </div>
                <div style={{ fontSize: "16px", color: "#000", lineHeight: "1.2" }}>
                  Tiruchengode – 637 215, Namakkal Dt. Tamil Nadu
                </div>
              </td>

              {/* FINANCE box */}
              <td
                style={{
                  width: "16%",
                  border: "1px solid #000",
                  textAlign: "center",
                  verticalAlign: "middle",
                  padding: "10px 6px",
                }}
              >
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#000" }}>
                  FINANCE
                </div>
              </td>
            </tr>
          </table>
          <h2 style={{
            textAlign: 'center',
            margin: '0 0 18px 0',
            fontSize: '18px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.4px'
          }}>
            APPLICATION FOR FINANCIAL APPROVAL
          </h2>

          {/* EXACT PDF TABLE SIZES */}
          <table style={{ width: '92%', margin: '0 auto 14px auto', borderCollapse: 'collapse' }}>
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '1.5%', fontSize: '14px', color: '#000000ff' }}><strong>Name</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '35%', fontSize: '14px', color: '#000000ff' }}>{applicantName || '\u00A0'}</td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '15%', fontSize: '14px', color: '#000000ff' }}><strong>Date</strong></td>
              <td
                style={{
                  padding: '4.5px 5.5px',
                  border: '1px solid #000000ff',
                  width: '40%',
                  fontSize: '14px',
                  color: '#000000ff',
                }}
              >
                {date ? formatDMY(date) : '\u00A0'}
              </td>

            </tr>
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}><strong>Email</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}>{email || '\u00A0'}</td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}><strong>Mobile</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}>{mobile || '\u00A0'}</td>
            </tr>
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}><strong>Department</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}>{department || '\u00A0'}</td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}><strong>Designation</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}>{designation || '\u00A0'}</td>

            </tr>
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '25%', fontSize: '14px', color: '#000000ff' }} colSpan={1}><strong>Category</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={3}>
                {categoryType || '\u00A0'}
                {hasSubcategories && categoryItem && ` - ${categoryItem}`}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '4.5px 5.5px',
                  border: '1px solid #000000ff',
                  fontSize: '14px',
                  color: '#000000ff',
                  whiteSpace: 'normal',      // allow wrapping
                  wordBreak: 'break-word',   // break long words/strings
                }}
                colSpan={4}
              >
                <strong>Description</strong>{' '}
                {description || '\u00A0'}
              </td>

            </tr>
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '30%', fontSize: '14px', color: '#000000ff' }} colSpan={1}><strong>Head of Accounts</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={3}>
                {primaryHead || '\u00A0'}
                {extraDropdownVisible && eventSubHead && ` - ${eventSubHead}`}
              </td>

            </tr>
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={1}><strong>Proposed in Budget</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={3}>
                {isBudgetProposed === 'Yes' ? `Yes | Amount: ₹ ${amountProposed || '0.00'} | Balance: ₹ ${balanceAmount || '0.00'}` : 'Not Proposed'}
              </td>
            </tr>
            {/* Insert THIS after Budget Details header, inside your main 4-column table */}
            <tr>
              <td
                colSpan={4}
                style={{ padding: '8px 6px', border: '1px solid #000000ff', verticalAlign: 'top', color: '#000000ff' }}
              >
                {/* Budget Items Mini-Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '4px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f8f8' }}>
                      <th style={{ padding: '3px 4px', border: '1px solid #000000ff', fontSize: '14px', fontWeight: 'bold', color: '#000000ff', textAlign: 'center' }}>S.No</th>
                      <th style={{ padding: '3px 4px', border: '1px solid #000000ff', fontSize: '14px', fontWeight: 'bold', color: '#000000ff', textAlign: 'center' }}>Budget Head</th>
                      <th style={{ padding: '3px 4px', border: '1px solid #000000ff', fontSize: '14px', fontWeight: 'bold', color: '#000000ff', textAlign: 'center' }}>Sub Head</th>
                      <th style={{ padding: '3px 4px', border: '1px solid #000000ff', fontSize: '14px', fontWeight: 'bold', color: '#000000ff', textAlign: 'center' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetRows.map((row, index) => (
                      <tr key={index}>
                        <td style={{ padding: '2.5px 4px', border: '1px solid #000000ff', fontSize: '14px', width: '5%', textAlign: 'center', color: '#000000ff' }}>{index + 1}</td>
                        <td style={{ padding: '2.5px 4px', border: '1px solid #000000ff', fontSize: '14px', width: '35%', color: '#000000ff', textAlign: 'center' }}>{row.category || '\u00A0'}</td>
                        <td style={{ padding: '2.5px 4px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff', textAlign: 'center' }}>{row.head || '\u00A0'}</td>
                        <td style={{ padding: '2.5px 4px', border: '1px solid #000000ff', fontSize: '14px', width: '15%', textAlign: 'right', color: '#000000ff' }}>₹ {Number(row.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: 'white', fontWeight: 'bold' }}>
                      <td colSpan={3} style={{ padding: '3px 4px', border: '1px solid #000000ff', fontSize: '14px', textAlign: 'right', fontWeight: 'bold', color: '#000000ff' }}>Total Budget:</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #000000ff', fontSize: '14px', textAlign: 'right', color: '#000000ff' }}>₹ {totalBudget.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: '6px 16px',
                  border: '1px solid #000000ff',
                  borderTop: '0',           // ✅ No double line
                  color: '#000000ff',
                  textAlign: 'center',

                  fontSize: '15px',
                  letterSpacing: '0.5px',

                  backgroundColor: '#f8f9fa'  // ✅ Subtle highlight
                }}
              >
                Rupees in Words:
                {numberToIndianWords(totalBudget)
                  .replace(/\b\w/g, l => l.toUpperCase())      // ✅ First letter UPPER per word
                  .replace(/([A-Z])(?=[A-Z][a-z])/, '$1 ')     // ✅ Fix compound words
                  .replace(/[A-Z]{2,}/g, m => m.charAt(0) + m.slice(1).toLowerCase())  // ✅ Rest lowercase
                }

              </td>
            </tr>

            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '30%', fontSize: '14px', color: '#000000ff' }} colSpan={1}><strong>Income Source</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={3}>{incomeType || '\u00A0'}</td>
            </tr>
            {incomeType && incomeType !== 'Management' && (
              <>
                <tr>
                  <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={1}>
                    <strong>Contribution</strong>
                  </td>
                  <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={1}>
                    {incomeAmountType === 'complete' ? (
                      'Complete'
                    ) : incomeAmountType === 'partial' ? (
                      <>
                        Partial{partialAmount && partialAmount !== '0' ? ` - ₹${partialAmount}` : ''}
                      </>
                    ) : (
                      '\u00A0'
                    )}
                  </td>
                  <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={1}><strong>Credit Status</strong></td>
                  <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={1}>
                    {creditStatus === 'complete' ? 'Credited' : creditStatus === 'partial' ? 'Reimbursement' : '\u00A0'}
                  </td>
                </tr>

              </>
            )}
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={1}><strong>Debit Account</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={1}>{incomeStatus || '\u00A0'}</td>
              <td
                colSpan={1}
                style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}
              >
                <strong>Enclosure</strong>
              </td>
              <td
                colSpan={1}
                style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}
              >
                {enclosureSelections.length > 0
                  ? enclosureSelections.map((item) => item.label).join(', ')
                  : '\u00A0'
                }
              </td>
            </tr>

            <tr>
              <td
                colSpan={4}
                style={{ padding: '6px 8px', border: '1px solid #000000ff', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: "#333", backgroundColor: "#f8f9fa", }}
              >
                For Office use of Director- Finance and Purchase
              </td>
            </tr>
            <tr>
            </tr>
            <tr>
              <td
                rowSpan={3}
                style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '25%', fontSize: '14px', color: '#000000ff' }}
              >
                <strong>Comments:</strong>
              </td>
              <td
                rowSpan={3}
                colSpan={4}
                style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', verticalAlign: 'top', color: '#000000ff' }}
              >
                {directorComments || '\u00A0'}
              </td>
            </tr>
            {/* 2 Empty rows for rowspan=3 */}
            <tr>
              <td style={{ padding: '0', border: 'none', height: '30px' }}></td>
            </tr>
            <tr>
              <td style={{ padding: '0', border: 'none', height: '10px' }}></td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '4.5px 5.5px',
                  border: '1px solid #000000ff',
                  width: '25%',
                  fontSize: '14px',
                  verticalAlign: 'middle',
                  fontWeight: 'bold',
                  color: '#000000ff'
                }}
              >
                Status:
              </td>
              <td
                colSpan={2}
                style={{
                  padding: '4.5px 5.5px',
                  border: '1px solid #333',
                  height: '32px',
                  backgroundColor: '#fff',
                  position: 'relative', color: '#000000ff'
                }}
              >
                <div style={{
                  position: 'absolute',
                  height: '1px',
                  backgroundColor: '#333',

                }}></div>
                <span style={{
                  backgroundColor: '#fff',
                  fontSize: '14px'
                  , color: '#000000ff'
                }}>
                  Recommended / Not Recommended
                </span>
              </td>
              <td
                colSpan={2}
                style={{
                  padding: '4.5px 5.5px',
                  border: '1px solid',
                  height: '32px',
                  backgroundColor: '#fff',
                  position: 'relative', color: '#000000ff'
                }}
              ></td>

            </tr>
            {/* Principal's Approval Section - Add after Director section */}
            {/* PRINCIPAL APPROVAL SECTION */}
            {/* Principal's Approval Section - Add after Director section */}
            {/* PRINCIPAL APPROVAL SECTION */}
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: "6px 8px",
                  border: "1px solid #000000ff",
                  textAlign: "center",
                  fontSize: "14px",
                  fontWeight: "bold" as const,
                  color: "#333",
                  backgroundColor: "#f8f9fa",
                }}
              >
                Principal's Approval
              </td>
            </tr>

            {/* Principal Comments - rowspan=3 */}
            <tr>
              <td
                rowSpan={3}
                style={{
                  padding: "4.5px 5.5px",
                  border: "1px solid #000000ff",
                  width: "25%",
                  fontSize: "14px",
                  color: "#000000ff",
                  backgroundColor: "#f8f9fa",
                }}
              >
                <strong>Comments:</strong>
              </td>
              <td
                rowSpan={3}
                colSpan={3}
                style={{
                  padding: "12px 16px",
                  border: "1px solid #000000ff",
                  fontSize: "14px",
                  verticalAlign: "top" as const,
                  color: "#000000ff",
                }}
              >
                {principalComments || "\u00A0"}
              </td>
            </tr>
            <tr><td style={{ padding: "0", border: "none", height: "30px" }} /></tr>
            <tr><td style={{ padding: "0", border: "none", height: "10px" }} /></tr>

            {/* Principal Status - CONDITIONAL TEXT */}
            <tr>
              <td
                style={{
                  padding: "4.5px 5.5px",
                  border: "1px solid #000000ff",
                  width: "25%",
                  fontSize: "14px",
                  verticalAlign: "middle" as const,
                  fontWeight: "bold" as const,
                  color: "#000000ff",
                }}
              >
                Status:
              </td>
              <td
                colSpan={2}
                style={{
                  padding: "4.5px 5.5px",
                  border: "1px solid #333",
                  height: "32px",
                  backgroundColor: "#fff",
                  position: "relative" as const,
                  color: "#000000ff",
                }}
              >

                <span
                  style={{
                    backgroundColor: "#fff",
                    fontSize: "14px",
                    color: "#000000ff",
                    padding: "0 4px" as const,
                  }}
                >
                  {totalBudget > 10000 ? "Recommended / Not Recommended" : "Approved / Not Approved"}
                </span>
              </td>
              <td
                colSpan={1}
                style={{
                  padding: '4.5px 5.5px',
                  border: '1px solid',
                  height: '32px',
                  backgroundColor: '#fff',
                  position: 'relative'
                }}
              ></td>

            </tr>

            {/* ✅ Priority + Chairman ONLY IF totalBudget > 10000 */}
            {totalBudget > 10000 && (
              <>
                {/* Priority row (moved inside condition) */}
                <tr>
                  <td
                    style={{
                      padding: "4.5px 5.5px",
                      border: "1px solid #000000ff",
                      width: "25%",
                      fontSize: "14px",
                      verticalAlign: "middle" as const,
                      fontWeight: "bold" as const,
                      color: "#000000ff",
                    }}
                  >
                    Priority:
                  </td>

                  <td
                    colSpan={2}
                    style={{
                      padding: "4.5px 5.5px",
                      border: "1px solid #333",
                      height: "32px",
                      backgroundColor: "#fff",
                      position: "relative" as const,
                      color: "#000000ff",
                    }}
                  >
                    {/* ✅ Removed horizontal line div */}
                    <span style={{ backgroundColor: "#fff", fontSize: "14px", whiteSpace: "pre", color: "#000000ff" }}>
                      ☐ Routine     ☐ Urgent     ☐ Most Urgent
                    </span>
                  </td>

                  <td
                    colSpan={2}
                    style={{
                      padding: "4.5px 5.5px",
                      border: "1px solid",
                      height: "32px",
                      backgroundColor: "#fff",
                      position: "relative" as const,
                    }}
                  ></td>
                </tr>

                {/* Chairman block */}
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "6px 8px",
                      border: "1px solid #000000ff",
                      textAlign: "center",
                      fontSize: "14px",
                      fontWeight: "bold" as const,
                      color: "#000000ff",
                    }}
                  >
                    Chairman's Approval
                  </td>
                </tr>

                {/* Chairman Comments */}
                <tr>
                  <td
                    rowSpan={3}
                    style={{
                      padding: "4.5px 5.5px",
                      border: "1px solid #000000ff",
                      width: "25%",
                      fontSize: "14px",
                      color: "#000000ff",
                    }}
                  >
                    <strong>Comments:</strong>
                  </td>
                  <td
                    rowSpan={3}
                    colSpan={3}
                    style={{
                      padding: "12px 16px",
                      border: "1px solid #000000ff",
                      fontSize: "14px",
                      verticalAlign: "top" as const,
                      color: "#000000ff",
                    }}
                  >
                    {chairmanComments || "\u00A0"}
                  </td>
                </tr>
                <tr><td style={{ padding: "0", border: "none", height: "30px" }} /></tr>
                <tr><td style={{ padding: "0", border: "none", height: "10px" }} /></tr>

                {/* Chairman Status */}
                <tr>
                  <td
                    style={{
                      padding: "4.5px 5.5px",
                      border: "1px solid #000000ff",
                      width: "25%",
                      fontSize: "14px",
                      verticalAlign: "middle" as const,
                      fontWeight: "bold" as const,
                      color: "#000000ff",
                    }}
                  >
                    Status:
                  </td>
                  <td
                    colSpan={2}
                    style={{
                      padding: "4.5px 5.5px",
                      border: "1px solid #333",
                      height: "32px",
                      backgroundColor: "#fff",
                      position: "relative" as const,
                      color: "#000000ff",
                    }}
                  >
                    {/* ✅ Removed horizontal line div */}
                    <span
                      style={{
                        backgroundColor: "#fff",
                        fontSize: "14px",
                        color: "#000000ff",
                        padding: "0 4px" as const,
                      }}
                    >
                      Approved / Not Approved
                    </span>
                  </td>
                  <td
                    colSpan={1}
                    style={{
                      padding: '4.5px 5.5px',
                      border: '1px solid',
                      height: '32px',
                      backgroundColor: '#fff',
                      position: 'relative'
                    }}
                  ></td>
                </tr>
              </>
            )}
          </table>
          <div style={{
            position: 'absolute',
            bottom: '4mm',      // 15mm from bottom
            right: '15mm',       // 15mm from right (bottom-right corner)
            width: 'auto',
            textAlign: 'right',
            fontSize: '11px',
            color: '#666',
            fontFamily: '"Times New Roman", serif',
            backgroundColor: '#fff',
            padding: '2px 8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            zIndex: 100,
          }}>
            Page <strong>{currentPage} of {totalPages}</strong>
          </div>
        </div>
      )}
      {/* PAGE FOOTER - Left Aligned (Standard) */}

      <AlertModal
        show={alertConfig.show}
        onHide={closeAlert}
        message={alertConfig.message}
        type={alertConfig.type}
        title={alertConfig.title}
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
      />
    </div>
  );
};

export default FinanceApproval;