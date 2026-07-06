import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeAlert,
  CarFront,
  ClipboardCheck,
  Eye,
  MapPin,
  PencilLine,
  Plus,
  PlusCircle,
  Trash2,
  UsersRound,
  Wind,
  Cctv,
  Speaker,
  Armchair,
  Umbrella,
  Bluetooth,
  Usb,
  Box,
  Tv,
  BriefcaseMedical,
  Droplet,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './vehiclebooking.css';

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
  | 'Logistics Transport'
  | 'Others';
type ServiceType = 'Free' | 'Paid';
type TravelMode = 'Outside' | 'Shuttle';
type ShuttleBookingMode = 'Day Booking' | 'Trip Booking';
type ShuttleRequirement = 'Full Day' | 'FN Session' | 'AN Session' | 'Night';
type ManagedVehicleStatus = 'Active' | 'Service';
type DriverCategory = 'Car Driver' | 'Bus Driver';
type DriverStatus = 'Active' | 'Leave';

interface ApplicantDetails {
  employeeId: string;
  name: string;
  date: string;
  department: string;
  designation: string;
  email: string;
  mobile: string;
}

interface BeneficiaryDetails {
  beneficiaryType: 'Staff' | 'Faculty' | 'Institution' | '';
  staffName: string;
  tag: string;
}

const BENEFICIARY_TYPE_OPTIONS = ['Staff', 'Faculty', 'Institution'];
const BENEFICIARY_TAG_OPTIONS = ['Skilling', 'Research', 'Office', 'Events', 'Academics'];

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

interface ManagedVehicleRow {
  id: number;
  vehicleType: VehicleRequirement;
  number: string;
  make: string;
  seating: string;
  status: ManagedVehicleStatus;
  fuelType?: 'Petrol' | 'Diesel' | 'CNG' | 'Electric' | 'Hybrid';
  model?: string;
  transmission?: 'Manual' | 'Automatic';
  yearOfRegistration?: string;
  yearOfPurchase?: string;
  features?: Record<string, boolean>;
}

const DEFAULT_VEHICLE_FEATURES: Record<string, boolean> = {
  'Air Conditioner': false,
  'GPS Tracking': false,
  'CCTV Camera': false,
  'Audio System': false,
  'Push Back Seats': false,
  'Umbrella': false,
  'Bluetooth Audio': false,
  'USB Charging Ports': false,
  'Tissue Box': false,
  'Video System': false,
  'First Aid Kit': false,
  'Water Bottle': false,
};

