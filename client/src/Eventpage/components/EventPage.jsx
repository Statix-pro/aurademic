import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import authenticityUtility from "../../utility/authenticityUtility";
import "./EventPage.css";
import PreEvent from "./PreEvent";
import FinanceSection from "./FinanceSection";
import EventUpdates from "./EventUpdates";
import DocumentsPage from "./Documents";
import Navbar from "../../components/navbar/navbar";

const EventPage = () => {
  const { eventId } = useParams();
  const [activeTab, setActiveTab] = useState("pre-event");
  const [summary, setSummary] = useState(null);

  // Fetch event summary (title, status, timestamps)
  useEffect(() => {
    if (!eventId) return;
    authenticityUtility
      .get(`/events/${eventId}/summary`)
      .then((res) => setSummary(res))
      .catch((err) => console.error("Failed to load summary:", err));
  }, [eventId]);

  const tabs = [
    {
      id: "pre-event",
      label: "Pre Event Approvals",
      component: PreEvent,
    },
    {
      id: "finance",
      label: "Finance",
      component: FinanceSection,
    },
    {
      id: "updates",
      label: "Event Updates",
      component: EventUpdates,
    },
    {
      id: "post-event",
      label: "Post Event Submission",
      component: DocumentsPage,
    },
  ];

  const renderContent = () => {
    const active = tabs.find((tab) => tab.id === activeTab);
    if (!active) return null;
    const Component = active.component;
    return <Component goToTab={setActiveTab} eventId={eventId} />;
  };

  return (
    <>
      <Navbar />
      <div className="event-page">
        <header className="event-summary">
          {summary && (
            <>
              <h1>{summary.title}</h1>
              <p>Status: {summary.status}</p>
              <p>
                Created: {new Date(summary.createdAt).toLocaleString()} |
                Updated: {new Date(summary.updatedAt).toLocaleString()}
              </p>
            </>
          )}
        </header>

        <div className="event-form-navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="event-tab-content">{renderContent()}</div>
      </div>
    </>
  );
};

export default EventPage;
