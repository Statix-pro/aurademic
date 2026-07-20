import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Lock, Calendar, MapPin, Users, Home, CreditCard, ChevronUp, X } from 'lucide-react'
import type { EventItem, EventRegistration, SubEventItem } from '../types'
import { useEvents } from '../context/EventsContext'
import { CATEGORY_COLORS, CategoryIcon, getCategorySolidBgClass, getLightLabelClass } from '../components/events/EventCard'

const DEFAULT_COLOR = { pill: 'bg-slate-100 text-slate-600', icon: 'text-slate-500', bg: 'bg-slate-50', button: 'bg-[#064675] hover:bg-[#05375c]' }

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical',
  CULTURAL: 'Cultural',
  SPORTS: 'Sports',
  LITERARY: 'Literary',
  MANAGEMENT: 'Management',
  'MULTI-EVENTS': 'Multi-Events',
}

const DETAIL_LABELS: Record<string, string> = {
  TECHNICAL: 'Workshop',
  CULTURAL: 'Dance',
  SPORTS: 'Athletics',
  LITERARY: 'Quiz',
  MANAGEMENT: 'Business',
  'MULTI-EVENTS': 'Extended',
}

function getStyles(category: string) {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR
}

function isAiHackathon(event: EventItem) {
  return event.eventName === 'AI Hackathon 2026'
}

function getAiShortlistLabel(registration?: EventRegistration) {
  if (!registration) return 'Shortlist Event'
  if (registration.reviewStatus === 'rejected') return 'Rejected'
  if (registration.reviewStatus === 'selected') return 'Selected'
  return 'Shortlist Event'
}

function getAiShortlistClass(label: string) {
  if (label === 'Selected') return 'border border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm'
  if (label === 'Rejected') return 'border border-rose-200 bg-rose-100 text-rose-700 shadow-sm'
  return 'border border-slate-300 bg-slate-100 text-slate-800 shadow-sm'
}

function getMultiEventStateLabel(event: EventItem, registration?: EventRegistration) {
  if (registration?.reviewStatus === 'selected') return 'Selected'
  if (registration?.reviewStatus === 'rejected') return 'Rejected'

  if (event.eventName === 'Build Battle') return 'Selected'
  if (event.eventName === 'Idea Pitch') return 'Rejected'

  return ''
}

function getPayNowButtonClass(category: string) {
  const styles = getStyles(category)
  return `${styles.button} text-white`
}

function toDisplayRows(selected?: EventItem) {
  if (!selected) return []
  if (selected.category === 'MULTI-EVENTS') {
    return (selected.subEvents ?? []).map(subEvent => toRowEvent(selected, subEvent))
  }
  return [selected]
}

function toRowEvent(event: EventItem, subEvent?: SubEventItem): EventItem {
  if (!subEvent) return event
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
  }
}

function flattenEvents(items: EventItem[]) {
  return items.flatMap(event => {
    if (event.category === 'MULTI-EVENTS') {
      return (event.subEvents ?? []).map(subEvent => toRowEvent(event, subEvent))
    }
    return [event]
  })
}

function getCompactParticipationLabel(label: string) {
  const [firstWord, secondWord] = label.trim().split(/\s+/, 2)
  if (!firstWord) return label
  return secondWord ? `${firstWord}..` : firstWord
}

function getRegisterState(event: EventItem, registration: EventRegistration | undefined, isOpen: boolean) {
  if (isAiHackathon(event)) {
    if (!registration) {
      return {
        label: 'Register Now',
        className: isOpen ? 'bg-[#064675] hover:bg-[#05375c] text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed',
        disabled: !isOpen,
        kind: 'register' as const,
      }
    }

    if (registration.reviewStatus === 'rejected') {
      return {
        label: 'Register Now',
        className: 'opacity-60 cursor-not-allowed',
        disabled: true,
        kind: 'register' as const,
      }
    }

    if (registration.reviewStatus === 'selected') {
      if (registration.paymentStatus === 'paid') {
        return {
          label: 'Selected',
          className: 'bg-emerald-600 text-white cursor-default',
          disabled: true,
          kind: 'register' as const,
        }
      }

      return {
        label: 'Pay Now',
        className: getPayNowButtonClass(event.category),
        disabled: false,
        kind: 'pay' as const,
      }
    }

    return {
      label: 'Pending',
      className: 'bg-amber-500 text-white cursor-default',
      disabled: true,
      kind: 'register' as const,
    }
  }

  if (event.category === 'MULTI-EVENTS') {
    const multiEventState = getMultiEventStateLabel(event, registration)

    if (multiEventState === 'Rejected') {
      return {
        label: 'Register Now',
        className: 'opacity-60 cursor-not-allowed',
        disabled: true,
        kind: 'register' as const,
      }
    }
  }

  if (!registration) {
    return {
      label: 'Register Now',
      className: isOpen ? 'bg-[#064675] hover:bg-[#05375c] text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed',
      disabled: !isOpen,
      kind: 'register' as const,
    }
  }

  if (registration.paymentStatus === 'paid') {
    return {
      label: 'Register Now',
      className: isOpen ? 'bg-[#064675] hover:bg-[#05375c] text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed',
      disabled: !isOpen,
      kind: 'register' as const,
    }
  }

  if (registration.formStatus === 'ready') {
    return {
      label: 'Pay Now',
      className: getPayNowButtonClass(event.category),
      disabled: false,
      kind: 'pay' as const,
    }
  }

  return {
    label: 'Register Now',
    className: isOpen ? 'bg-[#064675] hover:bg-[#05375c] text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed',
    disabled: !isOpen,
    kind: 'register' as const,
  }
}

