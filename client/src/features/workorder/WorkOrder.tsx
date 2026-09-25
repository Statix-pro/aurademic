/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import {
  BatteryCharging,
  Building2,
  Droplets,
  Eye,
  Factory,
  Hammer,
  Leaf,
  Paintbrush,
  Plus,
  Snowflake,
  Trash2,
  Upload,
  Users,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
  ChevronDown,
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useAbility } from '../../shared/casl/AbilityContext';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import CustomDropdown, { OptionType } from '../../shared/components/ui/CustomDropdown';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import '../../shared/styles/forms.css';
import '../../shared/components/ui/common.css';
import './WorkOrder.css';

interface WorkItem {
  id: string;
  type: string;
  subType: string;
  block: string;
  floor: string;
  roomLabNo: string;
  description: string;
  targetDate: string;
  locationPhotos: PhotoAttachment[];
  qty: number;
  priority: string;
}

interface PhotoAttachment {
  id: string;
  file?: File;
  preview: string;
}

interface BeneficiaryEmployee {
  employee_id?: number | string;
  name?: string;
  designation?: string;
  department?: string;
}

const WORK_TYPES = [
  'Installation',
  'Construction',
  'Replacement',
  'Service',
  'Maintenance',
  'Labour work',
];

const BENEFICIARY_OPTIONS = [
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

const TAG_OPTIONS = [
  'Laboratory',
  'Association',
  'Skilling',
  'Research',
  'Outreach',
  'Office',
  'Academics',
  'Essentials',
  'Events',
  'Innovation',
  'Start-up',
  'Entrepreneurship',
  'CoE Claims',
];

const BENEFICIARY_ENTITY_TYPES: Record<string, string> = {
  Department: 'DEPARTMENT',
  Centre: 'CENTRE',
  Cell: 'CELL',
  Club: 'CLUB',
  Section: 'SECTION',
  'Professional Body': 'PROFESSIONAL_BODY',
};

// Work Category Types and Sub-types map
const WORK_CATALOG: Record<string, Record<string, string[]>> = {
  Electrical: {
    Installation: [
      'New wiring layout',
      'Switchboard installation',
      'Power socket installation',
      'Distribution board setup',
      'Earthing / grounding setup',
      'UPS / inverter installation',
      'Light fixture installation',
      'Light bulb / tube installation',
      'Ceiling fan installation',
      'Exhaust fan installation',
      'Fan regulator installation',
    ],
    Construction: [
      'Distribution board setup',
      'Electrical conduit laying',
      'Cable tray construction',
      'Panel room construction',
    ],
    Replacement: [
      'Damaged wire replacement',
      'Switch / socket replacement',
      'MCB / fuse replacement',
      'Distribution board replacement',
      'Light fitting replacement',
      'Light bulb / tube replacement',
      'UPS battery replacement',
      'Fan motor replacement',
      'Ceiling fan replacement',
      'Fan regulator replacement',
    ],
    Service: [
      'Short circuit repair',
      'Power outage investigation',
      'Sparking / burning smell check',
      'Phase failure repair',
      'Stabilizer / UPS fault repair',
      'Light not working repair',
      'Light flickering repair',
      'Ceiling fan repair',
      'Exhaust fan repair',
      'Fan regulator repair',
    ],
    Maintenance: [
      'Wiring inspection (periodic)',
      'DB / panel board servicing',
      'Generator periodic service',
      'Earthing check',
      'Light fixture maintenance',
      'Fan cleaning / maintenance',
    ],
    'Labour work': [
      'Wire pulling / laying',
      'Conduit pipe fitting',
      'Light fixture fitting',
      'Cable tray fitting',
      'Fan fitting / shifting',
      'Electrical helper work',
    ],
  },
  'IT Infrastructure': {
    Installation: [
      'New network point / LAN setup',
      'Wi-Fi access point installation',
      'CCTV camera installation',
      'Computer / PC setup',
      'Printer / scanner setup',
      'Projector / AV system install',
      'Server rack installation',
      'Intercom / PA system setup',
    ],
    Construction: [
      'New network point / LAN setup',
      'Server rack installation',
      'Server room construction',
      'Network cable duct construction',
    ],
    Replacement: [
      'LAN cable replacement',
      'Keyboard / mouse replacement',
      'RAM / hard disk replacement',
      'Monitor replacement',
      'Toner / ink cartridge replacement',
      'Switch / router replacement',
      'HDMI / VGA cable replacement',
    ],
    Service: [
      'Wi-Fi connectivity repair',
      'PC not booting / blue screen',
      'PC overheating repair',
      'Printer fault repair',
      'Projector fault repair',
      'CCTV fault repair',
      'Biometric device fault',
    ],
    Maintenance: [
      'PC overheating repair',
      'Printer fault repair',
      'Projector fault repair',
      'CCTV fault repair',
      'PC / laptop cleaning & checkup',
      'Network switch maintenance',
      'CCTV system maintenance',
      'Server room maintenance',
    ],
    'Labour work': [
      'LAN cable pulling / termination',
      'Cable management / dressing',
      'PC shifting / relocation',
      'Equipment loading / unloading',
    ],
  },
  Plumbing: {
    Installation: [
      'New tap / faucet installation',
      'Wash basin installation',
      'Commode / toilet installation',
      'New pipeline laying',
      'Water tank installation',
      'Water pump installation',
      'Geyser / water heater install',
      'Water filter / RO installation',
    ],
    Construction: [
      'Wash basin installation',
      'Commode / toilet installation',
      'New pipeline laying',
      'Underground pipeline construction',
      'Overhead water tank construction',
      'Sump / underground tank build',
      'Drainage channel construction',
      'Septic tank construction',
    ],
    Replacement: [
      'Tap / faucet replacement',
      'Wash basin replacement',
      'Flush tank / valve replacement',
      'Damaged pipe replacement',
      'Water pump replacement',
      'Geyser element replacement',
      'Water filter cartridge replace',
    ],
    Service: [
      'Damaged pipe replacement',
      'Water leakage repair',
      'No water flow repair',
      'Pipe burst repair',
      'Sewage / drainage clearance',
      'Toilet flush repair',
      'Water pump fault repair',
      'Foul smell investigation',
    ],
    Maintenance: [
      'Water leakage repair',
      'Sewage / drainage clearance',
      'Water pump fault repair',
      'Foul smell investigation',
      'Pipeline flushing & inspection',
      'Water tank cleaning',
      'Drain / sump cleaning',
      'Water pump servicing',
    ],
    'Labour work': [
      'Pipe cutting / joining',
      'Digging / trenching for pipe',
      'Tank / pump shifting',
      'Bathroom fittings labour',
    ],
  },
  HVAC: {
    Installation: [
      'Split AC installation',
      'Window AC installation',
      'Cassette AC installation',
      'Water cooler installation',
      'Exhaust fan installation',
      'Ceiling fan installation',
      'Ventilation duct setup',
    ],
    Construction: [
      'Ventilation duct setup',
      'AC plant room construction',
      'Cooling tower platform build',
    ],
    Replacement: [
      'AC remote replacement',
      'AC filter replacement',
      'Compressor replacement',
      'Fan motor replacement',
      'AC PCB / board replacement',
      'Refrigerant refill',
    ],
    Service: [
      'Fan motor replacement',
      'Refrigerant refill',
      'AC not cooling repair',
      'AC not turning on',
      'AC water dripping repair',
      'AC loud noise repair',
      'AC error code diagnosis',
      'Water cooler fault repair',
      'Exhaust / ceiling fan repair',
    ],
    Maintenance: [
      'AC filter replacement',
      'AC not cooling repair',
      'AC water dripping repair',
      'Water cooler fault repair',
      'Exhaust / ceiling fan repair',
      'AC filter cleaning',
      'AC coil cleaning (indoor/outdoor)',
      'AC periodic service',
      'Water cooler cleaning',
      'Duct cleaning',
    ],
    'Labour work': [
      'AC unit lifting / shifting',
      'Bracket / stand fabrication',
      'Copper pipe bending / fitting',
      'Drain pipe fitting',
    ],
  },
  Carpentry: {
    Installation: [
      'New door installation',
      'New window installation',
      'Furniture assembly (desk/table)',
      'Chair assembly',
      'Almirah / cabinet installation',
      'Partition panel installation',
      'Notice board / whiteboard install',
    ],
    Construction: [
      'New door installation',
      'New window installation',
      'Custom wooden furniture build',
      'Built-in wardrobe / shelf build',
      'Lab / workshop bench build',
      'Reception counter construction',
    ],
    Replacement: [
      'Door lock replacement',
      'Door hinge replacement',
      'Broken glass replacement',
      'Window latch replacement',
      'Chair wheel / castor replacement',
      'Chair cushion replacement',
      'Desk drawer lock replacement',
      'Armrest replacement',
    ],
    Service: [
      'Window latch replacement',
      'Lock stuck / broken repair',
      'Door alignment repair',
      'Door stopper repair',
      'Window latch repair',
      'Drawer jam repair',
      'Chair height mechanism repair',
    ],
    Maintenance: [
      'Door alignment repair',
      'Door / window lubrication',
      'Furniture polishing',
      'Lock oiling / servicing',
      'Periodic furniture checkup',
    ],
    'Labour work': [
      'Furniture assembly (desk/table)',
      'Chair assembly',
      'Door lock replacement',
      'Door hinge replacement',
      'Armrest replacement',
      'Furniture shifting / relocation',
      'Door / window fitting labour',
      'Furniture dismantling',
      'Heavy item loading / unloading',
    ],
  },
  Gardening: {
    Installation: [
      'New garden bed setup',
      'Plant sapling installation',
      'Lawn grass laying',
      'Irrigation pipe installation',
      'Garden edging installation',
      'Planter box installation',
    ],
    Construction: [
      'Landscape area development',
      'Pathway garden border construction',
      'Soil bed preparation',
      'Compost pit construction',
      'Garden fencing work',
    ],
    Replacement: [
      'Dead plant replacement',
      'Damaged planter replacement',
      'Broken irrigation pipe replacement',
      'Garden light fixture replacement',
      'Lawn patch replacement',
    ],
    Service: [
      'Plant pruning',
      'Weed removal',
      'Pest control treatment',
      'Soil loosening',
      'Irrigation leak repair',
      'Tree branch trimming',
    ],
    Maintenance: [
      'Lawn mowing',
      'Regular watering',
      'Garden cleaning',
      'Fertilizer application',
      'Hedge trimming',
      'Seasonal garden maintenance',
    ],
    'Labour work': [
      'Soil shifting',
      'Plant pot shifting',
      'Garden waste clearing',
      'Watering support',
      'Mulch spreading',
      'General gardening helper work',
    ],
  },
  Civil: {
    Installation: [
      'New flooring (tiles / marble)',
      'Carpet / mat laying',
      'False ceiling installation',
      'New staircase / steps',
      'Pathway / walkway construction',
      'Parking area marking',
    ],
    Construction: [
      'New flooring (tiles / marble)',
      'New staircase / steps',
      'Pathway / walkway construction',
      'Compound wall construction',
      'Room / building construction',
      'Slab / RCC work',
      'Brick masonry work',
      'Plastering work',
      'Roof / terrace construction',
      'Broken tile replacement',
      'Wall crack repair',
    ],
    Replacement: [
      'Broken tile replacement',
      'Carpet replacement',
      'False ceiling panel replacement',
      'Damaged skirting replacement',
      'Window / door frame replacement',
    ],
    Service: [
      'Wall crack repair',
      'Roof leakage repair',
      'Dampness / seepage repair',
      'Floor settlement repair',
      'Pathway / ramp repair',
      'Staircase damage repair',
    ],
    Maintenance: [
      'Roof leakage repair',
      'Dampness / seepage repair',
      'Floor cleaning & maintenance',
      'Wall painting (periodic)',
      'Terrace waterproofing maintenance',
      'Drainage cleaning',
      'Compound / campus maintenance',
    ],
    'Labour work': [
      'Brick masonry work',
      'Plastering work',
      'Wall painting (periodic)',
      'Tile cutting / laying labour',
      'Plaster / putty application',
      'Painting labour',
      'Debris / material clearing',
      'Sand / cement mixing',
    ],
  },
  'Metal Works': {
    Installation: [
      'MS frame installation',
      'Gate / grill installation',
      'Handrail installation',
      'Rack / stand installation',
      'Window grill installation',
      'Shed / canopy installation',
      'Staircase railing installation',
    ],
    Construction: [
      'Fabrication of frame',
      'Steel frame fabrication',
      'Door frame fabrication',
      'Window frame fabrication',
      'Table / bench frame fabrication',
      'Platform / stand fabrication',
      'Truss / shed frame fabrication',
      'Grill / gate fabrication',
      'Handrail / railing fabrication',
      'Partition frame fabrication',
    ],
    Replacement: [
      'Damaged frame replacement',
      'Rusted member replacement',
      'Hinge / latch replacement',
      'Grill panel replacement',
      'Sheet / mesh replacement',
      'Support bracket replacement',
    ],
    Service: [
      'Welding repair',
      'Frame alignment repair',
      'Crack repair',
      'Gate / grill repair',
      'Railing repair',
      'Rust removal and touch-up',
      'Bolt / anchor tightening',
    ],
    Maintenance: [
      'Welding joint inspection',
      'Anti-rust painting',
      'Frame strengthening',
      'Gate / railing maintenance',
      'Lubrication of hinges',
      'Periodic fabrication check',
    ],
    'Labour work': [
      'Cutting and welding labour',
      'Grinding / finishing work',
      'Drilling / anchoring work',
      'Material shifting for fabrication',
      'Sheet metal bending',
      'Fabrication helper work',
    ],
  },
  Interior: {
    Installation: [
      'Wallpaper installation',
      'Wall panelling installation',
      'False ceiling installation',
      'Curtain / blind installation',
      'Glass partition installation',
      'Acoustic panel installation',
      'Signage / name board installation',
    ],
    Construction: [
      'Partition wall construction',
      'Reception area build',
      'Display unit construction',
      'Storage cabinet construction',
      'Modular workstation setup',
    ],
    Replacement: [
      'Wallpaper replacement',
      'Ceiling tile replacement',
      'Curtain / blind replacement',
      'Glass panel replacement',
      'Carpet / mat replacement',
      'Signage replacement',
    ],
    Service: [
      'Wall panel repair',
      'False ceiling repair',
      'Curtain track repair',
      'Glass crack repair',
      'Acoustic panel repair',
      'Interior fixture repair',
    ],
    Maintenance: [
      'Interior deep cleaning',
      'Wall panel polishing',
      'Carpet shampooing',
      'Ceiling inspection',
      'Periodic interior checkup',
    ],
    'Labour work': [
      'Wallpaper pasting labour',
      'Panel fitting labour',
      'Ceiling tile fitting labour',
      'Curtain fitting labour',
      'Interior material shifting',
    ],
  },
  Labour: {
    Installation: [
      'Scaffolding setup',
      'Temporary shed erection',
      'Barricade installation',
      'Material storage setup',
    ],
    Construction: [
      'Brick / block laying',
      'Concrete mixing & pouring',
      'Trench digging',
      'Foundation work',
      'Compound wall building',
    ],
    Replacement: [
      'Damaged barricade replacement',
      'Safety net replacement',
      'Scaffolding plank replacement',
    ],
    Service: [
      'Debris removal',
      'Site cleaning after work',
      'Emergency labour support',
      'Water logging clearance',
    ],
    Maintenance: [
      'Campus ground maintenance',
      'Garden / landscape upkeep',
      'Drain / sump cleaning',
      'Road / pathway sweeping',
      'Periodic campus cleanup',
    ],
    'Labour work': [
      'Material loading / unloading',
      'Furniture shifting / relocation',
      'Heavy equipment moving',
      'Sand / gravel spreading',
      'General helper work',
      'Event setup / teardown labour',
    ],
  },
  Painting: {
    Installation: [
      'Primer / base coat application',
      'New wall painting',
      'Texture / designer finish application',
      'Anti-fungal coating application',
      'Waterproof coating application',
    ],
    Construction: [
      'Putty / wall preparation',
      'Plaster repair before painting',
      'Scaffolding for painting work',
    ],
    Replacement: [
      'Old paint stripping & repainting',
      'Discoloured wall repainting',
      'Ceiling repaint',
      'Door / window frame repaint',
    ],
    Service: [
      'Paint touch-up',
      'Stain removal on wall',
      'Dampness treatment & repaint',
      'Graffiti removal',
      'Paint peeling repair',
    ],
    Maintenance: [
      'Periodic repainting (exterior)',
      'Periodic repainting (interior)',
      'Anti-rust painting (metal)',
      'Floor marking repaint',
      'Boundary wall painting',
    ],
    'Labour work': [
      'Wall scraping / sanding labour',
      'Putty application labour',
      'Painting helper work',
      'Scaffolding setup for painters',
      'Paint material mixing',
    ],
  },
  UPS: {
    Installation: [
      'New UPS unit installation',
      'UPS battery bank setup',
      'Online UPS installation',
      'Servo stabilizer installation',
      'UPS bypass switch installation',
      'Power conditioning unit setup',
    ],
    Construction: [
      'UPS room construction',
      'Battery rack fabrication & setup',
      'Cable tray for UPS wiring',
      'Ventilation setup for UPS room',
    ],
    Replacement: [
      'UPS battery replacement',
      'UPS fan replacement',
      'UPS fuse / MCB replacement',
      'UPS display panel replacement',
      'Stabilizer component replacement',
      'UPS capacitor replacement',
    ],
    Service: [
      'UPS not turning on repair',
      'UPS beeping / alarm repair',
      'UPS overload fault repair',
      'Battery not charging repair',
      'UPS output voltage fluctuation',
      'Stabilizer fault repair',
      'UPS bypass mode issue',
    ],
    Maintenance: [
      'UPS battery health check',
      'UPS periodic servicing',
      'Battery terminal cleaning',
      'UPS load testing',
      'UPS firmware update',
      'Stabilizer periodic service',
      'UPS room cleaning & inspection',
    ],
    'Labour work': [
      'UPS unit shifting / relocation',
      'Battery loading / unloading',
      'Cable pulling for UPS',
      'Battery disposal / recycling',
      'UPS room cleaning labour',
    ],
  },
};

const CATEGORIES = [
  'Carpentry',
  'Civil',
  'Electrical',
  'Gardening',
  'HVAC',
  'Interior',
  'IT Infrastructure',
  'Labour',
  'Metal Works',
  'Painting',
  'Plumbing',
  'UPS',
];

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  Electrical: Zap,
  'IT Infrastructure': Wifi,
  Plumbing: Droplets,
  HVAC: Snowflake,
  Carpentry: Hammer,
  Gardening: Leaf,
  Civil: Building2,
  'Metal Works': Factory,
  Interior: Wrench,
  Labour: Users,
  Painting: Paintbrush,
  UPS: BatteryCharging,
};

