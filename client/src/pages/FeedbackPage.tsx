import { Star, ArrowLeft, MessageSquare, CheckCircle } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useEvents } from '../context/EventsContext';
import '../styles/FeedbackPage.css';

interface FeedbackEntry {
  eventId: string;
  rating: number;
  comment: string;
  submittedAt: string;
}

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { events, registrations } = useEvents();
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Get registered events
  const registeredEvents = useMemo(() => {
    return events.filter((e) => registrations[e.id] && registrations[e.id].formStatus === 'ready');
  }, [events, registrations]);

  const [selectedEventId, setSelectedEventId] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [success, setSuccess] = useState(false);

  // Get current feedbacks
  const feedbacks: FeedbackEntry[] = useMemo(() => {
    try {
      const stored = localStorage.getItem('ep_feedbacks');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [success]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    const newFeedback: FeedbackEntry = {
      eventId: selectedEventId,
      rating,
      comment,
      submittedAt: new Date().toISOString(),
    };

    try {
      const stored = localStorage.getItem('ep_feedbacks');
      const current: FeedbackEntry[] = stored ? JSON.parse(stored) : [];
      // Update or insert
      const index = current.findIndex((f) => f.eventId === selectedEventId);
      if (index > -1) {
        current[index] = newFeedback;
      } else {
        current.push(newFeedback);
      }
      localStorage.setItem('ep_feedbacks', JSON.stringify(current));
      setSuccess(true);
      setComment('');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSuccess(false);
        setSelectedEventId('');
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const selectedEventFeedback = feedbacks.find((f) => f.eventId === selectedEventId);

  return (
    <div className="feedback-page-1">
      <div className="feedback-page-2">
        <div className="feedback-page-3">
          <button onClick={() => navigate('/home')} className="feedback-page-4">
            <ArrowLeft className="feedback-page-5" />
          </button>
          <div>
            <h2 className="feedback-page-6">Share Feedback</h2>
            <p className="feedback-page-7">Your opinion helps us make our events better</p>
          </div>
        </div>

        <div className="feedback-page-8">
          {success ? (
            <div className="feedback-page-9">
              <div className="feedback-page-10">
                <CheckCircle className="feedback-page-11" />
              </div>
              <h3 className="feedback-page-12">Feedback Submitted!</h3>
              <p className="feedback-page-13">Thank you for your valuable feedback.</p>
            </div>
          ) : registeredEvents.length === 0 ? (
            <div className="feedback-page-14">
              <MessageSquare className="feedback-page-15" />
              <p className="feedback-page-16">No registered events found.</p>
              <p className="feedback-page-17">
                Please register for an event first before giving feedback.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="feedback-page-18">
              <div>
                <label className="feedback-page-19">Select Registered Event</label>
                <select
                  required
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    const fb = feedbacks.find((f) => f.eventId === e.target.value);
                    if (fb) {
                      setRating(fb.rating);
                      setComment(fb.comment);
                    } else {
                      setRating(5);
                      setComment('');
                    }
                  }}
                  className="feedback-page-20"
                >
                  <option value="">-- Choose an event --</option>
                  {registeredEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.eventName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEventId && (
                <>
                  <div>
                    <label className="feedback-page-21">Overall Rating</label>
                    <div className="feedback-page-22">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="feedback-page-23"
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
                      <span className="feedback-page-24">{rating} / 5</span>
                    </div>
                  </div>

                  <div>
                    <label className="feedback-page-25">Write your review</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your thoughts about the event organization, content, and scheduling..."
                      rows={4}
                      className="feedback-page-26"
                    />
                  </div>

                  <button type="submit" className="feedback-page-27">
                    {selectedEventFeedback ? 'Update Feedback' : 'Submit Feedback'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
