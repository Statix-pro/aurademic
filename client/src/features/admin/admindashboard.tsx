import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';

import authenticityUtility from '../../shared/utils/authenticityUtility';

import { Pencil, Trash2, Eye, Check, X, Settings, History } from 'lucide-react';
import { Modal, Button } from 'react-bootstrap';

import './admindashboard.css';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useLocation, useNavigate } from 'react-router-dom';

import JournalStatusDetails from './components/JournalStatusDetails';
import JournalStatusUpdates from './components/JournalStatusUpdates';
import JournalManagement from './formManagement/JournalFormOptions';
import ProjectFormOptions from './formManagement/ProjectFormOptions';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';

interface ColumnConfigItem {
  show: boolean;
  order: number;
  label: string;
  group: string;
  hideFromConfig?: boolean;
}

interface ColumnConfig {
  projects: Record<string, ColumnConfigItem>;
  journals: Record<string, ColumnConfigItem>;
}

/** Rupee amounts, shared by the project table and the detail panel. */
const formatCurrency = (amount: string | number): string => {
  const cleanAmount = typeof amount === 'string' ? amount.replace(/,/g, '') : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(cleanAmount) || 0);
};

/** Labels for the stored proposal- and project-status values. */
const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  accepted_for_evaluation: 'Accepted for Evaluation',
  shortlisted: 'Shortlisted',
  shortlisted_for_presentation: 'Shortlisted for Presentation',
  result_announced: 'Result Announced',
  ongoing: 'Ongoing',
  completed: 'Completed',
  closed: 'Closed',
};

/** A financial-contribution or finance-sharing row as the API returns it. */
interface FinanceRowView {
  organization_label?: string;
  amount?: string | number;
  heads?: { budget_head_name?: string | null }[];
}

interface Project {
  id: number;
  title: string;
  driven_by?: string;
  agency?: string;
  scheme?: string;
  proposal_status?: string;
  project_status?: string | null;
  submitted_on?: string;
  edit_request_status?: string;
  edit_request_user_id?: number;
  collaborators_enabled?: boolean | number;
  [key: string]: unknown;
}

interface Journal {
  id: number;
  title: string;
  journal_name?: string;
  publication_status?: string;
  admin_approval_comment?: string | null;
  created_at?: string;
  submission_date?: string;
  author_names?: string[];
  index_names?: string[];
  edit_request_status?: string;
  edit_request_user_id?: number;
  status?: string;
  [key: string]: unknown;
}

interface JournalRequest {
  id: number;
  journal_name: string;
  category?: string;
  publisher?: string;
  website?: string;
  print_issn?: string;
  online_issn?: string;
  impact_factor?: number | null;
  cite_score?: number | null;
  user_name: string;
  status: string;
  created_at: string;
}

interface ProjectRequest {
  id: number;
  user_name?: string;
  /** 'organization' (a funding agency) or 'scheme'. */
  request_type: string;
  name: string;
  parent_organization_name?: string | null;
  organization_name?: string | null;
  domain?: string | null;
  category?: string | null;
  website?: string | null;
  description?: string;
  status: string;
  created_at: string;
  admin_comment?: string;
}

interface VisibleColumn {
  key: string;
  show: boolean;
  order: number;
  label: string;
  group: string;
}

interface EditRequestActionsProps {
  status: string;
  onUpdateStatus: (newStatus: string) => void;
  itemId: number;
}

type TabType =
  | 'projects'
  | 'journals'
  | 'journal-requests'
  | 'project-requests'
  | 'journal-status-updates'
  | 'journal-management'
  | 'project-management';

const defaultColumnConfig: ColumnConfig = {
  projects: {
    title: { show: true, order: 0, label: 'Title', group: 'Essential' },
    driven_by: { show: true, order: 1, label: 'Driven By', group: 'Essential' },
    agency: { show: true, order: 2, label: 'Funding Agency', group: 'Essential' },
    scheme: { show: true, order: 3, label: 'Scheme', group: 'Essential' },
    proposal_status: {
      show: true,
      order: 98,
      label: 'Status',
      group: 'Essential',
      hideFromConfig: true,
    },
    submitted_on: { show: false, order: 5, label: 'Submission Date', group: 'Details' },
    project_status: { show: false, order: 6, label: 'Project Status', group: 'Details' },
    project_duration: { show: false, order: 7, label: 'Duration', group: 'Details' },
    project_cost: { show: false, order: 8, label: 'Project Cost (₹)', group: 'Financial' },
    disbursed_amount: {
      show: false,
      order: 9,
      label: 'Disbursed Amount (₹)',
      group: 'Financial',
    },
    sanction_reference_no: {
      show: false,
      order: 10,
      label: 'Sanction Ref. No.',
      group: 'Financial',
    },
    project_start_date: { show: false, order: 11, label: 'Start Date', group: 'Timeline' },
    project_closing_date: { show: false, order: 12, label: 'Closing Date', group: 'Timeline' },
    investigators: { show: false, order: 13, label: 'Investigators', group: 'Team' },
    collaborators_enabled: {
      show: false,
      order: 14,
      label: 'Has Collaborators',
      group: 'Team',
    },
    edit_request_status: { show: true, order: 18, label: 'Edit Request', group: 'Essential' },
    actions: { show: true, order: 99, label: 'Actions', group: 'Essential', hideFromConfig: true },
  },
  journals: {
    title: { show: true, order: 0, label: 'Title', group: 'Essential' },
    journal_name: { show: true, order: 1, label: 'Journal Name', group: 'Essential' },
    management_workflow: {
      show: true,
      order: 98,
      label: 'Workflow',
      group: 'Essential',
      hideFromConfig: true,
    },
    submission_date: { show: false, order: 4, label: 'Submission Date', group: 'Details' },
    author_names: { show: true, order: 5, label: 'Authors', group: 'Details' },
    volume: { show: false, order: 6, label: 'Volume', group: 'Details' },
    issue: { show: false, order: 7, label: 'Issue', group: 'Details' },
    page_numbers: { show: false, order: 8, label: 'Page Numbers', group: 'Details' },
    doi: { show: false, order: 9, label: 'DOI', group: 'Details' },
    publication_date: { show: false, order: 10, label: 'Publication Date', group: 'Timeline' },
    publisher: { show: false, order: 11, label: 'Publisher', group: 'Details' },
    index_names: { show: true, order: 12, label: 'Indexing', group: 'Metrics' },
  },
};

interface JournalWorkflowCellProps {
  item: Journal;
  onViewDetails: (id: number) => void;
  onDelete: (id: number) => void;
  onSubmissionApproval: (id: number, status: 'approved' | 'rejected') => void;
  onEditRequestStatus: (id: number, status: string) => void;
  onViewStatusUpdates: (id: number) => void;
}

