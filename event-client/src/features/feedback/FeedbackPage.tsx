import {
  Star,
  ArrowLeft,
  MessageSquare,
  CheckCircle,
  Loader2,
  Award,
  ClipboardList,
  Clock,
  Utensils,
  Building,
  Presentation,
  Scale,
  Smile,
  Megaphone,
  Lightbulb,
  GraduationCap,
  Users,
  BookOpen,
  Video,
  ShoppingBag,
  Sparkles,
  Bed,
} from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../../config/api';
import { useEvents, flattenEvents } from '../../contexts/EventsContext';
import './FeedbackPage.css';

interface FeedbackOption {
  id: number;
  option_text: string;
}

interface FeedbackQuestion {
  id: number;
  question_text: string;
  question_type: string;
  section_name?: string;
  is_required: number;
  options: FeedbackOption[];
}

interface ResourcePersonMeta {
  id: number;
  name: string;
  organization?: string;
  date?: string;
  time?: string;
  topic?: string;
  feedbackEnabled?: boolean;
  isOnline?: boolean;
}

interface FeedbackSettings {
  eventFeedback?: any;
  eventToggles?: any;
  resourcePersonsFeedback?: ResourcePersonMeta[];
  accommodationFeedback?: any;
}

const getQuestionBadge = (text: string, section?: string) => {
  const lower = (text + ' ' + (section || '')).toLowerCase();
  if (lower.includes('overall')) return { icon: Award, label: 'Overall' };
  if (lower.includes('planning')) return { icon: ClipboardList, label: 'Planning' };
  if (
    lower.includes('time management') ||
    lower.includes('scheduled time') ||
    lower.includes('allotted time')
  )
    return { icon: Clock, label: 'Time Management' };
  if (
    lower.includes('catering') ||
    lower.includes('quality of the food') ||
    lower.includes('food and refreshment')
  )
    return { icon: Utensils, label: 'Catering' };
  if (lower.includes('venue') || lower.includes('facilities'))
    return { icon: Building, label: 'Facilities' };
  if (lower.includes('presentation') || lower.includes('present'))
    return { icon: Presentation, label: 'Presentation' };
  if (lower.includes('evaluation') || lower.includes('judging'))
    return { icon: Scale, label: 'Evaluation' };
  if (lower.includes('enjoyment') || lower.includes('engaging and enjoyable'))
    return { icon: Smile, label: 'Enjoyment' };
  if (lower.includes('come to know') || lower.includes('awareness'))
    return { icon: Megaphone, label: 'Awareness' };
  if (lower.includes('subject knowledge') || lower.includes('expertise'))
    return { icon: GraduationCap, label: 'Expertise' };
  if (lower.includes('engage the audience') || lower.includes('engagement'))
    return { icon: Users, label: 'Engagement' };
  if (lower.includes('relevance') || lower.includes('relevant'))
    return { icon: BookOpen, label: 'Relevance' };
  if (
    lower.includes('audio and video') ||
    lower.includes('online session') ||
    lower.includes('online quality')
  )
    return { icon: Video, label: 'Online Quality' };
  if (lower.includes('takeaway')) return { icon: ShoppingBag, label: 'Takeaway' };
  if (lower.includes('cleanliness')) return { icon: Sparkles, label: 'Cleanliness' };
  if (lower.includes('amenities') || lower.includes('hostel'))
    return { icon: Bed, label: 'Amenities' };
  if (lower.includes('food')) return { icon: Utensils, label: 'Food' };
  if (lower.includes('suggestion') || lower.includes('comment') || lower.includes('recommendation'))
    return { icon: Lightbulb, label: 'Suggestion' };
  return { icon: MessageSquare, label: section || 'Feedback' };
};

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { events, registrations, submitFeedback } = useEvents();

  // Get registered events with feedback enabled
  const registeredEvents = useMemo(() => {
    return flattenEvents(events).filter(
      (e) =>
        e.feedbackEnabled &&
        registrations[e.id] &&
        registrations[e.id].formStatus === 'ready' &&
        registrations[e.id].attendance === 'Present',
    );
  }, [events, registrations]);

  const [selectedEventId, setSelectedEventId] = useState('');
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [feedbackSettings, setFeedbackSettings] = useState<FeedbackSettings | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Mapping questionId -> answer value
  const [answers, setAnswers] = useState<Record<number, any>>({});

  // Fetch questions when event is selected
  useEffect(() => {
    if (!selectedEventId) {
      setQuestions([]);
      setFeedbackSettings(null);
      setAnswers({});
      return;
    }

    const reg = registrations[selectedEventId];
    if (!reg?.backendId) return;

    setLoadingQuestions(true);
    apiFetch<{
      questions: FeedbackQuestion[];
      existingAnswers?: Record<number, { ratingValue?: number; answerText?: string }>;
      feedbackSettings?: FeedbackSettings;
    }>(`/participant/registrations/${reg.backendId}/feedback-questions`)
      .then((data) => {
        setQuestions(data.questions || []);
        setFeedbackSettings(data.feedbackSettings || null);

        // Initialize answers state with existing values if available
        const initialAnswers: Record<number, any> = {};
        const existingMap = data.existingAnswers || {};

        data.questions?.forEach((q) => {
          const existing = existingMap[q.id];
          if (existing) {
            if (q.question_type === 'rating') {
              initialAnswers[q.id] = existing.ratingValue ?? 0;
            } else if (q.question_type === 'checkbox' || q.question_type === 'multiple-choice') {
              initialAnswers[q.id] = existing.answerText
                ? existing.answerText.split(', ').filter(Boolean)
                : [];
            } else {
              initialAnswers[q.id] = existing.answerText ?? '';
            }
          } else {
            if (q.question_type === 'rating') initialAnswers[q.id] = 0;
            else if (q.question_type === 'checkbox' || q.question_type === 'multiple-choice')
              initialAnswers[q.id] = [];
            else initialAnswers[q.id] = '';
          }
        });
        setAnswers(initialAnswers);
      })
      .catch(console.error)
      .finally(() => setLoadingQuestions(false));
  }, [selectedEventId, registrations]);

  const handleAnswerChange = (questionId: number, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleCheckboxChange = (questionId: number, optionText: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      if (checked) {
        return { ...prev, [questionId]: [...current, optionText] };
      } else {
        return { ...prev, [questionId]: current.filter((v: string) => v !== optionText) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    // Basic validation for required fields
    for (const q of questions) {
      if (q.is_required) {
        const val = answers[q.id];
        if (q.question_type === 'rating' && (!val || val === 0)) {
          alert(`Please provide a rating for "${q.question_text}"`);
          return;
        }
        if (
          (q.question_type === 'checkbox' || q.question_type === 'multiple-choice') &&
          (!val || val.length === 0)
        ) {
          alert(`Please select at least one option for "${q.question_text}"`);
          return;
        }
        if (
          (q.question_type === 'text' ||
            q.question_type === 'textarea' ||
            q.question_type === 'radio') &&
          (!val || String(val).trim() === '')
        ) {
          alert(`Please complete field "${q.question_text}"`);
          return;
        }
      }
    }

    const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
      questionId: Number(qId),
      value: val,
    }));

    try {
      setSubmitting(true);
      await submitFeedback(selectedEventId, formattedAnswers);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute ONLY the enabled toggle labels dynamically from saved DB settings/questions
  const enabledToggleLabels = useMemo(() => {
    const toggles =
      feedbackSettings?.eventFeedback?.toggles || feedbackSettings?.eventToggles || null;
    const toggleKeys = ['food', 'refreshment', 'presentation', 'evaluation', 'enjoyment'];

    if (toggles && typeof toggles === 'object') {
      return toggleKeys
        .filter((k) => Boolean(toggles[k]))
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1));
    }

    const questionTexts = questions.map((q) => q.question_text.trim().toLowerCase());
    return toggleKeys
      .filter((k) => questionTexts.includes(k))
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1));
  }, [feedbackSettings, questions]);

  const registration = registrations[selectedEventId];
  const hasFeedback = registration?.hasFeedback;

  // Group questions by section
  const { eventQuestions, resourcePersonSectionMap, accommodationQuestions, otherSectionMap } =
    useMemo(() => {
      const eventQs: FeedbackQuestion[] = [];
      const accommodationQs: FeedbackQuestion[] = [];
      const rpMap: Record<string, FeedbackQuestion[]> = {};
      const otherMap: Record<string, FeedbackQuestion[]> = {};

      questions.forEach((q) => {
        const sec = q.section_name || 'Event Feedback';
        if (sec === 'Event Feedback') {
          eventQs.push(q);
        } else if (sec === 'Accommodation Feedback') {
          accommodationQs.push(q);
        } else if (sec.startsWith('Resource Person:')) {
          if (!rpMap[sec]) rpMap[sec] = [];
          rpMap[sec].push(q);
        } else {
          if (!otherMap[sec]) otherMap[sec] = [];
          otherMap[sec].push(q);
        }
      });

      return {
        eventQuestions: eventQs,
        resourcePersonSectionMap: rpMap,
        accommodationQuestions: accommodationQs,
        otherSectionMap: otherMap,
      };
    }, [questions]);

  const renderQuestionRow = (q: FeedbackQuestion) => {
    const { icon: BadgeIcon, label: badgeLabel } = getQuestionBadge(
      q.question_text,
      q.section_name,
    );
    const currentVal = answers[q.id];

    return (
      <div className="feedback-question-row" key={q.id}>
        <div className="feedback-badge-container">
          <span className="feedback-badge">
            <BadgeIcon size={14} />
            {badgeLabel}
          </span>
        </div>

        <div className="feedback-question-text">
          {q.question_text} {q.is_required ? <span style={{ color: '#ef4444' }}>*</span> : null}
        </div>

        <div className="feedback-action-container">
          {q.question_type === 'rating' && (
            <div className="feedback-stars">
              {[1, 2, 3, 4, 5].map((star) => {
                const rating = typeof currentVal === 'number' ? currentVal : 0;
                return (
                  <button
                    key={star}
                    type="button"
                    className={`feedback-star-btn ${star <= rating ? 'active' : ''}`}
                    onClick={() => handleAnswerChange(q.id, star)}
                  >
                    <Star size={18} fill={star <= rating ? '#ffb800' : 'none'} strokeWidth={2} />
                  </button>
                );
              })}
            </div>
          )}

          {(q.question_type === 'radio' || q.question_type === 'single-choice') && (
            <div className="feedback-awareness-list">
              {q.options && q.options.length > 0
                ? q.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`feedback-awareness-pill ${currentVal === opt.option_text ? 'active' : ''}`}
                      onClick={() => handleAnswerChange(q.id, opt.option_text)}
                    >
                      {opt.option_text}
                    </button>
                  ))
                : ['Yes', 'No'].map((optText) => (
                    <button
                      key={optText}
                      type="button"
                      className={`feedback-awareness-pill ${currentVal === optText ? 'active' : ''}`}
                      onClick={() => handleAnswerChange(q.id, optText)}
                    >
                      {optText}
                    </button>
                  ))}
            </div>
          )}

          {(q.question_type === 'checkbox' || q.question_type === 'multiple-choice') && (
            <div className="feedback-awareness-list">
              {q.options?.map((opt) => {
                const selectedList = Array.isArray(currentVal) ? currentVal : [];
                const isSelected = selectedList.includes(opt.option_text);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`feedback-awareness-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => handleCheckboxChange(q.id, opt.option_text, !isSelected)}
                  >
                    {opt.option_text}
                  </button>
                );
              })}
            </div>
          )}

          {(q.question_type === 'text' ||
            q.question_type === 'textarea' ||
            q.question_type === 'short-text') && (
            <input
              type="text"
              className="feedback-text-input"
              value={currentVal || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            />
          )}

          {q.question_type === 'select' && (
            <select
              className="feedback-page-20"
              style={{ width: '220px' }}
              value={currentVal || ''}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            >
              <option value="">-- Select --</option>
              {q.options?.map((opt) => (
                <option key={opt.id} value={opt.option_text}>
                  {opt.option_text}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

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
          {hasFeedback ? (
            <div className="feedback-page-9">
              <div className="feedback-page-10">
                <CheckCircle className="feedback-page-11" />
              </div>
              <h3 className="feedback-page-12">Feedback Submitted!</h3>
              <p className="feedback-page-13">Thank you for your valuable feedback.</p>

              {events.find((e) => e.id === selectedEventId)?.certificateEnabled && (
                <div style={{ marginTop: '24px' }}>
                  <button
                    onClick={() => navigate('/certificates')}
                    className="feedback-submit-btn"
                    style={{
                      backgroundColor: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Award size={18} />
                    Download Certificate
                  </button>
                </div>
              )}
            </div>
          ) : registeredEvents.length === 0 ? (
            <div className="feedback-page-14">
              <MessageSquare className="feedback-page-15" />
              <p className="feedback-page-16">No eligible events found.</p>
              <p className="feedback-page-17">
                You must attend an event and be marked as 'Present' by the organizer to provide
                feedback.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="feedback-page-18">
              <div>
                <label className="feedback-page-19">Select Registered Event</label>
                <select
                  required
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
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

              {selectedEventId && loadingQuestions && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              )}

              {selectedEventId && !loadingQuestions && questions.length === 0 && (
                <div className="py-8 text-center text-slate-500">
                  No feedback questions are configured for this event.
                </div>
              )}

              {selectedEventId && !loadingQuestions && questions.length > 0 && (
                <div className="feedback-container">
                  {/* CARD 1: EVENT FEEDBACK */}
                  {eventQuestions.length > 0 && (
                    <div className="feedback-card">
                      <div className="feedback-card-header">
                        <h2 className="feedback-card-title">Event:</h2>
                      </div>

                      {/* Read-Only Top Labels Bar showing ONLY enabled items */}
                      {enabledToggleLabels.length > 0 && (
                        <div className="feedback-toggles-bar-readonly">
                          {enabledToggleLabels.map((label) => (
                            <div className="feedback-toggle-readonly-item" key={label}>
                              <span className="feedback-toggle-readonly-label">{label}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="feedback-questions-list">
                        {eventQuestions
                          .filter((q) => {
                            const txt = q.question_text.trim().toLowerCase();
                            return ![
                              'food',
                              'refreshment',
                              'presentation',
                              'evaluation',
                              'enjoyment',
                            ].includes(txt);
                          })
                          .map(renderQuestionRow)}
                      </div>
                    </div>
                  )}

                  {/* CARD 2: RESOURCE PERSONS CARDS */}
                  {Object.entries(resourcePersonSectionMap).map(
                    ([sectionName, rpQuestions], idx) => {
                      const rpMetaList = feedbackSettings?.resourcePersonsFeedback || [];
                      const rpMeta = rpMetaList[idx] || null;
                      const speakerName =
                        rpMeta?.name ||
                        sectionName.replace('Resource Person:', '').trim() ||
                        'Speaker';

                      return (
                        <div className="feedback-card" key={sectionName}>
                          <div className="feedback-resource-topbar">
                            <div className="feedback-resource-topbar-left">
                              <span className="feedback-resource-label">Resource Person:</span>
                              <span className="feedback-resource-meta-value">{speakerName}</span>
                            </div>
                            <div className="feedback-resource-topbar-meta">
                              {rpMeta?.date && (
                                <div className="feedback-resource-meta-item">
                                  <span>Date:</span>{' '}
                                  <span className="feedback-resource-meta-value">
                                    {rpMeta.date}
                                  </span>
                                </div>
                              )}
                              {rpMeta?.time && (
                                <div className="feedback-resource-meta-item">
                                  <span>Time:</span>{' '}
                                  <span className="feedback-resource-meta-value">
                                    {rpMeta.time}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {rpMeta?.topic && (
                            <div className="feedback-resource-topicbar">
                              <div className="feedback-resource-topic-left">
                                <span className="feedback-resource-label">Topic:</span>
                                <span className="feedback-resource-meta-value">{rpMeta.topic}</span>
                              </div>
                              <div className="feedback-resource-mode-pill">
                                <span
                                  className={`feedback-resource-mode-pill-btn ${
                                    rpMeta.isOnline ? 'inactive' : 'active'
                                  }`}
                                >
                                  Offline
                                </span>
                                <span
                                  className={`feedback-resource-mode-pill-btn ${
                                    rpMeta.isOnline ? 'active' : 'inactive'
                                  }`}
                                >
                                  Online
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="feedback-questions-list">
                            {rpQuestions.map(renderQuestionRow)}
                          </div>
                        </div>
                      );
                    },
                  )}

                  {/* CARD 3: ACCOMMODATION FEEDBACK */}
                  {accommodationQuestions.length > 0 && (
                    <div className="feedback-card">
                      <div className="feedback-card-header">
                        <h2 className="feedback-card-title">Accommodation</h2>
                      </div>
                      <div className="feedback-questions-list">
                        {accommodationQuestions.map(renderQuestionRow)}
                      </div>
                    </div>
                  )}

                  {/* OTHER CUSTOM SECTIONS */}
                  {Object.entries(otherSectionMap).map(([sectionName, secQuestions]) => (
                    <div className="feedback-card" key={sectionName}>
                      <div className="feedback-card-header">
                        <h2 className="feedback-card-title">{sectionName}</h2>
                      </div>
                      <div className="feedback-questions-list">
                        {secQuestions.map(renderQuestionRow)}
                      </div>
                    </div>
                  ))}

                  <button type="submit" disabled={submitting} className="feedback-submit-btn">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                      </>
                    ) : hasFeedback ? (
                      'Update Feedback'
                    ) : (
                      'Submit Feedback'
                    )}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
