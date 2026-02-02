import React, { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import './journalslist.css';

interface Journal {
  id: number;
  title: string;
  authors: string;
  type: string;
  journal_options_name: string;
  date_of_submission: string;
  updated_at: string;
}

interface JournalsResponse {
  data: Journal[];
  pagination: {
    total: number;
    total_pages: number;
  };
}

const JournalsList: React.FC = () => {
  const navigate = useNavigate();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchJournals(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage]);

  const fetchJournals = async (page: number, perPage: number) => {
    try {
      setError(null);
      setLoading(true);

      const apiResponseData = await authenticityUtility.get('/dashboard/journals', {
        params: { page, per_page: perPage },
      }) as JournalsResponse;

      if (apiResponseData && Array.isArray(apiResponseData.data) && apiResponseData.pagination) {
        setJournals(apiResponseData.data);
        setTotalPages(apiResponseData.pagination.total_pages || 0);
      } else {
        setJournals([]);
        setTotalPages(0);
        console.warn('Unexpected response structure received from utility:', apiResponseData);
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
      } catch (err) {
        console.error('Error deleting journal:', err);
        setError('Failed to delete journal');
      }
    }
  };

  const handleView = (journalId: number) => {
    navigate(`/journal/${journalId}?mode=view`);
  };

  const handleAdd = () => {
    navigate('/journal');
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="journals-list">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h5 className="tab-title">Journal</h5>
        <div>
          <button className="btn btn-primary" onClick={handleAdd}>Add+</button>
        </div>
      </div>

      {journals.length === 0 ? (
        <div className="alert alert-info">No journals found.</div>
      ) : (
        journals.map((journal) => (
          <div key={journal.id} className="publication-item p-3 mb-4 bg-light rounded">
            <div className="row">
              <div className="col-md-10">
                <h5 style={{ lineHeight: '32px' }}>{journal.title}</h5>
                <p>{journal.authors}</p>

                {/* New Prominent Metadata Section */}
                <div className="metadata-row mt-2 p-2 rounded" style={{ backgroundColor: '#f0f2f5', borderLeft: '4px solid #0f62fe' }}>
                  <div className="row">
                    <div className="col-md-4">
                      <small className="text-muted d-block uppercase-label">Status</small>
                      <span className="fw-bold text-primary">{journal.journal_options_name}</span>
                    </div>
                    <div className="col-md-4">
                      <small className="text-muted d-block uppercase-label">Type</small>
                      <span className="fw-medium">{journal.type}</span>
                    </div>
                    <div className="col-md-4">
                      <small className="text-muted d-block uppercase-label">Submitted On</small>
                      <span className="fw-medium">{formatDate(journal.date_of_submission)}</span>
                    </div>
                  </div>
                </div>

              </div>
              <div className="col-md-2">
                <div className="actions" style={{ marginTop: '20px' }}>
                  <button className="btn custom-btn" title="View" onClick={() => handleView(journal.id)}>
                    <i className="fas fa-eye"></i>
                  </button>
                  <button className="btn custom-btn" title="Share-link"><i className="fas fa-link"></i></button>
                  <button className="btn custom-btn" title="Edit"><i className="fas fa-edit"></i></button>
                  <button className="btn custom-btn" title="Delete" onClick={() => handleDelete(journal.id)}>
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
                <div className="mt-2 text-end">
                  {/* Removed duplicate date info since it's now in the main block, keeping only last edited if needed */}
                  <p className="text-muted" style={{ fontSize: '12px' }}>Last edited: {formatDate(journal.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        ))
      )}

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
  );
};

export default JournalsList;
