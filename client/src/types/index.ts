import { ReactNode } from 'react';

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
