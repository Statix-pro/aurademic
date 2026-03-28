import React, { useState, useRef, CSSProperties, useEffect, ChangeEvent, MouseEvent } from 'react';
import { Info } from 'lucide-react';
import Select, { MultiValue, StylesConfig, ControlProps, GroupBase, CSSObjectWithLabel } from 'react-select';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'bootstrap/dist/css/bootstrap.min.css';
import './financeapproval.css';
import KSRCTLogo from '../../shared/assets/images/ksrct_logo.png';

import authenticityUtility from '../../shared/utils/authenticityUtility';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
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
interface BudgetHeadGroup {
  label: string;
  options: string[];
}
const selectStyles: StylesConfig<SelectOption, true, GroupBase<SelectOption>> = {
  control: (base: CSSObjectWithLabel, state: ControlProps<SelectOption, true, GroupBase<SelectOption>>) => ({
    ...base,
    minHeight: "40px",
    borderColor: "#e0e0e0",
    borderRadius: "12px",
    boxShadow: state.isFocused
      ? "0 0 0 3px rgba(0, 105, 171, 0.15)"
      : "none",
    backgroundColor: "#fcfdff",
    fontSize: "0.95rem",
    padding: "0 12px",
    borderWidth: "1px",
  } as CSSObjectWithLabel),

  valueContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "2px 12px",
  } as CSSObjectWithLabel),

  input: (base: CSSObjectWithLabel) => ({
    ...base,
    margin: "0px",
    padding: "0",
  } as CSSObjectWithLabel),

  multiValue: (base: CSSObjectWithLabel) => ({
    ...base,
    backgroundColor: "#e9ecef",
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
    cursor: "pointer",
    ":hover": {
      backgroundColor: "transparent",
      color: "#343a40",
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
  label: string;
  options: string[];
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
      'Student Empowerment',
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
    'Minor Equipment',
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

  'Student Empowerment': [
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
    'Aptitude Training',
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
  const [description, setDescription] = useState<string>('');
  const [amountProposed, setAmountProposed] = useState<string>('');
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
  const [email, setEmail] = useState<string>('');
  const [enclosureSelections, setEnclosureSelections] = useState<SelectOption[]>([]);
  const [budgetRows, setBudgetRows] = useState([
    { category: "", head: "", amount: "" },]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [isExternalApplicant, setIsExternalApplicant] = useState<boolean>(false);
  const [applicantSearchQuery, setApplicantSearchQuery] = useState<string>('');
  const [applicantSearchResults, setApplicantSearchResults] = useState<Array<{ employee_id: number; name: string; designation: string; department: string; email: string; mobile: string; employee_type: string }>>([]);
  const [showApplicantDropdown, setShowApplicantDropdown] = useState<boolean>(false);
  const componentRef = useRef<HTMLDivElement>(null);

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

  // Auto-fill removed per user request - form starts empty
  /*
  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        const response = await authenticityUtility.get('/finance-requests/me') as { status: string; data: { name?: string; designation?: string; department?: string; email?: string; mobile?: string; employee_id?: number } };
        if (response.status === 'success' && response.data) {
          const emp = response.data;
          if (emp.name) setApplicantName(emp.name.trim());
          if (emp.designation) setDesignation(emp.designation);
          if (emp.department) setDepartment(emp.department);
          if (emp.email) setEmail(emp.email);
          if (emp.mobile) setMobile(emp.mobile);
          if (emp.employee_id) setEmployeeId(emp.employee_id);
        }
      } catch (error) {
        console.error('Error fetching employee data:', error);
      }
    };
    fetchEmployeeData();
  }, []);
  */

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
  const generatePDF = async (): Promise<void> => {
    try {
      setIsLoading(true);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 12;
      let yPos = 10;

      const tableWidth = pageWidth - margin * 2;

      // ======= HEADER TABLE (3 cells: Logo | College Name | FINANCE) =======
      let compressedLogo: string | null = null;
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = KSRCTLogo;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          setTimeout(resolve, 2000);
        });

        const logoCanvas = document.createElement('canvas');
        const targetSize = 100;
        logoCanvas.width = targetSize;
        logoCanvas.height = targetSize;
        const ctx = logoCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetSize, targetSize);
          ctx.drawImage(img, 0, 0, targetSize, targetSize);
          compressedLogo = logoCanvas.toDataURL('image/jpeg', 0.7);
        }
      } catch {
        // If logo fails, skip it
      }

      // Create header table with borders
      autoTable(pdf, {
        startY: yPos,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableWidth: tableWidth,
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.3, valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: tableWidth - 22 - 22, halign: 'center' },
          2: { cellWidth: 22, halign: 'center' }
        },
        body: [[
          { content: '', styles: { minCellHeight: 22 } },
          { content: '', styles: { minCellHeight: 22 } },
          { content: 'FINANCE', styles: { fontStyle: 'bold', fontSize: 10 } }
        ]],
        didDrawCell: (data: any) => {
          // Draw logo in first cell
          if (data.column.index === 0 && data.row.index === 0 && compressedLogo) {
            const logoSize = 15;
            const x = data.cell.x + (data.cell.width - logoSize) / 2;
            const y = data.cell.y + (data.cell.height - logoSize) / 2;
            pdf.addImage(compressedLogo, 'JPEG', x, y, logoSize, logoSize);
          }
          // Draw college name with mixed styling in middle cell
          if (data.column.index === 1 && data.row.index === 0) {
            const cellCenterX = data.cell.x + data.cell.width / 2;
            const cellCenterY = data.cell.y + data.cell.height / 2;

            // Bold college name
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text('K.S.RANGASAMY COLLEGE OF TECHNOLOGY', cellCenterX, cellCenterY - 4, { align: 'center' });

            // Normal font for Autonomous and address
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.text('(Autonomous)', cellCenterX, cellCenterY + 1, { align: 'center' });
            pdf.text('Tiruchengode - 637 215, Namakkal Dt. Tamil Nadu', cellCenterX, cellCenterY + 6, { align: 'center' });
          }
        }
      });

      yPos = (pdf as any).lastAutoTable.finalY + 6;

      // Title - centered and larger
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text('APPLICATION FOR FINANCIAL APPROVAL', pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      // ======= BUILD MAIN CONTENT AS ONE CONTINUOUS TABLE =======
      const formattedDate = date ? formatDMY(date) : '';
      const beneficiaryText = categoryType + (hasSubcategories && categoryItem ? ' - ' + categoryItem : '');
      const headOfAccountsText = primaryHead + (extraDropdownVisible && eventSubHead ? ' - ' + eventSubHead : '');
      const budgetProposedText = isBudgetProposed === 'Yes'
        ? 'Yes | Amount: Rs. ' + (amountProposed || '0.00') + ' | Balance: Rs. ' + (balanceAmount || '0.00')
        : 'Not Proposed';

      // Build main body rows
      const mainTableBody: any[] = [
        // Applicant info
        ['Name', applicantName || '', 'Date', formattedDate],
        ['Department', department || '', 'Designation', designation || ''],
        ['Email', email || '', 'Mobile', mobile || ''],
        [{ content: 'Beneficiary', styles: { fontStyle: 'bold' } }, { content: beneficiaryText, colSpan: 3 }],
        [{ content: 'Description', styles: { fontStyle: 'bold' } }, { content: description || '', colSpan: 3 }],
        [{ content: 'Head of Accounts', styles: { fontStyle: 'bold' } }, { content: headOfAccountsText, colSpan: 3 }],
        [{ content: 'Proposed in Budget', styles: { fontStyle: 'bold' } }, { content: budgetProposedText, colSpan: 3 }],
      ];

      // Main info table
      autoTable(pdf, {
        startY: yPos,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableWidth: tableWidth,
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold' },
          1: { cellWidth: 75 },
          2: { cellWidth: 22, fontStyle: 'bold' },
          3: { cellWidth: tableWidth - 38 - 75 - 22 }
        },
        body: mainTableBody,
      });

      yPos = (pdf as any).lastAutoTable.finalY; // NO gap

      // ======= BUDGET TABLE =======
      const budgetTableBody = budgetRows.map((row, index) => [
        (index + 1).toString(),
        row.category || '',
        row.head || '',
        'Rs. ' + Number(row.amount || 0).toFixed(2)
      ]);
      budgetTableBody.push([
        { content: 'Total Budget:', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' as const } } as any,
        { content: 'Rs. ' + totalBudget.toFixed(2), styles: { fontStyle: 'bold' } }
      ]);

      autoTable(pdf, {
        startY: yPos,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableWidth: tableWidth,
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 45 },
          2: { cellWidth: 65 },
          3: { cellWidth: tableWidth - 12 - 45 - 65, halign: 'right' }
        },
        body: [
          [{ content: 'S.No', styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } },
          { content: 'Budget Head', styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } },
          { content: 'Sub Head', styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } },
          { content: 'Amount', styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } }],
          ...budgetTableBody
        ],
      });

      yPos = (pdf as any).lastAutoTable.finalY; // NO gap

      // Amount in words
      const amountInWords = numberToIndianWords(totalBudget)
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/([A-Z])(?=[A-Z][a-z])/, '$1 ')
        .replace(/[A-Z]{2,}/g, m => m.charAt(0) + m.slice(1).toLowerCase());

      autoTable(pdf, {
        startY: yPos,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableWidth: tableWidth,
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25, halign: 'center' },
        body: [['Rupees in Words: ' + amountInWords]],
      });

      yPos = (pdf as any).lastAutoTable.finalY; // NO gap

      // ======= DEBIT SOURCE & ENCLOSURE =======
      let debitSourceText = incomeType || '';
      if (incomeType && incomeType !== 'Management') {
        const amtType = incomeAmountType === 'Full' ? 'Full' : incomeAmountType === 'partial' ? 'Partial - Rs. ' + (partialAmount || '0') : '';
        const creditText = creditStatus === 'Full' ? 'Credited' : creditStatus === 'partial' ? 'Reimbursement' : '';
        if (amtType || creditText) {
          debitSourceText += ' | ' + amtType + ' | ' + creditText;
        }
      }

      const enclosureText = enclosureSelections.length > 0
        ? enclosureSelections.map(item => item.label).join(', ')
        : '';

      autoTable(pdf, {
        startY: yPos,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableWidth: tableWidth,
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold' },
          1: { cellWidth: tableWidth - 38 - 28 - 35 },
          2: { cellWidth: 28, fontStyle: 'bold' },
          3: { cellWidth: 35 }
        },
        body: [
          [{ content: 'Debit Source', styles: { fontStyle: 'bold' } }, { content: debitSourceText, colSpan: 3 }],
          [{ content: 'Debit Account', styles: { fontStyle: 'bold' } }, incomeStatus || '', { content: 'Enclosure', styles: { fontStyle: 'bold' } }, enclosureText],
        ],
      });

      yPos = (pdf as any).lastAutoTable.finalY; // NO gap

      // ======= DIRECTOR'S SECTION =======
      autoTable(pdf, {
        startY: yPos,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableWidth: tableWidth,
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold' },
          1: { cellWidth: 100 },
          2: { cellWidth: tableWidth - 38 - 100 }
        },
        body: [
          [{ content: 'For Office use of Director - Finance and Purchase', colSpan: 3, styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } }],
          [{ content: 'Comments', styles: { fontStyle: 'bold', minCellHeight: 12 } }, { content: directorComments || '', colSpan: 2, styles: { minCellHeight: 12 } }],
          [{ content: 'Status', styles: { fontStyle: 'bold' } }, 'Recommended / Not Recommended', ''],
        ],
      });

      yPos = (pdf as any).lastAutoTable.finalY; // NO gap

      // ======= PRINCIPAL'S SECTION =======
      const principalStatusText = totalBudget > 10000 ? 'Recommended / Not Recommended' : 'Approved / Not Approved';

      autoTable(pdf, {
        startY: yPos,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableWidth: tableWidth,
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold' },
          1: { cellWidth: 100 },
          2: { cellWidth: tableWidth - 38 - 100 }
        },
        body: [
          [{ content: "Principal's Approval", colSpan: 3, styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } }],
          [{ content: 'Comments', styles: { fontStyle: 'bold', minCellHeight: 12 } }, { content: principalComments || '', colSpan: 2, styles: { minCellHeight: 12 } }],
          [{ content: 'Status', styles: { fontStyle: 'bold' } }, principalStatusText, ''],
        ],
      });

      yPos = (pdf as any).lastAutoTable.finalY; // NO gap

      // ======= PRIORITY & CHAIRMAN'S SECTION (only if totalBudget > 10000) =======
      if (totalBudget > 10000) {
        autoTable(pdf, {
          startY: yPos,
          margin: { left: margin, right: margin },
          theme: 'grid',
          tableWidth: tableWidth,
          styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
          columnStyles: {
            0: { cellWidth: 38, fontStyle: 'bold' },
            1: { cellWidth: 100 },
            2: { cellWidth: tableWidth - 38 - 100 }
          },
          body: [
            [{ content: 'Priority', styles: { fontStyle: 'bold' } }, '[ ] Routine      [ ] Urgent      [ ] Most Urgent', ''],
            [{ content: "Chairman's Approval", colSpan: 3, styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } }],
            [{ content: 'Comments', styles: { fontStyle: 'bold', minCellHeight: 12 } }, { content: chairmanComments || '', colSpan: 2, styles: { minCellHeight: 12 } }],
            [{ content: 'Status', styles: { fontStyle: 'bold' } }, 'Approved / Not Approved', ''],
          ],
        });
      }

      // Add page numbers
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Page ' + i, pageWidth - margin, pdf.internal.pageSize.getHeight() - 6, { align: 'right' });
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

  const handleSubmit = async (): Promise<void> => {
    try {
      const payload = {
        // For staff: send employee_id, for external: send applicant details
        employee_id: isExternalApplicant ? null : employeeId,
        applicant_name: isExternalApplicant ? applicantName : null,
        designation: isExternalApplicant ? designation : null,
        department: isExternalApplicant ? department : null,
        email: isExternalApplicant ? email : null,
        mobile: isExternalApplicant ? mobile : null,

        request_date: date,
        description,

        beneficiary_type: categoryType,
        beneficiary_value: categoryItem,

        primary_head: primaryHead,
        event_sub_head: eventSubHead,

        is_budget_proposed: isBudgetProposed,
        proposed_amount: amountProposed || null,
        balance_amount: balanceAmount || null,

        income_type: incomeType,
        income_status: incomeStatus,
        income_amount_type: incomeAmountType,
        credit_status: creditStatus,
        debit_status: debitStatus,
        partial_amount: partialAmount || null,

        enclosures: enclosureSelections,
      };

      const result = await authenticityUtility.post('/finance-requests', payload) as { status: string; message?: string };

      if (result.status !== 'success') {
        showAlert(result.message || 'Submission failed', 'error');
        return;
      }

      showAlert('Finance request submitted successfully', 'success');

      // ✅ Reset AFTER successful submit
      handleReset(true);
    } catch (error) {
      console.error('Finance submit error:', error);
      showAlert('Something went wrong while submitting', 'error');
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
      setCategoryType('');
      setCategoryItem('');
      setPrimaryHead('');
      setEventSubHead('');
      setIncomeType('');
      setIncomeStatus('');
      setIncomeAmountType('' as 'Full' | 'partial' | '');
      setCreditStatus('');
      setDebitStatus('');
      setBalanceAmount('');
      setIsBudgetProposed('');
      setBudgetRows([{ category: '', head: '', amount: '' }]);
      setEnclosureSelections([]);
      setIncomeSelections([]);
      setAmountProposed("");
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
  const [incomeAmountType, setIncomeAmountType] = useState<'Full' | 'partial' | ''>('');
  const [creditStatus, setCreditStatus] = useState<string>("");
  const MAX_AMOUNT = 999999999;
  const [selectedBudgetHeadForModal, setSelectedBudgetHeadForModal] = useState<string>('');
  const [showBudgetHeadModal, setShowBudgetHeadModal] = useState<boolean>(false);

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
        str += b[Math.floor(n / 10)]!.toLowerCase() + " ";
        n = n % 10;
      }
      if (n > 0) {
        str += a[n]!.toLowerCase().replace(/^./, c => c.toUpperCase()) + " ";
      }
      return str.trim();
    };

    let n = Math.floor(num);
    let result = "";

    const crore = Math.floor(n / 10000000);
    if (crore) {
      result += inWordsBelowThousand(crore) + " crore ";
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


    const titleCased = result.trim()
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/[A-Z]{2,}/g, m => m.charAt(0) + m.slice(1).toLowerCase());

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
      const pageHeight = 270;
      setTotalPages(Math.ceil(contentHeight / pageHeight));
    }
  }, [showPreview, applicantName, department, totalBudget,]);
  const extraDropdownVisible =
    primaryHead === 'Events & Competitions' ||
    primaryHead === 'Meetings & Audits';
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedHead, setExpandedHead] = useState<string>('');
  const [activeSubHead, setActiveSubHead] = useState<string>('');
  const [incomeSelections, setIncomeSelections] = useState<MultiValue<SelectOption>>([]);
  const showContributionCredit = incomeSelections.some((s) => s.value !== "Management");
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
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setActiveSubHead("");
            }}
            autoFocus={true}
            onClick={(e) => e.currentTarget.select()}
            placeholder="Type head or subhead"
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "2px solid #e0e0e0",
              fontSize: "16px",
              marginBottom: "20px",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#0069ab")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
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


  const isPureManagement =
    incomeSelections.length > 0 &&
    incomeSelections.every((s) => s.value === "Management");
  useEffect(() => {
    if (isPureManagement) {
      setIncomeStatus("K S Rangasamy College of Technology");
    } else {
      setIncomeStatus((prev) =>
        prev === "K S Rangasamy College of Technology" ? "" : prev
      );
    }
  }, [isPureManagement]);


  return (
    <div className="finance-approval-body" style={{ padding: '0', backgroundColor: '#f0f6ff', minHeight: '100vh' }}>


      {!showPreview && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 30px' }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '24px',
            marginBottom: '30px',
            marginTop: '30px',
            borderRadius: '18px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
          }}>

            <div className="row mb-3" style={{ marginBottom: '15px' }}>
              <div className="col-md-7">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block' }}>
                    Applicant Name <span style={{ color: 'red' }}></span>
                    {isExternalApplicant && <span style={{ fontSize: '12px', color: '#6c757d', marginLeft: '8px' }}>(External)</span>}
                  </label>
                  <input
                    type="text"
                    value={isExternalApplicant ? applicantName : applicantSearchQuery}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
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
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#0069ab';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                      // Show dropdown immediately on focus with default list
                      if (!isExternalApplicant && !showApplicantDropdown) {
                        handleApplicantSearch(applicantSearchQuery);
                      }
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e0e0e0';
                      e.currentTarget.style.boxShadow = 'none';
                      // Delay hiding dropdown to allow click
                      setTimeout(() => setShowApplicantDropdown(false), 200);
                    }}
                    placeholder={isExternalApplicant ? "Enter external applicant name" : "Search employee by name or ERP ID"}
                    required
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

                  <div className="row mb-3" style={{ alignItems: 'flex-start' }}>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label style={{ fontSize: "14px", color: "#495057", marginBottom: "8px", fontWeight: 600, display: "block" }}>Beneficiary</label>
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
                            <CustomTagInput
                              name="categorySelections"
                              value={categorySelections.map(s => s.value)}
                              onChange={(tags) => {
                                const newSelections = tags.map(t => ({ value: t, label: t }));
                                setCategorySelections(newSelections);
                                setCategoryItem(tags.join(", "));
                              }}
                              suggestions={subcategoryList.filter(sub =>
                                !categorySelections.some(sel => sel.value === sub)
                              )}
                              placeholder=""
                              disabled={false}
                              className="mb-0"
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
                                outline: 'none'
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
                        <option value="Student Empowerment">Student Empowerment</option>
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

                    <button
                      onClick={() => {
                        setShowSearchModal(true);
                        setSearchTerm('');
                      }}
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '0',
                        cursor: 'pointer',
                        color: '#6c757d',
                        transition: 'color 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#0069ab';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#6c757d';
                      }}
                      title="Search Budget Heads"
                    >
                      <Info size={20} strokeWidth={2} />
                    </button>


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
                    <SearchBudgetModal />

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
                        <span></span>
                        <span></span>
                      </>
                    )}
                  </div>
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
                          onChange={(e) => handleBudgetChange(index, 'category', e.target.value)}
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
                            cursor: primaryHead ? "pointer" : "not-allowed",
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
                          disabled={!row.category || !primaryHead}
                          style={{
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            padding: '6px 8px',
                            fontSize: '0.9rem',
                            width: '100%',
                            fontFamily: 'inherit',
                            backgroundColor: (row.category && primaryHead) ? '#fcfdff' : '#f8f9fa',
                            color: (row.category && primaryHead) ? '#000' : '#6c757d',
                            cursor: (row.category && primaryHead) ? 'pointer' : 'not-allowed',
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
                            cursor: primaryHead ? 'pointer' : 'not-allowed',
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

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: showContributionCredit ? "1.2fr 0.8fr 1fr" : "1fr 1fr",
                      gap: "20px",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontSize: "14px", color: "#495057", fontWeight: 600 }}>
                      Debit Source
                    </span>

                    {showContributionCredit ? (
                      <>
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#495057",
                            fontWeight: 600,
                            paddingRight: "50px",
                            display: "inline-block",
                            marginLeft: "-15px",
                          }}
                        >
                          Contribution
                        </span>

                        <span
                          style={{
                            fontSize: "14px",
                            color: "#495057",
                            fontWeight: 600,
                            paddingLeft: "10px",
                          }}
                        >
                          Credit Status
                        </span>
                      </>
                    ) : (
                      <span />
                    )}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 0.8fr 1fr",
                      gap: "20px",
                      alignItems: "center",
                      width: '100%'
                    }}
                  >

                    <div style={{ width: "95%", outline: "none" }}>
                      <CustomTagInput
                        name="incomeSelections"
                        value={incomeSelections.map(s => s.value)}
                        onChange={(tags) => {
                          const values = tags.map(t => ({ value: t, label: t }));
                          setIncomeSelections(values);
                          setIncomeType(tags.join(", "));

                          const hasNonManagement = tags.some((t) => t !== "Management");
                          if (!hasNonManagement) {
                            setIncomeAmountType("" as any);
                            setPartialAmount("");
                            setCreditStatus("");
                          }
                        }}
                        suggestions={[
                          "Government Funding",
                          "Registration Fees",
                          "Sponsorship",
                          "Management",
                          "Staff Club"
                        ].filter(opt => !incomeSelections.some(sel => sel.value === opt))}
                        placeholder=""
                        disabled={false}
                      />

                    </div>
                    {showContributionCredit && (
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          justifyContent: "flex-start",
                          alignItems: "center",
                          paddingLeft: "8px",
                          marginLeft: "-20px",
                        }}
                      >
                        <label
                          style={{
                            fontSize: "1rem",
                            fontWeight: 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <input
                            type="radio"
                            name="contribution"
                            value="Full"
                            checked={incomeAmountType === "Full"}
                            onChange={(e) => {
                              setIncomeAmountType(e.target.value as "Full" | "partial");
                              setPartialAmount("");
                            }}
                            style={{ width: "18px", height: "18px" }}
                          />
                          Full
                        </label>

                        <label
                          style={{
                            fontSize: "1rem",
                            fontWeight: 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <input
                            type="radio"
                            name="contribution"
                            value="partial"
                            checked={incomeAmountType === "partial"}
                            onChange={(e) => setIncomeAmountType(e.target.value as "Full" | "partial")}
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
                                width: "150px",
                                height: "35px",

                                borderRadius: "12px",
                                border: "1px solid #e0e0e0",
                                padding: "2px 6px",
                                fontSize: "0.95rem",
                                fontFamily: "inherit",
                                backgroundColor: "#fcfdff",
                                cursor: "pointer",
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
                            />
                          )}
                        </label>
                      </div>
                    )}
                    {!showContributionCredit && <div />}
                    {showContributionCredit && (
                      <div
                        style={{
                          paddingLeft: "10px",
                          display: "flex",
                          justifyContent: "flex-start",
                        }}
                      >
                        <select
                          value={creditStatus}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            setCreditStatus(e.target.value as "Full" | "partial")
                          }
                          style={{
                            width: "100%",
                            borderRadius: "12px",
                            border: "1px solid #e0e0e0",
                            padding: "8px 12px",
                            fontSize: "0.95rem",
                            fontFamily: "inherit",
                            backgroundColor: "#fcfdff",
                            cursor: "pointer",
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
                        >
                          <option value="" disabled selected hidden></option>
                          <option value="complete">Credited</option>
                          <option value="partial">Reimbursement</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginTop: "12px",
                alignItems: "flex-start",
              }}
            >

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "0px" }}>
                <span style={{ fontSize: "14px", color: "#495057", fontWeight: 600, lineHeight: "1.2" }}>
                  Debit Account
                </span>

                {isPureManagement ? (
                  <input
                    type="text"
                    value="K S Rangasamy College of Technology"
                    readOnly
                    style={{
                      width: "135%",
                      borderRadius: "12px",
                      border: "1px solid #6c757d",
                      padding: "10px 12px",
                      fontSize: "0.95rem",
                      fontFamily: "inherit",
                      backgroundColor: "#f8f9fa",
                      cursor: "not-allowed",
                      height: "44px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                ) : (
                  <select
                    value={incomeStatus || ""}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIncomeStatus(e.target.value)}
                    style={{
                      width: "135%",
                      borderRadius: "12px",
                      border: "1px solid #e0e0e0",
                      padding: "10px 12px",
                      fontSize: "0.95rem",
                      fontFamily: "inherit",
                      backgroundColor: "#fcfdff",
                      cursor: "pointer",
                      height: "44px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#0069ab";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 105, 171, 0.15)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e0e0e0";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <option value="" disabled hidden>

                    </option>
                    <option value="PRINCIPAL GNERAL A/C | 0751301000015840">PRINCIPAL GNERAL A/C | 0751301000015840</option>
                    <option value="KSRCT-PRINCIPAL COMMON A/C | 0751301000264891">KSRCT-PRINCIPAL COMMON A/C | 0751301000264891</option>
                    <option value="PRINCIPAL SCHOLARSHIP A/C | 0751301000001328">PRINCIPAL SCHOLARSHIP A/C | 0751301000001328</option>
                    <option value="PRINCIPAL KSRCT ASSOCIATION ACCOUNT | 0751301000028594">PRINCIPAL KSRCT ASSOCIATION ACCOUNT | 0751301000028594</option>
                    <option value="STAFF CLUB A/C | 0751301000005664">STAFF CLUB A/C | 0751301000005664</option>
                    <option value="SOCIETY OF AUTOMOTIVE ENGINEERS (SAE) CLUB KSRCTA/C | 0751301000021422">SOCIETY OF AUTOMOTIVE ENGINEERS (SAE) CLUB KSRCTA/C | 0751301000021422</option>
                    <option value="KSRCT IETE CHAPTER A/C | 0751301000265626">KSRCT IETE CHAPTER A/C | 0751301000265626</option>
                    <option value="KSRCT CIVIL SERB NPDF | 0751301000264860">KSRCT CIVIL SERB NPDF | 0751301000264860</option>
                    <option value="KSRCT CIVIL SERB NPDF 2 | 0751301000265593">KSRCT CIVIL SERB NPDF 2 | 0751301000265593</option>
                    <option value="K S RANGASAMY COLLEGE OF TECHNOLOGY AUTONOMOUS | 0751302000000224">K S RANGASAMY COLLEGE OF TECHNOLOGY AUTONOMOUS | 0751302000000224</option>
                    <option value="KSRCT-CNST A/C | 0751301000045784">KSRCT-CNST A/C | 0751301000045784</option>
                    <option value="CSI CHAPTER BRANCH OF KSRCT A/C | 0751301000185368">CSI CHAPTER BRANCH OF KSRCT A/C | 0751301000185368</option>
                    <option value="KSRCT NSS CORPUS FUND | 0751301000047863">KSRCT NSS CORPUS FUND | 0751301000047863</option>
                    <option value="PRINCIPAL NSS UNIT KSRCT | 0751301000004545">PRINCIPAL NSS UNIT KSRCT | 0751301000004545</option>
                    <option value="IEEE Student KSRCT | 0751301000059822">IEEE Student KSRCT | 0751301000059822</option>
                    <option value="ISTE Student Chapter KSRCT | 0751301000023696">ISTE Student Chapter KSRCT | 0751301000023696</option>
                    <option value="KSRCT RPS AICTE Project | 0075133800000643">KSRCT RPS AICTE Project | 0075133800000643</option>
                  </select>
                )}
              </div>


              <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "200px" }}>
                <span style={{ fontSize: "14px", color: "#495057", fontWeight: 600, lineHeight: "1.2" }}>
                  Enclosure
                </span>
                <select
                  value={enclosureSelections?.[0]?.value ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const value = e.target.value;
                    if (value) {
                      setEnclosureSelections([{ value, label: value }]);
                    } else {
                      setEnclosureSelections([]);
                    }
                  }}
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
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#0069ab';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="" disabled selected hidden></option>
                  <option value="Quotation">Quotation </option>
                  <option value="Proforma Invoice">Proforma Invoice</option>
                  <option value="Bills / Invoice ">Bills / Invoice </option>
                  <option value="Pamphlet / Brochuret">Pamphlet / Brochure</option>
                  <option value="e-mail Intimation">e-mail Intimation</option>
                  <option value="Nil">Nil</option>
                </select>
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
            }}
            disabled={isLoading}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#005492';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0069ab';
            }}
          >
            {isLoading ? 'Submitting...' : 'Submit Form'}
          </button>

        </div>
      </div>
      {showPreview && (
        <div ref={componentRef} style={{
          position: 'relative',
          backgroundColor: '#fff',
          padding: '22px 18px',
          width: '210mm',
          boxSizing: 'border-box',
          margin: '0 auto',
        }}>

          <table
            style={{

              marginBottom: "14px",
              tableLayout: "fixed",
              width: '94%', margin: '0 auto 14px auto', borderCollapse: 'collapse'
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
          <h2
            style={{
              textAlign: 'center',
              margin: '0 0 18px 0',
              fontSize: '18px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: '#000000'
            }}
          >
            APPLICATION FOR FINANCIAL APPROVAL
          </h2>


          <table style={{
            marginBottom: "14px",
            tableLayout: "fixed",
            width: '98%',
            borderCollapse: 'collapse',
            marginLeft: '24px'
          }}>

            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '20%', fontSize: '14px', color: '#000000ff' }}><strong>Name</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '35%', fontSize: '14px', color: '#000000ff' }}>{applicantName || '\u00A0'}</td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '15%', fontSize: '14px', color: '#000000ff' }}><strong>Date</strong></td>
              <td
                style={{
                  padding: '4.5px 5.5px',
                  border: '1px solid #000000ff',
                  width: '25%',
                  fontSize: '14px',
                  color: '#000000ff',
                }}
              >
                {date ? formatDMY(date) : '\u00A0'}
              </td>

            </tr>
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}><strong>Department</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}>{department || '\u00A0'}</td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}><strong>Designation</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff', width: '15%' }}>{designation || '\u00A0'}</td>

            </tr>
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}><strong>Email</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}>{email || '\u00A0'}</td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}><strong>Mobile</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }}>{mobile || '\u00A0'}</td>
            </tr>

            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '25%', fontSize: '14px', color: '#000000ff' }} colSpan={1}><strong>Beneficiary</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={3}>
                {categoryType || '\u00A0'}
                {hasSubcategories && categoryItem && ` - ${categoryItem}`}
              </td>
            </tr>
            <tr>
              <td style={{
                padding: '4.5px 5.5px',
                border: '1px solid #000000ff',
                width: '25%',
                fontSize: '14px', color: '#000000ff'
              }} colSpan={1}>
                <strong>Description</strong>
              </td>
              <td style={{
                padding: '4.5px 5.5px',
                border: '1px solid #000000ff',
                fontSize: '14px', color: '#000000ff',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                hyphens: 'auto'
              }} colSpan={3}>
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
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff', width: '1%' }} colSpan={1}><strong>Proposed in Budget</strong></td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={3}>
                {isBudgetProposed === 'Yes' ? `Yes | Amount: ₹ ${amountProposed || '0.00'} | Balance: ₹ ${balanceAmount || '0.00'}` : 'Not Proposed'}
              </td>
            </tr>

            <tr>
              <td
                colSpan={4}
                style={{ padding: '8px 6px', border: '1px solid #000000ff', verticalAlign: 'top', color: '#000000ff' }}
              >
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
                        <td style={{ padding: '2.5px 4px', border: '1px solid #000000ff', fontSize: '14px', width: '35%', color: '#000000ff', textAlign: 'left' }}>{row.category || '\u00A0'}</td>
                        <td style={{ padding: '2.5px 4px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff', textAlign: 'left' }}>{row.head || '\u00A0'}</td>
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
                  borderTop: '0',
                  color: '#000000ff',
                  textAlign: 'center',
                  fontSize: '15px',
                  letterSpacing: '0.5px',
                  backgroundColor: '#f8f9fa'
                }}
              >
                Rupees in Words:
                {numberToIndianWords(totalBudget)
                  .replace(/\b\w/g, l => l.toUpperCase())
                  .replace(/([A-Z])(?=[A-Z][a-z])/, '$1 ')
                  .replace(/[A-Z]{2,}/g, m => m.charAt(0) + m.slice(1).toLowerCase())
                }

              </td>
            </tr>

            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', width: '30%', fontSize: '14px', color: '#000000ff' }} colSpan={1}><strong>Debit Source</strong></td>
              <td style={{
                padding: '4.5px 5.5px',
                border: '1px solid #000000ff',
                fontSize: '14px',
                color: '#000000ff',
                whiteSpace: 'nowrap'
              }} colSpan={3}>
                {incomeType || '\u00A0'}
                {incomeType && incomeType !== 'Management' && (
                  <>
                    {' | '}
                    {incomeAmountType === 'Full' ? (
                      'Full'
                    ) : incomeAmountType === 'partial' ? (
                      <>
                        Partial{partialAmount && partialAmount !== '0' ? ` - ₹${partialAmount}` : ''}
                      </>
                    ) : (
                      ''
                    )}
                    {' | '}
                    {creditStatus === 'Full' ? 'Credited' : creditStatus === 'partial' ? 'Reimbursement' : ''}
                  </>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={1}>
                <strong>Debit Account</strong>
              </td>
              <td style={{ padding: '4.5px 5.5px', border: '1px solid #000000ff', fontSize: '14px', color: '#000000ff' }} colSpan={1}>
                {incomeStatus || '\u00A0'}
              </td>
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


              <>

              </>

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
                <strong>Comments</strong>
              </td>
              <td
                rowSpan={3}
                colSpan={3}
                style={{
                  padding: '12px 16px',
                  border: '1px solid #000000ff',
                  fontSize: '14px',
                  verticalAlign: 'top',
                  color: '#000000ff',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  hyphens: 'auto'
                }}
              >
                {directorComments || '\u00A0'}
              </td>
            </tr>
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
                Status
              </td>
              <td
                colSpan={1}
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
                <strong>Comments</strong>
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
                Status
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
            {totalBudget > 10000 && (
              <>
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
                    Priority
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
                    <span style={{ backgroundColor: "#fff", fontSize: "14px", whiteSpace: "pre", color: "#000000ff" }}>
                      ☐ Routine     ☐ Urgent     ☐ Most Urgent
                    </span>
                  </td>
                  <td
                    colSpan={1}
                    style={{
                      padding: "4.5px 5.5px",
                      border: "1px solid",
                      height: "32px",
                      backgroundColor: "#fff",
                      position: "relative" as const,
                    }}
                  ></td>
                </tr>
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
                    <strong>Comments</strong>
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
                    Status
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
      )}

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
