import { Calendar, CalendarClock } from 'lucide-react'
import type { EventItem } from '../../types'
import '../../styles/EventCard.css'

export const CATEGORY_COLORS: Record<string, { pill: string; icon: string; bg: string; button: string }> = {
  TECHNICAL: { pill: 'bg-[#064675] text-white', icon: 'text-[#064675]', bg: 'bg-blue-50/50', button: 'bg-[#064675] hover:bg-[#05375c]' },
  CULTURAL: { pill: 'bg-purple-600 text-white', icon: 'text-purple-600', bg: 'bg-purple-50', button: 'bg-purple-600 hover:bg-purple-700' },
  SPORTS: { pill: 'bg-[#783c1d] text-white', icon: 'text-[#783c1d]', bg: 'bg-[#faf6f0]', button: 'bg-[#783c1d] hover:bg-[#613017]' },
  LITERARY: { pill: 'bg-orange-600 text-white', icon: 'text-orange-600', bg: 'bg-orange-50', button: 'bg-orange-600 hover:bg-orange-700' },
  MANAGEMENT: { pill: 'bg-pink-600 text-white', icon: 'text-pink-600', bg: 'bg-pink-50', button: 'bg-pink-600 hover:bg-pink-700' },
  'MULTI-EVENTS': { pill: 'bg-emerald-600 text-white', icon: 'text-emerald-600', bg: 'bg-emerald-50/60', button: 'bg-emerald-600 hover:bg-emerald-700' },
}

const DEFAULT_COLOR = { pill: 'bg-slate-700 text-white', icon: 'text-slate-500', bg: 'bg-slate-50', button: 'bg-slate-700 hover:bg-slate-800' }

export function getLightLabelClass(category: string) {
  switch (category) {
    case 'TECHNICAL':
      return 'border border-blue-200 bg-blue-100 text-[#064675]'
    case 'CULTURAL':
      return 'border border-purple-200 bg-purple-100 text-purple-700'
    case 'SPORTS':
      return 'border border-amber-200 bg-[#faf6f0] text-[#783c1d]'
    case 'LITERARY':
      return 'border border-orange-200 bg-orange-100 text-orange-700'
    case 'MANAGEMENT':
      return 'border border-pink-200 bg-pink-100 text-pink-700'
    case 'MULTI-EVENTS':
      return 'border border-emerald-200 bg-emerald-50 text-emerald-700'
    default:
      return 'border border-slate-300 bg-slate-100 text-slate-600'
  }
}

