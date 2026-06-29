import React, { useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2, Upload } from "lucide-react";
import "../../finance/financeapproval.css";
import "../styles/EventApprovalCards.css";
import CustomTagInput from "../../../shared/components/ui/CustomTagInput";
import {
  EVENT_APPROVAL_FEE_MONTHS,
  EVENT_APPROVAL_OPTIONS,
  EVENT_SESSION_OPTIONS,
  EVENT_OPEN_TO_OPTIONS,
  EVENT_GENDER_RESTRICTION_OPTIONS,
  EVENT_ACCOMMODATION_TYPE_OPTIONS,
} from "../constants";
export interface EventApprovalFormData {
  name: string;
  category: string;
  eventType: string;
  level: string;
  expectedParticipants: string;
  themes: string[];
  sdgs: string[];
  dateFrom: string;
  dateTo: string;
  numberOfDays: string;
  mode: string;
  session: string;
  venue: string;
  meetingLink: string;
  eligibleParticipants: string;
  openTo: string;
  genderRestriction: string;
  minAge: string;
  maxAge: string;
  eventFlyerName: string;
  registrationSettingsEnabled: boolean;
  registrationStatus: string;
  lastDate: string;
  extension: boolean;
  extendedDate: string;
  shortlistingRequired: boolean;
  selectionIntimation: string;
  teamEnabled: boolean;
  minTeamSize: string;
  maxTeamSize: string;
  documentEnabled: boolean;
  documentName: string;
  documentType: string;
  documentSize: string;
  registrationFeeEnabled: boolean;
  feeRows: FeeRow[];
  collaborators: CollaboratorRow[];
  sponsoringAgencies: CollaboratorRow[];
  coordinators: CoordinatorRow[];
  accommodationEnabled: boolean;
  accommodationType: "Free" | "Paid";
  gentsAccommodationLimit: string;
  ladiesAccommodationLimit: string;
  ceremonyEnabled: boolean;
  inauguralEnabled: boolean;
  inauguralDate: string;
  inauguralTime: string;
  inauguralVenue: string;
  valedictoryEnabled: boolean;
  valedictoryDate: string;
  valedictoryTime: string;
  valedictoryVenue: string;
}

interface FeeRow {
  id: string;
  participantCategory: string;
  individual: string;
  team: string;
  members: string;
  additionalMember: string;
  description: string;
  monthAmounts: Record<string, string>;
}

interface CollaboratorRow {
  id: string;
  type: string;
  name: string;
}

interface CoordinatorRow {
  id: string;
  name: string;
  department: string;
  email: string;
  institution: string;
}

interface EventApprovalCardsProps {
  title?: string;
  eventNumber?: number;
  submitLabel?: string;
  showFooter?: boolean;
  showHeaderActions?: boolean;
  showExtendedSections?: boolean;
  onSubmit?: (data: EventApprovalFormData) => void | Promise<void>;
}

const makeId = () => `${Date.now()}-${Math.random()}`;
const FEE_MONTHS = EVENT_APPROVAL_FEE_MONTHS;

const createMonthAmounts = () =>
  FEE_MONTHS.reduce<Record<string, string>>((months, month) => {
    months[month] = "";
    return months;
  }, {});

const createFeeRow = (): FeeRow => ({
  id: makeId(),
  participantCategory: "",
  individual: "",
  team: "",
  members: "",
  additionalMember: "",
  description: "",
  monthAmounts: createMonthAmounts(),
});

const createCollaborator = (): CollaboratorRow => ({
  id: makeId(),
  type: "",
  name: "",
});

const createCoordinator = (): CoordinatorRow => ({
  id: makeId(),
  name: "",
  department: "",
  email: "",
  institution: "",
});

