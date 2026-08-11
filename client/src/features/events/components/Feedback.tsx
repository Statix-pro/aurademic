import React, { useState } from "react";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import {
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
  Plus,
  Trash2,
  Star,
  User,
  Calendar,
} from "lucide-react";
import "../styles/Feedback.css";
import {
  EVENT_COPY,
  EVENT_FEEDBACK_AWARENESS_CHANNELS,
  EVENT_FEEDBACK_TOGGLES,
  EVENT_RESOURCE_PERSON_OPTIONS,
} from "../constants";

interface ResourcePersonState {
  id: number;
  name: string;
  organization: string;
  date: string;
  time: string;
  topic: string;
  feedbackEnabled: boolean;
  isOnline: boolean;
  ratings: {
    expertise: number;
    engagement: number;
    relevance: number;
    timeManagement: number;
    onlineQuality: number;
  };
  takeaway: string;
  suggestion: string;
}

interface FeedbackProps {
  eventId?: string;
}

const Feedback: React.FC<FeedbackProps> = ({ eventId }) => {
  // --- Section 1: Event Feedback State ---
  const [eventToggles, setEventToggles] = useState({
    food: false,
    refreshment: false,
    presentation: false,
    evaluation: false,
    enjoyment: false,
  });

  const [eventRatings, setEventRatings] = useState({
    overall: 0,
    planning: 0,
    timeManagement: 0,
    catering: 0,
    facilities: 0,
    presentation: 0,
    evaluation: 0,
    enjoyment: 0,
  });

  const [awarenessChannel, setAwarenessChannel] = useState<string>(EVENT_COPY.socialMedia);
  const [eventSuggestion, setEventSuggestion] = useState("");

  // --- Section 2: Resource Person Feedback State ---
  const [resourcePersons, setResourcePersons] = useState<ResourcePersonState[]>([
    {
      id: 1,
      name: "",
      organization: "",
      date: "",
      time: "",
      topic: "",
      feedbackEnabled: false,
      isOnline: false,
      ratings: {
        expertise: 0,
        engagement: 0,
        relevance: 0,
        timeManagement: 0,
        onlineQuality: 0,
      },
      takeaway: "",
      suggestion: "",
    },
  ]);

  // --- Section 3: Accommodation Feedback State ---
  const [accommodationRatings, setAccommodationRatings] = useState({
    cleanliness: 0,
    amenities: 0,
    food: 0,
  });
  const [accommodationSuggestion, setAccommodationSuggestion] = useState("");

  // --- API State ---
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // --- Helpers for Event state ---
  const toggleEventParam = (param: keyof typeof eventToggles) => {
    setEventToggles((prev) => ({ ...prev, [param]: !prev[param] }));
  };

  const handleEventRating = (key: keyof typeof eventRatings, rating: number) => {
    setEventRatings((prev) => ({ ...prev, [key]: rating }));
  };

  // --- Helpers for Resource Person state ---
  const addResourcePerson = () => {
    const nextId = resourcePersons.length > 0 ? Math.max(...resourcePersons.map((rp) => rp.id)) + 1 : 1;
    setResourcePersons((prev) => [
      ...prev,
      {
        id: nextId,
        name: "",
        organization: "",
        date: "",
        time: "",
        topic: "",
        feedbackEnabled: false,
        isOnline: false,
        ratings: {
          expertise: 0,
          engagement: 0,
          relevance: 0,
          timeManagement: 0,
          onlineQuality: 0,
        },
        takeaway: "",
        suggestion: "",
      },
    ]);
  };

  const deleteResourcePerson = (id: number) => {
    setResourcePersons((prev) => prev.filter((rp) => rp.id !== id));
  };

  const updateResourcePerson = (id: number, key: string, value: any) => {
    setResourcePersons((prev) =>
      prev.map((rp) => {
        if (rp.id === id) {
          return { ...rp, [key]: value };
        }
        return rp;
      })
    );
  };

  const updateResourcePersonRating = (id: number, ratingKey: keyof ResourcePersonState["ratings"], rating: number) => {
    setResourcePersons((prev) =>
      prev.map((rp) => {
        if (rp.id === id) {
          return {
            ...rp,
            ratings: { ...rp.ratings, [ratingKey]: rating },
          };
        }
        return rp;
      })
    );
  };

  // --- Helper for Accommodation state ---
  const handleAccommodationRating = (key: keyof typeof accommodationRatings, rating: number) => {
    setAccommodationRatings((prev) => ({ ...prev, [key]: rating }));
  };

  const getCateringQuestionText = (): string => {
    const selectedItems = [
      eventToggles.food ? "food" : "",
      eventToggles.refreshment ? "refreshment" : "",
    ].filter(Boolean);

    if (selectedItems.length === 0) {
      return "";
    }

    if (selectedItems.length === 1) {
      return `How would you rate the quality of the ${selectedItems[0]} provided?`;
    }

    return `How would you rate the quality of the ${selectedItems[0]} and ${selectedItems[1]} provided?`;
  };

  const showCateringRow = eventToggles.food || eventToggles.refreshment;

  // --- Form Submission ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) {
      setError("Event ID is missing");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess(false);

    const payload = {
      eventFeedback: {
        toggles: eventToggles,
        ratings: eventRatings,
        awareness: awarenessChannel,
        suggestion: eventSuggestion,
      },
      resourcePersonsFeedback: resourcePersons,
      accommodationFeedback: {
        ratings: accommodationRatings,
        suggestion: accommodationSuggestion,
      },
    };

    try {
      await authenticityUtility.post(`/events/${eventId}/feedback`, payload);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit feedback.");
    } finally {
      setLoading(false);
    }
  };

  // --- Render Star Rating Group ---
  const renderStars = (currentRating: number, onSelect: (rating: number) => void) => {
    return (
      <div className="feedback-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`feedback-star-btn ${star <= currentRating ? "active" : ""}`}
            onClick={() => onSelect(star)}
          >
            <Star size={18} fill={star <= currentRating ? "#ffb800" : "none"} strokeWidth={2} />
          </button>
        ))}
      </div>
    );
  };

  return (
    <form className="feedback-container" onSubmit={handleSubmit}>
      {/* ==================== CARD 1: EVENT FEEDBACK ==================== */}
      <div className="feedback-card">
        <div className="feedback-card-header">
          <h2 className="feedback-card-title">{EVENT_COPY.eventFeedbackTitle}</h2>
        </div>

        {/* Toggles Sub-Header */}
        <div className="feedback-toggles-bar">
          {EVENT_FEEDBACK_TOGGLES.map((param) => (
            <div className="feedback-toggle-group" key={param}>
              <span className="feedback-toggle-label">
                {param.charAt(0).toUpperCase() + param.slice(1)}
              </span>
              <div className="feedback-toggle-pill">
                <button
                  type="button"
                  className={`feedback-toggle-btn ${eventToggles[param] ? "active" : "inactive"}`}
                  onClick={() => toggleEventParam(param)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={`feedback-toggle-btn ${!eventToggles[param] ? "active" : "inactive"}`}
                  onClick={() => toggleEventParam(param)}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Event Questions List */}
        <div className="feedback-questions-list">
          {/* Overall */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Award size={14} />
                Overall
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the overall quality of the event?
            </div>
            <div className="feedback-action-container">
              {renderStars(eventRatings.overall, (rating) => handleEventRating("overall", rating))}
            </div>
          </div>

          {/* Planning */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <ClipboardList size={14} />
                Planning
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the planning, coordination and execution of the event?
            </div>
            <div className="feedback-action-container">
              {renderStars(eventRatings.planning, (rating) => handleEventRating("planning", rating))}
            </div>
          </div>

          {/* Time Management */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Clock size={14} />
                Time Management
              </span>
            </div>
            <div className="feedback-question-text">
              How effectively was the event managed within the scheduled time?
            </div>
            <div className="feedback-action-container">
              {renderStars(eventRatings.timeManagement, (rating) => handleEventRating("timeManagement", rating))}
            </div>
          </div>

          {/* Catering */}
          {showCateringRow && (
            <div className="feedback-question-row">
              <div className="feedback-badge-container">
                <span className="feedback-badge">
                  <Utensils size={14} />
                  Catering
                </span>
              </div>
              <div className="feedback-question-text">{getCateringQuestionText()}</div>
              <div className="feedback-action-container">
                {renderStars(eventRatings.catering, (rating) => handleEventRating("catering", rating))}
              </div>
            </div>
          )}

          {/* Facilities */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Building size={14} />
                Facilities
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the venue, facilities, and overall event arrangements?
            </div>
            <div className="feedback-action-container">
              {renderStars(eventRatings.facilities, (rating) => handleEventRating("facilities", rating))}
            </div>
          </div>

          {/* Presentation */}
          {eventToggles.presentation && (
            <div className="feedback-question-row">
              <div className="feedback-badge-container">
                <span className="feedback-badge">
                  <Presentation size={14} />
                  Presentation
                </span>
              </div>
              <div className="feedback-question-text">
                How satisfied were you with the opportunity provided to present your work?
              </div>
              <div className="feedback-action-container">
                {renderStars(eventRatings.presentation, (rating) => handleEventRating("presentation", rating))}
              </div>
            </div>
          )}

          {/* Evaluation */}
          {eventToggles.evaluation && (
            <div className="feedback-question-row">
              <div className="feedback-badge-container">
                <span className="feedback-badge">
                  <Scale size={14} />
                  Evaluation
                </span>
              </div>
              <div className="feedback-question-text">
                How would you rate the fairness and transparency of the evaluation/judging process?
              </div>
              <div className="feedback-action-container">
                {renderStars(eventRatings.evaluation, (rating) => handleEventRating("evaluation", rating))}
              </div>
            </div>
          )}

          {/* Enjoyment */}
          {eventToggles.enjoyment && (
            <div className="feedback-question-row">
              <div className="feedback-badge-container">
                <span className="feedback-badge">
                  <Smile size={14} />
                  Enjoyment
                </span>
              </div>
              <div className="feedback-question-text">
                How engaging and enjoyable was the event?
              </div>
              <div className="feedback-action-container">
                {renderStars(eventRatings.enjoyment, (rating) => handleEventRating("enjoyment", rating))}
              </div>
            </div>
          )}

          {/* Awareness */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Megaphone size={14} />
                Awareness
              </span>
            </div>
            <div className="feedback-question-text">
              How did you come to know about this event?
            </div>
            <div className="feedback-action-container">
              <div className="feedback-awareness-list">
                {EVENT_FEEDBACK_AWARENESS_CHANNELS.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    className={`feedback-awareness-pill ${awarenessChannel === channel ? "active" : ""}`}
                    onClick={() => setAwarenessChannel(channel)}
                  >
                  {channel}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Suggestions */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Lightbulb size={14} />
                Suggestion
              </span>
            </div>
            <div className="feedback-question-text">
              Your Suggestions or Comments or Recommendations
            </div>
            <div className="feedback-action-container">
              <input
                type="text"
                className="feedback-text-input"
                value={eventSuggestion}
                onChange={(e) => setEventSuggestion(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ==================== CARD 2: RESOURCE PERSONS LIST ==================== */}
      {resourcePersons.map((rp) => (
        <div className="feedback-card" key={rp.id}>
          {/* Card Header */}
            <div className="feedback-resource-topbar">
              <div className="feedback-resource-topbar-left">
                <span className="feedback-resource-label">{EVENT_COPY.resourcePersonLabel}</span>
                <select
                className="feedback-resource-select"
                value={rp.name}
                onChange={(e) => updateResourcePerson(rp.id, "name", e.target.value)}
              >
                <option value="">Name, Organization</option>
                {EVENT_RESOURCE_PERSON_OPTIONS.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </div>

            <div className="feedback-resource-topbar-meta">
              <div className="feedback-resource-meta-item feedback-resource-date-field">
                <span>Date</span>
                <input
                  type="date"
                  className="feedback-resource-meta-input"
                  value={rp.date}
                  onChange={(e) => updateResourcePerson(rp.id, "date", e.target.value)}
                />
              </div>
              <div className="feedback-resource-meta-item feedback-resource-time-field">
                <span>Time</span>
                <input
                  type="time"
                  className="feedback-resource-meta-input"
                  value={rp.time}
                  onChange={(e) => updateResourcePerson(rp.id, "time", e.target.value)}
                />
              </div>
              <div className="feedback-resource-meta-item feedback-resource-toggle-item">
                <span className="feedback-resource-toggle-label">Feedback</span>
                <label className="feedback-resource-switch feedback-resource-switch--wide" aria-label="Toggle feedback section">
                  <input
                    type="checkbox"
                    checked={rp.feedbackEnabled}
                    onChange={() => updateResourcePerson(rp.id, "feedbackEnabled", !rp.feedbackEnabled)}
                  />
                  <span className="feedback-resource-switch-slider" />
                </label>
              </div>
              <div className="feedback-resource-action-group">
                <button
                  type="button"
                  className="feedback-resource-icon-btn feedback-resource-icon-btn-add"
                  onClick={addResourcePerson}
                  aria-label="Add resource person"
                  title="Add resource person"
                >
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  className="feedback-resource-icon-btn feedback-resource-icon-btn-delete"
                  onClick={() => deleteResourcePerson(rp.id)}
                  aria-label="Remove resource person"
                  title="Remove resource person"
                  disabled={resourcePersons.length <= 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>

          {rp.feedbackEnabled && (
            <div className="feedback-resource-topicbar">
              <div className="feedback-resource-topic-left">
                <span className="feedback-resource-label">Topic:</span>
                <input
                  type="text"
                  className="feedback-resource-topic-input"
                  value={rp.topic}
                  onChange={(e) => updateResourcePerson(rp.id, "topic", e.target.value)}
                />
              </div>
              <div className="feedback-resource-mode-pill" role="group" aria-label="Toggle online/offline mode">
                <button
                  type="button"
                  className={`feedback-resource-mode-pill-btn ${rp.isOnline ? "inactive" : "active"}`}
                  onClick={() => updateResourcePerson(rp.id, "isOnline", false)}
                >
                  Offline
                </button>
                <button
                  type="button"
                  className={`feedback-resource-mode-pill-btn ${rp.isOnline ? "active" : "inactive"}`}
                  onClick={() => updateResourcePerson(rp.id, "isOnline", true)}
                >
                  Online
                </button>
              </div>
            </div>
          )}

          {rp.feedbackEnabled && (
            <div className="feedback-resource-questions-shell">
              {/* Resource Person Questions */}
              <div className="feedback-questions-list">
                {/* Expertise */}
                <div className="feedback-question-row">
                  <div className="feedback-badge-container">
                    <span className="feedback-badge">
                      <GraduationCap size={14} />
                      Expertise
                    </span>
                  </div>
                  <div className="feedback-question-text">
                    How would you rate the speaker's subject knowledge and expertise?
                  </div>
                  <div className="feedback-action-container">
                    {renderStars(rp.ratings.expertise, (rating) =>
                      updateResourcePersonRating(rp.id, "expertise", rating)
                    )}
                  </div>
                </div>

                {/* Engagement */}
                <div className="feedback-question-row">
                  <div className="feedback-badge-container">
                    <span className="feedback-badge">
                      <Users size={14} />
                      Engagement
                    </span>
                  </div>
                  <div className="feedback-question-text">
                    How effectively did the speaker engage the audience throughout the session?
                  </div>
                  <div className="feedback-action-container">
                    {renderStars(rp.ratings.engagement, (rating) =>
                      updateResourcePersonRating(rp.id, "engagement", rating)
                    )}
                  </div>
                </div>

                {/* Relevance */}
                <div className="feedback-question-row">
                  <div className="feedback-badge-container">
                    <span className="feedback-badge">
                      <BookOpen size={14} />
                      Relevance
                    </span>
                  </div>
                  <div className="feedback-question-text">
                    How relevant and useful was the content of the lecture to your learning or professional needs?
                  </div>
                  <div className="feedback-action-container">
                    {renderStars(rp.ratings.relevance, (rating) =>
                      updateResourcePersonRating(rp.id, "relevance", rating)
                    )}
                  </div>
                </div>

                {/* Time Management */}
                <div className="feedback-question-row">
                  <div className="feedback-badge-container">
                    <span className="feedback-badge">
                      <Clock size={14} />
                      Time Management
                    </span>
                  </div>
                  <div className="feedback-question-text">
                    How well did the speaker manage the allotted time while covering the topics?
                  </div>
                  <div className="feedback-action-container">
                    {renderStars(rp.ratings.timeManagement, (rating) =>
                      updateResourcePersonRating(rp.id, "timeManagement", rating)
                    )}
                  </div>
                </div>

                {/* Online */}
                {rp.isOnline && (
                  <div className="feedback-question-row">
                    <div className="feedback-badge-container">
                      <span className="feedback-badge">
                        <Video size={14} />
                        Online Quality
                      </span>
                    </div>
                    <div className="feedback-question-text">
                      How would you rate the audio and video quality of the online session?
                    </div>
                    <div className="feedback-action-container">
                      {renderStars(rp.ratings.onlineQuality, (rating) =>
                        updateResourcePersonRating(rp.id, "onlineQuality", rating)
                      )}
                    </div>
                  </div>
                )}

                {/* Takeaway */}
                <div className="feedback-question-row">
                  <div className="feedback-badge-container">
                    <span className="feedback-badge">
                      <ShoppingBag size={14} />
                      Takeaway
                    </span>
                  </div>
                  <div className="feedback-question-text">
                    Your key takeaway from this lecture session
                  </div>
                  <div className="feedback-action-container">
                    <input
                      type="text"
                      className="feedback-text-input"
                      value={rp.takeaway}
                      onChange={(e) => updateResourcePerson(rp.id, "takeaway", e.target.value)}
                    />
                  </div>
                </div>

                {/* Suggestions */}
                <div className="feedback-question-row">
                  <div className="feedback-badge-container">
                    <span className="feedback-badge">
                      <Lightbulb size={14} />
                      Suggestion
                    </span>
                  </div>
                  <div className="feedback-question-text">
                    Your Suggestions or Comments or Recommendations
                  </div>
                  <div className="feedback-action-container">
                    <input
                      type="text"
                      className="feedback-text-input"
                      value={rp.suggestion}
                      onChange={(e) => updateResourcePerson(rp.id, "suggestion", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Button to add more resource persons */}
      {/* ==================== CARD 3: ACCOMMODATION FEEDBACK ==================== */}
      <div className="feedback-card">
        <div className="feedback-card-header">
          <h2 className="feedback-card-title">{EVENT_COPY.accommodationTitle}</h2>
        </div>

        {/* Accommodation Questions */}
        <div className="feedback-questions-list">
          {/* Cleanliness */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Sparkles size={14} />
                Cleanliness
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the cleanliness and maintenance of the room?
            </div>
            <div className="feedback-action-container">
              {renderStars(accommodationRatings.cleanliness, (rating) =>
                handleAccommodationRating("cleanliness", rating)
              )}
            </div>
          </div>

          {/* Amenities */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Bed size={14} />
                Amenities
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the comfort and amenities provided in the hostel?
            </div>
            <div className="feedback-action-container">
              {renderStars(accommodationRatings.amenities, (rating) =>
                handleAccommodationRating("amenities", rating)
              )}
            </div>
          </div>

          {/* Food */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Utensils size={14} />
                Food
              </span>
            </div>
            <div className="feedback-question-text">
              How would you rate the quality of the food and refreshments provided?
            </div>
            <div className="feedback-action-container">
              {renderStars(accommodationRatings.food, (rating) => handleAccommodationRating("food", rating))}
            </div>
          </div>

          {/* Suggestions */}
          <div className="feedback-question-row">
            <div className="feedback-badge-container">
              <span className="feedback-badge">
                <Lightbulb size={14} />
                Suggestion
              </span>
            </div>
            <div className="feedback-question-text">
              Your Suggestions or Comments or Recommendations
            </div>
            <div className="feedback-action-container">
              <input
                type="text"
                className="feedback-text-input"
                value={accommodationSuggestion}
                onChange={(e) => setAccommodationSuggestion(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="feedback-error-msg" style={{ color: "red", textAlign: "center", marginBottom: "16px" }}>{error}</div>}
      {success && <div className="feedback-success-msg" style={{ color: "green", textAlign: "center", marginBottom: "16px" }}>Feedback submitted successfully!</div>}
      
      {/* Submit Button */}
      <button type="submit" className="feedback-submit-btn" disabled={loading}>
        {loading ? "Submitting..." : EVENT_COPY.submitFeedback}
      </button>
    </form>
  );
};

export default Feedback;
