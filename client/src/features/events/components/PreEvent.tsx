import React, { useState, useEffect } from 'react';

import EventApprovalCards, { EventApprovalFormData } from './EventApprovalCards';
import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { EVENT_COPY } from '../constants';

interface PreEventProps {
  goToTab: (tab: string) => void;
  eventId?: string;
  isSubEvent?: boolean;
}

const PreEvent: React.FC<PreEventProps> = ({ goToTab, eventId, isSubEvent }) => {
  const [selectedSubEventId, setSelectedSubEventId] = useState('');
  const [mainEvents, setMainEvents] = useState<{ id: string; title: string }[]>([]);
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: string;
    type: AlertType;
  }>({
    show: false,
    message: '',
    type: 'info',
  });

  useEffect(() => {
    if (!isSubEvent) {
      setMainEvents([]);
      return;
    }

    authenticityUtility
      .get('/pre-events')
      .then((res: any) => {
        const events = Array.isArray(res) ? res : res.data || [];
        setMainEvents(events.filter((e: any) => !e.parent_id && Boolean(e.is_multi_event)));
      })
      .catch((err) => console.error('Error fetching main events:', err));
  }, [isSubEvent, eventId]);

  const showValidationAlert = (message: string) => {
    setAlertConfig({ show: true, message, type: 'warning' });
  };

  const handleSubmit = async (data: EventApprovalFormData) => {
    const missingFields: string[] = [];
    if (!data.name) missingFields.push('Event Name');
    if (!data.dateFrom) missingFields.push('Start Date');
    if (!data.dateTo) missingFields.push('End Date');
    if (!data.category) missingFields.push('Category');
    if (!data.eventType || data.eventType.length === 0) missingFields.push('Type');
    if (!data.level) missingFields.push('Level');
    if ((data.mode === 'Virtual' || data.mode === 'Hybrid') && !data.meetingLink) {
      missingFields.push('Meeting Link');
    }
    if ((data.mode === 'Physical' || data.mode === 'Hybrid') && !data.venue) {
      missingFields.push('Venue');
    }
    if (
      data.ceremonyEnabled &&
      data.inauguralEnabled &&
      (!data.inauguralDate || !data.inauguralTime || !data.inauguralVenue)
    ) {
      missingFields.push('Inaugural Ceremony Details');
    }
    if (
      data.ceremonyEnabled &&
      data.valedictoryEnabled &&
      (!data.valedictoryDate || !data.valedictoryTime || !data.valedictoryVenue)
    ) {
      missingFields.push('Valedictory Ceremony Details');
    }

    if (missingFields.length > 0) {
      showValidationAlert(
        `Please fill the following required fields: ${missingFields.join(', ')}.`,
      );
      return;
    }

    const eventSubmitData = {
      title: data.name,
      description: '',
      category: data.category,
      event_type: data.eventType,
      level: data.level,
      start_date: data.dateFrom,
      end_date: data.dateTo,
      mode: data.mode || 'Physical',
      meeting_link: data.mode === 'Virtual' || data.mode === 'Hybrid' ? data.meetingLink : null,
      venue: data.mode === 'Physical' || data.mode === 'Hybrid' ? data.venue : null,
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
      coordinators: data.coordinators.filter(
        (row) => row.name || row.email || row.department || row.institution,
      ),
      budget: [],
      parent_id: isSubEvent ? selectedSubEventId : null,
      is_multi_event: data.isMultiEventEnabled || false,

      // --- ADDED MISSING DATA ---
      registrationSettings: {
        enabled: data.registrationSettingsEnabled,
        eligibleParticipants: data.eligibleParticipants,
        openTo: data.openTo,
        genderRestriction: data.genderRestriction,
        minAge: data.minAge,
        maxAge: data.maxAge,
        registrationStatus: data.registrationStatus,
        lastDate: data.lastDate,
        extension: data.extension,
        extendedDate: data.extendedDate,
        shortlistingRequired: data.shortlistingRequired,
        selectionIntimation: data.selectionIntimation,
        teamEnabled: data.teamEnabled,
        minTeamSize: data.minTeamSize,
        maxTeamSize: data.maxTeamSize,
      },
      documentSettings: {
        enabled: data.documentEnabled,
        documentName: data.documentName,
        documentType: data.documentType,
        documentSize: data.documentSize,
        textFieldEnabled: data.documentTextFieldEnabled,
      },
      feedbackEnabled: data.feedbackEnabled,
      certificateEnabled: data.certificateEnabled,
      feeRows: data.registrationFeeEnabled ? data.feeRows : [],
      sponsoringAgencies: data.sponsoringAgencyEnabled ? data.sponsoringAgencies : [],
      accommodation: {
        enabled: data.accommodationEnabled,
        type: data.accommodationType,
        gentsLimit: data.gentsAccommodationLimit,
        ladiesLimit: data.ladiesAccommodationLimit,
      },
      // --------------------------
    };

    try {
      if (eventId && eventId !== 'new') {
        await authenticityUtility.put(`/events/${eventId}`, eventSubmitData);
      } else {
        await authenticityUtility.post('/pre-events', eventSubmitData);
      }
      setAlertConfig({
        show: true,
        message:
          eventId && eventId !== 'new'
            ? 'Event updated successfully!'
            : 'Event created successfully!',
        type: 'success',
      });
      goToTab('finance');
    } catch (error: any) {
      const backendError =
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.response?.data?.message ||
        error.message;
      setAlertConfig({
        show: true,
        message: `Failed to submit the form. Backend Error: ${backendError}`,
        type: 'error',
      });
    }
  };

  if (isSubEvent) {
    const selectedEvent = mainEvents.find((e) => String(e.id) === selectedSubEventId);

    return (
      <div className="event-approval-page journal-form-body">
        <div className="journal-form-container event-approval-container">
          <div className="event-approval-card form-card">
            <div style={{ marginTop: '16px' }}>
              <div className="event-approval-section-heading">
                {EVENT_COPY.selectMainEventError}
              </div>
              {mainEvents.length === 0 ? (
                <p style={{ marginTop: '8px', color: '#64748b' }}>
                  {EVENT_COPY.noMainEventsAvailable}
                </p>
              ) : (
                <select
                  className={
                    selectedSubEventId
                      ? 'event-approval-select has-value'
                      : 'event-approval-select is-placeholder'
                  }
                  value={selectedSubEventId}
                  onChange={(e) => setSelectedSubEventId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '16px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                  }}
                >
                  <option value="">{EVENT_COPY.noMainEventOption}</option>
                  {mainEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {selectedSubEventId && (
            <div style={{ marginTop: '24px' }}>
              <EventApprovalCards
                title={selectedEvent?.title || ''}
                submitLabel={EVENT_COPY.submitNext}
                showHeaderActions={false}
                showExtendedSections={false}
                showMultiEventToggle={false}
                isSubEvent={true}
                onSubmit={handleSubmit}
              />
            </div>
          )}
        </div>
        <AlertModal
          show={alertConfig.show}
          onHide={() => setAlertConfig((current) => ({ ...current, show: false }))}
          message={alertConfig.message}
          type={alertConfig.type}
        />
      </div>
    );
  }

  return (
    <>
      <EventApprovalCards
        title=""
        submitLabel={EVENT_COPY.submitNext}
        showHeaderActions={false}
        showExtendedSections={!isSubEvent}
        showMultiEventToggle={!isSubEvent}
        isSubEvent={isSubEvent}
        onSubmit={handleSubmit}
      />
      <AlertModal
        show={alertConfig.show}
        onHide={() => setAlertConfig((current) => ({ ...current, show: false }))}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </>
  );
};

export default PreEvent;
