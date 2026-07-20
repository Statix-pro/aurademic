import { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronUp, CreditCard, Calendar, Home } from 'lucide-react'
import { useEvents } from '../../context/EventsContext'
import type { EventItem } from '../../types'

type RoomRow = {
  id: string
  roomType: string
  charge: string
  occupants: string
  days: string
}

const ROOM_TYPES = [
  'Single Room',
  'Double Room',
  'Triple Room',
  'Dormitory',
  'AC Room',
  'Non-AC Room',
]

const ROOM_CHARGES: Record<string, number> = {
  'Single Room': 1200,
  'Double Room': 1800,
  'Triple Room': 2400,
  Dormitory: 800,
  'AC Room': 2200,
  'Non-AC Room': 1500,
}

const MAX_OCCUPANTS = 4

function createRoom(id = Date.now().toString()): RoomRow {
  return { id, roomType: '', charge: '', occupants: '', days: '' }
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function getFixedCharge(roomType: string) {
  return roomType ? ROOM_CHARGES[roomType] ?? 0 : 0
}

function getOccupancyLimit() {
  return MAX_OCCUPANTS
}

function calcAmount(room: RoomRow) {
  return toNumber(room.charge) * toNumber(room.occupants) * toNumber(room.days)
}

function isRoomComplete(room: RoomRow) {
  const occupants = toNumber(room.occupants)
  const days = toNumber(room.days)
  const limit = getOccupancyLimit()
  const withinLimit = !limit || occupants <= limit

  return Boolean(room.roomType && room.charge && occupants && days && withinLimit)
}

function RoomRowItem({
  room,
  onChange,
  isDaysReadOnly,
}: {
  room: RoomRow
  onChange: (id: string, field: keyof Omit<RoomRow, 'id'>, value: string) => void
  isDaysReadOnly?: boolean
}) {
  const inputCls =
    'h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none transition focus:border-[#064675] focus:ring-2 focus:ring-[#064675]/15'
  const amount = calcAmount(room)
  const fixedCharge = getFixedCharge(room.roomType)

  return (
    <tr className="border-b border-slate-200 last:border-0">
      <td className="px-3 py-3">
        <select
          value={room.roomType}
          onChange={e => onChange(room.id, 'roomType', e.target.value)}
          className={inputCls}
        >
          <option value="">Select room</option>
          {ROOM_TYPES.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <input
          value={room.roomType ? fixedCharge.toString() : ''}
          readOnly
          className={`${inputCls} bg-slate-50 text-slate-600`}
          placeholder="Charge"
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min="1"
          max={MAX_OCCUPANTS}
          value={room.occupants}
          onChange={e => onChange(room.id, 'occupants', e.target.value)}
          className={inputCls}
          placeholder="Occupants"
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min="1"
          value={room.days}
          onChange={e => onChange(room.id, 'days', e.target.value)}
          readOnly={isDaysReadOnly}
          className={`${inputCls} ${isDaysReadOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
          placeholder="Days"
        />
      </td>
      <td className="px-3 py-3">
        <input
          value={amount ? amount.toString() : ''}
          readOnly
          className={`${inputCls} bg-slate-50 text-slate-600`}
          placeholder="Amount"
        />
      </td>
    </tr>
  )
}

export default function Accommodation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { getRegistration, registrations, events } = useEvents()
  const [requireAccommodation, setRequireAccommodation] = useState<'yes' | 'no' | null>(null)
  const [rooms, setRooms] = useState<RoomRow[]>([createRoom('1')])
  const [checkIn, setCheckIn] = useState({ date: '', time: '' })
  const [checkOut, setCheckOut] = useState({ date: '', time: '' })

  const isAiHackathon = (event: EventItem) => event.eventName === 'AI Hackathon 2026'
  const getMultiEventStateLabel = (event: EventItem, registration?: any) => {
    if (registration?.reviewStatus === 'selected') return 'Selected'
    if (registration?.reviewStatus === 'rejected') return 'Rejected'
    if (event.eventName === 'Build Battle') return 'Selected'
    if (event.eventName === 'Idea Pitch') return 'Rejected'
    return ''
  }
  const isPayableEvent = (event: EventItem, registration: any) => {
    if (registration.paymentStatus === 'paid') return false
    if (isAiHackathon(event)) return registration.reviewStatus === 'selected'
    if (event.category === 'MULTI-EVENTS') {
      const multiEventState = getMultiEventStateLabel(event, registration)
      if (multiEventState === 'Rejected') return false
    }
    return registration.formStatus === 'ready'
  }
  const flattenEvents = (items: EventItem[]) => {
    return items.flatMap(event => {
      if (event.category === 'MULTI-EVENTS') {
        return (event.subEvents ?? []).map(subEvent => ({
          ...event,
          id: `${event.id}-${subEvent.id}`,
          eventName: subEvent.eventName,
          parentEventName: event.eventName,
          category: subEvent.category ?? event.category,
          participation: subEvent.participation,
          fees: subEvent.fees,
          feesUnit: subEvent.feesUnit,
          teamSize: subEvent.participation === 'Team' ? event.teamSize : undefined,
          subEvents: undefined,
        }))
      }
      return [event]
    })
  }

  const allDisplayEvents = useMemo(() => flattenEvents(events), [events])
  const paymentEvents = useMemo(
    () => allDisplayEvents.filter(event => {
      const registration = registrations[event.id]
      return Boolean(registration && isPayableEvent(event, registration))
    }),
    [allDisplayEvents, registrations],
  )
  const paymentTotal = paymentEvents.reduce((sum, event) => sum + event.fees, 0)

  const dateError = useMemo(() => {
    if (!checkIn.date || !checkOut.date) return ''
    const start = new Date(checkIn.date)
    const end = new Date(checkOut.date)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return ''
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) {
      return 'Check-out date must be after check-in date.'
    }
    if (diffDays > 10) {
      return 'Accommodation cannot exceed 10 days.'
    }
    return ''
  }, [checkIn.date, checkOut.date])

  const calculatedDays = useMemo(() => {
    if (!checkIn.date || !checkOut.date) return null
    const start = new Date(checkIn.date)
    const end = new Date(checkOut.date)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }, [checkIn.date, checkOut.date])

  useEffect(() => {
    if (dateError) {
      setRooms(prev => prev.map(room => ({ ...room, days: '' })))
    } else if (calculatedDays !== null && calculatedDays > 0 && calculatedDays <= 10) {
      setRooms(prev => prev.map(room => ({ ...room, days: calculatedDays.toString() })))
    }
  }, [calculatedDays, dateError])

  const completeRooms = useMemo(() => rooms.filter(isRoomComplete), [rooms])
  const totalAmount = useMemo(() => completeRooms.reduce((sum, room) => sum + calcAmount(room), 0), [completeRooms])
  const isTravelComplete = Boolean(checkIn.date && checkIn.time && checkOut.date && checkOut.time)
  const hasOccupantLimitError = rooms.some(room => toNumber(room.occupants) > MAX_OCCUPANTS)
  const canProceed = requireAccommodation === 'yes' && isTravelComplete && !dateError && completeRooms.length > 0
  const showPaymentSummary = canProceed
  const useTallOuterCard = requireAccommodation === 'yes'

  const updateRoom = (id: string, field: keyof Omit<RoomRow, 'id'>, value: string) => {
    setRooms(prev =>
      prev.map(room => {
        if (room.id !== id) return room
        if (field === 'roomType') {
          const fixedCharge = getFixedCharge(value)
          return {
            ...room,
            roomType: value,
            charge: fixedCharge ? fixedCharge.toString() : '',
            occupants: '',
          }
        }
        return { ...room, [field]: value }
      }),
    )
  }

  const clearRooms = () => {
    setRooms([createRoom('1')])
  }

  const handleProceed = () => {
    if (!canProceed) return

    const selectedRoom = completeRooms[0]
    const roomCount = completeRooms.length
    const roomLabel = roomCount > 1 ? `${roomCount} Rooms` : selectedRoom.roomType || 'Accommodation'

    navigate('/payment', {
      state: {
        ...location.state,
        selectedEvents: [],
        accommodation: {
          optionId: selectedRoom.id,
          roomType: roomLabel,
          nights: completeRooms.reduce((sum, room) => sum + toNumber(room.days), 0) || 1,
          pricePerNight: totalAmount,
        },
        total: totalAmount,
      },
    })
  }

  return (
    <div className="min-h-[calc(100vh-48px)] flex-1 overflow-auto bg-[#eaf2fb] px-4 py-8 sm:px-6 md:py-10">
      <div className="mx-auto w-full max-w-[1200px] space-y-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-[#064675]">Event Lists</h2>
            </div>
          </div>
        </div>

        <section className="min-h-[300px] rounded-[22px] bg-white p-6 text-slate-800 shadow-sm border border-slate-300 dark:bg-slate-800 dark:border-slate-700">
          <div className="mb-7 border-b border-slate-100 px-1">
            <div className="flex items-center gap-8">
              <button
                onClick={() => navigate('/event-register', { state: { ...location.state } })}
                className="px-2 py-4 text-sm font-medium text-slate-600 hover:text-[#064675] transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Events
                </span>
              </button>
              <button className="border-b-2 border-[#064675] px-2 py-4 text-sm font-semibold text-[#064675]">
                <span className="inline-flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Accommodation
                </span>
              </button>
              <button
                onClick={() => navigate('/payment', { state: { ...location.state, selectedEvents: paymentEvents, total: paymentTotal } })}
                className="px-2 py-4 text-sm font-medium text-slate-600 hover:text-[#064675] transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment
                </span>
              </button>
            </div>
          </div>

          {requireAccommodation !== 'yes' ? (
            <div className="mx-auto max-w-md py-8">
              <div className="text-center">
                <h2 className="text-xl font-bold text-[#064675]">Accommodation Requirement</h2>
                <p className="mt-2 text-sm text-slate-500">Do you need accommodation?</p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRequireAccommodation('yes')}
                    className="rounded-xl bg-[#064675] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#05375c]"
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
                  <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                    No accommodation details required.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="mt-4 flex items-center gap-6 text-sm font-semibold">
                <label className="flex cursor-pointer items-center gap-2 text-[#064675]">
                  <input
                    type="radio"
                    name="accommodation"
                    checked={requireAccommodation === 'yes'}
                    onChange={() => setRequireAccommodation('yes')}
                    className="h-4 w-4 accent-[#064675]"
                  />
                  Yes
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-slate-500 hover:text-slate-700">
                  <input
                    type="radio"
                    name="accommodation"
                    checked={requireAccommodation === 'no'}
                    onChange={() => setRequireAccommodation('no')}
                    className="h-4 w-4 accent-[#064675]"
                  />
                  No
                </label>
              </div>

              <div className={`mt-8 grid gap-6 ${showPaymentSummary ? 'xl:grid-cols-[minmax(840px,1fr)_300px]' : ''}`}>
                <div className="min-w-0 space-y-8">
                  <div className="border-t border-slate-200 pt-8">
                    <div className="mx-auto w-full rounded-2xl border border-slate-300 bg-slate-50/50 shadow-sm">
                      <div className="rounded-t-[15px] bg-[#064675] px-4 py-2.5 text-center text-sm font-semibold text-white">
                        Travel Information
                      </div>
                      <div className="space-y-4 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <span className="rounded-md bg-[#064675] px-3 py-1 text-sm font-semibold text-white">
                            Check-in
                          </span>
                          <span className="text-sm font-medium text-slate-600">Date</span>
                          <input
                            type="date"
                            value={checkIn.date}
                            onChange={e => setCheckIn(prev => ({ ...prev, date: e.target.value }))}
                            className="h-9 w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#064675] focus:ring-2 focus:ring-[#064675]/15"
                          />
                          <span className="text-sm font-medium text-slate-600">Time</span>
                          <input
                            type="time"
                            value={checkIn.time}
                            onChange={e => setCheckIn(prev => ({ ...prev, time: e.target.value }))}
                            className="h-9 w-[120px] rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#064675] focus:ring-2 focus:ring-[#064675]/15"
                          />
                        </div>
                        <div className="h-px bg-slate-200" />
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <span className="rounded-md bg-[#064675] px-3 py-1 text-sm font-semibold text-white">
                            Check-out
                          </span>
                          <span className="text-sm font-medium text-slate-600">Date</span>
                          <input
                            type="date"
                            value={checkOut.date}
                            onChange={e => setCheckOut(prev => ({ ...prev, date: e.target.value }))}
                            className="h-9 w-[140px] rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#064675] focus:ring-2 focus:ring-[#064675]/15"
                          />
                          <span className="text-sm font-medium text-slate-600">Time</span>
                          <input
                            type="time"
                            value={checkOut.time}
                            onChange={e => setCheckOut(prev => ({ ...prev, time: e.target.value }))}
                            className="h-9 w-[120px] rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#064675] focus:ring-2 focus:ring-[#064675]/15"
                          />
                        </div>
                        {dateError && (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 mt-2">
                            {dateError}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#064675]">Room Details</h3>
                    {hasOccupantLimitError && (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600">
                        Maximum of team members reached.
                      </div>
                    )}
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                      <table className="w-full table-fixed">
                        <thead>
                          <tr className="bg-[#064675] text-white">
                            {['Rooms', 'Charge', 'Occupants', 'Days', 'Amount'].map((header, index) => (
                              <th
                                key={header}
                                className={`px-3 py-3 text-left text-sm font-semibold ${
                                  index === 0 ? 'w-[30%]' :
                                  index === 1 ? 'w-[16%]' :
                                  index === 2 ? 'w-[19%]' :
                                  index === 3 ? 'w-[16%]' :
                                  'w-[19%]'
                                }`}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {rooms.map(room => (
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
                  </div>
                </div>

                {showPaymentSummary && (
                  <aside className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-[#064675]" />
                        <h3 className="text-sm font-bold text-slate-800">Payment Summary</h3>
                      </div>
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-500">Selected Rooms ({completeRooms.length})</span>
                      <button
                        type="button"
                        onClick={clearRooms}
                        className="text-xs font-semibold text-rose-500 transition-colors hover:text-rose-600"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {completeRooms.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-500">
                          Complete room details to calculate accommodation amount.
                        </div>
                      ) : (
                        completeRooms.map(room => (
                          <div
                            key={room.id}
                            className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800">{room.roomType}</p>
                              <p className="text-[11px] text-slate-400">
                                {toNumber(room.occupants)} occupants x {toNumber(room.days)} days
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-emerald-600">₹{calcAmount(room).toLocaleString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                        <span>Total Amount</span>
                        <span className="text-[#064675]">₹{totalAmount.toLocaleString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleProceed}
                        disabled={!canProceed}
                        className="mt-4 w-full rounded-xl bg-[#064675] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#05375c] disabled:cursor-not-allowed disabled:opacity-40"
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
  )
}
