import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AirVent,
  Archive,
  Armchair,
  Bath,
  Bed,
  BedDouble,
  Calendar,
  Cable,
  Check,
  CircleCheck,
  ChevronDown,
  ChevronUp,
  Droplets,
  Download,
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
  RotateCcw,
  ShowerHead,
  Sofa,
  Table,
  Trash2,
  Tv,
  UsersRound,
  Upload,
  Utensils,
  WashingMachine,
  Wifi,
  XCircle,
} from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../../contexts/AuthContext';
import { useAbility } from '../../shared/casl/AbilityContext';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import { getGuesthouseWorkflowStage } from '../../shared/utils/permissionUtils';
import BudgetSelect from '../../shared/components/ui/BudgetSelect';
import RecordHeaderBanner from '../../shared/components/ui/RecordHeaderBanner';
import AlertModal, { AlertType } from '../../shared/components/ui/AlertModal';
import './guesthousebooking.css';

type Gender = 'Male' | 'Female' | 'Others' | '';
type GuestPriority = 'Routine' | 'High' | '';
type RoomType = 'Single' | 'Double' | 'Deluxe';

const createNumericId = () => {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0];
  }

  return Date.now();
};

// Master-data saves use the 1B range to distinguish temporary client IDs from
// database IDs. Keep generated IDs in that range every time; raw random uint32
// values can otherwise fall below the threshold and incorrectly trigger PUT.
const createUnsavedResourceId = () => 1_000_000_000 + (createNumericId() % 1_000_000_000);

const toText = (value: unknown) => (value === null || value === undefined ? '' : String(value));

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

interface BeneficiaryTypeOption {
  value: string;
  label: string;
}

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
const BENEFICIARY_TYPE_SELECT_OPTIONS: BeneficiaryTypeOption[] = BENEFICIARY_TYPE_OPTIONS.map(
  (option) => ({ value: option, label: option }),
);
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
  rooms?: ManagedRoomRow[];
}

type ApiRecord = Record<string, unknown>;
type RoomAllotmentsByGuest = Record<string, RoomAllotmentData>;
type ActiveRoomDetail = { guestId: string; rowId: string } | null;
type ActiveAllotmentDropdown = { guestId: string; rowId: string; field: 'roomType' | 'block' | 'roomNumber' } | null;
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
  facilities: Record<string, boolean>;
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
  id = createNumericId(),
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
  id: createNumericId(),
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

const initialManagedRooms: ManagedRoomRow[] = [];

const initialCareTakers: CareTakerRow[] = [];

const createManagedRoomRow = (): ManagedRoomRow => ({
  id: createUnsavedResourceId(),
  roomType: 'Single',
  block: '',
  floor: '',
  roomNumber: '',
  status: 'Active',
  facilities: {},
});

const createCareTakerRow = (): CareTakerRow => ({
  id: createUnsavedResourceId(),
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
  id: `${roomType}-${createNumericId()}`,
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
    employeeId: read(['employee_id', 'employeeId', 'master_employee_id', 'masterEmployeeId']),
    departmentId: read(['department_id', 'departmentId']),
    name: read(['name', 'full_name', 'fullName']),
    date: read(['request_date', 'requestDate', 'date']) || todayInputValue(),
    department: read(['department', 'department_name', 'departmentName']),
    designation: read(['designation', 'role_name', 'roleName']),
    email: read(['email', 'mail']),
    mobile: read(['mobile', 'phone', 'phone_number', 'phoneNumber', 'contact']),
  };
};

