import { Search, X } from 'lucide-react';
import React from 'react';

import CustomInput from './CustomInput';
import './common.css';

interface CustomFilterSearchProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A list page's filter box: search icon on the left, a clear button on the right once
 * something is typed. One component so every list header's search looks the same.
 */
const CustomFilterSearch: React.FC<CustomFilterSearchProps> = ({
  name,
  value,
  onChange,
  placeholder = 'Search',
  className = '',
}) => (
  <div className={`custom-filter-search ${className}`}>
    <Search size={16} className="custom-filter-search-icon" aria-hidden="true" />
    <CustomInput
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={placeholder}
      className="mb-0"
    />
    {value && (
      <button
        type="button"
        className="custom-filter-search-clear"
        aria-label="Clear search"
        title="Clear search"
        onClick={() => onChange('')}
      >
        <X size={16} aria-hidden="true" />
      </button>
    )}
  </div>
);

export default CustomFilterSearch;
