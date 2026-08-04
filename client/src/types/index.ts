import { ReactNode } from 'react';

export interface EntityRole {
  entity_id: number;
  entity_type: string;
  entity_name: string;
  role_code: string;
  role_name: string;
}

export interface User {
  id: string | number;
  email: string;
  name?: string;
  picture?: string;
  is_admin: boolean;
  is_super_admin?: boolean;
  roles?: string[];
  permissions?: string[];
  // Employee fields from master_employees
  employee_id?: number;
  erp_id?: string;
  department?: string;
  designation?: string;
  orcid_id?: string;
  scopus_id?: string;
  google_scholar_id?: string;
  author_id?: string;
  entity_roles?: EntityRole[];
}

export interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  logout: () => void;
  checkTokenExpiration: () => boolean;
  loading: boolean;
}

export interface Author {
  id?: number;
  dbAuthorId?: string;
  author_id: string;
  name: string;
  department: string;
  organization: string;
  country: string;
  state?: string;
  email?: string;
  designation: 'faculty' | 'student' | 'external';
  is_first_author: boolean;
  is_primary: boolean;
  register_no?: string;
  student_id?: string;
}

export interface Journal {
  id?: number;
  name: string;
  publisher?: string;
  printISSN?: string;
  onlineISSN?: string;
  website?: string;
  category?: string;
}

export interface ToggleField<T = string> {
  enabled: boolean;
  value?: T;
  filePath?: string;
  file?: File | null;
}

export interface FileUpload {
  enabled?: boolean;
  filePath?: string;
  file?: File | null;
}

export interface FinancialContribution {
  id?: number;
  agencyType: string;
  agency: string;
  amount: string | number;
  agencyTypeSearchTerm?: string;
  agencySearchTerm?: string;
}

export interface GrantDisbursement {
  id?: number;
  installmentNo: string | number;
  amount: string | number;
  dateReceived: string;
  utilizationCertificate?: FileUpload;
  statementOfExpenditure?: FileUpload;
}

export interface Collaboration {
  id?: number;
  type: string;
  name: string;
  country?: string;
}

export interface Investigator extends Author {
  is_principal: boolean;
}

export type EditRequestStatus = 'pending' | 'approved' | 'rejected' | 'none' | null;

export interface StatusUpdate {
  id: number;
  status: string;
  comments?: string;
  updated_at: string;
  updated_by?: string;
}

export interface Event {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  venue?: string;
  status: string;
}

export interface ChildrenProps {
  children: ReactNode;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
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
export type ReviewStatus = 'pending' | 'shortlisted' | 'selected' | 'rejected';
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
}

export interface SubEventItem {
  id: string;
  eventName: string;
  participation: 'Individual' | 'Team';
  fees: number;
  feesUnit: 'Team' | 'Participant';
  category?: string;
}

export interface EventItem {
  id: string;
  eventName: string;
  category: string;
  description: string;
  date: string;
  venue: string;
  participation: 'Individual' | 'Team';
  teamSize?: string;
  fees: number;
  feesUnit: 'Team' | 'Participant';
  status: 'Open' | 'Closed';
  registrationStatus?: RegistrationStatus;
  subEvents?: SubEventItem[];
  parentEventName?: string;
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
}

// ─── Accommodation ─────────────────────────────────────────────────────────
export interface SelectedAccommodation {
  optionId: string;
  roomType: string;
  nights: number;
  pricePerNight: number;
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
