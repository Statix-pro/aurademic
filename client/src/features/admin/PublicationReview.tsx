import { ArrowLeft, Check, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';

import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import JournalForm from '../journals/journalform';

import './PublicationReview.css';

/** The column is nullable and older rows predate it, so absent means "not yet decided". */
const normalizeApprovalStatus = (value: string | null | undefined): string => {
  const normalized = String(value || '').toLowerCase();
  return normalized === 'approved' || normalized === 'rejected' ? normalized : 'pending';
};

interface ReviewedJournal {
  id: number;
  title?: string;
  journal_name?: string;
  type?: string;
  admin_approval_status?: string | null;
  admin_approval_comment?: string | null;
}

/**
 * One publication, on its own page.
 *
 * It shows the submission form exactly as the author filled it, in view mode, with the
 * approval decision pinned above. This used to be a summary dialog inside the dashboard,
 * which showed only a hand-picked subset of the record — so a reviewer could not see what
 * was actually submitted, and every field added to the form had to be re-added there to
 * become visible. Giving it a route also makes a submission under review linkable,
 * refreshable, and reachable with the browser's Back button.
 */
const PublicationReview: React.FC = () => {
  const { journalId } = useParams<{ journalId: string }>();
  const navigate = useNavigate();

  const [journal, setJournal] = useState<ReviewedJournal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onClosed?: () => void;
  }>({ show: false, message: '', type: 'info' });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType = 'info',
    title?: string,
    onClosed?: () => void,
  ) => setAlertConfig({ show: true, message, type, title, onClosed });

  const closeAlert = () => {
    const { onClosed } = alertConfig;
    setAlertConfig((prev) => ({ ...prev, show: false }));
    if (onClosed) onClosed();
  };

  /** Back to the queue the reviewer came from, on the Publications tab. */
  const backToList = useCallback(() => navigate('/publication-dashboard'), [navigate]);

  const loadJournal = useCallback(async () => {
    if (!journalId) return;
    try {
      setLoading(true);
      setLoadError('');
      const response = (await authenticityUtility.get(`/admin/journals/${journalId}`)) as {
        data: ReviewedJournal;
      };
      setJournal(response.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setLoadError(
        error.response?.data?.message || error.message || 'Could not load this publication.',
      );
    } finally {
      setLoading(false);
    }
  }, [journalId]);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  const decide = async (status: 'approved' | 'rejected') => {
    if (!journalId || deciding) return;
    try {
      setDeciding(true);
      const response = (await authenticityUtility.patch(
        `/admin/journals/${journalId}/submission-approval`,
        { status, admin_comment: comment },
      )) as { message?: string };

      // Returning to the list is the point of the decision, so it happens once the
      // reviewer dismisses the confirmation rather than behind their back.
      showAlert(
        response.message || `Publication ${status} successfully.`,
        'success',
        status === 'approved' ? 'Approved' : 'Rejected',
        backToList,
      );
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      showAlert(
        error.response?.data?.message || error.message || 'Could not record the decision.',
        'error',
        'Decision Not Saved',
      );
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return (
      <div className="journal-review p-4">
        <div className="d-flex align-items-center gap-2 text-muted">
          <span className="spinner-border spinner-border-sm" role="status"></span>
          Loading publication...
        </div>
      </div>
    );
  }

  if (loadError || !journal) {
    return (
      <div className="journal-review p-4">
        <Button variant="outline-secondary" size="sm" onClick={backToList} className="mb-3">
          <ArrowLeft size={16} className="me-1" />
          Back to publications
        </Button>
        <div className="alert alert-danger mb-0">{loadError || 'Publication not found.'}</div>
      </div>
    );
  }

  const approvalStatus = normalizeApprovalStatus(journal.admin_approval_status);
  const isDecided = approvalStatus !== 'pending';
  const statusBadge =
    approvalStatus === 'approved'
      ? { label: 'Approved', className: 'is-approved' }
      : approvalStatus === 'rejected'
        ? { label: 'Rejected', className: 'is-rejected' }
        : { label: 'Awaiting Approval', className: 'is-pending' };

  return (
    <div className="journal-review">
      <div className="journal-review-bar">
        <div className="journal-review-identity">
          <Button
            variant="light"
            size="sm"
            className="journal-review-back"
            onClick={backToList}
            title="Back to publications"
            aria-label="Back to publications"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0">
            <div className="journal-review-title">{journal.title || 'Publication'}</div>
            <div className="journal-review-subtitle text-muted">
              {journal.journal_name || '—'}
              {journal.type ? ` · ${journal.type}` : ''}
            </div>
          </div>
          <span className={`journal-review-status ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>

        <div className="journal-review-actions">
          {isDecided ? (
            <span className="small text-muted journal-review-decision">
              {journal.admin_approval_comment
                ? `“${journal.admin_approval_comment}”`
                : 'No comment was left.'}
            </span>
          ) : (
            <>
              <Form.Control
                size="sm"
                type="text"
                placeholder="Comment for the author (optional)"
                value={comment}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComment(e.target.value)}
                className="journal-review-comment"
                disabled={deciding}
              />
              <Button
                variant="success"
                size="sm"
                onClick={() => decide('approved')}
                disabled={deciding}
              >
                <Check size={15} />
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => decide('rejected')}
                disabled={deciding}
              >
                <X size={15} />
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      <JournalForm journalId={journal.id} mode="view" embedded />

      <AlertModal
        show={alertConfig.show}
        onHide={closeAlert}
        message={alertConfig.message}
        type={alertConfig.type}
        title={alertConfig.title}
      />
    </div>
  );
};

export default PublicationReview;
