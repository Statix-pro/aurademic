import React, { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import './projectlist.css';

interface Project {
  id: number;
  title: string;
  team_members: string;
  agency_name?: string;
  agency_id?: number;
  sanction_order_amount?: string | number;
  project_duration_start_date: string;
  project_duration_end_date: string;
  date_of_submission: string;
}

interface ProjectsResponse {
  data: Project[];
}

const ProjectsList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchProjects(currentPage, itemsPerPage);
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
        console.warn('Invalid projects data format:', response.data);
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
    <div className="projects-list">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h5 className="tab-title">Projects</h5>
        <div>
          <button className="btn btn-primary" onClick={handleAdd}>Add+</button>
        </div>
      </div>

      {projects && projects.length > 0 ? (
        projects.map((project) => (
          <div key={project.id} className="publication-item p-3 mb-4 bg-light rounded">
            <div className="row">
              <div className="col-md-10">
                <h5 style={{ lineHeight: '32px' }}>{project.title}</h5>
                <p>{project.team_members}</p>
                <span>
                  <p style={{ fontSize: '13px' }}>
                    <span style={{ backgroundColor: '#AFDBF7', padding: '5px' }}>{project.agency_name || project.agency_id}</span>
                    <span> Amount: ₹{project.sanction_order_amount || 'Not set'}</span>
                    <span> Duration: {formatDate(project.project_duration_start_date)} - {formatDate(project.project_duration_end_date)}</span>
                  </p>
                </span>
              </div>
              <div className="col-md-2">
                <div className="actions" style={{ marginTop: '20px' }}>
                  <button className="btn custom-btn" title="View" onClick={() => handleView(project.id)}>
                    <i className="fas fa-eye"></i>
                  </button>
                  <button className="btn custom-btn" title="Share-link"><i className="fas fa-link"></i></button>
                  <button className="btn custom-btn" title="Edit"><i className="fas fa-edit"></i></button>
                  <button className="btn custom-btn" title="Delete"><i className="fas fa-trash"></i></button>
                </div>
                <div>
                  <p className="text-muted" style={{ fontSize: '13px' }}>Submitted: {formatDate(project.date_of_submission)}</p>
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="alert alert-info">No projects found.</div>
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

export default ProjectsList;