const createInitialFormData = (): EventApprovalFormData => ({
  name: "",
  category: "",
  eventType: "",
  level: "",
  expectedParticipants: "",
  themes: [],
  sdgs: [],
  dateFrom: "",
  dateTo: "",
  numberOfDays: "",
  mode: "Physical",
  session: "",
  venue: "",
  meetingLink: "",
  eligibleParticipants: "",
  openTo: "Any",
  genderRestriction: "Any",
  minAge: "",
  maxAge: "",
  eventFlyerName: "",
  registrationSettingsEnabled: false,
  registrationStatus: "Open",
  lastDate: "",
  extension: false,
  extendedDate: "",
  shortlistingRequired: false,
  selectionIntimation: "",
  teamEnabled: false,
  minTeamSize: "",
  maxTeamSize: "",
  documentEnabled: false,
  documentName: "",
  documentType: "",
  documentSize: "",
  registrationFeeEnabled: false,
  feeRows: [createFeeRow()],
  collaborators: [createCollaborator()],
  sponsoringAgencies: [createCollaborator()],
  coordinators: [createCoordinator()],
  accommodationEnabled: false,
  accommodationType: "Free",
  gentsAccommodationLimit: "",
  ladiesAccommodationLimit: "",
  ceremonyEnabled: false,
  inauguralEnabled: false,
  inauguralDate: "",
  inauguralTime: "",
  inauguralVenue: "",
  valedictoryEnabled: false,
  valedictoryDate: "",
  valedictoryTime: "",
  valedictoryVenue: "",
});

const options = EVENT_APPROVAL_OPTIONS;

