import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Plus,
  Search,
  Info,
  Check,
  Bell,
  BatteryCharging,
  ClipboardList,
  Droplets,
  Factory,
  UserCheck,
  Hammer,
  Hourglass,
  CheckSquare,
  Leaf,
  LayoutGrid,
  Paintbrush,
  ShoppingCart,
  FolderClosed,
  Snowflake,
  Users,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import './workorderdashboard.css';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomModal from '../../../shared/components/ui/CustomModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';

type WorkOrderPriority = 'High' | 'Medium' | 'Low' | 'Routine';
type WorkOrderStatus = 'Pending' | 'Completed' | 'Procurement' | 'On Hold' | 'Assigned';



interface StoredWorkOrderPhoto {
  id: string;
  name: string;
  preview: string;
}

interface StoredWorkOrderItem {
  id: string;
  type: string;
  subType: string;
  block: string;
  floor: string;
  roomLabNo: string;
  description: string;
  targetDate?: string;
  reminderDate?: string;
  qty: number;
  priority: string;
  locationPhotos: StoredWorkOrderPhoto[];
  descriptionPhotos: StoredWorkOrderPhoto[];
  assignedTo?: string;
  assignedToRole?: string;
  status?: string;
}

interface StoredWorkOrderSubmission {
  id: string;
  applicantName: string;
  date: string;
  department: string;
  designation: string;
  email: string;
  mobile: string;
  category: string;
  status: WorkOrderStatus;
  submittedAt: string;
  workItems: StoredWorkOrderItem[];
}

interface WorkOrderPhoto {
  id: string;
  name: string;
  preview: string;
}

interface WorkOrderItem {
  id: string;
  submissionId: string;
  workOrderId: string;
  date: string;
  nature: string;
  subType: string;
  workType: string;
  block: string;
  floor: string;
  room: string;
  items: number;
  priority: WorkOrderPriority;
  assignee: {
    name: string;
    role: string;
    initials: string;
  };
  status: WorkOrderStatus;
  description: string;
  targetDate?: string;
  reminderDate?: string;
  details: string[];
  photos: WorkOrderPhoto[];
  applicant: {
    name: string;
    department: string;
    designation: string;
    email: string;
    mobile: string;
  };
  submittedAt: string;
}

const statusOptions = ['All', 'Pending', 'Completed', 'Procurement', 'On Hold', 'Assigned'];
const priorityOptions = ['All', 'High', 'Medium', 'Low', 'Routine'];

