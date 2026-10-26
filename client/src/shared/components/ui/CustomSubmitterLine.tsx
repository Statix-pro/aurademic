import React from 'react';

import './common.css';

interface CustomSubmitterLineProps {
  name?: string | null;
  email?: string | null;
  /** ISO date (YYYY-MM-DD or a timestamp) the record was submitted. */
  date?: string | null;
  label?: string;
  /** Approval pages show it plainly; elsewhere it is a small aside. */
  prominent?: boolean;
  /** The viewer's own record reads "by you". */
  isYou?: boolean;
}

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "Submitted by Name · email · 12 Oct 2026" -- who added a record, so a reader can ask them. */
const CustomSubmitterLine: React.FC<CustomSubmitterLineProps> = ({
  name,
  email,
  date,
  label = 'Added by',
  prominent = false,
  isYou = false,
}) => {
  if (!isYou && !name && !email) return null;
  const when = formatDate(date);
  return (
    <p className={`custom-submitter${prominent ? ' custom-submitter--prominent' : ''}`}>
      {label} <strong>{isYou ? 'you' : name || email}</strong>
      {!isYou && email && (
        <>
          {' · '}
          {email}
        </>
      )}
      {when && ` · ${when}`}
    </p>
  );
};

export default CustomSubmitterLine;
