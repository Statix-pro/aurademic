import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeAlert,
  CarFront,
  ClipboardCheck,
  MapPin,
  Plus,
  PlusCircle,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import './VehicleBooking.css';

type Priority = string;
type VehicleRequirement = string;
type BookingFor = string;
type ServiceType = string;
type TravelMode = string;
type ShuttleBookingMode = string;
type ShuttleRequirement = string;

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

interface VehicleAllotmentRow {
  id: number;
  type: string;
  vehicleNo: string;
  make: string;
  driver: string;
  mobile: string;
}

type ApiRecord = Record<string, unknown>;

interface VehicleBookingOptions {
  priorities: Priority[];
  vehicleRequirements: VehicleRequirement[];
  bookingForOptions: BookingFor[];
  logisticsVehicleRequirements: VehicleRequirement[];
  logisticsBookingForOptions: BookingFor[];
  serviceTypes: ServiceType[];
  travelModes: TravelMode[];
  shuttleBookingModes: ShuttleBookingMode[];
  shuttleRequirements: ShuttleRequirement[];
  shuttlePurposes: string[];
  vehicleNumbers: string[];
  drivers: string[];
}

const createEmptyVehicleBookingOptions = (): VehicleBookingOptions => ({
  priorities: [],
  vehicleRequirements: [],
  bookingForOptions: [],
  logisticsVehicleRequirements: [],
  logisticsBookingForOptions: [],
  serviceTypes: [],
  travelModes: [],
  shuttleBookingModes: [],
  shuttleRequirements: [],
  shuttlePurposes: [],
  vehicleNumbers: [],
  drivers: [],
});

const getPayloadData = (payload: unknown) => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
    return (payload as ApiRecord).data as unknown;
  }

  return payload;
};

const getTextValue = (source: ApiRecord, keys: string[]) => {
  const value = keys.map((key) => source[key]).find((item) => item !== undefined && item !== null);
  return String(value || '').trim();
};

const getOptionSource = (source: ApiRecord, keys: string[]) =>
  keys.map((key) => source[key]).find((value) => value !== undefined && value !== null);

const normalizeTextOptions = (value: unknown, keys: string[]) => {
  const source = getPayloadData(value);
  const items = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? (source as ApiRecord).items || (source as ApiRecord).options || (source as ApiRecord).data || []
      : [];

  if (!Array.isArray(items)) {
    return [];
  }

  return Array.from(
    new Set(
      items
        .map((item) => {
          if (typeof item === 'object' && item !== null) {
            return getTextValue(item as ApiRecord, keys);
          }

          return String(item || '').trim();
        })
        .filter(Boolean),
    ),
  );
};

const normalizeVehicleBookingOptions = (payload: unknown): VehicleBookingOptions => {
  const source = getPayloadData(payload);
  const record = source && typeof source === 'object' && !Array.isArray(source) ? source as ApiRecord : {};

  return {
    priorities: normalizeTextOptions(getOptionSource(record, ['priorities', 'priorityOptions', 'priority_options']), ['name', 'label', 'value', 'priority']),
    vehicleRequirements: normalizeTextOptions(getOptionSource(record, ['vehicleRequirements', 'vehicle_requirements', 'requirements']), ['name', 'label', 'value', 'type']),
    bookingForOptions: normalizeTextOptions(getOptionSource(record, ['bookingForOptions', 'booking_for_options', 'bookingFor']), ['name', 'label', 'value']),
    logisticsVehicleRequirements: normalizeTextOptions(getOptionSource(record, ['logisticsVehicleRequirements', 'logistics_vehicle_requirements']), ['name', 'label', 'value', 'type']),
    logisticsBookingForOptions: normalizeTextOptions(getOptionSource(record, ['logisticsBookingForOptions', 'logistics_booking_for_options']), ['name', 'label', 'value']),
    serviceTypes: normalizeTextOptions(getOptionSource(record, ['serviceTypes', 'service_types', 'services']), ['name', 'label', 'value']),
    travelModes: normalizeTextOptions(getOptionSource(record, ['travelModes', 'travel_modes']), ['name', 'label', 'value']),
    shuttleBookingModes: normalizeTextOptions(getOptionSource(record, ['shuttleBookingModes', 'shuttle_booking_modes']), ['name', 'label', 'value', 'mode']),
    shuttleRequirements: normalizeTextOptions(getOptionSource(record, ['shuttleRequirements', 'shuttle_requirements']), ['name', 'label', 'value', 'requirement']),
    shuttlePurposes: normalizeTextOptions(getOptionSource(record, ['shuttlePurposes', 'shuttle_purposes', 'purposes']), ['name', 'label', 'value', 'purpose']),
    vehicleNumbers: normalizeTextOptions(getOptionSource(record, ['vehicleNumbers', 'vehicle_numbers', 'vehicles']), ['vehicleNo', 'vehicle_no', 'registrationNumber', 'registration_number', 'number', 'name', 'label', 'value']),
    drivers: normalizeTextOptions(getOptionSource(record, ['drivers', 'driverOptions', 'driver_options']), ['driver', 'driverName', 'driver_name', 'name', 'full_name', 'fullName', 'label', 'value']),
  };
};

