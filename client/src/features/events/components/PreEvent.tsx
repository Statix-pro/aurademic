import React from "react";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import EventApprovalCards, { EventApprovalFormData } from "./EventApprovalCards";

interface PreEventProps {
  goToTab: (tab: string) => void;
}

const PreEvent: React.FC<PreEventProps> = ({ goToTab }) => {
  const handleSubmit = async (data: EventApprovalFormData) => {
    const eventSubmitData = {
      name: data.name,
      description: "",
      category: data.category,
      event_type: data.eventType,
      level: data.level,
      date_from: data.dateFrom,
      date_to: data.dateTo,
      mode: data.mode || "Physical",
      meeting_link: data.mode === "Virtual" || data.mode === "Hybrid" ? data.meetingLink : null,
      venue: data.mode === "Physical" || data.mode === "Hybrid" ? data.venue : null,
      registration_fee_enabled: data.registrationFeeEnabled,
      registration_fee_amount: data.feeRows[0]?.individual || null,
      registration_link: null,
      bank_account: null,
      topics: [],
      expected_participants: data.expectedParticipants,
      themes: Array.isArray(data.themes) ? data.themes : data.themes ? [data.themes] : [],
      sdgs: Array.isArray(data.sdgs) ? data.sdgs : data.sdgs ? [data.sdgs] : [],
      inaugural_enabled: data.ceremonyEnabled && data.inauguralEnabled,
      inaugural_date: data.inauguralEnabled ? data.inauguralDate : null,
      inaugural_time: data.inauguralEnabled ? data.inauguralTime : null,
      inaugural_venue: data.inauguralEnabled ? data.inauguralVenue : null,
      valedictory_enabled: data.ceremonyEnabled && data.valedictoryEnabled,
      valedictory_date: data.valedictoryEnabled ? data.valedictoryDate : null,
      valedictory_time: data.valedictoryEnabled ? data.valedictoryTime : null,
      valedictory_venue: data.valedictoryEnabled ? data.valedictoryVenue : null,
      collaboration_data: data.collaborators
        .filter((row) => row.type || row.name)
        .map((row) => ({ type: row.type, name: row.name })),
      coordinators: data.coordinators.filter((row) => row.name || row.email || row.department || row.institution),
      budget: [],
    };

    await authenticityUtility.post("/pre-events", eventSubmitData);
    alert("Event created successfully!");
    goToTab("finance");
  };

  return (
    <EventApprovalCards
      title=""
      submitLabel="Submit & Next"
      showHeaderActions={false}
      showExtendedSections
      onSubmit={handleSubmit}
    />
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  const [eventData, setEventData] = useState<EventData>({
    name: '',
    description: '',
    category: '',
    eventType: '',
    dateFrom: '',
    dateTo: '',
    mode: 'Physical',
    meetingLink: '',
    registrationFeeEnabled: false,
    registrationFeeAmount: '',
    registrationLink: '',
    selectedBankAccount: '',
    inauguralEnabled: false,
    inauguralDate: '',
    inauguralTime: { hour: '09', minute: '00', period: 'AM' },
    inauguralVenue: '',
    inauguralVenueDropdown: '',
    valedictoryEnabled: false,
    valedictoryDate: '',
    valedictoryTime: { hour: '05', minute: '00', period: 'PM' },
    valedictoryVenue: '',
    valedictoryVenueDropdown: '',
    modeVenueDropdown: '',
    modeVenueOther: '',
    theme: [],
    sdg: [],
    budgetRows: [{ id: uuidv4(), head: '', amount: '' }],
  });

  const today = getTodayDate();

  // Form state management
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string>('');
  const [theme, setTheme] = useState<any[]>([]);
  const [sdg, setSdg] = useState<any[]>([]);

  // Mode state
  const [mode, setMode] = useState<'Physical' | 'Virtual' | 'Hybrid'>('Physical');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [modeVenueDropdown, setModeVenueDropdown] = useState('');
  const [modeVenueOther, setModeVenueOther] = useState('');

  // Registration state
  const [registrationFeeEnabled, setRegistrationFeeEnabled] = useState(false);
  const [registrationFeeAmount, setRegistrationFeeAmount] = useState('');
  const [registrationLink, setRegistrationLink] = useState('');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');

  // Inaugural state
  const [inauguralEnabled, setInauguralEnabled] = useState(false);
  const [inauguralDate, setInauguralDate] = useState('');
  const [inauguralTime, setInauguralTime] = useState({
    hour: '09',
    minute: '00',
    period: 'AM',
  });
  const [inauguralVenue, setInauguralVenue] = useState('');
  const [inauguralVenueDropdown, setInauguralVenueDropdown] = useState('');

  // Valedictory state
  const [valedictoryEnabled, setValedictoryEnabled] = useState(false);
  const [valedictoryDate, setValedictoryDate] = useState('');
  const [valedictoryTime, setValedictoryTime] = useState({
    hour: '05',
    minute: '00',
    period: 'PM',
  });
  const [valedictoryVenue, setValedictoryVenue] = useState('');
  const [valedictoryVenueDropdown, setValedictoryVenueDropdown] = useState('');

  // Budget state
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([
    { id: uuidv4(), head: '', amount: '' },
  ]);

  // Collaboration state
  const [collaborationData, setCollaborationData] = useState<CollaborationData>({
    institution: '',
    departments: '',
    professionalBodies: '',
    cellsClubs: '',
    hostInstitution: '',
  });

  // Coordinators state
  const [coordinators, setCoordinators] = useState<any[]>([]);

  // Event data handlers
  const handleEventDataChange = (field: keyof EventData, value: any): void => {
    setEventData((prev) => ({ ...prev, [field]: value }));
  };

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const newMode = e.target.value as 'Physical' | 'Virtual' | 'Hybrid';
    setMode(newMode);
    setModeVenueDropdown('');
    setModeVenueOther('');
  };

  const handleCollaborationChange = (field: string, value: string): void => {
    setCollaborationData((prev) => ({ ...prev, [field]: value }));
  };

  // Budget handlers
  const addBudgetRow = (): void => {
    setBudgetRows([...budgetRows, { id: uuidv4(), head: '', amount: '' }]);
  };

  const deleteBudgetRow = (id: string): void => {
    if (budgetRows.length > 1) {
      setBudgetRows(budgetRows.filter((row) => row.id !== id));
    }
  };

  // Submit handler
  const handleSubmitToBackend = async (): Promise<void> => {
    // console.log("🔴 Submit button clicked!");
    if (isSubmittingEvent) return;
    setIsSubmittingEvent(true);
    try {
      const eventSubmitData = {
        name: eventData.name,
        description: eventData.description,
        category: eventData.category,
        event_type: eventData.eventType,
        date_from: eventData.dateFrom,
        date_to: eventData.dateTo,
        mode: mode,
        meeting_link: mode === 'Virtual' || mode === 'Hybrid' ? eventData.meetingLink : null,
        venue:
          mode === 'Physical' || mode === 'Hybrid'
            ? modeVenueDropdown !== 'Others'
              ? modeVenueDropdown
              : modeVenueOther
            : null,
        registration_fee_enabled: registrationFeeEnabled,
        registration_fee_amount: registrationFeeEnabled ? registrationFeeAmount : null,
        registration_link: registrationFeeEnabled ? registrationLink : null,
        bank_account: registrationFeeEnabled ? selectedBankAccount : null,
        topics: selectedTopics,
        expected_participants: selectedParticipants,
        themes: theme.map((t) => t.value),
        sdgs: sdg.map((s) => s.value),
        inaugural_enabled: inauguralEnabled,
        inaugural_date: inauguralEnabled ? inauguralDate : null,
        inaugural_time: inauguralEnabled
          ? `${inauguralTime.hour}:${inauguralTime.minute} ${inauguralTime.period}`
          : null,
        inaugural_venue: inauguralEnabled
          ? inauguralVenueDropdown !== 'Others'
            ? inauguralVenueDropdown
            : inauguralVenue
          : null,
        valedictory_enabled: valedictoryEnabled,
        valedictory_date: valedictoryEnabled ? valedictoryDate : null,
        valedictory_time: valedictoryEnabled
          ? `${valedictoryTime.hour}:${valedictoryTime.minute} ${valedictoryTime.period}`
          : null,
        valedictory_venue: valedictoryEnabled
          ? valedictoryVenueDropdown !== 'Others'
            ? valedictoryVenueDropdown
            : valedictoryVenue
          : null,
        collaboration_data: collaborationData,
        coordinators: coordinators,
        budget: budgetRows
          .filter((row) => row.head && row.amount)
          .map((row) => ({
            head: row.head,
            amount: parseFloat(row.amount) || 0,
          })),
      };

      // console.log("🔴 Prepared event data:", eventSubmitData);

      const response = await authenticityUtility.post('/events/pre-event', eventSubmitData);
      // console.log("🟢 Backend response:", response);
      alert('✅ Event created successfully!');
      goToTab('finance');
    } catch (error: any) {
      console.error('🔴 Frontend error:', error);
      console.error('🔴 Error response:', error.response?.data);
      alert(`❌ Failed to create event: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  return (
    <div className="event-form-container">
      <div className="event-card-section">
        <h2 className="event-section-title">Event Details</h2>

        <div className="event-form-row">
          <div className="event-form-group">
            <label>Event Name *</label>
            <input
              type="text"
              value={eventData.name}
              onChange={(e) => handleEventDataChange('name', e.target.value)}
              placeholder="Enter event name"
              required
            />
          </div>

          <div className="event-form-group">
            <label>Category *</label>
            <select
              value={eventData.category}
              onChange={(e) => handleEventDataChange('category', e.target.value)}
              required
            >
              <option value="">-- Select Category --</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="event-form-row">
          <div className="event-form-group">
            <label>Event Type *</label>
            <select
              value={eventData.eventType}
              onChange={(e) => handleEventDataChange('eventType', e.target.value)}
              required
            >
              <option value="">-- Select Event Type --</option>
              {eventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="event-form-group">
            <label>Description</label>
            <textarea
              value={eventData.description}
              onChange={(e) => handleEventDataChange('description', e.target.value)}
              placeholder="Enter event description"
              rows={3}
            />
          </div>
        </div>

        <div className="event-form-row">
          <div className="event-form-group">
            <label>Date From *</label>
            <input
              type="date"
              value={eventData.dateFrom}
              onChange={(e) => handleEventDataChange('dateFrom', e.target.value)}
              min={today}
              required
            />
          </div>

          <div className="event-form-group">
            <label>Date To *</label>
            <input
              type="date"
              value={eventData.dateTo}
              onChange={(e) => handleEventDataChange('dateTo', e.target.value)}
              min={eventData.dateFrom || today}
              required
            />
          </div>
        </div>

        <div className="event-form-row">
          <div className="event-form-group">
            <label>Topics</label>
            <Select
              isMulti
              name="topics"
              options={topicOptions}
              value={topicOptions.filter((option) => selectedTopics.includes(option.value))}
              onChange={(selected) => {
                const values = selected ? selected.map((item) => item.value) : [];
                setSelectedTopics(values);
              }}
              className="event-react-select__control"
              classNamePrefix="select"
              isSearchable={false}
            />
          </div>

          <div className="event-form-group">
            <label>Expected Participants</label>
            <select
              value={selectedParticipants}
              onChange={(e) => setSelectedParticipants(e.target.value)}
            >
              <option value="">-- Select Range --</option>
              {participantOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="event-form-row">
          <div className="event-form-group">
            <label>Theme</label>
            <Select
              isMulti
              name="themes"
              options={themeOptions}
              value={theme}
              onChange={(selected) => setTheme([...(selected || [])])}
              className="event-react-select__control"
              classNamePrefix="select"
              isSearchable={false}
            />
          </div>

          <div className="event-form-group">
            <label>SDG</label>
            <Select
              isMulti
              name="sdgs"
              options={sdgOptions}
              value={sdg}
              onChange={(selected) => setSdg([...(selected || [])])}
              className="event-react-select__control"
              classNamePrefix="select"
              isSearchable={false}
              formatOptionLabel={(option) => option.label}
              components={{ MultiValueLabel }}
            />
          </div>
        </div>

        {/* here */}
        <div
          className="event-form-row"
          style={{ display: 'flex', gap: '16px', alignItems: 'center' }}
        >
          {/* Mode */}
          <div className="event-form-group" style={{ minWidth: '320px', width: '320px' }}>
            <label>Mode</label>
            <select
              value={mode}
              onChange={handleModeChange}
              style={{ width: '100%', height: '40px', padding: '8px' }}
            >
              <option value="Physical">Physical</option>
              <option value="Virtual">Virtual</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>

          {/* Physical → Venue */}
          {(mode === 'Physical' || mode === 'Hybrid') && (
            <div className="event-form-group" style={{ minWidth: '320px', width: '320px' }}>
              <label style={{ marginBottom: '4px' }}>Venue</label>
              {modeVenueDropdown !== 'Others' ? (
                <select
                  style={{ width: '100%', height: '40px', padding: '8px' }}
                  value={modeVenueDropdown}
                  onChange={(e) => {
                    const value = e.target.value;
                    setModeVenueDropdown(value);
                    if (value === 'Others') {
                      setModeVenueOther('');
                    }
                  }}
                >
                  <option value="">Select venue</option>
                  <option value="Cyberdome">Cyberdome</option>
                  <option value="Visveshwaraya">Visveshwaraya</option>
                  <option value="Biotech Seminar Hall">Biotech Seminar Hall</option>
                  <option value="ECC Seminar Hall">ECC Seminar Hall</option>
                  <option value="Founder Hall">Founder Hall</option>
                  <option value="Idea Lab">Idea Lab</option>
                  <option value="Others">Others</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={modeVenueOther}
                  placeholder="Enter venue"
                  style={{ width: '100%', height: '40px', padding: '8px' }}
                  onChange={(e) => {
                    setModeVenueOther(e.target.value);
                    if (e.target.value === '') {
                      setModeVenueDropdown(''); // Switch back to dropdown when cleared
                    }
                  }}
                  autoFocus
                />
              )}
            </div>
          )}

          {/* Virtual → Meeting Link */}
          {(mode === 'Virtual' || mode === 'Hybrid') && (
            <div className="event-form-group">
              <label>Meeting Link</label>
              <input
                type="text"
                value={eventData.meetingLink}
                onChange={(e) => handleEventDataChange('meetingLink', e.target.value)}
                placeholder="Enter meeting link"
              />
            </div>
          )}
        </div>

        {/* --- Inaugural Section --- */}
        {/* --- Inaugural & Valedictory Combined Card --- */}
        <div
          className="event-card-section"
          style={{
            marginTop: '20px',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '8px',
          }}
        >
          <div
            className="event-form-row"
            style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}
          >
            <div className="event-form-group" style={{ minWidth: '200px', flex: '1 1 200px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '4px',
                }}
              >
                Inaugural
                <label className="event-switch" style={{ transform: 'translateY(2px)' }}>
                  <input
                    type="checkbox"
                    checked={inauguralEnabled}
                    onChange={() => setInauguralEnabled(!inauguralEnabled)}
                  />
                  <span className="event-slider"></span>
                </label>
              </label>
              <input
                type="date"
                min={today}
                value={inauguralDate}
                onChange={(e) => setInauguralDate(e.target.value)}
                disabled={!inauguralEnabled}
                style={{ width: '100%' }}
              />
            </div>
            <div className="event-form-group" style={{ minWidth: '220px', flex: '1 1 180px' }}>
              <label style={{ marginBottom: '4px' }}>Inaugural Time</label>
              <div className="event-time-picker" style={{ display: 'flex', gap: '4px' }}>
                <select
                  value={inauguralTime.hour}
                  onChange={(e) => setInauguralTime({ ...inauguralTime, hour: e.target.value })}
                  disabled={!inauguralEnabled}
                >
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span>:</span>
                <select
                  value={inauguralTime.minute}
                  onChange={(e) =>
                    setInauguralTime({
                      ...inauguralTime,
                      minute: e.target.value,
                    })
                  }
                  disabled={!inauguralEnabled}
                >
                  {minutes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={inauguralTime.period}
                  onChange={(e) =>
                    setInauguralTime({
                      ...inauguralTime,
                      period: e.target.value,
                    })
                  }
                  disabled={!inauguralEnabled}
                >
                  {periods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div
              className="event-form-group"
              style={{
                minWidth: '320px',
                flex: '2 1 320px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <label style={{ marginBottom: '4px' }}>Venue</label>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                {inauguralVenueDropdown !== 'Others' ? (
                  <select
                    style={{ flex: 1, minWidth: 0 }}
                    value={inauguralVenueDropdown}
                    disabled={!inauguralEnabled}
                    onChange={(e) => {
                      setInauguralVenueDropdown(e.target.value);
                      if (e.target.value !== 'Others') {
                        setInauguralVenue(e.target.value);
                      } else {
                        setInauguralVenue('');
                      }
                    }}
                  >
                    <option value="">Select venue</option>
                    <option value="Cyberdome">Cyberdome</option>
                    <option value="Visveshwaraya">Visveshwaraya</option>
                    <option value="Biotech Seminar Hall">Biotech Seminar Hall</option>
                    <option value="ECC Seminar Hall">ECC Seminar Hall</option>
                    <option value="Founder Hall">Founder Hall</option>
                    <option value="Idea Lab">Idea Lab</option>
                    <option value="Others">Others</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={inauguralVenue}
                    disabled={!inauguralEnabled}
                    placeholder="Enter venue"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '40px',
                      padding: '8px',
                    }}
                    onChange={(e) => setInauguralVenue(e.target.value)}
                    onBlur={(e) => {
                      if (!e.target.value.trim()) setInauguralVenueDropdown('');
                    }}
                    autoFocus
                  />
                )}
              </div>
            </div>
          </div>

          <div
            className="event-form-row"
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              marginTop: '15px',
            }}
          >
            <div className="event-form-group" style={{ minWidth: '200px', flex: '1 1 200px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '4px',
                }}
              >
                Valedictory
                <label className="event-switch" style={{ transform: 'translateY(2px)' }}>
                  <input
                    type="checkbox"
                    checked={valedictoryEnabled}
                    onChange={() => setValedictoryEnabled(!valedictoryEnabled)}
                  />
                  <span className="event-slider"></span>
                </label>
              </label>
              <input
                type="date"
                min={today}
                value={valedictoryDate}
                onChange={(e) => setValedictoryDate(e.target.value)}
                disabled={!valedictoryEnabled}
                style={{ width: '100%' }}
              />
            </div>
            <div className="event-form-group" style={{ minWidth: '220px', flex: '1 1 180px' }}>
              <label style={{ marginBottom: '4px' }}>Valedictory Time</label>
              <div className="event-time-picker" style={{ display: 'flex', gap: '4px' }}>
                <select
                  value={valedictoryTime.hour}
                  onChange={(e) =>
                    setValedictoryTime({
                      ...valedictoryTime,
                      hour: e.target.value,
                    })
                  }
                  disabled={!valedictoryEnabled}
                >
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span>:</span>
                <select
                  value={valedictoryTime.minute}
                  onChange={(e) =>
                    setValedictoryTime({
                      ...valedictoryTime,
                      minute: e.target.value,
                    })
                  }
                  disabled={!valedictoryEnabled}
                >
                  {minutes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={valedictoryTime.period}
                  onChange={(e) =>
                    setValedictoryTime({
                      ...valedictoryTime,
                      period: e.target.value,
                    })
                  }
                  disabled={!valedictoryEnabled}
                >
                  {periods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div
              className="event-form-group"
              style={{
                minWidth: '320px',
                flex: '2 1 320px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <label style={{ marginBottom: '4px' }}>Venue</label>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                {valedictoryVenueDropdown !== 'Others' ? (
                  <select
                    style={{ flex: 1, minWidth: 0 }}
                    value={valedictoryVenueDropdown}
                    disabled={!valedictoryEnabled}
                    onChange={(e) => {
                      setValedictoryVenueDropdown(e.target.value);
                      if (e.target.value !== 'Others') {
                        setValedictoryVenue(e.target.value);
                      } else {
                        setValedictoryVenue('');
                      }
                    }}
                  >
                    <option value="">Select venue</option>
                    <option value="Cyberdome">Cyberdome</option>
                    <option value="Visveshwaraya">Visveshwaraya</option>
                    <option value="Biotech Seminar Hall">Biotech Seminar Hall</option>
                    <option value="ECC Seminar Hall">ECC Seminar Hall</option>
                    <option value="Founder Hall">Founder Hall</option>
                    <option value="Idea Lab">Idea Lab</option>
                    <option value="Others">Others</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={valedictoryVenue}
                    disabled={!valedictoryEnabled}
                    placeholder="Enter venue"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '40px',
                      padding: '8px',
                    }}
                    onChange={(e) => setValedictoryVenue(e.target.value)}
                    onBlur={(e) => {
                      if (!e.target.value.trim()) setValedictoryVenueDropdown('');
                    }}
                    autoFocus
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        <div
          className="event-form-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginTop: '12px',
          }}
        >
          <div className="event-form-group" style={{ minWidth: '120px' }}>
            <label>Registration Fee</label>
            <select
              value={registrationFeeEnabled ? 'yes' : 'no'}
              onChange={(e) => setRegistrationFeeEnabled(e.target.value === 'yes')}
              style={{ width: '100%', height: '40px', padding: '8px' }}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          {registrationFeeEnabled && (
            <>
              <div className="event-form-group" style={{ minWidth: '130px' }}>
                <label>Fee Amount</label>
                <input
                  type="number"
                  min="0"
                  value={registrationFeeAmount}
                  onChange={(e) => setRegistrationFeeAmount(e.target.value)}
                  placeholder="Enter fee amount"
                  style={{ width: '100%', height: '40px', padding: '8px' }}
                />
              </div>

              <div className="event-form-group" style={{ minWidth: '220px' }}>
                <label>Registration Link</label>
                <input
                  type="url"
                  value={registrationLink}
                  onChange={(e) => setRegistrationLink(e.target.value)}
                  placeholder="Enter registration URL"
                  style={{ width: '100%', height: '40px', padding: '8px' }}
                />
              </div>

              <div className="event-form-group" style={{ minWidth: '200px' }}>
                <label>Bank Account</label>
                <select
                  value={selectedBankAccount}
                  onChange={(e) => setSelectedBankAccount(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '8px' }}
                >
                  <option value="">Select account</option>
                  <option value="account1">Account 1 - 1234567890</option>
                  <option value="account2">Account 2 - 0987654321</option>
                  {/* Add more bank accounts as needed */}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Collaboration Section */}
      <div className="event-card-section">
        <h2 className="event-section-title">Collaboration</h2>
        <div className="collaboration-container">
          <div className="collaboration-row">
            <label>Institution</label>
            <input
              type="text"
              value={collaborationData.institution}
              onChange={(e) => handleCollaborationChange('institution', e.target.value)}
              placeholder="Name of the Institution"
            />
          </div>
          <div className="collaboration-row">
            <label>Departments</label>
            <input
              type="text"
              value={collaborationData.departments}
              onChange={(e) => handleCollaborationChange('departments', e.target.value)}
              placeholder="Name of the Department"
            />
          </div>
          <div className="collaboration-row">
            <label>Professional Bodies</label>
            <input
              type="text"
              value={collaborationData.professionalBodies}
              onChange={(e) => handleCollaborationChange('professionalBodies', e.target.value)}
              placeholder="Name of the Professional Body"
            />
          </div>
          <div className="collaboration-row">
            <label>Cells/ Clubs</label>
            <input
              type="text"
              value={collaborationData.cellsClubs}
              onChange={(e) => handleCollaborationChange('cellsClubs', e.target.value)}
              placeholder="Name of the Cell/ Club"
            />
          </div>
        </div>
      </div>

      {/* Coordinators Section */}
      <div className="event-card-section">
        <h2 className="event-section-title">Coordinators</h2>
        <div>
          <p>Coordinator management will be implemented here.</p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="event-section-navigation">
        <button
          type="button"
          className="event-next-btn"
          onClick={() => {
            // console.log('🔴 Submit & Next clicked, budgetRows:', budgetRows);
            setShowBudgetModal(true);
          }}
        >
          Submit & Next →
        </button>
      </div>

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="event-message-overlay">
          <div className="event-message-box">
            <button className="event-close-btn" onClick={() => setShowBudgetModal(false)}>
              &times;
            </button>
            <p>Enter the Budget Details</p>
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                border: '1px solid #ccc',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '8px',
                      border: '1px solid #ccc',
                    }}
                  >
                    S.No
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '8px',
                      border: '1px solid #ccc',
                    }}
                  >
                    Budget Head
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '8px',
                      border: '1px solid #ccc',
                    }}
                  >
                    Amount Proposed
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '8px',
                      border: '1px solid #ccc',
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {budgetRows.map((row, index) => (
                  <tr key={row.id} style={{ textAlign: 'center' }}>
                    <td
                      style={{
                        padding: '8px',
                        verticalAlign: 'middle',
                        border: '1px solid #ccc',
                      }}
                    >
                      {index + 1}
                    </td>
                    <td
                      style={{
                        padding: '8px',
                        verticalAlign: 'middle',
                        border: '1px solid #ccc',
                      }}
                    >
                      <select
                        value={row.head}
                        onChange={(e) => {
                          setBudgetRows(
                            budgetRows.map((r) =>
                              r.id === row.id ? { ...r, head: e.target.value } : r,
                            ),
                          );
                        }}
                        style={{ width: '100%', padding: '6px' }}
                      >
                        <option value="">-- Select --</option>
                        <option value="Honorarium">Honorarium</option>
                        <option value="Travel">Travel</option>
                        <option value="Printing">Printing</option>
                        <option value="Stationary">Stationary</option>
                        <option value="Food">Food</option>
                        <option value="Refreshment">Refreshment</option>
                      </select>
                    </td>
                    <td
                      style={{
                        padding: '8px',
                        verticalAlign: 'middle',
                        border: '1px solid #ccc',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Enter amount"
                        value={row.amount}
                        onChange={(e) => {
                          setBudgetRows(
                            budgetRows.map((r) =>
                              r.id === row.id ? { ...r, amount: e.target.value } : r,
                            ),
                          );
                        }}
                        style={{
                          width: '100%',
                          padding: '6px',
                          textAlign: 'right',
                        }}
                      />
                    </td>
                    <td
                      className="event-action-icons"
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '8px',
                        verticalAlign: 'middle',
                        border: '1px solid #ccc',
                      }}
                    >
                      {budgetRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBudgetRows(budgetRows.filter((r) => r.id !== row.id))}
                          className="event-icon-btn"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      {index === budgetRows.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetRows([...budgetRows, { id: uuidv4(), head: '', amount: '' }]);
                          }}
                          className="event-add"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td
                    colSpan={2}
                    style={{
                      textAlign: 'right',
                      fontWeight: '600',
                      padding: '8px',
                      border: '1px solid #ccc',
                    }}
                  >
                    Total Budget:
                  </td>
                  <td
                    style={{
                      fontWeight: '600',
                      padding: '8px',
                      textAlign: 'right',
                      border: '1px solid #ccc',
                    }}
                  >
                    {budgetRows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)}
                  </td>
                  <td style={{ border: '1px solid #ccc' }}></td>
                </tr>
              </tbody>
            </table>

            <div className="submit-wrapper">
              <button
                type="button"
                onClick={async () => {
                  // console.log(
                  //   '🔴 Final Submit clicked, current budgetRows:',
                  //   budgetRows
                  // );
                  await handleSubmitToBackend();
                  setShowBudgetModal(false);
                }}
                className="event-submit-btn"
                disabled={isSubmittingEvent}
              >
                {isSubmittingEvent ? 'Submitting...' : 'Final Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreEvent;
