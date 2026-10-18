import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarPlus, Clock3, FileText, MapPin, UserRound } from 'lucide-react';
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
  allocated_room_count?: number | string | null;
  overall_status?: string | null;
}

interface GuesthouseBookingListResponse {
  items?: GuesthouseBooking[];
  total?: number;
  limit?: number;
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
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [displayDate, setDisplayDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'needs-room' | 'allocated'>('all');

  const isGuesthouseAdmin = getGuesthouseWorkflowStage(user) === 'guesthouse_admin';
  const selectedBookings = useMemo(
    () => bookings.filter((booking) => bookingIncludesDate(booking, selectedDate)),
    [bookings, selectedDate],
  );
  const allocatedRoomCount = selectedBookings.reduce(
    (total, booking) => total + Math.max(0, Number(booking.allocated_room_count) || 0),
    0,
  );
  const visibleBookings = useMemo(() => {
    if (bookingFilter === 'needs-room') return selectedBookings.filter((booking) => !booking.has_room_allocation);
    if (bookingFilter === 'allocated') return selectedBookings.filter((booking) => Number(booking.allocated_room_count) > 0);
    return selectedBookings;
  }, [bookingFilter, selectedBookings]);
  const totalPages = Math.max(1, Math.ceil(visibleBookings.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const pageBookings = visibleBookings.slice(pageStartIndex, pageStartIndex + pageSize);
  const unallocatedCount = selectedBookings.filter((booking) => !booking.has_room_allocation).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, pageSize, bookingFilter]);

  const { bookingCounts, unallocatedDateKeys } = useMemo(() => {
    const counts = new Map<string, number>();
    const unallocatedDates = new Set<string>();
    bookings.forEach((booking) => {
      const start = toDateKey(booking.check_in_date);
      const end = toDateKey(booking.check_out_date) || start;
      if (!start) return;
      const cursor = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);
      while (cursor <= last) {
        const key = toLocalDateKey(cursor);
        counts.set(key, (counts.get(key) || 0) + 1);
        if (!booking.has_room_allocation) unallocatedDates.add(key);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return { bookingCounts: counts, unallocatedDateKeys: unallocatedDates };
  }, [bookings]);

  useEffect(() => {
    const loadBookings = async () => {
      try {
        setLoading(true);
        setError('');
        const pageLimit = 100;
        const response = await authenticityUtility.get('/guesthouse', {
          params: { page: 1, limit: pageLimit },
        }) as GuesthouseBookingListResponse;
        const allBookings = Array.isArray(response?.items) ? [...response.items] : [];
        const total = Number(response?.total || allBookings.length);
        const totalPages = Math.ceil(total / pageLimit);
        for (let page = 2; page <= totalPages; page += 1) {
          const nextPage = await authenticityUtility.get('/guesthouse', {
            params: { page, limit: pageLimit },
          }) as GuesthouseBookingListResponse;
          const pageItems = Array.isArray(nextPage?.items) ? nextPage.items : [];
          if (!pageItems.length) break;
          allBookings.push(...pageItems);
        }
        setBookings(allBookings);
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
            <CalendarPlus size={18} aria-hidden="true" />
            <span>Add booking</span>
          </button>
        </div>

        {loading ? (
          <p className="guesthouse-calendar-state">Loading room booking requests…</p>
        ) : error ? (
          <p className="guesthouse-calendar-state guesthouse-calendar-state--error">{error}</p>
        ) : (
          <div className="guesthouse-calendar-summary" aria-label="Booking summary">
            <button type="button" aria-pressed={bookingFilter === 'all'} onClick={() => setBookingFilter('all')} className={`guesthouse-calendar-summary-card${bookingFilter === 'all' ? ' is-active' : ''}`}><strong>{selectedBookings.length}</strong><span>Total bookings</span></button>
            <button type="button" aria-pressed={bookingFilter === 'needs-room'} onClick={() => setBookingFilter('needs-room')} className={`guesthouse-calendar-summary-card guesthouse-calendar-summary-card--warning${bookingFilter === 'needs-room' ? ' is-active' : ''}`}><strong>{unallocatedCount}</strong><span>Need a room</span></button>
            <button type="button" aria-pressed={bookingFilter === 'allocated'} onClick={() => setBookingFilter('allocated')} className={`guesthouse-calendar-summary-card${bookingFilter === 'allocated' ? ' is-active' : ''}`}><strong>{allocatedRoomCount}</strong><span>Rooms allotted</span></button>
          </div>
        )}

        {!loading && !error && visibleBookings.length > 0 && (
          <div className="guesthouse-calendar-request-list">
            {pageBookings.map((booking) => {
              const allocated = Boolean(booking.has_room_allocation);
              return (
                <button
                  type="button"
                  className={`guesthouse-calendar-request ${allocated ? 'guesthouse-calendar-request--allocated' : 'guesthouse-calendar-request--unallocated'}`}
                  key={booking.id}
                  onClick={() => openBooking(booking)}
                >
                  <div className="guesthouse-calendar-request-top">
                    <span><FileText aria-hidden="true" /> {booking.proposal_ref || `#GH-${booking.id}`}</span>
                    <span
                      className="guesthouse-calendar-stay-dates"
                      title={formatStayRange(booking.check_in_date, booking.check_out_date)}
                    >
                      <Clock3 aria-hidden="true" /> {formatStayRange(booking.check_in_date, booking.check_out_date)}
                    </span>
                    <span className={`allocation-status ${isGuesthouseAdmin ? 'allocation-action' : allocated ? 'allocated' : 'pending'}`}>
                      {isGuesthouseAdmin
                        ? 'Open room allocation →'
                        : allocated
                          ? 'Room allocated'
                          : 'Room not allocated'}
                    </span>
                  </div>
                  <div className="guesthouse-calendar-request-bottom">
                    <span><UserRound aria-hidden="true" /> {booking.applicant_name || booking.primary_head || 'Guesthouse request'}</span>
                    <span><MapPin aria-hidden="true" /> {booking.guest_details || 'Open request details'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {!loading && !error && visibleBookings.length > 0 && (
          <div className="guesthouse-calendar-pagination">
            <div className="guesthouse-calendar-pagination-left">
              <label className="guesthouse-calendar-pagination-label" htmlFor="guesthouse-calendar-page-size">Rows per page</label>
              <select className="guesthouse-calendar-page-size" id="guesthouse-calendar-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
              </select>
              <span className="guesthouse-calendar-pagination-count">{pageStartIndex + 1}-{Math.min(pageStartIndex + pageSize, visibleBookings.length)} of {visibleBookings.length}</span>
            </div>
            <div className="guesthouse-calendar-pagination-right">
              <button type="button" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button>
              <span className="guesthouse-calendar-page-indicator">Page {safeCurrentPage} of {totalPages}</span>
              <button type="button" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next</button>
            </div>
          </div>
        )}
        {!loading && !error && visibleBookings.length === 0 && (
          <p className="guesthouse-calendar-state">{selectedBookings.length === 0 ? 'No rooms booked for this day.' : 'No bookings match this selection.'}</p>
        )}
      </section>

      <section className="guesthouse-calendar-panel">
        <h2>Calendar</h2>
        <div className="guesthouse-calendar-toolbar">
          <button type="button" onClick={goToToday}>Today</button>
          <div className="guesthouse-calendar-month-navigation">
            <button type="button" onClick={goToPreviousMonth} aria-label="Previous month"><ArrowLeft size={18} aria-hidden="true" /></button>
            <strong>{displayDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</strong>
            <button type="button" onClick={goToNextMonth} aria-label="Next month"><ArrowRight size={18} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="guesthouse-calendar-legend">
          <span aria-hidden="true" />
          <span>Some bookings on this day still need a room</span>
        </div>
        <div className="guesthouse-calendar-grid">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={false}
            fixedWeekCount={false}
            expandRows
            height="100%"
            dateClick={(info) => {
              setSelectedDate(toLocalDateKey(info.date));
              calendarRef.current?.getApi().gotoDate(info.date);
            }}
            datesSet={syncDisplayDate}
            dayCellClassNames={(arg) =>
              toLocalDateKey(arg.date) === selectedDate ? 'guesthouse-calendar-selected-date' : ''
            }
            dayCellContent={(arg) => {
              const dateKey = toLocalDateKey(arg.date);
              const count = bookingCounts.get(dateKey) || 0;
              return (
                  <div className="guesthouse-calendar-day-content">
                  <span className="guesthouse-calendar-day-number">{arg.dayNumberText}</span>
                  {count > 0 && <span className="guesthouse-calendar-day-count"><b>{count}</b><small>booking{count === 1 ? '' : 's'}</small></span>}
                  {count > 0 && unallocatedDateKeys.has(dateKey) && <i className="guesthouse-calendar-unallocated-dot" title="Some bookings need a room" />}
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
