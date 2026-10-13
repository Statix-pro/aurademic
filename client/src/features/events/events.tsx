import './events.css';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
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
  RotateCw,
  MessageSquare,
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
  Settings,
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
  ExternalLink,
  Loader2,
  Menu,
  LayoutGrid,
  IndianRupee,
  History,
  Network,
  BarChart2,
  LogOut,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, ChangeEvent, useMemo, useRef } from 'react';
import { FaBuilding, FaLayerGroup, FaMapMarkerAlt, FaRegClock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useLocation, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { useAuth } from '../../contexts/AuthContext';
import KSRCTLogo from '../../shared/assets/images/ksrct_logo.png';
import { useAbility } from '../../shared/casl/AbilityContext';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomCard from '../../shared/components/ui/CustomCard';
import CustomDropdown from '../../shared/components/ui/CustomDropdown';
import CustomFileUploader from '../../shared/components/ui/CustomFileUploader';
import CustomInput from '../../shared/components/ui/CustomInput';
import CustomModal from '../../shared/components/ui/CustomModal';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
import DeleteConfirmationModal from '../../shared/components/ui/DeleteConfirmationModal';
import RecordHeaderBanner from '../../shared/components/ui/RecordHeaderBanner';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import { getGuesthouseWorkflowStage } from '../../shared/utils/permissionUtils';

// =========================================
// Event Approval Workflow Engine Helpers
// =========================================

export const EVENT_WORKFLOW_STAGE_ROLES: Record<string, string> = {
  hod_pending: 'hod',
  iqac_pending: 'iqac',
  principal_pending: 'principal',
};

export const EVENT_WORKFLOW_STAGE_LABELS: Record<string, string> = {
  draft: 'Draft',
  hod_pending: 'Pending HOD Approval',
  iqac_pending: 'Pending IQAC Approval',
  principal_pending: 'Pending Principal Approval',
  approved: 'Approved',
  published: 'Published',
  return: 'Needs Correction (Rejected)',
};

export function getEventWorkflowStageLabel(rawState: any): string {
  if (!rawState) return 'Draft';
  let stage = 'draft';
  if (typeof rawState === 'string') {
    try {
      const parsed = JSON.parse(rawState);
      stage = parsed.status || parsed.currentStage || rawState;
    } catch {
      stage = rawState;
    }
  } else if (typeof rawState === 'object') {
    stage = rawState.status || rawState.currentStage || 'draft';
  }
  return EVENT_WORKFLOW_STAGE_LABELS[String(stage).toLowerCase()] || String(stage);
}

export function getCategoryCardTheme(category: string) {
  const catUpper = String(category || '')
    .trim()
    .toUpperCase();
  if (catUpper.includes('NON') || catUpper.includes('SEMINAR')) {
    return {
      pillBg: '#6366f1',
      iconBg: '#4f46e5',
      subBg: '#eef2ff',
      subText: '#4338ca',
      subBorder: '#c7d2fe',
    };
  }
  if (catUpper.includes('TECH') || catUpper.includes('WORKSHOP')) {
    return {
      pillBg: '#0ea5e9',
      iconBg: '#0284c7',
      subBg: '#f0f9ff',
      subText: '#0369a1',
      subBorder: '#bae6fd',
    };
  }
  if (catUpper.includes('CULT') || catUpper.includes('DANCE') || catUpper.includes('MUSIC')) {
    return {
      pillBg: '#a855f7',
      iconBg: '#7c3aed',
      subBg: '#faf5ff',
      subText: '#7e22ce',
      subBorder: '#f3e8ff',
    };
  }
  if (catUpper.includes('SPORT') || catUpper.includes('ATHLETIC')) {
    return {
      pillBg: '#f97316',
      iconBg: '#ea580c',
      subBg: '#fff7ed',
      subText: '#c2410c',
      subBorder: '#fed7aa',
    };
  }
  if (catUpper.includes('LIT') || catUpper.includes('QUIZ') || catUpper.includes('DEBATE')) {
    return {
      pillBg: '#f59e0b',
      iconBg: '#d97706',
      subBg: '#fefce8',
      subText: '#b45309',
      subBorder: '#fef08a',
    };
  }
  if (catUpper.includes('MANAGE') || catUpper.includes('BUSI')) {
    return {
      pillBg: '#ec4899',
      iconBg: '#db2777',
      subBg: '#fdf2f8',
      subText: '#be185d',
      subBorder: '#fce7f3',
    };
  }
  if (catUpper.includes('MULTI') || catUpper.includes('FEST')) {
    return {
      pillBg: '#10b981',
      iconBg: '#059669',
      subBg: '#f0fdf4',
      subText: '#15803d',
      subBorder: '#bbf7d0',
    };
  }
  if (catUpper.includes('CONF') || catUpper.includes('SYMP')) {
    return {
      pillBg: '#14b8a6',
      iconBg: '#0d9488',
      subBg: '#f0fdfa',
      subText: '#0f766e',
      subBorder: '#99f6e4',
    };
  }
  return {
    pillBg: '#0ea5e9',
    iconBg: '#0284c7',
    subBg: '#f0f9ff',
    subText: '#0369a1',
    subBorder: '#bae6fd',
  };
}

export function renderCategoryCardIcon(category: string) {
  const catUpper = String(category || '')
    .trim()
    .toUpperCase();
  if (catUpper.includes('TECH') && !catUpper.includes('NON')) {
    return (
      <svg
        style={{ width: '16px', height: '16px' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }
  if (catUpper.includes('CULT')) {
    return (
      <svg
        style={{ width: '16px', height: '16px' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" />
      </svg>
    );
  }
  if (catUpper.includes('SPORT')) {
    return (
      <svg
        style={{ width: '16px', height: '16px' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2" />
      </svg>
    );
  }
  if (catUpper.includes('LIT')) {
    return (
      <svg
        style={{ width: '16px', height: '16px' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    );
  }
  if (catUpper.includes('MANAGE') || catUpper.includes('BUSI')) {
    return (
      <svg
        style={{ width: '16px', height: '16px' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 3H8l-4 4h16l-4-4z" />
      </svg>
    );
  }
  if (catUpper.includes('MULTI')) {
    return (
      <svg
        style={{ width: '16px', height: '16px' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="3" y="4" width="7" height="7" rx="1.5" />
        <rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="3" y="13" width="7" height="7" rx="1.5" />
        <rect x="14" y="13" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg
      style={{ width: '16px', height: '16px' }}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function formatEventDisplayDate(dateStr: any) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function canUserApproveEventStage(user: any, rawState: any): boolean {
  if (!user) return false;
  if (user.isAdmin || user.isSuperAdmin || user.is_admin || user.is_super_admin) {
    return true;
  }
  let stage = 'draft';
  if (typeof rawState === 'string') {
    try {
      const parsed = JSON.parse(rawState);
      stage = parsed.status || parsed.currentStage || rawState;
    } catch {
      stage = rawState;
    }
  } else if (rawState && typeof rawState === 'object') {
    stage = rawState.status || rawState.currentStage || 'draft';
  }

  const requiredRole = EVENT_WORKFLOW_STAGE_ROLES[String(stage).toLowerCase()];
  if (!requiredRole) return false;

  const rawUserRoles: any[] = [];
  if (user.role) rawUserRoles.push(user.role);
  if (Array.isArray(user.roles)) rawUserRoles.push(...user.roles);
  if (Array.isArray(user.user_roles)) rawUserRoles.push(...user.user_roles);
  if (Array.isArray(user.user_entity_roles)) rawUserRoles.push(...user.user_entity_roles);
  if (Array.isArray(user.permissions)) rawUserRoles.push(...user.permissions);

  const userRoles: string[] = rawUserRoles.map((r: any) =>
    String(typeof r === 'object' ? r.role_code || r.code || r.name || r.role || r : r || '')
      .trim()
      .toLowerCase(),
  );

  const designation = String(user.designation || user.designation_name || '').toLowerCase();
  const title = String(user.title || user.job_title || '').toLowerCase();

  const isHodFlag = Boolean(
    user.is_hod ||
    user.isHod ||
    Number(user.is_hod) === 1 ||
    user.role === 'hod' ||
    user.role === 'HOD' ||
    userRoles.some(
      (r) => r === 'hod' || r === 'head_of_department' || r.includes('hod') || r.includes('head'),
    ) ||
    designation.includes('hod') ||
    designation.includes('head') ||
    title.includes('hod') ||
    title.includes('head'),
  );

  if (requiredRole === 'hod' && isHodFlag) {
    return true;
  }

  const isIqacFlag = Boolean(
    user.is_iqac ||
    user.isIqac ||
    userRoles.some((r) => r.includes('iqac')) ||
    designation.includes('iqac') ||
    title.includes('iqac'),
  );

  if (requiredRole === 'iqac' && isIqacFlag) {
    return true;
  }

  const isPrincipalFlag = Boolean(
    user.is_principal ||
    user.isPrincipal ||
    userRoles.some((r) => r.includes('principal')) ||
    designation.includes('principal') ||
    title.includes('principal'),
  );

  if (requiredRole === 'principal' && isPrincipalFlag) {
    return true;
  }

  return (
    userRoles.includes('super_admin') ||
    userRoles.includes('admin') ||
    userRoles.includes('head_of_department') ||
    userRoles.includes('hod') ||
    userRoles.includes(requiredRole.toLowerCase())
  );
}

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

export const FINANCE_INITIAL_DOCS = ['Sanction Order', 'Utilization Certificate', 'Bank Statement'];

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
// CustomEventSelect Component
// =========================================

interface CustomEventSelectProps {
  value?: string | number;
  onChange?: (
    e: React.ChangeEvent<HTMLSelectElement> | { target: { value: string; name?: string } },
  ) => void;
  name?: string;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
  options?: readonly (string | { value: string | number; label: string })[];
  children?: React.ReactNode;
}

const CustomEventSelect: React.FC<CustomEventSelectProps> = ({
  value,
  onChange,
  name,
  className = '',
  disabled = false,
  style,
  placeholder = 'Select',
  options,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    if (options && options.length > 0) {
      return options.map((opt) =>
        typeof opt === 'string'
          ? { value: opt, label: opt }
          : { value: String(opt.value), label: opt.label },
      );
    }
    const extracted: { value: string; label: string }[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        const props: any = child.props || {};
        const val = props.value !== undefined ? String(props.value) : String(props.children || '');
        const lbl = String(props.children || val);
        extracted.push({ value: val, label: lbl });
      }
    });
    return extracted;
  }, [options, children]);

  const strValue = String(value ?? '');
  const selectedItem = items.find((i) => i.value === strValue);
  const displayLabel =
    selectedItem && selectedItem.value !== '' ? selectedItem.label : placeholder || 'Select';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectOption = (val: string) => {
    if (onChange) {
      const syntheticEvent = {
        target: { value: val, name: name || '' },
        currentTarget: { value: val, name: name || '' },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-event-select-container ${isOpen ? 'is-open' : ''} ${
        disabled ? 'is-disabled' : ''
      } ${className}`}
      style={{
        ...style,
        ...(isOpen ? { zIndex: 99999, position: 'relative' } : {}),
      }}
    >
      <div
        className={`custom-event-select-trigger ${!strValue ? 'is-placeholder' : 'has-value'}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        <span className="custom-event-select-text">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`custom-event-select-arrow ${isOpen ? 'is-expanded' : ''}`}
        />
      </div>

      {isOpen && !disabled && (
        <div className="custom-event-select-menu">
          {items.map((item, idx) => (
            <div
              key={`${item.value}-${idx}`}
              className={`custom-event-select-item ${item.value === strValue ? 'is-selected' : ''}`}
              onClick={() => handleSelectOption(item.value)}
            >
              {item.label || item.value || 'Select'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
  hostCollaborator: string;
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
  | 'hostCollaborator'
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
  eventId?: number | string;
  readOnly?: boolean;
  onAddEvent?: () => void;
  onSubmit?: (data: EventApprovalFormData) => void | Promise<void>;
}

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
  institution: 'K.S.Rangasamy College of Technology',
});

const createInitialFormData = (): EventApprovalFormData => ({
  name: '',
  category: '',
  eventType: '',
  level: '',
  hostCollaborator: '',
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
  registrationStatus: 'Ongoing',
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

// =========================================
// Event Approval Workflow Panel Component
// =========================================

const EventWorkflowSection: React.FC<{
  eventId?: string | number;
  workflowState: any;
  user: any;
  readOnly?: boolean;
  onActionSuccess?: () => void;
}> = ({ eventId, workflowState, user, readOnly, onActionSuccess }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalType, setModalType] = useState<'submit' | 'approve' | 'reject' | null>(null);

  let currentStage = 'draft';
  if (typeof workflowState === 'string') {
    try {
      const parsed = JSON.parse(workflowState);
      currentStage = parsed.status || parsed.currentStage || workflowState;
    } catch {
      currentStage = workflowState;
    }
  } else if (workflowState && typeof workflowState === 'object') {
    currentStage = workflowState.status || workflowState.currentStage || 'draft';
  }
  currentStage = String(currentStage).toLowerCase();

  const isDraft = currentStage === 'draft' || currentStage === 'return';
  const isApproved = currentStage === 'approved' || currentStage === 'published';
  const canApprove = canUserApproveEventStage(user, workflowState);

  const fetchHistory = useCallback(() => {
    if (!eventId || eventId === 'new') return;
    authenticityUtility
      .get(`/events/${eventId}/history`)
      .then((res: any) => {
        if (res?.history) {
          setHistory(res.history);
        }
      })
      .catch(() => {});
  }, [eventId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleAction = async (action: 'submit' | 'approve' | 'reject') => {
    if (!eventId || eventId === 'new') return;
    try {
      setSubmitting(true);
      await authenticityUtility.post(`/events/${eventId}/${action}`, { comments });
      setModalType(null);
      setComments('');
      fetchHistory();
      if (onActionSuccess) onActionSuccess();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || `Failed to ${action} event`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!eventId || eventId === 'new') return null;

  const steps = [
    { key: 'draft', label: 'Draft' },
    { key: 'hod_pending', label: 'HOD' },
    { key: 'iqac_pending', label: 'IQAC' },
    { key: 'principal_pending', label: 'Principal' },
    { key: 'approved', label: 'Approved' },
  ];

  const getStepIndex = (stage: string) => {
    switch (stage) {
      case 'draft':
      case 'return':
        return 0;
      case 'hod_pending':
        return 1;
      case 'iqac_pending':
        return 2;
      case 'principal_pending':
        return 3;
      case 'approved':
      case 'published':
        return 4;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(currentStage);

  return (
    <div className="event-workflow-banner">
      <div className="event-workflow-header-row">
        <div className="event-workflow-title-area">
          <h3>Approval Workflow</h3>
          <span className={`event-workflow-stage-badge ${currentStage}`}>
            {getEventWorkflowStageLabel(workflowState)}
          </span>
        </div>

        {!readOnly && (
          <div className="event-workflow-action-btns">
            {isDraft && (
              <button
                type="button"
                className="event-workflow-btn submit"
                onClick={() => setModalType('submit')}
              >
                Submit for Approval
              </button>
            )}

            {!isDraft && !isApproved && canApprove && (
              <>
                <button
                  type="button"
                  className="event-workflow-btn approve"
                  onClick={() => setModalType('approve')}
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  className="event-workflow-btn reject"
                  onClick={() => setModalType('reject')}
                >
                  ✕ Reject
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="event-workflow-stepper">
        <div className="event-workflow-stepper-line" />
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIdx || isApproved;
          const isActive = idx === currentStepIdx && !isApproved;
          return (
            <div
              key={step.key}
              className={`event-workflow-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
            >
              <div className="event-workflow-step-circle">{isCompleted ? '✓' : idx + 1}</div>
              <span className="event-workflow-step-name">{step.label}</span>
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="event-approval-history-section">
          <h4>Approval History</h4>
          <div className="event-approval-history-list">
            {history.map((item) => (
              <div
                key={item.id}
                className={`event-approval-history-item ${(item.action || '').toLowerCase()}`}
              >
                <div>
                  <div className="event-approval-history-role">
                    {item.role} - {(item.action || '').toUpperCase()}
                  </div>
                  <div className="event-approval-history-meta">
                    By User #{item.user_id} on{' '}
                    {new Date(item.action_at || item.createdAt).toLocaleString()}
                  </div>
                  {item.comments && (
                    <div className="event-approval-history-comments">"{item.comments}"</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalType && (
        <CustomModal
          show={Boolean(modalType)}
          onHide={() => setModalType(null)}
          title={
            modalType === 'submit'
              ? 'Submit Event for Approval'
              : modalType === 'approve'
                ? 'Approve Event'
                : 'Reject Event'
          }
        >
          <div style={{ padding: '16px' }}>
            <p style={{ marginBottom: '12px', fontSize: '0.95rem' }}>
              {modalType === 'submit'
                ? 'Are you sure you want to submit this event to the HOD for approval?'
                : modalType === 'approve'
                  ? 'Are you sure you want to approve this event request?'
                  : 'Are you sure you want to reject this event request? It will be sent back to Draft state.'}
            </p>
            <label style={{ display: 'block', marginBottom: '16px' }}>
              <strong>Comments (Optional):</strong>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Enter any comments..."
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="event-workflow-btn"
                style={{ background: '#94a3b8', color: '#fff' }}
                onClick={() => setModalType(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`event-workflow-btn ${modalType}`}
                disabled={submitting}
                onClick={() => handleAction(modalType)}
              >
                {submitting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </CustomModal>
      )}
    </div>
  );
};

const EventApprovalCards: React.FC<EventApprovalCardsProps> = ({
  title = 'Event 1',
  eventNumber = 1,
  submitLabel = 'Save Event',
  showFooter = true,
  showHeaderActions = true,
  showExtendedSections = false,
  showMultiEventToggle = false,
  isSubEvent = false,
  eventId,
  readOnly = false,
  onAddEvent,
  onSubmit,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserDetails = useMemo(() => {
    return {
      name: (user?.name || user?.email || 'Admin').trim(),
      email: user?.email || '',
      department: user?.department || '',
      designation: user?.designation || '',
      employee_id: user?.employee_id || user?.erp_id || '',
    };
  }, [user]);

  const currentUserName = currentUserDetails.name;

  const [formData, setFormData] = useState<EventApprovalFormData>(createInitialFormData);
  const [workflowState, setWorkflowState] = useState<any>(null);

  // --- Finance Card State ---
  const [financeEnabled, setFinanceEnabled] = useState(false);
  const [financeSearchId, setFinanceSearchId] = useState('');
  const [fetchingFinance, setFetchingFinance] = useState(false);
  const [financeData, setFinanceData] = useState<any | null>(null);
  const [financeError, setFinanceError] = useState<string | null>(null);

  const handleFetchFinance = async () => {
    const rawId = financeSearchId.trim();
    if (!rawId) {
      setFinanceError('Please enter a Finance ID');
      return;
    }
    setFetchingFinance(true);
    setFinanceError(null);

    const structuredMatch = rawId.match(/^#?F[-_]\d{4}[-_](\d+)/i);
    let fetchId = rawId;
    if (structuredMatch && structuredMatch[1]) {
      fetchId = parseInt(structuredMatch[1], 10).toString();
    } else {
      const digitsOnly = rawId.replace(/\D/g, '');
      if (digitsOnly) {
        fetchId = parseInt(digitsOnly, 10).toString();
      }
    }

    try {
      const res: any = await authenticityUtility.get(
        `/finance-requests/${encodeURIComponent(fetchId)}`,
      );
      const record = res?.data || res;
      if (record && (record.id || record.proposal_ref)) {
        setFinanceData(record);
        setFinanceError(null);
      } else {
        setFinanceData(null);
        setFinanceError('No finance request found for the entered ID.');
      }
    } catch (err: any) {
      console.error('Error fetching finance data:', err);
      setFinanceData(null);
      setFinanceError(
        err?.response?.data?.message || err?.message || 'Failed to fetch finance request details.',
      );
    } finally {
      setFetchingFinance(false);
    }
  };

  const getFinanceIncomeRows = (record: any): any[] => {
    if (!record) return [];
    if (Array.isArray(record.income_rows)) return record.income_rows;
    if (Array.isArray(record.income)) return record.income;
    return [];
  };

  const getFinanceExpenditureRows = (record: any): any[] => {
    if (!record) return [];
    if (Array.isArray(record.budget)) return record.budget;
    if (Array.isArray(record.budget_breakup)) return record.budget_breakup;
    if (Array.isArray(record.budget_rows)) return record.budget_rows;
    return [];
  };

  const fetchEventWorkflowState = useCallback(() => {
    if (!eventId || eventId === 'new') return;
    authenticityUtility
      .get(`/events/${eventId}`)
      .then((res: any) => {
        const resData = res?.data || res;
        if (resData && resData.workflow_state) {
          setWorkflowState(resData.workflow_state);
        }
      })
      .catch(() => {});
  }, [eventId]);

  useEffect(() => {
    if (!eventId || eventId === 'new') return;

    authenticityUtility
      .get(`/events/${eventId}`)
      .then((res: any) => {
        const resData = res?.data || res;
        if (!resData || !resData.id) return;
        if (resData.workflow_state) {
          setWorkflowState(resData.workflow_state);
        }

        const parseJsonField = (field: any, defaultVal: any) => {
          if (!field) return defaultVal;
          if (typeof field === 'string') {
            try {
              return JSON.parse(field);
            } catch {
              return defaultVal;
            }
          }
          return field;
        };

        const reg = parseJsonField(resData.registration_settings, {});
        const acc = parseJsonField(resData.accommodation_settings, {});
        const themesArr = parseJsonField(resData.themes, []);
        const sdgsArr = parseJsonField(resData.sdgs, []);
        const coordsArr = parseJsonField(resData.coordinators, []);
        const feeRowsArr = parseJsonField(resData.feeRows || resData.fee_rows || reg.fee_rows, []);
        const collabArr = parseJsonField(resData.collaboration_data || reg.collaboration, []);
        const sponsorArr = parseJsonField(
          resData.sponsoringAgencies || reg.sponsoring_agencies,
          [],
        );

        if (Array.isArray(resData.subEvents) && resData.subEvents.length > 0) {
          setIsMultiEvent(true);
          setMultiEventsList(
            resData.subEvents.map((s: any) => ({
              id: String(s.id),
              name: s.title || s.name || s.event_title || '',
              type: s.event_type || s.eventType || s.category || '',
              createdBy: s.proposedBy || s.createdBy || currentUserDetails.name,
              creatorEmail: s.email || s.creatorEmail,
              creatorDepartment: s.department || s.creatorDepartment,
              creatorDesignation: s.designation || s.creatorDesignation,
            })),
          );
        }

        setFormData({
          name: resData.title || resData.name || '',
          category: resData.category || '',
          eventType: resData.event_type || resData.eventType || '',
          level: resData.level || '',
          expectedParticipants:
            resData.expected_participants !== undefined &&
            resData.expected_participants !== null &&
            resData.expected_participants !== ''
              ? String(resData.expected_participants)
              : resData.expectedParticipants !== undefined &&
                  resData.expectedParticipants !== null &&
                  resData.expectedParticipants !== ''
                ? String(resData.expectedParticipants)
                : reg.expected_participants !== undefined &&
                    reg.expected_participants !== null &&
                    reg.expected_participants !== ''
                  ? String(reg.expected_participants)
                  : reg.expectedParticipants !== undefined &&
                      reg.expectedParticipants !== null &&
                      reg.expectedParticipants !== ''
                    ? String(reg.expectedParticipants)
                    : reg.expected_count !== undefined &&
                        reg.expected_count !== null &&
                        reg.expected_count !== ''
                      ? String(reg.expected_count)
                      : resData.expected_count !== undefined &&
                          resData.expected_count !== null &&
                          resData.expected_count !== ''
                        ? String(resData.expected_count)
                        : '',
          themes: Array.isArray(themesArr) ? themesArr : [],
          sdgs: Array.isArray(sdgsArr) ? sdgsArr : [],
          dateFrom: resData.start_date ? String(resData.start_date).split('T')[0] : '',
          dateTo: resData.end_date ? String(resData.end_date).split('T')[0] : '',
          numberOfDays:
            resData.start_date && resData.end_date
              ? String(
                  Math.max(
                    1,
                    Math.floor(
                      (new Date(resData.end_date).getTime() -
                        new Date(resData.start_date).getTime()) /
                        86400000,
                    ) + 1,
                  ),
                )
              : '',
          mode: resData.mode || 'Physical',
          session: resData.session || 'FN',
          venue: resData.venue || reg.venue || '',
          meetingLink: resData.meeting_link || resData.meetingLink || '',
          eligibleParticipants: resData.eligible_participants
            ? typeof resData.eligible_participants === 'string'
              ? resData.eligible_participants
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : resData.eligible_participants
            : reg.eligibleParticipants || [],
          openTo: resData.open_to || reg.openTo || 'Any',
          genderRestriction: resData.gender_restriction || reg.genderRestriction || 'Any',
          minAge: resData.min_age ? String(resData.min_age) : reg.minAge ? String(reg.minAge) : '',
          maxAge: resData.max_age ? String(resData.max_age) : reg.maxAge ? String(reg.maxAge) : '',
          eventFlyerName: resData.eventFlyerName || '',
          isMultiEventEnabled: Boolean(resData.is_multi_event || resData.isMultiEvent),
          registrationSettingsEnabled: Boolean(resData.reg_enabled ?? reg.enabled ?? true),
          registrationStatus: resData.reg_status || reg.registrationStatus || 'Ongoing',
          lastDate: resData.last_date
            ? String(resData.last_date).split('T')[0]
            : reg.lastDate
              ? String(reg.lastDate).split('T')[0]
              : '',
          extension: Boolean(resData.extension_enabled ?? reg.extension),
          extendedDate: resData.extended_date
            ? String(resData.extended_date).split('T')[0]
            : reg.extendedDate
              ? String(reg.extendedDate).split('T')[0]
              : '',
          shortlistingRequired: Boolean(resData.shortlisting_required ?? reg.shortlistingRequired),
          selectionIntimation: resData.selection_intimation || reg.selectionIntimation || '',
          teamEnabled: Boolean(resData.team_enabled ?? reg.teamEnabled),
          minTeamSize: resData.min_team_size
            ? String(resData.min_team_size)
            : reg.minTeamSize
              ? String(reg.minTeamSize)
              : '',
          maxTeamSize: resData.max_team_size
            ? String(resData.max_team_size)
            : reg.maxTeamSize
              ? String(reg.maxTeamSize)
              : '',
          documentEnabled: Boolean(resData.document_enabled ?? reg.documentEnabled),
          documentName: resData.document_name || reg.documentName || '',
          documentType: resData.document_type || reg.documentType || '',
          documentSize: resData.document_size || reg.documentSize || '',
          documentTextFieldEnabled: Boolean(
            resData.document_text_field_enabled ?? reg.documentTextFieldEnabled,
          ),
          feedbackEnabled: Boolean(resData.feedback_enabled ?? resData.feedbackEnabled ?? true),
          certificateEnabled: Boolean(
            resData.certificate_enabled ?? resData.certificateEnabled ?? true,
          ),
          registrationFeeEnabled: Boolean(
            resData.registration_fee_enabled ??
            (Array.isArray(feeRowsArr) && feeRowsArr.length > 0),
          ),
          feeRows:
            Array.isArray(feeRowsArr) && feeRowsArr.length > 0 ? feeRowsArr : [createFeeRow()],
          collaborators:
            Array.isArray(collabArr) && collabArr.length > 0
              ? collabArr.map((c: any) => ({
                  id: makeId(),
                  type: c.type || '',
                  name: c.name || '',
                }))
              : [createCollaborator()],
          sponsoringAgencies:
            Array.isArray(sponsorArr) && sponsorArr.length > 0
              ? sponsorArr
              : [createCollaborator()],
          coordinators:
            Array.isArray(coordsArr) && coordsArr.length > 0 ? coordsArr : [createCoordinator()],
          accommodationEnabled: Boolean(
            acc.enabled ?? resData.accommodation_enabled ?? resData.accommodationEnabled,
          ),
          accommodationType: acc.type || resData.accommodation_type || 'Free',
          gentsAccommodationLimit: acc.gentsLimit ? String(acc.gentsLimit) : '',
          ladiesAccommodationLimit: acc.ladiesLimit ? String(acc.ladiesLimit) : '',
          ceremonyEnabled: Boolean(resData.inaugural_enabled || resData.valedictory_enabled),
          inauguralEnabled: Boolean(resData.inaugural_enabled),
          inauguralDate: resData.inaugural_date ? String(resData.inaugural_date).split('T')[0] : '',
          inauguralTime: resData.inaugural_time || '',
          inauguralVenue: resData.inaugural_venue || '',
          valedictoryEnabled: Boolean(resData.valedictory_enabled),
          valedictoryDate: resData.valedictory_date
            ? String(resData.valedictory_date).split('T')[0]
            : '',
          valedictoryTime: resData.valedictory_time || '',
          valedictoryVenue: resData.valedictory_venue || '',
          sponsoringAgencyEnabled: Array.isArray(sponsorArr) && sponsorArr.length > 0,
          hostCollaborator:
            resData.host_collaborator ||
            resData.hostCollaborator ||
            reg.host_collaborator ||
            reg.hostCollaborator ||
            resData.department ||
            reg.department ||
            '',
        });
      })
      .catch((err) => {
        console.error('Failed to load event for edit:', err);
      });
  }, [eventId, currentUserDetails]);
  const [additionalEvents, setAdditionalEvents] = useState(0);
  const [isMultiEvent, setIsMultiEvent] = useState(false);
  const [multiEventsList, setMultiEventsList] = useState<
    {
      id: string;
      name: string;
      type: string;
      createdBy?: string;
      creatorEmail?: string;
      creatorDepartment?: string;
      creatorDesignation?: string;
      creatorEmployeeId?: string | number;
    }[]
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
    creatorEmail?: string;
    creatorDepartment?: string;
    creatorDesignation?: string;
  } | null>(null);

  const handleAddSubEventRow = () => {
    setMultiEventsList((prev) => [
      ...prev,
      {
        id: makeId(),
        name: '',
        type: '',
        createdBy: currentUserDetails.name,
        creatorEmail: currentUserDetails.email,
        creatorDepartment: currentUserDetails.department,
        creatorDesignation: currentUserDetails.designation,
        creatorEmployeeId: currentUserDetails.employee_id,
      },
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
    updateRow<CoordinatorRow>(
      'coordinators',
      rowId,
      'institution',
      emp.entity || 'K.S.Rangasamy College of Technology',
    );

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
    <CustomEventSelect
      className={getSelectClassName(String(formData[field] || ''))}
      value={String(formData[field] || '')}
      onChange={(event) => setField(field, event.target.value)}
      disabled={disabled}
      placeholder={placeholder || 'Select'}
      options={['', ...selectOptions]}
    />
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
          <fieldset disabled={readOnly} style={{ border: 'none', margin: 0, padding: 0 }}>
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
            <div className="event-approval-grid two">
              <label>Category{select('category', options.categories)}</label>
              <label>Type{select('eventType', options.types)}</label>
            </div>
            <div className="event-approval-grid three" style={{ marginTop: '10px' }}>
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
              <label>
                Mode
                {select('mode', options.mode)}
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
          </fieldset>
        )}
      </section>

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
                    {
                      id: makeId(),
                      name: '',
                      type: '',
                      createdBy: currentUserDetails.name,
                      creatorEmail: currentUserDetails.email,
                      creatorDepartment: currentUserDetails.department,
                      creatorDesignation: currentUserDetails.designation,
                      creatorEmployeeId: currentUserDetails.employee_id,
                    },
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
                      <th style={{ textAlign: 'center', width: '80px' }}>View</th>
                      <th style={{ textAlign: 'center', width: '80px' }}>Edit</th>
                      <th style={{ textAlign: 'center', width: '80px' }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiEventsList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: 'center',
                            color: '#64748b',
                            padding: '20px',
                            fontWeight: 600,
                          }}
                        >
                          No Sub Events Found
                        </td>
                      </tr>
                    ) : (
                      multiEventsList.map((row) => (
                        <tr key={row.id}>
                          {editingSubEventId === row.id ? (
                            <>
                              <td>
                                <CustomEventSelect
                                  className="tableSelect"
                                  value={editSubEventData.type}
                                  onChange={(e) =>
                                    setEditSubEventData((prev) => ({
                                      ...prev,
                                      type: e.target.value,
                                    }))
                                  }
                                  placeholder="Select Type"
                                  options={['', ...options.types]}
                                />
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
                              <td>{row.createdBy || currentUserDetails.name}</td>
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
                                <span style={{ fontWeight: 600, color: '#0284c7' }}>
                                  {row.type || 'N/A'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                  {row.name || 'Untitled Sub Event'}
                                </span>
                              </td>
                              <td>{row.createdBy || currentUserDetails.name}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  title="View sub-event details"
                                  onClick={() => {
                                    if (row.id && !isNaN(Number(row.id))) {
                                      navigate(
                                        `/event/${row.id}?isSubEvent=true&parentId=${eventId}&tab=pre-event`,
                                      );
                                    } else {
                                      setViewingSubEvent({
                                        id: row.id,
                                        name: row.name,
                                        type: row.type,
                                        createdBy: row.createdBy || currentUserDetails.name,
                                        creatorEmail: row.creatorEmail || currentUserDetails.email,
                                        creatorDepartment:
                                          row.creatorDepartment || currentUserDetails.department,
                                        creatorDesignation:
                                          row.creatorDesignation || currentUserDetails.designation,
                                      });
                                    }
                                  }}
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
                                    if (row.id && !isNaN(Number(row.id))) {
                                      navigate(
                                        `/event/${row.id}?isSubEvent=true&parentId=${eventId}&tab=pre-event`,
                                      );
                                    } else {
                                      setEditingSubEventId(row.id);
                                      setEditSubEventData({ name: row.name, type: row.type });
                                    }
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
                                    color: '#ef4444',
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
            </div>
          )}
        </section>
      )}

      {eventExpanded && (
        <fieldset disabled={readOnly} style={{ border: 'none', margin: 0, padding: 0 }}>
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
                      onChange={(values) => {
                        setField('eligibleParticipants', values);
                        const currentFeeRows = formData.feeRows || [];
                        const newFeeRows = values.map((participant) => {
                          const existingRow = currentFeeRows.find(
                            (r) => r.participantCategory === participant,
                          );
                          return (
                            existingRow || {
                              id: Math.random().toString(36).substring(7),
                              participantCategory: participant,
                              individual: '',
                              team: '',
                              members: '',
                              additionalMember: '',
                            }
                          );
                        });
                        setField(
                          'feeRows',
                          (newFeeRows.length > 0
                            ? newFeeRows
                            : [
                                {
                                  id: Math.random().toString(36).substring(7),
                                  participantCategory: '',
                                  individual: '',
                                  team: '',
                                  members: '',
                                  additionalMember: '',
                                },
                              ]) as any,
                        );
                      }}
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
                <div className="event-registration-settings-card">
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
                          <span>Min</span>
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
                          <span>Max</span>
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
                        value={formData.registrationStatus || 'Ongoing'}
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
                </div>
                {!isMultiEvent && (
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
                )}
                {!isMultiEvent && (
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
                )}
              </>
            )}
          </section>

          {!isMultiEvent && (
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
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={2}>Participant Category</th>
                        <th colSpan={4}>Registration Fees</th>
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
                            <CustomEventSelect
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
                              placeholder="Select"
                              options={['', ...options.participantCategory]}
                            />
                          </td>
                          <td>
                            <input
                              className="tableInput"
                              placeholder="Amount"
                              disabled={!formData.registrationFeeEnabled || formData.teamEnabled}
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
                              disabled={!formData.registrationFeeEnabled || !formData.teamEnabled}
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
                              disabled={!formData.registrationFeeEnabled || !formData.teamEnabled}
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
                              disabled={!formData.registrationFeeEnabled || !formData.teamEnabled}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

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
                <CustomEventSelect
                  className={getSelectClassName(row.type)}
                  value={row.type}
                  onChange={(event) =>
                    updateRow<CollaboratorRow>('collaborators', row.id, 'type', event.target.value)
                  }
                  placeholder="Select"
                  options={['', ...options.collaboratorType]}
                />
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
                  <CustomEventSelect
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
                    placeholder="Select"
                    options={['', ...options.collaboratorType]}
                  />
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
            <section className="event-approval-card form-card" style={{ marginTop: '24px' }}>
              <div className="event-approval-section-heading with-toggle">
                <span>Finance</span>
                <Switch checked={financeEnabled} onChange={(value) => setFinanceEnabled(value)} />
              </div>
              {financeEnabled && (
                <div style={{ padding: '16px 0 8px 0' }}>
                  <div
                    style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <label
                      style={{
                        fontWeight: 600,
                        color: '#334155',
                        whiteSpace: 'nowrap',
                        marginBottom: 0,
                        fontSize: '0.925rem',
                      }}
                    >
                      Enter Finance Application ID :
                    </label>
                    <div style={{ width: '220px' }}>
                      <CustomInput
                        name="financeSearchId"
                        value={financeSearchId}
                        onChange={(val) => setFinanceSearchId(val)}
                        placeholder=""
                        className="mb-0"
                        onKeyDown={(e: any) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleFetchFinance();
                          }
                        }}
                      />
                    </div>
                    <CustomButton
                      onClick={() => void handleFetchFinance()}
                      loading={fetchingFinance}
                      style={{
                        backgroundColor: '#005492',
                        borderColor: '#005492',
                        color: '#ffffff',
                        padding: '0.5rem 1.4rem',
                        borderRadius: '8px',
                        fontWeight: 600,
                        height: '38px',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      Fetch
                    </CustomButton>
                  </div>

                  {financeError && (
                    <div
                      style={{
                        marginTop: '12px',
                        color: '#ef4444',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      ⚠️ {financeError}
                    </div>
                  )}

                  {financeData && (
                    <div
                      style={{
                        marginTop: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                      }}
                    >
                      {/* Finance Summary Header Badge */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px',
                          padding: '10px 14px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: '#1b3bbb',
                            color: '#ffffff',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '0.825rem',
                            fontWeight: 700,
                          }}
                        >
                          {(() => {
                            const rawRef =
                              financeData.proposal_ref ||
                              financeData.requestRef ||
                              `FIN-${financeData.id}`;
                            const cleanRef = String(rawRef).trim().replace(/^#+/, '');
                            return `#${cleanRef}`;
                          })()}
                        </span>
                        <span style={{ fontSize: '0.925rem', fontWeight: 700, color: '#1e293b' }}>
                          {financeData.applicant_name || financeData.proposedBy || 'Applicant'}
                        </span>
                        {(financeData.department_name || financeData.department) && (
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            ({financeData.department_name || financeData.department})
                          </span>
                        )}
                      </div>

                      {/* Combined Side-by-Side Income & Expenditure Table */}
                      {(() => {
                        const incomeList = getFinanceIncomeRows(financeData);
                        const expenditureList = getFinanceExpenditureRows(financeData);
                        const maxRows = Math.max(incomeList.length, expenditureList.length, 1);

                        const totalIncome = incomeList.reduce(
                          (sum: number, r: any) =>
                            sum + Number(r.amount || r.income || r.contribution || 0),
                          0,
                        );
                        const totalExpenditure = expenditureList.reduce(
                          (sum: number, r: any) => sum + Number(r.amount || r.total_amount || 0),
                          0,
                        );
                        const surplusDeficit = totalIncome - totalExpenditure;

                        return (
                          <div className="event-approval-table-wrap">
                            <table
                              className="budgetEntryTable"
                              style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                overflow: 'hidden',
                              }}
                            >
                              <thead>
                                <tr
                                  style={{
                                    backgroundColor: '#ebf3fa',
                                    color: '#005492',
                                    fontWeight: 700,
                                  }}
                                >
                                  <th
                                    style={{
                                      width: '60px',
                                      textAlign: 'center',
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 8px',
                                      color: '#005492',
                                    }}
                                  >
                                    Sl. No.
                                  </th>
                                  <th
                                    style={{
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: '#005492',
                                    }}
                                  >
                                    Income (Receipts)
                                  </th>
                                  <th
                                    style={{
                                      width: '130px',
                                      textAlign: 'right',
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: '#005492',
                                    }}
                                  >
                                    Amount (₹)
                                  </th>
                                  <th
                                    style={{
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: '#005492',
                                    }}
                                  >
                                    Expenditure (Payments)
                                  </th>
                                  <th
                                    style={{
                                      width: '130px',
                                      textAlign: 'right',
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: '#005492',
                                    }}
                                  >
                                    Amount (₹)
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: maxRows }).map((_, idx) => {
                                  const inc = incomeList[idx];
                                  const exp = expenditureList[idx];

                                  const incName = inc
                                    ? inc.income_source ||
                                      inc.incomeHead ||
                                      inc.source ||
                                      inc.category ||
                                      ''
                                    : '';
                                  const incAmount = inc
                                    ? Number(inc.amount || inc.income || inc.contribution || 0)
                                    : null;

                                  const expName = exp
                                    ? exp.budget_head ||
                                      exp.budget_head_name ||
                                      exp.category ||
                                      exp.head ||
                                      exp.sub_head ||
                                      exp.particulars ||
                                      ''
                                    : '';
                                  const expAmount = exp
                                    ? Number(exp.amount || exp.total_amount || 0)
                                    : null;

                                  return (
                                    <tr key={idx}>
                                      <td
                                        style={{
                                          textAlign: 'center',
                                          border: '1px solid #cbd5e1',
                                          padding: '10px 8px',
                                          color: '#475569',
                                        }}
                                      >
                                        {idx + 1}.
                                      </td>
                                      <td
                                        style={{
                                          border: '1px solid #cbd5e1',
                                          padding: '10px 12px',
                                          color: '#334155',
                                        }}
                                      >
                                        {incName}
                                      </td>
                                      <td
                                        style={{
                                          textAlign: 'right',
                                          border: '1px solid #cbd5e1',
                                          padding: '10px 12px',
                                          fontWeight: 700,
                                          color: '#1e293b',
                                        }}
                                      >
                                        {incAmount !== null
                                          ? `₹${incAmount.toLocaleString('en-IN')}`
                                          : ''}
                                      </td>
                                      <td
                                        style={{
                                          border: '1px solid #cbd5e1',
                                          padding: '10px 12px',
                                          color: '#334155',
                                        }}
                                      >
                                        {expName}
                                      </td>
                                      <td
                                        style={{
                                          textAlign: 'right',
                                          border: '1px solid #cbd5e1',
                                          padding: '10px 12px',
                                          fontWeight: 700,
                                          color: '#1e293b',
                                        }}
                                      >
                                        {expAmount !== null
                                          ? `₹${expAmount.toLocaleString('en-IN')}`
                                          : ''}
                                      </td>
                                    </tr>
                                  );
                                })}

                                {/* Total Income & Total Expenditure Row */}
                                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                                  <td
                                    colSpan={2}
                                    style={{
                                      textAlign: 'right',
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: '#1e293b',
                                    }}
                                  >
                                    Total Income (₹)
                                  </td>
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: '#16a34a',
                                      fontWeight: 700,
                                    }}
                                  >
                                    ₹{totalIncome.toLocaleString('en-IN')}
                                  </td>
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: '#1e293b',
                                    }}
                                  >
                                    Total Expenditure (₹)
                                  </td>
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: '#dc2626',
                                      fontWeight: 700,
                                    }}
                                  >
                                    ₹{totalExpenditure.toLocaleString('en-IN')}
                                  </td>
                                </tr>

                                {/* Surplus / Deficit Row */}
                                <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                                  <td
                                    colSpan={2}
                                    style={{
                                      textAlign: 'right',
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: '#1e293b',
                                    }}
                                  >
                                    Surplus / Deficit (₹)
                                  </td>
                                  <td
                                    colSpan={3}
                                    style={{
                                      textAlign: 'left',
                                      border: '1px solid #cbd5e1',
                                      padding: '10px 12px',
                                      color: surplusDeficit >= 0 ? '#16a34a' : '#dc2626',
                                      fontWeight: 700,
                                    }}
                                  >
                                    ₹{Math.abs(surplusDeficit).toLocaleString('en-IN')}{' '}
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                      ({surplusDeficit >= 0 ? 'Surplus' : 'Deficit'})
                                    </span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </fieldset>
      )}

      {showFooter && eventExpanded && !readOnly && (
        <div className="event-approval-footer finance-submit-buttons">
          <button type="button" onClick={handleSubmit} disabled={submitting}>
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
              {viewingSubEvent.creatorDepartment && (
                <span
                  style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}
                >
                  Department: {viewingSubEvent.creatorDepartment}
                </span>
              )}
              {viewingSubEvent.creatorDesignation && (
                <span
                  style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}
                >
                  Designation: {viewingSubEvent.creatorDesignation}
                </span>
              )}
              {viewingSubEvent.creatorEmail && (
                <span
                  style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}
                >
                  Email: {viewingSubEvent.creatorEmail}
                </span>
              )}
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
  workflowState?: any;
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

interface DashboardProps {
  hideAddButton?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ hideAddButton = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldHideAdd = hideAddButton || location.pathname.includes('/admin/event-approval');
  const { user } = useAuth();
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
        setEvents([]);
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
    return `${weekday} ${day}/${month}/${year}`;
  })();

  const eventCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((ev) => {
      const d = new Date(ev.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [events]);

  const openEventTab = (eventId: number, tab: string, readOnly: boolean = false): void => {
    if (!eventId) return;
    const url = `/event/${eventId}?tab=${tab}${readOnly ? '&mode=view' : ''}`;
    navigate(url);
  };

  const handleDelete = (event: EventData): void => {
    if (!event || !event.id) return;
    const normalizedStatus = normalizeStatus(event.status);
    if (!canDeleteEvents && normalizedStatus !== 'draft' && normalizedStatus !== 'return') return;

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

  const handleGenerateReport = async (event: any) => {
    try {
      let fullData = event;
      try {
        const res = (await authenticityUtility.get(`/events/${event.id}`)) as any;
        if (res && (res.event || res.data || res.id)) {
          fullData = res.event || res.data || res;
        }
      } catch (err) {
        console.warn('Using card event data for report generation', err);
      }
      generateAndOpenReportInNewTab({
        eventId: String(event.id),
        summary: event,
        fullEventData: fullData,
        rows: fullData?.resource_persons || [],
        participants: fullData?.participants || [],
        description: fullData?.description || event.description || '',
        outcomes: fullData?.outcome || fullData?.actual_outcome || event.outcome || '',
        reportCards: [],
        docState: {},
      });
    } catch (e) {
      console.error('Error generating report:', e);
      generateAndOpenReportInNewTab({
        eventId: String(event.id),
        summary: event,
        fullEventData: event,
        rows: [],
        participants: [],
        description: event.description || '',
        outcomes: event.outcome || '',
        reportCards: [],
        docState: {},
      });
    }
  };

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

            <button
              type="button"
              className="event-dashboard-bell-btn"
              onClick={openBellPreview}
              aria-label="Open event calendar preview"
              title="Open event calendar preview"
            >
              <Bell size={18} />
            </button>

            {!shouldHideAdd && (
              <button
                type="button"
                className="event-dashboard-add-btn"
                onClick={() => setShowEventTypeModal(true)}
                title="Select Event Type"
              >
                Add +
              </button>
            )}
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
              const normalizedStatus = normalizeStatus(event.status);
              const hideDelete = normalizedStatus === 'reject';
              const isClickableStatus =
                normalizedStatus === 'pending' ||
                normalizedStatus === 'approved' ||
                normalizedStatus === 'reject';
              const eventIdentity = getEventIdentity(event);
              const showSteps = isClickableStatus && activePendingId === eventIdentity;
              const catTheme = getCategoryCardTheme(event.category);
              const isSub = Boolean(
                (event as any).isSubEvent ||
                (event as any).is_sub_event ||
                (event as any).parent_event_id ||
                (event as any).parentEventId,
              );
              const eventYear = new Date(event.date || new Date()).getFullYear();
              const eventCode = `#EV-${eventYear}-${String(event.id).padStart(4, '0')}`;

              return (
                <article
                  key={eventIdentity}
                  className="event-request-card"
                  onClick={() => openEventTab(event.id, 'pre-event')}
                  style={{
                    borderLeft: `4px solid ${catTheme.pillBg || '#0a7ac2'}`,
                  }}
                >
                  {/* Top Row: #EV-Code + Proposer Name + Category Badge (Left) | Date + Mini Action Buttons (Right) */}
                  <div className="event-request-row event-request-row--top">
                    <div className="event-request-head-left">
                      <span className="event-request-id">{eventCode}</span>
                      {event.proposedBy && (
                        <span className="event-request-name">{event.proposedBy}</span>
                      )}
                      <span
                        className="event-request-type-badge"
                        style={{
                          backgroundColor: catTheme.subBg,
                          color: catTheme.subText,
                          borderColor: catTheme.subBorder,
                        }}
                      >
                        {event.category || 'Event'}
                      </span>
                    </div>

                    <div className="event-request-head-right">
                      <div className="event-request-amount">
                        <span>Date</span>
                        <strong>{formatEventDisplayDate(event.date)}</strong>
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
                          <Info size={14} />
                        </button>
                        <button
                          type="button"
                          className="event-request-mini-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEventTab(event.id, 'pre-event', true);
                          }}
                          aria-label="View"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
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
                          <Edit2 size={14} />
                        </button>
                        {(canDeleteEvents ||
                          normalizedStatus === 'draft' ||
                          normalizedStatus === 'return') &&
                          !hideDelete && (
                            <button
                              type="button"
                              className="event-request-mini-btn is-danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(event);
                              }}
                              aria-label="Delete"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Event Title + Main Event Badge (Left) | Doc Button + Status Pill / 3-Dot Stepper (Right) */}
                  <div className="event-request-row event-request-row--bottom">
                    <div className="event-request-bottom-left">
                      <span className="event-request-beneficiary-value">{event.name}</span>
                      <span
                        className={`event-request-type-badge event-request-type-badge--sub ${
                          isSub
                            ? 'event-request-type-badge--sub-event'
                            : 'event-request-type-badge--main'
                        }`}
                      >
                        {isSub ? 'Sub Event' : 'Main Event'}
                      </span>
                    </div>

                    <div className="event-request-actions">
                      <button
                        type="button"
                        className="event-request-doc-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateReport(event);
                        }}
                        aria-label="Generate Event Report"
                        title="Generate Event Report"
                      >
                        <ClipboardList size={15} />
                      </button>

                      {showSteps ? (
                        <button
                          type="button"
                          className="event-request-progress-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePendingId(null);
                          }}
                          aria-label="Approval steps active. Click to view status name."
                          title="Click to view status name"
                        >
                          <span
                            className="event-request-progress-step is-active"
                            aria-hidden="true"
                          />
                          <span className="event-request-progress-line" aria-hidden="true" />
                          <span
                            className={`event-request-progress-step ${
                              normalizedStatus === 'approved' || normalizedStatus === 'pending'
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
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`event-request-status event-request-status--${normalizedStatus}${
                            isClickableStatus ? ' is-clickable' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isClickableStatus) return;
                            setActivePendingId(eventIdentity);
                          }}
                          aria-pressed={false}
                          disabled={!isClickableStatus}
                          title="Click to view approval steps"
                        >
                          {getEventWorkflowStageLabel(event.workflowState || event.status)}
                        </button>
                      )}
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
          size="xl"
          fullscreen={true}
          hideHeader={true}
          hideCloseButton={true}
        >
          <div style={{ padding: '24px', background: '#ebf2f8' }}>
            <div className="event-bell-panel">
              {/* Left Column: Selected Day Details */}
              <div className="event-bell-left">
                <div className="event-bell-left-top">
                  <div>
                    <h2 className="event-bell-left-title">{bellTitle}</h2>
                    <p className="event-bell-left-count">
                      <i>
                        {selectedBellEvents.length} room booking request
                        {selectedBellEvents.length !== 1 ? 's' : ''} for this day
                      </i>
                    </p>
                  </div>
                  {!shouldHideAdd && (
                    <button
                      type="button"
                      className="event-bell-add-btn"
                      onClick={() => {
                        setShowBellPreview(false);
                        setShowEventTypeModal(true);
                      }}
                    >
                      Add +
                    </button>
                  )}
                </div>

                {selectedBellEvents.length === 0 ? (
                  <p className="event-bell-left-empty">No event booking requests for this day.</p>
                ) : (
                  <div className="event-bell-card-list">
                    {selectedBellEvents.map((event) => {
                      const code = (event as any).event_code || `#GH-${event.id}`;
                      const rawDate = (event as any).start_date || (event as any).date;
                      const sDateStr = rawDate
                        ? new Date(rawDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '24 Sept 2026';
                      const rawEDate = (event as any).end_date;
                      const eDateStr = rawEDate
                        ? new Date(rawEDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : sDateStr;
                      const dateRangeStr =
                        sDateStr === eDateStr ? sDateStr : `${sDateStr} – ${eDateStr}`;
                      const statusLabel = (event as any).status || 'Room not allocated';
                      const organizer =
                        (event as any).coordinator ||
                        (event as any).organizer ||
                        event.name ||
                        'Dr Niranjana S';
                      const venue = (event as any).venue || 'Arjun';

                      return (
                        <div
                          key={getEventIdentity(event)}
                          className="event-bell-card-item"
                          onClick={() => openEventTab(event.id, 'pre-event')}
                        >
                          {/* Card Top Row */}
                          <div className="event-bell-card-row-top">
                            <div className="event-bell-card-tag">
                              <Building size={14} style={{ color: '#475569' }} />
                              <span>{code.startsWith('#') ? code : `#${code}`}</span>
                            </div>
                            <div className="event-bell-card-time">
                              <Clock size={13} style={{ color: '#64748b' }} />
                              <span>{dateRangeStr}</span>
                            </div>
                            <span className="event-bell-card-status-badge">{statusLabel}</span>
                          </div>

                          {/* Card Bottom Row */}
                          <div className="event-bell-card-row-bottom">
                            <div className="event-bell-card-user">
                              <Briefcase size={15} style={{ color: '#005492' }} />
                              <span>{organizer}</span>
                            </div>
                            <div className="event-bell-card-venue">
                              <MapPin size={14} style={{ color: '#005492' }} />
                              <span>{venue}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Month Calendar */}
              <div className="event-bell-right">
                <h3 className="event-bell-calendar-title">Calendar</h3>

                <div className="event-bell-calendar-controls">
                  <button type="button" className="event-bell-today-btn" onClick={goToBellToday}>
                    Today
                  </button>
                  <div className="event-bell-nav-group">
                    <button
                      type="button"
                      className="event-bell-nav-btn"
                      aria-label="Previous month"
                      onClick={goToBellPrevMonth}
                    >
                      ‹
                    </button>
                    <span className="event-bell-month-label">
                      {currentBellMonthLabel} {bellViewYear}
                    </span>
                    <button
                      type="button"
                      className="event-bell-nav-btn"
                      aria-label="Next month"
                      onClick={goToBellNextMonth}
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="event-bell-calendar-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="event-bell-day-head">
                      {day}
                    </div>
                  ))}

                  {bellCalendar.map((day, index) => {
                    const dateKey = `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`;
                    const count = eventCountByDate[dateKey] || 0;
                    return (
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
                        tabIndex={day.muted ? -1 : 0}
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
                        {count > 0 && !day.muted && (
                          <span className="event-bell-day-badge">{count}</span>
                        )}
                      </button>
                    );
                  })}
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
              Delete
            </button>
          </div>
        }
      >
        <p className="mb-0 fw-medium" style={{ fontSize: '0.95rem' }}>
          {(() => {
            const isMainEvent = eventToDelete && eventToDelete.parent_id == null;
            const subEventsCount = eventToDelete
              ? events.filter((event) => event.parent_id === eventToDelete.id).length
              : 0;
            const hasSubEvents = isMainEvent && subEventsCount > 0;

            if (hasSubEvents) {
              return (
                <>
                  This Main Event contains {subEventsCount} Sub-Event
                  {subEventsCount !== 1 ? 's' : ''}. Deleting it will also delete all associated
                  Sub-Events and their data.
                  {deleteCountdown > 0 && (
                    <span aria-live="polite" className="d-block mt-3 text-danger fw-bold">
                      Countdown: {deleteCountdown}
                    </span>
                  )}
                </>
              );
            }
            return <>Please confirm if you wish to proceed.</>;
          })()}
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
    parentId?: string;
    summary?: EventSummary | null;
    readOnly?: boolean;
  }>;
}

const EventPage: React.FC = () => {
  const { eventId: paramEventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  const eventId = paramEventId || (location.pathname.includes('/new') ? 'new' : undefined);
  const [activeTab, setActiveTab] = useState('pre-event');
  const [summary, setSummary] = useState<EventSummary | null>(null);

  const isSubEvent = new URLSearchParams(location.search).get('isSubEvent') === 'true';
  const parentId = new URLSearchParams(location.search).get('parentId') || undefined;
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const isReadOnly = new URLSearchParams(location.search).get('mode') === 'view';

  const isFullyApproved = useMemo(() => {
    if (!summary) return false;
    const rawStatus =
      summary.status ||
      (summary as any).workflow_status ||
      (summary as any).workflowState?.status ||
      (summary as any).workflow_state?.status ||
      '';
    const statusStr = String(rawStatus).trim().toLowerCase();
    return (
      statusStr === 'approved' ||
      statusStr === 'completed' ||
      statusStr === 'published' ||
      Boolean((summary as any).approved) ||
      Boolean((summary as any).isApproved)
    );
  }, [summary]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTabParam = params.get('tab');

    let allowedTabs = new Set(['pre-event', 'updates', 'participants', 'feedback', 'certificate']);

    if (!isFullyApproved) {
      allowedTabs = new Set(['pre-event']);
    } else if (isSubEvent) {
      allowedTabs = new Set(SUB_EVENT_TAB_IDS);
    }

    if (requestedTabParam && allowedTabs.has(requestedTabParam)) {
      setActiveTab(requestedTabParam);
      return;
    }

    setActiveTab('pre-event');
  }, [location.search, isSubEvent, isFullyApproved]);

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
        parentId={parentId}
        summary={summary}
        readOnly={isReadOnly}
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
            .filter((tab) => {
              if (!isFullyApproved && tab.id !== 'pre-event') {
                return false;
              }
              if (
                isSubEvent &&
                !SUB_EVENT_TAB_IDS.includes(tab.id as (typeof SUB_EVENT_TAB_IDS)[number])
              ) {
                return false;
              }
              if (tab.id === 'feedback' && summary && summary.feedbackEnabled === false) {
                return false;
              }
              if (tab.id === 'certificate' && summary && summary.certificateEnabled === false) {
                return false;
              }
              return true;
            })
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
  file: any;
  mailSent?: boolean;
}

interface LettersPageProps {
  formData: Record<string, LetterSectionData>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, LetterSectionData>>>;
  handlePreviewMail: (section: string) => void;
  handleSendMail: (section: string) => void;
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

const LettersPage: React.FC<LettersPageProps> = ({
  formData,
  setFormData,
  handlePreviewMail,
  handleSendMail,
}) => {
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

  return (
    <div className="event-card-section event-form-section event-updates-panel event-letters-card">
      <h2 className="event-section-title">Letters</h2>
      {sections.map((section) => (
        <div key={section} className="event-row-section event-letter-row">
          <span className="event-letter-label">{section}</span>
          <div className="event-letter-actions">
            <div className="event-letter-buttons">
              <button
                type="button"
                className="event-letter-preview-btn"
                onClick={() => handlePreviewMail(section)}
              >
                {EVENT_COPY.preview}
              </button>
              <button
                type="button"
                className="event-letter-send-btn"
                onClick={() => handleSendMail(section)}
              >
                {EVENT_COPY.sendMail}
              </button>
              <span
                className="event-letter-status"
                style={{ color: formData[section]?.mailSent ? '#059669' : '#64748b' }}
              >
                <Info size={16} /> {formData[section]?.mailSent ? 'Sent' : EVENT_COPY.notSent}
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

const CustomStatusDropdown: React.FC<{ value: string; onChange: (val: string) => void }> = ({
  value,
  onChange,
}) => {
  const options = [
    { label: 'Pending', value: 'Pending' },
    { label: 'Shortlisted', value: 'Shortlisted' },
    { label: 'Selected', value: 'Selected' },
    { label: 'Not Selected', value: 'Not Selected' },
  ];

  const normalizedValue =
    value === 'Registered' ? 'Pending' : value === 'Rejected' ? 'Not Selected' : value || '';

  return (
    <CustomEventSelect
      className="status-native-select"
      value={normalizedValue}
      onChange={(e) => onChange(e.target.value)}
      options={options}
    />
  );
};

interface ParticipantsCardProps {
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
}

const ParticipantsCard: React.FC<ParticipantsCardProps> = ({ participants, setParticipants }) => {
  const total = participants.reduce((sum, participant) => sum + participant.count, 0);

  const handleDelete = (index: number): void => {
    setParticipants((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div className="event-card-section event-participants-card">
      <div className="participants-header">
        <div className="participants-header-copy">
          <h2 className="event-section-title">Participants</h2>
        </div>
        <div className="participants-total-badge">
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      </div>

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
              {participants.length > 0 ? (
                participants.map((participant, index) => (
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
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Delete Participant"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    style={{ textAlign: 'center', color: '#64748b', padding: '16px' }}
                  >
                    No participants added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface DocumentsCardProps {
  docState: Record<string, DocumentRowState>;
  setany: React.Dispatch<React.SetStateAction<Record<string, DocumentRowState>>>;
  eventId?: string;
  summary?: any;
  fullEventData?: any;
  rows?: ResourcePersonRow[];
  participants?: ParticipantRow[];
}

interface ReportCardItem {
  id: number;
  type: 'resource' | 'activity';
  resource: string;
  activity: string;
  date: string;
  time: string;
  title: string;
  description: string;
  photos: (File | null)[];
}

const createEmptyReportCard = (
  type: 'resource' | 'activity' = 'resource',
  initialTitle: string = '',
): ReportCardItem => ({
  id: Date.now() + Math.random(),
  type,
  resource: '',
  activity: '',
  date: '',
  time: '',
  title: initialTitle,
  description: '',
  photos: [null, null],
});

interface EventReportModalProps {
  open: boolean;
  onClose: () => void;
  eventId?: string;
  summary?: any;
  fullEventData?: any;
  rows?: ResourcePersonRow[];
  participants?: ParticipantRow[];
  description: string;
  outcomes: string;
  reportCards: ReportCardItem[];
  docState: Record<string, DocumentRowState>;
}

function generateAndOpenReportInNewTab(props: {
  eventId?: string;
  summary?: any;
  fullEventData?: any;
  rows?: ResourcePersonRow[];
  participants?: ParticipantRow[];
  description: string;
  outcomes: string;
  reportCards: ReportCardItem[];
  docState: Record<string, DocumentRowState>;
}) {
  const {
    eventId,
    summary,
    fullEventData,
    rows,
    participants,
    description,
    outcomes,
    reportCards,
    docState,
  } = props;

  const now = new Date();
  const formattedTimestamp = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;

  const cleanId = !eventId || eventId === 'new' ? '001' : String(eventId).padStart(3, '0');
  const eventNo =
    fullEventData?.event_no ||
    fullEventData?.event_code ||
    summary?.event_code ||
    summary?.event_no ||
    `EVT/${new Date().getFullYear()}/${cleanId}`;
  const status = fullEventData?.status || summary?.status || 'Active';
  const name =
    fullEventData?.title ||
    fullEventData?.name ||
    summary?.title ||
    summary?.name ||
    summary?.event_name ||
    'Event Report';

  let dateAndTime = '-';
  const rawSDate = fullEventData?.start_date || summary?.dateFrom || summary?.start_date;
  const rawEDate = fullEventData?.end_date || summary?.dateTo || summary?.end_date;
  const timeStr = fullEventData?.time || summary?.time || '';
  if (rawSDate) {
    const sDateStr = new Date(rawSDate).toLocaleDateString('en-GB');
    if (rawEDate && rawEDate !== rawSDate) {
      const eDateStr = new Date(rawEDate).toLocaleDateString('en-GB');
      dateAndTime = `${sDateStr} to ${eDateStr}${timeStr ? ` | ${timeStr}` : ''}`;
    } else {
      dateAndTime = `${sDateStr}${timeStr ? ` | ${timeStr}` : ''}`;
    }
  }

  const mode = fullEventData?.mode || summary?.mode || 'Offline';
  const type = Array.isArray(fullEventData?.event_type)
    ? fullEventData.event_type.join(', ')
    : fullEventData?.event_type ||
      fullEventData?.type ||
      summary?.category ||
      summary?.event_type ||
      'Event';
  const level = fullEventData?.level || summary?.level || 'Institutional';
  const hostCollaborator =
    fullEventData?.host_collaborator ||
    fullEventData?.hostCollaborator ||
    summary?.hostCollaborator ||
    summary?.host_collaborator ||
    (fullEventData?.department || summary?.department
      ? `${fullEventData?.department || summary?.department}`
      : 'KSRCT');
  const relatedSdg = Array.isArray(fullEventData?.sdgs)
    ? fullEventData.sdgs.join(', ')
    : fullEventData?.sdg ||
      fullEventData?.related_sdg ||
      (Array.isArray(summary?.sdgs) ? summary.sdgs.join(', ') : summary?.sdg) ||
      '-';

  const getPCount = (key: string) => {
    if (!participants || !Array.isArray(participants)) return 0;
    return participants
      .filter((p) => (p.type || p.label || '').toLowerCase().includes(key))
      .reduce((sum, p) => sum + (Number(p.count) || 0), 0);
  };
  const facultyCount =
    getPCount('faculty') || fullEventData?.faculty_count || summary?.faculty_count || 0;
  const studentCount =
    getPCount('student') || fullEventData?.students_count || summary?.students_count || 0;
  const otherCount =
    participants && participants.length > 0
      ? participants
          .filter(
            (p) =>
              !(p.type || p.label || '').toLowerCase().includes('faculty') &&
              !(p.type || p.label || '').toLowerCase().includes('student'),
          )
          .reduce((sum, p) => sum + (Number(p.count) || 0), 0)
      : fullEventData?.other_count || summary?.other_count || 0;

  const staffsInvolved = (
    fullEventData?.coordinators?.length
      ? fullEventData.coordinators
      : summary?.coordinators?.length
        ? summary.coordinators
        : []
  ).map((c: any, i: number) => {
    const code = c.code || c.employee_id || c.id || `EMP${String(i + 1).padStart(2, '0')}`;
    const cName = c.name || (typeof c === 'string' ? c : 'Faculty Coordinator');
    return {
      no: i + 1,
      name: `${code} - ${cName}`,
      role: c.role || (i === 0 ? 'Convenor' : 'Co-convenor'),
    };
  });

  const resourcePersonsList =
    rows && rows.length > 0 && rows.some((r) => Boolean(r.name))
      ? rows
          .filter((r) => Boolean(r.name))
          .map((r, i) => ({
            no: i + 1,
            type: r.purpose || 'Resource Person',
            name: r.name,
            designation: r.designation || '-',
            email: r.email || '-',
            organization: r.organization || '-',
          }))
      : fullEventData?.resource_persons?.length
        ? fullEventData.resource_persons.map((r: any, i: number) => ({
            no: i + 1,
            type: r.purpose || r.type || 'Resource Person',
            name: r.name || '-',
            designation: r.designation || '-',
            email: r.email || '-',
            organization: r.organization || '-',
          }))
        : [];

  const eventDescriptionText =
    description.trim() ||
    fullEventData?.description ||
    summary?.description ||
    'No description provided.';
  const outcomeText =
    outcomes.trim() ||
    fullEventData?.outcome ||
    fullEventData?.actual_outcome ||
    summary?.outcome ||
    summary?.actual_outcome ||
    'No outcome recorded.';

  const getMediaImageSrc = (index: number) => {
    for (const card of reportCards) {
      if (card.photos && card.photos[index]) {
        const p = card.photos[index];
        if (p instanceof File) {
          try {
            return URL.createObjectURL(p);
          } catch {
            /* ignore */
          }
        } else if (typeof p === 'string') {
          return p;
        }
      }
    }
    if (docState?.['Photos']?.file) {
      const files = docState['Photos'].file;
      if (Array.isArray(files) && files[index]) {
        const f = files[index];
        if (f instanceof File) {
          try {
            return URL.createObjectURL(f);
          } catch {
            /* ignore */
          }
        }
        if (typeof f === 'string') return f;
      }
    }
    return null;
  };

  const posterSrc = getMediaImageSrc(0);
  const webimgSrc = getMediaImageSrc(1);
  const img1Src = getMediaImageSrc(2);
  const img2Src = getMediaImageSrc(3);

  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    alert('Please allow popups for this site to open the report in a separate tab.');
    return;
  }

  const staffsRows =
    staffsInvolved.length > 0
      ? staffsInvolved
          .map(
            (s) => `
    <tr>
      <td>${s.no}</td>
      <td>${s.name}</td>
      <td>${s.role}</td>
    </tr>
  `,
          )
          .join('')
      : `
    <tr>
      <td colspan="3" style="text-align:center;color:#64748b;padding:12px;">No coordinators assigned.</td>
    </tr>
  `;

  const rpRows =
    resourcePersonsList.length > 0
      ? resourcePersonsList
          .map(
            (r) => `
    <tr>
      <td>${r.no}</td>
      <td>${r.type}</td>
      <td>${r.name}</td>
      <td>${r.designation}</td>
      <td>${r.email}</td>
      <td>${r.organization}</td>
    </tr>
  `,
          )
          .join('')
      : `
    <tr>
      <td colspan="6" style="text-align:center;color:#64748b;padding:12px;">No resource persons listed.</td>
    </tr>
  `;

  const posterHtml = posterSrc
    ? `<img src="${posterSrc}" alt="POSTER" style="width:100%;height:100%;object-fit:contain;" />`
    : `<div style="width:100%;height:100%;background:linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px;text-align:center;">
        <div style="font-size:14px;font-weight:800;color:#0369a1;">${name}</div>
        <div style="font-size:10px;font-weight:600;color:#0284c7;">${hostCollaborator}</div>
        <div style="font-size:24px;">📄</div>
       </div>`;

  const webimgHtml = webimgSrc
    ? `<img src="${webimgSrc}" alt="WEBIMG" style="width:100%;height:100%;object-fit:contain;" />`
    : `<div style="width:100%;height:100%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;">
        <div style="width:110px;height:110px;border-radius:50%;background:#fff;border:3px solid #005492;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#005492;text-align:center;padding:8px;">${name.length > 20 ? `${name.substring(0, 20)}...` : name}</div>
       </div>`;

  const img1Html = img1Src
    ? `<img src="${img1Src}" alt="IMG1" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div style="width:100%;height:100%;background:linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%);position:relative;display:flex;align-items:flex-end;">
        <div style="background:rgba(15,23,42,0.7);color:#fff;font-size:10px;padding:4px 8px;margin:8px;border-radius:3px;">${hostCollaborator}</div>
       </div>`;

  const img2Html = img2Src
    ? `<img src="${img2Src}" alt="IMG2" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div style="width:100%;height:100%;background:linear-gradient(135deg, #94a3b8 0%, #64748b 100%);position:relative;display:flex;align-items:flex-end;">
        <div style="background:rgba(15,23,42,0.7);color:#fff;font-size:10px;padding:4px 8px;margin:8px;border-radius:3px;">${hostCollaborator}</div>
       </div>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Event Report - ${eventNo}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background: #475569;
          color: #1e293b;
          padding: 20px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }
        .no-print-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #0f172a;
          color: #fff;
          padding: 12px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 99999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .no-print-bar h2 { font-size: 16px; font-weight: 700; margin: 0; }
        .print-btn {
          background: #0066cc;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease;
        }
        .print-btn:hover { background: #005492; }
        .page-sheet {
          background: #ffffff;
          width: 800px;
          min-height: 1100px;
          padding: 40px 48px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.25);
          position: relative;
          display: flex;
          flex-direction: column;
          margin-top: 40px;
          box-sizing: border-box;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        .main-title { font-size: 22px; font-weight: 700; color: #005492; margin-bottom: 4px; }
        .inst-title { font-size: 14px; font-weight: 700; color: #005492; }
        .logo { height: 48px; object-fit: contain; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
        .meta-table td { padding: 6px 10px; border-bottom: 1px dashed #cbd5e1; }
        .meta-table td.lbl { font-weight: 700; color: #005492; width: 220px; vertical-align: top; }
        .meta-table td.val { color: #1e293b; }
        .sec-title { font-size: 14px; font-weight: 700; color: #005492; margin: 18px 0 8px 0; }
        .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        .grid-table th { border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 8px; text-align: left; font-weight: 700; color: #005492; }
        .grid-table td { border-bottom: 1px dashed #e2e8f0; padding: 8px; color: #334155; }
        .body-txt { font-size: 12.5px; line-height: 1.6; color: #1e293b; margin-bottom: 16px; text-align: justify; }
        .footer {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          width: 100%;
        }
        .footer-time { color: #64748b; font-size: 10.5px; }
        .footer-disclaimer { font-size: 11px; font-weight: 700; color: #005492; text-align: center; flex: 1; padding: 0 12px; }
        .footer-page { font-size: 11.5px; font-weight: 700; color: #005492; white-space: nowrap; }
        .media-grid { display: flex; flex-direction: column; gap: 20px; flex: 1; }
        .media-item { display: flex; flex-direction: column; gap: 6px; }
        .media-lbl { font-size: 13px; font-weight: 700; color: #1e293b; }
        .media-box { width: 100%; max-width: 480px; height: 200px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f8fafc; }
        @media print {
          body { background: #fff; padding: 0; }
          .no-print-bar { display: none !important; }
          .page-sheet {
            width: 100%;
            box-shadow: none;
            margin: 0 !important;
            padding: 30px 40px !important;
            page-break-after: always;
            min-height: 100vh;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <h2>Event Report - ${eventNo}</h2>
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
      </div>

      <!-- PAGE 1 -->
      <div class="page-sheet">
        <div class="header">
          <div>
            <h1 class="main-title">Events</h1>
            <h2 class="inst-title">K.S. Rangasamy College of Technology</h2>
          </div>
          <img src="${KSRCTLogo}" alt="Logo" class="logo" />
        </div>

        <table class="meta-table">
          <tbody>
            <tr><td class="lbl">Event No</td><td class="val">${eventNo}</td></tr>
            <tr><td class="lbl">Status</td><td class="val">${status}</td></tr>
            <tr><td class="lbl">Name</td><td class="val">${name}</td></tr>
            <tr><td class="lbl">Date and Time</td><td class="val">${dateAndTime}</td></tr>
            <tr><td class="lbl">Host & Collaborator</td><td class="val">${hostCollaborator}</td></tr>
            <tr><td class="lbl">Type</td><td class="val">${type}</td></tr>
            <tr><td class="lbl">Level</td><td class="val">${level}</td></tr>
            <tr><td class="lbl">Mode</td><td class="val">${mode}</td></tr>
            <tr><td class="lbl">Related SDG</td><td class="val">${relatedSdg}</td></tr>
            <tr><td class="lbl">Faculty Internal Participants</td><td class="val">${facultyCount}</td></tr>
            <tr><td class="lbl">Students Internal Participants</td><td class="val">${studentCount}</td></tr>
            <tr><td class="lbl">Other Participants</td><td class="val">${otherCount}</td></tr>
          </tbody>
        </table>

        <div class="sec-title">Staffs Involved</div>
        <table class="grid-table">
          <thead>
            <tr><th style="width: 40px;">No</th><th>Full Name</th><th>Role</th></tr>
          </thead>
          <tbody>
            ${staffsRows}
          </tbody>
        </table>

        <div class="sec-title">Resource Persons</div>
        <table class="grid-table">
          <thead>
            <tr><th style="width: 40px;">No</th><th>Type</th><th>Name</th><th>Designation</th><th>Email</th><th>Organization</th></tr>
          </thead>
          <tbody>
            ${rpRows}
          </tbody>
        </table>

        <div class="sec-title">Event Description</div>
        <p class="body-txt">${eventDescriptionText}</p>

        <div class="sec-title">Actual Outcome and Report of the Event</div>
        <p class="body-txt">${outcomeText}</p>

        <div class="footer">
          <span class="footer-time">${formattedTimestamp}</span>
          <span class="footer-disclaimer">This document is computer generated and doesn't require any signature / stamp / seal to be valid.</span>
          <span class="footer-page">Page 1 of 2</span>
        </div>
      </div>

      <!-- PAGE 2 -->
      <div class="page-sheet">
        <div class="header">
          <div>
            <h1 class="main-title">Events</h1>
            <h2 class="inst-title">K.S. Rangasamy College of Technology</h2>
          </div>
          <img src="${KSRCTLogo}" alt="Logo" class="logo" />
        </div>

        <div class="media-grid">
          <div class="media-item">
            <div class="media-lbl">POSTER</div>
            <div class="media-box">${posterHtml}</div>
          </div>
          <div class="media-item">
            <div class="media-lbl">WEBIMG</div>
            <div class="media-box">${webimgHtml}</div>
          </div>
          <div class="media-item">
            <div class="media-lbl">IMG1</div>
            <div class="media-box">${img1Html}</div>
          </div>
          <div class="media-item">
            <div class="media-lbl">IMG2</div>
            <div class="media-box">${img2Html}</div>
          </div>
        </div>

        <div class="footer">
          <span class="footer-time">${formattedTimestamp}</span>
          <span class="footer-disclaimer">This document is computer generated and doesn't require any signature / stamp / seal to be valid.</span>
          <span class="footer-page">Page 2 of 2</span>
        </div>
      </div>
    </body>
    </html>
  `;

  reportWindow.document.write(htmlContent);
  reportWindow.document.close();
}

const EventReportModal: React.FC<EventReportModalProps> = ({
  open,
  onClose,
  eventId,
  summary,
  fullEventData,
  rows,
  participants,
  description,
  outcomes,
  reportCards,
  docState,
}) => {
  if (!open) return null;

  const now = new Date();
  const formattedTimestamp = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;

  const cleanId = !eventId || eventId === 'new' ? '001' : String(eventId).padStart(3, '0');
  const eventNo =
    fullEventData?.event_no ||
    fullEventData?.event_code ||
    summary?.event_code ||
    summary?.event_no ||
    `BM/2025/${cleanId}`;
  const status = fullEventData?.status || summary?.status || 'Closed';
  const name =
    fullEventData?.title ||
    fullEventData?.name ||
    summary?.title ||
    summary?.name ||
    summary?.event_name ||
    'Free Medical Camp';

  let dateAndTime = '26-07-2025 | 09:30 AM to 04:20 PM';
  const rawSDate = fullEventData?.start_date || summary?.dateFrom || summary?.start_date;
  const rawEDate = fullEventData?.end_date || summary?.dateTo || summary?.end_date;
  const timeStr = fullEventData?.time || summary?.time || '09:30 AM to 04:20 PM';
  if (rawSDate) {
    const sDateStr = new Date(rawSDate).toLocaleDateString('en-GB');
    if (rawEDate && rawEDate !== rawSDate) {
      const eDateStr = new Date(rawEDate).toLocaleDateString('en-GB');
      dateAndTime = `${sDateStr} to ${eDateStr} | ${timeStr}`;
    } else {
      dateAndTime = `${sDateStr} | ${timeStr}`;
    }
  }

  const mode = fullEventData?.mode || summary?.mode || 'On Campus';
  const type = Array.isArray(fullEventData?.event_type)
    ? fullEventData.event_type.join(', ')
    : fullEventData?.event_type ||
      fullEventData?.type ||
      summary?.category ||
      summary?.event_type ||
      'ISR Activity';
  const level = fullEventData?.level || summary?.level || 'Institute';
  const hostCollaborator =
    fullEventData?.host_collaborator ||
    fullEventData?.hostCollaborator ||
    summary?.hostCollaborator ||
    summary?.host_collaborator ||
    (fullEventData?.department || summary?.department
      ? `${fullEventData?.department || summary?.department}`
      : 'BM & KSRCT');
  const relatedSdg = Array.isArray(fullEventData?.sdgs)
    ? fullEventData.sdgs.join(', ')
    : fullEventData?.sdg ||
      fullEventData?.related_sdg ||
      (Array.isArray(summary?.sdgs) ? summary.sdgs.join(', ') : summary?.sdg) ||
      '3: Good Health and Well-being';

  const getPCount = (key: string) => {
    if (!participants || !Array.isArray(participants)) return 0;
    return participants
      .filter((p) => (p.type || p.label || '').toLowerCase().includes(key))
      .reduce((sum, p) => sum + (Number(p.count) || 0), 0);
  };
  const facultyCount =
    getPCount('faculty') || fullEventData?.faculty_count || summary?.faculty_count || 35;
  const studentCount =
    getPCount('student') || fullEventData?.students_count || summary?.students_count || 85;
  const otherCount =
    participants && participants.length > 0
      ? participants
          .filter(
            (p) =>
              !(p.type || p.label || '').toLowerCase().includes('faculty') &&
              !(p.type || p.label || '').toLowerCase().includes('student'),
          )
          .reduce((sum, p) => sum + (Number(p.count) || 0), 0)
      : fullEventData?.other_count || summary?.other_count || 120;

  const staffsInvolved = (
    fullEventData?.coordinators?.length
      ? fullEventData.coordinators
      : summary?.coordinators?.length
        ? summary.coordinators
        : []
  ).map((c: any, i: number) => {
    const code = c.code || c.employee_id || c.id || `BME${String(i + 7).padStart(2, '0')}`;
    const cName = c.name || (typeof c === 'string' ? c : 'FACULTY');
    return {
      no: i + 1,
      name: `${code} - ${cName}`,
      role: c.role || (i === 0 ? 'Convenor' : 'Co-convenor'),
    };
  });
  if (staffsInvolved.length === 0) {
    staffsInvolved.push(
      { no: 1, name: 'BME07 - SREELATHA P', role: 'Convenor' },
      { no: 2, name: 'BME19 - ARUNKUMAR P', role: 'Co-convenor' },
    );
  }

  const resourcePersonsList =
    rows && rows.length > 0 && rows.some((r) => Boolean(r.name))
      ? rows
          .filter((r) => Boolean(r.name))
          .map((r, i) => ({
            no: i + 1,
            type: r.purpose || 'Chief Guest',
            name: r.name,
            designation: r.designation || 'GENERAL PHYSICIAN',
            email: r.email || 'arunkumarp@kpriet.ac.in',
            organization: r.organization || 'KGM hospitals',
          }))
      : fullEventData?.resource_persons?.length
        ? fullEventData.resource_persons.map((r: any, i: number) => ({
            no: i + 1,
            type: r.purpose || r.type || 'Chief Guest',
            name: r.name,
            designation: r.designation || 'GENERAL PHYSICIAN',
            email: r.email || 'arunkumarp@kpriet.ac.in',
            organization: r.organization || 'KGM hospitals',
          }))
        : [
            {
              no: 1,
              type: 'Chief Guest',
              name: 'DR. A MUKESH',
              designation: 'GENERAL PHYSICIAN',
              email: 'arunkumarp@kpriet.ac.in',
              organization: 'KGM hospitals',
            },
          ];

  const eventDescriptionText =
    description.trim() ||
    fullEventData?.description ||
    summary?.description ||
    'A free medical camp will be organized on 26th July 2025 in association with KGM Hospitals, Coimbatore. The camp aims to provide general health check-ups, specialist consultations, and basic diagnostic services. It is open to the public and focuses on promoting health awareness. Experienced doctors and medical staff from KGM Hospitals will be available for consultations. All are welcome to benefit from this initiative towards a healthier community.';

  const outcomeText =
    outcomes.trim() ||
    fullEventData?.outcome ||
    fullEventData?.actual_outcome ||
    summary?.outcome ||
    summary?.actual_outcome ||
    'A dedicated team of physicians and specialists conducted screenings for blood pressure, glucose levels, and general health while distributing free medicines to those in need. Most cases treated involved seasonal ailments and chronic conditions, highlighting a significant need for regular health monitoring within the community. The initiative concluded with positive feedback from participants, effectively bridging the gap in medical accessibility and raising overall health awareness.';

  const totalPages = 2;

  const handlePrint = () => {
    window.print();
  };

  const getMediaImageSrc = (index: number) => {
    for (const card of reportCards) {
      if (card.photos && card.photos[index]) {
        const p = card.photos[index];
        if (p instanceof File) {
          try {
            return URL.createObjectURL(p);
          } catch {
            /* ignore */
          }
        } else if (typeof p === 'string') {
          return p;
        }
      }
    }
    if (docState?.['Photos']?.file) {
      const files = docState['Photos'].file;
      if (Array.isArray(files) && files[index]) {
        const f = files[index];
        if (f instanceof File) {
          try {
            return URL.createObjectURL(f);
          } catch {
            /* ignore */
          }
        }
        if (typeof f === 'string') return f;
      }
    }
    return null;
  };

  const posterSrc = getMediaImageSrc(0);
  const webimgSrc = getMediaImageSrc(1);
  const img1Src = getMediaImageSrc(2);
  const img2Src = getMediaImageSrc(3);

  return (
    <div
      className="event-report-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="event-report-modal-container">
        {/* Modal Header */}
        <div className="event-report-modal-header no-print">
          <h3 className="event-report-modal-title">Event Report Preview</h3>
          <div className="event-report-modal-actions">
            <button
              type="button"
              className="event-report-print-btn"
              onClick={() =>
                generateAndOpenReportInNewTab({
                  eventId,
                  summary,
                  fullEventData,
                  rows,
                  participants,
                  description,
                  outcomes,
                  reportCards,
                  docState,
                })
              }
              style={{ background: '#0284c7' }}
            >
              <ExternalLink size={16} /> Open in Separate Page
            </button>
            <button type="button" className="event-report-print-btn" onClick={handlePrint}>
              <Printer size={16} /> Print / Save PDF
            </button>
            <button
              type="button"
              className="event-report-close-btn"
              onClick={onClose}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Multi-Page Report Wrapper */}
        <div className="event-report-pages-wrapper">
          {/* PAGE 1 */}
          <div className="event-report-page-sheet">
            <div className="report-pdf-header">
              <div className="report-pdf-header-left">
                <h1 className="report-pdf-main-title">Events</h1>
                <h2 className="report-pdf-inst-title">K.S. Rangasamy College of Technology</h2>
              </div>
              <div className="report-pdf-header-right">
                <img src={KSRCTLogo} alt="Logo" className="report-pdf-logo" />
              </div>
            </div>

            {/* Event Metadata Table */}
            <table className="report-pdf-meta-table">
              <tbody>
                <tr>
                  <td className="meta-lbl">Event No</td>
                  <td className="meta-val">{eventNo}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Status</td>
                  <td className="meta-val">{status}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Name</td>
                  <td className="meta-val">{name}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Date and Time</td>
                  <td className="meta-val">{dateAndTime}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Host & Collaborator</td>
                  <td className="meta-val">{hostCollaborator}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Type</td>
                  <td className="meta-val">{type}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Level</td>
                  <td className="meta-val">{level}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Mode</td>
                  <td className="meta-val">{mode}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Related SDG</td>
                  <td className="meta-val">{relatedSdg}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Faculty Internal Participants</td>
                  <td className="meta-val">{facultyCount}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Students Internal Participants</td>
                  <td className="meta-val">{studentCount}</td>
                </tr>
                <tr>
                  <td className="meta-lbl">Other Participants</td>
                  <td className="meta-val">{otherCount}</td>
                </tr>
              </tbody>
            </table>

            {/* Staffs Involved */}
            <div className="report-pdf-sec-title">Staffs Involved</div>
            <table className="report-pdf-grid-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>No</th>
                  <th>Full Name</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {staffsInvolved.map((staff: any) => (
                  <tr key={staff.no}>
                    <td>{staff.no}</td>
                    <td>{staff.name}</td>
                    <td>{staff.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Resource Persons */}
            <div className="report-pdf-sec-title">Resource Persons</div>
            <table className="report-pdf-grid-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>No</th>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Email</th>
                  <th>Organization</th>
                </tr>
              </thead>
              <tbody>
                {resourcePersonsList.map((rp: any) => (
                  <tr key={rp.no}>
                    <td>{rp.no}</td>
                    <td>{rp.type}</td>
                    <td>{rp.name}</td>
                    <td>{rp.designation}</td>
                    <td>{rp.email}</td>
                    <td>{rp.organization}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Event Description */}
            <div className="report-pdf-sec-title">Event Description</div>
            <p className="report-pdf-body-txt">{eventDescriptionText}</p>

            {/* Actual Outcome and Report */}
            <div className="report-pdf-sec-title">Actual Outcome and Report of the Event</div>
            <p className="report-pdf-body-txt">{outcomeText}</p>

            {/* FOOTER ON PAGE 1 */}
            <div className="report-pdf-footer">
              <span className="footer-time">{formattedTimestamp}</span>
              <span className="footer-disclaimer">
                This document is computer generated and doesn't require any signature / stamp / seal
                to be valid.
              </span>
              <span className="footer-page">Page 1 of {totalPages}</span>
            </div>
          </div>

          {/* PAGE 2 - MEDIA & IMAGES */}
          <div className="event-report-page-sheet">
            <div className="report-pdf-header">
              <div className="report-pdf-header-left">
                <h1 className="report-pdf-main-title">Events</h1>
                <h2 className="report-pdf-inst-title">K.S. Rangasamy College of Technology</h2>
              </div>
              <div className="report-pdf-header-right">
                <img src={KSRCTLogo} alt="Logo" className="report-pdf-logo" />
              </div>
            </div>

            <div className="report-pdf-media-section">
              <div className="report-media-item">
                <div className="report-media-label">POSTER</div>
                <div className="report-media-box">
                  {posterSrc ? (
                    <img
                      src={posterSrc}
                      alt="POSTER"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="report-poster-mock">
                      <div className="poster-mock-header">{name}</div>
                      <div className="poster-mock-sub">{hostCollaborator}</div>
                      <div className="poster-mock-icon">📄</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="report-media-item">
                <div className="report-media-label">WEBIMG</div>
                <div className="report-media-box">
                  {webimgSrc ? (
                    <img
                      src={webimgSrc}
                      alt="WEBIMG"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="report-webimg-mock">
                      <div className="webimg-circle">
                        {name.length > 20 ? `${name.substring(0, 20)}...` : name}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="report-media-item">
                <div className="report-media-label">IMG1</div>
                <div className="report-media-box">
                  {img1Src ? (
                    <img
                      src={img1Src}
                      alt="IMG1"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="report-photo-mock">
                      <div className="photo-tag-overlay">{hostCollaborator}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="report-media-item">
                <div className="report-media-label">IMG2</div>
                <div className="report-media-box">
                  {img2Src ? (
                    <img
                      src={img2Src}
                      alt="IMG2"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="report-photo-mock photo-2">
                      <div className="photo-tag-overlay">{hostCollaborator}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* FOOTER ON PAGE 2 */}
            <div className="report-pdf-footer">
              <span className="footer-time">{formattedTimestamp}</span>
              <span className="footer-disclaimer">
                This document is computer generated and doesn't require any signature / stamp / seal
                to be valid.
              </span>
              <span className="footer-page">Page 2 of {totalPages}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DocumentsCard: React.FC<DocumentsCardProps> = ({
  docState,
  setany,
  eventId,
  summary,
  fullEventData,
  rows,
  participants,
}) => {
  const [description, setDescription] = useState('');
  const [outcomes, setOutcomes] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  const [showReportDropdown, setShowReportDropdown] = useState(false);
  const [reportCards, setReportCards] = useState<ReportCardItem[]>([]);

  const handleAddReportCard = (type: 'resource' | 'activity' = 'resource') => {
    const defaultTitle =
      fullEventData?.title ||
      fullEventData?.name ||
      summary?.title ||
      summary?.name ||
      summary?.event_name ||
      '';
    setReportCards((prev) => [...prev, createEmptyReportCard(type, defaultTitle)]);
  };

  const handleRemoveReportCard = (id: number) => {
    setReportCards((prev) => prev.filter((card) => card.id !== id));
  };

  const handleCardChange = (id: number, field: keyof ReportCardItem, value: any) => {
    setReportCards((prev) =>
      prev.map((card) => (card.id === id ? { ...card, [field]: value } : card)),
    );
  };

  const handleCardPhotoUpload = (
    id: number,
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    setReportCards((prev) =>
      prev.map((card) => {
        if (card.id === id) {
          const newPhotos = [...card.photos];
          newPhotos[index] = file;
          return { ...card, photos: newPhotos };
        }
        return card;
      }),
    );
  };

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

  const resourceOptions = useMemo(() => {
    const list: string[] = [];
    if (rows && rows.length > 0) {
      rows.forEach((r) => {
        if (r.name) list.push(r.name);
      });
    }
    if (fullEventData?.resource_persons && Array.isArray(fullEventData.resource_persons)) {
      fullEventData.resource_persons.forEach((r: any) => {
        if (r.name) list.push(r.name);
      });
    }
    const unique = Array.from(new Set(list));
    return unique.length > 0 ? unique : ['Resource Person 1', 'Resource Person 2'];
  }, [rows, fullEventData]);

  const docsToKeep = ['Invitation', 'Agenda', 'Schedule', 'Attendance sheet'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {/* Documents Card */}
      <div
        className="event-card-section event-documents-card"
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #eef2f6',
          marginBottom: 0,
        }}
      >
        <h2
          className="event-section-title"
          style={{
            color: '#0066cc',
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '20px',
            marginTop: 0,
          }}
        >
          Documents
        </h2>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {docsToKeep.map((docName) => (
            <div
              key={docName}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#ffffff',
                border: '1px solid #e0e6ed',
                borderRadius: '8px',
                flex: '1 1 200px',
              }}
            >
              <span style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>{docName}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <label
                  style={{
                    cursor: 'pointer',
                    color: docState[docName]?.file ? '#10b981' : '#0066cc',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <CloudUpload size={18} />
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(docName, e)}
                    style={{ display: 'none' }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => docState[docName]?.file && handleViewFile(docName)}
                  disabled={!docState[docName]?.file}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: docState[docName]?.file ? 'pointer' : 'not-allowed',
                    color: docState[docName]?.file ? '#0066cc' : '#cbd5e1',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={docState[docName]?.file ? 'View document' : 'No document uploaded'}
                >
                  <Eye size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="event-card-section event-report-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2
            className="event-section-title"
            style={{ color: '#0069ab', fontSize: '18px', fontWeight: 600, margin: 0 }}
          >
            Report Generation
          </h2>
          <div style={{ position: 'relative' }}>
            <CustomButton
              type="button"
              onClick={() => setShowReportDropdown(!showReportDropdown)}
              style={{
                background: '#0069ab',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
              title="Click '+' to add Resource Person or Activity"
            >
              <Plus size={20} />
            </CustomButton>
            {showReportDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: '#fff',
                  border: '1px solid #eef2f6',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  minWidth: '160px',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    handleAddReportCard('resource');
                    setShowReportDropdown(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #f1f5f9',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#334155',
                  }}
                >
                  Resource Person
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAddReportCard('activity');
                    setShowReportDropdown(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#334155',
                  }}
                >
                  Activity
                </button>
              </div>
            )}
          </div>
        </div>

        {reportCards.map((card, cardIndex) => (
          <div
            key={card.id}
            className="rp-modal-content"
            style={{
              marginTop: '6px',
              borderTop: 'none',
              paddingTop: '6px',
            }}
          >
            {/* Form Body */}
            <div className="rp-modal-body">
              <div className="rp-form-row">
                {card.type === 'resource' ? (
                  <div className="rp-form-group" style={{ flex: 2 }}>
                    <CustomDropdown
                      label="Resource Person"
                      name={`resource-${card.id}`}
                      options={resourceOptions.map((opt) => ({ value: opt, label: opt }))}
                      value={card.resource ? { value: card.resource, label: card.resource } : null}
                      onChange={(val: any) =>
                        handleCardChange(card.id, 'resource', val?.value || '')
                      }
                      placeholder="Select resource"
                      className="mb-0"
                    />
                  </div>
                ) : (
                  <div className="rp-form-group" style={{ flex: 2 }}>
                    <CustomDropdown
                      label="Activity"
                      name={`activity-${card.id}`}
                      options={[
                        { value: 'Activity 1', label: 'Activity 1' },
                        { value: 'Activity 2', label: 'Activity 2' },
                      ]}
                      value={card.activity ? { value: card.activity, label: card.activity } : null}
                      onChange={(val: any) =>
                        handleCardChange(card.id, 'activity', val?.value || '')
                      }
                      placeholder="Select activity"
                      className="mb-0"
                    />
                  </div>
                )}
                <div className="rp-form-group" style={{ flex: 1 }}>
                  <CustomInput
                    label="Date"
                    name={`date-${card.id}`}
                    type="date"
                    value={card.date}
                    onChange={(val) => handleCardChange(card.id, 'date', val)}
                    className="mb-0"
                  />
                </div>
                <div className="rp-form-group" style={{ flex: 1 }}>
                  <CustomInput
                    label="Time"
                    name={`time-${card.id}`}
                    type="time"
                    value={card.time}
                    onChange={(val) => handleCardChange(card.id, 'time', val)}
                    className="mb-0"
                  />
                </div>
              </div>

              <div className="rp-form-group">
                <CustomInput
                  label="Title"
                  name={`title-${card.id}`}
                  type="text"
                  placeholder="Enter title"
                  value={card.title}
                  onChange={(val) => handleCardChange(card.id, 'title', val)}
                  className="mb-0"
                />
              </div>

              <div className="rp-form-group">
                <CustomInput
                  label="Description"
                  name={`description-${card.id}`}
                  as="textarea"
                  rows={3}
                  placeholder="Enter description..."
                  value={card.description}
                  onChange={(val) => handleCardChange(card.id, 'description', val)}
                  className="mb-0"
                />
              </div>

              <div className="rp-form-group mb-0">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    marginTop: '6px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flex: '1 1 auto' }}>
                    {[0, 1].map((index) => {
                      const photo = card.photos[index];
                      const photoName =
                        photo instanceof File
                          ? photo.name
                          : typeof photo === 'string' && photo
                            ? (photo as string).split('/').pop()
                            : `Photo ${index + 1}`;
                      const hasPhoto = Boolean(photo);
                      return (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: '#ffffff',
                            border: '1px solid #e0e6ed',
                            borderRadius: '8px',
                            flex: '1 1 200px',
                            maxWidth: '280px',
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              color: '#334155',
                              fontSize: '14px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginRight: '8px',
                            }}
                            title={hasPhoto ? photoName : `Photo ${index + 1}`}
                          >
                            {hasPhoto ? photoName : `Photo ${index + 1}`}
                          </span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <label
                              style={{
                                cursor: 'pointer',
                                color: hasPhoto ? '#10b981' : '#0066cc',
                                margin: 0,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              title={hasPhoto ? 'Change photo' : 'Upload photo'}
                            >
                              <CloudUpload size={18} />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleCardPhotoUpload(card.id, e, index)}
                                style={{ display: 'none' }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                if (!photo) return;
                                if (photo instanceof File) {
                                  const fileURL = URL.createObjectURL(photo);
                                  window.open(fileURL, '_blank');
                                } else if (typeof photo === 'string') {
                                  window.open(photo, '_blank');
                                }
                              }}
                              disabled={!hasPhoto}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: hasPhoto ? 'pointer' : 'not-allowed',
                                color: hasPhoto ? '#0066cc' : '#cbd5e1',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              title={hasPhoto ? 'View photo' : 'No photo uploaded'}
                            >
                              <Eye size={18} />
                            </button>
                            {hasPhoto && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newPhotos = [...card.photos];
                                  newPhotos[index] = null;
                                  setReportCards((prev) =>
                                    prev.map((c) =>
                                      c.id === card.id ? { ...c, photos: newPhotos } : c,
                                    ),
                                  );
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                title="Remove photo"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      marginLeft: 'auto',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveReportCard(card.id)}
                      style={{
                        borderRadius: '50%',
                        width: '34px',
                        height: '34px',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#fef2f2',
                        border: '1px solid #fee2e2',
                        color: '#ef4444',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      title="Delete card"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddReportCard(card.type)}
                      style={{
                        borderRadius: '50%',
                        width: '34px',
                        height: '34px',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#0069ab',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      title="Add another card"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <CustomButton
            type="button"
            onClick={() =>
              generateAndOpenReportInNewTab({
                eventId,
                summary,
                fullEventData,
                rows,
                participants,
                description,
                outcomes,
                reportCards,
                docState,
              })
            }
          >
            Generate Report
          </CustomButton>
        </div>
      </div>
    </div>
  );
};

const Modal: React.FC<ModalProps> = ({ open, onClose, children }) =>
  open ? (
    <div
      className="rp-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rp-modal-container">
        <button onClick={onClose} className="rp-modal-close" aria-label="Close">
          <X size={18} />
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
          <article
            className="event-approval-card form-card"
            key={row.id}
            style={{ borderRadius: '16px', padding: '20px 24px' }}
          >
            <div
              className="event-approval-title-row"
              style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '14px' }}
            >
              <h2 style={{ fontSize: '17px', color: '#0069ab', fontWeight: 700, margin: 0 }}>
                {EVENT_COPY.resourcePersonLabel} {index + 1}
              </h2>
              <div
                className="event-approval-icon-actions"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
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
                    width: '36px',
                    height: '36px',
                    minWidth: '36px',
                    minHeight: '36px',
                    background: '#0069ab',
                    color: '#ffffff',
                    borderRadius: '10px',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Plus
                    size={20}
                    strokeWidth={2.5}
                    color="#ffffff"
                    style={{ color: '#ffffff', stroke: '#ffffff' }}
                  />
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="muted"
                    onClick={() => handleDelete(row.id)}
                    title="Remove resource person"
                    aria-label="Remove resource person"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      background: '#fff1f1',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ef4444',
                      borderRadius: '10px',
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Row 1: Name, Designation */}
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '14px' }}>
                  <label
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#334155',
                      minWidth: '100px',
                      margin: 0,
                    }}
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    value={row.name || ''}
                    onChange={(e) => handleChange(row.id, 'name', e.target.value)}
                    style={{
                      flex: 1,
                      border: '1px solid #cfdbe8',
                      borderRadius: '10px',
                      height: '40px',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: '#102a43',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '14px' }}>
                  <label
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#334155',
                      minWidth: '100px',
                      margin: 0,
                    }}
                  >
                    Designation
                  </label>
                  <input
                    type="text"
                    value={row.designation || ''}
                    onChange={(e) => handleChange(row.id, 'designation', e.target.value)}
                    style={{
                      flex: 1,
                      border: '1px solid #cfdbe8',
                      borderRadius: '10px',
                      height: '40px',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: '#102a43',
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Organization, Email */}
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '14px' }}>
                  <label
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#334155',
                      minWidth: '100px',
                      margin: 0,
                    }}
                  >
                    Organization
                  </label>
                  <input
                    type="text"
                    value={row.organization || ''}
                    onChange={(e) => handleChange(row.id, 'organization', e.target.value)}
                    style={{
                      flex: 1,
                      border: '1px solid #cfdbe8',
                      borderRadius: '10px',
                      height: '40px',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: '#102a43',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '14px' }}>
                  <label
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#334155',
                      minWidth: '100px',
                      margin: 0,
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={row.email || ''}
                    onChange={(e) => handleChange(row.id, 'email', e.target.value)}
                    style={{
                      flex: 1,
                      border: '1px solid #cfdbe8',
                      borderRadius: '10px',
                      height: '40px',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: '#102a43',
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Purpose, Mode, Date, Time */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 2, gap: '14px' }}>
                  <label
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#334155',
                      minWidth: '100px',
                      margin: 0,
                    }}
                  >
                    Purpose
                  </label>
                  <CustomEventSelect
                    value={row.purpose || ''}
                    onChange={(e) => handleChange(row.id, 'purpose', e.target.value)}
                    placeholder="Select Purpose"
                    options={[
                      'Guest Lecture',
                      'Keynote Speaker',
                      'Session Chair',
                      'Valedictory Address',
                      'Inaugural Address',
                      'Panelist',
                      'Other',
                    ]}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 700, color: '#334155', margin: 0 }}>
                    Mode
                  </label>
                  <div
                    className="event-approval-toggle-pair-buttons"
                    style={{ display: 'flex', gap: '8px' }}
                  >
                    <button
                      type="button"
                      className={row.mode === 'Online' ? 'active' : ''}
                      onClick={() => handleChange(row.id, 'mode', 'Online')}
                      style={{
                        minHeight: '38px',
                        border: row.mode === 'Online' ? '1px solid #0069ab' : '1px solid #d4dbe4',
                        borderRadius: '8px',
                        background: row.mode === 'Online' ? '#0069ab' : '#f5f7fb',
                        color: row.mode === 'Online' ? '#ffffff' : '#0069ab',
                        fontSize: '13px',
                        fontWeight: 700,
                        padding: '6px 18px',
                        cursor: 'pointer',
                        boxShadow:
                          row.mode === 'Online' ? '0 4px 10px rgba(0, 105, 171, 0.2)' : 'none',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      Online
                    </button>
                    <button
                      type="button"
                      className={row.mode !== 'Online' ? 'active' : ''}
                      onClick={() => handleChange(row.id, 'mode', 'Offline')}
                      style={{
                        minHeight: '38px',
                        border: row.mode !== 'Online' ? '1px solid #0069ab' : '1px solid #d4dbe4',
                        borderRadius: '8px',
                        background: row.mode !== 'Online' ? '#0069ab' : '#f5f7fb',
                        color: row.mode !== 'Online' ? '#ffffff' : '#0069ab',
                        fontSize: '13px',
                        fontWeight: 700,
                        padding: '6px 18px',
                        cursor: 'pointer',
                        boxShadow:
                          row.mode !== 'Online' ? '0 4px 10px rgba(0, 105, 171, 0.2)' : 'none',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      Offline
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 700, color: '#334155', margin: 0 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={row.date || ''}
                    onChange={(e) => handleChange(row.id, 'date', e.target.value)}
                    style={{
                      border: '1px solid #cfdbe8',
                      borderRadius: '10px',
                      height: '40px',
                      padding: '0 12px',
                      fontSize: '14px',
                      width: '140px',
                      color: '#102a43',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 700, color: '#334155', margin: 0 }}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={row.time || ''}
                    onChange={(e) => handleChange(row.id, 'time', e.target.value)}
                    style={{
                      border: '1px solid #cfdbe8',
                      borderRadius: '10px',
                      height: '40px',
                      padding: '0 12px',
                      fontSize: '14px',
                      width: '120px',
                      color: '#102a43',
                    }}
                  />
                </div>
              </div>

              {/* Row 4: Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <label
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#334155',
                    minWidth: '100px',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Title
                  <label className="event-switch" style={{ margin: 0, display: 'inline-block' }}>
                    <input
                      type="checkbox"
                      checked={!!row.hasTitle}
                      onChange={(e) => handleChange(row.id, 'hasTitle', e.target.checked)}
                    />
                    <span className="event-slider" />
                  </label>
                </label>
                <input
                  type="text"
                  value={row.title || ''}
                  disabled={!row.hasTitle}
                  onChange={(e) => handleChange(row.id, 'title', e.target.value)}
                  style={{
                    flex: 1,
                    border: '1px solid #cfdbe8',
                    borderRadius: '10px',
                    height: '40px',
                    padding: '0 14px',
                    fontSize: '14px',
                    color: '#102a43',
                    opacity: row.hasTitle ? 1 : 0.6,
                  }}
                />
              </div>

              {/* Row 5: Action Cards */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                {/* Invitation Card */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px 18px',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Mail size={22} color="#0f6fc6" />
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>
                      Invitation
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '4px 12px 4px 6px',
                      background: '#f8fafc',
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
                        background: '#e0f2fe',
                        border: 'none',
                        color: '#0284c7',
                        fontSize: '14px',
                        fontWeight: 600,
                        padding: '7px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `mailto:${row.email || ''}?subject=${encodeURIComponent(EVENT_MAIL_TEMPLATES.invitationSubject(row.name || ''))}&body=${encodeURIComponent(EVENT_MAIL_TEMPLATES.invitationBody(row.name || ''))}`;
                        handleChange(row.id, 'invitationStatus', 'Sent');
                      }}
                      style={{
                        background: '#0284c7',
                        border: 'none',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: 600,
                        padding: '7px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                      }}
                    >
                      {EVENT_COPY.sendMail}
                    </button>
                    <div
                      style={{
                        width: '1px',
                        height: '18px',
                        background: '#cbd5e1',
                        margin: '0 4px',
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#64748b',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      <Info size={16} /> {row.invitationStatus || EVENT_COPY.notSent}
                    </div>
                  </div>
                </div>

                {/* Thanks Card */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px 18px',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Mail size={22} color="#0f6fc6" />
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>
                      Thanks
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '4px 12px 4px 6px',
                      background: '#f8fafc',
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
                        background: '#e0f2fe',
                        border: 'none',
                        color: '#0284c7',
                        fontSize: '14px',
                        fontWeight: 600,
                        padding: '7px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `mailto:${row.email || ''}?subject=${encodeURIComponent(EVENT_MAIL_TEMPLATES.thankYouSubject())}&body=${encodeURIComponent(EVENT_MAIL_TEMPLATES.thankYouBody(row.name || ''))}`;
                        handleChange(row.id, 'thanksStatus', 'Sent');
                      }}
                      style={{
                        background: '#0284c7',
                        border: 'none',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: 600,
                        padding: '7px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                      }}
                    >
                      {EVENT_COPY.sendMail}
                    </button>
                    <div
                      style={{
                        width: '1px',
                        height: '18px',
                        background: '#cbd5e1',
                        margin: '0 4px',
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#64748b',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      <Info size={16} /> {row.thanksStatus || EVENT_COPY.notSent}
                    </div>
                  </div>
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
  eventId?: string;
  summary?: any;
}

const EventUpdates: React.FC<EventUpdatesProps> = ({ goToTab, eventId, summary }) => {
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
          mailSent: false,
        };
        return acc;
      },
      {} as Record<string, LetterSectionData>,
    ),
  );

  const [mailStatus, setMailStatus] = useState<Record<string, boolean>>({});
  const [fullEventData, setFullEventData] = useState<any>(null);

  // Preview Modal State
  const [previewModal, setPreviewModal] = useState<{
    show: boolean;
    section: string;
    content: string;
  }>({
    show: false,
    section: '',
    content: '',
  });

  useEffect(() => {
    if (!eventId || eventId === 'new') return;
    // Load existing event data to initialize mailStatus and get full event data
    authenticityUtility
      .get(`/events/${eventId}`)
      .then((res: any) => {
        setFullEventData(res);
        const pub = res.publicity || {};
        const newMailStatus: Record<string, boolean> = {
          'Website Scrolling': !!pub.mail_sent_status?.['Website Scrolling'],
          'Newspaper Engagement': !!pub.mail_sent_status?.['Newspaper Engagement'],
          'Press Report': !!pub.mail_sent_status?.['Press Report'],
        };

        const docs = res.documents?.letters || {};
        for (const section of sections) {
          if (docs[section]?.mail_sent) {
            newMailStatus[section] = true;
            setFormData((prev) => ({
              ...prev,
              [section]: { ...prev[section], mailSent: true },
            }));
          }
        }
        setMailStatus(newMailStatus);
      })
      .catch(console.error);
  }, [eventId]);

  const generateMailTemplate = (sectionName: string) => {
    const data = fullEventData || summary || formData || {};

    const eventName = data.title || data.name || '';

    // Attempt to format date nicely
    let formattedDate = data.date || data.dateFrom || '';
    const formattedTime =
      data.time ||
      data.session ||
      data.inaugural_time ||
      data.inauguralTime ||
      data.valedictory_time ||
      data.valedictoryTime ||
      '';
    if (data.start_date) {
      formattedDate = `${new Date(data.start_date).toLocaleDateString()}`;
      if (data.end_date && data.end_date !== data.start_date) {
        formattedDate += ` to ${new Date(data.end_date).toLocaleDateString()}`;
      }
    } else if (data.dateFrom) {
      formattedDate = data.dateFrom;
      if (data.dateTo && data.dateTo !== data.dateFrom) {
        formattedDate += ` to ${data.dateTo}`;
      }
    }

    const venue =
      data.venue ||
      data.inaugural_venue ||
      data.inauguralVenue ||
      data.valedictory_venue ||
      data.valedictoryVenue ||
      '';
    const orgName = data.organization_name || 'K.S.Rangasamy College of Technology';

    const firstCoordinator = data.coordinators?.[0] || {};
    const organizer = data.coordinator || data.organizer || firstCoordinator.name || '';
    const designation = data.designation || firstCoordinator.department || '';
    const contact = data.contact_number || data.mobile || firstCoordinator.mobile || '';
    const email = data.email || firstCoordinator.email || '';

    return `Dear Sir/Madam,

Greetings from ${orgName}.

We are pleased to inform you that ${eventName} is scheduled to be conducted on ${formattedDate} at ${venue}.

We kindly request your support and necessary arrangements for the successful conduct of the event, including publicity, communication, security, photography, and video recording requirements.

Event Details:
Event Name: ${eventName}
Date: ${formattedDate}
Time: ${formattedTime}
Venue: ${venue}

We request your kind cooperation and support for the successful execution of the event.

Thank you for your valuable support.

Regards,
${organizer}
${designation}
${orgName}
${contact}
${email}`;
  };

  const handlePreviewMail = (sectionName: string) => {
    const content = generateMailTemplate(sectionName);
    setPreviewModal({ show: true, section: sectionName, content });
  };

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
  const handleSendMail = async (section: string): Promise<void> => {
    const content = generateMailTemplate(section);
    window.location.href = `mailto:?subject=${encodeURIComponent(section)}&body=${encodeURIComponent(content)}`;

    try {
      await authenticityUtility.put(`/updates/events/${eventId}/mail-status`, { section });
      setMailStatus((prev) => ({ ...prev, [section]: true }));
    } catch (err) {
      console.error('Failed to update mail status:', err);
    }
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
                  <button
                    type="button"
                    className="event-publicity-preview-btn"
                    onClick={() => handlePreviewMail(item.label)}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="event-publicity-send-btn"
                    onClick={() => handleSendMail(item.label)}
                  >
                    Send Mail
                  </button>
                  <span
                    className="event-publicity-status"
                    style={{ color: mailStatus[item.label] ? '#059669' : '#64748b' }}
                  >
                    <Info size={16} /> {mailStatus[item.label] ? 'Sent' : 'Not Sent'}
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

        <LettersPage
          formData={formData}
          setFormData={setFormData}
          handlePreviewMail={handlePreviewMail}
          handleSendMail={handleSendMail}
        />
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

      <DocumentsCard
        docState={docState}
        setany={setany}
        eventId={eventId}
        summary={summary}
        fullEventData={fullEventData}
        rows={rows}
        participants={participants}
      />

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

      {previewModal.show && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: '16px',
                fontSize: '18px',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '12px',
              }}
            >
              Mail Preview: {previewModal.section}
            </h3>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: '14px',
                lineHeight: '1.6',
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                color: '#334155',
              }}
            >
              {previewModal.content}
            </pre>
            <div
              style={{
                marginTop: '20px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => setPreviewModal({ ...previewModal, show: false })}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSendMail(previewModal.section);
                  setPreviewModal({ ...previewModal, show: false });
                }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: '#0f6fc6',
                  color: '#fff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Send Mail
              </button>
            </div>
          </div>
        </div>
      )}

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

interface ParticipantFeedbackResponse {
  feedbackId: number;
  registrationId: number;
  submittedAt: string;
  registrationRefNo: string;
  participantName: string;
  participantEmail: string;
  answers: Record<number, { rating_value?: number | null; answer_text?: string | null }>;
}

interface QuestionSummary {
  questionId: number;
  questionText: string;
  questionType: string;
  sectionName?: string;
  totalAnswers: number;
  averageRating?: number;
  optionCounts?: Record<string, number>;
}

interface EventFeedbackData {
  questions: any[];
  responses: ParticipantFeedbackResponse[];
  summary: {
    totalSubmissions: number;
    questionSummaries: QuestionSummary[];
  };
}
interface FeedbackProps {
  eventId?: string;
  summary?: any;
}
const Feedback: React.FC<FeedbackProps> = ({ eventId, summary: propSummary }) => {
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'configure'>('analytics');
  const [responses, setResponses] = useState<ParticipantFeedbackResponse[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [eventDetails, setEventDetails] = useState<any>(null);

  useEffect(() => {
    if (eventId) {
      authenticityUtility
        .get(`/events/${eventId}/summary`)
        .then((res: any) => {
          const data = res.data?.data || res.data || res;
          if (data) setEventDetails(data);
        })
        .catch(() => {});
    }
  }, [eventId]);

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

  const fetchFeedbackData = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    authenticityUtility
      .get(`/events/${eventId}/feedback`)
      .then((res) => {
        const d = res.data?.data;
        if (d) {
          if (Array.isArray(d.responses)) setResponses(d.responses);
          if (Array.isArray(d.questions)) setQuestions(d.questions);
          if (d.summary) setSummary(d.summary);
          if (d.eventFeedback) {
            if (d.eventFeedback.toggles)
              setEventToggles((prev) => ({ ...prev, ...d.eventFeedback.toggles }));
            if (d.eventFeedback.ratings)
              setEventRatings((prev) => ({ ...prev, ...d.eventFeedback.ratings }));
            if (d.eventFeedback.awareness) setAwarenessChannel(d.eventFeedback.awareness);
            if (d.eventFeedback.suggestion) setEventSuggestion(d.eventFeedback.suggestion);
          }
          if (Array.isArray(d.resourcePersonsFeedback) && d.resourcePersonsFeedback.length > 0) {
            setResourcePersons(d.resourcePersonsFeedback);
          }
          if (d.accommodationFeedback) {
            if (d.accommodationFeedback.ratings)
              setAccommodationRatings((prev) => ({ ...prev, ...d.accommodationFeedback.ratings }));
            if (d.accommodationFeedback.suggestion)
              setAccommodationSuggestion(d.accommodationFeedback.suggestion);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    fetchFeedbackData();
  }, [fetchFeedbackData]);

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
      fetchFeedbackData();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.details ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to submit feedback.',
      );
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

  const resolvedEventTitle =
    propSummary?.title ||
    propSummary?.name ||
    propSummary?.event_name ||
    summary?.title ||
    summary?.name ||
    summary?.event_name ||
    summary?.eventName ||
    eventDetails?.title ||
    eventDetails?.name ||
    eventDetails?.event_name ||
    '';

  return (
    <form className="feedback-container" onSubmit={handleSubmit}>
      {/* ==================== CARD 1: EVENT FEEDBACK ==================== */}
      <div className="feedback-card">
        <div className="feedback-card-header">
          <h2 className="feedback-card-title">
            {EVENT_COPY.eventFeedbackTitle}{' '}
            {resolvedEventTitle && (
              <span style={{ color: '#0069ab', fontWeight: 600, marginLeft: '6px' }}>
                {resolvedEventTitle}
              </span>
            )}
          </h2>
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
              <CustomEventSelect
                className="feedback-resource-select"
                value={rp.name}
                onChange={(e) => updateResourcePerson(rp.id, 'name', e.target.value)}
                placeholder="Name, Organization"
                options={EVENT_RESOURCE_PERSON_OPTIONS}
              />
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
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  const handlePublish = async () => {
    if (!eventId || eventId === 'new') return;
    setIsPublishing(true);
    try {
      await authenticityUtility.post(`/events/${eventId}/certificates/publish`);
      alert('Certificates published successfully!');
    } catch (err) {
      console.error('Failed to publish certificates:', err);
      alert('Failed to publish certificates.');
    } finally {
      setIsPublishing(false);
    }
  };

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

      {eventId && eventId !== 'new' && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            className="event-btn event-submit"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Submit Certificate'}
          </button>
        </div>
      )}
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
  const [searchFinanceId, setSearchFinanceId] = React.useState('');
  const [isFetchingFinance, setIsFetchingFinance] = React.useState(false);
  const [hasFetchedData, setHasFetchedData] = React.useState(false);

  const handleFetchFinanceData = async () => {
    const rawSearch = searchFinanceId.trim();
    if (!rawSearch) {
      alert('Please enter a Finance Application ID');
      return;
    }
    try {
      setIsFetchingFinance(true);

      // Extract numeric ID if formatted code like #F-2026-0081 or F-2026-0081 is entered
      const structuredMatch = rawSearch.match(/^#?F[-_]\d{4}[-_](\d+)/i);
      let fetchId = rawSearch;
      if (structuredMatch && structuredMatch[1]) {
        fetchId = parseInt(structuredMatch[1], 10).toString();
      } else {
        const digitsOnly = rawSearch.replace(/\D/g, '');
        if (digitsOnly) {
          fetchId = parseInt(digitsOnly, 10).toString();
        }
      }

      const response = (await authenticityUtility.get(
        `/finance-requests/${encodeURIComponent(fetchId)}`,
      )) as any;

      if (response && response.data) {
        const record = response.data;

        // Map Income rows
        const incomeRowsFromApi = Array.isArray(record.income_rows)
          ? record.income_rows
          : Array.isArray(record.income)
            ? record.income
            : [];
        if (incomeRowsFromApi.length > 0) {
          const mappedIncome = incomeRowsFromApi.map((row: any) => {
            const rawHead = (row.income_source || row.income_type || row.incomeHead || '').trim();
            const isStandardHead = FINANCE_INCOME_HEADS.includes(rawHead) && rawHead !== 'Others';

            return {
              id: uuidv4(),
              incomeHead: isStandardHead ? rawHead : rawHead ? 'Others' : '',
              incomeHeadOther: isStandardHead ? '' : rawHead,
              agency: row.credit_account || row.agency || row.contribution || '',
              income: (row.amount ?? row.partial_amount ?? row.contribution ?? 0).toString(),
            };
          });
          setIncomeRows(mappedIncome);
        }

        // Map Expenditure / Budget Breakup rows
        const budgetRowsFromApi = Array.isArray(record.budget)
          ? record.budget
          : Array.isArray(record.budget_breakup)
            ? record.budget_breakup
            : [];
        if (budgetRowsFromApi.length > 0) {
          const mappedExpenditure = budgetRowsFromApi.map((row: any) => {
            const rawHead = (
              row.budget_head ||
              row.category ||
              row.head ||
              row.budgetHead ||
              ''
            ).trim();
            const isStandardHead = FINANCE_BUDGET_HEADS.includes(rawHead) && rawHead !== 'Others';

            return {
              id: uuidv4(),
              budgetHead: isStandardHead ? rawHead : rawHead ? 'Others' : '',
              budgetHeadOther: isStandardHead ? '' : rawHead,
              amountProposed: (row.amount ?? row.amountProposed ?? 0).toString(),
              actualExpenditure: (
                row.actual_expenditure ??
                row.approved_amount ??
                row.amount ??
                0
              ).toString(),
              file: null,
            };
          });
          setExpenditureRows(mappedExpenditure);
        }

        setHasFetchedData(true);
        alert('Finance details fetched successfully!');
      } else {
        setHasFetchedData(false);
        alert('No data found for this Finance ID.');
      }
    } catch (err: any) {
      console.error(err);
      setHasFetchedData(false);
      alert(
        err?.response?.data?.message || 'Failed to fetch Finance details. Please check the ID.',
      );
    } finally {
      setIsFetchingFinance(false);
    }
  };

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
      <section
        className="event-finance-card event-budget-style-card"
        style={{ marginBottom: '20px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            padding: '20px',
            gap: '15px',
            alignItems: 'center',
          }}
        >
          <label style={{ fontWeight: 600, margin: 0, fontSize: '14px', color: '#475569' }}>
            Enter Finance Application ID:
          </label>
          <input
            type="text"
            placeholder="Enter ID"
            value={searchFinanceId}
            onChange={(e) => setSearchFinanceId(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              width: '220px',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            type="button"
            className="event-save-next-btn"
            onClick={handleFetchFinanceData}
            disabled={isFetchingFinance}
            style={{ padding: '8px 20px', minHeight: 'auto', opacity: isFetchingFinance ? 0.7 : 1 }}
          >
            {isFetchingFinance ? 'Fetching...' : 'Fetch'}
          </button>
        </div>
      </section>

      {hasFetchedData && (
        <>
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
                            <CustomEventSelect
                              value={row.incomeHead}
                              onChange={(e) =>
                                setIncomeRows(
                                  incomeRows.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          incomeHead: e.target.value,
                                          incomeHeadOther: '',
                                        }
                                      : r,
                                  ),
                                )
                              }
                              placeholder="-- Select --"
                              options={FINANCE_INCOME_HEADS}
                            />
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
        </>
      )}
    </div>
  );
};

// ---------------- Sponsoring Agency Section ----------------
const SponsoringAgencySection: React.FC<SponsoringAgencySectionProps> = ({ goToTab, eventId }) => {
  const [isSubmittingFinance, setIsSubmittingFinance] = useState<boolean>(false);

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
      sponsoring_agencies: [],
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

const ParticipantDetailsModal: React.FC<{
  participant: any;
  show: boolean;
  onHide: () => void;
  resolveAssetUrl: (url?: string) => string;
}> = ({ participant, show, onHide, resolveAssetUrl }) => {
  const [selectedReceipt, setSelectedReceipt] = React.useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = React.useState(false);

  if (!participant) return null;

  const profDetails = participant.profession_details
    ? typeof participant.profession_details === 'string'
      ? JSON.parse(participant.profession_details)
      : participant.profession_details
    : {};
  const teamMembers = participant.team_members
    ? typeof participant.team_members === 'string'
      ? JSON.parse(participant.team_members)
      : participant.team_members
    : [];
  const payments = participant.payments
    ? typeof participant.payments === 'string'
      ? JSON.parse(participant.payments)
      : participant.payments
    : [];

  return (
    <CustomModal
      show={show}
      onHide={onHide}
      title="Participant Registration Details"
      className="participant-details-modal"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: '0 8px',
        }}
      >
        {/* Personal Details */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1e293b' }}>
            Personal & Contact
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Name</strong>
              <div style={{ fontWeight: 500 }}>
                {participant.first_name || ''} {participant.last_name || ''}
              </div>
            </div>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Email</strong>
              <div style={{ fontWeight: 500 }}>
                {participant.contact_email || participant.email || 'N/A'}
              </div>
            </div>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Mobile</strong>
              <div style={{ fontWeight: 500 }}>{participant.mobile_number || 'N/A'}</div>
            </div>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>WhatsApp</strong>
              <div style={{ fontWeight: 500 }}>{participant.whatsapp_number || 'N/A'}</div>
            </div>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Gender</strong>
              <div style={{ fontWeight: 500 }}>{participant.gender || 'N/A'}</div>
            </div>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>DOB</strong>
              <div style={{ fontWeight: 500 }}>{participant.date_of_birth || 'N/A'}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Address</strong>
              <div style={{ fontWeight: 500 }}>
                {[
                  participant.address,
                  participant.city,
                  participant.state,
                  participant.country,
                  participant.pin,
                ]
                  .filter(Boolean)
                  .join(', ') || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Professional Details */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1e293b' }}>Professional</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Type</strong>
              <div style={{ fontWeight: 500 }}>
                {participant.profession_type || participant.category || 'N/A'}
              </div>
            </div>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Institution/Org</strong>
              <div style={{ fontWeight: 500 }}>
                {participant.prof_institution ||
                  participant.institution ||
                  profDetails.organization ||
                  'N/A'}
              </div>
            </div>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Department</strong>
              <div style={{ fontWeight: 500 }}>{participant.department || 'N/A'}</div>
            </div>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Designation</strong>
              <div style={{ fontWeight: 500 }}>{participant.designation || 'N/A'}</div>
            </div>
            <div>
              <strong style={{ color: '#64748b', fontSize: '12px' }}>Register No</strong>
              <div style={{ fontWeight: 500 }}>{participant.register_number || 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Team Details */}
        {participant.hasTeam && teamMembers.length > 0 && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1e293b' }}>
              Team Members ({teamMembers.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {teamMembers
                .sort((a: any, b: any) => a.member_order - b.member_order)
                .map((member: any, i: number) => (
                  <div
                    key={i}
                    style={{ padding: '8px', background: '#f8fafc', borderRadius: '4px' }}
                  >
                    <div style={{ fontWeight: 'bold' }}>
                      {member.name} {member.member_order === 1 ? '(Lead)' : ''}
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {member.email} | {member.organization || member.role || ''}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Document Details */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1e293b' }}>Documents</h3>
          <div style={{ display: 'flex', gap: '16px' }}>
            {participant.profile_id_card && (
              <a
                href={resolveAssetUrl(participant.profile_id_card)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0284c7', textDecoration: 'underline' }}
              >
                ID Card
              </a>
            )}
            {participant.documentUrl && participant.documentUrl !== participant.profile_id_card && (
              <a
                href={resolveAssetUrl(participant.documentUrl)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0284c7', textDecoration: 'underline' }}
              >
                Registration Document
              </a>
            )}
            {!participant.profile_id_card && !participant.documentUrl && (
              <span style={{ color: '#94a3b8' }}>No documents uploaded</span>
            )}
          </div>
        </div>

        {/* Payment Details */}
        {payments.length > 0 && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1e293b' }}>
              Payment Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {payments.map((pay: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px',
                    background: '#f8fafc',
                    borderRadius: '4px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      â‚¹{pay.amount} - {pay.status}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Txn Ref: {pay.transaction_reference || 'N/A'} | Date:{' '}
                      {pay.date ? new Date(pay.date).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  {pay.proof_file_path && (
                    <a
                      href={resolveAssetUrl(pay.proof_file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        alignSelf: 'center',
                        color: '#0284c7',
                        textDecoration: 'underline',
                        fontSize: '14px',
                      }}
                    >
                      View Receipt
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CustomModal>
  );
};

const ParticipantDetails: React.FC<ParticipantDetailsProps> = ({ eventId, summary }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedParticipantModal, setSelectedParticipantModal] = useState<any | null>(null);
  const [unsavedStatus, setUnsavedStatus] = useState<Record<number, string>>({});

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
          console.log(`[ParticipantDetails] fetched for eventId:`, eventId, `res:`, res);
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

  const resolveAssetUrl = (url?: string | null) => {
    if (!url) return '';
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('blob:') ||
      url.startsWith('data:')
    ) {
      return url;
    }
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const baseUrl = apiUrl.replace(/\/api\/?$/, '');
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  const handleViewDocument = (participant: any) => {
    let documentUrl =
      participant?.documentUrl || participant?.document_url || participant?.profile_id_card || '';

    if (!documentUrl && participant?.registration_documents) {
      try {
        const docs =
          typeof participant.registration_documents === 'string'
            ? JSON.parse(participant.registration_documents)
            : participant.registration_documents;
        documentUrl =
          docs?.documentPath ||
          docs?.filePath ||
          docs?.url ||
          docs?.[0]?.documentPath ||
          docs?.[0]?.filePath ||
          docs?.[0]?.url ||
          '';
      } catch (_e) {
        // ignore parse error
      }
    }

    if (!documentUrl) {
      setAlertNotice('No document uploaded');
      return;
    }

    window.open(resolveAssetUrl(documentUrl), '_blank', 'noopener,noreferrer');
  };

  const handleViewReceipt = (participant: any) => {
    let receiptUrl =
      participant?.receiptUrl || participant?.receipt_url || participant?.proof_file_path || '';

    if (!receiptUrl && participant?.payments) {
      try {
        const pays =
          typeof participant.payments === 'string'
            ? JSON.parse(participant.payments)
            : participant.payments;
        if (Array.isArray(pays) && pays.length > 0) {
          const validPay =
            pays.find((p: any) => p?.proof_file_path && String(p.proof_file_path).trim() !== '') ||
            pays[pays.length - 1];
          receiptUrl = validPay?.proof_file_path || '';
        }
      } catch (_e) {
        // ignore parse error
      }
    }

    if (!receiptUrl) {
      setAlertNotice('No document uploaded');
      return;
    }

    window.open(resolveAssetUrl(receiptUrl), '_blank', 'noopener,noreferrer');
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

  const toggleAttendance = (id: number, val: string) => {
    authenticityUtility
      .put(`/events/${eventId}/participants/${id}`, { attendance: val })
      .then(() => {
        setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, attendance: val } : p)));
      })
      .catch(console.error);
  };

  const toggleAction1 = (id: number) => {
    const p = participants.find((p) => p.id === id);
    if (!p) return;
    const isPresent = p.attendance === 'Present';
    const newAttendance = isPresent ? 'Absent' : 'Present';
    authenticityUtility
      .put(`/events/${eventId}/participants/${id}`, { attendance: newAttendance })
      .then(() => {
        setParticipants((prev) =>
          prev.map((p) => (p.id === id ? { ...p, attendance: newAttendance } : p)),
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
    const totalFeesSum = participants.reduce(
      (sum, p) => sum + (Number(p.fees ?? p.fee ?? 0) || 0),
      0,
    );
    return {
      registered: participants.length,
      shortlisted: participants.filter((p) => p.status === 'Shortlisted' || p.status === 'Selected')
        .length,
      selected: participants.filter((p) => p.status === 'Selected').length,
      rejected: participants.filter((p) => p.status === 'Not Selected' || p.status === 'Rejected')
        .length,
      hostel: participants.filter((p) => p.hostel === 'YES').length,
      fees: totalFeesSum.toFixed(2),
    };
  }, [participants]);

  return (
    <div className="participant-details-wrapper" style={{ width: '100%' }}>
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
              <th className="col-group">
                <Users size={18} />
              </th>
              <th className="col-doc">Doc.</th>
              <th className="col-hostel">Hostel</th>
              <th className="col-fees">Fees</th>
              <th className="col-status">Status</th>
              <th className="col-action-1">
                <UserCheckCustom />
              </th>
              <th className="col-action-2">
                <UserStarsCustom />
              </th>
              <th className="col-action-3">
                <CertificateCustom />
              </th>
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
                      <div
                        className="info-icon-wrapper"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedParticipantModal(p)}
                      >
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
                    <span
                      className={`hostel-text ${p.hostel === 'YES' ? 'yes' : 'no'}`}
                      onClick={() => toggleHostel(p.id)}
                      style={{ cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                    >
                      {p.hostel === 'YES' ? 'YES' : 'NO'}
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
                    <div
                      className="status-cell-inner"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <CustomStatusDropdown
                        value={p.status}
                        onChange={(v) => handleStatusChange(p.id, v)}
                      />
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => handleStatusChange(p.id, p.status)}
                      >
                        <circle cx="12" cy="12" r="10" fill="#00c853" />
                        <path
                          d="M8.5 12.5l2.5 2.5 5-5"
                          stroke="#ffffff"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </td>
                  <td className="col-action-1">
                    <div
                      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    >
                      <input
                        type="checkbox"
                        checked={p.attendance === 'Present'}
                        onChange={() => toggleAction1(p.id)}
                        style={{
                          cursor: 'pointer',
                          width: '16px',
                          height: '16px',
                          accentColor: '#00c853',
                          margin: 0,
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </td>
                  <td className="col-action-2">
                    <div
                      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ flexShrink: 0 }}
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke={p.hasFeedback ? '#00c853' : '#cbd5e1'}
                          strokeWidth="2.5"
                          fill="#ffffff"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="6"
                          fill={p.hasFeedback ? '#00c853' : '#cbd5e1'}
                        />
                      </svg>
                    </div>
                  </td>
                  <td className="col-action-3">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleViewDocument(p)}
                    >
                      <FileText size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ParticipantDetailsModal
        participant={selectedParticipantModal}
        show={!!selectedParticipantModal}
        onHide={() => setSelectedParticipantModal(null)}
        resolveAssetUrl={resolveAssetUrl}
      />
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
  parentId?: string;
  readOnly?: boolean;
}

interface MainEventOption {
  id: string | number;
  title: string;
  isMultiEvent: boolean | number;
  parent_id?: number | null;
}

const PreEvent: React.FC<PreEventProps> = ({
  goToTab,
  eventId,
  isSubEvent,
  parentId,
  readOnly = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedSubEventId, setSelectedSubEventId] = useState(
    isSubEvent && eventId && eventId !== 'new' ? eventId : '',
  );
  const [mainEvents, setMainEvents] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (parentId && !selectedSubEventId) {
      setSelectedSubEventId(parentId);
    }
  }, [parentId, selectedSubEventId]);

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
      host_collaborator: data.hostCollaborator,
      hostCollaborator: data.hostCollaborator,
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
        expectedParticipants: data.expectedParticipants,
        expected_participants: data.expectedParticipants,
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
      let newEventId = eventId;
      if (eventId && eventId !== 'new') {
        await authenticityUtility.put(`/events/${eventId}`, eventSubmitData);
      } else {
        const res: any = await authenticityUtility.post('/events', eventSubmitData);
        if (res && res.id) {
          newEventId = String(res.id);
        }
      }
      setAlertConfig({
        show: true,
        message:
          eventId && eventId !== 'new'
            ? 'Event updated successfully!'
            : 'Event created successfully!',
        type: 'success',
      });
      if (eventId === 'new' && newEventId !== 'new') {
        const currentParams = new URLSearchParams(location.search);
        currentParams.set('tab', 'pre-event');
        navigate(`/event/${newEventId}?${currentParams.toString()}`, { replace: true });
      } else {
        goToTab('pre-event');
      }
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
                eventId={eventId}
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
        eventId={eventId}
        title=""
        submitLabel={EVENT_COPY.submitNext}
        showHeaderActions={false}
        showExtendedSections={!isSubEvent}
        showMultiEventToggle={!isSubEvent}
        isSubEvent={isSubEvent}
        readOnly={readOnly}
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

interface GuesthouseBooking {
  id: number;
  proposal_ref?: string | null;
  applicant_name?: string | null;
  primary_head?: string | null;
  guest_details?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  has_room_allocation?: boolean | number;
  overall_status?: string | null;
}

const toDateKey = (value?: string | null) => String(value || '').slice(0, 10);

const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const formatDate = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    weekday: 'long',
  })
    .format(date)
    .replace(',', '');
};

const formatStayDate = (value?: string | null) => {
  const dateKey = toDateKey(value);
  if (!dateKey) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00`));
};

const formatStayRange = (checkIn?: string | null, checkOut?: string | null) => {
  const start = formatStayDate(checkIn);
  const end = formatStayDate(checkOut);
  if (!start) return 'Dates not specified';
  return end && end !== start ? `${start} – ${end}` : start;
};

const bookingIncludesDate = (booking: GuesthouseBooking, dateKey: string) => {
  const checkIn = toDateKey(booking.check_in_date);
  const checkOut = toDateKey(booking.check_out_date) || checkIn;
  return Boolean(checkIn && dateKey >= checkIn && dateKey <= checkOut);
};

export const EventCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar | null>(null);
  const todayKey = toLocalDateKey(new Date());
  const today = new Date();
  const [bookings, setBookings] = useState<GuesthouseBooking[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [displayDate, setDisplayDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isGuesthouseAdmin = getGuesthouseWorkflowStage(user) === 'guesthouse_admin';
  const selectedBookings = useMemo(
    () => bookings.filter((booking) => bookingIncludesDate(booking, selectedDate)),
    [bookings, selectedDate],
  );

  const bookingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    bookings.forEach((booking) => {
      const start = toDateKey(booking.check_in_date);
      const end = toDateKey(booking.check_out_date) || start;
      if (!start) return;
      const cursor = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);
      while (cursor <= last) {
        const key = toLocalDateKey(cursor);
        counts.set(key, (counts.get(key) || 0) + 1);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return counts;
  }, [bookings]);

  useEffect(() => {
    const loadBookings = async () => {
      try {
        setLoading(true);
        setError('');
        const response = (await authenticityUtility.get('/guesthouse')) as {
          items?: GuesthouseBooking[];
        };
        setBookings(Array.isArray(response?.items) ? response.items : []);
      } catch (loadError) {
        console.error('Unable to load guesthouse calendar bookings', loadError);
        setError('Unable to load guesthouse requests. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void loadBookings();
  }, []);

  const syncDisplayDate = () => {
    const date = calendarRef.current?.getApi().getDate();
    if (date) setDisplayDate(date);
  };

  const goToToday = () => {
    calendarRef.current?.getApi().today();
    setSelectedDate(todayKey);
    syncDisplayDate();
  };

  const goToPreviousMonth = () => {
    calendarRef.current?.getApi().prev();
    syncDisplayDate();
  };

  const goToNextMonth = () => {
    calendarRef.current?.getApi().next();
    syncDisplayDate();
  };

  const openBooking = (booking: GuesthouseBooking) => {
    navigate(`/guesthouse/${booking.id}${isGuesthouseAdmin ? '?allotment=true' : ''}`);
  };

  return (
    <main className="guesthouse-calendar-page">
      <section className="guesthouse-calendar-details-panel">
        <div className="guesthouse-calendar-panel-heading">
          <div>
            <h1>{formatDate(selectedDate)}</h1>
            <p>
              {selectedBookings.length} room booking request
              {selectedBookings.length === 1 ? '' : 's'} for this day
            </p>
          </div>
          <button
            type="button"
            className="guesthouse-calendar-add-button"
            onClick={() => navigate('/guesthouse/new')}
          >
            Add +
          </button>
        </div>

        {loading ? (
          <p className="guesthouse-calendar-state">Loading room booking requests…</p>
        ) : error ? (
          <p className="guesthouse-calendar-state guesthouse-calendar-state--error">{error}</p>
        ) : selectedBookings.length === 0 ? (
          <p className="guesthouse-calendar-state">No rooms booked for this day.</p>
        ) : (
          <div className="guesthouse-calendar-request-list">
            {selectedBookings.map((booking) => {
              const allocated = Boolean(booking.has_room_allocation);
              return (
                <button
                  type="button"
                  className="guesthouse-calendar-request"
                  key={booking.id}
                  onClick={() => openBooking(booking)}
                >
                  <div className="guesthouse-calendar-request-top">
                    <span>
                      <FaLayerGroup /> {booking.proposal_ref || `#GH-${booking.id}`}
                    </span>
                    <span
                      className="guesthouse-calendar-stay-dates"
                      title={formatStayRange(booking.check_in_date, booking.check_out_date)}
                    >
                      <FaRegClock />{' '}
                      {formatStayRange(booking.check_in_date, booking.check_out_date)}
                    </span>
                    <span
                      className={
                        allocated ? 'allocation-status allocated' : 'allocation-status pending'
                      }
                    >
                      {allocated ? 'Room allocated' : 'Room not allocated'}
                    </span>
                  </div>
                  <div className="guesthouse-calendar-request-bottom">
                    <span>
                      <FaBuilding />{' '}
                      {booking.applicant_name || booking.primary_head || 'Guesthouse request'}
                    </span>
                    <span>
                      <FaMapMarkerAlt /> {booking.guest_details || 'Open request details'}
                    </span>
                  </div>
                  {isGuesthouseAdmin && (
                    <span className="guesthouse-calendar-allocation-action">
                      Open room allocation →
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="guesthouse-calendar-panel">
        <h2>Calendar</h2>
        <div className="guesthouse-calendar-toolbar">
          <button type="button" onClick={goToToday}>
            Today
          </button>
          <div className="guesthouse-calendar-month-navigation">
            <button type="button" onClick={goToPreviousMonth} aria-label="Previous month">
              ‹
            </button>
            <strong>
              {displayDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </strong>
            <button type="button" onClick={goToNextMonth} aria-label="Next month">
              ›
            </button>
          </div>
        </div>
        <div className="guesthouse-calendar-grid">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={false}
            fixedWeekCount={false}
            dateClick={(info) => setSelectedDate(info.dateStr)}
            datesSet={syncDisplayDate}
            dayCellClassNames={(arg) =>
              toLocalDateKey(arg.date) === selectedDate ? 'guesthouse-calendar-selected-date' : ''
            }
            dayCellContent={(arg) => {
              const dateKey = toLocalDateKey(arg.date);
              const count = bookingCounts.get(dateKey) || 0;
              return (
                <div className="guesthouse-calendar-day-content">
                  <span>{arg.dayNumberText}</span>
                  {count > 0 && <b>{count}</b>}
                </div>
              );
            }}
          />
        </div>
      </section>
    </main>
  );
};
