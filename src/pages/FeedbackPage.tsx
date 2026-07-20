import { useState, useMemo } from 'react'
import { useEvents } from '../context/EventsContext'
import { Star, ArrowLeft, MessageSquare, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface FeedbackEntry {
  eventId: string
  rating: number
  comment: string
  submittedAt: string
}

export default function FeedbackPage() {
  const navigate = useNavigate()
  const { events, registrations } = useEvents()
  
  // Get registered events
  const registeredEvents = useMemo(() => {
    return events.filter(e => registrations[e.id] && registrations[e.id].formStatus === 'ready')
  }, [events, registrations])

  const [selectedEventId, setSelectedEventId] = useState('')
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [success, setSuccess] = useState(false)

  // Get current feedbacks
  const feedbacks: FeedbackEntry[] = useMemo(() => {
    try {
      const stored = localStorage.getItem('ep_feedbacks')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }, [success])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEventId) return

    const newFeedback: FeedbackEntry = {
      eventId: selectedEventId,
      rating,
      comment,
      submittedAt: new Date().toISOString(),
    }

    try {
      const stored = localStorage.getItem('ep_feedbacks')
      const current: FeedbackEntry[] = stored ? JSON.parse(stored) : []
      // Update or insert
      const index = current.findIndex(f => f.eventId === selectedEventId)
      if (index > -1) {
        current[index] = newFeedback
      } else {
        current.push(newFeedback)
      }
      localStorage.setItem('ep_feedbacks', JSON.stringify(current))
      setSuccess(true)
      setComment('')
      setTimeout(() => {
        setSuccess(false)
        setSelectedEventId('')
      }, 2000)
    } catch (err) {
      console.error(err)
    }
  }

  const selectedEventFeedback = feedbacks.find(f => f.eventId === selectedEventId)

  return (
    <div className="min-h-[calc(100vh-48px)] bg-[#eaf2fb] dark:bg-slate-900/80 px-4 py-8 sm:px-6 md:py-10">
      <div className="mx-auto w-full max-w-[1200px] space-y-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400">Share Feedback</h2>
            <p className="text-xs text-slate-500">Your opinion helps us make our events better</p>
          </div>
        </div>

        <div className="rounded-[22px] bg-white p-6 shadow-sm border border-slate-300 dark:bg-slate-800 dark:border-slate-700">
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Feedback Submitted!</h3>
              <p className="mt-2 text-sm text-slate-500">Thank you for your valuable feedback.</p>
            </div>
          ) : registeredEvents.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">No registered events found.</p>
              <p className="text-xs text-slate-400 mt-1">Please register for an event first before giving feedback.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select Registered Event
                </label>
                <select
                  required
                  value={selectedEventId}
                  onChange={e => {
                    setSelectedEventId(e.target.value)
                    const fb = feedbacks.find(f => f.eventId === e.target.value)
                    if (fb) {
                      setRating(fb.rating)
                      setComment(fb.comment)
                    } else {
                      setRating(5)
                      setComment('')
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none shadow-sm focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Choose an event --</option>
                  {registeredEvents.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.eventName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEventId && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Overall Rating
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star
                            className={`h-8 w-8 ${
                              star <= (hoverRating || rating)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {rating} / 5
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Write your review
                    </label>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Share your thoughts about the event organization, content, and scheduling..."
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none shadow-sm focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors"
                  >
                    {selectedEventFeedback ? 'Update Feedback' : 'Submit Feedback'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
