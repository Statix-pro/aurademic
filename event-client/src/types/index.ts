// ─── Auth ──────────────────────────────────────────────────────────────────
export interface AuthUser {
  email: string;
  name: string;
}

// ─── Profile ───────────────────────────────────────────────────────────────
export interface PersonalDetails {
  title: string;
  firstName: string;
  lastName: string;
  gender: string;
  differentlyAbled: boolean;
  dateOfBirth: string;
  age: string;
  mobileNumber: string;
  whatsappNumber: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pin: string;
  photograph: string | null; // base64 or URL for persistence
}

export interface ProfessionDetails {
  professionType: string;
  registerNumber: string;
  degree: string;
  department: string;
  yearOfStudy: string;
  classGrade: string;
  section: string;
  school: string;
  parentGuardianName: string;
  parentGuardianContact: string;
  teacherCoordinatorName: string;
  teacherCoordinatorContact: string;
  designation: string;
  qualification: string;
  subjectHandling: string;
  yearsOfExperience: string;
  mode: string;
  supervisorName: string;
  institution: string;
  institutionCategory: string;
  institutionAddress: string;
  institutionCity: string;
  institutionState: string;
  institutionCountry: string;
  institutionPin: string;
  organization: string;
  contactFacultyName: string;
  facultyMobile: string;
  idCard: string | null; // base64 for persistence
  city?: string;
  website?: string;
  graduationYear?: string;
  occupation?: string;
  currentDepartment?: string;
}

// ─── Events ────────────────────────────────────────────────────────────────
export type RegistrationStatus = 'pending' | 'submitted' | 'registered';
export type ReviewStatus =
  | 'Pending'
  | 'Shortlisted'
  | 'Selected'
  | 'Rejected'
  | 'Not Selected'
  | 'pending'
  | 'shortlisted'
  | 'selected'
  | 'rejected';
export type PaymentBillType = 'event registration bill' | 'accommodation bill';

export interface PaymentProof {
  billType: PaymentBillType;
  screenshotName: string;
  screenshotDataUrl: string;
  uploadedAt: string;
}

export interface RegistrationDocument {
  documentType: string;
  fileName: string;
  uploadedAt: string;
  /**
   * Base64 preview of the uploaded document, kept only while registrations are
   * held in localStorage. Drops out once uploads go to the server via Multer.
   */
  dataUrl?: string;
}

export interface SubEventItem {
  id: string;
  eventName: string;
  participation: 'Individual' | 'Team';
  fees: number;
  feesUnit: 'Team' | 'Participant';
  category?: string;
  documentEnabled?: boolean;
  documentName?: string;
  documentType?: string;
  documentSize?: string;
  documentTextFieldEnabled?: boolean;
}

export interface EventItem {
  id: string;
  eventName: string;
  category: string;
  description: string;
  date: string;
  fromDate?: string;
  toDate?: string;
  venue: string;
  participation: 'Individual' | 'Team';
  teamSize?: string;
  /** Lowest applicable fee. Use feeRange when the exact type is unknown. */
  fees: number;
  /** Fees vary by participant type, so the public list carries a range. */
  feeRange?: { min: number; max: number };
  feesUnit: 'Team' | 'Participant';
  status: 'Open' | 'Closed' | 'Upcoming';
  startDate?: string | null;
  endDate?: string | null;
  end_date?: string | null;
  lastDate?: string | null;
  last_date?: string | null;
  registrationClosesAt?: string | null;
  registrationStatus?: RegistrationStatus;
  subEvents?: SubEventItem[];
  parentEventName?: string;
  deadline?: string;
  hasAccommodation?: boolean;
  hasRegistrationFee?: boolean;
  documentEnabled?: boolean;
  documentName?: string;
  documentType?: string;
  documentSize?: string;
  documentTextFieldEnabled?: boolean;
  shortlistingRequired?: boolean;
  selectionIntimation?: string | null;
  feedbackEnabled?: boolean;
  certificateEnabled?: boolean;
  coordinators?: {
    name: string;
    designation: string;
    mobile: string;
    department: string;
    email: string;
  }[];
}

// ─── Registration (per event) ──────────────────────────────────────────────
export interface TeamMember {
  id: string;
  registeredMailId: string;
  name: string;
  organization: string;
  role: string;
}

export interface EventRegistration {
  eventId: string;
  /** only present when participation === 'Team' */
  teamMembers?: TeamMember[];
  /** 'pending' while form partially filled, 'ready' when both event+team done */
  formStatus: 'pending' | 'ready';
  /** payment state */
  paymentStatus: 'unpaid' | 'processing' | 'paid';
  paymentProof?: PaymentProof | null;
  document?: RegistrationDocument | null;
  /** review status shown on the event card */
  reviewStatus: ReviewStatus;
  shortlistingRequired?: boolean;
  selectionIntimation?: string | null;
  updatedAt?: string;
  backendId?: number;
  hasFeedback?: boolean;
  attendance?: string;
  adminFeedback?: { text: string };
  certificateRefNo?: string | null;
}

// ─── Accommodation ─────────────────────────────────────────────────────────
export interface SelectedAccommodation {
  optionId: string;
  roomType: string;
  nights: number;
  /**
   * Total payable for the whole stay, across every room and night — NOT a
   * nightly rate. It was called `pricePerNight` while carrying this value, which
   * invited call sites to multiply it by `nights` and charge the stay twice.
   */
  amount: number;
}

// ─── Payment Summary ───────────────────────────────────────────────────────
export interface PaymentSummary {
  selectedEvents: Array<{ id: string; name: string; amount: number; unit: string }>;
  accommodation: SelectedAccommodation | null;
  subtotal: number;
  discount: number;
  serviceFee: number;
  total: number;
}
