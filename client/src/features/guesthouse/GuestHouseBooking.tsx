import React, { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  ChevronDown,
  ChevronUp,
  Clock3,
  PlusCircle,
  Trash2,
  UsersRound,
  Utensils,
} from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './guesthousebooking.css';

type Gender = 'Male' | 'Female' | 'Others' | '';
type GuestPriority = 'Routine' | 'High' | '';

interface ApplicantDetails {
  employeeId: string;
  name: string;
  date: string;
  department: string;
  designation: string;
  email: string;
  mobile: string;
}

interface GuestDetails {
  id: number;
  name: string;
  gender: Gender;
  priority: GuestPriority;
  designation: string;
  organization: string;
  city: string;
  state: string;
  accompaniedMale: string;
  accompaniedFemale: string;
  accompaniedChildren: string;
  roomSingle: string;
  roomDouble: string;
  roomDeluxe: string;
  foodVeg: string;
  foodNonVeg: string;
}

interface TravelDetails {
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
}

interface FoodRequirementRow {
  id: number;
  date: string;
  morningRefreshment: string;
  breakfastVeg: string;
  breakfastNonVeg: string;
  lunchVeg: string;
  lunchNonVeg: string;
  eveningRefreshment: string;
  dinnerVeg: string;
  dinnerNonVeg: string;
}

type GuestField = Exclude<keyof GuestDetails, 'id'>;
type FoodField = Exclude<keyof FoodRequirementRow, 'id'>;
type TravelDateField = 'checkInDate' | 'checkOutDate';

const numberOnly = (value: string) => Math.max(0, Number(value) || 0);
const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 || 12;

  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
});

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayInputValue = () => formatDateInput(new Date());

const parseInputDate = (value: string) => new Date(`${value}T00:00:00`);

const formatDateForDisplay = (value: string) => {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return '';
  }

  return `${day}/${month}/${year}`;
};

const formatDateEntry = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);

  return parts.join('/');
};

const parseDisplayDate = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return '';
  }

  const [, dayValue, monthValue, yearValue] = match;
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return '';
  }

  return formatDateInput(date);
};

const addDaysToInputDate = (value: string, days: number) => {
  if (!value) {
    return '';
  }

  const date = parseInputDate(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

const parseTimeToMinutes = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})[:.]([0-5]\d)\s*(AM|PM)?$/i);

  if (!match) {
    return null;
  }

  const [, hourValue, minuteValue, periodValue] = match;
  let hour = Number(hourValue);
  const minute = Number(minuteValue);

  if (periodValue) {
    const period = periodValue.toUpperCase();

    if (hour < 1 || hour > 12) {
      return null;
    }

    hour = hour % 12;

    if (period === 'PM') {
      hour += 12;
    }
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
};

const buildTravelDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue) {
    return null;
  }

  const date = parseInputDate(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parsedTime = timeValue ? parseTimeToMinutes(timeValue) : 0;

  if (parsedTime === null) {
    return null;
  }

  date.setMinutes(parsedTime);
  return date;
};

const formatTravelDuration = (details: TravelDetails) => {
  const start = buildTravelDateTime(details.checkInDate, details.checkInTime);
  const end = buildTravelDateTime(details.checkOutDate, details.checkOutTime);

  if (!start || !end || end < start) {
    return '0 Days';
  }

  const totalMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days || (!hours && !minutes)) {
    parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);
  }

  if (hours) {
    parts.push(`${hours} ${hours === 1 ? 'Hour' : 'Hours'}`);
  }

  if (minutes) {
    parts.push(`${minutes} ${minutes === 1 ? 'Minute' : 'Minutes'}`);
  }

  return parts.join(' ');
};