const EventApprovalCards: React.FC<EventApprovalCardsProps> = ({
  title = "Event 1",
  eventNumber = 1,
  submitLabel = "Save Event",
  showFooter = true,
  showHeaderActions = true,
  showExtendedSections = false,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<EventApprovalFormData>(createInitialFormData);
  const [additionalEvents, setAdditionalEvents] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [themeSearchQuery, setThemeSearchQuery] = useState('');
  const [sdgSearchQuery, setSdgSearchQuery] = useState('');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState("");
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState("");
  const [eventExpanded, setEventExpanded] = useState(true);
  const [ageRestrictionType, setAgeRestrictionType] = useState<"Any" | "Range">("Any");
  const minAgeInputRef = useRef<HTMLInputElement | null>(null);
  const maxAgeInputRef = useRef<HTMLInputElement | null>(null);

  const numberOfDays = useMemo(() => {
    if (!formData.dateFrom || !formData.dateTo) return formData.numberOfDays;
    const start = new Date(formData.dateFrom);
    const end = new Date(formData.dateTo);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return formData.numberOfDays;
    }
    return String(Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  }, [formData.dateFrom, formData.dateTo, formData.numberOfDays]);

  const setField = <K extends keyof EventApprovalFormData>(field: K, value: EventApprovalFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleModeChange = (mode: string) => {
    setFormData((current) => ({
      ...current,
      mode,
      meetingLink: mode === "Physical" ? "" : current.meetingLink,
    }));
  };

  const getSelectClassName = (value: string) =>
    value ? "event-approval-select has-value" : "event-approval-select is-placeholder";

  const resetForm = () => {
    const nextFormData = createInitialFormData();
    setFormData(nextFormData);
    setSelectedCollaboratorId("");
    setSelectedCoordinatorId("");
  };

  const addEvent = () => {
    setAdditionalEvents((count) => count + 1);
  };

  const select = (
    field: keyof EventApprovalFormData,
    selectOptions: string[],
    placeholder = "",
    disabled = false
  ) => (
    <select
      className={getSelectClassName(String(formData[field] || ""))}
      value={String(formData[field] || "")}
      onChange={(event) => setField(field as any, event.target.value as any)}
      disabled={disabled}
    >
      <option value="">{placeholder || "Select"}</option>
      {selectOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );


  const updateRow = <T extends FeeRow | CollaboratorRow | CoordinatorRow>(
    collection: "feeRows" | "collaborators" | "sponsoringAgencies" | "coordinators",
    id: string,
    field: keyof T,
    value: string
  ) => {
    setFormData((current) => ({
      ...current,
      [collection]: (current[collection] as T[]).map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    }));
  };

  const addRow = (collection: "feeRows" | "collaborators" | "sponsoringAgencies" | "coordinators") => {
    const factory = collection === "feeRows" ? createFeeRow : collection === "coordinators" ? createCoordinator : createCollaborator;
    const newRow = factory();
    setFormData((current) => ({
      ...current,
      [collection]: [...(current[collection] as any[]), newRow],
    }));
  };

  const deleteRow = (collection: "feeRows" | "collaborators" | "sponsoringAgencies" | "coordinators", id: string) => {
    setFormData((current) => {
      const rows = current[collection] as any[];
      if (rows.length === 1) return current;
      const nextRows = rows.filter((row) => row.id !== id);
      if (collection === "collaborators" && selectedCollaboratorId === id) {
        setSelectedCollaboratorId(nextRows[0]?.id || "");
      }
      if (collection === "coordinators" && selectedCoordinatorId === id) {
        setSelectedCoordinatorId(nextRows[0]?.id || "");
      }
      return { ...current, [collection]: nextRows };
    });
  };

  const handleSubmit = async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ ...formData, numberOfDays });
    } finally {
      setSubmitting(false);
    }
  };

  const showMeetingLink = formData.mode === "Virtual" || formData.mode === "Hybrid";
  const sessionOptions = EVENT_SESSION_OPTIONS;

  return (
    <div className="event-approval-page journal-form-body">
      <div className="journal-form-container event-approval-container">
      <section className="event-approval-card form-card">
        {(title || showHeaderActions) && (
          <div className="event-approval-title-row">
            {title && <h2>{title}</h2>}
            {showHeaderActions && (
              <div className="event-approval-icon-actions">
                <HeaderCollapseButton
                  expanded={eventExpanded}
                  onClick={() => setEventExpanded((expanded) => !expanded)}
                />
                <button type="button" title="Add event" aria-label="Add event" onClick={addEvent}>
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  className="muted"
                  title="Delete event"
                  aria-label="Delete event"
                  onClick={resetForm}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {eventExpanded && (
          <>
        <div className="event-approval-section-heading">Event Details</div>
        <label className="span-4">
          Event Name
          <input placeholder="Event Name" value={formData.name} onChange={(event) => setField("name", event.target.value)} />
        </label>
        <div className="event-approval-grid four">
          <label>Category{select("category", options.categories)}</label>
          <label>Type{select("eventType", options.types)}</label>
          <label>Level{select("level", options.levels)}</label>
          <label>
            Expected Participants
            <input placeholder="Expected Participants" value={formData.expectedParticipants} onChange={(event) => setField("expectedParticipants", event.target.value)} />
          </label>
        </div>
        <div className="event-approval-grid two event-approval-theme-grid">
          <label>
            Theme
            <CustomTagInput
              name="themes"
              value={formData.themes}
              onChange={(values) => setField("themes", values)}
              suggestions={options.theme.filter(t => 
                t.toLowerCase().includes(themeSearchQuery.toLowerCase()) && 
                !formData.themes.includes(t)
              )}
              onSearch={setThemeSearchQuery}
              placeholder={formData.themes.length === 0 ? "Type to search and select themes" : ""}
              className="mb-0 mt-1"
            />
          </label>
          <label>
            SDG
            <CustomTagInput
              name="sdgs"
              value={formData.sdgs}
              onChange={(values) => setField("sdgs", values)}
              suggestions={options.sdg.filter(s => 
                s.toLowerCase().includes(sdgSearchQuery.toLowerCase()) && 
                !formData.sdgs.includes(s)
              )}
              onSearch={setSdgSearchQuery}
              placeholder={formData.sdgs.length === 0 ? "Type to search and select SDGs" : ""}
              className="mb-0 mt-1"
            />
          </label>
        </div>

        <div className="event-approval-section-heading spaced">Schedule & Venue</div>
        <div className="event-approval-grid schedule-top">
          <label className="schedule-date-from">
            Date (From)
            <input className={formData.dateFrom ? "has-value" : "is-placeholder"} type="date" placeholder="DD/MM/YYYY" value={formData.dateFrom} onChange={(event) => setField("dateFrom", event.target.value)} />
          </label>
          <label className="schedule-date-to">
            Date (To)
            <input className={formData.dateTo ? "has-value" : "is-placeholder"} type="date" placeholder="DD/MM/YYYY" value={formData.dateTo} onChange={(event) => setField("dateTo", event.target.value)} />
          </label>
          <div className="event-approval-schedule-card schedule-days">
            <span className="schedule-field-title">No. of Days</span>
            <input placeholder="No. of Days" value={numberOfDays} onChange={(event) => setField("numberOfDays", event.target.value)} />
          </div>
          <div className="event-approval-schedule-card schedule-session">
            <Segmented
              label="Session"
              value={formData.session}
              options={sessionOptions}
              onChange={(value) => setField("session", value)}
            />
          </div>
        </div>
        <div className="event-approval-grid schedule-bottom">
          <div className="event-approval-schedule-card schedule-mode">
            <Segmented
              label="Mode"
              value={formData.mode}
              options={options.mode}
              onChange={(value) => handleModeChange(value)}
            />
          </div>
          {formData.mode !== "Virtual" && (
            <label className="schedule-venue">Venue{select("venue", options.venue)}</label>
          )}
          {showMeetingLink && (
            <label className="schedule-meeting">
              Meeting link
              <input placeholder="Meeting Link" value={formData.meetingLink} onChange={(event) => setField("meetingLink", event.target.value)} />
            </label>
          )}
        </div>
          </>
        )}
      </section>

      {eventExpanded && (
        <>
      <section className="event-approval-card form-card">
        <div className="event-approval-section-heading with-toggle">
          <span>Registration Settings</span>
          <Switch checked={formData.registrationSettingsEnabled} onChange={(value) => setField("registrationSettingsEnabled", value)} />
        </div>
        {formData.registrationSettingsEnabled && (
        <>
          <div className="event-approval-registration-top">
          <label>Eligible Participants{select("eligibleParticipants", options.participants)}</label>
          <label className="event-approval-flyer-field">
            Event Flyer
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => setField("eventFlyerName", event.target.files?.[0]?.name || "")}
            />
            <span className="event-approval-file-button">
              <Upload size={14} />
              {formData.eventFlyerName || "Choose File"}
            </span>
          </label>
        </div>
        <div className="event-approval-controls-row">
          <Segmented label="Open to" value={formData.openTo} options={EVENT_OPEN_TO_OPTIONS} onChange={(value) => setField("openTo", value)} />
          <Segmented label="Gender Restriction" value={formData.genderRestriction} options={EVENT_GENDER_RESTRICTION_OPTIONS} onChange={(value) => setField("genderRestriction", value)} />
          <div className="event-approval-age-control">
            <span>Age Restriction</span>
            <div className="event-approval-age-control-row">
              <button
                type="button"
                className={ageRestrictionType === "Any" ? "active" : ""}
                onClick={() => {
                  setAgeRestrictionType("Any");
                  setField("minAge", "");
                  setField("maxAge", "");
                }}
              >
                Any
              </button>
              <div
                className={`event-approval-age-option ${ageRestrictionType === "Range" ? "active" : ""}`}
                onClick={() => {
                  setAgeRestrictionType("Range");
                  minAgeInputRef.current?.focus();
                }}
              >
                <span>Minimum</span>
                <input
                  ref={minAgeInputRef}
                  placeholder=""
                  value={formData.minAge}
                  onChange={(event) => setField("minAge", event.target.value)}
                  disabled={ageRestrictionType !== "Range"}
                />
                <span>Maximum</span>
                <input
                  ref={maxAgeInputRef}
                  placeholder=""
                  value={formData.maxAge}
                  onChange={(event) => setField("maxAge", event.target.value)}
                  disabled={ageRestrictionType !== "Range"}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="event-approval-band registration">
          <div className="event-approval-registration-box">
            <Segmented
              label="Registration Status"
              value={formData.registrationStatus || "Open"}
              options={options.status}
              onChange={(value) => setField("registrationStatus", value)}
            />
            <label>Last Date<input className={formData.lastDate ? "has-value" : "is-placeholder"} type="date" placeholder="DD/MM/YYYY" value={formData.lastDate} onChange={(event) => setField("lastDate", event.target.value)} /></label>
          </div>
          <div className="event-approval-registration-box">
            <TogglePair label="Extension" value={formData.extension} onChange={(value) => setField("extension", value)} />
            <label>Extended Date<input className={formData.extendedDate ? "has-value" : "is-placeholder"} type="date" placeholder="DD/MM/YYYY" value={formData.extendedDate} onChange={(event) => setField("extendedDate", event.target.value)} /></label>
          </div>
          <div className="event-approval-registration-box wide">
            <TogglePair label="Shortlisting required" value={formData.shortlistingRequired} onChange={(value) => setField("shortlistingRequired", value)} />
            <label>Selection Intimation<input className={formData.selectionIntimation ? "has-value" : "is-placeholder"} type="date" placeholder="DD/MM/YYYY" value={formData.selectionIntimation} onChange={(event) => setField("selectionIntimation", event.target.value)} /></label>
          </div>
        </div>
        <div className="event-approval-split">
          <MiniCard
            title="Team Participation"
            enabled={formData.teamEnabled}
            onToggle={(value) => setField("teamEnabled", value)}
            className="event-approval-mini-card-team"
          >
            <label>Minimum Team Size<input placeholder="" value={formData.minTeamSize} onChange={(event) => setField("minTeamSize", event.target.value)} /></label>
            <label>Maximum Team Size<input placeholder="" value={formData.maxTeamSize} onChange={(event) => setField("maxTeamSize", event.target.value)} /></label>
          </MiniCard>
          <MiniCard
            title="Document Upload"
            enabled={formData.documentEnabled}
            onToggle={(value) => setField("documentEnabled", value)}
            columns={3}
            className="event-approval-mini-card-doc"
          >
            <label>Document Name{select("documentName", options.documentName)}</label>
            <label>Type{select("documentType", options.documentType)}</label>
            <label>Size{select("documentSize", options.documentSize)}</label>
          </MiniCard>
        </div>
        </>
        )}
      </section>

      <section className="event-approval-card form-card">
        <div className="event-approval-section-heading with-toggle">
          <span>Registration fees</span>
          <Switch checked={formData.registrationFeeEnabled} onChange={(value) => setField("registrationFeeEnabled", value)} />
        </div>
        {formData.registrationFeeEnabled && (
        <div className="event-approval-table-wrap">
            <table className="budgetEntryTable">
              <colgroup>
                <col className="participant-category-column" />
                <col className="fee-column" />
                <col className="fee-column" />
                <col className="member-column" />
                <col className="additional-member-column" />
                <col className="action-column" />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>Participant Category</th>
                  <th colSpan={4}>Registration Fees</th>
                  <th rowSpan={2}>Action</th>
                </tr>
                <tr>
                  <th>Individual</th>
                  <th>Team</th>
                  <th>Member</th>
                  <th>Additional Member</th>
                </tr>
              </thead>
              <tbody>
                {formData.feeRows.map((row, index) => (
                  <tr key={row.id}>
                    <td><select disabled={!formData.registrationFeeEnabled} className="tableSelect" value={row.participantCategory} onChange={(event) => updateRow<FeeRow>("feeRows", row.id, "participantCategory", event.target.value)}><option value="">Select</option>{options.participantCategory.map((option) => <option key={option}>{option}</option>)}</select></td>
                    <td><input className="tableInput" placeholder="Amount" disabled={!formData.registrationFeeEnabled} value={row.individual} onChange={(event) => updateRow<FeeRow>("feeRows", row.id, "individual", event.target.value)} /></td>
                    <td><input className="tableInput" placeholder="Amount" disabled={!formData.registrationFeeEnabled} value={row.team} onChange={(event) => updateRow<FeeRow>("feeRows", row.id, "team", event.target.value)} /></td>
                    <td><input className="tableInput" placeholder="Members" disabled={!formData.registrationFeeEnabled} value={row.members} onChange={(event) => updateRow<FeeRow>("feeRows", row.id, "members", event.target.value)} /></td>
                    <td><input className="tableInput" placeholder="Amount" disabled={!formData.registrationFeeEnabled} value={row.additionalMember} onChange={(event) => updateRow<FeeRow>("feeRows", row.id, "additionalMember", event.target.value)} /></td>
                    <td><IconActions showAdd={index === formData.feeRows.length - 1} onAdd={() => addRow("feeRows")} onDelete={() => deleteRow("feeRows", row.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="event-approval-subsection-heading spaced">Host & Collaborator</div>
        {formData.collaborators.map((row, index) => (
          <div className="event-approval-row-line" key={row.id}>
            <input
              type="radio"
              className="event-approval-radio-dot"
              name={`event-${eventNumber}-collaborator`}
              checked={selectedCollaboratorId === row.id}
              onChange={() => setSelectedCollaboratorId(row.id)}
              aria-label="Select collaborator row"
            />
            <select className={getSelectClassName(row.type)} value={row.type} onChange={(event) => updateRow<CollaboratorRow>("collaborators", row.id, "type", event.target.value)}><option value="">Select</option>{options.collaboratorType.map((option) => <option key={option}>{option}</option>)}</select>
            <input placeholder="Collaborator Name" value={row.name} onChange={(event) => updateRow<CollaboratorRow>("collaborators", row.id, "name", event.target.value)} />
            <IconActions showAdd={index === formData.collaborators.length - 1} onAdd={() => addRow("collaborators")} onDelete={() => deleteRow("collaborators", row.id)} />
          </div>
        ))}

        <div className="event-approval-subsection-heading spaced">Sponsoring Agency</div>
        {formData.sponsoringAgencies.map((row, index) => (
          <div className="event-approval-row-line" key={row.id}>
            <input
              type="radio"
              className="event-approval-radio-dot"
              name={`event-${eventNumber}-sponsor`}
              aria-label="Select sponsoring agency row"
            />
            <select className={getSelectClassName(row.type)} value={row.type} onChange={(event) => updateRow<CollaboratorRow>("sponsoringAgencies", row.id, "type", event.target.value)}>
              <option value="">Select</option>
              {options.collaboratorType.map((option) => <option key={option}>{option}</option>)}
            </select>
            <input placeholder="Agency Name" value={row.name} onChange={(event) => updateRow<CollaboratorRow>("sponsoringAgencies", row.id, "name", event.target.value)} />
            <IconActions showAdd={index === formData.sponsoringAgencies.length - 1} onAdd={() => addRow("sponsoringAgencies")} onDelete={() => deleteRow("sponsoringAgencies", row.id)} />
          </div>
        ))}

      </section>

      <section className="event-approval-card form-card">
        <div className="event-approval-section-heading">Coordinator</div>
        {formData.coordinators.map((row, index) => (
          <div className="event-approval-coordinator-card" key={row.id}>
            <input
              type="radio"
              className="event-approval-radio-dot"
              name={`event-${eventNumber}-coordinator`}
              checked={selectedCoordinatorId === row.id}
              onChange={() => setSelectedCoordinatorId(row.id)}
              aria-label="Select coordinator row"
            />
            <div className="event-approval-grid two">
              <select className={getSelectClassName(row.name)} value={row.name} onChange={(event) => updateRow<CoordinatorRow>("coordinators", row.id, "name", event.target.value)}><option value="">Select</option>{options.coordinator.map((option) => <option key={option}>{option}</option>)}</select>
              <input placeholder="Department" value={row.department} onChange={(event) => updateRow<CoordinatorRow>("coordinators", row.id, "department", event.target.value)} />
              <input placeholder="Email" value={row.email} onChange={(event) => updateRow<CoordinatorRow>("coordinators", row.id, "email", event.target.value)} />
              <input placeholder="Institution" value={row.institution} onChange={(event) => updateRow<CoordinatorRow>("coordinators", row.id, "institution", event.target.value)} />
            </div>
            <IconActions showAdd={index === formData.coordinators.length - 1} onAdd={() => addRow("coordinators")} onDelete={() => deleteRow("coordinators", row.id)} />
          </div>
        ))}
      </section>

      {(eventNumber !== 1 || showExtendedSections) && (
        <section className="event-approval-card event-approval-last-card form-card">
          <div className="event-approval-section-heading with-toggle">
            <span>Inaugural and Valedictory Details</span>
            <Switch checked={formData.ceremonyEnabled} onChange={(value) => setField("ceremonyEnabled", value)} />
          </div>
            {formData.ceremonyEnabled && (
            <div className="event-approval-ceremony-box">
              <CeremonyRow
                label="Inaugural"
                enabled={formData.inauguralEnabled}
                toggleChecked={formData.inauguralEnabled}
                toggleDisabled={!formData.ceremonyEnabled}
                onToggle={(value) => setField("inauguralEnabled", value)}
                date={formData.inauguralDate}
                time={formData.inauguralTime}
                venue={formData.inauguralVenue}
                onDate={(value) => setField("inauguralDate", value)}
                onTime={(value) => setField("inauguralTime", value)}
                onVenue={(value) => setField("inauguralVenue", value)}
              />
              <CeremonyRow
                label="Valedictory"
                enabled={formData.valedictoryEnabled}
                toggleChecked={formData.valedictoryEnabled}
                toggleDisabled={!formData.ceremonyEnabled}
                onToggle={(value) => setField("valedictoryEnabled", value)}
                date={formData.valedictoryDate}
                time={formData.valedictoryTime}
                venue={formData.valedictoryVenue}
                onDate={(value) => setField("valedictoryDate", value)}
                onTime={(value) => setField("valedictoryTime", value)}
                onVenue={(value) => setField("valedictoryVenue", value)}
              />
            </div>
            )}
        </section>
      )}

      {(eventNumber !== 1 || showExtendedSections) && (
        <section className="event-approval-card event-approval-accommodation-card form-card">
          <div className="event-approval-section-heading with-toggle">
            <span>Accommodation</span>
            <Switch checked={formData.accommodationEnabled} onChange={(value) => setField("accommodationEnabled", value)} />
          </div>
          {formData.accommodationEnabled && (
            <div className="event-approval-band accommodation">
              <div className="event-approval-fieldset-grid">
                <Segmented disabled={!formData.accommodationEnabled} value={formData.accommodationType} options={EVENT_ACCOMMODATION_TYPE_OPTIONS} onChange={(value) => setField("accommodationType", value as "Free" | "Paid")} />
                <label>Gents Accommodation Limit<input placeholder="Limit" disabled={!formData.accommodationEnabled} value={formData.gentsAccommodationLimit} onChange={(event) => setField("gentsAccommodationLimit", event.target.value)} /></label>
                <label>Ladies Accommodation Limit<input placeholder="Limit" disabled={!formData.accommodationEnabled} value={formData.ladiesAccommodationLimit} onChange={(event) => setField("ladiesAccommodationLimit", event.target.value)} /></label>
              </div>
            </div>
          )}
        </section>
      )}
        </>
      )}

      {Array.from({ length: additionalEvents }, (_, index) => (
        <EventApprovalCards
          key={`${eventNumber}-${index}`}
          title={`Event ${eventNumber + index + 1}`}
          eventNumber={eventNumber + index + 1}
          submitLabel={submitLabel}
          showHeaderActions={showHeaderActions}
          showExtendedSections={showExtendedSections}
          showFooter={false}
          onSubmit={onSubmit}
        />
      ))}

      {showFooter && eventExpanded && (
        <div className="event-approval-footer finance-submit-buttons">
          <button type="button" onClick={handleSubmit} disabled={submitting}>
            <Save size={17} />
            {submitting ? "Submitting..." : submitLabel}
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

const Switch = ({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) => (
  <label className={`event-approval-switch${disabled ? " is-disabled" : ""}`}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
    <span />
  </label>
);

const Segmented = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) => (
  <div className="event-approval-segmented">
    {label && <span>{label}</span>}
    <div>
      {options.map((option) => (
        <button type="button" key={option} className={value === option ? "active" : ""} onClick={() => onChange(option)} disabled={disabled}>
          {option}
        </button>
      ))}
    </div>
  </div>
);

const TogglePair = ({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) => (
  <div className="event-approval-toggle-pair">
    <span>{label}</span>
    <div className="event-approval-toggle-pair-buttons">
      <button type="button" className={value ? "active" : ""} onClick={() => onChange(true)}>Yes</button>
      <button type="button" className={!value ? "active" : ""} onClick={() => onChange(false)}>No</button>
    </div>
  </div>
);

const MiniCard = ({
  title,
  enabled,
  onToggle,
  children,
  columns = 2,
  className = "",
}: {
  title: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
  columns?: 2 | 3;
  className?: string;
}) => (
  <div className={`event-approval-mini-card ${className}`.trim()}>
    <div className="event-approval-section-heading with-toggle">
      <span>{title}</span>
      <Switch checked={enabled} onChange={onToggle} />
    </div>
    {enabled && <div className={`event-approval-grid ${columns === 3 ? "three" : "two"}`}>{children}</div>}
  </div>
);

const HeaderCollapseButton = ({ expanded, onClick }: { expanded: boolean; onClick: () => void }) => (
  <button
    type="button"
    className="event-approval-header-collapse-button muted"
    onClick={onClick}
    title={expanded ? "Collapse event" : "Expand event"}
    aria-label={expanded ? "Collapse event" : "Expand event"}
    aria-expanded={expanded}
  >
    <svg
      width="16"
      height="12"
      viewBox="0 0 16 12"
      className={expanded ? "open" : ""}
      aria-hidden="true"
    >
      <polyline
        points="2,2 8,8 14,2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  </button>
);

const IconActions = ({
  onAdd,
  onDelete,
  showAdd = true,
}: {
  onAdd: () => void;
  onDelete: () => void;
  showAdd?: boolean;
}) => (
  <div className="event-approval-icon-actions">
    {showAdd && (
      <button type="button" onClick={onAdd} title="Add row" aria-label="Add row">
        <Plus size={17} />
      </button>
    )}
    <button type="button" className="danger" onClick={onDelete} title="Delete row" aria-label="Delete row">
      <Trash2 size={17} />
    </button>
  </div>
);

const CeremonyRow = ({
  label,
  enabled,
  toggleChecked,
  toggleDisabled = false,
  onToggle,
  date,
  time,
  venue,
  onDate,
  onTime,
  onVenue,
}: {
  label: string;
  enabled: boolean;
  toggleChecked?: boolean;
  toggleDisabled?: boolean;
  onToggle: (value: boolean) => void;
  date: string;
  time: string;
  venue: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  onVenue: (value: string) => void;
}) => (
  <div className={`event-approval-ceremony-row${enabled ? "" : " is-disabled"}`}>
    <div className="event-approval-ceremony-label">
      <span>{label}</span>
      <Switch checked={toggleChecked ?? enabled} onChange={onToggle} disabled={toggleDisabled} />
    </div>
      <>
        <label>Date<input placeholder="DD/MM/YYYY" disabled={!enabled} className={date ? "has-value" : "is-placeholder"} type="date" value={date} onChange={(event) => onDate(event.target.value)} /></label>
        <label>Time<input placeholder="HH:MM" disabled={!enabled} className={time ? "has-value" : "is-placeholder"} type="time" value={time} onChange={(event) => onTime(event.target.value)} /></label>
        <label>Venue<input placeholder="Venue" disabled={!enabled} value={venue} onChange={(event) => onVenue(event.target.value)} /></label>
      </>
  </div>
);

export default EventApprovalCards;
