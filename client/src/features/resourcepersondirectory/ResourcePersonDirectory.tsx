import { Smartphone, Mail, Linkedin, Image, FileText, PlusCircle, Trash2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import './ResourcePersonDirectory.css';
import AlertModal from '../../shared/components/ui/AlertModal';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomDropdown from '../../shared/components/ui/CustomDropdown';
import CustomFileUploader from '../../shared/components/ui/CustomFileUploader';
import CustomInput from '../../shared/components/ui/CustomInput';
import authenticityUtility from '../../shared/utils/authenticityUtility';

import type { Organization } from '../organizationdirectory/OrganizationDirectory';

/* ─── Types ─────────────────────────────────────────────── */

export interface ProfessionDetail {
  id?: string;
  designation: string;
  department: string;
  organization: string;
  city: string;
  state: string;
  country: string;
  orgLinkedIn: string;
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
  specialization: string;
  mobile: string;
  personalEmail: string;
  officialEmail: string;
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

const CATEGORY_OPTIONS = [
  'Academic',
  'Industry',
  'Scientist',
  'Administration',
  'Incubation',
  'Government',
  'Entrepreneur',
  'Alumni',
  'Social Activist',
];

const ADD_ORGANIZATION_VALUE = '__add_organization__';

const newProfessionId = (): string => crypto.randomUUID();

const emptyProfession = (): ProfessionDetail => ({
  id: newProfessionId(),
  designation: '',
  department: '',
  organization: '',
  city: '',
  state: '',
  country: '',
  orgLinkedIn: '',
  status: 'Working',
});

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

  /* form fields */
  const [category, setCategory] = useState('Academic');
  const [title, setTitle] = useState('Dr.');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [serviceStatus, setServiceStatus] = useState('In Service');
  const [tag, setTag] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [mobile, setMobile] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
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
      setSpecialization(editingPerson.specialization || '');
      setMobile(editingPerson.mobile || '');
      setPersonalEmail(editingPerson.personalEmail || '');
      setOfficialEmail(editingPerson.officialEmail || '');
      setLinkedIn(editingPerson.linkedIn || '');
      setProfessions(
        editingPerson.professions?.length
          ? editingPerson.professions.map((p) => ({
              ...p,
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

  /* ── Profession helpers ── */
  const addProfession = () =>
    setProfessions((prev) => [...prev, { ...emptyProfession(), status: 'Relieved' }]);
  const removeProfession = (i: number) =>
    setProfessions((prev) => prev.filter((_, idx) => idx !== i));
  const changeProfession = (i: number, field: keyof ProfessionDetail, val: string) =>
    setProfessions((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));
  const organizationOptions = [
    ...organizations.map((organization) => ({
      value: organization.name,
      label: organization.approvalStatus
        ? `${organization.name} (${organization.approvalStatus})`
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
      return d !== '' || dept !== '' || org !== '' || c !== '' || s !== '' || co !== '';
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
      specialization: specialization.trim(),
      mobile: mobile.trim(),
      personalEmail: personalEmail.trim(),
      officialEmail: officialEmail.trim(),
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
                  <CustomInput
                    label="Date of Birth"
                    name="rp-dob"
                    type="date"
                    value={dob}
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
                  <CustomInput
                    label="Tag"
                    name="rp-tag"
                    value={tag}
                    onChange={setTag}
                    placeholder="e.g. Skilling, Accreditation"
                    disabled={isReadOnly}
                    className="mb-0"
                  />
                </div>
                <div className="rpd-field">
                  <CustomInput
                    label="Specialization"
                    name="rp-specialization"
                    value={specialization}
                    onChange={setSpecialization}
                    placeholder="e.g. Machine Learning"
                    disabled={isReadOnly}
                    className="mb-0"
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
                    value={mobile}
                    onChange={setMobile}
                    placeholder="Mobile number"
                    disabled={isReadOnly}
                    className="mb-0"
                  />
                </div>
              </div>

              <div className="rpd-field">
                <div className="rpd-input-icon">
                  <Mail size={15} />
                  <CustomInput
                    label="Personal email"
                    name="rp-personalEmail"
                    type="email"
                    value={personalEmail}
                    onChange={setPersonalEmail}
                    placeholder="Personal email"
                    disabled={isReadOnly}
                    className="mb-0"
                  />
                </div>
              </div>

              <div className="rpd-field">
                <div className="rpd-input-icon">
                  <Mail size={15} />
                  <CustomInput
                    label="Official email"
                    name="rp-officialEmail"
                    type="email"
                    value={officialEmail}
                    onChange={setOfficialEmail}
                    placeholder="Official email"
                    disabled={isReadOnly}
                    className="mb-0"
                  />
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
                      <label>Organization</label>
                      <CustomDropdown
                        name={`organization-${idx}`}
                        className="mb-0"
                        value={
                          prof.organization
                            ? (organizationOptions.find(
                                (option) => option.value === prof.organization,
                              ) ?? { value: prof.organization, label: prof.organization })
                            : null
                        }
                        onChange={(option: any) => {
                          if (option?.value === ADD_ORGANIZATION_VALUE) {
                            // The flow saves the organization and hands it back, so only this
                            // row changes and the rest of the unsaved form stays as it is.
                            onAddOrganization?.((organization) =>
                              changeProfession(idx, 'organization', organization.name),
                            );
                            return;
                          }
                          changeProfession(idx, 'organization', option ? String(option.value) : '');
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
                    {(
                      [
                        { label: 'City', field: 'city', ph: 'City' },
                        { label: 'State', field: 'state', ph: 'State' },
                        { label: 'Country', field: 'country', ph: 'Country' },
                        { label: 'Website', field: 'orgLinkedIn', ph: 'Website URL' },
                      ] as { label: string; field: keyof ProfessionDetail; ph: string }[]
                    ).map(({ label, field, ph }) => (
                      <div
                        key={field}
                        className="rpd-field"
                        style={{ flex: '1', minWidth: '120px', marginBottom: 0 }}
                      >
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
                  <div className="rpd-upload-label">Resume</div>
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
