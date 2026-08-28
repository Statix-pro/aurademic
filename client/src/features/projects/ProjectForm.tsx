import { AlertCircle, Info, Loader2, Pencil } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import RequestOptionModal from './components/RequestOptionModal';
import { DOCUMENT_ACCEPT, MAX_DOCUMENT_BYTES, hasReachedProposalStage } from './constants';
import {
  createEmptyProjectForm,
  emptyDocumentSlot,
  projectToFormState,
  replaceAt,
} from './projectFormState';
import projectsApi, { ProjectSaveError } from './projectsApi';
import CallForDetailsSection from './sections/CallForDetailsSection';
import CollaboratorsSection from './sections/CollaboratorsSection';
import FinalDocumentsSection from './sections/FinalDocumentsSection';
import FinanceRowsSection from './sections/FinanceRowsSection';
import GrantDisbursementSection from './sections/GrantDisbursementSection';
import InvestigatorsSection from './sections/InvestigatorsSection';
import OutcomeSection from './sections/OutcomeSection';
import PresentationSection from './sections/PresentationSection';
import ProjectStatusSection from './sections/ProjectStatusSection';
import ProposalDetailsSection from './sections/ProposalDetailsSection';
import ResultAnnouncementSection from './sections/ResultAnnouncementSection';
import SanctionDetailsSection from './sections/SanctionDetailsSection';
import SubmissionDetailsSection from './sections/SubmissionDetailsSection';
import { useBudgetCatalog } from '../../shared/hooks/useBudgetCatalog';

import type {
  DisbursementSlot,
  ProjectAccess,
  ProjectDocumentType,
  ProjectFormState,
  ProjectLookups,
} from './types';
import './projectForm.css';

const emptyLookups: ProjectLookups = { organizations: [], schemes: [], departments: [] };

/**
 * Client-side mirror of the server's blocking rules, so an obvious omission is
 * caught before a round trip. The server re-checks everything and stays the
 * authority; error keys match its field paths so both render the same way.
 */
function validate(form: ProjectFormState): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.title.trim()) errors.title = 'Title is required.';

  form.investigators.forEach((row, index) => {
    if (!row.name.trim()) {
      errors[`investigators[${index}].name`] = 'Investigator name is required.';
    }
    if (row.memberType === 'faculty' && !row.identityCode) {
      errors[`investigators[${index}].identity_code`] =
        'Select a faculty member from the search results.';
    }
    if (row.memberType === 'student' && !row.department) {
      errors[`investigators[${index}].department`] = 'Select the student’s department.';
    }
    if (row.memberType === 'external' && !row.organization.trim()) {
      errors[`investigators[${index}].organization`] =
        'Organization is required for an external investigator.';
    }
  });

  if (
    form.projectStartDate &&
    form.projectClosingDate &&
    form.projectClosingDate < form.projectStartDate
  ) {
    errors.project_closing_date = 'Closing date cannot be before the start date.';
  }

  return errors;
}

