import React, { useState, useEffect, ChangeEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import authenticityUtility from '../../../shared/utils/authenticityUtility';
import '../../user-dashboard/userdashboard.css';
import './PublicationsPage.css';
import DeleteConfirmationModal from '../../../shared/components/ui/DeleteConfirmationModal';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface Journal {
  id: number;
  title: string;
  authors: string;
  type: string;
  journal_name: string;
  journal_options_name?: string;
  publisher?: string;
  status: string;
  date_of_submission: string;
  available_online_date?: string;
  doi?: string;
  admin_approval_status?: string | null;
  admin_approval_comment?: string | null;
  edit_request_status?: string | null;
  can_direct_edit?: boolean | number;
  can_request_edit?: boolean | number;
  can_delete?: boolean | number;
}

interface JournalsResponse {
  data: Journal[];
  pagination: {
    total: number;
    total_pages: number;
  };
}

interface KpiData {
  journal: number;
  conference: number;
  book: number;
  bookChapter: number;
}

const toBoolean = (value: boolean | number | undefined | null): boolean =>
  value === true || value === 1;

const normalizeApprovalStatus = (value: string | null | undefined): ApprovalStatus => {
  if (value === 'approved' || value === 'rejected') {
    return value;
  }

  return 'pending';
};

const PublicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEditRequestModal, setShowEditRequestModal] = useState(false);
  const [selectedJournalForEditRequest, setSelectedJournalForEditRequest] =
    useState<Journal | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [kpiData, setKpiData] = useState<KpiData>({
    journal: 0,
    conference: 0,
    book: 0,
    bookChapter: 0,
  });
  const [isWaitingCollapsed, setIsWaitingCollapsed] = useState(false);
  const [isApprovedCollapsed, setIsApprovedCollapsed] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [journalToDelete, setJournalToDelete] = useState<Journal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchJournals(currentPage, itemsPerPage, statusFilter, sortBy);
  }, [currentPage, itemsPerPage, statusFilter, sortBy]);

  useEffect(() => {
    fetchKpiData();
  }, []);

  const fetchJournals = async (
    page: number,
    perPage: number,
    status: string = 'all',
    sort: string = 'updated_at'
  ) => {
    try {
      setError(null);
      setLoading(true);

      const params: {
        page: number;
        per_page: number;
        status?: string;
        sort_by?: string;
      } = { page, per_page: perPage };

      if (status !== 'all') {
        params.status = status;
      }

      params.sort_by = sort;

      const apiResponseData = (await authenticityUtility.get('/dashboard/journals', {
        params,
      })) as JournalsResponse;

      if (
        apiResponseData &&
        Array.isArray(apiResponseData.data) &&
        apiResponseData.pagination
      ) {
        setJournals(apiResponseData.data);
        setTotalPages(apiResponseData.pagination.total_pages || 0);
      } else {
        setJournals([]);
        setTotalPages(0);
      }
    } catch (err: unknown) {
      console.error('Error fetching journals:', err);
      const axiosError = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Failed to fetch journals'
      );
      setJournals([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchKpiData = async () => {
    try {
      const response = (await authenticityUtility.get('/dashboard/journals', {
        params: { page: 1, per_page: 1000 },
      })) as JournalsResponse;

      if (response && Array.isArray(response.data)) {
        const publishedItems = response.data.filter(
          (item) => item.status === 'published'
        );

        const conferenceTypes = [
          'Conference',
          'Conference Paper',
          'Conference Proceedings',
        ];
        const bookTypes = ['Book', 'Monograph'];
        const bookChapterTypes = ['Book Chapter', 'Chapter'];

        const kpis: KpiData = {
          conference: publishedItems.filter((item) =>
            conferenceTypes.includes(item.type)
          ).length,
          book: publishedItems.filter((item) => bookTypes.includes(item.type))
            .length,
          bookChapter: publishedItems.filter((item) =>
            bookChapterTypes.includes(item.type)
          ).length,
          journal: publishedItems.filter(
            (item) =>
              !conferenceTypes.includes(item.type) &&
              !bookTypes.includes(item.type) &&
              !bookChapterTypes.includes(item.type)
          ).length,
        };
        setKpiData(kpis);
      }
    } catch (err) {
      console.error('Error fetching KPI data:', err);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(event.target.value));
    setCurrentPage(1);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatMonthYear = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const handleDelete = (journal: Journal) => {
    const canDelete = toBoolean(journal.can_delete);
    if (!canDelete) return;

    setJournalToDelete(journal);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!journalToDelete) return;

    try {
      setIsDeleting(true);
      await authenticityUtility.delete(`/dashboard/journals/${journalToDelete.id}`);
      await fetchJournals(currentPage, itemsPerPage, statusFilter, sortBy);
      await fetchKpiData();
      setShowDeleteModal(false);
      setJournalToDelete(null);
    } catch (err: any) {
      console.error('Error deleting journal:', err);
      setError(err.response?.data?.message || 'Failed to delete journal');
      // Optional: keep modal open if error, or close it. 
      // For now, let's close it so the error alert on page is visible (if set).
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setJournalToDelete(null);
  };

  const handleView = (journalId: number) => {
    navigate(`/journal/${journalId}?mode=view`);
  };

  const handleDirectEdit = (journalId: number) => {
    navigate(`/journal/${journalId}?mode=edit`);
  };

  const handleRequestEdit = (journal: Journal) => {
    setSelectedJournalForEditRequest(journal);
    setShowEditRequestModal(true);
  };

  const handleConfirmEditRequest = async () => {
    if (!selectedJournalForEditRequest) {
      return;
    }

    try {
      const response = (await authenticityUtility.post(
        `/edit-requests/journals/${selectedJournalForEditRequest.id}`
      )) as any;

      if (response && response.success === true) {
        alert(response.message || 'Edit request sent to admin for approval');
      } else {
        alert(response.message || 'Failed to send edit request');
      }
    } catch (error: any) {
      console.error('Error sending edit request:', error);
      alert(error.response?.data?.message || 'Failed to send edit request');
    } finally {
      setShowEditRequestModal(false);
      setSelectedJournalForEditRequest(null);
      await fetchJournals(currentPage, itemsPerPage, statusFilter, sortBy);
    }
  };

  const handleCancelEditRequest = () => {
    setShowEditRequestModal(false);
    setSelectedJournalForEditRequest(null);
  };

  const handleAdd = () => {
    setShowCategoryModal(true);
  };

  const handleCategorySelect = (category: string) => {
    setShowCategoryModal(false);

    const routeMap: Record<string, string> = {
      Journal: '/journal',
      Conference: '/journal/conference',
      Book: '/journal/book',
      'Book Chapter': '/journal/book-chapter',
    };

    const targetRoute = routeMap[category] || '/journal';
    navigate(targetRoute);
  };

  const handleCloseModal = () => {
    setShowCategoryModal(false);
  };

  const renderPublicationCard = (journal: Journal) => {
    const approvalStatus = normalizeApprovalStatus(journal.admin_approval_status);
    const canDirectEdit = toBoolean(journal.can_direct_edit);
    const canRequestEdit = toBoolean(journal.can_request_edit);
    const canDelete = toBoolean(journal.can_delete);
    const approvalLabel =
      approvalStatus === 'approved'
        ? 'Approved'
        : approvalStatus === 'rejected'
          ? 'Rejected'
          : 'Pending Approval';

    return (
      <div key={journal.id} className="research-card compact-row">
        <div className="d-flex w-100 align-items-start">
          <div className="compact-content flex-grow-1 pe-3">
            <div className="mb-2">
              <h6
                className="research-title mb-0"
                style={{ fontSize: '1.1rem', fontWeight: '600', color: '#161616' }}
              >
                {journal.title}
              </h6>
            </div>

            <div className="mb-2 text-truncate-2-lines">
              <span
                className="text-muted"
                style={{ fontSize: '0.9rem', marginRight: '5px' }}
              >
                Authors:
              </span>
              <span style={{ fontSize: '0.95rem', color: '#393939' }}>
                {journal.authors?.split(', ').map((author, index) => (
                  <span key={index}>
                    {index > 0 && ', '}
                    {author.endsWith('*') ? (
                      <>
                        {author.slice(0, -1)}
                        <span style={{ color: 'red', fontWeight: 'bold' }}>*</span>
                      </>
                    ) : (
                      author
                    )}
                  </span>
                ))}
              </span>
            </div>

            <div
              className="d-flex flex-wrap align-items-center text-muted"
              style={{ fontSize: '0.85rem' }}
            >
              <span className="me-2">
                Journal: <span className="text-dark">{journal.journal_name}</span>
              </span>
              <span className="mx-2">•</span>
              <span className="me-2">
                Publisher:{' '}
                <span className="text-dark">{journal.publisher || 'Not specified'}</span>
              </span>
            </div>

            {approvalStatus === 'rejected' && journal.admin_approval_comment ? (
              <div className="approval-comment mt-2">
                <span className="fw-semibold">Admin Comment:</span>{' '}
                {journal.admin_approval_comment}
              </div>
            ) : null}
          </div>

          <div
            className="metadata-fixed-column text-end"
            style={{ minWidth: '250px', flexShrink: 0 }}
          >
            <div
              className="research-actions mb-3 d-flex justify-content-end align-items-center"
              role="group"
              aria-label="Publication actions"
            >
              <span
                className={`type-badge me-2 type-${journal.type
                  ?.toLowerCase()
                  .replace(/[^a-z0-9]/g, '-')}`}
                style={{
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                  height: 'fit-content',
                }}
              >
                {journal.type}
              </span>

              <button
                className="action-btn view-btn"
                onClick={() => handleView(journal.id)}
                title="View publication details"
                aria-label="View publication details"
              >
                <i className="fas fa-eye" aria-hidden="true"></i>
              </button>

              {journal.doi ? (
                <a
                  className="action-btn share-btn"
                  href={
                    journal.doi.startsWith('http')
                      ? journal.doi
                      : `https://doi.org/${journal.doi}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`DOI: ${journal.doi}`}
                  aria-label="Open DOI link"
                >
                  <i className="fas fa-link" aria-hidden="true"></i>
                </a>
              ) : (
                <button
                  className="action-btn share-btn"
                  disabled
                  title="No DOI available"
                  aria-label="No DOI available"
                  style={{ opacity: 0.4, cursor: 'not-allowed' }}
                >
                  <i className="fas fa-link" aria-hidden="true"></i>
                </button>
              )}

              {canDirectEdit ? (
                <button
                  className="action-btn edit-btn"
                  onClick={() => handleDirectEdit(journal.id)}
                  title="Edit publication"
                  aria-label="Edit publication"
                >
                  <i className="fas fa-edit" aria-hidden="true"></i>
                </button>
              ) : canRequestEdit ? (
                <button
                  className="action-btn request-edit-btn"
                  onClick={() => handleRequestEdit(journal)}
                  title="Request edit approval"
                  aria-label="Request edit approval"
                >
                  <i className="fas fa-paper-plane" aria-hidden="true"></i>
                </button>
              ) : (
                <button
                  className="action-btn edit-btn"
                  disabled
                  title="Edit is currently unavailable"
                  aria-label="Edit unavailable"
                  style={{ opacity: 0.4, cursor: 'not-allowed' }}
                >
                  <i className="fas fa-edit" aria-hidden="true"></i>
                </button>
              )}

              <button
                className="action-btn delete-btn"
                onClick={() => handleDelete(journal)}
                disabled={!canDelete}
                title={
                  canDelete
                    ? 'Delete publication'
                    : 'Delete is disabled after admin approval and publication'
                }
                aria-label="Delete publication"
                style={
                  canDelete ? undefined : { opacity: 0.4, cursor: 'not-allowed' }
                }
              >
                <i className="fas fa-trash" aria-hidden="true"></i>
              </button>
            </div>

            <div className="d-flex flex-column align-items-end gap-1 mt-2">
              <div className="d-flex align-items-center gap-2">
                <span
                  className={`status-badge status-${journal.status
                    ?.toLowerCase()
                    .replace(/[^a-z0-9]/g, '-')}`}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    display: 'inline-block',
                  }}
                  title="Submission Status"
                >
                  {journal.status}
                </span>
                <span
                  className={`approval-badge approval-${approvalStatus}`}
                  title="Admin Approval Status"
                >
                  {approvalLabel}
                </span>
              </div>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                {journal.status === 'published' ? 'Published: ' : 'Submitted: '}
                {journal.status === 'published' && journal.available_online_date
                  ? formatMonthYear(journal.available_online_date)
                  : formatDate(journal.date_of_submission)}
                <span className="mx-2">•</span>
                <span
                  className="research-id"
                  aria-label={`Publication ID ${journal.id}`}
                >
                  ID: {journal.id}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const waitingJournals = journals.filter((journal) =>
    ['pending', 'rejected'].includes(
      normalizeApprovalStatus(journal.admin_approval_status)
    )
  );
  const approvedJournals = journals.filter(
    (journal) => normalizeApprovalStatus(journal.admin_approval_status) === 'approved'
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>

      <div className="body-mode-dashboard publications-page container-fluid">
        <div className="row">
          <div className="col-12 main-content">
            <div className="article-score-card">
              <div className="score-card-header">
                <h5 className="score-card-title">Article Score Card</h5>
              </div>

              <div className="kpi-cards">
                <div className="kpi-card">
                  <div className="kpi-icon">
                    <i className="fas fa-book-open"></i>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Journal</span>
                    <span className="kpi-value">{kpiData.journal}</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon">
                    <i className="fas fa-users"></i>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Conference</span>
                    <span className="kpi-value">{kpiData.conference}</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon">
                    <i className="fas fa-book"></i>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Book</span>
                    <span className="kpi-value">{kpiData.book}</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon">
                    <i className="fas fa-bookmark"></i>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Book Chapter</span>
                    <span className="kpi-value">{kpiData.bookChapter}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="research-details">
              <div className="research-details-header">
                <h5 className="research-details-title">List of Details</h5>
                <div className="d-flex gap-2 align-items-center">
                  <select
                    className="form-select form-select-sm"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ minWidth: '140px', paddingRight: '2rem' }}
                  >
                    <option value="all">All Status</option>
                    <option value="accepted">Accepted</option>
                    <option value="published">Published</option>
                    <option value="submitted">Submitted</option>
                    <option value="waiting">Waiting</option>
                    <option value="underReview">Under Review</option>
                  </select>
                  <select
                    className="form-select form-select-sm"
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ minWidth: '180px', paddingRight: '2.5rem' }}
                  >
                    <option value="updated_at">Sort: Latest Updated</option>
                    <option value="date_of_submission">Sort: Submitted Date</option>
                    <option value="available_online_date">Sort: Published Date</option>
                  </select>
                  <button
                    className="add-btn"
                    onClick={handleAdd}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Add +
                  </button>
                </div>
              </div>

              <div className="publication-section">
                <div
                  className="d-flex align-items-center justify-content-between cursor-pointer mb-3"
                  onClick={() => setIsWaitingCollapsed(!isWaitingCollapsed)}
                  style={{ cursor: 'pointer' }}
                >
                  <h6 className="publication-section-title mb-0">Waiting / Unapproved ({waitingJournals.length})</h6>
                  <i className={`fas fa-chevron-${isWaitingCollapsed ? 'down' : 'up'}`}></i>
                </div>
                {!isWaitingCollapsed && (
                  <div className="research-grid">
                    {waitingJournals.length === 0 ? (
                      <div className="no-data">No waiting publications found.</div>
                    ) : (
                      waitingJournals.map((journal) => renderPublicationCard(journal))
                    )}
                  </div>
                )}
              </div>

              <div className="publication-section">
                <div
                  className="d-flex align-items-center justify-content-between cursor-pointer mb-3"
                  onClick={() => setIsApprovedCollapsed(!isApprovedCollapsed)}
                  style={{ cursor: 'pointer' }}
                >
                  <h6 className="publication-section-title mb-0">Approved / Published ({approvedJournals.length})</h6>
                  <i className={`fas fa-chevron-${isApprovedCollapsed ? 'down' : 'up'}`}></i>
                </div>
                {!isApprovedCollapsed && (
                  <div className="research-grid">
                    {approvedJournals.length === 0 ? (
                      <div className="no-data">No approved publications found.</div>
                    ) : (
                      approvedJournals.map((journal) => renderPublicationCard(journal))
                    )}
                  </div>
                )}
              </div>

              <div className="pagination-controls">
                <select value={itemsPerPage} onChange={handleItemsPerPageChange}>
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <span>
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {showCategoryModal && (
          <div className="category-modal-overlay" onClick={handleCloseModal}>
            <div
              className="category-modal"
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              <div className="category-modal-header">
                <h5 className="category-modal-title">Select Publication Type</h5>
                <button
                  type="button"
                  className="category-modal-close"
                  onClick={handleCloseModal}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="category-modal-body">
                <div className="row g-3">
                  <div className="col-6">
                    <button
                      type="button"
                      className="category-btn"
                      onClick={() => handleCategorySelect('Journal')}
                    >
                      <i className="fas fa-book-open"></i>Journal
                    </button>
                  </div>
                  <div className="col-6">
                    <button
                      type="button"
                      className="category-btn"
                      onClick={() => handleCategorySelect('Conference')}
                    >
                      <i className="fas fa-users"></i>Conference
                    </button>
                  </div>
                  <div className="col-6">
                    <button
                      type="button"
                      className="category-btn"
                      onClick={() => handleCategorySelect('Book Chapter')}
                    >
                      <i className="fas fa-bookmark"></i>Book Chapter
                    </button>
                  </div>
                  <div className="col-6">
                    <button
                      type="button"
                      className="category-btn"
                      onClick={() => handleCategorySelect('Book')}
                    >
                      <i className="fas fa-book"></i>Book
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showEditRequestModal && selectedJournalForEditRequest && (
          <div className="category-modal-overlay" onClick={handleCancelEditRequest}>
            <div
              className="category-modal"
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              <div className="category-modal-header">
                <h5 className="category-modal-title">Request Edit Access</h5>
                <button
                  type="button"
                  className="category-modal-close"
                  onClick={handleCancelEditRequest}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="category-modal-body">
                <p>
                  Send edit request for{' '}
                  <strong>{selectedJournalForEditRequest.title}</strong>?
                </p>
                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancelEditRequest}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmEditRequest}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          show={showDeleteModal}
          onHide={cancelDelete}
          onConfirm={confirmDelete}
          itemName={journalToDelete?.title}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
};

export default PublicationsPage;