const BLOCKS = [
  'Select',
  'Main Block',
  'Science Block',
  'Library Block',
  'CSE Block',
  'IT Block',
  'Mechanical Block',
  'Civil Block',
  'Hostel Block',
];

const FLOORS = [
  'Select',
  'Ground Floor',
  'First Floor',
  'Second Floor',
  'Third Floor',
  'Fourth Floor',
];

const toDropdownOptions = (values: string[]): OptionType[] =>
  values.filter((value) => value !== 'Select').map((value) => ({ value, label: value }));

const getSelectedOption = (value: string, options: OptionType[]): OptionType | null =>
  options.find((option) => option.value === value) || null;

const BLOCK_DROPDOWN_OPTIONS = toDropdownOptions(BLOCKS);
const FLOOR_DROPDOWN_OPTIONS = toDropdownOptions(FLOORS);
type PhotoField = 'locationPhotos';

const createWorkItem = (): WorkItem => ({
  id: crypto.randomUUID(),
  type: '',
  subType: '',
  block: 'Select',
  floor: 'Select',
  roomLabNo: '',
  description: '',
  targetDate: '',
  locationPhotos: [],
  qty: 1,
  priority: 'Routine',
});

const getTodayInputDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface CollapsibleCardProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  primaryTitle?: boolean;
  contentClassName?: string;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  isOpen,
  onToggle,
  children,
  primaryTitle = false,
  contentClassName = '',
}) => (
  <div className="workorderCard form-card">
    <button type="button" className="cardHeader" onClick={onToggle} aria-expanded={isOpen}>
      <h5 className={`workorderCardTitle form-section-title ${primaryTitle ? 'primary' : ''}`}>
        {title}
      </h5>
      <ChevronDown size={18} className={`card-toggle-arrow ${isOpen ? 'open' : ''}`} />
    </button>

    {isOpen && <div className={`cardContent ${contentClassName}`}>{children}</div>}
  </div>
);

