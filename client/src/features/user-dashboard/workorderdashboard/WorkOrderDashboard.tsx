import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Search,
  ClipboardList,
  UserCheck,
  Hourglass,
  CheckSquare,
  FolderClosed,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import './WorkOrderDashboard.css';
import CustomModal from '../../../shared/components/ui/CustomModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { useAbility } from '../../../shared/casl/AbilityContext';

type WorkOrderPriority = 'High' | 'Medium' | 'Low' | 'Routine';
type WorkOrderStatus = 'Pending' | 'Completed' | 'Procurement' | 'On Hold' | 'Assigned';



interface StoredWorkOrderItem {
  id: string | number;
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
  locationPhotos: string[];
  assignedTo?: string;
  assignedToRole?: string;
  status?: string;
}

interface StoredWorkOrderSubmission {
  id: string | number;
  wo_number?: string;
  applicantName: string;
  date: string;
  department: string;
  designation: string;
  email: string;
  mobile: string;
  category: string;
  status: WorkOrderStatus;
  overall_status?: string;
  workflow_status?: string;
  workflow_state?: {
    status?: string;
    currentStage?: string | null;
    lastDecision?: string | null;
  } | null;
  submittedAt: string;
  workItems: StoredWorkOrderItem[];
  beneficiary_tag?: string;
  beneficiaryTag?: string;
  budget_tag?: string;
  budgetTag?: string;
}

interface WorkOrderPhoto {
  id: string;
  name: string;
  preview: string;
}

interface WorkOrderItem {
  id: string;
  submissionId: string;
  itemId: string;
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
  approvalStatus: string;
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
  beneficiaryTag?: string;
}
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

const formatShortDate = (value: string | undefined) => {
  if (!value) return '-';
  // LEGACY: date-only strings (YYYY-MM-DD) must be parsed as local calendar dates,
  // not UTC midnight, to avoid off-by-one day errors in timezones east of UTC.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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
const formatLegacyWorkOrderId = (id: string | number, category?: string): string => {
  const rawId = String(id || '');
  if (!rawId) return '';

  // New format (e.g. "26CA0001" or "26MW10001") – pass through unchanged
  if (/^\d{2}[A-Z]{2,3}\d{4}$/.test(rawId)) return rawId;

  // Also pass through old dash format as-is (will be displayed verbatim)
  if (/^\d{2}-[A-Z0-9]{2,3}-\d{4}$/.test(rawId)) {
    // strip dashes for compact display
    return rawId.replace(/-/g, '');
  }

  const code = (category && LEGACY_CATEGORY_CODE_MAP[category]) || 'XX';

  // LEGACY: old #WO-YYYY-XXXX format
  if (rawId.startsWith('#WO-')) {
    const parts = rawId.replace('#WO-', '').split('-');
    const year = parts[0]?.slice(-2) || '00';
    const seq = parts[1] || '0001';
    return `${year}${code}${seq}`;
  }

  // LEGACY: very old timestamp-based WO- format
  if (rawId.startsWith('WO-')) {
    const timestampStr = rawId.replace('WO-', '');
    const timestamp = parseInt(timestampStr, 10);
    if (!isNaN(timestamp)) {
      const date = new Date(timestamp);
      const year = String(date.getFullYear()).slice(-2);
      const fallbackSequence = String(timestamp % 10000).padStart(4, '0');
      return `${year}${code}${fallbackSequence}`;
    }
  }
  return rawId;
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

const normalizeApprovalStatus = (submission: StoredWorkOrderSubmission) => {
  const workflowStatus = String(
    submission.workflow_state?.status || submission.workflow_status || submission.overall_status || submission.status || '',
  )
    .trim()
    .toLowerCase();
  if (workflowStatus === 'completed' || workflowStatus === 'approved') return 'Approved';
  if (workflowStatus === 'rejected') return 'Rejected';
  if (workflowStatus === 'returned') return 'Returned';
  if (workflowStatus === 'archived') return 'Archived';
  return 'Pending';
};


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
        ].map((url: string, index: number) => ({
          id: `${item.id}-${index}`,
          name: `Photo ${index + 1}`,
          preview: url,
        }));
        const normalizedCategory = normalizeCategoryName(submission.category);

        return {
          id: `${submission.id}-${item.id}`,
          submissionId: String(submission.id),
          itemId: String(item.id),
          workOrderId: submission.wo_number || formatLegacyWorkOrderId(submission.id, normalizedCategory),
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
          approvalStatus: normalizeApprovalStatus(submission),
          description: item.description || '',
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
          beneficiaryTag:
            submission.beneficiary_tag ||
            submission.beneficiaryTag ||
            submission.budget_tag ||
            submission.budgetTag ||
            '',
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
// client/src/features/user-dashboard/workorderdashboard/workorderdashboard.tsx
const formatFiscalYearValue = (startYear: number) =>
  `${startYear}-${String(startYear + 1).slice(-2)}`;

const getCurrentFiscalYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return formatFiscalYearValue(month >= 4 ? year : year - 1);
};

const getCurrentFiscalYearStart = () => Number.parseInt(getCurrentFiscalYear().split('-')[0], 10);

const getFiscalYear = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4 ? year : year - 1;
};

