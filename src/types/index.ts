// ─── Auth ──────────────────────────────────────────────────────────────────
export interface AuthUser {
  email: string
  name: string
}

// ─── Profile ───────────────────────────────────────────────────────────────
export interface PersonalDetails {
  title: string
  firstName: string
  lastName: string
  gender: string
  differentlyAbled: boolean
  dateOfBirth: string
  age: string
  mobileNumber: string
  whatsappNumber: string
  email: string
  address: string
  city: string
  state: string
  country: string
  pin: string
  photograph: string | null  // base64 or URL for persistence
}

export interface ProfessionDetails {
  professionType: string
  registerNumber: string
  degree: string
  department: string
  yearOfStudy: string
  classGrade: string
  section: string
  school: string
  parentGuardianName: string
  parentGuardianContact: string
  teacherCoordinatorName: string
  teacherCoordinatorContact: string
  designation: string
  qualification: string
  subjectHandling: string
  yearsOfExperience: string
  mode: string
  supervisorName: string
  institution: string
  institutionCategory: string
  institutionAddress: string
  institutionCity: string
  institutionState: string
  institutionCountry: string
  institutionPin: string
  organization: string
  contactFacultyName: string
  facultyMobile: string
  idCard: string | null  // base64 for persistence
  city?: string
  website?: string
  graduationYear?: string
  occupation?: string
  currentDepartment?: string
}

// ─── Events ────────────────────────────────────────────────────────────────
export type RegistrationStatus = 'pending' | 'submitted' | 'registered'
export type ReviewStatus = 'pending' | 'shortlisted' | 'selected' | 'rejected'
export type PaymentBillType = 'event registration bill' | 'accommodation bill'

export interface PaymentProof {
  billType: PaymentBillType
  screenshotName: string
  screenshotDataUrl: string
  uploadedAt: string
}

export interface RegistrationDocument {
  documentType: string
  fileName: string
  uploadedAt: string
}

export interface SubEventItem {
  id: string
  eventName: string
  participation: 'Individual' | 'Team'
  fees: number
  feesUnit: 'Team' | 'Participant'
  category?: string
}

export interface EventItem {
  id: string
  eventName: string
  category: string
  description: string
  date: string
  venue: string
  participation: 'Individual' | 'Team'
  teamSize?: string
  fees: number
  feesUnit: 'Team' | 'Participant'
  status: 'Open' | 'Closed'
  registrationStatus?: RegistrationStatus
  subEvents?: SubEventItem[]
  parentEventName?: string
}

// ─── Registration (per event) ──────────────────────────────────────────────
export interface TeamMember {
  id: string
  registeredMailId: string
  name: string
  organization: string
  role: string
}

export interface EventRegistration {
  eventId: string
  /** only present when participation === 'Team' */
  teamMembers?: TeamMember[]
  /** 'pending' while form partially filled, 'ready' when both event+team done */
  formStatus: 'pending' | 'ready'
  /** payment state */
  paymentStatus: 'unpaid' | 'processing' | 'paid'
  paymentProof?: PaymentProof | null
  document?: RegistrationDocument | null
  /** review status shown on the event card */
  reviewStatus: ReviewStatus
}

// ─── Accommodation ─────────────────────────────────────────────────────────
export interface SelectedAccommodation {
  optionId: string
  roomType: string
  nights: number
  pricePerNight: number
}

// ─── Payment Summary ───────────────────────────────────────────────────────
export interface PaymentSummary {
  selectedEvents: Array<{ id: string; name: string; amount: number; unit: string }>
  accommodation: SelectedAccommodation | null
  subtotal: number
  discount: number
  serviceFee: number
  total: number
}