interface ReadOnlyFieldProps {
  label: string;
  type?: string;
  value: string;
  noMargin?: boolean;
}

const ReadOnlyField: React.FC<ReadOnlyFieldProps> = ({
  label,
  type = 'text',
  value,
  noMargin = false,
}) => (
  <div
    className="custom-input-group workorderFormGroup"
    style={noMargin ? { marginBottom: 0 } : undefined}
  >
    <label className="custom-label form-label">{label}</label>
    <input className="form-control custom-input" type={type} value={value} readOnly />
  </div>
);

interface WorkOrderDropdownProps {
  name: string;
  options: OptionType[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  className?: string;
  isDisabled?: boolean;
}

const WorkOrderDropdown: React.FC<WorkOrderDropdownProps> = ({
  name,
  options,
  value,
  onValueChange,
  placeholder,
  className = '',
  isDisabled = false,
}) => (
  <CustomDropdown
    name={name}
    className={`workorderDropdown ${className}`.trim()}
    options={options}
    value={getSelectedOption(value, options)}
    onChange={(option) => {
      const selected = option as OptionType | null;
      onValueChange(selected?.value ? String(selected.value) : '');
    }}
    placeholder={placeholder}
    isDisabled={isDisabled}
  />
);

const WorkOrder: React.FC = () => {
  const isHydrating = useRef(false);
  const { user } = useAuth();
  const ability = useAbility();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id && location.pathname.includes('/edit'));
  const isViewMode = Boolean(id && !isEditMode);
  const canSubmit = isEditMode
    ? ability.can('edit', 'WorkOrder')
    : ability.can('create', 'WorkOrder');

