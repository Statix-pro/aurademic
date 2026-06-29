import React, { useMemo, useState } from 'react';
import {
  BadgeAlert,
  CarFront,
  ClipboardCheck,
  MapPin,
  PlusCircle,
  Trash2,
  UsersRound,
} from 'lucide-react';
import '../guesthouse/guesthousebooking.css';
import './VehicleBooking.css';

type Priority = 'Routine' | 'High';
type VehicleRequirement =
  | 'Car'
  | 'Van'
  | 'Bus'
  | 'Shuttle Vehicle'
  | 'Mini Truck'
  | 'Eicher'
  | 'Lorry';
type BookingFor =
  | 'External Guest'
  | 'College Staff'
  | 'Students'
  | 'Outside Participants'
  | 'Logistics Transport';
type ServiceType = 'Free' | 'Paid';
type TravelMode = 'Outside' | 'Shuttle';
type ShuttleBookingMode = 'Day Booking' | 'Trip Booking';
type ShuttleRequirement = 'Full Day' | 'FN Session' | 'AN Session' | 'Night';

interface ApplicantDetails {
  employeeId: string;
  name: string;
  date: string;
  department: string;
  designation: string;
  email: string;
  mobile: string;
}

interface TransportBookingDetails {
  purpose: string;
  priority: Priority;
  vehicleRequirement: VehicleRequirement;
  numberOfVehicles: string;
  bookingFor: BookingFor;
  serviceType: ServiceType;
  accompaniedMale: string;
  accompaniedFemale: string;
  accompaniedChildren: string;
  remarks: string;
  travelMode: TravelMode;
}

interface TravelPlanRow {
  id: number;
  boardingDate: string;
  boardingTime: string;
  boardingPoint: string;
  droppingDate: string;
  droppingTime: string;
  droppingPoint: string;
}

interface ShuttleTripRow {
  id: number;
  date: string;
  time: string;
  purpose: string;
  trips: string;
}

interface ShuttleDayRow {
  id: number;
  date: string;
  requirement: ShuttleRequirement;
}

const vehicleRequirements: VehicleRequirement[] = [
  'Car',
  'Van',
  'Bus',
  'Shuttle Vehicle',
  'Mini Truck',
  'Eicher',
  'Lorry',
];

const bookingForOptions: BookingFor[] = [
  'External Guest',
  'College Staff',
  'Students',
  'Outside Participants',
  'Logistics Transport',
];

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const createTravelPlanRow = (): TravelPlanRow => ({
  id: Date.now() + Math.random(),
  boardingDate: '',
  boardingTime: '',
  boardingPoint: '',
  droppingDate: '',
  droppingTime: '',
  droppingPoint: '',
});

const createShuttleTripRow = (): ShuttleTripRow => ({
  id: Date.now() + Math.random(),
  date: '',
  time: '',
  purpose: '',
  trips: '',
});

const createShuttleDayRow = (): ShuttleDayRow => ({
  id: Date.now() + Math.random(),
  date: '',
  requirement: 'Full Day',
});

const applicantUiDetails: ApplicantDetails = {
  employeeId: '',
  name: '',
  date: formatDateInput(new Date()),
  department: 'Computer Science and Engineering',
  designation: '',
  email: 'niranjanahod@gmail.com',
  mobile: '',
};

