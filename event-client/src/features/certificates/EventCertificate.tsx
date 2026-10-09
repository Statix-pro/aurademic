import React, { useState, useEffect } from 'react';

import { apiFetch } from '../../config/api';
import './EventCertificate.css';

interface EventCertificateProps {
  eventId: string;
  certificateNo: string;
  participantName: string;
}

const EventCertificate: React.FC<EventCertificateProps> = ({
  eventId,
  certificateNo,
  participantName,
}) => {
  const [eventData, setEventData] = useState<any>(null);
  const [issuedDate, setIssuedDate] = useState<string>('');

  useEffect(() => {
    const today = new Date();
    const formattedToday = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    setIssuedDate(formattedToday);

    if (!eventId) return;

    apiFetch(`/events/${eventId}`)
      .then((res: any) => {
        // Handle unwrapped response or data property
        const ev = res.data ? res.data : res;
        if (ev) setEventData(ev);
      })
      .catch((err) => {
        console.warn('Could not load full event details', err);
      });
  }, [eventId]);

  const eventTitle = eventData?.title || 'Event';
  const levelName = eventData?.level || 'National';
  const eventTypeName = eventData?.event_type || 'Workshop';
  const departmentName =
    eventData?.department || eventData?.department_name || 'DEPARTMENT OF MECHATRONICS ENGINEERING';

  let numberOfDaysText = 'two-Days';
  if (eventData?.numberOfDays) {
    const num = parseInt(eventData.numberOfDays);
    if (!isNaN(num)) {
      numberOfDaysText =
        num === 1 ? 'one-Day' : num === 2 ? 'two-Days' : num === 3 ? 'three-Days' : `${num}-Days`;
    }
  } else if (eventData?.start_date && eventData?.end_date) {
    const start = new Date(eventData.start_date);
    const end = new Date(eventData.end_date);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
      numberOfDaysText =
        diff === 1
          ? 'one-Day'
          : diff === 2
            ? 'two-Days'
            : diff === 3
              ? 'three-Days'
              : `${diff}-Days`;
    }
  }

  let datesString = '';
  if (eventData?.start_date) {
    const sDate = new Date(eventData.start_date);
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    if (eventData?.end_date) {
      const eDate = new Date(eventData.end_date);
      if (sDate.getMonth() === eDate.getMonth() && sDate.getFullYear() === eDate.getFullYear()) {
        datesString = `${months[sDate.getMonth()]} ${sDate.getDate()}-${eDate.getDate()}, ${sDate.getFullYear()}`;
      } else {
        datesString = `${months[sDate.getMonth()]} ${sDate.getDate()} - ${months[eDate.getMonth()]} ${eDate.getDate()}, ${eDate.getFullYear()}`;
      }
    } else {
      datesString = `${months[sDate.getMonth()]} ${sDate.getDate()}, ${sDate.getFullYear()}`;
    }
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="event-certificate-tab-wrapper">
      {/* Toolbar — matches admin certificate template controls */}
      <div className="cert-toolbar">
        <div className="cert-toolbar-group">
          <label>Participant Name</label>
          <div className="cert-readonly-field">{participantName}</div>
        </div>

        <div className="cert-toolbar-group">
          <label>Certificate No.</label>
          <div className="cert-readonly-field">{certificateNo}</div>
        </div>

        <div className="cert-toolbar-group">
          <label>Date</label>
          <div className="cert-readonly-field">{issuedDate}</div>
        </div>

        <div className="cert-toolbar-group" style={{ minWidth: 'unset', flex: 'unset' }}>
          <label style={{ visibility: 'hidden' }}>Print</label>
          <button className="cert-print-btn" onClick={handlePrint}>
            🖨️ Print Certificate
          </button>
        </div>
      </div>

      {/* Certificate Canvas */}
      <div className="cert-print-area">
        <div className="ksrct-certificate-card">
          {/* Top Right Corner Fold */}
          <div className="cert-corner-tr-gold"></div>
          <div className="cert-corner-tr-navy"></div>

          {/* Bottom Left Corner Fold */}
          <div className="cert-corner-bl-navy"></div>
          <div className="cert-corner-bl-gold"></div>

          <div className="cert-inner-frame">
            {/* Top Logos Header Row */}
            <div className="cert-logos-row">
              <div className="cert-logo-item">
                <span className="cert-badge-ksrct4">
                  KSRC<span className="gold-num">7</span>
                  <sub>4.0</sub>
                </span>
                <span className="cert-badge-sub">Feature the Future</span>
              </div>
              <div className="cert-logo-item">
                <div className="cert-badge-32">
                  <span className="num-32">32</span>
                  <span className="text-32">
                    Excellence in
                    <br />
                    TECHNICAL
                    <br />
                    EDUCATION
                  </span>
                </div>
              </div>
              <div className="cert-logo-item">
                <div className="cert-badge-aicte">
                  <span className="aicte-ring"></span>
                  <span className="aicte-label">AICTE / IDEALab</span>
                </div>
              </div>
              <div className="cert-logo-item main-crest">
                <div className="college-crest-shield">
                  <div className="crest-top">K.S. RANGASAMY COLLEGE OF TECHNOLOGY</div>
                  <div className="crest-center">
                    <svg viewBox="0 0 100 100" className="crest-svg">
                      <polygon
                        points="50,5 95,30 95,70 50,95 5,70 5,30"
                        fill="#0069ab"
                        stroke="#f59e0b"
                        strokeWidth="3"
                      />
                      <path d="M 50 15 L 85 80 L 15 80 Z" fill="#ffffff" />
                      <circle cx="50" cy="50" r="15" fill="#f59e0b" />
                    </svg>
                  </div>
                  <div className="crest-banner">BE BOLD BE BRAVE</div>
                </div>
              </div>
              <div className="cert-logo-item">
                <div className="cert-badge-naac">
                  <span className="naac-eye"></span>
                  <span className="naac-grade">A++</span>
                  <span className="naac-sub">GRADE</span>
                </div>
              </div>
              <div className="cert-logo-item">
                <div className="cert-badge-nba">
                  <span className="nba-title">NBA</span>
                  <span className="nba-sub">NATIONAL BOARD OF ACCREDITATION</span>
                </div>
              </div>
              <div className="cert-logo-item sdg-box sdg-4">
                <span className="sdg-num">4</span>
                <span className="sdg-txt">QUALITY EDUCATION</span>
              </div>
              <div className="cert-logo-item sdg-box sdg-9">
                <span className="sdg-num">9</span>
                <span className="sdg-txt">INDUSTRY, INNOVATION AND INFRASTRUCTURE</span>
              </div>
            </div>

            {/* College Header */}
            <div className="cert-college-header">
              <h1 className="cert-college-title">K.S.RANGASAMY COLLEGE OF TECHNOLOGY</h1>
              <div className="cert-college-sub">(Autonomous)</div>
              <div className="cert-college-address">
                Tiruchengode - 637 215. Namakkal Dt. Tamil Nadu
              </div>
              <h2 className="cert-dept-title">{departmentName}</h2>
            </div>

            {/* Certificate Title */}
            <div className="cert-title-block">
              <h3 className="cert-calligraphy-title">Certificate of Participation</h3>
              <div className="cert-title-line"></div>
              <div className="cert-presented-txt">presented to</div>
            </div>

            {/* Participant Name */}
            <div className="cert-participant-block">
              <div className="cert-participant-name">{participantName}</div>
              <div className="cert-participant-dashed-line"></div>
            </div>

            {/* Body Text */}
            <div className="cert-description-block">
              <p className="cert-desc-text">
                for participating in the {numberOfDaysText} {levelName} level {eventTypeName} on
              </p>
              <div className="cert-event-title-highlight">"{eventTitle}"</div>
              {datesString && <div className="cert-event-date-range">during {datesString}</div>}
            </div>

            {/* Footer Row */}
            <div className="cert-footer-row">
              <div className="cert-meta-left">
                <div className="cert-meta-item">
                  <span className="meta-lbl">Date:</span> {issuedDate}
                </div>
                <div className="cert-meta-item">
                  <span className="meta-lbl">Certificate No. :</span> {certificateNo}
                </div>
              </div>

              <div className="cert-signatures-right">
                <div className="cert-sig-item">Co-ordinator</div>
                <div className="cert-sig-item">HoD</div>
                <div className="cert-sig-item">Principal</div>
              </div>
            </div>

            {/* Website URL */}
            <div className="cert-url-footer">www.ksrct.ac.in</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCertificate;