  // Collapsible section states
  const [isApplicantOpen, setIsApplicantOpen] = useState(true);
  const [isBeneficiaryOpen, setIsBeneficiaryOpen] = useState(true);
  const [isTypeWorkOpen, setIsTypeWorkOpen] = useState(true);
  const [isWorkItemsOpen, setIsWorkItemsOpen] = useState(true);

  // Auto-fetched form states
  const [applicantName, setApplicantName] = useState(user?.name || '');
  const [date, setDate] = useState(getTodayInputDate);
  const [department, setDepartment] = useState(user?.department || '');
  const [designation, setDesignation] = useState(user?.designation || '');
  const [email, setEmail] = useState(user?.email || '');
  const [mobile, setMobile] = useState('');
  const [beneficiaryType, setBeneficiaryType] = useState('');
  const [beneficiaryValue, setBeneficiaryValue] = useState('');
  const [beneficiaryEmployeeId, setBeneficiaryEmployeeId] = useState<number | null>(null);
  const [beneficiaryValueOptions, setBeneficiaryValueOptions] = useState<OptionType[]>([]);
  const [beneficiarySearchQuery, setBeneficiarySearchQuery] = useState('');
  const [beneficiarySearchResults, setBeneficiarySearchResults] = useState<BeneficiaryEmployee[]>(
    [],
  );
  const [showBeneficiarySearch, setShowBeneficiarySearch] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Carpentry');
  const [workItems, setWorkItems] = useState<WorkItem[]>([createWorkItem()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Flipped to true once loadRecord has applied all hydrated state.
  // Used to clear isHydrating.current after the hydration commit.
  const [recordLoaded, setRecordLoaded] = useState(false);
  const isAssignmentMode = isEditMode && new URLSearchParams(location.search).get('assign') === 'true';
  const [assignees, setAssignees] = useState<BeneficiaryEmployee[]>([]);
  const [assignmentStatus, setAssignmentStatus] = useState('Pending');
  const [assignedEmployee, setAssignedEmployee] = useState('');

  // Request ID tracking for race condition resolution during fast navigation
  const currentRequestIdRef = useRef(0);

  const fetchRecord = async () => {
    if (!id) return;
    const reqId = ++currentRequestIdRef.current;
    setIsLoading(true);
    setError(null);
    // Reset recordLoaded so setRecordLoaded(true) at the end of hydration always
    // triggers a state change, even when navigating from one record to another.
    setRecordLoaded(false);
    try {
      const response = (await authenticityUtility.get(`/workorders/${id}`)) as any;
      if (!response?.success || !response?.data) {
        setError(response?.message || 'Failed to load work order data.');
        return;
      }
      const wo = response.data;
      if (reqId !== currentRequestIdRef.current) return;
      setApplicantName(wo.applicant_name || '');
      setDate(wo.date ? String(wo.date).slice(0, 10) : getTodayInputDate());
      setDepartment(wo.department || '');
      setDesignation(wo.designation || '');
      setEmail(wo.email || '');
      setMobile(wo.mobile || '');
      const storedBeneficiaryType = String(wo.beneficiary_type || wo.beneficiaryType || '').trim();
      const beneficiaryTypeValue = BENEFICIARY_OPTIONS.find(
        (option) => option.toLowerCase() === storedBeneficiaryType.toLowerCase(),
      ) || storedBeneficiaryType;
      setBeneficiaryType(beneficiaryTypeValue);
      setBeneficiaryValue(wo.beneficiary_value || wo.beneficiaryValue || '');
      setSelectedTag(wo.budget_tag || '');
      isHydrating.current = true;
      setSelectedCategory(wo.category_name || 'Carpentry');
      if (Array.isArray(wo.items) && wo.items.length > 0) {
        setAssignedEmployee(wo.items[0]?.assigned_to || wo.items[0]?.assignedTo || '');
        setAssignmentStatus(wo.items[0]?.status || 'Pending');
        const loadedItems = wo.items.map((item: any) => ({
          id: String(item.id || crypto.randomUUID()),
          type: item.type_name || item.type || '',
          subType: item.sub_type_name || item.subType || '',
          block: item.block || 'Select',
          floor: item.floor || 'Select',
          roomLabNo: item.room_lab_no || item.roomLabNo || '',
          description: item.description || '',
          targetDate: item.target_date
            ? String(item.target_date).slice(0, 10)
            : item.targetDate || '',
          locationPhotos: Array.isArray(item.locationPhotos)
            ? item.locationPhotos.map((url: string, i: number) => ({
                id: `loc-photo-${i}`,
                preview: url,
              }))
            : [],
          qty: Number(item.qty) || 1,
          priority: item.priority || 'Routine',
        }));
        setWorkItems(loadedItems);
      } else {
        setWorkItems([createWorkItem()]);
      }
      // Signal hydration is complete; the cleanup effect will clear the flag
      // after this render commits (see useEffect[recordLoaded] below).
      setRecordLoaded(true);
    } catch (err) {
      if (reqId !== currentRequestIdRef.current) return;
      console.error('Error loading work order:', err);
      setError('Failed to load work order. Please try again later.');
    } finally {
      if (reqId === currentRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Fetch existing record when editing / viewing
  useEffect(() => {
    if (!id) return;
    fetchRecord();
    return () => {
      // Invalidate the running request on unmount / id change by advancing the
      // monotonic counter, so late responses never match the current request id.
      currentRequestIdRef.current += 1;
    };
  }, [id]);

  useEffect(() => {
    if (!isAssignmentMode) return;
    authenticityUtility.get('/workorders/assignees').then((response: any) => {
      setAssignees(Array.isArray(response?.data) ? response.data : []);
    }).catch((err) => console.error('Failed to load assignees:', err));
  }, [isAssignmentMode]);

  const saveAssignment = async () => {
    if (!workItems.length) return;
    const employee = assignees.find((item) => item.name === assignedEmployee);
    try {
      await Promise.all(workItems.map((item) => authenticityUtility.patch(`/workorders/items/${item.id}/dashboard`, {
        status: assignmentStatus,
        assignedTo: assignedEmployee,
        assignedToRole: employee?.designation || 'Staff',
      })));
      navigate('/workflow/workorder');
    } catch (err) {
      setError('Failed to save assignment. Please try again.');
    }
  };

  // Fetch applicant details on mount (only for new records)
  useEffect(() => {
    if (id) return;
    const fetchUserDetails = async () => {
      try {
        const json = (await authenticityUtility.get('/budget/faculty')) as any;
        if (json.success && json.data) {
          if (json.data.name) setApplicantName(json.data.name);
          if (json.data.department) setDepartment(json.data.department);
          if (json.data.designation) setDesignation(json.data.designation);
          if (json.data.email) setEmail(json.data.email);
          if (json.data.mobile) setMobile(json.data.mobile);
        }
      } catch (err) {
        console.error('Error fetching user details:', err);
      }
    };
    fetchUserDetails();
  }, [id]);

  useEffect(() => {
    if (isHydrating.current) return;
    setSelectedTag((prev) => {
      if (prev) return prev;
      if (beneficiaryType === 'Faculty' || beneficiaryType === 'Staff') return 'Skilling';
      return '';
    });

    if (beneficiaryType === 'Institution') {
      setBeneficiaryValue('K.S.Rangasamy College of Technology');
    } else if (beneficiaryType === 'Department') {
      setBeneficiaryValue(department);
    } else {
      setBeneficiaryValue('');
    }
  }, [beneficiaryType, department]);

  useEffect(() => {
    if (!beneficiaryType) {
      setBeneficiaryValueOptions([]);
      setBeneficiarySearchQuery('');
      setBeneficiarySearchResults([]);
      return;
    }

    if (beneficiaryType === 'Institution') {
      setBeneficiaryValueOptions([
        {
          value: 'K.S.Rangasamy College of Technology',
          label: 'K.S.Rangasamy College of Technology',
        },
      ]);
      return;
    }

    const entityType = BENEFICIARY_ENTITY_TYPES[beneficiaryType];
    const employeeType = beneficiaryType === 'Faculty' ? 'Teaching' : 'Non-Teaching';
    if (!entityType && beneficiaryType !== 'Faculty' && beneficiaryType !== 'Staff') return;

    let cancelled = false;
    const loadBeneficiaryValues = async () => {
      try {
        // Use the bulk budget master-data endpoint. It is the canonical source used by
        // the other budget forms and includes departments as well as entity units.
        const response = (await authenticityUtility.get('/budget/org-units')) as any;
        const groupedRows = response?.data?.grouped?.[entityType];
        const directRows = response?.data?.[entityType];
        // The budget endpoints have returned both a flat `data` array and a wrapped
        // `{ data: { all, grouped } }` payload over time. Keep the workorder form
        // compatible with both shapes so a valid budget master list is not rendered
        // as an empty dropdown.
        const rows = Array.isArray(groupedRows)
          ? groupedRows
          : Array.isArray(directRows)
            ? directRows
            : Array.isArray(response?.data)
              ? response.data
              : Array.isArray(response?.data?.all)
                ? response.data.all.filter((row: any) => row?.type_code === entityType)
                : Array.isArray(response)
                  ? response
                  : [];
        const options = rows
          .map((row: any) => String(row?.name || row?.entity_name || row?.unit_name || '').trim())
          .filter(Boolean)
          .map((name: string) => ({ value: name, label: name }));
        if (!cancelled) setBeneficiaryValueOptions(options);
      } catch (error) {
        console.error('Failed to load beneficiary values:', error);
        if (!cancelled) setBeneficiaryValueOptions([]);
      }
    };

    if (beneficiaryType === 'Faculty' || beneficiaryType === 'Staff') {
      const loadEmployees = async () => {
        try {
          const response = (await authenticityUtility.get(
            `/budget/search-applicant?q=&type=${employeeType}`,
          )) as any;
          const rows = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.data?.all)
              ? response.data.all
              : Array.isArray(response)
                ? response
                : [];
          const options = rows
            .map((row: any) => String(row?.name || '').trim())
            .filter(Boolean)
            .map((name: string) => ({ value: name, label: name }));
          if (!cancelled) setBeneficiaryValueOptions(options);
        } catch (error) {
          console.error('Failed to load beneficiary employees:', error);
          if (!cancelled) setBeneficiaryValueOptions([]);
        }
      };
      void loadEmployees();
    } else {
      void loadBeneficiaryValues();
    }
    return () => {
      cancelled = true;
    };
  }, [beneficiaryType]);

  const handleBeneficiarySearch = async (query: string) => {
    setBeneficiarySearchQuery(query);
    setBeneficiaryValue(query);
    setShowBeneficiarySearch(true);

    if (!['Faculty', 'Staff'].includes(beneficiaryType)) {
      setBeneficiarySearchResults([]);
      return;
    }

    try {
      const type = beneficiaryType === 'Faculty' ? 'Teaching' : 'Non-Teaching';
      const response = (await authenticityUtility.get(
        `/budget/search-applicant?q=${encodeURIComponent(query)}&type=${type}`,
      )) as any;
      setBeneficiarySearchResults(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to search beneficiary employees:', error);
      setBeneficiarySearchResults([]);
    }
  };

  const getBeneficiaryValueLabel = () => {
    if (beneficiaryType === 'Faculty') return 'Faculty Name';
    if (beneficiaryType === 'Staff') return 'Staff Name';
    if (beneficiaryType === 'Professional Body') return 'Professional Body';
    return beneficiaryType || 'Beneficiary';
  };

  const getBeneficiaryValuePlaceholder = () => {
    if (beneficiaryType === 'Faculty') return 'Search faculty by name or ERP ID';
    if (beneficiaryType === 'Staff') return 'Search staff by name or ERP ID';
    if (beneficiaryType === 'Institution') return 'K.S.Rangasamy College of Technology';
    return `Select ${getBeneficiaryValueLabel()}`;
  };

  // AlertModal states
  const [alertShow, setAlertShow] = useState(false);
  const [alertType, setAlertType] = useState<AlertType>('info');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Auto-populate types when category changes.
  // Guard: if isHydrating.current is true this render was triggered by loadRecord
  // setting the category from the server response — skip the reset entirely.
  useEffect(() => {
    if (isHydrating.current) return;
    setWorkItems((prev) => {
      const categoryData = WORK_CATALOG[selectedCategory] || {};
      const validTypes = Object.keys(categoryData);

      return prev.map((item) => {
        const isTypeValid = validTypes.includes(item.type);
        const validSubTypes = isTypeValid ? categoryData[item.type] || [] : [];
        const isSubTypeValid = validSubTypes.includes(item.subType);

        return {
          ...item,
          type: isTypeValid ? item.type : '',
          subType: isSubTypeValid ? item.subType : '',
        };
      });
    });
  }, [selectedCategory]);

  // Clear the hydration guard flag AFTER the hydration commit's effects have run.
  // React runs all effects for a given commit in declaration order (top to bottom).
  // Because this effect is declared AFTER the [selectedCategory] guard above,
  // it is guaranteed to execute after the guard has already seen isHydrating.current
  // as true and skipped the reset. Only then do we flip it to false, so any
  // subsequent user-driven category change correctly falls through the guard.
  useEffect(() => {
    if (!recordLoaded) return;
    isHydrating.current = false;
  }, [recordLoaded]);

  const triggerAlert = (type: AlertType, title: string, message: string) => {
    setAlertType(type);
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertShow(true);
  };

  const getIncompleteWorkItemFields = (item: WorkItem) => {
    const missing: string[] = [];
    if (!item.type) missing.push('Type');
    if (!item.subType) missing.push('Sub-type');
    if (item.block === 'Select') missing.push('Block');
    if (item.floor === 'Select') missing.push('Floor');
    if (!item.roomLabNo.trim()) missing.push('Room No / Landmark');
    if (!item.qty || item.qty < 1) missing.push('Items');
    if (!item.priority) missing.push('Priority');
    return missing;
  };

  const canAddWorkItem = workItems.every((item) => getIncompleteWorkItemFields(item).length === 0);

  const resetWorkOrderForm = () => {
    setWorkItems([createWorkItem()]);
  };

  const handleAddRow = () => {
    const incompleteIndex = workItems.findIndex(
      (item) => getIncompleteWorkItemFields(item).length > 0,
    );
    if (incompleteIndex !== -1) {
      const missing = getIncompleteWorkItemFields(workItems[incompleteIndex]);
      triggerAlert(
        'warning',
        'Complete Work Item',
        `Please fill ${missing.join(', ')} for item ${incompleteIndex + 1} before adding another item.`,
      );
      return;
    }

    setWorkItems([...workItems, createWorkItem()]);
  };

  const handleDeleteRow = (index: number) => {
    if (workItems.length === 1) {
      setWorkItems([createWorkItem()]);
      return;
    }
    const updated = workItems.filter((_, idx) => idx !== index);
    setWorkItems(updated);
  };

  const handleItemChange = <K extends keyof WorkItem>(
    index: number,
    field: K,
    value: WorkItem[K],
  ) => {
    setWorkItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'type') {
        updated[index].subType = '';
      }
      return updated;
    });
  };

  const handlePhotoUpload = (
    itemId: string,
    photoField: PhotoField,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter((file) => {
      if (!file.type.startsWith('image/')) {
        triggerAlert('warning', 'Invalid File Type', `${file.name} is not an image file.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        triggerAlert('warning', 'File Too Large', `${file.name} is larger than 5MB.`);
        return false;
      }
      return true;
    });

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const attachment: PhotoAttachment = {
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          preview: reader.result as string,
        };

        setWorkItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, [photoField]: [...item[photoField], attachment] }
              : item,
          ),
        );
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleClearPhotos = (e: React.MouseEvent, itemId: string, photoField: PhotoField) => {
    e.stopPropagation();
    setWorkItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [photoField]: [] } : item)),
    );
  };

  const validateForm = () => {
    for (let i = 0; i < workItems.length; i++) {
      const missing = getIncompleteWorkItemFields(workItems[i]);
      if (missing.length > 0) {
        triggerAlert(
          'warning',
          'Validation Error',
          `Please fill ${missing.join(', ')} for item ${i + 1}.`,
        );
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // 1. Upload any newly added photos first
    const uploadedUrlsByItem = new Map<string, Array<string | Record<string, any>>>();
    try {
      for (const item of workItems) {
        const urls: Array<string | Record<string, any>> = [];
        for (const photo of item.locationPhotos) {
          if (!photo.file) {
            urls.push(photo.preview);
            continue;
          }
          const formData = new FormData();
          formData.append('file', photo.file);
          // BACKEND CONTRACT: expecting /workorders/upload to return { success: true, data: { url: "..." } }
          const uploadRes = (await authenticityUtility.postFile(
            '/workorders/upload',
            formData,
          )) as any;
          if (!uploadRes?.success || !uploadRes.data?.url) {
            throw new Error(uploadRes?.message || 'Upload response missing url');
          }
          urls.push({
            url: uploadRes.data.url,
            file_path: uploadRes.data.file_path || uploadRes.data.url,
            file_name: uploadRes.data.file_name || photo.file.name,
            mime_type: uploadRes.data.mimeType || photo.file.type || null,
            file_size: uploadRes.data.size ?? photo.file.size ?? null,
          });
        }
        uploadedUrlsByItem.set(item.id, urls);
      }
    } catch (uploadError) {
      console.error('Photo upload failed:', uploadError);
      triggerAlert('error', 'Upload Failed', 'Failed to upload photos. Please try again.');
      return; // Stop form submission if uploads fail
    }

    const payload = {
      applicantName,
      ...(isEditMode ? {} : { date }),
      department,
      designation,
      email,
      mobile,
      beneficiary_type: beneficiaryType,
      beneficiary_value:
        beneficiaryType === 'Institution'
          ? 'K.S.Rangasamy College of Technology'
          : beneficiaryValue || '',
      ...(beneficiaryEmployeeId ? { beneficiary_employee_id: beneficiaryEmployeeId } : {}),
      budget_tag: selectedTag,
      category: selectedCategory,
      workItems: workItems.map((item) => ({
        type: item.type,
        subType: item.subType,
        block: item.block,
        floor: item.floor,
        roomLabNo: item.roomLabNo,
        description: item.description,
        targetDate: item.targetDate,
        qty: item.qty,
        priority: item.priority,
        locationPhotos: uploadedUrlsByItem.get(item.id) ?? [],
      })),
    };

    try {
      if (isEditMode && id) {
        await authenticityUtility.put(`/workorders/${id}`, payload);
        triggerAlert(
          'success',
          'Update Successful',
          'Your work order has been updated successfully.',
        );
      } else {
        await authenticityUtility.post('/workorders', payload);
        triggerAlert(
          'success',
          'Submission Successful',
          'Your work order has been submitted successfully.',
        );
      }
      setTimeout(() => {
        resetWorkOrderForm();
        navigate('/workorderdashboard');
      }, 900);
    } catch (error) {
      console.error('Failed to submit work order:', error);
      triggerAlert(
        'error',
        isEditMode ? 'Update Failed' : 'Submission Failed',
        isEditMode
          ? 'Unable to update this work order. Please try again.'
          : 'Unable to submit this work order. Please try again.',
      );
    }
  };

  if (isLoading) {
    return (
      <div
        className="workorderPage journal-form-body d-flex justify-content-center align-items-center"
        style={{ minHeight: '60vh' }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="workorderPage journal-form-body d-flex justify-content-center align-items-center"
        style={{ minHeight: '60vh' }}
      >
        <div className="alert alert-danger d-flex flex-column align-items-center" role="alert">
          <div style={{ marginBottom: '15px' }}>{error}</div>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={fetchRecord}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workorderPage journal-form-body">
      <div className="journal-form-container workorderContainer">
        {isAssignmentMode && (
          <div className="card mb-3 p-3 border-primary">
            <h5 className="mb-3">Assign Work</h5>
            <div className="workorder-assignment-details">
              <div><span>Type of Work</span><strong>{workItems[0]?.type || selectedCategory || 'Not specified'}</strong></div>
              <div><span>Subtype</span><strong>{workItems[0]?.subType || 'Not specified'}</strong></div>
            </div>
            <div className="row g-3">
              <div className="col-md-7">
                <label className="form-label">Active employee</label>
                <select className="form-select" value={assignedEmployee} onChange={(event) => setAssignedEmployee(event.target.value)}>
                  <option value="">Not assigned</option>
                  {assignees.map((employee) => <option key={String(employee.employee_id)} value={employee.name}>{employee.name}{employee.designation ? ` (${employee.designation})` : ''}</option>)}
                </select>
              </div>
              <div className="col-md-5">
                <label className="form-label">Status</label>
                <select className="form-select" value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value)}>
                  {['Pending', 'Assigned', 'Procurement', 'On Hold', 'Completed'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <button type="button" className="btn btn-primary mt-3" onClick={saveAssignment}>Save assignment</button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <CollapsibleCard
            title="Applicant Details"
            isOpen={isApplicantOpen}
            onToggle={() => setIsApplicantOpen((prev) => !prev)}
            primaryTitle
          >
            <div className="row">
              <div className="col-md-7">
                <ReadOnlyField label="Applicant Name" value={applicantName} />
              </div>

              <div className="col-md-5">
                <ReadOnlyField label="Date" type="date" value={date} />
              </div>
            </div>

            <div className="row">
              <div className="col-md-7">
                <ReadOnlyField label="Department" value={department} />
              </div>

              <div className="col-md-5">
                <ReadOnlyField label="Designation" value={designation} />
              </div>
            </div>

            <div className="row">
              <div className="col-md-7">
                <ReadOnlyField label="Email" type="email" value={email} noMargin />
              </div>

              <div className="col-md-5">
                <ReadOnlyField label="Mobile" type="tel" value={mobile} noMargin />
              </div>
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="Beneficiary"
            isOpen={isBeneficiaryOpen}
            onToggle={() => setIsBeneficiaryOpen((prev) => !prev)}
          >
            <div className="workorderBeneficiaryCardBody">
              <div className={`workorderBeneficiaryGrid ${beneficiaryType ? 'has-selection' : ''}`}>
                <div className="workorderBeneficiaryField">
                  <label className="custom-label form-label">Beneficiary</label>
                  <WorkOrderDropdown
                    name="workorderBeneficiaryType"
                    options={toDropdownOptions(BENEFICIARY_OPTIONS)}
                    value={beneficiaryType}
                    onValueChange={(value) => {
                      setBeneficiaryType(value);
                      setSelectedTag('');
                    }}
                    placeholder=""
                    className="workorderBeneficiaryDropdown"
                    isDisabled={isViewMode}
                  />
                </div>

                {beneficiaryType && (
                  <>
                    <div className="workorderBeneficiaryField workorderBeneficiaryFieldWide">
                      <label className="custom-label form-label">
                        {getBeneficiaryValueLabel()}
                      </label>
                      {['Faculty', 'Staff'].includes(beneficiaryType) ? (
                        <div className="workorderBeneficiarySearchWrap">
                          <input
                            type="text"
                            className="form-control custom-input workorderBeneficiaryInput"
                            value={beneficiarySearchQuery || beneficiaryValue}
                            onChange={(event) => void handleBeneficiarySearch(event.target.value)}
                            onFocus={() =>
                              void handleBeneficiarySearch(beneficiarySearchQuery || '')
                            }
                            onBlur={() => setTimeout(() => setShowBeneficiarySearch(false), 200)}
                            placeholder={getBeneficiaryValuePlaceholder()}
                            disabled={isViewMode}
                          />
                          {showBeneficiarySearch && beneficiarySearchResults.length > 0 && (
                            <div className="workorderBeneficiarySearchResults">
                              {beneficiarySearchResults.map((employee) => (
                                <button
                                  type="button"
                                  className="workorderBeneficiarySearchResult"
                                  key={employee.employee_id || employee.name}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    const name = employee.name || '';
                                    setBeneficiaryValue(name);
                                    setBeneficiaryEmployeeId(Number(employee.employee_id) || null);
                                    setBeneficiarySearchQuery(name);
                                    setShowBeneficiarySearch(false);
                                  }}
                                >
                                  <strong>{employee.name}</strong>
                                  <span>
                                    {employee.designation || 'N/A'} | {employee.department || 'N/A'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <WorkOrderDropdown
                          name="workorderBeneficiaryValue"
                          options={beneficiaryValueOptions}
                          value={beneficiaryValue}
                          onValueChange={setBeneficiaryValue}
                          placeholder={getBeneficiaryValuePlaceholder()}
                          className="workorderBeneficiaryDropdown"
                          isDisabled={isViewMode}
                        />
                      )}
                    </div>

                    <div className="workorderBeneficiaryField">
                      <label className="custom-label form-label">Tag</label>
                      <WorkOrderDropdown
                        name="workorderBeneficiaryTag"
                        options={toDropdownOptions(TAG_OPTIONS)}
                        value={selectedTag}
                        onValueChange={(value) => setSelectedTag(value)}
                        placeholder="Select Tag"
                        className="workorderBeneficiaryDropdown"
                        isDisabled={isViewMode}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="Type of Work"
            isOpen={isTypeWorkOpen}
            onToggle={() => setIsTypeWorkOpen((prev) => !prev)}
          >
            <div className="workorderCategoryContainer">
              <div className="workorderCategoryChips">
                {CATEGORIES.map((cat) => {
                  const CategoryIcon = CATEGORY_ICON_MAP[cat];

                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`workorderChip ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                      disabled={isViewMode}
                    >
                      {CategoryIcon && <CategoryIcon size={16} strokeWidth={2.2} />}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="Work Items"
            isOpen={isWorkItemsOpen}
            onToggle={() => setIsWorkItemsOpen((prev) => !prev)}
          >
            <div className="workorderTableWrap">
              <table className="workorderEntryTable workorderItemsTable custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>S.No.</th>
                    <th style={{ width: '23%' }}>Nature of Work</th>
                    <th style={{ width: '31%' }}>Work Detail</th>
                    <th style={{ width: '10%' }}>Items</th>
                    <th style={{ width: '18%' }}>Priority</th>
                    <th style={{ width: '10%' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workItems.map((item, idx) => {
                    const typeOptions = toDropdownOptions(WORK_TYPES);
                    const subTypeOptions = item.type
                      ? toDropdownOptions(WORK_CATALOG[selectedCategory]?.[item.type] || [])
                      : [];
                    const locationPhotoInputId = `workorder-location-photo-${item.id}`;
                    const firstLocationPhoto = item.locationPhotos[0];

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="workorderMainItemRow">
                          <td className="centerTd">{idx + 1}</td>
                          <td>
                            <WorkOrderDropdown
                              name={`workType-${item.id}`}
                              options={typeOptions}
                              value={item.type}
                              onValueChange={(value) => handleItemChange(idx, 'type', value)}
                              placeholder="Select type"
                              isDisabled={isViewMode}
                            />
                          </td>
                          <td>
                            <WorkOrderDropdown
                              name={`workSubType-${item.id}`}
                              options={subTypeOptions}
                              value={item.subType}
                              onValueChange={(value) => handleItemChange(idx, 'subType', value)}
                              placeholder="Select sub-type"
                              isDisabled={!item.type || isViewMode}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              className="tableInput form-control custom-input"
                              value={item.qty}
                              onChange={(e) =>
                                handleItemChange(idx, 'qty', parseInt(e.target.value) || 1)
                              }
                              disabled={isViewMode}
                            />
                          </td>
                          <td>
                            <div className="workorderPriorityToggle">
                              <button
                                type="button"
                                className={`priorityToggleBtn ${item.priority === 'Routine' ? 'active' : ''}`}
                                onClick={() => handleItemChange(idx, 'priority', 'Routine')}
                                disabled={isViewMode}
                              >
                                Routine
                              </button>
                              <button
                                type="button"
                                className={`priorityToggleBtn ${item.priority === 'High' ? 'active' : ''}`}
                                onClick={() => handleItemChange(idx, 'priority', 'High')}
                                disabled={isViewMode}
                              >
                                High
                              </button>
                            </div>
                          </td>
                          <td className="centerTd workorderActionCell">
                            <div className="actionButtons">
                              {!isViewMode && (
                                <>
                                  <button
                                    type="button"
                                    className="tableIconBtn"
                                    onClick={handleAddRow}
                                    disabled={!canAddWorkItem}
                                    title={
                                      canAddWorkItem
                                        ? 'Add work item'
                                        : 'Complete all fields before adding another item'
                                    }
                                  >
                                    <Plus size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    className="tableIconBtn tableIconBtnDanger"
                                    onClick={() => handleDeleteRow(idx)}
                                    disabled={workItems.length === 1}
                                    title={
                                      workItems.length === 1
                                        ? 'At least one item is required'
                                        : 'Delete item'
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        <tr className="workorderDetailsRow">
                          <td colSpan={6} className="workorderDetailsCell">
                            <div className="workorderDetailsGrid">
                              <div className="workorderDetailsToggles">
                                <div className="workorderToggleLine">
                                  <span>Location</span>
                                </div>
                                <div className="workorderToggleLine">
                                  <span>Description</span>
                                </div>
                              </div>

                              <div className="workorderDetailsFields">
                                <div className="workorderLocationFields">
                                  <WorkOrderDropdown
                                    name={`block-${item.id}`}
                                    options={BLOCK_DROPDOWN_OPTIONS}
                                    value={item.block}
                                    onValueChange={(value) =>
                                      handleItemChange(idx, 'block', value || 'Select')
                                    }
                                    placeholder="Block"
                                    isDisabled={isViewMode}
                                  />
                                  <WorkOrderDropdown
                                    name={`floor-${item.id}`}
                                    options={FLOOR_DROPDOWN_OPTIONS}
                                    value={item.floor}
                                    onValueChange={(value) =>
                                      handleItemChange(idx, 'floor', value || 'Select')
                                    }
                                    placeholder="Floor"
                                    isDisabled={isViewMode}
                                  />
                                  <input
                                    type="text"
                                    className="form-control custom-input"
                                    value={item.roomLabNo}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'roomLabNo', e.target.value)
                                    }
                                    placeholder="Room No. / Landmark"
                                    disabled={isViewMode}
                                  />
                                </div>
                                <div className="workorderDescriptionFields">
                                  <input
                                    type="text"
                                    className="form-control custom-input workorderDescriptionInput"
                                    value={item.description}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'description', e.target.value)
                                    }
                                    placeholder="Enter work item description..."
                                    disabled={isViewMode}
                                    style={{ flex: 1, marginRight: '15px' }}
                                  />
                                  <span className="workorderTargetDateLabel">Target Date</span>
                                  <input
                                    type="date"
                                    className="form-control custom-input workorderTargetDateInput"
                                    value={item.targetDate}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'targetDate', e.target.value)
                                    }
                                    disabled={isViewMode}
                                  />
                                </div>
                              </div>

                              <div className="workorderUploadPanel">
                                <div className="workorderUploadTitle">Photo Upload</div>
                                <input
                                  id={locationPhotoInputId}
                                  type="file"
                                  onChange={(e) => handlePhotoUpload(item.id, 'locationPhotos', e)}
                                  accept="image/*"
                                  multiple
                                  className="workorderHiddenFileInput"
                                  disabled={isViewMode}
                                />

                                {firstLocationPhoto ? (
                                  <div className="workorderUploadedFile">
                                    <a
                                      className="workorderPhotoViewBtn"
                                      href={firstLocationPhoto.preview}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="View uploaded photo"
                                      aria-label="View uploaded photo"
                                    >
                                      <Eye size={18} />
                                    </a>
                                    <span>{firstLocationPhoto.file?.name ?? 'Uploaded photo'}</span>
                                    {item.locationPhotos.length > 1 && (
                                      <small>+{item.locationPhotos.length - 1}</small>
                                    )}
                                    {!isViewMode && (
                                      <button
                                        type="button"
                                        className="workorderPhotoDeleteBtn"
                                        onClick={(e) =>
                                          handleClearPhotos(e, item.id, 'locationPhotos')
                                        }
                                        title="Remove photos"
                                        aria-label="Remove photos"
                                      >
                                        <Trash2 size={19} />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  !isViewMode && (
                                    <label
                                      className="workorderChooseFileBtn"
                                      htmlFor={locationPhotoInputId}
                                      title="Upload photo"
                                      aria-label="Upload photo"
                                    >
                                      <Upload size={18} />
                                      <span>Choose File</span>
                                    </label>
                                  )
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleCard>

          {/* Footer Submit Form Button (Centred and Styled using CSS class) */}
          {!isViewMode && canSubmit && (
            <div className="workorderFooter">
              <button type="submit" className="workorderBtnSubmit btn-submit-approval custom-btn">
                Submit Form
              </button>
            </div>
          )}
        </form>
      </div>

      {/* AlertModal for feedback */}
      <AlertModal
        show={alertShow}
        onHide={() => setAlertShow(false)}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
      />
    </div>
  );
};

export default WorkOrder;
