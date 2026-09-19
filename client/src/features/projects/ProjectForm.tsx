import { AlertCircle, Info, Loader2, Pencil } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import RequestOptionModal from './components/RequestOptionModal';
import {
  DOCUMENT_ACCEPT,
  MAX_DOCUMENT_BYTES,
  PROJECT_FORM_TABS,
  hasReachedProposalStage,
} from './constants';
import { toAmount } from './projectBudgetSummary';
import {
  createEmptyProjectForm,
  emptyDocumentSlot,
  projectToFormState,
  replaceAt,
} from './projectFormState';
import projectsApi, { ProjectSaveError } from './projectsApi';
import BudgetAllotmentSection from './sections/BudgetAllotmentSection';
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
import TransactionAccountsSection from './sections/TransactionAccountsSection';
import TransactionSummarySection from './sections/TransactionSummarySection';
import { financeOrganizations } from './selectOptions';
import AlertModal from '../../shared/components/ui/AlertModal';

import type { ProjectFormTab } from './constants';
import type {
  DisbursementSlot,
  ProjectAccess,
  ProjectDocumentType,
  ProjectFormState,
  ProjectLookups,
} from './types';
import './projectForm.css';

const emptyLookups: ProjectLookups = {
  organizations: [],
  schemes: [],
  departments: [],
  accounts: [],
  budgetHeads: [],
};

/**
 * The tab an error belongs to, so a failed save can open the tab holding the
 * first problem rather than leaving the user on one that looks fine. Field
 * paths come from the server (and are mirrored by `validate` below).
 */
function tabForField(field: string): ProjectFormTab {
  if (field.startsWith('budget.')) return 'budget';
  if (field.startsWith('transaction_accounts')) return 'transaction';
  return 'details';
}

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

  form.transactionAccounts.forEach((account, blockIndex) => {
    const filledRows = account.transactions.filter(
      (row) =>
        row.transactionDate ||
        row.headName ||
        row.particulars ||
        row.referenceNo ||
        row.credit ||
        row.debit,
    );

    // An account option that was removed leaves the block holding only its
    // name snapshot, which `normalizeTransactionAccounts` accepts — so blocking
    // the save here would strand the ledger.
    if (!account.accountOptionId && !account.accountName && filledRows.length > 0) {
      errors[`transaction_accounts[${blockIndex}].account`] =
        'Select the account these transactions belong to.';
    }

    account.transactions.forEach((row, rowIndex) => {
      if (!filledRows.includes(row)) return;
      const field = `transaction_accounts[${blockIndex}].transactions[${rowIndex}]`;

      if (!row.transactionDate) errors[`${field}.transaction_date`] = 'Enter the date.';
      if (!row.headName) errors[`${field}.head`] = 'Select a budget head.';

      const credit = toAmount(row.credit);
      const debit = toAmount(row.debit);
      if (credit > 0 === debit > 0) {
        errors[`${field}.amount`] =
          credit > 0
            ? 'A transaction is either a credit or a debit, not both.'
            : 'Enter a credit or a debit amount.';
      }
    });
  });

  return errors;
}

