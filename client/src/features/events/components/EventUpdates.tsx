import React, { useState } from 'react';
import '../styles/EventForm.css';

import {
  Eye,
  Plus,
  Trash2,
  CloudUpload,
  Mail,
  Info,
  Facebook,
  Instagram,
  Linkedin,
  X,
} from 'lucide-react';

import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import {
  DOCUMENT_PARTICIPANT_TYPES,
  EVENT_DOCUMENTS,
  EVENT_UPDATE_LETTERS_SECTIONS,
  EVENT_COPY,
  EVENT_MAIL_TEMPLATES,
} from '../constants';

// --- Letters Section ---

const sections = EVENT_UPDATE_LETTERS_SECTIONS;
const participantTypes = DOCUMENT_PARTICIPANT_TYPES;
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
  file: File | File[] | (File | null)[] | null;
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
  participants: ParticipantRow[];
  setParticipants: React.Dispatch<React.SetStateAction<ParticipantRow[]>>;
}

const ParticipantsCard: React.FC<ParticipantsCardProps> = ({ participants, setParticipants }) => {
  const [selectedType, setSelectedType] = useState('');
  const [count, setCount] = useState('');

  const canAdd = selectedType !== '' && count !== '' && !isNaN(Number(count));
  const total = participants.reduce((sum, participant) => sum + participant.count, 0);

  const handleAdd = (): void => {
    if (!canAdd) return;

    const foundType = participantTypes.find((type) => type.value === selectedType);
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
              {participantTypes.map((type) => (
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
  setDocState: React.Dispatch<React.SetStateAction<Record<string, DocumentRowState>>>;
}

const DocumentsCard: React.FC<DocumentsCardProps> = ({ docState, setDocState }) => {
  const handleFileUpload = (
    doc: string,
    event: React.ChangeEvent<HTMLInputElement>,
    index: number | null = null,
  ): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    setDocState((prev) => {
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
    setDocState((prev) => ({
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
          <article className="resource-person-card" key={row.id}>
            <div className="resource-person-card-header">
              <h4 className="resource-person-card-title">
                {EVENT_COPY.resourcePersonLabel} {index + 1}
              </h4>
              <div className="resource-person-card-actions">
                <button
                  type="button"
                  className="resource-person-icon-btn resource-person-add-row"
                  onClick={handleAdd}
                  title="Add resource person"
                  aria-label="Add resource person"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="resource-person-icon-btn resource-person-delete"
                    onClick={() => handleDelete(row.id)}
                    title="Remove resource person"
                    aria-label="Remove resource person"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="resource-person-divider" />

            <div className="resource-person-card-grid resource-person-card-grid-two">
              <div className="resource-person-field-group">
                <span className="resource-person-field-label">Name</span>
                <input
                  type="text"
                  className="resource-person-field-input"
                  value={row.name || ''}
                  onChange={(e) => handleChange(row.id, 'name', e.target.value)}
                />
              </div>
              <div className="resource-person-field-group">
                <span className="resource-person-field-label">Designation</span>
                <input
                  type="text"
                  className="resource-person-field-input"
                  value={row.designation || ''}
                  onChange={(e) => handleChange(row.id, 'designation', e.target.value)}
                />
              </div>
            </div>

            <div className="resource-person-card-grid resource-person-card-grid-two">
              <div className="resource-person-field-group">
                <span className="resource-person-field-label">Organization</span>
                <input
                  type="text"
                  className="resource-person-field-input"
                  value={row.organization || ''}
                  onChange={(e) => handleChange(row.id, 'organization', e.target.value)}
                />
              </div>
              <div className="resource-person-field-group">
                <span className="resource-person-field-label">Email</span>
                <input
                  type="email"
                  className="resource-person-field-input"
                  value={row.email || ''}
                  onChange={(e) => handleChange(row.id, 'email', e.target.value)}
                />
              </div>
            </div>

            <div className="resource-person-divider" />

            <div className="resource-person-card-grid resource-person-card-grid-four">
              <div className="resource-person-field-group">
                <span className="resource-person-field-label">Purpose</span>
                <select
                  className="resource-person-field-select"
                  value={row.purpose || ''}
                  onChange={(e) => handleChange(row.id, 'purpose', e.target.value)}
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

              <div className="resource-person-field-group mode-group">
                <span
                  className="resource-person-field-label short-label"
                  style={{ marginRight: '8px' }}
                >
                  Mode
                </span>
                <div className="resource-person-toggle-pill">
                  <button
                    type="button"
                    className={`resource-person-toggle-btn ${row.mode === 'Online' ? 'active' : 'inactive'}`}
                    onClick={() => handleChange(row.id, 'mode', 'Online')}
                  >
                    Online
                  </button>
                  <button
                    type="button"
                    className={`resource-person-toggle-btn ${row.mode !== 'Online' ? 'active' : 'inactive'}`}
                    onClick={() => handleChange(row.id, 'mode', 'Offline')}
                  >
                    Offline
                  </button>
                </div>
              </div>

              <div className="resource-person-field-group resource-person-date-group">
                <span className="resource-person-field-label short-label">Date</span>
                <input
                  type="date"
                  className="resource-person-field-input"
                  value={row.date || ''}
                  onChange={(e) => handleChange(row.id, 'date', e.target.value)}
                />
              </div>

              <div className="resource-person-field-group resource-person-time-group">
                <span className="resource-person-field-label short-label">Time</span>
                <input
                  type="time"
                  className="resource-person-field-input"
                  value={row.time || ''}
                  onChange={(e) => handleChange(row.id, 'time', e.target.value)}
                />
              </div>
            </div>

            <div className="resource-person-divider" />

            <div className="resource-person-title-row">
              <div className="resource-person-title-header">
                <span className="resource-person-field-label">Title</span>
                <label className="resource-person-switch">
                  <input
                    type="checkbox"
                    checked={!!row.hasTitle}
                    onChange={(e) => handleChange(row.id, 'hasTitle', e.target.checked)}
                  />
                  <span className="resource-person-slider"></span>
                </label>
              </div>
              {row.hasTitle && (
                <input
                  type="text"
                  className="resource-person-field-input"
                  value={row.title || ''}
                  onChange={(e) => handleChange(row.id, 'title', e.target.value)}
                  placeholder="Topic / Title of presentation..."
                />
              )}
            </div>

            <div className="resource-person-email-actions">
              <div className="resource-person-email-box">
                <div className="resource-person-email-left">
                  <div className="resource-person-email-icon-wrap">
                    <Mail size={20} />
                  </div>
                  <span className="resource-person-email-label">Invitation</span>
                </div>
                <div className="resource-person-email-btns">
                  <button
                    type="button"
                    className="resource-person-btn resource-person-btn-preview"
                    onClick={() =>
                      showAlert(
                        `Previewing Invitation for ${row.name || EVENT_COPY.resourcePersonLabel}`,
                        'info',
                        'Preview',
                      )
                    }
                  >
                    <Eye size={16} /> Preview
                  </button>
                  <button
                    type="button"
                    className="resource-person-email-btn-send"
                    onClick={() => {
                      window.location.href = `mailto:${row.email || ''}?subject=${encodeURIComponent(EVENT_MAIL_TEMPLATES.invitationSubject(row.name || ''))}&body=${encodeURIComponent(EVENT_MAIL_TEMPLATES.invitationBody(row.name || ''))}`;
                      handleChange(row.id, 'invitationStatus', 'Sent');
                    }}
                  >
                    {EVENT_COPY.sendMail}
                  </button>
                  <span className="resource-person-email-status">
                    <Info size={14} />
                    {row.invitationStatus || EVENT_COPY.notSent}
                  </span>
                </div>
              </div>

              <div className="resource-person-email-box">
                <div className="resource-person-email-left">
                  <div className="resource-person-email-icon-wrap">
                    <Mail size={20} />
                  </div>
                  <span className="resource-person-email-label">Thanks</span>
                </div>
                <div className="resource-person-email-btns">
                  <button
                    type="button"
                    className="resource-person-btn resource-person-btn-preview"
                    onClick={() =>
                      showAlert(
                        `Previewing Thank You letter for ${row.name || EVENT_COPY.resourcePersonLabel}`,
                        'info',
                        'Preview',
                      )
                    }
                  >
                    <Eye size={16} /> Preview
                  </button>
                  <button
                    type="button"
                    className="resource-person-email-btn-send"
                    onClick={() => {
                      window.location.href = `mailto:${row.email || ''}?subject=${encodeURIComponent(EVENT_MAIL_TEMPLATES.thankYouSubject())}&body=${encodeURIComponent(EVENT_MAIL_TEMPLATES.thankYouBody(row.name || ''))}`;
                      handleChange(row.id, 'thanksStatus', 'Sent');
                    }}
                  >
                    {EVENT_COPY.sendMail}
                  </button>
                  <span className="resource-person-email-status">
                    <Info size={14} />
                    {row.thanksStatus || EVENT_COPY.notSent}
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
  const [docState, setDocState] = useState<Record<string, DocumentRowState>>(
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

      <DocumentsCard docState={docState} setDocState={setDocState} />

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

export default EventUpdates;
