import React, { useState, useEffect, ChangeEvent } from "react";
import "../styles/EventForm.css";
import { CloudUpload, Eye, Plus, Trash2 } from "lucide-react";
import authenticityUtility from "../../../shared/utils/authenticityUtility";

interface ParticipantType {
  value: string;
  label: string;
}

interface Participant {
  id?: number;
  type: string;
  label: string;
  count: number;
}

interface LinkState {
  enabled: boolean;
  url: string;
}

interface DocState {
  active: boolean;
  file: File | File[] | (File | null)[] | null;
}

interface ParticipantsPageProps {
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  eventId: number | string;
}

interface ImportantLinksPageProps {
  eventId: number | string;
}

interface DocumentsPageProps {
  goToTab: (tab: string) => void;
  eventId?: string;
}

const participantTypes: ParticipantType[] = [
  { value: "internal-students", label: "Internal Students" },
  { value: "external-students", label: "External Students" },
  { value: "faculty", label: "Faculty Members" },
  { value: "research-scholars", label: "Research Scholars" },
  { value: "industry-experts", label: "Industry Experts" },
  { value: "alumni", label: "Alumni" },
  { value: "general-public", label: "General Public" },
];

const ParticipantsPage: React.FC<ParticipantsPageProps> = ({ participants, setParticipants, eventId }) => {
  const [selectedType, setSelectedType] = useState("");
  const [count, setCount] = useState("");

  const handleAdd = async () => {
    if (selectedType && count !== "" && !isNaN(Number(count))) {
      const foundType = participantTypes.find((t) => t.value === selectedType);
      setParticipants((prev) => [
        ...prev,
        {
          type: selectedType,
          label: foundType?.label || selectedType,
          count: parseInt(count, 10),
        },
      ]);
      setSelectedType("");
      setCount("");

      try {
        await authenticityUtility.post(`/documents/${eventId}/participant`, {
          type: selectedType,
          count: parseInt(count, 10),
        });
      } catch (error) {
        console.error("Error adding participant:", error);
      }
    }
  };

  const handleDelete = async (index: number, participantId?: number) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index));

    try {
      if (participantId) {
        await authenticityUtility.delete(
          `/documents/participant/${participantId}`,
        );
      }
    } catch (error) {
      console.error("Error deleting participant:", error);
    }
  };

  const total = participants.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="event-card-section">
      <h2 className="event-section-title">Participants</h2>

      <div className="event-participant-card">
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

        <input
          type="number"
          min="0"
          className="event-participant-input"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="Count"
        />

        <button type="button" className="event-add" onClick={handleAdd}>
          <Plus size={16} />
        </button>
      </div>

      {participants.length > 0 && (
        <div>
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
              {participants.map((p, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{p.label}</td>
                  <td>{p.count}</td>
                  <td>
                    <button
                      type="button"
                      className="event-cancel-btn"
                      onClick={() => handleDelete(index, p.id)}
                      style={{
                        color: "black",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: "16px",
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="event-participants-total">
            <strong>Total Participants:</strong> {total}
          </div>
        </div>
      )}
    </div>
  );
};

const ImportantLinksPage: React.FC<ImportantLinksPageProps> = ({ eventId }) => {
  const [registration, setRegistration] = useState<LinkState>({ enabled: false, url: "" });
  const [feedback, setFeedback] = useState<LinkState>({ enabled: false, url: "" });
  const [youtubeLinks, setYoutubeLinks] = useState<LinkState[]>([
    { enabled: false, url: "" },
  ]);

  useEffect(() => {
    const loadLinks = async () => {
      try {
        const response = await authenticityUtility.get(
          `/documents/${eventId}/links`,
        ) as { registration: LinkState; feedback: LinkState; youtube: LinkState[] };
        const { registration: reg, feedback: fb, youtube } = response;
        setRegistration(reg);
        setFeedback(fb);
        setYoutubeLinks(youtube);
      } catch (error) {
        console.error("Error loading links:", error);
      }
    };
    if (eventId) loadLinks();
  }, [eventId]);

  const saveLinks = async () => {
    try {
      await authenticityUtility.put(`/documents/${eventId}/links`, {
        registration,
        feedback,
        youtube: youtubeLinks,
      });
    } catch (error) {
      console.error("Error saving links:", error);
    }
  };

  const handleAddYoutube = () => {
    setYoutubeLinks([...youtubeLinks, { enabled: true, url: "" }]);
    setTimeout(saveLinks, 100);
  };

  const handleDeleteYoutube = (index: number) => {
    setYoutubeLinks(youtubeLinks.filter((_, i) => i !== index));
    setTimeout(saveLinks, 100);
  };

  return (
    <div className="event-card-section">
      <h2 className="event-section-title">Important Links</h2>
      <div className="event-doc-rows">
        <div className="event-doc-row">
          <span className="event-doc-label">Feedback Link</span>
          <label className="event-switch" style={{ marginLeft: "10px" }}>
            <input
              type="checkbox"
              checked={feedback.enabled}
              onChange={() => {
                setFeedback((prev) => ({ ...prev, enabled: !prev.enabled }));
                setTimeout(saveLinks, 100);
              }}
            />
            <span className="event-slider"></span>
          </label>
          <div
            className="event-input-with-icon"
            style={{ flex: 1, display: "flex", marginLeft: "15px" }}
          >
            <input
              type="url"
              placeholder="Enter feedback link"
              className="event-full-width-input"
              value={feedback.url}
              onChange={(e) => {
                setFeedback((prev) => ({ ...prev, url: e.target.value }));
                setTimeout(saveLinks, 500);
              }}
              disabled={!feedback.enabled}
              style={{ flex: 1, paddingRight: "40px" }}
            />
            <button
              type="button"
              className="icon-btn"
              style={{ marginLeft: "8px" }}
              onClick={() =>
                feedback.url && window.open(feedback.url, "_blank")
              }
              disabled={!feedback.url}
            >
              <Eye size={16} />
            </button>
          </div>
        </div>

        <div className="event-doc-row">
          <span className="event-doc-label">YouTube Links</span>
          <label className="event-switch" style={{ marginLeft: "10px" }}>
            <input
              type="checkbox"
              checked={youtubeLinks[0]?.enabled || false}
              onChange={() => {
                setYoutubeLinks((prev) =>
                  prev.map((item, i) =>
                    i === 0 ? { ...item, enabled: !item.enabled } : item,
                  ),
                );
                setTimeout(saveLinks, 100);
              }}
            />
            <span className="event-slider"></span>
          </label>
        </div>

        {youtubeLinks.map((yt, index) => (
          <div className="event-doc-row" key={index}>
            <div
              className="event-input-with-icon"
              style={{ flex: 1, display: "flex" }}
            >
              <input
                type="url"
                placeholder="Enter YouTube link"
                className="event-full-width-input"
                value={yt.url}
                onChange={(e) => {
                  setYoutubeLinks((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, url: e.target.value } : item,
                    ),
                  );
                  setTimeout(saveLinks, 500);
                }}
                disabled={!youtubeLinks[0]?.enabled}
                style={{ flex: 1, paddingRight: "40px" }}
              />
              <button
                type="button"
                className="icon-btn"
                style={{ marginLeft: "8px" }}
                onClick={() => yt.url && window.open(yt.url, "_blank")}
                disabled={!yt.url}
              >
                <Eye size={16} />
              </button>
            </div>

            <div className="eye-icon" style={{ marginLeft: "10px" }}>
              {index === youtubeLinks.length - 1 && (
                <button
                  type="button"
                  className="event-add"
                  onClick={handleAddYoutube}
                  disabled={!youtubeLinks[0]?.enabled}
                >
                  <Plus size={16} />
                </button>
              )}
              {youtubeLinks.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleDeleteYoutube(index)}
                  disabled={!youtubeLinks[0]?.enabled}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const documents = [
  "Brochure/ Flyer",
  "Invitation",
  "Agenda",
  "Schedule",
  "Report",
  "Photos",
  "Resource Person_Invitation",
  "Resource Person_Thanks",
  "Attendance sheet",
  "Participants List",
  "Sample Certificate",
];

const DocumentsPage: React.FC<DocumentsPageProps> = ({ eventId = "1" }) => {
  const [docState, setDocState] = useState<Record<string, DocState>>(
    documents.reduce((acc, doc) => {
      acc[doc] = {
        active: false,
        file: doc === "Photos" ? ([null, null, null, null] as (File | null)[]) : null,
      };
      return acc;
    }, {} as Record<string, DocState>),
  );

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [popupMessage, setPopupMessage] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await authenticityUtility.get(`/documents/${eventId}`) as {
          documents?: Array<{ docname: string; active: boolean }>;
          participants?: Array<{ id: number; type: string; count: number }>;
        };
        const { documents: backendDocs, participants: backendParticipants } = response;

        if (backendDocs) {
          const newDocState = { ...docState };
          backendDocs.forEach((doc) => {
            if (newDocState[doc.docname]) {
              newDocState[doc.docname].active = doc.active;
            }
          });
          setDocState(newDocState);
        }

        if (backendParticipants) {
          const formattedParticipants = backendParticipants.map((p) => ({
            id: p.id,
            type: p.type,
            label:
              participantTypes.find((t) => t.value === p.type)?.label || p.type,
            count: p.count,
          }));
          setParticipants(formattedParticipants);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };

    loadData();
  }, [eventId]);

  const handleToggle = (doc: string) => {
    setDocState((prev) => ({
      ...prev,
      [doc]: {
        ...prev[doc],
        active: !prev[doc].active,
      },
    }));

    const syncWithBackend = async () => {
      try {
        const newActiveState = !docState[doc].active;
        await authenticityUtility.put(
          `/documents/${eventId}/doc/${encodeURIComponent(doc)}`,
          {
            active: newActiveState,
            upload_id: null,
          },
        );
      } catch (error) {
        console.error("Error updating document:", error);
      }
    };
    syncWithBackend();
  };

  const handleFileUpload = async (doc: string, event: ChangeEvent<HTMLInputElement>, index: number | null = null) => {
    const file = event.target.files?.[0];
    if (file) {
      setDocState((prev) => {
        if (doc === "Photos" && index !== null) {
          const currentFiles = prev[doc].file as (File | null)[];
          const newFiles = [...currentFiles];
          newFiles[index] = file;
          return {
            ...prev,
            [doc]: { ...prev[doc], file: newFiles },
          };
        } else {
          return {
            ...prev,
            [doc]: { ...prev[doc], file },
          };
        }
      });

      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await authenticityUtility.postFile(
          `/documents/${eventId}/doc/${encodeURIComponent(doc)}/upload`,
          formData,
        );
        // console.log("File uploaded:", response);
      } catch (error) {
        console.error("Error uploading file:", error);
        alert("Failed to upload file: " + file.name);
      }
    }
  };

  const handleViewFile = (doc: string, index: number | null = null) => {
    const docData = docState[doc];
    const file = doc === "Photos" && index !== null
      ? (docData.file as (File | null)[])[index]
      : docData.file as File | null;
    if (file) {
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, "_blank");
    }
  };

  const handleEditRequest = async () => {
    try {
      await authenticityUtility.post(`/documents/${eventId}/edit-request`);
      setPopupMessage("Your edit request has been sent successfully!");
    } catch (error) {
      console.error("Error sending edit request:", error);
      setPopupMessage("Failed to send edit request. Please try again.");
    }
  };

  const handleSubmitApproval = async () => {
    try {
      await authenticityUtility.post(`/documents/${eventId}/submit`);
      setPopupMessage("Your form has been submitted for approval!");
    } catch (error) {
      console.error("Error submitting for approval:", error);
      setPopupMessage("Failed to submit for approval. Please try again.");
    }
  };

  const closePopup = () => {
    setPopupMessage("");
  };

  const mid = Math.ceil(documents.length / 2);
  const leftDocs = documents.slice(0, mid);
  const rightDocs = documents.slice(mid);

  const renderDocRow = (doc: string) => {
    if (doc === "Photos") {
      const photoFiles = docState[doc].file as (File | null)[];
      return (
        <div className="event-doc-row" key={doc}>
          <span className="event-doc-label">{doc}</span>
          <label className="event-switch">
            <input
              type="checkbox"
              checked={docState[doc].active}
              onChange={() => handleToggle(doc)}
            />
            <span className="event-slider"></span>
          </label>

          <div className="event-multi-upload">
            {photoFiles.map((_, i) => (
              <div key={i} className="event-upload-box">
                <label
                  className={`event-upload-icon ${!docState[doc].active ? "disabled" : ""
                    }`}
                >
                  <CloudUpload size={16} />
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(doc, e, i)}
                    style={{ display: "none" }}
                    disabled={!docState[doc].active}
                  />
                </label>

                <span
                  className={`event-eye-icon ${!photoFiles[i] ? "disabled" : ""
                    }`}
                  onClick={() =>
                    photoFiles[i] && handleViewFile(doc, i)
                  }
                >
                  <Eye size={16} />
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="event-doc-row" key={doc}>
        <span className="event-doc-label">{doc}</span>
        <label className="event-switch">
          <input
            type="checkbox"
            checked={docState[doc].active}
            onChange={() => handleToggle(doc)}
          />
          <span className="event-slider"></span>
        </label>
        <label
          className={`event-upload-icon ${!docState[doc].active ? "disabled" : ""}`}
        >
          <CloudUpload size={16} />
          <input
            type="file"
            onChange={(e) => handleFileUpload(doc, e)}
            style={{ display: "none" }}
            disabled={!docState[doc].active}
          />
        </label>
        <span
          className={`event-eye-icon ${!docState[doc].file ? "disabled" : ""}`}
          onClick={() => docState[doc].file && handleViewFile(doc)}
        >
          <Eye size={16} />
        </span>
      </div>
    );
  };

  return (
    <div>
      <ParticipantsPage
        participants={participants}
        setParticipants={setParticipants}
        eventId={eventId}
      />

      <ImportantLinksPage eventId={eventId} />

      <div className="event-card-section">
        <h2 className="event-section-title">Documents</h2>
        <div className="event-docs-grid">
          <div className="event-docs-column">{leftDocs.map(renderDocRow)}</div>
          <div className="event-docs-column">{rightDocs.map(renderDocRow)}</div>
        </div>
      </div>

      <div className="event-doc-buttons">
        <button
          type="button"
          className="event-btn event-submit"
          onClick={handleEditRequest}
        >
          Edit Request
        </button>
        <button
          type="button"
          className="event-btn event-submit"
          onClick={handleSubmitApproval}
        >
          Submit for Approval
        </button>
      </div>

      {popupMessage && (
        <div className="event-message-overlay">
          <div className="event-message-box">
            <h3>{popupMessage}</h3>
            <button onClick={closePopup}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