function EventRow({
  event,
  registration,
  showMultiEventState = false,
  compactParticipation = false,
  onRegister,
}: {
  event: EventItem
  registration?: EventRegistration
  showMultiEventState?: boolean
  compactParticipation?: boolean
  onRegister: (event: EventItem) => void
}) {
  const navigate = useNavigate()
  const colors = getStyles(event.category)
  const isOpen = event.status === 'Open'
  const label1 = CATEGORY_LABELS[event.category] ?? event.category
  const label2 = DETAIL_LABELS[event.category] ?? event.category
  const participationText = event.participation === 'Team'
    ? (event.teamSize ?? 'Team')
    : 'Individual'
  const displayParticipationText = participationText
  const registerClass = isOpen ? `${colors.button} text-white` : 'bg-slate-300 text-slate-500 cursor-not-allowed'
  const statusClass = isOpen
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-rose-50 text-rose-600'
  const regState = getRegisterState(event, registration, isOpen)
  const shortlistLabel = isAiHackathon(event) ? getAiShortlistLabel(registration) : ''
  const multiEventStateLabel = showMultiEventState ? getMultiEventStateLabel(event, registration) : ''
  const shortlistStateLabel = shortlistLabel || multiEventStateLabel
  const showLockedRegisterArrow = (isAiHackathon(event) && registration?.reviewStatus === 'rejected') || multiEventStateLabel === 'Rejected'
  const buttonClass =
    regState.kind === 'register'
      ? (showLockedRegisterArrow ? `${registerClass} opacity-60 cursor-not-allowed` : registerClass)
      : regState.className

  const handlePrimaryAction = () => {
    if (regState.kind === 'pay') {
      navigate('/payment', { state: { selectedEvents: [event], total: event.fees } })
      return
    }

    if (regState.kind === 'register') {
      onRegister(event)
    }
  }

  return (
    <div className={`grid ${
      compactParticipation
        ? 'grid-cols-[145px_minmax(0,1fr)_85px_125px]'
        : 'grid-cols-[180px_minmax(0,1fr)_110px_150px]'
    } items-center rounded-2xl border border-slate-300 bg-white shadow-[0_3px_8px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]`}>
      <div className={`flex items-center gap-2.5 border-r border-slate-300 py-6 ${compactParticipation ? 'px-3' : 'px-4'}`}>
        <div className={`flex flex-shrink-0 items-center justify-center rounded-xl ${getCategorySolidBgClass(event.category)} ${compactParticipation ? 'h-11 w-11' : 'h-14 w-14'}`}>
          <CategoryIcon category={event.category} iconClassName="text-white" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none ${colors.pill}`}>
            {label1}
          </span>
          <span className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none ${getLightLabelClass(event.category)}`}>
            {label2}
          </span>
        </div>
      </div>

      <div className={`grid min-h-[96px] ${
        shortlistStateLabel ? 'grid-cols-[minmax(0,1fr)_120px]' : 'grid-cols-1'
      } items-center gap-4 border-r border-slate-300 px-5 py-6`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`${compactParticipation ? 'text-base' : 'text-lg'} font-semibold leading-tight text-slate-800`}>{event.eventName}</h3>
            {event.parentEventName && (
              <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 shadow-sm">
                {event.parentEventName}
              </span>
            )}
          </div>
          <div className={`mt-3 flex items-center ${compactParticipation ? 'gap-3 text-[11px]' : 'gap-4 text-sm'} whitespace-nowrap text-slate-500`}>
            <span className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
              <Calendar className={`h-4 w-4 ${colors.icon}`} />
              {event.date}
            </span>
            {!compactParticipation && (
              <span className="flex items-center gap-2 whitespace-nowrap">
                <MapPin className={`h-4 w-4 ${colors.icon}`} />
                {event.venue}
              </span>
            )}
            <span className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
              <Users className={`h-4 w-4 flex-shrink-0 ${colors.icon}`} />
              <span className="whitespace-nowrap">{displayParticipationText}</span>
            </span>
          </div>
        </div>
        {shortlistStateLabel && (
          <div className="flex translate-x-2 items-center justify-center">
            <span className={`inline-flex whitespace-nowrap rounded-md px-3 py-1 text-center text-[11px] font-bold leading-none ${getAiShortlistClass(shortlistStateLabel)}`}>
              {shortlistStateLabel}
            </span>
          </div>
        )}
      </div>

      <div className={`border-r border-slate-300 py-6 ${compactParticipation ? 'px-3' : 'px-5'}`}>
        <p className="text-sm text-slate-500">{event.participation === 'Team' ? 'Team' : 'Participant'}</p>
        <p className={`mt-1 text-xl font-bold ${colors.icon}`}>
          {'\u20B9'}{event.fees.toLocaleString()}
        </p>
      </div>

      <div className={`py-6 ${compactParticipation ? 'px-3' : 'px-5'}`}>
        <div className="flex flex-col items-center gap-2">
          <span className={`inline-flex h-5.5 w-16 items-center justify-center gap-1.5 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {isOpen ? 'Open' : 'Closed'}
          </span>
          {regState.label && (
            <div className={`group ${compactParticipation ? 'w-24' : 'w-28'}`}>
              <button
                onClick={handlePrimaryAction}
                disabled={regState.disabled}
                className={`h-8 w-full whitespace-nowrap rounded-md px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-100 ${buttonClass}`}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <span>{regState.label}</span>
                  {showLockedRegisterArrow && (
                    <Lock className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                  {!showLockedRegisterArrow && regState.kind === 'pay' && <ArrowRight className="h-3.5 w-3.5" />}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EventRegistrationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { getRegistration, registrations, events, clearRegistration } = useEvents()
  const selectedEvent = location.state?.event as EventItem | undefined
  const parentEvent = location.state?.parentEvent as EventItem | undefined
  const paymentEventId = location.state?.paymentEventId as string | undefined
  const [paymentSummaryDismissed, setPaymentSummaryDismissed] = useState(false)
  const isMultiEventsGroup = selectedEvent?.category === 'MULTI-EVENTS'
  const allDisplayEvents = useMemo(() => flattenEvents(events), [events])
  const displayEvents = useMemo(
    () => (selectedEvent ? toDisplayRows(selectedEvent) : allDisplayEvents),
    [allDisplayEvents, selectedEvent],
  )
  const isPayableEvent = (event: EventItem, registration: EventRegistration) => {
    if (registration.paymentStatus === 'paid') return false
    if (isAiHackathon(event)) return registration.reviewStatus === 'selected'
    if (event.category === 'MULTI-EVENTS') {
      const multiEventState = getMultiEventStateLabel(event, registration)
      if (multiEventState === 'Rejected') return false
    }
    return registration.formStatus === 'ready' || event.id === paymentEventId
  }
  const paymentEvents = useMemo(
    () => displayEvents.filter(event => {
      const registration = registrations[event.id]
      return Boolean(registration && isPayableEvent(event, registration))
    }),
    [displayEvents, registrations],
  )
  const paymentTotal = paymentEvents.reduce((sum, event) => sum + event.fees, 0)
  const showPaymentSummary = !paymentSummaryDismissed && paymentEvents.length > 0 && paymentTotal > 0
  const useTallOuterCard = displayEvents.length > 1 || showPaymentSummary

  const handleRegister = (event: EventItem) => {
    const parent = selectedEvent?.category === 'MULTI-EVENTS' ? selectedEvent : parentEvent
    navigate('/register', { state: { event, label: event.category, parentEvent: parent } })
  }

  const handleProceedToPayment = () => {
    if (!showPaymentSummary) return
    navigate('/payment', { state: { selectedEvents: paymentEvents, total: paymentTotal } })
  }

  const handleClearAll = () => {
    paymentEvents.forEach(event => clearRegistration(event.id))
    setPaymentSummaryDismissed(true)
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
            <button className="border-b-2 border-[#064675] px-2 py-4 text-sm font-semibold text-[#064675]">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Events
              </span>
            </button>
            <button
              onClick={() => navigate('/accommodation', { state: { ...location.state } })}
              className="px-2 py-4 text-sm font-medium text-slate-600 hover:text-[#064675] transition-colors"
            >
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

          <div className={`grid gap-6 ${showPaymentSummary ? 'xl:grid-cols-[minmax(840px,1fr)_300px]' : ''}`}>
            <div className={`space-y-4 ${showPaymentSummary ? '' : 'mx-auto w-full xl:max-w-[1320px]'}`}>
              {displayEvents.map(event => (
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
              <aside className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-300 pb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800">Payment Summary</h3>
                </div>
                <ChevronUp className="h-4 w-4 text-slate-400" />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-500">Selected Events ({paymentEvents.length})</span>
                <button
                  onClick={handleClearAll}
                  className="text-xs font-semibold text-rose-500 transition-colors hover:text-rose-600"
                >
                  Clear All
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {paymentEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{event.eventName}</p>
                      <p className="text-[11px] text-slate-400">
                        {event.participation === 'Team' ? `Team (${event.teamSize ?? 'Varies'})` : 'Individual'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-600">₹{event.fees.toLocaleString()}</span>
                      <button
                        type="button"
                        onClick={() => clearRegistration(event.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        aria-label={`Remove ${event.eventName}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                  <span>Total Amount</span>
                  <span className="text-[#064675]">₹{paymentTotal.toLocaleString()}</span>
                </div>
                <button
                  onClick={handleProceedToPayment}
                  className="mt-4 w-full rounded-xl bg-[#064675] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#05375c]"
                >
                  Proceed to Payment →
                </button>
              </div>
              </aside>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
