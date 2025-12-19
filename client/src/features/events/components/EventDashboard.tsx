import React, { useEffect, useRef, useState, ChangeEvent } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { DayCellContentArg } from "@fullcalendar/core";
import EventDetailsPopup from "./EventDetailsPopup";
import { Clock, Building2, Layers, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Navbar from "../../..//shared/components/layout/navbar/navbar";
import "../styles/Dashboard.css";

interface EventData {
  category: string;
  department: string;
  time: string;
  name: string;
  venue: string;
  date: string;
}

const allEvents: EventData[] = [
  {
    category: "Workshop",
    department: "EE (VLSI D&T)",
    time: "09:00 AM - 12:30 PM",
    name: "3D Printing Materials Mechanical Engineering Mechanical Engineering Mechanical Engineering",
    venue: "Cyberdome",
    date: "2025-10-07",
  },
  {
    category: "Seminar",
    department: "Computer Science",
    time: "01:00 PM - 03:00 PM",
    name: "AI in Industry 4.0",
    venue: "Innovation Lab",
    date: "2025-10-09",
  },
  {
    category: "Competition",
    department: "SM Volunteers",
    time: "03:30 PM - 05:30 PM",
    name: "Robotics Challenge",
    venue: "Robotics Lab",
    date: "2025-10-07",
  },
  {
    category: "Workshop",
    department: "Civil",
    time: "10:00 AM - 01:00 PM",
    name: "Sustainable Materials",
    venue: "Auditorium",
    date: "2025-10-12",
  },
];

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { weekday: "long" };
  const dayName = date.toLocaleDateString("en-US", options);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year} (${dayName})`;
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);
  const rightFrameRef = useRef<HTMLDivElement>(null);
  const leftFrameRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLHeadingElement>(null);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [displayMonth, setDisplayMonth] = useState(today.getMonth());
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [filteredEvents, setFilteredEvents] = useState<EventData[]>(
    allEvents.filter((e) => e.date === todayStr),
  );
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const years: number[] = [];
  for (let i = 2020; i <= 2035; i++) years.push(i);

  const computeCalendarHeight = () => {
    const rightFrame = rightFrameRef.current;
    const header = headerRef.current;
    if (!rightFrame) return;
    const frameRect = rightFrame.getBoundingClientRect();
    const headerH = header ? header.getBoundingClientRect().height : 0;

    let avail = Math.floor(frameRect.height - headerH - 10);
    if (window.innerWidth <= 480) avail = Math.max(300, avail);
    else if (window.innerWidth <= 768) avail = Math.max(400, avail);

    if (leftFrameRef.current)
      leftFrameRef.current.style.height = `${frameRect.height}px`;
  };

  useEffect(() => {
    computeCalendarHeight();
    window.addEventListener("resize", computeCalendarHeight);
    return () => window.removeEventListener("resize", computeCalendarHeight);
  }, [filteredEvents]);

  useEffect(() => {
    setFilteredEvents(allEvents.filter((e) => e.date === selectedDate));
  }, [selectedDate]);

  const handleDateClick = (info: DateClickArg) => {
    const clickedDate = info.date;
    const yyyy = clickedDate.getFullYear();
    const mm = String(clickedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(clickedDate.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    setSelectedDate(dateStr);
    setFilteredEvents(allEvents.filter((e) => e.date === dateStr));
  };

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
    const nowStr = now.toISOString().split("T")[0];
    setSelectedDate(nowStr);
    setDisplayMonth(now.getMonth());
    setMonth(now.getMonth());
    setDisplayYear(now.getFullYear());
    setYear(now.getFullYear());
  };

  const handleMonthChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value);
    setMonth(newMonth);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.gotoDate(new Date(year, newMonth, 1));
  };

  const handleYearChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value);
    setYear(newYear);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.gotoDate(new Date(newYear, month, 1));
  };

  return (
    <div>
      <Navbar />
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="dashboard-main">
            <div className="left-frame" ref={leftFrameRef}>
              <h3>
                {selectedDate
                  ? `Events scheduled on ${formatDate(selectedDate)}`
                  : "All Upcoming Events"}
              </h3>
              {filteredEvents.length === 0 ? (
                <p className="no-events">No events scheduled for this day.</p>
              ) : (
                filteredEvents.map((event, index) => (
                  <div
                    className="event-card"
                    key={index}
                    onClick={() => setSelectedEvent(event)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="event-top">
                      <span className="event-category">
                        <Layers size={16} className="icon" /> {event.category}
                      </span>
                      <span className="event-time">
                        <Clock size={16} className="icon" /> {event.time}
                      </span>
                      <span className="event-department">
                        <Building2 size={16} className="icon" /> {event.department}
                      </span>
                    </div>
                    <div className="event-bottom">
                      <span className="event-name">{event.name}</span>
                      <span className="event-venue">
                        <MapPin size={16} className="icon" /> {event.venue}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="right-frame" ref={rightFrameRef}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <h3 ref={headerRef}>Event Calendar</h3>
                <button
                  onClick={() => navigate("/event/1")}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#003b73",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Add Event
                </button>
              </div>
              <div className="calendar-header">
                <div className="calendar-left">
                  <button className="today-btn" onClick={handleTodayClick}>
                    Today
                  </button>
                </div>
                <div className="month-year-container">
                  <button
                    className="nav-btn nav-prev"
                    onClick={handlePrevMonth}
                  ></button>
                  <span className="month-year-text">
                    {months[displayMonth]} {displayYear}
                  </span>
                  <button
                    className="nav-btn nav-next"
                    onClick={handleNextMonth}
                  ></button>
                </div>
                <div className="calendar-right">
                  <select
                    className="month-select"
                    value={month}
                    onChange={handleMonthChange}
                  >
                    {months.map((m, i) => (
                      <option key={i} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    className="year-select"
                    value={year}
                    onChange={handleYearChange}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="calendar-wrapper" style={{ flex: 1 }}>
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
                  dayCellClassNames={(arg: DayCellContentArg) => {
                    const date = arg.date;
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, "0");
                    const dd = String(date.getDate()).padStart(2, "0");
                    const cellDateStr = `${yyyy}-${mm}-${dd}`;
                    return cellDateStr === selectedDate
                      ? ["selected-date"]
                      : [];
                  }}
                  dayCellContent={(arg: DayCellContentArg) => {
                    const date = arg.date;
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, "0");
                    const dd = String(date.getDate()).padStart(2, "0");
                    const cellDateStr = `${yyyy}-${mm}-${dd}`;
                    const eventCount = allEvents.filter(
                      (e) => e.date === cellDateStr,
                    ).length;
                    const isSunday = date.getDay() === 0;
                    return (
                      <div
                        className={`fc-day-content-inline ${isSunday ? "sunday-red" : ""}`}
                      >
                        <div className="inline-day-number">
                          {arg.dayNumberText}
                        </div>
                        {eventCount > 0 && (
                          <div
                            className={`event-badge event-count-${Math.min(eventCount, 10)}`}
                          >
                            {eventCount > 9 ? "9+" : eventCount}
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

        {selectedEvent && (
          <EventDetailsPopup
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