const addRoomOption = (map: Map<string, { numbers: Set<string>; rooms: ManagedRoomRow[] }>, block: string, roomNumber = '') => {
  if (!block) {
    return;
  }

  if (!map.has(block)) {
    map.set(block, { numbers: new Set<string>(), rooms: [] });
  }

  if (roomNumber) {
    map.get(block)?.numbers.add(roomNumber);
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

  const blockMap = new Map<string, { numbers: Set<string>; rooms: ManagedRoomRow[] }>();

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
    const isUnavailable = Boolean(option.is_unavailable || option.isUnavailable);
    if (isUnavailable) return;
    const nestedRooms = readRoomNumbers(option.roomNumbers || option.rooms || option.room_numbers);

    const roomDetails: ManagedRoomRow = {
      id: Number(option.id) || 0,
      roomType: getTextValue(option, ['room_type', 'roomType']) as RoomType,
      block,
      floor: getTextValue(option, ['floor']),
      roomNumber,
      status: getTextValue(option, ['status']) as ManagedRoomStatus,
      facilities: option.facilities && typeof option.facilities === 'object'
        ? option.facilities as Record<string, boolean>
        : {},
    };

    if (nestedRooms.length) {
      nestedRooms.forEach((room) => addRoomOption(blockMap, block, room));
      return;
    }

    addRoomOption(blockMap, block, roomNumber);
    if (roomNumber) {
      const blockRooms = blockMap.get(block) || { numbers: new Set<string>(), rooms: [] };
      blockRooms.rooms.push(roomDetails);
      blockMap.set(block, blockRooms);
    }
  });

  return Array.from(blockMap.entries()).map(([block, rooms]) => ({
    block,
    roomNumbers: Array.from(rooms.numbers),
    rooms: rooms.rooms,
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

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const normalizeCsvHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const downloadCsv = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export interface GuesthousePrintPreviewProps {
  bookingId: number;
  applicant: ApplicantDetails;
  beneficiary: BeneficiaryDetails;
  travel: TravelDetails;
  guests: GuestDetails[];
  foodRows: FoodRequirementRow[];
}

const escapePrintHtml = (value: unknown) => {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
};

const previewValue = (value: unknown) => escapePrintHtml(String(value ?? '').trim());

/** The iframe preview and print output share this standalone, app-independent document. */
export const GuesthousePrintPreview: React.FC<GuesthousePrintPreviewProps> = ({
  bookingId, applicant, beneficiary, travel, guests, foodRows,
}) => {
  const reference = `#GH-${new Date(applicant.date || Date.now()).getFullYear()}-${String(bookingId).padStart(4, '0')}`;
  const totalRooms = guests.reduce((sum, guest) => sum + Number(guest.roomSingle || 0) + Number(guest.roomDouble || 0) + Number(guest.roomDeluxe || 0), 0);
  const totalPeople = guests.reduce((sum, guest) => sum + 1 + Number(guest.accompaniedMale || 0) + Number(guest.accompaniedFemale || 0) + Number(guest.accompaniedChildren || 0), 0);
  const primaryGuest = guests[0];
  const guestAddress = [primaryGuest?.organization, primaryGuest?.city, primaryGuest?.state].filter(Boolean).join(', ');
  const mealTotal = (veg: string, nonVeg: string) => `${veg || 0} / ${nonVeg || 0}`;
  const additionalMembers = Math.max(0, totalPeople - guests.length);
  const vegetarianMembers = guests.reduce((sum, guest) => sum + Number(guest.foodVeg || 0), 0);
  const nonVegetarianMembers = guests.reduce((sum, guest) => sum + Number(guest.foodNonVeg || 0), 0);
  const foodDisplayRows = Math.max(foodRows.length, 5);
  const foodRowHeight = 26.5 / foodDisplayRows;
  const foodFontSize = Math.min(8.4, Math.max(4.5, foodRowHeight * 72 / 25.4 - 3));
  // All template coordinates are authored against the A4 reference image.
  // Keep them in native A4 millimetres; a Letter-to-A4 transform here used to
  // compress the vertical layout twice and leave a large blank area at the foot.
  const referenceX = (millimeters: number) => `${millimeters}mm`;
  const referenceY = (millimeters: number) => `${millimeters}mm`;
  const checkIn = new Date(travel.checkInDate);
  const checkOut = new Date(travel.checkOutDate);
  const stayDays = Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())
    ? ''
    : String(Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000)));
  const tableRows = Array.from({ length: foodDisplayRows }, (_, index) => {
    const row = foodRows[index];
    const meal = (veg?: string, nonVeg?: string) => row ? escapePrintHtml(mealTotal(veg || '', nonVeg || '')) : '';
    return `<tr><td>${row ? previewValue(formatDateForDisplay(row.date)) : ''}</td><td>${row ? previewValue(row.morningRefreshment || '-') : ''}</td><td>${meal(row?.breakfastVeg, row?.breakfastNonVeg)}</td><td>${meal(row?.lunchVeg, row?.lunchNonVeg)}</td><td>${row ? previewValue(row.eveningRefreshment || '-') : ''}</td><td>${meal(row?.dinnerVeg, row?.dinnerNonVeg)}</td></tr>`;
  }).join('');
  const documentMarkup = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guest House Booking</title>
<style>
@page{size:A4 portrait;margin:0}
html,body{width:210mm;height:297mm;margin:0;padding:0;overflow:hidden;background:#fff}
*,*::before,*::after{box-sizing:border-box}
body{font-family:"Arial Narrow","Bahnschrift",Arial,sans-serif;color:#111;font-stretch:condensed;font-variation-settings:"wdth" 75}
.guesthouse-print-form{position:relative;width:210mm;height:297mm;margin:0;background:#fff;font-size:8.4pt;line-height:1.12}
.ghp-header,.ghp-proposal,.ghp-row,.ghp-food-table,.ghp-signatures,.ghp-divider,.ghp-detail-divider,.ghp-incharge-title,.ghp-recommendation,.ghp-room-numbers,.ghp-final-signatures{position:absolute}
.ghp-header{top:${referenceY(10.8)};left:0;width:100%;text-align:center}
.ghp-institution-title{display:block;font-size:12.3pt;font-weight:400;line-height:${referenceY(5)}}
.ghp-booking-title{display:block;margin-top:${referenceY(2.8)};font-size:15.8pt;font-weight:400;line-height:${referenceY(6)}}
.ghp-contact-title{display:block;margin-top:${referenceY(3.4)};font-size:10.8pt;line-height:${referenceY(4.5)}}
.ghp-proposal{top:${referenceY(39.2)};left:${referenceX(24.5)};right:${referenceX(20)};display:flex;align-items:end;justify-content:space-between;height:${referenceY(5)};white-space:nowrap}
.ghp-date-line{display:inline-block;width:${referenceX(43)};margin-left:${referenceX(1.5)};border-bottom:${referenceX(.25)} solid #111}
.ghp-row{left:${referenceX(24.2)};width:${referenceX(166)};display:grid;align-items:end;column-gap:${referenceX(2)};min-width:0}
.ghp-row--institution{top:${referenceY(53.1)};height:${referenceY(5)};grid-template-columns:${referenceX(28)} ${referenceX(63)} ${referenceX(18)} minmax(0,1fr)}
.ghp-row--faculty{top:${referenceY(65.4)};height:${referenceY(5)};grid-template-columns:${referenceX(28)} minmax(0,1fr) ${referenceX(19)} ${referenceX(40)}}
.ghp-row--guest{top:${referenceY(74.6)};height:${referenceY(5)};grid-template-columns:${referenceX(28)} minmax(0,1fr)}
.ghp-row--address{top:${referenceY(83.7)};height:${referenceY(5)};grid-template-columns:${referenceX(27)} minmax(0,1fr)}
.ghp-row--purpose{top:${referenceY(93.8)};height:${referenceY(10)};grid-template-columns:${referenceX(32)} minmax(0,1fr);align-items:start}
.ghp-detail-divider{top:${referenceY(107.8)};left:${referenceX(22.3)};width:${referenceX(169.5)};border-top:${referenceX(1)} dotted #111}
.ghp-row--guests{top:${referenceY(113.5)};height:${referenceY(5)};grid-template-columns:${referenceX(32)} ${referenceX(46)} ${referenceX(27)} minmax(0,1fr)}
.ghp-row--checkin{top:${referenceY(124)};height:${referenceY(5)};grid-template-columns:${referenceX(33)} ${referenceX(9)} ${referenceX(43)} ${referenceX(14)} minmax(0,1fr)}
.ghp-row--checkout{top:${referenceY(134.3)};height:${referenceY(5)};grid-template-columns:${referenceX(33)} ${referenceX(9)} ${referenceX(43)} ${referenceX(14)} minmax(0,1fr)}
.ghp-row--days{top:${referenceY(144.6)};height:${referenceY(5)};grid-template-columns:${referenceX(23)} ${referenceX(26)} ${referenceX(36)} ${referenceX(22)} ${referenceX(22)} ${referenceX(27)}}
.ghp-row--days .ghp-label:nth-child(3){grid-column:4}.ghp-row--days .ghp-label:nth-child(4){grid-column:5}.ghp-row--days .ghp-value:nth-child(5){grid-column:6}
.ghp-row--rooms{top:${referenceY(154.9)};height:${referenceY(5)};grid-template-columns:${referenceX(27)} ${referenceX(24)} ${referenceX(58)} ${referenceX(31)} ${referenceX(18)}}
.ghp-row--rooms .ghp-label:nth-child(3){grid-column:4}.ghp-row--rooms .ghp-value:nth-child(4){grid-column:5}
.ghp-label{min-width:0;font-weight:700;font-size:7.6pt;white-space:nowrap;align-self:center;padding-right:${referenceX(1)}}
.ghp-value{display:flex;min-width:0;min-height:${referenceY(5)};align-items:center;padding:${referenceY(.25)} ${referenceX(1.2)} ${referenceY(.8)};border-bottom:${referenceX(.25)} solid #111;overflow:hidden;white-space:nowrap;text-overflow:clip;font-size:10pt;line-height:1.1}
.ghp-row--institution .ghp-value:last-child{font-size:8pt}
.ghp-row--purpose .ghp-value{white-space:normal;overflow-wrap:anywhere;align-items:flex-start;margin-top:${referenceY(1.2)};min-height:${referenceY(4.5)}}
.ghp-row--guests .ghp-value{min-height:${referenceY(5)};padding-left:${referenceX(1.5)}}
.ghp-food-table{top:${referenceY(165.1)};left:${referenceX(24.2)};width:${referenceX(168.6)};height:${referenceY(43.8)};border-collapse:collapse;table-layout:fixed;text-align:center}
.ghp-food-table th,.ghp-food-table td{border:${referenceX(.25)} solid #111;padding:${referenceY(.5)} ${referenceX(.7)};vertical-align:middle;overflow-wrap:anywhere}
.ghp-food-table thead tr:first-child{height:${referenceY(12)};font-size:11.8pt}.ghp-food-table thead tr:nth-child(2){height:${referenceY(5.3)};font-size:8.9pt}
.ghp-food-table tbody tr{height:${referenceY(foodRowHeight)};font-size:${foodFontSize}pt}
.ghp-food-table col:nth-child(1){width:16.5%}.ghp-food-table col:nth-child(2){width:15.7%}.ghp-food-table col:nth-child(3){width:17.3%}.ghp-food-table col:nth-child(4){width:16.7%}.ghp-food-table col:nth-child(5){width:16.9%}.ghp-food-table col:nth-child(6){width:16.9%}
.ghp-signatures{top:${referenceY(217.5)};left:${referenceX(28.4)};right:${referenceX(32)};display:flex;justify-content:space-between;font-size:8.9pt}
.ghp-divider{top:${referenceY(245.7)};left:${referenceX(27.2)};width:${referenceX(159.5)};border-top:${referenceX(.25)} solid #111}
.ghp-incharge-title{top:${referenceY(253.3)};left:${referenceX(24.2)};width:${referenceX(168.6)};text-align:center;font-size:7.8pt;font-weight:700}
.ghp-recommendation{top:${referenceY(257.3)};left:${referenceX(24.2)};width:${referenceX(168.6)};text-align:center;font-size:11.3pt;font-style:italic}
.ghp-room-numbers{top:${referenceY(263.1)};left:${referenceX(24.2)};width:${referenceX(168.6)};display:flex;justify-content:center;gap:${referenceX(7)};font-size:8.4pt;white-space:nowrap}
.ghp-room-line{display:inline-block;width:${referenceX(30)};border-bottom:${referenceX(.2)} solid #111}
.ghp-final-signatures{top:${referenceY(278.6)};left:${referenceX(65.5)};right:${referenceX(26)};display:flex;justify-content:space-between;font-size:8.4pt}
@media print{html,body{width:210mm;height:297mm;overflow:hidden}.guesthouse-print-form{break-after:avoid;page-break-after:avoid}}
</style></head><body><main class="guesthouse-print-form">
<header class="ghp-header"><span class="ghp-institution-title">KSR EDUCATIONAL INSTITUTIONS, TIRUCHENGODE - 637 215</span><span class="ghp-booking-title">GUEST HOUSE BOOKING</span><span class="ghp-contact-title">GUEST HOUSE - <u>CONTACT NO 97902 65556</u></span></header>
<div class="ghp-proposal"><span>Proposal ID: ${previewValue(reference)}</span><span>Date: <span class="ghp-date-line">${previewValue(formatDateForDisplay(applicant.date))}</span></span></div>
<div class="ghp-row ghp-row--institution"><span class="ghp-label">Name of the Institution:</span><span class="ghp-value">K.S. Rangasamy College of Technology</span><span class="ghp-label">Department:</span><span class="ghp-value">${previewValue(applicant.department)}</span></div>
<div class="ghp-row ghp-row--faculty"><span class="ghp-label">Booking Faculty Name:</span><span class="ghp-value">${previewValue(applicant.name)}</span><span class="ghp-label">Mobile No.:</span><span class="ghp-value">${previewValue(applicant.mobile)}</span></div>
<div class="ghp-row ghp-row--guest"><span class="ghp-label">Name of the Guest:</span><span class="ghp-value">${previewValue(primaryGuest?.name)}</span></div>
<div class="ghp-row ghp-row--address"><span class="ghp-label">Guest Address:</span><span class="ghp-value">${previewValue(guestAddress)}</span></div>
<div class="ghp-row ghp-row--purpose"><span class="ghp-label">Purpose of Visit Details:</span><span class="ghp-value">${previewValue(primaryGuest?.remarks || beneficiary.beneficiaryType)}</span></div><div class="ghp-detail-divider"></div>
<div class="ghp-row ghp-row--guests"><span class="ghp-label">Total Numbers of Guest:</span><span class="ghp-value">${totalPeople}</span><span class="ghp-label">Additional Member:</span><span class="ghp-value">${additionalMembers}</span></div>
<div class="ghp-row ghp-row--checkin"><span class="ghp-label">Accommodation from:</span><span class="ghp-label">Date:</span><span class="ghp-value">${previewValue(formatDateForDisplay(travel.checkInDate))}</span><span class="ghp-label">Time:</span><span class="ghp-value">${previewValue(travel.checkInTime)}</span></div>
<div class="ghp-row ghp-row--checkout"><span class="ghp-label">Leaving Accommodation on:</span><span class="ghp-label">Date:</span><span class="ghp-value">${previewValue(formatDateForDisplay(travel.checkOutDate))}</span><span class="ghp-label">Time:</span><span class="ghp-value">${previewValue(travel.checkOutTime)}</span></div>
<div class="ghp-row ghp-row--days"><span class="ghp-label">Total No. of Days:</span><span class="ghp-value">${stayDays}</span><span class="ghp-label">Boarding Type:</span><span class="ghp-label">Vegetarian No&#8217;s:</span><span class="ghp-value">${vegetarianMembers}</span></div>
<div class="ghp-row ghp-row--rooms"><span class="ghp-label">Total Rooms Needed:</span><span class="ghp-value">${totalRooms}</span><span aria-hidden="true"></span><span class="ghp-label">Non-Vegetarian No&#8217;s:</span><span class="ghp-value">${nonVegetarianMembers}</span></div>
<table class="ghp-food-table"><colgroup>${Array.from({ length: 6 }, () => '<col>').join('')}</colgroup><thead><tr><th></th><th colspan="5">*Food Requirement Total Members*</th></tr><tr><th>Date</th><th>Morning Tea</th><th>Breakfast</th><th>Lunch</th><th>Evening Tea</th><th>Dinner</th></tr></thead><tbody>${tableRows}</tbody></table>
<div class="ghp-signatures"><span>Sig. of Dept. HoD</span><span>Institution&#8217;s Principal Sig.</span></div><div class="ghp-divider"></div><strong class="ghp-incharge-title">TO BE FILLED BY GUEST HOUSE INCHARGE</strong><div class="ghp-recommendation">Recommended / Not Recommended</div>
<div class="ghp-room-numbers"><span>KSR Guest House - Room No. <span class="ghp-room-line"></span></span><span>RR Guest House - Room No. <span class="ghp-room-line"></span></span></div><div class="ghp-final-signatures"><span>Date:</span><span>Sig. of Guest House IC</span></div>
</main></body></html>`;

  return <iframe className="guesthouse-print-document" title="Guest House Booking print document" srcDoc={documentMarkup} onLoad={() => window.parent.postMessage({ type: 'guesthouse-print-document-ready' }, window.location.origin)} style={{ display: 'block', width: '210mm', height: '297mm', maxWidth: 'none', border: 0, margin: '0 auto', background: '#fff' }} />;
};

const GuestHouseBooking: React.FC = () => {
  const isGuesthouseManagementVisible = import.meta.env.VITE_GUESTHOUSE_MANAGEMENT === 'true';
  const { user } = useAuth();
  const ability = useAbility();
  const canManageGuesthouse = Boolean(user && ability.can('manage', 'GuestHouse'));
  const location = useLocation();
  const navigate = useNavigate();
  const { id: bookingIdParam } = useParams<{ id?: string }>();
  const bookingId = Number.parseInt(bookingIdParam || '', 10);
  const hasBookingId = Number.isInteger(bookingId) && bookingId > 0;
  const isEditMode = hasBookingId && location.pathname.endsWith('/edit');
  const isViewingBooking = hasBookingId && !isEditMode;
  const isPrintPreview = new URLSearchParams(location.search).get('preview') === 'true';
  const isManageResourcesView =
    new URLSearchParams(location.search).get('manageResources') === 'true';
  const isApprovalForm = new URLSearchParams(location.search).get('admin') === 'true';
  const isRoomAllotmentLink = new URLSearchParams(location.search).get('allotment') === 'true';
  const isGuesthouseAdmin = getGuesthouseWorkflowStage(user) === 'guesthouse_admin';
  const [adminView, setAdminView] = useState<'booking' | 'allotment'>(() =>
    isRoomAllotmentLink ? 'allotment' : 'booking',
  );
  // Applicants may view an allocation through the dashboard house icon, but only
  // the Guesthouse Admin can edit or submit it.
  const canShowRoomAllocationTab = hasBookingId && (isGuesthouseAdmin || isRoomAllotmentLink);
  const isRoomAllotmentVisible = canShowRoomAllocationTab && adminView === 'allotment';
  const canEditRoomAllotment = hasBookingId && isGuesthouseAdmin && adminView === 'allotment';
  const canOverrideApplicant = !isViewingBooking && Boolean(canManageGuesthouse || (user as any)?.is_super_admin || (user as any)?.isSuperAdmin);
  const [applicantProfile, setApplicantProfile] = useState<ApiRecord | null>(null);
  const [applicantSearch, setApplicantSearch] = useState('');
  const [applicantSearchInitialized, setApplicantSearchInitialized] = useState(false);
  const [applicantResults, setApplicantResults] = useState<ApiRecord[]>([]);
  // New bookings start expanded for data entry; every saved booking (including
  // returned bookings opened in edit mode) starts collapsed.
  const [isApplicantCardOpen, setIsApplicantCardOpen] = useState(() => !hasBookingId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guests, setGuests] = useState<GuestDetails[]>([createGuest(1)]);
  const [travelDetails, setTravelDetails] = useState<TravelDetails>(emptyTravelDetails);
  const [travelDateInputs, setTravelDateInputs] = useState<Record<TravelDateField, string>>({
    checkInDate: '',
    checkOutDate: '',
  });
  const [foodRows, setFoodRows] = useState<FoodRequirementRow[]>([createFoodRow()]);
  const [foodDateInputs, setFoodDateInputs] = useState<Record<number, string>>({});
  const [beneficiaryDetails, setBeneficiaryDetails] = useState<BeneficiaryDetails>({
    beneficiaryType: '',
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
  const [roomFacilityOptions, setRoomFacilityOptions] = useState<ManagedRoomRow[]>([]);
  const [spocOptions, setSpocOptions] = useState<Array<{ name: string; mobile: string }>>([]);
  const [roomAllotments, setRoomAllotments] = useState<RoomAllotmentsByGuest>({});
  const [activeRoomDetail, setActiveRoomDetail] = useState<ActiveRoomDetail>(null);
  const [activeAllotmentDropdown, setActiveAllotmentDropdown] = useState<ActiveAllotmentDropdown>(null);
  const allotmentDropdownRef = useRef<HTMLDivElement | null>(null);
  const [activeCareTakerDropdown, setActiveCareTakerDropdown] = useState<string | null>(null);
  const careTakerDropdownRef = useRef<HTMLDivElement | null>(null);
  const [careTakerDropdownPosition, setCareTakerDropdownPosition] = useState({ top: 0, left: 0, width: 0, openUp: false });
  const [allotmentDropdownPosition, setAllotmentDropdownPosition] = useState({ top: 0, left: 0, width: 0, openUp: false });
  const [managedRooms, setManagedRooms] = useState<ManagedRoomRow[]>(initialManagedRooms);
  const [careTakers, setCareTakers] = useState<CareTakerRow[]>(initialCareTakers);
  const [editingManagedRoomId, setEditingManagedRoomId] = useState<number | null>(null);
  const [viewingManagedRoomId, setViewingManagedRoomId] = useState<number | null>(null);
  const [editingCareTakerId, setEditingCareTakerId] = useState<number | null>(null);
  const roomCsvInputRef = useRef<HTMLInputElement | null>(null);
  const careTakerCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [isSavingAllotments, setIsSavingAllotments] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [bookingWorkflowStatus, setBookingWorkflowStatus] = useState('');
  const [bookingLoadState, setBookingLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    hasBookingId ? 'loading' : 'idle',
  );
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: () => void;
  }>({ show: false, message: '', type: 'info' });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType,
    title?: string,
    onConfirm?: () => void,
  ) => setAlertConfig({ show: true, message, type, title, onConfirm });

  const closeAlert = () => setAlertConfig((previous) => ({ ...previous, show: false }));

  useEffect(() => {
    if (!isManageResourcesView || !isGuesthouseAdmin) return;
    const loadResources = async () => {
      try {
        const [roomsResponse, caretakersResponse]: any = await Promise.all([
          authenticityUtility.get('/guesthouse/admin/rooms'),
          authenticityUtility.get('/guesthouse/admin/caretakers'),
        ]);
        setManagedRooms((roomsResponse?.data || []).map((room: any) => ({ id: room.id, roomType: room.room_type, block: room.block, floor: room.floor || '', roomNumber: room.room_number, status: room.status, facilities: room.facilities && typeof room.facilities === 'object' ? room.facilities : {} })));
        setCareTakers((caretakersResponse?.data || []).map((caretaker: any) => ({ id: caretaker.id, name: caretaker.name, mobile: caretaker.mobile || '', status: caretaker.status })));
      } catch (error) {
        showAlert('Unable to load Guest House resources.', 'error');
      }
    };
    void loadResources();
  }, [isGuesthouseAdmin, isManageResourcesView]);

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
    if (hasBookingId) {
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
  }, [hasBookingId]);

  useEffect(() => {
    if (!hasBookingId) {
      return;
    }

    let isMounted = true;

    const toInputDate = (value: unknown) => {
      if (!value) return '';
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? '' : formatDateInput(value);
      }
      const text = String(value).trim();
      if (!text) return '';
      // Older API responses may serialize MySQL DATE as UTC timestamps. Format
      // those in local time instead of slicing the UTC day, which is previous
      // day in India for a midnight SQL DATE.
      if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
        const parsed = new Date(text);
        return Number.isNaN(parsed.getTime()) ? '' : formatDateInput(parsed);
      }
      return text.slice(0, 10);
    };
    const toText = (value: unknown) => (value === null || value === undefined ? '' : String(value));

    const loadBooking = async () => {
      setBookingLoadState('loading');
      try {
        const response = await authenticityUtility.get(`/guesthouse/${bookingId}`);
        const booking = getPayloadData(response) as ApiRecord | null;
        if (!isMounted) return;
        if (
          !booking ||
          typeof booking !== 'object' ||
          Array.isArray(booking) ||
          Number(booking.id) !== bookingId
        ) {
          setBookingLoadState('error');
          console.error('Guest House detail API returned no matching booking record.', {
            requestedId: bookingId,
            responseKeys: booking && typeof booking === 'object' ? Object.keys(booking) : [],
          });
          showAlert(
            'The Guest House API did not return this booking. Refresh the page or check the request in the server API.',
            'error',
            'Booking Not Loaded',
          );
          return;
        }

        setBookingWorkflowStatus(
          toText(
            (booking as any).workflow_state?.status ||
              (booking as any).workflow_status ||
              (booking as any).overall_status,
          ).toLowerCase(),
        );

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

        const savedAllotments = Array.isArray(booking.roomAllotments) ? booking.roomAllotments : [];
        setRoomAllotments(
          savedAllotments.reduce<RoomAllotmentsByGuest>((next, allotment: any) => {
            const guestId = String(allotment.guest_id);
            next[guestId] = {
              guestId,
              spoc: toText(allotment.spoc),
              mobile: toText(allotment.mobile),
              amenities: (allotment.amenities && typeof allotment.amenities === 'object'
                ? allotment.amenities
                : {}) as Record<GuestAmenityKey, boolean>,
              rows: (Array.isArray(allotment.rooms) ? allotment.rooms : []).map((room: any) => ({
                id: String(room.id),
                roomType: room.room_type as RoomType,
                block: toText(room.block),
                roomNumber: toText(room.room_number),
                occupants: String(Array.isArray(room.occupants) ? room.occupants.length : 0),
                remarks: toText(room.remarks),
              })),
            };
            return next;
          }, {}),
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

        const missingSections = [
          !(toText(booking.beneficiary_type).trim() && toText(booking.beneficiary_value).trim())
            ? 'beneficiary'
            : '',
          !bookingGuests.length || !bookingGuests.some((guest: any) => toText(guest?.name).trim())
            ? 'guest details'
            : '',
          !(booking.check_in_date && booking.check_out_date)
            ? 'travel dates'
            : '',
        ].filter(Boolean);
        if (missingSections.length) {
          console.warn('Guest House booking is missing saved form details:', {
            bookingId,
            missingSections,
          });
          showAlert(
            `This request loaded, but saved ${missingSections.join(', ')} are missing. The request may have been created without these details.`,
            'warning',
            'Incomplete Guest House Request',
          );
        }
        setBookingLoadState('loaded');
      } catch (error) {
        console.error('Failed to load guesthouse booking:', error);
        if (isMounted) {
          setBookingLoadState('error');
          const apiMessage = (error as any)?.response?.data?.message || (error as Error)?.message;
          showAlert(
            apiMessage
              ? `Unable to load this Guest House booking: ${apiMessage}`
              : 'Unable to load this Guest House booking. Check the GET /api/guesthouse/' + bookingId + ' response in the browser Network tab.',
            'error',
            'Booking Load Failed',
          );
        }
      }
    };

    void loadBooking();
    return () => {
      isMounted = false;
    };
  }, [bookingId, hasBookingId]);


  useEffect(() => {
    if (!isRoomAllotmentVisible) return;
    let isMounted = true;

    const loadRoomOptions = async () => {
      try {
        const params = new URLSearchParams();
        if (travelDetails.checkInDate) params.set('checkInDate', travelDetails.checkInDate);
        if (travelDetails.checkInTime) params.set('checkInTime', travelDetails.checkInTime);
        if (travelDetails.checkOutDate) params.set('checkOutDate', travelDetails.checkOutDate);
        if (travelDetails.checkOutTime) params.set('checkOutTime', travelDetails.checkOutTime);
        if (bookingId) params.set('bookingId', String(bookingId));
        const query = params.toString();
        const response = await authenticityUtility.get(`/guesthouse/room-options${query ? `?${query}` : ''}`);
        const options = normalizeRoomBlockOptions(response);

        if (isMounted && options.length) {
          setRoomBlockOptions(options);
          setRoomFacilityOptions(options.flatMap((option) => option.rooms || []));
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
  }, [isRoomAllotmentVisible, travelDetails.checkInDate, travelDetails.checkInTime, travelDetails.checkOutDate, travelDetails.checkOutTime, bookingId]);

  useEffect(() => {
    if (!isRoomAllotmentVisible) return;
    let isMounted = true;

    const loadSpocOptions = async () => {
      try {
        const response = await authenticityUtility.get('/guesthouse/spocs');
        const payload = getPayloadData(response);
        const options = (Array.isArray(payload) ? payload : [])
          .map((caretaker: any) => ({
            name: toText(caretaker.name),
            mobile: toText(caretaker.mobile),
          }))
          .filter((caretaker: { name: string }) => Boolean(caretaker.name));

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
    // Wait for the saved booking data before reconciling dates. Otherwise this
    // effect can run with the new travel dates and the initial blank food row,
    // replacing the meal counts loaded by loadBooking.
    if (hasBookingId && bookingLoadState !== 'loaded') return;

    const stayDates = buildStayDates(travelDetails.checkInDate, travelDetails.checkOutDate);

    if (!stayDates.length) {
      setFoodRows((prevRows) => prevRows.length ? prevRows : [createFoodRow()]);
      return;
    }

    setFoodRows((prevRows) => {
      const unmatchedRows = [...prevRows];
      const alignedRows = stayDates.map((date) => {
        // Exact dates win. If a saved row is outside the stay, pair it with
        // the next unfilled stay date so its meal counts remain attached to
        // the booking instead of appearing on a separate, stale date.
        const exactIndex = unmatchedRows.findIndex((row) => row.date === date);
        const rowIndex = exactIndex >= 0
          ? exactIndex
          : unmatchedRows.findIndex((row) => Boolean(row.date));
        if (rowIndex < 0) return createFoodRow(date);

        const [existingRow] = unmatchedRows.splice(rowIndex, 1);
        return { ...existingRow, date };
      });

      // If there are more saved rows than stay dates, keep extras visible so
      // they can be reviewed and corrected rather than silently discarded.
      return [...alignedRows, ...unmatchedRows];
    });
  }, [bookingId, bookingLoadState, hasBookingId, travelDetails.checkInDate, travelDetails.checkOutDate]);

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
    setBeneficiaryDetails((prev) => {
      if (field === 'beneficiaryType') {
        return { ...prev, beneficiaryType: value, staffName: '', departmentId: '' };
      }

      return {
        ...prev,
        [field]: value,
        ...(field === 'staffName' ? { departmentId: '' } : {}),
      };
    });
  };

  useEffect(() => {
    const loadBeneficiaryEntities = async () => {
      try {
        const [response, departmentResponse] = (await Promise.all([
          authenticityUtility.get('/budget/org-units'),
          authenticityUtility.get('/budget/org-units/Department'),
        ])) as any[];
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
        // Department beneficiary ids must come from master_departments. The
        // aggregate org-units endpoint may also contain entities named Department.
        const departments = departmentResponse?.data?.data;
        if (Array.isArray(departments)) {
          options.DEPARTMENT = departments
            .map((row: any) => ({
              id: String(row?.id || row?.department_id || ''),
              name: String(row?.name || row?.label || '').trim(),
            }))
            .filter((option) => option.id && option.name);
        }
        setBeneficiaryEntityOptions(options);
      } catch (error) {
        console.error('Failed to load guesthouse beneficiary options:', error);
      }
    };

    loadBeneficiaryEntities();
  }, []);

  useEffect(() => {
    if (isViewingBooking) {
      setBeneficiaryEmployeeOptions([]);
      setBeneficiarySearchOpen(false);
      return;
    }
    if (!['Faculty', 'Staff'].includes(beneficiaryDetails.beneficiaryType)) return;
    const query = beneficiaryDetails.staffName.trim();
    // Once an employee has been picked, do not run a new search for the selected
    // name; otherwise the same employee appears again as a duplicate suggestion.
    if (!beneficiarySearchOpen) {
      setBeneficiaryEmployeeOptions([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const loadEmployees = async () => {
      try {
        const type = beneficiaryDetails.beneficiaryType === 'Faculty' ? 'Teaching' : 'Non-Teaching';
        const response = (await authenticityUtility.get(
          `/budget/search-applicant?q=${encodeURIComponent(query || 'a')}&type=${type}`,
          { signal: controller.signal },
        )) as any;
        if (!cancelled) {
          setBeneficiaryEmployeeOptions(Array.isArray(response?.data) ? response.data : []);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Failed to load beneficiary employees:', error);
        if (!cancelled) setBeneficiaryEmployeeOptions([]);
      }
    };

    const timeoutId = window.setTimeout(() => void loadEmployees(), 300);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    beneficiaryDetails.beneficiaryType,
    beneficiaryDetails.staffName,
    beneficiarySearchOpen,
    isViewingBooking,
  ]);

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

  const saveAllotmentSchedule = async (changes: Partial<TravelDetails>) => {
    if (!hasBookingId) return;
    const schedule = { ...travelDetails, ...changes };
    try {
      await authenticityUtility.patch(`/guesthouse/${bookingId}/travel-schedule`, schedule);
    } catch (error) {
      showAlert((error as any)?.response?.data?.message || 'Unable to update the travel schedule.', 'error');
    }
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

  const getAssignedRoomNumbers = (exceptGuestId: string, exceptRowId: string) => {
    const assigned = new Set<string>();
    Object.entries(roomAllotments).forEach(([guestId, allotment]) => {
      allotment.rows.forEach((row) => {
        if (guestId === exceptGuestId && row.id === exceptRowId) return;
        if (row.block && row.roomNumber) {
          assigned.add(`${row.block.trim().toLowerCase()}::${row.roomNumber.trim().toLowerCase()}`);
        }
      });
    });
    return assigned;
  };

  const getRoomNumberOptions = (guestId: string, rowId: string, block: string, selectedRoom: string) => {
    const roomNumbers = getRoomNumbersForBlock(block);
    const assignedRooms = getAssignedRoomNumbers(guestId, rowId);
    return roomNumbers.filter((roomNumber) =>
      !assignedRooms.has(`${block.trim().toLowerCase()}::${roomNumber.trim().toLowerCase()}`)
      || roomNumber === selectedRoom,
    );
  };

  const openAllotmentDropdown = (
    event: React.MouseEvent<HTMLButtonElement>,
    guestId: string,
    rowId: string,
    field: 'roomType' | 'block' | 'roomNumber',
    disabled = false,
  ) => {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 220;
    const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight;
    setAllotmentDropdownPosition({
      top: openUp ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - rect.width - 8),
      width: rect.width,
      openUp,
    });
    setActiveAllotmentDropdown((active) =>
      active?.guestId === guestId && active.rowId === rowId && active.field === field
        ? null
        : { guestId, rowId, field },
    );
  };

  useEffect(() => {
    if (!activeAllotmentDropdown) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (allotmentDropdownRef.current?.contains(event.target as Node)) return;
      if ((event.target as Element | null)?.closest?.('[data-allotment-dropdown-trigger="true"]')) return;
      setActiveAllotmentDropdown(null);
    };
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveAllotmentDropdown(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [activeAllotmentDropdown]);

  useEffect(() => {
    if (!activeCareTakerDropdown) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (careTakerDropdownRef.current?.contains(event.target as Node)) return;
      if ((event.target as Element | null)?.closest?.('[data-caretaker-dropdown-trigger="true"]')) return;
      setActiveCareTakerDropdown(null);
    };
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveCareTakerDropdown(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [activeCareTakerDropdown]);

  const toggleCareTakerDropdown = (event: React.MouseEvent<HTMLButtonElement>, guestId: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = Math.min(300, (spocOptions.length + 1) * 42 + 12, window.innerHeight - 16);
    const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight;
    setCareTakerDropdownPosition({
      top: openUp ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - rect.width - 8),
      width: rect.width,
      openUp,
    });
    setActiveCareTakerDropdown((active) => active === guestId ? null : guestId);
  };

  const chooseCareTaker = (guestId: string, name: string) => {
    const selected = spocOptions.find((spoc) => spoc.name === name);
    updateAllotmentContact(guestId, 'spoc', name);
    updateAllotmentContact(guestId, 'mobile', selected?.mobile || '');
    setActiveCareTakerDropdown(null);
  };

  const renderAllotmentDropdown = (
    guestId: string,
    row: RoomAllotmentRow,
    field: 'roomType' | 'block' | 'roomNumber',
    disabled = false,
  ) => {
    const active = activeAllotmentDropdown?.guestId === guestId &&
      activeAllotmentDropdown.rowId === row.id && activeAllotmentDropdown.field === field;
    const value = row[field];
    const placeholder = field === 'roomNumber' ? 'Select room' : field === 'block' ? 'Select block' : 'Select type';

    return (
      <button
        type="button"
        className={`guesthousebooking-food-date guesthousebooking-allotment-compact-control guesthousebooking-allotment-dropdown-trigger${active ? ' is-open' : ''}`}
        onClick={(event) => openAllotmentDropdown(event, guestId, row.id, field, disabled)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={active}
        data-allotment-dropdown-trigger="true"
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    );
  };

  const activeDropdownGuest = activeAllotmentDropdown
    ? roomAllotments[activeAllotmentDropdown.guestId]
    : undefined;
  const activeDropdownRow = activeDropdownGuest?.rows.find((row) => row.id === activeAllotmentDropdown?.rowId);
  const activeDropdownOptions = activeAllotmentDropdown && activeDropdownRow
    ? activeAllotmentDropdown.field === 'roomType'
      ? ROOM_REQUIREMENT_CONFIG.map((option) => option.roomType)
      : activeAllotmentDropdown.field === 'block'
        ? roomBlockOptions.map((option) => option.block)
        : getRoomNumberOptions(activeAllotmentDropdown.guestId, activeDropdownRow.id, activeDropdownRow.block, activeDropdownRow.roomNumber)
    : [];

  const chooseActiveAllotmentOption = (value: string) => {
    if (!activeAllotmentDropdown || !activeDropdownRow) return;
    if (activeAllotmentDropdown.field === 'block') {
      updateAllotmentBlock(activeAllotmentDropdown.guestId, activeDropdownRow.id, value);
    } else {
      updateAllotmentRow(activeAllotmentDropdown.guestId, activeDropdownRow.id, activeAllotmentDropdown.field, value);
    }
    setActiveAllotmentDropdown(null);
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

      if (field === 'roomNumber' && value) {
        const normalizedRoom = `${allotment.rows.find((row) => row.id === rowId)?.block || ''}::${value}`.trim().toLowerCase();
        const duplicate = Object.entries(prevAllotments).some(([otherGuestId, otherAllotment]) =>
          otherAllotment.rows.some((row) => {
            if (otherGuestId === guestId && row.id === rowId) return false;
            return row.block && row.roomNumber && `${row.block}::${row.roomNumber}`.trim().toLowerCase() === normalizedRoom;
          }),
        );
        if (duplicate) {
          showAlert('This room is already assigned to another person in this booking. Choose a different room.', 'warning', 'Room Already Assigned');
          return prevAllotments;
        }
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

  const updateManagedRoom = (id: number, field: keyof Omit<ManagedRoomRow, 'id'>, value: string) => {
    setManagedRooms((prevRooms) =>
      prevRooms.map((room) => (room.id === id
        ? field === 'facilities'
          ? { ...room, facilities: { ...room.facilities, [value]: !room.facilities[value] } }
          : { ...room, [field]: value }
        : room)),
    );
  };

  const addManagedRoom = () => {
    const currentlyEditedRoom = managedRooms.find((room) => room.id === editingManagedRoomId);
    if (currentlyEditedRoom) {
      // The Add Room button should keep working while an existing row is being
      // edited. Save that row first, then open the next draft only on success.
      void saveManagedRoom(currentlyEditedRoom).then((saved) => {
        if (saved) addManagedRoomRow();
      });
      return;
    }
    addManagedRoomRow();
  };

  const addManagedRoomRow = () => {
    const room = createManagedRoomRow();
    setManagedRooms((prevRooms) => [...prevRooms, room]);
    setEditingManagedRoomId(room.id);
    setViewingManagedRoomId(room.id);
  };

  const saveManagedRoom = async (room: ManagedRoomRow) => {
    if (!room.block.trim() || !room.floor.trim() || !room.roomNumber.trim()) {
      showAlert('Block, floor, and room number are required.', 'warning');
      return false;
    }

    try {
      const payload = {
        roomType: room.roomType,
        block: room.block.trim(),
        floor: room.floor.trim(),
        roomNumber: room.roomNumber.trim(),
        status: room.status,
        facilities: room.facilities,
      };
      const isNewRoom = room.id >= 1_000_000_000;
      const response: any = isNewRoom
        ? await authenticityUtility.post('/guesthouse/admin/rooms', payload)
        : await authenticityUtility.put(`/guesthouse/admin/rooms/${room.id}`, payload);
      if (response?.success !== true) {
        throw new Error(response?.message || 'The server did not confirm saving this room.');
      }
      const savedId = isNewRoom ? Number(response?.data?.id) : room.id;
      if (!Number.isInteger(savedId) || savedId <= 0 || savedId >= 1_000_000_000) {
        throw new Error('The server did not return a valid saved room ID.');
      }

      setManagedRooms((prevRooms) =>
        prevRooms.map((currentRoom) =>
          currentRoom.id === room.id ? { ...currentRoom, id: savedId } : currentRoom,
        ),
      );
      setRoomFacilityOptions((previous) => [
        ...previous.filter((item) => !(item.block === room.block && item.roomNumber === room.roomNumber)),
        { ...room, id: savedId },
      ]);
      setEditingManagedRoomId(null);
      setViewingManagedRoomId(savedId);
      showAlert(isNewRoom ? 'Room added successfully.' : 'Room updated successfully.', 'success');
      return true;
    } catch (error) {
      console.error('Unable to save room:', error);
      const message = (error as any)?.response?.data?.message || (error as Error)?.message;
      showAlert(message || 'Unable to save room. Check that the room number is unique.', 'error');
      return false;
    }
  };

  const removeManagedRoom = async (id: number) => {
    try {
      // Rows loaded from the API have database ids. A newly added, unsaved row
      // only exists in the browser and can simply be removed locally.
      if (id < 1_000_000_000) {
        await authenticityUtility.delete(`/guesthouse/admin/rooms/${id}`);
      }
      setManagedRooms((prevRooms) => prevRooms.filter((room) => room.id !== id));
      setEditingManagedRoomId((currentId) => (currentId === id ? null : currentId));
      setViewingManagedRoomId((currentId) => (currentId === id ? null : currentId));
      showAlert('Room deleted successfully.', 'success');
    } catch (error) {
      console.error('Unable to delete room:', error);
      showAlert('Unable to delete room. Please try again.', 'error');
    }
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
    const currentlyEditedCareTaker = careTakers.find(
      (careTaker) => careTaker.id === editingCareTakerId,
    );
    if (currentlyEditedCareTaker) {
      void saveCareTaker(currentlyEditedCareTaker).then((saved) => {
        if (saved) addCareTakerRow();
      });
      return;
    }
    addCareTakerRow();
  };

  const addCareTakerRow = () => {
    const careTaker = createCareTakerRow();
    setCareTakers((prevCareTakers) => [...prevCareTakers, careTaker]);
    setEditingCareTakerId(careTaker.id);
  };

  const saveCareTaker = async (careTaker: CareTakerRow) => {
    if (!careTaker.name.trim() || !careTaker.mobile.trim()) {
      showAlert('Care taker name and mobile number are required.', 'warning');
      return false;
    }

    try {
      const payload = {
        name: careTaker.name.trim(),
        mobile: careTaker.mobile.trim(),
        status: careTaker.status,
      };
      const isNewCareTaker = careTaker.id >= 1_000_000_000;
      const response: any = isNewCareTaker
        ? await authenticityUtility.post('/guesthouse/admin/caretakers', payload)
        : await authenticityUtility.put(`/guesthouse/admin/caretakers/${careTaker.id}`, payload);
      if (response?.success !== true) {
        throw new Error(response?.message || 'The server did not confirm saving this care taker.');
      }
      const savedId = isNewCareTaker ? Number(response?.data?.id) : careTaker.id;
      if (!Number.isInteger(savedId) || savedId <= 0 || savedId >= 1_000_000_000) {
        throw new Error('The server did not return a valid saved care taker ID.');
      }

      setCareTakers((prevCareTakers) =>
        prevCareTakers.map((currentCareTaker) =>
          currentCareTaker.id === careTaker.id ? { ...currentCareTaker, id: savedId } : currentCareTaker,
        ),
      );
      setEditingCareTakerId(null);
      showAlert(isNewCareTaker ? 'Care taker added successfully.' : 'Care taker updated successfully.', 'success');
      return true;
    } catch (error) {
      console.error('Unable to save care taker:', error);
      const message = (error as any)?.response?.data?.message || (error as Error)?.message;
      showAlert(message || 'Unable to save care taker.', 'error');
      return false;
    }
  };

  const removeCareTaker = async (id: number) => {
    try {
      if (id < 1_000_000_000) {
        await authenticityUtility.delete(`/guesthouse/admin/caretakers/${id}`);
      }
      setCareTakers((prevCareTakers) =>
        prevCareTakers.filter((careTaker) => careTaker.id !== id),
      );
      setEditingCareTakerId((currentId) => (currentId === id ? null : currentId));
      showAlert('Care taker deleted successfully.', 'success');
    } catch (error) {
      console.error('Unable to delete care taker:', error);
      showAlert('Unable to delete care taker. Please try again.', 'error');
    }
  };

  const importResourceCsv = async (event: React.ChangeEvent<HTMLInputElement>, type: 'rooms' | 'caretakers') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      showAlert('Please upload a CSV file. In Excel, use Save As and select CSV UTF-8.', 'warning');
      return;
    }

    const rows = parseCsv(await file.text());
    const [headerRow, ...dataRows] = rows;
    const headers = (headerRow || []).map(normalizeCsvHeader);
    const read = (row: string[], names: string[]) => {
      const column = headers.findIndex((header) => names.includes(header));
      return column >= 0 ? String(row[column] || '').trim() : '';
    };

    if (type === 'rooms') {
      const required = ['roomtype', 'block', 'floor', 'roomnumber', 'status'];
      if (!required.every((header) => headers.includes(header))) {
        showAlert('Room CSV must include: Room Type, Block, Floor, Room Number, Status.', 'warning');
        return;
      }
      const imported = dataRows.flatMap((row) => {
        const roomType = read(row, ['roomtype']).toLowerCase();
        const status = read(row, ['status']).toLowerCase();
        if (!['single', 'double', 'deluxe'].includes(roomType) || !['active', 'maintenance'].includes(status)) return [];
        return [{
          id: createNumericId(),
          roomType: `${roomType[0].toUpperCase()}${roomType.slice(1)}` as RoomType,
          block: read(row, ['block']),
          floor: read(row, ['floor']),
          roomNumber: read(row, ['roomnumber', 'roomno']),
          status: `${status[0].toUpperCase()}${status.slice(1)}` as ManagedRoomStatus,
          facilities: {},
        }];
      });
      if (imported.length === 0) {
        showAlert('Add at least one valid room row to import.', 'warning');
        return;
      }
      await authenticityUtility.post('/guesthouse/admin/resources/bulk-import', { type: 'rooms', rows: imported });
      const saved: any = await authenticityUtility.get('/guesthouse/admin/rooms');
      setManagedRooms((saved?.data || []).map((room: any) => ({ id: room.id, roomType: room.room_type, block: room.block, floor: room.floor || '', roomNumber: room.room_number, status: room.status, facilities: room.facilities || {} })));
      showAlert(`${imported.length} rooms saved. Re-uploading this CSV updates the same rooms without duplicates.`, 'success');
      return;
    }

    const required = ['caretakername', 'mobilenumber', 'status'];
    if (!required.every((header) => headers.includes(header))) {
      showAlert('Care taker CSV must include: Care Taker Name, Mobile Number, Status.', 'warning');
      return;
    }
    const imported = dataRows.flatMap((row) => {
      const name = read(row, ['caretakername', 'name']);
      const mobile = read(row, ['mobilenumber', 'mobile', 'phone']);
      const status = read(row, ['status']).toLowerCase();
      if (!name || !mobile || !['active', 'leave'].includes(status)) return [];
      return [{
        id: createNumericId(),
        name,
        mobile,
        status: `${status[0].toUpperCase()}${status.slice(1)}` as CareTakerStatus,
      }];
    });
    if (imported.length === 0) {
      showAlert('Add at least one valid care taker row to import.', 'warning');
      return;
    }
    await authenticityUtility.post('/guesthouse/admin/resources/bulk-import', { type: 'caretakers', rows: imported });
    const saved: any = await authenticityUtility.get('/guesthouse/admin/caretakers');
    setCareTakers((saved?.data || []).map((caretaker: any) => ({ id: caretaker.id, name: caretaker.name, mobile: caretaker.mobile || '', status: caretaker.status })));
    showAlert(`${imported.length} care takers saved. Re-uploading this CSV updates the same care takers without duplicates.`, 'success');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) return;

    // Validate checkout is after checkin
    const start = buildTravelDateTime(travelDetails.checkInDate, travelDetails.checkInTime);
    const end = buildTravelDateTime(travelDetails.checkOutDate, travelDetails.checkOutTime);

    if (start && end && end <= start) {
      showAlert('Check-out date/time must be after check-in date/time.', 'warning');
      return;
    }

    if (!applicantUiDetails.name || !beneficiaryDetails.beneficiaryType || !beneficiaryDetails.staffName) {
      showAlert('Applicant and beneficiary details are required.', 'warning');
      return;
    }

    if (!travelDetails.checkInDate || !travelDetails.checkOutDate || !travelDetails.checkInTime || !travelDetails.checkOutTime) {
      showAlert('Check-in and check-out date and time are required.', 'warning');
      return;
    }

    if (guests.some((guest) => !guest.name.trim())) {
      showAlert('Enter a name for every guest.', 'warning');
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
      setIsSubmitting(true);
      const response = (await (isEditMode
        ? authenticityUtility.put(`/guesthouse/${bookingId}`, payload)
        : authenticityUtility.post('/guesthouse', payload))) as any;
      if (!response?.success) {
        throw new Error(response?.message || 'Guest House booking save failed');
      }
      if (isEditMode) {
        showAlert('Guest House updated successfully!', 'success', 'Success');
      } else {
        const savedBookingId = Number(
          response?.data?.id || response?.data?.booking_id || response?.data?.bookingId,
        );
        const parsedReferenceYear = new Date(applicantUiDetails.date || Date.now()).getFullYear();
        const referenceYear = Number.isFinite(parsedReferenceYear)
          ? parsedReferenceYear
          : new Date().getFullYear();
        const bookingReference = Number.isInteger(savedBookingId) && savedBookingId > 0
          ? `#GH-${referenceYear}-${String(savedBookingId).padStart(4, '0')}`
          : null;
        showAlert(
          <>
            Guest House submitted successfully!
            {bookingReference && (
              <>
                <br />
                Reference No.: <strong>{bookingReference}</strong>
              </>
            )}
          </>,
          'success',
          'Success',
          () => {
            closeAlert();
            navigate('/guesthouse-dashboard', { replace: true });
          },
        );
      }
    } catch (error: any) {
      console.error('Guesthouse booking submission failed:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unable to save Guest House booking.';
      showAlert(errorMessage, 'error', 'Booking Not Saved');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRoomAllotments = async () => {
    if (!canEditRoomAllotment || isSavingAllotments) return;
    try {
      setIsSavingAllotments(true);
      await authenticityUtility.put(`/guesthouse/${bookingId}/room-allotments`, {
        allotments: guests.map((guest) => {
          const allocation = roomAllotments[String(guest.id)] || createRoomAllotmentData(String(guest.id), guest);
          return {
            guestId: guest.id,
            spoc: allocation.spoc,
            mobile: allocation.mobile,
            amenities: allocation.amenities,
            rows: allocation.rows.map((row) => ({
              ...row,
              occupantNames: Array.from(
                { length: Math.max(0, Number.parseInt(row.occupants, 10) || 0) },
                () => guest.name || 'Guest',
              ),
            })),
          };
        }),
      });
      showAlert('Room allocation saved successfully.', 'success');
    } catch (error: any) {
      console.error('Failed to save room allocation', error);
      showAlert(error?.response?.data?.message || error?.message || 'Unable to save room allocation.', 'error');
    } finally {
      setIsSavingAllotments(false);
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
      <input className="guesthousebooking-time-input" type="time" step={60} value={travelDetails[field]} onChange={(event) => updateTravelDetails(field, event.target.value)} title="Select time" aria-label={`${label} time`} required />
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

  const renderRoomDetailItem = (item: RoomDetailOption, facilities: Record<string, boolean>) => {
    const Icon = item.Icon;

    return (
      <label className="guesthousebooking-room-detail-item" key={item.label}>
        <input
          className="guesthousebooking-checkbox guesthousebooking-room-detail-checkbox"
          type="checkbox"
          checked={Boolean(facilities[item.label])}
          readOnly
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
    const savedRoom = roomFacilityOptions.find((room) =>
      room.block === row.block && room.roomNumber === row.roomNumber,
    );
    const facilities = savedRoom?.facilities || {};
    const roomFloor = savedRoom?.floor || '';
    const visibleAmenityGroups = ROOM_DETAIL_AMENITY_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => Boolean(facilities[item.label])),
      }))
      .filter((group) => group.items.length > 0);
    const visibleEssentials = ROOM_DETAIL_ESSENTIALS.filter((item) => Boolean(facilities[item.label]));
    const visibleServices = ROOM_DETAIL_SERVICES.filter((item) => Boolean(facilities[item.label]));
    const hasFacilities = visibleAmenityGroups.length > 0 || visibleEssentials.length > 0 || visibleServices.length > 0;

    return (
      <div className="guesthousebooking-room-details-card" id={`room-details-${row.id}`}>
        <div className="guesthousebooking-room-details-header">
          <span>Room Details</span>
        </div>

        <div className="guesthousebooking-room-details-content">
          <div className="guesthousebooking-room-details-meta-row">
            {renderRoomDetailControl('Number', row.roomNumber)}
            {renderRoomDetailControl('Type', row.roomType, true)}
            {renderRoomDetailControl('Floor', roomFloor, true)}
            {renderRoomDetailControl('Block', row.block, true)}
            {renderRoomDetailControl('Status', status, true)}
            <CircleCheck className="guesthousebooking-room-detail-ready-icon" size={18} aria-hidden="true" />
          </div>

          {hasFacilities ? (
            <>
              {visibleAmenityGroups.length > 0 && (
                <section className="guesthousebooking-room-detail-section" aria-label="Amenities">
                  {renderRoomDetailSectionTitle('Amenities')}
                  <div className="guesthousebooking-room-detail-groups">
                    {visibleAmenityGroups.map((group) => (
                      <div className="guesthousebooking-room-detail-group" key={group.title}>
                        <h3>{group.title}</h3>
                        <div className="guesthousebooking-room-detail-group-items">
                          {group.items.map((item) => renderRoomDetailItem(item, facilities))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {visibleEssentials.length > 0 && (
                <section className="guesthousebooking-room-detail-section" aria-label="Essentials">
                  {renderRoomDetailSectionTitle('Essentials')}
                  <div className="guesthousebooking-room-detail-flat-list">
                    {visibleEssentials.map((item) => renderRoomDetailItem(item, facilities))}
                  </div>
                </section>
              )}

              {visibleServices.length > 0 && (
                <section className="guesthousebooking-room-detail-section" aria-label="Services">
                  {renderRoomDetailSectionTitle('Services')}
                  <div className="guesthousebooking-room-detail-flat-list guesthousebooking-room-detail-services-list">
                    {visibleServices.map((item) => renderRoomDetailItem(item, facilities))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <p className="guesthousebooking-room-detail-empty">No facilities have been listed for this room.</p>
          )}
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
    onSave: () => void,
    showAdd = true,
  ) => (
    <div className="guesthousebooking-management-actions">
      <button
        className="guesthousebooking-management-icon-button"
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        disabled={isEditing}
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
      <button
        className="guesthousebooking-management-icon-button guesthousebooking-management-icon-button--save"
        type="button"
        onClick={onSave}
        aria-label={`Save ${label}`}
        title={`Save ${label}`}
        disabled={!isEditing}
      >
        <Check size={16} />
      </button>
      {showAdd && (
        <button
          className="guesthousebooking-management-icon-button guesthousebooking-management-icon-button--add"
          type="button"
          onClick={onAdd}
          aria-label={isEditing ? `Save ${label} and add another` : `Add another ${label}`}
          title={isEditing ? `Save ${label} and add another` : `Add another ${label}`}
        >
          <PlusCircle size={16} />
        </button>
      )}
    </div>
  );

  const renderCareTakerManagementActions = (
    onAdd: () => void,
    onEdit: () => void,
    onDelete: () => void,
    deleteDisabled: boolean,
    isEditing: boolean,
    label: string,
    onSave: () => void,
    showAdd = true,
  ) => (
    <div className="guesthousebooking-management-actions guesthousebooking-management-actions--compact">
      <button
        className="guesthousebooking-management-icon-button"
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        disabled={isEditing}
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
      <button
        className="guesthousebooking-management-icon-button guesthousebooking-management-icon-button--save"
        type="button"
        onClick={onSave}
        aria-label={`Save ${label}`}
        title={`Save ${label}`}
        disabled={!isEditing}
      >
        <Check size={16} />
      </button>
      {showAdd && (
        <button
          className="guesthousebooking-management-icon-button guesthousebooking-management-icon-button--add"
          type="button"
          onClick={onAdd}
          aria-label={isEditing ? `Save ${label} and add another` : `Add another ${label}`}
          title={isEditing ? `Save ${label} and add another` : `Add another ${label}`}
        >
          <PlusCircle size={16} />
        </button>
      )}
    </div>
  );
  const renderGuesthouseAdminManagement = () => (
    <section className="guesthousebooking-card guesthousebooking-management-card">
      <input
        ref={roomCsvInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(event) => void importResourceCsv(event, 'rooms')}
      />
      <input
        ref={careTakerCsvInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(event) => void importResourceCsv(event, 'caretakers')}
      />
      <div className="guesthousebooking-management-panel">
        <div className="guesthousebooking-management-title">Room Management</div>
        <div className="guesthousebooking-resource-import-toolbar">
          <div className="guesthousebooking-csv-actions">
            <button type="button" onClick={addManagedRoom}>
              <PlusCircle size={14} /> Add Room
            </button>
            <button
              type="button"
              onClick={() => downloadCsv('room-management-template.csv', 'Room Type,Block,Floor,Room Number,Status\nSingle,Tangore,Ground,T001,Active\n')}
            >
              <Download size={14} /> Sample CSV
            </button>
            <button type="button" onClick={() => roomCsvInputRef.current?.click()}>
              <Upload size={14} /> Import CSV
            </button>
          </div>
        </div>
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
                  <React.Fragment key={room.id}>
                  <tr className={isViewing ? 'is-viewing' : ''}>
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
                        placeholder="Required"
                        autoFocus={isEditing && room.id >= 1_000_000_000}
                        aria-required="true"
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
                        () => {
                          setEditingManagedRoomId(room.id);
                          setViewingManagedRoomId(room.id);
                        },
                        () => {
                          setViewingManagedRoomId((currentId) => currentId === room.id ? null : room.id);
                          if (editingManagedRoomId !== room.id) setEditingManagedRoomId(null);
                        },
                        () => void removeManagedRoom(room.id),
                        false,
                        isEditing,
                        isViewing,
                        'room',
                        () => void saveManagedRoom(room),
                        index === managedRooms.length - 1,
                      )}
                    </td>
                  </tr>
                  {isViewing && (
                    <tr>
                      <td colSpan={7}>
                        <div className="guesthousebooking-room-details-card">
                          <div className="guesthousebooking-room-details-header"><span>Room Details</span></div>
                          <div className="guesthousebooking-room-details-content">
                            <div className="guesthousebooking-room-details-meta-row">
                              {renderRoomDetailControl('Number', room.roomNumber)}
                              {renderRoomDetailControl('Type', room.roomType, true)}
                              {renderRoomDetailControl('Floor', room.floor, true)}
                              {renderRoomDetailControl('Block', room.block, true)}
                              {renderRoomDetailControl('Status', room.status, true)}
                            </div>
                            {[...ROOM_DETAIL_AMENITY_GROUPS.map((group) => ({ title: group.title, items: group.items })), { title: 'Essentials', items: ROOM_DETAIL_ESSENTIALS }, { title: 'Services', items: ROOM_DETAIL_SERVICES }].map((group) => (
                              <section className="guesthousebooking-room-detail-section" aria-label={group.title} key={group.title}>
                                {renderRoomDetailSectionTitle(group.title)}
                                <div className={group.title === 'Comfort' || group.title === 'Connectivity' || group.title === 'Furniture' ? 'guesthousebooking-room-detail-groups' : 'guesthousebooking-room-detail-flat-list'}>
                                  {group.items.map((item) => {
                                    const Icon = item.Icon;
                                    return (
                                      <label className="guesthousebooking-room-detail-item" key={item.label}>
                                        <input className="guesthousebooking-checkbox guesthousebooking-room-detail-checkbox" type="checkbox" checked={Boolean(room.facilities[item.label])} disabled={!isEditing} onChange={() => updateManagedRoom(room.id, 'facilities', item.label)} />
                                        <Icon className="guesthousebooking-room-detail-item-icon" size={22} aria-hidden="true" />
                                        <span>{item.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </section>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="guesthousebooking-management-title guesthousebooking-management-title--spaced">
          Care Taker Management
        </div>
        <div className="guesthousebooking-resource-import-toolbar">
          <div className="guesthousebooking-csv-actions">
            <button type="button" onClick={addCareTaker}>
              <PlusCircle size={14} /> Add Care Taker
            </button>
            <button
              type="button"
              onClick={() => downloadCsv('care-taker-management-template.csv', 'Care Taker Name,Mobile Number,Status\nValavan C,9876543210,Active\n')}
            >
              <Download size={14} /> Sample CSV
            </button>
            <button type="button" onClick={() => careTakerCsvInputRef.current?.click()}>
              <Upload size={14} /> Import CSV
            </button>
          </div>
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
                        () => setEditingCareTakerId(careTaker.id),
                        () => void removeCareTaker(careTaker.id),
                        false,
                        isEditing,
                        'care taker',
                        () => void saveCareTaker(careTaker),
                        index === careTakers.length - 1,
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
  // The server validates the active workflow stage and the user's permission.
  // Wait for the saved state before rendering approval actions, and keep
  // completed requests read-only for workflow approvers.
  const isFinalWorkflowStatus = ['completed', 'approved', 'rejected'].includes(
    bookingWorkflowStatus.trim().toLowerCase(),
  );
  const canApproveFromForm =
    isApprovalForm &&
    isViewingBooking &&
    bookingLoadState === 'loaded' &&
    !isFinalWorkflowStatus;
  const proposalYear = /^\d{4}/.test(applicantUiDetails.date)
    ? applicantUiDetails.date.slice(0, 4)
    : new Date().getFullYear();
  const guesthouseProposalRef = `#GH-${proposalYear}-${String(bookingId).padStart(4, '0')}`;

  const handleApprovalFromForm = async (
    decision: 'approved' | 'returned' | 'rejected' | 'archived',
  ) => {
    if (!hasBookingId || isProcessingApproval) return;

    if (decision === 'archived') {
      setIsArchiveConfirmOpen(true);
      return;
    }

    let feedback = '';
    if (decision === 'returned' || decision === 'rejected') {
      feedback = window.prompt(
        decision === 'returned'
          ? 'Enter the reason for returning this request:'
          : 'Enter the reason for rejecting this request:',
      )?.trim() || '';
      if (!feedback) return;
    }

    setIsProcessingApproval(true);
    try {
      const response = (await authenticityUtility.patch(`/guesthouse/${bookingId}/approval`, {
        decision,
        feedback,
      })) as any;
      if (!response?.success) {
        throw new Error(response?.message || 'Guest House approval could not be completed');
      }
      navigate('/admin/guesthouse', { replace: true });
    } catch (error) {
      showAlert(
        (error as any)?.response?.data?.message ||
          (error as Error)?.message ||
          'Guest House approval could not be completed.',
        'error',
      );
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const confirmGuesthouseArchiveToggle = async () => {
    if (!hasBookingId || isProcessingApproval) return;
    setIsArchiveConfirmOpen(false);
    setIsProcessingApproval(true);
    try {
      const response = (await authenticityUtility.patch(
        `/guesthouse/${bookingId}/archive-toggle`,
        {},
      )) as any;
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to update Guest House archive state');
      }
      navigate('/admin/guesthouse', { replace: true });
    } catch (error) {
      showAlert(
        (error as any)?.response?.data?.message ||
          (error as Error)?.message ||
          'Unable to update Guest House archive state.',
        'error',
      );
    } finally {
      setIsProcessingApproval(false);
    }
  };

  if (isPrintPreview) {
    if (hasBookingId && bookingLoadState !== 'loaded') {
      return <div role={bookingLoadState === 'error' ? 'alert' : 'status'}>{bookingLoadState === 'error' ? 'This booking could not be loaded for printing.' : 'Preparing booking print preview…'}</div>;
    }
    return (
      <GuesthousePrintPreview
        bookingId={bookingId}
        applicant={applicantUiDetails}
        beneficiary={beneficiaryDetails}
        travel={travelDetails}
        guests={guests}
        foodRows={foodRows}
      />
    );
  }

  if (isManageResourcesView && isGuesthouseAdmin) {
  return (
    <div className="guesthousebooking-page">
        <div className="guesthousebooking-shell">
          <div className="guesthousebooking-management-page-header">
            <h1>Manage Resources</h1>
            <button type="button" onClick={() => navigate('/admin/guesthouse')}>
              Back to Requests
            </button>
          </div>
          {renderGuesthouseAdminManagement()}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={`guesthousebooking-page ${isApprovalForm ? 'guesthousebooking-page--approval' : ''}`}>
      <AlertModal
        show={alertConfig.show}
        onHide={closeAlert}
        message={alertConfig.message}
        type={alertConfig.type}
        title={alertConfig.title}
        onConfirm={alertConfig.onConfirm}
      />
      <AlertModal
        show={isArchiveConfirmOpen}
        onHide={() => setIsArchiveConfirmOpen(false)}
        message={bookingWorkflowStatus === 'archived'
          ? 'Are you sure you want to unarchive this Guest House request?'
          : 'Are you sure you want to archive this Guest House request?'}
        type="warning"
        title={bookingWorkflowStatus === 'archived' ? 'Confirm Unarchive' : 'Confirm Archive'}
        showCancel
        confirmText={bookingWorkflowStatus === 'archived' ? 'Unarchive' : 'Archive'}
        cancelText="Cancel"
        onConfirm={() => void confirmGuesthouseArchiveToggle()}
      />
      {isApprovalForm && (
        <RecordHeaderBanner
          referenceLabel="Proposal ID"
          referenceValue={guesthouseProposalRef}
          createdByEmail={applicantUiDetails.email || applicantUiDetails.name || '-'}
        />
      )}
      <div className="guesthousebooking-shell">
        {hasBookingId && bookingLoadState !== 'loaded' && (
          <div
            role={bookingLoadState === 'error' ? 'alert' : 'status'}
            style={{
              margin: '0 0 16px',
              padding: '14px 18px',
              borderRadius: 10,
              color: bookingLoadState === 'error' ? '#b42318' : '#075985',
              background: bookingLoadState === 'error' ? '#fef3f2' : '#eaf5ff',
              border: `1px solid ${bookingLoadState === 'error' ? '#fecdca' : '#b9dcf5'}`,
            }}
          >
            {bookingLoadState === 'loading'
              ? 'Loading saved Guest House request details…'
              : 'This booking could not be loaded. The form below is not the saved request data.'}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <fieldset disabled={bookingLoadState === 'loading' || bookingLoadState === 'error' || (isViewingBooking && !isGuesthouseAdmin && !isApprovalForm && !isRoomAllotmentVisible)} style={{ border: 0, padding: 0, margin: 0 }}>
          {canShowRoomAllocationTab && !isRoomAllotmentVisible && (
            <div className="guesthousebooking-admin-toggle" role="tablist" aria-label="Guest House Admin view">
              <button
                type="button"
                role="tab"
                aria-selected={adminView === 'booking'}
                className={adminView === 'booking' ? 'is-active' : ''}
                onClick={() => setAdminView('booking')}
              >
                Guest House Booking
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={adminView === 'allotment'}
                className={adminView === 'allotment' ? 'is-active' : ''}
                onClick={() => setAdminView('allotment')}
              >
                Room Allocation Card
              </button>
            </div>
          )}
          {(!canShowRoomAllocationTab || adminView === 'booking') && <>
          <section className="guesthousebooking-card">
            <div className="guesthousebooking-card-header">
              <span>Applicant Details</span>
              <button
                className="guesthousebooking-card-toggle"
                type="button"
                aria-label={isApplicantCardOpen ? 'Hide full applicant details' : 'Show full applicant details'}
                aria-expanded={isApplicantCardOpen}
                onClick={() => setIsApplicantCardOpen((open) => !open)}
              >
                {isApplicantCardOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
              </button>
            </div>

            {!isApplicantCardOpen && (
              <div
                className="guesthousebooking-card-summary"
                onClick={() => setIsApplicantCardOpen(true)}
              >
                <div className="guesthousebooking-summary-field">
                  <span className="guesthousebooking-summary-label">Applicant Name</span>
                  <input
                    className="guesthousebooking-input"
                    value={applicantUiDetails.name}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
                <div className="guesthousebooking-summary-field">
                  <span className="guesthousebooking-summary-label">Date</span>
                  <input
                    className="guesthousebooking-input"
                    value={applicantUiDetails.date}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
              </div>
            )}

            {isApplicantCardOpen && (
              <div className="guesthousebooking-card-body">
                <div className="guesthousebooking-form-grid">
                  <div className="guesthousebooking-field" style={{ position: 'relative' }}>
                    <label className="guesthousebooking-label">Applicant Name</label>
                    <input
                      className="guesthousebooking-input"
                      value={applicantSearchInitialized ? applicantSearch : applicantUiDetails.name}
                      onChange={(event) => {
                        setApplicantSearchInitialized(true);
                        setApplicantSearch(event.target.value);
                      }}
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
                              setApplicantProfile({
                                ...employee,
                                employee_id:
                                  employee.employee_id ||
                                  employee.employeeId ||
                                  employee.master_employee_id ||
                                  employee.masterEmployeeId ||
                                  '',
                              });
                              setApplicantSearch('');
                              setApplicantSearchInitialized(false);
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
            <div className="row mb-3" style={{ marginBottom: '15px' }}>
              <div className="col-md-3">
                <div className="form-group">
                <label
                  style={{
                    fontSize: '14px',
                    color: '#495057',
                    marginBottom: '8px',
                    fontWeight: '600',
                    display: 'block',
                  }}
                >
                  Beneficiary
                </label>
                <BudgetSelect
                  value={
                    BENEFICIARY_TYPE_SELECT_OPTIONS.find(
                      (option) => option.value === beneficiaryDetails.beneficiaryType,
                    ) || null
                  }
                  onChange={(selected) =>
                    updateBeneficiaryDetails('beneficiaryType', selected?.value || '')
                  }
                  options={BENEFICIARY_TYPE_SELECT_OPTIONS}
                  placeholder=""
                  disabled={isViewingBooking}
                />
                </div>
              </div>
              {beneficiaryDetails.beneficiaryType && (
                <>
              <div className="guesthousebooking-beneficiary-field col-md-6">
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
                    {!isViewingBooking && beneficiaryEmployeeOptions.length > 0 && (
                      <div className="guesthousebooking-employee-dropdown">
                        {beneficiaryEmployeeOptions.map((employee, index) => (
                          <button
                            type="button"
                            className="guesthousebooking-employee-option"
                            key={`${employee.employee_id || employee.name || 'employee'}-${index}`}
                            onMouseDown={(event) => {
                              // Select before the text input can blur, matching Budget's employee picker.
                              event.preventDefault();
                              setBeneficiaryDetails((prev) => ({
                                ...prev,
                                staffName: getTextValue(employee as unknown as ApiRecord, [
                                  'name',
                                  'full_name',
                                  'fullName',
                                  'employee_name',
                                  'employeeName',
                                ]),
                                departmentId: String(
                                  employee.department_id || employee.departmentId || '',
                                ),
                                department: getTextValue(employee as unknown as ApiRecord, [
                                  'department',
                                  'department_name',
                                  'departmentName',
                                ]),
                              }));
                              setBeneficiaryEmployeeOptions([]);
                              setBeneficiarySearchOpen(false);
                            }}
                          >
                            <strong>
                              {getTextValue(employee as unknown as ApiRecord, [
                                'name',
                                'full_name',
                                'fullName',
                                'employee_name',
                                'employeeName',
                              ])}
                            </strong>
                            <span>
                              {getTextValue(employee as unknown as ApiRecord, [
                                'department',
                                'department_name',
                                'departmentName',
                              ]) || 'Employee'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <BudgetSelect
                    value={
                      beneficiaryDetails.staffName
                        ? { value: beneficiaryDetails.staffName, label: beneficiaryDetails.staffName }
                        : null
                    }
                    onChange={(selected) => {
                      const selectedName = selected?.value || '';
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
                    options={(beneficiaryEntityOptions[beneficiaryDetails.beneficiaryType.toUpperCase()] ||
                      beneficiaryEntityOptions[beneficiaryDetails.beneficiaryType] ||
                      []).map((option) => ({ value: option.name, label: option.name }))}
                    placeholder={`Select ${beneficiaryDetails.beneficiaryType.toLowerCase()}`}
                    disabled={isViewingBooking}
                  />
                )}
              </div>
              <div className="guesthousebooking-beneficiary-field col-md-3">
                <label className="guesthousebooking-beneficiary-label">Tag</label>
                <BudgetSelect
                  value={
                    beneficiaryDetails.tag
                      ? { value: beneficiaryDetails.tag, label: beneficiaryDetails.tag }
                      : null
                  }
                  onChange={(selected) => updateBeneficiaryDetails('tag', selected?.value || '')}
                  options={BENEFICIARY_TAG_OPTIONS.map((option) => ({ value: option, label: option }))}
                  placeholder=""
                  disabled={isViewingBooking}
                />
              </div>
                </>
              )}
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

          </>}
          {/* Existing Room Allotment Card: editable only for Guest House Admin. */}
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
                            <input
                              type="date"
                              value={travelDetails.checkInDate}
                              onChange={(event) => {
                                updateTravelDetails('checkInDate', event.target.value);
                                void saveAllotmentSchedule({ checkInDate: event.target.value });
                              }}
                              aria-label="Check-in date"
                            />

                            <input type="time" value={checkInTime} onChange={(event) => { updateTravelDetails('checkInTime', event.target.value); void saveAllotmentSchedule({ checkInTime: event.target.value }); }} aria-label="Check-in time" />
                            <CircleCheck className="guesthousebooking-allotment-check-icon" size={18} aria-hidden="true" />
                          </label>
                          <label className="guesthousebooking-allotment-datetime-row">
                            <span className="guesthousebooking-allotment-datetime-title">Check-out</span>
                            <input
                              type="date"
                              value={travelDetails.checkOutDate}
                              min={travelDetails.checkInDate || undefined}
                              onChange={(event) => {
                                updateTravelDetails('checkOutDate', event.target.value);
                                void saveAllotmentSchedule({ checkOutDate: event.target.value });
                              }}
                              aria-label="Check-out date"
                            />

                            <input type="time" value={checkOutTime} onChange={(event) => { updateTravelDetails('checkOutTime', event.target.value); void saveAllotmentSchedule({ checkOutTime: event.target.value }); }} aria-label="Check-out time" />
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
                                const isRoomDetailActive =
                                  activeRoomDetail?.guestId === guestId && activeRoomDetail.rowId === row.id;

                                return (
                                  <tr key={row.id}>
                                    <td className="centerTd">{idx + 1}</td>
                                    <td>
                                      {renderAllotmentDropdown(guestId, row, 'roomType')}
                                    </td>
                                    <td>
                                      {renderAllotmentDropdown(guestId, row, 'block')}
                                    </td>
                                    <td>
                                      <div className="guesthousebooking-room-number-cell">
                                        {renderAllotmentDropdown(guestId, row, 'roomNumber', !row.block)}
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
                                        max={row.roomType === 'Single' ? 1 : 2}
                                        value={row.occupants}
                                        onChange={(event) =>
                                          updateAllotmentRow(
                                            guestId,
                                            row.id,
                                            'occupants',
                                            String(Math.max(1, Math.min(row.roomType === 'Single' ? 1 : 2, Number.parseInt(event.target.value, 10) || 1))),
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
                        <button
                          type="button"
                          className={`guesthousebooking-input guesthousebooking-spoc-control guesthousebooking-caretaker-dropdown-trigger${activeCareTakerDropdown === guestId ? ' is-open' : ''}`}
                          onClick={(event) => toggleCareTakerDropdown(event, guestId)}
                          aria-haspopup="listbox"
                          aria-expanded={activeCareTakerDropdown === guestId}
                          data-caretaker-dropdown-trigger="true"
                        >
                          <span>{allotment.spoc || 'Select Care Taker'}</span>
                          <ChevronDown size={16} aria-hidden="true" />
                        </button>
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
          {canEditRoomAllotment && (
            <div className="guesthousebooking-actions">
              <button
                className="guesthousebooking-submit-button"
                type="button"
                disabled={isSavingAllotments}
                onClick={() => void handleSaveRoomAllotments()}
              >
                {isSavingAllotments ? 'Saving Room Allocation...' : 'Submit Room Allocation'}
              </button>
            </div>
          )}
          {(!canShowRoomAllocationTab || adminView === 'booking') && !isApprovalForm && !isViewingBooking && <div className="guesthousebooking-actions">
            <button
              className="guesthousebooking-submit-button"
              type="submit"
              disabled={isSubmitting}
            >
              {isEditMode ? 'Update Guest House Booking' : 'Submit Booking'}
            </button>
          </div>}
          {canApproveFromForm && (
            <div className="guesthousebooking-workflow-actions" aria-label="Guesthouse approval actions">
              {bookingWorkflowStatus !== 'archived' && <>
              <button
                  type="button"
                  className="guesthousebooking-workflow-button guesthousebooking-workflow-button--approve"
                  disabled={isProcessingApproval}
                  onClick={() => void handleApprovalFromForm('approved')}
                >
                  <CircleCheck size={18} /> Approve
                </button>
                <button
                  type="button"
                  className="guesthousebooking-workflow-button guesthousebooking-workflow-button--return"
                  disabled={isProcessingApproval}
                  onClick={() => void handleApprovalFromForm('returned')}
                >
                  <RotateCcw size={18} /> Return
                </button>
                <button
                  type="button"
                  className="guesthousebooking-workflow-button guesthousebooking-workflow-button--reject"
                  disabled={isProcessingApproval}
                  onClick={() => void handleApprovalFromForm('rejected')}
                >
                  <XCircle size={18} /> Reject
                </button>
              </>}
                <button
                  type="button"
                  className="guesthousebooking-workflow-button guesthousebooking-workflow-button--archive"
                  disabled={isProcessingApproval}
                  onClick={() => setIsArchiveConfirmOpen(true)}
                >
                  <Archive size={18} />
                  {bookingWorkflowStatus === 'archived' ? 'Unarchive' : 'Archive'}
                </button>
            </div>
          )}
          {canManageGuesthouse &&
            isGuesthouseManagementVisible &&
            renderGuesthouseAdminManagement()}
          </fieldset>
        </form>
      </div>
    </div>
    {activeAllotmentDropdown && activeDropdownRow && createPortal(
      <div
        ref={allotmentDropdownRef}
        className={`guesthousebooking-allotment-dropdown-menu${allotmentDropdownPosition.openUp ? ' opens-up' : ''}`}
        style={{ top: allotmentDropdownPosition.top, left: allotmentDropdownPosition.left, width: allotmentDropdownPosition.width }}
        role="listbox"
        aria-label={`Select ${activeAllotmentDropdown.field === 'roomType' ? 'room type' : activeAllotmentDropdown.field === 'roomNumber' ? 'room number' : 'block'}`}
      >
        {activeDropdownOptions.map((option, index) => (
          <button
            key={`${option || '__empty'}-${index}`}
            type="button"
            role="option"
            aria-selected={option === activeDropdownRow[activeAllotmentDropdown.field]}
            className={`guesthousebooking-allotment-dropdown-option${option === activeDropdownRow[activeAllotmentDropdown.field] ? ' is-selected' : ''}${!option ? ' is-placeholder' : ''}`}
            onClick={() => chooseActiveAllotmentOption(option)}
          >
            {option}
          </button>
        ))}
      </div>,
      document.body,
    )}
    {activeCareTakerDropdown && createPortal(
      <div
        ref={careTakerDropdownRef}
        className={`guesthousebooking-allotment-dropdown-menu guesthousebooking-caretaker-dropdown-menu${careTakerDropdownPosition.openUp ? ' opens-up' : ''}`}
        style={{ top: careTakerDropdownPosition.top, left: careTakerDropdownPosition.left, width: careTakerDropdownPosition.width }}
        role="listbox"
        aria-label="Select Care Taker"
      >
        <button
          type="button"
          role="option"
          aria-selected={!roomAllotments[activeCareTakerDropdown]?.spoc}
          className="guesthousebooking-allotment-dropdown-option guesthousebooking-caretaker-dropdown-option is-placeholder"
          onClick={() => chooseCareTaker(activeCareTakerDropdown, '')}
        >
          Select Care Taker
        </button>
        {spocOptions.map((spoc) => (
          <button
            key={`${spoc.name}-${spoc.mobile}`}
            type="button"
            role="option"
            aria-selected={spoc.name === roomAllotments[activeCareTakerDropdown]?.spoc}
            className={`guesthousebooking-allotment-dropdown-option guesthousebooking-caretaker-dropdown-option${spoc.name === roomAllotments[activeCareTakerDropdown]?.spoc ? ' is-selected' : ''}`}
            onClick={() => chooseCareTaker(activeCareTakerDropdown, spoc.name)}
          >
            {spoc.name}
          </button>
        ))}
      </div>,
      document.body,
    )}
    </>
  );
};

export default GuestHouseBooking;
