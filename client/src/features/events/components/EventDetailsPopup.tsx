import { X, Clock, Building2, Layers, MapPin } from 'lucide-react';
import React from 'react';
import '../styles/EventDetailsPopup.css';

interface EventData {
  name: string;
  category: string;
  department: string;
  time: string;
  venue: string;
  date: string;
}

interface EventDetailsPopupProps {
  event: EventData | null;
  onClose: () => void;
}

const EventDetailsPopup: React.FC<EventDetailsPopupProps> = ({ event, onClose }) => {
  if (!event) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="popup-close-btn" onClick={onClose}>
          <X size={16} />
        </button>
        <h2 className="popup-title">{event.name}</h2>

        <div className="popup-details">
          <div className="popup-detail">
            <Layers size={16} className="icon" />
            <span>
              <strong>Category:</strong> {event.category}
            </span>
          </div>
          <div className="popup-detail">
            <Building2 size={16} className="icon" />
            <span>
              <strong>Department:</strong> {event.department}
            </span>
          </div>
          <div className="popup-detail">
            <Clock size={16} className="icon" />
            <span>
              <strong>Time:</strong> {event.time}
            </span>
          </div>
          <div className="popup-detail">
            <MapPin size={16} className="icon" />
            <span>
              <strong>Venue:</strong> {event.venue}
            </span>
          </div>
          <div className="popup-detail">
            <MapPin size={16} className="icon" />
            <span>
              <strong>Date:</strong> {event.date}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsPopup;
