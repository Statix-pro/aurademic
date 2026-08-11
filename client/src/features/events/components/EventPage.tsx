import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import "../styles/EventPage.css";
import PreEvent from "./PreEvent";
import FinanceSection from "./FinanceSection";
import EventUpdates from "./EventUpdates";
import ParticipantDetails from "./ParticipantDetails";
import Feedback from "./Feedback";
import { EVENT_PAGE_TABS } from "../constants";

const SUB_EVENT_TAB_IDS = ["pre-event", "participants", "feedback"] as const;

interface EventSummary {
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  feedbackEnabled?: boolean;
  teamEnabled?: boolean;
  documentEnabled?: boolean;
  accommodationEnabled?: boolean;
  registrationFeeEnabled?: boolean;
  certificateEnabled?: boolean;
}

interface TabConfig {
  id: string;
  label: string;
  component: React.ComponentType<{
    goToTab: (tab: string) => void;
    eventId?: string;
    isSubEvent?: boolean;
    summary?: EventSummary | null;
  }>;
}

const EventPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("pre-event");
  const [summary, setSummary] = useState<EventSummary | null>(null);

  const isSubEvent = new URLSearchParams(location.search).get("isSubEvent") === "true";
  const requestedTab = new URLSearchParams(location.search).get("tab");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTabParam = params.get("tab");
    
    let allowedTabs = new Set([
      "pre-event",
      "finance",
      "updates",
      "participants",
      "feedback",
    ]);

    if (isSubEvent) {
      allowedTabs = new Set(SUB_EVENT_TAB_IDS);
    }

    if (requestedTabParam && allowedTabs.has(requestedTabParam)) {
      setActiveTab(requestedTabParam);
      return;
    }

    setActiveTab("pre-event");
  }, [location.search, isSubEvent]);

  useEffect(() => {
    if (!eventId || eventId === "new") return;
    authenticityUtility
      .get(`/events/${eventId}/summary`)
      .then((res) => setSummary(res as unknown as EventSummary))
      .catch((err: unknown) => console.error("Failed to load summary:", err));
  }, [eventId]);

  const tabs: TabConfig[] = EVENT_PAGE_TABS.map((tab) => ({
    ...tab,
    component:
      tab.id === "pre-event"
        ? PreEvent
        : tab.id === "finance"
          ? FinanceSection
          : tab.id === "updates"
            ? EventUpdates
            : tab.id === "participants"
              ? ParticipantDetails
              : Feedback,
  }));

  const renderContent = () => {
    const active = tabs.find((tab) => tab.id === activeTab);
    if (!active) return null;
    const Component = active.component;
    const content = (
      <Component
        goToTab={setActiveTab}
        eventId={eventId}
        isSubEvent={isSubEvent}
        summary={summary}
      />
    );

    return content;
  };

  return (
    <>

      <div className="event-page">


        <div className="event-form-navigation">
          {tabs
            .filter((tab) => !isSubEvent || SUB_EVENT_TAB_IDS.includes(tab.id as (typeof SUB_EVENT_TAB_IDS)[number]))
            .map((tab) => (
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
