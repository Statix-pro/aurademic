import React, { useState, useEffect, useCallback, ChangeEvent } from "react";
import authenticityUtility from "../../utility/authenticityUtility";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faTrash,
  faEye,
  faCheck,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { Modal, Button } from "react-bootstrap";
import Navbar from "../../shared/components/layout/navbar/navbar";
import "./admindashboard.css";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import JournalManagement from "./formManagement/JournalFormOptions";
import ProjectFormOptions from "./formManagement/ProjectFormOptions";
import JournalStatusUpdates from "./components/JournalStatusUpdates";
import JournalStatusDetails from "./components/JournalStatusDetails";

interface ColumnConfigItem {
  show: boolean;
  order: number;
  label: string;
  group: string;
}

interface ColumnConfig {
  projects: Record<string, ColumnConfigItem>;
  journals: Record<string, ColumnConfigItem>;
}

interface Project {
  id: number;
  title: string;
  project_category?: string;
  agency?: string;
  scheme?: string;
  submission_status?: string;
  date_of_submission?: string;
  edit_request_status?: string;
  is_collaboration_enabled?: boolean | number;
  [key: string]: unknown;
}

interface Journal {
  id: number;
  title: string;
  journal_name?: string;
  publication_status?: string;
  submission_date?: string;
  author_names?: string[];
  index_names?: string[];
  edit_request_status?: string;
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
  user_name: string;
  status: string;
  created_at: string;
}

interface ProjectRequest {
  id: number;
  user_name?: string;
  request_type: string;
  name: string;
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

type TabType = 'projects' | 'journals' | 'journal-requests' | 'project-requests' | 'journal-status-updates';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("projects");
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
  const [totalItems] = useState(0);
  const [adminComment, setAdminComment] = useState("");
  const [showStatusDetailsModal, setShowStatusDetailsModal] = useState(false);
  const [selectedJournalForStatus, setSelectedJournalForStatus] = useState<number | null>(null);

  const [columnConfig, setColumnConfig] = useState<ColumnConfig>(() => {
    const savedConfig = localStorage.getItem("columnConfig");
    return savedConfig
      ? JSON.parse(savedConfig)
      : {
          projects: {
            title: { show: true, order: 0, label: "Title", group: "Essential" },
            project_category: { show: true, order: 1, label: "Category", group: "Essential" },
            agency: { show: true, order: 2, label: "Agency", group: "Essential" },
            scheme: { show: true, order: 3, label: "Scheme", group: "Essential" },
            submission_status: { show: true, order: 4, label: "Status", group: "Essential" },
            date_of_submission: { show: true, order: 5, label: "Submission Date", group: "Essential" },
            project_type: { show: false, order: 6, label: "Project Type", group: "Details" },
            project_duration: { show: false, order: 7, label: "Duration", group: "Details" },
            sanctioned_amount: { show: false, order: 9, label: "Sanctioned Amount (₹)", group: "Financial" },
            start_date: { show: false, order: 11, label: "Start Date", group: "Timeline" },
            end_date: { show: false, order: 12, label: "End Date", group: "Timeline" },
            investigators: { show: false, order: 13, label: "Investigators", group: "Team" },
            collaborating_institute: { show: false, order: 14, label: "Collaborating Institute", group: "Team" },
            edit_request_status: { show: true, order: 18, label: "Edit Request", group: "Essential" },
            actions: { show: true, order: 19, label: "Actions", group: "Essential" },
          },
          journals: {
            title: { show: true, order: 0, label: "Title", group: "Essential" },
            journal_name: { show: true, order: 1, label: "Journal Name", group: "Essential" },
            publication_status: { show: true, order: 2, label: "Status", group: "Essential" },
            submission_date: { show: true, order: 3, label: "Submission Date", group: "Essential" },
            author_names: { show: true, order: 4, label: "Authors", group: "Details" },
            volume: { show: false, order: 6, label: "Volume", group: "Details" },
            issue: { show: false, order: 7, label: "Issue", group: "Details" },
            page_numbers: { show: false, order: 8, label: "Page Numbers", group: "Details" },
            doi: { show: false, order: 9, label: "DOI", group: "Details" },
            publication_date: { show: false, order: 10, label: "Publication Date", group: "Timeline" },
            publisher: { show: false, order: 11, label: "Publisher", group: "Details" },
            index_names: { show: true, order: 12, label: "Indexing", group: "Metrics" },
            edit_request_status: { show: true, order: 17, label: "Edit Request", group: "Essential" },
            status_updates: { show: true, order: 18, label: "Status Updates", group: "Essential" },
            actions: { show: true, order: 19, label: "Actions", group: "Essential" },
          },
        };
  });

