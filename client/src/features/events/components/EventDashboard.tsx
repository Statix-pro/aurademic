import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Edit2,
  Eye,
  Info,
  Plus,
  RotateCcw,
  Search,
  ShieldX,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import "../styles/Dashboard.css";
import { EVENT_DASHBOARD_MONTHS } from "../constants";

interface EventData {
  id: number;
  status: string;
  proposedBy: string;
  category: string;
  department: string;
  time: string;
  name: string;
  venue: string;
  date: string;
  parent_id?: number | null;
  isSubEvent?: boolean;
}

interface CalendarCell {
  date: Date;
  label: string;
  muted?: boolean;
  weekend?: boolean;
  active?: boolean;
}

type DashboardStatusKey = "all" | "pending" | "return" | "reject" | "approved" | "archive";

interface DashboardStat {
  key: DashboardStatusKey;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}


const STATUS_LABELS: Record<Exclude<DashboardStatusKey, "all">, string> = {
  pending: "Pending",
  return: "Return",
  reject: "Reject",
  approved: "Approved",
  archive: "Archive",
};

const normalizeStatus = (status: string): Exclude<DashboardStatusKey, "all"> => {
  const value = status.trim().toLowerCase();
  if (value === "pending") return "pending";
  if (value === "return") return "return";
  if (value === "rejected") return "reject";
  if (value === "approved") return "approved";
  if (value === "archived") return "archive";
  return "pending";
};

