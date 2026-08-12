import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, CheckCircle, Upload, Calendar, Home } from 'lucide-react'
import type { EventItem, PaymentBillType, PaymentProof, SelectedAccommodation } from '../types'
import { useEvents } from '../context/EventsContext'
import '../styles/PaymentPage.css'

export default function PaymentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { markPaymentDone } = useEvents()
  const { selectedEvents = [], accommodation = null, total = 0 } = (location.state as { selectedEvents?: EventItem[]; accommodation?: SelectedAccommodation | null; total?: number }) ?? {}
  const [billType, setBillType] = useState<PaymentBillType>(
    selectedEvents.length > 0 ? 'event registration bill' : 'accommodation bill',
  )
  const [screenshotName, setScreenshotName] = useState('')
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('')

  const eventsTotal = selectedEvents.reduce((sum: number, ev) => sum + ev.fees, 0)
  const accommodationTotal = accommodation ? accommodation.pricePerNight : 0
  const payableTotal = Number.isFinite(total) && total > 0 ? total : (eventsTotal + accommodationTotal)
  const hasPayableItems = selectedEvents.length > 0 || Boolean(accommodation)
  const canCompletePayment = hasPayableItems && Boolean(screenshotDataUrl)

  const historyItems = useMemo(() => {
    const items: Array<{ id: string; title: string; subtitle: string; amount: number }> = selectedEvents.map(ev => ({
      id: ev.id,
      title: ev.eventName,
      subtitle: ev.participation === 'Team' ? 'Team' : 'Individual',
      amount: ev.fees,
    }))

    if (accommodation) {
      items.push({
        id: `accommodation-${accommodation.optionId}`,
        title: accommodation.roomType || 'Accommodation',
        subtitle: `${accommodation.nights} nights`,
        amount: accommodation.pricePerNight,
      })
    }

    return items
  }, [selectedEvents, accommodation])

  const upiId = 'eventpro@upi'
  const upiName = 'EventPro'
  const upiNote = billType === 'accommodation bill' ? 'Accommodation payment' : 'Event registration payment'
  const upiUri = useMemo(() => {
    const amount = payableTotal.toFixed(2)
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(upiNote)}`
  }, [payableTotal, upiNote])
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}`

  const handleScreenshotChange = (file?: File | null) => {
    if (!file) {
      setScreenshotName('')
      setScreenshotDataUrl('')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setScreenshotName(file.name)
      setScreenshotDataUrl(String(reader.result ?? ''))
    }
    reader.readAsDataURL(file)
  }

  const handleCompletePayment = () => {
    const proof: PaymentProof | null =
      screenshotDataUrl
        ? {
            billType,
            screenshotName,
            screenshotDataUrl,
            uploadedAt: new Date().toISOString(),
          }
        : null

    if (billType === 'event registration bill' && proof) {
      selectedEvents.forEach(event => markPaymentDone(event.id, proof))
    } else if (billType === 'accommodation bill' && proof) {
      localStorage.setItem('accommodation_payment_proof', JSON.stringify(proof))
    }

    navigate(selectedEvents.length > 0 ? '/registrations' : '/home', { replace: true })
  }

  return (
    <div className="payment-page-1">
      <div className="payment-page-2">
        <div className="payment-page-3">
          <div className="payment-page-4">
            <button
              onClick={() => navigate('/home')}
              className="payment-page-5"
            >
              <ArrowLeft className="payment-page-6" />
            </button>
            <div>
              <h2 className="payment-page-7">Event Lists</h2>
            </div>
          </div>
        </div>

        <section className="payment-page-8">
          <div className="payment-page-9">
            <div className="payment-page-10">
              <button
                onClick={() => navigate('/event-register', { state: { ...location.state } })}
                className="payment-page-11"
              >
                <span className="payment-page-12">
                  <Calendar className="payment-page-13" />
                  Events
                </span>
              </button>
              <button
                onClick={() => navigate('/accommodation', { state: { ...location.state } })}
                className="payment-page-14"
              >
                <span className="payment-page-15">
                  <Home className="payment-page-16" />
                  Accommodation
                </span>
              </button>
              <button className="payment-page-17">
                <span className="payment-page-18">
                  <CreditCard className="payment-page-19" />
                  Payment
                </span>
              </button>
            </div>
          </div>

          <div className="payment-page-20">
            <div className="payment-page-21">
              <div className="payment-page-22">
                <div className="payment-page-23">
                  <img
                    src={qrUrl}
                    alt="Payment QR"
                    className="payment-page-24"
                  />
                </div>
                <div className="payment-page-25">
                  <p className="payment-page-26">Scan to pay exact amount</p>
                  <h3 className="payment-page-27">₹{payableTotal.toLocaleString()}</h3>
                  <p className="payment-page-28">Fixed in QR for UPI payment</p>
                </div>
              </div>
            </div>

            <div className="payment-page-29">
              <div className="payment-page-30">
                <Upload className="payment-page-31" />
                <h3 className="payment-page-32">Payment Upload</h3>
              </div>

              <div className="payment-page-33">
                <div>
                  <label className="payment-page-34">
                    Choose Title
                  </label>
                  <select
                    value={billType}
                    onChange={e => setBillType(e.target.value as PaymentBillType)}
                    className="payment-page-35"
                  >
                    <option value="event registration bill">Event Registration Bill</option>
                    <option value="accommodation bill">Accommodation Bill</option>
                  </select>
                </div>

                <div className="payment-page-36">
                  <label className="payment-page-37">
                    <Upload className="payment-page-38" />
                    Upload Payment Screenshot
                    <input
                      type="file"
                      accept="image/*"
                      className="payment-page-39"
                      onChange={e => handleScreenshotChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {screenshotName && (
                    <span className="payment-page-40">{screenshotName}</span>
                  )}
                </div>

                {screenshotDataUrl && (
                  <div className="payment-page-41">
                    <img src={screenshotDataUrl} alt="Uploaded payment screenshot" className="payment-page-42" />
                  </div>
                )}
              </div>
            </div>

            <div className="payment-page-43">
              <div className="payment-page-44">
                <CreditCard className="payment-page-45" />
                <h3 className="payment-page-46">Payment History</h3>
              </div>

              <div className="payment-page-47">
                {historyItems.length === 0 ? (
                  <p className="payment-page-48">No events selected</p>
                ) : (
                  historyItems.map(item => (
                    <div
                      key={item.id}
                      className="payment-page-49"
                    >
                      <div className="payment-page-50">
                        <p className="payment-page-51">{item.title}</p>
                        <p className="payment-page-52">{item.subtitle}</p>
                      </div>
                      <span className="payment-page-53">₹{item.amount.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={handleCompletePayment}
              disabled={!canCompletePayment}
              className="payment-page-54"
            >
              <CheckCircle className="payment-page-55" />
              Complete Payment
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
