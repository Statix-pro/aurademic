import React from 'react';
import './RecordHeaderBanner.css';

interface RecordHeaderBannerProps {
  referenceLabel: string;
  referenceValue?: string | null;
  createdByEmail?: string | null;
}

const RecordHeaderBanner: React.FC<RecordHeaderBannerProps> = ({
  referenceLabel,
  referenceValue,
  createdByEmail,
}) => {
  if (!referenceValue) return null;

  return (
    <div className="record-header-banner">
      <span className="record-header-banner-badge">
        {referenceLabel}: {referenceValue}
      </span>
      {createdByEmail && (
        <span className="record-header-banner-creator">Created by {createdByEmail}</span>
      )}
    </div>
  );
};

export default RecordHeaderBanner;
