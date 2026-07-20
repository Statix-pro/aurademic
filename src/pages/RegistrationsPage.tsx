import { useMemo, useState } from 'react'
import { ClipboardList, X, Calendar, MapPin, Users, CheckCircle, Eye, IndianRupee } from 'lucide-react'
import { useEvents } from '../context/EventsContext'
import type { EventItem, EventRegistration, PaymentProof } from '../types'
import { CATEGORY_COLORS, CategoryIcon, getCategorySolidBgClass, getLightLabelClass } from '../components/events/EventCard'

type FlattenedEventItem = EventItem & {
  parentEventObj?: EventItem
}

function flattenEvents(items: EventItem[]) {
  return items.flatMap(event => {
    if (event.category === 'MULTI-EVENTS') {
      return (event.subEvents ?? []).map(subEvent => ({
        ...event,
        id: `${event.id}-${subEvent.id}`,
        eventName: subEvent.eventName,
        parentEventName: event.eventName,
        parentEventObj: event,
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

const DETAIL_LABELS: Record<string, string> = {
  TECHNICAL: 'Workshop',
  CULTURAL: 'Dance',
  SPORTS: 'Athletics',
  LITERARY: 'Quiz',
  MANAGEMENT: 'Business',
  'MULTI-EVENTS': 'Extended',
}

function RegisteredEventRow({
  event,
  onViewBill,
  onViewDetails,
}: {
  event: FlattenedEventItem
  onViewBill: () => void
  onViewDetails: () => void
}) {
  const colors = CATEGORY_COLORS[event.category] ?? { pill: 'bg-slate-100 text-slate-600', icon: 'text-slate-500', bg: 'bg-slate-50' }
  const detailLabel = DETAIL_LABELS[event.category] ?? 'Event'
  const displayParticipationText = event.participation === 'Team' ? `Team (${event.teamSize ?? 'Varies'})` : 'Individual'

  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)_110px_200px] items-center rounded-2xl border border-slate-300 bg-white shadow-[0_3px_8px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]">
      {/* Col 1: Category */}
      <div className="flex items-center gap-3 border-r border-slate-300 px-4 py-4">
        <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl ${getCategorySolidBgClass(event.category)}`}>
          <CategoryIcon category={event.category} iconClassName="text-white" />
        </div>
        <div className="flex flex-col gap-2">
          <span className={`inline-flex w-fit rounded-md px-2.5 py-1 text-[11px] font-semibold leading-none ${colors.pill}`}>
            {event.category}
          </span>
          <span className={`inline-flex w-fit rounded-md px-2.5 py-1 text-[11px] font-semibold leading-none ${getLightLabelClass(event.category)}`}>
            {detailLabel}
          </span>
        </div>
      </div>

      {/* Col 2: Info details */}
      <div className="grid min-h-[80px] grid-cols-[minmax(0,1fr)_120px] items-center gap-4 border-r border-slate-300 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold leading-tight text-slate-800">{event.eventName}</h3>
            {event.parentEventName && (
              <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 shadow-sm">
                {event.parentEventName}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-4 whitespace-nowrap text-sm text-slate-500">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Calendar className={`h-4 w-4 ${colors.icon}`} />
              {event.date}
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <MapPin className={`h-4 w-4 ${colors.icon}`} />
              {event.venue}
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Users className={`h-4 w-4 flex-shrink-0 ${colors.icon}`} />
              <span>{displayParticipationText}</span>
            </span>
          </div>
        </div>
        <div className="flex translate-x-2 items-center justify-center">
          <span className="inline-flex whitespace-nowrap rounded-md px-3 py-1 text-center text-[11px] font-bold leading-none border border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm">
            Paid & Approved
          </span>
        </div>
      </div>

      {/* Col 3: Fee */}
      <div className="flex min-h-[80px] flex-col justify-center border-r border-slate-300 px-5 py-4 text-center">
        <span className="text-[11px] font-semibold text-slate-400">Participant</span>
        <span className="mt-1 text-xl font-extrabold text-[#064675]">₹{event.fees}</span>
      </div>

      {/* Col 4: Action */}
      <div className="flex gap-2 px-4 py-4 items-center justify-center w-[200px]">
        <span className="inline-flex h-8 items-center justify-center rounded-md bg-emerald-600 px-2.5 text-xs font-semibold text-white cursor-default whitespace-nowrap">
          <CheckCircle className="mr-1 h-3.5 w-3.5" />
          Registered
        </span>
        <button
          type="button"
          onClick={onViewDetails}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          title="Details"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onViewBill}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          title="Bill"
        >
          <IndianRupee className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function BillModal({
  proof,
  eventName,
  onClose,
}: {
  proof: PaymentProof
  eventName: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Bill Preview</h3>
            <p className="text-sm text-slate-500">{eventName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close bill preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <img
              src={proof.screenshotDataUrl}
              alt="Uploaded bill screenshot"
              className="max-h-[260px] w-full object-contain"
            />
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill Type</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{proof.billType}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">File Name</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-800">{proof.screenshotName}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded At</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{new Date(proof.uploadedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value || '-'}</p>
    </div>
  )
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 border-b border-slate-200 pb-2.5 text-[15px] font-bold text-[#00558f]">
        {title}
      </h3>
      {children}
    </section>
  )
}

function ReadField({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        readOnly
        value={value}
        className="cursor-default rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-800 outline-none shadow-sm transition-all duration-200"
      />
    </div>
  )
}

function EventDetailsModal({
  event,
  registration,
  onClose,
}: {
  event: FlattenedEventItem
  registration?: EventRegistration
  onClose: () => void
}) {
  const document = registration?.document
  const teamMembers = registration?.teamMembers ?? []
  const participation = event.participation === 'Team' ? `Team (${event.teamSize ?? 'Varies'})` : 'Individual'
  const colors = CATEGORY_COLORS[event.category] ?? { pill: 'bg-slate-700 text-white', bg: 'bg-slate-50', icon: 'text-slate-500' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-sm">
      <div className="w-full max-w-[860px] overflow-hidden rounded-[24px] bg-gradient-to-br from-white via-[#f3f7fc] to-[#e6effa] shadow-[0_22px_60px_rgba(15,23,42,0.26)] flex flex-col max-h-[86vh]">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-transparent px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${getCategorySolidBgClass(event.category)}`}>
              <CategoryIcon category={event.category} iconClassName="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#00558f]">{event.eventName}</h2>
              <span className={`mt-1 inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${colors.pill}`}>
                {event.category}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100/50 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-6 space-y-6">
          
          {/* Event Details Section */}
          <ModalSection title="Event Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ReadField label="Event Name" value={event.eventName} />
              <ReadField label="Category" value={event.category} />
              <ReadField label="Date" value={event.date} />
              <ReadField label="Venue" value={event.venue} />
              <ReadField label="Participation" value={participation} />
              <ReadField label="Fees" value={`₹${event.fees.toLocaleString()} / ${event.feesUnit}`} />
            </div>
          </ModalSection>

          {/* Coordinator Details Section */}
          <ModalSection title="Coordinator Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ReadField label="Coordinator Name" value="Dr. Anitha R" />
              <ReadField label="Designation" value="Assistant Professor" />
              <ReadField label="Mobile" value="+91 98765 43210" />
              <ReadField label="Department" value="Computer Science & Engineering" className="sm:col-span-2" />
              <ReadField label="Email" value="anitha.r@ksrct.ac.in" />
            </div>
          </ModalSection>

          {/* Team Details Section */}
          {event.participation === 'Team' && (
            <ModalSection title="Team Details">
              {teamMembers.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-[#00558f] text-white">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold text-xs">Name</th>
                        <th className="px-4 py-2.5 font-semibold text-xs">Email</th>
                        <th className="px-4 py-2.5 font-semibold text-xs">Organization</th>
                        <th className="px-4 py-2.5 font-semibold text-xs">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {teamMembers.map(member => (
                        <tr key={member.id}>
                          <td className="px-4 py-2.5 font-semibold text-slate-800 text-xs">{member.name || '-'}</td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs">{member.registeredMailId || '-'}</td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs">{member.organization || '-'}</td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs">{member.role || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                  No team member details saved.
                </div>
              )}
            </ModalSection>
          )}

          {/* Document Upload Section */}
          <ModalSection title="Document Upload">
            {document ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <ReadField label="Registration Document" value={document.documentType} />
                <ReadField label="Document File" value={document.fileName} />
                <ReadField label="Submitted At" value={new Date(document.uploadedAt).toLocaleString()} />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                No registration document uploaded.
              </div>
            )}
          </ModalSection>

        </div>
      </div>
    </div>
  )
}

export default function RegistrationsPage() {
  const { events, registrations } = useEvents()
  const [openBill, setOpenBill] = useState<{ eventName: string; proof: PaymentProof } | null>(null)
  const [openDetails, setOpenDetails] = useState<{ event: FlattenedEventItem; registration?: EventRegistration } | null>(null)

  const registeredEvents = useMemo(() => {
    return flattenEvents(events).filter(event => {
      const registration = registrations[event.id]
      return Boolean(registration?.paymentStatus === 'paid' && registration.paymentProof)
    })
  }, [events, registrations])

  const useTallOuterCard = registeredEvents.length > 1

  return (
    <div className="min-h-[calc(100vh-48px)] flex-1 overflow-auto bg-[#eaf2fb] px-4 py-8 sm:px-6 md:py-10">
      <div className="mx-auto w-full max-w-[1200px] space-y-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
            <ClipboardList className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-blue-700">My Registrations</h2>
          </div>
        </div>

        <section className={`${useTallOuterCard ? 'h-[calc(100vh-190px)] min-h-[620px] overflow-auto' : 'min-h-[260px]'} rounded-[22px] bg-white p-6 text-slate-800 shadow-sm border border-slate-300 dark:bg-slate-800 dark:border-slate-700`}>
          {registeredEvents.length > 0 ? (
            <div className="mx-auto h-full w-full space-y-4 overflow-auto">
              {registeredEvents.map(event => {
                const registration = registrations[event.id]
                const proof = registration?.paymentProof
                return (
                  <RegisteredEventRow
                    key={event.id}
                    event={event}
                    onViewDetails={() => setOpenDetails({ event, registration })}
                    onViewBill={() => proof && setOpenBill({ eventName: event.eventName, proof })}
                  />
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf2fb] dark:bg-slate-700/50">
                <ClipboardList className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No registrations yet</h3>
              <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">Paid events with uploaded bill proof will appear here.</p>
            </div>
          )}
        </section>
      </div>

      {openBill && (
        <BillModal
          eventName={openBill.eventName}
          proof={openBill.proof}
          onClose={() => setOpenBill(null)}
        />
      )}

      {openDetails && (
        <EventDetailsModal
          event={openDetails.event}
          registration={openDetails.registration}
          onClose={() => setOpenDetails(null)}
        />
      )}
    </div>
  )
}
