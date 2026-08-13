import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Calendar,
  MapPin,
  Users,
  Home,
  CreditCard,
  ChevronUp,
  X,
} from 'lucide-react';
import { useMemo } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  CATEGORY_COLORS,
  CategoryIcon,
  getCategorySolidBgClass,
  getLightLabelClass,
} from './EventCard';
import {
  useEvents,
  isAiHackathon,
  getMultiEventStateLabel,
  isPayableEvent,
  flattenEvents,
} from '../../contexts/EventsContext';

import type { EventItem, EventRegistration, SubEventItem } from '../../types';

import './EventRegistrationPage.css';

const DEFAULT_COLOR = {
  pill: 'bg-slate-100 text-slate-600',
  icon: 'text-slate-500',
  bg: 'bg-slate-50',
  button: 'bg-[#064675] hover:bg-[#05375c]',
};

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical',
  CULTURAL: 'Cultural',
  SPORTS: 'Sports',
  LITERARY: 'Literary',
  MANAGEMENT: 'Management',
  'MULTI-EVENTS': 'Multi-Events',
};

const DETAIL_LABELS: Record<string, string> = {
  TECHNICAL: 'Workshop',
  CULTURAL: 'Dance',
  SPORTS: 'Athletics',
  LITERARY: 'Quiz',
  MANAGEMENT: 'Business',
  'MULTI-EVENTS': 'Extended',
};