const buildBellCalendar = (year: number, monthIndex: number, selectedDate: Date): CalendarCell[] => {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const firstWeekDay = firstOfMonth.getDay();
  const startDate = new Date(year, monthIndex, 1 - firstWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date,
      label: String(date.getDate()),
      muted: date.getMonth() !== monthIndex,
      weekend: date.getDay() === 0 || date.getDay() === 6,
      active:
        date.getFullYear() === selectedDate.getFullYear() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getDate() === selectedDate.getDate(),
    };
  });
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<DashboardStatusKey>("all");
  const [showBellPreview, setShowBellPreview] = useState(false);
  const [activePendingIndex, setActivePendingIndex] = useState<number | null>(null);
  const [bellViewYear, setBellViewYear] = useState(new Date().getFullYear());
  const [bellViewMonth, setBellViewMonth] = useState(new Date().getMonth());
  const [bellSelectedDate, setBellSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventData[]>([]);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventData | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (deleteModalVisible && deleteCountdown > 0) {
      timer = setTimeout(() => {
        setDeleteCountdown((prev) => prev - 1);
      }, 1000);
    } else if (deleteModalVisible && deleteCountdown === 0) {
      executeDelete();
    }
    return () => clearTimeout(timer);
  }, [deleteModalVisible, deleteCountdown]);

  React.useEffect(() => {
    authenticityUtility.get("/events")
      .then((res: any) => {
        const data = Array.isArray(res) ? res : res.data || [];
        // Flatten main and sub events
        const flattenedEvents: EventData[] = [];
        data.forEach((main: any) => {
          flattenedEvents.push({
            id: main.id,
            name: main.title || "Untitled Event",
            status: main.status || "Draft",
            proposedBy: main.proposedBy || "N/A",
            category: main.category || "N/A",
            department: main.department || "N/A",
            time: main.date ? new Date(main.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "TBD",
            venue: main.venue || "TBD",
            date: main.date || main.createdAt,
            parent_id: null,
            isSubEvent: false
          });
          
          if (main.sub_events && main.sub_events.length > 0) {
            main.sub_events.forEach((sub: any) => {
              flattenedEvents.push({
                id: sub.id,
                name: sub.title || "Untitled Sub Event",
                status: sub.status || "Draft",
                proposedBy: sub.proposedBy || "N/A",
                category: sub.category || "N/A",
                department: sub.department || "N/A",
                time: sub.date ? new Date(sub.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "TBD",
                venue: sub.venue || "TBD",
                date: sub.date || sub.createdAt,
                parent_id: main.id,
                isSubEvent: true
              });
            });
          }
        });
        setEvents(flattenedEvents);
      })
      .catch((err) => console.error("Error fetching events:", err));
  }, []);
  const years = useMemo(() => {
    const eventYears = Array.from(
      new Set(events.map((event) => new Date(event.date).getFullYear())),
    ).sort((a, b) => b - a);
    return eventYears.map((year) => `FY ${year}-${String(year + 1).slice(-2)}`);
  }, [events]);

  const stats = useMemo(() => {
    const counts: Record<DashboardStatusKey, number> = {
      all: 0,
      pending: 0,
      return: 0,
      reject: 0,
      approved: 0,
      archive: 0,
    };

    const term = searchTerm.trim().toLowerCase();

    events.forEach((event) => {
      const eventYear = `FY ${new Date(event.date).getFullYear()}-${String(
        new Date(event.date).getFullYear() + 1,
      ).slice(-2)}`;
      const matchesYear = yearFilter === "all" || eventYear === yearFilter;
      const matchesSearch =
        term.length === 0 ||
        [event.proposedBy, event.category, event.department, event.name, event.venue, event.time]
          .join(" ")
          .toLowerCase()
          .includes(term);

      if (matchesYear && matchesSearch) {
        counts.all += 1;
        counts[normalizeStatus(event.status)] += 1;
      }
    });

    return [
      { key: "all", label: "Total", value: counts.all, icon: ClipboardList, tone: "tone-total" },
      { key: "pending", label: "Pending", value: counts.pending, icon: Clock3, tone: "tone-pending" },
      { key: "return", label: "Return", value: counts.return, icon: RotateCcw, tone: "tone-return" },
      { key: "reject", label: "Reject", value: counts.reject, icon: ShieldX, tone: "tone-reject" },
      { key: "approved", label: "Approved", value: counts.approved, icon: CheckCircle2, tone: "tone-approved" },
      { key: "archive", label: "Archive", value: counts.archive, icon: Archive, tone: "tone-archive" },
    ] satisfies DashboardStat[];
  }, [events, yearFilter, searchTerm]);

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return events.filter((event) => {
      const normalizedStatus = normalizeStatus(event.status);
      const eventYear = `FY ${new Date(event.date).getFullYear()}-${String(
        new Date(event.date).getFullYear() + 1,
      ).slice(-2)}`;
      const matchesYear = yearFilter === "all" || eventYear === yearFilter;
      const matchesStatus = selectedStatus === "all" || normalizedStatus === selectedStatus;
      const matchesSearch =
        term.length === 0 ||
        [event.proposedBy, event.category, event.department, event.name, event.venue, event.time]
          .join(" ")
          .toLowerCase()
          .includes(term);

      return matchesYear && matchesStatus && matchesSearch;
    });
  }, [events, searchTerm, selectedStatus, yearFilter]);

  const bellCalendar = useMemo(
    () => buildBellCalendar(bellViewYear, bellViewMonth, bellSelectedDate),
    [bellSelectedDate, bellViewMonth, bellViewYear],
  );

  const bellTitle = (() => {
    const day = String(bellSelectedDate.getDate()).padStart(2, "0");
    const month = String(bellSelectedDate.getMonth() + 1).padStart(2, "0");
    const year = bellSelectedDate.getFullYear();
    const weekday = bellSelectedDate.toLocaleDateString("en-US", { weekday: "long" });
    return `${day}.${month}.${year} (${weekday})`;
  })();

  const openEventTab = (eventIndex: number, tab: string): void => {
    const event = events[eventIndex];
    if (!event?.id) return;
    navigate(`/event/${event.id}?tab=${tab}`);
  };

  const handleDelete = (eventIndex: number): void => {
    const event = filteredEvents[eventIndex];
    if (!event || !event.id) return;
    
    if (event.isSubEvent) {
      const eventLabel = event.name || `Event ${eventIndex + 1}`;
      const shouldDelete = window.confirm(`Delete "${eventLabel}" from the dashboard?`);
      if (!shouldDelete) return;

      authenticityUtility.delete(`/events/${event.id}`)
        .then(() => {
          setEvents((prev) => prev.filter((e) => e.id !== event.id));
        })
        .catch(err => {
          console.error("Error deleting event:", err);
          alert("Failed to delete event.");
        });
    } else {
      setEventToDelete(event);
      setDeleteCountdown(5);
      setDeleteModalVisible(true);
    }
  };

  const executeDelete = () => {
    if (!eventToDelete) return;
    setDeleteModalVisible(false);
    authenticityUtility.delete(`/events/${eventToDelete.id}`)
      .then(() => {
        setEvents((prev) => prev.filter((e) => e.id !== eventToDelete.id && e.parent_id !== eventToDelete.id));
      })
      .catch(err => {
        console.error("Error deleting event:", err);
        alert("Failed to delete event.");
      });
  };

  const cancelDelete = () => {
    setDeleteModalVisible(false);
    setEventToDelete(null);
  };

  const handleKpiClick = (statusKey: DashboardStatusKey): void => {
    setSelectedStatus((current) => (current === statusKey ? "all" : statusKey));
    setActivePendingIndex(null);
  };

  const openBellPreview = (): void => {
    const today = new Date();
    setBellViewYear(today.getFullYear());
    setBellViewMonth(today.getMonth());
    setBellSelectedDate(today);
    setShowBellPreview(true);
  };

  const goToBellToday = (): void => {
    const today = new Date();
    setBellViewYear(today.getFullYear());
    setBellViewMonth(today.getMonth());
    setBellSelectedDate(today);
  };

  const goToBellPrevMonth = (): void => {
    setBellViewMonth((currentMonth) => {
      const nextMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      setBellViewYear((currentYear) => (currentMonth === 0 ? currentYear - 1 : currentYear));
      setBellSelectedDate((current) => new Date(current.getFullYear(), nextMonth, 1));
      return nextMonth;
    });
  };

  const goToBellNextMonth = (): void => {
    setBellViewMonth((currentMonth) => {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      setBellViewYear((currentYear) => (currentMonth === 11 ? currentYear + 1 : currentYear));
      setBellSelectedDate((current) => new Date(current.getFullYear(), nextMonth, 1));
      return nextMonth;
    });
  };

  const handleBellMonthChange = (monthName: string): void => {
    const nextMonthIndex = EVENT_DASHBOARD_MONTHS.indexOf(monthName);
    if (nextMonthIndex < 0) return;
    setBellViewMonth(nextMonthIndex);
    setBellSelectedDate((current) => new Date(current.getFullYear(), nextMonthIndex, 1));
  };

  const handleBellYearChange = (yearValue: string): void => {
    const nextYear = Number(yearValue);
    if (!Number.isFinite(nextYear)) return;
    setBellViewYear(nextYear);
    setBellSelectedDate((current) => new Date(nextYear, current.getMonth(), 1));
  };

  const currentBellMonthLabel = EVENT_DASHBOARD_MONTHS[bellViewMonth];

  return (
    <div className="event-dashboard-shell">
      <section className="event-dashboard-card">
        <header className="event-dashboard-header">
          <div className="event-dashboard-title-wrap">
            <h1 className="event-dashboard-title">Event Requests</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label className="event-dashboard-search" style={{ height: "42px", padding: "0 12px", margin: 0, flex: "0 1 300px", width: "300px" }}>
              <Search size={20} className="event-dashboard-search-icon" />
              <input
                type="search"
                placeholder="Search event name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="event-dashboard-bell-btn"
              onClick={openBellPreview}
              aria-label="Open event calendar preview"
              title="Open event calendar preview"
            >
              <Bell size={18} />
            </button>

            <button
              type="button"
              className="event-dashboard-add-btn"
              onClick={() => navigate("/event/new?tab=pre-event")}
            >
              Add +
            </button>

            <button
              type="button"
              className="event-dashboard-add-btn"
              style={{ backgroundColor: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1" }}
              onClick={() => navigate("/event/new?isSubEvent=true&tab=pre-event")}
            >
              Sub +
            </button>
          </div>
        </header>

        <section className="event-dashboard-stats">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                type="button"
                className={`event-stat-card ${stat.tone}${selectedStatus === stat.key ? " is-active" : ""}`}
                onClick={() => handleKpiClick(stat.key)}
                aria-pressed={selectedStatus === stat.key}
              >
                <div className="event-stat-icon">
                  <Icon size={20} />
                </div>
                <div className="event-stat-copy">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              </button>
            );
          })}
        </section>

        <section className="event-dashboard-list">
          {filteredEvents.map((event) => {
            const originalIndex = events.indexOf(event);
            return (
              <article
                key={`${event.date}-${event.name}-${originalIndex}`}
                className="event-request-card"
                onClick={() => openEventTab(originalIndex, "pre-event")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    openEventTab(originalIndex, "pre-event");
                  }
                }}
              >
                {(() => {
                  const normalizedStatus = normalizeStatus(event.status);
                  const hideEdit = normalizedStatus === "approved";
                  const hideDelete = normalizedStatus === "reject";

                  return (
                    <div className="event-request-row event-request-row--top">
                      <div className="event-request-head-left">
                        <span className="event-request-id" style={{ minWidth: '80px', color: event.isSubEvent ? '#64748b' : undefined }}>
                          #F-{new Date(event.date || new Date()).getFullYear()}-{String(event.id).padStart(4, "0")}
                        </span>
                        <span className="event-request-name">{event.proposedBy}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="event-request-type-badge">{event.category}</span>
                          <span 
                            className="event-request-type-badge" 
                            style={{ 
                              backgroundColor: event.isSubEvent ? "#f1f5f9" : "#eff6ff", 
                              color: event.isSubEvent ? "#475569" : "#1d4ed8",
                              fontWeight: 600
                            }}
                          >
                            {event.isSubEvent ? "[Sub Event]" : "[Main Event]"}
                          </span>
                        </div>
                      </div>

                      <div className="event-request-head-right">
                        <div className="event-request-amount">
                          <span>Date</span>
                          <strong>
                            {(() => {
                              const d = new Date(event.date);
                              const day = String(d.getDate()).padStart(2, "0");
                              const month = String(d.getMonth() + 1).padStart(2, "0");
                              const year = d.getFullYear();
                              return `${day}-${month}-${year}`;
                            })()}
                          </strong>
                        </div>

                        <div className="event-request-mini-actions">
                          <button
                            type="button"
                            className="event-request-mini-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEventTab(originalIndex, "updates");
                            }}
                            aria-label="Info"
                            title="Info"
                          >
                            <Info size={16} />
                          </button>
                          <button
                            type="button"
                            className="event-request-mini-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEventTab(originalIndex, "updates");
                            }}
                            aria-label="View"
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                          {!hideEdit && (
                            <button
                              type="button"
                              className="event-request-mini-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEventTab(originalIndex, "pre-event");
                              }}
                              aria-label="Edit"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          {!hideDelete && (
                            <button
                              type="button"
                              className="event-request-mini-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(originalIndex);
                              }}
                              aria-label="Delete"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="event-request-row event-request-row--bottom">
                  <div className="event-request-bottom-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {event.isSubEvent && (
                      <span style={{ 
                        backgroundColor: '#e2e8f0', 
                        color: '#475569', 
                        fontSize: '11px', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontWeight: 600, 
                        marginRight: '8px' 
                      }}>
                        SUB EVENT
                      </span>
                    )}
                    <span className="event-request-beneficiary-value">{event.name}</span>
                  </div>

                  <div className="event-request-actions">
                    {(() => {
                      const normalizedStatus = normalizeStatus(event.status);
                      const isClickableStatus =
                        normalizedStatus === "pending" ||
                        normalizedStatus === "approved" ||
                        normalizedStatus === "reject";
                      const showSteps = isClickableStatus && activePendingIndex === originalIndex;

                      return (
                        <>
                          <button
                            type="button"
                            className="event-request-doc-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEventTab(originalIndex, "updates");
                            }}
                            aria-label="Open documents"
                            title="Open documents"
                          >
                            <ClipboardList size={16} />
                          </button>

                          <button
                            type="button"
                            className={`event-request-status event-request-status--${normalizedStatus}${
                              isClickableStatus ? " is-clickable" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isClickableStatus) return;
                              setActivePendingIndex((current) => (current === originalIndex ? null : originalIndex));
                            }}
                            aria-pressed={showSteps}
                            disabled={!isClickableStatus}
                          >
                            {STATUS_LABELS[normalizedStatus]}
                          </button>

                          {showSteps && (
                            <div className="event-request-progress" aria-label="Three approval steps">
                              <span className="event-request-progress-step is-active" aria-hidden="true" />
                              <span className="event-request-progress-line" aria-hidden="true" />
                              <span
                                className={`event-request-progress-step ${
                                  normalizedStatus === "approved" ? "is-active" : ""
                                }`}
                                aria-hidden="true"
                              />
                              <span className="event-request-progress-line" aria-hidden="true" />
                              <span
                                className={`event-request-progress-step ${
                                  normalizedStatus === "approved" ? "is-active" : ""
                                }`}
                                aria-hidden="true"
                              />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </section>

      {showBellPreview && (
        <div className="event-bell-overlay" onClick={() => setShowBellPreview(false)}>
          <div className="event-bell-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="event-bell-close-btn"
              onClick={() => setShowBellPreview(false)}
              aria-label="Close preview"
            >
              x
            </button>

            <div className="event-bell-panel">
              <div className="event-bell-left">
                <h2 className="event-bell-left-title">Events scheduled on {bellTitle}</h2>
                <p className="event-bell-left-empty">No events scheduled for this day.</p>
              </div>

              <div className="event-bell-right">
                <div className="event-bell-calendar-header">
                  <h3>Event Calendar</h3>
                </div>

                <div className="event-bell-calendar-controls">
                  <button type="button" className="event-bell-today-btn" onClick={goToBellToday}>
                    Today
                  </button>
                  <button
                    type="button"
                    className="event-bell-nav-btn"
                    aria-label="Previous month"
                    onClick={goToBellPrevMonth}
                  >
                    {"<"}
                  </button>
                  <div className="event-bell-month-label">
                    {currentBellMonthLabel} {bellViewYear}
                  </div>
                  <button
                    type="button"
                    className="event-bell-nav-btn"
                    aria-label="Next month"
                    onClick={goToBellNextMonth}
                  >
                    {">"}
                  </button>
                  <select
                    className="event-bell-select"
                    value={currentBellMonthLabel}
                    onChange={(e) => handleBellMonthChange(e.target.value)}
                  >
                    {EVENT_DASHBOARD_MONTHS.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <select
                    className="event-bell-select"
                    value={String(bellViewYear)}
                    onChange={(e) => handleBellYearChange(e.target.value)}
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                  </select>
                </div>

                <div className="event-bell-calendar-grid">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="event-bell-day-head">
                      {day}
                    </div>
                  ))}

                  {bellCalendar.map((day, index) => (
                    <div
                      key={`${day.date.toISOString()}-${index}`}
                      className={[
                        "event-bell-day-cell",
                        day.muted ? "muted" : "",
                        day.weekend ? "weekend" : "",
                        day.active ? "active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        if (day.muted) return;
                        setBellSelectedDate(day.date);
                        setBellViewYear(day.date.getFullYear());
                        setBellViewMonth(day.date.getMonth());
                      }}
                    >
                      <span>{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteModalVisible && (
        <div className="event-bell-overlay" onClick={cancelDelete} style={{ zIndex: 1000 }}>
          <div className="event-delete-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', color: '#0f172a' }}>Delete Event</h2>
            <p style={{ color: '#475569', marginBottom: '18px', lineHeight: '1.45', fontSize: '14px' }}>
              This Main Event has associated Sub Events. Deleting this Main Event will permanently delete all related Sub Events. This action will continue in <strong style={{ color: '#ef4444' }}>{deleteCountdown}</strong> seconds unless cancelled.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={cancelDelete}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 600, minWidth: '96px' }}
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(180deg, #ff5a5f 0%, #ef4444 100%)', color: '#fff', cursor: 'pointer', fontWeight: 600, minWidth: '96px', boxShadow: '0 8px 18px rgba(239, 68, 68, 0.18)' }}
              >
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
