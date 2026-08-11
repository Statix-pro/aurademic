import React, { useState } from 'react';
import '../styles/EventForm.css';
import { Eye, Plus, Trash2, CloudUpload } from 'lucide-react';

import authenticityUtility from '../../../shared/utils/authenticityUtility';

// --- Letters Section ---

const letterOptions = ['Letter', 'Email', 'Letter/ Email'];
const sections = [
  'Security Division',
  'Guest House',
  'Transport',
  'Food/ Refreshment',
  'Photography',
  'Video Recording',
];

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
  id: number;
  name: string;
  designation: string;
  organization: string;
  email: string;
  linkedin: string;
  location?: string;
  uploadedFile?: string;
  fileName?: string;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

interface ResourcePersonProps {
  rows: ResourcePersonRow[];
  setRows: React.Dispatch<React.SetStateAction<ResourcePersonRow[]>>;
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

const isValidEmail = (email: string): boolean => {
  // Simple email validation regex
  return /^\S+@\S+\.\S+$/.test(email);
};

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

  const handleFileUpload = (section: string, event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        [section]: { ...prev[section], file },
      }));
    }
  };

  const handleViewFile = (file: File): void => {
    if (file) {
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    }
  };

  const handleSendMail = (section: string): void => {
    const data = formData[section];
    if (!data.active) {
      alert('Please activate the section before sending mail.');
      return;
    }
    if (!data.file) {
      alert('Please upload a file before sending mail.');
      return;
    }

    // Prompt user for recipient email(s)
    const recipientInput = prompt(
      `Enter recipient email address(es) for ${section} (comma separated):`,
    );
    if (!recipientInput) {
      alert('Sending cancelled: no recipients provided.');
      return;
    }

    // Validate emails
    const recipients = recipientInput
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (recipients.length === 0 || recipients.some((email) => !isValidEmail(email))) {
      alert('Please enter valid email address(es).');
      return;
    }

    // Proceed with send mail logic or backend API call here
    alert(
      `Send mail for ${section}\nMode: ${data.mode}\nDate: ${data.date}\nRecipients: ${recipients.join(
        ', ',
      )}`,
    );

    // Example: authenticityUtility.post('/send-email', {...})
  };

  return (
    <div className="event-card-section">
      <h2 className="event-section-title">Letters</h2>
      {sections.map((section) => (
        <div className="event-letters-row" key={section}>
          <span className="event-letters-label">{section}</span>

          <label className="event-letters-switch">
            <input
              type="checkbox"
              checked={formData[section].active}
              onChange={() => handleToggle(section)}
            />
            <span className="event-letters-slider"></span>
          </label>

          <select
            className="event-letters-dropdown"
            value={formData[section].mode}
            onChange={(e) => handleInputChange(section, 'mode', e.target.value)}
            disabled={!formData[section].active}
          >
            {letterOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>

          <button
            type="button"
            disabled={!formData[section].active || !formData[section].file}
            onClick={() => handleSendMail(section)}
            style={{
              marginLeft: '8px',
              padding: '4px 10px',
              cursor:
                formData[section].active && formData[section].file ? 'pointer' : 'not-allowed',
              backgroundColor:
                formData[section].active && formData[section].file ? '#0069ab' : '#ccc',
              color: formData[section].active && formData[section].file ? '#ffffff' : '#666666',
              border: 'none',
              borderRadius: '4px',
            }}
            title={
              !formData[section].active
                ? 'Activate section first'
                : !formData[section].file
                  ? 'Upload file first'
                  : 'Send Mail'
            }
          >
            Send Mail
          </button>
          <label
            className={`event-upload-icon ${
              formData[section].active || formData[section].file ? 'active' : 'disabled'
            }`}
          >
            <CloudUpload size={14} />
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(section, e)}
              disabled={!formData[section].active}
            />
          </label>

          <span
            className={`event-eye-icon ${formData[section].file ? 'active' : 'disabled'}`}
            onClick={() => formData[section].file && handleViewFile(formData[section].file)}
          >
            <Eye size={14} />
          </span>

          <input
            type="date"
            className="event-letters-date"
            value={formData[section].date}
            onChange={(e) => handleInputChange(section, 'date', e.target.value)}
            disabled={!formData[section].active}
          />
        </div>
      ))}
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
const ResourcePerson: React.FC<ResourcePersonProps> = ({ rows, setRows }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<InitialForm>(initialForm);

  const [showSuccess, setShowSuccess] = useState(false);
  const handleFormChange = (field: keyof InitialForm, value: string): void =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setForm(initialForm);
    setModalOpen(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000); // Message disappears after 2 seconds
  };
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
      },
    ]);
  };

  const handleDelete = (id: number): void => {
    if (rows.length > 1) {
      setRows(rows.filter((row) => row.id !== id));
    }
  };

  const handleChange = (id: number, field: keyof ResourcePersonRow, value: string): void => {
    setRows(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const openLink = (url: string): void => {
    if (url) window.open(url, '_blank');
  };

  // --- Drag & Drop handlers ---
  const handleDragStart = (e: React.DragEvent, index: number): void => {
    e.dataTransfer.setData('dragIndex', index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number): void => {
    const dragIndex = parseInt(e.dataTransfer.getData('dragIndex'));
    if (isNaN(dragIndex)) return;

    const updatedRows = [...rows];
    const [draggedRow] = updatedRows.splice(dragIndex, 1);
    updatedRows.splice(dropIndex, 0, draggedRow);

    setRows(updatedRows);
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
  };

  return (
    <div className="event-card-section">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0 }}>Resource Person</h3>
        <button
          type="button"
          style={{
            background: '#0069ab',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '7px 18px 7px 18px',
            fontSize: 16,
            cursor: 'pointer',
            fontWeight: 500,
          }}
          onClick={() => setModalOpen(true)}
        >
          + Add Resource Person
        </button>
      </div>

      {showSuccess && (
        <div
          style={{
            position: 'fixed',
            right: 40,
            top: 38,
            zIndex: 2000,
            background: '#36d399',
            color: '#fff',
            padding: '15px 24px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.11)',
          }}
        >
          Resource person added successfully
        </div>
      )}

      {/* Optional: Your existing table/fields here */}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h3 style={{ marginTop: 0, marginBottom: 14 }}>Add Resource Person</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            placeholder="Name"
            required
          />
          <input
            type="text"
            value={form.designation}
            onChange={(e) => handleFormChange('designation', e.target.value)}
            placeholder="Designation"
            required
          />
          <input
            type="text"
            value={form.organization}
            onChange={(e) => handleFormChange('organization', e.target.value)}
            placeholder="Organization"
            required
          />
          <input
            type="text"
            value={form.location}
            onChange={(e) => handleFormChange('location', e.target.value)}
            placeholder="Location"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleFormChange('email', e.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="text"
            value={form.linkedin}
            onChange={(e) => handleFormChange('linkedin', e.target.value)}
            placeholder="LinkedIn"
          />
          <input
            type="text"
            value={form.mobile}
            onChange={(e) => handleFormChange('mobile', e.target.value)}
            placeholder="Mobile Number"
            required
          />
          <button
            type="submit"
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '9px 0',
              marginTop: 6,
              fontSize: 16,
            }}
          >
            Submit
          </button>
        </form>
      </Modal>

      <table className="event-resource-person-table">
        <tbody>
          {rows.map((row, index) => (
            <React.Fragment key={row.id}>
              <tr
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <td rowSpan={2} style={{ cursor: 'grab', textAlign: 'center' }}>
                  {index + 1}
                </td>
                <td>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => handleChange(row.id, 'name', e.target.value)}
                    placeholder="Name"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.designation}
                    onChange={(e) => handleChange(row.id, 'designation', e.target.value)}
                    placeholder="Designation"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.organization}
                    onChange={(e) => handleChange(row.id, 'organization', e.target.value)}
                    placeholder="Organization"
                  />
                </td>
              </tr>
              <tr
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <td>
                  <input
                    type="text"
                    value={row.location || ''}
                    onChange={(e) => handleChange(row.id, 'location', e.target.value)}
                    placeholder="Enter Location (e.g., Chennai, Tamil Nadu)"
                  />
                </td>

                <td className="event-actions">
                  <b> Profile</b>
                  {/* Upload Icon (always active) */}
                  <button
                    type="button"
                    className=""
                    onClick={() => document.getElementById(`file-input-${row.id}`)?.click()}
                    title="Upload"
                    style={{ color: '#1D4ED8' }}
                  >
                    <CloudUpload size={14} />
                  </button>
                  <input
                    id={`file-input-${row.id}`}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const fileURL = URL.createObjectURL(file); // create preview link
                        const updatedRows = rows.map((r) =>
                          r.id === row.id
                            ? {
                                ...r,
                                uploadedFile: fileURL,
                                fileName: file.name,
                              }
                            : r,
                        );
                        setRows(updatedRows);
                      }
                    }}
                  />

                  {/* Eye Icon (always active, shows uploaded file if available) */}
                  <button
                    type="button"
                    className=""
                    onClick={() => {
                      if (row.uploadedFile) {
                        window.open(row.uploadedFile, '_blank');
                      } else {
                        alert('No file uploaded yet!');
                      }
                    }}
                    title="Preview"
                    style={{ color: row.uploadedFile ? '#1D4ED8' : 'gray' }}
                  >
                    <Eye size={14} />
                  </button>
                </td>
                <td className="event-actions">
                  {/* Delete Icon (if more than 1 row) */}
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="event-icon-btn"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  {/* Add Icon (only on last row) */}
                  {index === rows.length - 1 && (
                    <button type="button" onClick={handleAdd} className="event-add" title="Add Row">
                      <Plus size={14} />
                    </button>
                  )}
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
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

  const [links, setLinks] = useState<SocialLinks>({
    facebook: '',
    x: '',
    instagram: '',
    linkedin: '',
  });

  const handleFileChange =
    (setter: React.Dispatch<React.SetStateAction<File | null>>) =>
    (e: React.ChangeEvent<HTMLInputElement>): void =>
      setter(e.target.files?.[0] || null);

  const handleViewFile = (file: File | null): void => {
    if (file) window.open(URL.createObjectURL(file), '_blank');
  };

  const openLink = (link: string): void => {
    if (link) window.open(link, '_blank');
  };

  const isValidEmail = (email: string): boolean => {
    return /^\S+@\S+\.\S+$/.test(email);
  };

  const handleSendMail = (sectionName: string, active: boolean, file: File | null): void => {
    if (!active) {
      alert('Please activate the section before sending mail.');
      return;
    }
    if (!file) {
      alert('Please upload a file before sending mail.');
      return;
    }

    const recipientInput = prompt(
      `Enter recipient email address(es) for ${sectionName} (comma separated):`,
    );
    if (!recipientInput) {
      alert('Sending cancelled: no recipients provided.');
      return;
    }

    const recipients = recipientInput
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (recipients.length === 0 || recipients.some((email) => !isValidEmail(email))) {
      alert('Please enter valid email address(es).');
      return;
    }

    alert(`Send mail for ${sectionName} to ${recipients.join(', ')}`);
    // Implement backend API call here to send mail
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
      alert('Failed to upload file: ' + file.name);
      return null;
    }
  };

  const handleSubmit = async (): Promise<void> => {
    console.log('handleSubmit called');
    if (isSubmittingUpdates) return;
    setIsSubmittingUpdates(true);
    try {
      let websiteUploadId: number | null = null;
      if (websiteEnabled && websiteFile) {
        websiteUploadId = await uploadFile(websiteFile);
      }
      let newspaperUploadId: number | null = null;
      if (newspaperEnabled && newspaperFile) {
        newspaperUploadId = await uploadFile(newspaperFile);
      }
      let pressUploadId: number | null = null;
      if (pressEnabled && pressFile) {
        pressUploadId = await uploadFile(pressFile);
      }

      const publicityData = {
        website_enabled: websiteEnabled,
        website_date: websiteDate,
        website_upload_id: websiteUploadId,
        newspaper_enabled: newspaperEnabled,
        newspaper_date: newspaperDate,
        newspaper_upload_id: newspaperUploadId,
        press_enabled: pressEnabled,
        press_date: pressDate,
        press_upload_id: pressUploadId,
        facebook_link: links.facebook,
        x_link: links.x,
        instagram_link: links.instagram,
        linkedin_link: links.linkedin,
      };
      // console.log("Sending publicityData:", publicityData);
      const res1 = await authenticityUtility.put(
        `/updates/events/${eventId}/publicity`,
        publicityData,
      );
      // console.log("Publicity response:", res1);

      for (const rp of rows) {
        // console.log("Sending resource person:", rp);
        const resRp = await authenticityUtility.post(
          `/updates/events/${eventId}/resource_persons`,
          rp,
        );
        // console.log("Resource person response:", resRp);
      }

      for (const [section, data] of Object.entries(formData)) {
        // console.log(`Sending letter data for ${section}:`, data);
        await authenticityUtility.put(`/updates/events/${eventId}/letters`, {
          section_name: section,
          active: data.active,
          mode: data.mode,
          letter_date: data.date,
        });
        // console.log("Letter updated");
      }

      alert('✅ Event updates saved successfully!');
      goToTab('post-event');
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      alert('Error occurred, please check console.');
    } finally {
      setIsSubmittingUpdates(false);
    }
  };

  return (
    <div>
      {/* Publicity Box */}
      <div className="event-card-section event-form-section">
        <h2 className="event-section-title">Publicity</h2>

        <div
          className="event-row-section"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <label className="event-section-label" style={{ minWidth: '160px' }}>
            Website Scrolling
          </label>
          <button
            type="button"
            disabled={!websiteFile}
            onClick={() => handleSendMail('Website Scrolling', true, websiteFile)}
            style={{
              padding: '4px 10px',
              marginLeft: '4px',
              backgroundColor: websiteFile ? '#0069ab' : '#ccc',
              color: websiteFile ? '#fff' : '#666',
              border: 'none',
              borderRadius: '4px',
              cursor: websiteFile ? 'pointer' : 'not-allowed',
            }}
            title={!websiteFile ? 'Upload file first' : 'Send Mail'}
          >
            Send Mail
          </button>
          <input
            type="date"
            value={websiteDate}
            onChange={(e) => setWebsiteDate(e.target.value)}
            className="event-date-input"
          />
          <label className="event-upload-icon" htmlFor="website-upload">
            <CloudUpload size={14} />
          </label>
          <input
            type="file"
            id="website-upload"
            style={{ display: 'none' }}
            onChange={handleFileChange(setWebsiteFile)}
          />
          <span
            className={`event-eye-icon${!websiteFile ? ' disabled' : ''}`}
            onClick={() => websiteFile && handleViewFile(websiteFile)}
          >
            <Eye size={14} />
          </span>
        </div>

        <div
          className="event-row-section"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <label className="event-section-label" style={{ minWidth: '160px' }}>
            Newspaper Engagement
          </label>
          <button
            type="button"
            disabled={!newspaperFile}
            onClick={() => handleSendMail('Newspaper Engagement', true, newspaperFile)}
            style={{
              padding: '4px 10px',
              marginLeft: '4px',
              backgroundColor: newspaperFile ? '#0069ab' : '#ccc',
              color: newspaperFile ? '#fff' : '#666',
              border: 'none',
              borderRadius: '4px',
              cursor: newspaperFile ? 'pointer' : 'not-allowed',
            }}
            title={!newspaperFile ? 'Upload file first' : 'Send Mail'}
          >
            Send Mail
          </button>
          <input
            type="date"
            value={newspaperDate}
            onChange={(e) => setNewspaperDate(e.target.value)}
            className="event-date-input"
          />
          <label className="event-upload-icon" htmlFor="newspaper-upload">
            <CloudUpload size={14} />
          </label>
          <input
            type="file"
            id="newspaper-upload"
            style={{ display: 'none' }}
            onChange={handleFileChange(setNewspaperFile)}
          />
          <span
            className={`event-eye-icon${!newspaperFile ? ' disabled' : ''}`}
            onClick={() => newspaperFile && handleViewFile(newspaperFile)}
          >
            <Eye size={14} />
          </span>
        </div>

        <div
          className="event-row-section"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <label className="event-section-label" style={{ minWidth: '160px' }}>
            Press Report
          </label>
          <button
            type="button"
            disabled={!pressFile}
            onClick={() => handleSendMail('Press Report', true, pressFile)}
            style={{
              padding: '4px 10px',
              marginLeft: '4px',
              backgroundColor: pressFile ? '#0069ab' : '#ccc',
              color: pressFile ? '#fff' : '#666',
              border: 'none',
              borderRadius: '4px',
              cursor: pressFile ? 'pointer' : 'not-allowed',
            }}
            title={!pressFile ? 'Upload file first' : 'Send Mail'}
          >
            Send Mail
          </button>
          <input
            type="date"
            value={pressDate}
            onChange={(e) => setPressDate(e.target.value)}
            className="event-date-input"
          />
          <label className="event-upload-icon" htmlFor="press-upload">
            <CloudUpload size={14} />
          </label>
          <input
            type="file"
            id="press-upload"
            style={{ display: 'none' }}
            onChange={handleFileChange(setPressFile)}
          />
          <span
            className={`event-eye-icon${!pressFile ? ' disabled' : ''}`}
            onClick={() => pressFile && handleViewFile(pressFile)}
          >
            <Eye size={14} />
          </span>
        </div>

        <div className="event-social-grid">
          {(['facebook', 'x', 'instagram', 'linkedin'] as const).map((platform) => (
            <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                className="event-big-social-input"
                placeholder={`${platform.charAt(0).toUpperCase() + platform.slice(1)} link`}
                value={links[platform]}
                style={{ width: '350px', fontSize: '14px', padding: '12px' }}
                onChange={(e) => setLinks({ ...links, [platform]: e.target.value })}
              />
              <span
                className={`event-eye-icon${!links[platform] ? ' disabled' : ''}`}
                onClick={() => openLink(links[platform])}
              >
                <Eye size={14} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <ResourcePerson rows={rows} setRows={setRows} />
      <LettersPage formData={formData} setFormData={setFormData} />

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
    </div>
  );
};

export default EventUpdates;
