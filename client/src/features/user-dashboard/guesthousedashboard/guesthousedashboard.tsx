import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import React, { useEffect, useRef, useState } from 'react';

import './guesthousedashboard.css'; // Fixed spelling
import { FaRegClock, FaBuilding, FaLayerGroup, FaMapMarkerAlt, FaPlus } from 'react-icons/fa'; // ← Named imports

interface EventType {
  category: string;
  department: string;
  time: string;
  name: string;
  venue: string;
  date: string;
}

const allEvents: EventType[] = [
  {
    category: 'Workshop',
    department: 'EE VLSI DT',
    time: '09:00 AM - 12:30 PM',
    name: '3D Printing Materials',
    venue: 'Cyberdome',
    date: '2025-10-07',
  },
  {
    category: 'Seminar',
    department: 'Computer Science',
    time: '01:00 PM - 03:00 PM',
    name: 'AI in Industry 4.0',
    venue: 'Innovation Lab',
    date: '2025-10-09',
  },
  {
    category: 'Competition',
    department: 'SM Volunteers',
    time: '03:30 PM - 05:30 PM',
    name: 'Robotics Challenge',
    venue: 'Robotics Lab',
    date: '2025-10-07',
  },
  {
    category: 'Workshop',
    department: 'Civil',
    time: '10:00 AM - 01:00 PM',
    name: 'Sustainable Materials',
    venue: 'Auditorium',
    date: '2025-10-12',
  },
];

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
  const dayName = date.toLocaleDateString('en-US', options);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year} (${dayName})`;
};

const GuestHouseDashboard: React.FC = () => {
  const calendarRef = useRef<FullCalendar | null>(null);
  const rightFrameRef = useRef<HTMLDivElement | null>(null);
  const leftFrameRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [filteredEvents, setFilteredEvents] = useState<EventType[]>([]);

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const years = Array.from({ length: 16 }, (_, i) => 2020 + i);

  // Compute height of calendar/right frame
  const computeCalendarHeight = () => {
    const rightFrame = rightFrameRef.current;
    const header = headerRef.current;
    if (!rightFrame) return;

    const frameRect = rightFrame.getBoundingClientRect();
    const headerH = header ? header.getBoundingClientRect().height : 0;

    let avail = Math.floor(frameRect.height - headerH - 10);
    if (window.innerWidth < 480) avail = Math.max(300, avail);
    else if (window.innerWidth < 768) avail = Math.max(400, avail);
    else avail = Math.max(200, avail);

    // Sync left frame height
    if (leftFrameRef.current) {
      leftFrameRef.current.style.height = `${frameRect.height}px`;
    }
  };

  useEffect(() => {
    computeCalendarHeight();
    window.addEventListener('resize', computeCalendarHeight);
    return () => window.removeEventListener('resize', computeCalendarHeight);
  }, [filteredEvents]);

  useEffect(() => {
    setFilteredEvents(allEvents.filter((e) => e.date === selectedDate));
  }, [selectedDate]);

  const handleDateClick = (info: any) => {
    const clickedDate = info.date;
    const yyyy = clickedDate.getFullYear();
    const mm = String(clickedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(clickedDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    setSelectedDate(dateStr);
    setFilteredEvents(allEvents.filter((e) => e.date === dateStr));
  };

  // Calendar navigation
  const handlePrevMonth = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.prev();
    const newDate = api.getDate();
    setDisplayMonth(newDate.getMonth());
    setMonth(newDate.getMonth());
    setDisplayYear(newDate.getFullYear());
    setYear(newDate.getFullYear());
  };

  const handleNextMonth = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.next();
    const newDate = api.getDate();
    setDisplayMonth(newDate.getMonth());
    setMonth(newDate.getMonth());
    setDisplayYear(newDate.getFullYear());
    setYear(newDate.getFullYear());
  };

  const handleTodayClick = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.today();
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];
    setSelectedDate(nowStr);
    setDisplayMonth(now.getMonth());
    setMonth(now.getMonth());
    setDisplayYear(now.getFullYear());
    setYear(now.getFullYear());
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value);
    setMonth(newMonth);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.gotoDate(new Date(year, newMonth, 1));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value);
    setYear(newYear);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.gotoDate(new Date(newYear, month, 1));
  };

  return (
    <div className="guesthouse-dashboard-wrapper">
      <div className="guesthouse-dashboard-container">
        <div className="guesthouse-dashboard-main">
          {/* LEFT FRAME */}
          <div className="left-frame" ref={leftFrameRef} style={{ position: 'relative' }}>
            <div className="frame-top-actions">
              <button
                className="add-booking-btn"
                onClick={() => (window.location.href = '/guesthouse-booking')}
              >
                Add +
              </button>
            </div>

            <h3>{selectedDate ? formatDate(selectedDate) : 'All Upcoming Events'}</h3>

            {filteredEvents.length === 0 ? (
              <p className="no-events">No rooms booked for this day.</p>
            ) : (
              filteredEvents.map((event, index) => (
                <div
                  className="event-card"
                  key={index}
                  onClick={() => setSelectedEvent(event)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="event-top">
                    <span className="event-category">
                      <FaLayerGroup className="icon" />
                      {event.category}
                    </span>
                    <span className="event-department">
                      <FaBuilding className="icon" />
                      {event.department}
                    </span>
                    <span className="event-time">
                      <FaRegClock className="icon" />
                      {event.time}
                    </span>
                  </div>
                  <div className="event-bottom">
                    <span className="event-name">{event.name}</span>
                    <span className="event-venue">
                      <FaMapMarkerAlt className="icon" />
                      {event.venue}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* RIGHT FRAME */}
          <div className="right-frame" ref={rightFrameRef}>
            <h3 ref={headerRef}> Calendar</h3>

            <div className="calendar-header">
              <div className="calendar-left">
                <button className="today-btn" onClick={handleTodayClick}>
                  Today
                </button>
              </div>
              <div className="month-year-container">
                <button className="nav-btn nav-prev" onClick={handlePrevMonth}></button>
                <span className="month-year-text">
                  {months[displayMonth]} {displayYear}
                </span>
                <button className="nav-btn nav-next" onClick={handleNextMonth}></button>
              </div>
              <div className="calendar-right">
                <select className="month-select" value={month} onChange={handleMonthChange}>
                  {months.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
                <select className="year-select" value={year} onChange={handleYearChange}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="calendar-wrapper">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                events={allEvents.map((e) => ({
                  title: e.name,
                  date: e.date,
                }))}
                dateClick={handleDateClick}
                eventDisplay="none"
                headerToolbar={false}
                dayCellClassNames={(arg) => {
                  const date = arg.date;
                  const yyyy = date.getFullYear();
                  const mm = String(date.getMonth() + 1).padStart(2, '0');
                  const dd = String(date.getDate()).padStart(2, '0');
                  const cellDateStr = `${yyyy}-${mm}-${dd}`;
                  return cellDateStr === selectedDate ? 'selected-date' : '';
                }}
                dayCellContent={(arg) => {
                  const date = arg.date;
                  const yyyy = date.getFullYear();
                  const mm = String(date.getMonth() + 1).padStart(2, '0');
                  const dd = String(date.getDate()).padStart(2, '0');
                  const cellDateStr = `${yyyy}-${mm}-${dd}`;
                  const eventCount = allEvents.filter((e) => e.date === cellDateStr).length;
                  const isSunday = date.getDay() === 0;
                  return (
                    <div className={`fc-day-content-inline ${isSunday ? 'sunday-red' : ''}`}>
                      <div className="inline-day-number">{arg.dayNumberText}</div>
                      {eventCount > 0 && (
                        <div className={`event-badge event-count-${Math.min(eventCount, 10)}`}>
                          {eventCount === 9 ? '9+' : eventCount}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestHouseDashboard;
