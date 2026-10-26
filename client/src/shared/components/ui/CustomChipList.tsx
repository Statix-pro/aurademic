import React from 'react';

import './common.css';

interface CustomChipListProps {
  items: string[];
  /** Chips shown before the rest collapse into "+N"; the full list is in the tooltip. */
  max?: number;
  empty?: React.ReactNode;
}

/** A short run of read-only chips for a table cell, so a long list never grows the row. */
const CustomChipList: React.FC<CustomChipListProps> = ({ items, max = 2, empty = '—' }) => {
  if (!items.length) return <>{empty}</>;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <span className="custom-chip-list" title={items.join(', ')}>
      {shown.map((item) => (
        <span key={item} className="custom-chip">
          {item}
        </span>
      ))}
      {rest > 0 && <span className="custom-chip custom-chip--more">+{rest}</span>}
    </span>
  );
};

export default CustomChipList;