const VehicleBooking: React.FC = () => {
  const [transportDetails, setTransportDetails] = useState<TransportBookingDetails>({
    purpose: '',
    priority: 'Routine',
    vehicleRequirement: 'Car',
    numberOfVehicles: '',
    bookingFor: 'External Guest',
    serviceType: 'Free',
    accompaniedMale: '',
    accompaniedFemale: '',
    accompaniedChildren: '',
    remarks: '',
    travelMode: 'Outside',
  });
  const [travelPlanRows, setTravelPlanRows] = useState<TravelPlanRow[]>([createTravelPlanRow()]);
  const [shuttleBookingMode, setShuttleBookingMode] =
    useState<ShuttleBookingMode>('Day Booking');
  const [shuttleTripRows, setShuttleTripRows] = useState<ShuttleTripRow[]>([
    createShuttleTripRow(),
  ]);
  const [shuttleDayRows, setShuttleDayRows] = useState<ShuttleDayRow[]>([
    createShuttleDayRow(),
  ]);

  const totalTravelers = useMemo(
    () =>
      String(
        (Number(transportDetails.accompaniedMale) || 0) +
          (Number(transportDetails.accompaniedFemale) || 0) +
          (Number(transportDetails.accompaniedChildren) || 0)
      ),
    [
      transportDetails.accompaniedChildren,
      transportDetails.accompaniedFemale,
      transportDetails.accompaniedMale,
    ]
  );

  const updateTransportDetails = (
    field: keyof TransportBookingDetails,
    value: string
  ) => {
    setTransportDetails((prevDetails) => ({ ...prevDetails, [field]: value }));
  };

  const updateTravelPlanRow = (
    id: number,
    field: keyof Omit<TravelPlanRow, 'id'>,
    value: string
  ) => {
    setTravelPlanRows((prevRows) =>
      prevRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const updateShuttleTripRow = (
    id: number,
    field: keyof Omit<ShuttleTripRow, 'id'>,
    value: string
  ) => {
    setShuttleTripRows((prevRows) =>
      prevRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const updateShuttleDayRow = (
    id: number,
    field: keyof Omit<ShuttleDayRow, 'id'>,
    value: ShuttleRequirement | string
  ) => {
    setShuttleDayRows((prevRows) =>
      prevRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const removeTravelPlanRow = (id: number) => {
    setTravelPlanRows((prevRows) =>
      prevRows.length === 1 ? prevRows : prevRows.filter((row) => row.id !== id)
    );
  };

  const removeShuttleTripRow = (id: number) => {
    setShuttleTripRows((prevRows) =>
      prevRows.length === 1 ? prevRows : prevRows.filter((row) => row.id !== id)
    );
  };

  const removeShuttleDayRow = (id: number) => {
    setShuttleDayRows((prevRows) =>
      prevRows.length === 1 ? prevRows : prevRows.filter((row) => row.id !== id)
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    console.log('Vehicle transport booking payload:', {
      applicant: applicantUiDetails,
      transportDetails,
      totalTravelers,
      travelPlanRows,
      shuttleBookingMode,
      shuttleTripRows,
      shuttleDayRows,
    });
  };

  const renderReadOnlyInput = (
    label: string,
    value: string,
    type: React.HTMLInputTypeAttribute = 'text',
    placeholder = ''
  ) => (
    <div className="guesthousebooking-field">
      <label className="guesthousebooking-label">{label}</label>
      <input
        className="guesthousebooking-input"
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly
      />
    </div>
  );

  const renderChoiceButton = <T extends string>(
    label: T,
    selectedValue: T,
    groupName: string,
    onSelect: (value: T) => void
  ) => (
    <label
      className={`guesthousebooking-radio vehiclebooking-choice-button ${
        selectedValue === label ? 'guesthousebooking-radio--active' : ''
      }`}
      key={label}
    >
      <input
        type="radio"
        name={groupName}
        checked={selectedValue === label}
        onChange={() => onSelect(label)}
      />
      <span>{label}</span>
    </label>
  );

  const renderRowActions = (
    addRow: () => void,
    removeRow: () => void,
    removeDisabled: boolean,
    addLabel: string,
    removeLabel: string
  ) => (
    <div className="guesthousebooking-row-actions vehiclebooking-table-actions">
      <button
        className="guesthousebooking-icon-button"
        type="button"
        onClick={addRow}
        aria-label={addLabel}
        title={addLabel}
      >
        <PlusCircle size={18} />
      </button>
      <button
        className="guesthousebooking-icon-button vehiclebooking-icon-button--muted"
        type="button"
        onClick={removeRow}
        aria-label={removeLabel}
        title={removeLabel}
        disabled={removeDisabled}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );

  return (
    <div className="guesthousebooking-page vehiclebooking-page">
      <div className="guesthousebooking-shell">
        <form onSubmit={handleSubmit}>
          <section className="guesthousebooking-card vehiclebooking-card vehiclebooking-applicant-card">
            <div className="guesthousebooking-card-header">
              <span>Applicant Details</span>
            </div>
            <div className="guesthousebooking-card-body">
              <div className="guesthousebooking-form-grid">
                {renderReadOnlyInput(
                  'Applicant Name',
                  applicantUiDetails.name,
                  'text',
                  'Search employee by name or ERP ID'
                )}
                {renderReadOnlyInput('Date', applicantUiDetails.date, 'date')}
                {renderReadOnlyInput('Department', applicantUiDetails.department)}
                {renderReadOnlyInput(
                  'Designation',
                  applicantUiDetails.designation,
                  'text',
                  'e.g., Manager, Staff'
                )}
                {renderReadOnlyInput('Email', applicantUiDetails.email, 'email')}
                {renderReadOnlyInput(
                  'Mobile',
                  applicantUiDetails.mobile,
                  'tel',
                  '10 digit mobile'
                )}
              </div>
            </div>
          </section>

          <section className="guesthousebooking-card vehiclebooking-card vehiclebooking-large-card">
            <div className="vehiclebooking-card-inner">
              <div className="vehiclebooking-section-title">Transport Booking</div>

              <div className="vehiclebooking-booking-grid vehiclebooking-booking-grid--top">
                <label className="vehiclebooking-inline-panel vehiclebooking-purpose-panel">
                  <span>Purpose</span>
                  <input
                    className="guesthousebooking-input"
                    value={transportDetails.purpose}
                    onChange={(event) =>
                      updateTransportDetails('purpose', event.target.value)
                    }
                    aria-label="Purpose"
                  />
                </label>

                <div className="vehiclebooking-inline-panel vehiclebooking-control-panel">
                  <span className="guesthousebooking-option-icon vehiclebooking-panel-icon">
                    <BadgeAlert size={24} />
                  </span>
                  <span className="vehiclebooking-panel-label">Priority</span>
                  <div className="guesthousebooking-radio-group vehiclebooking-segment-group">
                    {(['Routine', 'High'] as Priority[]).map((priority) =>
                      renderChoiceButton(
                        priority,
                        transportDetails.priority,
                        'vehicle-priority',
                        (value) => updateTransportDetails('priority', value)
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="vehiclebooking-subsection-title">Vehicle Requirement</div>
              <div className="vehiclebooking-booking-grid">
                <div className="guesthousebooking-radio-group vehiclebooking-option-strip">
                  {vehicleRequirements.map((vehicleRequirement) =>
                    renderChoiceButton(
                      vehicleRequirement,
                      transportDetails.vehicleRequirement,
                      'vehicle-requirement',
                      (value) => updateTransportDetails('vehicleRequirement', value)
                    )
                  )}
                </div>

                <label className="vehiclebooking-inline-panel vehiclebooking-control-panel">
                  <span className="guesthousebooking-option-icon vehiclebooking-panel-icon">
                    <CarFront size={24} />
                  </span>
                  <span className="vehiclebooking-panel-label">No. of Vehicles</span>
                  <input
                    className="guesthousebooking-small-input vehiclebooking-count-input"
                    type="number"
                    min="0"
                    value={transportDetails.numberOfVehicles}
                    onChange={(event) =>
                      updateTransportDetails('numberOfVehicles', event.target.value)
                    }
                    aria-label="Number of vehicles"
                  />
                </label>
              </div>

              <div className="vehiclebooking-subsection-title">Booking for</div>
              <div className="vehiclebooking-booking-grid">
                <div className="guesthousebooking-radio-group vehiclebooking-option-strip">
                  {bookingForOptions.map((bookingFor) =>
                    renderChoiceButton(
                      bookingFor,
                      transportDetails.bookingFor,
                      'vehicle-booking-for',
                      (value) => updateTransportDetails('bookingFor', value)
                    )
                  )}
                </div>

                <div className="vehiclebooking-inline-panel vehiclebooking-control-panel">
                  <span className="guesthousebooking-option-icon vehiclebooking-panel-icon">
                    <ClipboardCheck size={24} />
                  </span>
                  <span className="vehiclebooking-panel-label">Service</span>
                  <div className="guesthousebooking-radio-group vehiclebooking-segment-group">
                    {(['Free', 'Paid'] as ServiceType[]).map((serviceType) =>
                      renderChoiceButton(
                        serviceType,
                        transportDetails.serviceType,
                        'vehicle-service',
                        (value) => updateTransportDetails('serviceType', value)
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="vehiclebooking-subsection-title">Accompanied by</div>
              <div className="vehiclebooking-booking-grid vehiclebooking-booking-grid--stacked">
                <div className="vehiclebooking-inline-panel vehiclebooking-traveler-panel">
                  <span className="guesthousebooking-option-icon vehiclebooking-panel-icon">
                    <UsersRound size={24} />
                  </span>
                  <span className="vehiclebooking-panel-label">Traveler Details</span>
                  <label>
                    <span>Male</span>
                    <input
                      className="guesthousebooking-small-input vehiclebooking-small-count"
                      type="number"
                      min="0"
                      value={transportDetails.accompaniedMale}
                      onChange={(event) =>
                        updateTransportDetails('accompaniedMale', event.target.value)
                      }
                      aria-label="Male travelers"
                    />
                  </label>
                  <label>
                    <span>Female</span>
                    <input
                      className="guesthousebooking-small-input vehiclebooking-small-count"
                      type="number"
                      min="0"
                      value={transportDetails.accompaniedFemale}
                      onChange={(event) =>
                        updateTransportDetails('accompaniedFemale', event.target.value)
                      }
                      aria-label="Female travelers"
                    />
                  </label>
                  <label>
                    <span>Children</span>
                    <input
                      className="guesthousebooking-small-input vehiclebooking-small-count"
                      type="number"
                      min="0"
                      value={transportDetails.accompaniedChildren}
                      onChange={(event) =>
                        updateTransportDetails('accompaniedChildren', event.target.value)
                      }
                      aria-label="Children travelers"
                    />
                  </label>
                </div>

                <label className="vehiclebooking-inline-panel vehiclebooking-control-panel">
                  <span className="guesthousebooking-option-icon vehiclebooking-panel-icon">
                    <UsersRound size={24} />
                  </span>
                  <span className="vehiclebooking-panel-label">Total Travelers</span>
                  <input
                    className="guesthousebooking-small-input vehiclebooking-count-input"
                    type="number"
                    value={totalTravelers}
                    readOnly
                    aria-label="Total travelers"
                  />
                </label>

                <label className="vehiclebooking-inline-panel vehiclebooking-remarks-panel">
                  <span>Remarks</span>
                  <input
                    className="guesthousebooking-input"
                    value={transportDetails.remarks}
                    onChange={(event) =>
                      updateTransportDetails('remarks', event.target.value)
                    }
                    aria-label="Remarks"
                  />
                </label>

                <div className="vehiclebooking-inline-panel vehiclebooking-control-panel">
                  <span className="guesthousebooking-option-icon vehiclebooking-panel-icon">
                    <MapPin size={25} />
                  </span>
                  <span className="vehiclebooking-panel-label">Travel</span>
                  <div className="guesthousebooking-radio-group vehiclebooking-segment-group">
                    {(['Outside', 'Shuttle'] as TravelMode[]).map((travelMode) =>
                      renderChoiceButton(
                        travelMode,
                        transportDetails.travelMode,
                        'vehicle-travel-mode',
                        (value) => updateTransportDetails('travelMode', value)
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="guesthousebooking-card vehiclebooking-card vehiclebooking-large-card">
            <div className="vehiclebooking-card-inner">
              <div className="vehiclebooking-section-title">Travel Plan</div>

              <div className="vehiclebooking-table-wrap">
                <table className="vehiclebooking-table vehiclebooking-route-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Boarding Point</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Droping Point</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {travelPlanRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input"
                            type="text"
                            value={row.boardingDate}
                            onChange={(event) =>
                              updateTravelPlanRow(row.id, 'boardingDate', event.target.value)
                            }
                            aria-label="Boarding date"
                          />
                        </td>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input"
                            type="text"
                            value={row.boardingTime}
                            onChange={(event) =>
                              updateTravelPlanRow(row.id, 'boardingTime', event.target.value)
                            }
                            aria-label="Boarding time"
                          />
                        </td>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input vehiclebooking-table-input--wide"
                            type="text"
                            value={row.boardingPoint}
                            onChange={(event) =>
                              updateTravelPlanRow(row.id, 'boardingPoint', event.target.value)
                            }
                            aria-label="Boarding point"
                          />
                        </td>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input"
                            type="text"
                            value={row.droppingDate}
                            onChange={(event) =>
                              updateTravelPlanRow(row.id, 'droppingDate', event.target.value)
                            }
                            aria-label="Dropping date"
                          />
                        </td>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input"
                            type="text"
                            value={row.droppingTime}
                            onChange={(event) =>
                              updateTravelPlanRow(row.id, 'droppingTime', event.target.value)
                            }
                            aria-label="Dropping time"
                          />
                        </td>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input vehiclebooking-table-input--wide"
                            type="text"
                            value={row.droppingPoint}
                            onChange={(event) =>
                              updateTravelPlanRow(row.id, 'droppingPoint', event.target.value)
                            }
                            aria-label="Droping point"
                          />
                        </td>
                        <td>
                          {renderRowActions(
                            () =>
                              setTravelPlanRows((prevRows) => [
                                ...prevRows,
                                createTravelPlanRow(),
                              ]),
                            () => removeTravelPlanRow(row.id),
                            travelPlanRows.length === 1,
                            'Add travel plan row',
                            'Remove travel plan row'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="vehiclebooking-subsection-title vehiclebooking-shuttle-title">
                Shuttle Plan
              </div>

              <div className="guesthousebooking-radio-group vehiclebooking-centered-toggle">
                {(['Day Booking', 'Trip Booking'] as ShuttleBookingMode[]).map((mode) =>
                  renderChoiceButton(mode, shuttleBookingMode, 'vehicle-shuttle-mode', (value) =>
                    setShuttleBookingMode(value)
                  )
                )}
              </div>

              <div className="vehiclebooking-table-wrap vehiclebooking-shuttle-table-wrap">
                <table className="vehiclebooking-table vehiclebooking-shuttle-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Purpose</th>
                      <th># Trips</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shuttleTripRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input"
                            type="text"
                            value={row.date}
                            onChange={(event) =>
                              updateShuttleTripRow(row.id, 'date', event.target.value)
                            }
                            aria-label="Shuttle trip date"
                          />
                        </td>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input"
                            type="text"
                            value={row.time}
                            onChange={(event) =>
                              updateShuttleTripRow(row.id, 'time', event.target.value)
                            }
                            aria-label="Shuttle trip time"
                          />
                        </td>
                        <td>
                          <select
                            className="guesthousebooking-input vehiclebooking-table-input vehiclebooking-table-select"
                            value={row.purpose}
                            onChange={(event) =>
                              updateShuttleTripRow(row.id, 'purpose', event.target.value)
                            }
                            aria-label="Shuttle trip purpose"
                          >
                            <option value=""></option>
                            <option value="Academic">Academic</option>
                            <option value="Official">Official</option>
                            <option value="Guest Pickup">Guest Pickup</option>
                            <option value="Logistics">Logistics</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input vehiclebooking-table-input--compact"
                            type="number"
                            min="0"
                            value={row.trips}
                            onChange={(event) =>
                              updateShuttleTripRow(row.id, 'trips', event.target.value)
                            }
                            aria-label="Number of shuttle trips"
                          />
                        </td>
                        <td>
                          {renderRowActions(
                            () =>
                              setShuttleTripRows((prevRows) => [
                                ...prevRows,
                                createShuttleTripRow(),
                              ]),
                            () => removeShuttleTripRow(row.id),
                            shuttleTripRows.length === 1,
                            'Add shuttle trip row',
                            'Remove shuttle trip row'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="vehiclebooking-table-wrap vehiclebooking-shuttle-table-wrap">
                <table className="vehiclebooking-table vehiclebooking-day-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Requirement</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shuttleDayRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            className="guesthousebooking-input vehiclebooking-table-input"
                            type="text"
                            value={row.date}
                            onChange={(event) =>
                              updateShuttleDayRow(row.id, 'date', event.target.value)
                            }
                            aria-label="Shuttle day date"
                          />
                        </td>
                        <td>
                          <div className="guesthousebooking-radio-group vehiclebooking-requirement-group">
                            {(['Full Day', 'FN Session', 'AN Session', 'Night'] as ShuttleRequirement[]).map(
                              (requirement) =>
                                renderChoiceButton(
                                  requirement,
                                  row.requirement,
                                  `vehicle-shuttle-requirement-${row.id}`,
                                  (value) => updateShuttleDayRow(row.id, 'requirement', value)
                                )
                            )}
                          </div>
                        </td>
                        <td>
                          {renderRowActions(
                            () =>
                              setShuttleDayRows((prevRows) => [
                                ...prevRows,
                                createShuttleDayRow(),
                              ]),
                            () => removeShuttleDayRow(row.id),
                            shuttleDayRows.length === 1,
                            'Add shuttle day row',
                            'Remove shuttle day row'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
};

export default VehicleBooking;