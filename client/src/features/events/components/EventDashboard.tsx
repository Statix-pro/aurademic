import {
  Archive,
  Bell,
  Briefcase,
  CalendarClock,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  Edit2,
  Eye,
  Info,
  Plus,
  RotateCcw,
  Search,
  XCircle,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAbility } from '../../../shared/casl/AbilityContext';
import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import CustomModal from '../../../shared/components/ui/CustomModal';
import DeleteConfirmationModal from '../../../shared/components/ui/DeleteConfirmationModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import '../styles/Dashboard.css';
import { EVENT_DASHBOARD_MONTHS } from '../constants';

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

interface APISubEvent {
  id: number;
  title?: string;
  status?: string;
  proposedBy?: string;
  category?: string;
  department?: string;
  date?: string;
  createdAt?: string;
  venue?: string;
}

interface APIMainEvent extends APISubEvent {
  sub_events?: APISubEvent[];
}

interface CalendarCell {
  date: Date;
  label: string;
  muted?: boolean;
  weekend?: boolean;
  active?: boolean;
}

type DashboardStatusKey =
  | 'all'
  | 'draft'
  | 'pending'
  | 'return'
  | 'reject'
  | 'approved'
  | 'archive';

interface DashboardStat {
  key: DashboardStatusKey;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}

const getEventIdentity = (event: Pick<EventData, 'id' | 'isSubEvent'>): string =>
  `${event.isSubEvent ? 'sub' : 'main'}-${event.id}`;

const STATUS_LABELS: Record<Exclude<DashboardStatusKey, 'all'>, string> = {
  draft: 'Draft',
  pending: 'Pending',
  return: 'Return',
  reject: 'Reject',
  approved: 'Approved',
  archive: 'Archive',
};

const getStatusDisplayLabel = (status: string): string => {
  const value = status.trim().toLowerCase();
  if (value === 'draft') return 'Draft';
  if (value === 'unknown' || value.length === 0) return 'Unknown';
  return STATUS_LABELS[normalizeStatus(status)];
};

const normalizeStatus = (status: string): Exclude<DashboardStatusKey, 'all'> => {
  const value = status.trim().toLowerCase();
  if (value === 'draft') return 'draft';
  if (value === 'pending') return 'pending';
  if (value === 'return') return 'return';
  if (value === 'rejected') return 'reject';
  if (value === 'approved' || value === 'completed') return 'approved';
  if (value === 'archived') return 'archive';
  return 'pending';
};

const getFiscalYearLabel = (date: string): string => {
  const year = new Date(date).getFullYear();
  return `FY ${year}-${String(year + 1).slice(-2)}`;
};

const matchesSearchTerm = (
  event: Pick<EventData, 'proposedBy' | 'category' | 'department' | 'name' | 'venue' | 'time'>,
  term: string,
): boolean => {
  if (term.length === 0) return true;
  return [event.proposedBy, event.category, event.department, event.name, event.venue, event.time]
    .join(' ')
    .toLowerCase()
    .includes(term);
};