const formatDisplayDate = (value: string) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatShortDate = (value: string) => {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const getInitials = (name: string) => {
  const clean = String(name || '').trim();
  if (!clean) return 'NA';
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const normalizePriority = (priority: string): WorkOrderPriority => {
  const value = String(priority || '')
    .trim()
    .toLowerCase();
  if (value === 'high') return 'High';
  if (value === 'routine') return 'Routine';
  if (value === 'low') return 'Low';
  return 'Medium';
};



// LEGACY: category code map used only for converting old work order IDs to the new format.
// Remove after all stored submissions use the new YYCODENNNN format (no old IDs remain).
const LEGACY_CATEGORY_CODE_MAP: Record<string, string> = {
  'Electrical': 'EL',
  'IT Infrastructure': 'IT',
  'Plumbing': 'PL',
  'HVAC': 'AC',
  'Carpentry': 'CA',
  'Gardening': 'GA',
  'Civil': 'CI',
  'Metal Works': 'MW1',
  'Interior': 'IN',
  'Labour': 'LA',
  'Painting': 'PA',
  'UPS': 'UP',
};

// LEGACY: format old timestamp-based or #WO-YYYY-XXXX workorder IDs.
// Remove after all stored submissions use the new YYCODENNNN format.
const formatLegacyWorkOrderId = (id: string, category?: string): string => {
  if (!id) return '';

  // New format (e.g. "26CA0001" or "26MW10001") – pass through unchanged
  if (/^\d{2}[A-Z]{2,3}\d{4}$/.test(id)) return id;

  // Also pass through old dash format as-is (will be displayed verbatim)
  if (/^\d{2}-[A-Z0-9]{2,3}-\d{4}$/.test(id)) {
    // strip dashes for compact display
    return id.replace(/-/g, '');
  }

  const code = (category && LEGACY_CATEGORY_CODE_MAP[category]) || 'XX';

  // LEGACY: old #WO-YYYY-XXXX format
  if (id.startsWith('#WO-')) {
    const parts = id.replace('#WO-', '').split('-');
    const year = parts[0]?.slice(-2) || '00';
    const seq = parts[1] || '0001';
    return `${year}${code}${seq}`;
  }

  // LEGACY: very old timestamp-based WO- format
  if (id.startsWith('WO-')) {
    const timestampStr = id.replace('WO-', '');
    const timestamp = parseInt(timestampStr, 10);
    if (!isNaN(timestamp)) {
      const date = new Date(timestamp);
      const year = String(date.getFullYear()).slice(-2);
      const fallbackSequence = String(timestamp % 10000).padStart(4, '0');
      return `${year}${code}${fallbackSequence}`;
    }
  }
  return id;
};

const isReminderStatus = (status: string) => {
  const s = String(status || '').toLowerCase();
  return s === 'reminder' || s === 'remainder' || s === 'on hold';
};

// LEGACY: Normalize old status values ('In Progress', 'Reminder', 'Remainder') to new set.
// Remove after all stored submissions have been re-saved with new status values.
const normalizeStatus = (status: string): WorkOrderStatus => {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'completed') return 'Completed';
  if (s === 'ordered' || s === 'in progress') return 'Procurement';
  if (s === 'on hold' || s === 'reminder' || s === 'remainder') return 'On Hold';
  if (s === 'assigned') return 'Assigned';
  return 'Pending';
};

const toDropdownOptions = (values: string[]): OptionType[] =>
  values.map((value) => ({ value, label: value }));

const getSelectedOption = (value: string, options: OptionType[]): OptionType | null =>
  options.find((option) => option.value === value) || null;

const rowStatusOptions = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Procurement', label: 'Procurement' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Assigned', label: 'Assigned' },
];

// LEGACY: map old category names to new short names.
// Remove after all stored submissions have been re-saved with new category names.
const LEGACY_CATEGORY_NAME_MAP: Record<string, string> = {
  'Electrical / Wiring': 'Electrical',
  'IT / Infrastructure': 'IT Infrastructure',
  'AC / HVAC': 'HVAC',
  'Furniture / Door': 'Carpentry',
  'Furniture': 'Carpentry',
  'CarpentryGardening': 'Carpentry',
  'Fabrication': 'Metal Works',
  'Civil / Flooring': 'Civil',
};

const normalizeCategoryName = (category: string): string =>
  LEGACY_CATEGORY_NAME_MAP[category] || category;

