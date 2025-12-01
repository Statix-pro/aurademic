import React, { useState, useEffect, useCallback } from "react";
import authenticityUtility from "../utility/authenticityUtility.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faTrash,
  faEye,
  faCheck,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { Modal, Button } from "react-bootstrap";
import Navbar from "../components/navbar/navbar.jsx";
import "./admindashboard.css";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import JournalManagement from "./formManagement/JournalFormOptions.jsx";
import ProjectFormOptions from "./formManagement/ProjectFormOptions";
import JournalStatusUpdates from "./components/JournalStatusUpdates.jsx";
import JournalStatusDetails from "./components/JournalStatusDetails.jsx";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("projects");
  const [projects, setProjects] = useState([]);
  const [journals, setJournals] = useState([]);
  const [journalRequests, setJournalRequests] = useState([]);
  const [projectRequests, setProjectRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems] = useState(0);
  const [adminComment, setAdminComment] = useState("");
  const [showStatusDetailsModal, setShowStatusDetailsModal] = useState(false);
  const [selectedJournalForStatus, setSelectedJournalForStatus] =
    useState(null);

  const [columnConfig, setColumnConfig] = useState(() => {
    const savedConfig = localStorage.getItem("columnConfig");
    return savedConfig
      ? JSON.parse(savedConfig)
      : {
          projects: {
            title: { show: true, order: 0, label: "Title", group: "Essential" },
            project_category: {
              show: true,
              order: 1,
              label: "Category",
              group: "Essential",
            },
            agency: {
              show: true,
              order: 2,
              label: "Agency",
              group: "Essential",
            },
            scheme: {
              show: true,
              order: 3,
              label: "Scheme",
              group: "Essential",
            },
            submission_status: {
              show: true,
              order: 4,
              label: "Status",
              group: "Essential",
            },
            date_of_submission: {
              show: true,
              order: 5,
              label: "Submission Date",
              group: "Essential",
            },
            project_type: {
              show: false,
              order: 6,
              label: "Project Type",
              group: "Details",
            },
            project_duration: {
              show: false,
              order: 7,
              label: "Duration",
              group: "Details",
            },
            // total_cost: { show: false, order: 8, label: 'Total Cost (₹)', group: 'Financial' },
            sanctioned_amount: {
              show: false,
              order: 9,
              label: "Sanctioned Amount (₹)",
              group: "Financial",
            },
            // received_amount: { show: false, order: 10, label: 'Received Amount (₹)', group: 'Financial' },
            start_date: {
              show: false,
              order: 11,
              label: "Start Date",
              group: "Timeline",
            },
            end_date: {
              show: false,
              order: 12,
              label: "End Date",
              group: "Timeline",
            },
            investigators: {
              show: false,
              order: 13,
              label: "Investigators",
              group: "Team",
            },
            collaborating_institute: {
              show: false,
              order: 14,
              label: "Collaborating Institute",
              group: "Team",
            },
            // funding_agency: { show: false, order: 15, label: 'Funding Agency', group: 'Team' },
            // remarks: { show: false, order: 16, label: 'Remarks', group: 'Details' },
            edit_request_status: {
              show: true,
              order: 18,
              label: "Edit Request",
              group: "Essential",
            },
            actions: {
              show: true,
              order: 19,
              label: "Actions",
              group: "Essential",
            },
          },
          journals: {
            title: { show: true, order: 0, label: "Title", group: "Essential" },
            journal_name: {
              show: true,
              order: 1,
              label: "Journal Name",
              group: "Essential",
            },
            publication_status: {
              show: true,
              order: 2,
              label: "Status",
              group: "Essential",
            },
            submission_date: {
              show: true,
              order: 3,
              label: "Submission Date",
              group: "Essential",
            },
            author_names: {
              show: true,
              order: 4,
              label: "Authors",
              group: "Details",
            }, // Added author_names
            //  impact_factor: { show: false, order: 5, label: 'Impact Factor', group: 'Metrics' },
            volume: {
              show: false,
              order: 6,
              label: "Volume",
              group: "Details",
            },
            issue: { show: false, order: 7, label: "Issue", group: "Details" },
            page_numbers: {
              show: false,
              order: 8,
              label: "Page Numbers",
              group: "Details",
            },
            doi: { show: false, order: 9, label: "DOI", group: "Details" },
            publication_date: {
              show: false,
              order: 10,
              label: "Publication Date",
              group: "Timeline",
            },
            publisher: {
              show: false,
              order: 11,
              label: "Publisher",
              group: "Details",
            },
            index_names: {
              show: true,
              order: 12,
              label: "Indexing",
              group: "Metrics",
            }, // Added index_names
            // citation_score: { show: false, order: 13, label: 'Citation Score', group: 'Metrics' },
            edit_request_status: {
              show: true,
              order: 17,
              label: "Edit Request",
              group: "Essential",
            },
            status_updates: {
              show: true,
              order: 18,
              label: "Status Updates",
              group: "Essential",
            },
            actions: {
              show: true,
              order: 19,
              label: "Actions",
              group: "Essential",
            },
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

      let endpoint;
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
      });
      const data = response.data;

      if (activeTab === "projects") {
        setProjects(Array.isArray(data) ? data : []);
      } else if (activeTab === "journals") {
        setJournals(Array.isArray(data) ? data : []);
      } else if (activeTab === "journal-requests") {
        setJournalRequests(Array.isArray(data) ? data : []);
      } else if (activeTab === "project-requests") {
        setProjectRequests(Array.isArray(data) ? data : []);
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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      await authenticityUtility.delete(`/${activeTab}/${id}`);
      fetchData();
    } catch (err) {
      setError("Error deleting item: " + err.message);
    }
  };
  const handleApproveJournalRequest = async (requestId) => {
    try {
      const response = await authenticityUtility.patch(
        `/admin/journal-requests/${requestId}/approve`,
        {
          admin_comment: adminComment,
        },
      );

      if (response.success) {
        alert("Journal request approved successfully!");
        fetchData();
        setAdminComment("");
      } else {
        setError(response.message || "Failed to approve journal request");
      }
    } catch (err) {
      console.error("Error approving journal request:", err);
      setError("Error approving journal request: " + err.message);
    }
  };

  const handleRejectJournalRequest = async (requestId) => {
    try {
      const response = await authenticityUtility.patch(
        `/admin/journal-requests/${requestId}/reject`,
        {
          admin_comment: adminComment,
        },
      );

      if (response.success) {
        alert("Journal request rejected successfully!");
        fetchData();
        setAdminComment("");
      } else {
        setError(response.message || "Failed to reject journal request");
      }
    } catch (err) {
      console.error("Error rejecting journal request:", err);
      setError("Error rejecting journal request: " + err.message);
    }
  };
  const darkHeaderCellStyle = {
    backgroundColor: "#323a40",
    color: "#ffffff",
    borderBottom: "2px solid #dee2e6",
  };

  const handleViewDetails = async (id) => {
    try {
      const response = await authenticityUtility.get(
        `/admin/${activeTab}/${id}`,
      );
      setSelectedItem(response.data);
      setShowModal(true);
    } catch (err) {
      setError("Error fetching details: " + err.message);
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
                  <span
                    className={`badge bg-${request.category === "International" ? "primary" : "secondary"}`}
                  >
                    {request.category || "National"}
                  </span>
                </td>
                <td>{request.publisher || "-"}</td>
                <td>{request.website || "-"}</td>
                <td>{request.print_issn || "-"}</td>
                <td>{request.online_issn || "-"}</td>
                <td>{request.user_name}</td>
                <td>
                  <span
                    className={`badge bg-${request.status === "pending" ? "warning" : request.status === "approved" ? "success" : "danger"}`}
                  >
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

  // Add project request management functions
  const handleApproveProjectRequest = async (requestId) => {
    try {
      const response = await authenticityUtility.patch(
        `/admin/project-requests/${requestId}/approve`,
        {
          admin_comment: adminComment,
        },
      );

      if (response.status === "success") {
        alert("Project request approved successfully!");
        setAdminComment("");
        fetchData(); // Refresh the data
      } else {
        alert(response.message || "Failed to approve project request");
      }
    } catch (error) {
      console.error("Error approving project request:", error);
      alert(
        error.response?.data?.message || "Failed to approve project request",
      );
    }
  };

  const handleRejectProjectRequest = async (requestId) => {
    if (!adminComment.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    try {
      const response = await authenticityUtility.patch(
        `/admin/project-requests/${requestId}/reject`,
        {
          admin_comment: adminComment,
        },
      );

      if (response.status === "success") {
        alert("Project request rejected successfully!");
        setAdminComment("");
        fetchData(); // Refresh the data
      } else {
        alert(response.message || "Failed to reject project request");
      }
    } catch (error) {
      console.error("Error rejecting project request:", error);
      alert(
        error.response?.data?.message || "Failed to reject project request",
      );
    }
  };

  const EditRequestActions = ({ status, onUpdateStatus, itemId }) => {
    const getStatusBadge = () => {
      const currentStatus = status || "no_request";
      switch (currentStatus) {
        case "pending":
          return (
            <div className="d-flex align-items-center">
              <span className="badge bg-warning me-2">Pending</span>
              <div className="btn-group">
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => onUpdateStatus("approved")}
                  title="Approve"
                >
                  ✓
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => onUpdateStatus("rejected")}
                  title="Reject"
                >
                  ✕
                </button>
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

  const getFileUrl = (filePath) => {
    if (!filePath) return "#";
    // If already a full URL, return as is
    if (/^https?:\/\//.test(filePath)) return filePath;
    // Ensure path starts with /uploads/
    let sanitizedPath = filePath.startsWith("/uploads/")
      ? filePath
      : filePath.startsWith("uploads/")
        ? `/${filePath}`
        : `/uploads/${filePath.replace(/^\/+/, "")}`;
    return `${authenticityUtility.getBaseURL()}${sanitizedPath}`;
  };

  const handleEditRequestStatus = async (itemId, newStatus) => {
    try {
      // const entityType = activeTab === 'projects' ? 'research_projects' : activeTab;
      let endpoint;
      if (newStatus === "approved") {
        endpoint = `/admin/edit-requests/${itemId}/approve`;
      } else if (newStatus === "rejected") {
        endpoint = `/admin/edit-requests/${itemId}/reject`;
      } else {
        // For general admin updates (if needed)
        const entityType =
          activeTab === "projects" ? "research_projects" : activeTab;
        endpoint = `/admin/edit-requests/${entityType}/${itemId}`; // Not recommended; use distinct routes
      }
      console.log("PATCH endpoint:", endpoint); // Add this line for debugging
      const response = await authenticityUtility.patch(endpoint, {
        status: newStatus,
      });
      if (response.success) {
        // Show success message
        alert(`Edit request ${newStatus} successfully`);
        // Refresh data
        fetchData();
      } else {
        setError(response.message || "Failed to update edit request status");
      }
    } catch (err) {
      console.error("Error updating edit request:", err);
      setError(`Error updating edit request: ${err.message}`);
    }
  };
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatValue = (value, column, item) => {
    const formatCurrency = (amount) => {
      // Handle string amounts that might have commas
      const cleanAmount =
        typeof amount === "string" ? amount.replace(/,/g, "") : amount;
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(Number(cleanAmount) || 0);
    };

    const formatDate = (dateString) => {
      if (!dateString) return "-";
      try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch (e) {
        console.error("Date formatting error:", e);
        return "-";
      }
    };

    // Handle special cases where data might be nested or needs special formatting
    switch (column.key) {
      case "status":
      case "publication_status":
        return item.status || item.publication_status || "-";

      case "submission_date":
      case "date_of_submission":
        return item.date_of_submission
          ? formatDate(item.date_of_submission)
          : "-";

      case "author_names":
        return Array.isArray(item.author_names)
          ? item.author_names.join(", ")
          : "-";

      case "page_numbers":
        return item.pages_from && item.pages_to
          ? `${item.pages_from}-${item.pages_to}`
          : "-";

      case "publication_date":
        return formatDate(item.available_online_date || item.publication_date);

      case "index_names":
        return item.index_names ? item.index_names.join(", ") : "-";

      case "citation_score":
        return item.cite_score || item.citation_score || "-";

      case "sanctioned_amount": {
        const amount = item.sanction_order_amount || "0";
        return formatCurrency(amount);
      }

      case "start_date": {
        return formatDate(item.project_duration_start_date);
      }

      case "end_date": {
        return formatDate(item.project_duration_end_date);
      }

      case "investigators": {
        if (!Array.isArray(item.team_members) || item.team_members.length === 0)
          return "-";

        return item.team_members
          .map((member) => member.name)
          .filter(Boolean)
          .join(", ");
      }
      case "collaborating_institute":
        return item.is_collaboration_enabled ? "Yes" : "No";

      case "project_duration":
        const duration = [];
        if (item.duration_years) {
          duration.push(
            `${item.duration_years} ${item.duration_years === 1 ? "year" : "years"}`,
          );
        }
        if (item.duration_months) {
          duration.push(
            `${item.duration_months} ${item.duration_months === 1 ? "month" : "months"}`,
          );
        }
        if (item.duration_days) {
          duration.push(
            `${item.duration_days} ${item.duration_days === 1 ? "day" : "days"}`,
          );
        }
        return duration.length > 0 ? duration.join(", ") : "-";

      case "project_type":
        return item.project_category || "-";

      case "edit_request_status":
        return (
          <EditRequestActions
            status={item.edit_request_status || "no_request"}
            onUpdateStatus={(newStatus) =>
              handleEditRequestStatus(item.id, newStatus)
            }
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
        return value || "-";
    }
  };

  const handleColumnReorder = (result) => {
    // console.log('Drag result:', result);

    // If there's no destination or source is same as destination, skip
    if (
      !result.destination ||
      result.destination.index === result.source.index
    ) {
      // console.log('Invalid drag - no change needed');
      return;
    }

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    // console.log(`Moving column from index ${sourceIndex} to ${destIndex}`);

    setColumnConfig((prevConfig) => {
      const newConfig = { ...prevConfig };
      const currentTabConfig = { ...newConfig[activeTab] };

      // Get sorted array of column keys
      const columnKeys = Object.keys(currentTabConfig)
        .filter((key) => currentTabConfig[key].show)
        .sort((a, b) => currentTabConfig[a].order - currentTabConfig[b].order);

      // console.log('Current column order:', columnKeys);

      // Move the column key
      const [movedKey] = columnKeys.splice(sourceIndex, 1);
      columnKeys.splice(destIndex, 0, movedKey);

      // console.log('New column order:', columnKeys);

      // Update orders in the config
      columnKeys.forEach((key, index) => {
        currentTabConfig[key] = {
          ...currentTabConfig[key],
          order: index,
        };
      });

      newConfig[activeTab] = currentTabConfig;
      return newConfig;
    });
  };

  const toggleColumn = (columnKey) => {
    // console.log('Toggling column:', columnKey);
    setColumnConfig((prev) => {
      const newConfig = {
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          [columnKey]: {
            ...prev[activeTab][columnKey],
            show: !prev[activeTab][columnKey].show,
          },
        },
      };
      // console.log('New config:', newConfig);
      return newConfig;
    });
  };

  const getVisibleColumns = () => {
    const visibleColumns = Object.entries(columnConfig[activeTab])
      .filter(([, config]) => config.show)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, config]) => ({
        key,
        ...config,
      }));

    return visibleColumns;
  };

  const renderColumnToggleDropdown = () => {
    const columns = Object.entries(columnConfig[activeTab]);
    const groupedColumns = columns.reduce((acc, [key, config]) => {
      const group = config.group || "Other";
      if (!acc[group]) acc[group] = [];
      acc[group].push([key, config]);
      return acc;
    }, {});

    const groupOrder = [
      "Essential",
      ...Object.keys(groupedColumns)
        .filter((g) => g !== "Essential")
        .sort(),
    ];

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
          style={{
            minWidth: "250px",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
          aria-labelledby="columnToggleDropdown"
        >
          {groupOrder.map((group) => (
            <div key={group}>
              {group !== "Essential" && (
                <li>
                  <hr className="dropdown-divider my-2" />
                </li>
              )}
              <li className="dropdown-header fw-bold text-dark mb-2">
                {group}
              </li>
              {groupedColumns[group]
                ?.sort((a, b) => a[1].order - b[1].order)
                .map(([key, config]) => (
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
                        style={{
                          cursor: group === "Essential" ? "default" : "pointer",
                        }}
                        title={
                          group === "Essential"
                            ? "Essential columns cannot be hidden"
                            : ""
                        }
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
    // console.log('Visible columns:', visibleColumns);

    return (
      <div className="table-responsive">
        {renderColumnToggleDropdown()}
        <DragDropContext onDragEnd={handleColumnReorder}>
          <table className="table table-striped">
            <Droppable droppableId="table-header" direction="horizontal">
              {(provided, snapshot) => (
                <thead
                  className="table-dark"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <tr>
                    {visibleColumns.map((column, index) => (
                      <Draggable
                        key={column.key}
                        draggableId={column.key}
                        index={index}
                      >
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
    const pages = [];

    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <li
          key={i}
          className={`page-item ${currentPage === i ? "active" : ""}`}
        >
          <button className="page-link" onClick={() => setCurrentPage(i)}>
            {i}
          </button>
        </li>,
      );
    }

    return (
      <div className="d-flex justify-content-between align-items-center">
        <select
          className="form-select w-auto"
          value={itemsPerPage}
          onChange={(e) => {
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
            <button
              className="page-link"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
          </li>
          {pages}
          <li
            className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}
          >
            <button
              className="page-link"
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </li>
        </ul>
      </div>
    );
  };

  const renderProjectDetails = () => {
    if (!selectedItem) return null;
    const financialContributions = selectedItem.financial_contributions || [];
    const collaboratingPartners = selectedItem.collaborating_partners || [];
    const documents = selectedItem.documents || [];
    const teamMembers = selectedItem.team_members || [];

    return (
      <div className="project-details">
        <h3 className="mb-4">{selectedItem.title}</h3>

        <div className="detail-section">
          <h4>Basic Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Project Category:</strong>{" "}
                {selectedItem.project_category}
              </p>
              <p>
                <strong>Agency:</strong> {selectedItem.agency}
              </p>
              <p>
                <strong>Scheme:</strong> {selectedItem.scheme}
              </p>
              <p>
                <strong>Category:</strong> {selectedItem.category}
              </p>
            </div>
            <div className="col-md-6">
              <p>
                <strong>Duration:</strong> {selectedItem.duration_years} years,{" "}
                {selectedItem.duration_months} months,{" "}
                {selectedItem.duration_days} days
              </p>
              <p>
                <strong>Application Number:</strong>{" "}
                {selectedItem.application_number}
              </p>
              <p>
                <strong>Submission Status:</strong>{" "}
                {selectedItem.submission_status}
              </p>
              <p>
                <strong>Date of Submission:</strong>{" "}
                {formatDate(selectedItem.date_of_submission)}
              </p>
              <p>
                <strong>Outcomes:</strong>{" "}
                {selectedItem.outcome_type
                  .split(",")
                  .map((outcome) => outcome.trim())
                  .join(", ")}
              </p>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Project Timeline</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Date of Presentation:</strong>{" "}
                {formatDate(selectedItem.date_of_presentation)}
              </p>
              <p>
                <strong>Date of Result Announcement:</strong>{" "}
                {formatDate(selectedItem.date_of_result_announcement)}
              </p>
              <p>
                <strong>Sanction Order Amount:</strong> ₹
                {selectedItem.sanction_order_amount}
              </p>
            </div>
            <div className="col-md-6">
              <p>
                <strong>Sanction Order Date:</strong>{" "}
                {formatDate(selectedItem.sanction_order_date)}
              </p>
              <p>
                <strong>Project Start Date:</strong>{" "}
                {formatDate(selectedItem.project_duration_start_date)}
              </p>
              <p>
                <strong>Project End Date:</strong>{" "}
                {formatDate(selectedItem.project_duration_end_date)}
              </p>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Team Members</h4>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member, index) => (
                  <tr key={index}>
                    <td>{member.name}</td>
                    <td>
                      {member.is_principal
                        ? "Principal Investigator"
                        : member.is_primary
                          ? "Primary Investigator"
                          : "Co-Investigator"}
                    </td>
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
              <thead>
                <tr>
                  <th>Agency Type</th>
                  <th>Agency</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {financialContributions.map((contribution, index) => (
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

        {selectedItem.is_collaboration_enabled &&
          collaboratingPartners.length > 0 && (
            <div className="detail-section">
              <h4>Collaborations</h4>
              <div className="table-responsive">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Partner</th>
                      <th>Address</th>
                      <th>Support Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collaboratingPartners.map((collab, index) => (
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
                <thead>
                  <tr>
                    <th>Document Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, index) => (
                    <tr key={index}>
                      <td>{doc.document_type}</td>
                      <td>
                        {console.log(
                          "Document URL:",
                          getFileUrl(doc.file_path),
                        )}
                        <a
                          href={getFileUrl(doc.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-primary"
                        >
                          View Document
                        </a>
                        {console.log("Document Path:", doc.file_path)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedItem.file_path && (
          <div className="detail-section">
            <h4>Journal Article</h4>
            <div className="row">
              <div className="col-md-4 mb-2">
                <a
                  href={getFileUrl(selectedItem.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-primary btn-sm w-100"
                >
                  View Journal Article
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="detail-section">
          <h4>Grant Disbursements</h4>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Fiscal Year</th>
                  <th>Agency</th>
                  <th>Amount</th>
                  <th>Disbursement Date</th>
                  <th>Sanction Letter</th>
                  <th>UC/SoE</th>
                </tr>
              </thead>
              <tbody>
                {selectedItem.grant_disbursements &&
                  selectedItem.grant_disbursements.map(
                    (disbursement, index) => (
                      <tr key={index}>
                        <td>{disbursement.fiscal_year}</td>
                        <td>{disbursement.agency}</td>
                        <td>₹{disbursement.amount}</td>
                        <td>{formatDate(disbursement.disbursement_date)}</td>
                        <td>
                          {disbursement.sanction_letter_path ? (
                            <a
                              href={getFileUrl(
                                disbursement.sanction_letter_path,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-secondary"
                            >
                              View
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        {/* Render UC/SoE link */}
                        <td>
                          {disbursement.uc_soe_path ? (
                            <a
                              href={getFileUrl(disbursement.uc_soe_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-secondary"
                            >
                              View
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                {(!selectedItem.grant_disbursements ||
                  selectedItem.grant_disbursements.length === 0) && (
                  <tr>
                    <td colSpan="4" className="text-center">
                      No grant disbursements found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="detail-section">
          <h4>Edit Request Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Status:</strong>{" "}
                {selectedItem.edit_request_status || "No Request"}
              </p>
              {selectedItem.edit_request_comment && (
                <p>
                  <strong>Comment:</strong> {selectedItem.edit_request_comment}
                </p>
              )}
              {selectedItem.edit_request_date && (
                <p>
                  <strong>Request Date:</strong>{" "}
                  {formatDate(selectedItem.edit_request_date)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderJournalDetails = () => {
    if (!selectedItem) return null;
    let acknowledgements = [];
    try {
      if (selectedItem.acknowledgement) {
        const ackData =
          typeof selectedItem.acknowledgement === "string"
            ? JSON.parse(selectedItem.acknowledgement)
            : selectedItem.acknowledgement;
        acknowledgements = Object.entries(ackData)
          .filter(([_, value]) => value)
          .map(([key]) => key);
      }
    } catch (error) {
      console.error("Error parsing acknowledgement:", error);
    }

    return (
      <div className="project-details">
        <h3 className="mb-4">{selectedItem.title}</h3>

        <div className="detail-section">
          <h4>Basic Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Journal Name:</strong>{" "}
                {selectedItem.journal_name || "N/A"}
              </p>
              <p>
                <strong>Category:</strong> {selectedItem.category || "N/A"}
              </p>
              <p>
                <strong>Publisher:</strong> {selectedItem.publisher || "N/A"}
              </p>
            </div>
            <div className="col-md-6">
              <p>
                <strong>Impact Factor:</strong>{" "}
                {selectedItem.impact_factor || "N/A"}
              </p>
              <p>
                <strong>Indexes:</strong>{" "}
                {selectedItem.index_names
                  ? selectedItem.index_names.join(", ")
                  : "N/A"}
              </p>
              <p>
                <strong>Print:</strong> {selectedItem.print_issn || "N/A"}
                <strong> Online: </strong> {selectedItem.online_issn || "N/A"}
              </p>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Publication Details</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Volume:</strong> {selectedItem.volume || "N/A"}
              </p>
              <p>
                <strong>Issue:</strong> {selectedItem.issue || "N/A"}
              </p>
              <p>
                <strong>Page Range:</strong>{" "}
                {selectedItem.pages_from && selectedItem.pages_to
                  ? `${selectedItem.pages_from}-${selectedItem.pages_to}`
                  : "N/A"}
              </p>
            </div>
            <div className="col-md-6">
              <p>
                <strong>DOI:</strong> {selectedItem.doi || "N/A"}
              </p>
              <p>
                <strong>Publication Date:</strong>{" "}
                {formatDate(selectedItem.available_online_date) || "N/A"}
              </p>
              <p>
                <strong>Publication Status:</strong>{" "}
                {selectedItem.status || "N/A"}
              </p>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Authors & Acknowledgements</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Authors:</strong>
              </p>
              <ul className="list-unstyled">
                {selectedItem.author_names ? (
                  selectedItem.author_names.map((author, index) => (
                    <li key={index}>{author.trim()}</li>
                  ))
                ) : (
                  <li>N/A</li>
                )}
              </ul>
            </div>
            <div className="col-md-6">
              <p>
                <strong>Acknowledgements:</strong>
              </p>
              {acknowledgements.length > 0 ? (
                <ul className="list-unstyled">
                  {acknowledgements.map((ack, index) => (
                    <li key={index} className="badge bg-success me-2 mb-2">
                      {ack}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>N/A</p>
              )}
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Documents</h4>
          <div className="row">
            {selectedItem.file_path && (
              <div className="col-md-4 mb-2">
                <a
                  href={getFileUrl(selectedItem.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-primary btn-sm w-100"
                >
                  View Document
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h4>Edit Request Information</h4>
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>Status:</strong>{" "}
                {selectedItem.edit_request_status || "No Request"}
              </p>
              {selectedItem.edit_request_comment && (
                <p>
                  <strong>Comment:</strong> {selectedItem.edit_request_comment}
                </p>
              )}
              {selectedItem.edit_request_date && (
                <p>
                  <strong>Request Date:</strong>{" "}
                  {formatDate(selectedItem.edit_request_date)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTableRow = (item) => (
    <tr key={item.id}>
      {getVisibleColumns().map((column) => {
        if (column.key === "actions") {
          return (
            <td key={column.key}>
              <div className="btn-group">
                <button
                  className="btn btn-sm btn-info me-1"
                  onClick={() => handleViewDetails(item.id)}
                  title="View Details"
                >
                  <FontAwesomeIcon icon={faEye} />
                </button>
                <button className="btn btn-sm btn-primary me-1" title="Edit">
                  <FontAwesomeIcon icon={faEdit} />
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(item.id)}
                  title="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </td>
          );
        }

        return (
          <td key={column.key}>
            {formatValue(item[column.key], column, item)}
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
                <td>{request.user_name || "Unknown User"}</td>
                <td>
                  <span
                    className={`badge bg-${
                      request.request_type === "agency"
                        ? "primary"
                        : request.request_type === "scheme"
                          ? "success"
                          : request.request_type === "agency_type"
                            ? "info"
                            : "secondary"
                    }`}
                  >
                    {request.request_type.replace("_", " ").toUpperCase()}
                  </span>
                </td>
                <td>{request.name}</td>
                <td>{request.description || "-"}</td>
                <td>
                  <span
                    className={`badge bg-${
                      request.status === "pending"
                        ? "warning"
                        : request.status === "approved"
                          ? "success"
                          : "danger"
                    }`}
                  >
                    {request.status.toUpperCase()}
                  </span>
                </td>
                <td>{formatDate(request.created_at)}</td>
                <td>
                  {request.status === "pending" && (
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleApproveProjectRequest(request.id)}
                        title="Approve"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRejectProjectRequest(request.id)}
                        title="Reject"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  )}
                  {request.status !== "pending" && (
                    <span className="text-muted small">
                      {request.admin_comment
                        ? `Comment: ${request.admin_comment}`
                        : "No comment"}
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
    // <div className="dashboard-container">
    <div>
      <Navbar />
      <div className="dashboard-container">
        {/* Removed Navbar for brevity, you can keep it if you need it */}
        <div className="tab-buttons">
          <div
            className={`tab-button ${activeTab === "projects" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("projects");
              setCurrentPage(1); // Optional: Reset page
            }}
          >
            Projects
          </div>
          <div
            className={`tab-button ${activeTab === "journals" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("journals");
              setCurrentPage(1); // Optional: Reset page
            }}
          >
            Journals
          </div>
          <div
            className={`tab-button ${activeTab === "journal-requests" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("journal-requests");
              setCurrentPage(1);
            }}
          >
            Journal Requests
          </div>
          <div
            className={`tab-button ${activeTab === "project-requests" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("project-requests");
              setCurrentPage(1);
            }}
          >
            Project Requests
          </div>
          <div
            className={`tab-button ${activeTab === "journal-status-updates" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("journal-status-updates");
              setCurrentPage(1);
            }}
          >
            Journal Status Updates
          </div>
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
                {activeTab === "journals" && (
                  <div className="journal-management-container">
                    <JournalManagement />
                  </div>
                )}
                {activeTab === "projects" && (
                  <div className="project-management-container">
                    <ProjectFormOptions />
                  </div>
                )}
              </>
            )}

            {/* Show Journal Requests table */}
            {activeTab === "journal-requests" && (
              <div className="table-container">
                {renderJournalRequestsTable()}
              </div>
            )}

            {/* Show Project Requests table */}
            {activeTab === "project-requests" && (
              <div className="table-container">
                {renderProjectRequestsTable()}
              </div>
            )}

            {/* Show Journal Status Updates */}
            {activeTab === "journal-status-updates" && (
              <div className="table-container">
                <JournalStatusUpdates />
              </div>
            )}
          </>
        )}

        {/* Modals remain outside the conditional logic so they can be shown from any tab */}
        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          size="lg"
          className="details-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              {activeTab === "projects" ? "Project Details" : "Journal Details"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="modal-body-scroll">
            {activeTab === "projects"
              ? renderProjectDetails()
              : renderJournalDetails()}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Journal Status Details Modal */}
        <JournalStatusDetails
          journalId={selectedJournalForStatus}
          show={showStatusDetailsModal}
          onHide={() => {
            setShowStatusDetailsModal(false);
            setSelectedJournalForStatus(null);
          }}
        />
      </div>
    </div>
  );
};

export default Dashboard;