const ProjectForm: React.FC = () => {
  const { id: routeProjectId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProjectFormState>(createEmptyProjectForm);
  const [lookups, setLookups] = useState<ProjectLookups>(emptyLookups);
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // What went wrong with the last save, as the dialog says it. The per-field
  // messages in `errors` still mark every offending field in place; this is the
  // summary that fronts them, because the Save button sits at the foot of a
  // long form and a message beside it would be read after the fact, if at all.
  const [saveProblem, setSaveProblem] = useState<{ title: string; messages: string[] } | null>(
    null,
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [loadError, setLoadError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ProjectFormTab>('details');

  /**
   * Arrow, Home and End move between the tabs and select the one they land on;
   * the roving `tabIndex` keeps the selected tab as the tablist's only tab
   * stop, so focus follows the selection rather than trailing behind it.
   */
  const moveTabFocus = (event: React.KeyboardEvent<HTMLButtonElement>, fromIndex: number) => {
    const lastIndex = PROJECT_FORM_TABS.length - 1;
    const nextIndex = {
      ArrowRight: fromIndex === lastIndex ? 0 : fromIndex + 1,
      ArrowLeft: fromIndex === 0 ? lastIndex : fromIndex - 1,
      Home: 0,
      End: lastIndex,
    }[event.key];

    if (nextIndex === undefined) return;

    event.preventDefault();
    setActiveTab(PROJECT_FORM_TABS[nextIndex].id);
    const nextTab = event.currentTarget.parentElement?.children[nextIndex];
    if (nextTab instanceof HTMLElement) nextTab.focus();
  };

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

  // A proposal that was not selected has nothing to sanction, nothing to
  // disburse and no project to run, so those three sections stay hidden until
  // the result says it was — the stage note below names what unlocks them.
  // Anything already captured stays in state and is still saved, so a result
  // corrected back to Selected finds its sanction details intact.
  const isSelected = form.finalResult === 'selected';

  // Outcomes and final documents are what a project leaves behind, so they stay
  // hidden until it has finished. `isSelected` is carried through rather than assumed
  // from the status: a project recorded as Completed and then corrected to Not
  // Selected would otherwise keep these two open while everything above them
  // locked.
  const isConcluded =
    isSelected && (form.projectStatus === 'completed' || form.projectStatus === 'closed');

  // The two finance tables record money moving between this project's own
  // parties, so they offer those rather than the whole master list — see
  // `financeOrganizations`. Derived from the form, so adding a collaborator
  // makes it selectable on both tables straight away.
  const financeParties = useMemo(
    () =>
      financeOrganizations(lookups.organizations, {
        fundingOrganizationId: form.fundingOrganizationId,
        collaborators: form.collaborators,
        collaboratorsEnabled: form.collaboratorsEnabled,
      }),
    [
      lookups.organizations,
      form.fundingOrganizationId,
      form.collaborators,
      form.collaboratorsEnabled,
    ],
  );

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

    const [firstField] = Object.keys(validationErrors);
    if (firstField) {
      // The tab carrying the first problem, so dismissing the dialog leaves the
      // marked fields on screen rather than on a tab nobody was looking at.
      setActiveTab(tabForField(firstField));
      const messages = Object.values(validationErrors);
      setSaveProblem({
        title:
          messages.length === 1
            ? '1 item needs attention'
            : `${messages.length} items need attention`,
        messages,
      });
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

      const fieldMessages =
        error instanceof ProjectSaveError && error.fieldErrors.length > 0
          ? error.fieldErrors.map((fieldError) => fieldError.message)
          : [];

      if (error instanceof ProjectSaveError && error.fieldErrors.length > 0) {
        setErrors(
          error.fieldErrors.reduce<Record<string, string>>((map, fieldError) => {
            map[fieldError.field] = fieldError.message;
            return map;
          }, {}),
        );
        setActiveTab(tabForField(error.fieldErrors[0].field));
      }

      setLoadError('');
      setSaveMessage('');
      const summary = (error as Error).message || 'The project could not be saved.';
      setErrors((previous) => ({ ...previous, __form: summary }));
      // The server's own account of the failure, with whatever it named field
      // by field underneath it.
      setSaveProblem({ title: 'Could not save', messages: [summary, ...fieldMessages] });
    }
  };

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

        {/* A failed save is reported in a dialog rather than a strip up here:
            the Save button is at the foot of a long, tabbed form, and the page
            scrolls inside the layout's `.app-content`, so a banner at the top
            of the page opened where nobody standing at the button could see it.
            The fields themselves stay marked underneath — the dialog names what
            is wrong, the form still shows where. */}
        <AlertModal
          show={Boolean(saveProblem)}
          onHide={() => setSaveProblem(null)}
          type="warning"
          title={saveProblem?.title}
          message={
            <>
              <div className="mb-2">Please fix the following before saving:</div>
              <ul className="mb-0 ps-3">
                {saveProblem?.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </>
          }
        />

        {/* One form across every tab: switching tab only changes what is on
            screen, and the single Save below writes the whole project. */}
        <div className="pf-tabs" role="tablist" aria-label="Project form sections">
          {PROJECT_FORM_TABS.map((tab, tabIndex) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`pf-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`pf-panel-${tab.id}`}
              // The tablist is one stop in the tab sequence, and the arrow keys
              // move within it — what the `tab` role tells a screen reader to
              // expect.
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`pf-tabs__tab ${activeTab === tab.id ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => moveTabFocus(event, tabIndex)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="pf-form" noValidate>
          <div
            role="tabpanel"
            id="pf-panel-details"
            aria-labelledby="pf-tab-details"
            hidden={activeTab !== 'details'}
            className="pf-panel"
          >
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
              organizations={financeParties}
              budgetHeads={lookups.budgetHeads}
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
              organizations={financeParties}
              budgetHeads={lookups.budgetHeads}
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

                {!isSelected && (
                  <p className="pf-stage-note">
                    Set <strong>Final Result</strong> to <strong>Selected</strong> to record the
                    sanction, the grant disbursements and the project status.
                  </p>
                )}

                {isSelected && (
                  <>
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
                  </>
                )}

                {isSelected && !isConcluded && (
                  <p className="pf-stage-note">
                    Set <strong>Status</strong> to <strong>Completed</strong> or{' '}
                    <strong>Closed</strong> to record the outcomes and the final documents.
                  </p>
                )}

                {isConcluded && (
                  <>
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
              </>
            )}

            <section className="pf-card pf-card--inline">
              <div className="pf-card__header pf-card__header--inline">
                <h2 className="pf-card__title">Remarks</h2>
                <div className="pf-card__header-right" />
              </div>
              <div className="pf-card__body">
                <textarea
                  className="pf-input pf-textarea pf-textarea--remarks"
                  rows={1}
                  value={form.remarks}
                  onChange={(event) => patch({ remarks: event.target.value })}
                  disabled={isReadOnly}
                  aria-label="Remarks"
                />
              </div>
            </section>
          </div>

          <div
            role="tabpanel"
            id="pf-panel-budget"
            aria-labelledby="pf-tab-budget"
            hidden={activeTab !== 'budget'}
            className="pf-panel"
          >
            <BudgetAllotmentSection
              form={form}
              patch={patch}
              budgetHeads={lookups.budgetHeads}
              errors={errors}
              disabled={isReadOnly}
            />
          </div>

          <div
            role="tabpanel"
            id="pf-panel-transaction"
            aria-labelledby="pf-tab-transaction"
            hidden={activeTab !== 'transaction'}
            className="pf-panel"
          >
            <TransactionAccountsSection
              form={form}
              patch={patch}
              accounts={lookups.accounts}
              errors={errors}
              disabled={isReadOnly}
            />
          </div>

          {/* Nothing on this tab is an input: Budget comes from the allotment
              matrix and Actuals from the ledger, so it reads the two tabs
              before it rather than adding anything of its own to save. */}
          <div
            role="tabpanel"
            id="pf-panel-summary"
            aria-labelledby="pf-tab-summary"
            hidden={activeTab !== 'summary'}
            className="pf-panel"
          >
            <TransactionSummarySection form={form} />
          </div>

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
