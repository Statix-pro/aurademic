import {
  Smartphone,
  Mail,
  Linkedin,
  Image,
  FileText,
  Lock,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import './ResourcePersonDirectory.css';
import RegionFields from '../../shared/components/RegionFields';
import AlertModal from '../../shared/components/ui/AlertModal';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomDropdown from '../../shared/components/ui/CustomDropdown';
import CustomFileUploader from '../../shared/components/ui/CustomFileUploader';
import CustomInput from '../../shared/components/ui/CustomInput';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import { DEFAULT_COUNTRY } from '../../shared/utils/regions';

import type { Organization } from '../organizationdirectory/OrganizationDirectory';

/* ─── Types ─────────────────────────────────────────────── */

export interface ProfessionDetail {
  id?: string;
  designation: string;
  department: string;
  organization: string;
  /** The picked organization; null for older free text that names none. */
  organizationId?: number | null;
  /** Its approval state, from the server; a Pending or Rejected one holds the record. */
  organizationStatus?: 'Pending' | 'Approved' | 'Rejected' | null;
  city: string;
  state: string;
  country: string;
  orgLinkedIn: string;
  /** The post's official email: the person's own institutional address or a role mailbox. */
  officialEmail: string;
  status: string; // 'Working' | 'Relieved'
}

export interface ResourcePerson {
  id: number;
  title: string;
  firstName: string;
  lastName: string;
  name: string;
  gender: string;
  dob: string;
  status: string; // 'In Service' | 'Retired' | 'Inactive'
  category: string;
  tag: string;
  /** Picked from the Directory Admin's Specialization list. */
  specializations: string[];
  mobile: string;
  personalEmail: string;
  linkedIn: string;
  professions: ProfessionDetail[];
  photoName?: string;
  photoPath?: string;
  resumeName?: string;
  resumePath?: string;
  photoFile?: File;
  resumeFile?: File;
  /** Set on save when the owner removed the stored file without choosing a new one. */
  removePhoto?: boolean;
  removeResume?: boolean;
  date: string;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  isOwner?: boolean;
  /** Set by the server when this viewer may not see the contact details. */
  contactHidden?: boolean;
  /** Who added the record, so a reader can ask them about it. */
  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
  /** On the submitter's own records: organizations that keep it from being approved. */
  organizationHolds?: { name: string; status: 'Pending' | 'Rejected' }[];
}

interface ResourcePersonDirectoryProps {
  editingPerson: ResourcePerson | null;
  organizations?: Organization[];
  /** Opens an "add organization" flow; `onCreated` receives the organization it saved. */
  onAddOrganization?: (onCreated: (organization: Organization) => void) => void;
  onSave: (personData: Omit<ResourcePerson, 'id' | 'date'>) => void;
  onCancel: () => void;
  readOnly?: boolean;
}

export const CATEGORY_OPTIONS = [
  'Academic',
  'Industry',
  'Scientist',
  'Administration',
  'Incubation',
  'Government',
  'Entrepreneur',
  'Alumni',
  'Social Activist',
  'Others',
];

const ADD_ORGANIZATION_VALUE = '__add_organization__';

const newProfessionId = (): string => crypto.randomUUID();

const emptyProfession = (): ProfessionDetail => ({
  id: newProfessionId(),
  designation: '',
  department: '',
  organization: '',
  organizationId: null,
  organizationStatus: null,
  city: '',
  state: '',
  country: DEFAULT_COUNTRY,
  orgLinkedIn: '',
  officialEmail: '',
  status: 'Working',
});

// Stands in for a contact the server withheld; no part of the real value reaches the page.
const HIDDEN_CONTACT = '••••••••••';
const CONTACT_LOCK_TITLE = 'Private: visible only to the submitter and admins';

const ContactLock: React.FC = () => (
  <span className="rpd-contact-lock" title={CONTACT_LOCK_TITLE} aria-label={CONTACT_LOCK_TITLE}>
    <Lock size={14} aria-hidden="true" />
  </span>
);

// Every single-line control sits on --control-height, as on the project form;
// CustomDropdown's own default is 45px.
const customDropdownStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: 'var(--control-height)',
    height: 'var(--control-height)',
    backgroundColor: '#ffffff',
    borderColor: state.isFocused ? '#0069ab' : '#dbeafe',
    borderRadius: '12px',
    fontSize: 'var(--font-size-body)',
    padding: '0 4px',
    boxShadow: state.isFocused ? '0 0 0 4px rgba(0, 105, 171, 0.12)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#0069ab' : '#0069ab',
    },
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
    padding: '0 10px',
  }),
  // Text per AGENTS.md typography: 14px, primary-text colour.
  container: (provided: any) => ({ ...provided, fontSize: 'var(--font-size-body)' }),
  singleValue: (provided: any) => ({ ...provided, color: 'var(--text-body)' }),
  indicatorsContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
};