function getStyles(category: string) {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

function getAiShortlistLabel(registration?: EventRegistration) {
  if (!registration) return 'Shortlist Event';
  if (registration.reviewStatus === 'rejected') return 'Rejected';
  if (registration.reviewStatus === 'selected') return 'Selected';
  return 'Shortlist Event';
}

function getAiShortlistClass(label: string) {
  if (label === 'Selected')
    return 'border border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm';
  if (label === 'Rejected') return 'border border-rose-200 bg-rose-100 text-rose-700 shadow-sm';
  return 'border border-slate-300 bg-slate-100 text-slate-800 shadow-sm';
}

function getPayNowButtonClass(category: string) {
  const styles = getStyles(category);
  return `${styles.button} text-white`;
}

function toDisplayRows(selected?: EventItem) {
  if (!selected) return [];
  if (selected.category === 'MULTI-EVENTS') {
    return (selected.subEvents ?? []).map((subEvent) => toRowEvent(selected, subEvent));
  }
  return [selected];
}

function toRowEvent(event: EventItem, subEvent?: SubEventItem): EventItem {
  if (!subEvent) return event;
  return {
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
  };
}

function getRegisterState(
  event: EventItem,
  registration: EventRegistration | undefined,
  isOpen: boolean,
) {
  if (isAiHackathon(event)) {
    if (!registration) {
      return {
        label: 'Register Now',
        className: isOpen
          ? 'bg-[#064675] hover:bg-[#05375c] text-white'
          : 'bg-slate-300 text-slate-500 cursor-not-allowed',
        disabled: !isOpen,
        kind: 'register' as const,
      };
    }

    if (registration.reviewStatus === 'rejected') {
      return {
        label: 'Register Now',
        className: 'opacity-60 cursor-not-allowed',
        disabled: true,
        kind: 'register' as const,
      };
    }

    if (registration.reviewStatus === 'selected') {
      if (registration.paymentStatus === 'paid') {
        return {
          label: 'Selected',
          className: 'bg-emerald-600 text-white cursor-default',
          disabled: true,
          kind: 'register' as const,
        };
      }

      return {
        label: 'Pay Now',
        className: getPayNowButtonClass(event.category),
        disabled: false,
        kind: 'pay' as const,
      };
    }

    return {
      label: 'Pending',
      className: 'bg-amber-500 text-white cursor-default',
      disabled: true,
      kind: 'register' as const,
    };
  }

  if (event.category === 'MULTI-EVENTS') {
    const multiEventState = getMultiEventStateLabel(event, registration);

    if (multiEventState === 'Rejected') {
      return {
        label: 'Register Now',
        className: 'opacity-60 cursor-not-allowed',
        disabled: true,
        kind: 'register' as const,
      };
    }
  }

  if (!registration) {
    return {
      label: 'Register Now',
      className: isOpen
        ? 'bg-[#064675] hover:bg-[#05375c] text-white'
        : 'bg-slate-300 text-slate-500 cursor-not-allowed',
      disabled: !isOpen,
      kind: 'register' as const,
    };
  }

  if (registration.paymentStatus === 'paid') {
    return {
      label: 'Register Now',
      className: isOpen
        ? 'bg-[#064675] hover:bg-[#05375c] text-white'
        : 'bg-slate-300 text-slate-500 cursor-not-allowed',
      disabled: !isOpen,
      kind: 'register' as const,
    };
  }

  if (registration.formStatus === 'ready') {
    return {
      label: 'Pay Now',
      className: getPayNowButtonClass(event.category),
      disabled: false,
      kind: 'pay' as const,
    };
  }

  return {
    label: 'Register Now',
    className: isOpen
      ? 'bg-[#064675] hover:bg-[#05375c] text-white'
      : 'bg-slate-300 text-slate-500 cursor-not-allowed',
    disabled: !isOpen,
    kind: 'register' as const,
  };
}

function EventRow({
  event,
  registration,
  showMultiEventState = false,
  compactParticipation = false,
  onRegister,
}: {
  event: EventItem;
  registration?: EventRegistration;
  showMultiEventState?: boolean;
  compactParticipation?: boolean;
  onRegister: (event: EventItem) => void;
}) {
  const navigate = useNavigate();
  const colors = getStyles(event.category);
  const isOpen = event.status === 'Open';
  const label1 = CATEGORY_LABELS[event.category] ?? event.category;
  const label2 = DETAIL_LABELS[event.category] ?? event.category;
  const participationText =
    event.participation === 'Team' ? (event.teamSize ?? 'Team') : 'Individual';
  const displayParticipationText = participationText;
  const registerClass = isOpen
    ? `${colors.button} text-white`
    : 'bg-slate-300 text-slate-500 cursor-not-allowed';
  const statusClass = isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600';
  const regState = getRegisterState(event, registration, isOpen);
  const shortlistLabel = isAiHackathon(event) ? getAiShortlistLabel(registration) : '';
  const multiEventStateLabel = showMultiEventState
    ? getMultiEventStateLabel(event, registration)
    : '';
  const shortlistStateLabel = shortlistLabel || multiEventStateLabel;
  const showLockedRegisterArrow =
    (isAiHackathon(event) && registration?.reviewStatus === 'rejected') ||
    multiEventStateLabel === 'Rejected';
  const buttonClass =
    regState.kind === 'register'
      ? showLockedRegisterArrow
        ? `${registerClass} opacity-60 cursor-not-allowed`
        : registerClass
      : regState.className;

  const handlePrimaryAction = () => {
    if (regState.kind === 'pay') {
      navigate('/payment', { state: { selectedEvents: [event], total: event.fees } });
      return;
    }

    if (regState.kind === 'register') {
      onRegister(event);
    }
  };

  return (
    <div
      className={`grid ${
        compactParticipation
          ? 'grid-cols-[145px_minmax(0,1fr)_85px_125px]'
          : 'grid-cols-[180px_minmax(0,1fr)_110px_150px]'
      } items-center rounded-2xl border border-slate-300 bg-white shadow-[0_3px_8px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]`}
    >
      <div
        className={`flex items-center gap-2.5 border-r border-slate-300 py-6 ${compactParticipation ? 'px-3' : 'px-4'}`}
      >
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-xl ${getCategorySolidBgClass(event.category)} ${compactParticipation ? 'h-11 w-11' : 'h-14 w-14'}`}
        >
          <CategoryIcon category={event.category} iconClassName="text-white" />
        </div>
        <div className="event-registration-page-1">
          <span
            className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none ${colors.pill}`}
          >
            {label1}
          </span>
          <span
            className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none ${getLightLabelClass(event.category)}`}
          >
            {label2}
          </span>
        </div>
      </div>

      <div
        className={`grid min-h-[96px] ${
          shortlistStateLabel ? 'grid-cols-[minmax(0,1fr)_120px]' : 'grid-cols-1'
        } items-center gap-4 border-r border-slate-300 px-5 py-6`}
      >
        <div className="event-registration-page-2">
          <div className="event-registration-page-3">
            <h3
              className={`${compactParticipation ? 'text-base' : 'text-lg'} font-semibold leading-tight text-slate-800`}
            >
              {event.eventName}
            </h3>
            {event.parentEventName && (
              <span className="event-registration-page-4">{event.parentEventName}</span>
            )}
          </div>
          <div
            className={`mt-3 flex items-center ${compactParticipation ? 'gap-3 text-[11px]' : 'gap-4 text-sm'} whitespace-nowrap text-slate-500`}
          >
            <span className="event-registration-page-5">
              <Calendar className={`h-4 w-4 ${colors.icon}`} />
              {event.date}
            </span>
            {!compactParticipation && (
              <span className="event-registration-page-6">
                <MapPin className={`h-4 w-4 ${colors.icon}`} />
                {event.venue}
              </span>
            )}
            <span className="event-registration-page-7">
              <Users className={`h-4 w-4 flex-shrink-0 ${colors.icon}`} />
              <span className="event-registration-page-8">{displayParticipationText}</span>
            </span>
          </div>
        </div>
        {shortlistStateLabel && (
          <div className="event-registration-page-9">
            <span
              className={`inline-flex whitespace-nowrap rounded-md px-3 py-1 text-center text-[11px] font-bold leading-none ${getAiShortlistClass(shortlistStateLabel)}`}
            >
              {shortlistStateLabel}
            </span>
          </div>
        )}
      </div>

      <div className={`border-r border-slate-300 py-6 ${compactParticipation ? 'px-3' : 'px-5'}`}>
        <p className="event-registration-page-10">
          {event.participation === 'Team' ? 'Team' : 'Participant'}
        </p>
        <p className={`mt-1 text-xl font-bold ${colors.icon}`}>
          {'\u20B9'}
          {event.fees.toLocaleString()}
        </p>
      </div>

      <div className={`py-6 ${compactParticipation ? 'px-3' : 'px-5'}`}>
        <div className="event-registration-page-11">
          <span
            className={`inline-flex h-[22px] w-16 items-center justify-center gap-1.5 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}
            />
            {isOpen ? 'Open' : 'Closed'}
          </span>
          {regState.label && (
            <div className={`group ${compactParticipation ? 'w-24' : 'w-28'}`}>
              <button
                onClick={handlePrimaryAction}
                disabled={regState.disabled}
                className={`h-8 w-full whitespace-nowrap rounded-md px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-100 ${buttonClass}`}
              >
                <span className="event-registration-page-12">
                  <span>{regState.label}</span>
                  {showLockedRegisterArrow && <Lock className="event-registration-page-13" />}
                  {!showLockedRegisterArrow && regState.kind === 'pay' && (
                    <ArrowRight className="event-registration-page-14" />
                  )}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EventRegistrationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getRegistration, registrations, events, clearRegistration } = useEvents();
  const selectedEvent = location.state?.event as EventItem | undefined;
  const parentEvent = location.state?.parentEvent as EventItem | undefined;
  const paymentEventId = location.state?.paymentEventId as string | undefined;
  const [paymentSummaryDismissed, setPaymentSummaryDismissed] = useState(false);
  const isMultiEventsGroup = selectedEvent?.category === 'MULTI-EVENTS';
  const allDisplayEvents = useMemo(
    () => flattenEvents(events).filter((event) => event.status !== 'Closed'),
    [events],
  );
  const displayEvents = useMemo(
    () =>
      selectedEvent
        ? toDisplayRows(selectedEvent).filter((event) => event.status !== 'Closed')
        : allDisplayEvents,
    [allDisplayEvents, selectedEvent],
  );

  const paymentEvents = useMemo(
    () =>
      displayEvents.filter((event) => {
        const registration = registrations[event.id];
        return Boolean(registration && isPayableEvent(event, registration, paymentEventId));
      }),
    [displayEvents, registrations, paymentEventId],
  );
  const paymentTotal = paymentEvents.reduce((sum, event) => sum + event.fees, 0);
  const showPaymentSummary =
    !paymentSummaryDismissed && paymentEvents.length > 0 && paymentTotal > 0;

  const handleRegister = (event: EventItem) => {
    const parent = selectedEvent?.category === 'MULTI-EVENTS' ? selectedEvent : parentEvent;
    navigate('/register', { state: { event, label: event.category, parentEvent: parent } });
  };

  const handleProceedToPayment = () => {
    if (!showPaymentSummary) return;
    navigate('/payment', { state: { selectedEvents: paymentEvents, total: paymentTotal } });
  };

  const handleClearAll = () => {
    paymentEvents.forEach((event) => clearRegistration(event.id));
    setPaymentSummaryDismissed(true);
  };

  return (
    <div className="event-registration-page-15">
      <div className="event-registration-page-16">
        <div className="event-registration-page-17">
          <div className="event-registration-page-18">
            <button onClick={() => navigate('/home')} className="event-registration-page-19">
              <ArrowLeft className="event-registration-page-20" />
            </button>
            <div>
              <h2 className="event-registration-page-21">Event Lists</h2>
            </div>
          </div>
        </div>

        <section className="event-registration-page-22">
          <div className="event-registration-page-23">
            <div className="event-registration-page-24">
              <button className="event-registration-page-25">
                <span className="event-registration-page-26">
                  <Calendar className="event-registration-page-27" />
                  Events
                </span>
              </button>
              {(!selectedEvent || selectedEvent.hasAccommodation !== false) && (
                <button
                  onClick={() => navigate('/accommodation', { state: { ...location.state } })}
                  className="event-registration-page-28"
                >
                  <span className="event-registration-page-29">
                    <Home className="event-registration-page-30" />
                    Accommodation
                  </span>
                </button>
              )}
              {(!selectedEvent || selectedEvent.hasRegistrationFee !== false) && (
                <button
                  onClick={() =>
                    navigate('/payment', {
                      state: {
                        ...location.state,
                        selectedEvents: paymentEvents,
                        total: paymentTotal,
                      },
                    })
                  }
                  className="event-registration-page-31"
                >
                  <span className="event-registration-page-32">
                    <CreditCard className="event-registration-page-33" />
                    Payment
                  </span>
                </button>
              )}
            </div>
          </div>

          <div
            className={`grid gap-6 ${showPaymentSummary ? 'xl:grid-cols-[minmax(840px,1fr)_300px]' : ''}`}
          >
            <div
              className={`space-y-4 ${showPaymentSummary ? '' : 'mx-auto w-full xl:max-w-[1320px]'}`}
            >
              {displayEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  registration={getRegistration(event.id)}
                  showMultiEventState={isMultiEventsGroup}
                  compactParticipation={showPaymentSummary}
                  onRegister={handleRegister}
                />
              ))}
            </div>

            {showPaymentSummary && (
              <aside className="event-registration-page-34">
                <div className="event-registration-page-35">
                  <div className="event-registration-page-36">
                    <CreditCard className="event-registration-page-37" />
                    <h3 className="event-registration-page-38">Payment Summary</h3>
                  </div>
                  <ChevronUp className="event-registration-page-39" />
                </div>

                <div className="event-registration-page-40">
                  <span className="event-registration-page-41">
                    Selected Events ({paymentEvents.length})
                  </span>
                  <button onClick={handleClearAll} className="event-registration-page-42">
                    Clear All
                  </button>
                </div>

                <div className="event-registration-page-43">
                  {paymentEvents.map((event) => (
                    <div key={event.id} className="event-registration-page-44">
                      <div className="event-registration-page-45">
                        <p className="event-registration-page-46">{event.eventName}</p>
                        <p className="event-registration-page-47">
                          {event.participation === 'Team'
                            ? `Team (${event.teamSize ?? 'Varies'})`
                            : 'Individual'}
                        </p>
                      </div>
                      <div className="event-registration-page-48">
                        <span className="event-registration-page-49">
                          ₹{event.fees.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => clearRegistration(event.id)}
                          className="event-registration-page-50"
                          aria-label={`Remove ${event.eventName}`}
                        >
                          <X className="event-registration-page-51" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="event-registration-page-52">
                  <div className="event-registration-page-53">
                    <span>Total Amount</span>
                    <span className="event-registration-page-54">
                      ₹{paymentTotal.toLocaleString()}
                    </span>
                  </div>
                  <button onClick={handleProceedToPayment} className="event-registration-page-55">
                    Proceed to Payment →
                  </button>
                </div>
              </aside>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