const buildBellCalendar = (
  year: number,
  monthIndex: number,
  selectedDate: Date,
): CalendarCell[] => {
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
  const ability = useAbility();
  const canEditEvents = ability.can('edit', 'Event');
  const canDeleteEvents = ability.can('delete', 'Event');
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<DashboardStatusKey>('all');
  const [showBellPreview, setShowBellPreview] = useState(false);
  const [activePendingId, setActivePendingId] = useState<string | null>(null);
  const [bellViewYear, setBellViewYear] = useState(new Date().getFullYear());
  const [bellViewMonth, setBellViewMonth] = useState(new Date().getMonth());
  const [bellSelectedDate, setBellSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventData[]>([]);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventData | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);

  const [subEventToDelete, setSubEventToDelete] = useState<EventData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: string;
    type: AlertType;
  }>({
    show: false,
    message: '',
    type: 'info',
  });

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (deleteModalVisible && deleteCountdown > 0) {
      timer = setTimeout(() => {
        setDeleteCountdown(deleteCountdown - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [deleteModalVisible, deleteCountdown]);

  React.useEffect(() => {
    let isMounted = true;

    const isAPISubEvent = (value: unknown): value is APISubEvent => {
      if (!value || typeof value !== 'object') return false;
      const candidate = value as Partial<APISubEvent>;
      return typeof candidate.id === 'number';
    };

    const isAPIMainEvent = (value: unknown): value is APIMainEvent =>
      isAPISubEvent(value) &&
      (!('sub_events' in value) ||
        value.sub_events === undefined ||
        (Array.isArray(value.sub_events) && value.sub_events.every(isAPISubEvent)));

    const isAPIMainEventArrayResponse = (value: unknown): value is { data: APIMainEvent[] } =>
      !!value &&
      typeof value === 'object' &&
      'data' in value &&
      Array.isArray((value as { data?: unknown }).data) &&
      (value as { data: unknown[] }).data.every(isAPIMainEvent);

    const handleResponse = (res: unknown) => {
      const data: APIMainEvent[] = Array.isArray(res)
        ? res.filter(isAPIMainEvent)
        : isAPIMainEventArrayResponse(res)
          ? res.data
          : [];

      if (!isMounted) return;

      // Flatten main and sub events
      const flattenedEvents: EventData[] = [];
      data.forEach((main: APIMainEvent) => {
        flattenedEvents.push({
          id: main.id,
          name: main.title || 'Untitled Event',
          status: main.status || 'Draft',
          proposedBy: main.proposedBy || 'N/A',
          category: main.category || 'N/A',
          department: main.department || 'N/A',
          time: main.date
            ? new Date(main.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'TBD',
          venue: main.venue || 'TBD',
          date: main.date || main.createdAt || new Date().toISOString(),
          parent_id: null,
          isSubEvent: false,
        });

        if (main.sub_events && main.sub_events.length > 0) {
          main.sub_events.forEach((sub: APISubEvent) => {
            flattenedEvents.push({
              id: sub.id,
              name: sub.title || 'Untitled Sub Event',
              status: sub.status || 'Draft',
              proposedBy: sub.proposedBy || 'N/A',
              category: sub.category || 'N/A',
              department: sub.department || 'N/A',
              time: sub.date
                ? new Date(sub.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'TBD',
              venue: sub.venue || 'TBD',
              date: sub.date || sub.createdAt || new Date().toISOString(),
              parent_id: main.id,
              isSubEvent: true,
            });
          });
        }
      });
      setEvents(flattenedEvents);
    };

    authenticityUtility
      .get<APIMainEvent[] | { data: APIMainEvent[] }>('/events')
      .then(handleResponse)
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching events:', err);
        setAlertConfig({
          show: true,
          message: 'Failed to fetch events. Please try again.',
          type: 'error',
        });
      });

    return () => {
      isMounted = false;
    };
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
      draft: 0,
      pending: 0,
      return: 0,
      reject: 0,
      approved: 0,
      archive: 0,
    };

    const term = searchTerm.trim().toLowerCase();

    events.forEach((event) => {
      const eventYear = getFiscalYearLabel(event.date);
      const matchesYear = yearFilter === 'all' || eventYear === yearFilter;
      const matchesSearch = matchesSearchTerm(event, term);

      if (matchesYear && matchesSearch) {
        counts.all += 1;
        counts[normalizeStatus(event.status)] += 1;
      }
    });

    return [
      { key: 'all', label: 'Total', value: counts.all, icon: Briefcase, tone: 'tone-total' },
      {
        key: 'pending',
        label: 'Pending',
        value: counts.pending,
        icon: Clock,
        tone: 'tone-pending',
      },
      {
        key: 'return',
        label: 'Return',
        value: counts.return,
        icon: RotateCcw,
        tone: 'tone-return',
      },
      { key: 'reject', label: 'Reject', value: counts.reject, icon: XCircle, tone: 'tone-reject' },
      {
        key: 'approved',
        label: 'Approved',
        value: counts.approved,
        icon: CheckCircle,
        tone: 'tone-approved',
      },
      {
        key: 'archive',
        label: 'Archive',
        value: counts.archive,
        icon: Archive,
        tone: 'tone-archive',
      },
    ] satisfies DashboardStat[];
  }, [events, yearFilter, searchTerm]);

  const filteredEventsByYearAndSearch = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return events.filter((event) => {
      const eventYear = getFiscalYearLabel(event.date);
      const matchesYear = yearFilter === 'all' || eventYear === yearFilter;
      const matchesSearch = matchesSearchTerm(event, term);
      return matchesYear && matchesSearch;
    });
  }, [events, searchTerm, yearFilter]);

  const filteredEvents = useMemo(() => {
    return filteredEventsByYearAndSearch.filter((event) => {
      const normalizedStatus = normalizeStatus(event.status);
      return selectedStatus === 'all' || normalizedStatus === selectedStatus;
    });
  }, [filteredEventsByYearAndSearch, selectedStatus]);

  const bellCalendar = useMemo(
    () => buildBellCalendar(bellViewYear, bellViewMonth, bellSelectedDate),
    [bellSelectedDate, bellViewMonth, bellViewYear],
  );

  const bellTitle = (() => {
    const day = String(bellSelectedDate.getDate()).padStart(2, '0');
    const month = String(bellSelectedDate.getMonth() + 1).padStart(2, '0');
    const year = bellSelectedDate.getFullYear();
    const weekday = bellSelectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    return `${day}.${month}.${year} (${weekday})`;
  })();

  const openEventTab = (eventId: number, tab: string): void => {
    if (!eventId) return;
    navigate(`/event/${eventId}?tab=${tab}`);
  };

  const handleDelete = (event: EventData): void => {
    if (!event || !event.id) return;
    if (!canDeleteEvents) return;

    if (event.isSubEvent) {
      setSubEventToDelete(event);
    } else {
      setEventToDelete(event);
      setDeleteCountdown(5);
      setDeleteModalVisible(true);
    }
  };

  const confirmSubEventDelete = () => {
    if (!subEventToDelete) return;
    setIsDeleting(true);
    const subEventIdentity = getEventIdentity(subEventToDelete);
    authenticityUtility
      .delete(`/events/${subEventToDelete.id}`)
      .then(() => {
        setEvents((prev) => prev.filter((e) => getEventIdentity(e) !== subEventIdentity));
        setSubEventToDelete(null);
      })
      .catch((err) => {
        console.error('Error deleting event:', err);
        setAlertConfig({ show: true, message: 'Failed to delete event.', type: 'error' });
        setSubEventToDelete(null);
      })
      .finally(() => setIsDeleting(false));
  };

  const executeDelete = () => {
    if (!eventToDelete) return;
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteModalVisible(false);
    const eventIdentity = getEventIdentity(eventToDelete);
    const eventId = eventToDelete.id;
    setEventToDelete(null);
    authenticityUtility
      .delete(`/events/${eventId}`)
      .then(() => {
        setEvents((prev) =>
          prev.filter((e) => getEventIdentity(e) !== eventIdentity && e.parent_id !== eventId),
        );
        setDeleteCountdown(5);
      })
      .catch((err) => {
        console.error('Error deleting event:', err);
        setAlertConfig({ show: true, message: 'Failed to delete event.', type: 'error' });
      })
      .finally(() => {
        setEventToDelete(null);
        setIsDeleting(false);
      });
  };

  const cancelDelete = () => {
    setDeleteModalVisible(false);
    setEventToDelete(null);
  };

  const handleKpiClick = (statusKey: DashboardStatusKey): void => {
    setSelectedStatus((current) => (current === statusKey ? 'all' : statusKey));
    setActivePendingId(null);
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
    const nextMonth = bellViewMonth === 0 ? 11 : bellViewMonth - 1;
    const nextYear = bellViewMonth === 0 ? bellViewYear - 1 : bellViewYear;
    setBellViewMonth(nextMonth);
    setBellViewYear(nextYear);
    setBellSelectedDate(new Date(nextYear, nextMonth, 1));
  };

  const goToBellNextMonth = (): void => {
    const nextMonth = bellViewMonth === 11 ? 0 : bellViewMonth + 1;
    const nextYear = bellViewMonth === 11 ? bellViewYear + 1 : bellViewYear;
    setBellViewMonth(nextMonth);
    setBellViewYear(nextYear);
    setBellSelectedDate(new Date(nextYear, nextMonth, 1));
  };

  const handleBellMonthChange = (monthName: string): void => {
    const nextMonthIndex = EVENT_DASHBOARD_MONTHS.indexOf(monthName);
    if (nextMonthIndex < 0) return;
    setBellViewMonth(nextMonthIndex);
    setBellSelectedDate(new Date(bellViewYear, nextMonthIndex, 1));
  };

  const handleBellYearChange = (yearValue: string): void => {
    const nextYear = Number(yearValue);
    if (!Number.isFinite(nextYear)) return;
    setBellViewYear(nextYear);
    setBellSelectedDate(new Date(nextYear, bellViewMonth, 1));
  };

  const currentBellMonthLabel = EVENT_DASHBOARD_MONTHS[bellViewMonth];
  const selectedBellEvents = events.filter((event) => {
    const eventDate = new Date(event.date);
    return (
      eventDate.getFullYear() === bellSelectedDate.getFullYear() &&
      eventDate.getMonth() === bellSelectedDate.getMonth() &&
      eventDate.getDate() === bellSelectedDate.getDate()
    );
  });

  return (
    <div className="event-dashboard-shell">
      <section className="event-dashboard-card">
        <header className="event-dashboard-header">
          <div className="event-dashboard-title-wrap">
            <h1 className="event-dashboard-title">Event Requests</h1>
          </div>

          <div className="event-dashboard-toolbar">
            <label className="event-dashboard-search">
              <Search size={20} className="event-dashboard-search-icon" />
              <input
                type="search"
                placeholder="Search event name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
            <label className="event-dashboard-select">
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="all">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
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
              onClick={() => navigate('/event/new?tab=pre-event')}
            >
              Add +
            </button>

            <button
              type="button"
              className="event-dashboard-add-btn event-dashboard-add-btn--secondary"
              onClick={() => navigate('/event/new?isSubEvent=true&tab=pre-event')}
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
                className={`event-stat-card ${stat.tone}${selectedStatus === stat.key ? ' is-active' : ''}`}
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
          {filteredEvents.length === 0 ? (
            <div className="event-dashboard-empty-state">
              <h2>No events found</h2>
              <p>Try adjusting your search or filters.</p>
            </div>
          ) : (
            filteredEvents.map((event) => {
              return (
                <article key={getEventIdentity(event)} className="event-request-card">
                  {(() => {
                    const normalizedStatus = normalizeStatus(event.status);
                    const hideEdit = normalizedStatus === 'approved';
                    const hideDelete = normalizedStatus === 'reject';

                    return (
                      <div className="event-request-row event-request-row--top">
                        <div className="event-request-head-left">
                          <span
                            className="event-request-id"
                            style={{
                              minWidth: '80px',
                              color: event.isSubEvent ? '#64748b' : undefined,
                            }}
                          >
                            #EV-{new Date(event.date || new Date()).getFullYear()}-
                            {String(event.id).padStart(4, '0')}
                          </span>
                          <span className="event-request-name">{event.proposedBy}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="event-request-type-badge">{event.category}</span>
                            <span
                              className="event-request-type-badge"
                              style={{
                                backgroundColor: event.isSubEvent ? '#f1f5f9' : '#eff6ff',
                                color: event.isSubEvent ? '#475569' : '#1d4ed8',
                                fontWeight: 600,
                              }}
                            >
                              {event.isSubEvent ? '[Sub Event]' : '[Main Event]'}
                            </span>
                          </div>
                        </div>

                        <div className="event-request-head-right">
                          <div className="event-request-amount">
                            <span>Date</span>
                            <strong>
                              {(() => {
                                const d = new Date(event.date);
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
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
                                openEventTab(event.id, 'updates');
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
                                openEventTab(event.id, 'pre-event');
                              }}
                              aria-label="View"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            {canEditEvents && !hideEdit && (
                              <button
                                type="button"
                                className="event-request-mini-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEventTab(event.id, 'edit');
                                }}
                                aria-label="Edit"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {canDeleteEvents && !hideDelete && (
                              <button
                                type="button"
                                className="event-request-mini-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(event);
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
                    <div
                      className="event-request-bottom-left"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {event.isSubEvent && (
                        <span
                          style={{
                            backgroundColor: '#e2e8f0',
                            color: '#475569',
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            marginRight: '8px',
                          }}
                        >
                          SUB EVENT
                        </span>
                      )}
                      <span className="event-request-beneficiary-value">{event.name}</span>
                    </div>

                    <div className="event-request-actions">
                      {(() => {
                        const normalizedStatus = normalizeStatus(event.status);
                        const isClickableStatus =
                          normalizedStatus === 'pending' ||
                          normalizedStatus === 'approved' ||
                          normalizedStatus === 'reject';
                        const eventIdentity = getEventIdentity(event);
                        const showSteps = isClickableStatus && activePendingId === eventIdentity;

                        return (
                          <>
                            <button
                              type="button"
                              className="event-request-doc-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEventTab(event.id, 'updates');
                              }}
                              aria-label="Open documents"
                              title="Open documents"
                            >
                              <ClipboardList size={16} />
                            </button>

                            <button
                              type="button"
                              className={`event-request-status event-request-status--${normalizedStatus}${
                                isClickableStatus ? ' is-clickable' : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isClickableStatus) return;
                                setActivePendingId(
                                  activePendingId === eventIdentity ? null : eventIdentity,
                                );
                              }}
                              aria-pressed={showSteps}
                              disabled={!isClickableStatus}
                            >
                              {STATUS_LABELS[normalizedStatus]}
                            </button>

                            {showSteps && (
                              <div
                                className="event-request-progress"
                                aria-label="Three approval steps"
                              >
                                <span
                                  className="event-request-progress-step is-active"
                                  aria-hidden="true"
                                />
                                <span className="event-request-progress-line" aria-hidden="true" />
                                <span
                                  className={`event-request-progress-step ${
                                    normalizedStatus === 'approved' ||
                                    normalizedStatus === 'pending'
                                      ? 'is-active'
                                      : ''
                                  }`}
                                  aria-hidden="true"
                                />
                                <span className="event-request-progress-line" aria-hidden="true" />
                                <span
                                  className={`event-request-progress-step ${
                                    normalizedStatus === 'approved' ? 'is-active' : ''
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
            })
          )}
        </section>
      </section>

      {showBellPreview && (
        <CustomModal
          show={showBellPreview}
          onHide={() => setShowBellPreview(false)}
          title="Event Calendar"
          size="lg"
        >
          <div className="event-bell-modal">
            <div className="event-bell-panel">
              <div className="event-bell-left">
                <h2 className="event-bell-left-title">Events scheduled on {bellTitle}</h2>
                {selectedBellEvents.length === 0 ? (
                  <p className="event-bell-left-empty">No events scheduled for this day.</p>
                ) : (
                  <ul className="event-bell-event-list">
                    {selectedBellEvents.map((event) => (
                      <li key={getEventIdentity(event)}>
                        <button
                          type="button"
                          className="event-bell-event-link"
                          onClick={() => openEventTab(event.id, 'pre-event')}
                        >
                          {event.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
                    {'<'}
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
                    {'>'}
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
                    {Array.from(
                      new Set([
                        ...Array.from(
                          { length: 7 },
                          (_, index) => new Date().getFullYear() - 3 + index,
                        ),
                        bellViewYear,
                      ]),
                    )
                      .sort((a, b) => a - b)
                      .map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="event-bell-calendar-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="event-bell-day-head">
                      {day}
                    </div>
                  ))}

                  {bellCalendar.map((day, index) => (
                    <button
                      key={`${day.date.toISOString()}-${index}`}
                      className={[
                        'event-bell-day-cell',
                        day.muted ? 'muted' : '',
                        day.weekend ? 'weekend' : '',
                        day.active ? 'active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      type="button"
                      tabIndex={0}
                      onClick={() => {
                        if (day.muted) return;
                        setBellSelectedDate(day.date);
                        setBellViewYear(day.date.getFullYear());
                        setBellViewMonth(day.date.getMonth());
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (day.muted) return;
                          setBellSelectedDate(day.date);
                          setBellViewYear(day.date.getFullYear());
                          setBellViewMonth(day.date.getMonth());
                        }
                      }}
                    >
                      <span>{day.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CustomModal>
      )}

      <CustomModal
        show={deleteModalVisible}
        onHide={cancelDelete}
        title="Delete Event"
        size="sm"
        footer={
          <div className="d-flex justify-content-end gap-2 w-100">
            <button className="btn btn-secondary btn-sm" onClick={cancelDelete}>
              Cancel
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={executeDelete}
              disabled={Boolean(
                eventToDelete?.parent_id == null &&
                eventToDelete &&
                events.some((event) => event.parent_id === eventToDelete.id) &&
                deleteCountdown > 0,
              )}
            >
              Delete Now
            </button>
          </div>
        }
      >
        <p className="mb-0 fw-medium" style={{ fontSize: '0.95rem' }}>
          {eventToDelete &&
          eventToDelete.parent_id == null &&
          events.some((event) => event.parent_id === eventToDelete.id) ? (
            <>
              This Main Event has associated Sub Events. Deleting this Main Event will permanently
              delete all related Sub Events.
            </>
          ) : (
            <>Please confirm if you wish to proceed.</>
          )}
          <span aria-live="polite" className="d-block mt-2">
            {eventToDelete &&
            eventToDelete.parent_id == null &&
            events.some((event) => event.parent_id === eventToDelete.id) &&
            deleteCountdown > 0 ? (
              <>
                You can confirm this action in{' '}
                <strong className="text-danger">{deleteCountdown}</strong> seconds.
              </>
            ) : null}
          </span>
        </p>
      </CustomModal>

      <DeleteConfirmationModal
        show={!!subEventToDelete}
        onHide={() => setSubEventToDelete(null)}
        onConfirm={confirmSubEventDelete}
        itemName={subEventToDelete?.name || `Event ${subEventToDelete?.id}`}
        isDeleting={isDeleting}
      />

      <AlertModal
        show={alertConfig.show}
        onHide={() => setAlertConfig((prev) => ({ ...prev, show: false }))}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </div>
  );
};

export default Dashboard;
