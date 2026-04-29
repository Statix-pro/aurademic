
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from "react-router-dom";

import authenticityUtility from '../../shared/utils/authenticityUtility';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, isSuperAdmin } from '../../shared/utils/permissionUtils';
import Select from 'react-select';
import './budget.css';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import { Eye, Edit2, CheckCircle2, RotateCcw, XCircle, Briefcase, Clock, AlertTriangle, Archive, Trash2, Bell } from "lucide-react";

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
  lineId?: number;
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
    ],
  },
  {
    label: 'Events & Competitions',
    options: ['Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves', 'Association Activities', 'Outreach Event', 'Cultural & Celebrations', 'Sports', 'Competitions'],
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
      'Faculty Empowerment', 'Staff Empowerment', 'Student Empowerment', 'Student Capacity Building', 'Ranking & Accreditation', 'Examination Expenses',
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
    'Minor Equipment',
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
    'Banner',
    'Beach Flag',
    'ID Card',
    'Badge',
    'Brochure',
    'Binding',
    'Reports',
    'Magazines',
    'News Letters',
    'Calendar',
    'Certificates',
    'Diary',
    'Registers',
    'Pamphlet',
    'Vinyl Board',
    'Sign Board',
    'Letter Pad',
    'Note Pad',
    'Wiro Pad',
    'Visiting Card',
    'Others'
  ],
  'Stationery': [
    'Files/ Folders',
    'Pen/ Pencil/ Eraser',
    'Print Sheets',
    'Seal/ Stamp Pad',
    'Stapler/ Punching Machine',
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
  'Conferences & Conclaves': [
    'Conclave',
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
  'Outreach Event': [
    'Awareness Program',
    'Campaigns',
    'Crash Course',
    'Education Fair',
    'Mini Marathon',
    'Rally',
    'School Visit',
    'Summer Internship'
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
    'Competitions',
    'Hackathons',
    'Ideathon',
    'Project Expo',
    'Start-up meet'
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
    'Medical Expenses',
    'Registration fee',
    'Staff Welfare',
    'Travel Allowance'
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
    'Aptitude Training',
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
    'Online Exam Remuneration'
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
  Admissions: [
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
    'Testing Charges'
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
    'Pooja Expenses',
    'RO  Mineral Water',
    'Sewage Treatment',
    'Others'
  ],
};

const STAGE_PERMISSION_MAP: Record<string, string> = {
  level1: 'budget.workflow.level1',
  ithead: 'budget.workflow.ithead',
  dof: 'budget.workflow.dof',
  principal: 'budget.workflow.principal',
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


const BENEFICIARY_TYPE_TO_ENTITY_API_TYPE: Record<string, string> = {
  Department: 'DEPARTMENT',
  Centre: 'CENTRE',
  Cell: 'CELL',
  Club: 'CLUB',
  Section: 'SECTION',
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

type GuidelineSectionId =
  | "skill"
  | "events"
  | "research"
  | "it"
  | "lab"
  | "departmentEvents"
  | "assoc"
  | "outreach"
  | "academics"
  | "office"
  | "student";

const guidelineSkillingRows = [
  { designation: "Assistant Professor", registration: 3000, travel: 3000, food: 5000, accommodation: 5000 },
  { designation: "Associate Professor", registration: 4000, travel: 4000, food: 6500, accommodation: 6500 },
  { designation: "Professor", registration: 5000, travel: 5000, food: 8000, accommodation: 8000 },
  { designation: "Leadership Team", registration: 10000, travel: 10000, food: 10000, accommodation: 10000 },
  { designation: "Staff", registration: 2000, travel: 2000, food: 3000, accommodation: 3000 },
];

const guidelineDeptData: Record<Exclude<GuidelineSectionId, "skill" | "events" | "research">, string[]> = {
  it: ["Hardwares", "Softwares", "Hard Disks", "Monitors", "Mouse", "Keyboard", "CMOS Battery", "Wi-fi Router", "Network Materials", "Laptops", "Interactive Displays", "Desktop Computers", "CCTV Materials", "Television", "Projectors", "Printers", "Mobiles & Tablet", "Mic & Speakers", "Amplifiers", "A/V Equipment", "Intercom", "Photocopy Machine"],
  lab: ["Equipment", "Consumables", "Maintenance", "Calibration"],
  departmentEvents: ["Webinar", "Guest Lecture", "Hands-on Training", "Conclave", "Convention", "Networking Event", "Industry Interaction"],
  assoc: ["Association Function", "Alumni Meeting", "Alumni Interaction", "Parents Meeting"],
  outreach: ["School Visit", "Awareness Program", "Campaigns", "Crash Course", "Summer Internship", "Mini Marathon", "Education Fair", "Rally"],
  academics: ["DAB Meeting", "BoS Meeting", "Printing"],
  office: ["Stationary", "Test Notes", "Printing"],
  student: ["Skill Development Training", "Aptitude Training", "Higher Education Coaching", "Competitive Exam Coaching", "Placement Training", "Placement Drives", "One Credit Course", "Value Added Course", "Certification Programs", "Exposure Visit", "Language Proficiency Courses"],
};

const guidelineHeadButtons: Array<{ id: GuidelineSectionId; label: string }> = [
  { id: "skill", label: "Skilling" },
  { id: "events", label: "Events" },
  { id: "research", label: "Research" },
  { id: "it", label: "IT Infrastructure" },
  { id: "lab", label: "Laboratory" },
  { id: "departmentEvents", label: "Events" },
  { id: "assoc", label: "Association" },
  { id: "outreach", label: "Outreach" },
  { id: "academics", label: "Academics" },
  { id: "office", label: "Office" },
  { id: "student", label: "Skilling" },
];

const guidelineCurrency = (value: number) => `\u20B9 ${value}`;

const BudgetProposalGuidelines: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [activeSection, setActiveSection] = useState<GuidelineSectionId | null>(null);

  const renderButton = (id: GuidelineSectionId, label: string) => (
    <button
      key={`${id}-${label}`}
      className={`budgetTabButton ${activeSection === id ? "active" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        setActiveSection((current) => (current === id ? null : id));
      }}
      type="button"
    >
      {label}
    </button>
  );

  const renderDepartmentChips = (id: Exclude<GuidelineSectionId, "skill" | "events" | "research">) => (
    <div className={`budgetSectionCard ${activeSection === id ? "isVisible" : ""}`} onClick={(event) => event.stopPropagation()}>
      <div className="budgetSectionCardInner">
        <div className="budgetChipContainer">
          {guidelineDeptData[id].map((item) => (
            <div className="budgetChip" key={item}>{item}</div>
          ))}
        </div>
        {id === "it" ? (
          <div className="budgetNote">
            Budget for IT Infrastructure should be a separate one since it has to be approved by the <b>Director - IT</b>.
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className={`budgetPage ${embedded ? "budgetPageEmbedded" : ""}`} onClick={() => setActiveSection(null)}>
      <div className={`budgetCard ${embedded ? "budgetCardEmbedded" : ""}`}>
        <div className="cardContent">
          <div className="budgetHeader">Budget Proposal Guidelines</div>
          <div className="budgetSectionTitleWrap">
            <div className="budgetSectionTitle">Faculty / Staff</div>
            <div className="budgetSectionLine" />
          </div>
          <div className="budgetTabRow">
            {renderButton("skill", "Skilling")}
            {renderButton("events", "Events")}
            {renderButton("research", "Research")}
          </div>
          <div className={`budgetSectionCard ${activeSection === "skill" ? "isVisible" : ""}`} onClick={(event) => event.stopPropagation()}>
            <div className="budgetSectionCardInner">
              <div className="budgetTableWrap">
                <table className="budgetEntryTable">
                  <thead>
                    <tr><th>Designation</th><th>Registration</th><th>Travel</th><th>Food</th><th>Accommodation</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {guidelineSkillingRows.map((row) => {
                      const total = row.registration + row.travel + row.food + row.accommodation;
                      return (
                        <tr key={row.designation}>
                          <td>{row.designation}</td>
                          <td className="centerTd">{row.registration}</td>
                          <td className="centerTd">{row.travel}</td>
                          <td className="centerTd">{row.food}</td>
                          <td className="centerTd">{row.accommodation}</td>
                          <td className="totalValueCell">{guidelineCurrency(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="budgetNote">Conference registration fee should be included under <b>Skilling</b>.</div>
            </div>
          </div>
          <div className={`budgetSectionCard ${activeSection === "events" ? "isVisible" : ""}`} onClick={(event) => event.stopPropagation()}>
            <div className="budgetSectionCardInner">
              <div className="budgetTableWrap">
                <p>For Handling Courses</p>
                <table className="budgetEntryTable">
                  <thead><tr><th>Event Type</th><th>Budget</th></tr></thead>
                  <tbody>
                    <tr><td>Webinar</td><td className="centerTd">{guidelineCurrency(1500)}</td></tr>
                    <tr><td>Guest Lecture</td><td className="centerTd">{guidelineCurrency(3000)}+ {guidelineCurrency(2000)} (Travel)</td></tr>
                    <tr><td>Hands-on Training</td><td className="centerTd">{guidelineCurrency(3000)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="budgetNote">Budget indicated is applicable per programme conducted.</div>
            </div>
          </div>
          <div className={`budgetSectionCard ${activeSection === "research" ? "isVisible" : ""}`} onClick={(event) => event.stopPropagation()}>
            <div className="budgetSectionCardInner">
              <div className="budgetTableWrap">
                <table className="budgetEntryTable">
                  <thead><tr><th>Category</th><th>Budget</th></tr></thead>
                  <tbody>
                    <tr><td>IPR Filing</td><td className="centerTd">{guidelineCurrency(2500)}</td></tr>
                    <tr><td>Seed Fund</td><td className="centerTd" rowSpan={2}>{guidelineCurrency(10000)}</td></tr>
                    <tr><td>Consumables</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="budgetNote">
                <ul>
                  <li>IPR filing charge cannot be claimed for mandatory publication.</li>
                  <li>The combined budget for Seed Fund and Consumables is limited to {` ${guidelineCurrency(10000)}.`}</li>
                  <li>Seed fund may be increased for deserving research projects with approval.</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="budgetSpacer" />
          <div className="budgetSectionTitleWrap">
            <div className="budgetSectionTitle">Department</div>
            <div className="budgetSectionLine" />
          </div>
          <div className="budgetTabRow">
            {guidelineHeadButtons.slice(3).map((button) => renderButton(button.id, button.label))}
          </div>
          <div onClick={(event) => event.stopPropagation()}>
            {renderDepartmentChips("it")}
            {renderDepartmentChips("lab")}
            {renderDepartmentChips("departmentEvents")}
            {renderDepartmentChips("assoc")}
            {renderDepartmentChips("outreach")}
            {renderDepartmentChips("academics")}
            {renderDepartmentChips("office")}
            {renderDepartmentChips("student")}
          </div>
        </div>
      </div>
    </div>
  );
};


const Budget: React.FC = () => {
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
    message: '',
    type: 'info'
  });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType = 'info',
    title?: string,
    onConfirm?: () => void,
    showCancel = false,
    confirmText = 'OK',
    cancelText = 'Cancel'
  ) => {
    setAlertConfig({
      show: true,
      message,
      type,
      title,
      onConfirm,
      showCancel,
      confirmText,
      cancelText
    });
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
  const [applicantEntity, setApplicantEntity] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [beneficiaryType, setBeneficiaryType] = useState('');
  const [beneficiaryValue, setBeneficiaryValue] = useState('');
  const [beneficiaryEmployeeId, setBeneficiaryEmployeeId] = useState<number | null>(null);
  const [beneficiarySearchQuery, setBeneficiarySearchQuery] = useState('');
  const [beneficiarySearchResults, setBeneficiarySearchResults] = useState<ApplicantSearchResult[]>(
    []
  );
  const [showBeneficiaryDropdown, setShowBeneficiaryDropdown] = useState(false);
  const [subcategorySelections, setSubcategorySelections] = useState<string[]>([]);
  const [categorySelections, setCategorySelections] = useState<SelectOption[]>([]);
  const [categoryItem, setCategoryItem] = useState('');
  const [tagOptions, setTagOptions] = useState<SelectOption[]>([]);
  const [subcategoryOptionsByType, setSubcategoryOptionsByType] = useState<Record<string, SelectOption[]>>({});
  const { user } = useAuth();
  const isSuperAdminUser =
    Boolean(user?.is_super_admin)
    || Boolean((user as any)?.isSuperAdmin)
    || (
    Array.isArray(user?.roles) &&
    user.roles.some((role) => String(role || '').toLowerCase() === 'super_admin')
  );

  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminContextEdit = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('admin') === 'true';
  }, [location.search]);
  const budgetApiBase = isAdminContextEdit ? '/adminbudget' : '/budget';

  const isEditMode = location.pathname.includes('/edit') && !!id;


  const isViewMode = !!id && !location.pathname.includes('/edit');


  const isNewMode = !id;
  const isReviewerAmountOnlyEdit = false;


  const [isEditable, setIsEditable] = useState(isNewMode);
  const [isApplicantCardOpen, setIsApplicantCardOpen] = useState(!id);
  const [proposalStatus, setProposalStatus] = useState<string>('');
  const [proposalStage, setProposalStage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionPopupOpen, setActionPopupOpen] = useState(false);
  const [actionType, setActionType] = useState<'return' | 'reject' | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);
  const openGuidelines = () => setShowGuidelines(true);
  const closeGuidelines = () => setShowGuidelines(false);

  useEffect(() => {
    if (!showGuidelines) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeGuidelines();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuidelines]);

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
        `${budgetApiBase}/search-applicant?q=${encodeURIComponent(query)}`
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
    setApplicantEntity((emp as any).entity || '');
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
      let typeParam = '';
      if (beneficiaryType === 'Faculty') {
        typeParam = '&type=Teaching';
      } else if (beneficiaryType === 'Staff') {
        typeParam = '&type=Non-Teaching';
      }

      const response = await authenticityUtility.get(
        `${budgetApiBase}/search-applicant?q=${encodeURIComponent(query)}${typeParam}`
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
    setBeneficiaryEmployeeId(Number.isInteger(Number(emp.employee_id)) ? Number(emp.employee_id) : null);
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
    updateLine(rowIndex, 'subHead', '');
    updateLine(rowIndex, 'budgetHead', selectedOption.budgetHead);

    if (selectedOption.optionType === 'head-sub-head' && selectedOption.subHead) {
      updateLine(rowIndex, 'subHead', selectedOption.subHead);
    }

    setBudgetHeadFilter((prev) => ({ ...prev, [rowIndex]: '' }));
  };



  const handleSubmitBudget = async () => {
    if (isSubmitting) {
      return;
    }
    if (!budgetLines.length) {
      showAlert('Please add at least one budget line.', 'warning');
      return;
    }

    for (let i = 0; i < budgetLines.length; i++) {
      const line = budgetLines[i];

      // Budget Head required
      if (!line.budgetHead?.trim()) {
        showAlert(`Budget Head is required for line ${i + 1}`, 'warning');
        return;
      }

      // Sub Head required
      if (!line.subHead?.trim()) {
        showAlert(`Sub Head is required for line ${i + 1}`, 'warning');
        return;
      }

      // Unit Amount required and positive
      const unitAmount = Number(line.amount);
      if (!line.amount || unitAmount <= 0) {
        showAlert(`Valid Unit Amount > 0 is required for line ${i + 1}`, 'warning');
        return;
      }
      // Quantity required and positive (blocks 0 qty)
      const quantity = Number(line.qty);
      if (!line.qty || quantity <= 0) {
        showAlert(`Valid Quantity > 0 is required for line ${i + 1}`, 'warning');
        return;
      }

      // Description required
      if (!line.description?.trim()) {
        showAlert(`Description is required for line ${i + 1}`, 'warning');
        return;
      }

      // Month splitup must EXACTLY match unit_amount * quantity
      const totalMonthAmount = Object.values(line.monthAmounts || {}).reduce(
        (sum, val) => sum + (Number(val) || 0), 0
      );

      const expectedTotal = unitAmount * quantity;
      if (Math.abs(totalMonthAmount - expectedTotal) > 0.01) {
        showAlert(
          `Line ${i + 1}: Month total (₹${totalMonthAmount.toFixed(2)}) must equal Unit Amount × Qty (₹${expectedTotal.toFixed(2)})`,
          'warning'
        );
        return;
      }
    }

    // Rest of validation (applicant, beneficiary, tag, FY)...
    if (!applicantName?.trim()) {
      showAlert('Applicant Name is required', 'warning');
      return;
    }

    // Beneficiary validation
    const getBeneficiaryDisplayValue = () => {
      if (beneficiaryType === 'Institution') return 'K.S.Rangasamy College of Technology';
      if (['Faculty', 'Staff'].includes(beneficiaryType || '')) return beneficiaryValue?.trim();
      return categoryItem?.trim() || beneficiaryValue?.trim();
    };

    if (!beneficiaryType?.trim()) {
      showAlert('Beneficiary Type is required', 'warning');
      return;
    }

    const displayBeneficiaryValue = getBeneficiaryDisplayValue();
    if (!displayBeneficiaryValue) {
      showAlert('Beneficiary selection is required for the chosen type', 'warning');
      return;
    }

    // Tag mandatory
    if (!selectedTag?.trim()) {
      showAlert('Budget Tag is required', 'warning');
      return;
    }

    // Fiscal year validation
    const safeFY = String(explicitFiscalYear);
    const fiscalYearInt = parseInt(safeFY.split("-")[0]);
    if (isNaN(fiscalYearInt)) {
      showAlert("Error: Invalid Fiscal Year calculated. Please refresh.", 'error');
      return;
    }

    const formattedLines = budgetLines.map((line) => ({
      budget_head: line.budgetHead?.trim(),
      sub_head: line.subHead?.trim(),
      unit_amount: Number(line.amount),
      quantity: Number(line.qty),  // Now guaranteed > 0
      line_description: line.description?.trim(),
      month_allocations: line.monthAmounts || {},
    }));

    const payload = {
      request_date: date,
      fiscal_year: fiscalYearInt,
      employee_id: Number.isInteger(Number(applicantEmployeeId)) && Number(applicantEmployeeId) > 0
        ? Number(applicantEmployeeId)
        : undefined,
      beneficiary_type: beneficiaryType?.trim(),
      beneficiary_employee_id:
        ['Faculty', 'Staff'].includes(beneficiaryType) &&
          Number.isInteger(Number(beneficiaryEmployeeId)) &&
          Number(beneficiaryEmployeeId) > 0
          ? Number(beneficiaryEmployeeId)
          : undefined,
      beneficiary_value: displayBeneficiaryValue,
      proposal_description: '',
      applicant_name: applicantName?.trim(),
      applicant_entity: applicantEntity?.trim() || null,
      budget_tag: selectedTag?.trim(),
      lines: formattedLines,
    };

    try {
      setIsSubmitting(true);
      const isPrivilegedReviewer = isAdminContextEdit && isEditMode;
      const endpoint = isPrivilegedReviewer
        ? `/adminbudget/${id}`
        : (isEditMode ? `${budgetApiBase}/${id}` : budgetApiBase);

      const requestPayload = isPrivilegedReviewer
        ? {
          ...payload,
          lines: formattedLines.map((line, lineIndex) => ({
            line_id: budgetLines[lineIndex]?.lineId,
            budget_head: line.budget_head,
            sub_head: line.sub_head,
            line_description: line.line_description,
            unit_amount: Number(line.unit_amount),
            quantity: Number(line.quantity),
            month_allocations: line.month_allocations || {},
          })),
        }
        : payload;

      const httpMethod = isEditMode ? 'put' : 'post';

      const result = await (authenticityUtility as any)[httpMethod](endpoint, requestPayload);

      if (!result.success) {
        throw new Error(result.message || 'Submission failed on server');
      }

      showAlert(
        isPrivilegedReviewer
          ? 'Budget updated successfully!'
          : isEditMode
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
            // Reset form
            setBudgetLines([{
              budgetHead: '', subHead: '', amount: '', qty: '1', monthAmounts: { ...EMPTY_MONTHS }, description: '',
            }]);
            setExpandedRows([0]);
            // ... rest of reset code
          }
          if (isPrivilegedReviewer) {
            navigate("/admin/budget");
          } else {
            navigate("/budgetcard");
          }
        }
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      console.error('Submit error:', err);
      showAlert(`Failed to submit: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };




  useEffect(() => {
    let cancelled = false;

    const loadBeneficiaryOptions = async () => {
      const toOptions = (rows: any[]) =>
        rows
          .map((row: any) => normalizeText(row?.name))
          .filter(Boolean)
          .map((name: string) => ({ value: name, label: name }));

      const nextOptions: Record<string, SelectOption[]> = {};

      try {
        const json = await authenticityUtility.get(`${budgetApiBase}/org-units`) as any;
        const grouped = json?.data?.grouped;

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
            const json = await authenticityUtility.get(`${budgetApiBase}/org-units/${apiType}`) as any;
            const rows = Array.isArray(json?.data) ? json.data : [];
            nextOptions[beneficiaryKey] = toOptions(rows);
          } catch (error) {
            console.error(`Failed to fetch options for ${beneficiaryKey}:`, error);
            nextOptions[beneficiaryKey] = [];
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
  }, [budgetApiBase]);

  useEffect(() => {
    const loadTagOptions = async () => {
      try {
        const response: any = await authenticityUtility.get(`${budgetApiBase}/tags`);
        if (!response?.success || !Array.isArray(response?.data)) {
          setTagOptions(FALLBACK_TAG_OPTIONS);
          return;
        }

        const options = response.data
          .map((row: any) => ({
            value: String(row?.tag_name || '').trim(),
            label: String(row?.tag_name || '').trim(),
          }))
          .filter((opt: SelectOption) => opt.value.length > 0);

        setTagOptions(options.length > 0 ? options : FALLBACK_TAG_OPTIONS);
      } catch (error) {
        console.error('Failed to load budget tags', error);
        setTagOptions(FALLBACK_TAG_OPTIONS);
      }
    };

    loadTagOptions();
  }, [budgetApiBase]);

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
    }
  }, [beneficiaryType]);


  useEffect(() => {
    if (!id) return;

    const loadProposal = async () => {
      try {
        const json = await authenticityUtility.get(`${budgetApiBase}/${id}`) as any;
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

        setProposalStatus((p.status || '').toString());
        setProposalStage((p.current_stage || p.currentStage || '').toString());


        setApplicantName(p.applicant_name || p.user_name || p.name || "");
        setApplicantSearchQuery(p.applicant_name || p.user_name || p.name || "");
        setApplicantEmployeeId(
          Number.isInteger(Number(p.employee_id)) && Number(p.employee_id) > 0
            ? Number(p.employee_id)
            : null
        );
        setEmail(p.applicant_email || p.email || p.user_email || "");


        setDesignation(p.designation || p.user_designation || "");
        setMobile(p.mobile || p.user_mobile || p.phone || "");


        const normalizedBeneficiaryType =
          p.beneficiary_type === 'ProfessionalBodies'
            ? 'Professional Body'
            : p.beneficiary_type || '';
        setBeneficiaryType(normalizedBeneficiaryType);
        setBeneficiaryEmployeeId(null);

        // For Faculty type, set the search query for editing
        if (normalizedBeneficiaryType === 'Faculty') {
          setBeneficiarySearchQuery(p.beneficiary_value || '');
        }

        const normalizedBeneficiaryValue =
          normalizedBeneficiaryType === 'Department'
            ? (p.department || p.beneficiary_value || '')
            : ['Centre', 'Cell', 'Club', 'Section', 'Professional Body'].includes(normalizedBeneficiaryType)
              ? (p.org_unit_name || p.beneficiary_value || '')
              : (p.beneficiary_value || '');

        const normalizedApplicantDepartment =
          p.applicant_department ||
          p.user_department ||
          (normalizedBeneficiaryType === 'Department' ? '' : p.department) ||
          '';

        setBeneficiaryValue(normalizedBeneficiaryValue);
        setCategoryItem(normalizedBeneficiaryValue);
        setSelectedTag(p.budget_tag || '');
        setDepartment(normalizedApplicantDepartment);
        setApplicantEntity(p.applicant_entity || p.user_entity || '');

        // Date
        setDate((p.request_date || "").split("T")[0]);


        const apiLines = Array.isArray(data.lines) ? data.lines : [];
        const approvedAllocations = data.approved_allocations;
        const hasApprovedAllocations =
          approvedAllocations &&
          typeof approvedAllocations === 'object' &&
          !Array.isArray(approvedAllocations) &&
          Object.keys(approvedAllocations).length > 0;
        const apiAllocations = isAdminContextEdit
          ? (hasApprovedAllocations ? approvedAllocations : (data.allocations || {}))
          : (data.allocations || {});

        const mappedLines = apiLines.map((ln: any) => {
          const lineAllocations = apiAllocations[ln.id] || {};
          const proposedQty = Number(ln.quantity || 1);
          const approvedUnit = Number(ln.approved_unit_amount ?? ln.unit_amount ?? 0);
          const approvedLineTotal = Number(ln.approved_line_total ?? ln.line_total ?? 0);
          const inferredApprovedQty =
            approvedUnit > 0 && Number.isFinite(approvedLineTotal) && approvedLineTotal > 0
              ? (approvedLineTotal / approvedUnit)
              : proposedQty;
          const roundedApprovedQty = Number.isFinite(inferredApprovedQty)
            ? (Math.abs(inferredApprovedQty - Math.round(inferredApprovedQty)) < 0.0001
              ? Math.round(inferredApprovedQty)
              : inferredApprovedQty)
            : proposedQty;

          return {
            lineId: Number(ln.id),
            budgetHead: (ln.budget_head || "").toString(),
            subHead: (ln.sub_head || "").toString(),
            amount: String(parseInt((ln.approved_unit_amount ?? ln.unit_amount) || "0", 10)),
            qty: String(roundedApprovedQty > 0 ? roundedApprovedQty : proposedQty),
            monthAmounts: lineAllocations,
            description: (ln.line_description || "").toString(),
          };
        });

        if (mappedLines.length > 0) {
          setBudgetLines(mappedLines);
        }


        const editableStatuses = ['draft', 'level1_returned', 'ithead_returned', 'dof_returned', 'submitted', 're_submitted'];
        const isStatusEditable = editableStatuses.includes((p.status || '').toLowerCase());
        const isEditURL = location.pathname.includes('/edit');
        const currentStageKey = String(p.current_stage || p.currentStage || '').toLowerCase();
        const stagePermission = STAGE_PERMISSION_MAP[currentStageKey];
        const hasAnyBudgetWorkflowPermission =
          hasPermission(user, 'budget.workflow.level1') ||
          hasPermission(user, 'budget.workflow.dof') ||
          hasPermission(user, 'budget.workflow.principal');
        const canPrivilegedAdminEdit =
          isAdminContextEdit &&
          isEditURL &&
          (
            isSuperAdminUser ||
            hasPermission(user, 'budget.admin.view') ||
            hasPermission(user, 'budget.admin.manage') ||
            hasAnyBudgetWorkflowPermission ||
            (Boolean(stagePermission) && hasPermission(user, stagePermission))
          );
        const canOverrideEditLock = canPrivilegedAdminEdit;
        const viewModePath = isAdminContextEdit ? `/budget/${id}?admin=true` : `/budget/${id}`;
        const accessType = json.accessType || 'owner';

        // Applicants/beneficiaries can only view; they cannot edit someone else's proposal.
        if ((accessType === 'applicant' || accessType === 'beneficiary') && !canPrivilegedAdminEdit) {
          setIsEditable(false);
          setExpandedRows(mappedLines.map((_, idx) => idx));
          if (isEditURL) {
            const viewOnlyMessage = accessType === 'beneficiary'
              ? 'You are the beneficiary for this proposal. You can only view it, not edit.'
              : 'You are the applicant for this proposal. You can only view it, not edit.';
            showAlert(viewOnlyMessage, 'info', undefined, () => {
              closeAlert();
              navigate(viewModePath);
            });
          }
        } else if (!isEditURL) {
          setIsEditable(false);
          setExpandedRows(mappedLines.map((_, idx) => idx));
        } else if (isEditURL && !isStatusEditable && !canOverrideEditLock) {
          setIsEditable(false);
          showAlert(`This proposal cannot be edited because it is currently '${p.status}'. Switching to View mode.`, 'warning', undefined, () => {
            closeAlert();
            navigate(viewModePath);
          });
        } else {
          setIsEditable(true);
        }

      } catch (e) {
        console.error("loadProposal error", e);
      }
    };

    loadProposal();
  }, [id, location.pathname, navigate, isSuperAdminUser, isAdminContextEdit, user, budgetApiBase]);

  const canProcessStage = (stage: string) => {
    if (isSuperAdmin(user)) return true;
    const permissionKey = STAGE_PERMISSION_MAP[(stage || '').toLowerCase()];
    if (!permissionKey) return false;
    return hasPermission(user, permissionKey);
  };

  const onApprove = async () => {
    if (!id) {
      showAlert('Missing budget id.', 'error');
      return;
    }

    if (!proposalStage || !canProcessStage(proposalStage)) {
      showAlert('You do not have permission to approve this stage.', 'warning');
      return;
    }

    showAlert(
      'Are you sure you want to approve this budget?',
      'warning',
      'Confirm Approval',
      async () => {
        try {
          const response: any = await authenticityUtility.patch(`${budgetApiBase}/${id}/approval`, {
            decision: 'approved',
          });

          if (response?.success || response?.data?.success) {
            navigate(-1);
            return;
          }

          showAlert(response?.message || 'Failed to approve', 'error');
        } catch (error: any) {
          showAlert(error?.response?.data?.message || 'Failed to approve', 'error');
        }
      },
      true,
      'Approve'
    );
  };

  const onArchive = async () => {
    if (!id) {
      showAlert('Missing budget id.', 'error');
      return;
    }

    showAlert(
      'Are you sure you want to archive this budget?',
      'warning',
      'Confirm Archive',
      async () => {
        try {
          const response: any = await authenticityUtility.patch(`${budgetApiBase}/${id}/approval`, {
            decision: 'archived',
          });

          if (response?.success || response?.data?.success) {
            navigate(-1);
            return;
          }

          showAlert(response?.message || 'Failed to archive', 'error');
        } catch (error: any) {
          showAlert(error?.response?.data?.message || 'Failed to archive', 'error');
        }
      },
      true,
      'Archive'
    );
  };

  const openActionPopup = (type: 'return' | 'reject') => {
    if (!proposalStage || !canProcessStage(proposalStage)) {
      showAlert('You do not have permission to process this stage.', 'warning');
      return;
    }
    setActionType(type);
    setActionComment('');
    setActionPopupOpen(true);
  };

  const closeActionPopup = () => {
    setActionPopupOpen(false);
    setActionType(null);
    setActionComment('');
  };

  const submitActionWithComment = async () => {
    if (!id || !actionType) return;

    if (!proposalStage || !canProcessStage(proposalStage)) {
      showAlert('You do not have permission to process this stage.', 'warning');
      return;
    }

    const comment = actionComment.trim();
    if (!comment) {
      showAlert('Please enter comments.', 'warning');
      return;
    }

    try {
      const response: any = await authenticityUtility.patch(`${budgetApiBase}/${id}/approval`, {
        decision: actionType === 'return' ? 'returned' : 'rejected',
        feedback: comment,
      });

      if (response?.success || response?.data?.success) {
        closeActionPopup();
        navigate(-1);
        return;
      }
      showAlert(response?.message || `Failed to ${actionType}`, 'error');
    } catch (error: any) {
      showAlert(error?.response?.data?.message || `Failed to ${actionType}`, 'error');
    }
  };


  useEffect(() => {

    if (id || applicantName) return;

    const fetchUserDetails = async () => {
      try {
        const json = await authenticityUtility.get(`${budgetApiBase}/faculty`) as any;

        if (json.success && json.data) {
          setApplicantEmployeeId(
            Number.isInteger(Number(json.data.employee_id)) && Number(json.data.employee_id) > 0
              ? Number(json.data.employee_id)
              : null
          );
          setApplicantName(json.data.name || '');
          setApplicantSearchQuery(json.data.name || '');
          setDepartment(json.data.department || '');
          setApplicantEntity(json.data.entity_name || json.data.entity || '');
          setEmail(json.data.email || '');


          if (json.data.designation) setDesignation(json.data.designation);
          if (json.data.mobile) setMobile(json.data.mobile);
        }
      } catch (error) {
        console.error("Failed to auto-fill user details", error);
      }
    };

    fetchUserDetails();
  }, [id, applicantName, budgetApiBase]);

  const formatINR = (value: number | string): string => {
    const num = Number(value || 0);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  };
  const [selectedTag, setSelectedTag] = useState<string>('');

  useEffect(() => {
    if (!beneficiaryType?.trim()) {
      setSelectedTag('');
      return;
    }

    setSelectedTag((prev) => {
      if (prev) return prev;
      if (beneficiaryType === 'Faculty' || beneficiaryType === 'Staff') return 'Skilling';
      if (beneficiaryType === 'Department') return '';
      return 'Essentials';
    });
  }, [beneficiaryType]);

  const showTagDropdown = !!beneficiaryType?.trim();

  return (
    <div className="budgetPage">
      <div className="budgetGuidelinesTrigger">
        <button
          type="button"
          className="budgetGuidelinesButton"
          onClick={openGuidelines}
          aria-label="Open budget proposal guidelines"
        >
          <Bell size={20} />
        </button>
      </div>

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
                          setTimeout(() => {
                            setShowApplicantDropdown(false);
                            if (!applicantEmployeeId) {
                              setApplicantName('');
                              setApplicantSearchQuery('');
                            } else if (applicantSearchQuery !== applicantName) {
                              setApplicantSearchQuery(applicantName);
                            }
                          }, 200);
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
              <div className="col-md-3">
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
                        setSelectedTag('');
                        setCategoryItem('');
                        setCategorySelections([]);
                        setBeneficiaryEmployeeId(null);
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
                        { value: 'Staff', label: 'Staff' },
                        { value: 'Department', label: 'Department' },
                        { value: 'Centre', label: 'Centre' },
                        { value: 'Cell', label: 'Cell' },
                        { value: 'Club', label: 'Club' },
                        { value: 'Section', label: 'Section' },
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
                          minHeight: '45px',
                          height: 45,
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

              <div className="col-md-6">
                {['Faculty', 'Staff'].includes(beneficiaryType) ? (
                  <div className="form-group" style={{ height: '72px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block', flexShrink: 0 }}>
                      {beneficiaryType === 'Staff' ? 'Staff Name' : 'Faculty Name'}
                    </label>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="text"
                        value={beneficiarySearchQuery || beneficiaryValue || ''}
                        onChange={(e) => {
                          setBeneficiaryValue(e.target.value);
                          setBeneficiaryEmployeeId(null);
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
                          setTimeout(() => {
                            setShowBeneficiaryDropdown(false);
                            if (!beneficiaryEmployeeId) {
                              setBeneficiaryValue('');
                              setBeneficiarySearchQuery('');
                            } else if (beneficiarySearchQuery !== beneficiaryValue) {
                              setBeneficiarySearchQuery(beneficiaryValue);
                            }
                          }, 200);
                        }}
                        placeholder={beneficiaryType === 'Staff' ? "Search staff by name or ERP ID" : "Search faculty by name or ERP ID"}
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
                            minHeight: ' 45px',
                            height: '45',
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
              <div className="col-md-3">
                {showTagDropdown ? (
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px' }}>
                    <label style={{ fontSize: '14px', color: '#495057', marginBottom: '8px', fontWeight: '600', display: 'block', flexShrink: 0 }}>
                      Tag
                    </label>
                    <div style={{ position: 'relative', zIndex: 1000, flex: 1 }}>
                      <Select
                        value={selectedTag ? { value: selectedTag, label: selectedTag } : null}
                        onChange={(selected: any) => setSelectedTag(selected?.value || '')}
                        options={tagOptions}
                        placeholder=""
                        isSearchable={true}
                        isClearable={false}   // no cross
                        isDisabled={!isEditable}
                        menuPosition="fixed"
                        menuPlacement="auto"
                        styles={{
                          control: (base: any, state: any) => ({
                            ...base,
                            minHeight: '45px',
                            height: '45px',
                            borderRadius: 12,
                            border: state.isFocused ? '1px solid #0069ab' : '1px solid #e0e0e0',
                            boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 105, 171, 0.15)' : 'none',
                            backgroundColor: isEditable ? '#fcfdff' : '#e9ecef',
                            fontSize: '0.95rem',
                            fontFamily: 'inherit'
                          }),
                          dropdownIndicator: (base: any, state: any) => ({
                            ...base,
                            padding: '0 15px',
                            transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                          }),
                          indicatorSeparator: () => ({ display: 'none' }),
                          valueContainer: (base: any) => ({ ...base, padding: '2px 15px' }),
                          option: (base: any, state: any) => ({
                            ...base,
                            padding: '10px 15px',
                            backgroundColor: state.isSelected
                              ? '#0069ab'
                              : state.isFocused
                                ? 'rgba(0,105,171,0.1)'
                                : '#fff',
                            color: state.isSelected ? 'white' : '#333'
                          })
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  // same “disabled/blank control space” like other extra dropdowns
                  <div style={{ height: '74px' }} />
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
                              isDisabled={!isEditable || isReviewerAmountOnlyEdit}
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
                              isDisabled={!line.budgetHead || !isEditable || isReviewerAmountOnlyEdit}
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
                              onChange={(e) => {
                                const v = e.target.value;
                                const safe = v === "" ? "" : Math.max(0, Number(v)).toString();
                                updateLine(idx, "amount", safe);
                              }}
                              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                            />
                          </td>
                          <td>
                            <input
                              className="tableInput"
                              type="number"
                              min={0}
                              step={1}
                              placeholder="0"
                              value={line.qty}
                              onChange={(e) => {
                                const v = e.target.value;
                                const safe = v === "" ? "" : Math.max(0, Number(v)).toString();
                                updateLine(idx, "qty", safe);
                              }}
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
                              disabled={isReviewerAmountOnlyEdit || budgetLines.some(
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
                              disabled={isReviewerAmountOnlyEdit || budgetLines.length === 1}
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
                                    readOnly={isReviewerAmountOnlyEdit}
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
                                    {MONTH_KEYS.map((month) => {
                                      const value = line.monthAmounts[month] || "";
                                      const isActive = !!value && parseFloat(value) > 0;

                                      return (
                                        <div
                                          key={month}
                                          className={`monthBox ${isActive ? "monthBox--active" : ""}`}
                                        >
                                          <div className="monthLabel">{month}</div>
                                          <input
                                            type="number"
                                            min={0}
                                            placeholder="0"
                                            className="monthAmountInput"
                                            value={line.monthAmounts[month] || ""}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              const safe =
                                                v === "" ? "" : Math.max(0, Number(v)).toString();
                                              updateLineMonthAmount(idx, month, safe);
                                            }}
                                            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                                          />
                                        </div>
                                      );
                                    })}
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

      {/* ADMIN ACTION BUTTONS */}
      {(new URLSearchParams(location.search).get('admin') === 'true' || canProcessStage(proposalStage)) && !isSuperAdmin(user) && !isEditMode && (
        <div
          className="budget-admin-actions"
          style={{
            padding: '40px 20px',
            display: 'flex',
            gap: '30px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            className="budget-admin-btn budget-admin-btn--approve"
            onClick={onApprove}
            disabled={
              proposalStatus.toLowerCase().includes('completed') ||
              proposalStatus.toLowerCase().includes('archived') ||
              !canProcessStage(proposalStage)
            }
            style={{
              padding: '12px 24px',
              background: '#e7f8ef',
              color: '#137a3a',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
            }}
          >
            <CheckCircle2 size={18} /> Approve
          </button>

          <button
            className="budget-admin-btn budget-admin-btn--return"
            onClick={() => openActionPopup('return')}
            disabled={
              ['completed', 'rejected', 'archived', 'archive'].some((token) =>
                proposalStatus.toLowerCase().includes(token)
              ) || !canProcessStage(proposalStage)
            }
            style={{
              padding: '12px 24px',
              background: '#fff4d6 ',
              color: '#a97900 ',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              boxShadow: '0 4px 12px rgba(255, 193, 7, 0.3)',
            }}
          >
            <RotateCcw size={18} />Return
          </button>

          <button
            className="budget-admin-btn budget-admin-btn--reject"
            onClick={() => openActionPopup('reject')}
            disabled={
              proposalStatus.toLowerCase().includes('rejected') ||
              proposalStatus.toLowerCase().includes('archived') ||
              !canProcessStage(proposalStage)
            }
            style={{
              padding: '12px 24px',
              background: '#fdeaea ',
              color: '#b42318',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',

            }}
          >
            <XCircle size={18} />  Reject
          </button>

          <button
            className="budget-admin-btn budget-admin-btn--archive"
            onClick={onArchive}
            disabled={proposalStatus.toLowerCase().includes('archived') || proposalStatus.toLowerCase().includes('archive')}
            style={{
              padding: '12px 24px',
              background: '#eef2ff',
              color: '#334155',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 4px 12px rgba(108, 117, 125, 0.3)',
            }}
          >
            <Archive size={18} />Archive
          </button>
        </div>
      )}

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
            disabled={isSubmitting}
            style={{
              padding: "12px 40px",
              fontSize: "16px",
              fontWeight: "700",
              backgroundColor: "#0069ab",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              minWidth: "150px",
              boxShadow: "0 6px 20px rgba(0, 105, 171, 0.3)",
              transition: "all 0.3s ease",
            }}
            onMouseOver={(e) => {
              if (isSubmitting) return;
              e.currentTarget.style.backgroundColor = "#0056b3";
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 105, 171, 0.4)";
            }}
            onMouseOut={(e) => {
              if (isSubmitting) return;
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
            {isSubmitting ? "Saving..." : isEditMode ? "Update Budget" : "Submit Budget"}
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
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
      />

      {actionPopupOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: 16,
          }}
          onClick={closeActionPopup}
        >
          <div
            style={{
              width: 'min(520px, 95vw)',
              background: '#fff',
              borderRadius: 12,
              padding: 18,
              boxShadow: '0 10px 35px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h5 style={{ margin: 0, marginBottom: 10 }}>
              {actionType === 'return' ? 'Return Budget' : 'Reject Budget'} - Comments
            </h5>

            <textarea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={4}
              placeholder="Enter comments (required)..."
              style={{
                width: '100%',
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                padding: '10px 12px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={closeActionPopup}
                style={{
                  border: '1px solid #ddd',
                  background: '#fff',
                  borderRadius: 10,
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitActionWithComment}
                style={{
                  border: 'none',
                  background: actionType === 'reject' ? '#dc3545' : '#f0ad4e',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      {showGuidelines && (
        <div className="budgetGuidelinesOverlay" onClick={closeGuidelines}>
          <div className="budgetGuidelinesPanel" onClick={(event) => event.stopPropagation()}>
            <div className="budgetGuidelinesPanelInner">
              <button
                type="button"
                className="budgetGuidelinesClose"
                aria-label="Close budget proposal guidelines"
                onClick={closeGuidelines}
              >
                <XCircle size={20} />
              </button>
              <BudgetProposalGuidelines embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Budget;
