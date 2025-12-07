import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface DbResult extends ResultSetHeader {}

export interface User extends RowDataPacket {
  id: number;
  email: string;
  name: string;
  picture?: string;
  is_admin: boolean; // mapped from tinyint(1)
  created_at?: Date;
  last_login?: Date;
}

// --- Research Schema ---

export interface JournalOption extends RowDataPacket {
  id: number;
  journal_name: string;
  publisher?: string;
  website?: string;
  print_issn?: string;
  online_issn?: string;
  category: 'National' | 'International';
  created_at?: Date;
  updated_at?: Date;
}

export interface Journal extends RowDataPacket {
  id: number;
  category: string;
  title: string;
  book_chapter_title?: string;
  publication_details?: any; // JSON
  type: string;
  quartile?: string;
  impact_factor?: number;
  cite_score?: number;
  anna_university_listed?: number; // tinyint(1) -> boolean/number
  anna_university_annexure_no?: string;
  acknowledgement?: any; // JSON
  date_of_submission?: Date | string;
  status?: string;
  volume?: string;
  issue?: string;
  issue_type?: string;
  pages_from?: number;
  pages_to?: number;
  article_number?: string;
  abstract?: string;
  keywords?: string;
  sdgs?: any; // JSON
  doi?: string;
  accepted_date?: Date | string;
  available_online_date?: Date | string;
  file_path?: string;
  author_affiliation?: any; // JSON
  external_details?: any; // JSON
  journal_options_id: number;
  driven_by?: 'faculty' | 'student';
  credit_to?: string;
  reference_number?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Author extends RowDataPacket {
  id: number;
  email?: string;
  author_id?: string;
  designation?: string;
  name: string;
  department?: string;
  organization?: string;
  country?: string;
  state?: string;
  student_ref?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface AuthorJournal extends RowDataPacket {
  id: number;
  author_id: number;
  journal_id: number;
  is_first_author: number; // tinyint
  is_primary: number; // tinyint
  created_at?: Date;
}

export interface ResearchProject extends RowDataPacket {
  id: number;
  project_category: string;
  category: string;
  title: string;
  duration_years?: number;
  duration_months?: number;
  duration_days?: number;
  date_of_submission?: Date | string;
  submission_status?: string;
  is_collaboration_enabled?: number;
  file_path?: string;
  application_number?: string;
  agency_id?: number;
  scheme_id?: number;
  created_at?: Date;
  updated_at?: Date;
}

// --- Event Management Schema ---

export interface Event extends RowDataPacket {
  id: number;
  title: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  created_at?: Date;
  updated_at?: Date;
}

export interface PreEvent extends RowDataPacket {
  id: number;
  title: string;
  start_date?: Date | string;
  end_date?: Date | string;
  inaugural_date?: Date | string;
  inaugural_time?: string;
  inaugural_venue?: string;
  valedictory_date?: Date | string;
  valedictory_time?: string;
  valedictory_venue?: string;
  mode?: 'Physical' | 'Virtual' | 'Hybrid';
  meeting_link?: string;
  level?: 'international' | 'national' | 'state' | 'district' | 'intra_college';
  description?: string;
  expected_participants?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface Budget extends RowDataPacket {
    id: number;
    pre_event_id: number;
    head: string;
    amount: number;
}

export interface Coordinator extends RowDataPacket {
    id: number;
    pre_event_id: number;
    name: string;
    email?: string;
    department?: string;
    mobile?: string;
    phone?: string;
}

export interface EventType extends RowDataPacket {
    id: number;
    pre_event_id: number;
    type_name: string;
}

export interface ResourcePerson extends RowDataPacket {
    id: number;
    event_id: number;
    name: string;
    designation: string;
    organization: string;
    email: string;
    linkedin: string;
    location?: string;
}
