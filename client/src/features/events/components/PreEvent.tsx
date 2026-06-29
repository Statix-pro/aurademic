import React from "react";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import EventApprovalCards, { EventApprovalFormData } from "./EventApprovalCards";

interface PreEventProps {
  goToTab: (tab: string) => void;
}

const PreEvent: React.FC<PreEventProps> = ({ goToTab }) => {
  const handleSubmit = async (data: EventApprovalFormData) => {
    const eventSubmitData = {
      name: data.name,
      description: "",
      category: data.category,
      event_type: data.eventType,
      level: data.level,
      date_from: data.dateFrom,
      date_to: data.dateTo,
      mode: data.mode || "Physical",
      meeting_link: data.mode === "Virtual" || data.mode === "Hybrid" ? data.meetingLink : null,
      venue: data.mode === "Physical" || data.mode === "Hybrid" ? data.venue : null,
      registration_fee_enabled: data.registrationFeeEnabled,
      registration_fee_amount: data.feeRows[0]?.individual || null,
      registration_link: null,
      bank_account: null,
      topics: [],
      expected_participants: data.expectedParticipants,
      themes: Array.isArray(data.themes) ? data.themes : data.themes ? [data.themes] : [],
      sdgs: Array.isArray(data.sdgs) ? data.sdgs : data.sdgs ? [data.sdgs] : [],
      inaugural_enabled: data.ceremonyEnabled && data.inauguralEnabled,
      inaugural_date: data.inauguralEnabled ? data.inauguralDate : null,
      inaugural_time: data.inauguralEnabled ? data.inauguralTime : null,
      inaugural_venue: data.inauguralEnabled ? data.inauguralVenue : null,
      valedictory_enabled: data.ceremonyEnabled && data.valedictoryEnabled,
      valedictory_date: data.valedictoryEnabled ? data.valedictoryDate : null,
      valedictory_time: data.valedictoryEnabled ? data.valedictoryTime : null,
      valedictory_venue: data.valedictoryEnabled ? data.valedictoryVenue : null,
      collaboration_data: data.collaborators
        .filter((row) => row.type || row.name)
        .map((row) => ({ type: row.type, name: row.name })),
      coordinators: data.coordinators.filter((row) => row.name || row.email || row.department || row.institution),
      budget: [],
    };

    await authenticityUtility.post("/pre-events", eventSubmitData);
    alert("Event created successfully!");
    goToTab("finance");
  };

  return (
    <EventApprovalCards
      title=""
      submitLabel="Submit & Next"
      showHeaderActions={false}
      showExtendedSections
      onSubmit={handleSubmit}
    />
  );
};

export default PreEvent;