const buildStayDates = (checkInDate: string, checkOutDate: string) => {
  if (!checkInDate || !checkOutDate) {
    return [];
  }

  const start = parseInputDate(checkInDate);
  const end = parseInputDate(checkOutDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  const includeCheckoutDate = start.getTime() === end.getTime();

  while (includeCheckoutDate ? cursor <= end : cursor < end) {
    dates.push(formatDateInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const createGuest = (id = Date.now()): GuestDetails => ({
  id,
  name: '',
  gender: '',
  priority: 'Routine',
  designation: '',
  organization: '',
  city: '',
  state: '',
  accompaniedMale: '',
  accompaniedFemale: '',
  accompaniedChildren: '',
  roomSingle: '',
  roomDouble: '',
  roomDeluxe: '',
  foodVeg: '',
  foodNonVeg: '',
});

const createFoodRow = (date = ''): FoodRequirementRow => ({
  id: Date.now() + Math.random(),
  date,
  morningRefreshment: '',
  breakfastVeg: '',
  breakfastNonVeg: '',
  lunchVeg: '',
  lunchNonVeg: '',
  eveningRefreshment: '',
  dinnerVeg: '',
  dinnerNonVeg: '',
});

const emptyTravelDetails: TravelDetails = {
  checkInDate: '',
  checkInTime: '',
  checkOutDate: '',
  checkOutTime: '',
};

const applicantUiDetails: ApplicantDetails = {
  employeeId: '',
  name: '',
  date: todayInputValue(),
  department: 'Computer Science and Engineering',
  designation: '',
  email: 'niranjanahod@gmail.com',
  mobile: '',
};

const GuestHouseBooking: React.FC = () => {
  const [isApplicantCardOpen, setIsApplicantCardOpen] = useState(true);
  const [submitMessage, setSubmitMessage] = useState('');
  const [guests, setGuests] = useState<GuestDetails[]>([createGuest(1)]);
  const [travelDetails, setTravelDetails] = useState<TravelDetails>(emptyTravelDetails);
  const [travelDateInputs, setTravelDateInputs] = useState<Record<TravelDateField, string>>({
    checkInDate: '',
    checkOutDate: '',
  });
  const [foodRows, setFoodRows] = useState<FoodRequirementRow[]>([createFoodRow()]);

  useEffect(() => {
    setTravelDateInputs({
      checkInDate: formatDateForDisplay(travelDetails.checkInDate),
      checkOutDate: formatDateForDisplay(travelDetails.checkOutDate),
    });
  }, [travelDetails.checkInDate, travelDetails.checkOutDate]);

  useEffect(() => {
    const stayDates = buildStayDates(travelDetails.checkInDate, travelDetails.checkOutDate);

    if (!stayDates.length) {
      setFoodRows([createFoodRow()]);
      return;
    }

    setFoodRows((prevRows) =>
      stayDates.map((date) => {
        const existingRow = prevRows.find((row) => row.date === date);
        return existingRow ? { ...existingRow, date } : createFoodRow(date);
      })
    );
  }, [travelDetails.checkInDate, travelDetails.checkOutDate]);

  const stayDates = useMemo(
    () => buildStayDates(travelDetails.checkInDate, travelDetails.checkOutDate),
    [travelDetails.checkInDate, travelDetails.checkOutDate]
  );

  const travelDuration = useMemo(
    () => formatTravelDuration(travelDetails),
    [travelDetails]
  );

  const totalGuestCount = useMemo(
    () =>
      guests.reduce(
        (total, guest) =>
          total +
          1 +
          numberOnly(guest.accompaniedMale) +
          numberOnly(guest.accompaniedFemale) +
          numberOnly(guest.accompaniedChildren),
        0
      ),
    [guests]
  );

  const foodTotals = useMemo(
    () =>
      foodRows.reduce(
        (totals, row) => ({
          refreshment:
            totals.refreshment +
            numberOnly(row.morningRefreshment) +
            numberOnly(row.eveningRefreshment),
          veg:
            totals.veg +
            numberOnly(row.breakfastVeg) +
            numberOnly(row.lunchVeg) +
            numberOnly(row.dinnerVeg),
          nonVeg:
            totals.nonVeg +
            numberOnly(row.breakfastNonVeg) +
            numberOnly(row.lunchNonVeg) +
            numberOnly(row.dinnerNonVeg),
        }),
        { refreshment: 0, veg: 0, nonVeg: 0 }
      ),
    [foodRows]
  );

  const updateGuest = (id: number, field: GuestField, value: string) => {
    setGuests((prevGuests) =>
      prevGuests.map((guest) => (guest.id === id ? { ...guest, [field]: value } : guest))
    );
  };

  const addGuest = () => {
    setGuests((prevGuests) => [...prevGuests, createGuest()]);
  };

  const removeGuest = (id: number) => {
    setGuests((prevGuests) =>
      prevGuests.length === 1 ? prevGuests : prevGuests.filter((guest) => guest.id !== id)
    );
  };

  const updateTravelDetails = (field: keyof TravelDetails, value: string) => {
    setTravelDetails((prevDetails) => {
      if (field === 'checkInDate') {
        return {
          ...prevDetails,
          checkInDate: value,
          checkOutDate: addDaysToInputDate(value, 1),
        };
      }

      return { ...prevDetails, [field]: value };
    });
  };

  const updateTravelDateInput = (field: TravelDateField, value: string) => {
    const formattedValue = formatDateEntry(value);
    const parsedDate = parseDisplayDate(formattedValue);

    setTravelDateInputs((prevInputs) => ({ ...prevInputs, [field]: formattedValue }));

    if (!formattedValue || parsedDate) {
      updateTravelDetails(field, parsedDate);
    }
  };

  const resetTravelDateInput = (field: TravelDateField) => {
    setTravelDateInputs((prevInputs) => ({
      ...prevInputs,
      [field]: formatDateForDisplay(travelDetails[field]),
    }));
  };

  const updateFoodRow = (id: number, field: FoodField, value: string) => {
    setFoodRows((prevRows) =>
      prevRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const addFoodRow = () => {
    setFoodRows((prevRows) => {
      const lastDate = prevRows[prevRows.length - 1]?.date;
      const nextDate = lastDate ? parseInputDate(lastDate) : null;

      if (nextDate) {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      return [...prevRows, createFoodRow(nextDate ? formatDateInput(nextDate) : '')];
    });
  };

  const removeFoodRow = (id: number) => {
    setFoodRows((prevRows) =>
      prevRows.length === 1 ? prevRows : prevRows.filter((row) => row.id !== id)
    );
  };

  const handleReset = () => {
    setGuests([createGuest(1)]);
    setTravelDetails(emptyTravelDetails);
    setFoodRows([createFoodRow()]);
    setSubmitMessage('');
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      applicant: applicantUiDetails,
      guests,
      travelDetails,
      numberOfDays: stayDates.length,
      duration: travelDuration,
      foodRequirements: foodRows,
    };

    console.log('Guest house booking payload:', payload);
    setSubmitMessage('Guest house booking form is ready.');
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

  const renderFoodPair = (
    row: FoodRequirementRow,
    vegField: FoodField,
    nonVegField: FoodField,
    label: string
  ) => (
    <div className="guesthousebooking-food-pair">
      <input
        className="guesthousebooking-food-input guesthousebooking-food-input--veg"
        type="number"
        min="0"
        value={String(row[vegField] || '')}
        onChange={(event) => updateFoodRow(row.id, vegField, event.target.value)}
        aria-label={`${label} veg count`}
      />
      <input
        className="guesthousebooking-food-input guesthousebooking-food-input--nonveg"
        type="number"
        min="0"
        value={String(row[nonVegField] || '')}
        onChange={(event) => updateFoodRow(row.id, nonVegField, event.target.value)}
        aria-label={`${label} non-veg count`}
      />
    </div>
  );

  const renderTimeSelect = (field: 'checkInTime' | 'checkOutTime', label: string) => {
    const listId = `guesthousebooking-${field}-options`;

    return (
      <label className="guesthousebooking-time-field">
        <span>{label}</span>
        <span className="guesthousebooking-time-input-wrap">
          <input
            className="guesthousebooking-time-input"
            type="text"
            list={listId}
            placeholder="--:--"
            pattern="^(0?[1-9]|1[0-2])[:.][0-5][0-9] ?(AM|PM|am|pm)$"
            title="Enter time in 12-hour format, for example 12:01 AM"
            value={travelDetails[field]}
            onChange={(event) => updateTravelDetails(field, event.target.value)}
            aria-label={`${label} in 12-hour format`}
            required
          />
          <Clock3 className="guesthousebooking-travel-clock" size={17} aria-hidden="true" />
        </span>
        <datalist id={listId}>
          {timeOptions.map((time) => (
            <option value={time} key={time}>
              {time}
            </option>
          ))}
        </datalist>
      </label>
    );
  };

  const renderTravelDateInput = (field: TravelDateField) => (
    <label>
      <span>Date</span>
      <span className="guesthousebooking-date-input-wrap">
        <input
          className="guesthousebooking-input"
          type="text"
          value={travelDateInputs[field]}
          onChange={(event) => updateTravelDateInput(field, event.target.value)}
          onBlur={() => resetTravelDateInput(field)}
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          pattern="\d{2}/\d{2}/\d{4}"
          title="Enter date as DD/MM/YYYY"
          maxLength={10}
          required
        />
        <input
          className="guesthousebooking-native-date-picker"
          type="date"
          value={travelDetails[field]}
          onChange={(event) => updateTravelDetails(field, event.target.value)}
          min={field === 'checkOutDate' ? travelDetails.checkInDate || undefined : undefined}
          aria-label={`Open ${field === 'checkInDate' ? 'check-in' : 'check-out'} calendar`}
          tabIndex={-1}
        />
      </span>
    </label>
  );

  const renderTravelPanel = () => (
    <div className="guesthousebooking-travel-panel">
      <div className="guesthousebooking-panel-title">
        <span>Travel Information</span>
      </div>
      <div className="guesthousebooking-travel-grid">
        <div className="guesthousebooking-travel-row">
          <span className="guesthousebooking-travel-label">Check-in</span>
          {renderTravelDateInput('checkInDate')}
          {renderTimeSelect('checkInTime', 'Time')}
        </div>

        <div className="guesthousebooking-travel-row">
          <span className="guesthousebooking-travel-label">Check-out</span>
          {renderTravelDateInput('checkOutDate')}
          {renderTimeSelect('checkOutTime', 'Time')}
        </div>

        <div className="guesthousebooking-days-row">
          <span className="guesthousebooking-days-icon">
            <Clock3 size={18} />
          </span>
          <span>Duration</span>
          <strong>{travelDuration}</strong>
        </div>
      </div>
    </div>
  );

  return (
    <div className="guesthousebooking-page">
      <div className="guesthousebooking-shell">
        <form onSubmit={handleSubmit}>
          <section className="guesthousebooking-card">
            <button
              className="guesthousebooking-card-header"
              type="button"
              onClick={() => setIsApplicantCardOpen((prev) => !prev)}
            >
              <span>Applicant Details</span>
              {isApplicantCardOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {isApplicantCardOpen && (
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
            )}
          </section>

          <div className="guesthousebooking-guest-list" aria-label="Guest Details">
            {guests.map((guest, index) => (
              <section className="guesthousebooking-card guesthousebooking-guest-card" key={guest.id}>
                <div className="guesthousebooking-guest-block">
                  <div className="guesthousebooking-section-header guesthousebooking-guest-title-row">
                    <span className="guesthousebooking-guest-title">
                      Guest {index + 1}
                    </span>
                    <div className="guesthousebooking-guest-actions">
                      <button
                        className="guesthousebooking-icon-button"
                        type="button"
                        onClick={addGuest}
                        aria-label="Add guest"
                        title="Add guest"
                      >
                        <PlusCircle size={18} />
                      </button>
                      <button
                        className="guesthousebooking-icon-button guesthousebooking-icon-button--danger"
                        type="button"
                        onClick={() => removeGuest(guest.id)}
                        aria-label={`Remove guest ${index + 1}`}
                        title="Remove guest"
                        disabled={guests.length === 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="guesthousebooking-card-body guesthousebooking-guest-grid">
                    <div className="guesthousebooking-details-panel">
                      <div className="guesthousebooking-details-grid">
                        <div className="guesthousebooking-field guesthousebooking-field--guest-name">
                          <label className="guesthousebooking-label">Guest Name</label>
                          <input
                            className="guesthousebooking-input"
                            value={guest.name}
                            onChange={(event) => updateGuest(guest.id, 'name', event.target.value)}
                            placeholder="Enter guest name"
                            required
                          />
                        </div>

                        <div className="guesthousebooking-field guesthousebooking-field--gender">
                          <label className="guesthousebooking-label">Gender</label>
                          <div className="guesthousebooking-radio-group">
                            {(['Male', 'Female', 'Others'] as Gender[]).map((gender) => (
                              <label
                                className={`guesthousebooking-radio ${
                                  guest.gender === gender ? 'guesthousebooking-radio--active' : ''
                                }`}
                                key={gender}
                              >
                                <input
                                  type="radio"
                                  name={`guest-gender-${guest.id}`}
                                  checked={guest.gender === gender}
                                  onChange={() => updateGuest(guest.id, 'gender', gender)}
                                  required
                                />
                                <span>{gender}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="guesthousebooking-field guesthousebooking-field--designation">
                          <label className="guesthousebooking-label">Designation</label>
                          <input
                            className="guesthousebooking-input"
                            value={guest.designation}
                            onChange={(event) =>
                              updateGuest(guest.id, 'designation', event.target.value)
                            }
                            placeholder="Enter designation"
                          />
                        </div>

                        <div className="guesthousebooking-field guesthousebooking-field--priority">
                          <label className="guesthousebooking-label">Priority</label>
                          <div className="guesthousebooking-radio-group">
                            {(['Routine', 'High'] as GuestPriority[]).map((priority) => (
                              <label
                                className={`guesthousebooking-radio ${
                                  guest.priority === priority ? 'guesthousebooking-radio--active' : ''
                                }`}
                                key={priority}
                              >
                                <input
                                  type="radio"
                                  name={`guest-priority-${guest.id}`}
                                  checked={guest.priority === priority}
                                  onChange={() => updateGuest(guest.id, 'priority', priority)}
                                />
                                <span>{priority}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="guesthousebooking-field guesthousebooking-field--organization">
                          <label className="guesthousebooking-label">Organization</label>
                          <input
                            className="guesthousebooking-input"
                            value={guest.organization}
                            onChange={(event) =>
                              updateGuest(guest.id, 'organization', event.target.value)
                            }
                            placeholder="Enter organization"
                          />
                        </div>

                        <div className="guesthousebooking-field guesthousebooking-field--city">
                          <label className="guesthousebooking-label">City</label>
                          <input
                            className="guesthousebooking-input"
                            value={guest.city}
                            onChange={(event) => updateGuest(guest.id, 'city', event.target.value)}
                            placeholder="Enter city"
                          />
                        </div>

                        <div className="guesthousebooking-field guesthousebooking-field--state">
                          <label className="guesthousebooking-label">State</label>
                          <input
                            className="guesthousebooking-input"
                            value={guest.state}
                            onChange={(event) => updateGuest(guest.id, 'state', event.target.value)}
                            placeholder="Enter state"
                          />
                        </div>
                      </div>
                    </div>

                    {renderTravelPanel()}

                    <div className="guesthousebooking-option-row guesthousebooking-field--accompanied">
                      <div className="guesthousebooking-option-heading">
                        <span className="guesthousebooking-option-icon">
                          <UsersRound size={20} />
                        </span>
                        <span>Accompanied By</span>
                      </div>
                      <div className="guesthousebooking-count-row guesthousebooking-count-row--boxed">
                        <label>
                          <span>Male</span>
                          <input
                            className="guesthousebooking-small-input"
                            type="number"
                            min="0"
                            value={guest.accompaniedMale}
                            placeholder="0"
                            onChange={(event) =>
                              updateGuest(guest.id, 'accompaniedMale', event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Female</span>
                          <input
                            className="guesthousebooking-small-input"
                            type="number"
                            min="0"
                            value={guest.accompaniedFemale}
                            placeholder="0"
                            onChange={(event) =>
                              updateGuest(guest.id, 'accompaniedFemale', event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Children</span>
                          <input
                            className="guesthousebooking-small-input"
                            type="number"
                            min="0"
                            value={guest.accompaniedChildren}
                            placeholder="0"
                            onChange={(event) =>
                              updateGuest(guest.id, 'accompaniedChildren', event.target.value)
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="guesthousebooking-option-row guesthousebooking-field--guest-total">
                      <div className="guesthousebooking-option-heading">
                        <span className="guesthousebooking-option-icon">
                          <UsersRound size={20} />
                        </span>
                        <span>Total Number of Guests</span>
                      </div>
                      <input
                        className="guesthousebooking-small-input guesthousebooking-total-input"
                        type="number"
                        value={totalGuestCount}
                        readOnly
                        aria-label="Total number of guests"
                      />
                    </div>

                    <div className="guesthousebooking-option-row guesthousebooking-field--room">
                      <div className="guesthousebooking-option-heading">
                        <span className="guesthousebooking-option-icon">
                          <BedDouble size={21} />
                        </span>
                        <span>Room Requirements</span>
                      </div>
                      <div className="guesthousebooking-number-choice-group">
                        <label className="guesthousebooking-number-choice">
                          <span>Single</span>
                          <input
                            className="guesthousebooking-small-input"
                            type="number"
                            min="0"
                            value={guest.roomSingle}
                            onChange={(event) =>
                              updateGuest(guest.id, 'roomSingle', event.target.value)
                            }
                            aria-label={`Guest ${index + 1} single room count`}
                          />
                        </label>
                        <label className="guesthousebooking-number-choice">
                          <span>Double</span>
                          <input
                            className="guesthousebooking-small-input"
                            type="number"
                            min="0"
                            value={guest.roomDouble}
                            onChange={(event) =>
                              updateGuest(guest.id, 'roomDouble', event.target.value)
                            }
                            aria-label={`Guest ${index + 1} double room count`}
                          />
                        </label>
                        <label className="guesthousebooking-number-choice">
                          <span>Deluxe</span>
                          <input
                            className="guesthousebooking-small-input"
                            type="number"
                            min="0"
                            value={guest.roomDeluxe}
                            onChange={(event) =>
                              updateGuest(guest.id, 'roomDeluxe', event.target.value)
                            }
                            aria-label={`Guest ${index + 1} deluxe room count`}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="guesthousebooking-option-row guesthousebooking-field--food">
                      <div className="guesthousebooking-option-heading">
                        <span className="guesthousebooking-option-icon">
                          <Utensils size={20} />
                        </span>
                        <span>Food</span>
                      </div>
                      <div className="guesthousebooking-number-choice-group">
                        <label className="guesthousebooking-number-choice guesthousebooking-number-choice--veg">
                          <span>Veg.</span>
                          <input
                            className="guesthousebooking-small-input guesthousebooking-small-input--veg"
                            type="number"
                            min="0"
                            value={guest.foodVeg}
                            onChange={(event) =>
                              updateGuest(guest.id, 'foodVeg', event.target.value)
                            }
                            aria-label={`Guest ${index + 1} veg count`}
                          />
                        </label>
                        <label className="guesthousebooking-number-choice guesthousebooking-number-choice--nonveg">
                          <span>Non-Veg.</span>
                          <input
                            className="guesthousebooking-small-input guesthousebooking-small-input--nonveg"
                            type="number"
                            min="0"
                            value={guest.foodNonVeg}
                            onChange={(event) =>
                              updateGuest(guest.id, 'foodNonVeg', event.target.value)
                            }
                            aria-label={`Guest ${index + 1} non-veg count`}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <section className="guesthousebooking-card guesthousebooking-food-card">
            <div className="guesthousebooking-section-header">
              <h2>Snacks &amp; Food Requirements</h2>
              <div className="guesthousebooking-food-legend">
                <span>
                  <i className="guesthousebooking-legend-box guesthousebooking-legend-box--veg" />
                  Veg
                </span>
                <span>
                  <i className="guesthousebooking-legend-box guesthousebooking-legend-box--nonveg" />
                  Non-Veg
                </span>
              </div>
            </div>

            <div className="guesthousebooking-card-body">
              <div className="guesthousebooking-table-wrap">
                <table className="guesthousebooking-food-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Morning Refreshment</th>
                      <th>Breakfast</th>
                      <th>Lunch</th>
                      <th>Evening Refreshment</th>
                      <th>Dinner</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foodRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            className="guesthousebooking-food-date"
                            type="date"
                            value={row.date}
                            onChange={(event) => updateFoodRow(row.id, 'date', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="guesthousebooking-food-input"
                            type="number"
                            min="0"
                            value={row.morningRefreshment}
                            onChange={(event) =>
                              updateFoodRow(row.id, 'morningRefreshment', event.target.value)
                            }
                            aria-label="Morning refreshment count"
                          />
                        </td>
                        <td>{renderFoodPair(row, 'breakfastVeg', 'breakfastNonVeg', 'Breakfast')}</td>
                        <td>{renderFoodPair(row, 'lunchVeg', 'lunchNonVeg', 'Lunch')}</td>
                        <td>
                          <input
                            className="guesthousebooking-food-input"
                            type="number"
                            min="0"
                            value={row.eveningRefreshment}
                            onChange={(event) =>
                              updateFoodRow(row.id, 'eveningRefreshment', event.target.value)
                            }
                            aria-label="Evening refreshment count"
                          />
                        </td>
                        <td>{renderFoodPair(row, 'dinnerVeg', 'dinnerNonVeg', 'Dinner')}</td>
                        <td>
                          <div className="guesthousebooking-row-actions">
                            <button
                              className="guesthousebooking-icon-button"
                              type="button"
                              onClick={addFoodRow}
                              aria-label="Add food row"
                              title="Add food row"
                            >
                              <PlusCircle size={16} />
                            </button>
                            <button
                              className="guesthousebooking-icon-button guesthousebooking-icon-button--danger"
                              type="button"
                              onClick={() => removeFoodRow(row.id)}
                              aria-label="Remove food row"
                              title="Remove food row"
                              disabled={foodRows.length === 1}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="guesthousebooking-food-summary">
                <span>
                  Stay Dates <strong>{stayDates.length || '-'}</strong>
                </span>
                <span>
                  Refreshment <strong>{foodTotals.refreshment}</strong>
                </span>
                <span>
                  Veg <strong>{foodTotals.veg}</strong>
                </span>
                <span>
                  Non-Veg <strong>{foodTotals.nonVeg}</strong>
                </span>
              </div>
            </div>
          </section>

          <div className="guesthousebooking-actions">
            {submitMessage && <span className="guesthousebooking-success">{submitMessage}</span>}
            <button className="guesthousebooking-secondary-button" type="button" onClick={handleReset}>
              Reset
            </button>
            <button className="guesthousebooking-submit-button" type="submit">
              Submit Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GuestHouseBooking;