import React, { useState, useMemo, useEffect } from 'react';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import {
  ClipboardList,
  Hourglass,
  ShoppingCart,
  Inbox,
  Info,
  Users,
  Paperclip,
  Award,
  FileText,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Target,
  AlertCircle,
  X,
  Check,
  ArrowDown,
  Star
} from 'lucide-react';
import '../styles/ParticipantDetails.css';
import { EVENT_COPY } from "../constants";

interface ParticipantDetailsProps {
  goToTab?: (tab: string) => void;
  eventId?: string;
  summary?: any; // To receive the EventSummary from EventPage
}

// Helper component for mathematically rendering a tiny 5-point star in SVG
const StarPath: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const currR = i % 2 === 0 ? r : r / 2;
    points.push(`${cx + currR * Math.cos(angle)},${cy + currR * Math.sin(angle)}`);
  }
  return <polygon points={points.join(' ')} fill="#0069ab" stroke="none" />;
};

// Custom SVG component: User with checkmark badge
const UserCheckCustom: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0069ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <circle cx="18" cy="18" r="4.5" fill="#0069ab" stroke="none" />
    <path d="M16.5 18l1 1 2-2" stroke="#ffffff" strokeWidth="1.2" />
  </svg>
);

// Custom SVG component: User with stars and checkmark badge
const UserStarsCustom: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0069ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <circle cx="18" cy="18" r="4.5" fill="#0069ab" stroke="none" />
    <path d="M16.5 18l1 1 2-2" stroke="#ffffff" strokeWidth="1.2" />
    
    <StarPath cx={4} cy={6} r={2} />
    <StarPath cx={8} cy={3.5} r={2} />
    <StarPath cx={12} cy={2.5} r={2} />
    <StarPath cx={16} cy={3.5} r={2} />
    <StarPath cx={20} cy={6} r={2} />
  </svg>
);

// Custom SVG component: Certificate with seal on the bottom-left
const CertificateCustom: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0069ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
    <rect x="3" y="5" width="18" height="13" rx="1.5" />
    <line x1="8" y1="9" x2="17" y2="9" strokeWidth="1.5" />
    <line x1="8" y1="12" x2="14" y2="12" strokeWidth="1.5" />
    <path d="M6 14v5l1.5-1 1.5 1v-5" fill="#0069ab" stroke="none" />
    <circle cx="7.5" cy="14" r="3" fill="#0069ab" stroke="none" />
    <circle cx="7.5" cy="14" r="0.8" fill="#ffffff" stroke="none" />
  </svg>
);

// Custom SVG Icons matching the mockup exactly
const RegisteredIcon: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0069ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="#f0f6ff" />
    <line x1="8" y1="10" x2="14" y2="10" />
    <line x1="8" y1="14" x2="13" y2="14" />
    <line x1="8" y1="18" x2="12" y2="18" />
    {/* Pen outline */}
    <path d="M18.5 7.5l2 2-3.5 3.5-2-2z" fill="#0069ab" stroke="none" />
    <path d="M14.5 11.5l-.5 1.5 1.5-.5z" fill="#0069ab" stroke="none" />
  </svg>
);

const ShortlistedIcon: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0069ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="#f0f6ff" />
    <line x1="8" y1="10" x2="14" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
    <line x1="8" y1="18" x2="11" y2="18" />
    {/* Magnifying Glass badge */}
    <circle cx="18" cy="18" r="3" fill="#ffffff" />
    <path d="M20 20l2 2" />
  </svg>
);

const SelectedIcon: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0069ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="#f0f6ff" />
    <line x1="8" y1="10" x2="13" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
    <line x1="8" y1="18" x2="11" y2="18" />
    {/* Check Circle badge */}
    <circle cx="18" cy="18" r="4.5" fill="#0069ab" stroke="none" />
    <path d="M15.5 18l1.5 1.5 3-3" stroke="#ffffff" strokeWidth="1.2" />
  </svg>
);

const NotSelectedIcon: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0069ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="#f0f6ff" />
    <line x1="8" y1="10" x2="13" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
    <line x1="8" y1="18" x2="11" y2="18" />
    {/* X Circle badge on the top-left */}
    <circle cx="6" cy="6" r="4.5" fill="#0069ab" stroke="none" />
    <path d="M4.5 4.5l3 3M7.5 4.5l-3 3" stroke="#ffffff" strokeWidth="1.2" />
  </svg>
);

