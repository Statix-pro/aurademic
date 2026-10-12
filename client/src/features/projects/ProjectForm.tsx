import { AlertCircle, Loader2, Pencil } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import RequestOptionModal from './components/RequestOptionModal';
import {
  DOCUMENT_ACCEPT,
  FINAL_DOCUMENT_TYPES,
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
import DocumentTransactionsSection from './sections/DocumentTransactionsSection';
import FacilitiesSection from './sections/FacilitiesSection';
import FinalDocumentsSection from './sections/FinalDocumentsSection';
import FinanceRowsSection from './sections/FinanceRowsSection';
import GrantDisbursementSection from './sections/GrantDisbursementSection';
import IncomeHeadsSection from './sections/IncomeHeadsSection';
import InvestigatorsSection from './sections/InvestigatorsSection';
import IprsSection from './sections/IprsSection';
import ManpowerSection from './sections/ManpowerSection';
import OutcomeCandidatesSection from './sections/OutcomeCandidatesSection';
import OutcomeSummarySection from './sections/OutcomeSummarySection';
import PresentationSection from './sections/PresentationSection';
import ProjectStatusSection from './sections/ProjectStatusSection';
import ProposalDetailsSection from './sections/ProposalDetailsSection';
import PublicationsSection from './sections/PublicationsSection';
import ResultAnnouncementSection from './sections/ResultAnnouncementSection';
import SanctionDetailsSection from './sections/SanctionDetailsSection';
import SubmissionDetailsSection from './sections/SubmissionDetailsSection';
import TechTransfersSection from './sections/TechTransfersSection';
import TransactionAccountsSection from './sections/TransactionAccountsSection';
import TransactionSummarySection from './sections/TransactionSummarySection';
import { financeOrganizations } from './selectOptions';
import AlertModal from '../../shared/components/ui/AlertModal';
import ViewModeBanner from '../../shared/components/ui/ViewModeBanner';

import type { ProjectFormTab } from './constants';
import type {
  DisbursementSlot,
  DocumentSlotState,
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
  // Budget Sharing sits on the Budget tab, beside the allotment it shares out.
  if (field.startsWith('sharing_rows')) return 'budget';
  if (field.startsWith('transaction_accounts')) return 'transaction';
  if (field.startsWith('facilities')) return 'facility';
  if (field.startsWith('manpower')) return 'manpower';
  if (
    ['publications', 'iprs', 'tech_transfers', 'outcome_candidates'].some((prefix) =>
      field.startsWith(prefix),
    )
  ) {
    return 'outcomes';
  }
  if (field.startsWith('document_transactions')) return 'documents';
  // The final documents sit on the Documents tab; the presentation and
  // sanction order slots stay on Details beside the sections they belong to.
  if (FINAL_DOCUMENT_TYPES.some((type) => field === `document__${type}`)) return 'documents';
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
    // Every field the server's own blank-row filter counts, so both sides agree
    // on which rows have been started — a row carrying only a mode or only a
    // contributor is one the server will save and then reject for its missing
    // date and head, and this is what marks those fields before the round trip.
    const filledRows = account.transactions.filter(
      (row) =>
        row.transactionDate ||
        row.headName ||
        row.particulars ||
        row.referenceNo ||
        row.paymentMode ||
        row.contributionOrganizationId ||
        row.contributionOrganizationName ||
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

  form.facilities.forEach((row, index) => {
    // The fields the server's blank-row filter counts, so both sides agree on
    // which rows have been started. A cost of 0 is blank there too.
    const started =
      row.facilityName.trim() ||
      row.facilityType ||
      row.installationDate ||
      toAmount(row.cost) > 0 ||
      row.make.trim() ||
      row.model.trim() ||
      row.serialNo.trim() ||
      row.stockRegisterRef.trim() ||
      row.istemListed ||
      row.supplierDetails.trim();
    if (!started) return;

    const field = `facilities[${index}]`;
    if (!row.facilityName.trim()) errors[`${field}.facility_name`] = 'Facility name is required.';
    if (row.istemListed && !row.istemId.trim())
      errors[`${field}.istem_id`] = 'Enter the I-STEM ID.';
  });

  form.manpower.forEach((row, index) => {
    // The fields the server's blank-row filter counts. A saved row (one with
    // an id) or one carrying a profile counts as started there too.
    const started =
      row.id ||
      row.role ||
      row.name.trim() ||
      row.qualification.trim() ||
      toAmount(row.salary) > 0 ||
      row.joiningDate ||
      row.mobile.trim() ||
      row.email.trim() ||
      row.remarks.trim() ||
      row.relievingDate ||
      row.documents.profile.file;
    if (!started) return;

    const field = `manpower[${index}]`;
    if (!row.role) errors[`${field}.role`] = 'Select a role.';
    if (!row.name.trim()) errors[`${field}.name`] = 'Name is required.';
    const mobileDigits = row.mobile.replace(/[\s-]/g, '').replace(/^\+91/, '');
    if (row.mobile.trim() && !/^\d{10}$/.test(mobileDigits)) {
      errors[`${field}.mobile`] = 'Enter a 10-digit mobile number.';
    }
    if (row.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
      errors[`${field}.email`] = 'Enter a valid email address.';
    }
    if (row.joiningDate && row.relievingDate && row.relievingDate < row.joiningDate) {
      errors[`${field}.relieving_date`] = 'Date of relieving cannot be before the date of joining.';
    }
  });

  // The Outcomes tab: the same started-row tests and required fields as the
  // server's normalizers.
  form.publications.forEach((row, index) => {
    const started =
      row.publicationType ||
      row.doi.trim() ||
      row.journalId ||
      row.title.trim() ||
      row.venue.trim() ||
      row.publicationYear.trim();
    if (!started) return;

    const field = `publications[${index}]`;
    if (!row.publicationType) errors[`${field}.publication_type`] = 'Select a type.';
    if (!row.doi.trim() && !row.title.trim()) {
      errors[`${field}.doi`] = 'Enter the DOI or the title.';
    }
  });

  form.iprs.forEach((row, index) => {
    const started =
      row.iprType ||
      row.iprNumber.trim() ||
      row.status ||
      row.title.trim() ||
      row.filingDate ||
      row.grantDate;
    if (!started) return;

    const field = `iprs[${index}]`;
    if (!row.iprType) errors[`${field}.ipr_type`] = 'Select a type.';
    if (!row.iprNumber.trim() && !row.title.trim()) {
      errors[`${field}.ipr_number`] = 'Enter the IPR number or the title.';
    }
    if (row.filingDate && row.grantDate && row.grantDate < row.filingDate) {
      errors[`${field}.grant_date`] = 'Grant date cannot be before the filing date.';
    }
  });

  form.techTransfers.forEach((row, index) => {
    const started =
      row.id || row.category || row.description.trim() || row.trl || row.documents.document.file;
    if (started && !row.category) {
      errors[`tech_transfers[${index}].category`] = 'Select a category.';
    }
  });

  form.outcomeCandidates.forEach((row, index) => {
    const started =
      row.id ||
      row.candidateName.trim() ||
      row.degree ||
      row.university.trim() ||
      row.documents.document.file;
    if (!started) return;

    const field = `outcome_candidates[${index}]`;
    if (!row.candidateName.trim())
      errors[`${field}.candidate_name`] = 'Candidate name is required.';
    if (!row.degree) errors[`${field}.degree`] = 'Select a degree.';
  });

  form.documentTransactions.forEach((row, index) => {
    const started =
      row.id ||
      row.transactionDate ||
      row.direction ||
      row.documentKind ||
      row.description.trim() ||
      row.documents.document.file;
    if (!started) return;

    const field = `document_transactions[${index}]`;
    if (!row.transactionDate) errors[`${field}.transaction_date`] = 'Enter the date.';
    if (!row.direction) errors[`${field}.direction`] = 'Select inward or outward.';
    if (!row.documentKind) errors[`${field}.document_kind`] = 'Select the document.';
  });

  return errors;
}

/**
 * The row lists whose rows each carry their own uploads, with the prefix their
 * error paths use — `manpower[0].profile`, `tech_transfers[2].document`.
 */
const ROW_DOCUMENT_LISTS = {
  manpower: 'manpower',
  techTransfers: 'tech_transfers',
  outcomeCandidates: 'outcome_candidates',
  documentTransactions: 'document_transactions',
} as const;

type RowDocumentList = keyof typeof ROW_DOCUMENT_LISTS;

/** Error paths whose first segment does not name the form-state key it belongs to. */
const ERROR_SECTION_ALIASES: Record<string, (keyof ProjectFormState)[]> = {
  budget: ['budgetRows', 'budgetYears', 'budgetAllotments', 'incomeHeads'],
  contribution_rows: ['financialContributions'],
  sharing_rows: ['financeSharing'],
};

/**
 * The part of the form an error path is about — `transaction_accounts[0]…` is
 * `transactionAccounts`, `duration_years` is `durationYears`. `null` when the
 * path names nothing the form holds, which the caller treats as "any edit may
 * have fixed it".
 */
function errorSections(key: string, form: ProjectFormState): (keyof ProjectFormState)[] | null {
  const head = key.split(/[.[]/)[0];
  if (ERROR_SECTION_ALIASES[head]) return ERROR_SECTION_ALIASES[head];
  const camel = head.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  return camel in form ? [camel as keyof ProjectFormState] : null;
}

/**
 * The errors still true of `form`, out of those a failed save left behind.
 *
 * Without this a field stayed red after it was fixed — the marks came from the
 * save attempt and nothing cleared them until the next one. A rule the client
 * checks itself is re-run, so its mark goes the moment it is satisfied and
 * follows the row if rows move. One only the server knows (a duration past its
 * cap, a malformed email) cannot be re-checked here, so it goes once the part
 * of the form it names has been edited. Nothing is added: a field the user has
 * not reached yet does not turn red mid-edit.
 */
function reconcileErrors(
  errors: Record<string, string>,
  form: ProjectFormState,
  baseline: ProjectFormState,
): Record<string, string> {
  const flaggedByClient = validate(baseline);
  const live = validate(form);
  const next: Record<string, string> = {};

  Object.entries(errors).forEach(([key, message]) => {
    // The save summary and a rejected upload are not about a form value; the
    // next save and the next pick replace them.
    if (key === '__form' || key.startsWith('document__')) {
      next[key] = message;
      return;
    }
    if (key in flaggedByClient) {
      if (key in live) next[key] = live[key];
      return;
    }
    const sections = errorSections(key, form);
    if (sections && sections.every((section) => form[section] === baseline[section])) {
      next[key] = message;
    }
  });

  return next;
}

const ProjectForm: React.FC = () => {
  const { id: routeProjectId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProjectFormState>(createEmptyProjectForm);
  const [lookups, setLookups] = useState<ProjectLookups>(emptyLookups);
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The form as it stood when the last save failed — what `reconcileErrors`
  // measures each edit against.
  const errorBaselineRef = useRef<ProjectFormState | null>(null);
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

  // The final documents (on the Documents tab) are what a project leaves
  // behind, so they stay hidden until it has finished. `isSelected` is carried
  // through rather than assumed from the status: a project recorded as
  // Completed and then corrected to Not Selected would otherwise keep them open
  // while everything that led to them locked.
  const isConcluded =
    isSelected && (form.projectStatus === 'completed' || form.projectStatus === 'closed');

  // The two finance tables, Grant Disbursement, the Budget Allotment matrix's
  // Contribution column and the ledger's own Contribution field record money
  // moving between this project's own parties, so they offer those rather than
  // the whole master list — see `financeOrganizations`. Derived from the form,
  // so adding a collaborator makes it selectable everywhere straight away.
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

  // Budget Sharing is money this project passes on to other parties, and the
  // funding agency is where the money came from rather than somewhere it goes —
  // so it is the one party the sharing table does not offer. A row already
  // saved against it still shows it: `FinanceRowsSection` re-offers a stored
  // selection through `withSelectedOption`, so this never rewrites a saved row.
  const sharingParties = useMemo(
    () => financeParties.filter((organization) => organization.id !== form.fundingOrganizationId),
    [financeParties, form.fundingOrganizationId],
  );

  const patch = useCallback(
    (changes: Partial<ProjectFormState>) => setForm((previous) => ({ ...previous, ...changes })),
    [],
  );

  useEffect(() => {
    const baseline = errorBaselineRef.current;
    if (!baseline || form === baseline) return;
    setErrors((previous) => reconcileErrors(previous, form, baseline));
  }, [form]);

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

  // Rows that carry their own uploads — a manpower profile, a tech-transfer or
  // candidate document. Unlike the tranche slots, these cells show their error,
  // so a good pick has to take the last bad one's message away with it.
  const selectRowDocument = (list: RowDocumentList, rowIndex: number, slot: string, file: File) => {
    const problem = checkFile(file);
    const errorKey = `${ROW_DOCUMENT_LISTS[list]}[${rowIndex}].${slot}`;
    if (problem) {
      setErrors((previous) => ({ ...previous, [errorKey]: problem }));
      return;
    }

    setErrors((previous) => {
      const next = { ...previous };
      delete next[errorKey];
      return next;
    });

    const rows = form[list] as Array<{ documents: Record<string, DocumentSlotState> }>;
    patch({
      [list]: replaceAt(rows, rowIndex, {
        documents: {
          ...rows[rowIndex].documents,
          [slot]: { file, filePath: '', originalName: file.name, removed: false },
        },
      }),
    });
  };

  const clearRowDocument = (list: RowDocumentList, rowIndex: number, slot: string) => {
    const rows = form[list] as Array<{ documents: Record<string, DocumentSlotState> }>;
    const current = rows[rowIndex].documents[slot];

    patch({
      [list]: replaceAt(rows, rowIndex, {
        documents: {
          ...rows[rowIndex].documents,
          // A stored file is only deleted on save, so the path is kept and the
          // slot is marked as cleared.
          [slot]: current.filePath
            ? { ...emptyDocumentSlot(), filePath: current.filePath, removed: true }
            : emptyDocumentSlot(),
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
    errorBaselineRef.current = form;
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

      errorBaselineRef.current = null;
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
            the save confirmation appears up here. */}
        {saveMessage && (
          <div className="pf-page__header">
            <span className="pf-page__saved">{saveMessage}</span>
          </div>
        )}

        {/* Same banner as the journal form: read-only, and the way into editing
            when the viewer is allowed to. */}
        {!canEdit ? (
          <ViewModeBanner locked message="Only the principal investigator can edit this project." />
        ) : (
          isViewMode && (
            <ViewModeBanner
              message="This project is open read-only. You can edit it directly."
              action={{
                label: 'Edit now',
                icon: <Pencil size={15} aria-hidden="true" />,
                onClick: () => setSearchParams({}, { replace: true }),
              }}
            />
          )
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

            <SubmissionDetailsSection
              form={form}
              patch={patch}
              errors={errors}
              disabled={isReadOnly}
            />

            {!showPresentation && (
              <p className="pf-stage-note">
                Set the status to <strong>Shortlisted for Presentation</strong> to record the
                presentation, and to <strong>Result Announced</strong> for the sanction and the
                disbursements.
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
                Set the status to <strong>Result Announced</strong> to record the sanction and the
                disbursements.
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
                      organizations={financeParties}
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
            <IncomeHeadsSection
              value={form.incomeHeads}
              onChange={(incomeHeads) => patch({ incomeHeads })}
              disabled={isReadOnly}
            />

            <FinanceRowsSection
              title="Budget Sharing"
              errorPrefix="sharing_rows"
              rows={form.financeSharing}
              onChange={(rows) => patch({ financeSharing: rows })}
              enabled={form.financeSharingEnabled}
              onToggle={(enabled) => patch({ financeSharingEnabled: enabled })}
              organizations={sharingParties}
              budgetHeads={lookups.budgetHeads}
              errors={errors}
              disabled={isReadOnly}
            />

            <BudgetAllotmentSection
              form={form}
              patch={patch}
              budgetHeads={lookups.budgetHeads}
              organizations={financeParties}
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
              organizations={financeParties}
              errors={errors}
              disabled={isReadOnly}
            />
          </div>

          <div
            role="tabpanel"
            id="pf-panel-facility"
            aria-labelledby="pf-tab-facility"
            hidden={activeTab !== 'facility'}
            className="pf-panel"
          >
            <FacilitiesSection
              rows={form.facilities}
              patch={patch}
              errors={errors}
              disabled={isReadOnly}
            />
          </div>

          <div
            role="tabpanel"
            id="pf-panel-manpower"
            aria-labelledby="pf-tab-manpower"
            hidden={activeTab !== 'manpower'}
            className="pf-panel"
          >
            <ManpowerSection
              rows={form.manpower}
              patch={patch}
              onSelectDocument={(rowIndex, slot, file) =>
                selectRowDocument('manpower', rowIndex, slot, file)
              }
              onClearDocument={(rowIndex, slot) => clearRowDocument('manpower', rowIndex, slot)}
              errors={errors}
              disabled={isReadOnly}
            />
          </div>

          {/* Open at every stage, unlike the Details tab's later sections: a
              paper or a patent filing can come out of a project long before it
              is completed. */}
          <div
            role="tabpanel"
            id="pf-panel-outcomes"
            aria-labelledby="pf-tab-outcomes"
            hidden={activeTab !== 'outcomes'}
            className="pf-panel"
          >
            <OutcomeSummarySection form={form} />

            <PublicationsSection
              rows={form.publications}
              patch={patch}
              errors={errors}
              disabled={isReadOnly}
            />

            <IprsSection rows={form.iprs} patch={patch} errors={errors} disabled={isReadOnly} />

            <TechTransfersSection
              rows={form.techTransfers}
              patch={patch}
              onSelectDocument={(rowIndex, slot, file) =>
                selectRowDocument('techTransfers', rowIndex, slot, file)
              }
              onClearDocument={(rowIndex, slot) =>
                clearRowDocument('techTransfers', rowIndex, slot)
              }
              errors={errors}
              disabled={isReadOnly}
            />

            <OutcomeCandidatesSection
              rows={form.outcomeCandidates}
              patch={patch}
              onSelectDocument={(rowIndex, slot, file) =>
                selectRowDocument('outcomeCandidates', rowIndex, slot, file)
              }
              onClearDocument={(rowIndex, slot) =>
                clearRowDocument('outcomeCandidates', rowIndex, slot)
              }
              errors={errors}
              disabled={isReadOnly}
            />
          </div>

          <div
            role="tabpanel"
            id="pf-panel-documents"
            aria-labelledby="pf-tab-documents"
            hidden={activeTab !== 'documents'}
            className="pf-panel"
          >
            <DocumentTransactionsSection
              rows={form.documentTransactions}
              patch={patch}
              onSelectDocument={(rowIndex, slot, file) =>
                selectRowDocument('documentTransactions', rowIndex, slot, file)
              }
              onClearDocument={(rowIndex, slot) =>
                clearRowDocument('documentTransactions', rowIndex, slot)
              }
              errors={errors}
              disabled={isReadOnly}
            />

            {/* Still what a project leaves behind, so still held until it has
                finished — the same rule as when this card sat on Details. */}
            {isConcluded ? (
              <FinalDocumentsSection
                form={form}
                onSelectDocument={selectDocument}
                onClearDocument={clearDocument}
                errors={errors}
                disabled={isReadOnly}
              />
            ) : (
              <p className="pf-stage-note">
                The final documents open once the project is <strong>Selected</strong> and its{' '}
                <strong>Status</strong> is <strong>Completed</strong> or <strong>Closed</strong>.
              </p>
            )}
          </div>

          {/* Nothing on this tab is an input: Budget comes from the allotment
              matrix and Actuals from the ledger, so it reads the Budget and
              Transaction tabs rather than adding anything of its own to save. */}
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
