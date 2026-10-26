import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import CustomButton from './CustomButton';
import CustomDropdown from './CustomDropdown';
import './common.css';

export const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface CustomPaginationProps {
  /** 1-based page number. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  /** Name for the rows-per-page control, unique on the page. */
  name?: string;
}

// --control-height like every other dropdown; CustomDropdown's own default is 45px, and its
// styles merge shallowly, so the control restates the corners, colours and focus ring.
const PAGE_SIZE_STYLES = {
  control: (provided: any, state: any) => ({
    ...provided,
    minWidth: 84,
    minHeight: 'var(--control-height)',
    height: 'var(--control-height)',
    backgroundColor: '#ffffff',
    borderColor: state.isFocused ? 'var(--border-focus)' : 'var(--border-color)',
    borderRadius: 'var(--border-radius-md)',
    boxShadow: state.isFocused ? 'var(--shadow-focus)' : 'none',
    '&:hover': { borderColor: 'var(--border-focus)' },
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
    padding: '0 12px',
  }),
  indicatorsContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
  }),
  container: (provided: any) => ({ ...provided, fontSize: 'var(--font-size-body)' }),
  singleValue: (provided: any) => ({ ...provided, color: 'var(--text-body)' }),
  indicatorSeparator: () => ({ display: 'none' }),
};

/** Page numbers to show: the first, the last, and the current one with its neighbours. */
const pageItems = (page: number, pageCount: number): (number | 'gap')[] => {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? ['gap' as const, p] : [p]));
};

/**
 * The portal's table footer: "Rows per page" and "1–10 of N" (as on the finance card and
 * admin dashboard), then compact 32px page buttons -- ‹ 1 2 3 … 8 › -- instead of wide
 * Previous / Next text buttons.
 */
const CustomPagination: React.FC<CustomPaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  name = 'rows-per-page',
}) => {
  if (!total) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const options = pageSizeOptions.map((size) => ({ value: size, label: String(size) }));

  return (
    <nav className="custom-pagination" aria-label="Pages">
      <div className="custom-pagination-group">
        <label className="custom-pagination-text" htmlFor={name}>
          Rows per page
        </label>
        <CustomDropdown
          name={name}
          className="mb-0"
          options={options}
          value={options.find((option) => option.value === pageSize)}
          onChange={(option) => {
            if (option && !Array.isArray(option) && 'value' in option) {
              onPageSizeChange(Number(option.value));
            }
          }}
          styles={PAGE_SIZE_STYLES}
        />
        <span className="custom-pagination-text">
          {first}–{last} of {total}
        </span>
      </div>
      {pageCount > 1 && (
        <div className="custom-pagination-group custom-pagination-pages">
          <CustomButton
            variant="light"
            className="custom-page-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </CustomButton>
          {pageItems(page, pageCount).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} className="custom-pagination-text" aria-hidden="true">
                …
              </span>
            ) : (
              <CustomButton
                key={item}
                variant="light"
                className={`custom-page-btn${item === page ? ' active' : ''}`}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </CustomButton>
            ),
          )}
          <CustomButton
            variant="light"
            className="custom-page-btn"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </CustomButton>
        </div>
      )}
    </nav>
  );
};

export default CustomPagination;