const buildApplicantDetails = (
  user: ApiRecord | null | undefined,
  profile: ApiRecord | null,
): ApplicantDetails => {
  const sources = [user, profile].filter(Boolean) as ApiRecord[];
  const read = (keys: string[]) =>
    sources.reduce((value, source) => value || getTextValue(source, keys), '');

  return {
    employeeId: read(['employee_id', 'employeeId', 'erp_id', 'erpId', 'id']),
    name: read(['name', 'full_name', 'fullName']),
    date: formatDateInput(new Date()),
    department: read(['department', 'department_name', 'departmentName']),
    designation: read(['designation', 'role_name', 'roleName']),
    email: read(['email', 'mail']),
    mobile: read(['mobile', 'phone', 'phone_number', 'phoneNumber', 'contact']),
  };
};

const selectKnownOrFirst = (value: string, options: string[]) =>
  value && options.includes(value) ? value : options[0] || '';

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

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

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return '';
  }

  return formatDateInput(date);
};


const normalizeTimeEntry = (value: string) => {
  const trimmed = value.trim().toUpperCase().replace(/\s+/g, ' ');
  const normalized = trimmed.replace(/^([0-9]{1,2})([0-9]{2})(AM|PM)$/i, '$1:$2 $3');
  const match = normalized.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/i);
  if (!match) {
    return value;
  }

  const hour = String(Number(match[1])).padStart(2, '0');
  const minute = match[2];
  const period = match[3].toUpperCase();

  return `${hour}:${minute} ${period}`;
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

const createShuttleDayRow = (requirement = ''): ShuttleDayRow => ({
  id: Date.now() + Math.random(),
  date: '',
  requirement,
});

const createVehicleAllotmentRow = (): VehicleAllotmentRow => ({
  id: Date.now() + Math.random(),
  type: '',
  vehicleNo: '',
  make: '',
  driver: '',
  mobile: '',
});

const MaleAllotmentIcon = () => (
  <svg
    className="vehiclebooking-allotment-person-icon"
    viewBox="0 0 72 72"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="36" cy="16" r="13" />
    <path d="M15 64v-7.5C15 43.8 24.4 34 36 34s21 9.8 21 22.5V64H15z" />
    <path
      className="vehiclebooking-allotment-person-icon-detail"
      d="M29.5 36.5 36 45l6.5-8.5 2.2 27.5H27.3l2.2-27.5z"
    />
    <path
      className="vehiclebooking-allotment-person-icon-detail"
      d="M27.2 36.8 36 47.2l8.8-10.4-3.8 4.1L36 38.2l-5 2.7-3.8-4.1z"
    />
  </svg>
);

const FemaleAllotmentIcon = () => (
  <svg
    className="vehiclebooking-allotment-person-icon"
    viewBox="0 0 72 72"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M16 64v-4.6C16 50 24.6 42.8 36 42.8S56 59.4V64H16z" />
    <path d="M17.8 43.5V31.2C17.8 17.1 25.4 7 36 7s18.2 10.1 18.2 24.2v12.3H17.8z" />
    <path
      className="vehiclebooking-allotment-person-icon-detail"
      d="M23.8 30.5c5.9-.9 10.3-4.4 13.3-10.2 2.7 5.2 6.5 8.7 11.1 10.2v4.7C48.2 43.3 42.7 50 36 50s-12.2-6.7-12.2-14.8v-4.7z"
    />
    <path d="M25 45.7 36 57l11-11.3c7.4 3 12 9.2 12 17.4V64H13v-.9c0-8.2 4.6-14.4 12-17.4z" />
  </svg>
);

const ChildAllotmentIcon = () => (
  <svg
    className="vehiclebooking-allotment-person-icon"
    viewBox="0 0 72 72"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="36" cy="14" r="10" />
    <path d="M21 31.5c0-3 2.4-5.5 5.5-5.5h19c3.1 0 5.5 2.5 5.5 5.5V47h-7v17H28V47h-7V31.5z" />
  </svg>
);

