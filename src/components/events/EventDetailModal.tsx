import { X, Calendar, MapPin, Users, IndianRupee } from 'lucide-react'
import type { EventItem } from '../../types'
import { CATEGORY_COLORS } from './EventCard'

interface Props {
  event: EventItem
  onClose: () => void
  onRegister: (event: EventItem) => void
}

export default function EventDetailModal({ event, onClose, onRegister }: Props) {
  const isOpen = event.status === 'Open'
  const colors = CATEGORY_COLORS[event.category] ?? { pill: 'bg-slate-100 text-slate-600' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${colors.pill}`}>
              {event.category}
            </span>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{event.eventName}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">{event.description}</p>
          <div className="grid grid-cols-2 gap-3">
            <MetaItem icon={<Calendar className="w-4 h-4 text-blue-500" />} label="Date" value={event.date} />
            <MetaItem icon={<MapPin className="w-4 h-4 text-blue-500" />} label="Venue" value={event.venue} />
            <MetaItem
              icon={<Users className="w-4 h-4 text-blue-500" />}
              label="Participation"
              value={event.participation + (event.teamSize ? ` (${event.teamSize})` : '')}
            />
            <MetaItem
              icon={<IndianRupee className="w-4 h-4 text-blue-500" />}
              label="Fee"
              value={`₹${event.fees.toLocaleString()} / ${event.feesUnit}`}
              valueClass="text-blue-700 font-bold"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className={`text-xs font-semibold flex items-center gap-1.5 ${isOpen ? 'text-green-600' : 'text-red-500'}`}>
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`} />
              {event.status}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 transition-colors">
            Close
          </button>
          <button
            onClick={() => { onClose(); onRegister(event) }}
            disabled={!isOpen}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isOpen ? 'bg-blue-700 hover:bg-blue-800 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          >
            {isOpen ? 'Register Now →' : 'Registration Closed'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MetaItem({ icon, label, value, valueClass = '' }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-medium text-slate-700 dark:text-slate-200 ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}
