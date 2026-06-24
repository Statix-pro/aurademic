import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import "./workorderdashboard.css";

type WorkOrderPriority = "High" | "Medium" | "Low" | "Routine";
type WorkOrderStatus = "Pending" | "In Progress" | "Completed";

const WORK_ORDER_STORAGE_KEY = "ksrct_workorder_submissions";

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
  qty: number;
  priority: string;
  locationPhotos: StoredWorkOrderPhoto[];
  descriptionPhotos: StoredWorkOrderPhoto[];
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
  date: string;
  nature: string;
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
  details: string[];
  photos: WorkOrderPhoto[];
}

const statusOptions = ["All", "Pending", "In Progress", "Completed"];
const priorityOptions = ["All", "High", "Medium", "Low", "Routine"];

const formatDisplayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getInitials = (name: string) => {
  const clean = String(name || "").trim();
  if (!clean) return "NA";
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const normalizePriority = (priority: string): WorkOrderPriority => {
  const value = String(priority || "").trim().toLowerCase();
  if (value === "high") return "High";
  if (value === "routine") return "Routine";
  if (value === "low") return "Low";
  return "Medium";
};

const readStoredSubmissions = (): StoredWorkOrderSubmission[] => {
  try {
    const raw = window.localStorage.getItem(WORK_ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read saved work orders:", error);
    return [];
  }
};

const mapSubmissionsToRows = (submissions: StoredWorkOrderSubmission[]): WorkOrderItem[] => {
  return submissions
    .flatMap((submission) =>
      (Array.isArray(submission.workItems) ? submission.workItems : []).map((item) => {
        const photos = [
          ...(Array.isArray(item.locationPhotos) ? item.locationPhotos : []),
          ...(Array.isArray(item.descriptionPhotos) ? item.descriptionPhotos : []),
        ];

        return {
          id: `${submission.id}-${item.id}`,
          date: submission.date || submission.submittedAt?.slice(0, 10) || "",
          nature: submission.category || item.type || "-",
          workType: item.type || "-",
          block: item.block || "-",
          floor: item.floor || "-",
          room: item.roomLabNo || "-",
          items: Number(item.qty || 0),
          priority: normalizePriority(item.priority),
          assignee: {
            name: submission.applicantName || "Not Assigned",
            role: submission.department || "Applicant",
            initials: getInitials(submission.applicantName || "NA"),
          },
          status: submission.status || "Pending",
          description: item.description || "No description provided.",
          details: [item.type, item.subType].filter(Boolean),
          photos,
        };
      })
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const getDateRangeLabel = (items: WorkOrderItem[]) => {
  if (items.length === 0) return "All Submitted Dates";
  const timestamps = items
    .map((item) => new Date(`${item.date}T00:00:00`).getTime())
    .filter((time) => Number.isFinite(time));
  if (timestamps.length === 0) return "All Submitted Dates";
  const min = new Date(Math.min(...timestamps)).toISOString().slice(0, 10);
  const max = new Date(Math.max(...timestamps)).toISOString().slice(0, 10);
  return min === max ? formatDisplayDate(min) : `${formatDisplayDate(min)} - ${formatDisplayDate(max)}`;
};

const WorkOrderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [expandedId, setExpandedId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    const rows = mapSubmissionsToRows(readStoredSubmissions());
    setWorkOrders(rows);
    setExpandedId(rows[0]?.id || "");
  }, []);

  const assigneeOptions = useMemo(
    () => ["All", ...Array.from(new Set(workOrders.map((item) => item.assignee.name)))],
    [workOrders]
  );

  const dynamicDateRangeLabel = useMemo(() => getDateRangeLabel(workOrders), [workOrders]);

  const filteredWorkOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return workOrders.filter((item) => {
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesAssignee =
        assigneeFilter === "All" || item.assignee.name === assigneeFilter;
      const matchesPriority = priorityFilter === "All" || item.priority === priorityFilter;
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
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesAssignee &&
        matchesPriority &&
        (!query || searchable.includes(query))
      );
    });
  }, [assigneeFilter, priorityFilter, searchTerm, statusFilter, workOrders]);

  const paginatedWorkOrders = filteredWorkOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.max(1, Math.ceil(filteredWorkOrders.length / pageSize));
  const showingStart =
    filteredWorkOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, filteredWorkOrders.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (event: React.ChangeEvent<HTMLSelectElement>) => {
      setter(event.target.value);
      setCurrentPage(1);
    };
  };

  const handleExport = () => {
    const headers = [
      "S.No",
      "Date of Work Order",
      "Nature of Work",
      "Location",
      "Items",
      "Priority",
      "Work Assigned To",
      "Status",
    ];
    const rows = filteredWorkOrders.map((item, index) => [
      String(index + 1),
      formatDisplayDate(item.date),
      item.nature,
      `${item.block}, ${item.floor}, ${item.room}`,
      String(item.items),
      item.priority,
      `${item.assignee.name} (${item.assignee.role})`,
      item.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "work-orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="workorderdashboard-page">
      <div className="workorderdashboard-container">
        <div className="workorderdashboard-card">
          <div className="workorderdashboard-header">
            <h5 className="workorderdashboard-title">Work Items</h5>

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
                onClick={() => navigate("/workorder/new")}
              >
                <Plus size={17} />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="workorderdashboard-toolbar">
            <button type="button" className="workorderdashboard-date-filter">
              <CalendarDays size={18} />
              <span>{dynamicDateRangeLabel}</span>
              <ChevronRight size={18} />
            </button>

            <label className="workorderdashboard-filter">
              <span>Status</span>
              <select value={statusFilter} onChange={handleFilterChange(setStatusFilter)}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="workorderdashboard-filter">
              <span>Work Assigned To</span>
              <select
                value={assigneeFilter}
                onChange={handleFilterChange(setAssigneeFilter)}
              >
                {assigneeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="workorderdashboard-filter">
              <span>Priority</span>
              <select
                value={priorityFilter}
                onChange={handleFilterChange(setPriorityFilter)}
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="workorderdashboard-search">
              <Search size={18} />
              <input
                type="search"
                placeholder="Search work items..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
              />
            </label>
          </div>

          <div className="workorderdashboard-table-wrap">
            <table className="workorderdashboard-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Date of Work Order</th>
                  <th>Nature of Work</th>
                  <th>Location</th>
                  <th>Items</th>
                  <th>Priority</th>
                  <th>Work Assigned To</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWorkOrders.map((item, index) => {
                  const isExpanded = expandedId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="workorderdashboard-row">
                        <td>{(currentPage - 1) * pageSize + index + 1}</td>
                        <td>{formatDisplayDate(item.date)}</td>
                        <td>{item.nature}</td>
                        <td>
                          <div className="workorderdashboard-location">
                            <Building2 size={21} />
                            <div>
                              <strong>{item.block}</strong>
                              <span>
                                {item.floor}, {item.room}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="workorderdashboard-count-pill">{item.items}</span>
                        </td>
                        <td>
                          <span
                            className={`workorderdashboard-priority workorderdashboard-priority--${item.priority.toLowerCase()}`}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td>
                          <div className="workorderdashboard-assignee">
                            <span className="workorderdashboard-avatar">
                              {item.assignee.initials}
                            </span>
                            <div>
                              <strong>{item.assignee.name}</strong>
                              <span>{item.assignee.role}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`workorderdashboard-status workorderdashboard-status--${item.status
                              .toLowerCase()
                              .replace(/\s+/g, "-")}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`workorderdashboard-expand-btn ${
                              isExpanded ? "open" : ""
                            }`}
                            onClick={() => setExpandedId(isExpanded ? "" : item.id)}
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} work order`}
                            aria-expanded={isExpanded}
                          >
                            <ChevronDown size={18} />
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="workorderdashboard-detail-row">
                          <td colSpan={9}>
                            <div className="workorderdashboard-detail-panel">
                              <div className="workorderdashboard-detail-section">
                                <h6>Description</h6>
                                <p>{item.description}</p>

                                <h6>Location Details</h6>
                                <dl>
                                  <div>
                                    <dt>Block:</dt>
                                    <dd>{item.block}</dd>
                                  </div>
                                  <div>
                                    <dt>Floor:</dt>
                                    <dd>{item.floor}</dd>
                                  </div>
                                  <div>
                                    <dt>Room No.:</dt>
                                    <dd>{item.room.replace("Room ", "")}</dd>
                                  </div>
                                </dl>
                              </div>

                              <div className="workorderdashboard-detail-section">
                                <h6>Work Details</h6>
                                <ul>
                                  {item.details.map((detail) => (
                                    <li key={detail}>{detail}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="workorderdashboard-detail-section">
                                <h6>Photos</h6>
                                <div className="workorderdashboard-photo-list">
                                  {item.photos.slice(0, 3).map((photo, photoIndex) => (
                                    <a
                                      key={photo.id}
                                      href={photo.preview}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`workorderdashboard-photo workorderdashboard-photo--${
                                        photoIndex + 1
                                      }`}
                                      aria-label={`View ${photo.name}`}
                                      title={photo.name}
                                    >
                                      <img src={photo.preview} alt={photo.name} />
                                      <span>{photo.name}</span>
                                    </a>
                                  ))}
                                </div>
                                {item.photos.length === 0 && (
                                  <div className="workorderdashboard-no-photos">
                                    No photos uploaded
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="workorderdashboard-view-all"
                                  disabled={item.photos.length === 0}
                                  onClick={() => {
                                    const firstPhoto = item.photos[0];
                                    if (firstPhoto) {
                                      window.open(firstPhoto.preview, "_blank", "noopener,noreferrer");
                                    }
                                  }}
                                >
                                  <Eye size={17} />
                                  <span>View All ({item.photos.length})</span>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {paginatedWorkOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="workorderdashboard-empty">
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
                  className={page === currentPage ? "active" : ""}
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
    </section>
  );
};

export default WorkOrderDashboard;