const mapSubmissionsToRows = (submissions: StoredWorkOrderSubmission[]): WorkOrderItem[] => {
  return submissions
    .flatMap((submission) =>
      (Array.isArray(submission.workItems) ? submission.workItems : []).map((item) => {
        const photos = [
          ...(Array.isArray(item.locationPhotos) ? item.locationPhotos : []),
          ...(Array.isArray(item.descriptionPhotos) ? item.descriptionPhotos : []),
        ];
        const normalizedCategory = normalizeCategoryName(submission.category);

        return {
          id: `${submission.id}-${item.id}`,
          submissionId: submission.id,
          workOrderId: formatLegacyWorkOrderId(submission.id, normalizedCategory),
          date: submission.date || submission.submittedAt?.slice(0, 10) || '',
          nature: normalizedCategory || item.type || '-',
          subType: item.subType || '',
          workType: item.type || '-',
          block: item.block || '-',
          floor: item.floor || '-',
          room: item.roomLabNo || '-',
          items: Number(item.qty || 0),
          priority: normalizePriority(item.priority),
          assignee: {
            name: item.assignedTo || '',
            role: item.assignedTo ? (item.assignedToRole || 'Staff') : 'Not Assigned',
            initials: getInitials(item.assignedTo || 'NA'),
          },
          status: normalizeStatus(item.status || submission.status || 'Pending'),
          description: item.description || 'No description provided.',
          targetDate: item.targetDate || '',
          reminderDate: item.reminderDate || '',
          details: [item.type, item.subType].filter(Boolean),
          photos,
          applicant: {
            name: submission.applicantName || '',
            department: submission.department || '',
            designation: submission.designation || '',
            email: submission.email || '',
            mobile: submission.mobile || '',
          },
          submittedAt: submission.submittedAt || '',
        };
      }),
    )
    .sort((a, b) => {
      const aIsReminder = isReminderStatus(a.status);
      const bIsReminder = isReminderStatus(b.status);
      if (aIsReminder && !bIsReminder) return -1;
      if (!aIsReminder && bIsReminder) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
};

const getDateRangeLabel = (items: WorkOrderItem[]) => {
  if (items.length === 0) return 'All Submitted Dates';
  const timestamps = items
    .map((item) => new Date(`${item.date}T00:00:00`).getTime())
    .filter((time) => Number.isFinite(time));
  if (timestamps.length === 0) return 'All Submitted Dates';
  const min = new Date(Math.min(...timestamps)).toISOString().slice(0, 10);
  const max = new Date(Math.max(...timestamps)).toISOString().slice(0, 10);
  return min === max
    ? formatDisplayDate(min)
    : `${formatDisplayDate(min)} - ${formatDisplayDate(max)}`;
};

const WorkOrderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('All');
  const [statusFilter, setStatusFilter] = useState('New');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [employeeOptions, setEmployeeOptions] = useState<OptionType[]>([]);

  // Modals state
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedItemForInfo, setSelectedItemForInfo] = useState<WorkOrderItem | null>(null);
  const [reminderDateInput, setReminderDateInput] = useState('');

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedItemForPhotos, setSelectedItemForPhotos] = useState<WorkOrderItem | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    const fetchWorkOrders = async () => {
      try {
        const json = (await authenticityUtility.get('/workorders')) as any;
        if (json.success && Array.isArray(json.data)) {
          setWorkOrders(mapSubmissionsToRows(json.data));
        } else {
          setWorkOrders([]);
        }
      } catch (err) {
        console.error('Failed to fetch work orders:', err);
        setWorkOrders([]);
      }
    };
    fetchWorkOrders();
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const json = (await authenticityUtility.get('/master-data/employees?limit=1000&status=Active')) as any;
        if (json.success && json.data && Array.isArray(json.data.rows)) {
          const opts = json.data.rows.map((emp: any) => ({
            value: emp.full_name,
            label: emp.full_name,
            role: emp.department_name || emp.designation || 'Staff',
          }));
          setEmployeeOptions(opts);
        }
      } catch (err) {
        console.error('Failed to fetch employees list:', err);
      }
    };
    fetchEmployees();
  }, []);

  const handleStatusChange = (submissionId: string, itemId: string, newStatus: WorkOrderStatus) => {
    setWorkOrders((prev) =>
      prev.map((item) =>
        item.submissionId === submissionId &&
        item.id.split('-').pop() === itemId
          ? { ...item, status: newStatus }
          : item,
      ),
    );
  };

  const handleAssigneeChange = (
    submissionId: string,
    itemId: string,
    assigneeName: string,
    assigneeRole: string,
  ) => {
    setWorkOrders((prev) =>
      prev.map((item) =>
        item.submissionId === submissionId &&
        item.id.split('-').pop() === itemId
          ? {
              ...item,
              assignee: {
                name: assigneeName,
                role: assigneeName ? assigneeRole || 'Staff' : 'Not Assigned',
                initials: getInitials(assigneeName || 'NA'),
              },
            }
          : item,
      ),
    );
  };

  const handleSaveReminderDate = (
    submissionId: string,
    itemId: string,
    reminderDate: string,
  ) => {
    setWorkOrders((prev) =>
      prev.map((item) =>
        item.submissionId === submissionId &&
        item.id.split('-').pop() === itemId
          ? { ...item, reminderDate }
          : item,
      ),
    );
  };

  const handleOpenInfo = (item: WorkOrderItem) => {
    setSelectedItemForInfo(item);
    setReminderDateInput(item.reminderDate || '');
    setShowInfoModal(true);
  };

  const handleSaveReminder = () => {
    if (selectedItemForInfo) {
      const parts = selectedItemForInfo.id.split('-');
      const itemId = parts[parts.length - 1];
      handleSaveReminderDate(selectedItemForInfo.submissionId, itemId, reminderDateInput);
      setShowInfoModal(false);
    }
  };

  const handleOpenPhotos = (item: WorkOrderItem) => {
    setSelectedItemForPhotos(item);
    setActivePhotoIndex(0);
    setShowPhotoModal(true);
  };

  const CATEGORIES_TABS = [
    'All',
    'Electrical',
    'IT Infrastructure',
    'Plumbing',
    'HVAC',
    'Carpentry',
    'Gardening',
    'Civil',
    'Metal Works',
    'Interior',
    'Labour',
    'Painting',
    'UPS',
  ];

  const CATEGORY_TAB_ICON_MAP: Record<string, LucideIcon> = {
    'All': LayoutGrid,
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

  const filteredByCategoryTab = useMemo(() => {
    if (selectedCategoryTab === 'All') return workOrders;
    return workOrders.filter((item) => {
      return item.nature === selectedCategoryTab;
    });
  }, [workOrders, selectedCategoryTab]);

  const kpis = useMemo(() => {
    const list = filteredByCategoryTab;
    return {
      total: list.length,
      assigned: list.filter((item) => item.assignee.name).length,
      pending: list.filter((item) => item.status === 'Pending').length,
      completed: list.filter((item) => item.status === 'Completed').length,
      ordered: list.filter((item) => item.status === 'Procurement').length,
      onHold: list.filter((item) => item.status === 'On Hold').length,
    };
  }, [filteredByCategoryTab]);

  const formatCount = (count: number) => String(count).padStart(2, '0');

  const filteredWorkOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return filteredByCategoryTab.filter((item) => {
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'New' ? !item.assignee.name : item.status === statusFilter);
      const searchable = [
        item.nature,
        item.block,
        item.floor,
        item.room,
        item.assignee.name,
        item.assignee.role,
        item.workType,
        item.status,
        item.priority,
        item.workOrderId,
        item.subType,
        item.description,
      ]
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [filteredByCategoryTab, searchTerm, statusFilter]);

  const paginatedWorkOrders = filteredWorkOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const totalPages = Math.max(1, Math.ceil(filteredWorkOrders.length / pageSize));
  const showingStart = filteredWorkOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, filteredWorkOrders.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleExport = () => {
    const headers = [
      'WO No',
      'Nature of Work',
      'Location',
      'Work Assigned To',
      'Target Date',
      'Status',
    ];
    const rows = filteredWorkOrders.map((item) => [
      item.workOrderId,
      `${item.subType} (${item.workType})`,
      `${item.block}, ${item.floor}, ${item.room}`,
      `${item.assignee.name} (${item.assignee.role})`,
      item.targetDate,
      item.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'work-orders-summary.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleKpiClick = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  return (
    <section className="workorderdashboard-page">
      <div className="workorderdashboard-container">
        <div className="workorderdashboard-card">
          <div className="workorderdashboard-header">
            <h5 className="workorderdashboard-title">Work Summary</h5>

            <div className="workorderdashboard-header-right">
              <label className="workorderdashboard-search-compact">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Search work orders..."
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </label>

              <div className="workorderdashboard-actions">
                <button
                  type="button"
                  className="workorderdashboard-export-btn"
                  onClick={handleExport}
                >
                  <Download size={17} />
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  className="workorderdashboard-add-btn"
                  onClick={() => navigate('/workorder/new')}
                >
                  <Plus size={17} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          <div className="workorderdashboard-card-body">
            {/* Category tabs */}
            <div className="workorderdashboard-category-tabs">
              {CATEGORIES_TABS.map((tab) => {
                const CategoryIcon = CATEGORY_TAB_ICON_MAP[tab];

                return (
                  <button
                    key={tab}
                    type="button"
                    className={`workorderdashboard-category-tab ${selectedCategoryTab === tab ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategoryTab(tab);
                      setStatusFilter('All');
                      setCurrentPage(1);
                    }}
                  >
                    {CategoryIcon && <CategoryIcon size={15} strokeWidth={2.2} />}
                    <span>{tab}</span>
                  </button>
                );
              })}
            </div>

            {/* KPI Summary Cards */}
            <div className="workorderdashboard-kpi-grid">
              <div
                className={`workorderdashboard-kpi-card ${statusFilter === 'All' ? 'selected' : ''}`}
                onClick={() => handleKpiClick('All')}
              >
                <div className="workorderdashboard-kpi-icon-wrap bg-total">
                  <ClipboardList size={22} />
                </div>
                <div className="workorderdashboard-kpi-info">
                  <span className="workorderdashboard-kpi-label">Total Items</span>
                  <span className="workorderdashboard-kpi-value">{formatCount(kpis.total)}</span>
                </div>
              </div>

              <div
                className={`workorderdashboard-kpi-card ${statusFilter === 'New' ? 'selected' : ''}`}
                onClick={() => {
                  setStatusFilter('New');
                  setCurrentPage(1);
                }}
              >
                <div className="workorderdashboard-kpi-icon-wrap bg-assigned">
                  <UserCheck size={22} />
                </div>
                <div className="workorderdashboard-kpi-info">
                  <span className="workorderdashboard-kpi-label">New Items</span>
                  <span className="workorderdashboard-kpi-value">{formatCount(kpis.assigned)}</span>
                </div>
              </div>

              <div
                className={`workorderdashboard-kpi-card ${statusFilter === 'Pending' ? 'selected' : ''}`}
                onClick={() => handleKpiClick('Pending')}
              >
                <div className="workorderdashboard-kpi-icon-wrap bg-pending">
                  <Hourglass size={22} />
                </div>
                <div className="workorderdashboard-kpi-info">
                  <span className="workorderdashboard-kpi-label">Pending</span>
                  <span className="workorderdashboard-kpi-value">{formatCount(kpis.pending)}</span>
                </div>
              </div>

              <div
                className={`workorderdashboard-kpi-card ${statusFilter === 'Completed' ? 'selected' : ''}`}
                onClick={() => handleKpiClick('Completed')}
              >
                <div className="workorderdashboard-kpi-icon-wrap bg-completed">
                  <CheckSquare size={22} />
                </div>
                <div className="workorderdashboard-kpi-info">
                  <span className="workorderdashboard-kpi-label">Completed</span>
                  <span className="workorderdashboard-kpi-value">{formatCount(kpis.completed)}</span>
                </div>
              </div>

              <div
                className={`workorderdashboard-kpi-card ${statusFilter === 'Procurement' ? 'selected' : ''}`}
                onClick={() => handleKpiClick('Procurement')}
              >
                <div className="workorderdashboard-kpi-icon-wrap bg-in-progress">
                  <ShoppingCart size={22} />
                </div>
                <div className="workorderdashboard-kpi-info">
                  <span className="workorderdashboard-kpi-label">Procurement</span>
                  <span className="workorderdashboard-kpi-value">{formatCount(kpis.ordered)}</span>
                </div>
              </div>

              <div
                className={`workorderdashboard-kpi-card ${statusFilter === 'On Hold' ? 'selected' : ''}`}
                onClick={() => handleKpiClick('On Hold')}
              >
                <div className="workorderdashboard-kpi-icon-wrap bg-reminder">
                  <FolderClosed size={22} />
                </div>
                <div className="workorderdashboard-kpi-info">
                  <span className="workorderdashboard-kpi-label">On Hold</span>
                  <span className="workorderdashboard-kpi-value">{formatCount(kpis.onHold)}</span>
                </div>
              </div>
            </div>

            {/* Redesigned Table Wrapper */}
            <div className="workorderdashboard-table-wrap">
              <table className="workorderdashboard-table">
                <thead>
                  <tr>
                    <th>WO No.</th>
                    <th>Nature of Work</th>
                    <th>Location</th>
                    <th>Details</th>
                    <th>Assigned to</th>
                    <th>Target</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedWorkOrders.map((item) => {
                    return (
                      <tr key={item.id} className="workorderdashboard-row">
                        <td>
                          <span className="workorder-id-column">
                            {item.workOrderId}
                          </span>
                        </td>
                        <td>
                          <div className="workorderdashboard-nature-cell">
                            <strong>{item.subType || '-'}</strong>
                            <span className="workorderdashboard-subtype-span">
                              {item.workType}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="workorderdashboard-location-cell">
                            <strong>{item.block}</strong>
                            <span>
                              {item.floor}, {item.room}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="workorder-details-actions">
                            <button
                              type="button"
                              className="detail-icon-btn eye-btn"
                              onClick={() => handleOpenPhotos(item)}
                              title="View Photos"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              type="button"
                              className="detail-icon-btn info-btn"
                              onClick={() => handleOpenInfo(item)}
                              title="View Work Order Info"
                            >
                              <Info size={18} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <CustomDropdown
                            name={`assignee-${item.id}`}
                            options={employeeOptions}
                            value={item.assignee.name ? { value: item.assignee.name, label: item.assignee.name } : null}
                            onChange={(option) => {
                              const selected = option as OptionType | null;
                              handleAssigneeChange(
                                item.submissionId,
                                item.id.split('-')[item.id.split('-').length - 1],
                                selected?.value ? String(selected.value) : '',
                                selected?.role ? String(selected.role) : '',
                              );
                            }}
                            placeholder="Assign Employee"
                            className="workorderdashboard-table-assignee-dropdown"
                            components={{ IndicatorSeparator: () => null }}
                            styles={{
                              placeholder: (base) => ({
                                ...base,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontSize: '12px',
                                color: '#6b7280',
                              }),
                            }}
                          />
                        </td>
                        <td>
                          <span className="workorder-target-date">
                            {formatShortDate(item.targetDate)}
                          </span>
                        </td>
                        <td>
                          <div className="workorderdashboard-status-cell-wrap">
                            <CustomDropdown
                              name={`status-${item.id}`}
                              options={rowStatusOptions}
                              value={getSelectedOption(item.status, rowStatusOptions)}
                              onChange={(option) => {
                                const itemIdParts = item.id.split('-');
                                const rawItemId = itemIdParts[itemIdParts.length - 1];
                                handleStatusChange(
                                  item.submissionId,
                                  rawItemId,
                                  (option as OptionType)?.value as WorkOrderStatus,
                                );
                              }}
                              className={`workorderdashboard-table-status-dropdown workorderdashboard-status-select--${item.status
                                .toLowerCase()
                                .replace(/\s+/g, '-')}`}
                            />
                            
                            <button
                              type="button"
                              className="status-quick-action status-quick-action-complete"
                              onClick={() => {
                                const itemIdParts = item.id.split('-');
                                const rawItemId = itemIdParts[itemIdParts.length - 1];
                                handleStatusChange(item.submissionId, rawItemId, 'Completed');
                              }}
                              title="Mark as Completed"
                              disabled={item.status === 'Completed'}
                            >
                              <Check size={16} />
                            </button>

                            <button
                              type="button"
                              className="status-quick-action status-quick-action-reminder"
                              onClick={() => {
                                const itemIdParts = item.id.split('-');
                                const rawItemId = itemIdParts[itemIdParts.length - 1];
                                handleStatusChange(item.submissionId, rawItemId, 'On Hold');
                              }}
                              title="Mark as On Hold"
                              disabled={item.status === 'On Hold'}
                            >
                              <Bell size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedWorkOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="workorderdashboard-empty">
                        No work items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="workorderdashboard-footer">
              <div>
                Showing {showingStart} to {showingEnd} of {filteredWorkOrders.length} entries
              </div>
              <div className="workorderdashboard-pagination">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={page === currentPage ? 'active' : ''}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Details Modal */}
      <CustomModal
        show={showInfoModal}
        onHide={() => setShowInfoModal(false)}
        title={selectedItemForInfo ? `Work order info — ${selectedItemForInfo.workOrderId}` : 'Work Order Info'}
        size="lg"
        footer={
          <div className="wo-info-modal-footer">
            <button
              type="button"
              className="wo-info-btn-close"
              onClick={() => setShowInfoModal(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="wo-info-btn-save"
              onClick={handleSaveReminder}
            >
              Save changes
            </button>
          </div>
        }
      >
        {selectedItemForInfo && (
          <div className="wo-info-modal-body">

            {/* Applicant Details Section */}
            <div className="wo-info-section">
              <div className="wo-info-section-heading">
                <span className="wo-info-section-icon" />
                <span>Applicant Details</span>
              </div>
              <div className="wo-info-applicant-card">
                <div className="wo-info-field">
                  <span className="wo-info-field-label">Name</span>
                  <span className="wo-info-field-value">{selectedItemForInfo.applicant.name || 'N/A'}</span>
                </div>
                <div className="wo-info-field">
                  <span className="wo-info-field-label">Designation</span>
                  <span className="wo-info-field-value">{selectedItemForInfo.applicant.designation || 'N/A'}</span>
                </div>
                <div className="wo-info-field">
                  <span className="wo-info-field-label">Department</span>
                  <span className="wo-info-field-value">{selectedItemForInfo.applicant.department || 'N/A'}</span>
                </div>
                <div className="wo-info-field">
                  <span className="wo-info-field-label">Email</span>
                  <span className="wo-info-field-value wo-info-field-value--email">{selectedItemForInfo.applicant.email || 'N/A'}</span>
                </div>
                <div className="wo-info-field">
                  <span className="wo-info-field-label">Mobile</span>
                  <span className="wo-info-field-value">{selectedItemForInfo.applicant.mobile || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Submitted Date + Reminder Date — side by side */}
            <div className="wo-info-dates-row">
              <div className="wo-info-date-card wo-info-date-card--submitted">
                <span className="wo-info-date-icon" />
                <span className="wo-info-date-label">Submitted Date</span>
                <span className="wo-info-date-value">
                  {selectedItemForInfo.submittedAt
                    ? new Date(selectedItemForInfo.submittedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : formatDisplayDate(selectedItemForInfo.date)}
                </span>
              </div>
              <div className={`wo-info-date-card wo-info-date-card--reminder ${reminderDateInput ? 'has-date' : 'no-date'}`}>
                <span className="wo-info-date-icon" />
                <span className="wo-info-date-label">Reminder Date</span>
                <input
                  type="date"
                  className="wo-info-reminder-input"
                  value={reminderDateInput}
                  onChange={(e) => setReminderDateInput(e.target.value)}
                  placeholder="Not set"
                />
                {!reminderDateInput && (
                  <span className="wo-info-reminder-placeholder">Not set</span>
                )}
              </div>
            </div>

            {/* Description Section */}
            <div className="wo-info-section">
              <div className="wo-info-section-heading">
                <span className="wo-info-section-icon" />
                <span>Description</span>
              </div>
              <div className="wo-info-description-card">
                {selectedItemForInfo.description || 'No description provided.'}
              </div>
            </div>

          </div>
        )}
      </CustomModal>

      {/* Photo Viewer Modal */}
      <CustomModal
        show={showPhotoModal}
        onHide={() => setShowPhotoModal(false)}
        title={selectedItemForPhotos ? `Photos - ${selectedItemForPhotos.workOrderId}` : 'Photo Viewer'}
        size="lg"
      >
        {selectedItemForPhotos && selectedItemForPhotos.photos.length > 0 ? (
          <div className="photo-viewer-container">
            <div className="main-photo-display">
              {selectedItemForPhotos.photos.length > 1 && (
                <button
                  type="button"
                  className="photo-nav-btn prev"
                  onClick={() =>
                    setActivePhotoIndex(
                      (prev) =>
                        (prev - 1 + selectedItemForPhotos.photos.length) %
                        selectedItemForPhotos.photos.length,
                    )
                  }
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              <img
                src={selectedItemForPhotos.photos[activePhotoIndex].preview}
                alt={selectedItemForPhotos.photos[activePhotoIndex].name}
                className="img-fluid main-photo"
              />
              {selectedItemForPhotos.photos.length > 1 && (
                <button
                  type="button"
                  className="photo-nav-btn next"
                  onClick={() =>
                    setActivePhotoIndex(
                      (prev) => (prev + 1) % selectedItemForPhotos.photos.length,
                    )
                  }
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
            <div className="photo-caption">
              {selectedItemForPhotos.photos[activePhotoIndex].name} ({activePhotoIndex + 1} of {selectedItemForPhotos.photos.length})
            </div>
            {selectedItemForPhotos.photos.length > 1 && (
              <div className="photo-thumbnails">
                {selectedItemForPhotos.photos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    type="button"
                    className={`thumbnail-btn ${idx === activePhotoIndex ? 'active' : ''}`}
                    onClick={() => setActivePhotoIndex(idx)}
                  >
                    <img src={photo.preview} alt={photo.name} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-5 text-muted">
            <Eye size={40} className="mb-3 opacity-50" />
            <p className="mb-0">No photos uploaded for this work item.</p>
          </div>
        )}
      </CustomModal>
    </section>
  );
};

export default WorkOrderDashboard;
