import {
  Smartphone,
  Mail,
  Linkedin,
  Image,
  FileText,
  PlusCircle,
  Trash2,
  Upload,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import './ResourcePersonDirectory.css';
import CustomDropdown from '../../shared/components/ui/CustomDropdown';

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
  date: string;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  isOwner?: boolean;
}

interface ResourcePersonDirectoryProps {
  editingPerson: ResourcePerson | null;
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

const customDropdownStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: '45px',
    height: '45px',
    backgroundColor: '#ffffff',
    borderColor: state.isFocused ? '#0069ab' : '#dbeafe',
    borderRadius: '12px',
    padding: '0 4px',
    boxShadow: state.isFocused ? '0 0 0 4px rgba(0, 105, 171, 0.12)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#0069ab' : '#0069ab',
    },
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
};

const titleDropdownStyles = {
  ...customDropdownStyles,
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: '45px',
    height: '45px',
    backgroundColor: '#ffffff',
    borderColor: state.isFocused ? '#0069ab' : '#dbeafe',
    borderRadius: '12px',
    padding: '0 2px',
    boxShadow: state.isFocused ? '0 0 0 4px rgba(0, 105, 171, 0.12)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#0069ab' : '#0069ab',
    },
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    padding: '0 4px',
  }),
  dropdownIndicator: (provided: any) => ({
    ...provided,
    padding: '2px',
  }),
};

