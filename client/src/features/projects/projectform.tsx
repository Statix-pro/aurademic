import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './projectform.css';
import '../../shared/styles/forms.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { Trash2, Plus, ChevronDown } from 'lucide-react';
import CustomFileUploader from '../../shared/components/ui/CustomFileUploader';

import authenticityUtility from '../../shared/utils/authenticityUtility';
import debounce from 'lodash.debounce';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

// Type definitions
interface User {
  id: string;
  author_id: string;
}

interface Investigator {
  id: number;
  author_id: string;
  register_no: string;
  designation: string;
  name: string;
  department: string;
  organization: string;
  country: string;
  is_principal: boolean;
  is_primary: boolean;
}

interface DocumentData {
  enabled: boolean;
  filePath: string;
  file: File | null;
}

interface Documents {
  sanctionOrder: DocumentData;
  utilizationCertificate: DocumentData;
  statementOfExpenditure: DocumentData;
  projectReport: DocumentData;
  bankStatement: DocumentData;
}

interface ProjectDetail {
  enabled: boolean;
  value: string;
}

interface ProjectDetails {
  dateOfPresentation: ProjectDetail;
  dateOfResultAnnouncement: ProjectDetail;
  sanctionOrderAmount: ProjectDetail;
  sanctionOrderDate: ProjectDetail;
  projectDurationStartDate: ProjectDetail;
  projectDurationEndDate: ProjectDetail;
}

interface JournalArticle {
  filePath: string;
  file: File | null;
}

interface FinancialContribution {
  id: number;
  agencyType: string;
  agency: string;
  amount: string;
  agencyTypeSearchTerm: string;
}

interface Collaboration {
  id: number;
  partner: string;
  address: string;
  support: string;
}

interface GrantDisbursement {
  id: number | null;
  tempId?: number;
  isNew?: boolean;
  fy: string;
  agency: string;
  amount: string;
  date: string;
  sanctionLetter: DocumentData;
  ucAndSoE: DocumentData;
}

interface Outcome {
  journals: boolean;
  conference: boolean;
  ipr: boolean;
  technologyTransfer: boolean;
  prototype: boolean;
  product: boolean;
}

interface ValidationErrors {
  title: string;
  agency: string;
  scheme: string;
  duration: string;
  investigators: string;
  financialContributions: string;
  collaborations: string;
  category: string;
  outcome: string;
  dateOfSubmission: string;
  applicationNumber: string;
  projectDetails: string;
  grantDisbursements: string;
  documents: string;
}

interface ProjectRequest {
  request_type: string;
  name: string;
  description: string;
}

interface Duration {
  years: number;
  months: number;
  days: number;
}

interface AuthResponse {
  success?: boolean;
  message?: string;
  status?: string;
  data?: any;
  id?: number;
}

interface SearchResult {
  author_id?: string;
  student_id?: string;
  register_no?: string;
  name: string;
  department: string;
  organization: string;
  country: string;
}

