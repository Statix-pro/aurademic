import React, { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  Calendar,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Trash2,
  UsersRound,
  Utensils,
} from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import './guesthousebooking.css';

type Gender = 'Male' | 'Female' | 'Others' | '';
type GuestPriority = 'Routine' | 'High' | '';
type RoomType = 'Single' | 'Double' | 'Deluxe';

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
  spoc: string;
  mobile: string;
}

interface RoomBlockOption {
  block: string;
  roomNumbers: string[];
}

type RoomAllotmentsByGuest = Record<string, RoomAllotmentData>;
type RoomRequirementField = 'roomSingle' | 'roomDouble' | 'roomDeluxe';
type TravelTimeField = 'checkInTime' | 'checkOutTime';
type TravelTimePart = 'hour' | 'minute' | 'period';

type GuestField = Exclude<keyof GuestDetails, 'id'>;
type FoodField = Exclude<keyof FoodRequirementRow, 'id'>;
type TravelDateField = 'checkInDate' | 'checkOutDate';

const numberOnly = (value: string) => Math.max(0, Number(value) || 0);

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

const createGuest = (id = Date.now()): GuestDetails => ({
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


const ROOM_REQUIREMENT_CONFIG: Array<{
  field: RoomRequirementField;
  roomType: RoomType;
  occupants: string;
}> = [
  { field: 'roomSingle', roomType: 'Single', occupants: '1' },
  { field: 'roomDouble', roomType: 'Double', occupants: '2' },
  { field: 'roomDeluxe', roomType: 'Deluxe', occupants: '2' },
];

const FALLBACK_ROOM_BLOCK_OPTIONS: RoomBlockOption[] = [
  { block: 'Main Block', roomNumbers: ['101', '102', '103'] },
  { block: 'Science Block', roomNumbers: ['201', '202', '203'] },
  { block: 'Library Block', roomNumbers: ['301', '302', '303'] },
  { block: 'CSE Block', roomNumbers: ['401', '402', '403'] },
  { block: 'IT Block', roomNumbers: ['501', '502', '503'] },
  { block: 'Mechanical Block', roomNumbers: ['601', '602', '603'] },
  { block: 'Civil Block', roomNumbers: ['701', '702', '703'] },
  { block: 'Hostel Block', roomNumbers: ['801', '802', '803'] },
];

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
  spoc: previous?.spoc || '',
  mobile: previous?.mobile || '',
});