const JournalWorkflowCell: React.FC<JournalWorkflowCellProps> = ({
  item,
  onViewDetails,
  onDelete,
  onSubmissionApproval,
  onEditRequestStatus,
  onViewStatusUpdates,
}) => {
  const getBadgeDetails = () => {
    const normalizeStatusToken = (value: unknown) =>
      String(value || '')
        .trim()
        .toLowerCase();

    let variant = 'secondary';
    const statusVal = String(item.status || '');
    const pubStatusVal = String((item.publication_status as string) || '');
    let label = statusVal || pubStatusVal || 'Unknown';
    let subText: React.ReactNode = null;
    let dateText: string = '';
    const pendingActions: string[] = [];
    const adminApprovalStatus = normalizeStatusToken(item.admin_approval_status);
    const editRequestStatus = normalizeStatusToken(item.edit_request_status);

    const dateVal = (item.created_at as string) || (item.submission_date as string);
    const dateFormatted = dateVal ? new Date(dateVal).toLocaleDateString() : '';

    const isSubmissionPending = !adminApprovalStatus || adminApprovalStatus === 'pending';
    const isSubmissionRejected = adminApprovalStatus === 'rejected';
    const isSubmissionApproved = adminApprovalStatus === 'approved';
    const rejectedAtRaw = String((item.admin_rejected_at as string) || '').trim();
    const updatedAtRaw = String((item.updated_at as string) || '').trim();
    const rejectedAtMs = rejectedAtRaw ? new Date(rejectedAtRaw).getTime() : 0;
    const updatedAtMs = updatedAtRaw ? new Date(updatedAtRaw).getTime() : 0;
    const isResubmittedAfterRejection = Boolean(
      rejectedAtMs &&
      updatedAtMs &&
      !Number.isNaN(rejectedAtMs) &&
      !Number.isNaN(updatedAtMs) &&
      updatedAtMs > rejectedAtMs,
    );
    const effectivePendingState =
      isSubmissionPending || (isSubmissionRejected && isResubmittedAfterRejection);

    if (effectivePendingState) pendingActions.push('submission');
    if (editRequestStatus === 'pending') pendingActions.push('edit');

    // 1. Rejected state takes precedence
    if (isSubmissionRejected && !isResubmittedAfterRejection) {
      variant = 'danger';
      label = 'Rejected';
      const reason = String(item.admin_approval_comment || '').trim();
      subText = reason ? (
        <span
          className="text-danger"
          style={{
            fontSize: '0.75rem',
            maxWidth: '150px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'inline-block',
          }}
        >
          REASON: {reason}
        </span>
      ) : null;
    }
    // 2. Pending Actions take precedence over approved/published statuses
    else if (effectivePendingState) {
      variant = 'warning';
      label = 'Pending Approval';
      if (pendingActions.length > 1) {
        subText = (
          <span className="text-danger fw-bold" style={{ fontSize: '0.75rem' }}>
            MULTIPLE ACTIONS REQ.
          </span>
        );
      } else if (isResubmittedAfterRejection) {
        subText = <span className="workflow-subtext-resubmitted">Resubmitted</span>;
      } else {
        subText = (
          <span className="text-danger fw-bold" style={{ fontSize: '0.75rem' }}>
            REQ. APPROVAL
          </span>
        );
      }
    } else if (editRequestStatus === 'pending') {
      variant = 'warning';
      label = 'Edit Requested';
      subText = (
        <span className="text-danger fw-bold" style={{ fontSize: '0.75rem' }}>
          REQ. REVIEW
        </span>
      );
    }
    // 3. Approved state, check publication lifecycle pipeline
    else if (isSubmissionApproved) {
      // The API returns 'status' from journals (j.status), but to be safe we check 'publication_status' too
      const pubStatus = normalizeStatusToken(pubStatusVal || statusVal);

      if (pubStatus === 'published' || pubStatus === 'accepted') {
        variant = 'success';
        label = pubStatus.charAt(0).toUpperCase() + pubStatus.slice(1);
        subText = (
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Processed
          </span>
        );
        dateText = dateFormatted;
      } else if (
        pubStatus === 'under review' ||
        pubStatus === 'peer_review' ||
        pubStatus === 'peer review'
      ) {
        variant = 'warning';
        label = 'Peer Review';
        subText = (
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            In Progress
          </span>
        );
        dateText = dateFormatted;
      } else if (pubStatus === 'archived') {
        variant = 'primary';
        label = 'Archived';
        subText = (
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Legacy Status
          </span>
        );
        dateText = dateFormatted;
      } else if (pubStatus === 'rejected') {
        variant = 'danger';
        label = 'Rejected';
        dateText = dateFormatted;
      } else if (pubStatus === 'waiting' || pubStatus === '') {
        // Submission was approved by Admin, but hasn't entered 'Published/Peer Review' yet
        variant = 'info';
        label = 'Approved';
        subText = (
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Awaiting Publication
          </span>
        );
        dateText = dateFormatted;
      } else {
        variant = 'secondary';
        label = pubStatus ? pubStatus.charAt(0).toUpperCase() + pubStatus.slice(1) : 'Unknown';
        dateText = dateFormatted;
      }
    } else {
      // Catch-all for any other unhandled states
      variant = 'secondary';
      label = statusVal || pubStatusVal || 'Unknown';
      dateText = dateFormatted;
    }

    return { variant, label, subText, dateText, pendingActions, isResubmittedAfterRejection };
  };

  const { variant, label, subText, dateText, pendingActions, isResubmittedAfterRejection } =
    getBadgeDetails();
  const hasSubmissionAction = pendingActions.includes('submission');
  const showStatusSummary = !hasSubmissionAction;

  return (
    <div
      className="workflow-cell d-flex justify-content-between align-items-center w-100"
      style={{ minWidth: '220px' }}
    >
      <div
        className="workflow-status-block d-flex flex-column align-items-start h-100 justify-content-center"
        style={{ minWidth: '150px' }}
      >
        {showStatusSummary && (
          <>
            <span
              className={`workflow-badge fw-medium px-2 py-1 rounded-pill d-inline-flex align-items-center workflow-badge-${variant}`}
            >
              <span
                className={`workflow-badge-dot rounded-circle me-1 bg-${variant}`}
                style={{ width: '8px', height: '8px' }}
              ></span>
              <span style={{ fontSize: '0.8rem' }}>{label}</span>
            </span>
            {subText && <div className="workflow-subtext mt-1 lh-1">{subText}</div>}
          </>
        )}
        {(pendingActions.includes('submission') || pendingActions.includes('edit')) && (
          <div className="workflow-inline-actions mt-2">
            {pendingActions.includes('submission') && (
              <div className="workflow-action-card workflow-action-card--submission">
                <span className="workflow-action-title">
                  {isResubmittedAfterRejection ? 'Resubmitted' : 'Submitted'}
                </span>
                <div className="workflow-action-buttons">
                  <button
                    type="button"
                    className="workflow-action-btn workflow-action-btn--approve"
                    onClick={() => onSubmissionApproval(item.id, 'approved')}
                    title="Approve Submission"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="workflow-action-btn workflow-action-btn--reject"
                    onClick={() => onSubmissionApproval(item.id, 'rejected')}
                    title="Reject Submission"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
            {pendingActions.includes('edit') && (
              <div className="workflow-action-card workflow-action-card--edit">
                <span className="workflow-action-title">Edit Req</span>
                <div className="workflow-action-buttons">
                  <button
                    type="button"
                    className="workflow-action-btn workflow-action-btn--approve"
                    onClick={() => onEditRequestStatus(item.id, 'approved')}
                    title="Approve Edit Request"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="workflow-action-btn workflow-action-btn--reject"
                    onClick={() => onEditRequestStatus(item.id, 'rejected')}
                    title="Reject Edit Request"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="workflow-right-side d-flex flex-column align-items-end gap-1">
        <div className="workflow-actions d-flex align-items-center gap-1">
          <div className="d-flex align-items-center ml-auto">
            <button
              type="button"
              className="btn btn-sm btn-light border-0 text-secondary bg-transparent p-1"
              onClick={() => onViewDetails(item.id)}
              title="View Publication Details"
            >
              <Eye size={16} />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-light border-0 text-secondary bg-transparent p-1"
              onClick={() => onViewStatusUpdates(item.id)}
              title="View Status Updates"
            >
              <History size={16} />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-light border-0 text-secondary bg-transparent p-1"
              title="Edit"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-light border-0 text-danger bg-transparent p-1"
              onClick={() => onDelete(item.id)}
              title="Delete Journal Item"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        {dateText && <div className="workflow-date mt-n1 text-end">Submitted: {dateText}</div>}
      </div>
    </div>
  );
};

const EditRequestActions: React.FC<EditRequestActionsProps> = ({ status, onUpdateStatus }) => {
  const getStatusBadge = () => {
    const currentStatus = status || 'no_request';
    switch (currentStatus) {
      case 'pending':
        return (
          <div className="d-flex align-items-center">
            <span className="badge bg-warning me-2">Pending</span>
            <div className="btn-group">
              <button
                type="button"
                className="btn btn-sm btn-success"
                onClick={() => onUpdateStatus('approved')}
                title="Approve"
              >
                ✓
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => onUpdateStatus('rejected')}
                title="Reject"
              >
                ✕
              </button>
            </div>
          </div>
        );
      case 'approved':
        return <span className="badge bg-success">Approved</span>;
      case 'rejected':
        return <span className="badge bg-danger">Rejected</span>;
      default:
        return <span className="badge bg-secondary">No Request</span>;
    }
  };

  return getStatusBadge();
};

const Dashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('journals');

  // Handle URL pathname for initial tab selection and subsequent changes
  useEffect(() => {
    const path = location.pathname;
    if (path === '/project-dashboard') {
      setActiveTab('projects');
    } else if (path === '/publication-dashboard' || path === '/admin-dashboard') {
      setActiveTab('journals');
    }
  }, [location.pathname]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalRequests, setJournalRequests] = useState<JournalRequest[]>([]);
  const [projectRequests, setProjectRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Project | Journal | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [adminComment, setAdminComment] = useState('');
  const [showStatusDetailsModal, setShowStatusDetailsModal] = useState(false);
  const [selectedJournalForStatus, setSelectedJournalForStatus] = useState<number | null>(null);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    message: '',
    type: 'info',
  });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType = 'info',
    title?: string,
    showCancel = false,
    confirmText = 'OK',
    onConfirm?: () => void,
  ) => {
    setAlertConfig({ show: true, message, type, title, onConfirm, showCancel, confirmText });
  };

  const closeAlert = () => setAlertConfig((prev) => ({ ...prev, show: false }));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };

    if (isColumnDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColumnDropdownOpen]);

  const [columnConfig, setColumnConfig] = useState<ColumnConfig>(() => {
    const savedConfig = localStorage.getItem('columnConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        // Force reset the config for journals if the new 'management_workflow' column is missing
        // to ensure the user gets the updated layout.
        if (parsed?.journals && !parsed.journals.management_workflow) {
          return { ...parsed, journals: defaultColumnConfig.journals };
        }

        // Hide submission_date column as it's now integrated under action buttons
        if (parsed?.journals?.submission_date) {
          parsed.journals.submission_date.show = false;
          parsed.journals.submission_date.group = 'Details';
        }

        // Force hide and reposition constant columns for existing users
        if (parsed?.journals?.management_workflow) {
          parsed.journals.management_workflow.hideFromConfig = true;
          parsed.journals.management_workflow.order = 98;
          parsed.journals.management_workflow.show = true;
        }
        if (parsed?.journals?.actions) {
          parsed.journals.actions.hideFromConfig = true;
          parsed.journals.actions.order = 99;
          parsed.journals.actions.show = true;
        }
        // LEGACY: Project column names changed with the redesigned form, so replace
        // saved configurations that lack `proposal_status` instead of mixing old and new keys.
        // Remove after all users have loaded and persisted the redesigned column configuration.
        if (parsed?.projects && !parsed.projects.proposal_status) {
          parsed.projects = defaultColumnConfig.projects;
        }
        if (parsed?.projects?.proposal_status) {
          parsed.projects.proposal_status.hideFromConfig = true;
          parsed.projects.proposal_status.order = 98;
          parsed.projects.proposal_status.show = true;
        }
        if (parsed?.projects?.actions) {
          parsed.projects.actions.hideFromConfig = true;
          parsed.projects.actions.order = 99;
          parsed.projects.actions.show = true;
        }
        if (parsed?.projects?.submitted_on) {
          parsed.projects.submitted_on.group = 'Details';
          parsed.projects.submitted_on.show = false;
        }

        return parsed;
      } catch (e) {
        console.error('Error parsing columnConfig from localStorage', e);
      }
    }
    return defaultColumnConfig;
  });

  useEffect(() => {
    localStorage.setItem('columnConfig', JSON.stringify(columnConfig));
  }, [columnConfig]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let endpoint = '';
      if (activeTab === 'projects') {
        endpoint = '/admin/projects';
      } else if (activeTab === 'journals') {
        endpoint = '/admin/journals';
      } else if (activeTab === 'journal-requests') {
        endpoint = '/admin/journal-requests';
      } else if (activeTab === 'project-requests') {
        endpoint = '/admin/project-requests';
      } else if (activeTab === 'journal-status-updates') {
        endpoint = '/admin/journal-status-updates';
      }

      if (!endpoint) {
        setLoading(false);
        return;
      }

      const response = (await authenticityUtility.get(endpoint, {
        params: {
          page: currentPage,
          per_page: itemsPerPage,
        },
      })) as { data: unknown[]; total?: number };
      const data = response.data;
      if (typeof response.total === 'number') {
        setTotalItems(response.total);
      }

      if (activeTab === 'projects') {
        setProjects(Array.isArray(data) ? (data as Project[]) : []);
      } else if (activeTab === 'journals') {
        setJournals(Array.isArray(data) ? (data as Journal[]) : []);
      } else if (activeTab === 'journal-requests') {
        setJournalRequests(Array.isArray(data) ? (data as JournalRequest[]) : []);
      } else if (activeTab === 'project-requests') {
        setProjectRequests(Array.isArray(data) ? (data as ProjectRequest[]) : []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error fetching data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage, itemsPerPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: number) => {
    showAlert(
      'Are you sure you want to delete this item?',
      'warning',
      'Confirm Deletion',
      true,
      'Delete',
      async () => {
        closeAlert();
        try {
          await authenticityUtility.delete(`/${activeTab}/${id}`);
          fetchData();
        } catch (err: unknown) {
          const error = err as { message?: string };
          setError('Error deleting item: ' + error.message);
        }
      },
    );
  };

  const handleApproveJournalRequest = async (requestId: number) => {
    try {
      const response = (await authenticityUtility.patch(
        `/admin/journal-requests/${requestId}/approve`,
        { admin_comment: adminComment },
      )) as { success?: boolean; message?: string };

      if (response.success) {
        showAlert('Journal request approved successfully!', 'success');
        fetchData();
        setAdminComment('');
      } else {
        setError(response.message || 'Failed to approve journal request');
      }
    } catch (err: unknown) {
      console.error('Error approving journal request:', err);
      const error = err as { message?: string };
      setError('Error approving journal request: ' + error.message);
    }
  };

  const handleRejectJournalRequest = async (requestId: number) => {
    try {
      const response = (await authenticityUtility.patch(
        `/admin/journal-requests/${requestId}/reject`,
        { admin_comment: adminComment },
      )) as { success?: boolean; message?: string };

      if (response.success) {
        showAlert('Journal request rejected successfully!', 'success');
        fetchData();
        setAdminComment('');
      } else {
        setError(response.message || 'Failed to reject journal request');
      }
    } catch (err: unknown) {
      console.error('Error rejecting journal request:', err);
      const error = err as { message?: string };
      setError('Error rejecting journal request: ' + error.message);
    }
  };

  const handleJournalSubmissionApproval = async (
    journalId: number,
    status: 'approved' | 'rejected',
  ) => {
    try {
      const response = (await authenticityUtility.patch(
        `/admin/journals/${journalId}/submission-approval`,
        { status, admin_comment: adminComment },
      )) as { message?: string };

      showAlert(
        response.message ||
          `Journal submission ${status === 'approved' ? 'approved' : 'rejected'} successfully`,
        'success',
      );
      setAdminComment('');
      fetchData();
    } catch (err: unknown) {
      console.error('Error updating journal submission approval:', err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        error.response?.data?.message ||
          error.message ||
          'Failed to update journal submission approval',
      );
    }
  };

  const darkHeaderCellStyle: React.CSSProperties = {
    backgroundColor: '#323a40',
    color: '#ffffff',
    borderBottom: '2px solid #dee2e6',
  };

  const handleViewDetails = async (id: number) => {
    // A publication gets its own page: the reviewer needs the whole submission, and a
    // record under review should be linkable and survive a refresh. Projects still open
    // in the summary dialog.
    if (activeTab === 'journals') {
      navigate(`/admin/publications/${id}`);
      return;
    }

    try {
      const response = (await authenticityUtility.get(`/admin/${activeTab}/${id}`)) as {
        data: Project | Journal;
      };
      setSelectedItem(response.data);
      setShowModal(true);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError('Error fetching details: ' + error.message);
    }
  };

  const renderJournalRequestsTable = () => {
    if (!journalRequests || journalRequests.length === 0) {
      return <div className="text-center p-3">No journal requests found</div>;
    }

    return (
      <div className="table-responsive">
        <table className="table table-striped">
          <thead className="table-dark">
            <tr style={{ background: 'inherit' }}>
              <th style={darkHeaderCellStyle}>Journal Name</th>
              <th style={darkHeaderCellStyle}>Category</th>
              <th style={darkHeaderCellStyle}>Publisher</th>
              <th style={darkHeaderCellStyle}>Website</th>
              <th style={darkHeaderCellStyle}>Print ISSN</th>
              <th style={darkHeaderCellStyle}>Online ISSN</th>
              <th style={darkHeaderCellStyle}>Impact Factor</th>
              <th style={darkHeaderCellStyle}>Cite Score</th>
              <th style={darkHeaderCellStyle}>Requested By</th>
              <th style={darkHeaderCellStyle}>Status</th>
              <th style={darkHeaderCellStyle}>Date</th>
              <th style={darkHeaderCellStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {journalRequests.map((request) => (
              <tr key={request.id}>
                <td>{request.journal_name}</td>
                <td>
                  <span
                    className={`badge bg-${request.category === 'International' ? 'primary' : 'secondary'}`}
                  >
                    {request.category || 'National'}
                  </span>
                </td>
                <td>{request.publisher || '-'}</td>
                <td>{request.website || '-'}</td>
                <td>{request.print_issn || '-'}</td>
                <td>{request.online_issn || '-'}</td>
                <td>{request.impact_factor ?? '-'}</td>
                <td>{request.cite_score ?? '-'}</td>
                <td>{request.user_name}</td>
                <td>
                  <span
                    className={`badge bg-${request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'danger'}`}
                  >
                    {request.status}
                  </span>
                </td>
                <td>{formatDate(request.created_at)}</td>
                <td>
                  {request.status === 'pending' && (
                    <div className="btn-group">
                      <button
                        type="button"
                        className="btn btn-sm btn-success me-1"
                        onClick={() => handleApproveJournalRequest(request.id)}
                        title="Approve"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRejectJournalRequest(request.id)}
                        title="Reject"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  {request.status !== 'pending' && <span className="text-muted">Processed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleApproveProjectRequest = async (requestId: number) => {
    try {
      const response = (await authenticityUtility.patch(
        `/admin/project-requests/${requestId}/approve`,
        { admin_comment: adminComment },
      )) as { status?: string; message?: string };

      if (response.status === 'success') {
        showAlert('Project request approved successfully!', 'success');
        setAdminComment('');
        fetchData();
      } else {
        showAlert(response.message || 'Failed to approve project request', 'error');
      }
    } catch (err: unknown) {
      console.error('Error approving project request:', err);
      const error = err as { response?: { data?: { message?: string } } };
      showAlert(error.response?.data?.message || 'Failed to approve project request', 'error');
    }
  };

  const handleRejectProjectRequest = async (requestId: number) => {
    if (!adminComment.trim()) {
      showAlert('Please provide a reason for rejection', 'warning');
      return;
    }

    try {
      const response = (await authenticityUtility.patch(
        `/admin/project-requests/${requestId}/reject`,
        { admin_comment: adminComment },
      )) as { status?: string; message?: string };

      if (response.status === 'success') {
        showAlert('Project request rejected successfully!', 'success');
        setAdminComment('');
        fetchData();
      } else {
        showAlert(response.message || 'Failed to reject project request', 'error');
      }
    } catch (err: unknown) {
      console.error('Error rejecting project request:', err);
      const error = err as { response?: { data?: { message?: string } } };
      showAlert(error.response?.data?.message || 'Failed to reject project request', 'error');
    }
  };

  const getFileUrl = (filePath: string | undefined): string => {
    if (!filePath) return '#';
    if (/^https?:\/\//.test(filePath)) return filePath;
    const sanitizedPath = filePath.startsWith('/uploads/')
      ? filePath
      : filePath.startsWith('uploads/')
        ? `/${filePath}`
        : `/uploads/${filePath.replace(/^\/+/, '')}`;
    return `${authenticityUtility.getBaseURL()}${sanitizedPath}`;
  };

  const handleEditRequestStatus = async (
    itemId: number,
    newStatus: string,
    editRequestUserId?: number,
  ) => {
    try {
      // itemId is the journal/project id, not the edit_requests row id, so the entity type
      // has to travel with it — otherwise the server cannot tell a journal's request from
      // a project's request that shares the same id.
      const entityType = activeTab.startsWith('project') ? 'research_projects' : 'journals';
      let endpoint = '';
      if (newStatus === 'approved') {
        endpoint = `/admin/edit-requests/${itemId}/approve`;
      } else if (newStatus === 'rejected') {
        endpoint = `/admin/edit-requests/${itemId}/reject`;
      } else {
        endpoint = `/admin/edit-requests/${entityType}/${itemId}`;
      }
      const response = (await authenticityUtility.patch(endpoint, {
        status: newStatus,
        entityType,
        // Names whose request is being decided: two users can have open requests on the
        // same publication, and the server would otherwise decide the newest row.
        userId: editRequestUserId,
      })) as {
        success?: boolean;
        message?: string;
      };
      if (response.success) {
        showAlert(`Edit request ${newStatus} successfully`, 'success');
        fetchData();
      } else {
        setError(response.message || 'Failed to update edit request status');
      }
    } catch (err: unknown) {
      console.error('Error updating edit request:', err);
      const error = err as { message?: string };
      setError(`Error updating edit request: ${error.message}`);
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatValue = (
    value: unknown,
    column: VisibleColumn,
    item: Project | Journal,
  ): React.ReactNode => {
    const formatDateLocal = (dateString: string | undefined): string => {
      if (!dateString) return '-';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        return '-';
      }
    };

    const projectItem = item as Project & Record<string, unknown>;
    const journalItem = item as Journal & Record<string, unknown>;

    switch (column.key) {
      case 'status':
      case 'publication_status': {
        const status =
          (projectItem.status as string) || (projectItem.publication_status as string) || '-';
        if (status === '-' || !status) return '-';
        const statusClass = status.toLowerCase().replace(/\s+/g, '_');
        return <span className={`badge ${statusClass}`}>{status}</span>;
      }

      case 'submission_date':
      case 'submitted_on':
        return projectItem.submitted_on ? formatDateLocal(projectItem.submitted_on as string) : '-';

      case 'proposal_status':
      case 'project_status': {
        const value = (projectItem[column.key] as string) || '';
        if (!value) return '-';
        return <span className={`badge ${value}`}>{PROJECT_STATUS_LABELS[value] ?? value}</span>;
      }

      case 'driven_by':
        return projectItem.driven_by === 'student' ? 'Student' : 'Faculty';

      case 'submission_approval_status': {
        const rawStatus = (journalItem.admin_approval_status as string) || 'pending';
        const approvalStatus =
          rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending';

        return (
          <div className="submission-approval-cell">
            <span className={`badge submission-approval-badge ${approvalStatus}`}>
              {approvalStatus === 'approved'
                ? 'Approved'
                : approvalStatus === 'rejected'
                  ? 'Rejected'
                  : 'Pending'}
            </span>
            <div className="submission-approval-actions">
              {approvalStatus === 'pending' && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={() => handleJournalSubmissionApproval(item.id, 'approved')}
                    title="Approve submission"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleJournalSubmissionApproval(item.id, 'rejected')}
                    title="Reject submission"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        );
      }

      case 'author_names':
        if (Array.isArray(journalItem.author_names)) {
          return (
            <>
              {journalItem.author_names.map((name, index) => {
                const cleanName = name.replace(/\s*\[.*?\]/g, '').trim();
                const hasAsterisk = cleanName.endsWith('*');
                return (
                  <span key={index}>
                    {index > 0 && ', '}
                    {hasAsterisk ? (
                      <>
                        {cleanName.slice(0, -1)}
                        <span style={{ color: 'red', fontWeight: 'bold' }}>*</span>
                      </>
                    ) : (
                      cleanName
                    )}
                  </span>
                );
              })}
            </>
          );
        }
        return '-';

      case 'page_numbers':
        return projectItem.pages_from && projectItem.pages_to
          ? `${projectItem.pages_from}-${projectItem.pages_to}`
          : '-';

      case 'publication_date':
        return formatDateLocal(
          (projectItem.available_online_date as string) || (projectItem.publication_date as string),
        );

      case 'index_names':
        return journalItem.index_names ? journalItem.index_names.join(', ') : '-';

      case 'citation_score':
        return (projectItem.cite_score as string) || (projectItem.citation_score as string) || '-';

      case 'project_cost':
        return formatCurrency((projectItem.project_cost as string | number) || '0');

      case 'disbursed_amount':
        return formatCurrency((projectItem.disbursed_amount as string | number) || '0');

      case 'project_start_date':
        return formatDateLocal(projectItem.project_start_date as string);

      case 'project_closing_date':
        return formatDateLocal(projectItem.project_closing_date as string);

      case 'investigators': {
        const teamMembers = projectItem.team_members as { name?: string }[] | undefined;
        if (!Array.isArray(teamMembers) || teamMembers.length === 0) return '-';
        return teamMembers
          .map((member) => member.name)
          .filter(Boolean)
          .join(', ');
      }

      case 'collaborators_enabled':
        return projectItem.collaborators_enabled ? 'Yes' : 'No';

      case 'project_duration': {
        const duration: string[] = [];
        if (projectItem.duration_years) {
          duration.push(
            `${projectItem.duration_years} ${projectItem.duration_years === 1 ? 'year' : 'years'}`,
          );
        }
        if (projectItem.duration_months) {
          duration.push(
            `${projectItem.duration_months} ${projectItem.duration_months === 1 ? 'month' : 'months'}`,
          );
        }
        if (projectItem.duration_days) {
          duration.push(
            `${projectItem.duration_days} ${projectItem.duration_days === 1 ? 'day' : 'days'}`,
          );
        }
        return duration.length > 0 ? duration.join(', ') : '-';
      }

      case 'edit_request_status':
        return (
          <EditRequestActions
            status={(item.edit_request_status as string) || 'no_request'}
            onUpdateStatus={(newStatus) =>
              handleEditRequestStatus(item.id, newStatus, item.edit_request_user_id)
            }
            itemId={item.id}
          />
        );

      case 'management_workflow':
        return (
          <JournalWorkflowCell
            item={journalItem}
            onViewDetails={handleViewDetails}
            onDelete={handleDelete}
            onSubmissionApproval={handleJournalSubmissionApproval}
            onEditRequestStatus={handleEditRequestStatus}
            onViewStatusUpdates={(id) => {
              setSelectedJournalForStatus(id);
              setShowStatusDetailsModal(true);
            }}
          />
        );

      case 'status_updates':
        return (
          <Button
            variant="info"
            size="sm"
            onClick={() => {
              setSelectedJournalForStatus(item.id);
              setShowStatusDetailsModal(true);
            }}
            title="View Status Updates"
          >
            <Eye size={16} />
          </Button>
        );

      default:
        return (value as string) || '-';
    }
  };

  const handleColumnReorder = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) {
      return;
    }

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    setColumnConfig((prevConfig) => {
      const newConfig = { ...prevConfig };
      const tabKey = activeTab as 'projects' | 'journals';
      if (tabKey !== 'projects' && tabKey !== 'journals') return prevConfig;

      const currentTabConfig = { ...newConfig[tabKey] };

      const columnKeys = Object.keys(currentTabConfig)
        .filter((key) => currentTabConfig[key].show)
        .sort((a, b) => currentTabConfig[a].order - currentTabConfig[b].order);

      const [movedKey] = columnKeys.splice(sourceIndex, 1);
      columnKeys.splice(destIndex, 0, movedKey);

      columnKeys.forEach((key, index) => {
        currentTabConfig[key] = { ...currentTabConfig[key], order: index };
      });

      newConfig[tabKey] = currentTabConfig;
      return newConfig;
    });
  };

  const toggleColumn = (columnKey: string) => {
    setColumnConfig((prev) => {
      const tabKey = activeTab as 'projects' | 'journals';
      if (tabKey !== 'projects' && tabKey !== 'journals') return prev;

      return {
        ...prev,
        [tabKey]: {
          ...prev[tabKey],
          [columnKey]: {
            ...prev[tabKey][columnKey],
            show: !prev[tabKey][columnKey].show,
          },
        },
      };
    });
  };

  const getVisibleColumns = (): VisibleColumn[] => {
    const tabKey = activeTab as 'projects' | 'journals';
    if (tabKey !== 'projects' && tabKey !== 'journals') return [];

    const visibleColumns = Object.entries(columnConfig[tabKey])
      .filter(([, config]) => config.show)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, config]) => ({ key, ...config }));

    return visibleColumns;
  };

  const renderColumnToggleDropdown = () => {
    const tabKey = activeTab as 'projects' | 'journals';

    if (tabKey !== 'projects' && tabKey !== 'journals') {
      return null;
    }

    const columns = Object.entries(columnConfig[tabKey]).filter(
      ([_, config]) => !config.hideFromConfig,
    );

    const groupedColumns = columns.reduce(
      (acc, [key, config]) => {
        const group = config.group || 'Other';
        if (!acc[group]) acc[group] = [];
        acc[group].push([key, config] as [string, ColumnConfigItem]);
        return acc;
      },
      {} as Record<string, [string, ColumnConfigItem][]>,
    );

    const groupOrder = [
      'Essential',
      ...Object.keys(groupedColumns)
        .filter((g) => g !== 'Essential')
        .sort((a, b) => a.localeCompare(b)),
    ];

    return (
      <div ref={dropdownRef} className="position-relative d-inline-block">
        <button
          className="column-toggle-button"
          type="button"
          onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
        >
          <Settings size={18} />
          <span>Configure Columns</span>
        </button>
        {isColumnDropdownOpen && (
          <div className="column-config-dropdown shadow-lg border">
            {groupOrder.map((group) => (
              <div key={group} className="mb-3">
                <h6 className="column-group-title">{group}</h6>
                <div className="row g-2">
                  {groupedColumns[group]
                    ?.sort((a, b) => a[1].order - b[1].order)
                    .map(([key, config]) => (
                      <div key={key} className="col-6">
                        <div className="form-check py-1">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`column-toggle-${key}`}
                            checked={config.show}
                            onChange={() => toggleColumn(key)}
                            disabled={group === 'Essential'}
                          />
                          <label
                            className={`form-check-label user-select-none small ms-1 ${group === 'Essential' ? 'text-muted opacity-75' : ''}`}
                            htmlFor={`column-toggle-${key}`}
                            style={{ cursor: group === 'Essential' ? 'default' : 'pointer' }}
                          >
                            {config.label}
                          </label>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTable = () => {
    const items = activeTab === 'projects' ? projects : journals;
    if (!items || items.length === 0) {
      return (
        <div className="loading py-5">
          <div className="text-center">
            <p className="mb-0">No {activeTab} found</p>
          </div>
        </div>
      );
    }

    const visibleColumns = getVisibleColumns();

    return (
      <div className="table-responsive">
        <DragDropContext onDragEnd={handleColumnReorder}>
          <table className="table">
            <Droppable droppableId="table-header" direction="horizontal">
              {(provided) => (
                <thead ref={provided.innerRef} {...provided.droppableProps}>
                  <tr>
                    {visibleColumns.map((column, index) => (
                      <Draggable key={column.key} draggableId={column.key} index={index}>
                        {(provided, snapshot) => (
                          <th
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                              cursor: snapshot.isDragging ? 'grabbing' : 'grab',
                            }}
                          >
                            <div className="d-flex align-items-center gap-2">{column.label}</div>
                          </th>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </tr>
                </thead>
              )}
            </Droppable>
            <tbody>{items.map((item) => renderTableRow(item))}</tbody>
          </table>
        </DragDropContext>
      </div>
    );
  };

  const renderPagination = () => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const pages: JSX.Element[] = [];

    // Simple visible pages logic
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <li key={i} className={`page-item ${currentPage === i ? 'active' : ''}`}>
          <button className="page-link" onClick={() => setCurrentPage(i)}>
            {i}
          </button>
        </li>,
      );
    }

    return (
      <div className="adminbudget-pagination">
        <div className="adminbudget-pagination-left">
          <div className="adminbudget-rows-control">
            <label htmlFor="adminbudget-rows-per-page" className="adminbudget-rows-label">
              Rows per page
            </label>
            <select
              id="adminbudget-rows-per-page"
              className="adminbudget-rows-select"
              value={itemsPerPage}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <span className="adminbudget-pagecount">
            {totalItems === 0
              ? '0-0 of 0'
              : `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems}`}
          </span>
        </div>

        <div className="adminbudget-pagination-right">
          <button
            className="adminbudget-pagebtn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>

          <span className="adminbudget-pageinfo">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="adminbudget-pagebtn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const renderProjectDetails = () => {
    if (!selectedItem) return null;
    const project = selectedItem as Project & Record<string, unknown>;

    const investigators =
      (project.investigators as {
        name?: string;
        member_type?: string;
        department?: string;
        organization?: string;
        is_principal?: boolean | number;
      }[]) || [];
    const contributions = (project.financial_contributions as FinanceRowView[]) || [];
    const financeSharing = (project.finance_sharing as FinanceRowView[]) || [];
    const collaborators =
      (project.collaborators as {
        category?: string;
        role?: string;
        organization_label?: string;
        city?: string;
        has_active_mou?: boolean | number;
        contact_name?: string;
        contact_email?: string;
      }[]) || [];
    const disbursements =
      (project.disbursements as {
        financial_year?: string;
        organization_label?: string;
        amount?: string;
        disbursement_date?: string;
        documents?: Record<string, { file_path?: string }>;
      }[]) || [];
    const documents =
      (project.documents as Record<string, { file_path?: string; original_name?: string }>) || {};
    const nationalInitiatives = (project.national_initiatives as string[]) || [];
    const sdgs = (project.sdgs as string[]) || [];

    const outcomes = [
      { label: 'Journal Articles', value: project.outcome_journal_articles },
      { label: 'Conferences', value: project.outcome_conferences },
      { label: 'IPRs', value: project.outcome_iprs },
      { label: 'Products', value: project.outcome_products },
      { label: 'Tech Transfers', value: project.outcome_tech_transfers },
      { label: 'Start-ups', value: project.outcome_startups },
    ].filter((outcome) => Number(outcome.value) > 0);

    const documentLabel = (key: string) =>
      ({
        presentation: 'Presentation',
        sanction_order: 'Sanction Order',
        project_report: 'Project Report',
        utilization_certificate_soe: 'Utilization Certificate & SoE',
        bill_copies: 'Bill Copies',
        bank_statement: 'Bank Statement',
      })[key] ?? key;

    const renderFinanceTable = (rows: FinanceRowView[], caption: string) => (
      <div className="detail-section">
        <h4>{caption}</h4>
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Budget Head(s)</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>{row.organization_label || '-'}</td>
                  <td>
                    {(row.heads ?? [])
                      .map((head) => head.budget_head_name)
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </td>
                  <td>{formatCurrency(row.amount ?? 0)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center">
                    No rows recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <div className="project-details">
        <h3 className="mb-2">{project.title}</h3>

        <div className="detail-section">
          <h4>Basic Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Driven by:</strong>{' '}
                {project.driven_by === 'student' ? 'Student' : 'Faculty'}
              </p>
              <p>
                <strong>Funding Agency:</strong>{' '}
                {(project.funding_organization_name as string) || '-'}
              </p>
              <p>
                <strong>Scheme:</strong> {(project.scheme_name as string) || '-'}
              </p>
              <p>
                <strong>Domain:</strong> {(project.scheme_domain as string) || '-'}
              </p>
              <p>
                <strong>Category:</strong> {(project.scheme_category as string) || '-'}
              </p>
            </div>
            <div className="col-md-6">
              <p>
                <strong>Project Cost:</strong>{' '}
                {formatCurrency((project.project_cost as string) ?? 0)}
              </p>
              <p>
                <strong>Duration:</strong> {(project.duration_years as number) || 0} years,{' '}
                {(project.duration_months as number) || 0} months,{' '}
                {(project.duration_days as number) || 0} days
              </p>
              <p>
                <strong>Reference Number:</strong> {(project.reference_number as string) || '-'}
              </p>
              <p>
                <strong>Proposal Status:</strong>{' '}
                {PROJECT_STATUS_LABELS[project.proposal_status ?? ''] ??
                  project.proposal_status ??
                  '-'}
              </p>
              <p>
                <strong>Submitted On:</strong> {formatDate(project.submitted_on)}
              </p>
            </div>
          </div>

          {(nationalInitiatives.length > 0 || sdgs.length > 0) && (
            <div className="row">
              {nationalInitiatives.length > 0 && (
                <div className="col-md-6">
                  <p>
                    <strong>National Initiatives:</strong> {nationalInitiatives.join(', ')}
                  </p>
                </div>
              )}
              {sdgs.length > 0 && (
                <div className="col-md-6">
                  <p>
                    <strong>SDGs:</strong> {sdgs.join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="detail-section">
          <h4>Investigators</h4>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Organization</th>
                </tr>
              </thead>
              <tbody>
                {investigators.map((investigator, index) => (
                  <tr key={index}>
                    <td>{investigator.name}</td>
                    <td>
                      {investigator.is_principal ? 'Principal Investigator' : 'Co-Investigator'}
                    </td>
                    <td className="text-capitalize">{investigator.member_type}</td>
                    <td>{investigator.department || '-'}</td>
                    <td>{investigator.organization || '-'}</td>
                  </tr>
                ))}
                {investigators.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center">
                      No investigators recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="detail-section">
          <h4>Timeline</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Presentation Date:</strong>{' '}
                {formatDate(project.presentation_date as string)}
              </p>
              <p>
                <strong>Result Announced:</strong> {formatDate(project.result_date as string)}
              </p>
              <p>
                <strong>Final Result:</strong>{' '}
                {project.final_result === 'selected'
                  ? 'Selected'
                  : project.final_result === 'not_selected'
                    ? 'Not Selected'
                    : '-'}
              </p>
            </div>
            <div className="col-md-6">
              <p>
                <strong>Sanction Date:</strong> {formatDate(project.sanction_date as string)}
              </p>
              <p>
                <strong>Sanction Ref. No.:</strong>{' '}
                {(project.sanction_reference_no as string) || '-'}
              </p>
              <p>
                <strong>Project Start:</strong> {formatDate(project.project_start_date as string)}
              </p>
              <p>
                <strong>Project Closing:</strong>{' '}
                {formatDate(project.project_closing_date as string)}
              </p>
              <p>
                <strong>Project Status:</strong>{' '}
                {PROJECT_STATUS_LABELS[(project.project_status as string) ?? ''] ??
                  project.project_status ??
                  '-'}
              </p>
            </div>
          </div>
        </div>

        {!!project.financial_contribution_enabled &&
          renderFinanceTable(contributions, 'Financial Contribution')}
        {!!project.finance_sharing_enabled && renderFinanceTable(financeSharing, 'Finance Sharing')}

        {!!project.collaborators_enabled && collaborators.length > 0 && (
          <div className="detail-section">
            <h4>Collaborators</h4>
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Category</th>
                    <th>Role</th>
                    <th>City</th>
                    <th>Active MoU</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {collaborators.map((collaborator, index) => (
                    <tr key={index}>
                      <td>{collaborator.organization_label || '-'}</td>
                      <td>{collaborator.category || '-'}</td>
                      <td>{collaborator.role || '-'}</td>
                      <td>{collaborator.city || '-'}</td>
                      <td>{collaborator.has_active_mou ? 'Yes' : 'No'}</td>
                      <td>
                        {[collaborator.contact_name, collaborator.contact_email]
                          .filter(Boolean)
                          .join(' · ') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="detail-section">
          <h4>Grant Disbursements</h4>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Financial Year</th>
                  <th>Organization</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Sanction</th>
                  <th>UC &amp; SoE</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {disbursements.map((disbursement, index) => (
                  <tr key={index}>
                    <td>{disbursement.financial_year || '-'}</td>
                    <td>{disbursement.organization_label || '-'}</td>
                    <td>{formatCurrency(disbursement.amount ?? 0)}</td>
                    <td>{formatDate(disbursement.disbursement_date)}</td>
                    {['sanction', 'uc_soe', 'report'].map((slot) => (
                      <td key={slot}>
                        {disbursement.documents?.[slot]?.file_path ? (
                          <a
                            href={getFileUrl(disbursement.documents[slot].file_path as string)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-secondary"
                          >
                            View
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {disbursements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      No grant disbursements found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {outcomes.length > 0 && (
          <div className="detail-section">
            <h4>Outcomes</h4>
            <p>{outcomes.map((outcome) => `${outcome.label}: ${outcome.value}`).join('  ·  ')}</p>
          </div>
        )}

        {Object.keys(documents).length > 0 && (
          <div className="detail-section">
            <h4>Documents</h4>
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(documents).map(([key, document]) => (
                    <tr key={key}>
                      <td>{documentLabel(key)}</td>
                      <td>
                        <a
                          href={getFileUrl(document.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-primary"
                        >
                          View Document
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!!(project.remarks as string) && (
          <div className="detail-section">
            <h4>Remarks</h4>
            <p>{project.remarks as string}</p>
          </div>
        )}

        <div className="detail-section">
          <h4>Edit Request Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Status:</strong> {project.edit_request_status || 'No Request'}
              </p>
              {(project.edit_request_comment as string) && (
                <p>
                  <strong>Comment:</strong> {project.edit_request_comment as string}
                </p>
              )}
              {(project.edit_request_date as string) && (
                <p>
                  <strong>Request Date:</strong> {formatDate(project.edit_request_date as string)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * A publication under review: the submission form exactly as the author sees it, in
   * view mode, with the approval decision and its comment box alongside. Replaces the
   * old summary dialog, which showed only a subset of the record.
   */
  const renderTableRow = (item: Project | Journal) => (
    <tr key={item.id}>
      {getVisibleColumns().map((column) => {
        if (column.key === 'actions') {
          return (
            <td key={column.key}>
              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-sm btn-info me-1"
                  onClick={() => handleViewDetails(item.id)}
                  title="View Details"
                >
                  <Eye size={16} />
                </button>
                <button type="button" className="btn btn-sm btn-primary me-1" title="Edit">
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(item.id)}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          );
        }
        return (
          <td key={column.key}>
            {formatValue((item as Record<string, unknown>)[column.key], column, item)}
          </td>
        );
      })}
    </tr>
  );

  const renderProjectRequestsTable = () => {
    if (projectRequests.length === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-muted">No project requests found.</p>
        </div>
      );
    }

    return (
      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th style={darkHeaderCellStyle}>User</th>
              <th style={darkHeaderCellStyle}>Request Type</th>
              <th style={darkHeaderCellStyle}>Name</th>
              <th style={darkHeaderCellStyle}>Description</th>
              <th style={darkHeaderCellStyle}>Status</th>
              <th style={darkHeaderCellStyle}>Created At</th>
              <th style={darkHeaderCellStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projectRequests.map((request) => (
              <tr key={request.id}>
                <td>{request.user_name || 'Unknown User'}</td>
                <td>
                  <span
                    className={`badge bg-${request.request_type === 'organization' ? 'primary' : request.request_type === 'scheme' ? 'success' : 'secondary'}`}
                  >
                    {request.request_type === 'organization' ? 'FUNDING AGENCY' : 'SCHEME'}
                  </span>
                </td>
                <td>{request.name}</td>
                <td>{request.description || '-'}</td>
                <td>
                  <span
                    className={`badge bg-${request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'danger'}`}
                  >
                    {request.status.toUpperCase()}
                  </span>
                </td>
                <td>{formatDate(request.created_at)}</td>
                <td>
                  {request.status === 'pending' && (
                    <div className="btn-group" role="group">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => handleApproveProjectRequest(request.id)}
                        title="Approve"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRejectProjectRequest(request.id)}
                        title="Reject"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  {request.status !== 'pending' && (
                    <span className="text-muted small">
                      {request.admin_comment ? `Comment: ${request.admin_comment}` : 'No comment'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div className="publication-approval-dashboard">
        <div className="w-100 max-w-1400">
          <div className="tab-buttons">
            {location.pathname === '/project-dashboard' ? (
              <>
                <div
                  className={`tab-button ${activeTab === 'projects' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('projects');
                    setCurrentPage(1);
                  }}
                >
                  Projects
                </div>
                <div
                  className={`tab-button ${activeTab === 'project-requests' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('project-requests');
                    setCurrentPage(1);
                  }}
                >
                  Project Requests
                </div>
                <div
                  className={`tab-button ${activeTab === 'project-management' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('project-management');
                    setCurrentPage(1);
                  }}
                >
                  Project Management
                </div>
              </>
            ) : (
              <>
                <div
                  className={`tab-button ${activeTab === 'journals' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('journals');
                    setCurrentPage(1);
                  }}
                >
                  Publications
                </div>
                <div
                  className={`tab-button ${activeTab === 'journal-requests' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('journal-requests');
                    setCurrentPage(1);
                  }}
                >
                  Publication Requests
                </div>
                <div
                  className={`tab-button ${activeTab === 'journal-status-updates' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('journal-status-updates');
                    setCurrentPage(1);
                  }}
                >
                  Publication Status Updates
                </div>
                <div
                  className={`tab-button ${activeTab === 'journal-management' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('journal-management');
                    setCurrentPage(1);
                  }}
                >
                  Publication Management
                </div>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner-border spinner-border-sm me-2" role="status"></div>
            Loading Dashboard...
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div className="w-100 max-w-1400">
            {(activeTab === 'projects' || activeTab === 'journals') && (
              <>
                <div className="d-flex justify-content-end mb-4 pe-4">
                  {renderColumnToggleDropdown()}
                </div>
                <div className="table-container">
                  {renderTable()}
                  <div className="table-footer">{renderPagination()}</div>
                </div>
              </>
            )}
            {activeTab === 'journal-requests' && (
              <div className="table-container">{renderJournalRequestsTable()}</div>
            )}
            {activeTab === 'project-requests' && (
              <div className="table-container">{renderProjectRequestsTable()}</div>
            )}
            {activeTab === 'journal-status-updates' && (
              <div className="table-container">
                <JournalStatusUpdates />
              </div>
            )}
            {activeTab === 'journal-management' && (
              <div className="table-container">
                <JournalManagement />
              </div>
            )}
            {activeTab === 'project-management' && (
              <div className="table-container">
                <ProjectFormOptions />
              </div>
            )}
          </div>
        )}

        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          size="lg"
          className="details-modal"
        >
          {/* Projects only: a publication opens on its own review page instead. */}
          <Modal.Header closeButton>
            <Modal.Title>Project Details</Modal.Title>
          </Modal.Header>
          <Modal.Body className="modal-body-scroll">{renderProjectDetails()}</Modal.Body>
        </Modal>
      </div>

      <JournalStatusDetails
        journalId={selectedJournalForStatus}
        show={showStatusDetailsModal}
        onHide={() => {
          setShowStatusDetailsModal(false);
          setSelectedJournalForStatus(null);
        }}
      />

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

export default Dashboard;
