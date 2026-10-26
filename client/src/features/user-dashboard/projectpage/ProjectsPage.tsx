import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomPagination from '../../../shared/components/ui/CustomPagination';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { PROJECT_TYPE_OPTIONS } from '../../projects/constants';
import projectsApi from '../../projects/projectsApi';
import '../../user-dashboard/userdashboard.css';
import '../recordCard.css';
import './ProjectsPage.css';

interface Project {
  id: number;
  title: string;
  project_type?: string;
  team_members: string;
  agency_name?: string;
  scheme_name?: string;
  scheme_category?: string;
  project_cost?: string | number;
  duration_years?: number;
  duration_months?: number;
  duration_days?: number;
  proposal_status: string;
  project_status?: string | null;
  submitted_on: string;
}

/** Human labels for the stored proposal/project status values. */
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  accepted_for_evaluation: 'Accepted for Evaluation',
  shortlisted: 'Shortlisted',
  shortlisted_for_presentation: 'Shortlisted for Presentation',
  result_announced: 'Result Announced',
  ongoing: 'Ongoing',
  completed: 'Completed',
  closed: 'Closed',
};

/**
 * A sanctioned project reports where it is in delivery; anything earlier
 * reports where its proposal is.
 */
const displayStatus = (project: Project): string =>
  project.project_status || project.proposal_status || 'draft';

const PROJECT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const budgetFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** The sanctioned amount as a reader expects it: `₹ 5,00,000`, not `500000.00`. */
const formatBudget = (cost: Project['project_cost']): string => {
  if (cost === null || cost === undefined || cost === '') return '—';
  const amount = Number(cost);
  return Number.isFinite(amount) ? `₹ ${budgetFormat.format(amount)}` : String(cost);
};

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;