  useEffect(() => {
    localStorage.setItem("columnConfig", JSON.stringify(columnConfig));
  }, [columnConfig]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let endpoint = '';
      if (activeTab === "projects") {
        endpoint = "/admin/projects";
      } else if (activeTab === "journals") {
        endpoint = "/admin/journals";
      } else if (activeTab === "journal-requests") {
        endpoint = "/admin/journal-requests";
      } else if (activeTab === "project-requests") {
        endpoint = "/admin/project-requests";
      } else if (activeTab === "journal-status-updates") {
        endpoint = "/admin/journal-status-updates";
      }

      const response = await authenticityUtility.get(endpoint, {
        params: {
          page: currentPage,
          per_page: itemsPerPage,
        },
      }) as { data: unknown[] };
      const data = response.data;

      if (activeTab === "projects") {
        setProjects(Array.isArray(data) ? data as Project[] : []);
      } else if (activeTab === "journals") {
        setJournals(Array.isArray(data) ? data as Journal[] : []);
      } else if (activeTab === "journal-requests") {
        setJournalRequests(Array.isArray(data) ? data as JournalRequest[] : []);
      } else if (activeTab === "project-requests") {
        setProjectRequests(Array.isArray(data) ? data as ProjectRequest[] : []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Error fetching data. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage, itemsPerPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      await authenticityUtility.delete(`/${activeTab}/${id}`);
      fetchData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError("Error deleting item: " + error.message);
    }
  };

  const handleApproveJournalRequest = async (requestId: number) => {
    try {
      const response = await authenticityUtility.patch(
        `/admin/journal-requests/${requestId}/approve`,
        { admin_comment: adminComment }
      ) as { success?: boolean; message?: string };

      if (response.success) {
        alert("Journal request approved successfully!");
        fetchData();
        setAdminComment("");
      } else {
        setError(response.message || "Failed to approve journal request");
      }
    } catch (err: unknown) {
      console.error("Error approving journal request:", err);
      const error = err as { message?: string };
      setError("Error approving journal request: " + error.message);
    }
  };

  const handleRejectJournalRequest = async (requestId: number) => {
    try {
      const response = await authenticityUtility.patch(
        `/admin/journal-requests/${requestId}/reject`,
        { admin_comment: adminComment }
      ) as { success?: boolean; message?: string };

      if (response.success) {
        alert("Journal request rejected successfully!");
        fetchData();
        setAdminComment("");
      } else {
        setError(response.message || "Failed to reject journal request");
      }
    } catch (err: unknown) {
      console.error("Error rejecting journal request:", err);
      const error = err as { message?: string };
      setError("Error rejecting journal request: " + error.message);
    }
  };

  const darkHeaderCellStyle: React.CSSProperties = {
    backgroundColor: "#323a40",
    color: "#ffffff",
    borderBottom: "2px solid #dee2e6",
  };

  const handleViewDetails = async (id: number) => {
    try {
      const response = await authenticityUtility.get(`/admin/${activeTab}/${id}`) as { data: Project | Journal };
      setSelectedItem(response.data);
      setShowModal(true);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError("Error fetching details: " + error.message);
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
            <tr style={{ background: "inherit" }}>
              <th style={darkHeaderCellStyle}>Journal Name</th>
              <th style={darkHeaderCellStyle}>Category</th>
              <th style={darkHeaderCellStyle}>Publisher</th>
              <th style={darkHeaderCellStyle}>Website</th>
              <th style={darkHeaderCellStyle}>Print ISSN</th>
              <th style={darkHeaderCellStyle}>Online ISSN</th>
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
                  <span className={`badge bg-${request.category === "International" ? "primary" : "secondary"}`}>
                    {request.category || "National"}
                  </span>
                </td>
                <td>{request.publisher || "-"}</td>
                <td>{request.website || "-"}</td>
                <td>{request.print_issn || "-"}</td>
                <td>{request.online_issn || "-"}</td>
                <td>{request.user_name}</td>
                <td>
                  <span className={`badge bg-${request.status === "pending" ? "warning" : request.status === "approved" ? "success" : "danger"}`}>
                    {request.status}
                  </span>
                </td>
                <td>{formatDate(request.created_at)}</td>
                <td>
                  {request.status === "pending" && (
                    <div className="btn-group">
                      <button
                        className="btn btn-sm btn-success me-1"
                        onClick={() => handleApproveJournalRequest(request.id)}
                        title="Approve"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRejectJournalRequest(request.id)}
                        title="Reject"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  )}
                  {request.status !== "pending" && (
                    <span className="text-muted">Processed</span>
                  )}
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
      const response = await authenticityUtility.patch(
        `/admin/project-requests/${requestId}/approve`,
        { admin_comment: adminComment }
      ) as { status?: string; message?: string };

      if (response.status === "success") {
        alert("Project request approved successfully!");
        setAdminComment("");
        fetchData();
      } else {
        alert(response.message || "Failed to approve project request");
      }
    } catch (err: unknown) {
      console.error("Error approving project request:", err);
      const error = err as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || "Failed to approve project request");
    }
  };

  const handleRejectProjectRequest = async (requestId: number) => {
    if (!adminComment.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    try {
      const response = await authenticityUtility.patch(
        `/admin/project-requests/${requestId}/reject`,
        { admin_comment: adminComment }
      ) as { status?: string; message?: string };

      if (response.status === "success") {
        alert("Project request rejected successfully!");
        setAdminComment("");
        fetchData();
      } else {
        alert(response.message || "Failed to reject project request");
      }
    } catch (err: unknown) {
      console.error("Error rejecting project request:", err);
      const error = err as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || "Failed to reject project request");
    }
  };

  const EditRequestActions: React.FC<EditRequestActionsProps> = ({ status, onUpdateStatus }) => {
    const getStatusBadge = () => {
      const currentStatus = status || "no_request";
      switch (currentStatus) {
        case "pending":
          return (
            <div className="d-flex align-items-center">
              <span className="badge bg-warning me-2">Pending</span>
              <div className="btn-group">
                <button className="btn btn-sm btn-success" onClick={() => onUpdateStatus("approved")} title="Approve">✓</button>
                <button className="btn btn-sm btn-danger" onClick={() => onUpdateStatus("rejected")} title="Reject">✕</button>
              </div>
            </div>
          );
        case "approved":
          return <span className="badge bg-success">Approved</span>;
        case "rejected":
          return <span className="badge bg-danger">Rejected</span>;
        default:
          return <span className="badge bg-secondary">No Request</span>;
      }
    };

    return getStatusBadge();
  };

  const getFileUrl = (filePath: string | undefined): string => {
    if (!filePath) return "#";
    if (/^https?:\/\//.test(filePath)) return filePath;
    let sanitizedPath = filePath.startsWith("/uploads/")
      ? filePath
      : filePath.startsWith("uploads/")
        ? `/${filePath}`
        : `/uploads/${filePath.replace(/^\/+/, "")}`;
    return `${authenticityUtility.getBaseURL()}${sanitizedPath}`;
  };

  const handleEditRequestStatus = async (itemId: number, newStatus: string) => {
    try {
      let endpoint = '';
      if (newStatus === "approved") {
        endpoint = `/admin/edit-requests/${itemId}/approve`;
      } else if (newStatus === "rejected") {
        endpoint = `/admin/edit-requests/${itemId}/reject`;
      } else {
        const entityType = activeTab === "projects" ? "research_projects" : activeTab;
        endpoint = `/admin/edit-requests/${entityType}/${itemId}`;
      }
      const response = await authenticityUtility.patch(endpoint, { status: newStatus }) as { success?: boolean; message?: string };
      if (response.success) {
        alert(`Edit request ${newStatus} successfully`);
        fetchData();
      } else {
        setError(response.message || "Failed to update edit request status");
      }
    } catch (err: unknown) {
      console.error("Error updating edit request:", err);
      const error = err as { message?: string };
      setError(`Error updating edit request: ${error.message}`);
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatValue = (value: unknown, column: VisibleColumn, item: Project | Journal): React.ReactNode => {
    const formatCurrency = (amount: string | number): string => {
      const cleanAmount = typeof amount === "string" ? amount.replace(/,/g, "") : amount;
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(Number(cleanAmount) || 0);
    };

    const formatDateLocal = (dateString: string | undefined): string => {
      if (!dateString) return "-";
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        return "-";
      }
    };

    const projectItem = item as Project & Record<string, unknown>;
    const journalItem = item as Journal & Record<string, unknown>;

    switch (column.key) {
      case "status":
      case "publication_status":
        return (projectItem.status as string) || (projectItem.publication_status as string) || "-";

      case "submission_date":
      case "date_of_submission":
        return projectItem.date_of_submission ? formatDateLocal(projectItem.date_of_submission as string) : "-";

      case "author_names":
        return Array.isArray(journalItem.author_names) ? journalItem.author_names.join(", ") : "-";

      case "page_numbers":
        return projectItem.pages_from && projectItem.pages_to
          ? `${projectItem.pages_from}-${projectItem.pages_to}`
          : "-";

      case "publication_date":
        return formatDateLocal((projectItem.available_online_date as string) || (projectItem.publication_date as string));

      case "index_names":
        return journalItem.index_names ? journalItem.index_names.join(", ") : "-";

      case "citation_score":
        return (projectItem.cite_score as string) || (projectItem.citation_score as string) || "-";

      case "sanctioned_amount": {
        const amount = (projectItem.sanction_order_amount as string | number) || "0";
        return formatCurrency(amount);
      }

      case "start_date":
        return formatDateLocal(projectItem.project_duration_start_date as string);

      case "end_date":
        return formatDateLocal(projectItem.project_duration_end_date as string);

      case "investigators": {
        const teamMembers = projectItem.team_members as { name?: string }[] | undefined;
        if (!Array.isArray(teamMembers) || teamMembers.length === 0) return "-";
        return teamMembers.map((member) => member.name).filter(Boolean).join(", ");
      }

      case "collaborating_institute":
        return projectItem.is_collaboration_enabled ? "Yes" : "No";

      case "project_duration": {
        const duration: string[] = [];
        if (projectItem.duration_years) {
          duration.push(`${projectItem.duration_years} ${projectItem.duration_years === 1 ? "year" : "years"}`);
        }
        if (projectItem.duration_months) {
          duration.push(`${projectItem.duration_months} ${projectItem.duration_months === 1 ? "month" : "months"}`);
        }
        if (projectItem.duration_days) {
          duration.push(`${projectItem.duration_days} ${projectItem.duration_days === 1 ? "day" : "days"}`);
        }
        return duration.length > 0 ? duration.join(", ") : "-";
      }

      case "project_type":
        return (projectItem.project_category as string) || "-";

      case "edit_request_status":
        return (
          <EditRequestActions
            status={(item.edit_request_status as string) || "no_request"}
            onUpdateStatus={(newStatus) => handleEditRequestStatus(item.id, newStatus)}
            itemId={item.id}
          />
        );

      case "status_updates":
        return (
          <Button
            variant="outline-info"
            size="sm"
            onClick={() => {
              setSelectedJournalForStatus(item.id);
              setShowStatusDetailsModal(true);
            }}
            title="View Status Updates"
          >
            <FontAwesomeIcon icon={faEye} />
          </Button>
        );

      default:
        return (value as string) || "-";
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
    if (tabKey !== 'projects' && tabKey !== 'journals') return null;
    
    const columns = Object.entries(columnConfig[tabKey]);
    const groupedColumns = columns.reduce((acc, [key, config]) => {
      const group = config.group || "Other";
      if (!acc[group]) acc[group] = [];
      acc[group].push([key, config] as [string, ColumnConfigItem]);
      return acc;
    }, {} as Record<string, [string, ColumnConfigItem][]>);

    const groupOrder = ["Essential", ...Object.keys(groupedColumns).filter((g) => g !== "Essential").sort()];

    return (
      <div className="dropdown mb-3">
        <button
          className="btn btn-secondary dropdown-toggle"
          type="button"
          id="columnToggleDropdown"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          <i className="fas fa-columns me-1"></i> Configure Columns
        </button>
        <ul
          className="dropdown-menu p-2"
          style={{ minWidth: "250px", maxHeight: "70vh", overflowY: "auto" }}
          aria-labelledby="columnToggleDropdown"
        >
          {groupOrder.map((group) => (
            <div key={group}>
              {group !== "Essential" && (
                <li><hr className="dropdown-divider my-2" /></li>
              )}
              <li className="dropdown-header fw-bold text-dark mb-2">{group}</li>
              {groupedColumns[group]?.sort((a, b) => a[1].order - b[1].order).map(([key, config]) => (
                <li key={key} className="dropdown-item-text">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`column-toggle-${key}`}
                      checked={config.show}
                      onChange={() => toggleColumn(key)}
                      disabled={group === "Essential"}
                    />
                    <label
                      className={`form-check-label user-select-none ${group === "Essential" ? "text-muted" : ""}`}
                      htmlFor={`column-toggle-${key}`}
                      style={{ cursor: group === "Essential" ? "default" : "pointer" }}
                      title={group === "Essential" ? "Essential columns cannot be hidden" : ""}
                    >
                      {config.label}
                    </label>
                  </div>
                </li>
              ))}
            </div>
          ))}
        </ul>
      </div>
    );
  };

  const renderTable = () => {
    const items = activeTab === "projects" ? projects : journals;
    if (!items || items.length === 0) {
      return <div className="text-center p-3">No {activeTab} found</div>;
    }

    const visibleColumns = getVisibleColumns();

    return (
      <div className="table-responsive">
        {renderColumnToggleDropdown()}
        <DragDropContext onDragEnd={handleColumnReorder}>
          <table className="table table-striped">
            <Droppable droppableId="table-header" direction="horizontal">
              {(provided) => (
                <thead className="table-dark" ref={provided.innerRef} {...provided.droppableProps}>
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
                              ...darkHeaderCellStyle,
                              cursor: snapshot.isDragging ? "grabbing" : "grab",
                              padding: "12px 16px",
                              userSelect: "none",
                            }}
                          >
                            {column.label}
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

    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <li key={i} className={`page-item ${currentPage === i ? "active" : ""}`}>
          <button className="page-link" onClick={() => setCurrentPage(i)}>{i}</button>
        </li>
      );
    }

    return (
      <div className="d-flex justify-content-between align-items-center">
        <select
          className="form-select w-auto"
          value={itemsPerPage}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
        >
          <option value="5">5 per page</option>
          <option value="10">10 per page</option>
          <option value="20">20 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>
        <ul className="pagination mb-0">
          <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              Previous
            </button>
          </li>
          {pages}
          <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
              Next
            </button>
          </li>
        </ul>
      </div>
    );
  };

  const renderProjectDetails = () => {
    if (!selectedItem) return null;
    const project = selectedItem as Project & Record<string, unknown>;
    const financialContributions = (project.financial_contributions as unknown[]) || [];
    const collaboratingPartners = (project.collaborating_partners as unknown[]) || [];
    const documents = (project.documents as { document_type?: string; file_path?: string }[]) || [];
    const teamMembers = (project.team_members as { name?: string; is_principal?: boolean; is_primary?: boolean }[]) || [];
    const grantDisbursements = (project.grant_disbursements as unknown[]) || [];

    return (
      <div className="project-details">
        <h3 className="mb-4">{project.title}</h3>

        <div className="detail-section">
          <h4>Basic Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p><strong>Project Category:</strong> {project.project_category}</p>
              <p><strong>Agency:</strong> {project.agency}</p>
              <p><strong>Scheme:</strong> {project.scheme}</p>
              <p><strong>Category:</strong> {project.category as string}</p>
            </div>
            <div className="col-md-6">
              <p><strong>Duration:</strong> {project.duration_years as number} years, {project.duration_months as number} months, {project.duration_days as number} days</p>
              <p><strong>Application Number:</strong> {project.application_number as string}</p>
              <p><strong>Submission Status:</strong> {project.submission_status}</p>
              <p><strong>Date of Submission:</strong> {formatDate(project.date_of_submission)}</p>
              <p><strong>Outcomes:</strong> {(project.outcome_type as string)?.split(",").map((outcome: string) => outcome.trim()).join(", ")}</p>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Project Timeline</h4>
          <div className="row">
            <div className="col-md-6">
              <p><strong>Date of Presentation:</strong> {formatDate(project.date_of_presentation as string)}</p>
              <p><strong>Date of Result Announcement:</strong> {formatDate(project.date_of_result_announcement as string)}</p>
              <p><strong>Sanction Order Amount:</strong> ₹{project.sanction_order_amount as string}</p>
            </div>
            <div className="col-md-6">
              <p><strong>Sanction Order Date:</strong> {formatDate(project.sanction_order_date as string)}</p>
              <p><strong>Project Start Date:</strong> {formatDate(project.project_duration_start_date as string)}</p>
              <p><strong>Project End Date:</strong> {formatDate(project.project_duration_end_date as string)}</p>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Team Members</h4>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead><tr><th>Name</th><th>Role</th></tr></thead>
              <tbody>
                {teamMembers.map((member, index) => (
                  <tr key={index}>
                    <td>{member.name}</td>
                    <td>{member.is_principal ? "Principal Investigator" : member.is_primary ? "Primary Investigator" : "Co-Investigator"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="detail-section">
          <h4>Financial Contributions</h4>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead><tr><th>Agency Type</th><th>Agency</th><th>Amount</th></tr></thead>
              <tbody>
                {(financialContributions as { agency_type?: string; agency?: string; amount?: string }[]).map((contribution, index) => (
                  <tr key={index}>
                    <td>{contribution.agency_type}</td>
                    <td>{contribution.agency}</td>
                    <td>₹{contribution.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!!project.is_collaboration_enabled && collaboratingPartners.length > 0 && (
          <div className="detail-section">
            <h4>Collaborations</h4>
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead><tr><th>Partner</th><th>Address</th><th>Support Type</th></tr></thead>
                <tbody>
                  {(collaboratingPartners as { partner?: string; address?: string; support?: string }[]).map((collab, index) => (
                    <tr key={index}>
                      <td>{collab.partner}</td>
                      <td>{collab.address}</td>
                      <td>{collab.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {documents.length > 0 && (
          <div className="detail-section">
            <h4>Documents</h4>
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead><tr><th>Document Type</th><th>Action</th></tr></thead>
                <tbody>
                  {documents.map((doc, index) => (
                    <tr key={index}>
                      <td>{doc.document_type}</td>
                      <td>
                        <a href={getFileUrl(doc.file_path)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">View Document</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(project.file_path as string) && (
          <div className="detail-section">
            <h4>Journal Article</h4>
            <div className="row">
              <div className="col-md-4 mb-2">
                <a href={getFileUrl(project.file_path as string)} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm w-100">View Journal Article</a>
              </div>
            </div>
          </div>
        )}

        <div className="detail-section">
          <h4>Grant Disbursements</h4>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead><tr><th>Fiscal Year</th><th>Agency</th><th>Amount</th><th>Disbursement Date</th><th>Sanction Letter</th><th>UC/SoE</th></tr></thead>
              <tbody>
                {(grantDisbursements as { fiscal_year?: string; agency?: string; amount?: string; disbursement_date?: string; sanction_letter_path?: string; uc_soe_path?: string }[]).map((disbursement, index) => (
                  <tr key={index}>
                    <td>{disbursement.fiscal_year}</td>
                    <td>{disbursement.agency}</td>
                    <td>₹{disbursement.amount}</td>
                    <td>{formatDate(disbursement.disbursement_date)}</td>
                    <td>{disbursement.sanction_letter_path ? <a href={getFileUrl(disbursement.sanction_letter_path)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary">View</a> : "-"}</td>
                    <td>{disbursement.uc_soe_path ? <a href={getFileUrl(disbursement.uc_soe_path)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary">View</a> : "-"}</td>
                  </tr>
                ))}
                {grantDisbursements.length === 0 && (
                  <tr><td colSpan={6} className="text-center">No grant disbursements found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="detail-section">
          <h4>Edit Request Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p><strong>Status:</strong> {project.edit_request_status || "No Request"}</p>
              {(project.edit_request_comment as string) && <p><strong>Comment:</strong> {project.edit_request_comment as string}</p>}
              {(project.edit_request_date as string) && <p><strong>Request Date:</strong> {formatDate(project.edit_request_date as string)}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderJournalDetails = () => {
    if (!selectedItem) return null;
    const journal = selectedItem as Journal & Record<string, unknown>;
    
    let acknowledgements: string[] = [];
    try {
      if (journal.acknowledgement) {
        const ackData = typeof journal.acknowledgement === "string" ? JSON.parse(journal.acknowledgement as string) : journal.acknowledgement;
        acknowledgements = Object.entries(ackData as Record<string, boolean>).filter(([, value]) => value).map(([key]) => key);
      }
    } catch {
      console.error("Error parsing acknowledgement");
    }

    return (
      <div className="project-details">
        <h3 className="mb-4">{journal.title}</h3>

        <div className="detail-section">
          <h4>Basic Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p><strong>Journal Name:</strong> {journal.journal_name || "N/A"}</p>
              <p><strong>Category:</strong> {(journal.category as string) || "N/A"}</p>
              <p><strong>Publisher:</strong> {(journal.publisher as string) || "N/A"}</p>
            </div>
            <div className="col-md-6">
              <p><strong>Impact Factor:</strong> {(journal.impact_factor as string) || "N/A"}</p>
              <p><strong>Indexes:</strong> {journal.index_names ? journal.index_names.join(", ") : "N/A"}</p>
              <p><strong>Print:</strong> {(journal.print_issn as string) || "N/A"} <strong> Online: </strong> {(journal.online_issn as string) || "N/A"}</p>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Publication Details</h4>
          <div className="row">
            <div className="col-md-6">
              <p><strong>Volume:</strong> {(journal.volume as string) || "N/A"}</p>
              <p><strong>Issue:</strong> {(journal.issue as string) || "N/A"}</p>
              <p><strong>Page Range:</strong> {(journal.pages_from as string) && (journal.pages_to as string) ? `${journal.pages_from}-${journal.pages_to}` : "N/A"}</p>
            </div>
            <div className="col-md-6">
              <p><strong>DOI:</strong> {(journal.doi as string) || "N/A"}</p>
              <p><strong>Publication Date:</strong> {formatDate(journal.available_online_date as string) || "N/A"}</p>
              <p><strong>Publication Status:</strong> {(journal.status as string) || "N/A"}</p>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Authors & Acknowledgements</h4>
          <div className="row">
            <div className="col-md-6">
              <p><strong>Authors:</strong></p>
              <ul className="list-unstyled">
                {journal.author_names ? journal.author_names.map((author, index) => <li key={index}>{author.trim()}</li>) : <li>N/A</li>}
              </ul>
            </div>
            <div className="col-md-6">
              <p><strong>Acknowledgements:</strong></p>
              {acknowledgements.length > 0 ? (
                <ul className="list-unstyled">
                  {acknowledgements.map((ack, index) => <li key={index} className="badge bg-success me-2 mb-2">{ack}</li>)}
                </ul>
              ) : <p>N/A</p>}
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Documents</h4>
          <div className="row">
            {(journal.file_path as string) && (
              <div className="col-md-4 mb-2">
                <a href={getFileUrl(journal.file_path as string)} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm w-100">View Document</a>
              </div>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h4>Edit Request Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p><strong>Status:</strong> {journal.edit_request_status || "No Request"}</p>
              {(journal.edit_request_comment as string) && <p><strong>Comment:</strong> {journal.edit_request_comment as string}</p>}
              {(journal.edit_request_date as string) && <p><strong>Request Date:</strong> {formatDate(journal.edit_request_date as string)}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTableRow = (item: Project | Journal) => (
    <tr key={item.id}>
      {getVisibleColumns().map((column) => {
        if (column.key === "actions") {
          return (
            <td key={column.key}>
              <div className="btn-group">
                <button className="btn btn-sm btn-info me-1" onClick={() => handleViewDetails(item.id)} title="View Details">
                  <FontAwesomeIcon icon={faEye} />
                </button>
                <button className="btn btn-sm btn-primary me-1" title="Edit">
                  <FontAwesomeIcon icon={faEdit} />
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)} title="Delete">
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </td>
          );
        }
        return <td key={column.key}>{formatValue((item as Record<string, unknown>)[column.key], column, item)}</td>;
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
                <td>{request.user_name || "Unknown User"}</td>
                <td>
                  <span className={`badge bg-${request.request_type === "agency" ? "primary" : request.request_type === "scheme" ? "success" : request.request_type === "agency_type" ? "info" : "secondary"}`}>
                    {request.request_type.replace("_", " ").toUpperCase()}
                  </span>
                </td>
                <td>{request.name}</td>
                <td>{request.description || "-"}</td>
                <td>
                  <span className={`badge bg-${request.status === "pending" ? "warning" : request.status === "approved" ? "success" : "danger"}`}>
                    {request.status.toUpperCase()}
                  </span>
                </td>
                <td>{formatDate(request.created_at)}</td>
                <td>
                  {request.status === "pending" && (
                    <div className="btn-group" role="group">
                      <button className="btn btn-success btn-sm" onClick={() => handleApproveProjectRequest(request.id)} title="Approve">
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleRejectProjectRequest(request.id)} title="Reject">
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  )}
                  {request.status !== "pending" && (
                    <span className="text-muted small">{request.admin_comment ? `Comment: ${request.admin_comment}` : "No comment"}</span>
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
      <Navbar />
      <div className="dashboard-container">
        <div className="tab-buttons">
          <div className={`tab-button ${activeTab === "projects" ? "active" : ""}`} onClick={() => { setActiveTab("projects"); setCurrentPage(1); }}>Projects</div>
          <div className={`tab-button ${activeTab === "journals" ? "active" : ""}`} onClick={() => { setActiveTab("journals"); setCurrentPage(1); }}>Journals</div>
          <div className={`tab-button ${activeTab === "journal-requests" ? "active" : ""}`} onClick={() => { setActiveTab("journal-requests"); setCurrentPage(1); }}>Journal Requests</div>
          <div className={`tab-button ${activeTab === "project-requests" ? "active" : ""}`} onClick={() => { setActiveTab("project-requests"); setCurrentPage(1); }}>Project Requests</div>
          <div className={`tab-button ${activeTab === "journal-status-updates" ? "active" : ""}`} onClick={() => { setActiveTab("journal-status-updates"); setCurrentPage(1); }}>Journal Status Updates</div>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            {(activeTab === "projects" || activeTab === "journals") && (
              <>
                <div className="table-container">{renderTable()}</div>
                {renderPagination()}
                {activeTab === "journals" && <div className="journal-management-container"><JournalManagement /></div>}
                {activeTab === "projects" && <div className="project-management-container"><ProjectFormOptions /></div>}
              </>
            )}
            {activeTab === "journal-requests" && <div className="table-container">{renderJournalRequestsTable()}</div>}
            {activeTab === "project-requests" && <div className="table-container">{renderProjectRequestsTable()}</div>}
            {activeTab === "journal-status-updates" && <div className="table-container"><JournalStatusUpdates /></div>}
          </>
        )}

        <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" className="details-modal">
          <Modal.Header closeButton>
            <Modal.Title>{activeTab === "projects" ? "Project Details" : "Journal Details"}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="modal-body-scroll">
            {activeTab === "projects" ? renderProjectDetails() : renderJournalDetails()}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
          </Modal.Footer>
        </Modal>

        <JournalStatusDetails journalId={selectedJournalForStatus} show={showStatusDetailsModal} onHide={() => { setShowStatusDetailsModal(false); setSelectedJournalForStatus(null); }} />
      </div>
    </div>
  );
};

export default Dashboard;