const HostelIcon: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0069ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" />
    <rect x="6" y="13" width="12" height="6" rx="1" />
    <path d="M9 13v6" />
    <circle cx="10.5" cy="15.5" r="1.2" fill="#0069ab" stroke="none" />
  </svg>
);

const FeesIcon: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0069ab" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {/* Tilted banknotes */}
    <rect x="6" y="5" width="12" height="7" rx="1" transform="rotate(-15 12 8.5)" />
    <rect x="7" y="6" width="12" height="7" rx="1" fill="#ffffff" />
    {/* Hand */}
    <path d="M2 17c1-2 4-2 6-1h10a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6" />
  </svg>
);

const ParticipantDetails: React.FC<ParticipantDetailsProps> = ({ eventId, summary }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/events/${eventId}/participants`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const data = await res.json();
          setParticipants(data);
        })
        .catch((err) => {
          console.error('Failed to fetch participants:', err);
          setError('Failed to load participants. Please try again later.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [eventId]);

  const handleViewDocument = (type: string, participantName: string) => {
    window.open("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "_blank");
  };

  const toggleHostel = (id: number) => {
    setParticipants(prev =>
      prev.map(p => (p.id === id ? { ...p, hostel: p.hostel === "YES" ? "NO" : "YES" } : p))
    );
  };

  const handleStatusChange = (id: number, status: string) => {
    setParticipants(prev =>
      prev.map(p => (p.id === id ? { ...p, status } : p))
    );
  };

  const toggleAction1 = (id: number) => {
    setParticipants(prev =>
      prev.map(p => (p.id === id ? { ...p, action1: !p.action1 } : p))
    );
  };

  const toggleAction2 = (id: number) => {
    setParticipants(prev =>
      prev.map(p => (p.id === id ? { ...p, action2: !p.action2 } : p))
    );
  };

  const toggleAction3 = (id: number) => {
    setParticipants(prev =>
      prev.map(p => (p.id === id ? { ...p, action3: { ...p.action3, active: !p.action3.active } } : p))
    );
  };

  const stats = useMemo(() => {
    return {
      registered: participants.length,
      shortlisted: participants.filter(p => p.status === "Shortlisted" || p.status === "Selected").length,
      selected: participants.filter(p => p.status === "Selected").length,
      rejected: participants.filter(p => p.status === "Rejected").length,
      hostel: participants.filter(p => p.hostel === "YES").length,
      fees: 500
    };
  }, [participants]);

  return (
    <div className="event-finance-wrapper">
      <div className="event-finance-card">
        {/* Stats Cards Section */}
        <div className="stats-cards-grid">
          <div className="stat-card">
            <div className="stat-icon-container">
              <RegisteredIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Registered</span>
              <span className="stat-value">{String(stats.registered).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <ShortlistedIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Shortlisted</span>
              <span className="stat-value">{String(stats.shortlisted).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <SelectedIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Selected</span>
              <span className="stat-value">{String(stats.selected).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <NotSelectedIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Not Selected</span>
              <span className="stat-value">{String(stats.rejected).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <HostelIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Hostel</span>
              <span className="stat-value">{String(stats.hostel).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-container">
              <FeesIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Fees</span>
              <span className="stat-value">{stats.fees}</span>
            </div>
          </div>
        </div>

        {/* Participant Table Section */}
        <table className="event-finance-table">
          <thead>
            <tr>
              <th className="col-sno">S.No.</th>
              <th className="col-participant">Participant</th>
              <th className="col-category">Category</th>
              {summary?.teamEnabled && <th className="col-group"><Users size={18} /></th>}
              {summary?.documentEnabled && <th className="col-doc">Doc.</th>}
              {summary?.accommodationEnabled && <th className="col-hostel">Hostel</th>}
              {summary?.registrationFeeEnabled && <th className="col-fees">Fees</th>}
              <th className="col-status">Status</th>
              <th className="col-action-1">
                <UserCheckCustom />
              </th>
              <th className="col-action-2">
                <UserStarsCustom />
              </th>
              {summary?.certificateEnabled && (
                <th className="col-action-3">
                  <CertificateCustom />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '20px' }}>{EVENT_COPY.loadingParticipants}</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '20px', color: 'red' }}>{error}</td>
              </tr>
            ) : participants.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '20px' }}>{EVENT_COPY.noParticipantsFound}</td>
              </tr>
            ) : (
              participants.map((p, index) => (
                <tr key={p.id}>
                  <td className="col-sno">{index + 1}</td>
                <td className="col-participant">
                  <div className="participant-info-cell">
                    <div className="info-icon-wrapper">
                      <Info size={16} className="info-icon" />
                    </div>
                    <div className="participant-text">
                      <div className="participant-name">{p.name}</div>
                      <div className="participant-inst">{p.institution}</div>
                    </div>
                  </div>
                </td>
                <td className="col-category">{p.category}</td>
                <td className="col-group">{p.group}</td>
                <td className="col-doc">
                  {p.hasDoc ? (
                    <Paperclip 
                      size={18} 
                      className="blue-icon clickable-icon" 
                      onClick={() => handleViewDocument("Registration Document", p.name)}
                    />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="col-hostel">
                  <span className={`hostel-text ${p.hostel === "YES" ? "yes" : "no"}`}>
                    {p.hostel}
                  </span>
                </td>
                <td className="col-fees">
                  <div className="fees-cell">
                    <span>₹{p.fees}</span>
                    <FileText 
                      size={16} 
                      className="blue-icon clickable-icon" 
                      onClick={() => handleViewDocument("Payment Receipt", p.name)}
                    />
                  </div>
                </td>
                <td className="col-status">
                  <div className="status-cell-wrapper">
                    <div className="status-dropdown">
                      <select 
                        value={p.status} 
                        onChange={(e) => handleStatusChange(p.id, e.target.value)}
                      >
                        <option value="Registered">Pending</option>
                        <option value="Shortlisted">Shortlisted</option>
                        <option value="Selected">Selected</option>
                        <option value="Rejected">Rejected</option>
                        
                      </select>
                      <ChevronDown size={12} className="dropdown-icon" />
                    </div>
                    <CheckCircle2 
                      size={22} 
                      className={`success-icon ${p.action1 ? 'filled' : 'outline'}`} 
                      onClick={() => toggleAction1(p.id)}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                    />
                  </div>
                </td>
                {summary?.teamEnabled && <td className="col-group" style={{ fontSize: '13px' }}>{p.group_id ? p.group_id : '-'}</td>}
                {summary?.documentEnabled && (
                  <td className="col-doc">
                    {p.document_upload ? (
                      <button
                        className="icon-btn"
                        title="View Document"
                        onClick={() => handleViewDocument("Uploaded Document", p.name)}
                      >
                        <Paperclip size={18} />
                      </button>
                    ) : (
                      <span style={{ color: '#ccc' }}>-</span>
                    )}
                  </td>
                )}
                {summary?.accommodationEnabled && (
                  <td className="col-hostel">
                    {p.accommodation_required === 1 ? (
                      <CheckCircle2 size={18} className="status-icon green" />
                    ) : (
                      <span style={{ color: '#ccc' }}>-</span>
                    )}
                  </td>
                )}
                {summary?.registrationFeeEnabled && (
                  <td className="col-fees">
                    {p.fee_status === 'Paid' ? (
                      <CheckCircle2 size={18} className="status-icon green" />
                    ) : p.fee_status === 'Pending' ? (
                      <Hourglass size={18} className="status-icon yellow" />
                    ) : (
                      <span style={{ color: '#ccc' }}>-</span>
                    )}
                  </td>
                )}
                <td className="col-action-1">
                  <div 
                    className={`custom-checkbox-wrapper ${p.action2 ? 'checked' : ''}`}
                    onClick={() => toggleAction2(p.id)}
                  >
                    {p.action2 && <Check size={14} className="checkbox-check" />}
                  </div>
                </td>
                <td className="col-action-2">
                  <button className="icon-btn">
                    <CheckCircle2 size={18} />
                  </button>
                </td>
                {summary?.certificateEnabled && (
                  <td className="col-action-3">
                    <button
                      className="icon-btn certificate-btn"
                      title="Certificate"
                      onClick={() => handleViewDocument("Participation Certificate", p.name)}
                    >
                      <Award size={18} />
                    </button>
                  </td>
                )}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ParticipantDetails;
