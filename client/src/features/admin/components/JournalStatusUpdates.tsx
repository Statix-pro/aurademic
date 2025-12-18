import React, { useState, useEffect, ChangeEvent } from "react";
import { Modal, Button, Form, Badge, Alert } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faReply, faTimes } from "@fortawesome/free-solid-svg-icons";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import "./JournalStatusUpdates.css";

interface StatusUpdate {
  id: number;
  journal_title: string;
  journal_name: string;
  user_name: string;
  user_email: string;
  status: string;
  user_comment?: string;
  admin_reply?: string;
  created_at: string;
}

interface StatusOption {
  value: string;
  label: string;
}

const JournalStatusUpdates: React.FC = () => {
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedStatusUpdate, setSelectedStatusUpdate] = useState<StatusUpdate | null>(null);
  const [adminReply, setAdminReply] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const statusOptions: StatusOption[] = [
    { value: "", label: "All Statuses" },
    { value: "submitted", label: "Submitted" },
    { value: "under_review", label: "Under Review" },
    { value: "accepted", label: "Accepted" },
    { value: "rejected", label: "Rejected" },
    { value: "published", label: "Published" },
    { value: "revision_required", label: "Revision Required" },
  ];

  const fetchStatusUpdates = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = {
        page: currentPage,
        per_page: itemsPerPage,
      };

      if (statusFilter) {
        params.status = statusFilter;
      }

      const response = await authenticityUtility.get("/admin/journal-status-updates", { params }) as {
        data: StatusUpdate[];
        total: number;
      };
      setStatusUpdates(response.data || []);
      setTotalItems(response.total || 0);
    } catch (err) {
      console.error("Error fetching status updates:", err);
      setError("Error fetching status updates. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusUpdates();
  }, [currentPage, itemsPerPage, statusFilter]);

  const handleReply = (statusUpdate: StatusUpdate) => {
    setSelectedStatusUpdate(statusUpdate);
    setAdminReply(statusUpdate.admin_reply || "");
    setShowReplyModal(true);
  };

  const handleSubmitReply = async () => {
    if (!adminReply.trim() || !selectedStatusUpdate) {
      setError("Admin reply is required");
      return;
    }

    try {
      setSubmittingReply(true);
      setError(null);

      const response = await authenticityUtility.patch(
        `/admin/status-updates/${selectedStatusUpdate.id}/admin-reply`,
        { admin_reply: adminReply.trim() }
      ) as { message?: string };

      if (response.message) {
        setStatusUpdates((prev) =>
          prev.map((update) =>
            update.id === selectedStatusUpdate.id
              ? { ...update, admin_reply: adminReply.trim() }
              : update
          )
        );

        setShowReplyModal(false);
        setSelectedStatusUpdate(null);
        setAdminReply("");
      }
    } catch (err) {
      console.error("Error submitting reply:", err);
      setError("Error submitting reply. Please try again.");
    } finally {
      setSubmittingReply(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: string; label: string }> = {
      submitted: { variant: "primary", label: "Submitted" },
      under_review: { variant: "warning", label: "Under Review" },
      accepted: { variant: "success", label: "Accepted" },
      rejected: { variant: "danger", label: "Rejected" },
      published: { variant: "info", label: "Published" },
      revision_required: { variant: "secondary", label: "Revision Required" },
    };

    const config = statusConfig[status] || { variant: "secondary", label: status };
    return <Badge bg={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  if (loading) {
    return (
      <div className="text-center p-4">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="journal-status-updates">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Journal Status Updates</h4>
        <div className="d-flex gap-2">
          <Form.Select
            value={statusFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: "auto" }}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Form.Select>
          {statusFilter && (
            <Button variant="outline-secondary" size="sm" onClick={() => { setStatusFilter(""); setCurrentPage(1); }}>
              <FontAwesomeIcon icon={faTimes} />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>
      )}

      {statusUpdates.length === 0 ? (
        <div className="text-center p-4">
          <p className="text-muted">No status updates found.</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-striped">
              <thead className="table-dark">
                <tr>
                  <th>Journal</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>User Comment</th>
                  <th>Admin Reply</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {statusUpdates.map((update) => (
                  <tr key={update.id}>
                    <td>
                      <div>
                        <strong>{update.journal_title}</strong>
                        <br />
                        <small className="text-muted">{update.journal_name}</small>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{update.user_name}</strong>
                        <br />
                        <small className="text-muted">{update.user_email}</small>
                      </div>
                    </td>
                    <td>{getStatusBadge(update.status)}</td>
                    <td>
                      {update.user_comment ? (
                        <div style={{ maxWidth: "200px", wordWrap: "break-word" }}>{update.user_comment}</div>
                      ) : (
                        <span className="text-muted">No comment</span>
                      )}
                    </td>
                    <td>
                      {update.admin_reply ? (
                        <div style={{ maxWidth: "200px", wordWrap: "break-word" }}>{update.admin_reply}</div>
                      ) : (
                        <span className="text-muted">No reply</span>
                      )}
                    </td>
                    <td>{formatDate(update.created_at)}</td>
                    <td>
                      <Button variant="outline-primary" size="sm" onClick={() => handleReply(update)} title="Reply">
                        <FontAwesomeIcon icon={faReply} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {renderPagination()}
        </>
      )}

      <Modal show={showReplyModal} onHide={() => setShowReplyModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Admin Reply</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedStatusUpdate && (
            <div className="mb-3">
              <h6>Journal: {selectedStatusUpdate.journal_title}</h6>
              <p><strong>User:</strong> {selectedStatusUpdate.user_name}</p>
              <p><strong>Status:</strong> {getStatusBadge(selectedStatusUpdate.status)}</p>
              {selectedStatusUpdate.user_comment && (
                <div>
                  <strong>User Comment:</strong>
                  <div className="border p-2 mt-1 bg-light">{selectedStatusUpdate.user_comment}</div>
                </div>
              )}
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Admin Reply</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={adminReply}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAdminReply(e.target.value)}
              placeholder="Enter your reply to the user..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReplyModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmitReply} disabled={submittingReply || !adminReply.trim()}>
            {submittingReply ? "Submitting..." : "Submit Reply"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default JournalStatusUpdates;
