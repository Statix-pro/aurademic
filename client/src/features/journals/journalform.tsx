import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';

import { AddPublisherModal, PublisherSelect } from './PublisherPicker';
import { useAuth } from '../../contexts/AuthContext';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import CustomModal from '../../shared/components/ui/CustomModal';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
import ViewModeBanner from '../../shared/components/ui/ViewModeBanner';
import authenticityUtility from '../../shared/utils/authenticityUtility';

import './journalform.css';
import '../../shared/styles/forms.css';
import '../../shared/components/ui/common.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import {
  Trash2,
  Plus,
  GripVertical,
  ChevronDown,
  Upload,
  FileText,
  CheckCircle,
  ExternalLink,
  Info,
  Bell,
  Pencil,
} from 'lucide-react';

// Type definitions
interface Author {
  id: number;
  dbAuthorId?: string;
  author_id: string;
  register_no: string;
  name: string;
  department: string;
  organization: string;
  country: string;
  state: string;
  designation: 'faculty' | 'student' | 'external';
  is_first_author: boolean;
  is_primary: boolean;
  email?: string;
}

interface JournalDetails {
  name: string;
  publisher: string;
  printISSN: string;
  onlineISSN: string;
  website: string;
}

interface PublicationDetails {
  conference_title: string;
  /**
   * LEGACY: no longer on the form. Records filed before the 2026-10 redesign may carry
   * it, so it is loaded and saved back untouched rather than wiped. Remove once nothing
   * reads publication_details.source.
   */
  source: string;
  publisher: string;
  /** The publisher master row; null for a record filed before the master existed. */
  publisher_id?: number | null;
  print_isbn: string;
  online_isbn: string;
  city?: string;
  dates?: string;
}

/**
 * The registry's website is admin-entered text. Link it only when it is a web address
 * (adding https:// to a bare domain), never a javascript: or other scheme.
 */
const toExternalHref = (website: string | undefined): string => {
  const value = (website || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
  return `https://${value}`;
};

interface Metrics {
  impactFactor: boolean;
  citeScore: boolean;
  dateOfSubmission: boolean;
  volume: boolean;
  issue: boolean;
  pages: boolean;
  articleNumber: boolean;
  doi: boolean;
  acceptedForPublication: boolean;
  availableOnline: boolean;
}

interface Acknowledgements {
  Nil: boolean;
  'DST-FIST': boolean;
  MODROBS: boolean;
  Others: boolean;
}

interface JournalRequest {
  journal_name: string;
  publisher: string;
  website: string;
  print_issn: string;
  online_issn: string;
  impact_factor: string;
  cite_score: string;
  category: string;
}

interface StatusUpdate {
  id: number;
  status: string;
  user_comment: string;
  admin_reply?: string;
  created_at: string;
}

interface NewStatusUpdate {
  status: string;
  userComment: string;
}

interface UploadedFile {
  path: string;
  name: string;
}

interface ExternalAuthorDetails {
  name: string;
  department: string;
  organization: string;
  country: string;
  state: string;
  email?: string;
  is_first_author: boolean;
  is_primary: boolean;
}

type PageOrArticleChoice = 'pages' | 'article';
type EditRequestStatus = 'pending' | 'approved' | 'rejected' | 'none' | null;
type ApprovalWorkflowStatus = 'pending' | 'approved' | 'rejected';

const normalizeApprovalStatus = (value: string | null | undefined): ApprovalWorkflowStatus => {
  if (value === 'approved' || value === 'rejected') {
    return value;
  }

  return 'pending';
};

const dedupeTagsCaseInsensitive = (values: string[] = []): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const raw of values) {
    const normalized = String(raw || '').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
};

// Every internal (faculty/student) author belongs to the host institution; the
// author search hardcodes the same string server-side.
const DEFAULT_ORGANIZATION = 'K.S.Rangasamy College of Technology';

interface JournalFormProps {
  /** Show this publication instead of taking the id from the route. */
  journalId?: string | number;
  /** Force view or edit instead of reading `?mode=` from the URL. */
  mode?: 'view' | 'edit';
  /**
   * Rendered inside another page (the admin dashboard) rather than on its own route, so
   * the form must not rewrite the browser URL — that URL belongs to the host page.
   */
  embedded?: boolean;
}

const JournalForm: React.FC<JournalFormProps> = ({
  journalId: journalIdProp,
  mode: modeProp,
  embedded = false,
}) => {
  const { journalId: routeJournalId } = useParams<{ journalId?: string }>();
  const urlJournalId = journalIdProp != null ? String(journalIdProp) : routeJournalId;

  /**
   * The form flips between view and edit by rewriting `?mode=`. When it is embedded there
   * is no such query string to own, so the mode comes from the prop and the URL is left
   * alone.
   */
  const syncModeToUrl = useCallback(
    (nextMode: 'view' | 'edit') => {
      if (embedded) return;
      const url = new URL(window.location.href);
      url.searchParams.set('mode', nextMode);
      window.history.replaceState({}, '', url.toString());
    },
    [embedded],
  );
  const { user } = useAuth();
  // Mirrors the server's admin override: admins edit an approved publication directly
  // instead of going through the edit-request workflow.
  const hasAdminOverride = Boolean(user?.is_admin || user?.is_super_admin);
  const MAX_AUTHORS = 10;

  // Feedback goes through the app's own modal rather than window.alert, which cannot be
  // styled, blocks the page, and shows the browser's origin instead of the product.
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
  }>({ show: false, message: '', type: 'info' });

  const closeAlert = () => setAlertConfig((prev) => ({ ...prev, show: false }));

  const showAlert = (message: React.ReactNode, type: AlertType = 'info', title?: string) => {
    setAlertConfig({ show: true, message, type, title });
  };

  // All Sustainable Development Goals
  const allSDGs = [
    '1. No Poverty',
    '2. Zero Hunger',
    '3. Good Health and Well-being',
    '4. Quality Education',
    '5. Gender Equality',
    '6. Clean Water and Sanitation',
    '7. Affordable and Clean Energy',
    '8. Decent Work and Economic Growth',
    '9. Industry, Innovation and Infrastructure',
    '10. Reduced Inequality',
    '11. Sustainable Cities and Communities',
    '12. Responsible Consumption and Production',
    '13. Climate Action',
    '14. Life Below Water',
    '15. Life on Land',
    '16. Peace and Justice Strong Institutions',
    '17. Partnerships for the Goals',
  ];

  // Available Collaboration options
  const allCollaborations = ['International', 'IITs', 'NITs', 'National Research Labs', 'Nil'];

  // Available Acknowledgement options
  const allAcknowledgements = ['Nil', 'DST-FIST', 'MODROBS'];

  // Add defensive state initialization
  const initializeArrayState = <T,>(defaultValue: T, length: number = MAX_AUTHORS): T[] => {
    try {
      return Array(length).fill(defaultValue);
    } catch (error) {
      console.error('Error initializing array state:', error);
      return Array(length).fill(defaultValue);
    }
  };

  const [journalId, setJournalId] = useState<string | undefined>(urlJournalId);
  const justAddedAuthorRef = useRef<boolean>(false); // Track if author was just added
  const isLoadingJournalDataRef = useRef<boolean>(false); // Track if journal data is being loaded programmatically
  // Numbers each journal search so only the latest one may open the list: an older answer
  // arriving late, or one still in flight when a journal is picked, is dropped.
  const journalSearchSeqRef = useRef<number>(0);
  const journalSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Debounce
  const activeAuthorSearchIndexRef = useRef<number | null>(null); // Row whose search input currently has focus
  const authorSearchTokenRef = useRef<number[]>([]); // Latest request token per row, to drop stale responses
  const authorSearchTimerRef = useRef<Array<ReturnType<typeof setTimeout> | null>>([]); // Per-row debounce timers
  // author_journal link ids present when the publication was loaded, so a save can tell
  // which authors the user removed and delete those links on the server.
  const loadedAuthorLinkIdsRef = useRef<string[]>([]);
  const [isInternational, setIsInternational] = useState<boolean>(false);
  // Which journal_options row the user picked. Sent with the submission so the server
  // links to exactly that entry rather than re-resolving an ambiguous journal name.
  const [journalOptionsId, setJournalOptionsId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<boolean>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');
    if (mode === 'edit') return true;
    if (mode === 'view') return false;
    return !urlJournalId;
  });
  const [editRequestStatus, setEditRequestStatus] = useState<EditRequestStatus>(null);
  const [adminApprovalStatus, setAdminApprovalStatus] = useState<ApprovalWorkflowStatus>('pending');
  const [showRejectedAlert, setShowRejectedAlert] = useState<boolean>(false);
  const [canRequestEdit, setCanRequestEdit] = useState<boolean>(false);
  const [othersValue, setOthersValue] = useState<string>('');
  const [authorIndex, setAuthorIndex] = useState<number>(2);
  const [searchQueries, setSearchQueries] = useState<string[]>(() => {
    return initializeArrayState('');
  });
  const [searchResults, setSearchResults] = useState<any[][]>(() => {
    return initializeArrayState<any[]>([]);
  });
  const [showSuggestions, setShowSuggestions] = useState<boolean[]>(() => {
    return initializeArrayState(false);
  });
  const [authors, setAuthors] = useState<Author[]>([
    {
      id: 1,
      designation: 'faculty',
      name: '',
      department: '',
      organization: '',
      country: '',
      state: '',
      is_first_author: true,
      is_primary: false,
      register_no: '',
      author_id: '',
    },
  ]);
  const [authorDesignations, setAuthorDesignations] = useState<string[]>(() => {
    return initializeArrayState('faculty');
  });

  // Compute designation from data: prefer student if student_id/register_no present, else faculty if author_id present
  // What the author *is* has to be decided before falling back to "has an id, so
  // faculty": v_authors reports a student's register number in the same erp_id/author_id
  // slot as a faculty ERP id, so an id-first check classified every student as faculty.
  // The row then reloaded into the faculty layout and the next save asked the server for
  // a faculty member whose ERP id was a register number.
  const computeDesignation = (author: any): string => {
    const a = author || {};
    const stated = String(a.designation || '').toLowerCase();

    if (a.student_ref || a.student_id || a.register_no || stated === 'student') return 'student';
    if (stated === 'external') return 'external';
    // Faculty carry a job title in `designation` ("Professor"), not a role, so identity
    // comes from the employee link instead.
    if (a.employee_id || a.author_type === 'Internal' || a.author_id) return 'faculty';
    return stated || 'faculty';
  };

  // A student row shows Organization as an editable field but it is always the
  // host institution, so seed it in state rather than only in the input's
  // display value -- validation reads state, and a default it cannot see reads
  // to the user as "All author fields must be filled" over a filled-looking box.
  useEffect(() => {
    setAuthors((prevAuthors) => {
      let changed = false;
      const next = prevAuthors.map((author, index) => {
        const designation = (
          authorDesignations[index] ||
          author.designation ||
          'faculty'
        ).toLowerCase();
        if (designation !== 'student' || author.organization) return author;
        changed = true;
        return { ...author, organization: DEFAULT_ORGANIZATION };
      });
      return changed ? next : prevAuthors;
    });
  }, [authors, authorDesignations]);

  // For check box
  const [acknowledgements, setAcknowledgements] = useState<Acknowledgements>({
    Nil: false,
    'DST-FIST': false,
    MODROBS: false,
    Others: false,
  });

  const [othersSelected, setOthersSelected] = useState<boolean>(false);
  const [otherAcknowledgement, setOtherAcknowledgement] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({
    impactFactor: false,
    citeScore: false,
    dateOfSubmission: false,
    volume: false,
    issue: false,
    pages: false,
    articleNumber: false,
    doi: false,
    acceptedForPublication: false,
    availableOnline: false,
  });
  const [doi, setDoi] = useState<string>('');
  const [scopusId, setScopusId] = useState<string>('');
  const [scieId, setScieId] = useState<string>('');
  const [wosId, setWosId] = useState<string>('');
  const [pubmedPmid, setPubmedPmid] = useState<string>('');
  const [openAccess, setOpenAccess] = useState<'Yes' | 'No'>('No');
  const [year, setYear] = useState<string>('');

  // Add new state for page/article number choice
  const [pageOrArticleChoice, setPageOrArticleChoice] = useState<PageOrArticleChoice>('pages');
  const [journalDetails, setJournalDetails] = useState<JournalDetails>({
    name: '',
    publisher: '',
    printISSN: '',
    onlineISSN: '',
    website: '',
  });
  const [drivenBy, setDrivenBy] = useState<'faculty' | 'student'>('faculty');
  const [journalSearchQuery, setJournalSearchQuery] = useState<string>('');
  const [journalSearchResults, setJournalSearchResults] = useState<any[]>([]);
  const [showJournalSuggestions, setShowJournalSuggestions] = useState<boolean>(false);
  const [showJournalRequestModal, setShowJournalRequestModal] = useState<boolean>(false);
  const [journalRequest, setJournalRequest] = useState<JournalRequest>({
    journal_name: '',
    publisher: '',
    website: '',
    print_issn: '',
    online_issn: '',
    impact_factor: '',
    cite_score: '',
    category: '',
  });
  const [showAddPublisherModal, setShowAddPublisherModal] = useState<boolean>(false);
  const [journalRequestLoading, setJournalRequestLoading] = useState<boolean>(false);
  const [journalRequestError, setJournalRequestError] = useState<string>('');

  const [isFormSubmitting, setIsFormSubmitting] = useState<boolean>(false);

  // Add state for Abstract and Keywords
  const [abstract, setAbstract] = useState<string>('');
  const [keywords, setKeywords] = useState<string>('');

  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [selectedCreditTo, setSelectedCreditTo] = useState<string[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<string[]>([]);
  // Active departments for a student author's Department dropdown. A student is not in
  // the employee master, so the row stores the department by name.
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  // A failed load says so in the dropdown and retries when it is next focused: with no
  // options a student row cannot be completed, and validation would block the save.
  const [departmentsLoadFailed, setDepartmentsLoadFailed] = useState(false);
  const departmentsLoadingRef = useRef(false);
  const isMountedRef = useRef(true);

  const loadDepartments = useCallback(async () => {
    if (departmentsLoadingRef.current) return;
    departmentsLoadingRef.current = true;
    try {
      const response = (await authenticityUtility.get('/journal-departments')) as {
        data?: { id: number; name: string }[];
      };
      if (!isMountedRef.current) return;
      setDepartments(Array.isArray(response?.data) ? response.data : []);
      setDepartmentsLoadFailed(false);
    } catch (loadError) {
      console.error('Error loading departments:', loadError);
      if (isMountedRef.current) setDepartmentsLoadFailed(true);
    } finally {
      departmentsLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadDepartments();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadDepartments]);
  // Whether an index is picked, ignoring case: the Scopus, WoS and PubMed ID fields are
  // shown only for the indexes the publication is in. SCIE is part of Web of Science,
  // so it is what makes a WoS ID apply.
  const hasIndex = (name: string) =>
    selectedIndexes.some((index) => index.trim().toLowerCase() === name.toLowerCase());
  // Removing an index clears its ID. Only a removal does: a record saved with an ID but
  // not its index keeps the ID, and shows the field, rather than having it wiped unseen by
  // the next save of an unrelated change.
  const handleIndexesChange = (values: string[]) => {
    const next = dedupeTagsCaseInsensitive(values);
    const removed = (name: string) =>
      hasIndex(name) && !next.some((index) => index.trim().toLowerCase() === name.toLowerCase());
    if (removed('Scopus')) setScopusId('');
    if (removed('SCIE')) setWosId('');
    if (removed('PubMed')) setPubmedPmid('');
    setSelectedIndexes(next);
  };
  const [indexSearchQuery, setIndexSearchQuery] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [bookChapterTitle, setBookChapterTitle] = useState<string>('');
  const [selectedSDGs, setSelectedSDGs] = useState<string[]>([]);
  const [currentType, setCurrentType] = useState<string>('');
  const [publicationDetails, setPublicationDetails] = useState<PublicationDetails>({
    conference_title: '',
    source: '',
    publisher: '',
    print_isbn: '',
    online_isbn: '',
  });

  // Function to determine category from type field
  const getCategoryFromType = (type: string): string | null => {
    if (!type) return null;

    const journalTypes = [
      'Article',
      'Journal Article',
      'Research Article',
      'Erratum',
      'Editorial',
      'Note',
      'Review',
      'Retraction',
    ];
    if (journalTypes.includes(type)) return 'Journal';
    if (type === 'Conference paper') return 'Conference';
    if (type === 'Book Chapter') return 'Book Chapter';
    if (type === 'Book') return 'Book';
    return null;
  };

  const [sdgSearchQuery, setSdgSearchQuery] = useState<string>('');

  // Collaboration multi-select state
  const [selectedCollaborations, setSelectedCollaborations] = useState<string[]>([]);
  const [collaborationSearchQuery, setCollaborationSearchQuery] = useState<string>('');

  // Acknowledgement multi-select state
  const [selectedAcknowledgements, setSelectedAcknowledgements] = useState<string[]>([]);
  const [acknowledgementSearchQuery, setAcknowledgementSearchQuery] = useState<string>('');

  // Check if we're in view mode based on URL
  // An embedded form has no query string of its own, so the caller states the mode.
  // A saved record with no `?mode=` (every notification links to a bare /journal/:id)
  // opens in view, the same default `editMode` starts from. Reading it as edit here made
  // the two effects that sync URL and editMode undo each other on every render, until
  // React aborted with "Maximum update depth exceeded".
  const isViewMode = modeProp
    ? modeProp === 'view'
    : !!(journalId && new URLSearchParams(window.location.search).get('mode') !== 'edit');

  // Parse category from URL path
  const pathname = window.location.pathname;
  let categoryParam = '';

  if (pathname.includes('/conference')) {
    categoryParam = 'Conference';
  } else if (pathname.includes('/book')) {
    categoryParam = pathname.includes('/book-chapter') ? 'Book Chapter' : 'Book';
  } else {
    categoryParam = 'Journal';
  }

  /**
   * Which kind of publication this is.
   *
   * The URL path only carries the category while creating one (/journal/conference,
   * /journal/book-chapter, ...). Editing always happens at /journal/:id, which falls into
   * the 'Journal' branch above — so a saved conference paper or book chapter used to be
   * re-rendered as a journal article: the Type select had no matching option and went
   * blank, and because it is required the browser silently refused to submit the form.
   * For an existing record the record's own type decides.
   */
  const getEffectiveCategory = (): string | null => {
    if (journalId && currentType) {
      return getCategoryFromType(currentType);
    }
    return categoryParam;
  };

  const effectiveCategory = getEffectiveCategory();
  const effectiveIsJournal = effectiveCategory === 'Journal';
  const effectiveIsConference = effectiveCategory === 'Conference';
  const effectiveIsBook = effectiveCategory === 'Book';
  const effectiveIsBookChapter = effectiveCategory === 'Book Chapter';

  // Validation and the save payload must follow the same category the form is showing,
  // or editing a book chapter would submit it as a journal article and drop its
  // publication details.
  const journalWebsiteHref = toExternalHref(journalDetails.website);
  const isJournal = effectiveIsJournal;
  const isConference = effectiveIsConference;
  const isBook = effectiveIsBook;
  const isBookChapter = effectiveIsBookChapter;

  // Auto-select Type on create (no journalId)
  useEffect(() => {
    if (!journalId && categoryParam) {
      if (categoryParam === 'Conference') {
        setCurrentType('Conference paper');
      } else if (categoryParam === 'Book Chapter') {
        setCurrentType('Book Chapter');
      } else if (categoryParam === 'Book') {
        setCurrentType('Book');
      } else {
        // Don't auto-select for Journal as requested
        setCurrentType('');
      }
    }
  }, [journalId, categoryParam]);

  // Status updates open in a panel from the floating bell, over the form, rather than
  // on a tab of their own — the form stays in place behind them.
  const [showUpdates, setShowUpdates] = useState(false);

  // An empty date input shows the browser's dd-mm-yyyy, which CSS cannot tell apart from a
  // date, so empty ones are marked for journalform.css to grey like the hints beside them.
  // The dates are uncontrolled — loading a record writes them straight into the DOM — so
  // they are re-marked after every render as well as on every edit.
  const publicationFormRef = useRef<HTMLFormElement>(null);
  const markDateEmptiness = (target: EventTarget | null) => {
    if (target instanceof HTMLInputElement && target.type === 'date') {
      target.dataset.empty = String(!target.value);
    }
  };
  useEffect(() => {
    publicationFormRef.current
      ?.querySelectorAll<HTMLInputElement>('input[type="date"]')
      .forEach(markDateEmptiness);
  });

  // Add new state for status tracking
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [newStatusUpdate, setNewStatusUpdate] = useState<NewStatusUpdate>({
    status: '',
    userComment: '',
  });
  const [loadingStatusUpdate, setLoadingStatusUpdate] = useState<boolean>(false);

  useEffect(() => {
    if (journalId) {
      syncModeToUrl(editMode ? 'edit' : 'view');
    }
  }, [editMode, journalId, syncModeToUrl]);

  useEffect(() => {
    // Skip search if journal data is being loaded programmatically (not user input)
    if (isLoadingJournalDataRef.current) {
      isLoadingJournalDataRef.current = false;
      return;
    }

    // Typing searches through handleJournalSearchChange. This effect used to search as
    // well — with no query, so its unfiltered list raced the typed one — and it fired when
    // picking a journal wrote the name into the box, reopening the list just closed.
    if (journalSearchQuery.length <= 2) {
      setJournalSearchResults([]);
      setShowJournalSuggestions(false);

      if (journalSearchQuery.trim() === '') {
        setJournalDetails({
          name: '',
          publisher: '',
          printISSN: '',
          onlineISSN: '',
          website: '',
        });
        // Clearing the journal clears its level too, so the next selection cannot inherit
        // the previous journal's National/International value.
        setIsInternational(false);
        setJournalOptionsId(null);
      }
    }
  }, [journalSearchQuery]);

  useEffect(() => {
    if (journalId) {
      fetchJournalDetails();
      checkEditRequestStatus();
    } else {
      setEditRequestStatus(null);
      setAdminApprovalStatus('pending');
      setCanRequestEdit(false);
      setEditMode(true);
      loadedAuthorLinkIdsRef.current = [];
    }
  }, [journalId]);

  useEffect(() => {
    if (!journalId) {
      return;
    }

    const requiresEditRequest = adminApprovalStatus === 'approved' && !hasAdminOverride;
    const hasApprovedEditRequest = editRequestStatus === 'approved';

    if (requiresEditRequest && hasApprovedEditRequest && isViewMode) {
      syncModeToUrl('edit');
      setEditMode(true);
      return;
    }

    if (requiresEditRequest && !hasApprovedEditRequest) {
      if (!isViewMode) {
        syncModeToUrl('view');
      }
      setEditMode(false);
      return;
    }

    setEditMode(!isViewMode);
  }, [
    adminApprovalStatus,
    editRequestStatus,
    isViewMode,
    journalId,
    hasAdminOverride,
    syncModeToUrl,
  ]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (editRequestStatus === 'rejected') {
      setShowRejectedAlert(true);
      timer = setTimeout(() => {
        setShowRejectedAlert(false);
      }, 5000);
    } else {
      setShowRejectedAlert(false);
    }

    return () => clearTimeout(timer);
  }, [editRequestStatus]);

  // Fetch status updates when the panel opens
  useEffect(() => {
    if (showUpdates && journalId) {
      fetchStatusUpdates();
    }
  }, [showUpdates, journalId]);

  const searchJournals = async (journalSearchQuery?: string) => {
    // Allow empty query to show default list on focus
    const seq = ++journalSearchSeqRef.current;
    try {
      // API call with proper URL construction
      const queryParam = journalSearchQuery ? journalSearchQuery.trim() : '';
      const data = (await authenticityUtility.get(
        `/journals/search?query=${encodeURIComponent(queryParam)}`,
      )) as any;
      if (seq !== journalSearchSeqRef.current) return;

      // Response validation
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setJournalSearchResults(data.data);
        // Only while the user is in the box: picking a journal moves focus off it.
        setShowJournalSuggestions(
          data.data.length > 0 && document.activeElement?.id === 'journalSearch',
        );
      } else {
        console.warn('Invalid journal search response format:', data);
        setJournalSearchResults([]);
        setShowJournalSuggestions(false);
      }

      // Clear any existing errors
      setError(null);
    } catch (error: any) {
      // Detailed error logging
      console.error('Journal search error:', {
        message: error.message,
        response: error.response,
        data: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
      });

      // Clear results and hide suggestions
      setJournalSearchResults([]);
      setShowJournalSuggestions(false);

      setError(error.response?.data?.message || error.message || 'Failed to search journals');
    }
  };

  const searchAuthor = async (query: string, index: number) => {
    // Allow empty query to show initial list on focus
    const requestToken = (authorSearchTokenRef.current[index] || 0) + 1;
    authorSearchTokenRef.current[index] = requestToken;
    try {
      const authors = (await authenticityUtility.get(
        `/authors/search?query=${encodeURIComponent(query)}&designation=${encodeURIComponent(authorDesignations[index])}&_=${Date.now()}`,
      )) as any;

      // Drop responses that arrived after a newer search on this row started.
      if (authorSearchTokenRef.current[index] !== requestToken) return;

      if (authors && Array.isArray(authors)) {
        setSearchResults((prevResults) => {
          const prevArray = Array.isArray(prevResults) ? prevResults : Array(MAX_AUTHORS).fill([]);
          const newResults = [...prevArray];
          newResults[index] = authors;
          return newResults;
        });

        // Only the focused row may open its dropdown, and only one row at a time,
        // otherwise slow responses stack overlapping popups on top of each other.
        const isRowFocused = activeAuthorSearchIndexRef.current === index;
        setShowSuggestions((prev) => {
          const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
          const newShow = isRowFocused ? prevArray.map(() => false) : [...prevArray];
          newShow[index] = isRowFocused && authors.length > 0;
          return newShow;
        });
      } else {
        console.warn('Invalid response format:', authors);
        throw new Error('Invalid response format from server');
      }
      setError(null);
    } catch (error: any) {
      console.error('Search error:', {
        message: error.message,
        response: error.response,
        data: error.response?.data,
        stack: error.stack,
      });

      // A failure belonging to a query the user has already moved past says
      // nothing about the current one, so it must not clear its results or
      // raise an error over them.
      if (authorSearchTokenRef.current[index] !== requestToken) return;

      setError(
        error.response?.data?.message ||
          error.message ||
          'Failed to search for authors. Please try again.',
      );

      // Clear results for this index
      setSearchResults((prevResults) => {
        const prevArray = Array.isArray(prevResults) ? prevResults : Array(MAX_AUTHORS).fill([]);
        const newResults = [...prevArray];
        newResults[index] = [];
        return newResults;
      });

      setShowSuggestions((prev) => {
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
        const newShow = [...prevArray];
        newShow[index] = false;
        return newShow;
      });
    }
  };

  const checkEditRequestStatus = async (targetJournalId?: string) => {
    const idToCheck = targetJournalId || journalId;
    if (!idToCheck) return;

    try {
      const response = (await authenticityUtility.get(
        `/edit-requests/journals/${idToCheck}?_=${Date.now()}`,
      )) as any;

      if (response.data) {
        const status = response.data.status;

        if (status === 'pending') {
          setEditRequestStatus('pending');
        } else if (status === 'rejected') {
          setEditRequestStatus('rejected');
        } else if (status === 'none') {
          setEditRequestStatus(null);
        } else if (status === 'approved') {
          setEditRequestStatus('approved');
        }
      } else {
        setEditRequestStatus(null);
      }
    } catch (error) {
      console.error('Error checking edit status:', error);
      setEditRequestStatus(null);
    }
  };

  // Add journal request functions
  const handleJournalRequestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Checked here rather than by the browser so the message lands in the modal's own
    // alert strip instead of a native bubble, and so every field the modal marks with an
    // asterisk is actually enforced.
    const missing = [
      !journalRequest.journal_name.trim() && 'Journal name',
      !journalRequest.category && 'Level',
      !journalRequest.publisher.trim() && 'Publisher',
      !journalRequest.website.trim() && 'Website',
      !journalRequest.print_issn.trim() && 'Print ISSN',
      !journalRequest.online_issn.trim() && 'Online ISSN',
      !journalRequest.impact_factor.trim() && 'Impact Factor',
      !journalRequest.cite_score.trim() && 'Cite Score',
    ].filter(Boolean) as string[];

    if (missing.length > 0) {
      setJournalRequestError(
        missing.length === 1
          ? `${missing[0]} is required.`
          : `These fields are required: ${missing.join(', ')}.`,
      );
      return;
    }

    // noValidate turns off the browser's own url check, so the shape of the website is
    // verified here — an unparseable value would otherwise be stored on the registry
    // entry an admin later approves.
    const websiteValue = journalRequest.website.trim();
    const normalizedWebsite = /^https?:\/\//i.test(websiteValue)
      ? websiteValue
      : `https://${websiteValue}`;
    try {
      new URL(normalizedWebsite);
    } catch {
      setJournalRequestError('Website must be a valid URL, for example https://example.com.');
      return;
    }

    try {
      setJournalRequestLoading(true);
      setJournalRequestError('');

      const response = (await authenticityUtility.post('/journal-requests', {
        ...journalRequest,
        website: normalizedWebsite,
      })) as any;

      if (response.status === 'success') {
        showAlert(
          'Journal request submitted successfully. It will be reviewed by an administrator.',
          'success',
          'Request Sent',
        );
        setShowJournalRequestModal(false);
        setJournalRequest({
          journal_name: '',
          publisher: '',
          website: '',
          print_issn: '',
          online_issn: '',
          impact_factor: '',
          cite_score: '',
          category: '',
        });
      } else {
        setJournalRequestError(response.message || 'Failed to submit journal request');
      }
    } catch (error: any) {
      console.error('Error submitting journal request:', error);
      setJournalRequestError(error.response?.data?.message || 'Failed to submit journal request');
    } finally {
      setJournalRequestLoading(false);
    }
  };

  // Opens "Add Journal" carrying over whatever the user already typed into the journal
  // search box, and drops any error left over from a previous attempt.
  const openJournalRequestModal = () => {
    setJournalRequestError('');
    setJournalRequest((prev) => ({
      ...prev,
      journal_name: prev.journal_name || journalSearchQuery.trim(),
    }));
    setShowJournalRequestModal(true);
  };

  const handleJournalRequestChange = (field: keyof JournalRequest, value: string) => {
    setJournalRequest((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openEditableMode = () => {
    if (!journalId) {
      return;
    }

    setEditMode(true);
    syncModeToUrl('edit');
  };

  const handleEditRequest = async () => {
    if (!journalId || adminApprovalStatus !== 'approved' || !canRequestEdit) {
      return;
    }

    try {
      const response = (await authenticityUtility.post(
        `/edit-requests/journals/${journalId}`,
      )) as any;

      if (response && response.success === true) {
        setEditRequestStatus('pending');
        showAlert(
          response.message || 'Edit request sent to admin for approval.',
          'success',
          'Request Sent',
        );
      } else {
        console.error('Edit request was not successful:', response.message);
        showAlert(response.message || 'Failed to send edit request.', 'error');
      }
    } catch (error: any) {
      console.error('Error sending edit request:', error);
      showAlert(error.response?.data?.message || 'Failed to send edit request.', 'error');
    }
  };

  // `targetJournalId` lets the save flow re-read a record whose id is not in state yet
  // (a freshly created publication).
  const fetchJournalDetails = async (targetJournalId?: string): Promise<boolean> => {
    const idToFetch = targetJournalId || journalId;
    if (!idToFetch) return false;

    try {
      const response = await authenticityUtility.get(`/journals/${idToFetch}`);

      const journalData = response.data?.data || response.data;

      if (!journalData) {
        throw new Error('No journal data received');
      }

      // Immediately set all form values once we have the data
      const setFormValues = () => {
        // Set title
        const titleInput = document.getElementById('title') as HTMLInputElement;
        if (titleInput) titleInput.value = journalData.title || '';

        // Set type select
        const typeSelect = document.getElementById('typeSelect') as HTMLSelectElement;
        if (typeSelect) typeSelect.value = journalData.type || '';
        setCurrentType(journalData.type || '');

        // Set quartile radio button
        const quartileRadio = document.querySelector(
          `input[name="quartile"][value="${journalData.quartile}"]`,
        ) as HTMLInputElement;
        if (quartileRadio) quartileRadio.checked = true;

        // Set Impact Factor
        if (journalData.impact_factor) {
          const input = document.getElementById('impactFactorInput') as HTMLInputElement;
          if (input) input.value = journalData.impact_factor;
        }

        // Set Cite Score
        if (journalData.cite_score) {
          const input = document.getElementById('citeScoreInput') as HTMLInputElement;
          if (input) input.value = journalData.cite_score;
        }

        // Set date of submission and status
        if (journalData.date_of_submission) {
          const dateInput = document.getElementById('dateOfSubmissionInput') as HTMLInputElement;
          const ds = String(journalData.date_of_submission);
          if (dateInput) dateInput.value = ds.includes('T') ? ds.split('T')[0] : ds;

          const statusDropdown = document.getElementById('statusDropdown') as HTMLSelectElement;
          if (statusDropdown) statusDropdown.value = journalData.status || 'waiting';
        }
        // Set volume
        if (journalData.volume) {
          const toggle = document.getElementById('volumeToggle') as HTMLInputElement;
          if (toggle) toggle.checked = true;
          const input = document.getElementById('volumeInput') as HTMLInputElement;
          if (input) input.value = journalData.volume;
        }

        // Set issue
        if (journalData.issue) {
          const toggle = document.getElementById('issueToggle') as HTMLInputElement;
          if (toggle) toggle.checked = true;
          const input = document.getElementById('issueInput') as HTMLInputElement;
          if (input) input.value = journalData.issue;
        }

        // Set issue type. An issue saved without one reads as Regular Issue, the default.
        const issueTypeRadio = document.querySelector(
          `input[name="issueType"][value="${journalData.issue_type || (journalData.issue ? 'Regular Issue' : '')}"]`,
        ) as HTMLInputElement;
        if (issueTypeRadio) issueTypeRadio.checked = true;

        // Set pages
        if (journalData.pages_from && journalData.pages_to) {
          const toggle = document.getElementById('pagesToggle') as HTMLInputElement;
          if (toggle) toggle.checked = true;
          const fromInput = document.getElementById('pagesFromInput') as HTMLInputElement;
          if (fromInput) fromInput.value = journalData.pages_from;
          const toInput = document.getElementById('pagesToInput') as HTMLInputElement;
          if (toInput) toInput.value = journalData.pages_to;
        }

        // Set article number
        if (journalData.article_number) {
          const toggle = document.getElementById('articleNumberToggle') as HTMLInputElement;
          if (toggle) toggle.checked = true;
          const input = document.getElementById('articleNumberInput') as HTMLInputElement;
          if (input) input.value = journalData.article_number;
        }

        // Set Credit To
        if (journalData.credit_to) {
          setSelectedCreditTo(
            Array.isArray(journalData.credit_to) ? journalData.credit_to : [journalData.credit_to],
          );
        }

        // Set Book Chapter Title
        if (journalData.book_chapter_title) {
          setBookChapterTitle(journalData.book_chapter_title);
        }

        // Set Reference Number
        if (journalData.reference_number) {
          setReferenceNumber(journalData.reference_number);
          // Also set the input field value
          const referenceNumberInput = document.getElementById(
            'referenceNumberInput',
          ) as HTMLInputElement;
          if (referenceNumberInput) referenceNumberInput.value = journalData.reference_number;
        }

        // Set accepted date
        if (journalData.accepted_date) {
          const toggle = document.getElementById('acceptedToggle') as HTMLInputElement;
          if (toggle) toggle.checked = true;
          const input = document.getElementById('acceptedDateInput') as HTMLInputElement;
          const ad = String(journalData.accepted_date);
          if (input) input.value = ad.includes('T') ? ad.split('T')[0] : ad;
        }

        // Set available online date
        if (journalData.available_online_date) {
          const toggle = document.getElementById('availableToggle') as HTMLInputElement;
          if (toggle) toggle.checked = true;
          const input = document.getElementById('availableDateInput') as HTMLInputElement;
          const av = String(journalData.available_online_date);
          if (input) input.value = av.includes('T') ? av.split('T')[0] : av;
        }

        // Set affiliations
        if (Array.isArray(journalData.author_affiliation)) {
          journalData.author_affiliation.forEach((affiliation: string) => {
            const checkbox = document.getElementById(affiliation) as HTMLInputElement;
            if (checkbox) checkbox.checked = true;
          });
        }

        // Set indexes
        if (Array.isArray(journalData.indexes)) {
          setSelectedIndexes(dedupeTagsCaseInsensitive(journalData.indexes));
        } else {
          setSelectedIndexes([]);
        }
      };

      // Parse and set publication_details if it exists
      if (journalData.publication_details) {
        try {
          let pubDetails = journalData.publication_details;
          if (typeof pubDetails === 'string') {
            pubDetails = JSON.parse(pubDetails);
          }
          setPublicationDetails({
            conference_title: pubDetails.conference_title || '',
            source: pubDetails.source || '',
            publisher: pubDetails.publisher || '',
            publisher_id: Number(pubDetails.publisher_id) || null,
            print_isbn: pubDetails.print_isbn || '',
            online_isbn: pubDetails.online_isbn || '',
            city: pubDetails.city || '',
            dates: pubDetails.dates || '',
          });
        } catch (e) {
          console.error('Error parsing publication_details:', e);
        }
      } else {
        // Reset publication details if not present
        setPublicationDetails({
          conference_title: '',
          source: '',
          publisher: '',
          print_isbn: '',
          online_isbn: '',
        });
      }

      // Update state variables
      // For Journal type, use journal_options data; for others, use publication_details or empty
      const typeCategory = getCategoryFromType(journalData.type);
      const isJournalType = typeCategory === 'Journal';

      if (isJournalType) {
        setJournalDetails({
          name: journalData.journal_name || '',
          publisher: journalData.publisher || '',
          printISSN: journalData.print_issn || '',
          onlineISSN: journalData.online_issn || '',
          website: journalData.website || '',
        });
        // Set ref before setting search query to prevent dropdown from showing
        isLoadingJournalDataRef.current = true;
        setJournalSearchQuery(journalData.journal_name || '');
      } else {
        // For Conference, Book Chapter, Book - use publication_details or empty
        const pubDetails = journalData.publication_details
          ? typeof journalData.publication_details === 'string'
            ? JSON.parse(journalData.publication_details)
            : journalData.publication_details
          : {};
        setJournalDetails({
          name: pubDetails.conference_title || pubDetails.source || '',
          publisher: pubDetails.publisher || '',
          printISSN: pubDetails.print_isbn || '',
          onlineISSN: pubDetails.online_isbn || '',
          website: '',
        });
        setJournalSearchQuery('');
      }

      setIsInternational(journalData.category === 'International');
      setJournalOptionsId(Number(journalData.journal_options_id) || null);
      setStatus(journalData.status || 'waiting');
      setDrivenBy(journalData.driven_by || 'faculty');

      // Set Abstract and Keywords
      setAbstract(journalData.abstract || '');
      setKeywords(journalData.keywords || '');

      // Set metrics state
      setMetrics((prevMetrics) => ({
        ...prevMetrics,
        impactFactor: Boolean(journalData.impact_factor),
        citeScore: Boolean(journalData.cite_score),
        dateOfSubmission: Boolean(journalData.date_of_submission),
        volume: Boolean(journalData.volume),
        issue: Boolean(journalData.issue),
        pages: Boolean(journalData.pages_from && journalData.pages_to),
        articleNumber: Boolean(journalData.article_number),
        doi: Boolean(journalData.doi),
        acceptedForPublication: Boolean(journalData.accepted_date),
        availableOnline: Boolean(journalData.available_online_date),
      }));

      // Set DOI value
      setDoi(journalData.doi || '');
      setScopusId(journalData.scopus_id || '');
      setScieId(journalData.scie_id || '');
      // These were never restored, so reopening a publication showed them blank and the
      // next save wrote that blank back over the stored values.
      setOpenAccess(journalData.open_access === 'Yes' ? 'Yes' : 'No');
      setYear(journalData.year || '');
      setWosId(journalData.wos_id || '');
      setPubmedPmid(journalData.pubmed_pmid || '');

      // Set page/article choice based on existing data
      if (journalData.pages_from && journalData.pages_to) {
        setPageOrArticleChoice('pages');
      } else if (journalData.article_number) {
        setPageOrArticleChoice('article');
      } else {
        setPageOrArticleChoice('pages'); // Default to pages when no existing data
      }

      // Parse and set acknowledgements (may already be parsed by backend)
      if (journalData.acknowledgement) {
        try {
          const parsedAck =
            typeof journalData.acknowledgement === 'string'
              ? JSON.parse(journalData.acknowledgement)
              : journalData.acknowledgement;
          setAcknowledgements(parsedAck);
          if (parsedAck.Others) {
            setOtherAcknowledgement(parsedAck.otherValue || '');
          }
        } catch (e) {
          console.error('Error parsing acknowledgements:', e);
        }
      }

      // Set SDGs
      if (journalData.sdgs) {
        try {
          // Handle case where sdgs might be stored as JSON string
          let sdgsData = journalData.sdgs;
          if (typeof sdgsData === 'string') {
            try {
              sdgsData = JSON.parse(sdgsData);
            } catch {
              // LEGACY: rows written before SDGs became a multi-select stored a single
              // SDG as a plain string rather than a JSON array.
              // Remove once every journals.sdgs value parses as JSON.
              sdgsData = [sdgsData];
            }
          }
          setSelectedSDGs(Array.isArray(sdgsData) ? sdgsData : []);
        } catch (error) {
          console.error('Error parsing SDGs data:', error);
          setSelectedSDGs([]);
        }
      } else {
        setSelectedSDGs([]);
      }

      // Set Collaborations from author_affiliation
      if (journalData.author_affiliation && Array.isArray(journalData.author_affiliation)) {
        const collaborations = journalData.author_affiliation.filter((item: string) =>
          allCollaborations.includes(item),
        );
        setSelectedCollaborations(collaborations);

        // Check for "others" value (not in predefined list)
        const othersCollab = journalData.author_affiliation.find(
          (item: string) => !allCollaborations.includes(item) && item !== 'others',
        );
        if (othersCollab) {
          setOthersSelected(true);
          setOthersValue(othersCollab);
        }
      } else {
        setSelectedCollaborations([]);
      }

      // Set Acknowledgements from acknowledgement object (already parsed by backend)
      if (journalData.acknowledgement && typeof journalData.acknowledgement === 'object') {
        const ackArray = Object.keys(journalData.acknowledgement).filter(
          (key: string) =>
            journalData.acknowledgement[key] === true && allAcknowledgements.includes(key),
        );
        setSelectedAcknowledgements(ackArray);

        // Handle "Others" acknowledgement
        if (journalData.acknowledgement.Others) {
          setOtherAcknowledgement(journalData.acknowledgement.otherValue || '');
        }
      } else {
        setSelectedAcknowledgements([]);
      }

      // Set authors
      let fetchedAuthors: Author[] = [];
      loadedAuthorLinkIdsRef.current = [];
      if (Array.isArray(journalData.authors)) {
        fetchedAuthors = journalData.authors.map((author: any, index: number) => {
          const normalizedDesignation = computeDesignation(author);
          const computedAuthorId =
            normalizedDesignation === 'student' ? author.student_id || '' : author.author_id || '';

          return {
            id: index + 1,
            dbAuthorId: author.dbAuthorId,
            author_id: computedAuthorId,
            email: author.email,
            designation: normalizedDesignation as 'faculty' | 'student' | 'external',
            name: author.name,
            department: author.department,
            organization:
              normalizedDesignation === 'student' && !author.organization
                ? DEFAULT_ORGANIZATION
                : author.organization,
            country: author.country,
            state: author.state || '',
            is_first_author: author.is_first_author === 1 || author.is_first_author === true,
            is_primary: author.is_primary === 1 || author.is_primary === true,
            register_no: normalizedDesignation === 'student' ? author.student_id || '' : '',
          };
        });
        setAuthors(fetchedAuthors);
        loadedAuthorLinkIdsRef.current = fetchedAuthors
          .map((author: Author) => author.dbAuthorId)
          .filter((dbAuthorId: string | undefined): dbAuthorId is string => Boolean(dbAuthorId));

        // Trim parallel arrays to match authors length
        setSearchResults((prev) => {
          const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill([]);
          return prevArray.slice(0, fetchedAuthors.length);
        });
        setShowSuggestions((prev) => {
          const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
          return prevArray.slice(0, fetchedAuthors.length);
        });

        // Update search queries for authors
        setSearchQueries((prevQueries) => {
          const prevArray = Array.isArray(prevQueries) ? prevQueries : Array(MAX_AUTHORS).fill('');
          const newQueries = [...prevArray];
          journalData.authors.forEach((author: any, index: number) => {
            const normalizedDesignation = computeDesignation(author);
            const idToShow =
              normalizedDesignation === 'student'
                ? author.student_id || ''
                : author.author_id || '';
            newQueries[index] = isViewMode ? idToShow : author.name || '';
          });
          return newQueries.slice(0, fetchedAuthors.length);
        });

        // Set author designations
        setAuthorDesignations(() => {
          const newDesignations = Array(MAX_AUTHORS).fill('faculty');
          journalData.authors.forEach((author: any, index: number) => {
            newDesignations[index] = computeDesignation(author);
          });
          return newDesignations.slice(0, fetchedAuthors.length);
        });
      }

      // Append external.external_details JSON
      let combinedAuthors = fetchedAuthors;
      if (Array.isArray(journalData.external_details)) {
        const externalAuthorsFromJson = journalData.external_details.map(
          (extAuthor: any, index: number) => ({
            id: fetchedAuthors.length + index + 1,
            dbAuthorId: null,
            author_id: '',
            email: extAuthor.email || '',
            designation: 'external' as const,
            name: extAuthor.name || '',
            department: extAuthor.department || '',
            organization: extAuthor.organization || '',
            country: extAuthor.country || '',
            state: extAuthor.state || '',
            is_first_author: extAuthor.is_first_author === 1 || extAuthor.is_first_author === true,
            is_primary: extAuthor.is_primary === 1 || extAuthor.is_primary === true,
            register_no: '',
          }),
        );
        combinedAuthors = [...fetchedAuthors, ...externalAuthorsFromJson];
        setAuthors(combinedAuthors);

        // Ensure authorDesignations and search-related arrays cover external authors too
        setAuthorDesignations((prev) => {
          const base = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('faculty');
          const next = [...base];
          externalAuthorsFromJson.forEach((author: Author, idx: number) => {
            const index = fetchedAuthors.length + idx;
            if (index < MAX_AUTHORS) {
              next[index] = 'external';
            }
          });
          return next.slice(0, combinedAuthors.length);
        });

        setSearchQueries((prev) => {
          const base = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('');
          const next = [...base];
          // For external authors, the search field is not used – keep empty for those rows
          return next.slice(0, combinedAuthors.length);
        });

        setSearchResults((prev) => {
          const base = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill([]);
          const next = [...base];
          return next.slice(0, combinedAuthors.length);
        });

        setShowSuggestions((prev) => {
          const base = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
          const next = [...base];
          return next.slice(0, combinedAuthors.length);
        });
      }

      const normalizedApprovalStatus = normalizeApprovalStatus(journalData.admin_approval_status);
      setAdminApprovalStatus(normalizedApprovalStatus);

      // Who may ask for edit access: the corresponding/first author, or whoever filed the
      // submission. Matching on authorship alone left the submitter of a paper that
      // credits other people with a permanently disabled "Edit Not Available" button,
      // even though the server accepts their edit.
      const currentUserEmail = user?.email;
      const isCreditedAuthor = Boolean(
        currentUserEmail &&
        fetchedAuthors.some(
          (author) =>
            (author.is_primary || author.is_first_author) && author.email === currentUserEmail,
        ),
      );
      const isSubmitter = Boolean(
        journalData.created_by != null &&
        user?.id != null &&
        String(journalData.created_by) === String(user.id),
      );
      setCanRequestEdit(
        (isCreditedAuthor || isSubmitter) && normalizedApprovalStatus === 'approved',
      );

      // Set uploaded file information
      if (journalData.file_path) {
        setUploadedFile({
          path: journalData.file_path,
          name: journalData.file_path.split('/').pop() || '',
        });
      }

      // Set form values after a short delay to ensure DOM is ready
      setTimeout(setFormValues, 100);

      return true;
    } catch (error: any) {
      console.error('Error fetching journal details:', error);
      setError('Failed to fetch journal details: ' + (error.message || 'Unknown error'));
      return false;
    }
  };

  const handleJournalSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setJournalSearchQuery(query);

    // Every edit, clearing included, cancels the pending search and invalidates one in
    // flight, so an answer for text no longer in the box cannot reopen the list.
    if (journalSearchTimerRef.current) clearTimeout(journalSearchTimerRef.current);
    journalSearchTimerRef.current = null;
    journalSearchSeqRef.current += 1;

    if (query.trim().length >= 2) {
      journalSearchTimerRef.current = setTimeout(() => {
        journalSearchTimerRef.current = null;
        searchJournals(query);
      }, 300);
    } else {
      setJournalSearchResults([]);
      setShowJournalSuggestions(false);
    }
  };

  const selectJournal = (journal: any) => {
    setJournalDetails({
      name: journal.name,
      publisher: journal.publisher || '',
      printISSN: journal.printISSN || '',
      onlineISSN: journal.onlineISSN || '',
      website: journal.website || '',
    });
    // Invalidates any search still in flight, so its answer cannot reopen the list.
    journalSearchSeqRef.current += 1;
    setJournalSearchQuery(journal.name);
    setShowJournalSuggestions(false);
    setJournalOptionsId(Number(journal.id) || null);

    // Set Impact Factor and Cite Score from journal options
    const impactFactorInput = document.getElementById('impactFactorInput') as HTMLInputElement;
    const citeScoreInput = document.getElementById('citeScoreInput') as HTMLInputElement;
    if (impactFactorInput) {
      impactFactorInput.value = journal.impactFactor != null ? String(journal.impactFactor) : '';
    }
    if (citeScoreInput) {
      citeScoreInput.value = journal.citeScore != null ? String(journal.citeScore) : '';
    }

    // National/International belongs to the journal, not to this publication: it comes
    // from the registry entry the admin curated in Journal Management.
    // FALLBACK: an entry that predates journal_options.category has no value, so it
    // reads as National (the documented default).
    // Remove after every journal_options row has a curated category.
    setIsInternational(journal.category === 'International');
  };

  const handleDesignationChange = (index: number, designation: string) => {
    setAuthorDesignations((prev) => {
      // Ensure prev is an array
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('faculty');
      const newDesignations = [...prevArray];
      newDesignations[index] = designation;
      return newDesignations;
    });

    // Clear author data when designation changes to ensure a clean slate
    setAuthors((prevAuthors) => {
      const newAuthors = [...prevAuthors];
      newAuthors[index] = {
        // Keep the core properties
        id: newAuthors[index].id,
        is_first_author: index === 0,
        is_primary: newAuthors[index].is_primary,
        // Reset all data fields
        author_id: '',
        register_no: '',
        name: '',
        department: '',
        organization: designation === 'student' ? DEFAULT_ORGANIZATION : '',
        country: '',
        state: '',
        designation: designation as 'faculty' | 'student' | 'external', // Set the new designation
      };
      return newAuthors;
    });

    // Also clear the search query for that row
    setSearchQueries((prev) => {
      // Ensure prev is an array
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('');
      const newQueries = [...prevArray];
      newQueries[index] = '';
      return newQueries;
    });

    // Clear search results and suggestions for synchronization
    setSearchResults((prev) => {
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill([]);
      const newResults = [...prevArray];
      newResults[index] = [];
      return newResults;
    });
    setShowSuggestions((prev) => {
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
      const newShow = [...prevArray];
      newShow[index] = false;
      return newShow;
    });
  };

  const handleManualAuthorChange = (
    index: number,
    field: keyof Author,
    value: string | boolean,
  ) => {
    setAuthors((prevAuthors) => {
      const newAuthors = [...prevAuthors];
      newAuthors[index] = {
        ...newAuthors[index],
        [field]: value,
      };
      return newAuthors;
    });
  };

  const addAuthor = () => {
    if (authors.length < MAX_AUTHORS) {
      justAddedAuthorRef.current = true; // Flag to prevent dropdown on new row
      setTimeout(() => {
        justAddedAuthorRef.current = false;
      }, 100); // Reset after short delay
      const newAuthorId = authorIndex;
      setAuthors((prevAuthors) => [
        ...prevAuthors,
        {
          id: newAuthorId,
          designation: 'faculty', // Default to faculty
          name: '',
          department: '',
          organization: '',
          country: '',
          state: '',
          is_first_author: false,
          is_primary: false,
          register_no: '',
          author_id: '',
        },
      ]);
      setAuthorIndex((prevIndex) => prevIndex + 1);
      setAuthorDesignations((prev) => {
        // Ensure prev is an array
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('faculty');
        const newD = [...prevArray];
        newD[authors.length] = 'faculty'; // Default new author to faculty
        return newD;
      });

      // Sync parallel arrays
      setSearchQueries((prev) => {
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('');
        return [...prevArray, ''];
      });
      setSearchResults((prev) => {
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill([]);
        return [...prevArray, []];
      });
      setShowSuggestions((prev) => {
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
        return [...prevArray, false];
      });
    }
  };

  // Every per-row array here — queries, results, suggestions, designations —
  // is keyed by index, and delete/reorder splice all of them. A lookup still in
  // flight would then land its results in whichever row moved into its index,
  // so both boundaries invalidate every pending lookup rather than trying to
  // remap it onto the new order.
  const cancelPendingAuthorSearches = () => {
    activeAuthorSearchIndexRef.current = null;
    authorSearchTimerRef.current.forEach((timer, timerIndex) => {
      if (timer) clearTimeout(timer);
      authorSearchTimerRef.current[timerIndex] = null;
    });
    authorSearchTokenRef.current = authorSearchTokenRef.current.map((token) => (token || 0) + 1);
    setShowSuggestions((prev) => {
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
      return prevArray.some(Boolean) ? prevArray.map(() => false) : prevArray;
    });
  };

  const deleteAuthor = (id: number) => {
    if (id === 1) return;

    cancelPendingAuthorSearches();

    // Remove the author and keep parallel arrays in sync
    setAuthors((prevAuthors) => {
      const deleteIndex = prevAuthors.findIndex((a) => a.id === id);
      if (deleteIndex === -1) return prevAuthors;

      const nextAuthors = prevAuthors
        .filter((a) => a.id !== id)
        .map((author, index) => ({
          ...author,
          is_first_author: index === 0,
        }));

      // Ensure one primary author remains selected
      const hasPrimary = nextAuthors.some((a) => a.is_primary);
      if (!hasPrimary && nextAuthors.length > 0) {
        nextAuthors[0] = { ...nextAuthors[0], is_primary: true };
        for (let i = 1; i < nextAuthors.length; i += 1) {
          if (nextAuthors[i].is_primary) {
            nextAuthors[i] = { ...nextAuthors[i], is_primary: false };
          }
        }
      }

      // Sync searchQueries
      setSearchQueries((prev) => {
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('');
        const arr = [...prevArray];
        arr.splice(deleteIndex, 1);
        return arr;
      });

      // Sync searchResults
      setSearchResults((prev) => {
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill([]);
        const arr = [...prevArray];
        arr.splice(deleteIndex, 1);
        return arr;
      });

      // Sync showSuggestions
      setShowSuggestions((prev) => {
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
        const arr = [...prevArray];
        arr.splice(deleteIndex, 1);
        return arr;
      });

      // Sync authorDesignations
      setAuthorDesignations((prev) => {
        // Ensure prev is an array
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('faculty');
        const arr = [...prevArray];
        arr.splice(deleteIndex, 1);
        return arr;
      });

      return nextAuthors;
    });
  };

  // New functions for drag and drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);

    if (dragIndex === dropIndex) return;

    cancelPendingAuthorSearches();

    // Reorder authors
    setAuthors((prevAuthors) => {
      const newAuthors = [...prevAuthors];
      const [draggedAuthor] = newAuthors.splice(dragIndex, 1);
      newAuthors.splice(dropIndex, 0, draggedAuthor);

      // Update is_first_author based on new order
      return newAuthors.map((author, index) => ({
        ...author,
        is_first_author: index === 0,
      }));
    });

    // Sync searchQueries
    setSearchQueries((prev) => {
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('');
      const newQueries = [...prevArray];
      const [draggedQuery] = newQueries.splice(dragIndex, 1);
      newQueries.splice(dropIndex, 0, draggedQuery);
      return newQueries;
    });

    // Sync searchResults
    setSearchResults((prev) => {
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill([]);
      const newResults = [...prevArray];
      const [draggedResult] = newResults.splice(dragIndex, 1);
      newResults.splice(dropIndex, 0, draggedResult);
      return newResults;
    });

    // Sync showSuggestions
    setShowSuggestions((prev) => {
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
      const newShow = [...prevArray];
      const [draggedShow] = newShow.splice(dragIndex, 1);
      newShow.splice(dropIndex, 0, draggedShow);
      return newShow;
    });

    // Sync authorDesignations
    setAuthorDesignations((prev) => {
      // Ensure prev is an array
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill('faculty');
      const newDesignations = [...prevArray];
      const [draggedDesignation] = newDesignations.splice(dragIndex, 1);
      newDesignations.splice(dropIndex, 0, draggedDesignation);
      return newDesignations;
    });
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newValue = e.target.value;
    setSearchQueries((prevQueries) => {
      try {
        const prevArray = Array.isArray(prevQueries) ? prevQueries : initializeArrayState('');
        const newQueries = [...prevArray];
        newQueries[index] = newValue;
        return newQueries;
      } catch (error) {
        console.error('Error in handleSearchInputChange:', error);
        return initializeArrayState('');
      }
    });

    setAuthors((prev) => {
      const next = [...prev];
      if (next[index]?.name) {
        next[index] = {
          ...next[index],
          author_id: '',
          name: '',
          department: '',
          organization: '',
          country: '',
        };
      }
      return next;
    });

    if (authorSearchTimerRef.current[index]) {
      clearTimeout(authorSearchTimerRef.current[index] as ReturnType<typeof setTimeout>);
    }
    // Retire the request already in flight here rather than when the timer
    // fires: for the next 300ms its answer belongs to a query the user has
    // already typed past, and showing that list would be showing stale names.
    authorSearchTokenRef.current[index] = (authorSearchTokenRef.current[index] || 0) + 1;
    authorSearchTimerRef.current[index] = setTimeout(() => {
      authorSearchTimerRef.current[index] = null;
      searchAuthor(newValue, index);
    }, 300);
  };

  const handleAuthorSelect = (selectedAuthor: any, index: number) => {
    setAuthors((prevAuthors) => {
      const updatedAuthors = [...prevAuthors];
      const originalAuthorData = updatedAuthors[index];

      const normalizedDesignation = computeDesignation(selectedAuthor);
      const computedAuthorId =
        normalizedDesignation === 'student'
          ? selectedAuthor.student_id || ''
          : selectedAuthor.author_id || '';

      updatedAuthors[index] = {
        ...originalAuthorData, // maintains id, is_primary, etc.
        // REFACTOR: Populate fields from the selected author object.
        // Use student_id for students, author_id for faculty.
        author_id: computedAuthorId,
        name: selectedAuthor.name,
        department: selectedAuthor.department,
        organization: selectedAuthor.organization,
        country: selectedAuthor.country,
        designation: normalizedDesignation as 'faculty' | 'student' | 'external',
        register_no: normalizedDesignation === 'student' ? selectedAuthor.student_id || '' : '',
      };
      return updatedAuthors;
    });

    // REFACTOR: Set search query to the faculty_id for display purposes.
    setSearchQueries((prevQueries) => {
      const prevArray = Array.isArray(prevQueries) ? prevQueries : Array(MAX_AUTHORS).fill('');
      const newQueries = [...prevArray];
      newQueries[index] = selectedAuthor.name || '';
      return newQueries;
    });

    // Hide suggestions
    setShowSuggestions((prev) => {
      const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
      const newShow = [...prevArray];
      newShow[index] = false;
      return newShow;
    });
  };

  // Helper to render author fields based on designation
  const renderAuthorFields = (author: Author, index: number): JSX.Element => {
    const designationLower = (
      authorDesignations[index] ||
      author.designation ||
      'faculty'
    ).toLowerCase();
    if (designationLower === 'student') {
      return (
        <>
          <div className="author-input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Name"
              name="name"
              value={author.name || ''}
              onChange={(e) =>
                handleManualAuthorChange(index, e.target.name as keyof Author, e.target.value)
              }
              disabled={!editMode && isViewMode}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Register No."
              name="register_no"
              value={author.register_no || ''}
              onChange={(e) =>
                handleManualAuthorChange(index, e.target.name as keyof Author, e.target.value)
              }
              disabled={!editMode && isViewMode}
            />
            {/* Picked from the department master and stored by name — a student is not
                in the employee master. A saved name that is no longer listed stays
                selectable rather than rendering blank. */}
            <select
              className="form-control"
              name="department"
              value={author.department || ''}
              onChange={(e) =>
                handleManualAuthorChange(index, e.target.name as keyof Author, e.target.value)
              }
              onFocus={() => {
                if (departmentsLoadFailed) loadDepartments();
              }}
              disabled={!editMode && isViewMode}
              aria-label="Department"
              aria-invalid={departmentsLoadFailed || undefined}
              title={departmentsLoadFailed ? 'Departments could not be loaded' : undefined}
            >
              <option value="">
                {departmentsLoadFailed ? 'Could not load — reopen to retry' : 'Department'}
              </option>
              {author.department &&
                !departments.some((department) => department.name === author.department) && (
                  <option value={author.department}>{author.department}</option>
                )}
              {departments.map((department) => (
                <option key={department.id} value={department.name}>
                  {department.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="form-control"
              placeholder="Organization"
              name="organization"
              value={author.organization || ''}
              onChange={(e) =>
                handleManualAuthorChange(index, e.target.name as keyof Author, e.target.value)
              }
              disabled={!editMode && isViewMode}
              readOnly={designationLower === 'student'}
            />
          </div>
        </>
      );
    }
    if (designationLower === 'external') {
      return (
        <>
          <div className="author-input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Name"
              name="name"
              value={author.name || ''}
              onChange={(e) =>
                handleManualAuthorChange(index, e.target.name as keyof Author, e.target.value)
              }
              disabled={!editMode && isViewMode}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Organization"
              name="organization"
              value={author.organization || ''}
              onChange={(e) =>
                handleManualAuthorChange(index, e.target.name as keyof Author, e.target.value)
              }
              disabled={!editMode && isViewMode}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Country"
              name="country"
              value={author.country || ''}
              onChange={(e) =>
                handleManualAuthorChange(index, e.target.name as keyof Author, e.target.value)
              }
              disabled={!editMode && isViewMode}
            />
          </div>
        </>
      );
    }
    return (
      <>
        <div className="author-input-group">
          <div className="author-search-container">
            <input
              type="text"
              className="form-control"
              placeholder="Name (Searchable)"
              value={author.name || searchQueries[index] || ''}
              onChange={(e) => handleSearchInputChange(e, index)}
              onFocus={() => {
                activeAuthorSearchIndexRef.current = index;
                // Close any dropdown left open on another row
                setShowSuggestions((prev) => {
                  const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
                  if (!prevArray.some((isOpen, i) => isOpen && i !== index)) return prevArray;
                  return prevArray.map((isOpen, i) => (i === index ? isOpen : false));
                });
                // Skip if author was just added to prevent auto-dropdown
                if (justAddedAuthorRef.current) return;
                const selectedAuthor = authors[index];
                const hasSelectedAuthor = Boolean(
                  selectedAuthor?.name &&
                  (selectedAuthor?.author_id || selectedAuthor?.register_no),
                );
                if (hasSelectedAuthor) return;
                // Trigger search on focus to show dropdown when clicking
                if (!isViewMode && editMode) {
                  searchAuthor(searchQueries[index] || '', index);
                }
              }}
              onBlur={() => handleAuthorSearchBlur(index)}
              disabled={!editMode && isViewMode}
              autoComplete="off"
            />
            {showSuggestions[index] && (searchResults[index] || []).length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 1000,
                  maxHeight: '250px',
                  overflowY: 'auto',
                  marginTop: '4px',
                }}
              >
                {(searchResults[index] || []).map((result) => (
                  <div
                    key={result?.id || ''}
                    onMouseDown={() => handleAuthorSelect(result, index)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                  >
                    <div
                      style={{
                        fontWeight: '600',
                        color: '#333',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {result?.name || ''}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>
                      {result?.author_id || ''} | {result?.designation || 'Faculty'} |{' '}
                      {result?.department || ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* These readOnly fields will display the data after a faculty member is selected.
              Faculty details always come from the master record -- never typed here -- so a
              blank one means the employee record needs fixing; validateAuthors says so. */}
          <input
            type="text"
            className="form-control"
            placeholder="Department"
            value={author.department || ''}
            readOnly
          />
          <input
            type="text"
            className="form-control"
            placeholder="Organization"
            value={author.organization || ''}
            readOnly
          />
        </div>
      </>
    );
  };

  const handleAuthorSearchBlur = (index: number) => {
    if (activeAuthorSearchIndexRef.current === index) {
      activeAuthorSearchIndexRef.current = null;
    }
    // Cancel a debounced search so it cannot reopen the dropdown after blur
    if (authorSearchTimerRef.current[index]) {
      clearTimeout(authorSearchTimerRef.current[index] as ReturnType<typeof setTimeout>);
      authorSearchTimerRef.current[index] = null;
    }
    authorSearchTokenRef.current[index] = (authorSearchTokenRef.current[index] || 0) + 1;
    setTimeout(() => {
      setShowSuggestions((prev) => {
        const prevArray = Array.isArray(prev) ? prev : Array(MAX_AUTHORS).fill(false);
        if (prevArray[index] === false) {
          return prevArray;
        }
        const newSuggestions = [...prevArray];
        newSuggestions[index] = false;
        return newSuggestions;
      });
    }, 150); // 150ms is a safe delay.
  };

  const handlePrimarySelection = (selectedIndex: number) => {
    setAuthors((prevAuthors) =>
      prevAuthors.map((author, index) => ({
        ...author,
        is_primary: index === selectedIndex,
      })),
    );
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(event.target.value);
  };

  const handleMetricToggle = (metric: keyof Metrics, value: boolean | null = null) => {
    setMetrics((prevMetrics) => ({
      ...prevMetrics,
      [metric]: value !== null ? value : !prevMetrics[metric],
    }));

    // Update required fields based on toggle
    if (metric === 'doi' && !value) {
      setDoi('');
    }

    // When the Issue toggle is turned off, clear the Regular/Special issue selection;
    // when it is turned on with nothing picked, Regular Issue is the default.
    if (metric === 'issue') {
      const nextIssue = value !== null ? value : !metrics.issue;
      const radios = document.querySelectorAll<HTMLInputElement>('input[name="issueType"]');
      if (!nextIssue) {
        radios.forEach((radio) => (radio.checked = false));
      } else if (![...radios].some((radio) => radio.checked)) {
        const regular = document.getElementById('regularIssue') as HTMLInputElement | null;
        if (regular) regular.checked = true;
      }
    }

    if (metric === 'dateOfSubmission' && !value) {
      setStatus('waiting');
      const dependentFields: (keyof Metrics)[] = [
        'volume',
        'issue',
        'pages',
        'articleNumber',
        'doi',
        'acceptedForPublication',
        'availableOnline',
      ];
      setMetrics((prev) => {
        const updated = { ...prev };
        dependentFields.forEach((field) => (updated[field] = false));
        return updated;
      });
      // Reset page/article choice when dateOfSubmission is disabled
      setPageOrArticleChoice('pages');
      // Reset DOI when dateOfSubmission is disabled
      setDoi('');
    }
  };

  // Handle page/article number choice selection
  const handlePageOrArticleChoice = (choice: PageOrArticleChoice) => {
    setPageOrArticleChoice(choice);

    // Update metrics state based on choice
    if (choice === 'pages') {
      setMetrics((prev) => ({
        ...prev,
        pages: true,
        articleNumber: false,
      }));
    } else if (choice === 'article') {
      setMetrics((prev) => ({
        ...prev,
        pages: false,
        articleNumber: true,
      }));
    } else {
      // Clear choice - disable both
      setMetrics((prev) => ({
        ...prev,
        pages: false,
        articleNumber: false,
      }));
    }
  };

  // The published article is always a PDF, and the server caps it at 5 MB. Both are
  // checked here so a wrong pick is reported immediately instead of at submit time.
  const MAX_ARTICLE_FILE_BYTES = 5 * 1024 * 1024;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const files = input?.files;
    const file = files && files.length > 0 ? files[0] : null;

    if (file) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        input.value = '';
        showAlert('Only PDF files are allowed for the published article.', 'error');
        return;
      }
      if (file.size > MAX_ARTICLE_FILE_BYTES) {
        input.value = '';
        showAlert('The published article must be 5 MB or smaller.', 'error');
        return;
      }
    }

    setSelectedFile(file);
    if (file) {
      setUploadedFile({
        path: URL.createObjectURL(file),
        name: file.name,
      });
    } else {
      setUploadedFile(null);
    }
  };

  const handleFileDelete = () => {
    setSelectedFile(null);
    setUploadedFile(null);
    // Reset the file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const getFileUrl = (filePath: string): string => {
    if (!filePath) return '#';
    const cleanedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    return `${authenticityUtility.getBaseURL()}/${cleanedPath}`;
  };

  const handleCloseRejectedAlert = () => {
    setShowRejectedAlert(false);
  };

  // Add new function to fetch status updates
  const fetchStatusUpdates = async () => {
    if (!journalId) return;

    try {
      const response = await authenticityUtility.get(`/journals/${journalId}/status-updates`);
      if (response.data && Array.isArray(response.data)) {
        setStatusUpdates(response.data);
      }
    } catch (error) {
      console.error('Error fetching status updates:', error);
    }
  };

  // Add new function to submit status update
  const handleStatusUpdateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newStatusUpdate.status.trim()) {
      showAlert('Please select a status.', 'warning', 'Status Required');
      return;
    }

    try {
      setLoadingStatusUpdate(true);
      const response = (await authenticityUtility.post(`/journals/${journalId}/status-updates`, {
        status: newStatusUpdate.status,
        user_comment: newStatusUpdate.userComment,
      })) as any;

      if (response.status === 'success') {
        setNewStatusUpdate({ status: '', userComment: '' });
        await fetchStatusUpdates(); // Refresh the list
        showAlert('Status update submitted successfully.', 'success');
      }
    } catch (error: any) {
      console.error('Error submitting status update:', error);
      showAlert(
        error.response?.data?.message || error.message || 'Could not submit the status update.',
        'error',
        'Status Update Failed',
      );
    } finally {
      setLoadingStatusUpdate(false);
    }
  };

  // Add validation functions
  const validateAuthors = (): string => {
    if (authors.length === 0) {
      return 'At least one author is required';
    }

    for (const author of authors) {
      const designation = (author.designation || '').toLowerCase();

      // A faculty row is filled entirely from the master employee record and
      // its Department/Organization are read-only, so a blank one is a gap in
      // that record, not something the user left empty. Say so, or the generic
      // message below sends them hunting for a field they cannot type into.
      if (designation === 'faculty' && author.name) {
        if (!author.department || !author.organization) {
          const missingField = !author.department ? 'department' : 'organization';
          return `No ${missingField} on the employee record for "${author.name}". Please ask an admin to update the master data, then re-select the author.`;
        }
      }

      // External authors have no Department input in the form, so only
      // name/organization are required for them (country is checked below).
      const baseMissing =
        !author.name ||
        !author.designation ||
        !author.organization ||
        (designation !== 'external' && !author.department);
      if (baseMissing) return 'All author fields must be filled';

      if (designation === 'student') {
        if (!author.register_no) return 'Student Register No. is required';
      } else if (designation === 'faculty') {
        if (!author.author_id) return 'Faculty Author ID is required';
      } else if (designation === 'external') {
        if (!author.country) return 'External Country is required';
      }
    }

    // Check if corresponding author is selected
    if (!authors.some((author) => author.is_primary)) {
      return 'Please select a corresponding author';
    }

    return '';
  };

  const validateAffiliations = (): string => {
    // Check if at least one collaboration is selected
    const hasCollaboration = selectedCollaborations.length > 0;

    if (!hasCollaboration && !othersSelected) {
      return 'Please select at least one collaboration';
    }

    if (othersSelected && !othersValue.trim()) {
      return 'Please specify other collaboration';
    }

    return '';
  };

  const validateIndexes = (): string => {
    return selectedIndexes.length > 0 ? '' : 'Please select at least one index';
  };

  const validateAcknowledgements = (): string => {
    // Skip acknowledgement validation for Book and Book Chapter types
    if (isBook || isBookChapter) {
      return '';
    }

    // Check if at least one acknowledgement is selected
    const hasAcknowledgement = selectedAcknowledgements.length > 0 || acknowledgements.Others;

    if (!hasAcknowledgement) {
      return 'Please select at least one acknowledgement';
    }

    if (acknowledgements.Others && !otherAcknowledgement.trim()) {
      return 'Please specify other acknowledgement';
    }

    return '';
  };

  const validateAbstractAndKeywords = (): string => {
    // A whole book is not asked for these, so a value it hides cannot block the save.
    if (isBook) return '';

    // Abstract validation (optional for all types)
    if (abstract && abstract.length < 150) {
      return 'Abstract must be at least 150 characters long';
    }

    // Keywords validation (optional for all types)
    if (keywords) {
      const keywordList = keywords
        .split(';')
        .map((k) => k.trim())
        .filter((k) => k);
      if (keywordList.length < 3) {
        return 'Please provide at least 3 keywords';
      }
      if (keywordList.length > 10) {
        return 'Please provide no more than 10 keywords';
      }
    }

    return '';
  };

  const validatePagesOrArticleNumber = (): string | null => {
    // Only validate pages/article numbers when status is published
    if (status === 'published') {
      if (!pageOrArticleChoice) {
        return 'Please select either Pages or Article Number';
      }

      if (pageOrArticleChoice === 'pages') {
        const pagesFrom = (document.getElementById('pagesFromInput') as HTMLInputElement)?.value;
        const pagesTo = (document.getElementById('pagesToInput') as HTMLInputElement)?.value;
        if (!pagesFrom || !pagesTo) {
          return 'Please enter both from and to page numbers';
        }
      } else if (pageOrArticleChoice === 'article') {
        const articleNumber = (document.getElementById('articleNumberInput') as HTMLInputElement)
          ?.value;
        if (!articleNumber) {
          return 'Please enter the article number';
        }
      }
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isFormSubmitting) return;

    // Collect all validation errors
    const errors: string[] = [];

    // Helper to safely get form values
    const getFormValue = (name: string, defaultValue: string | null = null): string | null => {
      if (name === 'type') {
        const normalizedType = String(currentType || '').trim();
        if (normalizedType) return normalizedType;
      }
      const element = (event.currentTarget as HTMLFormElement).elements.namedItem(
        name,
      ) as HTMLInputElement;
      if (!element) return defaultValue;
      if (element.type === 'radio') {
        const checkedRadio = document.querySelector(
          `input[name="${name}"]:checked`,
        ) as HTMLInputElement;
        return checkedRadio ? checkedRadio.value : defaultValue;
      }
      return element.value || defaultValue;
    };

    // Required fields validation (conditional based on category)
    if (!getFormValue('title')) errors.push('Title is required');
    if (!getFormValue('type')) errors.push('Type is required');

    // For Journal, require journal name
    if (isJournal && !journalDetails.name) {
      errors.push('Journal Name is required');
    }

    // For Conference, require conference title
    if (isConference && !publicationDetails.conference_title?.trim()) {
      errors.push('Conference Name is required');
    }

    // For Journal only, require quartile (updated logic for new validation)
    const typeValue = getFormValue('type');
    const isJournalType =
      typeValue === 'Article' ||
      typeValue === 'Journal Article' ||
      typeValue === 'Research Article' ||
      typeValue === 'Erratum' ||
      typeValue === 'Editorial' ||
      typeValue === 'Note' ||
      typeValue === 'Review' ||
      typeValue === 'Retraction';
    if (isJournalType && !getFormValue('quartile')) {
      errors.push('Quartile is required for Journal articles');
    }

    // Authors validation
    const authorError = validateAuthors();
    if (authorError) errors.push(authorError);

    // Affiliations validation
    const affiliationError = validateAffiliations();
    if (affiliationError) errors.push(affiliationError);

    // Indexes validation
    const indexError = validateIndexes();
    if (indexError) errors.push(indexError);

    // Acknowledgements validation
    const acknowledgementError = validateAcknowledgements();
    if (acknowledgementError) errors.push(acknowledgementError);

    // Abstract and Keywords validation
    const abstractKeywordsError = validateAbstractAndKeywords();
    if (abstractKeywordsError) errors.push(abstractKeywordsError);

    // Pages or Article Number validation
    const pagesOrArticleError = validatePagesOrArticleNumber();
    if (pagesOrArticleError) errors.push(pagesOrArticleError);

    // Metrics validation (only for Journal type)
    if (isJournalType) {
      if (metrics.impactFactor && !getFormValue('impactFactorInput')) {
        errors.push('Impact Factor is required when enabled');
      }
      if (metrics.citeScore && !getFormValue('citeScoreInput')) {
        errors.push('Cite Score is required when enabled');
      }
    }

    if (metrics.dateOfSubmission) {
      if (!getFormValue('dateOfSubmissionInput')) errors.push('Date of Submission is required');
      if (metrics.volume && !getFormValue('volumeInput')) errors.push('Volume is required');
      if (metrics.issue && !getFormValue('issueInput')) errors.push('Issue is required');
      if (metrics.pages && (!getFormValue('pagesFromInput') || !getFormValue('pagesToInput'))) {
        errors.push('Both From and To pages are required');
      }
      if (metrics.articleNumber && !getFormValue('articleNumberInput')) {
        errors.push('Article Number is required');
      }
      if (metrics.doi && !getFormValue('doiInput')) errors.push('DOI is required');
      if (metrics.acceptedForPublication && !getFormValue('acceptedDateInput')) {
        errors.push('Accepted Date is required');
      }
      if (metrics.availableOnline && !getFormValue('availableDateInput')) {
        errors.push('Available Online Date is required');
      }
    }

    // If there are any validation errors, display them and stop submission
    if (errors.length > 0) {
      showAlert(
        <>
          <div className="mb-2">Please fix the following before submitting:</div>
          <ul className="mb-0 ps-3">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </>,
        'warning',
        errors.length === 1 ? '1 item needs attention' : `${errors.length} items need attention`,
      );
      return;
    }

    // Get collaborations from multi-select state
    const getCollaborations = (): string[] => {
      const collaborations = [...selectedCollaborations];
      // Add "others" value if specified
      if (othersSelected && othersValue.trim()) {
        collaborations.push(othersValue.trim());
      }
      return collaborations;
    };

    // Prepare acknowledgements object for JSON
    const acknowledgementData: any = {};
    selectedAcknowledgements.forEach((ack) => {
      acknowledgementData[ack] = true;
    });
    if (acknowledgements.Others) {
      acknowledgementData.Others = true;
      acknowledgementData.otherValue = otherAcknowledgement.trim();
    }

    // Build publication_details JSON for Conference, Book Chapter, and Book. The publisher
    // name is sent beside its id for older readers of the JSON; the server overwrites it
    // with the master row's name.
    let publicationDetailsData: PublicationDetails | null = null;
    if (isConference || isBookChapter || isBook) {
      publicationDetailsData = {
        conference_title: isConference ? publicationDetails.conference_title?.trim() || '' : '',
        source: publicationDetails.source?.trim() || '',
        publisher: publicationDetails.publisher?.trim() || '',
        publisher_id: publicationDetails.publisher_id ?? null,
        print_isbn: publicationDetails.print_isbn?.trim() || '',
        online_isbn: publicationDetails.online_isbn?.trim() || '',
      };
      if (isConference) {
        publicationDetailsData.city = publicationDetails.city?.trim() || '';
        publicationDetailsData.dates = publicationDetails.dates?.trim() || '';
      }
    }

    // Prepare the journal data object with category-specific fields
    const journalData: any = {
      category: isInternational ? 'International' : 'National',
      title: getFormValue('title'),
      book_chapter_title: isBookChapter ? bookChapterTitle : null,
      type: getFormValue('type'),
      journal_name: isJournal
        ? journalDetails.name
        : isConference
          ? publicationDetails.conference_title
          : '',
      // Names are not unique in the registry, so the id decides which journal this
      // publication is filed against (and therefore its National/International level).
      journal_options_id: isJournal ? journalOptionsId : null,
      author_affiliation: getCollaborations(),
      driven_by: drivenBy,
      acknowledgement: acknowledgementData,
      sdgs: selectedSDGs,
      // Not asked of a whole book (the card is hidden), so a book saves none.
      abstract: isBook ? null : abstract,
      keywords: isBook ? null : keywords,
      date_of_submission: getFormValue('dateOfSubmissionInput'),
      status: status || 'waiting',
      volume: getFormValue('volumeInput'),
      issue: getFormValue('issueInput'),
      // Only with an issue: Regular Issue is pre-selected when the toggle is switched on,
      // and would otherwise be saved on a publication that has no issue at all.
      issue_type: metrics.issue ? getFormValue('issueType') : null,
      // Page range and article number are mutually exclusive; pages_from used to be sent
      // in either mode, so switching to an article number left a stale start page behind.
      pages_from:
        pageOrArticleChoice === 'pages'
          ? parseInt(getFormValue('pagesFromInput', '0') || '0') || null
          : null,
      pages_to:
        pageOrArticleChoice === 'pages'
          ? parseInt(getFormValue('pagesToInput', '0') || '0') || null
          : null,
      article_number: pageOrArticleChoice === 'article' ? getFormValue('articleNumberInput') : null,
      doi: getFormValue('doiInput'),
      // Removing an index clears its ID (handleIndexesChange), so these are sent as held.
      scopus_id: scopusId,
      scie_id: scieId,
      credit_to: selectedCreditTo,
      reference_number: isBook ? null : referenceNumber,
      accepted_date: getFormValue('acceptedDateInput'),
      available_online_date: getFormValue('availableDateInput'),
      open_access: openAccess || null,
      year: year || null,
      wos_id: wosId || null,
      pubmed_pmid: pubmedPmid || null,
    };

    // Add publication_details for Conference, Book Chapter, and Book
    if (publicationDetailsData) {
      journalData.publication_details = publicationDetailsData;
    }

    // Build external_details JSON array from authors marked as external
    const externalDetails: ExternalAuthorDetails[] = [];
    authors.forEach((author) => {
      if (author.designation === 'external') {
        externalDetails.push({
          name: (author.name || '').trim(),
          department: (author.department || '').trim(),
          organization: (author.organization || '').trim(),
          country: (author.country || '').trim(),
          state: (author.state || '').trim(),
          email: (author.email || '').trim() || undefined,
          is_first_author: Boolean(author.is_first_author),
          is_primary: Boolean(author.is_primary),
        });
      }
    });

    // Attach external_details to journalData BEFORE sending
    if (externalDetails.length > 0) {
      journalData.external_details = externalDetails;
    } else {
      journalData.external_details = null;
    }

    // Quartile is asked of every category (required only for journal articles, above).
    journalData.quartile = getFormValue('quartile') || null;

    // Add Journal-specific fields only for Journal types
    if (isJournalType) {
      const impactFactorValue = getFormValue('impactFactorInput');
      const citeScoreValue = getFormValue('citeScoreInput');

      // Parse Impact Factor and Cite Score - always collect if present
      journalData.impact_factor =
        impactFactorValue && impactFactorValue !== '' ? parseFloat(impactFactorValue) : null;
      journalData.cite_score =
        citeScoreValue && citeScoreValue !== '' ? parseFloat(citeScoreValue) : null;
    }

    setIsFormSubmitting(true);
    try {
      let currentJournalId: string;
      const isEditFlow = Boolean(journalId);

      // ══════════════════════════════════════════════════════════════════════
      // STEP 1: CREATE or UPDATE the journal record
      // ══════════════════════════════════════════════════════════════════════
      if (isEditFlow) {
        // EDIT FLOW: Update existing journal
        await authenticityUtility.put(`/journals/${journalId}`, journalData);
        currentJournalId = journalId;
      } else {
        // CREATE FLOW: Create new journal
        const response = await authenticityUtility.post('/journals', journalData);
        if (!response?.data?.id) {
          console.error('Invalid response structure:', response);
          throw new Error('Server response missing journal ID');
        }
        currentJournalId = response.data.id;
        setJournalId(currentJournalId);
      }

      // ══════════════════════════════════════════════════════════════════════
      // STEP 2: Process authors (common to both flows)
      // ══════════════════════════════════════════════════════════════════════

      // Authors the user removed from the form have to be unlinked on the server; only
      // adds and updates used to be sent, so a removed author reappeared on reload.
      if (isEditFlow) {
        const remainingLinkIds = new Set(
          authors.map((author) => author.dbAuthorId).filter(Boolean) as string[],
        );
        const removedLinkIds = loadedAuthorLinkIdsRef.current.filter(
          (linkId) => !remainingLinkIds.has(linkId),
        );

        for (const linkId of removedLinkIds) {
          await authenticityUtility.delete(`/journals/${currentJournalId}/authors/${linkId}`);
        }
      }

      for (const author of authors) {
        const isStudent = author.designation === 'student';
        const isExternal = author.designation === 'external';

        // Skip external authors - already saved in journalData.external_details
        if (isExternal) continue;

        // Validate required fields
        if (isStudent) {
          const nameOk = Boolean(author.name?.trim());
          const depOk = Boolean(author.department?.trim());
          const orgOk = Boolean(author.organization?.trim());
          if (!nameOk || !depOk || !orgOk) continue;
        } else {
          // Faculty requires an author_id
          if (!author.author_id?.trim()) continue;
        }

        const authorData = {
          author_id: isStudent
            ? (author.register_no || '').trim()
            : (author.author_id || '').trim(),
          name: (author.name || '').trim(),
          department: (author.department || '').trim(),
          designation: isStudent ? 'student' : 'faculty',
          organization: (author.organization || '').trim(),
          country: (author.country || '').trim(),
          state: (author.state || '').trim(),
          is_first_author: Boolean(author.is_first_author),
          is_primary: Boolean(author.is_primary),
        };

        // Update existing author or create new
        if (isEditFlow && author.dbAuthorId) {
          await authenticityUtility.put(
            `/journals/${currentJournalId}/authors/${author.dbAuthorId}`,
            authorData,
          );
        } else {
          await authenticityUtility.post(`/journals/${currentJournalId}/authors`, authorData);
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // STEP 3: Process indexes (common to both flows)
      // ══════════════════════════════════════════════════════════════════════
      // Replace the whole set rather than appending: re-posting each selected index on
      // every save duplicated rows and never dropped a de-selected one.
      await authenticityUtility.put(`/journals/${currentJournalId}/indexes`, {
        indexes: selectedIndexes,
      });

      // ══════════════════════════════════════════════════════════════════════
      // STEP 4: Upload file if selected (common to both flows)
      // ══════════════════════════════════════════════════════════════════════
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        try {
          const uploadResponse = (await authenticityUtility.postFile(
            `/journals/${currentJournalId}/upload`,
            formData,
          )) as any;
          const filePath = uploadResponse?.data?.filePath || uploadResponse?.filePath;
          if (filePath) {
            setUploadedFile({ path: filePath, name: selectedFile.name });
            setSelectedFile(null);
          } else {
            console.warn('Invalid file upload response:', uploadResponse);
          }
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError);
          // Non-critical: continue with success flow
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // STEP 5: EDIT FLOW ONLY - Clear edit request status
      // ══════════════════════════════════════════════════════════════════════
      if (isEditFlow) {
        try {
          await authenticityUtility.patch(`/edit-requests/journals/${currentJournalId}`, {
            status: 'none',
            userId: user?.id,
          });
        } catch (editRequestError: any) {
          // Non-critical: Log but don't fail the submission
          console.warn(
            'Non-critical: Could not clear edit request status:',
            editRequestError.message,
          );
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // STEP 6: Success handling
      // ══════════════════════════════════════════════════════════════════════
      const successMessage = isEditFlow
        ? 'Journal updated successfully!'
        : 'Journal created successfully!';
      showAlert(successMessage, 'success');

      // Back to view mode
      syncModeToUrl('view');

      setEditMode(false);

      // Re-read the saved record instead of assuming what the workflow now looks like.
      // Hard-coding 'pending' here contradicted the server whenever an admin edited an
      // approved publication, and it hid the journal level, indexes and authors the
      // server had just recalculated.
      await fetchJournalDetails(currentJournalId);
      await checkEditRequestStatus(currentJournalId);
    } catch (error: any) {
      console.error('Error submitting journal:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      showAlert(errorMessage, 'error', 'Could Not Save');
    } finally {
      setIsFormSubmitting(false);
    }
  };

  // Style for suggestions dropdown
  const suggestionsStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  // Add error boundary for the component
  try {
    return (
      <div className="journal-form-body">
        <div className="container journal-form-container">
          {/* View Mode & Edit Request Alerts */}
          {/* The embedded form is a read-only record inside a page that supplies its own
              workflow controls, so it does not offer its own way into edit mode. */}
          {!embedded &&
            isViewMode &&
            (adminApprovalStatus === 'approved' && !hasAdminOverride ? (
              <ViewModeBanner
                locked
                message="This publication is admin approved. Request an edit to modify it."
                action={{
                  label:
                    editRequestStatus === 'pending'
                      ? 'Request Pending'
                      : canRequestEdit
                        ? 'Request Edit'
                        : 'Edit Not Available',
                  onClick: handleEditRequest,
                  disabled: !canRequestEdit || editRequestStatus === 'pending',
                }}
              />
            ) : (
              <ViewModeBanner
                message={
                  adminApprovalStatus === 'approved'
                    ? 'This publication is admin approved. You have admin rights to edit it directly.'
                    : 'This submission is not yet approved. You can edit it directly.'
                }
                action={{
                  label: 'Edit now',
                  icon: <Pencil size={15} />,
                  onClick: openEditableMode,
                }}
              />
            ))}
          {editRequestStatus === 'rejected' && showRejectedAlert && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              Your previous edit request was rejected.
              <button
                type="button"
                className="btn-close"
                onClick={handleCloseRejectedAlert}
              ></button>
            </div>
          )}
          {/* Status updates — a floating bell, like the budget page's, that opens them in
              a panel over the form. Only once the publication exists (there is nothing to
              update before), and not when embedded: an embedded form is a read-only record
              inside a page that supplies its own controls (admin review). */}
          {journalId && !embedded && (
            <div className="journal-updates-trigger">
              <button
                type="button"
                className="journal-updates-button"
                onClick={() => setShowUpdates(true)}
                aria-label="Open status updates"
                title="Status updates"
              >
                <Bell size={20} />
              </button>
            </div>
          )}

          {/* The publication form. It carries noValidate: it does its own checking and reports every
              problem at once in one modal. With the browser's constraint validation on,
              native bubbles competed with that — and worse, a required control that had
              gone blank (a Type select whose option list no longer held the saved value,
              say) silently cancelled the submit with no message at all. */}
          <form
            ref={publicationFormRef}
            onSubmit={handleSubmit}
            noValidate
            onInput={(event) => markDateEmptiness(event.target)}
            onChange={(event) => markDateEmptiness(event.target)}
          >
            {/* Author Card */}
            {/* --- Merged and Refined Author Card (Final Version) --- */}
            <div className="form-card">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="form-section-title">Author(s)</h6>
                <div className="d-flex align-items-center">
                  <span className="me-3">Driven by:</span>
                  <div className="radio-group">
                    <div className="radio-item">
                      <input
                        type="radio"
                        id="drivenByFaculty"
                        name="drivenBy"
                        value="faculty"
                        checked={drivenBy === 'faculty'}
                        onChange={(e) => setDrivenBy(e.target.value as 'faculty' | 'student')}
                        disabled={!editMode && isViewMode}
                      />
                      <label htmlFor="drivenByFaculty">Faculty</label>
                    </div>
                    <div className="radio-item">
                      <input
                        type="radio"
                        id="drivenByStudent"
                        name="drivenBy"
                        value="student"
                        checked={drivenBy === 'student'}
                        onChange={(e) => setDrivenBy(e.target.value as 'faculty' | 'student')}
                        disabled={!editMode && isViewMode}
                      />
                      <label htmlFor="drivenByStudent">Student</label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error display (no change) */}
              {error && <div className="alert alert-danger">{error}</div>}

              {/* Map through authors to render each row */}
              {authors.map((author, index) => (
                <div
                  key={author.id}
                  className="author-row mb-3"
                  draggable={!isViewMode}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  style={{
                    cursor: editMode && !isViewMode ? 'move' : 'default',
                  }}
                >
                  {/* Drag handle */}
                  {editMode && !isViewMode && (
                    <div
                      className="drag-handle"
                      style={{
                        cursor: 'grab',
                        padding: '8px',
                        color: '#6c757d',
                      }}
                    >
                      <GripVertical size={16} />
                    </div>
                  )}
                  {/* 1. Radio button (always visible) */}
                  <div className="custom-tooltip">
                    <input
                      type="radio"
                      id={`author${author.id}`}
                      name="author"
                      className="author-row-radio"
                      checked={author.is_primary}
                      onChange={() => handlePrimarySelection(index)}
                      disabled={!editMode && isViewMode}
                    />
                    <span className="tooltip-text">Corresponding Author</span>
                  </div>
                  {/* 2. ID Label (always visible) - Hidden per user request */}
                  {/* <label className="form-check-label" htmlFor={`author${author.id}`}>
                                    {index + 1}
                                </label> */}

                  {/* 3. Dropdown (always visible) - Default to 'faculty' to ensure fields are shown immediately */}
                  <div style={{ position: 'relative' }}>
                    <select
                      className="form-control designation-select"
                      value={(
                        authorDesignations[index] ||
                        author.designation ||
                        'faculty'
                      ).toLowerCase()}
                      onChange={(e) => handleDesignationChange(index, e.target.value)}
                      disabled={!editMode && isViewMode}
                    >
                      <option value="faculty">Faculty</option>
                      <option value="student">Student</option>
                      <option value="external">External</option>
                    </select>
                    <ChevronDown
                      size={12}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: '#6c757d',
                      }}
                    />
                  </div>
                  {/* --- Conditional Fields Block --- */}
                  {renderAuthorFields(author, index)}

                  {/* --- End Conditional Block --- */}

                  {/* 4. Row action buttons: Add and Delete - Hide completely in view mode */}
                  {editMode && !isViewMode && (
                    <div className="author-action-buttons">
                      {/* Only show add button on the last author row */}
                      {index === authors.length - 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-add-author"
                          onClick={addAuthor}
                          disabled={authors.length >= MAX_AUTHORS}
                          aria-label="Add author"
                          title="Add author"
                        >
                          <Plus size={16} />
                        </button>
                      )}

                      {authors.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-delete-author"
                          onClick={() => deleteAuthor(author.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* One Article Details card: the title, a tinted panel for where the work was
                  published (journal, conference or book), then the fields every category
                  shares. It used to be two side-by-side cards of stacked full-width fields,
                  which put related values (ISSNs, metrics) far apart and ran very long. */}
            <div className="form-card article-details-card" style={{ padding: '24px' }}>
              <h6 className="form-section-title section-title-divider mb-3">
                {effectiveIsBook ? 'Book Details' : 'Article Details'}
              </h6>

              <div className="row g-3 mb-3">
                <div className={effectiveIsJournal ? 'col-lg-9' : 'col-12'}>
                  <label className="form-label" htmlFor="title">
                    {effectiveIsBook
                      ? 'Book Title'
                      : effectiveIsBookChapter
                        ? 'Book Chapter Title'
                        : effectiveIsConference
                          ? 'Conference Article Title'
                          : 'Title'}
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    className="form-control"
                    placeholder="Enter Title"
                    required
                    disabled={!editMode && isViewMode}
                  />
                </div>

                {effectiveIsJournal ? (
                  <div className="col-lg-3">
                    <label className="form-label" htmlFor="typeSelect">
                      Type
                    </label>
                    {isViewMode ? (
                      <input type="text" className="form-control" value={currentType} readOnly />
                    ) : (
                      <select
                        id="typeSelect"
                        name="type"
                        className="form-select"
                        value={currentType}
                        onChange={(e) => setCurrentType(e.target.value)}
                        required
                        disabled={!editMode && isViewMode}
                      >
                        <option value="">Select Article Type</option>
                        <option value="Article">Article</option>
                        <option value="Erratum">Erratum</option>
                        <option value="Editorial">Editorial</option>
                        <option value="Note">Note</option>
                        <option value="Review">Review</option>
                        <option value="Retraction">Retraction</option>
                      </select>
                    )}
                  </div>
                ) : (
                  // Conference, Book and Book Chapter each have exactly one type, fixed
                  // by the page they were opened from, so it is carried rather than asked.
                  <input type="hidden" name="type" value={currentType} />
                )}
              </div>

              <div className="publication-source-panel">
                <div className="d-flex justify-content-between align-items-center mb-3 section-title-divider">
                  <h6 className="form-section-title mb-0">
                    {effectiveIsJournal
                      ? 'Journal Details'
                      : effectiveIsConference
                        ? 'Conference Details'
                        : 'Book Details'}
                  </h6>
                  {/* Adding to a master list is an authoring action, so it is absent
                        from a read-only embedded record. */}
                  {!embedded &&
                    (effectiveIsJournal ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-add-journal"
                        onClick={openJournalRequestModal}
                        disabled={!editMode && isViewMode}
                      >
                        Add Journal
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-add-journal"
                        onClick={() => setShowAddPublisherModal(true)}
                        disabled={!editMode && isViewMode}
                      >
                        Add Publisher
                      </button>
                    ))}
                </div>

                {effectiveIsJournal && (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-lg-5 position-relative">
                        <label htmlFor="journalSearch" className="form-label">
                          Journal Name
                        </label>
                        <input
                          type="text"
                          id="journalSearch"
                          className="form-control"
                          placeholder="Search for a Journal"
                          value={journalSearchQuery}
                          onChange={handleJournalSearchChange}
                          onFocus={() => {
                            // Show dropdown on focus
                            if (!isViewMode && editMode) {
                              searchJournals(journalSearchQuery || '');
                            }
                          }}
                          onBlur={() => setTimeout(() => setShowJournalSuggestions(false), 150)}
                          disabled={!editMode && isViewMode}
                          autoComplete="off"
                        />
                        {showJournalSuggestions &&
                          journalSearchResults.length > 0 &&
                          !isViewMode &&
                          editMode && (
                            <ul className="list-group" style={suggestionsStyle}>
                              {journalSearchResults.map((journal, index) => (
                                <li
                                  key={index}
                                  className="list-group-item list-group-item-action"
                                  onMouseDown={() => selectJournal(journal)}
                                >
                                  {journal.name}
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>
                      <div className="col-lg-3">
                        <label className="form-label">Level</label>
                        <input
                          type="text"
                          className="form-control"
                          value={
                            journalDetails.name
                              ? isInternational
                                ? 'International'
                                : 'National'
                              : ''
                          }
                          readOnly
                        />
                      </div>
                      <div className="col-lg-4">
                        <label className="form-label">Publisher</label>
                        <input
                          type="text"
                          className="form-control"
                          value={journalDetails.publisher}
                          readOnly
                        />
                      </div>
                    </div>

                    {/* Everything on this row comes from the journal registry, so it is
                          read-only here; admins curate it in Publication Management. */}
                    <div className="row g-3 mb-3">
                      <div className="col-lg-3">
                        <label className="form-label">Website</label>
                        <div className="website-field">
                          <input
                            type="text"
                            className="form-control"
                            value={journalDetails.website}
                            readOnly
                          />
                          {journalWebsiteHref ? (
                            <a
                              href={journalWebsiteHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="website-link"
                              title="Open journal website"
                              aria-label="Open journal website"
                            >
                              <ExternalLink size={22} />
                            </a>
                          ) : (
                            <span className="website-link is-disabled" aria-hidden="true">
                              <ExternalLink size={22} />
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-lg">
                        <label className="form-label">Print ISSN</label>
                        <input
                          type="text"
                          className="form-control"
                          value={journalDetails.printISSN || ''}
                          readOnly
                        />
                      </div>
                      <div className="col-lg">
                        <label className="form-label">Online ISSN</label>
                        <input
                          type="text"
                          className="form-control"
                          value={journalDetails.onlineISSN || ''}
                          readOnly
                        />
                      </div>
                      <div className="col-lg">
                        <label className="form-label">Impact Factor</label>
                        <input
                          type="number"
                          step="0.001"
                          id="impactFactorInput"
                          name="impactFactorInput"
                          className="form-control"
                          disabled={true}
                          readOnly
                        />
                      </div>
                      <div className="col-lg">
                        <label className="form-label">Cite Score</label>
                        <input
                          type="number"
                          step="0.001"
                          id="citeScoreInput"
                          name="citeScoreInput"
                          className="form-control"
                          disabled={true}
                          readOnly
                        />
                      </div>
                    </div>
                  </>
                )}

                {effectiveIsConference && (
                  <div className="row g-3 mb-3">
                    <div className="col-lg-8">
                      <label className="form-label">Conference Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Conference Name"
                        value={publicationDetails.conference_title || ''}
                        onChange={(e) =>
                          setPublicationDetails((prev) => ({
                            ...prev,
                            conference_title: e.target.value,
                          }))
                        }
                        disabled={!editMode && isViewMode}
                      />
                    </div>
                    <div className="col-lg-4">
                      <label className="form-label">City</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter City"
                        value={publicationDetails.city || ''}
                        onChange={(e) =>
                          setPublicationDetails((prev) => ({ ...prev, city: e.target.value }))
                        }
                        disabled={!editMode && isViewMode}
                      />
                    </div>
                  </div>
                )}

                {effectiveIsBookChapter && (
                  <div className="row g-3 mb-3">
                    <div className="col-12">
                      <label className="form-label">Book Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Book Title"
                        value={bookChapterTitle}
                        onChange={(e) => setBookChapterTitle(e.target.value)}
                        disabled={!editMode && isViewMode}
                      />
                    </div>
                  </div>
                )}

                {!effectiveIsJournal && (
                  <div className="row g-3 mb-3">
                    {effectiveIsConference && (
                      <div className="col-lg-2">
                        <label className="form-label">Date(s)</label>
                        {/* Free text: a conference may run one day or several, and
                              the mockup asks for "Date(s)" rather than a range. */}
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Date(s)"
                          value={publicationDetails.dates || ''}
                          onChange={(e) =>
                            setPublicationDetails((prev) => ({ ...prev, dates: e.target.value }))
                          }
                          disabled={!editMode && isViewMode}
                        />
                      </div>
                    )}
                    <div className={effectiveIsConference ? 'col-lg-4' : 'col-lg-6'}>
                      <label className="form-label" htmlFor="publisherSelect">
                        Publisher
                      </label>
                      <PublisherSelect
                        publisherId={publicationDetails.publisher_id ?? null}
                        publisherName={publicationDetails.publisher || ''}
                        onChange={({ id, name }) =>
                          setPublicationDetails((prev) => ({
                            ...prev,
                            publisher: name,
                            publisher_id: id,
                          }))
                        }
                        disabled={!editMode && isViewMode}
                      />
                    </div>
                    <div className="col-lg-3">
                      <label className="form-label">Print ISBN</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Print ISBN"
                        value={publicationDetails.print_isbn || ''}
                        onChange={(e) =>
                          setPublicationDetails((prev) => ({
                            ...prev,
                            print_isbn: e.target.value,
                          }))
                        }
                        disabled={!editMode && isViewMode}
                      />
                    </div>
                    <div className="col-lg-3">
                      <label className="form-label">Online ISBN</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Online ISBN"
                        value={publicationDetails.online_isbn || ''}
                        onChange={(e) =>
                          setPublicationDetails((prev) => ({
                            ...prev,
                            online_isbn: e.target.value,
                          }))
                        }
                        disabled={!editMode && isViewMode}
                      />
                    </div>
                  </div>
                )}

                <div className="row g-3">
                  <div className="col-lg-8">
                    <label className="form-label">Index</label>
                    <CustomTagInput
                      name="index"
                      value={selectedIndexes}
                      onChange={handleIndexesChange}
                      suggestions={(() => {
                        // Google Scholar is no longer offered; a record that has it keeps the tag.
                        const availableIndexes = ['SCIE', 'Scopus', 'PubMed'];
                        return availableIndexes.filter(
                          (index) =>
                            index.toLowerCase().includes(indexSearchQuery.toLowerCase()) &&
                            !selectedIndexes.includes(index),
                        );
                      })()}
                      onSearch={setIndexSearchQuery}
                      placeholder={
                        selectedIndexes.length === 0 ? 'Type to Search and Select Indexing' : ''
                      }
                      disabled={!editMode && isViewMode}
                    />
                  </div>
                  <div className="col-lg-4">
                    <label className="form-label d-flex align-items-center gap-2">
                      Scopus Quartile
                      <span
                        className="quartile-info-icon"
                        title="Required for journal articles; optional for conference papers and books."
                      >
                        <Info size={16} aria-hidden="true" />
                      </span>
                    </label>
                    <div className="radio-group quartile-radio-group">
                      {['Q1', 'Q2', 'Q3', 'Q4', 'Nil'].map((q) => (
                        <div className="radio-item" key={q}>
                          <input
                            type="radio"
                            id={q.toLowerCase()}
                            name="quartile"
                            value={q === 'Nil' ? 'NA' : q}
                            disabled={!editMode && isViewMode}
                          />
                          <label htmlFor={q.toLowerCase()}>{q}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-lg-6">
                  <label className="form-label">Collaboration</label>
                  <CustomTagInput
                    name="collaboration"
                    value={selectedCollaborations}
                    onChange={setSelectedCollaborations}
                    suggestions={allCollaborations.filter(
                      (collab) =>
                        collab.toLowerCase().includes(collaborationSearchQuery.toLowerCase()) &&
                        !selectedCollaborations.includes(collab),
                    )}
                    onSearch={setCollaborationSearchQuery}
                    placeholder={
                      selectedCollaborations.length === 0
                        ? 'Type to Search and Select Collaboration'
                        : ''
                    }
                    disabled={!editMode && isViewMode}
                  />
                </div>
                <div className="col-lg-6">
                  <label className="form-label">Sustainable Development Goals (SDGs)</label>
                  <CustomTagInput
                    name="sdgs"
                    value={selectedSDGs}
                    onChange={setSelectedSDGs}
                    suggestions={allSDGs.filter(
                      (sdg) =>
                        sdg.toLowerCase().includes(sdgSearchQuery.toLowerCase()) &&
                        !selectedSDGs.includes(sdg),
                    )}
                    onSearch={setSdgSearchQuery}
                    placeholder={
                      selectedSDGs.length === 0 ? 'Type to Search and Select relevant SDGs' : ''
                    }
                    disabled={!editMode && isViewMode}
                    renderTag={(tag) =>
                      typeof tag === 'string' && tag.includes('.') ? tag.split('.')[0] : tag
                    }
                  />
                </div>
              </div>

              <div className="row g-3">
                <div className="col-lg-6">
                  <label className="form-label">Acknowledgement</label>
                  <CustomTagInput
                    name="acknowledgement"
                    value={selectedAcknowledgements}
                    onChange={(newTags) => {
                      if (newTags.includes('Nil') && !selectedAcknowledgements.includes('Nil')) {
                        setSelectedAcknowledgements(['Nil']);
                        setOtherAcknowledgement('');
                      } else if (newTags.length > 1 && newTags.includes('Nil')) {
                        // If currently have "Nil" and added something else, remove "Nil"
                        const withoutNil = newTags.filter((t) => t !== 'Nil');
                        setSelectedAcknowledgements(withoutNil);
                      } else {
                        setSelectedAcknowledgements(newTags);
                      }
                    }}
                    suggestions={allAcknowledgements.filter(
                      (ack) =>
                        ack.toLowerCase().includes(acknowledgementSearchQuery.toLowerCase()) &&
                        !selectedAcknowledgements.includes(ack),
                    )}
                    onSearch={setAcknowledgementSearchQuery}
                    placeholder={
                      selectedAcknowledgements.length === 0
                        ? 'Type to Search and Select Facilities Acknowledged'
                        : ''
                    }
                    disabled={!editMode && isViewMode}
                  />
                </div>
                <div className="col-lg-3">
                  <label className="form-label" htmlFor="dateOfSubmissionInput">
                    Submitted on
                  </label>
                  <input
                    type="date"
                    id="dateOfSubmissionInput"
                    name="dateOfSubmissionInput"
                    className="form-control"
                    disabled={!editMode && isViewMode}
                  />
                </div>
                <div className="col-lg-3">
                  <label className="form-label" htmlFor="statusDropdown">
                    Status
                  </label>
                  <div className="d-flex align-items-center gap-2">
                    <div className="position-relative flex-grow-1">
                      <select
                        id="statusDropdown"
                        className="form-control"
                        value={status}
                        onChange={handleStatusChange}
                        disabled={!editMode && isViewMode}
                      >
                        <option value="submitted">Submitted</option>
                        <option value="underReview">Under Review</option>
                        <option value="revisionSubmitted">Revision Submitted</option>
                        <option value="accepted">Accepted</option>
                        <option value="published">Published</option>
                      </select>
                      <ChevronDown
                        size={12}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          pointerEvents: 'none',
                          color: '#6c757d',
                        }}
                      />
                    </div>
                    {status === 'published' && (
                      <CheckCircle size={22} className="status-check-icon" />
                    )}
                  </div>
                </div>
              </div>

              {/* Journal Request Modal.
                    Rendered into document.body: its own <form> would otherwise sit
                    inside the publication <form>, which is invalid HTML, and a
                    fixed-position dialog buried in the layout is at the mercy of any
                    ancestor that creates a containing block. */}
              {showJournalRequestModal &&
                createPortal(
                  <>
                    <div className="modal-backdrop fade show"></div>
                    <div
                      className="modal fade show"
                      style={{ display: 'block' }}
                      tabIndex={-1}
                      onClick={(e) => {
                        // Click on the scroll area outside the dialog dismisses it;
                        // the currentTarget check keeps clicks inside the dialog alive.
                        if (e.target === e.currentTarget) setShowJournalRequestModal(false);
                      }}
                    >
                      <div className="modal-dialog">
                        <div className="modal-content">
                          <div className="modal-header">
                            <h5 className="modal-title">Request Custom Journal</h5>
                            <button
                              type="button"
                              className="btn-close"
                              onClick={() => setShowJournalRequestModal(false)}
                            ></button>
                          </div>
                          <div className="modal-body">
                            {journalRequestError && (
                              <div className="alert alert-danger">{journalRequestError}</div>
                            )}
                            <form onSubmit={handleJournalRequestSubmit} noValidate>
                              <div className="mb-3">
                                <label className="form-label">Journal Name *</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={journalRequest.journal_name}
                                  onChange={(e) =>
                                    handleJournalRequestChange('journal_name', e.target.value)
                                  }
                                  required
                                />
                              </div>
                              <div className="mb-3">
                                <label className="form-label">Level *</label>
                                <div className="position-relative">
                                  <select
                                    className="form-control"
                                    value={journalRequest.category}
                                    onChange={(e) =>
                                      handleJournalRequestChange('category', e.target.value)
                                    }
                                    required
                                  >
                                    <option value="">Select Level</option>
                                    <option value="National">National</option>
                                    <option value="International">International</option>
                                  </select>
                                  <ChevronDown
                                    size={12}
                                    style={{
                                      position: 'absolute',
                                      right: '10px',
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      pointerEvents: 'none',
                                      color: '#6c757d',
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="mb-3">
                                <label className="form-label">Publisher *</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={journalRequest.publisher}
                                  onChange={(e) =>
                                    handleJournalRequestChange('publisher', e.target.value)
                                  }
                                  required
                                />
                              </div>
                              <div className="mb-3">
                                <label className="form-label">Website *</label>
                                <input
                                  type="url"
                                  className="form-control"
                                  value={journalRequest.website}
                                  onChange={(e) =>
                                    handleJournalRequestChange('website', e.target.value)
                                  }
                                  required
                                />
                              </div>
                              <div className="row mb-3">
                                <div className="col-6">
                                  <label className="form-label">Print ISSN *</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={journalRequest.print_issn}
                                    onChange={(e) =>
                                      handleJournalRequestChange('print_issn', e.target.value)
                                    }
                                    required
                                  />
                                </div>
                                <div className="col-6">
                                  <label className="form-label">Online ISSN *</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={journalRequest.online_issn}
                                    onChange={(e) =>
                                      handleJournalRequestChange('online_issn', e.target.value)
                                    }
                                    required
                                  />
                                </div>
                              </div>
                              <div className="row mb-3">
                                <div className="col-6">
                                  <label className="form-label">Impact Factor *</label>
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="form-control"
                                    value={journalRequest.impact_factor}
                                    onChange={(e) =>
                                      handleJournalRequestChange('impact_factor', e.target.value)
                                    }
                                    placeholder="e.g., 5.123"
                                    required
                                  />
                                </div>
                                <div className="col-6">
                                  <label className="form-label">Cite Score *</label>
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="form-control"
                                    value={journalRequest.cite_score}
                                    onChange={(e) =>
                                      handleJournalRequestChange('cite_score', e.target.value)
                                    }
                                    placeholder="e.g., 8.5"
                                    required
                                  />
                                </div>
                              </div>
                              <div className="d-flex justify-content-end journal-request-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary me-2"
                                  onClick={() => setShowJournalRequestModal(false)}
                                  disabled={journalRequestLoading}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="btn btn-primary"
                                  disabled={journalRequestLoading}
                                >
                                  {journalRequestLoading ? 'Submitting...' : 'Submit Request'}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>,
                  document.body,
                )}
              <AddPublisherModal
                show={showAddPublisherModal}
                onHide={() => setShowAddPublisherModal(false)}
                onAdded={(publisher, message) => {
                  setPublicationDetails((prev) => ({
                    ...prev,
                    publisher: publisher.name,
                    publisher_id: publisher.id,
                  }));
                  setShowAddPublisherModal(false);
                  if (message) showAlert(message, 'success');
                }}
              />
            </div>

            {/* Conditional Bottom Cards (Published only) */}
            {status === 'published' && (
              <>
                {/* Abstract / Keywords / Reference Nos Card. Not asked of a whole book;
                      a book chapter has its own abstract, keywords and citations. */}
                {!effectiveIsBook && (
                  <div className="form-card-dashed container-gap" style={{ padding: '24px' }}>
                    {/* Abstract and Keywords */}
                    <div className="mb-3">
                      <label className="form-label">Abstract</label>
                      <textarea
                        id="abstract"
                        name="abstract"
                        className="form-control"
                        rows={4}
                        placeholder="Enter abstract"
                        value={abstract}
                        onChange={(e) => setAbstract(e.target.value)}
                        disabled={!editMode && isViewMode}
                        style={{ resize: 'vertical', minHeight: '120px' }}
                      />
                      <small className="text-muted">Character count: {abstract.length}</small>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Keywords</label>
                      <input
                        type="text"
                        id="keywords"
                        name="keywords"
                        className="form-control"
                        placeholder="Enter keywords separated by semicolons "
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        disabled={!editMode && isViewMode}
                      />
                    </div>

                    {/* Reference Number Field */}
                    <div className="mb-3">
                      <label className="form-label">
                        Reference Nos. (Citations of KSRCT Publications)
                      </label>
                      <div className="d-flex align-items-center gap-3">
                        <input
                          type="text"
                          id="referenceNumberInput"
                          className="form-control"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          placeholder="Enter S.No. of KSRCT Publications in References separated by comma"
                          disabled={!editMode && isViewMode}
                        />
                        <span className="reference-citation-count">
                          Citation Count:{' '}
                          {referenceNumber.split(',').filter((num) => num.trim() !== '').length}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Publication Details Card */}
                <div className="form-card mb-4" style={{ padding: '24px' }}>
                  <h6 className="form-section-title section-title-divider mb-4">
                    Publication Details
                  </h6>
                  <div className="row g-4">
                    {/* Left Column. Both columns run full height with their last box
                          pushed to the bottom, so Credits to and Published Article line up. */}
                    <div className="col-lg-7 d-flex flex-column">
                      <div className="pub-field-horizontal">
                        <label className="form-label">Volume</label>
                        <input
                          type="text"
                          id="volumeInput"
                          className="form-control"
                          style={{ maxWidth: '120px' }}
                          placeholder="Number"
                          disabled={!editMode && isViewMode}
                        />

                        {/* The tint frames the whole field, label included, like Year
                              and Credits to below. */}
                        <div
                          className="bg-light-blue ms-4 py-1 px-3 d-flex align-items-center gap-3"
                          style={{ borderRadius: '8px' }}
                        >
                          <label className="form-label mb-0 text-primary">Open Access</label>
                          <div className="d-flex gap-3">
                            <div className="form-check mb-0">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="openAccess"
                                id="oaYes"
                                value="Yes"
                                checked={openAccess === 'Yes'}
                                onChange={(e) => setOpenAccess(e.target.value as 'Yes' | 'No')}
                                disabled={!editMode && isViewMode}
                              />
                              <label className="form-check-label" htmlFor="oaYes">
                                Yes
                              </label>
                            </div>
                            <div className="form-check mb-0">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="openAccess"
                                id="oaNo"
                                value="No"
                                checked={openAccess === 'No'}
                                onChange={(e) => setOpenAccess(e.target.value as 'Yes' | 'No')}
                                disabled={!editMode && isViewMode}
                              />
                              <label className="form-check-label" htmlFor="oaNo">
                                No
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pub-field-horizontal">
                        <label className="form-label">Issue</label>
                        <label className="toggle-switch mb-0">
                          <input
                            type="checkbox"
                            id="issueToggle"
                            checked={metrics.issue}
                            onChange={() => handleMetricToggle('issue')}
                            disabled={!editMode && isViewMode}
                          />
                          <span className="slider"></span>
                        </label>
                        <input
                          type="text"
                          id="issueInput"
                          className="form-control"
                          style={{ maxWidth: '120px' }}
                          placeholder="Number"
                          disabled={!metrics.issue || (!editMode && isViewMode)}
                        />

                        {!effectiveIsBook && !effectiveIsBookChapter && (
                          <div className="d-flex gap-3 ms-3">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="issueType"
                                id="regularIssue"
                                value="Regular Issue"
                                disabled={!metrics.issue || (!editMode && isViewMode)}
                              />
                              <label className="form-check-label" htmlFor="regularIssue">
                                Regular Issue
                              </label>
                            </div>
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="issueType"
                                id="specialIssue"
                                value="Special Issue"
                                disabled={!metrics.issue || (!editMode && isViewMode)}
                              />
                              <label className="form-check-label" htmlFor="specialIssue">
                                Special Issue
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pub-field-horizontal align-items-center">
                        <label className="form-label">Page No.</label>
                        <label className="toggle-switch mb-0">
                          <input
                            type="checkbox"
                            id="pageOrArticleToggle"
                            checked={pageOrArticleChoice === 'pages'}
                            onChange={(e) =>
                              handlePageOrArticleChoice(e.target.checked ? 'pages' : 'article')
                            }
                            disabled={!editMode && isViewMode}
                          />
                          <span className="slider"></span>
                        </label>
                        {pageOrArticleChoice === 'pages' ? (
                          <div className="d-flex gap-2">
                            <input
                              type="number"
                              id="pagesFromInput"
                              className="form-control"
                              style={{ maxWidth: '100px' }}
                              placeholder="From"
                              disabled={!editMode && isViewMode}
                            />
                            <input
                              type="number"
                              id="pagesToInput"
                              className="form-control"
                              style={{ maxWidth: '100px' }}
                              placeholder="To"
                              disabled={!editMode && isViewMode}
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            id="articleNumberInput"
                            className="form-control"
                            style={{ maxWidth: '208px' }}
                            placeholder="Enter article number"
                            disabled={!editMode && isViewMode}
                          />
                        )}

                        <div
                          className="bg-light-blue ms-3 py-1 px-3 d-flex align-items-center gap-2"
                          style={{ borderRadius: '8px' }}
                        >
                          <label className="form-label mb-0 text-primary">Year</label>
                          <input
                            type="text"
                            className="form-control"
                            style={{ maxWidth: '100px' }}
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                      </div>

                      <div className="flex-grow-1" aria-hidden="true" />
                      <div
                        className="bg-light-blue mt-4 d-flex align-items-center gap-3 pub-bottom-box"
                        style={{ borderRadius: '8px' }}
                      >
                        <label
                          className="form-label mb-0 text-primary"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          Credits to
                        </label>
                        <select
                          className="form-control"
                          value={selectedCreditTo[0] || ''}
                          onChange={(e) => {
                            const newSelected = [...selectedCreditTo];
                            newSelected[0] = e.target.value;
                            setSelectedCreditTo(newSelected.filter((v) => v));
                          }}
                          disabled={!editMode && isViewMode}
                        >
                          <option value="">Select Author</option>
                          {authors
                            .filter(
                              (author) =>
                                author.name &&
                                author.name.trim() &&
                                author.designation === 'faculty',
                            )
                            .map((author) => (
                              <option
                                key={author.id}
                                value={author.author_id || author.register_no}
                              >
                                {author.name} ({author.author_id || author.register_no})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="col-lg-5 d-flex flex-column">
                      {/* Important Dates Box */}
                      <div className="bg-light-blue mb-4">
                        <div
                          className="text-center text-primary font-weight-bold mb-3"
                          style={{ fontWeight: 600 }}
                        >
                          Important Dates
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <label className="form-label mb-0 text-secondary">
                            Accepted for Publication on
                          </label>
                          <input
                            type="date"
                            id="acceptedDateInput"
                            className="form-control"
                            style={{ maxWidth: '160px' }}
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                        <div className="d-flex align-items-center justify-content-between">
                          <label className="form-label mb-0 text-secondary">
                            Article Published online on
                          </label>
                          <input
                            type="date"
                            id="availableDateInput"
                            className="form-control"
                            style={{ maxWidth: '160px' }}
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                      </div>

                      {/* File Upload Box */}
                      <div className="flex-grow-1" aria-hidden="true" />
                      <div className="pub-upload-box-modern pub-bottom-box">
                        <div className="pub-upload-info-modern">
                          <FileText size={32} className="pub-upload-icon-modern" />
                          <div>
                            <div className="pub-upload-title-modern">Published Article</div>
                            <div className="pub-upload-subtitle-modern">PDF (Maximum 5 MB)</div>
                            {(selectedFile || uploadedFile) && !(isViewMode && !editMode) && (
                              <div className="pub-upload-file-row">
                                <a
                                  href={
                                    selectedFile
                                      ? URL.createObjectURL(selectedFile)
                                      : getFileUrl(uploadedFile!.path)
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="pub-upload-file-name"
                                  title={selectedFile ? selectedFile.name : uploadedFile!.name}
                                >
                                  {selectedFile ? selectedFile.name : uploadedFile!.name}
                                </a>
                                {editMode && (
                                  <button
                                    type="button"
                                    className="pub-upload-file-delete"
                                    onClick={handleFileDelete}
                                    title="Delete file"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {isViewMode && !editMode ? (
                          uploadedFile ? (
                            <a
                              href={getFileUrl(uploadedFile.path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-upload-modern"
                            >
                              <Upload size={16} /> View
                            </a>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '13px' }}>
                              No file
                            </span>
                          )
                        ) : (
                          <label htmlFor="file-upload" className="btn-upload-modern mb-0">
                            <Upload size={16} />
                            {uploadedFile || selectedFile ? 'Change File' : 'Choose File'}
                            <input
                              id="file-upload"
                              type="file"
                              accept="application/pdf,.pdf"
                              onChange={handleFileSelect}
                              disabled={!editMode}
                              style={{ display: 'none' }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reference Numbers Box */}
                <div className="border-dashed-blue mb-4">
                  <div className="row g-4">
                    {/* DOI */}
                    <div className="col-lg-6 d-flex align-items-center">
                      <label
                        className="form-label mb-0 me-3 font-weight-bold"
                        style={{ minWidth: '60px', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        DOI
                      </label>
                      <a href="#" className="pub-id-prefix-link me-2 text-decoration-none">
                        https://www.doi.org/
                      </a>
                      <input
                        type="text"
                        id="doiInput"
                        className="form-control flex-grow-1"
                        placeholder="10.1109/IC..."
                        value={doi}
                        onChange={(e) => setDoi(e.target.value)}
                        disabled={!editMode && isViewMode}
                      />
                      <a
                        href="#"
                        className="pub-id-icon-link ms-1"
                        onClick={(e) => {
                          e.preventDefault();
                          if (doi) {
                            const fullDoiUrl = doi.startsWith('http')
                              ? doi
                              : `https://www.doi.org/${doi}`;
                            window.open(fullDoiUrl, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <ExternalLink size={20} />
                      </a>
                    </div>

                    {/* Scopus EID */}
                    {(hasIndex('Scopus') || scopusId !== '') && (
                      <div className="col-lg-6 d-flex align-items-center">
                        <label
                          className="form-label mb-0 me-3 font-weight-bold"
                          style={{ minWidth: '80px', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          Scopus EID
                        </label>
                        <span
                          className="pub-id-prefix-link me-2 text-decoration-none"
                          style={{ minWidth: '50px' }}
                        >
                          2-s2.0-
                        </span>
                        <input
                          type="text"
                          className="form-control flex-grow-1"
                          value={scopusId}
                          onChange={(e) => setScopusId(e.target.value)}
                          disabled={!editMode && isViewMode}
                        />
                        <a href="#" className="pub-id-icon-link ms-1">
                          <ExternalLink size={20} />
                        </a>
                      </div>
                    )}

                    {/* WoS ID */}
                    {(hasIndex('SCIE') || wosId !== '') && (
                      <div className="col-lg-6 d-flex align-items-center">
                        <label
                          className="form-label mb-0 me-3 font-weight-bold"
                          style={{ minWidth: '60px', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          WoS ID
                        </label>
                        <span
                          className="pub-id-prefix-link me-2 text-decoration-none"
                          // As wide as the DOI prefix above, so the two inputs line up.
                          style={{ minWidth: '140px' }}
                        >
                          WOS:
                        </span>
                        <input
                          type="text"
                          className="form-control flex-grow-1"
                          value={wosId}
                          onChange={(e) => setWosId(e.target.value)}
                          disabled={!editMode && isViewMode}
                        />
                        <a href="#" className="pub-id-icon-link ms-1">
                          <ExternalLink size={20} />
                        </a>
                      </div>
                    )}

                    {/* PubMed PMID */}
                    {(hasIndex('PubMed') || pubmedPmid !== '') && (
                      <div className="col-lg-6 d-flex align-items-center">
                        <label
                          className="form-label mb-0 me-3 font-weight-bold"
                          style={{ minWidth: '80px', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          PubMed
                        </label>
                        {/* The identifier's name sits beside the label, in the prefix
                              style, like Scopus's 2-s2.0- and WoS's WOS:. */}
                        <span
                          className="pub-id-prefix-link me-2 text-decoration-none"
                          style={{ minWidth: '50px' }}
                        >
                          PMID
                        </span>
                        <input
                          type="text"
                          className="form-control flex-grow-1"
                          value={pubmedPmid}
                          onChange={(e) => setPubmedPmid(e.target.value)}
                          disabled={!editMode && isViewMode}
                        />
                        <a href="#" className="pub-id-icon-link ms-1">
                          <ExternalLink size={20} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {/* Submit Button — hidden when embedded, where saving is not on offer */}
            <div className={`text-center mt-4 mb-5${embedded ? ' d-none' : ''}`}>
              <button
                type="submit"
                className="btn-submit-approval"
                disabled={(!editMode && isViewMode) || isFormSubmitting}
              >
                {isFormSubmitting ? 'Submitting...' : 'Submit for approval'}
              </button>
            </div>
          </form>

          {/* The updates panel, opened from the bell. The modal renders into document.body
              — it holds a <form> of its own, which may not sit inside the publication
              form — keeps focus inside itself, and hands it back to the bell on close.
              The publication form stays mounted behind it, so switching to updates no
              longer unmounts, and loses, the values typed into the form. */}
          <CustomModal
            show={showUpdates && !!journalId}
            onHide={() => setShowUpdates(false)}
            title="Status Updates"
            size="xl"
            className="journal-updates-modal"
          >
            <div className="journal-form-body">
              {!journalId ? (
                <div className="form-card">
                  <div className="empty-state">
                    <h5>No Journal Found</h5>
                    <p>Please create a journal entry first to track status updates</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status Update Form */}
                  <div className="form-card">
                    <h6 className="form-section-title mb-3">Add Status Update</h6>
                    <form onSubmit={handleStatusUpdateSubmit} className="status-update-form">
                      <div className="row">
                        <div className="col-md-4">
                          <label className="form-label">Status</label>
                          <select
                            className="form-control"
                            value={newStatusUpdate.status}
                            onChange={(e) =>
                              setNewStatusUpdate((prev) => ({
                                ...prev,
                                status: e.target.value,
                              }))
                            }
                            required
                          >
                            <option value="">Select Status</option>
                            <option value="submitted">Submitted</option>
                            <option value="under_review">Under Review</option>
                            <option value="revision_requested">Revision Requested</option>
                            <option value="revision_submitted">Revision Submitted</option>
                            <option value="accepted">Accepted</option>
                            <option value="rejected">Rejected</option>
                            <option value="published">Published</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Your Comment</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Add your comment (optional)"
                            value={newStatusUpdate.userComment}
                            onChange={(e) =>
                              setNewStatusUpdate((prev) => ({
                                ...prev,
                                userComment: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                          <button
                            type="submit"
                            className="btn btn-primary w-100"
                            disabled={loadingStatusUpdate}
                          >
                            {loadingStatusUpdate ? 'Adding...' : 'Add Update'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Status Updates Table */}
                  <div className="form-card">
                    <h6 className="form-section-title mb-3">Status History</h6>
                    {statusUpdates.length === 0 ? (
                      <div className="empty-state">
                        <p>No status updates yet</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>S.No.</th>
                              <th>Date</th>
                              <th>Status</th>
                              <th>User Comment</th>
                              <th>Admin Reply</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statusUpdates.map((update, index) => (
                              <tr key={update.id}>
                                <td>{index + 1}</td>
                                <td>{new Date(update.created_at).toLocaleDateString()}</td>
                                <td>
                                  <span
                                    className={`badge ${
                                      update.status === 'accepted'
                                        ? 'bg-success'
                                        : update.status === 'rejected'
                                          ? 'bg-danger'
                                          : update.status === 'published'
                                            ? 'bg-primary'
                                            : 'bg-warning'
                                    }`}
                                  >
                                    {update.status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </td>
                                <td>{update.user_comment || '-'}</td>
                                <td>{update.admin_reply || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </CustomModal>
        </div>

        <AlertModal
          show={alertConfig.show}
          onHide={closeAlert}
          message={alertConfig.message}
          type={alertConfig.type}
          title={alertConfig.title}
        />
      </div>
    );
  } catch (error: any) {
    console.error('Error in JournalForm component:', error);
    return (
      <div className="journal-form-body">
        <div className="container journal-form-container">
          <div className="alert alert-danger">
            <h4>Error Loading Form</h4>
            <p>
              There was an error loading the journal form. Please refresh the page and try again.
            </p>
            <p>Error details: {error.message}</p>
          </div>
        </div>
      </div>
    );
  }
};

export default JournalForm;
