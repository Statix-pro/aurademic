import { Award, ArrowLeft, Download, Eye, Sparkles } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import EventCertificate from './EventCertificate';
import { useAuth } from '../../contexts/AuthContext';
import { useEvents, flattenEvents } from '../../contexts/EventsContext';
import { useProfile } from '../../contexts/ProfileContext';
import './CertificatesPage.css';

export default function CertificatesPage() {
  const navigate = useNavigate();
  const { events, registrations } = useEvents();
  const { user } = useAuth();
  const { personal } = useProfile();

  // The profile name is the one the participant entered for this event; fall
  // back to the Google account name. Previously a demo name was hardcoded here,
  // so every participant saw the same person's certificate.
  const participantName = useMemo(() => {
    const fromProfile = [personal.firstName, personal.lastName].filter(Boolean).join(' ').trim();
    return fromProfile || user?.name || '';
  }, [personal.firstName, personal.lastName, user?.name]);

  // Get events with certificate enabled, confirmed registration, AND a generated/published certificate
  const certifiedEvents = useMemo(() => {
    return flattenEvents(events).filter(
      (e) =>
        e.certificateEnabled &&
        registrations[e.id] &&
        registrations[e.id].certificateRefNo && // Ensures certificate is published
        registrations[e.id].attendance === 'Present' &&
        registrations[e.id].hasFeedback &&
        (registrations[e.id].paymentStatus === 'paid' ||
          (!e.hasRegistrationFee && registrations[e.id].formStatus === 'ready')),
    );
  }, [events, registrations]);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingCert, setViewingCert] = useState<string | null>(null);

  const handleDownload = (eventId: string, eventName: string) => {
    setDownloadingId(eventId);
    setTimeout(() => {
      // Simulate file download by creating a mock file link
      const element = document.createElement('a');
      const file = new Blob(
        [
          `Certificate of Participation\n\nThis is to certify that you have successfully participated in the event: ${eventName}.`,
        ],
        { type: 'text/plain' },
      );
      element.href = URL.createObjectURL(file);
      element.download = `Certificate_${eventName.replace(/\s+/g, '_')}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setDownloadingId(null);
    }, 1500);
  };

  return (
    <div className="certificates-page-1">
      <div className="certificates-page-2">
        <div className="certificates-page-3">
          <button onClick={() => navigate('/home')} className="certificates-page-4">
            <ArrowLeft className="certificates-page-5" />
          </button>
          <div>
            <h2 className="certificates-page-6">My Certificates</h2>
            <p className="certificates-page-7">Download and share your earned event certificates</p>
          </div>
        </div>

        {certifiedEvents.length === 0 ? (
          <div className="certificates-page-8">
            <Award className="certificates-page-9" />
            <h3 className="certificates-page-10">No Certificates Earned Yet</h3>
            <p className="certificates-page-11">
              Certificates become available once you have attended the event, submitted your
              feedback, and completed any required payments.
            </p>
          </div>
        ) : (
          <div className="certificates-page-12">
            {certifiedEvents.map((event) => (
              <div key={event.id} className="group certificates-page-13">
                <div className="certificates-page-14" />

                <div className="certificates-page-15">
                  <div className="certificates-page-16">
                    <Award className="certificates-page-17" />
                  </div>
                  <div className="certificates-page-18">
                    <span className="certificates-page-19">
                      <Sparkles className="certificates-page-20" /> Ready
                    </span>
                    <h3 className="certificates-page-21">{event.eventName}</h3>
                    <p className="certificates-page-22">
                      {event.date} • {event.venue}
                    </p>
                  </div>
                </div>

                <div className="certificates-page-23">
                  <button
                    onClick={() => setViewingCert(viewingCert === event.id ? null : event.id)}
                    className="certificates-page-24"
                  >
                    <Eye className="certificates-page-25" />
                    {viewingCert === event.id ? 'Hide Preview' : 'Preview'}
                  </button>

                  <button
                    disabled={downloadingId !== null}
                    onClick={() => handleDownload(event.id, event.eventName)}
                    className="certificates-page-26"
                  >
                    <Download
                      className={`h-3.5 w-3.5 ${downloadingId === event.id ? 'animate-bounce' : ''}`}
                    />
                    {downloadingId === event.id ? 'Downloading...' : 'Download'}
                  </button>
                </div>

                {viewingCert === event.id && (
                  <div className="certificates-page-27">
                    <EventCertificate
                      eventId={event.id}
                      certificateNo={
                        registrations[event.id]?.certificateRefNo ||
                        `CERT-${event.id}-${participantName.replace(/\s+/g, '').substring(0, 5)}-TEMP`
                      }
                      participantName={participantName}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
