import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AirVent,
  Armchair,
  Bath,
  Bed,
  BedDouble,
  Calendar,
  Cable,
  CircleCheck,
  ChevronDown,
  ChevronUp,
  Droplets,
  Eye,
  Fan,
  House,
  HousePlug,
  Info,
  Lamp,
  Lightbulb,
  Moon,
  PencilLine,
  PlusCircle,
  PlugZap,
  ShowerHead,
  Sofa,
  Table,
  Trash2,
  Tv,
  UsersRound,
  Utensils,
  WashingMachine,
  Wifi,
} from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, isSuperAdmin } from '../../shared/utils/permissionUtils';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import './guesthousebooking.css';

type Gender = 'Male' | 'Female' | 'Others' | '';
type GuestPriority = 'Routine' | 'High' | '';
type RoomType = 'Single' | 'Double' | 'Deluxe';
type GuestAmenityKey =
  | 'roomCleaning'
  | 'welcomeKit'
  | 'waterBottle'
  | 'towel'
  | 'blanket'
  | 'remoteBattery';

interface ApplicantDetails {
  employeeId: string;
  departmentId: string;
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
  email: string;
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
  remarks: string;
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

interface BeneficiaryDetails {
  beneficiaryType: string;
  staffName: string;
  departmentId: string;
  tag: string;
}

interface BeneficiaryEmployeeOption {
  employee_id?: number | string;
  name?: string;
  department?: string;
  department_id?: number | string;
  departmentId?: number | string;
}

interface BeneficiaryEntityOption {
  id: string;
  name: string;
}

type BeneficiaryEntityOptions = Record<string, BeneficiaryEntityOption[]>;

const BENEFICIARY_TYPE_OPTIONS = [
  'Faculty',
  'Staff',
  'Department',
  'Centre',
  'Cell',
  'Club',
  'Section',
  'Professional Body',
];
const BENEFICIARY_TAG_OPTIONS = [
  'Laboratory',
  'Association',
  'Skilling',
  'Research',
  'Outreach',
  'Office',
  'Academics',
  'Essentials',
  'Events',
  'Innovation',
  'Start-up',
  'Entrepreneurship',
  'CoE Claims',
];

interface RoomAllotmentRow {
  id: string;
  roomType: RoomType;
  block: string;
  roomNumber: string;
  occupants: string;
  remarks: string;
}

interface RoomAllotmentData {
  guestId: string;
  rows: RoomAllotmentRow[];
  amenities: Record<GuestAmenityKey, boolean>;
  spoc: string;
  mobile: string;
}

interface RoomBlockOption {
  block: string;
  roomNumbers: string[];
}

type ApiRecord = Record<string, unknown>;
type RoomAllotmentsByGuest = Record<string, RoomAllotmentData>;
type ActiveRoomDetail = { guestId: string; rowId: string } | null;
type RoomDetailOption = { label: string; Icon: React.ElementType };
type RoomDetailGroup = { title: string; items: RoomDetailOption[] };
type RoomRequirementField = 'roomSingle' | 'roomDouble' | 'roomDeluxe';
type TravelTimeField = 'checkInTime' | 'checkOutTime';
type ManagedRoomStatus = 'Active' | 'Maintenance';
type CareTakerStatus = 'Active' | 'Leave';

type GuestField = Exclude<keyof GuestDetails, 'id'>;
type FoodField = Exclude<keyof FoodRequirementRow, 'id'>;
type TravelDateField = 'checkInDate' | 'checkOutDate';

interface ManagedRoomRow {
  id: number;
  roomType: RoomType;
  block: string;
  floor: string;
  roomNumber: string;
  status: ManagedRoomStatus;
}

interface CareTakerRow {
  id: number;
  name: string;
  mobile: string;
  status: CareTakerStatus;
}

const MAX_ROOM_COUNT = 50;
const numberOnly = (value: string) => Math.min(MAX_ROOM_COUNT, Math.max(0, Number(value) || 0));

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

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
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

const normalizeTravelTimeEntry = (value: string) => {
  const trimmedValue = value.trim().toUpperCase().replace(/\s+/g, ' ');

  if (!trimmedValue) {
    return '';
  }

  const compactValue = trimmedValue.replace(/[:.\s]+/g, '');
  const compactMatch = compactValue.match(/^(\d{1,2})([0-5]\d)?(AM|PM)$/i);

  if (!compactMatch) {
    return trimmedValue;
  }

  const [, hourValue, minuteValue = '00', periodValue] = compactMatch;
  const hour = Number(hourValue);

  if (hour < 1 || hour > 12) {
    return trimmedValue;
  }

  return `${String(hour).padStart(2, '0')}:${minuteValue} ${periodValue.toUpperCase()}`;
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

const parseTimeToMinutes = (value: string) => {
  const match = normalizeTravelTimeEntry(value).match(/^(\d{1,2})[:.]([0-5]\d)\s*(AM|PM)?$/i);

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

const createGuest = (
  id = Number.parseInt(crypto.randomUUID().replace(/\D/g, '').slice(0, 12) || '0', 10),
): GuestDetails => ({
  id,
  name: '',
  gender: '',
  priority: 'Routine',
  designation: '',
  email: '',
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
  remarks: '',
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

// Room management is preview-only until persisted room-options APIs are available.
const initialManagedRooms: ManagedRoomRow[] = [];

const initialCareTakers: CareTakerRow[] = [];

const createManagedRoomRow = (): ManagedRoomRow => ({
  id: Date.now() + Math.random(),
  roomType: 'Single',
  block: '',
  floor: '',
  roomNumber: '',
  status: 'Active',
});

const createCareTakerRow = (): CareTakerRow => ({
  id: Date.now() + Math.random(),
  name: '',
  mobile: '',
  status: 'Active',
});


const ROOM_REQUIREMENT_CONFIG: Array<{
  field: RoomRequirementField;
  roomType: RoomType;
  occupants: string;
}> = [
  { field: 'roomSingle', roomType: 'Single', occupants: '1' },
  { field: 'roomDouble', roomType: 'Double', occupants: '2' },
  { field: 'roomDeluxe', roomType: 'Deluxe', occupants: '2' },
];


const GUEST_AMENITY_OPTIONS: Array<{ key: GuestAmenityKey; label: string }> = [
  { key: 'roomCleaning', label: 'Room Cleaning' },
  { key: 'welcomeKit', label: 'Welcome Kit' },
  { key: 'waterBottle', label: 'Water Bottle' },
  { key: 'towel', label: 'Towel' },
  { key: 'blanket', label: 'Blanket' },
  { key: 'remoteBattery', label: 'Remote Battery' },
];

const ROOM_DETAIL_AMENITY_GROUPS: RoomDetailGroup[] = [
  {
    title: 'Comfort',
    items: [
      { label: 'Air Conditioner', Icon: AirVent },
      { label: 'Television', Icon: Tv },
      { label: 'Attached Washroom', Icon: ShowerHead },
      { label: 'Wash Basin', Icon: Bath },
      { label: 'Water Heater', Icon: Droplets },
    ],
  },
  {
    title: 'Connectivity',
    items: [
      { label: 'LAN', Icon: Cable },
      { label: 'Wi-fi', Icon: Wifi },
      { label: 'Intercom', Icon: HousePlug },
      { label: 'Charging Ports', Icon: PlugZap },
    ],
  },
  {
    title: 'Furniture',
    items: [
      { label: 'Bed', Icon: Bed },
      { label: 'Sofa', Icon: Sofa },
      { label: 'Study Table', Icon: Table },
      { label: 'Wardrobe', Icon: BedDouble },
      { label: 'Chairs', Icon: Armchair },
    ],
  },
];

const ROOM_DETAIL_ESSENTIALS: RoomDetailOption[] = [
  { label: 'Fan', Icon: Fan },
  { label: 'Lights', Icon: Lightbulb },
  { label: 'Night Lamp', Icon: Moon },
  { label: 'Table Lamp', Icon: Lamp },
  { label: 'Bedsheet', Icon: Bed },
  { label: 'Pillows', Icon: BedDouble },
  { label: 'Bucket & Mug', Icon: Bath },
  { label: 'Face Mirror', Icon: Info },
  { label: 'Floor Mat', Icon: Table },
  { label: 'Window Screen', Icon: Table },
  { label: 'Musquito Net', Icon: Cable },
  { label: 'Shoe Rack', Icon: Table },
];

const ROOM_DETAIL_SERVICES: RoomDetailOption[] = [
  { label: 'Laundry', Icon: WashingMachine },
  { label: 'Additional Bed', Icon: BedDouble },
];

const createGuestAmenities = (
  previous?: Partial<Record<GuestAmenityKey, boolean>>,
): Record<GuestAmenityKey, boolean> =>
  GUEST_AMENITY_OPTIONS.reduce(
    (amenities, option) => ({
      ...amenities,
      [option.key]: Boolean(previous?.[option.key]),
    }),
    {} as Record<GuestAmenityKey, boolean>,
  );

const createRoomAllotmentRow = (roomType: RoomType, occupants = '1'): RoomAllotmentRow => ({
  id: `${roomType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  roomType,
  block: '',
  roomNumber: '',
  occupants,
  remarks: '',
});

const buildRoomAllotmentRows = (
  guest: GuestDetails,
  previousRows: RoomAllotmentRow[] = [],
): RoomAllotmentRow[] => {
  const previousRowsByType = previousRows.reduce<Record<RoomType, RoomAllotmentRow[]>>(
    (acc, row) => {
      acc[row.roomType] = [...acc[row.roomType], row];
      return acc;
    },
    { Single: [], Double: [], Deluxe: [] },
  );

  return ROOM_REQUIREMENT_CONFIG.flatMap(({ field, roomType, occupants }) =>
    Array.from({ length: numberOnly(guest[field]) }, (_, index) => {
      const previousRow = previousRowsByType[roomType][index];
      return previousRow
        ? { ...previousRow, roomType, occupants: previousRow.occupants || occupants }
        : createRoomAllotmentRow(roomType, occupants);
    }),
  );
};

const createRoomAllotmentData = (
  guestId: string,
  guest: GuestDetails,
  previous?: RoomAllotmentData,
): RoomAllotmentData => ({
  guestId,
  rows: buildRoomAllotmentRows(guest, previous?.rows || []),
  amenities: createGuestAmenities(previous?.amenities),
  spoc: previous?.spoc || '',
  mobile: previous?.mobile || '',
});

const getTextValue = (source: ApiRecord, keys: string[]) => {
  const value = keys.map((key) => source[key]).find((item) => item !== undefined && item !== null);
  return String(value || '').trim();
};

const getPayloadData = (payload: unknown) => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
    return (payload as ApiRecord).data as unknown;
  }

  return payload;
};

const normalizeTextOptions = (payload: unknown, keys: string[]) => {
  const source = getPayloadData(payload);
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

const buildApplicantDetails = (
  user: ApiRecord | null | undefined,
  profile: ApiRecord | null,
): ApplicantDetails => {
  const sources = [profile, user].filter(Boolean) as ApiRecord[];
  const read = (keys: string[]) =>
    sources.reduce((value, source) => value || getTextValue(source, keys), '');

  return {
    employeeId: read(['employee_id', 'employeeId', 'erp_id', 'erpId', 'id']),
    departmentId: read(['department_id', 'departmentId']),
    name: read(['name', 'full_name', 'fullName']),
    date: read(['request_date', 'requestDate', 'date']) || todayInputValue(),
    department: read(['department', 'department_name', 'departmentName']),
    designation: read(['designation', 'role_name', 'roleName']),
    email: read(['email', 'mail']),
    mobile: read(['mobile', 'phone', 'phone_number', 'phoneNumber', 'contact']),
  };
};

const addRoomOption = (map: Map<string, Set<string>>, block: string, roomNumber = '') => {
  if (!block) {
    return;
  }

  if (!map.has(block)) {
    map.set(block, new Set<string>());
  }

  if (roomNumber) {
    map.get(block)?.add(roomNumber);
  }
};

const readRoomNumbers = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((room) => {
      if (typeof room === 'object' && room !== null) {
        return getTextValue(room as Record<string, unknown>, [
          'roomNumber',
          'room_number',
          'room_no',
          'number',
          'name',
        ]);
      }

      return String(room || '').trim();
    })
    .filter(Boolean);
};

const normalizeRoomBlockOptions = (payload: unknown): RoomBlockOption[] => {
  const source = getPayloadData(payload);

  const items = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? (source as Record<string, unknown>).blocks || (source as Record<string, unknown>).rooms || []
      : [];

  if (!Array.isArray(items)) {
    return [];
  }

  const blockMap = new Map<string, Set<string>>();

  items.forEach((item) => {
    if (typeof item !== 'object' || item === null) {
      return;
    }

    const option = item as Record<string, unknown>;
    const block = getTextValue(option, ['block', 'blockName', 'block_name', 'name']);
    const roomNumber = getTextValue(option, [
      'roomNumber',
      'room_number',
      'room_no',
      'number',
    ]);
    const nestedRooms = readRoomNumbers(option.roomNumbers || option.rooms || option.room_numbers);

    if (nestedRooms.length) {
      nestedRooms.forEach((room) => addRoomOption(blockMap, block, room));
      return;
    }

    addRoomOption(blockMap, block, roomNumber);
  });

  return Array.from(blockMap.entries()).map(([block, rooms]) => ({
    block,
    roomNumbers: Array.from(rooms),
  }));
};

const getGuestAllotmentCounts = (guest: GuestDetails) => ({
  male: numberOnly(guest.accompaniedMale) + (guest.gender === 'Male' ? 1 : 0),
  female: numberOnly(guest.accompaniedFemale) + (guest.gender === 'Female' ? 1 : 0),
  children: numberOnly(guest.accompaniedChildren),
});

const MaleAllotmentIcon = () => (
  <svg
    className="guesthousebooking-allotment-person-icon"
    viewBox="0 0 72 72"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="36" cy="16" r="13" />
    <path d="M15 64v-7.5C15 43.8 24.4 34 36 34s21 9.8 21 22.5V64H15z" />
    <path
      className="guesthousebooking-allotment-person-icon-detail"
      d="M29.5 36.5 36 45l6.5-8.5 2.2 27.5H27.3l2.2-27.5z"
    />
    <path
      className="guesthousebooking-allotment-person-icon-detail"
      d="M27.2 36.8 36 47.2l8.8-10.4-3.8 4.1L36 38.2l-5 2.7-3.8-4.1z"
    />
  </svg>
);

const FemaleAllotmentIcon = () => (
  <svg
    className="guesthousebooking-allotment-person-icon"
    viewBox="0 0 72 72"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M16 64v-4.6C16 50 24.6 42.8 36 42.8S56 50 56 59.4V64H16z" />
    <path d="M17.8 43.5V31.2C17.8 17.1 25.4 7 36 7s18.2 10.1 18.2 24.2v12.3H17.8z" />
    <path
      className="guesthousebooking-allotment-person-icon-detail"
      d="M23.8 30.5c5.9-.9 10.3-4.4 13.3-10.2 2.7 5.2 6.5 8.7 11.1 10.2v4.7C48.2 43.3 42.7 50 36 50s-12.2-6.7-12.2-14.8v-4.7z"
    />
    <path d="M25 45.7 36 57l11-11.3c7.4 3 12 9.2 12 17.4V64H13v-.9c0-8.2 4.6-14.4 12-17.4z" />
  </svg>
);

const ChildAllotmentIcon = () => (
  <svg
    className="guesthousebooking-allotment-person-icon"
    viewBox="0 0 72 72"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="36" cy="14" r="10" />
    <path d="M21 31.5c0-3 2.4-5.5 5.5-5.5h19c3.1 0 5.5 2.5 5.5 5.5V47h-7v17H28V47h-7V31.5z" />
  </svg>
);
const emptyTravelDetails: TravelDetails = {
  checkInDate: '',
  checkInTime: '',
  checkOutDate: '',
  checkOutTime: '',
};

const GuestHouseBooking: React.FC = () => {
  const isRoomAllotmentVisible = import.meta.env.VITE_GUESTHOUSE_ROOM_ALLOTMENT === 'true';
  const { user } = useAuth();
  const canManageGuesthouse = Boolean(
    user && (isSuperAdmin(user) || user.is_admin || hasPermission(user, 'guesthouse.manage')),
  );
  const canOverrideApplicant = canManageGuesthouse;
  const location = useLocation();
  const navigate = useNavigate();
  const { id: bookingIdParam } = useParams<{ id?: string }>();
  const bookingId = Number.parseInt(bookingIdParam || '', 10);
  const hasBookingId = Number.isInteger(bookingId) && bookingId > 0;
  const isEditMode = hasBookingId && location.pathname.endsWith('/edit');
  const isViewingBooking = hasBookingId && !isEditMode;
  const [applicantProfile, setApplicantProfile] = useState<ApiRecord | null>(null);
  const [applicantSearch, setApplicantSearch] = useState('');
  const [applicantResults, setApplicantResults] = useState<ApiRecord[]>([]);
  const [isApplicantCardOpen, setIsApplicantCardOpen] = useState(true);
  const [submitMessage, setSubmitMessage] = useState('');
  const [guests, setGuests] = useState<GuestDetails[]>([createGuest(1)]);
  const [travelDetails, setTravelDetails] = useState<TravelDetails>(emptyTravelDetails);
  const [travelDateInputs, setTravelDateInputs] = useState<Record<TravelDateField, string>>({
    checkInDate: '',
    checkOutDate: '',
  });
  const [foodRows, setFoodRows] = useState<FoodRequirementRow[]>([createFoodRow()]);
  const [foodDateInputs, setFoodDateInputs] = useState<Record<number, string>>({});
  const [beneficiaryDetails, setBeneficiaryDetails] = useState<BeneficiaryDetails>({
    beneficiaryType: 'Staff',
    staffName: '',
    departmentId: '',
    tag: 'Skilling',
  });
  const [beneficiaryEntityOptions, setBeneficiaryEntityOptions] =
    useState<BeneficiaryEntityOptions>({});
  const [beneficiaryEmployeeOptions, setBeneficiaryEmployeeOptions] =
    useState<BeneficiaryEmployeeOption[]>([]);
  const [beneficiarySearchOpen, setBeneficiarySearchOpen] = useState(false);
  const [roomBlockOptions, setRoomBlockOptions] = useState<RoomBlockOption[]>([]);
  const [spocOptions, setSpocOptions] = useState<string[]>([]);
  const [roomAllotments, setRoomAllotments] = useState<RoomAllotmentsByGuest>({});
  const [activeRoomDetail, setActiveRoomDetail] = useState<ActiveRoomDetail>(null);
  const [managedRooms, setManagedRooms] = useState<ManagedRoomRow[]>(initialManagedRooms);
  const [careTakers, setCareTakers] = useState<CareTakerRow[]>(initialCareTakers);
  const [editingManagedRoomId, setEditingManagedRoomId] = useState<number | null>(null);
  const [viewingManagedRoomId, setViewingManagedRoomId] = useState<number | null>(null);
  const [editingCareTakerId, setEditingCareTakerId] = useState<number | null>(null);

  const applicantUiDetails = useMemo(
    () => buildApplicantDetails(user as unknown as ApiRecord | null, applicantProfile),
    [applicantProfile, user],
  );

  useEffect(() => {
    const query = applicantSearch.trim();
    if (query.length < 2 || query === applicantUiDetails.name.trim()) {
      setApplicantResults([]);
      return;
    }

    let cancelled = false;
    const searchApplicants = async () => {
      try {
        const response = (await authenticityUtility.get(
          `/budget/search-applicant?q=${encodeURIComponent(query)}`,
        )) as any;
        if (!cancelled) setApplicantResults(Array.isArray(response?.data) ? response.data : []);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to search guesthouse applicant:', error);
          setApplicantResults([]);
        }
      }
    };

    const timeoutId = window.setTimeout(() => void searchApplicants(), 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [applicantSearch, applicantUiDetails.name]);

  useEffect(() => {
    setTravelDateInputs({
      checkInDate: formatDateForDisplay(travelDetails.checkInDate),
      checkOutDate: formatDateForDisplay(travelDetails.checkOutDate),
    });
  }, [travelDetails.checkInDate, travelDetails.checkOutDate]);

  useEffect(() => {
    if (isViewingBooking) {
      return;
    }

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
          console.info('Guesthouse applicant profile could not be loaded.', error);
        }
      }
    };

    loadApplicantProfile();

    return () => {
      isMounted = false;
    };
  }, [isViewingBooking]);

  useEffect(() => {
    if (!isViewingBooking) {
      return;
    }

    let isMounted = true;

    const toInputDate = (value: unknown) => {
      const text = String(value || '').trim();
      return text ? text.slice(0, 10) : '';
    };
    const toText = (value: unknown) => (value === null || value === undefined ? '' : String(value));

    const loadBooking = async () => {
      try {
        const response = await authenticityUtility.get(`/guesthouse/${bookingId}`);
        const booking = getPayloadData(response) as ApiRecord | null;
        if (!isMounted || !booking || typeof booking !== 'object') {
          return;
        }

        setApplicantProfile({
          employee_id: booking.employee_id,
          name: booking.applicant_name,
          request_date: toInputDate(booking.request_date),
          department: booking.department,
          designation: booking.designation,
          email: booking.email,
          mobile: booking.mobile,
        });
        setBeneficiaryDetails({
          beneficiaryType: toText(booking.beneficiary_type),
          staffName: toText(booking.beneficiary_value),
          departmentId: toText(booking.department_id),
          tag: toText(booking.budget_tag),
        });
        setTravelDetails({
          checkInDate: toInputDate(booking.check_in_date),
          checkInTime: toText(booking.check_in_time),
          checkOutDate: toInputDate(booking.check_out_date),
          checkOutTime: toText(booking.check_out_time),
        });

        const bookingGuests = Array.isArray(booking.guests) ? booking.guests : [];
        setGuests(
          bookingGuests.map((guest: any) => {
            const roomRequests = Array.isArray(guest.roomRequests) ? guest.roomRequests : [];
            const roomCount = (roomType: RoomType) =>
              toText(roomRequests.find((request: any) => request.room_type === roomType)?.requested_count);
            return {
              id: Number(guest.id),
              name: toText(guest.name),
              gender: guest.gender || '',
              priority: guest.priority || 'Routine',
              designation: toText(guest.designation),
              email: toText(guest.email),
              organization: toText(guest.organization),
              city: toText(guest.city),
              state: toText(guest.state),
              accompaniedMale: toText(guest.accompanied_male),
              accompaniedFemale: toText(guest.accompanied_female),
              accompaniedChildren: toText(guest.accompanied_children),
              roomSingle: roomCount('Single'),
              roomDouble: roomCount('Double'),
              roomDeluxe: roomCount('Deluxe'),
              foodVeg: toText(guest.food_veg),
              foodNonVeg: toText(guest.food_nonveg),
              remarks: toText(guest.remarks),
            };
          }),
        );

        const requirements = Array.isArray(booking.foodRequirements) ? booking.foodRequirements : [];
        if (requirements.length) {
          setFoodRows(
            requirements.map((row: any) => ({
              id: Number(row.id),
              date: toInputDate(row.req_date),
              morningRefreshment: toText(row.morning_refreshment),
              breakfastVeg: toText(row.breakfast_veg),
              breakfastNonVeg: toText(row.breakfast_nonveg),
              lunchVeg: toText(row.lunch_veg),
              lunchNonVeg: toText(row.lunch_nonveg),
              eveningRefreshment: toText(row.evening_refreshment),
              dinnerVeg: toText(row.dinner_veg),
              dinnerNonVeg: toText(row.dinner_nonveg),
            })),
          );
        }
      } catch (error) {
        console.error('Failed to load guesthouse booking:', error);
        if (isMounted) {
          setSubmitMessage('Unable to load this guesthouse booking.');
        }
      }
    };

    void loadBooking();
    return () => {
      isMounted = false;
    };
  }, [bookingId, isViewingBooking]);


  useEffect(() => {
    if (!isRoomAllotmentVisible) return;
    let isMounted = true;

    const loadRoomOptions = async () => {
      try {
        const response = await authenticityUtility.get('/guesthouse/room-options');
        const options = normalizeRoomBlockOptions(response);

        if (isMounted && options.length) {
          setRoomBlockOptions(options);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.info('Guesthouse room options could not be loaded.', error);
        }
      }
    };

    loadRoomOptions();

    return () => {
      isMounted = false;
    };
  }, [isRoomAllotmentVisible]);

  useEffect(() => {
    if (!isRoomAllotmentVisible) return;
    let isMounted = true;

    const loadSpocOptions = async () => {
      try {
        const response = await authenticityUtility.get('/guesthouse/spocs');
        const options = normalizeTextOptions(response, [
          'name',
          'spoc',
          'full_name',
          'fullName',
          'label',
          'value',
        ]);

        if (isMounted) {
          setSpocOptions(options);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.info('Guesthouse SPOC options could not be loaded.', error);
        }
      }
    };

    loadSpocOptions();

    return () => {
      isMounted = false;
    };
  }, [isRoomAllotmentVisible]);

  useEffect(() => {
    if (!isRoomAllotmentVisible) return;
    setRoomAllotments((prevAllotments) =>
      guests.reduce<RoomAllotmentsByGuest>((nextAllotments, guest) => {
        const guestId = String(guest.id);
        nextAllotments[guestId] = createRoomAllotmentData(
          guestId,
          guest,
          prevAllotments[guestId],
        );
        return nextAllotments;
      }, {}),
    );
  }, [guests, isRoomAllotmentVisible]);
  useEffect(() => {
    setFoodDateInputs((prevInputs) =>
      foodRows.reduce<Record<number, string>>((nextInputs, row) => {
        nextInputs[row.id] = row.date ? formatDateForDisplay(row.date) : prevInputs[row.id] || '';
        return nextInputs;
      }, {}),
    );
  }, [foodRows]);



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
      }),
    );
  }, [travelDetails.checkInDate, travelDetails.checkOutDate]);

  const stayDates = useMemo(
    () => buildStayDates(travelDetails.checkInDate, travelDetails.checkOutDate),
    [travelDetails.checkInDate, travelDetails.checkOutDate],
  );

  const travelDuration = useMemo(() => formatTravelDuration(travelDetails), [travelDetails]);

  const totalGuestCount = useMemo(
    () =>
      guests.reduce(
        (total, guest) =>
          total +
          1 +
          numberOnly(guest.accompaniedMale) +
          numberOnly(guest.accompaniedFemale) +
          numberOnly(guest.accompaniedChildren),
        0,
      ),
    [guests],
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
        { refreshment: 0, veg: 0, nonVeg: 0 },
      ),
    [foodRows],
  );

  const updateGuest = (id: number, field: GuestField, value: string) => {
    setGuests((prevGuests) =>
      prevGuests.map((guest) => (guest.id === id ? { ...guest, [field]: value } : guest)),
    );
  };

  const updateBeneficiaryDetails = (field: keyof BeneficiaryDetails, value: string) => {
    setBeneficiaryDetails((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'beneficiaryType' || field === 'staffName' ? { departmentId: '' } : {}),
    }));
  };

  useEffect(() => {
    const loadBeneficiaryEntities = async () => {
      try {
        const response = (await authenticityUtility.get('/budget/org-units')) as any;
        const grouped = response?.data?.grouped || {};
        const options: BeneficiaryEntityOptions = {};
        Object.entries(grouped).forEach(([type, rows]) => {
          options[type] = Array.isArray(rows)
            ? rows
                .map((row: any) => ({
                  id: String(row?.id || row?.department_id || row?.entity_id || ''),
                  name: String(row?.name || row?.label || row?.unit_name || row?.value || '').trim(),
                }))
                .filter((option) => option.name)
            : [];
        });
        setBeneficiaryEntityOptions(options);
      } catch (error) {
        console.error('Failed to load guesthouse beneficiary options:', error);
      }
    };

    loadBeneficiaryEntities();
  }, []);

  useEffect(() => {
    if (!['Faculty', 'Staff'].includes(beneficiaryDetails.beneficiaryType)) return;
    const query = beneficiaryDetails.staffName.trim();
    if (query.length < 1 && !beneficiarySearchOpen) {
      setBeneficiaryEmployeeOptions([]);
      return;
    }

    const loadEmployees = async () => {
      try {
        const type = beneficiaryDetails.beneficiaryType === 'Faculty' ? 'Teaching' : 'Non-Teaching';
        const response = (await authenticityUtility.get(
          `/budget/search-applicant?q=${encodeURIComponent(query || 'a')}&type=${type}`,
        )) as any;
        setBeneficiaryEmployeeOptions(Array.isArray(response?.data) ? response.data : []);
      } catch (error) {
        console.error('Failed to load beneficiary employees:', error);
        setBeneficiaryEmployeeOptions([]);
      }
    };

    void loadEmployees();
  }, [beneficiaryDetails.beneficiaryType, beneficiaryDetails.staffName, beneficiarySearchOpen]);

  const addGuest = () => {
    setGuests((prevGuests) => [...prevGuests, createGuest()]);
  };

  const removeGuest = (id: number) => {
    setGuests((prevGuests) =>
      prevGuests.length === 1 ? prevGuests : prevGuests.filter((guest) => guest.id !== id),
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
      prevRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const updateFoodDateInput = (id: number, value: string) => {
    const formattedValue = formatDateEntry(value);
    const parsedDate = parseDisplayDate(formattedValue);

    setFoodDateInputs((prevInputs) => ({ ...prevInputs, [id]: formattedValue }));

    if (!formattedValue || parsedDate) {
      updateFoodRow(id, 'date', parsedDate);
    }
  };

  const resetFoodDateInput = (row: FoodRequirementRow) => {
    setFoodDateInputs((prevInputs) => ({
      ...prevInputs,
      [row.id]: formatDateForDisplay(row.date),
    }));
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
      prevRows.length === 1 ? prevRows : prevRows.filter((row) => row.id !== id),
    );
  };

  const getRoomNumbersForBlock = (block: string) =>
    roomBlockOptions.find((option) => option.block === block)?.roomNumbers || [];

  const getRoomNumberOptions = (block: string, selectedRoom: string) => {
    const roomNumbers = getRoomNumbersForBlock(block);
    return selectedRoom && !roomNumbers.includes(selectedRoom)
      ? [selectedRoom, ...roomNumbers]
      : roomNumbers;
  };

  const updateAllotmentRow = (
    guestId: string,
    rowId: string,
    field: keyof RoomAllotmentRow,
    value: string,
  ) => {
    setRoomAllotments((prevAllotments) => {
      const allotment = prevAllotments[guestId];

      if (!allotment) {
        return prevAllotments;
      }

      return {
        ...prevAllotments,
        [guestId]: {
          ...allotment,
          rows: allotment.rows.map((row) =>
            row.id === rowId ? { ...row, [field]: value } : row,
          ),
        },
      };
    });
  };

  const updateAllotmentBlock = (guestId: string, rowId: string, block: string) => {
    setRoomAllotments((prevAllotments) => {
      const allotment = prevAllotments[guestId];

      if (!allotment) {
        return prevAllotments;
      }

      const roomNumbers = getRoomNumbersForBlock(block);

      return {
        ...prevAllotments,
        [guestId]: {
          ...allotment,
          rows: allotment.rows.map((row) =>
            row.id === rowId
              ? {
                  ...row,
                  block,
                  roomNumber: roomNumbers.includes(row.roomNumber) ? row.roomNumber : '',
                }
              : row,
          ),
        },
      };
    });
  };

  const updateAllotmentContact = (
    guestId: string,
    field: 'spoc' | 'mobile',
    value: string,
  ) => {
    setRoomAllotments((prevAllotments) => {
      const allotment = prevAllotments[guestId];

      if (!allotment) {
        return prevAllotments;
      }

      return {
        ...prevAllotments,
        [guestId]: {
          ...allotment,
          [field]: value,
        },
      };
    });
  };

  const updateAllotmentAmenity = (
    guestId: string,
    amenity: GuestAmenityKey,
    checked: boolean,
  ) => {
    setRoomAllotments((prevAllotments) => {
      const allotment = prevAllotments[guestId];

      if (!allotment) {
        return prevAllotments;
      }

      return {
        ...prevAllotments,
        [guestId]: {
          ...allotment,
          amenities: {
            ...allotment.amenities,
            [amenity]: checked,
          },
        },
      };
    });
  };

  const toggleRoomDetails = (guestId: string, rowId: string) => {
    setActiveRoomDetail((previousRoom) =>
      previousRoom?.guestId === guestId && previousRoom.rowId === rowId
        ? null
        : { guestId, rowId },
    );
  };

  const updateManagedRoom = (
    id: number,
    field: keyof Omit<ManagedRoomRow, 'id'>,
    value: string,
  ) => {
    setManagedRooms((prevRooms) =>
      prevRooms.map((room) => (room.id === id ? { ...room, [field]: value } : room)),
    );
  };

  const addManagedRoom = () => {
    const room = createManagedRoomRow();
    setManagedRooms((prevRooms) => [...prevRooms, room]);
    setEditingManagedRoomId(room.id);
    setViewingManagedRoomId(room.id);
  };

  const removeManagedRoom = (id: number) => {
    setManagedRooms((prevRooms) =>
      prevRooms.length === 1 ? prevRooms : prevRooms.filter((room) => room.id !== id),
    );

    setEditingManagedRoomId((currentId) => (currentId === id ? null : currentId));
    setViewingManagedRoomId((currentId) => (currentId === id ? null : currentId));
  };

  const updateCareTaker = (
    id: number,
    field: keyof Omit<CareTakerRow, 'id'>,
    value: string,
  ) => {
    setCareTakers((prevCareTakers) =>
      prevCareTakers.map((careTaker) =>
        careTaker.id === id ? { ...careTaker, [field]: value } : careTaker,
      ),
    );
  };

  const addCareTaker = () => {
    const careTaker = createCareTakerRow();
    setCareTakers((prevCareTakers) => [...prevCareTakers, careTaker]);
    setEditingCareTakerId(careTaker.id);
  };

  const removeCareTaker = (id: number) => {
    setCareTakers((prevCareTakers) =>
      prevCareTakers.length === 1
        ? prevCareTakers
        : prevCareTakers.filter((careTaker) => careTaker.id !== id),
    );

    setEditingCareTakerId((currentId) => (currentId === id ? null : currentId));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isEditMode) {
      setSubmitMessage('Editing is preview-only until the guesthouse update API is available.');
      return;
    }

    // Validate checkout is after checkin
    const start = buildTravelDateTime(travelDetails.checkInDate, travelDetails.checkInTime);
    const end = buildTravelDateTime(travelDetails.checkOutDate, travelDetails.checkOutTime);

    if (start && end && end <= start) {
      setSubmitMessage('Check-out date/time must be after check-in date/time.');
      return;
    }

    if (!applicantUiDetails.name || !beneficiaryDetails.beneficiaryType || !beneficiaryDetails.staffName) {
      setSubmitMessage('Applicant and beneficiary details are required.');
      return;
    }

    if (!travelDetails.checkInDate || !travelDetails.checkOutDate || !travelDetails.checkInTime || !travelDetails.checkOutTime) {
      setSubmitMessage('Check-in and check-out date and time are required.');
      return;
    }

    if (guests.some((guest) => !guest.name.trim())) {
      setSubmitMessage('Enter a name for every guest.');
      return;
    }

    // Backend must independently derive and validate applicant identity from the auth token.
    const payload = {
      applicant: applicantUiDetails,
      beneficiary: beneficiaryDetails,
      guests,
      travelDetails,
      numberOfDays: stayDates.length,
      duration: travelDuration,
      foodRequirements: foodRows,
    };

    try {
      const response = (await authenticityUtility.post('/guesthouse', payload)) as any;
      if (!response?.success) {
        throw new Error(response?.message || 'Guesthouse booking submission failed');
      }
      setSubmitMessage('Guesthouse booking submitted successfully.');
      navigate('/guestHouse-dashboard', { replace: true });
    } catch (error: any) {
      console.error('Guesthouse booking submission failed:', error);
      setSubmitMessage(
        error?.response?.data?.message ||
          error?.message ||
          'Unable to submit guesthouse booking.',
      );
    }
  };

  const renderReadOnlyInput = (
    label: string,
    value: string,
    type: React.HTMLInputTypeAttribute = 'text',
    placeholder = '',
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
    label: string,
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

  const renderTimeInput = (field: TravelTimeField, label: string) => (
    <label className="guesthousebooking-time-field">
      <span>{label}</span>
      <input
        className="guesthousebooking-time-input"
        type="text"
        placeholder="HH:MM AM/PM"
        value={travelDetails[field]}
        onChange={(event) =>
          updateTravelDetails(field, formatTimeAsYouType(event.target.value, travelDetails[field]))
        }
        onBlur={() => updateTravelDetails(field, normalizeTravelTimeEntry(travelDetails[field]))}
        inputMode="text"
        maxLength={9}
        pattern="(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)"
        title="Enter time as HH:MM AM or HH:MM PM"
        aria-label={`${label} time`}
        required
      />
    </label>
  );
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
          {renderTimeInput('checkInTime', 'Time')}
        </div>

        <div className="guesthousebooking-travel-row">
          <span className="guesthousebooking-travel-label">Check-out</span>
          {renderTravelDateInput('checkOutDate')}
          {renderTimeInput('checkOutTime', 'Time')}
        </div>

        <div className="guesthousebooking-days-row">
          <span className="guesthousebooking-days-icon">
            <Calendar size={18} />
          </span>
          <span>Number of Days</span>
          <strong>{travelDuration}</strong>
        </div>
      </div>
    </div>
  );

  const getRoomFloor = (roomNumber: string) => {
    const floorDigit = roomNumber.match(/\d/)?.[0] || '';
    return floorDigit ? `${floorDigit} Floor` : '';
  };

  const renderRoomDetailControl = (label: string, value: string, asSelect = false) => (
    <label className="guesthousebooking-room-detail-meta-field">
      <span>{label}</span>
      {asSelect ? (
        <select value={value} disabled aria-label={`Room details ${label}`}>
          <option value={value}>{value}</option>
        </select>
      ) : (
        <input value={value} readOnly aria-label={`Room details ${label}`} />
      )}
    </label>
  );

  const renderRoomDetailItem = (item: RoomDetailOption) => {
    const Icon = item.Icon;

    return (
      <label className="guesthousebooking-room-detail-item" key={item.label}>
        <input
          className="guesthousebooking-checkbox guesthousebooking-room-detail-checkbox"
          type="checkbox"
        />
        <Icon className="guesthousebooking-room-detail-item-icon" size={22} aria-hidden="true" />
        <span>{item.label}</span>
        <Info className="guesthousebooking-room-detail-info-icon" size={14} aria-hidden="true" />
      </label>
    );
  };

  const renderRoomDetailSectionTitle = (title: string) => (
    <div className="guesthousebooking-room-detail-section-title">
      <span>{title}</span>
    </div>
  );

  const renderRoomDetailsCard = (row: RoomAllotmentRow) => {
    const status = row.roomNumber ? 'Ready' : 'Pending';

    return (
      <div className="guesthousebooking-room-details-card" id={`room-details-${row.id}`}>
        <div className="guesthousebooking-room-details-header">
          <span>Room Details</span>
        </div>

        <div className="guesthousebooking-room-details-content">
          <div className="guesthousebooking-room-details-meta-row">
            {renderRoomDetailControl('Number', row.roomNumber)}
            {renderRoomDetailControl('Type', row.roomType, true)}
            {renderRoomDetailControl('Floor', getRoomFloor(row.roomNumber), true)}
            {renderRoomDetailControl('Block', row.block, true)}
            {renderRoomDetailControl('Status', status, true)}
            <CircleCheck className="guesthousebooking-room-detail-ready-icon" size={18} aria-hidden="true" />
          </div>

          <section className="guesthousebooking-room-detail-section" aria-label="Amenities">
            {renderRoomDetailSectionTitle('Amenities')}
            <div className="guesthousebooking-room-detail-groups">
              {ROOM_DETAIL_AMENITY_GROUPS.map((group) => (
                <div className="guesthousebooking-room-detail-group" key={group.title}>
                  <h3>{group.title}</h3>
                  <div className="guesthousebooking-room-detail-group-items">
                    {group.items.map(renderRoomDetailItem)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="guesthousebooking-room-detail-section" aria-label="Essentials">
            {renderRoomDetailSectionTitle('Essentials')}
            <div className="guesthousebooking-room-detail-flat-list">
              {ROOM_DETAIL_ESSENTIALS.map(renderRoomDetailItem)}
            </div>
          </section>

          <section className="guesthousebooking-room-detail-section" aria-label="Services">
            {renderRoomDetailSectionTitle('Services')}
            <div className="guesthousebooking-room-detail-flat-list guesthousebooking-room-detail-services-list">
              {ROOM_DETAIL_SERVICES.map(renderRoomDetailItem)}
            </div>
          </section>
        </div>
      </div>
    );
  };
  const renderGuesthouseManagementActions = (
    onAdd: () => void,
    onEdit: () => void,
    onView: () => void,
    onDelete: () => void,
    deleteDisabled: boolean,
    isEditing: boolean,
    isViewing: boolean,
    label: string,
  ) => (
    <div className="guesthousebooking-management-actions">
      <button
        className="guesthousebooking-management-icon-button guesthousebooking-management-icon-button--add"
        type="button"
        onClick={onAdd}
        aria-label={`Add ${label}`}
        title={`Add ${label}`}
      >
        <PlusCircle size={16} />
      </button>
      <button
        className={`guesthousebooking-management-icon-button${isEditing ? ' is-active' : ''}`}
        type="button"
        onClick={onEdit}
        aria-label={`${isEditing ? 'Finish editing' : 'Edit'} ${label}`}
        title={`${isEditing ? 'Finish editing' : 'Edit'} ${label}`}
      >
        <PencilLine size={15} />
      </button>
      <button
        className={`guesthousebooking-management-icon-button guesthousebooking-management-icon-button--view${isViewing ? ' is-active' : ''}`}
        type="button"
        onClick={onView}
        aria-label={`View ${label}`}
        title={`View ${label}`}
      >
        <Eye size={17} />
      </button>
      <button
        className="guesthousebooking-management-icon-button guesthousebooking-management-icon-button--delete"
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

  const renderCareTakerManagementActions = (
    onAdd: () => void,
    onEdit: () => void,
    onDelete: () => void,
    deleteDisabled: boolean,
    isEditing: boolean,
    label: string,
  ) => (
    <div className="guesthousebooking-management-actions guesthousebooking-management-actions--compact">
      <button
        className="guesthousebooking-management-icon-button guesthousebooking-management-icon-button--add"
        type="button"
        onClick={onAdd}
        aria-label={`Add ${label}`}
        title={`Add ${label}`}
      >
        <PlusCircle size={16} />
      </button>
      <button
        className={`guesthousebooking-management-icon-button${isEditing ? ' is-active' : ''}`}
        type="button"
        onClick={onEdit}
        aria-label={`${isEditing ? 'Finish editing' : 'Edit'} ${label}`}
        title={`${isEditing ? 'Finish editing' : 'Edit'} ${label}`}
      >
        <PencilLine size={15} />
      </button>
      <button
        className="guesthousebooking-management-icon-button guesthousebooking-management-icon-button--delete"
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
  const renderGuesthouseAdminManagement = () => (
    <section className="guesthousebooking-card guesthousebooking-management-card">
      <div className="guesthousebooking-management-panel">
        <div className="guesthousebooking-management-title">Room Management</div>
        <div className="guesthousebooking-management-table-wrap">
          <table className="guesthousebooking-management-table guesthousebooking-room-management-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Room Type</th>
                <th>Block</th>
                <th>Floor</th>
                <th>Room Number</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {managedRooms.map((room, index) => {
                const isEditing = editingManagedRoomId === room.id;
                const isViewing = viewingManagedRoomId === room.id;

                return (
                  <tr className={isViewing ? 'is-viewing' : ''} key={room.id}>
                    <td>{index + 1}</td>
                    <td>
                      <select
                        className="guesthousebooking-management-control"
                        value={room.roomType}
                        onChange={(event) =>
                          updateManagedRoom(room.id, 'roomType', event.target.value)
                        }
                        disabled={!isEditing}
                        aria-label="Room type"
                      >
                        {ROOM_REQUIREMENT_CONFIG.map((option) => (
                          <option key={option.roomType} value={option.roomType}>
                            {option.roomType}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="guesthousebooking-management-control"
                        type="text"
                        value={room.block}
                        onChange={(event) =>
                          updateManagedRoom(room.id, 'block', event.target.value)
                        }
                        readOnly={!isEditing}
                        aria-label="Room block"
                      />
                    </td>
                    <td>
                      <input
                        className="guesthousebooking-management-control"
                        type="text"
                        value={room.floor}
                        onChange={(event) =>
                          updateManagedRoom(room.id, 'floor', event.target.value)
                        }
                        readOnly={!isEditing}
                        aria-label="Room floor"
                      />
                    </td>
                    <td>
                      <input
                        className="guesthousebooking-management-control"
                        type="text"
                        value={room.roomNumber}
                        onChange={(event) =>
                          updateManagedRoom(room.id, 'roomNumber', event.target.value)
                        }
                        readOnly={!isEditing}
                        aria-label="Room number"
                      />
                    </td>
                    <td>
                      <select
                        className={`guesthousebooking-management-status guesthousebooking-management-status--${room.status.toLowerCase()}`}
                        value={room.status}
                        onChange={(event) =>
                          updateManagedRoom(room.id, 'status', event.target.value)
                        }
                        disabled={!isEditing}
                        aria-label="Room status"
                      >
                        <option value="Active">Active</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                    </td>
                    <td>
                      {renderGuesthouseManagementActions(
                        addManagedRoom,
                        () =>
                          setEditingManagedRoomId((currentId) =>
                            currentId === room.id ? null : room.id,
                          ),
                        () =>
                          setViewingManagedRoomId((currentId) =>
                            currentId === room.id ? null : room.id,
                          ),
                        () => removeManagedRoom(room.id),
                        managedRooms.length === 1,
                        isEditing,
                        isViewing,
                        'room',
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="guesthousebooking-management-title guesthousebooking-management-title--spaced">
          Care Taker Management
        </div>
        <div className="guesthousebooking-management-table-wrap guesthousebooking-caretaker-management-wrap">
          <table className="guesthousebooking-management-table guesthousebooking-caretaker-management-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Care Taker Name</th>
                <th>Mobile Number</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {careTakers.map((careTaker, index) => {
                const isEditing = editingCareTakerId === careTaker.id;

                return (
                  <tr key={careTaker.id}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        className="guesthousebooking-management-control"
                        type="text"
                        value={careTaker.name}
                        onChange={(event) =>
                          updateCareTaker(careTaker.id, 'name', event.target.value)
                        }
                        readOnly={!isEditing}
                        aria-label="Care taker name"
                      />
                    </td>
                    <td>
                      <input
                        className="guesthousebooking-management-control"
                        type="tel"
                        value={careTaker.mobile}
                        onChange={(event) =>
                          updateCareTaker(careTaker.id, 'mobile', event.target.value)
                        }
                        readOnly={!isEditing}
                        aria-label="Care taker mobile number"
                      />
                    </td>
                    <td>
                      <select
                        className={`guesthousebooking-management-status guesthousebooking-management-status--${careTaker.status.toLowerCase()}`}
                        value={careTaker.status}
                        onChange={(event) =>
                          updateCareTaker(careTaker.id, 'status', event.target.value)
                        }
                        disabled={!isEditing}
                        aria-label="Care taker status"
                      >
                        <option value="Active">Active</option>
                        <option value="Leave">Leave</option>
                      </select>
                    </td>
                    <td>
                      {renderCareTakerManagementActions(
                        addCareTaker,
                        () =>
                          setEditingCareTakerId((currentId) =>
                            currentId === careTaker.id ? null : careTaker.id,
                          ),
                        () => removeCareTaker(careTaker.id),
                        careTakers.length === 1,
                        isEditing,
                        'care taker',
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
  return (
    <div className="guesthousebooking-page">
      <div className="guesthousebooking-shell">
        <form onSubmit={handleSubmit}>
          <fieldset disabled={isViewingBooking} style={{ border: 0, padding: 0, margin: 0 }}>
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
                  <div className="guesthousebooking-field" style={{ position: 'relative' }}>
                    <label className="guesthousebooking-label">Applicant Name</label>
                    <input
                      className="guesthousebooking-input"
                      value={applicantSearch || applicantUiDetails.name}
                      onChange={(event) => setApplicantSearch(event.target.value)}
                      readOnly={!canOverrideApplicant || isViewingBooking}
                      placeholder="Search employee by name or ERP ID"
                    />
                    {canOverrideApplicant && applicantResults.length > 0 && (
                      <div className="guesthousebooking-employee-dropdown">
                        {applicantResults.map((employee, index) => (
                          <button
                            type="button"
                            className="guesthousebooking-employee-option"
                            key={`${employee.employee_id || employee.id || employee.name}-${index}`}
                            onClick={() => {
                              setApplicantProfile(employee);
                              setApplicantSearch('');
                              setApplicantResults([]);
                            }}
                          >
                            <strong>{getTextValue(employee, ['name', 'full_name', 'fullName'])}</strong>
                            <span>
                              {getTextValue(employee, ['designation', 'role_name'])} |{' '}
                              {getTextValue(employee, ['department', 'department_name'])}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {renderReadOnlyInput('Date', applicantUiDetails.date, 'date')}
                  {renderReadOnlyInput('Department', applicantUiDetails.department)}
                  {renderReadOnlyInput(
                    'Designation',
                    applicantUiDetails.designation,
                    'text',
                    'e.g., Manager, Staff',
                  )}
                  {renderReadOnlyInput('Email', applicantUiDetails.email, 'email')}
                  {renderReadOnlyInput(
                    'Mobile',
                    applicantUiDetails.mobile,
                    'tel',
                    '10 digit mobile',
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="guesthousebooking-card guesthousebooking-beneficiary-card">
            <div className="guesthousebooking-beneficiary-grid">
              <div className="guesthousebooking-beneficiary-field">
                <label className="guesthousebooking-beneficiary-label">Beneficiary</label>
                <select
                  className="guesthousebooking-beneficiary-control guesthousebooking-beneficiary-select"
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
              <div className="guesthousebooking-beneficiary-field">
                <label className="guesthousebooking-beneficiary-label">
                  {['Faculty', 'Staff'].includes(beneficiaryDetails.beneficiaryType)
                    ? `${beneficiaryDetails.beneficiaryType} Name`
                    : beneficiaryDetails.beneficiaryType}
                </label>
                {['Faculty', 'Staff'].includes(beneficiaryDetails.beneficiaryType) ? (
                  <>
                    <input
                      className="guesthousebooking-beneficiary-control"
                      value={beneficiaryDetails.staffName}
                      onChange={(event) => updateBeneficiaryDetails('staffName', event.target.value)}
                      placeholder={`Search ${beneficiaryDetails.beneficiaryType.toLowerCase()} by name or ERP ID`}
                      onFocus={() => setBeneficiarySearchOpen(true)}
                      onBlur={() => window.setTimeout(() => setBeneficiarySearchOpen(false), 200)}
                    />
                    {beneficiaryEmployeeOptions.length > 0 && (
                      <div className="guesthousebooking-employee-dropdown">
                        {beneficiaryEmployeeOptions.map((employee, index) => (
                          <button
                            type="button"
                            className="guesthousebooking-employee-option"
                            key={`${employee.employee_id || employee.name || 'employee'}-${index}`}
                            onClick={() => {
                              setBeneficiaryDetails((prev) => ({
                                ...prev,
                                staffName: employee.name || '',
                                departmentId: String(
                                  employee.department_id || employee.departmentId || '',
                                ),
                              }));
                              setBeneficiaryEmployeeOptions([]);
                              setBeneficiarySearchOpen(false);
                            }}
                          >
                            <strong>{employee.name}</strong>
                            <span>{employee.department || 'Employee'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <select
                    className="guesthousebooking-beneficiary-control guesthousebooking-beneficiary-select"
                    value={beneficiaryDetails.staffName}
                    onChange={(event) => {
                      const selectedName = event.target.value;
                      const selectedOption = (
                        beneficiaryEntityOptions[beneficiaryDetails.beneficiaryType.toUpperCase()] ||
                        beneficiaryEntityOptions[beneficiaryDetails.beneficiaryType] ||
                        []
                      ).find((option) => option.name === selectedName);
                      setBeneficiaryDetails((prev) => ({
                        ...prev,
                        staffName: selectedName,
                        departmentId:
                          beneficiaryDetails.beneficiaryType === 'Department'
                            ? selectedOption?.id || ''
                            : '',
                      }));
                    }}
                  >
                    <option value="">Select {beneficiaryDetails.beneficiaryType.toLowerCase()}</option>
                    {(beneficiaryEntityOptions[beneficiaryDetails.beneficiaryType.toUpperCase()] ||
                      beneficiaryEntityOptions[beneficiaryDetails.beneficiaryType] ||
                      []).map((option) => (
                      <option key={`${option.id}-${option.name}`} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="guesthousebooking-beneficiary-field">
                <label className="guesthousebooking-beneficiary-label">Tag</label>
                <select
                  className="guesthousebooking-beneficiary-control guesthousebooking-beneficiary-select"
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

          <div className="guesthousebooking-guest-list" aria-label="Guest Details">
            {guests.map((guest, index) => (
              <section
                className="guesthousebooking-card guesthousebooking-guest-card"
                key={guest.id}
              >
                <div className="guesthousebooking-guest-block">
                  <div className="guesthousebooking-section-header guesthousebooking-guest-title-row">
                    <span className="guesthousebooking-guest-title">Guest {index + 1}</span>
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
                    <div className="guesthousebooking-left-column">
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

                          <div className="guesthousebooking-field guesthousebooking-field--email">
                            <label className="guesthousebooking-label">Email</label>
                            <input
                              className="guesthousebooking-input"
                              type="email"
                              value={guest.email || ''}
                              onChange={(event) =>
                                updateGuest(guest.id, 'email', event.target.value)
                              }
                              placeholder="Enter email"
                            />
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

                      <div className="guesthousebooking-option-row guesthousebooking-field--remarks">
                        <div className="guesthousebooking-option-heading">
                          <span>Remarks</span>
                        </div>
                        <input
                          className="guesthousebooking-input guesthousebooking-remarks-input"
                          type="text"
                          value={guest.remarks || ''}
                          onChange={(event) =>
                            updateGuest(guest.id, 'remarks', event.target.value)
                          }
                          placeholder="Enter remarks (if any)"
                        />
                      </div>
                    </div>

                    <div className="guesthousebooking-right-column">
                      {renderTravelPanel()}

                      <div className="guesthousebooking-option-row guesthousebooking-field--priority-sidebar">
                        <div className="guesthousebooking-option-heading">
                          <span className="guesthousebooking-option-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2L2 12l10 10 10-10L12 2z" fill="currentColor" />
                              <path d="M12 8v5M12 16h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </span>
                          <span>Priority</span>
                        </div>
                        <div className="guesthousebooking-radio-group">
                          {(['Routine', 'High'] as GuestPriority[]).map((priority) => (
                            <label
                              className={`guesthousebooking-radio ${
                                guest.priority === priority
                                  ? 'guesthousebooking-radio--active'
                                  : ''
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

                      <div className="guesthousebooking-option-row guesthousebooking-field--room-total">
                        <div className="guesthousebooking-option-heading">
                          <span className="guesthousebooking-option-icon">
                            <BedDouble size={21} />
                          </span>
                          <span>Total Number of Rooms</span>
                        </div>
                        <input
                          className="guesthousebooking-small-input guesthousebooking-total-input"
                          type="number"
                          value={
                            numberOnly(guest.roomSingle) +
                            numberOnly(guest.roomDouble) +
                            numberOnly(guest.roomDeluxe)
                          }
                          readOnly
                          aria-label="Total number of rooms"
                        />
                      </div>

                      <div className="guesthousebooking-option-row guesthousebooking-field--food">
                        <div className="guesthousebooking-option-heading">
                          <span className="guesthousebooking-option-icon">
                            <Utensils size={20} />
                          </span>
                          <span>Food</span>
                        </div>
                        <div className="guesthousebooking-food-counts">
                          <label className="guesthousebooking-food-count-label guesthousebooking-food-count-label--veg">
                            <span>Veg.</span>
                            <input
                              className="guesthousebooking-small-input guesthousebooking-food-count-input guesthousebooking-small-input--veg"
                              type="number"
                              min="0"
                              value={guest.foodVeg}
                              onChange={(event) =>
                                updateGuest(guest.id, 'foodVeg', event.target.value)
                              }
                              aria-label="Veg food count"
                            />
                          </label>
                          <label className="guesthousebooking-food-count-label guesthousebooking-food-count-label--nonveg">
                            <span>Non-Veg.</span>
                            <input
                              className="guesthousebooking-small-input guesthousebooking-food-count-input guesthousebooking-small-input--nonveg"
                              type="number"
                              min="0"
                              value={guest.foodNonVeg}
                              onChange={(event) =>
                                updateGuest(guest.id, 'foodNonVeg', event.target.value)
                              }
                              aria-label="Non-veg food count"
                            />
                          </label>
                        </div>
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
                          <span className="guesthousebooking-date-input-wrap guesthousebooking-food-date-wrap">
                            <input
                              className="guesthousebooking-food-date"
                              type="text"
                              value={foodDateInputs[row.id] ?? formatDateForDisplay(row.date)}
                              onChange={(event) => updateFoodDateInput(row.id, event.target.value)}
                              onBlur={() => resetFoodDateInput(row)}
                              placeholder="dd/mm/yyyy"
                              inputMode="numeric"
                              pattern="\d{2}/\d{2}/\d{4}"
                              title="Enter date as DD/MM/YYYY"
                              maxLength={10}
                            />
                            <input
                              className="guesthousebooking-native-date-picker guesthousebooking-food-native-date-picker"
                              type="date"
                              value={row.date}
                              onChange={(event) => updateFoodRow(row.id, 'date', event.target.value)}
                              aria-label="Open food date calendar"
                              tabIndex={-1}
                            />
                          </span>
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
                        <td>
                          {renderFoodPair(row, 'breakfastVeg', 'breakfastNonVeg', 'Breakfast')}
                        </td>
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

          {/* Room Allotment Cards */}
          {isRoomAllotmentVisible && <div className="guesthousebooking-allotment-list" aria-label="Room Allotment">
            {guests.map((guest, index) => {
              const guestId = String(guest.id);
              const allotment =
                roomAllotments[guestId] || createRoomAllotmentData(guestId, guest);
              const counts = getGuestAllotmentCounts(guest);
              const checkInDate = formatDateForDisplay(travelDetails.checkInDate);
              const checkInTime = normalizeTravelTimeEntry(travelDetails.checkInTime);
              const checkOutDate = formatDateForDisplay(travelDetails.checkOutDate);
              const checkOutTime = normalizeTravelTimeEntry(travelDetails.checkOutTime);
              const totalRooms =
                numberOnly(guest.roomSingle) +
                numberOnly(guest.roomDouble) +
                numberOnly(guest.roomDeluxe);
              const priorityStatus = guest.priority || 'Routine';
              const priorityTone = priorityStatus === 'High' ? 'high' : 'routine';
              const activeRoomDetailRow =
                activeRoomDetail?.guestId === guestId
                  ? allotment.rows.find((row) => row.id === activeRoomDetail.rowId)
                  : undefined;

              return (
                <section
                  className="guesthousebooking-card guesthousebooking-allotment-card"
                  key={`room-allotment-${guest.id}`}
                >
                  <div className="guesthousebooking-room-allotment-header">
                    <span>Room Allotment</span>
                  </div>

                  <div className="guesthousebooking-card-body guesthousebooking-allotment-body">
                    <div className="guesthousebooking-allotment-entry-card">
                      <div className="guesthousebooking-allotment-summary-row">
                        <div className="guesthousebooking-allotment-guest-overview">
                          <span
                            className={`guesthousebooking-priority-indicator guesthousebooking-priority-indicator--${priorityTone}`}
                            aria-label={`${priorityStatus} priority`}
                            title={`${priorityStatus} priority`}
                          />
                          <span className="guesthousebooking-allotment-main-icon">
                            <UsersRound size={24} />
                          </span>
                          <div className="guesthousebooking-allotment-guest-copy">
                            <div className="guesthousebooking-allotment-guest-name-row">
                              <strong>{guest.name || `Guest ${index + 1}`}</strong>
                            </div>
                            <span>
                              {guest.organization || 'Organization'}
                            </span>
                          </div>
                        </div>

                        <div className="guesthousebooking-allotment-occupancy-group" aria-label="Guest counts">
                          <label className="guesthousebooking-allotment-occupancy-item">
                            <MaleAllotmentIcon />
                            <input value={counts.male} readOnly aria-label="Number of male guests" />
                          </label>
                          <label className="guesthousebooking-allotment-occupancy-item">
                            <FemaleAllotmentIcon />
                            <input value={counts.female} readOnly aria-label="Number of female guests" />
                          </label>
                          <label className="guesthousebooking-allotment-occupancy-item">
                            <ChildAllotmentIcon />
                            <input value={counts.children} readOnly aria-label="Number of children" />
                          </label>
                          <label className="guesthousebooking-allotment-occupancy-item">
                            <House className="guesthousebooking-allotment-person-icon" aria-hidden="true" />
                            <input value={totalRooms} readOnly aria-label="Number of rooms requested" />
                          </label>
                        </div>

                        <div className="guesthousebooking-allotment-date-stack">
                          <label className="guesthousebooking-allotment-datetime-row">
                            <span className="guesthousebooking-allotment-datetime-title">Check-in</span>
                            <input value={checkInDate} readOnly aria-label="Check-in date" />

                            <input value={checkInTime} readOnly aria-label="Check-in time" />
                            <CircleCheck className="guesthousebooking-allotment-check-icon" size={18} aria-hidden="true" />
                          </label>
                          <label className="guesthousebooking-allotment-datetime-row">
                            <span className="guesthousebooking-allotment-datetime-title">Check-out</span>
                            <input value={checkOutDate} readOnly aria-label="Check-out date" />

                            <input value={checkOutTime} readOnly aria-label="Check-out time" />
                            <CircleCheck className="guesthousebooking-allotment-check-icon" size={18} aria-hidden="true" />
                          </label>
                        </div>
                      </div>

                      <div className="guesthousebooking-table-wrap guesthousebooking-allotment-table-wrap">
                        <table className="guesthousebooking-food-table guesthousebooking-allotment-table">
                          <thead>
                            <tr>
                              <th className="guesthousebooking-allotment-col-sno">S.No.</th>
                              <th className="guesthousebooking-allotment-col-room-type">Room Type</th>
                              <th className="guesthousebooking-allotment-col-block">Block</th>
                              <th className="guesthousebooking-allotment-col-room-number">Room Number</th>
                              <th className="guesthousebooking-allotment-col-occupants">Occupants</th>
                              <th className="guesthousebooking-allotment-col-remarks">Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allotment.rows.length ? (
                              allotment.rows.map((row, idx) => {
                                const roomNumbers = getRoomNumberOptions(row.block, row.roomNumber);
                                const isRoomDetailActive =
                                  activeRoomDetail?.guestId === guestId && activeRoomDetail.rowId === row.id;

                                return (
                                  <tr key={row.id}>
                                    <td className="centerTd">{idx + 1}</td>
                                    <td>
                                      <select
                                        className="guesthousebooking-food-date guesthousebooking-allotment-compact-control"
                                        value={row.roomType}
                                        onChange={(event) =>
                                          updateAllotmentRow(
                                            guestId,
                                            row.id,
                                            'roomType',
                                            event.target.value,
                                          )
                                        }
                                      >
                                        {ROOM_REQUIREMENT_CONFIG.map((option) => (
                                          <option key={option.roomType} value={option.roomType}>
                                            {option.roomType}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td>
                                      <select
                                        className="guesthousebooking-food-date guesthousebooking-allotment-compact-control"
                                        value={row.block}
                                        onChange={(event) =>
                                          updateAllotmentBlock(guestId, row.id, event.target.value)
                                        }
                                      >
                                        <option value=""></option>
                                        {roomBlockOptions.map((option) => (
                                          <option key={option.block} value={option.block}>
                                            {option.block}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td>
                                      <div className="guesthousebooking-room-number-cell">
                                        <select
                                          className="guesthousebooking-food-date guesthousebooking-allotment-compact-control"
                                          value={row.roomNumber}
                                          onChange={(event) =>
                                            updateAllotmentRow(
                                              guestId,
                                              row.id,
                                              'roomNumber',
                                              event.target.value,
                                            )
                                          }
                                          disabled={!row.block}
                                        >
                                          <option value=""></option>
                                          {roomNumbers.map((roomNumber) => (
                                            <option key={roomNumber} value={roomNumber}>
                                              {roomNumber}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          className={`guesthousebooking-room-detail-trigger${isRoomDetailActive ? ' guesthousebooking-room-detail-trigger--active' : ''}`}
                                          type="button"
                                          onClick={() => toggleRoomDetails(guestId, row.id)}
                                          aria-label="Open room details"
                                          aria-expanded={isRoomDetailActive}
                                          title="Room Details"
                                        >
                                          <Info size={12} aria-hidden="true" />
                                        </button>
                                      </div>
                                    </td>
                                    <td>
                                      <input
                                        className="guesthousebooking-food-input guesthousebooking-allotment-occupants-input"
                                        type="number"
                                        min="1"
                                        value={row.occupants}
                                        onChange={(event) =>
                                          updateAllotmentRow(
                                            guestId,
                                            row.id,
                                            'occupants',
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="guesthousebooking-food-input guesthousebooking-allotment-remarks-input"
                                        type="text"
                                        value={row.remarks}
                                        onChange={(event) =>
                                          updateAllotmentRow(
                                            guestId,
                                            row.id,
                                            'remarks',
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td className="guesthousebooking-allotment-empty" colSpan={6}>
                                  No rooms requested
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="guesthousebooking-allotment-amenities-row" aria-label="Guest amenities">
                        <div className="guesthousebooking-allotment-amenities-list">
                          {GUEST_AMENITY_OPTIONS.map((amenity) => (
                            <label className="guesthousebooking-allotment-amenity" key={amenity.key}>
                              <input
                                className="guesthousebooking-checkbox guesthousebooking-amenity-checkbox"
                                type="checkbox"
                                checked={Boolean(allotment.amenities[amenity.key])}
                                onChange={(event) =>
                                  updateAllotmentAmenity(
                                    guestId,
                                    amenity.key,
                                    event.target.checked,
                                  )
                                }
                              />
                              <span>{amenity.label}</span>
                            </label>
                          ))}
                        </div>
                        <span className="guesthousebooking-allotment-amenities-title">
                          Guest Amenities
                        </span>
                      </div>
                    </div>

                    {activeRoomDetailRow && renderRoomDetailsCard(activeRoomDetailRow)}

                    <div className="guesthousebooking-allotment-caretaker-bar">
                      <span className="guesthousebooking-caretaker-title">Care Taker Details</span>
                      <div className="guesthousebooking-spoc-field guesthousebooking-caretaker-field">
                        <span>Care Taker Name</span>
                        <select
                          className="guesthousebooking-input guesthousebooking-spoc-control"
                          value={allotment.spoc}
                          onChange={(event) =>
                            updateAllotmentContact(guestId, 'spoc', event.target.value)
                          }
                        >
                          <option value="">Select Care Taker</option>
                          {spocOptions.map((spoc) => (
                            <option key={spoc} value={spoc}>
                              {spoc}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="guesthousebooking-spoc-field guesthousebooking-caretaker-field">
                        <span>Mobile Number</span>
                        <input
                          type="text"
                          className="guesthousebooking-input guesthousebooking-spoc-control"
                          placeholder="Enter mobile number"
                          value={allotment.mobile}
                          onChange={(event) =>
                            updateAllotmentContact(guestId, 'mobile', event.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>}
          <div className="guesthousebooking-actions">
            {submitMessage && (
              <span className={submitMessage.includes('successfully') ? 'guesthousebooking-success' : 'guesthousebooking-error'}>
                {submitMessage}
              </span>
            )}

            <button className="guesthousebooking-submit-button" type="submit" disabled={isViewingBooking}>
              {isViewingBooking ? 'Viewing Booking' : isEditMode ? 'Preview Edit' : 'Submit Booking'}
            </button>
          </div>
          {canManageGuesthouse && renderGuesthouseAdminManagement()}
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default GuestHouseBooking;
