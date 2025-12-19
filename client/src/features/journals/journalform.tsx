import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import './journalform.css';
import '../../shared/styles/forms.css';
import '../../shared/components/ui/common.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { Trash2, Plus, GripVertical, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../shared/components/layout/navbar/navbar';

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
  source: string;
  publisher: string;
  print_isbn: string;
  online_isbn: string;
}

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

interface RequiredFields {
  title: boolean;
  type: boolean;
  journal_name: boolean;
  quartile: boolean;
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
  category: string;
}

interface ConferenceRequest {
  conference_name: string;
  publisher: string;
  website: string;
  print_isbn: string;
  online_isbn: string;
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
type ActiveTab = 'form' | 'status';
type EditRequestStatus = 'pending' | 'approved' | 'rejected' | 'none' | null;

const debounce = <T extends (...args: any[]) => any>(func: T, wait: number = 300): T => {
  let timeout: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  }) as T;
};

const JournalForm: React.FC = () => {
  const { journalId: urlJournalId } = useParams<{ journalId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const MAX_AUTHORS = 10;

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
    '17. Partnerships for the Goals'
  ];

  // Available Collaboration options
  const allCollaborations = [
    'International',
    'IITs',
    'NITs',
    'National Research Labs'
  ];

  // Available Acknowledgement options
  const allAcknowledgements = [
    'Nil',
    'DST-FIST',
    'MODROBS'
  ];

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
  const [isInternational, setIsInternational] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(!urlJournalId);
  const [editRequestStatus, setEditRequestStatus] = useState<EditRequestStatus>(null);
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
  const computeDesignation = (author: any): string => {
    const a = author || {};
    if (a.student_id || a.register_no) return 'student';
    if (a.author_id) return 'faculty';
    if (a.designation === 'external') return 'external';
    return (a.designation || 'faculty').toLowerCase();
  };

  // For check box
  const [acknowledgements, setAcknowledgements] = useState<Acknowledgements>({
    Nil: false,
    'DST-FIST': false,
    MODROBS: false,
    Others: false,
  });

  const [annaUniversityListed, setAnnaUniversityListed] = useState<boolean>(false);
  const [othersSelected, setOthersSelected] = useState<boolean>(false);
  const [otherAcknowledgement, setOtherAcknowledgement] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
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
  const [isExistingJournal, setIsExistingJournal] = useState<boolean>(false);
  const [showJournalRequestModal, setShowJournalRequestModal] = useState<boolean>(false);
  const [journalRequest, setJournalRequest] = useState<JournalRequest>({
    journal_name: '',
    publisher: '',
    website: '',
    print_issn: '',
    online_issn: '',
    category: '',
  });
  const [journalRequestLoading, setJournalRequestLoading] = useState<boolean>(false);
  const [journalRequestError, setJournalRequestError] = useState<string>('');

  // Add state for conference request
  const [showConferenceRequestModal, setShowConferenceRequestModal] = useState<boolean>(false);
  const [conferenceRequest, setConferenceRequest] = useState<ConferenceRequest>({
    conference_name: '',
    publisher: '',
    website: '',
    print_isbn: '',
    online_isbn: '',
    category: '',
  });
  const [conferenceRequestLoading, setConferenceRequestLoading] = useState<boolean>(false);
  const [conferenceRequestError, setConferenceRequestError] = useState<string>('');

  // Add state for Abstract and Keywords
  const [abstract, setAbstract] = useState<string>('');
  const [keywords, setKeywords] = useState<string>('');

  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [selectedCreditTo, setSelectedCreditTo] = useState<string[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<string[]>([]);
  const [indexSearchQuery, setIndexSearchQuery] = useState<string>('');
  const [showIndexSuggestions, setShowIndexSuggestions] = useState<boolean>(false);
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
  const [externalAuthorDetails, setExternalAuthorDetails] = useState<ExternalAuthorDetails[]>([]);

  // Function to determine category from type field
  const getCategoryFromType = (type: string): string | null => {
    if (!type) return null;

    const journalTypes = ['Article', 'Journal Article', 'Research Article', 'Erratum', 'Editorial', 'Note', 'Review', 'Retraction'];
    if (journalTypes.includes(type)) return 'Journal';
    if (type === 'Conference paper') return 'Conference';
    if (type === 'Book Chapter') return 'Book Chapter';
    if (type === 'Book') return 'Book';
    return null;
  };

  const [sdgSearchQuery, setSdgSearchQuery] = useState<string>('');
  const [showSdgSuggestions, setShowSdgSuggestions] = useState<boolean>(false);

  // Collaboration multi-select state
  const [selectedCollaborations, setSelectedCollaborations] = useState<string[]>([]);
  const [collaborationSearchQuery, setCollaborationSearchQuery] = useState<string>('');
  const [showCollaborationSuggestions, setShowCollaborationSuggestions] = useState<boolean>(false);

  // Acknowledgement multi-select state
  const [selectedAcknowledgements, setSelectedAcknowledgements] = useState<string[]>([]);
  const [acknowledgementSearchQuery, setAcknowledgementSearchQuery] = useState<string>('');
  const [showAcknowledgementSuggestions, setShowAcknowledgementSuggestions] = useState<boolean>(false);

  // Check if we're in view mode based on URL
  const isViewMode = !!(journalId && window.location.search.includes('mode=view'));

  // Parse category from URL path
  const pathname = window.location.pathname;
  let categoryParam = '';

  if (pathname.includes('/conference')) {
    categoryParam = 'Conference';
  } else if (pathname.includes('/book')) {
    categoryParam = pathname.includes('/book-chapter')
      ? 'Book Chapter'
      : 'Book';
  } else {
    categoryParam = 'Journal';
  }

  const isJournal = categoryParam === 'Journal';
  const isConference = categoryParam === 'Conference';
  const isBook = categoryParam === 'Book';
  const isBookChapter = categoryParam === 'Book Chapter';

  // Determine category: use type-based in view mode, URL-based otherwise
  const getEffectiveCategory = (): string | null => {
    if (isViewMode && currentType) {
      return getCategoryFromType(currentType);
    }
    return categoryParam;
  };

  const effectiveCategory = getEffectiveCategory();
  const effectiveIsJournal = effectiveCategory === 'Journal';
  const effectiveIsConference = effectiveCategory === 'Conference';
  const effectiveIsBook = effectiveCategory === 'Book';
  const effectiveIsBookChapter = effectiveCategory === 'Book Chapter';

  // Auto-select Type on create (no journalId)
  useEffect(() => {
    if (!journalId && categoryParam) {
      const typeSelect = document.getElementById('typeSelect') as HTMLSelectElement;
      if (typeSelect) {
        if (categoryParam === 'Conference') {
          typeSelect.value = 'Conference paper';
        } else if (categoryParam === 'Book Chapter') {
          typeSelect.value = 'Book Chapter';
        } else if (categoryParam === 'Book') {
          typeSelect.value = 'Book';
        }
        // Don't auto-select for Journal as requested
      }
    }
  }, [journalId, categoryParam]);

  // Add new state for the toggle between Form and Status Tracking
  const [activeTab, setActiveTab] = useState<ActiveTab>('form');

  // Add new state for status tracking
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [newStatusUpdate, setNewStatusUpdate] = useState<NewStatusUpdate>({
    status: '',
    userComment: '',
  });
  const [loadingStatusUpdate, setLoadingStatusUpdate] = useState<boolean>(false);

  // Add new state for required fields
  const [requiredFields, setRequiredFields] = useState<RequiredFields>({
    title: true,
    type: true,
    journal_name: true,
    quartile: true,
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

  useEffect(() => {
    if (journalId) {
      // Update URL mode parameter
      const url = new URL(window.location.href);
      url.searchParams.set('mode', editMode ? 'edit' : 'view');
      window.history.replaceState({}, '', url.toString());
    }
  }, [editMode, journalId]);

  useEffect(() => {
    const delayDebounceFn = searchQueries.map((query, index) => {
      const authorJustSelected = authors[index]?.author_id === query;
      if (query.length > 0 && !isViewMode && !authorJustSelected) {
        return setTimeout(() => searchAuthor(query, index), 300);
      } else if (query.length === 0 && !isViewMode) {
        searchAuthor(query, index);
        return null;
      }
      return null;
    });

    return () =>
      delayDebounceFn.forEach((timeout) => timeout && clearTimeout(timeout));
  }, [searchQueries, authors, isViewMode]);

  useEffect(() => {
    if (journalSearchQuery.length > 2) {
      searchJournals();
    } else {
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
      }
    }
  }, [journalSearchQuery]);

  useEffect(() => {
    if (journalId) {
      setIsExistingJournal(true);
      fetchJournalDetails();
      checkEditRequestStatus();
    } else {
      setIsExistingJournal(false);
      setEditRequestStatus(null);
    }
  }, [journalId]);

  useEffect(() => {
    if (journalId) {
      if (editRequestStatus === 'approved') {
        setEditMode(true);
      } else {
        setEditMode(false);
      }
    }
  }, [editRequestStatus, journalId]);

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

  useEffect(() => {
    if (!metrics.dateOfSubmission) {
      setMetrics((prevMetrics) => ({
        ...prevMetrics,
        volume: false,
        issue: false,
        pages: false,
        doi: false,
        acceptedForPublication: false,
        availableOnline: false,
      }));
      setUploadedFileName('');
    }
  }, [metrics.dateOfSubmission]);

  useEffect(() => {
    if (journalId) {
      fetchJournalDetails();
    }
  }, [journalId]);

  useEffect(() => {
    if (journalId) {
      fetchJournalDetails().then((success) => {
        if (!success) {
          console.error('Failed to load journal details');
        }
      });
    }
  }, [journalId]);

  // Fetch status updates when switching to status tab
  useEffect(() => {
    if (activeTab === 'status' && journalId) {
      fetchStatusUpdates();
    }
  }, [activeTab, journalId]);

  const searchJournals = async (journalSearchQuery?: string) => {
    // Input validation
    if (!journalSearchQuery || journalSearchQuery.trim().length === 0) {
      setJournalSearchResults([]);
      setShowJournalSuggestions(false);
      return;
    }

    try {
      // API call with proper URL construction
      const data = await authenticityUtility.get(
        `/journals/search?query=${encodeURIComponent(journalSearchQuery.trim())}`
      ) as any;

      // Response validation
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setJournalSearchResults(data.data);
        setShowJournalSuggestions(data.data.length > 0);
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

      setError(
        error.response?.data?.message ||
        error.message ||
        'Failed to search journals'
      );
    }
  };

  const searchAuthor = async (query: string, index: number) => {
    if (query.length > 0) {
      try {
        const authors = await authenticityUtility.get(
          `/authors/search?query=${encodeURIComponent(query)}&designation=${encodeURIComponent(authorDesignations[index])}&_=${Date.now()}`
        ) as any;

        if (authors && Array.isArray(authors)) {
          setSearchResults((prevResults) => {
            const prevArray = Array.isArray(prevResults)
              ? prevResults
              : Array(MAX_AUTHORS).fill([]);
            const newResults = [...prevArray];
            newResults[index] = authors;
            return newResults;
          });

          setShowSuggestions((prev) => {
            const prevArray = Array.isArray(prev)
              ? prev
              : Array(MAX_AUTHORS).fill(false);
            const newShow = [...prevArray];
            newShow[index] = authors.length > 0;
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

        setError(
          error.response?.data?.message ||
          error.message ||
          'Failed to search for authors. Please try again.'
        );

        // Clear results for this index
        setSearchResults((prevResults) => {
          const prevArray = Array.isArray(prevResults)
            ? prevResults
            : Array(MAX_AUTHORS).fill([]);
          const newResults = [...prevArray];
          newResults[index] = [];
          return newResults;
        });

        setShowSuggestions((prev) => {
          const prevArray = Array.isArray(prev)
            ? prev
            : Array(MAX_AUTHORS).fill(false);
          const newShow = [...prevArray];
          newShow[index] = false;
          return newShow;
        });
      }
    } else {
      // Clear results when query is empty
      setSearchResults((prevResults) => {
        const prevArray = Array.isArray(prevResults)
          ? prevResults
          : Array(MAX_AUTHORS).fill([]);
        const newResults = [...prevArray];
        newResults[index] = [];
        return newResults;
      });
      setShowSuggestions((prev) => {
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill(false);
        const newShow = [...prevArray];
        newShow[index] = false;
        return newShow;
      });
    }
  };

  const checkEditRequestStatus = async () => {
    if (!journalId) return;

    try {
      const response = await authenticityUtility.get(
        `/edit-requests/journals/${journalId}?_=${Date.now()}`
      ) as any;

      if (response.data) {
        const status = response.data.status;

        if (status === 'pending') {
          setEditRequestStatus('pending');
          setEditMode(false);
        } else if (status === 'rejected') {
          setEditRequestStatus('rejected');
          setEditMode(false);
        } else if (status === 'none') {
          setEditRequestStatus(null);
          setEditMode(false);
        } else if (status === 'approved') {
          setEditRequestStatus('approved');
          setEditMode(true);
        }
      } else {
        setEditRequestStatus(null);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Error checking edit status:', error);
      setEditRequestStatus(null);
      setEditMode(false);
    }
  };

  // Add journal request functions
  const handleJournalRequestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!journalRequest.journal_name.trim()) {
      setJournalRequestError('Journal name is required');
      return;
    }

    if (!journalRequest.category) {
      setJournalRequestError('Category is required');
      return;
    }

    try {
      setJournalRequestLoading(true);
      setJournalRequestError('');

      const response = await authenticityUtility.post(
        '/journal-requests',
        journalRequest
      ) as any;

      if (response.status === 'success') {
        alert(
          'Journal request submitted successfully! It will be reviewed by an administrator.'
        );
        setShowJournalRequestModal(false);
        setJournalRequest({
          journal_name: '',
          publisher: '',
          website: '',
          print_issn: '',
          online_issn: '',
          category: '',
        });
      } else {
        setJournalRequestError(
          response.message || 'Failed to submit journal request'
        );
      }
    } catch (error: any) {
      console.error('Error submitting journal request:', error);
      setJournalRequestError(
        error.response?.data?.message || 'Failed to submit journal request'
      );
    } finally {
      setJournalRequestLoading(false);
    }
  };

  const handleJournalRequestChange = (field: keyof JournalRequest, value: string) => {
    setJournalRequest((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Add conference request handlers
  const handleConferenceRequestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!conferenceRequest.conference_name.trim()) {
      setConferenceRequestError('Conference name is required');
      return;
    }

    if (!conferenceRequest.category) {
      setConferenceRequestError('Category is required');
      return;
    }

    try {
      setConferenceRequestLoading(true);
      setConferenceRequestError('');

      const response = await authenticityUtility.post(
        '/conference-requests',
        conferenceRequest
      ) as any;

      if (response.status === 'success') {
        alert(
          'Conference request submitted successfully! It will be reviewed by an administrator.'
        );
        setShowConferenceRequestModal(false);
        setConferenceRequest({
          conference_name: '',
          publisher: '',
          website: '',
          print_isbn: '',
          online_isbn: '',
          category: '',
        });
      } else {
        setConferenceRequestError(
          response.message || 'Failed to submit conference request'
        );
      }
    } catch (error: any) {
      console.error('Error submitting conference request:', error);
      setConferenceRequestError(
        error.response?.data?.message || 'Failed to submit conference request'
      );
    } finally {
      setConferenceRequestLoading(false);
    }
  };

  const handleConferenceRequestChange = (field: keyof ConferenceRequest, value: string) => {
    setConferenceRequest((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditRequest = async () => {
    if (!journalId) return;

    try {
      const response = await authenticityUtility.post(
        `/edit-requests/journals/${journalId}`
      ) as any;

      if (response && response.success === true) {
        setEditRequestStatus('pending');
        alert(response.message || 'Edit request sent to admin for approval');
      } else {
        console.error('Edit request was not successful:', response.message);
        alert(response.message || 'Failed to send edit request');
      }
    } catch (error: any) {
      console.error('Error sending edit request:', error);
      alert(error.response?.data?.message || 'Failed to send edit request');
    }
  };

  const fetchJournalDetails = async (): Promise<boolean> => {
    try {
      const response = await authenticityUtility.get(`/journals/${journalId}`);

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
          `input[name="quartile"][value="${journalData.quartile}"]`
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

        // Handle Anna University listing
        const annaUnivRadio = document.querySelector(
          `input[name="listedInAnnaUniversity"][value="${journalData.anna_university_listed ? 'yes' : 'no'}"]`
        ) as HTMLInputElement;
        if (annaUnivRadio) annaUnivRadio.checked = true;

        if (journalData.anna_university_listed) {
          const annexureInput = document.querySelector(
            'input[name="annexureNo"]'
          ) as HTMLInputElement;
          if (annexureInput)
            annexureInput.value = journalData.anna_university_annexure_no || '';
        }
        // Set date of submission and status
        if (journalData.date_of_submission) {
          const dateInput = document.getElementById('dateOfSubmissionInput') as HTMLInputElement;
          const ds = String(journalData.date_of_submission);
          if (dateInput)
            dateInput.value = ds.includes('T') ? ds.split('T')[0] : ds;

          const statusDropdown = document.getElementById('statusDropdown') as HTMLSelectElement;
          if (statusDropdown)
            statusDropdown.value = journalData.status || 'waiting';
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

        // Set issue type
        const issueTypeRadio = document.querySelector(
          `input[name="issueType"][value="${journalData.issue_type}"]`
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
          setSelectedCreditTo(Array.isArray(journalData.credit_to) ? journalData.credit_to : [journalData.credit_to]);
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
            'referenceNumberInput'
          ) as HTMLInputElement;
          if (referenceNumberInput)
            referenceNumberInput.value = journalData.reference_number;
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
          setSelectedIndexes(journalData.indexes);
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
            print_isbn: pubDetails.print_isbn || '',
            online_isbn: pubDetails.online_isbn || '',
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
      setStatus(journalData.status || 'waiting');
      setDrivenBy(journalData.driven_by || 'faculty');
      setAnnaUniversityListed(journalData.anna_university_listed === 1 || journalData.anna_university_listed === true);

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
          const parsedAck = typeof journalData.acknowledgement === 'string'
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
            } catch (e) {
              // If JSON parsing fails, treat as regular string array
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
          allCollaborations.includes(item)
        );
        setSelectedCollaborations(collaborations);

        // Check for "others" value (not in predefined list)
        const othersCollab = journalData.author_affiliation.find((item: string) =>
          !allCollaborations.includes(item) && item !== 'others'
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
        const ackArray = Object.keys(journalData.acknowledgement).filter((key: string) =>
          journalData.acknowledgement[key] === true && allAcknowledgements.includes(key)
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
      if (Array.isArray(journalData.authors)) {
        fetchedAuthors = journalData.authors.map((author: any, index: number) => {
          const normalizedDesignation = computeDesignation(author);
          const computedAuthorId =
            normalizedDesignation === 'student'
              ? author.student_id || ''
              : author.author_id || '';

          return {
            id: index + 1,
            dbAuthorId: author.dbAuthorId,
            author_id: computedAuthorId,
            email: author.email,
            designation: normalizedDesignation as 'faculty' | 'student' | 'external',
            name: author.name,
            department: author.department,
            organization: normalizedDesignation === 'student' && !author.organization
              ? 'K.S.Rangasamy College of Technology'
              : author.organization,
            country: author.country,
            state: author.state || '',
            is_first_author:
              author.is_first_author === 1 || author.is_first_author === true,
            is_primary: author.is_primary === 1 || author.is_primary === true,
            register_no:
              normalizedDesignation === 'student'
                ? author.student_id || ''
                : '',
          };
        });
        setAuthors(fetchedAuthors);

        // Trim parallel arrays to match authors length
        setSearchResults((prev) => {
          const prevArray = Array.isArray(prev)
            ? prev
            : Array(MAX_AUTHORS).fill([]);
          return prevArray.slice(0, fetchedAuthors.length);
        });
        setShowSuggestions((prev) => {
          const prevArray = Array.isArray(prev)
            ? prev
            : Array(MAX_AUTHORS).fill(false);
          return prevArray.slice(0, fetchedAuthors.length);
        });

        // Update search queries for authors
        setSearchQueries((prevQueries) => {
          const prevArray = Array.isArray(prevQueries)
            ? prevQueries
            : Array(MAX_AUTHORS).fill('');
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
            is_first_author:
              extAuthor.is_first_author === 1 || extAuthor.is_first_author === true,
            is_primary:
              extAuthor.is_primary === 1 || extAuthor.is_primary === true,
            register_no: '',
          })
        );
        combinedAuthors = [...fetchedAuthors, ...externalAuthorsFromJson];
        setAuthors(combinedAuthors);

        // Ensure authorDesignations and search-related arrays cover external authors too
        setAuthorDesignations((prev) => {
          const base = Array.isArray(prev)
            ? prev
            : Array(MAX_AUTHORS).fill('faculty');
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
          const base = Array.isArray(prev)
            ? prev
            : Array(MAX_AUTHORS).fill('');
          const next = [...base];
          // For external authors, the search field is not used – keep empty for those rows
          return next.slice(0, combinedAuthors.length);
        });

        setSearchResults((prev) => {
          const base = Array.isArray(prev)
            ? prev
            : Array(MAX_AUTHORS).fill([]);
          const next = [...base];
          return next.slice(0, combinedAuthors.length);
        });

        setShowSuggestions((prev) => {
          const base = Array.isArray(prev)
            ? prev
            : Array(MAX_AUTHORS).fill(false);
          const next = [...base];
          return next.slice(0, combinedAuthors.length);
        });
      }

      // Track external authors separately for easier JSON construction on submit
      setExternalAuthorDetails(
        Array.isArray(journalData.external_details)
          ? journalData.external_details
          : []
      );

      // Check if the current user is the primary or first author
      const currentUserEmail = user?.email;
      if (currentUserEmail && fetchedAuthors.length > 0) {
        const isEligible = fetchedAuthors.some(
          (author) =>
            (author.is_primary || author.is_first_author) &&
            author.email === currentUserEmail
        );
        setCanRequestEdit(isEligible);
      } else {
        setCanRequestEdit(false);
      }

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
      setError(
        'Failed to fetch journal details: ' + (error.message || 'Unknown error')
      );
      return false;
    }
  };

  const debouncedSearch = debounce((query: string) => {
    searchJournals(query);
  }, 300);

  const handleJournalSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setJournalSearchQuery(query);

    if (query.trim().length >= 2) {
      debouncedSearch(query);
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
    setJournalSearchQuery(journal.name);
    setShowJournalSuggestions(false);

    // Set category based on journal selection
    if (journal.category) {
      setIsInternational(journal.category === 'International');
      // Also update the journal request category if modal is open
      setJournalRequest((prev) => ({
        ...prev,
        category: journal.category,
      }));
    }
  };

  const handleDesignationChange = (index: number, designation: string) => {
    setAuthorDesignations((prev) => {
      // Ensure prev is an array
      const prevArray = Array.isArray(prev)
        ? prev
        : Array(MAX_AUTHORS).fill('faculty');
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
        organization: designation === 'student' ? 'K.S.Rangasamy College of Technology' : '',
        country: '',
        state: '',
        designation: designation as 'faculty' | 'student' | 'external', // Set the new designation
      };
      return newAuthors;
    });

    // Also clear the search query for that row
    setSearchQueries((prev) => {
      // Ensure prev is an array
      const prevArray = Array.isArray(prev)
        ? prev
        : Array(MAX_AUTHORS).fill('');
      const newQueries = [...prevArray];
      newQueries[index] = '';
      return newQueries;
    });

    // Clear search results and suggestions for synchronization
    setSearchResults((prev) => {
      const prevArray = Array.isArray(prev)
        ? prev
        : Array(MAX_AUTHORS).fill([]);
      const newResults = [...prevArray];
      newResults[index] = [];
      return newResults;
    });
    setShowSuggestions((prev) => {
      const prevArray = Array.isArray(prev)
        ? prev
        : Array(MAX_AUTHORS).fill(false);
      const newShow = [...prevArray];
      newShow[index] = false;
      return newShow;
    });
  };

  const handleManualAuthorChange = (index: number, field: keyof Author, value: string | boolean) => {
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
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill('faculty');
        const newD = [...prevArray];
        newD[authors.length] = 'faculty'; // Default new author to faculty
        return newD;
      });

      // Sync parallel arrays
      setSearchQueries((prev) => {
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill('');
        return [...prevArray, ''];
      });
      setSearchResults((prev) => {
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill([]);
        return [...prevArray, []];
      });
      setShowSuggestions((prev) => {
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill(false);
        return [...prevArray, false];
      });
    }
  };

  const deleteAuthor = (id: number) => {
    if (id === 1) return;

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
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill('');
        const arr = [...prevArray];
        arr.splice(deleteIndex, 1);
        return arr;
      });

      // Sync searchResults
      setSearchResults((prev) => {
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill([]);
        const arr = [...prevArray];
        arr.splice(deleteIndex, 1);
        return arr;
      });

      // Sync showSuggestions
      setShowSuggestions((prev) => {
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill(false);
        const arr = [...prevArray];
        arr.splice(deleteIndex, 1);
        return arr;
      });

      // Sync authorDesignations
      setAuthorDesignations((prev) => {
        // Ensure prev is an array
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill('faculty');
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
      const prevArray = Array.isArray(prev)
        ? prev
        : Array(MAX_AUTHORS).fill('');
      const newQueries = [...prevArray];
      const [draggedQuery] = newQueries.splice(dragIndex, 1);
      newQueries.splice(dropIndex, 0, draggedQuery);
      return newQueries;
    });

    // Sync searchResults
    setSearchResults((prev) => {
      const prevArray = Array.isArray(prev)
        ? prev
        : Array(MAX_AUTHORS).fill([]);
      const newResults = [...prevArray];
      const [draggedResult] = newResults.splice(dragIndex, 1);
      newResults.splice(dropIndex, 0, draggedResult);
      return newResults;
    });

    // Sync showSuggestions
    setShowSuggestions((prev) => {
      const prevArray = Array.isArray(prev)
        ? prev
        : Array(MAX_AUTHORS).fill(false);
      const newShow = [...prevArray];
      const [draggedShow] = newShow.splice(dragIndex, 1);
      newShow.splice(dropIndex, 0, draggedShow);
      return newShow;
    });

    // Sync authorDesignations
    setAuthorDesignations((prev) => {
      // Ensure prev is an array
      const prevArray = Array.isArray(prev)
        ? prev
        : Array(MAX_AUTHORS).fill('faculty');
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
        const prevArray = Array.isArray(prevQueries)
          ? prevQueries
          : initializeArrayState('');
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

    const debouncedSearch = debounce(() => searchAuthor(newValue, index), 300);
    debouncedSearch();
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
        register_no:
          normalizedDesignation === 'student'
            ? selectedAuthor.student_id || ''
            : '',
      };
      return updatedAuthors;
    });

    // REFACTOR: Set search query to the faculty_id for display purposes.
    setSearchQueries((prevQueries) => {
      const prevArray = Array.isArray(prevQueries)
        ? prevQueries
        : Array(MAX_AUTHORS).fill('');
      const newQueries = [...prevArray];
      const normalizedDesignation = computeDesignation(selectedAuthor);
      newQueries[index] =
        normalizedDesignation === 'student'
          ? selectedAuthor.student_id || ''
          : selectedAuthor.author_id || '';
      return newQueries;
    });

    // Hide suggestions
    setShowSuggestions((prev) => {
      const prevArray = Array.isArray(prev)
        ? prev
        : Array(MAX_AUTHORS).fill(false);
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
              placeholder="Register No."
              name="register_no"
              value={author.register_no || ''}
              onChange={(e) =>
                handleManualAuthorChange(index, e.target.name as keyof Author, e.target.value)
              }
              disabled={!editMode && isViewMode}
            />
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
              placeholder="Department"
              name="department"
              value={author.department || ''}
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
              value={
                author.organization || 'K.S.Rangasamy College of Technology'
              }
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
              placeholder="Department"
              name="department"
              value={author.department || ''}
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
              placeholder="Search or enter Author ID"
              value={
                isViewMode
                  ? (
                    authorDesignations[index] ||
                    author.designation ||
                    'faculty'
                  ).toLowerCase() === 'student'
                    ? author.register_no || ''
                    : author.author_id || ''
                  : searchQueries[index] || ''
              }
              onChange={(e) => handleSearchInputChange(e, index)}
              onBlur={() => handleAuthorSearchBlur(index)}
              disabled={!editMode && isViewMode}
              autoComplete="off"
            />
            {showSuggestions[index] &&
              (searchResults[index] || []).length > 0 && (
                <ul className="author-suggestions-list">
                  {(searchResults[index] || []).map((result) => (
                    <li
                      key={result?.id || ''}
                      className="list-group-item list-group-item-action"
                      onMouseDown={() => handleAuthorSelect(result, index)}
                      style={{ cursor: 'pointer' }}
                    >
                      {result
                        ? result.student_id
                          ? result.student_id
                          : result.author_id || ''
                        : ''}{' '}
                      - {result?.name || ''} - {result?.organization || ''}
                    </li>
                  ))}
                </ul>
              )}
          </div>
          {/* These readOnly fields will display the data after a faculty member is selected */}
          <input
            type="text"
            className="form-control"
            placeholder="Name"
            value={author.name || ''}
            readOnly
          />
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
    setTimeout(() => {
      setShowSuggestions((prev) => {
        const prevArray = Array.isArray(prev)
          ? prev
          : Array(MAX_AUTHORS).fill(false);
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
      }))
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
    setRequiredFields((prev) => ({
      ...prev,
      [metric]: value !== null ? value : !prev[metric],
    }));

    if (metric === 'doi' && !value) {
      setDoi('');
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
      setRequiredFields((prev) => {
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
      setRequiredFields((prev) => ({
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
      setRequiredFields((prev) => ({
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
      setRequiredFields((prev) => ({
        ...prev,
        pages: false,
        articleNumber: false,
      }));
    }
  };

  const handleAcknowledgementChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setAcknowledgements((prev) => ({
      ...prev,
      [name]: checked,
    }));
    if (name !== 'Others' && checked) {
      setAcknowledgements((prev) => ({ ...prev, Nil: false }));
    }
    if (name === 'Nil' && checked) {
      setAcknowledgements({
        Nil: true,
        'DST-FIST': false,
        MODROBS: false,
        Others: false,
      });
      setOtherAcknowledgement('');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event?.target?.files;
    const file = files && files.length > 0 ? files[0] : null;
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
      const response = await authenticityUtility.get(
        `/journals/${journalId}/status-updates`
      );
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
      alert('Please select a status');
      return;
    }

    try {
      setLoadingStatusUpdate(true);
      const response = await authenticityUtility.post(
        `/journals/${journalId}/status-updates`,
        {
          status: newStatusUpdate.status,
          user_comment: newStatusUpdate.userComment,
        }
      ) as any;

      if (response.status === 'success') {
        setNewStatusUpdate({ status: '', userComment: '' });
        await fetchStatusUpdates(); // Refresh the list
        alert('Status update submitted successfully');
      }
    } catch (error: any) {
      console.error('Error submitting status update:', error);
      alert(
        'Error submitting status update: ' +
        (error.response?.data?.message || error.message)
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
      const baseMissing =
        !author.name ||
        !author.designation ||
        !author.department ||
        !author.organization;
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
    // Abstract validation (optional for all types)
    if (abstract && abstract.length < 150) {
      return 'Abstract must be at least 150 characters long';
    }

    // Keywords validation (optional for all types)
    if (keywords) {
      const keywordList = keywords
        .split(',')
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
        const articleNumber =
          (document.getElementById('articleNumberInput') as HTMLInputElement)?.value;
        if (!articleNumber) {
          return 'Please enter the article number';
        }
      }
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Collect all validation errors
    const errors: string[] = [];

    // Helper to safely get form values
    const getFormValue = (name: string, defaultValue: string | null = null): string | null => {
      const element = (event.currentTarget as HTMLFormElement).elements.namedItem(name) as HTMLInputElement;
      if (!element) return defaultValue;
      if (element.type === 'radio') {
        const checkedRadio = document.querySelector(
          `input[name="${name}"]:checked`
        ) as HTMLInputElement;
        return checkedRadio ? checkedRadio.value : defaultValue;
      }
      return element.value || defaultValue;
    };

    const getMetricValue = (metric: boolean, inputName: string): number | null => {
      if (!metric) return null;
      const value = getFormValue(inputName);
      if (!value || value === '') return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
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
      errors.push('Conference Title is required');
    }

    // For Book Chapter and Book, require Source
    if ((isBook || isBookChapter) && !publicationDetails.source?.trim()) {
      errors.push('Source is required');
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
      if (!getFormValue('dateOfSubmissionInput'))
        errors.push('Date of Submission is required');
      if (metrics.volume && !getFormValue('volumeInput'))
        errors.push('Volume is required');
      if (metrics.issue && !getFormValue('issueInput'))
        errors.push('Issue is required');
      if (
        metrics.pages &&
        (!getFormValue('pagesFromInput') || !getFormValue('pagesToInput'))
      ) {
        errors.push('Both From and To pages are required');
      }
      if (metrics.articleNumber && !getFormValue('articleNumberInput')) {
        errors.push('Article Number is required');
      }
      if (metrics.doi && !getFormValue('doiInput'))
        errors.push('DOI is required');
      if (
        metrics.acceptedForPublication &&
        !getFormValue('acceptedDateInput')
      ) {
        errors.push('Accepted Date is required');
      }
      if (metrics.availableOnline && !getFormValue('availableDateInput')) {
        errors.push('Available Online Date is required');
      }
    }

    // If there are any validation errors, display them and stop submission
    if (errors.length > 0) {
      alert('Please fix the following errors:\n\n' + errors.join('\n'));
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
    selectedAcknowledgements.forEach(ack => {
      acknowledgementData[ack] = true;
    });
    if (acknowledgements.Others) {
      acknowledgementData.Others = true;
      acknowledgementData.otherValue = otherAcknowledgement.trim();
    }

    // Build publication_details JSON for Conference, Book Chapter, and Book
    let publicationDetailsData: PublicationDetails | null = null;
    if (isConference) {
      publicationDetailsData = {
        conference_title: publicationDetails.conference_title?.trim() || '',
        publisher: publicationDetails.publisher?.trim() || '',
        source: publicationDetails.source?.trim() || '',
        print_isbn: publicationDetails.print_isbn?.trim() || '',
        online_isbn: publicationDetails.online_isbn?.trim() || '',
      };
    } else if (isBookChapter) {
      publicationDetailsData = {
        conference_title: '',
        source: publicationDetails.source?.trim() || '',
        publisher: publicationDetails.publisher?.trim() || '',
        print_isbn: publicationDetails.print_isbn?.trim() || '',
        online_isbn: publicationDetails.online_isbn?.trim() || '',
      };
    } else if (isBook) {
      publicationDetailsData = {
        conference_title: '',
        source: publicationDetails.source?.trim() || '',
        publisher: publicationDetails.publisher?.trim() || '',
        print_isbn: publicationDetails.print_isbn?.trim() || '',
        online_isbn: publicationDetails.online_isbn?.trim() || '',
      };
    }

    // Prepare the journal data object with category-specific fields
    const journalData: any = {
      category: isInternational ? 'International' : 'National',
      title: getFormValue('title'),
      book_chapter_title: isBookChapter ? bookChapterTitle : null,
      type: getFormValue('type'),
      journal_name: isJournal ? journalDetails.name : (isConference ? publicationDetails.conference_title : ''),
      author_affiliation: getCollaborations(),
      driven_by: drivenBy,
      acknowledgement: acknowledgementData,
      sdgs: selectedSDGs,
      abstract: abstract,
      keywords: keywords,
      date_of_submission: getFormValue('dateOfSubmissionInput'),
      status: status || 'waiting',
      volume: getFormValue('volumeInput'),
      issue: getFormValue('issueInput'),
      issue_type: getFormValue('issueType'),
      pages_from: parseInt(getFormValue('pagesFromInput', '0') || '0') || null,
      pages_to:
        pageOrArticleChoice === 'pages'
          ? parseInt(getFormValue('pagesToInput', '0') || '0') || null
          : null,
      article_number:
        pageOrArticleChoice === 'article'
          ? getFormValue('articleNumberInput')
          : null,
      doi: getFormValue('doiInput'),
      credit_to: selectedCreditTo,
      reference_number: referenceNumber,
      accepted_date: getFormValue('acceptedDateInput'),
      available_online_date: getFormValue('availableDateInput'),
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

    // Add Journal-specific fields only for Journal types
    if (isJournalType) {
      const quartileValue = getFormValue('quartile');
      const annexureValue = getFormValue('annexureNo');
      const impactFactorValue = getFormValue('impactFactorInput');
      const citeScoreValue = getFormValue('citeScoreInput');

      journalData.quartile = quartileValue || null;

      // Parse Impact Factor and Cite Score - always collect if present
      journalData.impact_factor = impactFactorValue && impactFactorValue !== ''
        ? parseFloat(impactFactorValue)
        : null;
      journalData.cite_score = citeScoreValue && citeScoreValue !== ''
        ? parseFloat(citeScoreValue)
        : null;

      journalData.anna_university_listed = annaUniversityListed;
      journalData.anna_university_annexure_no = annaUniversityListed && annexureValue
        ? annexureValue.trim()
        : null;

      // Debug logging - can be removed after verification
      console.log('Journal-specific fields being sent:', {
        quartile: journalData.quartile,
        impact_factor: journalData.impact_factor,
        cite_score: journalData.cite_score,
        anna_university_listed: journalData.anna_university_listed,
        anna_university_annexure_no: journalData.anna_university_annexure_no
      });
    }

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
            authorData
          );
        } else {
          await authenticityUtility.post(
            `/journals/${currentJournalId}/authors`,
            authorData
          );
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // STEP 3: Process indexes (common to both flows)
      // ══════════════════════════════════════════════════════════════════════
      for (const indexName of selectedIndexes) {
        await authenticityUtility.post(
          `/journals/${currentJournalId}/indexes`,
          { indexName }
        );
      }

      // ══════════════════════════════════════════════════════════════════════
      // STEP 4: Upload file if selected (common to both flows)
      // ══════════════════════════════════════════════════════════════════════
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        try {
          const uploadResponse = await authenticityUtility.postFile(
            `/journals/${currentJournalId}/upload`,
            formData
          ) as any;
          const filePath = uploadResponse?.data?.filePath || uploadResponse?.filePath;
          if (filePath) {
            setUploadedFile({ path: filePath, name: selectedFile.name });
            setUploadedFileName(selectedFile.name);
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
          await authenticityUtility.patch(
            `/edit-requests/journals/${currentJournalId}`,
            { status: 'none', userId: user?.id }
          );
        } catch (editRequestError: any) {
          // Non-critical: Log but don't fail the submission
          console.warn('Non-critical: Could not clear edit request status:', editRequestError.message);
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // STEP 6: Success handling
      // ══════════════════════════════════════════════════════════════════════
      const successMessage = isEditFlow
        ? 'Journal updated successfully!'
        : 'Journal created successfully!';
      alert(successMessage);

      setEditMode(false);
      setEditRequestStatus(null);

      // Update URL to view mode
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'view');
      window.history.replaceState({}, '', url.toString());

    } catch (error: any) {
      console.error('Error submitting journal:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Error submitting journal: ${errorMessage}`);
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
        <Navbar />
        <div className="container journal-form-container">
          {/* View Mode & Edit Request Alerts */}
          {isViewMode && (
            <div className="alert alert-info d-flex justify-content-between align-items-center">
              <span>View Mode - Read Only Access</span>
              <button
                className="btn btn-warning"
                onClick={handleEditRequest} // This should be your handleEditRequest or setEditMode(true) logic
                disabled={
                  !editMode && isViewMode && editRequestStatus === 'pending'
                }
              >
                {editRequestStatus === 'pending'
                  ? 'Request Pending'
                  : 'Request Edit'}
              </button>
            </div>
          )}
          {editRequestStatus === 'rejected' && showRejectedAlert && (
            <div
              className="alert alert-danger alert-dismissible fade show"
              role="alert"
            >
              Your previous edit request was rejected.
              <button
                type="button"
                className="btn-close"
                onClick={handleCloseRejectedAlert}
              ></button>
            </div>
          )}
          {/* New Toggle for Form/Status Tracking */}
          <div className="category-toggle-container">
            <button
              type="button"
              className={activeTab === 'form' ? 'active' : ''}
              onClick={() => setActiveTab('form')}
            >
              Form
            </button>
            <button
              type="button"
              className={activeTab === 'status' ? 'active' : ''}
              onClick={() => setActiveTab('status')}
              disabled={!journalId} // Disable if no journal exists yet
            >
              Updates
            </button>
          </div>

          {/* Conditional Content Based on Active Tab */}
          {activeTab === 'form' ? (
            <form onSubmit={handleSubmit}>
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
                        onChange={(e) =>
                          handleDesignationChange(index, e.target.value)
                        }
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

                    {/* 4. Row action buttons: Add and Delete */}
                    <div className="author-action-buttons">
                      {/* Only show add button on the last author row */}
                      {index === authors.length - 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-add-author"
                          onClick={addAuthor}
                          disabled={
                            authors.length >= MAX_AUTHORS ||
                            (!editMode && isViewMode)
                          }
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
                          disabled={!editMode && isViewMode}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="row g-4">
                <div className="col-lg-6">
                  {/* Left Column Card */}
                  <div className="form-card h-100" style={{ padding: '24px' }}>
                    <div className="mb-3">
                      <label className="form-label">
                        {effectiveIsBook
                          ? 'Book Title'
                          : effectiveIsBookChapter
                            ? 'Book Chapter Title'
                            : 'Title'}
                      </label>
                      <input
                        type="text"
                        id="title"
                        name="title"
                        className="form-control"
                        placeholder={effectiveIsBookChapter ? "Enter book chapter title" : "Title"}
                        required
                        disabled={!editMode && isViewMode}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="typeSelect">
                        Type
                      </label>
                      {isViewMode ? (
                        <input
                          type="text"
                          className="form-control"
                          value={currentType}
                          readOnly
                        />
                      ) : (
                        <select
                          id="typeSelect"
                          name="type"
                          className="form-select"
                          required
                          disabled={(!editMode && isViewMode) || effectiveIsConference || effectiveIsBookChapter || effectiveIsBook}
                        >
                          <option value="">Select Type</option>
                          {effectiveIsJournal && (
                            <>
                              <option value="Article">Article</option>
                              <option value="Erratum">Erratum</option>
                              <option value="Editorial">Editorial</option>
                              <option value="Note">Note</option>
                              <option value="Review">Review</option>
                              <option value="Retraction">Retraction</option>
                            </>
                          )}
                          {effectiveIsConference && (
                            <option value="Conference paper">
                              Conference paper
                            </option>
                          )}
                          {effectiveIsBookChapter && (
                            <option value="Book Chapter">Book Chapter</option>
                          )}
                          {effectiveIsBook && (
                            <option value="Book">Book</option>
                          )}
                        </select>
                      )}
                    </div>

                    {effectiveIsJournal && (
                      <div className="mb-3">
                        <label className="form-label">Quartile</label>
                        <div className="radio-group">
                          {['Q1', 'Q2', 'Q3', 'Q4', 'Nil'].map((q) => (
                            <div className="radio-item" key={q}>
                              <input
                                type="radio"
                                id={q.toLowerCase()}
                                name="quartile"
                                value={q}
                                disabled={!editMode && isViewMode}
                              />
                              <label htmlFor={q.toLowerCase()}>{q}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mb-3">
                      <label className="form-label">Index</label>
                      {/* Container for tags and input */}
                      <div className="sdg-selection-container border rounded d-flex flex-wrap align-items-center p-1 gap-1" style={{ minHeight: '36px', backgroundColor: '#fff' }}>
                        {/* Selected Indexes as tags inline with input */}
                        {selectedIndexes.map((index) => (
                          <span key={index} className="badge custom-tag-badge d-inline-flex align-items-center flex-shrink-0" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
                            {index}
                            <button
                              type="button"
                              className="btn-close btn-close-white ms-1"
                              style={{ fontSize: '9px', width: '10px', height: '10px' }}
                              onClick={() => setSelectedIndexes((prev) => prev.filter((item) => item !== index))}
                              disabled={!editMode && isViewMode}
                            ></button>
                          </span>
                        ))}
                        {/* Search input inline */}
                        <div className="position-relative flex-grow-1">
                          <input
                            type="text"
                            className="form-control border-0 p-0"
                            style={{ boxShadow: 'none', outline: 'none', minWidth: '180px', fontSize: '0.9rem', height: '28px' }}
                            placeholder={selectedIndexes.length === 0 ? "Type to search and select indexes" : ""}
                            value={indexSearchQuery}
                            onChange={(e) => {
                              setIndexSearchQuery(e.target.value);
                              setShowIndexSuggestions(true);
                            }}
                            onFocus={() => setShowIndexSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowIndexSuggestions(false), 150)}
                            disabled={!editMode && isViewMode}
                            autoComplete="off"
                          />
                          {/* Suggestions */}
                          {showIndexSuggestions && (() => {
                            const availableIndexes = ['SCIE', 'Scopus', 'PubMed', 'Google Scholar'];
                            const filteredIndexes = availableIndexes.filter(
                              (index) =>
                                index.toLowerCase().includes(indexSearchQuery.toLowerCase()) &&
                                !selectedIndexes.includes(index)
                            );
                            return filteredIndexes.length > 0 ? (
                              <ul className="list-group position-absolute w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto', top: '100%', left: 0 }}>
                                {filteredIndexes.map((index) => (
                                  <li
                                    key={index}
                                    className="list-group-item list-group-item-action"
                                    onMouseDown={() => {
                                      setSelectedIndexes((prev) => [...prev, index]);
                                      setIndexSearchQuery('');
                                      setShowIndexSuggestions(false);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {index}
                                  </li>
                                ))}
                              </ul>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Collaboration Section - SDG-style multi-select */}
                    <div className="mb-3">
                      <label className="form-label">Collaboration</label>
                      {/* Container for tags and input */}
                      <div className="sdg-selection-container border rounded d-flex flex-wrap align-items-center p-1 gap-1" style={{ minHeight: '36px', backgroundColor: '#fff' }}>
                        {/* Selected Collaborations as tags inline with input */}
                        {selectedCollaborations.map((collab) => (
                          <span key={collab} className="badge custom-tag-badge d-inline-flex align-items-center flex-shrink-0" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
                            {collab}
                            <button
                              type="button"
                              className="btn-close btn-close-white ms-1"
                              style={{ fontSize: '9px', width: '10px', height: '10px' }}
                              onClick={() => setSelectedCollaborations((prev) => prev.filter((item) => item !== collab))}
                              disabled={!editMode && isViewMode}
                            ></button>
                          </span>
                        ))}
                        {/* Search input inline */}
                        <div className="position-relative flex-grow-1">
                          <input
                            type="text"
                            className="form-control border-0 p-0"
                            style={{ boxShadow: 'none', outline: 'none', minWidth: '180px', fontSize: '0.9rem', height: '28px' }}
                            placeholder={selectedCollaborations.length === 0 ? "Type to search and select collaborations" : ""}
                            value={collaborationSearchQuery}
                            onChange={(e) => {
                              setCollaborationSearchQuery(e.target.value);
                              setShowCollaborationSuggestions(true);
                            }}
                            onFocus={() => setShowCollaborationSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowCollaborationSuggestions(false), 150)}
                            disabled={!editMode && isViewMode}
                            autoComplete="off"
                          />
                          {/* Suggestions */}
                          {showCollaborationSuggestions && (() => {
                            const filteredCollaborations = allCollaborations.filter(
                              (collab) =>
                                collab.toLowerCase().includes(collaborationSearchQuery.toLowerCase()) &&
                                !selectedCollaborations.includes(collab)
                            );
                            return filteredCollaborations.length > 0 ? (
                              <ul className="list-group position-absolute w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto', top: '100%', left: 0 }}>
                                {filteredCollaborations.map((collab) => (
                                  <li
                                    key={collab}
                                    className="list-group-item list-group-item-action"
                                    onMouseDown={() => {
                                      setSelectedCollaborations((prev) => [...prev, collab]);
                                      setCollaborationSearchQuery('');
                                      setShowCollaborationSuggestions(false);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {collab}
                                  </li>
                                ))}
                              </ul>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      {/* "Others" checkbox and input */}
                      {/* <div className="mt-2">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="others-collaboration"
                            checked={othersSelected}
                            onChange={handleOthersChange}
                            disabled={!editMode && isViewMode}
                          />
                          <label className="form-check-label" htmlFor="others-collaboration">
                            Others
                          </label>
                        </div>
                        {othersSelected && (
                          <input
                            type="text"
                            className="form-control mt-2"
                            placeholder="Please Specify"
                            value={othersValue}
                            onChange={handleOthersInputChange}
                            disabled={!editMode && isViewMode}
                          />
                        )}
                      </div> */}
                    </div>

                    {effectiveIsJournal && (
                      <div className="mb-3">
                        <div className="d-flex align-items-center flex-nowrap">
                          <label className="form-label mb-0 me-2" style={{ minWidth: 'fit-content', whiteSpace: 'nowrap' }}>
                            Listed in Anna university  CFR Annexure
                          </label>
                          <div className="radio-group me-2 mt-2">
                            <div className="radio-item">
                              <input
                                type="radio"
                                id="yes"
                                name="listedInAnnaUniversity"
                                value="yes"
                                checked={annaUniversityListed === true}
                                onChange={() => setAnnaUniversityListed(true)}
                                disabled={!editMode && isViewMode}
                              />
                              <label htmlFor="yes">Yes</label>
                            </div>
                            <div className="radio-item">
                              <input
                                type="radio"
                                id="no"
                                name="listedInAnnaUniversity"
                                value="no"
                                checked={annaUniversityListed === false}
                                onChange={() => setAnnaUniversityListed(false)}
                                disabled={!editMode && isViewMode}
                              />
                              <label htmlFor="no">No</label>
                            </div>
                          </div>
                          {annaUniversityListed && (
                            <input
                              type="text"
                              name="annexureNo"
                              className="form-control"
                              placeholder="Annexure No."
                              style={{ maxWidth: '110px', minWidth: '100px' }}
                              disabled={!editMode && isViewMode}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Acknowledgement Section - SDG-style multi-select - Hidden for Book category */}
                    {!effectiveIsBook && (
                      <div className="mb-3">
                        <label className="form-label">
                          Acknowledgement
                        </label>
                        {/* Container for tags and input */}
                        <div className="sdg-selection-container border rounded d-flex flex-wrap align-items-center p-1 gap-1" style={{ minHeight: '36px', backgroundColor: '#fff' }}>
                          {/* Selected Acknowledgements as tags inline with input */}
                          {selectedAcknowledgements.map((ack) => (
                            <span key={ack} className="badge custom-tag-badge d-inline-flex align-items-center flex-shrink-0" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
                              {ack}
                              <button
                                type="button"
                                className="btn-close btn-close-white ms-1"
                                style={{ fontSize: '9px', width: '10px', height: '10px' }}
                                onClick={() => {
                                  setSelectedAcknowledgements((prev) => prev.filter((item) => item !== ack));
                                }}
                                disabled={!editMode && isViewMode}
                              ></button>
                            </span>
                          ))}
                          {/* Search input inline */}
                          <div className="position-relative flex-grow-1">
                            <input
                              type="text"
                              className="form-control border-0 p-0"
                              style={{ boxShadow: 'none', outline: 'none', minWidth: '180px', fontSize: '0.9rem', height: '28px' }}
                              placeholder={selectedAcknowledgements.length === 0 ? "Type to search and select acknowledgements" : ""}
                              value={acknowledgementSearchQuery}
                              onChange={(e) => {
                                setAcknowledgementSearchQuery(e.target.value);
                                setShowAcknowledgementSuggestions(true);
                              }}
                              onFocus={() => setShowAcknowledgementSuggestions(true)}
                              onBlur={() => setTimeout(() => setShowAcknowledgementSuggestions(false), 150)}
                              disabled={!editMode && isViewMode}
                              autoComplete="off"
                            />
                            {/* Suggestions */}
                            {showAcknowledgementSuggestions && (() => {
                              const filteredAcknowledgements = allAcknowledgements.filter(
                                (ack) =>
                                  ack.toLowerCase().includes(acknowledgementSearchQuery.toLowerCase()) &&
                                  !selectedAcknowledgements.includes(ack)
                              );
                              return filteredAcknowledgements.length > 0 ? (
                                <ul className="list-group position-absolute w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto', top: '100%', left: 0 }}>
                                  {filteredAcknowledgements.map((ack) => (
                                    <li
                                      key={ack}
                                      className="list-group-item list-group-item-action"
                                      onMouseDown={() => {
                                        // If selecting Nil, clear all others
                                        if (ack === 'Nil') {
                                          setSelectedAcknowledgements(['Nil']);
                                          setOtherAcknowledgement('');
                                        } else {
                                          // If selecting others, remove Nil
                                          setSelectedAcknowledgements((prev) => {
                                            const filtered = prev.filter(item => item !== 'Nil');
                                            return [...filtered, ack];
                                          });
                                        }
                                        setAcknowledgementSearchQuery('');
                                        setShowAcknowledgementSuggestions(false);
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      {ack}
                                    </li>
                                  ))}
                                </ul>
                              ) : null;
                            })()}
                          </div>
                        </div>

                        {/* "Others" checkbox and input */}
                        {/* <div className="mt-2">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="others-acknowledgement"
                              checked={acknowledgements.Others}
                              onChange={(e) => {
                                setAcknowledgements((prev) => ({
                                  ...prev,
                                  Others: e.target.checked
                                }));
                                if (!e.target.checked) {
                                  setOtherAcknowledgement('');
                                } else {
                                  // Remove Nil if Others is selected
                                  setSelectedAcknowledgements((prev) => prev.filter(item => item !== 'Nil'));
                                }
                              }}
                              disabled={!editMode && isViewMode}
                            />
                            <label className="form-check-label" htmlFor="others-acknowledgement">
                              Others
                            </label>
                          </div>
                          {acknowledgements.Others && (
                            <input
                              type="text"
                              className="form-control mt-2"
                              placeholder="Please specify"
                              value={otherAcknowledgement}
                              onChange={handleOtherAcknowledgementChange}
                              disabled={!editMode && isViewMode}
                            />
                          )}
                        </div> */}
                      </div>
                    )}

                    {/* <div>
                                <label className="form-label">Acknowledgement</label>
                                <div className="radio-group">
                                    {['Nil', 'DST-FIST', 'MODROBS', 'Others'].map(ack => (
                                        <div className="radio-item" key={ack}>
                                            <input
                                                type="radio"
                                                id={ack.toLowerCase()}
                                                name="acknowledgements"
                                                value={ack}
                                                checked={acknowledgements === ack}
                                                onChange={() => setAcknowledgements(ack)}
                                                disabled={!editMode && isViewMode}
                                            />
                                            <label htmlFor={ack.toLowerCase()}>{ack}</label>
                                        </div>
                                    ))}
                                </div>
                                {acknowledgements === 'Others' && (
                                    <input
                                        type="text"
                                        className="form-control mt-2"
                                        placeholder="Please specify"
                                        value={otherAcknowledgement}
                                        onChange={e => setOtherAcknowledgement(e.target.value)}
                                        disabled={!editMode && isViewMode}
                                    />
                                )}
                            </div> */}

                    {/* Sustainable Development Goals Section */}
                    <div className="mb-3">
                      <label className="form-label">Sustainable Development Goals (SDGs)</label>
                      {/* Container for tags and input */}
                      <div className="sdg-selection-container border rounded d-flex flex-wrap align-items-center p-1 gap-1" style={{ minHeight: '36px', backgroundColor: '#fff' }}>
                        {/* Selected SDGs as tags inline with input */}
                        {selectedSDGs.map((sdg) => (
                          <span key={sdg} className="badge custom-tag-badge d-inline-flex align-items-center flex-shrink-0" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
                            {typeof sdg === 'string' && sdg.includes('.') ? sdg.split('.')[0] : sdg}
                            <button
                              type="button"
                              className="btn-close btn-close-white ms-1"
                              style={{ fontSize: '9px', width: '10px', height: '10px' }}
                              onClick={() => setSelectedSDGs((prev) => prev.filter((item) => item !== sdg))}
                              disabled={!editMode && isViewMode}
                            ></button>
                          </span>
                        ))}
                        {/* Search input inline */}
                        <div className="position-relative flex-grow-1">
                          <input
                            type="text"
                            className="form-control border-0 p-0"
                            style={{ boxShadow: 'none', outline: 'none', minWidth: '180px', fontSize: '0.9rem', height: '28px' }}
                            placeholder={selectedSDGs.length === 0 ? "Type to search and select SDGs" : ""}
                            value={sdgSearchQuery}
                            onChange={(e) => {
                              setSdgSearchQuery(e.target.value);
                              setShowSdgSuggestions(true);
                            }}
                            onFocus={() => setShowSdgSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSdgSuggestions(false), 150)}
                            disabled={!editMode && isViewMode}
                            autoComplete="off"
                          />
                          {/* Suggestions */}
                          {showSdgSuggestions && (() => {
                            const filteredSDGs = allSDGs.filter(
                              (sdg) =>
                                sdg.toLowerCase().includes(sdgSearchQuery.toLowerCase()) &&
                                !selectedSDGs.includes(sdg)
                            );
                            return filteredSDGs.length > 0 ? (
                              <ul className="list-group position-absolute w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto', top: '100%', left: 0 }}>
                                {filteredSDGs.map((sdg) => (
                                  <li
                                    key={sdg}
                                    className="list-group-item list-group-item-action"
                                    onMouseDown={() => {
                                      setSelectedSDGs((prev) => [...prev, sdg]);
                                      setSdgSearchQuery('');
                                      setShowSdgSuggestions(false);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {sdg}
                                  </li>
                                ))}
                              </ul>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  {/* Right Column Card */}
                  <div className="form-card h-100" style={{ padding: '24px' }}>
                    {/* Only show journal search for Journal */}
                    {effectiveIsJournal && (
                      <div className="mb-3 position-relative">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <label
                            htmlFor="journalSearch"
                            className="form-label mb-0"
                          >
                            Journal Name
                          </label>
                          <div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary me-2"
                              onClick={() => setShowJournalRequestModal(true)}
                              disabled={!editMode && isViewMode}
                            >
                              Request Journal
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          id="journalSearch"
                          className="form-control"
                          placeholder="Search for a Journal"
                          value={journalSearchQuery}
                          onChange={handleJournalSearchChange}
                          onBlur={() => setShowJournalSuggestions(false)}
                          disabled={!editMode && isViewMode}
                          autoComplete="off"
                        />
                        {showJournalSuggestions &&
                          journalSearchResults.length > 0 && (
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
                    )}

                    {/* For Conference, show manual input fields */}
                    {effectiveIsConference && (
                      <>
                        <div className="mb-3">
                          <label className="form-label">Conference Title</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter conference title"
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
                        <div className="mb-3">
                          <label className="form-label">Publisher</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter publisher name"
                            value={publicationDetails.publisher || ''}
                            onChange={(e) =>
                              setPublicationDetails((prev) => ({
                                ...prev,
                                publisher: e.target.value,
                              }))
                            }
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Source</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter source (International/National)"
                            value={publicationDetails.source || ''}
                            onChange={(e) =>
                              setPublicationDetails((prev) => ({
                                ...prev,
                                source: e.target.value,
                              }))
                            }
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                      </>
                    )}

                    {/* For Book Chapter, show manual input fields */}
                    {effectiveIsBookChapter && (
                      <>
                        <div className="mb-3">
                          <label className="form-label">Book Title</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter book title"
                            value={bookChapterTitle}
                            onChange={(e) =>
                              setBookChapterTitle(e.target.value)
                            }
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Source</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter source name"
                            value={publicationDetails.source || ''}
                            onChange={(e) =>
                              setPublicationDetails((prev) => ({
                                ...prev,
                                source: e.target.value,
                              }))
                            }
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Publisher</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter publisher name"
                            value={publicationDetails.publisher || ''}
                            onChange={(e) =>
                              setPublicationDetails((prev) => ({
                                ...prev,
                                publisher: e.target.value,
                              }))
                            }
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                      </>
                    )}

                    {/* For Book, show manual input fields */}
                    {effectiveIsBook && (
                      <>
                        <div className="mb-3">
                          <label className="form-label">Source</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter source name"
                            value={publicationDetails.source || ''}
                            onChange={(e) =>
                              setPublicationDetails((prev) => ({
                                ...prev,
                                source: e.target.value,
                              }))
                            }
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Publisher</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter publisher name"
                            value={publicationDetails.publisher || ''}
                            onChange={(e) =>
                              setPublicationDetails((prev) => ({
                                ...prev,
                                publisher: e.target.value,
                              }))
                            }
                            disabled={!editMode && isViewMode}
                          />
                        </div>
                      </>
                    )}

                    {/* For Journal, show read-only Level and Publisher */}
                    {effectiveIsJournal && (
                      <>
                        <div className="mb-3">
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
                        <div className="mb-3">
                          <label className="form-label">Publisher</label>
                          <input
                            type="text"
                            className="form-control"
                            value={journalDetails.publisher}
                            readOnly
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Website</label>
                          <input
                            type="text"
                            className="form-control"
                            value={journalDetails.website}
                            readOnly
                          />
                        </div>
                      </>
                    )}

                    {/* ISBN/ISSN fields - different handling for different categories */}
                    <div className="row mb-3">
                      <div className="col-6">
                        <label className="form-label">
                          {effectiveIsConference || effectiveIsBook || effectiveIsBookChapter
                            ? 'Print ISBN'
                            : 'Print ISSN'}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={
                            effectiveIsConference || effectiveIsBook || effectiveIsBookChapter
                              ? publicationDetails.print_isbn || ''
                              : journalDetails.printISSN || ''
                          }
                          onChange={(e) => {
                            if (effectiveIsConference || effectiveIsBook || effectiveIsBookChapter) {
                              setPublicationDetails((prev) => ({
                                ...prev,
                                print_isbn: e.target.value,
                              }));
                            } else {
                              setJournalDetails((prev) => ({
                                ...prev,
                                printISSN: e.target.value,
                              }));
                            }
                          }}
                          disabled={!editMode && isViewMode}
                          readOnly={effectiveIsJournal}
                          placeholder={
                            effectiveIsConference || effectiveIsBook || effectiveIsBookChapter
                              ? 'Enter ISBN'
                              : ''
                          }
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label">
                          {effectiveIsConference || effectiveIsBook
                            ? 'Online ISBN'
                            : effectiveIsBookChapter
                              ? 'Online ISBN'
                              : 'Online ISSN'}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={
                            effectiveIsConference || effectiveIsBook || effectiveIsBookChapter
                              ? publicationDetails.online_isbn || ''
                              : journalDetails.onlineISSN || ''
                          }
                          onChange={(e) => {
                            if (effectiveIsConference || effectiveIsBook || effectiveIsBookChapter) {
                              setPublicationDetails((prev) => ({
                                ...prev,
                                online_isbn: e.target.value,
                              }));
                            } else {
                              setJournalDetails((prev) => ({
                                ...prev,
                                onlineISSN: e.target.value,
                              }));
                            }
                          }}
                          disabled={!editMode && isViewMode}
                          readOnly={effectiveIsJournal}
                          placeholder={
                            effectiveIsConference || effectiveIsBook || effectiveIsBookChapter
                              ? 'Enter ISBN'
                              : ''
                          }
                        />
                      </div>
                    </div>

                    {/* Journal Request Modal */}
                    {showJournalRequestModal && (
                      <div
                        className="modal fade show"
                        style={{ display: 'block' }}
                        tabIndex={-1}
                      >
                        <div className="modal-dialog">
                          <div className="modal-content">
                            <div className="modal-header">
                              <h5 className="modal-title">
                                Request Custom Journal
                              </h5>
                              <button
                                type="button"
                                className="btn-close"
                                onClick={() =>
                                  setShowJournalRequestModal(false)
                                }
                              ></button>
                            </div>
                            <div className="modal-body">
                              {journalRequestError && (
                                <div className="alert alert-danger">
                                  {journalRequestError}
                                </div>
                              )}
                              <form onSubmit={handleJournalRequestSubmit}>
                                <div className="mb-3">
                                  <label className="form-label">
                                    Journal Name *
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={journalRequest.journal_name}
                                    onChange={(e) =>
                                      handleJournalRequestChange(
                                        'journal_name',
                                        e.target.value
                                      )
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
                                        handleJournalRequestChange(
                                          'category',
                                          e.target.value
                                        )
                                      }
                                      required
                                    >
                                      <option value="">Select Level</option>
                                      <option value="National">National</option>
                                      <option value="International">
                                        International
                                      </option>
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
                                  <label className="form-label">
                                    Publisher
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={journalRequest.publisher}
                                    onChange={(e) =>
                                      handleJournalRequestChange(
                                        'publisher',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className="mb-3">
                                  <label className="form-label">Website</label>
                                  <input
                                    type="url"
                                    className="form-control"
                                    value={journalRequest.website}
                                    onChange={(e) =>
                                      handleJournalRequestChange(
                                        'website',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className="row mb-3">
                                  <div className="col-6">
                                    <label className="form-label">
                                      Print ISSN
                                    </label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={journalRequest.print_issn}
                                      onChange={(e) =>
                                        handleJournalRequestChange(
                                          'print_issn',
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="col-6">
                                    <label className="form-label">
                                      Online ISSN
                                    </label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={journalRequest.online_issn}
                                      onChange={(e) =>
                                        handleJournalRequestChange(
                                          'online_issn',
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="d-flex justify-content-end">
                                  <button
                                    type="button"
                                    className="btn btn-secondary me-2"
                                    onClick={() =>
                                      setShowJournalRequestModal(false)
                                    }
                                    disabled={journalRequestLoading}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={journalRequestLoading}
                                  >
                                    {journalRequestLoading
                                      ? 'Submitting...'
                                      : 'Submit Request'}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Conference Request Modal */}
                    {showConferenceRequestModal && (
                      <div
                        className="modal fade show"
                        style={{ display: 'block' }}
                        tabIndex={-1}
                      >
                        <div className="modal-dialog">
                          <div className="modal-content">
                            <div className="modal-header">
                              <h5 className="modal-title">
                                Request Custom Conference
                              </h5>
                              <button
                                type="button"
                                className="btn-close"
                                onClick={() =>
                                  setShowConferenceRequestModal(false)
                                }
                              ></button>
                            </div>
                            <div className="modal-body">
                              {conferenceRequestError && (
                                <div className="alert alert-danger">
                                  {conferenceRequestError}
                                </div>
                              )}
                              <form onSubmit={handleConferenceRequestSubmit}>
                                <div className="mb-3">
                                  <label className="form-label">
                                    Conference Name *
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={conferenceRequest.conference_name}
                                    onChange={(e) =>
                                      handleConferenceRequestChange(
                                        'conference_name',
                                        e.target.value
                                      )
                                    }
                                    required
                                  />
                                </div>
                                <div className="mb-3">
                                  <label className="form-label">Level *</label>
                                  <div className="position-relative">
                                    <select
                                      className="form-control"
                                      value={conferenceRequest.category}
                                      onChange={(e) =>
                                        handleConferenceRequestChange(
                                          'category',
                                          e.target.value
                                        )
                                      }
                                      required
                                    >
                                      <option value="">Select Level</option>
                                      <option value="National">National</option>
                                      <option value="International">
                                        International
                                      </option>
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
                                  <label className="form-label">
                                    Publisher
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={conferenceRequest.publisher}
                                    onChange={(e) =>
                                      handleConferenceRequestChange(
                                        'publisher',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className="mb-3">
                                  <label className="form-label">Website</label>
                                  <input
                                    type="url"
                                    className="form-control"
                                    value={conferenceRequest.website}
                                    onChange={(e) =>
                                      handleConferenceRequestChange(
                                        'website',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className="row mb-3">
                                  <div className="col-6">
                                    <label className="form-label">
                                      Print ISBN
                                    </label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={conferenceRequest.print_isbn}
                                      onChange={(e) =>
                                        handleConferenceRequestChange(
                                          'print_isbn',
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="col-6">
                                    <label className="form-label">
                                      Online ISBN
                                    </label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={conferenceRequest.online_isbn}
                                      onChange={(e) =>
                                        handleConferenceRequestChange(
                                          'online_isbn',
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="d-flex justify-content-end">
                                  <button
                                    type="button"
                                    className="btn btn-secondary me-2"
                                    onClick={() =>
                                      setShowConferenceRequestModal(false)
                                    }
                                    disabled={conferenceRequestLoading}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={conferenceRequestLoading}
                                  >
                                    {conferenceRequestLoading
                                      ? 'Submitting...'
                                      : 'Submit Request'}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Modal backdrop */}
                    {showConferenceRequestModal && (
                      <div className="modal-backdrop fade show"></div>
                    )}

                    {/* Modal backdrop */}
                    {showJournalRequestModal && (
                      <div className="modal-backdrop fade show"></div>
                    )}

                    {effectiveIsJournal && (
                      <div className="mb-3">
                        <div className="row g-3">
                          <div className="col-6">
                            <label className="form-label" style={{ fontSize: '14px', marginBottom: '0.5rem' }}>
                              Impact Factor
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              id="impactFactorInput"
                              name="impactFactorInput"
                              className="form-control"
                              disabled={!editMode && isViewMode}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label" style={{ fontSize: '14px', marginBottom: '0.5rem' }}>
                              Cite Score
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              id="citeScoreInput"
                              name="citeScoreInput"
                              className="form-control"
                              disabled={!editMode && isViewMode}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mb-3">
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <label className="form-label mb-0">
                          Submitted on
                        </label>
                        <label className="toggle-switch mb-0">
                          <input
                            type="checkbox"
                            checked={metrics.dateOfSubmission}
                            onChange={() =>
                              handleMetricToggle('dateOfSubmission')
                            }
                            disabled={!editMode && isViewMode}
                          />
                          <span className="slider"></span>
                        </label>
                        <input
                          type="date"
                          id="dateOfSubmissionInput"
                          name="dateOfSubmissionInput"
                          className="form-control"
                          style={{ maxWidth: '150px' }}
                          disabled={
                            !metrics.dateOfSubmission ||
                            (!editMode && isViewMode)
                          }
                        />
                      </div>
                      <div className="d-flex align-items-center gap-3 mt-4">
                        <label className="form-label mb-0">Status</label>
                        <div className="position-relative">
                          <select
                            id="statusDropdown"
                            className="form-control"
                            style={{ width: '200px' }}
                            value={status}
                            onChange={handleStatusChange}
                            disabled={!editMode && isViewMode}
                          >
                            <option value="submitted">Submitted</option>
                            <option value="underReview">Under Review</option>
                            <option value="revisionSubmitted">
                              Revision Submitted
                            </option>
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
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditional Bottom Card */}
              {status === 'published' && (
                <div className="form-card-dashed container-gap" style={{ padding: '24px' }}>
                  {/* Abstract and Keywords */}
                  {!effectiveIsBook && !effectiveIsBookChapter && (
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
                      <small className="text-muted">
                        Character count: {abstract.length}
                      </small>
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label">Keywords</label>
                    <input
                      type="text"
                      id="keywords"
                      name="keywords"
                      className="form-control"
                      placeholder="Enter keywords separated by commas "
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      disabled={!editMode && isViewMode}
                    />
                  </div>

                  <div className="row g-4">
                    <div className="col-lg-6">
                      {/* Left Column - Volume, Issue, Issue Type, Pages, DOI */}
                      <div className="metric-item-vertical mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <label className="form-label mb-0">Volume</label>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              id="volumeToggle"
                              checked={metrics.volume}
                              onChange={() => handleMetricToggle('volume')}
                              disabled={!editMode && isViewMode}
                            />
                            <span className="slider"></span>
                          </label>
                          <input
                            type="text"
                            id="volumeInput"
                            className="form-control"
                            disabled={
                              !metrics.volume || (!editMode && isViewMode)
                            }
                          />
                        </div>
                      </div>

                      <div className="metric-item-vertical mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <label className="form-label mb-0">Issue</label>
                          <label className="toggle-switch">
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
                            disabled={
                              !metrics.issue || (!editMode && isViewMode)
                            }
                          />
                        </div>
                      </div>

                      {!effectiveIsBook && !effectiveIsBookChapter && (
                        <div className="mb-3">
                          <div className="radio-group">
                            <div className="radio-item">
                              <input
                                type="radio"
                                id="regularIssue"
                                name="issueType"
                                value="Regular Issue"
                                disabled={!editMode && isViewMode}
                              />
                              <label htmlFor="regularIssue">Regular Issue</label>
                            </div>
                            <div className="radio-item">
                              <input
                                type="radio"
                                id="specialIssue"
                                name="issueType"
                                value="Special Issue"
                                disabled={!editMode && isViewMode}
                              />
                              <label htmlFor="specialIssue">Special Issue</label>
                            </div>
                            <div className="radio-item">
                              <input
                                type="radio"
                                id="proceedings"
                                name="issueType"
                                value="Proceedings"
                                disabled={!editMode && isViewMode}
                              />
                              <label htmlFor="proceedings">Proceedings</label>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="metric-item-vertical mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <label className="form-label mb-0">
                            {pageOrArticleChoice === 'article' ? 'Article Number' : 'Page Number'}
                          </label>
                          <div className="custom-tooltip">
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
                            <span className="tooltip-text">Toggle to switch between Page Number and Article Number</span>
                          </div>
                        </div>
                        {pageOrArticleChoice === 'pages' && (
                          <div className="d-flex gap-2 mt-2">
                            <input
                              type="number"
                              id="pagesFromInput"
                              className="form-control"
                              placeholder="From"
                              disabled={!editMode && isViewMode}
                            />
                            <input
                              type="number"
                              id="pagesToInput"
                              className="form-control"
                              placeholder="To"
                              disabled={!editMode && isViewMode}
                            />
                          </div>
                        )}
                        {pageOrArticleChoice === 'article' && (
                          <div className="mt-2">
                            <input
                              type="text"
                              id="articleNumberInput"
                              className="form-control"
                              placeholder="Enter article number"
                              disabled={!editMode && isViewMode}
                            />
                          </div>
                        )}
                      </div>

                      <div className="metric-item-vertical mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <label className="form-label mb-0">DOI</label>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              id="doiToggle"
                              checked={metrics.doi}
                              onChange={() => handleMetricToggle('doi')}
                              disabled={!editMode && isViewMode}
                            />
                            <span className="slider"></span>
                          </label>
                          {isViewMode && !editMode ? (
                            // View mode - display as clickable link
                            metrics.doi ? (
                              <div className="form-control-plaintext">
                                {(() => {
                                  // Use the DOI value from state
                                  const doiValue = doi;
                                  if (!doiValue) return 'N/A';

                                  // Create the full DOI URL
                                  const fullDoiUrl = doiValue.startsWith('http')
                                    ? doiValue
                                    : `https://www.doi.org/${doiValue}`;
                                  return (
                                    <a
                                      href={fullDoiUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary text-decoration-none"
                                    >
                                      {doiValue}
                                    </a>
                                  );
                                })()}
                              </div>
                            ) : (
                              <div className="form-control-plaintext text-muted">
                                DOI not provided
                              </div>
                            )
                          ) : (
                            // Edit mode - display with prefix input and preview button
                            <div className="d-flex align-items-center flex-grow-1">
                              <span
                                className="text-muted me-2"
                                style={{ fontSize: '0.875rem' }}
                              >
                                https://www.doi.org/
                              </span>
                              <input
                                type="text"
                                id="doiInput"
                                className="form-control"
                                placeholder="10.1109/ICACCS60874.2024.10717004"
                                value={doi}
                                onChange={(e) => setDoi(e.target.value)}
                                disabled={!metrics.doi}
                              />
                              {metrics.doi && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm ms-2"
                                  onClick={() => {
                                    const doiInput =
                                      document.getElementById('doiInput') as HTMLInputElement;
                                    const doiValue = doiInput
                                      ? doiInput.value.trim()
                                      : '';
                                    if (doiValue) {
                                      const fullDoiUrl = doiValue.startsWith(
                                        'http'
                                      )
                                        ? doiValue
                                        : `https://www.doi.org/${doiValue}`;
                                      window.open(
                                        fullDoiUrl,
                                        '_blank',
                                        'noopener,noreferrer'
                                      );
                                    } else {
                                      alert('Please enter a DOI first');
                                    }
                                  }}
                                  title="Preview DOI URL"
                                >
                                  Preview
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-6">
                      {/* Right Column - Date(s), Accepted for Publications, Available Online, Upload */}
                      {/* <label className="form-section-title mb-3">Date(s)</label> */}

                      {/* Credit To Field */}
                      {(selectedIndexes.includes('SCIE') || selectedIndexes.includes('Scopus') || selectedIndexes.includes('PubMed') || selectedIndexes.includes('Google Scholar')) && authors.length > 0 && (
                        <div className="metric-item-vertical mb-3">
                          <div className="d-flex justify-content-between align-items-center">
                            <label className="form-label mb-0">Credit to</label>
                            <div className="d-flex gap-2">
                              <select
                                className="form-control"
                                value={selectedCreditTo[0] || ''}
                                onChange={(e) => {
                                  const newSelected = [...selectedCreditTo];
                                  newSelected[0] = e.target.value;
                                  setSelectedCreditTo(newSelected.filter(v => v));
                                }}
                                disabled={!editMode && isViewMode}
                                style={{ minWidth: '150px' }}
                              >
                                <option value="">Select Author 1</option>
                                {authors
                                  .filter(
                                    (author) => author.name && author.name.trim()
                                  )
                                  .map((author) => (
                                    <option
                                      key={author.id}
                                      value={
                                        author.author_id || author.register_no
                                      }
                                    >
                                      {author.name} (
                                      {author.author_id || author.register_no})
                                    </option>
                                  ))}
                              </select>
                              {selectedIndexes.includes('SCIE') && (
                                <select
                                  className="form-control"
                                  value={selectedCreditTo[1] || ''}
                                  onChange={(e) => {
                                    const newSelected = [...selectedCreditTo];
                                    newSelected[1] = e.target.value;
                                    setSelectedCreditTo(newSelected.filter(v => v));
                                  }}
                                  disabled={!editMode && isViewMode}
                                  style={{ minWidth: '150px' }}
                                >
                                  <option value="">Select Author 2</option>
                                  {authors
                                    .filter(
                                      (author) => author.name && author.name.trim()
                                    )
                                    .map((author) => (
                                      <option
                                        key={author.id}
                                        value={
                                          author.author_id || author.register_no
                                        }
                                      >
                                        {author.name} (
                                        {author.author_id || author.register_no})
                                      </option>
                                    ))}
                                </select>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Reference Number Field - Hidden for Book category */}
                      {!effectiveIsBook && (
                        <div className="metric-item-vertical mb-3">
                          <label className="form-label mb-2">
                            Reference Nos.
                          </label>
                          <input
                            type="text"
                            id="referenceNumberInput"
                            className="form-control reference-number-input"
                            value={referenceNumber}
                            onChange={(e) =>
                              setReferenceNumber(e.target.value)
                            }
                            placeholder="Enter KSRCT References"
                            disabled={!editMode && isViewMode}
                          />
                          <div className="mt-1">
                            <small className="text-muted">
                              Count:{' '}
                              {
                                referenceNumber
                                  .split(',')
                                  .filter((num) => num.trim() !== '').length
                              }
                            </small>
                          </div>
                        </div>
                      )}

                      <div className="metric-item-vertical mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <label className="form-label mb-0">Accepted on</label>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              id="acceptedToggle"
                              checked={metrics.acceptedForPublication}
                              onChange={() =>
                                handleMetricToggle('acceptedForPublication')
                              }
                              disabled={!editMode && isViewMode}
                            />
                            <span className="slider"></span>
                          </label>
                          <input
                            type="date"
                            id="acceptedDateInput"
                            className="form-control"
                            placeholder="dd-mm-yyyy"
                            disabled={
                              !metrics.acceptedForPublication ||
                              (!editMode && isViewMode)
                            }
                          />
                        </div>
                      </div>

                      <div className="metric-item-vertical mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <label className="form-label mb-0">
                            Published on
                          </label>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              id="availableToggle"
                              checked={metrics.availableOnline}
                              onChange={() =>
                                handleMetricToggle('availableOnline')
                              }
                              disabled={!editMode && isViewMode}
                            />
                            <span className="slider"></span>
                          </label>
                          <input
                            type="date"
                            id="availableDateInput"
                            className="form-control"
                            placeholder="dd-mm-yyyy"
                            disabled={
                              !metrics.availableOnline ||
                              (!editMode && isViewMode)
                            }
                          />
                        </div>
                      </div>

                      <div className="form-card" style={{ padding: '10px' }}>
                        {/* File Upload Section */}
                        {isViewMode && !editMode && uploadedFile ? (
                          // VIEW MODE ONLY - Displaying the saved file link
                          <div className="upload-section">
                            <label className="form-label d-block mb-1">
                              Uploaded Journal Article
                            </label>
                            <span className="file-name-display">
                              <a
                                href={getFileUrl(uploadedFile.path)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {uploadedFile.name}
                              </a>
                            </span>
                          </div>
                        ) : (
                          // EDIT or CREATE MODE
                          <div className="upload-section">
                            <label
                              htmlFor="file-upload"
                              className="upload-button"
                            >
                              {/* Dynamically change button text based on whether a file is already present */}
                              {uploadedFile || selectedFile
                                ? 'Change File'
                                : '+ Upload Article'}
                              <input
                                id="file-upload"
                                type="file"
                                onChange={handleFileSelect}
                                // The input is disabled if not in edit mode. You can add other conditions here.
                                disabled={!editMode}
                                style={{ display: 'none' }} // Keep the actual input hidden
                              />
                            </label>

                            {/* Display the name of the selected/uploaded file, or a placeholder */}
                            <span className="file-name-display">
                              {selectedFile || uploadedFile ? (
                                // If a file is selected or already uploaded, show its name as a preview link
                                <a
                                  href={
                                    selectedFile
                                      ? URL.createObjectURL(selectedFile)
                                      : getFileUrl(uploadedFile!.path)
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {selectedFile
                                    ? selectedFile.name
                                    : uploadedFile!.name}
                                </a>
                              ) : (
                                // Placeholder text when no file is chosen
                                'No file selected'
                              )}
                            </span>

                            {/* Delete button - only show when a file is selected/uploaded */}
                            {(selectedFile || uploadedFile) && editMode && (
                              <button
                                type="button"
                                className="btn-delete-file"
                                onClick={handleFileDelete}
                                title="Delete file"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        )}
                        <div className="mt-1"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {/* Submit Button */}
              <div className="text-center mt-4 mb-5">
                <button
                  type="submit"
                  className="btn-submit-approval"
                  disabled={!editMode && isViewMode}
                >
                  Submit for approval
                </button>
              </div>
            </form>
          ) : (
            /* Status Tracking Tab */
            <div>
              {!journalId ? (
                <div className="form-card">
                  <div className="empty-state">
                    <h5>No Journal Found</h5>
                    <p>
                      Please create a journal entry first to track status
                      updates
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status Update Form */}
                  <div className="form-card">
                    <h6 className="form-section-title mb-3">
                      Add Status Update
                    </h6>
                    <form
                      onSubmit={handleStatusUpdateSubmit}
                      className="status-update-form"
                    >
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
                            <option value="revision_requested">
                              Revision Requested
                            </option>
                            <option value="revision_submitted">
                              Revision Submitted
                            </option>
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
                                <td>
                                  {new Date(
                                    update.created_at
                                  ).toLocaleDateString()}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${update.status === 'accepted'
                                      ? 'bg-success'
                                      : update.status === 'rejected'
                                        ? 'bg-danger'
                                        : update.status === 'published'
                                          ? 'bg-primary'
                                          : 'bg-warning'
                                      }`}
                                  >
                                    {update.status
                                      .replace('_', ' ')
                                      .toUpperCase()}
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
          )}
        </div>
      </div>
    );
  } catch (error: any) {
    console.error('Error in JournalForm component:', error);
    return (
      <div className="journal-form-body">
        <Navbar />
        <div className="container journal-form-container">
          <div className="alert alert-danger">
            <h4>Error Loading Form</h4>
            <p>
              There was an error loading the journal form. Please refresh the
              page and try again.
            </p>
            <p>Error details: {error.message}</p>
          </div>
        </div>
      </div>
    );
  }
};

export default JournalForm;