export function CategoryIcon({ category, iconClassName }: { category: string; iconClassName?: string }) {
  const cls = iconClassName ?? (CATEGORY_COLORS[category] ?? DEFAULT_COLOR).icon
  switch (category) {
    case 'TECHNICAL':
      return <svg className={`h-5 w-5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
    case 'CULTURAL':
      return <svg className={`h-5 w-5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" /></svg>
    case 'SPORTS':
      return <svg className={`h-5 w-5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2" /></svg>
    case 'LITERARY':
      return <svg className={`h-5 w-5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
    case 'MANAGEMENT':
      return <svg className={`h-5 w-5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3H8l-4 4h16l-4-4z" /></svg>
    case 'MULTI-EVENTS':
      return <svg className={`h-5 w-5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="3" y="13" width="7" height="7" rx="1.5" /><rect x="14" y="13" width="7" height="7" rx="1.5" /></svg>
    default:
      return <svg className={`h-5 w-5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /></svg>
  }
}

export function getCategorySolidBgClass(cat: string) {
  switch (cat) {
    case 'TECHNICAL':
      return 'bg-[#064675]'
    case 'CULTURAL':
      return 'bg-purple-600'
    case 'SPORTS':
      return 'bg-[#783c1d]'
    case 'LITERARY':
      return 'bg-orange-600'
    case 'MANAGEMENT':
      return 'bg-pink-600'
    case 'MULTI-EVENTS':
      return 'bg-emerald-600'
    default:
      return 'bg-slate-700'
  }
}

interface EventCardProps {
  event: EventItem
  onViewDetails?: (event: EventItem) => void
  actionLabel?: string
  actionClassName?: string
  actionDisabled?: boolean
  compact?: boolean
}

const EVENT_LABELS: Record<string, string> = {
  TECHNICAL: 'Workshop',
  CULTURAL: 'Dance',
  SPORTS: 'Sports',
  LITERARY: 'Quiz',
  MANAGEMENT: 'Business',
  'MULTI-EVENTS': 'Extended',
}

function parseDisplayDate(value: string) {
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed

  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return parts ? new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1])) : null
}

function formatDateRange(from: string, to: string) {
  const start = parseDisplayDate(from)
  const end = parseDisplayDate(to)
  if (!start || !end) return from === to ? from : `${from} - ${to}`

  const month = new Intl.DateTimeFormat('en-US', { month: 'short' })
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' })
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    return start.getDate() === end.getDate()
      ? `${month.format(start)} ${start.getDate()}, ${year.format(start)}`
      : `${month.format(start)} ${start.getDate()}-${end.getDate()}, ${year.format(start)}`
  }
  return `${month.format(start)} ${start.getDate()} - ${month.format(end)} ${end.getDate()}, ${year.format(end)}`
}

export default function EventCard({
  event,
  onViewDetails,
  actionLabel = 'View Details',
  actionClassName,
  actionDisabled = false,
  compact = false,
}: EventCardProps) {
  const colors = CATEGORY_COLORS[event.category] ?? DEFAULT_COLOR
  const detailLabel = EVENT_LABELS[event.category] ?? 'Event'
  const isOpen = event.status === 'Open'

  const handleAction = () => {
    if (!onViewDetails || actionDisabled) return
    onViewDetails(event)
  }


  const getCategoryTextClass = (cat: string) => {
    switch (cat) {
      case 'TECHNICAL':
        return 'text-[#064675]'
      case 'CULTURAL':
        return 'text-purple-700'
      case 'SPORTS':
        return 'text-[#783c1d]'
      case 'LITERARY':
        return 'text-orange-700'
      case 'MANAGEMENT':
        return 'text-pink-700'
      case 'MULTI-EVENTS':
        return 'text-emerald-700'
      default:
        return 'text-slate-800'
    }
  }

  const getStatusPillClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'border-emerald-100 bg-emerald-50 text-emerald-600'
      case 'closed':
        return 'border-rose-100 bg-rose-50 text-rose-500'
      case 'extended':
        return 'border-orange-100 bg-orange-50 text-orange-600'
      default:
        return 'border-slate-100 bg-slate-50 text-slate-600'
    }
  }

  const getStatusDotClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-emerald-500'
      case 'closed':
        return 'bg-rose-500'
      case 'extended':
        return 'bg-orange-500'
      default:
        return 'bg-slate-400'
    }
  }

  const pillClass = colors.pill
  const detailPillClass = getLightLabelClass(event.category)
  const iconContainerBg = compact ? getCategorySolidBgClass(event.category) : colors.bg
  const iconColorClass = compact ? 'text-white' : undefined

  const dateTextClass = compact ? getCategoryTextClass(event.category) : 'text-blue-700'
  const dateIconClass = compact ? getCategoryTextClass(event.category) : 'text-blue-500'
  const fromDate = event.fromDate ?? event.date
  const toDate = event.toDate ?? event.date
  const dateRange = formatDateRange(fromDate, toDate)

  const statusPillClass = compact ? getStatusPillClass(event.status) : (isOpen ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 'border-rose-100 bg-rose-50 text-rose-500')
  const statusDotClass = compact ? getStatusDotClass(event.status) : (isOpen ? 'bg-emerald-500' : 'bg-rose-500')

  const isClickable = Boolean(onViewDetails && !actionDisabled)

  return (
    <div
      onClick={isClickable ? handleAction : undefined}
      className={`rounded-xl border bg-white ${
        isClickable ? 'cursor-pointer transition-all duration-200' : ''
      } ${
        compact
          ? `border-slate-300 px-5 py-4 shadow-[0_3px_8px_rgba(15,23,42,0.06)] ${
              isClickable ? 'hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(15,23,42,0.14)]' : ''
            }`
          : `border-slate-200 px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] ${
              isClickable ? 'hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)]' : ''
            }`
      }`}
    >
      <div className="event-card-1">
        <div className="event-card-2">
          <div className={`flex flex-shrink-0 items-center justify-center rounded-xl ${iconContainerBg} ${compact ? 'h-11 w-11' : 'h-12 w-12'}`}>
            <CategoryIcon category={event.category} iconClassName={iconColorClass} />
          </div>
          <div className="event-card-3">
            <span className={`rounded-md px-2.5 py-0.5 text-[10px] font-semibold tracking-wide border ${pillClass}`}>
              {event.category}
            </span>
            <span className={`rounded-md px-2.5 py-0.5 text-[10px] font-semibold tracking-wide border ${detailPillClass}`}>
              {detailLabel}
            </span>
          </div>
        </div>
        <span className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusPillClass}`}>
          <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
          {event.status}
        </span>
      </div>

      <div className={`${compact ? 'mt-3.5 border-t border-slate-300 pt-3.5' : 'mt-4 border-t border-slate-200 pt-4'}`}>
        <h3 className={`${compact ? 'text-lg font-bold' : 'text-xl font-semibold'} leading-tight text-slate-800`}>{event.eventName}</h3>
      </div>

      <div className={`${compact ? 'mt-4' : 'mt-5'} flex items-end justify-between gap-3`}>
        <div className="event-card-4">
          <div className="event-card-5">
            <Calendar className={`h-4 w-4 ${dateIconClass}`} />
            <span className={`whitespace-nowrap ${dateTextClass}`}>
              {dateRange}
            </span>
          </div>
          {event.deadline && (
            <div className="event-card-6">
              <CalendarClock className="event-card-7" />
              <span className="event-card-8">{event.deadline}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleAction()
          }}
          disabled={actionDisabled || !onViewDetails}
          className={`rounded-lg font-semibold text-white shadow-sm transition-colors disabled:cursor-default disabled:opacity-100 ${compact ? 'px-4 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${actionClassName ?? colors.button}`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
