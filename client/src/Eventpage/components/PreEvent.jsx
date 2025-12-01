import React, { useState, useEffect, useMemo } from 'react';

import { FaPlus, FaTrash } from 'react-icons/fa';
import 'react-datepicker/dist/react-datepicker.css';
import { v4 as uuidv4 } from 'uuid';
import authenticityUtility from '../../utility/authenticityUtility';

import Select, { components } from 'react-select';

function to24Hour(hour, minute, period) {
  let h = parseInt(hour, 10);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minute}:00`;
}

const themeOptions = [
  { value: 'industry', label: 'Industry' },
  { value: 'innovation', label: 'Innovation' },
  { value: 'designing', label: 'Designing' },
  { value: 'ai', label: 'Artificial Intelligence' },
  { value: 'ml', label: 'Machine Learning' },
  { value: 'iot', label: 'Internet of Things' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'blockchain', label: 'Blockchain' },
];

const eventTypeOptions = [
  { value: 'seminar', label: 'Seminar' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'guest-lecture', label: 'Guest Lecture' },
  { value: 'conference', label: 'Conference' },
  { value: 'symposium', label: 'Symposium' },
  { value: 'fdp', label: 'Faculty Development Program (FDP)' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'techfest', label: 'Technical Festival' },
  { value: 'cultural', label: 'Cultural Event' },
  { value: 'sports', label: 'Sports Event' },
  { value: 'competition', label: 'Competition' },
  { value: 'project-expo', label: 'Project Expo' },
  { value: 'alumni-meet', label: 'Alumni Meet' },
  { value: 'induction', label: 'Student Induction Program' },
  { value: 'orientation', label: 'Orientation Program' },
  { value: 'training', label: 'Training Program' },
];

const levelOptions = [
  { value: 'international', label: 'International' },
  { value: 'national', label: 'National' },
  { value: 'state', label: 'State' },
  { value: 'district', label: 'District' },
  { value: 'intra_college', label: 'Intra-College' },
];
const sdgOptions = [
  { value: 'sdg1', label: 'SDG 1-No Poverty', shortLabel: 'SDG 1' },
  { value: 'sdg2', label: 'SDG 2-Zero Hunger', shortLabel: 'SDG 2' },
  {
    value: 'sdg3',
    label: 'SDG 3-Good Health and Well-being',
    shortLabel: 'SDG 3',
  },
  { value: 'sdg4', label: 'SDG 4-Quality Education', shortLabel: 'SDG 4' },
  { value: 'sdg5', label: 'SDG 5-Gender Equality', shortLabel: 'SDG 5' },
  {
    value: 'sdg6',
    label: 'SDG 6-Clean Water and Sanitation',
    shortLabel: 'SDG 6',
  },
  {
    value: 'sdg7',
    label: 'SDG 7-Affordable and Clean Energy',
    shortLabel: 'SDG 7',
  },
  {
    value: 'sdg8',
    label: 'SDG 8-Decent Work and Economic Growth',
    shortLabel: 'SDG 8',
  },
  {
    value: 'sdg9',
    label: 'SDG 9-Industry, Innovation and Infrastructure',
    shortLabel: 'SDG 9',
  },
  { value: 'sdg10', label: 'SDG 10-Reduced Inequality', shortLabel: 'SDG 10' },
  {
    value: 'sdg11',
    label: 'SDG 11-Sustainable Cities and Communities',
    shortLabel: 'SDG 11',
  },
  {
    value: 'sdg12',
    label: 'SDG 12-Responsible Consumption and Production',
    shortLabel: 'SDG 12',
  },
  { value: 'sdg13', label: 'SDG 13-Climate Action', shortLabel: 'SDG 13' },
  { value: 'sdg14', label: 'SDG 14-Life Below Water', shortLabel: 'SDG 14' },
  { value: 'sdg15', label: 'SDG 15-Life on Land', shortLabel: 'SDG 15' },
  {
    value: 'sdg16',
    label: 'SDG 16-Peace, Justice and Strong Institutions',
    shortLabel: 'SDG 16',
  },
  {
    value: 'sdg17',
    label: 'SDG 17-Partnerships for the Goals',
    shortLabel: 'SDG 17',
  },
];

const targetAudienceOptions = [
  { value: 'students', label: 'Students' },
  { value: 'faculty', label: 'Faculty Members' },
  { value: 'research-scholars', label: 'Research Scholars' },
  { value: 'industry-people', label: 'Industry People' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'all', label: 'Open At All' },
  { value: 'others', label: 'Others' }, // include Others here
];
const CollaborationSection = ({
  title,
  placeholder,
  fixedValue,
  onDataChange,
}) => {
  const [enabled, setEnabled] = useState(true);

  const initialRows = fixedValue
    ? [{ id: uuidv4(), value: fixedValue, selected: true, fixed: true }]
    : [{ id: uuidv4(), value: '', selected: true, fixed: false }];

  const [rows, setRows] = useState(initialRows);

  React.useEffect(() => {
    if (onDataChange) {
      onDataChange(
        title,
        rows.map((row) => row.value).filter((v) => v)
      );
    }
  }, [rows, title, onDataChange]);

  const addRow = () => {
    setRows([
      ...rows,
      { id: uuidv4(), value: '', selected: false, fixed: false },
    ]);
  };

  const deleteRow = (id) => {
    if (rows.length > 1) {
      setRows(rows.filter((row) => row.id !== id || row.fixed));
    }
  };

  const handleChange = (id, value) => {
    setRows(rows.map((row) => (row.id === id ? { ...row, value } : row)));
  };

  return (
    <div className="event-collab-section">
      <table className="event-collab-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>
              <h3 style={{ fontSize: '20px' }}>{title}</h3>
            </th>
            <th style={{ width: '100px', textAlign: 'center' }}>
              <div
                className="event-action-icons"
                style={{ display: 'flex', justifyContent: 'center' }}
              >
                <label
                  className="event-toggle-switch"
                  style={{
                    display: 'inline-block',
                    width: '40px',
                    height: '20px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => setEnabled(!enabled)}
                    style={{ width: '100%', height: '100%' }}
                  />
                  <span className="event-slider"></span>
                </label>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td>{index + 1}</td>
              <td>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={row.value}
                  onChange={(e) => handleChange(row.id, e.target.value)}
                  disabled={!enabled || row.fixed}
                  className="collab-input"
                />
              </td>
              <td style={{ width: '100px', textAlign: 'center' }}>
                <div
                  className="event-action-icons"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {!row.fixed && (
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      disabled={!enabled || rows.length === 1}
                      className="event-icon-btn"
                    >
                      <FaTrash size={14} />
                    </button>
                  )}
                  {index === rows.length - 1 && (
                    <button
                      type="button"
                      onClick={addRow}
                      disabled={!enabled}
                      className="event-add"
                    >
                      <FaPlus size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const HostTable = ({ onDataChange }) => {
  const [enabled, setEnabled] = useState(true);
  const [selectedOption, setSelectedOption] = useState('ksrct');
  const [hostOptions, setHostOptions] = useState([
    { value: 'ksrct', label: 'K. S. Rangasamy College of Technology' },
    { value: 'Travel', label: 'Travel' },
    { value: 'Printing', label: 'Printing' },
    { value: 'Stationary', label: 'Stationary' },
    { value: 'Food', label: 'Food' },
    { value: 'Refreshment', label: 'Refreshment' },
  ]);

  useEffect(() => {
    const loadPreviousHosts = async () => {
      try {
        const response = await authenticityUtility.get(`/hosts/previous`);
        if (response && response.length > 0) {
          const previousHosts = response.map((host) => ({
            value: host.name.toLowerCase().replace(/\s+/g, '-'),
            label: host.name,
          }));

          const uniqueOptions = [
            ...hostOptions,
            ...previousHosts.filter(
              (newHost) =>
                !hostOptions.some(
                  (existing) => existing.value === newHost.value
                )
            ),
          ];

          setHostOptions(uniqueOptions);
        }
      } catch (error) {
        console.log(
          'No previous hosts found or error loading hosts:',
          error.message
        );
      }
    };

    loadPreviousHosts();
  }, []);

  React.useEffect(() => {
    if (onDataChange) {
      onDataChange('Host', selectedOption);
    }
  }, [selectedOption, onDataChange]);

  return (
    <div className="event-collab-section">
      <table className="event-collab-table">
        <tbody>
          <tr>
            <td>
              <h3 style={{ fontSize: '20px' }}>Host</h3>
            </td>
            <td>
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                disabled={!enabled}
              >
                {hostOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const CoordinatorsSection = ({ onDataChange }) => {
  const [rows, setRows] = useState([
    { id: uuidv4(), name: '', department: '', mobile: '', email: '' },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [newCoordinator, setNewCoordinator] = useState({
    name: '',
    department: '',
    mobile: '',
    email: '',
    linkedin: '',
  });
  React.useEffect(() => {
    if (onDataChange) {
      onDataChange(rows);
    }
  }, [rows, onDataChange]);
  const addCoordinator = () => {
    setRows([...rows, { id: uuidv4(), ...newCoordinator }]);
    setShowModal(false);
    setNewCoordinator({
      name: '',
      department: '',
      mobile: '',
      email: '',
      linkedin: '',
    });
  };

  const addRow = () => {
    setRows([
      ...rows,
      { id: uuidv4(), name: '', department: '', mobile: '', email: '' },
    ]);
  };

  const deleteRow = (id) => {
    if (rows.length > 1) {
      setRows(rows.filter((row) => row.id !== id));
    }
  };

  const handleChange = (id, field, value) => {
    setRows(
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  // --- Drag and Drop handlers ---
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('dragIndex', index);
  };

  const handleDrop = (e, dropIndex) => {
    const dragIndex = e.dataTransfer.getData('dragIndex');
    if (dragIndex === null) return;

    const updatedRows = [...rows];
    const [draggedRow] = updatedRows.splice(dragIndex, 1);
    updatedRows.splice(dropIndex, 0, draggedRow);

    setRows(updatedRows);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="event-coordinator-section" style={{ position: 'relative' }}>
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}
      >
        {/* <button
          type="button"
          className="add-coordinator-btn"
          onClick={() => setShowModal(true)}
        >
         + Add Coordinator
        </button> */}
      </div>
      <table className="event-coordinator-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Name</th>
            <th>Department</th>
            <th>Mobile</th>
            <th>E-mail</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <td style={{ cursor: 'grab', textAlign: 'center' }}>
                {index + 1}
              </td>
              <td>
                <input
                  type="text"
                  placeholder="Name"
                  value={row.name}
                  onChange={(e) => handleChange(row.id, 'name', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  placeholder="Department"
                  value={row.department}
                  onChange={(e) =>
                    handleChange(row.id, 'department', e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  type="text"
                  placeholder="Mobile"
                  value={row.mobile}
                  onChange={(e) =>
                    handleChange(row.id, 'mobile', e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  type="email"
                  placeholder="E-mail"
                  value={row.email}
                  onChange={(e) =>
                    handleChange(row.id, 'email', e.target.value)
                  }
                />
              </td>
              <td>
                <div className="event-action-icons">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      className="event-icon-btn"
                    >
                      <FaTrash size={14} />
                    </button>
                  )}
                  {index === rows.length - 1 && (
                    <button
                      type="button"
                      onClick={addRow}
                      className="event-add"
                    >
                      <FaPlus size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Add Coordinator</h3>
            <input
              type="text"
              placeholder="Name"
              value={newCoordinator.name}
              onChange={(e) =>
                setNewCoordinator((nc) => ({ ...nc, name: e.target.value }))
              }
            />
            <input
              type="text"
              placeholder="Department"
              value={newCoordinator.department}
              onChange={(e) =>
                setNewCoordinator((nc) => ({
                  ...nc,
                  department: e.target.value,
                }))
              }
            />
            <input
              type="text"
              placeholder="Mobile"
              value={newCoordinator.mobile}
              onChange={(e) =>
                setNewCoordinator((nc) => ({ ...nc, mobile: e.target.value }))
              }
            />
            <input
              type="email"
              placeholder="E-mail"
              value={newCoordinator.email}
              onChange={(e) =>
                setNewCoordinator((nc) => ({ ...nc, email: e.target.value }))
              }
            />
            <input
              type="text"
              placeholder="LinkedIn link"
              value={newCoordinator.linkedin}
              onChange={(e) =>
                setNewCoordinator((nc) => ({ ...nc, linkedin: e.target.value }))
              }
            />
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={addCoordinator}>
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ marginLeft: 8 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PreEvent = ({ goToTab }) => {
  const [mode, setMode] = useState('Physical');
  const [showMeetingLink, setShowMeetingLink] = useState(false);
  const [inauguralEnabled, setInauguralEnabled] = useState(true);

  const [modeVenueDropdown, setModeVenueDropdown] = useState('');
  const [modeVenueOther, setModeVenueOther] = useState('');

  const [startTime, setStartTime] = useState({
    hour: '09',
    minute: '00',
    period: 'AM',
  });
  const [endTime, setEndTime] = useState({
    hour: '05',
    minute: '00',
    period: 'PM',
  });
  const [fullDay, setFullDay] = useState(false);

  const [targetAudienceDropdown, setTargetAudienceDropdown] = useState([]);
  const [targetAudienceOther, setTargetAudienceOther] = useState('');

  const [inauguralVenueDropdown, setInauguralVenueDropdown] = useState('');
  const [inauguralVenueOther, setInauguralVenueOther] = useState('');
  const [valedictoryVenueDropdown, setValedictoryVenueDropdown] = useState('');
  const [valedictoryVenueOther, setValedictoryVenueOther] = useState('');

  // Declare inauguralVenue and valedictoryVenue ONLY ONCE here:
  const [inauguralVenue, setInauguralVenue] = useState('');
  const [valedictoryVenue, setValedictoryVenue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [registrationFeeEnabled, setRegistrationFeeEnabled] = useState(false);
  const [registrationFeeAmount, setRegistrationFeeAmount] = useState('');
  const [registrationLink, setRegistrationLink] = useState('');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');

  function calculateWeekdays(start, end) {
    let d1 = new Date(start);
    let d2 = new Date(end);
    if (isNaN(d1) || isNaN(d2) || d2 < d1) return 0;

    let count = 0;
    let current = new Date(d1);
    while (current <= d2) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  const [daysBetween, setDaysBetween] = useState('');
  useEffect(() => {
    if (targetAudienceOther && targetAudienceOther.trim() !== '') {
      if (!targetAudienceDropdown.some((opt) => opt.value === 'others')) {
        setTargetAudienceDropdown((prev) => [
          ...prev,
          { value: 'others', label: 'Others' },
        ]);
      }
    } else {
      setTargetAudienceDropdown((prev) =>
        prev.filter((opt) => opt.value !== 'others')
      );
    }
  }, [targetAudienceOther]);
  // PLACE useEffect AFTER ABOVE DECLARATIONS
  useEffect(() => {
    if (
      inauguralVenue &&
      [
        'Cyberdome',
        'Visveshwaraya',
        'Biotech Seminar Hall',
        'ECC Seminar Hall',
        'Founder Hall',
        'Idea Lab',
      ].includes(inauguralVenue)
    ) {
      setInauguralVenueDropdown(inauguralVenue);
      setInauguralVenueOther('');
    } else if (inauguralVenue) {
      setInauguralVenueDropdown('Others');
      setInauguralVenueOther(inauguralVenue);
    } else {
      setInauguralVenueDropdown('');
      setInauguralVenueOther('');
    }

    if (
      valedictoryVenue &&
      [
        'Cyberdome',
        'Visveshwaraya',
        'Biotech Seminar Hall',
        'ECC Seminar Hall',
        'Founder Hall',
        'Idea Lab',
      ].includes(valedictoryVenue)
    ) {
      setValedictoryVenueDropdown(valedictoryVenue);
      setValedictoryVenueOther('');
    } else if (valedictoryVenue) {
      setValedictoryVenueDropdown('Others');
      setValedictoryVenueOther(valedictoryVenue);
    } else {
      setValedictoryVenueDropdown('');
      setValedictoryVenueOther('');
    }
  }, [inauguralVenue, valedictoryVenue]);

  // ... your rest of code and return statement (no second declaration!)

  // Form states
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState([]);
  const [level, setLevel] = useState([]);
  const [department, setDepartment] = useState([]);

  const [targetAudience, setTargetAudience] = useState([]);

  const [theme, setTheme] = useState([]);
  const [sdg, setSdg] = useState([]);
  const [inauguralDate, setInauguralDate] = useState('');
  const [valedictoryDate, setValedictoryDate] = useState('');

  const MultiValueLabel = (props) => (
    <components.MultiValueLabel {...props}>
      {props.data.shortLabel}
    </components.MultiValueLabel>
  );

  const [meetingLink, setMeetingLink] = useState('');

  // Collaboration data
  const [collaborationData, setCollaborationData] = useState({});
  const [coordinators, setCoordinators] = useState([]);

  const [inauguralTime, setInauguralTime] = useState({
    hour: '09',
    minute: '00',
    period: 'AM',
  });
  const [valedictoryTime, setValedictoryTime] = useState({
    hour: '09',
    minute: '00',
    period: 'AM',
  });

  // Budget modal states
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetRows, setBudgetRows] = useState([
    { id: uuidv4(), head: '', amount: '' },
  ]);
  const [endDateEnabled, setEndDateEnabled] = useState(false);
  const [valedictoryEnabled, setValedictoryEnabled] = useState(false);

  const handleModeChange = (e) => {
    const selectedMode = e.target.value;
    setMode(selectedMode);
    setShowMeetingLink(selectedMode === 'Virtual' || selectedMode === 'Hybrid');
  };

  const handleCollaborationChange = (section, data) => {
    setCollaborationData((prev) => ({ ...prev, [section]: data }));
  };

  const handleSubmitToBackend = async () => {
    console.log('🔴 Submit button clicked!');
    console.log('🔴 Current budgetRows state:', budgetRows);

    // Validation
    if (!title.trim()) {
      alert('❌ Please enter an event title');
      return;
    }
    if (!startDate) {
      alert('❌ Please select a start date');
      return;
    }
    if (!endDate) {
      alert('❌ Please select an end date');
      return;
    }

    // Filter out empty budget entries
    const validBudgetEntries = budgetRows.filter(
      (r) =>
        r.head && r.head.trim() !== '' && r.amount && r.amount.trim() !== ''
    );
    console.log('🔴 Valid budget entries:', validBudgetEntries);

    const preEventData = {
      title,
      event_type: eventType.map((et) => et.value),
      department: department.map((d) => d.value),
      target_audience: targetAudience.map((ta) => ta.value),
      start_date: startDate,
      end_date: endDate,
      theme: theme.map((t) => t.value),
      sdg: sdg.map((s) => s.value),
      inaugural_date: inauguralDate,
      inaugural_time: to24Hour(
        inauguralTime.hour,
        inauguralTime.minute,
        inauguralTime.period
      ),
      inaugural_venue: inauguralVenue,
      valedictory_date: valedictoryDate,
      valedictory_time: to24Hour(
        valedictoryTime.hour,
        valedictoryTime.minute,
        valedictoryTime.period
      ),
      valedictory_venue: valedictoryVenue,
      mode,
      meeting_link: meetingLink,
      collaborations: Object.values(collaborationData).flat(),
      coordinators: coordinators.map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.mobile,
      })),
      budget: validBudgetEntries.map((r) => ({
        head: r.head,
        amount: r.amount,
      })),
    };

    console.log('🔴 Prepared data:', preEventData);
    console.log('🔴 Budget data being sent:', preEventData.budget);

    try {
      console.log('🔴 Making API call to:', '/pre-events');
      const response = await authenticityUtility.post(
        `/pre-events`,
        preEventData
      );
      console.log('🟢 Backend response:', response);
      alert('✅ Pre-event and budget details submitted successfully!');

      goToTab('finance');
    } catch (error) {
      console.error('🔴 Frontend error:', error);
      console.error('🔴 Error response:', error.response?.data);
      console.error('🔴 Error status:', error.response?.status);
      alert(
        `❌ Failed to submit pre-event: ${error.response?.data?.error || error.message}`
      );
    }
  };

  const hours = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const minutes = [
    '00',
    '05',
    '10',
    '15',
    '20',
    '25',
    '30',
    '35',
    '40',
    '45',
    '50',
    '55',
  ];
  const periods = ['AM', 'PM'];
  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* Event Details Section */}
      <div className="event-card-section">
        <h2 className="event-section-title">Event Details</h2>

        <div className="event-form-row">
          <div className="event-form-group">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="event-form-group">
            <label>Event Type</label>
            <Select
              isMulti
              name="eventtype"
              options={eventTypeOptions}
              value={eventType}
              onChange={(selected) => setEventType(selected || [])}
              className="event-react-select__control"
              classNamePrefix="select"
              isSearchable={false}
            />
          </div>
        </div>

        <div className="event-form-row">
          <div className="event-form-group">
            <label>Level</label>
            <Select
              isMulti
              name="level"
              options={levelOptions}
              value={level}
              onChange={(selected) => setLevel(selected || [])}
              className="event-react-select__control"
              classNamePrefix="select"
              isSearchable={false}
            />
          </div>
          <div className="event-form-group">
            <label>Target Audience</label>

            {!targetAudienceDropdown.some((opt) => opt.value === 'others') ? (
              <Select
                isMulti
                name="audience"
                options={targetAudienceOptions}
                value={targetAudienceDropdown}
                onChange={(selected) =>
                  setTargetAudienceDropdown(selected || [])
                }
                className="event-react-select__control"
                classNamePrefix="select"
                isSearchable={false}
              />
            ) : (
              <input
                type="text"
                placeholder="Please specify others"
                value={targetAudienceOther}
                onChange={(e) => setTargetAudienceOther(e.target.value)}
                className="form-control"
                autoFocus
                onBlur={() => {
                  if (!targetAudienceOther.trim()) {
                    // If input is cleared, remove "Others" from dropdown selection
                    setTargetAudienceDropdown((prev) =>
                      prev.filter((opt) => opt.value !== 'others')
                    );
                  }
                }}
                style={{ flex: 1, minWidth: 0, height: '40px', padding: '8px' }}
              />
            )}
          </div>
        </div>
        <div
          className="event-form-row"
          style={{
            display: 'flex',
            gap: '8px', // Reduce ONLY here for start/end date closeness
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'nowrap',
          }}
        >
          {/* Start Date */}
          <div className="event-form-group" style={{ minWidth: '145px' }}>
            <label style={{ fontSize: '15px' }}>Start Date</label>
            <input
              type="date"
              min={today}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '135px', height: '30px', fontSize: 15 }}
            />
          </div>
          <div className="event-form-group" style={{ minWidth: '150px' }}>
            <label style={{ fontSize: '15px' }}>End Date</label>
            <input
              type="date"
              min={today}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '135px', height: '30px', fontSize: 15 }}
            />
          </div>
          <div className="event-form-group" style={{ minWidth: '150px' }}>
            <label style={{ fontSize: '15px' }}>No. of Days</label>
            <input
              type="number"
              value={daysBetween}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || Number(value) >= 0) {
                  setDaysBetween(value);
                }
              }}
              min="0"
              style={{
                width: '60px',
                height: '30px',
                textAlign: 'center',
                background: '#fafafa',
                fontSize: '15px',
                MozAppearance: 'textfield',
              }}
              onWheel={(e) => e.target.blur()} // disables scroll change
              onKeyDown={(e) => {
                if (e.key === '-' || e.key === 'e') e.preventDefault(); // block minus & exponent
              }}
            />
          </div>
          <div
            className="event-form-group"
            style={{ minWidth: '200px', marginLeft: '-55px' }}
          >
            <label style={{ marginBottom: '4px' }}>Start Time</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <select
                value={startTime.hour}
                onChange={(e) =>
                  setStartTime({ ...startTime, hour: e.target.value })
                }
                style={{ height: '30px' }}
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span>:</span>
              <select
                value={startTime.minute}
                onChange={(e) =>
                  setStartTime({ ...startTime, minute: e.target.value })
                }
                style={{ height: '30px' }}
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={startTime.period}
                onChange={(e) =>
                  setStartTime({ ...startTime, period: e.target.value })
                }
                style={{ height: '30px' }}
              >
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* End Time + Full Day */}
          <div className="event-form-group" style={{ minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label>End Time</label>
              <input
                type="checkbox"
                id="fullDayCheckbox"
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) {
                    setStartTime({ hour: '09', minute: '00', period: 'AM' });
                    setEndTime({ hour: '04', minute: '00', period: 'PM' });
                  }
                }}
                style={{ marginLeft: 45, accentColor: '#3182ce' }}
              />
              <label
                htmlFor="fullDayCheckbox"
                style={{ userSelect: 'none', margin: 0, marginLeft: '0px' }}
              >
                Full Day
              </label>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
                marginTop: '2px',
              }}
            >
              <select
                value={endTime.hour}
                onChange={(e) =>
                  setEndTime({ ...endTime, hour: e.target.value })
                }
                style={{ height: '30px' }}
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span>:</span>
              <select
                value={endTime.minute}
                onChange={(e) =>
                  setEndTime({ ...endTime, minute: e.target.value })
                }
                style={{ height: '30px' }}
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={endTime.period}
                onChange={(e) =>
                  setEndTime({ ...endTime, period: e.target.value })
                }
                style={{ height: '30px' }}
              >
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
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
              onChange={(selected) => setTheme(selected || [])}
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
              onChange={(selected) => setSdg(selected || [])}
              className="event-react-select__control"
              classNamePrefix="select"
              isSearchable={false}
              formatOptionLabel={(option) => option.label}
              components={{ MultiValueLabel }}
            />
          </div>
        </div>

        {/* Moved Mode Row here */}
        <div
          className="event-form-row"
          style={{ display: 'flex', gap: '16px', alignItems: 'center' }}
        >
          {/* Mode */}
          <div
            className="event-form-group"
            style={{ minWidth: '320px', width: '320px' }}
          >
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
          {mode === 'Physical' && (
            <div
              className="event-form-group"
              style={{ minWidth: '320px', width: '320px' }}
            >
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
                  <option value="Biotech Seminar Hall">
                    Biotech Seminar Hall
                  </option>
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
          {mode === 'Virtual' && (
            <div className="event-form-group">
              <label>Meeting Link</label>
              <input
                type="text"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="Enter meeting link"
              />
            </div>
          )}

          {/* Hybrid → Both */}
          {mode === 'Hybrid' && (
            <>
              <div className="event-form-group">
                <label>Meeting Link</label>
                <input
                  type="text"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="Enter meeting link"
                />
              </div>
            </>
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
            <div
              className="event-form-group"
              style={{ minWidth: '200px', flex: '1 1 200px' }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '4px',
                }}
              >
                Inaugural
                <label
                  className="event-switch"
                  style={{ transform: 'translateY(2px)' }}
                >
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
            <div
              className="event-form-group"
              style={{ minWidth: '220px', flex: '1 1 180px' }}
            >
              <label style={{ marginBottom: '4px' }}>Inaugural Time</label>
              <div
                className="event-time-picker"
                style={{ display: 'flex', gap: '4px' }}
              >
                <select
                  value={inauguralTime.hour}
                  onChange={(e) =>
                    setInauguralTime({ ...inauguralTime, hour: e.target.value })
                  }
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
                    <option value="Biotech Seminar Hall">
                      Biotech Seminar Hall
                    </option>
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
            <div
              className="event-form-group"
              style={{ minWidth: '200px', flex: '1 1 200px' }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '4px',
                }}
              >
                Valedictory
                <label
                  className="event-switch"
                  style={{ transform: 'translateY(2px)' }}
                >
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
            <div
              className="event-form-group"
              style={{ minWidth: '220px', flex: '1 1 180px' }}
            >
              <label style={{ marginBottom: '4px' }}>Valedictory Time</label>
              <div
                className="event-time-picker"
                style={{ display: 'flex', gap: '4px' }}
              >
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
                    <option value="Biotech Seminar Hall">
                      Biotech Seminar Hall
                    </option>
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
                      if (!e.target.value.trim())
                        setValedictoryVenueDropdown('');
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
              onChange={(e) =>
                setRegistrationFeeEnabled(e.target.value === 'yes')
              }
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
          <CollaborationSection
            title="Institution"
            fixedValue="K.S.Rangasamy college of technology"
            onDataChange={handleCollaborationChange}
          />
          <CollaborationSection
            title="Departments"
            placeholder="Name of the Department"
            onDataChange={handleCollaborationChange}
          />
          <CollaborationSection
            title="Professional Bodies"
            placeholder="Name of the Professional Body"
            onDataChange={handleCollaborationChange}
          />
          <CollaborationSection
            title="Cells/ Clubs"
            placeholder="Name of the Cell/ Club"
            onDataChange={handleCollaborationChange}
          />
        </div>
        <HostTable onDataChange={handleCollaborationChange} />
      </div>

      {/* Coordinators Section */}
      <div className="event-card-section">
        <h2 className="event-section-title">Coordinators</h2>
        <CoordinatorsSection onDataChange={setCoordinators} />
      </div>

      {/* Navigation Buttons */}
      <div className="event-section-navigation">
        <button
          type="button"
          className="event-next-btn"
          onClick={() => {
            console.log('🔴 Submit & Next clicked, budgetRows:', budgetRows);
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
            <button
              className="event-close-btn"
              onClick={() => setShowBudgetModal(false)}
            >
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
                              r.id === row.id
                                ? { ...r, head: e.target.value }
                                : r
                            )
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
                              r.id === row.id
                                ? { ...r, amount: e.target.value }
                                : r
                            )
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
                          onClick={() =>
                            setBudgetRows(
                              budgetRows.filter((r) => r.id !== row.id)
                            )
                          }
                          className="event-icon-btn"
                        >
                          <FaTrash size={16} />
                        </button>
                      )}
                      {index === budgetRows.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetRows([
                              ...budgetRows,
                              { id: uuidv4(), head: '', amount: '' },
                            ]);
                          }}
                          className="event-add"
                        >
                          <FaPlus size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td
                    colSpan="2"
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
                    {budgetRows.reduce(
                      (sum, row) => sum + (parseFloat(row.amount) || 0),
                      0
                    )}
                  </td>
                  <td style={{ border: '1px solid #ccc' }}></td>
                </tr>
              </tbody>
            </table>

            <div className="submit-wrapper">
              <button
                type="button"
                onClick={async () => {
                  console.log(
                    '🔴 Final Submit clicked, current budgetRows:',
                    budgetRows
                  );
                  await handleSubmitToBackend();
                  setShowBudgetModal(false);
                }}
                className="event-submit-btn"
              >
                Final Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreEvent;
