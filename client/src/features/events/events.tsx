import './events.css';
import {
  CloudUpload,
  Eye,
  Plus,
  Trash2,
  Save,
  Upload,
  Archive,
  Bell,
  Briefcase,
  CalendarClock,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  Edit2,
  Info,
  RotateCcw,
  Search,
  XCircle,
  type LucideIcon,
  X,
  Building2,
  Layers,
  MapPin,
  Mail,
  Facebook,
  Instagram,
  Linkedin,
  Award,
  Utensils,
  Building,
  Presentation,
  Scale,
  Smile,
  Megaphone,
  Lightbulb,
  GraduationCap,
  Users,
  BookOpen,
  Video,
  ShoppingBag,
  Sparkles,
  Bed,
  Star,
  User,
  Calendar,
  Hourglass,
  ShoppingCart,
  Inbox,
  Paperclip,
  FileText,
  CheckCircle2,
  Pencil,
  Target,
  AlertCircle,
  Check,
  ArrowDown,
  Printer,
} from 'lucide-react';
import React, { useState, useEffect, ChangeEvent, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { useAuth } from '../../contexts/AuthContext';
import { useAbility } from '../../shared/casl/AbilityContext';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import CustomModal from '../../shared/components/ui/CustomModal';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
import DeleteConfirmationModal from '../../shared/components/ui/DeleteConfirmationModal';
import RecordHeaderBanner from '../../shared/components/ui/RecordHeaderBanner';
import authenticityUtility from '../../shared/utils/authenticityUtility';

// =========================================
// constants.ts
// =========================================

export const EVENT_DASHBOARD_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DUMMY_EVENTS = [
  {
    status: 'pending',
    proposedBy: 'Ms Vijayapriya C',
    category: 'Workshop',
    department: 'EE (VLSI D&T)',
    time: '09:00 AM - 12:30 PM',
    name: '3D Printing Materials Mechanical Engineering Mechanical Engineering Mechanical Engineering',
    venue: 'Cyberdome',
    date: '2026-10-07',
  },
  {
    status: 'approved',
    proposedBy: 'Ms Vijayapriya C',
    category: 'Seminar',
    department: 'Computer Science',
    time: '01:00 PM - 03:00 PM',
    name: 'AI in Industry 4.0',
    venue: 'Innovation Lab',
    date: '2026-10-09',
  },
  {
    status: 'rejected',
    proposedBy: 'Ms Vijayapriya C',
    category: 'Competition',
    department: 'SM Volunteers',
    time: '03:30 PM - 05:30 PM',
    name: 'Robotics Challenge',
    venue: 'Robotics Lab',
    date: '2026-10-07',
  },
  {
    status: 'archived',
    proposedBy: 'Ms Vijayapriya C',
    category: 'Workshop',
    department: 'Civil',
    time: '10:00 AM - 01:00 PM',
    name: 'Sustainable Materials',
    venue: 'Auditorium',
    date: '2026-10-12',
  },
];

export const EVENT_APPROVAL_FEE_MONTHS = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
];

export const EVENT_APPROVAL_OPTIONS = {
  categories: ['Technical', 'Non-Technical', 'Cultural', 'Sports'],
  types: [
    'Conference',
    'Seminar',
    'Workshop',
    'Symposium',
    'Training',
    'Webinar',
    'Hackathon',
    'FDP',
  ],
  levels: ['Intra College', 'Inter College', 'District', 'State', 'National', 'International'],
  participants: ['Students', 'Faculty', 'Research Scholars', 'Industry', 'Public'],
  theme: [
    'Innovation',
    'Sustainability',
    'Digital Transformation',
    'Research',
    'Industry Collaboration',
  ],
  sdg: ['SDG 1', 'SDG 2', 'SDG 3', 'SDG 4', 'SDG 5', 'SDG 6', 'SDG 7', 'SDG 8', 'SDG 9', 'SDG 10'],
  mode: ['Physical', 'Virtual', 'Hybrid'],
  venue: [
    'Cyberdome',
    'Visveshwaraya Hall',
    'Biotech Seminar Hall',
    'ECC Seminar Hall',
    'Founder Hall',
    'Idea Lab',
  ],
  status: ['Ongoing', 'Closed'],
  participantCategory: ['Students', 'Faculty', 'External', 'Research Scholars'],
  documentName: ['ID Card', 'Bonafide Certificate', 'Payment Receipt'],
  documentType: ['PDF', 'Image', 'Document'],
  documentSize: ['1 MB', '2 MB', '5 MB'],
  collaboratorType: ['Institution', 'Department', 'Professional Body', 'Cell/Club'],
  coordinator: ['Coordinator 1', 'Coordinator 2', 'Coordinator 3'],
};

export const EVENT_SESSION_OPTIONS = ['FN', 'AN', 'Full Day'];
export const EVENT_OPEN_TO_OPTIONS = ['Any', 'Internal', 'External'];
export const EVENT_GENDER_RESTRICTION_OPTIONS = ['Any', 'Male', 'Female'];
export const EVENT_ACCOMMODATION_TYPE_OPTIONS = ['Free', 'Paid'];
export const EVENT_PAGE_TABS = [
  { id: 'pre-event', label: 'Pre Event Approvals' },
  { id: 'finance', label: 'Finance' },
  { id: 'updates', label: 'Event Updates' },
  { id: 'participants', label: 'Participants' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'certificate', label: 'Certificate' },
] as const;

export const EVENT_FEEDBACK_TOGGLES = [
  'food',
  'refreshment',
  'presentation',
  'evaluation',
  'enjoyment',
] as const;
export const EVENT_FEEDBACK_AWARENESS_CHANNELS = [
  'Circular',
  'Social Media',
  'Email',
  'Friends',
  'Website',
  'Colleagues',
  'Others',
] as const;
export const EVENT_RESOURCE_PERSON_OPTIONS = [
  'Dr. A. Kumar, Department of Computer Science',
  'Dr. S. Priya, Department of Electronics',
  'Ms. R. Anitha, Industry Expert',
  'Mr. K. Vinoth, Research & Innovation',
] as const;

export const EVENT_COPY = {
  chooseFile: 'Choose File',
  select: 'Select',
  selectParticipantType: '-- Select Participant Type --',
  selectMainEvent: 'Select Main Event',
  noMainEventsAvailable: 'No Main Events available with Multi Event enabled.',
  feedbackLink: 'Feedback Link',
  totalParticipants: 'Total Participants',
  submitFeedback: 'Submit Feedback',
  submitNext: 'Submit & Next',
  socialMedia: 'Social Media',
  resourcePersonLabel: 'Resource Person:',
  notSent: 'Not Sent',
  scheduleVenue: 'Schedule & Venue',
  registrationSettings: 'Registration Settings',
  accommodation: 'Accommodation',
  expectedParticipants: 'Expected Participants',
  noOfDays: 'No. of Days',
  add: 'Add +',
  save: 'Save',
  preview: 'Preview',
  sendMail: 'Send Mail',
  lettersTitle: 'Letters',
  participantsTitle: 'Participants',
  documentsTitle: 'Documents',
  importantLinksTitle: 'Important Links',
  loadingParticipants: 'Loading participants...',
  noParticipantsFound: 'No participants found.',
  totalParticipantsLabel: 'Total Participants',
  feedbackLinkLabel: 'Feedback Link',
  enterFeedbackLink: 'Enter feedback link',
  eventFeedbackTitle: 'Event:',
  accommodationTitle: 'Accommodation',
  noMainEventOption: '-- Select an Event --',
  selectMainEventError: 'Select Main Event',
  resourcePersonPrefix: 'Resource Person',
  invitationLabel: 'Invitation',
  thanksLabel: 'Thanks',
  previewInvitation: 'Previewing Invitation for',
  previewThanks: 'Previewing Thank You letter for',
  topicPlaceholder: 'Topic / Title of presentation...',
  publicityTitle: 'Publicity',
  socialMediaLinksTitle: 'Social Media Links',
  websiteScrolling: 'Website Scrolling',
  newspaperEngagement: 'Newspaper Engagement',
  pressReport: 'Press Report',
  facebookLink: 'Facebook link',
  xLink: 'X link',
  instagramLink: 'Instagram link',
  linkedinLink: 'Linkedin link',
  eventFlyer: 'Event Flyer',
  eventName: 'Event Name',
  noOfDaysLabel: 'No. of Days',
  scheduleVenueLabel: 'Schedule & Venue',
  registrationSettingsLabel: 'Registration Settings',
  accommodationLabel: 'Accommodation',
  expectedParticipantsLabel: 'Expected Participants',
} as const;

export const EVENT_MAIL_TEMPLATES = {
  invitationSubject: (name: string) => `Invitation to be Resource Person`,
  invitationBody: (name: string) =>
    `Dear ${name || 'Sir/Madam'},\n\nWe would like to invite you as a resource person...`,
  thankYouSubject: () => `Thank you for being Resource Person`,
  thankYouBody: (name: string) =>
    `Dear ${name || 'Sir/Madam'},\n\nThank you for sharing your expertise...`,
} as const;

export const FINANCE_INCOME_HEADS = [
  'Registration Fee',
  'Sponsorship',
  'Management Contribution',
  'Others',
];

export const FINANCE_BUDGET_HEADS = [
  'Honorarium',
  'Travel',
  'Printing',
  'Stationary',
  'Food',
  'Refreshment',
  'Others',
];

export const FINANCE_INITIAL_DOCS = [
  'Sanction Order',
  'Utilization Certificate',
  'Bank Statement',
  'Statement of Expenditure',
];

export const EVENT_UPDATE_LETTERS_SECTIONS = [
  'Security Division',
  'Photography',
  'Video Recording',
];

export const DOCUMENT_PARTICIPANT_TYPES = [
  { value: 'internal-students', label: 'Internal Students' },
  { value: 'external-students', label: 'External Students' },
  { value: 'faculty', label: 'Faculty Members' },
  { value: 'research-scholars', label: 'Research Scholars' },
  { value: 'industry-experts', label: 'Industry Experts' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'general-public', label: 'General Public' },
];

export const EVENT_DOCUMENTS = [
  'Invitation',
  'Agenda',
  'Schedule',
  'Report',
  'Attendance sheet',
  'Sample Certificate',
  'Photos',
];

// =========================================
// Documents.tsx
// =========================================

interface ParticipantType {
  value: string;
  label: string;
}

interface Participant {
  id?: number;
  type: string;
  label: string;
  count: number;
}

interface LinkState {
  enabled: boolean;
  url: string;
}

interface ParticipantsPageProps {
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  eventId: number | string;
}

interface DocumentsPageProps {
  eventId: number | string;
  canEditDocuments: boolean;
  documents: string[];
  participantTypes: ParticipantType[];
}

