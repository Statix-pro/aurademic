import React from "react";
import EventApprovalCards from "./EventApprovalCards";

interface EventEntryProps {
  goToTab?: (tab: string) => void;
  eventId?: string;
}

const EventEntry: React.FC<EventEntryProps> = () => {
  return <EventApprovalCards title="Event 1" submitLabel="Save Event" />;
};

export default EventEntry;
