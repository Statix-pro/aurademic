import React from 'react';

import './common.css';

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface CustomTabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/** A row of chip tabs (32px, the size table's chip) that switches what a page shows. */
function CustomTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: CustomTabsProps<T>) {
  return (
    <div className={`custom-tabs ${className}`} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={`custom-tab${option.value === value ? ' active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default CustomTabs;