const MapPinWithBase = ({ size = 22, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <ellipse cx="12" cy="21" rx="8" ry="2.2" fill="currentColor" />
    <path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
      fill="currentColor"
    />
  </svg>
);

const VehicleBooking: React.FC = () => {
  const { user } = useAuth();
  const [applicantProfile, setApplicantProfile] = useState<ApiRecord | null>(null);
  const [bookingOptions, setBookingOptions] = useState<VehicleBookingOptions>(() =>
    createEmptyVehicleBookingOptions(),
  );
  const [transportDetails, setTransportDetails] = useState<TransportBookingDetails>({
    purpose: '',
    priority: '',
    vehicleRequirement: '',
    numberOfVehicles: '',
    bookingFor: '',
    serviceType: '',
    accompaniedMale: '',
    accompaniedFemale: '',
    accompaniedChildren: '',
    remarks: '',
    travelMode: '',
  });
  const [travelPlanRows, setTravelPlanRows] = useState<TravelPlanRow[]>([createTravelPlanRow()]);
  const [shuttleBookingMode, setShuttleBookingMode] = useState<ShuttleBookingMode>('');
  const [shuttleTripRows, setShuttleTripRows] = useState<ShuttleTripRow[]>([
    createShuttleTripRow(),
  ]);
  const [shuttleDayRows, setShuttleDayRows] = useState<ShuttleDayRow[]>([
    createShuttleDayRow(),
  ]);
  const [vehicleAllotmentRows, setVehicleAllotmentRows] = useState<
    VehicleAllotmentRow[]
  >([createVehicleAllotmentRow()]);

  const [travelPlanBoardingDateInputs, setTravelPlanBoardingDateInputs] = useState<Record<number, string>>({});
  const [travelPlanDroppingDateInputs, setTravelPlanDroppingDateInputs] = useState<Record<number, string>>({});
  const [shuttleTripDateInputs, setShuttleTripDateInputs] = useState<Record<number, string>>({});
  const [shuttleDayDateInputs, setShuttleDayDateInputs] = useState<Record<number, string>>({});

  const applicantUiDetails = useMemo(
    () => buildApplicantDetails(user as unknown as ApiRecord | null, applicantProfile),
    [applicantProfile, user],
  );

  useEffect(() => {
    let isMounted = true;

    const loadApplicantProfile = async () => {
      try {
        const response = await authenticityUtility.get('/dashboard/profile');
        const profile = getPayloadData(response);

        if (isMounted && profile && typeof profile === 'object' && !Array.isArray(profile)) {
          setApplicantProfile(profile as ApiRecord);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.info('Vehicle applicant profile could not be loaded.', error);
        }
      }
    };

    loadApplicantProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadBookingOptions = async () => {
      try {
        const response = await authenticityUtility.get('/vehicle-booking/options');
        const options = normalizeVehicleBookingOptions(response);

        if (isMounted) {
          setBookingOptions(options);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.info('Vehicle booking options could not be loaded.', error);
        }
      }
    };

    loadBookingOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setTransportDetails((prevDetails) => {
      const vehicleRequirement = selectKnownOrFirst(
        prevDetails.vehicleRequirement,
        bookingOptions.vehicleRequirements,
      );
      const bookingForChoices = bookingOptions.logisticsVehicleRequirements.includes(vehicleRequirement)
        ? bookingOptions.logisticsBookingForOptions
        : bookingOptions.bookingForOptions;
      const nextDetails = {
        ...prevDetails,
        priority: selectKnownOrFirst(prevDetails.priority, bookingOptions.priorities),
        vehicleRequirement,
        bookingFor: selectKnownOrFirst(prevDetails.bookingFor, bookingForChoices),
        serviceType: selectKnownOrFirst(prevDetails.serviceType, bookingOptions.serviceTypes),
        travelMode: selectKnownOrFirst(prevDetails.travelMode, bookingOptions.travelModes),
      };

      return JSON.stringify(nextDetails) === JSON.stringify(prevDetails) ? prevDetails : nextDetails;
    });

    setShuttleBookingMode((prevMode) =>
      selectKnownOrFirst(prevMode, bookingOptions.shuttleBookingModes),
    );
    setShuttleDayRows((prevRows) =>
      prevRows.map((row) => {
        const requirement = selectKnownOrFirst(row.requirement, bookingOptions.shuttleRequirements);
        return requirement === row.requirement ? row : { ...row, requirement };
      }),
    );
  }, [bookingOptions]);

  useEffect(() => {
    setTravelPlanBoardingDateInputs((prevInputs) =>
      travelPlanRows.reduce<Record<number, string>>((nextInputs, row) => {
        nextInputs[row.id] = row.boardingDate ? formatDateForDisplay(row.boardingDate) : prevInputs[row.id] || '';
        return nextInputs;
      }, {})
    );
    setTravelPlanDroppingDateInputs((prevInputs) =>
      travelPlanRows.reduce<Record<number, string>>((nextInputs, row) => {
        nextInputs[row.id] = row.droppingDate ? formatDateForDisplay(row.droppingDate) : prevInputs[row.id] || '';
        return nextInputs;
      }, {})
    );
  }, [travelPlanRows]);

  useEffect(() => {
    setShuttleTripDateInputs((prevInputs) =>
      shuttleTripRows.reduce<Record<number, string>>((nextInputs, row) => {
        nextInputs[row.id] = row.date ? formatDateForDisplay(row.date) : prevInputs[row.id] || '';
        return nextInputs;
      }, {})
    );
  }, [shuttleTripRows]);

  useEffect(() => {
    setShuttleDayDateInputs((prevInputs) =>
      shuttleDayRows.reduce<Record<number, string>>((nextInputs, row) => {
        nextInputs[row.id] = row.date ? formatDateForDisplay(row.date) : prevInputs[row.id] || '';
        return nextInputs;
      }, {})
    );
  }, [shuttleDayRows]);


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

  const availableBookingForOptions = useMemo(
    () =>
      bookingOptions.logisticsVehicleRequirements.includes(transportDetails.vehicleRequirement)
        ? bookingOptions.logisticsBookingForOptions
        : bookingOptions.bookingForOptions,
    [bookingOptions, transportDetails.vehicleRequirement]
  );

  const updateTransportDetails = (
    field: keyof TransportBookingDetails,
    value: string
  ) => {
    setTransportDetails((prevDetails) => ({ ...prevDetails, [field]: value }));
  };

  const handleVehicleRequirementSelect = (value: VehicleRequirement) => {
    setTransportDetails((prevDetails) => {
      const nextBookingOptions = bookingOptions.logisticsVehicleRequirements.includes(value)
        ? bookingOptions.logisticsBookingForOptions
        : bookingOptions.bookingForOptions;

      return {
        ...prevDetails,
        vehicleRequirement: value,
        bookingFor: nextBookingOptions.includes(prevDetails.bookingFor)
          ? prevDetails.bookingFor
          : nextBookingOptions[0] || '',
      };
    });
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

  const updateTravelPlanBoardingDateInput = (id: number, value: string) => {
    const formattedValue = formatDateEntry(value);
    const parsedDate = parseDisplayDate(formattedValue);

    setTravelPlanBoardingDateInputs((prevInputs) => ({ ...prevInputs, [id]: formattedValue }));

    if (!formattedValue || parsedDate) {
      updateTravelPlanRow(id, 'boardingDate', parsedDate);
    }
  };

  const resetTravelPlanBoardingDateInput = (row: TravelPlanRow) => {
    setTravelPlanBoardingDateInputs((prevInputs) => ({
      ...prevInputs,
      [row.id]: formatDateForDisplay(row.boardingDate),
    }));
  };

  const updateTravelPlanDroppingDateInput = (id: number, value: string) => {
    const formattedValue = formatDateEntry(value);
    const parsedDate = parseDisplayDate(formattedValue);

    setTravelPlanDroppingDateInputs((prevInputs) => ({ ...prevInputs, [id]: formattedValue }));

    if (!formattedValue || parsedDate) {
      updateTravelPlanRow(id, 'droppingDate', parsedDate);
    }
  };

  const resetTravelPlanDroppingDateInput = (row: TravelPlanRow) => {
    setTravelPlanDroppingDateInputs((prevInputs) => ({
      ...prevInputs,
      [row.id]: formatDateForDisplay(row.droppingDate),
    }));
  };

  const updateShuttleTripDateInput = (id: number, value: string) => {
    const formattedValue = formatDateEntry(value);
    const parsedDate = parseDisplayDate(formattedValue);

    setShuttleTripDateInputs((prevInputs) => ({ ...prevInputs, [id]: formattedValue }));

    if (!formattedValue || parsedDate) {
      updateShuttleTripRow(id, 'date', parsedDate);
    }
  };

  const resetShuttleTripDateInput = (row: ShuttleTripRow) => {
    setShuttleTripDateInputs((prevInputs) => ({
      ...prevInputs,
      [row.id]: formatDateForDisplay(row.date),
    }));
  };

  const updateShuttleDayDateInput = (id: number, value: string) => {
    const formattedValue = formatDateEntry(value);
    const parsedDate = parseDisplayDate(formattedValue);

    setShuttleDayDateInputs((prevInputs) => ({ ...prevInputs, [id]: formattedValue }));

    if (!formattedValue || parsedDate) {
      updateShuttleDayRow(id, 'date', parsedDate);
    }
  };

  const resetShuttleDayDateInput = (row: ShuttleDayRow) => {
    setShuttleDayDateInputs((prevInputs) => ({
      ...prevInputs,
      [row.id]: formatDateForDisplay(row.date),
    }));
  };


  const updateVehicleAllotmentRow = (
    id: number,
    field: keyof Omit<VehicleAllotmentRow, 'id'>,
    value: string
  ) => {
    setVehicleAllotmentRows((prevRows) =>
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

  const removeVehicleAllotmentRow = (id: number) => {
    setVehicleAllotmentRows((prevRows) =>
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
      vehicleAllotmentRows,
    });
  };

  const renderReadOnlyInput = (
    label: string,
    value: string,
    type: React.HTMLInputTypeAttribute = 'text',
    placeholder = ''
  ) => (
    <div className="vehiclebooking-field">
      <label className="vehiclebooking-label">{label}</label>
      <input
        className="vehiclebooking-input"
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
      className={`vehiclebooking-radio vehiclebooking-choice-button ${selectedValue === label ? 'vehiclebooking-radio--active' : ''
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
    <div className="vehiclebooking-row-actions vehiclebooking-table-actions">
      <button
        className="vehiclebooking-icon-button"
        type="button"
        onClick={addRow}
        aria-label={addLabel}
        title={addLabel}
      >
        <Plus size={18} />
      </button>
      <button
        className="vehiclebooking-icon-button vehiclebooking-icon-button--muted"
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

  const priorityStatus = transportDetails.priority;
  const priorityTone = priorityStatus.toLowerCase() === 'high' ? 'high' : 'routine';

  return (
    <div className="vehiclebooking-page">
      <div className="vehiclebooking-shell">
        <form onSubmit={handleSubmit}>
          <section className="vehiclebooking-card vehiclebooking-applicant-card">
            <div className="vehiclebooking-card-header">
              <span>Applicant Details</span>
            </div>
            <div className="vehiclebooking-card-body">
              <div className="vehiclebooking-form-grid">
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

          <section className="vehiclebooking-card vehiclebooking-large-card">
            <div className="vehiclebooking-card-inner">
              <div className="vehiclebooking-section-title">Transport Booking</div>

              <div className="vehiclebooking-transport-layout">
                <div className="vehiclebooking-layout-row vehiclebooking-layout-row--purpose">
                  <label className="vehiclebooking-inline-panel vehiclebooking-purpose-panel">
                    <span>Purpose</span>
                    <input
                      className="vehiclebooking-input"
                      value={transportDetails.purpose}
                      onChange={(event) =>
                        updateTransportDetails('purpose', event.target.value)
                      }
                      aria-label="Purpose"
                    />
                  </label>

                  <div className="vehiclebooking-inline-panel vehiclebooking-control-panel">
                    <span className="vehiclebooking-option-icon vehiclebooking-panel-icon">
                      <BadgeAlert size={24} />
                    </span>
                    <span className="vehiclebooking-panel-label">Priority</span>
                    <div className="vehiclebooking-radio-group vehiclebooking-segment-group">
                      {bookingOptions.priorities.map((priority) =>
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

                <div className="vehiclebooking-section-wrapper">
                  <hr className="vehiclebooking-divider" />
                  <div className="vehiclebooking-subsection-title vehiclebooking-subsection-title--above">Vehicle Requirement</div>
                  <div className="vehiclebooking-layout-row vehiclebooking-layout-row--vehicle vehiclebooking-row-container">
                    <div className="vehiclebooking-option-panel">
                      <div className="vehiclebooking-radio-group vehiclebooking-option-strip">
                        {bookingOptions.vehicleRequirements.map((vehicleRequirement) =>
                          renderChoiceButton(
                            vehicleRequirement,
                            transportDetails.vehicleRequirement,
                            'vehicle-requirement',
                            handleVehicleRequirementSelect
                          )
                        )}
                      </div>
                    </div>

                    <label className="vehiclebooking-inline-panel vehiclebooking-control-panel">
                      <span className="vehiclebooking-option-icon vehiclebooking-panel-icon">
                        <CarFront size={24} />
                      </span>
                      <span className="vehiclebooking-panel-label">No. of Vehicles</span>
                      <input
                        className="vehiclebooking-small-input vehiclebooking-count-input"
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
                </div>

                <div className="vehiclebooking-section-wrapper">
                  <hr className="vehiclebooking-divider" />
                  <div className="vehiclebooking-subsection-title vehiclebooking-subsection-title--above">Booking For</div>
                  <div className="vehiclebooking-layout-row vehiclebooking-layout-row--booking-for vehiclebooking-row-container">
                    <div className="vehiclebooking-option-panel">
                      <div className="vehiclebooking-radio-group vehiclebooking-option-strip vehiclebooking-option-strip--booking-for">
                        {availableBookingForOptions.map((bookingFor) =>
                          renderChoiceButton(
                            bookingFor,
                            transportDetails.bookingFor,
                            'vehicle-booking-for',
                            (value) => updateTransportDetails('bookingFor', value)
                          )
                        )}
                      </div>
                    </div>

                    <div className="vehiclebooking-inline-panel vehiclebooking-control-panel">
                      <span className="vehiclebooking-option-icon vehiclebooking-panel-icon">
                        <ClipboardCheck size={24} />
                      </span>
                      <span className="vehiclebooking-panel-label">Service</span>
                      <div className="vehiclebooking-radio-group vehiclebooking-segment-group">
                        {bookingOptions.serviceTypes.map((serviceType) =>
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
                </div>

                <div className="vehiclebooking-section-wrapper">
                  <hr className="vehiclebooking-divider" />
                  <div className="vehiclebooking-subsection-title vehiclebooking-subsection-title--above">Accompanied by</div>
                  <div className="vehiclebooking-layout-row vehiclebooking-layout-row--accompanied vehiclebooking-row-container">
                    <div className="vehiclebooking-inline-panel vehiclebooking-traveler-panel">
                      <div className="vehiclebooking-traveler-heading">
                        <span className="vehiclebooking-option-icon vehiclebooking-panel-icon vehiclebooking-traveler-icon">
                          <UsersRound size={24} strokeWidth={2.2} />
                        </span>
                        <span className="vehiclebooking-panel-label">Traveler Details</span>
                      </div>
                      <div className="vehiclebooking-traveler-counts">
                        <label>
                          <span>Male</span>
                          <input
                            className="vehiclebooking-small-input vehiclebooking-small-count"
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
                            className="vehiclebooking-small-input vehiclebooking-small-count"
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
                            className="vehiclebooking-small-input vehiclebooking-small-count"
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
                    </div>

                    <label className="vehiclebooking-inline-panel vehiclebooking-control-panel vehiclebooking-total-panel">
                      <span className="vehiclebooking-option-icon vehiclebooking-panel-icon">
                        <UsersRound size={24} />
                      </span>
                      <span className="vehiclebooking-panel-label">Total Travelers</span>
                      <input
                        className="vehiclebooking-small-input vehiclebooking-count-input"
                        type="number"
                        value={totalTravelers}
                        readOnly
                        aria-label="Total travelers"
                      />
                    </label>
                  </div>

                  <div className="vehiclebooking-layout-row vehiclebooking-layout-row--remarks">
                    <div className="vehiclebooking-remarks-panel">
                      <div className="vehiclebooking-option-heading">
                        <span>Remarks</span>
                      </div>
                      <input
                        className="vehiclebooking-remarks-input"
                        type="text"
                        value={transportDetails.remarks}
                        onChange={(event) =>
                          updateTransportDetails('remarks', event.target.value)
                        }
                        placeholder="Enter remarks (if any)"
                        aria-label="Remarks"
                      />
                    </div>

                    <div className="vehiclebooking-inline-panel vehiclebooking-control-panel vehiclebooking-travel-panel">
                      <span className="vehiclebooking-option-icon vehiclebooking-panel-icon">
                        <MapPin size={25} />
                      </span>
                      <span className="vehiclebooking-panel-label">Travel</span>
                      <div className="vehiclebooking-radio-group vehiclebooking-segment-group">
                        {bookingOptions.travelModes.map((travelMode) =>
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
              </div>
            </div>
          </section>

          <section className="vehiclebooking-card vehiclebooking-large-card">
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
                          <span className="vehiclebooking-date-input-wrap">
                            <input
                              className="vehiclebooking-input vehiclebooking-table-input"
                              type="text"
                              value={travelPlanBoardingDateInputs[row.id] ?? formatDateForDisplay(row.boardingDate)}
                              onChange={(event) => updateTravelPlanBoardingDateInput(row.id, event.target.value)}
                              onBlur={() => resetTravelPlanBoardingDateInput(row)}
                              placeholder="dd/mm/yyyy"
                              inputMode="numeric"
                              pattern="\d{2}/\d{2}/\d{4}"
                              title="Enter date as DD/MM/YYYY"
                              maxLength={10}
                              aria-label="Boarding date"
                            />
                            <input
                              className="vehiclebooking-native-date-picker"
                              type="date"
                              value={row.boardingDate}
                              onChange={(event) => updateTravelPlanRow(row.id, 'boardingDate', event.target.value)}
                              aria-label="Open boarding date calendar"
                              tabIndex={-1}
                            />
                          </span>
                        </td>
                        <td>
                          <input
                            className="vehiclebooking-input vehiclebooking-table-input"
                            type="text"
                            placeholder="09:30 AM"
                            inputMode="text"
                            autoCapitalize="characters"
                            pattern="^(0?[1-9]|1[0-2]):[0-5][0-9] ?(AM|PM|am|pm)$"
                            title="Enter time as HH:MM AM/PM, for example 09:30 AM"
                            value={row.boardingTime}
                            onChange={(event) =>
                              updateTravelPlanRow(row.id, 'boardingTime', event.target.value)
                            }
                            onBlur={(event) =>
                              updateTravelPlanRow(
                                row.id,
                                'boardingTime',
                                normalizeTimeEntry(event.target.value)
                              )
                            }
                            aria-label="Boarding time"
                          />
                        </td>
                        <td>
                          <input
                            className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--wide"
                            type="text"
                            value={row.boardingPoint}
                            onChange={(event) =>
                              updateTravelPlanRow(row.id, 'boardingPoint', event.target.value)
                            }
                            aria-label="Boarding point"
                          />
                        </td>
                        <td>
                          <span className="vehiclebooking-date-input-wrap">
                            <input
                              className="vehiclebooking-input vehiclebooking-table-input"
                              type="text"
                              value={travelPlanDroppingDateInputs[row.id] ?? formatDateForDisplay(row.droppingDate)}
                              onChange={(event) => updateTravelPlanDroppingDateInput(row.id, event.target.value)}
                              onBlur={() => resetTravelPlanDroppingDateInput(row)}
                              placeholder="dd/mm/yyyy"
                              inputMode="numeric"
                              pattern="\d{2}/\d{2}/\d{4}"
                              title="Enter date as DD/MM/YYYY"
                              maxLength={10}
                              aria-label="Dropping date"
                            />
                            <input
                              className="vehiclebooking-native-date-picker"
                              type="date"
                              value={row.droppingDate}
                              onChange={(event) => updateTravelPlanRow(row.id, 'droppingDate', event.target.value)}
                              aria-label="Open dropping date calendar"
                              tabIndex={-1}
                            />
                          </span>
                        </td>
                        <td>
                          <input
                            className="vehiclebooking-input vehiclebooking-table-input"
                            type="text"
                            placeholder="09:30 AM"
                            inputMode="text"
                            autoCapitalize="characters"
                            pattern="^(0?[1-9]|1[0-2]):[0-5][0-9] ?(AM|PM|am|pm)$"
                            title="Enter time as HH:MM AM/PM, for example 09:30 AM"
                            value={row.droppingTime}
                            onChange={(event) =>
                              updateTravelPlanRow(row.id, 'droppingTime', event.target.value)
                            }
                            onBlur={(event) =>
                              updateTravelPlanRow(
                                row.id,
                                'droppingTime',
                                normalizeTimeEntry(event.target.value)
                              )
                            }
                            aria-label="Dropping time"
                          />
                        </td>
                        <td>
                          <input
                            className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--wide"
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

              <div className="vehiclebooking-radio-group vehiclebooking-centered-toggle">
                {bookingOptions.shuttleBookingModes.map((mode) =>
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
                          <span className="vehiclebooking-date-input-wrap">
                            <input
                              className="vehiclebooking-input vehiclebooking-table-input"
                              type="text"
                              value={shuttleTripDateInputs[row.id] ?? formatDateForDisplay(row.date)}
                              onChange={(event) => updateShuttleTripDateInput(row.id, event.target.value)}
                              onBlur={() => resetShuttleTripDateInput(row)}
                              placeholder="dd/mm/yyyy"
                              inputMode="numeric"
                              pattern="\d{2}/\d{2}/\d{4}"
                              title="Enter date as DD/MM/YYYY"
                              maxLength={10}
                              aria-label="Shuttle trip date"
                            />
                            <input
                              className="vehiclebooking-native-date-picker"
                              type="date"
                              value={row.date}
                              onChange={(event) => updateShuttleTripRow(row.id, 'date', event.target.value)}
                              aria-label="Open shuttle trip date calendar"
                              tabIndex={-1}
                            />
                          </span>
                        </td>
                        <td>
                          <input
                            className="vehiclebooking-input vehiclebooking-table-input"
                            type="text"
                            placeholder="09:30 AM"
                            inputMode="text"
                            autoCapitalize="characters"
                            pattern="^(0?[1-9]|1[0-2]):[0-5][0-9] ?(AM|PM|am|pm)$"
                            title="Enter time as HH:MM AM/PM, for example 09:30 AM"
                            value={row.time}
                            onChange={(event) =>
                              updateShuttleTripRow(row.id, 'time', event.target.value)
                            }
                            onBlur={(event) =>
                              updateShuttleTripRow(
                                row.id,
                                'time',
                                normalizeTimeEntry(event.target.value)
                              )
                            }
                            aria-label="Shuttle trip time"
                          />
                        </td>
                        <td>
                          <select
                            className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-select"
                            value={row.purpose}
                            onChange={(event) =>
                              updateShuttleTripRow(row.id, 'purpose', event.target.value)
                            }
                            aria-label="Shuttle trip purpose"
                          >
                            <option value=""></option>
                            {bookingOptions.shuttlePurposes.map((purpose) => (
                              <option key={purpose} value={purpose}>
                                {purpose}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--compact"
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
                          <span className="vehiclebooking-date-input-wrap">
                            <input
                              className="vehiclebooking-input vehiclebooking-table-input"
                              type="text"
                              value={shuttleDayDateInputs[row.id] ?? formatDateForDisplay(row.date)}
                              onChange={(event) => updateShuttleDayDateInput(row.id, event.target.value)}
                              onBlur={() => resetShuttleDayDateInput(row)}
                              placeholder="dd/mm/yyyy"
                              inputMode="numeric"
                              pattern="\d{2}/\d{2}/\d{4}"
                              title="Enter date as DD/MM/YYYY"
                              maxLength={10}
                              aria-label="Shuttle day date"
                            />
                            <input
                              className="vehiclebooking-native-date-picker"
                              type="date"
                              value={row.date}
                              onChange={(event) => updateShuttleDayRow(row.id, 'date', event.target.value)}
                              aria-label="Open shuttle day date calendar"
                              tabIndex={-1}
                            />
                          </span>
                        </td>
                        <td>
                          <div className="vehiclebooking-radio-group vehiclebooking-requirement-group">
                            {bookingOptions.shuttleRequirements.map(
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
                                createShuttleDayRow(bookingOptions.shuttleRequirements[0] || ''),
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

          <section className="vehiclebooking-card vehiclebooking-allotment-card">
            <div className="vehiclebooking-card-inner vehiclebooking-allotment-inner">
              <div className="vehiclebooking-allotment-title">Vehicle Allotment</div>

              <div className="vehiclebooking-allotment-panel">
                <div className="vehiclebooking-allotment-summary">
                  <div className="vehiclebooking-allotment-applicant">
                    <span
                      className={`vehiclebooking-priority-indicator vehiclebooking-priority-indicator--${priorityTone}`}
                      aria-label={`${priorityStatus} priority`}
                      title={`${priorityStatus} priority`}
                    />
                    <span className="vehiclebooking-allotment-applicant-icon">
                      <UsersRound size={20} />
                    </span>
                    <div>
                      <strong>{applicantUiDetails.name || 'Applicant Name'}</strong>
                      <span>{applicantUiDetails.department || 'Organization'}</span>
                    </div>
                  </div>

                  <div className="vehiclebooking-allotment-right-controls">
                    <span className="vehiclebooking-allotment-staff-badge">
                      {transportDetails.bookingFor}
                    </span>

                    <div className="vehiclebooking-allotment-stat-item">
                      <div className="vehiclebooking-allotment-circle-icon">
                        <UsersRound size={16} />
                      </div>
                      <input
                        className="vehiclebooking-allotment-stat-value"
                        type="text"
                        value={totalTravelers}
                        readOnly
                        aria-label="Allotment total travelers"
                      />
                    </div>

                    <div className="vehiclebooking-allotment-stat-item">
                      <div className="vehiclebooking-allotment-circle-icon">
                        <CarFront size={16} />
                      </div>
                      <input
                        className="vehiclebooking-allotment-stat-value"
                        type="text"
                        value={transportDetails.numberOfVehicles}
                        readOnly
                        aria-label="Allotment vehicles required"
                      />
                    </div>

                    <div className="vehiclebooking-allotment-mode-group">
                      <MapPinWithBase size={30} className="vehiclebooking-allotment-pin-icon" />
                      <span className="vehiclebooking-allotment-mode-badge">
                        {transportDetails.travelMode}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="vehiclebooking-allotment-section-heading">Travel Plan</div>

                <div className="vehiclebooking-table-wrap vehiclebooking-allotment-table-wrap">
                  <table className="vehiclebooking-table vehiclebooking-allotment-route-table">
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
                            <span className="vehiclebooking-date-input-wrap">
                              <input
                                className="vehiclebooking-input vehiclebooking-table-input"
                                type="text"
                                value={travelPlanBoardingDateInputs[row.id] ?? formatDateForDisplay(row.boardingDate)}
                                onChange={(event) => updateTravelPlanBoardingDateInput(row.id, event.target.value)}
                                onBlur={() => resetTravelPlanBoardingDateInput(row)}
                                placeholder="dd/mm/yyyy"
                                inputMode="numeric"
                                pattern="\d{2}/\d{2}/\d{4}"
                                title="Enter date as DD/MM/YYYY"
                                maxLength={10}
                                aria-label="Allotment boarding date"
                              />
                              <input
                                className="vehiclebooking-native-date-picker"
                                type="date"
                                value={row.boardingDate}
                                onChange={(event) => updateTravelPlanRow(row.id, 'boardingDate', event.target.value)}
                                aria-label="Open allotment boarding date calendar"
                                tabIndex={-1}
                              />
                            </span>
                          </td>
                          <td>
                            <input
                              className="vehiclebooking-input vehiclebooking-table-input"
                              type="text"
                              value={row.boardingTime}
                              onChange={(event) =>
                                updateTravelPlanRow(row.id, 'boardingTime', event.target.value)
                              }
                              aria-label="Allotment boarding time"
                            />
                          </td>
                          <td>
                            <input
                              className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--wide"
                              type="text"
                              value={row.boardingPoint}
                              onChange={(event) =>
                                updateTravelPlanRow(row.id, 'boardingPoint', event.target.value)
                              }
                              aria-label="Allotment boarding point"
                            />
                          </td>
                          <td>
                            <span className="vehiclebooking-date-input-wrap">
                              <input
                                className="vehiclebooking-input vehiclebooking-table-input"
                                type="text"
                                value={travelPlanDroppingDateInputs[row.id] ?? formatDateForDisplay(row.droppingDate)}
                                onChange={(event) => updateTravelPlanDroppingDateInput(row.id, event.target.value)}
                                onBlur={() => resetTravelPlanDroppingDateInput(row)}
                                placeholder="dd/mm/yyyy"
                                inputMode="numeric"
                                pattern="\d{2}/\d{2}/\d{4}"
                                title="Enter date as DD/MM/YYYY"
                                maxLength={10}
                                aria-label="Allotment dropping date"
                              />
                              <input
                                className="vehiclebooking-native-date-picker"
                                type="date"
                                value={row.droppingDate}
                                onChange={(event) => updateTravelPlanRow(row.id, 'droppingDate', event.target.value)}
                                aria-label="Open allotment dropping date calendar"
                                tabIndex={-1}
                              />
                            </span>
                          </td>
                          <td>
                            <input
                              className="vehiclebooking-input vehiclebooking-table-input"
                              type="text"
                              value={row.droppingTime}
                              onChange={(event) =>
                                updateTravelPlanRow(row.id, 'droppingTime', event.target.value)
                              }
                              aria-label="Allotment dropping time"
                            />
                          </td>
                          <td>
                            <input
                              className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--wide"
                              type="text"
                              value={row.droppingPoint}
                              onChange={(event) =>
                                updateTravelPlanRow(row.id, 'droppingPoint', event.target.value)
                              }
                              aria-label="Allotment droping point"
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
              </div>

              <div className="vehiclebooking-allotment-list">
                {vehicleAllotmentRows.map((row) => (
                  <div className="vehiclebooking-allotment-row" key={row.id}>
                    <span className="vehiclebooking-allotment-label">Vehicle</span>

                    <select
                      className={`vehiclebooking-input vehiclebooking-allotment-select-type ${row.type === '' ? 'vehiclebooking-input-placeholder-active' : ''}`}
                      value={row.type}
                      onChange={(event) =>
                        updateVehicleAllotmentRow(row.id, 'type', event.target.value)
                      }
                      aria-label="Vehicle type"
                    >
                      <option value="">Type</option>
                      {bookingOptions.vehicleRequirements.map((type) => (
                        <option value={type} key={type}>
                          {type}
                        </option>
                      ))}
                    </select>

                    <select
                      className={`vehiclebooking-input vehiclebooking-allotment-select-no ${row.vehicleNo === '' ? 'vehiclebooking-input-placeholder-active' : ''}`}
                      value={row.vehicleNo}
                      onChange={(event) =>
                        updateVehicleAllotmentRow(row.id, 'vehicleNo', event.target.value)
                      }
                      aria-label="Vehicle number"
                    >
                      <option value="">No.</option>
                      {bookingOptions.vehicleNumbers.map((vehicleNo) => (
                        <option value={vehicleNo} key={vehicleNo}>
                          {vehicleNo}
                        </option>
                      ))}
                    </select>

                    <input
                      className="vehiclebooking-input vehiclebooking-allotment-input-make"
                      value={row.make}
                      onChange={(event) =>
                        updateVehicleAllotmentRow(row.id, 'make', event.target.value)
                      }
                      placeholder="Make"
                      aria-label="Vehicle make"
                    />

                    <span className="vehiclebooking-allotment-label">Driver</span>

                    <select
                      className={`vehiclebooking-input vehiclebooking-allotment-select-driver ${row.driver === '' ? 'vehiclebooking-input-placeholder-active' : ''}`}
                      value={row.driver}
                      onChange={(event) =>
                        updateVehicleAllotmentRow(row.id, 'driver', event.target.value)
                      }
                      aria-label="Driver"
                    >
                      <option value=""></option>
                      {bookingOptions.drivers.map((driver) => (
                        <option value={driver} key={driver}>
                          {driver}
                        </option>
                      ))}
                    </select>

                    <input
                      className="vehiclebooking-input vehiclebooking-allotment-input-mobile"
                      type="tel"
                      value={row.mobile}
                      onChange={(event) =>
                        updateVehicleAllotmentRow(row.id, 'mobile', event.target.value)
                      }
                      placeholder="Mobile"
                      aria-label="Driver mobile"
                    />

                    {renderRowActions(
                      () =>
                        setVehicleAllotmentRows((prevRows) => [
                          ...prevRows,
                          createVehicleAllotmentRow(),
                        ]),
                      () => removeVehicleAllotmentRow(row.id),
                      vehicleAllotmentRows.length === 1,
                      'Add vehicle allotment row',
                      'Remove vehicle allotment row'
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
};

export default VehicleBooking;