const DocumentsPage = ({
  eventId,
  canEditDocuments,
  documents,
  participantTypes,
}: DocumentsPageProps) => {
  const [docState, setany] = useState<Record<string, any>>(
    documents.reduce(
      (acc, doc) => {
        acc[doc] = {
          active: false,
          file: doc === 'Photos' ? ([null, null, null, null] as (File | null)[]) : null,
        };
        return acc;
      },
      {} as Record<string, any>,
    ),
  );

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [popupMessage, setPopupMessage] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const hasEventId = Boolean(eventId);

  useEffect(() => {
    if (!hasEventId) return;

    const loadData = async () => {
      try {
        const response = (await authenticityUtility.get(`/documents/${eventId}`)) as {
          documents?: Array<{ docname: string; active: boolean }>;
          participants?: Array<{ id: number; type: string; count: number }>;
        };
        const { documents: backendDocs, participants: backendParticipants } = response;

        if (backendDocs) {
          const newany = { ...docState };
          backendDocs.forEach((doc) => {
            if (newany[doc.docname]) {
              newany[doc.docname].active = doc.active;
            }
          });
          setany(newany);
        }

        if (backendParticipants) {
          const formattedParticipants = backendParticipants.map((p) => ({
            id: p.id,
            type: p.type,
            label: participantTypes.find((t) => t.value === p.type)?.label || p.type,
            count: p.count,
          }));
          setParticipants(formattedParticipants);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [eventId, hasEventId]);

  const handleToggle = (doc: string) => {
    if (!hasEventId || !canEditDocuments) return;
    setany((prev) => ({
      ...prev,
      [doc]: {
        ...prev[doc],
        active: !prev[doc].active,
      },
    }));

    const syncWithBackend = async () => {
      try {
        const newActiveState = !docState[doc].active;
        await authenticityUtility.put(`/documents/${eventId}/doc/${encodeURIComponent(doc)}`, {
          active: newActiveState,
          upload_id: null,
        });
      } catch (error) {
        console.error('Error updating document:', error);
      }
    };
    syncWithBackend();
  };

  const handleFileUpload = async (
    doc: string,
    event: ChangeEvent<HTMLInputElement>,
    index: number | null = null,
  ) => {
    const input = event.currentTarget;
    const file = event.target.files?.[0];
    if (file && hasEventId && canEditDocuments) {
      setany((prev) => {
        if (doc === 'Photos' && index !== null) {
          const currentFiles = prev[doc].file as (File | null)[];
          const newFiles = [...currentFiles];
          newFiles[index] = file;
          return {
            ...prev,
            [doc]: { ...prev[doc], file: newFiles },
          };
        } else {
          return {
            ...prev,
            [doc]: { ...prev[doc], file },
          };
        }
      });

      try {
        const formData = new FormData();
        formData.append('file', file);
        await authenticityUtility.postFile(
          `/documents/${eventId}/doc/${encodeURIComponent(doc)}/upload`,
          formData,
        );
      } catch (error) {
        console.error('Error uploading file:', error);
        setany((prev) => {
          if (doc === 'Photos' && index !== null) {
            const currentFiles = prev[doc].file as (File | null)[];
            if (currentFiles[index] !== file) {
              return prev;
            }
            const newFiles = [...currentFiles];
            newFiles[index] = null;
            return {
              ...prev,
              [doc]: { ...prev[doc], file: newFiles },
            };
          }

          if (prev[doc].file !== file) {
            return prev;
          }

          return {
            ...prev,
            [doc]: { ...prev[doc], file: null },
          };
        });
        input.value = '';
        setPopupMessage(`Failed to upload file: ${file.name}`);
      }
    }
  };

  const handleViewFile = (doc: string, index: number | null = null) => {
    const docData = docState[doc];
    const file =
      doc === 'Photos' && index !== null
        ? (docData.file as (File | null)[])[index]
        : (docData.file as File | null);
    if (file) {
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    }
  };

  const handleEditRequest = async () => {
    if (!hasEventId) return;

    try {
      await authenticityUtility.post(`/documents/${eventId}/edit-request`);
      setPopupMessage('Your edit request has been sent successfully!');
    } catch (error) {
      console.error('Error sending edit request:', error);
      setPopupMessage('Failed to send edit request. Please try again.');
    }
  };

  const handleSubmitApproval = async () => {
    if (!hasEventId) return;

    if (isSubmittingApproval) return;
    setIsSubmittingApproval(true);
    try {
      await authenticityUtility.post(`/documents/${eventId}/submit`);
      setPopupMessage('Your form has been submitted for approval!');
    } catch (error) {
      console.error('Error submitting for approval:', error);
      setPopupMessage('Failed to submit for approval. Please try again.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const closePopup = () => {
    setPopupMessage('');
  };

  const renderDocRow = (doc: string) => {
    if (doc === 'Photos') {
      const photoFiles = docState[doc].file as (File | null)[];
      return (
        <div className="event-doc-row event-doc-row-photos" key={doc}>
          <span className="event-doc-label">{doc}</span>
          <label className="event-switch">
            <input
              type="checkbox"
              checked={docState[doc].active}
              disabled={!canEditDocuments}
              onChange={() => handleToggle(doc)}
            />
            <span className="event-slider"></span>
          </label>
          <div className="event-doc-actions">
            <div className="event-doc-actions-photos">
              {photoFiles.map((_, i) => (
                <div key={i} className="event-photo-pair">
                  <label className={`event-photo-slot ${!docState[doc].active ? 'disabled' : ''}`}>
                    <CloudUpload size={16} />
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(doc, e, i)}
                      style={{ display: 'none' }}
                      disabled={!docState[doc].active || !canEditDocuments}
                    />
                  </label>

                  <button
                    type="button"
                    className={`event-photo-slot ${!photoFiles[i] ? 'disabled' : ''}`}
                    onClick={() => handleViewFile(doc, i)}
                    disabled={!photoFiles[i]}
                  >
                    <Eye size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="event-doc-row" key={doc}>
        <span className="event-doc-label">{doc}</span>
        <label className="event-switch">
          <input
            type="checkbox"
            checked={docState[doc].active}
            disabled={!canEditDocuments}
            onChange={() => handleToggle(doc)}
          />
          <span className="event-slider"></span>
        </label>
        <label className={`event-upload-icon ${!docState[doc].active ? 'disabled' : ''}`}>
          <CloudUpload size={16} />
          <input
            type="file"
            onChange={(e) => handleFileUpload(doc, e)}
            style={{ display: 'none' }}
            disabled={!docState[doc].active || !canEditDocuments}
          />
        </label>
        <button
          type="button"
          className={`event-eye-icon ${!docState[doc].file ? 'disabled' : ''}`}
          onClick={() => docState[doc].file && handleViewFile(doc)}
          disabled={!docState[doc].file}
        >
          <Eye size={16} />
        </button>
      </div>
    );
  };

  return (
    <div>
      {!hasEventId ? (
        <div className="event-card-section">
          <h2 className="event-section-title">Documents</h2>
          <div className="event-message-overlay">
            <div className="event-message-box">
              <h3>Event ID is required to load documents.</h3>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ParticipantsCard participants={participants} setParticipants={setParticipants} />

          <div className="event-card-section">
            <h2 className="event-section-title">Documents</h2>
            <div className="event-docs-grid">{documents.map(renderDocRow)}</div>
          </div>

          <div className="event-doc-buttons">
            <button type="button" className="event-btn event-submit" onClick={handleEditRequest}>
              Edit Request
            </button>
            <button
              type="button"
              className="event-btn event-submit"
              onClick={handleSubmitApproval}
              disabled={isSubmittingApproval}
            >
              {isSubmittingApproval ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>

          {popupMessage && (
            <div className="event-message-overlay">
              <div className="event-message-box">
                <h3>{popupMessage}</h3>
                <button onClick={closePopup}>OK</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export { DocumentsPage };

// =========================================
// EventApprovalCards.tsx
// =========================================

export interface EventApprovalFormData {
  name: string;
  category: string;
  eventType: string;
  level: string;
  expectedParticipants: string;
  themes: string[];
  sdgs: string[];
  dateFrom: string;
  dateTo: string;
  numberOfDays: string;
  mode: string;
  session: string;
  venue: string;
  meetingLink: string;
  eligibleParticipants: string | string[];
  openTo: string;
  genderRestriction: string;
  minAge: string;
  maxAge: string;
  eventFlyerName: string;
  isMultiEventEnabled: boolean;
  registrationSettingsEnabled: boolean;
  registrationStatus: string;
  lastDate: string;
  extension: boolean;
  extendedDate: string;
  shortlistingRequired: boolean;
  selectionIntimation: string;
  teamEnabled: boolean;
  minTeamSize: string;
  maxTeamSize: string;
  documentEnabled: boolean;
  documentName: string;
  documentType: string;
  documentSize: string;
  documentTextFieldEnabled: boolean;
  feedbackEnabled: boolean;
  certificateEnabled: boolean;
  registrationFeeEnabled: boolean;
  feeRows: FeeRow[];
  collaborators: CollaboratorRow[];
  sponsoringAgencies: CollaboratorRow[];
  multiEventsList?: { id: string; name: string; type: string }[];
  coordinators: CoordinatorRow[];
  accommodationEnabled: boolean;
  accommodationType: 'Free' | 'Paid';
  gentsAccommodationLimit: string;
  ladiesAccommodationLimit: string;
  ceremonyEnabled: boolean;
  inauguralEnabled: boolean;
  inauguralDate: string;
  inauguralTime: string;
  inauguralVenue: string;
  valedictoryEnabled: boolean;
  valedictoryDate: string;
  valedictoryTime: string;
  valedictoryVenue: string;
  sponsoringAgencyEnabled: boolean;
}

interface FeeRow {
  id: string;
  participantCategory: string;
  individual: string;
  team: string;
  members: string;
  additionalMember: string;
  description: string;
  monthAmounts: Record<string, string>;
}

interface CollaboratorRow {
  id: string;
  type: string;
  name: string;
  sponsorAgency?: string;
}

interface CoordinatorRow {
  id: string;
  employee_id: number | null;
  name: string;
  department: string;
  email: string;
  institution: string;
}

type EventApprovalTextField = keyof Pick<
  EventApprovalFormData,
  | 'name'
  | 'category'
  | 'eventType'
  | 'level'
  | 'expectedParticipants'
  | 'dateFrom'
  | 'dateTo'
  | 'numberOfDays'
  | 'mode'
  | 'session'
  | 'venue'
  | 'meetingLink'
  | 'openTo'
  | 'genderRestriction'
  | 'minAge'
  | 'maxAge'
  | 'eventFlyerName'
  | 'lastDate'
  | 'extendedDate'
  | 'selectionIntimation'
  | 'minTeamSize'
  | 'maxTeamSize'
  | 'documentName'
  | 'documentType'
  | 'documentSize'
  | 'inauguralDate'
  | 'inauguralTime'
  | 'inauguralVenue'
  | 'valedictoryDate'
  | 'valedictoryTime'
  | 'valedictoryVenue'
>;

interface EventApprovalCardsProps {
  title?: string;
  eventNumber?: number;
  submitLabel?: string;
  showFooter?: boolean;
  showHeaderActions?: boolean;
  showExtendedSections?: boolean;
  showMultiEventToggle?: boolean;
  isSubEvent?: boolean;
  onAddEvent?: () => void;
  onSubmit?: (data: EventApprovalFormData) => void | Promise<void>;
}

const makeId = () => crypto.randomUUID();
const FEE_MONTHS = EVENT_APPROVAL_FEE_MONTHS;

const createMonthAmounts = () =>
  FEE_MONTHS.reduce<Record<string, string>>((months, month) => {
    months[month] = '';
    return months;
  }, {});

const createFeeRow = (): FeeRow => ({
  id: makeId(),
  participantCategory: '',
  individual: '',
  team: '',
  members: '',
  additionalMember: '',
  description: '',
  monthAmounts: createMonthAmounts(),
});

const createCollaborator = (): CollaboratorRow => ({
  id: makeId(),
  type: '',
  name: '',
});

const createCoordinator = (): CoordinatorRow => ({
  id: makeId(),
  employee_id: null,
  name: '',
  department: '',
  email: '',
  institution: '',
});

const createInitialFormData = (): EventApprovalFormData => ({
  name: '',
  category: '',
  eventType: '',
  level: '',
  expectedParticipants: '',
  themes: [],
  sdgs: [],
  dateFrom: '',
  dateTo: '',
  numberOfDays: '',
  mode: 'Physical',
  session: 'FN',
  venue: '',
  meetingLink: '',
  eligibleParticipants: [],
  openTo: 'Any',
  genderRestriction: 'Any',
  minAge: '',
  maxAge: '',
  eventFlyerName: '',
  isMultiEventEnabled: false,
  registrationSettingsEnabled: false,
  registrationStatus: 'Open',
  lastDate: '',
  extension: false,
  extendedDate: '',
  shortlistingRequired: false,
  selectionIntimation: '',
  teamEnabled: false,
  minTeamSize: '',
  maxTeamSize: '',
  documentEnabled: false,
  documentName: '',
  documentType: '',
  documentSize: '',
  documentTextFieldEnabled: false,
  feedbackEnabled: false,
  certificateEnabled: false,
  registrationFeeEnabled: false,
  feeRows: [createFeeRow()],
  collaborators: [createCollaborator()],
  sponsoringAgencies: [createCollaborator()],
  coordinators: [createCoordinator()],
  accommodationEnabled: false,
  accommodationType: 'Free',
  gentsAccommodationLimit: '',
  ladiesAccommodationLimit: '',
  ceremonyEnabled: false,
  inauguralEnabled: false,
  inauguralDate: '',
  inauguralTime: '',
  inauguralVenue: '',
  valedictoryEnabled: false,
  valedictoryDate: '',
  valedictoryTime: '',
  valedictoryVenue: '',
  sponsoringAgencyEnabled: false,
});

const options = EVENT_APPROVAL_OPTIONS;

const EventApprovalCards: React.FC<EventApprovalCardsProps> = ({
  title = 'Event 1',
  eventNumber = 1,
  submitLabel = 'Save Event',
  showFooter = true,
  showHeaderActions = true,
  showExtendedSections = false,
  showMultiEventToggle = false,
  isSubEvent = false,
  onAddEvent,
  onSubmit,
}) => {
  const { user } = useAuth();
  const currentUserName = useMemo(() => {
    return (user?.name || user?.email || 'Admin').trim();
  }, [user]);

  const [formData, setFormData] = useState<EventApprovalFormData>(createInitialFormData);
  const [additionalEvents, setAdditionalEvents] = useState(0);
  const [isMultiEvent, setIsMultiEvent] = useState(false);
  const [multiEventsList, setMultiEventsList] = useState<
    { id: string; name: string; type: string; createdBy?: string }[]
  >([]);
  const [editingSubEventId, setEditingSubEventId] = useState<string | null>(null);
  const [editSubEventData, setEditSubEventData] = useState<{ name: string; type: string }>({
    name: '',
    type: '',
  });
  const [viewingSubEvent, setViewingSubEvent] = useState<{
    id: string;
    name: string;
    type: string;
    createdBy: string;
  } | null>(null);

  const handleAddSubEventRow = () => {
    setMultiEventsList((prev) => [
      ...prev,
      { id: makeId(), name: '', type: '', createdBy: currentUserName },
    ]);
  };

  const handleDeleteSubEvent = (id: string) => {
    if (window.confirm('Are you sure you want to delete this sub-event?')) {
      setMultiEventsList((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleSaveEditSubEvent = (id: string) => {
    if (!editSubEventData.name.trim()) {
      alert('Sub-event name cannot be empty');
      return;
    }
    setMultiEventsList((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, name: editSubEventData.name.trim(), type: editSubEventData.type }
          : item,
      ),
    );
    setEditingSubEventId(null);
  };

  const [submitting, setSubmitting] = useState(false);
  const [themeSearchQuery, setThemeSearchQuery] = useState('');
  const [sdgSearchQuery, setSdgSearchQuery] = useState('');
  const [eligibleParticipantsSearchQuery, setEligibleParticipantsSearchQuery] = useState('');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('');
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('');
  const [eventExpanded, setEventExpanded] = useState(true);
  const [ageRestrictionType, setAgeRestrictionType] = useState<'Any' | 'Range'>('Any');
  const minAgeInputRef = useRef<HTMLInputElement | null>(null);
  const maxAgeInputRef = useRef<HTMLInputElement | null>(null);

  // Coordinator Search State
  const [coordinatorSearchResults, setCoordinatorSearchResults] = useState<any[]>([]);
  const [activeCoordinatorRowId, setActiveCoordinatorRowId] = useState<string | null>(null);

  const handleCoordinatorSearch = async (query: string, rowId: string) => {
    updateRow<CoordinatorRow>('coordinators', rowId, 'name', query);

    if (query.trim().length === 0) {
      setCoordinatorSearchResults([]);
      setActiveCoordinatorRowId(null);
      return;
    }

    setActiveCoordinatorRowId(rowId);
    try {
      let response = (await authenticityUtility
        .get(`/events/search-employee?q=${encodeURIComponent(query)}`)
        .catch(() => null)) as any;

      if (!response) {
        response = (await authenticityUtility
          .get(`/budget/search-applicant?q=${encodeURIComponent(query)}`)
          .catch(() => null)) as any;
      }

      if (response && (response.success || response.status === 'success')) {
        setCoordinatorSearchResults(Array.isArray(response.data) ? response.data : []);
      } else if (Array.isArray(response)) {
        setCoordinatorSearchResults(response);
      } else {
        setCoordinatorSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching coordinator:', error);
      setCoordinatorSearchResults([]);
    }
  };

  const handleSelectCoordinator = (rowId: string, emp: any) => {
    updateRow<CoordinatorRow>('coordinators', rowId, 'employee_id', emp.employee_id);
    updateRow<CoordinatorRow>('coordinators', rowId, 'name', (emp.name || '').trim());
    updateRow<CoordinatorRow>('coordinators', rowId, 'department', emp.department || '');
    updateRow<CoordinatorRow>('coordinators', rowId, 'email', emp.email || '');
    updateRow<CoordinatorRow>('coordinators', rowId, 'institution', emp.entity || '');

    setActiveCoordinatorRowId(null);
    setCoordinatorSearchResults([]);
  };

  const setField = <K extends keyof EventApprovalFormData>(
    field: K,
    value: EventApprovalFormData[K],
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleModeChange = (mode: string) => {
    setFormData((current) => ({
      ...current,
      mode,
      meetingLink: mode === 'Physical' ? '' : current.meetingLink,
    }));
  };

  const getSelectClassName = (value: string) =>
    value ? 'event-approval-select has-value' : 'event-approval-select is-placeholder';

  const resetForm = () => {
    if (!window.confirm('Reset this event form?')) return;
    const nextFormData = createInitialFormData();
    setFormData(nextFormData);
    setSelectedCollaboratorId('');
    setSelectedCoordinatorId('');
  };

  const addEvent = () => {
    setAdditionalEvents((count) => count + 1);
  };

  const select = (
    field: EventApprovalTextField,
    selectOptions: string[],
    placeholder = '',
    disabled = false,
  ) => (
    <select
      className={getSelectClassName(String(formData[field] || ''))}
      value={String(formData[field] || '')}
      onChange={(event) => setField(field, event.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder || 'Select'}</option>
      {selectOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );

  const updateRow = <T extends FeeRow | CollaboratorRow | CoordinatorRow>(
    collection: 'feeRows' | 'collaborators' | 'sponsoringAgencies' | 'coordinators',
    id: string,
    field: keyof T,
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      [collection]: (current[collection] as T[]).map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      ),
    }));
  };

  const addRow = (
    collection: 'feeRows' | 'collaborators' | 'sponsoringAgencies' | 'coordinators',
  ) => {
    const factory =
      collection === 'feeRows'
        ? createFeeRow
        : collection === 'coordinators'
          ? createCoordinator
          : createCollaborator;
    const newRow = factory();
    setFormData((current) => ({
      ...current,
      [collection]: [...current[collection], newRow],
    }));
  };

  const deleteRow = (
    collection: 'feeRows' | 'collaborators' | 'sponsoringAgencies' | 'coordinators',
    id: string,
  ) => {
    const rows = formData[collection];
    if (rows.length === 1) return;
    if (!window.confirm('Delete this row?')) return;

    const nextRows = rows.filter((row) => row.id !== id);
    const nextSelectedCollaboratorId =
      collection === 'collaborators' && selectedCollaboratorId === id
        ? nextRows[0]?.id || ''
        : selectedCollaboratorId;
    const nextSelectedCoordinatorId =
      collection === 'coordinators' && selectedCoordinatorId === id
        ? nextRows[0]?.id || ''
        : selectedCoordinatorId;

    setFormData((current) => ({
      ...current,
      [collection]: nextRows,
    }));

    if (collection === 'collaborators') {
      setSelectedCollaboratorId(nextSelectedCollaboratorId);
    }
    if (collection === 'coordinators') {
      setSelectedCoordinatorId(nextSelectedCoordinatorId);
    }
  };

  const handleSubmit = async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        isMultiEventEnabled: isMultiEvent,
        multiEventsList,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const showMeetingLink = formData.mode === 'Virtual' || formData.mode === 'Hybrid';
  const sessionOptions = EVENT_SESSION_OPTIONS;

  const content = (
    <>
      <section className="event-approval-card form-card">
        {(title || showHeaderActions) && (
          <div className="event-approval-title-row">
            {title && <h2>{title}</h2>}
            {showHeaderActions && (
              <div className="event-approval-icon-actions">
                <HeaderCollapseButton
                  expanded={eventExpanded}
                  onClick={() => setEventExpanded((expanded) => !expanded)}
                />
                {onAddEvent && (
                  <button
                    type="button"
                    title="Add event"
                    aria-label="Add event"
                    onClick={onAddEvent}
                  >
                    <Plus size={18} />
                  </button>
                )}
                <button
                  type="button"
                  className="muted"
                  title="Delete event"
                  aria-label="Delete event"
                  onClick={resetForm}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {eventExpanded && (
          <>
            <div className="event-approval-section-heading">Event Details</div>
            <div className="event-approval-grid event-approval-name-flyer-grid">
              <label>
                Event Name
                <input
                  placeholder="Event Name"
                  value={formData.name}
                  onChange={(event) => setField('name', event.target.value)}
                />
              </label>
              <label className="event-approval-flyer-field">
                Event Flyer
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) =>
                    setField('eventFlyerName', event.target.files?.[0]?.name || '')
                  }
                />
                <span className="event-approval-file-button">
                  <Upload size={14} />
                  {formData.eventFlyerName || 'Choose File'}
                </span>
              </label>
            </div>
            <div className="event-approval-grid four">
              <label>Category{select('category', options.categories)}</label>
              <label>Type{select('eventType', options.types)}</label>
              <label>Level{select('level', options.levels)}</label>
              <label>
                Expected Participants
                <input
                  placeholder="Expected Participants"
                  value={formData.expectedParticipants}
                  onChange={(event) =>
                    setField('expectedParticipants', event.target.value.replace(/[^0-9]/g, ''))
                  }
                />
              </label>
            </div>
            <div className="event-approval-grid two event-approval-theme-grid">
              <label>
                Theme
                <CustomTagInput
                  name="themes"
                  value={formData.themes}
                  onChange={(values) => setField('themes', values)}
                  suggestions={options.theme.filter(
                    (t) =>
                      t.toLowerCase().includes(themeSearchQuery.toLowerCase()) &&
                      !formData.themes.includes(t),
                  )}
                  onSearch={setThemeSearchQuery}
                  placeholder={
                    formData.themes.length === 0 ? 'Type to search and select themes' : ''
                  }
                  className="mb-0 mt-1"
                />
              </label>
              <label>
                SDG
                <CustomTagInput
                  name="sdgs"
                  value={formData.sdgs}
                  onChange={(values) => setField('sdgs', values)}
                  suggestions={options.sdg.filter(
                    (s) =>
                      s.toLowerCase().includes(sdgSearchQuery.toLowerCase()) &&
                      !formData.sdgs.includes(s),
                  )}
                  onSearch={setSdgSearchQuery}
                  placeholder={formData.sdgs.length === 0 ? 'Type to search and select SDGs' : ''}
                  className="mb-0 mt-1"
                />
              </label>
            </div>

            <div className="event-approval-section-heading spaced">
              <span>Schedule & Venue</span>
            </div>
            <div className="event-approval-grid schedule-top">
              <label className="schedule-date-from">
                Date (From)
                <input
                  className={formData.dateFrom ? 'has-value' : 'is-placeholder'}
                  type="date"
                  placeholder="DD/MM/YYYY"
                  value={formData.dateFrom}
                  onChange={(event) => setField('dateFrom', event.target.value)}
                />
              </label>
              <label className="schedule-date-to">
                Date (To)
                <input
                  className={formData.dateTo ? 'has-value' : 'is-placeholder'}
                  type="date"
                  placeholder="DD/MM/YYYY"
                  value={formData.dateTo}
                  onChange={(event) => setField('dateTo', event.target.value)}
                />
              </label>
              <div className="event-approval-schedule-card schedule-days">
                <span className="schedule-field-title">No. of Days</span>
                <input
                  placeholder="No. of Days"
                  value={formData.numberOfDays}
                  onChange={(event) => setField('numberOfDays', event.target.value)}
                />
              </div>
              <div className="event-approval-schedule-card schedule-session">
                <Segmented
                  label="Session"
                  value={formData.session}
                  options={sessionOptions}
                  onChange={(value) => setField('session', value)}
                />
              </div>
            </div>
            <div className="event-approval-grid schedule-bottom">
              <div className="schedule-mode">
                <Segmented
                  label="Mode"
                  value={formData.mode}
                  options={options.mode}
                  onChange={(value) => handleModeChange(value)}
                />
              </div>
              {formData.mode !== 'Virtual' && (
                <label className="schedule-venue">Venue{select('venue', options.venue)}</label>
              )}
              {showMeetingLink && (
                <label className="schedule-meeting">
                  Meeting link
                  <input
                    placeholder="Meeting Link"
                    value={formData.meetingLink}
                    onChange={(event) => setField('meetingLink', event.target.value)}
                  />
                </label>
              )}
            </div>
          </>
        )}
      </section>

      {eventExpanded && (
        <>
          <section className="event-approval-card form-card">
            <div className="event-approval-section-heading with-toggle">
              <span>Registration Settings</span>
              <Switch
                checked={formData.registrationSettingsEnabled}
                onChange={(value) => setField('registrationSettingsEnabled', value)}
              />
            </div>
            {formData.registrationSettingsEnabled && (
              <>
                <div className="event-approval-registration-top">
                  <label className="w-100">
                    Eligible Participants
                    <CustomTagInput
                      name="eligibleParticipants"
                      value={
                        Array.isArray(formData.eligibleParticipants)
                          ? formData.eligibleParticipants
                          : formData.eligibleParticipants
                            ? formData.eligibleParticipants
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                            : []
                      }
                      onChange={(values) => setField('eligibleParticipants', values)}
                      suggestions={options.participants.filter(
                        (p) =>
                          p.toLowerCase().includes(eligibleParticipantsSearchQuery.toLowerCase()) &&
                          !(
                            Array.isArray(formData.eligibleParticipants)
                              ? formData.eligibleParticipants
                              : formData.eligibleParticipants
                                ? formData.eligibleParticipants
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : []
                          ).includes(p),
                      )}
                      onSearch={setEligibleParticipantsSearchQuery}
                      placeholder={
                        (Array.isArray(formData.eligibleParticipants)
                          ? formData.eligibleParticipants.length
                          : formData.eligibleParticipants
                            ? 1
                            : 0) === 0
                          ? 'Type to search and select eligible participants'
                          : ''
                      }
                      className="mb-0 mt-1"
                    />
                  </label>
                </div>
                <div className="event-approval-controls-row">
                  <Segmented
                    label="Open to"
                    value={formData.openTo}
                    options={EVENT_OPEN_TO_OPTIONS}
                    onChange={(value) => setField('openTo', value)}
                  />
                  <Segmented
                    label="Gender Restriction"
                    value={formData.genderRestriction}
                    options={EVENT_GENDER_RESTRICTION_OPTIONS}
                    onChange={(value) => setField('genderRestriction', value)}
                  />
                  <div className="event-approval-age-control">
                    <span>Age Restriction</span>
                    <div className="event-approval-age-control-row">
                      <button
                        type="button"
                        className={ageRestrictionType === 'Any' ? 'active' : ''}
                        onClick={() => {
                          setAgeRestrictionType('Any');
                          setField('minAge', '');
                          setField('maxAge', '');
                        }}
                      >
                        Any
                      </button>
                      <div
                        className={`event-approval-age-option ${ageRestrictionType === 'Range' ? 'active' : ''}`}
                      >
                        <span>Minimum</span>
                        <input
                          ref={minAgeInputRef}
                          placeholder=""
                          value={formData.minAge}
                          onChange={(event) => {
                            const val = event.target.value.replace(/[^0-9]/g, '');
                            setField('minAge', val);
                            setAgeRestrictionType('Range');
                          }}
                        />
                        <span>Maximum</span>
                        <input
                          ref={maxAgeInputRef}
                          placeholder=""
                          value={formData.maxAge}
                          onChange={(event) => {
                            const val = event.target.value.replace(/[^0-9]/g, '');
                            setField('maxAge', val);
                            setAgeRestrictionType('Range');
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="event-approval-band registration">
                  <div className="event-approval-registration-box">
                    <Segmented
                      label="Registration Status"
                      value={formData.registrationStatus || 'Open'}
                      options={options.status}
                      onChange={(value) => setField('registrationStatus', value)}
                    />
                    <label>
                      Last Date
                      <input
                        className={formData.lastDate ? 'has-value' : 'is-placeholder'}
                        type="date"
                        placeholder="DD/MM/YYYY"
                        value={formData.lastDate}
                        onChange={(event) => setField('lastDate', event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="event-approval-registration-box">
                    <TogglePair
                      label="Extension"
                      value={formData.extension}
                      onChange={(value) => {
                        setField('extension', value);
                        if (!value) {
                          setField('extendedDate', '');
                        }
                      }}
                    />
                    <label className={!formData.extension ? 'is-disabled' : ''}>
                      Extended Date
                      <input
                        className={formData.extendedDate ? 'has-value' : 'is-placeholder'}
                        type="date"
                        placeholder="DD/MM/YYYY"
                        value={formData.extendedDate}
                        onChange={(event) => setField('extendedDate', event.target.value)}
                        disabled={!formData.extension}
                      />
                    </label>
                  </div>
                  <div className="event-approval-registration-box wide">
                    <TogglePair
                      label="Shortlisting required"
                      value={formData.shortlistingRequired}
                      onChange={(value) => {
                        setField('shortlistingRequired', value);
                        if (!value) {
                          setField('selectionIntimation', '');
                        }
                      }}
                    />
                    <label className={!formData.shortlistingRequired ? 'is-disabled' : ''}>
                      Selection Intimation
                      <input
                        className={formData.selectionIntimation ? 'has-value' : 'is-placeholder'}
                        type="date"
                        placeholder="DD/MM/YYYY"
                        value={formData.selectionIntimation}
                        onChange={(event) => setField('selectionIntimation', event.target.value)}
                        disabled={!formData.shortlistingRequired}
                      />
                    </label>
                  </div>
                </div>
                <div className="event-approval-split">
                  <MiniCard
                    title="Team Participation"
                    enabled={formData.teamEnabled}
                    onToggle={(value) => setField('teamEnabled', value)}
                    className="event-approval-mini-card-team"
                  >
                    <label>
                      Minimum Team Size
                      <input
                        placeholder=""
                        value={formData.minTeamSize}
                        onChange={(event) => setField('minTeamSize', event.target.value)}
                      />
                    </label>
                    <label>
                      Maximum Team Size
                      <input
                        placeholder=""
                        value={formData.maxTeamSize}
                        onChange={(event) => setField('maxTeamSize', event.target.value)}
                      />
                    </label>
                  </MiniCard>
                  <MiniCard
                    title="Document Upload"
                    enabled={formData.documentEnabled}
                    onToggle={(value) => setField('documentEnabled', value)}
                    columns={4}
                    className="event-approval-mini-card-doc"
                  >
                    <label>Document Name{select('documentName', options.documentName)}</label>
                    <label>Type{select('documentType', options.documentType)}</label>
                    <label>Size{select('documentSize', options.documentSize)}</label>
                    <label className="event-approval-mini-card-doc-field">
                      <span>Text Field</span>
                      <input
                        type="checkbox"
                        checked={formData.documentTextFieldEnabled}
                        onChange={(event) =>
                          setField('documentTextFieldEnabled', event.target.checked)
                        }
                      />
                    </label>
                  </MiniCard>
                </div>
                <div className="event-approval-split">
                  <MiniCard
                    title="Feedback"
                    enabled={formData.feedbackEnabled}
                    onToggle={(value) => setField('feedbackEnabled', value)}
                    className="event-approval-mini-card-feedback"
                    columns={1}
                  />
                  <MiniCard
                    title="Certificate"
                    enabled={formData.certificateEnabled}
                    onToggle={(value) => setField('certificateEnabled', value)}
                    className="event-approval-mini-card-certificate"
                    columns={1}
                  />
                </div>
              </>
            )}
          </section>

          <section className="event-approval-card form-card">
            <div className="event-approval-section-heading with-toggle">
              <span>Registration fees</span>
              <Switch
                checked={formData.registrationFeeEnabled}
                onChange={(value) => setField('registrationFeeEnabled', value)}
              />
            </div>
            {formData.registrationFeeEnabled && (
              <div className="event-approval-table-wrap">
                <table className="budgetEntryTable">
                  <colgroup>
                    <col className="participant-category-column" />
                    <col className="fee-column" />
                    <col className="fee-column" />
                    <col className="member-column" />
                    <col className="additional-member-column" />
                    <col className="action-column" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowSpan={2}>Participant Category</th>
                      <th colSpan={4}>Registration Fees</th>
                      <th rowSpan={2}>Action</th>
                    </tr>
                    <tr>
                      <th>Individual</th>
                      <th>Team</th>
                      <th>Member</th>
                      <th>Additional Member</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.feeRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>
                          <select
                            disabled={!formData.registrationFeeEnabled}
                            className="tableSelect"
                            value={row.participantCategory}
                            onChange={(event) =>
                              updateRow<FeeRow>(
                                'feeRows',
                                row.id,
                                'participantCategory',
                                event.target.value,
                              )
                            }
                          >
                            <option value="">Select</option>
                            {options.participantCategory.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="tableInput"
                            placeholder="Amount"
                            disabled={!formData.registrationFeeEnabled}
                            value={row.individual}
                            onChange={(event) =>
                              updateRow<FeeRow>(
                                'feeRows',
                                row.id,
                                'individual',
                                event.target.value.replace(/[^0-9]/g, ''),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="tableInput"
                            placeholder="Amount"
                            disabled={!formData.registrationFeeEnabled}
                            value={row.team}
                            onChange={(event) =>
                              updateRow<FeeRow>(
                                'feeRows',
                                row.id,
                                'team',
                                event.target.value.replace(/[^0-9]/g, ''),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="tableInput"
                            placeholder="Members"
                            disabled={!formData.registrationFeeEnabled}
                            value={row.members}
                            onChange={(event) =>
                              updateRow<FeeRow>(
                                'feeRows',
                                row.id,
                                'members',
                                event.target.value.replace(/[^0-9]/g, ''),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="tableInput"
                            placeholder="Amount"
                            disabled={!formData.registrationFeeEnabled}
                            value={row.additionalMember}
                            onChange={(event) =>
                              updateRow<FeeRow>(
                                'feeRows',
                                row.id,
                                'additionalMember',
                                event.target.value.replace(/[^0-9]/g, ''),
                              )
                            }
                          />
                        </td>
                        <td>
                          <IconActions
                            showAdd={index === formData.feeRows.length - 1}
                            onAdd={() => addRow('feeRows')}
                            onDelete={() => deleteRow('feeRows', row.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="event-approval-card form-card">
            <div className="event-approval-section-heading">Host & Collaborator</div>
            {formData.collaborators.map((row, index) => (
              <div className="event-approval-row-line" key={row.id}>
                <input
                  type="radio"
                  className="event-approval-radio-dot"
                  name={`event-${eventNumber}-collaborator`}
                  checked={selectedCollaboratorId === row.id}
                  onChange={() => setSelectedCollaboratorId(row.id)}
                  aria-label="Select collaborator row"
                />
                <select
                  className={getSelectClassName(row.type)}
                  value={row.type}
                  onChange={(event) =>
                    updateRow<CollaboratorRow>('collaborators', row.id, 'type', event.target.value)
                  }
                >
                  <option value="">Select</option>
                  {options.collaboratorType.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <input
                  placeholder="Collaborator Name"
                  value={row.name}
                  onChange={(event) =>
                    updateRow<CollaboratorRow>('collaborators', row.id, 'name', event.target.value)
                  }
                />
                <IconActions
                  showAdd={index === formData.collaborators.length - 1}
                  onAdd={() => addRow('collaborators')}
                  onDelete={() => deleteRow('collaborators', row.id)}
                />
              </div>
            ))}
          </section>

          <section className="event-approval-card form-card">
            <div className="event-approval-section-heading with-toggle">
              <span>Sponsoring Agency</span>
              <Switch
                checked={formData.sponsoringAgencyEnabled}
                onChange={(value) => setField('sponsoringAgencyEnabled', value)}
              />
            </div>
            {formData.sponsoringAgencyEnabled &&
              formData.sponsoringAgencies.map((row, index) => (
                <div className="event-approval-row-line no-radio" key={row.id}>
                  <select
                    className={getSelectClassName(row.type)}
                    value={row.type}
                    onChange={(event) =>
                      updateRow<CollaboratorRow>(
                        'sponsoringAgencies',
                        row.id,
                        'type',
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Select</option>
                    {options.collaboratorType.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Agency Name"
                    value={row.name}
                    onChange={(event) =>
                      updateRow<CollaboratorRow>(
                        'sponsoringAgencies',
                        row.id,
                        'name',
                        event.target.value,
                      )
                    }
                  />
                  <IconActions
                    showAdd={index === formData.sponsoringAgencies.length - 1}
                    onAdd={() => addRow('sponsoringAgencies')}
                    onDelete={() => deleteRow('sponsoringAgencies', row.id)}
                  />
                </div>
              ))}
          </section>

          <section className="event-approval-card form-card">
            <div className="event-approval-section-heading">Coordinator</div>
            {formData.coordinators.map((row, index) => (
              <div className="event-approval-coordinator-card" key={row.id}>
                <input
                  type="radio"
                  className="event-approval-radio-dot"
                  name={`event-${eventNumber}-coordinator`}
                  checked={selectedCoordinatorId === row.id}
                  onChange={() => setSelectedCoordinatorId(row.id)}
                  aria-label="Select coordinator row"
                />
                <div className="event-approval-grid two">
                  <div style={{ position: 'relative' }}>
                    <input
                      placeholder="Search employee by name or ERP ID"
                      value={row.name}
                      onChange={(e) => handleCoordinatorSearch(e.target.value, row.id)}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#0069ab';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 105, 171, 0.15)';
                        setActiveCoordinatorRowId(row.id);
                        if (row.name.trim().length > 0) {
                          void handleCoordinatorSearch(row.name, row.id);
                        }
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                        setTimeout(() => setActiveCoordinatorRowId(null), 200);
                      }}
                    />
                    {activeCoordinatorRowId === row.id && coordinatorSearchResults.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: '#fff',
                          border: '1px solid #e0e0e0',
                          borderRadius: '12px',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                          zIndex: 1000,
                          maxHeight: '250px',
                          overflowY: 'auto',
                          marginTop: '4px',
                        }}
                      >
                        {coordinatorSearchResults.map((emp: any) => (
                          <div
                            key={emp.employee_id}
                            onMouseDown={(evt) => {
                              evt.preventDefault();
                              handleSelectCoordinator(row.id, emp);
                            }}
                            style={{
                              padding: '10px 15px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f0f0f0',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = '#f8f9fa')
                            }
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                          >
                            <div style={{ fontWeight: '600', color: '#333' }}>{emp.name}</div>
                            <div style={{ fontSize: '12px', color: '#6c757d' }}>
                              {emp.designation} | {emp.department}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    placeholder="Department"
                    value={row.department}
                    onChange={(event) =>
                      updateRow<CoordinatorRow>(
                        'coordinators',
                        row.id,
                        'department',
                        event.target.value,
                      )
                    }
                  />
                  <input
                    placeholder="Email"
                    value={row.email}
                    onChange={(event) =>
                      updateRow<CoordinatorRow>('coordinators', row.id, 'email', event.target.value)
                    }
                  />
                  <input
                    placeholder="Institution"
                    value={row.institution}
                    onChange={(event) =>
                      updateRow<CoordinatorRow>(
                        'coordinators',
                        row.id,
                        'institution',
                        event.target.value,
                      )
                    }
                  />
                </div>
                <IconActions
                  showAdd={index === formData.coordinators.length - 1}
                  onAdd={() => addRow('coordinators')}
                  onDelete={() => deleteRow('coordinators', row.id)}
                />
              </div>
            ))}
          </section>

          {showExtendedSections && (
            <section className="event-approval-card event-approval-last-card form-card">
              <div className="event-approval-section-heading with-toggle">
                <span>Inaugural and Valedictory Details</span>
                <Switch
                  checked={formData.ceremonyEnabled}
                  onChange={(value) => setField('ceremonyEnabled', value)}
                />
              </div>
              {formData.ceremonyEnabled && (
                <div className="event-approval-ceremony-box">
                  <CeremonyRow
                    label="Inaugural"
                    enabled={formData.inauguralEnabled}
                    toggleChecked={formData.inauguralEnabled}
                    toggleDisabled={!formData.ceremonyEnabled}
                    onToggle={(value) => setField('inauguralEnabled', value)}
                    date={formData.inauguralDate}
                    time={formData.inauguralTime}
                    venue={formData.inauguralVenue}
                    onDate={(value) => setField('inauguralDate', value)}
                    onTime={(value) => setField('inauguralTime', value)}
                    onVenue={(value) => setField('inauguralVenue', value)}
                  />
                  <CeremonyRow
                    label="Valedictory"
                    enabled={formData.valedictoryEnabled}
                    toggleChecked={formData.valedictoryEnabled}
                    toggleDisabled={!formData.ceremonyEnabled}
                    onToggle={(value) => setField('valedictoryEnabled', value)}
                    date={formData.valedictoryDate}
                    time={formData.valedictoryTime}
                    venue={formData.valedictoryVenue}
                    onDate={(value) => setField('valedictoryDate', value)}
                    onTime={(value) => setField('valedictoryTime', value)}
                    onVenue={(value) => setField('valedictoryVenue', value)}
                  />
                </div>
              )}
            </section>
          )}

          {showExtendedSections && (
            <section className="event-approval-card event-approval-accommodation-card form-card">
              <div className="event-approval-section-heading with-toggle">
                <span>Accommodation</span>
                <Switch
                  checked={formData.accommodationEnabled}
                  onChange={(value) => setField('accommodationEnabled', value)}
                />
              </div>
              {formData.accommodationEnabled && (
                <div className="event-approval-band accommodation">
                  <div className="event-approval-fieldset-grid">
                    <Segmented
                      disabled={!formData.accommodationEnabled}
                      value={formData.accommodationType}
                      options={EVENT_ACCOMMODATION_TYPE_OPTIONS}
                      onChange={(value) => setField('accommodationType', value as 'Free' | 'Paid')}
                    />
                    <label>
                      Gents Accommodation Limit
                      <input
                        placeholder="Limit"
                        disabled={!formData.accommodationEnabled}
                        value={formData.gentsAccommodationLimit}
                        onChange={(event) =>
                          setField(
                            'gentsAccommodationLimit',
                            event.target.value.replace(/[^0-9]/g, ''),
                          )
                        }
                      />
                    </label>
                    <label>
                      Ladies Accommodation Limit
                      <input
                        placeholder="Limit"
                        disabled={!formData.accommodationEnabled}
                        value={formData.ladiesAccommodationLimit}
                        onChange={(event) =>
                          setField(
                            'ladiesAccommodationLimit',
                            event.target.value.replace(/[^0-9]/g, ''),
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </section>
          )}

          {showMultiEventToggle && eventNumber === 1 && (
            <section className="event-approval-card form-card event-approval-multi-event-card">
              <div className="event-approval-section-heading with-toggle">
                <span>Multi Event</span>
                <Switch
                  checked={isMultiEvent}
                  onChange={(value) => {
                    setIsMultiEvent(value);
                    if (value && multiEventsList.length === 0) {
                      setMultiEventsList([
                        { id: makeId(), name: '', type: '', createdBy: currentUserName },
                      ]);
                    }
                  }}
                />
              </div>
              {isMultiEvent && (
                <div className="event-approval-multi-event-container" style={{ marginTop: '14px' }}>
                  {/* Sub Events Table */}
                  <div className="event-approval-table-wrap event-approval-multi-event-table-wrap">
                    <table className="budgetEntryTable event-approval-multi-event-table">
                      <thead>
                        <tr>
                          <th>Event Type</th>
                          <th>Event Name</th>
                          <th>Created By</th>
                          <th style={{ textAlign: 'center', width: '70px' }}>View</th>
                          <th style={{ textAlign: 'center', width: '70px' }}>Edit</th>
                          <th style={{ textAlign: 'center', width: '70px' }}>Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {multiEventsList.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              style={{ textAlign: 'center', color: '#64748b', padding: '16px' }}
                            >
                              No sub-events added yet. Click "+ Add Sub Event" below to add a
                              sub-event.
                            </td>
                          </tr>
                        ) : (
                          multiEventsList.map((row) => (
                            <tr key={row.id}>
                              {editingSubEventId === row.id ? (
                                <>
                                  <td>
                                    <select
                                      className="tableSelect"
                                      value={editSubEventData.type}
                                      onChange={(e) =>
                                        setEditSubEventData((prev) => ({
                                          ...prev,
                                          type: e.target.value,
                                        }))
                                      }
                                    >
                                      <option value="">Select Type</option>
                                      {options.types.map((t) => (
                                        <option key={t} value={t}>
                                          {t}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td>
                                    <input
                                      className="tableInput"
                                      placeholder="Event Name"
                                      value={editSubEventData.name}
                                      onChange={(e) =>
                                        setEditSubEventData((prev) => ({
                                          ...prev,
                                          name: e.target.value,
                                        }))
                                      }
                                    />
                                  </td>
                                  <td>{row.createdBy || currentUserName}</td>
                                  <td colSpan={3} style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handleSaveEditSubEvent(row.id)}
                                      style={{
                                        marginRight: '6px',
                                        padding: '2px 8px',
                                        fontSize: '12px',
                                      }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => setEditingSubEventId(null)}
                                      style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                      Cancel
                                    </button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td>
                                    <select
                                      className="tableSelect"
                                      value={row.type}
                                      onChange={(e) =>
                                        setMultiEventsList((curr) =>
                                          curr.map((r) =>
                                            r.id === row.id ? { ...r, type: e.target.value } : r,
                                          ),
                                        )
                                      }
                                    >
                                      <option value="">Select Type</option>
                                      {options.types.map((t) => (
                                        <option key={t} value={t}>
                                          {t}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td>
                                    <input
                                      className="tableInput"
                                      placeholder="Event Name"
                                      value={row.name}
                                      onChange={(e) =>
                                        setMultiEventsList((curr) =>
                                          curr.map((r) =>
                                            r.id === row.id ? { ...r, name: e.target.value } : r,
                                          ),
                                        )
                                      }
                                    />
                                  </td>
                                  <td>{row.createdBy || currentUserName}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      title="View sub-event details"
                                      onClick={() =>
                                        setViewingSubEvent({
                                          id: row.id,
                                          name: row.name,
                                          type: row.type,
                                          createdBy: row.createdBy || currentUserName,
                                        })
                                      }
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#0284c7',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Eye size={18} />
                                    </button>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      title="Edit sub-event"
                                      onClick={() => {
                                        setEditingSubEventId(row.id);
                                        setEditSubEventData({ name: row.name, type: row.type });
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#d97706',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Pencil size={18} />
                                    </button>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      title="Delete sub-event"
                                      onClick={() => handleDeleteSubEvent(row.id)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="event-dashboard-add-btn"
                      onClick={handleAddSubEventRow}
                      style={{
                        height: '34px',
                        padding: '0 16px',
                        backgroundColor: '#0069ab',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + Add Sub Event
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {showFooter && eventExpanded && (
        <div className="event-approval-footer finance-submit-buttons">
          <button type="button" onClick={handleSubmit} disabled={submitting}>
            <Save size={17} />
            {submitting ? 'Submitting...' : submitLabel}
          </button>
        </div>
      )}

      {viewingSubEvent && (
        <CustomModal
          show={Boolean(viewingSubEvent)}
          onHide={() => setViewingSubEvent(null)}
          title="Sub-Event Details"
          size="lg"
        >
          <div style={{ padding: '12px 4px' }}>
            <div style={{ marginBottom: '16px' }}>
              <span
                style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block' }}
              >
                Event Name
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                {viewingSubEvent.name}
              </span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <span
                style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block' }}
              >
                Event Type
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#0284c7' }}>
                {viewingSubEvent.type}
              </span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <span
                style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block' }}
              >
                Created By
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#16a34a' }}>
                {viewingSubEvent.createdBy}
              </span>
            </div>
          </div>
        </CustomModal>
      )}
    </>
  );

  if (isSubEvent) return content;

  return (
    <div className="event-approval-page journal-form-body">
      <div className="journal-form-container event-approval-container">{content}</div>
    </div>
  );
};

const Switch = ({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) => (
  <label className={`event-approval-switch${disabled ? ' is-disabled' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
    />
    <span />
  </label>
);

const Segmented = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) => (
  <div className="event-approval-segmented">
    {label && <span>{label}</span>}
    <div>
      {options.map((option) => (
        <button
          type="button"
          key={option}
          className={value === option ? 'active' : ''}
          onClick={() => onChange(option)}
          disabled={disabled}
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);

const TogglePair = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="event-approval-toggle-pair">
    <span>{label}</span>
    <div className="event-approval-toggle-pair-buttons">
      <button type="button" className={value ? 'active' : ''} onClick={() => onChange(true)}>
        Yes
      </button>
      <button type="button" className={!value ? 'active' : ''} onClick={() => onChange(false)}>
        No
      </button>
    </div>
  </div>
);

const MiniCard = ({
  title,
  enabled,
  onToggle,
  children,
  columns = 2,
  className = '',
}: {
  title: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children?: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) => (
  <div className={`event-approval-mini-card ${className}`.trim()}>
    <div className="event-approval-section-heading with-toggle">
      <span>{title}</span>
      <Switch checked={enabled} onChange={onToggle} />
    </div>
    {enabled && children && (
      <div
        className={`event-approval-grid ${columns === 4 ? 'four' : columns === 3 ? 'three' : columns === 1 ? 'one' : 'two'}`}
      >
        {children}
      </div>
    )}
  </div>
);

const HeaderCollapseButton = ({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className="event-approval-header-collapse-button muted"
    onClick={onClick}
    title={expanded ? 'Collapse event' : 'Expand event'}
    aria-label={expanded ? 'Collapse event' : 'Expand event'}
    aria-expanded={expanded}
  >
    <svg
      width="16"
      height="12"
      viewBox="0 0 16 12"
      className={expanded ? 'open' : ''}
      aria-hidden="true"
    >
      <polyline
        points="2,2 8,8 14,2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  </button>
);

const IconActions = ({
  onAdd,
  onDelete,
  showAdd = true,
}: {
  onAdd: () => void;
  onDelete: () => void;
  showAdd?: boolean;
}) => (
  <div className="event-approval-icon-actions">
    {showAdd && (
      <button type="button" onClick={onAdd} title="Add row" aria-label="Add row">
        <Plus size={17} />
      </button>
    )}
    <button
      type="button"
      className="danger"
      onClick={onDelete}
      title="Delete row"
      aria-label="Delete row"
    >
      <Trash2 size={17} />
    </button>
  </div>
);

const CeremonyRow = ({
  label,
  enabled,
  toggleChecked,
  toggleDisabled = false,
  onToggle,
  date,
  time,
  venue,
  onDate,
  onTime,
  onVenue,
}: {
  label: string;
  enabled: boolean;
  toggleChecked?: boolean;
  toggleDisabled?: boolean;
  onToggle: (value: boolean) => void;
  date: string;
  time: string;
  venue: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  onVenue: (value: string) => void;
}) => (
  <div className={`event-approval-ceremony-row${enabled ? '' : ' is-disabled'}`}>
    <div className="event-approval-ceremony-label">
      <span>{label}</span>
      <Switch checked={toggleChecked ?? enabled} onChange={onToggle} disabled={toggleDisabled} />
    </div>
    <>
      <label>
        Date
        <input
          placeholder="DD/MM/YYYY"
          disabled={!enabled}
          className={date ? 'has-value' : 'is-placeholder'}
          type="date"
          value={date}
          onChange={(event) => onDate(event.target.value)}
        />
      </label>
      <label>
        Time
        <input
          placeholder="HH:MM"
          disabled={!enabled}
          className={time ? 'has-value' : 'is-placeholder'}
          type="time"
          value={time}
          onChange={(event) => onTime(event.target.value)}
        />
      </label>
      <label>
        Venue
        <input
          placeholder="Venue"
          disabled={!enabled}
          value={venue}
          onChange={(event) => onVenue(event.target.value)}
        />
      </label>
    </>
  </div>
);

export { EventApprovalCards };

// =========================================
// EventDashboard.tsx
// =========================================

interface EventData {
  id: number;
  status: string;
  proposedBy: string;
  category: string;
  department: string;
  time: string;
  name: string;
  venue: string;
  date: string;
  parent_id?: number | null;
  isSubEvent?: boolean;
}

interface APISubEvent {
  id: number;
  title?: string;
  status?: string;
  proposedBy?: string;
  category?: string;
  department?: string;
  date?: string;
  createdAt?: string;
  venue?: string;
}

interface APIMainEvent extends APISubEvent {
  sub_events?: APISubEvent[];
}

interface CalendarCell {
  date: Date;
  label: string;
  muted?: boolean;
  weekend?: boolean;
  active?: boolean;
}

type DashboardStatusKey =
  | 'all'
  | 'draft'
  | 'pending'
  | 'return'
  | 'reject'
  | 'approved'
  | 'archive';

interface DashboardStat {
  key: DashboardStatusKey;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}

const getEventIdentity = (event: Pick<EventData, 'id' | 'isSubEvent'>): string =>
  `${event.isSubEvent ? 'sub' : 'main'}-${event.id}`;

const STATUS_LABELS: Record<Exclude<DashboardStatusKey, 'all'>, string> = {
  draft: 'Draft',
  pending: 'Pending',
  return: 'Return',
  reject: 'Reject',
  approved: 'Approved',
  archive: 'Archive',
};

const getStatusDisplayLabel = (status: string): string => {
  const value = status.trim().toLowerCase();
  if (value === 'draft') return 'Draft';
  if (value === 'unknown' || value.length === 0) return 'Unknown';
  return STATUS_LABELS[normalizeStatus(status)];
};

const normalizeStatus = (status: string): Exclude<DashboardStatusKey, 'all'> => {
  const value = status.trim().toLowerCase();
  if (value === 'draft') return 'draft';
  if (value === 'pending') return 'pending';
  if (value === 'return') return 'return';
  if (value === 'rejected') return 'reject';
  if (value === 'approved' || value === 'completed') return 'approved';
  if (value === 'archived') return 'archive';
  return 'pending';
};

const getFiscalYearLabel = (date: string): string => {
  const year = new Date(date).getFullYear();
  return `FY ${year}-${String(year + 1).slice(-2)}`;
};

const matchesSearchTerm = (
  event: Pick<EventData, 'proposedBy' | 'category' | 'department' | 'name' | 'venue' | 'time'>,
  term: string,
): boolean => {
  if (term.length === 0) return true;
  return [event.proposedBy, event.category, event.department, event.name, event.venue, event.time]
    .join(' ')
    .toLowerCase()
    .includes(term);
};

const buildBellCalendar = (
  year: number,
  monthIndex: number,
  selectedDate: Date,
): CalendarCell[] => {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const firstWeekDay = firstOfMonth.getDay();
  const startDate = new Date(year, monthIndex, 1 - firstWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date,
      label: String(date.getDate()),
      muted: date.getMonth() !== monthIndex,
      weekend: date.getDay() === 0 || date.getDay() === 6,
      active:
        date.getFullYear() === selectedDate.getFullYear() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getDate() === selectedDate.getDate(),
    };
  });
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const ability = useAbility();
  const canEditEvents = ability.can('edit', 'Event');
  const canDeleteEvents = ability.can('delete', 'Event');
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<DashboardStatusKey>('all');
  const [showBellPreview, setShowBellPreview] = useState(false);
  const [showEventTypeModal, setShowEventTypeModal] = useState(false);
  const [activePendingId, setActivePendingId] = useState<string | null>(null);
  const [bellViewYear, setBellViewYear] = useState(new Date().getFullYear());
  const [bellViewMonth, setBellViewMonth] = useState(new Date().getMonth());
  const [bellSelectedDate, setBellSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventData[]>([]);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventData | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);

  const [subEventToDelete, setSubEventToDelete] = useState<EventData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: string;
    type: AlertType;
  }>({
    show: false,
    message: '',
    type: 'info',
  });

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (deleteModalVisible && deleteCountdown > 0) {
      timer = setTimeout(() => {
        setDeleteCountdown(deleteCountdown - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [deleteModalVisible, deleteCountdown]);

  React.useEffect(() => {
    let isMounted = true;

    const isAPISubEvent = (value: unknown): value is APISubEvent => {
      if (!value || typeof value !== 'object') return false;
      const candidate = value as Partial<APISubEvent>;
      return typeof candidate.id === 'number';
    };

    const isAPIMainEvent = (value: unknown): value is APIMainEvent =>
      isAPISubEvent(value) &&
      (!('sub_events' in value) ||
        value.sub_events === undefined ||
        (Array.isArray(value.sub_events) && value.sub_events.every(isAPISubEvent)));

    const isAPIMainEventArrayResponse = (value: unknown): value is { data: APIMainEvent[] } =>
      !!value &&
      typeof value === 'object' &&
      'data' in value &&
      Array.isArray((value as { data?: unknown }).data) &&
      (value as { data: unknown[] }).data.every(isAPIMainEvent);

    const handleResponse = (res: unknown) => {
      const data: APIMainEvent[] = Array.isArray(res)
        ? res.filter(isAPIMainEvent)
        : isAPIMainEventArrayResponse(res)
          ? res.data
          : [];

      if (!isMounted) return;

      // Flatten main and sub events
      const flattenedEvents: EventData[] = [];
      data.forEach((main: APIMainEvent) => {
        flattenedEvents.push({
          id: main.id,
          name: main.title || 'Untitled Event',
          status: main.status || 'Draft',
          proposedBy: main.proposedBy || 'N/A',
          category: main.category || 'N/A',
          department: main.department || 'N/A',
          time: main.date
            ? new Date(main.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'TBD',
          venue: main.venue || 'TBD',
          date: main.date || main.createdAt || new Date().toISOString(),
          parent_id: null,
          isSubEvent: false,
        });

        if (main.sub_events && main.sub_events.length > 0) {
          main.sub_events.forEach((sub: APISubEvent) => {
            flattenedEvents.push({
              id: sub.id,
              name: sub.title || 'Untitled Sub Event',
              status: sub.status || 'Draft',
              proposedBy: sub.proposedBy || 'N/A',
              category: sub.category || 'N/A',
              department: sub.department || 'N/A',
              time: sub.date
                ? new Date(sub.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'TBD',
              venue: sub.venue || 'TBD',
              date: sub.date || sub.createdAt || new Date().toISOString(),
              parent_id: main.id,
              isSubEvent: true,
            });
          });
        }
      });
      setEvents(flattenedEvents);
    };

    authenticityUtility
      .get<APIMainEvent[] | { data: APIMainEvent[] }>('/events')
      .then(handleResponse)
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching events:', err);
        setAlertConfig({
          show: true,
          message: 'Failed to fetch events. Please try again.',
          type: 'error',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);
  const years = useMemo(() => {
    const eventYears = Array.from(
      new Set(events.map((event) => new Date(event.date).getFullYear())),
    ).sort((a, b) => b - a);
    return eventYears.map((year) => `FY ${year}-${String(year + 1).slice(-2)}`);
  }, [events]);

  const stats = useMemo(() => {
    const counts: Record<DashboardStatusKey, number> = {
      all: 0,
      draft: 0,
      pending: 0,
      return: 0,
      reject: 0,
      approved: 0,
      archive: 0,
    };

    const term = searchTerm.trim().toLowerCase();

    events.forEach((event) => {
      const eventYear = getFiscalYearLabel(event.date);
      const matchesYear = yearFilter === 'all' || eventYear === yearFilter;
      const matchesSearch = matchesSearchTerm(event, term);

      if (matchesYear && matchesSearch) {
        counts.all += 1;
        counts[normalizeStatus(event.status)] += 1;
      }
    });

    return [
      { key: 'all', label: 'Total', value: counts.all, icon: Briefcase, tone: 'tone-total' },
      {
        key: 'pending',
        label: 'Pending',
        value: counts.pending,
        icon: Clock,
        tone: 'tone-pending',
      },
      {
        key: 'return',
        label: 'Return',
        value: counts.return,
        icon: RotateCcw,
        tone: 'tone-return',
      },
      { key: 'reject', label: 'Reject', value: counts.reject, icon: XCircle, tone: 'tone-reject' },
      {
        key: 'approved',
        label: 'Approved',
        value: counts.approved,
        icon: CheckCircle,
        tone: 'tone-approved',
      },
      {
        key: 'archive',
        label: 'Archive',
        value: counts.archive,
        icon: Archive,
        tone: 'tone-archive',
      },
    ] satisfies DashboardStat[];
  }, [events, yearFilter, searchTerm]);

  const filteredEventsByYearAndSearch = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return events.filter((event) => {
      const eventYear = getFiscalYearLabel(event.date);
      const matchesYear = yearFilter === 'all' || eventYear === yearFilter;
      const matchesSearch = matchesSearchTerm(event, term);
      return matchesYear && matchesSearch;
    });
  }, [events, searchTerm, yearFilter]);

  const filteredEvents = useMemo(() => {
    return filteredEventsByYearAndSearch.filter((event) => {
      const normalizedStatus = normalizeStatus(event.status);
      return selectedStatus === 'all' || normalizedStatus === selectedStatus;
    });
  }, [filteredEventsByYearAndSearch, selectedStatus]);

  const bellCalendar = useMemo(
    () => buildBellCalendar(bellViewYear, bellViewMonth, bellSelectedDate),
    [bellSelectedDate, bellViewMonth, bellViewYear],
  );

  const bellTitle = (() => {
    const day = String(bellSelectedDate.getDate()).padStart(2, '0');
    const month = String(bellSelectedDate.getMonth() + 1).padStart(2, '0');
    const year = bellSelectedDate.getFullYear();
    const weekday = bellSelectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    return `${day}.${month}.${year} (${weekday})`;
  })();

  const openEventTab = (eventId: number, tab: string): void => {
    if (!eventId) return;
    navigate(`/event/${eventId}?tab=${tab}`);
  };

  const handleDelete = (event: EventData): void => {
    if (!event || !event.id) return;
    if (!canDeleteEvents) return;

    if (event.isSubEvent) {
      setSubEventToDelete(event);
    } else {
      setEventToDelete(event);
      setDeleteCountdown(5);
      setDeleteModalVisible(true);
    }
  };

  const confirmSubEventDelete = () => {
    if (!subEventToDelete) return;
    setIsDeleting(true);
    const subEventIdentity = getEventIdentity(subEventToDelete);
    authenticityUtility
      .delete(`/events/${subEventToDelete.id}`)
      .then(() => {
        setEvents((prev) => prev.filter((e) => getEventIdentity(e) !== subEventIdentity));
        setSubEventToDelete(null);
      })
      .catch((err) => {
        console.error('Error deleting event:', err);
        setAlertConfig({ show: true, message: 'Failed to delete event.', type: 'error' });
        setSubEventToDelete(null);
      })
      .finally(() => setIsDeleting(false));
  };

  const executeDelete = () => {
    if (!eventToDelete) return;
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteModalVisible(false);
    const eventIdentity = getEventIdentity(eventToDelete);
    const eventId = eventToDelete.id;
    setEventToDelete(null);
    authenticityUtility
      .delete(`/events/${eventId}`)
      .then(() => {
        setEvents((prev) =>
          prev.filter((e) => getEventIdentity(e) !== eventIdentity && e.parent_id !== eventId),
        );
        setDeleteCountdown(5);
      })
      .catch((err) => {
        console.error('Error deleting event:', err);
        setAlertConfig({ show: true, message: 'Failed to delete event.', type: 'error' });
      })
      .finally(() => {
        setEventToDelete(null);
        setIsDeleting(false);
      });
  };

  const cancelDelete = () => {
    setDeleteModalVisible(false);
    setEventToDelete(null);
  };

  const handleKpiClick = (statusKey: DashboardStatusKey): void => {
    setSelectedStatus((current) => (current === statusKey ? 'all' : statusKey));
    setActivePendingId(null);
  };

  const openBellPreview = (): void => {
    const today = new Date();
    setBellViewYear(today.getFullYear());
    setBellViewMonth(today.getMonth());
    setBellSelectedDate(today);
    setShowBellPreview(true);
  };

  const goToBellToday = (): void => {
    const today = new Date();
    setBellViewYear(today.getFullYear());
    setBellViewMonth(today.getMonth());
    setBellSelectedDate(today);
  };

  const goToBellPrevMonth = (): void => {
    const nextMonth = bellViewMonth === 0 ? 11 : bellViewMonth - 1;
    const nextYear = bellViewMonth === 0 ? bellViewYear - 1 : bellViewYear;
    setBellViewMonth(nextMonth);
    setBellViewYear(nextYear);
    setBellSelectedDate(new Date(nextYear, nextMonth, 1));
  };

  const goToBellNextMonth = (): void => {
    const nextMonth = bellViewMonth === 11 ? 0 : bellViewMonth + 1;
    const nextYear = bellViewMonth === 11 ? bellViewYear + 1 : bellViewYear;
    setBellViewMonth(nextMonth);
    setBellViewYear(nextYear);
    setBellSelectedDate(new Date(nextYear, nextMonth, 1));
  };

  const handleBellMonthChange = (monthName: string): void => {
    const nextMonthIndex = EVENT_DASHBOARD_MONTHS.indexOf(monthName);
    if (nextMonthIndex < 0) return;
    setBellViewMonth(nextMonthIndex);
    setBellSelectedDate(new Date(bellViewYear, nextMonthIndex, 1));
  };

  const handleBellYearChange = (yearValue: string): void => {
    const nextYear = Number(yearValue);
    if (!Number.isFinite(nextYear)) return;
    setBellViewYear(nextYear);
    setBellSelectedDate(new Date(nextYear, bellViewMonth, 1));
  };

  const currentBellMonthLabel = EVENT_DASHBOARD_MONTHS[bellViewMonth];
  const selectedBellEvents = events.filter((event) => {
    const eventDate = new Date(event.date);
    return (
      eventDate.getFullYear() === bellSelectedDate.getFullYear() &&
      eventDate.getMonth() === bellSelectedDate.getMonth() &&
      eventDate.getDate() === bellSelectedDate.getDate()
    );
  });

  return (
    <div className="event-dashboard-shell">
      <section className="event-dashboard-card">
        <header className="event-dashboard-header">
          <div className="event-dashboard-title-wrap">
            <h1 className="event-dashboard-title">Event Requests</h1>
          </div>

          <div className="event-dashboard-toolbar">
            <label className="event-dashboard-search">
              <Search size={20} className="event-dashboard-search-icon" />
              <input
                type="search"
                placeholder="Search event name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
            <label className="event-dashboard-select">
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="all">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="event-dashboard-bell-btn"
              onClick={openBellPreview}
              aria-label="Open event calendar preview"
              title="Open event calendar preview"
            >
              <Bell size={18} />
            </button>

            <button
              type="button"
              className="event-dashboard-add-btn"
              onClick={() => setShowEventTypeModal(true)}
            >
              Add +
            </button>
          </div>
        </header>

        <section className="event-dashboard-stats">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                type="button"
                className={`event-stat-card ${stat.tone}${selectedStatus === stat.key ? ' is-active' : ''}`}
                onClick={() => handleKpiClick(stat.key)}
                aria-pressed={selectedStatus === stat.key}
              >
                <div className="event-stat-icon">
                  <Icon size={20} />
                </div>
                <div className="event-stat-copy">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              </button>
            );
          })}
        </section>

        <section className="event-dashboard-list">
          {filteredEvents.length === 0 ? (
            <div className="event-dashboard-empty-state">
              <h2>No events found</h2>
              <p>Try adjusting your search or filters.</p>
            </div>
          ) : (
            filteredEvents.map((event) => {
              return (
                <article key={getEventIdentity(event)} className="event-request-card">
                  {(() => {
                    const normalizedStatus = normalizeStatus(event.status);
                    const hideEdit = normalizedStatus === 'approved';
                    const hideDelete = normalizedStatus === 'reject';

                    return (
                      <div className="event-request-row event-request-row--top">
                        <div className="event-request-head-left">
                          <span
                            className="event-request-id"
                            style={{
                              minWidth: '80px',
                              color: event.isSubEvent ? '#64748b' : undefined,
                            }}
                          >
                            #EV-{new Date(event.date || new Date()).getFullYear()}-
                            {String(event.id).padStart(4, '0')}
                          </span>
                          <span className="event-request-name">{event.proposedBy}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="event-request-type-badge">{event.category}</span>
                            <span
                              className="event-request-type-badge"
                              style={{
                                backgroundColor: event.isSubEvent ? '#f1f5f9' : '#eff6ff',
                                color: event.isSubEvent ? '#475569' : '#1d4ed8',
                                fontWeight: 600,
                              }}
                            >
                              {event.isSubEvent ? '[Sub Event]' : '[Main Event]'}
                            </span>
                          </div>
                        </div>

                        <div className="event-request-head-right">
                          <div className="event-request-amount">
                            <span>Date</span>
                            <strong>
                              {(() => {
                                const d = new Date(event.date);
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = d.getFullYear();
                                return `${day}-${month}-${year}`;
                              })()}
                            </strong>
                          </div>

                          <div className="event-request-mini-actions">
                            <button
                              type="button"
                              className="event-request-mini-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEventTab(event.id, 'updates');
                              }}
                              aria-label="Info"
                              title="Info"
                            >
                              <Info size={16} />
                            </button>
                            <button
                              type="button"
                              className="event-request-mini-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEventTab(event.id, 'pre-event');
                              }}
                              aria-label="View"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            {canEditEvents && !hideEdit && (
                              <button
                                type="button"
                                className="event-request-mini-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEventTab(event.id, 'edit');
                                }}
                                aria-label="Edit"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {canDeleteEvents && !hideDelete && (
                              <button
                                type="button"
                                className="event-request-mini-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(event);
                                }}
                                aria-label="Delete"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="event-request-row event-request-row--bottom">
                    <div
                      className="event-request-bottom-left"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {event.isSubEvent && (
                        <span
                          style={{
                            backgroundColor: '#e2e8f0',
                            color: '#475569',
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            marginRight: '8px',
                          }}
                        >
                          SUB EVENT
                        </span>
                      )}
                      <span className="event-request-beneficiary-value">{event.name}</span>
                    </div>

                    <div className="event-request-actions">
                      {(() => {
                        const normalizedStatus = normalizeStatus(event.status);
                        const isClickableStatus =
                          normalizedStatus === 'pending' ||
                          normalizedStatus === 'approved' ||
                          normalizedStatus === 'reject';
                        const eventIdentity = getEventIdentity(event);
                        const showSteps = isClickableStatus && activePendingId === eventIdentity;

                        return (
                          <>
                            <button
                              type="button"
                              className="event-request-doc-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEventTab(event.id, 'updates');
                              }}
                              aria-label="Open documents"
                              title="Open documents"
                            >
                              <ClipboardList size={16} />
                            </button>

                            <button
                              type="button"
                              className={`event-request-status event-request-status--${normalizedStatus}${
                                isClickableStatus ? ' is-clickable' : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isClickableStatus) return;
                                setActivePendingId(
                                  activePendingId === eventIdentity ? null : eventIdentity,
                                );
                              }}
                              aria-pressed={showSteps}
                              disabled={!isClickableStatus}
                            >
                              {STATUS_LABELS[normalizedStatus]}
                            </button>

                            {showSteps && (
                              <div
                                className="event-request-progress"
                                aria-label="Three approval steps"
                              >
                                <span
                                  className="event-request-progress-step is-active"
                                  aria-hidden="true"
                                />
                                <span className="event-request-progress-line" aria-hidden="true" />
                                <span
                                  className={`event-request-progress-step ${
                                    normalizedStatus === 'approved' ||
                                    normalizedStatus === 'pending'
                                      ? 'is-active'
                                      : ''
                                  }`}
                                  aria-hidden="true"
                                />
                                <span className="event-request-progress-line" aria-hidden="true" />
                                <span
                                  className={`event-request-progress-step ${
                                    normalizedStatus === 'approved' ? 'is-active' : ''
                                  }`}
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </section>

      {showBellPreview && (
        <CustomModal
          show={showBellPreview}
          onHide={() => setShowBellPreview(false)}
          title="Event Calendar"
          size="lg"
        >
          <div className="event-bell-modal">
            <div className="event-bell-panel">
              <div className="event-bell-left">
                <h2 className="event-bell-left-title">Events scheduled on {bellTitle}</h2>
                {selectedBellEvents.length === 0 ? (
                  <p className="event-bell-left-empty">No events scheduled for this day.</p>
                ) : (
                  <ul className="event-bell-event-list">
                    {selectedBellEvents.map((event) => (
                      <li key={getEventIdentity(event)}>
                        <button
                          type="button"
                          className="event-bell-event-link"
                          onClick={() => openEventTab(event.id, 'pre-event')}
                        >
                          {event.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="event-bell-right">
                <div className="event-bell-calendar-header">
                  <h3>Event Calendar</h3>
                </div>

                <div className="event-bell-calendar-controls">
                  <button type="button" className="event-bell-today-btn" onClick={goToBellToday}>
                    Today
                  </button>
                  <button
                    type="button"
                    className="event-bell-nav-btn"
                    aria-label="Previous month"
                    onClick={goToBellPrevMonth}
                  >
                    {'<'}
                  </button>
                  <div className="event-bell-month-label">
                    {currentBellMonthLabel} {bellViewYear}
                  </div>
                  <button
                    type="button"
                    className="event-bell-nav-btn"
                    aria-label="Next month"
                    onClick={goToBellNextMonth}
                  >
                    {'>'}
                  </button>
                  <select
                    className="event-bell-select"
                    value={currentBellMonthLabel}
                    onChange={(e) => handleBellMonthChange(e.target.value)}
                  >
                    {EVENT_DASHBOARD_MONTHS.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <select
                    className="event-bell-select"
                    value={String(bellViewYear)}
                    onChange={(e) => handleBellYearChange(e.target.value)}
                  >
                    {Array.from(
                      new Set([
                        ...Array.from(
                          { length: 7 },
                          (_, index) => new Date().getFullYear() - 3 + index,
                        ),
                        bellViewYear,
                      ]),
                    )
                      .sort((a, b) => a - b)
                      .map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="event-bell-calendar-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="event-bell-day-head">
                      {day}
                    </div>
                  ))}

                  {bellCalendar.map((day, index) => (
                    <button
                      key={`${day.date.toISOString()}-${index}`}
                      className={[
                        'event-bell-day-cell',
                        day.muted ? 'muted' : '',
                        day.weekend ? 'weekend' : '',
                        day.active ? 'active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      type="button"
                      tabIndex={0}
                      onClick={() => {
                        if (day.muted) return;
                        setBellSelectedDate(day.date);
                        setBellViewYear(day.date.getFullYear());
                        setBellViewMonth(day.date.getMonth());
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (day.muted) return;
                          setBellSelectedDate(day.date);
                          setBellViewYear(day.date.getFullYear());
                          setBellViewMonth(day.date.getMonth());
                        }
                      }}
                    >
                      <span>{day.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CustomModal>
      )}

      <CustomModal
        show={deleteModalVisible}
        onHide={cancelDelete}
        title="Delete Event"
        size="sm"
        footer={
          <div className="d-flex justify-content-end gap-2 w-100">
            <button className="btn btn-secondary btn-sm" onClick={cancelDelete}>
              Cancel
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={executeDelete}
              disabled={Boolean(
                eventToDelete?.parent_id == null &&
                eventToDelete &&
                events.some((event) => event.parent_id === eventToDelete.id) &&
                deleteCountdown > 0,
              )}
            >
              Delete Now
            </button>
          </div>
        }
      >
        <p className="mb-0 fw-medium" style={{ fontSize: '0.95rem' }}>
          {eventToDelete &&
          eventToDelete.parent_id == null &&
          events.some((event) => event.parent_id === eventToDelete.id) ? (
            <>
              This Main Event has associated Sub Events. Deleting this Main Event will permanently
              delete all related Sub Events.
            </>
          ) : (
            <>Please confirm if you wish to proceed.</>
          )}
          <span aria-live="polite" className="d-block mt-2">
            {eventToDelete &&
            eventToDelete.parent_id == null &&
            events.some((event) => event.parent_id === eventToDelete.id) &&
            deleteCountdown > 0 ? (
              <>
                You can confirm this action in{' '}
                <strong className="text-danger">{deleteCountdown}</strong> seconds.
              </>
            ) : null}
          </span>
        </p>
      </CustomModal>

      <DeleteConfirmationModal
        show={!!subEventToDelete}
        onHide={() => setSubEventToDelete(null)}
        onConfirm={confirmSubEventDelete}
        itemName={subEventToDelete?.name || `Event ${subEventToDelete?.id}`}
        isDeleting={isDeleting}
      />

      {showEventTypeModal && (
        <div className="category-modal-overlay" onClick={() => setShowEventTypeModal(false)}>
          <div className="category-modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="category-modal-header">
              <h5 className="category-modal-title">Select Event Type</h5>
              <button
                type="button"
                className="category-modal-close"
                onClick={() => setShowEventTypeModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="category-modal-body">
              <div className="row g-3">
                <div className="col-6">
                  <button
                    type="button"
                    className="category-btn"
                    onClick={() => {
                      setShowEventTypeModal(false);
                      navigate('/event/new?tab=pre-event');
                    }}
                  >
                    <Calendar size={28} style={{ display: 'block', margin: '0 auto 8px auto' }} />
                    Main Event
                  </button>
                </div>
                <div className="col-6">
                  <button
                    type="button"
                    className="category-btn"
                    onClick={() => {
                      setShowEventTypeModal(false);
                      navigate('/event/new?isSubEvent=true&tab=pre-event');
                    }}
                  >
                    <Layers size={28} style={{ display: 'block', margin: '0 auto 8px auto' }} />
                    Sub Event
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        show={alertConfig.show}
        onHide={() => setAlertConfig((prev) => ({ ...prev, show: false }))}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </div>
  );
};

export { Dashboard };

// =========================================
// EventDetailsPopup.tsx
// =========================================

interface EventData {
  name: string;
  category: string;
  department: string;
  time: string;
  venue: string;
  date: string;
}

interface EventDetailsPopupProps {
  event: EventData | null;
  onClose: () => void;
}

const EventDetailsPopup: React.FC<EventDetailsPopupProps> = ({ event, onClose }) => {
  if (!event) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="popup-close-btn" onClick={onClose}>
          <X size={16} />
        </button>
        <h2 className="popup-title">{event.name}</h2>

        <div className="popup-details">
          <div className="popup-detail">
            <Layers size={16} className="icon" />
            <span>
              <strong>Category:</strong> {event.category}
            </span>
          </div>
          <div className="popup-detail">
            <Building2 size={16} className="icon" />
            <span>
              <strong>Department:</strong> {event.department}
            </span>
          </div>
          <div className="popup-detail">
            <Clock size={16} className="icon" />
            <span>
              <strong>Time:</strong> {event.time}
            </span>
          </div>
          <div className="popup-detail">
            <MapPin size={16} className="icon" />
            <span>
              <strong>Venue:</strong> {event.venue}
            </span>
          </div>
          <div className="popup-detail">
            <MapPin size={16} className="icon" />
            <span>
              <strong>Date:</strong> {event.date}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export { EventDetailsPopup };

// =========================================
// EventPage.tsx
// =========================================

const SUB_EVENT_TAB_IDS = ['pre-event', 'participants', 'feedback', 'certificate'] as const;

interface EventSummary {
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  feedbackEnabled?: boolean;
  teamEnabled?: boolean;
  documentEnabled?: boolean;
  accommodationEnabled?: boolean;
  registrationFeeEnabled?: boolean;
  certificateEnabled?: boolean;
}

interface TabConfig {
  id: string;
  label: string;
  component: React.ComponentType<{
    goToTab: (tab: string) => void;
    eventId?: string;
    isSubEvent?: boolean;
    summary?: EventSummary | null;
  }>;
}

const EventPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('pre-event');
  const [summary, setSummary] = useState<EventSummary | null>(null);

  const isSubEvent = new URLSearchParams(location.search).get('isSubEvent') === 'true';
  const requestedTab = new URLSearchParams(location.search).get('tab');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTabParam = params.get('tab');

    let allowedTabs = new Set([
      'pre-event',
      'finance',
      'updates',
      'participants',
      'feedback',
      'certificate',
    ]);

    if (isSubEvent) {
      allowedTabs = new Set(SUB_EVENT_TAB_IDS);
    }

    if (requestedTabParam && allowedTabs.has(requestedTabParam)) {
      setActiveTab(requestedTabParam);
      return;
    }

    setActiveTab('pre-event');
  }, [location.search, isSubEvent]);

  useEffect(() => {
    if (!eventId || eventId === 'new') return;
    authenticityUtility
      .get(`/events/${eventId}/summary`)
      .then((res) => setSummary(res as unknown as EventSummary))
      .catch((err: unknown) => console.error('Failed to load summary:', err));
  }, [eventId]);

  const tabs: any[] = EVENT_PAGE_TABS.map((tab) => ({
    ...tab,
    component:
      tab.id === 'pre-event'
        ? PreEvent
        : tab.id === 'finance'
          ? SponsoringAgencySection
          : tab.id === 'updates'
            ? EventUpdates
            : tab.id === 'participants'
              ? ParticipantDetails
              : tab.id === 'feedback'
                ? Feedback
                : EventCertificate,
  }));

  const renderContent = () => {
    const active = tabs.find((tab) => tab.id === activeTab);
    if (!active) return null;
    const Component = active.component;
    const content = (
      <Component
        goToTab={setActiveTab}
        eventId={eventId}
        isSubEvent={isSubEvent}
        summary={summary}
      />
    );

    return content;
  };

  return (
    <>
      <RecordHeaderBanner
        referenceLabel="Event ID"
        referenceValue={eventId && eventId !== 'new' ? eventId : null}
      />
      <div className="event-page">
        <div className="event-form-navigation">
          {tabs
            .filter(
              (tab) =>
                !isSubEvent ||
                SUB_EVENT_TAB_IDS.includes(tab.id as (typeof SUB_EVENT_TAB_IDS)[number]),
            )
            .map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
        </div>

        <div className="event-tab-content">{renderContent()}</div>
      </div>
    </>
  );
};

export { EventPage };

// =========================================
// EventUpdates.tsx
// =========================================

// --- Letters Section ---

const sections = EVENT_UPDATE_LETTERS_SECTIONS;
const participantTypes_1 = DOCUMENT_PARTICIPANT_TYPES;
const documentNames = EVENT_DOCUMENTS;

interface LetterSectionData {
  active: boolean;
  mode: string;
  date: string;
  file: File | null;
}

interface LettersPageProps {
  formData: Record<string, LetterSectionData>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, LetterSectionData>>>;
}

interface ResourcePersonRow {
  dbId?: number;
  id: number;
  name: string;
  designation: string;
  organization: string;
  email: string;
  linkedin: string;
  location?: string;
  uploadedFile?: string;
  fileName?: string;
  purpose?: string;
  mode?: 'Online' | 'Offline';
  date?: string;
  time?: string;
  hasTitle?: boolean;
  title?: string;
  invitationStatus?: 'Not Sent' | 'Sent';
  thanksStatus?: 'Not Sent' | 'Sent';
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

interface ResourcePersonProps {
  rows: ResourcePersonRow[];
  setRows: React.Dispatch<React.SetStateAction<ResourcePersonRow[]>>;
  showAlert: (message: string, type?: AlertType, title?: string) => void;
}

interface InitialForm {
  name: string;
  designation: string;
  organization: string;
  email: string;
  linkedin: string;
  mobile: string;
  location: string;
}

interface ParticipantRow {
  id: number;
  type: string;
  label: string;
  count: number;
}

interface DocumentRowState {
  active: boolean;
  file: any | (File | null)[] | null;
}

const LettersPage: React.FC<LettersPageProps> = ({ formData, setFormData }) => {
  const handleToggle = (section: string): void => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], active: !prev[section].active },
    }));
  };

  const handleInputChange = (section: string, field: string, value: string): void => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const handleSendMail = (section: string): void => {
    window.location.href = `mailto:?subject=${encodeURIComponent(section)}`;
  };

  return (
    <div className="event-card-section event-form-section event-updates-panel event-letters-card">
      <h2 className="event-section-title">Letters</h2>
      {sections.map((section) => (
        <div key={section} className="event-row-section event-letter-row">
          <span className="event-letter-label">{section}</span>
          <div className="event-letter-actions">
            <div className="event-letter-buttons">
              <button type="button" className="event-letter-preview-btn" disabled>
                {EVENT_COPY.preview}
              </button>
              <button
                type="button"
                className="event-letter-send-btn"
                onClick={() => handleSendMail(section)}
              >
                {EVENT_COPY.sendMail}
              </button>
              <span className="event-letter-status">
                <Info size={16} /> {EVENT_COPY.notSent}
              </span>
            </div>
          </div>
          <input
            type="date"
            className="event-letters-date"
            value={formData[section].date}
            onChange={(e) => handleInputChange(section, 'date', e.target.value)}
          />
        </div>
      ))}
    </div>
  );
};

interface ParticipantsCardProps {
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
}

const ParticipantsCard: React.FC<ParticipantsCardProps> = ({ participants, setParticipants }) => {
  const [selectedType, setSelectedType] = useState('');
  const [count, setCount] = useState('');

  const canAdd = selectedType !== '' && count !== '' && !isNaN(Number(count));
  const total = participants.reduce((sum, participant) => sum + participant.count, 0);

  const handleAdd = (): void => {
    if (!canAdd) return;

    const foundType = participantTypes_1.find((type) => type.value === selectedType);
    setParticipants((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: selectedType,
        label: foundType?.label || selectedType,
        count: parseInt(count, 10),
      },
    ]);
    setSelectedType('');
    setCount('');
  };

  const handleDelete = (index: number): void => {
    setParticipants((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div className="event-card-section event-participants-card">
      <div className="participants-header">
        <div className="participants-header-copy">
          <h2 className="event-section-title">Participants</h2>
          <p>Choose a participant type, set the count, and keep the summary table neat below.</p>
        </div>
        <div className="participants-total-badge">
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div className="event-participant-card participants-entry-card">
        <div className="participants-entry-grid">
          <div className="participants-field participants-type-field">
            <select
              className="event-participant-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">-- Select Participant Type --</option>
              {participantTypes_1.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="participants-field participants-count-field">
            <input
              type="number"
              min="0"
              className="event-participant-input"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="0"
            />
          </div>

          <button
            type="button"
            className="event-add event-participant-add"
            onClick={handleAdd}
            disabled={!canAdd}
            title="Add participant"
            aria-label="Add participant"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {participants.length > 0 && (
        <div className="participants-table-card">
          <div className="event-participants-table-wrap">
            <table className="event-participants-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Participant Type</th>
                  <th>Count</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant, index) => (
                  <tr key={participant.id}>
                    <td>{index + 1}</td>
                    <td>{participant.label}</td>
                    <td>{participant.count}</td>
                    <td>
                      <button
                        type="button"
                        className="event-cancel-btn"
                        onClick={() => handleDelete(index)}
                        style={{
                          color: 'black',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '16px',
                        }}
                        aria-label="Delete participant"
                        title="Delete participant"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

interface DocumentsCardProps {
  docState: Record<string, DocumentRowState>;
  setany: React.Dispatch<React.SetStateAction<Record<string, DocumentRowState>>>;
}

const DocumentsCard: React.FC<DocumentsCardProps> = ({ docState, setany }) => {
  const handleFileUpload = (
    doc: string,
    event: React.ChangeEvent<HTMLInputElement>,
    index: number | null = null,
  ): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    setany((prev) => {
      if (doc === 'Photos' && index !== null) {
        const currentFiles = prev[doc].file as (File | null)[];
        const nextFiles = [...currentFiles];
        nextFiles[index] = file;
        return {
          ...prev,
          [doc]: { ...prev[doc], file: nextFiles },
        };
      }

      return {
        ...prev,
        [doc]: { ...prev[doc], file },
      };
    });
  };

  const handleViewFile = (doc: string, index: number | null = null): void => {
    const docData = docState[doc];
    const file =
      doc === 'Photos' && index !== null
        ? (docData.file as (File | null)[])[index]
        : (docData.file as File | null);

    if (!file) return;

    const fileURL = URL.createObjectURL(file);
    window.open(fileURL, '_blank');
  };

  const handleToggle = (doc: string): void => {
    setany((prev) => ({
      ...prev,
      [doc]: {
        ...prev[doc],
        active: !prev[doc].active,
      },
    }));
  };

  const renderDocRow = (doc: string): React.ReactNode => {
    if (doc === 'Photos') {
      const photoFiles = docState[doc].file as (File | null)[];
      return (
        <div className="event-doc-row event-doc-row-photos" key={doc}>
          <span className="event-doc-label">{doc}</span>
          <div className="event-doc-actions event-doc-actions-photos">
            {photoFiles.map((photo, i) => (
              <div key={i} className="event-photo-pair">
                <label
                  className="event-photo-slot event-photo-slot-upload"
                  title={photo ? 'Replace photo' : 'Upload photo'}
                >
                  <CloudUpload size={20} />
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(doc, e, i)}
                    style={{ display: 'none' }}
                  />
                </label>

                <button
                  type="button"
                  className={`event-photo-slot event-photo-slot-view ${!photo ? 'disabled' : ''}`}
                  onClick={() => photo && handleViewFile(doc, i)}
                  title={photo ? 'View photo' : 'No photo uploaded'}
                  disabled={!photo}
                >
                  <Eye size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="event-doc-row" key={doc}>
        <span className="event-doc-label">{doc}</span>
        <div className="event-doc-actions">
          <label className="event-upload-icon">
            <CloudUpload size={16} />
            <input
              type="file"
              onChange={(e) => handleFileUpload(doc, e)}
              style={{ display: 'none' }}
            />
          </label>
          <button
            type="button"
            className={`event-eye-icon ${!docState[doc].file ? 'disabled' : ''}`}
            onClick={() => docState[doc].file && handleViewFile(doc)}
            aria-label={docState[doc].file ? 'View document' : 'No document uploaded'}
            title={docState[doc].file ? 'View document' : 'No document uploaded'}
            disabled={!docState[doc].file}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Eye size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="event-card-section event-documents-card">
      <h2 className="event-section-title">Documents</h2>
      <div className="event-docs-grid">{documentNames.map(renderDocRow)}</div>
    </div>
  );
};

const Modal: React.FC<ModalProps> = ({ open, onClose, children }) =>
  open ? (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          minWidth: 350,
          padding: 24,
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: 14,
            top: 11,
            border: 'none',
            background: 'none',
            fontSize: 18,
            cursor: 'pointer',
          }}
          aria-label="Close"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  ) : null;

const initialForm: InitialForm = {
  name: '',
  designation: '',
  organization: '',
  email: '',
  linkedin: '',
  mobile: '',
  location: '',
};

// --- Resource Person Section ---
const ResourcePerson: React.FC<ResourcePersonProps> = ({ rows, setRows, showAlert }) => {
  const handleAdd = (): void => {
    setRows([
      ...rows,
      {
        id: Date.now(),
        name: '',
        designation: '',
        organization: '',
        email: '',
        linkedin: '',
        location: '',
        purpose: '',
        mode: 'Offline',
        date: '',
        time: '',
        hasTitle: false,
        title: '',
        invitationStatus: 'Not Sent',
        thanksStatus: 'Not Sent',
      },
    ]);
  };

  const handleDelete = (id: number): void => {
    if (rows.length > 1) {
      setRows(rows.filter((row) => row.id !== id));
    }
  };

  const handleChange = (id: number, field: keyof ResourcePersonRow, value: any): void => {
    setRows(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  return (
    <section className="event-updates-resource-shell">
      <div className="resource-person-list">
        {rows.map((row, index) => (
          <article className="event-approval-card form-card" key={row.id}>
            <div className="event-approval-title-row">
              <h2>
                {EVENT_COPY.resourcePersonLabel} {index + 1}
              </h2>
              <div className="event-approval-icon-actions">
                <button
                  type="button"
                  className="resource-person-add-btn"
                  onClick={handleAdd}
                  title="Add resource person"
                  aria-label="Add resource person"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    background: '#0f6fc6',
                    color: '#fff',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="muted"
                    onClick={() => handleDelete(row.id)}
                    title="Remove resource person"
                    aria-label="Remove resource person"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: '4px',
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="event-approval-grid two" style={{ marginTop: '24px' }}>
              <div
                className="event-approval-inline-box"
                style={{
                  background: '#fff',
                  border: 'none',
                  padding: 0,
                  minHeight: 'auto',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    color: '#475467',
                    fontWeight: 700,
                    fontSize: '14px',
                    textAlign: 'left',
                    minWidth: '95px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Name
                </span>
                <input
                  type="text"
                  value={row.name || ''}
                  onChange={(e) => handleChange(row.id, 'name', e.target.value)}
                  style={{
                    flex: 1,
                    border: '1px solid #d4dbe4',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                />
              </div>
              <div
                className="event-approval-inline-box"
                style={{
                  background: '#fff',
                  border: 'none',
                  padding: 0,
                  minHeight: 'auto',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    color: '#475467',
                    fontWeight: 700,
                    fontSize: '14px',
                    textAlign: 'left',
                    minWidth: '95px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Designation
                </span>
                <input
                  type="text"
                  value={row.designation || ''}
                  onChange={(e) => handleChange(row.id, 'designation', e.target.value)}
                  style={{
                    flex: 1,
                    border: '1px solid #d4dbe4',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                />
              </div>
            </div>

            <div className="event-approval-grid two" style={{ marginTop: '16px' }}>
              <div
                className="event-approval-inline-box"
                style={{
                  background: '#fff',
                  border: 'none',
                  padding: 0,
                  minHeight: 'auto',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    color: '#475467',
                    fontWeight: 700,
                    fontSize: '14px',
                    textAlign: 'left',
                    minWidth: '95px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Organization
                </span>
                <input
                  type="text"
                  value={row.organization || ''}
                  onChange={(e) => handleChange(row.id, 'organization', e.target.value)}
                  style={{
                    flex: 1,
                    border: '1px solid #d4dbe4',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                />
              </div>
              <div
                className="event-approval-inline-box"
                style={{
                  background: '#fff',
                  border: 'none',
                  padding: 0,
                  minHeight: 'auto',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    color: '#475467',
                    fontWeight: 700,
                    fontSize: '14px',
                    textAlign: 'left',
                    minWidth: '95px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Email
                </span>
                <input
                  type="email"
                  value={row.email || ''}
                  onChange={(e) => handleChange(row.id, 'email', e.target.value)}
                  style={{
                    flex: 1,
                    border: '1px solid #d4dbe4',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                />
              </div>
            </div>

            <div style={{ height: '1px', background: '#e1e7ef', margin: '20px 0' }} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(220px, 1.2fr) minmax(180px, 1fr) minmax(150px, 0.8fr) minmax(130px, 0.7fr)',
                gap: '16px',
                alignItems: 'center',
              }}
            >
              <div
                className="event-approval-inline-box"
                style={{
                  background: '#fff',
                  border: 'none',
                  padding: 0,
                  minHeight: 'auto',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    color: '#475467',
                    fontWeight: 700,
                    fontSize: '14px',
                    textAlign: 'left',
                    minWidth: '60px',
                  }}
                >
                  Purpose
                </span>
                <select
                  value={row.purpose || ''}
                  onChange={(e) => handleChange(row.id, 'purpose', e.target.value)}
                  style={{
                    flex: 1,
                    border: '1px solid #d4dbe4',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    height: '42px',
                  }}
                >
                  <option value="">-- Select Purpose --</option>
                  <option value="Guest Lecture">Guest Lecture</option>
                  <option value="Keynote Speaker">Keynote Speaker</option>
                  <option value="Session Chair">Session Chair</option>
                  <option value="Valedictory Address">Valedictory Address</option>
                  <option value="Inaugural Address">Inaugural Address</option>
                  <option value="Panelist">Panelist</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div
                className="event-approval-inline-box"
                style={{
                  background: '#fff',
                  border: 'none',
                  padding: 0,
                  minHeight: 'auto',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    color: '#475467',
                    fontWeight: 700,
                    fontSize: '14px',
                    textAlign: 'left',
                    minWidth: '40px',
                  }}
                >
                  Mode
                </span>
                <div className="event-approval-segmented" style={{ flex: 1 }}>
                  <div>
                    <button
                      type="button"
                      className={row.mode === 'Online' ? 'active' : ''}
                      onClick={() => handleChange(row.id, 'mode', 'Online')}
                    >
                      Online
                    </button>
                    <button
                      type="button"
                      className={row.mode !== 'Online' ? 'active' : ''}
                      onClick={() => handleChange(row.id, 'mode', 'Offline')}
                    >
                      Offline
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="event-approval-inline-box"
                style={{
                  background: '#fff',
                  border: 'none',
                  padding: 0,
                  minHeight: 'auto',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{ color: '#475467', fontWeight: 700, fontSize: '14px', textAlign: 'left' }}
                >
                  Date
                </span>
                <input
                  type="date"
                  value={row.date || ''}
                  onChange={(e) => handleChange(row.id, 'date', e.target.value)}
                  style={{
                    flex: 1,
                    border: '1px solid #d4dbe4',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    height: '42px',
                  }}
                />
              </div>

              <div
                className="event-approval-inline-box"
                style={{
                  background: '#fff',
                  border: 'none',
                  padding: 0,
                  minHeight: 'auto',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{ color: '#475467', fontWeight: 700, fontSize: '14px', textAlign: 'left' }}
                >
                  Time
                </span>
                <input
                  type="time"
                  value={row.time || ''}
                  onChange={(e) => handleChange(row.id, 'time', e.target.value)}
                  style={{
                    flex: 1,
                    border: '1px solid #d4dbe4',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    height: '42px',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '12px',
                marginTop: '20px',
                minHeight: '56px',
              }}
            >
              <span
                style={{ fontWeight: 700, color: '#475467', minWidth: '60px', fontSize: '14px' }}
              >
                Title
              </span>
              <label
                className="event-approval-switch"
                style={{ margin: 0, display: 'flex', alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={!!row.hasTitle}
                  onChange={(e) => handleChange(row.id, 'hasTitle', e.target.checked)}
                />
                <span />
              </label>
              <input
                type="text"
                value={row.title || ''}
                onChange={(e) => handleChange(row.id, 'title', e.target.value)}
                disabled={!row.hasTitle}
                placeholder={row.hasTitle ? '' : ''}
                style={{
                  flex: 1,
                  visibility: row.hasTitle ? 'visible' : 'hidden',
                  background: '#fff',
                  border: '1px solid #d4dbe4',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              />
            </div>

            <div
              className="event-approval-band registration"
              style={{
                marginTop: '24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '16px',
                background: 'transparent',
                border: 'none',
                padding: 0,
              }}
            >
              <div
                className="event-approval-registration-box"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#f0f6ff',
                  border: '1px solid #d4e3f3',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      border: '1px solid #8cb4db',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0069ab',
                      background: '#fff',
                    }}
                  >
                    <Mail size={18} />
                  </div>
                  <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>
                    Invitation
                  </span>
                </div>
                <div
                  className="event-approval-toggle-pair-buttons"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      showAlert(
                        `Previewing Invitation for ${row.name || EVENT_COPY.resourcePersonLabel}`,
                        'info',
                        'Preview',
                      )
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#e1f0ff',
                      border: 'none',
                      color: '#0f6fc6',
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={14} /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = `mailto:${row.email || ''}?subject=${encodeURIComponent(EVENT_MAIL_TEMPLATES.invitationSubject(row.name || ''))}&body=${encodeURIComponent(EVENT_MAIL_TEMPLATES.invitationBody(row.name || ''))}`;
                      handleChange(row.id, 'invitationStatus', 'Sent');
                    }}
                    style={{
                      display: 'inline-flex',
                      background: '#0f6fc6',
                      border: 'none',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {EVENT_COPY.sendMail}
                  </button>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: '#64748b',
                      minWidth: '70px',
                      marginLeft: '4px',
                    }}
                  >
                    <Info size={14} /> {row.invitationStatus || EVENT_COPY.notSent}
                  </span>
                </div>
              </div>

              <div
                className="event-approval-registration-box"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#f0f6ff',
                  border: '1px solid #d4e3f3',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      border: '1px solid #8cb4db',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0069ab',
                      background: '#fff',
                    }}
                  >
                    <Mail size={18} />
                  </div>
                  <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>
                    Thanks
                  </span>
                </div>
                <div
                  className="event-approval-toggle-pair-buttons"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      showAlert(
                        `Previewing Thank You letter for ${row.name || EVENT_COPY.resourcePersonLabel}`,
                        'info',
                        'Preview',
                      )
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#e1f0ff',
                      border: 'none',
                      color: '#0f6fc6',
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={14} /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = `mailto:${row.email || ''}?subject=${encodeURIComponent(EVENT_MAIL_TEMPLATES.thankYouSubject())}&body=${encodeURIComponent(EVENT_MAIL_TEMPLATES.thankYouBody(row.name || ''))}`;
                      handleChange(row.id, 'thanksStatus', 'Sent');
                    }}
                    style={{
                      display: 'inline-flex',
                      background: '#0f6fc6',
                      border: 'none',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {EVENT_COPY.sendMail}
                  </button>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: '#64748b',
                      minWidth: '70px',
                      marginLeft: '4px',
                    }}
                  >
                    <Info size={14} /> {row.thanksStatus || EVENT_COPY.notSent}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

// --- Event Updates Main Page ---

interface SocialLinks {
  facebook: string;
  x: string;
  instagram: string;
  linkedin: string;
}

interface EventUpdatesProps {
  goToTab: (tab: string) => void;
}

const EventUpdates: React.FC<EventUpdatesProps> = ({ goToTab }) => {
  const [rows, setRows] = useState<ResourcePersonRow[]>([
    {
      id: Date.now(),
      name: '',
      designation: '',
      organization: '',
      email: '',
      linkedin: '',
      location: '',
      purpose: '',
      mode: 'Offline',
      date: '',
      time: '',
      hasTitle: false,
      title: '',
      invitationStatus: 'Not Sent',
      thanksStatus: 'Not Sent',
    },
  ]);

  const [formData, setFormData] = useState<Record<string, LetterSectionData>>(
    sections.reduce(
      (acc, section) => {
        acc[section] = {
          active: false,
          mode: 'Letter/ Email',
          date: '',
          file: null,
        };
        return acc;
      },
      {} as Record<string, LetterSectionData>,
    ),
  );

  const eventId = 1;

  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [docState, setany] = useState<Record<string, DocumentRowState>>(
    documentNames.reduce(
      (acc, doc) => {
        acc[doc] = {
          active: false,
          file: doc === 'Photos' ? ([null, null, null, null] as (File | null)[]) : null,
        };
        return acc;
      },
      {} as Record<string, DocumentRowState>,
    ),
  );

  const [isSubmittingUpdates, setIsSubmittingUpdates] = useState(false);
  const [websiteEnabled, setWebsiteEnabled] = useState(false);
  const [websiteDate, setWebsiteDate] = useState('');
  const [websiteFile, setWebsiteFile] = useState<File | null>(null);

  const [newspaperEnabled, setNewspaperEnabled] = useState(false);
  const [newspaperDate, setNewspaperDate] = useState('');
  const [newspaperFile, setNewspaperFile] = useState<File | null>(null);

  const [pressEnabled, setPressEnabled] = useState(false);
  const [pressDate, setPressDate] = useState('');
  const [pressFile, setPressFile] = useState<File | null>(null);

  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: string;
    type: AlertType;
    title?: string;
  }>({
    show: false,
    message: '',
    type: 'info',
  });

  const showAlert = (message: string, type: AlertType = 'info', title?: string) => {
    setAlertConfig({ show: true, message, type, title });
  };

  const [links, setLinks] = useState<SocialLinks>({
    facebook: '',
    x: '',
    instagram: '',
    linkedin: '',
  });

  const handleSendMail = (section: string): void => {
    window.location.href = `mailto:?subject=${encodeURIComponent(section)}`;
  };

  const openLink = (link: string): void => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const uploadFile = async (file: File): Promise<number | null> => {
    if (!file) return null;
    const data = new FormData();
    data.append('file', file);
    try {
      const response = (await authenticityUtility.postFile(
        `/updates/events/${eventId}/uploads`,
        data,
      )) as { upload: { id: number } };
      return response.upload.id;
    } catch (err) {
      console.error('File upload failed', err);
      showAlert('Failed to upload file: ' + file.name, 'error');
      return null;
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (isSubmittingUpdates) return;
    setIsSubmittingUpdates(true);
    try {
      const uploadPromises = [
        websiteEnabled && websiteFile ? uploadFile(websiteFile) : Promise.resolve(null),
        newspaperEnabled && newspaperFile ? uploadFile(newspaperFile) : Promise.resolve(null),
        pressEnabled && pressFile ? uploadFile(pressFile) : Promise.resolve(null),
      ];

      const [websiteRes, newspaperRes, pressRes] = await Promise.allSettled(uploadPromises);

      const getUploadId = (res: PromiseSettledResult<number | null>) =>
        res.status === 'fulfilled' ? res.value : null;

      const publicityData = {
        website_enabled: websiteEnabled,
        website_date: websiteDate,
        website_upload_id: getUploadId(websiteRes),
        newspaper_enabled: newspaperEnabled,
        newspaper_date: newspaperDate,
        newspaper_upload_id: getUploadId(newspaperRes),
        press_enabled: pressEnabled,
        press_date: pressDate,
        press_upload_id: getUploadId(pressRes),
        facebook_link: links.facebook,
        x_link: links.x,
        instagram_link: links.instagram,
        linkedin_link: links.linkedin,
      };

      const wrapPromise = (promise: Promise<any>, sectionName: string) =>
        promise.catch((err) => {
          console.error(`Error saving ${sectionName}:`, err);
          return Promise.reject(sectionName);
        });

      const updatePromises = [
        wrapPromise(
          authenticityUtility.put(`/updates/events/${eventId}/publicity`, publicityData),
          'Publicity',
        ),
        ...rows.map((rp, i) => {
          if (rp.dbId) {
            return wrapPromise(
              authenticityUtility.put(`/updates/events/${eventId}/resource_persons/${rp.dbId}`, rp),
              `Resource Person ${i + 1}`,
            );
          } else {
            const promise = authenticityUtility
              .post(`/updates/events/${eventId}/resource_persons`, rp)
              .then((res: any) => {
                const newDbId = res.resourcePerson?.id || res.data?.resourcePerson?.id;
                if (newDbId) {
                  setRows((prev) =>
                    prev.map((r) => (r.id === rp.id ? { ...r, dbId: newDbId } : r)),
                  );
                }
                return res;
              });
            return wrapPromise(promise, `Resource Person ${i + 1}`);
          }
        }),
        ...Object.entries(formData).map(([section, data]) =>
          wrapPromise(
            authenticityUtility.put(`/updates/events/${eventId}/letters`, {
              section_name: section,
              active: data.active,
              mode: data.mode,
              letter_date: data.date,
            }),
            `Letter (${section})`,
          ),
        ),
        ...participants.map((participant, i) =>
          wrapPromise(
            authenticityUtility.post(`/updates/events/${eventId}/participants`, {
              type: participant.type,
              count: participant.count,
            }),
            `Participant ${i + 1}`,
          ),
        ),
        ...Object.entries(docState).map(([docName, docData]) =>
          wrapPromise(
            authenticityUtility.put(`/updates/events/${eventId}/documents`, {
              docname: docName,
              active: docData.active,
            }),
            `Document (${docName})`,
          ),
        ),
      ];

      const results = await Promise.allSettled(updatePromises);

      const failedSections = results
        .filter((res) => res.status === 'rejected')
        .map((res) => (res as PromiseRejectedResult).reason);

      if (failedSections.length > 0) {
        showAlert(
          `Partial save occurred. The following sections failed to save:\n- ${failedSections.join('\n- ')}`,
          'warning',
          'Partial Save',
        );
        return; // Prevent navigating away on partial save
      }

      showAlert('✅ Event updates saved successfully!', 'success');
      goToTab('participants');
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      showAlert('Error occurred, please check console.', 'error');
    } finally {
      setIsSubmittingUpdates(false);
    }
  };

  return (
    <div className="event-updates-page">
      <div className="event-updates-top-grid">
        {/* Publicity Box */}
        <div className="event-card-section event-form-section event-updates-panel event-publicity-card">
          <h2 className="event-section-title">Publicity</h2>

          {[
            { label: 'Website Scrolling', value: websiteDate, setter: setWebsiteDate },
            { label: 'Newspaper Engagement', value: newspaperDate, setter: setNewspaperDate },
            { label: 'Press Report', value: pressDate, setter: setPressDate },
          ].map((item) => (
            <div key={item.label} className="event-row-section event-publicity-row">
              <span className="event-publicity-label">{item.label}</span>
              <div className="event-publicity-actions">
                <div className="event-publicity-buttons">
                  <button type="button" className="event-publicity-preview-btn" disabled>
                    Preview
                  </button>
                  <button
                    type="button"
                    className="event-publicity-send-btn"
                    onClick={() => handleSendMail(item.label)}
                  >
                    Send Mail
                  </button>
                  <span className="event-publicity-status">
                    <Info size={16} /> Not Sent
                  </span>
                </div>
              </div>
              <input
                type="date"
                value={item.value}
                onChange={(e) => item.setter(e.target.value)}
                className="event-publicity-date"
              />
            </div>
          ))}
        </div>

        <LettersPage formData={formData} setFormData={setFormData} />
      </div>

      <div className="event-card-section event-form-section event-social-links-card">
        <h2 className="event-section-title">Social Media Links</h2>

        <div className="event-social-grid">
          {(
            [
              { key: 'facebook', icon: Facebook, label: 'Facebook link' },
              { key: 'x', icon: X, label: 'X link' },
              { key: 'instagram', icon: Instagram, label: 'Instagram link' },
              { key: 'linkedin', icon: Linkedin, label: 'Linkedin link' },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <div className="event-social-link-row" key={key}>
              <span className={`event-social-icon event-social-icon-${key}`}>
                <Icon
                  size={key === 'facebook' ? 24 : key === 'instagram' ? 22 : 20}
                  strokeWidth={key === 'x' ? 2.2 : 2}
                />
              </span>
              <input
                type="text"
                className="event-big-social-input"
                placeholder={label}
                value={links[key]}
                onChange={(e) => setLinks({ ...links, [key]: e.target.value })}
              />
              <button
                type="button"
                className="event-social-view-btn"
                onClick={() => openLink(links[key])}
                disabled={!links[key]}
                title={`View ${key} link`}
                aria-label={`View ${key} link`}
              >
                <Eye size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ResourcePerson rows={rows} setRows={setRows} showAlert={showAlert} />

      <ParticipantsCard participants={participants} setParticipants={setParticipants} />

      <DocumentsCard docState={docState} setany={setany} />

      <div className="event-section-navigation">
        <button type="button" className="event-prev-btn" onClick={() => goToTab('finance')}>
          ← Previous
        </button>
        <button
          type="button"
          className="event-next-btn"
          onClick={handleSubmit}
          disabled={isSubmittingUpdates}
        >
          {isSubmittingUpdates ? 'Saving...' : 'Save & Next →'}
        </button>
      </div>

      <AlertModal
        show={alertConfig.show}
        onHide={() => setAlertConfig((prev) => ({ ...prev, show: false }))}
        message={alertConfig.message}
        type={alertConfig.type}
        title={alertConfig.title}
      />
    </div>
  );
};

export { EventUpdates };

// =========================================
// Feedback.tsx
// =========================================

interface ResourcePersonState {
  id: number;
  name: string;
  organization: string;
  date: string;
  time: string;
  topic: string;
  feedbackEnabled: boolean;
  isOnline: boolean;
  ratings: {
    expertise: number;
    engagement: number;
    relevance: number;
    timeManagement: number;
    onlineQuality: number;
  };
  takeaway: string;
  suggestion: string;
}

interface FeedbackProps {
  eventId?: string;
}

const Feedback: React.FC<FeedbackProps> = ({ eventId }) => {
  // --- Section 1: Event Feedback State ---
  const [eventToggles, setEventToggles] = useState({
    food: false,
    refreshment: false,
    presentation: false,
    evaluation: false,
    enjoyment: false,
  });

  const [eventRatings, setEventRatings] = useState({
    overall: 0,
    planning: 0,
    timeManagement: 0,
    catering: 0,
    facilities: 0,
    presentation: 0,
    evaluation: 0,
    enjoyment: 0,
  });

  const [awarenessChannel, setAwarenessChannel] = useState<string>(EVENT_COPY.socialMedia);
  const [eventSuggestion, setEventSuggestion] = useState('');

  // --- Section 2: Resource Person Feedback State ---
  const [resourcePersons, setResourcePersons] = useState<ResourcePersonState[]>([
    {
      id: 1,
      name: '',
      organization: '',
      date: '',
      time: '',
      topic: '',
      feedbackEnabled: false,
      isOnline: false,
      ratings: {
        expertise: 0,
        engagement: 0,
        relevance: 0,
        timeManagement: 0,
        onlineQuality: 0,
      },
      takeaway: '',
      suggestion: '',
    },
  ]);

  // --- Section 3: Accommodation Feedback State ---
  const [accommodationRatings, setAccommodationRatings] = useState({
    cleanliness: 0,
    amenities: 0,
    food: 0,
  });
  const [accommodationSuggestion, setAccommodationSuggestion] = useState('');

  // --- API State ---
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // --- Helpers for Event state ---
  const toggleEventParam = (param: keyof typeof eventToggles) => {
    setEventToggles((prev) => ({ ...prev, [param]: !prev[param] }));
  };

  const handleEventRating = (key: keyof typeof eventRatings, rating: number) => {
    setEventRatings((prev) => ({ ...prev, [key]: rating }));
  };

  // --- Helpers for Resource Person state ---
  const addResourcePerson = () => {
    const nextId =
      resourcePersons.length > 0 ? Math.max(...resourcePersons.map((rp) => rp.id)) + 1 : 1;
    setResourcePersons((prev) => [
      ...prev,
      {
        id: nextId,
        name: '',
        organization: '',
        date: '',
        time: '',
        topic: '',
        feedbackEnabled: false,
        isOnline: false,
        ratings: {
          expertise: 0,
          engagement: 0,
          relevance: 0,
          timeManagement: 0,
          onlineQuality: 0,
        },
        takeaway: '',
        suggestion: '',
      },
    ]);
  };

  const deleteResourcePerson = (id: number) => {
    setResourcePersons((prev) => prev.filter((rp) => rp.id !== id));
  };

  const updateResourcePerson = (id: number, key: string, value: any) => {
    setResourcePersons((prev) =>
      prev.map((rp) => {
        if (rp.id === id) {
          return { ...rp, [key]: value };
        }
        return rp;
      }),
    );
  };

  const updateResourcePersonRating = (
    id: number,
    ratingKey: keyof ResourcePersonState['ratings'],
    rating: number,
  ) => {
    setResourcePersons((prev) =>
      prev.map((rp) => {
        if (rp.id === id) {
          return {
            ...rp,
            ratings: { ...rp.ratings, [ratingKey]: rating },
          };
        }
        return rp;
      }),
    );
  };

  // --- Helper for Accommodation state ---
  const handleAccommodationRating = (key: keyof typeof accommodationRatings, rating: number) => {
    setAccommodationRatings((prev) => ({ ...prev, [key]: rating }));
  };

  const getCateringQuestionText = (): string => {
    const selectedItems = [
      eventToggles.food ? 'food' : '',
      eventToggles.refreshment ? 'refreshment' : '',
    ].filter(Boolean);

    if (selectedItems.length === 0) {
      return '';
    }

    if (selectedItems.length === 1) {
      return `How would you rate the quality of the ${selectedItems[0]} provided?`;
    }

    return `How would you rate the quality of the ${selectedItems[0]} and ${selectedItems[1]} provided?`;
  };

  const showCateringRow = eventToggles.food || eventToggles.refreshment;

  // --- Form Submission ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) {
      setError('Event ID is missing');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    const payload = {
      eventFeedback: {
        toggles: eventToggles,
        ratings: eventRatings,
        awareness: awarenessChannel,
        suggestion: eventSuggestion,
      },
      resourcePersonsFeedback: resourcePersons,
      accommodationFeedback: {
        ratings: accommodationRatings,
        suggestion: accommodationSuggestion,
      },
    };

    try {
      await authenticityUtility.post(`/events/${eventId}/feedback`, payload);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  // --- Render Star Rating Group ---
  const renderStars = (currentRating: number, onSelect: (rating: number) => void) => {
    return (
      <div className="feedback-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`feedback-star-btn ${star <= currentRating ? 'active' : ''}`}
            onClick={() => onSelect(star)}
          >
            <Star size={18} fill={star <= currentRating ? '#ffb800' : 'none'} strokeWidth={2} />
          </button>
        ))}
      </div>
    );
  };

  return (
    <form className="feedback-container" onSubmit={handleSubmit}>
      {/* ==================== CARD 1: EVENT FEEDBACK ==================== */}
      <div className="feedback-card">
        <div className="feedback-card-header">
          <h2 className="feedback-card-title">{EVENT_COPY.eventFeedbackTitle}</h2>
        </div>

        {/* Toggles Sub-Header */}
        <div className="feedback-toggles-bar">
          {EVENT_FEEDBACK_TOGGLES.map((param) => (
            <div className="feedback-toggle-group" key={param}>
              <span className="feedback-toggle-label">
                {param.charAt(0).toUpperCase() + param.slice(1)}
              </span>
              <div className="feedback-toggle-pill">
                <button
                  type="button"
                  className={`feedback-toggle-btn ${eventToggles[param] ? 'active' : 'inactive'}`}
                  onClick={() => toggleEventParam(param)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={`feedback-toggle-btn ${!eventToggles[param] ? 'active' : 'inactive'}`}
                  onClick={() => toggleEventParam(param)}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Event Questions List */}
        <div className="feedback-questions-list">
          {/* Overall */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Award size={14} />
                Overall
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the overall quality of the event?
            </div>
            <div className="feedback-action-container">
              {renderStars(eventRatings.overall, (rating) => handleEventRating('overall', rating))}
            </div>
          </div>

          {/* Planning */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <ClipboardList size={14} />
                Planning
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the planning, coordination and execution of the event?
            </div>
            <div className="feedback-action-container">
              {renderStars(eventRatings.planning, (rating) =>
                handleEventRating('planning', rating),
              )}
            </div>
          </div>

          {/* Time Management */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Clock size={14} />
                Time Management
              </span>
            </div>
            <div className="feedback-question-text">
              How effectively was the event managed within the scheduled time?
            </div>
            <div className="feedback-action-container">
              {renderStars(eventRatings.timeManagement, (rating) =>
                handleEventRating('timeManagement', rating),
              )}
            </div>
          </div>

          {/* Catering */}
          {showCateringRow && (
            <div className="feedback-question-row">
              <div className="feedback-badge-container">
                <span className="feedback-badge">
                  <Utensils size={14} />
                  Catering
                </span>
              </div>
              <div className="feedback-question-text">{getCateringQuestionText()}</div>
              <div className="feedback-action-container">
                {renderStars(eventRatings.catering, (rating) =>
                  handleEventRating('catering', rating),
                )}
              </div>
            </div>
          )}

          {/* Facilities */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Building size={14} />
                Facilities
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the venue, facilities, and overall event arrangements?
            </div>
            <div className="feedback-action-container">
              {renderStars(eventRatings.facilities, (rating) =>
                handleEventRating('facilities', rating),
              )}
            </div>
          </div>

          {/* Presentation */}
          {eventToggles.presentation && (
            <div className="feedback-question-row">
              <div className="feedback-badge-container">
                <span className="feedback-badge">
                  <Presentation size={14} />
                  Presentation
                </span>
              </div>
              <div className="feedback-question-text">
                How satisfied were you with the opportunity provided to present your work?
              </div>
              <div className="feedback-action-container">
                {renderStars(eventRatings.presentation, (rating) =>
                  handleEventRating('presentation', rating),
                )}
              </div>
            </div>
          )}

          {/* Evaluation */}
          {eventToggles.evaluation && (
            <div className="feedback-question-row">
              <div className="feedback-badge-container">
                <span className="feedback-badge">
                  <Scale size={14} />
                  Evaluation
                </span>
              </div>
              <div className="feedback-question-text">
                How would you rate the fairness and transparency of the evaluation/judging process?
              </div>
              <div className="feedback-action-container">
                {renderStars(eventRatings.evaluation, (rating) =>
                  handleEventRating('evaluation', rating),
                )}
              </div>
            </div>
          )}

          {/* Enjoyment */}
          {eventToggles.enjoyment && (
            <div className="feedback-question-row">
              <div className="feedback-badge-container">
                <span className="feedback-badge">
                  <Smile size={14} />
                  Enjoyment
                </span>
              </div>
              <div className="feedback-question-text">
                How engaging and enjoyable was the event?
              </div>
              <div className="feedback-action-container">
                {renderStars(eventRatings.enjoyment, (rating) =>
                  handleEventRating('enjoyment', rating),
                )}
              </div>
            </div>
          )}

          {/* Awareness */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Megaphone size={14} />
                Awareness
              </span>
            </div>
            <div className="feedback-question-text">How did you come to know about this event?</div>
            <div className="feedback-action-container">
              <div className="feedback-awareness-list">
                {EVENT_FEEDBACK_AWARENESS_CHANNELS.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    className={`feedback-awareness-pill ${awarenessChannel === channel ? 'active' : ''}`}
                    onClick={() => setAwarenessChannel(channel)}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Suggestions */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Lightbulb size={14} />
                Suggestion
              </span>
            </div>
            <div className="feedback-question-text">
              Your Suggestions or Comments or Recommendations
            </div>
            <div className="feedback-action-container">
              <input
                type="text"
                className="feedback-text-input"
                value={eventSuggestion}
                onChange={(e) => setEventSuggestion(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ==================== CARD 2: RESOURCE PERSONS LIST ==================== */}
      {resourcePersons.map((rp) => (
        <div className="feedback-card" key={rp.id}>
          <div className="feedback-resource-topbar">
            <div className="feedback-resource-topbar-left">
              <span className="feedback-resource-label">{EVENT_COPY.resourcePersonLabel}</span>
              <select
                className="feedback-resource-select"
                value={rp.name}
                onChange={(e) => updateResourcePerson(rp.id, 'name', e.target.value)}
              >
                <option value="">Name, Organization</option>
                {EVENT_RESOURCE_PERSON_OPTIONS.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </div>

            <div className="feedback-resource-topbar-meta">
              <div
                className="feedback-resource-meta-item feedback-resource-date-field"
                style={{ gap: '12px' }}
              >
                <span>Date:</span>
                <input
                  type="date"
                  className="feedback-resource-meta-input"
                  value={rp.date}
                  onChange={(e) => updateResourcePerson(rp.id, 'date', e.target.value)}
                  style={{ minWidth: '130px', padding: '4px 8px' }}
                />
              </div>
              <div
                className="feedback-resource-meta-item feedback-resource-time-field"
                style={{ gap: '12px', marginLeft: '16px' }}
              >
                <span>Time:</span>
                <input
                  type="time"
                  className="feedback-resource-meta-input"
                  value={rp.time}
                  onChange={(e) => updateResourcePerson(rp.id, 'time', e.target.value)}
                  style={{ minWidth: '100px', padding: '4px 8px' }}
                />
              </div>

              <div className="feedback-resource-meta-item" style={{ marginLeft: '16px' }}>
                <label
                  className="feedback-resource-switch feedback-resource-switch--wide"
                  style={{ margin: 0, display: 'flex', alignItems: 'center' }}
                >
                  <input
                    type="checkbox"
                    checked={rp.feedbackEnabled}
                    onChange={() =>
                      updateResourcePerson(rp.id, 'feedbackEnabled', !rp.feedbackEnabled)
                    }
                  />
                  <span className="feedback-resource-switch-slider" />
                </label>
              </div>

              <div
                className="feedback-resource-action-group"
                style={{ marginLeft: '16px', display: 'flex', gap: '8px' }}
              >
                <button
                  type="button"
                  onClick={addResourcePerson}
                  style={{
                    color: '#005492',
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                  title="Add resource person"
                >
                  <Plus size={20} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteResourcePerson(rp.id)}
                  disabled={resourcePersons.length <= 1}
                  style={{
                    color: '#ef4444',
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: resourcePersons.length <= 1 ? 'not-allowed' : 'pointer',
                    opacity: resourcePersons.length <= 1 ? 0.5 : 1,
                  }}
                  title="Remove resource person"
                >
                  <XCircle size={20} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

          {rp.feedbackEnabled && (
            <>
              <div className="feedback-resource-topicbar">
                <div className="feedback-resource-topic-left">
                  <span className="feedback-resource-label">Topic:</span>
                  <input
                    type="text"
                    className="feedback-resource-topic-input"
                    value={rp.topic}
                    onChange={(e) => updateResourcePerson(rp.id, 'topic', e.target.value)}
                  />
                </div>
                <div
                  className="feedback-resource-mode-pill"
                  role="group"
                  aria-label="Toggle online/offline mode"
                >
                  <button
                    type="button"
                    className={`feedback-resource-mode-pill-btn ${rp.isOnline ? 'inactive' : 'active'}`}
                    onClick={() => updateResourcePerson(rp.id, 'isOnline', false)}
                  >
                    Offline
                  </button>
                  <button
                    type="button"
                    className={`feedback-resource-mode-pill-btn ${rp.isOnline ? 'active' : 'inactive'}`}
                    onClick={() => updateResourcePerson(rp.id, 'isOnline', true)}
                  >
                    Online
                  </button>
                </div>
              </div>

              <div className="feedback-resource-questions-shell">
                {/* Resource Person Questions */}
                <div className="feedback-questions-list">
                  {/* Expertise */}
                  <div className="feedback-question-row">
                    <div className="feedback-badge-container">
                      <span className="feedback-badge">
                        <GraduationCap size={14} />
                        Expertise
                      </span>
                    </div>
                    <div className="feedback-question-text">
                      How would you rate the speaker's subject knowledge and expertise?
                    </div>
                    <div className="feedback-action-container">
                      {renderStars(rp.ratings.expertise, (rating) =>
                        updateResourcePersonRating(rp.id, 'expertise', rating),
                      )}
                    </div>
                  </div>

                  {/* Engagement */}
                  <div className="feedback-question-row">
                    <div className="feedback-badge-container">
                      <span className="feedback-badge">
                        <Users size={14} />
                        Engagement
                      </span>
                    </div>
                    <div className="feedback-question-text">
                      How effectively did the speaker engage the audience throughout the session?
                    </div>
                    <div className="feedback-action-container">
                      {renderStars(rp.ratings.engagement, (rating) =>
                        updateResourcePersonRating(rp.id, 'engagement', rating),
                      )}
                    </div>
                  </div>

                  {/* Relevance */}
                  <div className="feedback-question-row">
                    <div className="feedback-badge-container">
                      <span className="feedback-badge">
                        <BookOpen size={14} />
                        Relevance
                      </span>
                    </div>
                    <div className="feedback-question-text">
                      How relevant and useful was the content of the lecture to your learning or
                      professional needs?
                    </div>
                    <div className="feedback-action-container">
                      {renderStars(rp.ratings.relevance, (rating) =>
                        updateResourcePersonRating(rp.id, 'relevance', rating),
                      )}
                    </div>
                  </div>

                  {/* Time Management */}
                  <div className="feedback-question-row">
                    <div className="feedback-badge-container">
                      <span className="feedback-badge">
                        <Clock size={14} />
                        Time Management
                      </span>
                    </div>
                    <div className="feedback-question-text">
                      How well did the speaker manage the allotted time while covering the topics?
                    </div>
                    <div className="feedback-action-container">
                      {renderStars(rp.ratings.timeManagement, (rating) =>
                        updateResourcePersonRating(rp.id, 'timeManagement', rating),
                      )}
                    </div>
                  </div>

                  {/* Online */}
                  {rp.isOnline && (
                    <div className="feedback-question-row">
                      <div className="feedback-badge-container">
                        <span className="feedback-badge">
                          <Video size={14} />
                          Online Quality
                        </span>
                      </div>
                      <div className="feedback-question-text">
                        How would you rate the audio and video quality of the online session?
                      </div>
                      <div className="feedback-action-container">
                        {renderStars(rp.ratings.onlineQuality, (rating) =>
                          updateResourcePersonRating(rp.id, 'onlineQuality', rating),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Takeaway */}
                  <div className="feedback-question-row">
                    <div className="feedback-badge-container">
                      <span className="feedback-badge">
                        <ShoppingBag size={14} />
                        Takeaway
                      </span>
                    </div>
                    <div className="feedback-question-text">
                      Your key takeaway from this lecture session
                    </div>
                    <div className="feedback-action-container">
                      <input
                        type="text"
                        className="feedback-text-input"
                        value={rp.takeaway}
                        onChange={(e) => updateResourcePerson(rp.id, 'takeaway', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div className="feedback-question-row">
                    <div className="feedback-badge-container">
                      <span className="feedback-badge">
                        <Lightbulb size={14} />
                        Suggestion
                      </span>
                    </div>
                    <div className="feedback-question-text">
                      Your Suggestions or Comments or Recommendations
                    </div>
                    <div className="feedback-action-container">
                      <input
                        type="text"
                        className="feedback-text-input"
                        value={rp.suggestion}
                        onChange={(e) => updateResourcePerson(rp.id, 'suggestion', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      {/* ==================== CARD 3: ACCOMMODATION FEEDBACK ==================== */}
      <div className="feedback-card">
        <div className="feedback-card-header">
          <h2 className="feedback-card-title">{EVENT_COPY.accommodationTitle}</h2>
        </div>

        {/* Accommodation Questions */}
        <div className="feedback-questions-list">
          {/* Cleanliness */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Sparkles size={14} />
                Cleanliness
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the cleanliness and maintenance of the room?
            </div>
            <div className="feedback-action-container">
              {renderStars(accommodationRatings.cleanliness, (rating) =>
                handleAccommodationRating('cleanliness', rating),
              )}
            </div>
          </div>

          {/* Amenities */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Bed size={14} />
                Amenities
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the comfort and amenities provided in the hostel?
            </div>
            <div className="feedback-action-container">
              {renderStars(accommodationRatings.amenities, (rating) =>
                handleAccommodationRating('amenities', rating),
              )}
            </div>
          </div>

          {/* Food */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Utensils size={14} />
                Food
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the quality of the food and refreshments provided?
            </div>
            <div className="feedback-action-container">
              {renderStars(accommodationRatings.food, (rating) =>
                handleAccommodationRating('food', rating),
              )}
            </div>
          </div>

          {/* Suggestions */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Lightbulb size={14} />
                Suggestion
              </span>
            </div>
            <div className="feedback-question-text">
              Your Suggestions or Comments or Recommendations
            </div>
            <div className="feedback-action-container">
              <input
                type="text"
                className="feedback-text-input"
                value={accommodationSuggestion}
                onChange={(e) => setAccommodationSuggestion(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="feedback-error-msg"
          style={{ color: 'red', textAlign: 'center', marginBottom: '16px' }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="feedback-success-msg"
          style={{ color: 'green', textAlign: 'center', marginBottom: '16px' }}
        >
          Feedback submitted successfully!
        </div>
      )}

      {/* Submit Button */}
      <button type="submit" className="feedback-submit-btn" disabled={loading}>
        {loading ? 'Submitting...' : EVENT_COPY.submitFeedback}
      </button>
    </form>
  );
};

export { Feedback };

// =========================================
// EventCertificate.tsx
// =========================================

interface EventCertificateProps {
  eventId?: string;
  summary?: any;
  isSubEvent?: boolean;
  goToTab?: (tab: string) => void;
}

const EventCertificate: React.FC<EventCertificateProps> = ({ eventId, summary }) => {
  const [eventData, setEventData] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('default');
  const [customParticipantName, setCustomParticipantName] = useState<string>('');
  const [customCertNo, setCustomCertNo] = useState<string>('');
  const [issuedDate, setIssuedDate] = useState<string>('');

  useEffect(() => {
    const today = new Date();
    const formattedToday = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    setIssuedDate(formattedToday);

    if (!eventId || eventId === 'new') return;

    authenticityUtility
      .get(`/events/${eventId}`)
      .then((res: any) => {
        if (res) setEventData(res);
      })
      .catch((err) => {
        console.warn('Could not load full event details, using summary fallback', err);
      });

    authenticityUtility
      .get(`/events/${eventId}/participants`)
      .then((res: any) => {
        if (res && Array.isArray(res.participants)) {
          setParticipants(res.participants);
          if (res.participants.length > 0) {
            setSelectedParticipantId(String(res.participants[0].id));
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load participants list', err);
      });
  }, [eventId]);

  const selectedParticipant = participants.find((p) => String(p.id) === selectedParticipantId);

  const participantName =
    customParticipantName.trim() || selectedParticipant?.name || 'Dr. R. KOWSALYA';

  const eventTitle = eventData?.title || summary?.title || 'Robotics Using Arduino / Raspberry Pi';

  const levelName = eventData?.level || 'National';
  const eventTypeName = eventData?.event_type || 'Workshop';
  const departmentName =
    eventData?.department || eventData?.department_name || 'DEPARTMENT OF MECHATRONICS ENGINEERING';

  let numberOfDaysText = 'two-Days';
  if (eventData?.numberOfDays) {
    const num = parseInt(eventData.numberOfDays);
    if (!isNaN(num)) {
      numberOfDaysText =
        num === 1 ? 'one-Day' : num === 2 ? 'two-Days' : num === 3 ? 'three-Days' : `${num}-Days`;
    }
  } else if (eventData?.start_date && eventData?.end_date) {
    const start = new Date(eventData.start_date);
    const end = new Date(eventData.end_date);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
      numberOfDaysText =
        diff === 1
          ? 'one-Day'
          : diff === 2
            ? 'two-Days'
            : diff === 3
              ? 'three-Days'
              : `${diff}-Days`;
    }
  }

  let datesString = 'July 29-30, 2026';
  if (eventData?.start_date) {
    const sDate = new Date(eventData.start_date);
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    if (eventData?.end_date) {
      const eDate = new Date(eventData.end_date);
      if (sDate.getMonth() === eDate.getMonth() && sDate.getFullYear() === eDate.getFullYear()) {
        datesString = `${months[sDate.getMonth()]} ${sDate.getDate()}-${eDate.getDate()}, ${sDate.getFullYear()}`;
      } else {
        datesString = `${months[sDate.getMonth()]} ${sDate.getDate()} - ${months[eDate.getMonth()]} ${eDate.getDate()}, ${eDate.getFullYear()}`;
      }
    } else {
      datesString = `${months[sDate.getMonth()]} ${sDate.getDate()}, ${sDate.getFullYear()}`;
    }
  }

  const certificateNo =
    customCertNo.trim() ||
    `KSRCT/MECH/${new Date().getFullYear()}/${String(eventId || '101').padStart(3, '0')}-${String(selectedParticipantId || '001').padStart(3, '0')}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="event-certificate-tab-wrapper">
      {/* Printable High-Fidelity Certificate Canvas */}
      <div className="cert-print-area">
        <div className="ksrct-certificate-card">
          {/* Top Right Corner Fold */}
          <div className="cert-corner-tr-gold"></div>
          <div className="cert-corner-tr-navy"></div>

          {/* Bottom Left Corner Fold */}
          <div className="cert-corner-bl-navy"></div>
          <div className="cert-corner-bl-gold"></div>

          {/* Outer & Inner Ornamental Frame */}
          <div className="cert-inner-frame">
            {/* Top Logos Header Row */}
            <div className="cert-logos-row">
              <div className="cert-logo-item">
                <span className="cert-badge-ksrct4">
                  KSRC<span className="gold-num">7</span>
                  <sub>4.0</sub>
                </span>
                <span className="cert-badge-sub">Feature the Future</span>
              </div>

              <div className="cert-logo-item">
                <div className="cert-badge-32">
                  <span className="num-32">32</span>
                  <span className="text-32">
                    Excellence in
                    <br />
                    TECHNICAL
                    <br />
                    EDUCATION
                  </span>
                </div>
              </div>

              <div className="cert-logo-item">
                <div className="cert-badge-aicte">
                  <span className="aicte-ring"></span>
                  <span className="aicte-label">AICTE / IDEALab</span>
                </div>
              </div>

              <div className="cert-logo-item main-crest">
                <div className="college-crest-shield">
                  <div className="crest-top">K.S. RANGASAMY COLLEGE OF TECHNOLOGY</div>
                  <div className="crest-center">
                    <svg viewBox="0 0 100 100" className="crest-svg">
                      <polygon
                        points="50,5 95,30 95,70 50,95 5,70 5,30"
                        fill="#0069ab"
                        stroke="#f59e0b"
                        strokeWidth="3"
                      />
                      <path d="M 50 15 L 85 80 L 15 80 Z" fill="#ffffff" />
                      <circle cx="50" cy="50" r="15" fill="#f59e0b" />
                    </svg>
                  </div>
                  <div className="crest-banner">BE BOLD BE BRAVE</div>
                </div>
              </div>

              <div className="cert-logo-item">
                <div className="cert-badge-naac">
                  <span className="naac-eye"></span>
                  <span className="naac-grade">A++</span>
                  <span className="naac-sub">GRADE</span>
                </div>
              </div>

              <div className="cert-logo-item">
                <div className="cert-badge-nba">
                  <span className="nba-title">NBA</span>
                  <span className="nba-sub">NATIONAL BOARD OF ACCREDITATION</span>
                </div>
              </div>

              <div className="cert-logo-item sdg-box sdg-4">
                <span className="sdg-num">4</span>
                <span className="sdg-txt">QUALITY EDUCATION</span>
              </div>

              <div className="cert-logo-item sdg-box sdg-9">
                <span className="sdg-num">9</span>
                <span className="sdg-txt">INDUSTRY, INNOVATION AND INFRASTRUCTURE</span>
              </div>
            </div>

            {/* College Header */}
            <div className="cert-college-header">
              <h1 className="cert-college-title">K.S.RANGASAMY COLLEGE OF TECHNOLOGY</h1>
              <div className="cert-college-sub">(Autonomous)</div>
              <div className="cert-college-address">
                Tiruchengode - 637 215. Namakkal Dt. Tamil Nadu
              </div>
              <h2 className="cert-dept-title">{departmentName}</h2>
            </div>

            {/* Certificate Title */}
            <div className="cert-title-block">
              <h3 className="cert-calligraphy-title">Certificate of Participation</h3>
              <div className="cert-title-line"></div>
              <div className="cert-presented-txt">presented to</div>
            </div>

            {/* Participant Name */}
            <div className="cert-participant-block">
              <div className="cert-participant-name">{participantName}</div>
              <div className="cert-participant-dashed-line"></div>
            </div>

            {/* Body Text */}
            <div className="cert-description-block">
              <p className="cert-desc-text">
                for participating in the {numberOfDaysText} {levelName} level {eventTypeName} on
              </p>
              <div className="cert-event-title-highlight">“{eventTitle}”</div>
              <div className="cert-event-date-range">during {datesString}</div>
            </div>

            {/* Footer Row */}
            <div className="cert-footer-row">
              <div className="cert-meta-left">
                <div className="cert-meta-item">
                  <span className="meta-lbl">Date:</span> {issuedDate}
                </div>
                <div className="cert-meta-item">
                  <span className="meta-lbl">Certificate No. :</span> {certificateNo}
                </div>
              </div>

              <div className="cert-signatures-right">
                <div className="cert-sig-item">Co-ordinator</div>
                <div className="cert-sig-item">HoD</div>
                <div className="cert-sig-item">Principal</div>
              </div>
            </div>

            {/* Website URL */}
            <div className="cert-url-footer">www.ksrct.ac.in</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { EventCertificate };

// =========================================
// FinanceSection.tsx
// =========================================

// Type definitions
interface IncomeRow {
  id: string;
  incomeHead: string;
  incomeHeadOther?: string;
  agency: string;
  income: string;
}

interface ExpenditureRow {
  id: string;
  budgetHead: string;
  budgetHeadOther?: string;
  amountProposed: string;
  actualExpenditure: string;
  file?: File | null;
}

interface BudgetRow {
  id: string;
  head: string;
  amount: string;
}

interface FinanceDoc {
  active: boolean;
  file: File | null;
}

interface FinanceDocs {
  [key: string]: FinanceDoc;
}

interface SanctionDetails {
  orderNo: string;
  amount: string;
  date: string;
}

interface Agency {
  id: string;
  agency: string;
  sanctionDetails: SanctionDetails;
  docStates: any[];
}

interface FinanceSectionProps {
  incomeRows: IncomeRow[];
  setIncomeRows: React.Dispatch<React.SetStateAction<IncomeRow[]>>;
  expenditureRows: ExpenditureRow[];
  setExpenditureRows: React.Dispatch<React.SetStateAction<ExpenditureRow[]>>;
  financeDocs: FinanceDocs;
  setFinanceDocs: React.Dispatch<React.SetStateAction<FinanceDocs>>;
  budgetRows: BudgetRow[];
  setBudgetRows: React.Dispatch<React.SetStateAction<BudgetRow[]>>;
}

interface SponsoringAgencySectionProps {
  goToTab: (tab: string) => void;
  eventId?: string;
}

// ---------------- Finance Section ----------------
const FinanceSection: React.FC<FinanceSectionProps> = ({
  incomeRows,
  setIncomeRows,
  expenditureRows,
  setExpenditureRows,
  financeDocs,
  setFinanceDocs,
  budgetRows,
  setBudgetRows,
}) => {
  // Add/Delete Income
  const addIncomeRow = (): void => {
    setIncomeRows([...incomeRows, { id: uuidv4(), incomeHead: '', agency: '', income: '' }]);
  };

  const deleteIncomeRow = (id: string): void => {
    if (incomeRows.length === 1) return; // prevent deleting last row
    setIncomeRows(incomeRows.filter((row) => row.id !== id));
  };

  // Add/Delete Expenditure
  const addExpenditureRow = (): void => {
    setExpenditureRows([
      ...expenditureRows,
      {
        id: uuidv4(),
        budgetHead: '',
        amountProposed: '',
        actualExpenditure: '',
      },
    ]);
  };

  const deleteExpenditureRow = (id: string): void => {
    if (expenditureRows.length === 1) return; // prevent deleting last row
    setExpenditureRows(expenditureRows.filter((row) => row.id !== id));
  };

  // Add/Delete Budget
  const addBudgetRow = (): void => {
    setBudgetRows([...budgetRows, { id: uuidv4(), head: '', amount: '' }]);
  };

  const deleteBudgetRow = (id: string): void => {
    if (budgetRows.length === 1) return; // prevent deleting last row
    setBudgetRows(budgetRows.filter((row) => row.id !== id));
  };

  // Totals
  const totalIncome: number = incomeRows.reduce(
    (sum, row) => sum + (parseFloat(row.income) || 0),
    0,
  );
  const totalExpenditure: number = expenditureRows.reduce(
    (sum, row) => sum + (parseFloat(row.actualExpenditure) || 0),
    0,
  );

  const handleViewFile = (file: File | null): void => {
    if (file) {
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    }
  };

  return (
    <div className="event-finance-wrapper event-budget-style-content">
      {/* Income Section */}
      <section className="event-finance-card event-budget-style-card">
        <div className="event-card-header">
          <h3>Income</h3>
        </div>
        <div className="event-budget-table-wrap">
          <table className="event-finance-table event-budget-style-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Income Head</th>
                <th>Agency</th>
                <th>Income</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((row, index) => {
                const isLastRow = index === incomeRows.length - 1;

                return (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>
                      {row.incomeHead !== 'Others' ? (
                        <select
                          value={row.incomeHead}
                          onChange={(e) =>
                            setIncomeRows(
                              incomeRows.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      incomeHead: e.target.value,
                                      incomeHeadOther: '', // clear the other input
                                    }
                                  : r,
                              ),
                            )
                          }
                        >
                          <option value="">-- Select --</option>
                          {FINANCE_INCOME_HEADS.map((head) => (
                            <option key={head} value={head}>
                              {head}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={row.incomeHeadOther || ''}
                          placeholder="Enter other"
                          onChange={(e) =>
                            setIncomeRows(
                              incomeRows.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      incomeHeadOther: e.target.value,
                                      incomeHead: e.target.value === '' ? '' : 'Others', // switch back if cleared
                                    }
                                  : r,
                              ),
                            )
                          }
                          autoFocus
                        />
                      )}
                    </td>

                    <td>
                      <input
                        type="text"
                        value={row.agency}
                        onChange={(e) =>
                          setIncomeRows(
                            incomeRows.map((r) =>
                              r.id === row.id ? { ...r, agency: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.income}
                        onChange={(e) =>
                          setIncomeRows(
                            incomeRows.map((r) =>
                              r.id === row.id ? { ...r, income: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="event-actions-cell">
                      <div className="event-action-icons">
                        {index === 0 && incomeRows.length === 1 ? (
                          // First row → Only Add
                          <button
                            type="button"
                            className="event-add"
                            onClick={addIncomeRow}
                            title="Add"
                          >
                            <Plus size={16} />
                          </button>
                        ) : isLastRow ? (
                          // Last row → Delete + Add
                          <>
                            <button
                              type="button"
                              className="event-icon-btn"
                              onClick={() => deleteIncomeRow(row.id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button
                              type="button"
                              className="event-add"
                              onClick={addIncomeRow}
                              title="Add"
                            >
                              <Plus size={16} />
                            </button>
                          </>
                        ) : (
                          // Middle rows → Only Delete
                          <button
                            type="button"
                            className="event-icon-btn text-red-500"
                            onClick={() => deleteIncomeRow(row.id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Total row */}
              <tr className="event-total-row">
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: '600' }}>
                  Total Income:
                </td>
                <td colSpan={2} style={{ fontWeight: '600' }}>
                  {totalIncome}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Expenditure Section */}
      <section className="event-finance-card event-budget-style-card">
        <div className="event-card-header">
          <h3>Expenditure</h3>
        </div>
        <div className="event-budget-table-wrap">
          <table className="event-finance-table event-budget-style-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Budget Head</th>
                <th>Amount Proposed</th>
                <th>Actual Expenditure</th>
                <th>Upload Document</th> {/* New column header */}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenditureRows.map((row, index) => {
                const isLastRow = index === expenditureRows.length - 1;

                return (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>
                      {row.budgetHead !== 'Others' ? (
                        <select
                          value={row.budgetHead}
                          onChange={(e) =>
                            setExpenditureRows(
                              expenditureRows.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      budgetHead: e.target.value,
                                      budgetHeadOther: '',
                                    }
                                  : r,
                              ),
                            )
                          }
                        >
                          <option value="">-- Select --</option>
                          {FINANCE_BUDGET_HEADS.map((head) => (
                            <option key={head} value={head}>
                              {head}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={row.budgetHeadOther || ''}
                          placeholder="Enter other"
                          onChange={(e) =>
                            setExpenditureRows(
                              expenditureRows.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      budgetHeadOther: e.target.value,
                                      budgetHead: e.target.value.trim() ? 'Others' : '',
                                    }
                                  : r,
                              ),
                            )
                          }
                          autoFocus
                        />
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.amountProposed}
                        onChange={(e) =>
                          setExpenditureRows(
                            expenditureRows.map((r) =>
                              r.id === row.id ? { ...r, amountProposed: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.actualExpenditure}
                        onChange={(e) =>
                          setExpenditureRows(
                            expenditureRows.map((r) =>
                              r.id === row.id ? { ...r, actualExpenditure: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </td>

                    {/* Upload Document Column */}
                    <td style={{ verticalAlign: 'middle', padding: '8px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '15px',
                          justifyContent: 'center',
                          height: '100%',
                        }}
                      >
                        <label
                          className="event-upload-icon"
                          title="Upload document"
                          style={{ cursor: 'pointer' }}
                        >
                          <CloudUpload size={18} />
                          <input
                            type="file"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setExpenditureRows((prevRows) =>
                                prevRows.map((r) => (r.id === row.id ? { ...r, file } : r)),
                              );
                            }}
                            accept=".pdf,.doc,.docx,.jpg,.png"
                          />
                        </label>
                        <span
                          className={`event-eye-icon ${!row.file ? 'disabled' : ''}`}
                          onClick={() => {
                            if (row.file) window.open(URL.createObjectURL(row.file), '_blank');
                          }}
                          title={row.file ? 'View uploaded document' : 'No document uploaded'}
                          style={{
                            cursor: row.file ? 'pointer' : 'default',
                            color: row.file ? '#3182ce' : '#ccc',
                            display: 'flex',
                            alignItems: 'center',
                            height: '100%',
                          }}
                        >
                          <Eye size={18} />
                        </span>
                      </div>
                    </td>

                    <td className="event-actions-cell">
                      <div className="event-action-icons">
                        {index === 0 && expenditureRows.length === 1 ? (
                          <button
                            type="button"
                            className="event-add"
                            onClick={addExpenditureRow}
                            title="Add"
                          >
                            <Plus size={16} />
                          </button>
                        ) : isLastRow ? (
                          <>
                            <button
                              type="button"
                              className="event-icon-btn "
                              onClick={() => deleteExpenditureRow(row.id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button
                              type="button"
                              className="event-add"
                              onClick={addExpenditureRow}
                              title="Add"
                            >
                              <Plus size={16} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="event-icon-btn "
                            onClick={() => deleteExpenditureRow(row.id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Total row */}
              <tr className="event-total-row">
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: '600' }}>
                  Total Expenditure:
                </td>
                <td colSpan={2} style={{ fontWeight: '600' }}>
                  {totalExpenditure}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="event-docs-grid">
          {Object.keys(financeDocs)
            .filter((doc) => doc !== 'Bill Copies') // exclude Bill Copies
            .map((doc) => {
              const { active, file } = financeDocs[doc];
              return (
                <div className="event-doc-row" key={doc}>
                  <span className="event-doc-label">{doc}</span>
                  <label className="event-switch">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() =>
                        setFinanceDocs((prev) => ({
                          ...prev,
                          [doc]: { ...prev[doc], active: !active },
                        }))
                      }
                    />
                    <span className="event-slider"></span>
                  </label>
                  <label className={`event-upload-icon ${!active ? 'disabled' : ''}`}>
                    <CloudUpload size={18} />
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      disabled={!active}
                      onChange={(e) =>
                        setFinanceDocs((prev) => ({
                          ...prev,
                          [doc]: {
                            ...prev[doc],
                            file: e.target.files?.[0] || null,
                          },
                        }))
                      }
                    />
                  </label>
                  <span
                    className={`event-eye-icon ${!file ? 'disabled' : ''}`}
                    onClick={() => file && handleViewFile(file)}
                  >
                    <Eye size={18} />
                  </span>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
};

// ---------------- Sponsoring Agency Section ----------------
const SponsoringAgencySection: React.FC<SponsoringAgencySectionProps> = ({ goToTab, eventId }) => {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [isSubmittingFinance, setIsSubmittingFinance] = useState<boolean>(false);

  const initialanys: any[] = FINANCE_INITIAL_DOCS.map((name) => ({
    name,
    enabled: false,
    file: null,
  }));

  const [agencies, setAgencies] = useState<Agency[]>([
    {
      id: uuidv4(),
      agency: '',
      sanctionDetails: { orderNo: '', amount: '', date: '' },
      docStates: initialanys,
    },
  ]);

  // Finance section states
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([
    { id: uuidv4(), incomeHead: '', agency: '', income: '' },
  ]);
  const [expenditureRows, setExpenditureRows] = useState<ExpenditureRow[]>([
    { id: uuidv4(), budgetHead: '', amountProposed: '', actualExpenditure: '' },
  ]);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([
    { id: uuidv4(), head: '', amount: '' },
  ]);
  const [financeDocs, setFinanceDocs] = useState<FinanceDocs>({
    'Finance Approval Documents': { active: true, file: null },
    'Bill Copies': { active: false, file: null },
  });

  const addAgency = (): void => {
    setAgencies([
      ...agencies,
      {
        id: uuidv4(),
        agency: '',
        sanctionDetails: { orderNo: '', amount: '', date: '' },
        docStates: initialanys,
      },
    ]);
  };

  const deleteAgency = (id: string): void => {
    if (agencies.length === 1) return;
    setAgencies(agencies.filter((a) => a.id !== id));
  };

  const handleAgencyChange = (id: string, value: string): void => {
    setAgencies(agencies.map((a) => (a.id === id ? { ...a, agency: value } : a)));
  };

  const handleSanctionChange = (id: string, field: keyof SanctionDetails, value: string): void => {
    setAgencies(
      agencies.map((a) =>
        a.id === id
          ? {
              ...a,
              sanctionDetails: { ...a.sanctionDetails, [field]: value },
            }
          : a,
      ),
    );
  };

  const handleToggleDoc = (agencyId: string, index: number): void => {
    setAgencies(
      agencies.map((a) =>
        a.id === agencyId
          ? {
              ...a,
              docStates: a.docStates.map((doc, i) =>
                i === index ? { ...doc, enabled: !doc.enabled, file: null } : doc,
              ),
            }
          : a,
      ),
    );
  };

  const handleFileChange = (agencyId: string, index: number, file: File | null): void => {
    setAgencies(
      agencies.map((a) =>
        a.id === agencyId
          ? {
              ...a,
              docStates: a.docStates.map((doc, i) => (i === index ? { ...doc, file } : doc)),
            }
          : a,
      ),
    );
  };

  const viewFile = (file: File | null): void => {
    if (file) {
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    }
  };

  const handleSubmitToBackend = async (): Promise<void> => {
    // console.log("🔴 Finance Submit button clicked!");
    if (isSubmittingFinance) return;

    // Prepare finance data
    const financeData = {
      event_id: eventId ? parseInt(eventId) : 1,
      income: incomeRows
        .filter((row) => row.incomeHead && row.agency && row.income)
        .map((row) => ({
          source: row.incomeHead,
          amount: parseFloat(row.income) || 0,
          agency: row.agency,
        })),
      expenditure: expenditureRows
        .filter((row) => row.budgetHead && row.actualExpenditure)
        .map((row) => ({
          category: row.budgetHead,
          amount: parseFloat(row.actualExpenditure) || 0,
          proposed_amount: parseFloat(row.amountProposed) || 0,
        })),
      sponsoring_agencies: enabled
        ? agencies
            .filter((agency) => agency.agency)
            .map((agency) => ({
              agency_name: agency.agency,
              order_no: agency.sanctionDetails.orderNo,
              amount: parseFloat(agency.sanctionDetails.amount) || null,
              date: agency.sanctionDetails.date,
            }))
        : [],
      supporting_docs: Object.keys(financeDocs)
        .filter((doc) => financeDocs[doc].active && financeDocs[doc].file)
        .map((doc) => ({
          filename: financeDocs[doc].file!.name,
          original_name: financeDocs[doc].file!.name,
          mime: financeDocs[doc].file!.type,
          size: financeDocs[doc].file!.size,
        })),
      budget: budgetRows
        .filter((row) => row.head && row.amount)
        .map((row) => ({
          head: row.head,
          amount: parseFloat(row.amount) || 0,
        })),
    };

    // console.log("🔴 Prepared finance data:", financeData);

    setIsSubmittingFinance(true);
    try {
      const response = await authenticityUtility.post('/finance', financeData);
      // console.log("🟢 Finance backend response:", response);
      alert('✅ Finance data submitted successfully!');
      goToTab('updates');
    } catch (error: any) {
      console.error('🔴 Finance frontend error:', error);
      console.error('🔴 Error response:', error.response?.data);
      alert(`❌ Failed to submit finance data: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSubmittingFinance(false);
    }
  };

  return (
    <div className="event-sponsor-section finance-approval-body event-budget-style-page">
      {(enabled ? agencies : [agencies[0]]).map((agency, index) => {
        const isLastRow = index === agencies.length - 1;
        return (
          <section key={agency.id} className="event-agency-card event-budget-style-card">
            {/* Card Header with Sponsoring Agency title + toggle */}
            {/* Render title/toggle only for the very first card */}
            {index === 0 && (
              <div className="event-card-header">
                <h3 className="event-section-title">Sponsoring Agency</h3>
                <label className="event-toggle-switch">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => {
                      setEnabled(!enabled);
                      if (enabled) {
                        setAgencies([
                          {
                            id: uuidv4(),
                            agency: '',
                            sanctionDetails: {
                              orderNo: '',
                              amount: '',
                              date: '',
                            },
                            docStates: initialanys,
                          },
                        ]);
                      }
                    }}
                  />
                  <span className="event-slider"></span>
                </label>
              </div>
            )}

            {/* Render Table + Sanction Details only if enabled */}
            {enabled && (
              <>
                {/* Name of Funding Agency Table */}
                <div className="event-budget-table-wrap">
                  <table className="event-sponsor-table event-budget-style-table">
                    <thead>
                      <tr>
                        <th>S.No.</th>
                        <th>Name of the Funding Agency</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{index + 1}</td>
                        <td>
                          <input
                            type="text"
                            className="event-input-field"
                            placeholder="Enter Agency Name"
                            value={agency.agency}
                            onChange={(e) => handleAgencyChange(agency.id, e.target.value)}
                            disabled={!enabled}
                          />
                        </td>
                        <td className="event-row-actions text-center align-middle">
                          <div className="event-flex items-center justify-center gap-2">
                            {index === 0 && agencies.length === 1 ? (
                              <button
                                type="button"
                                className="event-add"
                                onClick={addAgency}
                                title="Add"
                                disabled={!enabled}
                              >
                                <Plus size={16} />
                              </button>
                            ) : isLastRow ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="event-icon-btn"
                                  onClick={() => deleteAgency(agency.id)}
                                  title="Delete"
                                  disabled={!enabled}
                                >
                                  <Trash2 size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="event-add"
                                  onClick={addAgency}
                                  title="Add"
                                  disabled={!enabled}
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="event-icon-btn"
                                onClick={() => deleteAgency(agency.id)}
                                title="Delete"
                                disabled={!enabled}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Sanction Order Details */}
                <div className="event-sanction-card enabled">
                  <div className="event-sanction-header">
                    <h4 style={{ fontSize: '20px' }}>Sanction Order Details</h4>
                  </div>

                  <div className="event-form-row event-inline-fields">
                    <input
                      type="text"
                      className="event-input-field"
                      placeholder="Order No."
                      value={agency.sanctionDetails.orderNo}
                      onChange={(e) => handleSanctionChange(agency.id, 'orderNo', e.target.value)}
                    />
                    <input
                      type="number"
                      className="event-input-field"
                      placeholder="Amount"
                      value={agency.sanctionDetails.amount}
                      onChange={(e) => handleSanctionChange(agency.id, 'amount', e.target.value)}
                    />
                    <input
                      type="date"
                      className="event-input-field"
                      value={agency.sanctionDetails.date}
                      onChange={(e) => handleSanctionChange(agency.id, 'date', e.target.value)}
                    />
                  </div>

                  {/* Supporting Docs */}
                  <div className="event-docs-grid">
                    {agency.docStates.map((doc, i) => (
                      <div className="event-doc-row event-compact-doc-row" key={i}>
                        <span className="event-doc-label">{doc.name}</span>
                        <label className="event-switch">
                          <input
                            type="checkbox"
                            checked={doc.enabled}
                            onChange={() => handleToggleDoc(agency.id, i)}
                          />
                          <span className="event-slider"></span>
                        </label>
                        <label
                          className={`event-upload-icon ${!doc.enabled ? 'disabled' : ''}`}
                          onClick={() =>
                            doc.enabled &&
                            document.getElementById(`file-upload-${agency.id}-${i}`)?.click()
                          }
                        >
                          <CloudUpload size={18} />
                          <input
                            type="file"
                            onChange={(e) =>
                              handleFileChange(agency.id, i, e.target.files?.[0] || null)
                            }
                            style={{ display: 'none' }}
                            disabled={!doc.enabled}
                            id={`file-upload-${agency.id}-${i}`}
                          />
                        </label>
                        <span
                          className={`event-eye-icon ${!doc.file ? 'disabled' : ''}`}
                          onClick={() => doc.file && viewFile(doc.file)}
                        >
                          <Eye size={18} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        );
      })}

      {/* Finance Section - always visible */}
      <div>
        <FinanceSection
          incomeRows={incomeRows}
          setIncomeRows={setIncomeRows}
          expenditureRows={expenditureRows}
          setExpenditureRows={setExpenditureRows}
          financeDocs={financeDocs}
          setFinanceDocs={setFinanceDocs}
          budgetRows={budgetRows}
          setBudgetRows={setBudgetRows}
        />
      </div>

      {/* Navigation */}
      <div className="event-section-navigation">
        <button type="button" className="event-prev-btn" onClick={() => goToTab('pre-event')}>
          ← Previous
        </button>
        <button
          type="button"
          className="event-save-next-btn"
          onClick={handleSubmitToBackend}
          disabled={isSubmittingFinance}
        >
          {isSubmittingFinance ? 'Saving...' : 'Save & Next →'}
        </button>
      </div>
    </div>
  );
};

// Export SponsoringAgencySection as FinanceSection to match EventPage's import
// Export as FinanceSection to match EventPage's import expectation
export default SponsoringAgencySection as React.ComponentType<SponsoringAgencySectionProps>;
export { SponsoringAgencySection };

// =========================================
// ParticipantDetails.tsx
// =========================================

interface EventSummary {
  teamEnabled?: boolean;
  documentEnabled?: boolean;
  accommodationEnabled?: boolean;
  registrationFeeEnabled?: boolean;
  certificateEnabled?: boolean;
}

interface ParticipantDetailsProps {
  goToTab?: (tab: string) => void;
  eventId?: string;
  summary?: EventSummary | null;
}

// Helper component for mathematically rendering a tiny 5-point star in SVG
const StarPath: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const currR = i % 2 === 0 ? r : r / 2;
    points.push(`${cx + currR * Math.cos(angle)},${cy + currR * Math.sin(angle)}`);
  }
  return <polygon points={points.join(' ')} fill="#0069ab" stroke="none" />;
};

// Custom SVG component: User with checkmark badge
const UserCheckCustom: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0069ab"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <circle cx="18" cy="18" r="4.5" fill="#0069ab" stroke="none" />
    <path d="M16.5 18l1 1 2-2" stroke="#ffffff" strokeWidth="1.2" />
  </svg>
);

// Custom SVG component: User with stars and checkmark badge
const UserStarsCustom: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0069ab"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <circle cx="18" cy="18" r="4.5" fill="#0069ab" stroke="none" />
    <path d="M16.5 18l1 1 2-2" stroke="#ffffff" strokeWidth="1.2" />

    <StarPath cx={4} cy={6} r={2} />
    <StarPath cx={8} cy={3.5} r={2} />
    <StarPath cx={12} cy={2.5} r={2} />
    <StarPath cx={16} cy={3.5} r={2} />
    <StarPath cx={20} cy={6} r={2} />
  </svg>
);

// Custom SVG component: Certificate with seal on the bottom-left
const CertificateCustom: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0069ab"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}
  >
    <rect x="3" y="5" width="18" height="13" rx="1.5" />
    <line x1="8" y1="9" x2="17" y2="9" strokeWidth="1.5" />
    <line x1="8" y1="12" x2="14" y2="12" strokeWidth="1.5" />
    <path d="M6 14v5l1.5-1 1.5 1v-5" fill="#0069ab" stroke="none" />
    <circle cx="7.5" cy="14" r="3" fill="#0069ab" stroke="none" />
    <circle cx="7.5" cy="14" r="0.8" fill="#ffffff" stroke="none" />
  </svg>
);

// Custom SVG Icons matching the mockup exactly
const RegisteredIcon: React.FC = () => (
  <svg
    width="34"
    height="34"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0069ab"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="#f0f6ff" />
    <line x1="8" y1="10" x2="14" y2="10" />
    <line x1="8" y1="14" x2="13" y2="14" />
    <line x1="8" y1="18" x2="12" y2="18" />
    {/* Pen outline */}
    <path d="M18.5 7.5l2 2-3.5 3.5-2-2z" fill="#0069ab" stroke="none" />
    <path d="M14.5 11.5l-.5 1.5 1.5-.5z" fill="#0069ab" stroke="none" />
  </svg>
);

const ShortlistedIcon: React.FC = () => (
  <svg
    width="34"
    height="34"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0069ab"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="#f0f6ff" />
    <line x1="8" y1="10" x2="14" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
    <line x1="8" y1="18" x2="11" y2="18" />
    {/* Magnifying Glass badge */}
    <circle cx="18" cy="18" r="3" fill="#ffffff" />
    <path d="M20 20l2 2" />
  </svg>
);

const SelectedIcon: React.FC = () => (
  <svg
    width="34"
    height="34"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0069ab"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="#f0f6ff" />
    <line x1="8" y1="10" x2="13" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
    <line x1="8" y1="18" x2="11" y2="18" />
    {/* Check Circle badge */}
    <circle cx="18" cy="18" r="4.5" fill="#0069ab" stroke="none" />
    <path d="M15.5 18l1.5 1.5 3-3" stroke="#ffffff" strokeWidth="1.2" />
  </svg>
);

const NotSelectedIcon: React.FC = () => (
  <svg
    width="34"
    height="34"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0069ab"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="#f0f6ff" />
    <line x1="8" y1="10" x2="13" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
    <line x1="8" y1="18" x2="11" y2="18" />
    {/* X Circle badge on the top-left */}
    <circle cx="6" cy="6" r="4.5" fill="#0069ab" stroke="none" />
    <path d="M4.5 4.5l3 3M7.5 4.5l-3 3" stroke="#ffffff" strokeWidth="1.2" />
  </svg>
);

const HostelIcon: React.FC = () => (
  <svg
    width="34"
    height="34"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0069ab"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" />
    <rect x="6" y="13" width="12" height="6" rx="1" />
    <path d="M9 13v6" />
    <circle cx="10.5" cy="15.5" r="1.2" fill="#0069ab" stroke="none" />
  </svg>
);

const FeesIcon: React.FC = () => (
  <svg
    width="34"
    height="34"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0069ab"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {/* Tilted banknotes */}
    <rect x="6" y="5" width="12" height="7" rx="1" transform="rotate(-15 12 8.5)" />
    <rect x="7" y="6" width="12" height="7" rx="1" fill="#ffffff" />
    {/* Hand */}
    <path d="M2 17c1-2 4-2 6-1h10a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6" />
  </svg>
);

const ParticipantDetails: React.FC<ParticipantDetailsProps> = ({ eventId, summary }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;

    let isActive = true;

    const fetchParticipants = (isInitial = false) => {
      if (isInitial) setLoading(true);

      authenticityUtility
        .get(`/events/${encodeURIComponent(eventId)}/participants`, {
          params: { _: Date.now() },
        })
        .then((res: any) => {
          if (isActive) {
            setParticipants(Array.isArray(res?.participants) ? res.participants : []);
            setError(null);
          }
        })
        .catch((err) => {
          if (isActive) {
            console.error('Failed to fetch participants:', err);
            if (isInitial) {
              setError('Failed to load participants. Please try again later.');
            }
          }
        })
        .finally(() => {
          if (isActive && isInitial) {
            setLoading(false);
          }
        });
    };

    fetchParticipants(true);

    // Auto-update participants list when a new user registers on the User Website
    const intervalId = setInterval(() => {
      fetchParticipants(false);
    }, 3000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [eventId]);

  const handleViewDocument = (participant: any) => {
    const documentUrl =
      participant?.document_url ||
      participant?.documentUrl ||
      participant?.document?.url ||
      participant?.upload?.url ||
      participant?.uploadUrl ||
      '';

    if (!documentUrl) {
      setError('No document is available for this participant.');
      return;
    }

    window.open(documentUrl, '_blank', 'noopener,noreferrer');
  };

  const toggleHostel = (id: number) => {
    const p = participants.find((p) => p.id === id);
    if (!p) return;
    const newHostel = p.hostel === 'YES' ? 'NO' : 'YES';
    authenticityUtility
      .put(`/events/${eventId}/participants/${id}`, { hostel: newHostel })
      .then(() => {
        setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, hostel: newHostel } : p)));
      })
      .catch(console.error);
  };

  const handleStatusChange = (id: number, status: string) => {
    authenticityUtility
      .put(`/events/${eventId}/participants/${id}`, { status })
      .then(() => {
        setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      })
      .catch(console.error);
  };

  const toggleAction1 = (id: number) => {
    const p = participants.find((p) => p.id === id);
    if (!p) return;
    const newAction1 = !p.action1;
    authenticityUtility
      .put(`/events/${eventId}/participants/${id}`, { action1: newAction1 })
      .then(() => {
        setParticipants((prev) =>
          prev.map((p) => (p.id === id ? { ...p, action1: newAction1 } : p)),
        );
      })
      .catch(console.error);
  };

  const toggleAction2 = (id: number) => {
    const p = participants.find((p) => p.id === id);
    if (!p) return;
    const newAction2 = !p.action2;
    authenticityUtility
      .put(`/events/${eventId}/participants/${id}`, { action2: newAction2 })
      .then(() => {
        setParticipants((prev) =>
          prev.map((p) => (p.id === id ? { ...p, action2: newAction2 } : p)),
        );
      })
      .catch(console.error);
  };

  const toggleAction3 = (id: number) => {
    const p = participants.find((p) => p.id === id);
    if (!p) return;
    const newAction3 = { ...p.action3, active: !p.action3?.active };
    authenticityUtility
      .put(`/events/${eventId}/participants/${id}`, { action3: newAction3 })
      .then(() => {
        setParticipants((prev) =>
          prev.map((p) => (p.id === id ? { ...p, action3: newAction3 } : p)),
        );
      })
      .catch(console.error);
  };

  const stats = useMemo(() => {
    const feeValue =
      participants.find((p) => p.fees != null)?.fees ??
      participants.find((p) => p.fee != null)?.fee ??
      0;
    return {
      registered: participants.length,
      shortlisted: participants.filter((p) => p.status === 'Shortlisted' || p.status === 'Selected')
        .length,
      selected: participants.filter((p) => p.status === 'Selected').length,
      rejected: participants.filter((p) => p.status === 'Rejected').length,
      hostel: participants.filter((p) => p.hostel === 'YES').length,
      fees: feeValue,
    };
  }, [participants]);

  return (
    <div className="participant-details-wrapper">
      <div className="event-finance-card">
        {/* Stats Cards Section */}
        <div className="stats-cards-grid">
          <div className="stat-card">
            <div className="stat-icon-container">
              <RegisteredIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Registered</span>
              <span className="stat-value">{String(stats.registered).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <ShortlistedIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Shortlisted</span>
              <span className="stat-value">{String(stats.shortlisted).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <SelectedIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Selected</span>
              <span className="stat-value">{String(stats.selected).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <NotSelectedIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Not Selected</span>
              <span className="stat-value">{String(stats.rejected).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <HostelIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Hostel</span>
              <span className="stat-value">{String(stats.hostel).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <FeesIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Fees</span>
              <span className="stat-value">{stats.fees}</span>
            </div>
          </div>
        </div>

        {/* Participant Table Section */}
        <table className="event-finance-table">
          <thead>
            <tr>
              <th className="col-sno">S.No.</th>
              <th className="col-participant">Participant</th>
              <th className="col-category">Category</th>
              {summary?.teamEnabled && (
                <th className="col-group">
                  <Users size={18} />
                </th>
              )}
              {summary?.documentEnabled && <th className="col-doc">Doc.</th>}
              {summary?.accommodationEnabled && <th className="col-hostel">Hostel</th>}
              {summary?.registrationFeeEnabled && <th className="col-fees">Fees</th>}
              <th className="col-status">Status</th>
              <th className="col-action-1">
                <UserCheckCustom />
              </th>
              <th className="col-action-2">
                <UserStarsCustom />
              </th>
              {summary?.certificateEnabled && (
                <th className="col-action-3">
                  <CertificateCustom />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '20px' }}>
                  {EVENT_COPY.loadingParticipants}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '20px', color: 'red' }}>
                  {error}
                </td>
              </tr>
            ) : participants.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '20px' }}>
                  {EVENT_COPY.noParticipantsFound}
                </td>
              </tr>
            ) : (
              participants.map((p, index) => (
                <tr key={p.id}>
                  <td className="col-sno">{index + 1}</td>
                  <td className="col-participant">
                    <div className="participant-info-cell">
                      <div className="info-icon-wrapper">
                        <Info size={16} className="info-icon" />
                      </div>
                      <div className="participant-text">
                        <div className="participant-name">{p.name}</div>
                        <div className="participant-inst">{p.institution}</div>
                      </div>
                    </div>
                  </td>
                  <td className="col-category">{p.category}</td>
                  <td className="col-group">{p.group}</td>
                  <td className="col-doc">
                    {p.hasDoc ? (
                      <Paperclip
                        size={18}
                        className="blue-icon clickable-icon"
                        onClick={() => handleViewDocument(p)}
                      />
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="col-hostel">
                    <span className={`hostel-text ${p.hostel === 'YES' ? 'yes' : 'no'}`}>
                      {p.hostel}
                    </span>
                  </td>
                  <td className="col-fees">
                    <div className="fees-cell">
                      <span>₹{p.fees}</span>
                      <FileText
                        size={16}
                        className="blue-icon clickable-icon"
                        onClick={() => handleViewDocument(p)}
                      />
                    </div>
                  </td>
                  <td className="col-status">
                    <div className="status-cell-wrapper">
                      <div className="status-dropdown">
                        <select
                          value={p.status}
                          onChange={(e) => handleStatusChange(p.id, e.target.value)}
                        >
                          <option value="Registered">Pending</option>
                          <option value="Shortlisted">Shortlisted</option>
                          <option value="Selected">Selected</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                        <ChevronDown size={12} className="dropdown-icon" />
                      </div>
                      <CheckCircle2
                        size={22}
                        className={`success-icon ${p.action1 ? 'filled' : 'outline'}`}
                        onClick={() => toggleAction1(p.id)}
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                      />
                    </div>
                  </td>
                  {summary?.teamEnabled && (
                    <td className="col-group" style={{ fontSize: '13px' }}>
                      {p.group_id ? p.group_id : '-'}
                    </td>
                  )}
                  {summary?.documentEnabled && (
                    <td className="col-doc">
                      {p.document_upload ? (
                        <button
                          className="icon-btn"
                          title="View Document"
                          onClick={() => handleViewDocument(p)}
                        >
                          <Paperclip size={18} />
                        </button>
                      ) : (
                        <span style={{ color: '#ccc' }}>-</span>
                      )}
                    </td>
                  )}
                  {summary?.accommodationEnabled && (
                    <td className="col-hostel">
                      {p.accommodation_required === 1 ? (
                        <CheckCircle2 size={18} className="status-icon green" />
                      ) : (
                        <span style={{ color: '#ccc' }}>-</span>
                      )}
                    </td>
                  )}
                  {summary?.registrationFeeEnabled && (
                    <td className="col-fees">
                      {p.fee_status === 'Paid' ? (
                        <CheckCircle2 size={18} className="status-icon green" />
                      ) : p.fee_status === 'Pending' ? (
                        <Hourglass size={18} className="status-icon yellow" />
                      ) : (
                        <span style={{ color: '#ccc' }}>-</span>
                      )}
                    </td>
                  )}
                  <td className="col-action-1">
                    <div
                      className={`custom-checkbox-wrapper ${p.action2 ? 'checked' : ''}`}
                      onClick={() => toggleAction2(p.id)}
                    >
                      {p.action2 && <Check size={14} className="checkbox-check" />}
                    </div>
                  </td>
                  <td className="col-action-2">
                    <button className="icon-btn">
                      <CheckCircle2 size={18} />
                    </button>
                  </td>
                  {summary?.certificateEnabled && (
                    <td className="col-action-3">
                      <button
                        className="icon-btn certificate-btn"
                        title="Certificate"
                        onClick={() => handleViewDocument(p)}
                      >
                        <Award size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export { ParticipantDetails };

// =========================================
// PreEvent.tsx
// =========================================

interface PreEventProps {
  goToTab: (tab: string) => void;
  eventId?: string;
  isSubEvent?: boolean;
}

interface MainEventOption {
  id: string | number;
  title: string;
  isMultiEvent: boolean | number;
  parent_id?: number | null;
}

const PreEvent: React.FC<PreEventProps> = ({ goToTab, eventId, isSubEvent }) => {
  const [selectedSubEventId, setSelectedSubEventId] = useState('');
  const [mainEvents, setMainEvents] = useState<{ id: string; title: string }[]>([]);
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: string;
    type: AlertType;
  }>({
    show: false,
    message: '',
    type: 'info',
  });

  useEffect(() => {
    if (!isSubEvent) {
      setMainEvents([]);
      return;
    }

    authenticityUtility
      .get<MainEventOption[] | { data: MainEventOption[] }>('/events')
      .then((res) => {
        const events = (
          Array.isArray(res) ? res : (res as { data?: MainEventOption[] }).data || []
        ) as MainEventOption[];
        setMainEvents(
          events
            .filter((event) => !event.parent_id && Boolean(event.isMultiEvent))
            .map((event) => ({ id: String(event.id), title: event.title || 'Untitled Event' })),
        );
      })
      .catch((err) => console.error('Error fetching main events:', err));
  }, [isSubEvent, eventId]);

  const showValidationAlert = (message: string) => {
    setAlertConfig({ show: true, message, type: 'warning' });
  };

  const handleSubmit = async (data: EventApprovalFormData) => {
    const missingFields: string[] = [];
    if (!data.name) missingFields.push('Event Name');
    if (!data.dateFrom) missingFields.push('Start Date');
    if (!data.dateTo) missingFields.push('End Date');
    if (!data.category) missingFields.push('Category');
    if (!data.eventType || data.eventType.length === 0) missingFields.push('Type');
    if (!data.level) missingFields.push('Level');
    if ((data.mode === 'Virtual' || data.mode === 'Hybrid') && !data.meetingLink) {
      missingFields.push('Meeting Link');
    }
    if ((data.mode === 'Physical' || data.mode === 'Hybrid') && !data.venue) {
      missingFields.push('Venue');
    }
    if (
      data.ceremonyEnabled &&
      data.inauguralEnabled &&
      (!data.inauguralDate || !data.inauguralTime || !data.inauguralVenue)
    ) {
      missingFields.push('Inaugural Ceremony Details');
    }
    if (
      data.ceremonyEnabled &&
      data.valedictoryEnabled &&
      (!data.valedictoryDate || !data.valedictoryTime || !data.valedictoryVenue)
    ) {
      missingFields.push('Valedictory Ceremony Details');
    }

    if (missingFields.length > 0) {
      showValidationAlert(
        `Please fill the following required fields: ${missingFields.join(', ')}.`,
      );
      return;
    }

    const eventSubmitData = {
      title: data.name,
      description: '',
      category: data.category,
      event_type: data.eventType,
      level: data.level,
      start_date: data.dateFrom,
      end_date: data.dateTo,
      mode: data.mode || 'Physical',
      meeting_link: data.mode === 'Virtual' || data.mode === 'Hybrid' ? data.meetingLink : null,
      venue: data.mode === 'Physical' || data.mode === 'Hybrid' ? data.venue : null,
      session: data.session || null,
      registration_fee_enabled: data.registrationFeeEnabled,
      registration_fee_amount: data.feeRows[0]?.individual || null,
      registration_link: null,
      bank_account: null,
      topics: [],
      expected_participants: data.expectedParticipants,
      themes: Array.isArray(data.themes) ? data.themes : data.themes ? [data.themes] : [],
      sdgs: Array.isArray(data.sdgs) ? data.sdgs : data.sdgs ? [data.sdgs] : [],
      inaugural_enabled: data.ceremonyEnabled && data.inauguralEnabled,
      inaugural_date: data.inauguralEnabled ? data.inauguralDate : null,
      inaugural_time: data.inauguralEnabled ? data.inauguralTime : null,
      inaugural_venue: data.inauguralEnabled ? data.inauguralVenue : null,
      valedictory_enabled: data.ceremonyEnabled && data.valedictoryEnabled,
      valedictory_date: data.valedictoryEnabled ? data.valedictoryDate : null,
      valedictory_time: data.valedictoryEnabled ? data.valedictoryTime : null,
      valedictory_venue: data.valedictoryEnabled ? data.valedictoryVenue : null,
      collaboration_data: data.collaborators
        .filter((row) => row.type || row.name)
        .map((row) => ({ type: row.type, name: row.name })),
      coordinators: data.coordinators.filter(
        (row) => row.name || row.email || row.department || row.institution,
      ),
      budget: [],
      parent_id: isSubEvent ? Number(selectedSubEventId) : null,
      is_multi_event: data.isMultiEventEnabled || false,

      // --- ADDED MISSING DATA ---
      registrationSettings: {
        enabled: data.registrationSettingsEnabled,
        eligibleParticipants: Array.isArray(data.eligibleParticipants)
          ? data.eligibleParticipants.join(', ')
          : data.eligibleParticipants,
        openTo: data.openTo,
        genderRestriction: data.genderRestriction,
        minAge: data.minAge,
        maxAge: data.maxAge,
        registrationStatus: data.registrationStatus,
        lastDate: data.lastDate,
        extension: data.extension,
        extendedDate: data.extendedDate,
        shortlistingRequired: data.shortlistingRequired,
        selectionIntimation: data.selectionIntimation,
        teamEnabled: data.teamEnabled,
        minTeamSize: data.minTeamSize,
        maxTeamSize: data.maxTeamSize,
      },
      documentSettings: {
        enabled: data.documentEnabled,
        documentName: data.documentName,
        documentType: data.documentType,
        documentSize: data.documentSize,
        textFieldEnabled: data.documentTextFieldEnabled,
      },
      feedbackEnabled: data.feedbackEnabled,
      certificateEnabled: data.certificateEnabled,
      feeRows: data.registrationFeeEnabled ? data.feeRows : [],
      sponsoringAgencies: data.sponsoringAgencyEnabled ? data.sponsoringAgencies : [],
      accommodation: {
        enabled: data.accommodationEnabled,
        type: data.accommodationType,
        gentsLimit: data.gentsAccommodationLimit,
        ladiesLimit: data.ladiesAccommodationLimit,
      },
      // --------------------------
    };

    try {
      if (eventId && eventId !== 'new') {
        await authenticityUtility.put(`/events/${eventId}`, eventSubmitData);
      } else {
        await authenticityUtility.post('/events', eventSubmitData);
      }
      setAlertConfig({
        show: true,
        message:
          eventId && eventId !== 'new'
            ? 'Event updated successfully!'
            : 'Event created successfully!',
        type: 'success',
      });
      goToTab('finance');
    } catch (error: any) {
      const backendError =
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.response?.data?.message ||
        error.message;
      setAlertConfig({
        show: true,
        message: `Failed to submit the form. Backend Error: ${backendError}`,
        type: 'error',
      });
    }
  };

  if (isSubEvent) {
    const selectedEvent = mainEvents.find((e) => String(e.id) === selectedSubEventId);

    return (
      <div className="event-approval-page journal-form-body">
        <div className="journal-form-container event-approval-container">
          <div className="event-approval-card form-card">
            <div style={{ marginTop: '16px' }}>
              <label className="event-approval-section-heading" htmlFor="main-event-select">
                Main Event
              </label>
              {mainEvents.length === 0 ? (
                <p style={{ marginTop: '8px', color: '#64748b' }}>
                  {EVENT_COPY.noMainEventsAvailable}
                </p>
              ) : (
                <select
                  id="main-event-select"
                  className={
                    selectedSubEventId
                      ? 'event-approval-select has-value'
                      : 'event-approval-select is-placeholder'
                  }
                  value={selectedSubEventId}
                  onChange={(e) => setSelectedSubEventId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '16px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                  }}
                >
                  <option value="">{EVENT_COPY.noMainEventOption}</option>
                  {mainEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {selectedSubEventId && (
            <div style={{ marginTop: '24px' }}>
              <EventApprovalCards
                title={selectedEvent?.title || ''}
                submitLabel={EVENT_COPY.submitNext}
                showHeaderActions={false}
                showExtendedSections={false}
                showMultiEventToggle={false}
                isSubEvent={true}
                onSubmit={handleSubmit}
              />
            </div>
          )}
        </div>
        <AlertModal
          show={alertConfig.show}
          onHide={() => setAlertConfig((current) => ({ ...current, show: false }))}
          message={alertConfig.message}
          type={alertConfig.type}
        />
      </div>
    );
  }

  return (
    <>
      <EventApprovalCards
        title=""
        submitLabel={EVENT_COPY.submitNext}
        showHeaderActions={false}
        showExtendedSections={!isSubEvent}
        showMultiEventToggle={!isSubEvent}
        isSubEvent={isSubEvent}
        onSubmit={handleSubmit}
      />
      <AlertModal
        show={alertConfig.show}
        onHide={() => setAlertConfig((current) => ({ ...current, show: false }))}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </>
  );
};

export { PreEvent };
export { Dashboard as EventDashboard };
