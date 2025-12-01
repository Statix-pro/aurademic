import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/navbar/navbar';
import authenticityUtility from '../utility/authenticityUtility';
import '../userdashboard/userdashboard.css';
import './PublicationsPage.css';

const PublicationsPage = () => {
  const navigate = useNavigate();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [kpiData, setKpiData] = useState({
    journal: 0,
    conference: 0,
    book: 0,
    bookChapter: 0,
  });

  useEffect(() => {
    fetchJournals(currentPage, itemsPerPage);
    fetchKpiData();
  }, [currentPage, itemsPerPage]);

  const fetchJournals = async (page, perPage) => {
    try {
      setError(null);
      setLoading(true);

      const apiResponseData = await authenticityUtility.get(
        '/dashboard/journals',
        {
          params: { page, per_page: perPage },
        }
      );

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
        console.warn(
          'Unexpected response structure received from utility:',
          apiResponseData
        );
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching journals:', err);
      setError(
        err.response?.data?.message || err.message || 'Failed to fetch journals'
      );
      setJournals([]);
      setTotalPages(0);
      setLoading(false);
    }
  };

  const fetchKpiData = async () => {
    try {
      // Fetch all journals to calculate KPIs
      const response = await authenticityUtility.get('/dashboard/journals', {
        params: { page: 1, per_page: 1000 },
      });

      if (response && Array.isArray(response.data)) {
        const kpis = {
          journal: response.data.filter(
            (item) =>
              item.type === 'Journal' ||
              item.type === 'Journal Article' ||
              item.type === 'Research Article'
          ).length,
          conference: response.data.filter(
            (item) =>
              item.type === 'Conference' ||
              item.type === 'Conference Paper' ||
              item.type === 'Conference Proceedings'
          ).length,
          book: response.data.filter(
            (item) => item.type === 'Book' || item.type === 'Monograph'
          ).length,
          bookChapter: response.data.filter(
            (item) => item.type === 'Book Chapter' || item.type === 'Chapter'
          ).length,
        };
        setKpiData(kpis);
      }
    } catch (err) {
      console.error('Error fetching KPI data:', err);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (event) => {
    setItemsPerPage(Number(event.target.value));
    setCurrentPage(1);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async (journalId) => {
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

  const handleView = (journalId) => {
    navigate(`/journal/${journalId}?mode=view`);
  };

  const handleAdd = () => {
    setShowCategoryModal(true);
  };

  const handleCategorySelect = (category) => {
    setShowCategoryModal(false);

    // Map categories to their respective routes
    const routeMap = {
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
          {/* Article Score Card Section */}
          <div className="article-score-card">
            <div className="score-card-header">
              <h5 className="score-card-title">Article Score Card</h5>
              <div className="filter-controls">
                <select className="filter-select">
                  <option>Year</option>
                  <option>2024</option>
                  <option>2023</option>
                  <option>2022</option>
                </select>
                <select className="filter-select">
                  <option>Ascending</option>
                  <option>Descending</option>
                </select>
                <button className="sort-btn">Sort</button>
              </div>
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

          {/* Research Details Section */}
          <div className="research-details">
            <div className="research-details-header">
              <h5 className="research-details-title">List of Details</h5>
              <button className="add-btn" onClick={handleAdd}>
                Add +
              </button>
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
                          <button
                            className="action-btn view-btn"
                            onClick={() => handleView(journal.id)}
                            title="View publication details"
                            aria-label="View publication details"
                          >
                            <i className="fas fa-eye" aria-hidden="true"></i>
                          </button>
                          <button
                            className="action-btn share-btn"
                            title="Share publication"
                            aria-label="Share publication"
                          >
                            <i className="fas fa-link" aria-hidden="true"></i>
                          </button>
                          <button
                            className="action-btn edit-btn"
                            title="Edit publication"
                            aria-label="Edit publication"
                          >
                            <i className="fas fa-edit" aria-hidden="true"></i>
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={() => handleDelete(journal.id)}
                            title="Delete publication"
                            aria-label="Delete publication"
                          >
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
                          <span className="detail-label">Submitted:</span>
                          <span className="detail-value">{formatDate(journal.date_of_submission)}</span>
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

            {/* Pagination Controls */}
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

      {/* Category Selection Modal */}
      {showCategoryModal && (
        <div className="category-modal-overlay" onClick={handleCloseModal}>
          <div className="category-modal" onClick={(e) => e.stopPropagation()}>
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
                    <i className="fas fa-book-open"></i>
                    Journal
                  </button>
                </div>
                <div className="col-6">
                  <button
                    type="button"
                    className="category-btn"
                    onClick={() => handleCategorySelect('Conference')}
                  >
                    <i className="fas fa-users"></i>
                    Conference
                  </button>
                </div>
                <div className="col-6">
                  <button
                    type="button"
                    className="category-btn"
                    onClick={() => handleCategorySelect('Book Chapter')}
                  >
                    <i className="fas fa-bookmark"></i>
                    Book Chapter
                  </button>
                </div>
                <div className="col-6">
                  <button
                    type="button"
                    className="category-btn"
                    onClick={() => handleCategorySelect('Book')}
                  >
                    <i className="fas fa-book"></i>
                    Book
                  </button>
                </div>
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
