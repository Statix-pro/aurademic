import { X, Lock } from 'lucide-react'
import type { EventItem } from '../../types'

interface PaymentSectionProps {
  selectedEvents: EventItem[]
  discount: number
  serviceFee: number
  onClearEvent: (id: string) => void
  onProceed: () => void
}

export default function PaymentSection({
  selectedEvents,
  discount,
  serviceFee,
  onClearEvent,
  onProceed,
}: PaymentSectionProps) {
  const eventsTotal = selectedEvents.reduce((sum, e) => sum + e.fees, 0)
  const total = Math.max(0, eventsTotal - discount + serviceFee)

  return (
    <div className="sticky top-4 max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          Payment Summary
        </h3>
        {selectedEvents.length > 0 && (
          <button onClick={() => selectedEvents.forEach(e => onClearEvent(e.id))} className="text-xs font-medium text-red-500 hover:underline">
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Selected Events ({selectedEvents.length})
        </p>
        {selectedEvents.length === 0 && <p className="text-xs italic text-slate-400">No events selected</p>}
        {selectedEvents.map(ev => (
          <div
            key={ev.id}
            className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{ev.eventName}</p>
              <p className="text-[10px] text-slate-400">{ev.participation === 'Team' ? 'Team' : 'Individual'}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span className="text-sm font-bold text-emerald-600">₹{ev.fees.toLocaleString()}</span>
              <button
                onClick={() => onClearEvent(ev.id)}
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white hover:text-red-500"
                aria-label={`Remove ${ev.eventName}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 dark:bg-slate-900/30">
        <div className="flex items-center justify-between text-base font-bold text-slate-800 dark:text-slate-100">
          <span>Total Amount</span>
          <span className="text-blue-700 dark:text-blue-400">₹{total.toLocaleString()}</span>
        </div>
        <button
          onClick={onProceed}
          disabled={selectedEvents.length === 0}
          className="mt-4 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Proceed to Payment →
        </button>
      </div>

      <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-slate-400">
        <Lock className="h-3 w-3" /> Your payment information is secure and encrypted
      </p>
    </div>
  )
}
