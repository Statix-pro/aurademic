import { X, Lock } from 'lucide-react'
import type { EventItem } from '../types'
import '../styles/PaymentSection.css'

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
    <div className="payment-section-1">
      <div className="payment-section-2">
        <h3 className="payment-section-3">
          <svg className="payment-section-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          Payment Summary
        </h3>
        {selectedEvents.length > 0 && (
          <button onClick={() => selectedEvents.forEach(e => onClearEvent(e.id))} className="payment-section-5">
            Clear All
          </button>
        )}
      </div>

      <div className="payment-section-6">
        <p className="payment-section-7">
          Selected Events ({selectedEvents.length})
        </p>
        {selectedEvents.length === 0 && <p className="payment-section-8">No events selected</p>}
        {selectedEvents.map(ev => (
          <div
            key={ev.id}
            className="payment-section-9"
          >
            <div className="payment-section-10">
              <p className="payment-section-11">{ev.eventName}</p>
              <p className="payment-section-12">{ev.participation === 'Team' ? 'Team' : 'Individual'}</p>
            </div>
            <div className="payment-section-13">
              <span className="payment-section-14">₹{ev.fees.toLocaleString()}</span>
              <button
                onClick={() => onClearEvent(ev.id)}
                className="payment-section-15"
                aria-label={`Remove ${ev.eventName}`}
              >
                <X className="payment-section-16" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="payment-section-17">
        <div className="payment-section-18">
          <span>Total Amount</span>
          <span className="payment-section-19">₹{total.toLocaleString()}</span>
        </div>
        <button
          onClick={onProceed}
          disabled={selectedEvents.length === 0}
          className="payment-section-20"
        >
          Proceed to Payment →
        </button>
      </div>

      <p className="payment-section-21">
        <Lock className="payment-section-22" /> Your payment information is secure and encrypted
      </p>
    </div>
  )
}
