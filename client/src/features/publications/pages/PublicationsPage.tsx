import React, { useState, useEffect, ChangeEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../shared/components/layout/navbar/navbar';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import '../../user-dashboard/userdashboard.css';
import './PublicationsPage.css';

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

const PublicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedJournalForEdit, setSelectedJournalForEdit] = useState<Journal | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [kpiData, setKpiData] = useState<KpiData>({
    journal: 0,
    conference: 0,
    book: 0,
    bookChapter: 0,
  });

  useEffect(() => {
    fetchJournals(currentPage, itemsPerPage, statusFilter, sortBy);
    fetchKpiData();
  }, [currentPage, itemsPerPage, statusFilter, sortBy]);

  const fetchJournals = async (page: number, perPage: number, status: string = 'all', sort: string = 'updated_at') => {
    try {
      setError(null);
      setLoading(true);

      const params: { page: number; per_page: number; status?: string; sort_by?: string } = { page, per_page: perPage };
      if (status !== 'all') {
        params.status = status;
      }
      params.sort_by = sort;

      const apiResponseData = await authenticityUtility.get('/dashboard/journals', {
        params,
      }) as JournalsResponse;

      if (apiResponseData && Array.isArray(apiResponseData.data) && apiResponseData.pagination) {
        setJournals(apiResponseData.data);
        setTotalPages(apiResponseData.pagination.total_pages || 0);
      } else {
        setJournals([]);
        setTotalPages(0);
      }

      setLoading(false);
    } catch (err: unknown) {
      console.error('Error fetching journals:', err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to fetch journals');
      setJournals([]);
      setTotalPages(0);
      setLoading(false);
    }
  };

  const fetchKpiData = async () => {
    try {
      const response = await authenticityUtility.get('/dashboard/journals', {
        params: { page: 1, per_page: 1000 },
      }) as JournalsResponse;

      if (response && Array.isArray(response.data)) {
        // Only count published items
        const publishedItems = response.data.filter((item) => item.status === 'published');

        // Define conference and book types
        const conferenceTypes = ['Conference', 'Conference Paper', 'Conference Proceedings'];
        const bookTypes = ['Book', 'Monograph'];
        const bookChapterTypes = ['Book Chapter', 'Chapter'];

        const kpis: KpiData = {
          conference: publishedItems.filter((item) => conferenceTypes.includes(item.type)).length,
          book: publishedItems.filter((item) => bookTypes.includes(item.type)).length,
          bookChapter: publishedItems.filter((item) => bookChapterTypes.includes(item.type)).length,
          // Journal = everything else (Research Article, Review, Note, Erratum, etc.)
          journal: publishedItems.filter(
            (item) => !conferenceTypes.includes(item.type) &&
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

  const handleDelete = async (journalId: number) => {
    if (window.confirm('Are you sure you want to delete this journal?')) {
      try {
        await authenticityUtility.delete(`/dashboard/journals/${journalId}`);
        await fetchJournals(currentPage, itemsPerPage);
        await fetchKpiData();
      } catch (err) {
        console.error('Error deleting journal:', err);
        setError('Failed to delete journal');
      }
    }
  };

  const handleView = (journalId: number) => {
    navigate(`/journal/${journalId}?mode=view`);
  };

  const handleEdit = (journal: Journal) => {
    setSelectedJournalForEdit(journal);
    setShowEditModal(true);
  };

  const handleConfirmEdit = async () => {
    if (selectedJournalForEdit) {
      try {
        const response = await authenticityUtility.post(
          `/edit-requests/journals/${selectedJournalForEdit.id}`
        ) as any;

        if (response && response.success === true) {
          alert(response.message || 'Edit request sent to admin for approval');
        } else {
          console.error('Edit request was not successful:', response.message);
          alert(response.message || 'Failed to send edit request');
        }
      } catch (error: any) {
        console.error('Error sending edit request:', error);
        alert(error.response?.data?.message || 'Failed to send edit request');
      }
    }
    setShowEditModal(false);
    setSelectedJournalForEdit(null);
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setSelectedJournalForEdit(null);
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

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <Navbar />
      <div className="body-mode-dashboard publications-page container-fluid">
        <div className="row">
          <div className="col-12 main-content">
            <div className="article-score-card">
              <div className="score-card-header">
                <h5 className="score-card-title">Article Score Card</h5>
              </div>

              <div className="kpi-cards">
                <div className="kpi-card">
                  <div className="kpi-icon"><i className="fas fa-book-open"></i></div>
                  <div className="kpi-content">
                    <span className="kpi-label">Journal</span>
                    <span className="kpi-value">{kpiData.journal}</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon"><i className="fas fa-users"></i></div>
                  <div className="kpi-content">
                    <span className="kpi-label">Conference</span>
                    <span className="kpi-value">{kpiData.conference}</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon"><i className="fas fa-book"></i></div>
                  <div className="kpi-content">
                    <span className="kpi-label">Book</span>
                    <span className="kpi-value">{kpiData.book}</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon"><i className="fas fa-bookmark"></i></div>
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
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
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
                    onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                    style={{ minWidth: '180px', paddingRight: '2.5rem' }}
                  >
                    <option value="updated_at">Sort: Latest Updated</option>
                    <option value="date_of_submission">Sort: Submitted Date</option>
                    <option value="available_online_date">Sort: Published Date</option>
                  </select>
                  <button className="add-btn" onClick={handleAdd} style={{ whiteSpace: 'nowrap' }}>Add +</button>
                </div>
              </div>

              <div className="research-grid">
                {journals.length === 0 ? (
                  <div className="no-data">No publications found.</div>
                ) : (
                  journals.map((journal) => (
                    <div key={journal.id} className="research-card compact-row">
                      <div className="research-id" aria-label={`Publication ID ${journal.id}`}>{journal.id}</div>
                      <div className="compact-content">
                        <div className="compact-header">
                          <h6 className="research-title">{journal.title}</h6>
                          <div className="research-actions" role="group" aria-label="Publication actions">
                            <button className="action-btn view-btn" onClick={() => handleView(journal.id)} title="View publication details" aria-label="View publication details">
                              <i className="fas fa-eye" aria-hidden="true"></i>
                            </button>
                            <button className="action-btn share-btn" title="Share publication" aria-label="Share publication">
                              <i className="fas fa-link" aria-hidden="true"></i>
                            </button>
                            <button className="action-btn edit-btn" onClick={() => handleEdit(journal)} title="Edit publication" aria-label="Edit publication">
                              <i className="fas fa-edit" aria-hidden="true"></i>
                            </button>
                            <button className="action-btn delete-btn" onClick={() => handleDelete(journal.id)} title="Delete publication" aria-label="Delete publication">
                              <i className="fas fa-trash" aria-hidden="true"></i>
                            </button>
                          </div>
                        </div>
                        <div className="compact-details">
                          <span className="detail-item">
                            <span className="detail-label">Authors:</span>
                            <span className="detail-value">{journal.authors}</span>
                          </span>
                          <span className="detail-separator">•</span>
                          <span className="detail-item">
                            <span className="detail-label">Journal:</span>
                            <span className="detail-value">{journal.journal_name}</span>
                          </span>
                          <span className="detail-separator">•</span>
                          <span className="detail-item">
                            <span className="detail-label">Publisher:</span>
                            <span className="detail-value">{journal.publisher || 'Not specified'}</span>
                          </span>
                          <span className="detail-separator">•</span>
                          <span className={`type-badge type-${journal.type?.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                            {journal.type}
                          </span>
                          <span className="detail-separator">•</span>
                          <span className={`status-badge status-${journal.status?.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                            {journal.status}
                          </span>
                          <span className="detail-separator">•</span>
                          <span className="detail-item">
                            <span className="detail-label">
                              {journal.status === 'published' ? 'Published:' : 'Submitted:'}
                            </span>
                            <span className="detail-value">
                              {journal.status === 'published' && journal.available_online_date
                                ? formatDate(journal.available_online_date)
                                : formatDate(journal.date_of_submission)}
                            </span>
                          </span>
                          {journal.doi && (
                            <>
                              <span className="detail-separator">•</span>
                              <span className="detail-item">
                                <span className="detail-label">DOI:</span>
                                <span className="detail-value doi-value">{journal.doi}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pagination-controls">
                <select value={itemsPerPage} onChange={handleItemsPerPageChange}>
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <span>Page {currentPage} of {totalPages || 1}</span>
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}>Next</button>
              </div>
            </div>
          </div>
        </div>

        {showCategoryModal && (
          <div className="category-modal-overlay" onClick={handleCloseModal}>
            <div className="category-modal" onClick={(e: MouseEvent) => e.stopPropagation()}>
              <div className="category-modal-header">
                <h5 className="category-modal-title">Select Publication Type</h5>
                <button type="button" className="category-modal-close" onClick={handleCloseModal} aria-label="Close">×</button>
              </div>
              <div className="category-modal-body">
                <div className="row g-3">
                  <div className="col-6">
                    <button type="button" className="category-btn" onClick={() => handleCategorySelect('Journal')}>
                      <i className="fas fa-book-open"></i>Journal
                    </button>
                  </div>
                  <div className="col-6">
                    <button type="button" className="category-btn" onClick={() => handleCategorySelect('Conference')}>
                      <i className="fas fa-users"></i>Conference
                    </button>
                  </div>
                  <div className="col-6">
                    <button type="button" className="category-btn" onClick={() => handleCategorySelect('Book Chapter')}>
                      <i className="fas fa-bookmark"></i>Book Chapter
                    </button>
                  </div>
                  <div className="col-6">
                    <button type="button" className="category-btn" onClick={() => handleCategorySelect('Book')}>
                      <i className="fas fa-book"></i>Book
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showEditModal && selectedJournalForEdit && (
          <div className="category-modal-overlay" onClick={handleCancelEdit}>
            <div className="category-modal" onClick={(e: MouseEvent) => e.stopPropagation()}>
              <div className="category-modal-header">
                <h5 className="category-modal-title">Edit Publication</h5>
                <button type="button" className="category-modal-close" onClick={handleCancelEdit} aria-label="Close">×</button>
              </div>
              <div className="category-modal-body">
                <p>Are you sure you want to send an edit request for <strong>{selectedJournalForEdit.title}</strong>?</p>
                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                  <button type="button" className="btn btn-primary" onClick={handleConfirmEdit}>Confirm</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicationsPage;