interface UploadBoxProps {
  icon: React.ReactNode;
  title: string;
  hint: string;
  accept: string;
  filename: string;
  filePath?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

const UploadBox: React.FC<UploadBoxProps> = ({
  icon,
  title,
  hint,
  accept,
  filename,
  filePath,
  onChange,
  disabled,
}) => {
  return (
    <div className="rpd-upload-box" style={disabled ? { opacity: 0.6 } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ color: '#0069ab', flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{title}</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>{hint}</div>
          {filename && (
            <div
              style={{ marginTop: '4px', fontSize: '0.8rem', color: '#0069ab', fontWeight: '600' }}
            >
              {filePath ? (
                <a href={filePath} target="_blank" rel="noreferrer">
                  {filename}
                </a>
              ) : (
                filename
              )}
            </div>
          )}
        </div>
      </div>
      <label
        className="rpd-choose-btn"
        style={
          disabled ? { cursor: 'not-allowed', opacity: 0.5, pointerEvents: 'none' } : undefined
        }
      >
        <Upload size={16} />
        Choose File
        <input
          type="file"
          accept={accept}
          onChange={onChange}
          style={{ display: 'none' }}
          disabled={disabled}
          aria-label={`Upload ${title}`}
        />
      </label>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   Form Component
   ═══════════════════════════════════════════════════════════ */

const ResourcePersonDirectory: React.FC<ResourcePersonDirectoryProps> = ({
  editingPerson,
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
  const [fileError, setFileError] = useState<string | null>(null);

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
  }, [editingPerson]);

  /* ── Profession helpers ── */
  const addProfession = () =>
    setProfessions((prev) => [...prev, { ...emptyProfession(), status: 'Relieved' }]);
  const removeProfession = (i: number) =>
    setProfessions((prev) => prev.filter((_, idx) => idx !== i));
  const changeProfession = (i: number, field: keyof ProfessionDetail, val: string) =>
    setProfessions((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));

  /* ── File handlers ── */
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const extension = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png'];
      const validMime = f.type.startsWith('image/');
      if (!validMime && !validExtensions.includes(extension)) {
        setFileError('Invalid photo file type. Please select a JPG, JPEG, or PNG image.');
        setPhotoName('');
        setPhotoFile(undefined);
        e.target.value = '';
        return;
      }
      if (f.size > 2 * 1024 * 1024) {
        setFileError('Photo must be less than 2 MB');
        setPhotoName('');
        setPhotoFile(undefined);
        e.target.value = '';
        return;
      }
      setFileError(null);
      setPhotoName(f.name);
      setPhotoFile(f);
    }
  };
  const handleResume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const extension = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      const validExtensions = ['.pdf', '.doc', '.docx'];
      const isDoc =
        f.type === 'application/msword' ||
        f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isPdf = f.type === 'application/pdf';
      if (!isPdf && !isDoc && !validExtensions.includes(extension)) {
        setFileError('Invalid resume file type. Please select a PDF, DOC, or DOCX document.');
        setResumeName('');
        setResumeFile(undefined);
        e.target.value = '';
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setFileError('Resume must be less than 5 MB');
        setResumeName('');
        setResumeFile(undefined);
        e.target.value = '';
        return;
      }
      setFileError(null);
      setResumeName(f.name);
      setResumeFile(f);
    }
  };

  const handleSubmit = () => {
    if (!firstName.trim() || !lastName.trim()) {
      alert('Please fill in the Name fields.');
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
      professions: filteredProfessions.length
        ? filteredProfessions.map((p) => ({ ...p }))
        : [emptyProfession()],
      photoName,
      resumeName,
      photoFile,
      resumeFile,
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
                  <label>
                    First Name <span className="rpd-req">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    disabled={isReadOnly}
                  />
                </div>
                <div className="rpd-field">
                  <label>
                    Last Name <span className="rpd-req">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
              <div className="rpd-grid-3">
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
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    disabled={isReadOnly}
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
                  <input
                    type="text"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder="e.g. Skilling, Accreditation"
                    disabled={isReadOnly}
                  />
                </div>
                <div className="rpd-field">
                  <label>Specialization</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Machine Learning"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="rpd-split-side" style={{ paddingLeft: '8px' }}>
              <h5
                style={{
                  fontSize: '15px',
                  fontWeight: '700',
                  color: '#0069ab',
                  marginBottom: '4px',
                }}
              >
                Contact Details
              </h5>

              <div className="rpd-field">
                <div className="rpd-input-icon">
                  <Smartphone size={15} />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Mobile number"
                    aria-label="Mobile number"
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="rpd-field">
                <div className="rpd-input-icon">
                  <Mail size={15} />
                  <input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="Personal email"
                    aria-label="Personal email"
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="rpd-field">
                <div className="rpd-input-icon">
                  <Mail size={15} />
                  <input
                    type="email"
                    value={officialEmail}
                    onChange={(e) => setOfficialEmail(e.target.value)}
                    placeholder="Official email"
                    aria-label="Official email"
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="rpd-field">
                <div className="rpd-input-icon">
                  <Linkedin size={15} />
                  <input
                    type="url"
                    value={linkedIn}
                    onChange={(e) => setLinkedIn(e.target.value)}
                    placeholder="LinkedIn URL"
                    aria-label="LinkedIn Profile"
                    disabled={isReadOnly}
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
              <h5 style={{ fontSize: '15px', fontWeight: '700', color: '#0069ab', margin: 0 }}>
                Profession Details
              </h5>
              {!isReadOnly && (
                <button
                  type="button"
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
                >
                  <PlusCircle size={22} />
                </button>
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
                        { label: 'Organization', field: 'organization', ph: 'e.g. IIT Madras' },
                      ] as { label: string; field: keyof ProfessionDetail; ph: string }[]
                    ).map(({ label, field, ph }) => (
                      <div key={field} className="rpd-field" style={{ marginBottom: 0 }}>
                        <label>{label}</label>
                        <input
                          type="text"
                          value={prof[field]}
                          onChange={(e) => changeProfession(idx, field, e.target.value)}
                          placeholder={ph}
                          disabled={isReadOnly}
                        />
                      </div>
                    ))}
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
                        <label>{label}</label>
                        <input
                          type="text"
                          value={prof[field]}
                          onChange={(e) => changeProfession(idx, field, e.target.value)}
                          placeholder={ph}
                          disabled={isReadOnly}
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
                        height: '43px',
                        width: '38px',
                        paddingBottom: '2px',
                      }}
                    >
                      {!isReadOnly && professions.length > 1 ? (
                        <button
                          type="button"
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
                        >
                          <Trash2 size={20} />
                        </button>
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
            <UploadBox
              icon={<Image size={36} strokeWidth={1.5} />}
              title="Photo"
              hint="JPG, JPEG, PNG (Maximum 2 MB)"
              accept="image/*"
              filename={photoName}
              filePath={editingPerson?.photoPath}
              onChange={handlePhoto}
              disabled={isReadOnly}
            />
            <UploadBox
              icon={<FileText size={36} strokeWidth={1.5} />}
              title="Resume"
              hint="PDF, DOC, DOCX (Maximum 5 MB)"
              accept=".pdf,.doc,.docx"
              filename={resumeName}
              filePath={editingPerson?.resumePath}
              onChange={handleResume}
              disabled={isReadOnly}
            />
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
                fontSize: '0.875rem',
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
          <button
            type="button"
            className="rpd-btn-save"
            onClick={handleSubmit}
            style={{
              padding: '12px 40px',
              fontSize: '16px',
              fontWeight: '700',
              backgroundColor: '#0069ab',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              minWidth: '150px',
              boxShadow: '0 6px 20px rgba(0, 105, 171, 0.3)',
              transition: 'all 0.3s ease',
            }}
          >
            {editingPerson !== null ? 'Update Record' : 'Save Record'}
          </button>
        )}
        <button
          type="button"
          className="rpd-btn-cancel"
          onClick={onCancel}
          style={{
            padding: '10px 30px',
            fontSize: '15px',
            fontWeight: '600',
            backgroundColor: '#f1f5f9',
            color: '#475569',
            border: '1.5px solid #e2e8f0',
            borderRadius: '12px',
            cursor: 'pointer',
            minWidth: '140px',
            transition: 'all 0.3s ease',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ResourcePersonDirectory;
