import { X, Calendar, MapPin, Users, IndianRupee } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { CATEGORY_COLORS, isEventOpen } from './EventCard';

import type { EventItem } from '../../types';
import type { ReactNode } from 'react';

import './EventDetailModal.css';

interface Props {
  event: EventItem;
  onClose: () => void;
  onRegister: (event: EventItem) => void;
}

export default function EventDetailModal({ event, onClose, onRegister }: Props) {
  const isOpen = isEventOpen(event);
  const colors = CATEGORY_COLORS[event.category] ?? { pill: 'bg-slate-100 text-slate-600' };
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.showModal();
      const handleCancel = (e: Event) => {
        e.preventDefault();
        onClose();
      };
      dialog.addEventListener('cancel', handleCancel);
      return () => {
        dialog.removeEventListener('cancel', handleCancel);
      };
    }
  }, [onClose]);

  return (
    <div className="event-detail-modal-1">
      <dialog
        ref={dialogRef}
        className="event-detail-modal-2 border-none p-0 outline-none"
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
            {event.hasRegistrationFee && (
              <MetaItem
                icon={<IndianRupee className="event-detail-modal-13" />}
                label="Fee"
                value={`₹${event.fees.toLocaleString()} / ${event.feesUnit}`}
                valueClass="text-blue-700 font-bold"
              />
            )}
          </div>
          {isOpen && (
            <div className="event-detail-modal-14">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Open
              </span>
            </div>
          )}

          {event.coordinators && event.coordinators.length > 0 && (
            <div className="mt-8 border-t border-slate-200 pt-5">
              <h4 className="text-[15px] font-bold text-slate-800 mb-4">Coordinator Details</h4>
              {event.coordinators.map((coord, idx) => (
                <div key={idx} className="mb-5 last:mb-0">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Coordinator Name
                      </label>
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800">
                        {coord.name || '-'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Designation
                      </label>
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800">
                        {coord.designation || '-'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Mobile
                      </label>
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800">
                        {coord.mobile || '-'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Department
                      </label>
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800">
                        {coord.department || '-'}
                      </div>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Email
                      </label>
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 break-all">
                        {coord.email || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
      </dialog>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  value,
  valueClass = '',
}: {
  icon: ReactNode;
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
