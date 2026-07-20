import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, CheckCircle, Upload, Calendar, Home } from 'lucide-react'
import type { EventItem, PaymentBillType, PaymentProof } from '../types'
import { useEvents } from '../context/EventsContext'

export default function PaymentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { markPaymentDone } = useEvents()
  const { selectedEvents = [], accommodation = null, total = 0 } = location.state ?? {}
  const [billType, setBillType] = useState<PaymentBillType>(
    selectedEvents.length > 0 ? 'event registration bill' : 'accommodation bill',
  )
  const [screenshotName, setScreenshotName] = useState('')
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('')

  const eventsTotal = selectedEvents.reduce((sum, ev) => sum + ev.fees, 0)
  const payableTotal = Number.isFinite(total) && total > 0 ? total : eventsTotal
  const hasPayableItems = selectedEvents.length > 0 || Boolean(accommodation)
  const canCompletePayment = hasPayableItems && Boolean(screenshotDataUrl)

  const historyItems = useMemo(() => {
    const items = selectedEvents.map(ev => ({
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
      billType === 'event registration bill' && screenshotDataUrl
        ? {
            billType,
            screenshotName,
            screenshotDataUrl,
            uploadedAt: new Date().toISOString(),
          }
        : null

    selectedEvents.forEach(event => markPaymentDone(event.id, proof))
    navigate(selectedEvents.length > 0 ? '/registrations' : '/home', { replace: true })
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
              <button
                onClick={() => navigate('/event-register', { state: { ...location.state } })}
                className="px-2 py-4 text-sm font-medium text-slate-600 hover:text-[#064675] transition-colors"
              >
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
              <button className="border-b-2 border-[#064675] px-2 py-4 text-sm font-semibold text-[#064675]">
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment
                </span>
              </button>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-[280px] w-[280px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <img
                    src={qrUrl}
                    alt="Payment QR"
                    className="h-[240px] w-[240px] object-contain"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-500">Scan to pay exact amount</p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">₹{payableTotal.toLocaleString()}</h3>
                  <p className="mt-1 text-xs text-slate-400">Fixed in QR for UPI payment</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <Upload className="h-4 w-4 text-[#064675]" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Payment Upload</h3>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Choose Title
                  </label>
                  <select
                    value={billType}
                    onChange={e => setBillType(e.target.value as PaymentBillType)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#064675] focus:ring-2 focus:ring-[#064675]/15"
                  >
                    <option value="event registration bill">Event Registration Bill</option>
                    <option value="accommodation bill">Accommodation Bill</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#064675] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#05375c]">
                    <Upload className="h-4 w-4" />
                    Upload Payment Screenshot
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleScreenshotChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {screenshotName && (
                    <span className="text-sm font-medium text-slate-500">{screenshotName}</span>
                  )}
                </div>

                {screenshotDataUrl && (
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                    <img src={screenshotDataUrl} alt="Uploaded payment screenshot" className="max-h-48 w-full object-contain" />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#064675]" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Payment History</h3>
              </div>

              <div className="space-y-2">
                {historyItems.length === 0 ? (
                  <p className="text-sm text-slate-400">No events selected</p>
                ) : (
                  historyItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{item.title}</p>
                        <p className="text-[10px] text-slate-400">{item.subtitle}</p>
                      </div>
                      <span className="flex-shrink-0 text-sm font-bold text-emerald-600">₹{item.amount.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={handleCompletePayment}
              disabled={!canCompletePayment}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle className="h-4 w-4" />
              Complete Payment
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
