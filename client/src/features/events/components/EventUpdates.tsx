import React, { useState } from "react";
import "../styles/EventForm.css";
import { Eye, Plus, Trash2, CloudUpload } from "lucide-react";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import { EVENT_UPDATE_LETTERS_SECTIONS } from "../constants";

// --- Letters Section ---

const sections = EVENT_UPDATE_LETTERS_SECTIONS;

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

          <button
            type="button"
            className={`event-send-mail-btn${formData[section].active ? " active" : ""}`}
            onClick={() => handleSendMail(section)}
            disabled={!formData[section].active}
          >
            Send Mail
          </button>

          <input
            type="date"
            className="event-letters-date"
            value={formData[section].date}
            onChange={(e) => handleInputChange(section, "date", e.target.value)}
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
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          minWidth: 350,
          padding: 24,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            right: 14,
            top: 11,
            border: "none",
            background: "none",
            fontSize: 18,
            cursor: "pointer",
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
  name: "",
  designation: "",
  organization: "",
  email: "",
  linkedin: "",
  mobile: "",
  location: "",
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
        name: "",
        designation: "",
        organization: "",
        email: "",
        linkedin: "",
      },
    ]);
  };

  const handleDelete = (id: number): void => {
    if (rows.length > 1) {
      setRows(rows.filter((row) => row.id !== id));
    }
  };

  const handleChange = (id: number, field: keyof ResourcePersonRow, value: string): void => {
    setRows(
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  // --- Drag & Drop handlers ---
  const handleDragStart = (e: React.DragEvent, index: number): void => {
    e.dataTransfer.setData("dragIndex", index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number): void => {
    const dragIndex = parseInt(e.dataTransfer.getData("dragIndex"));
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
    <div className="event-card-section event-resource-person-section">
      <div className="resource-person-header">
        <h3>Resource Person</h3>
        <button
          type="button"
          className="resource-person-add-btn"
          onClick={() => setModalOpen(true)}
        >
          + Add Resource Person
        </button>
      </div>

      {showSuccess && (
        <div
          style={{
            position: "fixed",
            right: 40,
            top: 38,
            zIndex: 2000,
            background: "#36d399",
            color: "#fff",
            padding: "15px 24px",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.11)",
          }}
        >
          Resource person added successfully
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h3 style={{ marginTop: 0, marginBottom: 14 }}>Add Resource Person</h3>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 13 }}
        >
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleFormChange("name", e.target.value)}
            placeholder="Name"
            required
          />
          <input
            type="text"
            value={form.designation}
            onChange={(e) => handleFormChange("designation", e.target.value)}
            placeholder="Designation"
            required
          />
          <input
            type="text"
            value={form.organization}
            onChange={(e) => handleFormChange("organization", e.target.value)}
            placeholder="Organization"
            required
          />
          <input
            type="text"
            value={form.location}
            onChange={(e) => handleFormChange("location", e.target.value)}
            placeholder="Location"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleFormChange("email", e.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="text"
            value={form.linkedin}
            onChange={(e) => handleFormChange("linkedin", e.target.value)}
            placeholder="LinkedIn"
          />
          <input
            type="text"
            value={form.mobile}
            onChange={(e) => handleFormChange("mobile", e.target.value)}
            placeholder="Mobile Number"
            required
          />
          <button
            type="submit"
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "9px 0",
              marginTop: 6,
              fontSize: 16,
            }}
          >
            Submit
          </button>
        </form>
      </Modal>

      <div className="resource-person-list">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="resource-person-row"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="resource-person-index" title="Drag to reorder">
              {index + 1}
            </div>

            <div className="resource-person-fields resource-person-fields-top">
              <input
                type="text"
                value={row.name}
                onChange={(e) => handleChange(row.id, "name", e.target.value)}
                placeholder="Name"
              />
              <input
                type="text"
                value={row.designation}
                onChange={(e) =>
                  handleChange(row.id, "designation", e.target.value)
                }
                placeholder="Designation"
              />
              <input
                type="text"
                value={row.organization}
                onChange={(e) =>
                  handleChange(row.id, "organization", e.target.value)
                }
                placeholder="Organization"
              />
            </div>

            <div className="resource-person-fields resource-person-fields-bottom">
              <input
                type="text"
                value={row.location || ""}
                onChange={(e) =>
                  handleChange(row.id, "location", e.target.value)
                }
                placeholder="Enter Location (e.g., Chennai, Tamil Nadu)"
              />

              <div className="resource-person-profile">
                <span>Profile</span>
                <button
                  type="button"
                  className="resource-person-icon-btn resource-person-upload"
                  onClick={() =>
                    document.getElementById(`file-input-${row.id}`)?.click()
                  }
                  title="Upload"
                >
                  <CloudUpload size={16} />
                </button>
                <input
                  id={`file-input-${row.id}`}
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const fileURL = URL.createObjectURL(file);
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
              </div>

              <div className="resource-person-row-actions">
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id)}
                    className="resource-person-icon-btn resource-person-delete"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                {index === rows.length - 1 && (
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="resource-person-add-row"
                    title="Add Row"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
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
      name: "",
      designation: "",
      organization: "",
      email: "",
      linkedin: "",
    },
  ]);

  const [formData, setFormData] = useState<Record<string, LetterSectionData>>(
    sections.reduce((acc, section) => {
      acc[section] = {
        active: false,
        mode: "Letter/ Email",
        date: "",
        file: null,
      };
      return acc;
    }, {} as Record<string, LetterSectionData>),
  );

  const eventId = 1;

  const [websiteEnabled, setWebsiteEnabled] = useState(false);
  const [websiteDate, setWebsiteDate] = useState("");
  const [websiteFile, setWebsiteFile] = useState<File | null>(null);

  const [newspaperEnabled, setNewspaperEnabled] = useState(false);
  const [newspaperDate, setNewspaperDate] = useState("");
  const [newspaperFile, setNewspaperFile] = useState<File | null>(null);

  const [pressEnabled, setPressEnabled] = useState(false);
  const [pressDate, setPressDate] = useState("");
  const [pressFile, setPressFile] = useState<File | null>(null);

  const [links, setLinks] = useState<SocialLinks>({
    facebook: "",
    x: "",
    instagram: "",
    linkedin: "",
  });

  const handleSendMail = (section: string): void => {
    window.location.href = `mailto:?subject=${encodeURIComponent(section)}`;
  };

  const openLink = (link: string): void => {
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  const uploadFile = async (file: File): Promise<number | null> => {
    if (!file) return null;
    const data = new FormData();
    data.append("file", file);
    try {
      const response = await authenticityUtility.postFile(
        `/updates/events/${eventId}/uploads`,
        data,
      ) as { upload: { id: number } };
      return response.upload.id;
    } catch (err) {
      console.error("File upload failed", err);
      alert("Failed to upload file: " + file.name);
      return null;
    }
  };

  const handleSubmit = async (): Promise<void> => {
    console.log("handleSubmit called");
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

      alert("✅ Event updates saved successfully!");
      goToTab("post-event");
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      alert("Error occurred, please check console.");
    }
  };

  return (
    <div className="event-updates-page">
      {/* Publicity Box */}
      <div className="event-card-section event-form-section">
        <h2 className="event-section-title">Publicity</h2>

        <div className="event-row-section">
          <label className="event-section-label">
            Website Scrolling
          </label>
          <button
            type="button"
            className="event-send-mail-btn active"
            onClick={() => handleSendMail("Website Scrolling")}
          >
            Send Mail
          </button>
          <input
            type="date"
            value={websiteDate}
            onChange={(e) => setWebsiteDate(e.target.value)}
            className="event-date-input"
          />
        </div>

        <div className="event-row-section">
          <label className="event-section-label">
            Newspaper Engagement
          </label>
          <button
            type="button"
            className="event-send-mail-btn active"
            onClick={() => handleSendMail("Newspaper Engagement")}
          >
            Send Mail
          </button>
          <input
            type="date"
            value={newspaperDate}
            onChange={(e) => setNewspaperDate(e.target.value)}
            className="event-date-input"
          />
        </div>

        <div className="event-row-section">
          <label className="event-section-label">
            Press Report
          </label>
          <button
            type="button"
            className="event-send-mail-btn active"
            onClick={() => handleSendMail("Press Report")}
          >
            Send Mail
          </button>
          <input
            type="date"
            value={pressDate}
            onChange={(e) => setPressDate(e.target.value)}
            className="event-date-input"
          />
        </div>

        <div className="event-social-grid">
          {(["facebook", "x", "instagram", "linkedin"] as const).map((platform) => (
            <div key={platform}>
              <input
                type="text"
                className="event-big-social-input"
                placeholder={`${platform.charAt(0).toUpperCase() + platform.slice(1)
                  } link`}
                value={links[platform]}
                onChange={(e) =>
                  setLinks({ ...links, [platform]: e.target.value })
                }
              />
              <button
                type="button"
                className="event-social-view-btn"
                onClick={() => openLink(links[platform])}
                disabled={!links[platform]}
                title={`View ${platform} link`}
                aria-label={`View ${platform} link`}
              >
                <Eye size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ResourcePerson rows={rows} setRows={setRows} />
      <LettersPage formData={formData} setFormData={setFormData} />

      <div className="event-section-navigation">
        <button
          type="button"
          className="event-prev-btn"
          onClick={() => goToTab("finance")}
        >
          ← Previous
        </button>
        <button type="button" className="event-next-btn" onClick={handleSubmit}>
          Save & Next →
        </button>
      </div>
    </div>
  );
};

export default EventUpdates;
