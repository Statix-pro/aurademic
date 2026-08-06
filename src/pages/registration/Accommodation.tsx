import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronUp, CreditCard, Calendar, Home } from 'lucide-react';
import { useEvents, isPayableEvent, flattenEvents } from '../../context/EventsContext';
import type { EventItem } from '../../types';
import '../../styles/Accommodation.css';

type RoomRow = {
  id: string;
  roomType: string;
  charge: string;
  occupants: string;
  days: string;
};

const ROOM_TYPES = [
  'Single Room',
  'Double Room',
  'Triple Room',
  'Dormitory',
  'AC Room',
  'Non-AC Room',
];

const ROOM_CHARGES: Record<string, number> = {
  'Single Room': 1200,
  'Double Room': 1800,
  'Triple Room': 2400,
  Dormitory: 800,
  'AC Room': 2200,
  'Non-AC Room': 1500,
};

const MAX_OCCUPANTS = 4;

function createRoom(id = Date.now().toString()): RoomRow {
  return { id, roomType: '', charge: '', occupants: '', days: '' };
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getFixedCharge(roomType: string) {
  return roomType ? (ROOM_CHARGES[roomType] ?? 0) : 0;
}

function getOccupancyLimit() {
  return MAX_OCCUPANTS;
}

function calcAmount(room: RoomRow) {
  return toNumber(room.charge) * toNumber(room.occupants) * toNumber(room.days);
}

function isRoomComplete(room: RoomRow) {
  const occupants = toNumber(room.occupants);
  const days = toNumber(room.days);
  const limit = getOccupancyLimit();
  const withinLimit = !limit || occupants <= limit;

  return Boolean(room.roomType && room.charge && occupants && days && withinLimit);
}

function RoomRowItem({
  room,
  onChange,
  isDaysReadOnly,
}: {
  room: RoomRow;
  onChange: (id: string, field: keyof Omit<RoomRow, 'id'>, value: string) => void;
  isDaysReadOnly?: boolean;
}) {
  const inputCls =
    'h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none transition focus:border-[#064675] focus:ring-2 focus:ring-[#064675]/15';
  const amount = calcAmount(room);
  const fixedCharge = getFixedCharge(room.roomType);

  return (
    <tr className="accommodation-1">
      <td className="accommodation-2">
        <select
          value={room.roomType}
          onChange={(e) => onChange(room.id, 'roomType', e.target.value)}
          className={inputCls}
          aria-label="Room type"
        >
          <option value="">Select room</option>
          {ROOM_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </td>
      <td className="accommodation-3">
        <input
          value={room.roomType ? fixedCharge.toString() : ''}
          readOnly
          className={`${inputCls} bg-slate-50 text-slate-600`}
          placeholder="Charge"
        />
      </td>
      <td className="accommodation-4">
        <input
          type="number"
          min="1"
          max={MAX_OCCUPANTS}
          value={room.occupants}
          onChange={(e) => onChange(room.id, 'occupants', e.target.value)}
          className={inputCls}
          placeholder="Occupants"
        />
      </td>
      <td className="accommodation-5">
        <input
          type="number"
          min="1"
          value={room.days}
          onChange={(e) => onChange(room.id, 'days', e.target.value)}
          readOnly={isDaysReadOnly}
          className={`${inputCls} ${isDaysReadOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
          placeholder="Days"
        />
      </td>
      <td className="accommodation-6">
        <input
          value={amount ? amount.toString() : ''}
          readOnly
          className={`${inputCls} bg-slate-50 text-slate-600`}
          placeholder="Amount"
        />
      </td>
    </tr>
  );
}

export default function Accommodation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getRegistration, registrations, events } = useEvents();
  const [requireAccommodation, setRequireAccommodation] = useState<'yes' | 'no' | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([createRoom('1')]);
  const [checkIn, setCheckIn] = useState({ date: '', time: '' });
  const [checkOut, setCheckOut] = useState({ date: '', time: '' });

  const allDisplayEvents = useMemo(() => flattenEvents(events), [events]);
  const paymentEvents = useMemo(
    () =>
      allDisplayEvents.filter((event) => {
        const registration = registrations[event.id];
        return Boolean(registration && isPayableEvent(event, registration));
      }),
    [allDisplayEvents, registrations],
  );
  const paymentTotal = paymentEvents.reduce((sum, event) => sum + event.fees, 0);

  const dateError = useMemo(() => {
    if (!checkIn.date || !checkOut.date) return '';
    const start = new Date(checkIn.date);
    const end = new Date(checkOut.date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return 'Check-out date must be after check-in date.';
    }
    if (diffDays > 10) {
      return 'Accommodation cannot exceed 10 days.';
    }
    return '';
  }, [checkIn.date, checkOut.date]);

  const calculatedDays = useMemo(() => {
    if (!checkIn.date || !checkOut.date) return null;
    const start = new Date(checkIn.date);
    const end = new Date(checkOut.date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [checkIn.date, checkOut.date]);

  useEffect(() => {
    if (dateError) {
      setRooms((prev) => prev.map((room) => ({ ...room, days: '' })));
    } else if (calculatedDays !== null && calculatedDays > 0 && calculatedDays <= 10) {
      setRooms((prev) => prev.map((room) => ({ ...room, days: calculatedDays.toString() })));
    }
  }, [calculatedDays, dateError]);

  const completeRooms = useMemo(() => rooms.filter(isRoomComplete), [rooms]);
  const totalAmount = useMemo(
    () => completeRooms.reduce((sum, room) => sum + calcAmount(room), 0),
    [completeRooms],
  );
  const isTravelComplete = Boolean(checkIn.date && checkIn.time && checkOut.date && checkOut.time);
  const hasOccupantLimitError = rooms.some((room) => toNumber(room.occupants) > MAX_OCCUPANTS);
  const canProceed =
    requireAccommodation === 'yes' && isTravelComplete && !dateError && completeRooms.length > 0;
  const showPaymentSummary = canProceed;
  const useTallOuterCard = requireAccommodation === 'yes';

  const updateRoom = (id: string, field: keyof Omit<RoomRow, 'id'>, value: string) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== id) return room;
        if (field === 'roomType') {
          const fixedCharge = getFixedCharge(value);
          return {
            ...room,
            roomType: value,
            charge: fixedCharge ? fixedCharge.toString() : '',
            occupants: '',
          };
        }
        return { ...room, [field]: value };
      }),
    );
  };

  const clearRooms = () => {
    setRooms([createRoom('1')]);
  };

  const handleProceed = () => {
    if (!canProceed) return;

    const selectedRoom = completeRooms[0];
    const roomCount = completeRooms.length;
    const roomLabel =
      roomCount > 1 ? `${roomCount} Rooms` : selectedRoom.roomType || 'Accommodation';

    navigate('/payment', {
      state: {
        ...location.state,
        selectedEvents: paymentEvents,
        accommodation: {
          optionId: selectedRoom.id,
          roomType: roomLabel,
          nights: completeRooms.reduce((sum, room) => sum + toNumber(room.days), 0) || 1,
          pricePerNight: totalAmount,
        },
        total: paymentTotal + totalAmount,
      },
    });
  };

  return (
    <div className="accommodation-7">
      <div className="accommodation-8">
        <div className="accommodation-9">
          <div className="accommodation-10">
            <button
              onClick={() => navigate('/home')}
              className="accommodation-11"
              aria-label="Back to home"
            >
              <ArrowLeft className="accommodation-12" />
            </button>
            <h2 className="accommodation-13">Event Lists</h2>
          </div>
        </div>

        <section className="accommodation-14">
          <div className="accommodation-15">
            <div className="accommodation-16">
              <button
                onClick={() => navigate('/event-register', { state: { ...location.state } })}
                className="accommodation-17"
              >
                <span className="accommodation-18">
                  <Calendar className="accommodation-19" />
                  Events
                </span>
              </button>
              <button className="accommodation-20">
                <span className="accommodation-21">
                  <Home className="accommodation-22" />
                  Accommodation
                </span>
              </button>
              <button onClick={handleProceed} disabled={!canProceed} className="accommodation-23">
                <span className="accommodation-24">
                  <CreditCard className="accommodation-25" />
                  Payment
                </span>
              </button>
            </div>
          </div>

          {requireAccommodation !== 'yes' ? (
            <div className="accommodation-26">
              <div className="accommodation-27">
                <h2 className="accommodation-28">Accommodation Requirement</h2>
                <p className="accommodation-29">Do you need accommodation?</p>

                <div className="accommodation-30">
                  <button
                    type="button"
                    onClick={() => setRequireAccommodation('yes')}
                    className="accommodation-31"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequireAccommodation('no')}
                    className={`rounded-xl border px-5 py-3 text-sm font-semibold transition-colors ${
                      requireAccommodation === 'no'
                        ? 'border-[#064675] bg-[#064675] text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    No
                  </button>
                </div>

                {requireAccommodation === 'no' && (
                  <p className="accommodation-32">No accommodation details required.</p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="accommodation-33">
                <label className="accommodation-34">
                  <input
                    type="radio"
                    name="accommodation"
                    checked={(requireAccommodation as string) === 'yes'}
                    onChange={() => setRequireAccommodation('yes')}
                    className="accommodation-35"
                  />
                  Yes
                </label>
                <label className="accommodation-36">
                  <input
                    type="radio"
                    name="accommodation"
                    checked={(requireAccommodation as string) === 'no'}
                    onChange={() => setRequireAccommodation('no')}
                    className="accommodation-37"
                  />
                  No
                </label>
              </div>

              <div
                className={`mt-8 grid gap-6 ${showPaymentSummary ? 'xl:grid-cols-[minmax(840px,1fr)_300px]' : ''}`}
              >
                <div className="accommodation-38">
                  <div className="accommodation-39">
                    <div className="accommodation-40">
                      <div className="accommodation-41">Travel Information</div>
                      <div className="accommodation-42">
                        <div className="accommodation-43">
                          <span className="accommodation-44">Check-in</span>
                          <span className="accommodation-45">Date</span>
                          <input
                            type="date"
                            value={checkIn.date}
                            onChange={(e) =>
                              setCheckIn((prev) => ({ ...prev, date: e.target.value }))
                            }
                            className="accommodation-46"
                            aria-label="Check-in date"
                          />
                          <span className="accommodation-47">Time</span>
                          <input
                            type="time"
                            value={checkIn.time}
                            onChange={(e) =>
                              setCheckIn((prev) => ({ ...prev, time: e.target.value }))
                            }
                            className="accommodation-48"
                            aria-label="Check-in time"
                          />
                        </div>
                        <div className="accommodation-49" />
                        <div className="accommodation-50">
                          <span className="accommodation-51">Check-out</span>
                          <span className="accommodation-52">Date</span>
                          <input
                            type="date"
                            value={checkOut.date}
                            onChange={(e) =>
                              setCheckOut((prev) => ({ ...prev, date: e.target.value }))
                            }
                            className="accommodation-53"
                            aria-label="Check-out date"
                          />
                          <span className="accommodation-54">Time</span>
                          <input
                            type="time"
                            value={checkOut.time}
                            onChange={(e) =>
                              setCheckOut((prev) => ({ ...prev, time: e.target.value }))
                            }
                            className="accommodation-55"
                            aria-label="Check-out time"
                          />
                        </div>
                        {dateError && <div className="accommodation-56">{dateError}</div>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="accommodation-57">Room Details</h3>
                    {hasOccupantLimitError && (
                      <div className="accommodation-58">
                        Maximum of 4 occupants per room reached.
                      </div>
                    )}
                    <div className="accommodation-59">
                      <table className="accommodation-60">
                        <thead>
                          <tr className="accommodation-61">
                            {['Rooms', 'Charge', 'Occupants', 'Days', 'Amount'].map(
                              (header, index) => (
                                <th
                                  key={header}
                                  className={`px-3 py-3 text-left text-sm font-semibold ${
                                    index === 0
                                      ? 'w-[30%]'
                                      : index === 1
                                        ? 'w-[16%]'
                                        : index === 2
                                          ? 'w-[19%]'
                                          : index === 3
                                            ? 'w-[16%]'
                                            : 'w-[19%]'
                                  }`}
                                >
                                  {header}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody className="accommodation-62">
                          {rooms.map((room) => (
                            <RoomRowItem
                              key={room.id}
                              room={room}
                              onChange={updateRoom}
                              isDaysReadOnly={Boolean(checkIn.date && checkOut.date)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setRooms((prev) => [...prev, createRoom(Date.now().toString())])
                        }
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-[#064675] border border-slate-200 transition"
                      >
                        + Add Room
                      </button>
                      {rooms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRooms((prev) => prev.slice(0, -1))}
                          className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 transition"
                        >
                          Remove Last Room
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {showPaymentSummary && (
                  <aside className="accommodation-63">
                    <div className="accommodation-64">
                      <div className="accommodation-65">
                        <CreditCard className="accommodation-66" />
                        <h3 className="accommodation-67">Payment Summary</h3>
                      </div>
                      <ChevronUp className="accommodation-68" />
                    </div>

                    <div className="accommodation-69">
                      <span className="accommodation-70">
                        Selected Rooms ({completeRooms.length})
                      </span>
                      <button type="button" onClick={clearRooms} className="accommodation-71">
                        Clear All
                      </button>
                    </div>

                    <div className="accommodation-72">
                      {completeRooms.length === 0 ? (
                        <div className="accommodation-73">
                          Complete room details to calculate accommodation amount.
                        </div>
                      ) : (
                        completeRooms.map((room) => (
                          <div key={room.id} className="accommodation-74">
                            <div className="accommodation-75">
                              <p className="accommodation-76">{room.roomType}</p>
                              <p className="accommodation-77">
                                {toNumber(room.occupants)} occupants x {toNumber(room.days)} days
                              </p>
                            </div>
                            <div className="accommodation-78">
                              <span className="accommodation-79">
                                ₹{calcAmount(room).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="accommodation-80">
                      <div className="accommodation-81">
                        <span>Total Amount</span>
                        <span className="accommodation-82">₹{totalAmount.toLocaleString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleProceed}
                        disabled={!canProceed}
                        className="accommodation-83"
                      >
                        Proceed to Payment →
                      </button>
                    </div>
                  </aside>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
