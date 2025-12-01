import React from "react";
import {
  FaTimes,
  FaRegClock,
  FaBuilding,
  FaLayerGroup,
  FaMapMarkerAlt,
} from "react-icons/fa";
import "../styles/EventDetailsPopup.css";

const EventDetailsPopup = ({ event, onClose }) => {
  if (!event) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="popup-close-btn" onClick={onClose}>
          <FaTimes />
        </button>
        <h2 className="popup-title">{event.name}</h2>

        <div className="popup-details">
          <div className="popup-detail">
            <FaLayerGroup className="icon" />
            <span>
              <strong>Category:</strong> {event.category}
            </span>
          </div>
          <div className="popup-detail">
            <FaBuilding className="icon" />
            <span>
              <strong>Department:</strong> {event.department}
            </span>
          </div>
          <div className="popup-detail">
            <FaRegClock className="icon" />
            <span>
              <strong>Time:</strong> {event.time}
            </span>
          </div>
          <div className="popup-detail">
            <FaMapMarkerAlt className="icon" />
            <span>
              <strong>Venue:</strong> {event.venue}
            </span>
          </div>
          <div className="popup-detail">
            <FaMapMarkerAlt className="icon" />
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
