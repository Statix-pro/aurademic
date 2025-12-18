import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { Modal, Button, Form, Badge, Alert, Card, Row, Col } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faReply, faUser, faFileAlt } from "@fortawesome/free-solid-svg-icons";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import "./JournalStatusDetails.css";

interface JournalStatusDetailsProps {
  journalId: number | null;
  show: boolean;
  onHide: () => void;
}

interface Journal {
  id: number;
  title: string;
  journal_name?: string;
  status?: string;
  category?: string;
  publisher?: string;
  doi?: string;
}

interface StatusUpdate {
  id: number;
  user_name: string;
  user_email: string;
  status: string;
  user_comment?: string;
  admin_reply?: string;
  created_at: string;
}

const JournalStatusDetails: React.FC<JournalStatusDetailsProps> = ({ journalId, show, onHide }) => {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedStatusUpdate, setSelectedStatusUpdate] = useState<StatusUpdate | null>(null);
  const [adminReply, setAdminReply] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const fetchJournalWithStatusUpdates = async () => {
    if (!journalId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await authenticityUtility.get(`/admin/journals/${journalId}/with-status-updates`) as {
        data: { journal: Journal; statusUpdates: StatusUpdate[] };
      };
      setJournal(response.data.journal);
      setStatusUpdates(response.data.statusUpdates || []);
    } catch (err) {
      console.error("Error fetching journal with status updates:", err);
      setError("Error fetching journal details. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show && journalId) {
      fetchJournalWithStatusUpdates();
    }
  }, [show, journalId]);

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

  const renderStatusUpdateCard = (update: StatusUpdate) => (
    <Card key={update.id} className="mb-3 status-update-card">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div className="user-info">
          <FontAwesomeIcon icon={faUser} className="text-muted" />
          <strong>{update.user_name}</strong>
          <span className="text-muted">({update.user_email})</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          {getStatusBadge(update.status)}
          <Button variant="outline-primary" size="sm" onClick={() => handleReply(update)} title="Reply">
            <FontAwesomeIcon icon={faReply} />
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={6}>
            <p><strong>Date:</strong> {formatDate(update.created_at)}</p>
            {update.user_comment && (
              <div>
                <strong>User Comment:</strong>
                <div className="comment-box">{update.user_comment}</div>
              </div>
            )}
          </Col>
          <Col md={6}>
            {update.admin_reply ? (
              <div>
                <strong>Admin Reply:</strong>
                <div className="admin-reply-box">{update.admin_reply}</div>
              </div>
            ) : (
              <div className="no-reply">
                <FontAwesomeIcon icon={faReply} />
                No admin reply yet
              </div>
            )}
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" className="journal-status-details">
        <Modal.Header closeButton>
          <Modal.Title>
            <FontAwesomeIcon icon={faFileAlt} className="me-2" />
            Journal Status Updates
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : error ? (
            <Alert variant="danger" className="error">{error}</Alert>
          ) : (
            <>
              {journal && (
                <div className="journal-details">
                  <h5>Journal Information</h5>
                  <Row>
                    <Col md={6}>
                      <p><strong>Title:</strong> {journal.title}</p>
                      <p><strong>Journal Name:</strong> {journal.journal_name}</p>
                      <p><strong>Status:</strong> {getStatusBadge(journal.status || '')}</p>
                    </Col>
                    <Col md={6}>
                      <p><strong>Category:</strong> {journal.category}</p>
                      <p><strong>Publisher:</strong> {journal.publisher}</p>
                      <p><strong>DOI:</strong> {journal.doi || "N/A"}</p>
                    </Col>
                  </Row>
                </div>
              )}

              <div className="status-history-header">
                <h5>Status Update History</h5>
                <span className="status-count">
                  {statusUpdates.length} update{statusUpdates.length !== 1 ? "s" : ""}
                </span>
              </div>

              {statusUpdates.length === 0 ? (
                <div className="text-center p-4">
                  <p className="text-muted">No status updates found for this journal.</p>
                </div>
              ) : (
                <div>{statusUpdates.map(renderStatusUpdateCard)}</div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showReplyModal} onHide={() => setShowReplyModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Admin Reply</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedStatusUpdate && (
            <div className="mb-3">
              <h6>Journal: {journal?.title}</h6>
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
    </>
  );
};

export default JournalStatusDetails;