/** `2 years 6 months`, leaving out the parts that are zero. */
const formatDuration = (project: Project): string => {
  const parts = [
    project.duration_years ? plural(project.duration_years, 'year') : '',
    project.duration_months ? plural(project.duration_months, 'month') : '',
    project.duration_days ? plural(project.duration_days, 'day') : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
};

interface ProjectsResponse {
  data: Project[];
  pagination?: { total: number };
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
  const [totalItems, setTotalItems] = useState(0);
  const [kpiData, setKpiData] = useState<KpiData>({
    ongoing: 0,
    completed: 0,
    pending: 0,
    total: 0,
  });
  const [alert, setAlert] = useState<{ type: AlertType; message: string } | null>(null);
  // Set while a delete is awaiting confirmation; the modal reads the title from it.
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);

  useEffect(() => {
    fetchProjects(currentPage, itemsPerPage);
    fetchKpiData();
  }, [currentPage, itemsPerPage]);

  const fetchProjects = async (page: number, perPage: number) => {
    try {
      setLoading(true);

      const response = (await authenticityUtility.get('/dashboard/projects', {
        params: { page, per_page: perPage },
      })) as ProjectsResponse;

      if (response?.data && Array.isArray(response.data)) {
        setProjects(response.data);
        setTotalItems(response.pagination?.total ?? 0);
        setError(null);
      } else {
        setProjects([]);
        setTotalItems(0);
      }

      setLoading(false);
    } catch (err: unknown) {
      console.error('Error fetching projects:', err);
      const error = err as { message?: string };
      setError(error.message || 'Failed to fetch projects');
      setProjects([]);
      setTotalItems(0);
      setLoading(false);
    }
  };

  const fetchKpiData = async () => {
    try {
      const response = (await authenticityUtility.get('/dashboard/projects', {
        params: { page: 1, per_page: 1000 },
      })) as ProjectsResponse;

      if (response && Array.isArray(response.data)) {
        const kpis: KpiData = {
          ongoing: response.data.filter((item) => item.project_status === 'ongoing').length,
          completed: response.data.filter((item) =>
            ['completed', 'closed'].includes(item.project_status ?? ''),
          ).length,
          // Everything still with the funding agency: no delivery status yet.
          pending: response.data.filter((item) => !item.project_status).length,
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

  const handleEdit = (projectId: number) => {
    navigate(`/project/${projectId}`);
  };

  /** Copies a deep link to the project so it can be pasted into a mail or chat. */
  const handleShare = async (projectId: number) => {
    const link = `${window.location.origin}/project/${projectId}?mode=view`;

    try {
      await navigator.clipboard.writeText(link);
      setAlert({ type: 'success', message: 'Project link copied to the clipboard.' });
    } catch {
      // Clipboard access is denied outside a secure context, so show the link
      // instead of failing silently.
      setAlert({ type: 'info', message: `Copy this link: ${link}` });
    }
  };

  /**
   * Only the principal investigator, the person who filed the project and
   * admins may delete one; the API decides, and its message is shown as-is.
   */
  const handleDelete = async (project: Project) => {
    setPendingDelete(null);

    try {
      await projectsApi.deleteProject(project.id);
      setAlert({ type: 'success', message: 'Project deleted.' });
      await Promise.all([fetchProjects(currentPage, itemsPerPage), fetchKpiData()]);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } })?.response;
      setAlert({
        type: 'error',
        message: response?.data?.message || 'The project could not be deleted.',
      });
    }
  };

  // Adding starts with the kind of grant, as adding a publication does; every
  // kind opens the same form, which records the pick and lets it be changed.
  const handleAdd = () => {
    setShowTypeModal(true);
  };

  const handleTypeSelect = (projectType: string) => {
    setShowTypeModal(false);
    navigate(`/project?type=${projectType}`);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <div className="body-mode-dashboard projects-page container-fluid">
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
                  <div className="kpi-icon">
                    <i className="fas fa-play-circle"></i>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Ongoing</span>
                    <span className="kpi-value">{kpiData.ongoing}</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Completed</span>
                    <span className="kpi-value">{kpiData.completed}</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon">
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Pending</span>
                    <span className="kpi-value">{kpiData.pending}</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon">
                    <i className="fas fa-folder"></i>
                  </div>
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
                <button className="add-btn" onClick={handleAdd}>
                  Add +
                </button>
              </div>

              <div className="research-grid">
                {projects && projects.length > 0 ? (
                  projects.map((project) => (
                    <article key={project.id} className="research-card pc-card">
                      <header className="pc-card__header">
                        <div className="pc-card__heading">
                          <span className="pc-card__id" aria-label={`Project ID ${project.id}`}>
                            #{project.id}
                          </span>
                          <h6 className="pc-card__title" title={project.title}>
                            {project.title}
                          </h6>
                        </div>
                        {/* Status and actions share the title's line: on a
                            footer of their own the four buttons left a strip
                            of empty card as tall as a row of details. */}
                        <div className="pc-card__aside">
                          {project.project_type && (
                            <span className="pc-status pc-status--type">
                              {PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type}
                            </span>
                          )}
                          <span
                            className={`pc-status pc-status--${displayStatus(project).replace(/[^a-z0-9]/g, '-')}`}
                          >
                            {STATUS_LABELS[displayStatus(project)] ?? displayStatus(project)}
                          </span>
                          <div
                            className="pc-card__actions"
                            role="group"
                            aria-label="Project actions"
                          >
                            <button
                              className="action-btn view-btn"
                              onClick={() => handleView(project.id)}
                              title="View project details"
                              aria-label="View project details"
                            >
                              <i className="fas fa-eye" aria-hidden="true"></i>
                            </button>
                            <button
                              className="action-btn share-btn"
                              onClick={() => handleShare(project.id)}
                              title="Copy a link to this project"
                              aria-label="Share project"
                            >
                              <i className="fas fa-link" aria-hidden="true"></i>
                            </button>
                            <button
                              className="action-btn edit-btn"
                              onClick={() => handleEdit(project.id)}
                              title="Edit project"
                              aria-label="Edit project"
                            >
                              <i className="fas fa-edit" aria-hidden="true"></i>
                            </button>
                            <button
                              className="action-btn delete-btn"
                              onClick={() => setPendingDelete(project)}
                              title="Delete project"
                              aria-label="Delete project"
                            >
                              <i className="fas fa-trash" aria-hidden="true"></i>
                            </button>
                          </div>
                        </div>
                      </header>

                      <dl className="pc-card__facts">
                        <div className="pc-fact pc-fact--wide">
                          <dt>Team</dt>
                          <dd title={project.team_members}>{project.team_members || '—'}</dd>
                        </div>
                        <div className="pc-fact pc-fact--wide">
                          <dt>Funding Agency</dt>
                          <dd title={project.agency_name}>{project.agency_name || '—'}</dd>
                        </div>
                        <div className="pc-fact pc-fact--wide">
                          <dt>Scheme</dt>
                          <dd title={project.scheme_name}>{project.scheme_name || '—'}</dd>
                        </div>
                        <div className="pc-fact">
                          <dt>Budget</dt>
                          <dd className="pc-fact__amount">{formatBudget(project.project_cost)}</dd>
                        </div>
                        <div className="pc-fact">
                          <dt>Duration</dt>
                          <dd>{formatDuration(project)}</dd>
                        </div>
                        <div className="pc-fact">
                          <dt>Submitted</dt>
                          <dd>{project.submitted_on ? formatDate(project.submitted_on) : '—'}</dd>
                        </div>
                      </dl>
                    </article>
                  ))
                ) : (
                  <div className="no-data">No projects found.</div>
                )}
              </div>

              <CustomPagination
                name="projects-rows-per-page"
                page={currentPage}
                pageSize={itemsPerPage}
                total={totalItems}
                pageSizeOptions={[5, 10, 20, 50]}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <CustomModal
        show={showTypeModal}
        onHide={() => setShowTypeModal(false)}
        title="Select Project Type"
        size="sm"
        className="pc-type-modal"
      >
        <div className="pc-type-grid">
          {PROJECT_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="pc-type-btn"
              onClick={() => handleTypeSelect(option.value)}
            >
              <i className={`fas ${option.icon}`} aria-hidden="true"></i>
              {option.label}
            </button>
          ))}
        </div>
      </CustomModal>

      <AlertModal
        show={Boolean(pendingDelete)}
        onHide={() => setPendingDelete(null)}
        type="warning"
        title="Delete project"
        message={`Delete "${pendingDelete?.title ?? ''}"? Its investigators, finance rows and uploaded documents are removed with it.`}
        showCancel
        confirmText="Delete"
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />

      <AlertModal
        show={Boolean(alert)}
        onHide={() => setAlert(null)}
        type={alert?.type ?? 'info'}
        message={alert?.message ?? ''}
      />
    </div>
  );
};

export default ProjectsPage;