const ProjectForm: React.FC = () => {
  const { id: routeProjectId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { catalog } = useBudgetCatalog();

  const [form, setForm] = useState<ProjectFormState>(createEmptyProjectForm);
  const [lookups, setLookups] = useState<ProjectLookups>(emptyLookups);
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [loadError, setLoadError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);

  const isExisting = Boolean(routeProjectId);
  // A saved project the viewer may change; a new project always may be.
  const canEdit = !isExisting || !access || access.canEdit;
  // `?mode=view` opens an editable project read-only — the dashboards link here
  // to read a project, and the header offers a way into editing.
  const isViewMode = searchParams.get('mode') === 'view';
  const isReadOnly = !canEdit || isViewMode;

  // Progressive disclosure, as the previous form did with its "Published"
  // status: what has not happened yet has nothing to record, so those sections
  // stay hidden until the proposal reaches that stage. Values already captured
  // are kept in state and still saved, so moving the status back and forth
  // never discards them.
  const showPresentation = hasReachedProposalStage(
    form.proposalStatus,
    'shortlisted_for_presentation',
  );
  const showOutcome = hasReachedProposalStage(form.proposalStatus, 'result_announced');

  const patch = useCallback(
    (changes: Partial<ProjectFormState>) => setForm((previous) => ({ ...previous, ...changes })),
    [],
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      setStatus('loading');
      setLoadError('');

      try {
        const [loadedLookups, project] = await Promise.all([
          projectsApi.fetchLookups(),
          routeProjectId ? projectsApi.fetchProject(routeProjectId) : Promise.resolve(null),
        ]);

        if (!active) return;

        setLookups(loadedLookups);
        if (project) {
          setForm(projectToFormState(project));
          setAccess(project.access ?? null);
        }
        setStatus('ready');
      } catch (error) {
        if (!active) return;
        setLoadError((error as Error).message || 'The project could not be loaded.');
        setStatus('ready');
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [routeProjectId]);

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  const checkFile = (file: File): string => {
    if (file.type !== DOCUMENT_ACCEPT) return 'Upload a PDF file.';
    if (file.size > MAX_DOCUMENT_BYTES) return 'The file must be 5 MB or smaller.';
    return '';
  };

  const selectDocument = (documentType: ProjectDocumentType, file: File) => {
    const problem = checkFile(file);
    const errorKey = `document__${documentType}`;

    if (problem) {
      setErrors((previous) => ({ ...previous, [errorKey]: problem }));
      return;
    }

    setErrors((previous) => {
      const next = { ...previous };
      delete next[errorKey];
      return next;
    });

    patch({
      documents: {
        ...form.documents,
        [documentType]: { file, filePath: '', originalName: file.name, removed: false },
      },
    });
  };

  const clearDocument = (documentType: ProjectDocumentType) => {
    const slot = form.documents[documentType];

    patch({
      documents: {
        ...form.documents,
        // A stored file is only deleted on save, so the path is kept and the
        // slot is marked as cleared.
        [documentType]: slot.filePath
          ? { ...emptyDocumentSlot(), filePath: slot.filePath, removed: true }
          : emptyDocumentSlot(),
      },
    });
  };

  const selectDisbursementDocument = (rowIndex: number, slot: DisbursementSlot, file: File) => {
    const problem = checkFile(file);
    if (problem) {
      setErrors((previous) => ({
        ...previous,
        [`disbursements[${rowIndex}].${slot}`]: problem,
      }));
      return;
    }

    const row = form.disbursements[rowIndex];
    patch({
      disbursements: replaceAt(form.disbursements, rowIndex, {
        documents: {
          ...row.documents,
          [slot]: { file, filePath: '', originalName: file.name, removed: false },
        },
      }),
    });
  };

  const clearDisbursementDocument = (rowIndex: number, slot: DisbursementSlot) => {
    const row = form.disbursements[rowIndex];
    const current = row.documents[slot];

    patch({
      disbursements: replaceAt(form.disbursements, rowIndex, {
        documents: {
          ...row.documents,
          [slot]: current.filePath
            ? { ...emptyDocumentSlot(), filePath: current.filePath, removed: true }
            : emptyDocumentSlot(),
        },
      }),
    });
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === 'saving' || isReadOnly) return;

    setSaveMessage('');
    const validationErrors = validate(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setStatus('saving');
      const saved = await projectsApi.saveProject(routeProjectId ?? null, form);

      setForm(projectToFormState(saved));
      setAccess(saved.access ?? access);
      setSaveMessage('Project saved.');
      setStatus('ready');

      if (!routeProjectId && saved.id) {
        // Move to the project's own URL so a refresh reloads what was saved.
        navigate(`/project/${saved.id}`, { replace: true });
      }
    } catch (error) {
      setStatus('ready');

      if (error instanceof ProjectSaveError && error.fieldErrors.length > 0) {
        setErrors(
          error.fieldErrors.reduce<Record<string, string>>((map, fieldError) => {
            map[fieldError.field] = fieldError.message;
            return map;
          }, {}),
        );
      }

      setLoadError('');
      setSaveMessage('');
      setErrors((previous) => ({
        ...previous,
        __form: (error as Error).message || 'The project could not be saved.',
      }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const errorList = useMemo(
    () => Object.entries(errors).filter(([field]) => field !== '__form'),
    [errors],
  );

  if (status === 'loading') {
    return (
      <div className="pf-page pf-page--centered">
        <Loader2 className="pf-spinner" size={28} aria-hidden="true" />
        <p>Loading project…</p>
      </div>
    );
  }

  return (
    <div className="pf-page">
      <div className="pf-page__inner">
        {/* The form carries no page heading — the sections name themselves. Only
            the save confirmation and the way out of view mode appear up here. */}
        {(saveMessage || (canEdit && isViewMode)) && (
          <div className="pf-page__header">
            {saveMessage && <span className="pf-page__saved">{saveMessage}</span>}

            {canEdit && isViewMode && (
              <button
                type="button"
                className="pf-btn pf-btn--primary"
                onClick={() => setSearchParams({}, { replace: true })}
              >
                <Pencil size={16} aria-hidden="true" />
                Edit
              </button>
            )}
          </div>
        )}

        {!canEdit && (
          <div className="pf-banner pf-banner--info">
            <Info size={18} aria-hidden="true" />
            <span>View only — the principal investigator can edit this project.</span>
          </div>
        )}

        {loadError && (
          <div className="pf-banner pf-banner--error">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{loadError}</span>
          </div>
        )}

        {(errors.__form || errorList.length > 0) && (
          <div className="pf-banner pf-banner--error">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>{errors.__form || 'Please correct the highlighted fields.'}</strong>
              {errorList.length > 0 && (
                <ul className="pf-banner__list">
                  {errorList.map(([field, message]) => (
                    <li key={field}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="pf-form" noValidate>
          <InvestigatorsSection
            form={form}
            patch={patch}
            departments={lookups.departments}
            errors={errors}
            disabled={isReadOnly}
          />

          <div className="pf-columns">
            <ProposalDetailsSection
              form={form}
              patch={patch}
              errors={errors}
              disabled={isReadOnly}
            />
            <CallForDetailsSection
              form={form}
              patch={patch}
              organizations={lookups.organizations}
              schemes={lookups.schemes}
              errors={errors}
              disabled={isReadOnly}
              onRequestOption={() => setShowRequestModal(true)}
            />
          </div>

          <CollaboratorsSection
            form={form}
            patch={patch}
            organizations={lookups.organizations}
            errors={errors}
            disabled={isReadOnly}
          />

          <FinanceRowsSection
            title="Financial Contribution"
            errorPrefix="contribution_rows"
            rows={form.financialContributions}
            onChange={(rows) => patch({ financialContributions: rows })}
            enabled={form.financialContributionEnabled}
            onToggle={(enabled) => patch({ financialContributionEnabled: enabled })}
            organizations={lookups.organizations}
            budgetHeads={catalog?.heads ?? []}
            errors={errors}
            disabled={isReadOnly}
          />

          <FinanceRowsSection
            title="Finance Sharing"
            errorPrefix="sharing_rows"
            rows={form.financeSharing}
            onChange={(rows) => patch({ financeSharing: rows })}
            enabled={form.financeSharingEnabled}
            onToggle={(enabled) => patch({ financeSharingEnabled: enabled })}
            organizations={lookups.organizations}
            budgetHeads={catalog?.heads ?? []}
            errors={errors}
            disabled={isReadOnly}
          />

          <SubmissionDetailsSection
            form={form}
            patch={patch}
            errors={errors}
            disabled={isReadOnly}
          />

          {!showPresentation && (
            <p className="pf-stage-note">
              Set the status to <strong>Shortlisted for Presentation</strong> to record the
              presentation, and to <strong>Result Announced</strong> for the sanction,
              disbursements, outcomes and final documents.
            </p>
          )}

          {showPresentation && (
            <PresentationSection
              form={form}
              patch={patch}
              onSelectDocument={selectDocument}
              onClearDocument={clearDocument}
              errors={errors}
              disabled={isReadOnly}
            />
          )}

          {showPresentation && !showOutcome && (
            <p className="pf-stage-note">
              Set the status to <strong>Result Announced</strong> to record the sanction,
              disbursements, outcomes and final documents.
            </p>
          )}

          {showOutcome && (
            <>
              <ResultAnnouncementSection
                form={form}
                patch={patch}
                errors={errors}
                disabled={isReadOnly}
              />

              <SanctionDetailsSection
                form={form}
                patch={patch}
                onSelectDocument={selectDocument}
                onClearDocument={clearDocument}
                errors={errors}
                disabled={isReadOnly}
              />

              <GrantDisbursementSection
                form={form}
                patch={patch}
                organizations={lookups.organizations}
                onSelectDocument={selectDisbursementDocument}
                onClearDocument={clearDisbursementDocument}
                errors={errors}
                disabled={isReadOnly}
              />

              <ProjectStatusSection
                form={form}
                patch={patch}
                errors={errors}
                disabled={isReadOnly}
              />

              <OutcomeSection form={form} patch={patch} disabled={isReadOnly} />

              <FinalDocumentsSection
                form={form}
                onSelectDocument={selectDocument}
                onClearDocument={clearDocument}
                errors={errors}
                disabled={isReadOnly}
              />
            </>
          )}

          <section className="pf-card pf-card--inline">
            <div className="pf-card__header pf-card__header--inline">
              <h2 className="pf-card__title">Remarks</h2>
              <div className="pf-card__header-right" />
            </div>
            <div className="pf-card__body">
              <textarea
                className="pf-input pf-textarea"
                rows={2}
                value={form.remarks}
                onChange={(event) => patch({ remarks: event.target.value })}
                disabled={isReadOnly}
                aria-label="Remarks"
              />
            </div>
          </section>

          {!isReadOnly && (
            <div className="pf-actions">
              <button
                type="submit"
                className="pf-btn pf-btn--primary pf-btn--lg"
                disabled={status === 'saving'}
              >
                {status === 'saving' ? 'Saving…' : isExisting ? 'Save changes' : 'Save project'}
              </button>
            </div>
          )}
        </form>
      </div>

      <RequestOptionModal
        show={showRequestModal}
        onHide={() => setShowRequestModal(false)}
        organizations={lookups.organizations}
        defaultOrganizationId={form.fundingOrganizationId}
      />
    </div>
  );
};

export default ProjectForm;