// Several picks stay on one line and scroll sideways, so the field never grows taller
// than the Tag dropdown beside it.
const specializationDropdownStyles = {
  ...customDropdownStyles,
  valueContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
    padding: '0 10px',
    flexWrap: 'nowrap',
    overflowX: 'auto',
  }),
  multiValue: (provided: any) => ({ ...provided, flexShrink: 0, borderRadius: '6px' }),
  // A read-only view shows the picks without the remove button they could not use.
  multiValueRemove: (provided: any, state: any) =>
    state.selectProps.isDisabled ? { display: 'none' } : provided,
  multiValueLabel: (provided: any) => ({
    ...provided,
    fontSize: 'var(--font-size-secondary)',
    color: 'var(--text-body)',
  }),
};

interface ListOption {
  list_key: 'tag' | 'specialization';
  name: string;
}

/** A stored value the list no longer offers is still shown, so an edit never drops it. */
const toOptions = (names: string[], selected: string[]) =>
  [...names, ...selected.filter((value) => value && !names.includes(value))].map((name) => ({
    value: name,
    label: name,
  }));

const titleDropdownStyles = {
  ...customDropdownStyles,
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: 'var(--control-height)',
    height: 'var(--control-height)',
    backgroundColor: '#ffffff',
    borderColor: state.isFocused ? '#0069ab' : '#dbeafe',
    borderRadius: '12px',
    fontSize: 'var(--font-size-body)',
    padding: '0 2px',
    boxShadow: state.isFocused ? '0 0 0 4px rgba(0, 105, 171, 0.12)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#0069ab' : '#0069ab',
    },
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
    padding: '0 4px',
  }),
  dropdownIndicator: (provided: any) => ({
    ...provided,
    padding: '2px',
  }),
};

// Uploads are served by the API server, not the Vite origin.
const uploadUrl = (filePath?: string): string | undefined =>
  filePath
    ? `${authenticityUtility.getBaseURL().replace(/\/$/, '')}/${filePath.replace(/^\/+/, '')}`
    : undefined;

/* ═══════════════════════════════════════════════════════════
   Form Component
   ═══════════════════════════════════════════════════════════ */