const ResearchProjectForm: React.FC = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState('');
  const [agency, setAgency] = useState('');
  const [scheme, setScheme] = useState('');
  const [agencySearchTerm, setAgencySearchTerm] = useState('');
  const [schemeSearchTerm, setSchemeSearchTerm] = useState('');
  const [duration, setDuration] = useState<Duration>({ years: 0, months: 0, days: 0 });
  const [category, setCategory] = useState<string[]>([]);
  const [journalArticle, setJournalArticle] = useState<JournalArticle>({
    filePath: '',
    file: null,
  });
  const { id: urlProjectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editRequestStatus, setEditRequestStatus] = useState<string | null>(null);
  const [isExistingProject, setIsExistingProject] = useState(false);
  const isViewMode = projectId ? searchParams.get('mode') === 'view' : false;

  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    dateOfPresentation: {
      enabled: false,
      value: '',
    },
    dateOfResultAnnouncement: {
      enabled: false,
      value: '',
    },
    sanctionOrderAmount: {
      enabled: false,
      value: '',
    },
    sanctionOrderDate: {
      enabled: false,
      value: '',
    },
    projectDurationStartDate: {
      enabled: false,
      value: '',
    },
    projectDurationEndDate: {
      enabled: false,
      value: '',
    },
  });

  const [outcome, setOutcome] = useState<Outcome>({
    journals: false,
    conference: false,
    ipr: false,
    technologyTransfer: false,
    prototype: false,
    product: false,
  });
  const [documents, setDocuments] = useState<Documents>({
    sanctionOrder: { enabled: false, filePath: '', file: null },
    utilizationCertificate: { enabled: false, filePath: '', file: null },
    statementOfExpenditure: { enabled: false, filePath: '', file: null },
    projectReport: { enabled: false, filePath: '', file: null },
    bankStatement: { enabled: false, filePath: '', file: null },
  });

  const [principalInvestigatorState, setPrincipalInvestigatorState] =
    useState<Investigator | null>(null);
  const [isCurrentUserPrincipalState, setIsCurrentUserPrincipalState] =
    useState(false);

  const MAX_INVESTIGATORS = 10;
  const [investigatorIndex, setInvestigatorIndex] = useState(2);
  const [searchQueries, setSearchQueries] = useState(
    Array(MAX_INVESTIGATORS).fill('')
  );
  const [searchResults, setSearchResults] = useState<SearchResult[][]>(
    Array(MAX_INVESTIGATORS).fill([])
  );
  const [showSuggestions, setShowSuggestions] = useState(
    Array(MAX_INVESTIGATORS).fill(false)
  );

  const [error, setError] = useState<string | null>(null);
  const [investigators, setInvestigators] = useState<Investigator[]>([
    {
      id: 1,
      designation: 'faculty',
      name: '',
      department: '',
      organization: '',
      country: '',
      is_principal: true,
      is_primary: false,
      register_no: '',
      author_id: '',
    },
  ]);
  const [investigatorDesignations, setInvestigatorDesignations] = useState(
    Array(MAX_INVESTIGATORS).fill('faculty')
  );
  const MAX_FINANCIAL_CONTRIBUTIONS = 10;
  const [financialContributions, setFinancialContributions] = useState<FinancialContribution[]>([
    { id: 1, agencyType: '', agency: '', amount: '', agencyTypeSearchTerm: '' },
  ]);
  const [showAgencyTypeDropdowns, setShowAgencyTypeDropdowns] = useState<{ [key: number]: boolean }>({});

  const [enableCollaboration, setEnableCollaboration] = useState(false);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([
    { id: 1, partner: '', address: '', support: 'Technical' },
  ]);
  const [deletedCollaborations, setDeletedCollaborations] = useState<number[]>([]);
  const [applicationNumber, setApplicationNumber] = useState('');
  const [grantDisbursements, setGrantDisbursements] = useState<GrantDisbursement[]>([]);
  const [deletedGrantDisbursements, setDeletedGrantDisbursements] = useState<number[]>([]);
  const [showProjectRequestModal, setShowProjectRequestModal] = useState(false);
  const [projectRequest, setProjectRequest] = useState<ProjectRequest>({
    request_type: '',
    name: '',
    description: '',
  });
  const [projectRequestLoading, setProjectRequestLoading] = useState(false);
  const [projectRequestError, setProjectRequestError] = useState('');
  const [isFacultyDriven, setIsFacultyDriven] = useState(true);
  const [activeTab, setActiveTab] = useState('form');

  const toggleCategory = () => {
    setIsFacultyDriven(!isFacultyDriven);
  };

  const [dateOfSubmission, setDateOfSubmission] = useState(false);
  const [submissionDate, setSubmissionDate] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('');

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    title: '',
    agency: '',
    scheme: '',
    duration: '',
    investigators: '',
    financialContributions: '',
    collaborations: '',
    category: '',
    outcome: '',
    dateOfSubmission: '',
    applicationNumber: '',
    projectDetails: '',
    grantDisbursements: '',
    documents: '',
  });

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

  useEffect(() => {
    if (projectId) {
      setSearchParams({ mode: editMode ? 'edit' : 'view' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [editMode, projectId, setSearchParams]);

  // Validation functions
  const validateTitle = (): string => {
    if (!title.trim()) {
      return 'Title is required';
    }
    return '';
  };

  const validateApplicationNumber = (): string => {
    if (dateOfSubmission && !applicationNumber.trim()) {
      return 'Application Number is required when Date of Submission is enabled';
    }
    return '';
  };

  const validateAgency = (): string => {
    if (!agency.trim()) {
      return 'Agency is required';
    }
    return '';
  };

  const validateScheme = (): string => {
    if (!scheme.trim()) {
      return 'Scheme is required';
    }
    return '';
  };

  const validateDuration = (): string => {
    if (!duration.years && !duration.months && !duration.days) {
      return 'At least one duration field must be filled';
    }
    return '';
  };

  const validateInvestigators = (): string => {
    if (investigators.length === 0) {
      return 'At least one investigator is required';
    }

    for (const investigator of investigators) {
      if (
        !investigator.author_id ||
        !investigator.name ||
        !investigator.designation ||
        !investigator.department ||
        !investigator.organization
      ) {
        return 'All investigator fields must be filled';
      }
    }

    if (!investigators.some((inv) => inv.is_primary)) {
      return 'Please select a primary investigator';
    }

    return '';
  };

  const validateFinancialContributions = (): string => {
    if (financialContributions.length === 0) {
      return 'At least one financial contribution is required';
    }

    for (const contribution of financialContributions) {
      if (
        !contribution.agencyType ||
        !contribution.agency ||
        !contribution.amount
      ) {
        return 'All financial contribution fields (Agency Type, Agency, Amount) must be filled';
      }
      if (!contribution.agencyType) {
        return 'Please select a valid Agency Type from the suggestions for all contributions.';
      }
    }

    return '';
  };

  const validateCollaborations = (): string => {
    if (enableCollaboration && collaborations.length === 0) {
      return 'At least one collaboration is required when collaboration is enabled';
    }

    if (enableCollaboration) {
      for (const collab of collaborations) {
        if (!collab.partner || !collab.address || !collab.support) {
          return 'All collaboration fields must be filled';
        }
      }
    }

    return '';
  };

  const validateCategory = (): string => {
    if (category.length === 0) {
      return 'Please select at least one category';
    }
    return '';
  };

  const validateOutcome = (): string => {
    if (!Object.values(outcome).some((value) => value)) {
      return 'Please select at least one outcome';
    }
    return '';
  };

  const validateDateOfSubmission = (): string => {
    if (dateOfSubmission) {
      if (!submissionDate) {
        return 'Date of submission is required';
      }
      if (!applicationNumber) {
        return 'Application number is required';
      }
    }
    return '';
  };

  const validateProjectDetails = (): string => {
    if (dateOfSubmission && submissionStatus === 'submitted') {
      for (const [key, detail] of Object.entries(projectDetails)) {
        if (detail.enabled && !detail.value) {
          return `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} is required when enabled`;
        }
      }
    }
    return '';
  };

  const validateGrantDisbursements = (): string => {
    if (dateOfSubmission && submissionStatus === 'submitted') {
      for (const grant of grantDisbursements) {
        if (!grant.fy || !grant.agency || !grant.amount || !grant.date) {
          return 'All fields in grant disbursement are required';
        }
      }
    }
    return '';
  };

  const validateDocuments = (): string => {
    if (dateOfSubmission && submissionStatus === 'submitted') {
      for (const [docType, docData] of Object.entries(documents)) {
        if (docData.enabled && !docData.file) {
          return `${docType.replace(/([A-Z])/g, ' $1').toLowerCase()} document is required when enabled`;
        }
      }
    }
    return '';
  };

  // Search Investigator
  const searchInvestigator = async (query: string, index: number): Promise<void> => {
    if (query.length > 0) {
      try {
        const results: SearchResult[] = await authenticityUtility.get(
          `/authors/search?query=${encodeURIComponent(query)}&_=${Date.now()}`
        );
        setSearchResults((prevResults) => {
          const newResults = [...prevResults];
          newResults[index] = results;
          return newResults;
        });
        setShowSuggestions((prev) => {
          const newShow = [...prev];
          newShow[index] = results.length > 0;
          return newShow;
        });
        setError(null);
      } catch (error) {
        console.error('Error searching for investigator:', error);
        setError('Failed to search for investigators. Please try again.');
        setSearchResults((prevResults) => {
          const newResults = [...prevResults];
          newResults[index] = [];
          return newResults;
        });
        setShowSuggestions((prev) => {
          const newShow = [...prev];
          newShow[index] = false;
          return newShow;
        });
      }
    } else {
      setSearchResults((prevResults) => {
        const newResults = [...prevResults];
        newResults[index] = [];
        return newResults;
      });
      setShowSuggestions((prev) => {
        const newShow = [...prev];
        newShow[index] = false;
        return newShow;
      });
    }
  };

  useEffect(() => {
    const delayDebounceFn = searchQueries.map((query, index) =>
      setTimeout(() => searchInvestigator(query, index), 300)
    );

    return () => delayDebounceFn.forEach(clearTimeout);
  }, [searchQueries]);

  useEffect(() => {
    setInvestigators((prevInvestigators) =>
      prevInvestigators.map((inv, index) => ({
        ...inv,
        is_principal: index === 0,
      }))
    );
  }, []);

  useEffect(() => {
    // Find the principal investigator from the current investigators state
    const foundPI = investigators.find((inv) => {
      return inv.is_principal === true; // Explicitly check for boolean true
    });

    setPrincipalInvestigatorState(foundPI || null); // Store the found PI or null

    // Check if the current user is the principal investigator
    const check = !!(user && foundPI && user.author_id === foundPI.author_id);
    setIsCurrentUserPrincipalState(check);
  }, [investigators, user]);

  const computeDesignation = (investigator: any): string => {
    const inv = investigator || {};
    if (inv.student_id || inv.register_no) return 'student';
    if (inv.author_id) return 'faculty';
    return (inv.designation || 'faculty').toLowerCase();
  };

  const handleInvestigatorSelect = (selectedInvestigator: SearchResult, index: number): void => {
    // Determine the correct ID to use based on designation
    const normalizedDesignation = computeDesignation(selectedInvestigator);
    const computedInvestigatorId =
      normalizedDesignation === 'student'
        ? selectedInvestigator.student_id ||
        selectedInvestigator.register_no ||
        ''
        : selectedInvestigator.author_id || '';

    if (!selectedInvestigator || !computedInvestigatorId) {
      console.error(
        'Invalid investigator selected or missing ID:',
        selectedInvestigator
      );
      return;
    }

    setInvestigators((prevInvestigators) => {
      const updatedInvestigators = [...prevInvestigators];
      const originalInvestigatorData = updatedInvestigators[index];

      updatedInvestigators[index] = {
        ...originalInvestigatorData,
        author_id:
          normalizedDesignation === 'faculty' ? computedInvestigatorId : '',
        register_no:
          normalizedDesignation === 'student' ? computedInvestigatorId : '',
        name: selectedInvestigator.name,
        department: selectedInvestigator.department,
        organization: selectedInvestigator.organization,
        country: selectedInvestigator.country,
        designation: normalizedDesignation,
      };
      return updatedInvestigators;
    });

    setSearchQueries((prevQueries) => {
      const newQueries = [...prevQueries];
      newQueries[index] = computedInvestigatorId || ''; // Use the ID, not the name
      return newQueries;
    });

    setShowSuggestions((prev) => {
      const newShow = [...prev];
      newShow[index] = false;
      return newShow;
    });
    setInvestigatorDesignations((prevDesignations) => {
      const newDesignations = [...prevDesignations];
      newDesignations[index] = normalizedDesignation;
      return newDesignations;
    });
  };

  // Function to handle search input changes for investigators
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number): void => {
    const newValue = e.target.value;
    setSearchQueries((prevQueries) => {
      const newQueries = [...prevQueries];
      newQueries[index] = newValue;
      return newQueries;
    });

    setInvestigators((prevInvestigators) => {
      const newInvestigators = [...prevInvestigators];
      if (newInvestigators[index]) {
        newInvestigators[index] = {
          ...newInvestigators[index],
          author_id: '',
          register_no: '',
          name: '',
          organization: '',
          department: '',
          country: '',
        };
      }
      return newInvestigators;
    });
  };

  // Function to add a new investigator
  const addInvestigator = (): void => {
    if (investigators.length < MAX_INVESTIGATORS) {
      setInvestigators((prevInvestigators) => {
        const newInvestigator: Investigator = {
          id: investigatorIndex,
          author_id: '',
          designation: 'faculty', // Default to faculty
          name: '',
          department: '',
          organization: '',
          country: '',
          is_principal: false,
          is_primary: false,
          register_no: '',
        };

        // Make sure first investigator is always principal
        return [
          ...prevInvestigators.map((inv, index) => ({
            ...inv,
            is_principal: index === 0,
          })),
          newInvestigator,
        ];
      });
      setInvestigatorIndex((prevIndex) => prevIndex + 1);
      setSearchQueries((prevQueries) => [...prevQueries, '']);
      setSearchResults((prevResults) => [...prevResults, []]);
      setShowSuggestions((prev) => [...prev, false]);
      setInvestigatorDesignations((prev) => [...prev, 'faculty']);
    }
  };

  // Function to handle investigator designation change
  const handleDesignationChange = (index: number, value: string): void => {
    setInvestigatorDesignations((prevDesignations) => {
      const newDesignations = [...prevDesignations];
      newDesignations[index] = value;
      return newDesignations;
    });

    setInvestigators((prevInvestigators) => {
      const updatedInvestigators = [...prevInvestigators];
      updatedInvestigators[index] = {
        ...updatedInvestigators[index],
        designation: value,
        author_id: '',
        register_no: '',
        name: '',
        department: '',
        organization: '',
        country: '',
      };
      return updatedInvestigators;
    });

    setSearchQueries((prevQueries) => {
      const newQueries = [...prevQueries];
      newQueries[index] = '';
      return newQueries;
    });
    setSearchResults((prevResults) => {
      const newResults = [...prevResults];
      newResults[index] = [];
      return newResults;
    });
  };

  // Function to remove an investigator
  const removeInvestigator = (id: number): void => {
    if (id === 1) return;
    setInvestigators((prevInvestigators) => {
      const newInvestigators = prevInvestigators.filter(
        (investigator) => investigator.id !== id
      );
      return newInvestigators;
    });
    setInvestigatorIndex((prevIndex) => Math.max(2, prevIndex - 1));
    setSearchQueries((prevQueries) =>
      prevQueries.filter((_, index) => index !== id - 1)
    );
    setSearchResults((prevResults) =>
      prevResults.filter((_, index) => index !== id - 1)
    );
    setShowSuggestions((prev) => prev.filter((_, index) => index !== id - 1));
  };

  // Function to handle investigator input changes
  const handleInputChange = (index: number, field: string, value: string): void => {
    setInvestigators((prevInvestigators) => {
      const updatedInvestigators = [...prevInvestigators];
      updatedInvestigators[index] = {
        ...updatedInvestigators[index],
        [field]: value,
      };
      return updatedInvestigators;
    });
  };

  const handlePrimarySelection = (selectedIndex: number): void => {
    setInvestigators((prevInvestigators) =>
      prevInvestigators.map((inv, index) => ({
        ...inv,
        is_primary: index === selectedIndex,
      }))
    );
  };

  // Function to render investigator fields based on designation
  const renderInvestigatorFields = (investigator: Investigator, index: number): JSX.Element => {
    const designationLower = (
      investigatorDesignations[index] ||
      investigator.designation ||
      'faculty'
    ).toLowerCase();

    const inputProps = {
      disabled: isFormDisabled,
    };

    if (designationLower === 'student') {
      return (
        <>
          <div className="investigator-input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Register No."
              name="register_no"
              value={investigator.register_no || ''}
              onChange={(e) =>
                handleInputChange(index, e.target.name, e.target.value)
              }
              {...inputProps}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Name"
              name="name"
              value={investigator.name || ''}
              onChange={(e) =>
                handleInputChange(index, e.target.name, e.target.value)
              }
              {...inputProps}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Department"
              name="department"
              value={investigator.department || ''}
              onChange={(e) =>
                handleInputChange(index, e.target.name, e.target.value)
              }
              {...inputProps}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Organization"
              name="organization"
              value={investigator.organization || 'K.S.Rangasamy College of Technology'}
              onChange={(e) =>
                handleInputChange(index, e.target.name, e.target.value)
              }
              {...inputProps}
              readOnly
            />
            <input
              type="text"
              className="form-control"
              placeholder="Country"
              name="country"
              value={investigator.country || 'India'}
              onChange={(e) =>
                handleInputChange(index, e.target.name, e.target.value)
              }
              {...inputProps}
              readOnly
            />
          </div>
        </>
      );
    }

    if (designationLower === 'external') {
      return (
        <>
          <div className="investigator-input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Name"
              name="name"
              value={investigator.name || ''}
              onChange={(e) =>
                handleInputChange(index, e.target.name, e.target.value)
              }
              {...inputProps}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Department"
              name="department"
              value={investigator.department || ''}
              onChange={(e) =>
                handleInputChange(index, e.target.name, e.target.value)
              }
              {...inputProps}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Organization"
              name="organization"
              value={investigator.organization || ''}
              onChange={(e) =>
                handleInputChange(index, e.target.name, e.target.value)
              }
              {...inputProps}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Country"
              name="country"
              value={investigator.country || ''}
              onChange={(e) =>
                handleInputChange(index, e.target.name, e.target.value)
              }
              {...inputProps}
            />
          </div>
        </>
      );
    }

    // Default: Faculty - search with readonly fields
    return (
      <>
        <div className="investigator-input-group">
          <div className="investigator-search-container">
            <input
              type="text"
              className="form-control"
              placeholder="Search or Enter Author ID"
              value={searchQueries[index] || investigator.author_id}
              onChange={(e) => handleSearchInputChange(e, index)}
              {...inputProps}
            />
            {showSuggestions[index] &&
              searchResults[index].length > 0 &&
              !(investigator.author_id || investigator.register_no) && (
                <ul className="investigator-suggestions-list">
                  {searchResults[index].map((result) => (
                    <li
                      key={result.author_id || result.student_id}
                      className="list-group-item list-group-item-action"
                      onClick={() => handleInvestigatorSelect(result, index)}
                      style={{ cursor: 'pointer' }}
                    >
                      {result.author_id || result.student_id} - {result.name} - {result.organization}
                      {result.department && ` - ${result.department}`}
                    </li>
                  ))}
                </ul>
              )}
          </div>
          <input
            type="text"
            className="form-control"
            placeholder="Name"
            value={investigator.name || ''}
            readOnly
          />
          <input
            type="text"
            className="form-control"
            placeholder="Department"
            value={investigator.department || ''}
            readOnly
          />
          <input
            type="text"
            className="form-control"
            placeholder="Organization"
            value={investigator.organization || ''}
            readOnly
          />
          <input
            type="text"
            className="form-control"
            placeholder="Country"
            value={investigator.country || ''}
            readOnly
          />
        </div>
      </>
    );
  };

  const addFinancialContribution = (): void => {
    if (financialContributions.length < MAX_FINANCIAL_CONTRIBUTIONS) {
      setFinancialContributions([
        ...financialContributions,
        {
          id: financialContributions.length + 1,
          agencyType: '',
          agency: '',
          amount: '',
          agencyTypeSearchTerm: '',
        },
      ]);
    } else {
      alert(
        `You can add maximum ${MAX_FINANCIAL_CONTRIBUTIONS} Financial Contributions.`
      );
    }
  };

  const toggleCollaboration = (): void => {
    setEnableCollaboration(!enableCollaboration);
  };

  const addCollaboration = (): void => {
    setCollaborations((prev) => [
      ...prev,
      {
        id: Date.now(), // Use timestamp for unique ID
        partner: '',
        address: '',
        support: 'Technical',
      },
    ]);
  };

  const removeCollaboration = async (id: number): Promise<void> => {
    const updatedCollaborations = collaborations.filter(
      (collaboration) => collaboration.id !== id
    );
    setCollaborations(updatedCollaborations);

    // Only try to delete from backend if projectId exists and the collaboration has a numeric ID
    if (projectId && typeof id === 'number') {
      try {
        await authenticityUtility.delete(
          `/projects/${projectId}/collaborations/${id}`
        );
      } catch (error) {
        console.error('Error deleting collaboration from backend:', error);
      }
    }
  };

  const handleCollaborationChange = (id: number, field: string, value: string): void => {
    setCollaborations(
      collaborations.map((collaboration) => {
        if (collaboration.id === id) {
          return { ...collaboration, [field]: value };
        }
        return collaboration;
      })
    );
  };

  const handleJournalArticleUpload = (file: File): void => {
    const filePath = `uploads/journal-articles/${file.name}`;
    setJournalArticle({ filePath, file });
  };

  const handleJournalArticleDelete = (): void => {
    setJournalArticle({ filePath: '', file: null });
  };

  const addGrantDisbursement = (): void => {
    const newDisbursement: GrantDisbursement = {
      id: null, // Initialize id to null, it will come from the backend
      tempId: Date.now(), // Add a temporary ID for state tracking before saving
      isNew: true,
      fy: '',
      agency: '',
      amount: '',
      date: '',
      sanctionLetter: { enabled: false, filePath: '', file: null },
      ucAndSoE: { enabled: false, filePath: '', file: null },
    };
    setGrantDisbursements((prev) => [...prev, newDisbursement]);
  };

  // When saving the project, handle new disbursements:
  const saveDisbursements = async (): Promise<void> => {
    for (const disbursement of grantDisbursements) {
      if (disbursement.isNew) {
        // POST new disbursement
        const { tempId, ...newData } = disbursement;
        const response: AuthResponse = await authenticityUtility.post(
          `/projects/${projectId}/grant-disbursements`,
          newData
        );
        // Update state with real ID
        setGrantDisbursements((prev) =>
          prev.map((d) =>
            d.tempId === tempId ? { ...response.data, isNew: false } : d
          )
        );
      }
    }
  };

  const removeGrantDisbursement = async (index: number): Promise<void> => {
    const disbursementToDelete = grantDisbursements[index];
    if (!disbursementToDelete) {
      console.error(`No disbursement found at index ${index}`);
      return;
    }

    if (disbursementToDelete.id) {
      // Call API to delete from backend if it has an ID
      try {
        await authenticityUtility.delete(
          `/projects/${projectId}/grant-disbursements/${disbursementToDelete.id}`
        );
        //  console.log(`Disbursement with ID ${disbursementToDelete.id} deleted from backend`);
      } catch (error) {
        console.error('Error deleting disbursement from backend:', error);
        // Optionally handle error, like showing a message to the user
      }
    }

    // Update frontend state
    const updatedDisbursements = grantDisbursements.filter(
      (_, i) => i !== index
    );
    setGrantDisbursements(updatedDisbursements);
  };

  // Handle OUTCOME checkbox change
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { id, checked } = e.target;
    setOutcome((prevOutcome) => ({
      ...prevOutcome,
      [id]: checked,
    }));
  };

  const handleFileUpload = (file: File, docType: string): void => {
    if (
      docType.startsWith('sanctionLetter') ||
      docType.startsWith('ucAndSoE')
    ) {
      const idPartMatcher = /(\d+)$/; // Regex to find numbers at the end
      const match = docType.match(idPartMatcher);
      const idFromDocTypeString = match ? match[0] : null;

      if (idFromDocTypeString) {
        const updatedGrantDisbursements = grantDisbursements.map((g) => {
          // Check if current grant 'g' matches the idFromDocTypeString (could be g.id or g.tempId)
          const matchesId =
            g.id != null && g.id.toString() === idFromDocTypeString;
          const matchesTempId =
            g.tempId != null && g.tempId.toString() === idFromDocTypeString;

          if (matchesId || matchesTempId) {
            const updatedGrant = { ...g }; // Clone the grant to modify
            if (docType.startsWith('sanctionLetter')) {
              updatedGrant.sanctionLetter = {
                ...updatedGrant.sanctionLetter,
                enabled: true,
                file,
                filePath: '',
              }; // Clear filePath
            } else {
              // ucAndSoE
              updatedGrant.ucAndSoE = {
                ...updatedGrant.ucAndSoE,
                enabled: true,
                file,
                filePath: '',
              }; // Clear filePath
            }
            return updatedGrant;
          }
          return g; // Return unmodified grant if no match
        });
        setGrantDisbursements(updatedGrantDisbursements);
      } else {
        console.error(
          'Could not extract ID from docType for grant file:',
          docType
        );
      }
    } else {
      // For other documents (non-grant specific)
      const baseDocType = docType.replace(/\d+$/, '');
      setDocuments((prev) => ({
        ...prev,
        [baseDocType]: {
          ...prev[baseDocType as keyof Documents],
          file,
          filePath: '', // Clear filePath on new upload
        },
      }));
    }
  };

  const handleFileDelete = (docType: string): void => {
    if (
      docType.startsWith('sanctionLetter') ||
      docType.startsWith('ucAndSoE')
    ) {
      const idPartMatcher = /(\d+)$/;
      const match = docType.match(idPartMatcher);
      const idFromDocTypeString = match ? match[0] : null;

      if (idFromDocTypeString) {
        const updatedGrantDisbursements = grantDisbursements.map((g) => {
          const matchesId =
            g.id != null && g.id.toString() === idFromDocTypeString;
          const matchesTempId =
            g.tempId != null && g.tempId.toString() === idFromDocTypeString;

          if (matchesId || matchesTempId) {
            const updatedGrant = { ...g };
            if (docType.startsWith('sanctionLetter')) {
              updatedGrant.sanctionLetter = {
                ...updatedGrant.sanctionLetter,
                file: null,
                filePath: '',
              };
            } else {
              updatedGrant.ucAndSoE = {
                ...updatedGrant.ucAndSoE,
                file: null,
                filePath: '',
              };
            }
            return updatedGrant;
          }
          return g;
        });
        setGrantDisbursements(updatedGrantDisbursements);
      }
    } else {
      const baseDocType = docType.replace(/\d+$/, '');
      setDocuments((prev) => ({
        ...prev,
        [baseDocType]: {
          ...prev[baseDocType as keyof Documents],
          file: null,
          filePath: '',
        },
      }));
    }
  };

  const handleDocumentToggle = (docType: string): void => {
    setDocuments((prev) => ({
      ...prev,
      [docType]: {
        ...prev[docType as keyof Documents],
        enabled: !prev[docType as keyof Documents].enabled,
        filePath: !prev[docType as keyof Documents].enabled ? prev[docType as keyof Documents].filePath : '',
        file: !prev[docType as keyof Documents].enabled ? prev[docType as keyof Documents].file : null,
      },
    }));
  };

  const getFileUrl = (filePath: string): string => {
    if (!filePath) return '#';
    const baseUrl = authenticityUtility.getBaseURL().replace(/\/$/, '');
    return `${baseUrl}/${filePath}`;
  };

  const handleDateOfSubmissionToggle = (): void => {
    setDateOfSubmission(!dateOfSubmission);
    if (dateOfSubmission) {
      setSubmissionStatus('waiting');
      setSubmissionDate('');
    }
  };

  const handleSubmissionDateChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSubmissionDate(e.target.value);
  };

  const handleSubmissionStatusChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSubmissionStatus(e.target.value);
  };

  const handleProjectDetailsToggle = (field: string): void => {
    setProjectDetails((prev) => ({
      ...prev,
      [field]: {
        ...prev[field as keyof ProjectDetails],
        enabled: !prev[field as keyof ProjectDetails].enabled,
      },
    }));
  };

  const handleProjectDetailsChange = (field: string, value: string): void => {
    setProjectDetails((prev) => ({
      ...prev,
      [field]: {
        ...prev[field as keyof ProjectDetails],
        value: value,
      },
    }));
  };

  const handleFinancialContributionChange = (index: number, field: string, value: string): void => {
    const newContributions = [...financialContributions];
    // Don't handle agencyType or agencyTypeSearchTerm here anymore
    if (field !== 'agencyType' && field !== 'agencyTypeSearchTerm') {
      (newContributions[index] as any)[field] = value;
      setFinancialContributions(newContributions);
    }
  };

  const removeFinancialContribution = async (indexToRemove: number): Promise<void> => {
    const contributionToDelete = financialContributions[indexToRemove];
    if (!contributionToDelete) {
      console.error(
        `No financial contribution found at index ${indexToRemove}`
      );
      return;
    }

    // If it has an ID and projectId exists, try to delete from backend
    if (contributionToDelete.id && projectId) {
      try {
        await authenticityUtility.delete(
          `/projects/${projectId}/contributions/${contributionToDelete.id}`
        );
      } catch (error) {
        console.error(
          'Error deleting financial contribution from backend:',
          error
        );
        // Continue with frontend deletion even if backend fails
      }
    }

    // Always update frontend state (whether backend call succeeded or failed)
    const updatedContributions = financialContributions.filter(
      (_, index) => index !== indexToRemove
    );
    setFinancialContributions(updatedContributions);
  };

  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const handleEditRequest = async (): Promise<void> => {
    if (!projectId) return;
    try {
      const response: AuthResponse = await authenticityUtility.post(
        `/edit-requests/research_projects/${projectId}`
      );

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

  const checkEditRequestStatus = async (): Promise<void> => {
    if (!projectId) return;

    try {
      const response: AuthResponse = await authenticityUtility.get(
        `/edit-requests/research_projects/${projectId}?_=${Date.now()}`
      );

      if (response && response.data) {
        const status = response.data.status;
        setEditRequestStatus(status);

        if (status === 'approved') {
          setEditMode(true);
        } else {
          setEditMode(false);
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

  useEffect(() => {
    if (urlProjectId) {
      setProjectId(urlProjectId);
      setIsExistingProject(true);
    } else {
      setIsExistingProject(false);
      setEditMode(true); // Enable edit mode for new projects
      setEditRequestStatus(null);
    }
  }, [urlProjectId]);

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
      checkEditRequestStatus();
    }
  }, [projectId]);

  // Add this new useEffect to handle editMode based on editRequestStatus
  useEffect(() => {
    if (projectId) {
      if (editRequestStatus === 'approved') {
        setEditMode(true);
      } else {
        setEditMode(false);
      }
    }
  }, [editRequestStatus, projectId]);

  const fetchProjectDetails = async (): Promise<void> => {
    if (!projectId) {
      console.error('Invalid projectId:', projectId);
      setError('Invalid project ID');
      return;
    }
    try {
      const response: AuthResponse = await authenticityUtility.get(`/projects/${projectId}`);
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }
      const projectData = response.data;

      // Add this line
      checkEditRequestStatus();

      // Basic project details
      setTitle(projectData.title || '');
      setIsFacultyDriven(projectData.project_category === 'Faculty Driven');

      // Set agency and scheme
      setAgency(projectData.agency_name || '');
      setScheme(projectData.scheme_name || '');
      setAgencySearchTerm(projectData.agency_name || '');
      setSchemeSearchTerm(projectData.scheme_name || '');

      // Set duration
      setDuration({
        years: projectData.duration_years || 0,
        months: projectData.duration_months || 0,
        days: projectData.duration_days || 0,
      });

      // Set category - parse if it's a string, or use as is if it's already an array
      setCategory(
        typeof projectData.category === 'string'
          ? projectData.category.split(',').map((c: string) => c.trim())
          : projectData.category ? [projectData.category] : []
      );

      // Set application number
      setApplicationNumber(projectData.application_number || '');

      // Handle submission details
      if (projectData.date_of_submission) {
        setDateOfSubmission(true);
        setSubmissionDate(formatDateForInput(projectData.date_of_submission));
        setSubmissionStatus(projectData.submission_status || 'waiting');
      }

      // Set collaboration status and data
      setEnableCollaboration(projectData.is_collaboration_enabled === 1);
      if (projectData.collaborations) {
        setCollaborations(
          projectData.collaborations.map((collaboration: any) => ({
            id: collaboration.id, // Ensure ID is preserved
            partner: collaboration.partner || '',
            address: collaboration.address || '',
            support: collaboration.support || '',
          }))
        );
      } else {
        setCollaborations([]);
      }

      // Set financial contributions
      if (projectData.financial_contributions) {
        try {
          const contributionsData =
            typeof projectData.financial_contributions === 'string'
              ? JSON.parse(projectData.financial_contributions)
              : projectData.financial_contributions;

          const updatedContributions = contributionsData.map(
            (contribution: any) => ({
              ...contribution,
              agencyType: contribution.agency_type || '',
              agencyTypeSearchTerm: contribution.agency_type || '', // Initialize search term
            })
          );
          setFinancialContributions(updatedContributions);
        } catch (e) {
          console.error('Error parsing financial contributions:', e);
        }
      }
      // Set investigators
      if (projectData.investigators) {
        try {
          const investigatorsData = Array.isArray(projectData.investigators)
            ? projectData.investigators
            : JSON.parse(projectData.investigators);

          let updatedInvestigators = investigatorsData.map((inv: any) => {
            return {
              ...inv,
              is_principal: inv.is_principal === 1 || inv.is_principal === true,
              is_primary: inv.is_primary === 1 || inv.is_primary === true,
            };
          });
          // Ensure the first investigator is always principal, regardless of backend data
          if (updatedInvestigators.length > 0) {
            updatedInvestigators[0] = {
              ...updatedInvestigators[0],
              is_principal: true,
            };
            // Optional: If only one investigator, ensure they are also primary
            if (updatedInvestigators.length === 1) {
              updatedInvestigators[0] = {
                ...updatedInvestigators[0],
                is_primary: true,
              };
            }
          }

          setInvestigators(updatedInvestigators); // This triggers the useEffect
        } catch (e) {
          console.error(
            'fetchProjectDetails - Error processing investigators:',
            e
          );
          // Reset investigators to default if processing fails
          setInvestigators([
            {
              id: 1,
              designation: 'faculty',
              name: '',
              department: '',
              organization: '',
              country: '',
              is_principal: true,
              is_primary: false,
              register_no: '',
              author_id: '',
            },
          ]);
        }
      } else {
        console.warn(
          'fetchProjectDetails - No investigators data found in projectData.'
        );
        // Reset investigators to default if none are found
        setInvestigators([
          {
            id: 1,
            designation: 'faculty',
            name: '',
            department: '',
            organization: '',
            country: '',
            is_principal: true,
            is_primary: false,
            register_no: '',
            author_id: '',
          },
        ]);
      }

      // Set journal article
      if (projectData.file_path) {
        setJournalArticle({
          filePath: projectData.file_path,
          file: null,
        });
      }

      // Handle project details
      setProjectDetails({
        dateOfPresentation: {
          enabled: !!projectData.date_of_presentation,
          value: formatDateForInput(projectData.date_of_presentation),
        },
        dateOfResultAnnouncement: {
          enabled: !!projectData.date_of_result_announcement,
          value: formatDateForInput(projectData.date_of_result_announcement),
        },
        sanctionOrderAmount: {
          enabled: !!projectData.sanction_order_amount,
          value: projectData.sanction_order_amount || '',
        },
        sanctionOrderDate: {
          enabled: !!projectData.sanction_order_date,
          value: formatDateForInput(projectData.sanction_order_date),
        },
        projectDurationStartDate: {
          enabled: !!projectData.project_duration_start_date,
          value: formatDateForInput(projectData.project_duration_start_date),
        },
        projectDurationEndDate: {
          enabled: !!projectData.project_duration_end_date,
          value: formatDateForInput(projectData.project_duration_end_date),
        },
      });

      // Set grant disbursements
      if (projectData.grant_disbursements) {
        try {
          let disbursementsData = Array.isArray(projectData.grant_disbursements)
            ? projectData.grant_disbursements
            : JSON.parse(projectData.grant_disbursements);

          // Ensure each disbursement has the required properties
          disbursementsData = disbursementsData.map((grant: any) => ({
            id: grant.id,
            isNew: false, // Add this flag for existing records
            fy: grant.fiscal_year || '',
            agency: grant.agency || '',
            amount: grant.amount || '',
            date: grant.disbursement_date
              ? formatDateForInput(grant.disbursement_date)
              : '',
            sanctionLetter: {
              enabled: !!grant.sanction_letter_path,
              filePath: grant.sanction_letter_path || '',
              file: null,
            },
            ucAndSoE: {
              enabled: !!grant.uc_and_soe_path,
              filePath: grant.uc_and_soe_path || '',
              file: null,
            },
          }));

          setGrantDisbursements(disbursementsData);
        } catch (e) {
          console.error('Error parsing grant disbursements:', e);
        }
      }

      // Set documents
      if (projectData.documents && Array.isArray(projectData.documents)) {
        const updatedDocuments: Documents = {
          sanctionOrder: { enabled: false, filePath: '', file: null },
          utilizationCertificate: { enabled: false, filePath: '', file: null },
          statementOfExpenditure: { enabled: false, filePath: '', file: null },
          projectReport: { enabled: false, filePath: '', file: null },
          bankStatement: { enabled: false, filePath: '', file: null },
        };

        if (projectData.documents && Array.isArray(projectData.documents)) {
          projectData.documents.forEach((doc: any) => {
            const documentTypeMap: { [key: string]: keyof Documents } = {
              sanction_order: 'sanctionOrder',
              utilization_certificate: 'utilizationCertificate',
              statement_of_expenditure: 'statementOfExpenditure',
              project_report: 'projectReport',
              bank_statement: 'bankStatement',
            };

            const cleanedType = doc.document_type.replace(/ /g, '_').toLowerCase();
            const frontendDocType = documentTypeMap[cleanedType];
            if (frontendDocType && doc.file_path) {
              updatedDocuments[frontendDocType] = {
                enabled: true,
                filePath: doc.file_path,
                file: { existing: true } as any,
              };
            }
          });
        }

        setDocuments(updatedDocuments);
      }

      // Set outcome
      if (projectData.outcome_type) {
        const outcomeTypes =
          typeof projectData.outcome_type === 'string'
            ? projectData.outcome_type.split(',').map((t: string) => t.trim())
            : [projectData.outcome_type];

        setOutcome({
          journals: outcomeTypes.includes('journals'),
          conference: outcomeTypes.includes('conference'),
          ipr: outcomeTypes.includes('ipr'),
          technologyTransfer: outcomeTypes.includes('technologyTransfer'),
          prototype: outcomeTypes.includes('prototype'),
          product: outcomeTypes.includes('product'),
        });
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
      setError('Failed to fetch project details');
    }
  };

  //   // Determine if the form should be globally disabled
  const isFormDisabled =
    (isViewMode && !editMode) || // Always disable in pure view mode
    (isViewMode && editMode && !isCurrentUserPrincipalState); // Use state variable

  const inputProps = isFormDisabled ? { disabled: true } : {};
  // Add this to disable all inputs in view mode
  // const inputProps = isViewMode && !editMode ? { disabled: true } : {};

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    // Collect all validation errors
    const errors: ValidationErrors = {
      title: validateTitle(),
      agency: validateAgency(),
      scheme: validateScheme(),
      duration: validateDuration(),
      investigators: validateInvestigators(),
      financialContributions: validateFinancialContributions(),
      collaborations: validateCollaborations(),
      category: validateCategory(),
      outcome: submissionStatus === 'submitted' ? validateOutcome() : '', // Validate outcome only if submissionStatus is 'submitted'
      dateOfSubmission: validateDateOfSubmission(),
      projectDetails: validateProjectDetails(),
      grantDisbursements: validateGrantDisbursements(),
      applicationNumber: validateApplicationNumber(),
      documents: validateDocuments(),
    };

    // Filter out empty error messages
    const activeErrors = Object.entries(errors)
      .filter(([_, value]) => value !== '')
      .map(([field, message]) => `${field}: ${message}`);

    // Update validation errors state
    setValidationErrors(errors);

    // If there are any validation errors, display them and stop submission
    if (activeErrors.length > 0) {
      alert('Please fix the following errors:\n\n' + activeErrors.join('\n'));
      return;
    }

    try {
      // Format project details for the details endpoint (which may update an existing details record)
      const formattedProjectDetails = {
        date_of_presentation: projectDetails.dateOfPresentation.enabled
          ? projectDetails.dateOfPresentation.value
          : null,
        date_of_result_announcement: projectDetails.dateOfResultAnnouncement
          .enabled
          ? projectDetails.dateOfResultAnnouncement.value
          : null,
        sanction_order_amount: projectDetails.sanctionOrderAmount.enabled
          ? parseFloat(projectDetails.sanctionOrderAmount.value)
          : null,
        sanction_order_date: projectDetails.sanctionOrderDate.enabled
          ? projectDetails.sanctionOrderDate.value
          : null,
        project_duration_start_date: projectDetails.projectDurationStartDate
          .enabled
          ? projectDetails.projectDurationStartDate.value
          : null,
        project_duration_end_date: projectDetails.projectDurationEndDate.enabled
          ? projectDetails.projectDurationEndDate.value
          : null,
      };

      const projectData = {
        project_category: isFacultyDriven ? 'Faculty Driven' : 'Student Driven',
        title,
        agency,
        scheme,
        duration_years: duration.years,
        duration_months: duration.months,
        duration_days: duration.days,
        category: category.join(', '),
        is_collaboration_enabled: enableCollaboration,
        collaborations: JSON.stringify(
          enableCollaboration ? collaborations : []
        ),
        date_of_submission: submissionDate,
        submission_status: submissionStatus,
        application_number: applicationNumber,
        // grant_disbursements: grantDisbursements,
        financial_contributions: JSON.stringify(financialContributions),
        // financial_contributions: financialContributions,
        project_details: JSON.stringify(projectDetails),
        // project_details: formattedProjectDetails,
        outcome: JSON.stringify(outcome),
        documents: JSON.stringify(documents),
        // documents: uploadedFiles,
        // collaborations: collaborations
      };
      let response: AuthResponse;
      let newProjectId: string;
      if (projectId) {
        await saveDisbursements();
      }

      if (projectId) {
        // Update existing project
        response = await authenticityUtility.put(
          `/projects/${projectId}`,
          projectData
        );
        newProjectId = projectId;
      } else {
        // Create new project
        response = await authenticityUtility.post('/projects', projectData);
        newProjectId = response.data ? response.data.id : response.id;

        if (!newProjectId) {
          throw new Error('Failed to get project ID from response');
        }
      }
      // Add investigators
      for (const investigator of investigators) {
        if (!investigator?.author_id) {
          throw new Error(`Missing or invalid data for investigator`);
        }
        const authorData = {
          // id: i + 1,
          author_id: investigator.author_id,
          designation: investigator.designation,
          name: investigator.name,
          department: investigator.department,
          organization: investigator.organization,
          country: investigator.country,
          is_principal: investigator.is_principal,
          is_primary: investigator.is_primary,
        };

        try {
          await authenticityUtility.post(
            `/projects/${newProjectId}/authors`,
            authorData
          );
        } catch (error: any) {
          throw new Error(
            `Failed to add investigator ${investigator.name}: ${error.message}`
          );
        }
      }

      // Add financial contributions if any
      if (financialContributions?.length > 0) {
        for (const contribution of financialContributions) {
          await authenticityUtility.post(
            `/projects/${newProjectId}/contributions`,
            contribution
          );
        }
      }

      try {
        // Add project details (this endpoint might work similarly for both create and update)
        await authenticityUtility.post(
          `/projects/${newProjectId}/details`,
          formattedProjectDetails
        );
      } catch (error) {
        console.error('Error adding project details:', error);
      }
      // Upload documents
      if (documents && newProjectId) {
        for (const [docType, data] of Object.entries(documents)) {
          if (data.enabled && data.file && !(data.file as any).existing) {
            const formData = new FormData();
            formData.append('file', data.file);
            formData.append('document_type', docType);
            // formData.append('file_path', data.filePath);

            try {
              await authenticityUtility.postFile(
                `/projects/${newProjectId}/upload`,
                formData
              );
            } catch (error) {
              console.error(`Error uploading document ${docType}:`, error);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error submitting research project:', error);

      // Provide more detailed error message to user
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'An unexpected error occurred';
      alert(`Error submitting research project: ${errorMessage}`);

      // Log detailed error information for debugging
      console.error('Detailed error:', {
        message: error.message,
        response: error.response,
        stack: error.stack,
      });
    }
  };

  // Add new state variables
  const [agencyOptions, setAgencyOptions] = useState<any[]>([]);
  const [schemeOptions, setSchemeOptions] = useState<any[]>([]);
  const [agencyTypeOptions, setAgencyTypeOptions] = useState<any[]>([]);
  const [showAgencyDropdown, setShowAgencyDropdown] = useState(false);
  const [showSchemeDropdown, setShowSchemeDropdown] = useState(false);

  // Add debounced search functions
  const searchAgencies = useCallback(
    async (query: string) => {
      try {
        const response: any[] = await authenticityUtility.get(
          `/project-options/agencies/search?query=${query}`
        );
        setAgencyOptions(response);
        setShowAgencyDropdown(true);
      } catch (error) {
        console.error('Error searching agencies:', error);
      }
    },
    [setAgencyOptions, setShowAgencyDropdown]
  );

  const debouncedSearchAgencies = useMemo(
    () => debounce(searchAgencies, 300),
    [searchAgencies]
  );

  const searchSchemes = useCallback(
    async (query: string) => {
      try {
        const response: any[] = await authenticityUtility.get(
          `/project-options/schemes/search?query=${query}`
        );
        setSchemeOptions(response);
        setShowSchemeDropdown(true);
      } catch (error) {
        console.error('Error searching schemes:', error);
      }
    },
    [setSchemeOptions, setShowSchemeDropdown]
  );

  const debouncedSearchSchemes = useMemo(
    () => debounce(searchSchemes, 300),
    [searchSchemes]
  );

  const searchAgencyTypes = useCallback(
    async (query: string) => {
      // No index needed if options are global
      if (!query) {
        setAgencyTypeOptions([]);
        return;
      }
      try {
        const response: any[] = await authenticityUtility.get(
          `/project-options/agency-types/search?query=${query}`
        );
        setAgencyTypeOptions(response);
        // Visibility is handled by onFocus/onChange now
      } catch (error) {
        console.error('Error searching agency types:', error);
        setAgencyTypeOptions([]); // Clear options on error
      }
    },
    [setAgencyTypeOptions] // Removed setShowAgencyTypeDropdown dependency
  );

  const debouncedSearchAgencyTypes = useMemo(
    () => debounce(searchAgencyTypes, 300),
    [searchAgencyTypes]
  );

  // Single unified click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if the click is outside any relevant input or dropdown
      const isAgencyInput = target.closest('.agency-input-wrapper'); // Add class to agency input wrapper
      const isSchemeInput = target.closest('.scheme-input-wrapper'); // Add class to scheme input wrapper
      const isAgencyTypeInput = target.closest('.agency-type-input-wrapper'); // Add class to agency type input wrapper
      const isDropdownMenu = target.closest('.dropdown-menu');

      if (
        !isAgencyInput &&
        !isSchemeInput &&
        !isAgencyTypeInput &&
        !isDropdownMenu
      ) {
        setShowAgencyDropdown(false);
        setShowSchemeDropdown(false);
        setShowAgencyTypeDropdowns({}); // Close all agency type dropdowns
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounced functions
  useEffect(() => {
    return () => {
      debouncedSearchAgencies.cancel();
      debouncedSearchSchemes.cancel();
      debouncedSearchAgencyTypes.cancel();
    };
  }, [
    debouncedSearchAgencies,
    debouncedSearchSchemes,
    debouncedSearchAgencyTypes,
  ]);

  // Add project request functions
  const handleProjectRequestSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!projectRequest.request_type || !projectRequest.name.trim()) {
      setProjectRequestError('Request type and name are required');
      return;
    }

    try {
      setProjectRequestLoading(true);
      setProjectRequestError('');

      const response: AuthResponse = await authenticityUtility.post(
        '/project-requests',
        projectRequest
      );

      if (response.status === 'success') {
        alert(
          'Request submitted successfully! It will be reviewed by an administrator.'
        );
        setShowProjectRequestModal(false);
        setProjectRequest({
          request_type: '',
          name: '',
          description: '',
        });
      } else {
        setProjectRequestError(response.message || 'Failed to submit request');
      }
    } catch (error: any) {
      console.error('Error submitting project request:', error);
      setProjectRequestError(
        error.response?.data?.message || 'Failed to submit request'
      );
    } finally {
      setProjectRequestLoading(false);
    }
  };

  const handleProjectRequestChange = (field: string, value: string): void => {
    setProjectRequest((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="journal-form-body">

      <div className="container-fluid p-4 journal-form-container">
        {' '}
        {/* Use a fluid container for more space */}
        {isExistingProject && (
          <div className="alert alert-info">
            <div className="d-flex justify-content-between align-items-center">
              <span>
                {isCurrentUserPrincipalState
                  ? 'Principal Investigator View'
                  : 'View Mode - Read Only Access'}
              </span>{' '}
              {/* Optional: Change text for PI */}
              <div>
                {projectId && isViewMode && (
                  <>
                    {isCurrentUserPrincipalState ? ( // Only show the button if the current user is the primary investigator
                      <button
                        className="btn btn-warning mx-2"
                        onClick={() => {
                          if (editRequestStatus === 'approved') {
                            // Already approved, maybe toggle edit mode directly?
                            // setEditMode(true); // Or handle as needed
                          } else if (editRequestStatus !== 'pending') {
                            handleEditRequest(); // Send request if not pending approved
                          }
                        }}
                        disabled={editRequestStatus === 'pending'}
                      >
                        {editRequestStatus === 'pending'
                          ? 'Edit Request Pending'
                          : editRequestStatus === 'approved'
                            ? 'Edit Mode Enabled'
                            : 'Request Edit Access'}
                      </button>
                    ) : (
                      // Optional: Show a message if user is not primary
                      editRequestStatus !== 'approved' && (
                        <span className="text-muted mx-2 fst-italic small">
                          Only the Principal Investigator can request edits.
                        </span>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Category Toggle */}
        <div className="category-toggle-container mb-4">
          <button
            className={`category-button ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
            disabled={isViewMode}
          >
            Form
          </button>
          <button
            className={`category-button ${activeTab === 'budget' ? 'active' : ''}`}
            onClick={() => setActiveTab('budget')}
            disabled={isViewMode}
          >
            Budget
          </button>
        </div>
        {activeTab === 'form' ? (
          <form onSubmit={handleSubmit} className="research-form">
            {/* Investigators Card */}
            <div className="form-card">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="form-section-title">Investigators:</h6>
                <div className="d-flex align-items-center">
                  <span className="me-3">Driven by:</span>
                  <div className="radio-group">
                    <div className="radio-item">
                      <input
                        type="radio"
                        id="drivenByFaculty"
                        name="drivenBy"
                        value="faculty"
                        checked={!isFacultyDriven}
                        onChange={() => !isViewMode && toggleCategory()}
                        disabled={isViewMode || isFormDisabled}
                      />
                      <label htmlFor="drivenByFaculty">Faculty</label>
                    </div>
                    <div className="radio-item">
                      <input
                        type="radio"
                        id="drivenByStudent"
                        name="drivenBy"
                        value="student"
                        checked={isFacultyDriven}
                        onChange={() => !isViewMode && toggleCategory()}
                        disabled={isViewMode || isFormDisabled}
                      />
                      <label htmlFor="drivenByStudent">Student</label>
                    </div>
                  </div>
                </div>
              </div>
              {validationErrors.investigators && (
                <div className="alert alert-danger">
                  {validationErrors.investigators}
                </div>
              )}
              {investigators.map((investigator, index) => (
                <div
                  key={investigator.id}
                  className="investigator-row mb-3"
                >
                  {/* Radio button with tooltip */}
                  <div className="custom-tooltip">
                    <input
                      type="radio"
                      id={`investigator${investigator.id}`}
                      name="primary_investigator"
                      className="investigator-row-radio"
                      checked={investigator.is_primary}
                      onChange={() => handlePrimarySelection(index)}
                      required
                      disabled={isFormDisabled}
                    />
                    <span className="tooltip-text">
                      {index === 0 ? 'PI' : 'Co-PI'}
                    </span>
                  </div>

                  {/* Designation dropdown with ChevronDown */}
                  <div style={{ position: 'relative' }}>
                    <select
                      className="form-control designation-select"
                      value={(
                        investigatorDesignations[index] ||
                        investigator.designation ||
                        'faculty'
                      ).toLowerCase()}
                      onChange={(e) =>
                        handleDesignationChange(index, e.target.value)
                      }
                      disabled={isFormDisabled}
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

                  {/* Conditional Fields based on designation */}
                  {renderInvestigatorFields(investigator, index)}

                  {/* Action buttons: Add and Delete */}
                  <div className="investigator-action-buttons">
                    {/* Only show add button on the last investigator row */}
                    {index === investigators.length - 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-add-author"
                        onClick={addInvestigator}
                        disabled={
                          investigators.length >= MAX_INVESTIGATORS ||
                          isFormDisabled
                        }
                        aria-label="Add investigator"
                        title="Add investigator"
                      >
                        <Plus size={16} />
                      </button>
                    )}

                    {investigators.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-delete-author"
                        onClick={() => removeInvestigator(investigator.id)}
                        disabled={isFormDisabled}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Title, Type, Agency, Scheme, Duration Card */}
            <div className="form-card">
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      value={title}
                      className={`form-control ${validationErrors.title ? 'is-invalid' : ''}`}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Title"
                      {...inputProps}
                      required
                    />
                    {validationErrors.title && (
                      <div className="invalid-feedback">
                        {validationErrors.title}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label d-block">Type</label>
                    <div className="radio-group">
                      {[
                        'researchProject',
                        'infrastructure',
                        'conceptNote',
                        'competition',
                        'scheme',
                      ].map((cat) => (
                        <div className="radio-item" key={cat}>
                          <input
                            type="radio"
                            name="projectType"
                            id={cat}
                            checked={category.includes(cat)}
                            onChange={() => setCategory([cat])}
                            {...inputProps}
                          />
                          <label htmlFor={cat}>
                            {cat
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, (str) => str.toUpperCase())}
                          </label>
                        </div>
                      ))}
                    </div>
                    {validationErrors.category && (
                      <div className="alert alert-danger mt-2">
                        {validationErrors.category}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  {/* Agency & Scheme */}
                  <div className="form-group mb-3">
                    <div className="d-flex align-items-center mb-1">
                      <label className="form-label mb-0">Agency</label>
                      <div style={{ flex: 1 }}></div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary btn-add"
                        onClick={() => {
                          setProjectRequest({
                            request_type: 'agency',
                            name: '',
                            description: '',
                          });
                          setShowProjectRequestModal(true);
                        }}
                        disabled={!editMode && isViewMode}
                      >
                        Request Agency
                      </button>
                    </div>
                    <div className="position-relative">
                      <input
                        type="text"
                        value={agencySearchTerm}
                        className="form-control"
                        onChange={(e) => {
                          setAgencySearchTerm(e.target.value);
                          searchAgencies(e.target.value);
                          setShowAgencyDropdown(true);
                          if (e.target.value === '') setAgency('');
                        }}
                        onBlur={() =>
                          setTimeout(() => setShowAgencyDropdown(false), 150)
                        }
                        placeholder="Search and select agency"
                        required
                        {...inputProps}
                      />
                      {showAgencyDropdown && agencyOptions.length > 0 && (
                        <ul
                          className="dropdown-menu show"
                          style={{
                            width: '100%',
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            zIndex: 1000,
                            maxHeight: '200px',
                            overflowY: 'auto',
                          }}
                        >
                          {agencyOptions.map((o) => (
                            <li
                              key={o.id}
                              className="dropdown-item"
                              onMouseDown={() => {
                                setAgency(o.name);
                                setAgencySearchTerm(o.name);
                                setShowAgencyDropdown(false);
                              }}
                            >
                              {o.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {validationErrors.agency && (
                      <div className="invalid-feedback d-block">
                        {validationErrors.agency}
                      </div>
                    )}
                  </div>

                  <div className="form-group mb-3">
                    <div className="d-flex align-items-center mb-1 justify-content-between">
                      <label className="form-label mb-0">Scheme</label>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary btn-add ms-2"
                        onClick={() => {
                          setProjectRequest({
                            request_type: 'scheme',
                            name: '',
                            description: '',
                          });
                          setShowProjectRequestModal(true);
                        }}
                        disabled={!editMode && isViewMode}
                      >
                        Request Scheme
                      </button>
                    </div>
                    <div className="position-relative">
                      <input
                        type="text"
                        value={schemeSearchTerm}
                        className="form-control"
                        onChange={(e) => {
                          setSchemeSearchTerm(e.target.value);
                          searchSchemes(e.target.value);
                          setShowSchemeDropdown(true);
                          if (e.target.value === '') setScheme('');
                        }}
                        onBlur={() =>
                          setTimeout(() => setShowSchemeDropdown(false), 150)
                        }
                        placeholder="Search and select scheme"
                        required
                        {...inputProps}
                      />
                      {showSchemeDropdown && schemeOptions.length > 0 && (
                        <ul
                          className="dropdown-menu show"
                          style={{
                            width: '100%',
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            zIndex: 1000,
                            maxHeight: '200px',
                            overflowY: 'auto',
                          }}
                        >
                          {schemeOptions.map((o) => (
                            <li
                              key={o.id}
                              className="dropdown-item"
                              onMouseDown={() => {
                                setScheme(o.name);
                                setSchemeSearchTerm(o.name);
                                setShowSchemeDropdown(false);
                              }}
                            >
                              {o.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {validationErrors.scheme && (
                      <div className="invalid-feedback d-block">
                        {validationErrors.scheme}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duration</label>
                    <div className="row g-2">
                      <div className="col">
                        <input
                          type="number"
                          className="form-control"
                          value={duration.years}
                          onChange={(e) =>
                            setDuration({
                              ...duration,
                              years: parseInt(e.target.value),
                            })
                          }
                          placeholder="Years"
                          {...inputProps}
                        />
                      </div>
                      <div className="col">
                        <input
                          type="number"
                          className="form-control"
                          value={duration.months}
                          onChange={(e) =>
                            setDuration({
                              ...duration,
                              months: parseInt(e.target.value),
                            })
                          }
                          placeholder="Months"
                          {...inputProps}
                        />
                      </div>
                      <div className="col">
                        <input
                          type="number"
                          className="form-control"
                          value={duration.days}
                          onChange={(e) =>
                            setDuration({
                              ...duration,
                              days: parseInt(e.target.value),
                            })
                          }
                          placeholder="Days"
                          {...inputProps}
                        />
                      </div>
                    </div>
                    {validationErrors.duration && (
                      <div className="validation-error">
                        {validationErrors.duration}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Contribution Card */}
            <div className="form-card">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="form-section-title">Financial Contribution</h6>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary btn-add"
                    onClick={() => {
                      setProjectRequest({
                        request_type: 'agency_type',
                        name: '',
                        description: '',
                      });
                      setShowProjectRequestModal(true);
                    }}
                    disabled={!editMode && isViewMode}
                  >
                    Request Agency Type
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-add"
                    onClick={addFinancialContribution}
                    disabled={
                      financialContributions.length >=
                      MAX_FINANCIAL_CONTRIBUTIONS
                    }
                    {...inputProps}
                  >
                    + Add
                  </button>
                </div>
              </div>
              {financialContributions.map((contribution, index) => (
                <div
                  key={contribution.id}
                  className="row align-items-center mb-2"
                >
                  <div className="col-auto">{index + 1}.</div>
                  <div className="col position-relative agency-type-input-wrapper">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search & select agency type"
                      value={contribution.agencyTypeSearchTerm ?? ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setFinancialContributions((prevContributions) => {
                          const newContributions = [...prevContributions];
                          newContributions[index] = {
                            ...newContributions[index],
                            agencyTypeSearchTerm: newValue,
                            ...(newValue !==
                              newContributions[index].agencyType && {
                              agencyType: '',
                            }),
                          };
                          return newContributions;
                        });
                        debouncedSearchAgencyTypes(newValue);
                        setShowAgencyTypeDropdowns((prev) => ({
                          ...prev,
                          [index]: true,
                        }));
                      }}
                      onFocus={() => {
                        if (contribution.agencyTypeSearchTerm) {
                          searchAgencyTypes(contribution.agencyTypeSearchTerm);
                        }
                        setShowAgencyTypeDropdowns((prev) => ({
                          ...prev,
                          [index]: true,
                        }));
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setShowAgencyTypeDropdowns((prev) => ({
                            ...prev,
                            [index]: false,
                          }));
                          const currentContribution =
                            financialContributions[index];
                          if (
                            currentContribution.agencyTypeSearchTerm !==
                            currentContribution.agencyType
                          ) {
                            const newContributions = [
                              ...financialContributions,
                            ];
                            newContributions[index].agencyTypeSearchTerm =
                              newContributions[index].agencyType ?? '';
                            setFinancialContributions(newContributions);
                          }
                        }, 150);
                      }}
                      {...inputProps}
                      required
                    />
                    {showAgencyTypeDropdowns[index] &&
                      agencyTypeOptions.length > 0 && (
                        <ul
                          className="dropdown-menu show"
                          style={{
                            width: '100%',
                            position: 'absolute',
                            zIndex: 1000,
                          }}
                        >
                          {agencyTypeOptions.map((option) => (
                            <li
                              key={option.id}
                              className="dropdown-item"
                              onMouseDown={() => {
                                const newContributions = [
                                  ...financialContributions,
                                ];
                                newContributions[index].agencyType =
                                  option.name;
                                newContributions[index].agencyTypeSearchTerm =
                                  option.name;
                                setFinancialContributions(newContributions);
                                setShowAgencyTypeDropdowns((prev) => ({
                                  ...prev,
                                  [index]: false,
                                }));
                                setAgencyTypeOptions([]);
                              }}
                            >
                              {option.name}
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                  <div className="col">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Agency"
                      value={contribution.agency}
                      onChange={(e) =>
                        handleFinancialContributionChange(
                          index,
                          'agency',
                          e.target.value
                        )
                      }
                      {...inputProps}
                    />
                  </div>
                  <div className="col">
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Amount (₹)"
                      value={contribution.amount}
                      onChange={(e) =>
                        handleFinancialContributionChange(
                          index,
                          'amount',
                          e.target.value
                        )
                      }
                      {...inputProps}
                    />
                  </div>
                  <div className="col-auto">
                    <button
                      type="button"
                      className="btn btn-sm btn-delete-author"
                      onClick={() => removeFinancialContribution(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="form-card">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="form-section-title">Collaboration</h6>
                <div className="d-flex align-items-center">
                  <div className="form-check form-switch me-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="collaborationToggle"
                      checked={enableCollaboration}
                      onChange={toggleCollaboration}
                      {...inputProps}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-add"
                    onClick={addCollaboration}
                    disabled={!enableCollaboration}
                    {...inputProps}
                  >
                    + Add Collab
                  </button>
                </div>
              </div>
              {enableCollaboration &&
                collaborations.map((collab, index) => (
                  <div key={collab.id} className="row align-items-center mb-2">
                    <div className="col-auto">{index + 1}.</div>
                    <div className="col">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search & select agency type"
                        value={collab.partner}
                        onChange={(e) =>
                          handleCollaborationChange(
                            collab.id,
                            'partner',
                            e.target.value
                          )
                        }
                        {...inputProps}
                      />
                    </div>
                    <div className="col">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Agency"
                        value={collab.address}
                        onChange={(e) =>
                          handleCollaborationChange(
                            collab.id,
                            'address',
                            e.target.value
                          )
                        }
                        {...inputProps}
                      />
                    </div>
                    <div className="col">
                      <select
                        className="form-select"
                        value={collab.support}
                        onChange={(e) =>
                          handleCollaborationChange(
                            collab.id,
                            'support',
                            e.target.value
                          )
                        }
                        {...inputProps}
                        required
                      >
                        <option value="Technical">Technical</option>
                        <option value="Financial">Financial</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="col-auto">
                      <button
                        type="button"
                        className="btn btn-sm btn-delete-author"
                        onClick={() => removeCollaboration(collab.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Journal Article & Submission Card */}
            <div className="row mb-4 journal-submission-row">
              {/* Journal Article Card */}
              <div className="col-md-6">
                <div className="form-card h-100">
                  <div>
                    <CustomFileUploader
                      label="Journal Article"
                      name="journalArticle"
                      onChange={handleJournalArticleUpload}
                      onDelete={handleJournalArticleDelete}
                      fileName={journalArticle.file?.name || journalArticle.filePath?.split('/').pop()}
                      file={journalArticle.file}
                      fileUrl={journalArticle.filePath ? getFileUrl(journalArticle.filePath) : undefined}
                      accept=".pdf,.doc,.docx"
                      disabled={isFormDisabled}
                      buttonText="Upload"
                    />
                    <small className="form-text text-muted">
                      Max 120 MB, PDF / Word
                    </small>
                  </div>
                </div>
              </div>
              {/* Date of Submission Card */}
              <div className="col-md-6">
                <div className="form-card h-100 date-submission-card">
                  <div className="mb-3 d-flex align-items-center">
                    <label className="form-label mb-0 me-3">
                      Date of Submission
                    </label>
                    <div className="form-check form-switch me-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="dateOfSubmissionToggle"
                        checked={dateOfSubmission}
                        onChange={handleDateOfSubmissionToggle}
                        {...inputProps}
                      />
                    </div>
                    <input
                      type="date"
                      className="form-control me-2"
                      style={{ width: '130px' }}
                      value={submissionDate}
                      onChange={handleSubmissionDateChange}
                      disabled={!dateOfSubmission}
                      required={dateOfSubmission}
                      {...inputProps}
                    />
                    <select
                      className="form-control"
                      style={{ width: '120px' }}
                      value={submissionStatus}
                      onChange={handleSubmissionStatusChange}
                      disabled={!dateOfSubmission}
                      required={dateOfSubmission}
                      {...inputProps}
                    >
                      <option value="submitted">Submitted</option>
                      <option value="underReview">Under Review</option>
                      <option value="revisionSubmitted">
                        Revision Submitted
                      </option>
                      <option value="accepted">Accepted</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label mb-1">
                      Application Number
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter App. No"
                      value={applicationNumber}
                      onChange={(e) => setApplicationNumber(e.target.value)}
                      disabled={!dateOfSubmission}
                      required={dateOfSubmission}
                      style={{ width: '100%' }}
                      {...inputProps}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Details Section */}
            {dateOfSubmission && submissionStatus === 'published' && (
              <div className="form-card-dashed mb-4">
                {/* Project Details */}
                <h6 className="form-section-title mb-3">Project Details:</h6>
                <div className="row mb-3">
                  {/* Simplified project details mapping */}
                  {[
                    {
                      key: 'dateOfPresentation',
                      label: 'Date of Presentation',
                    },
                    {
                      key: 'dateOfResultAnnouncement',
                      label: 'Date of Result Announcement',
                    },
                    {
                      key: 'sanctionOrderAmount',
                      label: 'Section Order Amount',
                      type: 'number',
                    },
                    { key: 'sanctionOrderDate', label: 'Section Order Date' },
                    {
                      key: 'projectDurationStartDate',
                      label: 'Project Duration Start Date',
                    },
                    {
                      key: 'projectDurationEndDate',
                      label: 'Project Duration End Date',
                    },
                  ].map((item) => (
                    <div className="col-md-6 mb-2" key={item.key}>
                      <div className="d-flex align-items-center">
                        <label
                          className="form-label me-auto"
                          style={{ minWidth: '220px' }}
                        >
                          {item.label}
                        </label>
                        <div className="form-check form-switch me-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={projectDetails[item.key as keyof ProjectDetails].enabled}
                            onChange={() =>
                              handleProjectDetailsToggle(item.key)
                            }
                            {...inputProps}
                          />
                        </div>
                        <input
                          type={item.type === 'number' ? 'number' : 'date'}
                          className="form-control"
                          disabled={!projectDetails[item.key as keyof ProjectDetails].enabled}
                          value={
                            item.type === 'number'
                              ? projectDetails[item.key as keyof ProjectDetails].value || ''
                              : formatDateForInput(
                                projectDetails[item.key as keyof ProjectDetails].value
                              )
                          }
                          onChange={(e) =>
                            handleProjectDetailsChange(item.key, e.target.value)
                          }
                          required={projectDetails[item.key as keyof ProjectDetails].enabled}
                          {...inputProps}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <hr />

                {/* Grant Disbursement */}
                <div className="d-flex justify-content-between align-items-center my-3">
                  <h6 className="form-section-title">Grant Disbursement:</h6>
                  <button
                    type="button"
                    className="btn btn-primary btn-add"
                    onClick={addGrantDisbursement}
                    {...inputProps}
                  >
                    + Add
                  </button>
                </div>
                {grantDisbursements.map((grant, index) => {
                  const grantIdentifier =
                    grant.id != null ? grant.id : grant.tempId;
                  return (
                    <div
                      key={grant.id ?? grant.tempId}
                      className="row g-2 align-items-center mb-2"
                    >
                      <div className="col">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="FY"
                          value={grant.fy}
                          onChange={(e) =>
                            handleInputChange(index, 'fy', e.target.value)
                          }
                          {...inputProps}
                        />
                      </div>
                      <div className="col">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Agency"
                          value={grant.agency}
                          onChange={(e) =>
                            handleInputChange(index, 'agency', e.target.value)
                          }
                          {...inputProps}
                        />
                      </div>
                      <div className="col">
                        <input
                          type="number"
                          className="form-control"
                          placeholder="Amount (₹)"
                          value={grant.amount}
                          onChange={(e) =>
                            handleInputChange(index, 'amount', e.target.value)
                          }
                          {...inputProps}
                        />
                      </div>
                      <div className="col">
                        <input
                          type="date"
                          className="form-control"
                          value={formatDateForInput(grant.date)}
                          onChange={(e) =>
                            handleInputChange(index, 'date', e.target.value)
                          }
                          {...inputProps}
                        />
                      </div>
                      <div className="col-auto">
                        <CustomFileUploader
                          name={`sanctionLetter${grantIdentifier}`}
                          onChange={(file) => handleFileUpload(file, `sanctionLetter${grantIdentifier}`)}
                          onDelete={() => handleFileDelete(`sanctionLetter${grantIdentifier}`)}
                          fileName={grant.sanctionLetter.file?.name || grant.sanctionLetter.filePath?.split('/').pop()}
                          file={grant.sanctionLetter.file}
                          fileUrl={grant.sanctionLetter.filePath ? getFileUrl(grant.sanctionLetter.filePath) : undefined}
                          disabled={isFormDisabled || !grant.sanctionLetter.enabled}
                          buttonText="Sanction Letter"
                        />
                      </div>
                      <div className="col-auto">
                        <CustomFileUploader
                          name={`ucAndSoE${grantIdentifier}`}
                          onChange={(file) => handleFileUpload(file, `ucAndSoE${grantIdentifier}`)}
                          onDelete={() => handleFileDelete(`ucAndSoE${grantIdentifier}`)}
                          fileName={grant.ucAndSoE.file?.name || grant.ucAndSoE.filePath?.split('/').pop()}
                          file={grant.ucAndSoE.file}
                          fileUrl={grant.ucAndSoE.filePath ? getFileUrl(grant.ucAndSoE.filePath) : undefined}
                          disabled={isFormDisabled || !grant.ucAndSoE.enabled}
                          buttonText="UC & SoE"
                        />
                      </div>
                      <div className="col-auto">
                        <button
                          type="button"
                          className="btn btn-sm btn-delete-author"
                          onClick={() => removeGrantDisbursement(index)}
                          {...inputProps}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <hr />

                <div className="d-flex align-items-center my-3">
                  <h6 className="form-section-title me-4">Outcome:</h6>
                  <div className="checkbox-group">
                    {[
                      { id: 'journals', label: 'Journals' },
                      { id: 'conference', label: 'Conference' },
                      { id: 'ipr', label: 'IPR' },
                      {
                        id: 'technologyTransfer',
                        label: 'Technology Transfer',
                      },
                      { id: 'prototype', label: 'Prototype' },
                      { id: 'product', label: 'Product' },
                    ].map((opt) => (
                      <div className="checkbox-item" key={opt.id}>
                        <input
                          type="checkbox"
                          id={opt.id}
                          checked={outcome[opt.id as keyof Outcome]}
                          onChange={handleCheckboxChange}
                          {...inputProps}
                        />
                        <label htmlFor={opt.id}>{opt.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <hr />

                {/* Documents */}
                <h6 className="form-section-title my-3">Documents:</h6>
                <div className="row">
                  {[
                    { key: 'sanctionOrder', label: 'Sanction Order' },
                    {
                      key: 'utilizationCertificate',
                      label: 'Utilization Certificate',
                    },
                    {
                      key: 'statementOfExpenditure',
                      label: 'Statement of Expenditure',
                    },
                    { key: 'projectReport', label: 'Project Report' },
                    { key: 'bankStatement', label: 'Bank Statement' },
                  ].map((doc) => (
                    <div className="col-md-6 mb-3" key={doc.key}>
                      <div className="d-flex align-items-center gap-2">
                        <label
                          className="form-label mb-0"
                          style={{ minWidth: '180px' }}
                        >
                          {doc.label}
                        </label>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`${doc.key}Toggle`}
                            checked={documents[doc.key as keyof Documents]?.enabled || false}
                            onChange={() => handleDocumentToggle(doc.key)}
                            {...inputProps}
                          />
                        </div>
                        <CustomFileUploader
                          name={doc.key}
                          onChange={(file) => handleFileUpload(file, doc.key)}
                          onDelete={() => handleFileDelete(doc.key)}
                          fileName={
                            documents[doc.key as keyof Documents]?.file?.name ||
                            documents[doc.key as keyof Documents]?.filePath?.split('/').pop()
                          }
                          file={documents[doc.key as keyof Documents]?.file}
                          fileUrl={
                            documents[doc.key as keyof Documents]?.filePath
                              ? getFileUrl(documents[doc.key as keyof Documents]?.filePath || '')
                              : undefined
                          }
                          disabled={isFormDisabled || !documents[doc.key as keyof Documents]?.enabled}
                          buttonText="Upload"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="text-center mt-4 mb-5">
              <button
                type="submit"
                className="btn-submit-approval "
                disabled={isFormDisabled || (isViewMode && !editMode)}
              >
                Submit for approval
              </button>
            </div>
          </form>
        ) : (
          <div className="form-card">
            <h5 className="form-section-title">Budget Section</h5>
            <p className="text-muted">Budget details and financial management.</p>
          </div>
        )}
        {/* Project Request Modal */}
        {
          showProjectRequestModal && (
            <div
              className="modal fade show"
              style={{ display: 'block', zIndex: 1050 }}
              tabIndex={-1}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowProjectRequestModal(false);
                }
              }}
            >
              <div className="modal-dialog" style={{ zIndex: 1055 }}>
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">
                      Request New{' '}
                      {projectRequest.request_type
                        .replace('_', ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowProjectRequestModal(false)}
                    ></button>
                  </div>
                  <form onSubmit={handleProjectRequestSubmit}>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={projectRequest.name}
                          onChange={(e) =>
                            handleProjectRequestChange('name', e.target.value)
                          }
                          placeholder={`Enter ${projectRequest.request_type.replace('_', ' ')} name`}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">
                          Description (Optional)
                        </label>
                        <textarea
                          className="form-control"
                          value={projectRequest.description}
                          onChange={(e) =>
                            handleProjectRequestChange(
                              'description',
                              e.target.value
                            )
                          }
                          placeholder="Enter description..."
                          rows={3}
                        />
                      </div>
                      {projectRequestError && (
                        <div className="alert alert-danger">
                          {projectRequestError}
                        </div>
                      )}
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setShowProjectRequestModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={projectRequestLoading}
                      >
                        {projectRequestLoading
                          ? 'Submitting...'
                          : 'Submit Request'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
              <div
                className="modal-backdrop fade show"
                style={{ zIndex: 1040 }}
              ></div>
            </div>
          )
        }
      </div >
    </div >
  );
};

export default ResearchProjectForm;