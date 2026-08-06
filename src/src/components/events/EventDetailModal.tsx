import { X, Calendar, MapPin, Users, IndianRupee } from 'lucide-react';
import type { EventItem } from '../../types';
import { CATEGORY_COLORS } from './EventCard';
import '../../styles/EventDetailModal.css';

interface Props {
  event: EventItem;
  onClose: () => void;
  onRegister: (event: EventItem) => void;
}

export default function EventDetailModal({ event, onClose, onRegister }: Props) {
  const isOpen = event.status === 'Open';
  const colors = CATEGORY_COLORS[event.category] ?? { pill: 'bg-slate-100 text-slate-600' };

  return (
    <div className="event-detail-modal-1">
      <div
        className="event-detail-modal-2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
      >
        <div className="event-detail-modal-3">
          <div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${colors.pill}`}
            >
              {event.category}
            </span>
            <h2 id="event-detail-title" className="event-detail-modal-4">
              {event.eventName}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close event details"
            className="event-detail-modal-5"
          >
            <X className="event-detail-modal-6" />
          </button>
        </div>

        <div className="event-detail-modal-7">
          <p className="event-detail-modal-8">{event.description}</p>
          <div className="event-detail-modal-9">
            <MetaItem
              icon={<Calendar className="event-detail-modal-10" />}
              label="Date"
              value={event.date}
            />
            <MetaItem
              icon={<MapPin className="event-detail-modal-11" />}
              label="Venue"
              value={event.venue}
            />
            <MetaItem
              icon={<Users className="event-detail-modal-12" />}
              label="Participation"
              value={event.participation + (event.teamSize ? ` (${event.teamSize})` : '')}
            />
            <MetaItem
              icon={<IndianRupee className="event-detail-modal-13" />}
              label="Fee"
              value={`₹${event.fees.toLocaleString()} / ${event.feesUnit}`}
              valueClass="text-blue-700 font-bold"
            />
          </div>
          <div className="event-detail-modal-14">
            <span
              className={`text-xs font-semibold flex items-center gap-1.5 ${isOpen ? 'text-green-600' : 'text-red-500'}`}
            >
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`} />
              {event.status}
            </span>
          </div>
        </div>

        <div className="event-detail-modal-15">
          <button onClick={onClose} className="event-detail-modal-16">
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onRegister(event);
            }}
            disabled={!isOpen}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isOpen ? 'bg-blue-700 hover:bg-blue-800 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          >
            {isOpen ? 'Register Now →' : 'Registration Closed'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  value,
  valueClass = '',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="event-detail-modal-17">
      <div className="event-detail-modal-18">{icon}</div>
      <div>
        <p className="event-detail-modal-19">{label}</p>
        <p className={`text-sm font-medium text-slate-700 dark:text-slate-200 ${valueClass}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