interface DriverManagementRow {
  id: number;
  name: string;
  mobile: string;
  category: DriverCategory;
  status: DriverStatus;
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

const logisticsVehicleRequirements: VehicleRequirement[] = ['Mini Truck', 'Eicher', 'Lorry'];

const logisticsBookingForOptions: BookingFor[] = ['Logistics Transport', 'Others'];

const vehicleNumberOptions = ['TN 37 AB 1234', 'TN 38 CD 4567', 'TN 39 EF 7890'];
const driverOptions = ['Ravi Kumar', 'Suresh Mani', 'Arun Prakash'];

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

// --- Advanced manual "HH:MM AM/PM" auto-formatting (single text box) ---
// As the user types digits, the hour/minute segments and the ':' separator
// are inserted automatically; typing "A" or "P" auto-completes to "AM"/"PM".
const extractTimeDigitsAndPeriod = (value: string) => {
  const cleaned = value.toUpperCase().replace(/[^0-9AP]/g, '');
  const digits = cleaned.replace(/[AP]/g, '').slice(0, 4);
  const periodMatch = cleaned.match(/[AP]/);
  return { digits, periodLetter: periodMatch ? periodMatch[0] : '' };
};

const buildTimeSegments = (digits: string) => {
  let hour = '';
  let minute = '';
  let reachedMinute = false;

  for (const digit of digits) {
    if (!reachedMinute) {
      if (hour.length === 0) {
        hour = digit;
        if (digit !== '0' && digit !== '1') {
          reachedMinute = true;
        }
      } else {
        const combined = hour + digit;
        const combinedNum = Number(combined);
        if (combinedNum >= 1 && combinedNum <= 12) {
          hour = combined;
        } else {
          minute += digit;
        }
        reachedMinute = true;
      }
    } else if (minute.length < 2) {
      if (minute.length === 0) {
        if (digit <= '5') {
          minute = digit;
        }
      } else {
        const combined = minute + digit;
        if (Number(combined) <= 59) {
          minute = combined;
        }
      }
    }
  }

  return { hour, minute, reachedMinute };
};

const formatTimeAsYouType = (rawValue: string, previousDisplayValue: string) => {
  let working = rawValue;

  // If the user just deleted a single character and that character was an
  // auto-inserted separator (":" / " ") or the trailing "M" of AM/PM, remove
  // one more character so backspace feels natural instead of "sticking".
  if (
    working.length === previousDisplayValue.length - 1 &&
    previousDisplayValue.startsWith(working)
  ) {
    const removedChar = previousDisplayValue[working.length];
    if (removedChar === ':' || removedChar === ' ' || removedChar === 'M') {
      working = working.slice(0, -1);
    }
  }

  const { digits, periodLetter } = extractTimeDigitsAndPeriod(working);
  const { hour, minute, reachedMinute } = buildTimeSegments(digits);

  let result = hour;

  if (periodLetter && hour) {
    // AM/PM typed before the minute was fully entered — auto-complete the
    // minute instead of leaving a blank gap like "09: AM".
    const finalMinute = reachedMinute ? minute.padEnd(2, '0') : '00';
    result += `:${finalMinute}`;
    result += periodLetter === 'A' ? ' AM' : ' PM';
  } else if (reachedMinute) {
    result += `:${minute}`;
  }

  return result;
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

const createVehicleAllotmentRow = (): VehicleAllotmentRow => ({
  id: Date.now() + Math.random(),
  type: '',
  vehicleNo: '',
  make: '',
  driver: '',
  mobile: '',
});

const initialManagedVehicles: ManagedVehicleRow[] = [
  {
    id: 1,
    vehicleType: 'Car',
    number: 'TN 34 AM 1213',
    make: 'Toyota Innova',
    seating: '6+1',
    status: 'Active',
    fuelType: 'Petrol',
    model: 'Innova Crysta',
    transmission: 'Manual',
    yearOfRegistration: '2019',
    yearOfPurchase: '2019',
    features: {
      ...DEFAULT_VEHICLE_FEATURES,
      'Air Conditioner': true,
      'GPS Tracking': true,
      'Audio System': true,
      'Push Back Seats': true,
      'Bluetooth Audio': true,
      'USB Charging Ports': true,
      'First Aid Kit': true,
      'Water Bottle': true,
    },
  },
  {
    id: 2,
    vehicleType: 'Shuttle Vehicle',
    number: '-',
    make: 'ABCD',
    seating: '12+1',
    status: 'Service',
    fuelType: 'Diesel',
    model: 'Traveller',
    transmission: 'Manual',
    yearOfRegistration: '2021',
    yearOfPurchase: '2021',
    features: {
      ...DEFAULT_VEHICLE_FEATURES,
      'Air Conditioner': true,
      'GPS Tracking': true,
      'CCTV Camera': true,
      'Audio System': true,
      'USB Charging Ports': true,
      'Tissue Box': true,
      'Video System': true,
      'First Aid Kit': true,
      'Water Bottle': true,
    },
  },
];

const initialDrivers: DriverManagementRow[] = [
  { id: 1, name: 'Velavan C', mobile: '9876543210', category: 'Car Driver', status: 'Active' },
  { id: 2, name: 'Senthil Kumar R', mobile: '9876543210', category: 'Bus Driver', status: 'Leave' },
];

const createManagedVehicleRow = (): ManagedVehicleRow => ({
  id: Date.now() + Math.random(),
  vehicleType: 'Car',
  number: '',
  make: '',
  seating: '',
  status: 'Active',
  fuelType: 'Petrol',
  model: '',
  transmission: 'Manual',
  yearOfRegistration: '',
  yearOfPurchase: '',
  features: { ...DEFAULT_VEHICLE_FEATURES },
});

const createDriverManagementRow = (): DriverManagementRow => ({
  id: Date.now() + Math.random(),
  name: '',
  mobile: '',
  category: 'Car Driver',
  status: 'Active',
});

// applicantUiDetails is built inside the component from user context







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

  const applicantUiDetails: ApplicantDetails = useMemo(() => {
    const u = user as Record<string, unknown> | null | undefined;
    const read = (keys: string[]) =>
      keys.map((k) => u?.[k]).find((v) => v !== undefined && v !== null);
    return {
      employeeId: String(read(['employee_id', 'employeeId', 'erp_id', 'id']) || ''),
      name: String(read(['name', 'full_name', 'fullName']) || ''),
      date: formatDateInput(new Date()),
      department: String(read(['department', 'department_name', 'departmentName']) || ''),
      designation: String(read(['designation', 'role_name', 'roleName']) || ''),
      email: String(read(['email', 'mail']) || ''),
      mobile: String(read(['mobile', 'phone', 'phone_number', 'phoneNumber']) || ''),
    };
  }, [user]);
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
  const [beneficiaryDetails, setBeneficiaryDetails] = useState<BeneficiaryDetails>({
    beneficiaryType: 'Staff',
    staffName: '',
    tag: 'Skilling',
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
  const [vehicleAllotmentRows, setVehicleAllotmentRows] = useState<
    VehicleAllotmentRow[]
  >([createVehicleAllotmentRow()]);
  const [managedVehicles, setManagedVehicles] = useState<ManagedVehicleRow[]>(initialManagedVehicles);
  const [drivers, setDrivers] = useState<DriverManagementRow[]>(initialDrivers);
  const [editingManagedVehicleId, setEditingManagedVehicleId] = useState<number | null>(null);
  const [viewingManagedVehicleId, setViewingManagedVehicleId] = useState<number | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<number | null>(null);
  const [viewingDriverId, setViewingDriverId] = useState<number | null>(null);

  const [standaloneVehicleDetails, setStandaloneVehicleDetails] = useState<ManagedVehicleRow>(
    createManagedVehicleRow()
  );

  const updateStandaloneVehicleDetails = (
    field: keyof Omit<ManagedVehicleRow, 'id'>,
    value: any
  ) => {
    setStandaloneVehicleDetails((prevVehicle) => ({ ...prevVehicle, [field]: value }));
  };

  const [travelPlanBoardingDateInputs, setTravelPlanBoardingDateInputs] = useState<Record<number, string>>({});
  const [travelPlanDroppingDateInputs, setTravelPlanDroppingDateInputs] = useState<Record<number, string>>({});
  const [shuttleTripDateInputs, setShuttleTripDateInputs] = useState<Record<number, string>>({});
  const [shuttleDayDateInputs, setShuttleDayDateInputs] = useState<Record<number, string>>({});

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
      logisticsVehicleRequirements.includes(transportDetails.vehicleRequirement)
        ? logisticsBookingForOptions
        : bookingForOptions,
    [transportDetails.vehicleRequirement]
  );

  const updateTransportDetails = (
    field: keyof TransportBookingDetails,
    value: string
  ) => {
    setTransportDetails((prevDetails) => ({ ...prevDetails, [field]: value }));
  };

  const updateBeneficiaryDetails = (field: keyof BeneficiaryDetails, value: string) => {
    setBeneficiaryDetails((prevDetails) => ({ ...prevDetails, [field]: value }));
  };

  const handleVehicleRequirementSelect = (value: VehicleRequirement) => {
    setTransportDetails((prevDetails) => {
      const nextBookingOptions = logisticsVehicleRequirements.includes(value)
        ? logisticsBookingForOptions
        : bookingForOptions;

      return {
        ...prevDetails,
        vehicleRequirement: value,
        bookingFor: nextBookingOptions.includes(prevDetails.bookingFor)
          ? prevDetails.bookingFor
          : nextBookingOptions[0],
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

  const updateManagedVehicle = (
    id: number,
    field: keyof Omit<ManagedVehicleRow, 'id'>,
    value: any
  ) => {
    setManagedVehicles((prevVehicles) =>
      prevVehicles.map((vehicle) =>
        vehicle.id === id ? { ...vehicle, [field]: value } : vehicle
      )
    );
  };

  const addManagedVehicle = () => {
    const vehicle = createManagedVehicleRow();
    setManagedVehicles((prevVehicles) => [...prevVehicles, vehicle]);
    setEditingManagedVehicleId(vehicle.id);
    setViewingManagedVehicleId(vehicle.id);
  };

  const removeManagedVehicle = (id: number) => {
    setManagedVehicles((prevVehicles) =>
      prevVehicles.length === 1
        ? prevVehicles
        : prevVehicles.filter((vehicle) => vehicle.id !== id)
    );
    setEditingManagedVehicleId((currentId) => (currentId === id ? null : currentId));
    setViewingManagedVehicleId((currentId) => (currentId === id ? null : currentId));
  };

  const updateDriver = (
    id: number,
    field: keyof Omit<DriverManagementRow, 'id'>,
    value: string
  ) => {
    setDrivers((prevDrivers) =>
      prevDrivers.map((driver) =>
        driver.id === id ? { ...driver, [field]: value } : driver
      )
    );
  };

  const addDriver = () => {
    const driver = createDriverManagementRow();
    setDrivers((prevDrivers) => [...prevDrivers, driver]);
    setEditingDriverId(driver.id);
    setViewingDriverId(driver.id);
  };

  const removeDriver = (id: number) => {
    setDrivers((prevDrivers) =>
      prevDrivers.length === 1 ? prevDrivers : prevDrivers.filter((driver) => driver.id !== id)
    );
    setEditingDriverId((currentId) => (currentId === id ? null : currentId));
    setViewingDriverId((currentId) => (currentId === id ? null : currentId));
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

    if (import.meta.env.DEV) {
      console.log('Vehicle transport booking payload:', {
        applicant: applicantUiDetails,
        beneficiary: beneficiaryDetails,
        transportDetails,
        totalTravelers,
        travelPlanRows,
        shuttleBookingMode,
        shuttleTripRows,
        shuttleDayRows,
        vehicleAllotmentRows,
        standaloneVehicleDetails,
      });
    }
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

  const renderVehicleManagementActions = (
    onAdd: () => void,
    onEdit: () => void,
    onView: () => void,
    onDelete: () => void,
    deleteDisabled: boolean,
    isEditing: boolean,
    isViewing: boolean,
    label: string
  ) => (
    <div className="vehiclebooking-management-actions">
      <button
        className="vehiclebooking-management-icon-button vehiclebooking-management-icon-button--add"
        type="button"
        onClick={onAdd}
        aria-label={`Add ${label}`}
        title={`Add ${label}`}
      >
        <PlusCircle size={16} />
      </button>
      <button
        className={`vehiclebooking-management-icon-button${isEditing ? ' is-active' : ''}`}
        type="button"
        onClick={onEdit}
        aria-label={`${isEditing ? 'Finish editing' : 'Edit'} ${label}`}
        title={`${isEditing ? 'Finish editing' : 'Edit'} ${label}`}
      >
        <PencilLine size={15} />
      </button>
      <button
        className={`vehiclebooking-management-icon-button vehiclebooking-management-icon-button--view${isViewing ? ' is-active' : ''}`}
        type="button"
        onClick={onView}
        aria-label={`View ${label}`}
        title={`View ${label}`}
      >
        <Eye size={17} />
      </button>
      <button
        className="vehiclebooking-management-icon-button vehiclebooking-management-icon-button--delete"
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        title={`Delete ${label}`}
        disabled={deleteDisabled}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );

  const renderDriverManagementActions = (
    onAdd: () => void,
    onEdit: () => void,
    onDelete: () => void,
    deleteDisabled: boolean,
    isEditing: boolean,
    label: string
  ) => (
    <div className="vehiclebooking-management-actions vehiclebooking-management-actions--compact">
      <button
        className="vehiclebooking-management-icon-button vehiclebooking-management-icon-button--add"
        type="button"
        onClick={onAdd}
        aria-label={`Add ${label}`}
        title={`Add ${label}`}
      >
        <PlusCircle size={16} />
      </button>
      <button
        className={`vehiclebooking-management-icon-button${isEditing ? ' is-active' : ''}`}
        type="button"
        onClick={onEdit}
        aria-label={`${isEditing ? 'Finish editing' : 'Edit'} ${label}`}
        title={`${isEditing ? 'Finish editing' : 'Edit'} ${label}`}
      >
        <PencilLine size={15} />
      </button>
      <button
        className="vehiclebooking-management-icon-button vehiclebooking-management-icon-button--delete"
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        title={`Delete ${label}`}
        disabled={deleteDisabled}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );

  const renderVehicleDetailsCard = (
    vehicle: ManagedVehicleRow,
    isEditing: boolean,
    onUpdate: (field: keyof Omit<ManagedVehicleRow, 'id'>, value: any) => void
  ) => {
    const vehicleFeatures = vehicle.features || DEFAULT_VEHICLE_FEATURES;
    const currentFuelType = vehicle.fuelType || 'Petrol';
    const currentTransmission = vehicle.transmission || 'Manual';

    const handleFeatureToggle = (featureName: string) => {
      if (!isEditing) return;
      const updatedFeatures = {
        ...vehicleFeatures,
        [featureName]: !vehicleFeatures[featureName],
      };
      onUpdate('features', updatedFeatures);
    };

    const handleFuelTypeChange = (fuel: 'Petrol' | 'Diesel' | 'CNG' | 'Electric' | 'Hybrid') => {
      if (!isEditing) return;
      onUpdate('fuelType', fuel);
    };

    const handleTransmissionChange = (trans: 'Manual' | 'Automatic') => {
      if (!isEditing) return;
      onUpdate('transmission', trans);
    };

    const featureIcons: Record<string, React.ReactNode> = {
      'Air Conditioner': <Wind size={20} className="vehicle-feature-main-icon" />,
      'GPS Tracking': <MapPin size={20} className="vehicle-feature-main-icon" />,
      'CCTV Camera': <Cctv size={20} className="vehicle-feature-main-icon" />,
      'Audio System': <Speaker size={20} className="vehicle-feature-main-icon" />,
      'Push Back Seats': <Armchair size={20} className="vehicle-feature-main-icon" />,
      'Umbrella': <Umbrella size={20} className="vehicle-feature-main-icon" />,
      'Bluetooth Audio': <Bluetooth size={20} className="vehicle-feature-main-icon" />,
      'USB Charging Ports': <Usb size={20} className="vehicle-feature-main-icon" />,
      'Tissue Box': <Box size={20} className="vehicle-feature-main-icon" />,
      'Video System': <Tv size={20} className="vehicle-feature-main-icon" />,
      'First Aid Kit': <BriefcaseMedical size={20} className="vehicle-feature-main-icon" />,
      'Water Bottle': <Droplet size={20} className="vehicle-feature-main-icon" />,
    };

    return (
      <div className="vehicle-details-card-container">
        <section className="vehicle-details-main-card">
          <div className="vehicle-details-card-header-bar">
            <span>Vehicle Details</span>
          </div>
          
          <div className="vehicle-details-card-body-form">
            <div className="vehicle-details-form-panel">
            <div className="vehicle-details-grid-row vehicle-details-grid-row-3">
              {/* Type Dropdown */}
              <div className="vehicle-details-form-field">
                <label className="vehicle-details-form-label">Type</label>
                <select
                  className="vehicle-details-form-select"
                  value={vehicle.vehicleType}
                  onChange={(e) => onUpdate('vehicleType', e.target.value)}
                  disabled={!isEditing}
                >
                  {vehicleRequirements.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vehicle Number */}
              <div className="vehicle-details-form-field">
                <label className="vehicle-details-form-label">Vehicle Number</label>
                <input
                  type="text"
                  className="vehicle-details-form-input"
                  value={vehicle.number}
                  onChange={(e) => onUpdate('number', e.target.value)}
                  readOnly={!isEditing}
                  placeholder="e.g. TN 37 AB 1234"
                />
              </div>

              {/* Fuel Type Pills */}
              <div className="vehicle-details-form-field">
                <label className="vehicle-details-form-label">Fuel Type</label>
                <div className="vehicle-details-pills-row">
                  {(['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'] as const).map((fuel) => (
                    <button
                      key={fuel}
                      type="button"
                      className={`vehicle-details-pill-btn ${currentFuelType === fuel ? 'active' : ''}`}
                      onClick={() => handleFuelTypeChange(fuel)}
                      disabled={!isEditing}
                    >
                      {fuel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="vehicle-details-grid-row vehicle-details-grid-row-3">
              {/* Make */}
              <div className="vehicle-details-form-field">
                <label className="vehicle-details-form-label">Make</label>
                <input
                  type="text"
                  className="vehicle-details-form-input"
                  value={vehicle.make}
                  onChange={(e) => onUpdate('make', e.target.value)}
                  readOnly={!isEditing}
                  placeholder="e.g. Toyota"
                />
              </div>

              {/* Model */}
              <div className="vehicle-details-form-field">
                <label className="vehicle-details-form-label">Model</label>
                <input
                  type="text"
                  className="vehicle-details-form-input"
                  value={vehicle.model || ''}
                  onChange={(e) => onUpdate('model', e.target.value)}
                  readOnly={!isEditing}
                  placeholder="e.g. Innova"
                />
              </div>

              {/* Transmission Pills */}
              <div className="vehicle-details-form-field">
                <label className="vehicle-details-form-label">Transmission</label>
                <div className="vehicle-details-pills-row">
                  {(['Manual', 'Automatic'] as const).map((trans) => (
                    <button
                      key={trans}
                      type="button"
                      className={`vehicle-details-pill-btn ${currentTransmission === trans ? 'active' : ''}`}
                      onClick={() => handleTransmissionChange(trans)}
                      disabled={!isEditing}
                    >
                      {trans}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="vehicle-details-grid-row vehicle-details-grid-row-4">
              {/* Year of Registration */}
              <div className="vehicle-details-form-field">
                <label className="vehicle-details-form-label">Year of Registration</label>
                <input
                  type="text"
                  className="vehicle-details-form-input"
                  value={vehicle.yearOfRegistration || ''}
                  onChange={(e) => onUpdate('yearOfRegistration', e.target.value)}
                  readOnly={!isEditing}
                  placeholder="e.g. 2019"
                />
              </div>

              {/* Year of Purchase */}
              <div className="vehicle-details-form-field">
                <label className="vehicle-details-form-label">Year of Purchase</label>
                <input
                  type="text"
                  className="vehicle-details-form-input"
                  value={vehicle.yearOfPurchase || ''}
                  onChange={(e) => onUpdate('yearOfPurchase', e.target.value)}
                  readOnly={!isEditing}
                  placeholder="e.g. 2019"
                />
              </div>

              {/* Sealing (representing Seating) */}
              <div className="vehicle-details-form-field field-sealing">
                <label className="vehicle-details-form-label">Sealing</label>
                <input
                  type="text"
                  className="vehicle-details-form-input"
                  value={vehicle.seating}
                  onChange={(e) => onUpdate('seating', e.target.value)}
                  readOnly={!isEditing}
                  placeholder="e.g. 6+1"
                />
              </div>

              {/* Status */}
              <div className="vehicle-details-form-field field-status-row">
                <label className="vehicle-details-form-label">Status</label>
                <div className="status-input-validated-wrapper">
                  <select
                    className="vehicle-details-form-select"
                    value={vehicle.status}
                    onChange={(e) => onUpdate('status', e.target.value)}
                    disabled={!isEditing}
                  >
                    <option value="Active">Active</option>
                    <option value="Service">Service</option>
                  </select>
                  {vehicle.status === 'Active' && (
                    <CheckCircle2 className="vehicle-details-validated-checkmark" size={18} />
                  )}
                </div>
              </div>
            </div>
            </div>

            <div className="vehicle-features-panel">
              <div className="vehicle-features-section-title">Features</div>
              <hr className="vehicle-details-card-divider" />

              <div className="vehicle-features-grid">
                {Object.keys(DEFAULT_VEHICLE_FEATURES).map((featureName) => {
                  const isChecked = !!vehicleFeatures[featureName];
                  return (
                    <div
                      key={featureName}
                      className={`vehicle-feature-card ${isChecked ? 'checked' : ''} ${!isEditing ? 'disabled-view' : ''}`}
                      onClick={() => handleFeatureToggle(featureName)}
                    >
                      <div className="vehicle-feature-left-wrap">
                        <input
                          type="checkbox"
                          className="vehicle-feature-checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by click on the card
                          disabled={!isEditing}
                        />
                        <span className="vehicle-feature-icon-span">
                          {featureIcons[featureName]}
                        </span>
                        <span className="vehicle-feature-label-text">{featureName}</span>
                      </div>
                      <span className="vehicle-feature-info-icon-span">
                        <Info size={16} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  };

  const renderVehicleAdminManagement = () => (
    <section className="vehiclebooking-card vehiclebooking-management-card">
      <div className="vehiclebooking-management-panel">
        <div className="vehiclebooking-management-title">Vehicle Management</div>
        <div className="vehiclebooking-management-table-wrap">
          <table className="vehiclebooking-management-table vehiclebooking-vehicle-management-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Vehicle Type</th>
                <th>Number</th>
                <th>Make</th>
                <th>Seating</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {managedVehicles.map((vehicle, index) => {
                const isEditing = editingManagedVehicleId === vehicle.id;
                const isViewing = viewingManagedVehicleId === vehicle.id;

                return (
                  <tr className={isViewing ? 'is-viewing' : ''} key={vehicle.id}>
                    <td>{index + 1}</td>
                    <td>
                      <select
                        className="vehiclebooking-management-control"
                        value={vehicle.vehicleType}
                        onChange={(event) =>
                          updateManagedVehicle(vehicle.id, 'vehicleType', event.target.value)
                        }
                        disabled={!isEditing}
                        aria-label="Vehicle type"
                      >
                        {vehicleRequirements.map((type) => (
                          <option value={type} key={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="vehiclebooking-management-control"
                        type="text"
                        value={vehicle.number}
                        onChange={(event) =>
                          updateManagedVehicle(vehicle.id, 'number', event.target.value)
                        }
                        readOnly={!isEditing}
                        aria-label="Vehicle number"
                      />
                    </td>
                    <td>
                      <input
                        className="vehiclebooking-management-control"
                        type="text"
                        value={vehicle.make}
                        onChange={(event) =>
                          updateManagedVehicle(vehicle.id, 'make', event.target.value)
                        }
                        readOnly={!isEditing}
                        aria-label="Vehicle make"
                      />
                    </td>
                    <td>
                      <input
                        className="vehiclebooking-management-control"
                        type="text"
                        value={vehicle.seating}
                        onChange={(event) =>
                          updateManagedVehicle(vehicle.id, 'seating', event.target.value)
                        }
                        readOnly={!isEditing}
                        aria-label="Vehicle seating"
                      />
                    </td>
                    <td>
                      <select
                        className={`vehiclebooking-management-status vehiclebooking-management-status--${vehicle.status.toLowerCase()}`}
                        value={vehicle.status}
                        onChange={(event) =>
                          updateManagedVehicle(vehicle.id, 'status', event.target.value)
                        }
                        disabled={!isEditing}
                        aria-label="Vehicle status"
                      >
                        <option value="Active">Active</option>
                        <option value="Service">Service</option>
                      </select>
                    </td>
                    <td>
                      {renderVehicleManagementActions(
                        addManagedVehicle,
                        () =>
                          setEditingManagedVehicleId((currentId) =>
                            currentId === vehicle.id ? null : vehicle.id,
                          ),
                        () =>
                          setViewingManagedVehicleId((currentId) =>
                            currentId === vehicle.id ? null : vehicle.id,
                          ),
                        () => removeManagedVehicle(vehicle.id),
                        managedVehicles.length === 1,
                        isEditing,
                        isViewing,
                        'vehicle'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="vehiclebooking-management-title vehiclebooking-management-title--spaced">
          Driver Management
        </div>
        <div className="vehiclebooking-management-table-wrap vehiclebooking-driver-management-wrap">
          <table className="vehiclebooking-management-table vehiclebooking-driver-management-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Driver Name</th>
                <th>Mobile Number</th>
                <th>Category</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver, index) => {
                const isEditing = editingDriverId === driver.id;
                const isViewing = viewingDriverId === driver.id;

                return (
                  <tr className={isViewing ? 'is-viewing' : ''} key={driver.id}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        className="vehiclebooking-management-control"
                        type="text"
                        value={driver.name}
                        onChange={(event) => updateDriver(driver.id, 'name', event.target.value)}
                        readOnly={!isEditing}
                        aria-label="Driver name"
                      />
                    </td>
                    <td>
                      <input
                        className="vehiclebooking-management-control"
                        type="tel"
                        value={driver.mobile}
                        onChange={(event) => updateDriver(driver.id, 'mobile', event.target.value)}
                        readOnly={!isEditing}
                        aria-label="Driver mobile number"
                      />
                    </td>
                    <td>
                      <select
                        className="vehiclebooking-management-control"
                        value={driver.category}
                        onChange={(event) => updateDriver(driver.id, 'category', event.target.value)}
                        disabled={!isEditing}
                        aria-label="Driver category"
                      >
                        <option value="Car Driver">Car Driver</option>
                        <option value="Bus Driver">Bus Driver</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className={`vehiclebooking-management-status vehiclebooking-management-status--${driver.status.toLowerCase()}`}
                        value={driver.status}
                        onChange={(event) => updateDriver(driver.id, 'status', event.target.value)}
                        disabled={!isEditing}
                        aria-label="Driver status"
                      >
                        <option value="Active">Active</option>
                        <option value="Leave">Leave</option>
                      </select>
                    </td>
                    <td>
                      {renderDriverManagementActions(
                        addDriver,
                        () =>
                          setEditingDriverId((currentId) =>
                            currentId === driver.id ? null : driver.id,
                          ),
                        () => removeDriver(driver.id),
                        drivers.length === 1,
                        isEditing,
                        'driver'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
  const priorityStatus = transportDetails.priority || 'Routine';
  const priorityTone = priorityStatus === 'High' ? 'high' : 'routine';

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

          <section className="vehiclebooking-card vehiclebooking-beneficiary-card">
            <div className="vehiclebooking-beneficiary-grid">
              <div className="vehiclebooking-beneficiary-field vehiclebooking-beneficiary-field--type">
                <label className="vehiclebooking-beneficiary-label">Beneficiary</label>
                <select
                  className="vehiclebooking-beneficiary-control vehiclebooking-beneficiary-select"
                  value={beneficiaryDetails.beneficiaryType}
                  onChange={(event) =>
                    updateBeneficiaryDetails('beneficiaryType', event.target.value)
                  }
                >
                  {BENEFICIARY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vehiclebooking-beneficiary-field vehiclebooking-beneficiary-field--name">
                <label className="vehiclebooking-beneficiary-label">
                  {beneficiaryDetails.beneficiaryType === 'Faculty' ? 'Faculty Name' : 'Staff Name'}
                </label>
                <input
                  className="vehiclebooking-beneficiary-control"
                  value={beneficiaryDetails.staffName}
                  onChange={(event) => updateBeneficiaryDetails('staffName', event.target.value)}
                  placeholder={
                    beneficiaryDetails.beneficiaryType === 'Faculty'
                      ? 'Search faculty by name or ERP ID'
                      : 'Search staff by name or ERP ID'
                  }
                />
              </div>

              <div className="vehiclebooking-beneficiary-field vehiclebooking-beneficiary-field--tag">
                <label className="vehiclebooking-beneficiary-label">Tag</label>
                <select
                  className="vehiclebooking-beneficiary-control vehiclebooking-beneficiary-select"
                  value={beneficiaryDetails.tag}
                  onChange={(event) => updateBeneficiaryDetails('tag', event.target.value)}
                >
                  {BENEFICIARY_TAG_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
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

                <div className="vehiclebooking-section-wrapper">
                  <hr className="vehiclebooking-divider" />
                  <div className="vehiclebooking-subsection-title vehiclebooking-subsection-title--above">Vehicle Requirement</div>
                  <div className="vehiclebooking-layout-row vehiclebooking-layout-row--vehicle vehiclebooking-row-container">
                    <div className="vehiclebooking-option-panel">
                      <div className="vehiclebooking-radio-group vehiclebooking-option-strip">
                        {vehicleRequirements.map((vehicleRequirement) =>
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
                      <th>Dropping Point</th>
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
                            className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--time"
                            type="text"
                            placeholder="HH:MM AM/PM"
                            inputMode="text"
                            autoCapitalize="characters"
                            maxLength={9}
                            pattern="^(0?[1-9]|1[0-2]):[0-5][0-9] ?(AM|PM|am|pm)$"
                            title="Enter time as HH:MM AM or HH:MM PM"
                            value={row.boardingTime}
                            onChange={(event) =>
                              updateTravelPlanRow(
                                row.id,
                                'boardingTime',
                                formatTimeAsYouType(event.target.value, row.boardingTime)
                              )
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
                            className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--time"
                            type="text"
                            placeholder="HH:MM AM/PM"
                            inputMode="text"
                            autoCapitalize="characters"
                            maxLength={9}
                            pattern="^(0?[1-9]|1[0-2]):[0-5][0-9] ?(AM|PM|am|pm)$"
                            title="Enter time as HH:MM AM or HH:MM PM"
                            value={row.droppingTime}
                            onChange={(event) =>
                              updateTravelPlanRow(
                                row.id,
                                'droppingTime',
                                formatTimeAsYouType(event.target.value, row.droppingTime)
                              )
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
                            aria-label="Dropping point"
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
                            className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--time"
                            type="text"
                            placeholder="HH:MM AM/PM"
                            inputMode="text"
                            autoCapitalize="characters"
                            maxLength={9}
                            pattern="^(0?[1-9]|1[0-2]):[0-5][0-9] ?(AM|PM|am|pm)$"
                            title="Enter time as HH:MM AM or HH:MM PM"
                            value={row.time}
                            onChange={(event) =>
                              updateShuttleTripRow(
                                row.id,
                                'time',
                                formatTimeAsYouType(event.target.value, row.time)
                              )
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
                            <option value="Academic">Academic</option>
                            <option value="Official">Official</option>
                            <option value="Guest Pickup">Guest Pickup</option>
                            <option value="Logistics">Logistics</option>
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
                      <UsersRound size={16} />
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
                        <th>Dropping Point</th>
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
                              className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--time"
                              type="text"
                              placeholder="HH:MM AM/PM"
                              inputMode="text"
                              autoCapitalize="characters"
                              maxLength={9}
                              pattern="^(0?[1-9]|1[0-2]):[0-5][0-9] ?(AM|PM|am|pm)$"
                              title="Enter time as HH:MM AM or HH:MM PM"
                              value={row.boardingTime}
                              onChange={(event) =>
                                updateTravelPlanRow(
                                  row.id,
                                  'boardingTime',
                                  formatTimeAsYouType(event.target.value, row.boardingTime)
                                )
                              }
                              onBlur={(event) =>
                                updateTravelPlanRow(
                                  row.id,
                                  'boardingTime',
                                  normalizeTimeEntry(event.target.value)
                                )
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
                              className="vehiclebooking-input vehiclebooking-table-input vehiclebooking-table-input--time"
                              type="text"
                              placeholder="HH:MM AM/PM"
                              inputMode="text"
                              autoCapitalize="characters"
                              maxLength={9}
                              pattern="^(0?[1-9]|1[0-2]):[0-5][0-9] ?(AM|PM|am|pm)$"
                              title="Enter time as HH:MM AM or HH:MM PM"
                              value={row.droppingTime}
                              onChange={(event) =>
                                updateTravelPlanRow(
                                  row.id,
                                  'droppingTime',
                                  formatTimeAsYouType(event.target.value, row.droppingTime)
                                )
                              }
                              onBlur={(event) =>
                                updateTravelPlanRow(
                                  row.id,
                                  'droppingTime',
                                  normalizeTimeEntry(event.target.value)
                                )
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
                              aria-label="Allotment dropping point"
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
                      {vehicleRequirements.map((type) => (
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
                      {vehicleNumberOptions.map((vehicleNo) => (
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
                      {driverOptions.map((driver) => (
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

          <section className="vehiclebooking-card vehiclebooking-vehicle-details-standalone">
            {renderVehicleDetailsCard(
              standaloneVehicleDetails,
              true,
              updateStandaloneVehicleDetails
            )}
          </section>
          {renderVehicleAdminManagement()}

          <div className="vehiclebooking-submit-actions">
            <button
              type="submit"
              className="vehiclebooking-submit-btn"
            >
              Submit Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleBooking;