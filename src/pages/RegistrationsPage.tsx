import { useMemo, useState } from 'react';
import {
  ClipboardList,
  X,
  Calendar,
  MapPin,
  Users,
  CheckCircle,
  Eye,
  IndianRupee,
} from 'lucide-react';
import { useEvents } from '../context/EventsContext';
import type { EventItem, EventRegistration, PaymentProof } from '../types';
import {
  CATEGORY_COLORS,
  CategoryIcon,
  getCategorySolidBgClass,
  getLightLabelClass,
} from '../components/events/EventCard';
import '../styles/RegistrationsPage.css';

type FlattenedEventItem = EventItem & {
  parentEventObj?: EventItem;
};

function flattenEvents(items: EventItem[]) {
  return items.flatMap((event) => {
    if (event.category === 'MULTI-EVENTS') {
      return (event.subEvents ?? []).map((subEvent) => ({
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
      }));
    }
    return [event];
  });
}

const DETAIL_LABELS: Record<string, string> = {
  TECHNICAL: 'Workshop',
  CULTURAL: 'Dance',
  SPORTS: 'Athletics',
  LITERARY: 'Quiz',
  MANAGEMENT: 'Business',
  'MULTI-EVENTS': 'Extended',
};

function RegisteredEventRow({
  event,
  registration,
  onViewBill,
  onViewDetails,
}: {
  event: FlattenedEventItem;
  registration?: EventRegistration | null;
  onViewBill: () => void;
  onViewDetails: () => void;
}) {
  const colors = CATEGORY_COLORS[event.category] ?? {
    pill: 'bg-slate-100 text-slate-600',
    icon: 'text-slate-500',
    bg: 'bg-slate-50',
  };
  const detailLabel = DETAIL_LABELS[event.category] ?? 'Event';
  const displayParticipationText =
    event.participation === 'Team' ? `Team (${event.teamSize ?? 'Varies'})` : 'Individual';

  return (
    <div className="registrations-page-1">
      {/* Col 1: Category */}
      <div className="registrations-page-2">
        <div
          className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl ${getCategorySolidBgClass(event.category)}`}
        >
          <CategoryIcon category={event.category} iconClassName="text-white" />
        </div>
        <div className="registrations-page-3">
          <span
            className={`inline-flex w-fit rounded-md px-2.5 py-1 text-[11px] font-semibold leading-none ${colors.pill}`}
          >
            {event.category}
          </span>
          <span
            className={`inline-flex w-fit rounded-md px-2.5 py-1 text-[11px] font-semibold leading-none ${getLightLabelClass(event.category)}`}
          >
            {detailLabel}
          </span>
        </div>
      </div>

      {/* Col 2: Info details */}
      <div className="registrations-page-4">
        <div className="registrations-page-5">
          <div className="registrations-page-6">
            <h3 className="registrations-page-7">{event.eventName}</h3>
            {event.parentEventName && (
              <span className="registrations-page-8">{event.parentEventName}</span>
            )}
          </div>
          <div className="registrations-page-9">
            <span className="registrations-page-10">
              <Calendar className={`h-4 w-4 ${colors.icon}`} />
              {event.date}
            </span>
            <span className="registrations-page-11">
              <MapPin className={`h-4 w-4 ${colors.icon}`} />
              {event.venue}
            </span>
            <span className="registrations-page-12">
              <Users className={`h-4 w-4 flex-shrink-0 ${colors.icon}`} />
              <span>{displayParticipationText}</span>
            </span>
          </div>
        </div>
        <div className="registrations-page-13">
          <span className="registrations-page-14">
            {(() => {
              if (!registration) return 'Not Registered';
              if (registration.paymentStatus === 'paid') {
                if (registration.reviewStatus === 'selected') return 'Paid & Approved';
                if (registration.reviewStatus === 'rejected') return 'Rejected';
                return 'Paid (Pending Review)';
              }
              if (registration.paymentStatus === 'processing') return 'Verification Pending';
              if (registration.reviewStatus === 'selected') return 'Approved (Payment Required)';
              if (registration.reviewStatus === 'rejected') return 'Rejected';
              return 'Pending';
            })()}
          </span>
        </div>
      </div>

      {/* Col 3: Fee */}
      <div className="registrations-page-15">
        <span className="registrations-page-16">Participant</span>
        <span className="registrations-page-17">₹{event.fees}</span>
      </div>

      {/* Col 4: Action */}
      <div className="registrations-page-18">
        <span className="registrations-page-19">
          <CheckCircle className="registrations-page-20" />
          Registered
        </span>
        <button
          type="button"
          onClick={onViewDetails}
          className="registrations-page-21"
          title="Details"
        >
          <Eye className="registrations-page-22" />
        </button>
        <button type="button" onClick={onViewBill} className="registrations-page-23" title="Bill">
          <IndianRupee className="registrations-page-24" />
        </button>
      </div>
    </div>
  );
}

function BillModal({
  proof,
  eventName,
  onClose,
}: {
  proof: PaymentProof;
  eventName: string;
  onClose: () => void;
}) {
  return (
    <div className="registrations-page-25">
      <div className="registrations-page-26">
        <div className="registrations-page-27">
          <div>
            <h3 className="registrations-page-28">Bill Preview</h3>
            <p className="registrations-page-29">{eventName}</p>
          </div>
          <button
            onClick={onClose}
            className="registrations-page-30"
            aria-label="Close bill preview"
          >
            <X className="registrations-page-31" />
          </button>
        </div>

        <div className="registrations-page-32">
          <div className="registrations-page-33">
            <img
              src={proof.screenshotDataUrl}
              alt="Uploaded bill screenshot"
              className="registrations-page-34"
            />
          </div>

          <div className="registrations-page-35">
            <div className="registrations-page-36">
              <p className="registrations-page-37">Bill Type</p>
              <p className="registrations-page-38">{proof.billType}</p>
            </div>
            <div className="registrations-page-39">
              <p className="registrations-page-40">File Name</p>
              <p className="registrations-page-41">{proof.screenshotName}</p>
            </div>
            <div className="registrations-page-42">
              <p className="registrations-page-43">Uploaded At</p>
              <p className="registrations-page-44">{new Date(proof.uploadedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="registrations-page-45">
      <p className="registrations-page-46">{label}</p>
      <p className="registrations-page-47">{value || '-'}</p>
    </div>
  );
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="registrations-page-48">
      <h3 className="registrations-page-49">{title}</h3>
      {children}
    </section>
  );
}

function ReadField({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="registrations-page-50">{label}</label>
      <input readOnly value={value} className="registrations-page-51" />
    </div>
  );
}

function EventDetailsModal({
  event,
  registration,
  onClose,
}: {
  event: FlattenedEventItem;
  registration?: EventRegistration;
  onClose: () => void;
}) {
  const document = registration?.document;
  const teamMembers = registration?.teamMembers ?? [];
  const participation =
    event.participation === 'Team' ? `Team (${event.teamSize ?? 'Varies'})` : 'Individual';
  const colors = CATEGORY_COLORS[event.category] ?? {
    pill: 'bg-slate-700 text-white',
    bg: 'bg-slate-50',
    icon: 'text-slate-500',
  };

  return (
    <div className="registrations-page-52">
      <div className="registrations-page-53">
        {/* Header */}
        <div className="registrations-page-54">
          <div className="registrations-page-55">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${getCategorySolidBgClass(event.category)}`}
            >
              <CategoryIcon category={event.category} iconClassName="text-white" />
            </div>
            <div>
              <h2 className="registrations-page-56">{event.eventName}</h2>
              <span
                className={`mt-1 inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${colors.pill}`}
              >
                {event.category}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="registrations-page-57" aria-label="Close">
            <X className="registrations-page-58" />
          </button>
        </div>

        {/* Content */}
        <div className="registrations-page-59">
          {/* Event Details Section */}
          <ModalSection title="Event Details">
            <div className="registrations-page-60">
              <ReadField label="Event Name" value={event.eventName} />
              <ReadField label="Category" value={event.category} />
              <ReadField label="Date" value={event.date} />
              <ReadField label="Venue" value={event.venue} />
              <ReadField label="Participation" value={participation} />
              <ReadField
                label="Fees"
                value={`₹${event.fees.toLocaleString()} / ${event.feesUnit}`}
              />
            </div>
          </ModalSection>

          {/* Coordinator Details Section */}
          <ModalSection title="Coordinator Details">
            <div className="registrations-page-61">
              <ReadField label="Coordinator Name" value="Dr. Anitha R" />
              <ReadField label="Designation" value="Assistant Professor" />
              <ReadField label="Mobile" value="+91 98765 43210" />
              <ReadField
                label="Department"
                value="Computer Science & Engineering"
                className="registrations-page-62"
              />
              <ReadField label="Email" value="anitha.r@ksrct.ac.in" />
            </div>
          </ModalSection>

          {/* Team Details Section */}
          {event.participation === 'Team' && (
            <ModalSection title="Team Details">
              {teamMembers.length > 0 ? (
                <div className="registrations-page-63">
                  <table className="registrations-page-64">
                    <thead className="registrations-page-65">
                      <tr>
                        <th className="registrations-page-66">Name</th>
                        <th className="registrations-page-67">Email</th>
                        <th className="registrations-page-68">Organization</th>
                        <th className="registrations-page-69">Role</th>
                      </tr>
                    </thead>
                    <tbody className="registrations-page-70">
                      {teamMembers.map((member) => (
                        <tr key={member.id}>
                          <td className="registrations-page-71">{member.name || '-'}</td>
                          <td className="registrations-page-72">
                            {member.registeredMailId || '-'}
                          </td>
                          <td className="registrations-page-73">{member.organization || '-'}</td>
                          <td className="registrations-page-74">{member.role || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="registrations-page-75">No team member details saved.</div>
              )}
            </ModalSection>
          )}

          {/* Document Upload Section */}
          <ModalSection title="Document Upload">
            {document ? (
              <div className="registrations-page-76">
                <ReadField label="Registration Document" value={document.documentType} />
                <ReadField label="Document File" value={document.fileName} />
                <ReadField
                  label="Submitted At"
                  value={new Date(document.uploadedAt).toLocaleString()}
                />
              </div>
            ) : (
              <div className="registrations-page-77">No registration document uploaded.</div>
            )}
          </ModalSection>
        </div>
      </div>
    </div>
  );
}

export default function RegistrationsPage() {
  const { events, registrations } = useEvents();
  const [openBill, setOpenBill] = useState<{ eventName: string; proof: PaymentProof } | null>(null);
  const [openDetails, setOpenDetails] = useState<{
    event: FlattenedEventItem;
    registration?: EventRegistration;
  } | null>(null);

  const registeredEvents = useMemo(() => {
    return flattenEvents(events).filter((event) => {
      const registration = registrations[event.id];
      return Boolean(registration && registration.formStatus === 'ready');
    });
  }, [events, registrations]);

  const useTallOuterCard = registeredEvents.length > 1;

  return (
    <div className="registrations-page-78">
      <div className="registrations-page-79">
        <div className="registrations-page-80">
          <div className="registrations-page-81">
            <ClipboardList className="registrations-page-82" />
          </div>
          <div>
            <h2 className="registrations-page-83">My Registrations</h2>
          </div>
        </div>

        <section
          className={`${useTallOuterCard ? 'h-[calc(100vh-190px)] min-h-[620px] overflow-auto' : 'min-h-[260px]'} rounded-[22px] bg-white p-6 text-slate-800 shadow-sm border border-slate-300 dark:bg-slate-800 dark:border-slate-700`}
        >
          <div className="registrations-page-84">
            {registeredEvents.map((event) => {
              const registration = registrations[event.id];
              const proof = registration?.paymentProof;
              return (
                <RegisteredEventRow
                  key={event.id}
                  event={event}
                  registration={registration}
                  onViewDetails={() => setOpenDetails({ event, registration })}
                  onViewBill={() => proof && setOpenBill({ eventName: event.eventName, proof })}
                />
              );
            })}
          </div>
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
  );
}
