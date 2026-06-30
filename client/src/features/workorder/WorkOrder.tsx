import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import CustomDropdown, { OptionType } from '../../shared/components/ui/CustomDropdown';
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
  descriptionPhotos: PhotoAttachment[];
  qty: number;
  priority: string;
}

interface PhotoAttachment {
  id: string;
  file: File;
  preview: string;
}



const WORK_TYPES = [
  'Installation',
  'Construction',
  'Replacement',
  'Service',
  'Maintenance',
  'Labour work',
];

// Work Category Types and Sub-types map
const WORK_CATALOG: Record<string, Record<string, string[]>> = {
  'Electrical': {
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
  'HVAC': {
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
  'Carpentry': {
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
  'Gardening': {
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
  'Civil': {
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
  'Electrical': Zap,
  'IT Infrastructure': Wifi,
  'Plumbing': Droplets,
  'HVAC': Snowflake,
  'Carpentry': Hammer,
  'Gardening': Leaf,
  'Civil': Building2,
  'Metal Works': Factory,
  'Interior': Wrench,
  'Labour': Users,
  'Painting': Paintbrush,
  'UPS': BatteryCharging,
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

const PRIORITY_OPTIONS = ['Routine', 'High'];

const toDropdownOptions = (values: string[]): OptionType[] =>
  values.filter((value) => value !== 'Select').map((value) => ({ value, label: value }));

const getSelectedOption = (value: string, options: OptionType[]): OptionType | null =>
  options.find((option) => option.value === value) || null;

const PRIORITY_DROPDOWN_OPTIONS = toDropdownOptions(PRIORITY_OPTIONS);
const BLOCK_DROPDOWN_OPTIONS = toDropdownOptions(BLOCKS);
const FLOOR_DROPDOWN_OPTIONS = toDropdownOptions(FLOORS);
type PhotoField = 'locationPhotos' | 'descriptionPhotos';

const createWorkItem = (): WorkItem => ({
  id: Math.random().toString(36).slice(2, 11),
  type: '',
  subType: '',
  block: 'Select',
  floor: 'Select',
  roomLabNo: '',
  description: '',
  targetDate: '',
  locationPhotos: [],
  descriptionPhotos: [],
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
  const { user } = useAuth();
  const navigate = useNavigate();

  // Collapsible section states
  const [isApplicantOpen, setIsApplicantOpen] = useState(true);
  const [isTypeWorkOpen, setIsTypeWorkOpen] = useState(true);
  const [isWorkItemsOpen, setIsWorkItemsOpen] = useState(true);

  // Auto-fetched form states
  const [applicantName, setApplicantName] = useState(user?.name || '');
  const [date] = useState(getTodayInputDate);
  const [department, setDepartment] = useState(user?.department || '');
  const [designation, setDesignation] = useState(user?.designation || '');
  const [email, setEmail] = useState(user?.email || '');
  const [mobile, setMobile] = useState('');

  // Fetch applicant details on mount
  useEffect(() => {
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
  }, []);

  const [selectedCategory, setSelectedCategory] = useState('Carpentry');
  const [workItems, setWorkItems] = useState<WorkItem[]>([createWorkItem()]);

  // AlertModal states
  const [alertShow, setAlertShow] = useState(false);
  const [alertType, setAlertType] = useState<AlertType>('info');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Auto-populate types when category changes
  useEffect(() => {
    setWorkItems((prev) =>
      prev.map((item) => ({
        ...item,
        type: '',
        subType: '',
      })),
    );
  }, [selectedCategory]);

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
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
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

    const payload = {
      applicantName,
      date,
      department,
      designation,
      email,
      mobile,
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
      })),
    };

    try {
      await authenticityUtility.post('/workorders', payload);
      triggerAlert(
        'success',
        'Submission Successful',
        'Your work order has been submitted successfully.',
      );
      setTimeout(() => {
        resetWorkOrderForm();
        navigate('/workorder');
      }, 900);
    } catch (error) {
      console.error('Failed to submit work order:', error);
      triggerAlert(
        'error',
        'Submission Failed',
        'Unable to submit this work order. Please try again.',
      );
    }
  };

  return (
    <div className="workorderPage journal-form-body">
      <div className="journal-form-container workorderContainer">
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
                      ? toDropdownOptions(WORK_CATALOG[selectedCategory][item.type] || [])
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
                            />
                          </td>
                          <td>
                            <WorkOrderDropdown
                              name={`workSubType-${item.id}`}
                              options={subTypeOptions}
                              value={item.subType}
                              onValueChange={(value) => handleItemChange(idx, 'subType', value)}
                              placeholder="Select sub-type"
                              isDisabled={!item.type}
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
                            />
                          </td>
                          <td>
                            <div className="workorderPriorityToggle">
                              <button
                                type="button"
                                className={`priorityToggleBtn ${item.priority === 'Routine' ? 'active' : ''}`}
                                onClick={() => handleItemChange(idx, 'priority', 'Routine')}
                              >
                                Routine
                              </button>
                              <button
                                type="button"
                                className={`priorityToggleBtn ${item.priority === 'High' ? 'active' : ''}`}
                                onClick={() => handleItemChange(idx, 'priority', 'High')}
                              >
                                High
                              </button>
                            </div>
                          </td>
                          <td className="centerTd workorderActionCell">
                            <div className="actionButtons">
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
                                  />
                                  <WorkOrderDropdown
                                    name={`floor-${item.id}`}
                                    options={FLOOR_DROPDOWN_OPTIONS}
                                    value={item.floor}
                                    onValueChange={(value) =>
                                      handleItemChange(idx, 'floor', value || 'Select')
                                    }
                                    placeholder="Floor"
                                  />
                                  <input
                                    type="text"
                                    className="form-control custom-input"
                                    value={item.roomLabNo}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'roomLabNo', e.target.value)
                                    }
                                    placeholder="Room No. / Landmark"
                                  />
                                </div>

                                <div className="workorderDescriptionRow">
                                  <input
                                    type="text"
                                    className="form-control custom-input workorderDescriptionInput"
                                    value={item.description}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'description', e.target.value)
                                    }
                                    placeholder="Description"
                                  />
                                  <span className="workorderTargetDateLabel">Target Date</span>
                                  <input
                                    type="date"
                                    className="form-control custom-input workorderTargetDateInput"
                                    value={item.targetDate}
                                    onChange={(e) =>
                                      handleItemChange(idx, 'targetDate', e.target.value)
                                    }
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
                                    <span>{firstLocationPhoto.file.name}</span>
                                    {item.locationPhotos.length > 1 && (
                                      <small>+{item.locationPhotos.length - 1}</small>
                                    )}
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
                                  </div>
                                ) : (
                                  <label
                                    className="workorderChooseFileBtn"
                                    htmlFor={locationPhotoInputId}
                                    title="Upload photo"
                                    aria-label="Upload photo"
                                  >
                                    <Upload size={18} />
                                    <span>Choose File</span>
                                  </label>
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
          <div className="workorderFooter">
            <button type="submit" className="workorderBtnSubmit btn-submit-approval custom-btn">
              Submit Form
            </button>
          </div>
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