const getItemFiscalYear = (item: WorkOrderItem) => {
  const dateStr = item.date || item.submittedAt || new Date().toISOString();
  return formatFiscalYearValue(getFiscalYear(dateStr));
};

const formatFiscalYearLabel = (fiscalYear: string) => `FY ${fiscalYear}`;

const CATEGORIES_TABS = [
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

const WorkOrderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const ability = useAbility();
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('legacy-all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(() =>
    `legacy-${getCurrentFiscalYear()}`,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);


  // Modals state
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedItemForInfo, setSelectedItemForInfo] = useState<WorkOrderItem | null>(null);
  const [reminderDateInput, setReminderDateInput] = useState('');

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedItemForPhotos, setSelectedItemForPhotos] = useState<WorkOrderItem | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const json = (await authenticityUtility.get('/workorders')) as any;
      if (json.success && Array.isArray(json.data)) {
        setWorkOrders(mapSubmissionsToRows(json.data));
      } else {
        setWorkOrders([]);
        setError(json.message || 'Invalid or malformed data received from server.');
      }
    } catch (err) {
      console.error('Failed to fetch work orders:', err);
      setError('Failed to load work orders. Please try again later.');
      setWorkOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);



  const persistWorkOrderItemDashboard = async (
    itemId: string,
    payload: {
      status?: WorkOrderStatus;
      assignedTo?: string;
      assignedToRole?: string;
      reminderDate?: string;
    },
  ) => {
    await authenticityUtility.patch(`/workorders/items/${itemId}/dashboard`, payload);
  };



  const handleSaveReminderDate = async (
    submissionId: string,
    itemId: string,
    reminderDate: string,
  ) => {
    try {
      await persistWorkOrderItemDashboard(itemId, { reminderDate });
      setWorkOrders((prev) =>
        prev.map((item) =>
          item.submissionId === submissionId && item.itemId === itemId
            ? { ...item, reminderDate }
            : item,
        ),
      );
    } catch (err) {
      console.error('Failed to update reminder date:', err);
      throw err;
    }
  };

  const handleOpenInfo = (item: WorkOrderItem) => {
    setSelectedItemForInfo(item);
    setReminderDateInput(item.reminderDate || '');
    setShowInfoModal(true);
  };

  const handleSaveReminder = async () => {
    if (selectedItemForInfo) {
      try {
        await handleSaveReminderDate(selectedItemForInfo.submissionId, selectedItemForInfo.itemId, reminderDateInput);
        setShowInfoModal(false);
      } catch (err) {
        console.error('Failed to update work order reminder date:', err);
      }
    }
  };

  const handleOpenPhotos = (item: WorkOrderItem) => {
    setSelectedItemForPhotos(item);
    setActivePhotoIndex(0);
    setShowPhotoModal(true);
  };


  // Derived options and variables
  const currentFiscalYear = getCurrentFiscalYear();
  const currentFiscalYearStart = getCurrentFiscalYearStart();

  const fiscalYears = useMemo(
    () =>
      Array.from(
        new Set([
          ...workOrders.map((item) => getItemFiscalYear(item)).filter(Boolean),
          currentFiscalYear,
          formatFiscalYearValue(currentFiscalYearStart - 1),
        ]),
      ).sort((a, b) => Number.parseInt(b.split('-')[0], 10) - Number.parseInt(a.split('-')[0], 10)),
    [workOrders, currentFiscalYear, currentFiscalYearStart],
  );

  const fiscalYearOptions = useMemo(
    () => [
      { value: 'legacy-all', label: 'All FY' },
      ...fiscalYears.map((fy) => ({
        value: `legacy-${fy}`,
        label: formatFiscalYearLabel(fy),
      })),
    ],
    [fiscalYears],
  );

  const categoryOptions = useMemo(
    () => [
      { value: 'legacy-all', label: 'All Categories' },
      ...CATEGORIES_TABS.map((cat) => ({
        value: `legacy-${cat}`,
        label: cat,
      })),
    ],
    [],
  );


  // Filters setup: FY & Category filter applied to derive stats counts
  const filteredByFYAndCategory = useMemo(() => {
    return workOrders.filter((item) => {
      const itemFY = getItemFiscalYear(item);
      const strippedFY = selectedFiscalYear.startsWith('legacy-') ? selectedFiscalYear.slice(7) : selectedFiscalYear;
      const strippedCategory = selectedCategory.startsWith('legacy-') ? selectedCategory.slice(7) : selectedCategory;
      const matchesFY = strippedFY === 'all' || itemFY === strippedFY;
      const matchesCategory = strippedCategory === 'all' || item.nature === strippedCategory;
      return matchesFY && matchesCategory;
    });
  }, [workOrders, selectedFiscalYear, selectedCategory]);

  const kpis = useMemo(() => {
    const list = filteredByFYAndCategory;
    return {
      total: list.length,
      pending: list.filter((item) => item.approvalStatus === 'Pending').length,
      returned: list.filter((item) => item.approvalStatus === 'Returned').length,
      rejected: list.filter((item) => item.approvalStatus === 'Rejected').length,
      approved: list.filter((item) => item.approvalStatus === 'Approved').length,
      archived: list.filter((item) => item.approvalStatus === 'Archived').length,
    };
  }, [filteredByFYAndCategory]);

  const formatCount = (count: number) => String(count).padStart(2, '0');

  // Filter based on selected KPI status and SearchTerm
  const filteredWorkOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return filteredByFYAndCategory.filter((item) => {
      const matchesStatus =
        statusFilter === 'all' ||
        item.approvalStatus.toLowerCase().replace(/\s+/g, '-') === statusFilter;

      const searchable = [
        item.nature,
        item.block,
        item.floor,
        item.room,
        item.assignee.name,
        item.assignee.role,
        item.workType,
        item.status,
        item.approvalStatus,
        item.priority,
        item.workOrderId,
        item.subType,
        item.applicant.name,
        item.applicant.department,
      ]
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [filteredByFYAndCategory, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredWorkOrders.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = filteredWorkOrders.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredWorkOrders.length);
  const paginatedWorkOrders = filteredWorkOrders.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleKpiClick = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const statCards = [
    { key: 'all', label: 'Total', count: kpis.total, icon: ClipboardList },
    { key: 'pending', label: 'Pending', count: kpis.pending, icon: Hourglass },
    { key: 'returned', label: 'Return', count: kpis.returned, icon: UserCheck },
    { key: 'rejected', label: 'Reject', count: kpis.rejected, icon: XCircle },
    { key: 'approved', label: 'Approve', count: kpis.approved, icon: CheckSquare },
    { key: 'archived', label: 'Archive', count: kpis.archived, icon: FolderClosed },
  ] as const;

  return (
    <section className="workorderdashboard-page">
      <div className="workorderdashboard-container">
        <div className="workorderdashboard-card">
          {/* HEADER & FILTERS */}
          <div className="workorderdashboard-header-single">
            <div className="header-left-section">
              <h5 className="workorderdashboard-title">Work Orders</h5>
            </div>

            <div className="header-right-section">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search work orders..."
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="clear-icon-btn"
                    onClick={() => setSearchTerm('')}
                    aria-label="Clear search"
                  >
                    <XCircle size={16} className="clear-icon" />
                  </button>
                )}
              </div>

              <div className="filter-group">
                <div className="filter-item">
                  <select
                    className="workorderdashboard-financial-year"
                    value={selectedFiscalYear}
                    onChange={(event) => {
                      setSelectedFiscalYear(event.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Select financial year"
                  >
                    {fiscalYearOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-item">
                  <select
                    className="workorderdashboard-beneficiary-filter"
                    value={selectedCategory}
                    onChange={(event) => {
                      setSelectedCategory(event.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Select category"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="workorderdashboard-actions">
                {ability.can('create', 'WorkOrder') && (
                  <button
                    type="button"
                    className="workorderdashboard-add-btn"
                    onClick={() => navigate('/workorder/new')}
                  >
                    Add +
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* STATS BAR */}
          <div className="workorderdashboard-stats-row-inside">
            {statCards.map(({ key, label, count, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`stats-card ${statusFilter === key ? 'active' : ''}`}
                onClick={() => handleKpiClick(key)}
              >
                <div className="stats-icon-box">
                  <Icon size={20} />
                </div>
                <div className="stats-content">
                  <span className="stats-name">{label}</span>
                  <span className="stats-count">{formatCount(count)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* CONTENT */}
          <div className="workorderdashboard-body">
            {isLoading ? (
              <div className="workorderdashboard-state" style={{ padding: '60px 20px', fontSize: '15px' }}>
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : error ? (
              <div className="workorderdashboard-state text-danger d-flex flex-column align-items-center" style={{ padding: '60px 20px', fontSize: '15px' }}>
                <div style={{ marginBottom: '15px' }}>{error}</div>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={fetchWorkOrders}>
                  Retry
                </button>
              </div>
            ) : filteredWorkOrders.length === 0 ? (
              <div className="workorderdashboard-state" style={{ padding: '60px 20px', fontSize: '15px' }}>
                No work items found
              </div>
            ) : (
              <div className="workorderdashboard-list-container">
                {paginatedWorkOrders.map((item) => {
                  return (
                    <div
                      key={item.id}
                      className="workorderdashboard-item-card"
                    >
                      <div className="card-row-top">
                        <div className="card-header-left">
                          <span 
                            className="card-id-pill"
                          >
                            #{item.workOrderId}
                          </span>
                          <span 
                            className="card-applicant-name"
                          >
                            {item.applicant.name}
                          </span>
                          <span className="card-category-tag">{item.nature}</span>
                        </div>

                        <div className="card-header-right">
                          <div className="card-amount-box">
                            <span className="amount-label">Target Date</span>
                            <span className="amount-value">
                              {formatShortDate(item.targetDate)}
                            </span>
                          </div>
                          <div className="card-actions-main">
                            {item.photos.length > 0 && (
                              <button
                                type="button"
                                className="icon-btn-subtle"
                                title="View photos"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenPhotos(item);
                                }}
                              >
                                <ImageIcon size={18} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="icon-btn-subtle"
                              title="View work order info"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenInfo(item);
                              }}
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="card-row-bottom">
                        <div className="card-row-middle">
                          <span className="beneficiary-label">Beneficiary :</span>
                          <span className="beneficiary-value">
                            {item.applicant.department || 'N/A'}
                          </span>
                        </div>
                        <span
                          className={`card-approval-status card-approval-status--${item.approvalStatus.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {item.approvalStatus}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredWorkOrders.length > 0 && (
              <div className="workorderdashboard-pagination">
                <div className="workorderdashboard-pagination-left">
                  <label className="workorderdashboard-pagination-label" htmlFor="workorderdashboard-page-size">
                    Rows per page
                  </label>
                  <select
                    id="workorderdashboard-page-size"
                    className="workorderdashboard-page-size"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="workorderdashboard-pagination-count">
                    {pageStartIndex + 1}-{pageEndIndex} of {filteredWorkOrders.length}
                  </span>
                </div>

                <div className="workorderdashboard-pagination-right">
                  <button
                    type="button"
                    className="workorderdashboard-page-btn"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </button>
                  <span className="workorderdashboard-page-indicator">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="workorderdashboard-page-btn"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
{ability.can('edit', 'WorkOrder') && (
            <button
              type="button"
              className="wo-info-btn-save"
              onClick={handleSaveReminder}
            >
              Save changes
            </button>
            )}
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
              {(() => {
                const safeIndex = Math.min(
                  Math.max(0, activePhotoIndex),
                  selectedItemForPhotos.photos.length - 1,
                );
                const currentPhoto = selectedItemForPhotos.photos[safeIndex];
                return (
                  <>
                    <img
                      src={currentPhoto.preview}
                      alt={currentPhoto.name}
                      className="img-fluid main-photo"
                    />
                  </>
                );
              })()}
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
              {selectedItemForPhotos.photos[Math.min(Math.max(0, activePhotoIndex), selectedItemForPhotos.photos.length - 1)].name} ({Math.min(Math.max(0, activePhotoIndex), selectedItemForPhotos.photos.length - 1) + 1} of {selectedItemForPhotos.photos.length})
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
