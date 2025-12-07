import React, { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/navbar/navbar';
import authenticityUtility from '../utility/authenticityUtility';
import '../userdashboard/userdashboard.css';
import './ProjectsPage.css';

interface Project {
  id: number;
  title: string;
  team_members: string;
  agency_name?: string;
  category: string;
  sanction_order_amount?: string | number;
  duration_years?: number;
  duration_months?: number;
  duration_days?: number;
  submission_status: string;
  date_of_submission: string;
}

interface ProjectsResponse {
  data: Project[];
}

interface KpiData {
  ongoing: number;
  completed: number;
  pending: number;
  total: number;
}

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [kpiData, setKpiData] = useState<KpiData>({
    ongoing: 0,
    completed: 0,
    pending: 0,
    total: 0,
  });

  useEffect(() => {
    fetchProjects(currentPage, itemsPerPage);
    fetchKpiData();
  }, [currentPage, itemsPerPage]);

  const fetchProjects = async (page: number, perPage: number) => {
    try {
      setLoading(true);

      const response = await authenticityUtility.get('/dashboard/projects', {
        params: { page, per_page: perPage },
      }) as ProjectsResponse;

      if (response?.data && Array.isArray(response.data)) {
        setProjects(response.data);
        setTotalPages(Math.ceil(response.data.length / perPage));
        setError(null);
      } else {
        setProjects([]);
        setTotalPages(0);
      }

      setLoading(false);
    } catch (err: unknown) {
      console.error('Error fetching projects:', err);
      const error = err as { message?: string };
      setError(error.message || 'Failed to fetch projects');
      setProjects([]);
      setTotalPages(0);
      setLoading(false);
    }
  };

  const fetchKpiData = async () => {
    try {
      const response = await authenticityUtility.get('/dashboard/projects', {
        params: { page: 1, per_page: 1000 },
      }) as ProjectsResponse;

      if (response && Array.isArray(response.data)) {
        const kpis: KpiData = {
          ongoing: response.data.filter(
            (item) => item.submission_status === 'approved' || item.submission_status === 'ongoing' || item.submission_status === 'active'
          ).length,
          completed: response.data.filter(
            (item) => item.submission_status === 'completed' || item.submission_status === 'finished' || item.submission_status === 'closed'
          ).length,
          pending: response.data.filter(
            (item) => item.submission_status === 'waiting' || item.submission_status === 'pending' || item.submission_status === 'draft' || item.submission_status === 'under_review'
          ).length,
          total: response.data.length,
        };
        setKpiData(kpis);
      }
    } catch (err) {
      console.error('Error fetching KPI data:', err);
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleView = (projectId: number) => {
    navigate(`/project/${projectId}?mode=view`);
  };

  const handleAdd = () => {
    navigate('/project');
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(event.target.value));
    setCurrentPage(1);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="body-mode-dashboard projects-page container-fluid">
      <Navbar />
      <div className="row">
        <div className="col-12 main-content">
          <div className="article-score-card">
            <div className="score-card-header">
              <h5 className="score-card-title">Project Score Card</h5>
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
                <div className="kpi-icon"><i className="fas fa-play-circle"></i></div>
                <div className="kpi-content">
                  <span className="kpi-label">Ongoing</span>
                  <span className="kpi-value">{kpiData.ongoing}</span>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon"><i className="fas fa-check-circle"></i></div>
                <div className="kpi-content">
                  <span className="kpi-label">Completed</span>
                  <span className="kpi-value">{kpiData.completed}</span>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon"><i className="fas fa-clock"></i></div>
                <div className="kpi-content">
                  <span className="kpi-label">Pending</span>
                  <span className="kpi-value">{kpiData.pending}</span>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon"><i className="fas fa-folder"></i></div>
                <div className="kpi-content">
                  <span className="kpi-label">Total</span>
                  <span className="kpi-value">{kpiData.total}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="research-details">
            <div className="research-details-header">
              <h5 className="research-details-title">List of Details</h5>
              <button className="add-btn" onClick={handleAdd}>Add +</button>
            </div>

            <div className="research-grid">
              {projects && projects.length > 0 ? (
                projects.map((project) => (
                  <div key={project.id} className="research-card compact-row">
                    <div className="research-id" aria-label={`Project ID ${project.id}`}>{project.id}</div>
                    <div className="compact-content">
                      <div className="compact-header">
                        <h6 className="research-title">{project.title}</h6>
                        <div className="research-actions" role="group" aria-label="Project actions">
                          <button className="action-btn view-btn" onClick={() => handleView(project.id)} title="View project details" aria-label="View project details">
                            <i className="fas fa-eye" aria-hidden="true"></i>
                          </button>
                          <button className="action-btn share-btn" title="Share project" aria-label="Share project">
                            <i className="fas fa-link" aria-hidden="true"></i>
                          </button>
                          <button className="action-btn edit-btn" title="Edit project" aria-label="Edit project">
                            <i className="fas fa-edit" aria-hidden="true"></i>
                          </button>
                          <button className="action-btn delete-btn" title="Delete project" aria-label="Delete project">
                            <i className="fas fa-trash" aria-hidden="true"></i>
                          </button>
                        </div>
                      </div>
                      <div className="compact-details">
                        <span className="detail-item">
                          <span className="detail-label">Team:</span>
                          <span className="detail-value">{project.team_members}</span>
                        </span>
                        <span className="detail-separator">•</span>
                        <span className="detail-item">
                          <span className="detail-label">Agency:</span>
                          <span className="detail-value">{project.agency_name || 'Not specified'}</span>
                        </span>
                        <span className="detail-separator">•</span>
                        <span className="detail-item">
                          <span className="detail-label">Category:</span>
                          <span className="detail-value">{project.category}</span>
                        </span>
                        <span className="detail-separator">•</span>
                        <span className="detail-item">
                          <span className="detail-label">Amount:</span>
                          <span className="detail-value">{project.sanction_order_amount || 'Not set'}</span>
                        </span>
                        <span className="detail-separator">•</span>
                        <span className="detail-item">
                          <span className="detail-label">Duration:</span>
                          <span className="detail-value">
                            {project.duration_years ? `${project.duration_years}y` : ''}
                            {project.duration_months ? ` ${project.duration_months}m` : ''}
                            {project.duration_days ? ` ${project.duration_days}d` : ''}
                            {!project.duration_years && !project.duration_months && !project.duration_days && 'Not specified'}
                          </span>
                        </span>
                        <span className="detail-separator">•</span>
                        <span className={`status-badge status-${project.submission_status?.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                          {project.submission_status}
                        </span>
                        <span className="detail-separator">•</span>
                        <span className="detail-item">
                          <span className="detail-label">Submitted:</span>
                          <span className="detail-value">{formatDate(project.date_of_submission)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-data">No projects found.</div>
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
    </div>
  );
};

export default ProjectsPage;