const ResourcePersonDirectory: React.FC<ResourcePersonDirectoryProps> = ({
  editingPerson,
  organizations = [],
  onAddOrganization,
  onSave,
  onCancel,
  readOnly = false,
}) => {
  const isReadOnly = readOnly;
  const contactHidden = Boolean(editingPerson?.contactHidden);

  /* form fields */
  const [category, setCategory] = useState('Academic');
  const [title, setTitle] = useState('Dr.');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [serviceStatus, setServiceStatus] = useState('In Service');
  const [tag, setTag] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [listNames, setListNames] = useState<{ tag: string[]; specialization: string[] }>({
    tag: [],
    specialization: [],
  });
  const [listError, setListError] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [professions, setProfessions] = useState<ProfessionDetail[]>([emptyProfession()]);
  const [photoName, setPhotoName] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | undefined>(undefined);
  const [resumeFile, setResumeFile] = useState<File | undefined>(undefined);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [removeResume, setRemoveResume] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showNameAlert, setShowNameAlert] = useState(false);

  /* Initialize form values */
  useEffect(() => {
    if (editingPerson) {
      setCategory(editingPerson.category || 'Academic');
      setTitle(editingPerson.title || 'Dr.');
      setFirstName(editingPerson.firstName || '');
      setLastName(editingPerson.lastName || '');
      setGender(editingPerson.gender || 'Male');
      setDob(editingPerson.dob || '');
      setServiceStatus(editingPerson.status || 'In Service');
      setTag(editingPerson.tag || '');
      setSpecializations(editingPerson.specializations || []);
      setMobile(editingPerson.mobile || '');
      setPersonalEmail(editingPerson.personalEmail || '');
      setLinkedIn(editingPerson.linkedIn || '');
      setProfessions(
        editingPerson.professions?.length
          ? editingPerson.professions.map((p) => ({
              // The server sends empty columns as null; every input here stays controlled.
              ...emptyProfession(),
              ...Object.fromEntries(Object.entries(p).filter(([, value]) => value !== null)),
              country: p.country || DEFAULT_COUNTRY,
              id: p.id || newProfessionId(),
            }))
          : [emptyProfession()],
      );
      setPhotoName(editingPerson.photoName || '');
      setResumeName(editingPerson.resumeName || '');
    }
    setRemovePhoto(false);
    setRemoveResume(false);
  }, [editingPerson]);

  // Tag and Specialization come from the Directory Admin's lists; a read-only view shows
  // the stored values and needs no list.
  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    authenticityUtility
      .get('/resource-person-options')
      .then((response: any) => {
        if (cancelled) return;
        const rows: ListOption[] = response?.data || [];
        setListNames({
          tag: rows.filter((row) => row.list_key === 'tag').map((row) => row.name),
          specialization: rows
            .filter((row) => row.list_key === 'specialization')
            .map((row) => row.name),
        });
        setListError(null);
      })
      .catch((err: any) => {
        if (!cancelled)
          setListError(err?.message || 'Failed to load the Tag and Specialization lists.');
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  /* ── Profession helpers ── */
  const addProfession = () =>
    setProfessions((prev) => [...prev, { ...emptyProfession(), status: 'Relieved' }]);
  const removeProfession = (i: number) =>
    setProfessions((prev) => prev.filter((_, idx) => idx !== i));
  const changeProfession = (i: number, field: keyof ProfessionDetail, val: string) =>
    setProfessions((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));
  // Picking an organization copies its address and website into the row, replacing what
  // was there so a switch never leaves the previous organization's city behind. The
  // fields stay editable. The Website input is stored as orgLinkedIn.
  const selectOrganization = (i: number, organization: Organization) =>
    setProfessions((prev) =>
      prev.map((p, idx) =>
        idx === i
          ? {
              ...p,
              organization: organization.name,
              organizationId: organization.id,
              organizationStatus: organization.approvalStatus ?? null,
              city: organization.city || '',
              state: organization.state || '',
              country: organization.country || DEFAULT_COUNTRY,
              orgLinkedIn: organization.website || '',
            }
          : p,
      ),
    );
  // A Rejected organization is never offered. The submitter's own Pending one is (Add an
  // organization selects it straight away), marked so it reads as not yet in the directory;
  // the resource person cannot be approved until it is.
  const organizationOptions = [
    ...organizations
      .filter((organization) => organization.approvalStatus !== 'Rejected')
      .map((organization) => ({
        value: String(organization.id),
        label:
          organization.approvalStatus === 'Pending'
            ? `${organization.name} (Pending)`
            : organization.name,
      })),
    ...(onAddOrganization
      ? [{ value: ADD_ORGANIZATION_VALUE, label: 'Add an organization...' }]
      : []),
  ];

  /* ── File handlers ── */
  const handlePhoto = (f: File) => {
    if (f) {
      const extension = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png'];
      // The server requires both a matching extension and MIME type, so check both here.
      const validMime = ['image/jpeg', 'image/png'].includes(f.type);
      if (!validMime || !validExtensions.includes(extension)) {
        // A rejected pick leaves the current file as it was, so the form never shows
        // "no file" while the stored one is kept.
        setFileError('Invalid photo file type. Please select a JPG, JPEG, or PNG image.');
        return;
      }
      if (f.size > 2 * 1024 * 1024) {
        setFileError('Photo must be less than 2 MB');
        return;
      }
      setFileError(null);
      setPhotoName(f.name);
      setPhotoFile(f);
    }
  };
  const handleResume = (f: File) => {
    if (f) {
      const extension = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      const validExtensions = ['.pdf', '.doc', '.docx'];
      const isDoc =
        f.type === 'application/msword' ||
        f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isPdf = f.type === 'application/pdf';
      if ((!isPdf && !isDoc) || !validExtensions.includes(extension)) {
        setFileError('Invalid resume file type. Please select a PDF, DOC, or DOCX document.');
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setFileError('Resume must be less than 5 MB');
        return;
      }
      setFileError(null);
      setResumeName(f.name);
      setResumeFile(f);
    }
  };

  // Removing a newly chosen file goes back to the stored one; removing the stored one
  // marks it for deletion on save. Nothing is deleted until the record is saved.
  const handleRemovePhoto = () => {
    setFileError(null);
    if (photoFile) {
      setPhotoFile(undefined);
      setPhotoName(removePhoto ? '' : editingPerson?.photoName || '');
      return;
    }
    setPhotoName('');
    setRemovePhoto(Boolean(editingPerson?.photoPath));
  };
  const handleRemoveResume = () => {
    setFileError(null);
    if (resumeFile) {
      setResumeFile(undefined);
      setResumeName(removeResume ? '' : editingPerson?.resumeName || '');
      return;
    }
    setResumeName('');
    setRemoveResume(Boolean(editingPerson?.resumePath));
  };

  const handleSubmit = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setShowNameAlert(true);
      return;
    }
    const fullName = `${title} ${firstName.trim()} ${lastName.trim()}`;
    const filteredProfessions = professions.filter((p) => {
      const d = (p.designation || '').trim();
      const dept = (p.department || '').trim();
      const org = (p.organization || '').trim();
      const c = (p.city || '').trim();
      const s = (p.state || '').trim();
      const co = (p.country || '').trim();
      const email = (p.officialEmail || '').trim();
      return (
        d !== '' || dept !== '' || org !== '' || c !== '' || s !== '' || co !== '' || email !== ''
      );
    });

    onSave({
      title,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: fullName,
      gender,
      dob,
      status: serviceStatus,
      category,
      tag: tag.trim() || 'General',
      specializations,
      mobile: mobile.trim(),
      personalEmail: personalEmail.trim(),
      linkedIn: linkedIn.trim(),
      // An empty list, not a blank row: the server stores every entry it receives,
      // and the form already shows one blank row when it loads an empty list.
      professions: filteredProfessions.map((p) => ({ ...p })),
      photoName,
      resumeName,
      photoFile,
      resumeFile,
      // Left out when false: a new file already replaces the stored one.
      removePhoto: removePhoto && !photoFile ? true : undefined,
      removeResume: removeResume && !resumeFile ? true : undefined,
    });
  };

  return (
    <div className="rpd-form-wrapper">
      {/* Category Card */}
      <div className="budget-style-card category-card">
        <div className="budget-card-header">
          <h5>Category</h5>
        </div>
        <div className="budget-card-content">
          <div className="category-chips-row">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-chip-btn${category === cat ? ' active' : ''}`}
                onClick={() => !isReadOnly && setCategory(cat)}
                style={isReadOnly ? { pointerEvents: 'none', opacity: 0.8 } : undefined}
                disabled={isReadOnly}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Personal Details Card */}
      <div className="budget-style-card personal-card">
        <div className="budget-card-header">
          <h5>Personal Details</h5>
        </div>
        <div className="budget-card-content">
          <div className="rpd-split-row">
            {/* Left panel - Personal fields */}
            <div
              className="rpd-split-main"
              style={{ borderRight: '1px solid #eef2f6', paddingRight: '20px' }}
            >
              <div className="personal-name-grid">
                <div className="rpd-field">
                  <label>Title</label>
                  <CustomDropdown
                    name="title"
                    className="mb-0"
                    value={title ? { value: title, label: title } : null}
                    onChange={(val: any) => setTitle(val ? String(val.value) : '')}
                    options={['Dr.', 'Mr.', 'Ms.', 'Mrs.', 'Prof.'].map((t) => ({
                      value: t,
                      label: t,
                    }))}
                    placeholder=""
                    styles={titleDropdownStyles}
                    isDisabled={isReadOnly}
                  />
                </div>
                <div className="rpd-field">
                  <label htmlFor="rp-firstName">
                    First Name <span className="rpd-req">*</span>
                  </label>
                  <CustomInput
                    name="rp-firstName"
                    value={firstName}
                    onChange={setFirstName}
                    placeholder="First name"
                    disabled={isReadOnly}
                    required
                    className="mb-0"
                  />
                </div>
                <div className="rpd-field">
                  <label htmlFor="rp-lastName">
                    Last Name <span className="rpd-req">*</span>
                  </label>
                  <CustomInput
                    name="rp-lastName"
                    value={lastName}
                    onChange={setLastName}
                    placeholder="Last name"
                    disabled={isReadOnly}
                    required
                    className="mb-0"
                  />
                </div>
              </div>
              <div className="rpd-grid-3 rpd-choice-row">
                <div className="rpd-field">
                  <label>Gender</label>
                  <div className="rpd-toggle-group">
                    {['Male', 'Female', 'Others'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`rpd-toggle-btn${gender === g ? ' active' : ''}`}
                        onClick={() => !isReadOnly && setGender(g)}
                        style={isReadOnly ? { pointerEvents: 'none' } : undefined}
                        disabled={isReadOnly}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rpd-field">
                  <label htmlFor="rp-dob" className="rpd-locked-label">
                    Date of Birth
                    <ContactLock />
                  </label>
                  <CustomInput
                    name="rp-dob"
                    // A date input cannot show the dots, so a withheld date is plain text.
                    type={contactHidden ? 'text' : 'date'}
                    value={contactHidden ? HIDDEN_CONTACT : dob}
                    onChange={setDob}
                    disabled={isReadOnly}
                    className="mb-0"
                  />
                </div>
                <div className="rpd-field">
                  <label>Status</label>
                  <div className="rpd-toggle-group">
                    {['In Service', 'Retired', 'Inactive'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`rpd-toggle-btn${serviceStatus === s ? ' active' : ''}`}
                        onClick={() => !isReadOnly && setServiceStatus(s)}
                        style={isReadOnly ? { pointerEvents: 'none' } : undefined}
                        disabled={isReadOnly}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rpd-grid-2">
                <div className="rpd-field">
                  <label>Tag</label>
                  <CustomDropdown
                    name="rp-tag"
                    className="mb-0"
                    value={tag ? { value: tag, label: tag } : null}
                    onChange={(option: any) => setTag(option ? String(option.value) : '')}
                    options={toOptions(listNames.tag, [tag])}
                    placeholder="Select tag"
                    styles={customDropdownStyles}
                    isDisabled={isReadOnly}
                    isClearable
                    error={listError || undefined}
                  />
                </div>
                <div className="rpd-field">
                  <label>Specialization</label>
                  <CustomDropdown
                    name="rp-specializations"
                    className="mb-0"
                    isMulti
                    value={specializations.map((name) => ({ value: name, label: name }))}
                    onChange={(options: any) =>
                      setSpecializations((options || []).map((option: any) => String(option.value)))
                    }
                    options={toOptions(listNames.specialization, specializations)}
                    placeholder="Select specializations"
                    styles={specializationDropdownStyles}
                    isDisabled={isReadOnly}
                  />
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="rpd-split-side" style={{ paddingLeft: '8px' }}>
              <h5 className="rpd-subsection-title" style={{ marginBottom: '4px' }}>
                Contact Details
              </h5>

              <div className="rpd-field">
                <div className="rpd-input-icon">
                  <Smartphone size={15} />
                  <CustomInput
                    label="Mobile number"
                    name="rp-mobile"
                    type="tel"
                    value={contactHidden ? HIDDEN_CONTACT : mobile}
                    onChange={setMobile}
                    placeholder="Mobile number"
                    disabled={isReadOnly}
                    className="mb-0"
                  />
                  <ContactLock />
                </div>
              </div>

              <div className="rpd-field">
                <div className="rpd-input-icon">
                  <Mail size={15} />
                  <CustomInput
                    label="Personal email"
                    name="rp-personalEmail"
                    type="email"
                    value={contactHidden ? HIDDEN_CONTACT : personalEmail}
                    onChange={setPersonalEmail}
                    placeholder="Personal email"
                    disabled={isReadOnly}
                    className="mb-0"
                  />
                  <ContactLock />
                </div>
              </div>

              <div className="rpd-field">
                <div className="rpd-input-icon">
                  <Linkedin size={15} />
                  <CustomInput
                    label="LinkedIn Profile"
                    name="rp-linkedIn"
                    type="url"
                    value={linkedIn}
                    onChange={setLinkedIn}
                    placeholder="LinkedIn URL"
                    disabled={isReadOnly}
                    className="mb-0"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* end rpd-split-row */}

          <hr className="rpd-divider rpd-divider--dark" style={{ margin: '24px 0' }} />

          {/* Profession Details */}
          <div style={{ marginBottom: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h5 className="rpd-subsection-title" style={{ margin: 0 }}>
                Profession Details
              </h5>
              {!isReadOnly && (
                <CustomButton
                  variant="link"
                  onClick={addProfession}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#0069ab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                  title="Add Record"
                  aria-label="Add Record"
                >
                  <PlusCircle size={22} />
                </CustomButton>
              )}
            </div>

            <div className="rpd-profession-container">
              {professions.map((prof, idx) => (
                <div
                  key={prof.id}
                  className="rpd-profession-block"
                  style={{ padding: '16px 14px' }}
                >
                  {idx > 0 && <hr className="rpd-divider" style={{ margin: '10px 0' }} />}
                  <div className="rpd-grid-3 rpd-mb-s">
                    {(
                      [
                        { label: 'Designation', field: 'designation', ph: 'e.g. Professor' },
                        { label: 'Department', field: 'department', ph: 'e.g. Computer Science' },
                      ] as { label: string; field: keyof ProfessionDetail; ph: string }[]
                    ).map(({ label, field, ph }) => (
                      <div key={field} className="rpd-field" style={{ marginBottom: 0 }}>
                        <CustomInput
                          label={label}
                          name={`rp-${field}-${idx}`}
                          value={prof[field]}
                          onChange={(value) => changeProfession(idx, field, value)}
                          placeholder={ph}
                          disabled={isReadOnly}
                          className="mb-0"
                        />
                      </div>
                    ))}
                    <div className="rpd-field" style={{ marginBottom: 0 }}>
                      <div className="d-flex justify-content-between align-items-start">
                        <label>Organization</label>
                        {prof.organizationStatus === 'Pending' && (
                          <span className="rpd-org-status pending">Pending approval</span>
                        )}
                        {prof.organizationStatus === 'Rejected' && (
                          <span className="rpd-org-status rejected">Rejected — choose another</span>
                        )}
                      </div>
                      <CustomDropdown
                        name={`organization-${idx}`}
                        className="mb-0"
                        value={
                          prof.organizationId
                            ? (organizationOptions.find(
                                (option) => option.value === String(prof.organizationId),
                              ) ?? { value: String(prof.organizationId), label: prof.organization })
                            : prof.organization
                              ? { value: prof.organization, label: prof.organization }
                              : null
                        }
                        onChange={(option: any) => {
                          if (option?.value === ADD_ORGANIZATION_VALUE) {
                            // The flow saves the organization and hands it back, so only this
                            // row changes and the rest of the unsaved form stays as it is.
                            onAddOrganization?.((organization) =>
                              selectOrganization(idx, organization),
                            );
                            return;
                          }
                          const picked = option
                            ? organizations.find(
                                (organization) => String(organization.id) === option.value,
                              )
                            : undefined;
                          if (picked) {
                            selectOrganization(idx, picked);
                            return;
                          }
                          setProfessions((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    organization: '',
                                    organizationId: null,
                                    organizationStatus: null,
                                  }
                                : p,
                            ),
                          );
                        }}
                        options={organizationOptions}
                        placeholder="Select organization"
                        styles={customDropdownStyles}
                        isDisabled={isReadOnly}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-end',
                      flexWrap: 'wrap',
                      marginTop: '10px',
                    }}
                  >
                    <div
                      className="rpd-field"
                      style={{ flex: '1', minWidth: '120px', marginBottom: 0 }}
                    >
                      <CustomInput
                        label="City"
                        name={`rp-city-${idx}`}
                        value={prof.city}
                        onChange={(value) => changeProfession(idx, 'city', value)}
                        placeholder="City"
                        disabled={isReadOnly}
                        className="mb-0"
                      />
                    </div>
                    <RegionFields
                      idPrefix={`rp-${idx}`}
                      country={prof.country}
                      state={prof.state}
                      onChange={(region) =>
                        setProfessions((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, ...region } : p)),
                        )
                      }
                      disabled={isReadOnly}
                      fieldClassName="rpd-field"
                      fieldStyle={{ flex: '1', minWidth: '120px', marginBottom: 0 }}
                      dropdownStyles={customDropdownStyles}
                    />
                    <div
                      className="rpd-field"
                      style={{ flex: '1', minWidth: '120px', marginBottom: 0 }}
                    >
                      <CustomInput
                        label="Website"
                        name={`rp-orgLinkedIn-${idx}`}
                        value={prof.orgLinkedIn}
                        onChange={(value) => changeProfession(idx, 'orgLinkedIn', value)}
                        placeholder="Website URL"
                        disabled={isReadOnly}
                        className="mb-0"
                      />
                    </div>
                    <div
                      className="rpd-field"
                      style={{ flex: '1.6', minWidth: '180px', marginBottom: 0 }}
                    >
                      <label htmlFor={`rp-officialEmail-${idx}`} className="rpd-locked-label">
                        Official email
                        <ContactLock />
                      </label>
                      <CustomInput
                        name={`rp-officialEmail-${idx}`}
                        type="email"
                        value={contactHidden ? HIDDEN_CONTACT : prof.officialEmail}
                        onChange={(value) => changeProfession(idx, 'officialEmail', value)}
                        placeholder="Own or role mailbox"
                        disabled={isReadOnly}
                        className="mb-0"
                      />
                    </div>
                    <div
                      className="rpd-field"
                      style={{ flex: '1', minWidth: '120px', marginBottom: 0 }}
                    >
                      <label>Status</label>
                      <CustomDropdown
                        name={`status-${idx}`}
                        className="mb-0"
                        value={prof.status ? { value: prof.status, label: prof.status } : null}
                        onChange={(val: any) =>
                          changeProfession(idx, 'status', val ? String(val.value) : '')
                        }
                        options={[
                          { value: 'Working', label: 'Working' },
                          { value: 'Relieved', label: 'Relieved' },
                        ]}
                        placeholder="Select Status"
                        styles={customDropdownStyles}
                        isDisabled={isReadOnly}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 'var(--control-height)',
                        width: '38px',
                        paddingBottom: '2px',
                      }}
                    >
                      {!isReadOnly && professions.length > 1 ? (
                        <CustomButton
                          variant="link"
                          onClick={() => removeProfession(idx)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: '8px',
                          }}
                          title="Remove record"
                          aria-label="Remove record"
                        >
                          <Trash2 size={20} />
                        </CustomButton>
                      ) : (
                        <div style={{ width: '38px' }} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className="rpd-divider rpd-divider--dark" style={{ margin: '24px 0' }} />

          {/* Documents */}
          <div className="rpd-docs-row" style={{ marginTop: '16px' }}>
            <div className="rpd-upload-box" style={isReadOnly ? { opacity: 0.6 } : undefined}>
              <div className="rpd-upload-info">
                <div className="rpd-upload-icon">
                  <Image size={36} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="rpd-upload-label">Photo</div>
                  <div className="rpd-upload-hint">JPG, JPEG, PNG (Maximum 2 MB)</div>
                  {photoName && (
                    <div className="rpd-upload-filename">
                      {!photoFile && !removePhoto && editingPerson?.photoPath ? (
                        <a
                          href={uploadUrl(editingPerson.photoPath)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {photoName}
                        </a>
                      ) : (
                        photoName
                      )}
                      {!isReadOnly && (
                        <CustomButton
                          variant="link"
                          onClick={handleRemovePhoto}
                          title="Remove photo"
                          aria-label="Remove photo"
                          style={{
                            color: '#b91c1c',
                            padding: '0 4px',
                            marginLeft: '6px',
                            verticalAlign: 'middle',
                            lineHeight: 1,
                          }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </CustomButton>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Only the button is used: the chosen file shows under the hint, as before, so
                  the uploader's own filename chip would squeeze the text column. */}
              <CustomFileUploader
                name="rp-photo"
                accept=".jpg,.jpeg,.png"
                buttonText="Choose File"
                onChange={handlePhoto}
                disabled={isReadOnly}
                className="mb-0 rpd-upload-button"
              />
            </div>
            <div className="rpd-upload-box" style={isReadOnly ? { opacity: 0.6 } : undefined}>
              <div className="rpd-upload-info">
                <div className="rpd-upload-icon">
                  <FileText size={36} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="rpd-upload-label rpd-locked-label">
                    Resume
                    <ContactLock />
                  </div>
                  <div className="rpd-upload-hint">PDF, DOC, DOCX (Maximum 5 MB)</div>
                  {resumeName && (
                    <div className="rpd-upload-filename">
                      {!resumeFile && !removeResume && editingPerson?.resumePath ? (
                        <a
                          href={uploadUrl(editingPerson.resumePath)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {resumeName}
                        </a>
                      ) : (
                        resumeName
                      )}
                      {!isReadOnly && (
                        <CustomButton
                          variant="link"
                          onClick={handleRemoveResume}
                          title="Remove resume"
                          aria-label="Remove resume"
                          style={{
                            color: '#b91c1c',
                            padding: '0 4px',
                            marginLeft: '6px',
                            verticalAlign: 'middle',
                            lineHeight: 1,
                          }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </CustomButton>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Only the button is used: the chosen file shows under the hint, as before, so
                  the uploader's own filename chip would squeeze the text column. */}
              <CustomFileUploader
                name="rp-resume"
                accept=".pdf,.doc,.docx"
                buttonText="Choose File"
                onChange={handleResume}
                disabled={isReadOnly}
                className="mb-0 rpd-upload-button"
              />
            </div>
          </div>
          {fileError && (
            <div
              role="alert"
              style={{
                color: '#b91c1c',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '8px 14px',
                marginTop: '8px',
                fontSize: 'var(--font-size-body)',
              }}
            >
              {fileError}
            </div>
          )}
        </div>
      </div>

      {/* Form actions */}
      <div
        style={{
          padding: '12px 0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {!isReadOnly && (
          <CustomButton
            className="rpd-btn-save"
            onClick={handleSubmit}
            style={{
              height: 'var(--control-height)',
              padding: '0 var(--button-padding-x)',
              fontSize: 'var(--font-size-body)',
              fontWeight: 'var(--weight-semibold)',
              backgroundColor: '#0069ab',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              minWidth: 'var(--button-min-width)',
              boxShadow: '0 4px 12px rgba(0, 105, 171, 0.25)',
              transition: 'all 0.3s ease',
            }}
          >
            {editingPerson !== null ? 'Update Record' : 'Save Record'}
          </CustomButton>
        )}
        <CustomButton
          variant="light"
          className="rpd-btn-cancel"
          onClick={onCancel}
          style={{
            height: 'var(--control-height)',
            padding: '0 var(--button-padding-x)',
            fontSize: 'var(--font-size-body)',
            fontWeight: 'var(--weight-semibold)',
            backgroundColor: '#f1f5f9',
            color: '#475569',
            border: '1.5px solid #e2e8f0',
            borderRadius: '12px',
            cursor: 'pointer',
            minWidth: 'var(--button-min-width)',
            transition: 'all 0.3s ease',
          }}
        >
          Cancel
        </CustomButton>
      </div>

      <AlertModal
        show={showNameAlert}
        onHide={() => setShowNameAlert(false)}
        type="warning"
        message="Please fill in the Name fields."
      />
    </div>
  );
};

export default ResourcePersonDirectory;