const getTextValue = (source: Record<string, unknown>, keys: string[]) => {
  const value = keys.map((key) => source[key]).find((item) => item !== undefined && item !== null);
  return String(value || '').trim();
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
  const rawPayload = payload as Record<string, unknown> | unknown[] | null;
  const source =
    rawPayload && !Array.isArray(rawPayload) && 'data' in rawPayload
      ? (rawPayload.data as unknown)
      : rawPayload;

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

const splitTravelTime = (value: string) => {
  const match = normalizeTravelTimeEntry(value).match(/^(\d{1,2})?:?(\d{0,2})?\s*(AM|PM)?$/i);
  return {
    hour: match?.[1] || '',
    minute: match?.[2] || '',
    period: (match?.[3] || '').toUpperCase(),
  };
};

const formatTravelTimeParts = (parts: Record<TravelTimePart, string>) => {
  const time = parts.hour || parts.minute ? `${parts.hour}:${parts.minute}` : '';
  return [time, parts.period].filter(Boolean).join(' ');
};
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
  const [foodDateInputs, setFoodDateInputs] = useState<Record<number, string>>({});
  const [roomBlockOptions, setRoomBlockOptions] = useState<RoomBlockOption[]>(
    FALLBACK_ROOM_BLOCK_OPTIONS,
  );
  const [roomAllotments, setRoomAllotments] = useState<RoomAllotmentsByGuest>({});

  useEffect(() => {
    setTravelDateInputs({
      checkInDate: formatDateForDisplay(travelDetails.checkInDate),
      checkOutDate: formatDateForDisplay(travelDetails.checkOutDate),
    });
  }, [travelDetails.checkInDate, travelDetails.checkOutDate]);


  useEffect(() => {
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
          console.info('Using fallback guesthouse room options.', error);
        }
      }
    };

    loadRoomOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
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
  }, [guests]);
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

  const updateTravelTimePart = (
    field: TravelTimeField,
    part: TravelTimePart,
    value: string,
  ) => {
    const currentParts = splitTravelTime(travelDetails[field]);
    const nextValue = part === 'period' ? value.toUpperCase() : value.replace(/\D/g, '').slice(0, 2);
    const nextParts = {
      ...currentParts,
      [part]: nextValue,
    };

    updateTravelDetails(field, formatTravelTimeParts(nextParts));
  };

  const normalizeTravelTimePart = (field: TravelTimeField) => {
    const currentParts = splitTravelTime(travelDetails[field]);
    const hour = currentParts.hour ? Math.min(12, Math.max(1, Number(currentParts.hour))) : '';
    const minute = currentParts.minute
      ? Math.min(59, Math.max(0, Number(currentParts.minute)))
      : '';

    updateTravelDetails(
      field,
      formatTravelTimeParts({
        hour: hour === '' ? '' : String(hour).padStart(2, '0'),
        minute: minute === '' ? '' : String(minute).padStart(2, '0'),
        period: currentParts.period,
      }),
    );
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
      roomAllotments: guests.map((guest) => roomAllotments[String(guest.id)] || createRoomAllotmentData(String(guest.id), guest)),
    };

    console.log('Guest house booking payload:', payload);
    setSubmitMessage('Guest house booking form is ready.');
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
        onChange={(event) => updateTravelDetails(field, event.target.value)}
        onBlur={() => updateTravelDetails(field, normalizeTravelTimeEntry(travelDetails[field]))}
        inputMode="text"
        maxLength={8}
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
                    'Search employee by name or ERP ID',
                  )}
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
                        <div className="guesthousebooking-food-checkboxes">
                          <label className="guesthousebooking-food-checkbox-label guesthousebooking-food-checkbox-label--veg">
                            <span>Veg.</span>
                            <input
                              className="guesthousebooking-checkbox guesthousebooking-checkbox--veg"
                              type="checkbox"
                              checked={guest.foodVeg === 'yes'}
                              onChange={(event) =>
                                updateGuest(guest.id, 'foodVeg', event.target.checked ? 'yes' : '')
                              }
                            />
                          </label>
                          <label className="guesthousebooking-food-checkbox-label guesthousebooking-food-checkbox-label--nonveg">
                            <span>Non-Veg.</span>
                            <input
                              className="guesthousebooking-checkbox guesthousebooking-checkbox--nonveg"
                              type="checkbox"
                              checked={guest.foodNonVeg === 'yes'}
                              onChange={(event) =>
                                updateGuest(guest.id, 'foodNonVeg', event.target.checked ? 'yes' : '')
                              }
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
          <div className="guesthousebooking-allotment-list" aria-label="Room Allotment">
            {guests.map((guest, index) => {
              const guestId = String(guest.id);
              const allotment =
                roomAllotments[guestId] || createRoomAllotmentData(guestId, guest);
              const counts = getGuestAllotmentCounts(guest);
              const checkIn = formatDateForDisplay(travelDetails.checkInDate) || '-';
              const checkOut = formatDateForDisplay(travelDetails.checkOutDate) || '-';

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
                          <span className="guesthousebooking-allotment-main-icon">
                            <UsersRound size={24} />
                          </span>
                          <div className="guesthousebooking-allotment-guest-copy">
                            <strong>{guest.name || `Guest ${index + 1}`}</strong>
                            <span>
                              {[guest.designation || 'Designation', guest.organization || 'Organization'].join(', ')}
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
                        </div>

                        <div className="guesthousebooking-allotment-date-stack">
                          <label>
                            <span>Check-in</span>
                            <input value={checkIn} readOnly aria-label="Check-in date" />
                          </label>
                          <label>
                            <span>Check-out</span>
                            <input value={checkOut} readOnly aria-label="Check-out date" />
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
                    </div>

                    <div className="guesthousebooking-allotment-spoc-bar">
                      <div className="guesthousebooking-spoc-field">
                        <span>Single Point of Contact (SPOC)</span>
                        <select
                          className="guesthousebooking-input guesthousebooking-spoc-control"
                          value={allotment.spoc}
                          onChange={(event) =>
                            updateAllotmentContact(guestId, 'spoc', event.target.value)
                          }
                        >
                          <option value="">Select SPOC</option>
                          <option value="Dr. Thiruvalluvar">Dr. Thiruvalluvar</option>
                          <option value="Prof. Niranjana">Prof. Niranjana</option>
                          <option value="Admin Clerk">Admin Clerk</option>
                        </select>
                      </div>
                      <div className="guesthousebooking-spoc-field">
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
          </div>
          <div className="guesthousebooking-actions">
            {submitMessage && <span className="guesthousebooking-success">{submitMessage}</span>}

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











