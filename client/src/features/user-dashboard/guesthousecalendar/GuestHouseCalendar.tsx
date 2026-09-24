import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaBuilding, FaLayerGroup, FaMapMarkerAlt, FaRegClock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { getGuesthouseWorkflowStage } from '../../../shared/utils/permissionUtils';
import './GuestHouseCalendar.css';

interface GuesthouseBooking {
  id: number;
  proposal_ref?: string | null;
  applicant_name?: string | null;
  primary_head?: string | null;
  guest_details?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  has_room_allocation?: boolean | number;
  overall_status?: string | null;
}

const toDateKey = (value?: string | null) => String(value || '').slice(0, 10);

// FullCalendar hands day cells to us in local time. Converting them through
// toISOString() moves Indian midnight into the previous UTC day.
const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const formatDate = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long',
  }).format(date).replace(',', '');
};

const formatStayDate = (value?: string | null) => {
  const dateKey = toDateKey(value);
  if (!dateKey) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00`));
};

const formatStayRange = (checkIn?: string | null, checkOut?: string | null) => {
  const start = formatStayDate(checkIn);
  const end = formatStayDate(checkOut);
  if (!start) return 'Dates not specified';
  return end && end !== start ? `${start} – ${end}` : start;
};

const bookingIncludesDate = (booking: GuesthouseBooking, dateKey: string) => {
  const checkIn = toDateKey(booking.check_in_date);
  const checkOut = toDateKey(booking.check_out_date) || checkIn;
  return Boolean(checkIn && dateKey >= checkIn && dateKey <= checkOut);
};

const GuestHouseCalendar: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar | null>(null);
  const todayKey = toLocalDateKey(new Date());
  const today = new Date();
  const [bookings, setBookings] = useState<GuesthouseBooking[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [displayDate, setDisplayDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isGuesthouseAdmin = getGuesthouseWorkflowStage(user) === 'guesthouse_admin';
  const selectedBookings = useMemo(
    () => bookings.filter((booking) => bookingIncludesDate(booking, selectedDate)),
    [bookings, selectedDate],
  );

  const bookingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    bookings.forEach((booking) => {
      const start = toDateKey(booking.check_in_date);
      const end = toDateKey(booking.check_out_date) || start;
      if (!start) return;
      const cursor = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);
      while (cursor <= last) {
        const key = toLocalDateKey(cursor);
        counts.set(key, (counts.get(key) || 0) + 1);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return counts;
  }, [bookings]);

  useEffect(() => {
    const loadBookings = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await authenticityUtility.get('/guesthouse') as { items?: GuesthouseBooking[] };
        setBookings(Array.isArray(response?.items) ? response.items : []);
      } catch (loadError) {
        console.error('Unable to load guesthouse calendar bookings', loadError);
        setError('Unable to load guesthouse requests. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void loadBookings();
  }, []);

  const syncDisplayDate = () => {
    const date = calendarRef.current?.getApi().getDate();
    if (date) setDisplayDate(date);
  };

  const goToToday = () => {
    calendarRef.current?.getApi().today();
    setSelectedDate(todayKey);
    syncDisplayDate();
  };

  const goToPreviousMonth = () => {
    calendarRef.current?.getApi().prev();
    syncDisplayDate();
  };

  const goToNextMonth = () => {
    calendarRef.current?.getApi().next();
    syncDisplayDate();
  };

  const openBooking = (booking: GuesthouseBooking) => {
    navigate(`/guesthouse/${booking.id}${isGuesthouseAdmin ? '?allotment=true' : ''}`);
  };

  return (
    <main className="guesthouse-calendar-page">
      <section className="guesthouse-calendar-details-panel">
        <div className="guesthouse-calendar-panel-heading">
          <div>
            <h1>{formatDate(selectedDate)}</h1>
            <p>{selectedBookings.length} room booking request{selectedBookings.length === 1 ? '' : 's'} for this day</p>
          </div>
          <button type="button" className="guesthouse-calendar-add-button" onClick={() => navigate('/guesthouse/new')}>
            Add +
          </button>
        </div>

        {loading ? (
          <p className="guesthouse-calendar-state">Loading room booking requests…</p>
        ) : error ? (
          <p className="guesthouse-calendar-state guesthouse-calendar-state--error">{error}</p>
        ) : selectedBookings.length === 0 ? (
          <p className="guesthouse-calendar-state">No rooms booked for this day.</p>
        ) : (
          <div className="guesthouse-calendar-request-list">
            {selectedBookings.map((booking) => {
              const allocated = Boolean(booking.has_room_allocation);
              return (
                <button type="button" className="guesthouse-calendar-request" key={booking.id} onClick={() => openBooking(booking)}>
                  <div className="guesthouse-calendar-request-top">
                    <span><FaLayerGroup /> {booking.proposal_ref || `#GH-${booking.id}`}</span>
                    <span
                      className="guesthouse-calendar-stay-dates"
                      title={formatStayRange(booking.check_in_date, booking.check_out_date)}
                    >
                      <FaRegClock /> {formatStayRange(booking.check_in_date, booking.check_out_date)}
                    </span>
                    <span className={allocated ? 'allocation-status allocated' : 'allocation-status pending'}>
                      {allocated ? 'Room allocated' : 'Room not allocated'}
                    </span>
                  </div>
                  <div className="guesthouse-calendar-request-bottom">
                    <span><FaBuilding /> {booking.applicant_name || booking.primary_head || 'Guesthouse request'}</span>
                    <span><FaMapMarkerAlt /> {booking.guest_details || 'Open request details'}</span>
                  </div>
                  {isGuesthouseAdmin && <span className="guesthouse-calendar-allocation-action">Open room allocation →</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="guesthouse-calendar-panel">
        <h2>Calendar</h2>
        <div className="guesthouse-calendar-toolbar">
          <button type="button" onClick={goToToday}>Today</button>
          <div className="guesthouse-calendar-month-navigation">
            <button type="button" onClick={goToPreviousMonth} aria-label="Previous month">‹</button>
            <strong>{displayDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</strong>
            <button type="button" onClick={goToNextMonth} aria-label="Next month">›</button>
          </div>
        </div>
        <div className="guesthouse-calendar-grid">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={false}
            fixedWeekCount={false}
            dateClick={(info) => setSelectedDate(info.dateStr)}
            datesSet={syncDisplayDate}
            dayCellClassNames={(arg) =>
              toLocalDateKey(arg.date) === selectedDate ? 'guesthouse-calendar-selected-date' : ''
            }
            dayCellContent={(arg) => {
              const dateKey = toLocalDateKey(arg.date);
              const count = bookingCounts.get(dateKey) || 0;
              return (
                <div className="guesthouse-calendar-day-content">
                  <span>{arg.dayNumberText}</span>
                  {count > 0 && <b>{count}</b>}
                </div>
              );
            }}
          />
        </div>
      </section>
    </main>
  );
};

export default GuestHouseCalendar;
